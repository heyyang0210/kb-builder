# YashanDB 测试配置

自动化 E2E 可复用指定的 YashanDB 服务，但仅允许使用 `test_hy` 独立 Schema；服务地址由本地测试配置注入，不写入仓库。

仓库只保存不含真实密码的 `service.env.example`。本地运行配置位于 `runtime/test-config/yashandb/service.env`，由 `tests/run_tests.py` 强制加载，不得回退到 `config/yashandb/service.env` 或业务 Schema。

验收约束：

- 缺少测试配置时，Playwright 前置检查失败。
- 统一入口清除 Shell 继承的 JDBC 账号和密码，仅从测试配置读取。
- E2E 在首次写入前校验 `environment=test` 和本次 `testRunId`。
- 测试账号不得拥有业务 Schema 的写权限。

PingCode 来源确认和任务管理列表回读使用专用命令：

```bash
python3 tests/run_tests.py pingcode-storage --fail-fast --jobs 1
```

它会自动启动 test_hy 隔离 Storage，并将实际监听地址注入测试。不要设置 `KC_TEST_STORAGE_URL` 或 `KC_TEST_ISOLATED_SCHEMA` 来指向其他服务；统一入口会清除这两个继承值，再注入本次受锁保护的实例。若 `runtime/test-config/yashandb/service.env` 不存在，先由受控测试环境管理员创建该文件，使用独立 `test_hy` Schema 账号和本机测试服务地址，设置权限为 `0600`；密码只放在该本地文件，不写入仓库、README、命令行或运行记录。该入口会把 `pf_knowledge` 只读同步到 `test_hy`，然后仅在 `test_hy` 执行迁移及隔离测试数据写入。

注意：结构迁移不等于任务数据迁移激活。当前统一 E2E 入口不会调用受保护的 `migrate-tasks` / `activate-tasks`；若任务 API 返回 `DOCUMENT_TASK_MIGRATION_REQUIRED`，需要为专用个人测试库准备符合备份和迁移门槛的 ACTIVE 状态。不要通过放宽 Storage 门禁、伪造 ACTIVE 标记或把 `YASDB_STORAGE_TARGET_CLASS` 冒充为个人库来解决。
