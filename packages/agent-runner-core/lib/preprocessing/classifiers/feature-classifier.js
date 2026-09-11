const fs = require('fs').promises;
const path = require('path');
const { DocumentClassifier } = require('../contracts/document-classifier');

class FeatureClassifier extends DocumentClassifier {
  constructor(config = {}) {
    super();
    this.config = {
      enabled: config.enabled !== false,
      minConfidence: config.minConfidence ?? 0.7,
      useLlmFallback: config.useLlmFallback === true,
      featureListPath: config.featureListPath || ''
    };
    this.features = Array.isArray(config.features) ? config.features : [];
    this.llmClassifier = config.llmClassifier || null;
    this.loaded = false;
  }

  async classify(document) {
    await this.loadFeatures();
    if (!this.config.enabled) return this.result('', '', 0, 'disabled', '分类已禁用');

    const pathResult = this.classifyByPath(document);
    if (pathResult.confidence >= this.config.minConfidence) return pathResult;

    const keywordResult = this.classifyByKeywords(document);
    if (keywordResult.confidence >= this.config.minConfidence) return keywordResult;

    if (this.config.useLlmFallback && this.llmClassifier) {
      const llmResult = await this.llmClassifier({ document, features: this.features });
      return this.result(
        llmResult?.feature || '',
        llmResult?.subFeature || llmResult?.sub_feature || '',
        Number(llmResult?.confidence || 0),
        'llm',
        llmResult?.reason || ''
      );
    }

    return keywordResult.confidence > pathResult.confidence
      ? keywordResult
      : pathResult;
  }

  async loadFeatures() {
    if (this.loaded) return;
    this.loaded = true;
    if (!this.config.featureListPath || this.features.length > 0) return;
    try {
      const content = await fs.readFile(this.config.featureListPath, 'utf-8');
      const parsed = JSON.parse(content);
      this.features = Array.isArray(parsed) ? parsed : parsed.features || [];
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  classifyByPath(document) {
    const metadata = document.metadata || {};
    const sourcePath = metadata.sourcePath || metadata.originalFile || document.filePath || '';
    const normalized = sourcePath.split(path.sep).join('/');
    const match = normalized.match(/(?:特性设计|features?)\/([^/]+)(?:\/([^/]+))?/i);
    if (!match) return this.result('', '', 0, 'path', '路径中未发现特性目录');
    return this.result(match[1], match[2] ? path.basename(match[2], path.extname(match[2])) : '', 0.9, 'path', '从源文件路径推断');
  }

  classifyByKeywords(document) {
    const metadata = document.metadata || {};
    const title = metadata.title || document.title || '';
    const keywords = metadata.keywords || [];
    const content = document.bodyContent || document.content || '';
    const haystack = `${title}\n${keywords.join(' ')}\n${content.slice(0, 1000)}`.toLowerCase();
    let best = this.result('', '', 0, 'keyword', '未命中特性词典');

    for (const feature of this.features) {
      const terms = [feature.name, ...(feature.keywords || [])].filter(Boolean);
      const matched = terms.filter(term => haystack.includes(String(term).toLowerCase()));
      if (matched.length === 0) continue;
      const confidence = Math.min(0.95, 0.72 + (matched.length - 1) * 0.08);
      if (confidence > best.confidence) {
        best = this.result(feature.name, feature.subFeature || '', confidence, 'keyword', `命中关键词: ${matched.join(', ')}`);
      }
    }
    return best;
  }

  result(feature, subFeature, confidence, source, reason) {
    return { feature, subFeature, confidence, source, reason };
  }
}

module.exports = { FeatureClassifier };
