const fs = require('node:fs/promises');
const path = require('node:path');
const ProcessStore = require('../../../packages/agent-runner-core/lib/process-store');
const logger = require('../../../packages/agent-runner-core/lib/logger');

const runtimeRoot = path.resolve(__dirname, '../../../runtime/test-results');
describe('中间过程真实文件存储', () => {
  let root;
  let store;
  beforeEach(async () => {
    await fs.mkdir(runtimeRoot, { recursive: true });
    root = await fs.mkdtemp(path.join(runtimeRoot, 'process-store-'));
    store = new ProcessStore('process-fixture');
    store.basePath = root;
    jest.spyOn(logger, 'debug').mockImplementation(() => {});
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await fs.rm(root, { recursive: true, force: true });
  });

  test('生产模式过滤普通文件，保存关键文件及显式强制文件', async () => {
    expect(await store.save('stage', 'ordinary.txt', 'discard')).toBeNull();
    expect(await store.exists('stage', 'ordinary.txt')).toBe(false);
    const saved = await store.save('stage', 'knowledge-point.json', { title: '数据库' });
    expect(saved).toBe(path.join(root, 'stage', 'knowledge-point.json'));
    expect(await store.load('stage', 'knowledge-point.json')).toEqual({ title: '数据库' });
    expect(await store.exists('stage', 'knowledge-point.json')).toBe(true);
    await store.save('stage', 'forced.txt', '强制原文', true);
    expect(await store.load('stage', 'forced.txt')).toBe('强制原文');
    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining(saved));
  });

  test('调试模式保存全部文件，列表递归返回相对路径', async () => {
    const debug = new ProcessStore('debug-fixture', 'debug');
    debug.basePath = root;
    await debug.save('', 'top.txt', 'top');
    await debug.save('nested/deep', 'data.json', { value: 1 });
    await debug.save('nested', 'plain.txt', 'not-json');
    expect((await debug.listFiles()).sort()).toEqual(['nested/deep/data.json', 'nested/plain.txt', 'top.txt']);
    expect(await debug.load('nested/deep', 'data.json')).toEqual({ value: 1 });
    expect(await debug.load('nested', 'plain.txt')).toBe('not-json');
    await expect(debug.load('', 'absent.txt')).rejects.toMatchObject({ code: 'ENOENT' });
    debug.basePath = path.join(root, 'absent-directory');
    expect(await debug.listFiles()).toEqual([]);
  });

  test('MCP、LLM 和元数据保存完整可回读信封', async () => {
    await store.saveMcpQuery(0, '崖山数据库', { content: ['结果'] });
    const query = await store.load('02-retrieval-plan/03-mcp-queries', 'query-01.json');
    expect(query).toMatchObject({ query: '崖山数据库', request: { method: 'tools/call', name: 'search_ku', arguments: { query: '崖山数据库' } }, response: { content: ['结果'] } });
    expect(Number.isNaN(Date.parse(query.timestamp))).toBe(false);
    await store.saveLlmCall('generation', [{ role: 'user', content: '生成手册' }], { model: 'fixture', content: '正文', usage: { total_tokens: 3 }, finish_reason: 'stop' });
    expect(await store.load('generation', '02-llm-response.json')).toMatchObject({ request: { model: 'fixture', messages_count: 1, messages: [{ role: 'user', content: '生成手册' }] }, response: { content: '正文', model: 'fixture', usage: { total_tokens: 3 }, finish_reason: 'stop' } });
    await store.saveMeta({ source: 'fixture' });
    expect(await store.load('', 'meta.json')).toMatchObject({ taskId: 'process-fixture', mode: 'production', source: 'fixture', createdAt: expect.any(String) });
    expect((await store.listFiles()).sort()).toEqual(['02-retrieval-plan/03-mcp-queries/query-01.json', 'generation/02-llm-response.json', 'meta.json']);
  });
});
