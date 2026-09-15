# YashanDB 项目开发团队角色契约

`.codex/roles/` 定义整个项目开发团队的稳定职责、权限、状态和证据边界。具体工作方法在未来经评估后可下沉为 `.codex/plugins/` 中的 Skill，但未批准 Skill 不是当前 Role 的运行依赖。

详细接口、状态机和 Skill 候选论证见 [Role Contract v1 与角色治理设计](../../agent-runner/docs/39-Role-Contract-v1与角色治理设计.md)。是否实例化角色及其最小组合由 [Task Routing Contract v1](../../agent-runner/docs/40-Task-Routing-Contract-v1与最小角色路径设计.md) 决定；人工审批判断只依据 [Approval Boundary v1](../../agent-runner/docs/41-Approval-Boundary-v1人工审批边界.md)。

## 路由优先

- 团队目标是人类治理下的边界自治；Role 和 Skill 都不能授予业务决策权或残余风险接受权。
- 九个角色是完整团队的职责目录，不是每个任务的固定运行实例。
- 直接处理不实例化角色；标准开发只加载完成设计、实施或验证所需的角色。
- Project Manager、Independent Reviewer 和完整治理状态只用于治理任务、项目级推进或用户明确要求。
- 每增加一个角色必须带来独立设计、验证、反证、协调或治理价值。

## 上下文装载

角色文档是按需参考，不是每次任务的固定 Prompt。直接处理通常只读取任务目标、相关文件和最小验收信息；标准开发按需加载相关 Role；审批和治理角色只在治理任务中加载。

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
| `database-architect` | Database Architect | YashanDB 表结构、DDL、索引和性能设计 | 产品审批、业务实现、验收和风险接受 |

## 公共输入与结果

角色开始前确认与本次责任相关的最小输入：任务目标、输入产物、允许文件和路由结论；若任务触及审批边界，再补充 `approvalRequired`、`approvalReason` 和 `approvalRefs`。影响事实不完整时补充 `approvalAssessment`；不需要的字段不要求模型重复生成。

标准开发结果只需包含实际产物、验证证据、已知限制和需要升级的事项。治理任务再增加任务 ID、审批引用、审查结论和状态迁移；Role、Skill 和模型判断都不能创建或扩大人工授权。

## 治理任务状态所有权

```text
draft -> pending -> in_progress -> ready_for_test
ready_for_test -> verified | rejected
verified -> accepted
```

- Planner 创建 `draft`。
- Project Manager 执行准入、阻塞管理和流程状态迁移；是否接受产品结果或残余风险仍按任务实际边界由有权人决定，不因角色名称自动获得批准权。
- Worker 只请求 `in_progress` 和 `ready_for_test`。
- Test Engineer 输出 `verified/rejected`。
- Reporter 只投影已存在事实。
- 历史 `completed` 暂作为 `accepted` 的兼容别名；本轮不改写历史数据或运行时。

上述状态机只适用于治理任务。普通标准开发只走“设计检查 -> 实施 -> 验证”，不创建这些状态。

## Skill 候选边界

当前没有 Role 将未批准 Skill 声明为必需依赖。只有经代表任务、反例、权限、成本、证据完整性和回退评估后，才能将稳定的“如何做”从 Role 迁移到 `.codex/plugins/` 中的 Skill。
