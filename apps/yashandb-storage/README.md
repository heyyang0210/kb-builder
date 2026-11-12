# YashanDB 存储服务

`handbook-production/state` 聚合写入时，存储层只对本次新增或修改的实体校验大纲版本引用；未变动的历史草稿引用已删除大纲，不会阻断新 AI 任务。新增、修改或恢复软删除的实体仍按原规则校验，旧值读取与写入锁后的版本必须一致，冲突返回 409。其他命名空间继续全量校验。回归用例位于 `tests/unit/agent-runner/fixtures/ProductionReferenceChangesCheck.java`，真实 JDBC 事务回滚验证位于 `ProductionReferenceJdbcCheck.java`，仅允许 `test_hy` 执行。

数据库结构和迁移变更必须遵循 [YashanDB Storage 变更约束](./AGENTS.md)。

Pingcode 来源同步的 `017_pingcode_task_sync.sql` 新增逐 SR 任务、负责人/审核关联索引、来源、运行和快照表。旧任务数据不会随 DDL 自动迁移；`migrate-tasks` 仅允许个人开发库，要求 `YASDB_STORAGE_TARGET_CLASS=personal` 和 `KC_DOCUMENT_TASK_BACKUP_PATH` 指向本仓库 `runtime` 内的新文件。命令先备份旧聚合，再逐条复制、建立人员/审核索引并核对正文哈希和数量，留下 `VERIFIED` 记录；此状态不开放来源确认。结构迁移仍必须使用来自已提交版本的构建产物，且共享库由项目负责人执行。备份以创建时 `0600` 权限写入，不输出凭据或正文到日志。

任务关系表以 `TASK_PREFIX VARCHAR(16)` 与 `TASK_NUMBER BIGINT` 共同标识任务；固定类型的 Pingcode SR、IR 关系使用 BIGINT 编号，外部接口仍收发完整编号。运行、快照、关系、变化、资源和幂等历史表按 `CREATED_AT` 月度分区，便于按批准的保留策略归档；本次迁移不会自动删除历史。外部不透明 ID、哈希及分类值保留字符类型。`regress` 测试库曾执行旧版 `017`，重建前须保留含数据备份；生产库尚未执行 `017`。

逐任务关系表读取接口为 `GET /v1/document-tasks`、`GET /v1/document-tasks/{number}`、`GET /v1/document-tasks/mine?principalId=` 和 `GET /v1/document-tasks/by-review/{reviewTaskId}`；`PUT /v1/document-tasks/{number}` 使用行版本和幂等键，同事务更新任务与负责人/审核索引。列表分页至多 100 条，可按编号/描述、责任人、产品、版本、类型、状态、IR 和关注级别过滤。仅在迁移记录为 `ACTIVE` 时响应任务数据；`VERIFIED` 仍返回 409。`activate-tasks` 仅允许个人开发库，必须提供原备份路径，并重新核验旧聚合版本、备份摘要和全部任务正文后才切换；激活后旧聚合任务写入返回 409。三个迁移命令都校验 SQL 来自已提交版本。

审核任务索引保留当前范围、历史范围和范围意见来源中的审核任务 ID，因此文档撤出后仍可从原审核意见定位工单。索引仅用于历史查找；当前审核、发布和完成门禁仍以任务正文中的当前范围与冻结证据为准，旧审核不会因此重新生效。此扩展不改变表结构，既有关系表任务需经一次受控重写才能重建其历史索引。

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
YashanDB 对已有相同列序的重复索引返回 `YAS-02043`；迁移器只在数据库元数据证明等价索引存在时跳过该语句，保留历史 SQL 摘要，其他错误仍中止迁移。

业务服务切换到数据库模式前，需先启动本服务并确认健康检查成功：

```bash
export KNOWLEDGE_STORAGE_MODE=database
export YASDB_STORAGE_URL=http://127.0.0.1:14210
```

切换后若存储服务不可用，业务接口返回明确的 503，不会回写旧 JSON 文件。

文档 SQL 质量检查需要单独设置 `YASDB_QUALITY_JDBC_URL`、`YASDB_QUALITY_USERNAME`、`YASDB_QUALITY_PASSWORD`，连接到与 `YASDB_JDBC_URL` 不同的测试库。质量账号只授予测试数据的 `SELECT` 权限，不得拥有业务库读取或写入权限。未配置或地址等于业务库时 `/v1/quality/execute` 返回 503，平台报告中的用例为“未执行”。该接口每次使用独立的只读 JDBC 连接，不借用业务存储连接池；结果仅在上限之外还有数据时标记 `truncated`。

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
| `sql/014_gitlab_version_mapping.sql` | 产品版本与 GitLab 分支映射的修订行基础表和操作事件表 |
| `sql/015_retract_gitlab_version_draft.sql` | 草案撤销状态和审计动作的兼容扩展；迁移前备份，须在个人开发库验证后再考虑共享环境 |
| `sql/016_archive_gitlab_version_mapping.sql` | 增加已停用规则归档状态与恢复/归档审计动作；已在个人开发库和共享库验证，执行证据见 `sql/README.md` |

默认 SQL 目录是统一构建产物 `runtime/build/knowledge-center/current/java/sql/`。可通过 `YASDB_STORAGE_SQL_DIR` 指定其他经发布审核的 SQL 目录，但显式迁移要求该目录同时携带 `migration-source.properties`；禁止将该变量指向 `apps/yashandb-storage/sql/` 工作树源码目录。服务不会执行目录之外的 SQL。

关系表任务索引的 `TASK_STATUS` 按现有业务状态保存为 `PENDING_SCOPE`、`IN_PROGRESS` 或 `COMPLETED`，与列表状态筛选一致。旧聚合缺失状态字段时，迁移只根据已保存的范围确认事实推断未确认和进行中，完成状态须按备份逐项对账。

Pingcode 确认同步新建的任务读取任务配置的默认责任人，并在同一事务内写入 `OWNER_ID` 与人员索引；未配置默认责任人时拒绝确认。同步现有任务不覆盖平台责任人。

已确认来源快照按任务编号回读当前主来源的 Markdown、IR 和最新资源版本；变化历史只统计已确认批次。缺图重试追加资源版本，不改原正文及其哈希；所有失败资源修复后，批次从 `CONFIRMED_MISSING_IMAGES` 转为 `CONFIRMED`。隔离库测试覆盖多 IR 引用同一 SR、来源变化、缺图确认与修复。

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
- `YASDB_STORAGE_POOL_MAX`：最大连接数，默认不小于 HTTP 工作线程数（通常为 16）。
- `YASDB_STORAGE_POOL_BORROW_TIMEOUT_MS`：连接池耗尽时的最大等待时间，默认 5000ms。

借用线程等待创建锁后会再次检查空闲连接，优先复用等待期间归还的连接，避免无必要的串行建连。扩容在锁内预留容量、锁外建立连接，正在建立的连接也计入上限；建连失败释放名额，初始化失败关闭原始连接。连接归还池前会回滚未提交事务；现有 `If-Match` CAS 和 `SELECT ... FOR UPDATE` 语义保持不变。

空闲连接借出前执行 `SELECT 1 FROM DUAL` 验证并回滚探测事务，探测超时由 `YASDB_STORAGE_POOL_VALIDATION_TIMEOUT_SECONDS` 控制（默认3秒）。心跳失败或断网后的无效连接关闭并释放容量，借用在既有等待预算内重新取连接；归还时回滚失败也必须释放容量，避免池永久耗尽。只恢复连接，不自动重放任何业务读写；事务执行期间断线仍由调用方收到失败。

### 大纲与建设任务存储契约

自然路径模板以 `content.nodes` 保存混合根目录/文件和实际深度，`OutlineNodeSnapshot` 负责无数据库依赖的结构校验。导入快照使用 `insertOnly: true`，只提交新候选；已存在版本拒绝覆盖，不更新当前版本指针、不改写旧节点/责任项，不执行 DDL 或数据迁移。旧 parts/chapters 快照保持兼容。

大纲治理读取一次性加载技术领域名称并复用于全部文档责任投影，禁止按文档或文档领域组合重复查询 `KC_TECH_DOMAIN`。该优化只改变查询次数，不改变节点、领域、人员或任务字段。

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

记录 GET 响应携带基于 revision 的 `ETag`，支持 `If-None-Match`：版本一致时只查询元数据并返回 304，避免重复读取大正文 CLOB。记录变化或删除会使用新 revision；不存在仍返回原 404 错误。该机制不改变 PUT/DELETE 的 `If-Match` 乐观锁及权限契约。Node 异步读取每次仍向 Storage 校验，不依赖固定时间缓存。

认证用户名册批量读取使用三次固定SQL（全部用户授权、用户主体、可分配角色），避免按用户逐条读取角色造成N+1；不缓存权限。隔离Storage回归逐项比较批量与单用户角色、模块、动作、状态及行版本。

HTTP 服务默认设置 `sun.net.httpserver.nodelay=true`，减少持久连接上小响应的传输等待；可通过 JVM `-Dsun.net.httpserver.nodelay=false` 显式覆盖。

HTTP 请求校验并返回 `X-Request-ID`、`X-Correlation-ID`（仅接受 1–128 位字母、数字及 `._:-`）。请求生命周期和错误事件输出 JSON；失败事件含稳定错误码、异常类型/脱敏堆栈及适用的 SQLState/vendorCode。使用 `knowledge-center.sh logs collect --request-id <id>` 或 `--correlation-id <id>` 可生成诊断包。真实数据库故障验收须使用专用测试实例，不能以本地假服务替代。

## 手册按需读取

`GET /v1/domain/outlines/:id/directory` 仅查询当前大纲目录与有效分工，不读取说明 CLOB 或全局治理数据。`GET /v1/records/handbook-production/state?draftKey=<上下文键>` 返回单篇当前草稿，不返回历史、其他草稿或 AI 任务。服务在监听前预热可丢弃索引，聚合写入提交后同步发布索引，每次读通过数据库 revision 校验；跨实例变更返回可重试 503 并单飞重建，失败不会伪装成空草稿。无数据库结构变更。发布时应先更新 Storage，再更新调用方；旧 Storage 兼容提取仍会读取全聚合，不满足性能目标。详见 [按需读取设计](../../.codex/知识中心建设平台/03-详细设计/知识中心-文档生产-按需读取与性能-详细设计文档.md)。

目录投影读取提供 `Server-Timing`：连接获取、版本头、节点、责任人和总处理耗时，不包含正文或凭据，用于定位运行实例尾延迟。目录节点和责任映射按大纲版本编辑号短时缓存；每次请求仍读取版本头，版本变更会自动错过缓存。缓存默认最多保留 256 个条目，写入新条目前清理过期条目，避免长期运行因历史编辑版本持续增加内存占用。JSON 响应在客户端声明支持 gzip 且原文达到 1KB 时协商压缩，并保留 `Vary: Accept-Encoding`，不改变业务 JSON 契约。Storage 默认使用 16 个工作线程和连接上限，以覆盖 10 路读取门禁，部署可通过 `YASDB_STORAGE_THREADS`、`YASDB_STORAGE_POOL_MAX` 调整。

2026-11-09：轻量目录的有效文档分工项增加 `domainRole`，供任务管理区分主责与协作并预选存量文档负责人；沿用现有 `KC_MANUAL_OUTLINE_RESP_ITEM.DOMAIN_ROLE`，无 DDL 和历史数据回填。

## 2026-11-02 普通聚合记录冷读

`GET /v1/records/:namespace/:key` 的 CLOB 改用批量 `getSubString`，配置 `YASDB_RECORD_CLOB_CHUNK_CHARS`（默认1048576字符）。按实际读取字符推进，空片段中止，保留原记录结构、ETag/304、提交和权限契约。200响应增加 `record_query`、`record_clob`、`record_parse` 的 Server-Timing；不含连接借用与完整序列化，不能当作全链路时间。其他 CLOB 读取入口不在本轮范围；无需DDL或迁移。回退使用原构建 Java 产物，保留进程环境与 SQL 目录。证据见 `runtime/diagnostics/task-performance-fix-20261102/`。

2026-11-04：`handbook-production/state` 写入前校验旧值时，复用同一分块 CLOB 读取函数。隔离 `test_hy` 中 3.6 MB 等长内容的逐流读取为 6.3–9.3 秒，分块读取为 0.31–0.44 秒，正文逐字相等；写入、版本锁、引用校验与记录格式不变。实际平台保存和附件上传仍须在更新存储进程后分别复测。

后续实际 13510 本人专用数据复测已完成：保存五次 P50/P95 为 842/846.5ms，54 字节附件上传五次为 831.2/914ms，正文及附件回读一致。运行实例已加载候选存储类；数据量扩大和并发性能需另测。原始证据位于 `runtime/diagnostics/workbench-acceptance-20261104/`。
