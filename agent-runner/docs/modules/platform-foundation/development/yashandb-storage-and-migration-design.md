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

建表语句不内嵌在 Java 源码，统一存放于 `agent-runner/services/yashandb-storage/sql/`，并按数字前缀排序执行。SQL 文件保留便于 DBA 执行的分号；服务执行前会移除末尾分号，因为 YashanDB JDBC 的 `Statement.execute` 不接受 SQL 末尾分号。服务只读取 `YASDB_STORAGE_SQL_DIR` 指定目录内的固定文件名；生产迁移时先审核 SQL 文件，再由同一目录复用，避免测试环境和生产环境出现两套 DDL。

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

## 9. JDBC 与版本风险

真实连接验证表明 Maven Central `com.yashandb:yashandb-jdbc:1.6.1` 可以连接 YashanDB 23.4.7.100。驱动返回的元数据版本字符串为 `1.5-SNAPSHOT`，与制品版本不一致，因此：

1. 运行配置固定实际 Jar 的 SHA-256，不只依赖元数据字符串。
2. 上线前验证事务提交/回滚、CLOB 大小、中文、并发冲突、断线恢复和完整导出。
3. 获取官方兼容矩阵后才能升级驱动；升级必须重复上述回归。

## 10. 安全与权限

- 当前 DBA 账号仅用于受控初始化和迁移；运行期应创建只拥有 `KC_*` 对象权限的应用账号。
- Java 服务不得记录 JDBC URL 中的用户名、密码或请求正文。
- 内部 API 只监听回环或受控服务网段；对外网关不代理 `/v1/export`。
- SQL 标识符来自固定迁移脚本，业务值全部使用 `PreparedStatement`。
- 导出文件按敏感业务数据管理，默认权限不高于 `0600`。

## 11. 验收

- 真实数据库健康检查成功并显示 23.4.7.100。
- 中文、空值、嵌套数组和至少 1 MB JSON 可写入并原样回读。
- 事务回滚后不存在半写状态。
- 两个相同 revision 的并发写入只有一个成功。
- 所有已登记 JSON 源均完成数量和 SHA-256 对账。
- Node.js 业务 API 在 database 模式下通过现有回归测试。
- `KNOWLEDGE_STORAGE_MODE=database` 下认证、资产、大纲、文档、工作流和增量构建的读写均不触碰对应 JSON 主源。
- 导出包含全部命名空间、软删除记录、revision、摘要和 payload；导出后可在隔离 Schema 恢复并再次得到一致摘要。
- 停止 Java 服务时，业务 API 明确返回存储不可用，不静默回写旧文件。
