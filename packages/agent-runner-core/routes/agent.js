const express = require('express');
const router = express.Router();
const WorkflowEngine = require('../lib/workflow-engine');
const configManager = require('../lib/config-manager');
const logger = require('../lib/logger');
const ToolManager = require('../lib/tools/tool-manager');
const path = require('path');
const fs = require('fs').promises;
const {
  setDirectIO,
  createDirectTask,
  hasDirectTask,
  getDirectTask,
  serializeDirectTask,
  emitDirectProgress
} = require('../lib/direct-generate/task-store');
const { resolveOutputFilename } = require('../lib/direct-generate/prompt-parser');
const { executeDirectGenerate } = require('../lib/direct-generate/direct-task-runner');
const ProcessStore = require('../lib/process-store');
const { freezeTemplateForRequest, persistTemplateSnapshot, templateMetadata } = require('../lib/template-generation');

let workflowEngine = null;
let ioInstance = null;

// 注入 io 实例
function setIO(io) {
  ioInstance = io;
  setDirectIO(io);
}

async function getEngine() {
  if (!workflowEngine) {
    const modelConfig = await configManager.getModelConfig() || {};
    const mcpConfig = await configManager.getMCPConfig() || {};
    const basePath = path.join(__dirname, '..');
    const tm = new ToolManager({ basePath, mcp: mcpConfig });
    workflowEngine = new WorkflowEngine({
      ...modelConfig,
      retryCount: 3,
      maxConcurrent: 3
    });

    workflowEngine.setToolManager(tm);

    workflowEngine.on('progress', (data) => {
      if (ioInstance) {
        ioInstance.to(`task:${data.task_id}`).emit('progress', data);
      }

      // Auto-save on completion
      if (data.status === 'completed') {
        const wf = workflowEngine.workflows.get(data.task_id);
        if (wf) {
          const lastStep = wf.steps[wf.steps.length - 1];
          const doc = lastStep?.output?.final_document || lastStep?.output?.document;
          if (doc) {
            const outputPath = wf.inputData.output_path || 'output/';
            const filename = wf.inputData.filename || 'document.md';
            const filePath = path.join(outputPath, filename);
            try {
              const writer = tm.getTool('file_writer');
              writer.write(filePath, doc, { overwrite: true });
              logger.info(`Document saved: ${filePath}`);
            } catch (err) {
              logger.error(`Failed to save document: ${err.message}`);
            }
          }
        }
      }
    });

    workflowEngine.on('step_failed', (data) => {
      if (ioInstance) {
        ioInstance.to(`task:${data.taskId}`).emit('step_failed', data);
      }
    });

    // 监听步骤详情事件
    workflowEngine.on('step_detail', (data) => {
      if (ioInstance) {
        ioInstance.to(`task:${data.task_id}`).emit('step_detail', data);
      }
      logger.debug('Step detail emitted:', { 
        task_id: data.task_id, 
        step: data.step, 
        detail_type: data.detail_type 
      });
    });
  }
  return workflowEngine;
}

// POST /api/agent/execute
router.post('/execute', async (req, res, next) => {
  try {
    const { prompt, knowledge_point, workflow_config, output_path, filename } = req.body;
    const effectiveFilename = resolveOutputFilename({ prompt, filename, knowledge_point });

    if (!knowledge_point) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'knowledge_point is required' }
      });
    }

    const templateSnapshot = await freezeTemplateForRequest(req);
    if (req.body.mode === 'direct_generate') {
      logger.info('收到直写模式执行请求:', {
        prompt_length: prompt?.length || 0,
        knowledge_point: knowledge_point.name,
        output_path,
        filename: effectiveFilename
      });
      const task = createDirectTask({ prompt, knowledge_point, output_path, filename: effectiveFilename, template: req.body.template, ...templateSnapshot, debug: req.body.debug === true });
      try { await persistTemplateSnapshot(task.task_id, task.inputData); }
      catch (error) { task.status = 'failed'; task.error = error.message; throw error; }
      executeDirectGenerate(req, task).catch(err => {
        task.status = 'failed';
        task.error = err.message;
        logger.error(`[direct_generate] Background execution failed: ${err.message}`, { taskId: task.task_id });
        emitDirectProgress(task);
      });
      return res.json({
        success: true,
        task_id: task.task_id,
        ...templateMetadata(task.inputData),
        message: '直写任务已启动'
      });
    }

    logger.info('收到执行请求:', {
      prompt_length: prompt?.length || 0,
      knowledge_point: knowledge_point.name,
      output_path
    });

    const engine = await getEngine();
    
    // 修复：每次执行前重新读取最新配置并更新 Agent
    const latestConfig = await configManager.getModelConfig() || {};
    engine.agentManager.updateAllConfigs(latestConfig);

    const latestMCPConfig = await configManager.getMCPConfig() || {};
    const basePath = path.join(__dirname, '..');
    if (engine.toolManager) {
      engine.toolManager.updateConfig({ basePath, mcp: latestMCPConfig });
    }

    logger.info('Agent 配置已更新', { 
      provider: latestConfig.provider, 
      model: latestConfig.model,
      has_api_key: !!latestConfig.api_key,
      mcp_configured: !!latestMCPConfig.server_url
    });

    const steps = workflow_config?.steps || [
      { name: 'planner', agent: 'planner', config: {} },
      { name: 'retriever', agent: 'retriever', config: {} },
      { name: 'generator', agent: 'generator', config: {} },
      { name: 'validator', agent: 'validator', config: {} }
    ];

    const taskId = await engine.createWorkflow({
      steps,
      inputData: {
        prompt: prompt,
        knowledge_point,
        template: req.body.template,
        ...templateSnapshot,
        output_path: output_path || '../output/',
        filename: effectiveFilename
      }
    });

    engine.startWorkflow(taskId).catch(err => {
      logger.error(`Task background execution failed: ${taskId} - ${err.message}`);
    });

    logger.info('Task started', { taskId, knowledge_point: knowledge_point.name });

    res.json({ success: true, task_id: taskId, ...templateMetadata(templateSnapshot), message: '任务已启动' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, error: { code: err.code, message: err.message } });
    next(err);
  }
});

// GET /api/agent/status/:taskId
router.get('/status/:taskId', async (req, res) => {
  try {
    if (hasDirectTask(req.params.taskId)) {
      return res.json(serializeDirectTask(getDirectTask(req.params.taskId)));
    }

    const engine = await getEngine();
    const data = engine.getWorkflow(req.params.taskId);

    if (!data) {
      return res.status(404).json({
        success: false,
        error: { code: 'TASK_NOT_FOUND', message: '任务不存在' }
      });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// POST /api/agent/cancel/:taskId
router.post('/cancel/:taskId', async (req, res) => {
  try {
    const engine = await getEngine();
    engine.cancelWorkflow(req.params.taskId);
    res.json({ success: true, message: '任务已取消' });
  } catch (err) {
    res.status(400).json({ success: false, error: { code: 'ERROR', message: err.message } });
  }
});

// POST /api/agent/force-continue/:taskId
router.post('/force-continue/:taskId', async (req, res) => {
  try {
    const engine = await getEngine();
    engine.forceContinue(req.params.taskId, req.body.step);
    res.json({ success: true, message: '已跳过失败步骤，继续执行' });
  } catch (err) {
    res.status(400).json({ success: false, error: { code: 'ERROR', message: err.message } });
  }
});

// GET /api/agent/health
router.get('/health', async (req, res) => {
  const engine = await getEngine();
  const allWorkflows = Array.from(engine.workflows.values());

  res.json({
    status: 'ok',
    version: '1.0.0',
    uptime: process.uptime(),
    tasks_total: allWorkflows.length,
    tasks_running: allWorkflows.filter(t => t.status === 'running').length,
    agents: engine.agentManager.listAgents()
  });
});


// 中间文件查看 API
router.get('/task/:taskId/logs', async (req, res) => {
  try {
    const store = new ProcessStore(req.params.taskId);
    const files = await store.listFiles();
    res.json({ taskId: req.params.taskId, files });
  } catch (err) {
    res.status(404).json({ error: 'Task logs not found', message: err.message });
  }
});

router.get('/task/:taskId/logs/:stage/:file', async (req, res) => {
  try {
    const store = new ProcessStore(req.params.taskId);
    const content = await store.load(req.params.stage, req.params.file);
    const isJson = req.params.file.endsWith('.json');
    res.json({ file: req.params.file, content });
  } catch (err) {
    res.status(404).json({ error: 'File not found', message: err.message });
  }
});

module.exports = router;
module.exports.setIO = setIO;
