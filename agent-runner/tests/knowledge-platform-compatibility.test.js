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
