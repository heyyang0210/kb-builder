const fs = require('fs');
const path = require('path');
const logger = require('../logger');

/**
 * 质量门禁配置
 */
const DEFAULT_QUALITY_CONFIG = {
  keyword_extraction: {
    min_base_queries: 1,
    max_expanded_queries: 10,
    reject_patterns: [/[A-Z]{1}[^A-Z]{0,2}[A-Z]{1}/] // 匹配类似 "C高可用R" 的垃圾词
  },
  mcp_query: {
    min_success_rate: 0.5,
    min_content_length: 500,
    max_retries: 3
  },
  document_generation: {
    min_length: 500,
    require_yaml: true,
    require_sql_examples: true,
    current_date_required: true
  },
  content_validation: {
    min_completeness_score: 0.8,
    min_accuracy_score: 0.9
  }
};

function loadQualityConfig() {
  try {
    const runtime = global.__KNOWLEDGE_PLATFORM_PROFILE_RUNTIME__;
    const configPath = runtime
      ? require('../platform-profile/runtime-profile').getResource('qualityRules', 'generation-quality').path
      : path.join(__dirname, '..', '..', 'config', 'quality-config.json');
    const configText = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(configText);
  } catch {
    return DEFAULT_QUALITY_CONFIG;
  }
}

/**
 * 质量门禁检查器基类
 */
class QualityGate {
  constructor(name, config = {}) {
    this.name = name;
    this.config = { ...DEFAULT_QUALITY_CONFIG[name], ...config };
  }

  check(result) {
    throw new Error(`${this.name}: check() must be implemented`);
  }
}

/**
 * 关键词抽取质量门禁
 */
class KeywordExtractionGate extends QualityGate {
  constructor(config = {}) {
    super('keyword_extraction', config);
  }

  check(result) {
    const issues = [];
    const { base_queries = [], expanded_queries = [] } = result;

    if (base_queries.length < this.config.min_base_queries) {
      issues.push(`基础查询词数量不足：${base_queries.length} < ${this.config.min_base_queries}`);
    }

    if (expanded_queries.length > this.config.max_expanded_queries) {
      issues.push(`扩展查询词过多：${expanded_queries.length} > ${this.config.max_expanded_queries}`);
    }

    // 检查垃圾词
    const garbageWords = expanded_queries.filter(q => 
      this.config.reject_patterns.some(pattern => pattern.test(q))
    );
    if (garbageWords.length > 0) {
      issues.push(`检测到垃圾词：${garbageWords.join(', ')}`);
    }

    return {
      passed: issues.length === 0,
      issues,
      retriable: base_queries.length === 0,
      degradable: true
    };
  }
}

/**
 * MCP 查询质量门禁
 */
class McpQueryGate extends QualityGate {
  constructor(config = {}) {
    super('mcp_query', config);
  }

  check(result) {
    const issues = [];
    const { summary = {} } = result;
    const { total = 0, success = 0 } = summary;
    const successRate = total > 0 ? success / total : 0;

    if (successRate < this.config.min_success_rate) {
      issues.push(`MCP 查询成功率过低：${(successRate * 100).toFixed(0)}% < ${(this.config.min_success_rate * 100).toFixed(0)}%`);
    }

    if (summary.total_content_length < this.config.min_content_length) {
      issues.push(`MCP 查询内容总长度不足：${summary.total_content_length} < ${this.config.min_content_length}`);
    }

    return {
      passed: issues.length === 0,
      issues,
      retriable: success === 0,
      degradable: true
    };
  }
}

/**
 * 文档生成质量门禁
 */
class DocumentGenerationGate extends QualityGate {
  constructor(config = {}) {
    super('document_generation', config);
  }

  check(result) {
    const issues = [];
    const { content = '' } = result;

    if (content.length < this.config.min_length) {
      issues.push(`文档长度不足：${content.length} < ${this.config.min_length}`);
    }

    if (this.config.require_yaml && !content.includes('```yaml')) {
      issues.push('文档缺少 YAML 元数据头');
    }

    if (this.config.require_sql_examples && !content.includes('```sql')) {
      issues.push('文档缺少 SQL 示例');
    }

    if (this.config.current_date_required) {
      const currentDate = new Date().toISOString().split('T')[0];
      if (!content.includes(currentDate)) {
        issues.push(`文档未包含当前日期：${currentDate}`);
      }
    }

    return {
      passed: issues.length === 0,
      issues,
      retriable: content.length < 100,
      degradable: true
    };
  }
}

/**
 * 内容完整性质量门禁
 */
class CompletenessGate extends QualityGate {
  constructor(config = {}) {
    super('content_validation', config);
  }

  check(result) {
    const issues = [];
    const { score = 0, missing_topics = [] } = result.completeness || {};

    if (score < this.config.min_completeness_score) {
      issues.push(`内容完整性评分过低：${score.toFixed(2)} < ${this.config.min_completeness_score}`);
    }

    if (missing_topics.length > 0) {
      issues.push(`遗漏主题：${missing_topics.join(', ')}`);
    }

    return {
      passed: issues.length === 0,
      issues,
      retriable: false,
      degradable: true
    };
  }
}

/**
 * 质量门禁工厂
 */
function createQualityGate(name, config = {}) {
  const gates = {
    keyword_extraction: KeywordExtractionGate,
    mcp_query: McpQueryGate,
    document_generation: DocumentGenerationGate,
    content_validation: CompletenessGate
  };

  const GateClass = gates[name];
  if (!GateClass) {
    throw new Error(`Unknown quality gate: ${name}`);
  }

  return new GateClass(config);
}

module.exports = {
  DEFAULT_QUALITY_CONFIG,
  loadQualityConfig,
  QualityGate,
  KeywordExtractionGate,
  McpQueryGate,
  DocumentGenerationGate,
  CompletenessGate,
  createQualityGate
};
