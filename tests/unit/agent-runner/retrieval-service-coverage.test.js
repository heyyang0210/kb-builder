jest.mock('../../../packages/agent-runner-core/lib/retrieval/query-planner', () => ({
  generateQueries: jest.fn(() => ({ queries: ['q1', 'q2'], dimensions: ['syntax'], dimensionMap: { q1: 'syntax' } })),
  reviewQueries: jest.fn(() => ({ queries: ['q1', 'q2'], dropped: ['bad'] })),
}));
jest.mock('../../../packages/agent-runner-core/lib/retrieval/result-filter', () => ({
  processMcpResult: jest.fn((query, dimension, rawResult) => ({ query, dimension, results: rawResult.success ? rawResult.results : [] })),
  deduplicate: jest.fn(results => results),
  groupByDimension: jest.fn(results => ({ syntax: results })),
}));
jest.mock('../../../packages/agent-runner-core/lib/retrieval/context-assembler', () => ({
  assemble: jest.fn(() => 'assembled context'),
}));
jest.mock('../../../packages/agent-runner-core/lib/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const RetrievalService = require('../../../packages/agent-runner-core/lib/retrieval/retrieval-service');

test('检索计划依次经过 MCP、结果整理、本地检索和上下文组装', async () => {
  const mcpClient = { query: jest.fn().mockResolvedValueOnce({ success: true, results: [{ id: 1 }] }).mockRejectedValueOnce(new Error('offline')) };
  const fileReader = {};
  const service = new RetrievalService({ mcpClient, fileReader });
  const localSearch = jest.spyOn(service, '_searchLocalFiles').mockResolvedValue([{ path: 'local.md' }]);
  const output = await service.retrieve({ knowledgePoint: { title: 'NUMBER' }, prompt: 'unused', options: { maxQueries: 2 } });
  expect(mcpClient.query).toHaveBeenCalledTimes(2);
  expect(localSearch).toHaveBeenCalledWith({ title: 'NUMBER' });
  expect(output).toEqual({
    context: 'assembled context',
    plan: { queries: ['q1', 'q2'], dropped: ['bad'], dimensions: ['syntax'] },
    stats: { queries_sent: 2, results_before_filter: 1, results_after_filter: 2, local_files_found: 1, dimensions_covered: ['syntax'] },
  });
});

test('缺少 MCP、本地检索禁用时仍返回有效空上下文计划', async () => {
  const service = new RetrievalService({ mcpClient: null, fileReader: null });
  const result = await service.retrieve({ knowledgePoint: 'x', prompt: 'unused', options: { enableLocalSearch: false } });
  expect(result.stats).toMatchObject({ queries_sent: 2, local_files_found: 0 });
});

test('默认本地检索目前返回空列表', async () => {
  const service = new RetrievalService({ mcpClient: null, fileReader: {} });
  expect(await service._searchLocalFiles('NUMBER')).toEqual([]);
  expect((await service.retrieve({ knowledgePoint: 'NUMBER', prompt: 'unused' })).stats.local_files_found).toBe(0);
});
