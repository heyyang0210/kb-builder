class DocumentFilter {
  async evaluate(document) {
    throw new Error('DocumentFilter.evaluate must be implemented');
  }

  async evaluateAll(documents) {
    const results = [];
    for (const document of documents) {
      results.push(await this.evaluate(document));
    }
    return results;
  }
}

module.exports = { DocumentFilter };
