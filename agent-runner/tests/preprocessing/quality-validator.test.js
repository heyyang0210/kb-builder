const fs = require('fs').promises;
const path = require('path');
const { QualityValidator } = require('../../lib/preprocessing/quality-validator');
const { PipelineReport } = require('../../lib/preprocessing/pipeline');

const TEST_DIR = path.join(__dirname, '..', '..', 'tmp', 'test-quality-' + Date.now());

describe('QualityValidator', () => {
  let validator;

  beforeAll(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
    validator = new QualityValidator({ enabled: true });
  });

  afterAll(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('validateSingleFile', () => {
    test('表格保留完整应通过', () => {
      const original = '| 参数 | 值 |\n|------|----|\n| A | 1 |';
      const cleaned = '| 参数 | 值 |\n|------|----|\n| A | 1 |';
      const result = validator.validateSingleFile(original, cleaned);
      expect(result.passed).toBe(true);
      expect(result.issues.length).toBe(0);
    });

    test('表格丢失应报告 critical 问题', () => {
      const original = '| 参数 | 值 |\n|------|----|\n| A | 1 |\n\n| 参数2 | 值2 |\n|-------|------|\n| B | 2 |';
      const cleaned = '| 参数 | 值 |\n|------|----|\n| A | 1 |';
      const result = validator.validateSingleFile(original, cleaned);
      expect(result.passed).toBe(false);
      expect(result.issues.some(i => i.type === 'table_lost')).toBe(true);
    });

    test('代码块丢失应报告 critical 问题', () => {
      const original = '```js\nconst x = 1;\n```\n\n```js\nconst y = 2;\n```';
      const cleaned = '```js\nconst x = 1;\n```';
      const result = validator.validateSingleFile(original, cleaned);
      expect(result.passed).toBe(false);
      expect(result.issues.some(i => i.type === 'code_block_lost')).toBe(true);
    });

    test('清洗后仍含内部链接应报告问题', () => {
      const original = '正常内容';
      const cleaned = '包含 https://conf.yasdb.com/xxx 的链接';
      const result = validator.validateSingleFile(original, cleaned);
      expect(result.issues.some(i => i.type === 'internal_link_remaining')).toBe(true);
    });

    test('本地图片引用丢失应报告问题', () => {
      const original = '包含 ![图片](assets/img.png) 引用';
      const cleaned = '图片已丢失';
      const result = validator.validateSingleFile(original, cleaned);
      expect(result.issues.some(i => i.type === 'image_ref_lost')).toBe(true);
    });
  });

  describe('validateAll', () => {
    test('enabled=false 时应跳过验证', async () => {
      const disabledValidator = new QualityValidator({ enabled: false });
      const report = new PipelineReport('test');
      const result = await disabledValidator.validateAll(report, {});
      expect(result.passed).toBe(true);
      expect(result.skipped).toBe(true);
    });

    test('应运行所有检查点', async () => {
      const report = new PipelineReport('test');
      report.phaseStart('clean');
      report.phaseEnd('clean', { processed: 10 });
      report.phaseStart('chunk');
      report.phaseEnd('chunk', { chunksGenerated: 20 });
      report.phaseStart('index');
      report.phaseEnd('index', {});

      // 创建必要的索引文件
      const indexDir = path.join(TEST_DIR, 'index');
      await fs.mkdir(indexDir, { recursive: true });
      await fs.writeFile(path.join(indexDir, 'l1-global-index.json'), JSON.stringify({ entries: [] }));
      await fs.mkdir(path.join(indexDir, 'l2-summaries'), { recursive: true });
      await fs.writeFile(path.join(indexDir, '_stats.json'), JSON.stringify({}));

      const config = { output: { baseDir: TEST_DIR } };
      const result = await validator.validateAll(report, config);
      expect(result.checks.cleaning).toBeTruthy();
      expect(result.checks.chunking).toBeTruthy();
      expect(result.checks.indexing).toBeTruthy();
    });
  });

  describe('extractTables', () => {
    test('应正确提取表格', () => {
      const content = '文本\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n更多文本\n\n| C | D |\n|---|---|\n| 3 | 4 |';
      const tables = validator.extractTables(content);
      expect(tables.length).toBe(2);
    });

    test('无表格应返回空数组', () => {
      const tables = validator.extractTables('纯文本内容');
      expect(tables).toEqual([]);
    });
  });

  describe('extractCodeBlocks', () => {
    test('应正确提取代码块', () => {
      const content = '文本\n\n```js\ncode1\n```\n\n```python\ncode2\n```';
      const blocks = validator.extractCodeBlocks(content);
      expect(blocks.length).toBe(2);
    });

    test('无代码块应返回空数组', () => {
      const blocks = validator.extractCodeBlocks('纯文本');
      expect(blocks).toEqual([]);
    });
  });
});
