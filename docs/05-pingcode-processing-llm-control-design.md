# PingCode 加工任务 LLM 可控执行详细设计

## 一、设计目标

本文解决“加工任务看不到哪些环节使用模型、提示词和 Skill 不可见、执行过程无法审计”的问题。设计采用以下已确认决策：

1. FastAPI 继续作为控制面；首期由进程内后台线程执行规则、LLM 和 Skill，独立 Processing Worker 延后；
2. 第一阶段接入图片说明、文档摘要与分类、知识点与实体关系提取、语义质量复核四类模型能力；
3. 前端允许编辑提示词，但修改只能生成草稿版本，验证并发布后才能被任务引用。

本阶段补充确认：Prompt 和 Skill 的权威版本源先使用仓库文件；未来部署 YashanDB 后，通过 Registry 存储适配器迁移版本索引和内容，不改变前端 API。当前暂不启用登录系统，但数据模型和接口预留 `actorId/role` 字段，不能把前端隐藏按钮当作真实权限控制。

当前已落地的 Prompt 子阶段是只读文件 Registry：Prompt ID 使用 `<skill-id>.<prompt-name>`，Prompt 版本继承所属 Skill 版本，文件路径由 `skill.yaml` 的 `prompts` 映射确定。详细约束、校验规则和查询契约见 `docs/07-pingcode-processing-prompt-registry-design.md`。编辑、草稿、验证、试运行和发布仍未实现。

设计目标不是把后台日志直接搬到页面，而是保证每次加工都能回答：使用了什么流水线、什么 Skill、哪一版提示词、什么模型、处理了哪些输入、产生了什么结果、为什么失败、是否经过人工确认。

## 二、当前实现边界

| 能力 | 当前实际状态 | 问题 |
|------|--------------|------|
| 扫描 | 已实现，本地规则 | 只有汇总结果 |
| Markdown 清洗 | 已实现，本地规则 | 没有独立阶段快照 |
| 字符分块 | 已实现，本地规则 | 只显示总文件进度 |
| 质量门禁 | 已实现，固定规则 | 缺少问题级下钻和人工门禁记录 |
| 图片说明 | `agent-runner` 有可选视觉模型代码，PingCode 未接入 | 页面不可配置、不可追溯 |
| 摘要与分类 | 存在配置或局部实现，PingCode 未接入 | 没有统一 Provider 和 Prompt 版本 |
| 向量化 | PingCode 未实现 | 配置文档与真实能力不一致 |
| 实体关系提取 | 仅设计 | 页面误导用户认为已经具备 |
| Skill | 没有业务 `SKILL.md` | 提示词和处理规范散落在代码中 |

在新执行引擎接入前，前端必须将未实现阶段标记为“未安装”或“规划中”，不得显示为可运行。

## 三、总体架构

首期可运行框架以 `docs/04-pingcode-processing-e2e-framework-design.md` 为实施基线。下述 SQLite 和独立 Worker 架构是后续生产化目标，不作为首期端到端验收前置条件。

```text
Browser
  | HTTP: 配置、启动、控制、查询
  | SSE: 运行事件
  v
FastAPI Control Plane
  |- Pipeline Registry
  |- Prompt & Skill Registry
  |- Run Service / Approval Service
  |- Audit Query API
  v
SQLite Metadata & Event Store <----> Artifact Store
  ^                                      |
  | claim/lease/events                   | 输入、输出、Prompt 快照
  v                                      v
Processing Worker
  |- Deterministic Executors
  |- Skill Executor
  |- Model Gateway
  |    |- Chat/Vision Provider
  |    |- Embedding Provider
  |- Schema Validator
  |- Quality Gate
```

### 3.1 FastAPI 控制面

负责身份与权限、流水线配置、Prompt/Skill 版本管理、运行创建、任务控制、人工门禁、查询和 SSE 推送。控制面不直接执行耗时模型调用，避免 API 进程重启导致任务丢失。

### 3.2 Processing Worker

作为独立本机进程运行。Worker 从 SQLite 领取带租约的任务，按阶段执行并持续写入事件、调用记录和产物。首期不引入 Redis、RabbitMQ 或容器依赖，保持不同机器上的普通进程部署能力。

### 3.3 SQLite 元数据与事件库

替代加工任务对 JSON 文件并发更新的依赖，保存运行、阶段、工作项、模型调用、版本、审批和事件。正文、图片、向量和大体积响应不写入数据库，只保存资源 ID、哈希、逻辑路径和摘要。

Prompt/Skill Registry 在本阶段不依赖 SQLite：以 `scripts/pingcode/processing/skills/` 和后续 `prompts/` 下的文件为权威源，Registry 启动时扫描并校验，返回只读版本信息。未来 YashanDB 适配时，文件仍可作为导入/导出和灾备格式，数据库只替换索引与版本查询实现。

### 3.4 Artifact Store

仍使用外部化数据根目录，按运行 ID 保存不可变产物：

```text
{dataRoot}/processing-runs/{runId}/
├── run-manifest.json
├── prompt-snapshots/
├── stage-artifacts/
├── model-responses/
├── quality/
└── reports/
```

前端只通过资源 ID 访问，不展示服务器绝对路径。

## 四、流水线阶段设计

| 顺序 | 阶段 | 类型 | 首期状态 | 主要产物 |
|------|------|------|----------|----------|
| 1 | source_scan | 本地规则 | 必选 | 扫描报告、问题列表 |
| 2 | format_convert | 本地工具 | 按格式执行 | Markdown、图片资产 |
| 3 | deterministic_clean | 本地规则 | 必选 | 清洗 Markdown、变更记录 |
| 4 | structural_chunk | 本地规则 | 必选 | 带来源位置的知识块 |
| 5 | image_caption | 视觉模型 | 首期接入 | 图片说明、置信状态 |
| 6 | document_enrichment | LLM | 首期接入 | 摘要、分类、关键词 |
| 7 | knowledge_extraction | LLM + 规则 | 首期接入 | 知识点、实体、关系、证据 |
| 8 | embedding | Embedding | 首期基础能力 | 向量、模型和维度元数据 |
| 9 | semantic_quality_review | LLM + 规则 | 首期接入 | 边界样本判断、理由 |
| 10 | quality_gate | 规则 + 人工 | 必选 | 门禁结果、审批记录 |
| 11 | publish_dataset | 本地事务 | 人工触发 | 不可变数据集版本 |

Embedding 是模型处理，但不标记为 LLM。确定性阶段和模型阶段使用不同图标、颜色和统计口径。

### 4.1 图片说明

- 输入：图片资源、所在文档标题、章节、前后文本；
- 输出：客观说明、图片类型、是否包含表格/架构图/流程图、置信状态；
- 禁止推测图片中不存在的信息；
- 原图哈希相同且 Skill/Prompt/模型版本相同时复用结果；
- 模型失败时保留原图和已有 alt，不阻塞文本流水线，但进入质量问题列表。
- 当前 v1 未启用图片说明时，DOCX/PingCode 图片只作为证据层资产和预览资源保留，不写入 `final-results/knowledge.jsonl`，也不直接生成知识图谱节点或关系。

### 4.2 文档摘要与分类

同一次调用优先输出结构化的摘要、功能分类、关键词和适用版本，减少重复调用。规则分类置信度达到阈值时可跳过 LLM 分类，但任务快照必须记录采用规则还是模型。

### 4.3 知识点与实体关系提取

- 按知识块处理，但携带文档级摘要、面包屑和相邻块上下文；
- 输出必须包含 `sourceResourceId/chunkId/evidenceText/evidenceOffsets`；
- 实体和关系先通过 JSON Schema，再进行错误码、参数名、对象名等领域规则校验；
- YashanDB 错误码以 `YAS-` 为核心模式，不能把 Oracle `ORA-` 当成 YashanDB 错误码；
- 无证据关系不进入正式图谱，只进入待复核区。

### 4.4 语义质量复核

LLM 不复核全部文档，只处理规则无法确定的边界样本，例如内容过短但包含结构化信息、分类低置信度、摘要与正文冲突、实体关系证据不足。规则已明确失败的项目不浪费模型调用。

## 五、Pipeline、Skill 与 Prompt 版本

### 5.1 仓库目录

```text
scripts/pingcode/processing/
├── pipelines/
│   └── training-standard.yaml
├── skills/
│   ├── image-caption/
│   ├── document-enrichment/
│   ├── knowledge-extraction/
│   └── semantic-quality-review/
├── providers/
├── schemas/
└── README.md
```

首期四个 Skill 固定为：`image-caption`、`document-enrichment`、`knowledge-extraction`、`semantic-quality-review`。Skill Registry 和 Prompt 只读 Registry 已完成；当前继续按 Phase 2A 实现文件化 Prompt 草稿、校验、渲染预览、发布和 Diff，不执行真实模型调用。

每个 Skill 目录结构：

```text
knowledge-extraction/
├── SKILL.md                 # 目标、边界、处理步骤和质量规则
├── skill.yaml               # 机器可读元数据
├── prompts/
│   ├── system.md
│   └── user.md
├── schemas/
│   ├── input.schema.json
│   └── output.schema.json
└── tests/
    └── cases.yaml
```

### 5.2 Skill 元数据

```yaml
id: knowledge-extraction
version: 1.0.0
capability: chat
inputSchema: schemas/input.schema.json
outputSchema: schemas/output.schema.json
prompts:
  system: prompts/system.md
  user: prompts/user.md
defaults:
  timeoutMs: 60000
  maxRetries: 2
  concurrency: 3
fallback: manual_review
```

### 5.3 Prompt 编辑与发布

Prompt 状态机：

```text
draft -> validating -> validated -> published -> deprecated
```

- 前端编辑只更新草稿，不修改磁盘中的已发布版本；
- 保存采用 `revision` 乐观锁，避免多个局域网用户互相覆盖；
- 发布前必须通过变量解析、Schema、敏感信息、样例和模型试运行检查；
- 发布生成不可变 `promptVersion`、内容哈希和发布审计；
- 任务启动时固定 Prompt/Skill 版本，运行中发布新版本不影响当前任务；
- 回滚不是覆盖历史，而是将历史版本重新设为流水线默认版本。

允许编辑 Prompt 的账号设计上需要 `prompt_editor` 权限，发布需要 `prompt_publisher` 权限。当前阶段暂不设置登录系统，后端使用可选的 `actorId`（默认 `local-operator`）记录操作；正式开放局域网编辑前必须接入真实身份认证，不能只依赖前端隐藏按钮。

## 六、运行快照与数据模型

```ts
interface PipelineRun {
  id: string
  batchId: string
  pipelineId: string
  pipelineVersion: string
  configSnapshotId: string
  inputSnapshotId: string
  state: 'queued' | 'running' | 'waiting_approval' | 'completed' | 'failed' | 'cancelled'
  currentStageId?: string
  stages: StageRunSummary[]
  modelUsage: ModelUsageSummary
  createdBy: string
  createdAt: string
  updatedAt: string
}

interface StageRun {
  id: string
  runId: string
  stageType: 'rule' | 'tool' | 'llm' | 'vision' | 'embedding' | 'human_gate'
  state: 'pending' | 'running' | 'waiting_approval' | 'completed' | 'partial' | 'failed' | 'skipped'
  completedItems: number
  totalItems?: number
  successItems: number
  warningItems: number
  failedItems: number
  skippedItems: number
  throughput?: number
  estimatedRemainingSeconds?: number
  skillVersionId?: string
  promptVersionIds: string[]
  modelProfileId?: string
  artifactIds: string[]
}

interface ModelCall {
  id: string
  runId: string
  stageRunId: string
  workItemId: string
  provider: string
  model: string
  skillId: string
  skillVersion: string
  promptVersionIds: string[]
  resolvedPromptHash: string
  state: 'queued' | 'running' | 'succeeded' | 'failed' | 'reused'
  inputTokens?: number
  outputTokens?: number
  durationMs?: number
  retryCount: number
  errorCode?: string
  requestResourceId?: string
  responseResourceId?: string
}
```

任务快照记录配置、Prompt 和 Skill 引用；最终解析后的 Prompt 保存为受权限保护的资源。数据库不保存 API Key、Cookie、认证头或其他凭证明文。

## 七、进度与事件协议

原有单一 `task.progress` 扩展为：

```text
run.created
run.state_changed
stage.started
stage.progress
stage.completed
work_item.failed
model_call.started
model_call.completed
model_call.failed
approval.required
approval.resolved
run.completed
run.failed
```

示例：

```json
{
  "event": "stage.progress",
  "sequence": 1842,
  "runId": "run_xxx",
  "stageRunId": "stage_document_enrichment",
  "data": {
    "completedItems": 18,
    "totalItems": 43,
    "successItems": 17,
    "failedItems": 1,
    "currentItemName": "索引内幕文档.md",
    "throughput": 0.42,
    "estimatedRemainingSeconds": 59,
    "modelCalls": 19,
    "inputTokens": 48320,
    "outputTokens": 6210
  }
}
```

事件中不传完整 Prompt、原始正文或模型响应。前端需要查看时使用受权限控制的资源接口。总体进度按真实工作单元聚合，不把耗时差异巨大的阶段简单等权平均；总数未知时显示不确定进度，不伪造百分比。

## 八、前端详细设计

### 8.1 页面信息架构

加工任务页面改为以下区域：

```text
顶部：运行状态 / 流水线版本 / 输入快照 / 启动人 / 总耗时
主区：阶段时间线 + 当前阶段详情
右侧：本次运行配置快照 + 模型使用汇总 + 控制操作
底部页签：模型调用 | Prompt & Skill | 产物 | 质量问题 | 审计日志
```

### 8.2 阶段时间线

每个阶段固定显示：

- 类型：本地规则、工具、LLM、视觉模型、Embedding 或人工门禁；
- 状态和进度：成功、警告、失败、跳过、当前处理项；
- 执行依据：处理器版本，或 Skill/Prompt/模型版本；
- 运行指标：耗时、吞吐量、调用数、Token 和重试数；
- 操作：查看详情、查看失败项、从失败项重试、进入人工确认。

### 8.3 模型调用页签

使用服务端分页表格展示调用，不一次加载全部响应：

```text
时间 | 阶段 | 文件/知识块 | Provider/模型 | Prompt版本 | 状态 | Token | 耗时 | 重试
```

点击一行打开调用详情抽屉，展示脱敏后的输入变量、最终 Prompt、模型响应、Schema 解析结果、领域规则校验、错误和关联产物。默认隐藏正文和图片，授权用户主动展开。

### 8.4 Prompt & Skill 页签

- 当前运行视图：只读显示本次固定的 Skill/Prompt 版本和哈希；
- 管理视图：版本列表、草稿编辑器、变量列表、Schema、样例、Diff、验证结果和发布历史；
- 编辑器使用 Monaco，支持模板变量诊断和 JSON Schema 校验；
- “测试运行”只能对选定样例执行，显示预计调用数和实际结果，不直接发布；
- 页面离开时未保存草稿需要明确提示。

### 8.5 启动前检查

点击“开始加工”后先显示预检，而不是立即运行：

- 输入文件、图片、知识块数量；
- 将执行和跳过的阶段；
- 每个模型阶段的 Provider、模型、Skill 和 Prompt 版本；
- 预计模型调用次数和输入规模；
- 缺失配置、未发布 Prompt、不可用模型和待人工确认项；
- 配置快照 Diff。

设计以文档质量优先，不用 Token 预算强制截断输入。超出模型上下文时必须采用可追溯分段策略，并在预检中报告，禁止静默裁剪。

## 九、API 设计

```text
# Pipeline 与运行
GET  /api/processing/pipelines
GET  /api/processing/pipelines/{id}/versions/{version}
POST /api/processing/runs/preflight
POST /api/processing/runs
GET  /api/processing/runs/{id}
GET  /api/processing/runs/{id}/stages
GET  /api/processing/runs/{id}/events
POST /api/processing/runs/{id}/cancel
POST /api/processing/runs/{id}/retry

# 模型调用和产物
GET  /api/processing/runs/{id}/model-calls
GET  /api/processing/model-calls/{id}
GET  /api/processing/model-calls/{id}/request
GET  /api/processing/model-calls/{id}/response
GET  /api/processing/runs/{id}/artifacts

# Skill
GET  /api/processing/skills
GET  /api/processing/skills/{id}/versions/{version}

# Prompt
GET  /api/processing/prompts
GET  /api/processing/prompts/{id}
GET  /api/processing/prompts/{id}?version=1.0.0
POST /api/processing/prompts/{id}/drafts
PUT  /api/processing/prompt-drafts/{id}
POST /api/processing/prompt-drafts/{id}/validate
POST /api/processing/prompt-drafts/{id}/test
POST /api/processing/prompt-drafts/{id}/publish
GET  /api/processing/prompts/{id}/versions/{version}/diff

# 人工门禁
GET  /api/processing/runs/{id}/approvals
POST /api/processing/approvals/{id}/resolve
```

启动请求必须包含 `Idempotency-Key`。Prompt 保存使用 `If-Match: revision`。列表接口统一服务端分页。模型请求和响应资源接口必须检查权限并记录查看审计。

## 十、Worker 核心伪代码

```python
while running:
    work = repository.claim_next(worker_id, lease_seconds=60)
    if not work:
        wait()
        continue

    run = repository.load_run_snapshot(work.run_id)
    stage = pipeline_registry.resolve(run.pipeline_version, work.stage_id)
    executor = executor_registry.get(stage.type)

    try:
        repository.mark_started(work)
        for item in executor.prepare_items(run, stage):
            if repository.is_cancel_requested(run.id):
                raise Cancelled()
            resolved = skill_registry.resolve(stage.skill_version, stage.prompt_versions)
            result = executor.execute(item, resolved, run.config_snapshot)
            schema_validator.validate(result)
            artifact_id = artifact_store.save_immutable(result)
            repository.record_result(item, artifact_id, result.metrics)
            repository.publish_progress(run.id, stage.id)
            repository.renew_lease(work)
        repository.complete_stage(work)
    except RetryableError as error:
        repository.retry_or_fail(work, error)
    except Exception as error:
        repository.fail_stage(work, error)
```

模型调用使用稳定幂等键：`inputHash + skillVersion + promptVersionHashes + provider + model + modelParameters`。相同调用成功完成后可复用，但必须在调用记录中标记 `reused` 和原调用 ID。

## 十一、失败、恢复与人工门禁

- Provider 超时、限流、临时网络错误按策略退避重试；
- Schema 错误允许一次修复调用，仍失败则进入待复核；
- 单个工作项失败不立即中止批次，阶段按允许失败率决定 `partial/failed`；
- 从失败项重试时复用成功产物，不能重复处理全部内容；
- Prompt、Skill 或模型版本变化后重试视为新运行分支，不覆盖原运行；
- 人工确认保存操作者、时间、结论、理由和前后差异；
- 发布数据集必须引用唯一运行和审批快照。

## 十二、安全与多用户控制

1. Provider 密钥只保存在服务端配置或环境变量中；
2. Prompt 模板不得包含密钥，发布检查扫描常见凭据模式；
3. 完整 Prompt 和响应默认脱敏，查看原文需要单独权限；
4. Prompt 草稿采用乐观锁，发布采用不可变版本；
5. 启动、取消、重试、发布、审批和查看敏感调用均写审计日志；
6. Worker 只接受数据库中已发布的 Pipeline、Skill 和 Prompt 版本；
7. 任何前端参数都由后端重新校验，不能依赖浏览器限制。

## 十三、分阶段实施

### Phase 1：执行控制基础

- 定义数据库表、运行快照、阶段状态机和事件协议；
- 建立 FastAPI 控制面与独立 Worker；
- 将现有扫描、清洗、分块迁入 Worker；
- 前端实现阶段时间线、任务恢复和失败项列表。

### Phase 1A：Skill Registry（当前小任务）

- 用文件扫描四个 Skill 目录；
- 校验 `skill.yaml` 的 ID、版本、能力类型、Schema 和 Prompt 路径；
- 校验路径必须位于 Skill 目录内，禁止通过 `..` 读取任意文件；
- 提供 Skill 列表、详情和指定版本查询接口；
- 当前只返回发布态文件，未实现草稿、模型调用和编辑接口。

接口与伪代码：

```python
registry = SkillRegistry(root=settings.processing_skill_root)
skills = registry.list_published()
skill = registry.get(skill_id, version)

def load_skill(skill_dir):
    manifest = read_yaml(skill_dir / "skill.yaml")
    validate_manifest(manifest)
    validate_relative_paths(skill_dir, manifest)
    return SkillDefinition(
        id=manifest["id"],
        version=manifest["version"],
        capability=manifest["capability"],
        manifest=manifest,
        skill_markdown=read_text(skill_dir / "SKILL.md"),
    )
```

验收边界：真实后端启动后可以查询四个 Skill；非法 YAML、重复版本、缺失文件和目录穿越均返回稳定错误；不调用任何 Provider。

### Phase 2：Prompt 与 Skill 管理

- 建立四个 Skill 的目录、Schema 和基准样例；
- 实现草稿、验证、试运行、发布、Diff 和权限；
- 前端实现 Monaco Prompt 编辑与运行快照查看。

当前 Phase 2 先实现文件化控制面，具体存储、校验、乐观锁、发布和 `render_only` 试运行约定见 `docs/06-pingcode-processing-prompt-management-design.md`。本阶段只记录 `actorId`，不提供真实登录权限；真实 Provider 和 Worker 不在本阶段混入。

### Phase 3：四类模型能力

- 接入图片说明；
- 接入文档摘要、分类和关键词；
- 接入知识点、实体和关系提取；
- 接入边界样本语义质量复核；
- 完成调用级审计、重试和缓存复用。

### Phase 4：Embedding、图谱与质量闭环

- 接入可配置 Embedding Provider；
- 写入向量库和证据化图谱；
- 实现人工门禁、质量报告和数据集发布；
- 使用固定检索问题集验证处理前后效果。

### Phase 5：真实全流程验收

- 使用真实 PingCode 批次和真实模型 API；
- 覆盖断网、限流、模型响应无效、Prompt 冲突、Worker 重启和 SSE 重连；
- 输出调用、Token、耗时、失败、质量和来源追溯报告；
- 浏览器验证所有阶段、Prompt、Skill、调用和产物可下钻。

## 十四、验收标准

1. 页面能准确区分本地规则、LLM、视觉模型、Embedding 和人工门禁；
2. 任一模型产物可追溯到输入、Skill、Prompt、Provider、模型和调用记录；
3. 运行中可以查看阶段、文件/知识块和模型调用进度，刷新后可恢复；
4. Prompt 可编辑、验证、试运行、发布和比较，运行中版本不会漂移；
5. Worker 或 API 重启后不会丢失任务，租约到期任务可恢复；
6. 单项失败可重试，成功产物不重复计算；
7. 模型输出必须通过 Schema 和领域规则，低置信度结果进入人工门禁；
8. API Key、Cookie 和认证头不会出现在前端、事件、日志或产物中；
9. 数据集发布能够追溯到唯一输入快照、运行快照和审批记录；
10. 系统测试真实调用后端 API 和至少一个实际模型 Provider，不以 Mock 结果代替最终验收。

## 十五、不在本期范围

- 容器部署、Kubernetes 和外部分布式消息队列；
- 允许用户在浏览器中执行任意 Python、JavaScript 或 Shell；
- 自动发布未经 Schema、领域规则和质量门禁验证的模型结果；
- 将 Provider 密钥写入 Prompt、Skill、数据库任务快照或前端运行时配置。
