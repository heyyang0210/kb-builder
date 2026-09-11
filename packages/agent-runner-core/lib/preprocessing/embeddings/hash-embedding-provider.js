const crypto = require('crypto');
const { EmbeddingProvider } = require('../contracts/embedding-provider');

class HashEmbeddingProvider extends EmbeddingProvider {
  constructor(config = {}) {
    super();
    this._dimension = config.dimension || 128;
  }

  get name() {
    return 'hash-embedding-v1';
  }

  get dimension() {
    return this._dimension;
  }

  async embed(text) {
    const vector = new Array(this.dimension).fill(0);
    const tokens = this.tokenize(String(text || ''));
    for (const token of tokens) {
      const digest = crypto.createHash('sha256').update(token).digest();
      const index = digest.readUInt32BE(0) % this.dimension;
      const sign = digest[4] % 2 === 0 ? 1 : -1;
      vector[index] += sign;
    }
    return this.normalize(vector);
  }

  tokenize(text) {
    const normalized = text.toLowerCase();
    const words = normalized.match(/[a-z0-9_]+|[\u4e00-\u9fff]/g) || [];
    const bigrams = [];
    for (let index = 0; index < words.length - 1; index++) {
      bigrams.push(`${words[index]}:${words[index + 1]}`);
    }
    return [...words, ...bigrams];
  }

  normalize(vector) {
    const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    if (magnitude === 0) return vector;
    return vector.map(value => value / magnitude);
  }
}

module.exports = { HashEmbeddingProvider };
