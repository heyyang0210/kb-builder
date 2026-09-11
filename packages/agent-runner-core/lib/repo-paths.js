const path = require('path');

// This module lives at packages/agent-runner-core/lib; walk back to the repository root.
const REPOSITORY_ROOT = path.resolve(__dirname, '..', '..', '..');
const AGENT_RUNNER_CODE_ROOT = path.join(REPOSITORY_ROOT, 'packages', 'agent-runner-core');
const AGENT_RUNNER_CONFIG_ROOT = path.join(REPOSITORY_ROOT, 'config', 'knowledge-center');
const AGENT_RUNNER_RUNTIME_ROOT = path.join(REPOSITORY_ROOT, 'runtime', 'agent-runner');

module.exports = {
  REPOSITORY_ROOT,
  AGENT_RUNNER_CODE_ROOT,
  AGENT_RUNNER_CONFIG_ROOT,
  AGENT_RUNNER_RUNTIME_ROOT,
};
