const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const frontend = path.resolve('apps/knowledge-center-web/frontend/knowledge-center');
const source = fs.readFileSync(path.join(frontend, 'common/dismissible-menu.js'), 'utf8');
const evidence = path.resolve('runtime/test-results/dismissible-menu');

// Check every currently identified transient disclosure, rather than all details.
test('临时菜单显式接入公共契约', () => {
  for (const [file, pattern] of [
    ['modules/production/handbook-view.js', /<details class="handbook-more-menu"[^>]*data-dismissible-menu/],
    ['modules/production/handbook-view.js', /<details class="handbook-editor-format"[^>]*data-dismissible-menu/],
    ['modules/assets/view.js', /<details class="asset-more-menu"[^>]*data-dismissible-menu/],
    ['modules/outlines/view.js', /<details class="outline-more-actions"[^>]*data-dismissible-menu/],
    ['modules/outlines/view.js', /<details class="outline-import"[^>]*data-dismissible-menu/],
    ['modules/platform-admin/view.js', /<details data-dismissible-menu>/],
  ]) assert.match(fs.readFileSync(path.join(frontend, file), 'utf8'), pattern, file);
});

test('浏览器：外部点击、内部控件、Escape 层级、动态挂载及清理', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ hasTouch: true });
    await page.route('http://menu.test/**', route => route.fulfill({
      contentType: 'text/html', body: '<button id="outside">空白区域</button><details id="persistent" open><summary>目录</summary>常驻内容</details><div id="mount"></div>',
    }));
    await page.goto('http://menu.test/');
    await page.addScriptTag({ type: 'module', content: source + '\nwindow.initMenus = initDismissibleMenus; window.menuRuntime = initDismissibleMenus();' });
    await page.waitForFunction(() => !!window.menuRuntime);
    await page.evaluate(() => {
      window.mountMenus = () => { document.querySelector('#mount').innerHTML = ['one', 'two'].map(id => `<details id="${id}" data-dismissible-menu><summary>${id}</summary><input aria-label="${id}输入"><button type="button">内部操作</button></details>`).join(''); };
      window.mountMenus();
      window.parentEscapes = 0;
      document.addEventListener('keydown', e => { if (e.key === 'Escape') window.parentEscapes++; });
      document.querySelector('#outside').addEventListener('pointerdown', e => e.stopPropagation());
      document.querySelector('#outside').addEventListener('click', e => e.stopPropagation());
    });
    const isOpen = id => page.locator(`#${id}`).evaluate(el => el.open);
    await page.locator('#one summary').click();
    await page.locator('#one input').fill('内部输入不丢失');
    await page.locator('#one button').click();
    assert.equal(await isOpen('one'), true);
    await page.locator('#outside').click();
    assert.equal(await isOpen('one'), false);
    assert.equal(await isOpen('persistent'), true);
    await page.locator('#one summary').click();
    await page.keyboard.press('Escape');
    assert.equal(await isOpen('one'), false);
    assert.equal(await page.locator('#one summary').evaluate(el => el === document.activeElement), true);
    assert.equal(await page.evaluate(() => window.parentEscapes), 0);
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => window.parentEscapes), 1);
    await page.locator('#one summary').click();
    await page.locator('#two summary').click();
    assert.equal(await isOpen('one'), false);
    assert.equal(await isOpen('two'), true);
    await page.locator('#two summary').click();
    assert.equal(await isOpen('two'), false);
    await page.evaluate(() => { window.mountMenus(); if (window.initMenus() !== window.menuRuntime) throw Error('重复初始化'); });
    await page.locator('#one summary').tap();
    await page.locator('#outside').tap();
    assert.equal(await isOpen('one'), false);
    // A native modal owns Escape while an unrelated background menu is open.
    await page.locator('#one summary').click();
    await page.evaluate(() => { const dialog = document.createElement('dialog'); dialog.innerHTML = '<button>弹窗内容</button>'; document.body.append(dialog); dialog.showModal(); });
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('dialog').evaluate(el => el.open), false);
    assert.equal(await isOpen('one'), true);
    await page.evaluate(() => window.menuRuntime.destroy());
    await page.locator('#outside').click();
    assert.equal(await isOpen('one'), true);
    await page.evaluate(() => window.menuRuntime = window.initMenus());
    await page.locator('#outside').click();
    assert.equal(await isOpen('one'), false);
  } finally { await browser.close(); }
});

const base = process.env.KPG_BASE_URL;
const handbookId = process.env.KC_PERF_HANDBOOK_ID;
const username = process.env.KNOWLEDGE_CENTER_ADMIN_USERNAME;
const password = process.env.KNOWLEDGE_CENTER_ADMIN_PASSWORD;
test('当前实例：桌面和触屏手册更多菜单只读验收', {
  skip: !base || !handbookId || !username || !password, timeout: 90000,
}, async () => {
  const browser = await chromium.launch();
  fs.mkdirSync(evidence, { recursive: true });
  const results = [];
  try {
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: true });
      const login = await context.request.post(`${base}/knowledge-center/api/auth/admin/login`, { data: { username, password } });
      assert.equal(login.status(), 200);
      const page = await context.newPage();
      const blockedWrites = [];
      await page.route('**/knowledge-center/api/**', route => {
        if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) { blockedWrites.push(route.request().method()); return route.abort(); }
        return route.continue();
      });
      await page.goto(`${base}/knowledge-center/production/handbook/${encodeURIComponent(handbookId)}`, { waitUntil: 'domcontentloaded' });
      await page.locator('.handbook-more-menu').waitFor({ state: 'visible' });
      const directoryClose = page.locator('.handbook-production-directory [data-handbook-directory-close]');
      if (await directoryClose.isVisible()) await directoryClose.click();
      const menu = page.locator('.handbook-more-menu');
      const trigger = menu.locator(':scope > summary');
      await trigger.click();
      assert.equal(await menu.evaluate(el => el.open), true);
      await menu.locator('input[type="file"]').waitFor({ state: 'attached' });
      await page.screenshot({ path: path.join(evidence, `${width}-open.png`) });
      // The document title is an outside region, without saving or changing data.
      await page.locator('[data-handbook-document-title]').first().click();
      assert.equal(await menu.evaluate(el => el.open), false);
      await trigger.click();
      await page.keyboard.press('Escape');
      assert.equal(await menu.evaluate(el => el.open), false);
      assert.equal(await trigger.evaluate(el => document.activeElement === el), true);
      if (width === 390) {
        await trigger.tap();
        await page.locator('[data-handbook-document-title]').first().tap();
        assert.equal(await menu.evaluate(el => el.open), false);
      }
      assert.deepEqual(blockedWrites, []);
      await page.screenshot({ path: path.join(evidence, `${width}-closed.png`) });
      results.push({ width, outsideDismiss: true, escapeFocus: true, blockedWrites });
      await context.close();
    }
    fs.writeFileSync(path.join(evidence, 'live-result.json'), JSON.stringify({ verifiedAt: new Date().toISOString(), base, results }, null, 2) + '\n');
  } finally { await browser.close(); }
});

test('当前实例：资产、平台导航与大纲更多操作', {
  skip: !base || !handbookId || !username || !password, timeout: 90000,
}, async () => {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const login = await context.request.post(`${base}/knowledge-center/api/auth/admin/login`, { data: { username, password } });
    assert.equal(login.status(), 200);
    const page = await context.newPage();
    const blockedWrites = [];
    await page.route('**/knowledge-center/api/**', route => {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) { blockedWrites.push(route.request().method()); return route.abort(); }
      return route.continue();
    });
    const results = [];
    for (const [route, selector, outside] of [
      ['/assets', '[data-asset-more-menu]', '.asset-page-header h2, .page-intro h2'],
      ['/platform?tab=principals', '.platform-tab-menu details', '#view-root h2'],
      [`/outlines/${encodeURIComponent(handbookId)}`, '.outline-more-actions', '.outline-detail-title h2'],
    ]) {
      await page.goto(`${base}/knowledge-center${route}`, { waitUntil: 'networkidle', timeout: 60000 });
      const menu = page.locator(selector);
      await menu.waitFor({ state: 'visible' });
      await menu.locator(':scope > summary').click();
      assert.equal(await menu.evaluate(el => el.open), true, `${route} 应展开`);
      await page.locator(outside).first().click();
      assert.equal(await menu.evaluate(el => el.open), false);
      await menu.locator(':scope > summary').click();
      await page.keyboard.press('Escape');
      assert.equal(await menu.evaluate(el => el.open), false);
      assert.equal(await menu.locator(':scope > summary').evaluate(el => el === document.activeElement), true);
      if (route.startsWith('/platform')) {
        await menu.locator(':scope > summary').click();
        await menu.locator('[data-team-group-view="groups"]').click();
        await page.waitForURL('**/platform?tab=principals&view=groups');
        await page.locator('#platform-panel-principals').waitFor({ state: 'visible' });
        assert.equal(await page.locator('.platform-tab-menu details').evaluate(el => el.open), false);
      }
      results.push({ route, outsideDismiss: true, escapeFocus: true });
    }
    assert.deepEqual(blockedWrites, []);
    fs.mkdirSync(evidence, { recursive: true });
    fs.writeFileSync(path.join(evidence, 'other-live-result.json'), JSON.stringify({ verifiedAt: new Date().toISOString(), results, blockedWrites }, null, 2) + '\n');
  } finally { await browser.close(); }
});
