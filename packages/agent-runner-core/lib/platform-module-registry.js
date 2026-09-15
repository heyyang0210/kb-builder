class PlatformModuleRegistryError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

class PlatformModuleRegistry {
  constructor() {
    this.modules = new Map();
  }

  register(definition) {
    const id = String(definition?.id || '').trim();
    const version = String(definition?.version || '').trim();
    if (!/^[a-z][a-z0-9-]{1,63}$/.test(id)) throw new PlatformModuleRegistryError('MODULE_ID_INVALID', '平台模块 ID 不合法');
    if (!/^\d+\.\d+\.\d+$/.test(version)) throw new PlatformModuleRegistryError('MODULE_VERSION_INVALID', `平台模块 ${id} 缺少语义化版本`);
    if (this.modules.has(id)) throw new PlatformModuleRegistryError('MODULE_DUPLICATED', `平台模块重复注册：${id}`);
    const module = Object.freeze({ ...definition, id, version });
    this.modules.set(id, module);
    return module;
  }

  get(id) {
    return this.modules.get(id) || null;
  }

  list() {
    return [...this.modules.values()].map(module => ({ id: module.id, version: module.version, status: 'registered' }));
  }
}

module.exports = { PlatformModuleRegistry, PlatformModuleRegistryError };
