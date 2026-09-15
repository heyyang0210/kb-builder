const BaseAgent = require('./base-agent');
const logger = require('../logger');
const {
  buildMcpQueries,
  unique
} = require('../retrieval-query-builder');
const queryPlanner = require('../retrieval/query-planner');

class PlannerAgent extends BaseAgent {
  constructor(config = {}) {
    super('planner', '规划执行计划', { ...config, temperature: 0.3 });
  }

  getOutputFormat() {
    return 'json';
  }

  validateInput(input) {
    if (!input.knowledgePoint && !input.knowledge_point) {
      throw new Error('knowledgePoint is required');
    }
    const kp = input.knowledgePoint || input.knowledge_point;
    if (!kp || !kp.name) {
      throw new Error('knowledgePoint.name is required');
    }
    return true;
  }

  buildPrompt(input, stepConfig) {
    const template = this.loadPromptTemplate('planner.md');
    const kp = input.knowledgePoint;
    const isMerged = stepConfig?.mode === 'merged';

    const kpInfo = `
## 知识点信息

- ID: ${kp.id || 'N/A'}
- 名称: ${kp.name}
- 类型: ${kp.type || '通用基础'}
- 描述: ${kp.description || '无描述'}
- 所属部分: ${kp.part || 'N/A'}
- 所属章节: ${kp.chapter || 'N/A'}
- 目标数据库: ${kp.target_db || 'N/A'}
- 难度级别: ${kp.level || '★★'}
`;

    const frozenContent = require('../template-generation').frozenTemplateContent(input.templateSnapshot);
    const templateInfo = frozenContent !== null
      ? `\n## 文档模板（任务固定版本）\n${frozenContent}`
      : input.template
      ? `\n## 文档模板\n模板路径：${input.template}\n请参考模板结构来规划文档。`
      : '';

    // 新增：如果有前端生成的提示词，作为额外上下文
    const promptContext = input.prompt
      ? `

## 前端生成的提示词（参考）
以下是前端用户已生成的提示词，包含 Skill 文件、模板、参考资料路径等信息：

\`\`\`markdown
${input.prompt}
\`\`\`

请基于以上提示词中的信息，生成执行计划。`
      : '';

    if (isMerged) {
      // 合并模式：同时输出文档结构和检索计划
      const systemPrompt = template || '请根据知识点信息同时生成文档结构和检索计划 JSON。';
      const userPrompt = `${systemPrompt}\n\n${kpInfo}${templateInfo}${promptContext}

## 输出要求

请同时输出以下内容：

1. **文档结构** (document_structure)：章节划分、每章节要点
2. **检索计划** (retrieval_plan)：需要检索的关键词、参考文件列表

## 输出格式

\`\`\`json
{
  "document_structure": {
    "title": "文档标题",
    "sections": [
      { "name": "章节名", "description": "章节描述", "required": true }
    ]
  },
  "retrieval_plan": {
    "mcp_queries": ["关键词 1", "关键词 2"],
    "reference_files": ["文件路径 1", "文件路径 2"]
  },
  "validation_criteria": {
    "required_sections": ["必须章节 1"],
    "sql_verification": false,
    "min_length": 500,
    "max_length": 3000
  }
}
\`\`\``;

      return [
      { role: 'system', content: `你是 ${this.getEnterpriseName()} 知识库文档规划专家，负责同时生成文档结构和检索计划。` },
        { role: 'user', content: userPrompt }
      ];
    }

    // 原有 planner prompt
    const systemPrompt = template || '请根据知识点信息生成执行计划 JSON。';
    const userPrompt = `${systemPrompt}\n\n${kpInfo}${templateInfo}${promptContext}`;

    return [
      { role: 'system', content: `你是 ${this.getEnterpriseName()} 知识库文档规划专家，负责生成结构化的执行计划。` },
      { role: 'user', content: userPrompt }
    ];
  }

  async parseResponse(response, input) {
    const isMerged = this.config.mode === 'merged';
    let plan;

    try {
      if (response.parsed && typeof response.parsed === 'object') {
        plan = response.parsed;
      } else {
        plan = JSON.parse(response.content);
      }
    } catch (err) {
      logger.warn(`[planner] JSON parse failed: ${err.message}`);
      plan = {};
    }

    this._ensurePlanDefaults(plan, input);
    await this._applyPromptRetrievalFallback(plan, input);
    if (require('../template-generation').frozenTemplateContent(input.templateSnapshot) !== null) {
      // A model or legacy prompt can still propose a template file. Never retrieve it
      // alongside a frozen database body, otherwise edits would leak into old tasks.
      plan.retrieval_plan.reference_files = plan.retrieval_plan.reference_files.filter(reference => !/(?:^|\/)templates\//.test(String(reference)));
    }

    if (isMerged) {
      // 合并模式：确保包含 document_structure 和 retrieval_plan
      logger.info(`[planner] Merged plan generated: ${plan.document_structure.sections?.length || 0} sections, ${plan.retrieval_plan.mcp_queries?.length || 0} queries`);
      return plan;
    }

    logger.info(`[planner] Plan generated: ${plan.document_structure.sections?.length || 0} sections`);
    return plan;
  }

  _ensurePlanDefaults(plan, input) {
    const kp = input.knowledgePoint || input.knowledge_point || {};

    if (!plan.knowledge_point) {
      plan.knowledge_point = {
        id: kp.id,
        name: kp.name,
        type: kp.type
      };
    }

    if (!plan.document_structure) {
      plan.document_structure = { title: kp.name || '未命名文档', sections: [] };
    }

    if (!Array.isArray(plan.document_structure.sections) || plan.document_structure.sections.length === 0) {
      plan.document_structure.sections = this._buildDefaultSections(kp);
    }

    if (!plan.retrieval_plan) {
      plan.retrieval_plan = { mcp_queries: [], reference_files: [] };
    }

    if (!Array.isArray(plan.retrieval_plan.mcp_queries)) {
      plan.retrieval_plan.mcp_queries = [];
    }

    if (!Array.isArray(plan.retrieval_plan.reference_files)) {
      plan.retrieval_plan.reference_files = [];
    }

    if (!plan.validation_criteria) {
      plan.validation_criteria = { required_sections: [], sql_verification: false };
    }
  }

  _buildDefaultSections(kp) {
    const names = kp.type?.includes('兼容性')
      ? ['概述与兼容性等级', '类型映射对比', '语法与行为差异', '迁移建议与验证']
      : ['概述', '核心概念', '使用方法', '注意事项'];

    return names.map(name => ({
      name,
      description: `${kp.name || '知识点'} - ${name}`,
      required: true
    }));
  }

  async _applyPromptRetrievalFallback(plan, input) {
    const fallback = await this._extractRetrievalPlanFromPrompt(input.prompt || '');
    const kpQueries = await this._buildKnowledgePointQueries(input.knowledgePoint || input.knowledge_point || {});

    if (plan.retrieval_plan.mcp_queries.length === 0) {
      plan.retrieval_plan.mcp_queries = unique([...fallback.mcp_queries, ...kpQueries]);
    }

    if (plan.retrieval_plan.reference_files.length === 0) {
      plan.retrieval_plan.reference_files = fallback.reference_files;
    }

    if (fallback.mcp_queries.length > 0 || fallback.reference_files.length > 0) {
      logger.info('[planner] Retrieval fallback applied', {
        mcp_queries: plan.retrieval_plan.mcp_queries.length,
        reference_files: plan.retrieval_plan.reference_files.length
      });
    }
  }

  async _extractRetrievalPlanFromPrompt(prompt) {
    if (!prompt) {
      return { mcp_queries: [], reference_files: [] };
    }

    const referencePathPattern = /(?:\.\.\/)?(?:skills|templates|config|references\/(?:oracle-kb|design-docs|test-cases|source))\/[^\s`，。；;、)）]+\.md/g;
    const scriptPattern = /(?:\.\.\/)?scripts\/pre-check-references\.sh/g;
    const referenceFiles = unique([
      ...(prompt.match(referencePathPattern) || []),
      ...(prompt.match(scriptPattern) || [])
    ]);

    return {
      mcp_queries: await buildMcpQueries({ prompt }),
      reference_files: referenceFiles
    };
  }

  async _buildKnowledgePointQueries(kp) {
    // 使用新的 query-planner 生成意图化查询词
    const plan = queryPlanner.generateQueries(kp, { maxQueries: 6 });
    const reviewed = queryPlanner.reviewQueries(plan.queries, kp);
    
    logger.info('[planner] Knowledge point queries generated', {
      type: kp.type,
      coreTerm: queryPlanner.extractCoreTerm(kp),
      dimensions: plan.dimensions,
      queryCount: reviewed.queries.length
    });
    
    return reviewed.queries;
  }

  _unique(items) {
    return unique(items);
  }
}

module.exports = PlannerAgent;
