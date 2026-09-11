const { Annotation, StateGraph, END, START } = require('@langchain/langgraph');
const logger = require('./logger');

// ─── State Definition ───────────────────────────────────────────────
const WorkflowState = Annotation.Root({
  // Input
  knowledgePoint: Annotation,
  template: Annotation,
  prompt: Annotation,
  inputData: Annotation,

  // Pipeline data
  executionPlan: Annotation,
  references: Annotation,
  comparison: Annotation,
  document: Annotation,
  validationReport: Annotation,

  // Retry mechanism
  feedback: Annotation,
  retryCount: Annotation({
    reducer: (prev, update) => update,
    default: () => 0,
  }),
  maxRetries: Annotation,

  // Config
  skipValidation: Annotation,
  strictMode: Annotation,

  // Progress tracking
  currentStep: Annotation,
  completedSteps: Annotation,
  stepDetails: Annotation,
});

// ─── Node Functions ─────────────────────────────────────────────────

function createPlannerNode(agentManager, options = {}) {
  return async (state) => {
    options.onStepStart?.('planner', { message: '正在规划文档结构和检索策略' });
    const capturedDetails = [];
    const agent = agentManager.getAgent('planner');
    const input = {
      knowledgePoint: state.knowledgePoint,
      template: state.template,
      prompt: state.prompt,
    };

    if (agent.setOnDetail) {
      agent.setOnDetail((detail) => {
        capturedDetails.push(detail);
        options.onStepDetail?.('planner', detail);
        logger.debug('[planner] detail:', detail.name);
      });
    }

    const output = await agent.execute(input, {});
    logger.info(`[graph] planner completed, ${output.document_structure?.sections?.length || 0} sections`);
    options.onStepEnd?.('planner', {
      message: `规划完成，章节 ${output.document_structure?.sections?.length || 0} 个`,
      tokens: output._meta?.tokens?.total_tokens || 0,
      duration: output._meta?.duration || 0
    });

    return {
      executionPlan: output,
      currentStep: 'planner',
      completedSteps: [...(state.completedSteps || []), 'planner'],
      stepDetails: [...(state.stepDetails || []), ...capturedDetails.map(detail => ({ ...detail, step: 'planner' })), {
        step: 'planner',
        status: 'completed',
        type: 'stage',
        name: 'planner 完成',
        message: `规划完成，章节 ${output.document_structure?.sections?.length || 0} 个`,
        duration: output._meta?.duration || 0,
        tokens: output._meta?.tokens?.total_tokens || 0,
      }],
    };
  };
}

function createPlannerRetrieverNode(agentManager, toolManager, options = {}) {
  return async (state) => {
    options.onStepStart?.('planner_retriever', { message: '正在合并规划和检索策略' });
    const capturedDetails = [];
    const agent = agentManager.getAgent('planner');
    const input = {
      knowledgePoint: state.knowledgePoint,
      template: state.template,
      prompt: state.prompt,
    };

    if (agent.setOnDetail) {
      agent.setOnDetail((detail) => {
        capturedDetails.push(detail);
        options.onStepDetail?.('planner_retriever', detail);
        logger.debug('[planner_retriever] detail:', detail.name);
      });
    }

    // 执行合并模式的 planner
    const output = await agent.execute(input, { mode: 'merged' });
    
    // 从合并输出中提取 references
    const references = output.retrieval_plan?.mcp_queries || [];
    
    logger.info(`[graph] planner_retriever completed, ${output.document_structure?.sections?.length || 0} sections, ${references.length} queries`);
    options.onStepEnd?.('planner_retriever', {
      message: `规划完成，MCP 查询 ${references.length} 条`,
      tokens: output._meta?.tokens?.total_tokens || 0,
      duration: output._meta?.duration || 0
    });

    return {
      executionPlan: output,
      references: references,
      currentStep: 'planner_retriever',
      completedSteps: [...(state.completedSteps || []), 'planner_retriever'],
      stepDetails: [...(state.stepDetails || []), ...capturedDetails.map(detail => ({ ...detail, step: 'planner_retriever' })), {
        step: 'planner_retriever',
        status: 'completed',
        type: 'stage',
        name: 'planner_retriever 完成',
        message: `规划完成，MCP 查询 ${references.length} 条`,
        duration: output._meta?.duration || 0,
        tokens: output._meta?.tokens?.total_tokens || 0,
      }],
    };
  };
}

function createRetrieverNode(agentManager, toolManager, options = {}) {
  return async (state) => {
    options.onStepStart?.('retriever', { message: '正在检索 MCP 和本地参考文件' });
    const capturedDetails = [];
    const agent = agentManager.getAgent('retriever');
    if (toolManager) agent.setToolManager(toolManager);

    const input = {
      executionPlan: state.executionPlan,
    };

    if (agent.setOnDetail) {
      agent.setOnDetail((detail) => {
        capturedDetails.push(detail);
        options.onStepDetail?.('retriever', detail);
        logger.debug('[retriever] detail:', detail.name);
      });
    }

    const output = await agent.execute(input, {});
    logger.info(`[graph] retriever completed, refs length: ${output.references?.length || 0}`);
    options.onStepEnd?.('retriever', {
      message: `参考资料整理完成，长度 ${output.references?.length || 0} 字符`,
      tokens: output._meta?.tokens?.total_tokens || 0,
      duration: output._meta?.duration || 0
    });

    return {
      references: output.references,
      currentStep: 'retriever',
      completedSteps: [...(state.completedSteps || []), 'retriever'],
      stepDetails: [...(state.stepDetails || []), ...capturedDetails.map(detail => ({ ...detail, step: 'retriever' })), {
        step: 'retriever',
        status: 'completed',
        type: 'stage',
        name: 'retriever 完成',
        message: `参考资料整理完成，长度 ${output.references?.length || 0} 字符`,
        duration: output._meta?.duration || 0,
        tokens: output._meta?.tokens?.total_tokens || 0,
        toolCalls: (output._meta?.tool_calls || []),
      }],
    };
  };
}

function createComparatorNode(agentManager, options = {}) {
  return async (state) => {
    options.onStepStart?.('comparator', { message: '正在生成兼容性对比分析' });
    const capturedDetails = [];
    const agent = agentManager.getAgent('comparator');
    const input = {
      executionPlan: state.executionPlan,
      references: state.references,
    };

    if (agent.setOnDetail) {
      agent.setOnDetail((detail) => {
        capturedDetails.push(detail);
        options.onStepDetail?.('comparator', detail);
        logger.debug('[comparator] detail:', detail.name);
      });
    }

    const output = await agent.execute(input, {});
    logger.info(`[graph] comparator completed, comparison length: ${output.comparison?.length || 0}`);
    options.onStepEnd?.('comparator', {
      message: `兼容性对比完成，长度 ${output.comparison?.length || 0} 字符`,
      tokens: output._meta?.tokens?.total_tokens || 0,
      duration: output._meta?.duration || 0
    });

    return {
      comparison: output.comparison,
      currentStep: 'comparator',
      completedSteps: [...(state.completedSteps || []), 'comparator'],
      stepDetails: [...(state.stepDetails || []), ...capturedDetails.map(detail => ({ ...detail, step: 'comparator' })), {
        step: 'comparator',
        status: 'completed',
        type: 'stage',
        name: 'comparator 完成',
        message: `兼容性对比完成，长度 ${output.comparison?.length || 0} 字符`,
        duration: output._meta?.duration || 0,
        tokens: output._meta?.tokens?.total_tokens || 0,
      }],
    };
  };
}

function createGeneratorNode(agentManager, options = {}) {
  return async (state) => {
    options.onStepStart?.('generator', { message: '正在生成最终文档' });
    const capturedDetails = [];
    const agent = agentManager.getAgent('generator');
    const input = {
      executionPlan: state.executionPlan,
      references: state.references,
      feedback: state.feedback,
      comparison: state.comparison,
    };

    if (agent.setOnDetail) {
      agent.setOnDetail((detail) => {
        capturedDetails.push(detail);
        options.onStepDetail?.('generator', detail);
        logger.debug('[generator] detail:', detail.name);
      });
    }

    const output = await agent.execute(input, {});
    const isRetry = state.retryCount > 0;
    logger.info(`[graph] generator completed${isRetry ? ` (retry ${state.retryCount})` : ''}, doc length: ${output.document?.length || 0}`);
    options.onStepEnd?.('generator', {
      message: `文档生成完成，长度 ${output.document?.length || 0} 字符`,
      tokens: output._meta?.tokens?.total_tokens || 0,
      duration: output._meta?.duration || 0
    });

    return {
      document: output.document,
      feedback: null,
      currentStep: 'generator',
      completedSteps: [...(state.completedSteps || []), 'generator'],
      stepDetails: [...(state.stepDetails || []), ...capturedDetails.map(detail => ({ ...detail, step: 'generator' })), {
        step: 'generator',
        status: 'completed',
        type: 'stage',
        name: 'generator 完成',
        message: `文档生成完成，长度 ${output.document?.length || 0} 字符`,
        isRetry,
        retryCount: state.retryCount,
        duration: output._meta?.duration || 0,
        tokens: output._meta?.tokens?.total_tokens || 0,
      }],
    };
  };
}

function createValidatorNode(agentManager, options = {}) {
  return async (state) => {
    options.onStepStart?.('validator', { message: '正在校验文档质量' });
    const capturedDetails = [];
    const agent = agentManager.getAgent('validator');
    const plan = state.executionPlan || {};

    const input = {
      document: state.document,
      validationCriteria: plan.validation_criteria || {},
    };

    if (agent.setOnDetail) {
      agent.setOnDetail((detail) => {
        capturedDetails.push(detail);
        options.onStepDetail?.('validator', detail);
        logger.debug('[validator] detail:', detail.name);
      });
    }

    const output = await agent.execute(input, {});
    logger.info(`[graph] validator completed, score: ${output.score}, passed: ${output.passed}`);
    options.onStepEnd?.('validator', {
      message: `校验完成，评分 ${output.score || 'N/A'}，结果 ${output.passed ? '通过' : '未通过'}`,
      tokens: output._meta?.tokens?.total_tokens || 0,
      duration: output._meta?.duration || 0
    });

    return {
      validationReport: output,
      currentStep: 'validator',
      completedSteps: [...(state.completedSteps || []), 'validator'],
      stepDetails: [...(state.stepDetails || []), ...capturedDetails.map(detail => ({ ...detail, step: 'validator' })), {
        step: 'validator',
        status: 'completed',
        type: 'stage',
        name: 'validator 完成',
        message: `校验完成，评分 ${output.score || 'N/A'}，结果 ${output.passed ? '通过' : '未通过'}`,
        score: output.score,
        passed: output.passed,
        duration: output._meta?.duration || 0,
        tokens: output._meta?.tokens?.total_tokens || 0,
      }],
    };
  };
}

// ─── Conditional Routing Functions ──────────────────────────────────

function routeByType(state) {
  const kpType = state.knowledgePoint?.type || '';
  if (kpType === '兼容性差异' || kpType.includes('兼容性')) {
    logger.info('[graph] Route: compatibility type → comparator');
    return 'comparator';
  }
  logger.info('[graph] Route: standard type → retriever');
  return 'retriever';
}

function routeAfterValidation(state) {
  const report = state.validationReport;

  if (!report) {
    logger.info('[graph] Route: no validation report → END');
    return END;
  }

  if (report.passed) {
    logger.info(`[graph] Route: validation passed (score: ${report.score}) → END`);
    return END;
  }

  if (state.retryCount >= (state.maxRetries || 3)) {
    logger.warn(`[graph] Route: max retries reached (${state.retryCount}/${state.maxRetries}) → END`);
    return END;
  }

  const feedbackText = [
    ...(report.warnings || []),
    ...(report.suggestions || []),
  ].join('\n');

  logger.info(`[graph] Route: validation failed (score: ${report.score}), retry ${state.retryCount + 1} → generator`);
  return 'retry_generator';
}

function routeAfterRetryPrep(state) {
  return 'generator';
}

// ─── Graph Builder ──────────────────────────────────────────────────

function buildWorkflowGraph(agentManager, toolManager, options = {}) {
  const maxRetries = options.maxRetries || 3;
  const skipValidation = options.skipValidation || false;
  const steps = options.steps || [];

  const graph = new StateGraph(WorkflowState);

  // 动态添加节点
  const stepNames = steps.map(s => s.name);
  const hasMergedPlanner = stepNames.includes('planner_retriever');

  if (hasMergedPlanner) {
    graph.addNode('planner_retriever', createPlannerRetrieverNode(agentManager, toolManager, options));
  } else {
    graph.addNode('planner', createPlannerNode(agentManager, options));
    graph.addNode('retriever', createRetrieverNode(agentManager, toolManager, options));
    graph.addNode('comparator', createComparatorNode(agentManager, options));
  }

  graph.addNode('generator', createGeneratorNode(agentManager, options));

  if (!skipValidation) {
    graph.addNode('validator', createValidatorNode(agentManager, options));

    graph.addNode('retry_generator', async (state) => {
      const report = state.validationReport;
      const feedbackText = [
        ...(report?.warnings || []),
        ...(report?.suggestions || []),
      ].join('\n');

      logger.info(`[graph] Preparing retry #${state.retryCount + 1}, feedback: ${feedbackText.slice(0, 200)}`);

      return {
        retryCount: state.retryCount + 1,
        feedback: feedbackText,
        currentStep: 'retry_generator',
        completedSteps: [...(state.completedSteps || []), 'retry_generator'],
        stepDetails: [...(state.stepDetails || []), {
          step: 'retry_generator',
          status: 'preparing',
          retryCount: state.retryCount + 1,
          feedback: feedbackText,
        }],
      };
    });
  }

  // 动态添加边
  if (hasMergedPlanner) {
    graph.addEdge(START, 'planner_retriever');
    graph.addEdge('planner_retriever', 'generator');
  } else {
    graph.addEdge(START, 'planner');
    graph.addConditionalEdges('planner', routeByType, {
      comparator: 'comparator',
      retriever: 'retriever',
    });
    graph.addEdge('comparator', 'retriever');
    graph.addEdge('retriever', 'generator');
  }

  if (skipValidation) {
    graph.addEdge('generator', END);
  } else {
    graph.addEdge('generator', 'validator');
    graph.addConditionalEdges('validator', routeAfterValidation, {
      [END]: END,
      retry_generator: 'retry_generator',
    });
    graph.addEdge('retry_generator', 'generator');
  }

  return graph.compile();
}

module.exports = {
  WorkflowState,
  buildWorkflowGraph,
  routeByType,
  routeAfterValidation,
};
