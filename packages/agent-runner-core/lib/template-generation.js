const http = require('http');
const { createTemplateStore, hash } = require('./template-store');
const { isPlatformAdmin } = require('./knowledge-asset-utils');

function failure(status, code, message) { return Object.assign(new Error(message), { status, code }); }

// Always ask the authentication authority. Request bodies and proxy headers are not identities.
function readSession(req, options = {}) {
  return new Promise((resolve, reject) => {
    const request = http.request({
      hostname: options.host || process.env.KNOWLEDGE_CENTER_AUTH_HOST || '127.0.0.1',
      port: options.port || Number(process.env.KNOWLEDGE_CENTER_AUTH_PORT || 4200),
      path: '/knowledge-center/api/auth/session', method: 'GET',
      headers: { cookie: req.headers.cookie || '', accept: 'application/json' },
      timeout: options.timeout || 5000,
    }, response => {
      let raw = '';
      response.on('error', () => reject(failure(503, 'AUTH_UNAVAILABLE', '认证服务不可用，请稍后重试')));
      response.on('data', chunk => { raw += chunk; });
      response.on('end', () => {
        if (response.statusCode === 401 || response.statusCode === 403) return resolve(null);
        if (response.statusCode !== 200) return reject(failure(503, 'AUTH_UNAVAILABLE', '认证服务不可用，请稍后重试'));
        try { resolve(JSON.parse(raw).content || null); }
        catch (_) { reject(failure(503, 'AUTH_UNAVAILABLE', '认证服务返回无效响应')); }
      });
    });
    request.on('timeout', () => request.destroy());
    request.on('error', () => reject(failure(503, 'AUTH_UNAVAILABLE', '认证服务不可用，请稍后重试')));
    request.end();
  });
}

async function freezeTemplateForRequest(req, options = {}) {
  const input = req.body || {};
  const reference = input.templateId || input.template;
  if (!reference) return {};
  if (!req.headers.cookie) throw failure(401, 'AUTH_REQUIRED', '请登录后继续');
  const session = await readSession(req, options.auth);
  if (!session) throw failure(401, 'AUTH_REQUIRED', '请登录后继续');
  const actions = session.allowedActions || session.user?.allowedActions || [];
  if (!actions.includes('template:read') && !isPlatformAdmin(session)) throw failure(403, 'TEMPLATE_PERMISSION_DENIED', '没有模板读取权限');
  if (typeof reference !== 'string') throw failure(400, 'TEMPLATE_INVALID_REFERENCE', '模板引用必须是 ID 或文件路径');
  const snapshot = (options.store || createTemplateStore()).resolveForGeneration(reference);
  // Explicit allowlist: never persist client-supplied version, hash, source or body.
  return {
    templateId: snapshot.templateId, templateVersion: snapshot.templateVersion,
    templateHash: snapshot.templateHash, templateSource: snapshot.templateSource,
    templateContent: snapshot.templateContent,
  };
}

function templateMetadata(input = {}) {
  if (!input.templateId || !input.templateVersion) return {};
  return { templateId: input.templateId, templateVersion: input.templateVersion, templateHash: input.templateHash, templateSource: input.templateSource };
}

function frozenTemplateContent(input = {}) {
  if (!input.templateId || !input.templateVersion) return null;
  if (input.templateSource !== 'database' || typeof input.templateContent !== 'string' || hash(input.templateContent) !== input.templateHash) {
    throw failure(409, 'TEMPLATE_SNAPSHOT_INVALID', '任务模板快照不完整或哈希不匹配');
  }
  return input.templateContent;
}

async function persistTemplateSnapshot(taskId, input, processStore) {
  if (frozenTemplateContent(input) === null) return;
  const store = processStore || new (require('./process-store'))(taskId);
  await store.save('01-input-preparation', 'template-snapshot.json', { ...templateMetadata(input), templateContent: input.templateContent }, true);
}

module.exports = { freezeTemplateForRequest, frozenTemplateContent, templateMetadata, persistTemplateSnapshot };
