const { test, expect } = require('@playwright/test');
const fs = require('fs');
const base = process.env.KPG_BASE_URL;
const api = path => `${base}/knowledge-center/api/outline${path}`;
test.beforeEach(async ({ page }) => {
  expect((await page.request.post(`${base}/knowledge-center/api/auth/admin/login`, { data: { username: 'admin', password: 'admin' } })).ok()).toBe(true);
});
test('已发布大纲可恢复删除，保留历史、阻止已删除写入和被引用版本清理', async ({ page, playwright }) => {
  const list = await (await page.request.get(api('/governance/list'))).json();
  const version = list.data.find(item => item.state === 'published' && item.handbookId !== 'DB-007');
  expect(version).toBeTruthy();
  const path = `/governance/${encodeURIComponent(version.id)}`;
  const before = await (await page.request.get(api(path))).json();
  const anonymous = await playwright.request.newContext();
  try {
    const forged = await anonymous.post(api(`${path}/purge`), { headers: { 'x-outline-actions': 'outline:purge', 'x-actor-id': 'admin' }, data: { confirmId: version.id, reason: '伪造权限' } });
    expect([401, 403]).toContain(forged.status());
    for (let i = 0; i < 2; i++) expect((await page.request.delete(api(path))).status()).toBe(200);
    const active = await (await page.request.get(api('/governance/list'))).json();
    expect(active.data.some(item => item.id === version.id)).toBe(false);
    const recycle = await (await page.request.get(api('/governance/recycle'))).json();
    expect(recycle.data.find(item => item.id === version.id)).toMatchObject({ state: 'published' });
    const retained = await (await page.request.get(api(path))).json();
    expect(retained.data.nodes).toEqual(before.data.nodes);
    const write = await page.request.put(api(`${path}/governance`), { data: { editVersion: before.data.editVersion } });
    expect(write.status()).toBe(409);
    expect((await write.json()).error.code).toBe('OUTLINE_DELETED');
    const check = await (await page.request.get(api(`${path}/purge-preflight`))).json();
    expect(check.data.canPurge).toBe(false);
    expect(check.data.references).toBeGreaterThan(0);
    const purge = await page.request.post(api(`${path}/purge`), { data: { confirmId: version.id, reason: '引用阻断验证' } });
    expect(purge.status()).toBe(409);
    expect((await purge.json()).error.code).toBe('OUTLINE_PURGE_REFERENCED');
    const production = await page.request.put(`${base}/knowledge-center/api/production/handbooks/${version.handbookId}/documents/deleted-baseline/draft`, { headers: { 'Idempotency-Key': `deleted-${Date.now()}` }, data: { outlineVersionId: version.id, branch: 'main', markdown: '不得保存' } });
    expect(production.status()).toBe(409);
    expect((await production.json()).error.code).toBe('OUTLINE_DELETED');
    const suffix = Date.now().toString(36);
    const newer = await page.request.post(api('/handbooks'), { headers: { 'Idempotency-Key': `restore-conflict-${suffix}` }, data: { handbookId: version.handbookId, name: `恢复冲突-${suffix}`, productId: 'yashandb', businessVersionTags: ['23.4.5.100'], content: { parts: [{ part: '测试', chapters: [{ name: '章', documents: [{ id: suffix, name: '页' }] }] }] } } });
    expect(newer.status()).toBe(201);
    const newerId = (await newer.json()).data.id;
    try {
      const conflict = await page.request.post(api(`${path}/restore`), { data: {} });
      expect(conflict.status()).toBe(409);
      expect((await conflict.json()).error.code).toBe('OUTLINE_RESTORE_CONFLICT');
    } finally {
      expect((await page.request.delete(api(`/governance/${newerId}`))).status()).toBe(200);
      expect((await page.request.post(api(`/governance/${newerId}/purge`), { data: { confirmId: newerId, reason: '隔离恢复冲突测试清理' } })).status()).toBe(200);
    }
  } finally {
    expect((await page.request.post(api(`${path}/restore`), { data: {} })).status()).toBe(200);
    await anonymous.dispose();
  }
  const restored = await (await page.request.get(api('/governance/list'))).json();
  expect(restored.data.some(item => item.id === version.id)).toBe(true);
});
test('浏览器回收站恢复与超级管理员确认彻底删除', async ({ page }) => {
  const initial = await (await page.request.get(api('/governance/list'))).json();
  const assets = await (await page.request.get(`${base}/knowledge-center/api/assets/handbooks?page=1&pageSize=100`)).json();
  const handbook = (assets.data?.items || assets.data?.handbooks || []).find(item => !initial.data.some(outline => String(outline.handbookId) === String(item.handbookId || item.id)));
  expect(handbook).toBeTruthy();
  const handbookId = handbook.handbookId || handbook.id;
  const suffix = Date.now().toString(36);
  const created = await page.request.post(api('/handbooks'), { headers: { 'Idempotency-Key': `recycle-${suffix}` }, data: { handbookId, name: `回收站测试-${suffix}`, productId: 'yashandb', businessVersionTags: ['23.4.5.100'], content: { parts: [{ part: '回归', chapters: [{ name: '测试章', documents: [{ id: `doc-${suffix}`, name: '测试页', desc: '隔离测试' }] }] }] } } });
  expect(created.status()).toBe(201);
  const candidate = (await created.json()).data;
  const path = `/governance/${encodeURIComponent(candidate.id)}`;
  await page.goto(`${base}/knowledge-center/outlines/${encodeURIComponent(handbookId)}`);
  await page.getByText('更多操作').click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '移入回收站' }).click();
  await expect(page.getByText('大纲已移入回收站', { exact: true })).toBeVisible();
  await page.goto(`${base}/knowledge-center/outlines`);
  await page.getByRole('link', { name: '回收站', exact: true }).click();
  await expect(page).toHaveURL(/\/knowledge-center\/outlines\/recycle$/);
  await page.locator(`[data-outline-restore="${candidate.id}"]`).click();
  await expect(page.getByText('大纲已恢复', { exact: true })).toBeVisible();
  expect((await page.request.delete(api(path))).status()).toBe(200);
  await page.reload();
  await expect(page).toHaveURL(/\/knowledge-center\/outlines\/recycle$/);
  await page.locator(`[data-outline-purge="${candidate.id}"]`).click();
  const dialog = page.locator('[data-outline-purge-dialog]');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('确认目标 ID').fill('错误ID');
  await dialog.getByLabel('删除原因').fill('清理隔离测试候选');
  await dialog.getByRole('button', { name: '确认彻底删除' }).click();
  await expect(dialog.getByRole('alert')).toContainText('准确输入');
  await dialog.getByLabel('确认目标 ID').fill(candidate.id);
  const responsePromise = page.waitForResponse(response => response.url() === api(`${path}/purge`) && response.request().method() === 'POST');
  await dialog.getByRole('button', { name: '确认彻底删除' }).click();
  const purgeResult = await (await responsePromise).json();
  await expect(page.getByText('大纲已彻底删除', { exact: true })).toBeVisible();
  expect((await page.request.get(api(path))).status()).toBe(404);
  // Only resolve Storage from this official isolated run's startup log.
  const log = fs.readFileSync(require('path').join(process.env.YASDB_TEST_RUN_DIR, 'details/knowledge-center/logs/storage.log'), 'utf8');
  const storage = log.match(/存储服务已启动：(http:\/\/127\.0\.0\.1:\d+)/)?.[1];
  expect(storage).toBeTruthy();
  const audit = await (await page.request.get(`${storage}/v1/records/outline-lifecycle-audit/${purgeResult.data.auditId}`)).json();
  expect(audit.payload).toMatchObject({ outlineId: candidate.id, action: 'purge', reason: '清理隔离测试候选' });
  expect(audit.payload.actor).toBeTruthy();
});
