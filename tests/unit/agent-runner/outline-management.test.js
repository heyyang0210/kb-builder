const {
  buildCatalog,
  buildImpactProjection,
  buildFileTasks,
  buildResponsibilityProjection,
  normalizeImportedTechDomains,
  nodesFromContent,
  normalizeOutline,
  parseOutlineText,
  parseXlsxOutlineFile,
  publishFileGovernance,
  saveFileGovernance,
  validateCandidate
} = require('../../../packages/agent-runner-core/routes/outline-management');
const { DomainStore } = require('../../../packages/agent-runner-core/lib/domain-store');
const fs = require('fs');
const os = require('os');
const path = require('path');
const XLSX = require('xlsx');

const outline = {
  id: 'outline-1',
  name: '数据库手册',
  productId: 'yashandb',
  businessVersionTags: ['23.4.5.100', '23.4.5.101'],
  outlineStructureVersion: 'outline-v12',
  content: {
    parts: [{ part: '一、基础', chapters: [{ name: '1.1 安装', kps: [{ id: '1.1.1', name: '环境要求', desc: '安装环境' }] }] }]
  }
};

describe('领域存储错误码映射', () => {
  test('已发布大纲责任调整错误返回可重试的业务状态', () => {
    const store = new DomainStore({ baseUrl: 'http://127.0.0.1:1' });
    expect(store.statusForCode('PUBLISHED_ASSIGNMENT_REQUIRED')).toBe(422);
    expect(store.statusForCode('PUBLISHED_CONTENT_LOCKED')).toBe(409);
    expect(store.statusForCode('OUTLINE_GOVERNANCE_CONFLICT')).toBe(409);
  });
});

describe('大纲治理投影', () => {
  test('业务版本标签和结构版本保持独立', () => {
    const result = normalizeOutline(outline);
    expect(result.businessVersionTags).toEqual(['23.4.5.100', '23.4.5.101']);
    expect(result.outlineStructureVersion).toBe('outline-v12');
    expect(result.nodeCount).toBe(3);
  });

  test('产品目录只聚合真实元数据中的版本标签', () => {
    expect(buildCatalog([outline])).toEqual([{
      id: 'yashandb', name: 'yashandb', versionTags: ['23.4.5.100', '23.4.5.101']
    }]);
  });

  test('没有责任事实时返回待创建而非伪造映射', () => {
    expect(buildResponsibilityProjection(outline).status).toBe('not_created');
    const impact = buildImpactProjection(outline);
    expect(impact.issues.map(issue => issue.type)).toEqual(['missing_owner', 'missing_document']);
    expect(impact.affectedDocuments).toEqual([]);
  });

  test('预检阻止缺少产品和业务版本的候选大纲', () => {
    const result = validateCandidate({ content: outline.content });
    expect(result.passed).toBe(false);
    expect(result.errors.map(item => item.code)).toEqual(expect.arrayContaining(['PRODUCT_REQUIRED', 'BUSINESS_VERSION_REQUIRED']));
  });

  test('具有产品、版本和目录的候选大纲通过预检', () => {
    const result = validateCandidate({ content: outline.content, productId: 'yashandb', businessVersionTags: ['23.4.5.100'] });
    expect(result.passed).toBe(true);
    expect(result.nodes).toHaveLength(3);
  });

  test('Markdown、JSON 与 CSV 统一归一化为生成器使用的三级结构', () => {
    const markdown = '# 示例大纲\n## 一、基础 ⭐\n- **1.1 安装**\n  - 1.1.1 ⭐ 环境要求：检查操作系统';
    const parsedMarkdown = parseOutlineText(markdown, '.md');
    const parsedJson = parseOutlineText(JSON.stringify(parsedMarkdown), '.json');
    const parsedCsv = parseOutlineText('part,chapter,id,name,desc\n一、基础,1.1 安装,1.1.1,环境要求,检查操作系统', '.csv');
    for (const parsed of [parsedMarkdown, parsedJson, parsedCsv]) {
      expect(parsed.parts[0].chapters[0].kps[0]).toEqual(expect.objectContaining({ id: '1.1.1', name: '环境要求', desc: '检查操作系统' }));
    }
  });

  test('节点投影保留 document 编号、描述和服务端顺序', () => {
    const nodes = nodesFromContent(outline.content, outline.id);
    expect(nodes.map(node => node.kind)).toEqual(['directory', 'directory', 'document']);
    expect(nodes[2]).toEqual(expect.objectContaining({ sourceId: '1.1.1', title: '环境要求', description: '安装环境', order: 3 }));
  });

  test('XLSX 第六列初始化 document 技术领域并支持多个分隔值', () => {
    const filePath = writeWorkbook([
      ['一级目录', '二级目录', '三级目录', '页面', '内容说明', '技术领域分工'],
      ['基础', '安装', '', '环境要求', '安装环境', '高可用技术、performance;domain-operations']
    ]);
    try {
      const parsed = parseXlsxOutlineFile(filePath);
      const document = parsed.parts[0].chapters[0].documents[0];
      expect(document.techDomainIds).toEqual(['高可用技术', 'performance', 'domain-operations']);
      const normalized = normalizeImportedTechDomains(parsed, [
        { id: 'domain-ha', code: 'high-availability', name: '高可用技术' },
        { id: 'domain-performance', code: 'performance', name: '性能调优' },
        { id: 'domain-operations', code: 'production-operations', name: '生产运维' }
      ]);
      expect(normalized.parts[0].chapters[0].documents[0].techDomainIds).toEqual([
        'domain-ha', 'domain-performance', 'domain-operations'
      ]);
      expect(nodesFromContent(normalized, 'xlsx-domains').find(node => node.kind === 'document')).toEqual(expect.objectContaining({
        techDomainIds: ['domain-ha', 'domain-performance', 'domain-operations']
      }));
    } finally {
      fs.rmSync(filePath, { force: true });
    }
  });

  test('XLSX 技术领域分工包含未配置领域时拒绝导入', () => {
    const filePath = writeWorkbook([
      ['一级目录', '二级目录', '三级目录', '页面', '内容说明', '技术领域分工'],
      ['基础', '', '', '环境要求', '安装环境', '不存在的领域']
    ]);
    try {
      const parsed = parseXlsxOutlineFile(filePath);
      expect(() => normalizeImportedTechDomains(parsed, [])).toThrow('未配置的领域');
    } finally {
      fs.rmSync(filePath, { force: true });
    }
  });

  test('正式六列表格按目录列解析页面路径和分工', () => {
    const filePath = writeWorkbook([
      ['一级目录', '二级目录', '三级目录', '页面', '内容说明', '技术领域分工'],
      ['数据库基础', '对象管理', '表对象', '列定义', '说明列定义和校验方法', '培训&知识中心'],
      ['', '', '', '索引定义', '说明索引定义和校验方法', '平台&工具']
    ]);
    try {
      const parsed = parseXlsxOutlineFile(filePath, '基本数据库管理手册');
      const nodes = nodesFromContent(parsed, 'columnar-fixture');
      expect(nodes.filter(node => node.kind === 'directory').map(node => node.title))
        .toEqual(['数据库基础', '对象管理', '表对象']);
      expect(nodes.filter(node => node.kind === 'document').map(node => node.title))
        .toEqual(['列定义', '索引定义']);
      expect(nodes.find(node => node.title === '索引定义')).toEqual(expect.objectContaining({
        description: '说明索引定义和校验方法',
        level: 4,
        techDomainIds: ['平台&工具']
      }));
    } finally {
      fs.rmSync(filePath, { force: true });
    }
  });

  test('XLSX 解析忽略模板中的隐藏技术领域辅助表', () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      ['一级目录', '二级目录', '三级目录', '页面', '内容说明', '技术领域分工'],
      ['基础', '', '', '兼容性概述', '说明兼容性范围', '兼容性']
    ]), '大纲模板');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['技术领域名称'], ['兼容性']]), '技术领域');
    workbook.Workbook = { Sheets: [{ name: '大纲模板', Hidden: 0 }, { name: '技术领域', Hidden: 1 }] };
    const filePath = path.join(os.tmpdir(), `outline-hidden-domain-${process.pid}-${Date.now()}.xlsx`);
    XLSX.writeFile(workbook, filePath);
    try {
      const parsed = parseXlsxOutlineFile(filePath, '隐藏辅助表模板');
      expect(parsed.parts[0].documents[0]).toEqual(expect.objectContaining({
        name: '兼容性概述',
        techDomainIds: ['兼容性']
      }));
    } finally {
      fs.rmSync(filePath, { force: true });
    }
  });

  test('六列表格支持目录兼页面并使用稳定来源编号', () => {
    const filePath = writeWorkbook([
      ['一级目录', '二级目录', '三级目录', '页面', '内容说明', '技术领域分工'],
      ['数据库基础', '对象管理', '', '对象管理', '对象管理总览', '数据库基础'],
      ['', '对象管理', '', '表定义', '表定义说明', '']
    ]);
    try {
      const parsed = parseXlsxOutlineFile(filePath, '目录页面样例');
      const documents = nodesFromContent(parsed, 'directory-page-fixture').filter(node => node.kind === 'document');
      expect(documents).toHaveLength(2);
      expect(documents.find(node => node.title === '对象管理')).toEqual(expect.objectContaining({
        sourceId: 'directory-page-数据库基础/对象管理',
        description: '对象管理总览',
        level: 4,
        techDomainIds: ['数据库基础']
      }));
      expect(documents.find(node => node.title === '对象管理').sourceId).not.toContain('xlsx-row');
      expect(parsed.parts[0].chapters[0].documents[0]).toEqual(expect.objectContaining({
        isDirectoryPage: true,
        documentId: 'directory-page-数据库基础/对象管理'
      }));
    } finally {
      fs.rmSync(filePath, { force: true });
    }
  });

  test('历史七列表格继续作为兼容输入解析', () => {
    const filePath = writeWorkbook([
      ['一级目录', '二级目录', '三级目录', '四级目录', '页面', '内容说明', '技术领域分工'],
      ['数据库基础', '对象管理', '表对象', '表结构', '列定义', '说明列定义和校验方法', '培训&知识中心']
    ]);
    try {
      const parsed = parseXlsxOutlineFile(filePath, '历史七列样例');
      const nodes = nodesFromContent(parsed, 'legacy-columnar-fixture');
      expect(nodes.filter(node => node.kind === 'directory').map(node => node.title))
        .toEqual(['数据库基础', '对象管理', '表对象', '表结构']);
      expect(nodes.find(node => node.title === '列定义')).toEqual(expect.objectContaining({
        level: 5,
        techDomainIds: ['培训&知识中心']
      }));
    } finally {
      fs.rmSync(filePath, { force: true });
    }
  });

  test('正式模板只有通用六列表头，不携带具体手册内容', () => {
    const filePath = path.resolve(__dirname, '../../../knowledge/outlines/大纲模板.xlsx');
    const workbook = XLSX.readFile(filePath);
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
    expect(rows[0]).toEqual(['路径层级1', '路径层级2', '路径层级3', '路径层级4', '内容说明', '技术领域分工']);
    expect(rows).toHaveLength(1);
  });

  test('数据库管理手册样例按六列模板保留 77 个页面', () => {
    const filePath = path.resolve(__dirname, '../../../knowledge/outlines/基本数据库管理手册大纲示例.xlsx');
    const workbook = XLSX.readFile(filePath);
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: '' });
    expect(rows[0]).toEqual(['一级目录', '二级目录', '三级目录', '页面', '内容说明', '技术领域分工']);
    expect(rows).toHaveLength(78);
    expect(rows.slice(1).every(row => row.length === 6)).toBe(true);
    expect(rows.slice(1).filter(row => row[5] !== '')).toHaveLength(0);
  });

  test('支持文档生成器使用的标题树大纲并保留叶子说明', () => {
    const headingTree = '# 数据库大纲\n## 第一部分：基础 ★\n### 1.1 数据库概念\n#### 1.1.1 基本概念\n- **数据库**：有组织的数据集合';
    const parsed = parseOutlineText(headingTree, '.md');
    expect(parsed.parts[0].part).toBe('第一部分：基础');
    expect(parsed.parts[0].chapters[0].name).toBe('1.1 数据库概念');
    expect(parsed.parts[0].chapters[0].kps[0]).toEqual(expect.objectContaining({
      id: '1.1.1',
      documentId: '1.1.1',
      name: '基本概念',
      desc: '数据库：有组织的数据集合'
    }));
  });

  test('XLSX 样例转换为包含 document 叶子的三级目录树', () => {
    const filePath = path.resolve(__dirname, '../../../knowledge/outlines/基本数据库管理手册大纲示例.xlsx');
    const parsed = parseXlsxOutlineFile(filePath);
    const nodes = nodesFromContent(parsed, 'xlsx-fixture');
    const documentNodes = nodes.filter(node => node.kind === 'document');
    const directoryNodes = nodes.filter(node => node.kind === 'directory');
    const storage = parsed.parts.find(part => part.part === '存储管理');
    const logicalSpace = storage.chapters.find(chapter => chapter.name === '逻辑空间管理');

    expect(parsed.parts).toHaveLength(9);
    expect(parsed.parts.reduce((count, part) => count + part.chapters.length, 0)).toBe(11);
    expect(parsed.parts.flatMap(part => part.chapters.flatMap(chapter => chapter.children || []))).toHaveLength(4);
    expect(documentNodes).toHaveLength(77);
    expect(directoryNodes).toHaveLength(24);
    expect(logicalSpace.children.map(child => child.name)).toEqual(['表空间管理', '表空间集管理']);
    expect(logicalSpace.children[0].documents[0]).toEqual(expect.objectContaining({
      id: 'xlsx-row-31',
      documentId: 'xlsx-row-31',
      name: 'SYSTEM表空间管理'
    }));
    expect(nodes.find(node => node.title === '表空间管理')).toEqual(expect.objectContaining({
      kind: 'directory',
      parentId: nodes.find(node => node.title === '逻辑空间管理').id
    }));
    expect(nodes.find(node => node.title === 'SYSTEM表空间管理')).toEqual(expect.objectContaining({
      kind: 'document',
      parentId: nodes.find(node => node.title === '表空间管理').id,
      level: 4
    }));
  });

  test('XLSX 可以使用原始文件名作为候选标题', () => {
    const filePath = path.resolve(__dirname, '../../../knowledge/outlines/基本数据库管理手册大纲示例.xlsx');
    expect(parseXlsxOutlineFile(filePath, '数据库管理手册').title).toBe('数据库管理手册');
  });

  test('历史逐行层级格式解析四级目录和五级页面，并保留目录说明', () => {
    const filePath = writeWorkbook([
      ['层级', '节点名称', '节点类型', '内容说明', '技术领域分工'],
      [1, '数据库基础', '目录', '一级目录说明', ''],
      [2, '概念模型', '目录', '二级目录说明', '数据库基础'],
      [3, '对象模型', '目录', '三级目录说明', '数据库基础'],
      [4, '表对象', '目录', '四级目录说明', '数据库基础'],
      [5, '创建表', '页面', '页面说明', '数据库基础'],
    ]);
    try {
      const parsed = parseXlsxOutlineFile(filePath, '基本数据库管理手册');
      const nodes = nodesFromContent(parsed, 'hierarchical-fixture');
      expect(parsed.parts[0]).toEqual(expect.objectContaining({
        part: '数据库基础',
        description: '一级目录说明'
      }));
      expect(parsed.parts[0].chapters[0]).toEqual(expect.objectContaining({
        name: '概念模型',
        description: '二级目录说明'
      }));
      expect(parsed.parts[0].chapters[0].children[0].children[0]).toEqual(expect.objectContaining({
        name: '表对象',
        description: '四级目录说明'
      }));
      expect(nodes.filter(node => node.kind === 'document')).toHaveLength(1);
      expect(nodes.find(node => node.kind === 'document')).toEqual(expect.objectContaining({
        title: '创建表',
        description: '页面说明',
        level: 5,
        techDomainIds: ['数据库基础']
      }));
    } finally {
      fs.rmSync(filePath, { force: true });
    }
  });

  test('历史逐行层级格式的目录兼页面同时生成目录节点和五级 document 子节点', () => {
    const filePath = writeWorkbook([
      ['层级', '节点名称', '节点类型', '内容说明', '技术领域分工'],
      [1, '数据库基础', '目录', '一级说明', ''],
      [2, '对象管理', '目录兼页面', '目录和页面共用说明', '数据库基础'],
      [3, '表对象', '目录', '三级说明', ''],
      [4, '表结构', '目录', '四级说明', ''],
      [5, '列定义', '页面', '页面说明', '数据库基础'],
    ]);
    try {
      const parsed = parseXlsxOutlineFile(filePath);
      const root = parsed.parts[0];
      const directory = root.chapters[0];
      expect(directory.name).toBe('对象管理');
      expect(directory.description).toBe('目录和页面共用说明');
      expect(directory.documents).toEqual([expect.objectContaining({
        name: '对象管理',
        outlineLevel: 5,
        techDomainIds: ['数据库基础']
      })]);
      expect(nodesFromContent(parsed, 'directory-page-fixture').filter(node => node.kind === 'document'))
        .toHaveLength(2);
    } finally {
      fs.rmSync(filePath, { force: true });
    }
  });

  test('历史逐行层级格式拒绝跳级和不合法的五级节点类型', () => {
    const skippedLevelPath = writeWorkbook([
      ['层级', '节点名称', '节点类型', '内容说明', '技术领域分工'],
      [1, '数据库基础', '目录', '', ''],
      [3, '对象模型', '目录', '', ''],
      [5, '创建表', '页面', '', ''],
    ]);
    const invalidTypePath = writeWorkbook([
      ['层级', '节点名称', '节点类型', '内容说明', '技术领域分工'],
      [1, '数据库基础', '目录', '', ''],
      [5, '创建表', '目录', '', ''],
    ]);
    try {
      expect(() => parseXlsxOutlineFile(skippedLevelPath)).toThrow('层级不能跳级');
      expect(() => parseXlsxOutlineFile(invalidTypePath)).toThrow('五级节点只能填写“页面”');
    } finally {
      fs.rmSync(skippedLevelPath, { force: true });
      fs.rmSync(invalidTypePath, { force: true });
    }
  });

  test('知识中心导入以已有手册名称为准，不使用 Excel 文件名', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../../../packages/agent-runner-core/routes/outline.js'), 'utf8');
    expect(source).toContain('const name = handbookName(handbookId);');
    expect(source).toContain('parseBodyContent({}, input.file.path, name)');
    expect(source).toContain('createCandidate({ name, content: input.content');
    expect(source).toContain('candidate.sourceFileName = fileName');
    expect(source).not.toContain('const inferredName = input.content?.title');
  });

  test('XLSX 空白目录按模板规则继承一级目录并重置下级目录', () => {
    const filePath = writeWorkbook([
      ['一级目录', '二级目录', '三级目录', '页面', '内容说明'],
      ['一级', '二级', '三级', '页面一', '说明一'],
      ['', '', '', '页面二', '说明二'],
      ['', '二级二', '', '页面三', '说明三'],
      ['', '二级二', '三级二', '页面四', '说明四']
    ]);
    try {
      const parsed = parseXlsxOutlineFile(filePath);
      expect(parsed.parts[0].documents.map(document => document.name)).toEqual(['页面二']);
      expect(parsed.parts[0].chapters[0].children[0].documents.map(document => document.name)).toEqual(['页面一']);
      expect(parsed.parts[0].chapters[1].children[0].documents.map(document => document.name)).toEqual(['页面四']);
      expect(parsed.parts[0].chapters[1].documents.map(document => document.name)).toEqual(['页面三']);
    } finally {
      fs.rmSync(filePath, { force: true });
    }
  });

  test('发布责任不完整时不改变候选状态', () => {
    const candidate = {
      ...outline,
      state: 'pending_confirmation',
      governance: { assignments: [] }
    };
    expect(() => publishFileGovernance(candidate, {})).toThrow('发布前必须完成所有 document 的技术领域分工');
    expect(candidate.state).toBe('pending_confirmation');
    expect(candidate.governance?.tasks).toBeUndefined();
  });

  test('领域建设任务同时保留稳定编号和页面标题', () => {
    const chapter = nodesFromContent(outline.content, outline.id).find(node => node.kind === 'directory' && node.title === '1.1 安装');
    const candidate = {
      ...outline,
      governance: {
        assignments: [{ nodeId: chapter.id, techDomainIds: ['domain-db'] }]
      }
    };
    const tasks = buildFileTasks(candidate, [{
      id: 'domain-db',
      name: '数据库基础',
      leader: { id: 'person-1', name: '张三' }
    }], '2026-09-11T01:00:00.000Z');
    expect(tasks[0].items[0]).toEqual(expect.objectContaining({
      documentId: '1.1.1',
      documentTitle: '环境要求'
    }));
  });

  test('候选大纲可以明确取消页面的全部技术领域分工', () => {
    const document = nodesFromContent(outline.content, outline.id).find(node => node.kind === 'document');
    const candidate = {
      ...outline,
      state: 'draft',
      governance: { assignments: [{ nodeId: document.id, techDomainIds: ['domain-db'] }] }
    };
    saveFileGovernance(candidate, {
      editVersion: 1,
      governanceVersion: 1,
      descriptions: [{ nodeId: document.id, description: document.description }],
      assignments: [{ nodeId: document.id, techDomainIds: [] }]
    }, [{ id: 'domain-db', name: '数据库基础' }]);
    expect(buildResponsibilityProjection(candidate).summary.unassignedDocuments).toBe(1);
    expect(candidate.governance.assignments).toEqual([{ nodeId: document.id, techDomainIds: [] }]);
  });

  test('候选大纲保存目录顺序并阻断循环层级', () => {
    const nodes = nodesFromContent(outline.content, outline.id);
    const document = nodes.find(node => node.kind === 'document');
    const chapter = nodes.find(node => node.kind === 'directory' && node.title === '1.1 安装');
    const candidate = { ...outline, state: 'draft', nodes, governance: { assignments: [] } };
    saveFileGovernance(candidate, { editVersion: 1, governanceVersion: 1, directoryOrder: nodes.map((node, index) => ({ nodeId: node.id, parentNodeId: node.id === document.id ? chapter.id : node.parentId || null, order: nodes.length - index })) }, []);
    expect(candidate.nodes.find(node => node.id === document.id).parentId).toBe(chapter.id);
    expect(() => saveFileGovernance(candidate, { editVersion: 1, governanceVersion: 2, directoryOrder: nodes.map(node => ({ nodeId: node.id, parentNodeId: node.id === chapter.id ? document.id : node.parentId || null, order: 1 })) }, [])).toThrow('目录层级不能形成循环');
  });

  test('已发布大纲可以换领域并把新页面任务默认归属领域负责人', () => {
    const document = nodesFromContent(outline.content, outline.id).find(node => node.kind === 'document');
    const domains = [
      { id: 'domain-old', name: '原领域', leader: { id: 'old-leader', name: '原领域负责人' } },
      { id: 'domain-new', name: '新领域', leader: { id: 'new-leader', name: '新领域负责人' } }
    ];
    const published = {
      ...outline,
      state: 'published',
      governance: { assignments: [{ nodeId: document.id, techDomainIds: ['domain-old'] }] }
    };
    published.governance.tasks = buildFileTasks(published, domains, '2026-09-15T00:00:00.000Z');
    saveFileGovernance(published, {
      editVersion: 1,
      governanceVersion: 1,
      descriptions: [{ nodeId: document.id, description: document.description }],
      assignments: [{ nodeId: document.id, techDomainIds: ['domain-new'] }]
    }, domains);
    const governance = buildResponsibilityProjection(published);
    expect(governance.effectiveDocumentAssignments[0].techDomainIds).toEqual(['domain-new']);
    expect(governance.effectiveDocumentAssignments[0].ownerships[0]).toEqual(expect.objectContaining({
      techDomainId: 'domain-new',
      assigneeId: 'new-leader',
      assigneeName: '新领域负责人'
    }));
    expect(governance.tasks).toHaveLength(1);
    expect(governance.tasks[0].items[0].documentId).toBe('1.1.1');
  });

  test('文件模式重建任务时历史空责任人回退到领域负责人', () => {
    const document = nodesFromContent(outline.content, outline.id).find(node => node.kind === 'document');
    const domains = [{ id: 'domain-db', name: '数据库基础', leader: { id: 'db-leader', name: '数据库负责人' } }];
    const published = {
      ...outline,
      state: 'published',
      governance: { assignments: [{ nodeId: document.id, techDomainIds: ['domain-db'] }] }
    };
    const previousTasks = [{
      id: 'task-db',
      techDomainId: 'domain-db',
      items: [{
        documentId: document.sourceId,
        techDomainId: 'domain-db',
        assigneeId: null,
        assigneeName: null,
        status: 'unassigned'
      }]
    }];
    const tasks = buildFileTasks(published, domains, '2026-09-15T00:00:00.000Z', previousTasks);
    expect(tasks[0].items[0]).toEqual(expect.objectContaining({
      assigneeId: 'db-leader',
      assigneeName: '数据库负责人',
      status: 'assigned'
    }));
  });

  test('已发布大纲不能清空页面分工或修改内容说明', () => {
    const document = nodesFromContent(outline.content, outline.id).find(node => node.kind === 'document');
    const domains = [{ id: 'domain-db', name: '数据库基础', leader: { id: 'db-leader', name: '数据库负责人' } }];
    const published = {
      ...outline,
      state: 'published',
      governance: {
        assignments: [{ nodeId: document.id, techDomainIds: ['domain-db'] }],
        tasks: buildFileTasks({ ...outline, state: 'published', governance: { assignments: [{ nodeId: document.id, techDomainIds: ['domain-db'] }] } }, domains, '2026-09-15T00:00:00.000Z')
      }
    };
    expect(() => saveFileGovernance(published, {
      editVersion: 1,
      assignments: [{ nodeId: document.id, techDomainIds: [] }]
    }, domains)).toThrow('不能取消页面的全部技术领域分工');
    expect(() => saveFileGovernance(published, {
      editVersion: 1,
      assignments: [{ nodeId: document.id, techDomainIds: ['domain-db'] }],
      descriptions: [{ nodeId: document.id, description: '不允许修改' }]
    }, domains)).toThrow('不能修改内容说明');
    expect(published.governance.assignments[0].techDomainIds).toEqual(['domain-db']);
  });

  test('XLSX 拒绝错误表头、无一级目录和空页面', () => {
    const cases = [
      {
        rows: [['一级目录', '二级目录', '三级目录', '错误列', '内容说明'], ['一级', '', '', '页面', '说明']],
        message: '表头'
      },
      {
        rows: [['一级目录', '二级目录', '三级目录', '页面', '内容说明'], ['', '二级', '', '页面', '说明']],
        message: '缺少一级目录'
      },
      {
        rows: [['一级目录', '二级目录', '三级目录', '页面', '内容说明'], ['一级', '', '', '', '说明']],
        message: '页面不能为空'
      }
    ];
    for (const item of cases) {
      const filePath = writeWorkbook(item.rows);
      try {
        expect(() => parseXlsxOutlineFile(filePath)).toThrow(item.message);
      } finally {
        fs.rmSync(filePath, { force: true });
      }
    }
  });
});

function writeWorkbook(rows) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, '大纲');
  const filePath = path.join(os.tmpdir(), `outline-contract-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.xlsx`);
  XLSX.writeFile(workbook, filePath);
  return filePath;
}
