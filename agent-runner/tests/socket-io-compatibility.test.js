const { io: createClient } = require('socket.io-client');
const { spawn } = require('child_process');
const path = require('path');

describe('Socket.IO 兼容契约', () => {
  let serverProcess;
  let client;

  beforeAll(async () => {
    serverProcess = spawn(process.execPath, ['server.js'], {
      cwd: path.resolve(__dirname, '..'),
      env: { ...process.env, PORT: '14120' },
      stdio: 'ignore'
    });
    await waitForHealth('http://127.0.0.1:14120/api/health');
    await new Promise((resolve, reject) => {
      client = createClient('http://127.0.0.1:14120', {
        transports: ['websocket'],
        reconnection: false,
        timeout: 3000
      });
      client.once('connect', resolve);
      client.once('connect_error', reject);
    });
  });

  afterAll(async () => {
    if (client) {
      client.disconnect();
      client.close();
    }
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill('SIGTERM');
      await new Promise(resolve => serverProcess.once('exit', resolve));
    }
  });

  test('客户端可连接并按 task_id 订阅和取消房间', async () => {
    const subscribed = await client.timeout(2000).emitWithAck('subscribe', { task_id: 'kpg-contract-task' });
    expect(subscribed).toEqual({ status: 'subscribed', task_id: 'kpg-contract-task' });
    const unsubscribed = await client.timeout(2000).emitWithAck('unsubscribe', { task_id: 'kpg-contract-task' });
    expect(unsubscribed).toEqual({ status: 'unsubscribed', task_id: 'kpg-contract-task' });
  });
});

async function waitForHealth(url) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('等待 Node 测试服务启动超时');
}
