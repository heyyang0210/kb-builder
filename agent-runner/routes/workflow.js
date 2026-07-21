const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const WORKFLOWS_DIR = path.join(__dirname, '..', 'workflows');

// Ensure workflows directory exists
if (!fs.existsSync(WORKFLOWS_DIR)) {
  fs.mkdirSync(WORKFLOWS_DIR, { recursive: true });
}

// Initialize default workflows
function initDefaultWorkflows() {
  const defaultWorkflows = [
    {
      id: 'default',
      name: '默认4步流程',
      description: '标准的文档生成流程，包含规划、检索、生成和验证',
      steps: [
        { name: 'planner', agent: 'planner', config: {} },
        { name: 'retriever', agent: 'retriever', config: {} },
        { name: 'generator', agent: 'generator', config: {} },
        { name: 'validator', agent: 'validator', config: {} }
      ],
      is_default: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'fast',
      name: '快速生成',
      description: '跳过验证步骤，快速生成文档',
      steps: [
        { name: 'planner', agent: 'planner', config: {} },
        { name: 'retriever', agent: 'retriever', config: {} },
        { name: 'generator', agent: 'generator', config: {} }
      ],
      is_default: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'high_quality',
      name: '高质量模式',
      description: '增加审查步骤，确保文档质量',
      steps: [
        { name: 'planner', agent: 'planner', config: {} },
        { name: 'retriever', agent: 'retriever', config: {} },
        { name: 'generator', agent: 'generator', config: {} },
        { name: 'reviewer', agent: 'validator', config: { strict_mode: true } },
        { name: 'validator', agent: 'validator', config: {} }
      ],
      is_default: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];
  
  defaultWorkflows.forEach(wf => {
    const filePath = path.join(WORKFLOWS_DIR, `${wf.id}.json`);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(wf, null, 2));
    }
  });
}

// Initialize on first run
initDefaultWorkflows();

// GET /api/workflow/list - List all workflows
router.get('/list', (req, res) => {
  try {
    const files = fs.readdirSync(WORKFLOWS_DIR).filter(f => f.endsWith('.json'));
    const workflows = files.map(file => {
      const content = fs.readFileSync(path.join(WORKFLOWS_DIR, file), 'utf-8');
      return JSON.parse(content);
    });
    
    res.json({ success: true, data: workflows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/workflow/:id - Get workflow by ID
router.get('/:id', (req, res) => {
  try {
    const filePath = path.join(WORKFLOWS_DIR, `${req.params.id}.json`);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: '工作流不存在' });
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const workflow = JSON.parse(content);
    
    res.json({ success: true, data: workflow });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/workflow - Create new workflow
router.post('/', (req, res) => {
  try {
    const workflow = req.body;
    
    if (!workflow.id || !workflow.name || !workflow.steps) {
      return res.status(400).json({ 
        success: false, 
        message: '缺少必要字段：id, name, steps' 
      });
    }
    
    const filePath = path.join(WORKFLOWS_DIR, `${workflow.id}.json`);
    
    if (fs.existsSync(filePath)) {
      return res.status(400).json({ 
        success: false, 
        message: '工作流 ID 已存在' 
      });
    }
    
    workflow.created_at = new Date().toISOString();
    workflow.updated_at = new Date().toISOString();
    workflow.is_default = workflow.is_default || false;
    
    fs.writeFileSync(filePath, JSON.stringify(workflow, null, 2));
    
    res.json({ 
      success: true, 
      message: '工作流创建成功',
      data: workflow 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/workflow/:id - Update workflow
router.put('/:id', (req, res) => {
  try {
    const filePath = path.join(WORKFLOWS_DIR, `${req.params.id}.json`);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: '工作流不存在' });
    }
    
    const workflow = req.body;
    workflow.id = req.params.id;
    workflow.updated_at = new Date().toISOString();
    
    fs.writeFileSync(filePath, JSON.stringify(workflow, null, 2));
    
    res.json({ 
      success: true, 
      message: '工作流更新成功',
      data: workflow 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/workflow/:id - Delete workflow
router.delete('/:id', (req, res) => {
  try {
    const filePath = path.join(WORKFLOWS_DIR, `${req.params.id}.json`);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: '工作流不存在' });
    }
    
    fs.unlinkSync(filePath);
    
    res.json({ success: true, message: '工作流已删除' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
