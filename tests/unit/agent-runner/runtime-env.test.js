const fs = require('fs');
const os = require('os');
const path = require('path');

const { loadRuntimeEnv } = require('../../../packages/agent-runner-core/lib/runtime-env');

describe('knowledge center runtime environment', () => {
  const original = {};

  beforeEach(() => {
    for (const key of ['RUNTIME_ENV_TEST_FROM_FILE', 'RUNTIME_ENV_TEST_PRECEDENCE']) {
      original[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ['RUNTIME_ENV_TEST_FROM_FILE', 'RUNTIME_ENV_TEST_PRECEDENCE']) {
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
});
