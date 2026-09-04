const logger = require('./logger');

class StepExecutor {
  constructor(agentManager, toolManager = null) {
    this.agentManager = agentManager;
    this.toolManager = toolManager;
  }

  async execute(step, input, onDetail) {
    const agentId = step.agent || step.name;
    const agent = this.agentManager.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    logger.info(`[StepExecutor] Executing step: ${step.name} (agent: ${agentId})`);

    // 如果 agent 支持 toolManager，设置它
    if (agent.setToolManager && this.toolManager) {
      agent.setToolManager(this.toolManager);
    }

    // 如果 agent 支持 onDetail 回调，传递它
    if (agent.setOnDetail) {
      agent.setOnDetail(onDetail);
    }

    // 执行 agent
    const output = await agent.execute(input, step.config || {});

    logger.info(`[StepExecutor] Step completed: ${step.name}`);
    return output;
  }

  // 保留旧方法名作为别名
  async executeStep(step, input, onDetail) {
    return this.execute(step, input, onDetail);
  }

  transformInput(step, prevOutput, workflowInput) {
    const agent = step.agent || step.name;
    if (!agent) {
      return prevOutput;
    }

    const input = { ...workflowInput };
    const findStep = name => workflowInput.steps?.find(s => (s.agent || s.name) === name);

    if (agent === 'planner') {
      input.knowledgePoint = workflowInput.knowledge_point || workflowInput.knowledgePoint;
    } else if (agent === 'retriever') {
      input.executionPlan = prevOutput;
    } else if (agent === 'generator') {
      input.executionPlan = findStep('planner')?.output || prevOutput;
      input.references = prevOutput.references || prevOutput;
    } else if (agent === 'validator') {
      input.document = prevOutput?.document || prevOutput;
      input.executionPlan = findStep('planner')?.output;
    } else {
      return prevOutput;
    }

    return input;
  }
}

module.exports = StepExecutor;
