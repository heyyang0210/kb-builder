# TASK-KQF-REV-02: 实现明确人工复核交互

## 元信息
- 状态: completed
- 分配: frontend-worker
- 创建: 2026-08-14
- 预计完成: AUD-04 通过且复核契约确认后 4 小时内
- 依赖: TASK-KQF-REQ-26 completed；docs/27 契约确认
- 父任务: TASK-KQF-REQ-27
- 需人类确认: 否（使用已确认规则）
- 可并行: 是（可与 REV-01 并行，联调后验收）

## SMART 验收标准
- [x] 整行点击不再改变决策，改用可访问的保留/排除分段控件。
- [x] 改排除要求选类别，改保留清空最终类别并保留模型字段只读展示。
- [x] 复核备注、300ms 批量保存、未保存离开提醒和 revision 冲突提示可用。
- [x] 应用前展示差异汇总，可筛选非法项；分页筛选不影响完整集合。
- [x] 中文桌面/移动布局和前端构建在 4 小时内通过。

## 文件归属
- 独占新增：`scripts/pingcode/web/frontend/src/components/KeywordReviewDecision.vue`
- 独占：`scripts/pingcode/web/frontend/src/views/QualityPage.vue`
- 不修改后端和测试。

## 参考文档
- `docs/27-关键词过滤人工调整与问题类别一致性需求.md`
