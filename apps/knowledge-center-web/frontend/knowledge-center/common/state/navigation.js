const routeByView = {
  dashboard: '/knowledge-center/',
  assets: '/knowledge-center/assets',
  cleaning: '/knowledge-center/cleaning',
  outlines: '/knowledge-center/outlines',
  templates: '/knowledge-center/templates',
  production: '/knowledge-center/production',
  review: '/knowledge-center/review',
  platform: '/knowledge-center/platform',
  repository: '/knowledge-center/assets',
};

const viewByRoute = Object.fromEntries(Object.entries(routeByView).filter(([view]) => view !== 'repository').map(([view, route]) => [route, view]));
viewByRoute['/knowledge-center'] = 'dashboard';

const validPlatformTabs = new Set(['governance', 'permissions', 'gitlab']);
const defaultPlatformTab = 'governance';

export function pathForView(view, params) {
  const base = routeByView[view] || routeByView.dashboard;
  if (view === 'platform' && params?.tab) {
    const tab = validPlatformTabs.has(params.tab) ? params.tab : defaultPlatformTab;
    return `${base}?tab=${tab}`;
  }
  return base;
}

export function viewFromPath(pathname) {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (normalized.startsWith('/knowledge-center/assets/') && normalized.endsWith('/repository')) return 'repository';
  if (normalized.startsWith('/knowledge-center/outlines/')) return 'outlines';
  return viewByRoute[normalized] || null;
}

export function platformTabFromSearch(search) {
  const params = new URLSearchParams(search);
  const tab = params.get('tab');
  return validPlatformTabs.has(tab) ? tab : defaultPlatformTab;
}

export { validPlatformTabs, defaultPlatformTab };
