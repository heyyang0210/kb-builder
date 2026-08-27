# TASK-KQF-AUD-02: 接入过滤运行 API 与审计执行链

## 元信息
- 状态: completed
- 分配: backend-worker
- 创建: 2026-08-14
- 预计完成: AUD-01 完成后 4 小时内
- 依赖: TASK-KQF-AUD-01
- 父任务: TASK-KQF-REQ-26
- 需人类确认: 否（父任务已确认资源化 API 和兼容周期）
- 可并行: 是（契约冻结后可与 AUD-03 并行，文件不重叠）

## 需求描述
将普通预览、SSE、查询、对比和 apply 接入 `KeywordFilterRun`；不删除旧接口，应用旧运行前校验来源图谱版本。

## SMART 验收标准
- [x] 创建、SSE、历史列表、详情、diff、apply API 符合 docs/26 契约。
- [x] SSE 断开后已完成批次可恢复，不重复形成模型决策。
- [x] 模型快照不可被人工值覆盖；应用成功冻结 final 快照。
- [x] 来源变化、revision 冲突和非法状态分别返回明确 409 错误码。
- [x] 真实隔离 API 冒烟与后端定向测试在 4 小时内通过。

## 文件归属
- 独占：`scripts/pingcode/web/backend/app/training_service.py`
- 独占：`scripts/pingcode/web/backend/app/main.py`
- 必要时独占：`scripts/pingcode/web/backend/app/models.py`
- 不修改仓储文件、前端和测试文件。

## 参考文档
- `docs/26-关键词过滤决策审计与历史记录需求.md`
