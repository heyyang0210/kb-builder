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
      { id: '7', name: '文档 A', parentId: 1 },
      { id: '8', name: '知识点 B', parentId: 1 },
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
    documents: [{ id: 'doc', name: 'doc', parentId: undefined }], chapters: [],
    directory: { governance: { nodes: [{ id: 'doc', kind: 'document' }] }, outlineStructureVersion: 'old-version' },
  });
});
