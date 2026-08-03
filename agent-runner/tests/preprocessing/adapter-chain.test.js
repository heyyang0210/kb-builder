const fs = require('fs').promises;
const path = require('path');
const { AdapterChain } = require('../../lib/preprocessing/cleaners/adapter-chain');
const { MarkdownAdapter } = require('../../lib/preprocessing/cleaners/markdown-adapter');
const { HtmlAdapter } = require('../../lib/preprocessing/cleaners/html-adapter');
const { PdfAdapter } = require('../../lib/preprocessing/cleaners/pdf-adapter');
const { DocxAdapter } = require('../../lib/preprocessing/cleaners/docx-adapter');
const { ExcelAdapter } = require('../../lib/preprocessing/cleaners/excel-adapter');
const { PptxAdapter } = require('../../lib/preprocessing/cleaners/pptx-adapter');
const { ArchiveAdapter } = require('../../lib/preprocessing/cleaners/archive-adapter');

const TEST_DIR = path.join(__dirname, '..', '..', 'tmp', 'test-adapter-chain-' + Date.now());

describe('AdapterChain', () => {
  let chain;

  beforeAll(async () => {
    chain = new AdapterChain([
      new MarkdownAdapter(),
      new HtmlAdapter(),
      new PdfAdapter(),
      new DocxAdapter(),
      new ExcelAdapter(),
      new PptxAdapter(),
      new ArchiveAdapter()
    ]);
    await fs.mkdir(TEST_DIR, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('constructor', () => {
    test('应能使用适配器列表初始化', () => {
      expect(chain.adapters.length).toBe(7);
    });

    test('应能空初始化', () => {
      const emptyChain = new AdapterChain();
      expect(emptyChain.adapters.length).toBe(0);
    });
  });

  describe('addAdapter', () => {
    test('应能添加适配器', () => {
      const newChain = new AdapterChain();
      newChain.addAdapter(new MarkdownAdapter());
      expect(newChain.adapters.length).toBe(1);
    });
  });

  describe('canHandle', () => {
    test('应能识别所有支持的格式', () => {
      expect(chain.canHandle('test.md')).toBe(true);
      expect(chain.canHandle('test.html')).toBe(true);
      expect(chain.canHandle('test.pdf')).toBe(true);
      expect(chain.canHandle('test.docx')).toBe(true);
      expect(chain.canHandle('test.xlsx')).toBe(true);
      expect(chain.canHandle('test.pptx')).toBe(true);
      expect(chain.canHandle('test.zip')).toBe(true);
      expect(chain.canHandle('test.tar.gz')).toBe(true);
    });

    test('不应识别不支持的格式', () => {
      expect(chain.canHandle('test.txt')).toBe(false);
      expect(chain.canHandle('test.jpg')).toBe(false);
      expect(chain.canHandle('test.py')).toBe(false);
    });

    test('空链不应处理任何文件', () => {
      const emptyChain = new AdapterChain();
      expect(emptyChain.canHandle('test.md')).toBe(false);
    });
  });

  describe('selectAdapter', () => {
    test('应为 Markdown 文件选择 MarkdownAdapter', () => {
      const adapter = chain.selectAdapter('test.md');
      expect(adapter).toBeTruthy();
      expect(adapter.name).toBe('markdown');
    });

    test('应为 HTML 文件选择 HtmlAdapter', () => {
      const adapter = chain.selectAdapter('test.html');
      expect(adapter).toBeTruthy();
      expect(adapter.name).toBe('html');
    });

    test('应为 PDF 文件选择 PdfAdapter', () => {
      const adapter = chain.selectAdapter('test.pdf');
      expect(adapter).toBeTruthy();
      expect(adapter.name).toBe('pdf');
    });

    test('应为 DOCX 文件选择 DocxAdapter', () => {
      const adapter = chain.selectAdapter('test.docx');
      expect(adapter).toBeTruthy();
      expect(adapter.name).toBe('docx');
    });

    test('应为 Excel 文件选择 ExcelAdapter', () => {
      const adapter = chain.selectAdapter('test.xlsx');
      expect(adapter).toBeTruthy();
      expect(adapter.name).toBe('excel');
    });

    test('应为 PPTX 文件选择 PptxAdapter', () => {
      const adapter = chain.selectAdapter('test.pptx');
      expect(adapter).toBeTruthy();
      expect(adapter.name).toBe('pptx');
    });

    test('应为 ZIP 文件选择 ArchiveAdapter', () => {
      const adapter = chain.selectAdapter('test.zip');
      expect(adapter).toBeTruthy();
      expect(adapter.name).toBe('archive');
    });

    test('不支持的文件应返回 null', () => {
      const adapter = chain.selectAdapter('test.txt');
      expect(adapter).toBeNull();
    });
  });

  describe('getSupportedExtensions', () => {
    test('应返回所有支持的扩展名', () => {
      const exts = chain.getSupportedExtensions();
      expect(exts).toContain('.md');
      expect(exts).toContain('.html');
      expect(exts).toContain('.pdf');
      expect(exts).toContain('.docx');
      expect(exts).toContain('.xlsx');
      expect(exts).toContain('.pptx');
      expect(exts).toContain('.zip');
      expect(exts).toContain('.tar');
      expect(exts).toContain('.tar.gz');
    });

    test('应去重', () => {
      const chain2 = new AdapterChain([new MarkdownAdapter(), new MarkdownAdapter()]);
      const exts = chain2.getSupportedExtensions();
      const mdCount = exts.filter(e => e === '.md').length;
      expect(mdCount).toBe(1);
    });
  });

  describe('scan', () => {
    test('应聚合所有适配器的扫描结果', async () => {
      await fs.writeFile(path.join(TEST_DIR, 'doc.md'), '# Markdown');
      await fs.writeFile(path.join(TEST_DIR, 'page.html'), '<html><body>HTML</body></html>');
      await fs.writeFile(path.join(TEST_DIR, 'readme.txt'), 'text');

      const files = await chain.scan(TEST_DIR);
      expect(files.length).toBe(2); // md + html, not txt
      expect(files.some(f => f.endsWith('.md'))).toBe(true);
      expect(files.some(f => f.endsWith('.html'))).toBe(true);
    });

    test('应去重', async () => {
      const scanDir = path.join(TEST_DIR, 'dedup');
      await fs.mkdir(scanDir, { recursive: true });
      await fs.writeFile(path.join(scanDir, 'doc.md'), '# Markdown');

      const files = await chain.scan(scanDir);
      const mdFiles = files.filter(f => f.endsWith('.md'));
      expect(mdFiles.length).toBe(1);
    });
  });

  describe('parse', () => {
    test('应使用正确的适配器解析 Markdown 文件', async () => {
      const filePath = path.join(TEST_DIR, 'parse-test.md');
      await fs.writeFile(filePath, '# 测试标题\n\n测试内容');

      const doc = await chain.parse(filePath);
      expect(doc.title).toBe('测试标题');
      expect(doc.metadata.sourceFormat).toBe('markdown');
    });

    test('应使用正确的适配器解析 HTML 文件', async () => {
      const filePath = path.join(TEST_DIR, 'parse-test.html');
      await fs.writeFile(filePath, '<html><head><title>HTML标题</title></head><body><p>内容</p></body></html>');

      const doc = await chain.parse(filePath);
      expect(doc.title).toBe('HTML标题');
      expect(doc.metadata.sourceFormat).toBe('html');
    });

    test('不支持的文件应抛出错误', async () => {
      const filePath = path.join(TEST_DIR, 'test.txt');
      await fs.writeFile(filePath, 'text content');

      await expect(chain.parse(filePath)).rejects.toThrow('No adapter found');
    });
  });
});
