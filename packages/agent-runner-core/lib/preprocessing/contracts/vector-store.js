class VectorStore {
  async initialize() {
    throw new Error('VectorStore.initialize must be implemented');
  }

  async upsert(records) {
    throw new Error('VectorStore.upsert must be implemented');
  }

  async delete(ids) {
    throw new Error('VectorStore.delete must be implemented');
  }

  async query(vector, options = {}) {
    throw new Error('VectorStore.query must be implemented');
  }

  async list() {
    throw new Error('VectorStore.list must be implemented');
  }

  async statistics() {
    throw new Error('VectorStore.statistics must be implemented');
  }
}

module.exports = { VectorStore };
