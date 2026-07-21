const PlannerAgent = require('./agents/planner-agent');
const RetrieverAgent = require('./agents/retriever-agent');
const GeneratorAgent = require('./agents/generator-agent');
const ValidatorAgent = require('./agents/validator-agent');
const ComparatorAgent = require('./agents/comparator-agent');
const logger = require('./logger');

class AgentManager {
  constructor(config = {}) {
    this.config = config;
    this.agents = new Map();
    this._registerDefaults();
  }

  _registerDefaults() {
    this.registerAgent('planner', new PlannerAgent(this.config));
    this.registerAgent('retriever', new RetrieverAgent(this.config));
    this.registerAgent('generator', new GeneratorAgent(this.config));
    this.registerAgent('validator', new ValidatorAgent(this.config));
    this.registerAgent('comparator', new ComparatorAgent(this.config));
  }

  registerAgent(name, agent) {
    this.agents.set(name, agent);
    logger.debug(`Agent registered: ${name}`);
  }

  getAgent(name) {
    const agent = this.agents.get(name);
    if (!agent) {
      throw new Error(`Agent not found: ${name}. Available: ${this.listAgents().join(', ')}`);
    }
    return agent;
  }

  listAgents() {
    return Array.from(this.agents.keys());
  }

  updateAllConfigs(config) {
    this.config = config;
    for (const agent of this.agents.values()) {
      if (agent.llmClient) {
        agent.llmClient.updateConfig(config);
      }
    }
    logger.info('All agent configs updated');
  }
}

module.exports = AgentManager;
