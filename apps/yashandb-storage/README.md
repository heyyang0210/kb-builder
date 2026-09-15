# YashanDB 存储服务

该服务是现有 Node.js 业务与 YashanDB 之间的内部 JDBC 边界，提供记录读写、乐观并发、Schema 初始化和完整导出。所有建表语句集中存放在 `sql/`，服务启动时按文件名顺序执行缺失表检查；生产迁移可直接复用这些 SQL 文件。

详细设计见 [YashanDB 数据存储与迁移开发设计](../../docs/modules/platform-foundation/development/yashandb-storage-and-migration-design.md)。

## 运行要求

- Java 17 或更高版本。
- YashanDB JDBC Jar；当前验证制品为 `com.yashandb:yashandb-jdbc:1.6.1`。
- 通过环境变量提供连接信息，密码不得写入仓库。

```bash
export YASDB_JDBC_URL='jdbc:yasdb://数据库地址:端口/数据库名'
export YASDB_USERNAME='应用账号'
export YASDB_PASSWORD='由密钥系统注入'
export YASDB_JDBC_JAR='/受控路径/yashandb-jdbc.jar'
export YASDB_STORAGE_HOST='127.0.0.1'
export YASDB_STORAGE_PORT='14210'

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

运行时默认自动创建缺失的 `KC_*` 表，不删除、不截断已有表。生产运行期应使用只拥有 `KC_*` 对象权限的账号；DBA 账号只用于初始化和迁移。

业务聚合均写入通用表 `KC_RECORD(NAMESPACE, RECORD_KEY, PAYLOAD, REVISION, DELETED)`，并通过命名空间隔离：`assets/catalog`（知识资产）、`incremental/state`（审核与发布）、`documents/metadata` 与 `documents/comments`（文档元数据和评论）、`outlines/metadata`（大纲）、`auth/state`（会话权限）、`templates/state`（模板）以及 `gitlab-oauth/credentials`（AES-256-GCM 加密的个人 GitLab 授权）。因此不为每个 JSON 聚合重复建表，避免结构漂移；DDL 由 `sql/002_record.sql` 统一维护。

SQL 迁移目录：

| 文件 | 用途 |
|---|---|
| `sql/001_schema_migration.sql` | 记录已应用的 Schema 版本 |
| `sql/002_record.sql` | JSON/CLOB 兼容记录、摘要、revision 和软删除 |
| `sql/003_migration_batch.sql` | 文件迁移批次与对账结果 |
| `sql/004_record_indexes.sql` | 聚合记录命名空间读取索引 |

可通过 `YASDB_STORAGE_SQL_DIR` 指定经过发布审核的 SQL 目录；服务不会执行目录之外的 SQL。

## 数据迁移和导出

启动服务后：

```bash
node ../../tools/knowledge-processing/migrate-file-stores-to-yashandb.js
node ../../tools/knowledge-processing/export-yashandb-storage.js /安全目录/knowledge-center-export.json
```

迁移脚本默认只导入已登记的 JSON 源，不删除源文件。切换 `KNOWLEDGE_STORAGE_MODE=database` 前必须完成回读摘要对账。

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
