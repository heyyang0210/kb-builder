# TASK-ROUTING-CONTRACT-V1: 建立最小充分角色路由

## 元信息

- 状态: ready_for_test
- 分配: codex（单线执行，不启动多角色）
- 创建: 2026-08-20
- 最近修订: 2026-08-21
- 预计完成: 2026-08-20
- 依赖: `TASK-ROLE-CONTRACT-V1`
- 需人类确认: 自动编排运行时实现、路由 Policy 存放位置和自动晋级条件需后续审批
- 可并行: 否

## 目标

在任务与九个项目团队角色之间增加 Task Routing Contract。默认选择能完成任务的最小执行路径，只有职责分离、风险、范围或证据要求出现时才增量启用角色。

## 文件归属

- `agent-runner/docs/40-Task-Routing-Contract-v1与最小角色路径设计.md`
- `agent-runner/docs/README.md`
- `agent-runner/docs/39-Role-Contract-v1与角色治理设计.md`
- `.codex/roles/README.md`
- `.codex/roles/architect.md`
- `.codex/roles/project-manager.md`
- `AGENTS.md`
- `prompt.md`
- `.codex/workflow/tasks/TASK-ROUTING-CONTRACT-V1.md`

## 非目标

- 不实现自动路由器、状态机或 Policy 加载器。
- 不创建、安装或搜索 Plugin/Skill。
- 不合并或删除现有九个角色。
- 不修改业务代码、公共 API 或运行数据。

## 实施顺序

1. 定义路由分级、输入/输出接口、决策矩阵和升级伪代码。
2. 更新工作空间编排入口，废止“每个高层需求固定启动全部角色”的语义。
3. 更新角色公共契约和设计文档导航。
4. 记录用户纠偏，执行链接、术语和补丁格式检查。

## 验收标准

- [x] L0/L1 直接路径和 L2/L3 角色路径边界明确。
- [x] 路由由任务类型、影响模块、变更范围、风险和不确定性共同决定。
- [x] 每增加一个角色都能说明独立职责或证据增益。
- [x] 简单任务不创建虚假的 `verified/accepted` 多角色状态。
- [x] 架构、公共 API、外部依赖、安全、性能承诺和破坏性变更不能走直接路径。
- [x] 总目标明确为人类治理下的边界自治，不宣称完全自动化开发。
- [x] 跨模块不是 L3 充分条件；契约稳定、可回退且可独立验证时可走 L2。
- [x] 治理交付明确 AI 准备证据、人类决定受限事项、AI 在批准范围内执行。
- [x] 路由不确定时升级，不以文件数量单独判定简单任务。
- [x] 路由责任与 Agent 绑定分离，关键事实包含来源和已知/未知/冲突状态。
- [x] L0/L1 定义 `DirectTaskResult`；L2/L3 角色执行绑定 `routeDecisionId`，不混淆自检与独立验证。
- [x] 重新路由记录新的 `routeDecisionId`、已完成动作和升级原因，旧决策不覆盖。
- [x] 文档明确当前仅为人工执行契约，未宣称自动路由已实现。
- [x] 目录 README 和用户纠偏记录同步，`git diff --check` 通过。

## 自检证据

- 九个角色在 `AGENTS.md` 和 `.codex/roles/README.md` 中均完整列出。
- 固定 `spawn` 多角色流程搜索无命中，L0/L1 结果被限制为直接结果或 `self_checked`。
- 设计中的输入、输出、路径矩阵、红线、伪代码和校准章节齐全，所有新增本地链接目标存在。
- 目标文件执行 `git diff --check` 通过；未运行自动编排或业务 API 测试，因为本轮未实现运行时代码。
- 当前仍未实现路由运行时、事件存储或 Policy 加载器；本次只完成最小可执行设计契约。
