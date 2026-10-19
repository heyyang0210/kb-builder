const { test, expect } = require('@playwright/test');
const baseUrl = process.env.KPG_BASE_URL;
const viewports = [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 390, height: 844 }];
test.beforeEach(async ({ page }) => {
  await page.goto(`${baseUrl}/knowledge-center/`);
  await page.getByText('平台管理登录').click();
  await page.getByLabel('管理员账号').fill('admin');
  await page.getByLabel('管理员密码').fill('admin');
  await page.getByRole('button', { name: '登录平台管理' }).click();
  await expect(page).toHaveURL(`${baseUrl}/knowledge-center/platform`);
});
for (const viewport of viewports) for (const legacy of [false, true]) {
  test(`${viewport.width}px ${legacy ? '旧 dvh 回退' : '原生视口'} 实际滚动与末尾焦点可达`, async ({ page }) => {
    await page.setViewportSize(viewport);
    if (legacy) await page.addInitScript(() => {
      const supports = CSS.supports.bind(CSS);
      CSS.supports = (...args) => args.join(' ').includes('dvh') ? false : supports(...args);
    });
    await page.goto(`${baseUrl}/knowledge-center/outlines`);
    await expect(page.locator('#app-shell')).toBeVisible();
    if (legacy) {
      // Remove native dynamic viewport semantics as well as detection. A modern
      // engine with a mocked capability alone is not an old-kernel simulation.
      await page.addStyleTag({ content: ':root { --kc-viewport-height: 100vh; }' });
      await expect(page.locator('html')).toHaveAttribute('data-viewport-source', 'measured');
    }
    await page.evaluate(() => {
      const fixture = document.createElement('section'); fixture.id = 'scroll-contract-fixture';
      fixture.innerHTML = '<div style="height:2600px"></div><button id="scroll-contract-end">滚动验收末尾</button>';
      // Keep the geometry fixture outside the business render root: real API
      // responses can legitimately redraw #view-root after the shell appears.
      document.querySelector('#main-shell').append(fixture);
    });
    await expect(page.locator('html')).toHaveAttribute('data-scroll-mode', viewport.width > 900 ? 'main' : 'document');
    const geometry = await page.evaluate(async () => {
      const runtime = await import('/knowledge-center/common/scroll-runtime.js');
      const owner = runtime.getScrollOwner(); owner.scrollTop = 600;
      return { moved: owner.scrollTop, height: owner.clientHeight, total: owner.scrollHeight };
    });
    expect(geometry.total).toBeGreaterThan(geometry.height);
    expect(geometry.moved).toBeGreaterThan(0);
    await page.locator('#scroll-contract-end').focus();
    await expect(page.locator('#scroll-contract-end')).toBeInViewport();
    await page.keyboard.press('Tab');
    await page.evaluate(() => document.querySelector('#scroll-contract-fixture').remove());
    await page.setViewportSize({ width: 1440, height: 700 });
    await expect(page.locator('html')).toHaveAttribute('data-scroll-mode', 'main');
    await expect.poll(() => page.locator('#main-shell').evaluate(el => el.clientHeight)).toBeLessThanOrEqual(702);
  });
}
test('八个模块使用公共契约且无未声明纵向滚动', async ({ page }) => {
  for (const route of ['', 'assets', 'outlines', 'production', 'review', 'platform', 'templates', 'cleaning']) {
    await page.goto(`${baseUrl}/knowledge-center/${route}`);
    await expect(page.locator('#app-shell')).toBeVisible();
    await expect.poll(() => page.evaluate(async () => {
      const { inspectScrollContract } = await import('/knowledge-center/common/scroll-runtime.js');
      return inspectScrollContract().issues;
    })).toEqual([]);
  }
});
test('局部区域、模态框与固定控制栏遵循公共焦点避让', async ({ page }) => {
  await page.evaluate(() => {
    const fixture = document.createElement('section'); fixture.id = 'scroll-regions-fixture';
    fixture.innerHTML = `<div data-scroll-region="panel" style="height:160px;overflow:auto"><header data-scroll-obstacle style="position:sticky;top:0;height:48px;background:white">目录控制栏</header><div style="height:900px"></div><button id="panel-end">目录末尾</button></div>
      <dialog data-scroll-region="dialog" style="height:200px;overflow:auto"><div style="height:1000px"></div><button id="dialog-end">弹窗末尾</button></dialog>
      <aside data-scroll-region="drawer" style="position:fixed;right:0;top:0;width:180px;height:200px;overflow:auto;background:white"><div style="height:1000px"></div><button id="drawer-end">抽屉末尾</button></aside>`;
    document.querySelector('#main-shell').append(fixture);
  });
  await expect.poll(() => page.locator('#scroll-regions-fixture [data-scroll-region="panel"]').evaluate(el => getComputedStyle(el).scrollPaddingTop)).toBe('64px');
  for (const semantic of ['panel', 'drawer', 'dialog']) {
    const region = page.locator(`#scroll-regions-fixture [data-scroll-region="${semantic}"]`);
    if (semantic === 'dialog') await region.evaluate(el => { el.showModal(); document.activeElement.blur(); });
    const mainTop = await page.locator('#main-shell').evaluate(el => el.scrollTop);
    expect(await region.evaluate(el => { el.scrollTop = 150; return el.scrollTop; })).toBeGreaterThan(0);
    if (semantic !== 'panel') expect(await page.locator('#main-shell').evaluate(el => el.scrollTop)).toBe(mainTop);
    await region.locator('button').focus();
    await expect(region.locator('button')).toBeInViewport();
    const visible = await region.locator('button').evaluate(el => {
      const box = el.getBoundingClientRect(), region = el.closest('[data-scroll-region]'), bounds = region.getBoundingClientRect();
      return box.top >= bounds.top + parseFloat(getComputedStyle(region).scrollPaddingTop) && box.bottom <= bounds.bottom;
    });
    expect(visible).toBe(true);
    if (semantic === 'dialog') await region.evaluate(el => el.close());
  }
});
