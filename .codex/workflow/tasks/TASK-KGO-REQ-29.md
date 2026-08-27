# TASK-KGO-REQ-29: 知识图谱质量概览与局部可视化

## 元信息
- 状态: completed
- 类型: 独立父任务 / P0
- 分配: backend-worker / frontend-worker / test-engineer
- 创建: 2026-08-17
- 目标完成: 2026-08-18
- 依赖: TASK-KGO-MOD-01 设计冻结
- 需人类确认: 否（用户已确认综合方案和技术边界）
- 可并行: 子任务按文件归属有限并行

## 需求目标
依据 `.codex/requirements/modules/knowledge-graph-governance/REQ-KGO-29.md`，展示图谱范围、三种规模和已有健康指标，默认不渲染全量力导向图，并将共享图谱组件收敛为有界局部渲染器。

## 子任务与顺序
1. `TASK-KGO-29-BE-01` 与 `TASK-KGO-29-FE-01` 可并行，分别实现只读概览契约和纯渲染组件。
2. 二者完成后执行 `TASK-KGO-29-FE-02`，在质量分析页接入概览和局部图谱工具栏。
3. 最后执行 `TASK-KGO-29-TST-01` 做真实 API、兼容、性能、中文界面和构建验收。

## SMART 验收标准
- [x] 1 个工作日内完成全部子任务，或记录可复现阻塞。
- [x] 页面明确区分事实规模、投影规模和渲染规模，截断状态 100% 可见。
- [x] 未选择焦点时不初始化全量力导向图；局部图谱不超过配置上限。
- [x] 关系覆盖率、证据完整率、孤立知识比例、Why 缺失率和跨文档关系均显示统计依据和可用性。
- [x] `graph/observability` P95 小于 500ms，局部查询 P95 小于 800ms。
- [x] 原有图谱接口兼容测试、前端生产构建和目标 `git diff --check` 通过。

## 完成条件
`TASK-KGO-29-TST-01` 全部通过后将本任务标记 completed，更新模块进展，并解除 REQ-30 的依赖。

## 参考文档
- `.codex/requirements/modules/knowledge-graph-governance/REQ-KGO-29.md`
- `agent-runner/docs/modules/knowledge-graph-governance/development/01-quality-overview-local-graph-design.md`
- `docs/20-质量分析页面三层重构设计.md`
