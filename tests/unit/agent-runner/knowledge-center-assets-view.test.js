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
    expect(view()).toContain('class="sr-only">手册资产</h2>');
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

  test('手册名称是唯一查看入口，操作栏不重复列表事实', () => {
    const actionPanel = view().split('function renderActionPanel')[1].split('function renderPagination')[0];
    expect(view()).not.toContain('>查看</button>');
    expect(view()).not.toContain('asset-detail-facts');
    expect(view()).toContain('aria-label="当前手册操作"');
    expect(view()).not.toContain('<th>管理</th>');
    expect(actionPanel).not.toContain('A：');
    expect(actionPanel).not.toContain('B：');
  });

  test('操作入口同级展示，关闭使用 Lucide 图标', () => {
    expect(view()).not.toContain('>文档工作<');
    expect(view()).not.toContain('>手册管理<');
    expect((view().match(/class="asset-action-row"/g) || []).length).toBeGreaterThanOrEqual(5);
    expect(view()).toContain('class="asset-name-link"');
    expect(view()).toContain('data-lucide="x"');
    expect(view()).not.toContain('asset-detail-close" type="button" data-asset-detail-close aria-label="关闭手册操作" title="关闭手册操作">×');
    const css = read('apps/knowledge-center-web/frontend/knowledge-center/styles.css');
    expect(css).toContain('.asset-name-link { color: var(--color-brand)');
    expect(css).toContain('.asset-action-card {');
    expect(css).toContain('.asset-action-row {');
    expect(css).toContain('.icon-button.asset-detail-close svg { width: 16px; height: 16px; }');
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
    expect(view()).toContain('已停用资产');
    expect(view()).not.toContain('包含已归档');
    expect(view()).not.toContain('手册发布');
    expect(view()).toContain('data-asset-detail-close');
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

  test('基础字号令牌接近浏览器 110% 观感', () => {
    const tokens = read('apps/knowledge-center-web/frontend/knowledge-center/common/tokens.css');
    const base = read('apps/knowledge-center-web/frontend/knowledge-center/common/base.css');
    expect(tokens).toContain('--font-size-base: 15.4px;');
    expect(base).toContain('font: var(--font-size-base)/1.55');
  });
});
