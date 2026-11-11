#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawn } = require('node:child_process');
const { createServer } = require('node:http');
const { createInstrumenter } = require('istanbul-lib-instrument');
const { createCoverageMap } = require('istanbul-lib-coverage');
const { createContext } = require('istanbul-lib-report');
const reports = require('istanbul-reports');
const { chromium } = require('@playwright/test');
const { exerciseHandbookReviewSelection } = require('../../tests/e2e/agent-runner/fixtures/handbook-review-selection.cjs');
const { exerciseTeamGroupHttp } = require('../../tests/e2e/agent-runner/fixtures/team-group-http.cjs');
const { exerciseHandbookDraftInput } = require('../../tests/e2e/agent-runner/fixtures/handbook-draft-input.cjs');
const { exerciseCleaningUploadHttp } = require('../../tests/e2e/agent-runner/fixtures/cleaning-upload-http.cjs');
const { exerciseWritingAdoptionHttp } = require('../../tests/e2e/agent-runner/fixtures/writing-adoption-http.cjs');
const { exercisePrincipalImportHttp } = require('../../tests/e2e/agent-runner/fixtures/principal-import-http.cjs');
const { exerciseGitlabMappingHttp } = require('../../tests/e2e/agent-runner/fixtures/gitlab-mapping-http.cjs');
const { exerciseGitlabConnectionHttp } = require('../../tests/e2e/agent-runner/fixtures/gitlab-connection-http.cjs');
const { exercisePermissionRolesHttp } = require('../../tests/e2e/agent-runner/fixtures/permission-roles-http.cjs');
const { exerciseAssetManagementHttp } = require('../../tests/e2e/agent-runner/fixtures/asset-management-http.cjs');
const { exerciseOutlineRecycleHttp } = require('../../tests/e2e/agent-runner/fixtures/outline-recycle-http.cjs');
const { exerciseIncrementalCreateHttp } = require('../../tests/e2e/agent-runner/fixtures/incremental-create-http.cjs');

const root = path.resolve(__dirname, '../..');
const frontendRoot = path.join(root, 'apps/knowledge-center-web/frontend/knowledge-center');
const output = path.resolve(process.env.KC_FRONTEND_ISTANBUL_OUTPUT || path.join(root, 'runtime/coverage-goal/frontend'));
const port = Number(process.env.KC_FRONTEND_ISTANBUL_PORT || 3627);
const runtimeKey = '__kc_istanbul_coverage__';

function sourceFiles(directory, result = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'vendor') sourceFiles(file, result);
    } else if (entry.isFile() && entry.name.endsWith('.js')) result.push(file);
  }
  return result;
}

function sourceManifest() {
  return Object.fromEntries(sourceFiles(frontendRoot).sort().map(file => [
    path.relative(root, file).split(path.sep).join('/'),
    createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
  ]));
}

function inputManifest() {
  const entries = [];
  const collect = file => {
    if (!fs.existsSync(file)) return;
    const stat = fs.statSync(file);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(file, { withFileTypes: true })) {
        if (['node_modules', 'runtime', '.git'].includes(entry.name)) continue;
        if (entry.isDirectory() || entry.isFile()) collect(path.join(file, entry.name));
      }
    } else if (stat.isFile()) entries.push(file);
  };
  for (const name of [
    'apps/knowledge-center-web', 'packages/agent-runner-core',
    'tests/e2e/agent-runner', 'tests/unit/agent-runner',
    'config/knowledge-center', 'knowledge/outlines',
    'package.json', 'package-lock.json', 'tools/repository/collect-frontend-istanbul-coverage.cjs',
  ]) collect(path.join(root, name));
  return Object.fromEntries(entries.sort().map(file => [
    path.relative(root, file).split(path.sep).join('/'),
    createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
  ]));
}

function waitForServer(child) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('前端覆盖率服务启动超时')), 15000);
    const ready = chunk => {
      if (!String(chunk).includes('Frontend server listening')) return;
      clearTimeout(timer);
      resolve();
    };
    child.stdout.on('data', ready);
    child.stderr.on('data', ready);
    child.once('exit', code => {
      clearTimeout(timer);
      reject(new Error(`前端覆盖率服务退出：${code}`));
    });
  });
}

function runWritingTest(args, env, logFile, label) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: root,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let outputText = '';
    const record = chunk => { outputText += String(chunk); };
    child.stdout.on('data', record);
    child.stderr.on('data', record);
    child.once('error', reject);
    child.once('close', code => {
      fs.writeFileSync(logFile, outputText);
      if (code === 0) resolve();
      else {
        fs.writeFileSync(logFile, outputText);
        const failures = outputText.split('\n').filter(line => /^(not ok|\s+failureType:|\s+error:|\s+code:|# fail )/.test(line));
        reject(new Error(`${label}失败（退出码 ${code}）：${failures.join(' | ')}；完整日志 ${logFile}`));
      }
    });
  });
}

async function runWritingCoverage(caseDirectory) {
  fs.mkdirSync(caseDirectory, { recursive: true });
  const testFile = 'tests/e2e/agent-runner/production-writing.test.cjs';
  const env = { ...process.env, WRITING_LIVE_MODEL: '0' };
  delete env.KC_FRONTEND_ISTANBUL_CASE_DIR;
  await runWritingTest(['--test', '--test-name-pattern=网页资料多选', testFile], env,
    path.join(caseDirectory, 'image-preview.log'), '无注入图片预览');
  await runWritingTest(['--test', testFile], { ...env, KC_FRONTEND_ISTANBUL_CASE_DIR: caseDirectory },
    path.join(caseDirectory, 'writing-test.log'), '写作浏览器覆盖率测试');
}

async function runReviewCoverage(caseDirectory) {
  const env = { ...process.env, KC_FRONTEND_ISTANBUL_CASE_DIR: caseDirectory, NODE_PATH: path.join(root, 'runtime/agent-runner/node_modules') };
  await runWritingTest(['node_modules/@playwright/test/cli.js', 'test', '--config=tests/unit/agent-runner/playwright.coverage.config.cjs'], env,
    path.join(caseDirectory, 'review-test.log'), '审核工作台浏览器覆盖率测试');
}

async function runDocumentTaskCoverage(caseDirectory) {
  fs.mkdirSync(caseDirectory, { recursive: true });
  await runWritingTest(['--test', 'tests/unit/agent-runner/document-tasks-frontend.test.cjs'],
    { ...process.env, KC_FRONTEND_ISTANBUL_CASE_DIR: caseDirectory },
    path.join(caseDirectory, 'document-tasks-test.log'), '任务管理真实 HTTP 浏览器覆盖率测试');
}

async function runMyWorkCoverage(caseDirectory) {
  fs.mkdirSync(caseDirectory, { recursive: true });
  const pattern = '工作台统一|联合查询面板|已关闭的 MR|同步失败保留待办|管理员切换他人工作|代看合入负责人';
  await runWritingTest(['--test', `--test-name-pattern=${pattern}`, 'tests/e2e/agent-runner/knowledge-center-my-work.node.test.cjs'],
    { ...process.env, KC_FRONTEND_ISTANBUL_CASE_DIR: caseDirectory },
    path.join(caseDirectory, 'my-work-test.log'), '我的工作真实 HTTP 浏览器覆盖率测试');
}

async function runHandbookReturnCoverage(caseDirectory) {
  fs.mkdirSync(caseDirectory, { recursive: true });
  await runWritingTest(['--test', '--test-name-pattern=工作台进入手册后返回原筛选位置', 'tests/e2e/agent-runner/knowledge-center-my-work.node.test.cjs'],
    { ...process.env, KC_FRONTEND_ISTANBUL_CASE_DIR: caseDirectory },
    path.join(caseDirectory, 'handbook-return-test.log'), '手册往返隔离 HTTP 浏览器覆盖率测试');
}

async function runHandbookEditorCoverage(caseDirectory) {
  fs.mkdirSync(caseDirectory, { recursive: true });
  await runWritingTest(['--test', 'tests/e2e/agent-runner/handbook-editor-http.node.test.cjs'],
    { ...process.env, KC_FRONTEND_ISTANBUL_CASE_DIR: caseDirectory },
    path.join(caseDirectory, 'handbook-editor-test.log'), '手册编辑器隔离 HTTP 浏览器覆盖率测试');
}

async function runPlatformCoverage(caseDirectory) {
  const suites = [
    ['model', 'platform-model-management.test.cjs', ['--test'], 3],
    ['agent', 'platform-agent-management.test.cjs', ['--test'], 1],
    ['mcp', 'platform-mcp-management.cjs', [], 2],
  ];
  for (const [name, file, nodeArgs, expectedCount] of suites) {
    const directory = path.join(caseDirectory, name);
    fs.mkdirSync(directory, { recursive: true });
    await runWritingTest([...nodeArgs, `tests/e2e/agent-runner/${file}`],
      { ...process.env, KC_FRONTEND_ISTANBUL_CASE_DIR: directory },
      path.join(directory, 'test.log'), `平台 ${name} 真实 HTTP 浏览器覆盖率测试`);
    const count = fs.readdirSync(directory).filter(item => item.endsWith('.json')).length;
    if (count !== expectedCount) throw new Error(`平台 ${name} 计数文件应为 ${expectedCount} 个，实际 ${count}`);
  }
  return suites;
}

async function activateTab(page, selector, activeSelector, panelSelector) {
  const tab = page.locator(selector).first();
  await tab.waitFor({ state: 'visible', timeout: 10000 });
  await tab.click();
  await page.locator(activeSelector).first().waitFor({ state: 'visible', timeout: 10000 });
  if (panelSelector) await page.locator(panelSelector).first().waitFor({ state: 'visible', timeout: 10000 });
}

async function exerciseCleaning(page) {
  let scenario = 'unavailable';
  const fixture = createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const data = {
      '/workbench/summary': { counts: { active: 2, failed: 1 } },
      '/material-batches': { total: 1, items: [{ id: 'coverage-batch', name: '隔离资料批次', status: 'ready' }] },
      '/datasets': { total: 1, items: [{ id: 'coverage-dataset', name: '隔离知识库版本', status: 'published' }] },
      '/index/stats': { total: 17, graphNodes: 5, graphEdges: 3 },
    };
    const known = request.method === 'GET' && Object.hasOwn(data, pathname);
    const failed = scenario === 'unavailable' || (scenario === 'index-unavailable' && pathname === '/index/stats');
    response.writeHead(!known ? 404 : failed ? 503 : 200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(!known || failed
      ? { error: { code: 'CLEANING_COVERAGE_UNAVAILABLE', message: '隔离资料加工服务失败' } }
      : { data: data[pathname] }));
  });
  await new Promise((resolve, reject) => {
    fixture.once('error', reject);
    fixture.listen(0, '127.0.0.1', resolve);
  });
  const pattern = '**/knowledge-center/api/cleaning/**';
  const handler = async route => {
    const url = new URL(route.request().url());
    const pathname = url.pathname.slice('/knowledge-center/api/cleaning'.length);
    const response = await route.fetch({ url: `http://127.0.0.1:${fixture.address().port}${pathname}${url.search}` });
    await route.fulfill({ response });
  };
  await page.route(pattern, handler);
  try {
    for (const mode of ['unavailable', 'index-unavailable', 'healthy']) {
      scenario = mode;
      await page.locator('[data-view="cleaning"]').first().click();
      if (mode === 'unavailable') {
        await page.getByText('资料加工服务暂时不可用', { exact: true }).waitFor({ state: 'visible' });
        if (await page.locator('[data-cleaning-upload-open]').count()) throw new Error('服务不可用时不应允许上传');
      } else {
        await page.getByText('隔离资料批次', { exact: true }).waitFor({ state: 'visible' });
        await page.getByText('隔离知识库版本', { exact: true }).waitFor({ state: 'visible' });
        if (mode === 'index-unavailable') {
          await page.getByText('索引状态暂时不可用', { exact: true }).waitFor({ state: 'visible' });
        } else {
          await page.locator('.metric').filter({ hasText: '索引条目' }).filter({ hasText: '17' }).waitFor({ state: 'visible' });
          await exerciseView(page, 'cleaning');
        }
      }
      // Leave the view so the next navigation starts a fresh API load.
      if (mode !== 'healthy') await page.locator('[data-view="dashboard"]').first().click();
    }
  } finally {
    await page.unroute(pattern, handler);
    fixture.closeAllConnections();
    await new Promise(resolve => fixture.close(resolve));
  }
}

async function exerciseCleaningApi(page) {
  const requests = [];
  let mode = 'success';
  const pattern = '**/knowledge-center/api/cleaning/**';
  const handler = async route => {
    const request = route.request();
    const url = new URL(request.url());
    requests.push({ method: request.method(), path: url.pathname + url.search, headers: request.headers(), body: request.postData() });
    if (mode === 'invalid-json') return route.fulfill({ status: 502, contentType: 'text/plain', body: 'upstream unavailable' });
    if (mode === 'error') return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: { code: 'UPLOAD_CONFLICT', message: '会话冲突' } }) });
    const body = request.method() === 'GET' ? { data: { status: 'ok' } } : { data: { accepted: true, path: url.pathname } };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  };
  await page.route(pattern, handler);
  try {
    const result = await page.evaluate(async () => {
      const api = await import('/knowledge-center/common/api/cleaning-api.js');
      const session = await api.createUploadSession({ name: '隔离上传', idempotencyKey: 'coverage-idempotency' });
      const file = await api.addUploadFile('session/1', { name: '中文 文件.md', size: 3 });
      const chunk = await api.uploadChunk('session/1', 'file/1', 2, 'abc', { 'X-Chunk-Digest': 'sha256:test' });
      const completedFile = await api.completeUploadFile('session/1', 'file/1');
      const completedSession = await api.completeUploadSession('session/1');
      const batch = await api.createUploadBatch('session/1', '隔离批次');
      return { session, file, chunk, completedFile, completedSession, batch };
    });
    if (!result.session.accepted || !result.batch.accepted) throw new Error('上传 API 成功信封未解包');
    const expected = [
      ['POST', '/knowledge-center/api/cleaning/upload-sessions'],
      ['POST', '/knowledge-center/api/cleaning/upload-sessions/session%2F1/files'],
      ['PUT', '/knowledge-center/api/cleaning/upload-sessions/session%2F1/files/file%2F1/chunks/2'],
      ['POST', '/knowledge-center/api/cleaning/upload-sessions/session%2F1/files/file%2F1/complete'],
      ['POST', '/knowledge-center/api/cleaning/upload-sessions/session%2F1/complete'],
      ['POST', '/knowledge-center/api/cleaning/upload-sessions/session%2F1/create-batch'],
    ];
    if (requests.length !== expected.length || expected.some(([method, path], index) => requests[index].method !== method || requests[index].path !== path))
      throw new Error('上传 API 请求契约错误：' + JSON.stringify(requests));
    if (!requests[0].headers['idempotency-key'] || !requests[5].headers['idempotency-key'] || requests[5].headers['idempotency-key'] === requests[0].headers['idempotency-key'])
      throw new Error('上传会话和批次幂等键未按契约发送');
    if (requests[2].headers['content-type'] !== 'application/octet-stream' || requests[2].body !== 'abc')
      throw new Error('分片正文或 Content-Type 错误');
    mode = 'error';
    const error = await page.evaluate(async () => {
      const { createUploadSession } = await import('/knowledge-center/common/api/cleaning-api.js');
      try { await createUploadSession({ name: '冲突', idempotencyKey: 'error-case' }); return null; }
      catch (caught) { return { message: caught.message, status: caught.status, code: caught.code }; }
    });
    if (error?.status !== 409 || error.code !== 'UPLOAD_CONFLICT' || error.message !== '会话冲突') throw new Error('结构化错误未保留：' + JSON.stringify(error));
    mode = 'invalid-json';
    const fallback = await page.evaluate(async () => {
      const { completeUploadSession } = await import('/knowledge-center/common/api/cleaning-api.js');
      try { await completeUploadSession('broken'); return null; }
      catch (caught) { return { status: caught.status, message: caught.message }; }
    });
    if (fallback?.status !== 502 || !fallback.message.includes('资料加工请求失败')) throw new Error('非法响应未标准化：' + JSON.stringify(fallback));
  } finally {
    await page.unroute(pattern, handler);
  }
}

async function exerciseView(page, view) {
  if (view === 'templates') {
    for (const tab of ['mappings', 'editor']) {
      await activateTab(page, `[data-template-tab="${tab}"]`, `[data-template-tab="${tab}"][aria-selected="true"]`);
    }
  }
  if (view === 'documentTasks') {
    for (const tab of ['flow', 'config', 'list']) {
      await activateTab(page, `[data-task-tab="${tab}"]`, `[data-task-tab="${tab}"][aria-selected="true"]`);
    }
  }
  if (view === 'production') {
    for (const tab of ['versions', 'tasks', 'generations', 'handbooks']) {
      await activateTab(page, `[data-production-overview-tab="${tab}"]`, `[data-production-overview-tab="${tab}"][aria-selected="true"]`);
    }
  }
  if (view === 'cleaning') {
    const uploadButton = page.locator('[data-cleaning-upload-open]').first();
    if (!await uploadButton.count()) {
      // Keep the upload renderer and delegated app handlers covered even when
      // the authenticated fixture is read-only.
      await page.evaluate(async () => {
        const { renderCleaning } = await import('/knowledge-center/modules/cleaning/view.js');
        const host = document.createElement('div');
        host.dataset.coverageCleaningFixture = 'true';
        host.innerHTML = renderCleaning({
          cleaningProjection: { status: 'ok', batches: [], datasets: [], index: {} },
          cleaningCanWrite: true,
        });
        document.body.append(host);
      });
    }
    await page.locator('[data-cleaning-upload-open]').first().click();
    await page.locator('[data-cleaning-upload-dialog][open]').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('[data-cleaning-upload-close]').first().click();
    await page.locator('[data-cleaning-upload-dialog][open]').waitFor({ state: 'detached', timeout: 10000 });
  }
  if (view === 'platform') {
    for (const tab of ['permissions', 'gitlab', 'models', 'governance']) {
      await activateTab(page, `[data-platform-tab="${tab}"]`, `[data-platform-tab="${tab}"][aria-current="page"]`, `#platform-panel-${tab}`);
    }
    for (const teamView of ['people', 'groups']) {
      await page.locator('#platform-tab-principals').click();
      await activateTab(page, `[data-team-group-view="${teamView}"][role="menuitem"]`, '#platform-tab-principals[aria-current="page"]', '#platform-panel-principals');
      const teamRetry = page.locator('[data-team-group-retry]');
      if (teamView === 'groups' && await teamRetry.count()) {
        await teamRetry.click();
        await page.locator('#platform-panel-principals').waitFor({ state: 'visible', timeout: 10000 });
      }
      if (!await page.locator(`[data-team-group-view="${teamView}"][role="menuitem"][aria-current="page"]`).count()) {
        throw new Error(`人员管理子页面未激活：${teamView}`);
      }
    }
    await page.locator('[data-platform-tab="governance"]').click();
    await page.locator('[data-database-open]').click();
    const databaseDialog = page.locator('[data-database-dialog][open]');
    await databaseDialog.waitFor({ state: 'visible', timeout: 10000 });
    await databaseDialog.locator('[data-database-field="username"]').fill('coverage-reader');
    await databaseDialog.locator('[data-database-advanced] summary').click();
    const databaseTestRoute = '**/knowledge-center/api/platform/database-connection/test';
    await page.route(databaseTestRoute, route => route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, error: { code: 'DB_TEST_FIXTURE_FAILURE', message: '隔离测试连接失败' } }),
    }));
    await databaseDialog.locator('[data-database-test]').click();
    await page.locator('.database-connection-feedback.error').filter({ hasText: 'HTTP 500' }).waitFor({ state: 'visible', timeout: 10000 });
    if (await databaseDialog.locator('[data-database-test]').isDisabled()) {
      throw new Error('测试连接失败后操作按钮应恢复可用');
    }
    await page.unroute(databaseTestRoute);
    const databaseSaveRoute = '**/knowledge-center/api/platform/database-connection';
    await page.route(databaseSaveRoute, route => route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, error: { code: 'DB_SAVE_FIXTURE_FAILURE', message: '隔离保存失败' } }),
    }));
    await databaseDialog.locator('[data-database-save]').click();
    await page.locator('.database-connection-feedback.error').filter({ hasText: 'HTTP 500' }).waitFor({ state: 'visible', timeout: 10000 });
    if (await databaseDialog.locator('[data-database-save]').isDisabled()) {
      throw new Error('保存失败后操作按钮应恢复可用');
    }
    await page.unroute(databaseSaveRoute);
    await page.route(databaseTestRoute, route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { message: '隔离连接测试通过' } }),
    }));
    await databaseDialog.locator('[data-database-test]').click();
    await databaseDialog.locator('.database-connection-feedback.success').filter({ hasText: '隔离连接测试通过' }).waitFor({ state: 'visible', timeout: 10000 });
    await page.unroute(databaseTestRoute);
    await page.route(databaseSaveRoute, route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: {
        status: 'verified', healthStatus: 'healthy', rowVersion: 2,
        connection: { jdbcUrl: 'jdbc:fixture', username: 'coverage-reader', passwordConfigured: true },
        effectiveConnection: { jdbcUrl: 'jdbc:fixture', username: 'coverage-reader' },
      } }),
    }));
    await databaseDialog.locator('[data-database-save]').click();
    await databaseDialog.locator('.database-connection-feedback.success').filter({ hasText: '页面配置已保存' }).waitFor({ state: 'visible', timeout: 10000 });
    await page.unroute(databaseSaveRoute);
    await databaseDialog.locator('[data-database-field="username"]').fill('coverage-reader-edited');
    await page.evaluate(() => { window.__coverageOriginalConfirm = window.confirm; window.confirm = () => false; });
    await databaseDialog.locator('[data-database-close]').first().click();
    if (!await page.locator('[data-database-dialog][open]').count()) {
      throw new Error('有未保存修改时取消关闭应保留数据库连接抽屉');
    }
    await page.evaluate(() => { window.confirm = () => true; });
    await databaseDialog.locator('[data-database-close]').first().click();
    await databaseDialog.waitFor({ state: 'hidden', timeout: 10000 });
    await page.evaluate(() => { window.confirm = window.__coverageOriginalConfirm; delete window.__coverageOriginalConfirm; });
  }
}

async function exercisePlanCalendar(page) {
  await page.evaluate(async () => {
    const { openPlanCalendar, planCell, planLocal } = await import('/knowledge-center/modules/document-tasks/plan-calendar.js');
    const assert = (condition, message) => { if (!condition) throw new Error(message); };
    const settle = () => new Promise(resolve => setTimeout(resolve, 0));
    const makeHost = () => {
      const host = document.createElement('div');
      document.body.append(host);
      return host;
    };
    const task = {
      number: 'TASK-PLAN-1', revision: 4, canEditPlan: true,
      plannedStartTime: '2026-04-10T01:00:00.000Z',
      plannedEndTime: '2026-04-10T04:00:00.000Z',
    };
    assert(planLocal(null) === '', '空计划时间应为空');
    assert(planLocal(task.plannedStartTime) === '2026-04-10 09:00', '计划时间应按北京时间显示');
    assert(planCell(task, 'plannedStartTime').includes('aria-label="TASK-PLAN-1开始时间"'), '可编辑单元格应带有可访问名称');
    assert(planCell({ ...task, number: null, plannedStartTime: null }, 'plannedStartTime').includes('选择时间'), '可编辑空时间应显示选择入口');
    assert(planCell({ ...task, canEditPlan: false }, 'plannedStartTime').includes('2026-04-10 09:00'), '只读单元格应显示时间');
    assert(planCell({ canEditPlan: false }, 'plannedEndTime') === '—', '缺少时间时应显示占位符');

    const unsetHost = makeHost();
    openPlanCalendar(unsetHost, { ...task, plannedStartTime: null }, 'plannedStartTime', async () => {}, async () => {}, async () => task);
    assert(unsetHost.querySelector('[name=clock]').value === '09:00', '未设置计划时间应使用默认时刻');
    unsetHost.querySelector('dialog').close();

    const host = makeHost();
    const saved = [];
    let refreshed = false;
    openPlanCalendar(host, task, 'plannedStartTime', async value => saved.push(value), async () => { refreshed = true; }, async () => task);
    const dialog = host.querySelector('dialog');
    assert(dialog.open && dialog.querySelectorAll('[data-day]').length === 30, '应以日期网格打开日历');
    dialog.querySelector('[data-next]').click();
    dialog.querySelector('[data-prev]').click();
    dialog.querySelector('[data-day="2026-04-11"]').click();
    dialog.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    assert(!dialog.querySelector('[data-calendar-error]').hidden, '开始时间晚于结束时间应被拒绝');
    dialog.querySelector('[data-day="2026-04-10"]').click();
    dialog.querySelector('[name=clock]').value = '10:30';
    dialog.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await settle();
    assert(saved[0]?.expectedRevision === 4 && saved[0]?.plannedStartTime === '2026-04-10T02:30:00.000Z' && refreshed && !dialog.open, `有效时间应转换为 UTC 并刷新：${JSON.stringify({ saved, refreshed, open: dialog.open })}`);

    const conflictHost = makeHost();
    let saveCount = 0;
    let reloadCount = 0;
    let resolveReload;
    const waitingReload = new Promise(resolve => { resolveReload = resolve; });
    openPlanCalendar(conflictHost, task, 'plannedStartTime', async () => {
      saveCount += 1;
      if (saveCount === 1) throw Object.assign(new Error('revision conflict'), { code: 'REVISION_CONFLICT' });
    }, async () => {}, async () => {
      reloadCount += 1;
      if (reloadCount === 1) return { ...task, canEditPlan: false };
      if (reloadCount === 3) return waitingReload;
      return { ...task, revision: 5, plannedStartTime: null, plannedEndTime: null };
    });
    const conflict = conflictHost.querySelector('dialog');
    conflict.querySelector('[data-day="2026-04-10"]').click();
    conflict.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await settle();
    assert(!conflict.querySelector('[data-calendar-reload]').hidden, '版本冲突应显示重新读取操作');
    conflict.querySelector('[data-calendar-reload]').click();
    await settle();
    assert(conflict.querySelector('[data-calendar-error]').textContent.includes('已无权'), '权限撤销时应显示读取错误');
    conflict.querySelector('[data-calendar-reload]').click();
    await settle();
    const rereadButton = conflict.querySelector('[data-calendar-reload]');
    const reloadPromise = rereadButton.onclick();
    rereadButton.onclick();
    assert(reloadCount === 3, '重新读取期间再次请求应被忽略');
    resolveReload({ ...task, revision: 5, plannedStartTime: null, plannedEndTime: null });
    await reloadPromise;
    assert(conflict.querySelector('[data-calendar-reload]').hidden, '成功重新读取后应隐藏重新读取操作');
    assert(conflict.querySelector('[data-calendar-error]').textContent.includes('结束 未设置') && conflict.querySelector('[data-calendar-error]').textContent.includes('当前选择已保留'), '重新读取应展示空时间并保留用户选择');
    conflict.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await settle();
    assert(!conflict.open, '重新读取后可提交当前选择');

    const errorHost = makeHost();
    openPlanCalendar(errorHost, task, 'plannedEndTime', async () => { throw new Error('save unavailable'); }, async () => {}, async () => task);
    const errorDialog = errorHost.querySelector('dialog');
    errorDialog.querySelector('[data-day="2026-04-09"]').click();
    errorDialog.querySelector('[name=clock]').value = '10:00';
    errorDialog.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await settle();
    assert(errorDialog.querySelector('[data-calendar-error]').textContent === '结束时间不能早于开始时间', '结束时间早于开始时间应被拒绝');
    errorDialog.querySelector('[data-day="2026-04-10"]').click();
    errorDialog.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await settle();
    assert(errorDialog.querySelector('[data-calendar-error]').textContent === 'save unavailable', '普通保存错误应显示服务消息');
    const closed = new Promise(resolve => errorDialog.addEventListener('close', resolve, { once: true }));
    errorDialog.querySelector('[data-calendar-close]').click();
    await closed;
    assert(!errorHost.querySelector('dialog'), '关闭按钮应移除日历');

    const clearHost = makeHost();
    let cleared;
    openPlanCalendar(clearHost, task, 'plannedStartTime', async value => { cleared = value; }, async () => {}, async () => task);
    clearHost.querySelector('[data-clear]').click();
    await settle();
    assert(cleared?.expectedRevision === 4 && cleared?.plannedStartTime === null, '清空操作应保存空时间');

    const emptyTimeHost = makeHost();
    let emptyTimeSaved = false;
    openPlanCalendar(emptyTimeHost, task, 'plannedStartTime', async () => { emptyTimeSaved = true; }, async () => {}, async () => task);
    emptyTimeHost.querySelector('[name=clock]').value = '';
    emptyTimeHost.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await settle();
    assert(!emptyTimeSaved, '未选择时间时不应提交计划');
    emptyTimeHost.querySelector('dialog').close();

    const busyHost = makeHost();
    let finishSave;
    openPlanCalendar(busyHost, task, 'plannedStartTime', () => new Promise(resolve => { finishSave = resolve; }), async () => {}, async () => task);
    const busyDialog = busyHost.querySelector('dialog');
    busyDialog.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    busyDialog.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    busyDialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    assert(busyDialog.open && busyDialog.querySelector('[data-clear]').disabled, '保存期间应禁用控件并阻止关闭');
    finishSave();
    await settle();
    const cancelHost = makeHost();
    openPlanCalendar(cancelHost, task, 'plannedStartTime', async () => {}, async () => {}, async () => task);
    const cancelDialog = cancelHost.querySelector('dialog');
    const cancelEvent = new Event('cancel', { cancelable: true });
    cancelDialog.dispatchEvent(cancelEvent);
    assert(!cancelEvent.defaultPrevented, '空闲日历应允许取消');
    cancelDialog.close();
  });
}

async function exerciseSearchableCombobox(page) {
  await page.evaluate(async () => {
    const { enhanceSearchableSelects, cleanupSearchableSelects, markDynamicSelects, syncSearchableSelect } =
      await import('/knowledge-center/common/searchable-combobox.js');
    const assert = (condition, message) => { if (!condition) throw new Error(message); };
    const tick = () => new Promise(resolve => window.setTimeout(resolve, 0));
    const key = (input, name) => input.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
    const host = document.createElement('form');
    host.innerHTML = '<label for="coverage-combo">选项</label><select id="coverage-combo" name="choice" required data-searchable-select data-combobox-size="compact"><option value="">请选择</option><option value="a" selected>甲</option><option value="b">乙</option></select><select data-asset-branch aria-label="分支"><option value="">请选择</option><option value="main">main</option></select>';
    document.body.append(host);
    const select = host.querySelector('[name="choice"]');
    let changes = 0;
    select.addEventListener('change', () => { changes += 1; });
    enhanceSearchableSelects(host);
    markDynamicSelects(host);
    const input = select.closest('[data-searchable-combobox]').querySelector('input');
    const listbox = document.getElementById(input.getAttribute('aria-controls'));
    const toggle = select.closest('[data-searchable-combobox]').querySelector('button');
    assert(input.value === '甲' && input.required && input.getAttribute('aria-label') === '选项，可输入筛选', '初始值和可访问名称错误');
    assert(select.closest('[data-searchable-combobox]').dataset.comboboxSize === 'compact', '尺寸投影错误');

    input.focus();
    assert(!listbox.hidden && listbox.querySelectorAll('[role="option"]').length === 2, '聚焦应展开所有候选');
    key(input, 'End');
    key(input, 'Home');
    key(input, 'ArrowDown');
    key(input, 'ArrowUp');
    key(input, 'End');
    key(input, 'Enter');
    assert(select.value === 'b' && input.value === '乙' && changes === 1 && listbox.hidden, '键盘选择未回写原生表单');

    input.value = '不存在';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    assert(select.value === '' && listbox.textContent.includes('没有匹配选项') && input.validationMessage, '无匹配选项应提示并要求有效选择');
    key(input, 'ArrowDown');
    input.value = '甲';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    assert(listbox.querySelectorAll('[role="option"]').length === 1, '筛选结果错误');
    key(input, 'Home');
    key(input, 'Enter');
    assert(select.value === 'a' && changes === 2 && !input.validationMessage, '筛选后选择未清除校验错误');

    toggle.click();
    assert(!listbox.hidden, '切换按钮未展开候选');
    key(input, 'Escape');
    assert(listbox.hidden && input.value === '甲', 'Escape 未恢复已选值');
    toggle.click();
    key(input, 'Tab');
    assert(listbox.hidden, 'Tab 未关闭候选');
    toggle.click();
    toggle.click();
    assert(listbox.hidden, '再次点击切换按钮未关闭候选');

    const branch = host.querySelector('[data-asset-branch]');
    const branchInput = branch.closest('[data-searchable-combobox]').querySelector('input');
    const branchListbox = document.getElementById(branchInput.getAttribute('aria-controls'));
    toggle.click();
    branchInput.focus();
    assert(listbox.hidden && !branchListbox.hidden, '第二个组合框应关闭第一个');
    document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    assert(branchListbox.hidden, '外部点击未关闭候选');

    select.value = 'b';
    syncSearchableSelect(select);
    assert(input.value === '乙', '外部赋值后可见值未同步');
    host.reset();
    await tick();
    assert(select.value === 'a' && input.value === '甲', '表单重置后可见值未恢复');
    select.dataset.comboboxSize = 'full';
    select.append(new Option('丙', 'c'));
    await tick();
    assert(select.closest('[data-searchable-combobox]').dataset.comboboxSize === 'full', '动态尺寸未同步');
    toggle.click();
    assert(listbox.querySelectorAll('[role="option"]').length === 3, '新增候选未进入列表');
    document.dispatchEvent(new Event('scroll', { bubbles: true }));
    window.dispatchEvent(new Event('resize'));
    await new Promise(resolve => window.requestAnimationFrame(resolve));
    select.disabled = true;
    await tick();
    assert(input.disabled, '原生禁用状态未同步');
    toggle.click();
    assert(listbox.hidden, '禁用状态不应展开候选');

    const dialog = document.createElement('dialog');
    dialog.innerHTML = '<label>弹窗选项<select data-searchable-select><option value="x">X</option></select></label>';
    document.body.append(dialog);
    enhanceSearchableSelects(dialog);
    const dialogListbox = document.getElementById(dialog.querySelector('input').getAttribute('aria-controls'));
    assert(dialog.contains(dialogListbox), '弹框候选应挂载在弹框内');
    host.remove();
    dialog.remove();
    cleanupSearchableSelects();
    assert(!listbox.isConnected && !branchListbox.isConnected && !dialogListbox.isConnected, '移除表单后候选列表未清理');
  });
}

async function exerciseDirectoryTree(page) {
  await page.evaluate(async () => {
    const { renderDirectoryTree, enhanceDirectoryTrees } = await import('/knowledge-center/common/directory-tree.js');
    const assert = (condition, message) => { if (!condition) throw new Error(message); };
    renderDirectoryTree([{ id: 'empty-default', children: [] }]);
    renderDirectoryTree([{ id: 'hidden-empty' }], { childrenOf: () => [], isLeaf: () => false, hideEmptyDirectories: true });
    const host = document.createElement('section');
    host.innerHTML = `<input data-directory-search aria-label="搜索目录"><div data-directory-tree></div>`;
    document.body.append(host);
    const tree = host.querySelector('[data-directory-tree]');
    tree.innerHTML = renderDirectoryTree([
      { id: 'root', name: '根目录', children: [{ id: 'leaf', name: '安装指南' }, { id: 'empty', name: '空目录', children: [] }] },
      { id: 'second', name: '第二目录', children: [{ id: 'deep', name: '深层', children: [{ id: 'page', name: '连接配置' }] }] },
    ], {
      directoryClass: 'coverage-directory', listClass: 'coverage-tree',
      renderLeaf: node => `<li><button type="button" data-tree-item="${node.id}">${node.name}</button></li>`,
      openDirectory: node => node.id === 'root', hideEmptyDirectories: true,
    });
    enhanceDirectoryTrees(host);
    await new Promise(resolve => requestAnimationFrame(resolve));
    const search = host.querySelector('[data-directory-search]');
    const first = host.querySelector('[role="treeitem"]');
    assert(first && first.getAttribute('aria-level') === '1', '目录树初始可访问层级错误');
    first.focus();
    const key = name => first.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
    key('ArrowRight'); key('ArrowDown'); key('ArrowLeft'); key('ArrowUp'); key('Home'); key('End'); key('Enter'); key(' '); key('Escape');
    const rootSummary = host.querySelector('li[data-directory-key="root"] > details > summary');
    const rootDetails = rootSummary.parentElement;
    rootDetails.open = false;
    rootSummary.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    rootSummary.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    rootSummary.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
    host.querySelector('[data-tree-item="leaf"]')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
    search.value = '连接'; search.dispatchEvent(new Event('input', { bubbles: true }));
    assert(host.querySelectorAll('li:not([hidden])').length >= 1, '目录树搜索未保留匹配节点');
    search.value = ''; search.dispatchEvent(new Event('input', { bubbles: true }));
    assert(!host.querySelector('li[data-directory-key="root"]').hidden, '清空目录树搜索未恢复节点');
    const alternate = document.createElement('div');
    alternate.dataset.directoryTree = '';
    alternate.innerHTML = renderDirectoryTree([{ id: 'fallback' }], { treeRole: false, hideEmptyDirectories: false,
      childrenOf: () => null, isLeaf: () => false, nodeKey: () => 'fallback',
      renderDirectoryLabel: () => '<button type="button">交互目录</button>', openDirectory: () => false });
    const alternateSearch = document.createElement('input');
    alternateSearch.dataset.directorySearch = '';
    alternate.prepend(alternateSearch);
    host.append(alternate);
    enhanceDirectoryTrees(alternate);
    enhanceDirectoryTrees(alternate);
    alternateSearch.value = '无结果';
    alternateSearch.dispatchEvent(new Event('input', { bubbles: true }));
    assert(alternate.querySelector('ul')?.getAttribute('role') === null, 'treeRole=false 未生效');
    const noSearchTree = document.createElement('div');
    noSearchTree.dataset.directoryTree = '';
    noSearchTree.innerHTML = '<input data-directory-search><ul><li><button data-tree-item="plain">无搜索叶节点</button></li></ul>';
    host.append(noSearchTree);
    enhanceDirectoryTrees(noSearchTree);
    noSearchTree.querySelector('[data-directory-search]').value = '叶节点';
    noSearchTree.querySelector('[data-directory-search]').dispatchEvent(new Event('input', { bubbles: true }));
    noSearchTree.querySelector('button').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    host.remove();
  });
}

async function exerciseResizableNavigation(page) {
  await page.evaluate(async () => {
    const { enhanceResizableNavigation, getNavigationPaneState } = await import('/knowledge-center/common/resizable-navigation-pane.js');
    const assert = (condition, message) => { if (!condition) throw new Error(message); };
    const host = document.createElement('section');
    host.innerHTML = '<div data-navigation-layout data-navigation-layout-id="coverage-pane" data-navigation-min="180" data-navigation-max="420" data-navigation-default="300" data-navigation-pane-label="大纲"><button data-navigation-pane-toggle><i data-lucide="panel-left-close"></i></button><div data-navigation-pane-resizer></div></div>';
    document.body.append(host);
    const root = host.firstElementChild;
    const handle = root.querySelector('[data-navigation-pane-resizer]');
    root.getBoundingClientRect = () => ({ left: 10, width: 300 });
    localStorage.setItem('knowledge-center-navigation-pane:coverage-pane', '{bad');
    const changes = [];
    root.addEventListener('knowledge-center:navigation-pane-change', event => changes.push(event.detail));
    enhanceResizableNavigation(root);
    enhanceResizableNavigation(root);
    assert(getNavigationPaneState(root)?.width === 300, '导航面板默认宽度错误');
    handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 1, clientX: 200 }));
    handle.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, clientX: 380 }));
    handle.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, clientX: 380 }));
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', shiftKey: true, bubbles: true, cancelable: true }));
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 2, clientX: 200 }));
    handle.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 2, clientX: 250 }));
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 3, clientX: 200 }));
    handle.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 3 }));
    handle.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    root.querySelector('[data-navigation-pane-toggle]').click();
    assert(getNavigationPaneState(root).collapsed, '折叠按钮未更新状态');
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
    root.querySelector('[data-navigation-pane-toggle]').click();
    assert(!getNavigationPaneState(root).collapsed && changes.some(item => item.committed), '导航面板提交状态未记录');
    host.remove();
  });
}

async function exerciseScrollRuntime(page) {
  await page.evaluate(async () => {
    const { getScrollOwner, inspectScrollRegion, inspectScrollContract, initScrollRuntime } = await import('/knowledge-center/common/scroll-runtime.js');
    const assert = (condition, message) => { if (!condition) throw new Error(message); };
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const doc = frame.contentDocument;
    const win = frame.contentWindow;
    doc.open();
    doc.write('<!doctype html><html><body><div id="app-shell"><main data-scroll-owner="main"><div data-scroll-region="panel"><div data-scroll-obstacle>固定工具栏</div><button id="target">目标</button></div></main></div></body></html>');
    doc.close();
    doc.documentElement.dataset.scrollMode = 'main';
    const shell = doc.getElementById('app-shell');
    const main = doc.querySelector('[data-scroll-owner="main"]');
    const region = doc.querySelector('[data-scroll-region]');
    const obstacle = doc.querySelector('[data-scroll-obstacle]');
    Object.defineProperties(shell, { clientHeight: { value: 700 }, scrollHeight: { value: 700 } });
    Object.defineProperties(main, { clientHeight: { value: 600 }, scrollHeight: { value: 1200 }, scrollTop: { value: 0, writable: true } });
    Object.defineProperties(region, { clientHeight: { value: 200 }, scrollHeight: { value: 500 }, scrollTop: { value: 0, writable: true } });
    shell.getBoundingClientRect = () => ({ height: 700, top: 0, bottom: 700 });
    main.getBoundingClientRect = () => ({ height: 600, top: 0, bottom: 600 });
    region.getBoundingClientRect = () => ({ height: 200, top: 40, bottom: 240 });
    obstacle.getBoundingClientRect = () => ({ height: 32, top: 0, bottom: 32 });
    const target = doc.getElementById('target');
    let scrolled = 0;
    target.getBoundingClientRect = () => ({ top: 0, bottom: 400 });
    target.scrollIntoView = () => { scrolled += 1; };
    region.getClientRects = () => [{ width: 200, height: 200 }];
    win.matchMedia = query => ({ matches: query.includes('min-width') || query.includes('max-width') === false, media: query, addEventListener() {}, removeEventListener() {} });
    win.innerHeight = 800;
    const owner = getScrollOwner(doc);
    assert(owner === main && inspectScrollRegion(region).overflow, '滚动所有者或区域检测错误');
    assert(inspectScrollRegion(null) === null, '空滚动区域应返回空结果');
    inspectScrollContract(doc);
    region.style.overflow = 'hidden';
    assert(inspectScrollContract(doc).issues.includes('声明的局部滚动区域不可滚动'), '不可滚动区域未进入诊断');
    region.style.overflow = 'auto';
    assert(inspectScrollContract(doc, { scanUndeclared: false }).owner.element === 'main', '滚动契约检查错误');
    const runtime = initScrollRuntime({ window: win, document: doc });
    await new Promise(resolve => win.requestAnimationFrame(resolve));
    doc.dispatchEvent(new win.FocusEvent('focusin', { bubbles: true, target }));
    target.dispatchEvent(new win.Event('focusin', { bubbles: true }));
    assert(scrolled >= 1, '焦点进入超出区域时未滚动');
    region.setAttribute('data-scroll-obstacle', '');
    win.dispatchEvent(new win.Event('resize'));
    win.dispatchEvent(new win.Event('kc-viewport-changed'));
    await new Promise(resolve => win.requestAnimationFrame(resolve));
    runtime.refresh({ diagnose: false });
    win.dispatchEvent(new win.Event('resize'));
    runtime.destroy();
    frame.remove();
  });
}

async function exerciseDismissibleMenus(page) {
  await page.evaluate(async () => {
    const { initDismissibleMenus } = await import('/knowledge-center/common/dismissible-menu.js');
    const assert = (condition, message) => { if (!condition) throw new Error(message); };
    const root = document.createElement('section');
    root.innerHTML = `<details data-dismissible-menu><summary>菜单一</summary><div>内容一</div></details><details data-dismissible-menu><summary>菜单二</summary><div>内容二</div></details><details data-dismissible-menu><summary>组合框菜单</summary><div data-searchable-combobox><input aria-expanded="true"></div></details><dialog><details data-dismissible-menu><summary>对话框菜单</summary><div>对话框内容</div></details></dialog><button id="outside-menu">外部</button>`;
    document.body.append(root);
    const runtime = initDismissibleMenus(root);
    assert(initDismissibleMenus(root) === runtime, '重复初始化未复用菜单运行时');
    const menus = [...root.querySelectorAll('details[data-dismissible-menu]')];
    menus[0].open = true; menus[1].open = true;
    menus[0].dispatchEvent(new Event('toggle', { bubbles: true }));
    assert(menus[1].open === false, '打开菜单未关闭其他菜单');
    menus[0].open = true;
    menus[0].querySelector('summary').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    assert(menus[0].open, '菜单自身 pointerdown 不应提前关闭');
    document.getElementById('outside-menu').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    assert(!menus[0].open, '外部 pointerdown 未关闭菜单');
    menus[0].open = true;
    menus[0].querySelector('summary').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    assert(!menus[0].open && document.activeElement === menus[0].querySelector('summary'), 'Escape 未关闭并恢复焦点');
    menus[2].open = true;
    menus[2].querySelector('input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    assert(menus[2].open, '组合框 Escape 不应关闭父菜单');
    const dialog = root.querySelector('dialog');
    dialog.showModal();
    const dialogMenu = dialog.querySelector('details');
    dialogMenu.open = true;
    menus[1].open = true;
    dialogMenu.querySelector('summary').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    assert(!dialogMenu.open, '对话框内 Escape 未关闭菜单');
    dialog.close();
    runtime.destroy();
    root.remove();
  });
}

async function exerciseViewportRuntime(page) {
  await page.evaluate(async () => {
    const { initViewportRuntime } = await import('/knowledge-center/common/viewport-runtime.js');
    const assert = (condition, message) => { if (!condition) throw new Error(message); };
    const makeDocument = () => {
      const frame = document.createElement('iframe'); document.body.append(frame);
      const doc = frame.contentDocument; doc.open(); doc.write('<!doctype html><html><body></body></html>'); doc.close();
      return { frame, doc, win: frame.contentWindow };
    };
    const fallback = makeDocument();
    fallback.win.innerHeight = 640;
    fallback.win.CSS = { supports: () => false };
    Object.defineProperty(fallback.win, 'visualViewport', { configurable: true, value: { scale: 1, height: 620, addEventListener() {}, removeEventListener() {} } });
    const events = []; fallback.win.addEventListener('kc-viewport-changed', () => events.push('changed'));
    const runtime = initViewportRuntime({ window: fallback.win, document: fallback.doc });
    assert(fallback.doc.documentElement.dataset.viewportSource === 'measured' && fallback.doc.documentElement.style.getPropertyValue('--kc-viewport-height') === '620px', '不支持 dvh 时未测量视口高度');
    const count = events.length;
    fallback.win.visualViewport.height = 620; runtime.update();
    assert(events.length === count, '相同视口高度重复触发变更事件');
    fallback.win.visualViewport.scale = 1.2; fallback.win.visualViewport.height = 500; runtime.update();
    assert(fallback.doc.documentElement.style.getPropertyValue('--kc-viewport-height') === '640px', '缩放视口应回退到 innerHeight');
    fallback.win.innerHeight = 0; fallback.win.visualViewport.scale = 1; fallback.win.visualViewport.height = 0; runtime.update();
    assert(fallback.doc.documentElement.style.getPropertyValue('--kc-viewport-height') === '640px', '无效高度不应覆盖最近有效值');
    runtime.destroy();
    assert(!fallback.doc.documentElement.dataset.viewportSource && !fallback.doc.documentElement.style.getPropertyValue('--kc-viewport-height'), '销毁未清理测量 token');
    fallback.frame.remove();

    const native = makeDocument();
    native.win.innerHeight = 700;
    native.win.CSS = { supports: () => true };
    Object.defineProperty(native.win, 'visualViewport', { configurable: true, value: { scale: 1, height: 700, addEventListener() {}, removeEventListener() {} } });
    const createElement = native.doc.createElement.bind(native.doc);
    native.doc.createElement = name => {
      const element = createElement(name);
      if (name === 'div') element.getBoundingClientRect = () => ({ height: 700 });
      return element;
    };
    const nativeRuntime = initViewportRuntime({ window: native.win, document: native.doc });
    assert(native.doc.documentElement.dataset.viewportSource === 'native', '支持 dvh 且高度一致时应使用原生视口');
    assert(native.doc.documentElement.style.getPropertyValue('--kc-viewport-height') === '', '原生视口初始状态不应留下测量 token');
    nativeRuntime.destroy(); native.frame.remove();

    const transition = makeDocument();
    transition.win.innerHeight = 680;
    transition.win.CSS = { supports: () => true };
    Object.defineProperty(transition.win, 'visualViewport', { configurable: true, value: { scale: 1, height: 680, addEventListener() {}, removeEventListener() {} } });
    const transitionCreateElement = transition.doc.createElement.bind(transition.doc);
    let nativeHeight = 0;
    transition.doc.createElement = name => {
      const element = transitionCreateElement(name);
      if (name === 'div') element.getBoundingClientRect = () => ({ height: nativeHeight });
      return element;
    };
    const transitionRuntime = initViewportRuntime({ window: transition.win, document: transition.doc });
    assert(transition.doc.documentElement.style.getPropertyValue('--kc-viewport-height') === '680px', '原生视口高度不匹配时应先建立测量 token');
    nativeHeight = 680;
    transitionRuntime.update();
    assert(transition.doc.documentElement.dataset.viewportSource === 'native'
      && transition.doc.documentElement.style.getPropertyValue('--kc-viewport-height') === '', '原生视口接管后应移除测量 token');
    transitionRuntime.destroy(); transition.frame.remove();

    const pending = makeDocument();
    pending.win.innerHeight = 640;
    pending.win.CSS = { supports: () => false };
    let cancelledFrame = null;
    pending.win.requestAnimationFrame = callback => { pending.pendingCallback = callback; return 73; };
    pending.win.cancelAnimationFrame = id => { cancelledFrame = id; };
    const pendingRuntime = initViewportRuntime({ window: pending.win, document: pending.doc });
    pending.win.dispatchEvent(new pending.win.Event('resize'));
    pendingRuntime.destroy();
    assert(cancelledFrame === 73 && typeof pending.pendingCallback === 'function', '销毁时应取消尚未执行的视口更新帧');
    pending.frame.remove();
  });
}

async function exerciseDatabaseEnhancer(page) {
  await page.evaluate(async () => {
    const { enhanceDatabaseMarkdown } = await import('/knowledge-center/common/markdown/database-enhancer.js');
    const assert = (condition, message) => { if (!condition) throw new Error(message); };
    const enhanced = enhanceDatabaseMarkdown('<p>SELECT max_connections YAS-1234</p><pre class="repository-code"><code class="language-sql">SELECT 1</code></pre>');
    assert(enhanced.hits.some(hit => hit.id === 'sql.select')
      && enhanced.hits.some(hit => hit.id === 'parameter.max_connections')
      && enhanced.hits.some(hit => hit.id === 'error.code'), '数据库正文语义标记未识别 SQL、参数和错误码');
    assert(enhanced.html.includes('db-code-block') && enhanced.html.includes('data-db-code-language="sql"')
      && enhanced.html.includes('data-db-code-lines="1"'), '代码块未生成复制工具栏');
    const marked = '<p><mark class="existing">SELECT</mark></p>';
    assert(enhanceDatabaseMarkdown(marked).html === marked, '已有标记的正文不应重复标注');
    const inline = '<p><strong>SELECT</strong></p>';
    assert(enhanceDatabaseMarkdown(inline).html === inline, '内联 Markdown 结构不应被语义标记改写');
    const warnings = [];
    const originalWarn = console.warn;
    try {
      console.warn = (...args) => warnings.push(args);
      const unmatched = '<pre class="repository-code" data-scroll-region="panel"><code class="language-sql">SELECT 1</code></pre>';
      assert(enhanceDatabaseMarkdown(unmatched).html === unmatched && warnings.length === 1
        && warnings[0][1].unenhancedCodeBlockCount === 1, '未匹配代码块应保留原文并报告诊断');
    } finally {
      console.warn = originalWarn;
    }
  });
}

async function exerciseProductionProvenance(page) {
  await page.evaluate(async () => {
    const { renderProductionProvenance } = await import('/knowledge-center/modules/production/production-provenance.js');
    const assert = (condition, message) => { if (!condition) throw new Error(message); };
    const host = document.createElement('div');
    document.body.append(host);
    const markdown = '直接引用段落，推理段落。';
    const sourceSnapshots = [
      { sourceId: 'versioned', title: '版本资料', locator: 'docs/versioned.md', sourceVersion: 'v2', content: '原文资料', fetchedAt: '2026-01-01' },
      { sourceId: 'dated', title: '', locator: 'docs/dated.md', content: '日期资料', fetchedAt: '2026-01-02' },
    ];
    const metadata = {
      taskId: 'task-1', model: '', generatedAt: '2026-01-03', verification: 'needs_revalidation',
      provenanceHistory: [{ taskId: 'previous' }],
      sourceSnapshots,
      provenance: [
        { kind: 'direct_quote', verification: 'text_matched', start: 0, end: 5,
          evidence: [{ sourceId: 'versioned', start: 0, end: 4 }], issue: true },
        { kind: 'source_summary', verification: 'unverified', start: 6, end: 10,
          evidence: [{ sourceId: 'dated', start: 0, end: 2 }] },
        { kind: 'model_inference', verification: 'needs_revalidation', start: 11, end: 14, evidence: [] },
        { kind: 'future_kind', verification: 'future_state', start: 0, end: 2,
          evidence: [{ sourceId: 'missing', start: 0, end: 1 }] },
      ],
    };
    host.innerHTML = renderProductionProvenance(metadata, markdown);
    const html = host.innerHTML;
    assert(html.includes('<summary>内容依据与生成记录</summary>'), '默认标题未应用');
    assert(html.includes('任务 task-1') && html.includes('模型未记录'), '元信息缺省分支错误');
    assert(html.includes('正文已变化，旧质量与测试结论需重新核验。'), '重新核验提示缺失');
    assert(html.includes('版本 v2 · 拉取于 2026-01-01'), '来源版本分支错误');
    assert(html.includes('拉取于 2026-01-02'), '无版本来源时间分支错误');
    assert(html.includes('引用快照缺失，需要重新核验。'), '缺失快照提示缺失');
    assert(html.includes('无可核验来源关联。') && html.includes('来源声明未通过核验'), '空证据或问题标记分支错误');
    assert(html.includes('未知类型') && html.includes('待核验'), '未知类别缺省映射错误');
    assert(renderProductionProvenance(null, markdown) === '', '无元数据应不渲染 provenance');
    const sparse = renderProductionProvenance({
      taskId: '', model: '', generatedAt: '',
      sourceSnapshots: null,
      provenance: [{ kind: 'direct_quote', verification: 'text_matched', start: 0, end: 2, evidence: null }],
      provenanceHistory: null,
    }, markdown);
    assert(sparse.includes('无可核验来源关联。') && sparse.includes('保留历史记录 0 份'), '缺省 provenance/evidence/history 应渲染为空态');
    const emptyProvenance = renderProductionProvenance({
      taskId: 'empty-provenance', model: 'coverage-model', generatedAt: '2026-01-05',
      sourceSnapshots: [], provenance: null, provenanceHistory: [],
    }, markdown);
    assert(emptyProvenance.includes('任务 empty-provenance')
      && emptyProvenance.includes('<ol></ol>')
      && !emptyProvenance.includes('直接引用'), '缺省 provenance 集合应渲染为空列表');
    const unmatched = renderProductionProvenance({
      sourceSnapshots: [{ sourceId: 'known', title: '已知资料', locator: 'known.md', content: '已知', fetchedAt: '2026-01-04' }],
      provenance: [{ kind: 'source_summary', verification: 'unverified', start: 0, end: 2, evidence: [{ sourceId: 'unknown', start: 0, end: 2 }] }],
    }, markdown);
    assert(unmatched.includes('引用快照缺失，需要重新核验。'), '来源匹配失败应保留缺失快照提示');
    host.remove();
  });
}

async function exerciseAuthController(page) {
  await page.evaluate(async () => {
    const auth = await import('/knowledge-center/common/auth/auth-controller.js');
    const { authState } = await import('/knowledge-center/common/state/auth-state.js');
    const assert = (condition, message) => { if (!condition) throw new Error(message); };
    const originalFetch = window.fetch;
    const originalUrl = window.location.pathname + window.location.search + window.location.hash;
    const originalAuthState = { ...authState };
    const response = (status, body) => ({ ok: status >= 200 && status < 300, status, headers: new Headers(), json: async () => body });
    let mode = 'anonymous';
    window.fetch = async (input, options) => {
      const path = new URL(input, window.location.href).pathname;
      if (!path.startsWith('/knowledge-center/api/auth/')) return originalFetch(input, options);
      if (path.endsWith('/auth/config')) {
        if (mode === 'config-error') return response(503, { error: { message: 'config offline' } });
        return response(200, { data: { casEnabled: true, loginUrl: '/cas/login', serviceId: 'kc-service', serviceUrl: '/callback' } });
      }
      if (path.endsWith('/auth/session')) {
        if (mode === 'session-error') return response(401, { error: { message: 'expired' } });
        if (mode === 'session-unavailable') return response(503, { error: { message: 'session unavailable' } });
        if (mode === 'authenticated' || mode === 'config-error') return response(200, { data: { authenticated: true, user: { id: 'coverage' }, allowedActions: ['knowledge:read'] } });
        if (mode === 'cas-success') return response(200, { data: { authenticated: true, user: { id: 'cas-coverage' } } });
        if (mode === 'admin-login-refresh') return response(200, { data: { authenticated: true, user: { id: 'admin-refresh' } } });
        return response(200, { data: { authenticated: false } });
      }
      if (path.endsWith('/auth/cas/callback')) return mode === 'cas-failure'
        ? response(400, { error: { message: 'ticket rejected' } }) : response(200, { data: { success: true } });
      if (path.endsWith('/auth/admin/login')) {
        if (mode === 'admin-login-error') return response(401, { error: { message: 'credentials rejected' } });
        return mode === 'admin-login-refresh'
          ? response(200, { data: {} }) : response(200, { data: { authenticated: true, user: { id: 'admin-login' } } });
      }
      if (path.endsWith('/auth/logout')) return mode === 'logout-error'
        ? response(503, { error: { message: 'logout unavailable' } })
        : response(200, { data: mode === 'logout-cas' ? { logoutMode: 'cas', logoutUrl: '#cas-logout' }
          : mode === 'logout-redirect' ? { redirectToCas: true, logoutUrl: '#cas-redirect' } : { logoutMode: 'local' } });
      return originalFetch(input, options);
    };
    try {
      assert(auth.sanitizeReturnTo(null) === '/knowledge-center/', '空返回地址未使用安全默认值');
      assert(auth.sanitizeReturnTo('http://[') === '/knowledge-center/', '非法返回地址未使用安全默认值');
      mode = 'anonymous';
      assert(await auth.bootstrapAuth() === null && authState.status === 'anonymous', '匿名 bootstrap 状态错误');
      mode = 'authenticated';
      assert((await auth.bootstrapAuth())?.user.id === 'coverage', '已登录会话恢复失败');
      mode = 'session-error';
      assert(await auth.bootstrapAuth() === null && authState.status === 'anonymous' && authState.error === null, '401 会话回退状态错误');
      mode = 'session-unavailable';
      assert(await auth.bootstrapAuth() === null && authState.status === 'anonymous'
        && authState.error?.status === 503, '会话服务故障未保留诊断错误');
      mode = 'config-error';
      assert((await auth.bootstrapAuth())?.user.id === 'coverage' && authState.config === null, '认证配置失败不应阻止有效会话恢复');
      history.replaceState(history.state, '', '/knowledge-center/?ticket=config-error-ticket');
      assert((await auth.bootstrapAuth())?.user.id === 'coverage' && authState.config === null
        && !location.search.includes('ticket'), 'CAS 回调配置失败时未继续恢复会话并清理 ticket');
      history.replaceState(history.state, '', '/knowledge-center/?ticket=coverage-ticket&keep=1');
      mode = 'cas-success';
      assert((await auth.bootstrapAuth())?.user.id === 'cas-coverage' && !location.search.includes('ticket'), 'CAS 成功未清理 ticket 或恢复会话');
      history.replaceState(history.state, '', '/knowledge-center/?ticket=bad-ticket');
      mode = 'cas-failure';
      assert(await auth.bootstrapAuth() === null && authState.status === 'anonymous' && !location.search.includes('ticket'), 'CAS 失败未清票或回到匿名状态');
      history.replaceState(history.state, '', '/knowledge-center/?ticket=anonymous-ticket');
      mode = 'cas-anonymous';
      assert(await auth.bootstrapAuth() === null && authState.status === 'anonymous' && !location.search.includes('ticket'), 'CAS 成功但未认证时未清票或保持匿名');
      mode = 'admin-login-complete';
      assert((await auth.submitAdminLogin({ username: 'admin', password: 'secret' }))?.user.id === 'admin-login', '管理员登录完整会话未直接恢复');
      mode = 'admin-login-refresh';
      assert((await auth.submitAdminLogin({ username: 'admin', password: 'secret' }))?.user.id === 'admin-refresh', '管理员登录缺少会话时未刷新会话');
      mode = 'admin-login-error';
      try { await auth.submitAdminLogin({ username: 'admin', password: 'wrong' }); throw new Error('管理员登录错误未抛出'); }
      catch (error) { assert(error.message !== '管理员登录错误未抛出', '管理员登录错误未抛出'); }
      authState.config = { casEnabled: false, loginUrl: '/cas/login' };
      try { auth.startCasLogin(); throw new Error('禁用统一认证仍允许跳转'); }
      catch (error) { assert(error.message !== '禁用统一认证仍允许跳转', '禁用统一认证仍允许跳转'); }
      authState.config = { casEnabled: true, loginUrl: '' };
      try { auth.startCasLogin(); throw new Error('缺少登录地址仍允许跳转'); }
      catch (error) { assert(error.message !== '缺少登录地址仍允许跳转', '缺少登录地址仍允许跳转'); }
      authState.config = { casEnabled: true, loginUrl: '#cas-login' };
      auth.startCasLogin();
      await new Promise(resolve => setTimeout(resolve, 0));
      assert(location.hash === '#cas-login' && authState.status === 'redirecting'
        && sessionStorage.getItem('knowledge-center-return-to') === '/knowledge-center/', '统一认证登录未记录目标或进入跳转状态');
      sessionStorage.setItem('knowledge-center-return-to', '/knowledge-center/?keep=1');
      mode = 'logout-error';
      try { await auth.performLogout(); throw new Error('退出请求错误未抛出'); }
      catch (error) { assert(error.message !== '退出请求错误未抛出', '退出请求错误未抛出'); }
      mode = 'admin-login-complete';
      assert(await auth.performLogout() === false && authState.status === 'anonymous' && !sessionStorage.getItem('knowledge-center-return-to'), '本地退出未清理会话和记忆目标');
      mode = 'logout-cas';
      assert(await auth.performLogout() === true, '统一认证退出未返回跳转结果');
      await new Promise(resolve => setTimeout(resolve, 0));
      assert(location.hash === '#cas-logout', '统一认证退出未执行跳转');
      mode = 'logout-redirect';
      assert(await auth.performLogout() === true, '显式统一认证退出未返回跳转结果');
      await new Promise(resolve => setTimeout(resolve, 0));
      assert(location.hash === '#cas-redirect', '显式统一认证退出未执行跳转');
      const safeTarget = auth.currentSafeTarget();
      auth.rememberCurrentTarget();
      assert(auth.consumeRememberedTarget() === safeTarget, '安全返回地址暂存/消费失败');
    } finally {
      window.fetch = originalFetch;
      history.replaceState(history.state, '', originalUrl);
      sessionStorage.removeItem('knowledge-center-return-to');
      Object.assign(authState, originalAuthState);
    }
  });
}

async function exerciseHandbookWritingEntry(page) {
  await page.evaluate(async () => {
    const { appState } = await import('/knowledge-center/common/state/app-state.js');
    const assert = (condition, message) => { if (!condition) throw new Error(message); };
    const panel = document.getElementById('error-panel');
    const title = document.getElementById('error-title');
    const message = document.getElementById('error-message');
    const retry = document.getElementById('retry');
    const action = document.getElementById('notice-action');
    const originalFetch = window.fetch;
    const previousNotice = {
      className: panel.className, hidden: panel.hidden, title: title.textContent,
      message: message.textContent, retryHidden: retry.hidden, actionHidden: action.hidden,
      actionHref: action.getAttribute('href'), actionText: action.textContent,
    };
    const previousView = appState.activeView;
    const previousUi = appState.handbookProductionUi;
    const previousUrl = location.pathname + location.search + location.hash;
    const previousHistoryState = history.state;
    const previousOutline = appState.incrementalProjection.handbookOutline;
    const documentId = 'coverage-handbook-document';
    const currentDocument = document.createElement('span');
    currentDocument.dataset.handbookCurrentDocument = documentId;
    document.body.append(currentDocument);
    const button = document.createElement('button');
    button.dataset.handbookAiAction = 'check';
    document.body.append(button);
    const writingHost = document.createElement('div');
    writingHost.className = 'handbook-production-writing';
    document.body.append(writingHost);
    const ui = {
      drafts: {}, draftHtml: {}, draftBranchByDocument: {}, serverDrafts: {}, draftLoadState: {},
      draftSaveState: {}, attachments: {}, references: {}, dirtyDocuments: [], savedDocuments: [],
      selectedForReview: [], modeByDocument: {}, editorFormatByDocument: {}, markdownPreviewByDocument: {},
      directoryOpen: {}, directoryDrawerOpen: false, directoryWidth: 260, directoryCollapsed: false,
      templateByDocument: {}, templateDetails: {}, templateStatus: '', focusMode: false, assistantOpen: false,
      assistantTab: 'ai', assistantStatus: '', reviewers: [], reviewState: null, history: null, conflict: null,
    };
    const click = async operation => {
      button.dataset.handbookAiAction = operation;
      button.click();
      await new Promise(resolve => setTimeout(resolve, 20));
    };
    try {
      appState.activeView = 'production';
      appState.handbookProductionUi = ui;
      history.pushState({ view: 'production', handbookId: 'coverage-handbook' }, '',
        `/knowledge-center/production/handbook/coverage-handbook?documentId=${encodeURIComponent(documentId)}`);

      ui.draftLoadState[documentId] = 'loading';
      await click('check');
      assert(!panel.hidden && title.textContent === '需要先保存草稿'
        && message.textContent.includes('请先保存当前正文'), '未就绪草稿的检查入口未提示先保存');

      ui.draftLoadState[documentId] = 'ready';
      ui.drafts[documentId] = '# 本地未保存正文';
      await click('check');
      assert(title.textContent === '需要先保存草稿', '未保存修订的检查入口未阻止检查');

      ui.draftLoadState[documentId] = 'failed';
      await click('generate');
      assert(title.textContent === '暂时无法生成'
        && message.textContent.includes('请等待共享草稿读取完成'), '草稿读取失败时生成入口未提示等待');

      ui.draftLoadState[documentId] = 'ready';
      const existingPage = document.createElement('section');
      existingPage.className = 'handbook-writing-page';
      document.body.append(existingPage);
      await click('generate');
      assert(document.querySelectorAll('.handbook-writing-page').length === 1,
        '已有写作页时再次打开生成入口创建了新页面');
      existingPage.remove();

      const savedMarkdown = '# 已保存正文';
      ui.serverDrafts[documentId] = { draft: { editVersion: 4, revision: { revisionId: 'revision-4', markdown: savedMarkdown } } };
      ui.drafts[documentId] = savedMarkdown;
      button.dataset.handbookAiAction = 'check';
      button.click();
      let dialog = null;
      for (let attempt = 0; attempt < 50 && !dialog; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 20));
        dialog = document.querySelector('.handbook-ai-dialog[open]');
      }
      assert(dialog?.querySelector('#production-quality-title')?.textContent === '文档用例质量报告'
        && dialog.querySelector('[data-quality-run]'), `匹配已保存版本的检查入口未打开质量报告：${title.textContent} / ${message.textContent}`);
      dialog.close();
      for (let attempt = 0; attempt < 50 && document.querySelector('.handbook-ai-dialog'); attempt++)
        await new Promise(resolve => setTimeout(resolve, 20));
      assert(!document.querySelector('.handbook-ai-dialog'), '关闭质量报告后弹窗未清理');

      const requests = [];
      let originMode = 'race';
      window.fetch = async input => {
        const url = new URL(typeof input === 'string' ? input : input.url, location.origin);
        const method = typeof input === 'string' ? 'GET' : (input.method || 'GET').toUpperCase();
        requests.push({ pathname: url.pathname, method });
        let data = {};
        if (url.pathname.endsWith('/mappings/coverage-handbook')) {
          if (originMode === 'race') {
            ui.drafts[documentId] = '# 检查来源时修改的正文';
            return new Response(JSON.stringify({ success: false, error: {
              code: 'GITLAB_MAPPING_NOT_FOUND', message: '手册仓库映射不存在',
            } }), { status: 404, headers: { 'content-type': 'application/json' } });
          }
          data = { connectionId: 'coverage-connection', project: 'group/docs', defaultBranch: 'main',
            enabledBranches: ['main'], zhPaths: ['docs'] };
        }
        else if (url.pathname.endsWith('/access-status') && originMode === 'oauth')
          data = { canRead: false, nextAction: 'connect_gitlab', connectionId: 'coverage-connection',
            connectionName: '覆盖率仓库', project: 'group/docs', message: '请授权 GitLab 账号' };
        if (url.pathname.endsWith('/production/models')) data = {
          options: [{ serviceId: 'coverage-service', model: 'coverage-model' }],
          defaultSelection: { serviceId: 'coverage-service', model: 'coverage-model' },
        };
        else if (url.pathname.endsWith('/api/templates')) data = [{ id: 'coverage-template', name: '覆盖率模板', status: 'active' }];
        else if (url.pathname.endsWith('/ai-jobs')) data = [];
        else if (url.pathname.endsWith('/ai-skills')) data = { items: [] };
        else if (url.pathname.endsWith('/ai-sources')) data = { items: [], referenceListCollapsedCount: 0 };
        return new Response(JSON.stringify({ success: true, data }), {
          status: 200, headers: { 'content-type': 'application/json' },
        });
      };
      ui.editorFormatByDocument[documentId] = 'markdown';
      ui.templateByDocument[documentId] = 'coverage-template';
      await click('generate');
      let writingPage = null;
      for (let attempt = 0; attempt < 50 && !writingPage; attempt++) {
        writingPage = document.querySelector('.handbook-writing-page:not([hidden])');
        if (!writingPage) await new Promise(resolve => setTimeout(resolve, 20));
      }
      assert(writingPage && !writingPage.hidden, '草稿就绪时生成入口未挂载嵌入式写作页');
      assert(requests.some(request => request.pathname === '/knowledge-center/api/production/models')
        && requests.some(request => request.pathname === '/knowledge-center/api/templates'),
      `写作页未读取模型和模板目录：${JSON.stringify(requests)}`);
      const waitForWritingEditor = async writing => {
        const settled = () => writing.querySelector('[data-ai-mode-rich]')?.disabled === false
          || writing.querySelector('[data-ai-status]')?.textContent.includes('富文本编辑器暂不可用');
        for (let attempt = 0; attempt < 100 && !settled(); attempt++)
          await new Promise(resolve => setTimeout(resolve, 20));
        assert(settled(), '写作页编辑器尚未初始化或完成 Markdown 回退');
      };
      await waitForWritingEditor(writingPage);
      const start = writingPage.querySelector('[data-ai-start]');
      for (let attempt = 0; attempt < 50 && start.disabled; attempt++)
        await new Promise(resolve => setTimeout(resolve, 20));
      assert(!start.disabled, `写作页目录加载完成后生成按钮仍禁用：${start.title}`);
      start.click();
      for (let attempt = 0; attempt < 100 && !writingPage.textContent.includes('工作台正文已变化'); attempt++)
        await new Promise(resolve => setTimeout(resolve, 20));
      assert(writingPage.textContent.includes('工作台正文已变化'),
        `来源检查后未阻止覆盖异步期间的人工修改：${writingPage.querySelector('[data-ai-status]')?.textContent}`);
      assert(requests.some(request => request.pathname.includes('/gitlab/mappings/'))
        && !requests.some(request => request.pathname.endsWith('/ai-jobs') && request.method === 'POST'),
      `来源检查应读取未配置映射且不得提交生成任务：${JSON.stringify(requests)}`);
      const closeButton = writingPage.querySelector('[data-ai-close]');
      let closeError = '';
      let closeInvoked = false;
      const closeHandler = closeButton?.onclick;
      if (closeButton && closeHandler) closeButton.onclick = event => {
        closeInvoked = true;
        try { return closeHandler.call(closeButton, event); }
        catch (error) { closeError = error.message; }
      };
      closeButton?.click();
      for (let attempt = 0; attempt < 50 && document.querySelector('.handbook-writing-page'); attempt++)
        await new Promise(resolve => setTimeout(resolve, 20));
      assert(!document.querySelector('.handbook-writing-page'),
        `关闭嵌入式写作页后页面未清理（closeInvoked=${closeInvoked}, closeError=${closeError || 'none'}, handler=${typeof closeHandler}）：${[...document.querySelectorAll('.handbook-writing-page')].map(node => node.outerHTML.slice(0, 300))}`);

      originMode = 'oauth';
      ui.drafts[documentId] = savedMarkdown;
      requests.length = 0;
      await click('generate');
      writingPage = null;
      for (let attempt = 0; attempt < 50 && !writingPage; attempt++) {
        writingPage = document.querySelector('.handbook-writing-page:not([hidden])');
        if (!writingPage) await new Promise(resolve => setTimeout(resolve, 20));
      }
      assert(writingPage, '授权来源场景没有打开嵌入式写作页');
      await waitForWritingEditor(writingPage);
      const authorizedStart = writingPage.querySelector('[data-ai-start]');
      for (let attempt = 0; attempt < 50 && authorizedStart.disabled; attempt++)
        await new Promise(resolve => setTimeout(resolve, 20));
      assert(!authorizedStart.disabled, '授权来源场景生成按钮未就绪');
      authorizedStart.click();
      for (let attempt = 0; attempt < 100 && writingPage.querySelector('[data-ai-origin-authorize]')?.hidden; attempt++)
        await new Promise(resolve => setTimeout(resolve, 20));
      assert(!writingPage.querySelector('[data-ai-origin]')?.hidden
        && !writingPage.querySelector('[data-ai-origin-authorize]')?.hidden
        && writingPage.querySelector('[data-ai-origin-message]')?.textContent.includes('授权 GitLab'),
      `GitLab 授权不足时未显示授权恢复入口：${writingPage.querySelector('[data-ai-origin-message]')?.textContent}`);
      assert(requests.some(request => request.pathname.endsWith('/access-status'))
        && !requests.some(request => request.pathname.endsWith('/ai-jobs') && request.method === 'POST'),
      `授权失败后不应提交 AI 任务：${JSON.stringify(requests)}`);
      writingPage.querySelector('[data-ai-close]')?.click();
      for (let attempt = 0; attempt < 50 && document.querySelector('.handbook-writing-page'); attempt++)
        await new Promise(resolve => setTimeout(resolve, 20));
      assert(!document.querySelector('.handbook-writing-page'), '授权失败写作页关闭后未清理');

      // Successful GitLab origin: exercise mapping, access, branch, tree and file reads.
      originMode = 'success';
      ui.drafts[documentId] = savedMarkdown;
      appState.incrementalProjection.handbookOutline = { detail: {
        nodes: [{ kind: 'document', id: documentId, sourceId: 'docs/current.md', title: '当前文档' }],
      } };
      const successRequests = [];
      window.fetch = async (input, options = {}) => {
        const url = new URL(typeof input === 'string' ? input : input.url, location.origin);
        const method = (options.method || input.method || 'GET').toUpperCase();
        successRequests.push({ pathname: url.pathname, method, body: options.body ? JSON.parse(options.body) : null });
        if (url.pathname.endsWith('/mappings/coverage-handbook')) return new Response(JSON.stringify({ success: true, data: {
          connectionId: 'coverage-connection', project: 'group/docs', defaultBranch: 'main', enabledBranches: ['main'], zhPaths: ['docs'],
        } }), { headers: { 'content-type': 'application/json' } });
        if (url.pathname.endsWith('/access-status')) return new Response(JSON.stringify({ success: true, data: { canRead: true } }), { headers: { 'content-type': 'application/json' } });
        if (url.pathname.endsWith('/branches')) return new Response(JSON.stringify({ success: true, data: [{ name: 'main' }] }), { headers: { 'content-type': 'application/json' } });
        if (url.pathname.endsWith('/tree')) return new Response(JSON.stringify({ success: true, data: [{ type: 'blob', path: 'docs/current.md', commitId: 'commit-7', blobId: 'blob-7' }] }), { headers: { 'content-type': 'application/json' } });
        if (url.pathname.endsWith('/file')) return new Response(JSON.stringify({ success: true, data: { path: 'docs/current.md', content: savedMarkdown, encoding: 'utf-8', commitId: 'commit-7', blobId: 'blob-7' } }), { headers: { 'content-type': 'application/json' } });
        if (url.pathname.endsWith('/production/models')) return new Response(JSON.stringify({ success: true, data: {
          options: [{ serviceId: 'coverage-service', model: 'coverage-model' }],
          defaultSelection: { serviceId: 'coverage-service', model: 'coverage-model' },
        } }), { headers: { 'content-type': 'application/json' } });
        if (url.pathname.endsWith('/api/templates')) return new Response(JSON.stringify({ success: true, data: [{ id: 'coverage-template', name: '覆盖率模板', status: 'active' }] }), { headers: { 'content-type': 'application/json' } });
        if (url.pathname.endsWith('/ai-jobs') && method === 'GET') return new Response(JSON.stringify({ success: true, data: [] }), { headers: { 'content-type': 'application/json' } });
        if (url.pathname.endsWith('/ai-skills')) return new Response(JSON.stringify({ success: true, data: { items: [] } }), { headers: { 'content-type': 'application/json' } });
        if (url.pathname.endsWith('/ai-sources')) return new Response(JSON.stringify({ success: true, data: { items: [], referenceListCollapsedCount: 0 } }), { headers: { 'content-type': 'application/json' } });
        if (url.pathname.endsWith('/ai-jobs') && method === 'POST') return new Response(JSON.stringify({ success: false, error: { message: '隔离任务提交已拦截' } }), { status: 503, headers: { 'content-type': 'application/json' } });
        return new Response(JSON.stringify({ success: true, data: {} }), { headers: { 'content-type': 'application/json' } });
      };
      await click('generate');
      writingPage = null;
      for (let attempt = 0; attempt < 50 && !writingPage; attempt++) {
        writingPage = document.querySelector('.handbook-writing-page:not([hidden])');
        if (!writingPage) await new Promise(resolve => setTimeout(resolve, 20));
      }
      assert(writingPage, '成功来源场景没有打开嵌入式写作页');
      await waitForWritingEditor(writingPage);
      const successStart = writingPage.querySelector('[data-ai-start]');
      for (let attempt = 0; attempt < 50 && successStart.disabled; attempt++)
        await new Promise(resolve => setTimeout(resolve, 20));
      assert(!successStart.disabled, `成功来源场景生成按钮未就绪：hint=${writingPage.querySelector('[data-ai-start-hint]')?.textContent}; origin=${writingPage.querySelector('[data-ai-origin-message]')?.textContent}; status=${writingPage.querySelector('[data-ai-status]')?.textContent}; requests=${JSON.stringify(successRequests)}`);
      successStart.click();
      for (let attempt = 0; attempt < 100 && !successRequests.some(request => request.pathname.endsWith('/ai-jobs') && request.method === 'POST'); attempt++)
        await new Promise(resolve => setTimeout(resolve, 20));
      const successfulFile = successRequests.find(request => request.pathname.endsWith('/file'));
      const submitted = successRequests.find(request => request.pathname.endsWith('/ai-jobs') && request.method === 'POST');
      assert(successRequests.some(request => request.pathname.endsWith('/mappings/coverage-handbook'))
        && successRequests.some(request => request.pathname.endsWith('/access-status'))
        && successRequests.some(request => request.pathname.endsWith('/branches'))
        && successRequests.some(request => request.pathname.endsWith('/tree'))
        && successfulFile?.body === null
        && successfulFile?.method === 'GET'
        && submitted?.body?.originSnapshot?.originType === 'gitlab'
        && submitted.body.originSnapshot.path === 'docs/current.md'
        && submitted.body.originSnapshot.commitId === 'commit-7',
      `GitLab 成功来源未形成完整快照或提交上下文：${JSON.stringify(successRequests)}`);
      writingPage.querySelector('[data-ai-close]')?.click();
      for (let attempt = 0; attempt < 50 && document.querySelector('.handbook-writing-page'); attempt++)
        await new Promise(resolve => setTimeout(resolve, 20));
      assert(!document.querySelector('.handbook-writing-page'), '成功来源写作页关闭后未清理');
      appState.incrementalProjection.handbookOutline = previousOutline;

      const saveButton = document.createElement('button');
      saveButton.dataset.handbookDraftSave = documentId;
      const saveStatus = document.createElement('span');
      saveStatus.dataset.handbookSaveStatus = '';
      currentDocument.append(saveButton, saveStatus);
      ui.draftLoadState[documentId] = 'loading';
      saveButton.click();
      assert(title.textContent === '暂时无法保存', '共享草稿未就绪时未阻止保存');

      ui.draftLoadState[documentId] = 'ready';
      ui.drafts[documentId] = '# 保存测试正文';
      ui.draftHtml[documentId] = '<h1>保存测试正文</h1>';
      ui.dirtyDocuments = [documentId];
      ui.attachments[documentId] = [{ attachmentId: 'coverage-attachment' }];
      ui.serverDrafts[documentId] = { exists: true, draft: {
        editVersion: 4, branch: 'unmapped', revision: { markdown: savedMarkdown, htmlSnapshot: '<h1>已保存正文</h1>' },
      } };
      const saveRequests = [];
      let saveMode = 'failure';
      let releaseSave;
      window.fetch = async (input, options = {}) => {
        const url = new URL(typeof input === 'string' ? input : input.url, location.origin);
        if (!url.pathname.endsWith(`/documents/${documentId}/draft`) || options.method !== 'PUT')
          return new Response(JSON.stringify({ success: true, data: {} }), { headers: { 'content-type': 'application/json' } });
        const body = JSON.parse(options.body);
        saveRequests.push({ pathname: url.pathname, body });
        if (saveMode === 'failure') return new Response(JSON.stringify({ success: false, error: {
          code: 'DRAFT_SAVE_FAILED', message: '隔离草稿写入失败',
        } }), { status: 500, headers: { 'content-type': 'application/json' } });
        if (saveMode === 'delayed') await new Promise(resolve => { releaseSave = resolve; });
        return new Response(JSON.stringify({ success: true, data: { exists: true, draft: {
          editVersion: saveMode === 'delayed' ? 6 : 5, branch: 'unmapped',
          revision: { markdown: body.markdown, htmlSnapshot: body.htmlSnapshot },
        } } }), { headers: { 'content-type': 'application/json' } });
      };
      saveButton.click();
      for (let attempt = 0; attempt < 50 && ui.draftSaveState[documentId]?.status !== 'failed'; attempt++)
        await new Promise(resolve => setTimeout(resolve, 20));
      assert(ui.draftSaveState[documentId]?.status === 'failed'
        && saveStatus.textContent.includes('隔离草稿写入失败'), '草稿保存失败状态或反馈缺失');
      assert(saveRequests[0]?.pathname.includes('/handbooks/coverage-handbook/documents/')
        && saveRequests[0]?.body.editVersion === 4
        && saveRequests[0]?.body.markdown === '# 保存测试正文'
        && saveRequests[0]?.body.templateVersionId === 'coverage-template'
        && saveRequests[0]?.body.attachmentIds?.[0] === 'coverage-attachment'
        && typeof saveRequests[0]?.body.baselineDigest === 'string'
        && saveRequests[0].body.baselineDigest.length === 64, '草稿保存请求上下文或正文不完整');

      saveMode = 'success';
      saveButton.click();
      for (let attempt = 0; attempt < 50 && ui.draftSaveState[documentId]?.status !== 'saved'; attempt++)
        await new Promise(resolve => setTimeout(resolve, 20));
      assert(ui.draftSaveState[documentId]?.status === 'saved'
        && ui.serverDrafts[documentId]?.draft.editVersion === 5
        && !ui.dirtyDocuments.includes(documentId)
        && title.textContent === '保存成功', '草稿保存成功后版本或脏状态不正确');

      ui.drafts[documentId] = '# 第二次保存';
      ui.dirtyDocuments = [documentId];
      saveMode = 'delayed';
      saveButton.disabled = false;
      saveButton.click();
      for (let attempt = 0; attempt < 50 && !releaseSave; attempt++)
        await new Promise(resolve => setTimeout(resolve, 20));
      assert(releaseSave && ui.draftSaveState[documentId]?.status === 'saving', '延迟保存未开始');
      ui.drafts[documentId] = '# 保存期间继续编辑';
      releaseSave();
      for (let attempt = 0; attempt < 50 && ui.draftSaveState[documentId]?.status !== 'saved'; attempt++)
        await new Promise(resolve => setTimeout(resolve, 20));
      assert(ui.draftSaveState[documentId]?.status === 'saved'
        && ui.drafts[documentId] === '# 保存期间继续编辑'
        && ui.dirtyDocuments.includes(documentId)
        && message.textContent.includes('后续修改仍未保存'), '保存期间的后续编辑被覆盖或误标为已保存');

      const controls = document.createElement('section');
      controls.innerHTML = `<button data-handbook-history="${documentId}">历史</button>
        <dialog data-handbook-history-dialog><button data-handbook-history-compare="revision-old">比较</button>
          <button data-handbook-history-restore="revision-old">恢复</button><button data-handbook-history-close>关闭历史</button></dialog>
        <dialog data-coverage-conflict><button data-handbook-conflict-close>关闭冲突</button></dialog>
        <button data-handbook-conflict-copy>复制</button><button data-handbook-conflict-reload>重新读取</button>
        <button data-handbook-conflict-merge>合并</button>`;
      currentDocument.append(controls);
      const localClick = selector => controls.querySelector(selector).click();
      const until = async (predicate, failure) => {
        for (let attempt = 0; attempt < 100 && !predicate(); attempt++)
          await new Promise(resolve => setTimeout(resolve, 10));
        assert(predicate(), failure);
      };
      let historyMode = 'success';
      const historyRequests = [];
      const restored = { exists: true, draft: { editVersion: 7, branch: 'unmapped',
        revision: { revisionId: 'restored-7', markdown: '# 已恢复历史', htmlSnapshot: '<h1>已恢复历史</h1>' } } };
      window.fetch = async (input, options = {}) => {
        const url = new URL(typeof input === 'string' ? input : input.url, location.origin);
        if (!url.pathname.includes(`/documents/${documentId}/draft/`)) return originalFetch(input, options);
        historyRequests.push({ pathname: url.pathname, search: url.search, body: options.body ? JSON.parse(options.body) : null });
        const failed = historyMode === 'failure';
        return new Response(JSON.stringify(failed
          ? { success: false, error: { code: 'DRAFT_HISTORY_UNAVAILABLE', message: '隔离历史服务不可用' } }
          : { success: true, data: url.pathname.endsWith('/restore') ? restored
            : historyMode === 'empty' ? {} : { items: [{ revisionId: 'revision-old', markdown: '# 旧版本' }] } }),
        { status: failed ? 503 : 200, headers: { 'content-type': 'application/json' } });
      };
      localClick('[data-handbook-history]');
      await until(() => ui.history?.loading === false, '历史列表读取未结束');
      assert(ui.history.documentId === documentId && ui.history.items[0]?.revisionId === 'revision-old', '历史列表结果未显示');
      localClick('[data-handbook-history-compare]');
      assert(ui.history.compareRevisionId === 'revision-old', '历史比较未选择目标修订');
      ui.history = null;
      localClick('[data-handbook-history-compare]');
      assert(ui.history === null, '无历史列表时比较应保持空状态');
      const historyDialog = controls.querySelector('[data-handbook-history-dialog]');
      historyDialog.showModal();
      localClick('[data-handbook-history-close]');
      assert(!historyDialog.open, '历史关闭按钮未关闭弹窗');
      historyMode = 'empty';
      localClick('[data-handbook-history]');
      await until(() => ui.history?.loading === false, '空历史列表读取未结束');
      assert(ui.history.items.length === 0, '空历史响应未回退空列表');
      historyMode = 'failure';
      localClick('[data-handbook-history]');
      await until(() => ui.history?.error, '历史服务失败未展示错误');
      assert(ui.history.error === '隔离历史服务不可用' && ui.history.items.length === 0, '历史失败状态不正确');
      localClick('[data-handbook-history-restore]');
      await until(() => title.textContent === '恢复失败', '历史恢复失败未反馈');
      assert(message.textContent === '隔离历史服务不可用', '历史恢复失败原因未保留');
      historyMode = 'success';
      localClick('[data-handbook-history-restore]');
      await until(() => ui.serverDrafts[documentId]?.draft.editVersion === 7, '历史恢复成功未更新版本');
      assert(ui.history === null && ui.drafts[documentId] === '# 已恢复历史'
        && ui.draftHtml[documentId] === '<h1>已恢复历史</h1>' && title.textContent === '历史版本已恢复', '历史恢复未更新正文和反馈');
      assert(historyRequests.some(item => item.pathname.endsWith('/restore') && item.body.revisionId === 'revision-old'
        && item.body.editVersion === 6 && item.body.branch === 'unmapped' && item.body.outlineVersionId), '恢复请求缺少当前版本或作用域');
      ui.history = { documentId };
      delete ui.serverDrafts[documentId];
      localClick('[data-handbook-history-restore]');
      await until(() => ui.history === null, '缺少当前草稿的历史恢复未结束');
      assert(historyRequests.at(-1).body.editVersion === 0, '历史恢复缺少当前草稿时未使用初始版本');

      const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
      const copied = [];
      try {
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: text => { copied.push(text); return Promise.resolve(); } } });
        ui.conflict = { documentId, localMarkdown: '# 冲突本地内容' };
        localClick('[data-handbook-conflict-copy]');
        ui.conflict = null;
        localClick('[data-handbook-conflict-copy]');
        assert(copied[0] === '# 冲突本地内容' && copied[1] === '' && title.textContent === '复制成功', '冲突复制未保留本地内容或空值回退');
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
        localClick('[data-handbook-conflict-copy]');
      } finally {
        if (clipboardDescriptor) Object.defineProperty(navigator, 'clipboard', clipboardDescriptor);
        else delete navigator.clipboard;
      }
      const serverConflict = { editVersion: 8, branch: 'unmapped', revision: { markdown: '# 远端正文', htmlSnapshot: '<h1>远端正文</h1>' } };
      ui.serverDrafts[documentId] = { exists: true, capabilities: { canEdit: true } };
      ui.conflict = { documentId, serverDraft: serverConflict, localMarkdown: '# 本地合并', localHtml: '<h1>本地合并</h1>' };
      localClick('[data-handbook-conflict-merge]');
      assert(ui.conflict === null && ui.serverDrafts[documentId].draft.editVersion === 8
        && ui.serverDrafts[documentId].capabilities.canEdit && ui.drafts[documentId] === '# 本地合并'
        && ui.draftHtml[documentId] === '<h1>本地合并</h1>' && ui.modeByDocument[documentId] === 'edit'
        && ui.dirtyDocuments.includes(documentId), '冲突合并未保留远端版本和本地修改');
      delete ui.serverDrafts[documentId];
      ui.conflict = { documentId, serverDraft: serverConflict };
      localClick('[data-handbook-conflict-merge]');
      assert(ui.drafts[documentId] === '' && ui.draftHtml[documentId] === ''
        && Object.keys(ui.serverDrafts[documentId].capabilities).length === 0, '冲突合并空正文或权限回退不正确');
      ui.conflict = { documentId, localMarkdown: '# 无远端版本', localHtml: '<p>无远端版本</p>' };
      localClick('[data-handbook-conflict-merge]');
      assert(ui.drafts[documentId] === '# 无远端版本', '缺少远端草稿时未保留本地合并');
      ui.conflict = { documentId, serverDraft: serverConflict };
      localClick('[data-handbook-conflict-reload]');
      assert(ui.conflict === null && ui.drafts[documentId] === '# 远端正文'
        && ui.draftHtml[documentId] === '<h1>远端正文</h1>' && !ui.dirtyDocuments.includes(documentId), '重新读取未丢弃本地修改并恢复远端正文');
      delete ui.serverDrafts[documentId];
      ui.conflict = { documentId, serverDraft: serverConflict };
      localClick('[data-handbook-conflict-reload]');
      assert(Object.keys(ui.serverDrafts[documentId].capabilities).length === 0, '重读缺少现有草稿时未回退权限对象');
      ui.conflict = { documentId };
      localClick('[data-handbook-conflict-reload]');
      assert(ui.conflict === null && ui.drafts[documentId] === '# 远端正文', '无远端冲突时未使用已保存草稿');
      const conflictDialog = controls.querySelector('[data-coverage-conflict]');
      conflictDialog.showModal();
      localClick('[data-handbook-conflict-close]');
      assert(!conflictDialog.open, '冲突关闭按钮未关闭弹窗');

      const reviewCurrent = document.createElement('button');
      reviewCurrent.dataset.handbookReviewCurrent = documentId;
      controls.append(reviewCurrent);
      const selectionDialog = document.createElement('dialog');
      selectionDialog.dataset.handbookReviewSelectionDialog = '';
      controls.append(selectionDialog);
      let reviewMode = 'success'; let releaseReview; let reviewReads = 0;
      const scopeVersion = new URLSearchParams(historyRequests[0].search).get('outlineVersionId');
      const reviewItems = [
        { documentId, handbookId: 'coverage-handbook', outlineVersionId: scopeVersion, branch: 'unmapped' },
        { documentId: 'wrong-handbook', handbookId: 'other', outlineVersionId: scopeVersion, branch: 'unmapped' },
        { documentId: 'wrong-outline', handbookId: 'coverage-handbook', outlineVersionId: 'other', branch: 'unmapped' },
        { documentId: 'wrong-branch', handbookId: 'coverage-handbook', outlineVersionId: scopeVersion, branch: 'other' },
      ];
      window.fetch = async (input, options) => {
        const url = new URL(typeof input === 'string' ? input : input.url, location.origin);
        if (!url.pathname.endsWith('/review-drafts')) return originalFetch(input, options);
        reviewReads++;
        const requestedMode = reviewMode;
        if (requestedMode.startsWith('delayed')) await new Promise(resolve => { releaseReview = resolve; });
        const failed = requestedMode.includes('failure');
        return new Response(JSON.stringify(failed
          ? { success: false, error: { code: 'DRAFTS_UNAVAILABLE', message: '隔离送审草稿读取失败' } }
          : { success: true, data: requestedMode === 'empty' ? {} : { items: reviewItems } }),
        { status: failed ? 503 : 200, headers: { 'content-type': 'application/json' } });
      };
      ui.dirtyDocuments = [];
      ui.draftLoadState[documentId] = 'ready';
      ui.serverDrafts[documentId].capabilities = { canEdit: true, canSubmitReview: false };
      reviewCurrent.click();
      assert(reviewReads === 0 && !selectionDialog.open, '无送审权限时仍请求草稿或打开弹窗');
      ui.serverDrafts[documentId].capabilities.canSubmitReview = true;
      reviewCurrent.click();
      await until(() => ui.reviewSelectionStatus === '', '送审草稿列表未完成读取');
      assert(selectionDialog.open && ui.selectedForReview[0] === documentId
        && Object.keys(ui.reviewDraftSummaries).length === 1 && ui.reviewDraftSummaries[documentId], '送审列表未按当前作用域过滤');
      selectionDialog.close();
      reviewMode = 'empty';
      reviewCurrent.click();
      await until(() => ui.reviewSelectionStatus === '', '空送审列表未完成读取');
      assert(Object.keys(ui.reviewDraftSummaries).length === 0, '空送审响应未清空摘要');
      selectionDialog.close();
      reviewMode = 'failure';
      reviewCurrent.click();
      await until(() => ui.reviewSelectionStatus.includes('隔离送审草稿读取失败'), '送审列表失败未显示中文反馈');
      selectionDialog.close();
      reviewMode = 'delayed-success'; releaseReview = null;
      reviewCurrent.click();
      await until(() => releaseReview, '延迟送审列表请求未开始');
      selectionDialog.close(); releaseReview();
      await until(() => ui.reviewSelectionStatus === '', '已关闭弹窗的送审列表未处理完成');
      assert(!selectionDialog.open, '异步结果重新打开了用户已关闭的送审弹窗');
      for (const delayedMode of ['delayed-success', 'delayed-failure']) {
        reviewMode = delayedMode; releaseReview = null;
        reviewCurrent.click();
        await until(() => releaseReview, '过期送审列表请求未开始');
        const statusBefore = ui.reviewSelectionStatus;
        selectionDialog.close();
        ui.repository = { ...(ui.repository || {}), branch: 'changed-during-review' };
        releaseReview();
        await new Promise(resolve => setTimeout(resolve, 30));
        assert(ui.reviewSelectionStatus === statusBefore && Object.keys(ui.reviewDraftSummaries).length === 0,
          '过期送审列表成功或失败结果污染了新作用域');
        ui.repository.branch = 'unmapped';
      }

      const templateSelect = document.createElement('select');
      templateSelect.dataset.handbookTemplate = '';
      templateSelect.dataset.documentId = documentId;
      templateSelect.innerHTML = '<option value="">无模板</option><option value="coverage-new">新模板</option><option value="coverage-empty">空模板</option><option value="coverage-error">失败模板</option>';
      controls.append(templateSelect);
      let templateReads = 0;
      window.fetch = async (input, options) => {
        const url = new URL(typeof input === 'string' ? input : input.url, location.origin);
        if (!url.pathname.startsWith('/knowledge-center/api/templates/coverage-')) return originalFetch(input, options);
        templateReads++;
        const failed = url.pathname.endsWith('coverage-error');
        return new Response(JSON.stringify(failed
          ? { success: false, error: { message: '隔离模板读取失败' } }
          : { success: true, data: url.pathname.endsWith('coverage-empty') ? null : { id: 'coverage-new', title: '新模板' } }),
        { status: failed ? 502 : 200, headers: { 'content-type': 'application/json' } });
      };
      const changeTemplate = value => {
        templateSelect.value = value;
        templateSelect.dispatchEvent(new Event('change', { bubbles: true }));
      };
      ui.draftHtml[documentId] = '<p>保留已有正文</p>';
      changeTemplate('coverage-new');
      await until(() => ui.templateDetails['coverage-new'], '新模板未加载或缓存');
      assert(ui.templateStatus.includes('当前草稿保持不变') && ui.draftHtml[documentId] === '<p>保留已有正文</p>', '模板切换覆盖了已有HTML草稿');
      delete ui.draftHtml[documentId];
      changeTemplate('coverage-new');
      assert(ui.templateStatus === '' && templateReads === 1, '缓存模板重复请求或未清空读取状态');
      changeTemplate('coverage-empty');
      await until(() => ui.templateStatus === '', '空模板响应未结束读取状态');
      assert(!ui.templateDetails['coverage-empty'], '空模板响应被误缓存');
      changeTemplate('coverage-error');
      await until(() => ui.templateStatus === 'HTTP 502', '模板失败未显示既有HTTP错误提示');
      changeTemplate('');
      assert(ui.templateStatus === '' && ui.templateByDocument[documentId] === '', '取消模板未清空状态');

      const reviewCheckbox = document.createElement('input');
      reviewCheckbox.type = 'checkbox';
      reviewCheckbox.dataset.handbookReviewDocument = '';
      reviewCheckbox.value = documentId;
      const nextReview = document.createElement('button');
      nextReview.dataset.handbookReviewSubmit = '';
      const selectionStatus = document.createElement('p');
      selectionStatus.dataset.handbookReviewSelectionStatus = '';
      const closeReview = document.createElement('button');
      closeReview.dataset.handbookReviewClose = '';
      selectionDialog.append(reviewCheckbox, nextReview, selectionStatus, closeReview);
      const changeReview = checked => {
        reviewCheckbox.checked = checked;
        reviewCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
      };
      ui.selectedForReview = [];
      nextReview.click();
      assert(!nextReview.disabled, '空选择点击下一步改变了控件状态');
      changeReview(true);
      assert(ui.selectedForReview.includes(documentId) && !nextReview.disabled, '勾选文档未启用下一步');
      changeReview(false);
      assert(!ui.selectedForReview.length && nextReview.disabled, '取消文档选择未禁用下一步');
      reviewCheckbox.disabled = true;
      changeReview(true);
      assert(!ui.selectedForReview.length, '禁用送审文档仍修改选择状态');
      reviewCheckbox.disabled = false;
      changeReview(true);
      let draftReadCount = 0;
      window.fetch = async (input, options) => {
        const url = new URL(typeof input === 'string' ? input : input.url, location.origin);
        if (!url.pathname.endsWith('/draft')) return originalFetch(input, options);
        draftReadCount++;
        return new Response(JSON.stringify({ success: false, error: { code: 'DRAFT_UNAVAILABLE', message: '隔离送审草稿不可读' } }),
          { status: 503, headers: { 'content-type': 'application/json' } });
      };
      selectionDialog.showModal();
      nextReview.click();
      await until(() => selectionStatus.textContent.includes('部分草稿未保存'), '草稿读取失败时未阻止下一步');
      assert(draftReadCount === 1 && selectionDialog.open && !nextReview.disabled, '草稿读取失败未保持选择弹窗并允许重试');
      closeReview.click();
      assert(!selectionDialog.open, '关闭送审选择弹窗失败');

      const submitDialog = document.createElement('dialog');
      const reviewForm = document.createElement('form');
      reviewForm.dataset.handbookReviewForm = '';
      reviewForm.innerHTML = `<input name="reviewerId" required><textarea name="note">  送审备注  </textarea>
        <input data-handbook-review-path="${documentId}" value="  docs/coverage.md  ">
        <input data-handbook-review-override="${documentId}" value="override-reviewer">
        <p data-handbook-review-dialog-status></p><button type="submit">提交</button>`;
      submitDialog.append(reviewForm);
      controls.append(submitDialog);
      const formStatus = reviewForm.querySelector('[data-handbook-review-dialog-status]');
      const formSubmit = reviewForm.querySelector('[type="submit"]');
      const reviewWrites = [];
      const links = [];
      let submitMode = 'failure';
      window.fetch = async (input, options = {}) => {
        const url = new URL(typeof input === 'string' ? input : input.url, location.origin);
        let data = {};
        if (url.pathname.endsWith('/incremental-reviews')) {
          reviewWrites.push(JSON.parse(options.body));
          if (submitMode === 'failure') return new Response(JSON.stringify({ success: false,
            error: { code: 'REVIEW_UNAVAILABLE', message: '隔离审核服务不可用' } }),
            { status: 503, headers: { 'content-type': 'application/json' } });
          data = { tasks: submitMode === 'missing-task' ? [] : [{ id: 'coverage-review-task' }], reviewHref: '/knowledge-center/review/coverage-review-task' };
        } else if (url.pathname.endsWith('/draft')) {
          data = { exists: true, draft: { editVersion: 10, currentRevisionId: 'revision-10', branch: 'unmapped',
            revision: { markdown: '# 送审正文' } }, capabilities: { canReview: true } };
        } else if (url.pathname.endsWith('/documents/assigned-doc/link')) {
          links.push(JSON.parse(options.body));
          data = { revision: 21 };
        } else if (url.pathname.endsWith('/document-tasks/COVERAGE-TICKET')) {
          data = { revision: 20, decomposition: { handbooks: [{ id: 'coverage-handbook',
            documents: submitMode === 'scope-mismatch' ? [] : [{ id: 'assigned-doc', createdDocumentId: documentId }] }] } };
        } else return originalFetch(input, options);
        return new Response(JSON.stringify({ success: true, data }),
          { status: 200, headers: { 'content-type': 'application/json' } });
      };
      const submitReview = () => reviewForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      submitDialog.showModal();
      submitReview();
      assert(reviewWrites.length === 0 && !formSubmit.disabled, '无效表单仍提交审核请求');
      reviewForm.elements.reviewerId.value = 'default-reviewer';
      ui.repository = { ...(ui.repository || {}), businessVersion: '  v23.1  ' };
      const prepareReview = () => {
        ui.selectedForReview = [documentId];
        ui.serverDrafts[documentId] = { exists: true, draft: { currentRevisionId: 'revision-9',
          reviewState: { taskId: 'previous-review-task' } } };
        formSubmit.disabled = false;
      };
      prepareReview();
      submitReview();
      await until(() => formStatus.textContent.includes('提交失败：隔离审核服务不可用'), '送审失败未显示服务提示');
      assert(!formSubmit.disabled && submitDialog.open && ui.selectedForReview.includes(documentId), '送审失败未保留表单重试状态');
      for (const mode of ['success', 'missing-task', 'scope-mismatch', 'linked']) {
        submitMode = mode;
        const url = new URL(location.href);
        if (mode === 'success') url.searchParams.delete('taskNumber');
        else url.searchParams.set('taskNumber', 'COVERAGE-TICKET');
        history.replaceState(history.state, '', url);
        prepareReview();
        if (!submitDialog.open) submitDialog.showModal();
        submitReview();
        await until(() => !submitDialog.open, `送审成功未关闭表单：${mode}`);
        const sent = reviewWrites.at(-1);
        assert(sent.businessVersion === 'v23.1' && sent.note === '送审备注'
          && sent.defaultReviewerIds[0] === 'default-reviewer' && sent.revisionOfTaskId === 'previous-review-task'
          && sent.documents[0].filePath === 'docs/coverage.md' && sent.documents[0].draftRevisionId === 'revision-9'
          && sent.documents[0].reviewerIds[0] === 'override-reviewer', '送审负载缺少版本、路径、审核人覆盖或退回任务引用');
        assert(ui.selectedForReview.length === 0 && ui.reviewState?.taskId === 'coverage-review-task'
          === (mode !== 'missing-task'), '送审结果未保存任务或清空选择');
        if (mode === 'missing-task') assert(title.textContent === '请补充关联' && message.textContent.includes('审核服务未返回任务编号'), '缺少审核任务编号未反馈补充关联');
        else if (mode === 'scope-mismatch') assert(title.textContent === '请补充关联' && message.textContent.includes('送审文档与当前工单范围不一致'), '工单范围不匹配未反馈补充关联');
        else assert(title.textContent === '提交成功', '送审成功未显示成功反馈');
      }
      assert(links.length === 1 && links[0].expectedRevision === 20 && links[0].handbookId === 'coverage-handbook'
        && links[0].reviewTaskId === 'coverage-review-task', '工单关联请求缺少当前修订或审核任务');
      submitDialog.remove();

    } finally {
      window.fetch = originalFetch;
      appState.incrementalProjection.handbookOutline = previousOutline;
      document.querySelector('.handbook-ai-dialog[open]')?.close();
      document.querySelectorAll('.handbook-ai-dialog').forEach(dialog => dialog.remove());
      document.querySelectorAll('.handbook-writing-page').forEach(node => node.remove());
      currentDocument.remove();
      button.remove();
      writingHost.remove();
      appState.handbookProductionUi = previousUi;
      appState.activeView = previousView;
      history.replaceState(previousHistoryState, '', previousUrl);
      panel.className = previousNotice.className;
      panel.hidden = previousNotice.hidden;
      title.textContent = previousNotice.title;
      message.textContent = previousNotice.message;
      retry.hidden = previousNotice.retryHidden;
      action.hidden = previousNotice.actionHidden;
      if (previousNotice.actionHref === null) action.removeAttribute('href');
      else action.setAttribute('href', previousNotice.actionHref);
      action.textContent = previousNotice.actionText;
    }
  });
}

async function exerciseRepositoryMappingReads(page) {
  await page.evaluate(async () => {
    const { appState } = await import('/knowledge-center/common/state/app-state.js');
    const assert = (condition, message) => { if (!condition) throw new Error(message); };
    const previousState = appState.mappingState;
    const originalFetch = window.fetch;
    const host = document.createElement('section');
    host.innerHTML = `<form data-repository-mapping-form data-handbook-id="coverage-handbook">
      <select name="connectionId" data-mapping-connection-select><option value="">请选择</option><option value="coverage-connection">覆盖连接</option><option value="failed-connection">失败连接</option></select>
      <select name="defaultBranch" data-mapping-default-branch><option value="">先选择连接</option></select>
      <div data-mapping-enabled-branches></div><div data-mapping-connection-hint></div>
      <button type="button" data-mapping-language="zh">中文</button><button type="button" data-mapping-language="en">英文</button>
      <input data-mapping-tree-search><div data-mapping-path-browser></div>
      <div data-mapping-zh-tags></div><div data-mapping-en-tags></div><div data-mapping-preview></div>
    </form>`;
    document.body.append(host);
    const form = host.querySelector('form');
    const connection = form.elements.connectionId;
    const branch = form.elements.defaultBranch;
    const browser = form.querySelector('[data-mapping-path-browser]');
    const calls = [];
    const json = (data, status = 200) => new Response(JSON.stringify(data), {
      status, headers: { 'content-type': 'application/json' },
    });
    try {
      appState.mappingState = { connectionId: null, treeItems: [], expandedPaths: new Set(), search: '',
        searchOriginalExpandedPaths: null, branches: [], enabledBranches: [], zhPaths: [], enPaths: [], activeLang: 'zh' };
      window.fetch = async input => {
        const url = new URL(typeof input === 'string' ? input : input.url, location.origin);
        calls.push(url.pathname + url.search);
        if (url.pathname.endsWith('/coverage-connection/branches')) return json({ success: true, data: [
          { name: 'main', protected: true }, { name: 'release' },
        ] });
        if (url.pathname.endsWith('/coverage-connection/tree')) {
          if (url.searchParams.get('ref') === 'release') return json({ success: false, error: {
            code: 'GITLAB_CONNECTION_UNAUTHORIZED', message: '请连接 GitLab 账号',
          } }, 401);
          return json({ success: true, data: [
            { path: 'docs', name: '文档', type: 'tree' },
            { path: 'docs/intro.md', name: '简介.md', type: 'blob' },
            { path: 'docs/setup', name: '配置', type: 'tree' },
            { path: 'docs/setup/install.md', name: '安装.md', type: 'blob' },
          ] });
        }
        if (url.pathname.endsWith('/failed-connection/branches')) return json({ success: false, error: {
          code: 'GITLAB_CONNECTION_UNAVAILABLE', message: '分支服务暂不可用',
        } }, 500);
        if (url.pathname.endsWith('/failed-connection/tree')) return json({ success: true, data: [] });
        throw new Error(`意外的仓库映射请求：${url.pathname}`);
      };

      connection.value = 'coverage-connection';
      connection.dispatchEvent(new Event('change', { bubbles: true }));
      for (let attempt = 0; attempt < 50 && !browser.querySelector('[data-mapping-tree-item]'); attempt++)
        await new Promise(resolve => setTimeout(resolve, 20));
      assert(branch.value === 'main' && form.querySelector('[name="enabledBranches"][value="release"]')
        && form.querySelector('[data-mapping-connection-hint]')?.textContent.includes('读取 2 个分支'), 'GitLab 分支列表未渲染或默认分支未选择');
      assert(browser.querySelector('[data-mapping-tree-item="docs"]')
        && calls.some(call => call.includes('/coverage-connection/tree?ref=main')), '仓库根目录或默认分支请求缺失');
      browser.querySelector('[data-mapping-tree-expand="docs"]').click();
      assert(browser.querySelector('[data-mapping-tree-item="docs/intro.md"]'), '展开目录后未显示子文件');
      browser.querySelector('[data-mapping-tree-toggle="docs"]').click();
      assert(form.querySelector('[data-mapping-zh-tags]')?.textContent.includes('docs')
        && form.querySelector('[data-mapping-preview]')?.textContent.includes('中文路径'), '中文目录选择未更新标签和预览');
      form.querySelector('[data-mapping-language="en"]').click();
      assert(form.querySelector('[data-mapping-language="en"]').getAttribute('aria-pressed') === 'true'
        && browser.querySelector('[data-mapping-tree-item="docs"] .mapping-tree-language-badge')?.textContent.includes('中文'), '切换英文后缺少中文已选标记');
      browser.querySelector('[data-mapping-tree-toggle="docs/setup"]').click();
      assert(form.querySelector('[data-mapping-en-tags]')?.textContent.includes('docs/setup')
        && form.querySelector('[data-mapping-preview]')?.textContent.includes('英文路径'), '英文目录选择未更新标签和预览');
      form.querySelector('[data-mapping-path-remove="zh"]').click();
      form.querySelector('[data-mapping-path-remove="en"]').click();
      assert(form.querySelector('[data-mapping-zh-tags]')?.textContent.includes('尚未从目录选择')
        && form.querySelector('[data-mapping-en-tags]')?.textContent.includes('尚未从目录选择')
        && form.querySelector('[data-mapping-preview]')?.textContent.includes('完成路径选择后'), '移除路径后占位提示未恢复');
      const search = form.querySelector('[data-mapping-tree-search]');
      search.value = 'install';
      search.dispatchEvent(new Event('input', { bubbles: true }));
      assert(browser.textContent.includes('安装.md') && !browser.textContent.includes('简介.md'), '映射目录搜索未过滤并保留匹配祖先');

      branch.value = 'release';
      branch.dispatchEvent(new Event('change', { bubbles: true }));
      for (let attempt = 0; attempt < 50 && !browser.querySelector('.mapping-path-error'); attempt++)
        await new Promise(resolve => setTimeout(resolve, 20));
      assert(browser.querySelector('.mapping-path-error')?.textContent.includes('请连接 GitLab 账号')
        && browser.querySelector('.mapping-auth-link')?.getAttribute('href').includes('connectionId=coverage-connection'), '目录未授权时缺少错误提示或连接入口');

      connection.value = 'failed-connection';
      connection.dispatchEvent(new Event('change', { bubbles: true }));
      for (let attempt = 0; attempt < 50 && !form.querySelector('[data-mapping-connection-hint]')?.textContent.includes('分支加载失败'); attempt++)
        await new Promise(resolve => setTimeout(resolve, 20));
      assert(form.querySelector('[data-mapping-connection-hint]')?.textContent.includes('分支服务暂不可用')
        && browser.textContent.includes('该目录下没有内容'), '分支读取失败或空目录结果反馈缺失');
    } finally {
      window.fetch = originalFetch;
      appState.mappingState = previousState;
      host.remove();
    }
  });
}

async function exerciseTableViewConfigurator(page) {
  await page.evaluate(async () => {
    const { enhanceTableViews } = await import('/knowledge-center/common/table-view-configurator.js');
    const assert = (condition, message) => { if (!condition) throw new Error(message); };
    const host = document.createElement('section');
    host.dataset.tableViewHost = '';
    host.innerHTML = '<table data-table-view-id="coverage-table" data-table-view-schema="1" data-table-view-label="测试表格"><thead><tr><th data-table-column="first" data-table-column-required="true">第一列</th><th data-table-column="second">第二列</th><th data-table-column="third">第三列</th></tr></thead><tbody><tr><td>甲</td><td>乙</td><td>丙</td></tr><tr><td>丁</td><td>戊</td><td>己</td></tr></tbody></table>';
    document.body.append(host);
    const table = host.querySelector('table');
    const preferenceKey = 'knowledge-center:table-view:coverage:coverage-table:1';
    const legacyKey = `coverage-table-legacy-${Date.now()}`;
    const drawer = () => document.querySelector('[data-table-view-drawer="coverage-table"]');
    const trigger = () => host.querySelector('[data-table-view-trigger="coverage-table"]');
    const columnOrder = () => [...table.querySelectorAll('thead th')].map(head => head.dataset.tableColumn);
    try {
      localStorage.removeItem(preferenceKey);
      enhanceTableViews(host, { preferenceScope: 'coverage' });
      assert(trigger() && columnOrder().join(',') === 'first,second,third', '表格增强未建立默认列序');
      trigger().click();
      assert(drawer() && !drawer().hidden && !document.querySelector('[data-table-view-backdrop]').hidden, '配置抽屉未打开');
      const optional = drawer().querySelector('[data-table-drawer-visible="second"]');
      optional.checked = false;
      optional.dispatchEvent(new Event('change', { bubbles: true }));
      assert(table.querySelector('th[data-table-column="second"]').hidden &&
        table.querySelector('td[data-table-column="second"]').hidden, '隐藏列未应用到表头和数据行');
      assert(JSON.parse(localStorage.getItem(preferenceKey)).visible.second === false, '列偏好未持久化');
      drawer().querySelector('[data-table-view-move="up"][data-table-view-column="third"]').click();
      assert(columnOrder().join(',') === 'first,third,second', '上移列未改变显示顺序');
      drawer().querySelector('[data-table-view-move="down"][data-table-view-column="third"]').click();
      assert(columnOrder().join(',') === 'first,second,third', '下移列未恢复显示顺序');
      drawer().querySelector('[data-table-view-reset]').click();
      assert(!table.querySelector('th[data-table-column="second"]').hidden && !localStorage.getItem(preferenceKey), '恢复默认未清除偏好');

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      assert(drawer().hidden && document.activeElement === trigger(), 'Escape 未关闭抽屉或归还焦点');
      trigger().click();
      drawer().querySelector('[data-table-view-close]').click();
      assert(drawer().hidden, '关闭按钮未关闭抽屉');
      trigger().click();
      document.querySelector('[data-table-view-backdrop]').click();
      assert(drawer().hidden, '遮罩未关闭抽屉');

      table.dataset.tableViewLegacyKey = legacyKey;
      localStorage.setItem(legacyKey, JSON.stringify(['third', 'first']));
      enhanceTableViews(host, { preferenceScope: 'coverage' });
      assert(columnOrder().join(',') === 'third,first,second' && table.querySelector('th[data-table-column="second"]').hidden,
        '旧列顺序偏好未迁移');
      assert(!localStorage.getItem(legacyKey) && localStorage.getItem(preferenceKey), '迁移后未替换旧存储键');

      let changed = null;
      enhanceTableViews(host, { preferenceScope: 'coverage', onChange: event => {
        changed = event;
        enhanceTableViews(host, { preferenceScope: 'coverage' });
      } });
      trigger().click();
      const restoredToggle = drawer().querySelector('[data-table-drawer-visible="second"]');
      restoredToggle.checked = true;
      restoredToggle.dispatchEvent(new Event('change', { bubbles: true }));
      assert(changed?.tableId === 'coverage-table' && changed.state.visible.second && !drawer().hidden,
        '变更回调后未恢复抽屉与列状态');
      assert(!table.querySelector('th[data-table-column="second"]').hidden, '重绘后列可见性未更新');

      localStorage.removeItem(preferenceKey);
      localStorage.setItem(legacyKey, '{invalid-json');
      enhanceTableViews(host, { preferenceScope: 'coverage' });
      assert(!table.querySelector('th[data-table-column="second"]').hidden && !localStorage.getItem(preferenceKey),
        '损坏的旧偏好应回退到当前表格的可见列');
      const declared = document.createElement('table');
      declared.className = 'outline-responsibility-table';
      declared.innerHTML = '<thead><tr><th>姓名</th></tr></thead><tbody><tr><td>甲</td></tr></tbody>';
      host.append(declared);
      enhanceTableViews(host, { preferenceScope: 'coverage' });
      assert(declared.dataset.tableViewId === 'outline-assignment' && declared.dataset.tableViewLabel === '页面分工',
        '已声明表格未自动增强');
      declared.remove();
    } finally {
      document.querySelector('[data-table-view-drawer="coverage-table"]')?.remove();
      document.querySelector('[data-table-view-backdrop]')?.remove();
      host.remove();
      localStorage.removeItem(preferenceKey);
      localStorage.removeItem(legacyKey);
      enhanceTableViews(document, { preferenceScope: 'local' });
    }
  });
}

async function exerciseAppOutlineControls(page) {
  await page.evaluate(async () => {
    const { appState } = await import('/knowledge-center/common/state/app-state.js');
    const assert = (condition, message) => { if (!condition) throw new Error(message); };
    const previousProjection = appState.outlineProjection;
    const previousUrl = window.location.href;
    const previousHistoryState = window.history.state;
    const host = document.createElement('section');
    host.innerHTML = `
      <div class="outline-node-list">
        <input data-outline-node-search aria-label="搜索节点">
        <select data-outline-node-domain-filter><option value="">全部领域</option><option value="存储">存储</option></select>
        <select data-outline-node-owner-filter><option value="">全部负责人</option><option value="张">张</option><option value="无">无</option></select>
        <div data-outline-node-row data-outline-node-search="索引" data-outline-node-domain="存储" data-outline-node-owner="张">索引</div>
        <div data-outline-node-row data-outline-node-search="连接" data-outline-node-domain="网络" data-outline-node-owner="李">连接</div>
        <p data-outline-node-filter-empty hidden>无匹配节点</p>
      </div>
      <div class="outline-assignment-workspace" data-assignment-status="pending" data-assignment-directory="dir-a">
        <button data-outline-assignment-stats-open>分工统计</button>
        <dialog data-outline-assignment-stats-dialog><button data-outline-assignment-stats-close>关闭统计</button><p>分工统计内容</p></dialog>
        <input data-outline-assignment-search aria-label="搜索分工">
        <select data-outline-assignment-member-filter><option value="">全部成员</option><option value="unassigned">未分配</option><option value="user-b">成员乙</option></select>
        <div data-outline-assignment-row data-assigned="false" data-directory-ids="dir-a" data-assignee-id="" data-search-text="索引"><input type="checkbox" data-outline-task-select checked></div>
        <div data-outline-assignment-row data-assigned="true" data-directory-ids="dir-b" data-assignee-id="user-b" data-search-text="连接"><input type="checkbox" data-outline-task-select></div>
        <span data-outline-selected-count></span>
        <div class="outline-assignment-batch" hidden><select data-outline-batch-assignee><option value="">选择成员</option><option value="user-b">成员乙</option></select><button data-outline-batch-assign disabled>批量分配</button></div>
      </div>
      <button data-outline-tab="overview" aria-selected="true">概览</button><button data-outline-tab="assignments" aria-selected="false">分工</button>
      <div data-outline-panel="overview">概览内容</div><div data-outline-panel="assignments" hidden>分工内容</div>
      <button data-outline-overview-action>概览操作</button>
      <details open><summary>目录</summary><button data-outline-document="doc-1">文档</button><div data-outline-document-panel="doc-1" hidden>文档内容</div></details>
      <div data-outline-context-menu hidden><button data-outline-move-open>移动到目录</button></div>
      <dialog data-outline-move-dialog><form method="dialog"><input type="radio" name="outline-target-directory" value="dir-a"><input type="radio" name="outline-target-directory" value="dir-b"><button type="button" data-outline-move-confirm>确认</button><p data-outline-move-status>旧状态</p></form></dialog>`;
    document.body.append(host);
    const nodeRows = [...host.querySelectorAll('[data-outline-node-row]')];
    const assignment = host.querySelector('.outline-assignment-workspace');
    const assignmentRows = [...assignment.querySelectorAll('[data-outline-assignment-row]')];
    const dispatchInput = input => input.dispatchEvent(new Event('input', { bubbles: true }));
    const dispatchChange = input => input.dispatchEvent(new Event('change', { bubbles: true }));
    try {
      const nodeSearch = host.querySelector('[data-outline-node-search]');
      nodeSearch.value = '缺失'; dispatchInput(nodeSearch);
      assert(nodeRows.every(row => row.hidden) && !host.querySelector('[data-outline-node-filter-empty]').hidden,
        '节点搜索无结果时应显示空态');
      nodeSearch.value = '索引'; dispatchInput(nodeSearch);
      assert(!nodeRows[0].hidden && nodeRows[1].hidden, '节点搜索未筛选行');
      nodeSearch.value = ''; dispatchInput(nodeSearch);
      const domain = host.querySelector('[data-outline-node-domain-filter]');
      domain.value = '存储'; dispatchChange(domain);
      assert(!nodeRows[0].hidden && nodeRows[1].hidden, '技术领域筛选错误');
      const owner = host.querySelector('[data-outline-node-owner-filter]');
      owner.value = '无'; dispatchChange(owner);
      assert(nodeRows.every(row => row.hidden), '负责人筛选错误');

      const assignmentSearch = assignment.querySelector('[data-outline-assignment-search]');
      assignmentSearch.value = '索引'; dispatchInput(assignmentSearch);
      assert(!assignmentRows[0].hidden && assignmentRows[1].hidden, '待分工筛选错误');
      assert(assignment.querySelector('[data-outline-selected-count]').textContent.includes('1 篇') &&
        !assignment.querySelector('.outline-assignment-batch').hidden && assignment.querySelector('[data-outline-batch-assign]').disabled,
      '批量选择计数和提交状态错误');
      const assignee = assignment.querySelector('[data-outline-batch-assignee]');
      assignee.value = 'user-b'; dispatchChange(assignee);
      assert(!assignment.querySelector('[data-outline-batch-assign]').disabled, '选择负责人后应允许批量分配');
      assignment.dataset.assignmentStatus = 'assigned';
      assignment.dataset.assignmentDirectory = 'dir-b';
      assignmentSearch.value = ''; dispatchInput(assignmentSearch);
      const member = assignment.querySelector('[data-outline-assignment-member-filter]');
      member.value = 'user-b'; dispatchChange(member);
      assert(assignmentRows[0].hidden && !assignmentRows[1].hidden, '已分配成员筛选错误');
      member.value = 'unassigned'; dispatchChange(member);
      assert(assignmentRows.every(row => row.hidden), '未分配筛选不应显示已分配行');

      const statsOpen = assignment.querySelector('[data-outline-assignment-stats-open]');
      const statsDialog = assignment.querySelector('[data-outline-assignment-stats-dialog]');
      const statsClose = statsDialog.querySelector('[data-outline-assignment-stats-close]');
      statsOpen.click();
      assert(statsDialog.open && document.activeElement === statsClose, '分工统计未打开或聚焦关闭按钮');
      statsClose.click();
      assert(!statsDialog.open && document.activeElement === statsOpen, '关闭统计未恢复触发按钮焦点');
      statsOpen.click();
      statsDialog.click();
      assert(!statsDialog.open && document.activeElement === statsOpen, '统计背景关闭未恢复焦点');

      const assignmentTab = host.querySelector('[data-outline-tab="assignments"]');
      assignmentTab.click();
      assert(assignmentTab.getAttribute('aria-selected') === 'true' &&
        !host.querySelector('[data-outline-panel="assignments"]').hidden && host.querySelector('[data-outline-overview-action]').hidden,
      '分工标签页未切换内容');
      host.querySelector('[data-outline-tab="overview"]').click();
      assert(!host.querySelector('[data-outline-panel="overview"]').hidden, '概览标签页未恢复');

      const documentButton = host.querySelector('[data-outline-document]');
      const menu = host.querySelector('[data-outline-context-menu]');
      documentButton.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 240, clientY: 220 }));
      assert(!menu.hidden && menu.dataset.documentId === 'doc-1' &&
        !host.querySelector('[data-outline-document-panel="doc-1"]').hidden, '右键菜单未选中文档');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      assert(menu.hidden && document.activeElement === documentButton, 'Escape 未关闭菜单或归还焦点');

      appState.outlineProjection = { detail: { nodes: [{ id: 'dir-a', children: [{ id: 'doc-1', kind: 'document' }] }, { id: 'dir-b' }] } };
      documentButton.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 240, clientY: 220 }));
      menu.querySelector('[data-outline-move-open]').click();
      const dialog = host.querySelector('[data-outline-move-dialog]');
      assert(dialog.open && dialog.dataset.documentId === 'doc-1' &&
        dialog.querySelector('[value="dir-a"]').disabled && !dialog.querySelector('[value="dir-b"]').disabled &&
        dialog.querySelector('[data-outline-move-status]').textContent === '', '目录移动未禁用当前父目录');
      const confirmMove = dialog.querySelector('[data-outline-move-confirm]');
      assert(confirmMove.disabled, '未选目标目录时必须禁止提交');
      const target = dialog.querySelector('[value="dir-b"]');
      target.checked = true; dispatchChange(target);
      assert(!confirmMove.disabled, '选择目标目录后应允许提交');
      // A projection refresh can invalidate a directory selected in an open dialog.
      appState.outlineProjection.detail.nodes[1].kind = 'document';
      confirmMove.click();
      assert(dialog.open && dialog.querySelector('[data-outline-move-status]').textContent === '目标目录无效，请重新选择。',
        '过期目标变成文档时应拒绝移动并保留弹窗');
      dialog.close();
    } finally {
      appState.outlineProjection = previousProjection;
      window.history.replaceState(previousHistoryState, '', previousUrl);
      host.remove();
    }
  });
}

async function exerciseOutlineGovernanceMutations(page) {
  await page.evaluate(async () => {
    const { appState } = await import('/knowledge-center/common/state/app-state.js');
    const assert = (value, message) => { if (!value) throw new Error(message); };
    const previous = { projection: appState.outlineProjection, view: appState.activeView,
      url: location.href, history: history.state, fetch: window.fetch };
    const host = document.createElement('section');
    host.innerHTML = `
      <p class="outline-governance-status"></p>
      <button data-outline-governance-save>保存分工</button><button data-outline-publish>发布</button>
      <input data-outline-description="doc-1" value="批量说明">
      <div data-outline-domain-group="doc-1"><select data-outline-primary-domain><option value="7">主责</option></select>
        <input type="checkbox" data-outline-collaborator-domain value="8" checked>
        <input type="checkbox" data-outline-collaborator-domain value="9"></div>
      <button data-outline-description-edit="doc-1">编辑说明</button>
      <dialog data-outline-description-dialog><h3 data-outline-description-title></h3>
        <textarea data-outline-description-draft></textarea><p data-outline-description-status></p>
        <button data-outline-description-save>保存</button><button data-outline-description-close>关闭</button></dialog>
      <dialog data-outline-move-dialog data-document-id="doc-1">
        <input type="radio" name="outline-target-directory" value="dir-b" checked>
        <button data-outline-move-confirm>移动</button><button data-outline-move-close>关闭</button>
        <p data-outline-move-status></p></dialog>`;
    document.body.append(host);
    const detail = () => ({ id: 'coverage-outline', editVersion: 13,
      nodes: [{ id: 'dir-a', kind: 'directory', children: [{ id: 'doc-1', kind: 'document', title: '测试文档', description: '原说明' }] },
        { id: 'dir-b', kind: 'directory' }],
      governance: { governanceVersion: 5, assignments: [
        { nodeId: 'dir-a', techDomainIds: ['9'] }, { nodeId: 'doc-1', techDomainIds: ['6'] }] } });
    const reset = () => { appState.outlineProjection = { selectedId: 'coverage-outline', detail: detail() }; };
    const requests = [];
    let fail = false;
    let pending = 0;
    window.fetch = async (input, init = {}) => {
      const url = new URL(typeof input === 'string' ? input : input.url, location.origin);
      if (!url.pathname.startsWith('/knowledge-center/api/outline/')) return previous.fetch(input, init);
      if (init.method && init.method !== 'GET') {
        requests.push({ path: url.pathname, method: init.method, body: JSON.parse(init.body) });
        pending++;
        try {
          return new Response(JSON.stringify(fail
            ? { success: false, error: { code: 'TEST_RETRY', message: '覆盖率夹具暂时不可用' } }
            : { success: true, data: { state: 'PUBLISHED' } }),
          { status: fail ? 502 : 200, headers: { 'Content-Type': 'application/json' } });
        } finally { pending--; }
      }
      return new Response(JSON.stringify({ success: true, data: { items: [], total: 0 } }),
        { headers: { 'Content-Type': 'application/json' } });
    };
    const settle = async () => {
      for (let i = 0; i < 5; i++) await new Promise(resolve => setTimeout(resolve, 10));
      assert(!pending, '大纲请求未完成');
    };
    const click = async selector => { host.querySelector(selector).click(); await settle(); };
    const last = () => requests.at(-1);
    try {
      appState.activeView = 'production';
      history.replaceState({}, '', '/knowledge-center/outlines');
      reset();
      const dialog = host.querySelector('[data-outline-description-dialog]');
      await click('[data-outline-description-edit]');
      assert(dialog.open && dialog.querySelector('h3').textContent === '测试文档'
        && dialog.querySelector('textarea').value === '原说明', '说明编辑未回填文档内容');
      await click('[data-outline-description-close]');
      assert(!dialog.open, '说明关闭按钮未关闭弹窗');
      await click('[data-outline-description-edit]');
      dialog.querySelector('textarea').value = '更新说明';
      fail = true;
      await click('[data-outline-description-save]');
      assert(dialog.open && !dialog.querySelector('[data-outline-description-save]').disabled
        && dialog.querySelector('[data-outline-description-status]').textContent.includes('大纲服务暂时不可用'), '说明失败未保留输入和重试');
      assert(last().body.descriptions[0].description === '更新说明' && last().body.editVersion === 13
        && last().body.governanceVersion === 5 && last().body.assignments.length === 2, '说明请求遗漏版本或既有分工');
      fail = false;
      await click('[data-outline-description-save]');
      assert(!dialog.open && document.getElementById('error-title').textContent === '保存完成', '说明成功未关闭或提示');

      reset();
      fail = true;
      await click('[data-outline-governance-save]');
      assert(!host.querySelector('[data-outline-governance-save]').disabled
        && host.querySelector('.outline-governance-status').textContent.includes('大纲服务暂时不可用'), '分工失败未恢复按钮');
      const body = last().body;
      assert(body.editVersion === 13 && body.governanceVersion === 5
        && body.descriptions[0].description === '批量说明'
        && body.assignments.length === 2 && body.assignments[0].nodeId === 'dir-a'
        && JSON.stringify(body.assignments[1].techDomainIds) === '["7","8"]', '分工合并未保留目录或覆盖文档领域');
      fail = false;
      await click('[data-outline-governance-save]');
      assert(host.querySelector('.outline-governance-status').textContent === '目录说明和责任分工已保存。', '分工保存未显示成功');

      reset();
      fail = true;
      await click('[data-outline-publish]');
      assert(!host.querySelector('[data-outline-publish]').disabled
        && host.querySelector('.outline-governance-status').textContent.includes('大纲服务暂时不可用'), '发布失败未恢复按钮');
      assert(last().method === 'POST' && last().path.endsWith('/coverage-outline/publish')
        && last().body.editVersion === 13, '发布请求版本或路径错误');
      fail = false;
      await click('[data-outline-publish]');
      assert(document.getElementById('error-title').textContent === '发布完成', '发布成功未显示结果');

      reset();
      const move = host.querySelector('[data-outline-move-dialog]');
      move.showModal();
      fail = true;
      await click('[data-outline-move-confirm]');
      assert(move.open && !move.querySelector('[data-outline-move-confirm]').disabled
        && move.querySelector('[data-outline-move-status]').textContent.includes('大纲服务暂时不可用'), '移动失败未保留弹窗');
      const order = last().body.directoryOrder;
      assert(order.length === 3 && order.find(node => node.nodeId === 'doc-1').parentNodeId === 'dir-b'
        && order.every((node, index) => node.order === index + 1), '移动未仅更新目标父目录并保留顺序');
      fail = false;
      await click('[data-outline-move-confirm]');
      assert(!move.open && document.getElementById('error-title').textContent === '目录已更新', '移动成功未关闭或提示');
      move.showModal();
      await click('[data-outline-move-close]');
      assert(!move.open, '移动关闭未关闭弹窗');
      assert(requests.length === 8, '治理操作写请求次数异常');
    } finally {
      window.fetch = previous.fetch;
      appState.outlineProjection = previous.projection;
      appState.activeView = previous.view;
      history.replaceState(previous.history, '', previous.url);
      host.remove();
    }
  });
}

async function exerciseIncrementalFormCommands(page) {
  await page.evaluate(async () => {
    const { appState } = await import('/knowledge-center/common/state/app-state.js');
    const previous = { fetch: window.fetch, view: appState.activeView, projection: appState.incrementalProjection };
    const host = document.createElement('section');
    document.body.append(host);
    const assert = (condition, message) => { if (!condition) throw new Error(message); };
    const requests = [];
    let fail = true;
    window.fetch = async (input, init = {}) => {
      const url = new URL(typeof input === 'string' ? input : input.url, location.origin);
      if (!url.pathname.startsWith('/knowledge-center/api/incremental-tasks/coverage-task/')) return previous.fetch(input, init);
      requests.push({ path: url.pathname, method: init.method, body: JSON.parse(init.body), key: init.headers['Idempotency-Key'] });
      return new Response(JSON.stringify(fail
        ? { success: false, error: { code: 'TEST_RETRY', message: '请稍后重试' } }
        : { success: true, data: { id: 'coverage-task' } }),
      { status: fail ? 422 : 200, headers: { 'Content-Type': 'application/json' } });
    };
    const vector = (attribute, fields, path, method, body, message, dataset = '') =>
      ({ attribute, fields, path, method, body, message, dataset });
    const cases = [
      vector('data-incremental-source-form', '<input name="sourceType" value="local-document"><input name="label" value=" 参考资料 "><input name="reference" value=" "><textarea name="content">来源正文</textarea>',
        'sources', 'POST', { sourceType: 'local-document', label: '参考资料', content: '来源正文' }, '来源已固化'),
      vector('data-incremental-target-form', '<textarea name="documentIds"> doc-1, doc-2，\n doc-3 </textarea><input type="checkbox" name="sectionIds" value="section-1" checked><input type="checkbox" name="chapterIds" value="chapter-1" checked><input name="language" value="en">',
        'target', 'PATCH', { documentIds: ['doc-1', 'doc-2', 'doc-3'], sectionIds: ['section-1', 'chapter-1'], language: 'en' }, '修改范围已确认'),
      ...['add', 'update', 'delete', 'move'].map(type => vector('data-incremental-draft-form',
        `<input name="operationType" value="${type}"><input name="operationDocumentId" value="doc-1"><input name="nodeId" value=" node-1 "><input name="beforeDigest" value=" digest-1 "><textarea name="afterContent">修改正文</textarea><input name="targetParentId" value=" dir-2 "><input name="ordinal" value="3"><textarea name="content">完整草稿</textarea>`,
        'draft', 'PUT', { editVersion: 7, content: '完整草稿', operations: [{ type, documentId: 'doc-1', nodeId: 'node-1',
          ...(['update', 'delete', 'move'].includes(type) ? { beforeDigest: 'digest-1' } : {}),
          ...(['add', 'update'].includes(type) ? { after: { content: '修改正文' } } : {}),
          ...(type === 'move' ? { targetParentId: 'dir-2', ordinal: 3 } : {}) }] }, '草稿已保存')),
      vector('data-review-comment-form', '<textarea name="comment"> 审核评论 </textarea><input name="candidateDigest" value=""><input name="anchor" value=""><select name="mentions" multiple></select>',
        'reviews/review-1/comments', 'POST', { comment: '审核评论', commentType: 'suggestion', severity: 'normal', candidateDigest: '', mentions: [] }, '意见已添加', 'data-review-id="review-1"'),
      ...['', '{broken', 'null', '{"documentId":"doc-1","anchorKind":"document_span","nodeId":"node-1"}'].map((anchor, index) => vector('data-review-comment-form',
        `<textarea name="comment"> 审核意见 </textarea><input name="candidateDigest" value="digest-1"><input name="anchor" value='${anchor}'><select name="mentions" multiple>${index === 3 ? '<option value="" selected>请选择</option><option value="HB-mentioned" selected>关联手册</option>' : ''}</select>${index === 3 ? '<input name="commentType" value="issue"><input name="severity" value="blocker">' : ''}`,
        'reviews/review-1/comments', 'POST', { comment: '审核意见', commentType: index === 3 ? 'issue' : 'suggestion',
          severity: index === 3 ? 'blocker' : 'normal', candidateDigest: 'digest-1', mentions: index === 3 ? [{ handbookId: 'HB-mentioned' }] : [],
          ...(index === 3 ? { anchor: { documentId: 'doc-1', anchorKind: 'document_span', nodeId: 'node-1' } } : {}) }, index === 3 ? '意见已保存，通知状态请查看结果' : '意见已添加', 'data-review-id="review-1"')),
      vector('data-review-reply-form', '<textarea name="comment"> 回复结论 </textarea>',
        'reviews/review-1/comments/comment-1/replies', 'POST', { comment: '回复结论' }, '回复已发送', 'data-review-id="review-1" data-comment-id="comment-1"'),
      ...['digest-1', ''].map(digest => vector('data-review-decision-form', '<textarea name="comment"> 需要补充证据 </textarea>',
        'reviews/review-1/decision', 'POST', { decision: 'reject', comment: '需要补充证据', candidateDigest: digest },
        '修改稿已退回', `data-review-id="review-1" data-candidate-digest="${digest}"`)),
      vector('data-incremental-evidence-form', '<input name="type" value="test-report"><input name="reference" value=" report-1 "><input name="status" value="passed"><textarea name="note"> 验证通过 </textarea>',
        'external-evidence', 'POST', { type: 'test-report', reference: 'report-1', status: 'passed', note: '验证通过' }, '外部证据已登记'),
    ];
    try {
      // Keep this DOM delegation matrix independent of page reloads; full
      // production-page navigation is exercised by the writing E2E suite.
      appState.activeView = 'dashboard';
      appState.incrementalProjection = { detail: { task: { draft: { editVersion: 7 } } } };
      for (const item of cases) {
        host.innerHTML = `<form ${item.attribute} data-task-id="coverage-task" ${item.dataset}>${item.fields}<button type="submit">保存</button><p class="incremental-form-status"></p></form>`;
        const form = host.querySelector('form'), button = form.querySelector('button'), status = form.querySelector('p');
        const submit = async expected => {
          form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true, submitter: button }));
          for (let attempt = 0; attempt < 100 && status.textContent !== expected; attempt++)
            await new Promise(resolve => setTimeout(resolve, 5));
          assert(status.textContent === expected, `${item.path} 状态不符：${status.textContent}`);
        };
        fail = true;
        await submit('请稍后重试');
        assert(!button.disabled && status.classList.contains('error'), `${item.path} 失败未恢复按钮与错误提示`);
        const first = requests.at(-1);
        assert(first.path === `/knowledge-center/api/incremental-tasks/coverage-task/${item.path}`
          && first.method === item.method && JSON.stringify(first.body) === JSON.stringify(item.body), `${item.path} 请求序列化错误：${JSON.stringify(first)}`);
        fail = false;
        await submit(item.message);
        const retry = requests.at(-1);
        assert(!status.classList.contains('error') && first.key && first.key === retry.key, `${item.path} 重试未保留幂等键或清除错误`);
        assert(JSON.stringify(retry.body) === JSON.stringify(first.body), `${item.path} 重试改变请求正文`);
      }
      assert(requests.length === cases.length * 2, '增量任务表单请求次数不符');
    } finally {
      window.fetch = previous.fetch;
      appState.activeView = previous.view;
      appState.incrementalProjection = previous.projection;
      host.remove();
    }
  });
}

async function exerciseOnlineReviewPreflight(page) {
  await page.evaluate(async () => {
    const originalFetch = window.fetch;
    const host = document.createElement('section');
    document.body.append(host);
    const requests = [];
    let response = 'network';
    window.fetch = async (input, init = {}) => {
      const url = new URL(typeof input === 'string' ? input : input.url, location.origin);
      if (url.pathname !== '/knowledge-center/api/production/handbooks/coverage-handbook/incremental-reviews')
        return originalFetch(input, init);
      requests.push({ method: init.method, body: JSON.parse(init.body) });
      if (response === 'network') throw new TypeError('Failed to fetch');
      return new Response(JSON.stringify({ success: true, data: {} }),
        { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    const scenarios = [
      { selected: 0, message: '请选择至少一篇已保存修改稿' },
      { selected: 2, scope: 'document', message: '单篇文档评审只能选择一篇修改稿' },
      { reviewer: '', message: '请选择审核人' },
      { path: '', message: '请填写每篇文档的完整仓库文件路径' },
      { selected: 2, mixed: true, message: '一次在线评审只能提交同一目标分支' },
      { message: '无法连接平台服务，请检查网络后重试。', request: true },
      { message: '服务端没有返回审核任务', request: true, response: 'empty' },
    ];
    try {
      for (const item of scenarios) {
        response = item.response || 'network';
        const selected = item.selected ?? 1;
        host.innerHTML = `<form data-review-online-form data-handbook-id="coverage-handbook" data-business-version=" v1 ">
          <input name="scope" value="${item.scope || 'handbook'}"><input name="reviewerId" value="${item.reviewer ?? 'reviewer-1'}">
          <textarea name="note"> 请审核 </textarea>${[0, 1].map(index => `<input type="checkbox" data-review-online-draft
            data-document-id="doc-${index}" data-outline-version-id="outline-1" data-branch="${item.mixed && index === 1 ? 'other' : 'main'}"
            data-revision-id="revision-${index}" ${index < selected ? 'checked' : ''}>
            <input data-review-online-path="doc-${index}" value="${item.path ?? ` docs/doc-${index}.md `}">`).join('')}
          <button type="submit">提交在线评审</button><p data-review-online-error hidden tabindex="-1"></p></form>`;
        const form = host.querySelector('form'), button = form.querySelector('button'), error = form.querySelector('p');
        const before = requests.length;
        form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true, submitter: button }));
        for (let attempt = 0; attempt < 100 && (error.hidden || button.disabled); attempt++)
          await new Promise(resolve => setTimeout(resolve, 5));
        if (error.hidden || error.textContent !== item.message || button.disabled || document.activeElement !== error)
          throw new Error(`在线评审错误提示或恢复异常：${item.message} / ${error.textContent}`);
        if (requests.length !== before + (item.request ? 1 : 0)) throw new Error('在线评审前置校验请求次数错误');
        if (item.request) {
          const expected = { reviewMode: 'online_review', scope: 'handbook', businessVersion: 'v1',
            defaultReviewerIds: ['reviewer-1'], documents: [{ documentId: 'doc-0', outlineVersionId: 'outline-1',
              branch: 'main', draftRevisionId: 'revision-0', filePath: 'docs/doc-0.md' }], note: '请审核' };
          if (requests.at(-1).method !== 'POST' || JSON.stringify(requests.at(-1).body) !== JSON.stringify(expected))
            throw new Error(`在线评审请求字段不符：${JSON.stringify(requests.at(-1))}`);
        }
      }
    } finally {
      window.fetch = originalFetch;
      host.remove();
    }
  });
}

async function exerciseHandbookDrawers(page) {
  await page.evaluate(async () => {
    const { appState } = await import('/knowledge-center/common/state/app-state.js');
    const previous = { view: appState.activeView, ui: appState.handbookProductionUi, focus: document.activeElement };
    const host = document.createElement('section');
    host.innerHTML = `<button data-handbook-directory-open>目录</button><button data-handbook-assistant-open>助手</button>
      <button class="handbook-directory-backdrop" data-handbook-directory-close>关闭目录背景</button>
      <aside class="handbook-production-directory"><input data-handbook-directory-search><button data-handbook-directory-close>关闭目录</button></aside>
      <button class="handbook-assistant-backdrop" data-handbook-assistant-close>关闭助手背景</button>
      <aside class="handbook-assistant-panel"><button role="tab" data-handbook-assistant-tab="chat">对话</button>
        <button role="tab" data-handbook-assistant-tab="evidence">依据</button>
        <section data-handbook-assistant-content="chat">对话内容</section><section data-handbook-assistant-content="evidence" hidden>依据内容</section>
        <button data-handbook-assistant-close>关闭助手</button></aside><dialog><button>对话框操作</button></dialog>`;
    document.body.prepend(host);
    const find = selector => host.querySelector(selector);
    const assert = (condition, message) => { if (!condition) throw new Error(message); };
    const frame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const click = async selector => { find(selector).click(); await frame(); };
    const escape = async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await frame();
    };
    const state = (directory, assistant) => {
      assert(appState.handbookProductionUi.directoryDrawerOpen === directory
        && appState.handbookProductionUi.assistantOpen === assistant, '手册抽屉互斥状态错误');
      for (const [selector, visible] of [['.handbook-production-directory', directory], ['.handbook-directory-backdrop', directory],
        ['.handbook-assistant-panel', assistant], ['.handbook-assistant-backdrop', assistant]]) {
        assert(find(selector).classList.contains('is-open') === visible
          && find(selector).getAttribute('aria-hidden') === String(!visible), `${selector} 显示与可访问性不同步`);
      }
      assert(find('[data-handbook-directory-open]').getAttribute('aria-expanded') === String(directory)
        && find('[data-handbook-assistant-open]').getAttribute('aria-expanded') === String(assistant), '抽屉入口展开属性错误');
    };
    try {
      appState.activeView = 'production';
      appState.handbookProductionUi = { ...previous.ui, directoryDrawerOpen: false, assistantOpen: false, focusMode: false };
      await click('[data-handbook-directory-open]'); state(true, false);
      assert(document.activeElement === find('input'), '打开目录未聚焦搜索');
      await click('[data-handbook-directory-open]'); state(false, false);
      await click('[data-handbook-directory-open]');
      await click('[data-handbook-assistant-open]'); state(false, true);
      assert(document.activeElement === find('[role=tab]'), '打开助手未聚焦页签');
      for (const tab of ['evidence', 'chat']) {
        await click(`[data-handbook-assistant-tab="${tab}"]`);
        assert(appState.handbookProductionUi.assistantTab === tab, '助手页签状态未保存');
        for (const node of host.querySelectorAll('[data-handbook-assistant-tab]'))
          assert(node.getAttribute('aria-selected') === String(node.dataset.handbookAssistantTab === tab), '助手页签选中状态错误');
        for (const node of host.querySelectorAll('[data-handbook-assistant-content]'))
          assert(node.hidden === (node.dataset.handbookAssistantContent !== tab), '助手页签面板可见性错误');
      }
      await click('[data-handbook-directory-open]'); state(true, false);
      await click('aside [data-handbook-directory-close]'); state(false, false);
      assert(document.activeElement === find('[data-handbook-directory-open]'), '关闭目录未恢复焦点');
      await click('[data-handbook-assistant-open]');
      await click('aside [data-handbook-assistant-close]'); state(false, false);
      assert(document.activeElement === find('[data-handbook-assistant-open]'), '关闭助手未恢复焦点');
      for (const kind of ['directory', 'assistant']) {
        await click(`[data-handbook-${kind}-open]`);
        find('dialog').showModal();
        await escape(); state(kind === 'directory', kind === 'assistant');
        find('dialog').close();
        appState.activeView = 'dashboard';
        await escape(); state(kind === 'directory', kind === 'assistant');
        appState.activeView = 'production';
        await escape(); state(false, false);
        assert(document.activeElement === find(`[data-handbook-${kind}-open]`), 'Escape 未恢复入口焦点');
        await click(`[data-handbook-${kind}-open]`);
        await click(`.handbook-${kind === 'directory' ? 'directory' : 'assistant'}-backdrop`); state(false, false);
      }
    } finally {
      find('dialog').close();
      appState.activeView = previous.view;
      appState.handbookProductionUi = previous.ui;
      host.remove();
      previous.focus?.focus();
    }
  });
}

async function exerciseExternalAccountRecovery(page) {
  await page.evaluate(async () => {
    const { appState } = await import('/knowledge-center/common/state/app-state.js');
    const originalFetch = window.fetch, previous = appState.gitlabAccountProjection;
    const dialog = document.getElementById('external-account-dialog');
    const content = document.getElementById('external-account-content');
    const previousContent = content.innerHTML, wasOpen = dialog.open;
    const requests = [];
    let readFailure = true, disconnectFailure = true, empty = false;
    const assert = (condition, message) => { if (!condition) throw new Error(message); };
    const until = async (predicate, message) => {
      for (let attempt = 0; attempt < 200 && !predicate(); attempt++) await new Promise(resolve => setTimeout(resolve, 5));
      assert(predicate(), message);
    };
    window.fetch = async (input, init = {}) => {
      const url = new URL(typeof input === 'string' ? input : input.url, location.origin);
      if (!['/knowledge-center/api/gitlab/oauth/accounts', '/knowledge-center/api/gitlab/oauth/disconnect'].includes(url.pathname))
        return originalFetch(input, init);
      requests.push({ path: url.pathname, query: url.searchParams.get('connectionId'), method: init.method || 'GET', key: init.headers?.['Idempotency-Key'] });
      const failure = url.pathname.endsWith('/accounts') ? readFailure : disconnectFailure;
      if (!failure && url.pathname.endsWith('/disconnect')) empty = true;
      const items = ['connected', 'disconnected', 'temporarily_unavailable', 'reauthorization_required', 'platform_disabled'].map((status, i) =>
        ({ connectionId: `coverage-${i}`, name: `连接 ${i}`, host: 'https://gitlab.invalid', status, ...(i === 0 ? { lastUsedAt: '2026-11-01T00:00:00Z' } : {}) }));
      return new Response(JSON.stringify(failure ? { success: false, error: { message: '隔离账号服务失败' } }
        : { success: true, data: url.pathname.endsWith('/accounts') ? { items: empty ? [] : items } : {} }),
      { status: failure ? 503 : 200, headers: { 'Content-Type': 'application/json' } });
    };
    try {
      dialog.close();
      document.getElementById('external-account-open').click();
      assert(dialog.open, '外部账号弹窗未打开');
      await until(() => !!content.querySelector('[data-external-account-retry]'), '账号读取失败未显示重试');
      assert(content.textContent.includes('隔离账号服务失败'), '账号读取错误未显示');
      readFailure = false;
      content.querySelector('[data-external-account-retry]').click();
      await until(() => content.querySelectorAll('.external-account-item').length === 5, '重试未渲染所有账号状态');
      assert(content.querySelectorAll('[data-external-account-disconnect]').length === 2
        && content.textContent.includes('原连接已失效，请重新授权。') && content.textContent.includes('该连接已由平台管理员停用。')
        && content.textContent.includes('最近使用'), '账号状态、解除权限或最近使用信息错误');
      const before = requests.length;
      content.querySelector('h3').click();
      assert(dialog.open && requests.length === before, '普通内容点击不应关闭或调用接口');
      content.querySelector('[data-external-account-disconnect="coverage-0"]').click();
      await until(() => !!content.querySelector('[data-external-account-retry]'), '解除失败未恢复错误提示');
      assert(requests.at(-1).method === 'POST' && requests.at(-1).query === 'coverage-0' && requests.at(-1).key,
        '解除账号请求缺少连接或幂等键');
      content.querySelector('[data-external-account-retry]').click();
      await until(() => !!content.querySelector('[data-external-account-disconnect]'), '解除失败后无法恢复列表');
      disconnectFailure = false;
      content.querySelector('[data-external-account-disconnect="coverage-0"]').click();
      await until(() => !!content.querySelector('.external-account-empty'), '解除成功未重新读取空账号列表');
      assert(requests.at(-1).path.endsWith('/accounts'), '解除成功未重新读取账号');
      document.getElementById('external-account-close').click();
      assert(!dialog.open, '关闭按钮未关闭账号弹窗');
      document.getElementById('external-account-open').click();
      await until(() => appState.gitlabAccountProjection?.status === 'ok', '重新打开账号弹窗未读取状态');
      dialog.click();
      assert(!dialog.open, '账号弹窗背景点击未关闭');
    } finally {
      window.fetch = originalFetch;
      appState.gitlabAccountProjection = previous;
      content.innerHTML = previousContent;
      dialog.close();
      if (wasOpen) dialog.showModal();
    }
  });
}

async function exercisePrincipalEditor(page) {
  const requests = [];
  let failure = '';
  const routePattern = '**/knowledge-center/api/platform/principals**';
  const principal = { principalId: 73, rowVersion: 4, displayName: '覆盖率人员', casLoginName: 'old.cas', state: 'ACTIVE' };
  const route = async request => {
    const method = request.request().method();
    if (method === 'GET') {
      await request.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { items: [principal] } }) });
      return;
    }
    requests.push({ method, path: new URL(request.request().url()).pathname, body: request.request().postDataJSON() });
    if (failure) {
      await request.fulfill({ status: failure === 'CAS_LOGIN_NAME_CONFLICT' ? 409 : 500, contentType: 'application/json',
        body: JSON.stringify({ success: false, error: { code: failure, message: '隔离保存失败' } }) });
      return;
    }
    await request.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { ...principal, ...requests.at(-1).body } }) });
  };
  await page.route(routePattern, route);
  await page.evaluate(async item => {
    const { appState } = await import('/knowledge-center/common/state/app-state.js');
    const { renderPrincipalsTab } = await import('/knowledge-center/modules/platform-admin/view.js');
    window.__principalCoverageView = appState.activeView;
    window.__principalCoverageProjection = appState.principalProjection;
    appState.activeView = 'dashboard';
    appState.principalProjection = { status: 'ok', items: [item] };
    const host = document.createElement('section');
    host.id = 'principal-coverage-host';
    host.innerHTML = renderPrincipalsTab(appState.principalProjection);
    document.body.prepend(host);
  }, principal);
  const host = page.locator('#principal-coverage-host');
  const editor = host.locator('[data-principal-editor-dialog]');
  const correction = host.locator('[data-principal-cas-correction-dialog]');
  try {
    failure = 'ISOLATED_FAILURE';
    await host.locator('[data-principal-open-create]').click();
    await editor.locator('[name=displayName]').fill('新增人员');
    await editor.locator('[name=casLoginName]').fill('new.cas');
    await editor.locator('button[type=submit]').click();
    await editor.locator('[data-principal-form-status]').getByText('隔离保存失败').waitFor();
    if (!await editor.evaluate(node => node.open)) throw new Error('人员新增失败后编辑弹框意外关闭');
    failure = '';
    await editor.locator('button[type=submit]').click();
    await editor.waitFor({ state: 'hidden' });
    if (requests.at(-1)?.method !== 'POST' || requests.at(-1)?.body?.casLoginName !== 'new.cas')
      throw new Error('人员新增未提交预期 CAS 登录名');

    await host.locator('[data-principal-edit="73"]').click();
    if (await editor.locator('[name=casLoginName]').isDisabled()) throw new Error('未登录的预绑定人员应允许更正');
    await editor.locator('[name=casLoginName]').fill('corrected.cas');
    await editor.locator('button[type=submit]').click();
    await correction.waitFor({ state: 'visible' });
    if (!await correction.locator('[data-principal-correction-before]').getByText('old.cas').count()
        || !await correction.locator('[data-principal-correction-after]').getByText('corrected.cas').count())
      throw new Error('CAS 更正确认未显示前后账号');
    failure = 'CAS_LOGIN_NAME_CONFLICT';
    await correction.locator('button[type=submit]').click();
    try {
      await editor.locator('[data-principal-login-error]').getByText('该 CAS 登录名已绑定其他人员，请核对后重新填写。').waitFor({ timeout: 3000 });
    } catch (error) {
      const state = await page.evaluate(() => ({
        dialogs: Array.from(document.querySelectorAll('[data-principal-editor-dialog], [data-principal-cas-correction-dialog]'))
          .map(dialog => ({ open: dialog.open, status: dialog.querySelector('[data-principal-form-status], [data-principal-correction-status]')?.textContent,
            loginError: dialog.querySelector('[data-principal-login-error]')?.textContent })),
      }));
      throw new Error(`CAS 冲突反馈缺失：${JSON.stringify({ requests, state })}`, { cause: error });
    }
    if (await editor.locator('[name=casLoginName]').getAttribute('aria-invalid') !== 'true')
      throw new Error('CAS 登录名冲突未标记输入字段');
    failure = '';
    await editor.locator('button[type=submit]').click();
    await correction.waitFor({ state: 'visible' });
    await correction.locator('button[type=submit]').click();
    await correction.waitFor({ state: 'hidden' });
    await editor.waitFor({ state: 'hidden' });
    if (requests.at(-1)?.method !== 'PATCH' || !requests.at(-1)?.path.endsWith('/73')
        || requests.at(-1)?.body?.rowVersion !== 4 || requests.at(-1)?.body?.casLoginName !== 'corrected.cas')
      throw new Error('CAS 更正请求缺少人员版本或目标账号');
  } finally {
    await page.evaluate(() => {
      const host = document.querySelector('#principal-coverage-host');
      host?.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
      host?.remove();
    });
    await page.evaluate(async () => {
      const { appState } = await import('/knowledge-center/common/state/app-state.js');
      appState.activeView = window.__principalCoverageView;
      appState.principalProjection = window.__principalCoverageProjection;
      delete window.__principalCoverageView;
      delete window.__principalCoverageProjection;
    });
    await page.unroute(routePattern, route);
  }
}

async function exerciseTeamMembershipEditor(page) {
  await page.evaluate(async () => {
    const { appState } = await import('/knowledge-center/common/state/app-state.js');
    const { renderPrincipalsTab } = await import('/knowledge-center/modules/platform-admin/view.js');
    const previousProjection = appState.principalProjection;
    const people = [11, 12, 13].map(principalId => ({ principalId, displayName: `团队人员${principalId}`, state: 'ACTIVE' }));
    const host = document.createElement('section');
    host.id = 'team-membership-coverage-host';
    appState.principalProjection = { status: 'ok', items: people };
    host.innerHTML = renderPrincipalsTab(appState.principalProjection, {}, { status: 'ok', items: [{
      teamGroupId: 71, groupName: '隔离名册', rowVersion: 4, leader: people[0], members: [people[1]],
    }] }, 'groups');
    document.body.prepend(host);
    try {
      const form = host.querySelector('[data-team-group-form]');
      const candidate = form.querySelector('[data-team-member-candidate]');
      const leader = form.querySelector('[name="leaderPrincipalId"]');
      const status = () => form.querySelector('[data-team-group-status]').textContent;
      const members = () => [...form.querySelectorAll('[name="memberPrincipalIds"]')].map(input => input.value).sort().join(',');
      const assert = (condition, message) => { if (!condition) throw new Error(`团队名册：${message}`); };
      const add = () => form.querySelector('[data-team-member-add]').click();
      const remove = id => form.querySelector(`[data-team-member-remove="${id}"]`).click();
      add();
      assert(status() === '请先选择需要添加的人员。' && members() === '12', '空选择应保留原成员并提示');
      candidate.value = '13';
      add();
      assert(members() === '12,13' && !candidate.querySelector('option[value="13"]') && candidate.value === '', '添加后隐藏ID、候选列表或选择未更新');
      // 已打开页面可能保留旧候选，验证防重复校验仍能保护名册。
      const staleOption = new Option('团队人员13', '13');
      candidate.add(staleOption);
      candidate.value = '13';
      add();
      assert(status() === '该人员已经在团队中。' && members() === '12,13', '旧候选重复加入未被拒绝');
      staleOption.remove();
      const staleLeader = new Option('团队人员11', '11');
      candidate.add(staleLeader);
      candidate.value = '11';
      add();
      assert(status() === '负责人不需要重复添加为普通成员。' && members() === '12,13', '负责人重复加入未被拒绝');
      staleLeader.remove();
      remove('13');
      assert(members() === '12' && candidate.querySelector('option[value="13"]')?.dataset.displayName === '团队人员13', '移除成员未恢复候选人员');
      remove('12');
      assert(members() === '' && form.querySelector('[data-team-member-empty]'), '最后一名成员移除后缺少空态');
      candidate.value = '12';
      add();
      assert(members() === '12' && !form.querySelector('[data-team-member-empty]'), '添加成员未移除空态');
      leader.value = '12';
      leader.dispatchEvent(new Event('change', { bubbles: true }));
      assert(members() === '11' && form.dataset.currentLeaderId === '12' && status() === '负责人已修改。', '切换负责人未保留前负责人或移除新负责人');
      // 重复选择当前负责人应保持成员不变。
      leader.dispatchEvent(new Event('change', { bubbles: true }));
      assert(members() === '11', '重复选择负责人改变了成员');
      leader.value = '13';
      leader.dispatchEvent(new Event('change', { bubbles: true }));
      assert(members() === '11,12' && !candidate.querySelector('option[value="13"]'), '候选人员成为负责人后未退出候选');
      leader.value = '';
      leader.dispatchEvent(new Event('change', { bubbles: true }));
      form.querySelector('[data-team-group-save]').click();
      assert(status() === '必须选择一名负责人。' && document.activeElement === leader, '无负责人应禁止保存并聚焦');
      assert(!form.querySelector('[data-team-group-save]').disabled, '校验失败错误地禁用了保存');
      host.querySelector('[data-team-group-create]').click();
      const dialog = host.querySelector('[data-team-group-create-dialog]');
      assert(dialog.open, '创建对话框未打开');
      dialog.querySelector('[data-team-group-create-close]').click();
      assert(!dialog.open, '创建对话框未关闭');
    } finally {
      host.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
      host.remove();
      appState.principalProjection = previousProjection;
    }
  });
}

async function exerciseOutlineImport(page) {
  let calls = 0;
  const route = async request => {
    const pathname = new URL(request.request().url()).pathname;
    if (pathname.endsWith('/validate')) {
      calls += 1;
      await request.fulfill({ status: calls === 1 ? 200 : 422, contentType: 'application/json',
        body: JSON.stringify(calls === 1
          ? { success: true, data: { documentCount: 1 } }
          : { success: false, error: { message: '大纲校验失败' }, data: { errors: [
            { row: 2, column: '路径', message: '层级错误', path: 'A', suggestion: '修正路径' },
          ] } }) });
      return;
    }
    if (pathname.endsWith('/import')) {
      calls += 1;
      await request.fulfill({ status: calls === 1 ? 409 : 200, contentType: 'application/json',
        body: JSON.stringify(calls === 1
          ? { success: false, error: { message: '候选已存在' }, data: { items: [{ status: 'duplicate_confirmation_required' }] } }
          : { success: true, data: { name: '新候选' } }) });
      return;
    }
    if (pathname.endsWith('/list')) {
      await request.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
      return;
    }
    await request.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { items: [] } }) });
  };
  const handbookRoute = request => request.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ success: true, data: { items: [] } }) });
  await page.route('**/knowledge-center/api/outline/**', route);
  await page.route('**/knowledge-center/api/assets/handbooks*', handbookRoute);
  await page.evaluate(async () => {
    const { appState } = await import('/knowledge-center/common/state/app-state.js');
    window.__outlineImportCoverageProjection = appState.outlineProjection;
    const host = document.createElement('section');
    host.id = 'outline-import-coverage-host';
    host.innerHTML = '<form data-outline-import data-handbook-id="HB-COVERAGE"><input type="file" name="file" multiple><button type="submit" data-outline-validate>校验大纲</button><button type="submit" data-outline-import-submit>导入候选</button><span data-outline-import-status></span><ol data-outline-import-results></ol></form>';
    document.body.append(host);
    window.__outlineImportCoverageConfirm = window.confirm;
    window.confirm = () => true;
  });
  const host = page.locator('#outline-import-coverage-host');
  const form = host.locator('form');
  try {
    await form.evaluate(node => node.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true })));
    await host.locator('[data-outline-import-status]').getByText('请选择要导入的文件').waitFor();
    await form.locator('input[type=file]').setInputFiles([
      { name: '有效.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('valid') },
      { name: '无效.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('invalid') },
    ]);
    await form.locator('[data-outline-validate]').click();
    await host.locator('[data-outline-import-status]').getByText('校验完成：通过 1 个，未通过 1 个').waitFor();
    if (!await host.locator('[data-outline-import-results]').getByText('第2行 · 路径：层级错误（A）；建议：修正路径').count())
      throw new Error('大纲校验失败未展示行列与修复建议');
    if (calls !== 2) throw new Error(`大纲逐文件校验请求数错误：${calls}`);

    calls = 0;
    await form.locator('input[type=file]').setInputFiles({ name: '重复.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('duplicate') });
    await form.locator('[data-outline-import-submit]').click();
    await host.locator('[data-outline-import-status]').getByText('导入完成：通过 1 个，未通过 0 个').waitFor();
    await page.waitForFunction(() => !document.querySelector('#outline-import-coverage-host [data-outline-import-submit]')?.disabled);
    if (calls !== 2 || !await host.locator('[data-outline-import-results]').getByText('重复.xlsx：导入成功，新候选').count())
      throw new Error('重复大纲确认后未完成导入');
  } finally {
    await page.evaluate(async () => {
      const { appState } = await import('/knowledge-center/common/state/app-state.js');
      appState.outlineProjection = window.__outlineImportCoverageProjection;
      delete window.__outlineImportCoverageProjection;
      window.confirm = window.__outlineImportCoverageConfirm;
      delete window.__outlineImportCoverageConfirm;
      document.querySelector('#outline-import-coverage-host')?.remove();
    });
    await page.unroute('**/knowledge-center/api/assets/handbooks*', handbookRoute);
    await page.unroute('**/knowledge-center/api/outline/**', route);
  }
}

async function exerciseReviewLocalControls(page) {
  await page.evaluate(async () => {
    const { appState } = await import('/knowledge-center/common/state/app-state.js');
    const assert = (condition, message) => { if (!condition) throw new Error(message); };
    const previousUi = { ...appState.reviewUi };
    const previousDrawers = [...document.querySelectorAll('[data-review-comment-drawer], .review-evidence-drawer')]
      .map(node => [node, node.open]);
    const previousLines = [...document.querySelectorAll('[data-review-line]')]
      .map(node => [node, node.classList.contains('selected')]);
    const host = document.createElement('section');
    host.innerHTML = `
      <details class="review-comment-drawer" data-review-comment-drawer><summary>意见</summary><button data-review-panel-close>关闭意见</button></details>
      <details class="review-evidence-drawer"><summary>依据</summary></details>
      <article data-review-opinion>
        <button data-review-reply-toggle aria-expanded="false">回复</button>
        <form data-review-reply-form hidden><textarea></textarea><button type="button" data-review-reply-cancel>取消</button></form>
      </article>
      <button data-review-reply-toggle data-orphan>无回复表单</button>
      <button class="review-line-button" data-review-line="7" data-document-id="doc-local" data-node-id="node-local" data-anchor-kind="baseline">基线行</button>
      <button class="review-line-button" data-review-line="8" data-document-id="doc-local" data-node-id="node-local">候选行</button>
      <button class="review-line-button" data-review-line="9">未定位行</button>
      <button class="review-line-button" data-review-line="10" data-document-id="doc-local">缺少节点</button>
      <form data-review-comment-form><input name="anchor"><span data-review-anchor-status></span></form>
      <article>
        <button data-incremental-prototype-toggle="sources">展开来源</button>
        <section data-incremental-prototype-panel="sources" hidden><input aria-label="来源"></section>
      </article>
      <article>
        <button data-incremental-prototype-toggle="legacy">旧版输入</button>
        <form data-incremental-prototype-form hidden><input aria-label="需求"></form>
      </article>
      <button data-incremental-prototype-toggle="missing">缺少面板</button>
      <section class="incremental-generation-console"><button data-incremental-prototype-generate>启动</button><span class="incremental-prototype-status"></span></section>
      <section><button data-incremental-prototype-publish>确认发布</button><span class="incremental-prototype-status"></span></section>
      <button data-incremental-prototype-generate data-missing-status>无状态启动</button>
      <button data-incremental-prototype-publish data-missing-status>无状态发布</button>
      <button data-production-tab="sources">来源</button><button data-production-tab="strategy">策略</button><button data-production-tab="tasks">任务</button>
      <section id="production-sources"></section><section id="production-strategy" hidden></section><section id="production-tasks" hidden></section>`;
    for (const id of ['production-sources', 'production-strategy', 'production-tasks']) {
      assert(!document.getElementById(id), `局部生产页签夹具与现有页面重复：${id}`);
    }
    document.body.prepend(host);
    const find = selector => host.querySelector(selector);
    const click = selector => find(selector).click();
    try {
      appState.reviewUi.sidebarPanel = '';
      click('.review-comment-drawer summary');
      assert(appState.reviewUi.sidebarPanel === 'comments' && find('[data-review-comment-drawer]').open
        && !find('.review-evidence-drawer').open, '意见侧栏未独立展开');
      click('.review-evidence-drawer summary');
      assert(appState.reviewUi.sidebarPanel === 'evidence' && !find('[data-review-comment-drawer]').open
        && find('.review-evidence-drawer').open, '依据侧栏未关闭意见侧栏');
      click('.review-evidence-drawer summary');
      assert(appState.reviewUi.sidebarPanel === '' && !find('.review-evidence-drawer').open, '再次点击未收起依据侧栏');
      click('.review-comment-drawer summary');
      click('[data-review-panel-close]');
      assert(appState.reviewUi.sidebarPanel === '' && !find('[data-review-comment-drawer]').open, '关闭按钮未清理侧栏状态');

      click('[data-review-opinion] [data-review-reply-toggle]');
      assert(!find('[data-review-reply-form]').hidden && document.activeElement === find('textarea')
        && find('[data-review-opinion] [data-review-reply-toggle]').getAttribute('aria-expanded') === 'true', '回复展开未同步焦点与可访问性');
      click('[data-review-opinion] [data-review-reply-toggle]');
      assert(find('[data-review-reply-form]').hidden, '再次点击回复未收起');
      click('[data-review-opinion] [data-review-reply-toggle]');
      click('[data-review-reply-cancel]');
      assert(find('[data-review-reply-form]').hidden
        && find('[data-review-opinion] [data-review-reply-toggle]').getAttribute('aria-expanded') === 'false', '取消回复未还原按钮状态');
      click('[data-orphan]');
      assert(find('[data-orphan]').getAttribute('aria-expanded') === null, '无意见容器的回复按钮不应产生展开状态');

      for (const [line, kind] of [[7, 'baseline'], [8, 'after_operation']]) {
        click(`[data-review-line="${line}"]`);
        const anchor = JSON.parse(find('[name=anchor]').value);
        assert(anchor.documentId === 'doc-local' && anchor.nodeId === 'node-local' && anchor.anchorKind === kind
          && anchor.lineRange.startLine === line && anchor.lineRange.endLine === line, '行意见锚点未保留文档、段落及版本');
        assert(find('[data-review-anchor-status]').textContent === `已定位第 ${line} 行`
          && host.querySelectorAll('[data-review-line].selected').length === 1, '行意见定位状态或单选样式错误');
      }
      for (const line of [9, 10]) {
        click(`[data-review-line="${line}"]`);
        assert(find('[name=anchor]').value === ''
          && find('[data-review-anchor-status]').textContent.includes('全文意见'), '缺少文档或段落时未回退全文意见');
      }
      find('[data-review-comment-form]').remove();
      click('[data-review-line="7"]');
      assert(find('[data-review-line="7"]').classList.contains('selected'), '无评论表单时仍应选中行');

      for (const [name, selector] of [['sources', '[data-incremental-prototype-panel]'], ['legacy', '[data-incremental-prototype-form]']]) {
        click(`[data-incremental-prototype-toggle="${name}"]`);
        assert(!find(selector).hidden && document.activeElement === find(`${selector} input`), '原型面板展开未聚焦输入');
        click(`[data-incremental-prototype-toggle="${name}"]`);
        assert(find(selector).hidden, '原型面板再次点击未收起');
      }
      click('[data-incremental-prototype-toggle="missing"]');
      click('.incremental-generation-console [data-incremental-prototype-generate]');
      assert(find('.incremental-generation-console button').disabled
        && find('.incremental-generation-console .incremental-prototype-status').textContent.includes('等待真实 Agent 接口接入'), '启动意图状态错误');
      click('section > [data-incremental-prototype-publish]');
      const publish = find('section > [data-incremental-prototype-publish]');
      assert(publish.disabled && publish.parentElement.textContent.includes('服务端事务'), '发布意图状态错误');
      click('[data-incremental-prototype-generate][data-missing-status]');
      click('[data-incremental-prototype-publish][data-missing-status]');
      assert(find('[data-incremental-prototype-generate][data-missing-status]').disabled
        && find('[data-incremental-prototype-publish][data-missing-status]').disabled, '缺少状态容器时未防止重复操作');

      for (const name of ['strategy', 'tasks', 'sources']) {
        click(`[data-production-tab="${name}"]`);
        for (const tab of host.querySelectorAll('[data-production-tab]')) {
          const active = tab.dataset.productionTab === name;
          assert(tab.classList.contains('active') === active && tab.getAttribute('aria-selected') === String(active)
            && tab.tabIndex === (active ? 0 : -1), '生产页签未同步选中及键盘状态');
          assert(find(`#production-${tab.dataset.productionTab}`).hidden === !active, '生产页签面板可见性错误');
        }
      }
    } finally {
      appState.reviewUi = previousUi;
      for (const [node, open] of previousDrawers) node.open = open;
      for (const [node, selected] of previousLines) node.classList.toggle('selected', selected);
      host.remove();
    }
  });
}

async function exerciseReviewInlineComment(page) {
  const requests = [];
  const routePattern = '**/knowledge-center/api/incremental-tasks/task-coverage/reviews/review-coverage/comments';
  const route = async request => {
    requests.push(request.request().postDataJSON());
    await request.fulfill({ status: 500, contentType: 'application/json',
      body: JSON.stringify({ success: false, error: { message: '隔离批注失败' } }) });
  };
  await page.route(routePattern, route);
  const bubbleVisible = await page.evaluate(() => {
    const host = document.createElement('section');
    host.id = 'review-inline-coverage-host';
    host.innerHTML = '<div class="review-document-content" data-review-document-id="doc-coverage"><main><div class="repository-markdown" data-source-path="docs/coverage.md"><p id="review-coverage-paragraph">候选正文内容</p></div></main></div><div data-review-selection-bubble hidden><button type="button" data-review-bubble-trigger>添加批注</button></div><form data-review-reader-comment-form data-task-id="task-coverage" data-review-id="review-coverage"><input name="candidateDigest" value="digest-coverage"></form>';
    document.body.prepend(host);
    const node = host.querySelector('#review-coverage-paragraph').firstChild;
    const range = document.createRange();
    range.setStart(node, 0);
    range.setEnd(node, 4);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    node.parentElement.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    return !host.querySelector('[data-review-selection-bubble]').hidden;
  });
  const host = page.locator('#review-inline-coverage-host');
  try {
    const bubble = host.locator('[data-review-selection-bubble]');
    if (!bubbleVisible) throw new Error('审核选区后未显示批注气泡');
    const anchor = JSON.parse(await bubble.getAttribute('data-anchor'));
    if (anchor.documentId !== 'doc-coverage' || anchor.nodeId !== 'review-coverage-paragraph'
        || anchor.selectedText !== '候选正文' || anchor.path !== 'docs/coverage.md')
      throw new Error(`审核选区锚点错误：${JSON.stringify(anchor)}`);
    await bubble.evaluate(node => {
      node.hidden = false;
      node.querySelector('[data-review-bubble-trigger]').click();
    });
    const form = host.locator('[data-review-inline-form]');
    await form.locator('textarea[name=comment]').fill('核对该句');
    await form.locator('button[type=submit]').click();
    await form.locator('.review-inline-error').getByText('隔离批注失败').waitFor();
    if (requests.length !== 1 || requests[0]?.comment !== '核对该句'
        || requests[0]?.anchor?.documentId !== 'doc-coverage'
        || requests[0]?.candidateDigest !== 'digest-coverage')
      throw new Error('内联批注未提交完整锚点和候选摘要');
    if (await form.locator('button[type=submit]').isDisabled()) throw new Error('批注失败后提交按钮未恢复');
    await form.locator('[data-review-inline-cancel]').click();
    if (await host.locator('.review-inline-input-box').count()) throw new Error('取消批注后内联输入框未移除');
  } finally {
    await page.evaluate(() => {
      window.getSelection()?.removeAllRanges();
      document.querySelector('#review-inline-coverage-host')?.remove();
    });
    await page.unroute(routePattern, route);
  }
}

async function exerciseNavigationState(page) {
  const result = await page.evaluate(async () => {
    const navigation = await import('/knowledge-center/common/state/navigation.js');
    return {
      unknownView: navigation.pathForView('missing'),
      validPlatform: navigation.pathForView('platform', { tab: 'models' }),
      invalidPlatform: navigation.pathForView('platform', { tab: 'missing' }),
      repository: navigation.viewFromPath('/knowledge-center/assets/HB/repository/'),
      handbook: navigation.viewFromPath('/knowledge-center/production/handbook/HB'),
      unknownPath: navigation.viewFromPath('/knowledge-center/unknown'),
      validTab: navigation.platformTabFromSearch('?tab=mcp'),
      defaultTab: navigation.platformTabFromSearch(''),
      invalidTab: navigation.platformTabFromSearch('?tab=missing'),
    };
  });
  if (result.unknownView !== '/knowledge-center/' || result.validPlatform !== '/knowledge-center/platform?tab=models'
      || result.invalidPlatform !== '/knowledge-center/platform?tab=governance'
      || result.repository !== 'repository' || result.handbook !== 'production' || result.unknownPath !== null
      || result.validTab !== 'mcp' || result.defaultTab !== 'governance' || result.invalidTab !== 'governance') {
    throw new Error(`导航状态边界结果错误：${JSON.stringify(result)}`);
  }
}

async function capturePageCoverage(page, coverageMap, expectedFiles) {
  const executed = await page.evaluate(key => globalThis[key] || {}, runtimeKey);
  const runtimeFiles = Object.values(executed);
  for (const fileCoverage of runtimeFiles) {
    if (!fileCoverage?.statementMap || !expectedFiles.has(fileCoverage.path)) {
      throw new Error(`前端页面计数出现分母外源码：${fileCoverage?.path || 'unknown'}`);
    }
    coverageMap.addFileCoverage(fileCoverage);
  }
  return runtimeFiles.length;
}

async function exerciseRepositoryWorkspace(page, coverageMap, expectedFiles) {
  const capture = () => capturePageCoverage(page, coverageMap, expectedFiles);
  const routeApi = async (route, state) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;
    if (state === 'mapping' && pathname.endsWith('/branches')) {
      await route.fulfill({ status: 404, contentType: 'application/json',
        body: JSON.stringify({ success: false, error: { code: 'GITLAB_MAPPING_NOT_FOUND', message: '手册仓库映射不存在' } }) });
      return;
    }
    const data = pathname.endsWith('/access-status')
      ? (state === 'oauth' ? { canRead: false, nextAction: 'connect_gitlab', connectionId: 'conn-1', connectionName: '测试仓库', project: 'group/docs', message: '请连接 GitLab 账号' }
        : { canRead: true, connectionId: 'conn-1', connectionName: '测试仓库', project: 'group/docs' })
      : pathname.endsWith('/branches')
        ? (state === 'empty' ? { items: [], handbookName: '测试手册', languages: { zh: true, en: false } } : { items: [{ name: 'main', commitSha: 'sha-1' }], defaultBranch: 'main', handbookName: '测试手册', connectionName: '测试仓库', project: 'group/docs', languages: { zh: true, en: false }, commitSha: 'sha-1' })
        : pathname.endsWith('/tree')
          ? { items: [{ path: 'docs', name: 'docs', type: 'tree' }, { path: 'docs/guide.md', name: 'guide.md', type: 'blob' }] }
          : pathname.endsWith('/file')
            ? { path: 'docs/guide.md', content: '# 仓库指南\n\n正文内容', commitId: 'sha-1' }
            : {};
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
  };
  let state = 'success';
  const apiRoute = route => routeApi(route, state);
  let assertRepository;
  await page.route('**/knowledge-center/api/gitlab/handbooks/HB-COVERAGE/**', apiRoute);
  try {
    await capture();
    await page.goto(`http://127.0.0.1:${port}/knowledge-center/assets/HB-COVERAGE/repository`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.locator('.repository-markdown').waitFor({ state: 'visible', timeout: 10000 });
    assertRepository = async (selector, text) => {
      const locator = page.locator(selector);
      if (await locator.count() === 0 || (text && !(await locator.first().textContent()).includes(text))) throw new Error(`仓库覆盖断言失败：${selector}`);
    };
    await assertRepository('.repository-markdown', '仓库指南');
    await assertRepository('[data-repository-tree-item]', 'guide.md');
    if (!new URL(page.url()).searchParams.get('path')) throw new Error('仓库页面未规范化正文路径');

    state = 'oauth';
    await capture();
    await page.goto(`http://127.0.0.1:${port}/knowledge-center/assets/HB-COVERAGE/repository`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.locator('.repository-state').waitFor({ state: 'visible', timeout: 10000 });
    await assertRepository('.repository-state', '连接 GitLab 账号');
    state = 'mapping';
    await capture();
    await page.goto(`http://127.0.0.1:${port}/knowledge-center/assets/HB-COVERAGE/repository`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.locator('.repository-state').waitFor({ state: 'visible', timeout: 10000 });
    await assertRepository('.repository-state', '映射');
    state = 'empty';
    await capture();
    await page.goto(`http://127.0.0.1:${port}/knowledge-center/assets/HB-COVERAGE/repository`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.locator('.repository-page').waitFor({ state: 'visible', timeout: 10000 });
    await assertRepository('.repository-sidebar', '目录为空');
  } finally {
    await page.unroute('**/knowledge-center/api/gitlab/handbooks/HB-COVERAGE/**', apiRoute).catch(() => {});
  }
}

async function exerciseTemplateController(page, coverageMap, expectedFiles) {
  const endpoint = '/knowledge-center/api/templates';
  const requests = [];
  const decisions = [];
  const unexpected = [];
  let template = null;
  let uploadedTemplate = null;
  let ruleVersion = 1;
  let importAttempts = 0;
  let conflictOnNextSave = false;
  let batchReads = 0;
  let failNextAnalyze = false;
  let failNextBatchRead = false;
  let failNextRuleSave = false;
  let failNextDecision = false;
  let omitNextDetailContent = false;
  const versions = [];
  const detail = () => ({ ...template,
    current: { content: template.content, validationStatus: 'passed' },
    versions: versions.map(({ version }) => ({ version, createdAt: '2026-11-09T00:00:00Z', sourceType: 'markdown', validationStatus: 'passed' })),
  });
  const apiRoute = async route => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const suffix = url.pathname.slice(endpoint.length);
    let data;
    let status = 200;
    if (method === 'GET' && !suffix) {
      data = [template, uploadedTemplate].filter(Boolean).map(item => ({ id: item.id, name: item.name,
        type: item.type, description: item.description, status: item.status, currentVersion: item.currentVersion }));
    } else if (method === 'GET' && suffix === '/coverage-template') {
      data = template ? detail() : null;
      if (!data) status = 404;
      else if (omitNextDetailContent) { omitNextDetailContent = false; data.current = null; }
    } else if (method === 'GET' && suffix === '/uploaded-template') {
      data = uploadedTemplate;
      if (!data) status = 404;
    } else if (method === 'POST' && !suffix) {
      const payload = request.postDataJSON();
      requests.push({ method, suffix, payload });
      if (!payload.name || !payload.type || !payload.description || !payload.content) status = 422;
      else {
        template = { id: 'coverage-template', name: payload.name, type: payload.type,
          description: payload.description, content: payload.content, status: 'active', currentVersion: 1 };
        versions.push({ version: 1, content: payload.content });
        data = detail();
      }
    } else if (method === 'POST' && suffix === '/coverage-template/save') {
      const payload = request.postDataJSON();
      requests.push({ method, suffix, payload });
      if (conflictOnNextSave) {
        conflictOnNextSave = false;
        template.currentVersion += 1;
        template.content = '# 远端更新';
        versions.push({ version: template.currentVersion, content: template.content });
        status = 409;
      } else if (!template || payload.baseVersion !== template.currentVersion) status = 409;
      else {
        Object.assign(template, { name: payload.name, type: payload.type, description: payload.description,
          content: payload.content, currentVersion: template.currentVersion + 1 });
        versions.push({ version: template.currentVersion, content: payload.content });
        data = detail();
      }
    } else if (method === 'POST' && suffix === '/import') {
      importAttempts += 1;
      const body = request.postData() || '';
      requests.push({ method, suffix, hasMarkdown: body.includes('上传模板正文'), hasInvalid: body.includes('mixed-invalid.txt') });
      if (importAttempts === 1) data = { templates: null, drafts: null };
      else {
        uploadedTemplate = { id: 'uploaded-template', name: '导入模板', type: '测试',
          description: 'Markdown 上传', content: '# 上传模板正文', status: 'active',
          currentVersion: 1, sourceFilename: 'import.md',
          current: { content: '# 上传模板正文', validationStatus: 'passed' }, versions: [] };
        data = { templates: [uploadedTemplate], drafts: [] };
      }
    } else if (method === 'POST' && suffix === '/coverage-template/restore-draft') {
      const payload = request.postDataJSON();
      requests.push({ method, suffix, payload });
      const historical = versions.find(item => item.version === payload.version);
      if (!historical) status = 404;
      else data = { name: template.name, type: template.type, description: template.description,
        content: historical.content, baseVersion: template.currentVersion };
    } else if (method === 'GET' && suffix.startsWith('/coverage-template/versions/')) {
      data = versions.find(version => version.version === Number(suffix.split('/').at(-1))) || null;
      if (!data) status = 404;
    } else if (method === 'POST' && suffix === '/coverage-template/disable') {
      template.status = 'disabled';
      requests.push({ method, suffix });
      data = detail();
    } else if (method === 'POST' && suffix === '/coverage-template/restore') {
      template.status = 'active';
      requests.push({ method, suffix });
      data = detail();
    } else if (method === 'POST' && suffix === '/mappings/decisions') {
      const payload = request.postDataJSON();
      decisions.push(payload);
      if (failNextDecision) { failNextDecision = false; status = 500; }
      else data = { documentId: payload.documentId, templateId: payload.templateId,
        version: 1, reason: payload.reason || '' };
    } else if (method === 'POST' && suffix === '/mappings/analyze') {
      const payload = request.postDataJSON();
      requests.push({ method, suffix, payload });
      if (failNextAnalyze) { failNextAnalyze = false; status = 500; }
      else data = { id: 'batch-coverage', status: 'running', ruleVersion, documents: [], total: 0 };
    } else if (method === 'GET' && suffix === '/mappings/batch-coverage') {
      batchReads += 1;
      if (failNextBatchRead) { failNextBatchRead = false; status = 500; }
      else data = { id: 'batch-coverage', status: 'running', ruleVersion, documents: [], total: 0 };
    } else if (method === 'POST' && suffix === '/mappings/batch-coverage/cancel') {
      requests.push({ method, suffix });
      data = { id: 'batch-coverage', status: 'cancelled' };
    } else if (method === 'POST' && suffix === '/mapping-rules/preview') {
      const payload = request.postDataJSON();
      requests.push({ method, suffix, payload });
      data = { outlineVersionId: 'outline-1', candidateDigest: 'coverage-digest', total: 2,
        changed: 1, conflicts: 0, changes: [], handbookChanges: [], handbookVersions: ['outline-1'] };
    } else if (method === 'PUT' && suffix === '/mapping-rules') {
      const payload = request.postDataJSON();
      requests.push({ method, suffix, payload });
      if (failNextRuleSave) { failNextRuleSave = false; status = 500; }
      else { ruleVersion += 1; data = { version: ruleVersion, rules: payload.rules }; }
    } else {
      unexpected.push(`${method} ${suffix}`);
      status = 404;
    }
    await route.fulfill({ status, contentType: 'application/json',
      body: JSON.stringify(status === 200 ? { success: true, data } : { success: false,
        error: { code: status === 409 ? 'TEMPLATE_VERSION_CONFLICT' : 'TEMPLATE_NOT_FOUND',
          message: status === 409 ? '模板版本冲突' : '测试模板不存在' } }) });
  };
  await page.route('**/knowledge-center/api/templates**', apiRoute);
  try {
    await page.evaluate(async () => {
      const { appState } = await import('/knowledge-center/common/state/app-state.js');
      if (appState.templateUi) {
        appState.templateUi.draftKey = '';
        appState.templateUi.drafts = {};
      }
      appState.templateProjection = null;
    });
    await page.locator('[data-view="templates"]').first().click();
    await page.locator('[data-template-new]:not([disabled])').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('[data-template-tab="editor"]').click();
    await page.locator('[data-template-new]').click();
    await page.locator('[data-template-create-blank]').click();
    await page.locator('[data-template-field="name"]').fill('覆盖率模板');
    await page.locator('[data-template-field="type"]').fill('测试');
    await page.locator('[data-template-field="description"]').fill('浏览器模板流程');
    await page.locator('[data-template-meta-done]').click();
    await page.locator('[data-template-format="markdown"]').click();
    await page.locator('[data-template-content]').fill('# 第一版正文');
    await page.locator('[data-template-save]').click();
    await page.locator('[data-template-status]').filter({ hasText: '保存成功' }).waitFor({ state: 'visible', timeout: 10000 });
    if (requests[0]?.payload.content !== '# 第一版正文' || !await page.locator('.template-preview').textContent().then(text => text.includes('第一版正文')))
      throw new Error('模板创建请求或正文回读不一致');

    await page.locator('[data-template-edit]').click();
    await page.locator('[data-template-content]').fill('# 第二版正文');
    await page.locator('[data-template-save]').click();
    await page.locator('.template-preview').filter({ hasText: '第二版正文' }).waitFor({ state: 'visible', timeout: 10000 });
    if (template.currentVersion !== 2 || requests[1]?.payload.baseVersion !== 1)
      throw new Error('模板编辑未携带正确版本基线');

    await page.locator('.template-more summary').click();
    await page.locator('[data-template-history]').click();
    await page.locator('.template-history').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('.template-version').filter({ hasText: 'v1' }).locator('summary').click();
    await page.locator('[data-template-version="1"]').click();
    await page.locator('.template-history-banner').filter({ hasText: 'v1' }).waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('[data-template-current]').click();
    await page.locator('[data-template-history-close]').click();
    await page.locator('.template-more summary').click();
    await page.locator('[data-template-toggle]').click();
    await page.locator('[data-template-status]').filter({ hasText: '模板状态已更新' }).waitFor({ state: 'visible', timeout: 10000 });
    if (template.status !== 'disabled' || unexpected.length) throw new Error(`模板状态或 API 路径错误：${unexpected.join(', ')}`);

    await page.locator('.template-more summary').click();
    await page.locator('[data-template-toggle]').click();
    await page.locator('[data-template-status]').filter({ hasText: '模板状态已更新' }).waitFor({ state: 'visible', timeout: 10000 });
    await page.evaluate(async () => {
      const { appState } = await import('/knowledge-center/common/state/app-state.js');
      const ui = appState.templateUi;
      ui.mappingHandbookId = 'HB-COVERAGE';
      ui.mappingHandbooks = [{ id: 'HB-COVERAGE', name: '覆盖率手册' }];
      ui.mappingRules = { version: 1, rules: [] };
      ui.mappingEffective = { items: [], total: 0 };
      ui.mappingBatch = { id: 'batch-coverage', status: 'completed', ruleVersion: 1, documents: [
        { documentId: 'doc-1', title: '第一篇', path: '目录/第一篇.md', status: 'rule', templateId: 'coverage-template', ruleIds: ['rule-1'] },
        { documentId: 'doc-2', title: '第二篇', path: '目录/第二篇.md', status: 'unmatched', ai: { templateId: 'coverage-template', reason: '匹配正文结构' }, candidates: ['coverage-template'] },
      ] };
    });
    await page.locator('[data-template-tab="mappings"]').click();
    await page.locator('[data-map-select="doc-1"]').check();
    failNextDecision = true;
    await page.locator('[data-map-confirm-selected]').click();
    await page.locator('.template-mapping-error').first().waitFor({ state: 'visible', timeout: 10000 });
    if (decisions.length !== 1 || !await page.locator('[data-template-status]').textContent().then(text => text.includes('失败 1 篇')))
      throw new Error('批量映射确认失败未保留失败提示');
    await page.locator('[data-map-confirm-selected]').click();
    await page.locator('.template-mapping-counts').filter({ hasText: '已关联 1' }).waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('[data-map-evidence="doc-2"]').click();
    await page.locator('[data-map-decide-manual="doc-2"]').click();
    await page.locator('.template-mapping-error').first().waitFor({ state: 'visible', timeout: 10000 });
    if (!await page.locator('.template-mapping-error').first().textContent().then(text => text.includes('填写理由')))
      throw new Error('模板手动改选缺少理由时未显示校验错误');
    await page.locator('[data-map-manual-template]').selectOption('coverage-template');
    await page.locator('[data-map-manual-reason]').fill('人工核对后采用');
    await page.locator('[data-map-decide-manual="doc-2"]').click();
    await page.locator('.template-mapping-counts').filter({ hasText: '已关联 2' }).waitFor({ state: 'visible', timeout: 10000 });
    if (decisions.length !== 3 || decisions[1].documentId !== 'doc-1' || decisions[1].baseVersion !== 0 ||
        decisions[2].documentId !== 'doc-2' || decisions[2].reason !== '人工核对后采用')
      throw new Error('模板映射确认请求缺少文档或基线参数');

    await page.locator('[data-map-rules]').click();
    await page.locator('[data-map-rule-add]').click();
    await page.locator('[data-map-rule-field="id"]').fill('rule-coverage');
    await page.locator('[data-map-rule-field="priority"]').fill('10');
    await page.locator('[data-map-rule-field="templateId"]').selectOption('coverage-template');
    await page.locator('[data-map-rule-condition="pathPrefix"]').fill('目录');
    await page.locator('[data-map-rules-json]').evaluate(node => { node.value = '{invalid'; });
    await page.locator('[data-map-rules-preview]').click();
    await page.locator('.template-mapping-error').first().waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('[data-map-rules-json]').evaluate(async node => {
      const { appState } = await import('/knowledge-center/common/state/app-state.js');
      node.value = JSON.stringify(appState.templateUi.mappingRuleDraft);
    });
    await page.locator('[data-map-rules-preview]').click();
    await page.locator('.template-map-evidence').filter({ hasText: '发布前预览' }).waitFor({ state: 'visible', timeout: 10000 });
    failNextRuleSave = true;
    await page.locator('[data-map-rules-save]').click();
    await page.locator('.template-mapping-error').first().waitFor({ state: 'visible', timeout: 10000 });
    if (ruleVersion !== 1) throw new Error('规则发布失败后错误增加版本号');
    await page.locator('[data-map-rules-save]').click();
    await page.locator('[data-template-status]').filter({ hasText: '规则已保存' }).waitFor({ state: 'visible', timeout: 10000 });
    if (template.status !== 'active' || ruleVersion !== 2 ||
        requests.find(item => item.suffix === '/mapping-rules')?.payload.rules[0]?.when.pathPrefix !== '目录' || unexpected.length)
      throw new Error(`模板规则预览或发布未按预期完成：${unexpected.join(', ')}`);

    await page.locator('[data-template-tab="editor"]').click();
    await page.locator('[data-template-edit]').click();
    await page.locator('[data-template-content]').fill('# 本地冲突草稿');
    conflictOnNextSave = true;
    await page.locator('[data-template-save]').click();
    await page.locator('.template-save-conflict').filter({ hasText: '远端已更新为 v3' }).waitFor({ state: 'visible', timeout: 10000 });
    const conflictText = await page.locator('.template-save-conflict').textContent();
    if (!conflictText.includes('本地冲突草稿') || !conflictText.includes('远端更新') ||
        await page.locator('[data-template-content]').inputValue() !== '# 本地冲突草稿')
      throw new Error('模板版本冲突未保留本地草稿或远端对照');
    page.once('dialog', dialog => dialog.accept());
    await page.locator('[data-template-conflict-use-latest]').click();
    await page.locator('[data-template-status]').filter({ hasText: '已更新保存基线' }).waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('[data-template-save]').click();
    await page.locator('.template-preview').filter({ hasText: '本地冲突草稿' }).waitFor({ state: 'visible', timeout: 10000 });
    const saves = requests.filter(item => item.suffix === '/coverage-template/save');
    if (template.currentVersion !== 4 || saves.length !== 3 || saves[1].payload.baseVersion !== 2 ||
        saves[2].payload.baseVersion !== 3 || template.content !== '# 本地冲突草稿')
      throw new Error('模板冲突重试的版本基线或正文不一致');

    const upload = page.locator('[data-template-file]');
    await upload.setInputFiles({ name: 'invalid.txt', mimeType: 'text/plain', buffer: Buffer.from('not markdown') });
    await page.locator('[data-template-status]').filter({ hasText: '仅支持 Markdown' }).waitFor({ state: 'visible', timeout: 10000 });
    if (importAttempts !== 0) throw new Error('非法模板文件意外发起上传');
    const markdown = { name: 'import.md', mimeType: 'text/markdown', buffer: Buffer.from('# 上传模板正文') };
    await upload.setInputFiles(markdown);
    await page.locator('[data-template-status]').filter({ hasText: '服务端未确认模板入库' }).waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('[data-template-file]').setInputFiles(markdown);
    await page.locator('[data-template-status]').filter({ hasText: '模板上传成功' }).waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('.template-preview').filter({ hasText: '上传模板正文' }).waitFor({ state: 'visible', timeout: 10000 });
    const imports = requests.filter(item => item.suffix === '/import');
    if (importAttempts !== 2 || imports.length !== 2 || imports.some(item => !item.hasMarkdown) ||
        uploadedTemplate?.id !== 'uploaded-template' || unexpected.length)
      throw new Error(`模板上传请求或详情回读不一致：${unexpected.join(', ')}`);

    await page.locator('[data-template-tab="mappings"]').click();
    failNextAnalyze = true;
    await page.locator('[data-map-analyze]').click();
    await page.locator('.template-mapping-error').first().waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('[data-map-analyze]').click();
    await page.locator('[data-map-refresh]').waitFor({ state: 'visible', timeout: 10000 });
    failNextBatchRead = true;
    await page.locator('[data-map-refresh]').click();
    await page.locator('.template-mapping-error').first().waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('[data-map-refresh]').click();
    await page.waitForTimeout(1100);
    if (batchReads < 1 || requests.find(item => item.suffix === '/mappings/analyze')?.payload.handbookId !== 'HB-COVERAGE')
      throw new Error('模板映射分析或刷新未读取当前手册批次');
    await page.locator('[data-map-cancel]').click();
    if (!requests.some(item => item.suffix === '/mappings/batch-coverage/cancel') || unexpected.length)
      throw new Error(`模板映射取消未调用批次 API：${unexpected.join(', ')}`);

    await page.locator('[data-template-tab="editor"]').click();
    await page.locator('[data-template-id="coverage-template"]').click();
    await page.locator('.template-more summary').click();
    await page.locator('[data-template-history]').click();
    await page.locator('.template-version').filter({ hasText: 'v1' }).locator('summary').click();
    await page.locator('[data-template-restore="1"]').click();
    await page.locator('[data-template-content]').waitFor({ state: 'visible', timeout: 10000 });
    if (await page.locator('[data-template-content]').inputValue() !== '# 第一版正文' || template.currentVersion !== 4)
      throw new Error('历史恢复未进入未保存的第一版草稿');
    await page.locator('[data-template-save]').click();
    await page.locator('.template-preview').filter({ hasText: '第一版正文' }).waitFor({ state: 'visible', timeout: 10000 });
    const restored = requests.find(item => item.suffix === '/coverage-template/restore-draft');
    const finalSave = requests.filter(item => item.suffix === '/coverage-template/save').at(-1);
    if (restored?.payload.version !== 1 || finalSave?.payload.baseVersion !== 4 ||
        finalSave?.payload.content !== '# 第一版正文' || template.currentVersion !== 5 || unexpected.length)
      throw new Error(`历史恢复保存版本或正文不一致：${unexpected.join(', ')}`);

    const search = page.locator('[data-template-search]');
    const waitForSearchResults = (count, name = '') => page.waitForFunction(({ count, name }) => {
      const results = document.querySelector('[data-template-results]');
      return results && results.querySelectorAll('[data-template-id]').length === count &&
        (!name || results.textContent.includes(name));
    }, { count, name }, { timeout: 5000 });
    await search.fill('导入');
    await waitForSearchResults(1, '导入模板');
    await search.fill('');
    await waitForSearchResults(2);
    await search.evaluate(input => {
      input.value = '覆盖率';
      input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      input.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }));
    });
    await page.waitForTimeout(240);
    if (await page.locator('[data-template-results] [data-template-id]').count() !== 2)
      throw new Error('模板搜索在中文输入法组词期间提前重绘');
    await search.evaluate(input => input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })));
    await waitForSearchResults(1, '覆盖率模板');
    await search.fill('');
    await waitForSearchResults(2);

    await page.locator('[data-template-edit]').click();
    await page.locator('[data-template-meta-toggle]').click();
    await page.locator('[data-template-field="name"]').fill('临时名称');
    await page.locator('[data-template-meta-cancel]').click();
    if (await page.locator('.template-editor > header h3').textContent() !== '覆盖率模板')
      throw new Error('取消基本信息编辑未恢复原模板名称');
    await page.locator('[data-template-meta-toggle]').click();
    await page.locator('[data-template-field="name"]').fill('再次临时修改');
    const metadataTrap = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('[data-template-meta-panel] input, [data-template-meta-panel] textarea, [data-template-meta-panel] button')]
        .filter(node => node.getClientRects().length);
      nodes[0].focus();
      nodes[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
      const shifted = document.activeElement === nodes.at(-1);
      nodes.at(-1).dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
      return shifted && document.activeElement === nodes[0];
    });
    if (!metadataTrap) throw new Error('模板基本信息弹层焦点未循环');
    await page.locator('[data-template-field="name"]').press('Escape');
    if (await page.locator('.template-editor > header h3').textContent() !== '覆盖率模板')
      throw new Error('基本信息 Escape 未恢复快照');
    await page.locator('[data-template-cancel]').click();

    const resizer = page.locator('[data-template-list-resizer]');
    await resizer.press('Home');
    if (await resizer.getAttribute('aria-valuenow') !== '240') throw new Error('模板目录宽度 Home 快捷键无效');
    await resizer.press('End');
    await resizer.press('ArrowLeft');
    if (await resizer.getAttribute('aria-valuenow') !== '404') throw new Error('模板目录宽度方向键无效');
    await resizer.evaluate(handle => {
      handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 200 }));
      document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 165 }));
      document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 165 }));
    });
    if (await resizer.getAttribute('aria-valuenow') !== '369' ||
        await page.evaluate(() => localStorage.getItem('knowledge-center:template-list-width')) !== '369')
      throw new Error('模板目录拖拽宽度未持久化');

    await page.locator('[data-template-tab="editor"]').press('End');
    await page.locator('[data-template-tab="mappings"][aria-selected="true"]').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('[data-template-tab="mappings"]').press('Home');
    await page.locator('[data-template-tab="editor"][aria-selected="true"]').waitFor({ state: 'visible', timeout: 10000 });

    await page.locator('.template-more summary').click();
    await page.locator('[data-template-history]').click();
    await page.locator('.template-history').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('.template-version').filter({ hasText: 'v1' }).locator('summary').click();
    await page.setViewportSize({ width: 800, height: 900 });
    const historyTrap = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('.template-history button:not(:disabled)')]
        .filter(button => button.getClientRects().length && (!button.closest('details') || button.closest('details').open));
      buttons[0].focus();
      buttons[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
      const shifted = document.activeElement === buttons.at(-1);
      buttons.at(-1).dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
      return { shifted, returned: document.activeElement === buttons[0], count: buttons.length };
    });
    if (historyTrap.count < 2 || !historyTrap.shifted || !historyTrap.returned)
      throw new Error(`移动端历史版本焦点未循环：${JSON.stringify(historyTrap)}`);
    await page.locator('[data-template-history-close]').press('Escape');
    if (await page.locator('.template-history').count()) throw new Error('历史版本 Escape 未关闭');
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.locator('[data-template-tab="mappings"]').click();
    await page.locator('[data-map-rules]').click();
    const mappingTrap = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('.template-map-evidence button:not(:disabled), .template-map-evidence input:not(:disabled), .template-map-evidence select:not(:disabled), .template-map-evidence textarea:not(:disabled), .template-map-evidence summary')]
        .filter(node => node.getClientRects().length);
      nodes[0].focus();
      nodes[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
      const shifted = document.activeElement === nodes.at(-1);
      nodes.at(-1).dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
      return shifted && document.activeElement === nodes[0];
    });
    if (!mappingTrap) throw new Error('映射规则弹层焦点未循环');
    await page.locator('.template-map-evidence button[data-map-rules-close]').press('Escape');
    if (await page.locator('.template-map-evidence').count()) throw new Error('映射规则 Escape 未关闭');
    await page.locator('[data-template-tab="editor"]').click();

    await page.locator('[data-template-file]').setInputFiles([
      { name: 'mixed-invalid.txt', mimeType: 'text/plain', buffer: Buffer.from('invalid') },
      markdown,
    ]);
    await page.locator('[data-template-status]').filter({ hasText: '以下文件未保存' }).waitFor({ state: 'visible', timeout: 10000 });
    const uploadResults = await page.locator('.template-upload-results').textContent();
    const mixedImport = requests.filter(item => item.suffix === '/import').at(-1);
    if (importAttempts !== 3 || !mixedImport.hasMarkdown || mixedImport.hasInvalid ||
        !uploadResults.includes('已保存') || !uploadResults.includes('未保存') || !uploadResults.includes('mixed-invalid.txt'))
      throw new Error('混合模板上传未分别报告入库和格式拒绝结果');

    omitNextDetailContent = true;
    await page.locator('[data-template-id="coverage-template"]').click();
    await page.locator('[data-template-status]').filter({ hasText: '模板详情未返回正文' }).waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('[data-template-id="coverage-template"]').click();
    await page.locator('.template-preview').filter({ hasText: '第一版正文' }).waitFor({ state: 'visible', timeout: 10000 });
    await page.evaluate(async () => {
      const { appState } = await import('/knowledge-center/common/state/app-state.js');
      appState.templateUi.mappingHandbooks = null;
    });
    await page.locator('[data-template-tab="mappings"]').click();
    await page.locator('.template-mapping-error').first().waitFor({ state: 'visible', timeout: 10000 });
  } finally {
    await page.unroute('**/knowledge-center/api/templates**', apiRoute).catch(() => {});
  }

  const errorPage = await page.context().newPage();
  try {
    await errorPage.route('**/knowledge-center/api/templates**', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }),
    }));
    await errorPage.route('**/knowledge-center/common/vendor/vditor/dist/index.min.js', route => route.abort('failed'));
    await errorPage.goto(`http://127.0.0.1:${port}/knowledge-center/`, { waitUntil: 'networkidle', timeout: 30000 });
    if (!await errorPage.locator('#app-shell').isVisible() && await errorPage.locator('#admin-username').count()) {
      await errorPage.locator('#admin-username').locator('xpath=ancestor::details').locator('summary').click().catch(() => {});
      await errorPage.locator('#admin-username').fill(process.env.KNOWLEDGE_CENTER_ADMIN_USERNAME || 'admin');
      await errorPage.locator('#admin-password').fill(process.env.KNOWLEDGE_CENTER_ADMIN_PASSWORD || 'admin');
      await errorPage.locator('#admin-submit').click();
      await errorPage.locator('#app-shell').waitFor({ state: 'visible', timeout: 15000 });
    }
    await errorPage.locator('[data-view="templates"]').first().click();
    await errorPage.locator('[data-template-new]:not([disabled])').waitFor({ state: 'visible', timeout: 10000 });
    await errorPage.locator('[data-template-new]').click();
    await errorPage.locator('[data-template-create-blank]').click();
    await errorPage.locator('[data-template-status]').filter({ hasText: '编辑器加载失败' }).waitFor({ state: 'visible', timeout: 10000 });
    await errorPage.locator('[data-template-content]').waitFor({ state: 'visible', timeout: 10000 });
    await capturePageCoverage(errorPage, coverageMap, expectedFiles);
  } finally {
    await errorPage.close();
  }
}

async function exerciseAssetManageDialog(page) {
  const assetId = 'KC-COVERAGE';
  const item = { handbookId: assetId, name: '覆盖率管理手册', status: 'asset_created', statusDisplayName: '待创建',
    productName: '知识中心', ownerA: { principalId: 1, displayName: '覆盖测试管理员' }, ownerB: null,
    repositoryMapped: false, chapterCount: 2, documentCount: 1, assetVersion: 3 };
  const writes = [];
  const assetsRoute = route => {
    if (route.request().method() !== 'GET') {
      writes.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`);
      return route.fulfill({ status: 405, contentType: 'application/json', body: JSON.stringify({ success: false, error: { message: '覆盖场景禁止写入' } }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {
      items: [item], products: [], page: 1, pageSize: 20, total: 1, generatedAt: '2026-11-10T00:00:00.000Z',
      statistics: { asset_created: 1, outline_editing: 0, outline_published: 0, content_building: 0, handbook_published: 0 },
    } }) });
  };
  const principalsRoute = route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {
    items: [{ principalId: 1, id: 'admin-coverage', displayName: '覆盖测试管理员', casLoginName: 'coverage-admin', state: 'ACTIVE' }],
  } }) });
  const connectionsRoute = route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { items: [] } }) });
  await page.route('**/knowledge-center/api/assets/handbooks*', assetsRoute);
  await page.route('**/knowledge-center/api/platform/principals*', principalsRoute);
  await page.route('**/knowledge-center/api/gitlab/connections*', connectionsRoute);
  try {
    await page.locator('[data-view="assets"]').first().click();
    await page.locator('.asset-workspace[data-asset-loaded="true"]').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator(`[data-asset-id="${assetId}"]`).click();
    await page.locator(`[data-asset-edit-open="${assetId}"]`).click();
    const manage = page.locator('[data-asset-edit-dialog]');
    const form = manage.locator('[data-asset-edit-form]');
    await manage.waitFor({ state: 'visible' });
    if (!await form.getAttribute('data-initial-snapshot')) throw new Error('管理表单未保存初始快照');
    const name = form.locator('[name="name"]');
    const originalName = await name.inputValue();
    const advancedActions = form.locator('[data-asset-advanced-actions]');
    await advancedActions.locator('summary').click();
    await form.locator('[data-asset-archive-open]').waitFor({ state: 'visible' });
    await name.fill(`${originalName} 临时修改`);
    await form.locator('[data-asset-archive-open]').click();
    if (!await form.locator('[data-asset-form-status]').textContent().then(value => value.includes('请先保存或取消当前修改')) ||
        await page.locator('[data-asset-archive-dialog]:modal').count())
      throw new Error('脏表单停用未阻止并提示先保存或取消');

    await name.fill(originalName);
    const archiveTrigger = form.locator('[data-asset-archive-open]');
    await archiveTrigger.click();
    const archive = page.locator('[data-asset-archive-dialog]');
    await archive.waitFor({ state: 'visible' });
    if (await manage.isVisible()) throw new Error('打开停用确认后管理框仍可见');
    await archive.getByRole('button', { name: '取消', exact: true }).click();
    await manage.waitFor({ state: 'visible' });
    await archiveTrigger.waitFor({ state: 'visible' });
    if (!await archiveTrigger.evaluate(element => element === document.activeElement)) throw new Error('取消停用未恢复管理框触发焦点');

    await archiveTrigger.click();
    await archive.evaluate(dialog => dialog.dispatchEvent(new Event('cancel', { bubbles: true, cancelable: true })));
    await manage.waitFor({ state: 'visible' });
    await archiveTrigger.click();
    const confirmForm = archive.locator('[data-asset-archive-confirm-form]');
    await confirmForm.evaluate(element => { element.dataset.busy = 'true'; });
    await archive.evaluate(dialog => dialog.dispatchEvent(new Event('cancel', { bubbles: true, cancelable: true })));
    if (!await archive.evaluate(dialog => dialog.open) || await manage.isVisible()) throw new Error('停用请求忙碌时确认框不应关闭');
    await confirmForm.evaluate(element => { delete element.dataset.busy; });
    await archive.getByRole('button', { name: '取消', exact: true }).click();
    await manage.waitFor({ state: 'visible' });
    await manage.getByRole('button', { name: '取消', exact: true }).click();
    if (writes.length) throw new Error(`资产管理覆盖意外发起写请求：${writes.join(', ')}`);
  } finally {
    await page.unroute('**/knowledge-center/api/assets/handbooks*', assetsRoute).catch(() => {});
    await page.unroute('**/knowledge-center/api/platform/principals*', principalsRoute).catch(() => {});
    await page.unroute('**/knowledge-center/api/gitlab/connections*', connectionsRoute).catch(() => {});
  }
}

async function exerciseAssetRepositoryStatistics(page) {
  const ids = ['unmapped', 'no-branch', 'forbidden', 'forbidden-default', 'access-error', 'statistics-error', 'saved', 'fallback'];
  const prefix = 'KC-STAT-';
  const items = ids.map(id => ({
    handbookId: prefix + id, name: `统计覆盖 ${id}`, status: 'asset_created', productName: '知识中心',
    repositoryMapped: id !== 'unmapped', chapterCount: 0, documentCount: 0,
    repository: id === 'no-branch' ? {} : {
      enabledBranches: ['main', 'dev'], ...(id === 'fallback' ? {} : { defaultBranch: 'main' }),
    },
  }));
  const requests = [];
  let failBranch = false;
  const reply = (route, data, status = 200) => route.fulfill({ status, contentType: 'application/json',
    body: JSON.stringify(status === 200 ? { success: true, data } : { success: false, error: { message: '统计服务暂不可用' } }) });
  const assetsRoute = route => reply(route, { items, products: [], total: items.length, page: 1, pageSize: 20, statistics: {} });
  const emptyRoute = route => reply(route, { items: [] });
  const repositoryRoute = route => {
    const url = new URL(route.request().url());
    if (route.request().method() !== 'GET') throw new Error('统计覆盖禁止写请求');
    requests.push(url.pathname + url.search);
    const id = decodeURIComponent(url.pathname.split('/').at(-2)).slice(prefix.length);
    if (url.pathname.endsWith('/access-status')) {
      if (id === 'access-error') return reply(route, null, 503);
      if (id === 'forbidden') return reply(route, { canRead: false, message: '覆盖场景拒绝读取' });
      if (id === 'forbidden-default') return reply(route, { canRead: false });
      return reply(route, { canRead: true });
    }
    if (!url.pathname.endsWith('/statistics') || url.searchParams.get('language') !== 'zh')
      throw new Error(`统计请求契约错误：${url}`);
    if (id === 'statistics-error' || (id === 'saved' && failBranch)) return reply(route, null, 503);
    const dev = url.searchParams.get('ref') === 'dev';
    return reply(route, { chapterCount: dev ? 7 : 3, documentCount: dev ? 11 : 5 });
  };
  const patterns = [
    ['**/knowledge-center/api/assets/handbooks*', assetsRoute],
    ['**/knowledge-center/api/platform/principals*', emptyRoute],
    ['**/knowledge-center/api/gitlab/connections*', emptyRoute],
    ['**/knowledge-center/api/gitlab/handbooks/KC-STAT-*/**', repositoryRoute],
  ];
  const preferences = await page.evaluate(({ prefix, ids }) => {
    const saved = Object.fromEntries(ids.map(id => {
      const key = `knowledge-center:asset-branch:${prefix}${id}`;
      const value = localStorage.getItem(key);
      localStorage.removeItem(key);
      return [key, value];
    }));
    localStorage.setItem(`knowledge-center:asset-branch:${prefix}saved`, 'dev');
    localStorage.setItem(`knowledge-center:asset-branch:${prefix}fallback`, 'removed');
    return saved;
  }, { prefix, ids });
  for (const [pattern, handler] of patterns) await page.route(pattern, handler);
  try {
    await page.locator('[data-view="assets"]').first().click();
    await page.waitForFunction(async prefix => {
      const { appState } = await import('/knowledge-center/common/state/app-state.js');
      const items = appState.assetCatalog?.items || [];
      return items.length === 8 && items.every(item => item.handbookId.startsWith(prefix)) &&
        items.filter(item => !['unmapped', 'no-branch'].some(id => item.handbookId === prefix + id))
          .every(item => ['ok', 'forbidden', 'unavailable'].includes(item.statisticsStatus)) &&
        ['forbidden', 'forbidden-default'].every(id =>
          document.querySelector(`[data-asset-statistics="${prefix}${id}"]`)?.textContent.includes('无读取权限'));
    }, prefix);
    const cell = id => page.locator(`[data-asset-statistics="${prefix}${id}"]`);
    for (const id of ['forbidden', 'forbidden-default']) {
      await page.waitForFunction(({ selector, id }) => {
        const text = document.querySelector(selector)?.textContent || '';
        return text.includes('无权读取') && text.includes(id === 'forbidden' ? '覆盖场景拒绝读取' : '当前 GitLab 账号不可读取该仓库');
      }, { selector: `[data-asset-statistics="${prefix}${id}"]`, id });
      const text = await cell(id).textContent();
      if (!text.includes('无权读取') || !text.includes(id === 'forbidden' ? '覆盖场景拒绝读取' : '当前 GitLab 账号不可读取该仓库'))
        throw new Error(`资产读取权限提示缺失：${id}；单元格=${JSON.stringify(text)}；状态=${JSON.stringify(await page.evaluate(handbookId => {
          return import('/knowledge-center/common/state/app-state.js').then(({ appState }) => ({
            activeView: appState.activeView,
            item: appState.assetCatalog?.items?.find(item => item.handbookId === handbookId),
          }));
        }, prefix + id))}`);
    }
    for (const id of ['access-error', 'statistics-error']) {
      await page.waitForFunction(selector => (document.querySelector(selector)?.textContent || '').includes('统计服务暂不可用'), `[data-asset-statistics="${prefix}${id}"]`);
      if (!(await cell(id).textContent()).includes('统计服务暂不可用')) throw new Error(`资产统计错误未显示：${id}`);
    }
    await page.waitForFunction(({ saved, fallback }) =>
      (document.querySelector(saved)?.textContent || '').includes('章节 7') &&
      (document.querySelector(fallback)?.textContent || '').includes('章节 3'), {
        saved: `[data-asset-statistics="${prefix}saved"]`, fallback: `[data-asset-statistics="${prefix}fallback"]`,
      });
    if (!(await cell('saved').textContent()).includes('章节 7') || !(await cell('fallback').textContent()).includes('章节 3'))
      throw new Error('保存分支或失效偏好回退错误');
    if (requests.some(url => /KC-STAT-(unmapped|no-branch)\//.test(url)) ||
        requests.some(url => /KC-STAT-forbidden(?:-default)?\/statistics/.test(url)))
      throw new Error('无仓库、无分支或无权限时不应读取统计');
    const branch = page.locator(`[data-asset-branch="${prefix}saved"]`);
    await branch.selectOption('main');
    await page.waitForFunction(prefix => document.querySelector(`[data-asset-statistics="${prefix}saved"]`)?.textContent.includes('章节 3'), prefix);
    if (await branch.isDisabled() || await page.evaluate(prefix => localStorage.getItem(`knowledge-center:asset-branch:${prefix}saved`), prefix) !== 'main')
      throw new Error('成功切换统计分支未保存偏好或恢复控件');
    failBranch = true;
    await branch.selectOption('dev');
    await page.waitForFunction(prefix => document.querySelector(`[data-asset-statistics="${prefix}saved"]`)?.textContent.includes('统计暂不可用'), prefix);
    if (await branch.inputValue() !== 'main' || await branch.isDisabled()) throw new Error('统计分支切换失败未恢复原分支');
    if (await cell('saved').getAttribute('aria-busy') !== null) throw new Error('统计完成后忙碌状态未清理');
  } finally {
    for (const [pattern, handler] of patterns) await page.unroute(pattern, handler);
    await page.evaluate(saved => {
      for (const [key, value] of Object.entries(saved)) {
        if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value);
      }
    }, preferences);
  }
}

async function main() {
  const startedAt = new Date().toISOString();
  const beforeManifest = sourceManifest();
  const inputsBefore = inputManifest();
  let completed = false;
  const files = sourceFiles(frontendRoot).sort();
  const expectedFiles = new Set(files);
  const instrumenter = createInstrumenter({ esModules: true, coverageVariable: runtimeKey, compact: false });
  const coverageMap = createCoverageMap({});
  const instrumentedByUrl = new Map();
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    const instrumented = instrumenter.instrumentSync(source, file);
    coverageMap.addFileCoverage(instrumenter.lastFileCoverage());
    const relative = path.relative(frontendRoot, file).split(path.sep).join('/');
    const url = `/knowledge-center/${relative}`;
    instrumentedByUrl.set(url, instrumented);
  }

  const server = spawn(process.execPath, ['apps/knowledge-center-web/frontend-server.js'], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      KNOWLEDGE_CENTER_ENVIRONMENT: 'test',
      KNOWLEDGE_CENTER_TEST_RUN_ID: `frontend-istanbul-${process.pid}`,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let browser;
  try {
    await waitForServer(server);
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    await context.addInitScript(key => { globalThis[key] = {}; }, runtimeKey);
    await context.route('**/knowledge-center/**/*.js', async route => {
      const requestUrl = new URL(route.request().url());
      if (!instrumentedByUrl.has(requestUrl.pathname)) return route.continue();
      return route.fulfill({ status: 200, contentType: 'application/javascript; charset=utf-8', body: instrumentedByUrl.get(requestUrl.pathname) });
    });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/knowledge-center/`, { waitUntil: 'networkidle', timeout: 30000 });
    if (await page.locator('#admin-username').count()) {
      await page.locator('#admin-username').locator('xpath=ancestor::details').locator('summary').click().catch(() => {});
      await page.locator('#admin-username').fill(process.env.KNOWLEDGE_CENTER_ADMIN_USERNAME || 'admin');
      await page.locator('#admin-password').fill(process.env.KNOWLEDGE_CENTER_ADMIN_PASSWORD || 'admin');
      await page.locator('#admin-submit').click();
      await page.locator('#app-shell').waitFor({ state: 'visible', timeout: 15000 });
    }
    // Cover the projection-only outline branches in a real Chromium DOM. These
    // scenarios exercise public renderers without mutating a backend resource.
    await page.evaluate(async () => {
      const { renderOutlines, renderOutlineAssignments } = await import('/knowledge-center/modules/outlines/view.js');
      const host = document.createElement('div');
      document.body.append(host);
      const base = { status: 'ok',
        items: [{ id: 'draft-1', name: '草稿手册', status: 'pending_confirmation', productName: '数据库', updatedAt: '2026-01-01T00:00:00Z' },
          { id: 'pub-1', name: '已发布手册', status: 'published', product: { name: '平台' }, businessVersions: ['23.4'] }],
      };
      host.innerHTML = renderOutlines({ outlineProjection: base, outlineView: { listState: { search: '草稿' } }, outlinePermissions: { create: true, delete: true, purge: true } });
      if (!host.querySelector('[data-outline-row]:not([hidden])') || host.querySelectorAll('[data-outline-row]').length !== 2) throw new Error('大纲列表搜索场景未渲染');
      host.innerHTML = renderOutlines({ outlineProjection: { status: 'empty', handbook: { name: '空手册' } }, outlineView: { isDetail: true, handbookId: 'empty' }, outlinePermissions: { create: true } });
      if (!host.textContent.includes('尚未建立大纲') || !host.querySelector('[data-outline-import]')) throw new Error('空大纲导入场景未渲染');
      const nodes = [{ id: 'dir', name: '目录', children: [{ id: 'doc', kind: 'document', title: '页面.md', description: '页面说明' }] }];
      const detail = { id: 'outline-1', handbookId: 'hb-1', status: 'published', name: '详情手册', nodes,
        governance: { state: 'published', techDomains: [{ id: '7', name: '存储' }], effectiveDocumentAssignments: [{ nodeId: 'doc', techDomainIds: ['7'], ownerships: [{ techDomainId: '7', assigneeName: '负责人' }] }], assignments: [] } };
      host.innerHTML = renderOutlines({ outlineProjection: { status: 'ok', detail, handbook: { id: 'hb-1', name: '详情手册' } }, outlineView: { isDetail: true, activeTab: 'overview' }, outlinePermissions: { create: true, delete: true } });
      if (!host.textContent.includes('页面说明') || !host.textContent.includes('存储') || !host.querySelector('[data-outline-description-edit]')) throw new Error('大纲详情场景未渲染');
      host.innerHTML = renderOutlineAssignments({ outlineProjection: { detail }, outlineView: {}, outlinePermissions: {}, domainBuildTaskProjection: { status: 'unavailable', error: { message: '服务暂不可用' } } });
      if (!host.textContent.includes('分工任务暂不可用')) throw new Error('大纲分工失败场景未渲染');
      host.innerHTML = renderOutlineAssignments({ outlineProjection: { detail: { ...detail, governance: { state: 'draft' } } }, outlineView: {}, outlinePermissions: {}, domainBuildTaskProjection: null });
      if (!host.textContent.includes('发布后才能进行人员分工')) throw new Error('大纲未发布分工场景未渲染');
      const assignmentDetail = { ...detail,
        nodes: [{ id: 'dir', name: '目录', children: [
          { id: 'doc', kind: 'document', title: '页面.md' },
          { id: 'doc-2', kind: 'document', title: '第二页.md' },
        ] }, { id: 'dir-2', name: '补充目录', children: [{ id: 'doc-3', kind: 'document', title: '第三页.md' }] }],
        governance: { ...detail.governance, effectiveDocumentAssignments: [
          { nodeId: 'doc', techDomainIds: ['7'] },
          { nodeId: 'doc-2', techDomainIds: ['8', '7'] },
        ] },
      };
      const task = { id: 'task-7', manualId: 'hb-1', outlineVersionId: 'outline-1', techDomainId: '7',
        techDomainName: '存储', domainLeaderId: 'user-1', domainLeaderName: '负责人',
        domainMembers: [{ id: 'user-2', name: '成员' }], items: [
          { id: 'item-1', documentId: 'doc', documentTitle: '页面.md', assigneeId: 'user-1', assigneeName: '负责人' },
          { id: 'item-2', documentId: 'doc-2', documentTitle: '第二页.md' },
          { id: 'item-3', documentId: 'doc-3', documentTitle: '第三页.md', assigneeId: 'retired', assigneeName: '历史成员' },
        ] };
      const assignmentArgs = { outlineProjection: { detail: assignmentDetail }, outlineView: { domainId: '7', nodeId: 'doc-2' },
        outlinePermissions: { platformAdmin: true }, domainBuildTaskProjection: { status: 'ok', tasks: [task] } };
      host.innerHTML = renderOutlineAssignments(assignmentArgs);
      if (host.querySelectorAll('[data-outline-assignment-row]').length !== 3 ||
          host.querySelector('[data-domain-task]').dataset.assignmentStatus !== 'pending' ||
          !host.querySelector('[data-outline-assignment-directory="dir"]') ||
          !host.querySelector('[data-outline-assignment-row].is-focused') ||
          !host.textContent.includes('本领域主责') || !host.textContent.includes('本领域协作') ||
          !host.querySelector('option[value="retired"]') || !host.querySelector('[data-outline-assignment-stats-dialog]')) {
        throw new Error('已发布大纲分工任务未投影目录、职责、责任人和统计');
      }
      host.innerHTML = renderOutlineAssignments({ ...assignmentArgs,
        domainBuildTaskProjection: { status: 'ok', tasks: [{ ...task, domainLeaderId: null, domainLeaderName: null }] } });
      if (!host.querySelector('[data-outline-team-config-link]')) throw new Error('未配置团队负责人时缺少管理员恢复入口');
      host.innerHTML = renderOutlineAssignments({ ...assignmentArgs, outlinePermissions: {},
        domainBuildTaskProjection: { status: 'ok', tasks: [{ ...task, domainLeaderId: null, domainLeaderName: null }] } });
      if (!host.textContent.includes('请联系平台管理员')) throw new Error('普通成员未看到团队配置提示');
      host.innerHTML = renderOutlineAssignments({ ...assignmentArgs, domainBuildTaskProjection: { status: 'ok', tasks: [] } });
      if (!host.textContent.includes('尚未生成领域建设任务')) throw new Error('无领域建设任务时缺少空态');
      host.innerHTML = renderOutlineAssignments({ ...assignmentArgs,
        domainBuildTaskProjection: { status: 'ok', tasks: [{ ...task, manualId: 'other-handbook' }] } });
      if (!host.textContent.includes('尚未生成领域建设任务')) throw new Error('其他手册任务不应混入当前大纲');

      host.innerHTML = renderOutlines({ outlineProjection: { status: 'ok', recycleItems: [
        { id: 'deleted-1', name: '旧大纲', status: 'archived', deletedAt: '2026-01-02' },
      ] }, outlineView: { page: 'recycle' }, outlinePermissions: { delete: true, purge: true } });
      if (!host.querySelector('[data-outline-restore="deleted-1"]') || !host.querySelector('[data-outline-purge="deleted-1"]'))
        throw new Error('回收站操作入口未渲染');
      host.innerHTML = renderOutlines({ outlineProjection: { status: 'ok', recycleItems: [] },
        outlineView: { page: 'recycle' }, outlinePermissions: {} });
      if (!host.textContent.includes('回收站为空')) throw new Error('空回收站未渲染');
      host.innerHTML = renderOutlines({ outlineProjection: { status: 'unavailable', error: { message: '读取失败' } },
        outlineView: { page: 'recycle' }, outlinePermissions: {} });
      if (!host.querySelector('[data-outline-recycle-retry]')) throw new Error('回收站故障缺少重试入口');
      host.innerHTML = renderOutlines({ outlineProjection: null, outlineView: { page: 'resources' }, outlinePermissions: {} });
      if (!host.textContent.includes('准备大纲') || !host.querySelector('[data-outline-resource-help]'))
        throw new Error('大纲资源页缺少模板说明');
      const flatDetail = { ...detail, businessVersions: ['v1', { name: 'v2' }], nodes: [
        { id: 'dir', title: '根目录' },
        { id: 'doc-later', parentId: 'dir', kind: 'document', title: '后续.md', order: 2, description: '已完善' },
        { id: 'doc-first', parentId: 'dir', kind: 'document', title: '优先.md', order: 1 },
      ], governance: { state: 'published', techDomains: [{ id: '7', name: '存储' }],
        effectiveDocumentAssignments: [{ nodeId: 'doc-later', techDomainIds: ['7'] }] } };
      const flatProjection = { status: 'ok', detail: flatDetail, handbook: { id: 'hb-1', name: '详情手册' } };
      host.innerHTML = renderOutlines({ outlineProjection: flatProjection,
        outlineView: { isDetail: true, nodeId: 'dir' }, outlinePermissions: {} });
      const inspector = host.querySelector('[data-outline-node-inspector]');
      if (!inspector?.textContent.includes('目录节点') || !inspector.textContent.includes('2 篇') ||
          !inspector.textContent.includes('待完善 1') || !host.querySelector('.outline-info-drawer .outline-tags')?.textContent.includes('v2'))
        throw new Error('平铺目录节点或业务版本未正确投影');
      host.innerHTML = renderOutlines({ outlineProjection: flatProjection,
        outlineView: { isDetail: true }, outlinePermissions: {} });
      if (host.querySelector('.outline-navigation-document-button[aria-current="page"]')?.dataset.outlineDocument !== 'doc-first')
        throw new Error('同层文档未按顺序选中首篇页面');
      host.remove();
    });
    for (const path of ['/knowledge-center/outlines/resources', '/knowledge-center/outlines/recycle', '/knowledge-center/assets/HB-1/repository?branch=main&lang=en', '/knowledge-center/unknown-module', '/knowledge-center/?externalAccount=1']) {
      await capturePageCoverage(page, coverageMap, expectedFiles);
      await page.goto(`http://127.0.0.1:${port}${path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(150);
    }
    await capturePageCoverage(page, coverageMap, expectedFiles);
    await page.goto(`http://127.0.0.1:${port}/knowledge-center/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.locator('#app-shell').waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('[data-view="dashboard"]').first().waitFor({ state: 'visible', timeout: 15000 });
    for (const view of ['dashboard', 'assets', 'outlines', 'templates', 'production', 'documentTasks', 'review', 'cleaning', 'platform']) {
      const navigation = page.locator(`[data-view="${view}"]`).first();
      if (!await navigation.count()) throw new Error(`前端覆盖率缺少导航入口：${view}`);
      if (view === 'assets') {
        await exerciseAssetManageDialog(page);
        await exerciseAssetRepositoryStatistics(page);
      }
      else if (view === 'cleaning') {
        await exerciseCleaning(page);
        await exerciseCleaningApi(page);
      }
      else await navigation.click();
      await page.locator(`[data-view="${view}"].active`).first().waitFor({ state: 'visible', timeout: 10000 });
      if (view !== 'cleaning') await exerciseView(page, view);
      if (view === 'documentTasks') await exercisePlanCalendar(page);
      await page.waitForTimeout(200);
    }
    await exerciseSearchableCombobox(page);
    await exerciseDirectoryTree(page);
    await exerciseResizableNavigation(page);
    await exerciseScrollRuntime(page);
    await exerciseDismissibleMenus(page);
    await exerciseViewportRuntime(page);
    const cleaningUploadHttpCases = await exerciseCleaningUploadHttp(page);
    if (cleaningUploadHttpCases !== 7) throw new Error('资料上传HTTP场景计数不完整');
    await exerciseDatabaseEnhancer(page);
    await exerciseProductionProvenance(page);
    await exerciseAuthController(page);
    await exerciseHandbookWritingEntry(page);
    const writingAdoptionHttpCases = await exerciseWritingAdoptionHttp(page);
    if (writingAdoptionHttpCases !== 3) throw new Error('写作候选采用HTTP场景计数不完整');
    await exerciseRepositoryMappingReads(page);
    await exerciseTableViewConfigurator(page);
    await exerciseAppOutlineControls(page);
    await exerciseOutlineGovernanceMutations(page);
    await exerciseIncrementalFormCommands(page);
    await exerciseOnlineReviewPreflight(page);
    await exerciseHandbookDrawers(page);
    const handbookReviewSelectionCases = await exerciseHandbookReviewSelection(page);
    if (handbookReviewSelectionCases !== 6) throw new Error('手册送审确认场景计数不完整');
    const handbookDraftInputCases = await exerciseHandbookDraftInput(page);
    if (handbookDraftInputCases !== 8) throw new Error('手册草稿输入与附件场景计数不完整');
    await exerciseExternalAccountRecovery(page);
    await exercisePrincipalEditor(page);
    const principalImportHttpCases = await exercisePrincipalImportHttp(page);
    if (principalImportHttpCases !== 6) throw new Error('人员导入HTTP场景计数不完整');
    await exerciseTeamMembershipEditor(page);
    const teamPage = await context.newPage();
    let teamGroupHttpCases;
    try {
      await teamPage.goto(`http://127.0.0.1:${port}/knowledge-center/`, { waitUntil: 'networkidle', timeout: 30000 });
      await teamPage.locator('#app-shell').waitFor({ state: 'visible', timeout: 15000 });
      teamGroupHttpCases = await exerciseTeamGroupHttp(teamPage);
      await capturePageCoverage(teamPage, coverageMap, expectedFiles);
    } finally {
      await teamPage.close();
    }
    if (teamGroupHttpCases !== 10) throw new Error('团队小组HTTP场景计数不完整');
    const managementHttpCounts = [];
    for (const [exercise, expected, label] of [
      [exerciseGitlabMappingHttp, 16, 'GitLab版本映射'],
      [exerciseGitlabConnectionHttp, 14, 'GitLab仓库连接'],
      [exercisePermissionRolesHttp, 8, '权限管理'],
      [exerciseAssetManagementHttp, 9, '知识资产管理'],
      [exerciseOutlineRecycleHttp, 12, '大纲回收站'],
      [exerciseIncrementalCreateHttp, 13, '增量任务创建'],
    ]) {
      const dedicatedPage = await context.newPage();
      const pageErrors = [];
      dedicatedPage.on('pageerror', error => pageErrors.push(error.message));
      try {
        await dedicatedPage.goto(`http://127.0.0.1:${port}/knowledge-center/`, { waitUntil: 'networkidle', timeout: 30000 });
        await dedicatedPage.locator('#app-shell').waitFor({ state: 'visible', timeout: 15000 });
        const count = await exercise(dedicatedPage);
        if (count !== expected) throw new Error(`${label}HTTP场景计数应为${expected}，实际${count}`);
        if (pageErrors.length) throw new Error(`${label}页面脚本错误：${pageErrors.join('; ')}`);
        await capturePageCoverage(dedicatedPage, coverageMap, expectedFiles);
        managementHttpCounts.push(count);
      } finally {
        await dedicatedPage.close();
      }
    }
    const [gitlabMappingHttpCases, gitlabConnectionHttpCases, permissionRolesHttpCases, assetManagementHttpCases, outlineRecycleHttpCases, incrementalCreateHttpCases] = managementHttpCounts;
    await exerciseOutlineImport(page);
    await exerciseReviewLocalControls(page);
    await exerciseReviewInlineComment(page);
    await exerciseNavigationState(page);
    await exerciseTemplateController(page, coverageMap, expectedFiles);
    await exerciseRepositoryWorkspace(page, coverageMap, expectedFiles);
    const navigationFiles = await capturePageCoverage(page, coverageMap, expectedFiles);
    const apiDirectory = path.join(output, 'api-contract-cases', `${Date.now()}-${process.pid}`);
    fs.mkdirSync(apiDirectory, { recursive: true });
    await runWritingTest(['--test', 'tests/e2e/agent-runner/frontend-api-contracts.node.test.cjs'],
      { ...process.env, KC_FRONTEND_ISTANBUL_CASE_DIR: apiDirectory },
      path.join(apiDirectory, 'api-contract-test.log'), '前端 API 真实 HTTP 契约测试');
    const apiFiles = fs.readdirSync(apiDirectory).filter(name => name.endsWith('.json'));
    if (apiFiles.length !== 22) throw new Error(`前端 API 契约计数应为 22 个，实际 ${apiFiles.length}`);
    for (const name of apiFiles) {
      const snapshot = JSON.parse(fs.readFileSync(path.join(apiDirectory, name), 'utf8'));
      const entries = Object.values(snapshot || {});
      if (!entries.length) throw new Error(`前端 API 契约计数为空：${name}`);
      for (const fileCoverage of entries) {
        if (!expectedFiles.has(fileCoverage?.path) || !fileCoverage.statementMap) {
          throw new Error(`前端 API 契约出现分母之外的源码：${fileCoverage?.path || name}`);
        }
        coverageMap.merge({ [fileCoverage.path]: fileCoverage });
      }
    }
    const caseDirectory = path.join(output, 'writing-cases', `${Date.now()}-${process.pid}`);
    await runWritingCoverage(caseDirectory);
    const caseFiles = fs.readdirSync(caseDirectory).filter(name => name.endsWith('.json'));
    if (!caseFiles.length) throw new Error('写作浏览器测试未生成覆盖率计数');
    for (const name of caseFiles) {
      const caseCoverage = JSON.parse(fs.readFileSync(path.join(caseDirectory, name), 'utf8'));
      const entries = Array.isArray(caseCoverage) ? caseCoverage.flatMap(coverage => Object.values(coverage || {})) : Object.values(caseCoverage);
      if (!entries.length) throw new Error(`写作浏览器测试计数为空：${name}`);
      for (const fileCoverage of entries) {
        if (!expectedFiles.has(fileCoverage?.path) || !fileCoverage.statementMap) {
          throw new Error(`写作浏览器测试出现分母之外的源码：${fileCoverage?.path || name}`);
        }
        coverageMap.merge({ [fileCoverage.path]: fileCoverage });
      }
    }
    const documentTaskDirectory = path.join(output, 'document-task-cases', `${Date.now()}-${process.pid}`);
    await runDocumentTaskCoverage(documentTaskDirectory);
    const documentTaskFiles = fs.readdirSync(documentTaskDirectory).filter(name => name.endsWith('.json'));
    if (documentTaskFiles.length !== 1) throw new Error(`任务管理计数文件应为 1 个，实际 ${documentTaskFiles.length}`);
    const documentTaskSnapshots = JSON.parse(fs.readFileSync(path.join(documentTaskDirectory, documentTaskFiles[0]), 'utf8'));
    if (!Array.isArray(documentTaskSnapshots) || !documentTaskSnapshots.length) throw new Error('任务管理页面计数为空');
    for (const snapshot of documentTaskSnapshots) {
      const entries = Object.values(snapshot || {});
      if (!entries.length) throw new Error('任务管理导航页面计数为空');
      for (const fileCoverage of entries) {
        if (!expectedFiles.has(fileCoverage?.path) || !fileCoverage.statementMap) {
          throw new Error(`任务管理测试出现分母之外的源码：${fileCoverage?.path || 'unknown'}`);
        }
        coverageMap.merge({ [fileCoverage.path]: fileCoverage });
      }
    }
    const myWorkDirectory = path.join(output, 'my-work-cases', `${Date.now()}-${process.pid}`);
    await runMyWorkCoverage(myWorkDirectory);
    const myWorkFiles = fs.readdirSync(myWorkDirectory).filter(name => name.endsWith('.json'));
    if (myWorkFiles.length !== 8) throw new Error(`我的工作计数文件应为 8 个，实际 ${myWorkFiles.length}`);
    for (const name of myWorkFiles) {
      const snapshot = JSON.parse(fs.readFileSync(path.join(myWorkDirectory, name), 'utf8'));
      const entries = Object.values(snapshot || {});
      if (!entries.length) throw new Error(`我的工作页面计数为空：${name}`);
      for (const fileCoverage of entries) {
        if (!expectedFiles.has(fileCoverage?.path) || !fileCoverage.statementMap) {
          throw new Error(`我的工作测试出现分母之外的源码：${fileCoverage?.path || name}`);
        }
        coverageMap.merge({ [fileCoverage.path]: fileCoverage });
      }
    }
    const handbookReturnDirectory = path.join(output, 'handbook-return-cases', `${Date.now()}-${process.pid}`);
    await runHandbookReturnCoverage(handbookReturnDirectory);
    const handbookReturnFiles = fs.readdirSync(handbookReturnDirectory).filter(name => name.endsWith('.json'));
    if (handbookReturnFiles.length !== 5) throw new Error(`手册往返计数文件应为 5 个，实际 ${handbookReturnFiles.length}`);
    for (const name of handbookReturnFiles) {
      const snapshot = JSON.parse(fs.readFileSync(path.join(handbookReturnDirectory, name), 'utf8'));
      const entries = Object.values(snapshot || {});
      if (!entries.length) throw new Error(`手册往返页面计数为空：${name}`);
      for (const fileCoverage of entries) {
        if (!expectedFiles.has(fileCoverage?.path) || !fileCoverage.statementMap) {
          throw new Error(`手册往返测试出现分母之外的源码：${fileCoverage?.path || name}`);
        }
        coverageMap.merge({ [fileCoverage.path]: fileCoverage });
      }
    }
    const handbookEditorDirectory = path.join(output, 'handbook-editor-cases', `${Date.now()}-${process.pid}`);
    await runHandbookEditorCoverage(handbookEditorDirectory);
    const handbookEditorFiles = fs.readdirSync(handbookEditorDirectory).filter(name => name.endsWith('.json'));
    if (handbookEditorFiles.length !== 5) throw new Error(`手册编辑器计数文件应为 5 个，实际 ${handbookEditorFiles.length}`);
    for (const name of handbookEditorFiles) {
      const snapshot = JSON.parse(fs.readFileSync(path.join(handbookEditorDirectory, name), 'utf8'));
      const entries = Object.values(snapshot || {});
      if (!entries.length) throw new Error(`手册编辑器页面计数为空：${name}`);
      for (const fileCoverage of entries) {
        if (!expectedFiles.has(fileCoverage?.path) || !fileCoverage.statementMap) {
          throw new Error(`手册编辑器测试出现分母之外的源码：${fileCoverage?.path || name}`);
        }
        coverageMap.merge({ [fileCoverage.path]: fileCoverage });
      }
    }
    const platformDirectory = path.join(output, 'platform-cases', `${Date.now()}-${process.pid}`);
    const platformSuites = await runPlatformCoverage(platformDirectory);
    for (const [suite] of platformSuites) {
      const directory = path.join(platformDirectory, suite);
      for (const name of fs.readdirSync(directory).filter(item => item.endsWith('.json'))) {
        const snapshot = JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'));
        const entries = Object.values(snapshot || {});
        if (!entries.length) throw new Error(`平台 ${suite} 页面计数为空：${name}`);
        for (const fileCoverage of entries) {
          if (!expectedFiles.has(fileCoverage?.path) || !fileCoverage.statementMap) {
            throw new Error(`平台 ${suite} 测试出现分母之外的源码：${fileCoverage?.path || name}`);
          }
          coverageMap.merge({ [fileCoverage.path]: fileCoverage });
        }
      }
    }
    const reviewDirectory = path.join(output, 'review-cases', `${Date.now()}-${process.pid}`);
    await runReviewCoverage(reviewDirectory);
    const reviewFiles = fs.readdirSync(reviewDirectory).filter(name => name.endsWith('.json'));
    if (reviewFiles.length !== 17) throw new Error(`审核工作台计数文件应为 17 个，实际 ${reviewFiles.length}`);
    for (const name of reviewFiles) {
      const pageCoverages = JSON.parse(fs.readFileSync(path.join(reviewDirectory, name), 'utf8'));
      if (!Array.isArray(pageCoverages) || !pageCoverages.length) throw new Error(`审核工作台页面计数为空：${name}`);
      for (const coverage of pageCoverages) {
        for (const fileCoverage of Object.values(coverage || {})) {
          if (!expectedFiles.has(fileCoverage?.path) || !fileCoverage.statementMap) {
            throw new Error(`审核工作台出现分母之外的源码：${fileCoverage?.path || name}`);
          }
          coverageMap.merge({ [fileCoverage.path]: fileCoverage });
        }
      }
    }
    fs.mkdirSync(output, { recursive: true });
    const contextReport = createContext({ dir: output, coverageMap, defaultSummarizer: 'nested' });
    reports.create('json').execute(contextReport);
    reports.create('json-summary').execute(contextReport);
    reports.create('html', { subdir: 'html' }).execute(contextReport);
    reports.create('lcovonly').execute(contextReport);
    completed = true;
    const summary = JSON.parse(fs.readFileSync(path.join(output, 'coverage-summary.json'), 'utf8'));
    console.log(JSON.stringify({ output, sourceFiles: files.length, navigationFiles, apiContractCases: apiFiles.length, handbookReviewSelectionCases, handbookDraftInputCases, teamGroupHttpCases, cleaningUploadHttpCases, writingAdoptionHttpCases, principalImportHttpCases, gitlabMappingHttpCases, gitlabConnectionHttpCases, permissionRolesHttpCases, assetManagementHttpCases, outlineRecycleHttpCases, incrementalCreateHttpCases, writingCases: caseFiles.length, documentTaskPages: documentTaskSnapshots.length, myWorkCases: myWorkFiles.length, handbookReturnCases: handbookReturnFiles.length, handbookEditorCases: handbookEditorFiles.length, platformCases: platformSuites.reduce((sum, suite) => sum + suite[3], 0), reviewCases: reviewFiles.length, total: summary.total }, null, 2));
  } finally {
    if (browser) await browser.close();
    if (server.exitCode === null) {
      server.kill('SIGTERM');
      await new Promise(resolve => server.once('exit', resolve));
    }
    const afterManifest = sourceManifest();
    const inputsAfter = inputManifest();
    const changedInputs = [...new Set([...Object.keys(inputsBefore), ...Object.keys(inputsAfter)])]
      .filter(file => inputsBefore[file] !== inputsAfter[file]).sort();
    const changedFiles = [...new Set([...Object.keys(beforeManifest), ...Object.keys(afterManifest)])]
      .filter(file => beforeManifest[file] !== afterManifest[file]).sort();
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(path.join(output, 'source-stability.json'), JSON.stringify({
      startedAt, finishedAt: new Date().toISOString(), completed,
      stable: changedFiles.length === 0 && changedInputs.length === 0, changedFiles, before: beforeManifest, after: afterManifest,
      inputsStable: changedInputs.length === 0, changedInputs, inputsBefore, inputsAfter,
    }, null, 2) + '\n');
    if (completed && changedInputs.length) throw new Error(`前端采集期间测试或运行输入变化，报告仅供诊断：${changedInputs.join(', ')}`);
    if (completed && changedFiles.length) throw new Error(`前端采集期间源码变化，报告仅供诊断：${changedFiles.join(', ')}`);
  }
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
