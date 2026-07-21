const fs = require('fs');
const path = require('path');
const logger = require('../logger');

class FileReader {
  constructor(basePath) {
    this.basePath = basePath || path.join(__dirname, '..', '..');
    logger.debug(`FileReader initialized: basePath=${this.basePath}`);
  }

  async read(filePath, options = {}) {
    const fullPath = this.resolvePath(filePath);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const stat = fs.statSync(fullPath);
    const encoding = options.encoding || 'utf-8';
    const content = fs.readFileSync(fullPath, encoding);

    logger.debug(`File read: ${filePath} (${content.length} chars)`);

    return {
      path: filePath,
      fullPath,
      content,
      size: stat.size,
      modified: stat.mtime
    };
  }

  async readBatch(filePaths, options = {}) {
    const results = [];

    for (const filePath of filePaths) {
      try {
        const result = await this.read(filePath, options);
        results.push({ ...result, success: true });
      } catch (error) {
        results.push({ path: filePath, success: false, error: error.message });
      }
    }

    return results;
  }

  async listDir(dirPath, options = {}) {
    const fullPath = this.resolvePath(dirPath);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`Directory not found: ${dirPath}`);
    }

    const entries = fs.readdirSync(fullPath, { withFileTypes: true });
    const files = entries
      .filter(e => options.recursive ? true : e.isFile())
      .map(e => ({
        name: e.name,
        path: path.join(dirPath, e.name),
        isDirectory: e.isDirectory(),
        isFile: e.isFile()
      }));

    if (options.recursive) {
      const subDirs = entries.filter(e => e.isDirectory());
      for (const dir of subDirs) {
        const subFiles = await this.listDir(path.join(dirPath, dir.name), options);
        files.push(...subFiles);
      }
    }

    return files;
  }

  resolvePath(filePath) {
    if (path.isAbsolute(filePath)) return filePath;

    const primaryPath = path.resolve(this.basePath, filePath);
    if (fs.existsSync(primaryPath)) {
      return primaryPath;
    }

    const repoRootPath = path.resolve(this.basePath, '..', filePath);
    if (fs.existsSync(repoRootPath)) {
      return repoRootPath;
    }

    return primaryPath;
  }
}

module.exports = FileReader;
