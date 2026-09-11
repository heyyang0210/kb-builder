const fs = require('fs').promises;
const path = require('path');
const { VectorStore } = require('../contracts/vector-store');

class JsonVectorStore extends VectorStore {
  constructor(config = {}) {
    super();
    this.filePath = config.filePath || path.join(process.cwd(), 'preprocessing-output', 'vector', 'records.json');
    this.records = new Map();
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(content);
      for (const record of parsed.records || []) this.records.set(record.id, record);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    this.initialized = true;
  }

  async upsert(records) {
    await this.initialize();
    for (const record of records) this.validateRecord(record);
    for (const record of records) this.records.set(record.id, record);
    await this.persist();
    return { upserted: records.length, total: this.records.size };
  }

  async delete(ids) {
    await this.initialize();
    let deleted = 0;
    for (const id of ids) {
      if (this.records.delete(id)) deleted++;
    }
    await this.persist();
    return { deleted, total: this.records.size };
  }

  async query(vector, options = {}) {
    await this.initialize();
    const topK = options.topK || 10;
    const filter = options.filter || {};
    return Array.from(this.records.values())
      .filter(record => this.matchesFilter(record.metadata || {}, filter))
      .map(record => ({
        id: record.id,
        score: this.cosineSimilarity(vector, record.vector),
        document: record.document,
        metadata: record.metadata || {}
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, topK);
  }

  async list() {
    await this.initialize();
    return Array.from(this.records.values());
  }

  async statistics() {
    const records = await this.list();
    const dimensions = new Set(records.map(record => record.vector.length));
    return {
      recordCount: records.length,
      dimensions: Array.from(dimensions),
      modelNames: Array.from(new Set(records.map(record => record.metadata?.embeddingModel).filter(Boolean)))
    };
  }

  validateRecord(record) {
    if (!record?.id) throw new Error('Vector record id is required');
    if (!Array.isArray(record.vector)) throw new Error(`Vector record ${record.id} has no vector`);
    if (record.vector.some(value => !Number.isFinite(value))) {
      throw new Error(`Vector record ${record.id} contains invalid values`);
    }
  }

  matchesFilter(metadata, filter) {
    return Object.entries(filter).every(([key, expected]) => metadata[key] === expected);
  }

  cosineSimilarity(left, right) {
    if (!left.length || left.length !== right.length) return 0;
    let dot = 0;
    let leftNorm = 0;
    let rightNorm = 0;
    for (let index = 0; index < left.length; index++) {
      dot += left[index] * right[index];
      leftNorm += left[index] * left[index];
      rightNorm += right[index] * right[index];
    }
    if (leftNorm === 0 || rightNorm === 0) return 0;
    return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
  }

  async persist() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const payload = {
      version: '1.0',
      generatedAt: new Date().toISOString(),
      records: Array.from(this.records.values())
    };
    const temporaryPath = `${this.filePath}.tmp`;
    await fs.writeFile(temporaryPath, JSON.stringify(payload), 'utf-8');
    await fs.rename(temporaryPath, this.filePath);
  }
}

module.exports = { JsonVectorStore };
