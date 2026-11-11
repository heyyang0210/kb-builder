const path = require('node:path');
const { CONFIG_PATHS, configPath } = require('../../../packages/agent-runner-core/lib/config-registry');
const root = path.resolve(__dirname, '../../..');

describe('公开配置注册表路径与安全边界', () => {
  test.each([
    ['product', 'config/knowledge-center/product.json'],
    ['service', 'config/knowledge-center/service.json'],
    ['contentRules', 'config/knowledge-center/content-rules.json'],
    ['knowledgeAssets', 'runtime/knowledge-center/knowledge-assets.json'],
    ['gitlabConnections', 'runtime/knowledge-center/gitlab-connections.json'],
    ['migrationRoot', 'runtime/agent-runner/repository-migration'],
  ])('%s配置定位到约定仓库或运行目录', (name, relative) => {
    expect(configPath(name)).toBe(path.join(root, relative));
    expect(path.isAbsolute(configPath(name))).toBe(true);
  });
  test.each(['unknown', '__proto__', 'constructor', 'toString', 'hasOwnProperty', undefined, null])('拒绝未知配置及原型链键%s', name => {
    expect(() => configPath(name)).toThrow(`未知配置项：${name}`);
  });
  test('调用方不能覆盖或增删公共配置路径', () => {
    expect(Object.isFrozen(CONFIG_PATHS)).toBe(true);
    expect(Reflect.set(CONFIG_PATHS, 'product', '/outside/product.json')).toBe(false);
    expect(Reflect.deleteProperty(CONFIG_PATHS, 'service')).toBe(false);
    expect(Reflect.set(CONFIG_PATHS, 'injected', '/outside/injected.json')).toBe(false);
    expect(configPath('product')).toBe(path.join(root, 'config/knowledge-center/product.json'));
    expect(() => configPath('injected')).toThrow('未知配置项：injected');
  });
});
