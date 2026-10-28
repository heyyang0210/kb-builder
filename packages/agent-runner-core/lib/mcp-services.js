const { readJson } = require('./json-config');
const { CONFIG_PATHS } = require('./config-registry');
// Service routing shared by the administration and document-reading paths.
function mcpServices(config = {}) {
  if (Array.isArray(config.services)) return config.services;
  if (!config.server_url) return [];
  const headerName = config.search_knowledge_base_header || readJson(CONFIG_PATHS.contentRules).platformMcp.multiSearchHeaderName;
  const header = String(headerName || '').toLowerCase();
  const targets = config.search_knowledge_bases || (config.headers || []).filter(h => header && h.name.toLowerCase() === header);
  return [{ ...config, search_knowledge_base_header: headerName, id: 'legacy-default', name: config.name || '现有知识库服务', enabled: config.enabled !== false,
    adapter: config.adapter || 'yashandb', knowledgeBases: config.knowledgeBases || targets.map((target, index) => {
      const locator = typeof target === 'string' ? target : target.value;
      return { id: `legacy-kb-${index}`, name: target.description || `知识库 ${locator}`, locator, enabled: true };
    }) }];
}
function resolveMcpService(config = {}, serviceId, knowledgeBaseId) {
  const services = mcpServices(config);
  const selected = serviceId || config.defaultServiceId || (!Array.isArray(config.services) ? services[0]?.id : null);
  const service = services.find(s => s.id === selected);
  if (!service || service.enabled === false) throw new Error('MCP 服务不存在或已停用，请重新选择');
  const bases = service.knowledgeBases || [];
  let targets = bases.filter(k => k.enabled !== false);
  if (knowledgeBaseId) {
    const kb = bases.find(k => k.id === knowledgeBaseId && k.enabled !== false);
    if (!kb) throw new Error('知识库不存在、已停用或不属于该服务');
    targets = [kb];
  }
  const routed = { ...service };
  delete routed.services;
  if (bases.length) {
    if (!targets.length) throw new Error('该服务没有启用的知识库');
    const header = String(service.search_knowledge_base_header || '').toLowerCase();
    routed.headers = (service.headers || []).filter(h => h.name.toLowerCase() !== header);
    routed.search_knowledge_bases = targets.map(k => k.locator);
  }
  return routed;
}
module.exports = { mcpServices, resolveMcpService };
