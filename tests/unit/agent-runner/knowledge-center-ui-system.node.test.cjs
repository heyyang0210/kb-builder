const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(path.resolve(__dirname, '../../../apps/knowledge-center-web/frontend/knowledge-center/common/ui-system.js'), 'utf8');
const ui = import(`data:text/javascript,${encodeURIComponent(source)}`);
const { compareWithBaseline } = require('../../../tools/repository/check-knowledge-center-ui.cjs');

test('semantic icon and icon button preserve the accessible contract', async () => {
  const { uiButton, uiIcon, uiIconButton } = await ui;
  assert.match(uiIcon('action.close'), /data-lucide="x" aria-hidden="true"/);
  assert.throws(() => uiIcon('unknown'), /未登记/);
  const button = uiIconButton({ usage: 'action.close', label: '关闭"设置', data: { 'dialog-close': '<x>' } });
  assert.match(button, /aria-label="关闭&quot;设置"/);
  assert.match(button, /data-dialog-close="&lt;x&gt;"/);
  assert.throws(() => uiIconButton({ usage: 'action.close', label: '' }), /中文可访问名称/);
  assert.throws(() => uiIconButton({ usage: 'feedback.error', label: '错误' }), /action 图标用途/);
  assert.throws(() => uiIconButton({ usage: 'action.close', label: '关闭', data: { 'onmouseover=x': 'bad' } }), /无效的 data 属性/);
  assert.match(uiButton({ label: '查看&处理', variant: 'tertiary', data: { action: 'review' } }), /data-action="review">查看&amp;处理<\/button>/);
  assert.throws(() => uiButton({ label: '删除', variant: 'danger' }), /未登记的按钮变体/);
});

test('legacy baseline rejects growth in existing or new files', () => {
  const baseline = { files: { 'existing.js': { rawLucide: 2 } } };
  assert.deepEqual(compareWithBaseline({ 'existing.js': { rawLucide: 2 } }, baseline), []);
  assert.deepEqual(compareWithBaseline({ 'existing.js': { rawLucide: 3 } }, baseline), ['existing.js: rawLucide 3 > 存量 2']);
  assert.deepEqual(compareWithBaseline({ 'existing.js': { rawLucide: 2 }, 'new.js': { rawLucide: 1 } }, baseline), ['new.js: rawLucide 1 > 存量 0']);
  assert.deepEqual(compareWithBaseline({ 'existing.js': { rawLucide: 1 } }, baseline), ['existing.js: rawLucide 已降至 1，请同步下调基线 2']);
});
