# TASK-REVIEW-CLOSURE-PLAN：审核与发布评审闭环端到端实现计划

## 元信息

- 状态: 条件完成
- 分配: planner（任务图）；下发至 architect、backend-worker、frontend-worker、test-engineer、doc-writer
- 创建: 2026-09-07
- 预计完成: 由 Project Manager 准入后按任务窗口排期
- 依赖: 无（需先完成 Project Manager 准入）
- 需人类确认: 已确认本轮规则；后续能力另行决策
- 可并行: 是（架构契约与前后端基线可并行；集成验收串行）
- approvalRequired: false
- approvalReason: 用户已确认全文意见兼容、普通/阻断两级分类、阻断门禁、非审核编辑者提意见、修订入口、退回原因和暂不新增通知。
- approvalRefs: 用户确认记录，2026-09-08

## 复杂度评估

本需求属于复杂标准开发任务：同时跨越前端阅读/差异/线程交互、增量构建后端状态机与并发校验、GitLab 文档锚点重定位、候选版本血缘、权限能力投影和真实 HTTP/Chromium E2E。任何单一角色都无法独立交付，必须采用 `.codex/roles/` 定义的多角色框架，并由 Project Manager 负责准入、门禁和状态事实。

## 目标与非目标

目标：依据《知识中心-文档生产-审核与发布-评审闭环前端详细设计文档》实现可追溯的阅读页提意见、完整差异、回复、解决/重开、审核决定与发布，并完成真实 API 和浏览器端到端验证。

非目标：本计划不实现独立意见接受/拒绝状态、候选锚点迁移、CRDT 并发编辑、生产级 SSE 集群、外部通知渠道或未经确认的 AI 自动修复；若要纳入，必须新增契约和独立任务卡。

## 任务图与执行顺序

```text
TASK-REVIEW-ARCH-01（架构/契约冻结）
        ├── TASK-REVIEW-BE-01（后端评审状态机与 API）
        ├── TASK-REVIEW-FE-01（前端阅读/差异/线程闭环）
        └── TASK-REVIEW-DOC-01（设计与接口文档同步）
TASK-REVIEW-BE-01 + TASK-REVIEW-FE-01
        └── TASK-REVIEW-TST-01（真实 API、Chromium E2E、回归门禁）
TASK-REVIEW-TST-01
        └── TASK-REVIEW-REPORT-01（验收汇总与风险投影）
```

## 子任务卡

### TASK-REVIEW-ARCH-01：评审闭环数据模型、状态机与接口契约

- 分配: architect
- 状态: draft
- 依赖: Project Manager 准入
- 可并行: 是
- allowedFiles: `.codex/知识中心建设平台/03-详细设计/知识中心-文档生产-审核与发布-评审闭环前端详细设计文档.md`、`agent-runner/docs/modules/document-management/` 下新增评审契约文档、该任务卡
- approvalRequired: needs_decision
- approvalReason: 确认自审策略、阻断规则、全文意见兼容模式及未实现 P1 能力边界
- 交付: 冻结 comment/thread/reply/resolution/operation link/anchor relocation 字段、状态迁移、错误码、幂等键、并发版本和 capabilities 规则；明确产品展示 `YashanDB` 与内部 `handbookId` 分离。
- 验收: 契约可被后端和前端引用；所有待决策项单独列出并带 `approvalAssessment`；不修改运行代码。

### TASK-REVIEW-BE-01：实现后端评审闭环 API 与审计链

- 分配: backend-worker
- 状态: draft
- 依赖: TASK-REVIEW-ARCH-01
- 可并行: 是（可与 FE-01 并行，接口冻结后开始）
- allowedFiles: `agent-runner/lib/incremental-build-service.js`、`agent-runner/server.js` 或实际增量路由文件、`agent-runner/data/document-comments.json`（仅测试隔离数据）、后端评审单测目录新增文件
- approvalRequired: false（实现既有审核范围；不改变发布权限边界）
- 交付: 评论创建/查询、回复、接受/拒绝、解决/重开、operation 关联、锚点重定位与失效标记、candidateDigest/editVersion/CAS 校验、阻断意见禁止通过（按已批准策略）、审计事件和服务端 capabilities；不得按用户名硬编码权限。
- 验收: 真实 HTTP 契约测试覆盖成功、幂等、403/409/422、候选冲突、并发冲突、审计血缘和自审策略；接口错误不丢客户端输入。

### TASK-REVIEW-FE-01：实现阅读、差异与意见线程前端闭环

- 分配: frontend-worker
- 状态: draft
- 依赖: TASK-REVIEW-ARCH-01
- 可并行: 是（可与 BE-01 并行；使用冻结契约）
- allowedFiles: `agent-runner/frontend/knowledge-center/modules/review-publishing/view.js`、`agent-runner/frontend/knowledge-center/common/api/incremental-api.js`、`agent-runner/frontend/knowledge-center/modules/review-publishing/` 下样式/组件新增文件
- approvalRequired: false（页面交互在已批准设计内）
- 交付: 阅读正文选区/段落/标题提意见浮层，稳定锚点和上下文展示，差异行级入口，统一 threadId 双向定位，回复/接受/拒绝/解决/重开/关联修改，候选冲突与失效降级，中文状态、产品名称展示和 capabilities 驱动按钮；保留紧凑/舒适等既有视觉约束，不展示内部 ID。
- 验收: 组件测试覆盖空/加载/权限/冲突/失效状态；页面无 unknown/未返回伪信息；移动端和桌面端布局可用。

### TASK-REVIEW-TST-01：真实 API 与 Chromium E2E 门禁

- 分配: test-engineer
- 状态: draft
- 依赖: TASK-REVIEW-BE-01、TASK-REVIEW-FE-01
- 可并行: 否
- allowedFiles: `agent-runner/tests/review-reading-comment-e2e.test.js`、`agent-runner/tests/incremental-build-api.test.js`、`agent-runner/tests/e2e/knowledge-center-review-publishing.spec.js`、`agent-runner/tests/fixtures/review-e2e-incremental-state.json`、测试 README/门禁目录新增文件
- approvalRequired: false（验证既有授权范围，不写入生产数据）
- 交付: 隔离测试身份和 fixture；覆盖阅读页提意见、行级定位、线程闭环、候选重建后自动迁移/人工确认/失效、阻断意见门禁、回复/解决/重开、审核/发布、幂等和权限失败保留输入。
- 验收: 真实后端 API 与 Chromium E2E 全部通过；输出可复现命令、环境、证据和失败诊断；禁止仅 mock API 作为唯一证据。

### TASK-REVIEW-DOC-01：同步设计、接口与开发验收文档

- 分配: doc-writer
- 状态: draft
- 依赖: TASK-REVIEW-ARCH-01、TASK-REVIEW-BE-01、TASK-REVIEW-FE-01
- 可并行: 否（实现产物稳定后）
- allowedFiles: `.codex/知识中心建设平台/03-详细设计/知识中心-文档生产-审核与发布-评审闭环前端详细设计文档.md`、`.codex/知识中心建设平台/03-详细设计/README.md`、`prompt.md`
- approvalRequired: needs_decision（仅记录未决策项，不代替审批）
- 交付: 记录实际实现与设计差异、接口字段、状态机、产品展示口径、E2E 门禁命令和未实现边界；更新目录 README 与 prompt 单一入口。
- 验收: 文档链接有效、无“已完成”伪描述；实现/测试证据与代码一致。

### TASK-REVIEW-REPORT-01：汇总验收、风险与下一步

- 分配: reporter
- 状态: draft
- 依赖: TASK-REVIEW-TST-01、TASK-REVIEW-DOC-01
- 可并行: 否
- allowedFiles: `.codex/workflow/PROGRESS.md`、`.codex/workflow/NEXT.md`、`.codex/workflow/RISKS.md`、该计划任务卡
- approvalRequired: false
- 交付: 仅投影已存在的任务状态、测试证据、已知限制和待确认决策；不修改业务事实、不接受残余风险。
- 验收: 进度、风险、下一步与测试报告一致；缺证据项标为未验证或阻塞。

## 本轮完成与后续

- 已实现并通过验收：普通/阻断两级意见、全文意见兼容、非审核编辑者提意见、候选提交人禁止审核通过本人候选、阻断意见门禁、回复、解决/重开、手册汇总、全文差异、审核和发布。
- 已确认但未纳入本轮：`@提及`与通知暂不新增；独立“接受/拒绝意见”及拒绝后二次复核、跨候选锚点迁移、稳定 `operationId`、真实数据库专项 AI 审核和 CRDT 实时协同必须作为后续任务重新立项。
- 验证：定向 Jest 31 项通过；独立状态下 Chromium E2E 5 项通过；`node --check` 和 `git diff --check` 通过。

## 参考文档

- `.codex/知识中心建设平台/03-详细设计/知识中心-文档生产-审核与发布-评审闭环前端详细设计文档.md`
- `.codex/知识中心建设平台/03-详细设计/知识中心-文档生产-审核与发布-详细设计文档.md`
- `agent-runner/docs/39-Role-Contract-v1与角色治理设计.md`
- `agent-runner/docs/40-Task-Routing-Contract-v1与最小角色路径设计.md`
- `agent-runner/docs/41-Approval-Boundary-v1人工审批边界.md`
