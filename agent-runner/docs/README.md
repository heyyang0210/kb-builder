# Agent Runner 设计文档中心

本目录只保存相对稳定的概要设计和开发设计。模块需求、项目计划、任务卡和动态进度分别由 `.codex/requirements/` 与 `.codex/workflow/` 管理，测试报告由对应模块进度文档引用，不再与设计文档混放。

## 文档分层

```text
agent-runner/docs/
├── README.md
├── overview/                         # 系统级概要设计与文档架构
└── modules/<moduleId>/
    ├── README.md                     # 模块边界、代码映射和文档导航
    ├── overview/                     # 模块概要设计
    └── development/                  # 接口、Schema、伪代码和异常等开发设计

.codex/
├── requirements/modules/<moduleId>/  # 模块需求：why / what / 验收
└── workflow/
    ├── modules/<moduleId>/           # PLAN / PROGRESS
    └── tasks/<moduleId>/             # Worker 任务卡
```

详细分类规则见 [文档架构与模块归档规范](./overview/文档架构与模块归档规范.md)。旧路径与新路径见 [迁移映射](./MIGRATION-MAP.md)。

## 跨模块治理设计

| 设计 | 适用范围 |
|---|---|
| [独立质询审查者与门禁设计](./38-独立质询审查者与门禁设计.md) | 需求、设计、计划、代码、运行、决策与失败关闭的独立反证和 G0–G4 门禁治理 |
| [Role Contract v1 与角色治理设计](./39-Role-Contract-v1与角色治理设计.md) | 九个角色的公共契约、状态所有权、权限、证据、失败升级和演进边界 |
| [Task Routing Contract v1 与最小执行路径](./40-Task-Routing-Contract-v1与最小角色路径设计.md) | 直接处理、标准开发、治理任务和按需上下文装载 |
| [Approval Boundary v1 人工审批边界](./41-Approval-Boundary-v1人工审批边界.md) | 默认授权、必须审批、不确定项判断和最小审批记录的单一事实源 |

服务基础设施设计见 [服务启动与重启设计](./overview/service-startup-and-restart-design.md)。

## 模块地图

| moduleId | 业务职责 | 主要代码边界 | 设计文档入口 |
|---|---|---|---|
| `platform-foundation` | 服务入口、API 基础设施、配置、持久化和文档治理 | `server.js`、`routes/` 公共层、`lib/config-*`、`lib/process-store.js`、`skills/reconcile-docs/` | [模块入口](./modules/platform-foundation/README.md) |
| `generation-workflow` | 文档生成工作流、步骤执行、Agent 与直接生成 | `lib/workflow-engine.js`、`lib/step-executor.js`、`lib/agents/`、`lib/direct-generate/` | `modules/generation-workflow/` |
| `outline-management` | 大纲上传、解析、预检、评分和落库 | `routes/outline.js`、前端大纲交互、`outlines/` | [模块入口](./modules/outline-management/README.md) |
| `knowledge-graph-governance` | 图谱质量概览、问题诊断、证据联动和版本运营 | PingCode 资料平台图谱前后端 | [模块入口](./modules/knowledge-graph-governance/README.md) |
| `document-management` | 文档生成结果、预览、编辑、评论、列表和元数据 | `routes/document.js`、`lib/document/`、`output/`、`data/document-comments.json` | [模块入口](./modules/document-management/README.md) |
| `material-processing` | 素材接入、转换、预处理、批次与产物快照 | `lib/preprocessing/`、素材平台相关前后端 | `modules/material-processing/` |
| `knowledge-retrieval` | MCP、检索策略、上下文组装、索引与图谱评估 | `lib/tools/mcp-client.js`、`lib/retrieval/`、`lib/retrieval-strategy/` | `modules/knowledge-retrieval/` |
| `workbench-shell` | 中文工作台、全局导航、跨模块交互和状态展示 | `frontend/`、`frontend-server.js` | `modules/workbench-shell/` |

该划分对应知识加工架构图中的前端工作台、API/控制面、流水线、规则处理、Agent/Skill、产物仓储和质量审计等能力。一个文档只能选择一个主模块，跨模块关系通过链接表达，不复制全文。

## 阅读路径

1. 新成员先读系统概要和模块 `README.md`。
2. 产品经理从 `.codex/requirements/modules/<moduleId>/` 获取业务目标和验收标准。
3. Architect 与 Worker 从模块 `overview/` 和 `development/` 获取边界、契约和伪代码。
4. Project Manager 与 Worker 从 `.codex/workflow/modules/<moduleId>/` 和任务卡获取计划与当前状态。
5. Reporter 只根据验收证据更新全局 `PROGRESS.md`、`NEXT.md` 和 `RISKS.md`。
