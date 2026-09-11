const { buildMcpQueries, extractPromptQueries, extractKnowledgePointQueries } = require('../retrieval-query-builder');
const logger = require('../logger');

function unique(items) {
  return Array.from(new Set((items || []).map(item => String(item).trim()).filter(Boolean)));
}

function sanitizeFilenameBase(value) {
  return String(value || 'document')
    .replace(/\.(md|markdown)$/i, '')
    .replace(/[\/\\:*?"<>|`]/g, '_')
    .replace(/\s+/g, ' ')
    .trim() || 'document';
}

function extractYamlTitle(prompt = '') {
  const yamlMatch = String(prompt).match(/```ya?ml\s*([\s\S]*?)```/i);
  if (!yamlMatch) return '';
  const yamlText = yamlMatch[1];
  const titleMatch = yamlText.match(/^\s*(?:title|标题)\s*[:：]\s*(.+?)\s*$/mi);
  if (!titleMatch) return '';
  return titleMatch[1]
    .replace(/^['"]|['"]$/g, '')
    .replace(/\s+#.*$/, '')
    .trim();
}

function resolveOutputFilename({ prompt, filename, knowledge_point } = {}) {
  const yamlTitle = extractYamlTitle(prompt);
  const fallback = filename || knowledge_point?.name || 'document';
  return `${sanitizeFilenameBase(yamlTitle || fallback)}.md`;
}

/**
 * 智能拆分文本：保护括号、引号内的内容不被分隔符拆分
 * 
 * 例如 "NUMBER(p,s)" 不会被逗号拆成 "NUMBER(p" 和 "s)"
 * 而 "A、B(p,q)、C" 会正确拆成 ["A", "B(p,q)", "C"]
 */
function smartSplit(text, delimiters = /[\s,，、]+/) {
  const result = [];
  let current = '';
  let depth = 0; // 括号深度
  let inQuote = false;
  let quoteChar = '';

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    // 处理引号
    if ((ch === '"' || ch === "'" || ch === '`') && (i === 0 || text[i - 1] !== '\\')) {
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

    // 在引号内，直接追加
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

    // 在括号内，直接追加（不拆分）
    if (depth > 0) {
      current += ch;
      continue;
    }

    // 检查是否是分隔符
    const remaining = text.slice(i);
    const match = remaining.match(new RegExp('^' + delimiters.source));
    if (match) {
      const trimmed = current.trim();
      if (trimmed.length >= 2) {
        result.push(trimmed);
      }
      current = '';
      i += match[0].length - 1; // 跳过分隔符（for循环会+1）
      continue;
    }

    current += ch;
  }

  // 处理最后一段
  const trimmed = current.trim();
  if (trimmed.length >= 2) {
    result.push(trimmed);
  }

  return result;
}

/**
 * 从知识点信息中提取关键词
 * 
 * 使用 smartSplit 保护括号内内容不被拆分
 */
function extractKeywordsFromKnowledgePoint(knowledgePoint) {
  const keywords = [];
  if (knowledgePoint.name) {
    // 从名称中提取：移除序号、箭头等
    const name = knowledgePoint.name
      .replace(/^\d+\.\d+(\.\d+)?\s*/, '') // 移除序号如 "1.1.1 "
      .replace(/\s*→\s*/g, ' ') // 替换箭头为空格
      .replace(/[`'"]/g, '') // 移除反引号和引号
      .trim();
    keywords.push(...smartSplit(name).filter(w => w.length >= 2));
  }
  if (knowledgePoint.description && knowledgePoint.description !== knowledgePoint.name) {
    const desc = knowledgePoint.description
      .replace(/[`'"]/g, '')
      .trim();
    keywords.push(...smartSplit(desc).filter(w => w.length >= 2));
  }
  return unique(keywords);
}

/**
 * 标准化提示词：注入关键词和当前日期
 * 
 * 解决两个问题：
 * 1. 提示词中没有"关键词："标注，导致 MCP 查询词抽取为空
 * 2. 没有注入当前日期，导致 LLM 自行编造"最后更新"日期
 */
function standardizePrompt(rawPrompt, knowledgePoint) {
  const currentDate = new Date().toISOString().split('T')[0];
  const keywords = extractKeywordsFromKnowledgePoint(knowledgePoint);

  let prompt = rawPrompt;

  // 检查是否已有"关键词："标注
  const hasKeywordSection = prompt.includes('关键词：') || prompt.includes('关键词:');
  
  if (!hasKeywordSection && keywords.length > 0) {
    // 注入关键词和日期
    const injection = `\n\n## 关键词\n关键词：${keywords.join('、')}\n\n## 当前日期\n${currentDate}\n`;
    // 在"## 知识点信息"之前插入
    if (prompt.includes('## 知识点信息')) {
      prompt = prompt.replace('## 知识点信息', injection + '\n## 知识点信息');
    } else {
      prompt += injection;
    }
    logger.info('[prompt-parser] Injected keywords and date', { keywords, currentDate });
  } else if (hasKeywordSection) {
    // 已有标注，只追加日期
    if (!prompt.includes('当前日期')) {
      prompt += `\n\n## 当前日期\n${currentDate}\n`;
      logger.info('[prompt-parser] Injected current date', { currentDate });
    }
  } else {
    // 无关键词也无标注，只注入日期
    prompt += `\n\n## 当前日期\n${currentDate}\n`;
    logger.info('[prompt-parser] Injected current date (no keywords)', { currentDate });
  }

  return prompt;
}

/**
 * 异步提取直写模式的参考资料
 * 
 * 使用 LLM 进行同义词扩展，确保查询词质量
 */
async function extractDirectReferences(prompt, templatePath, knowledgePoint) {
  const referenceFiles = [];
  if (templatePath) referenceFiles.push(templatePath);

  const referencePathPattern = /(?:\.\.\/)?(?:skills|templates|config|references\/(?:oracle-kb|design-docs|test-cases|source))\/[^\s`，。；;、)）]+\.md/g;
  referenceFiles.push(...(prompt.match(referencePathPattern) || []));

  const scriptMatches = prompt.match(/(?:\.\.\/)?scripts\/pre-check-references\.sh/g) || [];
  referenceFiles.push(...scriptMatches);

  // 异步调用 LLM 扩展同义词
  const mcpQueries = await buildMcpQueries({ prompt, knowledgePoint });

  return {
    mcpQueries,
    referenceFiles: unique(referenceFiles)
  };
}

module.exports = {
  unique,
  sanitizeFilenameBase,
  extractYamlTitle,
  resolveOutputFilename,
  smartSplit,
  extractKeywordsFromKnowledgePoint,
  standardizePrompt,
  extractDirectReferences
};
