# YashanDB 数据库配置

本目录只保留一个 dotenv 运行配置：`service.env`。首次部署从 `service.env.example` 复制生成；Node、Python 和 Shell 入口都直接读取同一份键值，不再经过 JSON 转换。

当前开发测试数据库为 `172.22.69.74:1688/yashandb`，连接用户为 `regress`。密码不写入此文件，必须通过 `YASDB_PASSWORD` 注入。

`YASDB_STORAGE_SQL_DIR` 默认不在 `service.env` 中配置，存储服务固定消费 `runtime/build/knowledge-center/current/java/sql/` 的统一构建产物。只有受控发布流程才可显式指定其他 SQL 目录，且该目录必须包含构建生成的 `migration-source.properties`；不得指向 `apps/yashandb-storage/sql/` 源码目录执行迁移。

`YASDB_MIGRATION_CHECKSUM_POLICY` 控制普通服务启动遇到已执行迁移摘要不一致时的行为：开发环境默认 `warn`，记录数据库摘要与当前文件摘要后继续启动；生产或共享环境应显式设为 `strict`。无论该配置为何值，`start.sh migrate` 始终严格拒绝摘要冲突。

配置优先级为：调用方显式参数 > 进程环境变量/密钥系统 > `service.env` > 代码安全默认值。

不同环境直接覆盖变量，例如开发测试数据库：

```bash
export YASDB_JDBC_URL='jdbc:yasdb://172.22.69.74:1688/yashandb'
export YASDB_USERNAME='regress'
export YASDB_PASSWORD='由密钥系统注入'
```

密码、Token、密钥和生产凭证禁止写入 JSON、文档、日志或命令行参数，必须由外部密钥系统注入。

字段以 `YASDB_*` 环境变量命名：JDBC 连接、存储服务监听参数及 exp/imp 工具参数均在同一文件中；`YASDB_STORAGE_URL` 是本地存储服务地址，不是第二个数据库地址。

配置结构和安全字段由 `tests/unit/agent-runner/database-config.test.js` 及 Python 配置测试作为门禁维护，启动脚本执行同样的敏感字段检查。
