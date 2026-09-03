const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const baseline = require('../../contracts/knowledge-platform-compatibility/v1/baseline.json');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

describe('知识中心通用化兼容基线', () => {
  test('兼容清单覆盖统一入口、两个旧入口和 API 代理', () => {
    const paths = baseline.http.map(item => `${item.method} ${item.path}`);
    expect(paths).toEqual(expect.arrayContaining([
      'GET /knowledge-center/',
      'GET /prompt-generator.html',
      'GET /pingcode-materials/',
      'GET /pingcode-api/api/health'
    ]));
  });

  test('提示词生成器通过前端网关同源访问文档 API', () => {
    const page = read('agent-runner/frontend/prompt-generator.html');
    const gateway = read('agent-runner/frontend-server.js');
    expect(page).toContain('return \'\';');
    expect(page).toContain("window.location.port !== '4100'");
    expect(gateway).toContain('createProxy');
    expect(gateway).toContain('proxyDocumentApi');
    expect(gateway).toContain("pathname.startsWith('/api/')");
  });

  test('知识中心使用语义化源码入口并保留目录与旧显式入口兼容', () => {
    const gateway = read('agent-runner/frontend-server.js');
    const routes = read('agent-runner/routes/knowledge-center.js');
    expect(gateway).toContain("const KNOWLEDGE_CENTER_ENTRY = 'knowledge-center-management.html'");
    expect(routes).toContain("relativePath === 'index.html'");
    expect(fs.existsSync(path.join(root, 'agent-runner/frontend/knowledge-center/knowledge-center-management.html'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'agent-runner/frontend/knowledge-center/index.html'))).toBe(false);
  });

  test('知识中心静态网关使用入口文件承载模块深链', () => {
    const server = read('agent-runner/routes/knowledge-center.js');
    expect(server).toContain("path.join(KNOWLEDGE_CENTER_ROOT, KNOWLEDGE_CENTER_ENTRY)");
    expect(server).toContain("pathname.startsWith(`${KNOWLEDGE_CENTER_PREFIX}/`)");
    expect(read('agent-runner/frontend/knowledge-center/common/state/navigation.js')).toContain("assets: '/knowledge-center/assets'");
  });

  test('Socket.IO 事件和 task_id 房间语义仍存在于服务实现', () => {
    const server = read('agent-runner/server.js');
    const agent = read('agent-runner/routes/agent.js');
    for (const event of baseline.socketIo.clientEvents) expect(server).toContain(`socket.on('${event}'`);
    for (const event of baseline.socketIo.serverEvents) expect(agent).toContain(`.emit('${event}'`);
    expect(server).toContain('task:${data.task_id}');
  });

  test('四条 SSE 路径与响应类型仍存在于 Python 实现', () => {
    const source = read('scripts/pingcode/web/backend/app/main.py');
    for (const stream of baseline.sse) {
      const staticPrefix = stream.path.split('/{')[0];
      expect(source).toContain(staticPrefix);
    }
    expect((source.match(/media_type="text\/event-stream"/g) || [])).toHaveLength(4);
  });

  test('清单明确区分实现契约与真实流验证', () => {
    expect(baseline.socketIo.verification).toBe('real-client-connect-subscribe-unsubscribe');
    expect(baseline.sse.every(item => item.verification === 'implementation-contract-only')).toBe(true);
  });
});
