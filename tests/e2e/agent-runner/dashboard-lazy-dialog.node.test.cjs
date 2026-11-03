const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { setup } = require('./fixtures/production-writing.cjs');

test('工作台按需构建当前领域详情，保留人员选择及更新后的内容', async t => {
  const api = await setup(t, { browser: true });
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(api.origin + '/browser-fixture');
  const result = await page.evaluate(async () => {
    const { renderDashboard } = await import('/knowledge-center/modules/dashboard/view.js');
    const tasks = ['a', 'b'].map(id => ({ id, techDomainName: id, domainMembers: [{ id: 'p1', name: '测试人员' }], items: Array.from({ length: 500 }, (_, n) => ({ id: `${id}-${n}`, documentTitle: `文章${n}`, assigneeId: 'p1' })) }));
    const root = document.createElement('main');
    const draw = openDomainTaskId => { root.innerHTML = renderDashboard({ projection: {}, domainBuildTaskProjection: { tasks }, openDomainTaskId }); };
    draw();
    const initial = { cards: root.querySelectorAll('[data-domain-task-open]').length, selects: root.querySelectorAll('select').length, dialogs: root.querySelectorAll('dialog').length };
    draw('b');
    const opened = { dialogs: root.querySelectorAll('dialog').length, id: root.querySelector('dialog').dataset.domainTaskDialog, selects: root.querySelectorAll('select').length, selected: root.querySelector('select').value };
    tasks[1].items[0].documentTitle = '更新后的文章'; draw('b');
    const refreshed = root.querySelector('.domain-task-item-title strong').textContent;
    draw();
    return { initial, opened, refreshed, closed: root.querySelectorAll('dialog').length };
  });
  assert.deepEqual(result.initial, { cards: 2, selects: 0, dialogs: 0 });
  assert.deepEqual(result.opened, { dialogs: 1, id: 'b', selects: 500, selected: 'p1' });
  assert.equal(result.refreshed, '更新后的文章');
  assert.equal(result.closed, 0);
});
