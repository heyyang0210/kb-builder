# 设计文档迁移映射

> 更新日期：2026-08-17
>
> 规则版本：1.0.0

本表是历史路径到模块化新路径的唯一查询入口。已迁移文件不保留第二份可编辑副本。

## 已完成：大纲管理模块

| 历史路径 | 新路径 | 文档类型 |
|---|---|---|
| `docs/agent-runner/29-YashanDB知识库大纲上传内容与格式规格.md` | `docs/agent-runner/modules/outline-management/development/29-YashanDB知识库大纲上传内容与格式规格.md` | 开发设计 / 输入输出规格 |
| `docs/agent-runner/39-管理员手册大纲兼容阶段一-基线与规范副本设计.md` | `docs/agent-runner/modules/outline-management/development/39-管理员手册大纲兼容阶段一-基线与规范副本设计.md` | P1 开发设计 |
| `docs/agent-runner/40-管理员手册大纲兼容阶段二-统一解析与结构化诊断设计.md` | `docs/agent-runner/modules/outline-management/development/40-管理员手册大纲兼容阶段二-统一解析与结构化诊断设计.md` | P2 开发设计 |
| `docs/agent-runner/41-管理员手册大纲兼容阶段三-安全上传与真实API验收设计.md` | `docs/agent-runner/modules/outline-management/development/41-管理员手册大纲兼容阶段三-安全上传与真实API验收设计.md` | P3 开发设计 |
| `docs/agent-runner/42-管理员手册大纲兼容阶段四-预检差异确认与正式上传设计.md` | `docs/agent-runner/modules/outline-management/development/42-管理员手册大纲兼容阶段四-预检差异确认与正式上传设计.md` | P4 开发设计 |
| `docs/agent-runner/43-管理员手册大纲兼容阶段五-评分建议与持续治理设计.md` | `docs/agent-runner/modules/outline-management/development/43-管理员手册大纲兼容阶段五-评分建议与持续治理设计.md` | P5 开发设计 |
| `docs/agent-runner/38-管理员手册大纲兼容改造Epic需求与项目计划.md` 的业务部分 | `.codex/requirements/modules/outline-management/REQ-OUTLINE-COMPATIBILITY.md` | 模块需求 |
| 同上文档的路线图、RACI、门禁和风险部分 | `.codex/workflow/modules/outline-management/PLAN.md` | 模块实施计划 |
| 同上文档的动态阶段状态 | `.codex/workflow/modules/outline-management/PROGRESS.md` | 模块开发进度 |
| `.codex/workflow/tasks/TASK-OUTLINE-*.md` | `.codex/workflow/tasks/outline-management/TASK-OUTLINE-*.md` | 任务卡 |
| `.codex/workflow/tasks/TASK-UPLOAD-SPEC-*.md` | `.codex/workflow/tasks/outline-management/TASK-UPLOAD-SPEC-*.md` | 任务卡 |

## 待迁移模块

| moduleId | 主要历史文档范围 | 下一步 |
|---|---|---|
| `platform-foundation` | `01`、`05`、`07`、`16-数据库方案` | 校准现行服务、配置和持久化边界后迁移 |
| `generation-workflow` | `02`、`03`、`12-执行流程`、`13-修复伪代码`、`21`、LangGraph 示例 | 区分现行实现、目标设计与历史修复记录 |
| `document-management` | `12-文档生成`、`17`、`25`、`37` | 拆分文档生成、结果管理和跨模块内容 |
| `material-processing` | `18`、`26`、`27`、`29-PingCode`、`30-34` | 与根目录 `docs/` 的现行加工流水线设计对齐 |
| `knowledge-retrieval` | `04`、`14-MCP`、`19`、`20`、`22-24`、`28` | 将调研、开发设计和测试报告分层 |
| `workbench-shell` | `06`、`13-全局Tab`、`15`、`14/16-测试报告`、`35-36` | 拆分跨模块前端概要、开发设计和验收证据 |

待迁移不表示文档无效；它表示文档仍位于历史平铺目录，尚未完成内容拆分、状态核验和引用修复。每个模块按独立任务验收，禁止仅移动文件名后标记完成。
