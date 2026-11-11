const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '../../..');
const frontend = path.join(root, 'apps/knowledge-center-web/frontend/knowledge-center');
const artifacts = path.join(root, 'runtime/test-results/platform-governance-layout');

test('系统治理按结论、待办和运行表展示正常及异常状态', async () => {
  const { renderPlatformAdmin } = await import(path.join(frontend, 'modules/platform-admin/view.js'));
  const styles = ['common/tokens.css', 'common/base.css', 'common/components.css', 'styles.css', 'modules/platform-admin/platform-admin.css', 'common/appearance.css']
    .map(file => fs.readFileSync(path.join(frontend, file), 'utf8')).join('\n');
  const lucide = fs.readFileSync(path.join(frontend, 'common/vendor/lucide.min.js'), 'utf8');
  const base = {
    projection: { asOf: '2026-11-11T04:44:59Z' }, platformTab: 'governance', platformAdmin: true,
    governanceProjection: { services: [{ name: '文档生成服务', status: 'ok' }, { name: '资料加工服务', status: 'ok' }], externalConnectionSummary: '4/4 个连接已验证', externalConnectionStatus: 'ok', pendingItems: [] },
    databaseConnectionProjection: { healthStatus: 'healthy', status: 'verified', connection: { jdbcUrl: 'jdbc:yasdb://192.168.23.136:1688/yasdb' } },
  };
  const render = state => renderPlatformAdmin({ ...base, ...state });
  fs.mkdirSync(artifacts, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 900 }, deviceScaleFactor: 1 });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.setContent(`<html lang="zh-CN"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${styles}</style><main id="view-root">${render({})}</main><script>${lucide}</script><script>window.lucide.createIcons()</script></html>`);
      assert.match(await page.locator('.governance-conclusion').innerText(), /当前运行状态正常/);
      assert.equal(await page.locator('.governance-status-table tbody tr').count(), 4);
      assert.equal(await page.locator('[data-database-open]').count(), 1);
      assert.match(await page.locator('.governance-pending-empty').innerText(), /暂无待处理事项/);
      assert.equal(await page.locator('.governance-runtime').getByText('4/4 个连接已验证').count(), 1);
      assert.ok(await page.locator('[data-database-open]').evaluate(button => button.getBoundingClientRect().height >= 14));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `正常状态横向溢出: ${width}`);
      await page.screenshot({ path: path.join(artifacts, `${width}-healthy.png`), fullPage: true });

      const warning = render({
        governanceProjection: { services: [{ name: '文档生成服务', status: 'warning' }, { name: '资料加工服务', status: 'ok' }], externalConnectionSummary: '3/4 个连接已验证', externalConnectionStatus: 'warning', pendingItems: [{ title: '仓库连接读取失败', description: '检查连接凭证和项目权限。', actionUrl: '/knowledge-center/platform?tab=gitlab' }] },
        databaseConnectionProjection: { healthStatus: 'unavailable', healthError: { message: '连接失败' }, connection: { jdbcUrl: 'jdbc:yasdb://192.168.23.136:1688/yasdb' } },
      });
      await page.locator('#view-root').evaluate((rootNode, html) => { rootNode.innerHTML = html; window.lucide.createIcons(); }, warning);
      assert.match(await page.locator('.governance-conclusion').innerText(), /当前有 3 项需关注/);
      assert.match(await page.locator('.governance-runtime').innerText(), /不可用/);
      assert.equal(await page.locator('.governance-pending-item a').getAttribute('href'), '/knowledge-center/platform?tab=gitlab');
      assert.match(await page.locator('.governance-conclusion-count').innerText(), /1/);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `告警状态横向溢出: ${width}`);
      await page.screenshot({ path: path.join(artifacts, `${width}-warning.png`), fullPage: true });
      const pendingOnly = render({ governanceProjection: { ...base.governanceProjection, pendingItems: [{ title: '概览读取失败' }] } });
      await page.locator('#view-root').evaluate((rootNode, html) => { rootNode.innerHTML = html; window.lucide.createIcons(); }, pendingOnly);
      assert.match(await page.locator('.governance-conclusion').innerText(), /有 1 项待处理事项/);
      assert.equal(await page.locator('.governance-conclusion.is-healthy').count(), 0);
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});
