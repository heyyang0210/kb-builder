const { test, expect } = require('@playwright/test');

const baseUrl = process.env.KPG_BASE_URL;

async function login(api, username = 'test', password = 'test') {
  const response = await api.post(`${baseUrl}/knowledge-center/api/auth/admin/login`, { data: { username, password } });
  expect(response.ok(), `管理员登录失败：HTTP ${response.status()}`).toBeTruthy();
}

async function call(api, method, path, data, idempotencyKey) {
  const response = await api.fetch(`${baseUrl}${path}`, {
    method,
    data,
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
  });
  const body = await response.json();
  expect(response.ok(), `${method} ${path}: ${JSON.stringify(body)}`).toBeTruthy();
  return body.data;
}

async function ensureBaseline(api) {
  let baselines = await call(api, 'GET', '/knowledge-center/api/incremental-tasks/baselines?handbookId=DB-001&businessVersion=23.4');
  let baseline = baselines.find(item => item.current);
  if (!baseline) {
    await call(api, 'POST', '/knowledge-center/api/incremental-tasks/bootstrap-baseline', {
      handbookId: 'DB-001', businessVersion: '23.4',
      content: '# 安装手册\n\n## 参数说明\n\nYAS_PORT 必须与数据库版本一致。',
      commitSha: `e2e-flow-${Date.now()}`, filePath: 'doc/install.md', branch: 'master',
    }, `e2e-flow-baseline-${Date.now()}`);
    baselines = await call(api, 'GET', '/knowledge-center/api/incremental-tasks/baselines?handbookId=DB-001&businessVersion=23.4');
    baseline = baselines.find(item => item.current);
  }
  expect(baseline?.id).toBeTruthy();
  return baseline.id;
}

async function seedTask(api) {
  await login(api);
  const baselineVersionId = await ensureBaseline(api);
  const suffix = Date.now();
  const task = await call(api, 'POST', '/knowledge-center/api/incremental-tasks', {
    name: `E2E 前端流程 ${suffix}`,
    handbookId: 'DB-001', businessVersion: '23.4', baselineVersionId,
  }, `e2e-flow-create-${suffix}`);
  await call(api, 'POST', `/knowledge-center/api/incremental-tasks/${task.id}/sources`, {
    sourceType: 'manual', label: 'E2E 需求来源', reference: `E2E-FLOW-${suffix}`, content: '新增安装参数说明。',
  }, `e2e-flow-source-${suffix}`);
  await call(api, 'PATCH', `/knowledge-center/api/incremental-tasks/${task.id}/target`, {
    documentIds: ['doc-install'], sectionIds: ['section-1'], language: 'zh-CN',
  }, `e2e-flow-target-${suffix}`);
  await call(api, 'PUT', `/knowledge-center/api/incremental-tasks/${task.id}/draft`, {
    editVersion: 0, content: '# 安装手册\n\n新增安装参数说明。',
    operations: [{ type: 'update', documentId: 'doc-install', nodeId: 'section-1', beforeDigest: 'before-digest', after: { content: '新增安装参数说明。' } }],
  }, `e2e-flow-draft-${suffix}`);
  await call(api, 'POST', `/knowledge-center/api/incremental-tasks/${task.id}/checks`, {}, `e2e-flow-checks-${suffix}`);
  await call(api, 'POST', `/knowledge-center/api/incremental-tasks/${task.id}/candidate`, {}, `e2e-flow-candidate-${suffix}`);
  await call(api, 'POST', `/knowledge-center/api/incremental-tasks/${task.id}/reviews`, {}, `e2e-flow-review-${suffix}`);
  return task;
}

test('增量文档构建只允许真实接口支持的操作且阶段入口保持可回溯', async ({ page }) => {
  const task = await seedTask(page.context().request);
  const writes = [];
  page.on('request', request => {
    if (request.method() !== 'GET' && request.url().includes('/knowledge-center/api/incremental-tasks/')) writes.push(request.url());
  });

  await page.goto(`${baseUrl}/knowledge-center/production?taskId=${encodeURIComponent(task.id)}&stage=setup`);
  await expect(page.getByRole('heading', { name: task.name })).toBeVisible();

  await page.getByRole('button', { name: '确认输入', exact: true }).click();
  await expect(page).toHaveURL(/stage=inputs/);
  await expect(page.getByRole('heading', { name: '确认输入' })).toBeVisible();
  await expect(page.locator('#incremental-source').getByText('E2E 需求来源')).toBeVisible();
  await expect(page.getByRole('button', { name: '编写草稿' })).toBeDisabled();
  await expect(page.locator('[data-incremental-prototype-toggle], [data-incremental-prototype-form]')).toHaveCount(0);

  await page.getByRole('button', { name: '编写草稿', exact: true }).click();
  await expect(page).toHaveURL(/stage=generation/);
  await expect(page.getByRole('heading', { name: '编写草稿' })).toBeVisible();
  await expect(page.getByText('Agent 自动生成暂未开放。')).toBeVisible();
  await expect(page.getByRole('button', { name: '启动 Agent 生成' })).toHaveCount(0);

  await page.getByRole('button', { name: '按文档审核', exact: true }).click();
  await expect(page).toHaveURL(/stage=review/);
  await expect(page.getByRole('heading', { name: '按文档审核' })).toBeVisible();
  await expect(page.getByText('审核中', { exact: true }).first()).toBeVisible();
  const reviewLink = page.getByRole('link', { name: '进入审核工作区' });
  await expect(reviewLink).toHaveAttribute('href', new RegExp(`taskId=${task.id}`));

  await reviewLink.click();
  await expect(page).toHaveURL(new RegExp(`/knowledge-center/review\\?taskId=${task.id}`));
  await expect(page.getByRole('link', { name: '返回增量任务' })).toHaveAttribute('href', new RegExp(`taskId=${task.id}.*stage=review`));

  await page.getByRole('link', { name: '返回增量任务' }).click();
  await expect(page).toHaveURL(new RegExp(`/knowledge-center/production\\?taskId=${task.id}.*stage=review`));
  await page.getByRole('button', { name: '整体发布', exact: true }).click();
  await expect(page.getByRole('heading', { name: '整体发布' })).toBeVisible();
  await expect(page.getByText('整体原子发布')).toBeVisible();
  await expect(page.getByRole('button', { name: '确认整体发布' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '体验发布确认' })).toHaveCount(0);
  expect(writes).toEqual([]);
});
