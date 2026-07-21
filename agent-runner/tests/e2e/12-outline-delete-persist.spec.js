const { test, expect, openPage } = require('./helpers');
const path = require('path');
const fs = require('fs');

test.describe('Outline Delete Persistence - 大纲删除持久化', () => {
  const OUTLINE_FILE = path.resolve(__dirname, '../../../outlines/兼容性领域知识点大纲.md');
  const BACKEND = 'http://localhost:4100';

  test.beforeAll(async ({ request }) => {
    const resp = await request.get(BACKEND + '/api/outline/list');
    if (resp.ok()) {
      const data = await resp.json();
      if (data.success && data.data) {
        for (const outline of data.data) {
          await request.delete(BACKEND + '/api/outline/' + outline.id);
        }
      }
    }
  });

  test('上传大纲后刷新页面，大纲仍然存在', async ({ page }) => {
    if (!fs.existsSync(OUTLINE_FILE)) { test.skip(); return; }

    await openPage(page);
    const fileInput = page.locator('#outlineFileInput');
    await fileInput.setInputFiles(OUTLINE_FILE);
    await page.waitForTimeout(2000);

    const listResp = await page.evaluate(async (url) => {
      const resp = await fetch(url + '/api/outline/list');
      return resp.json();
    }, BACKEND);

    expect(listResp.success).toBeTruthy();
    expect(listResp.data.length).toBeGreaterThan(0);

    // Refresh and verify outline still exists
    await openPage(page);
    await page.waitForTimeout(1500);

    const listAfterRefresh = await page.evaluate(async (url) => {
      const resp = await fetch(url + '/api/outline/list');
      return resp.json();
    }, BACKEND);

    expect(listAfterRefresh.success).toBeTruthy();
    expect(listAfterRefresh.data.length).toBeGreaterThan(0);
  });

  test('删除大纲后刷新页面，大纲不再存在', async ({ page, request }) => {
    if (!fs.existsSync(OUTLINE_FILE)) { test.skip(); return; }

    await openPage(page);
    const fileInput = page.locator('#outlineFileInput');
    await fileInput.setInputFiles(OUTLINE_FILE);
    await page.waitForTimeout(2000);

    // Get outline ID from backend
    const listResp = await request.get(BACKEND + '/api/outline/list');
    const listData = await listResp.json();
    expect(listData.data.length).toBeGreaterThan(0);
    const outlineId = listData.data[listData.data.length - 1].id;

    // Delete via backend API
    const deleteResp = await request.delete(BACKEND + '/api/outline/' + outlineId);
    const deleteData = await deleteResp.json();
    expect(deleteData.success).toBeTruthy();

    // Refresh and verify outline is gone
    await openPage(page);
    await page.waitForTimeout(1500);

    const listAfterDelete = await page.evaluate(async (url) => {
      const resp = await fetch(url + '/api/outline/list');
      return resp.json();
    }, BACKEND);

    const remainingIds = (listAfterDelete.data || []).map(o => o.id);
    expect(remainingIds).not.toContain(outlineId);
  });

  test('uploadedOutlines 数组中的对象包含 id 字段', async ({ page }) => {
    if (!fs.existsSync(OUTLINE_FILE)) { test.skip(); return; }

    await openPage(page);
    const fileInput = page.locator('#outlineFileInput');
    await fileInput.setInputFiles(OUTLINE_FILE);
    await page.waitForTimeout(2000);

    const hasId = await page.evaluate(() => {
      if (typeof uploadedOutlines === 'undefined') return false;
      return uploadedOutlines.length > 0 && uploadedOutlines.every(item => item.id !== undefined);
    });

    expect(hasId).toBeTruthy();

    // Clean up
    const listResp = await page.evaluate(async (url) => {
      const resp = await fetch(url + '/api/outline/list');
      return resp.json();
    }, BACKEND);
    for (const outline of (listResp.data || [])) {
      await page.evaluate(async ({ url, id }) => {
        await fetch(url + '/api/outline/' + id, { method: 'DELETE' });
      }, { url: BACKEND, id: outline.id });
    }
  });
});
