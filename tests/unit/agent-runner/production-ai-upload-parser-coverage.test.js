const { parseUpload } = require('../../../packages/agent-runner-core/lib/production-ai-upload-parser');
const AdmZip = require('adm-zip');

const policy = { memoryMb: 64, timeoutMs: 5000, maxPdfPages: 3, maxExpandedBytes: 4096 };
const imagePolicy = { maxCount: 2, maxBytes: 1024, maxTotalBytes: 2048 };

function parseInCoverageContext(buffer, extension, options = {}, imageOptions = {}) {
  let receive;
  const message = new Promise(resolve => { receive = resolve; });
  jest.isolateModules(() => {
    jest.doMock('node:worker_threads', () => ({
      isMainThread: false,
      parentPort: { postMessage: receive },
      workerData: { buffer, extension, policy: { ...policy, ...options }, imagePolicy: { ...imagePolicy, ...imageOptions } },
    }));
    require('../../../packages/agent-runner-core/lib/production-ai-upload-parser');
  });
  jest.dontMock('node:worker_threads');
  return message;
}

function docxArchive() {
  const zip = new AdmZip();
  zip.addFile('[Content_Types].xml', Buffer.from('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'));
  zip.addFile('_rels/.rels', Buffer.from('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'));
  return zip;
}

test('文本上传严格解码并拒绝二进制与不支持的扩展名', async () => {
  expect(await parseUpload(Buffer.from('# 标题'), 'md', policy, imagePolicy)).toEqual({ content: '# 标题' });
  await expect(parseUpload(Buffer.from([0xff]), 'txt', policy, imagePolicy)).rejects.toThrow('文件格式无效');
  await expect(parseUpload(Buffer.from([0]), 'sql', policy, imagePolicy)).rejects.toThrow('文件格式无效');
  await expect(parseUpload(Buffer.from('x'), 'exe', policy, imagePolicy)).rejects.toThrow('文件格式无效');
});

test('PDF 文件签名和超时在隔离 Worker 中拒绝', async () => {
  await expect(parseUpload(Buffer.from('not a pdf'), 'pdf', policy, imagePolicy)).rejects.toThrow('文件格式无效');
  await expect(parseUpload(Buffer.from('ok'), 'md', { ...policy, timeoutMs: 1 }, imagePolicy)).rejects.toThrow('超时');
});

test('DOCX 正文在 Worker 中转换为 Markdown，缺失正文与超量解压被拒绝', async () => {
  const zip = docxArchive();
  const withoutBody = zip.toBuffer();
  await expect(parseUpload(withoutBody, 'docx', policy, imagePolicy)).rejects.toThrow('文件格式无效');
  zip.addFile('word/document.xml', Buffer.from('<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>DOCX 测试正文</w:t></w:r></w:p></w:body></w:document>'));
  const document = zip.toBuffer();
  await expect(parseUpload(document, 'docx', { ...policy, maxExpandedBytes: 1 }, imagePolicy)).rejects.toThrow('文件格式无效');
  const parsed = await parseUpload(document, 'docx', policy, imagePolicy);
  expect(parsed).toMatchObject({ content: expect.stringContaining('DOCX 测试正文'), imageResources: [], authenticatedImages: true });
});

test('Jest 对同一 Worker DOCX 转换分支计数', async () => {
  const zip = docxArchive();
  expect(await parseInCoverageContext(zip.toBuffer(), 'docx')).toHaveProperty('error');
  zip.addFile('word/document.xml', Buffer.from('<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>DOCX 测试正文</w:t></w:r></w:p></w:body></w:document>'));
  expect(await parseInCoverageContext(zip.toBuffer(), 'docx', { maxExpandedBytes: 1 })).toHaveProperty('error');
  expect(await parseInCoverageContext(zip.toBuffer(), 'docx')).toMatchObject({
    content: expect.stringContaining('DOCX 测试正文'), imageResources: [], authenticatedImages: true,
  });
});

test('Jest 对同一 Worker 解析分支记录文本与 PDF 成败计数', async () => {
  expect(await parseInCoverageContext(Buffer.from('正文'), 'txt')).toEqual({ content: '正文' });
  expect(await parseInCoverageContext(Buffer.from([0]), 'txt')).toEqual({ error: '文件格式无效、内容损坏或超出解析限制' });
  expect(await parseInCoverageContext(Buffer.from('x'), 'pdf')).toHaveProperty('error');
  expect(await parseInCoverageContext(Buffer.from('x'), 'exe')).toHaveProperty('error');

  jest.doMock('pdf-parse/lib/pdf-parse', () => jest.fn(async () => ({ numpages: 1, text: 'PDF 正文' })));
  expect(await parseInCoverageContext(Buffer.from('%PDF-test'), 'pdf')).toEqual({ content: 'PDF 正文' });
  jest.doMock('pdf-parse/lib/pdf-parse', () => jest.fn(async () => ({ numpages: 4, text: '' })));
  expect(await parseInCoverageContext(Buffer.from('%PDF-test'), 'pdf')).toHaveProperty('error');
  jest.dontMock('pdf-parse/lib/pdf-parse');
});


const htmlFixture = '<html><body><nav>导航</nav><main><h1>上传正文</h1><p>保留文本 <a href="https://example.org/doc">公开链接</a> <a href="#section">锚点</a> <a href="local.md">相对路径</a> <a href="">空地址</a></p><script>danger()</script><p hidden>隐藏内容</p><img src="https://example.org/private.png"></main><footer>页脚</footer></body></html>';
function assertHtml(parsed) {
  expect(parsed.content).toContain('# 上传正文');
  expect(parsed.content).toContain('[公开链接](https://example.org/doc)');
  expect(parsed.content).toContain('锚点');
  expect(parsed.content).not.toContain('](#section)');
  expect(parsed.content).toContain('相对路径');
  expect(parsed.content).not.toMatch(/danger|导航|隐藏内容|页脚|private.png|local.md/);
}
test('HTML 真正 Worker 提取正文并移除脚本、隐藏和非正文内容', async () => {
  assertHtml(await parseUpload(Buffer.from(htmlFixture), 'html', policy, imagePolicy));
  for (const raw of ['plain text', '<p>正文\0</p>']) {
    await expect(parseUpload(Buffer.from(raw), 'htm', policy, imagePolicy)).rejects.toThrow('文件格式无效');
  }
});
test('HTML 插桩上下文核对同一转换结果及无主区域回退', async () => {
  assertHtml(await parseInCoverageContext(Buffer.from(htmlFixture), 'htm'));
  const fallback = await parseInCoverageContext(Buffer.from('<p>无主区域正文</p>'), 'html');
  expect(fallback).toEqual({ content: '无主区域正文' });
  expect(await parseInCoverageContext(Buffer.from('plain text'), 'html')).toHaveProperty('error');
  expect(await parseInCoverageContext(Buffer.from('<p>正文\0</p>'), 'html')).toHaveProperty('error');
});

const embeddedPng = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c636000020000050001a5f645400000000049454e44ae426082', 'hex');
function imageDocx() {
  const zip = docxArchive();
  zip.addFile('[Content_Types].xml', Buffer.from('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'));
  const drawing = '<w:p><w:r><w:drawing><wp:inline><wp:extent cx="1" cy="1"/><wp:docPr id="1" name="图片"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="1" name="图片"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdImage"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';
  zip.addFile('word/document.xml', Buffer.from(`<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body><w:p><w:r><w:t>嵌入图片正文</w:t></w:r></w:p>${drawing}${drawing}</w:body></w:document>`));
  zip.addFile('word/_rels/document.xml.rels', Buffer.from('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdImage" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/></Relationships>'));
  zip.addFile('word/media/image1.png', embeddedPng);
  return zip.toBuffer();
}
test('真实 Worker DOCX 图片输出包含可回读字节和引用', async () => {
  const result = await parseUpload(imageDocx(), 'docx', { ...policy, maxExpandedBytes: 20000 }, imagePolicy);
  expect(result.content).toContain('嵌入图片正文');
  expect(result.content).toContain('source-image:local-0');
  expect(result.authenticatedImages).toBe(true);
  expect(result.imageResources).toHaveLength(2);
  for (const resource of result.imageResources) {
    expect(resource.status).toBe('ready');
    expect(Buffer.from(resource.dataBase64, 'base64')).toEqual(embeddedPng);
  }
});
test.each([
  ['正常', {}, ['ready', 'ready']],
  ['单张限制', { maxBytes: 1 }, ['failed', 'failed']],
  ['总量限制', { maxTotalBytes: embeddedPng.length }, ['ready', 'failed']],
  ['数量限制', { maxCount: 1 }, ['ready']],
])('DOCX 图片插桩解析配额：%s', async (_, limits, states) => {
  const result = await parseInCoverageContext(imageDocx(), 'docx', { maxExpandedBytes: 20000 }, limits);
  expect(result.content).toContain('嵌入图片正文');
  expect(result.imageResources.map(image => image.status)).toEqual(states);
  for (const image of result.imageResources) {
    if (image.status === 'ready') expect(Buffer.from(image.dataBase64, 'base64')).toEqual(embeddedPng);
    else expect(image).not.toHaveProperty('dataBase64');
  }
  if (limits.maxCount === 1) expect(result.content).toContain('source-image:omitted');
});

test.each(['error', 'exit'])('Worker %s 事件拒绝解析并终止子线程，后续事件不重复结算', async event => {
  const { EventEmitter } = require('node:events');
  const terminate = jest.fn();
  let worker; let isolatedParse;
  jest.isolateModules(() => {
    jest.doMock('node:worker_threads', () => ({
      isMainThread: true,
      Worker: class extends EventEmitter {
        constructor() {
          super(); worker = this;
          this.terminate = terminate;
        }
      },
    }));
    isolatedParse = require('../../../packages/agent-runner-core/lib/production-ai-upload-parser').parseUpload;
  });
  jest.dontMock('node:worker_threads');
  const parsing = isolatedParse(Buffer.from('正文'), 'txt', policy, imagePolicy);
  const assertion = expect(parsing).rejects.toThrow(event === 'error' ? 'worker resource failure' : '文档解析未完成（7）');
  worker.emit(event, event === 'error' ? new Error('worker resource failure') : 7);
  worker.emit('message', { content: '迟到正文' });
  if (event === 'error') worker.emit('exit', 1);
  await assertion;
  expect(terminate).toHaveBeenCalledTimes(1);
});
