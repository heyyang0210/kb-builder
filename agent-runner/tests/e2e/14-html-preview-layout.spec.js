const { test, expect, openPage, BACKEND_URL } = require('./helpers');

const htmlDocId = Buffer.from(
  'ai-cognitive:智能知识平台/L0_02_PyTorch核心架构.html'
).toString('base64url');

async function openDocument(page, docId) {
  await page.evaluate(async id => {
    switchTab('doc-mgmt');
    await viewDocument(id, false);
  }, docId);
}

async function getPreviewLayout(page) {
  return page.evaluate(() => {
    const main = document.getElementById('main-doc-mgmt');
    const frame = document.getElementById('docHtmlPreviewFrame');
    const status = document.getElementById('docSaveStatus');
    const mainRect = main.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();
    const statusRect = status.getBoundingClientRect();

    return {
      mainDisplay: getComputedStyle(main).display,
      mainHeight: mainRect.height,
      frameHeight: frameRect.height,
      frameWidth: frameRect.width,
      frameBottom: frameRect.bottom,
      statusTop: statusRect.top,
      frameHidden: frame.hidden,
      outerOverflow: getComputedStyle(document.getElementById('mainContent')).overflowY
    };
  });
}

test.describe('HTML 文档预览布局', () => {
  test('工具栏突出文档定位并提供阅读模式入口', async ({ page }) => {
    await openPage(page);
    await openDocument(page, htmlDocId);

    await expect(page.locator('#docViewerBreadcrumb')).toContainText('AI 体系认知');
    await expect(page.locator('#docViewerTitle')).toContainText('PyTorch');
    await expect(page.locator('#docViewerFormat')).toHaveText('HTML');
    await expect(page.locator('#docOpenWindowBtn')).toBeVisible();

    const popupPromise = page.waitForEvent('popup');
    await page.click('#docOpenWindowBtn');
    const popup = await popupPromise;
    expect(popup.url()).toContain('/api/document/raw/ai-cognitive/');
    await popup.close();

    const toolbar = await page.locator('.doc-viewer-toolbar').boundingBox();
    expect(toolbar.height).toBeLessThan(90);

    await page.click('#docReadingModeBtn');
    await expect(page.locator('.app')).toHaveClass(/document-reading-mode/);
    await expect(page.locator('#docReadingModeBtn')).toHaveText(/退出沉浸/);
    const immersive = await page.evaluate(() => ({
      headerHeight: document.querySelector('.header').getBoundingClientRect().height,
      tabHeight: document.querySelector('.tab-bar').getBoundingClientRect().height,
      sidebarWidth: document.getElementById('sidebar').getBoundingClientRect().width,
      mainTop: document.getElementById('mainContent').getBoundingClientRect().top
    }));
    expect(immersive.headerHeight).toBe(0);
    expect(immersive.tabHeight).toBe(0);
    expect(immersive.sidebarWidth).toBe(0);
    expect(immersive.mainTop).toBe(0);

    await page.click('#docReadingModeBtn');
    await expect(page.locator('.app')).not.toHaveClass(/document-reading-mode/);
  });

  test('窄屏工具栏换行且页面不横向溢出', async ({ page }) => {
    await page.setViewportSize({ width: 720, height: 800 });
    await openPage(page);
    await openDocument(page, htmlDocId);

    const metrics = await page.evaluate(() => {
      const toolbar = document.querySelector('.doc-viewer-toolbar').getBoundingClientRect();
      return {
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        toolbarHeight: toolbar.height,
        actionsRight: document.querySelector('.doc-viewer-actions').getBoundingClientRect().right
      };
    });
    expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth);
    expect(metrics.actionsRight).toBeLessThanOrEqual(metrics.viewportWidth);
    expect(metrics.toolbarHeight).toBeGreaterThan(68);
  });

  test('iframe 占满剩余高度并响应侧栏折叠', async ({ page }) => {
    await openPage(page);
    await openDocument(page, htmlDocId);

    const frame = page.locator('#docHtmlPreviewFrame');
    await expect(frame).toBeVisible();
    await expect(frame).toHaveAttribute('src', /\/api\/document\/raw\/ai-cognitive\//);

    const initial = await getPreviewLayout(page);
    expect(initial.mainDisplay).toBe('flex');
    expect(initial.outerOverflow).toBe('hidden');
    expect(initial.frameHeight).toBeGreaterThan(initial.mainHeight * 0.65);
    expect(Math.abs(initial.frameBottom - initial.statusTop)).toBeLessThanOrEqual(1);

    await page.click('.sidebar-toggle');
    await page.waitForTimeout(400);
    const collapsed = await getPreviewLayout(page);
    expect(collapsed.frameHeight).toBeGreaterThan(collapsed.mainHeight * 0.65);
    expect(collapsed.frameWidth).toBeGreaterThan(initial.frameWidth + 250);

    const childFrame = page.frames().find(item => item.url().includes('/api/document/raw/'));
    expect(childFrame).toBeTruthy();
    await expect(childFrame.locator('body')).toContainText('PyTorch');
  });

  test('切换到 Markdown 后清理 HTML iframe', async ({ page, request }) => {
    await openPage(page);
    await openDocument(page, htmlDocId);

    const listResponse = await request.get(`${BACKEND_URL}/api/document/list`);
    expect(listResponse.ok()).toBeTruthy();
    const listPayload = await listResponse.json();
    const markdownDoc = listPayload.data.find(doc => String(doc.ext).toLowerCase() === '.md');
    expect(markdownDoc).toBeTruthy();

    await openDocument(page, markdownDoc.id);
    await expect(page.locator('#docHtmlPreviewFrame')).toBeHidden();
    await expect(page.locator('#docHtmlPreviewFrame')).toHaveAttribute('src', 'about:blank');
    await expect(page.locator('#docPreviewContent')).toBeVisible();
  });
});
