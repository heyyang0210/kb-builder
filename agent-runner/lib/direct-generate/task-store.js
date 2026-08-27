let ioInstance = null;
const directTasks = new Map();
const { getTrace } = require('../platform-profile/runtime-profile');

function setDirectIO(io) {
  ioInstance = io;
}

function createDirectTask(inputData) {
  const taskId = `direct_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  const task = {
    task_id: taskId,
    status: 'running',
    progress: 0,
    current_step: 'prepare',
    steps: [
      { name: 'prepare', agent: 'direct', status: 'running', attempt: 1, duration: 0, output_preview: null, error: null, details: [] },
      { name: 'retrieve', agent: 'direct', status: 'pending', attempt: 0, duration: 0, output_preview: null, error: null, details: [] },
      { name: 'generate', agent: 'direct', status: 'pending', attempt: 0, duration: 0, output_preview: null, error: null, details: [] },
      { name: 'write', agent: 'direct', status: 'pending', attempt: 0, duration: 0, output_preview: null, error: null, details: [] }
    ],
    error: null,
    created_at: now,
    profile: getTrace(),
    inputData
  };
  directTasks.set(taskId, task);
  return task;
}

function hasDirectTask(taskId) {
  return directTasks.has(taskId);
}

function getDirectTask(taskId) {
  return directTasks.get(taskId);
}

function normalizeDirectDetail(detail = {}) {
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

function serializeDirectTask(task) {
  return {
    task_id: task.task_id,
    status: task.status,
    progress: task.progress,
    current_step: task.current_step,
    steps: task.steps.map(s => ({
      name: s.name,
      agent: s.agent,
      status: s.status,
      attempt: s.attempt,
      duration: s.duration,
      output_preview: s.output_preview,
      error: s.error,
      details: s.details || []
    })),
    error: task.error,
    created_at: task.created_at,
    profile: task.profile
  };
}

function emitDirectProgress(task) {
  if (ioInstance) {
    ioInstance.to(`task:${task.task_id}`).emit('progress', serializeDirectTask(task));
  }
}

function setDirectStep(task, stepName, status, fields = {}) {
  const step = task.steps.find(s => s.name === stepName);
  if (step) {
    const nextDetails = fields.details;
    const nextFields = { ...fields };
    delete nextFields.details;
    Object.assign(step, { status }, nextFields);
    if (nextDetails) {
      step.details = [...(step.details || []), ...nextDetails.map(normalizeDirectDetail)];
    }
    if (status === 'running' && !step.startTime) step.startTime = Date.now();
    if ((status === 'completed' || status === 'failed') && step.startTime) {
      step.duration = Date.now() - step.startTime;
    }
  }
  task.current_step = stepName;
}

function addDirectDetail(task, stepName, detail) {
  const step = task.steps.find(s => s.name === stepName);
  if (!step) return null;
  const normalized = normalizeDirectDetail(detail);
  step.details = step.details || [];
  step.details.push(normalized);
  if (normalized.status === 'failed') {
    step.status = 'failed';
    step.error = normalized.error || normalized.message;
  }
  if (ioInstance) {
    ioInstance.to(`task:${task.task_id}`).emit('step_detail', {
      task_id: task.task_id,
      step: stepName,
      detail_type: normalized.type,
      detail: normalized,
      timestamp: normalized.timestamp
    });
  }
  emitDirectProgress(task);
  return normalized;
}

module.exports = {
  setDirectIO,
  createDirectTask,
  hasDirectTask,
  getDirectTask,
  serializeDirectTask,
  setDirectStep,
  addDirectDetail,
  emitDirectProgress
};
