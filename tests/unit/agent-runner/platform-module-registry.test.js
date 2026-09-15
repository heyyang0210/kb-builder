const { PlatformModuleRegistry } = require('../../../packages/agent-runner-core/lib/platform-module-registry');

describe('平台模块注册表', () => {
  test('注册并投影版本化模块', () => {
    const registry = new PlatformModuleRegistry();
    const handler = () => {};
    registry.register({ id: 'auth', version: '1.0.0', handler });
    expect(registry.get('auth').handler).toBe(handler);
    expect(registry.list()).toEqual([{ id: 'auth', version: '1.0.0', status: 'registered' }]);
  });

  test('拒绝重复模块和无版本模块', () => {
    const registry = new PlatformModuleRegistry();
    registry.register({ id: 'auth', version: '1.0.0' });
    expect(() => registry.register({ id: 'auth', version: '1.0.1' })).toThrow(/重复注册/);
    expect(() => new PlatformModuleRegistry().register({ id: 'storage' })).toThrow(/语义化版本/);
  });
});
