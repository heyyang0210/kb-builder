module.exports = async function verifyIsolatedTestEnvironment() {
  const baseUrl = String(process.env.KPG_BASE_URL || '').replace(/\/$/, '');
  const expectedRunId = String(process.env.KNOWLEDGE_CENTER_TEST_RUN_ID || '');
  if (!baseUrl || !expectedRunId) {
    throw new Error('写入型 E2E 必须通过 tests/run_tests.py 启动隔离测试实例');
  }
  const response = await fetch(`${baseUrl}/knowledge-center/api/auth/config`);
  if (!response.ok) throw new Error(`测试实例标识校验失败：HTTP ${response.status}`);
  const payload = await response.json();
  const config = payload.content || payload.data || payload;
  if (config.environment !== 'test' || config.testRunId !== expectedRunId) {
    throw new Error('拒绝执行 E2E：目标不是本次统一入口创建的隔离测试实例');
  }
};
