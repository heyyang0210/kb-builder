# YashanDB 测试配置

自动化 E2E 可复用指定的 YashanDB 服务，但仅允许使用 `test_hy` 独立 Schema；服务地址由本地测试配置注入，不写入仓库。

仓库只保存不含真实密码的 `service.env.example`。本地运行配置位于 `runtime/test-config/yashandb/service.env`，由 `tests/run_tests.py` 强制加载，不得回退到 `config/yashandb/service.env` 或业务 Schema。

验收约束：

- 缺少测试配置时，Playwright 前置检查失败。
- 统一入口清除 Shell 继承的 JDBC 账号和密码，仅从测试配置读取。
- E2E 在首次写入前校验 `environment=test` 和本次 `testRunId`。
- 测试账号不得拥有业务 Schema 的写权限。
