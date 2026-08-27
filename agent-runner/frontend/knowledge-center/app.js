const endpoint = '/knowledge-center/api/platform/context';
const modules = ['documentGeneration', 'materialProcessing'];

function text(id, value) { document.getElementById(id).textContent = value; }

function renderModule(name, state) {
  const card = document.querySelector(`[data-module="${name}"]`);
  const status = card.querySelector('.module-state');
  const link = card.querySelector('.workspace-link');
  card.classList.remove('workspace-loading', 'workspace-error');
  card.setAttribute('aria-busy', 'false');
  if (state?.status === 'ok') {
    status.textContent = '服务可用';
    link.removeAttribute('aria-disabled');
    return;
  }
  card.classList.add('workspace-error');
  status.textContent = state?.error?.code === 'MODULE_TIMEOUT' ? '响应超时，请重试' : '服务暂不可用';
  link.setAttribute('aria-disabled', 'true');
}

function render(payload) {
  const context = payload.context;
  modules.forEach(name => renderModule(name, payload.modules?.[name]));
  const healthy = modules.filter(name => payload.modules?.[name]?.status === 'ok').length;
  const summary = document.getElementById('overall-status');
  summary.querySelector('.status-dot').className = `status-dot ${payload.status === 'ok' ? 'status-ok' : 'status-warning'}`;
  summary.querySelector('strong').textContent = payload.status === 'ok' ? '平台运行正常' : '部分服务降级';
  summary.querySelector('span:last-child').textContent = `${healthy} / ${modules.length} 个工作区可用`;
  text('platform-name', context.brand?.platformName || '知识中心建设平台');
  text('enterprise-name', context.brand?.enterpriseName || context.displayName);
  text('profile-name', context.displayName || context.profileId);
  text('fingerprint-status', payload.status === 'ok' ? '双模块一致' : '请检查模块状态');
  text('capability-count', `${(context.capabilities || []).filter(item => item.enabled).length} 项`);
  const connectors = context.connectors || [];
  text('connector-summary', `${connectors.filter(item => item.configured).length} / ${connectors.length} 已配置`);
  text('fingerprint', context.configFingerprint || '--');
  document.getElementById('error-panel').hidden = true;
}

function renderError(message) {
  const panel = document.getElementById('error-panel');
  panel.hidden = false;
  text('error-message', message || '请确认至少一个后端模块可用后重试。');
  modules.forEach(name => renderModule(name, { error: { code: 'MODULE_UNAVAILABLE' } }));
  const summary = document.getElementById('overall-status');
  summary.querySelector('.status-dot').className = 'status-dot status-error';
  summary.querySelector('strong').textContent = '平台状态不可用';
  summary.querySelector('span:last-child').textContent = '可稍后重新检查';
}

async function load() {
  const refresh = document.getElementById('refresh');
  refresh.disabled = true;
  refresh.textContent = '检查中';
  try {
    const response = await fetch(endpoint, { cache: 'no-store' });
    if (!response.ok) throw new Error('平台服务暂时不可用，请检查后端模块后重试。');
    render(await response.json());
  } catch (error) {
    renderError(error.message);
  } finally {
    refresh.disabled = false;
    refresh.textContent = '刷新状态';
  }
}

document.getElementById('refresh').addEventListener('click', load);
document.getElementById('retry').addEventListener('click', load);
load();
