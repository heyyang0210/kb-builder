/**
 * WorkflowSelector Component
 * Handles selection of Agent execution workflows
 */
class WorkflowSelector {
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;
    this.workflows = [];
    this.selected = null;
    this.options = {
      onSelect: null,
      ...options
    };
  }
  
  async load() {
    try {
      const response = await fetch(getBackendBaseUrl() + '/api/workflow/list');
      const result = await response.json();
      
      if (result.success) {
        this.workflows = result.data;
        this.render();
        
        // Auto-select default workflow
        const defaultWorkflow = this.workflows.find(w => w.is_default);
        if (defaultWorkflow) {
          this.select(defaultWorkflow.id);
        }
      } else {
        throw new Error(result.message || '加载工作流失败');
      }
    } catch (err) {
      console.error('Failed to load workflows:', err);
      this.workflows = this._getDefaultWorkflows();
      this.render();
    }
  }
  
  _getDefaultWorkflows() {
    return [
      {
        id: 'fast',
        name: '⚡ 快速模式 (~90 秒)',
        description: '合并规划 + 检索为一次 LLM 调用，适合简单知识点',
        steps: [
          { name: 'planner_retriever', agent: 'planner', config: { mode: 'merged' } },
          { name: 'generator', agent: 'generator', config: { mode: 'fast' } },
          { name: 'validator', agent: 'validator', config: {} }
        ],
        is_default: false
      },
      {
        id: 'standard',
        name: ' 标准模式 (~150 秒)',
        description: '完整 4 步流程，适合大多数知识点',
        steps: [
          { name: 'planner', agent: 'planner', config: {} },
          { name: 'retriever', agent: 'retriever', config: {} },
          { name: 'generator', agent: 'generator', config: {} },
          { name: 'validator', agent: 'validator', config: {} }
        ],
        is_default: true
      },
      {
        id: 'deep',
        name: '🔬 深度模式 (~200 秒)',
        description: '完整流程 + 多次验证 (最多 5 次重试)，适合复杂知识点',
        steps: [
          { name: 'planner', agent: 'planner', config: {} },
          { name: 'retriever', agent: 'retriever', config: {} },
          { name: 'generator', agent: 'generator', config: {} },
          { name: 'validator', agent: 'validator', config: { maxRetries: 5 } }
        ],
        is_default: false
      }
    ];
  }
  
  render() {
    const html = `
      <div class="workflow-selector">
        <label class="workflow-label">执行方案</label>
        <select id="workflowSelect" class="workflow-select">
          ${this.workflows.map(w => `
            <option value="${w.id}" ${w.is_default ? 'selected' : ''}>
              ${w.name} - ${w.description}
            </option>
          `).join('')}
        </select>
        <div class="workflow-steps" id="workflowSteps">
          ${this._renderSteps(this.workflows.find(w => w.is_default) || this.workflows[0])}
        </div>
      </div>
    `;
    
    this.container.innerHTML = html;
    
    // Bind event
    const select = document.getElementById('workflowSelect');
    if (select) {
      select.addEventListener('change', (e) => {
        this.select(e.target.value);
      });
    }
  }
  
  _renderSteps(workflow) {
    if (!workflow) return '';
    
    return `
      <div class="steps-preview">
        <div class="steps-title">执行步骤：</div>
        <div class="steps-flow">
          ${workflow.steps.map((step, i) => `
            <span class="step-badge">${this._getStepIcon(step.name)} ${step.name}</span>
            ${i < workflow.steps.length - 1 ? '<span class="step-arrow">→</span>' : ''}
          `).join('')}
        </div>
        <div class="steps-description">${workflow.description}</div>
      </div>
    `;
  }
  
  _getStepIcon(stepName) {
    const icons = {
      planner: '📋',
      planner_retriever: '📋🔍',
      retriever: '🔍',
      generator: '✍️',
      validator: '✅',
      reviewer: '👁️'
    };
    return icons[stepName] || '⚙️';
  }
  
  select(workflowId) {
    const workflow = this.workflows.find(w => w.id === workflowId);
    if (!workflow) return;
    
    this.selected = workflow;
    
    // Update UI
    const stepsDiv = document.getElementById('workflowSteps');
    if (stepsDiv) {
      stepsDiv.innerHTML = this._renderSteps(workflow);
    }
    
    // Call callback
    if (this.options.onSelect) {
      this.options.onSelect(workflow);
    }
  }
  
  getSelected() {
    return this.selected;
  }
  
  getSelectedConfig() {
    if (!this.selected) return null;
    
    return {
      steps: this.selected.steps.map(step => ({
        name: step.name,
        agent: step.agent,
        config: step.config || {}
      }))
    };
  }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WorkflowSelector;
}
