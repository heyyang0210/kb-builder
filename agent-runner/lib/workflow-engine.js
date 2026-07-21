const { EventEmitter } = require('events');
const AgentManager = require('./agent-manager');
const { buildWorkflowGraph } = require('./langgraph-workflow');
const logger = require('./logger');

class WorkflowEngine extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = config;
    this.agentManager = new AgentManager(config);
    this.toolManager = null;
    this.workflows = new Map();
    this.maxConcurrent = config.maxConcurrent || 3;
    this.runningCount = 0;
  }

  setToolManager(toolManager) {
    this.toolManager = toolManager;
  }

  async createWorkflow(params) {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const steps = (params.steps || this._getDefaultSteps()).map(s => ({
      ...s,
      status: 'pending',
      attempt: 0,
      startTime: null,
      duration: 0,
      output: null,
      error: null,
      details: [],
    }));

    const workflow = {
      taskId,
      status: 'created',
      progress: 0,
      currentStepIndex: -1,
      currentStep: null,
      steps,
      inputData: params.inputData,
      config: params.config || {},
      error: null,
      createdAt: new Date().toISOString(),
      startTime: null,
      finalState: null,
    };

    this.workflows.set(taskId, workflow);
    logger.info(`Workflow created: ${taskId}`, { steps: steps.length });
    return taskId;
  }

  async startWorkflow(taskId) {
    const workflow = this.workflows.get(taskId);
    if (!workflow) throw new Error(`Workflow ${taskId} not found`);
    if (this.runningCount >= this.maxConcurrent) throw new Error('Too many concurrent workflows');

    this.runningCount++;
    workflow.status = 'running';
    workflow.startTime = Date.now();
    logger.info(`Workflow started: ${taskId}`);

    try {
      const graphOptions = this._resolveGraphOptions(workflow);
      graphOptions.onStepStart = (step, detail = {}) => this._markStepRunning(workflow, step, detail);
      graphOptions.onStepDetail = (step, detail = {}) => this._recordStepDetail(workflow, step, detail);
      graphOptions.onStepEnd = (step, detail = {}) => this._markStepCompleted(workflow, step, detail);
      const compiledGraph = buildWorkflowGraph(this.agentManager, this.toolManager, graphOptions);
      const initialState = this._buildInitialState(workflow, graphOptions);

      const result = await compiledGraph.invoke(initialState, {
        recursionLimit: 50,
      });

      workflow.finalState = result;
      workflow.status = 'completed';
      workflow.progress = 100;
      this._syncStepsFromState(workflow, result);

      logger.info(`Workflow completed: ${taskId}`);
      this._emitProgress(workflow);

    } catch (err) {
      workflow.status = 'failed';
      workflow.error = err.message;
      if (workflow.currentStep) {
        const step = workflow.steps.find(s => s.name === workflow.currentStep);
        if (step) {
          step.status = 'failed';
          step.error = err.message;
          this._appendStepDetail(step, {
            type: 'error',
            name: '执行失败',
            status: 'failed',
            message: err.message,
            error: err.message,
            timestamp: Date.now()
          });
        }
      }
      logger.error(`Workflow failed: ${taskId} - ${err.message}`);

      this.emit('step_failed', {
        taskId,
        step: workflow.currentStep || 'unknown',
        error: err.message,
      });
      this._emitProgress(workflow);
    } finally {
      this.runningCount--;
    }
  }

  cancelWorkflow(taskId) {
    const workflow = this.workflows.get(taskId);
    if (!workflow) throw new Error(`Workflow ${taskId} not found`);
    workflow.status = 'cancelled';
    logger.info(`Workflow cancelled: ${taskId}`);
    this._emitProgress(workflow);
  }


  // Force continue after failure - skip remaining validation
  forceContinue(taskId, stepName) {
    const workflow = this.workflows.get(taskId);
    if (!workflow) throw new Error(`Workflow ${taskId} not found`);

    if (workflow.finalState?.document) {
      workflow.status = 'completed';
      workflow.progress = 100;
      this._syncStepsFromState(workflow, workflow.finalState);
      logger.info(`Workflow force-continued: ${taskId}`);
      this._emitProgress(workflow);
    } else {
      throw new Error('Cannot force continue: no document generated yet');
    }
  }

  getWorkflow(taskId) {
    const workflow = this.workflows.get(taskId);
    if (!workflow) return null;

    return {
      task_id: workflow.taskId,
      status: workflow.status,
      progress: workflow.progress,
      current_step: workflow.currentStep,
      steps: workflow.steps.map(s => ({
        name: s.name,
        agent: s.agent,
        status: s.status,
        attempt: s.attempt,
        duration: s.duration,
        output_preview: s.output ? this._getOutputPreview(s.output) : null,
        error: s.error,
        details: s.details || [],
      })),
      error: workflow.error,
      created_at: workflow.createdAt,
    };
  }

  // ─── Private Methods ────────────────────────────────────────────

  _resolveGraphOptions(workflow) {
    const steps = workflow.steps.map(s => ({ name: s.name, config: s.config || {} }));
    const skipValidation = !workflow.steps.some(s => s.name === 'validator');
    const hasStrictMode = workflow.steps.some(s => s.config?.strict_mode);
    
    // 从 validator 步骤配置中获取 maxRetries
    const validatorStep = workflow.steps.find(s => s.name === 'validator');
    const maxRetries = validatorStep?.config?.maxRetries || (hasStrictMode ? 5 : (this.config.retryCount || 3));

    return { 
      skipValidation, 
      maxRetries,
      steps 
    };
  }

  _buildInitialState(workflow, graphOptions) {
    const input = workflow.inputData || {};
    const kp = input.knowledge_point || input.knowledgePoint || {};

    return {
      knowledgePoint: kp,
      template: input.template,
      prompt: input.prompt,
      inputData: input,
      executionPlan: null,
      references: null,
      comparison: null,
      document: null,
      validationReport: null,
      feedback: null,
      retryCount: 0,
      maxRetries: graphOptions.maxRetries,
      skipValidation: graphOptions.skipValidation,
      strictMode: false,
      currentStep: null,
      completedSteps: [],
      stepDetails: [],
    };
  }

  _syncStepsFromState(workflow, finalState) {
    const stepDetails = finalState.stepDetails || [];

    const stepInfoMap = {};
    for (const detail of stepDetails) {
      const name = detail.step;
      if (!stepInfoMap[name]) {
        stepInfoMap[name] = { details: [], count: 0 };
      }
      stepInfoMap[name].details.push(detail);
      stepInfoMap[name].count++;
    }

    for (const step of workflow.steps) {
      const info = stepInfoMap[step.name];
      if (info) {
        step.status = 'completed';
        step.attempt = Math.max(step.attempt || 1, 1);
        if (!step.details || step.details.length === 0) {
          step.details = info.details.map(d => this._normalizeDetail(d));
        }
        if (!step.duration) {
          step.duration = info.details.reduce((sum, d) => sum + (d.duration || 0), 0);
        }
      }
    }

    const outputMap = {
      planner: finalState.executionPlan,
      planner_retriever: finalState.executionPlan,
      retriever: finalState.references ? { references: finalState.references } : null,
      comparator: finalState.comparison ? { comparison: finalState.comparison } : null,
      generator: finalState.document ? { document: finalState.document } : null,
      validator: finalState.validationReport,
    };

    for (const step of workflow.steps) {
      if (outputMap[step.name] !== undefined) {
        step.output = outputMap[step.name];
      }
    }

    workflow.currentStep = finalState.currentStep;
    workflow.progress = 100;
  }

  _emitProgress(workflow) {
    const data = this.getWorkflow(workflow.taskId);
    logger.debug('Progress update:', {
      task_id: data.task_id,
      status: data.status,
      progress: data.progress,
      current_step: data.current_step,
    });
    this.emit('progress', data);
  }

  _emitStepDetail(workflow, step, detail) {
    this.emit('step_detail', {
      task_id: workflow.taskId,
      step: step,
      detail_type: detail.type,
      detail: detail,
      timestamp: Date.now(),
    });
  }

  _normalizeDetail(detail = {}) {
    const outputSummary = detail.output_summary || detail.output || undefined;
    const inputSummary = detail.input_summary || detail.input || undefined;
    return {
      type: detail.type || 'stage',
      name: detail.name || detail.message || '执行步骤',
      status: detail.status || 'running',
      message: detail.message || detail.name || '',
      tool: detail.tool,
      input_summary: inputSummary,
      output_summary: outputSummary,
      duration: detail.duration || 0,
      tokens: detail.tokens || 0,
      timestamp: detail.timestamp || Date.now(),
      error: detail.error || outputSummary?.error
    };
  }

  _appendStepDetail(step, detail) {
    const normalized = this._normalizeDetail(detail);
    step.details = step.details || [];
    step.details.push(normalized);
    return normalized;
  }

  _calculateProgress(workflow) {
    if (!workflow.steps.length) return 0;
    const completed = workflow.steps.filter(s => s.status === 'completed').length;
    const running = workflow.steps.some(s => s.status === 'running') ? 0.5 : 0;
    return Math.min(95, Math.round(((completed + running) / workflow.steps.length) * 100));
  }

  _markStepRunning(workflow, stepName, detail = {}) {
    const step = workflow.steps.find(s => s.name === stepName);
    if (!step) return;
    step.status = 'running';
    step.attempt = Math.max(step.attempt || 0, 1);
    step.startTime = step.startTime || Date.now();
    workflow.currentStep = stepName;
    workflow.progress = this._calculateProgress(workflow);
    const normalized = this._appendStepDetail(step, {
      type: 'stage',
      name: `${stepName} 开始`,
      status: 'running',
      message: detail.message || `正在执行 ${stepName}`,
      ...detail
    });
    this._emitStepDetail(workflow, stepName, normalized);
    this._emitProgress(workflow);
  }

  _recordStepDetail(workflow, stepName, detail = {}) {
    const step = workflow.steps.find(s => s.name === stepName);
    if (!step) return;
    if (step.status === 'pending') step.status = 'running';
    workflow.currentStep = stepName;
    workflow.progress = this._calculateProgress(workflow);
    const normalized = this._appendStepDetail(step, detail);
    this._emitStepDetail(workflow, stepName, normalized);
    this._emitProgress(workflow);
  }

  _markStepCompleted(workflow, stepName, detail = {}) {
    const step = workflow.steps.find(s => s.name === stepName);
    if (!step) return;
    step.status = 'completed';
    if (step.startTime) step.duration = Date.now() - step.startTime;
    workflow.currentStep = stepName;
    workflow.progress = this._calculateProgress(workflow);
    const normalized = this._appendStepDetail(step, {
      type: 'stage',
      name: `${stepName} 完成`,
      status: 'success',
      message: detail.message || `${stepName} 执行完成`,
      duration: step.duration,
      ...detail
    });
    this._emitStepDetail(workflow, stepName, normalized);
    this._emitProgress(workflow);
  }

  _getOutputPreview(output) {
    if (typeof output === 'string') {
      return output.slice(0, 500) + (output.length > 500 ? '...' : '');
    }
    if (output?.document) {
      return output.document.slice(0, 500) + (output.document.length > 500 ? '...' : '');
    }
    if (output?.references) {
      return output.references.slice(0, 500) + (output.references.length > 500 ? '...' : '');
    }
    if (output?.comparison) {
      return output.comparison.slice(0, 500) + (output.comparison.length > 500 ? '...' : '');
    }
    return JSON.stringify(output).slice(0, 500);
  }

  _getDefaultSteps() {
    return [
      { name: 'planner', agent: 'planner', config: {} },
      { name: 'retriever', agent: 'retriever', config: {} },
      { name: 'generator', agent: 'generator', config: {} },
      { name: 'validator', agent: 'validator', config: {} },
    ];
  }
}

module.exports = WorkflowEngine;
