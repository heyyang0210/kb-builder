const crypto = require('crypto');
const path = require('path');

function decodeFileName(fileName) {
  let decoded = fileName;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
  }
  return decoded.normalize('NFC');
}

function sourceNames(filePath) {
  const rawSourceName = path.basename(filePath || '');
  return {
    rawSourceName,
    sourceName: decodeFileName(rawSourceName)
  };
}

function stableDigest(value) {
  const input = Buffer.isBuffer(value) ? value : String(value || '');
  return crypto.createHash('sha256').update(input).digest('hex');
}

function buildDocumentId(metadata = {}) {
  const digest = metadata.hash || stableDigest(metadata.originalFile || metadata.sourcePath || metadata.title || 'unknown');
  return `doc-${digest.slice(0, 12)}`;
}

module.exports = { decodeFileName, sourceNames, stableDigest, buildDocumentId };
