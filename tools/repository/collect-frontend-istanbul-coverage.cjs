#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createInstrumenter } = require('istanbul-lib-instrument');
const { createCoverageMap } = require('istanbul-lib-coverage');
const { createContext } = require('istanbul-lib-report');
const reports = require('istanbul-reports');
const { chromium } = require('@playwright/test');

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

async function activateTab(page, selector, activeSelector, panelSelector) {
  const tab = page.locator(selector).first();
  await tab.waitFor({ state: 'visible', timeout: 10000 });
  await tab.click();
  await page.locator(activeSelector).first().waitFor({ state: 'visible', timeout: 10000 });
  if (panelSelector) await page.locator(panelSelector).first().waitFor({ state: 'visible', timeout: 10000 });
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
    await page.locator('[data-cleaning-upload-open]').click();
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
      if (!await page.locator(`[data-team-group-view="${teamView}"][role="menuitem"][aria-current="page"]`).count()) {
        throw new Error(`人员管理子页面未激活：${teamView}`);
      }
    }
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

async function main() {
  const files = sourceFiles(frontendRoot).sort();
  const instrumenter = createInstrumenter({ esModules: true, coverageVariable: runtimeKey, compact: false });
  const coverageMap = createCoverageMap({});
  const byUrl = new Map();
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    instrumenter.instrumentSync(source, file);
    coverageMap.addFileCoverage(instrumenter.lastFileCoverage());
    const relative = path.relative(frontendRoot, file).split(path.sep).join('/');
    byUrl.set(`/knowledge-center/${relative}`, file);
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
      const file = byUrl.get(requestUrl.pathname);
      if (!file) return route.continue();
      const response = await route.fetch();
      if (!response.ok()) return route.fulfill({ response });
      const instrumented = instrumenter.instrumentSync(await response.text(), file);
      return route.fulfill({ response, body: instrumented });
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
      host.remove();
    });
    for (const path of ['/knowledge-center/outlines/resources', '/knowledge-center/outlines/recycle', '/knowledge-center/assets/HB-1/repository?branch=main&lang=en', '/knowledge-center/unknown-module', '/knowledge-center/?externalAccount=1']) {
      await page.goto(`http://127.0.0.1:${port}${path}`, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(150);
    }
    await page.goto(`http://127.0.0.1:${port}/knowledge-center/`, { waitUntil: 'networkidle', timeout: 30000 });
    for (const view of ['dashboard', 'assets', 'outlines', 'templates', 'production', 'documentTasks', 'review', 'cleaning', 'platform']) {
      const navigation = page.locator(`[data-view="${view}"]`).first();
      if (!await navigation.count()) throw new Error(`前端覆盖率缺少导航入口：${view}`);
      await navigation.click();
      await page.locator(`[data-view="${view}"].active`).first().waitFor({ state: 'visible', timeout: 10000 });
      await exerciseView(page, view);
      if (view === 'documentTasks') await exercisePlanCalendar(page);
      await page.waitForTimeout(200);
    }
    const executed = await page.evaluate(key => globalThis[key] || {}, runtimeKey);
    const runtimeFiles = Object.values(executed).filter(fileCoverage =>
      fileCoverage && typeof fileCoverage === 'object' && typeof fileCoverage.path === 'string' && fileCoverage.statementMap,
    );
    for (const fileCoverage of runtimeFiles) coverageMap.addFileCoverage(fileCoverage);
    const caseDirectory = path.join(output, 'writing-cases', `${Date.now()}-${process.pid}`);
    await runWritingCoverage(caseDirectory);
    const caseFiles = fs.readdirSync(caseDirectory).filter(name => name.endsWith('.json'));
    if (!caseFiles.length) throw new Error('写作浏览器测试未生成覆盖率计数');
    const expectedFiles = new Set(files);
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
    const reviewDirectory = path.join(output, 'review-cases', `${Date.now()}-${process.pid}`);
    await runReviewCoverage(reviewDirectory);
    const reviewFiles = fs.readdirSync(reviewDirectory).filter(name => name.endsWith('.json'));
    if (reviewFiles.length !== 15) throw new Error(`审核工作台计数文件应为 15 个，实际 ${reviewFiles.length}`);
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
    const summary = JSON.parse(fs.readFileSync(path.join(output, 'coverage-summary.json'), 'utf8'));
    console.log(JSON.stringify({ output, sourceFiles: files.length, navigationFiles: runtimeFiles.length, writingCases: caseFiles.length, reviewCases: reviewFiles.length, total: summary.total }, null, 2));
  } finally {
    if (browser) await browser.close();
    if (server.exitCode === null) {
      server.kill('SIGTERM');
      await new Promise(resolve => server.once('exit', resolve));
    }
  }
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
