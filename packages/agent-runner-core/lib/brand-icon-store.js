const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { CONFIG_PATHS } = require('./config-registry');
const { REPOSITORY_ROOT } = require('./repo-paths');
const { readJson } = require('./json-config');

const MIME_BY_EXTENSION = Object.freeze({
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml',
});

class BrandIconError extends Error {
  constructor(code, message, status = 500) { super(message); this.code = code; this.status = status; }
}

function createBrandIconStore(options = {}) {
  const repositoryRoot = path.resolve(options.repositoryRoot || REPOSITORY_ROOT);
  const platformPath = path.resolve(options.platformPath || CONFIG_PATHS.product);
  const brandingRoot = path.resolve(options.brandingRoot || path.join(repositoryRoot, 'config', 'knowledge-center', 'branding'));

  function current() {
    const platform = readJson(platformPath);
    const reference = platform.brand?.icon?.resourceRef || 'config/knowledge-center/branding/default-icon.png';
    if (typeof reference !== 'string' || path.isAbsolute(reference) || reference.includes('\\') || reference.split('/').some(part => part === '..' || part === '.')) {
      throw new BrandIconError('BRAND_ICON_PATH_FORBIDDEN', '品牌图标资源路径不合法');
    }
    const candidate = path.resolve(repositoryRoot, reference);
    let real; let realBrandingRoot;
    try {
      real = fs.realpathSync(candidate);
      realBrandingRoot = fs.realpathSync(brandingRoot);
    } catch (_error) {
      throw new BrandIconError('BRAND_ICON_NOT_FOUND', '品牌图标资源不存在', 404);
    }
    const relative = path.relative(realBrandingRoot, real);
    if (relative.startsWith('..') || path.isAbsolute(relative) || !fs.statSync(real).isFile()) {
      throw new BrandIconError('BRAND_ICON_PATH_FORBIDDEN', '品牌图标资源越过允许目录');
    }
    const mimeType = MIME_BY_EXTENSION[path.extname(real).toLowerCase()];
    if (!mimeType) throw new BrandIconError('BRAND_ICON_FORMAT_UNSUPPORTED', '品牌图标格式不受支持', 415);
    const buffer = fs.readFileSync(real);
    return {
      buffer, mimeType,
      fingerprint: `sha256:${crypto.createHash('sha256').update(buffer).digest('hex')}`,
      updatedAt: fs.statSync(real).mtime.toISOString(),
      alt: platform.brand?.icon?.alt || platform.brand?.productName || '知识中心',
      reference,
    };
  }

  return { current };
}

module.exports = { BrandIconError, createBrandIconStore };
