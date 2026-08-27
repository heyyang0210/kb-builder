# TASK-KQF-REV-03: 验收人工复核状态机

## 元信息
- 状态: completed
- 分配: test-engineer
- 创建: 2026-08-14
- 预计完成: REV-01、REV-02 完成后 3 小时内
- 依赖: TASK-KQF-REV-01、TASK-KQF-REV-02
- 父任务: TASK-KQF-REQ-27
- 需人类确认: 否
- 可并行: 否

## SMART 验收标准
- [x] 覆盖 keep/exclude/category 全状态组合、非法类别、备注边界和模型字段隔离。
- [x] 两客户端同 revision 真实 API 写入只允许一次成功。
- [x] 验证保存后刷新恢复、未保存提醒、误触保护和完整集合应用。
- [x] 定向回归、前端构建及相关 diff 检查全部通过。

## 文件归属
- 独占新增：`scripts/pingcode/web/backend/tests/test_keyword_filter_review_routes.py`
- 独占新增：`scripts/pingcode/web/frontend/tests/keyword-filter-review.spec.js`（若现有测试框架可用）
- 不修改生产代码。

## 参考文档
- `docs/27-关键词过滤人工调整与问题类别一致性需求.md`
