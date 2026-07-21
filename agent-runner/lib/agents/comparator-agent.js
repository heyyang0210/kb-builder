const BaseAgent = require('./base-agent');
const logger = require('../logger');

class ComparatorAgent extends BaseAgent {
  constructor(config = {}) {
    super('comparator', '对比分析 Oracle 与 YashanDB 差异', { ...config, temperature: 0.4 });
  }

  getOutputFormat() {
    return 'markdown';
  }

  validateInput(input) {
    if (!input.executionPlan) {
      throw new Error('executionPlan is required');
    }
    return true;
  }

  buildPrompt(input, stepConfig) {
    const plan = input.executionPlan;
    const kp = plan.knowledge_point || {};
    const refs = input.references || '无额外参考资料';

    const systemPrompt = `你是 Oracle 与 YashanDB 兼容性对比分析专家。

你的任务是对比分析 Oracle 和 YashanDB 在特定特性上的差异，生成结构化的对比分析报告。

## 输出要求

1. **语法对比**：列出 Oracle 和 YashanDB 的语法差异，用代码块展示
2. **行为差异**：说明两者在运行时行为上的不同
3. **迁移建议**：给出从 Oracle 迁移到 YashanDB 时的注意事项和改造方案
4. **兼容性等级**：标注兼容程度（完全兼容 / 部分兼容 / 不兼容 / 需改造）

## 格式要求

使用 Markdown 表格进行对比展示，SQL 示例用 \`\`\`sql 代码块。`;

    const userPrompt = `## 知识点信息
- 名称: ${kp.name || 'N/A'}
- 类型: ${kp.type || '兼容性差异'}
- 描述: ${kp.description || 'N/A'}
- 目标数据库: ${kp.target_db || 'Oracle'}

## 执行计划中的文档结构
${(plan.document_structure?.sections || []).map((s, i) =>
  `${i + 1}. ${s.name} - ${s.description || ''}`
).join('\n')}

请基于以上信息，生成 Oracle 与 YashanDB 的对比分析报告。`;

    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];
  }

  parseResponse(response) {
    return {
      comparison: response.content,
      usage: response.usage
    };
  }
}

module.exports = ComparatorAgent;
