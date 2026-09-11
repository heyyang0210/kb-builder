const { QualityFilter } = require('../../../../packages/agent-runner-core/lib/preprocessing/filters/quality-filter');

describe('QualityFilter', () => {
  test('应过滤空文档和纯标题文档', async () => {
    const filter = new QualityFilter();
    await expect(filter.evaluate({ title: '空文档', content: '' })).resolves.toMatchObject({
      passed: false,
      status: 'discard'
    });
    await expect(filter.evaluate({ title: '纯标题', content: '# 标题\n## 子标题' })).resolves.toMatchObject({
      passed: false,
      reasons: expect.arrayContaining(['title_only'])
    });
  });

  test('应过滤正文过短的文档', async () => {
    const filter = new QualityFilter({ minContentChars: 10 });
    const result = await filter.evaluate({ title: '短文档', content: '# 标题\n太短' });
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('too_short');
  });

  test('正常技术文档应保留并输出指标', async () => {
    const filter = new QualityFilter();
    const result = await filter.evaluate({
      title: '事务设计',
      content: '# 事务设计\n\n事务提交需要经过日志刷盘和状态确认，失败时执行回滚操作。系统还会记录事务状态并支持异常恢复，同时保留诊断信息供后续分析。'
    });
    expect(result).toMatchObject({ passed: true, status: 'keep', source: 'rule' });
    expect(result.metrics.contentChars).toBeGreaterThan(50);
  });

  test('边界文档应支持 LLM 评估回调', async () => {
    const filter = new QualityFilter({
      minContentChars: 5,
      borderlineMaxChars: 300,
      useLlmForBorderline: true,
      llmEvaluator: async () => ({ score: 2, recommendation: 'discard', reason: '缺少技术细节' })
    });
    const result = await filter.evaluate({ title: '边界文档', content: '# 标题\n这是一段较短但可评估的内容。' });
    expect(result).toMatchObject({ passed: false, source: 'llm' });
    expect(result.reasons).toContain('缺少技术细节');
  });

  test('禁用时不应过滤内容', async () => {
    const filter = new QualityFilter({ enabled: false });
    const result = await filter.evaluate({ content: '' });
    expect(result).toMatchObject({ passed: true, status: 'disabled' });
  });
});
