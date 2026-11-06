const fs = require('fs');
const os = require('os');
const path = require('path');

// 让测试进入内置解析器，覆盖没有 dotenv 依赖时的运行时兼容路径。
jest.mock('dotenv', () => ({ config: () => { throw new Error('dotenv unavailable'); } }));

const { loadRuntimeEnv } = require('../../../packages/agent-runner-core/lib/runtime-env');

describe('knowledge center runtime environment', () => {
  const original = {};
  const touchedKeys = [
    'RUNTIME_ENV_TEST_FROM_FILE', 'RUNTIME_ENV_TEST_PRECEDENCE',
    'RUNTIME_ENV_TEST_PRIMARY', 'RUNTIME_ENV_TEST_SECRET',
    'RUNTIME_ENV_TEST_SECOND', 'RUNTIME_ENV_TEST_UNMATCHED_START',
    'RUNTIME_ENV_TEST_UNMATCHED_END', 'KNOWLEDGE_CENTER_ENV_FILE',
    'KNOWLEDGE_CENTER_RUNTIME_ENV_FILE',
  ];

  beforeEach(() => {
    for (const key of touchedKeys) {
      original[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of touchedKeys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });

  test('loads an explicit config path without overriding caller environment', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-center-env-'));
    const file = path.join(directory, '.env');
    fs.writeFileSync(file, 'RUNTIME_ENV_TEST_FROM_FILE=loaded\nRUNTIME_ENV_TEST_PRECEDENCE=from-file\n');

    process.env.RUNTIME_ENV_TEST_PRECEDENCE = 'from-caller';
    const result = loadRuntimeEnv({ path: file });

    expect(result.loaded).toBe(true);
    expect(process.env.RUNTIME_ENV_TEST_FROM_FILE).toBe('loaded');
    expect(process.env.RUNTIME_ENV_TEST_PRECEDENCE).toBe('from-caller');
    fs.rmSync(directory, { recursive: true, force: true });
  });

  test('fills missing runtime secrets from the agent-runner env file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-env-secret-'));
    const config = path.join(dir, 'config.env');
    const runtime = path.join(dir, 'runtime.env');
    fs.writeFileSync(config, 'RUNTIME_ENV_TEST_PRIMARY=primary\n');
    fs.writeFileSync(runtime, 'RUNTIME_ENV_TEST_PRIMARY=should-not-override\nRUNTIME_ENV_TEST_SECRET=runtime-secret\n');
    delete process.env.RUNTIME_ENV_TEST_SECRET;
    const result = loadRuntimeEnv({ path: config, runtimePath: runtime });
    expect(result.loaded).toBe(true);
    expect(result.runtimeLoaded).toBe(true);
    expect(process.env.RUNTIME_ENV_TEST_PRIMARY).toBe('primary');
    expect(process.env.RUNTIME_ENV_TEST_SECRET).toBe('runtime-secret');
    delete process.env.RUNTIME_ENV_TEST_PRIMARY;
    delete process.env.RUNTIME_ENV_TEST_SECRET;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('fallback parser handles quotes, malformed lines and missing files', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-center-env-fallback-'));
    const file = path.join(dir, 'config.env');
    fs.writeFileSync(file, 'RUNTIME_ENV_TEST_FROM_FILE="quoted value"\nRUNTIME_ENV_TEST_UNMATCHED_START="start\nRUNTIME_ENV_TEST_UNMATCHED_END=end"\nmalformed\nRUNTIME_ENV_TEST_SECOND=second\n');
    const result = loadRuntimeEnv({ path: file, runtimePath: file });
    expect(result).toMatchObject({ loaded: true, runtimeLoaded: true, runtimeError: null });
    expect(process.env.RUNTIME_ENV_TEST_FROM_FILE).toBe('quoted value');
    expect(process.env.RUNTIME_ENV_TEST_SECOND).toBe('second');
    const missing = loadRuntimeEnv({ path: path.join(dir, 'missing.env'), runtimePath: path.join(dir, 'missing-runtime.env') });
    expect(missing.loaded).toBe(false);
    expect(missing.runtimeLoaded).toBe(false);
    fs.rmSync(dir, { recursive: true, force: true });
    delete process.env.RUNTIME_ENV_TEST_FROM_FILE;
    delete process.env.RUNTIME_ENV_TEST_SECOND;
  });

  test('uses configured environment paths and default options', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-center-env-options-'));
    const config = path.join(dir, 'config.env');
    const runtime = path.join(dir, 'runtime.env');
    fs.writeFileSync(config, 'RUNTIME_ENV_TEST_FROM_FILE=from-env-path\n');
    fs.writeFileSync(runtime, 'RUNTIME_ENV_TEST_SECRET=from-runtime-env-path\n');
    process.env.KNOWLEDGE_CENTER_ENV_FILE = config;
    process.env.KNOWLEDGE_CENTER_RUNTIME_ENV_FILE = runtime;
    const result = loadRuntimeEnv();
    expect(result.loaded).toBe(true);
    expect(result.runtimeLoaded).toBe(true);
    expect(process.env.RUNTIME_ENV_TEST_FROM_FILE).toBe('from-env-path');
    expect(process.env.RUNTIME_ENV_TEST_SECRET).toBe('from-runtime-env-path');
    delete process.env.KNOWLEDGE_CENTER_ENV_FILE;
    delete process.env.KNOWLEDGE_CENTER_RUNTIME_ENV_FILE;
    const defaults = loadRuntimeEnv({ path: undefined, runtimePath: undefined });
    expect(defaults.path).toContain('config/knowledge-center/.env');
    expect(defaults.runtimePath).toContain('runtime/agent-runner/.env');
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
