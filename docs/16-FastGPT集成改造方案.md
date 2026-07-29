# FastGPT 集成改造方案

> 版本：v1.0  
> 日期：2026-07-27  
> 状态：架构设计与任务基线  
> 上位设计：`docs/08-pingcode-processing-six-step-pipeline-design.md`

## 源码基线

| 项目 | 取值 |
|---|---|
| 上游仓库 | `https://github.com/labring/FastGPT.git` |
| 上游分支 | `main` |
| 锁定 commit | `bebf217ba809ada3c7e1b19d8877d02b0ec769fe` |
| 本地目录 | `src/FastGPT` |
| 获取方式 | GitHub commit 源码归档，经 `ghfast.top` 传输镜像下载，不包含 `.git` 历史 |
| 归档 SHA-256 | `7bb7bc6d4a087eb21966dcfbcb3dd5b570e5baeffa2fa9306dcb83a749fcf755` |
| 纳入当前仓库 | 否，`src/FastGPT/` 已加入 `.gitignore` |

## 一、改造结论

FastGPT 不直接替换 PingCode 知识加工处理中心。本期采用混合架构：现有系统保留来源治理、资料预处理、YashanDB 领域知识提取、证据校验、质量问题和图谱产物；FastGPT 承担通用知识库、向量检索、重排、Agent/Flow 编排、问答应用和应用评测。

| 决策项 | 结论 | 逻辑说明 |
|---|---|---|
| 是否完全替换现有加工中心 | 否 | FastGPT 面向 RAG/Agent 应用，不能直接替代 PingCode 来源映射、原文偏移、领域 Schema 和确定性质量闸门 |
| 是否复用 FastGPT 文件解析 | POC 后决定 | FastGPT 支持常见文件格式，但必须与当前 Markdown 转换、结构块保真和来源映射做对照测试 |
| 是否复用 FastGPT 知识库 | 是 | 适合承接步骤五验证后的文本知识、QA 数据和检索元数据 |
| 是否复用 FastGPT Flow | 是，限定边界 | 可作为知识提取或语义补充的模型执行器，但结果仍须返回当前加工中心校验 |
| 最终知识事实源 | 当前加工中心 | `final-results/knowledge.jsonl`、质量问题、来源证据和版本记录保持唯一事实源 |
| 面向用户的检索与问答 | FastGPT 优先 | 复用混合检索、重排、工作流、应用 API、日志和评测能力 |

## 二、当前架构

| 层级 | 当前组件 | 主要职责 | 当前数据/接口 |
|---|---|---|---|
| 来源层 | PingCode、上传文件、参考资料 | 提供页面、附件、设计文档和本地资料 | PingCode API、上传 API、文件系统 |
| 素材平台前端 | `scripts/pingcode/web/frontend` | 批次、下载、加工流水线、质量分析和任务状态 | Vue、SSE、REST |
| 素材平台后端 | `scripts/pingcode/web/backend` | 来源下载、资料准备、六步加工、任务状态、日志和产物管理 | FastAPI、`JsonStore`、后台线程 |
| 模型执行层 | `agent-runner` | 模型配置、模型网关、文档生成 Agent 和 MCP 检索 | `/api/model-provider/*`、文档生成接口 |
| Skill/Prompt 层 | `scripts/pingcode/processing` | 发布知识提取、语义补充等 Skill、Prompt、Profile 和 Schema | 文件 Registry、版本 API |
| 知识加工层 | 六步骤流水线 | 预处理、元数据、提取、补充、校验、图谱和数据集生成 | `training-runs/<taskId>/` |
| 存储层 | 文件系统、JSON/JSONL | 保存任务快照、原文、候选、证据、图谱和质量问题 | `runtime/web`、`training-runs`、`datasets` |
| 消费层 | 文档生成器、质量页、MCP | 使用检索结果生成或校验技术文档 | MCP、REST、文件读取 |

## 三、目标架构与职责分配

| 目标层级 | 保留/新增组件 | 改造后职责 | 明确不负责 |
|---|---|---|---|
| 来源接入 | 当前 PingCode 素材平台 | 下载页面与附件、增量识别、来源映射、批次管理 | 不直接写 FastGPT 内部数据库 |
| 加工治理 | 当前六步骤流水线 | 结构化处理单元、元数据、领域提取、证据校验、质量问题、图谱 | 不承担终端问答 UI |
| FastGPT 适配层 | 新增 `FastGptAdapter` | 数据集映射、批量同步、删除传播、工作流调用、查询代理 | 不绕过步骤五校验 |
| FastGPT 平台 | `src/FastGPT` 部署实例 | 知识库、Embedding、混合检索、重排、Flow、Agent、应用评测 | 不作为来源证据和领域事实的唯一存储 |
| 模型接入 | FastGPT 模型配置与现有 Model Gateway 分阶段收敛 | POC 期允许并存，稳定后确定唯一模型配置入口 | 不长期维护两套密钥和模型参数 |
| 知识消费 | 文档生成器、内部问答、API/MCP | 优先查询 FastGPT，返回引用并回链当前来源记录 | 不直接修改加工中心最终知识 |
| 审计与监控 | 当前任务日志 + FastGPT 调用日志 | 通过统一 `traceId/taskId/datasetId` 串联加工和查询 | 不记录密钥、完整 Prompt 和无关全文 |

### 3.1 目标数据流

| 顺序 | 数据流 | 生产方 | 消费方 | 输出 |
|---|---|---|---|---|
| 1 | PingCode/上传资料进入批次 | 来源接入层 | 六步骤流水线 | 原始资源与来源元数据 |
| 2 | 资料预处理和元数据构建 | 当前加工中心 | 知识提取阶段 | 结构化处理单元、标题路径、偏移和摘要 |
| 3 | YashanDB 知识候选提取 | KnowledgeExtractionAgent | 语义补充/校验 | 候选、不确定项和提取问题 |
| 4 | 按需语义补充 | SemanticEnrichmentAgent，可由 FastGPT Flow 执行 | 知识校验阶段 | 局部语义解析结果 |
| 5 | 证据校验与合并 | 当前加工中心 | 图谱生成和同步适配层 | `final-results/knowledge.jsonl` |
| 6 | 数据集同步 | `FastGptAdapter` | FastGPT 知识库 | Collection、Chunk/QA、元数据和引用 URL |
| 7 | 检索和问答 | FastGPT | 文档生成器、内部用户、MCP | 检索片段、引用、重排分数和答案 |
| 8 | 反馈回流 | FastGPT 应用评测/用户反馈 | 当前质量与评测模块 | 固定问题集、错误样本和优化任务 |

## 四、FastGPT 适配接口

### 4.1 内部接口

| 接口 | 输入 | 输出 | 说明 |
|---|---|---|---|
| `GET /api/integrations/fastgpt/status` | 无 | 版本、连接、知识库和模型能力 | 不返回密钥 |
| `POST /api/integrations/fastgpt/datasets/sync` | `datasetId`、同步模式 | 同步任务快照 | 支持全量、增量和重建 |
| `GET /api/integrations/fastgpt/sync-tasks/{taskId}` | 同步任务 ID | 进度、失败项、重试信息 | 与现有任务事件模型对齐 |
| `POST /api/integrations/fastgpt/workflows/{workflowId}/run` | 受控 ContextEnvelope | 结构化 AgentResult | 仅供加工中心内部调用 |
| `POST /api/integrations/fastgpt/query` | query、filters、topK | 片段、引用和分数 | 面向文档生成器/MCP 的统一查询入口 |
| `DELETE /api/integrations/fastgpt/datasets/{datasetId}` | 本地数据集 ID | 删除任务 | 执行删除传播和审计 |

### 4.2 适配器契约

| 方法 | 主要参数 | 返回值 | 幂等键 |
|---|---|---|---|
| `ensure_collection` | 本地数据集、Schema 版本 | FastGPT collection 映射 | `datasetId + schemaVersion` |
| `upsert_chunks` | 已验证知识、来源元数据 | 成功、失败和远端 ID 映射 | `knowledgeId + contentHash + syncVersion` |
| `delete_chunks` | 删除或失效知识 ID | 删除结果 | `knowledgeId + deletionVersion` |
| `run_workflow` | workflowId、ContextEnvelope | 结构化输出和 usage | `agentTaskId + inputHash + workflowVersion` |
| `query` | query、metadata filters、topK | 命中、引用、分数 | 查询不做结果幂等，只记录 traceId |
| `health` | 无 | 连接、版本和依赖状态 | 不适用 |

### 4.3 同步伪代码

| 步骤 | 伪代码 | 失败处理 |
|---|---|---|
| 读取 | `load validated knowledge from final-results/knowledge.jsonl` | 文件或 Schema 无效则终止同步 |
| 映射 | `map local dataset to FastGPT collection` | 映射冲突进入人工配置，不新建重复库 |
| 差异 | `compare local contentHash with sync ledger` | 无变化跳过，变更进入 upsert，缺失进入 delete |
| 写入 | `upsert bounded batches with metadata and source URL` | 单批重试，失败项隔离，不回滚已成功批次 |
| 校验 | `sample remote records and run fixed retrieval queries` | 校验失败标记 `sync_degraded`，不发布新版本 |
| 提交 | `atomically update sync ledger and active version` | 只有校验通过才切换活动版本 |

## 五、主要痛点

| 编号 | 痛点 | 当前影响 | FastGPT 引入后的新风险 | 处理原则 |
|---|---|---|---|---|
| P-01 | 模型配置重复 | `agent-runner` 已维护模型配置 | FastGPT 再维护一套模型、密钥和超时 | POC 后确定唯一配置入口，密钥不跨系统复制日志 |
| P-02 | 文件解析能力重复 | 当前和 FastGPT 都能解析/分段 | 同一文件生成不同分块和引用 | 当前处理单元作为事实输入；FastGPT 原生解析只用于对照实验 |
| P-03 | 数据事实源不清 | 文件产物是当前事实源 | 用户可能直接修改 FastGPT chunk | FastGPT 修改只作为反馈，不反向覆盖最终知识 |
| P-04 | 证据链可能丢失 | 当前要求偏移和来源位置 | FastGPT 默认引用粒度可能只到 chunk | 元数据写入本地 knowledgeId、resourceId、chunkId 和来源 URL |
| P-05 | 领域 Schema 不一致 | 当前有实体/关系类型约束 | FastGPT 数据集不自动执行 YashanDB 类型校验 | 校验在同步前完成，FastGPT 不负责事实审批 |
| P-06 | 增量和删除传播复杂 | 当前按批次和文件生成产物 | 远端知识库可能残留过期 chunk | 建立 sync ledger、内容哈希和 tombstone |
| P-07 | 两套任务与日志 | 当前已有 SSE 和结构化事件 | FastGPT 有独立工作流日志 | 统一 traceId、taskId、workflowRunId 映射 |
| P-08 | 长任务取消不一致 | 当前任务支持协作式取消 | FastGPT 远端工作流可能继续运行 | 适配层实现超时、取消请求和迟到结果丢弃 |
| P-09 | 基础设施增加 | 当前主要是 Node/Python/文件系统 | FastGPT 引入独立服务及其数据库、向量能力 | Docker 隔离部署，明确容量、备份和升级窗口 |
| P-10 | 许可证边界 | 当前代码自主管理 | FastGPT 对同类多租户 SaaS 和品牌信息有限制 | 内部使用可行；对外产品化前完成法务确认 |
| P-11 | 质量指标不完整 | 节点数、调用数不等于知识正确性 | FastGPT 检索效果可能掩盖提取错误 | 建立标注集、固定问题集、引用正确率和回归门禁 |
| P-12 | 上游升级漂移 | 当前接口由本项目控制 | FastGPT API、数据结构和镜像可能变化 | 固定 commit/tag，通过适配层隔离升级 |

## 六、实施任务清单

| ID | 阶段 | 任务 | 优先级 | 依赖 | 验收标准 |
|---|---|---|---|---|---|
| FG-001 | 基线 | 将锁定 commit 的 FastGPT 源码快照放入 `src/FastGPT` | P0 | 无 | 路径、分支、commit、获取方式和许可证可核验 |
| FG-002 | 基线 | 梳理 FastGPT 部署依赖、配置和资源需求 | P0 | FG-001 | 输出可运行 Docker 配置和容量基线 |
| FG-003 | POC | 在隔离端口启动 FastGPT，配置现有文本/Embedding/重排模型 | P0 | FG-002 | 健康检查通过，不影响现有 3500/8001/4100 服务 |
| FG-004 | POC | 用同一批 YashanDB 文档对比两套解析和分段 | P0 | FG-003 | 输出标题、表格、代码、图片引用和来源保真对比表 |
| FG-005 | 契约 | 定义本地数据集、知识记录与 FastGPT collection/chunk 映射 | P0 | FG-004 | JSON Schema、字段字典和示例通过评审 |
| FG-006 | 适配层 | 实现 FastGPT 客户端、鉴权、超时、重试和错误归类 | P0 | FG-005 | 单元测试覆盖成功、认证、限流、超时和无效响应 |
| FG-007 | 同步 | 实现全量同步和远端 ID ledger | P0 | FG-006 | 一个候选数据集可重复同步且不产生重复记录 |
| FG-008 | 同步 | 实现增量更新、删除传播和失败项重试 | P1 | FG-007 | 修改/删除源文件后远端数据与本地活动版本一致 |
| FG-009 | 工作流 | 在 FastGPT 建立知识提取或语义补充 POC Flow | P1 | FG-003、FG-005 | 返回严格 JSON，缺证据结果被当前校验器拒绝 |
| FG-010 | 查询 | 实现统一查询代理和 metadata filters | P1 | FG-007 | 能按产品、版本、模块、来源和文档类型过滤 |
| FG-011 | 消费 | 文档生成器 Retriever 增加 FastGPT 后端 | P1 | FG-010 | 可配置切换 MCP/FastGPT，并保留引用信息 |
| FG-012 | 评测 | 建立固定问题集和双路检索对照 | P1 | FG-010 | 输出 Recall@K、MRR、引用正确率和无答案准确率 |
| FG-013 | 可观测 | 统一任务、同步、Flow 和查询 trace | P1 | FG-006 | 单个 trace 可关联本地任务与 FastGPT 调用 |
| FG-014 | 安全 | 完成密钥、网络、权限、日志脱敏和许可证检查 | P0 | FG-003 | 无公开管理端、无密钥回显、权限和许可证结论明确 |
| FG-015 | 发布 | 灰度启用 FastGPT 检索并保留回滚开关 | P1 | FG-008、FG-012、FG-014 | 灰度指标达标，关闭开关可立即恢复旧链路 |

## 七、后续需要优化和细化的内容

| 方向 | 需要细化的问题 | 建议产物 | 进入开发的前置条件 |
|---|---|---|---|
| 部署拓扑 | 单机还是独立服务器、数据盘、备份、GPU/模型位置 | 部署设计和容量表 | POC 峰值资源测量完成 |
| API 兼容 | FastGPT 版本、OpenAPI、内部接口稳定性 | 版本兼容矩阵 | 固定上游 commit/tag |
| 数据映射 | 文档、知识点、实体关系如何映射为 chunk 或 QA | 字段字典和转换样例 | 本地最终知识 Schema 稳定 |
| 引用回链 | 如何从 FastGPT 引用回到 PingCode 页面、附件或本地预览 | 引用 URL 规范 | 网关访问和权限方案明确 |
| 分段策略 | 当前结构化单元与 FastGPT chunk 的边界是否二次切分 | 分段对照报告 | FG-004 完成 |
| 向量模型 | 中文技术文档、错误码、参数名和代码的 Embedding 选择 | 模型评测报告 | 固定问题集和标注语料准备完成 |
| 混合检索 | BM25、向量、重排权重和 metadata filters | 检索参数基线 | 至少 30 个固定问题和困难负例 |
| 数据一致性 | 同步事务、迟到结果、删除、重建和回滚 | 状态机和 ledger Schema | FG-005 完成 |
| Flow 边界 | 哪些 Agent 调用迁入 FastGPT，哪些保留当前执行器 | Agent 责任矩阵 | 知识提取与语义补充 Skill 完成职责拆分 |
| 成本控制 | 模型调用、Embedding、重排、存储和重建成本 | 成本指标和预算阈值 | POC 调用数据可用 |
| 质量治理 | 提取质量和检索质量如何分开度量 | 双层质量门禁 | 标注集和固定问题集准备完成 |
| 权限隔离 | 内部用户、空间、数据集和应用权限映射 | 权限模型 | 使用范围和租户模式明确 |
| 运维升级 | 上游升级、数据迁移、回滚、灾备和许可证变化 | 升级运行手册 | 完成至少一次备份恢复演练 |
| 前端整合 | 使用 FastGPT 原生 UI、嵌入式页面还是当前统一 UI | 前端交互设计 | 确定目标用户和操作边界 |
| 反馈闭环 | 用户纠错如何进入当前质量问题而非直接改远端事实 | 反馈 API 和审核流程 | 最终知识事实源原则确认 |

## 八、阶段验收与停止条件

| 阶段 | 继续条件 | 停止或回退条件 |
|---|---|---|
| POC 部署 | 服务稳定、模型和知识库能力可用 | 资源超出可接受范围或关键模型无法接入 |
| 解析对照 | 结构保真不低于当前链路或可只同步当前产物 | 标题、表格、代码和来源引用明显丢失且无法绕过 |
| 同步 POC | 幂等、删除、引用回链和错误重试可控 | 无法稳定映射本地 ID 或产生不可清理重复数据 |
| 检索评测 | 固定问题集指标达到当前链路基线 | 引用正确率或无答案准确率显著下降 |
| Flow POC | 严格 JSON、超时和错误处理可由适配层控制 | 结果无法校验、取消无效或版本不可追溯 |
| 灰度发布 | 可观测、权限、备份和回滚全部通过 | 任一安全、许可证或数据一致性问题未关闭 |

## 九、推荐实施顺序

| 顺序 | 工作包 | 目标 |
|---|---|---|
| 1 | FG-001～FG-004 | 完成源码基线、隔离部署和能力对照，不改生产链路 |
| 2 | FG-005～FG-008 | 建立适配层和可靠同步，固定当前加工中心为事实源 |
| 3 | FG-010～FG-012 | 接入检索并用固定问题集证明收益 |
| 4 | FG-009、FG-013 | 再评估是否把部分 Agent 执行迁入 FastGPT Flow |
| 5 | FG-014～FG-015 | 完成安全、许可证、灰度和回滚后正式启用 |
