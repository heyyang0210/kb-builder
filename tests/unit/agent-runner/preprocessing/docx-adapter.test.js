const fs = require('fs').promises;
const path = require('path');
const AdmZip = require('adm-zip');
const { DocxAdapter } = require('../../../../packages/agent-runner-core/lib/preprocessing/cleaners/docx-adapter');
const { buildAsset } = require('../../../../packages/agent-runner-core/lib/preprocessing/asset-utils');

const TEST_DIR = path.join(process.env.YASDB_TEST_TMP_DIR || path.resolve(__dirname, '../../../../runtime/test-tmp'), 'test-docx-adapter-' + Date.now());

function createDocx(filePath, { body = '<w:p><w:r><w:t>正文</w:t></w:r></w:p>', media } = {}) {
  const zip = new AdmZip();
  zip.addFile('[Content_Types].xml', Buffer.from('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'));
  zip.addFile('_rels/.rels', Buffer.from('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'));
  zip.addFile('word/document.xml', Buffer.from(`<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${body}</w:body></w:document>`));
  zip.addFile('word/_rels/document.xml.rels', Buffer.from(`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${media ? '<Relationship Id="rIdImage" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>' : ''}</Relationships>`));
  if (media) zip.addFile('word/media/image1.png', media);
  zip.writeZip(filePath);
}

describe('DocxAdapter', () => {
  let adapter;

  beforeAll(async () => {
    adapter = new DocxAdapter();
    await fs.mkdir(TEST_DIR, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('basic properties', () => {
    test('name 应为 docx', () => {
      expect(adapter.name).toBe('docx');
    });

    test('supportedExtensions 应包含 .docx', () => {
      expect(adapter.supportedExtensions).toContain('.docx');
      expect(adapter.supportedExtensions).not.toContain('.doc');
    });

    test('canHandle 应正确识别 DOCX 文件', () => {
      expect(adapter.canHandle('test.docx')).toBe(true);
      expect(adapter.canHandle('test.DOCX')).toBe(true);
      expect(adapter.canHandle('test.pdf')).toBe(false);
    });
  });

  describe('scan', () => {
    test('应递归扫描目录中的 .docx 文件', async () => {
      await fs.writeFile(path.join(TEST_DIR, 'a.docx'), 'fake');
      await fs.mkdir(path.join(TEST_DIR, 'sub'));
      await fs.writeFile(path.join(TEST_DIR, 'sub', 'b.docx'), 'fake');
      await fs.writeFile(path.join(TEST_DIR, 'c.txt'), 'not docx');

      const files = await adapter.scan(TEST_DIR);
      expect(files.length).toBe(2);
      expect(files.every(f => f.endsWith('.docx'))).toBe(true);
    });
  });

  describe('htmlToMarkdown', () => {
    test('应转换标题', () => {
      const html = '<h1>一级标题</h1><h2>二级标题</h2>';
      const md = adapter.htmlToMarkdown(html);
      expect(md).toContain('# 一级标题');
      expect(md).toContain('## 二级标题');
    });

    test('应转换粗体和斜体', () => {
      const html = '<p><strong>粗体</strong> 和 <em>斜体</em></p>';
      const md = adapter.htmlToMarkdown(html);
      expect(md).toContain('**粗体**');
      expect(md).toContain('*斜体*');
    });

    test('应转换列表', () => {
      const html = '<ul><li>项目1</li><li>项目2</li></ul>';
      const md = adapter.htmlToMarkdown(html);
      expect(md).toContain('- 项目1');
      expect(md).toContain('- 项目2');
    });

    test('应转换图片', () => {
      const html = '<img src="test.png" alt="测试图片">';
      const md = adapter.htmlToMarkdown(html);
      expect(md).toContain('![测试图片](test.png)');
    });

    test('应转换链接', () => {
      const html = '<a href="https://example.com">链接文本</a>';
      const md = adapter.htmlToMarkdown(html);
      expect(md).toContain('[链接文本](https://example.com)');
    });

    test('应转换表格', () => {
      const html = `<table>
        <tr><th>名称</th><th>值</th></tr>
        <tr><td>A</td><td>1</td></tr>
      </table>`;
      const md = adapter.htmlToMarkdown(html);
      expect(md).toContain('| 名称 | 值 |');
      expect(md).toContain('| --- | --- |');
      expect(md).toContain('| A | 1 |');
    });

    test('应解码 HTML 实体', () => {
      const html = '<p>&amp; &lt; &gt; &nbsp; &quot;</p>';
      const md = adapter.htmlToMarkdown(html);
      expect(md).toContain('&');
      expect(md).toContain('<');
      expect(md).toContain('>');
    });
  });

  describe('extractTitle', () => {
    test('应从 h1 提取标题', () => {
      const title = adapter.extractTitle('<h1>标题</h1><p>内容</p>', 'test.docx');
      expect(title).toBe('标题');
    });

    test('无 h1 时应使用文件名', () => {
      const title = adapter.extractTitle('<p>内容</p>', 'my-doc.docx');
      expect(title).toBe('my-doc');
    });

    test('无 h1 时应解码 URL 编码文件名', () => {
      const title = adapter.extractTitle('<p>内容</p>', '/tmp/%E6%8C%81%E4%B9%85%E5%8C%96.docx');
      expect(title).toBe('持久化');
    });
  });

  describe('extractDocType', () => {
    test('应从路径提取文档类型', () => {
      expect(adapter.extractDocType('/path/特性设计/doc.docx')).toBe('特性设计');
      expect(adapter.extractDocType('/path/other/doc.docx')).toBe('其他');
    });
  });

  describe('parse with real DOCX', () => {
    test('解析真实 OOXML 的标题、正文、来源指标和版本元数据', async () => {
      const filePath = path.join(TEST_DIR, 'YashanDB v23.4', '特性设计', 'YDBRD-42 连接能力.docx');
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      createDocx(filePath, { body: '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>连接能力</w:t></w:r></w:p><w:p><w:r><w:t>正文内容</w:t></w:r></w:p>' });

      const document = await adapter.parse(filePath);
      expect(document.title).toBe('连接能力');
      expect(document.content).toContain('# 连接能力');
      expect(document.content).toContain('正文内容');
      expect(document.metadata).toMatchObject({ sourceFormat: 'docx', version: 'v23.4', docType: '特性设计', sourceName: 'YDBRD-42 连接能力.docx', officeRendering: { enabled: false, status: 'disabled', pageCount: 0 } });
      expect(document.metadata.keywords).toEqual(expect.arrayContaining(['YDBRD-42', '连接能力']));
      expect(document.metadata.sourceMetrics).toMatchObject({ sourceText: '连接能力正文内容', mediaCount: 0, exportedMediaCount: 0 });
      expect(document.metadata.extra).toMatchObject({ lineCount: expect.any(Number), warnings: [expect.stringContaining('Heading1')] });
      expect(document.metadata.hash).toMatch(/^[a-f0-9]{64}$/);
    });

    test('解析真实 DOCX 图片并与包内媒体去重', async () => {
      const media = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c636000020000050001a5f645400000000049454e44ae426082', 'hex');
      const filePath = path.join(TEST_DIR, 'embedded-image.docx');
      const image = '<w:p><w:r><w:drawing><wp:inline><wp:docPr id="1" name="image" descr="架构图"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:blipFill><a:blip r:embed="rIdImage"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';
      createDocx(filePath, { body: `<w:p><w:r><w:t>图片正文</w:t></w:r></w:p>${image}`, media });

      const document = await adapter.parse(filePath);
      expect(document.metadata.assets).toHaveLength(1);
      expect(document.metadata.assets[0]).toMatchObject({ sourcePart: 'word/media/image1.png', originalName: 'image1.png', mimeType: 'image/png' });
      expect(document.content).toContain(`](${document.metadata.assets[0].relativePath})`);
      expect(document.metadata.sourceMetrics).toMatchObject({ mediaCount: 1, exportedMediaCount: 1 });
    });

    test('应导出 DOCX 包中未定位的原始媒体', async () => {
      const AdmZip = require('adm-zip');
      const zip = new AdmZip();
      zip.addFile('word/document.xml', Buffer.from('<w:document xmlns:w="x"><w:t>正文</w:t></w:document>'));
      zip.addFile('word/media/image1.png', Buffer.from('original-image-bytes'));
      const filePath = path.join(TEST_DIR, 'with-media.docx');
      zip.writeZip(filePath);
      const assets = [];

      adapter.appendPackageMedia(filePath, assets, '测试文档');
      const markdown = adapter.appendUnplacedAssets('# 正文', assets);

      expect(assets).toHaveLength(1);
      expect(assets[0].data.equals(Buffer.from('original-image-bytes'))).toBe(true);
      expect(markdown).toContain(`](${assets[0].relativePath})`);
      expect(markdown).toContain('图片说明：');
    });

    test('媒体去重、已定位资产和缺失正文指标均可回读', () => {
      const filePath = path.join(TEST_DIR, 'duplicate-media.docx');
      const media = Buffer.from('shared-media');
      const zip = new AdmZip();
      zip.addFile('word/media/image1.png', media);
      zip.writeZip(filePath);
      const assets = [buildAsset({ data: media, mimeType: 'image/png', index: 1, title: '文档' })];
      adapter.appendPackageMedia(filePath, assets, '文档');
      expect(assets).toHaveLength(1);
      expect(assets[0]).toMatchObject({ sourcePart: 'word/media/image1.png', originalName: 'image1.png' });
      expect(adapter.appendUnplacedAssets(`![图](${assets[0].relativePath})`, assets)).toBe(`![图](${assets[0].relativePath})`);
      expect(adapter.extractSourceMetrics(filePath, assets.length)).toMatchObject({ sourceText: '', sourceTextChars: 0, mediaCount: 1, exportedMediaCount: 1 });
    });

    test('格式损坏时解析错误直接传播', async () => {
      const filePath = path.join(TEST_DIR, 'invalid.docx');
      await fs.writeFile(filePath, 'invalid zip');
      await expect(adapter.parse(filePath)).rejects.toThrow();
    });

    test('表格转换保留多行数据和竖线转义', () => {
      const html = `<table>
        <tr><th>Col1</th><th>Col2</th></tr>
        <tr><td>A</td><td>B</td></tr>
        <tr><td>C|D</td><td>E</td></tr>
      </table>`;
      const result = adapter.convertTables(html);
      expect(result).toContain('| Col1 | Col2 |');
      expect(result).toContain('| C\\|D | E |');
    });
  });

  test('扫描缺失目录和受限目录；其他 I/O 错误传播', async () => {
    expect(await adapter.scan(path.join(TEST_DIR, 'missing'))).toEqual([]);
    const spy = jest.spyOn(fs, 'readdir');
    try {
      spy.mockRejectedValueOnce(Object.assign(new Error('denied'), { code: 'EACCES' }));
      expect(await adapter.scan('blocked')).toEqual([]);
      spy.mockRejectedValueOnce(Object.assign(new Error('failed'), { code: 'EIO' }));
      await expect(adapter.scan('failed')).rejects.toMatchObject({ code: 'EIO' });
    } finally {
      spy.mockRestore();
    }
  });

  test('标题、表格、版本和关键词边界保留确定性结果', () => {
    expect(adapter.extractTitle('<title><b>备用标题</b></title>', 'fallback.docx')).toBe('备用标题');
    expect(adapter.extractVersion('/other/document.docx')).toBe('');
    expect(adapter.extractVersion('/YashanDB v23.4/document.docx')).toBe('v23.4');
    expect(adapter.extractKeywords('123 连接-能力', '/YDBRD-42/file.docx')).toEqual(['连接', '能力', 'YDBRD-42']);
    expect(adapter.convertTables('<table><tr></tr></table>')).toBe('');
    expect(adapter.convertTables('<table><tr><td>A</td><td>B</td></tr><tr><td>C</td></tr></table>')).toContain('| C |  |');
    expect(adapter.htmlToMarkdown('<img alt="说明">')).toContain('[图片: 说明]');
  });
});
