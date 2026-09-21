# YashanDB 数据库配置

本目录只保留一个 dotenv 运行配置：`service.env`。首次部署从 `service.env.example` 复制生成；Node、Python 和 Shell 入口都直接读取同一份键值，不再经过 JSON 转换。

当前开发测试数据库为 `172.22.69.74:1688/yashandb`，连接用户为 `regress`。`service.env` 是敏感配置文件，密码由受控部署或平台管理员写入并必须保持 `0600` 权限；不得提交版本库。

`YASDB_STORAGE_SQL_DIR` 默认不在 `service.env` 中配置，存储服务固定消费 `runtime/build/knowledge-center/current/java/sql/` 的统一构建产物。只有受控发布流程才可显式指定其他 SQL 目录，且该目录必须包含构建生成的 `migration-source.properties`；不得指向 `apps/yashandb-storage/sql/` 源码目录执行迁移。

`YASDB_MIGRATION_CHECKSUM_POLICY` 控制普通服务启动遇到已执行迁移摘要不一致时的行为：开发环境默认 `warn`，记录数据库摘要与当前文件摘要后继续启动；生产或共享环境应显式设为 `strict`。无论该配置为何值，`start.sh migrate` 始终严格拒绝摘要冲突。

数据库连接的唯一事实源是 `service.env`。调用方显式环境变量可以在本次进程启动时临时覆盖它，但页面读写和启动加载都指向同一份 `service.env`，不再存在平台 JSON 候选配置或第二套生效链路。页面保存后需要重启，运行中的旧进程不会被热切换。

不同环境直接覆盖变量，例如开发测试数据库：

```bash
export YASDB_JDBC_URL='jdbc:yasdb://172.22.69.74:1688/yashandb'
export YASDB_USERNAME='regress'
export YASDB_PASSWORD='由密钥系统注入'
```

密码、Token、密钥和生产凭证禁止写入 JSON、文档、日志或命令行参数，必须由外部密钥系统注入。

字段以 `YASDB_*` 环境变量命名：JDBC 连接、存储服务监听参数及 exp/imp 工具参数均在同一文件中；`YASDB_STORAGE_URL` 是本地存储服务地址，不是第二个数据库地址。

配置结构和安全字段由 `tests/unit/agent-runner/database-config.test.js` 及 Python 配置测试作为门禁维护，启动脚本执行同样的敏感字段检查。
