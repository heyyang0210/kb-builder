// Run with PLAYWRIGHT_MODULE pointing to an installed playwright package.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  try {
    const page = await browser.newPage();
    await page.goto(process.env.KPG_BASE_URL || 'http://127.0.0.1:13510/knowledge-center/');
    const result = await page.evaluate(async () => {
      const base = '/knowledge-center/modules/review-publishing/';
      const { renderReviewPublishing } = await import(base + 'view.js');
      const { textPosition, highlightAnchor, commentPath, bodyNodes, legacyQuote } = await import(base + 'anchors.js');
      const task = { id: 'isolated', handbookId: 'test', businessVersion: '1', baselineVersionId: 'base', candidateDigest: 'digest', state: 'under_review', candidate: { digest: 'digest', operations: [] }, capabilities: { canComment: true }, reviews: [{ id: 'review', comments: [{ id: 'c', content: '检查', anchor: { path: 'one.md', documentId: 'logical', selectedText: '目标文字' } }] }] };
      document.body.innerHTML = renderReviewPublishing({ reviewProjection: { status: 'ok', items: [task], detail: { task } }, gitlabProjection: { file: { path: 'one.md', content: '# 标题\n\n普通段落目标文字。\n\n| 列 |\n|---|\n| 表格内容 |\n\n```sql\nselect 1;\n```' }, tree: [{ path: 'one.md', type: 'blob' }] }, reviewUi: {} });
      const root = document.querySelector('.repository-markdown');
      const outcomes = [];
      outcomes.push(textPosition('重复重复', { selectedText: '重复' }) === null);
      outcomes.push(textPosition('甲重复乙重复丙', { selectedText: '重复', contextBefore: '乙' })?.[0] === 4);
      for (const quote of ['目标文字', '表格内容', 'select 1;']) outcomes.push(highlightAnchor(root, { selectedText: quote }) && getSelection().toString() === quote);
      outcomes.push(!bodyNodes(root).map(n => n.textContent).join('').includes('复制'));
      outcomes.push(commentPath({ documentId: 'logical' }, { candidate: { operations: [{ documentId: 'logical', path: 'two.md' }] } }) === 'two.md');
      outcomes.push(commentPath({ documentId: 'unknown' }, {}) === '');
      outcomes.push(textPosition('变化后的内容', { selectedText: '旧内容' }) === null);
      outcomes.push(highlightAnchor(root, { selectedText: '标题\n普通段落目标文字。' }));
      outcomes.push(legacyQuote({ documentId: 'x', nodeId: 'n' }, { candidate: { operations: [{ documentId: 'x', nodeId: 'n', type: 'delete' }] } }, '')?.deleted === true);
      const legacy = legacyQuote({ lineRange: { startLine: 3 } }, {}, '# 标题\n\n普通段落目标文字。\n');
      outcomes.push(highlightAnchor(root, legacy));
      const sidebar = document.querySelector('.review-evidence-column');
      const comments = sidebar.querySelector('[data-review-comment-drawer]');
      const evidence = sidebar.querySelector('.review-evidence-drawer');
      outcomes.push(!comments.open && !evidence.open);
      outcomes.push(sidebar.getBoundingClientRect().width === 48);
      comments.open = true;
      outcomes.push(sidebar.getBoundingClientRect().width === 320);
      comments.open = false; evidence.open = true;
      outcomes.push(sidebar.getBoundingClientRect().width === 320);
      return outcomes;
    });
    assert.ok(result.every(Boolean), JSON.stringify(result));
    await page.setViewportSize({ width: 600, height: 800 });
    assert.equal(await page.locator('.review-evidence-column').evaluate(el => getComputedStyle(el).position), 'fixed');
    assert.equal(await page.locator('.review-evidence-column').evaluate(el => el.getBoundingClientRect().width), 320);
    console.log(`Browser assertions passed: ${result.length}`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
