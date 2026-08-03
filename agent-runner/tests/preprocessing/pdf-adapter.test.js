const fs = require('fs').promises;
const path = require('path');
const { PdfAdapter } = require('../../lib/preprocessing/cleaners/pdf-adapter');

const TEST_DIR = path.join(__dirname, '..', '..', 'tmp', 'test-pdf-adapter-' + Date.now());

describe('PdfAdapter', () => {
  let adapter;

  beforeAll(async () => {
    adapter = new PdfAdapter();
    await fs.mkdir(TEST_DIR, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('basic properties', () => {
    test('name 应为 pdf', () => {
      expect(adapter.name).toBe('pdf');
    });

    test('supportedExtensions 应包含 .pdf', () => {
      expect(adapter.supportedExtensions).toContain('.pdf');
    });

    test('canHandle 应正确识别 PDF 文件', () => {
      expect(adapter.canHandle('test.pdf')).toBe(true);
      expect(adapter.canHandle('test.PDF')).toBe(true);
      expect(adapter.canHandle('test.md')).toBe(false);
    });
  });

  describe('scan', () => {
    test('应递归扫描目录中的 .pdf 文件', async () => {
      await fs.writeFile(path.join(TEST_DIR, 'a.pdf'), 'fake pdf');
      await fs.mkdir(path.join(TEST_DIR, 'sub'));
      await fs.writeFile(path.join(TEST_DIR, 'sub', 'b.pdf'), 'fake pdf');
      await fs.writeFile(path.join(TEST_DIR, 'c.txt'), 'not pdf');

      const files = await adapter.scan(TEST_DIR);
      expect(files.length).toBe(2);
      expect(files.every(f => f.endsWith('.pdf'))).toBe(true);
    });
  });

  describe('cleanPdfText', () => {
    test('应修复断行连字符', () => {
      const result = adapter.cleanPdfText('pre-\nprocessing');
      expect(result).toBe('preprocessing');
    });

    test('应合并断开的段落', () => {
      const result = adapter.cleanPdfText('end of line\ncontinues here');
      expect(result).toBe('end of line continues here');
    });

    test('应清理多余空行', () => {
      const result = adapter.cleanPdfText('line1\n\n\n\nline2');
      expect(result).toBe('line1\n\nline2');
    });
  });

  describe('parsePdfDate', () => {
    test('应解析 D:YYYYMMDD 格式', () => {
      expect(adapter.parsePdfDate('D:20240315')).toBe('2024-03-15');
    });

    test('应解析 D:YYYYMMDDHHmmSS 格式', () => {
      expect(adapter.parsePdfDate('D:20240315120000')).toBe('2024-03-15');
    });

    test('空值应返回空字符串', () => {
      expect(adapter.parsePdfDate('')).toBe('');
      expect(adapter.parsePdfDate(null)).toBe('');
    });
  });

  describe('extractDocType', () => {
    test('应从路径提取文档类型', () => {
      expect(adapter.extractDocType('/path/特性设计/doc.pdf')).toBe('特性设计');
      expect(adapter.extractDocType('/path/概要设计/doc.pdf')).toBe('概要设计');
      expect(adapter.extractDocType('/path/other/doc.pdf')).toBe('其他');
    });
  });

  describe('extractVersion', () => {
    test('应从路径提取版本号', () => {
      expect(adapter.extractVersion('/path/YashanDB v23.2/doc.pdf')).toBe('v23.2');
      expect(adapter.extractVersion('/path/other/doc.pdf')).toBe('');
    });
  });

  describe('parse with real PDF', () => {
    test('应能解析最小 PDF', async () => {
      const filePath = path.join(TEST_DIR, 'minimal.pdf');
      const fixture = require.resolve('pdf-parse/test/data/04-valid.pdf');
      await fs.copyFile(fixture, filePath);

      const doc = await adapter.parse(filePath);
      expect(doc.title).toBeTruthy();
      expect(doc.metadata.sourceFormat).toBe('pdf');
      expect(doc.hash).toBeTruthy();
      expect(doc.metadata.extra.pageCount).toBeGreaterThanOrEqual(1);
    });
  });
});
