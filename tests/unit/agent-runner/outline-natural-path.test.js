const fs = require('fs');
const path = require('path');
const os = require('os');
const XLSX = require('xlsx');
const { rules, parseNaturalPathRows, pathId } = require('../../../packages/agent-runner-core/lib/outline-path-template');
const { parseXlsxOutlineFile, normalizeImportedTechDomains, normalizeContent, buildFileTasks, nodesFromContent, assignmentsFromContent } = require('../../../packages/agent-runner-core/routes/outline-management');
const { OutlineRepository, hasWritableSnapshotContent } = require('../../../packages/agent-runner-core/lib/outline-repository');

const title = 'SQL参考手册';
const intro = ['00SQL参考手册.md', '', '', '', '说明', '兼容性'];
const rows = [intro, ['版本差异说明.md', '', '', '', '差异', '兼容性'],
  ['基础SQL元素', '00基础SQL元素.md', '', '', '目录说明', '兼容性'],
  ['基础SQL元素', '嵌套', '00嵌套.md', '', '嵌套说明', '兼容性'],
  ['基础SQL元素', '嵌套', 'INTEGER.md', '', '数值', '兼容性'],
  ['基础SQL元素', '最后.md', '', '', '后续', '兼容性']];

function errorDetails(input) {
  try { parseNaturalPathRows(input, title); throw new Error('应校验失败'); }
  catch (error) { expect(error.code).toBe('OUTLINE_TEMPLATE_INVALID'); return error.details; }
}

describe('自然路径模板', () => {
  test('模板资源只存放在knowledge/outlines且根目录不保留副本', () => {
    const root = path.resolve(__dirname, '../../..');
    expect(rules.templatePath).toBe('knowledge/outlines/大纲模板.xlsx');
    expect(rules.sampleDownloadPath).toBe('knowledge/outlines/SQL参考手册大纲示例.xlsx');
    for (const relative of [rules.templatePath, rules.sampleDownloadPath, 'knowledge/outlines/基本数据库管理手册大纲示例.xlsx']) {
      expect(fs.statSync(path.join(root, relative)).isFile()).toBe(true);
    }
    for (const filename of ['大纲模板.xlsx', 'SQL参考手册大纲示例.xlsx', '基本数据库管理手册大纲示例.xlsx']) {
      expect(fs.existsSync(path.join(root, filename))).toBe(false);
    }
  });

  test('混合根、实际深度、完整文件名、嵌套目录与同级文件严格保持源行序', () => {
    const content = parseNaturalPathRows(rows, title);
    const nodes = nodesFromContent(normalizeContent(content));
    expect(nodes.filter(n => n.kind === 'document').map(n => n.path)).toEqual(rows.map(row => row.slice(0, 4).filter(Boolean).join('/')));
    expect(nodes[0]).toMatchObject({ title: '00SQL参考手册.md', parentId: null, level: 1 });
    expect(nodes.find(n => n.title === 'INTEGER.md').level).toBe(3);
    expect(nodes.findIndex(n => n.title === '嵌套')).toBeLessThan(nodes.findIndex(n => n.title === '最后.md'));
    expect(hasWritableSnapshotContent({ content })).toBe(true);
  });

  test('单一根介绍和四层文档均合法，同路径ID不依赖行号和排序', () => {
    const only = parseNaturalPathRows([intro], title);
    expect(only.nodes).toHaveLength(1);
    const tree = parseNaturalPathRows([intro,
      ['A', '00A.md'], ['A', 'B', '00B.md'], ['A', 'B', 'C', '00C.md'], ['A', 'B', 'C', 'D.md']], title);
    expect(tree.nodes.at(-1).level).toBe(4);
    const reordered = parseNaturalPathRows([intro, rows[1], ['新增.md']], title);
    const reorderedAgain = parseNaturalPathRows([[], intro, ['新增.md'], rows[1]], title);
    expect(only.nodes[0].id).toBe(reorderedAgain.nodes.find(node => node.path === '00SQL参考手册.md').id);
    expect(reordered.nodes.find(node => node.path === '版本差异说明.md').id)
      .toBe(reorderedAgain.nodes.find(node => node.path === '版本差异说明.md').id);
    expect(pathId('DB-004', 'A/D.md')).not.toBe(pathId('DB-005', 'A/D.md'));
  });

  test.each([
    [[intro, ['A', '', 'B.md']], 'PATH_GAP'],
    [[intro, intro], 'DUPLICATE_PATH'],
    [[intro, ['A', 'a.txt']], 'DOCUMENT_EXTENSION'],
    [[intro, ['..', 'a.md']], 'INVALID_PATH_NAME'],
    [[intro, ['A.md', 'a.md']], 'DOCUMENT_AS_PARENT'],
    [[intro, ['A', 'a.md']], 'INTRO_REQUIRED'],
    [[intro, ['_index.md']], 'RESERVED_DOCUMENT'],
    [[intro, ['00错误.md']], 'INTRO_NAME'],
    [[['版本差异说明.md'], intro], 'INTRO_ORDER'],
    [[intro, ['A', 'page.md'], ['A', '00A.md']], 'INTRO_ORDER'],
    [[intro, ['A', '00A.md'], ['other.md'], ['A', 'late.md']], 'NON_CONTIGUOUS_DIRECTORY']
  ])('错误定位并提供建议 %s', (input, code) => {
    const errors = errorDetails(input);
    expect(errors).toEqual(expect.arrayContaining([expect.objectContaining({ code, row: expect.any(Number), column: expect.any(String), suggestion: expect.any(String) })]));
  });

  test.each([
    [[intro, ['extra.md', '', '', '', '', '', '越界']], 'EXTRA_COLUMNS', 3, '表格'],
    [[intro, ['', '', '', '', '缺少路径']], 'PATH_REQUIRED', 3, rules.headers[0]],
    [[intro, ['a'.repeat(253) + '.md']], 'NAME_TOO_LONG', 3, rules.headers[0]],
    [[intro, ['parent.md', 'child.md']], 'DOCUMENT_AS_PARENT', 3, rules.headers[0]],
    [[intro, ['.md']], 'DOCUMENT_EXTENSION', 3, rules.headers[0]],
    [[[]], 'OUTLINE_DOCUMENT_REQUIRED', 2, rules.headers[0]],
  ])('导入边界返回明确行列 %s', (input, code, row, column) => {
    expect(errorDetails(input)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code, row, column, suggestion: expect.any(String) })
    ]));
    expect(parseNaturalPathRows([intro, ['恢复.md']], title).nodes.map(node => node.path))
      .toEqual(['00SQL参考手册.md', '恢复.md']);
  });

  test('汇总多行错误、合并单元格和未知领域', () => {
    expect(errorDetails([intro, ['A', '', 'x.md'], ['bad.txt']]).filter(e => ['PATH_GAP', 'DOCUMENT_EXTENSION'].includes(e.code))).toHaveLength(2);
    expect(() => parseNaturalPathRows([intro], title, [{ s: { r: 1, c: 0 }, e: { r: 2, c: 0 } }])).toThrow('合并');
    const content = parseNaturalPathRows(rows, title);
    expect(() => normalizeImportedTechDomains(content, [])).toThrow('未配置');
  });

  test('仓库SQL示例501篇文件的路径、顺序、说明和领域完整保留', () => {
    const root = path.resolve(__dirname, '../../..');
    const samplePath = path.join(root, rules.sampleDownloadPath);
    const content = parseXlsxOutlineFile(samplePath, title);
    expect(content.nodes.filter(n => n.kind === 'document')).toHaveLength(501);
    expect(content.nodes.find(n => n.title === 'external_table.md').path).toBe('公共可复用语法子句/扩展语法构件/external_table.md');
    const source = XLSX.readFile(samplePath);
    const sourceRows = XLSX.utils.sheet_to_json(source.Sheets[source.SheetNames[0]], { header: 1, defval: '' }).slice(1);
    expect(content.nodes.filter(n => n.kind === 'document').map(n => n.path)).toEqual(sourceRows.map(row => row.slice(0, rules.maxDepth).filter(Boolean).join('/')));
    expect(content.nodes.filter(n => n.kind === 'document').map(n => n.description)).toEqual(sourceRows.map(row => row[4]));
    expect(content.nodes.filter(n => n.kind === 'document').map(n => n.techDomainIds)).toEqual(sourceRows.map(row => [row[5]]));
    const domains = [{ id: '2', name: '兼容性' }];
    normalizeImportedTechDomains(content, domains);
    const tasks = buildFileTasks({ id: 'sql-outline', handbookId: 'DB-004', content, governance: { assignments: assignmentsFromContent(content, 'sql-outline') } }, domains, new Date().toISOString());
    expect(tasks.flatMap(task => task.items)).toHaveLength(501);
  });

  test('文件仓储追加不改旧大纲，数据库追加仅发送新候选及insertOnly', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'outline-append-'));
    const oldMode = process.env.KNOWLEDGE_STORAGE_MODE;
    process.env.KNOWLEDGE_STORAGE_MODE = 'file';
    try {
      const repository = new OutlineRepository(root);
      const old = { id: 'old', content: { parts: [] }, state: 'published', editVersion: 7 };
      repository.write({ outlines: [old] });
      const candidate = { id: 'new', content: parseNaturalPathRows([intro], title) };
      repository.append([candidate]);
      expect(repository.read().outlines[0]).toEqual(old);
      const spy = jest.spyOn(repository.domainStore, 'writeOutlinesSnapshot').mockReturnValue({});
      process.env.KNOWLEDGE_STORAGE_MODE = 'database';
      repository.append([candidate]);
      expect(spy).toHaveBeenCalledWith({ outlines: [candidate], insertOnly: true });
    } finally {
      if (oldMode === undefined) delete process.env.KNOWLEDGE_STORAGE_MODE; else process.env.KNOWLEDGE_STORAGE_MODE = oldMode;
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
