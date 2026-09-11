const http = require('http');

const DEFAULT_TIMEOUT_MS = 2000;
const MAX_RESPONSE_BYTES = 256 * 1024;

function moduleError(code, message) {
  return { code, message, retryable: true };
}

function isContext(value) {
  return Boolean(
    value && typeof value === 'object'
    && typeof value.schemaVersion === 'string'
    && typeof value.profileId === 'string'
    && typeof value.enterpriseId === 'string'
    && /^sha256:[0-9a-f]{64}$/.test(value.configFingerprint)
  );
}

function sanitizeContext(value) {
  if (!isContext(value)) return null;
  const brand = value.brand && typeof value.brand === 'object' ? value.brand : {};
  return {
    schemaVersion: value.schemaVersion,
    profileId: value.profileId,
    enterpriseId: value.enterpriseId,
    displayName: typeof value.displayName === 'string' ? value.displayName : '',
    brand: {
      enterpriseName: typeof brand.enterpriseName === 'string' ? brand.enterpriseName : '',
      platformName: typeof brand.platformName === 'string' ? brand.platformName : '',
      productName: typeof brand.productName === 'string' ? brand.productName : ''
    },
    capabilities: Array.isArray(value.capabilities) ? value.capabilities.map(item => ({ id: item.id, enabled: item.enabled === true })) : [],
    workspaces: Array.isArray(value.workspaces) ? value.workspaces.map(item => ({ id: item.id, displayName: item.displayName, basePath: item.basePath })) : [],
    connectors: Array.isArray(value.connectors) ? value.connectors.map(item => ({ id: item.id, type: item.type, enabled: item.enabled === true, configured: item.configured === true })) : [],
    configFingerprint: value.configFingerprint
  };
}

function fetchJson(options, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return new Promise(resolve => {
    let settled = false;
    const finish = result => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      resolve(result);
    };
    const request = http.get(options, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        body += chunk;
        if (Buffer.byteLength(body, 'utf8') > MAX_RESPONSE_BYTES) {
          request.destroy();
          finish({ ok: false, error: moduleError('MODULE_UNAVAILABLE', '模块运行上下文响应无效') });
        }
      });
      response.on('end', () => {
        if ((response.statusCode || 500) >= 400) {
          finish({ ok: false, error: moduleError('MODULE_UNAVAILABLE', '模块运行上下文暂时不可用') });
          return;
        }
        try {
          const context = JSON.parse(body);
          const sanitized = sanitizeContext(context);
          if (!sanitized) throw new Error('invalid context');
          finish({ ok: true, context: sanitized });
        } catch {
          finish({ ok: false, error: moduleError('MODULE_UNAVAILABLE', '模块返回了无效的运行上下文') });
        }
      });
    });
    const deadline = setTimeout(() => {
      request.destroy();
      finish({ ok: false, error: moduleError('MODULE_TIMEOUT', '模块运行上下文请求超时') });
    }, timeoutMs);
    request.on('error', () => {
      finish({ ok: false, error: moduleError('MODULE_UNAVAILABLE', '模块运行上下文暂时不可用') });
    });
  });
}

// Read-only platform facts are fetched through the gateway and reduced to counts/statuses.
// Keep this separate from fetchJson: context responses require a profile fingerprint,
// while legacy business endpoints have their own response envelopes.
function fetchProjection(options, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return new Promise(resolve => {
    let settled = false;
    const finish = result => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      resolve(result);
    };
    const request = http.get(options, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        body += chunk;
        if (Buffer.byteLength(body, 'utf8') > MAX_RESPONSE_BYTES) {
          request.destroy();
          finish({ ok: false, error: moduleError('PROJECTION_RESPONSE_TOO_LARGE', '平台投影响应过大') });
        }
      });
      response.on('end', () => {
        if ((response.statusCode || 500) >= 400) {
          finish({ ok: false, error: moduleError('MODULE_UNAVAILABLE', '模块事实投影暂时不可用') });
          return;
        }
        try {
          const value = JSON.parse(body);
          finish({ ok: true, value });
        } catch {
          finish({ ok: false, error: moduleError('PROJECTION_INVALID_RESPONSE', '模块返回了无效的事实投影') });
        }
      });
    });
    const deadline = setTimeout(() => {
      request.destroy();
      finish({ ok: false, error: moduleError('MODULE_TIMEOUT', '模块事实投影请求超时') });
    }, timeoutMs);
    request.on('error', () => finish({ ok: false, error: moduleError('MODULE_UNAVAILABLE', '模块事实投影暂时不可用') }));
  });
}

function projectionSection(result, summarize) {
  if (!result.ok) return { status: 'unavailable', error: result.error };
  return { status: 'ok', data: summarize(result.value) };
}

function assignNumber(target, key, value) {
  if (value !== undefined && value !== null && value !== '') target[key] = Number(value);
  return target;
}

function summarizeWorkbench(value) {
  const counts = value?.counts || {};
  return {
    counts: ['all', 'pending', 'running', 'review', 'failed', 'publishable']
      .reduce((summary, key) => assignNumber(summary, key, counts[key]), {})
  };
}

function summarizeBatches(value) {
  const hasItems = Array.isArray(value?.items) || Array.isArray(value?.data);
  const items = Array.isArray(value?.items) ? value.items : Array.isArray(value?.data) ? value.data : [];
  const summary = assignNumber({}, 'total', value?.total ?? (hasItems ? items.length : undefined));
  if (hasItems) summary.active = items.filter(item => ['running', 'processing'].includes(item?.state)).length;
  return summary;
}

function summarizeDatasets(value) {
  const hasItems = Array.isArray(value?.items);
  const items = hasItems ? value.items : [];
  const summary = assignNumber({}, 'total', value?.total ?? (hasItems ? items.length : undefined));
  if (items[0]?.version) summary.latestVersion = items[0].version;
  return summary;
}

function summarizeIndex(value) {
  const data = value?.data || value || {};
  return assignNumber(
    assignNumber({}, 'knowledgePoints', data.knowledge_points ?? data.knowledgePoints ?? data.total),
    'indexed',
    data.indexed ?? data.indexedDocuments
  );
}

function summarizeDocuments(value) {
  const data = value?.data || {};
  return assignNumber(
    assignNumber({}, 'total', data.total_documents ?? data.totalDocuments),
    'roots',
    data.root_count ?? data.rootCount
  );
}

function summarizeOutlines(value) {
  const items = Array.isArray(value?.data) ? value.data : [];
  return {
    total: items.length,
    items: items.map(item => ({
      id: item.id,
      manualId: item.manualId || null,
      name: item.name,
      productId: item.productId || null,
      businessVersionTags: Array.isArray(item.businessVersionTags) ? item.businessVersionTags : [],
      outlineStructureVersion: item.outlineStructureVersion || null,
      state: item.state,
      nodeCount: Number(item.nodeCount || 0),
      knowledgePointCount: Number(item.knowledgePointCount || 0),
      updatedAt: item.updatedAt || null
    }))
  };
}

async function loadPlatformProjection(options = {}) {
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const fetcher = options.fetcher || fetchProjection;
  const targets = options.targets || {};
  const entries = await Promise.all(Object.entries(targets).map(async ([name, target]) => [name, await fetcher(target, timeoutMs)]));
  const results = Object.fromEntries(entries);
  const sections = {
    workbench: projectionSection(results.workbench || { ok: false, error: moduleError('MODULE_UNAVAILABLE', '工作台不可用') }, summarizeWorkbench),
    materialBatches: projectionSection(results.materialBatches || { ok: false, error: moduleError('MODULE_UNAVAILABLE', '资料批次不可用') }, summarizeBatches),
    datasets: projectionSection(results.datasets || { ok: false, error: moduleError('MODULE_UNAVAILABLE', '知识库不可用') }, summarizeDatasets),
    knowledgeIndex: projectionSection(results.knowledgeIndex || { ok: false, error: moduleError('MODULE_UNAVAILABLE', '知识索引不可用') }, summarizeIndex),
    documents: projectionSection(results.documents || { ok: false, error: moduleError('MODULE_UNAVAILABLE', '文档资产不可用') }, summarizeDocuments),
    outlines: projectionSection(results.outlines || { ok: false, error: moduleError('MODULE_UNAVAILABLE', '大纲管理不可用') }, summarizeOutlines)
  };
  const available = Object.values(sections).filter(section => section.status === 'ok').length;
  const errors = Object.values(sections).filter(section => section.status !== 'ok').map(section => section.error);
  return {
    statusCode: available === 0 ? 503 : 200,
    body: {
      status: available === 0 ? 'unavailable' : errors.length ? 'degraded' : 'ok',
      asOf: new Date().toISOString(),
      source: 'read-only-projection',
      sections,
      errors
    }
  };
}

function moduleProjection(result) {
  return result.ok
    ? { status: 'ok', context: result.context }
    : { status: 'unavailable', error: result.error };
}

function aggregateContexts(documentGeneration, materialProcessing) {
  const available = [documentGeneration, materialProcessing].filter(result => result.ok);
  const modules = {
    documentGeneration: moduleProjection(documentGeneration),
    materialProcessing: moduleProjection(materialProcessing)
  };

  if (available.length === 0) {
    return {
      statusCode: 503,
      body: {
        status: 'unavailable',
        modules,
        errors: [documentGeneration.error, materialProcessing.error]
      }
    };
  }

  const errors = [];
  if (available.length === 1) {
    errors.push(documentGeneration.ok ? materialProcessing.error : documentGeneration.error);
  } else if (documentGeneration.context.configFingerprint !== materialProcessing.context.configFingerprint) {
    errors.push(moduleError('PROFILE_FINGERPRINT_MISMATCH', '两个模块的企业配置版本不一致，请检查部署'));
  }

  return {
    statusCode: 200,
    body: {
      status: errors.length ? 'degraded' : 'ok',
      context: available[0].context,
      modules,
      errors
    }
  };
}

async function loadPlatformContext(options = {}) {
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const fetcher = options.fetcher || fetchJson;
  const [documentGeneration, materialProcessing] = await Promise.all([
    fetcher(options.documentGeneration, timeoutMs),
    fetcher(options.materialProcessing, timeoutMs)
  ]);
  return aggregateContexts(documentGeneration, materialProcessing);
}

module.exports = { DEFAULT_TIMEOUT_MS, MAX_RESPONSE_BYTES, aggregateContexts, fetchJson, fetchProjection, isContext, loadPlatformContext, loadPlatformProjection, sanitizeContext };
