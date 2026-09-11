const { buildAsset } = require('../asset-utils');

async function renderOfficeAssets(renderer, filePath, title, locationName = '页面') {
  if (!renderer) return { assets: [], status: { enabled: false, status: 'disabled', pageCount: 0 } };
  if (!await renderer.isAvailable()) {
    return {
      assets: [],
      status: { enabled: true, status: 'unavailable', pageCount: 0, error: 'LibreOffice 或 PDF 转图命令不可用' }
    };
  }

  try {
    const pages = await renderer.render(filePath);
    const assets = pages.map(page => ({
      ...buildAsset({
        data: page.data,
        mimeType: page.mimeType,
        originalName: page.fileName,
        index: page.pageNumber,
        title,
        location: `第 ${page.pageNumber} ${locationName}`,
        sourcePart: `rendered/page-${page.pageNumber}.png`,
        placements: [{ page: page.pageNumber }]
      }),
      assetKind: 'page-render',
      renderedPage: page.pageNumber
    }));
    return { assets, status: { enabled: true, status: 'success', pageCount: assets.length } };
  } catch (error) {
    return { assets: [], status: { enabled: true, status: 'failed', pageCount: 0, error: error.message } };
  }
}

module.exports = { renderOfficeAssets };
