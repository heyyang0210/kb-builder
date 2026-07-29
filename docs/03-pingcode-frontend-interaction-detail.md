# PingCode 素材平台前端交互与状态详细设计

> 版本：v1.0  
> 日期：2026-07-24  
> 状态：详细设计  
> 上位文档：`docs/02-pingcode-frontend-design.md`

## 一、设计目标

本设计用于指导 PingCode 素材下载、预处理和质量分析前端实现。页面面向知识库建设人员，属于高频操作工作台，优先保证范围选择准确、任务状态清晰、错误可恢复和结果可追溯。

当前不考虑容器部署。前端不得依赖固定机器路径、固定 IP 或构建时写死的后端地址。

## 二、核心用户流程

```text
确认登录状态
  -> 选择空间和文档范围
  -> 预估页面、附件、容量和完整性
  -> 创建素材批次
  -> 下载页面正文和附件
  -> 查看文件清单并处理失败项
  -> 扫描源文件质量
  -> 预览转换、清洗和分块结果
  -> 执行预处理
  -> 检查质量门禁
  -> 发布数据集版本
  -> 查看来源覆盖、追溯、图谱和检索验证结果
```

用户可以离开页面后再返回。每一步都必须通过 `batchId` 和 `taskId` 恢复，不依赖当前浏览器组件是否仍然存在。

## 三、路由与页面框架

| 路由 | 页面标题 | 必要上下文 |
|------|----------|------------|
| `/pingcode-materials/spaces` | 素材空间 | 可选空间、登录状态 |
| `/pingcode-materials/batches` | 素材批次 | 批次列表筛选条件 |
| `/pingcode-materials/batches/:batchId/download` | 批次下载 | 批次、下载任务 |
| `/pingcode-materials/batches/:batchId/preprocess` | 加工任务 | 批次、预处理运行 |
| `/pingcode-materials/batches/:batchId/quality` | 质量分析 | 数据集版本、质量报告 |

全局框架：

```text
┌ 产品导航 ─ 当前批次切换 ─ PingCode 状态 ─ 后端状态 ─ 运行任务 ┐
├ 侧栏：素材空间 / 素材批次 / 加工任务 / 质量分析               ┤
│ 主工作区                                                       │
└ 全局通知、确认对话框、任务抽屉                                  ┘
```

页面 URL 保存业务上下文；本地存储只保存列宽、折叠状态、每页数量等非关键偏好。

## 四、前端领域模型

以下接口是前端消费模型，最终字段以 OpenAPI 生成类型为准，不应手工维护两套不一致定义。

```ts
type Completeness = 'complete' | 'partial' | 'unknown'

interface MaterialBatch {
  id: string
  name: string
  state: 'draft' | 'downloading' | 'downloaded' | 'processing' | 'ready' | 'failed'
  sourceSelection: SourceSelection
  sourceSnapshot: SourceSnapshot
  activeTaskIds: string[]
  latestDatasetVersionId?: string
  createdAt: string
  updatedAt: string
}

interface SourceSelection {
  spaceKey: string
  includeRules: SelectionRule[]
  excludeRules: SelectionRule[]
  includePageBody: boolean
  includeAttachments: boolean
  filters: SourceFilters
}

interface SelectionRule {
  nodeId: string
  scope: 'self' | 'subtree'
}

interface SourceSnapshot {
  capturedAt: string
  completeness: Completeness
  incompleteReason?: string
  estimatedPages: number
  estimatedAttachments: number
  estimatedBytes?: number
  inaccessibleCount: number
}

interface TaskSnapshot {
  id: string
  batchId: string
  type: 'download' | 'archive' | 'scan' | 'preprocess' | 'graph'
  state: TaskState
  stage?: string
  completed: number
  total?: number
  warnings: number
  failed: number
  canPause: boolean
  canCancel: boolean
  canRetry: boolean
  updatedAt: string
}

type TaskState =
  | 'queued'
  | 'running'
  | 'pausing'
  | 'paused'
  | 'interrupted'
  | 'cancelling'
  | 'cancelled'
  | 'completed'
  | 'failed'
```

## 五、素材空间详细交互

### 5.1 页面布局

- 左栏：真实 PingCode 空间列表、搜索和映射状态；
- 中栏：远端空间信息、文档树和页面筛选；
- 右栏：本地素材空间映射、选择规则、统计和创建批次操作；
- 底部固定操作区：清空选择、预估范围、创建批次。

首次选择空间时，前端加载其映射状态。未映射空间可浏览但不能创建批次；用户保存 `localName/localSlug/enabled` 后，页面才开放范围预估和批次创建。空间列表中的映射状态必须来自服务端持久化结果，不能只保存在浏览器本地。

### 5.2 文档树规则

1. 默认使用树状模式，用户切换到平铺模式后把偏好写入 `localStorage`，下次进入继续使用上次模式；
2. 树和平铺模式共享后端完整空间索引，不各自请求不同的数据集合；
3. 树严格保持 PingCode 的真实根节点、父子关系、缩进和同级顺序，不创建合成根节点；
4. 完整索引按页面 ID 去重；父节点不在完整索引中的页面进入异常诊断，不显示为根节点；
5. 勾选父节点表示包含整个子树；取消某个后代节点只添加排除规则；
6. 筛选只改变可见结果，不隐式改变已保存的选择；搜索命中节点时同时保留其祖先路径；
7. “选择筛选结果”是独立命令，必须显示影响数量后再确认；
8. 页面正文和附件分别提供复选框，附件类型为空表示全部允许类型；
9. `.sql` 允许下载，源码、脚本、可执行文件默认排除，`.zip/.tar/.7z` 默认跳过；
10. 同级节点按 PingCode `position` 排序，并以 `identifier/short_id/name` 保证稳定顺序。

完整索引加载状态：

```text
idle -> syncing(pageIndex, uniqueCount, reportedTotal)
     -> complete(uniqueCount == reportedTotal && unresolvedParentIds is empty)
     -> partial(reason, retryable)
```

同步期间展示真实去重进度，例如 `5231 / 8073`。接口返回完成前允许展示已持久化的上次完整快照，但必须标明快照时间；没有完整快照时显示加载骨架，不用首批 1000 条伪装完整目录。

选择状态计算伪代码：

```text
function resolveNodeState(nodeId, includeRules, excludeRules):
    if nodeId 被 excludeRules 的 self/subtree 覆盖:
        return unchecked
    if nodeId 被 includeRules 的 self/subtree 覆盖:
        if 已加载后代中存在排除规则:
            return indeterminate
        return checked
    if 已加载后代存在 checked 或 indeterminate:
        return indeterminate
    return unchecked
```

### 5.3 完整性和范围预估

创建批次前必须调用后端预估接口，返回：页面数、附件数、估算容量、无权限数量、接口截断状态和筛选摘要。

当 `completeness != complete` 时：

- 页面显示持续可见的警告条；
- 批次名称和报告中标记“部分来源”；
- 禁止使用“全量下载”等误导性文案；
- 用户确认后仍可创建部分批次，但确认记录写入批次元数据。

## 六、素材批次与下载任务

创建或重新创建下载任务时，页面必须使用公共 `createRequestId()` 生成 `Idempotency-Key`。部署在 HTTP 局域网地址时浏览器可能不提供 `crypto.randomUUID()`，因此页面不得直接依赖该安全上下文 API；兼容回退不影响后端幂等契约。

范围预估不能把缺失或全零的 PingCode 统计字段当成确定事实。`pageEstimateState=upper_bound` 时显示“最多 N 个页面”，`attachmentEstimateState=unknown` 时显示“待下载确认”，并提示空页面和附件数量将在实际下载时核实；只有状态为 `exact` 时显示普通数字。

下载任务必须支持页面级断点续传。后端每完成一个页面都写入批次目录下的下载账本，至少包含页面状态、资源明细、失败摘要、告警摘要、重试次数和最后更新时间；`resources.json` 由账本汇总生成，不再依赖内存中的临时结果。后端重启后，处于 `running/downloading` 的下载任务统一标记为 `interrupted`，前端展示“已中断，可继续”，用户点击继续后只处理未完成页面。

断点账本建议目录：

```text
<batch-root>/download-state/
├── run-manifest.json
├── pages.jsonl
└── items.jsonl
```

续传口径：

- `resume` 处理 `pending/interrupted/failed` 页面，已成功页面默认跳过；
- `retry` 只处理失败页面；
- 页面正文失败计入页面失败；图片或附件失败计入告警和明细，不阻止页面正文入库；
- 无账本的历史批次仅能读取既有 `resources.json`，不能宣称具备精确断点，只提供重新下载。

### 6.1 批次列表

列表默认按更新时间倒序，支持按空间、状态、创建人、时间和关键词筛选。每行显示批次名称、空间、来源完整性、页面/附件数、当前阶段、失败数和更新时间。

批次删除默认只删除批次记录还是同时删除物理文件，必须由后端能力明确区分为两个命令，前端不得使用含糊的“删除”。

### 6.2 任务状态机

```text
queued -> running -> completed
            |  |  -> failed -> queued (retry)
            |  -> interrupted -> queued (resume)
            |  -> pausing -> paused -> queued (resume)
            -> cancelling -> cancelled
```

约束：

- 只有后端返回的 `canPause/canCancel/canRetry` 决定按钮是否可用；
- 点击命令后进入过渡状态并禁用重复操作；
- HTTP 超时不等于命令失败，前端必须重新获取任务快照；
- 重试默认只处理失败项，重新执行全部内容必须是另一个明确操作；
- 继续下载默认只处理未完成项，后端重启不会自动继续大批次下载；
- 前端不乐观修改最终状态，以服务端快照为准。

### 6.3 实时进度

首次进入页面先请求任务快照，再连接 SSE。事件处理伪代码：

```text
load task snapshot
connect event stream with lastEventId
for each event:
    ignore event when event.taskId does not match
    ignore event when event sequence <= current sequence
    merge progress into task store
on disconnect:
    show reconnecting state
    reconnect with exponential backoff
    fall back to polling after retry threshold
```

进度分为批次、页面、附件三个层级。总数未知时使用不确定进度条，不显示虚假的百分比或剩余时间。

下载页必须提供失败与告警诊断区：显示任务 ID、页面进度、已完成、跳过、失败、告警、最近错误、中断原因和更新时间；明细表支持按 `failed/warning/completed/pending` 筛选。事件流可发送 `download.item.completed`、`download.item.failed`、`download.item.warning`、`download.task.interrupted`，但不得包含 Cookie、认证头、服务器绝对路径或页面正文全文。

### 6.4 文件查看

浏览器端永远不直接打开服务器文件路径。文件操作由资源 ID 驱动：

- 可预览文本、Markdown、HTML、PDF 和支持转换的 Office 文件；
- 不可预览文件显示元数据并提供下载；
- 单文件下载使用 `Content-Disposition` 的 UTF-8 文件名；
- 批量下载先创建归档任务，完成后返回有时效的下载地址；
- 文件名、逻辑目录、来源页面和校验和在详情中展示；
- 预览失败不影响原文件下载。

## 七、加工任务详细交互

专项详细设计见 `docs/05-pingcode-processing-llm-control-design.md`。页面不得将配置文件中声明但尚未安装的阶段显示为可执行能力；能力状态由后端 Pipeline Registry 返回。

### 7.1 分阶段工作流

1. **扫描**：识别格式、编码、空文件、重复文件、损坏文件和来源元数据缺失；
2. **配置**：选择基础清洗、标准训练集或图谱增强等预设；
3. **预览**：抽取代表性样例，展示原文、转换文本、清洗文本和分块边界；
4. **执行**：按阶段查看进度、警告和失败项；
5. **验收**：检查质量门禁并处理不合格项；
6. **发布**：生成不可变的数据集版本和质量报告。

执行阶段必须显示处理类型：`本地规则 / 工具 / LLM / 视觉模型 / Embedding / 人工门禁`。模型阶段还要显示 Skill、Prompt、Provider 和模型版本，不允许只显示“处理中”。

### 7.2 参数呈现

普通模式只显示预设、语言、正文/附件范围和输出用途。分块大小、重叠、转换器、编码策略、实体规则等放入高级设置，并提供恢复默认值。

参数修改后，旧预览必须标记为过期；执行时记录完整配置版本和处理器版本。

### 7.3 Prompt 与 Skill

1. 当前运行中引用的 Skill 和 Prompt 只读，显示版本和内容哈希；
2. Prompt 管理视图允许创建草稿，使用 Monaco 编辑模板并查看变量和输出 Schema；
3. 草稿支持保存、Diff、验证和样例试运行，通过后才能发布；
4. 发布版本不可修改，历史运行永远保留原版本引用；
5. 多用户编辑采用 revision 乐观锁，冲突时必须比较后再保存；
6. 编辑和发布权限由后端控制，所有操作写审计日志。

### 7.4 模型调用与进度

- 阶段时间线显示总数、成功、警告、失败、跳过、当前处理项、吞吐量和预计剩余时间；
- 模型调用分页表显示文件/知识块、模型、Prompt 版本、Token、耗时、重试和状态；
- 调用详情展示脱敏后的最终 Prompt、响应、Schema 解析和领域规则校验；
- SSE 只传进度和资源 ID，不传完整正文、Prompt 或模型响应；
- 单项失败可重试，成功产物通过幂等键复用；
- 页面刷新后先加载运行快照，再从最后事件序号恢复订阅。

### 7.5 质量门禁

| 指标 | 默认表现 | 不通过后的操作 |
|------|----------|----------------|
| 来源可追溯率 | 百分比 + 断链数 | 查看断链文件、补齐来源 |
| 解析成功率 | 百分比 + 失败格式 | 单项重试、替换解析器 |
| 乱码率 | 百分比 + 样例 | 调整编码策略、排除文件 |
| 空块率 | 百分比 + 空块数 | 调整清洗或分块参数 |
| 重复率 | 百分比 + 重复组 | 保留主文件、合并或排除 |

门禁阈值由后端配置下发。前端只展示和提交人工确认，不在浏览器中自行计算最终质量结论。

加工任务页必须区分两类质量信息：

- 自动质量问题：来自 `training-runs/<taskId>/quality/issues.json`，通过任务质量问题接口分页展示完整明细，包含级别、问题代码、来源资源、处理单元和中文说明；
- 人工复核项：来自 `review-items.json`，只表示需要用户决策的子集，不能替代完整质量问题列表。

当任务摘要显示质量问题数量时，优先使用自动质量问题全量总数；如果运行尚未生成 `quality/issues.json`，才临时回退到待复核项数量。质量问题接口的 `total` 表示当前筛选条件下的分页总数，`overallTotal` 表示本次运行的全量质量问题数量，`counts` 表示全量级别分布；前端筛选“错误/警告/提示”时，筛选按钮仍展示全量分布，表格和分页只展示当前筛选结果。

## 八、质量分析和来源追溯

### 8.1 页面层次

1. 数据集版本和来源快照；
2. 核心质量指标及趋势；
3. 问题清单和可执行修复入口；
4. 来源覆盖矩阵；
5. 实体、关系和局部图谱；
6. 固定查询集与临时查询的检索验证。

所有指标卡都必须支持下钻，不能只有一个汇总数字。指标旁显示口径版本、计算时间和适用的数据集版本。

### 8.2 图谱交互

- 默认展示按空间、目录、实体类型聚合后的概览；
- 用户选择文档、实体或关系类型后再加载局部子图；
- 图外始终提供可排序、可筛选的节点和关系列表；
- 关系详情显示方向、类型、置信度、提取方式和原文证据；
- 点击证据打开来源抽屉，展示页面面包屑、附件、文本位置和原始链接。

### 8.3 检索验证

检索测试必须区分固定评测查询和临时人工查询。固定查询结果保存到质量报告，显示命中文档、相关性标注、来源覆盖和与上一版本的变化；临时查询不计入正式指标。

## 九、错误与恢复设计

| 场景 | 页面反馈 | 恢复操作 |
|------|----------|----------|
| PingCode 会话过期 | 顶部状态变红，当前任务说明受影响范围 | 重新登录并重试失败请求 |
| 后端断开 | 全局连接状态、页面数据保留 | 自动重连、手动重试 |
| 空间数据被截断 | 持续警告和部分来源标记 | 调整范围或确认部分批次 |
| 单文件下载失败 | 文件行标记错误码和重试能力 | 单项重试 |
| 任务命令超时 | 显示“正在确认状态” | 拉取任务快照 |
| 预处理部分失败 | 保留成功产物并列出失败项 | 从失败阶段恢复 |
| 文件预览失败 | 预览区显示原因 | 下载原文件 |
| 无访问权限 | 显示无权限资源数量 | 调整范围或申请权限 |

未知错误必须显示 `requestId`，方便服务端日志定位；认证信息和内部绝对路径不得进入用户可见错误详情。

## 十、组件和状态边界

```text
src/
├── app/                    # 路由、运行时配置、全局错误处理
├── api/                    # OpenAPI 客户端、SSE、文件下载
├── stores/                 # session、batch、task、preferences
├── features/
│   ├── spaces/             # 空间树、筛选、选择规则
│   ├── batches/            # 批次列表、批次概览
│   ├── downloads/          # 任务进度、文件清单、日志
│   ├── preprocess/         # 扫描、预览、流水线、质量门禁
│   └── quality/            # 指标、追溯、局部图谱、检索验证
└── shared/                 # 通用表格、状态页、确认框、资源预览
```

约束：

- 服务端业务状态进入 store，临时表单状态留在页面组件；
- 不把完整文件正文、万级树节点或图谱全量数据写入持久化 store；
- 请求缓存 key 必须包含批次 ID、数据集版本和筛选条件；
- 页面离开时关闭无用 SSE，但全局任务抽屉可以维持运行任务订阅。

## 十一、运行时配置

前端优先使用同源 `/api`。确需分离部署时，由服务器生成 `runtime-config.json` 或提供 `/api/system/runtime-config`，启动时读取：

```ts
interface RuntimeConfig {
  apiBaseUrl: string
  eventBaseUrl?: string
  appBasePath: string
  features: {
    localOpenDirectory: boolean
    graphAnalysis: boolean
  }
}
```

运行时配置不得包含 PingCode 密码、Cookie、服务器绝对数据目录或其他秘密信息。

## 十二、前端验收标准

1. 勾选未展开父节点后创建批次，后端收到的是子树规则而不是当前已加载节点列表；
2. 接口返回部分数据时，页面全程保留不完整标记且不出现“全量”文案；
3. 局域网浏览器能够预览和下载服务器文件，不依赖本机文件路径；
4. 下载中刷新页面后，任务和进度可以恢复；
5. SSE 断线后自动重连，重连失败时降级轮询；
6. 连续点击创建或重试不会产生重复任务；
7. PingCode 登录过期后给出明确恢复操作，已完成结果不会丢失；
8. 预处理前可以看到扫描问题和样例预览；
9. 未通过质量门禁时不能无提示发布数据集；
10. 任一知识块、实体、关系和检索结果都能追溯到来源页面或附件；
11. 万级树节点和大文件列表下滚动、筛选不会阻塞页面主线程；
12. 错误页面不泄露 Cookie、密码、认证头和服务器绝对路径。
13. 任一 LLM、视觉或 Embedding 产物可追溯到输入、Skill、Prompt、Provider、模型和调用记录；
14. Prompt 编辑不会直接影响运行中任务，发布前必须通过验证和样例试运行；
15. Worker 或前端重启后，加工运行、阶段进度和失败项能够恢复。

## 十三、待接口详细设计确认项

1. `MaterialBatch`、`SourceSnapshot`、数据集版本由哪个持久化模块负责；
2. PingCode 空间超过接口上限时，完整性检测和补充抓取策略；
3. Office 文件在线预览采用服务端转换还是仅提供下载；
4. 暂停操作能够中断到文件级、页面级还是仅阻止新任务领取；
5. 质量门禁默认阈值和人工放行权限；
6. 图谱关系置信度和抽样复核结果的数据结构。
