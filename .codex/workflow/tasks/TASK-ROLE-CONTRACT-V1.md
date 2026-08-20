# TASK-ROLE-CONTRACT-V1: 统一角色契约并优化角色定义

## 元信息

- 状态: ready_for_test
- 分配: codex（单线执行，不使用多角色编排）
- 创建: 2026-08-20
- 预计完成: 2026-08-20
- 依赖: `TASK-RAG-AUTONOMY-PLAN-01`、Independent Reviewer 契约
- 需人类确认: 已由用户授权按角色评价结论优化；运行时强制、历史状态迁移和 Policy 存放位置仍需后续审批
- 可并行: 否，本轮按设计 -> Role -> Skill 候选论证 -> 验收串行执行

## 目标与非目标

为 `.codex/roles/` 中九个项目团队角色建立 Role Contract v1，并识别适合下沉到 `.codex/plugins/` 的候选 Skill、装载规则和晋级门禁。Skill 尚未通过论证前，Role 必须保持独立可执行。

本任务仅修改设计和角色文档，不修改业务代码、公共 API 或工作流运行时，不声称状态机和策略校验已自动执行。

## SMART 任务

| 任务 | 文件归属 | 时限 | 可量化验收 |
|---|---|---:|---|
| `ROLE-V1-DES-01` 契约与状态机设计 | `agent-runner/docs/39-Role-Contract-v1与角色治理设计.md`、`agent-runner/docs/README.md` | 3h | 包含元数据、输入/结果信封、状态机、权限矩阵、伪代码、兼容和失败语义 |
| `ROLE-V1-BASE-01` 公共角色规范 | `.codex/roles/README.md` | 2h | 定义公共章节、稳定 roleId、输入/结果契约和状态所有权 |
| `ROLE-V1-SKILL-DES-01` Skill 候选与装载论证 | `agent-runner/docs/39-Role-Contract-v1与角色治理设计.md` | 3h | 给出职责下沉判定、候选 Skill 地图、触发/组合/降级逻辑、评估样本和晋级门禁；不生成 Plugin/Skill 实体 |
| `ROLE-V1-GOV-01` 治理角色优化 | `planner.md`、`project-manager.md`、`reporter.md` | 3h | Planner/PM/Reporter 无重复事实写权，Reviewer 进入 RACI |
| `ROLE-V1-DEL-01` 交付角色优化 | `architect.md`、`backend-worker.md`、`frontend-worker.md`、`doc-writer.md` | 4h | 命名统一，Worker 不自报完成，数值阈值不硬编码 |
| `ROLE-V1-QA-01` 保障角色优化 | `test-engineer.md`、`independent-reviewer.md` | 3h | 真实 API 与单测替身语义无冲突，验证权与审查权分离 |
| `ROLE-V1-VAL-01` 一致性验收 | 只读 | 2h | 九个角色通过契约清单、名称/状态/阈值搜索和 `git diff --check` |

## 验收标准

- [x] 九个角色都引用 Role Contract v1 并具有稳定 `roleId`。
- [x] Role 保留当前执行所需的最小流程；只将经评估证明稳定、复用且有净收益的内容候选为 Skill。
- [x] 文档明确将来候选 Skill 存放于 `.codex/plugins/`，但本轮不创建 Plugin、Skill、Marketplace、MCP 或外部依赖。
- [x] 不存在 `Architecture Designer`、`Config Worker` 等漂移名称。
- [x] Worker 只能请求 `ready_for_test`，Test Engineer 输出 `verified/rejected`，PM 接受，Reporter 只投影。
- [x] 角色 Prompt 不保存性能、覆盖率、时延、重试和抽样数值。
- [x] 每个角色明确输入缺失、越权、验证失败和需人工决策时的处理。
- [x] Independent Reviewer 的独立、只读、政策依据和两轮升级边界不退化。
- [x] 文档明确区分规范试行与运行时实现，`git diff --check` 通过。

## 执行日志

- 2026-08-20: Planner 完成 Role Contract v1、状态所有权和九角色优化的 SMART 拆解。
- 2026-08-20: 用户要求不使用多角色能力，并提出评估可复用职责未来是否适合下沉；任务调整为单线执行。
- 2026-08-20: 用户明确 Skill 尚未论证，本轮只产出候选和装载/晋级逻辑；已移除误创建的 Plugin 脚手架。
- 2026-08-20: 完成九个角色契约和职责优化；九个 `roleId` 与契约引用齐全，漂移名称/越权完成声明/数值阈值搜索无命中，`.codex/plugins/` 无新增文件，`git diff --check` 通过。产出者仅请求 `ready_for_test`，未自行声明独立验证或接受。
