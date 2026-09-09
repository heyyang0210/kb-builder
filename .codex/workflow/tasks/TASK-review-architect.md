# Architect 评审：审核与发布评审闭环端到端实现

> roleId: `architect`
> 日期：2026-09-07
> 性质：复杂标准开发的架构基线（仅设计审查，不代替实现、测试或产品批准）

## 1. 复杂度与路由结论

该需求属于复杂标准开发任务，应使用项目已定义的角色契约协作：`architect` 冻结产品/接口边界，`planner` 拆解任务，`backend-worker` 与 `frontend-worker` 实施，`test-engineer` 通过真实 HTTP 与 Chromium E2E 验证，`doc-writer` 同步设计和门禁文档，`reporter` 汇总事实。复杂性来自跨前后端状态机、候选摘要并发校验、行级锚点生命周期、权限能力投影、Markdown 阅读渲染和发布门禁的组合依赖；不能用单个页面测试或纯函数测试宣称完成。

本报告不改变代码，不批准受限决策；实现前仍需由产品/架构责任人确认“阻断意见是否必然禁止通过、是否要求独立复核”等待确认项。

## 2. 用户与端到端目标

- TW/知识编辑者：在候选手册正文中阅读、选区提意见、跟踪回复并修改增量草稿。
- 内核工程师/DBA 体验官：按产品版本、参数依赖和 SQL/运维语义定位问题，复核修改前后差异。
- 审核/发布人员：查看统一评论线程、处理阻断项、作出审核决定并在能力允许时发布。

完成定义是：同一候选上下文中，用户可从“阅读文档”进入行级/段落级意见，意见在“处理审核意见”可定位和闭环；候选变化或摘要冲突不会误挂评论；服务端能力决定可评论、审核和发布；失败保留输入并可恢复；发布前门禁可验证且全链路可审计。

## 3. 已验证事实（代码/测试基线）

1. `agent-runner/lib/incremental-build-service.js` 已提供候选冻结、提交审核、评论创建/查询、回复、解决/重开、关联 operation、审核决定和发布 API；写接口使用幂等键，并校验 `candidateDigest`。
2. `project()` 通过 `capabilities` 投影 `canEdit/canComment/canReview/canPublish`；审核决定代码未按用户名禁止自审，发布能力独立控制。
3. 审核页面已展示 YashanDB、手册名称、业务版本、候选摘要和未解决意见数；内部 `handbookId`/基线仅留在接口与审计上下文。
4. 阅读页与差异页均渲染意见表单，已有 Markdown 渲染降级、目录收起、专注阅读和证据栏。
5. 已有 API/E2E 用例覆盖基础评论、候选冲突、只读权限、审核决定及阅读页布局；这些证据不能替代真实选区锚点、线程操作和候选重建后的迁移测试。

## 4. 发现的契约/实现缺口

### P0（进入实现前必须补齐）

1. **阅读页选区锚点不完整**：`agent-runner/frontend/knowledge-center/app.js` 当前选区处理只构造 `documentId + anchorKind + selectedText`，未可靠提供设计要求的 `nodeId`、`lineRange`、`charRange`、上下文片段；后端对有锚点评论要求 `documentId/nodeId`，因此真实选区可能被拒绝或退化为全文意见。需从渲染节点的 `data-document-node`/白名单 id 建立稳定映射，无法映射时明确兼容模式。
2. **页面表单语义不足**：阅读页未提供意见类型、严重级别、引用片段回显和候选冲突恢复提示；提交失败需保留文本、定位和滚动位置，并阻止重复创建。
3. **评论闭环 UI 不完整**：意见卡目前主要展示内容和状态，未暴露回复、接受/拒绝、解决/重开、关联 operation、定位正文/查看修改等操作；需以 `capabilities` 和评论状态控制按钮。
4. **评论状态/门禁规则未单一化**：前端显示未解决数量，但审核决定接口当前未检查阻断意见；“阻断是否禁止通过”必须由服务端版本化策略决定，前端仅投影结果，不得自行放行。
5. **候选重建后的锚点迁移缺口**：设计声明自动迁移/人工确认/失效，但当前服务未见迁移 API、事件或持久化状态；需定义迁移结果（`valid/needs_confirmation/invalidated`）、证据和审计事件。

### P1（P0 闭环后实施）

- SSE/presence、@提及和通知；
- AI 分析/修复提案的异步任务、规则/模型/证据版本；
- 并发编辑或 CRDT（当前设计明确非 MVP）；
- 审核历史深链接的只读投影和发布后回看。

## 5. 推荐模块边界与 API 契约

- 前端 `review-publishing/view.js` 负责展示和交互投影；`app.js` 只负责事件编排，不复制业务规则。
- 后端 `IncrementalBuildService` 是候选、评论状态、能力与门禁的单一事实源；所有写接口校验任务状态、能力、候选摘要、锚点和幂等键。
- 评论创建请求最少包含：`comment/commentType/severity/candidateDigest/anchor`；锚点包含 `documentId/nodeId/anchorKind/lineRange/charRange/selectedText/contextBefore/contextAfter`。
- 建议补充接口：`PATCH .../comments/{id}`（接受/拒绝或状态变更）、`POST .../resolve`、`POST .../reopen`、`POST .../replies`、`POST .../link-operation`、`GET .../comments/relocation`。返回值必须含 `threadId/commentId/candidateDigest/anchorStatus/auditId`。

## 6. 异常、兼容与安全基线

- 候选摘要不一致：返回 409 `REVIEW_CANDIDATE_CONFLICT`，前端保留草稿并要求重新读取。
- 锚点缺失/不属于候选：返回 422，不能静默创建“有效”行级意见；兼容全文意见必须显式标记 `unanchored_compat`。
- 权限失败：返回 403；按钮由 `capabilities` 控制，但服务端仍强制校验，禁止按登录名硬编码。
- 评论与原文不可物理删除或覆盖；状态变化、候选摘要、操作者、时间和原因写入审计链。
- 新字段须兼容旧评论读取；未知 `anchorStatus` 前端显示“需要人工确认”，不能当作已解决。

## 7. 可执行验收基线（供 Test Engineer）

1. Given `under_review` 候选且 `canComment=true`，When 在阅读页选中 YFS 段落提交意见，Then HTTP 请求含完整锚点，意见在同一 `threadId` 的处理意见步骤可见并可定位正文。
2. Given 过期 `candidateDigest`，When 提交意见，Then 返回 409、无评论落库、表单内容/定位保留。
3. Given 只读能力，When 提交/回复/审核/发布，Then 403 且页面不显示可执行按钮。
4. Given 评论线程，When 回复、解决、重开、关联 operation，Then 状态和审计事件可查询，候选摘要保持一致。
5. Given 候选更新，When 锚点可匹配/需确认/失效，Then 分别显示三种状态且不得自动关闭失效意见。
6. Given 存在服务端定义的阻断项，When 审核通过，Then 服务端拒绝并返回明确错误；无阻断且能力足够时才允许通过。
7. Given Markdown 含 `<span id="YFS" name="YFS"></span>`，When 阅读页面渲染，Then 标签不泄漏为文本且节点可被意见锚点定位；门禁测试防回归。

## 8. 待确认/升级事项

- 阻断意见与审核通过的关系、是否要求至少一名其他审核人：属于业务治理决策，需人类确认后固化服务端策略。
- 全文意见兼容模式是否进入 P0、意见严重级别枚举及通知隐私规则：当前为建议默认，不得在实现中擅自扩大范围。
- SSE/AI 自动修复/CRDT 需要独立容量、安全和回滚评估，不能因本轮端到端目标直接标记完成。
