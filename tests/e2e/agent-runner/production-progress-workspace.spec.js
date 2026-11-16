const { test, expect } = require('@playwright/test');

const baseUrl = process.env.KPG_BASE_URL;
const tasks = [
  { id: 'progress-fixture-1', name: '安装指南更新', handbookId: 'HB-PROGRESS', handbookName: 'SQL 手册', businessVersion: '23.4.3', state: 'editing', activityAt: '2026-02-12T10:00:00Z' },
  { id: 'progress-fixture-2', name: '连接章节审核', handbookId: 'HB-PROGRESS', handbookName: 'SQL 手册', businessVersion: '23.4.3', state: 'under_review', updated_at: '2026-02-13T10:00:00Z' },
  { id: 'progress-fixture-3', name: '等待补充日期的任务', handbookId: 'HB-PROGRESS', handbookName: 'SQL 手册', businessVersion: '23.4.3', state: 'draft' },
  { id: 'progress-fixture-4', name: '安全测试" /><img src=x onerror=alert(1)>', handbookId: 'HB-PROGRESS', handbookName: 'SQL 手册', businessVersion: '23.4.3', state: 'editing', activityAt: '2026-02-12T11:00:00Z' },
  { id: 'progress-fixture-5', name: '平台已发布任务', handbookId: 'HB-PROGRESS', handbookName: 'SQL 手册', businessVersion: '23.4.3', state: 'published', updatedAt: '2026-02-13T12:00:00Z' },
];

async function clickAndMeasurePaint(page, selector) {
  const marker = `__progressClickStarted${Date.now()}`;
  const endMarker = `${marker}End`;
  await page.evaluate(({ selector, marker }) => {
    document.addEventListener('click', event => {
      if (event.target.closest(selector)) window[marker] = performance.now();
    }, { capture: true, once: true });
    document.addEventListener('click', event => {
      if (event.target.closest(selector)) window[`${marker}End`] = performance.now();
    }, { once: true });
  }, { selector, marker });
  await page.locator(selector).click();
  return page.evaluate(async ({ marker, endMarker }) => {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return { handlerMs: window[endMarker] - window[marker], paintMs: performance.now() - window[marker] };
  }, { marker, endMarker });
}

test.describe('生产进展单页视图', () => {
  test('列表、日历、图表与任务摘要在同一真实页面内切换', async ({ page }, testInfo) => {
    test.skip(!baseUrl, '需要隔离测试环境入口');
    const login = await page.request.post(`${baseUrl}/knowledge-center/api/auth/admin/login`, {
      data: {
        username: process.env.KNOWLEDGE_CENTER_ADMIN_USERNAME || 'admin',
        password: process.env.KNOWLEDGE_CENTER_ADMIN_PASSWORD || 'admin',
      },
    });
    expect(login.ok(), `隔离实例登录失败：HTTP ${login.status()}`).toBeTruthy();
    await page.setViewportSize({ width: 1440, height: 1100 });
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    let taskRequests = 0;
    await page.route('**/knowledge-center/api/incremental-tasks**', async route => {
      if (route.request().method() !== 'GET') return route.continue();
      taskRequests += 1;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: tasks }) });
    });
    const calendarRequest = page.waitForResponse(response => response.url().includes('/api/production/work-calendar?year=2026'));
    await page.goto(`${baseUrl}/knowledge-center/production?view=progress&mode=calendar&day=2026-02-14`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.production-progress-overview')).toBeVisible();
    await expect(page.getByRole('button', { name: /创建任务|创建增量任务/ })).toHaveCount(0);
    const stageBarStyle = await page.locator('.production-progress-stages').evaluate(node => getComputedStyle(node).display);
    expect(stageBarStyle).toBe('flex');
    await expect(page.locator('[data-progress-stage=""] strong')).toBeVisible();
    await expect(page.locator('[data-progress-stage="待生成"] strong')).toBeVisible();
    await expect(page.locator('[data-progress-stage="已完成"] strong')).toHaveText('1');
    await expect(page.locator('[data-calendar-legend]')).toContainText('法定节假日');
    await expect(page.locator('[data-production-task-summary]')).toBeAttached();
    const installDay = page.locator('[data-progress-day="2026-02-12"]');
    const reviewDay = page.locator('[data-progress-day="2026-02-13"]');
    await expect(installDay).toContainText('安装指南更新');
    await expect(reviewDay).toContainText('连接章节审核');
    await expect(installDay).toHaveAttribute('aria-label', /安装指南更新/);
    await expect(installDay).toHaveAttribute('aria-label', /安全测试" \/><img src=x onerror=alert\(1\)>/);
    await expect(page.locator('.production-calendar-grid img')).toHaveCount(0);
    await expect(page.locator('.production-calendar-undated')).toContainText('等待补充日期的任务');

    const calendar = await calendarRequest;
    expect(calendar.ok()).toBeTruthy();
    const calendarPayload = await calendar.json();
    expect(calendarPayload.data).toMatchObject({ year: 2026, configured: true, source: { documentNumber: '国办发明电〔2025〕7号' } });
    await expect(page.locator('[data-progress-day="2026-02-14"]')).toHaveClass(/is-workday/);
    await expect(page.locator('[data-progress-day="2026-02-15"]')).toHaveClass(/is-holiday/);
    const calendarColorFacts = await page.evaluate(() => Object.fromEntries(['2026-02-07', '2026-02-14', '2026-02-15', '2026-02-16'].map(day => {
      const cell = document.querySelector(`[data-progress-day="${day}"]`);
      const style = getComputedStyle(cell);
      return [day, { background: style.backgroundColor, accent: style.borderLeftColor, width: style.borderLeftWidth }];
    })));
    expect(calendarColorFacts['2026-02-14']).toMatchObject({ background: 'rgb(255, 255, 255)', accent: 'rgb(24, 121, 78)', width: '3px' });
    expect(calendarColorFacts['2026-02-15']).toMatchObject({ background: 'rgb(255, 255, 255)', accent: 'rgb(180, 35, 24)', width: '3px' });
    expect(calendarColorFacts['2026-02-16']).toMatchObject({ background: 'rgb(255, 255, 255)', accent: 'rgb(180, 35, 24)', width: '3px' });
    expect(calendarColorFacts['2026-02-07']).toMatchObject({ background: 'rgb(255, 245, 214)', accent: 'rgb(154, 103, 0)', width: '3px' });
    await page.screenshot({ path: testInfo.outputPath('production-calendar-2026-desktop.png'), fullPage: true });
    await installDay.click();
    await expect(page.locator('.production-calendar-agenda')).toContainText('安装指南更新');

    const chartSwitchMs = await clickAndMeasurePaint(page, '[data-progress-mode="charts"]');
    expect(chartSwitchMs.handlerMs, `图表切换事件耗时 ${chartSwitchMs.handlerMs.toFixed(1)}ms`).toBeLessThan(100);
    expect(chartSwitchMs.paintMs, `图表切换到画面稳定耗时 ${chartSwitchMs.paintMs.toFixed(1)}ms`).toBeLessThan(100);
    console.info(`[生产进展时序] 图表切换 ${chartSwitchMs.handlerMs.toFixed(1)}ms / ${chartSwitchMs.paintMs.toFixed(1)}ms（处理器 / 两帧绘制）`);
    await expect(page.locator('.production-progress-charts')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('production-charts-desktop.png'), fullPage: true });
    const listSwitchMs = await clickAndMeasurePaint(page, '[data-progress-mode="list"]');
    expect(listSwitchMs.handlerMs, `列表切换事件耗时 ${listSwitchMs.handlerMs.toFixed(1)}ms`).toBeLessThan(100);
    expect(listSwitchMs.paintMs, `列表切换到画面稳定耗时 ${listSwitchMs.paintMs.toFixed(1)}ms`).toBeLessThan(100);
    console.info(`[生产进展时序] 列表切换 ${listSwitchMs.handlerMs.toFixed(1)}ms / ${listSwitchMs.paintMs.toFixed(1)}ms（处理器 / 两帧绘制）`);
    await expect(page.locator('[data-progress-task-summary]')).toHaveCount(3);
    await expect(page.locator('[data-progress-task-summary="progress-fixture-1"]')).toBeVisible();
    const requestCountAfterLoad = taskRequests;
    const summaryOpenMs = await clickAndMeasurePaint(page, '[data-progress-task-summary="progress-fixture-1"]');
    expect(summaryOpenMs.handlerMs, `任务摘要事件耗时 ${summaryOpenMs.handlerMs.toFixed(1)}ms`).toBeLessThan(100);
    expect(summaryOpenMs.paintMs, `任务摘要到画面稳定耗时 ${summaryOpenMs.paintMs.toFixed(1)}ms`).toBeLessThan(100);
    console.info(`[生产进展时序] 任务摘要 ${summaryOpenMs.handlerMs.toFixed(1)}ms / ${summaryOpenMs.paintMs.toFixed(1)}ms（处理器 / 两帧绘制）`);
    const dialogState = await page.locator('[data-production-task-summary]').evaluate(dialog => ({
      open: dialog.open,
      isModal: dialog.matches(':modal'),
      showModalType: typeof dialog.showModal,
      taskId: dialog.dataset.taskId,
    }));
    expect(dialogState.open, `摘要状态 ${JSON.stringify(dialogState)}；页面异常 ${pageErrors.join(' | ')}`).toBe(true);
    await expect(page.locator('[data-production-task-summary]')).toBeVisible();
    await expect(page.locator('[data-production-task-summary]')).toContainText('安装指南更新');
    expect(taskRequests).toBe(requestCountAfterLoad);
    await page.locator('[data-production-summary-close]').last().click();
    await expect(page.locator('[data-production-task-summary]')).toBeHidden();

    const desktopOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(desktopOverflow).toBeLessThanOrEqual(0);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('tab', { name: '日历' }).click();
    const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(mobileOverflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: testInfo.outputPath('production-calendar-mobile.png'), fullPage: true });

    const unconfiguredCalendar = page.waitForResponse(response => response.url().includes('/api/production/work-calendar?year=2025'));
    await page.goto(`${baseUrl}/knowledge-center/production?view=progress&mode=calendar&day=2025-02-14`, { waitUntil: 'domcontentloaded' });
    const unconfiguredResponse = await unconfiguredCalendar;
    expect(unconfiguredResponse.ok()).toBeTruthy();
    await expect(page.locator('[data-calendar-legend]')).toHaveText('该年度工作日历未配置，日期性质未知');
    const unknownDay = page.locator('[data-progress-day="2025-02-14"]');
    await expect(unknownDay).toHaveClass(/is-unconfigured/);
    await expect(unknownDay).not.toHaveClass(/is-(workday|weekend|holiday)/);
    await page.screenshot({ path: testInfo.outputPath('production-calendar-unconfigured.png'), fullPage: true });
  });
});
