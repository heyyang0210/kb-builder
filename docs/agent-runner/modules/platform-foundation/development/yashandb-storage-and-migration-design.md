# YashanDB 数据存储与迁移开发设计

> 状态：实施基线  
> 日期：2026-09-02  
> 适用数据库：YashanDB Enterprise 23.4.7.100，单机、yashan 模式  
> 目标 Schema：由运行配置提供；当前环境确认使用 `regress`

## 1. 目标与边界

本设计把认证、手册资产、大纲、文档评论、增量构建和工作流等现有 JSON 状态逐步迁入 YashanDB。现有 Node.js 业务 API 保持兼容，业务代码通过仓储接口访问数据，不直接依赖表名或 Linux 路径。

首个实施阶段采用“兼容记录仓储”：把每个现有聚合的完整 JSON 作为一个带版本、摘要和软删除标记的数据库记录保存。这样可以先消除多个进程直接改写 JSON 文件产生的锁竞争和损坏风险，并保留无损导出能力。Node.js 已通过统一聚合仓储接入 `file|database` 模式；数据库模式下手册资产、大纲、认证、文档元数据/评论、增量构建和工作流均走 Java JDBC 服务。后续再按业务查询和事务边界，把手册、大纲版本、目录条目、文档版本等拆成规范化领域表；规范化表不能破坏兼容记录的导出语义。

本阶段不把以下字节直接迁入关系表：原始附件、PDF、图片、大型生成中间产物、向量文件和测试产物。数据库保存它们的稳定 ID、路径、摘要、大小、MIME、权限和生命周期；正文是否使用 CLOB 在容量与恢复验证后分批决定。

## 2. 已确认环境

| 项目 | 值或规则 |
|---|---|
| 数据库服务 | 运行时配置，不写入源码 |
| 数据库版本 | 23.4.7.100 |
| 部署模式 | 单机 |
| 运行模式 | yashan |
| Schema | `regress` |
| 账号权限 | 当前迁移账号具备 DBA 权限；应用运行期应另行收敛到最小权限账号 |
| Java 服务 | 允许新增独立 JDBC 数据访问服务 |
| 完整导出 | 必须支持数据库记录、版本、摘要和删除状态的无损导出 |

密码只能由 `YASDB_PASSWORD` 或等价密钥注入提供，不得出现在源码、设计文档、日志、命令输出和仓库配置中。

### 运行配置迁移约束

知识中心的配置控制面统一位于 `config/knowledge-center/`，只保留 `product.json`、`service.json`、`content-rules.json` 三份业务配置，分别回答产品是什么、服务怎样运行和内容怎样处理。目录重构时必须同时迁移配置文件、资源引用和加载入口，不能依赖进程当前工作目录寻找配置。知识中心 Node 入口固定发现 `config/knowledge-center/.env`，调用方显式注入的环境变量优先，敏感凭证仍由环境变量或密钥系统提供。

GitLab 连接记录 `runtime/knowledge-center/gitlab-connections.json` 属于运行态事实源，迁移时必须保留连接 ID、项目路径、认证模式、凭证引用和手册映射；不得用空模板覆盖已有记录。知识资产和模板库同样位于 `runtime/knowledge-center/`，发布静态配置时不得覆盖。

平台管理页的系统治理摘要必须由 `/knowledge-center/api/platform/context`、`/knowledge-center/api/platform/overview` 及 GitLab 连接验证投影派生，不能用静态“服务正常”占位值覆盖真实降级状态。终态连接验证失败、凭证缺失和模块不可用必须进入待处理事项；凭证只从环境变量或密钥系统注入，页面和日志不得显示 Token。

## 3. 入库分类

| 命名空间 | 当前来源 | 记录键 | 说明 |
|---|---|---|---|
| `auth` | `tmp/knowledge-center-auth.json` | `state` | 用户、会话、CAS 已消费票据和认证审计的完整聚合 |
| `assets` | `config/knowledge-assets.json` | `catalog` | 手册资产、负责人、状态、说明和资产审计 |
| `outlines` | `outlines/metadata.json` | `metadata` | 大纲元数据、大纲版本和目录条目投影 |
| `documents` | `tmp/doc-processed/metadata.json` | `metadata` | 文档索引和版本元数据 |
| `documents` | `data/document-comments.json` | `comments` | 文档评论聚合 |
| `incremental` | `tmp/incremental-build-state.json` | `state` | 增量构建、发布、幂等和审计状态 |
| `workflows` | `workflows/*.json` | 文件名去扩展名 | 工作流定义 |

静态启动配置、模型密钥、数据库密码、OAuth Secret 和证书私钥不进入业务记录表。

## 4. 逻辑架构

```text
现有 Node.js API
    │
    ├─ 领域仓储接口
    │      │
    │      └─ HTTP Record Store Client
    │                 │
    │                 ▼
    │       Java YashanDB Storage Service
    │                 │ JDBC
    │                 ▼
    └────────────── YashanDB

迁移工具：只读源 JSON → 摘要 → 幂等 PUT → 回读摘要对账
导出工具：数据库一致性快照 → manifest + 全部记录 → SHA-256
```

Node.js 不使用非官方数据库驱动，也不通过进程内 JVM 桥接。Java 服务是唯一 JDBC 边界，负责参数化 SQL、事务、乐观并发、Schema 初始化、健康检查和导出。

## 5. 表结构

建表语句不内嵌在 Java 源码，统一存放于 `apps/yashandb-storage/sql/`，并按数字前缀排序执行。SQL 文件保留便于 DBA 执行的分号；服务执行前会移除末尾分号，因为 YashanDB JDBC 的 `Statement.execute` 不接受 SQL 末尾分号。服务只读取 `YASDB_STORAGE_SQL_DIR` 指定目录内的固定文件名；生产迁移时先审核 SQL 文件，再由同一目录复用，避免测试环境和生产环境出现两套 DDL。

### 5.1 `KC_SCHEMA_MIGRATION`

记录已经应用的数据库结构版本：

```sql
CREATE TABLE KC_SCHEMA_MIGRATION (
  VERSION_ID VARCHAR(64) PRIMARY KEY,
  CHECKSUM VARCHAR(64) NOT NULL,
  APPLIED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

### 5.2 `KC_RECORD`

```sql
CREATE TABLE KC_RECORD (
  NAMESPACE VARCHAR(64) NOT NULL,
  RECORD_KEY VARCHAR(256) NOT NULL,
  PAYLOAD CLOB NOT NULL,
  PAYLOAD_SHA256 CHAR(64) NOT NULL,
  REVISION BIGINT DEFAULT 1 NOT NULL,
  DELETED CHAR(1) DEFAULT 'N' NOT NULL,
  CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT PK_KC_RECORD PRIMARY KEY (NAMESPACE, RECORD_KEY),
  CONSTRAINT CK_KC_RECORD_DELETED CHECK (DELETED IN ('N', 'Y'))
);
```

`REVISION` 用于乐观并发；`PAYLOAD_SHA256` 用于迁移和导出对账。删除默认使用软删除，导出必须包含软删除记录。

### 5.3 `KC_MIGRATION_BATCH`

```sql
CREATE TABLE KC_MIGRATION_BATCH (
  BATCH_ID VARCHAR(64) PRIMARY KEY,
  SOURCE_KIND VARCHAR(32) NOT NULL,
  STATUS VARCHAR(24) NOT NULL,
  RECORD_COUNT BIGINT DEFAULT 0 NOT NULL,
  SOURCE_SHA256 CHAR(64),
  RESULT_SHA256 CHAR(64),
  STARTED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  COMPLETED_AT TIMESTAMP,
  ERROR_SUMMARY VARCHAR(2000)
);
```

迁移状态只允许 `RUNNING/SUCCEEDED/FAILED`。失败批次不改变在线主写路由。

## 6. 内部 HTTP 契约

Java 服务仅监听内部地址，默认端口由 `YASDB_STORAGE_PORT` 配置。

| 方法与路径 | 用途 |
|---|---|
| `GET /health` | 检查进程和数据库连通性，不返回凭据 |
| `GET /v1/records/{namespace}/{key}` | 读取记录、摘要和 revision |
| `PUT /v1/records/{namespace}/{key}` | 新增或覆盖；可使用 `If-Match` 提交期望 revision |
| `DELETE /v1/records/{namespace}/{key}` | 软删除；必须使用 `If-Match` |
| `GET /v1/export` | 导出所有记录，包括软删除记录 |

工作流在数据库模式下不依赖本地 JSON 文件枚举，使用 `YASDB_WORKFLOW_IDS` 提供已登记的记录键清单；迁移到生产时必须同步更新该运行配置，或在后续版本增加数据库记录目录表。

写入请求体就是原始 JSON 聚合。成功响应返回：

```json
{
  "success": true,
  "namespace": "assets",
  "key": "catalog",
  "revision": 2,
  "sha256": "...",
  "updatedAt": "..."
}
```

revision 不一致返回 `409 REVISION_CONFLICT`；记录不存在返回 `404 RECORD_NOT_FOUND`；数据库不可用返回 `503 DATABASE_UNAVAILABLE`。

## 7. 导入与切换

迁移必须以源元数据为无损事实源：未完成数量、摘要和回读对账前不得清空或覆盖既有大纲记录。迁移失败时保持原始文件可读，不执行不可逆的删除。

```text
for each 已登记源文件:
  读取原始字节并解析 JSON
  生成规范化 JSON 和 SHA-256
  PUT 到目标 namespace/key
  GET 回读并比较 payload 与 SHA-256
  写入迁移批次结果

if 所有记录数量、摘要和必填关系一致:
  将运行配置切换为 database
  源文件改为只读备份
else:
  保持 file 主写
  输出差异，不执行切换
```

长任务进入终态（包括 `cancelled`）后不得继续占用 `activeTaskIds`。取消后批次状态由页面摘要和同批次其他活动任务共同决定：仍有未完成/失败页面时保持 `downloading`，否则为 `downloaded`。

共享配置中的外部生产服务地址不得被本地默认值覆盖。本地开发应通过配置初始化脚本或运行时覆盖实现，不改写共享生产配置。

不采用长期双写。迁移命令是离线、可重复、幂等的；在线运行时由 `KNOWLEDGE_STORAGE_MODE=file|database` 决定唯一主写目标。切换到 `database` 后，业务仓储调用失败直接返回存储不可用，不回写旧 JSON。

## 8. 完整导出

`GET /v1/export` 在一个只读事务中导出：

```json
{
  "exportSchemaVersion": 1,
  "exportedAt": "2026-09-02T00:00:00Z",
  "databaseProduct": "YashanDB",
  "records": [
    {
      "namespace": "assets",
      "key": "catalog",
      "revision": 1,
      "deleted": false,
      "sha256": "...",
      "createdAt": "...",
      "updatedAt": "...",
      "payload": {}
    }
  ]
}
```

导出顺序固定为 `namespace, key`，确保同一数据库状态生成稳定内容。导出工具额外生成整个导出文件的 SHA-256；恢复时逐条校验记录摘要。导出不包含数据库密码、密钥环境变量和外部文件字节。

## 9. 原生 exp/imp 迁移脚本

知识中心数据库用户的同构迁移使用仓库根目录的 `scripts/export-knowledge-center-yashandb.sh` 和 `scripts/import-knowledge-center-yashandb.sh`。导出脚本固定采用 `OWNER` 与 `ROWS=Y`，导入脚本采用 `FROMUSER/TOUSER`，默认不启用 `TRUNCATE`，避免覆盖目标表已有数据。

两个脚本均不保存账号密码；连接信息通过 `YASDB_EXP_*`、`YASDB_IMP_*` 环境变量提供，缺少密码时交互式读取。脚本执行前展示数据库地址、用户和文件并要求确认。真实迁移前必须确认源/目标数据库版本兼容、操作账号权限和目标用户映射；脚本生成和语法验证不代表已经完成真实数据库导出或导入。

## 10. JDBC 与版本风险

真实连接验证表明 Maven Central `com.yashandb:yashandb-jdbc:1.6.1` 可以连接 YashanDB 23.4.7.100。驱动返回的元数据版本字符串为 `1.5-SNAPSHOT`，与制品版本不一致，因此：

1. 运行配置固定实际 Jar 的 SHA-256，不只依赖元数据字符串。
2. 上线前验证事务提交/回滚、CLOB 大小、中文、并发冲突、断线恢复和完整导出。
3. 获取官方兼容矩阵后才能升级驱动；升级必须重复上述回归。

## 11. 安全与权限

- 当前 DBA 账号仅用于受控初始化和迁移；运行期应创建只拥有 `KC_*` 对象权限的应用账号。
- Java 服务不得记录 JDBC URL 中的用户名、密码或请求正文。
- 内部 API 只监听回环或受控服务网段；对外网关不代理 `/v1/export`。
- SQL 标识符来自固定迁移脚本，业务值全部使用 `PreparedStatement`。
- 导出文件按敏感业务数据管理，默认权限不高于 `0600`。

## 12. 验收

- 真实数据库健康检查成功并显示 23.4.7.100。
- 中文、空值、嵌套数组和至少 1 MB JSON 可写入并原样回读。
- 事务回滚后不存在半写状态。
- 两个相同 revision 的并发写入只有一个成功。
- 所有已登记 JSON 源均完成数量和 SHA-256 对账。
- Node.js 业务 API 在 database 模式下通过现有回归测试。
- `KNOWLEDGE_STORAGE_MODE=database` 下认证、资产、大纲、文档、工作流和增量构建的读写均不触碰对应 JSON 主源。
- 导出包含全部命名空间、软删除记录、revision、摘要和 payload；导出后可在隔离 Schema 恢复并再次得到一致摘要。
- 停止 Java 服务时，业务 API 明确返回存储不可用，不静默回写旧文件。
## 运行目录约束（2026-09-11）

当前运行数据根为 runtime/，替代 var/；知识资产根为 knowledge/，数据库连接配置仍在 config/yashandb/。迁移源元数据不得清空，取消等终态任务不得占用活动列表，生产 MCP 服务地址不得被本地默认值覆盖，密码与密钥仅外部注入。runtime 被 Git 忽略不代表数据可删除，持久状态必须备份。
### 知识资产数据源一致性

知识资产源文件 `runtime/knowledge-center/knowledge-assets.json` 与数据库 `assets/catalog` 必须在切换数据库模式前完成数量和内容摘要对账。服务启动时在数据库模式执行只读检查；发现不一致仅告警并指向受控迁移，不自动覆盖任何一侧，避免页面静默显示空列表。
#### 连接复用与锁边界

存储服务使用轻量 JDBC 连接池复用数据库会话，避免每个 HTTP 请求执行 `DriverManager.getConnection`。连接池只负责生命周期，不改变事务边界：请求结束归还连接前回滚未提交事务；`SELECT ... FOR UPDATE` 仍仅在写事务内持有至提交，以保证 CAS 正确性。`YASDB_STORAGE_POOL_MIN/MAX` 控制预热和上限。后续如需更高并发，可替换为 HikariCP 等成熟池实现并保持相同配置语义。

Node 存储访问同时提供异步 HTTP 读取路径，模板列表优先使用异步读取，避免同步子进程阻塞事件循环；写事务暂保留同步路径以维持兼容性。模板列表使用摘要投影，正文与历史版本按模板 ID 延迟读取；完整的元数据/正文拆分需要后续数据库迁移，本批次不改变既有聚合格式。

#### 隔离重启与 Java 编译缓存（2026-09-15）

根目录 `knowledge-center.sh` 将 `apps/yashandb-storage` 作为知识中心业务存储服务统一启停，但不操作 YashanDB 数据库实例。存储 Java 源码启动前编译 `Main.java` 和 `StorageSchemaDao.java` 到 `runtime/agent-runner/.runtime` 下的 SHA-256 指纹目录；有 `javac` 时优先使用，仅有 JRE 但包含 `jdk.compiler` 时通过模块调用编译器，避免使用不受 Java 17 支持的 `--source-path`。

重启脚本的 readiness 同时校验 PID、服务命令身份、端口监听旧进程和 HTTP 健康；不会因旧进程占端口而将新进程失败误判为就绪。已知进程可受控停止，未知占用仍保留现场并终止重启；启动任一环节失败时按反向顺序回滚已启动服务。
