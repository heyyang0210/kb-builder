const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '../../..');
const frontend = path.join(root, 'apps/knowledge-center-web/frontend/knowledge-center');
const output = path.join(root, 'runtime/test-results/workspace-layout-20261112');
const styles = [
  'common/tokens.css', 'common/base.css', 'common/components.css', 'styles.css',
  'modules/dashboard/dashboard.css', 'modules/document-tasks/document-tasks.css',
  'modules/production/production.css', 'modules/outlines/outlines.css',
  'modules/platform-admin/platform-admin.css', 'modules/repository/repository.css', 'common/appearance.css',
].map(file => fs.readFileSync(path.join(frontend, file), 'utf8')).join('\n');

const sections = [
  ['工作台', '<section class="my-tasks"><div class="workspace-action-row"><label class="my-task-responsible">当前责任人<select><option>本人</option></select></label></div><div class="my-task-toolbar"><label>搜索<input placeholder="编号或标题"></label><button>查询条件</button></div><div class="my-task-board">待我处理</div></section>'],
  ['知识资产', '<section><div class="workspace-action-row asset-page-intro"><div class="asset-page-actions"><span class="data-note">更新于 2026-11-12</span><button>新增手册</button></div></div><div class="asset-toolbar"><input placeholder="搜索手册名称"><button>筛选</button></div><div>手册列表</div></section>'],
  ['大纲管理', '<section><div class="workspace-action-row outline-list-intro"><div class="outline-list-intro-actions"><button>准备大纲</button><button>回收站</button></div></div><div class="outline-list-toolbar"><label>搜索手册</label><input placeholder="手册名称或编号"></div><div>大纲列表</div></section>'],
  ['模板管理', '<section><div class="workspace-action-row template-page-head"><button>新建模板</button></div><div>模板编辑</div></section>'],
  ['文档生产', '<section><nav class="production-overview-tabs"><button>生产进展</button></nav><a class="production-subnav-link active">生产进展</a><nav class="production-progress-stages"><button>全部任务</button></nav></section>'],
  ['任务管理', '<section class="document-task-page"><div class="workspace-action-row document-task-page-header"><div class="document-task-actions"><button>导出 CSV</button><button>导入工单</button></div></div><div class="document-task-toolbar"><input placeholder="搜索编号或描述"><button>筛选</button></div><div>任务列表</div></section>'],
  ['资料清洗', '<section><div class="cleaning-workspace">资料批次</div></section>'],
  ['平台管理', '<section class="platform-admin-page"><div class="workspace-action-row"><span class="platform-header-meta">更新于 2026-11-12</span></div><button class="platform-tab active">系统治理</button></section>'],
];

test('八个一级视图移除同名内容标题并保留关键操作', () => {
  const read = file => fs.readFileSync(path.join(frontend, file), 'utf8');
  const sources = [
    ['modules/dashboard/my-tasks.js', 'my-task-title-actions'],
    ['modules/assets/view.js', 'asset-page-actions'],
    ['modules/outlines/view.js', 'outline-list-intro-actions'],
    ['modules/templates/view.js', 'data-template-new'],
    ['modules/production/view.js', 'data-progress-mode="calendar"'],
    ['modules/document-tasks/view.js', 'document-task-page-header'],
    ['modules/cleaning/view.js', 'cleaning-workspace'],
    ['modules/platform-admin/view.js', 'platform-header-meta'],
  ];
  for (const [file, action] of sources) {
    const source = read(file);
    assert.ok(source.includes(action), `${file} 丢失原有操作或状态`);
  }
  assert.ok(!read('modules/assets/view.js').includes("'<h2>知识资产</h2>'"));
  assert.ok(!read('modules/outlines/view.js').includes('<h2>大纲管理</h2>'));
  assert.ok(!read('modules/templates/view.js').includes('<h2>模板管理</h2>'));
  assert.ok(!read('modules/production/view.js').includes('<h2>文档生产</h2>'));
  assert.ok(!read('modules/cleaning/view.js').includes('<h2>资料清洗</h2>'));
  assert.ok(!read('modules/platform-admin/view.js').includes('<h2>平台管理</h2>'));
  assert.ok(!read('modules/dashboard/my-tasks.js').includes(" : '我的工作'}</h1>"));
  assert.ok(read('knowledge-center-management.html').includes('id="global-context-title"'));
  assert.ok(read('knowledge-center-management.html').includes('id="page-title" class="sr-only"'));
});

test('普通关闭与隐藏使用中性色，删除仍使用危险色', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.setContent(`<html lang="zh-CN"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${styles}</style><main><button class="icon-button" type="button" aria-label="关闭设置"><i></i></button><button id="sidebar-hide" class="sidebar-control" type="button" aria-label="隐藏导航"><i></i></button><button class="button danger" type="button">删除记录</button><button class="button secondary danger" type="button">移入回收站</button></main></html>`);
    const colors = await page.evaluate(() => ({
      close: getComputedStyle(document.querySelector('[aria-label="关闭设置"]')).color,
      hide: getComputedStyle(document.querySelector('#sidebar-hide')).color,
      remove: getComputedStyle(document.querySelector('.button.danger')).backgroundColor,
      secondaryRemove: getComputedStyle(document.querySelector('.button.secondary.danger')).color,
      secondaryBackground: getComputedStyle(document.querySelector('.button.secondary.danger')).backgroundColor,
      neutral: getComputedStyle(document.documentElement).getPropertyValue('--color-icon-default').trim(),
      danger: getComputedStyle(document.documentElement).getPropertyValue('--color-danger').trim(),
    }));
    assert.equal(colors.close, 'rgb(107, 112, 120)');
    assert.equal(colors.hide, 'rgb(107, 112, 120)');
    assert.equal(colors.remove, 'rgb(180, 35, 24)');
    assert.equal(colors.secondaryRemove, 'rgb(180, 35, 24)');
    assert.equal(colors.secondaryBackground, 'rgb(255, 255, 255)');
    assert.equal(colors.neutral, '#6b7078');
    assert.equal(colors.danger, '#b42318');
    await page.close();
  } finally {
    await browser.close();
  }
});

test('平台字体继承不覆盖组件字体，代码仍使用代码字体', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`<html lang="zh-CN"><style>${styles}.component-font{font-family:Arial,sans-serif}</style><body><p class="component-font">组件文字</p><pre><code>select 1;</code></pre></body></html>`);
    const fonts = await page.evaluate(() => ({
      component: getComputedStyle(document.querySelector('.component-font')).fontFamily,
      code: getComputedStyle(document.querySelector('code')).fontFamily,
    }));
    assert.match(fonts.component, /^Arial/);
    assert.match(fonts.code, /Consolas|monospace/i);
    await page.close();
  } finally {
    await browser.close();
  }
});

test('审核工作区常用控件为44px且禁用态不表现为等待', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.setContent(`<html lang="zh-CN"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${styles}</style><main style="padding:16px"><nav class="review-steps"><button>正文阅读</button><button>差异</button></nav><div class="review-reading-layout"><aside class="review-document-tree"><button class="review-directory-toggle">目录</button><ul><li><button>安装说明</button></li></ul></aside><section><div class="review-reader-toolbar"><input aria-label="搜索正文"></div><div class="review-reader-controls"><select aria-label="分支"><option>main</option></select><div class="review-reader-language"><button>中文</button></div></div></section></div><button class="button" disabled>不可执行</button></main></html>`);
      const result = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        heights: [...document.querySelectorAll('.review-steps button,.review-directory-toggle,.review-document-tree li button,.review-reader-toolbar input,.review-reader-controls select,.review-reader-language button')].map(node => node.getBoundingClientRect().height),
        disabledCursor: getComputedStyle(document.querySelector('.button:disabled')).cursor,
      }));
      assert.equal(result.overflow, false, `${width}px 审核工作区横向溢出`);
      assert.ok(result.heights.every(height => height >= 44), `${width}px 审核操作目标不足44px: ${JSON.stringify(result.heights)}`);
      assert.equal(result.disabledCursor, 'not-allowed');
      await page.close();
    }
  } finally {
    await browser.close();
  }
});

test('仓库操作与审核更多菜单在桌面和窄屏可触达', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.setContent(`<html lang="zh-CN"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${styles}</style><main style="padding:16px"><div class="repository-toolbar"><label>选择分支<select><option>23.4.3alpha</option></select></label><div class="repository-language"><button aria-pressed="true">中文</button><button aria-pressed="false">英文</button></div><button class="button">刷新内容</button></div><div class="review-detail-actions" style="justify-content:flex-end"><details class="review-more-menu" open><summary>更多</summary><div class="review-more-menu-panel"><a href="#mr">MR链接</a><button>状态刷新</button></div></details></div></main>`);
      const controls = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        items: [...document.querySelectorAll('.repository-toolbar select,.repository-language button,.review-more-menu > summary,.review-more-menu-panel a,.review-more-menu-panel button')].map(node => ({ height: node.getBoundingClientRect().height, left: node.getBoundingClientRect().left, right: node.getBoundingClientRect().right })),
      }));
      assert.equal(controls.overflow, false, `${width}px 仓库或审核菜单横向溢出`);
      assert.ok(controls.items.every(item => item.height >= 44 && item.left >= 0 && item.right <= width), `${width}px 操作区不可完整触达: ${JSON.stringify(controls.items)}`);
      await page.addStyleTag({ content: '* { transition: none !important; }' });
      const primary = page.locator('.repository-toolbar .button');
      await primary.hover();
      await page.mouse.down();
      assert.equal(await primary.evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(7, 89, 133)');
      await page.mouse.up();
      await page.close();
    }
  } finally {
    await browser.close();
  }
});

test('八个一级工作区由全局栏命名且操作区没有重复标题', async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.setContent(`<html lang="zh-CN"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${styles}</style><main style="width:calc(100% - 32px);margin:auto">${sections.map(([title, content]) => `<div style="margin-bottom:24px"><header class="global-header"><strong>${title}</strong></header><h1 class="sr-only">${title}</h1>${content}</div>`).join('')}</main></html>`);
      const result = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        visibleTitles: [...document.querySelectorAll('.global-header strong')].map(node => node.textContent),
        duplicateHeadings: [...document.querySelectorAll('.workspace-action-row h1,.workspace-action-row h2')].length,
        actions: [...document.querySelectorAll('.workspace-action-row button,.workspace-action-row select')].every(node => {
          const rect = node.getBoundingClientRect();
          return rect.left >= 0 && rect.right <= innerWidth && rect.height > 0;
        }),
        controls: [...document.querySelectorAll('.workspace-action-row button,.workspace-action-row select,.my-task-toolbar input,.my-task-toolbar button,.asset-toolbar input,.asset-toolbar button,.outline-list-toolbar input,.document-task-toolbar input,.document-task-toolbar button,.production-subnav-link,.platform-tab')].map(node => ({
          label: node.textContent.trim() || node.placeholder,
          height: node.getBoundingClientRect().height,
          fontSize: getComputedStyle(node).fontSize,
          right: node.getBoundingClientRect().right,
        })),
        brand: getComputedStyle(document.querySelector('.production-subnav-link.active')).color,
        brandToken: getComputedStyle(document.documentElement).getPropertyValue('--color-brand').trim(),
        metaSize: getComputedStyle(document.querySelector('.platform-header-meta')).fontSize,
      }));
      assert.equal(result.overflow, false, `${width}px 出现横向溢出`);
      assert.deepEqual(result.visibleTitles, sections.map(([title]) => title));
      assert.equal(result.duplicateHeadings, 0);
      assert.equal(result.actions, true, `${width}px 操作按钮不可完整触达`);
      assert.ok(result.controls.every(control => control.height >= 44 && control.fontSize === '14px' && control.right <= width), `${width}px 页面控件尺寸或可视范围不一致: ${JSON.stringify(result.controls)}`);
      assert.equal(result.brand, 'rgb(3, 105, 161)');
      assert.equal(result.brandToken, '#0369a1');
      assert.equal(result.metaSize, '13px');
      await page.screenshot({ path: path.join(output, `${width}.png`), fullPage: true });
      await page.close();
    }
  } finally {
    await browser.close();
  }
});
