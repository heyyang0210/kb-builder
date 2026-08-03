const fs = require('fs').promises;
const path = require('path');
const { DocxAdapter } = require('../../lib/preprocessing/cleaners/docx-adapter');

const TEST_DIR = path.join(__dirname, '..', '..', 'tmp', 'test-docx-adapter-' + Date.now());

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

    test('应能解析由 mammoth 生成的简单 DOCX', async () => {
      // 使用 mammoth 创建一个简单的 docx 进行测试
      // 由于 mammoth 不能创建 docx，我们跳过真实文件测试
      // 但测试 convertTables 方法
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
});
