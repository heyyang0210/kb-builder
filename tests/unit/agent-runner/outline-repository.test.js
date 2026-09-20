const { hasWritableSnapshotContent, writableSnapshot } = require('../../../packages/agent-runner-core/lib/outline-repository');

describe('数据库大纲仓储快照写入', () => {
  test('过滤数据库投影中的占位大纲，只写入可导入候选', () => {
    const placeholder = {
      id: '42',
      handbookId: 'DB-017',
      name: 'mysql模式参考手册',
      nodes: [],
      state: 'draft'
    };
    const candidate = {
      id: 'outline-1',
      handbookId: 'DB-017',
      content: {
        parts: [{
          part: '实例管理',
          chapters: [{
            name: '实例启停',
            documents: [{ id: 'doc-1', name: '实例启动', desc: '启动数据库实例' }]
          }]
        }]
      }
    };

    expect(hasWritableSnapshotContent(placeholder)).toBe(false);
    expect(hasWritableSnapshotContent(candidate)).toBe(true);
    expect(writableSnapshot({ outlines: [placeholder, candidate] }).outlines).toEqual([candidate]);
  });

  test('保留一级目录直挂页面的导入候选', () => {
    const candidate = {
      id: 'outline-direct-doc',
      handbookId: 'DB-017',
      content: {
        parts: [{
          part: '兼容性',
          documents: [{ id: 'doc-1', name: '兼容性概述', desc: '兼容性说明', techDomainIds: ['2'] }],
          chapters: []
        }]
      }
    };

    expect(hasWritableSnapshotContent(candidate)).toBe(true);
    expect(writableSnapshot({ outlines: [candidate] }).outlines).toEqual([candidate]);
  });
});
