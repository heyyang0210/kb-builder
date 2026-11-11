const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const model = { protocol: 'responses', base_url: 'https://fixture.invalid', model: 'fixture', api_key: 'test-only' };

describe('Worker terminal IPC ordering', () => {
  let root;
  let worker;
  let runner;
  beforeEach(() => {
    const parent = path.resolve(__dirname, '../../../runtime/test-results/codex-terminal-fixtures');
    fs.mkdirSync(parent, { recursive: true });
    root = fs.mkdtempSync(path.join(parent, 'case-'));
    worker = new EventEmitter();
    worker.connected = true;
    worker.send = jest.fn();
    worker.kill = jest.fn();
    jest.doMock('child_process', () => ({ fork: () => worker }));
    jest.isolateModules(() => {
      const { createCodexRunner } = require('../../../packages/agent-runner-core/lib/agent-runtime/codex-runner');
      runner = createCodexRunner({ runtimeRoot: root, rules: { timeoutMs: 1000, maxEvents: 20 } });
    });
  });
  afterEach(() => {
    jest.dontMock('child_process');
    fs.rmSync(root, { recursive: true, force: true });
  });
  test('error arriving after exit is preserved before close', async () => {
    const result = runner.run([], model);
    const rejected = expect(result).rejects.toThrow('worker-specific failure');
    worker.emit('exit', 0);
    worker.emit('message', { type: 'error', message: 'worker-specific failure' });
    worker.emit('close', 0);
    await rejected;
  });
  test('result arriving after exit wins over generic close interruption', async () => {
    const result = runner.run([], model);
    worker.emit('exit', 0);
    const value = { model: 'fixture', content: JSON.stringify({ markdown: '# generated' }) };
    worker.emit('message', { type: 'result', value });
    worker.emit('close', 0);
    expect(await result).toEqual(value);
    const run = runner.get(fs.readdirSync(root)[0]);
    expect(run).toMatchObject({ status: 'completed', result: { markdown: '# generated' } });
    expect(run.events.filter(e => e.kind === 'completed')).toHaveLength(1);
  });
  test('close without terminal message still rejects and records interruption', async () => {
    const result = runner.run([], model);
    const rejected = expect(result).rejects.toThrow('Codex Worker 中断（2）');
    worker.emit('exit', 2);
    worker.emit('close', 2);
    await rejected;
    expect(runner.get(fs.readdirSync(root)[0]).status).toBe('failed');
  });
});
