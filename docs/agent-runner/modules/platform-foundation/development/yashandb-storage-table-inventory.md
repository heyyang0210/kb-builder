# YashanDB 表结构清单

> 作用：给知识中心当前落库的兼容层和手册/大纲关系模型做统一审视。
> 说明：现在 YashanDB 同时承载两类表：
> 1. 兼容仓储表，继续保存历史 `KC_RECORD` 迁移能力。
> 2. 手册/大纲关系表，作为知识资产和内容管理的主写模型。

## 1. 兼容仓储表

| 表名 | 用途 | 关键列 | 说明 |
|---|---|---|---|
| `KC_SCHEMA_MIGRATION` | 记录已执行的 Schema 版本 | `VERSION_ID`, `CHECKSUM`, `APPLIED_AT` | 只保存迁移版本账本 |
| `KC_RECORD` | 通用 JSON 记录仓储 | `NAMESPACE`, `RECORD_KEY`, `PAYLOAD`, `PAYLOAD_SHA256`, `REVISION`, `DELETED`, `CREATED_AT`, `UPDATED_AT` | 仍承接认证、资产、评论、工作流等历史聚合 |
| `KC_MIGRATION_BATCH` | 外部 JSON 迁移批次账本 | `BATCH_ID`, `SOURCE_KIND`, `STATUS`, `RECORD_COUNT`, `SOURCE_SHA256`, `RESULT_SHA256`, `STARTED_AT`, `COMPLETED_AT`, `ERROR_SUMMARY` | 记录迁移过程和对账结果 |

## 2. 手册与大纲关系表

| 表名 | 用途 | 关键列 | 说明 |
|---|---|---|---|
| `MANUALS` | 手册主表 | `ID`, `CODE`, `TITLE`, `PRODUCT_ID`, `OWNER_A_*`, `OWNER_B_*`, `DEPARTMENT_ID`, `CURRENT_OUTLINE_VERSION_ID`, `STATUS`, `ARCHIVED_AT`, `ASSET_VERSION`, `SUMMARY`, `LEGACY_PAYLOAD` | 手册级主数据与兼容快照 |
| `DEPARTMENTS` | 承建部门字典 | `ID`, `NAME`, `STATUS` | 手册承建部门与展示归属 |
| `TECH_DOMAINS` | 技术领域字典 | `ID`, `NAME`, `STATUS` | section 级技术领域归属 |
| `PERSONNEL_DOMAINS` | 人员-领域映射 | `ID`, `PERSON_ID`, `TECH_DOMAIN_ID`, `ROLE_CODE` | 责任人和技术领域关系 |
| `MANUAL_OUTLINE_VERSIONS` | 大纲版本表 | `ID`, `MANUAL_ID`, `VERSION_CODE`, `NAME`, `STATE`, `BASE_VERSION_ID`, `SOURCE_TYPE`, `SOURCE_FINGERPRINT`, `PARSER_VERSION`, `RULE_VERSION`, `EDIT_VERSION`, `PUBLISHED_AT`, `LEGACY_PAYLOAD` | 大纲版本、状态和来源快照 |
| `MANUAL_OUTLINE_NODES` | 大纲节点表 | `ID`, `MANUAL_ID`, `OUTLINE_VERSION_ID`, `PARENT_ID`, `NODE_TYPE`, `SOURCE_ID`, `TITLE`, `DESCRIPTION`, `OUTLINE_LEVEL`, `OUTLINE_PATH`, `ORDER_INDEX` | 目录节点和 `document` 叶子节点 |
| `MANUAL_DOCUMENTS` | 文档表 | `ID`, `MANUAL_ID`, `OUTLINE_VERSION_ID`, `OUTLINE_NODE_ID`, `DOCUMENT_CODE`, `TITLE`, `SUMMARY`, `OWNER_ID`, `STATUS`, `LEGACY_PAYLOAD` | 每个 `document` 节点对应一篇文档；`ID` 使用大纲节点 ID，来源页面编号保存在 `DOCUMENT_CODE` |
| `MANUAL_DOCUMENT_SECTIONS` | 文档 section 表 | `ID`, `MANUAL_ID`, `DOCUMENT_ID`, `TITLE`, `BODY`, `TECH_DOMAIN_ID`, `OWNER_ID`, `STATUS`, `VERSION`, `ORDER_INDEX`, `PLANNED_END_DATE`, `FINISHED_AT` | 文档正文的最小维护单位 |

## 3. 关系约束

1. `MANUALS` 下面可以有多个大纲版本。
2. `MANUAL_OUTLINE_VERSIONS` 下面可以有多个节点。
3. `MANUAL_OUTLINE_NODES.NODE_TYPE = 'document'` 时，才能绑定到 `MANUAL_DOCUMENTS`。
4. `MANUAL_DOCUMENTS` 下面可以有多个 `MANUAL_DOCUMENT_SECTIONS`。
5. `section` 不参与大纲层级，只承载正文、责任和进度。

## 4. 业务视角

| 业务对象 | 主写表 | 备注 |
|---|---|---|
| 手册 | `MANUALS` | 兼容原知识资产视图 |
| 大纲版本 | `MANUAL_OUTLINE_VERSIONS` | 发布、候选、回滚都落在这里 |
| 大纲节点 | `MANUAL_OUTLINE_NODES` | 目录和文档叶子统一管理 |
| 文档 | `MANUAL_DOCUMENTS` | 叶子节点的内容载体 |
| 文档正文小节 | `MANUAL_DOCUMENT_SECTIONS` | 维护最小颗粒度 |

## 5. 当前结论

这次改造已经不是单纯的 `KC_RECORD` 兼容仓储，而是把手册与大纲域正式拆成了关系型主模型。
`KC_RECORD` 继续保留给历史兼容和低频聚合，手册/大纲写入、读取和预检则以新表为准。
