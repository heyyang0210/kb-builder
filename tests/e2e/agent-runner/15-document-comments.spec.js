const { test, expect, openPage, BACKEND_URL } = require('./helpers');

async function openFirstDocument(page, request) {
  const listResponse = await request.get(`${BACKEND_URL}/api/document/list`);
  expect(listResponse.ok()).toBeTruthy();
  const listPayload = await listResponse.json();
  const documentItem = listPayload.data[0];
  expect(documentItem).toBeTruthy();
  await page.evaluate(async docId => {
    switchTab('doc-mgmt');
    await viewDocument(docId, false);
  }, documentItem.id);
  return documentItem;
}

test.describe('文档评论界面', () => {
  test('支持带引用新增和删除评论', async ({ page, request }) => {
    const comments = [];
    await page.route(/\/api\/document\/[^/]+\/comments(?:\/[^/]+)?$/, async route => {
      const method = route.request().method();
      if (method === 'GET') {
        return route.fulfill({ json: { success: true, data: comments, count: comments.length } });
      }
      if (method === 'POST') {
        const body = route.request().postDataJSON();
        const comment = {
          id: 'comment_ui_test', documentId: 'ui-test',
          content: body.content.trim(), quote: body.quote.trim(),
          createdAt: '2026-08-21T08:00:00.000Z'
        };
        comments.push(comment);
        return route.fulfill({ status: 201, json: { success: true, data: comment } });
      }
      comments.splice(0, comments.length);
      return route.fulfill({ json: { success: true, message: '评论已删除' } });
    });

    await openPage(page);
    await openFirstDocument(page, request);
    await page.click('#docCommentsBtn');
    await expect(page.locator('#docCommentsPanel')).toHaveClass(/open/);
    await expect(page.locator('#docCommentsCount')).toHaveText('0');

    await page.fill('#docCommentQuote', '需要核对的原文');
    await page.fill('#docCommentContent', '这里需要补充依据');
    await page.click('#docCommentSubmitBtn');
    await expect(page.locator('#docCommentsCount')).toHaveText('1');
    await expect(page.locator('.doc-comment-quote')).toHaveText('需要核对的原文');
    await expect(page.locator('.doc-comment-content')).toHaveText('这里需要补充依据');

    page.once('dialog', dialog => dialog.accept());
    await page.click('.doc-comment-delete');
    await expect(page.locator('#docCommentsCount')).toHaveText('0');
    await expect(page.locator('#docCommentsList')).toContainText('暂无评论');
  });

  test('窄屏评论区不产生横向溢出', async ({ page, request }) => {
    await page.setViewportSize({ width: 600, height: 800 });
    await page.route(/\/api\/document\/[^/]+\/comments$/, route =>
      route.fulfill({ json: { success: true, data: [], count: 0 } })
    );
    await openPage(page);
    await openFirstDocument(page, request);
    await page.click('#docCommentsBtn');

    const layout = await page.evaluate(() => ({
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      panelWidth: document.getElementById('docCommentsPanel').getBoundingClientRect().width
    }));
    expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.panelWidth).toBeLessThanOrEqual(layout.viewportWidth);
  });
});
