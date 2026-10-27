# 知识中心-文档生产-Agent架构详细设计

> 版本：1.0.0；日期：2026-10-26
> 状态：分阶段交付。既有单次生成与独立质量服务已实现；已补充阶段契约、外置阶段 Schema、稳定产物摘要、失败任务显式重试、租约过期后的受控恢复、恢复 claim 和可配置周期扫描；离线盲评工具按第 8.1 节实施，固定评测集、人工裁判和目标环境仍待验收。
> 业务主设计：[文档生产详细设计](./知识中心-文档生产-详细设计文档.md)
> 可编辑图：[Agent流程架构图.drawio](./知识中心-文档生产-Agent流程架构图.drawio)

图文件可用 diagrams.net / draw.io 打开，包含两页：“01-完整生产流程”展示来源确认、冻结、Agent 阶段、作者采用、质量检查和审核发布；“02-复用与权限边界”展示现有代码复用、阶段适配器、平台配置、存储及工具权限。图示为目标架构，已实现与待实现边界见第11节。

## 原文来源与编辑模式评审补充（2026-10-26）

原文不是普通参考资料。它是作者正在编辑的目标平台文档正文，必须独立于本次选择的引用来源建模。

### 原文基线规则

1. 首次创建/打开目标平台文档时，若文档通过知识资产映射到 GitLab 仓库文件，读取该文件的 GitLab 快照作为原始 Markdown。快照至少记录 handbookId、documentId、outlineVersionId、branch、repository/project 标识、file path、commit/blob 标识（连接器可得时）、contentDigest 与 fetchedAt。服务端验证当前会话对手册和映射的读取权限。
2. 若未配置 GitLab 仓库、没有文档映射或目标文件不存在，正文显示空白 Markdown，不得回退到模板正文。模板只作为生成约束，不是文档原文。
3. 已有共享草稿时，继续编辑当前 revision；首次打开时的平台文档原文快照作为该草稿来源基线保留。作者尚未保存的编辑作为 `workingCopy`，关联该来源快照，不覆盖原快照。
4. AI 任务冻结 `baseOrigin`、`baseSnapshotId`、`baseDigest`、GitLab 定位/修订信息、`workingCopyDigest`、共享草稿 `revisionId/editVersion`（存在时）、`editRange`。平台端从已授权映射与快照解析来源，校验客户端正文摘要和修订号；不可得仓库 commit/blob 时如实记录内容摘要和获取时间，不伪造 Git 版本。
5. GitLab 基线更新与当前草稿或工作副本不一致时，不静默重基或覆盖。提示作者比较新旧基线，并显式选择继续原快照或重新载入后再生成。来源不可读或权限撤销时阻止新任务，保留现存草稿。

### 当前格式与原始 Markdown 双模式

编辑器提供可见且互斥的模式切换：`当前格式` 为 Vditor 所见即所得编辑视图；`原始 Markdown` 为 Markdown 源文编辑视图。两种模式共享同一正文状态，切换前将当前模式内容同步并完成格式往返校验，不丢失光标、选择和未保存编辑；失败则保留当前模式并提示。切换不触发保存或 revision 创建。AI 范围偏移统一针对规范化 Markdown 的 UTF-16 半开区间，模式切换后重新映射选区，无法可靠映射时要求作者重新确认范围。

两种模式均可编辑、可选范围；其变更均标记为同一 workingCopy。保存后正文的唯一业务事实仍为服务端规范化 Markdown，HTML 仅是受控阅读/编辑快照。无 GitLab 映射时两种模式都从空白内容开始。快捷键、工具栏和无障碍标签应明确当前模式。

### 当前状态与剩余差距

当前 `currentHandbookMarkdown` 按本地草稿、共享 revision、GitLab 映射正文的顺序读取，无映射时使用空正文；模板只作为生成约束。AI Job 请求冻结原文快照，服务端按当前会话重新解析手册映射并读取授权 GitLab 文件，核对正文摘要及可得的 commit/blob。常规验证读取映射分支当前版本，发现摘要或修订变化即返回 `AI_ORIGIN_BASELINE_CHANGED`；作者可选择固定旧 commit，或载入当前分支新正文。固定旧 commit 时服务端仍按该 commit 重新读取并校验摘要；载入新基线会替换未保存工作副本、重置候选并要求重新确认处理范围。页面并排展示打开时的 GitLab 基线与分支最新正文。写作页提供互斥的可视化编辑与 Markdown 模式，两者同步同一正文状态。相关 HTTP 与浏览器覆盖见第 11.1 节和功能实现报告。

## 1. 架构决策与解决的问题

采用“平台编排、专职 Agent 执行、作者控制采用”的架构。平台负责权限、版本、冻结输入、状态与事务；Agent 只返回结构化阶段产物；服务端验证产物；作者显式采用；独立质量 Agent 验证指定文档修订。

通用 Agent 的开放工具，以及旧工作流以知识点为中心的输入，不会自动满足文档生产的来源确认、编辑范围、并发修订和人工采用契约。阶段适配器统一输入输出，平台工具代理收敛权限，业务事务保留在原服务，因此可以复用能力而不继承不合适的控制权。

本设计不预设 Codex 桌面/IDE 等于后台 API。通用 Agent 是否具备可部署接口、企业授权及合适的数据策略需要具体核验；符合准入条件后，作为某个阶段的执行器接入。

不变量：一个生产任务只有一个业务编排器；Agent 不持有草稿保存、采用、审核批准和发布权限；模型自报引用不构成证据；阶段执行成功不等于质量通过；不记录隐藏思维链。

## 2. 全流程与交互

1. 作者选择文档、操作、编辑范围、模板、要求、模型与资料。首次原文基线取该平台文档映射的 GitLab 文件快照；无仓库或无映射时为空白。操作沿用 generate/polish/continue/rewrite/update，范围为规范化 Markdown 的 UTF-16 半开区间。
2. 作者在当前格式和原始 Markdown 两种同步编辑模式间切换；API 校验身份、文档可见性、编辑权限、原文基线快照、草稿 revision/editVersion 及幂等键；作者预览并确认参考资料来源。
3. 编排器冻结原文来源定位及内容摘要、GitLab 快照/修订、工作副本摘要、共享草稿 revision、范围、大纲/模板、模型配置选择、参考资料快照、Skill 与规则版本。
4. 规划 Agent 输出章节目标、要求映射和待验证点。
5. 资料 Agent 从本次确认的快照整理可引用证据、位置与摘要，不自行扩大来源。
6. 写作 Agent 根据冻结输入、计划、模板、Skill 和证据生成候选片段及来源声明。
7. 服务端校验 schema、体积、Unicode 边界、范围、来源 ID 和证据位置，拼接范围外原文。可配置内容审核 Agent 检查结构、模板、表达、来源支持。
8. 作者查看差异、来源、问题和运行元信息，可编辑、放弃或显式采用。采用事务校验原文、草稿版本和候选摘要；冲突返回409并保留候选。
9. 独立质量 Agent 对指定候选或已保存版本提取用例、只读执行、比较并生成报告。送审使用当前已保存修订的报告。
10. 作者按既有流程送审，由有权限人员审核和发布。

图中 Agent 返回产物，所有状态迁移与写入由编排器完成。生成候选不保存草稿；质量报告通过不自动采用、送审或发布。候选预检允许先做 SQL 检查，正式报告必须绑定修订与摘要。

## 3. 职责、产物与复用

| 组件 | 职责与产物 | 复用位置 | 适配与限制 |
|---|---|---|---|
| 生产 API | 会话、文档作用域、权限 | routes/knowledge-center.js、handbook production service | 不信任 Agent 或请求体中的身份声明 |
| 编排器 | 冻结、幂等、租约、阶段轨迹、候选与采用事务 | production-ai-service.js、AggregateStore、saveDraftInState | 保持唯一事实源；当前受控阶段编排不等于独立多 Agent 调度 |
| Planner | WritingPlan：章节目标、要求映射、验证点 | planner-agent.js、LLMClient | 从旧 knowledgePoint 输入适配到文档/操作/范围，不扩权 |
| Evidence | EvidenceSet：来源ID、位置、片段摘要 | retriever-agent.js、production-ai-sources.js、MCPClient | 限定确认快照；不让模型指定凭证、服务器或任意工具 |
| Writer | CandidateFragment：正文片段、Provenance | generator-agent.js、LLMClient、Skill/Profile | 只返回范围内产物，无草稿、文件、Git写权限 |
| Content Reviewer | ContentReview：逐项状态、位置问题和处理建议 | validator-agent.js、production-content-quality.js | 模型意见不证明事实；规则检查、模型检查与未执行分开 |
| Quality Agent | QualityReport：用例、结果、环境及gate | production-quality-service.js、四个质量Skill、yashandb-quality-adapter.js | 独立报告，只读SQL服务端门禁，绑定修订和环境 |
| 来源追溯 | 引用、归纳、推理、人工修改区间 | production-ai-provenance.js | 位置匹配不等于语义支持已证明 |
| 人工治理 | 作者采用、审核、发布 | 共享草稿、审核发布模块 | Agent 不替代人类决定 |

### 3.1 旧工作流复用边界

通过 Adapter 转换冻结上下文和旧 Agent 输入，再验证旧输出。BaseAgent 的模型、Token和耗时可用于运行观测，不能替代来源、修订和人工采用记录。

旧 workflow-engine/StepExecutor 按固定 planner→retriever→generator→validator 转换输入，依赖 knowledgePoint 等旧契约；状态、强制继续、取消和持久化不天然等于生产 Job。首期复用各 Agent 能力，不让旧 workflow 成为第二编排器。若未来复用调度器，应先统一状态归属、事务、取消和恢复语义。旧“强制继续”不得绕过质量门禁。

## 4. 版本化阶段契约

接口：run(stageId, StageEnvelope, deadline, abortSignal) → StageResult。

| 字段 | 含义与可信来源 |
|---|---|
| contractVersion | 阶段契约版本，由服务端冻结 |
| task | jobId、contextKey、operation；服务端生成 |
| document | handbookId、documentId、outlineVersionId、originType、baseSnapshotId、repository/project、branch、path、commit/blob、baseDigest、workingCopyDigest、draftRevisionId/editVersion、editRange；首次内容和GitLab修订不可得时明示缺失 |
| frozen | 大纲摘要、模板版本、脱敏模型选择、规则版本 |
| sources | 已确认 sourceId、locator、contentDigest、fetchedAt；正文从服务端快照解析 |
| skills | skillId、version、contentDigest及受控指令快照 |
| artifact | 阶段类型与结构化产物：WritingPlan/EvidenceSet/CandidateFragment/ContentReview |
| trace | stageId、attempt、开始/结束时间、模型标识、摘要、受控错误码 |

目标架构为每个阶段定义独立 JSON Schema，检查必需字段、区间、体积、数组及调用次数。当前已将四个阶段的结构约束固化到 `config/knowledge-center/production-ai-schemas.json`，由 `production-ai-schema-registry.js` 加载并执行受限 Draft 2020-12 子集校验，再由 `production-ai-contracts.js` 执行范围、来源集合和候选摘要等业务语义校验；模型不能覆盖身份、版本、范围和来源集合。所有正文位置统一 UTF-16 半开区间，检查 surrogate pair 边界。Writer 返回片段，平台计算完整候选和摘要。完整通用 JSON Schema 引擎尚未引入，当前 Schema 子集覆盖生产阶段所需字段。

Provenance 只引用本次快照：direct_quote 需逐字对应；source_summary 需有效证据位置且保留 unverified；model_inference 不伪装引用。无效声明按现有协议拒绝或保守降级，不补造证据。结构与位置合法不能证明语义结论被来源支持，需审稿/事实核验和人工核对。

不保存隐藏思维链；只保存输入输出摘要、必要产物、版本、运行状态和可操作理由。恢复使用原契约版本；不兼容时标记中断并要求重新发起，不静默更换语义。

### 阶段执行伪代码

```text
目标态启动时扫描持久化 Job：
  对 lease 已过期的 queued/running Job 原子标记 interrupted，并闭合未完成 run
  仅当 Job.contractVersion、阶段 inputDigest、成功 artifact.outputDigest 均可验证时，
    追加 writer/reviewer 的新 attempt 并派发恢复；planner/evidence 仅标记 skipped(reason=verified_artifact_reuse)
  否则保持 interrupted，等待作者显式重试或重新创建

执行阶段：
  envelope = 服务端从冻结 Job 构造(stageId, contractVersion, task, document, frozen, sources, skills, trace)
  校验 envelope 与 stage 输入 schema；执行 adapter；校验结果 schema、范围、体积、来源集合
  计算 canonical input/output digest；事务内持久化 artifact 与 stageRun
  若租约/状态已变化，拒收迟到结果
```

当前实现约束：阶段 artifact 写入独立的 `production-ai-artifacts` AggregateStore，Job 聚合只保留 artifactId、stageId、contractVersion 和 digest 引用；读取接口按引用校验后 hydration。持久化顺序为先写 artifact、再提交 Job 引用，崩溃时可能留下可清理的孤儿 artifact，但不会产生指向不存在产物的 Job 引用。默认生产服务启动时执行一次过期任务扫描并尝试接管，也支持受控 `/ai-jobs/:jobId/recover` 调用；配置 `KNOWLEDGE_PRODUCTION_RECOVERY_INTERVAL_MS`（或服务选项 `recoveryIntervalMs`）后，服务存续期间按周期调用同一幂等恢复入口，并在服务关闭/测试结束时调用 `stopRecoveryScheduler()`。恢复事务会写入带过期时间的 `recoveryClaim`，执行入口必须校验 claim；数据库模式由 revision 冲突保证单实例派发，文件模式仍要求单写入进程。运维可调用 `cleanupArtifacts`，按 Job 引用保留产物并按时间阈值删除孤儿产物。

阶段 Adapter 可由部署端按阶段独立配置 `KNOWLEDGE_PRODUCTION_PLANNER_URL`、`KNOWLEDGE_PRODUCTION_EVIDENCE_URL`、`KNOWLEDGE_PRODUCTION_WRITER_URL`、`KNOWLEDGE_PRODUCTION_REVIEWER_URL`；可选凭证分别放入对应的 `*_TOKEN` 环境变量，超时分别用 `*_TIMEOUT_MS` 配置（100–300000ms，默认120000ms）。运行时请求不能提供或更换 endpoint。服务端 POST `{ envelope, input }`，只接受 JSON 阶段产物；超时、不可达、非 2xx、非法 JSON 和超过 1MiB 的响应均按受控阶段错误失败，响应仍由阶段 Schema、业务契约、租约和迟到结果检查。此能力只提供部署接入点；实际 Agent 服务、授权、网络隔离及数据策略需在目标环境单独验收。显式注入的 `stageAdapters` 优先于环境配置，便于受控测试和宿主集成。

## 5. 工具与权限

- Planner、Writer、Reviewer 默认无shell、任意文件/网络、Git写、草稿或配置写权限。
- Evidence 通过服务端工具代理读取确认快照；模型不得决定 MCP服务器、凭证、tool name 或任意路径。来源正文及其指令均按不可信数据处理。
- Quality 只通过 YashanDBQualityAdapter.execute 使用隔离测试服务；SELECT/WITH/EXPLAIN 最终门禁在服务端执行，Agent 不持有 JDBC 凭据、DDL/DML权限。
- Actor 授权来自当前会话和服务端上下文，不由 Agent 输出决定。Agent 不提供采用、送审、审批、发布工具。
- 超时、重试、并发、输出、上下文与费用上限由平台规则管理。取消阻止后续阶段并使迟到结果失效；不保证 Provider 停止已发出请求计费。
- 日志和错误不返回密钥、Cookie、Ticket、私有全文或上游原始异常。

## 6. 状态与断点恢复

Task 沿用 queued/running/completed/failed/cancelled/interrupted。目标在同一 Job 增加 stageRuns[]，记录 stageRunId、stageId、status、attempt、contractVersion、input/outputDigest、起止时间、errorCode和摘要。阶段状态为 pending/running/succeeded/failed/skipped；只可跳过明确可选阶段且记录理由。stage成功不等于gate通过。

正常序列：冻结→Planner→Evidence→Writer→服务端验证→可选Reviewer→completed候选→作者采用→revision→独立Quality→既有审核发布。失败阶段不执行依赖阶段；每次重试保留旧失败并增加attempt。

现有生产服务已有租约、取消迟到结果丢弃及候选采用，并已记录 planner、evidence、writer、reviewer 四个最小阶段的 stageRuns 与阶段摘要。当前 Planner/Evidence 由服务端按请求和已确认来源构造并记录；Writer 仍是一次模型调用；Reviewer 只做结构化输出、引用及范围协议校验，不代表事实质量门禁。阶段 Schema 与契约模块会校验身份、范围、来源集合、体积、contractVersion 和 input/output digest；产物写入独立 artifact store，Job 以稳定 artifactId、契约版本和摘要引用。失败任务可通过同一 Job 的显式 retry 接口追加后续阶段 attempt；租约过期任务可通过启动时扫描、可配置周期扫描或 `/ai-jobs/:jobId/recover` 受控恢复，只有 Planner/Evidence 成功产物、契约版本和摘要全部匹配时才复用并跳过，Writer/Reviewer 追加新 attempt；恢复事务带 recoveryClaim，避免数据库模式下多实例重复派发。恢复不满足条件时保持 interrupted。仍未实现独立 Agent 服务和跨执行器盲评。不得将当前状态轨迹表述为完整多 Agent 编排。

## 7. 采用、质量与审核事务

completed 只表示候选生成，不代表正确、通过或保存。采用校验owner/context、原文及base revision/digest、editVersion、candidateDigest；冲突409保留内容。revision和Job adopted投影写在同一AggregateStore transaction，重复同候选/正文采用幂等回读。人工修改保留原候选摘要并标human_edit，失效来源需复核。

质量报告绑定revisionId、contentDigest、测试环境、数据库版本、Skill版本和报告ID。正文变更后旧报告只作历史。SQL能执行不等于有预期结果比对；未声明预期应注明局限。无库、禁止语句、错误结果分别如实记录。Quality Agent 不调用送审或发布。

## 8. 通用 Agent 接入与选择

通用 Agent 通过 WritingStageAdapter 作为某一阶段实现，不掌管编排。准入须核实：服务端API/商业授权、独立服务端身份、请求隔离、超时和迟到失效、工具allowlist、稳定版本、数据驻留/训练/日志策略、网络边界和费用上限。使用某个特定产品时另查官方当前接口，不能凭桌面操作能力推定。

采用固定中文技术文档集对照现有与通用Agent：事实正确率、引用支持率、无来源事实率、范围外修改、模板和格式遵循、失败恢复、人工编辑时间、端到端延迟、每篇成本。先隔离/影子运行，再有限作者试用。没有基准集和人工裁判不声称质量提升，也不按Star数决定选型。

### 8.1 离线盲评数据与工具契约

`tools/repository/production-ai-blind-eval.cjs` 提供离线 `prepare` 和 `summarize` 两个子命令，不加入生产 API，也不调用模型。输入评测集按 case 提供相同的 operation、要求、原文、范围、模板、已确认资料和可核验参考事实；每个 case 必须有两个不同执行器的候选记录。候选记录包含状态/失败码、正文、耗时、成本微美元、重试次数及是否恢复成功。不能取得的计量字段保持 `null`，不补零。

`prepare` 在每个 case 内独立随机分配 A/B，输出只含案例上下文、参考事实、候选正文和匿名状态的盲审表；执行器身份、耗时、成本、重试/恢复数据写入另一份受限的解盲文件。输入和产物路径均限定在仓库 `runtime/` 下，拒绝经符号链接越出该目录；新建输出目录权限为 0700，文件为 0600，已有输出拒绝覆盖。准备两份产物失败时清理本次创建的文件。工具不向盲审表注入执行器身份、失败码和计量字段；案例上下文和候选正文仍须由评测组织者检查并清除身份线索，文件权限不等于评测人员权限隔离。失败码只保留在受限解盲数据。评测者逐个候选记录事实准确性、引用支持、无来源事实数、范围外改动、模板/格式、是否有安全问题及人工修改分钟数，并对 A/B 给出偏好；每个案例至少两位不同评测者提交完整评分；工具只能验证不同 judgeId，人员独立性由组织者确认。输入显式提供 template 和 confirmedSources（允许空），范围不得拆分 Unicode 代理对，恢复结果仅接受布尔值或 null。

`summarize` 只有在全部 case 均有至少两位独立评测者、且 A/B 评分字段齐全时才生成摘要。摘要按解盲身份关联人工评分，并报告样本数、均值/中位数、偏好数、失败/恢复率、耗时与成本覆盖率及分布；不生成单一总分、不自动选择胜者、不把缺测作为零，也不把小样本的差异宣称为统计显著。评测输入、盲审表、受限解盲文件、人工评分和摘要均以评测集版本和运行 ID 追溯；judgeCount 表示全评测集去重后的评测者 ID 数量。固定技术案例集和领域裁判仍须由授权人员准备；没有这些数据时工具只能证明流程契约，不形成执行器质量结论。

## 9. 故障处理

| 故障 | 处理 |
|---|---|
| Agent超时、限流、断连 | 当前尝试失败，保留旧草稿/候选 |
| Planner schema非法 | 不调用下游Writer |
| 来源不可用/版本冲突 | 重新拉取或确认，不用未经确认资料 |
| 来源ID/位置非法 | 拒绝或保守标推理/待核验，不造引用 |
| Reviewer未执行 | not_executed，不显示通过 |
| 采用版本冲突 | 409并保留作者内容与候选 |
| 测试库缺失 | 逐项not_executed，gate不通过 |
| 中断/租约过期 | 标记 `interrupted`；服务启动时扫描，也可配置周期扫描或通过受控 HTTP `recover` 校验成功前置产物后恢复，恢复事务写入带过期时间的 `recoveryClaim`，或显式追加阶段重试 |

## 10. 实施顺序和可验证交付

| 阶段 | 实施内容 | 验收 |
|---|---|---|
| A | 阶段schema、范围/体积上限、错误码 | 有效/畸形/越权产物契约，不改草稿事务 |
| B | 现有Agent Adapter | 真实HTTP验证冻结字段和结构化输出，失败不调下游；当前已验证 Planner/Evidence/Reviewer 替换适配器接收服务端 envelope，越权 Planner 产物阻断后续阶段；部署环境可按阶段配置 HTTP Adapter URL、凭据和超时。隔离本地 HTTP 测试覆盖非 2xx、超时、非法 JSON、响应体积上限及非法配置；尚无目标环境独立 Agent 部署验收。Writer 默认使用现有受控模型调用 |
| C | stageRuns、持久化产物、阶段取消和恢复 | 已交付独立 artifact store、Job 引用校验、迟到响应丢弃、启动扫描、可配置周期扫描、恢复 claim 及显式恢复；孤儿清理提供受控入口 |
| D | 证据/候选/内容门禁 | 伪造引用、偏移越界、注入和范围外保持 |
| E | 质量版本闭环 | 授权测试环境真实执行、同修订报告回读；无库不通过 |
| F | 执行器对照 | 固定中文技术集盲评质量、编辑量、成本和安全评估 |

后端行为必须真实HTTP验证；Mock只证明契约。最低场景：401/403和跨文档隔离；冻结配置不随运行中修改漂移；畸形计划阻止下游；注入不扩权；范围外逐字保持；取消迟到结果拒收；并发采用409；revision/adopted原子一致；SQL报告准确绑定；Agent不能送审/发布；替换执行器遵守同契约。2026-10-27 增加真实 HTTP 阶段适配器验收，覆盖服务端冻结 envelope、阶段次序、候选完成以及 Planner 范围越权后 Evidence/Writer 不执行；本地 HTTP 故障用例覆盖超时、非 2xx、非法 JSON 和响应体积上限。测试使用隔离 Agent fixture，不构成真实外部 Agent 服务验收。

## 11. 优缺点与现状界限

优点：最大化复用现有模型、Agent、来源与质量能力；执行器替换不影响业务事务；权限、版本和证据由平台控制；作者控制采用；质量执行独立可追溯。

代价：Adapter/schema/状态和测试提高工程复杂度；多阶段调用增加延迟和费用；来源位置对应不能证明语义；断点恢复及通用运行时授权/数据策略仍需专项验证。

截至2026-10-27，仓库已有生产AI Job、模型/模板/Skill/参考来源冻结、候选范围保护与采用、来源元信息和独立YashanDB质量报告；内容检查接续ValidatorAgent。本轮补充阶段契约校验、artifactId/digest、独立 artifact store、Writer Adapter 接口、租约过期后的 HTTP 恢复和恢复前成功产物验证；失败/中断任务仍可通过 HTTP retry 追加 attempt，旧失败轨迹保留且同幂等键只派发一次。新增真实 HTTP 替换适配器契约用例，证明冻结 envelope、适配阶段次序和非法 Planner 产物阻断下游。该适配器仍为测试隔离实现，不等同于部署独立 Agent 服务。Planner/Evidence 默认仍是服务端阶段构造，Writer 默认仍为单次模型调用，Reviewer 仅执行结构化协议、引用和范围解析校验，不是完整 Agent，也不构成事实质量门禁；跨执行器比较尚无固定评测集及人工裁判结论。第 8.1 节离线盲评工具实现后，仅表示具备匿名整理与评分汇总流程，不代表执行器已完成质量对照或准入。前端按 GitLab 映射或空白基线初始化正文（不以模板填正文），显式提供富文本/Markdown 模式，并向 Job 传入 GitLab 定位及内容摘要；AI Job 创建接口现在会由服务端重新解析手册映射，使用当前会话授权读取 GitLab 文件，核对分支、映射路径、commit/blob（可得时）和服务端内容摘要后再冻结来源；摘要或版本漂移会阻止任务创建，未配置映射时仅允许标准空白基线。本设计不宣称已交付上述未实现能力，也不因角色分工而新增独立服务或第二数据库。

### 11.1 本次页面交互实现

针对模型、参考资料和 Skill 均为低频选择，比较三种布局：

| 方案 | 交互 | 优点 | 代价 |
| --- | --- | --- | --- |
| A. 主流程内联 | 设置区常驻在写作表单下方 | 一眼可见，无额外开合 | 低频配置持续占据首屏，与写作要求争夺注意力 |
| B. 折叠分组 | 每类配置用独立折叠区 | 可渐进展开，保留页面上下文 | 多个折叠状态分散，设置后难以确认整体选择 |
| C. 统一设置弹框（采用） | 主流程只显示设置摘要，点击后集中修改 | 低频内容集中管理，主流程保持聚焦，可一次核对设置 | 需要处理关闭、焦点恢复和窄屏滚动 |

主区域保留写作方式、写作要求和生成入口；模型、参考资料、模板信息及可选 Skill 统一放入“生成设置”弹框。弹框提供模型选择、资料拉取与显式勾选、按当前操作筛选 Skill、ESC/遮罩关闭和关闭后焦点恢复；主区域显示当前模型、资料数量和 Skill 数量摘要。请求字段 `modelSelection`、`confirmedSourceIds`、`selectedSkills` 保持原有契约不变。该实现改善操作密度，不代表后端已升级为完整多阶段编排。

浏览器验收通过真实 HTTP API 验证“技术文档续写”Skill 仅在 `continue` 操作下可选，默认不勾选；作者勾选后，创建任务的 `skillSnapshots` 持久化对应 Skill ID 与冻结版本。详见 `tests/e2e/agent-runner/production-writing.test.cjs`。

GitLab 基线漂移使用同源、按手册映射授权的文件读取接口加载最新分支正文；页面并排显示打开时基线与最新正文。作者可选择按旧 commit 继续，或载入新正文；载入新正文更新工作台并清除旧候选，处理范围重置为待确认。真实 HTTP 回归验证分支漂移被阻止及显式固定旧 commit 可继续；浏览器回归验证差异内容展示和载入后范围确认门禁。目标环境仍需验证真实 GitLab OAuth/服务账号权限与分支更新行为。


## 执行反馈与写作设置补充（2026-10-27）

本次按标准开发路径实施。主执行者承担设计、实现、真实 HTTP 与浏览器验证，不新增人工审批边界。

- 写作主区增加执行过程，保留最新任务的阶段状态、真实调用边界、安全输入输出摘要、阶段产物及只读生成预览。使用现有 Job GET 轮询，不暴露密钥、系统提示或模型隐藏推理；快照读取明确为本地读取，未配置审核明确显示未执行。
- Job 增加 executionPreview（text、updatedAt、stageRunId、truncated）。Writer 真实流式输出按配置节流持久化；只提取 JSON envelope 的 markdown 字符串，未完成 JSON 元信息不作为正文。完成校验前禁止采用。普通适配器只反馈阶段与最终输出，不伪造其内部工具活动。
- 阶段按 planner → evidence → writer → reviewer 顺序实际开始。预览写入检查任务运行状态、租约和 stageRunId；取消与重试后拒绝迟到输出。Writer 完成即记录成功及产物，审核过程仍可查看正文。流式支持 Chat Completions 与 Responses；不自动重发已有输出的模型请求。
- 租约过期自动恢复时，新 attempt 至少获得 1 秒执行租约，与恢复 claim 的最小窗口一致；正常创建任务仍采用配置租约。恢复阶段的提交继续检查状态、租约和阶段标识。
- 主区保留状态与取消入口，右侧写作辅助面板通过标题栏图标按钮展开/隐藏，aria-expanded/aria-controls 同步；收起不重置编辑、设置或任务。调整要求时自动展开。
- 生成设置增加单个可搜索下拉模板控件，复用公共 searchable-combobox。目录来自 templates API，过滤停用模板；沿用工作台有效模板，缺失/不可用时提示选择。payload 使用实际选中 templateId，后端冻结模板快照。恢复任务回填模板；历史停用模板仍可查看候选，但新生成须重新选择。
- 轮询临时失败保留任务标识并自动重连，避免重复创建；关闭页面清理轮询与控件。

伪代码：start → claim stage → record safe invocation → stream(onProgress) → throttle/check job+run → decode markdown preview → validate final → publish writer artifact → review → candidate。前端 poll → update keyed stage details（保持展开状态）+preview；toggle → hide/show aside；template change → payload.templateId。

验收：真实隔离 HTTP 验证运行中预览、取消迟到隔离及阶段时序；浏览器验证详情展开、面板切换、同框模板搜索与提交、断线恢复和窄屏；协议测试验证两类模型流。外部模型/远端适配器真实环境验收单独标注。
