const fs = require('fs').promises;
const path = require('path');
const { FeatureClassifier } = require('../../lib/preprocessing/classifiers/feature-classifier');

const TEST_DIR = path.join(__dirname, '..', '..', 'tmp', `test-feature-classifier-${Date.now()}`);

describe('FeatureClassifier', () => {
  beforeAll(async () => fs.mkdir(TEST_DIR, { recursive: true }));
  afterAll(async () => fs.rm(TEST_DIR, { recursive: true, force: true }));

  test('应从特性设计路径分类', async () => {
    const classifier = new FeatureClassifier({ features: [] });
    const result = await classifier.classify({
      metadata: { sourcePath: '/docs/特性设计/事务管理/提交.md' }
    });
    expect(result).toMatchObject({ feature: '事务管理', subFeature: '提交', source: 'path' });
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  test('应从关键词分类', async () => {
    const classifier = new FeatureClassifier({
      features: [{ name: 'SQL引擎', keywords: ['查询优化', '执行计划'] }]
    });
    const result = await classifier.classify({
      title: '查询优化设计',
      content: '本文介绍执行计划生成和查询优化。',
      metadata: { sourcePath: '/docs/其他/文档.md', keywords: ['查询优化'] }
    });
    expect(result).toMatchObject({ feature: 'SQL引擎', source: 'keyword' });
  });

  test('规则无法分类时应支持 LLM 兜底', async () => {
    const classifier = new FeatureClassifier({
      useLlmFallback: true,
      llmClassifier: async () => ({ feature: '高可用', confidence: 0.86, reason: '主备切换相关' })
    });
    const result = await classifier.classify({ title: '未知文档', content: '主备切换机制' });
    expect(result).toMatchObject({ feature: '高可用', source: 'llm', confidence: 0.86 });
  });

  test('应从 JSON 文件加载特性列表', async () => {
    const featurePath = path.join(TEST_DIR, 'features.json');
    await fs.writeFile(featurePath, JSON.stringify({ features: [{ name: '备份恢复', keywords: ['备份'] }] }));
    const classifier = new FeatureClassifier({ featureListPath: featurePath });
    const result = await classifier.classify({ title: '备份策略', content: '备份任务配置', metadata: {} });
    expect(result.feature).toBe('备份恢复');
  });
});
