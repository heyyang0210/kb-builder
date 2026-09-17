const express = require('express');
const router = express.Router();
const path = require('path');
const { AGENT_RUNNER_RUNTIME_ROOT } = require('../lib/repo-paths');
const fs = require('fs');
const { createAggregateStore } = require('../lib/aggregate-store');
const { DatabaseRecordStore } = require('../lib/database-record-store');

const WORKFLOWS_DIR = path.join(AGENT_RUNNER_RUNTIME_ROOT, 'workflows');
const workflowStores = new Map();
const dbRecordStore = new DatabaseRecordStore();

function workflowStore(id) {
  if (!workflowStores.has(id)) {
    workflowStores.set(id, createAggregateStore({
      namespace: 'workflows',
      key: id,
      filePath: path.join(WORKFLOWS_DIR, `${id}.json`),
      emptyValue: null,
    }));
  }
  return workflowStores.get(id);
}

function isActiveWorkflow(workflow) {
  return Boolean(workflow) && workflow.deleted !== true;
}

async function listDatabaseWorkflows() {
  const exported = await dbRecordStore.exportAll();
  return (exported.records || [])
    .filter(record => record.namespace === 'workflows' && isActiveWorkflow(record.payload))
    .map(record => record.payload);
}

if (!fs.existsSync(WORKFLOWS_DIR)) {
  fs.mkdirSync(WORKFLOWS_DIR, { recursive: true });
}

function initDefaultWorkflows() {
  const now = new Date().toISOString();
  const defaultWorkflows = [
    {
      id: 'default',
      name: '默认4步流程',
      description: '标准的文档生成流程，包括规划、检索、生成和验证',
      steps: [
        { name: 'planner', agent: 'planner', config: {} },
        { name: 'retriever', agent: 'retriever', config: {} },
        { name: 'generator', agent: 'generator', config: {} },
        { name: 'validator', agent: 'validator', config: {} },
      ],
      is_default: true,
      created_at: now,
      updated_at: now,
      deleted: false,
    },
    {
      id: 'fast',
      name: '快速生成',
      description: '跳过验证步骤，快速生成文档',
      steps: [
        { name: 'planner', agent: 'planner', config: {} },
        { name: 'retriever', agent: 'retriever', config: {} },
        { name: 'generator', agent: 'generator', config: {} },
      ],
      is_default: false,
      created_at: now,
      updated_at: now,
      deleted: false,
    },
    {
      id: 'high_quality',
      name: '高质量模式',
      description: '增加审核步骤，确保文档质量',
      steps: [
        { name: 'planner', agent: 'planner', config: {} },
        { name: 'retriever', agent: 'retriever', config: {} },
        { name: 'generator', agent: 'generator', config: {} },
        { name: 'reviewer', agent: 'validator', config: { strict_mode: true } },
        { name: 'validator', agent: 'validator', config: {} },
      ],
      is_default: false,
      created_at: now,
      updated_at: now,
      deleted: false,
    },
  ];

  defaultWorkflows.forEach(workflow => {
    const filePath = path.join(WORKFLOWS_DIR, `${workflow.id}.json`);
    if (process.env.KNOWLEDGE_STORAGE_MODE === 'database') {
      try {
        const current = workflowStore(workflow.id).read();
        if (!isActiveWorkflow(current)) workflowStore(workflow.id).write(workflow);
      } catch (_error) {
        workflowStore(workflow.id).write(workflow);
      }
    } else if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(workflow, null, 2));
    }
  });
}

initDefaultWorkflows();

router.get('/list', async (_req, res) => {
  try {
    const workflows = process.env.KNOWLEDGE_STORAGE_MODE === 'database'
      ? await listDatabaseWorkflows()
      : fs.readdirSync(WORKFLOWS_DIR)
        .filter(file => file.endsWith('.json'))
        .map(file => JSON.parse(fs.readFileSync(path.join(WORKFLOWS_DIR, file), 'utf-8')))
        .filter(isActiveWorkflow);

    res.json({ success: true, data: workflows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const filePath = path.join(WORKFLOWS_DIR, `${req.params.id}.json`);
    if (process.env.KNOWLEDGE_STORAGE_MODE !== 'database' && !fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: '工作流不存在' });
    }

    const workflow = process.env.KNOWLEDGE_STORAGE_MODE === 'database'
      ? workflowStore(req.params.id).read()
      : JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    if (!isActiveWorkflow(workflow)) {
      return res.status(404).json({ success: false, message: '工作流不存在' });
    }

    res.json({ success: true, data: workflow });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const workflow = req.body || {};
    if (!workflow.id || !workflow.name || !workflow.steps) {
      return res.status(400).json({ success: false, message: '缺少必要字段：id, name, steps' });
    }

    const filePath = path.join(WORKFLOWS_DIR, `${workflow.id}.json`);
    const current = process.env.KNOWLEDGE_STORAGE_MODE === 'database' ? workflowStore(workflow.id).read() : null;
    if (fs.existsSync(filePath) || isActiveWorkflow(current)) {
      return res.status(400).json({ success: false, message: '工作流 ID 已存在' });
    }

    const now = new Date().toISOString();
    const payload = {
      ...workflow,
      created_at: now,
      updated_at: now,
      is_default: Boolean(workflow.is_default),
      deleted: false,
    };

    workflowStore(workflow.id).write(payload);
    res.json({ success: true, message: '工作流创建成功', data: payload });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const filePath = path.join(WORKFLOWS_DIR, `${req.params.id}.json`);
    const input = req.body || {};

    if (process.env.KNOWLEDGE_STORAGE_MODE !== 'database' && !fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: '工作流不存在' });
    }

    const current = process.env.KNOWLEDGE_STORAGE_MODE === 'database'
      ? workflowStore(req.params.id).read()
      : JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    if (!isActiveWorkflow(current)) {
      return res.status(404).json({ success: false, message: '工作流不存在' });
    }

    const payload = {
      ...current,
      ...input,
      id: req.params.id,
      updated_at: new Date().toISOString(),
      deleted: false,
    };

    if (process.env.KNOWLEDGE_STORAGE_MODE === 'database') {
      workflowStore(req.params.id).write(payload);
    } else {
      fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
    }

    res.json({ success: true, message: '工作流更新成功', data: payload });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const filePath = path.join(WORKFLOWS_DIR, `${req.params.id}.json`);

    if (process.env.KNOWLEDGE_STORAGE_MODE !== 'database' && !fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: '工作流不存在' });
    }

    if (process.env.KNOWLEDGE_STORAGE_MODE === 'database') {
      const current = workflowStore(req.params.id).read();
      if (!isActiveWorkflow(current)) {
        return res.status(404).json({ success: false, message: '工作流不存在' });
      }
      workflowStore(req.params.id).write({
        ...current,
        deleted: true,
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } else {
      fs.unlinkSync(filePath);
    }

    res.json({ success: true, message: '工作流已删除' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
