# TASK-KQF-INS-02: 实现问题总览和证据下钻界面

## 元信息
- 状态: completed
- 分配: frontend-worker
- 创建: 2026-08-14
- 预计完成: REV-03 通过且下钻契约确认后 4 小时内
- 依赖: TASK-KQF-REQ-27 completed；docs/28 契约确认
- 父任务: TASK-KQF-REQ-28
- 需人类确认: 否（父任务已确认桌面抽屉与移动端详情区）
- 可并行: 是（可与 INS-01 并行，联调后验收）

## SMART 验收标准
- [x] 紧凑表格展示类别、排除数、占比、影响文档、证据和待复核数。
- [x] 下钻顺序固定为类别、关键词、文档、证据，并支持仅看无证据。
- [x] 搜索筛选作用于完整运行集合；查询参数可恢复下钻位置。
- [x] 缺失/stale 证据显示事实状态，不生成推测原文。
- [x] 中文界面、键盘操作、移动端和构建在 4 小时内通过。

## 文件归属
- 独占新增：`scripts/pingcode/web/frontend/src/components/KeywordIssueOverview.vue`
- 独占新增：`scripts/pingcode/web/frontend/src/components/KeywordEvidenceDrawer.vue`
- 独占：`scripts/pingcode/web/frontend/src/views/QualityPage.vue`
- 不修改后端和测试。

## 参考文档
- `docs/28-文档共性问题总览与证据下钻需求.md`
