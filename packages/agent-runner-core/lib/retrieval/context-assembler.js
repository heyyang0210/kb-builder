/**
 * 上下文组装器 - 按维度分组组织上下文
 * 
 * v2.0 改进：
 * - P3: 支持多来源上下文组装（MCP + 设计文档 + Oracle KB + 测试用例 + 源码）
 * - 按来源标注，便于文档引用追溯
 */

const logger = require('../logger');

/**
 * 维度标签映射
 */
const DIMENSION_LABELS = {
  'syntax': '语法定义',
  'boundary': '取值范围',
  'compatibility': '兼容性',
  'error_code': '错误码',
  'parameter': '参数配置',
  'example': '使用示例',
  'concept': '概念原理',
  'mechanism': '内部机制',
  'performance': '性能优化',
  'architecture': '架构',
  'difference': '差异对比',
  'migration': '迁移适配',
  'procedure': '操作步骤',
  'monitoring': '监控诊断',
  'best_practice': '最佳实践'
};

/**
 * 来源标签映射
 */
const SOURCE_LABELS = {
  'mcp': 'YashanDB 知识库',
  'design_doc': '设计文档',
  'oracle_kb': 'Oracle 知识库',
  'test_case': '测试用例',
  'source_code': '源码参考'
};

/**
 * 格式化单个结果
 */
function formatResult(result, index) {
  const score = result.best_score ? `（相关度: ${(result.best_score * 100).toFixed(0)}%）` : '';
  const source = result.source ? ` [${SOURCE_LABELS[result.source] || result.source}]` : '';
  return `${index}. **${result.title || '未知'}**${score}${source}\n   ${result.excerpt || ''}\n   ku_name: ${result.ku_name || ''}`;
}

/**
 * 格式化维度章节
 */
function formatDimensionSection(dimension, results) {
  const label = DIMENSION_LABELS[dimension] || dimension;
  const lines = results.map((r, i) => formatResult(r, i + 1));
  
  return `### ${label}\n\n${lines.join('\n\n')}`;
}

/**
 * 格式化多来源资料章节
 */
function formatSourceSection(source, results) {
  const label = SOURCE_LABELS[source] || source;
  const lines = results.map((r, i) => {
    const title = r.title || r.name || r.file || '未知';
    const excerpt = r.excerpt || r.summary || r.content?.substring(0, 200) || '';
    const path = r.path || r.file || '';
    return `${i + 1}. **${title}**\n   ${excerpt}${path ? '\n   路径: ' + path : ''}`;
  });
  
  return `### ${label}（${results.length} 条）\n\n${lines.join('\n\n')}`;
}

/**
 * 组装上下文（v2：支持多来源）
 */
function assemble(groupedResults, multiSourceResults, knowledgePoint, dimensions) {
  const parts = [];
  
  // 1. MCP 知识库结果 - 按维度分组
  if (groupedResults && Object.keys(groupedResults).length > 0) {
    parts.push('## YashanDB 知识库检索结果\n');
    
    const requiredDims = dimensions?.required || Object.keys(groupedResults);
    for (const dim of requiredDims) {
      const results = groupedResults[dim] || [];
      if (results.length > 0) {
        parts.push(formatDimensionSection(dim, results));
      }
    }
    
    const optionalDims = dimensions?.optional || [];
    for (const dim of optionalDims) {
      const results = groupedResults[dim] || [];
      if (results.length > 0) {
        parts.push(formatDimensionSection(dim, results));
      }
    }
  }
  
  // 2. 多来源结果（设计文档、Oracle KB、测试用例、源码）
  if (multiSourceResults) {
    const sourceOrder = ['design_doc', 'oracle_kb', 'test_case', 'source_code'];
    
    for (const source of sourceOrder) {
      const results = multiSourceResults[source];
      if (results && results.length > 0) {
        parts.push(`## ${SOURCE_LABELS[source] || source}\n`);
        parts.push(formatSourceSection(source, results));
      }
    }
  }
  
  const context = parts.join('\n\n---\n\n');
  
  logger.info('[context-assembler] Context assembled', {
    totalChars: context.length,
    mcpDimensions: groupedResults ? Object.keys(groupedResults).length : 0,
    mcpResults: groupedResults ? Object.values(groupedResults).reduce((s, arr) => s + arr.length, 0) : 0,
    multiSources: multiSourceResults ? Object.keys(multiSourceResults).filter(k => multiSourceResults[k]?.length > 0).length : 0
  });
  
  return context;
}

/**
 * 将 RetrievalStrategy 的结果转换为多来源格式
 */
function convertRetrievalResults(retrievalResults) {
  const multiSource = {};
  
  if (retrievalResults.designDocs?.files?.length > 0) {
    multiSource.design_doc = retrievalResults.designDocs.files.map(f => ({
      title: f.name || f.title || f.file,
      path: f.path || f.file,
      excerpt: f.summary || f.content?.substring(0, 200) || '',
      source: 'design_doc'
    }));
  }
  
  if (retrievalResults.oracleKb?.files?.length > 0) {
    multiSource.oracle_kb = retrievalResults.oracleKb.files.map(f => ({
      title: f.name || f.title || f.file,
      path: f.path || f.file,
      excerpt: f.summary || f.content?.substring(0, 200) || '',
      source: 'oracle_kb'
    }));
  }
  
  if (retrievalResults.testCases?.files?.length > 0) {
    multiSource.test_case = retrievalResults.testCases.files.map(f => ({
      title: f.name || f.title || f.file,
      path: f.path || f.file,
      excerpt: f.summary || f.content?.substring(0, 200) || '',
      source: 'test_case'
    }));
  }
  
  if (retrievalResults.sourceCode?.files?.length > 0) {
    multiSource.source_code = retrievalResults.sourceCode.files.map(f => ({
      title: f.name || f.title || f.file,
      path: f.path || f.file,
      excerpt: f.summary || f.content?.substring(0, 200) || '',
      source: 'source_code'
    }));
  }
  
  return multiSource;
}

module.exports = {
  DIMENSION_LABELS,
  SOURCE_LABELS,
  formatResult,
  formatDimensionSection,
  formatSourceSection,
  assemble,
  convertRetrievalResults
};
