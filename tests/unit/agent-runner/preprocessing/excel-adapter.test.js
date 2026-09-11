const fs = require('fs').promises;
const path = require('path');
const { ExcelAdapter } = require('../../../../packages/agent-runner-core/lib/preprocessing/cleaners/excel-adapter');

const TEST_DIR = path.join(__dirname, '..', '..', 'tmp', 'test-excel-adapter-' + Date.now());

describe('ExcelAdapter', () => {
  let adapter;

  beforeAll(async () => {
    adapter = new ExcelAdapter();
    await fs.mkdir(TEST_DIR, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('basic properties', () => {
    test('name 应为 excel', () => {
      expect(adapter.name).toBe('excel');
    });

    test('supportedExtensions 应包含 .xlsx 和 .xls', () => {
      expect(adapter.supportedExtensions).toContain('.xlsx');
      expect(adapter.supportedExtensions).toContain('.xls');
    });

    test('canHandle 应正确识别 Excel 文件', () => {
      expect(adapter.canHandle('test.xlsx')).toBe(true);
      expect(adapter.canHandle('test.xls')).toBe(true);
      expect(adapter.canHandle('test.XLSX')).toBe(true);
      expect(adapter.canHandle('test.pdf')).toBe(false);
    });
  });

  describe('scan', () => {
    test('应递归扫描目录中的 Excel 文件', async () => {
      await fs.writeFile(path.join(TEST_DIR, 'a.xlsx'), 'fake');
      await fs.mkdir(path.join(TEST_DIR, 'sub'));
      await fs.writeFile(path.join(TEST_DIR, 'sub', 'b.xls'), 'fake');
      await fs.writeFile(path.join(TEST_DIR, 'c.txt'), 'not excel');

      const files = await adapter.scan(TEST_DIR);
      expect(files.length).toBe(2);
    });
  });

  describe('convertToMarkdownTable', () => {
    test('应转换二维数组为 Markdown 表格', () => {
      const data = [
        ['名称', '值', '描述'],
        ['参数A', '100', '第一个参数'],
        ['参数B', '200', '第二个参数']
      ];
      const result = adapter.convertToMarkdownTable(data);
      expect(result).toContain('| 名称 | 值 | 描述 |');
      expect(result).toContain('| --- | --- | --- |');
      expect(result).toContain('| 参数A | 100 | 第一个参数 |');
      expect(result).toContain('| 参数B | 200 | 第二个参数 |');
    });

    test('应处理空数据', () => {
      expect(adapter.convertToMarkdownTable([])).toBe('_（空表）_');
      expect(adapter.convertToMarkdownTable(null)).toBe('_（空表）_');
    });

    test('应过滤全空行', () => {
      const data = [
        ['名称', '值'],
        ['', ''],
        ['A', '1']
      ];
      const result = adapter.convertToMarkdownTable(data);
      expect(result).toContain('| 名称 | 值 |');
      expect(result).toContain('| A | 1 |');
      // 空行应被过滤
      expect(result.split('\n').length).toBe(3); // header + separator + 1 data row + empty
    });

    test('应转义管道符', () => {
      const data = [
        ['名称', '值'],
        ['A|B', '1']
      ];
      const result = adapter.convertToMarkdownTable(data);
      expect(result).toContain('A\\|B');
    });

    test('应截断超大表格', () => {
      const data = [['名称', '值']];
      for (let i = 0; i < 600; i++) {
        data.push([`行${i}`, `${i}`]);
      }
      const result = adapter.convertToMarkdownTable(data);
      expect(result).toContain('表格已截断');
      expect(result).toContain('601 行');
    });

    test('应对齐列数', () => {
      const data = [
        ['A', 'B', 'C'],
        ['1', '2'],
        ['x']
      ];
      const result = adapter.convertToMarkdownTable(data);
      expect(result).toContain('| A | B | C |');
      // 第二行应补齐空列
      expect(result).toContain('| 1 | 2 |  |');
      expect(result).toContain('| x |  |  |');
    });

    test('应处理换行符', () => {
      const data = [
        ['名称', '值'],
        ['A\nB', '1']
      ];
      const result = adapter.convertToMarkdownTable(data);
      expect(result).toContain('A B');
      expect(result).not.toContain('A\nB');
    });
  });

  describe('parse with real Excel', () => {
    test('应能解析 xlsx 文件', async () => {
      const XLSX = require('xlsx');
      const wb = XLSX.utils.book_new();
      const wsData = [
        ['名称', '值', '描述'],
        ['参数A', 100, '第一个参数'],
        ['参数B', 200, '第二个参数']
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

      const filePath = path.join(TEST_DIR, 'test.xlsx');
      XLSX.writeFile(wb, filePath);

      const doc = await adapter.parse(filePath);
      expect(doc.title).toBe('test');
      expect(doc.metadata.sourceFormat).toBe('excel');
      expect(doc.metadata.extra.sheetCount).toBe(1);
      expect(doc.content).toContain('## Sheet1');
      expect(doc.content).toContain('| 名称 | 值 | 描述 |');
      expect(doc.content).toContain('| 参数A | 100 | 第一个参数 |');
      expect(doc.hash).toBeTruthy();
    });

    test('应处理多 Sheet', async () => {
      const XLSX = require('xlsx');
      const wb = XLSX.utils.book_new();
      
      const ws1 = XLSX.utils.aoa_to_sheet([['A', 'B'], ['1', '2']]);
      const ws2 = XLSX.utils.aoa_to_sheet([['C', 'D'], ['3', '4']]);
      XLSX.utils.book_append_sheet(wb, ws1, '数据表1');
      XLSX.utils.book_append_sheet(wb, ws2, '数据表2');

      const filePath = path.join(TEST_DIR, 'multi-sheet.xlsx');
      XLSX.writeFile(wb, filePath);

      const doc = await adapter.parse(filePath);
      expect(doc.metadata.extra.sheetCount).toBe(2);
      expect(doc.content).toContain('## 数据表1');
      expect(doc.content).toContain('## 数据表2');
      expect(doc.metadata.extra.sheets).toHaveLength(2);
    });
  });
});
