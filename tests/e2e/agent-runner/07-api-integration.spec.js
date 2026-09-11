const { test, expect } = require('./helpers');

test.describe('API Integration - 后端API集成', () => {
  test('GET /api/health 返回正确格式', async ({ request }) => {
    const resp = await request.get('http://localhost:4100/api/health');
    const data = await resp.json();
    expect(data).toHaveProperty('status', 'ok');
    expect(data).toHaveProperty('version');
    expect(data).toHaveProperty('uptime');
    expect(data).toHaveProperty('timestamp');
  });

  test('GET /api/document/list 返回文档列表', async ({ request }) => {
    const resp = await request.get('http://localhost:4100/api/document/list');
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(data).toHaveProperty('success');
  });

  test('GET /api/document/tree 返回文档树结构', async ({ request }) => {
    const resp = await request.get('http://localhost:4100/api/document/tree');
    expect(resp.ok()).toBeTruthy();
  });

  test('POST /api/document/search 支持搜索', async ({ request }) => {
    const resp = await request.post('http://localhost:4100/api/document/search', {
      data: { query: '兼容性', limit: 10 }
    });
    expect(resp.ok()).toBeTruthy();
  });

  test('POST /api/document/save 保存文档', async ({ request }) => {
    const resp = await request.post('http://localhost:4100/api/document/save', {
      data: {
        id: 'e2e-test-' + Date.now(),
        title: 'E2E测试文档',
        content: '# E2E测试\n\n自动化测试生成',
        metadata: { author: 'e2e', tags: ['test'] }
      }
    });
    expect(resp.ok()).toBeTruthy();
  });

  test('Socket.IO端点可访问', async ({ request }) => {
    const resp = await request.get('http://localhost:4100/socket.io/?EIO=4&transport=polling');
    expect([200, 400]).toContain(resp.status());
  });
});
