const contextEndpoint = '/knowledge-center/api/platform/context';
const overviewEndpoint = '/knowledge-center/api/platform/overview';
const outlineEndpoint = '/knowledge-center/api/outline/governance';
const handbooksEndpoint = '/knowledge-center/api/assets/handbooks';
// 用户角色由认证服务统一维护；平台管理仅提供同源代理入口。
const permissionsEndpoint = '/knowledge-center/api/auth/users';
const templatesEndpoint = '/knowledge-center/api/templates';
export const loadTemplates = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return getJson(query ? `${templatesEndpoint}?${query}` : templatesEndpoint);
};
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

async function getJson(url, options = {}) {
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
  return response.json();
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

export async function loadOutlineData(handbookId = null) {
  try {
    const list = await getJson(`${outlineEndpoint}/list`);
    const items = Array.isArray(list?.data) ? list.data : [];
    if (!items.length) return { status: 'ok', items: [], asOf: list?.generatedAt || new Date().toISOString() };
    if (!handbookId) return { status: 'ok', items, detail: null, selectedId: null, asOf: list?.generatedAt || new Date().toISOString() };
    const selected = handbookId ? items.find(item => String(item.handbookId || item.id || item.outlineId) === String(handbookId)) : null;
    if (handbookId && !selected) return { status: 'not_found', items, selectedId: handbookId, asOf: list?.generatedAt || new Date().toISOString() };
    const selectedId = selected?.id || selected?.outlineId || selected?.handbookId || items[0]?.id || items[0]?.outlineId;
    const detail = selectedId ? await getJson(`${outlineEndpoint}/${encodeURIComponent(selectedId)}`) : null;
    return { status: 'ok', items, detail: detail?.data || null, selectedId: selectedId || null, asOf: detail?.generatedAt || list?.generatedAt || new Date().toISOString() };
  } catch (error) {
    return { status: error?.status === 403 ? 'forbidden' : 'unavailable', items: [], error: { message: error?.message || '大纲服务暂不可用' } };
  }
}

export async function importOutline(formData) {
  const response = await fetch('/knowledge-center/api/outline/import', { method: 'POST', body: formData, credentials: 'same-origin' });
  if (response.status === 401) throw Object.assign(new Error('登录状态已过期'), { status: 401 });
  if (response.status === 403) throw Object.assign(new Error('没有执行此操作的权限'), { status: 403 });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const message = result?.error?.message || result?.message || `导入失败（HTTP ${response.status}）`;
    throw Object.assign(new Error(message), { status: response.status, details: result?.error?.details || [], payload: result });
  }
  return result;
}

export async function deleteOutline(outlineId) {
  const response = await fetch(`${outlineEndpoint}/${encodeURIComponent(outlineId)}`, { method: 'DELETE', credentials: 'same-origin', headers: { Accept: 'application/json' } });
  if (response.status === 401) throw Object.assign(new Error('登录状态已过期'), { status: 401 });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw Object.assign(new Error(result?.error?.message || result?.message || `删除失败（HTTP ${response.status}）`), { status: response.status, payload: result });
  return result;
}

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
  const response = await fetch(`${permissionsEndpoint}/${encodeURIComponent(userId)}/roles`, {
    method: 'PATCH', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(changes),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw Object.assign(new Error(result?.error?.message || `权限保存失败（HTTP ${response.status}）`), { status: response.status });
  return result?.data || result;
}
