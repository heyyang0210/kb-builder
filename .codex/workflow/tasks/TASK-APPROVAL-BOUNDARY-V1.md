# TASK-APPROVAL-BOUNDARY-V1: 统一人工审批边界

## 元信息

- 状态: ready_for_test
- 分配: codex（单线执行）
- 创建: 2026-08-21
- 依赖: `TASK-ROUTING-CONTRACT-V1`
- 需人类确认: 本轮规则内容由用户明确要求；审批人、授权有效期和运行时实现后续确认

## 目标

建立项目级单一审批事实源，明确默认无需审批、必须审批和不确定项的判断规则，并同步到 `AGENTS.md` 与相关角色。

## 文件归属

- `agent-runner/docs/41-Approval-Boundary-v1人工审批边界.md`
- `agent-runner/docs/40-Task-Routing-Contract-v1与最小角色路径设计.md`
- `agent-runner/docs/39-Role-Contract-v1与角色治理设计.md`
- `agent-runner/docs/38-独立质询审查者与门禁设计.md`
- `agent-runner/docs/README.md`
- `AGENTS.md`
- `.codex/roles/README.md`
- `.codex/roles/architect.md`
- `.codex/roles/planner.md`
- `.codex/roles/project-manager.md`
- `.codex/roles/backend-worker.md`
- `.codex/roles/frontend-worker.md`
- `.codex/roles/test-engineer.md`
- `.codex/roles/independent-reviewer.md`
- `.codex/workflow/tasks/TASK-APPROVAL-BOUNDARY-V1.md`
- `prompt.md`

## 非目标

- 不实现审批 API、UI、持久化、超时或自动阻断。
- 不指定具体审批人、授权有效期或跨任务复用规则。
- 不修改业务代码、公共 API 或运行数据。

## 验收标准

- [x] 默认授权清单可以直接指导低风险任务继续执行。
- [x] 强制审批清单覆盖产品、架构、契约、依赖、安全、数据、不可逆操作、资源承诺和风险接受。
- [x] 不确定项按证据判定，不能用模型猜测替代审批。
- [x] 已有批准只覆盖明确范围，范围扩大时重新判断。
- [x] AGENTS、公共契约和相关角色引用同一审批事实源。
- [x] 文档明确规则尚未由运行时强制执行。

## 自检证据

- `git diff --check` 对本任务文件集合执行通过。
- 旧口径检查未发现“性能/安全相关改动一律审批”等残留规则。
- Approval Boundary、Task Routing Contract 和 Role Contract 的引用目标均存在。
- 本轮只修改文档和角色配置，未运行与业务代码相关的后端 API 测试。
- 上下文负载修正：基础任务不要求加载全部角色和审批全文，专项文档按路由和风险信号按需读取。
- 路由精简为“直接处理 / 标准开发 / 治理任务”；Bugfix 按实际复杂度归入前两条路径，只有命中人工边界时治理。
- 用户明确提出的功能默认视为产品范围已授权；G0-G4 和完整状态机仅用于治理任务。
- 全局“先设计”和真实 API 要求已按任务影响收窄；普通标准开发不默认启动 Project Manager。
