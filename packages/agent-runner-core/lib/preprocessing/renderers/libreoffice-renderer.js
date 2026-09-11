const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { OfficeRenderer } = require('../contracts/office-renderer');

const execFileAsync = promisify(execFile);

class LibreOfficeRenderer extends OfficeRenderer {
  constructor(config = {}) {
    super();
    this.command = config.command || 'libreoffice';
    this.pdfToImageCommand = config.pdfToImageCommand || 'pdftoppm';
    this.dpi = config.dpi || 144;
    this.timeoutMs = config.timeoutMs || 120000;
    this.commandRunner = config.commandRunner || execFileAsync;
  }

  async isAvailable() {
    try {
      await this.commandRunner(this.command, ['--version'], { timeout: this.timeoutMs });
      await this.commandRunner(this.pdfToImageCommand, ['-v'], { timeout: this.timeoutMs });
      return true;
    } catch {
      return false;
    }
  }

  async render(filePath, outputDir = '') {
    if (!await this.isAvailable()) {
      throw new Error(`Office 渲染依赖不可用: ${this.command} / ${this.pdfToImageCommand}`);
    }

    const workingDir = await fs.mkdtemp(path.join(os.tmpdir(), 'office-render-'));
    const profileDir = path.join(workingDir, 'profile');
    const convertedDir = path.join(workingDir, 'converted');
    const targetDir = outputDir || path.join(workingDir, 'output');

    try {
      await fs.mkdir(profileDir, { recursive: true });
      await fs.mkdir(convertedDir, { recursive: true });
      await fs.mkdir(targetDir, { recursive: true });
      await this.commandRunner(this.command, [
        '--headless',
        `-env:UserInstallation=${this.fileUrl(profileDir)}`,
        '--convert-to',
        'pdf',
        '--outdir',
        convertedDir,
        filePath
      ], { timeout: this.timeoutMs });

      const pdfName = (await fs.readdir(convertedDir)).find(name => name.toLowerCase().endsWith('.pdf'));
      if (!pdfName) throw new Error('LibreOffice 未生成 PDF 文件');

      const pdfPath = path.join(convertedDir, pdfName);
      const prefix = path.join(targetDir, 'page');
      await this.commandRunner(this.pdfToImageCommand, [
        '-png',
        '-r',
        String(this.dpi),
        pdfPath,
        prefix
      ], { timeout: this.timeoutMs });

      const pageFiles = (await fs.readdir(targetDir))
        .filter(name => /^page-\d+\.png$/i.test(name))
        .sort((left, right) => this.pageNumber(left) - this.pageNumber(right));
      if (pageFiles.length === 0) throw new Error('PDF 转图未生成 PNG 页面');

      return Promise.all(pageFiles.map(async fileName => ({
        pageNumber: this.pageNumber(fileName),
        fileName,
        mimeType: 'image/png',
        data: await fs.readFile(path.join(targetDir, fileName))
      })));
    } finally {
      await fs.rm(workingDir, { recursive: true, force: true });
    }
  }

  pageNumber(fileName) {
    return Number(fileName.match(/page-(\d+)\.png/i)?.[1] || 0);
  }

  fileUrl(directory) {
    return `file://${directory.split(path.sep).map(encodeURIComponent).join('/')}`;
  }
}

module.exports = { LibreOfficeRenderer };
