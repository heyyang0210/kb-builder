const assert = require('node:assert/strict');
const { createServer } = require('node:http');

// Exercise the production form handler; only the external processing service is isolated.
async function exerciseCleaningUploadHttp(page) {
  const requests = [];
  let mode = 'chunk-failure';
  const backend = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    const pathname = new URL(request.url, 'http://localhost').pathname;
    requests.push({ pathname, method: request.method, headers: request.headers, body });
    let data;
    let status = 200;
    if (pathname.endsWith('/upload-sessions')) data = { id: 'session/一', ...(mode.startsWith('default') ? {} : { chunkSize: 3 }) };
    else if (pathname.endsWith('/files')) data = { id: 'file/一' };
    else if (/\/chunks\/\d+$/.test(pathname)) {
      data = { accepted: true };
      if (mode === 'chunk-failure') status = 503;
      if (mode === 'default-empty') status = 422;
    } else if (pathname.endsWith('/complete')) data = { completed: true };
    else if (pathname.endsWith('/create-batch')) {
      data = { id: 'batch-7' };
      if (mode === 'batch-failure') status = 503;
    } else if (pathname.endsWith('/workbench/summary')) data = { counts: { active: 7, failed: 0 } };
    else if (pathname.endsWith('/material-batches')) data = { items: [{ id: 'batch-7', name: '隔离上传批次', status: 'ready' }] };
    else if (pathname.endsWith('/datasets')) data = { items: [] };
    else if (pathname.endsWith('/index/stats')) data = { total: 1 };
    else status = 404;
    response.writeHead(status, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(status === 200 ? { success: true, data }
      : { success: false, error: { code: 'UPLOAD_ISOLATED_FAILURE',
        message: mode === 'default-empty' ? '上传服务拒绝空文件范围' : '隔离上传服务不可用' } }));
  });
  await new Promise(resolve => backend.listen(0, '127.0.0.1', resolve));
  const pattern = '**/knowledge-center/api/cleaning/**';
  const handler = async route => {
    const url = new URL(route.request().url());
    url.hostname = '127.0.0.1'; url.port = String(backend.address().port);
    await route.fulfill({ response: await route.fetch({ url: url.href }) });
  };
  await page.route(pattern, handler);
  try {
    await page.evaluate(async () => {
      const { appState } = await import('/knowledge-center/common/state/app-state.js');
      const { renderCleaning } = await import('/knowledge-center/modules/cleaning/view.js');
      const previous = { activeView: appState.activeView, cleaningProjection: appState.cleaningProjection };
      const host = document.createElement('section');
      host.dataset.coverageCleaningUpload = '';
      host.innerHTML = renderCleaning({ cleaningProjection: { status: 'ok' }, cleaningCanWrite: true });
      document.body.prepend(host);
      appState.activeView = 'dashboard';
      // Retain only fixture cleanup, never expose production internals.
      window.__cleaningUploadCleanup = () => {
        host.querySelector('dialog[open]')?.close(); host.remove(); Object.assign(appState, previous);
        delete window.__cleaningUploadCleanup;
      };
    });
    const host = page.locator('[data-coverage-cleaning-upload]');
    await host.locator('[data-cleaning-upload-open]').click();
    assert.equal(await host.locator('dialog').evaluate(node => node.open), true);
    await host.locator('[data-cleaning-upload-close]').first().click();
    assert.equal(await host.locator('dialog').evaluate(node => node.open), false);
    await host.locator('[data-cleaning-upload-open]').click();
    const form = host.locator('form');
    const status = host.locator('[data-cleaning-upload-status]');
    const submit = form.locator('[type=submit]');
    await form.evaluate(node => node.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    assert.equal(await status.textContent(), '请选择要上传的文件。');
    assert.equal(requests.length, 0);

    const run = async (scenario, contents, mediaType, expected) => {
      mode = scenario; requests.length = 0;
      await page.evaluate(async () => {
        const { appState } = await import('/knowledge-center/common/state/app-state.js');
        appState.cleaningProjection = null;
      });
      await form.locator('[name=name]').fill('  隔离批次  ');
      await form.locator('[name=file]').setInputFiles({ name: '资料.txt', mimeType: mediaType, buffer: Buffer.from(contents) });
      if (!mediaType) await form.locator('[name=file]').evaluate(async input => {
        // Playwright infers text/plain from .txt; browsers can also provide an empty MIME type.
        const file = input.files[0];
        const transfer = new DataTransfer();
        transfer.items.add(new File([await file.arrayBuffer()], file.name, { type: '' }));
        input.files = transfer.files;
      });
      await submit.click();
      await page.waitForFunction(({ expected }) => {
        const root = document.querySelector('[data-coverage-cleaning-upload]');
        return root.querySelector('[data-cleaning-upload-status]').textContent === expected
          && !root.querySelector('[type=submit]').disabled;
      }, { expected });
      const session = requests.find(item => item.pathname.endsWith('/upload-sessions'));
      assert.equal(session.method, 'POST');
      assert.ok(session.headers['idempotency-key']);
      assert.equal(JSON.parse(session.body).name, '隔离批次');
      assert.equal(JSON.parse(session.body).totalBytes, Buffer.byteLength(contents));
      const added = requests.find(item => item.pathname.endsWith('/files'));
      assert.equal(added.pathname, '/knowledge-center/api/cleaning/upload-sessions/session%2F%E4%B8%80/files');
      assert.deepEqual(JSON.parse(added.body), { relativePath: '资料.txt', size: Buffer.byteLength(contents), mediaType: mediaType || 'application/octet-stream' });
    };
    await run('chunk-failure', 'abcdefg', 'text/plain', '隔离上传服务不可用');
    assert.equal(requests.filter(item => item.method !== 'GET').length, 3);
    assert.equal(await form.locator('[name=name]').inputValue(), '  隔离批次  ');
    assert.equal(await form.locator('[name=file]').evaluate(node => node.files[0].name), '资料.txt');
    await run('batch-failure', 'abcdefg', 'text/plain', '隔离上传服务不可用');
    assert.equal(requests.filter(item => item.method === 'GET').length, 0);
    await run('default-empty', '', '', '上传服务拒绝空文件范围');
    assert.equal(requests.filter(item => item.method !== 'GET').length, 3);
    assert.equal(await form.locator('[name=file]').evaluate(node => node.files[0].size), 0);

    for (const [scenario, contents, mediaType, expected, ranges] of [
      ['chunked-success', 'abcdefg', 'text/plain', '上传完成，资料批次 batch-7。', ['bytes 0-2/7', 'bytes 3-5/7', 'bytes 6-6/7']],
      ['default-success', '中文正文', '', '上传完成，资料批次 batch-7。', ['bytes 0-11/12']],
    ]) {
      await run(scenario, contents, mediaType, expected);
      const uploads = requests.filter(item => /\/chunks\/\d+$/.test(item.pathname));
      assert.deepEqual(uploads.map(item => item.headers['content-range']), ranges);
      assert.deepEqual(Buffer.concat(uploads.map(item => item.body)), Buffer.from(contents));
      uploads.forEach((item, index) => {
        assert.equal(item.method, 'PUT'); assert.equal(item.headers['content-type'], 'application/octet-stream');
        assert.ok(item.pathname.endsWith(`/files/file%2F%E4%B8%80/chunks/${index}`));
      });
      const mutations = requests.filter(item => item.method !== 'GET');
      assert.ok(mutations.at(-3).pathname.endsWith('/files/file%2F%E4%B8%80/complete'));
      assert.ok(mutations.at(-2).pathname.endsWith('/session%2F%E4%B8%80/complete'));
      assert.ok(mutations.at(-1).pathname.endsWith('/create-batch'));
      assert.ok(mutations.at(-1).headers['idempotency-key']);
      assert.deepEqual(JSON.parse(mutations.at(-1).body), { name: '隔离批次' });
      await page.waitForFunction(async () => {
        const { appState } = await import('/knowledge-center/common/state/app-state.js');
        return appState.cleaningProjection?.workbench?.counts?.active === 7;
      });
      assert.equal(requests.filter(item => item.method === 'GET').length, 4);
      assert.equal(await form.locator('[name=name]').inputValue(), '');
      assert.equal(await form.locator('[name=file]').inputValue(), '');
    }
    return 7;
  } finally {
    await page.evaluate(() => window.__cleaningUploadCleanup?.());
    await page.unroute(pattern, handler);
    await new Promise(resolve => backend.close(resolve));
  }
}

module.exports = { exerciseCleaningUploadHttp };
