const assert = require('node:assert/strict');
const { createServer } = require('node:http');

// Keep the browser's fetch and the product's document click handler intact.
// Only this fixture handbook is routed to the isolated HTTP backend.
async function exerciseHandbookReviewSelection(page) {
  let scenario = 'missing';
  const requests = [];
  const backend = createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    requests.push({ scenario, method: request.method, path: url.pathname, query: Object.fromEntries(url.searchParams) });
    response.setHeader('Content-Type', 'application/json');
    if (request.method !== 'GET') {
      response.writeHead(405).end(JSON.stringify({ success: false, error: { message: '夹具禁止写入' } }));
      return;
    }
    let data;
    if (url.pathname.endsWith('/draft')) {
      data = { exists: scenario !== 'missing', capabilities: { canEdit: true, canSubmitReview: scenario !== 'forbidden' },
        draft: { branch: 'review-branch', editVersion: 7, revision: { markdown: '# 已保存正文', htmlSnapshot: '<h1>已保存正文</h1>' } } };
    } else if (url.pathname.endsWith('/reviewers')) {
      if (scenario === 'unavailable') {
        response.writeHead(503).end(JSON.stringify({ success: false, error: { message: '隔离审核人服务不可用' } }));
        return;
      }
      data = { items: scenario === 'empty' ? [] : [
        { id: 'author', displayName: '当前作者', disabled: true },
        { id: 'reviewer', displayName: '审核人 <安全>', disabled: false },
      ] };
    } else {
      response.writeHead(404).end(JSON.stringify({ success: false, error: { message: '未声明的夹具请求' } }));
      return;
    }
    response.end(JSON.stringify({ success: true, data }));
  });
  await new Promise(resolve => backend.listen(0, '127.0.0.1', resolve));
  const pattern = '**/knowledge-center/api/production/handbooks/coverage-review-selection/**';
  const handler = async route => {
    const url = new URL(route.request().url());
    url.hostname = '127.0.0.1';
    url.port = String(backend.address().port);
    const response = await route.fetch({ url: url.href });
    await route.fulfill({ response });
  };
  await page.route(pattern, handler);
  try {
    for (scenario of ['unselected', 'missing', 'forbidden', 'ready', 'empty', 'unavailable']) {
      const before = requests.length;
      await page.evaluate(async scenario => {
        const { appState } = await import('/knowledge-center/common/state/app-state.js');
        const previous = { ui: appState.handbookProductionUi, url: location.href, state: history.state, focus: document.activeElement };
        const host = document.createElement('section');
        host.innerHTML = `<span data-handbook-current-document="review-doc"></span>
          <details class="handbook-more-menu"><summary>更多</summary></details>
          <label><input data-handbook-review-document value="review-doc"><strong>安装 &lt;说明&gt;</strong></label>
          <dialog data-handbook-review-selection-dialog><button data-handbook-review-submit>继续送审</button>
            <p data-handbook-review-selection-status></p></dialog>
          <dialog data-handbook-review-dialog><p data-handbook-review-count></p><p data-handbook-review-dialog-status></p>
            <select data-handbook-reviewer></select><section data-handbook-review-overrides></section>
            <button data-handbook-review-close>关闭送审</button></dialog>`;
        document.body.prepend(host);
        const find = selector => host.querySelector(selector);
        const check = (condition, message) => { if (!condition) throw new Error(`${scenario}: ${message}`); };
        const until = async (predicate, message) => {
          for (let i = 0; i < 300 && !predicate(); i++) await new Promise(resolve => setTimeout(resolve, 10));
          check(predicate(), message);
        };
        const ui = { ...previous.ui, drafts: {}, draftHtml: {}, draftBranchByDocument: {}, serverDrafts: {},
          draftLoadState: {}, draftSaveState: {}, draftContextByDocument: {}, dirtyDocuments: [], savedDocuments: [],
          selectedForReview: scenario === 'unselected' ? [] : ['review-doc'],
          repository: { branch: 'review-branch', filesByDocument: { 'review-doc': { path: 'docs/安装<说明>.md' } } } };
        try {
          appState.handbookProductionUi = ui;
          history.replaceState(history.state, '', '/knowledge-center/production/handbook/coverage-review-selection?documentId=review-doc');
          find('[data-handbook-review-selection-dialog]').showModal();
          const submit = find('[data-handbook-review-submit]');
          submit.click();
          if (scenario === 'unselected') {
            await new Promise(resolve => setTimeout(resolve, 30));
            check(!submit.disabled && !find('[data-handbook-review-dialog]').open, '空选择不应打开确认框');
            return;
          }
          if (['missing', 'forbidden'].includes(scenario)) {
            await until(() => find('[data-handbook-review-selection-status]').textContent.includes('部分草稿'), '草稿拒绝未反馈');
            check(!submit.disabled && find('[data-handbook-review-selection-dialog]').open && !find('[data-handbook-review-dialog]').open,
              '草稿拒绝未恢复选择框和按钮');
            return;
          }
          await until(() => /目标分支|没有可用审核人|审核人读取失败/.test(find('[data-handbook-review-dialog-status]').textContent), '审核人确认未完成');
          check(find('[data-handbook-review-dialog]').open && !find('[data-handbook-review-selection-dialog]').open, '确认框切换失败');
          check(find('[data-handbook-review-count]').textContent === '已选择 1 篇文档', '送审计数错误');
          if (scenario === 'unavailable') {
            check(find('[data-handbook-review-dialog-status]').textContent.includes('隔离审核人服务不可用'), '服务错误未显示');
          } else {
            const options = [...find('[data-handbook-reviewer]').options];
            check(options.length === (scenario === 'empty' ? 1 : 3), '审核人选项数量错误');
            check(find('[data-handbook-review-path]').value === 'docs/安装<说明>.md', '仓库路径未安全回填');
            check(find('legend').textContent === '安装 <说明> · 已保存 v7', '标题或已保存版本错误');
            check(!host.querySelector('说明'), '审核人或标题被当作 HTML');
            if (scenario === 'ready') {
              check(options[1].disabled && options[1].textContent.includes('当前提交者') && options[2].textContent === '审核人 <安全>', '审核人权限或转义错误');
              check(find('[data-handbook-review-override]').options.length === 3, '逐篇审核人缺失');
              check(find('[data-handbook-review-dialog-status]').textContent.includes('review-branch'), '目标分支缺失');
            } else check(find('[data-handbook-review-dialog-status]').textContent.includes('没有可用审核人'), '空审核人提示缺失');
          }
          find('[data-handbook-review-close]').click();
          await until(() => !find('[data-handbook-review-dialog]').open && document.activeElement === find('summary'), '关闭未恢复焦点');
        } finally {
          for (const dialog of host.querySelectorAll('dialog')) dialog.close();
          appState.handbookProductionUi = previous.ui;
          history.replaceState(previous.state, '', previous.url);
          host.remove();
          previous.focus?.focus();
        }
      }, scenario);
      const observed = requests.slice(before);
      assert.deepEqual(observed.map(item => item.method), Array(scenario === 'unselected' ? 0 : ['missing', 'forbidden'].includes(scenario) ? 1 : 2).fill('GET'));
      if (observed.length) {
        assert.match(observed[0].path, /\/documents\/review-doc\/draft$/);
        assert.equal(observed[0].query.branch, 'review-branch');
        assert.ok(observed[0].query.outlineVersionId);
        if (observed.length === 2) assert.match(observed[1].path, /\/reviewers$/);
      }
    }
    return 6;
  } finally {
    await page.unroute(pattern, handler);
    await new Promise(resolve => backend.close(resolve));
  }
}

module.exports = { exerciseHandbookReviewSelection };
