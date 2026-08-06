# 新建任务并拆解

## 触发方式
对 Codex 说：`新任务: [需求描述]` 或 `new task: [描述]`

## 执行步骤

1. 读取需求描述
2. 读取 `.codex/workflow/PROGRESS.md` 了解当前状态
3. 读取相关设计文档（`docs/` 目录）
4. spawn Planner 子 Agent 进行任务拆解
5. Planner 输出：
   - 任务卡片列表 → `.codex/workflow/tasks/TASK-*.md`
   - 更新 `PROGRESS.md`
   - 更新 `NEXT.md`
6. 展示拆解方案给人类确认（如有关键决策点）
7. 确认后启动 Worker 执行

## Planner 拆解规则
- 每个任务遵循 SMART 原则
- 标注任务间依赖关系
- 标注可并行的任务组
- 标注需要人类确认的节点
- 单个任务预计工作量不超过 4 小时

## 任务卡片模板
参见 `.codex/workflow/tasks/TEMPLATE.md`
