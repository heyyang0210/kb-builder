// Load shared configuration before deriving encryption keys; runtime data stays in runtime/agent-runner/.
try {
  require('./runtime-env').loadRuntimeEnv();
} catch (e) {}
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('./logger');
const { CONFIG_PATHS } = require('./config-registry');
const { readJson, writeJsonAtomic } = require('./json-config');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

class ConfigManager {
  constructor() {
    this.configDir = path.dirname(CONFIG_PATHS.aiServices);
    this.encryptionKey = this._deriveKey(process.env.AGENT_RUNNER_KEY || 'default-key');
    this.cache = new Map();
    this._watchConfigDir();
  }

  _deriveKey(secret) {
    return crypto.scryptSync(secret, 'yashandb-salt', 32);
  }

  _encrypt(text) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.encryptionKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();
    return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
  }

  _decrypt(encryptedText) {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted format');
    }
    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    const decipher = crypto.createDecipheriv(ALGORITHM, this.encryptionKey, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  _sensitiveFields = ['api_key', 'api_key_encrypted'];

  _encryptSensitiveFields(config) {
    const result = { ...config };
    
    // 加密 api_key
    for (const field of this._sensitiveFields) {
      if (result[field] && field === 'api_key') {
        result.api_key_encrypted = this._encrypt(result[field]);
        delete result.api_key;
      }
    }
    
    // 加密 headers
    if (result.headers && Array.isArray(result.headers)) {
      result.headers = result.headers.map(header => {
        if (header.encrypted && header.value) {
          return {
            ...header,
            value_encrypted: this._encrypt(header.value),
            value: undefined
          };
        }
        return header;
      });
    }
    
    return result;
  }

  _decryptSensitiveFields(config) {
    if (!config) return config;
    const result = { ...config };
    
    // 解密 api_key
    if (result.api_key_encrypted) {
      try {
        result.api_key = this._decrypt(result.api_key_encrypted);
      } catch (err) {
        logger.warn('Failed to decrypt api_key, may need reconfiguration');
      }
    }
    
    // 解密 headers
    if (result.headers && Array.isArray(result.headers)) {
      result.headers = result.headers.map(header => {
        if (header.encrypted && header.value_encrypted) {
          try {
            return {
              ...header,
              value: this._decrypt(header.value_encrypted)
            };
          } catch (err) {
            logger.warn(`Failed to decrypt header: ${header.name}`);
            return header;
          }
        }
        return header;
      });
    }
    
    return result;
  }

  _section(configName) { return { 'model-config': 'model', 'mcp-config': 'mcp', 'agent-presets': 'agentPresets' }[configName] || null; }

  async load(configName) {
    if (this.cache.has(configName)) {
      return this.cache.get(configName);
    }

    const section = this._section(configName);
    const filePath = section ? CONFIG_PATHS.aiServices : path.join(this.configDir, `${configName}.json`);

    if (!fs.existsSync(filePath)) {
      logger.debug(`Config file not found: ${filePath}`);
      return null;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const payload = JSON.parse(content);
      const config = section ? payload[section] : payload;
      if (!config) return null;
      const decrypted = this._decryptSensitiveFields(config);
      Object.assign(config, decrypted);
      this.cache.set(configName, config);
      logger.debug(`Config loaded: ${configName}`);
      return config;
    } catch (err) {
      logger.error(`Failed to load config ${configName}: ${err.message}`);
      throw err;
    }
  }

  async save(configName, config) {
    const section = this._section(configName);
    const filePath = section ? CONFIG_PATHS.aiServices : path.join(this.configDir, `${configName}.json`);

    try {
      const toSave = this._encryptSensitiveFields({ ...config });
      if (section) { const payload = readJson(filePath); payload[section] = toSave; writeJsonAtomic(filePath, payload); }
      else writeJsonAtomic(filePath, toSave);
      this.cache.set(configName, config);
      logger.info(`Config saved: ${configName}`);
      return true;
    } catch (err) {
      logger.error(`Failed to save config ${configName}: ${err.message}`);
      throw err;
    }
  }

  async getModelConfig() {
    return this.load('model-config');
  }

  async getMCPConfig() {
    return this.load('mcp-config');
  }

  async getAgentPresets() {
    return this.load('agent-presets');
  }

  async getAgentPreset(presetId) {
    const presets = await this.getAgentPresets();
    if (!presets || !presets.presets) return null;
    return presets.presets.find(p => p.id === presetId) || null;
  }

  async saveAgentPreset(preset) {
    const presets = await this.getAgentPresets() || { presets: [], default_preset: 'default' };
    const index = presets.presets.findIndex(p => p.id === preset.id);
    if (index >= 0) {
      presets.presets[index] = preset;
    } else {
      presets.presets.push(preset);
    }
    await this.save('agent-presets', presets);
    return true;
  }

  isApiKeyConfigured(config) {
    return !!(config && (config.api_key || config.api_key_encrypted));
  }

  clearCache(configName) {
    if (configName) {
      this.cache.delete(configName);
    } else {
      this.cache.clear();
    }
  }

  _watchConfigDir() {
    if (!fs.existsSync(this.configDir)) return;

    try {
      fs.watch(this.configDir, (eventType, filename) => {
        if (filename && filename.endsWith('.json')) {
          if (filename === path.basename(CONFIG_PATHS.aiServices)) this.cache.clear();
          else this.cache.delete(filename.replace('.json', ''));
          logger.debug(`Config cache cleared for: ${filename}`);
        }
      });
    } catch (err) {
      logger.warn(`Failed to watch config directory: ${err.message}`);
    }
  }
}

module.exports = new ConfigManager();
