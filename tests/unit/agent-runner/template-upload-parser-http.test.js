const http = require('http');
const { readTemplateUpload } = require('../../../packages/agent-runner-core/lib/template-import');

describe('模板上传解析真实HTTP边界', () => {
  let server;
  let port;
  let onStarted;
  let onFailure;
  beforeAll(async () => {
    server = http.createServer(async (req, res) => {
      req.once('data', () => { if (onStarted) onStarted(); });
      try {
        const result = await readTemplateUpload(req);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(result));
      } catch (error) {
        if (onFailure) onFailure(error);
        req.resume();
        res.statusCode = error.status || 500;
        res.end(JSON.stringify({ code: error.code, message: error.message }));
      }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    port = server.address().port;
  });
  afterAll(async () => new Promise(resolve => server.close(resolve)));
  function request(body, contentType = 'multipart/form-data; boundary=upload') {
    return new Promise((resolve, reject) => {
      const req = http.request({ host: '127.0.0.1', port, method: 'POST',
        headers: { 'content-type': contentType, 'content-length': Buffer.byteLength(body) } }, res => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
      });
      req.on('error', reject);
      req.end(body);
    });
  }
  const field = (name, value) => `--upload\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`;
  const file = (name, value) => `--upload\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: text/markdown\r\n\r\n${value}\r\n`;

  test('非multipart和缺失边界均返回400', async () => {
    for (const type of ['application/json', 'multipart/form-data']) {
      expect(await request('{}', type)).toMatchObject({ status: 400, body: { code: 'TEMPLATE_INVALID_UPLOAD' } });
    }
  });
  test('损坏报文返回400，合法上传仍能成功', async () => {
    expect(await request(file('broken.md', 'text'))).toMatchObject({ status: 400, body: { code: 'TEMPLATE_INVALID_UPLOAD' } });
    const result = await request(file('正常.md', '# 标题') + '--upload--\r\n');
    expect(result).toMatchObject({ status: 200, body: { batch: false, files: [{ name: '正常', content: '# 标题', warnings: [] }] } });
  });
  test.each([
    ['未知字段', field('unknown', 'x'), 'TEMPLATE_INVALID_UPLOAD', 400],
    ['超长字段', field('description', 'x'.repeat(8193)), 'TEMPLATE_INVALID_UPLOAD', 400],
    ['字段数量超限', ['name', 'type', 'description', 'name'].map(name => field(name, 'x')).join(''), 'TEMPLATE_INVALID_UPLOAD', 413],
    ['无文件', field('name', 'title'), 'TEMPLATE_FILE_REQUIRED', 400],
  ])('%s返回具体错误', async (_, body, code, status) => {
    expect(await request(body + '--upload--\r\n')).toMatchObject({ status, body: { code } });
  });
  test('超过40MB请求返回413且后续上传可以恢复', async () => {
    expect(await request(file('large.md', 'x'.repeat(41 * 1024 * 1024)) + '--upload--\r\n'))
      .toMatchObject({ status: 413, body: { code: 'TEMPLATE_REQUEST_TOO_LARGE' } });
    expect(await request(field('name', '显式标题') + file('ok.md', 'ok') + '--upload--\r\n'))
      .toMatchObject({ status: 200, body: { files: [{ name: '显式标题', content: 'ok' }] } });
  });
  test('非法UTF8保留文件级编码诊断', async () => {
    const prefix = '--upload\r\nContent-Disposition: form-data; name="file"; filename="invalid.md"\r\n\r\n';
    const body = Buffer.concat([Buffer.from(prefix), Buffer.from([0xc3, 0x28]), Buffer.from('\r\n--upload--\r\n')]);
    const result = await request(body);
    expect(result).toMatchObject({ status: 200, body: { files: [{ sourceFilename: 'invalid.md',
      error: { code: 'TEMPLATE_ENCODING_INVALID', status: 422 } }] } });
    expect(result.body.files[0].content).toBeUndefined();
  });
  test('批量files保留输入顺序、公共元数据和每文件标题', async () => {
    const body = field('description', '批量说明') + field('type', 'design') +
      file('first.md', '# first').replace('name="file"', 'name="files"') +
      file('second.markdown', '# second').replace('name="file"', 'name="files"') + '--upload--\r\n';
    expect(await request(body)).toMatchObject({ status: 200, body: { batch: true, files: [
      { clientIndex: 0, name: 'first', content: '# first', description: '批量说明', type: 'design' },
      { clientIndex: 1, name: 'second', content: '# second', description: '批量说明', type: 'design' },
    ] } });
  });
  test('非法文件字段拒绝整个上传', async () => {
    expect(await request(file('ok.md', 'ok').replace('name="file"', 'name="attachment"') + '--upload--\r\n'))
      .toMatchObject({ status: 400, body: { code: 'TEMPLATE_INVALID_UPLOAD' } });
  });
  test('客户端断开保留中断原因，随后合法上传恢复', async () => {
    const started = new Promise(resolve => { onStarted = resolve; });
    const failure = new Promise(resolve => { onFailure = resolve; });
    const req = http.request({ host: '127.0.0.1', port, method: 'POST', headers: {
      'content-type': 'multipart/form-data; boundary=upload', 'content-length': 1000000,
    } });
    req.on('error', () => {});
    try {
      req.write(file('partial.md', 'partial'));
      await started;
      req.destroy();
      expect(await failure).toMatchObject({ code: 'TEMPLATE_UPLOAD_ABORTED', status: 400 });
    } finally {
      req.destroy();
      onStarted = undefined;
      onFailure = undefined;
    }
    expect(await request(file('ok.md', 'recovered') + '--upload--\r\n'))
      .toMatchObject({ status: 200, body: { files: [{ content: 'recovered' }] } });
  });
});
