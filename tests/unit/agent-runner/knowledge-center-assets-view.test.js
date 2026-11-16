const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

describe('知识资产工作台前端契约', () => {
  const view = () => read('apps/knowledge-center-web/frontend/knowledge-center/modules/assets/view.js');

  test('展示五类业务阶段、责任人与章节文档', () => {
    for (const label of ['待创建', '完善大纲', '大纲已发布', '内容构建中', '已发布', 'A 角', 'B 角', '内容规模', '文档']) expect(view()).toContain(label);
    expect(view()).not.toContain('章节与页面');
    expect(view()).not.toContain('目录条目');
  });

  test('页面顶部不重复展示模块眉标题和说明', () => {
    expect(view()).toContain('class="asset-list-heading"><h2 class="sr-only">');
    expect(view()).toContain("inactive?'历史手册列表':'手册资产列表'");
    expect(view()).not.toContain('查找手册，确认责任与阶段，再进入专业模块处理。');
    expect(view()).not.toContain('renderAssetsLegacy');
  });

  test('更新时间只在页面头部渲染一次', () => {
    expect((view().match(/更新于/g) || [])).toHaveLength(1);
    expect(view()).toContain('更新时间暂不可用');
  });

  test('管理员操作由角色能力控制', () => {
    expect(view()).toContain('platformAdmin');
    for (const action of ['新增手册', '管理手册', '停用手册', '重新启用']) expect(view()).toContain(action);
    const auth = read('apps/knowledge-center-web/frontend/knowledge-center/common/state/auth-state.js');
    expect(auth).toContain('PLATFORM_ADMIN');
  });

  test('使用服务端搜索分页和专业模块入口', () => {
    const api = read('apps/knowledge-center-web/frontend/knowledge-center/common/api/platform-api.js');
    expect(api).toContain('/knowledge-center/api/assets/handbooks');
    expect(view()).toContain('data-asset-page');
    for (const label of ['大纲管理', '文档生产', '审核与发布']) expect(view()).toContain(label);
  });

  test('点击手册名称打开操作栏，列表不再提供独立管理列', () => {
    const actionPanel = view().split('function renderActionPanel')[1].split('function renderPagination')[0];
    expect(view()).not.toContain('>查看</button>');
    expect(view()).not.toContain('asset-detail-facts');
    expect(view()).toContain('aria-label="当前手册操作"');
    expect(view()).not.toContain('<th>操作</th>');
    expect(view()).not.toContain('data-handbook-manage');
    expect(view()).toContain('class="asset-name"');
    expect(view()).toContain('data-asset-id');
    expect(view()).toContain('/knowledge-center/assets?handbookId=');
    expect(actionPanel).not.toContain('A：');
    expect(actionPanel).not.toContain('B：');
  });

  test('侧栏按主操作、工作和管理分组，关闭使用中性 Lucide 图标', () => {
    expect(view()).not.toContain('>文档工作<');
    expect(view()).toContain('asset-action-primary');
    expect(view()).toContain('<h3>工作入口</h3>');
    expect(view()).toContain('<h3>管理设置</h3>');
    expect(view()).toContain('class="asset-name"');
    expect(view()).toContain('data-lucide="x"');
    expect(view()).not.toContain('asset-detail-close" type="button" data-asset-detail-close aria-label="关闭手册操作" title="关闭手册操作">×');
    const css = read('apps/knowledge-center-web/frontend/knowledge-center/styles.css');
    expect(css).toContain('.asset-name-link { color: var(--color-brand)');
    expect(css).toContain('.asset-action-card {');
    expect(css).toContain('.asset-action-row {');
    const base = read('apps/knowledge-center-web/frontend/knowledge-center/common/base.css');
    expect(base).toContain('button.icon-button[aria-label^="关闭"] svg');
    expect(base).toContain('width: 20px;');
    expect(base).toContain('min-width: 44px;');
    expect(base).toContain('color: var(--color-icon-default);');
    expect(base).not.toContain('color: var(--color-danger);');
  });

  test('静态上下文标签不使用蓝色，新增手册使用蓝色交互样式', () => {
    expect(view()).not.toContain('class="eyebrow asset-context-label"');
    expect(view()).toContain('class="button tertiary asset-create-trigger"');
    const css = read('apps/knowledge-center-web/frontend/knowledge-center/styles.css');
    expect(css).toContain('.asset-context-label { color: var(--color-text-secondary); }');
    expect(css).toContain('.asset-create-trigger { color: var(--color-brand); }');
  });

  test('取消对话框不提交，阶段筛选使用页内路由', () => {
    expect(view()).toContain('type="button" data-asset-dialog-close');
    expect(view()).toContain('data-asset-stage');
    const app = read('apps/knowledge-center-web/frontend/knowledge-center/app.js');
    expect(app).toContain("event.target.closest('[data-asset-stage]')");
    expect(app).toContain("if (view === 'assets') loadAssetCatalog()");
    expect(view()).toContain('asset-detail-open');
    expect(view()).toContain('返回手册列表');
    expect(view()).toContain('查看已停用资产');
    expect(view()).not.toContain('包含已归档');
    expect(view()).not.toContain('手册发布');
    expect(view()).toContain('data-asset-detail-close');
  });

  test('打开和关闭手册操作栏只更新局部选择状态', () => {
    const app = read('apps/knowledge-center-web/frontend/knowledge-center/app.js');
    const closeHandler = app.split("const assetDetailBack = event.target.closest('[data-asset-detail-back], [data-asset-detail-close]');")[1].split('const statusResolution')[0];
    const openHandler = app.split("const assetLink = event.target.closest('[data-asset-id]');")[1].split('const outlineLink')[0];
    expect(closeHandler).toContain('updateAssetSelection(null)');
    expect(openHandler).toContain('updateAssetSelection(assetLink.dataset.assetId)');
    for (const handler of [closeHandler, openHandler]) expect(handler).not.toContain('loadAssetCatalog();');
    expect(app).toContain("if (view === 'assets' && appState.activeView === 'assets' && appState.assetCatalog");
    expect(app).toContain('assetCatalogQuery().toString() === assetCatalogRouteKey');
  });

  test('仓库内容规模使用独立加载状态和单元格更新', () => {
    const app = read('apps/knowledge-center-web/frontend/knowledge-center/app.js');
    expect(view()).toContain('data-asset-statistics=');
    expect(view()).toContain("item.statisticsStatus === 'loading'");
    expect(view()).toContain('章节 正在统计');
    expect(app).toContain("item.statisticsStatus = 'loading'");
    expect(app).toContain('updateAssetStatistics(item)');
    const loadCatalog = app.split('async function loadAssetCatalog()')[1].split('async function loadGitLabAdmin()')[0];
    expect(loadCatalog).not.toContain("appState.activeView === 'assets') render();\n}");
    expect(view()).toContain("item.statisticsStatus === 'forbidden'");
    expect(view()).toContain("item.statisticsStatus === 'unavailable'");
    expect(app).toContain('assetStatisticsSequences');
    expect(app).toContain('expectedVersion: Number(assetForm.dataset.assetVersion)');
  });

  test('新增手册使用聚焦式弹窗并展示对外可见字段', () => {
    expect(view()).toContain('aria-describedby="asset-create-description"');
    expect(view()).toContain('建立基础信息，创建后继续完善大纲。');
    expect(view()).toContain('<fieldset class="asset-owner-fields">');
    expect(view()).toContain('A 角负责人');
    expect(view()).toContain('B 角负责人');
    expect(view()).toContain('class="asset-visibility-setting"');
    expect(view()).toContain('name="externalVisible" role="switch"');
    expect(view()).toContain('对外可见');
    expect(view()).toContain('<details class="asset-summary-disclosure">');
    expect(view()).toContain('<summary>添加概要说明</summary>');
    expect(view()).toContain('type="submit">创建手册</button>');
    expect(view()).not.toContain('type="submit">创建</button>');
    const css = read('apps/knowledge-center-web/frontend/knowledge-center/styles.css');
    expect(css).toContain('.asset-dialog { width: min(520px');
    expect(css).toContain('border-radius: var(--radius-md)');
    expect(css).toContain('.asset-switch { position: relative; width: 38px; height: 22px');
    const app = read('apps/knowledge-center-web/frontend/knowledge-center/app.js');
    expect(app).toContain("document.querySelector('.asset-dialog[open]')");
    expect(app).toContain('flushDeferredAssetRender');
  });

  test('手册责任人候选只展示中文姓名，CAS 账号仅用于筛选', () => {
    expect(view()).toContain('data-search="${escapeHtml(search)}"');
    expect(view()).toContain('>${escapeHtml(name)}</option>');
    expect(view()).not.toContain('${escapeHtml(name)} · ${escapeHtml(identity)}');
  });

  test('停用手册收纳到高级操作并使用专用确认对话框', () => {
    expect(view()).toContain('<details class="asset-advanced-actions" data-asset-advanced-actions>');
    expect(view()).toContain('<summary>高级操作</summary>');
    expect(view()).not.toContain('data-asset-advanced-actions open');
    expect(view()).toContain('data-asset-archive-open=');
    expect(view()).toContain('data-asset-archive-dialog');
    expect(view()).toContain('data-asset-archive-confirm-form');
    expect(view()).toContain('确认停用“');
    expect(view()).toContain('可在“已停用资产”中重新启用');
    const app = read('apps/knowledge-center-web/frontend/knowledge-center/app.js');
    expect(app).toContain('请先保存或取消当前修改，再停用手册。');
    expect(app).toContain("event.target.matches?.('[data-asset-archive-dialog]')");
    expect(app).not.toContain('window.confirm(`停用后手册将从在用资产列表隐藏');
  });

  test('已停用资产入口收纳到更多菜单并在停用成功后提供直接入口', () => {
    expect(view()).toContain('<details class="asset-more-menu" data-asset-more-menu data-dismissible-menu>');
    expect(view()).toContain('class="button tertiary asset-more-trigger">更多');
    expect(view()).toContain('查看已停用资产');
    expect(view()).toContain('查询历史资产并重新启用');
    expect(view()).toContain('class="asset-page-title"');
    expect(view()).toContain('返回在用资产');
    const app = read('apps/knowledge-center-web/frontend/knowledge-center/app.js');
    const html = read('apps/knowledge-center-web/frontend/knowledge-center/knowledge-center-management.html');
    const css = read('apps/knowledge-center-web/frontend/knowledge-center/styles.css');
    expect(html).toContain('id="notice-action"');
    expect(app).toContain("actionLabel: '查看已停用资产'");
    expect(app).toContain("actionHref: '/knowledge-center/assets?lifecycle=inactive'");
    expect(app).toContain('initDismissibleMenus()');
    expect(css).toContain('.asset-more-menu-panel { position: absolute;');
    expect(css).toContain('.asset-more-trigger { min-height: 44px;');
  });

  test('桌面操作栏吸顶且窄屏恢复普通文档流', () => {
    const css = read('apps/knowledge-center-web/frontend/knowledge-center/styles.css');
    expect(css).toContain('@media (min-width: 1301px)');
    expect(css).toContain('.asset-workspace-detail { position: sticky; top: 14px;');
    expect(css).toContain('max-height: calc(var(--kc-viewport-height) - 28px)');
    expect(css).toContain('.asset-workspace.asset-detail-open .asset-workspace-detail { position: static;');
    expect(css).toContain('max-height: none; overflow: visible;');
  });

  test('基础字号令牌接近浏览器 110% 观感', () => {
    const tokens = read('apps/knowledge-center-web/frontend/knowledge-center/common/tokens.css');
    const base = read('apps/knowledge-center-web/frontend/knowledge-center/common/base.css');
    expect(tokens).toContain('--font-size-base: 15.4px;');
    expect(base).toContain('font: var(--font-size-base)/1.55');
  });
});
