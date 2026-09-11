# PingCode 加工系统未完成项跟踪

> 版本：v1.1  
> 日期：2026-07-27  
> 对应设计：`docs/05-pingcode-processing-llm-control-design.md`、`docs/07-pingcode-processing-prompt-registry-design.md`、`docs/06-pingcode-processing-prompt-management-design.md`

## 一、当前完成边界

以下能力已经完成，不再列入未完成项：

| 能力 | 当前状态 | 代码/文档依据 |
|------|----------|----------------|
| 四个首批 Skill 文件 | 已完成 | `tools/knowledge-processing/pingcode-processing/skills/` |
| Skill Registry | 已完成 | Skill 列表、详情、版本查询和路径校验 |
| Prompt 只读 Registry | 已完成 | Prompt 列表、详情、哈希、版本查询 |
| Prompt 草稿文件存储 | 已完成 | `runtime/web/processing/prompt-drafts/`，可通过配置覆盖 |
| Prompt revision 乐观锁 | 已完成 | 更新时校验 `If-Match` |
| Prompt 基础校验 | 已完成 | 变量、输入 Schema、空内容、敏感信息 |
| Prompt render-only 预览 | 已完成 | 明确不调用模型，返回 `executionMode=render_only` |
| Prompt 文件化发布和 Diff | 已完成 | 新建不可变 Skill/Prompt 版本，保留旧版本 |

## 二、未完成项总览

| 优先级 | 未完成项 | 当前状态 | 主要影响 |
|--------|----------|----------|----------|
| P0 | 统一 Model Provider | 尚未实现 | 无法执行真实 LLM、视觉模型和 Embedding |
| P2 | SQLite 控制面与独立 Worker | 本期延后 | 首期用 JsonStore 和后台线程完成框架，暂不具备可靠恢复 |
| P0 | 轻量 Training Task/Stage 状态 | 尚未实现 | 前端无法查看端到端加工的阶段级进度 |
| P1 | 四类 Skill 的真实执行器 | 仅有文件定义 | 图片说明、摘要分类、知识提取和语义复核尚未产生模型产物 |
| P1 | Prompt 真实试运行、调用审计和缓存 | 只有渲染预览 | 无法查看 Provider、模型、Token、耗时和重试 |
| P1 | 前端 Prompt/Skill 管理界面 | 尚未接入新 API | 用户不能在页面编辑、校验、预览、发布和查看版本 |
| P1 | 真实权限、登录和审计 | 仅记录 `actorId` | 局域网用户仍没有后端级编辑/发布权限隔离 |
| P1 | SSE 运行事件和断线恢复 | 尚未实现新事件协议 | 页面刷新或断线后不能恢复新加工运行状态 |
| P2 | Embedding Provider 和向量库 | 尚未实现 | 不能形成向量检索数据集 |
| P0 | 证据化实体关系图谱框架 | 尚未实现 | 不能形成可追溯的知识图谱产物 |
| P1/P2 | 图数据库知识库存储与 GraphRAG 投影 | 新增待设计 | JSON 图谱尚无图数据库消费存储、版本回填、失效传播和有界 GraphRAG 查询 |
| P1 | What/How/Why 规则配置化 | v1 代码规则推断 | 知识域、本体类型和任务场景词表仍需配置化或由 Skill 结构化输出 |
| P2 | 人工质量门禁和数据集发布 | 尚未实现 | 模型结果不能进入可审计的正式数据集 |
| P2 | 全流程真实模型与故障验收 | 尚未实现 | 没有真实 Provider、限流、断网、重启和 SSE 重连报告 |

## 三、详细未完成项

### 1. 统一 Model Provider（P0）

**缺失内容**：`tools/knowledge-processing/pingcode-processing/providers/` 尚未形成统一接口、Provider Registry、模型配置和错误分类。

**需要实现**：

- 统一 `chat`、`vision`、`embedding` 能力接口；
- Provider、模型、能力和参数的服务端配置；
- 超时、限流、认证失败、上下文超限和响应格式错误的统一错误模型；
- Provider 密钥只从服务端环境变量或配置读取，不进入前端、Prompt、事件和运行快照；
- 首先接入一个可验证的 OpenAI-compatible Provider，再扩展其他 Provider；
- 记录 Provider、模型、请求哈希、响应哈希、耗时、重试和复用关系。

**完成标准**：同一 Skill 不感知底层厂商；替换 Provider 不改变前端和 Worker 的调用契约；真实调用能够返回可审计的 `ModelCall`。

### 2. SQLite 控制面和独立 Worker（P2，本期延后）

**缺失内容**：当前后端只有既有的 `JsonStore`、线程式预处理任务和旧任务 SSE，没有设计文档中的 SQLite 运行库与独立 Worker。

**需要实现**：

- `PipelineRun`、`StageRun`、`WorkItem`、`ModelCall`、`Artifact`、`Approval` 和 `Event` 表；
- 运行创建、租约领取、心跳续租、租约过期恢复和取消标记；
- API 进程与 Worker 进程分离，API 重启不丢失运行；
- 幂等键支持成功产物复用，失败项重试不重复处理成功项；
- 现有扫描、清洗、分块迁移为确定性 Worker 阶段。

**完成标准**：Worker 被杀掉后，租约到期工作项能够被另一个 Worker 恢复；运行快照和阶段事件可完整查询。

### 3. 轻量 Training Task/Stage API 与事件协议（P0）

本期先实现以下接口，详细契约见 `docs/04-pingcode-processing-e2e-framework-design.md`：

```text
POST /api/training/tasks
GET  /api/training/tasks/{id}
GET  /api/training/tasks/{id}/events
GET  /api/datasets/{id}/graph/summary
GET  /api/datasets/{id}/graph/nodes
GET  /api/datasets/{id}/graph/edges
```

本期通过现有 JsonStore 和后台线程保存阶段快照与事件。`WorkItem` 租约、重启恢复、审批和独立 Worker 事件在 SQLite 阶段实现。

### 4. 四类 Skill 真实执行（P1）

当前四个 Skill 只有 `SKILL.md`、Prompt 和 Schema 文件，没有执行器：

- `image-caption`：图片上下文、图片哈希复用和客观说明；
- `document-enrichment`：摘要、分类、关键词和适用版本；
- `knowledge-extraction`：知识点、实体、关系和证据偏移；
- `semantic-quality-review`：规则边界样本的语义复核。

每个执行器还需要实现输入准备、上下文携带、Prompt 解析、Provider 调用、输出 Schema 校验、YashanDB 领域规则校验和失败策略。

### 5. Prompt 真实试运行与调用审计（P1）

当前 `/test` 只返回模板渲染结果，尚未实现：

- 选择 Provider、模型和模型参数；
- 真实样例调用和脱敏输入/输出；
- Schema 修复调用及失败转人工复核；
- `ModelCall` 记录、Token、耗时、重试、错误和幂等复用；
- 请求/响应资源的权限控制和查看审计。

`render_only` 不能替代真实模型验收，必须在 Provider 完成后增加真实调用模式。

### 6. 前端加工控制面（P1）

现有素材平台前端已有规则预处理界面，但新设计中的以下页面能力尚未接入：

- Pipeline/Run 启动前预检；
- 阶段时间线、当前工作项、吞吐量、失败数和预计剩余时间；
- Prompt & Skill 版本、哈希、Schema 和运行快照；
- Monaco Prompt 编辑、变量诊断、Diff、校验和发布；
- Provider/模型调用分页列表和调用详情抽屉；
- 产物、质量问题、审批和审计页签；
- SSE 断线重连和刷新后从事件序号恢复。

在新执行引擎接入前，未实现阶段必须继续显示“未安装/规划中”，不能显示为可执行能力。

### 7. 权限、登录和审计（P1）

当前只保留 `actorId`，没有真实身份认证和后端权限判断。后续至少需要：

- `prompt_editor`、`prompt_publisher`、`run_operator`、`quality_reviewer` 角色；
- 草稿编辑、发布、运行、取消、重试、审批和敏感调用查看权限；
- 后端统一鉴权，不能依赖前端隐藏按钮；
- 发布、审批、查看敏感 Prompt/响应的审计记录；
- 认证接入前，局域网环境只能将管理接口视为开发模式，不应作为生产权限方案。

### 8. Embedding、图谱和质量闭环（P2）

仍未实现：

- Embedding Provider、维度/模型版本元数据和批量向量化；
- ChromaDB 本地适配器以及后续 Milvus 适配器；
- 带 `sourceResourceId/chunkId/evidenceText/evidenceOffsets` 的证据图谱；
- YashanDB 错误码、参数、对象和版本领域规则；
- 图谱覆盖度、关联度、断链率和重复率计算；
- 人工质量门禁、审批记录和不可变数据集发布；
- 固定检索问题集对处理前后效果的对比验证。

### 9. 真实全流程验收（P2）

尚未形成正式系统测试报告，仍需使用真实 PingCode 批次和至少一个实际模型 Provider 验证：

- 正常执行、单项失败和失败项重试；
- Provider 超时、限流、认证失败和无效 JSON；
- Prompt 发布后运行版本不漂移；
- API/Worker 重启、租约恢复和成功产物复用；
- SSE 断线、重连和轮询降级；
- 凭据不出现在前端、日志、事件和产物；
- 结果来源、Prompt、Skill、Provider、模型和调用记录可追溯。

## 四、依赖关系和建议顺序

```text
统一 Provider + 轻量 Training Task
      ↓
四类 Skill 真实执行 + 证据图谱
      ↓
前端阶段进度 / 图谱摘要 / 调用摘要
      ↓
质量优化 + Embedding + 人工质量门禁
      ↓
SQLite Worker 化 + 生产可靠性验收
```

推荐继续拆成以下小任务：

1. agent-runner 内部 Model Gateway；
2. 轻量 Training Task、阶段事件和产物目录；
3. 文档增强与知识提取真实调用；
4. 证据图谱构建和查询 API；
5. 前端任务进度和图谱摘要；
6. 真实 API 全流程验收；
7. 领域质量、Embedding、人工门禁优化；
8. SQLite、独立 Worker、租约恢复和生产可靠性。

图数据库专项任务另行按以下顺序执行，不提前替代 JSON 审计图谱：

9. `TASK-P2-05`：Graph Store Adapter 和 Neo4j/NebulaGraph ADR；
10. `TASK-P2-06`：批量写入、幂等、失败隔离和写入状态；
11. `TASK-P2-07`：版本化回填、校验、失效传播和回滚；
12. `TASK-P2-08`：有界图查询与 GraphRAG 检索适配；
13. `TASK-P2-09`：S/M/L 容量、性能、重启和故障恢复验收。

对应需求：`REQ-KGO-34`。在图数据库选型、权限、部署和性能门禁确认前，任务只允许产出设计和隔离环境验证。

## 五、当前明确不做

- 不把 `render_only` 结果当作模型结果；
- 不在没有 Provider、Worker 和真实权限前开放生产级加工入口；
- 不用 Token 预算截断代替文档质量控制；
- 不把 API Key、Cookie 或认证头写入 Prompt、Skill、前端配置、日志和运行快照；
- 不在本跟踪项中加入容器、Kubernetes 或外部消息队列部署。
