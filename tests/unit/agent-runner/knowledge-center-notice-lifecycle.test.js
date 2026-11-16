const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '../../..');
const frontend = path.join(root, 'apps/knowledge-center-web/frontend/knowledge-center');
const read = file => fs.readFileSync(path.join(frontend, file), 'utf8');

describe('知识中心操作提示生命周期', () => {
  test('全局提示不按固定时长关闭，并提供显式关闭入口', () => {
    const html = read('knowledge-center-management.html');
    const app = read('app.js');
    const show = app.slice(app.indexOf('function showAppNotice('), app.indexOf('\nfunction showApplicationError('));
    expect(show).not.toMatch(/setTimeout|noticeDismissTimer|duration/);
    expect(html).toContain('id="notice-dismiss"');
    expect(app).toContain("byId('notice-dismiss').addEventListener('click'");
    expect(app).toContain("globalErrorPanel?.dataset.platformStateNotice === 'true'");
    expect(app).toContain("else if (byId('error-panel').dataset.platformStateNotice === 'true')");
  });

  test('全局成功提示超过3秒仍显示，用户关闭后隐藏', async () => {
    const app = read('app.js');
    const start = app.indexOf('function showAppNotice(');
    const end = app.indexOf('\nfunction showApplicationError(', start);
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.setContent('<main><section id="error-panel" hidden><strong id="error-title"></strong><p id="error-message"></p><button id="retry"></button><a id="notice-action"></a><button id="notice-dismiss">关闭</button></section></main>');
      await page.evaluate(source => {
        const byId = id => document.getElementById(id);
        const showAppNotice = new Function('byId', `${source}; return showAppNotice;`)(byId);
        byId('notice-dismiss').addEventListener('click', () => { byId('error-panel').hidden = true; });
        showAppNotice('操作已保存', { title: '保存成功', tone: 'success' });
      }, app.slice(start, end));
      await page.waitForTimeout(3200);
      expect(await page.locator('#error-panel').isVisible()).toBe(true);
      await page.locator('#notice-dismiss').click();
      expect(await page.locator('#error-panel').isVisible()).toBe(false);
    } finally {
      await browser.close();
    }
  });

  test('任务管理提示跨页面重绘保留，且不使用短时自动隐藏', () => {
    const source = read('modules/document-tasks/view.js');
    expect(source).toContain('feedbackMessage');
    expect(source).toContain('status(state.feedbackMessage, state.feedbackIsError)');
    expect(source).toContain('data-task-dismiss-message');
    expect(source).not.toMatch(/statusTimer|setTimeout\(\(\) => \{ node\.hidden = true/);
  });

  test('PingCode 操作结果和关系警告不自动消失，并可手动关闭', () => {
    const source = read('modules/platform-admin/pingcode-sync.js');
    expect(source).toContain('data-pc-dismiss-message');
    expect(source).toContain('data-pc-dismiss-warning');
    expect(source).toContain('data-pc-dismiss-workspace-error');
    expect(source).not.toMatch(/toastTimer|renderedToast|unlinkedWarningTimer|5000\)/);
  });
});
