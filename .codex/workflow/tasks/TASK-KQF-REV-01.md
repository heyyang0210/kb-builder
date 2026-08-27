# TASK-KQF-REV-01: 实现人工复核一致性后端契约

## 元信息
- 状态: completed
- 分配: backend-worker
- 创建: 2026-08-14
- 预计完成: AUD-04 通过后 3 小时内
- 依赖: TASK-KQF-REQ-26 completed
- 父任务: TASK-KQF-REQ-27
- 需人类确认: 否（父任务已确认复核与一致性策略）
- 可并行: 是（契约确认后可与 REV-02 并行）

## SMART 验收标准
- [x] PATCH 批量保存复核增量，服务端规范化 action/category/note/userOverride。
- [x] keep 类别恒为 null；exclude 必须为运行冻结字典的合法类别。
- [x] 汇总满足最终数量和类别统计恒等式，冲突/非法/不可变状态有明确错误码。
- [x] 图谱应用和最终快照具备可恢复的一致性记录，3 小时内完成定向验证。

## 文件归属
- 独占：`scripts/pingcode/web/backend/app/training_service.py`
- 独占：`scripts/pingcode/web/backend/app/main.py`
- 必要时独占：`scripts/pingcode/web/backend/app/models.py`
- 不修改前端、仓储实现和测试。

## 参考文档
- `docs/27-关键词过滤人工调整与问题类别一致性需求.md`
