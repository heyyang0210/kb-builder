const fs = require('fs').promises;
const path = require('path');
const { GraphStore } = require('../contracts/graph-store');

class JsonGraphStore extends GraphStore {
  constructor(config = {}) {
    super();
    this.directory = config.directory || path.join(process.cwd(), 'preprocessing-output', 'graph');
    this.nodes = new Map();
    this.edges = new Map();
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    const [nodes, edges] = await Promise.all([
      this.readJson(path.join(this.directory, 'nodes.json'), []),
      this.readJson(path.join(this.directory, 'edges.json'), [])
    ]);
    for (const node of nodes) this.nodes.set(node.id, node);
    for (const edge of edges) this.edges.set(this.edgeKey(edge), edge);
    this.initialized = true;
  }

  async upsertNodes(nodes) {
    await this.initialize();
    for (const node of nodes) {
      if (!node?.id || !node?.type) throw new Error('Graph node id and type are required');
      this.nodes.set(node.id, node);
    }
    await this.persist();
    return { upserted: nodes.length, total: this.nodes.size };
  }

  async upsertEdges(edges) {
    await this.initialize();
    for (const edge of edges) {
      this.validateEdge(edge);
      this.edges.set(this.edgeKey(edge), edge);
    }
    await this.persist();
    return { upserted: edges.length, total: this.edges.size };
  }

  async deleteNodes(ids) {
    await this.initialize();
    const targets = new Set(ids);
    let deleted = 0;
    for (const id of targets) if (this.nodes.delete(id)) deleted++;
    for (const [key, edge] of this.edges) {
      if (targets.has(edge.from) || targets.has(edge.to)) this.edges.delete(key);
    }
    await this.persist();
    return { deleted, total: this.nodes.size };
  }

  async getSubgraph(nodeId, options = {}) {
    await this.initialize();
    const depth = Math.max(0, Math.min(options.depth ?? 1, 5));
    const relationTypes = new Set(options.relationTypes || []);
    const visited = new Set([nodeId]);
    let frontier = new Set([nodeId]);
    const selectedEdges = new Map();

    for (let level = 0; level < depth; level++) {
      const next = new Set();
      for (const edge of this.edges.values()) {
        if (relationTypes.size > 0 && !relationTypes.has(edge.type)) continue;
        if (!frontier.has(edge.from) && !frontier.has(edge.to)) continue;
        selectedEdges.set(this.edgeKey(edge), edge);
        const neighbor = frontier.has(edge.from) ? edge.to : edge.from;
        if (!visited.has(neighbor)) next.add(neighbor);
      }
      for (const id of next) visited.add(id);
      frontier = next;
    }

    return {
      nodes: Array.from(visited).map(id => this.nodes.get(id)).filter(Boolean),
      edges: Array.from(selectedEdges.values())
    };
  }

  async listNodes() {
    await this.initialize();
    return Array.from(this.nodes.values());
  }

  async listEdges() {
    await this.initialize();
    return Array.from(this.edges.values());
  }

  async statistics() {
    const nodes = await this.listNodes();
    const edges = await this.listEdges();
    const degrees = new Map(nodes.map(node => [node.id, 0]));
    for (const edge of edges) {
      degrees.set(edge.from, (degrees.get(edge.from) || 0) + 1);
      degrees.set(edge.to, (degrees.get(edge.to) || 0) + 1);
    }
    const isolatedNodeCount = Array.from(degrees.values()).filter(degree => degree === 0).length;
    return {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      nodeTypes: this.countBy(nodes, node => node.type),
      edgeTypes: this.countBy(edges, edge => edge.type),
      averageDegree: nodes.length === 0 ? 0 : (edges.length * 2) / nodes.length,
      isolatedNodeCount,
      isolatedNodeRate: nodes.length === 0 ? 0 : isolatedNodeCount / nodes.length,
      connectedComponentCount: this.countConnectedComponents(nodes, edges),
      evidenceCoverage: edges.length === 0 ? 1 : edges.filter(edge => edge.evidence).length / edges.length
    };
  }

  validateEdge(edge) {
    if (!edge?.from || !edge?.to || !edge?.type) throw new Error('Graph edge from, to and type are required');
    if (!this.nodes.has(edge.from) || !this.nodes.has(edge.to)) {
      throw new Error(`Graph edge references missing node: ${edge.from} -> ${edge.to}`);
    }
    if (edge.weight !== undefined && (edge.weight < 0 || edge.weight > 1)) {
      throw new Error('Graph edge weight must be between 0 and 1');
    }
  }

  edgeKey(edge) {
    return `${edge.from}|${edge.type}|${edge.to}`;
  }

  countBy(items, selector) {
    return items.reduce((counts, item) => {
      const key = selector(item) || 'unknown';
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {});
  }

  countConnectedComponents(nodes, edges) {
    const adjacency = new Map(nodes.map(node => [node.id, new Set()]));
    for (const edge of edges) {
      adjacency.get(edge.from)?.add(edge.to);
      adjacency.get(edge.to)?.add(edge.from);
    }
    const visited = new Set();
    let components = 0;
    for (const node of nodes) {
      if (visited.has(node.id)) continue;
      components++;
      const stack = [node.id];
      while (stack.length > 0) {
        const current = stack.pop();
        if (visited.has(current)) continue;
        visited.add(current);
        for (const neighbor of adjacency.get(current) || []) stack.push(neighbor);
      }
    }
    return components;
  }

  async persist() {
    await fs.mkdir(this.directory, { recursive: true });
    await Promise.all([
      this.atomicWrite(path.join(this.directory, 'nodes.json'), Array.from(this.nodes.values())),
      this.atomicWrite(path.join(this.directory, 'edges.json'), Array.from(this.edges.values()))
    ]);
  }

  async atomicWrite(filePath, value) {
    const temporaryPath = `${filePath}.tmp`;
    await fs.writeFile(temporaryPath, JSON.stringify(value, null, 2), 'utf-8');
    await fs.rename(temporaryPath, filePath);
  }

  async readJson(filePath, fallback) {
    try {
      return JSON.parse(await fs.readFile(filePath, 'utf-8'));
    } catch (error) {
      if (error.code === 'ENOENT') return fallback;
      throw error;
    }
  }
}

module.exports = { JsonGraphStore };
