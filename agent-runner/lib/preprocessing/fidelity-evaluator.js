function tokenize(value) {
  return (String(value || '').toLowerCase().match(/[\u3400-\u9fff]|[a-z0-9_]+/g) || []);
}

function tokenRecall(source, output) {
  const sourceTokens = tokenize(source);
  if (sourceTokens.length === 0) return 1;
  const outputCounts = new Map();
  for (const token of tokenize(output)) {
    outputCounts.set(token, (outputCounts.get(token) || 0) + 1);
  }
  let matched = 0;
  for (const token of sourceTokens) {
    const remaining = outputCounts.get(token) || 0;
    if (remaining > 0) {
      matched++;
      outputCounts.set(token, remaining - 1);
    }
  }
  return matched / sourceTokens.length;
}

function evaluateFidelity(item, thresholds = {}) {
  const metadata = item.metadata || {};
  const metrics = metadata.sourceMetrics || {};
  const assets = metadata.assets || [];
  const textRecallThreshold = thresholds.textRecallThreshold ?? 0.98;
  const mediaCoverageThreshold = thresholds.mediaCoverageThreshold ?? 1;
  const sourceText = metrics.sourceText || '';
  const recall = sourceText ? tokenRecall(sourceText, item.content) : 1;
  const mediaCount = metrics.mediaCount || 0;
  const exportedMediaCount = assets.length;
  const mediaCoverage = mediaCount === 0 ? 1 : Math.min(1, exportedMediaCount / mediaCount);
  const referencedAssets = assets.filter(asset => item.content.includes(`](${asset.relativePath})`));
  const referenceCoverage = assets.length === 0 ? 1 : referencedAssets.length / assets.length;
  const captionedAssets = assets.filter(asset => String(asset.caption || '').trim());
  const captionCoverage = assets.length === 0 ? 1 : captionedAssets.length / assets.length;
  const sourceSlideCount = metrics.slideCount || 0;
  const convertedSlideCount = metrics.convertedSlideCount || sourceSlideCount;
  const slideCoverage = sourceSlideCount === 0 ? 1 : convertedSlideCount / sourceSlideCount;
  const issues = [];

  if (recall < textRecallThreshold) issues.push(`源文本召回率 ${(recall * 100).toFixed(2)}% 低于阈值`);
  if (mediaCoverage < mediaCoverageThreshold) issues.push(`媒体导出率 ${(mediaCoverage * 100).toFixed(2)}% 低于阈值`);
  if (referenceCoverage < 1) issues.push(`Markdown 资产引用率 ${(referenceCoverage * 100).toFixed(2)}%`);
  if (captionCoverage < 1) issues.push(`图片说明覆盖率 ${(captionCoverage * 100).toFixed(2)}%`);
  if (slideCoverage < 1) issues.push(`幻灯片转换率 ${(slideCoverage * 100).toFixed(2)}%`);

  return {
    docId: metadata.docId || '',
    title: metadata.title || '',
    passed: issues.length === 0,
    textRecall: recall,
    mediaCount,
    exportedMediaCount,
    mediaCoverage,
    referenceCoverage,
    captionCoverage,
    slideCoverage,
    issues
  };
}

module.exports = { tokenize, tokenRecall, evaluateFidelity };
