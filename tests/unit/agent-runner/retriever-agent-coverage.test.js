const BaseAgent = require('../../../packages/agent-runner-core/lib/agents/base-agent');
const RetrieverAgent = require('../../../packages/agent-runner-core/lib/agents/retriever-agent');

const plan = (mcp_queries = [], reference_files = []) => ({
  knowledge_point: { name: '索引', type: 'SQL' },
  retrieval_plan: { mcp_queries, reference_files },
});

describe('检索代理工具协调', () => {
  let agent;
  let details;

  beforeEach(() => {
    agent = new RetrieverAgent({ provider: 'openai', api_key: 'test' });
    details = [];
    agent.setOnDetail(detail => details.push(detail));
  });

  test('构造默认配置、输入校验和模型响应投影', () => {
    const defaultAgent = new RetrieverAgent();
    expect(defaultAgent.config).toEqual({});
    expect(() => agent.validateInput({})).toThrow('executionPlan is required');
    expect(agent.validateInput({ executionPlan: {} })).toBe(true);
    expect(agent.parseResponse({ content: '整理后的参考', usage: { total_tokens: 7 } }))
      .toEqual({ references: '整理后的参考', usage: { total_tokens: 7 } });
  });

  test('MCP 混合结果与文件逐项结果保留来源和详情', async () => {
    const batchQuery = jest.fn().mockResolvedValue([
      { success: true, data: '第一条内容' },
      { success: true, data: { title: '第二条' } },
      { success: false, error: '权限不足' },
      { success: false },
    ]);
    const read = jest.fn()
      .mockResolvedValueOnce({ content: '本地参考' })
      .mockRejectedValueOnce(new Error('文件不存在'));
    agent.setToolManager({ getTool: name => name === 'mcp' ? { batchQuery } : { read } });

    const content = await agent._retrieveContent(plan(['一', '二', '三', '四'], ['a.md', 'missing.md']));
    expect(batchQuery).toHaveBeenCalledWith(['一', '二', '三', '四']);
    expect(read.mock.calls).toEqual([['a.md'], ['missing.md']]);
    expect(content).toContain('### MCP 查询: 一\n\n第一条内容');
    expect(content).toContain('"title": "第二条"');
    expect(content).toContain('### MCP 查询: 三\n\n查询失败: 权限不足');
    expect(content).toContain('### MCP 查询: 四\n\n查询失败: 未知错误');
    expect(content).toContain('### 文件: a.md\n\n本地参考');
    expect(content).toContain('### 文件: missing.md\n\n读取失败: 文件不存在');
    expect(details.filter(item => item.status === 'running')).toHaveLength(3);
    expect(details.filter(item => item.status === 'success')).toHaveLength(3);
    expect(details.filter(item => item.status === 'failed')).toHaveLength(3);
    expect(details.find(item => item.name === 'MCP 查询: 一')).toMatchObject({
      output_summary: { content_length: 5 }, tokens: 1,
    });
  });

  test('整体工具故障与未注入工具时仍返回可解释的检索结果', async () => {
    expect(await agent._retrieveContent(plan(['一'], ['a.md']))).toBe('');
    expect(details).toHaveLength(0);
    agent.setToolManager({ getTool: name => {
      if (name === 'mcp') return { batchQuery: async () => { throw new Error('MCP 离线'); } };
      throw new Error('文件工具未安装');
    } });
    const content = await agent._retrieveContent(plan(['一'], ['a.md']));
    expect(content).toContain('MCP 服务不可用: MCP 离线');
    expect(content).not.toContain('### 文件: a.md');
    expect(details).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'MCP 批量查询', status: 'failed', error: 'MCP 离线' }),
    ]));
  });

  test('空计划与提示词的完整/缺省字段投影', async () => {
    agent.setToolManager({ getTool: jest.fn() });
    expect(await agent._retrieveContent({})).toBe('');
    expect(agent.toolManager.getTool).not.toHaveBeenCalled();
    const complete = agent.buildPrompt({ executionPlan: plan(['索引语法'], ['a.md']), retrieved_content: '已找到' });
    expect(complete[1].content).toContain('索引语法');
    expect(complete[1].content).toContain('a.md');
    expect(complete[1].content).toContain('已找到');
    const fallback = agent.buildPrompt({ executionPlan: {} });
    expect(fallback[1].content).toContain('名称: N/A');
    expect(fallback[1].content).toContain('MCP 查询: 无');
    expect(fallback[1].content).toContain('参考文件: 无');
    expect(fallback[1].content).toContain('MCP 和文件检索结果将在工具调用后提供');
  });

  test('公开执行入口先完成工具检索再调用模型整理', async () => {
    const batchQuery = jest.fn().mockResolvedValue([{ success: true, data: '来源内容' }]);
    agent.setToolManager({ getTool: () => ({ batchQuery }) });
    const baseExecute = jest.spyOn(BaseAgent.prototype, 'execute').mockImplementation(async input => ({
      retrievedAtModelCall: input.retrieved_content,
    }));
    try {
      const input = { executionPlan: plan(['来源']) };
      const result = await agent.execute(input);
      expect(batchQuery).toHaveBeenCalledWith(['来源']);
      expect(result.retrievedAtModelCall).toContain('来源内容');
      expect(input.retrieved_content).toBe(result.retrievedAtModelCall);
      expect(baseExecute).toHaveBeenCalledTimes(1);
    } finally {
      baseExecute.mockRestore();
    }
  });
});
