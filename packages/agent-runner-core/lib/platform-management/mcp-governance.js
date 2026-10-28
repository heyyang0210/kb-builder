const crypto = require('crypto');
const ConfigValidator = require('../config-validator');
const { mcpServices, resolveMcpService } = require('../mcp-services');
const { MCPClient } = require('../tools/mcp-client');
const { readJson } = require('../json-config');
const { CONFIG_PATHS } = require('../config-registry');

const error = (code, message, status = 422) => Object.assign(new Error(message), { code, status });
const version = config => crypto.createHash('sha256').update(JSON.stringify(config)).digest('hex');
// Shared by handler instances in this process; cross-process writes remain a deployment limitation.
let commitTail = Promise.resolve();

function createMcpGovernance(options = {}) {
  const manager = options.configManager || require('../config-manager');
  const Client = options.MCPClient || MCPClient;
  const rules = () => (options.rules || readJson(CONFIG_PATHS.contentRules).platformMcp);
  async function current() {
    manager.clearCache('mcp-config');
    return await manager.getMCPConfig() || {};
  }
  function collection(config) {
    // Legacy headers do not always carry the policy header name.
    return mcpServices({ search_knowledge_base_header: rules().multiSearchHeaderName, ...config });
  }
  const serviceVersion = (service, config) => {
    // Encryption uses a fresh IV on every file write; it must not invalidate other services.
    const stable = { ...service, headers: (service.headers || []).map(header => {
      const next = { ...header }; if (next.value !== undefined) delete next.value_encrypted; return next;
    }) };
    if (stable.api_key !== undefined) delete stable.api_key_encrypted;
    return version({ service: stable, isDefault: (config.defaultServiceId || (!Array.isArray(config.services) ? 'legacy-default' : null)) === service.id });
  };
  function serviceProjection(service, config) {
    const safe = projection(service, false);
    return { ...safe, id: service.id, name: service.name, enabled: service.enabled !== false, adapter: service.adapter || 'yashandb',
      knowledgeBases: service.knowledgeBases || [], isDefault: (config.defaultServiceId || (!Array.isArray(config.services) ? 'legacy-default' : null)) === service.id,
      rowVersion: serviceVersion(service, config) };
  }
  function projection(config, includeServices = true) {
    const policy = rules();
    const headerCounts = new Map();
    for (const header of config.headers || []) {
      const name = String(header.name || '').toLowerCase();
      headerCounts.set(name, (headerCounts.get(name) || 0) + 1);
    }
    const searchHeader = String(policy.multiSearchHeaderName || '').toLowerCase();
    const headers = (config.headers || []).filter(header => String(header.name || '').toLowerCase() !== searchHeader).map(header => ({ name: header.name, value: '', valueConfigured: Boolean(header.value || header.value_encrypted), legacyDuplicate: headerCounts.get(String(header.name || '').toLowerCase()) > 1, description: header.description || '' }));
    const storedSearchTargets = Array.isArray(config.search_knowledge_bases) ? config.search_knowledge_bases : (config.headers || []).filter(header => String(header.name || '').toLowerCase() === searchHeader);
    storedSearchTargets.forEach((target, searchTargetIndex) => {
      const value = typeof target === 'string' ? target : target.value;
      if (value) headers.push({ name: policy.multiSearchHeaderName, value, valueConfigured: true, legacyDuplicate: false, searchTargetIndex, description: '搜索知识库目标' });
    });
    return {
      configured: Boolean(config.server_url), rowVersion: version(config),
      server_url: config.server_url || '', timeout: config.timeout ?? policy.defaultTimeoutMs,
      api_key_configured: Boolean(config.api_key || config.api_key_encrypted),
      cache: { enabled: config.cache?.enabled !== false, ttl: config.cache?.ttl ?? policy.defaultCacheTtlSeconds, max_size: config.cache?.max_size ?? policy.defaultCacheEntries },
      headers,
      updatedAt: config.governance?.updatedAt || null, updatedBy: config.governance?.updatedBy || null,
      limits: policy,
      ...(includeServices ? { services: collection(config).map(service => serviceProjection(service, config)), defaultServiceId: config.defaultServiceId || (!Array.isArray(config.services) && config.server_url ? 'legacy-default' : null) } : {}),
    };
  }
  function checkVersion(config, expected) {
    if (String(expected || '').replace(/^"|"$/g, '') !== version(config)) {
      throw error('MCP_CONFIG_CONFLICT', 'MCP 配置已变化，请重新加载后再操作', 409);
    }
  }
  function normalize(input, existing) {
    const invalid = message => { throw error('MCP_CONFIG_INVALID', message); };
    const policy = rules();
    if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('请输入完整的 MCP 配置');
    let url;
    try { url = new URL(input.server_url); } catch (_) { invalid('请填写有效的 MCP 服务网址'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) invalid('服务地址只支持 HTTP(S)，不能包含账号、密码、查询参数或片段');
    const integer = (value, min, max, label) => {
      if (!Number.isSafeInteger(value) || value < min || value > max) invalid(`${label}必须为 ${min}～${max} 之间的整数`);
      return value;
    };
    const secret = (value, label) => {
      if (value != null && typeof value !== 'string') invalid(`${label}格式无效`);
      if ((value || '').length > policy.maxHeaderValueChars || /[\r\n\x00]/.test(value || '')) invalid(`${label}包含非法字符或长度超限`);
      return value || '';
    };
    if (typeof input.cache?.enabled !== 'boolean') invalid('请选择是否启用缓存');
    if (input.clearApiKey != null && typeof input.clearApiKey !== 'boolean') invalid('清除凭据选项无效');
    const config = {
      server_url: url.href, timeout: integer(input.timeout, policy.minTimeoutMs, policy.maxTimeoutMs, '超时毫秒数'),
      cache: { enabled: input.cache.enabled, ttl: integer(input.cache.ttl, 0, policy.maxCacheTtlSeconds, '缓存有效秒数'), max_size: integer(input.cache.max_size, 1, policy.maxCacheEntries, '缓存条数') },
      headers: [],
    };
    config.search_knowledge_base_header = policy.multiSearchHeaderName;
    const changedURL = Boolean(existing.server_url && new URL(existing.server_url).href !== url.href);
    const suppliedKey = secret(input.api_key, 'API Key');
    if (input.clearApiKey && suppliedKey) invalid('清除 API Key 时不能同时填写新值');
    if (!input.clearApiKey) {
      if (suppliedKey) config.api_key = suppliedKey;
      else if (existing.api_key || existing.api_key_encrypted) {
        if (changedURL) invalid('服务地址已改变，请重新填写或显式清除 API Key');
        if (!existing.api_key) throw error('MCP_SECRET_UNAVAILABLE', '已保存凭据无法解密，请重新填写或清除', 503);
        config.api_key = existing.api_key;
      }
    }
    if (!Array.isArray(input.headers) || input.headers.length > policy.maxHeaders) invalid(`请求头必须为列表且不超过 ${policy.maxHeaders} 条`);
    const names = new Set();
    const searchTargets = [];
    for (const header of input.headers) {
      if (!header || typeof header.name !== 'string' || !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(header.name)) invalid('请求头名称无效');
      const name = header.name.toLowerCase();
      const isSearchTarget = name === String(policy.multiSearchHeaderName || '').toLowerCase();
      if (names.has(name) && !isSearchTarget) invalid('请求头名称不能重复（不区分大小写）');
      if (['host', 'content-length', 'content-type', 'accept', 'connection', 'transfer-encoding', 'mcp-session-id', 'mcp-protocol-version'].includes(name)) invalid('该请求头由协议客户端管理，请使用其他名称');
      names.add(name);
      const previousMatches = (existing.headers || []).filter(item => item.name.toLowerCase() === name);
      const previous = previousMatches[0];
      let value = secret(header.value, '请求头值');
      if (isSearchTarget) {
        const existingTargets = Array.isArray(existing.search_knowledge_bases) ? existing.search_knowledge_bases : previousMatches;
        const index = Number.isInteger(header.searchTargetIndex) ? header.searchTargetIndex : -1;
        const existingTarget = index >= 0 ? existingTargets[index] : null;
        if (!value && existingTarget) value = typeof existingTarget === 'string' ? existingTarget : (existingTarget.value || '');
      }
      if (!value && previousMatches.length > 1) invalid('历史配置存在同名请求头，请移除重复项并重新填写保留项的值');
      if (!value && (previous?.value || previous?.value_encrypted)) {
        if (changedURL) invalid('服务地址已改变，请重新填写或移除旧请求头');
        if (!previous.value) throw error('MCP_SECRET_UNAVAILABLE', '请求头无法解密，请重新填写或移除', 503);
        value = previous.value;
      }
      if (!value) invalid('新增请求头的值不能为空；如需删除请移除该行');
      if (typeof header.description !== 'string' || header.description.length > 512) invalid('请求头说明不能超过 512 个字符');
      if (isSearchTarget) searchTargets.push(value);
      else config.headers.push({ name: header.name, value, encrypted: true, description: header.description });
    }
    if (searchTargets.length) config.search_knowledge_bases = [...new Set(searchTargets)];
    if (!ConfigValidator.validateMCPConfig(config).valid) invalid('MCP 配置未通过原生成器配置校验');
    return config;
  }
  async function get() { return projection(await current()); }
  function save(input, expected, actorId) {
    const task = commitTail.then(async () => {
      const existing = await current(); checkVersion(existing, expected);
      const config = normalize(input, existing);
      config.governance = { updatedAt: new Date().toISOString(), updatedBy: actorId };
      if (Array.isArray(existing.services)) {
        const services = existing.services.map(service => service.id === existing.defaultServiceId ? { ...service, ...config,
          knowledgeBases: (config.search_knowledge_bases || []).map((locator, index) => service.knowledgeBases?.find(k => k.locator === locator) || { id: crypto.randomUUID(), name: `知识库 ${locator}`, locator, enabled: true }) } : service);
        if (!services.some(service => service.id === existing.defaultServiceId)) throw error('MCP_CONFIG_INVALID', '请在新管理页面指定兼容默认服务');
        await persist(services, existing.defaultServiceId);
      } else await manager.save('mcp-config', config);
      return get();
    });
    commitTail = task.catch(() => {});
    return task;
  }
  async function test(input, expected) {
    const existing = await current(); checkVersion(existing, expected);
    const config = normalize(input, existing);
    return runTest(config);
  }
  async function runTest(config) {
    const started = Date.now();
    try {
      const client = new Client(config);
      const initialized = await client.initialize();
      if (!initialized.serverInfo?.name) throw new Error('invalid initialize');
      const tools = await client.listTools();
      return { status: 'verified', message: 'MCP 握手与工具发现成功；尚未执行业务工具', testedAt: new Date().toISOString(), latencyMs: Date.now() - started,
        serverInfo: { name: String(initialized.serverInfo.name), version: String(initialized.serverInfo.version || '') },
        tools: tools.map(tool => ({ name: String(tool.name), description: String(tool.description || '') })) };
    } catch (_) {
      // Upstream errors can contain credentials or private response bodies. Do not forward them.
      throw error('MCP_CONNECTION_FAILED', 'MCP 连接或工具发现失败，请检查地址、凭据、协议和超时配置', 502);
    }
  }
  async function persist(services, defaultServiceId) {
    const selected = services.find(s => s.id === defaultServiceId);
    // Keep a compatibility projection, without silently choosing another server.
    let mirror = {};
    if (selected) {
      mirror = { ...selected };
      const enabled = (selected.knowledgeBases || []).filter(k => k.enabled);
      mirror.search_knowledge_bases = enabled.map(k => k.locator);
      mirror.headers = (selected.headers || []).filter(h => h.name.toLowerCase() !== String(selected.search_knowledge_base_header || '').toLowerCase());
    }
    await manager.save('mcp-config', { ...mirror, services, defaultServiceId: defaultServiceId || null });
  }
  function mutate(action) {
    const task = commitTail.then(action); commitTail = task.catch(() => {}); return task;
  }
  function findService(config, id, expected) {
    const service = collection(config).find(s => s.id === id);
    if (!service) throw error('MCP_SERVICE_NOT_FOUND', '该 MCP 服务已移除，请重新加载', 404);
    if (String(expected || '').replace(/^"|"$/g, '') !== serviceVersion(service, config)) throw error('MCP_CONFIG_CONFLICT', '该服务配置已变化，请重新加载后再操作', 409);
    return service;
  }
  function normalizeService(input, existing = {}) {
    const policy = rules();
    const invalid = message => { throw error('MCP_CONFIG_INVALID', message); };
    if (!input || typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > policy.maxNameChars) invalid('请填写有效的服务名称');
    if (typeof input.enabled !== 'boolean' || !policy.adapters.some(a => a.value === input.adapter)) invalid('请选择启用状态与支持的服务类型');
    if (!Array.isArray(input.knowledgeBases) || input.knowledgeBases.length > policy.maxKnowledgeBases) invalid('知识库条目数量无效');
    if (input.adapter === 'generic' && input.knowledgeBases.length) invalid('通用 MCP 尚无知识库适配，请清空知识库或选择 YashanDB 类型');
    const seen = new Set(); const ids = new Set();
    const knowledgeBases = input.knowledgeBases.map(k => {
      if (!k || typeof k.name !== 'string' || !k.name.trim() || k.name.length > policy.maxNameChars || typeof k.locator !== 'string' || !k.locator.trim() || k.locator.length > policy.maxHeaderValueChars || /[\r\n\x00]/.test(k.locator) || typeof k.enabled !== 'boolean') invalid('知识库名称、ID或启用状态无效');
      const locator = k.locator.trim(); if (seen.has(locator)) invalid('同一服务下知识库 ID 不能重复'); seen.add(locator);
      const old = existing.knowledgeBases?.find(v => v.id === k.id);
      if (k.id && !old) invalid('知识库记录已变化，请重新加载');
      const id = old?.id || crypto.randomUUID(); if (ids.has(id)) invalid('知识库记录不能重复'); ids.add(id);
      return { id, name: k.name.trim(), locator, enabled: k.enabled };
    });
    if ((input.headers || []).some(h => String(h.name).toLowerCase() === String(policy.multiSearchHeaderName).toLowerCase())) invalid('请在知识库列表维护知识库 ID，不要重复填写路由请求头');
    const config = normalize(input, existing);
    return { ...config, id: existing.id || crypto.randomUUID(), name: input.name.trim(), enabled: input.enabled, adapter: input.adapter, knowledgeBases };
  }
  function saveService(input, expected, actorId) {
    return mutate(async () => {
      const config = await current(); const services = collection(config);
      const old = input.service?.id ? findService(config, input.service.id, expected) : {};
      if (!old.id) { checkVersion(config, expected); if (services.length >= rules().maxServices) throw error('MCP_CONFIG_INVALID', '服务数量已达上限'); }
      const service = normalizeService(input.service, old);
      service.governance = { updatedAt: new Date().toISOString(), updatedBy: actorId };
      const next = services.filter(s => s.id !== service.id); if (old.id) next.splice(services.findIndex(s => s.id === old.id), 0, service); else next.push(service);
      const defaultId = input.makeDefault === true || !services.length ? service.id : (config.defaultServiceId || (!Array.isArray(config.services) ? services[0]?.id : null));
      await persist(next, defaultId); return get();
    });
  }
  function deleteService(input, expected) {
    return mutate(async () => {
      const config = await current(); const service = findService(config, input.serviceId, expected);
      const defaultId = config.defaultServiceId || (!Array.isArray(config.services) ? 'legacy-default' : null);
      await persist(collection(config).filter(s => s.id !== service.id), defaultId === service.id ? null : defaultId); return get();
    });
  }
  async function testService(input, expected) {
    const config = await current();
    const old = input.service?.id || input.serviceId ? findService(config, input.service?.id || input.serviceId, expected) : {};
    if (!old.id) checkVersion(config, expected);
    const service = input.service ? normalizeService(input.service, old) : old;
    return runTest({ ...service, enabled: true });
  }
  async function verifyKnowledgeBase(input, expected) {
    const config = await current(); const service = findService(config, input.serviceId, expected);
    if (service.adapter !== 'yashandb') throw error('MCP_CONFIG_INVALID', '当前服务没有知识库读取适配');
    if (input.document !== undefined && (typeof input.document !== 'string' || !input.document.trim() || input.document.length > rules().maxHeaderValueChars)) throw error('MCP_CONFIG_INVALID', '文档名称无效');
    const started = Date.now();
    try {
      const selected = resolveMcpService({ services: [{ ...service, enabled: true }] }, service.id, input.knowledgeBaseId);
      const client = new Client({ ...selected, cache: { enabled: false } });
      if (input.document === undefined) {
        const kb = service.knowledgeBases.find(k => k.id === input.knowledgeBaseId);
        if (!kb) throw new Error('missing knowledge base');
        const response = await client.query(kb.name);
        if (!response || response.isError || response.error) throw new Error('tool failed');
        const payloads = (response.content || []).filter(c => c.type === 'text' && c.text?.trim());
        if (!response.structuredContent && !payloads.length) throw new Error('empty response');
        let searchResult = response.structuredContent;
        for (const block of payloads) {
          let parsed; try { parsed = JSON.parse(block.text); } catch (_) { continue; }
          if (parsed?.error || parsed?.isError || parsed?.success === false) throw new Error('tool failed');
          if (!searchResult && Array.isArray(parsed?.results)) searchResult = parsed;
        }
        if (response.structuredContent?.error || response.structuredContent?.isError || response.structuredContent?.success === false) throw new Error('tool failed');
        return { status: 'verified', testedAt: new Date().toISOString(), latencyMs: Date.now() - started, message: '测试成功',
          knowledgeBase: { name: kb.name, locator: kb.locator }, tool: 'search_ku',
          ...(Array.isArray(searchResult?.results) ? { matchedCount: searchResult.results.length } : {}) };
      }
      const result = await client.getDocument(input.document.trim());
      const text = (result?.content || []).filter(c => c.type === 'text').map(c => c.text || '').join('\n').trim();
      if (result?.isError || !text) throw new Error('empty');
      try {
        const document = JSON.parse(text);
        const content = typeof document.content === 'string' ? document.content.trim() : '';
        if (content && document.isError !== true && !document.error) return { status: 'verified', testedAt: new Date().toISOString(), latencyMs: Date.now() - started, message: '知识库读取成功' };
        if (!content || document.isError || document.error) throw new Error('empty');
      } catch (parseError) {
        if (parseError.message === 'empty') throw parseError;
        // Non-JSON text is valid document content.
      }
      return { status: 'verified', testedAt: new Date().toISOString(), latencyMs: Date.now() - started, message: '知识库读取成功' };
    } catch (_) { throw error('MCP_READ_FAILED', '测试失败，请检查知识库 ID、凭据、工具权限及网络连接', 502); }
  }
  return { get, save, test, saveService, deleteService, testService, verifyKnowledgeBase, currentForSources: current };
}
module.exports = { createMcpGovernance };
