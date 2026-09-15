#!/usr/bin/env node
/* 将企业能力包登记的模板导入模板聚合；默认仅预览，--apply 才写入。 */
const fs = require('fs'); const path = require('path');
const { loadProfile } = require('../../packages/agent-runner-core/lib/platform-profile/profile-loader');
const { createTemplateStore } = require('../../packages/agent-runner-core/lib/template-store');
const root = path.resolve(__dirname, '../..');
const apply = process.argv.includes('--apply');
const { profile } = loadProfile({ repositoryRoot: root });
const store = createTemplateStore(); const existing = new Set(store.list().map(t => t.id));
const result = [];
for (const item of profile.templates) {
  const file = path.resolve(root, item.resourceRef); const content = fs.readFileSync(file, 'utf8');
  if (existing.has(item.id)) { result.push({ id: item.id, status: 'skipped' }); continue; }
  const input = { id: item.id, name: item.id, type: item.id, content, sourceType: 'migration', legacyPath: item.resourceRef, sourceFilename: path.basename(file) };
  if (apply) store.create(input, { user: { id: 'template-initializer' } });
  result.push({ id: item.id, status: apply ? 'created' : 'planned', source: item.resourceRef });
}
console.log(JSON.stringify({ apply, count: result.length, templates: result }, null, 2));
