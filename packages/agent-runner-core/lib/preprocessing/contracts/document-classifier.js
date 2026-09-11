class DocumentClassifier {
  async classify(document) {
    throw new Error('DocumentClassifier.classify must be implemented');
  }

  async classifyAll(documents) {
    const results = [];
    for (const document of documents) {
      results.push(await this.classify(document));
    }
    return results;
  }
}

module.exports = { DocumentClassifier };
