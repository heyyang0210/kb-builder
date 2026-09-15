import { adminLogin, completeCasLogin, getAuthConfig, getSession, logout } from '../api/auth-api.js';
import { authState, clearSession, setAuthState } from '../state/auth-state.js';

const returnToKey = 'knowledge-center-return-to';

export function sanitizeReturnTo(candidate, fallback = '/knowledge-center/') {
  if (!candidate) return fallback;
  try {
    const url = new URL(candidate, window.location.origin);
    const allowedPath = url.pathname === '/knowledge-center' || url.pathname.startsWith('/knowledge-center/');
    if (url.origin !== window.location.origin || !allowedPath || candidate.startsWith('//')) return fallback;
    url.searchParams.delete('ticket');
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function currentSafeTarget() {
  return sanitizeReturnTo(`${window.location.pathname}${window.location.search}${window.location.hash}`);
}

function rememberTarget(target = currentSafeTarget()) {
  sessionStorage.setItem(returnToKey, sanitizeReturnTo(target));
}

export function consumeRememberedTarget(fallback = '/knowledge-center/') {
  const remembered = sessionStorage.getItem(returnToKey);
  sessionStorage.removeItem(returnToKey);
  return remembered ? sanitizeReturnTo(remembered, fallback) : null;
}

function casTicket() {
  return new URL(window.location.href).searchParams.get('ticket') || '';
}

export function removeTicketFromAddress() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('ticket')) return;
  url.searchParams.delete('ticket');
  window.history.replaceState(window.history.state, document.title, `${url.pathname}${url.search}${url.hash}`);
}

async function refreshSession() {
  const session = await getSession();
  if (!session.authenticated) {
    clearSession();
    return null;
  }
  setAuthState({ status: 'authenticated', session, error: null });
  return session;
}

export async function bootstrapAuth(onStatus = () => {}) {
  setAuthState({ status: 'checking', error: null });
  onStatus('正在检查登录状态');
  try {
    const config = await getAuthConfig();
    setAuthState({ config });
  } catch (error) {
    setAuthState({ config: null, error });
  }

  const ticket = casTicket();
  if (ticket) {
    setAuthState({ status: 'callback' });
    onStatus('正在验证统一认证信息');
    try {
      await completeCasLogin({ ticket, serviceId: authState.config?.serviceId || authState.config?.serviceUrl });
      removeTicketFromAddress();
      return await refreshSession();
    } catch (error) {
      removeTicketFromAddress();
      setAuthState({ status: 'anonymous', session: null, error });
      return null;
    }
  }

  try {
    return await refreshSession();
  } catch (error) {
    if (error.status === 401) {
      setAuthState({ status: 'anonymous', session: null, error: null });
      return null;
    }
    setAuthState({ status: 'anonymous', session: null, error });
    return null;
  }
}

export function startCasLogin() {
  const loginUrl = authState.config?.loginUrl;
  if (!authState.config?.casEnabled || !loginUrl) throw new Error('统一认证当前不可用');
  rememberTarget();
  setAuthState({ status: 'redirecting', error: null });
  window.location.assign(loginUrl);
}

export async function submitAdminLogin(credentials) {
  setAuthState({ status: 'admin-login', error: null });
  const session = await adminLogin(credentials);
  // admin/login 已返回完整会话投影，避免登录成功后重复请求 /session。
  if (session?.authenticated && session.user) {
    setAuthState({ status: 'authenticated', session, error: null });
    return session;
  }
  return refreshSession();
}

export async function performLogout() {
  const result = await logout();
  clearSession();
  sessionStorage.removeItem(returnToKey);
  if ((result.redirectToCas || result.logoutMode === 'cas') && result.logoutUrl) {
    window.location.assign(result.logoutUrl);
    return true;
  }
  return false;
}

export function rememberCurrentTarget() {
  rememberTarget();
}
