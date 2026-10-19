const contextEndpoint = '/knowledge-center/api/platform/context';
const overviewEndpoint = '/knowledge-center/api/platform/overview';
const outlineEndpoint = '/knowledge-center/api/outline/governance';
const handbooksEndpoint = '/knowledge-center/api/assets/handbooks';
// 用户角色由认证服务统一维护；平台管理仅提供同源代理入口。
const permissionsEndpoint = '/knowledge-center/api/auth/users';
const principalsEndpoint = '/knowledge-center/api/platform/principals';
const teamGroupsEndpoint = '/knowledge-center/api/platform/team-groups';
const databaseConnectionEndpoint = '/knowledge-center/api/platform/database-connection';
const templatesEndpoint = '/knowledge-center/api/templates';
export const loadTemplates = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return getJson(query ? `${templatesEndpoint}?${query}` : templatesEndpoint);
};
export const loadDatabaseConnection = () => getJson(databaseConnectionEndpoint);
export const loadDatabaseConnectionStatus = () => getJson(`${databaseConnectionEndpoint}/status`);
export const testDatabaseConnection = payload => getJson(`${databaseConnectionEndpoint}/test`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
export const saveDatabaseConnection = (payload, rowVersion) => getJson(databaseConnectionEndpoint, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(rowVersion != null ? { 'If-Match': String(rowVersion) } : {}) }, body: JSON.stringify(payload) });
async function teamGroupRequest(url, options = {}) {
  const response = await fetch(url, { cache: 'no-store', credentials: 'same-origin', ...options });
  const result = await response.json().catch(() => null);
  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent('knowledge-center:session-expired'));
    throw Object.assign(new Error('登录状态已过期'), { status: 401, code: result?.error?.code || 'AUTH_REQUIRED', payload: result });
  }
  if (response.status === 403) {
    window.dispatchEvent(new CustomEvent('knowledge-center:permission-denied'));
    throw Object.assign(new Error('没有执行此操作的权限'), { status: 403, code: result?.error?.code || 'TEAM_GROUP_MANAGE_FORBIDDEN', payload: result });
  }
  if (!response.ok || result?.success === false || !result) throw Object.assign(new Error(result?.error?.message || `团队小组服务响应异常（HTTP ${response.status}）`), { status: response.status, code: result?.error?.code, payload: result });
  return result;
}
export const loadTeamGroups = () => teamGroupRequest(`${teamGroupsEndpoint}?groupType=TECH_DOMAIN`);
export const createTeamGroup = payload => teamGroupRequest(teamGroupsEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': `team-group-${Date.now()}` }, body: JSON.stringify(payload) });
export const loadTeamGroup = id => teamGroupRequest(`${teamGroupsEndpoint}/${encodeURIComponent(id)}`);
export const previewTeamRoster = (id, payload) => teamGroupRequest(`${teamGroupsEndpoint}/${encodeURIComponent(id)}/roster/preview`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
export const saveTeamRoster = (id, payload, rowVersion) => teamGroupRequest(`${teamGroupsEndpoint}/${encodeURIComponent(id)}/roster`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': `team-roster-${id}-${Date.now()}`, ...(rowVersion != null ? { 'If-Match': String(rowVersion) } : {}) }, body: JSON.stringify(payload) });
export const loadTemplate = id => getJson(`${templatesEndpoint}/${encodeURIComponent(id)}`);
export const createTemplate = payload => templateRequest('', templateJson('POST', payload));
export const saveTemplate = (id, payload) => templateRequest(`/${encodeURIComponent(id)}/save`, templateJson('POST', payload));
export const importTemplate = formData => templateRequest('/import', { method: 'POST', body: formData });
export const loadTemplateVersions = id => templateRequest(`/${encodeURIComponent(id)}/versions`);
export const loadTemplateVersion = (id, version) => templateRequest(`/${encodeURIComponent(id)}/versions/${version}`);
export const restoreTemplateDraft = (id, version) => templateRequest(`/${encodeURIComponent(id)}/restore-draft`, templateJson('POST', { version }));
export const updateTemplateMetadata = (id, payload) => templateRequest(`/${encodeURIComponent(id)}`, templateJson('PATCH', payload));
export const setTemplateEnabled = (id, enabled) => templateRequest(`/${encodeURIComponent(id)}/${enabled ? 'restore' : 'disable'}`, { method: 'POST' });
const templateJson = (method, payload) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
async function templateRequest(suffix, options = {}) {
  const response = await fetch(`${templatesEndpoint}${suffix}`, { cache: 'no-store', credentials: 'same-origin', ...options });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success === false || !result) throw Object.assign(new Error(result?.error?.message || `模板服务响应无效（HTTP ${response.status}）`), { status: response.status, code: result?.error?.code });
  return result;
}

async function getJson(url, options = {}, strict = false) {
  const response = await fetch(url, { cache: 'no-store', credentials: 'same-origin', ...options });
  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent('knowledge-center:session-expired'));
    throw Object.assign(new Error('登录状态已过期'), { status: 401 });
  }
  if (response.status === 403) {
    window.dispatchEvent(new CustomEvent('knowledge-center:permission-denied'));
    throw Object.assign(new Error('没有执行此操作的权限'), { status: 403 });
  }
  if (!response.ok && response.status !== 503) throw Object.assign(new Error(`HTTP ${response.status}`), { status: response.status });
  const result = await response.json();
  if (strict && (!response.ok || result?.success === false || !result)) throw Object.assign(new Error(result?.error?.message || `HTTP ${response.status}`), { status: response.status, code: result?.error?.code, payload: result });
  return result;
}

const outlineGetJson = url => getJson(url, {}, true);

function normalizeOutlineError(error = {}) {
  const code = error.code || error.payload?.error?.code;
  const status = error.status || error.payload?.error?.status;
  const message = String(error.message || error.payload?.error?.message || '').trim();
  if (code === 'OUTLINE_NOT_FOUND' || status === 404) return '候选大纲不存在，可能已被删除或当前页面数据已过期，请刷新大纲列表。';
  if (code === 'OUTLINE_GATEWAY_REQUIRED' || code === 'OUTLINE_AUTH_NOT_CONFIGURED') return '大纲权限网关配置异常，请重启知识中心服务后重试。';
  if (code === 'PUBLISHED_CONTENT_LOCKED') return '已发布大纲只能调整技术领域，不能修改内容说明。';
  if (code === 'PUBLISHED_ASSIGNMENT_REQUIRED') return '已发布大纲不能取消页面的全部技术领域分工。';
  if (code === 'OUTLINE_IMMUTABLE') return '当前大纲版本已发布或已被替代，不能修改结构；如需调整，请导入新的候选版本。';
  if (code === 'OUTLINE_VERSION_CONFLICT' || code === 'OUTLINE_EDIT_CONFLICT' || code === 'OUTLINE_GOVERNANCE_CONFLICT') return '大纲数据已被更新，请刷新页面后重试。';
  if (code === 'INVALID_DOMAIN_PAYLOAD') return '技术领域分工数据不合法，请刷新后重试。';
  if (code === 'OUTLINE_SERVICE_UNAVAILABLE' || code === 'DOCUMENT_API_UNAVAILABLE' || status === 502 || status === 503) return '大纲服务暂时不可用，请确认文档服务已启动后重试。';
  if (message.toLowerCase() === 'failed to fetch' || error.name === 'TypeError') return '无法连接大纲服务，请确认知识中心和文档服务已启动后重试。';
  return message || '大纲操作失败，请稍后重试。';
}

export async function loadPlatformData(scopes = ['context', 'overview']) {
  const requested = new Set(scopes);
  const loadContext = requested.has('context') || requested.has('all');
  const loadOverview = [...requested].some(scope => scope !== 'context');
  const [context, overview] = await Promise.allSettled([
    loadContext ? getJson(contextEndpoint) : Promise.resolve(null),
    loadOverview ? getJson(overviewEndpoint) : Promise.resolve(null),
  ]);
  return {
    context: context.status === 'fulfilled' ? context.value : null,
    overview: overview.status === 'fulfilled' ? overview.value : null,
    errors: {
      context: context.status === 'rejected' ? context.reason : null,
      overview: overview.status === 'rejected' ? overview.reason : null,
    },
    requested: { context: loadContext, overview: loadOverview },
  };
}

export async function loadOutlineData(handbookId = null, outlineVersionId = null) {
  try {
    if (!handbookId) {
      const response = await outlineGetJson('/knowledge-center/api/outline/catalog');
      const catalog = response?.data || response || {};
      return { status: 'ok', items: Array.isArray(catalog.items) ? catalog.items : [], total: Number(catalog.total || 0), snapshotVersion: catalog.snapshotVersion || null, detail: null, selectedId: null, asOf: catalog.generatedAt || new Date().toISOString() };
    }
    if (outlineVersionId == null) {
      const response = await outlineGetJson('/knowledge-center/api/outline/catalog');
      const catalog = response?.data || response || {};
      const selected = (catalog.items || []).find(item => String(item.handbookId || item.manualId) === String(handbookId));
      if (selected) {
        const selectedId = selected.id || selected.outlineId;
        const detail = await outlineGetJson(`${outlineEndpoint}/${encodeURIComponent(selectedId)}?view=compact`);
        return { status: 'ok', items: [selected], handbook: { handbookId, name: selected.name }, detail: detail?.data || null, selectedId, asOf: detail?.generatedAt || catalog.generatedAt || new Date().toISOString() };
      }
    }
    const list = await outlineGetJson(`${outlineEndpoint}/list`);
    const allItems = Array.isArray(list?.data) ? list.data : [];
    let handbookError = null;
    const handbooksResponse = await outlineGetJson(`${handbooksEndpoint}?page=1&pageSize=100`).catch(error => { handbookError = error; return null; });
    const handbooksPayload = handbooksResponse?.data || handbooksResponse || {};
    const handbooks = Array.isArray(handbooksPayload.items) ? handbooksPayload.items : Array.isArray(handbooksPayload.handbooks) ? handbooksPayload.handbooks : [];
    const handbook = handbooks.find(item => String(item.handbookId || item.id) === String(handbookId)) || null;
    const items = allItems.filter(item => String(item.handbookId || item.manualId) === String(handbookId));
    if (!handbook && !items.length && !handbookError) return { status: 'not_found', items: [], selectedId: handbookId, asOf: list?.generatedAt || new Date().toISOString() };
    if (!handbook && !items.length && handbookError) return { status: 'empty', items: [], handbook: { handbookId, name: handbookId }, selectedId: null, asOf: list?.generatedAt || new Date().toISOString() };
    if (!items.length) return { status: 'empty', items: [], handbook, selectedId: null, asOf: list?.generatedAt || new Date().toISOString() };
    const requestedVersion = outlineVersionId == null ? null : items.find(item => String(item.id || item.outlineId) === String(outlineVersionId));
    if (outlineVersionId != null && !requestedVersion) return { status: 'not_found', items, handbook, selectedId: null, asOf: list?.generatedAt || new Date().toISOString() };
    const selected = requestedVersion || [...items].sort((left, right) => {
      const leftPublished = String(left.state || left.status).toLowerCase() === 'published' ? 1 : 0;
      const rightPublished = String(right.state || right.status).toLowerCase() === 'published' ? 1 : 0;
      if (leftPublished !== rightPublished) return rightPublished - leftPublished;
      return new Date(right.updated_at || right.updatedAt || 0).getTime() - new Date(left.updated_at || left.updatedAt || 0).getTime();
    })[0];
    const selectedId = selected?.id || selected?.outlineId;
    const detail = selectedId ? await outlineGetJson(`${outlineEndpoint}/${encodeURIComponent(selectedId)}?view=compact`) : null;
    return { status: 'ok', items, handbook, detail: detail?.data || null, selectedId: selectedId || null, asOf: detail?.generatedAt || list?.generatedAt || new Date().toISOString() };
  } catch (error) {
    return { status: error?.status === 403 ? 'forbidden' : 'unavailable', items: [], error: { message: normalizeOutlineError(error), code: error?.code } };
  }
}

export async function importOutline(formData) {
  const response = await fetch('/knowledge-center/api/outline/import', { method: 'POST', body: formData, credentials: 'same-origin' });
  if (response.status === 401) throw Object.assign(new Error('登录状态已过期'), { status: 401 });
  if (response.status === 403) throw Object.assign(new Error('没有执行此操作的权限'), { status: 403 });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const failedMessages = (result?.data?.items || [])
      .filter(item => item.status === 'failed' && item.error?.message)
      .map(item => item.error.message);
    const message = result?.error?.message || result?.message || failedMessages.join('；') || `导入失败（HTTP ${response.status}）`;
    throw Object.assign(new Error(message), { status: response.status, details: result?.error?.details || [], payload: result });
  }
  return result;
}

export async function validateOutline(formData) {
  const response = await fetch('/knowledge-center/api/outline/validate', { method: 'POST', body: formData, credentials: 'same-origin' });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw Object.assign(new Error(result?.error?.message || '校验未通过，请按提示修改'), { status: response.status, payload: result });
  return result;
}

export async function deleteOutline(outlineId) {
  let response;
  try {
    response = await fetch(`${outlineEndpoint}/${encodeURIComponent(outlineId)}`, { method: 'DELETE', credentials: 'same-origin', headers: { Accept: 'application/json' } });
  } catch (error) {
    throw Object.assign(new Error(normalizeOutlineError(error)), { code: 'OUTLINE_SERVICE_UNAVAILABLE', cause: error });
  }
  if (response.status === 401) throw Object.assign(new Error('登录状态已过期'), { status: 401 });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const error = { message: result?.error?.message || result?.message, code: result?.error?.code, status: response.status, payload: result };
    const message = normalizeOutlineError(error);
    throw Object.assign(new Error(message), { ...error, message });
  }
  return result;
}

export async function loadOutlineRecycle() {
  const response = await fetch(`${outlineEndpoint}/recycle`, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.error?.message || '回收站读取失败'), { status: response.status });
  return result.data || [];
}

export async function outlineLifecycle(outlineId, action, payload = {}) {
  const url = `${outlineEndpoint}/${encodeURIComponent(outlineId)}/${action}`;
  if (action !== 'purge-preflight') return outlineMutation(url, 'POST', payload);
  const response = await fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.error?.message || '删除检查失败'), { code: result.error?.code });
  return result.data;
}

async function outlineMutation(url, method, payload) {
  let response;
  try {
    response = await fetch(url, { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload || {}) });
  } catch (error) {
    throw Object.assign(new Error(normalizeOutlineError(error)), { code: 'OUTLINE_SERVICE_UNAVAILABLE', cause: error });
  }
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const error = { message: result?.error?.message || result?.message, code: result?.error?.code, status: response.status, payload: result };
    const message = normalizeOutlineError(error);
    throw Object.assign(new Error(message), { ...error, message });
  }
  return result?.data || result;
}

export const saveOutlineGovernance = (outlineId, payload) => outlineMutation(`${outlineEndpoint}/${encodeURIComponent(outlineId)}/governance`, 'PUT', payload);
export const publishOutlineGovernance = (outlineId, payload = {}) => outlineMutation(`${outlineEndpoint}/${encodeURIComponent(outlineId)}/publish`, 'POST', payload);
export async function loadTechDomains() { const result = await getJson('/knowledge-center/api/outline/tech-domains'); return result?.data || result; }
export async function loadDomainBuildTasks() { const result = await getJson('/knowledge-center/api/outline/build-tasks'); return result?.data || result; }
export async function loadDomainBuildTask(taskId) { const result = await getJson(`/knowledge-center/api/outline/build-tasks/${encodeURIComponent(taskId)}`); return result?.data || result; }
export const updateDomainBuildTaskItem = (taskId, itemId, payload) => outlineMutation(`/knowledge-center/api/outline/build-tasks/${encodeURIComponent(taskId)}/items/${encodeURIComponent(itemId)}`, 'PATCH', payload);

export async function updateAsset(handbookId, changes) {
  const response = await fetch(`${handbooksEndpoint}/${encodeURIComponent(handbookId)}`, {
    method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(changes),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw Object.assign(new Error(result?.error?.message || `保存失败（HTTP ${response.status}）`), { status: response.status });
  return result?.data;
}

export async function loadAssets(params = new URLSearchParams()) {
  const query = params instanceof URLSearchParams ? params.toString() : new URLSearchParams(params).toString();
  return getJson(`${handbooksEndpoint}${query ? `?${query}` : ''}`);
}

async function assetCommand(url, method = 'POST', body) {
  const response = await fetch(url, { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw Object.assign(new Error(result?.error?.message || `操作失败（HTTP ${response.status}）`), { status: response.status, payload: result });
  return result?.data;
}

export const createAsset = changes => assetCommand(handbooksEndpoint, 'POST', changes);
export const archiveAsset = handbookId => assetCommand(`${handbooksEndpoint}/${encodeURIComponent(handbookId)}/archive`);
export const restoreAsset = handbookId => assetCommand(`${handbooksEndpoint}/${encodeURIComponent(handbookId)}/restore`);
export const updateAssetStatus = (handbookId, changes) => assetCommand(`${handbooksEndpoint}/${encodeURIComponent(handbookId)}/status`, 'POST', changes);
export const resolveAssetStatus = (handbookId, changes) => assetCommand(`${handbooksEndpoint}/${encodeURIComponent(handbookId)}/status/resolve`, 'POST', changes);

export async function loadPlatformPermissions(params = {}) {
  const query = new URLSearchParams(params).toString();
  return getJson(`${permissionsEndpoint}${query ? `?${query}` : ''}`);
}

export async function updatePlatformUserPermissions(userId, changes) {
  const rowVersion = Number(changes?.rowVersion);
  const idempotencyKey = String(changes?.idempotencyKey || '').trim();
  if (changes?.rowVersion == null || !Number.isInteger(rowVersion)) throw new Error('用户权限数据已过期，请刷新后重试');
  if (!idempotencyKey) throw new Error('权限保存请求缺少幂等标识，请重试');
  const response = await fetch(`${permissionsEndpoint}/${encodeURIComponent(userId)}/roles`, {
    method: 'PATCH', credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'If-Match': String(rowVersion),
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ roles: changes.roles }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw Object.assign(new Error(result?.error?.message || `权限保存失败（HTTP ${response.status}）`), { status: response.status });
  return result?.data || result;
}

export async function loadPrincipals(params = {}) {
  const query = new URLSearchParams(params).toString();
  const result = await getJson(`${principalsEndpoint}${query ? `?${query}` : ''}`);
  return result?.data || result;
}

export async function createPrincipal(payload) {
  const response = await fetch(principalsEndpoint, {
    method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw Object.assign(new Error(result?.error?.message || `人员新增失败（HTTP ${response.status}）`), { status: response.status, code: result?.error?.code });
  return result?.data;
}

export async function updatePrincipal(principalId, payload) {
  const response = await fetch(`${principalsEndpoint}/${encodeURIComponent(principalId)}`, {
    method: 'PATCH', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw Object.assign(new Error(result?.error?.message || `人员更新失败（HTTP ${response.status}）`), { status: response.status, code: result?.error?.code });
  return result?.data;
}

export async function importPrincipals(file, mode = 'preview') {
  const body = new FormData(); body.append('file', file);
  const response = await fetch(`${principalsEndpoint}/import?mode=${encodeURIComponent(mode)}`, { method: 'POST', credentials: 'same-origin', body });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw Object.assign(new Error(result?.error?.message || `人员导入失败（HTTP ${response.status}）`), { status: response.status, code: result?.error?.code });
  return result?.data;
}
