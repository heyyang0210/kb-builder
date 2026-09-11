const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');
const AdmZip = require('adm-zip');
const tarStream = require('tar-stream');
const { SourceAdapter, NormalizedDocument } = require('../source-adapter');

/**
 * 压缩包源数据适配器
 * 
 * 处理 .tar, .tar.gz, .tgz, .zip 等压缩文件。
 * 解压后递归扫描内部文件，委托给对应的适配器处理。
 * 支持嵌套压缩包（递归解压，最大深度 3 层）。
 */
class ArchiveAdapter extends SourceAdapter {
  /**
   * @param {Object} [options]
   * @param {AdapterChain|null} [options.chain] - 适配器链，用于处理解压后的文件
   * @param {number} [options.maxDepth=3] - 最大递归解压深度
   * @param {string} [options.tempDir] - 临时解压目录
   */
  constructor(options = {}) {
    super();
    this.chain = options.chain || null;
    this.maxDepth = options.maxDepth || 3;
    this.tempDir = options.tempDir || path.join(os.tmpdir(), 'preprocessing-archive');
  }

  get name() {
    return 'archive';
  }

  get supportedExtensions() {
    return ['.tar', '.tar.gz', '.tgz', '.zip'];
  }

  /**
   * 检测文件是否由此适配器处理
   * 需要额外处理 .tar.gz 这种双扩展名的情况
   */
  canHandle(filePath) {
    const lower = filePath.toLowerCase();
    return lower.endsWith('.tar.gz') || lower.endsWith('.tgz') ||
           lower.endsWith('.tar') || lower.endsWith('.zip');
  }

  /**
   * 解析压缩包为标准化文档
   * @param {string} filePath - 文件绝对路径
   * @returns {Promise<NormalizedDocument>}
   */
  async parse(filePath) {
    const hash = await this.computeHash(filePath);
    const title = path.basename(filePath).replace(/\.(tar\.gz|tgz|tar|zip)$/i, '');

    // 解压到临时目录
    const extractDir = path.join(this.tempDir, `${title}-${Date.now()}`);
    await fs.mkdir(extractDir, { recursive: true });

    try {
      await this.extract(filePath, extractDir);

      // 扫描解压后的文件
      const extractedFiles = await this.scanExtracted(extractDir);

      // 处理每个文件
      const documents = [];
      for (const file of extractedFiles) {
        const adapter = this.selectAdapterFor(file);
        if (adapter) {
          try {
            const doc = await adapter.parse(file);
            documents.push(doc);
          } catch (err) {
            // 跳过无法解析的文件
            documents.push(new NormalizedDocument({
              title: path.basename(file),
              content: `[解析失败: ${err.message}]`,
              metadata: {
                sourcePath: file,
                sourceFormat: 'error',
                hash: ''
              }
            }));
          }
        }
      }

      // 构建聚合文档
      const content = this.buildAggregateContent(title, documents, extractedFiles);

      return new NormalizedDocument({
        title,
        content,
        metadata: {
          sourcePath: filePath,
          sourceFormat: this.detectArchiveType(filePath),
          version: '',
          docType: this.extractDocType(filePath),
          author: '',
          createdDate: '',
          keywords: this.extractKeywords(title, filePath),
          hash,
          extra: {
            lineCount: content.split('\n').length,
            archiveType: this.detectArchiveType(filePath),
            extractedFileCount: extractedFiles.length,
            parsedDocumentCount: documents.length,
            extractedFiles: extractedFiles.map(f => path.relative(extractDir, f))
          }
        }
      });
    } finally {
      // 清理临时目录
      await fs.rm(extractDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  /**
   * 扫描目录中的压缩包文件（不解压，只列出）
   */
  async scan(dir) {
    const files = [];
    await this.scanRecursive(dir, files);
    return files.sort();
  }

  async scanRecursive(dir, files) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await this.scanRecursive(fullPath, files);
        } else if (entry.isFile() && this.canHandle(entry.name)) {
          files.push(fullPath);
        }
      }
    } catch (err) {
      if (err.code !== 'ENOENT' && err.code !== 'EACCES') throw err;
    }
  }

  /**
   * 根据文件类型解压
   */
  async extract(filePath, extractDir) {
    const lower = filePath.toLowerCase();
    
    if (lower.endsWith('.zip')) {
      await this.extractZip(filePath, extractDir);
    } else if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) {
      await this.extractTarGz(filePath, extractDir);
    } else if (lower.endsWith('.tar')) {
      await this.extractTar(filePath, extractDir);
    } else {
      throw new Error(`Unsupported archive format: ${filePath}`);
    }
  }

  /**
   * 解压 ZIP 文件
   */
  async extractZip(filePath, extractDir) {
    const zip = new AdmZip(filePath);
    zip.extractAllTo(extractDir, true);
  }

  /**
   * 解压 tar.gz 文件
   */
  async extractTarGz(filePath, extractDir) {
    const zlib = require('zlib');
    const pipeline = require('stream/promises').pipeline;
    
    const input = fsSync.createReadStream(filePath);
    const gunzip = zlib.createGunzip();
    const extract = tarStream.extract();

    const extractPromise = new Promise((resolve, reject) => {
      extract.on('entry', async (header, stream, next) => {
        try {
          const entryPath = path.join(extractDir, header.name);
          
          // 安全检查：防止路径遍历
          if (!entryPath.startsWith(extractDir)) {
            stream.resume();
            next();
            return;
          }

          if (header.type === 'directory') {
            await fs.mkdir(entryPath, { recursive: true });
            stream.resume();
            next();
          } else if (header.type === 'file') {
            await fs.mkdir(path.dirname(entryPath), { recursive: true });
            const writeStream = fsSync.createWriteStream(entryPath);
            stream.pipe(writeStream);
            writeStream.on('finish', next);
            writeStream.on('error', reject);
          } else {
            stream.resume();
            next();
          }
        } catch (err) {
          reject(err);
        }
      });

      extract.on('finish', resolve);
      extract.on('error', reject);
    });

    await pipeline(input, gunzip, extract);
    await extractPromise;
  }

  /**
   * 解压 tar 文件
   */
  async extractTar(filePath, extractDir) {
    const pipeline = require('stream/promises').pipeline;
    
    const input = fsSync.createReadStream(filePath);
    const extract = tarStream.extract();

    const extractPromise = new Promise((resolve, reject) => {
      extract.on('entry', async (header, stream, next) => {
        try {
          const entryPath = path.join(extractDir, header.name);
          
          if (!entryPath.startsWith(extractDir)) {
            stream.resume();
            next();
            return;
          }

          if (header.type === 'directory') {
            await fs.mkdir(entryPath, { recursive: true });
            stream.resume();
            next();
          } else if (header.type === 'file') {
            await fs.mkdir(path.dirname(entryPath), { recursive: true });
            const writeStream = fsSync.createWriteStream(entryPath);
            stream.pipe(writeStream);
            writeStream.on('finish', next);
            writeStream.on('error', reject);
          } else {
            stream.resume();
            next();
          }
        } catch (err) {
          reject(err);
        }
      });

      extract.on('finish', resolve);
      extract.on('error', reject);
    });

    await pipeline(input, extract);
    await extractPromise;
  }

  /**
   * 扫描解压后的目录，返回所有可处理的文件
   */
  async scanExtracted(dir) {
    const files = [];
    await this.scanExtractedRecursive(dir, files, 0);
    return files.sort();
  }

  async scanExtractedRecursive(dir, files, depth) {
    if (depth > this.maxDepth) return;

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await this.scanExtractedRecursive(fullPath, files, depth + 1);
        } else if (entry.isFile()) {
          if (this.canHandle(entry.name) && depth < this.maxDepth) {
            // 嵌套压缩包，递归解压处理
            const nestedDir = fullPath + '.extracted';
            await fs.mkdir(nestedDir, { recursive: true });
            try {
              await this.extract(fullPath, nestedDir);
              await this.scanExtractedRecursive(nestedDir, files, depth + 1);
            } catch (err) {
              // 无法解压则跳过
            } finally {
              await fs.rm(nestedDir, { recursive: true, force: true }).catch(() => {});
            }
          } else if (this.chain && this.chain.canHandle(entry.name)) {
            files.push(fullPath);
          } else if (!this.chain) {
            // 没有链时，收集所有非压缩包文件
            files.push(fullPath);
          }
        }
      }
    } catch (err) {
      if (err.code !== 'ENOENT' && err.code !== 'EACCES') throw err;
    }
  }

  /**
   * 为文件选择合适的适配器
   */
  selectAdapterFor(filePath) {
    if (!this.chain) return null;
    return this.chain.selectAdapter(filePath);
  }

  /**
   * 构建聚合文档内容
   */
  buildAggregateContent(title, documents, extractedFiles) {
    const parts = [`# ${title}\n`];
    parts.push(`压缩包包含 ${extractedFiles.length} 个文件，成功解析 ${documents.length} 个文档。\n`);

    for (const doc of documents) {
      parts.push(`---\n`);
      parts.push(`## ${doc.title}\n`);
      parts.push(`> 来源: ${doc.metadata.sourceFormat} | 路径: ${path.basename(doc.metadata.sourcePath)}\n`);
      parts.push(doc.content);
      parts.push('');
    }

    return parts.join('\n');
  }

  /**
   * 检测压缩包类型
   */
  detectArchiveType(filePath) {
    const lower = filePath.toLowerCase();
    if (lower.endsWith('.zip')) return 'zip';
    if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) return 'tar.gz';
    if (lower.endsWith('.tar')) return 'tar';
    return 'unknown';
  }

  extractDocType(filePath) {
    const typePatterns = {
      '特性设计': /特性设计/, '测试设计': /测试设计/, '需求分析': /需求分析/,
      '概要设计': /概要设计/, '开发概要': /开发概要/, '架构设计': /架构设计/
    };
    for (const [type, pattern] of Object.entries(typePatterns)) {
      if (pattern.test(filePath)) return type;
    }
    return '其他';
  }

  extractKeywords(title, filePath) {
    const keywords = new Set();
    title.split(/[\s\-_/\\()[\]{}]+/)
      .filter(t => t.length >= 2 && !/^[\d.]+$/.test(t))
      .forEach(t => keywords.add(t));

    const featureMatch = filePath.match(/YDBRD-(\d+)/);
    if (featureMatch) keywords.add(`YDBRD-${featureMatch[1]}`);

    return Array.from(keywords).slice(0, 15);
  }
}

module.exports = { ArchiveAdapter };
