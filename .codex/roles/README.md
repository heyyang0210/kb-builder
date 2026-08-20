# YashanDB 项目开发团队角色契约

`.codex/roles/` 定义整个项目开发团队的稳定职责、权限、状态和证据边界。具体工作方法在未来经评估后可下沉为 `.codex/plugins/` 中的 Skill，但未批准 Skill 不是当前 Role 的运行依赖。

详细接口、状态机和 Skill 候选论证见 [Role Contract v1 与角色治理设计](../../agent-runner/docs/39-Role-Contract-v1与角色治理设计.md)。

## 角色地图

| `roleId` | 角色 | 拥有的核心事实 | 不拥有 |
|---|---|---|---|
| `architect` | Architect | 问题、产品与架构契约 | 排期、受限决策审批、验收 |
| `planner` | Planner | 任务图、依赖、文件归属和 `draft` 任务卡 | 计划批准、进度事实、验收 |
| `project-manager` | Project Manager | 计划基线、门禁、风险和任务事实状态 | 产品/架构产出、实施、测试证据 |
| `backend-worker` | Backend Worker | 后端实施与自测证据 | 架构审批、独立验证、接受 |
| `frontend-worker` | Frontend Worker | 前端实施与自测/视觉证据 | API 契约变更、独立验证、接受 |
| `test-engineer` | Test Engineer | 测试设计、验证证据与 `verified/rejected` | 产品契约、残余风险接受 |
| `independent-reviewer` | Independent Reviewer | 独立质疑记录与审查结论 | 待审产物、任务状态、最终裁决 |
| `doc-writer` | Doc Writer | 文档表达、同步与导航质量 | 产品/架构决策、验收 |
| `reporter` | Reporter | 进度、风险和下一步投影 | 任务事实、计划、验收和风险裁决 |

## 公共输入与结果

角色开始前至少确认 `taskId`、`runId`、`roleId/roleVersion`、`policyVersion`、输入产物、`allowedFiles` 和审批引用。必需事实缺失时返回 `blocked` 或 `needs_decision`，不得自行补造。

结果至少包含 outcome、请求的状态迁移、变更产物、证据 ID、命令与退出码、已知风险、未解决项和升级目标。角色只能请求它有权的迁移。

## 状态所有权

```text
draft -> pending -> in_progress -> ready_for_test
ready_for_test -> verified | rejected
verified -> accepted
```

- Planner 创建 `draft`。
- Project Manager 执行准入、阻塞管理和最终接受。
- Worker 只请求 `in_progress` 和 `ready_for_test`。
- Test Engineer 输出 `verified/rejected`。
- Reporter 只投影已存在事实。
- 历史 `completed` 暂作为 `accepted` 的兼容别名；本轮不改写历史数据或运行时。

## Skill 候选边界

当前没有 Role 将未批准 Skill 声明为必需依赖。只有经代表任务、反例、权限、成本、证据完整性和回退评估后，才能将稳定的“如何做”从 Role 迁移到 `.codex/plugins/` 中的 Skill。
