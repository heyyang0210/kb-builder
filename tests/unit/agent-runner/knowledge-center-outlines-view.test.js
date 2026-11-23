const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const AdmZip = require('adm-zip');
const { createKnowledgeCenterHandler, KnowledgeCenterConfigError } = require('../../../packages/agent-runner-core/routes/knowledge-center');
const root = path.resolve(__dirname, '../../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

describe('知识中心大纲管理前端契约', () => {
  const view = () => read('apps/knowledge-center-web/frontend/knowledge-center/modules/outlines/view.js');
  test('大纲详细设计归档到知识中心建设平台', () => {
    expect(fs.existsSync(path.join(root, '.codex/知识中心建设平台/03-详细设计/知识中心-大纲管理-详细设计文档.md'))).toBe(true);
  });
  test('列表产品与知识资产一致且只保留四个必要字段', () => {
    const source = view();
    const api = read('apps/knowledge-center-web/frontend/knowledge-center/common/api/platform-api.js');
    expect(api).toContain('/knowledge-center/api/outline/catalog');
    expect(api).toContain('snapshotVersion');
    expect(source).toContain('productDisplayName');
    expect(source).toContain('data-table-view-id="outline-catalog"');
    for (const label of ['手册', '产品', '状态', '更新时间']) expect(source).toContain(`data-table-column-label="${label}"`);
    expect(source).not.toContain('<th>产品 / 业务版本</th>');
    expect(source).not.toContain('<th>待处理</th>');
    expect(source).not.toContain('<th>下一步</th>');
    expect(source).not.toContain('<span>待处理问题</span>');
    expect(source).not.toContain('outline-issue-summary');
    expect(source).toContain('outline-list-link asset-name');
    expect(source).not.toContain('大纲版本：${escapeHtml(value.outlineVersion');
  });
  test('未接入、真实空数据与已有数据采用不同分支', () => {
    expect(view()).toContain("source.status !== 'ok'");
    expect(view()).toContain('大纲服务不可用');
    expect(view()).toContain('尚无大纲');
    expect(view()).not.toContain('23.4.5.100');
  });
  test('未知大纲状态可从统一阶段栏筛选，不混入已知状态', () => {
    const source = view()
      .replace(/^import .*;$/gm, '')
      .replace(/^export function /gm, 'function ');
    const renderOutlines = new Function('dataNote', 'pendingState', 'escapeHtml', 'renderDirectoryTree',
      `${source}\nreturn renderOutlines;`)(() => '', () => '', value => String(value ?? ''), () => '');
    const html = renderOutlines({
      outlineProjection: { status: 'ok', items: [
        { id: 'known-draft', state: 'draft', name: '候选大纲' },
        { id: 'unknown-state', state: 'future_state', name: '新状态大纲' },
      ] },
      outlineView: { listState: { search: '', status: '' } },
      outlinePermissions: {},
    });
    expect(html).toContain('状态待确认');
    expect(html).toContain('服务端返回状态：future_state');
    expect(html).toContain('data-outline-state="unknown"');
    expect(html).toContain('<span>状态待确认</span>');
    expect(html).toContain('<span>待完善</span><strong>1</strong>');
    expect(html).toContain('<span>状态待确认</span><strong>1</strong>');
    expect(html).toContain('href="/knowledge-center/outlines?status=unknown" data-outline-stage="unknown"');
    expect(html).not.toContain('outline-list-summary');
    expect(html).not.toContain('data-outline-status-filter');
  });
  test('详情加载中不误报服务不可用，真实失败和权限不足保持独立语义', () => {
    const source = view()
      .replace(/^import .*;$/gm, '')
      .replace(/^export function /gm, 'function ');
    const pendingState = (title, description) => `<state><strong>${title}</strong><span>${description}</span></state>`;
    const renderOutlines = new Function('dataNote', 'pendingState', 'escapeHtml', 'renderDirectoryTree',
      `${source}\nreturn renderOutlines;`)(() => '', pendingState, value => String(value ?? ''), () => '');
    const args = status => ({ outlineProjection: { status }, outlineView: { isDetail: true, handbookId: 'DB-004' }, outlinePermissions: {} });
    const loading = renderOutlines(args('loading'));
    expect(loading).toContain('正在读取大纲');
    expect(loading).not.toContain('大纲服务不可用');
    expect(renderOutlines(args('unavailable'))).toContain('大纲服务不可用');
    expect(renderOutlines(args('forbidden'))).toContain('无权查看大纲');
    expect(renderOutlines(args('unexpected'))).toContain('暂时无法读取大纲');
  });
  test('尚未建立大纲时问号与填写说明面板成对渲染', () => {
    const source = view()
      .replace(/^import .*;$/gm, '')
      .replace(/^export function /gm, 'function ');
    const renderOutlines = new Function('dataNote', 'pendingState', 'escapeHtml', 'renderDirectoryTree',
      `${source}\nreturn renderOutlines;`)(() => '', (title, description) => `<state>${title}${description}</state>`, value => String(value ?? ''), () => '');
    const html = renderOutlines({
      outlineProjection: { status: 'empty', handbook: { name: '概念手册' } },
      outlineView: { isDetail: true, handbookId: 'DB-002' },
      outlinePermissions: { create: true },
    });
    expect(html).toContain('data-outline-template-help');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('data-outline-template-help-panel');
    expect(html).toContain('大纲模板填写说明');
  });
  function menuFixture() {
    const handlers = {};
    const trigger = { focus: jest.fn() };
    const menu = { open: true, contains: target => target === trigger, querySelector: () => trigger };
    const root = {
      addEventListener: (type, handler) => { handlers[type] = handler; },
      removeEventListener: jest.fn(),
      querySelectorAll: () => menu.open ? [menu] : [],
      querySelector: () => null,
    };
    const source = read('apps/knowledge-center-web/frontend/knowledge-center/common/dismissible-menu.js').replace('export function', 'function');
    const initialize = new Function(`${source}; return initDismissibleMenus;`)();
    return { handlers, trigger, menu, runtime: initialize(root) };
  }
  test('公共菜单保留内部交互，外部点击关闭导入面板', () => {
    const { handlers, menu, runtime } = menuFixture();
    const event = { type: 'click', target: {}, composedPath: () => [menu], preventDefault: jest.fn() };
    handlers.click(event);
    expect(menu.open).toBe(true);
    event.composedPath = () => [];
    handlers.click(event);
    expect(menu.open).toBe(false);
    expect(event.preventDefault).not.toHaveBeenCalled();
    runtime.destroy();
  });
  test('公共菜单仅在Escape时关闭并恢复焦点', () => {
    const { handlers, trigger, menu, runtime } = menuFixture();
    const event = { key: 'Enter', target: {}, preventDefault: jest.fn(), stopImmediatePropagation: jest.fn() };
    handlers.keydown(event);
    expect(menu.open).toBe(true);
    event.key = 'Escape';
    handlers.keydown(event);
    expect(menu.open).toBe(false);
    expect(trigger.focus).toHaveBeenCalledTimes(1);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(() => handlers.keydown(event)).not.toThrow();
    runtime.destroy();
  });
  test('从独立大纲治理接口加载列表和详情', () => {
    const api = read('apps/knowledge-center-web/frontend/knowledge-center/common/api/platform-api.js');
    expect(api).toContain('/knowledge-center/api/outline/catalog');
    expect(api).toContain('loadOutlineData');
    expect(api).toContain('encodeURIComponent(selectedId)');
    expect(api).toContain('const requestedVersion = outlineVersionId == null ? null : items.find');
    expect(api).toContain('requestedVersion || [...items].sort');
    expect(read('apps/knowledge-center-web/frontend/knowledge-center/app.js')).toContain("outlineVersionId: parameters.get('version') || null");
  });
  test('两个职责型工作区和管理边界明确', () => {
    for (const label of ['文档总览', '分工管理', '主责技术领域', '协作技术领域']) expect(view()).toContain(label);
    expect(view()).toContain('data-outline-tab');
    expect(view()).toContain('outline-responsibility-table');
    expect(view()).toContain('data-domain-task-assignee');
    expect(view()).not.toContain('目录与分工');
    expect(view()).not.toContain('预览与发布');
    expect(view()).not.toContain("{ key: 'templates'");
    expect(view()).not.toContain("{ key: 'changes'");
    expect(view()).not.toContain('Codex/Claude Code');
    expect(view()).not.toContain('不调用旧接口冒充正式治理流程');
  });

  test('同版本请求去重，切换候选版本后旧响应不能覆盖新投影', async () => {
    const app = read('apps/knowledge-center-web/frontend/knowledge-center/app.js');
    const state = app.slice(app.indexOf('let outlineLoadSequence ='), app.indexOf('\n    function render()'));
    const loader = app.slice(app.indexOf('async function loadOutlines()'), app.indexOf('\nasync function loadDomainBuildTasksWorkspace()'));
    const appState = { activeView: 'outlines' };
    let route = { isDetail: true, handbookId: 'DB-004', outlineVersionId: 'published' };
    const pending = new Map();
    const loadOutlineData = jest.fn((_handbookId, versionId) => new Promise(resolve => pending.set(versionId, resolve)));
    const load = new Function('appState', 'outlineRouteState', 'loadOutlineData', 'fetchDomainBuildTasks', 'render', 'updateOutlineAssignments',
      `${state}\n${loader}\nreturn loadOutlines;`)(appState, () => route, loadOutlineData, async () => ({ tasks: [] }), () => {}, async () => {});
    const oldRequest = load();
    const duplicateRequest = load();
    expect(loadOutlineData).toHaveBeenCalledTimes(1);
    route = { ...route, outlineVersionId: 'candidate' };
    const newRequest = load();
    expect(loadOutlineData).toHaveBeenCalledTimes(2);
    expect(loadOutlineData).toHaveBeenLastCalledWith('DB-004', 'candidate');
    pending.get('candidate')({ status: 'ok', selectedId: 'candidate' });
    await newRequest;
    expect(appState.outlineProjection.selectedId).toBe('candidate');
    pending.get('published')({ status: 'ok', selectedId: 'published' });
    await Promise.all([oldRequest, duplicateRequest]);
    expect(appState.outlineProjection.selectedId).toBe('candidate');
  });
  test('详情投影先于领域任务完成并立即渲染', async () => {
    const app = read('apps/knowledge-center-web/frontend/knowledge-center/app.js');
    const state = app.slice(app.indexOf('let outlineLoadSequence ='), app.indexOf('\n    function render()'));
    const loader = app.slice(app.indexOf('async function loadOutlines()'), app.indexOf('\nasync function loadDomainBuildTasksWorkspace()'));
    const appState = { activeView: 'outlines' };
    const route = { isDetail: true, handbookId: 'DB-004', outlineVersionId: null };
    let resolveTasks;
    const tasks = new Promise(resolve => { resolveTasks = resolve; });
    const render = jest.fn();
    const updateOutlineAssignments = jest.fn();
    const load = new Function('appState', 'outlineRouteState', 'loadOutlineData', 'fetchDomainBuildTasks', 'render', 'updateOutlineAssignments',
      `${state}\n${loader}\nreturn loadOutlines;`)(appState, () => route, async () => ({ status: 'ok', selectedId: 'published', detail: {} }), () => tasks, render, updateOutlineAssignments);
    const pending = load();
    await new Promise(resolve => setImmediate(resolve));
    expect(appState.outlineProjection).toMatchObject({ status: 'ok', selectedId: 'published' });
    expect(render).toHaveBeenCalledTimes(2);
    resolveTasks({ tasks: [] });
    await pending;
    expect(appState.domainBuildTaskProjection).toMatchObject({ status: 'ok', tasks: [] });
    expect(render).toHaveBeenCalledTimes(2);
    expect(updateOutlineAssignments).toHaveBeenCalledTimes(1);
  });
  test('上传文件由管理员创建候选并由服务端统一解析', () => {
    const source = view();
    const app = read('apps/knowledge-center-web/frontend/knowledge-center/app.js');
    const uploader = read('apps/knowledge-center-web/frontend/js/components/OutlineUploader.js');
    expect(source).toContain('name="file"');
    expect(source).not.toContain('name="productId"');
    expect(source).not.toContain('name="businessVersionTags"');
    for (const label of ['待完善', '待评审', '已发布']) expect(source).toContain(label);
    expect(app).not.toContain("payload.append('productId', productId)");
    expect(app).not.toContain("payload.append('businessVersionTags', JSON.stringify(businessVersionTags))");
    expect(source).toContain('outlinePermissions.create ? importArea(outlineView.handbookId)');
    expect(source).toContain('data-handbook-id');
    expect(app).toContain("payload.append('handbookId', handbookId)");
    expect(uploader).toContain('服务端未返回统一解析结果');
    expect(uploader).not.toContain('_parseMarkdown');
  });

  test('普通用户只读，管理员删除候选且右侧不重复目录事实', () => {
    const source = view();
    const api = read('apps/knowledge-center-web/frontend/knowledge-center/common/api/platform-api.js');
    expect(source).toContain('只有具备大纲管理权限的账号可新增或删除大纲');
    expect(source).toContain('permissions.delete && canDelete(item)');
    expect(source).toContain('item.sourceId');
    expect(source).not.toContain('outline-document-meta');
    expect(source).toContain('data-outline-description');
    expect(api).toContain("method: 'DELETE'");
  });
  test('可恢复删除允许发布版本，排除只读来源和回收站版本', () => {
    const source = view();
    const route = read('packages/agent-runner-core/routes/outline.js');
    expect(source).toContain('!item.readOnly && !item.deletedAt');
    expect(source).toContain('移入回收站');
    expect(route).toContain('function publicOutlineState(value, fallback = \'published\')');
    expect(route).toContain('state: publicOutlineState(governance.state || normalized.state, normalized.state)');
  });
  test('删除异常按过期数据和网络故障展示中文提示', () => {
    const api = read('apps/knowledge-center-web/frontend/knowledge-center/common/api/platform-api.js');
    const app = read('apps/knowledge-center-web/frontend/knowledge-center/app.js');
    expect(api).toContain('OUTLINE_NOT_FOUND');
    expect(api).toContain('当前页面数据已过期');
    expect(api).toContain('failed to fetch');
    expect(api).toContain('无法连接大纲服务');
    expect(app).toContain("title: '删除失败'");
    expect(api).toContain('当前大纲版本已发布或已被替代');
  });
  test('删除 API 保留版本治理恢复提示，不被后端原始 message 覆盖', async () => {
    const api = read('apps/knowledge-center-web/frontend/knowledge-center/common/api/platform-api.js');
    const normalize = api.slice(api.indexOf('function normalizeOutlineError('), api.indexOf('\nexport async function loadPlatformData'));
    const deletion = api.slice(api.indexOf('export async function deleteOutline('), api.indexOf('\nexport async function loadOutlineRecycle(')).replace('export ', '');
    const fetch = jest.fn().mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: { code: 'OUTLINE_IMMUTABLE', message: '当前大纲版本不可修改或删除' } }) });
    const deleteOutline = new Function('fetch', 'outlineEndpoint', `${normalize}\n${deletion}\nreturn deleteOutline;`)(fetch, '/outline');
    await expect(deleteOutline('published-version')).rejects.toMatchObject({ code: 'OUTLINE_IMMUTABLE', status: 409, message: '当前大纲版本已发布或已被替代，不能修改结构；如需调整，请导入新的候选版本。' });
  });
  test('删除和发布成功不复用平台不可用错误样式', () => {
    const app = read('apps/knowledge-center-web/frontend/knowledge-center/app.js');
    expect(app).toContain('function showAppNotice(message, options = {})');
    expect(app).toContain("panel.className = `notice notice-${tone}`");
    expect(app).toContain("byId('error-title').textContent = options.title || '操作提示'");
    expect(app).toContain("byId('retry').hidden = options.retry !== true");
    expect(app).toContain("showAppNotice('大纲已移入回收站', { title: '操作已完成', tone: 'success' })");
    expect(app).toContain("showAppNotice('大纲已发布，领域建设任务已生成。', { title: '发布完成', tone: 'success' })");
    expect(app).toContain("showAppNotice('当前无法读取平台数据，请稍后重新检查。', { title: '平台数据暂时不可用', tone: 'danger', retry: true, scope: 'platform' })");
  });
  test('责任分工和发布缺口展示真实待办状态', () => {
    expect(view()).toContain('待绑定');
    expect(view()).toContain('技术领域分工');
    expect(view()).toContain('当前有效分工');
    expect(view()).toContain('发布大纲');
    expect(view()).toContain('发布后才能进行人员分工');
  });
  test('列表和详情分离，详情使用按需打开的手册信息', () => {
    const source = view();
    expect(source).toContain('outlineView.isDetail');
    expect(source).not.toContain('outline-workspace');
    expect(source).toContain('data-outline-back');
    expect(source).toContain('data-outline-info-toggle');
    expect(source).toContain('outline-stage-canvas');
  });
  test('详情深链、无效手册与工作区参数有明确契约', () => {
    const navigation = read('apps/knowledge-center-web/frontend/knowledge-center/common/state/navigation.js');
    const api = read('apps/knowledge-center-web/frontend/knowledge-center/common/api/platform-api.js');
    const app = read('apps/knowledge-center-web/frontend/knowledge-center/app.js');
    expect(navigation).toContain("startsWith('/knowledge-center/outlines/')");
    expect(api).toContain("status: 'not_found'");
    expect(api).toContain('/knowledge-center/api/outline/catalog');
    expect(app).toContain('outlineLoadSequence');
    expect(app).toContain('sequence !== outlineLoadSequence');
    expect(app).toContain("'outline:list'");
    expect(app).toContain('outlineProjectionKey(current) !== routeKey');
    expect(app).toContain('appState.outlineProjection.routeKey !== outlineProjectionKey()');
    expect(app).toContain("url.searchParams.set('tab'");
    expect(app).toContain('outlineListState.scrollPosition');
    expect(app).toContain("if (view === 'outlines' && wasOutlineDetail) appState.outlineProjection = null");
  });
  test('文档总览使用三栏节点治理并恢复当前 node', () => {
    const source = view();
    const styles = read('apps/knowledge-center-web/frontend/knowledge-center/modules/outlines/outlines.css');
    const app = read('apps/knowledge-center-web/frontend/knowledge-center/app.js');
    expect(source).toContain('outline-governance-workbench');
    expect(source).toContain('aria-label="手册目录导航"');
    expect(source).toContain('data-outline-document');
    expect(source).toContain('outline-node-list');
    expect(source).toContain('outline-node-inspector');
    expect(source).toContain('data-outline-directory');
    expect(source).toContain('data-outline-node-search');
    expect(source).toContain('data-outline-node-domain-filter');
    expect(source).toContain('data-outline-node-owner-filter');
    expect(source).toContain('data-table-view-id="outline-structure"');
    expect(source).not.toContain('data-outline-column-toggle');
    expect(source).toContain('章节名称');
    expect(source).toContain('技术领域');
    expect(source).toContain('主责负责人');
    expect(source).toContain("assignment?.techDomainIds?.[0]");
    expect(source).toContain('按主责负责人筛选');
    expect(source).toContain('操作');
    expect(source).toContain('data-outline-description-edit');
    expect(source).toContain('data-outline-description-dialog');
    expect(source).toContain('data-outline-description-readonly');
    expect(source).not.toContain('data-outline-description="');
    expect(source).toContain('主责技术领域');
    expect(source).toContain('协作技术领域');
    expect(source).toContain('data-outline-primary-domain');
    expect(source).toContain('data-outline-collaborator-domain');
    expect(styles).toContain('.outline-governance-workbench');
    expect(styles).toContain('@media (max-width: 700px)');
    expect(app).toContain("documentId: parameters.get('document')");
    expect(app).toContain("nodeId: parameters.get('node') || parameters.get('document')");
    expect(app).toContain("url.searchParams.set('node', selectedId)");
    expect(app).toContain("url.searchParams.set('document', selectedId)");
    expect(app).toContain("setAttribute('aria-current', 'page')");
    expect(source).not.toContain('data-outline-related-document');
    expect(source).not.toContain('data-outline-node-template');
    expect(source).toContain("published || missingDomains ? ' disabled' : ''");
  });

  test('发布后分工管理显示领域成员和实际责任人', () => {
    const source = view();
    const styles = read('apps/knowledge-center-web/frontend/knowledge-center/modules/outlines/outlines.css');
    const route = read('packages/agent-runner-core/routes/outline.js');
    expect(source).toContain('data-outline-assignment-stats-dialog');
    expect(source).toContain('成员分工');
    expect(source).toContain('outline-assignment-stats-list');
    expect(source).toContain("knownAssignee ? '' : '历史责任人待确认'");
    expect(source).not.toContain('大纲版本：${escapeHtml(value.outlineVersion');
    expect(styles).toContain('.outline-assignment-workspace .outline-responsibility-table td { padding-top: 4px; padding-bottom: 4px; }');
    expect(source).not.toContain('人员分派进度');
    expect(source).toContain('data-domain-task-assignee');
    expect(source).toContain('已发布大纲的内容说明不可修改');
    expect(source).toContain('readonly');
    expect(route).toContain('editVersion: governance.editVersion');
    expect(route).toContain('const projectedNodes = databaseMode');
    expect(route).toContain('nodes: projectedNodes');
    expect(route).toContain("governance: req.query.view === 'compact' ? governanceProjection : governance");
    expect(route).toContain("...(req.query.view === 'compact' ? {} : {");
    expect(route).toContain('readOutlinesAsync()');
    expect(route).toContain('readOutlineGovernanceAsync(req.params.id)');
    expect(route).toContain('impact: buildImpactProjection({ ...outline, governance })');
  });

  test('分工行隐藏重复的已分派状态，统计按列表呈现', () => {
    const source = view()
      .replace(/^import .*;$/gm, '')
      .replace(/^export function /gm, 'function ');
    const renderAssignments = new Function('dataNote', 'pendingState', 'escapeHtml', 'renderDirectoryTree',
      `${source}\nreturn renderOutlineAssignments;`)(() => '', () => '', value => String(value ?? ''), () => '');
    const html = renderAssignments({
      outlineProjection: {
        handbook: { id: 'book-1' },
        detail: {
          id: 'outline-v1-outline_internal', handbookId: 'book-1', nodes: [],
          governance: { state: 'published', effectiveDocumentAssignments: [{ documentId: 'doc-1', techDomainIds: ['compat'] }] },
        },
      },
      outlineView: { domainId: 'compat' },
      outlinePermissions: {},
      domainBuildTaskProjection: { status: 'ok', tasks: [{
        id: 'task-1', manualId: 'book-1', outlineVersionId: 'outline-v1-outline_internal',
        techDomainId: 'compat', techDomainName: '兼容性', domainLeaderId: 'leader', domainLeaderName: '负责人',
        domainMembers: [{ id: 'member', name: '撰写人' }],
        items: [
          { id: 'item-1', documentId: 'doc-1', documentTitle: '已分派.md', assigneeId: 'member' },
          { id: 'item-2', documentId: 'doc-2', documentTitle: '待分派.md', assigneeId: '' },
        ],
      }] },
    });
    const assignedRow = html.match(/<tr[^>]*data-assigned="true"[\s\S]*?<\/tr>/)?.[0];
    const pendingRow = html.match(/<tr[^>]*data-assigned="false"[\s\S]*?<\/tr>/)?.[0];
    expect(assignedRow).toContain('撰写人');
    expect(assignedRow).not.toContain('已分派</small>');
    expect(pendingRow).toContain('待分派');
    expect(html).toContain('outline-assignment-stats-list');
    expect(html).toContain('<dt>主责文档</dt>');
    expect(html).toContain('撰写人');
    expect(html).toContain('1 篇');
    expect(html).not.toContain('outline-assignment-stats-summary');
  });

  test('目录导航只负责定位，支持搜索、目录兼页面和单一展开切换', () => {
    const source = view();
    const app = read('apps/knowledge-center-web/frontend/knowledge-center/app.js');
    const styles = read('apps/knowledge-center-web/frontend/knowledge-center/modules/outlines/outlines.css');
    expect(source).not.toContain('data-outline-unassigned-filter');
    expect(source).not.toContain('data-outline-document-unassigned');
    expect(source).toContain('data-outline-tree-toggle');
    expect(source).toContain('data-outline-directory-search');
    expect(source).toContain('allDocuments[0]?.id || allNodes[0]?.id || null');
    expect(source).not.toContain('data-outline-tree-expand="');
    expect(source).not.toContain("emptyFiltered ? ' disabled' : ''");
    expect(source).not.toContain('全部展开</button>');
    expect(source).not.toContain('全部收起</button>');
    expect(app).toContain("filterUnassigned: parameters.get('unassigned') === 'true'");
    expect(app).not.toContain('data-outline-unassigned-filter');
    expect(app).not.toContain('data-outline-tree-expand');
    expect(styles).toContain('.outline-navigation-document-button.is-unassigned');
  });

  test('目录移动使用右键菜单和服务端完整顺序', () => {
    const source = view();
    expect(source).toContain('data-outline-context-menu');
    expect(source).toContain('data-outline-move-dialog');
    expect(source).toContain('directoryChoiceTree');
    expect(source).not.toContain('draggable="true"');
    expect(source).not.toContain('outline-v1</');
  });

  test('分工管理展示领域任务与成员分派', () => {
    const source = view();
    const app = read('apps/knowledge-center-web/frontend/knowledge-center/app.js');
    const combobox = read('apps/knowledge-center-web/frontend/knowledge-center/common/searchable-combobox.js');
    expect(source).toContain('data-domain-task-assignee');
    expect(source).toContain('data-outline-assignment-domain-filter');
    expect(source).toContain('查看分工统计');
    expect(source).toContain('主责文档');
    expect(source).toContain('协作文档');
    expect(source).toContain('data-table-column-label="责任人"');
    expect(source).not.toContain('<th>人员分派</th>');
    expect(source).not.toContain('页面责任人');
    expect(source).toContain('历史责任人 ${escapeHtml(item.assigneeName || assigneeId)}（不在当前团队）');
    expect(source).toContain('data-outline-assignment-directory');
    expect(source).toContain('placeholder="搜索目录或文档"');
    expect(source).toContain('data-navigation-default="280"');
    expect(source).toContain('data-navigation-max="380"');
    expect(source).toContain('class="outline-assignment-batch" hidden');
    expect(source).not.toContain('<span>团队成员</span><strong>${people.length} 人</strong>');
    expect(source).not.toContain('管理团队');
    expect(app).toContain("batchBar.hidden = !selected.length");
    for (const selector of ['[data-domain-task-assignee]', '[data-outline-assignment-domain-filter]', '[data-outline-assignment-member-filter]', '[data-outline-batch-assignee]']) {
      expect(combobox).toContain(selector);
    }
  });

  test('团队未配置时阻断人员分派并提供恢复入口', () => {
    const source = view();
    const app = read('apps/knowledge-center-web/frontend/knowledge-center/app.js');
    expect(source).toContain('if (!activeTask.domainLeaderId)');
    expect(source).toContain('团队尚未配置');
    expect(source).toContain('现有 ${items.length} 篇文档及历史责任记录不会被修改');
    expect(source).toContain('data-outline-team-config-link');
    expect(source).toContain('permissions.platformAdmin');
    expect(app).toContain('platformAdmin: isPlatformAdmin()');
  });

  test('大纲管理从手册操作栏进入，手册名称不承担跳转', () => {
    const source = view();
    const assets = read('apps/knowledge-center-web/frontend/knowledge-center/modules/assets/view.js');
    const api = read('apps/knowledge-center-web/frontend/knowledge-center/common/api/platform-api.js');
    const route = read('packages/agent-runner-core/routes/outline.js');
    expect(assets).toContain('href: `/knowledge-center/outlines/${encodeURIComponent(id)}`');
    expect(assets).not.toContain('data-handbook-outline');
    expect(assets).toContain('data-asset-edit-open');
    expect(api).toContain("allItems.filter(item => String(item.handbookId || item.manualId) === String(handbookId))");
    expect(api).toContain("status: 'empty'");
    expect(source).toContain('该手册尚未建立大纲');
    expect(route).toContain('metadata.outlines.filter(hasPersistedOutlineVersion)');
    expect(route).toContain("outlineError(res, error, 'OUTLINE_DETAIL_FAILED'");
  });
  test('大纲管理不提供手册管理入口', () => {
    const source = view();
    const app = read('apps/knowledge-center-web/frontend/knowledge-center/app.js');
    expect(source).not.toContain('data-handbook-manage');
    expect(source).not.toContain('/knowledge-center/assets?handbookId=');
    expect(source).not.toContain('outlinePermissions.manage');
    expect(app).not.toContain('manage: isPlatformAdmin()');
  });
  test('大纲管理提供同源正式 XLSX 模板下载入口', () => {
    const source = view();
    const server = read('packages/agent-runner-core/routes/knowledge-center.js');
    const gateway = read('apps/knowledge-center-web/frontend-server.js');
    expect(source).toContain('下载大纲模板');
    expect(source).toContain('/knowledge-center/api/outline/template');
    expect(source).toContain('download="大纲模板.xlsx"');
    expect(source).toContain('data-outline-template-help');
    expect(source).not.toContain('<dt>四级目录</dt>');
    for (const header of ['路径层级1', '路径层级2', '路径层级3', '路径层级4', '内容说明', '技术领域分工']) {
      expect(source).toContain(header);
    }
    expect(server).toContain("pathname === '/knowledge-center/api/outline/template'");
    expect(server).toContain('OUTLINE_TEMPLATE_UNAVAILABLE');
    expect(gateway).toContain('KNOWLEDGE_CENTER_OUTLINE_TEMPLATE_PATH');
    expect(gateway).toContain('outlineTemplateRules.templatePath');
  });
  test('大纲管理提供自然路径SQL参考手册样例下载入口', () => {
    const source = view();
    const server = read('packages/agent-runner-core/routes/knowledge-center.js');
    const gateway = read('apps/knowledge-center-web/frontend-server.js');
    expect(source).toContain('下载SQL参考手册示例');
    expect(source).toContain('/knowledge-center/api/outline/sample');
    expect(source).toContain('download="SQL参考手册大纲示例.xlsx"');
    expect(server).toContain("pathname === '/knowledge-center/api/outline/sample'");
    expect(server).toContain('OUTLINE_SAMPLE_UNAVAILABLE');
    expect(gateway).toContain('KNOWLEDGE_CENTER_OUTLINE_SAMPLE_PATH');
    expect(gateway).toContain('outlineTemplateRules.sampleDownloadPath');
    expect(read('tools/repository/generate-sql-outline-sample.js')).toContain('rules.sampleSource');
    expect(source).toContain('data-outline-validate');
    expect(source).toContain('校验不创建候选');
    expect(source).toContain('排在该目录其他页面和子目录内容之前');
    expect(server).toContain("pathname === '/knowledge-center/api/outline/validate'");
  });

  test('模板与样例路径显式注入路由模块且下载不会击穿平台进程', async () => {
    const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-center-outline-download-'));
    const templatePath = path.join(fixtureRoot, 'template.xlsx');
    const samplePath = path.join(fixtureRoot, 'sample.xlsx');
    fs.writeFileSync(templatePath, 'template');
    fs.writeFileSync(samplePath, 'sample');
    const handler = createKnowledgeCenterHandler({
      // Outline HTTP fixtures must not recover jobs from the shared production store.
      handbookProductionService: {},
      config: {
        KNOWLEDGE_CENTER_PREFIX: '/knowledge-center', KNOWLEDGE_CENTER_ROOT: fixtureRoot, KNOWLEDGE_CENTER_ENTRY: 'index.html',
        OUTLINE_TEMPLATE_PATH: templatePath, OUTLINE_SAMPLE_PATH: samplePath,
        PINGCODE_PREFIX: '/pingcode', PINGCODE_ROOT: fixtureRoot,
      },
      stores: {
        knowledgeAssetsStore: { read: () => ({ handbooks: [] }), write() {} },
        brandIconStore: {},
        domainStore: { readTechDomains: () => ({ techDomains: [{ name: '内核' }, { name: 'SQL 引擎' }] }) },
      },
      moduleRegistry: { get: () => ({ authorize: async () => ({ allowedActions: ['outline:read'], user: { id: 'outline-reader' } }) }) },
      sendFile() {}, proxyAuth() {}, proxyCleaning() {}, proxyOutline() {}, proxyPermission() {}, handleIncrementalBuild() {},
    });
    const server = http.createServer(handler);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const template = await fetch(`http://127.0.0.1:${server.address().port}/knowledge-center/api/outline/template`);
      expect(template.status).toBe(200);
      expect(template.headers.get('content-type')).toContain('spreadsheetml.sheet');
      const zip = new AdmZip(Buffer.from(await template.arrayBuffer()));
      const workbookXml = zip.getEntry('xl/workbook.xml').getData().toString('utf8');
      const sheetXml = zip.getEntry('xl/worksheets/sheet1.xml').getData().toString('utf8');
      const domainSheetXml = zip.getEntry('xl/worksheets/sheet2.xml').getData().toString('utf8');
      expect(workbookXml).toContain('TECH_DOMAIN_OPTIONS');
      expect(sheetXml).toContain('dataValidations');
      expect(sheetXml).toContain('sqref="F2:F1000"');
      expect(sheetXml).toContain('路径层级1');
      expect(sheetXml).not.toContain('一级目录');
      expect(domainSheetXml).toContain('内核');
      expect(domainSheetXml).toContain('SQL 引擎');
      const sample = await fetch(`http://127.0.0.1:${server.address().port}/knowledge-center/api/outline/sample`);
      expect(sample.status).toBe(200);
      expect(await sample.text()).toBe('sample');
      fs.unlinkSync(templatePath);
      const missingTemplate = await fetch(`http://127.0.0.1:${server.address().port}/knowledge-center/api/outline/template`);
      expect(missingTemplate.status).toBe(404);
      const remainingSample = await fetch(`http://127.0.0.1:${server.address().port}/knowledge-center/api/outline/sample`);
      expect(remainingSample.status).toBe(200);
    } finally {
      await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  }, 60_000);

  test('模板或样例启动配置不合法时拒绝创建路由工厂', () => {
    const options = {
      config: { KNOWLEDGE_CENTER_PREFIX: '/knowledge-center', KNOWLEDGE_CENTER_ROOT: os.tmpdir(), KNOWLEDGE_CENTER_ENTRY: 'index.html' },
      stores: { knowledgeAssetsStore: { read: () => ({ handbooks: [] }), write() {} }, brandIconStore: {} },
      moduleRegistry: { get: () => ({ authorize: async () => ({ allowedActions: ['outline:read'], user: { id: 'outline-reader' } }) }) },
      sendFile() {}, proxyAuth() {}, proxyCleaning() {}, proxyOutline() {}, proxyPermission() {}, handleIncrementalBuild() {},
    };
    expect(() => createKnowledgeCenterHandler(options)).toThrow(KnowledgeCenterConfigError);
    expect(() => createKnowledgeCenterHandler(options)).toThrow('OUTLINE_TEMPLATE_PATH 缺失');
    options.config.OUTLINE_TEMPLATE_PATH = path.join(root, 'knowledge/outlines/大纲模板.xlsx');
    expect(() => createKnowledgeCenterHandler(options)).toThrow('OUTLINE_SAMPLE_PATH 缺失');
    options.config.OUTLINE_SAMPLE_PATH = 'sample.xlsx';
    expect(() => createKnowledgeCenterHandler(options)).toThrow('OUTLINE_SAMPLE_PATH 必须为绝对路径');
    options.config.OUTLINE_SAMPLE_PATH = path.join(root, 'prompt.md');
    expect(() => createKnowledgeCenterHandler(options)).toThrow('OUTLINE_SAMPLE_PATH 必须指向 .xlsx 文件');
    options.config.OUTLINE_SAMPLE_PATH = path.join(root, 'missing.xlsx');
    expect(() => createKnowledgeCenterHandler(options)).toThrow('OUTLINE_SAMPLE_PATH 不存在或不可读');
    const directoryFixture = fs.mkdtempSync(path.join(os.tmpdir(), 'outline-directory-'));
    const workbookDirectory = path.join(directoryFixture, 'sample.xlsx');
    fs.mkdirSync(workbookDirectory);
    options.config.OUTLINE_SAMPLE_PATH = workbookDirectory;
    try {
      expect(() => createKnowledgeCenterHandler(options)).toThrow('OUTLINE_SAMPLE_PATH 必须指向普通文件');
    } finally {
      fs.rmSync(directoryFixture, { recursive: true, force: true });
    }
  });

  test('导入、预检和创建手册的真实HTTP请求均校验动作并传递实时会话', async () => {
    let session = null;
    const proxyOutline = jest.fn((_req, res, currentSession) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ actor: currentSession.user.id }));
    });
    const handler = createKnowledgeCenterHandler({
      // Outline HTTP fixtures must not recover jobs from the shared production store.
      handbookProductionService: {},
      config: {
        KNOWLEDGE_CENTER_PREFIX: '/knowledge-center', KNOWLEDGE_CENTER_ROOT: root, KNOWLEDGE_CENTER_ENTRY: 'index.html',
        OUTLINE_TEMPLATE_PATH: path.join(root, 'knowledge/outlines/大纲模板.xlsx'), OUTLINE_SAMPLE_PATH: path.join(root, 'knowledge/outlines/SQL参考手册大纲示例.xlsx'),
        PINGCODE_PREFIX: '/pingcode', PINGCODE_ROOT: root,
      },
      stores: { knowledgeAssetsStore: { read: () => ({ handbooks: [] }), write() {} }, brandIconStore: {} },
      moduleRegistry: { get: () => ({ authorize: async () => session }) },
      sendFile() {}, proxyAuth() {}, proxyCleaning() {}, proxyOutline, proxyPermission() {}, handleIncrementalBuild() {},
    });
    const server = http.createServer(handler);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    try {
      for (const endpoint of ['import', 'validate', 'handbooks']) {
        session = null;
        const anonymous = await fetch(`${base}/knowledge-center/api/outline/${endpoint}`, { method: 'POST' });
        expect(anonymous.status).toBe(401);
        session = { allowedActions: ['outline:read'], user: { id: 'reader' } };
        const denied = await fetch(`${base}/knowledge-center/api/outline/${endpoint}`, { method: 'POST' });
        expect(denied.status).toBe(403);
        expect((await denied.json()).error.code).toBe('OUTLINE_PERMISSION_DENIED');
        session = { allowedActions: ['outline:create'], user: { id: 'creator' } };
        const before = proxyOutline.mock.calls.length;
        const allowed = await fetch(`${base}/knowledge-center/api/outline/${endpoint}`, { method: 'POST', headers: { 'x-outline-actor': 'forged' } });
        expect(allowed.status).toBe(200);
        expect(await allowed.json()).toEqual({ actor: 'creator' });
        expect(proxyOutline).toHaveBeenCalledTimes(before + 1);
        expect(proxyOutline.mock.calls.at(-1)[2]).toBe(session);
      }
      expect(proxyOutline).toHaveBeenCalledTimes(3);
    } finally { await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); }
  });
});
