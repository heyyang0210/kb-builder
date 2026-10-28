const path = require('path');
const fs = require('fs');
const { REPOSITORY_ROOT } = require('./repo-paths');

const DEFAULT_ENV_PATH = path.join(REPOSITORY_ROOT, 'config', 'knowledge-center', '.env');
const DEFAULT_RUNTIME_ENV_PATH = path.join(REPOSITORY_ROOT, 'runtime', 'agent-runner', '.env');

function loadEnvFile(envPath) {
  try {
    return require('dotenv').config({ path: envPath, override: false });
  } catch (_error) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (!match || Object.prototype.hasOwnProperty.call(process.env, match[1])) continue;
        let value = match[2].trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        process.env[match[1]] = value;
      }
      return { parsed: true };
    } catch (error) {
      return { error };
    }
  }
}

/**
 * Load repository runtime configuration without overriding variables supplied
 * by the caller, container, or secret manager.
 */
function loadRuntimeEnv(options = {}) {
  const envPath = path.resolve(options.path || process.env.KNOWLEDGE_CENTER_ENV_FILE || DEFAULT_ENV_PATH);
  const result = loadEnvFile(envPath);
  // The runtime file is the repository's local secret store. It fills only
  // values absent from the business environment file or the caller's env.
  const runtimeEnvPath = path.resolve(options.runtimePath || process.env.KNOWLEDGE_CENTER_RUNTIME_ENV_FILE || DEFAULT_RUNTIME_ENV_PATH);
  const runtimeResult = runtimeEnvPath === envPath ? { parsed: true } : loadEnvFile(runtimeEnvPath);
  return {
    path: envPath,
    loaded: !result.error,
    error: result.error || null,
    runtimePath: runtimeEnvPath,
    runtimeLoaded: !runtimeResult.error,
    runtimeError: runtimeResult.error || null,
  };
}

module.exports = { DEFAULT_ENV_PATH, DEFAULT_RUNTIME_ENV_PATH, loadRuntimeEnv };
