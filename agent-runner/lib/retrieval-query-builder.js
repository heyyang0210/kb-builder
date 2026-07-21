const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const PRODUCT_TERMS = [
  /YashanDB/ig,
  /Yashan\s*数据库/ig,
  /崖山\s*DB/ig,
  /崖山\s*数据库/ig
];

// 默认同义词组（当配置文件不可用时的兜底）
const DEFAULT_SYNONYM_GROUPS = [
  ['高可用', 'HA', '主备', '主从', '故障切换', '容灾'],
  ['备份', '恢复', '还原', '归档', '增量备份', '全量备份'],
  ['性能', '优化', '调优', '慢 SQL', '执行计划'],
  ['数据类型', '类型映射', '数值类型', '精度', '标度'],
  ['事务', '隔离级别', '一致性', '锁', '并发控制']
];

// 从配置文件加载同义词组
function loadSynonymGroups() {
  try {
    const configPath = path.join(__dirname, '..', 'config', 'synonym-config.json');
    const configText = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configText);
    if (Array.isArray(config.categories)) {
      return config.categories
        .filter(cat => Array.isArray(cat.synonyms) && cat.synonyms.length >= 2)
        .map(cat => cat.synonyms);
    }
  } catch (err) {
    // 配置文件不存在或解析失败，使用默认值
  }
  return DEFAULT_SYNONYM_GROUPS;
}

// 模块加载时读取一次，后续通过 reloadSynonymGroups() 刷新
let _synonymGroups = loadSynonymGroups();

function reloadSynonymGroups() {
  _synonymGroups = loadSynonymGroups();
  return _synonymGroups;
}

function getSynonymGroups() {
  return _synonymGroups;
}

function unique(items) {
  return Array.from(new Set((items || []).map(item => String(item).trim()).filter(Boolean)));
}

function stripProductTerms(value) {
  let result = String(value || '');
  PRODUCT_TERMS.forEach(pattern => {
    result = result.replace(pattern, ' ');
  });
  return result;
}

function normalizeQuery(value) {
  return stripProductTerms(value)
    .replace(/[`"'""'']+/g, '')
    .replace(/[，。；;、,]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 智能拆分查询列表：保护括号、引号内的内容不被分隔符拆分
 *
 * 例如 "NUMBER(p,s)、INTEGER" 拆成 ["NUMBER(p,s)", "INTEGER"]
 * 而不是 ["NUMBER(p", "s)", "INTEGER"]
 */
function splitQueryList(value) {
  const text = String(value || '');
  const parts = [];
  let current = '';
  let depth = 0;
  let inQuote = false;
  let quoteChar = '';

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    // 处理引号（英文和中文引号）
    const quoteChars = ['"', "'", '`', '“', '”', '‘', '’'];
    if (quoteChars.includes(ch) && (i === 0 || text[i - 1] !== '\\')) {
      if (!inQuote) {
        inQuote = true;
        quoteChar = ch;
      } else if (ch === quoteChar) {
        inQuote = false;
        quoteChar = '';
      }
      current += ch;
      continue;
    }

    if (inQuote) {
      current += ch;
      continue;
    }

    // 处理括号深度
    if ('([（{'.includes(ch)) {
      depth++;
      current += ch;
      continue;
    }
    if (')])）}'.includes(ch)) {
      depth = Math.max(0, depth - 1);
      current += ch;
      continue;
    }

    // 在括号内不拆分
    if (depth > 0) {
      current += ch;
      continue;
    }

    // 检查是否是分隔符（括号外）
    if (/[、,，;；\n]/.test(ch)) {
      const normalized = normalizeQuery(current);
      if (normalized) {
        parts.push(normalized);
      }
      current = '';
      continue;
    }

    current += ch;
  }

  // 处理最后一段
  const normalized = normalizeQuery(current);
  if (normalized) {
    parts.push(normalized);
  }

  return parts;
}

function extractPromptQueries(prompt = '') {
  const text = String(prompt || '');
  const queries = [];

  const keywordMatch = text.match(/关键词[:：]([\s\S]*?)(?:。|\n|必须|输出|$)/);
  if (keywordMatch) {
    queries.push(...splitQueryList(keywordMatch[1]));
  }

  const explicitQueryMatches = text.match(/(?:MCP\s*查询|mcp\s*查询)[:：]\s*([^\n。]+)/g) || [];
  explicitQueryMatches.forEach(match => {
    const queryText = match.replace(/(?:MCP\s*查询|mcp\s*查询)[:：]/g, '');
    queries.push(...splitQueryList(queryText));
  });

  const jsonQueryMatches = [...text.matchAll(/["']mcp_query["']\s*:\s*["']([^"']+)["']/gi)];
  jsonQueryMatches.forEach(match => {
    queries.push(...splitQueryList(match[1]));
  });

  return unique(queries);
}

function extractKnowledgePointQueries(knowledgePoint = {}) {
  const fields = [
    knowledgePoint.name,
    knowledgePoint.type,
    knowledgePoint.description,
    knowledgePoint.chapter
  ];

  return unique(fields.map(normalizeQuery).filter(Boolean));
}

/**
 * 异步同义词扩展 - 使用 LLM 基于数据库领域知识进行扩展
 * 
 * 替代原有的简单字符串匹配方式，通过 LLM 理解语义：
 * 1. 正确识别词边界（CHAR 不匹配 HA）
 * 2. 理解数据库领域语义等价
 * 3. 保护 SQL 专有名词
 */
async function expandSynonyms(queries) {
  if (!queries || queries.length === 0) {
    return [];
  }

  try {
    const SynonymExpander = require('./synonym-expander');
    const expander = new SynonymExpander();
    return await expander.expand(queries);
  } catch (err) {
    logger.error(`[retrieval-query-builder] LLM synonym expansion failed: ${err.message}`);
    // 兜底：返回原始查询词
    return unique(queries);
  }
}

/**
 * 异步构建 MCP 查询词
 */
async function buildMcpQueries({ prompt = '', knowledgePoint = {}, maxQueries = 8 } = {}) {
  const promptQueries = extractPromptQueries(prompt);
  const baseQueries = promptQueries.length > 0
    ? promptQueries
    : extractKnowledgePointQueries(knowledgePoint);

  const expanded = await expandSynonyms(baseQueries);
  return expanded.slice(0, maxQueries);
}

module.exports = {
  PRODUCT_TERMS,
  DEFAULT_SYNONYM_GROUPS,
  loadSynonymGroups,
  reloadSynonymGroups,
  getSynonymGroups,
  unique,
  stripProductTerms,
  normalizeQuery,
  splitQueryList,
  extractPromptQueries,
  extractKnowledgePointQueries,
  expandSynonyms,
  buildMcpQueries
};
