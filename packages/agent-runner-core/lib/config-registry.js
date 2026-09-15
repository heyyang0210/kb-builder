const path = require('path');
const { REPOSITORY_ROOT, AGENT_RUNNER_CONFIG_ROOT, AGENT_RUNNER_RUNTIME_ROOT } = require('./repo-paths');

// 面向运维场景的三份配置：产品定义、服务运行、内容规则。
const CONFIG_PATHS = Object.freeze({
  product: path.join(AGENT_RUNNER_CONFIG_ROOT, 'product.json'),
  service: path.join(AGENT_RUNNER_CONFIG_ROOT, 'service.json'),
  contentRules: path.join(AGENT_RUNNER_CONFIG_ROOT, 'content-rules.json'),
  knowledgeAssets: path.join(REPOSITORY_ROOT, 'runtime', 'knowledge-center', 'knowledge-assets.json'),
  gitlabConnections: path.join(REPOSITORY_ROOT, 'runtime', 'knowledge-center', 'gitlab-connections.json'),
  migrationRoot: path.join(AGENT_RUNNER_RUNTIME_ROOT, 'repository-migration'),
});

function configPath(name) {
  if (!Object.prototype.hasOwnProperty.call(CONFIG_PATHS, name)) throw new Error(`未知配置项：${name}`);
  return CONFIG_PATHS[name];
}

module.exports = { CONFIG_PATHS, configPath };
