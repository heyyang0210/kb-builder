const path = require('path');
const { AGENT_RUNNER_CONFIG_ROOT, AGENT_RUNNER_RUNTIME_ROOT } = require('./repo-paths');

// 统一配置目录注册表：静态配置、平台能力清单与运行态事实分离。
const CONFIG_PATHS = Object.freeze({
  platform: path.join(AGENT_RUNNER_CONFIG_ROOT, 'platform.json'),
  runtime: path.join(AGENT_RUNNER_CONFIG_ROOT, 'runtime.json'),
  aiServices: path.join(AGENT_RUNNER_CONFIG_ROOT, 'ai-services.json'),
  processing: path.join(AGENT_RUNNER_CONFIG_ROOT, 'processing.json'),
  knowledgeAssets: path.join(AGENT_RUNNER_CONFIG_ROOT, 'state', 'knowledge-assets.json'),
  gitlabConnections: path.join(AGENT_RUNNER_CONFIG_ROOT, 'state', 'gitlab-connections.json'),
  migrationRoot: path.join(AGENT_RUNNER_RUNTIME_ROOT, 'repository-migration'),
});

function configPath(name) {
  if (!Object.prototype.hasOwnProperty.call(CONFIG_PATHS, name)) throw new Error(`未知配置项：${name}`);
  return CONFIG_PATHS[name];
}

module.exports = { CONFIG_PATHS, configPath };
