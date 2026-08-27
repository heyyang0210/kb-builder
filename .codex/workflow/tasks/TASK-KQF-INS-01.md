# TASK-KQF-INS-01: 实现共性问题聚合与证据查询 API

## 元信息
- 状态: completed
- 分配: backend-worker
- 创建: 2026-08-14
- 预计完成: REV-03 通过后 4 小时内
- 依赖: TASK-KQF-REQ-27 completed
- 父任务: TASK-KQF-REQ-28
- 需人类确认: 否（父任务已确认证据口径与惰性索引）
- 可并行: 是（契约确认后可与 INS-02 并行）

## SMART 验收标准
- [x] 总览以有效/最终决策聚合，类别之和等于最终排除数。
- [x] 按 keywordId 关联 occurrence、resource、chunk 和证据，不按名称模糊拼接。
- [x] 下钻筛选完整集合后分页，pageSize <= 100，证据文本 <= 500 字符。
- [x] 无证据项不丢失；历史图谱不可用时返回 stale。
- [x] 643 条/百级文档查询 P95 < 500ms，4 小时内完成。

## 文件归属
- 独占新增：`scripts/pingcode/web/backend/app/keyword_issue_insight_service.py`
- 独占：`scripts/pingcode/web/backend/app/training_service.py`
- 独占：`scripts/pingcode/web/backend/app/main.py`
- 不修改前端和测试。

## 参考文档
- `docs/28-文档共性问题总览与证据下钻需求.md`
