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

export function pathForView(view) {
  return routeByView[view] || routeByView.dashboard;
}

export function viewFromPath(pathname) {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (normalized.startsWith('/knowledge-center/assets/') && normalized.endsWith('/repository')) return 'repository';
  if (normalized.startsWith('/knowledge-center/outlines/')) return 'outlines';
  return viewByRoute[normalized] || null;
}
