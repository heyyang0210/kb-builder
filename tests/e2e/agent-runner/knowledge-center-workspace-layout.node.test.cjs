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
  ['文档生产', '<section><div class="workspace-action-row production-heading"><div class="production-heading-actions"><button>文档生成工作台</button><button>创建增量任务</button></div></div><a class="production-subnav-link active">生产列表</a></section>'],
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
    ['modules/production/view.js', 'data-incremental-create-open'],
    ['modules/document-tasks/view.js', "root.querySelector('.document-task-page-header h1')?.remove()"],
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
