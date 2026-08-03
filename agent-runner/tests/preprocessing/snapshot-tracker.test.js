const fs = require('fs').promises;
const path = require('path');
const { SnapshotTracker } = require('../../lib/preprocessing/snapshot-tracker');

const TEST_DIR = path.join(__dirname, '..', '..', 'tmp', 'test-snapshot-' + Date.now());

describe('SnapshotTracker', () => {
  let tracker;

  beforeAll(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
    tracker = new SnapshotTracker(TEST_DIR, { maxRetained: 3 });
  });

  afterAll(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('save 和 loadLatest', () => {
    test('应保存并加载最新快照', async () => {
      const snapshot = tracker.buildSnapshot({
        pipeline: 'design-docs',
        executionId: 'exec-test-1',
        durationMs: 1000,
        configHash: 'abc123',
        input: { totalFiles: 10, delta: { added: 10, modified: 0, deleted: 0, unchanged: 0 } },
        output: { cleanedFiles: 10, chunkCount: 20 },
        quality: { passed: true },
        fileHashes: { 'file1.md': { hash: 'h1' } }
      });

      await tracker.save('design-docs', snapshot);
      const loaded = await tracker.loadLatest('design-docs');

      expect(loaded).toBeTruthy();
      expect(loaded.pipeline).toBe('design-docs');
      expect(loaded.execution_id).toBe('exec-test-1');
      expect(loaded.input.total_files).toBe(10);
    });

    test('不存在的 pipeline 应返回 null', async () => {
      const loaded = await tracker.loadLatest('nonexistent');
      expect(loaded).toBeNull();
    });
  });

  describe('load 指定快照', () => {
    test('应加载指定 ID 的快照', async () => {
      const snapshot = tracker.buildSnapshot({
        pipeline: 'design-docs',
        executionId: 'exec-test-2',
        durationMs: 2000,
        configHash: 'def456',
        input: { totalFiles: 5 },
        output: {},
        fileHashes: {}
      });

      await tracker.save('design-docs', snapshot);
      const loaded = await tracker.load('design-docs', snapshot.snapshot_id);

      expect(loaded).toBeTruthy();
      expect(loaded.snapshot_id).toBe(snapshot.snapshot_id);
    });

    test('不存在的快照 ID 应返回 null', async () => {
      const loaded = await tracker.load('design-docs', 'snap-nonexistent');
      expect(loaded).toBeNull();
    });
  });

  describe('list', () => {
    test('应列出所有快照（按时间倒序）', async () => {
      const snapshots = await tracker.list('design-docs');
      expect(snapshots.length).toBeGreaterThan(0);
      // 验证按时间倒序
      for (let i = 1; i < snapshots.length; i++) {
        expect(new Date(snapshots[i - 1].executed_at).getTime())
          .toBeGreaterThanOrEqual(new Date(snapshots[i].executed_at).getTime());
      }
    });

    test('空 pipeline 应返回空数组', async () => {
      const snapshots = await tracker.list('empty-pipeline');
      expect(snapshots).toEqual([]);
    });
  });

  describe('快照保留策略', () => {
    test('应只保留最近 maxRetained 个快照', async () => {
      const pipeline = 'prune-test';
      // 创建 5 个快照（maxRetained=3）
      for (let i = 0; i < 5; i++) {
        const snapshot = tracker.buildSnapshot({
          pipeline,
          executionId: `exec-prune-${i}`,
          durationMs: 100,
          configHash: `hash-${i}`,
          input: { totalFiles: i },
          output: {},
          fileHashes: {}
        });
        // 等待以确保时间戳不同
        await new Promise(r => setTimeout(r, 10));
        await tracker.save(pipeline, snapshot);
      }

      const list = await tracker.list(pipeline);
      expect(list.length).toBeLessThanOrEqual(3);
    });
  });

  describe('generateSnapshotId', () => {
    test('应生成符合格式的 ID', () => {
      const id = tracker.generateSnapshotId('design-docs');
      expect(id).toMatch(/^snap-\d{14}-[a-f0-9]{8}$/);
    });
  });

  describe('computeConfigHash', () => {
    test('相同配置应生成相同 hash', () => {
      const config = { a: 1, b: 2 };
      const hash1 = SnapshotTracker.computeConfigHash(config);
      const hash2 = SnapshotTracker.computeConfigHash(config);
      expect(hash1).toBe(hash2);
    });

    test('不同配置应生成不同 hash', () => {
      const hash1 = SnapshotTracker.computeConfigHash({ a: 1 });
      const hash2 = SnapshotTracker.computeConfigHash({ a: 2 });
      expect(hash1).not.toBe(hash2);
    });

    test('键顺序不应影响 hash', () => {
      const hash1 = SnapshotTracker.computeConfigHash({ a: 1, b: 2 });
      const hash2 = SnapshotTracker.computeConfigHash({ b: 2, a: 1 });
      expect(hash1).toBe(hash2);
    });
  });
});
