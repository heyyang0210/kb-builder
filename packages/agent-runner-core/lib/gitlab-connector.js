const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { CONFIG_PATHS } = require('./config-registry');

const DEFAULT_CONFIG_PATH = CONFIG_PATHS.gitlabConnections;

class GitLabConnectorError extends Error {
  constructor(code, message, status = 400, details = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function readConfig(filePath = DEFAULT_CONFIG_PATH) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return {
      connections: Array.isArray(parsed.connections) ? parsed.connections : [],
      mappings: Array.isArray(parsed.mappings) ? parsed.mappings : [],
      idempotency: Array.isArray(parsed.idempotency) ? parsed.idempotency : [],
      audit: Array.isArray(parsed.audit) ? parsed.audit : []
    };
  } catch (error) {
    if (error.code === 'ENOENT') return { connections: [], mappings: [], idempotency: [], audit: [] };
    throw new GitLabConnectorError('GITLAB_CONFIG_UNAVAILABLE', 'GitLab 配置不可用', 503);
  }
}

function writeConfig(value, filePath = DEFAULT_CONFIG_PATH) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temp = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temp, filePath);
}

function transaction(filePath, mutate) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const lockPath = `${filePath}.lock`;
  let descriptor;
  try { descriptor = fs.openSync(lockPath, 'wx', 0o600); }
  catch (error) { throw new GitLabConnectorError('GITLAB_CONFIG_BUSY', 'GitLab 配置正在更新，请稍后重试', 409); }
  try {
    const config = readConfig(filePath);
    const result = mutate(config);
    writeConfig(config, filePath);
    return result;
  } finally {
    fs.closeSync(descriptor);
    fs.unlinkSync(lockPath);
  }
}

function sanitizeConnection(connection) {
  if (!connection) return null;
  const { credentialRef, ...safe } = connection;
  const credentialConfigured = Boolean(credentialRef || connection.credentialConfigured);
  const authMode = connection.authMode || (credentialConfigured ? 'service_account' : 'user_oauth');
  const purpose = connection.purpose || 'read';
  const managementStatus = connection.status === 'inactive' ? 'disabled' : 'active';
  const verificationStatus = connection.lastVerification?.status || 'pending';
  return {
    ...safe,
    baseUrl: connection.baseUrl || connection.host,
    projectPath: connection.projectPath || connection.project,
    authMode,
    purpose,
    credentialConfigured,
    lastVerification: connection.lastVerification || null,
    managementStatus,
    verificationStatus,
    status: managementStatus === 'disabled' ? 'disabled' : verificationStatus,
  };
}

function upsertConnection(input, filePath = DEFAULT_CONFIG_PATH, audit = {}) {
  const name = String(input.name || input.id || 'default').trim();
  const host = String(input.baseUrl || input.host || '').trim().replace(/\/$/, '');
  const project = String(input.projectPath || input.project || '').trim();
  if (!host || !project) throw new GitLabConnectorError('GITLAB_CONFIG_INVALID', 'GitLab 地址和项目不能为空');
  let parsed;
  try { parsed = new URL(host); } catch (_error) { throw new GitLabConnectorError('GITLAB_CONFIG_INVALID', 'GitLab 地址格式不正确'); }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new GitLabConnectorError('GITLAB_CONFIG_INVALID', '仅支持 HTTP 或 HTTPS 地址');
  if (parsed.username || parsed.password) throw new GitLabConnectorError('GITLAB_CONFIG_INVALID', 'GitLab 地址不能包含账号或密码');
  const allowedHosts = new Set(String(process.env.KNOWLEDGE_CENTER_GITLAB_ALLOWED_HOSTS || 'git-tools.yasdb.com').split(',').map(value => value.trim()).filter(Boolean));
  if (!allowedHosts.has(parsed.hostname)) throw new GitLabConnectorError('GITLAB_HOST_NOT_ALLOWED', 'GitLab 地址不在平台允许列表中', 403);
  const mode = ['disabled', 'sandbox', 'production'].includes(input.mode)
    ? input.mode
    : (input.baseUrl || input.projectPath ? 'production' : 'disabled');
  if (mode === 'production' && parsed.protocol !== 'https:') throw new GitLabConnectorError('GITLAB_HTTPS_REQUIRED', '生产读取模式必须使用 HTTPS', 400);
  const productionProjects = new Set(String(process.env.KNOWLEDGE_CENTER_GITLAB_PRODUCTION_PROJECTS || 'git-tools.yasdb.com/cod-doc/yasdoc').split(',').map(value => value.trim()).filter(Boolean));
  if (mode === 'sandbox' && productionProjects.has(`${parsed.hostname}/${project}`)) throw new GitLabConnectorError('GITLAB_SANDBOX_PROJECT_REQUIRED', '隔离验证模式不允许连接正式手册仓库', 409);
  return transaction(filePath, config => {
    if (audit.idempotencyKey && config.idempotency.some(item => item.key === audit.idempotencyKey)) throw new GitLabConnectorError('IDEMPOTENCY_REPLAY', '该配置请求已处理', 409);
    const existing = config.connections.find(item => item.name === name || item.id === input.id);
    const authMode = ['user_oauth', 'service_account'].includes(input.authMode) ? input.authMode : (existing?.authMode || (input.credentialRef || existing?.credentialRef ? 'service_account' : 'user_oauth'));
    const credentialRef = authMode === 'service_account' ? String(input.credentialRef || existing?.credentialRef || '').trim() || null : null;
    if (authMode === 'service_account' && !credentialRef) throw new GitLabConnectorError('GITLAB_CREDENTIAL_REF_REQUIRED', '服务账号认证必须配置凭证引用名');
    const connection = {
      id: existing?.id || `gitlab-${crypto.randomUUID()}`, name, host, project,
      pathPrefix: String(input.pathPrefix || '').replace(/^\/+|\/+$/g, ''),
      defaultBranch: String(input.defaultBranch || 'master').trim(),
      mode,
      credentialRef,
      authMode,
      purpose: ['read', 'read_write'].includes(input.purpose) ? input.purpose : (existing?.purpose || 'read'),
      lastVerification: existing?.lastVerification || null,
      status: existing?.status || 'active', updatedAt: new Date().toISOString()
    };
    if (existing) Object.assign(existing, connection); else config.connections.push(connection);
    if (audit.idempotencyKey) config.idempotency.push({ key: audit.idempotencyKey, at: connection.updatedAt });
    config.audit.push({ action: 'GITLAB_CONNECTION_UPSERT', connectionId: connection.id, operatorId: audit.operatorId || null, at: connection.updatedAt });
    return sanitizeConnection(connection);
  });
}

function recordVerification(id, verification, filePath = DEFAULT_CONFIG_PATH, audit = {}) {
  return transaction(filePath, config => {
    const connection = config.connections.find(item => item.id === id || item.name === id);
    if (!connection) throw new GitLabConnectorError('GITLAB_CONNECTION_NOT_FOUND', 'GitLab 仓库连接不存在', 404);
    connection.lastVerification = verification;
    connection.updatedAt = new Date().toISOString();
    config.audit.push({ action: 'GITLAB_CONNECTION_VERIFY', connectionId: connection.id, operatorId: audit.operatorId || null, at: connection.updatedAt, result: verification.status });
    return sanitizeConnection(connection);
  });
}

function setConnectionStatus(id, status, filePath = DEFAULT_CONFIG_PATH, audit = {}) {
  if (!['active', 'inactive'].includes(status)) throw new GitLabConnectorError('GITLAB_STATUS_INVALID', '连接状态不合法');
  return transaction(filePath, config => {
    const connection = config.connections.find(item => item.id === id || item.name === id);
    if (!connection) throw new GitLabConnectorError('GITLAB_CONNECTION_NOT_FOUND', 'GitLab 仓库连接不存在', 404);
    connection.status = status;
    connection.updatedAt = new Date().toISOString();
    config.audit.push({ action: status === 'active' ? 'GITLAB_CONNECTION_ENABLED' : 'GITLAB_CONNECTION_DISABLED', connectionId: connection.id, operatorId: audit.operatorId || null, at: connection.updatedAt });
    return sanitizeConnection(connection);
  });
}

function normalizePath(value) {
  const clean = String(value || '').replace(/^\/+|\/+$/g, '');
  if (!clean || clean.split('/').some(part => !part || part === '.' || part === '..')) throw new GitLabConnectorError('GITLAB_PATH_INVALID', '仓库路径不合法');
  return clean;
}

function normalizePaths(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(normalizePath))];
}

function upsertMapping(handbookId, input, filePath = DEFAULT_CONFIG_PATH, audit = {}) {
  if (!handbookId || !input.connectionId) throw new GitLabConnectorError('GITLAB_MAPPING_INVALID', '手册和仓库连接不能为空');
  return transaction(filePath, config => {
    if (!config.connections.some(item => item.id === input.connectionId)) throw new GitLabConnectorError('GITLAB_CONNECTION_NOT_FOUND', 'GitLab 仓库连接不存在', 404);
    if (audit.idempotencyKey && config.idempotency.some(item => item.key === audit.idempotencyKey)) throw new GitLabConnectorError('IDEMPOTENCY_REPLAY', '该配置请求已处理', 409);
    const connection = config.connections.find(item => item.id === input.connectionId);
    const zhPaths = normalizePaths(input.zhPaths);
    const enPaths = normalizePaths(input.enPaths);
    const prefix = connection.pathPrefix;
    if (prefix && [...zhPaths, ...enPaths].some(item => item !== prefix && !item.startsWith(`${prefix}/`))) throw new GitLabConnectorError('GITLAB_PATH_FORBIDDEN', '手册映射路径超出连接允许范围', 403);
    const selectedBranch = String(input.defaultBranch || input.selectedBranch || 'master').trim();
    const enabledBranches = [...new Set((Array.isArray(input.enabledBranches) ? input.enabledBranches : [])
      .map(value => String(value || '').trim()).filter(Boolean))];
    if (!enabledBranches.includes(selectedBranch)) enabledBranches.unshift(selectedBranch);
    const mapping = {
      handbookId, connectionId: input.connectionId,
      defaultBranch: selectedBranch,
      enabledBranches,
      zhPaths, enPaths,
      updatedAt: new Date().toISOString()
    };
    const existing = config.mappings.find(item => item.handbookId === handbookId);
    if (existing) Object.assign(existing, mapping); else config.mappings.push(mapping);
    if (audit.idempotencyKey) config.idempotency.push({ key: audit.idempotencyKey, at: mapping.updatedAt });
    config.audit.push({ action: 'GITLAB_MAPPING_UPSERT', handbookId, connectionId: mapping.connectionId, operatorId: audit.operatorId || null, at: mapping.updatedAt });
    return mapping;
  });
}

function findMapping(handbookId, filePath = DEFAULT_CONFIG_PATH) {
  const config = readConfig(filePath);
  const mapping = config.mappings.find(item => item.handbookId === handbookId);
  if (!mapping) throw new GitLabConnectorError('GITLAB_MAPPING_NOT_FOUND', '该手册尚未配置 GitLab 内容映射', 404);
  const connection = config.connections.find(item => item.id === mapping.connectionId);
  if (!connection) throw new GitLabConnectorError('GITLAB_CONNECTION_NOT_FOUND', 'GitLab 仓库连接不存在', 404);
  return { mapping, connection };
}

function findConnection(id, filePath = DEFAULT_CONFIG_PATH) {
  const config = readConfig(filePath);
  const item = config.connections.find(c => c.id === id || c.name === id);
  if (!item) throw new GitLabConnectorError('GITLAB_CONNECTION_NOT_FOUND', 'GitLab 仓库连接不存在', 404);
  return item;
}

function tokenFor(connection) {
  if (!connection.credentialRef) throw new GitLabConnectorError('GITLAB_OAUTH_REQUIRED', '请先连接 GitLab 账号', 401);
  const key = `GITLAB_TOKEN_${connection.credentialRef.replace(/[^A-Za-z0-9_]/g, '_')}`;
  const token = process.env[key];
  if (!token) throw new GitLabConnectorError('GITLAB_CREDENTIAL_UNAVAILABLE', 'GitLab 凭证引用未解析，请由管理员配置安全凭证', 401);
  return token;
}

function ensureEnabled(connection) {
  if (connection.status === 'inactive') throw new GitLabConnectorError('GITLAB_CONNECTION_INACTIVE', 'GitLab 连接已停用，请联系平台管理员', 409);
  if (connection.mode === 'disabled') throw new GitLabConnectorError('GITLAB_CONNECTOR_DISABLED', 'GitLab 连接器当前未启用', 409);
}

async function request(connection, apiPath, options = {}) {
  ensureEnabled(connection);
  const oauthToken = options.accessToken || null;
  const token = oauthToken || tokenFor(connection);
  const url = `${connection.host}/api/v4${apiPath}`;
  let response;
  try {
    const headers = { Accept: 'application/json' };
    if (oauthToken) headers.Authorization = `Bearer ${oauthToken}`;
    else headers['PRIVATE-TOKEN'] = token;
    response = await fetch(url, { headers });
  } catch (error) {
    throw new GitLabConnectorError('GITLAB_UNAVAILABLE', 'GitLab 服务暂时不可达', 502, { cause: error.message });
  }
  const text = await response.text();
  let body; try { body = JSON.parse(text); } catch (_error) { body = null; }
  if (!response.ok) {
    const code = response.status === 401 ? 'GITLAB_UNAUTHORIZED' : response.status === 403 ? 'GITLAB_FORBIDDEN' : 'GITLAB_REQUEST_FAILED';
    throw new GitLabConnectorError(code, body?.message || `GitLab 请求失败（${response.status}）`, response.status, { upstreamStatus: response.status });
  }
  return body;
}

function projectPath(connection) { return encodeURIComponent(connection.project); }

async function listBranches(connection, options = {}) {
  const result = [];
  for (let page = 1; page <= 20; page += 1) {
    const batch = await request(connection, `/projects/${projectPath(connection)}/repository/branches?per_page=100&page=${page}`, options);
    result.push(...batch);
    if (result.length > 2000) throw new GitLabConnectorError('GITLAB_BRANCHES_TOO_LARGE', '仓库分支数量超过单次读取上限', 413);
    if (batch.length < 100) break;
  }
  return result.map(item => ({ name: item.name, protected: Boolean(item.protected), commitSha: item.commit?.id || null, webUrl: item.web_url || null }));
}

function encodedPath(value) {
  const clean = normalizePath(value);
  return encodeURIComponent(clean);
}

async function listTree(connection, ref, treePath = '', options = {}) {
  const result = [];
  for (let page = 1; page <= 20; page += 1) {
    const query = `?ref=${encodeURIComponent(ref || connection.defaultBranch)}&recursive=true&per_page=100&page=${page}`;
    const suffix = treePath ? `&path=${encodeURIComponent(treePath)}` : '';
    const batch = await request(connection, `/projects/${projectPath(connection)}/repository/tree${query}${suffix}`, options);
    result.push(...batch);
    if (result.length > 2000) throw new GitLabConnectorError('GITLAB_TREE_TOO_LARGE', '仓库目录超过单次读取上限', 413);
    if (batch.length < 100) break;
  }
  return result.map(item => ({ name: item.name, path: item.path, type: item.type, id: item.id, mode: item.mode }));
}

async function readFile(connection, ref, filePath, options = {}) {
  const result = await request(connection, `/projects/${projectPath(connection)}/repository/files/${encodedPath(filePath)}?ref=${encodeURIComponent(ref || connection.defaultBranch)}`, options);
  const extension = path.extname(filePath).toLowerCase();
  const allowed = new Set(['.md', '.markdown', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp']);
  if (!allowed.has(extension)) throw new GitLabConnectorError('GITLAB_FILE_TYPE_NOT_ALLOWED', '仅允许读取 Markdown 和图片资源', 415);
  const buffer = result.encoding === 'base64' ? Buffer.from(result.content || '', 'base64') : Buffer.from(String(result.content || ''));
  if (buffer.length > 5 * 1024 * 1024) throw new GitLabConnectorError('GITLAB_FILE_TOO_LARGE', '仓库文件超过 5MB 读取上限', 413);
  const text = ['.md', '.markdown', '.svg'].includes(extension);
  return { path: result.file_path || filePath, ref: ref || connection.defaultBranch, blobId: result.blob_id || null, commitId: result.commit_id || null, content: text ? buffer.toString('utf8') : buffer.toString('base64'), encoding: text ? 'utf-8' : 'base64', size: buffer.length };
}


async function listCommits(connection, ref, options = {}) {
  const result = [];
  for (let page = 1; page <= 5; page += 1) {
    const query = `?ref_name=${encodeURIComponent(ref || connection.defaultBranch)}&per_page=20&page=${page}`;
    const batch = await request(connection, `/projects/${projectPath(connection)}/repository/commits${query}`, options);
    result.push(...batch);
    if (result.length >= 100 || batch.length < 20) break;
  }
  return result.map(item => ({
    sha: item.id || item.short_id,
    shortSha: item.short_id,
    title: item.title,
    message: item.message,
    authorName: item.author_name,
    authoredDate: item.authored_date,
    webUrl: item.web_url || null,
  }));
}

function authorizeMappedRequest(mapping, ref, language, requestedPath = '') {
  if (!mapping.enabledBranches.includes(ref)) throw new GitLabConnectorError('GITLAB_BRANCH_NOT_ALLOWED', '该分支不属于当前手册映射', 403);
  const roots = language === 'en' ? mapping.enPaths : mapping.zhPaths;
  const raw = String(requestedPath || '').replace(/^\/+|\/+$/g, '');
  if (raw.split('/').some(part => !part || part === '.' || part === '..')) throw new GitLabConnectorError('GITLAB_PATH_INVALID', '仓库路径不合法', 400);
  const clean = raw;
  if (!roots.length) throw new GitLabConnectorError('GITLAB_LANGUAGE_NOT_MAPPED', '该语言尚未配置仓库内容路径', 404);
  if (clean && !roots.some(root => clean === root || clean.startsWith(`${root}/`))) throw new GitLabConnectorError('GITLAB_PATH_FORBIDDEN', '请求路径不在手册映射范围内', 403);
  return clean;
}

module.exports = { GitLabConnectorError, readConfig, writeConfig, sanitizeConnection, upsertConnection, recordVerification, setConnectionStatus, upsertMapping, findMapping, findConnection, listBranches, listTree, readFile, listCommits, authorizeMappedRequest, request };
