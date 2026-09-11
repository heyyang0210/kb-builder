const { test, expect } = require('@playwright/test');

const baseUrl = process.env.KPG_BASE_URL || 'http://127.0.0.1:13510';

test('统一入口可通过真实后端完成资料上传并创建批次', async ({ page }) => {
  await page.goto(`${baseUrl}/knowledge-center/`);
  await page.getByText('平台管理登录').click();
  await page.getByLabel('管理员账号').fill('admin');
  await page.getByLabel('管理员密码').fill('admin');
  await page.getByRole('button', { name: '登录平台管理' }).click();
  await expect(page).toHaveURL(`${baseUrl}/knowledge-center/platform`);

  await page.goto(`${baseUrl}/knowledge-center/cleaning`);
  await expect(page.getByRole('heading', { name: '索引与图谱' })).toBeVisible();
  const uploadButton = page.getByRole('button', { name: '上传资料', exact: true });
  await expect(uploadButton).toBeVisible();
  await uploadButton.click();

  const form = page.locator('[data-cleaning-upload-form]');
  const batchName = `浏览器真实上传 ${Date.now()}`;
  await form.locator('input[name="name"]').fill(batchName);
  await form.locator('input[type="file"]').setInputFiles({
    name: 'e2e-real-upload.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('knowledge-center real browser upload\n', 'utf8'),
  });
  await form.getByRole('button', { name: '开始上传' }).click();
  // 上传成功后工作区会重新读取真实投影并重绘对话框，因此以批次列表作为最终断言。
  await expect(page.locator('.cleaning-workspace')).toContainText(batchName, { timeout: 30000 });
  await expect(page.locator('[data-cleaning-upload-dialog]')).not.toHaveAttribute('open');
});

test('匿名用户不能读取或写入资料清洗', async ({ page }) => {
  await page.goto(`${baseUrl}/knowledge-center/`);
  const result = await page.evaluate(async url => {
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'unauthorized-e2e', operatorLabel: 'test', totalFiles: 1, totalBytes: 1 }),
    });
    return { status: response.status, body: await response.json() };
  }, `${baseUrl}/knowledge-center/api/cleaning/upload-sessions`);
  expect(result.status).toBe(401);
  const body = result.body;
  expect(body.success).toBe(false);
  expect(body.error.code).toBe('AUTH_REQUIRED');
});

test('已认证但无写权限角色不能创建上传会话', async ({ page }) => {
  const api = page.context().request;
  const adminLogin = await api.post(`${baseUrl}/knowledge-center/api/auth/admin/login`, { data: { username: 'admin', password: 'admin' } });
  expect(adminLogin.ok()).toBeTruthy();
  const usersResponse = await api.get(`${baseUrl}/knowledge-center/api/platform/permissions`);
  expect(usersResponse.ok()).toBeTruthy();
  const usersBody = await usersResponse.json();
  const users = usersBody.data?.users || usersBody.content?.users || usersBody.users || [];
  const editor = users.find(user => user.loginName === 'test');
  expect(editor?.id).toBeTruthy();
  const roleResponse = await api.patch(`${baseUrl}/knowledge-center/api/platform/permissions/${encodeURIComponent(editor.id)}/roles`, {
    data: { roles: ['REVIEWER'] },
  });
  expect(roleResponse.ok()).toBeTruthy();
  await api.post(`${baseUrl}/knowledge-center/api/auth/logout`);

  const testLogin = await api.post(`${baseUrl}/knowledge-center/api/auth/admin/login`, { data: { username: 'test', password: 'test' } });
  expect(testLogin.ok()).toBeTruthy();
  const response = await api.post(`${baseUrl}/knowledge-center/api/cleaning/upload-sessions`, {
    data: { name: 'reviewer-e2e', operatorLabel: 'test', totalFiles: 1, totalBytes: 1 },
  });
  expect(response.status()).toBe(403);
  const body = await response.json();
  expect(body.success).toBe(false);
  expect(body.error.code).toBe('CLEANING_PERMISSION_DENIED');
});

test('不存在的数据集图谱查询返回明确资源错误而非空假数据', async ({ page }) => {
  const api = page.context().request;
  const login = await api.post(`${baseUrl}/knowledge-center/api/auth/admin/login`, { data: { username: 'admin', password: 'admin' } });
  expect(login.ok()).toBeTruthy();
  const response = await api.get(`${baseUrl}/knowledge-center/api/cleaning/datasets/not-a-real-dataset/graph/summary`);
  expect(response.status()).toBe(404);
  const body = await response.json();
  expect(body.success).toBe(false);
  expect(body.error.code).toMatch(/NOT_FOUND|DATASET/);
});

test('不支持预览的文件返回明确的预览错误', async ({ page }) => {
  const api = page.context().request;
  const login = await api.post(`${baseUrl}/knowledge-center/api/auth/admin/login`, { data: { username: 'admin', password: 'admin' } });
  expect(login.ok()).toBeTruthy();
  const sessionResponse = await api.post(`${baseUrl}/knowledge-center/api/cleaning/upload-sessions`, {
    data: { name: `预览异常 ${Date.now()}`, operatorLabel: 'admin', totalFiles: 1, totalBytes: 11 },
    headers: { 'Idempotency-Key': `preview-${Date.now()}` },
  });
  expect(sessionResponse.status()).toBe(201);
  const session = (await sessionResponse.json()).data;
  const fileResponse = await api.post(`${baseUrl}/knowledge-center/api/cleaning/upload-sessions/${session.id}/files`, {
    data: { relativePath: 'unsupported.bin', size: 11, mediaType: 'application/octet-stream' },
  });
  expect(fileResponse.status()).toBe(201);
  const file = (await fileResponse.json()).data;
  const bytes = Buffer.from('plain text!');
  const chunkSize = Number(session.chunkSize || bytes.length);
  for (let offset = 0, index = 0; offset < bytes.length; offset += chunkSize, index += 1) {
    const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length));
    const chunkResponse = await api.put(`${baseUrl}/knowledge-center/api/cleaning/upload-sessions/${session.id}/files/${file.id}/chunks/${index}`, {
      data: chunk,
      headers: { 'Content-Type': 'application/octet-stream', 'Content-Range': `bytes ${offset}-${offset + chunk.length - 1}/${bytes.length}` },
    });
    expect(chunkResponse.ok(), await chunkResponse.text()).toBeTruthy();
  }
  await api.post(`${baseUrl}/knowledge-center/api/cleaning/upload-sessions/${session.id}/files/${file.id}/complete`);
  await api.post(`${baseUrl}/knowledge-center/api/cleaning/upload-sessions/${session.id}/complete`);
  const batchResponse = await api.post(`${baseUrl}/knowledge-center/api/cleaning/upload-sessions/${session.id}/create-batch`, {
    data: { name: `预览异常 ${Date.now()}` },
    headers: { 'Idempotency-Key': `preview-batch-${Date.now()}` },
  });
  expect(batchResponse.status()).toBe(201);
  const preview = await api.get(`${baseUrl}/knowledge-center/api/cleaning/files/${file.id}/preview`);
  expect(preview.status()).toBe(415);
  const body = await preview.json();
  expect(body.success).toBe(false);
  expect(body.error.code).toBe('FILE_PREVIEW_UNSUPPORTED');
});

test('取消上传会话后继续写入会被拒绝并返回可恢复错误', async ({ page }) => {
  const api = page.context().request;
  const login = await api.post(`${baseUrl}/knowledge-center/api/auth/admin/login`, { data: { username: 'admin', password: 'admin' } });
  expect(login.ok()).toBeTruthy();
  const sessionResponse = await api.post(`${baseUrl}/knowledge-center/api/cleaning/upload-sessions`, {
    data: { name: `取消上传 ${Date.now()}`, operatorLabel: 'admin', totalFiles: 1, totalBytes: 1 },
    headers: { 'Idempotency-Key': `cancel-${Date.now()}` },
  });
  expect(sessionResponse.status()).toBe(201);
  const session = (await sessionResponse.json()).data;
  const cancelResponse = await api.post(`${baseUrl}/knowledge-center/api/cleaning/upload-sessions/${session.id}/cancel`);
  expect(cancelResponse.ok()).toBeTruthy();
  const addResponse = await api.post(`${baseUrl}/knowledge-center/api/cleaning/upload-sessions/${session.id}/files`, {
    data: { relativePath: 'after-cancel.txt', size: 1, mediaType: 'text/plain' },
  });
  expect(addResponse.status()).toBe(400);
  const body = await addResponse.json();
  expect(body.success).toBe(false);
  expect(body.error.code).toBe('UPLOAD_FILE_INVALID');
});
