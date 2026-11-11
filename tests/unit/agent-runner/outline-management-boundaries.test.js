const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const api = require('../../../packages/agent-runner-core/routes/outline-management');

// Exercise public import and governance contracts with isolated, real input files.
describe('大纲治理公开入口边界', () => {
  let root;
  let previousConfig;
  const domains = [{ id: 'ops', code: 'operations', name: '运维' }];
  const headers = ['层级', '节点名称', '节点类型', '内容说明', '技术领域分工'];
  const fresh = () => ({ id: 'outline-boundary', state: 'draft', nodes: [
    { id: 'root', kind: 'directory', title: '基础', order: 1 },
    { id: 'doc', kind: 'document', title: '安装', parentId: 'root', order: 2 }
  ] });
  function workbook(rows, count = 1) {
    const book = XLSX.utils.book_new();
    for (let i = 0; i < count; i++) XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), `目录${i}`);
    const filename = path.join(root, 'outline.xlsx');
    XLSX.writeFile(book, filename);
    return filename;
  }
  function expectError(outline, payload, code, status = 422) {
    const before = JSON.stringify(outline);
    expect(() => api.saveFileGovernance(outline, payload, domains)).toThrow(expect.objectContaining({ code, status }));
    expect(JSON.stringify(outline)).toBe(before);
  }
  beforeEach(() => {
    const parent = path.resolve(__dirname, '../../../runtime/test-results/outline-boundaries');
    fs.mkdirSync(parent, { recursive: true });
    root = fs.mkdtempSync(path.join(parent, 'case-'));
    previousConfig = process.env.TECH_DOMAINS_CONFIG;
  });
  afterEach(() => {
    if (previousConfig === undefined) delete process.env.TECH_DOMAINS_CONFIG;
    else process.env.TECH_DOMAINS_CONFIG = previousConfig;
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('多个非空可见工作表返回结构化模板错误', () => {
    expect(() => api.parseXlsxOutlineFile(workbook([headers, ['1', '基础', '目录']], 2)))
      .toThrow(expect.objectContaining({ details: expect.anything() }));
  });
  test.each([
    [['0', '基础', '目录'], '层级必须是 1 至 5'],
    [['6', '基础', '目录'], '层级必须是 1 至 5'],
    [['1.5', '基础', '目录'], '层级必须是 1 至 5'],
    [['1', '基础', '未知'], '节点类型必须是'],
    [['1', '基础', '页面'], '一至四级节点不能'],
    [['2', '基础', '目录'], '必须从一级目录开始'],
    [['1', '', '目录'], '节点名称不能为空'],
    [['5', '基础', '目录'], '五级节点只能']
  ])('层级表拒绝非法行 %j', (row, message) => {
    expect(() => api.parseXlsxOutlineFile(workbook([headers, row]))).toThrow(message);
  });
  test('列式目录拒绝中间空目录后继续填写下级', () => {
    const file = workbook([
      ['一级目录', '二级目录', '三级目录', '页面', '内容说明', '技术领域分工'],
      ['基础', '', '下级', '页面', '说明', '']
    ]);
    expect(() => api.parseXlsxOutlineFile(file)).toThrow();
  });
  test('真实Markdown文件忽略依赖说明、树形图与推荐条目', () => {
    const file = path.join(root, 'outline.md');
    fs.writeFileSync(file, '# 示例\n## 一、基础 ⭐\n- **1.1 安装**\n  - 1.1.1 环境：环境说明\n### 章节依赖\n├── 树\n🎯 目标\n- **必须** 配置\n- **推荐** 配置');
    const content = api.parseOutlineFile(file);
    expect(JSON.stringify(content)).toContain('环境');
    expect(JSON.stringify(content)).not.toContain('推荐');
  });
  test('部分children别名保留嵌套文档及领域别名', () => {
    const content = api.normalizeContent({ parts: [{ title: '基础', techDomainId: '运维', children: [
      { title: '安装', techDomain: 'OPERATIONS', subchapters: [{ name: '子目录', knowledgePoints: [{ code: 'leaf', title: '页面' }] }] }
    ] }] });
    api.normalizeImportedTechDomains(content, domains);
    expect(content.parts[0].techDomainIds).toEqual(['ops']);
    expect(content.parts[0].children[0].techDomainIds).toEqual(['ops']);
    expect(content.parts[0].children[0].children[0].documents[0].id).toBe('leaf');
  });
  test.each(['part', 'directory'])('未知%s领域返回完整未知值列表', target => {
    const content = { parts: [{ techDomainIds: target === 'part' ? ['未知部分'] : [], chapters: [
      { techDomainIds: target === 'directory' ? ['未知目录'] : [] }
    ] }] };
    expect(() => api.normalizeImportedTechDomains(content, domains)).toThrow(expect.objectContaining({
      code: 'INVALID_TECH_DOMAIN_ASSIGNMENT', details: { invalidTechDomains: [target === 'part' ? '未知部分' : '未知目录'] }
    }));
  });
  test('品牌产品加入目录，映射按新旧文档标识去重', () => {
    expect(api.buildCatalog([], { brand: { productName: '数据库' } })).toEqual([{ id: 'profile-product', name: '数据库', versionTags: [] }]);
    const outline = fresh();
    outline.responsibilityMappings = [{ documentId: 'a' }, { knowledgePointId: 'a' }, { knowledgePointId: 'b' }, {}];
    expect(api.buildResponsibilityProjection(outline).summary.mappedKnowledgePoints).toBe(2);
  });
  test.each(['missing', '{', '{}', '{"techDomains":[{"id":"ops"}]}'])('技术领域配置缺失或损坏安全降级 %s', text => {
    const file = path.join(root, 'domains.json');
    process.env.TECH_DOMAINS_CONFIG = file;
    if (text !== 'missing') fs.writeFileSync(file, text);
    expect(api.readTechDomainConfig()).toEqual(text.includes('ops') ? [{ id: 'ops' }] : []);
  });
  test.each([
    ['superseded', {}, 'OUTLINE_IMMUTABLE', 409],
    ['draft', { governanceVersion: 2 }, 'OUTLINE_GOVERNANCE_CONFLICT', 409],
    ['draft', { editVersion: 2 }, 'OUTLINE_EDIT_CONFLICT', 409],
    ['published', {}, 'PUBLISHED_ASSIGNMENT_REQUIRED', 422],
    ['draft', { assignments: [{ nodeId: 'absent', techDomainIds: ['ops'] }] }, 'INVALID_DOMAIN_PAYLOAD', 422],
    ['draft', { assignments: [{ nodeId: 'doc', techDomainIds: ['absent'] }] }, 'INVALID_DOMAIN_PAYLOAD', 422],
    ['draft', { descriptions: [{ nodeId: 'absent', description: '说明' }] }, 'INVALID_DOMAIN_PAYLOAD', 422]
  ])('保存%s校验 %j', (state, payload, code, status) => {
    const outline = fresh(); outline.state = state;
    expectError(outline, payload, code, status);
  });
  test.each([
    ['absent', null, 1], ['root', 'absent', 1], ['root', null, 0], ['root', null, 1.5], ['root', null, 'NaN']
  ])('非法目录节点/父级/顺序 %s %s %s', (nodeId, parentNodeId, order) => {
    expectError(fresh(), { directoryOrder: [{ nodeId, parentNodeId, order }] }, 'INVALID_DIRECTORY_PAYLOAD');
  });
  test('自父级与两节点循环均被拒绝且不改变原数据', () => {
    expectError(fresh(), { directoryOrder: [{ nodeId: 'root', parentNodeId: 'root', order: 1 }] }, 'INVALID_DIRECTORY_HIERARCHY');
    expectError(fresh(), { directoryOrder: [
      { nodeId: 'root', parentNodeId: 'doc', order: 1 }, { nodeId: 'doc', parentNodeId: 'root', order: 2 }
    ] }, 'INVALID_DIRECTORY_HIERARCHY');
  });
  test('过滤缺少领域的ownership，保留有效责任人', () => {
    const outline = api.saveFileGovernance(fresh(), { assignments: [{ nodeId: 'doc', techDomainId: 'ops', ownerships: [
      {}, { techDomainId: 'ops', assigneeId: 'user-1', assigneeName: '测试用户' }
    ] }] }, domains);
    expect(outline.governance.assignments[0].ownerships).toEqual([{ techDomainId: 'ops', assigneeId: 'user-1', assigneeName: '测试用户' }]);
  });
  test('CSV缺省列使用稳定文档编号与中文默认目录', () => {
    const content = api.parseCsvOutlineText('其他列\n值');
    expect(content.parts[0]).toMatchObject({ part: '默认部分', chapters: [expect.objectContaining({ name: '未分章' })] });
    expect(content.parts[0].chapters[0].documents[0]).toMatchObject({ id: 'kp-1', name: '未命名知识点' });
  });
  test('空输入与旧版章节别名生成确定的默认标题和文档信息', () => {
    expect(api.normalizeContent()).toEqual({ title: '上传的大纲', parts: [] });
    const content = api.normalizeContent({ chapters: [{ directories: [{ knowledgePoints: [null, { body: '正文' }] }] }] });
    expect(content.parts[0].part).toBe('默认部分');
    const documents = content.parts[0].chapters[0].children[0].documents;
    expect(documents.map(item => item.id)).toEqual(['doc-1', 'doc-2']);
    expect(documents[1]).toMatchObject({ name: '未命名文档', desc: '正文' });
  });
  test('有独立节点而无对应正文的描述保存被拒绝', () => {
    expectError(fresh(), { descriptions: [{ nodeId: 'doc', description: '内容' }] }, 'INVALID_DOMAIN_PAYLOAD');
  });
  test('部分直属文档与多层目录文档描述经正文更新', () => {
    for (const content of [
      { parts: [{ part: '基础', documents: [{ id: 'leaf', name: '页面' }] }] },
      { parts: [{ part: '基础', children: [{ name: '一级', directories: [{ name: '二级', knowledgePoints: [{ id: 'leaf', name: '页面' }] }] }] }] }
    ]) {
      const nodes = api.nodesFromContent(content, 'description');
      const doc = nodes.find(item => item.kind === 'document');
      const outline = { id: 'description', content };
      api.saveFileGovernance(outline, { descriptions: [{ nodeId: doc.id, description: '更新说明' }] }, []);
      expect(api.nodesFromContent(outline.content, outline.id).find(item => item.kind === 'document').description).toBe('更新说明');
    }
  });
  test('部分领域经subchapters与directories别名递归映射', () => {
    const content = { parts: [{ children: [{ techDomainIds: ['运维'], subchapters: [
      { techDomainIds: ['operations'], directories: [{ techDomainIds: ['ops'], kps: [{ techDomainIds: ['运维'] }] }] }
    ] }] }] };
    api.normalizeImportedTechDomains(content, domains);
    expect(content.parts[0].children[0].subchapters[0].directories[0]).toMatchObject({ techDomainIds: ['ops'], kps: [{ techDomainIds: ['ops'] }] });
  });
  test('完整目录顺序过滤空条目并保存合法根与父子层级', () => {
    const outline = api.saveFileGovernance(fresh(), { directoryOrder: [null, {},
      { nodeId: 'root', order: 2 }, { nodeId: 'doc', parentNodeId: 'root', order: 1 }
    ] }, domains);
    expect(outline.nodes.map(node => [node.id, node.parentId, node.order])).toEqual([
      ['root', null, 2], ['doc', 'root', 1]
    ]);
  });

});
