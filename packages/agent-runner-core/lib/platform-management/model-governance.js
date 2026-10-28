const crypto = require('crypto');
const { readJson } = require('../json-config');
const { CONFIG_PATHS } = require('../config-registry');
const LLMClient = require('../llm-client');

const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const failure = (code, message, status = 422) => Object.assign(new Error(message), { code, status });
let commitTail = Promise.resolve();

function createModelGovernance(options = {}) {
  const manager = options.configManager || require('../config-manager');
  const Client = options.LLMClient || LLMClient;
  const rules = () => options.rules || readJson(CONFIG_PATHS.contentRules).platformModels;
  const current = () => manager.getModelConfigSync() || {};
  function catalog(config) {
    if (Array.isArray(config.services)) return { services: config.services, defaultSelection: config.defaultSelection || null };
    if (!config.model) return { services: [], defaultSelection: null };
    const p = rules();
    return { services: [{ id: 'legacy-default', name: '现有默认模型', provider: config.provider || 'custom', protocol: config.protocol || 'chat_completions', base_url: config.base_url || '',
      api_key: config.api_key, api_key_encrypted: config.api_key_encrypted, models: [config.model], enabled: true,
      timeout: config.timeout || p.defaultTimeoutMs, temperature: config.temperature ?? p.defaultTemperature, max_tokens: config.max_tokens || p.defaultMaxTokens }],
    defaultSelection: { serviceId: 'legacy-default', model: config.model } };
  }
  function safeService(service) {
    return { id: service.id, name: service.name, provider: service.provider, protocol: service.protocol, base_url: service.base_url,
      models: service.models, enabled: service.enabled, timeout: service.timeout, temperature: service.temperature, max_tokens: service.max_tokens,
      api_key_configured: Boolean(service.api_key || service.api_key_encrypted), credentialAvailable: Boolean(service.api_key) };
  }
  function get() {
    const config = current(); const c = catalog(config);
    return { ...c, services: c.services.map(safeService), rowVersion: hash(config), limits: rules(), updatedAt: config.modelGovernance?.updatedAt || null };
  }
  function available() {
    const config = current(); const c = catalog(config); const configVersion = hash(config);
    return { options: c.services.filter(s => s.enabled && s.api_key).flatMap(s => s.models.map(model => ({ serviceId: s.id, serviceName: s.name, provider: s.provider, protocol: s.protocol, model, configVersion }))), defaultSelection: c.defaultSelection, configVersion };
  }
  function checkVersion(config, expected) {
    if (String(expected || '').replace(/^"|"$/g, '') !== hash(config)) throw failure('MODEL_CONFIG_CONFLICT', '模型配置已变化，请重新加载后再操作', 409);
  }
  function normalizeService(input, previous) {
    const p = rules();
    const invalid = message => { throw failure('MODEL_CONFIG_INVALID', message); };
    if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('请填写完整模型服务');
    const text = (value, label) => {
      if (typeof value !== 'string' || !value.trim() || value.length > p.maxNameChars || /[\r\n\x00]/.test(value)) invalid(`${label}不能为空或超过 ${p.maxNameChars} 个字符`);
      return value.trim();
    };
    const name = text(input.name, '服务名称');
    if (!p.providers.some(v => v.value === input.provider)) invalid('请选择支持的服务商');
    if (!p.protocols.some(v => v.value === input.protocol)) invalid('请选择支持的接口协议');
    let url; try { url = new URL(input.base_url); } catch (_) { invalid('请填写有效的 API 基础地址'); }
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) invalid('API 地址只支持 HTTP(S)，不能包含凭据、查询参数或片段');
    if (typeof input.enabled !== 'boolean') invalid('请选择启用状态');
    if (!Array.isArray(input.models) || !input.models.length || input.models.length > p.maxModelsPerService) invalid(`每个服务需配置 1～${p.maxModelsPerService} 个模型`);
    const models = input.models.map(v => text(v, '模型名称'));
    if (new Set(models).size !== models.length) invalid('同一服务内模型名称不能重复');
    const numeric = (v, min, max, label, integer = true) => {
      if (!Number.isFinite(v) || (integer && !Number.isSafeInteger(v)) || v < min || v > max) invalid(`${label}必须在 ${min}～${max} 之间`);
      return v;
    };
    if (input.id && !previous) invalid('服务不存在，请重新加载配置');
    if (input.clearApiKey != null && typeof input.clearApiKey !== 'boolean') invalid('清除凭据选项无效');
    if (input.api_key != null && (typeof input.api_key !== 'string' || input.api_key.length > p.maxSecretChars || /[\r\n\x00]/.test(input.api_key))) invalid('API Key 格式无效');
    const changedTarget = previous && (previous.base_url.replace(/\/+$/, '') !== url.href.replace(/\/+$/, '') || previous.protocol !== input.protocol || previous.provider !== input.provider);
    let api_key = input.api_key || '';
    if (input.clearApiKey && api_key) invalid('清除 API Key 时不能同时填写新值');
    if (!api_key && !input.clearApiKey && (previous?.api_key || previous?.api_key_encrypted)) {
      if (changedTarget) invalid('API 地址、协议或服务商已变化，请重新填写或显式清除 API Key');
      if (!previous.api_key) throw failure('MODEL_SECRET_UNAVAILABLE', '已保存密钥无法读取，请重新填写或清除', 503);
      api_key = previous.api_key;
    }
    if (input.enabled && !api_key) invalid('启用服务前请配置 API Key；无凭据时可保存为停用状态');
    return { id: previous?.id || `model-${crypto.randomUUID()}`, name, provider: input.provider, protocol: input.protocol, base_url: url.href.replace(/\/+$/, ''), models, enabled: input.enabled, api_key,
      timeout: numeric(input.timeout, p.minTimeoutMs, p.maxTimeoutMs, '超时毫秒数'), temperature: numeric(input.temperature, p.minTemperature, p.maxTemperature, '温度', false), max_tokens: numeric(input.max_tokens, p.minOutputTokens, p.maxOutputTokens, '输出 Token 上限') };
  }
  function save(input, expected, actorId) {
    const task = commitTail.then(async () => {
      const config = current(); checkVersion(config, expected); const old = catalog(config); const p = rules();
      if (!Array.isArray(input.services) || input.services.length > p.maxServices) throw failure('MODEL_CONFIG_INVALID', `服务数量不能超过 ${p.maxServices}`);
      const ids = input.services.map(s => s?.id || s?.clientId).filter(Boolean);
      if (input.services.some(s => !s || (!s.id && (typeof s.clientId !== 'string' || !/^new-[a-zA-Z0-9-]+$/.test(s.clientId))))) throw failure('MODEL_CONFIG_INVALID', '新服务需要唯一的临时标识');
      if (new Set(ids).size !== ids.length) throw failure('MODEL_CONFIG_INVALID', '服务标识不能重复');
      const services = input.services.map(s => normalizeService(s, old.services.find(v => v.id === s?.id)));
      const names = services.map(s => s.name);
      if (new Set(names).size !== names.length) throw failure('MODEL_CONFIG_INVALID', '服务名称不能重复');
      const requested = input.defaultSelection;
      const index = requested ? input.services.findIndex(s => (s.id || s.clientId) === requested.serviceId) : -1;
      const d = requested ? { serviceId: services[index]?.id, model: requested.model } : null;
      if (d && !services.some(s => s.id === d.serviceId && s.enabled && s.api_key && s.models.includes(d.model))) throw failure('MODEL_DEFAULT_INVALID', '默认模型必须属于已启用且有凭据的服务');
      const defaultSelection = d;
      if (!d && services.some(s => s.enabled)) throw failure('MODEL_DEFAULT_REQUIRED', '请从已启用的服务中选择默认模型');
      await manager.save('model-config', { ...config, services, defaultSelection, modelGovernance: { updatedAt: new Date().toISOString(), updatedBy: actorId } });
      return get();
    });
    commitTail = task.catch(() => {}); return task;
  }
  function resolve(selection) {
    const config = current(); const c = catalog(config); const configVersion = hash(config);
    if (selection && selection.configVersion !== configVersion) throw failure('MODEL_SELECTION_STALE', '模型配置已变化，请刷新模型列表后重新选择', 409);
    const selected = selection || c.defaultSelection;
    const service = c.services.find(s => s.id === selected?.serviceId && s.enabled && s.api_key && s.models.includes(selected?.model));
    if (!service) throw failure('MODEL_NOT_AVAILABLE', '没有可用的生成模型，请联系管理员配置或重新选择', 409);
    return { config: { ...service, model: selected.model }, selection: { serviceId: service.id, serviceName: service.name, provider: service.provider, protocol: service.protocol, model: selected.model, configVersion } };
  }
  async function test(input, expected) {
    const config = current(); checkVersion(config, expected); const old = catalog(config);
    const s = normalizeService({ ...input.service, enabled: true }, old.services.find(v => v.id === input.service?.id));
    if (!s.models.includes(input.model)) throw failure('MODEL_CONFIG_INVALID', '测试模型必须在当前服务的模型列表中');
    const started = Date.now(); const p = rules();
    try {
      const client = new Client({ ...s, model: input.model, max_tokens: p.testMaxTokens, timeout: p.testTimeoutMs });
      const output = await client.probe([{ role: 'user', content: p.testPrompt }], { model: input.model, max_tokens: p.testMaxTokens, timeout_ms: p.testTimeoutMs });
      if (!output.content?.trim()) throw new Error('empty');
      const latencyMs = output.totalMs ?? Date.now() - started;
      return { status: 'verified', requestedModel: input.model, actualModel: output.model || null, latencyMs,
        firstByteMs: output.firstByteMs ?? latencyMs, testedAt: new Date().toISOString(), message: '模型首字响应成功；配置尚未保存' };
    } catch (cause) {
      const reason = cause?.providerCode === 'AI_PROVIDER_TIMEOUT' || cause?.name === 'APITimeoutError'
        ? `模型测试超时（${p.testTimeoutMs / 1000} 秒），请检查网关排队、网络或模型服务状态`
        : cause?.providerCode === 'AI_PROVIDER_AUTH_FAILED' ? '模型测试鉴权失败，请检查 API Key'
          : cause?.providerCode === 'AI_PROVIDER_RATE_LIMITED' ? '模型测试被限流，请稍后重试' : '模型测试失败，请检查 API 地址、模型名称和服务状态';
      throw failure('MODEL_CONNECTION_FAILED', reason, 502);
    }
  }
  return { get, available, save, resolve, test };
}
module.exports = { createModelGovernance };
