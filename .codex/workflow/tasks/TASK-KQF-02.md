# TASK-KQF-02: 关键词过滤前端进度与结果口径修复

## 元信息
- 状态: pending
- 分配: frontend-worker
- 创建: 2026-08-14
- 预计完成: 2026-08-15
- 依赖: TASK-KQF-01
- 需人类确认: 否（以后端已批准的 docs/22 契约为准）
- 可并行: 否

## 需求描述
修正 `QualityPage.vue` 对 `keywords_loaded`、`decision`、`complete` SSE 事件的解释：页面应区分“已加载 643 个候选”和“模型已形成 78 个决策”，在不完整结果时明确显示未完成并阻止应用决策，不能把流式数组长度当作全量成功数。

## 参考文档
- `scripts/pingcode/web/frontend/src/views/QualityPage.vue:315`
- `docs/22-关键词质量过滤643与78不一致问题分析及修改方案.md`

## SMART 验收标准
- [ ] 643/78 fixture 下显示候选总量、已决策量和待处理量，文案为中文且不混淆。
- [ ] 未完成或存在缺失决策时“应用决策”不可提交，并给出可恢复提示。
- [ ] 完整结果仍保持现有保留/排除切换和应用流程。
- [ ] 单次用户操作触发后端内部批处理；不要求用户手工执行多次。
- [ ] 前端构建通过，浏览器验证覆盖目标批次等价隔离数据。

## 文件归属
- 实施阶段独占：`scripts/pingcode/web/frontend/src/views/QualityPage.vue`、其专属测试/fixture 和页面验收记录。
- 不得修改后端和任务运行时文件。
