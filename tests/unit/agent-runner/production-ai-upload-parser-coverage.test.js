const { parseUpload } = require('../../../packages/agent-runner-core/lib/production-ai-upload-parser');
const AdmZip = require('adm-zip');

const policy = { memoryMb: 64, timeoutMs: 5000, maxPdfPages: 3, maxExpandedBytes: 4096 };
const imagePolicy = { maxCount: 2, maxBytes: 1024, maxTotalBytes: 2048 };

function parseInCoverageContext(buffer, extension, options = {}) {
  let receive;
  const message = new Promise(resolve => { receive = resolve; });
  jest.isolateModules(() => {
    jest.doMock('node:worker_threads', () => ({
      isMainThread: false,
      parentPort: { postMessage: receive },
      workerData: { buffer, extension, policy: { ...policy, ...options }, imagePolicy },
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
