# 知识中心-文档生产-GitLab MR写回与审核发布闭环-详细设计文档

> 文档类型：垂直业务详细设计
> 设计编号：KC-M07-DETAIL-GITLAB-DELIVERY-001
> 上游需求：`../01-需求/知识中心-平台-总体需求-需求文档.md`
> 上游概要设计：`../02-概要设计/知识中心-文档生产-增量构建垂直业务-概要设计文档.md`
> 上游详细设计：`./知识中心-文档生产-增量构建任务变更集与候选版本-详细设计文档.md`、`./知识中心-文档生产-审核与发布-详细设计文档.md`
> 关联设计：`./知识中心-平台-外部平台连接器与回写策略-详细设计文档.md`、`../02-概要设计/知识中心-知识资产-GitLab手册映射与协作审阅-概要设计文档.md`
> 状态：草拟中
> 版本：0.2.0
> 更新日期：2026-09-16

> 实施边界：本文定义目标态及开发基线，不表示真实 GitLab 写入已经启用。启用前必须完成 OAuth 写权限、GitLab 状态通知、隔离项目、并发冲突、安全和真实 API 端到端验收。

> 阅读说明：正文优先使用业务语言。无法删除的英文或技术名词会在首次出现时说明含义和用途；代码字段名保留英文，便于后续实现直接对应。

## 1. 需要解决的问题

知识中心已经具备本地增量草稿、结构化变更、完整性检查、审核决定和平台版本发布，也具备 GitLab 连接、用户 OAuth、分支、目录与文件读取能力，但两条链路尚未闭合。当前用户完成一次文档修改后，仍需离开平台手工创建分支、复制内容、提交文件、创建合并请求（Merge Request，以下简称 MR），再把 MR 地址和 CI 结果登记回平台。

这不是少一个按钮，而是存在七个事实断点。

### 1.1 本地候选与正式仓库割裂

本地候选记录了修改内容和审核结论，GitLab 默认分支保存正式文档，两者没有可验证的交付关系。平台无法证明某个正式版本来自哪个 GitLab Commit，也无法证明 GitLab 中的内容就是审核人批准的内容。

### 1.2 平台发布可能领先于 GitLab 事实

当前兼容流程允许先生成平台发布版本，再人工登记 GitLab MR 或 CI 证据。这样会产生“平台显示已发布，但 GitLab 尚未提交或合并”的假完成状态。发布状态不再代表同一个事实，后续读取、检索、回溯和审计都可能得到不同答案。

### 1.3 用户承担了不属于业务目标的机械操作

用户真正要完成的是“把审核通过的正确文档发布出去”，而不是学习分支命名、Git 命令、Commit 格式和 MR 创建步骤。手工搬运不仅耗时，还可能发生漏文件、错分支、错项目、错目标分支和粘贴旧内容。

### 1.4 MR 与候选之间缺少强绑定

人工登记的 MR 地址不能证明以下事实：

- MR 是否属于当前手册和当前任务；
- MR 内容是否对应当前 `candidateDigest`；
- MR 是否已经合并；
- 合并前是否被追加或替换过提交；
- 合并后的目标文件是否仍与审核通过的候选一致。

### 1.5 并发修改无法可靠判定

现有候选包含节点级 `beforeDigest`，但 GitLab 写回还缺少 `baseCommitSha`、文件 `blobId` 和提交前远端 HEAD 复核。其他人在默认分支修改同一文件后，平台如果直接覆盖，会丢失远端更新；如果一律失败，又会阻断互不相关的并行修改。

### 1.6 跨系统部分成功没有恢复模型

创建分支、创建 Commit、创建 MR 是多个远端步骤。任何一步都可能超时，且超时并不代表 GitLab 没有成功执行。若系统没有逐步持久化远端标识并在重试前查询事实，就会创建重复分支、重复 Commit 或重复 MR。

### 1.7 三类权限没有形成闭环

平台业务权限、GitLab 项目权限和正式发布权限是三件不同的事。当前流程没有完整表达：谁能编辑候选、谁能批准、谁能以自己的 GitLab 身份创建 MR、谁能在 GitLab 合并、谁能把已合并内容发布为平台正式版本。

## 2. 为什么必须解决

### 2.1 用户视角：减少步骤不是目标，消除错误才是目标

用户应该在一个连续工作流中完成内容编辑、审核、交付和发布。平台应自动完成分支、Commit、MR、状态同步和证据关联，让人工只保留三个需要判断力的动作：平台内容审核、GitLab 合并审批和最终发布确认。

### 2.2 事实视角：正式文档只能有一个权威来源

GitLab 目标分支必须是正式文档事实源；平台发布版本是从已验证 GitLab 提交生成的不可变运行快照。只有这样，仓库、平台阅读、检索索引和审计记录才能指向同一内容。

### 2.3 审计视角：每个版本必须可以反向证明

任何平台正式版本都必须能反查：

```text
正式版本
→ GitLab merge commit
→ MR
→ 平台候选摘要
→ 结构化变更集
→ 审核决定
→ 操作者与时间
```

若其中一环只能靠人工说明，系统就不能证明正式版本确实经过了既定审核和交付流程。

### 2.4 并发视角：冲突必须可见，不能静默覆盖

多人协作的正确策略不是阻止并行，而是识别真正冲突。目标分支前进但相关文件未变化时可以安全重放；相关文件或节点变化时必须明确进入冲突状态，由用户创建修订任务或重新确认基线。

### 2.5 演进视角：先形成最短闭环，再扩展复杂能力

GitLab API 已经提供创建分支、批量 Commit、创建 MR 和查询状态的确定性能力。首期不需要引入本地 clone、工作区管理或独立 GitOps 服务。先用最少组件完成可验证闭环，后续再接入更多自动检查、多仓库交付和异步任务。

## 3. 第一性原理与设计结论

### 3.1 不可违背的事实

1. GitLab 目标分支是正式文档事实源。
2. 本地草稿和候选只是工作副本，不能直接成为正式版本。
3. 平台审核通过只授予发起 GitLab 交付的资格，不代表发布完成。
4. MR 创建不代表交付完成；人工合并并验证后才能进入待发布。
5. 平台复用 GitLab 的保护分支、审批和合并能力，不重新实现代码托管治理。
6. 平台不直接写默认分支、不调用合并 API、不自动发布。
7. 数据库与 GitLab 之间采用“分步执行、每步留痕、失败后从上一步继续”的恢复方式；重复点击或重试不得创建第二份结果。
8. 同一个 `candidateDigest` 只能对应一个有效交付和一个活动 MR。

### 3.2 删除不必要的复杂度

首期明确不做：

- 不在平台主进程执行 `git clone`、`git commit` 或 `git push`；
- 不建立临时 Git 工作区；
- 不允许客户端直接构造 GitLab Commit actions；
- 不允许用户任意输入项目、目标分支或仓库路径；
- 不同步 GitLab MR 评论和平台审核评论；
- 不提交图片、压缩包和其他二进制资源；
- 不支持一个任务跨多个 GitLab 项目；
- 不因 GitLab 状态通知到达而自动发布。

## 4. 正常合入流程与异常处理流程

### 4.1 用户主流程

```text
本地草稿
→ 完整性检查
→ 候选冻结
→ 平台审核通过
→ 创建 GitLab 分支与 Commit
→ 创建 MR
→ GitLab 人工审核与合并
→ GitLab 主动通知平台，平台验证合并事实
→ 发布角色确认
→ 平台正式版本发布
```

### 4.2 正常合入流程

主流程只保留六个阶段，页面进度条和任务主状态均使用这六个值：

| 阶段 | 进入条件 | 用户看到的主要动作 | 正常下一阶段 |
|---|---|---|---|
| `approved` 审核已通过 | 候选已冻结并审核通过 | 创建 GitLab MR | `mr_preparing` |
| `mr_preparing` 正在提交 | 平台正在创建分支、Commit 和 MR | 查看提交进度，不可重复提交 | `mr_open` |
| `mr_open` 等待合并 | MR 已创建 | 打开 MR；必要时刷新状态 | `mr_merged` |
| `mr_merged` 正在验证 | GitLab 报告 MR 已合并 | 查看合并提交和验证进度 | `publish_ready` |
| `publish_ready` 可以发布 | 内容来源、合并结果和必需 CI 均验证通过 | 发布正式版本 | `published` |
| `published` 已发布 | 平台发布事务完成 | 查看正式版本和来源记录 | 终态 |

正常路径固定为：

```text
approved → mr_preparing → mr_open → mr_merged → publish_ready → published
```

### 4.3 异常处理流程

异常不再扩展成一串与主流程并列的任务状态。交付记录使用独立的 `health`（处理结果）和 `failureReason`（失败原因），主流程停留在发生问题的阶段。问题恢复后继续原阶段；候选已不再有效时创建修订任务，原任务不再向后推进。

| 发生阶段 | 异常结果 | 页面说明 | 用户或系统恢复动作 | 恢复后去向 |
|---|---|---|---|---|
| `approved` / `mr_preparing` | `reauth_required` | GitLab 授权已失效 | 用户重新连接 GitLab，再点“继续提交” | `mr_preparing` |
| `mr_preparing` | `retryable_failure` | GitLab 暂时不可用或请求超时 | 系统先查询远端是否已成功；确认未完成后重试 | `mr_preparing` 或 `mr_open` |
| `mr_preparing` | `conflict` | 目标文件已被他人修改 | 查看差异并从最新内容创建修订任务 | 原任务终止推进 |
| `mr_open` | `mr_closed` | MR 未合并即关闭 | 查看 MR；需要继续时创建修订任务 | 原任务终止推进 |
| `mr_open` / `mr_merged` | `pipeline_failed` | GitLab 自动检查未通过 | 打开流水线处理问题；新检查成功后刷新 | 原阶段继续 |
| `mr_merged` | `content_mismatch` | 合并内容与审核内容不一致 | 查看差异并创建修订任务 | 原任务终止推进 |
| `publish_ready` | `publish_failed` | 平台发布暂时失败 | 保留已验证结果并重试发布 | `publish_ready` |

只有服务端可以推进主阶段或写入异常结果。客户端提交的目标阶段、MR 结果和 CI 结果均不能作为事实。这样既覆盖正常合入，也覆盖授权、网络、并发、关闭、检查失败、内容不一致和发布失败，不需要为每种错误增加一个主状态。

## 5. 架构设计

### 5.1 逻辑组件

| 组件 | 职责 | 禁止事项 |
|---|---|---|
| `GitLabWriteClient` | 封装 Branch、Commit、MR、Pipeline 和仓库文件 API；统一错误映射与限流信息 | 不理解审核、发布和任务状态 |
| `GitLabDeliveryService` | 冻结交付输入、并发校验、应用结构化变更、按步骤执行并保存进度、记录审计 | 不直接读取客户端指定的任意项目或路径 |
| `GitLabWebhookHandler` | 接收 GitLab 状态通知，校验密钥、限制请求体、去重、匹配交付并同步 MR/CI 结果 | 不直接发布平台版本 |

### 5.2 数据流

```text
结构化变更集
→ 不可变候选包
→ GitLabDeliveryService
→ GitLabWriteClient
→ GitLab Branch / Commit / MR API
→ GitLab 人工合并
→ GitLab 状态通知接收器
→ 合并内容验证
→ 发布前检查
→ 不可变平台版本
```

### 5.3 事实分层

| 层级 | 事实 | 是否可变 |
|---|---|---:|
| 工作层 | 草稿、来源、目标范围 | 候选冻结前可变 |
| 审核层 | 候选摘要、审核评论、审核决定 | 候选冻结后不可变；修订产生新候选 |
| 交付层 | 分支、Commit、MR、Pipeline、GitLab 状态通知 | 由 GitLab 产生，平台只保存结果和验证 |
| 发布层 | 平台正式版本及其 GitLab 来源记录 | 不可变 |

## 6. 需要保存的数据

本节说明平台必须保存哪些字段，以及这些字段如何证明“发布内容来自哪次审核和哪次 GitLab 合并”。它既指导数据库实现，也避免前后端对同一字段产生不同理解。

### 6.1 GitLabDelivery

增量任务增加 `delivery`：

```json
{
  "id": "delivery_xxx",
  "version": 1,
  "step": "MR_CREATED",
  "connectionId": "gitlab-xxx",
  "projectPath": "cod-doc/yasdoc",
  "baseBranch": "master",
  "baseCommitSha": "sha",
  "effectiveBaseCommitSha": "sha",
  "candidateDigest": "sha256",
  "packageDigest": "sha256",
  "sourceBranch": "kc/DB-001/inc_xxx-ab12cd34",
  "commitSha": "sha",
  "sourceHeadSha": "sha",
  "mergeRequestIid": 123,
  "mergeRequestUrl": "https://gitlab.example/namespace/project/-/merge_requests/123",
  "mergeStatus": "opened",
  "mergeCommitSha": null,
  "pipelineStatus": "pending",
  "pipelineSha": null,
  "verifiedTargetHeadSha": null,
  "health": "normal",
  "failureReason": null,
  "idempotencyScope": "gitlab-xxx:inc_xxx:sha256",
  "requestedBy": { "id": "usr_xxx", "displayName": "张三" },
  "lastError": null,
  "createdAt": "2026-09-16T02:00:00.000Z",
  "updatedAt": "2026-09-16T02:00:00.000Z"
}
```

### 6.2 冻结变更包

```text
GitLabDeliveryPackage {
  taskId
  handbookId
  connectionId
  projectPath
  baseBranch
  baseCommitSha
  candidateDigest
  packageDigest
  reviewDecisionIds[]
  files[] {
    path
    language
    beforeBlobId
    beforeDigest
    afterState: present | absent
    afterDigest?
    operations[] {
      type: add | update | delete | move
      documentId
      nodeId
      beforeDigest
      after | contentRef
      targetParentId?
      ordinal?
    }
  }
  requestedBy
  frozenAt
}
```

`candidateDigest` 绑定平台候选整体，可能包含基线、目标、来源和结构化变更等信息，不能当作单个文件的内容摘要。`afterDigest` 只描述对应文件的预期最终正文；删除操作使用 `afterState=absent` 且不设置 `afterDigest`。`packageDigest` 对 `candidateDigest`、项目、目标分支以及按路径排序后的文件 `path/afterState/afterDigest` 清单做规范化摘要，用于证明本次 GitLab 交付包没有被替换。

冻结后不允许原地修改。任何内容变化必须形成新的候选摘要、文件最终摘要、交付包摘要和新的交付版本。

### 6.3 版本来源记录

“版本来源记录”用于回答正式版本来自哪个项目、MR、提交和候选版本。正式版本必须增加：

```text
gitlabSource {
  connectionId
  projectPath
  mergeRequestIid
  mergeRequestUrl
  sourceBranch
  targetBranch
  commitSha
  mergeCommitSha
  candidateDigest
  packageDigest
  verifiedTargetHeadSha
  pipelineStatus
  pipelineSha
  verifiedAt
  mergedBy
}
```

OAuth Token 不得进入任务数据、交付记录、审计、日志或前端响应。

## 7. 前后端接口设计

本节约定页面如何请求后端、后端返回哪些结果以及哪些字段禁止由页面指定，用于保证页面、后端和测试使用同一套输入输出规则。

### 7.1 创建或恢复交付

`POST /knowledge-center/api/incremental-tasks/:taskId/gitlab-delivery`

请求头：

```text
Idempotency-Key: <客户端为本次动作生成的唯一值>
```

`Idempotency-Key` 是一次按钮操作的唯一编号，用来保证页面重复点击或网络重试时返回同一结果，不重复创建 MR。

请求体不接受项目、目标分支、源分支和文件 actions；这些字段必须由任务、手册映射和服务端规则计算。

成功响应：

```json
{
  "success": true,
  "data": {
    "taskId": "inc_xxx",
    "state": "mr_open",
    "delivery": {
      "id": "delivery_xxx",
      "sourceBranch": "kc/DB-001/inc_xxx-ab12cd34",
      "commitSha": "sha",
      "mergeRequestIid": 123,
      "mergeRequestUrl": "https://gitlab.example/.../123",
      "mergeStatus": "opened",
      "pipelineStatus": "pending"
    }
  }
}
```

### 7.2 查询交付

`GET /knowledge-center/api/incremental-tasks/:taskId/gitlab-delivery`

返回服务端保存的交付状态、最近一次远端验证时间、允许动作和下一步中文提示。查询接口不隐式修改远端状态。

### 7.3 主动刷新

`POST /knowledge-center/api/incremental-tasks/:taskId/gitlab-delivery/refresh`

用于 GitLab 状态通知延迟或丢失时主动读取 MR 和 Pipeline。必须携带 `Idempotency-Key`；只能收敛到真实远端状态，不能接受客户端指定结果。

### 7.4 接收 GitLab 状态通知

`POST /knowledge-center/api/gitlab/webhooks/:connectionId`

Webhook 是 GitLab 在 MR 或 CI 状态变化时，主动调用知识中心地址发送的一次 HTTP 通知。它的用途是让平台及时知道“MR 已合并”或“CI 已完成”，避免页面持续向 GitLab 轮询。

它有必要存在，但不能作为唯一途径：通知可能因网络、配置或服务重启而延迟或丢失。因此平台同时提供页面“刷新状态”和后台低频校准；三种途径都只读取 GitLab 真实状态并触发验证，不会自动发布。

接口支持 Merge Request 和 Pipeline 事件。处理要求：

- 在解析业务字段前校验连接级 Secret；
- 以 GitLab 事件 UUID 去重；
- 限制请求体大小；
- 项目、MR、分支与交付记录必须一致；
- 未匹配事件返回成功接收但不改变业务状态，并记录脱敏审计；
- 状态通知只同步事实和触发验证，不直接发布。

### 7.5 发布前必须通过的检查

现有发布接口增加以下前置条件：

- 任务状态为 `publish_ready`；
- `mergeCommitSha` 已保存并复核；
- `candidateDigest` 和 `packageDigest` 仍指向已批准的冻结对象；
- MR 最终提交头、变更路径和变更内容与冻结交付包完全一致，不存在额外 Commit 或额外文件；
- 合并提交中每个目标文件的存在状态及正文摘要分别与 `afterState`、`afterDigest` 一致；
- 必需 CI 为成功，且 `pipelineSha` 等于已验证的 MR 最终提交头；
- 执行发布前重新读取目标分支；即使分支因无关文件前进，所有冻结文件仍须与交付包一致，并保存本次 `verifiedTargetHeadSha`；
- 当前基线没有被其他平台发布替换；
- 当前用户具有 `publish:manage`。

### 7.6 GitLabWriteClient 接口

```text
getBranch(connection, branch, accessToken)
createBranch(connection, sourceBranch, ref, accessToken)
createCommit(connection, branch, commitMessage, actions, accessToken)
getCommit(connection, commitSha, accessToken)
findCommitByDeliveryMarker(connection, branch, deliveryId, packageDigest, accessToken)
createMergeRequest(connection, sourceBranch, targetBranch, title, description, accessToken)
getMergeRequest(connection, mergeRequestIid, accessToken)
getMergeRequestCommits(connection, mergeRequestIid, accessToken)
getMergeRequestChanges(connection, mergeRequestIid, accessToken)
getPipeline(connection, pipelineId, accessToken)
getPipelinesForCommit(connection, commitSha, accessToken)
getRepositoryFileAtCommit(connection, path, commitSha, accessToken)
```

## 8. GitLab 写回规则

### 8.1 身份与目标

- 以当前执行“创建 GitLab MR”动作的用户 OAuth 身份写入；
- 连接必须为 `purpose=read_write` 且 `writeEnabled=true`；
- 用户平台权限和 GitLab 远端权限必须同时满足；
- 项目、目标分支和允许路径来自手册映射；
- 客户端不能覆盖服务端计算结果。

### 8.2 命名与消息

- 分支名：`kc/<handbookId>/<taskId>-<candidateDigest前8位>`；
- Commit 标题：`docs(<handbookId>): <任务中文名称>`；
- Commit 正文：记录任务 ID、候选摘要、审核记录 ID、`Delivery-Id` 和 `Package-Digest` 确定性标记，不记录正文；
- MR 标题：使用任务名称；
- MR 描述：记录手册、业务版本、变更范围、审核结论、候选摘要和平台任务回链；
- MR 标签默认值由版本化连接策略配置，不在代码中硬编码。

### 8.3 原子提交

当前候选涉及的所有 Markdown 文件必须通过一次 GitLab Commits API 请求提交。任一文件转换或校验失败时不得创建 Commit。平台不调用 GitLab 合并 API。

## 9. 结构化变更映射

### 9.1 操作映射

| 平台操作 | GitLab Commit action | 说明 |
|---|---|---|
| `add` | `create` | 文件不存在且路径在映射范围内 |
| `update` | `update` | 校验文件 Blob、节点与 `beforeDigest` |
| `delete` | `delete` | 删除前确认目标仍与基线一致 |
| `move` | `delete + create` | 在同一个 Commit 中完成；正文保持一致，路径同时受控 |

### 9.2 服务端处理顺序

1. 从 `baseCommitSha` 读取受影响文件；
2. 按稳定节点定位结构化修改；
3. 校验文件 `blobId` 和节点 `beforeDigest`；
4. 按顺序应用 `add/update/delete/move`；
5. 重新解析 Markdown；
6. 校验 UTF-8、目录、相对链接、映射路径和文件扩展名；
7. 生成最终内容与 `afterDigest`；
8. 再次确认所有 actions 属于同一项目和目标分支；
9. 调用 GitLab Commits API。

首期只允许 `.md` 和 `.markdown`。图片、附件和其他二进制资源进入后续独立设计。

## 10. 并发与冲突处理

### 10.1 基线字段

创建任务或冻结候选时必须记录：

- `baseBranch`；
- `baseCommitSha`；
- 每个受影响文件的 `blobId`；
- 每个操作的 `beforeDigest`。

### 10.2 创建交付前复核

```text
if remoteHead == baseCommitSha:
    apply operations and commit
else if affected file blobIds are unchanged:
    replay operations on remoteHead
    effectiveBaseCommitSha = remoteHead
    commit
else:
    health = conflict
    stop
```

即使文件 Blob 未变化，应用操作时仍要重新校验节点 `beforeDigest`。任何不一致都记录为 `health=conflict`，不得采用最后写入覆盖。

### 10.3 冲突恢复

冲突状态只允许：

- 查看冲突文件、远端提交和受影响节点；
- 从最新基线创建修订任务；
- 重新生成、检查并审核新候选。

不允许修改原冻结候选后继续使用旧审核决定。

## 11. 分步处理、重复请求与失败恢复

这里的“分步处理”指分支、Commit、MR、验证和发布分别完成并记录结果；它不假设数据库和 GitLab 能够一次性同时成功。所谓“重复请求安全”，是指用户重复点击或网络重试时复用已有结果，不创建第二个分支、Commit 或 MR。

### 11.1 持久化步骤

```text
DELIVERY_CREATED
BRANCH_CREATED
COMMIT_CREATED
MR_CREATED
MR_MERGED
PUBLISH_READY
PUBLISHED
```

每一步完成后立即持久化远端资源标识和时间，再进入下一步。

### 11.2 重复请求的识别范围

```text
connectionId:taskId:candidateDigest
```

HTTP `Idempotency-Key` 是每次用户动作的唯一编号；上述业务范围用于保证同一候选不会产生多个交付。相同编号和相同请求返回原结果，相同编号对应不同请求返回 `IDEMPOTENCY_KEY_REUSED`。

### 11.3 重试规则

- 创建分支前调用 `getBranch`，存在且指向预期基线则复用；
- 创建 Commit 前先查询交付记录；已有 `commitSha` 时验证提交标记和文件清单后复用；
- `commitSha` 缺失时，必须用 `Delivery-Id + Package-Digest` 在来源分支查找远端提交；找到且文件清单一致则补记并复用，未找到且分支仍指向预期基线时才允许创建 Commit；
- 若找到标记相同但文件清单不一致的提交，或来源分支已经出现无法归属本交付的提交，进入冲突，不得继续重放 actions；
- 创建 MR 前查询同源分支的活动 MR，存在则复用；
- 网络超时后不得直接重复创建，必须先查询远端事实；
- `429` 尊重 GitLab `Retry-After`，不在同步请求中无限重试；
- OAuth 失效转为可恢复授权错误，不用服务账号兜底。

### 11.4 补偿边界

平台不自动删除已创建的分支、Commit 或 MR。远端资源可能已被人工查看或追加操作，自动删除会扩大故障影响。失败后保留引用、显示恢复动作并记录审计。

## 12. 权限与安全

### 12.1 权限交集

| 动作 | 平台权限 | GitLab 权限 | 其他条件 |
|---|---|---|---|
| 编辑和冻结候选 | `knowledge:write` | 读取映射范围 | 当前任务可编辑 |
| 审核通过或退回 | `review:manage` | 无写要求 | 审核人不能以提交者身份绕过隔离规则 |
| 创建 MR | `publish:manage` | 用户 OAuth 可推分支、创建 MR | 候选已批准，连接已启用写入 |
| GitLab 合并 | 不由平台授权 | GitLab 保护分支与审批规则 | 平台不提供合并按钮 |
| 发布正式版本 | `publish:manage` | 只需读取合并事实 | 状态为 `publish_ready` |

### 12.2 凭证安全

- OAuth Token 从加密凭证仓储按 `userId + connectionId` 读取；
- Token 只在单次 GitLab 请求生命周期内存在；
- Token 不进入数据库业务字段、日志、错误详情、前端和审计；
- 生产 GitLab 连接强制 HTTPS；
- 不允许管理员、服务账号或环境变量凭证替代用户 OAuth 完成业务写入。

### 12.3 GitLab 状态通知安全

- 每个连接使用独立 Secret；
- 使用恒定时间比较验证 Secret；
- 使用 GitLab 事件 UUID 去重；
- 限制 Content-Type、请求体大小和允许事件类型；
- 不信任事件中的项目地址，必须与连接配置和交付记录匹配；
- 原始状态通知正文不得写入普通业务日志。

### 12.4 错误语义

| 场景 | 错误码 | 中文提示 | 恢复动作 |
|---|---|---|---|
| OAuth 缺失或失效 | `GITLAB_REAUTH_REQUIRED` | GitLab 授权已失效 | 重新连接 GitLab |
| GitLab 拒绝写入 | `GITLAB_WRITE_FORBIDDEN` | 当前 GitLab 账号无写入权限 | 在 GitLab 申请权限 |
| 连接未启用写入 | `GITLAB_WRITE_DISABLED` | 当前仓库仅支持读取 | 联系平台管理员启用并验证 |
| 远端并发变化 | `GITLAB_DELIVERY_CONFLICT` | GitLab 内容已变化 | 创建修订任务 |
| GitLab 限流 | `GITLAB_RATE_LIMITED` | GitLab 请求过于频繁 | 稍后重试 |
| GitLab 暂时不可用 | `GITLAB_UNAVAILABLE` | GitLab 服务暂时不可用 | 保留进度后重试 |
| 合并内容不一致 | `GITLAB_MERGE_MISMATCH` | 合并内容与审核候选不一致 | 查看差异并重新审核 |

## 13. 状态通知与发布前检查

### 13.1 MR 合并验证

状态通知或主动刷新发现 MR 已合并后，主阶段先进入 `mr_merged`。服务端必须验证：

1. 项目、连接与 `mergeRequestIid` 匹配；
2. source 和 target 分支匹配；
3. MR 记录的最终来源分支头等于预期 `commitSha`，提交集合不存在未纳入冻结交付包的追加提交；
4. MR 的最终变更路径、动作和内容与冻结交付包完全一致，不能夹带额外文件；
5. `mergeCommitSha` 可从目标分支读取；
6. 合并提交中每个冻结文件的 `afterState` 和 `afterDigest` 均匹配；
7. `candidateDigest` 仍绑定已批准候选，按冻结规则重新计算的项目、目标分支和规范化文件清单整体摘要等于 `packageDigest`；
8. 必需 CI 为成功，且成功流水线的 SHA 等于 MR 最终来源分支头；
9. 当前平台发布基线仍然有效；
10. 当前事件尚未处理。

全部通过后才能进入 `publish_ready`。

### 13.2 CI 策略

连接策略声明 `requiredPipeline=true|false`。为 `true` 时，只有绑定到已验证 MR 最终来源分支头的 GitLab 成功终态才通过发布前检查；旧提交、其他分支或追加 Commit 之前的成功流水线均无效，`pending/running/failed/canceled/skipped` 均不得发布。策略必须版本化并记录到交付中，避免任务执行期间配置变化改变既有检查规则。

### 13.3 正式发布

发布动作必须在写入事务前重新读取 GitLab 目标分支，并逐一复核冻结文件的存在状态和正文摘要。目标分支仅有无关文件变化时允许继续，并把本次读取到的 HEAD 保存为 `verifiedTargetHeadSha`；任一冻结文件变化时设置 `health=content_mismatch`，退出 `publish_ready` 的可发布能力并要求创建修订任务，不能发布旧快照。

复核通过后，发布事务写入不可变版本、GitLab 来源记录和审计，并原子切换同一手册业务版本的 `current` 指针。GitLab 合并成功但平台发布失败时保持 `publish_ready`，允许重复请求安全地重试；每次重试仍须重新复核目标分支，不回滚 GitLab。

## 14. 前端页面与交互

页面位置：现有“审核与发布”任务详情页新增“GitLab 提交与发布”阶段卡。页面按主流程展示一个进度条，异常结果在当前阶段卡内就地说明；不另开一套状态中心。

```text
┌─────────────────────────────────────────────────────────────┐
│ 文档任务：数据库连接说明      审核已通过                    │
│ 审核 ✓ ── 提交中 ── MR待合并 ── 合并验证 ── 待发布 ── 已发布 │
├─────────────────────────────────────────────────────────────┤
│ GitLab 提交与发布                                           │
│ 仓库 cod-doc/yasdoc   变更 3 个 Markdown 文件               │
│ 候选摘要 sha256…   来源分支 kc/DB-001/inc_xxx-ab12cd34      │
│                                                             │
│ [创建 GitLab MR]                                            │
│                                                             │
│ 异常时：授权已失效。请重新连接 GitLab。 [重新连接]          │
│ 辅助：查看变更文件 · 刷新状态 · 打开 MR                     │
└─────────────────────────────────────────────────────────────┘
```

各阶段只保留一个主要动作，并始终显示文字状态、更新时间和下一步：

| 页面阶段 | 主按钮 | 必须展示的信息 | 异常时的就地恢复 |
|---|---|---|---|
| 审核已通过 | 创建 GitLab MR | 目标仓库、目标分支、文件数、候选摘要 | 写入未启用时显示原因和连接管理员入口 |
| 正在提交 | 无（显示进度） | 当前步骤：分支/Commit/MR，开始时间 | 超时提示“正在确认远端结果”，确认后再显示重试 |
| MR 待合并 | 打开 MR | MR 地址、提交摘要、CI 状态、最近同步时间 | MR 关闭或 CI 失败时显示查看差异/流水线 |
| 合并验证 | 无（显示验证中） | 合并提交、文件摘要比对、CI 结果 | 内容不一致时显示差异和“创建修订任务” |
| 待发布 | 发布正式版本 | 所有发布前检查及通过时间 | 发布失败显示“重试发布”，不回到审核 |
| 已发布 | 查看正式版本 | 版本号、发布时间、MR、合并人、来源记录 | 仅允许查看，不提供回写操作 |

移动端将阶段卡改为纵向排列，按钮点击区域不小于 44px；成功、进行中、失败除颜色外均使用中文文字和图标表达。错误提示使用可被读屏器播报的提示区域，并提供明确恢复按钮。页面刷新或重新进入任务时，优先读取服务端已保存进度，不重复发起创建动作。

GitLab MR 和 CI 由系统验证并只读展示，不要求用户手工登记。通用人工证据可保留为补充附件，但不得改变 MR、CI、合并或发布结果。

## 15. 可观测性与审计

### 15.1 审计事件

- `GITLAB_DELIVERY_CREATED`
- `GITLAB_BRANCH_CREATED`
- `GITLAB_COMMIT_CREATED`
- `GITLAB_MR_CREATED`
- `GITLAB_MR_STATUS_CHANGED`
- `GITLAB_MERGE_VERIFIED`
- `GITLAB_DELIVERY_FAILED`
- `PLATFORM_VERSION_PUBLISHED`

审计至少记录 `taskId`、`deliveryId`、`connectionId`、操作人、远端资源标识、结果和时间；不记录 Token 或正文。

### 15.2 指标

- MR 创建成功率与阶段耗时；
- GitLab API 错误率、超时率和限流次数；
- 重复请求复用次数；
- 冲突率；
- GitLab 状态通知接收、延迟、验签失败和去重数量；
- MR 创建到合并耗时；
- 合并到正式发布耗时。

结构化日志只记录任务、交付、MR IID、Commit SHA 的短摘要和关联 ID，不记录正文、Token 或完整外部响应。

## 16. 迁移与兼容

1. 历史已发布版本保持只读，不要求补建 MR。
2. 旧任务没有 `delivery` 时继续可读；启用新的发布前检查后，人工 GitLab MR 证据不能使旧任务进入 `publish_ready`。
3. 新能力通过连接级 `writeEnabled` 启用；默认值为 `false`。
4. `purpose=read_write` 只表达写入意图，不能替代真实 GitLab 权限验证。
5. 未启用写入时，界面显示“当前仓库仅支持读取”。
6. 现有人工外部证据保留为历史兼容和通用附件，不再是 GitLab 交付事实源。
7. 首期不引入本地 Git 工作区或独立 GitOps 服务。

## 17. 核心伪代码

### 17.1 创建 GitLab 交付

```text
function createGitLabDelivery(session, taskId, httpIdempotencyKey):
  require session has publish:manage
  task = load task for update
  require task.state == approved or
          (task.state == mr_preparing and delivery.health is recoverable)
  require frozen candidate and approved review

  mapping, connection = resolve server-side handbook mapping
  require connection purpose == read_write and writeEnabled
  token = load encrypted OAuth token(session.user.id, connection.id)

  package = freezeDeliveryPackage(task, mapping)
  scope = connection.id + ":" + task.id + ":" + package.candidateDigest
  if delivery exists for scope:
    require same package digest
    return resumeOrReturn(delivery)

  persist delivery(step=DELIVERY_CREATED, state=mr_preparing)
  remoteHead = gitlab.getBranch(package.baseBranch)
  effectiveBase = verifyOrRebase(package, remoteHead)

  branch = gitlab.getBranch(sourceBranch)
  if branch missing:
    branch = gitlab.createBranch(sourceBranch, effectiveBase)
  else require branch belongs to this delivery
  persist step=BRANCH_CREATED

  actions = applyStructuredOperations(package, effectiveBase)
  if commitSha missing:
    commit = gitlab.findCommitByDeliveryMarker(
      sourceBranch, delivery.id, package.packageDigest)
    if commit exists:
      require verifyCommitFileManifest(commit.sha, package)
    else:
      require gitlab.getBranch(sourceBranch).headSha == effectiveBase
      commit = gitlab.createCommit(sourceBranch, message with delivery markers, actions)
  else:
    commit = gitlab.getCommit(commitSha)
    require verifyCommitFileManifest(commit.sha, package)
  persist step=COMMIT_CREATED, commitSha=commit.sha, sourceHeadSha=commit.sha

  mr = find active MR for sourceBranch and targetBranch
  if mr missing:
    mr = gitlab.createMergeRequest(sourceBranch, targetBranch, title, description)
  persist step=MR_CREATED, state=mr_open, mr identifiers
  audit GITLAB_MR_CREATED
  return delivery projection
```

### 17.2 应用结构化变更

```text
function applyStructuredOperations(package, effectiveBase):
  group operations by file path
  actions = []
  for each file:
    require path is under mapped roots
    require extension is Markdown
    remote = read file at effectiveBase when required
    require remote blob/node digest matches package before state
    ast = parse Markdown on server
    ast = apply add/update/delete/move by stable node id
    content = render deterministic Markdown(ast)
    validate UTF-8, links, path and directory rules
    require digest(content) == package expected after digest
    append GitLab create/update/delete actions
  return actions
```

### 17.3 处理 GitLab 状态通知

```text
function handleMergeRequestWebhook(connectionId, headers, rawBody):
  connection = load connection
  verify secret with constant-time comparison
  eventId = require GitLab event UUID
  if eventId already processed: return accepted
  event = parse bounded JSON body

  delivery = find by connection, project and MR IID
  if delivery missing:
    audit unmatched event without raw body
    mark event processed
    return accepted

  verify project, source branch and target branch
  update remote status projection
  if MR closed without merge: set delivery.health = mr_closed
  if MR merged:
    transition mr_merged
    enqueue or execute merge verification
  mark event processed atomically with state update
  return accepted
```

### 17.4 发布已合并候选

```text
function publishMergedCandidate(session, taskId, idempotencyKey):
  require session has publish:manage
  task = load task for update
  require task.state == publish_ready
  package = loadFrozenDeliveryPackage(delivery.id)
  require delivery merge verification passed
  require required pipeline passed
  require current platform baseline still matches

  targetHead = gitlab.getBranch(delivery.baseBranch)
  require verifyFrozenFileManifest(package, targetHead.sha)
  persist verifiedTargetHeadSha=targetHead.sha, verifiedAt=now

  in one repository transaction:
    create immutable publication with gitlabSource
    mark old current version false
    mark new version current
    transition task to published
    persist PUBLISHED delivery step
    append audit
  return publication
```

## 18. 测试设计与验收标准

### 18.1 单元测试

- 主流程只允许本文定义的六个阶段迁移；异常结果必须记录原因和恢复动作；
- `add/update/delete/move` 正确映射 GitLab actions；
- 分支名、Commit 消息和候选摘要稳定；
- 候选摘要、交付包摘要和逐文件摘要各自按定义计算，禁止互相替代；
- Commit 响应丢失后可通过确定性标记恢复，重试不产生第二个 Commit；
- 路径越界、非 Markdown 和非法 UTF-8 被拒绝；
- 平台权限、连接能力和 OAuth 权限分别校验；
- GitLab 状态通知的 Secret、请求体限制和事件 UUID 去重有效；
- GitLab `401/403/409/429/5xx` 正确分类；
- 未验证 MR 或 CI 不能进入 `publish_ready`；
- MR 追加 Commit、夹带文件或使用旧 SHA 的成功流水线均不能进入 `publish_ready`；
- 进入 `publish_ready` 后目标分支再次修改冻结文件时禁止发布，无关文件变化允许发布并记录复核 HEAD。

### 18.2 接口一致性测试

- Branch、Commit、MR、Pipeline 和文件 API 请求符合 GitLab API v4；
- 超时后先查询远端事实再重试；
- Commit API 已成功但响应丢失时能够补记原 Commit，不重复执行 actions；
- 相同任务和候选版本不会创建第二个 MR；
- MR 最终提交头、变更路径、文件内容和流水线 SHA 均与冻结交付包一致；
- MR 关闭、重开、合并和 Pipeline 状态能正确同步到交付记录；
- 前端响应不包含 Token、状态通知 Secret 和完整外部错误正文。

### 18.3 真实 API 验收

涉及后端行为和端到端流程，必须使用隔离 GitLab 测试项目真实调用：

1. 通过知识中心真实后端 API 创建任务、冻结候选并完成审核；
2. 以用户 OAuth 创建真实分支、Commit 和 MR；
3. 验证重复请求不创建第二个 MR；
4. 人为制造 Commit API 成功但客户端超时，验证恢复原 Commit 且不重复 actions；
5. 验证默认分支前进但相关文件未变时可以安全重放；
6. 验证同一文件变化时记录 `health=conflict` 并停止提交；
7. 验证 MR 追加 Commit、夹带额外文件或流水线 SHA 不匹配时不能进入待发布；
8. 验证 MR 关闭、Pipeline 失败和 OAuth 撤销不能进入待发布；
9. 验证伪造和重复状态通知不改变业务状态；
10. 人工合并 MR 后验证状态通知、逐文件摘要、交付包摘要和发布前检查；
11. 验证 MR 合并前禁止发布；进入待发布后再次修改冻结文件同样禁止发布，无关文件变化不阻断但会记录新 HEAD；
12. 以发布角色生成正式版本并反查 MR、Commit、审核人与发布人。

### 18.4 用户验收

- 用户无需离开平台即可创建 MR；
- 用户无需填写项目、分支名、Commit SHA 或 MR 地址；
- 系统不直接写默认分支、不自动合并、不自动发布；
- GitLab 未合并或合并内容不一致时绝不发布；
- 每个异常结果都有明确中文原因和恢复动作；
- 正式版本可以一键打开对应 MR 并查看完整版本来源记录。

## 19. 配置、依赖与实施边界

### 19.1 版本化配置

连接策略至少包含：

```text
writeEnabled
requiredPipeline
mergeRequestLabels[]
webhookSecretRef
maxChangedFiles
maxCommitPayloadBytes
policyVersion
```

Secret 只保存引用。标签、阈值和错误恢复策略不得散落硬编码；暂时无法配置化的内容必须登记到待办文档。

### 19.2 前置依赖

- GitLab API v4 可用；
- 用户 OAuth 具备创建分支、Commit 和 MR 所需最小权限；
- GitLab 项目保留保护分支和人工审批规则；
- 每本手册已配置唯一项目、目标分支和允许路径；
- GitLab 状态通知能访问知识中心受控入口；
- 隔离测试项目和可撤销测试账号可用。

### 19.3 完成定义

本文档批准只表示设计边界冻结。功能完成必须同时满足：代码与配置实现、单元和接口一致性测试通过、隔离 GitLab 真实 API 验收通过、安全审查通过、文档和运行手册同步、测试报告记录真实证据。任何模拟结果都不能代替真实写入验收。
