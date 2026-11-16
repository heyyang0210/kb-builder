const test = require('node:test');
const assert = require('node:assert/strict');

test('未匹配仓库文件时使用平台当前正文作为可校验来源快照', async () => {
  const { createPlatformOriginSnapshot } = await import('../../../apps/knowledge-center-web/frontend/knowledge-center/modules/production/origin-snapshot.js');
  const markdown = '# 当前文档\n\n平台中已保存的正文。';
  const result = await createPlatformOriginSnapshot(markdown, {
    handbookId: 'HB-1', documentId: 'doc-1', outlineVersionId: 'outline-v1', branch: 'main',
  });
  assert.equal(result.content, markdown);
  assert.equal(result.snapshot.originType, 'platform');
  assert.equal(result.snapshot.handbookId, 'HB-1');
  assert.equal(result.snapshot.documentId, 'doc-1');
  assert.equal(result.snapshot.branch, 'main');
  assert.match(result.snapshot.contentDigest, /^[a-f0-9]{64}$/);
});
