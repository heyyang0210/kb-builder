const { OutlineRepository, hasWritableSnapshotContent, writableSnapshot } = require('../../../packages/agent-runner-core/lib/outline-repository');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('大纲文件仓储恢复与锁', () => {
  let root, repository, originalMode;
  beforeEach(() => {
    originalMode = process.env.KNOWLEDGE_STORAGE_MODE;
    process.env.KNOWLEDGE_STORAGE_MODE = 'file';
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'outline-repository-boundaries-'));
    repository = new OutlineRepository(root);
  });
  afterEach(() => {
    jest.restoreAllMocks();
    if (originalMode === undefined) delete process.env.KNOWLEDGE_STORAGE_MODE;
    else process.env.KNOWLEDGE_STORAGE_MODE = originalMode;
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('无文件返回空快照，非数组条目规范为空并保留元数据', () => {
    expect(repository.read()).toEqual({ outlines: [] });
    fs.writeFileSync(repository.metadataPath, JSON.stringify({ revision: 3, outlines: {} }));
    expect(repository.read()).toEqual({ revision: 3, outlines: [] });
  });

  test.each([{ outlines: [] }, { outlines: [{ id: 'saved' }] }])('主文件损坏从备份恢复条目 %j', ({ outlines }) => {
    fs.writeFileSync(repository.metadataPath, '{broken');
    fs.writeFileSync(`${repository.metadataPath}.bak`, JSON.stringify({ revision: 7, outlines }));
    expect(repository.read()).toEqual({ revision: 7, outlines });
  });

  test('备份的非数组条目规范化，无备份损坏明确报错', () => {
    fs.writeFileSync(repository.metadataPath, '{broken');
    expect(() => repository.read()).toThrow('大纲元数据损坏且无可用备份');
    fs.writeFileSync(`${repository.metadataPath}.bak`, JSON.stringify({ revision: 9, outlines: null }));
    expect(repository.read()).toEqual({ revision: 9, outlines: [] });
  });

  test('更新保留前一版本备份，原地修改和显式返回均可保存', () => {
    repository.write({ outlines: [{ id: 'old' }] });
    const updated = repository.update(current => { current.outlines.push({ id: 'new' }); });
    expect(updated).toEqual({ outlines: [{ id: 'old' }, { id: 'new' }] });
    expect(JSON.parse(fs.readFileSync(`${repository.metadataPath}.bak`, 'utf8'))).toEqual({ outlines: [{ id: 'old' }] });
    expect(repository.update(() => ({ outlines: [], revision: 2 }))).toEqual({ outlines: [], revision: 2 });
    expect(repository.read()).toEqual({ outlines: [], revision: 2 });
    expect(fs.existsSync(repository.lockPath)).toBe(false);
  });

  test('持有外部锁时写入和更新都拒绝，不删除外部锁或改变数据', () => {
    const initial = { outlines: [{ id: 'keep' }] };
    repository.write(initial);
    fs.writeFileSync(repository.lockPath, 'external-lock');
    const mutate = jest.fn();
    expect(() => repository.write({ outlines: [] })).toThrow();
    expect(() => repository.update(mutate)).toThrow();
    expect(mutate).not.toHaveBeenCalled();
    expect(repository.read()).toEqual(initial);
    expect(fs.readFileSync(repository.lockPath, 'utf8')).toBe('external-lock');
  });

  test('写入和变更器失败均释放本次锁，旧数据可继续更新', () => {
    const initial = { outlines: [{ id: 'keep' }] };
    repository.write(initial);
    const write = jest.spyOn(repository, 'writeUnlocked').mockImplementationOnce(() => { throw new Error('disk full'); });
    expect(() => repository.write({ outlines: [] })).toThrow('disk full');
    write.mockRestore();
    expect(fs.existsSync(repository.lockPath)).toBe(false);
    expect(() => repository.update(() => { throw new Error('invalid candidate'); })).toThrow('invalid candidate');
    expect(fs.existsSync(repository.lockPath)).toBe(false);
    expect(repository.read()).toEqual(initial);
    repository.update(current => { current.recovered = true; });
    expect(repository.read()).toEqual({ ...initial, recovered: true });
  });

  test('空追加不写文件，重复候选拒绝且合法追加合并幂等记录', () => {
    repository.append([]);
    expect(fs.existsSync(repository.metadataPath)).toBe(false);
    repository.write({ outlines: [{ id: 'old' }], idempotency: { existing: 'old' } });
    expect(() => repository.append([{ id: 'old' }])).toThrow('候选ID已存在');
    expect(repository.read().outlines).toEqual([{ id: 'old' }]);
    repository.append([{ id: 'new' }], { idempotency: { next: 'new' } });
    expect(repository.read()).toEqual({ outlines: [{ id: 'old' }, { id: 'new' }], idempotency: { existing: 'old', next: 'new' } });
  });

  test('数据库更新克隆读取快照，仅持久化可写候选', () => {
    process.env.KNOWLEDGE_STORAGE_MODE = 'database';
    const candidate = { id: 'candidate', content: { schemaVersion: 1, nodes: [{ kind: 'document' }] } };
    const current = { outlines: [candidate, { id: 'placeholder' }] };
    jest.spyOn(repository.domainStore, 'readOutlines').mockReturnValue(current);
    const write = jest.spyOn(repository.domainStore, 'writeOutlinesSnapshot').mockReturnValue({ success: true });
    const next = repository.update(copy => { copy.outlines[0].name = 'updated'; return copy; });
    expect(current.outlines[0]).not.toHaveProperty('name');
    expect(next.outlines[0].name).toBe('updated');
    expect(write).toHaveBeenCalledWith({ outlines: [{ ...candidate, name: 'updated' }] });
    repository.update(() => undefined);
    expect(write).toHaveBeenLastCalledWith({ outlines: [candidate] });
  });

  test('默认仓库路径只构造不写入，首次追加建立幂等记录', () => {
    const { AGENT_RUNNER_RUNTIME_ROOT } = require('../../../packages/agent-runner-core/lib/repo-paths');
    expect(new OutlineRepository().rootDir).toBe(path.join(AGENT_RUNNER_RUNTIME_ROOT, 'outlines'));
    repository.append([{ id: 'first' }], { idempotency: { request: 'first' } });
    expect(repository.read()).toEqual({ outlines: [{ id: 'first' }], idempotency: { request: 'first' } });
  });
});

describe('数据库大纲仓储快照写入', () => {
  test('空快照与递归知识点目录均按文档存在性筛选', () => {
    expect(writableSnapshot()).toEqual({ outlines: [] });
    expect(hasWritableSnapshotContent()).toBe(false);
    expect(hasWritableSnapshotContent({ content: { parts: [{ chapters: [undefined] }] } })).toBe(false);
    const nested = { content: { parts: [{ children: [{ children: [{ knowledgePoints: [{ id: 'kp' }] }] }] }] } };
    expect(hasWritableSnapshotContent(nested)).toBe(true);
    expect(hasWritableSnapshotContent({ content: { parts: [{ chapters: [{ kps: ['kp'] }] }] } })).toBe(true);
    expect(hasWritableSnapshotContent({ content: { schemaVersion: 1, nodes: [{ kind: 'directory' }] } })).toBe(false);
    expect(writableSnapshot({ outlines: [{ ...nested, deletedAt: 'deleted' }, nested] }).outlines).toEqual([nested]);
  });
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
