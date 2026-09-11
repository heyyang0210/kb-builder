const path = require('path');
const { stableDigest } = require('./document-identity');

const MIME_EXTENSIONS = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
  'image/tiff': '.tiff',
  'image/bmp': '.bmp',
  'image/x-emf': '.emf',
  'image/x-wmf': '.wmf'
};

function extensionForMime(mimeType, fallback = '.bin') {
  return MIME_EXTENSIONS[String(mimeType || '').toLowerCase()] || fallback;
}

function normalizeAltText(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text || /^(picture|image|图片|图像)\s*\d*$/i.test(text)) return '';
  return text;
}

function oneSentenceCaption({ alt, title, location }) {
  const meaningfulAlt = normalizeAltText(alt);
  if (meaningfulAlt) {
    return /[。！？.!?]$/.test(meaningfulAlt) ? meaningfulAlt : `${meaningfulAlt}。`;
  }
  const documentTitle = String(title || '当前文档').trim();
  const position = location ? `在${location}中` : '';
  return `该图为《${documentTitle}》${position}的原始图片，用于补充展示相关设计信息。`;
}

function buildAsset({ data, mimeType, originalName, index, alt, title, location, sourcePart, placements = [] }) {
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data || '');
  const hash = stableDigest(buffer);
  const originalExtension = path.extname(originalName || '');
  const extension = originalExtension || extensionForMime(mimeType);
  const fileName = `image-${String(index).padStart(3, '0')}-${hash.slice(0, 10)}${extension.toLowerCase()}`;
  const normalizedAlt = normalizeAltText(alt);
  return {
    assetId: `asset-${hash.slice(0, 16)}`,
    fileName,
    relativePath: `assets/${fileName}`,
    originalName: originalName || fileName,
    mimeType: mimeType || '',
    hash,
    byteLength: buffer.length,
    alt: normalizedAlt,
    caption: oneSentenceCaption({ alt, title, location }),
    captionSource: normalizedAlt ? 'source-alt' : 'context-fallback',
    assetKind: 'embedded-media',
    sourcePart: sourcePart || '',
    placements,
    data: buffer
  };
}

function serializableAsset(asset) {
  const { data, ...metadata } = asset;
  return metadata;
}

module.exports = { buildAsset, extensionForMime, normalizeAltText, oneSentenceCaption, serializableAsset };
