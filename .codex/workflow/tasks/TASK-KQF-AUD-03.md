# TASK-KQF-AUD-03: 实现过滤历史与运行对比界面

## 元信息
- 状态: completed
- 分配: frontend-worker
- 创建: 2026-08-14
- 预计完成: AUD-01 完成且 API 契约冻结后 4 小时内
- 依赖: TASK-KQF-AUD-01；docs/26 API 契约确认
- 父任务: TASK-KQF-REQ-26
- 需人类确认: 否（使用已确认契约）
- 可并行: 是（可与 AUD-02 并行，联调后串行验收）

## 需求描述
在质量分析页增加本次过滤、历史运行和两次运行对比；刷新页面可恢复运行详情，所有可见文案为中文。

## SMART 验收标准
- [x] 历史摘要按时间倒序分页显示状态、数量、模型和版本。
- [x] 运行详情区分模型建议、复核值和最终值，不完整运行不可应用。
- [x] 可选择两个完整运行查看动作/类别差异和差异项。
- [x] 页面刷新可按 filterRunId 恢复；移动端无重叠，构建通过。

## 文件归属
- 独占新增：`scripts/pingcode/web/frontend/src/components/KeywordFilterHistory.vue`
- 独占：`scripts/pingcode/web/frontend/src/views/QualityPage.vue`
- 不修改后端、仓储和测试文件。

## 参考文档
- `docs/26-关键词过滤决策审计与历史记录需求.md`
