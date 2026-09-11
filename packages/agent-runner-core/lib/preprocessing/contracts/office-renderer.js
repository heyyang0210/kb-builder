class OfficeRenderer {
  async isAvailable() {
    return false;
  }

  async render(filePath, outputDir = '') {
    throw new Error('OfficeRenderer.render must be implemented');
  }
}

module.exports = { OfficeRenderer };
