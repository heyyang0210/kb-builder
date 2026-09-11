const http = require('http');

let server;
let serverProcess;
const BASE_URL = 'http://localhost:4101';

// 使用 supertest 风格但直接用 http
function request(method, urlPath, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// 在测试前启动服务
beforeAll((done) => {
  process.env.PORT = '4101';
  process.env.NODE_ENV = 'test';

  // 直接 require app 并启动
  const { app, httpServer } = require('../../../apps/knowledge-center-api/server');
  server = httpServer;

  // 等待服务启动
  setTimeout(done, 1000);
}, 10000);

afterAll((done) => {
  if (server) {
    server.close(done);
  } else {
    done();
  }
});

describe('API Integration', () => {
  test('GET /api/health 返回健康状态', async () => {
    const res = await request('GET', '/api/health');
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('ok');
    expect(res.data.version).toBe('1.0.0');
  });

  test('GET /api/config/model 返回模型配置', async () => {
    const res = await request('GET', '/api/config/model');
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('provider');
    expect(res.data).toHaveProperty('model');
    expect(res.data).toHaveProperty('api_key_configured');
  });

  test('POST /api/config/model 保存模型配置', async () => {
    const res = await request('POST', '/api/config/model', {
      provider: 'openai',
      model: 'gpt-4',
      base_url: 'https://api.openai.com/v1',
      temperature: 0.7
    });
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
  });

  test('POST /api/config/model 无效配置返回 400', async () => {
    const res = await request('POST', '/api/config/model', {
      provider: 'invalid_provider'
    });
    expect(res.status).toBe(400);
    expect(res.data.success).toBe(false);
  });

  test('GET /api/config/mcp 返回 MCP 配置', async () => {
    const res = await request('GET', '/api/config/mcp');
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('server_url');
  });

  test('POST /api/config/mcp 保存 MCP 配置', async () => {
    const res = await request('POST', '/api/config/mcp', {
      server_url: 'http://localhost:8080',
      timeout: 30000
    });
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
  });

  test('GET /api/config/agents 返回 Agent 预设', async () => {
    const res = await request('GET', '/api/config/agents');
    expect(res.status).toBe(200);
    expect(res.data.presets).toBeDefined();
    expect(Array.isArray(res.data.presets)).toBe(true);
  });

  test('POST /api/agent/execute 创建任务', async () => {
    const res = await request('POST', '/api/agent/execute', {
      knowledge_point: { name: 'API测试知识点', type: '通用基础' }
    });
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(res.data.task_id).toBeDefined();
  });

  test('POST /api/agent/execute 缺少 knowledge_point 返回 400', async () => {
    const res = await request('POST', '/api/agent/execute', {});
    expect(res.status).toBe(400);
    expect(res.data.success).toBe(false);
  });

  test('GET /api/agent/status/:taskId 查询任务状态', async () => {
    const createRes = await request('POST', '/api/agent/execute', {
      knowledge_point: { name: '状态测试', type: '通用基础' }
    });
    const taskId = createRes.data.task_id;

    await new Promise(r => setTimeout(r, 500));

    const res = await request('GET', `/api/agent/status/${taskId}`);
    expect(res.status).toBe(200);
    expect(res.data.task_id).toBe(taskId);
    expect(res.data.steps).toBeDefined();
    expect(res.data.progress).toBeDefined();
  });

  test('GET /api/agent/status/:taskId 不存在的任务返回 404', async () => {
    const res = await request('GET', '/api/agent/status/nonexistent');
    expect(res.status).toBe(404);
  });

  test('POST /api/agent/cancel/:taskId 取消任务', async () => {
    const createRes = await request('POST', '/api/agent/execute', {
      knowledge_point: { name: '取消测试', type: '通用基础' }
    });
    const taskId = createRes.data.task_id;

    const res = await request('POST', `/api/agent/cancel/${taskId}`);
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
  });

  test('GET /api/nonexistent 返回 404', async () => {
    const res = await request('GET', '/api/nonexistent');
    expect(res.status).toBe(404);
    expect(res.data.success).toBe(false);
  });

  test('GET /api/agent/health 返回 Agent 健康状态', async () => {
    const res = await request('GET', '/api/agent/health');
    expect(res.status).toBe(200);
    expect(res.data.agents).toContain('planner');
    expect(res.data.agents).toContain('validator');
  });
});
