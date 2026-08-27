# PingCode 知识提取与构建测试设计

> 版本：v1.1
> 日期：2026-08-07
> 覆盖设计：`docs/12-PingCode知识提取步骤详细设计.md`、`docs/14-PingCode知识校验与合并步骤详细设计.md`、`docs/15-PingCode图谱与数据集生成步骤详细设计.md`

## 一、测试目标

本测试设计用于验证知识加工流水线中“关键词质量分析默认档”和“正式知识构建档”的功能正确性、数据契约一致性和真实性能表现。

验证顺序固定为：先功能测试，再性能测试。功能测试未通过时，不进入性能结论判定，只记录已执行的耗时和失败原因。

核心目标：

1. `keyword_analysis` 默认档只生成关键词图谱，不生成 `KnowledgePoint`、实体和关系主图；
2. 关键词来自清洗后的文档名称、正文主要描述内容和数据库领域术语，不把完整标题、技术 ID 和命名噪声提升为关键词；
3. canonical 归并、别名命中、关键词审批和 `keyword-chunk-index.json` 保持一致；
4. `formal_knowledge` 只基于已确认关键词关联的处理单元构建正式知识，并保留 `keywordIds` 与证据；
5. 质量问题能够区分默认档的预期空最终知识、关键词降级、模型异常和正式知识构建失败；
6. 使用真实后端、真实网关和真实模型调用验证全链路耗时、模型调用数、降级数和产物质量。

## 二、测试范围

### 2.1 范围内

- 训练任务创建接口：`POST /api/training/tasks`；
- 默认任务模式：`keyword_analysis`；
- 显式正式知识构建：`POST /api/datasets/{datasetId}/formal-knowledge/tasks`；
- 关键词图谱节点、边、摘要和邻域接口；
- 关键词审批状态更新接口；
- 质量报告和训练任务质量问题接口；
- 运行产物：`keyword-candidates.jsonl`、`keyword-chunk-index.json`、`run-report.json`、`quality/issues.json`、图谱 `nodes.json/edges.json`；
- 后端单元与集成回归；
- `8001` 后端 API 与 `3500/pingcode-api` 网关真实验证；
- 真实模型调用下的关键词默认档、缓存复用和正式知识构建性能。

### 2.2 范围外

- 模型供应商自身服务质量优化；
- 已删除历史数据集的原地修复；
- 前端视觉还原和浏览器兼容性专项；
- 非 YashanDB 数据库领域资料的泛化效果评测；
- API Key、访问凭证或其他敏感配置记录。

## 三、测试数据

首选真实回归批次：

```text
batchId: batch_b46713c20d9c4ada
名称: 本地素材上传-20260728-201702
预期特征: 标题明确、词典命中、词典缺项、多别名、多文档归并、历史超时场景
```

该批次应覆盖以下关键词主题：

```text
备份恢复、REDO、数据缓存区、事务、LOB、Replication、持久化、列式存储、数据字典、Sequence、Tablespace、Index
```

如果首选批次不存在，应先通过本地上传接口创建等价 YashanDB 文档批次，再执行同一用例。历史任务产物只能作为问题定位参考，不能作为本次验收结论。

## 四、功能测试用例

| 用例 | 验证点 | 操作 | 期望结果 |
|---|---|---|---|
| TC-F01 | 默认任务模式 | 创建训练任务时省略 `mode` | 任务按 `keyword_analysis` 执行，摘要 `knowledgeBuildMode=keyword_analysis` |
| TC-F02 | 明确标题主题确定性抽取 | 使用包含 `备份恢复`、`REDO`、`数据缓存区`、`事务`、`LOB`、`Replication`、`持久化`、`列式存储` 的批次 | 生成 `deterministic_title_topic` 或等价确定性候选，标题明确文档不调用模型 |
| TC-F03 | 领域词典归并 | 使用 `数据字典`、`Sequence`、`Index`、`Tablespace` 等词典或别名 | 使用稳定 `termId` 或 canonical 归并，别名进入 `aliases/matchedAliases` |
| TC-F04 | 模型只处理不确定文档 | 构造标题不明确或正文存在补充主题的处理单元 | 仅不确定处理单元调用 `keyword-extraction`；格式异常或超时只产生可追踪 warning，不阻断已有关键词 |
| TC-F05 | 同义词与大小写归并 | 分别使用 `Index/index/索引`、`Sequence/SEQUENCE/序列` 查询 | 命中同一 canonical 关键词及其全部上下文边 |
| TC-F06 | 噪声过滤 | 检查关键词节点名称、别名和统计 | `dataset_*`、`file_*`、`chunk_*`、完整文件名、`YashanDB`、`DSI`、`内幕文档` 不进入关键词集合 |
| TC-F07 | 索引一致性 | 对比 `keyword-chunk-index.json` 与图谱节点 `chunkIds` | `keywordId -> chunkIds` 与关键词节点一致，反向 `chunkId -> keywordIds` 可回查 |
| TC-F08 | 关键词审批 | 调用状态接口将至少 1 个关键词设为 `rejected`，再刷新图谱摘要 | 审批状态持久化，`keywordApprovalState` 计数更新 |
| TC-F09 | 正式知识构建输入边界 | 先执行业务语义过滤，再基于准入关键词触发正式知识构建 | `rejected/pending/businessRejected/needsReview` 关键词不进入调度；同一 chunk 多个准入关键词只调度一次；写出 `formal-knowledge-input.json`；结果保留去重排序后的 `keywordIds` 和 chunk 证据 |
| TC-F09A | 业务语义过滤展示 | 调用 `business-review` 并刷新质量分析页 | 生成 `keyword-business-review.json`；图谱摘要包含 `keywordBusinessReviewState`；前端展示业务准入、业务排除、待业务确认和过滤原因 |
| TC-F09B | 实体/关系阶段状态 | 读取质量报告中的 `entityRelationStage` | 未启动时展示为未启动；后续实体/关系显式阶段可更新 candidate、validated 和 issue 计数 |
| TC-F10 | 质量问题语义 | 检查 `keyword_analysis` 和 `formal_knowledge` 的质量问题 | `keyword_analysis` 不因 `FINAL_KNOWLEDGE_EMPTY` 阻断；正式知识为空时按设计降级或阻断并给出原因 |
| TC-F11 | 默认规则任务免模型预检 | 令模型网关的配置、状态、测试和调用接口均返回 HTTP 502，再以省略 `mode` 的请求执行主页预检 | 预检不访问模型接口，`totalModelCalls=0`、`modelTestPassed=null`，且只要批次就绪并存在可处理资料则 `canStart=true` |
| TC-F12 | 默认规则任务免模型启动 | 在 TC-F11 的假网关条件下调用 `POST /api/training/tasks` 并轮询终态 | 任务创建、运行并终态化，产物只有规则关键词候选和中文质量提示；模型成功、失败、跳过及调用审计均为 0 |
| TC-F13 | 正式知识模型门禁保持 | 未执行有效模型测试时创建 `formal_knowledge` 任务 | 请求被模型测试门禁拒绝；执行有效模型测试后才允许启动，HTTP 502 等模型故障保留可归因错误 |

## 五、性能测试用例

| 用例 | 验证点 | 操作 | 记录指标 | 验收阈值 |
|---|---|---|---|---|
| TC-P01 | 关键词分析全链路性能 | 对 `batch_b46713c20d9c4ada` 创建新的 `keyword_analysis` 任务 | 总耗时、阶段耗时、模型调用成功/失败/跳过数、token、关键词数、节点/边数、`KEYWORD_EXTRACTION_DEGRADED` 数 | 无 `KEYWORD_EXTRACTION_DEGRADED`；标题明确文档模型调用数为 0 |
| TC-P02 | 二次执行缓存 | 对同一批次再次执行 `keyword_analysis` | 缓存命中数、失效数、模型调用数、总耗时 | 内容和规则未变化时关键词模型调用数接近 0，结果与首次执行一致 |
| TC-P03 | 正式知识构建性能 | 在关键词图谱上确认/排除关键词并完成业务过滤后触发 `formal_knowledge` | 总耗时、模型成功/失败数、正式知识数、准入关键词数、过滤关键词数、token | 任务完成，或失败时给出可归因质量问题；不得处理 rejected/businessRejected/needsReview 关键词关联 chunk |
| TC-P04 | 失败注入 | 使用不确定标题或模拟模型返回异常 | 局部修复次数、降级 warning、失败 chunk ID | 只修复受影响处理单元，不重跑整批；确定性候选仍保留 |
| TC-P05 | 连续稳定性 | 连续执行 3 次 `keyword_analysis` | 每次耗时、模型调用数、降级数、关键词集合差异 | 无重复 `KEYWORD_EXTRACTION_DEGRADED` 回归；关键词集合稳定 |

## 六、执行命令

后端回归：

```bash
cd scripts/pingcode/web/backend
python3 -m unittest discover -s tests -v
```

真实 API 健康检查：

```bash
curl -sS http://127.0.0.1:8001/api/health
curl -sS http://127.0.0.1:3500/pingcode-api/api/health
```

创建关键词分析任务：

```bash
curl -sS -X POST http://127.0.0.1:8001/api/training/tasks \
  -H 'Content-Type: application/json' \
  -d '{"batchId":"batch_b46713c20d9c4ada","mode":"keyword_analysis"}'
```

轮询任务：

```bash
curl -sS http://127.0.0.1:8001/api/training/tasks/{taskId}
curl -sS http://127.0.0.1:8001/api/training/tasks/{taskId}/quality-issues
```

读取数据集与图谱：

```bash
curl -sS 'http://127.0.0.1:8001/api/datasets?batchId=batch_b46713c20d9c4ada'
curl -sS 'http://127.0.0.1:8001/api/quality/reports/{datasetId}'
curl -sS 'http://127.0.0.1:8001/api/datasets/{datasetId}/graph/summary'
curl -sS 'http://127.0.0.1:8001/api/datasets/{datasetId}/graph/nodes?limit=1000'
curl -sS 'http://127.0.0.1:8001/api/datasets/{datasetId}/graph/edges?limit=1000'
```

更新关键词审批状态：

```bash
curl -sS -X POST http://127.0.0.1:8001/api/datasets/{datasetId}/keywords/{keywordId}/status \
  -H 'Content-Type: application/json' \
  -d '{"status":"rejected"}'
```

触发正式知识构建：

```bash
curl -sS -X POST http://127.0.0.1:8001/api/datasets/{datasetId}/formal-knowledge/tasks
```

网关路径验证：

```bash
curl -sS http://127.0.0.1:3500/pingcode-api/api/health
curl -sS 'http://127.0.0.1:3500/pingcode-api/api/datasets/{datasetId}/graph/summary'
```

## 七、验收阈值

功能验收：

1. `keyword_analysis` 图谱主节点只包含 `Keyword` 和 `ProcessingUnit`，不得出现 `KnowledgePoint`、实体或关系主节点；
2. 关键词节点包含 `keywordId`、`canonicalName`、`aliases`、`matchedAliases`、`confidence`、`evidenceSources`、`sourceResourceIds`、`chunkIds`、`occurrences`、`approvalStatus`；
3. `keyword-chunk-index.json` 与图谱节点 `chunkIds` 双向一致；
4. 关键词审批状态可保存并被正式知识构建过滤；
5. 正式知识结果必须包含 `keywordIds` 和证据引用；
6. 质量问题不能把默认档不生成最终知识误判为阻断问题。

性能验收：

1. `batch_b46713c20d9c4ada` 关键词默认档无 `KEYWORD_EXTRACTION_DEGRADED`；
2. 标题明确且确定性证据充分的处理单元模型调用数为 0；
3. 二次执行相同内容时关键词候选缓存命中，模型调用数接近 0；
4. 正式知识构建只处理已确认关键词覆盖的最小处理单元集合；
5. 正式知识构建允许真实模型调用，但失败必须有 taskId、stage、modelCallId 或处理单元 ID 可追踪。

## 八、测试报告模板

```text
测试日期：
代码版本：
后端地址：
网关地址：
批次 ID：
关键词任务 ID：
关键词数据集 ID：
正式知识任务 ID：
正式知识数据集 ID：

功能测试结论：
- 通过：
- 失败：
- 阻塞：

性能测试结论：
- 关键词分析总耗时：
- 正式知识构建总耗时：
- 模型调用成功/失败/跳过：
- 缓存命中/未命中：
- KEYWORD_EXTRACTION_DEGRADED：
- FINAL_KNOWLEDGE_EMPTY：
- 关键词数：
- 正式知识数：
- 图谱节点/边：

主要证据路径：
- 

遗留风险：
- 
```

## 九、本次执行记录

本节用于记录每次真实验证的结果。执行时应以新创建任务和新数据集作为验收依据，不使用历史任务产物替代。

### 2026-07-30 执行记录

基础信息：

```text
后端地址：http://127.0.0.1:8001
网关地址：http://127.0.0.1:3500/pingcode-api
批次 ID：batch_b46713c20d9c4ada
模型连接测试：通过，provider=alibaba，model=qwen3.7-plus，latencyMs=5923，schemaPassed=true
关键词任务 ID：training_aae3e752e1d244ca
关键词数据集 ID：dataset_4091451d25294cdf
正式知识任务 ID：training_f2bf3ef8e5cd4af3
```

功能验证结论：

| 用例 | 结果 | 证据 |
|---|---|---|
| TC-F01 | 阻塞 | 在正式知识任务取消中时，省略 `mode` 再创建任务返回 `BATCH_NOT_READY`；需清理 active task 后单独复测默认值路径 |
| TC-F02 | 通过 | `keyword-cache-summary.json` 显示 `deterministicSkippedChunks=14`、`modelScheduledChunks=0`；候选包含 `备份恢复`、`REDO`、`数据缓存区`、`事务`、`LOB`、`Replication`、`持久化`、`列式存储` |
| TC-F03 | 通过 | `数据字典` 聚合 3 个处理单元，`Sequence` 聚合 2 个处理单元；候选保留 `termId` 和别名 |
| TC-F04 | 通过 | 本批次无不确定文档，模型未被调度；质量问题中无 `KEYWORD_EXTRACTION_DEGRADED` |
| TC-F05 | 通过 | `Index/索引/index` 均返回同一条上下文边；`Sequence/SEQUENCE/序列` 均返回同两条上下文边 |
| TC-F06 | 通过 | 12 个关键词节点中无 `dataset_*`、`file_*`、`chunk_*`、完整文件名、`YashanDB`、`DSI`、`内幕文档` |
| TC-F07 | 通过 | `keyword-chunk-index.json` 中 12 个 `keywordId`、14 个 `chunkId` 与图谱节点 `chunkIds` 双向一致 |
| TC-F08 | 通过 | 将 `keyword:38362671f8747e285a72` 更新为 `rejected` 后，`keywordApprovalState.rejected=1` |
| TC-F09 | 部分通过 | 正式知识任务输入范围为 13 个处理单元，已过滤被拒绝的 `Index` 关联处理单元；任务未产出正式知识结果 |
| TC-F10 | 部分通过 | `keyword_analysis` 无 `FINAL_KNOWLEDGE_EMPTY`，仅 6 个 metadata info；`formal_knowledge` 卡在知识提取阶段，未形成终态质量问题 |

关键词图谱摘要：

```text
graphSchemaVersion=4
metadataRuleSetHash=sha256:d7a758e6e99c420284c7986c5d12d1e89dc76f7160e3ce77275c75337285422d
knowledgeBuildMode=keyword_analysis
graphSource=model_keyword
nodeTypes={Keyword: 12, ProcessingUnit: 14}
edgeTypes={CONTEXT_MATCHES_CHUNK: 15}
keywordApprovalState={autoAccepted: 11, accepted: 0, pending: 0, rejected: 1}
qualityPassed=true
publishable=true
```

性能验证结论：

| 用例 | 结果 | 证据 |
|---|---|---|
| TC-P01 | 通过 | `training_aae3e752e1d244ca` 全链路约 2.7 秒；资料预处理 2152ms，关键词抽取 143ms，图谱生成 136ms；模型调用 `succeeded=0/failed=0/skipped=14` |
| TC-P02 | 阻塞 | 正式知识任务取消未完成，批次状态保持 `processing`，二次关键词任务返回 `BATCH_NOT_READY` |
| TC-P03 | 不通过 | `training_f2bf3ef8e5cd4af3` 超过 5 分钟仍停留在 `knowledge_extraction current=0/total=13`；无模型结果文件，无正式知识产物 |
| TC-P04 | 未执行 | 本次未做失败注入；已有单元测试覆盖局部修复 |
| TC-P05 | 阻塞 | 因批次 activeTaskIds 包含取消中的正式任务，无法连续创建 3 次关键词分析任务 |

正式知识构建问题记录：

- 输入边界有效：正式任务计划处理 13 个处理单元，说明 `rejected` 的 `Index` 处理单元已被排除。
- 性能与可观测性不达标：任务从 `2026-07-30T02:35:23Z` 进入 Workflow Agent 后，超过 5 分钟没有 `modelCallId`、单 chunk 进度或模型结果文件。
- 取消不及时：`2026-07-30T02:40:17Z` 调用取消后，任务仍处于 `cancelling`，批次状态保持 `processing`，阻塞后续任务创建。
- 环境观察：系统存在多个历史 `uvicorn app.main:app` 进程，但 `ss` 显示真正监听 8001 的进程只有 PID `2738692`；建议清理残留进程并重启后端后复测。

自动化与构建：

```text
后端回归：python3 -m unittest discover -s tests -v
结果：168 passed, 21 skipped

前端构建：npm run build
结果：通过；存在既有 chunk size warning

真实 API：
GET /api/health：通过
GET /pingcode-api/api/health：通过
GET /pingcode-api/api/datasets/{datasetId}/graph/summary：通过
```

主要证据路径：

```text
scripts/pingcode/runtime/web/training-runs/training_aae3e752e1d244ca/
scripts/pingcode/runtime/web/datasets/dataset_4091451d25294cdf/
scripts/pingcode/runtime/web/training-runs/training_f2bf3ef8e5cd4af3/events.jsonl
```

## 十、P0-01 正式知识构建可靠性专项

该专项用于验收 `TASK-P0-01 正式知识构建任务超时与取消边界修复`。

后端单测：

| 用例 | 验证点 | 期望结果 |
|---|---|---|
| TC-P0-01-01 | 正式知识构建进入知识提取后无进度 | 不允许长期停留 `current=0`；达到无进度保护阈值后进入 `failed` 或写入可归因质量问题 |
| TC-P0-01-02 | 取消正式知识构建 | 取消请求后 30 秒内进入 `cancelled` 或可解释 `failed`，批次 `activeTaskIds=[]` |
| TC-P0-01-03 | 模型调用事件 | 每次正式知识模型调用都有 `model_call.started` 和 `model_call.completed/failed`，且包含 `modelCallId` |
| TC-P0-01-04 | 单处理单元超时 | 超时处理单元写入 `KNOWLEDGE_EXTRACTION_TIMEOUT`，其他处理单元继续处理 |
| TC-P0-01-05 | batch activeTask 清理 | timeout、cancel、partial failure 三类终态后，批次不再长期 `processing` |

产物断言：

- `events.jsonl` 包含 `modelCallId/taskId/stageRunId/agentTaskId/chunkId`；
- `model-results/knowledge-extraction-batches.jsonl` 记录每个 batch 的成功、失败、分类错误码、耗时和模型调用 ID；
- `quality/extraction-issues.json` 中失败项必须包含 `severity/taskId/stageRunId/agentTaskId/chunkId/modelCallId/technicalError/durationMs`；
- 正常处理单元的 `knowledge-candidates.jsonl` 不应被单个失败项覆盖；
- 取消或全局失败场景不得生成看起来可发布的完整候选数据集。

### 10.1 P1-08/P2-01 TDD 验证补充

| 用例 | 验证点 | 期望结果 |
|---|---|---|
| TC-P1-08-01 | `_formal_keyword_context_by_chunk` 读取物化索引 | 每个 chunk 的 `keywordContext` 按 `keywordId` 去重排序，并排除 `rejected` |
| TC-P1-08-02 | 正式构建输入计划 | `extraction-results/formal-knowledge-input.json` 包含 `sourceDatasetId/acceptedKeywordIds/rejectedKeywordIds/scheduledChunkIds/chunkKeywordMap/filteredKeywordCount/deduplicatedChunkCount` |
| TC-P2-00-01 | 业务语义过滤产物 | `business-review` 生成 `quality/keyword-business-review.json`，并写回关键词节点 `businessStatus/businessReasonCodes/businessEvidenceCoverage` |
| TC-P2-00-02 | 正式构建双门控 | `_formal_keyword_context_by_chunk` 只返回 `approvalStatus in {autoAccepted, accepted}` 且 `businessStatus=businessAccepted` 的关键词上下文 |
| TC-P2-00-03 | 前端中间过程展示 | 质量分析页展示业务准入数、业务排除数、待业务确认数、实体/关系阶段状态和中文过滤原因 |
| TC-P2-01-01 | 正式知识候选最小 Schema | 候选包含 `state=agent_resolved`、`kind=knowledge_point`、`keywordIds`、`keywordContext`、证据和来源字段 |
| TC-P2-01-02 | 第一版输出边界 | `formal_knowledge` 第一版只把 Workflow Agent 的 `knowledgePoints` 写入候选，不生成实体或关系 |
| TC-P2-02-01 | 实体/关系阶段骨架 | 质量报告包含 `entityRelationStage`，未启动时为 `pending`，不改变 P2-01 只生成知识点的边界 |

本地验证记录（2026-07-30）：

- `ExtractionTool` 已验证会读取 `knowledge-point-extraction` Skill 默认 `maxTokens/timeoutMs/maxRetries`，并在每次正式知识模型调用上报 `modelCallId` 和 `model_call.started/completed/failed/cancelled`。
- 已验证正式知识输入先按 Skill `input.schema.json` 校验，超过批大小上限等坏输入不会进入模型网关。
- 已验证取消异常不会被包装成普通批次失败，而是向上传递给 `TrainingService` 终态化链路；模型请求阻塞期间通过轮询取消检查退出任务线程。
- 已验证正式知识失败分类覆盖 `KNOWLEDGE_EXTRACTION_TIMEOUT`、`KNOWLEDGE_EXTRACTION_SCHEMA_INVALID`、`KNOWLEDGE_EXTRACTION_EMPTY_RESULT`、`KNOWLEDGE_EXTRACTION_FAILED`，并补齐 batch audit 与质量问题追溯字段。
- 已验证后端启动恢复之外，训练任务查询和创建任务前会清理不属于当前进程活跃任务的僵尸 `activeTaskIds`；当前进程内正在执行的任务不会被误判中断。

## 十一、P1 资源预处理与关键词默认档专项

### 11.1 P1-04/P1-05 embedding 与聚类验证

- 功能用例：缓存命中、配置版本失效、provider 不可用降级、稳定 `clusterId`、embedding 失败不阻断 `keyword_analysis`。
- 产物检查：`metadata/embedding-index.jsonl`、`quality/embedding-issues.json`、`metadata/cluster-report.json`、`quality/cluster-issues.json`。
- 安全检查：产物和缓存不得包含 API Key。
- 真实链路：创建 `keyword_analysis` 任务后，确认 embedding/cluster 产物存在；如外部 embedding 不可用，任务仍能完成并生成关键词图谱。

大规模聚类性能修复实施前测试方案：

| 用例 | 验收断言 |
| --- | --- |
| 小样本精确兼容 | `N <= exactMaxEmbeddings` 时与旧全量算法的成员集合、`clusterId`、相似度结果一致 |
| 输入顺序确定性 | embedding/document 顺序反转或随机重排，候选、成员、报告审计字段一致（时间戳除外） |
| 大样本有界候选 | 候选余弦调用次数不超过 `N * k`，不得出现桶内全组合枚举 |
| 阈值安全 | 每条实际 union 边均经过精确余弦且达到 threshold，不允许 LSH 签名直接连边 |
| 召回质量 | 固定合成数据与抽样真实向量对比全量基线，记录 pair recall、component recall 和拆分簇数；未达到评审阈值不得上线 |
| 取消传播 | load、签名、桶处理、候选比较和 finalize 阶段均可取消，取消后不发布 cluster report |
| 公开进度 | `metadata_construction.cluster.progress` 阶段和计数单调，最长 1 秒或固定工作量有更新 |
| 性能基准 | 13,015 x 64 维等价数据候选比较不超过 832,960，峰值额外内存符合 `O(N*T+k)`，墙钟时间记录到任务卡 |
| 降级与兼容 | 禁用配置、无向量和向量损坏保持既有 warning；无新依赖；公共 API 不变 |

本地验证记录（2026-07-31）：

- `PYTHONPATH=scripts/pingcode/web/backend python3 -m unittest scripts/pingcode/web/backend/tests/test_embedding_services.py -v`：4 个用例通过，覆盖缓存命中、profile version 失效、provider 不可用 warning 降级和稳定 `clusterId`。
- `PYTHONPATH=scripts/pingcode/web/backend python3 -m unittest scripts/pingcode/web/backend/tests/test_material_preparation.py -v`：30 个用例通过，覆盖元数据阶段写出 embedding/cluster 产物。
- `PYTHONPATH=scripts/pingcode/web/backend python3 -m unittest scripts/pingcode/web/backend/tests/test_training_service.py -v`：57 个用例通过。
- `PYTHONPATH=scripts/pingcode/web/backend python3 -m unittest discover -s scripts/pingcode/web/backend/tests -v`：187 个用例通过，21 个真实 API/浏览器环境用例按配置跳过。

真实 API 验证记录（2026-07-31）：

- 后端 `8001 /api/health` 和网关 `3500 /pingcode-api/api/health` 均返回 `{"status":"ok","version":"0.1.0"}`。
- 模型真实连接测试通过，Provider 为 `alibaba/qwen3.7-plus`，`schemaPassed=true`。
- 关键词分析任务 `training_88fd89a479384971` 基于 `batch_b46713c20d9c4ada` 完成，模型调用统计为 `succeeded=0/failed=0/skipped=14`。
- 新增产物均已落盘：`metadata/embedding-index.jsonl` 14 条、`quality/embedding-issues.json` 0 条、`metadata/cluster-report.json` 中 `embeddingCount=14/clusterCount=12/singletonCount=11/warningCount=0`、`quality/cluster-issues.json` 0 条。
- `keyword-cache-summary.json` 中 `deterministicSkippedChunks=14`、`modelScheduledChunks=0`；embedding/cluster 不阻断关键词默认档。

该专项用于验收 `TASK-P1-01/TASK-P1-02/TASK-P1-03/TASK-P1-06` 第一批主干。

功能用例：

| 用例 | 验证点 | 期望结果 |
|---|---|---|
| TC-P1-01-01 | 资料预处理资源级产物 | `metadata/source-resources.jsonl`、`metadata/source-assets.jsonl`、`metadata/ingestion-report.json` 与既有 documents/chunks 同时落盘 |
| TC-P1-02-01 | 标题噪声审计 | documents 和 chunk contexts 包含 `titleNoiseRemoved/topicCandidates`，噪声来源来自 `title-cleaning.yaml` |
| TC-P1-03-01 | 初筛四态 | `preselection-report.json` 仅使用 `deterministic_ready/model_required/human_review/skip` |
| TC-P1-06-01 | 关键词默认档读取初筛报告 | `deterministic_ready/human_review/skip` 不调用模型，只有 `model_required` 进入关键词模型 |
| TC-P1-06-02 | 大批关键词默认档进度 | `current` 按 chunk 单调增长且等于 `succeeded+failed+skipped`；每 1 秒或 50 个资源更新，终点强制发布 |
| TC-P1-06-03 | 关键词默认档取消 | 第一条资源完成后取消，下一条资源不进入确定性提取，任务按取消语义终态化 |
| TC-P1-06-04 | 观测增强结果回归 | 同一输入在增加进度与取消检查前后，候选 JSONL、缓存摘要和质量问题内容一致 |

验收阈值：

- 新增资源级产物不得破坏 `metadata/source-documents.jsonl`、`metadata/chunks.jsonl`、`metadata/structure-blocks.jsonl`；
- 标题噪声、产品范围词和完整文件名不得重新进入关键词图谱；
- 标题明确且有证据的文档模型调用数应为 0；
- 初筛报告缺失的历史运行必须回退旧逻辑，不能阻断关键词分析。
- 已执行：`PYTHONPATH=scripts/pingcode/web/backend python3 -m unittest scripts/pingcode/web/backend/tests/test_material_preparation.py -v`，结果 30 个用例通过。
- 已执行：`PYTHONPATH=scripts/pingcode/web/backend python3 -m unittest scripts/pingcode/web/backend/tests/test_training_service.py -v`，结果 57 个用例通过。
- 已执行：`PYTHONPATH=scripts/pingcode/web/backend python3 -m unittest discover -s scripts/pingcode/web/backend/tests -v`，结果 183 个用例通过，21 个真实 API/浏览器环境用例按配置跳过。
- 已重启 8001 后端，`/api/health` 与 `3500/pingcode-api/api/health` 返回 `{"status":"ok","version":"0.1.0"}`。

### 2026-07-30 P1 第一批真实 API 验证

验证对象为 `training_41fed7125a9e465a`，来源批次为 `batch_b46713c20d9c4ada`，产出数据集为 `dataset_5165fe5ba9f24052`。模型真实连接测试通过，Provider 为 `alibaba/qwen3.7-plus`，结构化输出校验通过。

| 用例 | 实际证据 | 结果 |
|---|---|---|
| TC-P1-01-01 资源级产物 | `metadata/source-resources.jsonl` 14 条、`metadata/source-assets.jsonl` 54 条、`metadata/ingestion-report.json` 中 `resourceCount=14`、`processingUnitCount=14`、`issueCount=0` | 通过 |
| TC-P1-02-01 标题噪声审计 | `metadata/documents.jsonl` 和 `metadata/chunk-contexts.jsonl` 均包含 `semanticTitle/titleNoiseRemoved/topicCandidates`；图谱无完整文件名、无 `YashanDB/DSI/内幕文档` 噪声关键词 | 通过 |
| TC-P1-03-01 初筛报告 | `metadata/preselection-report.json` 14 条记录全部为 `deterministic_ready`，包含资源、处理单元、语义标题、原因、证据和来源方法 | 通过；`model_required/human_review/skip` 已由单测覆盖，真实混合批次待补 |
| TC-P1-06-01 关键词默认档读取初筛 | `keyword-cache-summary.json` 中 `deterministicSkippedChunks=14`、`modelScheduledChunks=0`；`keyword-extraction-batches.jsonl` 为空；任务模型调用 `succeeded=0/failed=0/skipped=14` | 通过 |
| 图谱污染回归 | 关键词节点为 `LOB/REDO/Replication/数据字典/Sequence/列式存储/备份恢复/Tablespace/持久化/事务/数据缓存区/Index`；技术 ID、完整文件名和命名噪声关键词均为 0 | 通过 |
| 别名邻域回归 | `Index/索引`、`SEQUENCE/序列` 命中同一组关系，`数据字典` 可返回上下文关系 | 通过 |

专项结论：`TASK-P1-01/TASK-P1-02/TASK-P1-03/TASK-P1-06` 已完成真实关键词分析批次验证，可在项目总览中标记为“已验证”。剩余非阻断观察：本批真实材料全部进入 `deterministic_ready`，后续仍需构造混合批次补充 `model_required/human_review/skip` 的真实 API 分布验证。

### 2026-07-30 P0-01 真实 API 验证

验证对象为 `dataset_4091451d25294cdf`，来源批次为 `batch_b46713c20d9c4ada`。模型真实连接测试通过，Provider 为 `alibaba/qwen3.7-plus`，结构化输出校验通过。

| 用例 | 实际证据 | 结果 |
|---|---|---|
| TC-P0-01-01 模型调用可观测 | `training_7c867ce751364fbf` 和 `training_99ab8ad07837425f` 均在进入正式知识提取后产生 3 条 `model_call.started`；事件含 `modelCallId/resourceId/batchIndex/chunkIds/timeoutMs=60000` | 部分通过：事件可见，但主进度在调用完成前仍为 `0/13` |
| TC-P0-01-02 取消终态 | `training_7c867ce751364fbf` 从 `2026-07-30T04:08:36.398935Z` 的取消请求到 `2026-07-30T04:08:36.747053Z` 终态约 348ms；`training_99ab8ad07837425f` 约 242ms | 通过 |
| TC-P0-01-03 调用审计 | 两个任务的 `events.jsonl` 均有 `model_call.started` 和对应的 `model_call.cancelled`，模型调用 ID 可逐条回查；代码层已补齐单 chunk 顶层 `agentTaskId/chunkId/modelCallId` 传播 | 部分通过：历史真实任务仍是旧事件，需重新跑真实 formal task 验证新事件 |
| TC-P0-01-04 单处理单元超时 | 单测已覆盖网关 timeout 分类为 `KNOWLEDGE_EXTRACTION_TIMEOUT`，并保留 `modelCallId/technicalError/durationMs` | 代码层通过；真实超时注入未验证 |
| TC-P0-01-05 批次解锁 | 两个取消任务结束后，`batch_b46713c20d9c4ada` 返回 `state=downloaded`、`activeTaskIds=[]`；单测覆盖查询和创建任务前僵尸 activeTask 恢复 | 取消场景和代码层恢复通过；真实 timeout/局部失败场景未验证 |
| TC-P0-01-07 取消产物边界 | 取消任务仅保留准备处理和事件产物，不生成 `knowledge-candidates.jsonl`、`knowledge-extraction-batches.jsonl`、`run-report.json` 或最终图谱 | 部分通过：取消边界通过，失败/超时落盘未验证 |

真实证据路径：

- `scripts/pingcode/runtime/web/training-runs/training_7c867ce751364fbf/events.jsonl`
- `scripts/pingcode/runtime/web/training-runs/training_99ab8ad07837425f/events.jsonl`

专项结论：`TASK-P0-01` 为**部分完成，代码层最小闭环已补齐**。取消终态、模型调用可追溯、Skill 参数透传和取消后批次解锁已完成真实验证；失败分类、批次审计字段、质量问题字段和僵尸 activeTask 恢复已由单测覆盖。仍需重新执行真实 formal task，验证新事件顶层字段、真实 timeout/局部失败落盘和其他 chunk 继续处理后，才能标记为“已验证/完成”。

## 十一、TASK-P0-02 Workflow Agent 最小化专项

| 用例 | 验证点 | 期望结果 |
|---|---|---|
| TC-P0-02-01 | 单工作项输入 | 任意 Agent 工作项的 `chunks` 长度恒为 1，输入 Schema 拒绝多 chunk 请求 |
| TC-P0-02-02 | 输出收敛 | Skill 输出仅含 `knowledgePoints`，Agent 不生成关键词、实体、关系或 `needs_enrichment` |
| TC-P0-02-03 | 局部失败 | 一个 chunk 模型失败时生成中文 `KNOWLEDGE_EXTRACTION_FAILED` 质量问题，其他 chunk 的候选和审计仍落盘 |
| TC-P0-02-04 | 追溯字段 | 成功候选包含 `keywordIds/chunkId/resourceId/sourceResourceId/sourcePath/evidenceText/confidence`；审计和事件包含 `taskId/stageRunId/agentTaskId/chunkId/modelCallId` |
| TC-P0-02-05 | 进度终态 | 每个 chunk 在成功或失败后恰好计入一次进度，最终 `current == total` |

针对性执行命令：

```bash
PYTHONPATH=scripts/pingcode/web/backend python3 -m unittest scripts/pingcode/web/backend/tests/test_knowledge_extraction_tools.py -v
PYTHONPATH=scripts/pingcode/web/backend python3 -m unittest scripts/pingcode/web/backend/tests/test_training_service.py -v
```

## 十二、方案 C 并发快照与损坏隔离测试设计

> 适用版本：方案 C v1，更新日期：2026-08-07。被测接口和 Schema 以 [六步骤流水线 16 节](./08-pingcode-processing-six-step-pipeline-design.md#十六方案-c不可变快照与并发协调契约) 为准。本节定义自动化、故障注入、性能和真实 API 验收，不把尚未执行的项目写成已通过。

### 12.1 契约测试夹具与伪代码

统一夹具必须构造可解析的 `ArtifactSnapshotRef`、`artifact-manifest/v1`、`artifact-commit/v1`、`artifact-latest/v1`、`single-flight/v1` 和 `artifact-read-issue/v1`，并验证 JSON round-trip 后字段不丢失。

```text
fixture committed_snapshot(stage, records):
  create unique staging on same filesystem
  stream write records while calculating sha256/bytes/count
  write manifest.json
  write commit.json last
  atomic rename staging -> runs/runId
  return ArtifactSnapshotRef

concurrent_case(workers, operation):
  barrier.wait()                 # 放大竞争窗口
  run operation in threads/processes
  collect owner/follower/CAS result, lock timings and filesystem snapshot
  validate no reader observed staging or partial JSON
```

测试配置必须加载 `scripts/pingcode/processing/artifact-integrity.yaml`，断言 `schemaVersion=artifact-integrity-config/v1`、`maxRecordRatio=0.001`、`maxRecordCount=10`；业务测试不得自行复制另一套阈值。

### 12.2 正确性与故障注入矩阵

| ID | 场景 | 操作 | 预期 |
|---|---|---|---|
| SC-01 | 同批次两个启动请求 | 两线程同时调用训练 start | admission 原子检查并登记，只产生一个有效所有者/幂等任务 |
| SC-02 | 相同 executionHash | 两线程和两进程同时准备 | 只有一个计算 owner、一个 `runs/<runId>`；其余复用同一 snapshotRef |
| SC-03 | 不同 inputHash | 并发准备两个输入版本 | 使用独立 staging/run，可并行计算，无共享文件覆盖 |
| SC-04 | 固定上游引用 | 元数据开始后更新 preparation latest | 元数据仍读取传入 prepRef，输出 inputSnapshots 指向原 run |
| SC-05 | latest 同 generation | 两进程同时 CAS | 仅一个成功，JSON 始终完整，generation 单调 |
| SC-06 | 旧任务晚完成 | 新输入先提交 latest，旧输入后提交 | 旧任务 CAS 未命中但快照仍可读，不覆盖新 latest |
| SC-07 | staging 中止 | 写一半时终止进程 | `runs/<runId>` 不存在，reader 不可见半成品，恢复器可识别遗留 staging |
| SC-08 | commit 前/后故障 | 分别在 manifest、commit、rename、latest 前注入异常 | 只有完成 commit+rename 的 run 可读；latest 失败不损坏 committed run |
| SC-09 | 唯一临时文件 | 多进程更新 state/latest | 临时文件名不同，目标只出现完整旧值或完整新值，无截断 JSON |
| SC-10 | single-flight owner 失败 | owner 抛异常，多个 follower 等待 | follower 收到结构化失败；新请求可递增 attempt 竞争，无永久 running |
| SC-11 | 单条坏 JSONL | 在明确行边界注入一条坏记录 | 写一条中文质量问题，其余记录继续，结果 `completed_with_warnings` |
| SC-12 | 坏记录超阈值 | 分别超过 count 或 ratio | 任一超过即 `ArtifactIntegrityError`，不发布下游快照 |
| SC-13 | 整体不可验证 | 损坏 commit/manifest/hash、删必需文件、制造中间截断 | 阶段阻断且包含路径、快照、偏移、预期/实际哈希和 traceId |
| SC-14 | 隔离后引用失效 | 坏行被其他记录引用 | 不允许隔离继续，整体完整性失败 |
| SC-15 | 错误分类 | 分别注入模型、JSONL、I/O、转换、Schema、未知异常 | 只有 `ModelGatewayError` 显示模型服务错误；其余使用自身中文分类 |
| SC-16 | legacy 兼容 | 读取无 snapshotRef 的历史报告 | 只按显式旧路径兼容并标记 legacy；新报告缺 ref 不回退 latest |
| SC-17 | 多读取者 | 100 个线程读取同一 committed ref | 全部内容一致，不获取写锁，不出现解析失败 |

坏行质量问题还必须断言：`artifactPath/snapshotId/lineNumber/byteOffset/fileSize/fileMtimeNs/expectedHash/actualHash/recordHash/errorClass/traceId` 齐全；只保存脱敏首尾摘要和哈希，不保存完整正文、绝对路径或凭据。

### 12.3 锁顺序与性能验收

通过协调器观测钩子记录 `lockKey/acquiredAt/releasedAt/waitMs/heldMs`，不记录业务正文。断言：

- 不存在任何嵌套锁事件；顺序符合 admission -> single-flight -> 锁外计算 -> single-flight 完成 -> latest CAS；
- 扫描、转换、分块、模型调用、全文件 hash 和引用校验期间没有协调锁；
- admission 和 latest CAS 的 P95 持锁时间低于 20ms；
- 相同 executionHash 的并发请求实际计算次数为 1；
- 大批次单任务相对无并发基线耗时回退不超过 5%；
- 记录 CPU 时间、墙钟时间、峰值 RSS、读写字节、锁等待和 staging/正式目录数量，以区分计算、I/O 与协调开销。

性能用例至少覆盖小/中/大三档 fixture，并在同机空载基线下重复 5 次，报告中位数和 P95；阈值仅作为测试门禁，不进入业务判断代码。

### 12.4 真实后端 API 验收

使用隔离的数据根目录启动真实 FastAPI 后端，不复用或修改用户批次。验收顺序：

1. 通过真实 API 创建/导入包含合法记录和可控失败记录的批次；
2. 并发发起同批次知识加工请求，核对任务、single-flight 和 run 数量；
3. 在步骤一提交后更新发现指针，确认步骤二仍使用任务报告中的 prepRef；
4. 注入一条可界定坏 JSONL，核对中文质量问题和 `completed_with_warnings`；
5. 注入 commit/hash/Schema 破坏，核对阶段阻断和非模型错误摘要；
6. 查询任务事件、运行报告和 latest，确认 traceId、snapshotRef、generation 和 CAS 结果可追踪；
7. 记录 API 请求、响应状态、脱敏响应摘要及对应产物路径，测试结束后清理隔离数据。

只有自动化矩阵、真实 API 和性能基线均取得证据后，方案 C 才能标记“真实链路验证完成”；仅代码或单元测试通过应分别标记“代码完成”或“静态验证完成”。
