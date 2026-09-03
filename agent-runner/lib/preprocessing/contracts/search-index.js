class SearchIndex {
  async build(items, context = {}) {
    throw new Error('SearchIndex.build must be implemented');
  }

  async search(query, options = {}) {
    throw new Error('SearchIndex.search must be implemented');
  }
}

module.exports = { SearchIndex };
