describe('API入口已配置场景', () => {
  require('./helpers/api-server-boundary-suite.cjs')({ configured: true, host: '127.0.0.1', existing: true });
});
