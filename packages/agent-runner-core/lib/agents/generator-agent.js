const BaseAgent = require('./base-agent');
const logger = require('../logger');

class GeneratorAgent extends BaseAgent {
  constructor(config = {}) {
    super('generator', '生成文档内容', { ...config, temperature: 0.7 });
  }

  validateInput(input) {
    if (!input.executionPlan) {
      throw new Error('executionPlan is required');
    }
    return true;
  }

  buildPrompt(input, stepConfig) {
    const template = this.loadPromptTemplate('generator.md');
    const plan = input.executionPlan;
    const refs = input.references || '无额外参考资料';

    const planInfo = `
## 执行计划

### 文档标题
${plan.document_structure?.title || plan.knowledge_point?.name || '未命名文档'}

### 文档结构
${(plan.document_structure?.sections || []).map((s, i) =>
  `${i + 1}. ${s.name}${s.required ? ' (必须)' : ''} - ${s.description || ''}`
).join('\n')}

### 知识点信息
- 名称: ${plan.knowledge_point?.name || 'N/A'}
- 类型: ${plan.knowledge_point?.type || 'N/A'}
- 目标数据库: ${plan.knowledge_point?.target_db || 'N/A'}

### 验证标准
- 必须章节: ${(plan.validation_criteria?.required_sections || []).join(', ') || '无'}
- SQL 验证: ${plan.validation_criteria?.sql_verification ? '是' : '否'}
- 长度范围: ${plan.validation_criteria?.min_length || 0} ~ ${plan.validation_criteria?.max_length || '不限'} 字
`;

    const feedbackSection = input.feedback
      ? `\n## 上一版文档的验证反馈\n\n以下是质量审核提出的问题和改进建议，请务必在本次生成中修正：\n\n${input.feedback}`
      : '';

    const comparisonSection = input.comparison
      ? `\n## 对比分析参考\n\n${input.comparison}`
      : '';

    const systemPrompt = template || '请根据执行计划和参考资料生成完整的知识库文档。';

    const retryHint = input.feedback
      ? '\n\n注意：这是对上一版文档的修改重试，请重点解决反馈中提到的问题，保持其他部分的质量。'
      : '';

    return [
      { role: 'system', content: `你是 ${this.getEnterpriseName()} 知识库文档撰写专家，负责生成高质量的技术文档。` },
      { role: 'user', content: `${systemPrompt}${retryHint}\n\n${planInfo}${comparisonSection}\n## 参考资料\n\n${refs}${feedbackSection}` }
    ];
  }

  parseResponse(response) {
    return {
      document: response.content,
      usage: response.usage
    };
  }
}

module.exports = GeneratorAgent;
