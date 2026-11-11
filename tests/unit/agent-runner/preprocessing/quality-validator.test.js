const fs = require('fs').promises;
const path = require('path');
const { QualityValidator } = require('../../../../packages/agent-runner-core/lib/preprocessing/quality-validator');
const { PipelineReport } = require('../../../../packages/agent-runner-core/lib/preprocessing/pipeline');

const TEST_DIR = path.join(process.env.YASDB_TEST_TMP_DIR || path.resolve(__dirname, '../../../../runtime/test-tmp'), 'test-quality-' + Date.now());

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

describe('QualityValidator 真实文件异常边界', () => {
  let root;
  beforeEach(async () => {
    const parent = path.resolve(__dirname, '../../../../runtime/test-tmp');
    await fs.mkdir(parent, { recursive: true });
    root = await fs.mkdtemp(path.join(parent, 'quality-validator-'));
  });
  afterEach(() => fs.rm(root, { recursive: true, force: true }));
  const report = { phases: { clean: {}, chunk: {}, index: {} } };
  async function indexFiles({ l1 = true, l2 = true, stats = true } = {}) {
    const index = path.join(root, 'index');
    await fs.mkdir(index, { recursive: true });
    if (l1) await fs.writeFile(path.join(index, 'l1-global-index.json'), l1 === 'corrupt' ? '{' : '{"total_entries":2}');
    if (l2) await fs.mkdir(path.join(index, 'l2-summaries'));
    if (stats) await fs.writeFile(path.join(index, '_stats.json'), stats === 'corrupt' ? '{' : '{"documents":2}');
  }
  test('字典缺失、损坏与合法条目均按公开接口回读', async () => {
    const validator = new QualityValidator();
    expect(await validator.loadTermDictionary()).toEqual([]);
    expect(await validator.loadTermDictionary(path.join(root, 'missing'))).toEqual([]);
    const file = path.join(root, 'terms.json');
    await fs.writeFile(file, '{');
    expect(await validator.loadTermDictionary(file)).toEqual([]);
    await fs.writeFile(file, '[{"term":"事务","canonical":"transaction"}]');
    expect(await validator.loadTermDictionary(file)).toEqual([{ term: '事务', canonical: 'transaction' }]);
  });
  test('无阶段和已跳过的分块无需检查点', async () => {
    const validator = new QualityValidator();
    expect(await validator.validateAll({}, {})).toEqual({ passed: true, checks: {}, critical_failures: [] });
    expect(await validator.validateAll({ phases: { chunk: { data: { skipped: true } } } }, {})).toEqual({ passed: true, checks: {}, critical_failures: [] });
  });
  test('源文本保真失败归入清洗严重失败并保留文档诊断', async () => {
    const validator = new QualityValidator();
    const result = await validator.validateAll({ phases: { clean: {} } }, {}, [{ content: '保留', metadata: { docId: 'lost-text', sourceMetrics: { sourceText: '完全缺失正文' } } }]);
    expect(result).toMatchObject({ passed: false, critical_failures: ['cleaning'], checks: { cleaning: { passed: false, has_critical: true, checks: { office_fidelity: { passed: false, documents: [{ docId: 'lost-text', passed: false, textRecall: 0 }] } } } } });
  });
  test.each([
    ['缺少全部索引', { l1: false, l2: false, stats: false }],
    ['损坏 L1', { l1: 'corrupt' }],
    ['缺少 L2', { l2: false }],
  ])('%s归入索引严重失败', async (_, options) => {
    await indexFiles(options);
    const result = await new QualityValidator().validateAll(report, { output: { baseDir: root } });
    expect(result.passed).toBe(false);
    expect(result.critical_failures).toEqual(['indexing']);
    expect(result.checks.indexing.has_critical).toBe(true);
    expect(result.checks.chunking).toMatchObject({ passed: true, has_critical: false });
  });
  test.each([false, 'corrupt'])('统计文件异常 %s 只产生非严重失败', async stats => {
    await indexFiles({ stats });
    const result = await new QualityValidator().validateAll(report, { output: { baseDir: root } });
    expect(result).toMatchObject({ passed: false, critical_failures: [], checks: { indexing: { passed: false, has_critical: false, checks: { l1_exists: { passed: true, entries: 2 }, l2_exists: { passed: true, files: 0 }, stats_exists: { passed: false } } } } });
  });
  test('完整索引保留 L1 条目数量、L2 文件数与原始统计', async () => {
    await indexFiles();
    await fs.writeFile(path.join(root, 'index/l2-summaries/doc.json'), '{}');
    const result = await new QualityValidator().validateAll(report, { output: { baseDir: root } });
    expect(result).toMatchObject({ passed: true, critical_failures: [], checks: { indexing: { passed: true, checks: { l1_exists: { entries: 2 }, l2_exists: { files: 1 }, stats_exists: { stats: { documents: 2 } } } } } });
  });
});
