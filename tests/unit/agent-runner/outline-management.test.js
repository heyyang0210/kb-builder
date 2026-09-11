const {
  buildCatalog,
  buildImpactProjection,
  buildResponsibilityProjection,
  nodesFromContent,
  normalizeOutline,
  parseOutlineText,
  validateCandidate
} = require('../../../packages/agent-runner-core/routes/outline-management');

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

  test('节点投影保留知识点编号、描述和服务端顺序', () => {
    const nodes = nodesFromContent(outline.content, outline.id);
    expect(nodes.map(node => node.kind)).toEqual(['part', 'chapter', 'knowledge_point']);
    expect(nodes[2]).toEqual(expect.objectContaining({ sourceId: '1.1.1', title: '环境要求', description: '安装环境', order: 1 }));
  });

  test('支持文档生成器使用的标题树大纲并保留叶子说明', () => {
    const headingTree = '# 数据库大纲\n## 第一部分：基础 ★\n### 1.1 数据库概念\n#### 1.1.1 基本概念\n- **数据库**：有组织的数据集合';
    const parsed = parseOutlineText(headingTree, '.md');
    expect(parsed.parts[0].part).toBe('第一部分：基础');
    expect(parsed.parts[0].chapters[0].name).toBe('1.1 数据库概念');
    expect(parsed.parts[0].chapters[0].kps[0]).toEqual({ id: '1.1.1', name: '基本概念', desc: '数据库：有组织的数据集合' });
  });
});
