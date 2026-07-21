const fs = require('fs');
const path = require('path');
const logger = require('../logger');

class FileWriter {
  constructor(basePath) {
    this.basePath = basePath || path.join(__dirname, '..', '..');
    logger.debug(`FileWriter initialized: basePath=${this.basePath}`);
  }

  async write(filePath, content, options = {}) {
    const fullPath = this.resolvePath(filePath);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.debug(`Created directory: ${dir}`);
    }

    let targetPath = fullPath;
    if (fs.existsSync(fullPath) && !options.overwrite) {
      targetPath = this._generateUniquePath(fullPath);
      logger.debug(`File exists, writing to: ${targetPath}`);
    }

    fs.writeFileSync(targetPath, content, 'utf-8');

    logger.info(`File written: ${targetPath} (${content.length} chars)`);

    return {
      success: true,
      path: filePath,
      fullPath: targetPath,
      size: content.length
    };
  }

  async writeBatch(files, options = {}) {
    const results = [];

    for (const file of files) {
      try {
        const result = await this.write(file.path, file.content, { ...options, ...file.options });
        results.push({ ...result, originalPath: file.path });
      } catch (error) {
        results.push({ originalPath: file.path, success: false, error: error.message });
      }
    }

    return results;
  }

  _generateUniquePath(filePath) {
    const dir = path.dirname(filePath);
    const ext = path.extname(filePath);
    const base = path.basename(filePath, ext);

    let counter = 1;
    let newPath = filePath;

    while (fs.existsSync(newPath)) {
      newPath = path.join(dir, `${base}_${counter}${ext}`);
      counter++;
    }

    return newPath;
  }

  resolvePath(filePath) {
    if (path.isAbsolute(filePath)) return filePath;
    return path.resolve(this.basePath, filePath);
  }
}

module.exports = FileWriter;
