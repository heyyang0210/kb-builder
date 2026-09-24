# 知识中心认证权限与 GitLab 配置集中化迁移详细设计

> 设计编号：KC-DB-PLATFORM-CENTRALIZE-001
> 状态：目标表结构与一次性数据导入已完成；旧配置只读保留，应用主写切换待独立实施与验证
> 版本：0.6.0
> 日期：2026-09-22
> 适用数据库：YashanDB 23.4
> 上游盘点：[知识中心页面数据存储现状与集中化路线](./知识中心-页面数据存储现状与集中化路线-详细设计文档.md)

## 1. 结论先行

当前需要迁移的是团队共享业务事实，不是所有运行时记录：

1. 认证权限主数据：用户、角色、角色授权和用户角色关系。
2. GitLab 平台配置：连接和手册映射，包括允许的分支与中英文路径。

登录会话、CAS Ticket 消费记录、连接验证历史、幂等缓存和审计属于运行时状态或日志，不纳入本次业务主数据迁移；继续保存在本地受控运行目录，通过 TTL、文件轮转和访问权限治理。

采用“YashanDB 业务表 + 本地运行时记录”的分层方案。本次最小基线新增 8 张业务表：4 张认证权限表、4 张 GitLab 连接与映射表。关联完整性由唯一约束、Repository 事务、写前校验和巡检共同保证。

上一版将“当前配置集中化”与“未来历史配置回放”合并设计，提前引入连接版本、映射版本和内容快照 3 张表，与当前源 JSON 和已实现页面能力不匹配，属于过度设计。本版已将它们移出实施基线：当前只保存有效配置、完整分支集合、默认分支、中英文路径和配置摘要；真正出现历史回放业务后再通过新版本 SQL 扩展。

实施顺序建议为：先建表和只读对账，再切 GitLab 连接与映射，之后切用户与角色。会话和日志不切入数据库。若未来需要多实例无感共享会话，应单独评审粘性会话、统一认证网关或专用共享会话存储，不能借本次迁移顺带扩张范围。

本稿定义目标结构、迁移步骤和验收标准。当前已完成目标表创建和一次性真实数据导入；认证、权限和运行时主写切换仍需按独立变更执行，不能因数据已导入而自动切换应用读写路径。

### 1.1 已确认决策

| 决策项 | 用户结论 | 对设计的约束 |
| --- | --- | --- |
| 运行时记录 | 会话、Ticket、认证审计、幂等和 GitLab 审计只做本地归档 | 数量以维护窗口冻结快照为准；不设计对应数据库表，不导入 YashanDB |
| 会话与审计权威源 | 采用评审方案 B：用户和角色入库，会话、Ticket 与日志保留本地 | 当前只承诺单活 BFF；多实例会话另立专项，不允许声称已共享 |
| GitLab 映射模型 | 保留方案 A 的“完整分支、默认分支、中英文路径和指纹无损保存”，不在本次预建历史版本/快照表 | 当前配置可逆对账；历史回放按业务触发条件后续扩展，不伪造源 JSON 不存在的事实 |
| 平台序列演进 | 采用评审方案 B：新建 `KC_PLATFORM_SEQ` 并行过渡，先切默认值，稳定后再审批废弃旧序列 | 本次迁移不直接删除 `KC_PRINCIPAL_SEQ` |
| 公共 API | 存储切换不新增 `/v2`，保持既有路径和 DTO 兼容；补齐并发、幂等和错误语义 | API 契约是前后端兼容门禁，不是新增业务功能 |
| 迁移方式 | 一次性维护窗口：冻结配置写入、离线导入、摘要对账、切换数据库主写 | 迁移程序不进入正常请求链路，不提供运行期文件回退 |
| 本地保留策略 | 采用评审方案 A：会话 7 天、Ticket 24 小时、幂等 7 天、JSONL 单文件 100 MB/保留 30 天并提供容量告警 | 首次清理既有真实记录仍需单独确认执行窗口 |
| 本地应急管理员 | 开发环境继续保留 | 账号信息保存在本地环境，不迁入 `KC_AUTH_USER`，生产环境策略不在本次范围 |
| CAS 扩展属性 | `email/employeeNo` 不进入目标账号表 | CAS 登录名作为长期唯一且不回收的身份标识 |
| 本次运行时切换 | 认证权限与 GitLab 配置在同一维护窗口同时切换 | 任一领域验收失败时整体不放行；内部开关仅用于故障定位 |
| 本地运行时拆分 | 与业务 Repository 切换同步完成 | 只复制并切换新文件，不删除旧 JSON，不在本次执行首次 TTL 清理 |

## 2. 当前“会话”和“审计”的真实含义

### 2.1 2026-09-18 盘点中的 1275 条会话不是 1275 个在线用户

当前 `sessions` 每完成一次本地账号或 CAS 登录就追加一条记录：

| 字段 | 含义 |
| --- | --- |
| `idHash` | 浏览器 Cookie 中随机会话令牌的 SHA-256 摘要，不保存令牌明文 |
| `userId` | 当前 JSON 用户的字符串标识 |
| `authMethod` | `local` 或 `cas` |
| `createdAt` | 会话创建时间 |
| `expiresAt` | 会话失效时间，当前默认有效期 8 小时 |
| `revokedAt` | 用户主动退出时写入的注销时间 |

截至 2026-09-18 的只读盘点结果：

| 状态 | 数量 | 说明 |
| --- | ---: | --- |
| 累计创建 | 1275 | 2026-08-31 至 2026-09-18 的历史登录次数，不是用户数 |
| 已过期 | 1183 | 超过 `expiresAt`，已不能认证，但仍留在文件中 |
| 已注销 | 46 | 用户调用退出接口后标记 `revokedAt`；可能同时也已过期 |
| 当时仍有效 | 88 | 未注销且未过期，只表示会话记录有效，不等价于 88 人同时操作页面 |

文件没有定时清理，因此过期会话持续累计；每次查找会话都需要在数组中线性查找。这说明需要增加本地 TTL 清理和索引友好的运行时存储，但不构成把会话放入业务数据库的理由。

### 2.2 2026-09-18 盘点中的 2563 条审计主要是认证生命周期日志

当前 `audits` 的结构为 `id/action/userId/result/details/at`，只记录认证模块事件，不是全平台所有业务操作。实测分布如下：

| 动作 | 数量 | 含义 |
| --- | ---: | --- |
| `SESSION_CREATED` | 1275 | 登录成功后创建了新会话 |
| `ADMIN_LOGIN` | 1222 | 本地账号登录尝试，包含成功和失败 |
| `SESSION_REVOKED` | 46 | 主动退出并撤销会话 |
| `USER_ROLES_UPDATED` | 11 | 管理员变更用户角色 |
| `CAS_USER_CREATED` | 7 | CAS 用户首次进入本平台 |
| `ADMIN_INITIALIZED` | 1 | 本地平台管理员初始化 |
| `BUILTIN_USER_INITIALIZED` | 1 | 内置测试用户初始化 |

其中成功 2550 条、失败 13 条。一次本地登录成功通常同时产生 `ADMIN_LOGIN` 和 `SESSION_CREATED` 两条记录，所以审计数量接近会话数量的两倍是当前实现行为，不代表发生了 2563 次独立业务变更。

当前审计最多保留 5000 条，超过后直接删除最早记录，且没有文件轮转、空间上限和明确保留周期。它应按本地结构化日志治理；需要跨机器检索时接入统一日志平台，而不是把每次运行事件写入业务数据库。

### 2.3 迁移前数量会变化，禁止硬编码历史盘点值

2026-09-22 的只读结构盘点已经显示：账号 13（CAS 11、本地 2），其中 CAS 账号已有人员关联 10、缺少人员关联 1；会话 2925、Ticket 119、认证审计已达到现有上限 5000；GitLab 连接 2、映射 2、幂等 28、审计 55。该变化证明 9 月 18 日的数量只能解释历史现状，不能作为迁移程序断言。

一次性迁移必须在维护窗口重新生成冻结清单。2 个本地账号不进入 `KC_AUTH_USER`；缺少 `PRINCIPAL_ID` 的 CAS 账号必须在迁移前完成唯一人员绑定，否则输出 `rejected` 并阻止认证领域切换。迁移程序不得为了满足数量自动创建人员或猜测绑定。

## 3. 设计底层逻辑

### 3.1 先按事实生命周期拆表

- 用户和角色是长期主数据。
- 用户角色是可变授权关系。
- GitLab 连接和手册映射是长期配置。
- 会话、CAS Ticket、连接验证和幂等键是短生命周期运行时状态。
- 认证和配置操作审计是只追加日志。

这些数据的生命周期不同：长期共享事实进入业务数据库，运行时状态与日志保留在本地运行目录，不能因为当前都在一个 JSON 文档中就采用同一种迁移策略。

### 3.2 人员与登录账号保持分离，但都在知识中心闭环

`KC_PLATFORM_PRINCIPAL` 表示“可被分配手册和领域责任的人”；`KC_AUTH_USER` 表示“可登录平台并被授予角色的安全账号”。两者通过数字 `PRINCIPAL_ID` 关联：

- 人员可以尚未登录，因此可能只有人员而没有账号。
- 本地应急管理员或技术账号可以登录，但不应出现在手册责任人候选列表中。
- CAS 用户首次登录时，在同一平台事务链路中查找唯一、启用的既有人员，再创建账号绑定；无匹配或多匹配时阻断登录，不自动新增人员。

这不是增加一个外部映射平台，而是在同一个知识中心数据库中区分“业务人员”和“认证账号”两类事实。

### 3.3 业务数据与运行时记录分层

| 数据 | 目标位置 | 设计依据 |
| --- | --- | --- |
| 用户、角色、授权关系 | YashanDB | 平台管理页面的共享业务配置，多人和多部署节点必须一致 |
| GitLab 连接、手册映射 | YashanDB | 团队共享业务配置，不能随运行机器变化 |
| 登录会话、CAS Ticket 摘要 | 本地运行时存储 | 短生命周期安全状态，按 TTL 清理；本次不改变会话架构 |
| 认证和 GitLab 操作审计 | 本地结构化日志 | 只追加运行日志，按轮转、权限和保留周期治理 |
| 连接验证结果 | 本地结构化日志和当前进程投影 | 属于探测结果；历史趋势应进入观测系统而非业务主表 |
| 幂等键 | 本地短期缓存 | 属于请求处理状态；跨实例强幂等需要单独评审协调组件 |

本次迁移不解决多个 BFF 实例共享会话的问题。若部署拓扑要求跨实例登录态一致，应在实施前另行确定粘性会话、统一认证网关或专用共享会话存储，不能默认由业务数据库承担。

### 3.4 数字 ID 负责内部关联，稳定字符串键负责兼容接口

所有新表使用 `BIGINT` 主键和关联键。为避免首轮迁移同时破坏现有 HTTP 契约，保留：

- `KC_AUTH_USER.USER_KEY`：兼容现有 `usr_*` 用户标识。
- `KC_GITLAB_CONNECTION.CONNECTION_KEY`：兼容现有 `gitlab-*` 连接标识。

字符串键只用于接口稳定标识和迁移对账，表间关联全部使用数字 ID。后续是否将公共 API 也切为数字 ID，应作为独立契约评审，不夹带在本次存储迁移中。

### 3.5 不使用物理外键

延续当前知识中心数据库约束：目标 DDL 不创建物理外键。必要性更高的约束通过以下方式实现：

1. 主键、唯一键、非空和枚举检查由数据库保证。
2. Repository 在同一事务内校验被引用对象存在、状态有效和版本未冲突。
3. 删除采用停用或撤销，不物理级联删除。
4. 每日巡检检查孤儿角色、孤儿映射和孤儿路径；发现异常告警，不自动猜测修复。

### 3.6 序列按业务边界管理

不为 8 张表创建 8 条序列。按已确认方案 B，新建 `KC_PLATFORM_SEQ`，新表先使用该序列；已有 `KC_PLATFORM_PRINCIPAL` 在同一版本 SQL 的后续步骤中切换默认值。旧序列在稳定期内保留，不在本次脚本中删除。目标态仍维持四个主业务序列：

| 序列 | 边界 |
| --- | --- |
| `KC_MANUAL_SEQ` | 手册及稳定大纲主体 |
| `KC_OUTLINE_SEQ` | 大纲结构版本与检查变更 |
| `KC_RESPONSIBILITY_SEQ` | 技术领域与责任映射 |
| `KC_PLATFORM_SEQ` | 人员、认证权限和平台业务配置 |

实施脚本必须先按平台边界所有相关表的最大 ID 计算新序列起点，再创建 `KC_PLATFORM_SEQ`、创建新表、切换 `KC_PLATFORM_PRINCIPAL` 默认值并验证。只有稳定期结束、确认所有默认值和代码均不再引用旧序列后，才能另行审批删除 `KC_PRINCIPAL_SEQ`。本设计不硬编码生产起点，也不把删除旧序列夹带到一次性数据导入中。

### 3.7 当前基线与后续演进的分层依据

表和字段使用三条准入规则：

1. 源 JSON 已存在且切换后仍需无损使用的业务事实，必须入库。
2. 数据库逐行更新必需的并发、状态和追溯字段，可以新增，但必须有明确读写场景。
3. 仅为尚未确认的未来功能服务、首次迁移必然为空、或无法从现有事实推导的表和字段，不进入本次基线。

| 层级 | 保留内容 | 底层依据 | 当前承诺 |
| --- | --- | --- | --- |
| 当前事实 | 连接、手册映射、启用分支、默认分支、中英文路径 | 已存在于 `gitlab-connections.json` 和现有前端 DTO | 无损迁移、可逆对账 |
| 数据库治理 | `ROW_VERSION`、`STATE`、创建/更新人与时间、`MAPPING_FINGERPRINT` | 解决并发覆盖、停用、审计定位和迁移对账 | 只表示“当前有效配置”，不代表历史版本 |
| 后续演进 | 连接版本、映射版本、提交快照引用 | 只有审阅任务必须回放历史仓库坐标时才成立 | 本次不创建表、不伪造 `version=1` 历史 |

后续若确认“任务/审阅必须在连接切换后仍精确回放当时的仓库、分支和路径”，再新增 `KC_GITLAB_CONNECTION_VERSION`、`KC_GITLAB_MAPPING_VERSION` 及快照引用表。迁移时可将当前稳定表投影为首个版本，但必须把其标记为“演进时创建的基线版本”，不声称它是迁移前真实存在的历史版本。

后续演进必须使用新的 Schema 版本，不回改本次表：

1. 新建连接/映射版本表，先不改当前读路径。
2. 在受控事务中把每条当前连接和映射复制为“基线版本”，沿用已有 `CONFIG_FINGERPRINT/MAPPING_FINGERPRINT` 作为对账键。
3. 为稳定主表增加当前版本指针，完成双读对账后再切读路径。
4. 新写入改为“创建新版本 + 切换指针”；稳定期后才停止直接修改当前字段。
5. 只有审阅契约真正引用提交和内容摘要时，再增加快照引用表；GitLab 正文仍不复制为平台主副本。

## 4. 候选方案比较

| 方案 | 做法 | 优点 | 主要问题 | 结论 |
| --- | --- | --- | --- | --- |
| A. 所有 JSON 原样迁入 `KC_RECORD` | 两个 JSON 各保存为一条 CLOB | 改造最快 | 把会话和日志也塞进数据库，仍有整包覆盖和并发冲突 | 不推荐 |
| B. 业务表 + 本地运行时记录 | 用户/角色/连接/映射关系化，会话和日志留在本地 | 业务事实集中，运行数据边界清晰，不新增基础设施 | 需拆分当前混合 JSON Repository | 推荐 |
| C. 数据库 + Redis/独立 IAM | 用户配置进数据库，会话进 Redis 或统一 IAM | 多实例会话一致性强 | 引入新服务、部署和故障边界，不属于本次迁移 | 后续会话专项候选 |

当前规模不是选择关系化的原因；真正原因是用户、角色、连接和映射属于团队共享事实。会话和日志即使数量增长，也不应因此进入业务主表，而应通过 TTL、轮转或日志平台治理。

## 5. 目标表清单

| 领域 | 表 | 单一职责 |
| --- | --- | --- |
| 认证 | `KC_AUTH_USER` | 登录账号及人员绑定 |
| 认证 | `KC_AUTH_ROLE` | 可分配角色目录 |
| 认证 | `KC_AUTH_ROLE_GRANT` | 角色拥有的模块或动作授权 |
| 认证 | `KC_AUTH_USER_ROLE` | 用户当前角色关系 |
| GitLab | `KC_GITLAB_CONNECTION` | GitLab 项目连接配置 |
| GitLab | `KC_GITLAB_MANUAL_MAPPING` | 一本手册到一个连接的当前有效映射和配置摘要 |
| GitLab | `KC_GITLAB_MAPPING_BRANCH` | 当前映射允许切换的完整分支集合 |
| GitLab | `KC_GITLAB_MAPPING_PATH` | 当前映射的中英文仓库路径 |

个人 GitLab OAuth Token 已经加密存储在 `KC_RECORD(namespace='gitlab-oauth')`，不属于本地 JSON 迁移范围。本轮不复制 Token、不改变加密密钥和 OAuth 行为；其关系化可另行评审。

```text
KC_PLATFORM_PRINCIPAL
  └─ KC_AUTH_USER
       └─ KC_AUTH_USER_ROLE ── KC_AUTH_ROLE ── KC_AUTH_ROLE_GRANT

KC_GITLAB_CONNECTION
  └─ KC_GITLAB_MANUAL_MAPPING（每本手册一个当前映射）
       ├─ KC_GITLAB_MAPPING_BRANCH（完整启用分支集合）
       └─ KC_GITLAB_MAPPING_PATH（ZH/EN 多路径）
```

## 6. 完整目标 DDL

以下是当前 8 张表的目标结构基线。本次可使用一个新的版本化 SQL 文件，例如 `010_platform_centralization.sql`，不需要为每张表或每个逻辑步骤拆文件。单文件内必须按“预检→创建序列→创建表/索引→写入稳定角色种子→切换人员表默认序列→后置校验”执行，并明确 YashanDB DDL 事务边界和失败后的人工恢复步骤。一次性 JSON 数据导入仍由独立工具执行，不嵌入 DDL 文件。已执行的 `005` 至 `009` 及未来已执行的 `010` 都不得回改；后续 Schema 演进使用新版本 SQL。

单文件不等于假设所有 DDL 可整体回滚。实施前必须在与生产同版本的 YashanDB 隔离库验证 DDL 是否隐式提交；若不能原子回滚，脚本必须在每个阶段前检查对象是否存在，并提供只删除本批次新建且尚无业务数据对象的受控恢复脚本。不允许在同一脚本中删除旧序列或清理源文件。

```sql
CREATE TABLE KC_AUTH_USER (
  AUTH_USER_ID BIGINT DEFAULT KC_PLATFORM_SEQ.NEXTVAL NOT NULL,
  USER_KEY VARCHAR(64) NOT NULL,
  PRINCIPAL_ID BIGINT NOT NULL,
  CAS_LOGIN_NAME VARCHAR(128) NOT NULL,
  STATE VARCHAR(16) DEFAULT 'ACTIVE' NOT NULL,
  ROW_VERSION BIGINT DEFAULT 1 NOT NULL,
  CREATED_BY VARCHAR(128) NOT NULL,
  CREATED_AT TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  UPDATED_BY VARCHAR(128) NOT NULL,
  UPDATED_AT TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT PK_KC_AUTH_USER PRIMARY KEY (AUTH_USER_ID),
  CONSTRAINT UK_KC_AUSER_KEY UNIQUE (USER_KEY),
  CONSTRAINT UK_KC_AUSER_LOGIN UNIQUE (CAS_LOGIN_NAME),
  CONSTRAINT UK_KC_AUSER_PRINCIPAL UNIQUE (PRINCIPAL_ID),
  CONSTRAINT CK_KC_AUSER_STATE CHECK (STATE IN ('ACTIVE', 'INACTIVE', 'LOCKED')),
  CONSTRAINT CK_KC_AUSER_ROWVER CHECK (ROW_VERSION >= 1)
);

CREATE TABLE KC_AUTH_ROLE (
  AUTH_ROLE_ID BIGINT DEFAULT KC_PLATFORM_SEQ.NEXTVAL NOT NULL,
  ROLE_CODE VARCHAR(64) NOT NULL,
  ROLE_NAME VARCHAR(128) NOT NULL,
  DESCRIPTION VARCHAR(1000),
  STATE VARCHAR(16) DEFAULT 'ACTIVE' NOT NULL,
  IS_SYSTEM CHAR(1) DEFAULT 'Y' NOT NULL,
  ROW_VERSION BIGINT DEFAULT 1 NOT NULL,
  CREATED_BY VARCHAR(128) NOT NULL,
  CREATED_AT TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  UPDATED_BY VARCHAR(128) NOT NULL,
  UPDATED_AT TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT PK_KC_AUTH_ROLE PRIMARY KEY (AUTH_ROLE_ID),
  CONSTRAINT UK_KC_AROLE_CODE UNIQUE (ROLE_CODE),
  CONSTRAINT CK_KC_AROLE_STATE CHECK (STATE IN ('ACTIVE', 'INACTIVE')),
  CONSTRAINT CK_KC_AROLE_SYSTEM CHECK (IS_SYSTEM IN ('Y', 'N')),
  CONSTRAINT CK_KC_AROLE_ROWVER CHECK (ROW_VERSION >= 1)
);

CREATE TABLE KC_AUTH_ROLE_GRANT (
  ROLE_GRANT_ID BIGINT DEFAULT KC_PLATFORM_SEQ.NEXTVAL NOT NULL,
  AUTH_ROLE_ID BIGINT NOT NULL,
  GRANT_TYPE VARCHAR(16) NOT NULL,
  GRANT_CODE VARCHAR(128) NOT NULL,
  CREATED_BY VARCHAR(128) NOT NULL,
  CREATED_AT TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT PK_KC_AROLE_GRANT PRIMARY KEY (ROLE_GRANT_ID),
  CONSTRAINT UK_KC_ARGRANT_VALUE UNIQUE (AUTH_ROLE_ID, GRANT_TYPE, GRANT_CODE),
  CONSTRAINT CK_KC_ARGRANT_TYPE CHECK (GRANT_TYPE IN ('MODULE', 'ACTION'))
);

CREATE TABLE KC_AUTH_USER_ROLE (
  USER_ROLE_ID BIGINT DEFAULT KC_PLATFORM_SEQ.NEXTVAL NOT NULL,
  AUTH_USER_ID BIGINT NOT NULL,
  AUTH_ROLE_ID BIGINT NOT NULL,
  ASSIGNED_BY VARCHAR(128) NOT NULL,
  ASSIGNED_AT TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT PK_KC_AUSER_ROLE PRIMARY KEY (USER_ROLE_ID),
  CONSTRAINT UK_KC_AUROLE_VALUE UNIQUE (AUTH_USER_ID, AUTH_ROLE_ID)
);

CREATE TABLE KC_GITLAB_CONNECTION (
  GITLAB_CONNECTION_ID BIGINT DEFAULT KC_PLATFORM_SEQ.NEXTVAL NOT NULL,
  CONNECTION_KEY VARCHAR(64) NOT NULL,
  CONNECTION_NAME VARCHAR(128) NOT NULL,
  BASE_URL VARCHAR(1000) NOT NULL,
  PROJECT_PATH VARCHAR(512) NOT NULL,
  PATH_PREFIX VARCHAR(1000),
  DEFAULT_BRANCH VARCHAR(255) NOT NULL,
  RUN_MODE VARCHAR(16) NOT NULL,
  AUTH_MODE VARCHAR(32) NOT NULL,
  CREDENTIAL_REF VARCHAR(128),
  PURPOSE VARCHAR(16) NOT NULL,
  CONFIG_FINGERPRINT CHAR(64) NOT NULL,
  STATE VARCHAR(16) DEFAULT 'ACTIVE' NOT NULL,
  ROW_VERSION BIGINT DEFAULT 1 NOT NULL,
  CREATED_BY VARCHAR(128) NOT NULL,
  CREATED_AT TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  UPDATED_BY VARCHAR(128) NOT NULL,
  UPDATED_AT TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT PK_KC_GITLAB_CONN PRIMARY KEY (GITLAB_CONNECTION_ID),
  CONSTRAINT UK_KC_GLCONN_KEY UNIQUE (CONNECTION_KEY),
  CONSTRAINT UK_KC_GLCONN_NAME UNIQUE (CONNECTION_NAME),
  CONSTRAINT UK_KC_GLCONN_CONFIG UNIQUE (CONFIG_FINGERPRINT),
  CONSTRAINT CK_KC_GLCONN_MODE CHECK (RUN_MODE IN ('DISABLED', 'SANDBOX', 'PRODUCTION')),
  CONSTRAINT CK_KC_GLCONN_AUTH CHECK (AUTH_MODE IN ('USER_OAUTH', 'SERVICE_ACCOUNT')),
  CONSTRAINT CK_KC_GLCONN_PURPOSE CHECK (PURPOSE IN ('READ', 'READ_WRITE')),
  CONSTRAINT CK_KC_GLCONN_CRED CHECK (
    (AUTH_MODE = 'SERVICE_ACCOUNT' AND CREDENTIAL_REF IS NOT NULL)
    OR AUTH_MODE = 'USER_OAUTH'
  ),
  CONSTRAINT CK_KC_GLCONN_STATE CHECK (STATE IN ('ACTIVE', 'INACTIVE')),
  CONSTRAINT CK_KC_GLCONN_ROWVER CHECK (ROW_VERSION >= 1)
);

CREATE TABLE KC_GITLAB_MANUAL_MAPPING (
  GITLAB_MAPPING_ID BIGINT DEFAULT KC_PLATFORM_SEQ.NEXTVAL NOT NULL,
  MANUAL_ID BIGINT NOT NULL,
  GITLAB_CONNECTION_ID BIGINT NOT NULL,
  MAPPING_FINGERPRINT CHAR(64) NOT NULL,
  STATE VARCHAR(16) DEFAULT 'ACTIVE' NOT NULL,
  ROW_VERSION BIGINT DEFAULT 1 NOT NULL,
  CREATED_BY VARCHAR(128) NOT NULL,
  CREATED_AT TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  UPDATED_BY VARCHAR(128) NOT NULL,
  UPDATED_AT TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT PK_KC_GLMAPPING PRIMARY KEY (GITLAB_MAPPING_ID),
  CONSTRAINT UK_KC_GLMAPPING_MANUAL UNIQUE (MANUAL_ID),
  CONSTRAINT CK_KC_GLMAPPING_STATE CHECK (STATE IN ('ACTIVE', 'INACTIVE')),
  CONSTRAINT CK_KC_GLMAPPING_ROWVER CHECK (ROW_VERSION >= 1)
);

CREATE TABLE KC_GITLAB_MAPPING_BRANCH (
  MAPPING_BRANCH_ID BIGINT DEFAULT KC_PLATFORM_SEQ.NEXTVAL NOT NULL,
  GITLAB_MAPPING_ID BIGINT NOT NULL,
  BRANCH_NAME VARCHAR(255) NOT NULL,
  IS_DEFAULT CHAR(1) DEFAULT 'N' NOT NULL,
  CREATED_AT TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT PK_KC_GLMAP_BRANCH PRIMARY KEY (MAPPING_BRANCH_ID),
  CONSTRAINT UK_KC_GLMBRANCH_VALUE UNIQUE (GITLAB_MAPPING_ID, BRANCH_NAME),
  CONSTRAINT CK_KC_GLMBRANCH_DEFAULT CHECK (IS_DEFAULT IN ('Y', 'N'))
);

CREATE TABLE KC_GITLAB_MAPPING_PATH (
  MAPPING_PATH_ID BIGINT DEFAULT KC_PLATFORM_SEQ.NEXTVAL NOT NULL,
  GITLAB_MAPPING_ID BIGINT NOT NULL,
  LANGUAGE_CODE VARCHAR(8) NOT NULL,
  REPOSITORY_PATH VARCHAR(1000) NOT NULL,
  CREATED_AT TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT PK_KC_GLMAP_PATH PRIMARY KEY (MAPPING_PATH_ID),
  CONSTRAINT UK_KC_GLMPATH_VALUE UNIQUE (GITLAB_MAPPING_ID, LANGUAGE_CODE, REPOSITORY_PATH),
  CONSTRAINT CK_KC_GLMPATH_LANG CHECK (LANGUAGE_CODE IN ('ZH', 'EN'))
);

CREATE INDEX IX_KC_AUROLE_ROLE
  ON KC_AUTH_USER_ROLE (AUTH_ROLE_ID, AUTH_USER_ID);
CREATE INDEX IX_KC_GL_CONN_STATE
  ON KC_GITLAB_CONNECTION (STATE, CONNECTION_NAME);
CREATE INDEX IX_KC_GLMAPPING_CONN
  ON KC_GITLAB_MANUAL_MAPPING (GITLAB_CONNECTION_ID, MANUAL_ID);
CREATE INDEX IX_KC_GLMBRANCH_MAPPING
  ON KC_GITLAB_MAPPING_BRANCH (GITLAB_MAPPING_ID, BRANCH_NAME);
CREATE INDEX IX_KC_GLMPATH_MAPPING
  ON KC_GITLAB_MAPPING_PATH (GITLAB_MAPPING_ID, LANGUAGE_CODE);
```

### 6.1 无物理外键下的强制业务不变量

数据库约束不能完整表达下列跨行规则，Repository 必须在单一事务中加锁校验，巡检任务必须重复验证：

1. 手册映射引用的 `GITLAB_CONNECTION_ID` 必须存在且状态为 `ACTIVE`；手册必须唯一存在于 `KC_MANUAL`。
2. 每个生效映射必须至少有一个分支，且恰好一个 `IS_DEFAULT='Y'`；因为分支表只保存启用集合，默认分支天然必须属于该集合。
3. 每个生效映射至少有一条 `ZH` 或 `EN` 路径；路径规范化后不得为空、包含 `..` 或越过连接 `PATH_PREFIX`。
4. 替换映射时必须锁定映射主行，校验 `ROW_VERSION`，在同一事务内替换分支/路径子行、更新 `MAPPING_FINGERPRINT` 并递增版本号；不允许出现主行已更新但子行仍是旧配置的半写状态。
5. `CONFIG_FINGERPRINT=SHA-256(canonical connection payload)`；`MAPPING_FINGERPRINT=SHA-256(connectionKey + canonical branches/defaultBranch/paths)`。它们用于重复提交判定和迁移对账，不是历史版本号。摘要相同时 Repository 仍需比较规范化原文。

映射保存事务伪代码：

```text
lock connection by CONNECTION_KEY when connection fields are being changed
assert expected connection rowVersion matches
normalize repository coordinates and compute CONFIG_FINGERPRINT
update current connection fields and increment rowVersion

lock mapping by MANUAL_ID
assert expected rowVersion matches
validate active connection and normalized branches/paths
assert exactly one default branch in enabledBranches
fingerprint = sha256(connectionKey + canonical mapping payload)
if fingerprint equals current mapping: return current projection
delete current branch/path children
insert complete enabled branch set and normalized ZH/EN paths
update mapping connectionId/fingerprint and increment rowVersion
commit
```

### 6.2 字段必要性与来源矩阵

| 表/字段组 | 来源或使用场景 | 为什么必要 | 是否为过渡字段 |
| --- | --- | --- | --- |
| 连接的 `CONNECTION_KEY/NAME/BASE_URL/PROJECT_PATH/PATH_PREFIX/DEFAULT_BRANCH/RUN_MODE/AUTH_MODE/CREDENTIAL_REF/PURPOSE/STATE` | 对应现有 JSON 的 `id/name/host/project/pathPrefix/defaultBranch/mode/authMode/credentialRef/purpose/status` | 页面编辑、GitLab 读取和权限模式直接使用 | 否，是当前业务事实 |
| `CONFIG_FINGERPRINT` | 由上述连接字段规范化计算 | 迁移对账、拒绝重复项目配置 | 是演进键，但当前也有实际用途 |
| 映射的 `MANUAL_ID/GITLAB_CONNECTION_ID` | `handbookId/connectionId` 解析后的数字关联 | 保证一本手册只有一个当前连接 | 否 |
| `MAPPING_FINGERPRINT` | 连接键、完整分支集合、默认分支和路径规范化计算 | 支持幂等、对账，并为后续生成基线版本提供稳定摘要 | 是演进键，但不代表已实现历史版本 |
| 分支的 `BRANCH_NAME/IS_DEFAULT` | `enabledBranches[]/defaultBranch` | 当前页面支持多分支切换，默认分支必须可识别 | 否；`DISPLAY_NAME/BRANCH_KIND/HEAD_SHA_AT_PUBLISH` 已移除 |
| 路径的 `LANGUAGE_CODE/REPOSITORY_PATH` | `zhPaths[]/enPaths[]` | 中英文独立且均可多选 | 否；`PATH_SHA256` 已移除 |
| `ROW_VERSION` | 数据库乐观并发控制 | 两个管理员同时保存时防止静默覆盖 | 否，是存储切换后的必需字段 |
| `CREATED_*/UPDATED_*` | 迁移批次与后续操作人 | 支持问题定位和最小追溯 | 否 |

本次明确移除的过度设计：`KC_GITLAB_CONNECTION_VERSION`、`KC_GITLAB_MAPPING_VERSION`、`KC_GITLAB_CONTENT_SNAPSHOT`，以及当前源数据无依据的 `DISPLAY_NAME`、`BRANCH_KIND`、`HEAD_SHA_AT_PUBLISH`、`PATH_SHA256`。它们不是永久否定，而是延后到真实业务需求和读写契约成立时再设计。

## 7. 角色与授权种子

首批迁移将当前代码中的五个角色及模块/动作授权搬到数据库种子数据：

- `KNOWLEDGE_EDITOR`
- `OUTLINE_MANAGER`
- `REVIEWER`
- `TEMPLATE_EDITOR`
- `PLATFORM_ADMIN`

运行时不再以 JavaScript 常量作为角色授权的唯一事实源。代码可以保留默认常量用于空库启动保护和契约测试，但共享环境必须以数据库角色和授权记录为准；种子变更使用版本化 SQL，不允许页面任意创建系统角色。

## 8. 源数据到目标表映射

### 8.1 认证文件

| 当前 JSON | 目标 | 迁移规则 |
| --- | --- | --- |
| `users[]` 中 CAS 账号 | `KC_AUTH_USER` | 旧 `id` 写入 `USER_KEY`；仅迁移具有唯一 `PRINCIPAL_ID` 的 CAS 账号；缺失或冲突必须拒绝并阻断切换 |
| `users[]` 中本地账号 | 本地应急/测试账号存储 | 不进入 `KC_AUTH_USER`；继续受本地环境配置、启停和凭据轮换约束 |
| `users[].roles[]` | `KC_AUTH_USER_ROLE` | 按 `ROLE_CODE` 解析数字角色 ID |
| `sessions[]` | 保留在本地运行时 | 不进入数据库；按冻结时实际数量拆分并增加 TTL 清理 |
| `consumedTickets[]` | 保留在本地运行时 | 不进入数据库；按 CAS Ticket 安全窗口清理 |
| `audits[]` | 本地结构化日志 | 不进入数据库；按冻结快照导出为只读 JSONL 归档并保留摘要 |
| `email/employeeNo` | 默认不迁移 | 当前页面和权限判断不使用；若评审确认需要，必须明确权威源和展示场景后再加字段 |

### 8.2 GitLab 配置文件

| 当前 JSON | 目标 | 迁移规则 |
| --- | --- | --- |
| `connections[]` | `KC_GITLAB_CONNECTION` | 每条源连接写入一条当前配置；旧 `id` 写入 `CONNECTION_KEY`；规范化当前字段后计算 `CONFIG_FINGERPRINT`；`credentialRef` 只作为环境凭据引用，不迁移 Token |
| `lastVerification` | 本地结构化日志 | 不进入数据库；切换后重新验证连接，页面投影最新一次运行结果 |
| `mappings[]` | 映射主表、分支表、路径表 | `handbookId` 必须唯一命中 `KC_MANUAL.MANUAL_CODE`，`connectionId` 必须命中 `CONNECTION_KEY`；`enabledBranches[]` 全量拆行，`defaultBranch` 标记唯一默认；`zhPaths[]/enPaths[]` 分语言拆行 |
| 源映射不存在的 `fingerprint` | `KC_GITLAB_MANUAL_MAPPING.MAPPING_FINGERPRINT` | 对规范化后的连接稳定键、排序分支、默认分支、排序语言路径和规则版本计算，用于幂等与对账，不声称为历史版本 |
| 历史映射版本和内容快照 | 本次不建表、不迁移 | 源文件没有这些事实；不得伪造历史版本、提交 SHA 或抓取时间 |
| `idempotency[]` | 本地短期缓存 | 不进入数据库；按冻结快照和 TTL 清理，跨实例强幂等不在本次范围 |
| `audit[]` | 本地结构化日志 | 不进入数据库；按冻结快照转为只读 JSONL 归档并保留摘要 |

关键字段转换必须唯一：

| 源字段 | 目标字段 | 转换/拒绝规则 |
| --- | --- | --- |
| `users[].id` | `KC_AUTH_USER.USER_KEY` | 原样保存稳定键；空值或重复拒绝 |
| `users[].loginName` | `KC_AUTH_USER.CAS_LOGIN_NAME` | 去除首尾空白后保存；必须与人员 `CAS_LOGIN_NAME` 唯一匹配 |
| `users[].enterpriseSubject` | 一致性校验，不单独落列 | 规范化后必须与 `loginName` 一致；不一致视为身份歧义并拒绝 |
| `users[].enabled` | `KC_AUTH_USER.STATE` | `true → ACTIVE`，`false → INACTIVE`；其他类型拒绝 |
| `users[].createdAt/updatedAt` | 账号时间戳 | 合法时间原样保留；缺失时使用迁移时刻并在结果中标记 `derived` |
| 迁移批次 | `CREATED_BY/UPDATED_BY/ASSIGNED_BY` | 固定为 `migration:<batchId>`，不得冒充历史操作者 |
| `connections[].host/project` | 连接 `BASE_URL/PROJECT_PATH` | 规范化后纳入 `CONFIG_FINGERPRINT`；空值或非法 URL/路径拒绝 |
| `connections[].mode/authMode/purpose/status` | 对应大写枚举 | 分别允许 `disabled/sandbox/production`、`user_oauth/service_account`、`read/read_write`、`active/inactive`；未知值拒绝，不猜测降级 |
| `mappings[].handbookId` | `KC_GITLAB_MANUAL_MAPPING.MANUAL_ID` | 以 `KC_MANUAL.MANUAL_CODE` 精确查找；零命中或多命中拒绝 |
| `mappings[].connectionId` | 稳定连接 | 以 `CONNECTION_KEY` 精确查找；零命中或多命中拒绝 |

### 8.3 字段级对账口径

一次性迁移只处理当前源文件中已经存在的事实。对账规范如下：

| 对象 | 源规范化摘要 | 目标回读摘要 |
| --- | --- | --- |
| 用户 | `USER_KEY + PRINCIPAL_ID + CAS_LOGIN_NAME + STATE + sorted(roles)` | 用户、用户角色和角色代码连接查询后生成同一结构 |
| 连接 | `id/name/host/project/pathPrefix/defaultBranch/mode/authMode/credentialRef/purpose/status` | 按 `CONNECTION_KEY` 回读并还原字段名；不包含验证结果 |
| 映射 | `handbookId/connectionId/defaultBranch/sorted(enabledBranches)/sorted(zhPaths)/sorted(enPaths)` | 映射主表、分支和路径回读后还原同一结构 |

源和目标均使用 UTF-8、键名升序和数组字典序生成 canonical JSON，再计算 SHA-256。数量相同但摘要不同视为失败；任何源记录都必须产生 `migrated/rejected/ignored-with-reason` 结果。

## 9. 小步迭代迁移方案

### 迭代 0：评审与冻结

- 评审本文的业务边界、8 张表 DDL、本地运行时边界和回退方式。
- 冻结源 JSON 的字段契约，生成脱敏结构摘要和 SHA-256。
- 未获得批准前不创建表、不写真实数据、不改运行模式。

验收：形成有效审批记录，所有待决项有结论。

### 迭代 1：只新增结构和 Repository，不切主写

- 新增版本化 DDL、角色授权种子和数据库 Repository。
- 将认证 Repository 拆成“数据库用户授权”和“本地会话/票据/日志”两个接口，避免继续整体读写同一 JSON。
- 将 GitLab Connector 拆成“数据库连接映射”和“本地验证/幂等/日志”两个接口。
- 运行单元和集成测试；共享环境仍使用原文件主写。

验收：空库迁移可重复启动；8 张表和索引符合设计；API 既有路径和主要 DTO 保持兼容；运行日志不会写入数据库。

### 迭代 2：先迁 GitLab 配置

- 在短维护窗口内暂停 GitLab 配置写入。
- 只导入 2 个连接和 2 个映射；验证结果、幂等记录和审计不导入数据库。
- 用连接字段、映射数组展开结果和摘要进行逐条对账。
- 切换连接与映射 Repository 为数据库主写；原 JSON 中的业务配置改为只读备份，运行时记录写入独立本地文件。
- 调用真实连接列表、映射读取和连接验证 API；验证写请求幂等行为。

回退：在数据库切换后尚未发生新写入时可直接切回文件；发生新写入后只允许通过反向导出工具生成新文件并对账，禁止直接使用旧文件覆盖。

### 迭代 3：迁用户和角色

- 暂停角色编辑，不停止普通用户浏览。
- 只导入冻结清单中通过人员绑定校验的 CAS 用户、角色、授权和用户角色；本地账号和历史认证审计不导入数据库。
- CAS 用户按登录名绑定 `KC_PLATFORM_PRINCIPAL`；重名或缺失时阻断该用户，不猜测绑定。
- 切换用户列表、角色读取和角色变更到数据库；会话、Ticket 和审计继续由本地运行时组件管理。
- 13510 内嵌认证模块仅在本地会话记录中保存数据库用户的稳定 `USER_KEY`；会话回读通过原生异步 HTTP 获取最新用户、启停状态和角色，不要求数据库用户同时存在于本地用户数组，也不得启动同步子进程阻塞平台事件循环。
- 双读只用于短期无副作用比对，不允许长期双写。

验收：用户、角色和页面权限投影逐用户一致；角色业务事实仅写数据库，操作日志写本地结构化日志。

### 迭代 4：拆分和治理本地运行时记录

- 将会话、CAS Ticket、认证审计、GitLab 验证、幂等和 GitLab 审计拆成独立本地文件，避免一个文件整体覆盖不同生命周期数据。
- 会话和 Ticket 文件权限固定为仅服务账号可读写；日志采用 JSONL，只追加写入。
- 增加会话/Ticket/幂等 TTL 和日志轮转；首次删除历史记录前单独审批。
- 当前部署固定为单活 BFF；不得宣称本地会话支持跨实例共享。未来多实例部署另立共享会话专项。

验收：数据库中不存在会话、Ticket、验证历史、幂等和日志表；本地文件有容量上限、轮转和权限检查；过期记录不再无界增长。

### 迭代 5：封存文件和建立门禁

- 连续稳定运行并完成对账后，只封存原混合 JSON；新的本地运行时文件继续由服务使用。
- 共享环境检测到用户/角色或 GitLab 连接/映射仍以 `file` 为主写时拒绝启动；不得把这条门禁错误应用到会话和日志。
- 保留隔离单元测试的 memory/file 适配器，但测试路径与生产路径显式分离。
- 删除或归档必须另行获得真实数据处置批准。

### 9.1 实施文件清单

正式开发必须新增独立、版本化的实施文件，不得把本设计中的示例 DDL 直接复制到运行脚本：

| 文件/工具 | 责任 | 必须证明 |
| --- | --- | --- |
| `apps/yashandb-storage/sql/01x_*.sql` | 数据库迁移 | 顺序、摘要、可重复执行和失败边界 |
| 角色/授权种子 SQL | 认证权限 | 角色代码、授权项和版本化变更 |
| 导入工具 | 迁移执行 | `migrated/rejected/ignored-with-reason` 全量结果 |
| 摘要对账工具 | 数据验收 | 源摘要、目标摘要、差异和退出码 |
| 反向导出工具 | 回退准备 | 数据库状态可重建为兼容文件且不含敏感明文 |
| 运行时清理/轮转工具 | 本地治理 | TTL、容量、权限、失败告警和可重入 |
| 切换脚本/配置 | 发布门禁 | 冻结、切换、健康检查和停止条件 |

### 9.2 运行时存储契约

实现前必须冻结以下路径和行为；路径仅示意，最终值应登记到运行配置契约：

| 记录 | 建议独立对象 | 写入要求 | 清理/故障要求 |
| --- | --- | --- | --- |
| 会话 | `runtime/agent-runner/tmp/knowledge-center-sessions.json` | 原子替换或等价并发安全写入，仅保存摘要 | 失效后按批准 TTL 清理；写满或损坏时拒绝新会话并告警 |
| CAS Ticket | `runtime/agent-runner/tmp/knowledge-center-tickets.json` | 只保存摘要和消费时间 | 按 Ticket 窗口清理；不得记录明文票据 |
| 幂等键 | 独立短期缓存文件或受控嵌入式存储 | 按业务键去重，结果可回读 | 清理失败告警，不得无限增长 |
| 认证/GitLab 审计 | `runtime/agent-runner/logs/*.jsonl` | 只追加，禁止整体 JSON 重写 | 按轮转和保留策略处理，失败不回滚已提交业务但必须告警 |

无论最终选择何种实现，都必须定义文件权限、进程锁、崩溃恢复、磁盘满、部分写入、重启恢复和多实例写入边界。若部署拓扑不支持共享本地目录，必须在会话策略中明确单活或粘性会话，不能宣称跨实例共享。

### 9.3 API 与兼容性补充契约

这部分不是新增业务页面，也不是为了把内部 Repository 暴露给用户。它解决的场景是：存储从单文件整体覆盖改成数据库逐行事务后，现有前端仍能使用相同 URL 和主要 DTO，同时能够识别并发覆盖、重复提交和数据库不可用。缺少这层契约，两个管理员同时保存权限或映射时，后一次写入会静默覆盖前一次写入。

不新增 `/v2`，冻结现有接口：

| 场景 | 接口 | 兼容与新增约束 |
| --- | --- | --- |
| 用户权限列表 | `GET /knowledge-center/api/auth/users` | 保留 `users/assignableRoles/pagination`；数据库账号新增 `rowVersion`，本地账号标记只读来源 |
| 替换用户角色 | `PATCH /knowledge-center/api/auth/users/{userId}/roles` | 保留 `{roles[]}`；新增 `If-Match: rowVersion` 和 `Idempotency-Key`；版本不匹配返回 409 |
| GitLab 连接列表/创建 | `GET/POST/PUT /knowledge-center/api/gitlab/connections` | 保持当前路径和投影；写请求继续要求幂等键，响应新增 `rowVersion` |
| 修改连接 | `PATCH /knowledge-center/api/gitlab/connections/{id}` | 新增 `If-Match`；不得通过请求修改稳定 `id` |
| 验证/启停 | `POST /knowledge-center/api/gitlab/connections/{id}/{verify|disable|enable}` | 验证只写本地验证日志；启停使用 `If-Match` 和幂等键 |
| 读取/替换映射 | `GET/PUT /knowledge-center/api/gitlab/mappings/{handbookId}` | GET 新增 `fingerprint/rowVersion`；PUT 使用 `If-Match` 和幂等键，在单一事务内替换当前分支/路径集合 |

稳定错误外壳保持 `{success:false,error:{code,message,retryable,requestId}}`。本次至少冻结：`AUTH_REQUIRED` 401、`PERMISSION_DENIED` 403、`RESOURCE_NOT_FOUND`/现有领域 404、`IDEMPOTENCY_KEY_REQUIRED` 400、`ROW_VERSION_CONFLICT` 409、`MAPPING_VALIDATION_FAILED` 422、`STORAGE_UNAVAILABLE` 503。前端必须分别显示刷新重试、修正字段或稍后重试，不把 503 渲染为空列表。

Storage 日常业务内部 API 固定为 `/v1/platform/auth/*` 与 `/v1/platform/gitlab/*`，只监听 Storage 内网地址，13510 BFF 不做透传。BFF 仅通过 `DomainStore` 同步适配器调用，浏览器公共 URL 保持不变：

| 内部路径 | 方法 | 行为 |
| --- | --- | --- |
| `/v1/platform/auth/users` | `GET` | 读取 CAS 用户、角色及数据库授权投影 |
| `/v1/platform/auth/users/cas` | `POST` | 按 CAS 登录名和已确认 `principalId` 查找或创建账号 |
| `/v1/platform/auth/users/{userKey}/roles` | `PATCH` | 按 `If-Match` 整体替换用户角色 |
| `/v1/platform/gitlab/connections` | `GET/PUT` | 读取或新增/修改连接当前配置 |
| `/v1/platform/gitlab/connections/{connectionKey}` | `GET/PATCH` | 读取连接或按版本修改启停状态 |
| `/v1/platform/gitlab/mappings/{manualCode}` | `GET/PUT` | 读取或在单事务中整体替换映射、分支和路径 |

日常内部 API 不提供读取旧混合 JSON 的降级分支。Storage 不可用时，BFF 统一转换为 `503 STORAGE_UNAVAILABLE`，不展示过期业务配置。

业务写入伪代码：

```text
require If-Match and Idempotency-Key
check local runtime idempotency record
begin database transaction
  lock current business row
  assert current ROW_VERSION == If-Match
  validate referenced role / connection / manual
  replace the complete relation set
  increment ROW_VERSION and update fingerprint
commit
append local JSONL audit
store local idempotency result
return current projection
```

用户列表由数据库 CAS 账号和开发环境本地账号投影合并。本地账号返回 `managementSource='local'`、`rowVersion=null`、`rolesEditable=false`，只用于说明应急/测试入口，不允许调用数据库角色替换接口；尝试修改时返回 `LOCAL_ACCOUNT_NOT_DATABASE_MANAGED` 409。生产环境必须禁用内置测试账号，本地应急管理员是否启用由部署配置决定。

### 9.4 一次性迁移程序的业务场景

迁移程序只服务一个场景：把切换时仍保存在两个 JSON 文件中的用户/角色、GitLab 连接和手册映射初始化到新表。切换完成后，页面写操作直接调用数据库 Repository；迁移程序不在登录、权限修改、连接验证、映射保存或启动请求链路中运行。

建议实现为 `tools/knowledge-processing/migrate-platform-config-to-yashandb.js`，只提供以下受控命令：

```text
plan        只读源文件和数据库，输出脱敏数量、字段问题和 SHA-256
import      要求维护窗口和批准引用；创建一次性批次并写入数据库
verify      只读回查并做字段级 canonical SHA-256 对账
export-rollback  只在已有新写入、需要人工批准回退时生成兼容文件；不自动切换
```

认证和 GitLab 使用独立批次。本次实际批次为 `PFC1-AUTH-911652cb4ef6aa44f271230f911880f` 与 `PFC1-GL-685b7e6760101c7749a6da182306de3`，完整摘要写入 `SOURCE_SHA256`，结果已回读为 `COMPLETED`。相同源摘要再次执行必须保持幂等；源摘要变化时必须生成新计划并重新批准，不得覆盖原批次。正常服务代码不得依赖迁移工具，也不得在数据库错误时调用它或读取旧 JSON。

当前实现状态：已落地 `apps/yashandb-storage/sql/010_platform_centralization.sql` 和 `tools/knowledge-processing/migrate-platform-config-to-yashandb.js`。本次已使用规范化源数据完成真实导入并回读核对：10 个 CAS 用户、5 个角色、48 条授权、25 条用户角色关系、2 个 GitLab 连接、3 个手册映射、6 个分支、6 条路径；本地账号、会话、Ticket、审计和幂等记录未导入。由于现有 Node 认证和 GitLab Connector 仍有文件 Repository 兼容路径，应用主写切换和双实例一致性验证仍是下一独立任务；旧 JSON 暂不删除。

### 9.5 一次性迁移状态机与伪代码

```text
planned
  -> source_frozen
  -> importing
  -> reconciled
  -> repository_switched
  -> observation_complete
  -> source_archived

any step before repository_switched -> failed_without_switch
after repository_switched and before new write -> switch_back_allowed
after repository_switched and after new write -> export_rollback_required
```

```text
assert maintenance window and approvalRef
read source files with no secret values in output
validate schema, stable keys and principal/manual references
canonicalize source and compute sourceSha256
assert no COMPLETED batch with a different unapproved source digest
insert migration batch RUNNING in a short control transaction
begin domain import transaction
  upsert role/grant seed by stable code
  insert users and user-role relations
  insert connections
  for each source mapping:
    insert current mapping with computed fingerprint
    insert every enabled branch and mark exactly one default
    insert normalized ZH/EN paths
  update batch counts and result digest; keep status RUNNING
commit
read database projection and compare canonical digest
if transaction or comparison fails: do not switch Repository; update batch FAILED in a separate control transaction
if equal: update batch COMPLETED in a short control transaction, request explicit switch step and run real API smoke tests
```

迁移写入必须全事务或按认证、GitLab 两个独立领域事务执行；不得按单条记录提交后继续忽略失败。若按两个领域事务拆分，每个领域有独立批次、独立开关和独立回退，不允许一个总批次掩盖部分成功。

进程在领域事务提交后、批次改为 `COMPLETED` 前崩溃时，批次会停留在 `RUNNING`。再次执行不得盲目重插：先只读计算目标投影摘要；与 `SOURCE_SHA256/RESULT_SHA256` 完全一致时允许把原批次补记为 `COMPLETED`，目标为空时标记原批次 `FAILED` 后重开批准批次，其他状态一律人工处置，不自动删除或覆盖目标行。

### 9.6 切换后的代码边界

- `DatabaseAuthBusinessRepository` 只负责用户、角色和授权；`LocalAuthRuntimeRepository` 只负责会话、Ticket 和认证日志。
- `DatabaseGitLabConfigRepository` 只负责当前连接和手册映射；`LocalGitLabRuntimeRepository` 只负责验证结果、幂等和审计日志。
- 正常服务不保留 `file|database` 自动降级分支；共享环境固定为数据库业务 Repository。file adapter 只允许在明确的单元测试/隔离 E2E 依赖注入中使用。
- 旧混合 JSON 在观察期只读封存；不得继续由正常请求更新。稳定期结束后的删除仍需数据处置审批。

### 9.7 一次性迁移的内部 API 边界

一次性 Node 工具不直接持有 JDBC 凭据，而是调用 Storage 内部迁移 API；这不是浏览器公共 API，也不得由 13510 BFF 代理：

```text
POST /v1/migrations/platform-config/auth/import
POST /v1/migrations/platform-config/gitlab/import
GET  /v1/migrations/platform-config/{batchId}
GET  /v1/migrations/platform-config/{batchId}/projection
```

导入请求携带 `batchId/sourceSha256/approvalRef/items`，Storage 重新计算规范化摘要，拒绝批次 ID 与完整摘要不匹配、已存在不同摘要、未知角色、无效人员/手册/连接引用和非空目标冲突。响应只包含批次状态、计数、摘要和逐条结果，不返回密码、Token、Cookie、Ticket 或凭据正文。

端点默认关闭，只有显式 `KNOWLEDGE_CENTER_MIGRATION_MODE=platform-centralize-v1` 且内部监听地址满足部署门禁时启用；完成迁移后取消该配置。即使端点代码保留用于审计复现和隔离测试，也不能成为正常运行依赖。实施验收必须真实调用这些内部 API，不能用源码断言替代。

## 10. 事务与并发规则

1. 登录成功：数据库只读取用户与角色；会话和认证日志由本地运行时组件写入。
2. 角色变更：锁定用户版本、替换用户角色并递增 `ROW_VERSION`，数据库事务提交后追加本地操作日志。
3. CAS 首次登录：按 CAS 登录名查找唯一、启用的既有人员并创建或绑定账号；无匹配、重名或唯一冲突时阻断登录，不自动创建人员，不重复创建账号。
4. GitLab 连接写入：本地幂等组件先判重，数据库事务写连接配置；提交后追加本地操作日志。
5. 手册映射写入：校验手册、连接状态和路径前缀，在单一事务内替换当前分支/路径明细、更新摘要并递增映射 `ROW_VERSION`。
6. 角色、授权和 GitLab 配置变更在数据库事务前必须成功追加带 `requestId` 的本地审计意图；意图写入失败则拒绝业务写入。数据库提交后追加结果事件；结果日志失败不回滚已经成功的业务事务，但必须告警，且可通过意图事件和数据库更新时间识别待补记结果。普通登录日志失败不回滚已创建会话，但同样必须告警。

## 11. 数据保留与清理基线

按用户确认的方案 A，本地运行时采用 TTL、JSONL 轮转和容量告警：

| 数据 | 已确认基线 | 原因 |
| --- | --- | --- |
| 已过期/已撤销会话 | 失效后保留 7 天 | 兼顾问题定位与快速清理 |
| CAS Ticket 摘要 | 消费后保留 24 小时 | 远大于通常 Ticket 有效期，同时避免无界增长 |
| 幂等记录 | 保留 7 天 | 覆盖重复提交和常见客户端重试窗口 |
| 本地结构化日志 | 单文件 100 MB、保留 30 天 | 防止单机磁盘无界增长；长期留存交由日志平台 |

清理任务只删除达到本地 TTL 或轮转条件的数据；每次记录删除数量、最早/最晚时间和执行人。首轮清理属于真实数据删除，必须单独审批。磁盘容量告警阈值和拒绝新会话阈值必须通过部署配置提供，具体默认值由实施前的 SRE 容量评审确定，不在代码中硬编码；日志写入失败不回滚已经提交的业务事务，但必须进入 stderr/系统日志告警。

## 12. 对账与验收

### 12.1 DDL 验收

- 新增 8 张目标表，0 个物理外键。
- 所有主键和关联键为 `BIGINT`。
- 平台相关表统一使用 `KC_PLATFORM_SEQ`，全库业务序列仍为 4 条。
- `KC_AUTH_USER` 不保存本地账号密码；本地应急/测试账号凭据仍由受控本地环境管理。Cookie 令牌和 CAS Ticket 不进入数据库，本地也只保存 SHA-256。
- GitLab Token 不进入这些表，`CREDENTIAL_REF` 只是部署环境中的凭据名称。

### 12.2 数据验收

- 可迁移 CAS 用户数、用户角色关系数与维护窗口冻结清单一致；本地账号和拒绝项逐条有原因。
- 会话、Ticket、认证审计的数据库导入数均为 0，并保留冻结清单和本地归档摘要。
- GitLab 连接 2、手册映射 2；分支和路径展开后可逆重建原数组。
- GitLab 幂等、审计和验证结果的数据库导入数均为 0，数量与冻结清单一致。
- 所有源记录都有 `migrated/rejected/ignored-with-reason` 结果，不允许静默丢弃。

### 12.3 真实环境验收

- 必须真实调用登录、会话查询、退出、用户列表、角色修改、连接列表、映射读取和幂等写 API。
- 用户权限、GitLab 连接和映射在不同实例读取结果一致；会话能力只按已批准的部署策略验收。
- 数据库不可用时业务配置写入明确失败，不自动降级到本机文件形成双主写。
- 运行时文件变化不得覆盖或改变数据库中的用户、角色、连接和映射。
- API 回归、迁移摘要、对账报告和回退演练证据统一写入 `runtime/`，不得包含密码、Token、Cookie 或 Ticket 明文。

### 12.4 验收矩阵

| 类别 | 最小用例 | 放行证据 |
| --- | --- | --- |
| 迁移幂等 | 空库、重复执行、部分失败重跑 | 迁移批次表、退出码、目标摘要 |
| 真实 API | 登录、退出、用户列表、角色修改、连接验证、映射读写 | 请求/响应、实例和构建版本 |
| 并发 | 两管理员同时改同一用户/连接 | 一个成功、一个稳定 409，数据无半写 |
| 故障 | 数据库断开、运行文件损坏、磁盘满模拟 | 中文错误、恢复动作、无静默降级 |
| 一致性 | 两个 BFF 实例读取共享业务配置 | 逐项摘要一致；会话按批准策略验收 |
| 安全 | 敏感字段扫描、非管理员写入、日志检查 | 无密码/Token/Cookie/Ticket 明文，非管理员 403 |
| 回退 | 切换前、无新写入、已有新写入三种回退 | 反向导出、对账、人工确认和停止条件 |

## 13. 回退边界

- 建表阶段可回退代码，不删除新表。
- 每个领域切换前保存源文件只读副本及摘要。
- 切换后无新写入时，可将 Repository 开关切回旧源。
- 切换后已有新写入时，必须先反向导出、对账并由人确认，不能用旧文件覆盖数据库。
- 会话和日志没有切入数据库，因此业务表回退不应改变现有 Cookie。
- 稳定期内不删除源文件、新表或日志；任何删除另走数据处置审批。

## 14. 评审决策状态

| 决策项 | 状态 | 结论/下一步 |
| --- | --- | --- |
| 业务与运行时分层 | 已确认 | 用户/角色和 GitLab 配置入库；会话、Ticket、幂等、验证和日志不入库 |
| GitLab 映射保真 | 当前基线已确认 | 使用当前稳定映射 + 完整分支集合 + 中英文路径 + 配置指纹；历史版本/快照为后续演进 |
| 平台序列 | 已确认 | 新序列并行过渡；本次不删除旧序列 |
| API 版本 | 已确认设计边界 | 不新增 `/v2`；冻结现有 URL，并补充并发、幂等和错误契约 |
| 一次性迁移 | 已确认设计边界 | 维护窗口冻结写入，离线导入并对账，之后只写数据库 |
| 本地 TTL 和轮转 | 已确认 | 采用本地 TTL + JSONL 轮转 + 容量告警；首次清理另行批准执行窗口 |
| 多实例会话 | 本次排除 | 当前基线为单活 BFF；未来多实例另立共享会话专项 |
| 本地应急管理员 | 待落实责任人 | 开发环境继续保留；需在实施计划登记凭据轮换和启停责任人 |
| `email/employeeNo` | 已确认不迁移 | 当前不进入账号表；后续如需使用必须重新确认权威源和场景 |

## 15. Independent Reviewer 质询与重要缺口方案

### 15.1 评审记录

| 字段 | 值 |
| --- | --- |
| `reviewId` | `DR-20260922-KC-001` |
| `runId` | `IR-20260922-01` |
| `taskId` | `KC-CENTRALIZE-DESIGN-REVIEW-01` |
| Profile | `design-review` |
| 结论 | `hold` |
| 说明 | 不是 `hard_stop`；补齐 required evidence、完成受限决策并复审后才能解除 |

### 15.2 用户评审意见处置

| 原质询 | 用户决定 | 设计处置 |
| --- | --- | --- |
| 会话与审计权威源 | 方案 B | 用户/角色写数据库；会话、Ticket 和日志留本地；当前限定单活 BFF |
| GitLab 映射语义 | 方案 A 的最小实施化 | 保留完整分支、中英文路径和指纹；版本/快照表待回放业务成立后再加；迁移不伪造源文件不存在的数据 |
| 序列演进 | 方案 B | 新建序列并行过渡；本次不删除旧序列 |
| 公共 API 契约用途不清 | 已澄清为必要门禁 | 它服务“存储切换但页面契约不漂移”的场景，不新增页面或 `/v2` |
| 迁移执行方式场景不清 | 已澄清为一次性引导导入 | 只迁移现有 JSON 业务事实；切换后正常代码直接写数据库 |
| 本地保留与清理 | 方案 A | TTL、JSONL 轮转和容量告警进入目标基线 |

### 15.3 第二轮评审解除条件

1. 认证详细设计不再同时声明“会话/审计入库”和“本地留存”两套权威源。
2. GitLab 映射完成字段级可逆对账，确认默认分支、启用分支和中英文路径无损；不得把未实现的历史版本当成当前迁移条件。
3. 序列迁移提供真实 YashanDB SQL、预检、回退和重复执行证据。
4. 形成一份版本化 API 契约和旧调用回归结果。
5. 导入、对账、反向导出和三种回退情形完成隔离库演练。
6. 保留周期、轮转阈值、磁盘满和清理行为取得安全/运维批准。
7. 完成真实后端 API 验收后，由 Independent Reviewer 进行第二轮复审。

在第二轮评审解除 `hold` 且真实迁移获得执行审批前，安全工作只包括文档评审、测试准备、只读盘点和迁移工具开发的隔离测试，不包括真实数据库写入、运行时切换或源文件删除。

## 16. 本轮识别并修正的不正确内容

| 原内容 | 为什么不正确 | 修改意见/当前处理 |
| --- | --- | --- |
| “目标模型新增 11 张表” | 把历史回放能力提前到一次性配置迁移，与源 JSON 和当前页面能力不匹配 | 收敛为当前 8 张表；连接版本、映射版本和快照表改为后续条件触发 |
| “9 个用户全部迁移” | 运行数据已变化，且本地账号本来就不应进入 `KC_AUTH_USER` | 数量以冻结快照为准；只迁移人员绑定有效的 CAS 账号，本地账号排除 |
| “生产用户、角色、会话和审计都写入 YashanDB” | 与用户确认的方案 B 冲突，也扩大了本次迁移范围 | 认证设计已改为用户/角色入库，会话、Ticket 和日志本地化 |
| 直接把 `KC_PRINCIPAL_SEQ` 改名后删除 | 可能仍被既有列默认值引用，缺少可回退过渡 | 新序列并行，分步切默认值；旧序列删除另行审批 |
| “映射分支/路径必须立即关联版本表” | 当前业务只读写当前有效配置，为历史回放提前复杂化没有业务依据 | 当前直接关联稳定映射；历史回放需求成立后再引入版本键 |
| 迁移时补造历史快照或 `headSha` | 当前源 JSON 没有这些事实，生成值会伪造历史 | 不建快照表，也不生成伪造 SHA |
| 把旧 JSON 继续描述为目标态事实源 | 会让数据库和文件继续双主写 | 平台、平台管理和知识资产设计已改为“一次性迁移源 + 观察期只读归档” |
| 把 API 契约理解成新增业务功能 | 本次不需要新页面或 `/v2`，但必须避免存储切换导致前后端语义漂移 | 保持现有 URL/主要 DTO，补充 `rowVersion`、幂等和稳定错误码 |
| 把迁移代码作为长期运行路径 | 会形成隐式 fallback 或重复导入风险 | 迁移代码只提供 plan/import/verify/export-rollback，成功后正常请求只走数据库 Repository |
| 在设计中直接写死磁盘容量阈值 | 缺少部署容量证据，也违反配置化要求 | 阈值改由部署配置提供，默认值进入 SRE 容量评审待办 |
