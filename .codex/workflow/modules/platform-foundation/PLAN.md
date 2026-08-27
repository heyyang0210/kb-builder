# reconcile-docs Skill 实施计划

> documentType: plan
> moduleId: platform-foundation
> owner: Project Manager
> status: completed
> updatedAt: 2026-08-17

| 阶段 | 任务 | 依赖 | 退出条件 |
|---|---|---|---|
| D1 | 需求、概要和开发设计 | 无 | 契约、伪代码和验收冻结 |
| D2 | Skill 初始化与规则/模板 | D1 | Skill 元数据和资源结构有效 |
| D3 | 上下文采集与三方对账 | D2 | CLI 和机器报告可重复运行 |
| D4 | 验证与检查点 | D3 | 失败不推进，成功原子推进 |
| D5 | 自测与前向测试 | D4 | 验收矩阵通过，索引同步 |

受限决策：不引入外部依赖，不新增调度服务，不自动提交；未来接入 CI 或定时平台需单独审批。
