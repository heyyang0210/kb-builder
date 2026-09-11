const report = require('../../../docs/agent-runner/modules/platform-foundation/baseline/p0-migration-dry-run.json');

describe('知识中心迁移预演报告', () => {
  test('报告为只读预演且每条源都有摘要', () => {
    expect(report).toMatchObject({ success: true, mode: 'dry-run', count: 9 });
    expect(report.records).toHaveLength(report.count);
    expect(report.records.every(item => item.action === 'would_import' && /^[a-f0-9]{64}$/.test(item.sha256))).toBe(true);
  });
});
