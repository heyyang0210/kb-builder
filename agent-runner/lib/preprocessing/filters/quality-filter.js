const { DocumentFilter } = require('../contracts/document-filter');

class QualityFilter extends DocumentFilter {
  constructor(config = {}) {
    super();
    this.config = {
      enabled: config.enabled !== false,
      minContentChars: config.minContentChars ?? 50,
      borderlineMaxChars: config.borderlineMaxChars ?? 300,
      maxHeadingRatio: config.maxHeadingRatio ?? 0.8,
      useLlmForBorderline: config.useLlmForBorderline === true,
      llmMinScore: config.llmMinScore ?? 3
    };
    this.llmEvaluator = config.llmEvaluator || null;
  }

  async evaluate(document) {
    const content = String(document.content || '');
    const metrics = this.calculateMetrics(content);

    if (!this.config.enabled) {
      return this.buildResult(document, true, 'disabled', [], metrics, 1, 'disabled');
    }

    const reasons = [];
    if (metrics.contentChars === 0) reasons.push('empty_file');
    if (metrics.nonEmptyLines > 0 && metrics.headingLines === metrics.nonEmptyLines) {
      reasons.push('title_only');
    }
    if (metrics.contentChars > 0 && metrics.contentChars < this.config.minContentChars) {
      reasons.push('too_short');
    }
    if (metrics.nonEmptyLines > 0 && metrics.headingRatio > this.config.maxHeadingRatio) {
      reasons.push('high_heading_ratio');
    }

    if (reasons.length > 0) {
      return this.buildResult(document, false, 'rule', reasons, metrics, 0);
    }

    if (this.shouldUseLlm(metrics)) {
      if (!this.llmEvaluator) {
        return this.buildResult(document, true, 'rule', ['llm_not_configured'], metrics, 0.6, 'review');
      }
      const assessment = await this.llmEvaluator({ document, metrics });
      const score = Number(assessment?.score || 0);
      const passed = assessment?.recommendation
        ? assessment.recommendation !== 'discard'
        : score >= this.config.llmMinScore;
      return this.buildResult(
        document,
        passed,
        'llm',
        assessment?.reason ? [assessment.reason] : [],
        metrics,
        score / 5
      );
    }

    return this.buildResult(document, true, 'rule', [], metrics, 1);
  }

  calculateMetrics(content) {
    const lines = content.split('\n').map(line => line.trim()).filter(Boolean);
    const headingLines = lines.filter(line => /^#{1,6}\s+/.test(line)).length;
    const body = lines.filter(line => !/^#{1,6}\s+/.test(line)).join('\n');
    const normalizedBody = body
      .replace(/```[\s\S]*?```/g, match => match.replace(/[`\s]/g, ''))
      .replace(/[|#>*_`\-\s]/g, '');

    return {
      rawChars: content.length,
      contentChars: normalizedBody.length,
      nonEmptyLines: lines.length,
      headingLines,
      headingRatio: lines.length === 0 ? 0 : headingLines / lines.length,
      hasStructuredContent: /```/.test(content) || /^\s*\|.+\|\s*$/m.test(content) || /^\s*[-*]\s+/m.test(content)
    };
  }

  shouldUseLlm(metrics) {
    return this.config.useLlmForBorderline &&
      metrics.contentChars <= this.config.borderlineMaxChars &&
      !metrics.hasStructuredContent;
  }

  buildResult(document, passed, source, reasons, metrics, confidence, status) {
    return {
      document,
      passed,
      status: status || (passed ? 'keep' : 'discard'),
      source,
      reasons,
      metrics,
      confidence
    };
  }
}

module.exports = { QualityFilter };
