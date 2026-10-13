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
    expect(fs.existsSync(path.join(root, 'docs/agent-runner/modules/outline-management/development/44-知识中心大纲统一解析展示与管理员增删权限设计.md'))).toBe(false);
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
    expect(view()).toContain('outlineStructureVersion');
    expect(view()).toContain('大纲版本');
  });
  test('未接入、真实空数据与已有数据采用不同分支', () => {
    expect(view()).toContain("source.status !== 'ok'");
    expect(view()).toContain('大纲服务不可用');
    expect(view()).toContain('尚无大纲');
    expect(view()).not.toContain('23.4.5.100');
  });
  test('从独立大纲治理接口加载列表和详情', () => {
    const api = read('apps/knowledge-center-web/frontend/knowledge-center/common/api/platform-api.js');
    expect(api).toContain('/knowledge-center/api/outline/catalog');
    expect(api).toContain('loadOutlineData');
    expect(api).toContain('encodeURIComponent(selectedId)');
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
    expect(app).toContain("showAppNotice('当前无法读取平台数据，请稍后重新检查。', { title: '平台数据暂时不可用', tone: 'danger', retry: true })");
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
    const route = read('packages/agent-runner-core/routes/outline.js');
    expect(source).toContain('data-outline-assignment-stats-dialog');
    expect(source).toContain('成员负载');
    expect(source).not.toContain('人员分派进度');
    expect(source).toContain('data-domain-task-assignee');
    expect(source).toContain('已发布大纲的内容说明不可修改');
    expect(source).toContain('readonly');
    expect(route).toContain('editVersion: governance.editVersion');
    expect(route).toContain('nodes: isDatabaseMode()');
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
    expect(assets).toContain('href="/knowledge-center/outlines/${encodeURIComponent(id)}"');
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
    for (const header of ['一级目录', '二级目录', '三级目录', '页面', '内容说明', '技术领域分工']) {
      expect(source).toContain(header);
    }
    expect(server).toContain("pathname === '/knowledge-center/api/outline/template'");
    expect(server).toContain('OUTLINE_TEMPLATE_UNAVAILABLE');
    expect(gateway).toContain('KNOWLEDGE_CENTER_OUTLINE_TEMPLATE_PATH');
  });
  test('大纲管理提供按六列模板填充的数据库管理手册样例下载入口', () => {
    const source = view();
    const server = read('packages/agent-runner-core/routes/knowledge-center.js');
    const gateway = read('apps/knowledge-center-web/frontend-server.js');
    expect(source).toContain('下载数据库管理手册示例');
    expect(source).toContain('/knowledge-center/api/outline/sample');
    expect(source).toContain('download="基本数据库管理手册大纲示例.xlsx"');
    expect(server).toContain("pathname === '/knowledge-center/api/outline/sample'");
    expect(server).toContain('OUTLINE_SAMPLE_UNAVAILABLE');
    expect(gateway).toContain('KNOWLEDGE_CENTER_OUTLINE_SAMPLE_PATH');
    expect(read('tools/repository/generate-database-outline-sample.js')).toContain("const headers = ['一级目录', '二级目录', '三级目录', '页面', '内容说明', '技术领域分工'];");
  });

  test('模板与样例路径显式注入路由模块且下载不会击穿平台进程', async () => {
    const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-center-outline-download-'));
    const templatePath = path.join(fixtureRoot, 'template.xlsx');
    const samplePath = path.join(fixtureRoot, 'sample.xlsx');
    fs.writeFileSync(templatePath, 'template');
    fs.writeFileSync(samplePath, 'sample');
    const handler = createKnowledgeCenterHandler({
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
      await new Promise(resolve => server.close(resolve));
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  test('模板或样例启动配置不合法时拒绝创建路由工厂', () => {
    const options = {
      config: { KNOWLEDGE_CENTER_PREFIX: '/knowledge-center', KNOWLEDGE_CENTER_ROOT: os.tmpdir(), KNOWLEDGE_CENTER_ENTRY: 'index.html' },
      stores: { knowledgeAssetsStore: { read: () => ({ handbooks: [] }), write() {} }, brandIconStore: {} },
      moduleRegistry: { get: () => ({ authorize: async () => ({ allowedActions: ['outline:read'], user: { id: 'outline-reader' } }) }) },
      sendFile() {}, proxyAuth() {}, proxyCleaning() {}, proxyOutline() {}, proxyPermission() {}, handleIncrementalBuild() {},
    };
    expect(() => createKnowledgeCenterHandler(options)).toThrow(KnowledgeCenterConfigError);
    expect(() => createKnowledgeCenterHandler(options)).toThrow('OUTLINE_TEMPLATE_PATH 缺失');
    options.config.OUTLINE_TEMPLATE_PATH = path.join(root, '大纲模板.xlsx');
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
});
