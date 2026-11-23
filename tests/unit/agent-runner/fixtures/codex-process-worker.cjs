const { spawn } = require('node:child_process');
process.on('message', message => {
  if (message.type === 'cancel') {
    if (globalThis.mode !== 'stubborn') {
      process.send({ type: 'error', message: 'isolated cancellation acknowledged' }, () => process.exit(0));
    }
    return;
  }
  if (message.type !== 'run') return;
  const task = message.task;
  globalThis.mode = task.config.model;
  if (task.config.model === 'complete') {
    for (let i = 0; i < 5; i++) process.send({ type: 'event', event: { kind: 'progress', message: `step-${i} ${task.config.api_key}` } });
    process.send({ type: 'result', value: { model: 'complete', content: JSON.stringify({ markdown: '# 隔离进程完成' }) } }, () => process.exit(0));
  } else if (task.config.model === 'timeout') {
    process.send({ type: 'error', code: 'AGENT_RUN_TIMEOUT', message: 'Codex 运行超时' }, () => process.exit(0));
  } else if (task.config.model === 'stubborn') {
    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { detached: true, stdio: 'ignore' });
    process.send({ type: 'child', pid: child.pid });
    process.send({ type: 'event', event: { kind: 'ready', childPid: child.pid } });
  } else process.send({ type: 'event', event: { kind: 'ready' } });
});
