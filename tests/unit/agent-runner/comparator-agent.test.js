const ComparatorAgent = require('../../../packages/agent-runner-core/lib/agents/comparator-agent');

describe('ComparatorAgent', () => {
  test('固定兼容性分析温度并输出 Markdown', () => {
    const agent = new ComparatorAgent({ temperature: 0.9, model: 'test-model' });

    expect(agent.name).toBe('comparator');
    expect(agent.config.temperature).toBe(0.4);
    expect(agent.getOutputFormat()).toBe('markdown');
  });

  test('要求执行计划', () => {
    const agent = new ComparatorAgent();
    expect(() => agent.validateInput({})).toThrow('executionPlan is required');
    expect(agent.validateInput({ executionPlan: {} })).toBe(true);
  });

  test('将完整执行计划和参考资料写入提示词', () => {
    const agent = new ComparatorAgent();
    const messages = agent.buildPrompt({
      executionPlan: {
        knowledge_point: {
          name: '事务隔离',
          type: '兼容性差异',
          description: '比较隔离级别',
          target_db: 'Oracle 19c',
        },
        document_structure: {
          sections: [
            { name: '语法', description: '语句差异' },
            { name: '行为' },
          ],
        },
      },
      references: '本地参考资料',
    });

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toContain(agent.getEnterpriseName());
    expect(messages[1].role).toBe('user');
    expect(messages[1].content).toContain('事务隔离');
    expect(messages[1].content).toContain('比较隔离级别');
    expect(messages[1].content).toContain('Oracle 19c');
    expect(messages[1].content).toContain('1. 语法 - 语句差异');
    expect(messages[1].content).toContain('2. 行为 - ');
    expect(messages[1].content).not.toContain('本地参考资料');
  });

  test.each([
    ['missing knowledge point', { executionPlan: {} }],
    ['missing sections', { executionPlan: { knowledge_point: {} } }],
    ['null document structure', { executionPlan: { knowledge_point: {}, document_structure: null } }],
    ['empty knowledge point values', {
      executionPlan: {
        knowledge_point: { name: '', type: '', description: '', target_db: '' },
        document_structure: { sections: [] },
      },
    }],
  ])('uses prompt defaults for %s', (_label, input) => {
    const messages = new ComparatorAgent().buildPrompt(input);
    expect(messages[1].content).toContain('- 名称: N/A');
    expect(messages[1].content).toContain('- 类型: 兼容性差异');
    expect(messages[1].content).toContain('- 描述: N/A');
    expect(messages[1].content).toContain('- 目标数据库: Oracle');
  });

  test('解析比较结果及 token 用量', () => {
    const response = { content: '| Oracle | YashanDB |', usage: { total_tokens: 12 } };
    expect(new ComparatorAgent().parseResponse(response)).toEqual({
      comparison: response.content,
      usage: response.usage,
    });
  });
});
