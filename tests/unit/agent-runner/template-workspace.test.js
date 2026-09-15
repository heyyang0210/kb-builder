const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function modules() {
  const root = path.resolve(__dirname, '../../../apps/knowledge-center-web/frontend/knowledge-center');
  const [{ renderTemplates }, { authState }] = await Promise.all(['modules/templates/view.js', 'common/state/auth-state.js'].map(file => import(pathToFileURL(path.join(root, file)).href)));
  return { renderTemplates, authState };
}
const selected = { id: 'template.test', name: '测试模板', type: '数据库', description: '用途说明', status: 'active', currentVersion: 2, current: { content: '# 当前正文', validationStatus: 'passed' }, versions: [{ version: 1, content: '# 原始正文', createdBy: 'tester', validationStatus: 'passed' }] };

test('read-only workspace defaults to preview and collapsed history without write operations', async () => {
  const { renderTemplates, authState } = await modules();
  authState.session = { allowedActions: ['template:read'] };
  const html = renderTemplates({ templateProjection: { selected, items: [selected] }, templateUi: { status: 'active' } });
  assert.match(html, /<h1>当前正文<\/h1>/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /data-template-list-toggle/); assert.match(html, /data-template-list-resizer/); assert.match(html, /data-template-focus/);
  for (const action of ['data-template-upload', 'data-template-new', 'data-template-save', 'data-template-field', 'data-template-content', 'class="template-history"']) assert.ok(!html.includes(action), action);
});

test('filters, editing, draft preservation projection and history readonly state', async () => {
  const { renderTemplates, authState } = await modules();
  authState.session = { allowedActions: ['template:read', 'template:edit', 'template:manage'] };
  const data = { selected, items: [selected, { ...selected, id: 'disabled', name: '停用样例', status: 'disabled' }] };
  const ui = { status: 'active', draftKey: selected.id, drafts: { [selected.id]: { ...selected, content: '未保存内容', dirty: true } }, mode: 'edit' };
  const html = renderTemplates({ templateProjection: data, templateUi: ui });
  assert.match(html, /data-template-save/); assert.match(html, /data-template-content/); assert.match(html, /未保存内容/); assert.doesNotMatch(html, /data-template-id="disabled"/);
  const history = renderTemplates({ templateProjection: data, templateUi: { ...ui, historyOpen: true, historyVersion: selected.versions[0] } });
  assert.match(history, /正在只读查看历史版本 v1/); assert.match(history, /<h1>原始正文<\/h1>/); assert.doesNotMatch(history, /data-template-content/); assert.doesNotMatch(history, /data-template-save/); assert.match(history, /载入为当前草稿/);
  assert.match(history, /class="template-history"/);
});

test('untrusted template markup is escaped; executable links and remote images are not rendered', async () => {
  const { renderTemplates, authState } = await modules();
  authState.session = { allowedActions: ['template:read'] };
  const unsafe = { ...selected, current: { content: '<script>alert(1)</script>\n\n[点击](javascript:alert%281%29)\n\n![图片](https://example.com/private.png)' } };
  const html = renderTemplates({ templateProjection: { selected: unsafe, items: [] } });
  assert.doesNotMatch(html, /<script>|href="javascript:|<img/); assert.match(html, /&lt;script&gt;/);
});
