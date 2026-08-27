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

module.exports = { DEFAULT_TIMEOUT_MS, MAX_RESPONSE_BYTES, aggregateContexts, fetchJson, isContext, loadPlatformContext, sanitizeContext };
