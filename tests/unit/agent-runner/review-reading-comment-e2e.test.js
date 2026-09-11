/**
 * 审核与发布“阅读文档提出意见”真实 HTTP 门禁。
 *
 * 该用例不绕过 service，使用与生产相同的 incremental-build handler，
 * 验证阅读页提交的 document_span 锚点、候选冲突和权限边界。
 */
const http = require('http');
const { IncrementalBuildService, MemoryIncrementalBuildRepository, createIncrementalBuildHandler } = require('../../../packages/agent-runner-core/lib/incremental-build-service');

const editor = { user: { id: 'reader-editor', displayName: '阅读作者' }, allowedActions: ['knowledge:read', 'knowledge:write'] };
const contributor = { user: { id: 'reader-contributor', displayName: '协作编辑者' }, allowedActions: ['knowledge:read', 'knowledge:write'] };
const reviewer = { user: { id: 'reader-reviewer', displayName: '审核成员' }, allowedActions: ['knowledge:read', 'knowledge:write', 'review:manage', 'publish:manage'] };
const readOnly = { user: { id: 'reader-only', displayName: '只读成员' }, allowedActions: ['knowledge:read'] };

function initialState() {
  return { schemaVersion: 1, tasks: [], publishedVersions: [{ id: 'reader-baseline', handbookId: 'DB-001', businessVersion: '23.4', current: true, contentDigest: 'reader-base' }], idempotency: {}, audits: [] };
}

async function startApi() {
  const repository = new MemoryIncrementalBuildRepository(initialState());
  const service = new IncrementalBuildService(repository);
  const handler = createIncrementalBuildHandler({ service });
  const server = http.createServer((req, res) => {
    const actor = req.headers['x-test-actor'];
    handler(req, res, actor === 'reviewer' ? reviewer : actor === 'readonly' ? readOnly : actor === 'contributor' ? contributor : editor);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, baseUrl: `http://127.0.0.1:${server.address().port}` };
}

async function request(baseUrl, method, path, body, key, actor = 'editor') {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-test-actor': actor, ...(key ? { 'idempotency-key': key } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json() };
}

async function seed(baseUrl) {
  const task = await request(baseUrl, 'POST', '/knowledge-center/api/incremental-tasks', { name: '阅读意见门禁', handbookId: 'DB-001', businessVersion: '23.4', baselineVersionId: 'reader-baseline' }, 'reading-create');
  const id = task.body.data.id;
  await request(baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${id}/sources`, { sourceType: 'manual', label: '阅读意见', content: '验证物理规格' }, 'reading-source');
  await request(baseUrl, 'PATCH', `/knowledge-center/api/incremental-tasks/${id}/target`, { documentIds: ['doc/产品规格/物理规格.md'], sectionIds: ['YFS'], language: 'zh-CN' }, 'reading-target');
  await request(baseUrl, 'PUT', `/knowledge-center/api/incremental-tasks/${id}/draft`, { editVersion: 0, content: '# 物理规格\n\nYFS 参数说明', operations: [{ type: 'update', documentId: 'doc/产品规格/物理规格.md', nodeId: 'YFS', beforeDigest: 'before', after: { content: 'YFS 参数说明' } }] }, 'reading-draft');
  await request(baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${id}/checks`, {}, 'reading-checks');
  const candidate = await request(baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${id}/candidate`, {}, 'reading-candidate');
  const review = await request(baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${id}/reviews`, {}, 'reading-review');
  return { id, digest: candidate.body.data.digest, reviewId: review.body.data.id };
}

describe('审核阅读页意见闭环 API 门禁', () => {
  let api;
  beforeEach(async () => { api = await startApi(); });
  afterEach(() => new Promise(resolve => api.server.close(resolve)));

  (process.env.PLAYWRIGHT_MODULE ? test : test.skip)('浏览器选区提交、侧栏跨文档定位、刷新与处理页回读真实 API', async () => {
    const seeded = await seed(api.baseUrl);
    const { chromium } = require(process.env.PLAYWRIGHT_MODULE);
    const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      const failures = []; page.on('pageerror', error => failures.push(error.message));
      const path = 'doc/产品规格/物理规格.md';
      const secondPath = 'doc/另一文档.md';
      await page.route('**/knowledge-center/api/**', async route => {
        const req = route.request(), url = new URL(req.url());
        if (url.pathname.includes('/incremental-tasks')) {
          const response = await fetch(api.baseUrl + url.pathname + url.search, { method: req.method(), headers: { ...req.headers(), 'x-test-actor': 'editor' }, ...(req.postData() ? { body: req.postData() } : {}) });
          return route.fulfill({ status: response.status, contentType: 'application/json', body: await response.text() });
        }
        let data = {};
        if (url.pathname.endsWith('/auth/session')) data = { authenticated: true, visibleModules: ['*'], user: { displayName: '隔离测试' }, allowedActions: ['knowledge:read', 'knowledge:write'] };
        else if (url.pathname.endsWith('/access-status')) data = { canRead: true, connected: true };
        else if (url.pathname.endsWith('/branches')) data = { defaultBranch: 'master', branches: [{ name: 'master' }] };
        else if (url.pathname.endsWith('/tree')) data = [{ path, type: 'blob' }, { path: secondPath, type: 'blob' }];
        else if (url.pathname.endsWith('/file')) data = { path: url.searchParams.get('path'), content: '# 标题\n\n普通段落中的目标文字。\n\n第二段说明。', commitId: 'isolated-source' };
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
      });
      const base = process.env.KPG_BASE_URL || 'http://127.0.0.1:13510';
      await page.goto(`${base}/knowledge-center/review?taskId=${seeded.id}&handbookId=DB-001&step=read&path=${encodeURIComponent(path)}`);
      await page.locator('.review-document-content .repository-markdown p').first().waitFor();
      const comments = page.locator('[data-review-comment-drawer]');
      const evidence = page.locator('.review-evidence-drawer');
      expect(await comments.getAttribute('open')).toBeNull();
      await comments.locator('summary').click();
      expect(await comments.getAttribute('open')).not.toBeNull();
      await evidence.locator('summary').click();
      expect(await comments.getAttribute('open')).toBeNull();
      expect(await evidence.getAttribute('open')).not.toBeNull();
      await evidence.locator('summary').click();
      await page.evaluate(() => {
        const node = document.querySelector('.repository-markdown p').firstChild;
        const range = document.createRange(); const at = node.textContent.indexOf('目标文字');
        range.setStart(node, at); range.setEnd(node, at + 4);
        getSelection().removeAllRanges(); getSelection().addRange(range);
        node.parentElement.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      });
      await page.locator('[data-review-bubble-trigger]').click();
      await page.locator('[data-review-inline-form] textarea').fill('真实 API 原文定位回归');
      await page.locator('[data-review-inline-form] button[type=submit]').click();
      await page.waitForFunction(() => !document.querySelector('[data-review-inline-form]'));
      await page.locator('.repository-markdown').waitFor();
      const listed = await request(api.baseUrl, 'GET', `/knowledge-center/api/incremental-tasks/${seeded.id}/reviews/${seeded.reviewId}/comments`);
      expect(listed.body.data[0]).toMatchObject({ mode: 'anchored', anchor: { path, textScope: 'rendered_body', selectedText: '目标文字' } });
      const id = listed.body.data[0].id;
      await page.locator(`[data-review-document="${secondPath}"]`).click();
      await comments.locator('summary').click();
      await page.locator(`[data-review-drawer-comment="${id}"]`).click();
      await page.waitForFunction(() => document.querySelector('[data-review-location-status]')?.textContent.includes('已定位'));
      expect(new URL(page.url()).searchParams.get('path')).toBe(path);
      expect(await page.evaluate(() => getSelection().toString())).toBe('目标文字');
      expect(await comments.getAttribute('open')).not.toBeNull();
      await page.reload();
      await page.waitForFunction(() => document.querySelector('[data-review-location-status]')?.textContent.includes('已定位'));
      await page.locator('[data-review-step="opinions"]').click();
      await page.locator(`[data-review-comment-locate="${id}"]`).click();
      await page.waitForFunction(() => document.querySelector('[data-review-location-status]')?.textContent.includes('已定位'));
      expect(new URL(page.url()).searchParams.get('step')).toBe('read');
      await page.goBack();
      await page.locator('.review-opinions-panel').waitFor();
      await page.goForward();
      await page.waitForFunction(() => document.querySelector('[data-review-location-status]')?.textContent.includes('已定位'));
      if (await comments.getAttribute('open') === null) await comments.locator('summary').click();
      await page.locator('[aria-label="关闭意见侧栏"]').click();
      expect(await comments.getAttribute('open')).toBeNull();
      expect(failures).toEqual([]);
    } finally { await browser.close(); }
  }, 60000);

  test('阅读页 document_span 意见保留精确定位并出现在同一审核线程', async () => {
    const seeded = await seed(api.baseUrl);
    const result = await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${seeded.id}/reviews/${seeded.reviewId}/comments`, {
      comment: '请核对 YFS 与 23.4 版本依赖', candidateDigest: seeded.digest,
      anchor: {
        documentId: 'doc/产品规格/物理规格.md', nodeId: 'YFS', anchorKind: 'document_span',
        lineRange: { startLine: 3, endLine: 3 }, charRange: { startChar: 0, endChar: 12 },
        selectedText: 'YFS 参数说明', contextBefore: '# 物理规格', contextAfter: '',
      },
    }, 'reading-comment');
    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);
    expect(result.body.data).toMatchObject({ commentType: 'suggestion', severity: 'normal', mode: 'anchored', anchorStatus: 'valid', candidateDigest: seeded.digest, anchor: { anchorKind: 'document_span', nodeId: 'YFS', selectedText: 'YFS 参数说明' } });
    const listed = await request(api.baseUrl, 'GET', `/knowledge-center/api/incremental-tasks/${seeded.id}/reviews/${seeded.reviewId}/comments`, undefined, undefined, 'reviewer');
    expect(listed.body.data).toHaveLength(1);
  });

  test('候选摘要冲突拒绝意见且不会落库，调用方可保留原输入后重试', async () => {
    const seeded = await seed(api.baseUrl);
    const result = await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${seeded.id}/reviews/${seeded.reviewId}/comments`, { comment: '待重试意见', candidateDigest: 'stale-digest', anchor: { documentId: 'doc/产品规格/物理规格.md', nodeId: 'YFS', anchorKind: 'document_span' } }, 'reading-conflict');
    expect(result.status).toBe(409);
    expect(result.body.error.code).toBe('REVIEW_CANDIDATE_CONFLICT');
    const listed = await request(api.baseUrl, 'GET', `/knowledge-center/api/incremental-tasks/${seeded.id}/reviews/${seeded.reviewId}/comments`, undefined, undefined, 'reviewer');
    expect(listed.status).toBe(200);
    expect(listed.body.data).toHaveLength(0);
  });

  test('只读阅读角色不能提交意见', async () => {
    const seeded = await seed(api.baseUrl);
    const result = await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${seeded.id}/reviews/${seeded.reviewId}/comments`, { comment: '越权意见', candidateDigest: seeded.digest }, 'reading-forbidden', 'readonly');
    expect(result.status).toBe(403);
    expect(result.body.error.code).toBe('ACTION_FORBIDDEN');
  });

  test('知识编辑者可读取审核中候选并提出意见，但不能编辑候选', async () => {
    const seeded = await seed(api.baseUrl);
    const readable = await request(api.baseUrl, 'GET', `/knowledge-center/api/incremental-tasks/${seeded.id}`, undefined, undefined, 'contributor');
    expect(readable).toMatchObject({ status: 200, body: { data: { capabilities: { canComment: true, canEdit: false, canReview: false, canPublish: false } } } });
    const comment = await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${seeded.id}/reviews/${seeded.reviewId}/comments`, { comment: '编辑者提出的普通意见', severity: 'normal', candidateDigest: seeded.digest }, 'contributor-comment', 'contributor');
    expect(comment).toMatchObject({ status: 200, body: { data: { severity: 'normal' } } });
    const update = await request(api.baseUrl, 'PUT', `/knowledge-center/api/incremental-tasks/${seeded.id}/draft`, { editVersion: 0, content: '越权修改', operations: [] }, 'contributor-edit', 'contributor');
    expect(update.status).toBe(404);
  });

  test('具备审核能力的账号可作出审核决定，权限由服务端能力控制', async () => {
    const seeded = await seed(api.baseUrl);
    const result = await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${seeded.id}/reviews/${seeded.reviewId}/decision`, { decision: 'approve', comment: '本人复核通过' }, 'reading-self-review', 'reviewer');
    expect(result.status).toBe(200);
    expect(result.body.data.status).toBe('approved');
  });
});
