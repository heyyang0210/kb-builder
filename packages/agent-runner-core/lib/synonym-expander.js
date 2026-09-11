const LLMClient = require('./llm-client');
const configManager = require('./config-manager');
const logger = require('./logger');
const { getSynonymGroups } = require('./retrieval-query-builder');

/**
 * 固定提示词：基于数据库领域知识的同义词扩展
 * 
 * 设计原则：
 * 1. 使用 LLM 理解数据库领域语义，而非简单字符串匹配
 * 2. 固定提示词确保稳定性
 * 3. 遵循词边界匹配，不破坏专有名词（如 CHAR、VARCHAR2）
 * 4. 同义词组作为参考，LLM 判断是否适用
 */
const SYSTEM_PROMPT = `你是 YashanDB 知识库查询词扩展专家。你的任务是基于数据库领域知识，对用户的原始输入进行深度语义分析，为 MCP 检索生成高质量的多维度扩展查询。

## 核心任务

对每个原始查询词，从以下维度进行深度分析和扩展：

### 1. 同义词扩展
- 找出数据库领域中的同义表达、别名、缩写
- 参考同义词组，但不要被其限制

### 2. 上下位概念扩展
- 上位概念：该词属于什么更大的类别？
- 下位概念：该词包含哪些具体的子类型/子特性？

### 3. 关联概念扩展
- 该概念在数据库操作中通常涉及哪些相关操作？
- 例如：数据类型 → 类型转换、类型映射、DDL定义
- 例如：NUMBER精度 → 精度定义、标度规则、存储大小

### 4. 实际使用场景扩展
- 用户在什么场景下会查询这个概念？
- 例如：NUMBER(p,s) → 建表语句中的数值类型定义、INSERT时的精度处理

## 词边界匹配原则

1. **保护专有名词**：SQL 类型名、关键字应保持完整
   - CHAR、VARCHAR2、NUMBER、NVARCHAR2 等不应被拆分
   - NUMBER(p,s) 应作为一个整体概念处理

2. **括号内内容是参数的不拆分**
   - NUMBER(p,s) 中的 p,s 是参数说明，不应单独提取
   - 但可以基于整体概念扩展出"NUMBER精度"、"NUMBER标度"等查询

## 同义词组参考

{SYNONYM_GROUPS}

## 输出格式

返回 JSON 数组，每个元素包含：
- original: 原始查询词
- analysis: 对原始查询的语义分析（1-2句话）
- expanded: 扩展后的查询词数组（包含原始词，5-10个扩展词）

示例：
输入：["数值类型：NUMBER(p,s)", "INTEGER"]
输出：
[
  {
    "original": "数值类型：NUMBER(p,s)",
    "analysis": "Oracle数值类型的精度和标度定义，涉及NUMBER类型及其与标准SQL类型的映射关系",
    "expanded": ["数值类型：NUMBER(p,s)", "NUMBER类型精度标度", "NUMBER数据类型定义", "数值类型映射", "DECIMAL NUMERIC类型", "数据类型转换", "NUMBER存储规则"]
  },
  {
    "original": "INTEGER",
    "analysis": "整数类型，在Oracle中是NUMBER(38)的同义词，YashanDB有原生定长整数",
    "expanded": ["INTEGER", "整数类型", "INT BIGINT类型", "NUMBER(38)整数", "整型数据定义"]
  }
]

注意：
- 每个原始词扩展出 5-10 个有意义的查询词
- 扩展词应该是 MCP 知识库中可能存在的知识点标题或关键概念
- 不要生成过于宽泛或无意义的查询词
- 返回纯 JSON，不要解释`;

const USER_PROMPT_TEMPLATE = `请对以下数据库领域查询词进行深度语义分析，并生成多维度扩展查询：

{QUERIES}

请从同义词、上下位概念、关联概念、使用场景等维度进行扩展。
返回 JSON 数组。`;

class SynonymExpander {
  constructor(config = {}) {
    this.config = config;
    this.llmClient = null;
  }

  async init() {
    if (!this.llmClient) {
      const modelConfig = await configManager.getModelConfig() || {};
      this.llmClient = new LLMClient(modelConfig);
    }
  }

  /**
   * 使用 LLM 扩展同义词
   * @param {string[]} queries - 原始查询词数组
   * @returns {string[]} 扩展后的查询词数组（去重）
   */
  async expand(queries) {
    if (!queries || queries.length === 0) {
      return [];
    }

    await this.init();

    const synonymGroups = getSynonymGroups();
    const groupsText = synonymGroups
      .map((group, idx) => `${idx + 1}. [${group.join(', ')}]`)
      .join('\n');

    const systemPrompt = SYSTEM_PROMPT.replace('{SYNONYM_GROUPS}', groupsText);
    const userPrompt = USER_PROMPT_TEMPLATE.replace('{QUERIES}', JSON.stringify(queries));

    try {
      const response = await this.llmClient.chatJSON([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], {
        temperature: 0.5,
        max_tokens: 4000
      });

      const result = response.parsed;
      if (!Array.isArray(result)) {
        logger.warn('[synonym-expander] LLM returned non-array, using fallback');
        return this._fallbackExpand(queries);
      }

      const expanded = [];
      result.forEach(item => {
        if (item.expanded && Array.isArray(item.expanded)) {
          expanded.push(...item.expanded);
        }
      });

      const unique = Array.from(new Set(expanded.map(q => String(q).trim()).filter(Boolean)));
      logger.info('[synonym-expander] Expanded queries', { 
        original: queries.length, 
        expanded: unique.length 
      });

      return unique;
    } catch (err) {
      logger.error(`[synonym-expander] LLM expansion failed: ${err.message}`);
      return this._fallbackExpand(queries);
    }
  }

  /**
   * 兜底方案：使用原始查询词（不做扩展）
   */
  _fallbackExpand(queries) {
    logger.warn('[synonym-expander] Using fallback (no expansion)');
    return queries.map(q => String(q).trim()).filter(Boolean);
  }
}

module.exports = SynonymExpander;
