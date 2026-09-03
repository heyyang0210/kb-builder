class EmbeddingProvider {
  get name() {
    throw new Error('EmbeddingProvider.name must be implemented');
  }

  get dimension() {
    throw new Error('EmbeddingProvider.dimension must be implemented');
  }

  async embed(text) {
    throw new Error('EmbeddingProvider.embed must be implemented');
  }

  async embedBatch(texts) {
    const vectors = [];
    for (const text of texts) {
      vectors.push(await this.embed(text));
    }
    return vectors;
  }
}

module.exports = { EmbeddingProvider };
