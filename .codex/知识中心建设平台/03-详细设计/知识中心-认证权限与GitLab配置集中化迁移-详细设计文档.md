# 知识中心认证权限与 GitLab 配置集中化迁移详细设计

> 设计编号：KC-DB-PLATFORM-CENTRALIZE-001
> 状态：用户边界决策已确认，Independent Reviewer 评审中，禁止据此直接实施
> 版本：0.3.0
> 日期：2026-09-18
> 适用数据库：YashanDB 23.4
> 上游盘点：[知识中心页面数据存储现状与集中化路线](./知识中心-页面数据存储现状与集中化路线-详细设计文档.md)

## 1. 结论先行

当前需要迁移的是团队共享业务事实，不是所有运行时记录：

1. 认证权限主数据：用户、角色、角色授权和用户角色关系。
2. GitLab 平台配置：连接和手册映射，包括允许的分支与中英文路径。

登录会话、CAS Ticket 消费记录、连接验证历史、幂等缓存和审计属于运行时状态或日志，不纳入本次业务主数据迁移；继续保存在本地受控运行目录，通过 TTL、文件轮转和访问权限治理。

推荐采用“YashanDB 业务表 + 本地运行时记录”的分层方案。目标模型新增 8 张业务表，复用一个平台管理业务边界序列，不使用物理外键；关联完整性由唯一约束、Repository 事务、写前校验和巡检共同保证。

实施顺序建议为：先建表和只读对账，再切 GitLab 连接与映射，之后切用户与角色。会话和日志不切入数据库。若未来需要多实例无感共享会话，应单独评审粘性会话、统一认证网关或专用共享会话存储，不能借本次迁移顺带扩张范围。

本稿只定义候选方案、完整目标结构、迁移步骤和验收标准。认证、权限、真实数据和持久化 Schema 均命中人工审批边界，必须完成整体评审并形成明确批准记录后才能写库或切换运行时。

### 1.1 已确认决策

| 决策项 | 用户结论 | 对设计的约束 |
| --- | --- | --- |
| 平台序列 | 批准 `KC_PRINCIPAL_SEQ` 演进为 `KC_PLATFORM_SEQ` | 全库仍保持 4 条业务边界序列 |
| 运行时记录 | 会话 1275、Ticket 66、认证审计 2563、幂等 24、GitLab 审计 44 只做本地归档 | 不设计对应数据库表，不导入 YashanDB |
| 会话部署策略 | 本次不调整 | 保持当前开发环境行为，不承诺跨实例共享，不引入粘性会话或共享会话组件 |
| 本地保留策略 | 会话 7 天、Ticket 24 小时、幂等 7 天、日志单文件 20 MB/保留 20 天 | 作为实施验收基线；首次清理历史数据仍需单独确认执行窗口 |
| 本地应急管理员 | 开发环境继续保留 | 账号信息保存在本地环境，不迁入 `KC_AUTH_USER`，生产环境策略不在本次范围 |
| CAS 扩展属性 | `email/employeeNo` 不进入目标账号表 | CAS 登录名作为长期唯一且不回收的身份标识 |

## 2. 当前“会话”和“审计”的真实含义

### 2.1 1275 条会话不是 1275 个在线用户

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

### 2.2 2563 条审计主要是认证生命周期日志

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
- CAS 用户首次登录时，在同一平台事务链路中查找或创建人员，再创建账号绑定，不依赖页面临时跨系统查询。

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

不为 8 张表创建 8 条序列。建议将现有 `KC_PRINCIPAL_SEQ` 扩展并更名为 `KC_PLATFORM_SEQ`，覆盖人员、认证权限和 GitLab 配置。全库仍维持四个主业务序列：

| 序列 | 边界 |
| --- | --- |
| `KC_MANUAL_SEQ` | 手册及稳定大纲主体 |
| `KC_OUTLINE_SEQ` | 大纲结构版本与检查变更 |
| `KC_RESPONSIBILITY_SEQ` | 技术领域与责任映射 |
| `KC_PLATFORM_SEQ` | 人员、认证权限和平台业务配置 |

实施脚本必须先按平台边界所有相关表的最大 ID 计算新序列起点，再切换默认值，最后删除旧 `KC_PRINCIPAL_SEQ`。本评审稿不硬编码生产起点。

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
| GitLab | `KC_GITLAB_MANUAL_MAPPING` | 一本手册到一个连接的稳定映射 |
| GitLab | `KC_GITLAB_MAPPING_BRANCH` | 映射允许访问的分支 |
| GitLab | `KC_GITLAB_MAPPING_PATH` | 映射的中英文仓库根路径 |

个人 GitLab OAuth Token 已经加密存储在 `KC_RECORD(namespace='gitlab-oauth')`，不属于本地 JSON 迁移范围。本轮不复制 Token、不改变加密密钥和 OAuth 行为；其关系化可另行评审。

## 6. 完整目标 DDL

以下是目标结构基线。实际迁移必须使用新的版本化 SQL 文件，不能修改已经执行的 `005` 至 `009`。序列切换和角色种子数据应拆为独立迁移；此处用 `KC_PLATFORM_SEQ` 表达最终状态。

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
  STATE VARCHAR(16) DEFAULT 'ACTIVE' NOT NULL,
  ROW_VERSION BIGINT DEFAULT 1 NOT NULL,
  CREATED_BY VARCHAR(128) NOT NULL,
  CREATED_AT TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  UPDATED_BY VARCHAR(128) NOT NULL,
  UPDATED_AT TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT PK_KC_GITLAB_CONN PRIMARY KEY (GITLAB_CONNECTION_ID),
  CONSTRAINT UK_KC_GLCONN_KEY UNIQUE (CONNECTION_KEY),
  CONSTRAINT UK_KC_GLCONN_NAME UNIQUE (CONNECTION_NAME),
  CONSTRAINT UK_KC_GLCONN_PROJECT UNIQUE (BASE_URL, PROJECT_PATH),
  CONSTRAINT CK_KC_GLCONN_MODE CHECK (RUN_MODE IN ('SANDBOX', 'PRODUCTION')),
  CONSTRAINT CK_KC_GLCONN_AUTH CHECK (AUTH_MODE IN ('USER_OAUTH', 'SERVICE_ACCOUNT')),
  CONSTRAINT CK_KC_GLCONN_PURPOSE CHECK (PURPOSE IN ('READ', 'READ_WRITE')),
  CONSTRAINT CK_KC_GLCONN_STATE CHECK (STATE IN ('ACTIVE', 'INACTIVE')),
  CONSTRAINT CK_KC_GLCONN_ROWVER CHECK (ROW_VERSION >= 1),
  CONSTRAINT CK_KC_GLCONN_CRED CHECK (
    (AUTH_MODE = 'SERVICE_ACCOUNT' AND CREDENTIAL_REF IS NOT NULL)
    OR AUTH_MODE = 'USER_OAUTH'
  )
);

CREATE TABLE KC_GITLAB_MANUAL_MAPPING (
  GITLAB_MAPPING_ID BIGINT DEFAULT KC_PLATFORM_SEQ.NEXTVAL NOT NULL,
  MANUAL_ID BIGINT NOT NULL,
  GITLAB_CONNECTION_ID BIGINT NOT NULL,
  ROW_VERSION BIGINT DEFAULT 1 NOT NULL,
  CREATED_BY VARCHAR(128) NOT NULL,
  CREATED_AT TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  UPDATED_BY VARCHAR(128) NOT NULL,
  UPDATED_AT TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT PK_KC_GLMAPPING PRIMARY KEY (GITLAB_MAPPING_ID),
  CONSTRAINT UK_KC_GLMAPPING_MANUAL UNIQUE (MANUAL_ID),
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
```

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
| `users[]` | `KC_AUTH_USER` | 9 个用户全部迁移；旧 `id` 写入 `USER_KEY`；CAS 用户绑定现有 `PRINCIPAL_ID` |
| `users[].roles[]` | `KC_AUTH_USER_ROLE` | 按 `ROLE_CODE` 解析数字角色 ID |
| `sessions[]` | 保留在本地运行时 | 不进入数据库；新增 TTL 清理，1275 条仅作为历史运行状态处理 |
| `consumedTickets[]` | 保留在本地运行时 | 不进入数据库；按 CAS Ticket 安全窗口清理 |
| `audits[]` | 本地结构化日志 | 不进入数据库；现有 2563 条导出为只读 JSONL 归档并保留摘要 |
| `email/employeeNo` | 默认不迁移 | 当前页面和权限判断不使用；若评审确认需要，必须明确权威源和展示场景后再加字段 |

### 8.2 GitLab 配置文件

| 当前 JSON | 目标 | 迁移规则 |
| --- | --- | --- |
| `connections[]` | `KC_GITLAB_CONNECTION` | 2 条；旧 `id` 写入 `CONNECTION_KEY`；`credentialRef` 只作为环境凭据引用，不迁移 Token |
| `lastVerification` | 本地结构化日志 | 不进入数据库；切换后重新验证连接，页面投影最新一次运行结果 |
| `mappings[]` | 映射主表、分支表、路径表 | 2 条主映射；数组拆为多行，手册字符串标识解析为 `MANUAL_ID` |
| `idempotency[]` | 本地短期缓存 | 不进入数据库；现有 24 条按 TTL 清理，跨实例强幂等不在本次范围 |
| `audit[]` | 本地结构化日志 | 不进入数据库；现有 44 条转为只读 JSONL 归档并保留摘要 |

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

验收：空库迁移可重复启动；8 张表和索引符合设计；API 外部响应不变；运行日志不会写入数据库。

### 迭代 2：先迁 GitLab 配置

- 在短维护窗口内暂停 GitLab 配置写入。
- 只导入 2 个连接和 2 个映射；验证结果、幂等记录和审计不导入数据库。
- 用连接字段、映射数组展开结果和摘要进行逐条对账。
- 切换连接与映射 Repository 为数据库主写；原 JSON 中的业务配置改为只读备份，运行时记录写入独立本地文件。
- 调用真实连接列表、映射读取和连接验证 API；验证写请求幂等行为。

回退：在数据库切换后尚未发生新写入时可直接切回文件；发生新写入后只允许通过反向导出工具生成新文件并对账，禁止直接使用旧文件覆盖。

### 迭代 3：迁用户和角色

- 暂停角色编辑，不停止普通用户浏览。
- 只导入 9 个用户、角色、授权和用户角色；2563 条历史认证审计不导入数据库。
- CAS 用户按登录名绑定 `KC_PLATFORM_PRINCIPAL`；重名或缺失时阻断该用户，不猜测绑定。
- 切换用户列表、角色读取和角色变更到数据库；会话、Ticket 和审计继续由本地运行时组件管理。
- 双读只用于短期无副作用比对，不允许长期双写。

验收：用户、角色和页面权限投影逐用户一致；角色业务事实仅写数据库，操作日志写本地结构化日志。

### 迭代 4：拆分和治理本地运行时记录

- 将会话、CAS Ticket、认证审计、GitLab 验证、幂等和 GitLab 审计拆成独立本地文件，避免一个文件整体覆盖不同生命周期数据。
- 会话和 Ticket 文件权限固定为仅服务账号可读写；日志采用 JSONL，只追加写入。
- 增加会话/Ticket/幂等 TTL 和日志轮转；首次删除历史记录前单独审批。
- 多实例部署暂采用评审确认的会话策略；未确认前不得宣称本地会话支持跨实例共享。

验收：数据库中不存在会话、Ticket、验证历史、幂等和日志表；本地文件有容量上限、轮转和权限检查；过期记录不再无界增长。

### 迭代 5：封存文件和建立门禁

- 连续稳定运行并完成对账后，只封存原混合 JSON；新的本地运行时文件继续由服务使用。
- 共享环境检测到用户/角色或 GitLab 连接/映射仍以 `file` 为主写时拒绝启动；不得把这条门禁错误应用到会话和日志。
- 保留隔离单元测试的 memory/file 适配器，但测试路径与生产路径显式分离。
- 删除或归档必须另行获得真实数据处置批准。

## 10. 事务与并发规则

1. 登录成功：数据库只读取用户与角色；会话和认证日志由本地运行时组件写入。
2. 角色变更：锁定用户版本、替换用户角色并递增 `ROW_VERSION`，数据库事务提交后追加本地操作日志。
3. CAS 首次登录：按 CAS 登录名查找人员，创建或绑定账号；任何唯一冲突都重新读取并校验，不重复创建。
4. GitLab 连接写入：本地幂等组件先判重，数据库事务写连接配置；提交后追加本地操作日志。
5. 手册映射写入：校验手册、连接状态和路径前缀，替换分支/路径明细并递增版本，同事务提交。
6. 日志写入失败不得回滚已经成功的业务事务，但必须产生明确告警；关键权限变更是否要求日志写入成功才提交，列为评审项。

## 11. 数据保留与清理候选值

以下是本地运行时治理候选值，会改变安全与日志策略，必须在评审时确认：

| 数据 | 推荐候选 | 原因 |
| --- | --- | --- |
| 已过期/已撤销会话 | 失效后保留 7 天 | 兼顾问题定位与快速清理 |
| CAS Ticket 摘要 | 消费后保留 24 小时 | 远大于通常 Ticket 有效期，同时避免无界增长 |
| 幂等记录 | 保留 7 天 | 覆盖重复提交和常见客户端重试窗口 |
| 本地结构化日志 | 单文件 100 MB、保留 30 天 | 防止单机磁盘无界增长；长期留存交由日志平台 |

清理任务只删除达到本地 TTL 或轮转条件的数据；每次记录删除数量、最早/最晚时间和执行人。首轮清理属于真实数据删除，必须单独审批。

## 12. 对账与验收

### 12.1 DDL 验收

- 新增 8 张目标表，0 个物理外键。
- 所有主键和关联键为 `BIGINT`。
- 平台相关表统一使用 `KC_PLATFORM_SEQ`，全库业务序列仍为 4 条。
- 密码只保存强哈希；Cookie 令牌和 CAS Ticket 不进入数据库，本地也只保存 SHA-256。
- GitLab Token 不进入这些表，`CREDENTIAL_REF` 只是部署环境中的凭据名称。

### 12.2 数据验收

- 用户 9、用户角色关系数和源文件一致。
- 会话 1275、Ticket 66、认证审计 2563 的数据库导入数均为 0，并保留本地归档摘要。
- GitLab 连接 2、手册映射 2；分支和路径展开后可逆重建原数组。
- GitLab 幂等 24、审计 44 和验证结果的数据库导入数均为 0。
- 所有源记录都有 `migrated/rejected/ignored-with-reason` 结果，不允许静默丢弃。

### 12.3 真实环境验收

- 必须真实调用登录、会话查询、退出、用户列表、角色修改、连接列表、映射读取和幂等写 API。
- 用户权限、GitLab 连接和映射在不同实例读取结果一致；会话能力只按已批准的部署策略验收。
- 数据库不可用时业务配置写入明确失败，不自动降级到本机文件形成双主写。
- 运行时文件变化不得覆盖或改变数据库中的用户、角色、连接和映射。
- API 回归、迁移摘要、对账报告和回退演练证据统一写入 `runtime/`，不得包含密码、Token、Cookie 或 Ticket 明文。

## 13. 回退边界

- 建表阶段可回退代码，不删除新表。
- 每个领域切换前保存源文件只读副本及摘要。
- 切换后无新写入时，可将 Repository 开关切回旧源。
- 切换后已有新写入时，必须先反向导出、对账并由人确认，不能用旧文件覆盖数据库。
- 会话和日志没有切入数据库，因此业务表回退不应改变现有 Cookie。
- 稳定期内不删除源文件、新表或日志；任何删除另走数据处置审批。

## 14. 整体评审待决项

评审必须明确回答以下问题后才能实施：

1. 是否批准采用方案 B 的 8 张业务关系表，并明确会话、Ticket、验证、幂等和日志不进入数据库。
2. 是否批准将 `KC_PRINCIPAL_SEQ` 演进为覆盖平台管理边界的 `KC_PLATFORM_SEQ`，保持全库 4 条业务序列。
3. 多实例部署的会话策略采用粘性会话、单活 BFF，还是另立共享会话专项；本次不得默认承诺跨实例共享。
4. 是否确认 1275 条会话、66 条 Ticket、2563 条认证审计、24 条幂等和 44 条 GitLab 审计只做本地归档，不导入数据库。
5. 是否接受 7 天会话、24 小时 Ticket、7 天幂等、日志单文件 100 MB/保留 30 天的候选本地策略。
6. 是否继续保留本地应急管理员；若保留，谁负责凭据轮换和启停。
7. 是否确认 `email/employeeNo` 当前不进入目标账号表。

在上述决策没有形成明确审批记录前，安全工作只包括文档评审、测试准备、只读盘点和迁移工具开发的隔离测试，不包括真实数据库写入、运行时切换或源文件删除。
