const { test, expect } = require('@playwright/test');

const baseUrl = process.env.KPG_BASE_URL;

test.beforeEach(async ({ page }) => {
  const response = await page.request.post(`${baseUrl}/knowledge-center/api/auth/admin/login`, { data: { username: 'admin', password: 'admin' } });
  expect(response.ok()).toBe(true);
});

test('已保存的中文仓库映射显示版本、统计并回填连接可见值', async ({ page }) => {
  const mappingResponse = await page.request.get(`${baseUrl}/knowledge-center/api/gitlab/mappings/DB-004`);
  expect(mappingResponse.ok()).toBe(true);
  const mapping = (await mappingResponse.json()).data;
  expect(mapping.zhPaths.length).toBeGreaterThan(0);
  const catalogResponse = await page.request.get(`${baseUrl}/knowledge-center/api/assets/handbooks?q=DB-004`);
  expect(catalogResponse.ok()).toBe(true);
  expect((await catalogResponse.json()).data.items[0]).toMatchObject({ repositoryMapped: true, repository: { defaultBranch: mapping.defaultBranch } });

  await page.goto(`${baseUrl}/knowledge-center/assets?q=DB-004&handbookId=DB-004`);
  const branch = page.locator('[data-asset-branch="DB-004"]');
  await expect(branch).toHaveValue(mapping.defaultBranch);
  const accessResponse = await page.request.get(`${baseUrl}/knowledge-center/api/gitlab/handbooks/DB-004/access-status`);
  expect(accessResponse.ok()).toBe(true);
  const access = (await accessResponse.json()).data;
  const cell = page.locator('[data-asset-statistics="DB-004"]');
  if (access.canRead) {
    const statisticsResponse = await page.request.get(`${baseUrl}/knowledge-center/api/gitlab/handbooks/DB-004/statistics?ref=${encodeURIComponent(mapping.defaultBranch)}&language=zh`);
    expect(statisticsResponse.ok()).toBe(true);
    const statistics = (await statisticsResponse.json()).data;
    await expect(cell).toContainText(`章节 ${statistics.chapterCount}`, { timeout: 30000 });
    await expect(cell).toContainText(`文档 ${statistics.documentCount}`);
  } else {
    // 实际账号授权异常时验证错误透明呈现，不把它视为数字统计成功。
    await expect(cell).toContainText(access.message, { timeout: 30000 });
  }

  await page.locator('[data-repository-mapping-open="DB-004"]').click();
  const form = page.locator('[data-repository-mapping-form]');
  const connection = form.locator('select[name="connectionId"]');
  await expect(connection).toHaveValue(mapping.connectionId);
  const label = await connection.locator('option:checked').textContent();
  await expect(connection.locator('xpath=ancestor::*[@data-searchable-combobox]//input')).toHaveValue(label);
  await expect(form.locator('select[name="defaultBranch"]')).toHaveValue(mapping.defaultBranch);
  for (const path of mapping.zhPaths) await expect(form).toContainText(path);
});

test('知识资产动态实体可输入筛选且固定枚举保留原生选择', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${baseUrl}/knowledge-center/assets`);
  await expect.poll(() => page.locator('.asset-filters select[name="productId"] option').count()).toBeGreaterThan(1);

  const productSelect = page.locator('.asset-filters select[name="productId"]');
  const productInput = page.locator('.asset-filters [data-searchable-combobox] input[role="combobox"]');
  await expect(productInput).toBeVisible();
  await expect(productInput).toHaveAttribute('aria-autocomplete', 'list');
  const desktopBox = await productInput.boundingBox();
  expect(desktopBox.height).toBeGreaterThanOrEqual(40);
  expect(desktopBox.width).toBeLessThanOrEqual(220);
  await productInput.fill('DB');
  await expect(page.getByRole('option', { name: 'DB', exact: true })).toBeVisible();
  await productInput.press('ArrowDown');
  await productInput.press('Enter');
  await expect(productSelect).not.toHaveValue('');

  const statusSelect = page.locator('.asset-filters select[name="status"]');
  await expect(statusSelect).toBeVisible();
  await expect(statusSelect.locator('xpath=ancestor::*[@data-searchable-combobox]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('知识资产表格分支选择器保持紧凑宽度', async ({ page }) => {
  await page.goto(`${baseUrl}/knowledge-center/assets`);
  const branchInput = page.locator('.asset-table [data-searchable-combobox] input[role="combobox"]').first();
  await expect(branchInput).toBeVisible();
  const box = await branchInput.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(160);
  expect(box.width).toBeLessThanOrEqual(190);

  await page.getByRole('button', { name: '新增手册' }).click();
  const dialog = page.locator('[data-asset-create-dialog]');
  const dialogProduct = dialog.locator('[data-searchable-combobox]').first();
  await expect(dialogProduct).toBeVisible();
  const [dialogBox, labelBox] = await Promise.all([
    dialogProduct.boundingBox(),
    dialogProduct.locator('xpath=parent::label').boundingBox(),
  ]);
  expect(Math.abs(dialogBox.width - labelBox.width)).toBeLessThanOrEqual(2);
});

test('大纲动态实体使用组合框而状态筛选保持原生选择', async ({ page }) => {
  await page.goto(`${baseUrl}/knowledge-center/outlines/DB-017`);
  const domainSelect = page.locator('select[data-outline-primary-domain]').first();
  await expect(domainSelect.locator('xpath=ancestor::*[@data-searchable-combobox]')).toHaveCount(1);
  await expect(domainSelect.locator('xpath=ancestor::*[@data-searchable-combobox]//input[@role="combobox"]')).toBeVisible();
  const outlineFilter = page.getByRole('combobox', { name: '按技术领域筛选，可输入筛选' });
  await expect.poll(async () => (await outlineFilter.boundingBox())?.width || 0).toBeGreaterThan(0);
  await expect.poll(async () => (await outlineFilter.boundingBox())?.width || Infinity).toBeLessThanOrEqual(220);

  await page.goto(`${baseUrl}/knowledge-center/outlines`);
  const statusSelect = page.locator('[data-outline-status-filter]');
  await expect(statusSelect).toBeVisible();
  await expect(statusSelect.locator('xpath=ancestor::*[@data-searchable-combobox]')).toHaveCount(0);

  await page.goto(`${baseUrl}/knowledge-center/platform?tab=permissions`);
  const roleFilter = page.getByRole('combobox', { name: '按角色筛选，可输入筛选' });
  await expect(roleFilter).toBeVisible();
  await expect.poll(async () => (await roleFilter.boundingBox())?.width || 0).toBeGreaterThan(0);
  await expect.poll(async () => (await roleFilter.boundingBox())?.width || Infinity).toBeLessThanOrEqual(220);

  await page.goto(`${baseUrl}/knowledge-center/review?view=reader&handbookId=DB-001&showAll=1`);
  const branchFilter = page.getByRole('combobox', { name: '选择分支，可输入筛选' });
  await expect(branchFilter).toBeVisible();
  await expect.poll(async () => (await branchFilter.boundingBox())?.width || 0).toBeGreaterThan(0);
  await expect.poll(async () => (await branchFilter.boundingBox())?.width || Infinity).toBeLessThanOrEqual(220);
});

test('移动端组合框不造成页面级横向溢出', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${baseUrl}/knowledge-center/assets`);
  await expect.poll(() => page.locator('.asset-filters select[name="productId"] option').count()).toBeGreaterThan(1);
  const input = page.locator('.asset-filters [data-searchable-combobox] input[role="combobox"]');
  await input.click();
  const listbox = page.locator('[data-searchable-combobox-listbox]:visible');
  await expect(listbox).toBeVisible();
  const inputBox = await input.boundingBox();
  const listboxBox = await listbox.boundingBox();
  expect(inputBox.height).toBeGreaterThanOrEqual(44);
  expect(listboxBox.width).toBeGreaterThanOrEqual(220);
  expect(listboxBox.x).toBeGreaterThanOrEqual(8);
  expect(listboxBox.x + listboxBox.width).toBeLessThanOrEqual(367);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test('真实团队关系驱动大纲分工候选并在平台页展示关联领域', async ({ page }) => {
  const rosterResponse = await page.request.get(`${baseUrl}/knowledge-center/api/platform/team-groups?groupType=TECH_DOMAIN`);
  expect(rosterResponse.ok()).toBe(true);
  const roster = await rosterResponse.json();
  expect(roster.success).toBe(true);
  const team = roster.data.items.find(item => item.techDomainName === '兼容性');
  expect(team, '真实领域必须配置团队').toBeTruthy();
  expect(team.leader?.principalId, '真实团队必须配置负责人').toBeTruthy();
  expect(team.members.length, '团队成员候选必须得到验证').toBeGreaterThan(0);
  const people = [...new Map([team.leader, ...team.members].map(person => [String(person.principalId), person])).values()];

  await page.goto(`${baseUrl}/knowledge-center/outlines/DB-017?tab=assignments&domain=2`);
  await expect(page.getByText('兼容性团队尚未配置')).toHaveCount(0);
  await expect(page.locator('.outline-assignment-leader')).toContainText(team.leader.displayName);

  const assignee = page.locator('select[data-domain-task-assignee]').first();
  await expect(assignee).toBeAttached();
  await expect(assignee.locator('option')).toHaveCount(people.length + 1);
  const options = await assignee.locator('option').evaluateAll(items => items.map(item => ({ id: item.value, name: item.textContent })));
  expect(options[0]).toEqual({ id: '', name: '未指定责任人' });
  expect(options.slice(1).sort((a, b) => a.id.localeCompare(b.id))).toEqual(
    people.map(person => ({ id: String(person.principalId), name: person.displayName })).sort((a, b) => a.id.localeCompare(b.id)),
  );
  await expect(assignee.locator('xpath=ancestor::*[@data-searchable-combobox]//input[@role="combobox"]')).toBeVisible();

  await page.goto(`${baseUrl}/knowledge-center/platform?tab=principals&view=groups`);
  await page.locator(`[data-team-group-id="${team.teamGroupId}"]`).click();
  const form = page.locator('[data-team-group-form]');
  await expect(form).toBeVisible();
  await expect(form).toContainText('关联领域：兼容性');
  await expect(form.locator('select[name="leaderPrincipalId"]')).toHaveValue(String(team.leader.principalId));
  await expect(form.locator('[data-team-member-chip]')).toHaveCount(team.members.length);
  for (const member of team.members) {
    await expect(form.locator(`[data-team-member-chip="${member.principalId}"]`)).toContainText(member.displayName);
  }

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
    { width: 768, height: 900 },
    { width: 375, height: 812 },
  ]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  }
});
