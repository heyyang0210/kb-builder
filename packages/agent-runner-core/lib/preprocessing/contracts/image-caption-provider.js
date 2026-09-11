class ImageCaptionProvider {
  async caption(asset, context = {}) {
    throw new Error('ImageCaptionProvider.caption must be implemented');
  }
}

module.exports = { ImageCaptionProvider };
