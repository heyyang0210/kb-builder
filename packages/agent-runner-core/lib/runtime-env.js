const path = require('path');
const fs = require('fs');
const { REPOSITORY_ROOT } = require('./repo-paths');

const DEFAULT_ENV_PATH = path.join(REPOSITORY_ROOT, 'config', 'knowledge-center', '.env');

/**
 * Load repository runtime configuration without overriding variables supplied
 * by the caller, container, or secret manager.
 */
function loadRuntimeEnv(options = {}) {
  const envPath = path.resolve(options.path || process.env.KNOWLEDGE_CENTER_ENV_FILE || DEFAULT_ENV_PATH);
  let result;
  try {
    // Use dotenv when the host application provides it.
    result = require('dotenv').config({ path: envPath, override: false });
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
      result = { parsed: true };
    } catch (error) {
      result = { error };
    }
  }
  return {
    path: envPath,
    loaded: !result.error,
    error: result.error || null,
  };
}

module.exports = { DEFAULT_ENV_PATH, loadRuntimeEnv };
