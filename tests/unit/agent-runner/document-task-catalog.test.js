const { projectCatalog } = require('../../../packages/agent-runner-core/lib/document-task-catalog');

test('目录候选只投影真实节点、版本和标识', () => {
  const directory = {
    id: 'outline-a', currentOutlineVersionId: 'version-a',
    nodes: [
      { id: 7, kind: 'document', title: '文档 A', parentId: 1 },
      { id: 8, kind: 'knowledge_point', name: '知识点 B', parentId: 1 },
      { id: 9, kind: 'chapter', name: '章节 C' },
      { id: 10, kind: 'part' },
      { id: 11, kind: 'other', name: '不应投影' },
    ],
  };
  expect(projectCatalog({ directory, selectedId: 'selected', items: [
    { businessVersionTags: ['V1', 'V1', { name: 'V2' }] },
    { businessVersions: [{ version: 'V3' }, {}] },
  ] })).toEqual({
    outlineId: 'selected', outlineVersionId: 'version-a', versions: ['V1', 'V2', 'V3'],
    documents: [
      { id: '7', name: '文档 A', parentId: 1, ownerId: null, ownerMatch: 'unassigned' },
      { id: '8', name: '知识点 B', parentId: 1, ownerId: null, ownerMatch: 'unassigned' },
    ],
    chapters: [
      { id: '9', name: '章节 C' },
      { id: '10', name: 10 },
    ],
    directory,
  });
});

test('空目录和治理节点使用显式空值，不制造候选', () => {
  expect(projectCatalog()).toEqual({
    outlineId: null, outlineVersionId: null, versions: [], documents: [], chapters: [], directory: {},
  });
  expect(projectCatalog({ directory: { governance: { nodes: [{ id: 'doc', kind: 'document' }] }, outlineStructureVersion: 'old-version' },
    items: [{ businessVersions: [] }] })).toEqual({
    outlineId: null, outlineVersionId: 'old-version', versions: [],
    documents: [{ id: 'doc', name: 'doc', parentId: undefined, ownerId: null, ownerMatch: 'unassigned' }], chapters: [],
    directory: { governance: { nodes: [{ id: 'doc', kind: 'document' }] }, outlineStructureVersion: 'old-version' },
  });
});

test('存量文档按已绑定主责匹配，冲突或未绑定不猜测', () => {
  const ownership = (assigneeId, domainRole, status = 'BOUND') => ({ assigneeId, domainRole, status });
  const assignments = [
    { nodeId: 'a', ownerships: [ownership('person-a', 'PRIMARY'), ownership('person-b', 'COLLABORATOR')] },
    { nodeId: 'b', ownerships: [ownership('person-a', 'PRIMARY'), ownership('person-b', 'PRIMARY')] },
    { nodeId: 'c', ownerships: [ownership('person-c', null, 'assigned')] },
    { nodeId: 'd', ownerships: [ownership('person-d', 'PRIMARY', 'PENDING')] },
    { nodeId: 'e', techDomainIds: ['domain-e'], ownerships: [{ ...ownership('person-e', 'COLLABORATOR'), techDomainId: 'domain-e' }] },
  ];
  const result = projectCatalog({ directory: { nodes: ['a', 'b', 'c', 'd', 'e'].map(id => ({ id, kind: 'document' })), governance: { effectiveDocumentAssignments: assignments } } });
  expect(result.documents.map(({ ownerId, ownerMatch }) => [ownerId, ownerMatch])).toEqual([
    ['person-a', 'primary'], [null, 'unassigned'], ['person-c', 'single'], [null, 'unassigned'], [null, 'unassigned'],
  ]);
});

test('未发布大纲不提供存量文档候选', () => {
  const catalog = projectCatalog({ directory: { state: 'draft', currentOutlineVersionId: 'draft-v1', nodes: [{ id: 'd1', kind: 'document' }] } });
  expect(catalog.outlineVersionId).toBeNull();
  expect(catalog.documents).toEqual([]);
});

test('数据库当前已发布版本以目录 id 作为有效版本，内容构建阶段可选文档', () => {
  const catalog = projectCatalog({ selectedId: 'outline-23.2', items: [{ handbookId: 'SQL', manualStatus: 'content_building', state: 'published' }], directory: { id: 'outline-23.2', state: 'published', nodes: [{ id: 'doc-1', kind: 'document', title: 'SQL 参考' }] } });
  expect(catalog.outlineVersionId).toBe('outline-23.2');
  expect(catalog.documents).toEqual([{ id: 'doc-1', name: 'SQL 参考', parentId: undefined, ownerId: null, ownerMatch: 'unassigned' }]);
});
