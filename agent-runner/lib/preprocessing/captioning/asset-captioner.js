class AssetCaptioner {
  constructor(config = {}) {
    this.provider = config.provider || null;
    this.enabled = config.enabled === true && !!this.provider;
  }

  async enrich(assets, context = {}) {
    if (!this.enabled) return assets;
    for (const asset of assets || []) {
      try {
        asset.caption = await this.provider.caption(asset, {
          ...context,
          location: asset.placements?.[0]?.slide
            ? `第 ${asset.placements[0].slide} 张幻灯片`
            : asset.placements?.[0]?.page
              ? `第 ${asset.placements[0].page} 页`
            : asset.sourcePart
        });
        asset.captionSource = 'vision-model';
        asset.captionStatus = 'success';
      } catch (error) {
        asset.captionStatus = 'fallback';
        asset.captionError = error.message;
      }
    }
    return assets;
  }
}

module.exports = { AssetCaptioner };
