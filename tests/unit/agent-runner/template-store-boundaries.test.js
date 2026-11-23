const { createTemplateStore, hash } = require('../../../packages/agent-runner-core/lib/template-store');
function fixture(initial = {}, asynchronous = false, options = {}) {
  let state = structuredClone(initial);
  const backing = { read: jest.fn(() => structuredClone(state)), transaction(fn) { const draft = structuredClone(state); const result = fn(draft); state = draft; return structuredClone(result); } };
  if (asynchronous) backing.readAsync = jest.fn(async () => structuredClone(state));
  return { store: createTemplateStore({ store: backing, ...options }), backing, snapshot: () => structuredClone(state) };
}
test.each([false, true])('同步/异步列表保留筛选和摘要语义 async=%s', async asynchronous => {
  const f = fixture({}, asynchronous);
  f.store.create({ id: 'alpha', name: '部署指南', type: '部署', description: '数据库', content: '# 甲' });
  f.store.create({ id: 'beta', name: '运维指南', type: '运维', content: '# 乙' });
  f.store.disable('beta', null, false);
  const list = filters => f.store.listAsync(filters);
  expect((await list({ q: ' 数据库 ', type: '部署', status: 'active' })).map(t => t.id)).toEqual(['alpha']);
  expect(await list({ q: 'missing' })).toEqual([]);
  expect(await list({ type: 'missing' })).toEqual([]);
  expect(await list({ status: 'missing' })).toEqual([]);
  expect((await list({ summary: true }))[0].current.content).toBeUndefined();
  expect((await list({ summary: '1' }))[0].current.content).toBeUndefined();
  expect((await list())[0].current.content).toBe('# 甲');
  if (asynchronous) expect(f.backing.readAsync).toHaveBeenCalled();
});
test('缓存返回克隆且成功写入清除摘要缓存', () => {
  const f = fixture({}, false, { listCacheTtlMs: 10000 });
  f.store.create({ id: 'cached', content: '# 初稿' });
  f.store.list({ summary: true });
  const count = f.backing.read.mock.calls.length;
  const cached = f.store.list({ summary: true }); cached[0].name = '污染';
  expect(f.store.list({ summary: true })[0].name).toBe('cached');
  expect(f.backing.read).toHaveBeenCalledTimes(count);
  f.store.save('cached', { baseVersion: 1, content: '# 新稿', name: '新名称', type: '新类型', description: '新说明' });
  expect(f.store.list({ summary: true })[0]).toMatchObject({ name: '新名称', currentVersion: 2 });
  expect(f.backing.read).toHaveBeenCalledTimes(count + 1);
});
test('已删除模板不进入同步或异步目录，停用模板仍可管理', async () => {
  const f = fixture({}, true);
  f.store.create({ id: 'gone', content: '# 删除' });
  f.store.create({ id: 'paused', content: '# 停用' });
  f.store.disable('paused', null, false);
  f.store.remove('gone');
  expect(f.store.list({ summary: '1' }).map(item => item.id)).toEqual(['paused']);
  expect((await f.store.listAsync({ status: 'deleted' })).map(item => item.id)).toEqual([]);
  expect((await f.store.listAsync()).map(item => item.id)).toEqual(['paused']);
  expect(f.store.get('gone')?.status).toBe('deleted');
});
test('零TTL重新读取，缺失当前版本列表返回null', async () => {
  const f = fixture({ templates: [{ id: 'legacy', currentVersion: 3 }], audits: null }, true, { listCacheTtlMs: 0 });
  expect(f.store.list({ summary: true })[0].current).toBeNull();
  expect(f.store.list({ summary: true })[0].current).toBeNull();
  expect(f.backing.read).toHaveBeenCalledTimes(2);
  expect((await f.store.listAsync({ summary: true }))[0].current).toBeNull();
});
test('错误版本与未知模板拒绝，不改变持久化快照', () => {
  const f = fixture(); f.store.create({ id: 'guide', content: '# 文档' });
  const before = f.snapshot();
  for (const operation of [
    () => f.store.save('missing', {}), () => f.store.disable('missing'),
    () => f.store.remove('missing'), () => f.store.getVersion('missing', 1),
    () => f.store.updateMetadata('missing', {}), () => f.store.restoreDraft('missing', 1),
  ]) expect(operation).toThrow(expect.objectContaining({ code: 'TEMPLATE_NOT_FOUND' }));
  for (const version of [0, '1', 99]) {
    expect(() => f.store.getVersion('guide', version)).toThrow(expect.objectContaining({ code: 'TEMPLATE_VERSION_NOT_FOUND' }));
    expect(() => f.store.restoreDraft('guide', version)).toThrow(expect.objectContaining({ code: 'TEMPLATE_VERSION_NOT_FOUND' }));
    expect(() => f.store.save('guide', { baseVersion: version, content: '# 误写' })).toThrow(expect.objectContaining({ code: 'TEMPLATE_VERSION_CONFLICT' }));
  }
  expect(f.snapshot()).toEqual(before);
});
test('历史版本克隆、元数据更新与恢复草稿保留原始正文', () => {
  const f = fixture(); f.store.create({ id: 'guide', content: '# 原文' });
  const changed = f.store.updateMetadata('guide', { baseVersion: 1, name: '新标题' });
  expect(changed.current).toMatchObject({ content: '# 原文', name: '新标题', version: 2 });
  const old = f.store.getVersion('guide', 1); old.content = '污染';
  expect(f.store.getVersion('guide', 1).content).toBe('# 原文');
  expect(f.store.restoreDraft('guide', 1)).toMatchObject({ baseVersion: 2, sourceVersion: 1, restoredBy: null, content: '# 原文' });
  expect(f.store.restoreDraft('guide', 1, { user: { id: 'reader' } }).restoredBy).toBe('reader');
  f.store.remove('guide');
  expect(() => f.store.save('guide', { baseVersion: 2, content: '# 写入' })).toThrow(expect.objectContaining({ code: 'TEMPLATE_INACTIVE' }));
});
test('导入默认值与验证边界不落盘，正文摘要校验拒绝损坏版本', () => {
  const f = fixture();
  expect(f.store.importDraft({ content: '# 草稿' })).toMatchObject({ name: '未命名模板', type: '通用基础', sourceFilename: null, draft: true });
  expect(f.store.importDraft({ content: '# 草稿', sourceFilename: 'guide.md' }).name).toBe('guide.md');
  for (const content of [null, '\0正文', 'x'.repeat(1024 * 1024 + 1), 'api_key: abcdefghijkl']) {
    expect(() => f.store.importDraft({ content })).toThrow(expect.objectContaining({ code: 'TEMPLATE_VALIDATION_FAILED' }));
  }
  expect(f.snapshot()).toEqual({});
  const broken = fixture({ templates: [{ id: 'broken', status: 'active', currentVersion: 1, versions: [{ version: 1, content: '# 文档', contentHash: hash('# 其他'), validationStatus: 'passed' }] }] });
  expect(() => broken.store.resolveForGeneration('broken')).toThrow(expect.objectContaining({ code: 'TEMPLATE_VALIDATION_FAILED' }));
});
test('空名称类型与非法更新字段拒绝，事务回滚后可正常保存', () => {
  const f = fixture();
  for (const input of [{ name: ' ' }, { type: ' ' }]) expect(() => f.store.create({ id: 'bad', content: '# 正文', ...input })).toThrow(expect.objectContaining({ code: 'TEMPLATE_VALIDATION_FAILED' }));
  f.store.create({ id: 'guide', content: '# 原文' });
  const before = f.snapshot();
  for (const field of ['name', 'type', 'description']) {
    for (const value of [' ', 7]) expect(() => f.store.save('guide', { baseVersion: 1, content: '# 新文', [field]: value })).toThrow(expect.objectContaining({ code: 'TEMPLATE_VALIDATION_FAILED' }));
  }
  expect(f.snapshot()).toEqual(before);
  expect(f.store.save('guide', { baseVersion: 1, content: '# 新文', sourceType: 'upload', sourceFilename: 'guide.md', changeSummary: '已更新' }, { user: { id: 'editor' } }).current).toMatchObject({ sourceType: 'upload', sourceFilename: 'guide.md', changeSummary: '已更新', createdBy: 'editor' });
});
