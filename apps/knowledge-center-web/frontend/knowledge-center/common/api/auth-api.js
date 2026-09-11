const authRoot = '/knowledge-center/api/auth';

export class AuthApiError extends Error {
  constructor(message, { status = 0, code = 'AUTH_REQUEST_FAILED', details = null } = {}) {
    super(message);
    this.name = 'AuthApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function requestJson(path, options = {}) {
  let response;
  try {
    response = await fetch(`${authRoot}${path}`, {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
      ...options,
    });
  } catch (error) {
    throw new AuthApiError('认证服务暂时不可用', { code: 'AUTH_SERVICE_UNAVAILABLE', details: error });
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // Stable status handling below does not depend on an HTML/proxy error body.
  }
  if (!response.ok) {
    const error = payload?.error || {};
    throw new AuthApiError(error.message || payload?.message || '认证请求未完成', {
      status: response.status,
      code: error.code || payload?.code || `AUTH_HTTP_${response.status}`,
      details: error.details,
    });
  }
  return payload?.data ?? payload?.content ?? payload ?? {};
}

export const getAuthConfig = () => requestJson('/config');
export const getSession = () => requestJson('/session');
export const completeCasLogin = ({ ticket, serviceId }) => requestJson('/cas/callback', {
  method: 'POST',
  body: JSON.stringify({ ticket, serviceId }),
});
export const adminLogin = ({ username, password }) => requestJson('/admin/login', {
  method: 'POST',
  body: JSON.stringify({ username, password }),
});
export const logout = () => requestJson('/logout', { method: 'POST', body: JSON.stringify({}) });
