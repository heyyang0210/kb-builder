const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '../../..');
const frontend = path.join(root, 'apps/knowledge-center-web/frontend/knowledge-center');
const artifacts = path.join(root, 'runtime/test-results/gitlab-connection-layout');

test('仓库连接表格与详情抽屉在桌面和移动端可用', async () => {
  const { renderPlatformAdmin } = await import(path.join(frontend, 'modules/platform-admin/view.js'));
  const connections = [
    { id: 'main', name: 'YashanDB 产品文档', projectPath: 'products/yashandb/docs', baseUrl: 'https://gitlab.example.com', defaultBranch: 'main', authMode: 'service_account', credentialConfigured: true, mode: 'production', purpose: 'read', managementStatus: 'active', linkedHandbookCount: 12, lastVerification: { status: 'verified', branchCount: 3, verifiedAt: '2026-11-11T02:00:00Z' } },
    { id: 'old', name: '历史资料仓库', projectPath: 'archive/docs', baseUrl: 'https://gitlab.example.com', defaultBranch: 'main', authMode: 'user_oauth', mode: 'sandbox', purpose: 'read_write', managementStatus: 'disabled', linkedHandbookCount: 0, lastVerification: { status: 'failed', verifiedAt: '2026-11-10T02:00:00Z', error: { message: '项目不可访问', recovery: '检查项目路径和账号权限。' } } },
  ];
  const projection = { connections, oauthStatus: { connected: false }, oauthConfig: { configured: true } };
  const styles = ['common/tokens.css', 'common/base.css', 'common/components.css', 'styles.css', 'modules/platform-admin/platform-admin.css']
    .map(file => fs.readFileSync(path.join(frontend, file), 'utf8')).join('\n');
  const lucide = fs.readFileSync(path.join(frontend, 'common/vendor/lucide.min.js'), 'utf8');
  fs.mkdirSync(artifacts, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [1800, 390]) {
      const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 1000 }, deviceScaleFactor: 1 });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const markup = state => renderPlatformAdmin({ projection: {}, gitlabProjection: projection, platformAdmin: true, platformTab: 'gitlab', gitlabListState: state });
      await page.setContent(`<html lang="zh-CN"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${styles}</style><main id="view-root">${markup({})}</main><script>${lucide}</script><script>window.lucide.createIcons()</script></html>`);
      assert.equal(await page.locator('.gitlab-connection-drawer').count(), 0);
      assert.equal(await page.locator('[data-gitlab-row]').count(), 2);
      assert.equal(await page.locator('#platform-panel-gitlab h3').count(), 0);
      assert.equal(await page.locator('[data-gitlab-add-connection]').count(), 1);
      assert.match(await page.locator('[data-gitlab-row="main"] .gitlab-verification-summary').innerText(), /通过[\s\S]*2026/);
      assert.match(await page.locator('[data-gitlab-row="old"] .gitlab-verification-summary').innerText(), /失败[\s\S]*2026/);
      const tableWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      assert.ok(tableWidth <= width, `表格页面横向溢出: ${width} / ${tableWidth}`);
      await page.screenshot({ path: path.join(artifacts, `${width}-table.png`), fullPage: true });
      await page.locator('#view-root').evaluate((root, html) => { root.innerHTML = html; window.lucide.createIcons(); }, markup({ selectedConnectionId: 'main', drawerOpen: true }));
      assert.equal(await page.locator('.gitlab-connection-drawer').count(), 1);
      assert.match(await page.locator('.gitlab-connection-drawer').innerText(), /平台最近读取验证/);
      assert.match(await page.locator('.gitlab-connection-drawer').innerText(), /平台凭证/);
      const metrics = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, drawer: document.querySelector('.gitlab-connection-drawer').getBoundingClientRect().width, buttons: [...document.querySelectorAll('.gitlab-connection-drawer .gitlab-detail-actions button, .gitlab-drawer-close')].map(button => button.getBoundingClientRect().height) }));
      assert.ok(metrics.page <= width, `抽屉页面横向溢出: ${width} / ${metrics.page}`);
      assert.ok(metrics.buttons.every(height => height >= 44), `操作目标低于 44px: ${metrics.buttons}`);
      if (width === 390) assert.ok(metrics.drawer <= 390);
      await page.screenshot({ path: path.join(artifacts, `${width}-drawer.png`) });
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});
