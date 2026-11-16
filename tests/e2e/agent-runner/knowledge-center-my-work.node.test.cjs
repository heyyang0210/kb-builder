const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '../../..');
const frontend = path.join(root, 'apps/knowledge-center-web/frontend/knowledge-center');
const coverageCases = process.env.KC_FRONTEND_ISTANBUL_CASE_DIR;
const coverageKey = '__kc_istanbul_coverage__';
let coverageCaseNumber = 0;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const send = (res, status, value) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(value));
};

async function instrumentFrontend(page) {
  if (!coverageCases) return async () => {};
  const { createInstrumenter } = require('istanbul-lib-instrument');
  const instrumenter = createInstrumenter({ esModules: true, coverageVariable: coverageKey, compact: false });
  await page.addInitScript(key => { globalThis[key] = {}; }, coverageKey);
  await page.route('**/knowledge-center/**/*.js', async route => {
    const pathname = new URL(route.request().url()).pathname;
    const relative = pathname.replace(/^\/knowledge-center\//, '');
    const file = path.resolve(frontend, relative);
    if (!pathname.startsWith('/knowledge-center/') || !file.startsWith(frontend + path.sep) ||
        relative.split('/').includes('vendor') || !fs.existsSync(file)) return route.continue();
    const response = await route.fetch();
    if (!response.ok()) return route.fulfill({ response });
    return route.fulfill({ response, body: instrumenter.instrumentSync(await response.text(), file) });
  });
  return async () => {
    const coverage = await page.evaluate(key => globalThis[key] || {}, coverageKey);
    if (!Object.keys(coverage).length) throw new Error('我的工作浏览器页面未生成产品源码计数');
    fs.mkdirSync(coverageCases, { recursive: true });
    fs.writeFileSync(path.join(coverageCases, `my-work-${process.pid}-${++coverageCaseNumber}.json`), JSON.stringify(coverage));
  };
}

async function fixture({ outlineFails = false, outlineDelayMs = 280, mrState = 'opened', syncFails = false, responsiblePreview = false, handbookEntry = false, restrictedMerge = false, notificationActions = ['scope_decide'], longWorkItem = false, unavailableAction = false, cleaningList = false, cleaningFailsFirst = false } = {}) {
  const requests = [];
  const queries = [];
  let noticeRead = false;
  let handbookVisited = false;
  let cleaningFailuresRemaining = cleaningFailsFirst ? 1 : 0;
  const server = http.createServer(async (req, res) => {
    requests.push(req.url);
    if (req.url === '/knowledge-center/api/auth/config') return send(res, 200, { data: { casEnabled: false } });
    if (req.url === '/knowledge-center/api/auth/session') return send(res, 200, { data: { authenticated: true, user: { id: '178', principalId: '178', displayName: '测试用户' }, allowedActions: ['knowledge:read', 'knowledge:write', 'outline:create', 'template:read', ...(responsiblePreview || cleaningList ? ['platform:manage'] : [])], visibleModules: ['*'], roles: cleaningList ? ['PLATFORM_ADMIN'] : [] } });
    if (cleaningList && req.url === '/knowledge-center/api/cleaning/workbench/summary') {
      if (cleaningFailuresRemaining > 0) { cleaningFailuresRemaining -= 1; return send(res, 503, { success: false, error: { message: '资料加工服务暂时不可用' } }); }
      return send(res, 200, { success: true, data: { active: 0, failed: 0 } });
    }
    if (cleaningList && req.url.startsWith('/knowledge-center/api/cleaning/material-batches?')) {
      const url = new URL(req.url, 'http://fixture.test'); const page = Number(url.searchParams.get('page') || 1);
      const start = (page - 1) * 20; const total = 23;
      return send(res, 200, { success: true, data: { items: Array.from({ length: Math.max(0, Math.min(20, total - start)) }, (_, index) => ({ id: `batch-${start + index + 1}`, name: `资料批次${start + index + 1}`, status: start + index === 0 ? 'unknown_state' : '已完成', ...(start + index === 0 ? { updatedAt: 'not-a-date' } : {}) })), total, page, pageSize: 20 } });
    }
    if (cleaningList && /^\/knowledge-center\/api\/cleaning\/material-batches\/[^/?]+\/workbench-summary$/.test(req.url)) {
      return send(res, 200, { success: true, data: { processSummary: { state: 'running', stage: '文本解析', percent: 40, completedSteps: 2, totalSteps: 5 }, qualitySummary: { state: 'review', warnings: 1, errors: 0, pendingReview: 1 }, materialSummary: { pages: 8, attachments: 2, documents: 3, chunks: 12 }, recommendedAction: { type: 'review', label: '查看待审核文件', route: '/knowledge-center/cleaning?batchId=batch-21' }, latestActivity: { type: 'preprocess', message: '文本解析已完成，等待审核', at: '2026-11-13T03:04:00Z' } } });
    }
    if (cleaningList && /^\/knowledge-center\/api\/cleaning\/material-batches\/[^/?]+\/files(?:\?.*)?$/.test(req.url)) {
      const url = new URL(req.url, 'http://fixture.test'); const page = Number(url.searchParams.get('page') || 1);
      return send(res, 200, { success: true, data: { items: [{ id: `file-${page}`, name: `解析结果${page}.md`, state: 'completed', sizeBytes: 2048 }], page, pageSize: 20, total: 21 } });
    }
    if (cleaningList && /^\/knowledge-center\/api\/cleaning\/material-batches\/[^/?]+$/.test(req.url)) {
      return send(res, 200, { success: true, data: { id: req.url.split('/').pop(), name: '资料批次21', state: 'uploaded', source_snapshot: { estimated_pages: 8, estimated_attachments: 2 }, source: { type: 'upload', display_name: '本地上传' }, local_space_name: '安装手册', created_at: '2026-11-12T03:00:00Z', updated_at: '2026-11-13T03:04:00Z' } });
    }
    if (cleaningList && req.url.startsWith('/knowledge-center/api/cleaning/datasets?')) {
      const url = new URL(req.url, 'http://fixture.test'); const page = Number(url.searchParams.get('page') || 1);
      const start = (page - 1) * 20; const total = 45;
      return send(res, 200, { success: true, data: { items: Array.from({ length: Math.max(0, Math.min(20, total - start)) }, (_, index) => ({ id: `dataset-${start + index + 1}`, name: `知识库版本${start + index + 1}`, status: 'published', updatedAt: '2026-11-13T03:04:00Z' })), total, page, pageSize: 20 } });
    }
    if (cleaningList && /^\/knowledge-center\/api\/cleaning\/datasets\/[^/?]+$/.test(req.url)) {
      return send(res, 200, { success: true, data: { id: req.url.split('/').pop(), batch_id: 'batch-21', preprocess_task_id: 'preprocess-2', state: 'published', total_documents: 3, total_chunks: 12, quality_metrics: { coverage: 0.98 }, quality_passed: true, graph_available: true, graph_summary: { nodes: 9, edges: 11 }, created_at: '2026-11-13T03:04:00Z' } });
    }
    if (cleaningList && req.url === '/knowledge-center/api/cleaning/index/stats') return send(res, 200, { success: true, data: { total: 0, graphNodes: 0, graphEdges: 0 } });
    if (req.url.startsWith('/knowledge-center/api/incremental-tasks/notifications?')) return send(res, 200, { success: true, data: { unreadCount: noticeRead ? 0 : 1, items: req.url.includes('limit=1') ? [] : [{ id: 'notice-1', type: 'review_scope_opinion', ticketNumber: 'P-1', handbookName: 'SQL 参考手册', documentName: '备份恢复.md', roles: ['handbook_owner'], author: { displayName: '李某' }, createdAt: '2026-11-12T02:32:00Z', actions: notificationActions, commentContent: '请确认范围', url: '/knowledge-center/review?taskId=review-1&step=opinions&commentId=comment-1', readAt: noticeRead ? new Date().toISOString() : null }] } });
    if (req.url === '/knowledge-center/api/incremental-tasks/notifications/notice-1/read' && req.method === 'PUT') { noticeRead = true; return send(res, 200, { success: true, data: { id: 'notice-1', readAt: new Date().toISOString() } }); }
    if (responsiblePreview && req.url === '/knowledge-center/api/workbench/responsibles') return send(res, 200, { success: true, data: [{ id: '178', displayName: '测试用户' }, { id: '200', displayName: '其他责任人' }] });
    if (req.url === '/knowledge-center/api/workbench/my-tasks/query' && req.method === 'POST') {
      let raw = ''; for await (const chunk of req) raw += chunk;
      const query = JSON.parse(raw);
      queries.push(query);
      const delegated = query.responsibleId === '200';
      const all = delegated ? restrictedMerge
        ? [{ id: 'merge:other', queue: 'actionable', kind: 'merge', title: '合入 测试手册', context: '测试手册', source: 'GitLab 交付', status: '待合入', url: 'https://git.example.test/project/-/merge_requests/73', external: true, primaryAction: { code: 'merge_mr', label: 'MR链接', url: 'https://git.example.test/project/-/merge_requests/73', external: true, enabled: false } }]
        : [{ id: 'other:1', queue: 'actionable', kind: 'document', title: '其他责任人的文档', context: '手册', source: '任务管理', status: '待处理', url: '/knowledge-center/production' }] : [
        handbookVisited
          ? { id: 'review:1', queue: 'actionable', kind: 'review', title: '审核 数值型.md', context: 'SQL参考手册', source: '审核与发布', version: 'master', status: '待审核', url: '/knowledge-center/production/handbook/HB-RETURN?documentId=doc-return' }
          : { id: 'doc:1', queue: 'actionable', kind: 'document', title: '编写数值型.md', context: 'SQL参考手册', source: '任务管理', version: 'master', status: '待处理', url: handbookEntry ? '/knowledge-center/production/handbook/HB-RETURN?documentId=doc-return' : '/knowledge-center/production' },
        { id: 'doc:2', queue: 'actionable', kind: 'document', title: '编写字面量.md', context: 'SQL参考手册', source: '任务管理', version: 'master', status: '待处理', url: '/knowledge-center/production' },
        ...(longWorkItem ? [{ id: 'doc:long', queue: 'actionable', kind: 'document', title: '一项需要完整显示的跨版本故障恢复与运行参数配置说明文档.md', context: 'SQL参考手册', lineage: { handbookName: 'SQL参考手册中涵盖高可用容灾切换与多节点恢复策略的完整技术手册', documentName: '一项需要完整显示的跨版本故障恢复与运行参数配置说明文档.md', documentPath: 'docs/23.4.3/恢复与运行/一项需要完整显示的跨版本故障恢复与运行参数配置说明文档.md' }, version: 'release/23.4.3alpha-long-term-support', source: '任务管理', status: '待处理', ...(unavailableAction ? { primaryAction: { code: 'open', label: '进入编写' } } : { url: '/knowledge-center/production' }) }] : []),
        { id: 'delivery:1', queue: 'actionable', kind: 'merge', title: '同步交付 用户手册改版', number: 'E2E-WB-20261104-HE-YANG', source: '审核与发布', context: 'DB-054 · inc_c28a6030124973d10b4a4812 · 业务版本待校对', lineage: { handbookName: 'DB-054 · 版本待校对', documentName: 'docs/e2e-validation/workbench-heyang-20261104/工作台验收说明.md' }, status: mrState === 'closed' ? 'MR已关闭，待处理' : '待合并回读', url: '/knowledge-center/review?taskId=delivery-1', delivery: { mergeState: mrState, markdownReadback: false, resourceReadback: false }, primaryAction: { code: 'sync_delivery', label: '状态刷新', taskId: 'delivery-1', candidateDigest: 'digest-1' } },
        ...(mrState === 'opened' ? [{ id: 'merge:1', queue: 'actionable', kind: 'merge', title: '合入 用户手册改版', source: 'GitLab 交付', status: '待合入', url: 'https://git.example.test/project/-/merge_requests/73', primaryAction: { code: 'merge_mr', label: 'MR链接', url: 'https://git.example.test/project/-/merge_requests/73', external: true } }] : []),
        { id: 'wait:1', queue: 'waiting', kind: 'review', title: '工作台验收工单', number: 'WB-1', source: '任务管理', status: '等待他人审核', url: '/knowledge-center/document-tasks' },
      ];
      const matched = all.filter(item => item.queue === query.queue && (query.type === 'all' || item.kind === query.type)
        && (!query.search || `${item.number || ''} ${item.title}`.includes(query.search)));
      await wait(35);
      return send(res, 200, { success: true, data: { items: matched.slice((query.page - 1) * query.pageSize, query.page * query.pageSize), total: matched.length,
        page: query.page, pageSize: query.pageSize, facets: { all: all.length, actionable: all.filter(item => item.queue === 'actionable').length,
          waiting: all.filter(item => item.queue === 'waiting').length, types: Object.fromEntries(['document', 'merge', 'review'].map(kind => [kind, all.filter(item => item.kind === kind).length])) },
        unavailable: delegated ? ['大纲管理'] : [], completeness: delegated ? 'partial' : 'complete' } });
    }
    if (req.url === '/knowledge-center/api/incremental-tasks/delivery-1/publish' && req.method === 'POST') {
      let raw = ''; for await (const chunk of req) raw += chunk;
      if (syncFails) return send(res, 409, { success: false, error: { code: 'GITLAB_DELIVERY_READBACK_FAILED', message: '正文与审核候选不一致' } });
      return send(res, 200, { success: true, data: { completion: { status: 'pending' }, request: JSON.parse(raw) } });
    }
    if (req.url === '/knowledge-center/api/platform/context') return send(res, 200, { status: 'ok', context: { brand: { enterpriseName: '测试平台' } } });
    if (req.url === '/knowledge-center/api/platform/overview') return send(res, 200, { status: 'ok' });
    if (req.url.startsWith('/knowledge-center/api/assets/handbooks')) return send(res, 200, { data: { items: handbookEntry ? [{ id: 'HB-RETURN', handbookId: 'HB-RETURN', name: '返回验证手册', status: 'active' }] : [], total: handbookEntry ? 1 : 0 } });
    if (handbookEntry && req.url === '/knowledge-center/api/outline/catalog?handbookId=HB-RETURN&view=directory') {
      handbookVisited = true;
      return send(res, 200, { data: { items: [{ id: 'outline-return', handbookId: 'HB-RETURN', name: '返回验证手册' }],
        selectedId: 'outline-return', directory: { id: 'outline-return', handbookId: 'HB-RETURN', name: '返回验证手册', nodes: [{ id: 'doc-return', kind: 'document', title: '返回验证文档.md' }] } } });
    }
    if (handbookEntry && req.url === '/knowledge-center/api/gitlab/mappings/HB-RETURN?view=production') return send(res, 200, { data: null });
    if (handbookEntry && req.url.startsWith('/knowledge-center/api/production/handbooks/HB-RETURN/documents/doc-return/draft?')) return send(res, 200, { data: { exists: false } });
    if (handbookEntry && req.url === '/knowledge-center/api/document-tasks/context') return send(res, 200, { data: { people: [], filterOptions: { product: [], version: [] }, config: { reasonOptions: [] } } });
    if (handbookEntry && req.url.startsWith('/knowledge-center/api/document-tasks?')) return send(res, 200, { data: { items: [{ number: 'TEST-RETURN', description: '返回位置验证工单', ownerName: '测试用户', status: 'in_progress', decomposition: { handbooks: [{ documents: [{ id: 'doc-return', name: '返回验证文档.md', writingUrl: '/knowledge-center/production/handbook/HB-RETURN?documentId=doc-return' }] }] } }], total: 1 } });
    if (handbookEntry && req.url === '/knowledge-center/api/document-tasks') return send(res, 200, { data: { items: [{ number: 'TEST-RETURN', description: '返回位置验证工单', ownerName: '测试用户', status: 'in_progress', decomposition: { handbooks: [{ documents: [{ id: 'doc-return', name: '返回验证文档.md', writingUrl: '/knowledge-center/production/handbook/HB-RETURN?documentId=doc-return' }] }] } }], total: 1 } });
    if (req.url === '/fixture') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><html lang="zh-CN"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/knowledge-center/common/tokens.css"><link rel="stylesheet" href="/knowledge-center/common/base.css"><link rel="stylesheet" href="/knowledge-center/styles.css"><link rel="stylesheet" href="/knowledge-center/modules/dashboard/dashboard.css"></head><body><div id="view-root"></div></body></html>');
      return;
    }
    if (req.url === '/knowledge-center/' || req.url.startsWith('/knowledge-center/?') || req.url === '/knowledge-center/assets' || (cleaningList && (req.url === '/knowledge-center/cleaning' || req.url.startsWith('/knowledge-center/cleaning?')))
      || (handbookEntry && req.url.startsWith('/knowledge-center/production/handbook/'))) {
      if (handbookEntry && req.url.startsWith('/knowledge-center/production/handbook/')) handbookVisited = true;
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      fs.createReadStream(path.join(frontend, 'knowledge-center-management.html')).pipe(res);
      return;
    }
    if (req.url === '/knowledge-center/api/document-tasks/mine') {
      await wait(35);
      send(res, 200, { data: { items: [
        { id: 'doc:1', kind: 'document', title: '编写数值型.md', context: 'SQL参考手册', source: '任务管理', version: 'master', state: 'pending', status: '待处理', url: handbookEntry ? '/knowledge-center/production/handbook/HB-RETURN?documentId=doc-return' : '/knowledge-center/production' },
        { id: 'doc:2', kind: 'document', title: '编写字面量.md', context: 'SQL参考手册', source: '任务管理', version: 'master', state: 'pending', status: '待处理', url: '/knowledge-center/production' },
      ], following: [{ number: 'WB-1', title: '工作台验收工单', status: 'in_progress', url: '/knowledge-center/document-tasks', handbooks: [] }] } });
      return;
    }
    if (req.url === '/knowledge-center/api/review/bootstrap?view=mine') {
      await wait(160);
      send(res, 200, { data: { workbench: { mine: [], myMergeRequests: [{ taskId: 'merge-1', handbookId: 'HB-1', title: '用户手册改版', businessVersion: '23.4', documentNames: ['SQL参考手册'], mergeRequest: { iid: 73, webUrl: 'https://git.example.test/project/-/merge_requests/73', state: mrState }, deliveryObservation: { state: mrState }, updatedAt: '2026-11-05T05:00:00Z' }] } } });
      return;
    }
    if (req.url === '/knowledge-center/api/outline/build-tasks') {
      await wait(outlineDelayMs);
      send(res, outlineFails ? 503 : 200, outlineFails ? { error: { message: '大纲服务暂不可用' } } : { data: { tasks: [] } });
      return;
    }
    const relative = req.url.replace(/^\/knowledge-center\//, '');
    const file = path.resolve(frontend, relative);
    if (file.startsWith(frontend + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) {
      const mime = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
      res.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
      return;
    }
    res.writeHead(404); res.end();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, requests, queries, close: () => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }) };
}

test('工作台统一列表、跟进队列、桌面与窄屏布局', async t => {
  const service = await fixture({ outlineDelayMs: 700 });
  const browser = await chromium.launch({ headless: true });
  t.after(async () => { await browser.close(); await service.close(); });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const captureCoverage = await instrumentFrontend(page);
  const errors = [];
  page.on('pageerror', error => errors.push(error.stack || error.message));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Runtime.enable');
  cdp.on('Runtime.exceptionThrown', ({ exceptionDetails }) => errors.push(`${exceptionDetails.url || ''}:${exceptionDetails.lineNumber}:${exceptionDetails.text}`));
  await page.goto(`${service.url}/knowledge-center/`);
  await page.getByText('编写数值型', { exact: true }).waitFor({ timeout: 5000 }).catch(async error => {
    throw new Error(`${error.message}; errors=${JSON.stringify(errors)}; body=${(await page.locator('body').innerText()).slice(0, 1000)}`);
  });
  assert.equal(await page.locator('.my-task-summary, .my-task-following').count(), 0);
  assert.deepEqual(await page.locator('.my-task-board .my-task-table-head span').allInnerTexts(), ['编号', '工作项', '关联范围', '当前状态', '计划截止', '下一步', '详情']);
  assert.equal(await page.locator('.my-task-table [role="columnheader"]').count(), 7);
  assert.equal(await page.locator('.my-task-table [role="row"]').nth(1).locator('[role="cell"]').count(), 7);
  assert.equal(await page.locator('[data-my-task-kind]').count(), 5);
  assert.equal(await page.locator('[data-my-task-kind="outline"], [data-my-task-kind="template"]').count(), 0);
  assert.equal(await page.getByText('个人事项待设计').count(), 0);
  for (const selector of [
    '[data-my-task-kind="all"]', '[data-my-task-queue="actionable"]', '[data-my-task-queue="waiting"]',
    '[data-my-task-query]', '[data-filter-toggle]', '.my-task-list .my-task-go',
  ]) {
    assert.ok(await page.locator(selector).first().evaluate(node => node.getBoundingClientRect().height >= 44), `${selector} 点击区域至少为44px`);
  }
  assert.equal(await page.locator('[data-my-task-kind="all"] small').innerText(), '5');
  assert.match(await page.locator('[data-my-task-queue="waiting"]').innerText(), /^跟进中\s+\d+$/);
  await page.locator('[data-my-task-queue="waiting"]').click();
  await page.getByText('工作台验收工单').waitFor();
  assert.equal(await page.locator('.my-task-list .my-task-table-row').count(), 1);
  await page.locator('.my-task-list [data-my-task-open]').click();
  await page.locator('[data-my-task-dialog][open]').waitFor();
  await page.locator('[data-my-task-dialog] [data-my-task-close]').first().click();
  await page.locator('[data-my-task-queue="actionable"]').click();
  await page.getByText('编写数值型', { exact: true }).waitFor();
  assert.equal(await page.locator('.my-task-list a[target="_blank"]').getAttribute('href'), 'https://git.example.test/project/-/merge_requests/73');
  assert.equal(await page.locator('.my-task-list a[target="_blank"]').innerText(), 'MR链接');
  assert.equal(await page.locator('[data-my-task-sync]').innerText(), '状态刷新');
  await page.locator('[data-my-task-sync]').click();
  await page.getByText('交付状态已同步').waitFor();
  assert.equal(service.requests.includes('/knowledge-center/api/incremental-tasks/delivery-1/publish'), true);
  assert.equal(await page.locator('[data-view="dashboard"] .nav-copy b').innerText(), '工作台');
  assert.equal(service.requests.some(url => url.startsWith('/knowledge-center/api/templates')), false);
  assert.deepEqual(errors, []);
  await page.waitForFunction(() => window.__knowledgeMyTasksProjection?.status === 'ok');
  const output = path.join(root, 'runtime/test-results/workbench-optimization-20261105');
  fs.mkdirSync(output, { recursive: true });
  await page.screenshot({ path: path.join(output, 'desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  if (await page.locator('#sidebar').evaluate(node => node.classList.contains('open'))) await page.locator('#mobile-close').click();
  await page.waitForFunction(() => document.querySelector('#sidebar').getBoundingClientRect().right <= 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, '窄屏不得横向溢出');
  await page.screenshot({ path: path.join(output, 'mobile.png'), fullPage: true });
  await captureCoverage();
});

test('工作台完整显示长工作项并提供可访问的表格单元格', async t => {
  const service = await fixture({ longWorkItem: true });
  const browser = await chromium.launch({ headless: true });
  t.after(async () => { await browser.close(); await service.close(); });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${service.url}/knowledge-center/`);
  const title = '一项需要完整显示的跨版本故障恢复与运行参数配置说明文档';
  const documentPath = 'docs/23.4.3/恢复与运行/一项需要完整显示的跨版本故障恢复与运行参数配置说明文档.md';
  const scope = 'SQL参考手册中涵盖高可用容灾切换与多节点恢复策略的完整技术手册 · release/23.4.3alpha-long-term-support';
  const row = page.locator('.my-task-table-row[role="row"]').filter({ hasText: title });
  await row.waitFor();
  assert.equal((await row.locator('[role="cell"]').count()), 7);
  assert.equal(await row.locator('.status').innerText(), '待处理');
  assert.ok((await row.locator('.description').innerText()).startsWith(title));
  assert.equal(await row.locator('.my-task-document-path').innerText(), documentPath);
  assert.equal(await row.locator('.scope').innerText(), scope);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const selector of ['.description', '.scope']) {
      const layout = await row.locator(selector).evaluate(node => ({ whiteSpace: getComputedStyle(node).whiteSpace, overflows: node.scrollWidth > node.clientWidth + 1 }));
      assert.equal(layout.whiteSpace, 'normal', `${selector} 应允许完整换行`);
      assert.equal(layout.overflows, false, `${width}px 下 ${selector} 不应裁切横向内容`);
    }
  }
  await row.locator('[data-my-task-open]').click();
  assert.equal(await page.locator('.my-task-dialog').innerText().then(text => text.includes(documentPath)), true, '详情保留完整文档路径');
});

test('缺少工作入口时显示明确状态，重新读取会请求最新工作台投影', async t => {
  const service = await fixture({ longWorkItem: true, unavailableAction: true });
  const browser = await chromium.launch({ headless: true });
  t.after(async () => { await browser.close(); await service.close(); });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${service.url}/knowledge-center/`);
  const row = page.locator('.my-task-table-row[role="row"]').filter({ hasText: '一项需要完整显示' });
  await row.waitFor();
  assert.equal(await row.getByRole('status').innerText(), '操作入口暂不可用');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  const before = service.requests.filter(url => url === '/knowledge-center/api/workbench/my-tasks/query').length;
  await row.getByRole('button', { name: '重新读取' }).click();
  await page.waitForFunction((count) => performance.getEntriesByType('resource').filter(entry => entry.name.endsWith('/knowledge-center/api/workbench/my-tasks/query')).length > count, before);
  assert.ok(service.requests.filter(url => url === '/knowledge-center/api/workbench/my-tasks/query').length > before);
});

test('资料清洗批次可翻页并加载未显示的后续记录', async t => {
  const service = await fixture({ cleaningList: true });
  const browser = await chromium.launch({ headless: true });
  t.after(async () => { await browser.close(); await service.close(); });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${service.url}/knowledge-center/cleaning`);
  await page.getByText('资料批次20', { exact: true }).waitFor().catch(async error => {
    throw new Error(`${error.message}; url=${page.url()}; requests=${JSON.stringify(service.requests)}; body=${(await page.locator('body').innerText()).slice(0, 1400)}`);
  });
  assert.equal(await page.locator('[data-table-view-id="cleaning-batches"] tbody tr').count(), 20);
  assert.match(await page.locator('[data-table-view-id="cleaning-batches"] tbody tr').first().innerText(), /状态待确认/);
  assert.match(await page.locator('[data-table-view-id="cleaning-batches"] tbody tr').first().innerText(), /日期待确认/);
  const upload = page.locator('[data-cleaning-upload-open]');
  assert.ok(await upload.isVisible());
  assert.ok(await upload.evaluate(node => node.getBoundingClientRect().height >= 44));
  assert.equal(await upload.evaluate(node => Boolean(node.compareDocumentPosition(document.querySelector('.cleaning-workspace')) & Node.DOCUMENT_POSITION_FOLLOWING)), true, '上传资料主操作位于数据指标和列表之前');
  assert.equal((await page.getByRole('navigation', { name: '资料批次分页' }).innerText()).replace(/\s+/g, ' ').trim(), '第 1 / 2 页，共 23 批 上一页 下一页');
  await page.locator('[data-cleaning-page-kind="batches"][data-cleaning-page="2"]').click();
  await page.getByRole('cell', { name: '资料批次23', exact: true }).waitFor();
  assert.equal(await page.locator('[data-table-view-id="cleaning-batches"] tbody tr').count(), 3);
  assert.ok(service.requests.includes('/knowledge-center/api/cleaning/material-batches?page=2&pageSize=20'));
  assert.equal((await page.getByRole('navigation', { name: '知识库版本分页' }).innerText()).replace(/\s+/g, ' ').trim(), '第 1 / 3 页，共 45 个版本 上一页 下一页');
  await page.locator('[data-cleaning-page-kind="datasets"][data-cleaning-page="2"]').click();
  await page.getByRole('cell', { name: '知识库版本21', exact: true }).waitFor();
  assert.ok(service.requests.includes('/knowledge-center/api/cleaning/datasets?page=2&pageSize=20'));
  assert.equal(service.requests.filter(url => url === '/knowledge-center/api/cleaning/workbench/summary').length, 1, '分页仅重读目标列表，不重新加载工作台统计');
  assert.match(await page.locator('[data-table-view-id="cleaning-datasets"] tbody tr').first().innerText(), /已发布/);
  assert.match(await page.locator('[data-table-view-id="cleaning-datasets"] tbody tr').first().innerText(), /2026\/11\/13/);
});

test('资料清洗服务读取失败后可从页面重试恢复', async t => {
  const service = await fixture({ cleaningList: true, cleaningFailsFirst: true });
  const browser = await chromium.launch({ headless: true });
  t.after(async () => { await browser.close(); await service.close(); });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${service.url}/knowledge-center/cleaning`);
  await page.getByRole('heading', { name: '资料加工服务暂时不可用' }).waitFor();
  await page.getByRole('button', { name: '重新读取' }).click();
  await page.locator('[data-table-view-id="cleaning-batches"]').waitFor().catch(async error => {
    throw new Error(`${error.message}; requests=${JSON.stringify(service.requests)}; body=${(await page.locator('body').innerText()).slice(0, 1000)}`);
  });
  const firstBatch = page.locator('[data-table-view-id="cleaning-batches"] tbody tr').first();
  await firstBatch.waitFor();
  assert.match(await firstBatch.innerText(), /^资料批次1\s/);
  assert.ok(service.requests.includes('/knowledge-center/api/cleaning/workbench/summary'));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
});

test('资料清洗批次与版本从列表进入详情，并返回原分页', async t => {
  const service = await fixture({ cleaningList: true });
  const browser = await chromium.launch({ headless: true });
  t.after(async () => { await browser.close(); await service.close(); });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${service.url}/knowledge-center/cleaning`);
  await page.locator('[data-cleaning-page-kind="batches"][data-cleaning-page="2"]').click();
  const batchLink = page.getByRole('link', { name: '资料批次21' });
  await batchLink.waitFor();
  assert.match(await batchLink.getAttribute('href'), /batchId=batch-21.*batchPage=2/);
  assert.ok(await batchLink.evaluate(node => node.getBoundingClientRect().height >= 44), '390px 下批次详情入口应满足 44px 触控高度');
  await batchLink.click();
  await page.getByRole('heading', { name: '资料批次21' }).waitFor().catch(async error => {
    throw new Error(`${error.message}; url=${page.url()}; requests=${JSON.stringify(service.requests)}; body=${(await page.locator('body').innerText()).slice(0, 1600)}`);
  });
  assert.match(await page.locator('[data-cleaning-detail]').innerText(), /本地上传/);
  assert.match(await page.locator('[data-cleaning-detail]').innerText(), /文本解析已完成，等待审核/);
  assert.match(await page.locator('[data-cleaning-detail]').innerText(), /解析结果1\.md/);
  const filesNext = page.locator('[data-cleaning-files-page="2"]');
  await filesNext.click();
  await page.getByText('解析结果2.md').waitFor();
  await page.getByRole('link', { name: '返回资料清洗' }).click();
  await page.getByRole('link', { name: '资料批次21', exact: true }).waitFor({ timeout: 5000 }).catch(async error => {
    throw new Error(`${error.message}; url=${page.url()}; requests=${JSON.stringify(service.requests)}; body=${(await page.locator('body').innerText()).slice(0, 1200)}`);
  });
  assert.equal(await page.locator('[data-table-view-id="cleaning-batches"] tbody tr').count(), 3);
  assert.ok(service.requests.includes('/knowledge-center/api/cleaning/material-batches/batch-21'));
  assert.ok(service.requests.includes('/knowledge-center/api/cleaning/material-batches/batch-21/workbench-summary'));
  assert.ok(service.requests.includes('/knowledge-center/api/cleaning/material-batches/batch-21/files?page=1&pageSize=20'));
  assert.ok(service.requests.includes('/knowledge-center/api/cleaning/material-batches/batch-21/files?page=2&pageSize=20'));
  await page.goto(`${service.url}/knowledge-center/cleaning?datasetId=dataset-1`);
  await page.getByRole('heading', { name: '知识库版本 dataset-1' }).waitFor();
  assert.match(await page.locator('[data-cleaning-detail]').innerText(), /来源批次\s+batch-21/);
  assert.ok(await page.locator('.cleaning-detail-facts a').evaluate(node => node.getBoundingClientRect().height >= 44), '来源批次深链应满足 44px 触控高度');
  assert.match(await page.locator('[data-cleaning-detail]').innerText(), /文档数\s+3/);
  assert.match(await page.locator('[data-cleaning-detail]').innerText(), /9 个节点/);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
});

test('站内通知认证后异步更新未读角标，不阻塞工作台首屏', async t => {
  const service = await fixture();
  const browser = await chromium.launch({ headless: true });
  t.after(async () => { await browser.close(); await service.close(); });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  let releaseCount;
  await page.route('**/api/incremental-tasks/notifications?limit=1', async route => {
    await new Promise(resolve => { releaseCount = resolve; });
    await route.continue();
  }, { times: 1 });
  await page.goto(`${service.url}/knowledge-center/`);
  await page.getByText('编写数值型', { exact: true }).waitFor();
  const bell = page.locator('[data-global-notification-trigger]');
  assert.equal(await bell.isVisible(), true);
  assert.ok(await bell.evaluate(node => node.getBoundingClientRect().height >= 44));
  assert.equal(await page.locator('[data-my-task-refresh]').count(), 0);
  assert.equal(await page.locator('[data-global-notification-badge]').isVisible(), false, '未读取的角标不能伪装成 0');
  releaseCount();
  await page.waitForFunction(() => document.querySelector('[data-global-notification-badge]')?.textContent === '1');
  let releaseNotifications;
  await page.route('**/api/incremental-tasks/notifications?limit=20', async route => {
    await new Promise(resolve => { releaseNotifications = resolve; });
    await route.continue();
  }, { times: 1 });
  await page.locator('[data-global-notification-trigger]').click();
  await page.locator('[data-global-notification-close]').click();
  releaseNotifications();
  await page.waitForResponse(response => response.url().includes('/incremental-tasks/notifications?limit=20'));
  assert.equal(await page.locator('.global-notification-panel').isVisible(), false, '关闭后迟到的通知响应不得重新打开面板');
  await page.locator('[data-global-notification-trigger]').click();
  await page.getByText('请确认范围').waitFor();
  assert.match(await page.locator('.global-notification-panel').innerText(), /范围意见 · P-1 \/ SQL 参考手册 \/ 备份恢复\.md/);
  assert.match(await page.locator('.global-notification-panel').innerText(), /你被提及为：手册负责人/);
  assert.equal(await page.locator('.global-notification-panel a').innerText(), '处理');
  assert.equal(await page.locator('.global-notification-panel a').getAttribute('href'), '/knowledge-center/review?taskId=review-1&step=opinions&commentId=comment-1');
  for (const action of await page.locator('.global-notification-panel a, .global-notification-panel button[data-global-notification-read]').all()) {
    assert.ok(await action.evaluate(node => node.getBoundingClientRect().height >= 44), '通知操作点击目标至少为44px');
  }
  await page.locator('[data-global-notification-read]').click();
  await page.waitForFunction(() => document.querySelector('[data-global-notification-read]') === null);
  assert.equal(service.requests.includes('/knowledge-center/api/incremental-tasks/notifications/notice-1/read'), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  const menu = await page.locator('#mobile-menu').boundingBox();
  const title = await page.locator('#global-context-title').boundingBox();
  assert.ok(menu && title && menu.x + menu.width <= title.x, '窄屏全局标题不得被菜单遮挡');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('[data-view="assets"]').click();
  assert.equal(await page.locator('[data-global-notification-trigger]').isVisible(), true, '通知入口在其他工作区仍可见');
});

test('站内通知角标读取失败时不显示为零，展开面板可重新读取', async t => {
  const service = await fixture();
  const browser = await chromium.launch({ headless: true });
  t.after(async () => { await browser.close(); await service.close(); });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.route('**/api/incremental-tasks/notifications?limit=1', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, error: { message: '通知服务暂不可用' } }) }), { times: 1 });
  await page.goto(`${service.url}/knowledge-center/`);
  await page.getByText('编写数值型', { exact: true }).waitFor();
  assert.equal(await page.locator('[data-global-notification-badge]').isVisible(), false);
  await page.locator('[data-global-notification-trigger]').click();
  await page.getByText('请确认范围').waitFor();
  assert.equal(await page.locator('[data-global-notification-badge]').textContent(), '1');
});

test('站内通知动作只按服务端权限展示', async t => {
  for (const [actions, label] of [[['reply'], '回复'], [[], '查看']]) {
    const service = await fixture({ notificationActions: actions });
    const browser = await chromium.launch({ headless: true });
    t.after(async () => { await browser.close(); await service.close(); });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`${service.url}/knowledge-center/`);
    await page.locator('[data-global-notification-trigger]').click();
    await page.getByText('请确认范围').waitFor();
    assert.equal(await page.locator('.global-notification-panel a').innerText(), label);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  }
});

test('联合查询面板支持嵌套组并将条件保存在 URL', async t => {
  const service = await fixture();
  const browser = await chromium.launch({ headless: true });
  t.after(async () => { await browser.close(); await service.close(); });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const captureCoverage = await instrumentFrontend(page);
  await page.goto(`${service.url}/knowledge-center/`);
  await page.getByText('编写数值型', { exact: true }).waitFor();
  await page.locator('[data-filter-toggle]').click();
  await page.locator('[data-filter-value="0"]').fill('WB-1');
  await page.locator('[data-filter-add-group=""]').click();
  assert.equal(await page.locator('.my-task-filter-group').count(), 2);
  await page.locator('[data-filter-value="1.0"]').fill('YDB-1');
  await page.locator('[data-filter-apply]').click();
  await page.waitForFunction(() => new URL(location.href).searchParams.has('wb'));
  const saved = JSON.parse(new URL(page.url()).searchParams.get('wb'));
  assert.equal(saved.filter.children[1].op, 'and');
  await captureCoverage();
  await page.reload();
  await page.locator('[data-filter-toggle]').waitFor();
  assert.equal(JSON.parse(new URL(page.url()).searchParams.get('wb')).filter.children[1].op, 'and');
  await page.locator('[data-filter-toggle]').click();
  assert.equal(await page.locator('.my-task-filter-group').count(), 2);
  await Promise.all([page.waitForResponse(response => response.url().endsWith('/api/workbench/my-tasks/query')), page.locator('[data-filter-clear]').click()]);
  await page.waitForFunction(() => !JSON.parse(new URL(location.href).searchParams.get('wb')).filter);
  await page.locator('[data-filter-toggle]').click();
  const beforeInvalid = service.queries.length;
  await page.locator('[data-filter-apply]').click();
  assert.equal(await page.locator('[data-filter-error]').innerText(), '请填写完整的查询条件');
  assert.equal(service.queries.length, beforeInvalid);
  await page.locator('[data-filter-value="0"]').fill('WB-1');
  for (let index = 1; index <= 20; index++) {
    await page.locator('[data-filter-add-condition=""]').click();
    await page.locator(`[data-filter-value="${index}"]`).fill(`条件${index}`);
  }
  await page.locator('[data-filter-apply]').click();
  assert.equal(await page.locator('[data-filter-error]').innerText(), '查询条件过多，请缩减后再应用');
  assert.equal(service.queries.length, beforeInvalid);
  await Promise.all([page.waitForResponse(response => response.url().endsWith('/api/workbench/my-tasks/query')), page.locator('[data-filter-clear]').click()]);
  await page.locator('[data-filter-toggle]').click();
  await page.locator('[data-filter-operator="0"]').selectOption('eq');
  await page.locator('[data-filter-value="0"]').fill('WB-1');
  await page.locator('[data-filter-add-condition=""]').click();
  await page.locator('[data-filter-field="1"]').selectOption('plannedStartTime');
  await page.locator('[data-filter-date-start="1"]').fill('2026-01-01');
  await page.locator('[data-filter-date-end="1"]').fill('2026-12-31');
  await Promise.all([page.waitForResponse(response => response.url().endsWith('/api/workbench/my-tasks/query')), page.locator('[data-filter-apply]').click()]);
  await page.waitForFunction(() => JSON.parse(new URL(location.href).searchParams.get('wb')).filter?.children?.[1]?.value?.[1] === '2026-12-31');
  assert.deepEqual(service.queries.at(-1).filter.children, [
    { field: 'number', operator: 'eq', value: 'WB-1' },
    { field: 'plannedStartTime', operator: 'between', value: ['2026-01-01', '2026-12-31'] },
  ]);
  await page.locator('[data-filter-toggle]').click();
  await Promise.all([page.waitForResponse(response => response.url().endsWith('/api/workbench/my-tasks/query')), page.locator('[data-filter-clear]').click()]);
  await page.waitForFunction(() => !JSON.parse(new URL(location.href).searchParams.get('wb')).filter);
  assert.equal(service.queries.at(-1).filter, null);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await captureCoverage();
});

test('已关闭的 MR 仅保留提交人的同步动作，详情显示具体状态', async t => {
  const service = await fixture({ mrState: 'closed' });
  const browser = await chromium.launch({ headless: true });
  t.after(async () => { await browser.close(); await service.close(); });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const captureCoverage = await instrumentFrontend(page);
  await page.goto(`${service.url}/knowledge-center/`);
  const action = page.getByRole('button', { name: '状态刷新' });
  await action.waitFor();
  assert.equal(await page.getByRole('link', { name: 'MR链接' }).count(), 0);
  await page.locator('.my-task-list [data-my-task-open]').last().click();
  const detail = page.locator('[data-my-task-dialog]');
  assert.match(await detail.innerText(), /当前进展[\s\S]*MR已关闭，待处理[\s\S]*关联范围/);
  assert.equal(await detail.getByText('已关闭', { exact: true }).count(), 0, '已关闭不重复作为第二个 MR 状态');
  assert.equal(await detail.getByText('正文回读').count(), 0, '未合并时不显示回读');
  assert.equal(await detail.getByText('计划开始').count(), 0, '无值时间不占位');
  assert.equal(await detail.locator('.my-task-detail-trace').getAttribute('open'), null, '内部标识默认折叠');
  const documentPath = detail.getByText('docs/e2e-validation/workbench-heyang-20261104/工作台验收说明.md');
  assert.equal(await documentPath.isVisible(), true, '完整文档路径在关联范围中直接可见');
  assert.equal(await documentPath.evaluate(node => node.scrollWidth <= node.clientWidth), true, '长路径保持在可用宽度内');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: path.join(root, 'runtime/test-results/workbench-optimization-20261105/detail-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(root, 'runtime/test-results/workbench-optimization-20261105/detail-mobile.png') });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await captureCoverage();
});

test('同步失败保留待办，详情展示具体错误', async t => {
  const service = await fixture({ mrState: 'merged', syncFails: true });
  const browser = await chromium.launch({ headless: true });
  t.after(async () => { await browser.close(); await service.close(); });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const captureCoverage = await instrumentFrontend(page);
  await page.goto(`${service.url}/knowledge-center/`);
  await page.locator('[data-my-task-sync]').click();
  await page.getByText('正文与审核候选不一致').waitFor();
  assert.equal(await page.locator('[data-my-task-sync]').isEnabled(), true);
  await page.locator('.my-task-list [data-my-task-open]').last().click();
  assert.match(await page.locator('[data-my-task-dialog]').innerText(), /同步失败：[\s\S]*正文与审核候选不一致/);
  await captureCoverage();
});

test('管理员切换他人工作只读查看并切回本人', async t => {
  const service = await fixture({ responsiblePreview: true });
  const browser = await chromium.launch({ headless: true });
  t.after(async () => { await browser.close(); await service.close(); });
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    const captureCoverage = await instrumentFrontend(page);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${service.url}/knowledge-center/`);
    await page.getByText('编写数值型', { exact: true }).waitFor();
    const selector = page.locator('[data-my-task-responsible]');
    await selector.waitFor();
    assert.ok(await selector.evaluate(node => node.getBoundingClientRect().height >= 44), '责任人选择器点击区域至少为44px');
    assert.equal(await selector.inputValue(), '178');
    const responsibleInput = page.locator('.my-task-responsible [role="combobox"]');
    await responsibleInput.fill('其他责任人');
    await page.getByRole('option', { name: '其他责任人' }).click();
    assert.equal(await selector.inputValue(), '200');
    await page.getByText('其他责任人的文档').waitFor();
    assert.match(await page.locator('.my-task-preview').innerText(), /管理员代办[\s\S]*实际操作者：测试用户/);
    assert.equal(await page.locator('.my-task-list a.my-task-go').count(), 0, '管理员代看期间不得显示可执行主操作');
    assert.equal(await page.locator('.my-task-list .my-task-go:disabled').count(), 1);
    await page.locator('.my-task-list [data-my-task-open]').first().click();
    await page.locator('[data-my-task-dialog][open]').waitFor();
    assert.equal(await page.locator('[data-my-task-dialog] footer a, [data-my-task-dialog] footer button.primary').count(), 0, '只读详情不提供可执行操作');
    await page.locator('[data-my-task-close]').first().click();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.locator('[data-my-task-self]').click();
    await page.getByText('编写数值型', { exact: true }).waitFor();
    assert.equal(await page.locator('.my-task-preview').count(), 0);
    assert.deepEqual(errors, []);
    await captureCoverage();
    await page.close();
  }
});

test('任务管理动态改派弹窗可搜索人员并保持原生 ID', async t => {
  const service = await fixture();
  const browser = await chromium.launch({ headless: true });
  t.after(async () => { await browser.close(); await service.close(); });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${service.url}/fixture`);
  await page.evaluate(async () => {
    const { renderDocumentTasks } = await import('/knowledge-center/modules/document-tasks/view.js');
    renderDocumentTasks({ documentTaskProjection: {
      status: 'ok', items: [], total: 0,
      context: { actorId: '178', canAdmin: true, people: [{ id: '178', displayName: '何阳' }, { id: '200', displayName: '其他责任人' }], handbooks: [], config: { defaultOwnerId: '178', reasonOptions: [] } },
      filterOptions: { product: ['YashanDB'], version: ['23.4'] },
      selected: { number: 'TEST-1', description: '测试任务', ownerId: '178', status: 'pending_scope', canAdmin: true, canConfirm: false,
        pending: [], assignmentHistory: [], decomposition: { confirmed: false, handbooks: [] } },
    } });
  });
  const ownerFilter = page.locator('.document-task-toolbar select[name="ownerId"]');
  assert.equal(await ownerFilter.locator('xpath=ancestor::*[@data-searchable-combobox]').count(), 1);
  assert.equal(await page.locator('.document-task-toolbar select[name="product"]').locator('xpath=ancestor::*[@data-searchable-combobox]').count(), 1);
  await page.locator('.task-drawer [data-task-action="owner"]').click();
  const dialog = page.locator('.document-task-dialog');
  const input = dialog.getByRole('combobox', { name: '责任人，可输入筛选' });
  await input.fill('其他责任人');
  await page.getByRole('option', { name: '其他责任人' }).click();
  assert.equal(await dialog.locator('select[name="ownerId"]').inputValue(), '200');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
});

test('任务管理窄屏卡片保留责任人、版本、状态与输出件', async t => {
  const service = await fixture();
  const browser = await chromium.launch({ headless: true });
  t.after(async () => { await browser.close(); await service.close(); });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${service.url}/fixture`);
  await page.addStyleTag({ content: '@import url("/knowledge-center/modules/document-tasks/document-tasks.css");' });
  await page.evaluate(async () => {
    const { renderDocumentTasks } = await import('/knowledge-center/modules/document-tasks/view.js');
    renderDocumentTasks({ documentTaskProjection: {
      status: 'ok', items: [{ number: 'YDBRD-390', description: '窄屏字段验收任务', ownerName: '何阳', ownerId: '178',
        product: 'YashanDB', version: '23.4.3alpha', status: 'in_progress', ir: ['IR-1'],
        decomposition: { handbooks: [{ documents: [{ name: 'SQL参考手册.md', writingUrl: '/knowledge-center/production/handbook/HB-1?documentId=DOC-1' }] }] } }],
      total: 1, context: { actorId: '178', canAdmin: false, people: [], handbooks: [], config: { reasonOptions: [] } },
      filterOptions: { product: ['YashanDB'], version: ['23.4.3alpha'] },
    } });
  });
  const row = page.locator('.document-task-table tr.task-data-row');
  await row.waitFor();
  for (const text of ['YDBRD-390', '窄屏字段验收任务', '何阳', 'YashanDB', '23.4.3alpha', '处理中', 'SQL参考手册']) {
    assert.ok((await row.innerText()).includes(text), `窄屏任务卡片保留字段：${text}`);
  }
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
});

test('任务管理来源变化与导出入口在窄屏可操作', async t => {
  const service = await fixture();
  const browser = await chromium.launch({ headless: true });
  t.after(async () => { await browser.close(); await service.close(); });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  await page.route('**/knowledge-center/api/document-tasks/TEST-1/sync-changes*', route => route.fulfill({
    contentType: 'application/json', body: JSON.stringify({ success: true, data: { page: 1, pageSize: 20,
      total: 1, items: [{ confirmedAt: '2026-11-12T04:00:00Z', sourceName: '需求基线',
        field: 'title', before: '旧标题', after: '新标题' }] } }),
  }));
  await page.route('**/knowledge-center/api/document-tasks/TEST-1/source-export', route => route.fulfill({
    contentType: 'text/markdown; charset=utf-8', headers: { 'Content-Disposition': 'attachment; filename="YDBRD-1.md"' },
    body: '# 来源资料',
  }));
  await page.route('**/knowledge-center/api/document-tasks/TEST-1/source', route => route.fulfill({
    contentType: 'application/json', body: JSON.stringify({ success: true, data: {
      number: 'TEST-1', title: 'SR 的描述字段', markdown: '## 需求描述\n\n业务需求正文\n\n## 测试建议\n\nPingCode 未填写',
      ir: ['YASHAN-1'], sourceName: '需求基线', sourceUrl: 'https://pingcode.example.test/sr/1',
      confirmedAt: '2026-11-16T01:00:00Z',
    } }),
  }));
  await page.route('**/knowledge-center/api/document-tasks/export.csv*', route => route.fulfill({
    contentType: 'text/csv; charset=utf-8', headers: { 'Content-Disposition': 'attachment; filename="tasks.csv"' },
    body: '编号\r\nTEST-1\r\n',
  }));
  await page.goto(`${service.url}/fixture`);
  await page.evaluate(async () => {
    const { renderDocumentTasks } = await import('/knowledge-center/modules/document-tasks/view.js');
    renderDocumentTasks({ documentTaskProjection: {
      status: 'ok', items: [], total: 0,
      context: { actorId: 'other', canAdmin: false, people: [], handbooks: [], config: { reasonOptions: [] } },
      filterOptions: { product: [], version: [] },
      selected: { number: 'TEST-1', description: '测试来源', ownerId: '178', status: 'in_progress',
        sourceType: 'TICKET', ir: ['YASHAN-1'], pending: [], assignmentHistory: [],
        decomposition: { confirmed: true, handbooks: [] } },
    } });
  });
  await page.locator('.task-source-actions [data-task-action="changes"]').click();
  await page.getByRole('cell', { name: '新标题' }).waitFor();
  await page.locator('.document-task-dialog [data-modal-close]').first().click();
  await page.locator('.task-source-actions [data-task-action="source-view"]').click();
  await page.getByText('SR 的描述字段', { exact: true }).waitFor();
  await page.getByText('业务需求正文', { exact: true }).waitFor();
  await page.getByText('PingCode 未填写', { exact: true }).waitFor();
  await page.locator('.document-task-dialog [data-modal-close]').first().click();
  const sourceDownload = page.waitForEvent('download');
  await page.locator('.task-source-actions [data-task-action="source-export"]').click();
  assert.equal((await sourceDownload).suggestedFilename(), 'YDBRD-1.md');
  await page.getByRole('button', { name: '返回任务列表' }).click();
  const csvDownload = page.waitForEvent('download');
  await page.locator('[data-task-action="export"]').click();
  assert.equal((await csvDownload).suggestedFilename(), 'tasks.csv');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
});

test('代看合入负责人时禁用动作在列表和详情均不可跳转', async t => {
  const service = await fixture({ responsiblePreview: true, restrictedMerge: true });
  const browser = await chromium.launch({ headless: true });
  t.after(async () => { await browser.close(); await service.close(); });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const captureCoverage = await instrumentFrontend(page);
  await page.goto(`${service.url}/knowledge-center/`);
  await page.locator('[data-my-task-responsible]').selectOption('200');
  await page.getByText('合入 测试手册').waitFor();
  assert.equal(await page.locator('.my-task-list a').count(), 0);
  assert.equal(await page.locator('.my-task-list .my-task-go:disabled').innerText(), '只读预览');
  await page.locator('.my-task-list [data-my-task-open]').click();
  await page.locator('[data-my-task-dialog][open]').waitFor();
  assert.equal(await page.locator('[data-my-task-dialog] a').count(), 0);
  await captureCoverage();
});

test('工作台进入手册后返回原筛选位置，且首帧在 100ms 内', async t => {
  const service = await fixture({ handbookEntry: true, outlineDelayMs: 5 });
  const browser = await chromium.launch({ headless: true });
  t.after(async () => { await browser.close(); await service.close(); });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const captureCoverage = await instrumentFrontend(page);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${service.url}/knowledge-center/`);
  await page.getByText('编写数值型', { exact: true }).waitFor();
  await page.locator('.my-task-table-row').first().getByText('待处理', { exact: true }).waitFor();
  await page.locator('[data-my-task-query]').fill('数值型');
  const sourceUrl = page.url();
  const pageLoads = service.requests.filter(url => url === '/knowledge-center/').length;
  const timings = [];
  for (let index = 0; index < (coverageCases ? 1 : 6); index++) {
    await page.locator('.my-task-list a[href*="HB-RETURN"]').click();
    await page.locator('[data-handbook-return]').waitFor({ timeout: 5000 }).catch(async error => {
      throw new Error(`${error.message}; url=${page.url()}; text=${(await page.locator('#view-root').innerText()).slice(0, 500)}; requests=${JSON.stringify(service.requests.slice(-15))}; errors=${JSON.stringify(errors)}`);
    });
    await page.evaluate(() => {
      window.__returnStart = 0;
      window.__returnPaint = 0;
      document.addEventListener('click', event => {
        if (event.target.closest('[data-handbook-return]')) window.__returnStart = performance.now();
      }, { capture: true, once: true });
      const observer = new MutationObserver(() => {
        if (!document.querySelector('.my-tasks') || window.__returnPaint) return;
        requestAnimationFrame(() => requestAnimationFrame(() => { window.__returnPaint = performance.now() - window.__returnStart; }));
        observer.disconnect();
      });
      observer.observe(document.querySelector('#view-root'), { childList: true });
    });
    await page.locator('[data-handbook-return]').click();
    await page.locator('.my-tasks').waitFor();
    await page.waitForFunction(() => window.__returnPaint > 0);
    await page.getByText('审核 数值型', { exact: true }).waitFor();
    timings.push(await page.evaluate(() => window.__returnPaint));
    assert.equal(new URL(page.url()).pathname, new URL(sourceUrl).pathname);
    assert.equal(JSON.parse(new URL(page.url()).searchParams.get('wb')).query, '数值型');
    assert.equal(await page.locator('[data-my-task-query]').inputValue(), '数值型');
    await page.waitForFunction(() => window.__knowledgeMyTasksProjection?.status === 'ok'
      && window.__knowledgeMyTasksProjection?.items?.length === 1
      && document.querySelectorAll('.my-task-list .my-task-table-row').length === 1);
    assert.equal(await page.locator('.my-task-table-row').innerText().then(text => text.includes('待审核')), true);
    assert.equal(await page.locator('.my-task-table-row a.my-task-go').innerText(), '查看审核');
  }
  const sorted = [...timings].sort((a, b) => a - b);
  const p95 = sorted[Math.ceil(sorted.length * .95) - 1];
  assert.equal(service.requests.filter(url => url === '/knowledge-center/').length, pageLoads, '返回不重载应用 HTML');
  assert.deepEqual(errors, []);
  if (!coverageCases) {
    assert.ok(p95 < 100, JSON.stringify({ timings, p95 }));
    console.log(JSON.stringify({ handbookReturn: { timings, p50: sorted[2], p95 } }));
  }
  await page.locator('[data-view="documentTasks"]').click();
  await page.locator('.task-output-document').waitFor();
  const taskSource = page.url();
  await page.locator('.task-output-document').click();
  await page.locator('[data-handbook-return]').waitFor();
  await page.locator('[data-handbook-return]').click();
  await page.locator('.document-task-page').waitFor();
  assert.equal(page.url(), taskSource);
  assert.equal(await page.locator('.task-output-document').count(), 1);
  await captureCoverage();
  await page.goForward();
  await page.locator('[data-handbook-return]').waitFor();
  await captureCoverage();
  await page.goBack();
  await page.locator('.document-task-page').waitFor();
  assert.equal(page.url(), taskSource);
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const captureMobile = await instrumentFrontend(mobile);
  await mobile.goto(`${service.url}/knowledge-center/`);
  await mobile.locator('.my-task-list a[href*="HB-RETURN"]').waitFor();
  await mobile.locator('[data-my-task-query]').fill('数值型');
  await mobile.locator('.my-task-list a[href*="HB-RETURN"]').click();
  await mobile.locator('[data-handbook-return]').waitFor();
  await mobile.locator('[data-handbook-return]').click();
  await mobile.locator('.my-tasks').waitFor();
  assert.equal(await mobile.locator('[data-my-task-query]').inputValue(), '数值型');
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await captureMobile();
  await page.locator('[data-view="assets"]').click();
  await page.locator('[data-asset-id="HB-RETURN"]').waitFor();
  await page.locator('[data-asset-id="HB-RETURN"]').click();
  await page.locator('.asset-action-row[href*="/production/handbook/HB-RETURN"]').click();
  await page.locator('[data-handbook-return]').waitFor();
  await page.locator('[data-handbook-return]').click();
  await page.locator('.asset-workspace-detail').waitFor();
  assert.match(page.url(), /\/knowledge-center\/assets\?handbookId=HB-RETURN/);
  const direct = await browser.newPage();
  const captureDirect = await instrumentFrontend(direct);
  await direct.goto(`${service.url}/knowledge-center/production/handbook/HB-RETURN?documentId=doc-return`);
  await direct.locator('[data-handbook-return]').waitFor();
  await direct.locator('[data-handbook-return]').click();
  await direct.waitForURL('**/knowledge-center/assets?handbookId=HB-RETURN');
  await direct.locator('.asset-workspace').waitFor();
  await captureDirect();
  await captureCoverage();
});
