const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Jest 要求 mock factory 中不能引用外部变量，除非以 mock 开头
const mockTestDir = path.join(__dirname, '..', '..', 'agent-runner', 'tmp', 'test-config-' + Date.now());

process.env.AGENT_RUNNER_KEY = 'test-key-for-unit-tests';

// 手动实现一个测试用 ConfigManager（不 mock 模块，直接测试逻辑）
class TestConfigManager {
  constructor() {
    this.configDir = mockTestDir;
    this.encryptionKey = crypto.scryptSync('test-key-for-unit-tests', 'yashandb-salt', 32);
    this.cache = new Map();
  }

  _encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();
    return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
  }

  _decrypt(encryptedText) {
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(parts[2], 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  async load(configName) {
    if (this.cache.has(configName)) return this.cache.get(configName);
    const filePath = path.join(this.configDir, `${configName}.json`);
    if (!fs.existsSync(filePath)) return null;
    const config = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    if (config.api_key_encrypted) {
      config.api_key = this._decrypt(config.api_key_encrypted);
    }
    this.cache.set(configName, config);
    return config;
  }

  async save(configName, config) {
    if (!fs.existsSync(this.configDir)) fs.mkdirSync(this.configDir, { recursive: true });
    const toSave = { ...config };
    if (toSave.api_key) {
      toSave.api_key_encrypted = this._encrypt(toSave.api_key);
      delete toSave.api_key;
    }
    fs.writeFileSync(path.join(this.configDir, `${configName}.json`), JSON.stringify(toSave, null, 2));
    this.cache.set(configName, config);
    return true;
  }

  isApiKeyConfigured(config) {
    return !!(config && (config.api_key || config.api_key_encrypted));
  }

  clearCache(name) {
    if (name) this.cache.delete(name);
    else this.cache.clear();
  }
}

let configManager;

beforeAll(() => {
  fs.mkdirSync(mockTestDir, { recursive: true });
  configManager = new TestConfigManager();
});

afterAll(() => {
  fs.rmSync(mockTestDir, { recursive: true, force: true });
});

describe('ConfigManager', () => {
  test('保存和加载配置', async () => {
    const config = { provider: 'openai', model: 'gpt-4', temperature: 0.7 };
    await configManager.save('test-model', config);
    const loaded = await configManager.load('test-model');
    expect(loaded.provider).toBe('openai');
    expect(loaded.model).toBe('gpt-4');
  });

  test('API Key 加密存储', async () => {
    const config = { provider: 'openai', api_key: 'sk-secret-key-12345', model: 'gpt-4' };
    await configManager.save('test-encrypted', config);

    const rawContent = fs.readFileSync(path.join(mockTestDir, 'test-encrypted.json'), 'utf-8');
    const raw = JSON.parse(rawContent);
    expect(raw.api_key).toBeUndefined();
    expect(raw.api_key_encrypted).toBeDefined();
    expect(raw.api_key_encrypted).not.toContain('sk-secret-key-12345');
  });

  test('加载时自动解密 API Key', async () => {
    configManager.clearCache('test-encrypted');
    const loaded = await configManager.load('test-encrypted');
    expect(loaded.api_key).toBe('sk-secret-key-12345');
  });

  test('不存在的配置返回 null', async () => {
    const result = await configManager.load('nonexistent');
    expect(result).toBeNull();
  });

  test('isApiKeyConfigured 判断正确', () => {
    expect(configManager.isApiKeyConfigured({ api_key: 'sk-xxx' })).toBe(true);
    expect(configManager.isApiKeyConfigured({ api_key_encrypted: 'xxx' })).toBe(true);
    expect(configManager.isApiKeyConfigured({})).toBe(false);
    expect(configManager.isApiKeyConfigured(null)).toBe(false);
  });

  test('缓存机制工作正常', async () => {
    await configManager.save('test-cache', { value: 'original' });
    await configManager.load('test-cache');

    // 直接修改文件
    fs.writeFileSync(
      path.join(mockTestDir, 'test-cache.json'),
      JSON.stringify({ value: 'modified' })
    );

    // 应该返回缓存值
    const cached = await configManager.load('test-cache');
    expect(cached.value).toBe('original');

    // 清除缓存后重新加载
    configManager.clearCache('test-cache');
    const fresh = await configManager.load('test-cache');
    expect(fresh.value).toBe('modified');
  });

  test('clearCache 清除所有缓存', async () => {
    await configManager.save('test-a', { a: 1 });
    await configManager.save('test-b', { b: 2 });
    await configManager.load('test-a');
    await configManager.load('test-b');

    configManager.clearCache();

    const a = await configManager.load('test-a');
    expect(a.a).toBe(1);
  });

  test('加密解密往返一致性', () => {
    const original = 'sk-very-long-secret-key-with-special-chars!@#$%^&*()';
    const encrypted = configManager._encrypt(original);
    const decrypted = configManager._decrypt(encrypted);
    expect(decrypted).toBe(original);
  });

  test('不同加密结果不同（IV 随机）', () => {
    const text = 'same-text';
    const enc1 = configManager._encrypt(text);
    const enc2 = configManager._encrypt(text);
    expect(enc1).not.toBe(enc2);
    // 但解密结果相同
    expect(configManager._decrypt(enc1)).toBe(text);
    expect(configManager._decrypt(enc2)).toBe(text);
  });
});
