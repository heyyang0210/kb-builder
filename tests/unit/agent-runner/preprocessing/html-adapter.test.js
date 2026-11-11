const fs = require('fs').promises;
const path = require('path');
const { HtmlAdapter } = require('../../../../packages/agent-runner-core/lib/preprocessing/cleaners/html-adapter');

const TEST_DIR = path.join(process.env.YASDB_TEST_TMP_DIR || path.resolve('runtime/test-results'), 'test-html-adapter-' + process.pid + '-' + Date.now());

describe('HtmlAdapter', () => {
  let adapter;

  beforeAll(async () => {
    adapter = new HtmlAdapter();
    await fs.mkdir(TEST_DIR, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('basic properties', () => {
    test('name 应为 html', () => {
      expect(adapter.name).toBe('html');
    });

    test('supportedExtensions 应包含 .html 和 .htm', () => {
      expect(adapter.supportedExtensions).toContain('.html');
      expect(adapter.supportedExtensions).toContain('.htm');
    });

    test('canHandle 应正确识别 HTML 文件', () => {
      expect(adapter.canHandle('test.html')).toBe(true);
      expect(adapter.canHandle('test.htm')).toBe(true);
      expect(adapter.canHandle('test.HTML')).toBe(true);
      expect(adapter.canHandle('test.md')).toBe(false);
      expect(adapter.canHandle('test.txt')).toBe(false);
    });
  });

  describe('scan', () => {
    test('缺失目录可忽略，非目录错误应传播，符号链接不重复导入', async () => {
      expect(await adapter.scan(path.join(TEST_DIR, 'missing'))).toEqual([]);
      const root = path.join(TEST_DIR, 'scan-boundaries');
      await fs.mkdir(root);
      const file = path.join(root, 'source.html');
      await fs.writeFile(file, '<p>来源</p>');
      await fs.symlink(file, path.join(root, 'alias.html'));
      expect(await adapter.scan(root)).toEqual([file]);
      await expect(adapter.scan(file)).rejects.toMatchObject({ code: 'ENOTDIR' });
      await fs.rm(root, { recursive: true });
    });
    test('应递归扫描目录中的 .html 文件', async () => {
      await fs.writeFile(path.join(TEST_DIR, 'a.html'), '<html><body>A</body></html>');
      await fs.mkdir(path.join(TEST_DIR, 'sub'));
      await fs.writeFile(path.join(TEST_DIR, 'sub', 'b.htm'), '<html><body>B</body></html>');
      await fs.writeFile(path.join(TEST_DIR, 'c.md'), '# Not HTML');

      const files = await adapter.scan(TEST_DIR);
      expect(files.length).toBe(2);
      expect(files.every(f => f.endsWith('.html') || f.endsWith('.htm'))).toBe(true);
    });

    test('空目录应返回空数组', async () => {
      const emptyDir = path.join(TEST_DIR, 'empty-html');
      await fs.mkdir(emptyDir, { recursive: true });
      const files = await adapter.scan(emptyDir);
      expect(files).toEqual([]);
    });
  });

  describe('parse', () => {
    test('应保留行内代码、列表、换行和不规则表格的语义', async () => {
      const root = path.join(TEST_DIR, 'YashanDB v23.2');
      await fs.mkdir(root);
      const file = path.join(root, 'YDBRD-987.html');
      await fs.writeFile(file, `<html><head><title>SQL 导入 123</title>
        <meta name="description" content="边界说明"><meta property="article:published_time" content="2026-11-10">
        <meta name="keywords" content="导入, ,兼容"></head><body>
        <div><code>SELECT 1</code><br>下一行</div>
        <ul><li>无序项</li></ul><ol><li>有序项</li></ol>
        <table><tr></tr></table><table><tr><th>A|B</th></tr><tr><td>一</td><td>二</td></tr></table>
        <pre>无语言代码</pre><img><a>无地址链接</a></body></html>`);
      const doc = await adapter.parse(file);
      for (const fragment of ['`SELECT 1`\n下一行', '- 无序项', '1. 有序项', '| A\\|B |  |', '| 一 | 二 |', '```\n无语言代码\n```', '[图片: 图片]', '[无地址链接]()']) {
        expect(doc.content).toContain(fragment);
      }
      expect(doc.metadata).toMatchObject({ version: 'v23.2', createdDate: '2026-11-10', docType: '其他' });
      expect(doc.metadata.keywords).toEqual(expect.arrayContaining(['SQL', '导入', '兼容', 'YDBRD-987']));
      expect(doc.metadata.keywords).not.toContain('123');
    });

    test('创建时间优先使用 created，正文可提供特性编号', async () => {
      const file = path.join(TEST_DIR, 'body-feature.html');
      await fs.writeFile(file, '<meta name="created" content="2026-11-09"><meta property="article:published_time" content="2026-11-10"><body>YDBRD-456</body>');
      const doc = await adapter.parse(file);
      expect(doc.metadata.createdDate).toBe('2026-11-09');
      expect(doc.metadata.keywords).toContain('YDBRD-456');
    });
    test('应从 <title> 标签提取标题', async () => {
      const filePath = path.join(TEST_DIR, 'title.html');
      await fs.writeFile(filePath, '<html><head><title>我的标题</title></head><body>内容</body></html>');
      const doc = await adapter.parse(filePath);
      expect(doc.title).toBe('我的标题');
    });

    test('无 <title> 时应从 <h1> 提取', async () => {
      const filePath = path.join(TEST_DIR, 'h1-title.html');
      await fs.writeFile(filePath, '<html><body><h1>H1 标题</h1><p>内容</p></body></html>');
      const doc = await adapter.parse(filePath);
      expect(doc.title).toBe('H1 标题');
    });

    test('无标题时应使用文件名', async () => {
      const filePath = path.join(TEST_DIR, 'no-title.html');
      await fs.writeFile(filePath, '<html><body><p>没有标题</p></body></html>');
      const doc = await adapter.parse(filePath);
      expect(doc.title).toBe('no-title');
    });

    test('应转换标题为 Markdown', async () => {
      const filePath = path.join(TEST_DIR, 'headings.html');
      await fs.writeFile(filePath, `
        <html><body>
          <h1>一级标题</h1>
          <h2>二级标题</h2>
          <h3>三级标题</h3>
        </body></html>
      `);
      const doc = await adapter.parse(filePath);
      expect(doc.content).toContain('# 一级标题');
      expect(doc.content).toContain('## 二级标题');
      expect(doc.content).toContain('### 三级标题');
    });

    test('应转换表格为 Markdown 表格', async () => {
      const filePath = path.join(TEST_DIR, 'table.html');
      await fs.writeFile(filePath, `
        <html><body>
          <table>
            <tr><th>名称</th><th>值</th></tr>
            <tr><td>参数A</td><td>100</td></tr>
            <tr><td>参数B</td><td>200</td></tr>
          </table>
        </body></html>
      `);
      const doc = await adapter.parse(filePath);
      expect(doc.content).toContain('| 名称 | 值 |');
      expect(doc.content).toContain('| --- | --- |');
      expect(doc.content).toContain('| 参数A | 100 |');
      expect(doc.content).toContain('| 参数B | 200 |');
    });

    test('应处理图片引用', async () => {
      const filePath = path.join(TEST_DIR, 'images.html');
      await fs.writeFile(filePath, `
        <html><body>
          <p>文本</p>
          <img src="test.png" alt="测试图片">
        </body></html>
      `);
      const doc = await adapter.parse(filePath);
      expect(doc.content).toContain('[图片: 测试图片]');
    });

    test('应处理代码块', async () => {
      const filePath = path.join(TEST_DIR, 'code.html');
      await fs.writeFile(filePath, `
        <html><body>
          <pre><code class="language-sql">SELECT * FROM table;</code></pre>
        </body></html>
      `);
      const doc = await adapter.parse(filePath);
      expect(doc.content).toContain('```sql');
      expect(doc.content).toContain('SELECT * FROM table;');
      expect(doc.content).toContain('```');
    });

    test('应处理粗体和斜体', async () => {
      const filePath = path.join(TEST_DIR, 'formatting.html');
      await fs.writeFile(filePath, `
        <html><body>
          <p><strong>粗体</strong> 和 <em>斜体</em></p>
        </body></html>
      `);
      const doc = await adapter.parse(filePath);
      expect(doc.content).toContain('**粗体**');
      expect(doc.content).toContain('*斜体*');
    });

    test('应处理锚点链接', async () => {
      const filePath = path.join(TEST_DIR, 'anchors.html');
      await fs.writeFile(filePath, `
        <html><body>
          <p><a href="#section1">跳转到第一节</a></p>
          <p><a href="https://example.com">外部链接</a></p>
        </body></html>
      `);
      const doc = await adapter.parse(filePath);
      expect(doc.content).toContain('跳转到第一节');
      expect(doc.content).not.toContain('#section1');
      expect(doc.content).toContain('[外部链接](https://example.com)');
    });

    test('应设置正确的 metadata', async () => {
      const filePath = path.join(TEST_DIR, 'meta.html');
      await fs.writeFile(filePath, `
        <html>
        <head>
          <meta name="author" content="张三">
          <meta name="keywords" content="数据库,SQL">
        </head>
        <body><p>内容</p></body>
        </html>
      `);
      const doc = await adapter.parse(filePath);
      expect(doc.metadata.sourceFormat).toBe('html');
      expect(doc.metadata.author).toBe('张三');
      expect(doc.metadata.keywords).toContain('数据库');
      expect(doc.metadata.keywords).toContain('SQL');
      expect(doc.hash).toBeTruthy();
    });

    test('应从路径提取文档类型', async () => {
      const typeDir = path.join(TEST_DIR, '特性设计');
      await fs.mkdir(typeDir, { recursive: true });
      const filePath = path.join(typeDir, 'doc.html');
      await fs.writeFile(filePath, '<html><body><p>内容</p></body></html>');
      const doc = await adapter.parse(filePath);
      expect(doc.metadata.docType).toBe('特性设计');
    });

    test('应检测图片、表格和代码块', async () => {
      const filePath = path.join(TEST_DIR, 'detection.html');
      await fs.writeFile(filePath, `
        <html><body>
          <table><tr><td>1</td></tr></table>
          <img src="x.png" alt="x">
          <pre><code>code</code></pre>
        </body></html>
      `);
      const doc = await adapter.parse(filePath);
      expect(doc.metadata.extra.hasImages).toBe(true);
      expect(doc.metadata.extra.hasTables).toBe(true);
      expect(doc.metadata.extra.hasCodeBlocks).toBe(true);
    });
  });
});
