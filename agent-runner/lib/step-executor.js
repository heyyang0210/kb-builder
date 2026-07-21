const logger = require('./logger');

class StepExecutor {
  constructor(agentManager, toolManager = null) {
    this.agentManager = agentManager;
    this.toolManager = toolManager;
  }

  async executeStep(step, input, onDetail) {
    const agent = this.agentManager.getAgent(step.agent);
    if (!agent) {
      throw new Error(`Agent not found: ${step.agent}`);
    }

    logger.info(`[StepExecutor] Executing step: ${step.name} (agent: ${step.agent})`);

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

  transformInput(step, prevOutput, workflowInput) {
    const input = { ...workflowInput };

    // 根据步骤类型转换输入
    if (step.name === 'planner') {
      input.knowledgePoint = workflowInput.knowledge_point || workflowInput.knowledgePoint;
    } else if (step.name === 'retriever') {
      input.executionPlan = prevOutput;
    } else if (step.name === 'generator') {
      input.executionPlan = workflowInput.steps?.find(s => s.name === 'planner')?.output || prevOutput;
      input.references = prevOutput;
    } else if (step.name === 'validator') {
      input.document = prevOutput?.document || prevOutput;
      input.executionPlan = workflowInput.steps?.find(s => s.name === 'planner')?.output;
    }

    return input;
  }
}

module.exports = StepExecutor;
