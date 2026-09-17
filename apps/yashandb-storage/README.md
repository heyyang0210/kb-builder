# YashanDB 存储服务

该服务是当前过渡期的 JDBC 运行组件，提供记录读写、乐观并发、Schema 初始化和完整导出。长期目标是将同一数据访问契约作为平台内核 Storage 模块直接调用，业务请求不再经过 HTTP 中转；在 Node/YashanDB 直接适配器和回退验证完成前，14210 仍由运维脚本管理，不得提前删除。

详细设计见 [YashanDB 数据存储与迁移开发设计](../../docs/modules/platform-foundation/development/yashandb-storage-and-migration-design.md)。

## 运行要求

- Java 17 或更高版本。
- YashanDB JDBC Jar；当前验证制品为 `com.yashandb:yashandb-jdbc:1.6.1`。
- 通过部署环境配置或环境变量提供连接信息；生产凭证不得进入 SQL、日志或迁移报告。
- Windows 可通过 Git Bash 执行统一构建和 `start.sh`；构建脚本固定以 UTF-8 编译 Java 源码，启动脚本只运行预编译 class 并自动转换 Windows classpath。

```bash
export YASDB_JDBC_URL='jdbc:yasdb://数据库地址:端口/数据库名'
export YASDB_USERNAME='应用账号'
export YASDB_PASSWORD='由密钥系统注入'
export YASDB_STORAGE_HOST='127.0.0.1'
export YASDB_STORAGE_PORT='14210'

../../tools/repository/build-knowledge-center.sh
./start.sh
```

业务服务切换到数据库模式前，需先启动本服务并确认健康检查成功：

```bash
export KNOWLEDGE_STORAGE_MODE=database
export YASDB_STORAGE_URL=http://127.0.0.1:14210
```

切换后若存储服务不可用，业务接口返回明确的 503，不会回写旧 JSON 文件。

健康检查：

```bash
curl http://127.0.0.1:14210/health
```

运行时按 `NNN_*.sql` 自动发现迁移，按编号执行并校验 SHA-256；已执行脚本摘要变化时拒绝启动。建表、索引和业务导入均使用业务账号，服务不会自动删除或截断已有表。

模板、认证等尚未关系化的兼容聚合继续写入 `KC_RECORD`。手册和大纲已切换到 `KC_MANUAL`、`KC_MANUAL_OUTLINE` 及其版本、节点、责任映射表，不再把核心业务事实写入 JSON/CLOB 聚合。

SQL 迁移目录：

| 文件 | 用途 |
|---|---|
| `sql/001_schema_migration.sql` | 记录已应用的 Schema 版本 |
| `sql/002_record.sql` | JSON/CLOB 兼容记录、摘要、revision 和软删除 |
| `sql/003_migration_batch.sql` | 文件迁移批次与对账结果 |
| `sql/004_record_indexes.sql` | 聚合记录命名空间读取索引 |
| `sql/005_manuals.sql` | 手册与大纲目标模型：12 张业务表、15 个显式业务索引、0 个物理外键（唯一约束索引不重复创建） |

可通过 `YASDB_STORAGE_SQL_DIR` 指定经过发布审核的 SQL 目录；服务不会执行目录之外的 SQL。

## 数据迁移和导出

启动服务后：

```bash
node ../../tools/knowledge-processing/migrate-file-stores-to-yashandb.js
node ../../tools/knowledge-processing/export-yashandb-storage.js /安全目录/knowledge-center-export.json
```

75 本历史手册迁移使用：

```bash
node ../../tools/knowledge-processing/migrate-manuals-to-target-yashandb.js
node ../../tools/knowledge-processing/migrate-manuals-to-target-yashandb.js --apply
```

脚本默认 dry-run，以 `runtime/knowledge-center/knowledge-assets.json` 为源；`--apply` 通过真实手册 API 写入，并回读手册和大纲数量。迁移报告位于 `runtime/yashandb-migration/`。

## exp/imp 数据库迁移脚本

需要使用 YashanDB 原生元数据文件迁移知识中心数据库用户时，使用仓库根目录下的两个脚本：

```bash
./tools/repository/export-knowledge-center-yashandb.sh /安全目录/knowledge-center-owner.dump
./tools/repository/import-knowledge-center-yashandb.sh /安全目录/knowledge-center-owner.dump
```

脚本通过 `YASDB_EXP_*` 和 `YASDB_IMP_*` 环境变量读取连接信息；未提供密码时交互式读取，不把密码写入仓库。导出默认使用 `OWNER` 和 `ROWS=Y`，导入默认使用 `FROMUSER/TOUSER` 且不启用 `TRUNCATE`，执行前会展示数据库地址、用户和文件并要求确认。跨用户导出或导入需使用具有 DBA 权限的操作账号；目标数据库和导出数据库应使用兼容版本的 `exp/imp`。
### JDBC 连接池

存储服务启动时会预热最小连接数，并在请求间复用 JDBC 连接，避免每次 HTTP 请求重新建立 YashanDB 会话。可通过环境变量调整：

- `YASDB_STORAGE_POOL_MIN`：预热连接数，默认 1；
- `YASDB_STORAGE_POOL_MAX`：最大连接数，默认不小于 HTTP 工作线程数（通常为 8）。
- `YASDB_STORAGE_POOL_BORROW_TIMEOUT_MS`：连接池耗尽时的最大等待时间，默认 5000ms。

连接归还池前会回滚未提交事务；现有 `If-Match` CAS 和 `SELECT ... FOR UPDATE` 语义保持不变。

### 大纲与建设任务存储契约

- `/v1/domain/outlines` 对外使用手册 `MANUAL_CODE`、大纲版本 `SOURCE_REF` 和节点 `NODE_KEY`；表间关联仅使用 BIGINT 内部键。
- 大纲快照导入与技术领域责任分工在同一数据库事务内写入。
- `/v1/domain/build-tasks` 从已发布大纲的当前责任项实时投影，`PATCH` 改派直接更新责任项，不依赖旧建设任务表。
# 启动入口说明

`start.sh` 是本模块的启动入口，负责启动 YashanDB 业务存储 HTTP 服务（默认端口 `14210`），不编译源码，不启动或停止 YashanDB 数据库实例，也不默认执行迁移。数据库 JDBC 地址、用户名和密码由 `config/database/` 统一配置，环境变量可覆盖配置；class、JDBC 和 SQL 默认从 `runtime/build/knowledge-center/current/java/` 读取。

常用操作：

```bash
tools/repository/build-knowledge-center.sh
apps/yashandb-storage/start.sh
```

启动前需要可用的 JDK/JDBC 驱动和 `YASDB_JDBC_URL`、`YASDB_USERNAME`；密码由统一环境加载器或外部密钥注入。平台级服务应优先使用根目录 `knowledge-center.sh` 统一启停。
