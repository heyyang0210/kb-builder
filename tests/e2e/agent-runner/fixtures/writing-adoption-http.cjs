const assert = require('node:assert/strict');
const { createServer } = require('node:http');

async function exerciseWritingAdoptionHttp(page) {
  const original = '# 人工正文';
  const candidate = '# 已核验候选';
  const requests = [];
  let failAdopt = true;
  const job = { jobId: 'adoption-http-job', operation: 'generate', status: 'completed',
    originalMarkdown: original, candidateMarkdown: candidate, fragment: candidate, editVersion: 4,
    requirements: '保持章节结构', metadata: { provenance: [], sourceSnapshots: [] } };
  const backend = createServer(async (request, response) => {
    const chunks = []; for await (const part of request) chunks.push(part);
    const path = new URL(request.url, 'http://localhost').pathname;
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks)) : null;
    requests.push({ path, method: request.method, body });
    let data; let status = 200;
    if (path.endsWith('/production/models')) data = { options: [{ serviceId: 'local', model: 'local' }], defaultSelection: { serviceId: 'local', model: 'local' } };
    else if (path.endsWith('/api/templates')) data = [];
    else if (path.endsWith('/ai-jobs')) data = [job];
    else if (path.endsWith('/ai-jobs/adoption-http-job')) data = job;
    else if (path.endsWith('/adopt')) {
      if (failAdopt) status = 503;
      data = { draft: { branch: 'main', editVersion: 5, revision: { revisionId: 'revision-5', markdown: body.markdown } } };
    } else if (path.endsWith('/ai-skills')) data = { items: [] };
    else if (path.endsWith('/ai-sources')) data = { items: [], referenceListCollapsedCount: 0 };
    else status = 404;
    response.writeHead(status, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(status === 200 ? { success: true, data } : { success: false, error: { code: 'ISOLATED_ADOPTION_FAILURE', message: '隔离草稿服务暂不可用' } }));
  });
  await new Promise(resolve => backend.listen(0, '127.0.0.1', resolve));
  const pattern = '**/knowledge-center/api/**';
  const handler = async route => {
    const url = new URL(route.request().url());
    url.hostname = '127.0.0.1'; url.port = String(backend.address().port);
    await route.fulfill({ response: await route.fetch({ url: url.href }) });
  };
  await page.route(pattern, handler);
  try {
    await page.evaluate(async original => {
      const { appState } = await import('/knowledge-center/common/state/app-state.js');
      const previous = { activeView: appState.activeView, handbookProductionUi: appState.handbookProductionUi };
      const noticeIds = ['error-panel', 'error-title', 'error-message', 'retry', 'notice-action'];
      const notices = noticeIds.map(id => {
        const node = document.getElementById(id);
        return { node, className: node.className, hidden: node.hidden, text: node.textContent, href: node.getAttribute('href') };
      });
      const url = location.pathname + location.search + location.hash; const historyState = history.state;
      const host = document.createElement('section');
      host.dataset.coverageWritingAdoption = '';
      host.innerHTML = '<span data-handbook-current-document="adoption-document"></span><button data-handbook-ai-action="generate">生成</button><div class="handbook-production-writing"></div>';
      document.body.prepend(host);
      const ui = structuredClone(appState.handbookProductionUi);
      Object.assign(ui, { drafts: { 'adoption-document': original }, draftHtml: {},
        serverDrafts: { 'adoption-document': { draft: { editVersion: 4, revision: { revisionId: 'revision-4', markdown: original } } } },
        draftLoadState: { 'adoption-document': 'ready' }, draftSaveState: {}, draftBranchByDocument: {},
        editorFormatByDocument: { 'adoption-document': 'markdown' }, attachments: { 'adoption-document': [{ attachmentId: 'attachment-1' }] },
        dirtyDocuments: [], savedDocuments: [], repository: { branch: 'main', contentByDocument: {} } });
      appState.handbookProductionUi = ui; appState.activeView = 'dashboard';
      history.pushState({ view: 'production', handbookId: 'adoption-handbook' }, '', '/knowledge-center/production/handbook/adoption-handbook?documentId=adoption-document');
      window.__writingAdoptionCleanup = () => { host.remove(); Object.assign(appState, previous);
        for (const saved of notices) {
          saved.node.className = saved.className; saved.node.hidden = saved.hidden;
          if (saved.node.id !== 'error-panel') saved.node.textContent = saved.text;
          if (saved.href === null) saved.node.removeAttribute('href'); else saved.node.setAttribute('href', saved.href);
        }
        history.replaceState(historyState, '', url); delete window.__writingAdoptionCleanup; };
    }, '# 初始正文');
    const host = page.locator('[data-coverage-writing-adoption]');
    await host.locator('[data-handbook-ai-action]').click();
    const writing = host.locator('.handbook-writing-page');
    await writing.waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.querySelector('[data-ai-mode-rich]')?.disabled === false
      || document.querySelector('[data-ai-status]')?.textContent.includes('富文本编辑器暂不可用'));
    // Editing the real original field must update the workbench, and remain after history is opened.
    await writing.locator('[data-ai-original]').fill(original);
    await writing.locator('[data-chat-job="adoption-http-job"] .handbook-writing-chat-open').click();
    await page.waitForFunction(() => !document.querySelector('[data-ai-candidate]').hidden && !document.querySelector('[data-ai-adopt]').disabled);
    await writing.locator('[data-ai-adopt]').click();
    await page.waitForFunction(() => document.querySelector('[data-ai-status]').textContent.includes('采用未完成'));
    assert.equal(await writing.locator('[data-ai-fragment]').inputValue(), candidate);
    assert.equal(await writing.locator('[data-ai-adopt]').isEnabled(), true);
    assert.equal(await writing.locator('[data-ai-original]').inputValue(), original);
    failAdopt = false;
    await writing.locator('[data-ai-adopt]').click();
    await page.waitForFunction(() => document.getElementById('error-title').textContent === 'AI 候选已保存');
    assert.match(await page.locator('#error-message').textContent(), /候选已采用并保存/);
    assert.equal(await host.locator('.handbook-writing-page').count(), 0);
    const adopted = requests.filter(item => item.path.endsWith('/adopt'));
    assert.equal(adopted.length, 2);
    for (const request of adopted) {
      assert.equal(request.method, 'POST');
      assert.equal(request.path, '/knowledge-center/api/production/handbooks/adoption-handbook/documents/adoption-document/ai-jobs/adoption-http-job/adopt');
      assert.equal(request.body.originalMarkdown, original);
      assert.equal(request.body.markdown, candidate);
      assert.equal(request.body.editVersion, 4);
      assert.equal(request.body.branch, 'main');
      assert.deepEqual(request.body.attachmentIds, ['attachment-1']);
      assert.equal(request.body.baselineDigest, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    }
    await host.locator('[data-handbook-ai-action]').click();
    await host.locator('.handbook-writing-page').waitFor({ state: 'visible' });
    assert.equal(await host.locator('[data-ai-original]').inputValue(), candidate);
    await host.locator('[data-ai-close]').click();
    return 3;
  } catch (error) {
    console.error(JSON.stringify({ requests, ui: await page.locator('[data-coverage-writing-adoption]').innerText() }));
    throw error;
  } finally {
    await page.evaluate(() => { document.querySelector('[data-coverage-writing-adoption] [data-ai-close]')?.click(); window.__writingAdoptionCleanup?.(); });
    await page.unroute(pattern, handler);
    await new Promise(resolve => backend.close(resolve));
  }
}
module.exports = { exerciseWritingAdoptionHttp };
