const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { plan, retrieve, searchResults, documentBody } = require('../../../packages/agent-runner-core/lib/production-ai-mcp-retrieval');
const policy = require('../../../config/knowledge-center/content-rules.json').productionAI.sources.mcpRetrieval;
const job = { jobId: 'isolated', requirements: '关键词：SELECT SQL', originalMarkdown: '# SELECT', outline: '', range: { start: 0, end: 8 }, sourceSnapshots: [], createdBy: { id: 'test' } };
const config = { services: [{ id: 's', name: '知识库', enabled: true, knowledgeBases: [{ id: 'official', name: '官方文档', locator: '1' }, { id: 'ops', name: '运维手册', locator: '24' }, { id: 'disabled', name: '官方旧库', enabled: false, locator: '3' }] }] };
test('默认策略确定性规划 SQL / 运维路由、关键词及上限，不回退到任意知识库', () => {
  assert.deepEqual(plan(job, policy, config), plan(job, policy, config));
  assert.equal(plan(job, policy, config).routes[0].knowledgeBaseId, 'official');
  assert.match(plan(job, policy, config).queries[0], /SELECT SQL.*语法/);
  assert.equal(plan({ ...job, requirements: '备份恢复' }, policy, config).routes[0].knowledgeBaseId, 'ops');
  assert.equal(plan(job, policy, { services: [{ ...config.services[0], knowledgeBases: [{ id: 'x', name: '不相关' }] }] }).routes.length, 0);
  assert.equal(plan(job, policy, { ...config, services: [{ ...config.services[0], enabled: false }] }).routes.length, 0);
  assert.equal(plan(job, policy, { server_url: 'http://localhost' }).routes[0].serviceId, 'legacy-default');
  assert.equal(plan(job, policy, { services: [{ id: 'generic', adapter: 'generic' }] }).routes.length, 0);
});
test('只解析明确搜索协议与原文，错误不能冒充引用', () => {
  assert.deepEqual(searchResults({ content: [{ type: 'text', text: '{"results":[]}' }] }), []);
  assert.throws(() => searchResults({ isError: true }));
  assert.throws(() => searchResults({ content: [{ type: 'text', text: 'bad' }] }));
  assert.throws(() => searchResults({ structuredContent: {} }));
  assert.throws(() => searchResults({ content: [{ type: 'text', text: '{"success":false,"results":[]}' }] }));
  assert.equal(documentBody({ isError: true }), null);
  assert.equal(documentBody({ content: [{ type: 'text', text: '{"success":false}' }] }), null);
  assert.equal(documentBody({ content: [{ type: 'text', text: '{"error":"unreadable"}' }] }), null);
  assert.equal(documentBody({ structuredContent: { content: '# 原文' } }).content, '# 原文');
});
test('MCP 真实 HTTP：路由标头、评分去重、正文快照、空结果及失败语义', async t => {
  let mode = 'normal'; const calls = [];
  const server = http.createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const message = JSON.parse(raw);
    if (message.method === 'notifications/initialized') { res.writeHead(202); res.end(); return; }
    let result = { serverInfo: { name: 'fixture', version: '1' }, capabilities: {} };
    if (message.method === 'tools/call') {
      calls.push({ ...message.params, kb: req.headers['x-kb'] });
      result = message.params.name === 'search_ku'
        ? mode === 'fail' ? { isError: true } : { structuredContent: { results: mode === 'empty' ? [] : [{ ku_name: 'a', score: .9 }, { ku_name: 'a', score: .8 }, { ku_name: 'low', score: .1 }, null, { ku_name: 'invalid', score: 'invalid' }, ...(mode === 'partial' ? [{ ku_name: 'b', score: .8 }] : [])] } }
        : mode === 'detail-fail' || (mode === 'partial' && message.params.arguments.ku_name === 'a') ? { isError: true } : { content: [{ type: 'text', text: JSON.stringify({ title: '原文', content: '# 完整正文', version: 'v1' }) }] };
    }
    res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ jsonrpc: '2.0', id: message.id, result }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const cfg = structuredClone(config); Object.assign(cfg.services[0], { server_url: `http://127.0.0.1:${server.address().port}`, search_knowledge_base_header: 'X-Kb' });
  const outcome = await retrieve(job, policy, cfg, 1000);
  assert.equal(outcome.retrieval.status, 'succeeded'); assert.equal(outcome.snapshots.length, 1);
  assert.equal(outcome.snapshots[0].content, '# 完整正文'); assert.equal(outcome.snapshots[0].mcpKnowledgeBaseId, 'official');
  assert.equal(calls.filter(c => c.name === 'get_ku_detail').length, 1); assert.ok(calls.every(c => c.kb === '1'));
  await assert.rejects(retrieve(job, policy, cfg, 1), { code: 'AI_MCP_RETRIEVAL_FAILED' });
  mode = 'partial';
  const partial = await retrieve(job, policy, cfg, 1000);
  assert.equal(partial.retrieval.status, 'partial'); assert.equal(partial.retrieval.detailFailures, 1);
  assert.equal(partial.snapshots[0].locator, 'b');
  mode = 'empty'; assert.equal((await retrieve(job, policy, cfg, 1000)).retrieval.status, 'empty');
  mode = 'fail'; await assert.rejects(retrieve(job, policy, cfg, 1000), e => e.code === 'AI_MCP_RETRIEVAL_FAILED' && e.retrieval.attempts.length > 0);
  mode = 'detail-fail'; await assert.rejects(retrieve(job, policy, cfg, 1000), { code: 'AI_MCP_RETRIEVAL_FAILED' });
  assert.equal((await retrieve(job, policy, {}, 1000)).retrieval.status, 'not_configured');
});
