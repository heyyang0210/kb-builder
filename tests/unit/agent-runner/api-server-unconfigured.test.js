describe('API入口未配置场景', () => {
  require('./helpers/api-server-boundary-suite.cjs')({ configured: false, host: '', existing: false });
});
