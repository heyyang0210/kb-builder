const { test, expect, openPage } = require('./helpers');

const overviewDocId = Buffer.from(
  'knowledge-center:02-概要设计/知识中心-平台-总体架构-概要设计文档.md'
).toString('base64url');

async function openOverview(page) {
  await openPage(page);
  await page.evaluate(async id => {
    switchTab('doc-mgmt');
    await viewDocument(id, false);
  }, overviewDocId);
  await expect(page.locator('#docViewerTitle')).toContainText('知识中心建设平台总体概要设计');
  await expect(page.locator('#docPreviewContent')).toBeVisible();
}

test.describe('复杂核心对象关系预览', () => {
  test('将 ER 图转为分组关系阅读器并保留其他图形渲染', async ({ page }) => {
    await openOverview(page);
    await expect(page.locator('.relationship-explorer')).toHaveCount(1);
    await expect(page.locator('.relationship-group')).toHaveCount(4);
    await expect(page.locator('.relationship-item')).toHaveCount(39);
    await expect(page.locator('.relationship-details summary')).toHaveText('查看原始 Mermaid 关系图代码');
    await expect(page.locator('#docPreviewContent svg')).toHaveCount(3);
    await expect(page.locator('#docPreviewContent')).not.toContainText('Syntax error in text');
  });

  test('窄屏关系阅读器不产生页面横向溢出', async ({ page }) => {
    await page.setViewportSize({ width: 600, height: 800 });
    await openOverview(page);
    const metrics = await page.evaluate(() => ({
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      explorerWidth: document.querySelector('.relationship-explorer').getBoundingClientRect().width,
      longestEntityWidth: Math.max(...[...document.querySelectorAll('.relationship-entity')].map(el => el.getBoundingClientRect().width))
    }));
    expect(metrics.pageWidth).toBeLessThanOrEqual(metrics.viewportWidth);
    expect(metrics.explorerWidth).toBeLessThanOrEqual(metrics.viewportWidth);
    expect(metrics.longestEntityWidth).toBeLessThan(metrics.viewportWidth);
  });
});
