# AGENTS.md — YashanDB知识库构建仓库 工作空间指引

## 约束要求
- 调整对应目录结构，如果对应目录下有README.md文档，需要同步进行更新
- 代码开发，先实现设计文档，先实现接口、伪代码，再进行功能代码开发
- 修改代码功能，需要同步更新设计文档
- 代码中的规则和提示词内容，非特殊情况不要用硬编码，使用硬编码内容也需要记录到待办事项文档中

## agent-runner约束
- 这是一个前后端的服务代码，测试需要真实调用后端API执行
- 不要做无关功能的修改，如果确实需要合理理由，然后再修复

## 前端展示约束
- 使用中文展示

## 任务规划与分发流程
- 对于复杂任务，必须先由 `Planner` 角色产出架构设计或实施方案。
- 任务拆解需遵循 **SMART** 原则（具体、可衡量、可实现、相关、有时限）。
- 拆解后的子任务应尽可能相互独立，以便并行执行。

---

## 多角色自动编排协议

### 角色定义
项目使用以下角色分工，角色指令详见 `.codex/roles/`：

| 角色 | 文件 | 职责 |
|------|------|------|
| Planner | `.codex/roles/planner.md` | 接收高层需求，拆解为 SMART 子任务 |
| Frontend Worker | `.codex/roles/frontend-worker.md` | 前端功能开发（Vue/HTML） |
| Backend Worker | `.codex/roles/backend-worker.md` | 后端功能开发（Node.js/Python） |
| Test Engineer | `.codex/roles/test-engineer.md` | 测试设计与自动化测试 |
| Doc Writer | `.codex/roles/doc-writer.md` | 文档编写与更新 |
| Reporter | `.codex/roles/reporter.md` | 进度汇总与每日报告 |

### 自动编排流程
收到高层需求时，按以下流程自动编排：

1. **Planner 拆解**：spawn Planner 子 Agent，输入需求描述，输出任务卡片到 `.codex/workflow/tasks/`
2. **人类审批**（仅关键节点）：如需确认，展示拆解方案给人类
3. **Worker 并行执行**：对无依赖的任务批量 spawn Worker 子 Agent 并行执行
4. **Reporter 汇总**：所有 Worker 完成后，spawn Reporter 更新进度看板和每日报告


### 人机交互边界
以下节点必须等待人类确认后再继续：
- 架构层面的决策（新增模块、改变技术栈）
- 破坏性变更（删除已有功能、修改公共 API）
- 引入新的外部依赖（npm 包、Python 包、外部服务）
- 涉及安全或性能的改动

### 快捷命令
用户可以使用以下自然语言触发操作：
- **"查看进度"** → 读取并展示 `.codex/workflow/PROGRESS.md`
- **"生成今日报告"** → 汇总当日变更，生成 `.codex/workflow/daily/` 报告
- **"下一步做什么"** → 读取并展示 `.codex/workflow/NEXT.md`
- **"有什么风险"** → 读取并展示 `.codex/workflow/RISKS.md`
- **"新任务: [描述]"** → 启动 Planner 拆解流程
