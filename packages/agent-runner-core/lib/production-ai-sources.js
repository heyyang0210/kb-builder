const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { MCPClient } = require('./tools/mcp-client');
const { mcpServices, resolveMcpService } = require('./mcp-services');

// Only server-controlled configuration chooses endpoints and credentials.
function createProductionAISources({ store, context, contextKey, actor, requireCapability, ErrorType, rules, now, loadMCPConfig, pingcodeBaseURL, repositoryRoot, sourceImageRoot }) {
  const fail = (code, message, status = 400) => { throw new ErrorType(code, message, status); };
  const settings = () => rules().sources;
  const defaultSources = () => JSON.parse(fs.readFileSync(require('./config-registry').CONFIG_PATHS.contentRules, 'utf8')).productionAI.sources;
  const uploadPolicy = () => settings().upload || defaultSources().upload;
  const mcpConfig = loadMCPConfig || (() => require('./config-manager').getMCPConfig());
  const images = require('./source-image-resources').createSourceImageResources({ root: sourceImageRoot });

  async function list(input, session) {
    requireCapability(session, 'canEdit'); context(input);
    const config = await mcpConfig();
    const services = mcpServices(config).filter(service => service.enabled !== false).map(service => ({
      id: service.id, name: service.name, adapter: service.adapter || 'yashandb',
      knowledgeBases: (service.knowledgeBases || []).filter(kb => kb.enabled !== false).map(kb => ({ id: kb.id, name: kb.name })),
    }));
    return {
      items: [{ sourceType: 'url', name: '网页来源', available: !!settings().allowPublicWeb || settings().urlOrigins.length > 0 },
        { sourceType: 'pingcode-design', name: 'Pingcode设计文档', available: !!pingcodeBaseURL && !!settings().pingcodeSpaces?.length },
        { sourceType: 'pingcode-test', name: 'Pingcode测试文档', available: !!pingcodeBaseURL && !!settings().pingcodeSpaces?.length },
        { sourceType: 'knowledge-mcp', name: '知识库（MCP）', automatic: true, available: services.some(service => service.adapter === 'yashandb' && (service.knowledgeBases.length || !Array.isArray(config.services))) },
        { sourceType: 'test-case-library', name: '测试用例集', available: testCaseRoot() !== null },
        { sourceType: 'local-document', name: '本地文档', available: true }],
      upload: { extensions: uploadPolicy().extensions, maxBytes: uploadPolicy().maxBytes },
      maxConfirmed: settings().maxConfirmed, referenceListCollapsedCount: settings().referenceListCollapsedCount || defaultSources().referenceListCollapsedCount,
      urlOrigins: settings().urlOrigins, allowPublicWeb: !!settings().allowPublicWeb,
      pingcodeSpaces: settings().pingcodeSpaces || [], mcpServices: services,
      mcpRetrieval: { automatic: true, version: settings().mcpRetrieval?.version || null },
    };
  }

  function testCaseRoot() {
    const configured = settings().testCaseRoot || 'knowledge/references/test-cases';
    const root = path.resolve(repositoryRoot || path.resolve(__dirname, '../../..'), configured);
    const repository = path.resolve(repositoryRoot || path.resolve(__dirname, '../../..'));
    if (!root.startsWith(`${repository}${path.sep}`) || !fs.existsSync(root) || !fs.statSync(root).isDirectory()) return null;
    return root;
  }

  function readTestCase(locator) {
    const root = testCaseRoot();
    if (!root) fail('AI_SOURCE_NOT_CONFIGURED', '测试用例库尚未配置或目录不可用', 503);
    if (typeof locator !== 'string' || !/^[A-Za-z0-9_./-]+\.(?:md|markdown|sql|txt)$/i.test(locator) || locator.includes('..')) {
      fail('AI_SOURCE_LOCATOR_INVALID', '测试用例库请填写目录内的 Markdown、SQL 或文本文件名');
    }
    const file = path.resolve(root, locator);
    if (!file.startsWith(`${root}${path.sep}`) || !fs.existsSync(file) || !fs.statSync(file).isFile()) fail('AI_SOURCE_NOT_FOUND', '测试用例库中不存在该条目', 404);
    const content = fs.readFileSync(file, 'utf8');
    return { content, title: path.basename(file), locator: path.relative(root, file).split(path.sep).join('/') };
  }

  async function readBody(response, maxBytes) {
    try {
      if (Number(response.headers.get('content-length')) > maxBytes) fail('AI_SOURCE_TOO_LARGE', '引用资料超过允许的大小', 413);
      const chunks = []; let bytes = 0;
      for await (const chunk of response.body) {
        bytes += chunk.length;
        if (bytes > maxBytes) fail('AI_SOURCE_TOO_LARGE', '引用资料超过允许的大小', 413);
        chunks.push(Buffer.from(chunk));
      }
      return Buffer.concat(chunks).toString('utf8');
    } finally { if (response.body && !response.body.locked) await response.body.cancel().catch(() => {}); }
  }

  async function readPingCode(locator, diagnostic = {}) {
    diagnostic.stage = 'pingcode_locator';
    let value = locator.trim();
    let originalUrl;
    if (/^https?:\/\//i.test(value)) {
      let url;
      try { url = new URL(value); } catch (_) {
        fail('AI_SOURCE_LOCATOR_INVALID', '请填写有效的 PingCode 页面网址或“空间标识/页面ID”');
      }
      const match = url.pathname.match(/^\/wiki\/spaces\/([A-Za-z0-9_-]+)\/pages\/([A-Za-z0-9_-]+)\/?$/);
      if (!settings().pingcodeOrigins?.includes(url.origin) || url.username || url.password || url.search || !match) {
        fail('AI_SOURCE_LOCATOR_INVALID', '请填写已配置 PingCode 来源的单篇页面网址或“空间标识/页面ID”');
      }
      url.hash = '';
      originalUrl = url.href;
      value = `${match[1]}/${match[2]}`;
    }
    // The editor may submit either `SPACE/PAGE`, `SPACE/pages/PAGE`, or a
    // canonical PingCode URL. Normalize the middle form before validation.
    const pagePath = value.match(/^([A-Za-z0-9_-]+)\/pages\/([A-Za-z0-9_-]+)$/i);
    if (pagePath) value = `${pagePath[1]}/${pagePath[2]}`;
    const parts = value.split('/');
    if (parts.length !== 2 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) {
      fail('AI_SOURCE_LOCATOR_INVALID', 'PingCode 资料请填写页面网址或“空间标识/页面ID”');
    }
    const [spaceKey, pageId] = parts;
    diagnostic.stage = 'pingcode_scope';
    if (!settings().pingcodeSpaces?.includes(spaceKey)) fail('AI_SOURCE_SCOPE_DENIED', '该 PingCode 空间不在已配置的引用范围内', 403);
    if (!pingcodeBaseURL) fail('AI_SOURCE_NOT_CONFIGURED', '请先配置 PingCode 资料服务', 503);
    const url = new URL(`/api/pingcode/spaces/${encodeURIComponent(spaceKey)}/pages/${encodeURIComponent(pageId)}/reference`, pingcodeBaseURL);
    url.searchParams.set('include_images', 'true');
    diagnostic.stage = 'pingcode_fetch';
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(settings().timeoutMs), headers: { Accept: 'application/json' } });
    diagnostic.upstreamStatus = response.status;
    diagnostic.stage = 'pingcode_response';
    // JSON escaping can expand Markdown; bound the transport and the extracted content separately.
    const imagePolicy = require('./source-image-resources').policyFor(settings());
    const raw = await readBody(response, settings().maxBytes * 6 + Math.ceil(imagePolicy.maxTotalBytes / 3) * 4 + imagePolicy.maxCount * 1024);
    if (!response.ok) fail('AI_SOURCE_UNAVAILABLE', 'PingCode 文档读取失败，请检查页面、配置及访问权限', 502);
    const document = JSON.parse(raw);
    if (document.spaceKey !== spaceKey || document.pageId !== pageId || typeof document.content !== 'string') {
      fail('AI_SOURCE_UNAVAILABLE', 'PingCode 返回的文档与请求不一致', 502);
    }
    return {
      content: document.content, title: typeof document.title === 'string' ? document.title : pageId,
      locator: `${spaceKey}/${pageId}`, spaceKey, pageId,
      authenticatedImages: true,
      imageResources: Array.isArray(document.imageResources) ? document.imageResources : [],
      ...(originalUrl ? { originalUrl } : typeof document.originalUrl === 'string' ? { originalUrl: document.originalUrl } : {}),
      ...(['string', 'number'].includes(typeof document.sourceVersion) ? { sourceVersion: document.sourceVersion } : {}),
      ...(typeof document.sourceUpdatedAt === 'string' ? { sourceUpdatedAt: document.sourceUpdatedAt } : {}),
    };
  }

  async function readURL(locator, diagnostic = {}) {
    diagnostic.stage = 'url_validation';
    const config = settings();
    let url;
    try { url = new URL(locator); } catch (_) { fail('AI_SOURCE_URL_INVALID', '请输入有效文档网址'); }
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
      fail('AI_SOURCE_URL_DENIED', '该文档网址不在已配置的引用来源范围内', 403);
    }
    url.hash = '';
    if (config.pingcodeOrigins?.includes(url.origin)) {
      const match = url.pathname.match(/^\/wiki\/spaces\/([A-Za-z0-9_-]+)\/pages\/([A-Za-z0-9_-]+)\/?$/);
      if (!match || url.search) fail('AI_SOURCE_URL_DENIED', '请填写已授权空间内的单篇 PingCode 文档网址', 403);
      const document = await readPingCode(`${match[1]}/${match[2]}`, diagnostic);
      return { ...document, locator: url.href, originalUrl: url.href };
    }
    try {
      diagnostic.stage = 'web_fetch';
      return await require('./production-web-reference').readWebReference(url.href, config);
    } catch (error) {
      if (error.code?.startsWith('AI_SOURCE_')) fail(error.code, error.message, error.status);
      throw error;
    }
  }

  async function preview(input, session, diagnostic = {}) {
    diagnostic.stage = 'authorization';
    requireCapability(session, 'canEdit');
    const ctx = context(input);
    diagnostic.stage = 'locator_validation';
    if (typeof input.locator !== 'string' || !input.locator.trim() || input.locator.length > settings().maxLocatorChars) {
      fail('AI_SOURCE_LOCATOR_REQUIRED', '请填写资料名称或文档网址');
    }
    let document;
    try {
      if (input.sourceType === 'url') document = await readURL(input.locator, diagnostic);
      else if (['pingcode-design', 'pingcode-test'].includes(input.sourceType)) document = await readPingCode(input.locator, diagnostic);
      else if (input.sourceType === 'knowledge-mcp') {
        diagnostic.stage = 'mcp_read';
        const config = await mcpConfig();
        if (!config?.server_url && !config?.services?.length) fail('AI_SOURCE_NOT_CONFIGURED', '请先配置知识库 MCP 服务', 503);
        let selected;
        try { selected = resolveMcpService(config, input.mcpServiceId, input.mcpKnowledgeBaseId); }
        catch (_) { fail('AI_SOURCE_NOT_CONFIGURED', '请选择已启用的 MCP 服务和知识库', 422); }
        if (input.mcpServiceId && selected.knowledgeBases?.length && !input.mcpKnowledgeBaseId) fail('AI_SOURCE_NOT_CONFIGURED', '请选择该服务下的知识库', 422);
        if (selected.adapter !== 'yashandb') fail('AI_SOURCE_NOT_CONFIGURED', '所选 MCP 服务尚无知识库读取适配', 422);
        const base = selected.knowledgeBases?.find(k => k.id === input.mcpKnowledgeBaseId);
        const result = await new MCPClient({ ...selected, cache: { enabled: false } }).getDocument(input.locator);
        if (!result || result.isError) fail('AI_SOURCE_UNAVAILABLE', '知识库未返回可读取的资料', 502);
        const content = (result.content || []).filter(item => item.type === 'text').map(item => item.text).join('\n');
        document = { content, locator: input.locator, mcpServiceId: selected.id, mcpServiceName: selected.name, ...(base ? { mcpKnowledgeBaseId: base.id, mcpKnowledgeBaseName: base.name } : {}) };
        // The existing knowledge MCP returns its document inside a JSON text block.
        // Preserve plain text from other compatible MCP servers without guessing its schema.
        try {
          const parsed = JSON.parse(content);
          if (typeof parsed.content === 'string') {
            document.content = parsed.content;
            if (typeof parsed.title === 'string') document.title = parsed.title;
            if (typeof parsed.version === 'string' || typeof parsed.version === 'number') document.sourceVersion = parsed.version;
          }
        } catch (_) {}
      } else if (input.sourceType === 'test-case-library') { diagnostic.stage = 'test_case_read'; document = readTestCase(input.locator); }
      else fail('AI_SOURCE_TYPE_INVALID', '请选择支持的引用来源');
      diagnostic.stage = 'content_validation';
      if (!document.content.trim()) fail('AI_SOURCE_EMPTY', '资料没有可引用的正文', 422);
      if (Buffer.byteLength(document.content) > settings().maxBytes) fail('AI_SOURCE_TOO_LARGE', '引用资料超过允许的大小', 413);
    } catch (error) {
      diagnostic.causeCode = String(error.cause?.code || error.code || error.name || 'UNKNOWN').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
      if (error instanceof ErrorType) throw error;
      fail('AI_SOURCE_UNAVAILABLE', '资料读取失败，请检查来源配置、网络和访问权限', 502);
    }
    const snapshot = {
      sourceId: `source-${crypto.randomUUID()}`, sourceType: input.sourceType,
      ...document, contentDigest: crypto.createHash('sha256').update(document.content).digest('hex'),
      fetchedAt: new Date(now()).toISOString(), createdBy: actor(session), context: ctx, contextKey: contextKey(ctx),
    };
    diagnostic.stage = 'image_materialization';
    const hosted = await images.materialize(document, snapshot, settings());
    delete snapshot.authenticatedImages;
    Object.assign(snapshot, hosted, { contentDigest: crypto.createHash('sha256').update(hosted.content).digest('hex') });
    if (Buffer.byteLength(snapshot.content) > settings().maxBytes) fail('AI_SOURCE_TOO_LARGE', '引用资料超过允许的大小', 413);
    diagnostic.imageReady = hosted.imageResources.filter(image => image.status === 'ready').length;
    diagnostic.imageFailed = hosted.imageResources.length - diagnostic.imageReady;
    diagnostic.stage = 'snapshot_persistence';
    return store.transaction(state => {
      state.aiSources ||= {};
      state.aiSources[snapshot.sourceId] = snapshot;
      return structuredClone(snapshot);
    });
  }

  async function previewUpload(input, buffer, fileName, mimeType, session, diagnostic = {}) {
    requireCapability(session, 'canEdit');
    const ctx = context(input);
    const config = settings();
    const policy = uploadPolicy();
    if (!Buffer.isBuffer(buffer) || !buffer.length) fail('AI_SOURCE_EMPTY', '本地文档没有可读取的内容', 422);
    if (buffer.length > policy.maxBytes) fail('AI_SOURCE_TOO_LARGE', '本地文档超过允许的大小', 413);
    const name = path.basename(String(fileName || '').replace(/\\/g, '/')).replace(/[\x00-\x1f]/g, '').slice(0, config.maxLocatorChars);
    const extension = path.extname(name).toLowerCase().slice(1);
    if (!policy.extensions.includes(extension)) fail('AI_SOURCE_TYPE_INVALID', '不支持此文件格式，请选择上传区域提示的文档格式');
    let document;
    try { document = await require('./production-ai-upload-parser').parseUpload(buffer, extension, policy, require('./source-image-resources').policyFor(config)); }
    catch (_) { fail('AI_SOURCE_PARSE_FAILED', '本地文档解析失败，请检查文件格式、编码、大小或是否损坏', 422); }
    let content = document.content;
    content = String(content || '').trim();
    if (!content) fail('AI_SOURCE_EMPTY', '本地文档没有可引用的正文', 422);
    if (Buffer.byteLength(content) > config.maxBytes) fail('AI_SOURCE_TOO_LARGE', '解析后的文档超过允许的大小', 413);
    const snapshot = {
      sourceId: `source-${crypto.randomUUID()}`, sourceType: 'local-document', title: name,
      locator: name, ...document, content, contentDigest: crypto.createHash('sha256').update(content).digest('hex'),
      fetchedAt: new Date(now()).toISOString(), createdBy: actor(session), context: ctx, contextKey: contextKey(ctx),
      mimeType: String(mimeType || 'application/octet-stream'), fileName: name,
    };
    const hosted = await images.materialize({ ...document, content, locator: name, authenticatedImages: true }, snapshot, config);
    Object.assign(snapshot, hosted, { contentDigest: crypto.createHash('sha256').update(hosted.content).digest('hex') });
    delete snapshot.authenticatedImages;
    if (Buffer.byteLength(snapshot.content) > config.maxBytes) fail('AI_SOURCE_TOO_LARGE', '解析后的文档超过允许的大小', 413);
    return store.transaction(state => { state.aiSources ||= {}; state.aiSources[snapshot.sourceId] = snapshot; return structuredClone(snapshot); });
  }

  function readImage(input, session) {
    requireCapability(session, 'canRead');
    const ctx = context(input); const key = contextKey(ctx);
    const state = store.read();
    const owned = Object.values(state.aiSources || {}).filter(source => source.contextKey === key && source.createdBy.id === actor(session).id);
    const automatic = Object.values(state.aiJobs || {}).filter(job => job.contextKey === key && job.createdBy?.id === actor(session).id)
      .flatMap(job => job.sourceSnapshots || []);
    const revisions = state.drafts?.[key]?.revisions || [];
    const shared = revisions.flatMap(revision => revision.generationMetadata?.sourceSnapshots || []);
    const resource = [...owned, ...automatic, ...shared].filter(source => source.contextKey === key)
      .flatMap(source => source.imageResources || []).find(item => item.status === 'ready' && item.assetId === input.assetId);
    if (!resource) fail('AI_SOURCE_IMAGE_NOT_FOUND', '当前文档下不存在可访问的图片', 404);
    try { return images.read(resource); }
    catch (_) { fail('AI_SOURCE_IMAGE_NOT_FOUND', '图片快照不可用，请重新读取资料', 404); }
  }

  function confirmed(state, input, session) {
    const ids = input.confirmedSourceIds || [];
    if (!Array.isArray(ids) || ids.length > settings().maxConfirmed || ids.some(id => typeof id !== 'string') || new Set(ids).size !== ids.length) {
      fail('AI_SOURCES_INVALID', '请确认有效且不重复的参考资料');
    }
    const versions = new Map();
    return ids.map((id, index) => {
      const source = state.aiSources?.[id];
      if (!source || source.contextKey !== contextKey(input) || source.createdBy.id !== actor(session).id) {
        fail('AI_SOURCE_NOT_FOUND', '当前文档下不存在可引用的资料', 404);
      }
      const identity = JSON.stringify([source.sourceType, source.mcpServiceId || '', source.mcpKnowledgeBaseId || '', source.locator]);
      if (versions.has(identity) && versions.get(identity) !== source.contentDigest) {
        fail('AI_SOURCE_VERSION_CONFLICT', '已选资料包含同一来源的不同内容版本，请取消旧版本引用后重试', 409);
      }
      versions.set(identity, source.contentDigest);
      return { ...structuredClone(source), priority: index + 1 };
    });
  }
  async function retrieveAutomatic(job, agentMcpConfig) {
    const policy = job.mcpRetrievalPolicy;
    if (!policy) return { snapshots: [], retrieval: { status: 'not_configured', attempts: [] } };
    const outcome = await require('./production-ai-mcp-retrieval').retrieve(job, policy, agentMcpConfig || await mcpConfig(), settings().maxBytes, now);
    for (const snapshot of outcome.snapshots) {
      const hosted = await images.materialize(snapshot, snapshot, settings());
      Object.assign(snapshot, hosted, { contentDigest: crypto.createHash('sha256').update(hosted.content).digest('hex') });
    }
    return outcome;
  }
  return { list, preview, previewUpload, uploadPolicy, confirmed, retrieveAutomatic, readImage };
}

module.exports = { createProductionAISources };
