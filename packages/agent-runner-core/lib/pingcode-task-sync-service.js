const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const cheerio = require('cheerio');
const { collectPingcodeTaskSource } = require('./pingcode-task-collection');
const { HtmlAdapter } = require('./preprocessing/cleaners/html-adapter');
const { imageReferences, imageType, policyFor } = require('./source-image-resources');
const { REPOSITORY_ROOT, AGENT_RUNNER_RUNTIME_ROOT } = require('./repo-paths');
const defaultLogger = require('./logger');

const idempotencyKey = () => crypto.randomUUID();
const sha256 = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const storagePath = '/v1/pingcode-task-sync';
const htmlAdapter = new HtmlAdapter();

function markdownBody(value, sourceUrl) {
  if (typeof value !== 'string' || !/<[a-z][\s\S]*>/i.test(value)) return value || '';
  const $ = cheerio.load(value);
  return htmlAdapter.htmlToMarkdown($, { imageResolver: src => {
    try {
      const url = new URL(src, sourceUrl);
      return url.protocol === 'https:' && url.hostname === 'pingcode.yasdb.com'
        && !url.username && !url.password ? url.href : null;
    } catch { return null; }
  } });
}

function createPingcodeTaskSyncService({ storage, pingcodeUrl, readPage: providedReadPage,
  readPages: providedReadPages,
  readImage: providedReadImage,
  logger = defaultLogger,
  tokenPath = path.join(REPOSITORY_ROOT, 'runtime/pingcode/task-sync-internal-token') }) {
  const activeRuns = new Map();
  const resourceRetries = new Map();
  const imagePolicy = policyFor({});
  const imageRoot = path.join(AGENT_RUNNER_RUNTIME_ROOT, 'pingcode', 'task-resources');
  const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' };
  const request = (method, pathname, body, extraHeaders = {}) => storage.requestAsync(method,
    `${storagePath}${pathname}`, body, {
      ...(method === 'GET' ? {} : { 'Idempotency-Key': idempotencyKey() }), ...extraHeaders,
    });

  async function internalRead(endpoint, body, signal) {
    const token = process.env.PINGCODE_TASK_SYNC_INTERNAL_TOKEN || fs.readFileSync(tokenPath, 'utf8').trim();
    if (!token) throw Object.assign(new Error('Pingcode 内部读取尚未配置'), { code: 'PINGCODE_READ_UNAVAILABLE' });
    const response = await fetch(new URL(endpoint, pingcodeUrl), {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Internal-Token': token },
      body: JSON.stringify(body), signal,
    });
    const result = await response.json();
    const failure = result?.error || result?.detail;
    if (!response.ok) {
      const code = /^[A-Z0-9_]{1,64}$/.test(failure?.code || '') ? failure.code : 'PINGCODE_READ_FAILED';
      throw Object.assign(new Error(failure?.message || 'Pingcode 读取失败'),
        { code, status: response.status, details: failure && typeof failure === 'object' ? failure : undefined });
    }
    return result;
  }

  async function readPage(source, pageIndex, signal) {
    if (providedReadPage) return providedReadPage(source, pageIndex, signal);
    return internalRead('/api/internal/pingcode/task-source-page',
      { url: source.url, type: source.type.toLowerCase() === 'requirement' ? 'requirement' : 'ticket', pageIndex }, signal);
  }

  async function readAllPages(source, signal) {
    if (providedReadPages) return providedReadPages(source, signal);
    return internalRead('/api/internal/pingcode/task-source-pages',
      { url: source.url, type: 'requirement' }, signal).then(result => result.pages);
  }

  async function readImage(url, limit, timeoutMs, signal) {
    if (providedReadImage) return providedReadImage(url, limit, timeoutMs, signal);
    return internalRead('/api/internal/pingcode/task-source-image',
      { url, maxBytes: limit, timeoutMs }, signal);
  }

  async function materializeBody(value, sourceUrl, signal) {
    let markdown = markdownBody(value, sourceUrl);
    const resources = [];
    const seen = new Map();
    const edits = [];
    let totalBytes = 0;
    const deadline = Date.now() + imagePolicy.timeoutMs;
    for (const ref of imageReferences(markdown)) {
      let resource = seen.get(ref.href);
      if (!resource) {
        let canonicalUrl = null;
        try { const url = new URL(ref.href); canonicalUrl = url.origin + url.pathname; }
        catch { /* Invalid image references are recorded as missing. */ }
        const id = crypto.createHash('sha256').update(canonicalUrl || ref.href).digest('hex');
        resource = { id, state: 'FAILED', path: null, errorCode: 'PINGCODE_IMAGE_UNAVAILABLE' };
        seen.set(ref.href, resource); resources.push(resource);
        try {
          const url = new URL(ref.href);
          if (url.protocol !== 'https:' || url.hostname !== 'pingcode.yasdb.com'
            || !url.pathname.startsWith('/atlas/files/public/') || url.username || url.password)
            throw Object.assign(new Error(), { code: 'PINGCODE_IMAGE_INVALID' });
          const remaining = Math.min(imagePolicy.maxBytes, imagePolicy.maxTotalBytes - totalBytes);
          const timeout = deadline - Date.now();
          if (resources.length > imagePolicy.maxCount || remaining <= 0 || timeout <= 0)
            throw Object.assign(new Error(), { code: 'PINGCODE_IMAGE_LIMIT' });
          const result = await readImage(ref.href, remaining, timeout, signal);
          if (typeof result.dataBase64 !== 'string' || result.dataBase64.length > Math.ceil(remaining / 3) * 4 + 4)
            throw Object.assign(new Error(), { code: 'PINGCODE_IMAGE_INVALID' });
          const bytes = Buffer.from(result.dataBase64, 'base64');
          const type = imageType(bytes);
          if (!type || type !== result.contentType || !imagePolicy.contentTypes.includes(type)
            || !bytes.length || bytes.length > remaining)
            throw Object.assign(new Error(), { code: 'PINGCODE_IMAGE_INVALID' });
          const hash = crypto.createHash('sha256').update(bytes).digest('hex');
          fs.mkdirSync(imageRoot, { recursive: true });
          const target = path.join(imageRoot, hash);
          try { fs.writeFileSync(target, bytes, { flag: 'wx', mode: 0o600 }); }
          catch (error) { if (error.code !== 'EEXIST') throw error; }
          totalBytes += bytes.length;
          Object.assign(resource, { state: 'READY', path: `assets/${hash}.${extension[type]}`,
            contentType: type, byteCount: bytes.length, errorCode: null });
        } catch (error) {
          resource.errorCode = ['PINGCODE_IMAGE_INVALID', 'PINGCODE_IMAGE_LIMIT'].includes(error.code)
            ? error.code : 'PINGCODE_IMAGE_UNAVAILABLE';
          resource.path = canonicalUrl;
          if (resource.path?.length > 500) resource.path = null;
        }
      }
      const alt = String(ref.alt || '图片').replace(/[\[\]<>\r\n]/g, ' ');
      edits.push({ start: ref.start, end: ref.end, text: resource.state === 'READY'
        ? `![${alt}](${resource.path})` : `[图片未能读取：${alt}]` });
    }
    for (const edit of edits.reverse()) markdown = markdown.slice(0, edit.start) + edit.text + markdown.slice(edit.end);
    return { description: markdown, imageResources: resources };
  }

  async function markdownPage(page, sourceUrl, signal, cache) {
    const items = [];
    const convert = async work => {
      const key = `${work.id}:${crypto.createHash('sha256').update(String(work.description || '')).digest('hex')}`;
      if (!cache.has(key)) {
        if (cache.size >= 100) cache.delete(cache.keys().next().value);
        cache.set(key, await materializeBody(work.description, sourceUrl, signal));
      }
      return { ...work, ...cache.get(key) };
    };
    for (const row of page.items) {
      if (page.sourceType === 'requirement') {
        const workItems = [];
        for (const work of row.workItems) workItems.push(await convert(work));
        items.push({ ...row, workItems });
      } else items.push(await convert(row));
    }
    return { ...page, items };
  }

  async function listSources() { return (await request('GET', '/sources')).data; }
  async function sourceItems(id, page = 1, pageSize = 50) {
    return (await request('GET', `/sources/${encodeURIComponent(id)}/items?page=${page}&pageSize=${pageSize}`)).data;
  }
  async function sourceItem(id, number) {
    return (await request('GET', `/sources/${encodeURIComponent(id)}/items/${encodeURIComponent(number)}`)).data;
  }
  async function runItems(id, page = 1, pageSize = 50) {
    return (await request('GET', `/runs/${encodeURIComponent(id)}/items?page=${page}&pageSize=${pageSize}`)).data;
  }
  async function unlinkedIrs(id, page = 1, pageSize = 100) {
    return (await request('GET', `/runs/${encodeURIComponent(id)}/unlinked-irs?page=${page}&pageSize=${pageSize}`)).data;
  }
  async function runItem(id, number) {
    return (await request('GET', `/runs/${encodeURIComponent(id)}/items/${encodeURIComponent(number)}`)).data;
  }
  async function createSource(input, actor) {
    const type = input?.type === 'REQUIREMENT' ? 'requirement' : input?.type === 'TICKET' ? 'ticket' : null;
    if (!type || !input?.url || !input?.name || !['DB', 'YCM', 'YMP', 'YDC'].includes(input?.productType)) throw Object.assign(new Error('请填写来源名称、类型、产品类型和 URL'),
      { code: 'PINGCODE_SOURCE_INVALID', status: 422 });
    return (await request('POST', '/sources', { name: input.name, type: input.type, productType: input.productType,
      businessVersion: input.businessVersion, url: input.url,
      connectionId: new URL(pingcodeUrl).host, actor })).data;
  }
  async function source(id) { return (await request('GET', `/sources/${encodeURIComponent(id)}`)).data; }
  async function updateSource(id, input) {
    if (!Number.isSafeInteger(input?.revision) || !input.name || !input.type || !input.url
      || !['DB', 'YCM', 'YMP', 'YDC'].includes(input?.productType))
      throw Object.assign(new Error('请填写完整的来源信息并刷新最新版本'), { code: 'PINGCODE_SOURCE_INVALID', status: 422 });
    return (await request('PATCH', `/sources/${encodeURIComponent(id)}`, {
      name: input.name, type: input.type, productType: input.productType,
      businessVersion: input.businessVersion, url: input.url, revision: input.revision,
    })).data;
  }
  async function setSourceState(id, input) {
    if (!Number.isSafeInteger(input?.revision) || !['ACTIVE', 'DISABLED'].includes(input.state))
      throw Object.assign(new Error('请刷新来源后重试'), { code: 'PINGCODE_SOURCE_INVALID', status: 422 });
    if (input.state === 'DISABLED') {
      const startedAt = Date.now();
      await cancelCollectingRuns(id, true);
      logger.info('pingcode.source.collecting_runs_cancelled', {
        sourceId: id, operation: 'disable', durationMs: Date.now() - startedAt,
      });
    }
    return (await request('PATCH', `/sources/${encodeURIComponent(id)}/state`, input)).data;
  }
  async function deleteSource(id, revision) {
    if (!Number.isSafeInteger(revision)) throw Object.assign(new Error('来源版本缺失，请刷新后重试'),
      { code: 'PINGCODE_SOURCE_REVISION_REQUIRED', status: 422 });
    return (await request('DELETE', `/sources/${encodeURIComponent(id)}`, undefined, { 'If-Match': String(revision) })).data;
  }
  async function testSource(id) {
    const configured = await source(id);
    const first = await readPage(configured, 0);
    return { sourceId: configured.id, sourceVersion: first.sourceVersion, rowCount: first.count,
      pageCount: first.pageCount, sourceType: configured.type };
  }
  async function getRun(id) { return (await request('GET', `/runs/${encodeURIComponent(id)}`)).data; }
  async function listRuns(sourceId) { return (await request('GET', `/sources/${encodeURIComponent(sourceId)}/runs`)).data; }
  async function cancelCollectingRuns(sourceId, interruptActive = false) {
    const runs = await listRuns(sourceId);
    for (const run of runs.filter(item => item.status === 'COLLECTING')) {
      const active = activeRuns.get(run.id);
      if (active && !interruptActive)
        throw Object.assign(new Error('该来源正在同步，请等待当前同步结束'),
          { code: 'PINGCODE_SOURCE_RUNNING', status: 409 });
      active?.controller.abort();
      try { await request('POST', `/runs/${encodeURIComponent(run.id)}/cancel`, {}); }
      catch (error) {
        const current = await getRun(run.id);
        if (current.status === 'COLLECTING') throw error;
      }
    }
  }
  async function previewRun(id, { page = 1, pageSize = 50, view = 'current' } = {}) {
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100)
      throw Object.assign(new Error('预览页码无效'), { code: 'PINGCODE_PREVIEW_PAGE_INVALID', status: 422 });
    if (!['current', 'created', 'updated', 'removed', 'conflicts'].includes(view))
      throw Object.assign(new Error('预览类型无效'), { code: 'PINGCODE_PREVIEW_VIEW_INVALID', status: 422 });
    return (await request('GET', `/runs/${encodeURIComponent(id)}/preview?page=${page}&pageSize=${pageSize}&view=${view}`)).data;
  }
  async function confirmRun(id, { digest, expectedRevision, primarySources = {} } = {}) {
    if (!/^[a-f0-9]{64}$/.test(digest || '') || !Number.isSafeInteger(expectedRevision)
      || !primarySources || typeof primarySources !== 'object' || Array.isArray(primarySources))
      throw Object.assign(new Error('请使用有效预览摘要和来源版本确认'), { code: 'PREVIEW_CONFIRM_INPUT_INVALID', status: 422 });
    const run = await getRun(id);
    if (run.status === 'AWAITING_CONFIRM') {
      const configured = await source(run.sourceId);
      const current = await readPage(configured, 0);
      if (current.sourceVersion == null || run.sourceVersion == null
        || String(current.sourceVersion) !== String(run.sourceVersion)
        || sha256(current.criteria || null) !== run.criteriaSha256
        || current.count !== run.rowCount || current.pageCount !== run.pageCount
        || current.sourceType !== configured.type.toLowerCase()) {
        throw Object.assign(new Error('来源内容或筛选条件已变化，请重新预览'),
          { code: 'PREVIEW_STALE', status: 409 });
      }
    }
    return (await request('POST', `/runs/${encodeURIComponent(id)}/confirm`,
      { digest, expectedRevision, primarySources })).data;
  }
  async function startRun(id, actor, revision) {
    const startedAt = Date.now();
    if (!Number.isSafeInteger(revision))
      throw Object.assign(new Error('请刷新来源后重试'), { code: 'PINGCODE_SOURCE_REVISION_REQUIRED', status: 422 });
    await cancelCollectingRuns(id);
    const run = (await request('POST', `/sources/${encodeURIComponent(id)}/runs`,
      { revision, actor })).data;
    logger.info('pingcode.sync.accepted', {
      sourceId: id, runId: run.id, stage: 'run_created',
      startResponseDurationMs: Date.now() - startedAt,
    });
    const controller = new AbortController();
    const materialized = new Map();
    activeRuns.set(run.id, { controller, sourceId: id });
    void (async () => {
      const collectionStartedAt = Date.now();
      let pageCount = 0;
      logger.info('pingcode.sync.collection_started', { sourceId: id, runId: run.id });
      try {
        const configured = await source(id);
        if (controller.signal.aborted) throw Object.assign(new Error('采集已取消'), { code: 'COLLECTION_CANCELLED' });
        if (configured.revision !== revision)
          throw Object.assign(new Error('来源配置已变化，请刷新后重试'), { code: 'ROW_VERSION_CONFLICT', status: 409 });
        const result = await collectPingcodeTaskSource({ source: {
          type: configured.type.toLowerCase() === 'requirement' ? 'requirement' : 'ticket', url: configured.url,
        }, readPage, readPages: providedReadPages || (providedReadPage ? undefined : readAllPages),
        signal: controller.signal, retainItems: false,
        onPage: async (page, { criteriaSha256 }) => {
          await request('POST', `/runs/${encodeURIComponent(run.id)}/pages`,
            { ...await markdownPage(page, configured.url, controller.signal, materialized), criteriaSha256 });
          pageCount++;
          logger.info('pingcode.sync.page_staged', {
            sourceId: id, runId: run.id, pageIndex: page.pageIndex,
            itemCount: page.items?.length || 0, pagesStaged: pageCount,
            durationMs: Date.now() - collectionStartedAt,
          });
        } });
        if (controller.signal.aborted) throw Object.assign(new Error('采集已取消'), { code: 'COLLECTION_CANCELLED' });
        await request('POST', `/runs/${encodeURIComponent(run.id)}/finish`, { digest: sha256({
          sourceId: id, revision: configured.revision, collectionDigest: result.digest,
        }) });
        logger.info('pingcode.sync.collection_completed', {
          sourceId: id, runId: run.id, pageCount, rowCount: result.count,
          durationMs: Date.now() - collectionStartedAt,
        });
      } catch (error) {
        const action = controller.signal.aborted || error.code === 'COLLECTION_CANCELLED' ? 'cancel' : 'fail';
        logger.warn('pingcode.sync.collection_failed', {
          sourceId: id, runId: run.id, action, pageCount,
          errorCode: error.code || 'COLLECTION_FAILED',
          durationMs: Date.now() - collectionStartedAt,
        });
        try { await request('POST', `/runs/${encodeURIComponent(run.id)}/${action}`,
          action === 'fail' ? { errorCode: String(error.code || 'COLLECTION_FAILED').slice(0, 64) } : {}); }
        catch (recordError) { /* A concurrent cancel may have already set the terminal state. */ }
      } finally { activeRuns.delete(run.id); }
    })();
    return run;
  }
  async function cancelRun(id) {
    activeRuns.get(id)?.controller.abort();
    try { return (await request('POST', `/runs/${encodeURIComponent(id)}/cancel`, {})).data; }
    catch (error) {
      const current = await getRun(id);
      if (current.status === 'CANCELLED') return current;
      throw error;
    }
  }
  async function listMissingResources(id, page = 1, pageSize = 100) {
    const result = (await request('GET', `/runs/${encodeURIComponent(id)}/resources?page=${page}&pageSize=${pageSize}`)).data;
    return { ...result, retry: resourceRetries.get(id) || null };
  }
  async function retryOne(id, item) {
    let update = { number: item.number, id: item.id, expectedVersion: item.version,
      sourceUrl: item.url, state: 'FAILED', path: item.url, errorCode: 'PINGCODE_IMAGE_UNAVAILABLE' };
    try {
      if (!item.url) throw Object.assign(new Error(), { code: 'PINGCODE_IMAGE_INVALID' });
      const result = await readImage(item.url, imagePolicy.maxBytes, imagePolicy.timeoutMs);
      if (typeof result.dataBase64 !== 'string'
        || result.dataBase64.length > Math.ceil(imagePolicy.maxBytes / 3) * 4 + 4)
        throw Object.assign(new Error(), { code: 'PINGCODE_IMAGE_INVALID' });
      const bytes = Buffer.from(result.dataBase64, 'base64');
      const type = imageType(bytes);
      if (!type || type !== result.contentType || !imagePolicy.contentTypes.includes(type)
        || !bytes.length || bytes.length > imagePolicy.maxBytes)
        throw Object.assign(new Error(), { code: 'PINGCODE_IMAGE_INVALID' });
      const hash = crypto.createHash('sha256').update(bytes).digest('hex');
      fs.mkdirSync(imageRoot, { recursive: true });
      try { fs.writeFileSync(path.join(imageRoot, hash), bytes, { flag: 'wx', mode: 0o600 }); }
      catch (error) { if (error.code !== 'EEXIST') throw error; }
      update = { ...update, state: 'READY', path: `assets/${hash}.${extension[type]}`,
        contentType: type, byteCount: bytes.length, errorCode: null };
    } catch (error) {
      update.errorCode = error.code === 'PINGCODE_IMAGE_INVALID' ? error.code : 'PINGCODE_IMAGE_UNAVAILABLE';
    }
    await request('POST', `/runs/${encodeURIComponent(id)}/resources/retry`, update);
    return update.state;
  }
  function retryMissingResources(id) {
    if (resourceRetries.get(id)?.state === 'running') return resourceRetries.get(id);
    const progress = { state: 'running', attempted: 0, repaired: 0, failed: 0 };
    resourceRetries.set(id, progress);
    void (async () => {
      try {
        const first = await listMissingResources(id, 1, 100);
        const items = [...first.items];
        for (let page = 2; items.length < first.total; page++)
          items.push(...(await listMissingResources(id, page, 100)).items);
        for (const item of items) {
          const state = await retryOne(id, item);
          progress.attempted++;
          progress[state === 'READY' ? 'repaired' : 'failed']++;
        }
        progress.state = 'completed';
      } catch (error) {
        progress.state = 'failed'; progress.errorCode = error.code || 'PINGCODE_RESOURCE_UNAVAILABLE';
      }
    })();
    return progress;
  }
  return { listSources, sourceItems, sourceItem, runItems, runItem, unlinkedIrs, createSource, updateSource, setSourceState, deleteSource, source, testSource, getRun, listRuns, previewRun, confirmRun,
    startRun, cancelRun, listMissingResources, retryMissingResources };
}

module.exports = { createPingcodeTaskSyncService, markdownBody };
