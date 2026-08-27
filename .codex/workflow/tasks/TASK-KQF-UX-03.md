# TASK-KQF-UX-03: 验证类别契约、全局搜索与 643 条可达性

## 元信息
- 状态: completed
- 分配: test-engineer
- 创建: 2026-08-14
- 预计完成: 2026-08-14（3 小时内）
- 依赖: TASK-KQF-UX-01、TASK-KQF-UX-02
- 需人类确认: 否（真实目标数据只读，写入仅限隔离 fixture）
- 可并行: 否

## 需求描述
通过自动化、真实后端 API 和页面验收证明：类别字段及聚合统计一致，643 条决策全部可达，任意页发起的关键词搜索均基于完整集合，组合筛选不会影响最终完整决策应用。

## 参考文档
- `docs/25-关键词过滤前端易用性优化设计.md`
- `scripts/pingcode/web/backend/tests/test_training_service.py`
- `scripts/pingcode/web/backend/tests/test_keyword_filter_routes.py`
- `scripts/pingcode/web/frontend/src/views/QualityPage.vue`

## SMART 验收标准
- [ ] 后端测试覆盖合法、缺失、非法类别，保留项无类别，以及 `excludedByCategory` 总和等于排除数。
- [ ] 643 条 fixture 验证第 8 页输入仅存在于其他页的关键词仍可命中，搜索与动作/类别组合后分页范围正确。
- [ ] 验证无类别历史结果显示和应用不报错，当前页只有部分行时应用仍使用完整决策集合。
- [ ] 真实调用后端预览接口/SSE 核对类别字段和完成统计；目标批次只读，任何 apply 只使用隔离 fixture。
- [ ] 指定后端关键词过滤测试全部通过，前端 `npm run build` 通过，相关文件 `git diff --check` 无新增问题。
- [ ] 在 3 小时内形成可供文档引用的命令、结果计数和页面验收证据。

## 文件归属
- 独占：`scripts/pingcode/web/backend/tests/test_training_service.py`
- 独占：`scripts/pingcode/web/backend/tests/test_keyword_filter_routes.py`
- 独占：必要的前端专属测试或 fixture 文件。
- 不修改生产代码和执行效果文档。

## 执行日志
- 2026-08-14 Planner 完成拆解，等待前后端任务完成后验收。
- 2026-08-14 后端定向测试 9/9 通过，前端构建通过；目标批次保持只读。
