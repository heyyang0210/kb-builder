/**
 * 结果过滤器 - Score过滤、去重、维度归类
 * 
 * v2.0 改进：
 * - P1: 跨查询去重（基于 ku_name，保留最高分）
 * - P2: 动态 Score 阈值（Top-K + 均值过滤）
 * - 二次排序：基于关键词命中率
 */

const logger = require('../logger');

/**
 * Score 过滤 - 动态阈值（Top-K + 均值策略）
 * 
 * 策略：
 * 1. 按 score 降序排列
 * 2. 计算均值和标准差
 * 3. 阈值 = max(mean - 0.5*stddev, topScore * 0.7, minScore)
 * 4. 取 Top-K 中 score >= 阈值 的结果
 */
function filterByScore(results, options = {}) {
  const { minScore = 0.4, topK = 15 } = options;
  
  if (!results || results.length === 0) return [];
  
  const sorted = [...results].sort((a, b) => (b.score || b.best_score || 0) - (a.score || a.best_score || 0));
  const scores = sorted.map(r => r.score || r.best_score || 0);
  
  // 计算均值
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  
  // 计算标准差
  const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
  const stddev = Math.sqrt(variance);
  
  // 动态阈值
  const topScore = scores[0];
  const dynamicThreshold = Math.max(
    mean - 0.5 * stddev,
    topScore * 0.7,
    minScore
  );
  
  // 取 Top-K 中 score >= 阈值 的结果
  const filtered = sorted
    .slice(0, topK)
    .filter(r => (r.score || r.best_score || 0) >= dynamicThreshold);
  
  // 如果过滤后结果太少，放宽到 Top-K 全部
  if (filtered.length < 3 && sorted.length > 0) {
    const fallback = sorted.slice(0, Math.min(topK, sorted.length));
    logger.debug('[result-filter] Score filter fallback', {
      filtered_count: filtered.length,
      fallback_count: fallback.length
    });
    return fallback;
  }
  
  logger.info('[result-filter] Score filter', {
    total: results.length,
    filtered: filtered.length,
    threshold: dynamicThreshold.toFixed(3),
    mean: mean.toFixed(3),
    stddev: stddev.toFixed(3),
    topScore: topScore.toFixed(3)
  });
  
  return filtered;
}

/**
 * 跨查询去重 - 以 ku_name 为唯一键，保留最高分
 */
function deduplicate(allResults) {
  const bestByKuName = new Map();
  
  for (const { query, dimension, results } of allResults) {
    if (!results) continue;
    
    for (const result of results) {
      const kuName = result.ku_name;
      if (!kuName) continue;
      
      const score = result.score || 0;
      const existing = bestByKuName.get(kuName);
      
      if (!existing || score > (existing.best_score || 0)) {
        bestByKuName.set(kuName, {
          ...result,
          dimension,
          matched_queries: existing?.matched_queries || [],
          best_score: score
        });
      }
      
      const entry = bestByKuName.get(kuName);
      if (entry.matched_queries && !entry.matched_queries.includes(query)) {
        entry.matched_queries.push(query);
      }
    }
  }
  
  const deduplicated = Array.from(bestByKuName.values())
    .sort((a, b) => (b.best_score || 0) - (a.best_score || 0));
  
  const beforeCount = allResults.reduce((sum, r) => sum + (r.results?.length || 0), 0);
  
  logger.info('[result-filter] Deduplication', {
    before: beforeCount,
    after: deduplicated.length,
    reduction: beforeCount > 0 ? ((1 - deduplicated.length / beforeCount) * 100).toFixed(1) + '%' : 'N/A'
  });
  
  return deduplicated;
}

/**
 * 按维度归类
 */
function groupByDimension(results) {
  const groups = {};
  
  for (const result of results) {
    const dim = result.dimension || 'other';
    if (!groups[dim]) groups[dim] = [];
    groups[dim].push(result);
  }
  
  return groups;
}

/**
 * 处理单个 MCP 查询结果
 */
function processMcpResult(query, dimension, mcpResult) {
  if (!mcpResult) {
    return { query, dimension, results: [] };
  }
  
  if (mcpResult.success === false) {
    return { query, dimension, results: [] };
  }
  
  let data = mcpResult.data || mcpResult;
  
  let structured = data.structuredContent || null;
  if (!structured && data.content) {
    try {
      const textItem = Array.isArray(data.content)
        ? data.content.find(item => item.type === 'text')
        : null;
      if (textItem && textItem.text) {
        structured = JSON.parse(textItem.text);
      }
    } catch (e) {
      // 解析失败
    }
  }
  
  // 兼容 response.data 格式
  if (!structured && mcpResult.response?.data) {
    structured = mcpResult.response.data.structuredContent || null;
    if (!structured && mcpResult.response.data.content) {
      try {
        const textItem = Array.isArray(mcpResult.response.data.content)
          ? mcpResult.response.data.content.find(item => item.type === 'text')
          : null;
        if (textItem && textItem.text) {
          structured = JSON.parse(textItem.text);
        }
      } catch (e) {}
    }
  }
  
  const results = structured?.results || [];
  
  return { query, dimension, results };
}

/**
 * 关键词命中率二次排序
 */
function rerankByKeywordHit(results, keywords) {
  if (!keywords || keywords.length === 0) return results;
  
  const keywordSet = new Set(keywords.map(k => k.toLowerCase()));
  
  const ranked = results.map(r => {
    const text = `${r.title || ''} ${r.excerpt || ''} ${r.ku_name || ''}`.toLowerCase();
    let hitCount = 0;
    for (const kw of keywordSet) {
      if (text.includes(kw)) hitCount++;
    }
    const keywordScore = keywords.length > 0 ? hitCount / keywords.length : 0;
    const combinedScore = (r.best_score || r.score || 0) * 0.7 + keywordScore * 0.3;
    return { ...r, keywordHitCount: hitCount, keywordScore, combinedScore };
  });
  
  ranked.sort((a, b) => b.combinedScore - a.combinedScore);
  
  logger.debug('[result-filter] Rerank by keyword', {
    total: ranked.length,
    keywords: keywords.length
  });
  
  return ranked;
}

/**
 * 完整过滤流水线：处理 → 去重 → 排序 → 过滤
 */
function pipeline(mcpRawResults, dimensionMap, options = {}) {
  const { topK = 15, keywords = [] } = options;
  
  // 1. 处理原始结果
  const processed = mcpRawResults.map(r => {
    const dim = dimensionMap[r.query] || r.dimension || 'other';
    return processMcpResult(r.query, dim, r);
  });
  
  // 2. 跨查询去重
  const deduplicated = deduplicate(processed);
  
  // 3. 关键词二次排序
  const ranked = keywords.length > 0 ? rerankByKeywordHit(deduplicated, keywords) : deduplicated;
  
  // 4. 动态 Score 过滤
  const filtered = filterByScore(ranked, { topK });
  
  // 5. 按维度归类
  const grouped = groupByDimension(filtered);
  
  return {
    filtered,
    grouped,
    stats: {
      before_dedup: processed.reduce((sum, r) => sum + r.results.length, 0),
      after_dedup: deduplicated.length,
      after_filter: filtered.length,
      dimensions: Object.keys(grouped)
    }
  };
}

module.exports = {
  filterByScore,
  deduplicate,
  groupByDimension,
  processMcpResult,
  rerankByKeywordHit,
  pipeline
};
