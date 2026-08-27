# TASK-KQF-INS-03: 验收共性问题和证据关联

## 元信息
- 状态: completed
- 分配: test-engineer
- 创建: 2026-08-14
- 预计完成: INS-01、INS-02 完成后 3 小时内
- 依赖: TASK-KQF-INS-01、TASK-KQF-INS-02
- 父任务: TASK-KQF-REQ-28
- 需人类确认: 否（真实写入仅隔离数据集）
- 可并行: 否

## SMART 验收标准
- [x] 覆盖类别总和、resourceId 去重、occurrence 去重、无证据和 stale 图谱。
- [x] 真实 API 人工核对至少 3 类、10 条 keyword/resource/chunk 证据关联。
- [x] 验证完整集合筛选后分页、响应长度上限及 P95 指标。
- [x] 浏览器验证查询参数恢复、桌面/移动无重叠，构建与 diff 检查通过。

## 文件归属
- 独占新增：`scripts/pingcode/web/backend/tests/test_keyword_issue_insight_routes.py`
- 独占新增：`scripts/pingcode/web/frontend/tests/keyword-issue-insight.spec.js`（若现有测试框架可用）
- 不修改生产代码。

## 参考文档
- `docs/28-文档共性问题总览与证据下钻需求.md`
