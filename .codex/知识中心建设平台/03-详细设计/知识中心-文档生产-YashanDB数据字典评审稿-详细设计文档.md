# 文档生产 YashanDB 数据字典（评审稿）

日期：2026-10-28
状态：评审稿，未执行 DDL
适用范围：文档生产草稿、版本、AI 中间产物、资源、任务、评审和 GitLab 发布记录

本文是 [YashanDB 存储详细设计](./知识中心-文档生产-YashanDB存储-详细设计文档.md) 的逐字段评审附件。`KC_DP_*` 仅为建议物理名；目标 YashanDB 版本、字符集、分区能力和仓库既有命名规范确认前，不得据此建表。

## 0. 设计原则与键类型决策

本仓库已有的 YashanDB 设计原则要求：内部主键、模块内关联键和权威目录 ID 使用 `BIGINT`；业务编码、外部系统标识和幂等请求号使用字符串；序列按稳定业务边界管理，不按每张表创建序列。原评审稿把所有 ID 统一写成 `VARCHAR`，没有遵循这一现有约束，现已修正。

### 0.1 键类型分类

| 键类别 | 类型 | 适用字段 | 原因 |
|---|---|---|---|
| 内部实体键 | `BIGINT NOT NULL` | 文档、版本、正文、二进制、资源、任务、步骤、产物、评审、发布、审计等实体主键及其关联键 | 索引和连接更小，比较和排序成本低，符合现有 JDBC/SQL 映射和序列规范 |
| 权威目录键 | `BIGINT NOT NULL` | 已确认由本平台管理且已有 BIGINT 主键的目录 ID，例如现有 `MANUAL_ID`、`OUTLINE_NODE_ID`、`PRINCIPAL_ID` | 复用现有主数据，避免字符串复制和跨域键类型不一致；未确认权威来源的字段不能直接套用此类型 |
| 外部业务标识 | `VARCHAR` | `BRANCH`、`LANGUAGE`、`ORIGINAL_NAME`、`EVENT_TYPE`、状态码、GitLab commit SHA、MR ID、模型或规则版本 | 来源系统格式不受本库控制，不能假定是数字或稳定长度 |
| 请求与内容标识 | `VARCHAR`/`CHAR(64)` | 幂等请求键、`TRACE_ID`、SHA-256 摘要、相对路径 | 需要保留原始字符串或固定十六进制表示，不作为内部连接键 |

### 0.2 BIGINT 的性能和维护边界

- `BIGINT` 只用于数据库内部连接和范围查询，不把它暴露为可猜测的权限凭据；API 可继续返回 opaque ID 或同时返回业务编码。
- 文档生产实体的序列边界尚未批准：可以新增一个文档生产业务边界序列，也可以按现有手册、大纲、责任治理和人员四类边界归并；这必须在评审记录中选定，不能在实现时临时决定。无论采用哪种方案，都不得为每张表再创建序列；迁移时必须以各表现有最大值加一确定起点并记录快照。
- BIGINT 不能替代幂等键、摘要和外部 commit 标识；这些字段保留字符串类型。主键生成、序列缓存、回滚后的空洞和跨环境导入映射需要在迁移方案中明确。
- 字符串主键仅在外部系统直接以稳定字符串作为权威键且无需高频跨表连接时采用；本模型不满足该条件，因此不采用字符串主键。

## 0.3 表结构重新设计的评审维度

每张表在批准前必须同时检查以下维度：

1. **业务边界**：记录是否属于文档主体、不可变内容、任务执行、评审发布或平台治理；不同生命周期不得继续塞进聚合 JSON。
2. **权威来源**：字段是平台主数据、外部 GitLab 标识，还是本领域生成值；外部值不得伪装成内部主键。
3. **生命周期与状态**：草稿、冻结、发布、清理候选和已清理状态是否可区分；终态记录是否不可变。
4. **并发与一致性**：编辑版本、幂等键、租约和 fencing token 是否支持多实例；哪些更新必须 CAS，哪些通过追加记录表达。
5. **查询路径**：目录、单篇正文、任务领取、发布对账和清理各自的过滤条件、分页方式、P95 目标和索引选择性。
6. **容量与 LOB**：正文/模型上下文使用 CLOB，二进制使用 BLOB；字节大小、摘要、留存和引用是否可独立核算。
7. **安全与租户隔离**：授权范围、敏感等级、密钥排除、跨范围去重和日志脱敏是否能由服务端强制执行。
8. **迁移与恢复**：旧聚合字段如何映射，缺失/重复/孤立数据如何隔离，换机和备份恢复能否重建全部引用。
9. **运维成本**：序列、索引、LOB 空间、归档、清理批次、监控指标和回退步骤是否可执行。

这些维度缺一项，数据字典只能视为评审草案，不能进入 DDL 编写。

## 1. 统一约定

| 项目 | 约定 |
|---|---|
| 主键 | 内部 `*_ID` 使用 `BIGINT`，由业务边界序列生成；外部业务标识保留字符串；同一实体不得混用两种内部主键 |
| 时间 | `TIMESTAMP`，统一 UTC 存储，接口转换为 ISO 8601；精度以目标版本实测为准 |
| 文本 | `VARCHAR` 仅用于有界元数据；Markdown、提示词、模型响应和错误详情使用 `CLOB` |
| 二进制 | 图片、附件、导出包使用 `BLOB`；正文不内嵌 Base64 |
| 摘要 | `CHAR(64)` 保存小写 SHA-256 十六进制值；摘要不能替代权限校验 |
| 范围 | 所有业务表带 `SCOPE_ID` 或可由父表追溯范围，服务端强制授权过滤 |
| 默认值 | 除明确写出的默认值外，字段无数据库隐式默认；状态、计数和时间由事务显式写入，避免不同版本行为不一致 |
| 删除 | 默认 `ON DELETE RESTRICT`；清理器在引用、hold 和宽限期检查通过后分批处理 |
| 审计 | `CREATED_AT/CREATED_BY` 必填；状态变更和清理写 `KC_DP_AUDIT` |

长度和类型是设计初值，不是已经验证的 YashanDB 语法。实现前必须用目标版本完成 CLOB/BLOB 流式读写、唯一约束、索引选择性和备份恢复验证。

本仓库现行业务表原则是不使用物理外键，而由 Repository 事务、状态校验和巡检保证跨表归属、删除保护与发布一致性。因此下文的“FK”统一表示逻辑关联和应用校验，不表示要在 DDL 中创建 `FOREIGN KEY`；如果评审决定改用物理外键，必须单独评估迁移顺序、级联行为和写入性能。

## 1.1 现有目录与外部标识映射

类型不能只根据字段名决定，必须先确认字段的权威来源。当前建议按下面的映射设计；“待确认”项在 DDL 前必须由平台接口或现有表结构给出证据。

| 设计字段 | 当前对应对象 | 建议类型 | 依据与待确认事项 |
|---|---|---|---|
| `SCOPE_ID` | 知识中心的租户/团队/授权范围 | `BIGINT`（若由本平台新建范围目录）；否则 `VARCHAR` | 当前仓库未发现统一的 scope 主表，不能假设它已经是权威 BIGINT；需先确定范围目录和跨范围去重边界 |
| `HANDBOOK_ID` | `KC_MANUAL.MANUAL_ID` | `BIGINT` | 已存在的知识中心手册主键；建议字段名直接改为 `MANUAL_ID`，避免同一实体出现两套名称 |
| `NODE_ID` | `KC_MANUAL_OUTLINE_NODE.OUTLINE_NODE_ID` | `BIGINT` | 已存在的大纲节点主键；文档唯一键应包含 `OUTLINE_VERSION_ID` 或由节点可追溯版本 |
| `REPOSITORY_ID` | GitLab 项目/仓库标识 | `VARCHAR` | 外部系统标识，可能是数字 project id、路径或 provider 复合键；需同时保存 `REPOSITORY_PROVIDER` 和规范化外部值，不能直接当本库主键 |
| `BRANCH`、commit、MR | GitLab 外部版本标识 | `VARCHAR` | 外部值可能包含名称、SHA 或复合格式，保留原值并按接口长度实测 |
| `CREATED_BY`、`REVIEWER`、`ACTOR` | 平台登录名、服务身份或评审操作者 | `VARCHAR`；可选 `*_PRINCIPAL_ID BIGINT` | 与现有 `KC_MANUAL.CREATED_BY` 等审计字段保持兼容；若需要人员主数据关联，另存 `PRINCIPAL_ID`，展示名称只能作为快照 |
| `OWNER_ID`、`ENTITY_ID` | 本模块多态引用 | `BIGINT`，并要求 `OWNER_TYPE/ENTITY_TYPE` 白名单 | 仅允许引用本模块内部实体；若未来引用外部对象，新增 `EXTERNAL_KEY VARCHAR`，禁止把外部值塞进 BIGINT |

因此当前字典中的 `HANDBOOK_ID`、`NODE_ID`、`REPOSITORY_ID` 不能直接视为同一类键。实现前应将前两者统一重命名为现有主键名称，并把仓库字段拆成“提供方 + 外部标识”；如果评审确认 scope 没有本地主表，则 `SCOPE_ID` 也必须改为外部范围键或先补范围目录表。

## 2. 表字典

### 2.1 文档与正文

| 表 | 字段（类型；可空性；说明） | 主键/唯一/外键 | 索引与处理 |
|---|---|---|---|
| `KC_DP_DOCUMENT` | `DOCUMENT_ID` (BIGINT; N; 主键)；`SCOPE_ID` (待确认后定型)；`MANUAL_ID` (BIGINT; N)；`OUTLINE_VERSION_ID` (BIGINT; N)；`OUTLINE_NODE_ID` (BIGINT; N)；`REPOSITORY_PROVIDER` (VARCHAR(32); N)；`REPOSITORY_KEY` (VARCHAR(256); N; 外部标识)；`BRANCH` (VARCHAR(256); N)；`LANGUAGE` (VARCHAR(32); N)；`CURRENT_VERSION_ID` (BIGINT; Y)；`EDIT_VERSION` (BIGINT; N; 默认 0)；`STATE` (VARCHAR(32); N)；`CREATED_AT/UPDATED_AT` (TIMESTAMP; N)；`CREATED_BY/UPDATED_BY` (VARCHAR(128); N)` | PK `DOCUMENT_ID`；唯一 `(SCOPE_ID,MANUAL_ID,OUTLINE_VERSION_ID,OUTLINE_NODE_ID,REPOSITORY_PROVIDER,REPOSITORY_KEY,BRANCH,LANGUAGE)`；`CURRENT_VERSION_ID` 逻辑关联 `VERSION`，迁移时允许暂空 | 当前指针和 CAS 更新按主键；目录按范围、手册和更新时间分页；不索引正文 |
| `KC_DP_TEXT_CONTENT` | `TEXT_ID` (BIGINT; N)；`SCOPE_ID` (待确认后定型)；`DIGEST` (CHAR(64); N)；`CONTENT_TYPE` (VARCHAR(64); N)；`CHARSET` (VARCHAR(32); N)；`BYTE_SIZE` (BIGINT; N)；`BODY` (CLOB; N)；`NORMALIZATION_VERSION` (VARCHAR(32); N)；`CREATED_AT` (TIMESTAMP; N)；`PURGE_STATE` (VARCHAR(32); N)` | PK `TEXT_ID`；唯一 `(SCOPE_ID,DIGEST,CONTENT_TYPE,NORMALIZATION_VERSION)` | 摘要唯一索引；不对 `BODY` 建普通索引；仅被无引用且过宽限期的记录清理 |
| `KC_DP_VERSION` | `VERSION_ID` (BIGINT; N)；`DOCUMENT_ID` (BIGINT; N)；`VERSION_NO` (BIGINT; N)；`PARENT_VERSION_ID` (BIGINT; Y)；`TEXT_ID` (BIGINT; N)；`HTML_TEXT_ID` (BIGINT; Y)；`BASELINE_COMMIT` (VARCHAR(128); Y)；`MANIFEST_DIGEST` (CHAR(64); Y)；`ORIGIN_TASK_ID` (BIGINT; Y)；`STATE` (VARCHAR(32); N)；`CREATED_AT/CREATED_BY` (TIMESTAMP/VARCHAR(128); N)` | PK `VERSION_ID`；唯一 `(DOCUMENT_ID,VERSION_NO)`；FK `DOCUMENT_ID`、`TEXT_ID`、可选父版本和 HTML 文本 | 按文档版本分页；`STATE` 变更追加审计；正文不可更新 |

### 2.2 资源与产物

| 表 | 字段（类型；可空性；说明） | 主键/唯一/外键 | 索引与处理 |
|---|---|---|---|
| `KC_DP_BINARY_CONTENT` | `BINARY_ID` (BIGINT; N)；`SCOPE_ID` (待确认后定型)；`DIGEST` (CHAR(64); N)；`BYTE_SIZE` (BIGINT; N)；`DETECTED_MIME` (VARCHAR(128); N)；`ORIGINAL_MIME` (VARCHAR(128); Y)；`BODY` (BLOB; N)；`VALIDATION_STATE` (VARCHAR(32); N)；`CREATED_AT` (TIMESTAMP; N)` | PK `BINARY_ID`；唯一 `(SCOPE_ID,DIGEST)` | 摘要唯一索引；BLOB 流式读写；校验失败不可被资源绑定 |
| `KC_DP_ASSET` | `ASSET_ID` (BIGINT; N)；`SCOPE_ID` (待确认后定型)；`DOCUMENT_ID` (BIGINT; N)；`BINARY_ID` (BIGINT; N)；`ORIGINAL_NAME` (VARCHAR(512); N)；`EXTENSION` (VARCHAR(32); Y)；`KIND` (VARCHAR(32); N)；`STATUS` (VARCHAR(32); N)；`EXPIRES_AT` (TIMESTAMP; Y)；`CREATED_AT/CREATED_BY` (TIMESTAMP/VARCHAR(128); N)` | PK `ASSET_ID`；文档、二进制为逻辑关联；不以文件名做唯一键 | `(DOCUMENT_ID,STATUS)`、`BINARY_ID` 索引；文件名仅展示，输出路径另存清单 |
| `KC_DP_VERSION_ASSET` | `VERSION_ID` (BIGINT; N)；`ASSET_ID` (BIGINT; N)；`RELATIVE_PATH` (VARCHAR(1024); N)；`ROLE` (VARCHAR(32); N)；`CREATED_AT` (TIMESTAMP; N)` | PK `(VERSION_ID,ASSET_ID)`；唯一 `(VERSION_ID,RELATIVE_PATH)`；FK 版本、资源 | `ASSET_ID` 反向索引支撑清理；版本冻结后不可更新 |
| `KC_DP_ARTIFACT` | `ARTIFACT_ID` (BIGINT; N)；`SCOPE_ID` (待确认后定型)；`TASK_ID/STEP_ID` (BIGINT; N)；`KIND` (VARCHAR(64); N)；`SCHEMA_VERSION` (VARCHAR(32); N)；`TEXT_ID` (BIGINT; Y)；`BINARY_ID` (BIGINT; Y)；`DIGEST` (CHAR(64); N)；`BYTE_SIZE` (BIGINT; N)；`EXPIRES_AT` (TIMESTAMP; Y)；`CREATED_AT` (TIMESTAMP; N)` | PK `ARTIFACT_ID`；CHECK 恰好一个载荷引用；FK 任务、步骤、文本或二进制 | `(TASK_ID,STEP_ID,KIND)` 查询索引；产物不可变，清理前检查引用 |
| `KC_DP_ARTIFACT_REF` | `REF_ID` (BIGINT; N)；`OWNER_TYPE` (VARCHAR(32); N)；`OWNER_ID` (BIGINT; N)；`ARTIFACT_ID` (BIGINT; N)；`CREATED_AT` (TIMESTAMP; N)` | PK `REF_ID`；唯一 `(OWNER_TYPE,OWNER_ID,ARTIFACT_ID)`；FK 产物 | `(ARTIFACT_ID)`、`(OWNER_TYPE,OWNER_ID)` 索引；禁止孤立引用 |

### 2.3 任务、评审与发布

| 表 | 字段（类型；可空性；说明） | 主键/唯一/外键 | 索引与处理 |
|---|---|---|---|
| `KC_DP_TASK` | `TASK_ID` (BIGINT; N)；`SCOPE_ID` (待确认后定型)；`DOCUMENT_ID` (BIGINT; N)；`KIND` (VARCHAR(64); N)；`INPUT_VERSION_ID` (BIGINT; N)；`RULE_VERSION` (VARCHAR(64); N)；`STATE` (VARCHAR(32); N)；`ATTEMPT` (INT; N)；`LEASE_OWNER` (VARCHAR(128); Y)；`LEASE_UNTIL` (TIMESTAMP; Y)；`FENCE_TOKEN` (BIGINT; N)；`AVAILABLE_AT` (TIMESTAMP; N)；`CANCEL_REQUESTED_AT` (TIMESTAMP; Y)；`CREATED_AT/UPDATED_AT` (TIMESTAMP; N)` | PK `TASK_ID`；输入版本为逻辑关联；唯一业务幂等键由 `IDEMPOTENCY` 管理 | `(STATE,AVAILABLE_AT)` 队列索引；`(LEASE_UNTIL,FENCE_TOKEN)` 接管扫描；完成写入必须校验 token |
| `KC_DP_TASK_STEP` | `STEP_ID` (BIGINT; N)；`TASK_ID` (BIGINT; N)；`STEP_KEY` (VARCHAR(128); N)；`ATTEMPT` (INT; N)；`STATE` (VARCHAR(32); N)；`CHECKPOINT_TEXT_ID` (BIGINT; Y)；`STARTED_AT/FINISHED_AT` (TIMESTAMP; Y)；`ERROR_CODE` (VARCHAR(64); Y)；`ERROR_DETAIL_TEXT_ID` (BIGINT; Y)` | PK `STEP_ID`；唯一 `(TASK_ID,STEP_KEY,ATTEMPT)`；FK 任务和文本 | `(TASK_ID,STEP_KEY)` 查询；错误详情受安全等级和留存控制 |
| `KC_DP_REVIEW` | `REVIEW_ID` (BIGINT; N)；`SCOPE_ID` (待确认后定型)；`DOCUMENT_ID/VERSION_ID` (BIGINT; N)；`MANIFEST_DIGEST` (CHAR(64); N)；`STATUS` (VARCHAR(32); N)；`POLICY_VERSION` (VARCHAR(64); N)；`DECISION` (VARCHAR(32); Y)；`REVIEWER` (VARCHAR(128); Y)；`REVIEWER_PRINCIPAL_ID` (BIGINT; Y)；`CREATED_AT/DECIDED_AT` (TIMESTAMP; N/Y)` | PK `REVIEW_ID`；固定版本和评审人是逻辑关联；评审中的版本与清单不可替换 | `(DOCUMENT_ID,STATUS)`、`(VERSION_ID)` 索引；拒绝和撤回写审计 |
| `KC_DP_REVIEW_ITEM` | `REVIEW_ITEM_ID` (BIGINT; N)；`REVIEW_ID` (BIGINT; N)；`CHECK_KEY` (VARCHAR(128); N)；`RESULT` (VARCHAR(32); N)；`DETAIL_TEXT_ID` (BIGINT; Y)；`CREATED_AT` (TIMESTAMP; N)` | PK `REVIEW_ITEM_ID`；唯一 `(REVIEW_ID,CHECK_KEY)`；FK 评审 | `(REVIEW_ID)` 索引；详情不复制到主表 |
| `KC_DP_PUBLICATION` | `PUBLICATION_ID` (BIGINT; N)；`REVIEW_ID` (BIGINT; N)；`REPOSITORY_PROVIDER` (VARCHAR(32); N)；`REPOSITORY_KEY` (VARCHAR(256); N; 外部标识)；`TARGET_BRANCH` (VARCHAR(256); N)；`EXPECTED_HEAD` (VARCHAR(128); Y)；`STATUS` (VARCHAR(32); N)；`COMMIT_SHA/MR_ID/MERGED_SHA` (VARCHAR(128); Y)；`ERROR_CODE` (VARCHAR(64); Y)；`CREATED_AT/UPDATED_AT` (TIMESTAMP; N)` | PK `PUBLICATION_ID`；唯一 `(REVIEW_ID,REPOSITORY_PROVIDER,REPOSITORY_KEY,TARGET_BRANCH)`；评审为逻辑关联 | `(STATUS,UPDATED_AT)` 对账索引；`reconciling` 不自动重复提交 |
| `KC_DP_PUBLICATION_ITEM` | `PUBLICATION_ITEM_ID` (BIGINT; N)；`PUBLICATION_ID` (BIGINT; N)；`VERSION_ID` (BIGINT; N)；`RELATIVE_PATH` (VARCHAR(1024); N)；`BLOB_DIGEST` (CHAR(64); N)；`BYTE_SIZE` (BIGINT; N)；`CREATED_AT` (TIMESTAMP; N)` | PK `PUBLICATION_ITEM_ID`；唯一 `(PUBLICATION_ID,RELATIVE_PATH)`；FK 发布、版本 | `(PUBLICATION_ID)` 索引；清单冻结后只读 |

### 2.4 可靠性、治理与配额

| 表 | 字段（类型；可空性；说明） | 主键/唯一/外键 | 索引与处理 |
|---|---|---|---|
| `KC_DP_OUTBOX` | `OUTBOX_ID` (BIGINT; N)；`SCOPE_ID` (待确认后定型)；`EVENT_TYPE` (VARCHAR(64); N)；`ENTITY_ID` (BIGINT; N)；`PAYLOAD_TEXT_ID` (BIGINT; Y)；`STATE` (VARCHAR(32); N)；`AVAILABLE_AT/LEASE_UNTIL` (TIMESTAMP; N/Y)；`ATTEMPT` (INT; N)；`CREATED_AT` (TIMESTAMP; N)` | PK `OUTBOX_ID`；同一业务事件的幂等键唯一；载荷为逻辑关联 | `(STATE,AVAILABLE_AT)`、`(LEASE_UNTIL)` 索引；与业务事务同提交 |
| `KC_DP_IDEMPOTENCY` | `IDEMPOTENCY_ID` (BIGINT; N)；`PRINCIPAL_SCOPE` (VARCHAR(128); N)；`OPERATION` (VARCHAR(64); N)；`REQUEST_KEY` (VARCHAR(256); N)；`REQUEST_DIGEST` (CHAR(64); N)；`RESULT_REF` (VARCHAR(256); Y)；`EXPIRES_AT` (TIMESTAMP; N)；`CREATED_AT` (TIMESTAMP; N)` | PK `IDEMPOTENCY_ID`；唯一 `(PRINCIPAL_SCOPE,OPERATION,REQUEST_KEY)` | 过期索引；同键摘要不一致返回 409，不覆盖原结果 |
| `KC_DP_AUDIT` | `AUDIT_ID` (BIGINT; N)；`SCOPE_ID` (待确认后定型)；`ACTOR` (VARCHAR(128); N)；`ACTOR_PRINCIPAL_ID` (BIGINT; Y)；`ACTION` (VARCHAR(64); N)；`ENTITY_TYPE` (VARCHAR(64); N)；`ENTITY_ID` (BIGINT; N)；`VERSION_ID` (BIGINT; Y)；`TRACE_ID` (VARCHAR(128); N)；`RESULT` (VARCHAR(32); N)；`DETAIL_TEXT_ID` (BIGINT; Y)；`CREATED_AT` (TIMESTAMP; N)` | PK `AUDIT_ID`；版本和详情为逻辑关联；禁止更新 | `(ENTITY_TYPE,ENTITY_ID,CREATED_AT)`、`(SCOPE_ID,CREATED_AT)` 索引；详情脱敏、正文不重复存储 |
| `KC_DP_QUOTA_USAGE` | `USAGE_ID` (BIGINT; N)；`SCOPE_ID` (待确认后定型)；`PERIOD_KEY` (VARCHAR(32); N)；`RESOURCE_KIND` (VARCHAR(32); N)；`RESERVED_BYTES/USED_BYTES` (BIGINT; N)；`RESERVED_COUNT/USED_COUNT` (BIGINT; N)；`UPDATED_AT` (TIMESTAMP; N)` | PK `USAGE_ID`；唯一 `(SCOPE_ID,PERIOD_KEY,RESOURCE_KIND)` | 事务内原子增减；更新行数必须可检查，避免并发绕过配额 |

## 3. 约束、留存和权限清单

- 所有跨表引用在数据库约束和服务层均校验；迁移期间的暂空字段必须有批次校验和切换门禁。
- `TEXT_CONTENT`、`BINARY_CONTENT`、`VERSION`、`ARTIFACT`、发布清单和审计默认不可更新；修订通过新记录和新引用表达。
- 物理内容清理必须先检查当前指针、评审、发布、任务、人工 hold 和未过宽限期的资源引用；不能仅依据时间或摘要重复删除。
- 应用账号仅拥有业务读写和必要的状态更新权限；Worker 不得修改评审结论；发布账号只访问固定版本和目标仓库；迁移账号独立、短期启用。
- 日志和错误响应只记录 ID、摘要、大小、状态和 `traceId`，不记录 CLOB/BLOB、密钥或完整模型上下文。

## 4. 实现前确认项

本字典仍有阻断定型项：确认 `SCOPE_ID` 权威来源及类型；确认 GitLab 仓库标识格式和长度；确认四类现有序列中的归属或新增文档生产序列；审核按文档/版本/内容/资源/任务/评审/发布拆表的必要性、状态机及保留边界；按已知 API 查询列出访问路径并据此精简唯一键和二级索引。完成这些业务确认后，再核对目标 YashanDB 版本、精确类型映射、字符集和时区、LOB 分块及事务参数、索引执行计划、分区/归档策略、备份恢复验证、账号权限、迁移编号和回退 SQL。完成前本文件仍是评审稿，不得作为已批准结构或容量承诺。
