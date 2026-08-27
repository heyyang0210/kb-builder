# Role Contract v1 与角色治理设计

> 版本：V1.0
> 日期：2026-08-21
> 状态：G1 设计试行；本轮不使用多角色编排，运行时强制尚未实现

## 1. 目标与非目标

本设计先将 `.codex/roles/` 从长短不一的自然语言提示词，收敛为稳定且可独立执行的 Role Contract。Role 回答凭什么开始、只能做什么、交付什么证据、由谁宣布完成；重复的工作方法仅作为 Skill 候选，经过任务样本论证和人工批准后才考虑实现与装载。

本阶段不实现 JSON Schema、编排器强制、Policy 配置或历史任务迁移，也不改变现有 Workflow 引擎的运行状态。

Role Contract 只约束角色被启用后的权限和证据，不要求每个任务实例化全部角色。任务先按 [Task Routing Contract v1](./40-Task-Routing-Contract-v1与最小角色路径设计.md) 选择直接处理、标准开发或治理任务；下述完整接口和状态机仅适用于治理任务。

## 2. 设计原则

1. **职责正交**：计划、实施、验证、审查、接受和报告不得由同一角色自证闭环。
2. **最小权限**：任务中的 `allowedFiles` 和审批引用优先于角色的概括性目录。
3. **证据优先**：角色只能请求状态迁移，不能仅用自然语言声称完成。
4. **策略外置**：性能、覆盖率、时延、重试、抽样等数值从已批准 Policy 加载。
5. **失败可恢复**：输入缺失、越权、验证失败和需人决策都有确定终态或升级目标。
6. **角色少而稳定**：先修正契约和工具能力，不为单一问题继续增加角色。

## 3. Role Contract v1 接口

### 3.1 契约元数据

```yaml
roleId: backend-worker
displayName: Backend Worker
contractVersion: role-contract@1
roleVersion: 1.0.0
status: pilot
owns: [backend-implementation, self-test-evidence]
doesNotOwn: [architecture-approval, verification, acceptance]
```

`roleId` 是编排和证据关联的稳定标识；文档标题中的中英文名称不得作为机器标识。

### 3.2 执行上下文

```yaml
taskId: TASK-...
runId: run-...
routeDecisionId: route-...
roleId: backend-worker
roleVersion: 1.0.0
contextId: context-...
policyVersion: role-policy@...
inputArtifactIds: []
allowedFiles: []
approvalRefs: []
responsibilityBindingRef: binding-...
```

必需输入缺失时返回 `blocked`，不得自行补造产品、架构或审批事实。

### 3.3 结果信封

```yaml
taskId: TASK-...
runId: run-...
routeDecisionId: route-...
roleId: backend-worker
roleVersion: 1.0.0
policyVersion: role-policy@...
outcome: succeeded | failed | blocked | needs_decision
requestedTransition: ready_for_test
changedArtifactIds: []
evidenceIds: []
commands:
  - {command: npm-test, exitCode: 0, evidenceId: evidence-command-id}
knownRisks: []
unresolvedItems: []
escalationTarget: null
supersedes: null
```

`requestedTransition` 是请求，不是角色对任务事实状态的直接覆写。

治理任务的角色结果必须关联有效的 `routeDecisionId` 和责任绑定引用。标准开发只报告实际产物和验证证据，不调用本结果信封，也不能将执行者自检表述为独立验证。

## 4. 治理任务状态机

普通标准开发不使用本状态机，只执行“设计检查 -> 实施 -> 验证”。

```text
draft -> pending -> in_progress -> ready_for_test
ready_for_test -> verified | rejected
verified -> accepted

draft | pending | in_progress | ready_for_test | rejected
  -> blocked
blocked -> 原状态 | rejected | cancelled
```

| 迁移 | 唯一责任方 |
|---|---|
| 创建 `draft` | Planner |
| `draft -> pending` | Project Manager（G2 准入） |
| 请求 `pending -> in_progress` | 被分配 Worker |
| 请求 `in_progress -> ready_for_test` | 被分配 Worker |
| `ready_for_test -> verified/rejected` | Test Engineer |
| `verified -> accepted` | Project Manager；受限决策由 Product Owner 批准 |
| 登记/解除 `blocked` | Project Manager 依据证据、门禁或审批结论 |
| 状态投影 | Reporter 只读事实源 |

Independent Reviewer 的 `hold/stop/escalate` 是审查状态，不等同于任务状态；由 Project Manager 根据有效审查结果投影为任务 `blocked` 或保持原状态。

### 4.1 兼容边界

文档规范中可将历史 `completed` 理解为 `accepted` 的兼容别名，但本阶段不批量改写历史任务，也不修改当前 Workflow 引擎的 `completed` 语义。

## 5. 权限和交付边界

| 角色组 | 允许的核心写入 | 禁止事项 |
|---|---|---|
| Architect | 需求、设计、契约和伪代码 | 不排期，不接受自己的受限决策 |
| Planner | 任务图、`draft` 任务卡、依赖与文件归属 | 不写进度事实，不批准任务 |
| Project Manager | 计划基线、门禁、风险、任务事实状态 | 不替代 Worker 实现或 Test Engineer 验证 |
| Worker / Doc Writer | `allowedFiles` 内产物和自测证据 | 不自报 `verified/accepted/completed` |
| Test Engineer | 测试设计、测试代码、验证证据与 `verified/rejected` | 不改产品契约来让测试通过 |
| Independent Reviewer | 独立质疑记录 | 不改待审产物，不直接写任务状态 |
| Reporter | 进度、风险和下一步的投影文档 | 不创造状态、计划、验收或风险裁决 |

## 6. 测试证据分层

- 单元测试允许受控替身以隔离外部依赖，但不得作为治理任务的正式后端验收证据。
- 治理任务的正式后端验收必须调用真实启动的后端 API，记录请求、响应、环境和证据 ID。
- 外部第三方服务可在开发测试中使用契约沙箱，但必须存在独立的真实联通验证。
- 覆盖率、时延、性能和重试阈值由当期 `policyVersion` 给出；策略缺失时不伪造默认数值。

## 7. 失败和升级伪代码

```text
function executeRole(context, contract, policy):
    if not isActiveRouteDecision(context.routeDecisionId, context.responsibilityBindingRef):
        return blocked("stale-or-unbound-route", "router-or-project-manager")
    if not validateRequiredInputs(context, contract):
        return blocked("missing-required-input", contract.escalationTarget)
    if not isApprovedPolicy(policy, context.policyVersion):
        return blocked("missing-or-unapproved-policy", "project-manager")
    if not requestedWritesWithin(context.allowedFiles):
        return blocked("permission-boundary", "project-manager")

    result = performOwnedWork(context, policy)
    evidence = collectEvidence(result)
    if result.needsRestrictedDecision:
        return needsDecision(evidence, "product-owner")
    if result.failed and not policyAllowsRetry(result.failureClass):
        return failed(evidence, contract.escalationTarget)
    return requestTransition(result, evidence)

function acceptTask(task, verification, reviews, approvals):
    assert verification.decision == "verified"
    assert noUnresolvedPolicyBlock(reviews)
    assert allRequiredApprovalsPresent(approvals)
    return transition(task, "accepted")
```

## 8. Plugin 与 Skill 候选论证

这些角色共同组成整个项目开发团队。下表是候选 Skill 地图，不代表已决定创建、已安装或已可装载。如果论证通过，建议将项目专用 Skill 统一放入 `.codex/plugins/<approved-plugin>/skills/`，不为每个角色建立独立 Plugin。

| Skill | 主要角色 | 装载时机 | 不放在 Role 的原因 |
|---|---|---|---|
| `design-project-change` | Architect | 项目需求定义、方案比较、接口/伪代码设计 | 设计步骤和项目检查清单会持续演进 |
| `plan-smart-work` | Planner | 高层需求拆任务图、依赖和文件归属 | SMART 拆解是方法，不是 Planner 的权限本身 |
| `govern-delivery-gates` | Project Manager | DoR/DoD、G0-G4、风险、变更和接受 | 门禁操作流程可独立版本化 |
| `deliver-backend-change` | Backend Worker | Node.js/Python 后端实施、自测和证据交付 | 工程检查清单不应占用常驻 Role 上下文 |
| `deliver-chinese-frontend` | Frontend Worker | 中文前端、真实 API 联调、响应式和视觉验收 | 框架与验证方法属可替换流程 |
| `verify-project-change` | Test Engineer | 测试设计、真实后端 API、回归；RAG/图谱/资料加工按任务加载领域验收 | 测试分层和证据采集需独立演进 |
| `sync-change-documentation` | Doc Writer；Worker 条件装载 | 代码、目录、API 或用户行为变化 | 文档分类、交叉引用和 README 同步是可复用流程 |
| `report-workflow-evidence` | Reporter | 生成进度、日报、风险和下一步投影 | 聚合和防夸大规则属报告方法 |
| `challenge-delivery-claims` | Independent Reviewer | 风险触发或人工明示启动的独立反证 | Profile、反例和证据检查清单应与审查权限分离 |

### 8.1 职责下沉判定

一段 Role 内容只有同时满足以下条件才候选为 Skill：在多类任务中重复出现；是“如何做”而非“有权做什么”；能定义触发、输入、输出和失败语义；能用代表任务评估；从 Role 移出后不会丢失权限、状态或人工审批边界。

不得下沉：`roleId`、owns/doesNotOwn、写权、审批权、任务状态迁移权、人机决策边界、只读独立性和安全红线。

### 8.2 未来装载逻辑

1. 先根据 `roleId + taskType + affectedModule + riskClass` 匹配候选 Skill，再校验 Skill 版本、适用范围和批准状态。
2. 团队通用 Skill 提供方法；RAG、图谱、资料加工、大纲等领域 Skill 仅在 `affectedModule` 命中时组合装载。
3. 同时匹配多个 Skill 时，按“治理契约 -> 团队方法 -> 领域方法 -> 工具操作”的顺序组合，冲突时以 Role 权限和已批准 Policy 为准。
4. Skill 缺失时，在候选阶段继续执行 Role 中现有最小流程；只有将来明确标记为已批准 `requiredSkill` 后，缺失才返回 `blocked`。

### 8.3 候选 Skill 晋级门禁

每个候选至少需要：具体触发样例与反例；基线 Role 执行结果；脱敏的成功、失败、边界任务集；输出契约；权限审查；前后对照的成功率、证据完整率、返工、成本和时延；未触发和误触发检查；人工批准与回退点。未证明比 Role 内置流程更稳定或更省上下文，不得生成或安装。

## 9. 角色与 Skill 演进机制

角色不按文档长度或问题数量评价，而按越权率、证据缺失率、返工率、人工推翻率、任务通过率、成本和时延评价。新版本须经历失败样本回放、影子运行、人工审批和可回退发布。

RAG、知识图谱、资料加工、大纲管理等具体业务知识仅作为可替换上下文，应位于 Skill `references/` 或现有领域 Skill，不应成为所有团队角色的常驻提示。

Skill 按触发准确率、任务成功率、证据完整率、返工、成本和时延单独评价；Role 按越权率、状态误用率和人工推翻率评价。Skill 变更不应要求同步改写 Role，除非触发或权限契约发生变化。

## 10. 风险与验收

1. 规范状态与现有 Workflow 状态并存：文档必须持续标记“未实现运行时强制”。
2. Reporter 只读不等于不能写报告：它可写投影文档，但投影的计划与风险必须来自 PM 已批准事实。
3. Policy 尚未实现：角色仅声明参数来源，不自行创建默认数值。
4. 九个角色文件必须具有稳定 ID、所有权、DoR、权限、输出、证据、迁移和失败升级；在 Skill 通过论证前保持独立可执行。
5. 本轮 `.codex/plugins/` 下不存在未批准的 Plugin/Skill 产物。
6. 命名漂移、幽灵角色、Worker 自报完成和数值阈值硬编码搜索结果为零，`git diff --check` 通过。
