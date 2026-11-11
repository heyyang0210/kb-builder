const fs = require('fs').promises;
const path = require('path');
const { SnapshotTracker } = require('../../../../packages/agent-runner-core/lib/preprocessing/snapshot-tracker');

describe('快照文件协议边界', () => {
  let root;
  let tracker;
  beforeEach(async () => {
    const base = path.resolve(__dirname, '../../../../runtime/test-results/fixtures');
    await fs.mkdir(base, { recursive: true });
    root = await fs.mkdtemp(path.join(base, 'snapshot-boundaries-'));
    tracker = new SnapshotTracker(root);
  });
  afterEach(async () => fs.rm(root, { recursive: true, force: true }));

  test('保留完整统计及前序关联，空统计使用默认值', () => {
    const snapshot = tracker.buildSnapshot({ pipeline: 'docs', input: {}, output: {} });
    expect(snapshot).toMatchObject({ previous_snapshot_id: null,
      input: { total_files: 0, delta: { added: 0, modified: 0, deleted: 0, unchanged: 0 } },
      output: { cleaned_files: 0, chunk_count: 0, l1_entries: 0, l2_summaries: 0 },
      quality: { passed: true, checks: {} }, file_hashes: {} });
    const full = tracker.buildSnapshot({ pipeline: 'docs', previousSnapshotId: 'before',
      input: { totalFiles: 4, delta: { added: 4 } },
      output: { cleanedFiles: 4, chunkCount: 8, l1Entries: 2, l2Summaries: 1 },
      quality: { passed: false }, fileHashes: { a: 'hash' } });
    expect(full).toMatchObject({ previous_snapshot_id: 'before', input: { total_files: 4 },
      output: { cleaned_files: 4, chunk_count: 8, l1_entries: 2, l2_summaries: 1 },
      quality: { passed: false }, file_hashes: { a: 'hash' } });
    expect(tracker.maxRetained).toBe(10);
  });

  test('读取损坏JSON失败，修复后可以恢复读取', async () => {
    await fs.mkdir(path.join(root, 'docs'));
    for (const file of ['latest.json', 'snap-bad.json']) {
      await fs.writeFile(path.join(root, 'docs', file), '{broken');
    }
    await expect(tracker.loadLatest('docs')).rejects.toThrow(SyntaxError);
    await expect(tracker.load('docs', 'snap-bad')).rejects.toThrow(SyntaxError);
    await fs.writeFile(path.join(root, 'docs', 'latest.json'), '{"snapshot_id":"fixed"}');
    await expect(tracker.loadLatest('docs')).resolves.toEqual({ snapshot_id: 'fixed' });
  });

  test('列表跳过损坏文件并保留缺省元数据，按执行时间排序', async () => {
    const dir = path.join(root, 'docs');
    await fs.mkdir(dir);
    const entries = {
      'snap-old.json': JSON.stringify({ snapshot_id: 'old', executed_at: '2020-01-01', input: { total_files: 3, delta: { added: 3 } } }),
      'snap-new.json': JSON.stringify({ snapshot_id: 'new', executed_at: '2021-01-01' }),
      'snap-bad.json': '{broken', 'latest.json': '{}', 'snap-note.txt': '{}', 'readme.json': '{}',
    };
    for (const [file, content] of Object.entries(entries)) await fs.writeFile(path.join(dir, file), content);
    const list = await tracker.list('docs');
    expect(list.map(item => item.snapshot_id)).toEqual(['new', 'old']);
    expect(list[0].input_files).toBeUndefined();
    expect(list[0].delta).toBeUndefined();
    expect(list[1]).toMatchObject({ input_files: 3, delta: { added: 3 } });
  });

  test('非目录存储路径的列表和清理错误向调用者传播', async () => {
    await fs.writeFile(path.join(root, 'blocked'), 'file');
    await expect(tracker.list('blocked')).rejects.toMatchObject({ code: 'ENOTDIR' });
    await expect(tracker.pruneOldSnapshots('blocked')).rejects.toMatchObject({ code: 'ENOTDIR' });
    await expect(tracker.pruneOldSnapshots('missing')).resolves.toBeUndefined();
  });

  test('latest目录冲突不会误报保存成功，移除冲突后可以保存', async () => {
    const latest = path.join(root, 'docs', 'latest.json');
    await fs.mkdir(latest, { recursive: true });
    const snapshot = tracker.buildSnapshot({ pipeline: 'docs', input: {}, output: {} });
    await expect(tracker.save('docs', snapshot)).rejects.toMatchObject({ code: 'EISDIR' });
    await fs.rmdir(latest);
    await expect(tracker.save('docs', snapshot)).resolves.toBe(snapshot.snapshot_id);
    await expect(tracker.loadLatest('docs')).resolves.toEqual(snapshot);
  });

  test('清理时删除目录失败向调用者传播，修复后仅删除旧快照', async () => {
    tracker = new SnapshotTracker(root, { maxRetained: 1 });
    const dir = path.join(root, 'docs');
    await fs.mkdir(path.join(dir, 'snap-001.json'), { recursive: true });
    await fs.writeFile(path.join(dir, 'snap-002.json'), '{}');
    await fs.writeFile(path.join(dir, 'latest.json'), '{}');
    await expect(tracker.pruneOldSnapshots('docs')).rejects.toMatchObject({ code: 'EISDIR' });
    await fs.rmdir(path.join(dir, 'snap-001.json'));
    await fs.writeFile(path.join(dir, 'snap-001.json'), '{}');
    await tracker.pruneOldSnapshots('docs');
    expect((await fs.readdir(dir)).sort()).toEqual(['latest.json', 'snap-002.json']);
  });
});
