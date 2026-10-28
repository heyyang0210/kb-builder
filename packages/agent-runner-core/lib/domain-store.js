const { execFileSync } = require('child_process');

class DomainStoreError extends Error {
  constructor(code, message, status = 500, details) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

class DomainStore {
  constructor(options = {}) {
    this.baseUrl = new URL(options.baseUrl || process.env.YASDB_STORAGE_URL || 'http://127.0.0.1:14210');
    this.timeoutSeconds = Math.max(1, Math.ceil(Number(options.timeoutMs || process.env.YASDB_STORAGE_TIMEOUT_MS || 15000) / 1000));
    this.curl = options.curl || process.env.KNOWLEDGE_STORAGE_CURL || (process.platform === 'win32' ? 'curl.exe' : 'curl');
  }

  request(method, pathname, body, extraHeaders = {}) {
    const target = new URL(pathname, this.baseUrl).toString();
    const args = ['-sS', '--max-time', String(this.timeoutSeconds), '-X', method];
    for (const [name, value] of Object.entries(extraHeaders)) {
      if (value !== undefined && value !== null && String(value).length > 0) {
        args.push('-H', `${name}: ${value}`);
      }
    }
    if (body !== undefined) {
      args.push('-H', 'Content-Type: application/json; charset=utf-8', '--data-binary', '@-');
    }
    args.push(target);
    try {
      const output = execFileSync(this.curl, args, {
        input: body === undefined ? undefined : JSON.stringify(body),
        encoding: 'utf8',
        maxBuffer: 32 * 1024 * 1024,
        timeout: this.timeoutSeconds * 1000 + 1000,
        env: { ...process.env, LD_LIBRARY_PATH: '' },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const parsed = JSON.parse(output || '{}');
      if (parsed && parsed.success === false) {
        throw new DomainStoreError(
          parsed.error?.code || 'DOMAIN_REQUEST_FAILED',
          parsed.error?.message || '领域存储请求失败',
          parsed.error?.status || this.statusForCode(parsed.error?.code),
          parsed.error?.details,
        );
      }
      return parsed;
    } catch (error) {
      if (error instanceof DomainStoreError) throw error;
      const stdout = String(error.stdout || '').trim();
      let response = null;
      try { response = JSON.parse(stdout); } catch (_) { response = null; }
      throw new DomainStoreError(
        response?.error?.code || 'DOMAIN_UNAVAILABLE',
        response?.error?.message || 'YashanDB 领域存储服务不可用',
        response?.error?.status || this.statusForCode(response?.error?.code) || 503,
        response?.error?.details || { cause: error.message },
      );
    }
  }

  async requestAsync(method, pathname, body, extraHeaders = {}) {
    const target = new URL(pathname, this.baseUrl).toString();
    const headers = { ...extraHeaders };
    if (body !== undefined) headers['Content-Type'] = 'application/json; charset=utf-8';
    try {
      const response = await fetch(target, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutSeconds * 1000),
      });
      const parsed = JSON.parse(await response.text() || '{}');
      if (!response.ok || parsed?.success === false) {
        throw new DomainStoreError(
          parsed?.error?.code || 'DOMAIN_REQUEST_FAILED',
          parsed?.error?.message || '领域存储请求失败',
          parsed?.error?.status || (response.ok ? this.statusForCode(parsed?.error?.code) : response.status),
          parsed?.error?.details,
        );
      }
      return parsed;
    } catch (error) {
      if (error instanceof DomainStoreError) throw error;
      throw new DomainStoreError('DOMAIN_UNAVAILABLE', 'YashanDB 领域存储服务不可用', 503, { cause: error.message });
    }
  }

  statusForCode(code) {
    if (['OUTLINE_DELETED', 'OUTLINE_RESTORE_CONFLICT', 'OUTLINE_PURGE_REFERENCED', 'OUTLINE_PURGE_UNAVAILABLE'].includes(code)) return 409;
    if (code === 'OUTLINE_PURGE_CONFIRM_REQUIRED') return 422;
    if (code === 'OUTLINE_NOT_FOUND' || code === 'ASSET_NOT_FOUND') return 404;
    if (code === 'BUILD_TASK_NOT_FOUND' || code === 'BUILD_TASK_ITEM_NOT_FOUND') return 404;
    if (code === 'REVISION_CONFLICT' || code === 'OUTLINE_VERSION_CONFLICT' || code === 'OUTLINE_EDIT_CONFLICT' || code === 'OUTLINE_GOVERNANCE_CONFLICT' || code === 'OUTLINE_IMMUTABLE' || code === 'PUBLISHED_CONTENT_LOCKED'
      || code === 'CAS_LOGIN_NAME_CONFLICT' || code === 'CAS_LOGIN_BIND_CONFLICT'
      || code === 'CAS_PRINCIPAL_NOT_FOUND' || code === 'CAS_PRINCIPAL_AMBIGUOUS') return 409;
    if (code === 'OUTLINE_DOCUMENT_REQUIRED' || code === 'INVALID_DOMAIN_PAYLOAD' || code === 'OUTLINE_RESPONSIBILITY_REQUIRED' || code === 'PUBLISHED_ASSIGNMENT_REQUIRED' || code === 'BUILD_TASK_ASSIGNEE_INVALID') return 422;
    return 503;
  }

  readHandbooks() {
    const result = this.request('GET', '/v1/domain/handbooks');
    return result.data || result;
  }

  async readHandbooksAsync() {
    const result = await this.requestAsync('GET', '/v1/domain/handbooks');
    return result.data || result;
  }

  writeHandbooksSnapshot(payload) {
    const result = this.request('PUT', '/v1/domain/handbooks/snapshot', payload);
    return result.data || result;
  }

  async readPrincipalsAsync(query = {}) {
    const queryString = new URLSearchParams(Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== '')).toString();
    const result = await this.requestAsync('GET', `/v1/domain/principals${queryString ? `?${queryString}` : ''}`);
    return result.data || result;
  }

  async createPrincipal(payload) {
    const result = await this.requestAsync('POST', '/v1/domain/principals', payload);
    return result.data || result;
  }

  async updatePrincipal(principalId, payload) {
    const result = await this.requestAsync('PATCH', `/v1/domain/principals/${encodeURIComponent(principalId)}`, payload);
    return result.data || result;
  }

  async importPrincipals(payload) {
    const result = await this.requestAsync('POST', '/v1/domain/principals/import', payload);
    return result.data || result;
  }

  async syncCasPrincipal(payload) {
    const result = await this.requestAsync('POST', '/v1/domain/principals/cas-login', payload);
    return result.data || result;
  }

  readOutlines() {
    const result = this.request('GET', '/v1/domain/outlines');
    return result.data || result;
  }

  async readOutlinesAsync() {
    const result = await this.requestAsync('GET', '/v1/domain/outlines');
    return result.data || result;
  }

  async readOutlineCatalogAsync() {
    const result = await this.requestAsync('GET', '/v1/domain/outlines/catalog');
    return result.data || result;
  }

  writeOutlinesSnapshot(payload) {
    const result = this.request('PUT', '/v1/domain/outlines/snapshot', payload);
    return result.data || result;
  }

  deleteOutline(id, payload = {}) {
    const result = this.request('DELETE', `/v1/domain/outlines/${encodeURIComponent(id)}`, payload);
    return result.data || result;
  }

  outlineLifecycle(id, action, payload = {}) {
    const result = this.request(action === 'purge-preflight' ? 'GET' : 'POST', `/v1/domain/outlines/${encodeURIComponent(id)}/${action}`, action === 'purge-preflight' ? undefined : payload);
    return result.data || result;
  }

  readTechDomains() {
    const result = this.request('GET', '/v1/domain/tech-domains');
    return result.data || result;
  }

  readTeamGroups(query = {}) {
    const queryString = new URLSearchParams(Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== '')).toString();
    const result = this.request('GET', `/v1/platform/team-groups${queryString ? `?${queryString}` : ''}`);
    return result.data || result;
  }

  readTeamGroup(groupId) {
    const result = this.request('GET', `/v1/platform/team-groups/${encodeURIComponent(groupId)}`);
    return result.data || result;
  }

  createTeamGroup(payload, idempotencyKey) {
    const result = this.request('POST', '/v1/platform/team-groups', payload, { 'Idempotency-Key': idempotencyKey });
    return result.data || result;
  }

  replaceTeamRoster(groupId, payload, rowVersion, idempotencyKey) {
    const result = this.request('PUT', `/v1/platform/team-groups/${encodeURIComponent(groupId)}/roster`, payload, {
      'If-Match': String(rowVersion), 'Idempotency-Key': idempotencyKey,
    });
    return result.data || result;
  }

  readOutlineGovernance(outlineId) {
    const result = this.request('GET', `/v1/domain/outlines/${encodeURIComponent(outlineId)}/governance`);
    return result.data || result;
  }

  async readOutlineDirectoryAsync(outlineId) {
    const result = await this.requestAsync('GET', `/v1/domain/outlines/${encodeURIComponent(outlineId)}/directory`);
    return result.data || result;
  }

  async readOutlineGovernanceAsync(outlineId) {
    const result = await this.requestAsync('GET', `/v1/domain/outlines/${encodeURIComponent(outlineId)}/governance`);
    return result.data || result;
  }

  writeOutlineGovernance(outlineId, payload) {
    const result = this.request('PUT', `/v1/domain/outlines/${encodeURIComponent(outlineId)}/governance`, payload);
    return result.data || result;
  }

  publishOutline(outlineId, payload = {}) {
    const result = this.request('POST', `/v1/domain/outlines/${encodeURIComponent(outlineId)}/publish`, payload);
    return result.data || result;
  }

  readBuildTasks(query = {}) {
    const queryString = new URLSearchParams(Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== '')).toString();
    const result = this.request('GET', `/v1/domain/build-tasks${queryString ? `?${queryString}` : ''}`);
    return result.data || result;
  }

  readBuildTask(taskId) {
    const result = this.request('GET', `/v1/domain/build-tasks/${encodeURIComponent(taskId)}`);
    return result.data || result;
  }

  updateBuildTaskItem(taskId, itemId, payload) {
    const result = this.request('PATCH', `/v1/domain/build-tasks/${encodeURIComponent(taskId)}/items/${encodeURIComponent(itemId)}`, payload);
    return result.data || result;
  }

  readPlatformAuthUsers() {
    const result = this.request('GET', '/v1/platform/auth/users');
    return result.data || result;
  }

  async readPlatformAuthUsersAsync() {
    const result = await this.requestAsync('GET', '/v1/platform/auth/users');
    return result.data || result;
  }

  readPlatformAuthUser(userKey) {
    const result = this.request('GET', `/v1/platform/auth/users/${encodeURIComponent(userKey)}`);
    return result.data || result;
  }

  async readPlatformAuthUserAsync(userKey) {
    const result = await this.requestAsync('GET', `/v1/platform/auth/users/${encodeURIComponent(userKey)}`);
    return result.data || result;
  }

  upsertPlatformCasUser(payload) {
    const result = this.request('POST', '/v1/platform/auth/users/cas', payload);
    return result.data || result;
  }

  async upsertPlatformCasUserAsync(payload) {
    const result = await this.requestAsync('POST', '/v1/platform/auth/users/cas', payload);
    return result.data || result;
  }

  replacePlatformUserRoles(userKey, roles, rowVersion, idempotencyKey, actor) {
    const result = this.request('PATCH', `/v1/platform/auth/users/${encodeURIComponent(userKey)}/roles`, { roles, actor }, {
      'If-Match': String(rowVersion), 'Idempotency-Key': idempotencyKey,
    });
    return result.data || result;
  }

  async replacePlatformUserRolesAsync(userKey, roles, rowVersion, idempotencyKey, actor) {
    const result = await this.requestAsync('PATCH', `/v1/platform/auth/users/${encodeURIComponent(userKey)}/roles`, { roles, actor }, {
      'If-Match': String(rowVersion), 'Idempotency-Key': idempotencyKey,
    });
    return result.data || result;
  }

  readPlatformGitLabConnections() {
    const result = this.request('GET', '/v1/platform/gitlab/connections');
    return result.data || result;
  }

  readPlatformGitLabConnection(key) {
    const result = this.request('GET', `/v1/platform/gitlab/connections/${encodeURIComponent(key)}`);
    return result.data || result;
  }

  async readPlatformGitLabConnectionAsync(key) {
    const result = await this.requestAsync('GET', `/v1/platform/gitlab/connections/${encodeURIComponent(key)}`);
    return result.data || result;
  }

  upsertPlatformGitLabConnection(payload, rowVersion, idempotencyKey, actor) {
    const headers = { 'Idempotency-Key': idempotencyKey, ...(rowVersion != null ? { 'If-Match': String(rowVersion) } : {}) };
    const result = this.request('PUT', '/v1/platform/gitlab/connections', { ...payload, actor }, headers);
    return result.data || result;
  }

  setPlatformGitLabConnectionState(key, status, rowVersion, idempotencyKey, actor) {
    const result = this.request('PATCH', `/v1/platform/gitlab/connections/${encodeURIComponent(key)}/state`, { status, actor }, {
      'If-Match': String(rowVersion), 'Idempotency-Key': idempotencyKey,
    });
    return result.data || result;
  }

  readPlatformGitLabMapping(manualCode) {
    const result = this.request('GET', `/v1/platform/gitlab/mappings/${encodeURIComponent(manualCode)}`);
    return result.data || result;
  }

  async readPlatformGitLabMappingAsync(manualCode) {
    const result = await this.requestAsync('GET', `/v1/platform/gitlab/mappings/${encodeURIComponent(manualCode)}`);
    return result.data || result;
  }

  replacePlatformGitLabMapping(manualCode, payload, rowVersion, idempotencyKey, actor) {
    const result = this.request('PUT', `/v1/platform/gitlab/mappings/${encodeURIComponent(manualCode)}`, { ...payload, actor }, {
      'Idempotency-Key': idempotencyKey, ...(rowVersion != null ? { 'If-Match': String(rowVersion) } : {}),
    });
    return result.data || result;
  }
}

function createDomainStore(options = {}) {
  return new DomainStore(options);
}

module.exports = {
  DomainStore,
  DomainStoreError,
  createDomainStore,
};
