// Writes one template to the explicitly selected development service; keeps it for verification.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { hash } = require('../../../packages/agent-runner-core/lib/template-store');

(async () => {
  const base = process.env.TEMPLATE_TEST_BASE_URL;
  const password = process.env.TEMPLATE_TEST_LOGIN_PASSWORD;
  if (!base || !password) throw new Error('请显式提供开发环境 TEMPLATE_TEST_BASE_URL 和 TEMPLATE_TEST_LOGIN_PASSWORD；本测试会保留一条模板。');
  const file = path.resolve(__dirname, '../../../knowledge/templates/01-通用基础模板.md');
  const content = fs.readFileSync(file, 'utf8');
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const login = await context.request.post(`${base}/knowledge-center/api/auth/admin/login`, { data: { username: process.env.TEMPLATE_TEST_LOGIN_USERNAME || 'admin', password } });
    assert.equal(login.status(), 200, '真实认证失败');
    const page = await context.newPage(); page.setDefaultTimeout(30000);
    await page.goto(`${base}/knowledge-center/templates`);
    const chooser = page.waitForEvent('filechooser');
    await page.locator('[data-template-dropzone]').click();
    await (await chooser).setFiles(file);
    await page.locator('[data-template-status]').filter({ hasText: '已保存 1 个' }).waitFor();
    const id = await page.locator('.template-list-item.active').getAttribute('data-template-id');
    const response = await context.request.get(`${base}/knowledge-center/api/templates/${id}`);
    assert.equal(response.status(), 200);
    const item = (await response.json()).data;
    assert.equal(item.name, '01-通用基础模板'); assert.equal(item.sourceFilename, '01-通用基础模板.md');
    assert.equal(item.currentVersion, 1); assert.equal(item.current.content, content);
    assert.equal(item.current.contentHash, hash(content));
    await page.reload();
    await page.locator(`[data-template-id="${id}"]`).click();
    await page.waitForFunction(id => document.querySelector('.template-list-item.active')?.dataset.templateId === id, id);
    assert.ok((await page.locator('.template-preview').innerText()).length > 100);
    await page.screenshot({ path: '/tmp/template-live-auto-import.png', fullPage: true });
    console.log(JSON.stringify({ base, templateId: id, version: 1, contentEqual: true, hashVerified: true, reloadPreview: true }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
