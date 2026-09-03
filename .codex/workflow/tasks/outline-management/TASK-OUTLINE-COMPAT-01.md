# TASK-OUTLINE-COMPAT-01：管理员手册大纲兼容演进总任务

## 元信息

- 状态：pending
- 负责：project-manager
- 执行：doc-writer / backend-worker / frontend-worker / test-engineer
- 创建：2026-08-17
- 计划：P1 至 P5 共 10 个工作日，不含审批等待
- 依赖：`TASK-UPLOAD-SPEC-01`、`TASK-UPLOAD-SPEC-02`
- 需人类确认：P2、P4 及外部依赖、安全、性能、公共 API 变更

## SMART 目标

按模块计划依次完成 P1 至 P5，使管理员手册标题树能够被安全转换、诊断、预检、确认和上传；最终做到 0 知识点误成功为 0、静默丢失为 0、诊断可定位率 100%，并形成可版本化演进的评分与规则治理能力。

## 执行入口

- 产品需求：`../../../requirements/modules/outline-management/REQ-OUTLINE-COMPATIBILITY.md`
- 项目计划：`../../modules/outline-management/PLAN.md`
- 模块进度：`../../modules/outline-management/PROGRESS.md`
- 阶段任务：本目录下 `TASK-OUTLINE-EVOLUTION-P1.md` 至 `TASK-OUTLINE-EVOLUTION-P5.md`
- 开发设计：`../../../../agent-runner/docs/modules/outline-management/development/`

产品目标、三档演进策略、范围和验收只在需求文档维护；路线图、RACI、门禁、依赖和风险只在计划维护；本任务卡不复制这些事实。

## 调度规则

1. Project Manager 仅在前一里程碑通过并有证据后，将下一阶段从 `blocked` 调整为 `pending`。
2. P2 和 P4 必须先取得计划中规定的人类审批；未审批不得下发实现任务。
3. Planner 把阶段任务拆成 1 至 4 小时的 SMART 子卡，并声明互不重叠的文件所有权。
4. Worker 先完成开发设计中的接口和伪代码，再修改功能代码；测试必须真实调用后端 API。
5. Reporter 在里程碑、审批或阻塞变化后更新模块 `PROGRESS.md`。

## 完成条件

- [ ] P1 至 P5 的阶段 DoD 全部完成且证据可追溯。
- [ ] 需求 AC-01 至 AC-09 全部满足。
- [ ] 所有必要审批、真实 API 验收和回退记录完整。
- [ ] 模块需求、计划、进度、开发设计、任务卡和 README 引用一致。

## 执行日志

- 2026-08-17：完成五阶段规划。
- 2026-08-17：按大纲管理模块归档，收敛为总任务调度入口。
