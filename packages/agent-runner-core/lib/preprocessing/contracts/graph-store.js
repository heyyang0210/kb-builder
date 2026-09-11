class GraphStore {
  async initialize() {
    throw new Error('GraphStore.initialize must be implemented');
  }

  async upsertNodes(nodes) {
    throw new Error('GraphStore.upsertNodes must be implemented');
  }

  async upsertEdges(edges) {
    throw new Error('GraphStore.upsertEdges must be implemented');
  }

  async deleteNodes(ids) {
    throw new Error('GraphStore.deleteNodes must be implemented');
  }

  async getSubgraph(nodeId, options = {}) {
    throw new Error('GraphStore.getSubgraph must be implemented');
  }

  async listNodes() {
    throw new Error('GraphStore.listNodes must be implemented');
  }

  async listEdges() {
    throw new Error('GraphStore.listEdges must be implemented');
  }

  async statistics() {
    throw new Error('GraphStore.statistics must be implemented');
  }
}

module.exports = { GraphStore };
