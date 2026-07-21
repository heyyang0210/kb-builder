const { MCPClient } = require('./mcp-client');
const FileReader = require('./file-reader');
const FileWriter = require('./file-writer');
const logger = require('../logger');

class ToolManager {
  constructor(config = {}) {
    this.config = config;
    this.tools = new Map();
    this._registerDefaults();
  }

  _registerDefaults() {
    const basePath = this.config.basePath || process.cwd();

    this.registerTool('mcp', new MCPClient(this.config.mcp || {}));
    this.registerTool('file_reader', new FileReader(basePath));
    this.registerTool('file_writer', new FileWriter(basePath));

    logger.debug(`ToolManager initialized with ${this.tools.size} tools`);
  }

  registerTool(name, tool) {
    this.tools.set(name, tool);
    logger.debug(`Tool registered: ${name}`);
  }

  getTool(name) {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}. Available: ${this.listTools().join(', ')}`);
    }
    return tool;
  }

  listTools() {
    return Array.from(this.tools.keys());
  }

  updateConfig(config) {
    this.config = config;
    if (config.mcp) {
      this.tools.set('mcp', new MCPClient(config.mcp));
    }
    logger.info('ToolManager config updated');
  }
}

module.exports = ToolManager;
