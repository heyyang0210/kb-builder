const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('已撤出文档与来源意见的审核 ID 保留在任务索引', () => {
  const root = path.resolve(__dirname, '../../..');
  const runtime = path.join(root, 'runtime/test-results');
  fs.mkdirSync(runtime, { recursive: true });
  const output = fs.mkdtempSync(path.join(runtime, 'document-task-review-index-'));
  try {
    const source = path.join(root, 'apps/yashandb-storage/src');
    const fixture = path.join(__dirname, 'fixtures/DocumentTaskHistoricalReviewCheck.java');
    const compiled = spawnSync('javac', ['-cp', source, '-d', output, fixture,
      path.join(source, 'DocumentTaskIndex.java'), path.join(source, 'TaskNumber.java')],
    { encoding: 'utf8', timeout: 30000 });
    expect({ status: compiled.status, stderr: compiled.stderr }).toEqual({ status: 0, stderr: '' });
    const result = spawnSync('java', ['-cp', output, 'DocumentTaskHistoricalReviewCheck'],
      { encoding: 'utf8', timeout: 30000 });
    expect({ status: result.status, stderr: result.stderr }).toEqual({ status: 0, stderr: '' });
  } finally {
    fs.rmSync(output, { recursive: true, force: true });
  }
});
