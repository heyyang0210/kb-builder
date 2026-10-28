const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const base = process.env.KPG_BASE_URL;
const handbookId = process.env.KC_PERF_HANDBOOK_ID;
const username = process.env.KNOWLEDGE_CENTER_ADMIN_USERNAME;
const password = process.env.KNOWLEDGE_CENTER_ADMIN_PASSWORD;

// 只读验收：除登录外只调用 GET，不保存草稿或更改大纲。
test('真实手册：慢正文不阻塞目录，加载和失败不误报空草稿', {
  skip: !base || !handbookId || !username || !password,
  timeout: 60000,
}, async () => {
  const browser = await chromium.launch();
  const evidence = path.resolve('runtime/test-results/handbook-loading');
  fs.mkdirSync(evidence, { recursive: true });
  try {
    for (const scenario of [
      { name: 'desktop', width: 1440, failed: false },
      { name: 'mobile', width: 390, failed: false },
      { name: 'failed', width: 1440, failed: true },
    ]) {
      const context = await browser.newContext({ viewport: { width: scenario.width, height: 900 } });
      const login = await context.request.post(`${base}/knowledge-center/api/auth/admin/login`, { data: { username, password } });
      assert.equal(login.ok(), true, `登录 HTTP ${login.status()}`);
      const page = await context.newPage();
      let release;
      const held = new Promise(resolve => { release = resolve; });
      await page.route('**/documents/*/draft?*', async route => {
        await held;
        if (scenario.failed) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, error: { code: 'TEST_UNAVAILABLE', message: '模拟读取失败' } }) });
        return route.continue();
      });
      try {
        await page.goto(`${base}/knowledge-center/production`, { waitUntil: 'networkidle' });
        const entry = page.locator(`[data-handbook-href="/knowledge-center/production/handbook/${handbookId}"]`);
        await entry.click();
        await page.locator('.handbook-production-directory[aria-hidden="false"]').waitFor({ state: 'visible' });
        const directory = page.locator('.handbook-production-directory');
        assert.ok(await directory.locator('[data-handbook-document]').count() || await directory.locator('li').count());
        await page.waitForFunction(() => Math.abs(document.querySelector('.handbook-production-directory').getBoundingClientRect().left) < 1);
        await page.screenshot({ path: path.join(evidence, `${scenario.name}-directory.png`) });
        await directory.locator('[data-handbook-directory-close]').click();
        await page.locator('.handbook-document-skeleton').waitFor({ state: 'visible' });
        assert.equal(await page.locator('.handbook-review-tray').count(), 0);
        assert.equal(await page.locator('[data-handbook-save-status]').count(), 0);
        const text = await page.locator('#view-root').innerText();
        assert.equal(text.includes('尚未形成共享草稿'), false);
        assert.equal(text.includes('正在读取当前文档'), false);
        await page.locator('[data-handbook-directory-open]').click();
        await page.locator('.handbook-production-directory[aria-hidden="false"]').waitFor({ state: 'visible' });
        await directory.locator('[data-handbook-directory-close]').click();
        await page.waitForFunction(() => getComputedStyle(document.querySelector('.handbook-production-directory')).visibility === 'hidden');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await page.screenshot({ path: path.join(evidence, `${scenario.name}-loading.png`) });
        release();
        if (scenario.failed) {
          await page.getByRole('alert').filter({ hasText: '当前文档读取失败' }).waitFor();
          assert.equal(await page.locator('.handbook-review-tray').count(), 0);
          assert.equal(await page.locator('[data-handbook-save-status]').count(), 0);
          await page.locator('[data-handbook-directory-open]').click();
          await page.locator('.handbook-production-directory[aria-hidden="false"]').waitFor({ state: 'visible' });
        } else {
          await page.locator('[data-handbook-save-status]').waitFor();
          assert.equal(await page.locator('.handbook-document-skeleton').count(), 0);
        }
      } finally {
        release();
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
});
