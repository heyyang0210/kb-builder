const businessViews = ['dashboard', 'assets', 'repository', 'cleaning', 'outlines', 'templates', 'production'];

export const authState = {
  status: 'checking',
  config: null,
  session: null,
  error: null,
};

export function setAuthState(update) {
  Object.assign(authState, update);
}

export function clearSession() {
  setAuthState({ status: 'anonymous', session: null });
}

function moduleSet() {
  const modules = authState.session?.visibleModules;
  return Array.isArray(modules) ? new Set(modules.map(String)) : null;
}

export function canAccessView(view) {
  if (!authState.session?.authenticated) return false;
  if (view === 'cleaning' && !isPlatformAdmin()) return false;
  const modules = moduleSet();
  if (!modules) return view !== 'platform' || authState.session.loginMethod === 'admin';
  if (view === 'repository') return modules.has('*') || modules.has('assets');
  return modules.has('*') || modules.has(view);
}

export function firstAccessibleView() {
  return [...businessViews, 'review', 'platform'].find(canAccessView) || null;
}

export function displayName() {
  const user = authState.session?.user || {};
  return user.displayName || user.name || user.username || '已登录用户';
}

export function isPlatformAdmin() {
  return Array.isArray(authState.session?.roles) && authState.session.roles.includes('PLATFORM_ADMIN');
}

export function canPerform(action) {
  const actions = authState.session?.allowedActions || authState.session?.user?.allowedActions || [];
  return Array.isArray(actions) && actions.includes(action);
}
