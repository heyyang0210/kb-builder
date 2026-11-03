const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const moduleURL = pathToFileURL(path.resolve('apps/knowledge-center-web/frontend/knowledge-center/modules/production/writing-changes.js'));
test('修订决策保留换行、重复段落、空正文与大段正文的精确内容', async () => {
  const { writingChanges, assembleWritingChanges } = await import(moduleURL);
  const cases = [['', '新增'], ['旧文\n', ''], ['a\r\nb\n', 'a\r\nc\n'], ['重复\n重复\n末尾', '重复\n新增\n重复\n末尾'], ['相同\n', '相同\n'], ['旧\n'.repeat(600), '新\n'.repeat(600)]];
  for (const [before, after] of cases) {
    const changes = writingChanges(before, after);
    assert.equal(assembleWritingChanges(changes), after);
    changes.filter(x => x.type === 'change').forEach(x => { x.decision = 'rejected'; });
    assert.equal(assembleWritingChanges(changes), before);
  }
});
test('多处修订可单独接受和拒绝，未变部分保持原样', async () => {
  const { writingChanges, assembleWritingChanges } = await import(moduleURL);
  const changes = writingChanges('开头\n旧甲\n保留\n旧乙\n末尾\n', '开头\n新甲\n保留\n新乙\n末尾\n');
  const blocks = changes.filter(x => x.type === 'change'); assert.equal(blocks.length, 2);
  blocks[0].decision = 'rejected'; blocks[1].decision = 'accepted';
  assert.equal(assembleWritingChanges(changes), '开头\n旧甲\n保留\n新乙\n末尾\n');
});
