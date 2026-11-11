const assert = require('node:assert/strict');
const { createServer } = require('node:http');

async function exerciseHandbookDraftInput(page) {
  const requests = [];
  const backend = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const fileName = decodeURIComponent(request.headers['x-file-name'] || '');
    requests.push({ method: request.method, url: request.url, fileName, type: request.headers['content-type'], body: Buffer.concat(chunks).toString() });
    response.setHeader('Content-Type', 'application/json');
    if (request.method !== 'POST' || !new URL(request.url, 'http://localhost').pathname.endsWith('/documents/input-doc/draft-attachments')) {
      response.writeHead(405).end(JSON.stringify({ success: false, error: { message: '未声明请求' } }));
    } else if (fileName === '失败.txt') {
      response.writeHead(503).end(JSON.stringify({ success: false, error: { message: '隔离附件存储不可用' } }));
    } else {
      response.end(JSON.stringify({ success: true, data: { id: `attachment-${requests.length}`, kind: request.headers['content-type'] === 'image/png' ? 'image' : 'file', stableReference: `attachment://${requests.length}` } }));
    }
  });
  await new Promise(resolve => backend.listen(0, '127.0.0.1', resolve));
  const pattern = '**/knowledge-center/api/production/handbooks/coverage-draft-input/**';
  const handler = async route => {
    const url = new URL(route.request().url());
    url.hostname = '127.0.0.1'; url.port = String(backend.address().port);
    await route.fulfill({ response: await route.fetch({ url: url.href }) });
  };
  await page.route(pattern, handler);
  try {
    await page.evaluate(async () => {
      const { appState } = await import('/knowledge-center/common/state/app-state.js');
      const previous = { ui: appState.handbookProductionUi, url: location.href, state: history.state };
      const host = document.createElement('section');
      host.innerHTML = `<section data-handbook-current-document="input-doc"><textarea data-handbook-markdown-editor data-document-id="input-doc"></textarea>
        <button data-handbook-draft-save disabled>保存</button><button data-handbook-discard disabled>丢弃</button>
        <button data-handbook-review-current="input-doc"><span data-handbook-review-label></span></button>
        <span data-handbook-review-hint></span><span data-handbook-save-status>已保存</span></section>
        <textarea data-handbook-markdown-editor></textarea>
        <input type="file" data-handbook-attachment multiple><p data-handbook-attachment-progress></p>`;
      document.body.prepend(host);
      const find = selector => host.querySelector(selector);
      const check = (condition, message) => { if (!condition) throw new Error(message); };
      const until = async (predicate, message) => {
        for (let i = 0; i < 300 && !predicate(); i++) await new Promise(resolve => setTimeout(resolve, 10));
        check(predicate(), message);
      };
      const ui = { ...previous.ui, drafts: {}, draftHtml: { 'input-doc': '<p>旧HTML</p>' }, draftBranchByDocument: {},
        serverDrafts: { 'input-doc': { exists: true, capabilities: { canEdit: true, canSubmitReview: true } } },
        draftLoadState: { 'input-doc': 'ready' }, draftSaveState: {}, dirtyDocuments: [], selectedForReview: ['input-doc'],
        attachments: {}, repository: { branch: 'draft-branch' } };
      try {
        appState.handbookProductionUi = ui;
        history.replaceState(history.state, '', '/knowledge-center/production/handbook/coverage-draft-input?documentId=input-doc');
        const input = find('[data-document-id]');
        for (const markdown of ['# 第一次输入', '# 再次输入\n\n中文正文']) {
          input.value = markdown; input.dispatchEvent(new Event('input', { bubbles: true }));
          check(ui.drafts['input-doc'] === markdown && ui.draftHtml['input-doc'] === '' && ui.draftBranchByDocument['input-doc'] === 'draft-branch', 'Markdown输入未同步草稿和分支');
          check(JSON.stringify(ui.dirtyDocuments) === '["input-doc"]' && ui.selectedForReview.length === 0, '输入未清除送审或重复添加dirty');
          check(!find('[data-handbook-draft-save]').disabled && !find('[data-handbook-discard]').disabled
            && find('[data-handbook-review-label]').textContent === '保存并提交审核'
            && find('[data-handbook-save-status]').textContent === '有未保存修改', '草稿控件未同步');
        }
        const before = JSON.stringify(ui);
        find('textarea:not([data-document-id])').dispatchEvent(new Event('input', { bubbles: true }));
        check(JSON.stringify(ui) === before, '无文档ID输入污染草稿');
        const fileInput = find('[data-handbook-attachment]');
        const upload = async (files, expected) => {
          const transfer = new DataTransfer();
          for (const [name, type, body] of files) transfer.items.add(new File([body], name, { type }));
          fileInput.files = transfer.files;
          fileInput.dispatchEvent(new Event('change', { bubbles: true }));
          await until(() => find('[data-handbook-attachment-progress]').textContent.includes(expected) && fileInput.value === '', '附件上传状态或输入清理错误');
        };
        await upload([['图片.png', 'image/png', 'png-fixture']], '图片.png 已上传');
        check(ui.attachments['input-doc'].length === 1 && ui.attachments['input-doc'][0].kind === 'image', '图片未加入草稿附件');
        await upload([['说明.txt', 'text/plain', '中文附件正文']], '说明.txt 已上传');
        check(ui.attachments['input-doc'].length === 2 && ui.attachments['input-doc'][1].kind === 'file', '普通附件未追加');
        await upload([['失败.txt', 'text/plain', 'failure']], '失败.txt 上传失败：隔离附件存储不可用');
        check(ui.attachments['input-doc'].length === 2, '失败附件不应加入草稿');
        await upload([['失败.txt', 'text/plain', 'failure'], ['恢复.txt', '', 'recovered']], '恢复.txt 已上传');
        check(ui.attachments['input-doc'].length === 3, '批次失败后未继续上传下一个文件');
        const status = find('[data-handbook-attachment-progress]').textContent;
        fileInput.files = new DataTransfer().files;
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, 20));
        check(ui.attachments['input-doc'].length === 3 && find('[data-handbook-attachment-progress]').textContent === status, '空文件选择改变附件状态');
      } finally {
        appState.handbookProductionUi = previous.ui;
        history.replaceState(previous.state, '', previous.url);
        host.remove();
      }
    });
    assert.equal(requests.length, 5);
    assert.deepEqual(requests.map(item => item.fileName), ['图片.png', '说明.txt', '失败.txt', '失败.txt', '恢复.txt']);
    assert.deepEqual(requests.map(item => item.body), ['png-fixture', '中文附件正文', 'failure', 'failure', 'recovered']);
    assert.deepEqual(requests.map(item => item.type), ['image/png', 'text/plain', 'text/plain', 'text/plain', 'application/octet-stream']);
    for (const request of requests) {
      assert.equal(request.method, 'POST');
      const url = new URL(request.url, 'http://localhost');
      assert.equal(url.searchParams.get('branch'), 'draft-branch');
      assert.ok(url.searchParams.get('outlineVersionId'));
    }
    return 8; // repeated/invalid input; image/file/failure/recovery/empty uploads
  } finally {
    await page.unroute(pattern, handler);
    await new Promise(resolve => backend.close(resolve));
  }
}

module.exports = { exerciseHandbookDraftInput };
