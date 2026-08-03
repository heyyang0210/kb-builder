# YashanDB 资料加工平台工程化任务拆分

> 版本：v1.0  
> 日期：2026-07-30  
> 上位设计：`docs/00-概要设计.md`  
> 关联设计：`docs/08-pingcode-processing-six-step-pipeline-design.md`、`docs/12-PingCode知识提取步骤详细设计.md`、`docs/15-PingCode图谱与数据集生成步骤详细设计.md`、`docs/18-PingCode知识提取与构建测试设计.md`

## 一、平台定位

当前平台定位为 **YashanDB 资料加工与知识图谱生成平台**。

本阶段聚焦：

1. 资料接入、清洗、结构化处理；
2. embedding 聚类、清洗和低成本初筛；
3. 关键词质量分析图谱；
4. 基于已确认关键词的正式知识抽取；
5. 知识校验、融合、消歧；
6. 可追溯知识图谱生成和质量分析。

本阶段不把完整 GraphRAG 问答、体系化文档生成和新文档反哺闭环作为开发范围。后续如果要扩展问答和体系化生成，应以本阶段产出的正式知识图谱、向量索引和质量报告为基础。

## 二、主链路

```text
资料接入
  -> 资源预处理
  -> 关键词质量分析图谱
  -> 正式知识抽取
  -> 知识校验融合
  -> 知识图谱生成
```

其中，资源预处理阶段必须包含：

- 清洗和规范化；
- 语义标题生成；
- 领域词典初筛；
- embedding 生成与缓存；
- embedding 聚类；
- 低成本主题初筛。

资源预处理是后续模型调用的成本控制层。只有预处理无法确定主题、标题正文冲突、正文存在多个独立主题或需要发现词典外专业术语时，才进入模型补充路径。

## 三、优先级定义

| 优先级 | 含义 | 处理原则 |
|---|---|---|
| P0 | 阻断主链路可用性的致命问题 | 必须先修复，再继续扩展能力 |
| P1 | 资料加工和关键词图谱稳定化能力 | 当前阶段重点建设 |
| P2 | 正式知识质量、图谱质量和规模化扩展 | 在 P0/P1 稳定后推进 |

当前 P0 是正式知识构建可靠性，包括任务卡死、取消不及时和批次状态长期 `processing`。

## 四、工程包拆分

| 工程包 | 名称 | 目标 |
|---|---|---|
| EPIC-01 | 资料接入与资源清单 | 建立原始资料的统一资源模型和可追溯清单 |
| EPIC-02 | 资源预处理与低成本初筛 | 完成清洗、embedding 聚类和模型调用前筛选 |
| EPIC-03 | 关键词质量分析图谱 | 稳定生成关键词与处理单元证据关系 |
| EPIC-04 | 正式知识抽取最小可用链路 | 基于已确认关键词抽取正式知识点 |
| EPIC-05 | 知识校验、融合与消歧 | 将候选知识变成可信最终知识 |
| EPIC-06 | 知识图谱生成与质量分析 | 生成可审计图谱和质量报告 |

### 4.1 设计文档索引

本表用于从总览文档快速跳转到各模块设计文档。后续新增设计文档时，必须同步更新本表。

| 编号 | 文档 | 定位 | 关联阶段 | 当前用途 |
|---|---|---|---|---|
| 00 | `docs/00-概要设计.md` | 上位架构方案 | 全局 | 明确大规模资料加工、图谱和后续 GraphRAG 方向 |
| 01 | `docs/01-PingCode资料预处理步骤详细设计.md` | 资料预处理设计 | EPIC-01、EPIC-02 | 原始资料保留、格式识别、处理单元生成 |
| 02 | `docs/02-pingcode-frontend-design.md` | 前端总体设计 | EPIC-03、EPIC-06 | 页面、路由、质量分析入口 |
| 03 | `docs/03-pingcode-frontend-interaction-detail.md` | 前端交互细节 | EPIC-03、EPIC-06 | 质量问题、图谱、任务交互 |
| 04 | `docs/04-pingcode-processing-e2e-framework-design.md` | 端到端加工框架 | 全局 | 运行框架、任务、产物和质量闭环 |
| 05 | `docs/05-pingcode-processing-llm-control-design.md` | 模型调用控制 | EPIC-02、EPIC-04 | Provider、模型调用、审计、成本控制 |
| 06 | `docs/06-pingcode-processing-prompt-management-design.md` | Prompt 管理 | EPIC-04 | Prompt 草稿、发布、审计 |
| 07 | `docs/07-pingcode-processing-prompt-registry-design.md` | Prompt/Skill Registry | EPIC-04 | Skill、Prompt 版本和渲染管理 |
| 08 | `docs/08-pingcode-processing-six-step-pipeline-design.md` | 六步骤流水线 | 全局 | 当前主链路设计基线 |
| 09 | `docs/09-pingcode-processing-unfinished-items.md` | 未完成项跟踪 | 全局 | 历史未完成项和依赖顺序 |
| 10 | `docs/10-设计文档预处理-专业提示词.md` | 设计文档预处理 Prompt | EPIC-02 | 设计类资料预处理提示词参考 |
| 11 | `docs/11-PingCode元数据构建步骤详细设计.md` | 元数据构建设计 | EPIC-02 | 文档标题、分类、领域术语、上下文 |
| 12 | `docs/12-PingCode知识提取步骤详细设计.md` | 知识提取设计 | EPIC-03、EPIC-04 | 关键词默认档和正式知识构建 |
| 13 | `docs/13-PingCode按需语义补充步骤详细设计.md` | 按需语义补充 | EPIC-04、EPIC-05 | 不确定项补充和失败归因 |
| 14 | `docs/14-PingCode知识校验与合并步骤详细设计.md` | 校验与合并 | EPIC-05 | Schema、证据、拒绝、最终知识 |
| 15 | `docs/15-PingCode图谱与数据集生成步骤详细设计.md` | 图谱与数据集 | EPIC-03、EPIC-06 | 关键词图谱、正式图谱、数据集契约 |
| 16 | `docs/16-FastGPT集成改造方案.md` | FastGPT 集成 | 后续阶段 | 当前不作为资料加工主链路范围 |
| 17 | `docs/17-PingCode知识加工全链路测试与问题修复报告.md` | 历史测试报告 | 全局 | 历史问题和验证证据 |
| 18 | `docs/18-PingCode知识提取与构建测试设计.md` | 测试设计与验证 | 全局 | 功能、性能、真实 API 验收 |
| 19 | `docs/19-YashanDB资料加工平台工程化任务拆分.md` | 项目任务总览 | 全局 | 进度管控、任务拆分、设计文档导航 |

### 4.2 任务进度总览表

状态取值建议：

```text
待设计 / 待实现 / 进行中 / 部分完成 / 代码完成待验证 / 已验证 / 阻塞 / 暂缓
```

本表是后续项目进度管控入口。每次完成设计、实现、测试或发现阻塞时，应同步更新“状态、当前结论、证据/验收记录”。

| 任务 ID | 优先级 | 工程包 | 任务名称 | 状态 | 对应设计文档 | 关键产物 | 当前结论 / 进度说明 | 验收记录 |
|---|---|---|---|---|---|---|---|---|
| TASK-P0-01 | P0 | EPIC-04 | 正式知识构建任务超时与取消边界修复 | 代码完成待验证 | `docs/12`、`docs/18` | `modelCallId` 事件、`knowledge-extraction-batches.jsonl`、`quality/extraction-issues.json` | 真实取消、模型调用可追溯、Skill timeout/defaults 透传和 batch 解锁已通过；代码层已补齐失败分类、顶层 `agentTaskId/chunkId/modelCallId`、批次审计和质量问题追溯字段；真实 timeout/局部失败落盘仍待验证 | 定向单测覆盖 schema/empty/timeout/cancel 和 audit 字段；历史真实取消任务约 348ms/242ms；待新 formal task 验证 |
| TASK-P0-02 | P0 | EPIC-04 | Workflow Agent 最小化改造 | 代码完成待验证 | `docs/12`、`docs/13`、`docs/18` | `knowledge-candidates.jsonl`、模型批次审计、`extraction-issues.json` | 已收敛为单 chunk 知识点候选提取；实体、关系、关键词和语义补充不属于本版本 | 定向单测已覆盖单 chunk、局部失败和追溯字段；待真实 `formal_knowledge` API 验收 |
| TASK-P0-03 | P0 | EPIC-01、EPIC-04 | batch activeTask 状态恢复 | 代码完成待验证 | `docs/04`、`docs/18` | 批次状态修复记录、任务终态事件 | 后端启动、训练任务查询和创建任务前均会恢复僵尸 activeTask；当前进程内活跃任务不会被误判中断 | 单测覆盖查询恢复、创建前 orphan activeTask 恢复和当前进程活跃任务保护；待真实进程中断场景验证 |
| TASK-P1-01 | P1 | EPIC-01 | 资源清单和原始资料追溯模型 | 已验证 | `docs/01`、`docs/08` | `source-resources.jsonl`、`source-assets.jsonl`、`ingestion-report.json` | 已在资料预处理运行目录补资源级清单、素材清单和接入汇总，不破坏既有 documents/chunks/structure-blocks | `training_41fed7125a9e465a` 真实验证通过：source-resources 14 条、source-assets 54 条、ingestion-report 统计一致 |
| TASK-P1-02 | P1 | EPIC-02 | 标题清洗与语义标题生成 | 已验证 | `docs/11`、`docs/12` | `semanticTitle`、`titleNoiseRemoved`、`topicCandidates` | documents 和 chunk contexts 已补标题噪声审计与主题候选字段，规则继续读取 `title-cleaning.yaml` | `dataset_5165fe5ba9f24052` 图谱无完整文件名、无 `YashanDB/DSI/内幕文档` 噪声关键词 |
| TASK-P1-03 | P1 | EPIC-02 | 低成本主题初筛 | 已验证 | `docs/11`、`docs/12`、`docs/18` | `preselection-report.json` | 元数据阶段已生成独立初筛报告，状态枚举固定为 `deterministic_ready/model_required/human_review/skip` | 真实批次 14 条均为 `deterministic_ready` 且证据完整；`model_required/human_review/skip` 由单测覆盖，待混合真实批次补充分布验证 |
| TASK-P1-04 | P1 | EPIC-02 | embedding 生成与缓存 | 已验证 | `docs/01`、`docs/05`、`docs/08`、`docs/18` | `embedding-index.jsonl`、embedding 缓存 | 已实现 `embedding-rules.yaml`、deterministic hash provider、缓存键、profile version 失效和 warning 降级；产物不写 API Key | `training_c8fc41171173416b` 真实验证通过：embedding-index 14 条、embedding issues 0 条、无敏感配置命中；单测覆盖缓存命中、版本失效和 provider 不可用降级 |
| TASK-P1-05 | P1 | EPIC-02 | embedding 聚类报告 | 已验证 | `docs/01`、`docs/08`、`docs/18` | `cluster-report.json`、`cluster-issues.json` | 已实现 cosine threshold connected components、稳定 `clusterId` 和不入图边界；cluster 不接 formal 调度 | `training_c8fc41171173416b` 真实验证通过：embeddingCount=14、clusterCount=12、singletonCount=11、warningCount=0，图谱无 embedding/cluster 节点；单测覆盖稳定 clusterId |
| TASK-P1-06 | P1 | EPIC-03 | 关键词默认档读取预处理初筛结果 | 已验证 | `docs/12`、`docs/18` | `keyword-candidates.jsonl`、`keyword-cache-summary.json` | `keyword_analysis` 已优先读取 `preselection-report.json`；只有 `model_required` 进入关键词模型，无报告时回退旧逻辑 | `training_41fed7125a9e465a` 真实验证通过：`deterministicSkippedChunks=14`、`modelScheduledChunks=0`、模型调用 `succeeded=0/failed=0/skipped=14` |
| TASK-P1-07 | P1 | EPIC-03 | 关键词 canonical 归并与别名命中回归 | 已验证 | `docs/15`、`docs/18` | canonical `Keyword`、别名、上下文边 | `Index/索引/index` 与 `Sequence/SEQUENCE/序列` 别名命中已验证 | `dataset_4091451d25294cdf` 图谱验证通过 |
| TASK-P1-08 | P1 | EPIC-03、EPIC-04 | 关键词审批与正式构建输入联动 | 已验证 | `docs/12`、`docs/15`、`docs/18` | 审批状态、正式构建输入 chunk 集合、`formal-knowledge-input.json` | 已补正式构建输入计划；`rejected` 不进入调度；同一 chunk 多已确认关键词只调度一次，`keywordContext` 去重排序 | TDD 绿灯：`test_training_service.py` 60/60 通过；真实任务 `training_cdea23de446345c6` 验证 `dataset_43759133d8a442bd` 仅调度 1 个已确认关键词、过滤 11 个 rejected 关键词、去重后 1 个 chunk |
| TASK-P2-00 | P2 | EPIC-03、EPIC-04 | 正式构建前业务语义过滤 | 代码完成待前端真实页面验证 | `docs/12`、`docs/15`、`docs/18`、`docs/19` | `keyword-business-review.json`、业务准入状态、正式构建关键词集合、过滤前后图谱对比 | 已补 `business-keyword-rules.yaml`、业务过滤接口、节点 `businessStatus`、图谱 summary 统计、正式构建双门控；质量分析页已增加过滤执行反馈、过滤前/后/变化项/业务注入/待业务确认视图、节点业务状态透出和人工确认批注面板；`training_c7c7e7c29baf4716` 需用真实页面完成交互验收 | TDD 绿灯：`test_training_service.py` 64/64 通过；待前端构建、`8001/3500` API 和页面交互验证 |
| TASK-P2-01 | P2 | EPIC-04 | 正式知识 Schema 最小闭环 | 代码完成待真实模型候选验证 | `docs/12`、`docs/14`、`docs/18` | `knowledge-candidates.jsonl` | 候选已补 `state=agent_resolved`、去重排序 `keywordIds/keywordContext`；第一版 formal 只写 `knowledge_point` | TDD 绿灯：`test_training_service.py` 60/60 通过；真实任务 `training_cdea23de446345c6` 因模型网关 60s 超时未产出 `knowledge-candidates.jsonl`，已取消且任务终态为 `cancelled` |
| TASK-P2-02 | P2 | EPIC-04、EPIC-05 | 实体与关系抽取拆分 | 概要设计与状态骨架完成 | `docs/12`、`docs/14`、`docs/18` | `entity-relation-stage-status.json`、后续 `entities.jsonl`、`relations.jsonl` | 已明确实体/关系为 P2-01 后的显式阶段，不改变当前 formal 第一版只生成 `knowledge_point` 的边界；质量报告和前端可展示实体/关系阶段状态 | 单测覆盖 `entityRelationStage` 进入质量报告；真实实体/关系抽取任务接口与模型调用暂缓 |
| TASK-P2-03 | P2 | EPIC-05 | 知识校验与拒绝原因落盘 | 暂缓 | `docs/14`、`docs/18` | `final-results/knowledge.jsonl`、`rejected.jsonl`、`quality/issues.json` | 校验设计已明确，正式知识链路未稳定导致真实结果不足 | 待正式知识候选产出后回归 |
| TASK-P2-04 | P2 | EPIC-06 | 正式知识图谱与关键词图谱分视图 | 暂缓 | `docs/15`、`docs/18` | 关键词图谱视图、正式知识图谱视图、`graph/summary.json` | 关键词默认图谱已验证；正式知识图谱待正式构建完成后验证 | 待 formal dataset 验证 |
| TASK-P2-05 | P2 | EPIC-06 | 图数据库适配预留 | 待设计 | `docs/00`、`docs/15` | 图数据库写入接口设计、JSON 审计图谱 | 当前仍以 JSON 图谱为审计产物，Neo4j/NebulaGraph 接口未设计 | 待接口设计评审 |

## 五、P0 任务：正式知识构建可靠性

### TASK-P0-01 正式知识构建任务超时与取消边界修复

**目标**：解决 `formal_knowledge` 任务长时间停在知识提取阶段、无进度、无法及时取消的问题。

**输入**：

- 已确认关键词集合；
- `keyword-chunk-index.json`；
- 关键词关联处理单元；
- 模型网关配置。

**输出**：

- 每个处理单元的执行状态；
- 每次模型调用的 `modelCallId`；
- 超时、失败、取消结果；
- `quality/extraction-issues.json`。

**验收标准**：

- 正式知识任务不能超过 5 分钟无任何处理单元进度；
- 每个模型调用开始前必须落事件，包含 `taskId/stageRunId/modelCallId/chunkId`；
- 单处理单元超时后写入质量问题，不阻塞其他处理单元；
- 失败分类必须区分 `KNOWLEDGE_EXTRACTION_TIMEOUT/SCHEMA_INVALID/EMPTY_RESULT/FAILED`；
- `knowledge-extraction-batches.jsonl` 和 `extraction-issues.json` 必须包含 `taskId/stageRunId/agentTaskId/chunkId/modelCallId/technicalError/durationMs`；
- 用户取消后 30 秒内任务进入 `cancelled` 或可解释的 `failed` 终态；
- 取消、失败、后端重启和 orphan activeTask 后批次不再保持长期 `processing`。

**依赖**：现有正式知识构建接口、模型网关、任务事件系统。

### TASK-P0-02 Workflow Agent 最小化改造

**目标**：将正式知识构建从“大而全 Workflow Agent”收敛为可控的最小知识点抽取链路。

**输入**：

- `formal_knowledge` 任务；
- 已确认关键词和关联处理单元；
- `knowledge-point-extraction` prompt/skill。

**输出**：

- `extraction-results/knowledge-candidates.jsonl`；
- `model-results/knowledge-extraction-batches.jsonl`；
- `quality/extraction-issues.json`。

**验收标准**：

- 第一版只生成知识点候选，不做跨 chunk 关系、实体、关系、关键词或 `needs_enrichment`；
- 每个 Agent 工作项只处理一个 chunk；
- 每条候选知识保留 `keywordIds/chunkId/resourceId/sourceResourceId/sourcePath/evidenceText/confidence`；
- 模型失败项写入中文质量问题，成功项正常落盘，单项失败不阻塞其他处理单元；
- 任务进度按处理单元终态递增，失败也计入已处理；
- 模型调用事件携带 `taskId/stageRunId/agentTaskId/chunkId/modelCallId`。

**依赖**：TASK-P0-01。

### TASK-P0-03 batch activeTask 状态恢复

**目标**：解决取消中、失败中或进程中断任务导致批次长期不可再次加工的问题。

**输入**：

- 批次 `activeTaskIds`；
- 训练任务状态；
- 运行目录事件和 manifest。

**输出**：

- 批次状态修复结果；
- 任务恢复或终态化记录；
- 可再次创建任务的批次。

**验收标准**：

- 取消、失败或进程中断后，批次不会长期停留在 `processing`；
- 后端启动或任务查询时可识别僵尸 active task；
- 僵尸任务被标记为 `failed` 或 `cancelled`，并写入中文原因；
- 同批次可以再次创建 `keyword_analysis` 或 `formal_knowledge` 任务。

**依赖**：任务状态模型、批次服务。

## 六、P1 任务：资源预处理增强

### TASK-P1-01 资源清单和原始资料追溯模型

**目标**：统一上传、PingCode 下载和本地资料的资源清单，保证后续所有处理结果可追溯。

**输入**：

- `MaterialBatch`；
- 原始文件；
- 来源元数据。

**输出**：

- `source-resources.jsonl`；
- `source-assets.jsonl`；
- `ingestion-report.json`。

**验收标准**：

- 每个资源包含来源、hash、路径、文件类型、处理状态；
- 图片和附件作为 asset 记录，不冒充正文知识；
- 重复文件、空文件、不可解析文件有明确状态；
- 资源 ID 不进入关键词集合。

**依赖**：资料接入和文件识别能力。

### TASK-P1-02 标题清洗与语义标题生成

**目标**：将文件名和文档标题清洗成可用于主题识别的语义标题。

**输入**：

- 原始文件名；
- 文档标题；
- 标题清洗规则；
- 数据库领域词典。

**输出**：

- `semanticTitle`；
- `titleNoiseRemoved`；
- `topicCandidates`。

**验收标准**：

- `YashanDB/DSI/内幕文档/副本编号/文件后缀` 不进入主题；
- 完整文件名不直接进入关键词；
- `Replication内幕` 生成 `Replication`；
- `事务内幕文档` 生成 `事务`；
- `YashanDB-可变列式存储` 生成 `可变列式存储`，后续可归并到 `列式存储`。

**依赖**：metadata rules、领域词典。

### TASK-P1-03 低成本主题初筛

**目标**：在模型调用前判断资源是否已经有足够确定性证据。

**输入**：

- `semanticTitle`；
- 章节标题；
- 正文高覆盖术语；
- 领域词典命中；
- 处理单元摘要。

**输出**：

- `preselection-report.json`；
- 每个资源或处理单元的 `preselectionState`。

**状态枚举**：

```text
deterministic_ready / model_required / human_review / skip
```

**验收标准**：

- 标题明确且正文有证据时标记为 `deterministic_ready`；
- 标题不明确、标题正文冲突或多主题文档标记为 `model_required`；
- 内容为空、分类冲突严重或噪声过多标记为 `human_review`；
- 非知识资料、技术 ID、图片路径类内容标记为 `skip`；
- 报告中记录判定原因和证据。

**依赖**：TASK-P1-02。

### TASK-P1-04 embedding 生成与缓存

**目标**：为文档、章节和处理单元生成可复用 embedding，支撑聚类和后续向量检索扩展。

**输入**：

- 语义标题；
- 文档摘要；
- 章节标题；
- 处理单元正文；
- embedding provider 配置。

**输出**：

- `embedding-index.jsonl`；
- embedding 缓存记录。

**验收标准**：

- 每条 embedding 记录包含 `resourceId/chunkId/contentHash/model/dimension/vectorHash`；
- 内容、模型和规则版本不变时复用缓存；
- embedding 失败不阻断确定性关键词图谱生成，但写入质量问题；
- 不记录 API Key 或敏感配置。

**依赖**：统一 Model Provider 或 embedding provider。

### TASK-P1-05 embedding 聚类报告

**目标**：用 embedding 聚合相近主题资料，减少后续重复抽取和重复归并成本。

**输入**：

- `embedding-index.jsonl`；
- 语义标题；
- 关键词候选；
- 文档和处理单元元数据。

**输出**：

- `cluster-report.json`。

**验收标准**：

- 同主题文档聚合到稳定 `clusterId`；
- 每个 cluster 包含代表标题、代表关键词、资源列表、处理单元列表；
- 聚类结果不直接作为关键词入图，只作为抽取调度和质量分析依据；
- cluster 变化可由 embedding 模型、规则版本或内容变化解释。

**依赖**：TASK-P1-04。

## 七、P1 任务：关键词质量分析稳定化

### TASK-P1-06 关键词默认档读取预处理初筛结果

**目标**：让 `keyword_analysis` 优先读取资源预处理初筛结果，减少不必要模型调用。

**输入**：

- `preselection-report.json`；
- `semanticTitle`；
- 领域词典命中；
- 处理单元证据。

**输出**：

- `keyword-candidates.jsonl`；
- `keyword-cache-summary.json`。

**验收标准**：

- `deterministic_ready` 文档不调用模型；
- `model_required` 文档才进入关键词模型补充；
- 标题明确批次模型调用数为 0；
- 无 `KEYWORD_EXTRACTION_DEGRADED` 回归。

**依赖**：TASK-P1-03。

### TASK-P1-07 关键词 canonical 归并与别名命中回归

**目标**：稳定关键词 canonical 节点和别名命中行为。

**输入**：

- 关键词候选；
- 领域词典；
- 别名表；
- 图谱节点和边。

**输出**：

- canonical `Keyword` 节点；
- `aliases/matchedAliases`；
- `CONTEXT_MATCHES_CHUNK` 边。

**验收标准**：

- `Index/索引/index` 命中同一节点和全部上下文边；
- `Sequence/SEQUENCE/序列` 命中同一节点和全部上下文边；
- `dataset_* / file_* / chunk_*` 不进入关键词和别名；
- 同一关键词跨多个资源只生成一个 canonical 节点。

**依赖**：关键词图谱构建。

### TASK-P1-08 关键词审批与正式构建输入联动

**目标**：让关键词审批结果严格控制正式知识构建输入范围。

**输入**：

- 关键词审批状态；
- `keyword-chunk-index.json`；
- 图谱摘要。

**输出**：

- 更新后的关键词审批状态；
- 正式知识构建输入处理单元集合。

**验收标准**：

- `accepted/autoAccepted` 关键词进入正式知识构建；
- `rejected` 关键词不进入正式知识构建；
- 审批状态变化不触发重新模型抽取关键词；
- 图谱摘要正确统计 `autoAccepted/accepted/pending/rejected`。

**依赖**：关键词状态接口、TASK-P1-07。

## 八、P2 任务：正式知识与图谱质量提升

### TASK-P2-00 正式构建前业务语义过滤

**目标**：在正式知识构建前，把快速加工得到的关键词从“抽取候选”过滤为“可进入正式知识构建的业务主题”，避免把噪声词、过粗范围词、过细结构词、低价值偶现词直接送入模型并污染正式知识图谱。

**架构定位**：

```text
关键词质量分析图谱
  -> 业务语义过滤
  -> 关键词准入集合
  -> 正式知识 Schema 最小闭环
  -> 知识校验融合
  -> 正式知识图谱
```

该阶段不是重新抽取关键词，也不是直接生成知识点，而是正式构建的准入门。`training_c7c7e7c29baf4716` 这类快速加工任务产出的关键词只能作为候选集合，必须经过业务语义过滤后，才能进入 `formal_knowledge`。

**输入**：

- 关键词图谱节点和上下文边；
- `keyword-chunk-index.json`；
- `formal-knowledge-input.json` 的候选调度范围；
- 文档标题、`semanticTitle`、章节路径、摘要和处理单元证据；
- 领域词典、别名、停用词、范围词和产品词规则；
- 用户审批状态。

**输出**：

- `quality/keyword-business-review.json`；
- 关键词业务准入状态；
- 正式构建关键词集合；
- 每个关键词的准入或排除原因；
- 图谱摘要中的业务过滤统计。

**核心判断维度**：

- 业务主题性：关键词是否表示一个可展开知识的数据库主题，而不是产品名、资料范围、文件命名词或普通描述词；
- 粒度合适性：过粗的 `YashanDB/数据库/功能` 和过细的文件结构、编号、技术 ID 均不进入正式构建；
- 证据覆盖度：至少具备标题、章节、正文或词典中的可回查证据，且不是单次偶然出现；
- 构建价值：该关键词是否值得消耗模型调用生成正式知识，是否能形成稳定知识点；
- 领域边界：是否属于 YashanDB 数据库专业知识，而不是加工流程、文档格式或无关业务词；
- 审批约束：`rejected` 永不进入，`accepted/autoAccepted` 仍需通过业务准入规则，`pending` 默认不进入正式构建。

**状态模型**：

```text
candidate
  -> businessAccepted
  -> businessRejected
  -> needsReview
```

- `businessAccepted`：可进入正式知识构建；
- `businessRejected`：不进入正式知识构建，必须记录原因；
- `needsReview`：规则无法判断，需要用户确认或补充领域规则。

**业务过滤策略**：

- 规则优先：技术 ID、完整文件名、产品范围词、文档命名词、低价值结构词直接排除；
- 词典增强：命中稳定领域词典的关键词提升置信度，但词典不是唯一准入条件；
- 证据聚合：按 canonical keyword 汇总标题、章节、正文和 chunk 证据后再判断；
- 模型可选：只对 `needsReview` 且影响正式构建范围的关键词调用轻量评审模型；
- 人工可控：前端允许用户将 `needsReview` 或误判项调整为准入/排除。

**建议排除原因枚举**：

- `scope_word`：产品或知识集范围词；
- `file_naming_noise`：文件命名噪声；
- `technical_identifier`：技术追溯 ID；
- `too_broad`：粒度过粗；
- `too_narrow`：粒度过细；
- `weak_evidence`：证据不足；
- `off_domain`：不属于数据库领域；
- `duplicate_alias`：已作为别名归并到其他 canonical 节点；
- `user_rejected`：用户审批排除。

**API 契约建议**：

- `POST /api/datasets/{datasetId}/keywords/business-review`
  - 同步执行业务语义过滤；
  - 输出 `keyword-business-review.json`；
  - 不调用正式知识抽取模型。

- `POST /api/datasets/{datasetId}/keywords/{keywordId}/business-status`
  - 更新单个关键词业务准入状态；
  - 记录操作者、时间和原因；
  - 不重建关键词图谱。

- `POST /api/datasets/{datasetId}/formal-knowledge/tasks`
  - 只读取 `approvalStatus in {accepted, autoAccepted}` 且 `businessStatus=businessAccepted` 的关键词；
  - 不允许 `businessRejected/needsReview/pending/rejected` 进入正式构建。

**前端预期**：

- 质量分析页在“构建正式知识”按钮前增加业务过滤执行中和完成后的可见反馈；
- 图谱分析区提供“过滤后 / 过滤前 / 发生变化 / 业务准入 / 待业务确认 / 业务注入”视图切换，支持对比关键词集合变化；
- 关键词详情展示业务状态、业务注入标识、准入原因、排除原因、证据覆盖度和关联 chunk 数；
- 图谱节点通过颜色、边框、标签和悬浮提示透出“业务注入关键词”和“待业务确认”；
- 提供“准入正式构建 / 排除 / 待人工确认”操作，并在提交前允许填写人工批注；
- 正式构建按钮显示本次将进入构建的关键词数和 chunk 数；
- 全部中文展示，不显示内部技术 ID 作为主标签。

**验收标准**：

- 快速加工关键词不会直接进入正式知识构建；
- `rejected/businessRejected/needsReview` 关键词不进入 `formal-knowledge-input.json`；
- 每个被排除关键词都有可审计原因；
- 同一 canonical keyword 只评审一次，别名不重复评审；
- 业务过滤不重跑关键词抽取模型；
- 至少用 `training_c7c7e7c29baf4716` 的产物验证：正式构建前可看到准入关键词集合、排除集合和原因分布。

**依赖**：TASK-P1-08、关键词图谱、领域规则配置。

### TASK-P2-01 正式知识 Schema 最小闭环

**目标**：定义并稳定正式知识候选的最小字段，确保每条知识可追溯。

**输入**：

- 已确认关键词；
- 关联处理单元；
- 模型知识抽取结果。

**输出**：

- `extraction-results/formal-knowledge-input.json`；
- `extraction-results/knowledge-candidates.jsonl`。

**验收标准**：

- 每条知识包含 `state=agent_resolved/kind=knowledge_point/keywordIds/keywordContext/chunkId/evidenceText/sourceResourceId/sourcePath/confidence`；
- `keywordIds/keywordContext` 去重并按 `keywordId` 稳定排序；
- 证据文本能在处理单元原文中回查；
- 无证据知识不能进入候选结果；
- 输出不包含完整 Prompt 或 API Key。

**依赖**：TASK-P0-02、TASK-P2-00。

### TASK-P2-02 实体与关系抽取拆分

**目标**：将知识点、实体、关系分阶段处理，降低单个 Agent 的复杂度。

**输入**：

- 已校验知识点；
- 处理单元证据；
- 已确认关键词上下文。

**输出**：

- `entities.jsonl`；
- `relations.jsonl`；
- 分阶段质量问题。

**验收标准**：

- 知识点、实体、关系不再由一个 Agent 一次性完成全部复杂任务；
- 实体必须带来源证据；
- 关系必须能解析到已有端点；
- 跨 chunk 关系作为后续增强，不阻塞最小正式知识链路。

**依赖**：TASK-P2-01。

### TASK-P2-03 知识校验与拒绝原因落盘

**目标**：把候选知识转换为可信最终知识，并记录所有拒绝原因。

**输入**：

- `knowledge-candidates.jsonl`；
- `entities.jsonl`；
- `relations.jsonl`；
- 处理单元原文。

**输出**：

- `final-results/knowledge.jsonl`；
- `final-results/rejected.jsonl`；
- `quality/issues.json`。

**验收标准**：

- 无证据、偏移错误、关系端点缺失不能进入最终图谱；
- 被拒绝项包含候选 ID、原因、严重度和来源；
- 最终知识为空但有有效关键词时，按降级策略处理；
- `keyword_analysis` 模式不生成 `FINAL_KNOWLEDGE_EMPTY`。

**依赖**：TASK-P2-01、TASK-P2-02。

### TASK-P2-04 正式知识图谱与关键词图谱分视图

**目标**：避免质量分析默认图谱和正式知识图谱混展。

**输入**：

- 关键词图谱；
- 最终知识；
- 图谱摘要。

**输出**：

- 关键词图谱视图；
- 正式知识图谱视图；
- `graph/summary.json`。

**验收标准**：

- 质量分析默认展示关键词图谱；
- 正式知识图谱只在正式构建完成后展示；
- `KnowledgePoint/entity/relation` 不出现在默认关键词总览中；
- 两种视图都有中文指标和来源追溯。

**依赖**：TASK-P2-03。

### TASK-P2-05 图数据库适配预留

**目标**：为后续 Neo4j/NebulaGraph 接入预留稳定写入接口，但本阶段不强制上线图数据库。

**输入**：

- canonical 图谱节点；
- 证据边；
- 最终知识和实体关系。

**输出**：

- 图数据库写入接口设计；
- JSON 图谱审计产物。

**验收标准**：

- JSON 图谱继续作为审计产物；
- 定义 Neo4j/NebulaGraph 写入接口和节点/边映射；
- 图数据库写入失败不影响本地候选数据集生成；
- 后续 GraphRAG 查询可以基于该接口扩展。

**依赖**：TASK-P2-04。

## 九、验收与回归

### 9.1 文档验收

- 新增文档编号为 `19`；
- 不覆盖现有 `00-18` 文档；
- 每个任务包含目标、输入、输出、验收标准和依赖；
- 明确 embedding 聚类、清洗、低成本初筛属于资源预处理阶段；
- 明确当前不做完整 GraphRAG 问答和体系化文档生成闭环。

### 9.2 功能回归

```bash
cd scripts/pingcode/web/backend
python3 -m unittest discover -s tests -v
```

```bash
cd scripts/pingcode/web/frontend
npm run build
```

### 9.3 真实 API 验证

```bash
curl -sS http://127.0.0.1:8001/api/health
curl -sS http://127.0.0.1:3500/pingcode-api/api/health
```

### 9.4 后续实现验收建议

- `keyword_analysis`：标题明确批次模型调用数为 0，无 `KEYWORD_EXTRACTION_DEGRADED`；
- `formal_knowledge`：每个模型调用可追踪，取消可终态化，失败写入质量问题；
- 资源预处理：生成 embedding、cluster、preselection 三类报告；
- 图谱：无技术 ID、完整文件名、命名噪声进入关键词；
- 正式知识：每条知识都有 `keywordIds/chunkId/evidenceText/sourceResourceId`。

## 十、默认假设

- 本文档只指导后续开发，不修改现有功能行为；
- 当前平台目标是资料加工和知识图谱生成；
- embedding 聚类、清洗和低成本初筛统一归入资源预处理阶段；
- 正式知识构建可靠性是 P0，必须先于图数据库、问答和体系化生成；
- 完整 GraphRAG 问答、体系化文档生成和生成文档反哺知识库属于后续阶段。
