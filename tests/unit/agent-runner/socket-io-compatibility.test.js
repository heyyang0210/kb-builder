const { io: createClient } = require('socket.io-client');
const { spawn } = require('child_process');
const path = require('path');

const API_ROOT = path.resolve(__dirname, '../../../apps/knowledge-center-api');
const API_NODE_MODULES = path.resolve(__dirname, '../../../runtime/agent-runner/node_modules');

describe('Socket.IO 兼容契约', () => {
  let serverProcess;
  let client;

  beforeAll(async () => {
    serverProcess = spawn(process.execPath, ['server.js'], {
      cwd: API_ROOT,
      env: {
        ...process.env,
        PORT: '14120',
        NODE_PATH: [API_NODE_MODULES, process.env.NODE_PATH].filter(Boolean).join(path.delimiter),
      },
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
  }, 15000);

  afterAll(async () => {
    if (client) {
      client.disconnect();
      client.close();
    }
    await stopProcess(serverProcess);
  }, 15000);

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

async function stopProcess(processHandle) {
  if (!processHandle || processHandle.exitCode !== null) return;
  processHandle.kill('SIGTERM');
  await new Promise(resolve => {
    const timeout = setTimeout(() => {
      if (processHandle.exitCode === null) processHandle.kill('SIGKILL');
    }, 5000);
    processHandle.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}
