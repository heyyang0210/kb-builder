# TASK-DOC-ARCHIVE-01：设计文档模块化分层归档

> documentType: task
> moduleId: cross-module
> owner: Planner / Architect / Project Manager / Doc Writer

## 元信息

- 状态：completed
- 分配：Planner / Architect / Project Manager / Doc Writer
- 创建：2026-08-17
- 预计完成：2026-08-17
- 依赖：`diagrams/knowledge-processing-pipeline.drawio`
- 需人类确认：否，用户已明确要求按模块归档
- 可并行：受文件所有权约束的部分可并行

## 需求描述

建立需求、概要设计、开发设计、任务和进度的统一文档架构，按当前代码和知识加工架构图定义模块，并以 `outline-management` 完成首个端到端归档试点。

## 参考文档

- `agent-runner/docs/overview/文档架构与模块归档规范.md`
- `diagrams/knowledge-processing-pipeline.drawio`

## 验收标准

- [x] 定义稳定模块标识、代码边界和文档类型规则。
- [x] 建立 `docs`、`.codex/requirements`、`.codex/workflow/modules` 的入口文档。
- [x] 大纲模块具备 README、概要设计和 P1-P5 开发设计。
- [x] 大纲模块需求、计划、进度和任务卡全部进入 `.codex` 对应层级。
- [x] 旧新路径有迁移映射，仓库内相关引用无断链。
- [x] 当前文件空白检查通过，全仓既有问题单独报告。

## 文件所有权

- Planner：只读盘点与 SMART 拆解。
- Doc Writer：`agent-runner/docs/modules/outline-management/`。
- Project Manager：大纲模块的 `.codex/requirements`、`workflow/modules` 和任务卡。
- 主 Agent：全局规范、导航、迁移映射、跨目录引用和最终验收。

## 执行日志

- 2026-08-17：Planner 完成代码边界、文档类型和迁移风险盘点。
- 2026-08-17：建立全局文档架构、模块地图和首批迁移任务。
- 2026-08-17：Doc Writer 完成大纲模块概要与 P1-P5 开发设计归档；Project Manager 完成需求、计划、进度和 9 张任务卡归档。
- 2026-08-17：检查 30 份相关 Markdown，相对链接全部存在；旧平铺路径无残留；定向空白检查通过。
- 2026-08-17：全仓 `git diff --check` 仅剩既有 `agent-runner/frontend/prompt-generator.html.backup` 尾随空白，本任务未修改该文件。
