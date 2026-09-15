# 模板管理改造任务总览（T1-T10）

状态：in_progress（P1 verified；P2/P3 pending）
依据：`docs/agent-runner/modules/platform-foundation/development/template-management-database-design.md`

## 目标

用 3 个可交付任务包完成原 T1-T10。每包均包含明确角色、允许修改范围、依赖、验收和交接证据，避免后续执行丢失上下文。

## 任务包映射

| 任务包 | 覆盖原任务 | 主责角色 | 关键交付 |
|---|---|---|---|
| P1 契约与核心服务 | T1、T2、T3 | planner、architect、backend-worker、test-engineer | 契约测试、权限、保存、版本和校验闭环 |
| P2 模板工作台 | T4、T5、T6、T7 | backend-worker、frontend-worker、test-engineer、doc-writer | 上传草稿、历史版本、预览编辑、筛选和元数据 |
| P3 数据与生成验收 | T8、T9、T10 | architect、backend-worker、test-engineer、independent-reviewer、reporter | 迁移导入、生成版本固定、真实 API/浏览器验收 |

## P1：契约与核心服务

- 覆盖：T1 测试基线、T2 权限与请求解析、T3 保存校验与并发。
- 依赖：无；完成后才能进入 P2。
- allowedFiles：`packages/agent-runner-core/routes/knowledge-center.js`、`packages/agent-runner-core/lib/template-store.js`、`packages/agent-runner-core/lib/knowledge-center-auth.js`、对应 `tests/`、`apps/knowledge-center-web/frontend/knowledge-center/common/api/platform-api.js`。
- 角色：Architect 冻结契约；Backend Worker 实现；Test Engineer 独立验证；Planner 维护任务状态。
- DoD：列表权限、JSON 解析、版本冲突、敏感信息校验和哈希测试通过；真实后端 API 证据已记录。
- 交接：输出接口版本、错误码、测试命令/退出码、未决风险和回滚提交点。

## P2：模板工作台

- 覆盖：T4 上传草稿、T5 历史版本、T6 预览编辑、T7 筛选和元数据。
- 依赖：P1 契约冻结；P2 内部后端导入与前端页面可并行，但合并前必须联调。
- allowedFiles：模板路由/存储、`apps/knowledge-center-web/frontend/knowledge-center/modules/templates/`、`app.js`、模板 API、对应测试和模块文档。
- 角色：Backend Worker 负责导入/草稿/历史 API；Frontend Worker 负责中文 UI、响应式和无障碍；Test Engineer 做浏览器与 API 验证；Doc Writer 同步设计说明。
- DoD：上传仅生成草稿；Markdown/TXT/DOCX 流程可验收；历史版本可查看并恢复草稿；预览/编辑、筛选和错误反馈可用。
- 交接：浏览器截图（仅 `/tmp`）、请求记录（脱敏）、兼容性说明和已知限制。

## P3：数据与生成验收

- 覆盖：T8 schema/初始化迁移、T9 生成任务固定版本、T10 全量回归。
- 依赖：P1、P2 完成；迁移前必须有数据库备份和回滚点。
- allowedFiles：数据库配置/迁移工具、生成链路相关 `packages/agent-runner-core/`、测试、`docs/`、`.codex/workflow/` 报告。
- 角色：Architect 负责迁移和兼容决策；Backend Worker 实施；Test Engineer 真实验收；Independent Reviewer 仅在项目门禁或证据冲突时独立质询；Reporter 投影事实。
- DoD：初始化导入幂等；新旧任务固定模板版本；完整静态检查、真实 HTTP、浏览器和回归矩阵完成；残余风险已分类。
- 交接：验收矩阵、迁移结果、回滚演练、Reviewer 结论（如触发）和发布建议。

## 不足与改进

1. 现有角色目录没有单独的 `security/database-worker`，SEC/DB 应由 Architect + Backend Worker 共同承担；若迁移风险扩大，应新增专职角色并先更新角色契约。
2. `Project Manager` 只在治理任务或项目级推进时启用。本目标跨模块且要求三包交付，建议由 PM 建立 G0/G1/G2/G3 门禁；若不启用 PM，必须由主执行者承担计划事实维护。
3. Independent Reviewer 不应默认参与每包；仅在 T8 数据迁移、T9 可复现性或 T10 证据冲突时触发。
4. 角色定义要求任务卡位于 `.codex/workflow/tasks/`，本文件是总览；执行前仍需由 Planner 按 P1-P3 生成独立 TASK 卡，并更新 `PROGRESS.md`、`NEXT.md`。

## 统一交接模板

每包结束必须记录：`taskId`、角色、变更文件、设计版本、命令及退出码、真实 API/浏览器证据、未验证项、风险、回滚点、下一包准入条件。禁止以“代码已完成”替代验收。
