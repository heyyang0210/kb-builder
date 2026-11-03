const http = require('http');
const crypto = require('crypto');
const { MCPClient } = require('../tools/mcp-client');
const { mcpServices, resolveMcpService } = require('../mcp-services');

async function createMcpBridge(config = {}) {
  const clients = new Map();
  for (const service of mcpServices(config).filter(s => s.enabled !== false && s.adapter !== 'generic')) {
    for (const kb of (service.knowledgeBases?.length ? service.knowledgeBases : !Array.isArray(config.services) ? [{ id: '', name: '默认知识库' }] : []).filter(k => k.enabled !== false)) {
      clients.set(`${service.id}/${kb.id}`, { name: `${service.name} / ${kb.name}`, client: new MCPClient(resolveMcpService(config, service.id, kb.id)) });
    }
  }
  if (!clients.size) return null;
  const token = crypto.randomBytes(32).toString('hex');
  const server = http.createServer(async (req, res) => {
    const send = value => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); };
    if (req.headers.authorization !== `Bearer ${token}`) { res.writeHead(403); res.end(); return; }
    if (req.method !== 'POST') { res.writeHead(405); res.end(); return; }
    let message;
    try {
      let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 65536) throw new Error('请求过大'); }
      message = JSON.parse(raw);
      if (message.id == null) { res.writeHead(202); res.end(); return; }
      if (message.method === 'initialize') { send({ jsonrpc: '2.0', id: message.id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'knowledge_center', version: '1.0.0' } } }); return; }
      if (message.method === 'tools/list') {
        send({ jsonrpc: '2.0', id: message.id, result: { tools: [
          { name: 'knowledge_search', description: '在当前 Agent 配置的知识库检索资料', annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true }, inputSchema: { type: 'object', properties: { knowledgeBase: { type: 'string', enum: [...clients.keys()] }, query: { type: 'string' } }, required: ['knowledgeBase', 'query'], additionalProperties: false } },
          { name: 'knowledge_read', description: '读取当前 Agent 知识库的文档', annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true }, inputSchema: { type: 'object', properties: { knowledgeBase: { type: 'string', enum: [...clients.keys()] }, documentId: { type: 'string' } }, required: ['knowledgeBase', 'documentId'], additionalProperties: false } },
        ] } }); return;
      }
      if (message.method !== 'tools/call') throw new Error('不支持的工具方法');
      const args = message.params?.arguments || {};
      const target = clients.get(args.knowledgeBase);
      if (!target) throw new Error('知识库不在当前 Agent 授权范围');
      const name = message.params.name;
      if (!['knowledge_search', 'knowledge_read'].includes(name)) throw new Error('工具不可用');
      const value = name === 'knowledge_search' ? await target.client.query(String(args.query || '')) : await target.client.getDocument(String(args.documentId || ''));
      send({ jsonrpc: '2.0', id: message.id, result: { content: [{ type: 'text', text: JSON.stringify(value) }] } });
    } catch (_) { send({ jsonrpc: '2.0', id: message?.id ?? null, error: { code: -32602, message: '知识库调用失败，请检查服务配置和授权范围' } }); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}/mcp`, token, close: () => server.close() };
}
module.exports = { createMcpBridge };
