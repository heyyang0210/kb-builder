const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { createKnowledgeCenterHandler, KnowledgeCenterConfigError } = require('../../../packages/agent-runner-core/routes/knowledge-center');
const root = path.resolve(__dirname, '../../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

describe('知识中心大纲管理前端契约', () => {
  const view = () => read('apps/knowledge-center-web/frontend/knowledge-center/modules/outlines/view.js');
  test('大纲详细设计归档到知识中心建设平台', () => {
    expect(fs.existsSync(path.join(root, '.codex/知识中心建设平台/03-详细设计/知识中心-大纲管理-详细设计文档.md'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'docs/agent-runner/modules/outline-management/development/44-知识中心大纲统一解析展示与管理员增删权限设计.md'))).toBe(false);
  });
  test('分别展示产品、业务版本标签和大纲版本', () => {
    expect(view()).toContain('productId');
    expect(view()).toContain('businessVersionTags');
    expect(view()).toContain('outlineStructureVersion');
    expect(view()).toContain('业务版本');
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
    expect(api).toContain('/knowledge-center/api/outline/governance');
    expect(api).toContain('loadOutlineData');
    expect(api).toContain('encodeURIComponent(selectedId)');
  });
  test('治理子视图和逆向提取边界明确', () => {
    for (const label of ['目录与分工', '预览与发布', '责任分工']) expect(view()).toContain(label);
    expect(view()).not.toContain("key: 'responsibility'");
    expect(view()).not.toContain('outline-responsibility-table');
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

  test('普通用户只读，管理员删除候选且目录显示编号和内容说明', () => {
    const source = view();
    const api = read('apps/knowledge-center-web/frontend/knowledge-center/common/api/platform-api.js');
    expect(source).toContain('只有具备大纲管理权限的账号可新增或删除大纲');
    expect(source).toContain('permissions.delete && canDelete(item)');
    expect(source).toContain('item.sourceId');
    expect(source).toContain('outline-document-meta');
    expect(source).toContain('data-outline-description');
    expect(api).toContain("method: 'DELETE'");
  });
  test('删除异常按过期数据和网络故障展示中文提示', () => {
    const api = read('apps/knowledge-center-web/frontend/knowledge-center/common/api/platform-api.js');
    const app = read('apps/knowledge-center-web/frontend/knowledge-center/app.js');
    expect(api).toContain('OUTLINE_NOT_FOUND');
    expect(api).toContain('当前页面数据已过期');
    expect(api).toContain('failed to fetch');
    expect(api).toContain('无法连接大纲服务');
    expect(app).toContain("title: '删除失败'");
  });
  test('责任分工和发布缺口展示真实待办状态', () => {
    expect(view()).toContain('待绑定');
    expect(view()).toContain('技术领域分工');
    expect(view()).toContain('当前有效分工');
    expect(view()).toContain('发布门禁可通过');
    expect(view()).toContain('发布并生成建设任务');
  });
  test('列表和详情分离，详情使用按需打开的手册信息', () => {
    const source = view();
    expect(source).toContain('outlineView.isDetail');
    expect(source).not.toContain('outline-workspace');
    expect(source).toContain('data-outline-back');
    expect(source).toContain('data-outline-info-toggle');
    expect(source).toContain('outline-stage-canvas');
  });
  test('详情深链、无效手册与阶段参数有明确契约', () => {
    const navigation = read('apps/knowledge-center-web/frontend/knowledge-center/common/state/navigation.js');
    const api = read('apps/knowledge-center-web/frontend/knowledge-center/common/api/platform-api.js');
    const app = read('apps/knowledge-center-web/frontend/knowledge-center/app.js');
    expect(navigation).toContain("startsWith('/knowledge-center/outlines/')");
    expect(api).toContain("status: 'not_found'");
    expect(app).toContain("url.searchParams.set('stage'");
    expect(app).toContain('outlineListState.scrollPosition');
  });
  test('目录阶段使用文档导航并恢复当前 document', () => {
    const source = view();
    const styles = read('apps/knowledge-center-web/frontend/knowledge-center/modules/outlines/outlines.css');
    const app = read('apps/knowledge-center-web/frontend/knowledge-center/app.js');
    expect(source).toContain('outline-directory-workspace');
    expect(source).toContain('aria-label="手册目录导航"');
    expect(source).toContain('data-outline-document');
    expect(source).toContain('outline-document-content');
    expect(source).toContain('正文内容尚未接入');
    expect(source).toContain('保存目录与分工');
    expect(source).toContain('data-outline-domain-node');
    expect(source).toContain('outline-publish-domain-preview');
    expect(styles).toContain('.outline-directory-workspace');
    expect(styles).toContain('@media (max-width: 700px)');
    expect(app).toContain("documentId: parameters.get('document')");
    expect(app).toContain("url.searchParams.set('document', selectedId)");
    expect(app).toContain("setAttribute('aria-current', 'page')");
  });

  test('发布后页面概览显示当前领域和实际责任人', () => {
    const source = view();
    const route = read('packages/agent-runner-core/routes/outline.js');
    expect(source).toContain('页面归属');
    expect(source).toContain('effective?.ownerships');
    expect(source).toContain('已发布大纲只能调整技术领域');
    expect(source).toContain('readonly');
    expect(route).toContain('editVersion: governance.editVersion');
    expect(route).toContain('nodes: String(process.env.KNOWLEDGE_STORAGE_MODE');
  });

  test('目录导航支持未分工定位、目录兼页面和单一展开切换', () => {
    const source = view();
    const app = read('apps/knowledge-center-web/frontend/knowledge-center/app.js');
    const styles = read('apps/knowledge-center-web/frontend/knowledge-center/modules/outlines/outlines.css');
    expect(source).toContain('data-outline-unassigned-filter');
    expect(source).toContain('data-outline-document-unassigned');
    expect(source).toContain('data-outline-tree-toggle');
    expect(source).toContain('所有页面均已完成分工');
    expect(source).toContain('documents[0]?.id || null');
    expect(source).not.toContain('data-outline-tree-expand="');
    expect(source).not.toContain("emptyFiltered ? ' disabled' : ''");
    expect(source).not.toContain('全部展开</button>');
    expect(source).not.toContain('全部收起</button>');
    expect(app).toContain("filterUnassigned: parameters.get('unassigned') === 'true'");
    expect(app).toContain('data-outline-unassigned-filter');
    expect(app).not.toContain('data-outline-tree-expand');
    expect(styles).toContain('.outline-navigation-document-button.is-unassigned');
  });

  test('大纲管理从手册操作栏进入，手册名称不承担跳转', () => {
    const source = view();
    const assets = read('apps/knowledge-center-web/frontend/knowledge-center/modules/assets/view.js');
    const api = read('apps/knowledge-center-web/frontend/knowledge-center/common/api/platform-api.js');
    expect(assets).toContain('href="/knowledge-center/outlines/${encodeURIComponent(id)}"');
    expect(assets).not.toContain('data-handbook-outline');
    expect(assets).toContain('data-asset-edit-open');
    expect(api).toContain("allItems.filter(item => String(item.handbookId || item.manualId) === String(handbookId))");
    expect(api).toContain("status: 'empty'");
    expect(source).toContain('该手册尚未建立大纲');
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
      stores: { knowledgeAssetsStore: { read: () => ({ handbooks: [] }), write() {} }, brandIconStore: {} },
      moduleRegistry: { get: () => ({ authorize: async () => ({ allowedActions: ['outline:read'], user: { id: 'outline-reader' } }) }) },
      sendFile() {}, proxyAuth() {}, proxyCleaning() {}, proxyOutline() {}, proxyPermission() {}, handleIncrementalBuild() {},
    });
    const server = http.createServer(handler);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      for (const [suffix, expected] of [['template', 'template'], ['sample', 'sample']]) {
        const response = await fetch(`http://127.0.0.1:${server.address().port}/knowledge-center/api/outline/${suffix}`);
        expect(response.status).toBe(200);
        expect(await response.text()).toBe(expected);
      }
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
