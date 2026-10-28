const crypto = require('crypto');
const { MCPClient } = require('./tools/mcp-client');
const { mcpServices, resolveMcpService } = require('./mcp-services');

const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const bounded = (value, limit) => String(value || '').slice(0, limit);

function plan(job, policy, config) {
  const heading = String(job.originalMarkdown || '').match(/^#{1,3}\s+(.+)$/m)?.[1] || '';
  const context = [job.requirements, heading, job.outline, job.originalMarkdown.slice(job.range.start, job.range.end)].filter(Boolean).join(' ');
  const input = bounded(context, policy.maxInputChars);
  const explicit = input.match(new RegExp(policy.keywordPattern, 'i'))?.[1] || '';
  const words = (explicit || [job.requirements, heading].filter(Boolean).join(' ') || input)
    .split(/[\s,，、;；。\n]+/).map(word => word.replace(/^[#*`'"：:]+|[#*`'"：:]+$/g, ''))
    .filter(word => word.length >= 2 && word.length <= 40);
  const keywords = [...new Set(words)].slice(0, policy.maxKeywords);
  const dimensions = policy.dimensions.filter(rule => rule.match.some(term => input.toLowerCase().includes(term.toLowerCase())));
  const selected = (dimensions.length ? dimensions : policy.dimensions.filter(rule => !rule.match.length)).slice(0, policy.maxQueries);
  const term = keywords.slice(0, 2).join(' ') || bounded(heading || input, 40).trim();
  const queries = [...new Set(selected.map(rule => `${term} ${rule.querySuffix}`.trim()).filter(Boolean))].slice(0, policy.maxQueries);
  const services = mcpServices(config).filter(service => service.enabled !== false && (service.adapter || 'yashandb') === 'yashandb');
  const candidates = services.flatMap(service => (service.knowledgeBases?.length ? service.knowledgeBases.filter(base => base.enabled !== false) : !Array.isArray(config.services) ? [{ id: null, name: '默认知识库' }] : []).map(base => ({ serviceId: service.id, serviceName: service.name, knowledgeBaseId: base.id, knowledgeBaseName: base.name })));
  const matching = rule => candidates.filter(candidate => rule.knowledgeBaseNameIncludes.some(name => candidate.knowledgeBaseName.includes(name)));
  const route = policy.routes.find(rule => rule.match.length && rule.match.some(term => input.toLowerCase().includes(term.toLowerCase())) && matching(rule).length)
    || policy.routes.find(rule => !rule.match.length && matching(rule).length);
  const matched = route ? matching(route) : [];
  const implicit = candidates.filter(candidate => candidate.knowledgeBaseId === null);
  const routes = (matched.length ? matched : implicit).slice(0, policy.maxRoutes);
  return { version: policy.version, keywords, dimensions: selected.map(rule => rule.id), queries, routeRule: route && matched.length ? route.id : policy.fallback, routes };
}

function searchResults(result) {
  if (result?.isError || result?.structuredContent?.isError || result?.structuredContent?.success === false) throw new Error('MCP 搜索失败');
  let structured = result?.structuredContent;
  if (!structured) {
    const text = result?.content?.find(item => item.type === 'text')?.text;
    try { structured = JSON.parse(text); } catch (_) { throw new Error('MCP 搜索结果格式无效'); }
  }
  if (structured?.isError || structured?.success === false || !Array.isArray(structured?.results)) throw new Error('MCP 搜索结果格式无效');
  return structured.results;
}

function documentBody(result) {
  if (!result || result.isError || result.structuredContent?.isError || result.structuredContent?.success === false) return null;
  if (typeof result.structuredContent?.content === 'string') return { content: result.structuredContent.content, title: result.structuredContent.title, sourceVersion: result.structuredContent.version };
  const text = (result.content || []).filter(item => item.type === 'text').map(item => item.text).join('\n');
  try {
    const parsed = JSON.parse(text);
    if (parsed.isError || parsed.success === false) return null;
    if (typeof parsed.content === 'string') return { content: parsed.content, title: parsed.title, sourceVersion: parsed.version };
    if (parsed && typeof parsed === 'object') return null;
  } catch (_) {}
  return text.trim() ? { content: text } : null;
}

async function retrieve(job, policy, config, maxBytes, now = Date.now) {
  const retrieval = plan(job, policy, config);
  const attempts = [];
  const candidates = [];
  if (!retrieval.routes.length) return { snapshots: [], retrieval: { ...retrieval, status: 'not_configured', attempts, hitCount: 0 } };
  if (!retrieval.queries.length) return { snapshots: [], retrieval: { ...retrieval, status: 'empty', attempts, hitCount: 0 } };
  for (const route of retrieval.routes) {
    for (const query of retrieval.queries) {
      try {
        const selected = resolveMcpService(config, route.serviceId, route.knowledgeBaseId);
        const client = new MCPClient({ ...selected, cache: { enabled: false } });
        const results = searchResults(await client.query(query));
        attempts.push({ query, serviceId: route.serviceId, knowledgeBaseId: route.knowledgeBaseId, status: 'succeeded', hitCount: results.length });
        for (const result of results) {
          const score = Number(result?.score);
          if (typeof result?.ku_name !== 'string' || !result.ku_name || !Number.isFinite(score) || score < policy.minScore) continue;
          candidates.push({ ...route, locator: result.ku_name, score, title: result.title });
        }
      } catch (_) { attempts.push({ query, serviceId: route.serviceId, knowledgeBaseId: route.knowledgeBaseId, status: 'failed', hitCount: 0 }); }
    }
  }
  if (attempts.length && attempts.every(attempt => attempt.status === 'failed')) {
    const error = new Error('知识库检索失败，请检查 MCP 服务后重试'); error.code = 'AI_MCP_RETRIEVAL_FAILED'; error.retrieval = { ...retrieval, status: 'failed', attempts, hitCount: candidates.length }; throw error;
  }
  const unique = new Map();
  for (const candidate of candidates.sort((a, b) => b.score - a.score || a.locator.localeCompare(b.locator))) {
    const key = JSON.stringify([candidate.serviceId, candidate.knowledgeBaseId, candidate.locator]);
    if (!unique.has(key)) unique.set(key, candidate);
  }
  const snapshots = [];
  let detailFailures = 0;
  for (const candidate of unique.values()) {
    if (snapshots.length >= policy.maxDocuments) break;
    try {
      const selected = resolveMcpService(config, candidate.serviceId, candidate.knowledgeBaseId);
      const body = documentBody(await new MCPClient({ ...selected, cache: { enabled: false } }).getDocument(candidate.locator));
      if (!body?.content?.trim() || Buffer.byteLength(body.content) > maxBytes) { detailFailures++; continue; }
      snapshots.push({ sourceId: `source-mcp-${digest(JSON.stringify([job.jobId, candidate.serviceId, candidate.knowledgeBaseId, candidate.locator])).slice(0, 24)}`,
        sourceType: 'knowledge-mcp', automatic: true, title: body.title || candidate.title || candidate.locator,
        locator: candidate.locator, content: body.content, contentDigest: digest(body.content), sourceVersion: body.sourceVersion,
        mcpServiceId: candidate.serviceId, mcpServiceName: candidate.serviceName,
        mcpKnowledgeBaseId: candidate.knowledgeBaseId, mcpKnowledgeBaseName: candidate.knowledgeBaseName,
        fetchedAt: new Date(now()).toISOString(), createdBy: job.createdBy, context: job.context, contextKey: job.contextKey,
        priority: job.sourceSnapshots.length + snapshots.length + 1 });
    } catch (_) { detailFailures++; }
  }
  if (candidates.length && !snapshots.length && detailFailures) {
    const error = new Error('知识库原文读取失败，请检查 MCP 服务后重试'); error.code = 'AI_MCP_RETRIEVAL_FAILED'; error.retrieval = { ...retrieval, status: 'failed', attempts, hitCount: candidates.length }; throw error;
  }
  return { snapshots, retrieval: { ...retrieval, status: snapshots.length ? attempts.some(attempt => attempt.status === 'failed') || detailFailures ? 'partial' : 'succeeded' : 'empty', attempts, hitCount: candidates.length, detailFailures, sourceIds: snapshots.map(source => source.sourceId) } };
}

module.exports = { plan, retrieve, searchResults, documentBody };
