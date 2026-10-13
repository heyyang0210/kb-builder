# YashanDB 存储服务

数据库结构和迁移变更必须遵循 [YashanDB Storage 变更约束](./AGENTS.md)。

该服务是当前过渡期的 JDBC 运行组件，提供记录读写、乐观并发、Schema 初始化和完整导出。长期目标是将同一数据访问契约作为平台内核 Storage 模块直接调用，业务请求不再经过 HTTP 中转；在 Node/YashanDB 直接适配器和回退验证完成前，14210 仍由运维脚本管理，不得提前删除。

详细设计见 [知识中心-平台-详细设计文档](../../.codex/知识中心建设平台/03-详细设计/知识中心-平台-详细设计文档.md)。

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
./start.sh migrate
./start.sh
```

`./start.sh migrate` 显式执行待应用迁移并退出；`./start.sh` 校验迁移版本、别名和摘要，存在待执行版本时拒绝启动服务。普通启动遇到摘要冲突时会同时输出数据库登记值和当前构建文件值；开发环境默认按 `YASDB_MIGRATION_CHECKSUM_POLICY=warn` 告警后继续，生产或共享环境应设为 `strict`。显式 `migrate` 始终严格拒绝摘要冲突，任何模式都不会自动修改迁移记录。

`Main probe` 是平台数据库连接治理的内部验证命令：它使用候选 JDBC 地址和凭据建立真实会话，执行固定的 `SELECT 1 FROM DUAL` 后立即退出。`Main verify` 在不启动 HTTP 服务的情况下校验已执行迁移的版本、别名和摘要。两者都不修改数据库，密码只通过子进程环境传递，不放入命令行、日志或响应。启动脚本支持通过 `KNOWLEDGE_CENTER_JAVA_BIN` 使用项目隔离的 Java 17 运行时。
显式迁移还会校验构建产物中的 `migration-source.properties`：SQL 和版本别名必须来自已提交的 Git revision，否则在连接数据库前拒绝执行。该门禁同样适用于 E2E 专用 `test_hy`：统一入口可以先同步基线并构建当前代码，但只执行已提交的迁移字节，不对脏 SQL 设置测试例外。运行产物重算聚合摘要时使用统一源路径 `apps/yashandb-storage/sql/<file>`，不让构建目录的路径差异影响摘要。
迁移文件发现、历史别名兼容、摘要校验和 SQL 执行由 `src/migration/SchemaMigrationManager.java` 集中维护，业务入口只负责编排连接和服务生命周期。

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

迁移器按 `NNN_<action>_<object>.sql` 自动发现版本，显式迁移时按编号执行并校验 SHA-256；已执行脚本摘要变化时拒绝迁移或启动。历史文件改名通过 `sql/migration-aliases.properties` 兼容，只有数字版本和摘要均一致时才视为已执行。建表、索引和业务导入均使用业务账号，服务不会自动删除或截断已有表。

模板、认证等尚未关系化的兼容聚合继续写入 `KC_RECORD`。手册和大纲已切换到 `KC_MANUAL`、`KC_MANUAL_OUTLINE` 及其版本、节点、责任映射表，不再把核心业务事实写入 JSON/CLOB 聚合。

`KC_MANUAL.PRODUCT_NAME` 保存手册列表所需的产品名称快照（`DB / YMP / YCM / YDC`），Storage 直接投影该字段；`PRODUCT_ID` 保留给产品主数据校验和联合查询，不在读取链路中转换展示名。

CAS 首次登录只绑定人员目录中唯一的同名、启用且尚未绑定 CAS 的人员，并直接记录首次登录时间；无匹配或存在多个同名候选时返回明确冲突，不自动创建重复人员。已绑定账号再次登录只更新最近登录时间。管理员可更正从未产生首次或最近登录记录的错误预绑定账号，更新继续受 CAS 登录名唯一约束和人员行版本保护；已有登录记录时拒绝直接换绑。人员批量导入仍可显式创建携带 CAS 登录名的新人员。

手册列表投影由 `HandbookProjectionRepository` 集中维护命名 SQL、结果行 DTO 和查询计时，使用单条联表查询同时读取当前大纲业务 ID 和主/协同负责人，禁止按手册逐条查询负责人或大纲版本。响应通过 `Server-Timing` 输出 JDBC 连接获取、SQL 执行、行映射、JSON 序列化和 Storage 总耗时，`PERF_TRACE=1` 时同步写入性能日志。知识资产与审核刷新关键路径中的手册只读调用由 Node 使用原生异步 HTTP，不能通过同步子进程阻塞平台事件循环。

大纲列表通过 `/v1/domain/outlines/catalog` 返回轻量一致读模型：在单条 SQL 中联接每本手册的当前大纲版本并聚合节点/知识点数量，响应含 `items`、`total`、`snapshotVersion` 和 `generatedAt`，不读取节点描述或调用节点树投影。该 Node 读取路径必须调用 `DomainStore.requestAsync()`，禁止同步 curl。

SQL 迁移目录：

| 文件 | 用途 |
|---|---|
| `sql/001_schema_migration.sql` | 记录已应用的 Schema 版本 |
| `sql/002_record.sql` | JSON/CLOB 兼容记录、摘要、revision 和软删除 |
| `sql/003_migration_batch.sql` | 文件迁移批次与对账结果 |
| `sql/004_record_indexes.sql` | 聚合记录命名空间读取索引 |
| `sql/005_manuals.sql` | 手册与大纲目标模型：12 张业务表、15 个显式业务索引、0 个物理外键（唯一约束索引不重复创建） |
| `sql/007_create_platform_principal.sql` | 本地人员主数据和手册责任人姓名快照 |
| `sql/008_split_business_id_sequences.sql` | 为各业务表分配独立数字主键序列，切断对公共序列的新增依赖 |
| `sql/009_consolidate_business_sequences.sql` | 将主键生成器收敛为 4 个业务边界序列，并清理旧序列 |
| `sql/010_platform_centralization.sql` | 当前认证权限与 GitLab 配置 8 张关系表及 `KC_PLATFORM_SEQ`；不导入数据、不删除旧序列 |
| `sql/011_team_groups.sql` | 技术领域团队与成员两表；为现有有效技术领域创建真实团队，并一次性迁移旧成员关系 |
| `sql/012_decouple_team_groups.sql` | 保留 011 历史摘要不变，把既有领域—团队关系迁移到 `KC_TECH_DOMAIN.TEAM_GROUP_ID`，再删除团队表旧领域列并重建查询索引 |

默认 SQL 目录是统一构建产物 `runtime/build/knowledge-center/current/java/sql/`。可通过 `YASDB_STORAGE_SQL_DIR` 指定其他经发布审核的 SQL 目录，但显式迁移要求该目录同时携带 `migration-source.properties`；禁止将该变量指向 `apps/yashandb-storage/sql/` 工作树源码目录。服务不会执行目录之外的 SQL。

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

认证权限与 GitLab 当前配置的一次性迁移使用：

```bash
node ../../tools/knowledge-processing/migrate-platform-config-to-yashandb.js plan
MIGRATION_APPROVAL_REF=审批单号 MIGRATION_MAINTENANCE_WINDOW=true \
  node ../../tools/knowledge-processing/migrate-platform-config-to-yashandb.js import --apply
```

该工具默认只读计划；`import` 仅在显式批准引用和维护窗口标记同时存在时调用 Storage 内部迁移接口。它只迁移 CAS 用户、角色关系、GitLab 连接和当前映射；本地账号、会话、Ticket、审计、幂等记录和 GitLab Token 均被排除并输出原因。当前工作区未执行 `import`，也未执行真实数据库写入。

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

大纲回收站依赖 `sql/013_outline_recycle_super_admin.sql`（提交 `3c35ccf`），增加独立删除标记和超级管理员角色/动作。先备份目标库，统一构建后显式执行 `apps/yashandb-storage/start.sh migrate`，再启动新服务；普通启动不会替你迁移。DELETE 保留节点和历史并清空被删当前指针；restore 遇到新当前版本拒绝恢复；purge 在事务中重新检查基线、责任版本和生产记录引用，独立审计继续保留。生产记录写入与清理共享版本锁，已删除基线不可写入。回退前先恢复所需活动版本，禁止直接回退到忽略删除标记的旧代码。

`start.sh` 是本模块的启动入口，负责启动 YashanDB 业务存储 HTTP 服务（默认端口 `14210`），不编译源码，不启动或停止 YashanDB 数据库实例，也不默认执行迁移。数据库 JDBC 地址、用户名和密码由 `config/database/` 统一配置，环境变量可覆盖配置；class、JDBC 和 SQL 默认从 `runtime/build/knowledge-center/current/java/` 读取。

常用操作：

```bash
tools/repository/build-knowledge-center.sh
apps/yashandb-storage/start.sh
```

启动前需要可用的 JDK/JDBC 驱动和 `YASDB_JDBC_URL`、`YASDB_USERNAME`；密码由统一环境加载器或外部密钥注入。平台级服务应优先使用根目录 `knowledge-center.sh` 统一启停。

### 错误定位补充（2026-10-13）

聚合引用校验拒绝返回 HTTP 409，错误消息与 details 包含 namespace、key、outlineVersionId，涵盖历史引用，便于定位。
