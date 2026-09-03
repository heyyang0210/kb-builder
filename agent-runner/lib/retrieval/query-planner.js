/**
 * 查询规划器 - 意图化查询词生成
 * 
 * 根据知识点类型确定检索维度，为每个维度生成意图化查询词
 */

const logger = require('../logger');

/**
 * 知识点类型 → 检索维度映射
 */
const RETRIEVAL_DIMENSIONS = {
  'SQL/开发参考': {
    required: ['syntax', 'boundary', 'compatibility'],
    optional: ['error_code', 'parameter', 'example']
  },
  '理论机制': {
    required: ['concept', 'mechanism'],
    optional: ['parameter', 'error_code', 'performance']
  },
  '实战调优': {
    required: ['parameter', 'best_practice'],
    optional: ['error_code', 'monitoring']
  },
  '架构对比': {
    required: ['architecture', 'compatibility'],
    optional: ['parameter', 'migration']
  },
  '运维SOP': {
    required: ['procedure', 'parameter'],
    optional: ['error_code', 'monitoring']
  },
  '兼容性差异': {
    required: ['compatibility', 'difference', 'migration'],
    optional: ['error_code', 'parameter']
  },
  '通用基础': {
    required: ['concept', 'syntax'],
    optional: ['example', 'parameter']
  }
};

/**
 * 维度 → 查询模板
 */
const QUERY_TEMPLATES = {
  'syntax':        (kp) => `${kp.coreTerm} 语法定义 使用规则 格式`,
  'boundary':      (kp) => `${kp.coreTerm} 取值范围 精度 长度限制 存储大小`,
  'compatibility': (kp) => `${kp.coreTerm} ${kp.targetDb} 兼容性 差异 类型映射 等价类型`,
  'error_code':    (kp) => `${kp.coreTerm} 错误码 报错 异常 YAS-`,
  'parameter':     (kp) => `${kp.coreTerm} 参数 配置 初始化参数 系统参数`,
  'example':       (kp) => `${kp.coreTerm} 使用示例 用法 DDL`,
  'concept':       (kp) => `${kp.coreTerm} 概念 原理 定义`,
  'mechanism':     (kp) => `${kp.coreTerm} 内部实现 工作原理 机制`,
  'performance':   (kp) => `${kp.coreTerm} 性能 优化 影响`,
  'architecture':  (kp) => `${kp.coreTerm} 架构 结构 组件`,
  'difference':    (kp) => `${kp.coreTerm} 与 ${kp.targetDb} 差异 不同 区别`,
  'migration':     (kp) => `${kp.coreTerm} 迁移 适配 转换规则`,
  'procedure':     (kp) => `${kp.coreTerm} 操作步骤 流程 命令`,
  'monitoring':    (kp) => `${kp.coreTerm} 监控 诊断 查看 日志`,
  'best_practice': (kp) => `${kp.coreTerm} 最佳实践 推荐用法 注意事项`
};

/**
 * 从知识点中提取核心术语
 */
function extractCoreTerm(knowledgePoint) {
  const name = knowledgePoint.name || '';
  
  let coreTerm = name
    .replace(/^\d+\.\d+(\.\d+)?\s*/, '')
    .replace(/\s*→\s*/g, ' ')
    .replace(/[`'"]/g, '')
    .replace(/[：:]/g, ' ')
    .replace(/\//g, ' ')
    .trim();
  
  return coreTerm;
}

/**
 * 生成意图化查询词
 */
function generateQueries(knowledgePoint, options = {}) {
  const { maxQueries = 6 } = options;
  
  const coreTerm = extractCoreTerm(knowledgePoint);
  const type = knowledgePoint.type || '通用基础';
  const targetDb = knowledgePoint.target_db || 'Oracle';
  
  const kp = { coreTerm, targetDb, ...knowledgePoint };
  
  const dimensions = RETRIEVAL_DIMENSIONS[type] || RETRIEVAL_DIMENSIONS['通用基础'];
  const allDimensions = [...dimensions.required, ...dimensions.optional];
  
  const queries = [];
  const dimensionMap = {};
  
  for (const dim of allDimensions.slice(0, maxQueries)) {
    const template = QUERY_TEMPLATES[dim];
    if (template) {
      const query = template(kp);
      queries.push(query);
      dimensionMap[query] = dim;
    }
  }
  
  logger.info('[query-planner] Generated queries', {
    type,
    coreTerm,
    dimensions: allDimensions.slice(0, maxQueries),
    queryCount: queries.length
  });
  
  return {
    queries,
    dimensions: allDimensions.slice(0, maxQueries),
    dimensionMap
  };
}

/**
 * 查询词质量检查
 */
function reviewQueries(queries, knowledgePoint) {
  const coreTerm = extractCoreTerm(knowledgePoint);
  const reviewed = [];
  const dropped = [];
  
  for (const query of queries) {
    let fixed = query;
    let valid = true;
    
    // 规则1：无括号碎片
    const open = (fixed.match(/[（(]/g) || []).length;
    const close = (fixed.match(/[）)]/g) || []).length;
    if (open !== close) {
      fixed = fixed.replace(/[（(][^）)]*$/, '').replace(/^[^（(]*[）)]/, '');
    }
    
    // 规则2：最小长度
    if (fixed.length < 10) {
      fixed = `${coreTerm} ${fixed}`.trim();
    }
    
    // 规则3：包含有意义的内容
    if (fixed.length < 4) {
      valid = false;
      dropped.push({ query, reason: 'too_short' });
    }
    
    if (valid) {
      reviewed.push(fixed.trim());
    }
  }
  
  return { queries: reviewed, dropped };
}

module.exports = {
  RETRIEVAL_DIMENSIONS,
  QUERY_TEMPLATES,
  extractCoreTerm,
  generateQueries,
  reviewQueries
};
