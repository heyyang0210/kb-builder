# TASK-KQF-AUD-01: 建立过滤运行仓储与版本快照

## 元信息
- 状态: completed
- 分配: backend-worker
- 创建: 2026-08-14
- 预计完成: TASK-KQF-REQ-26 启动后 3 小时内
- 依赖: TASK-KQF-UX-01、TASK-KQF-UX-02
- 父任务: TASK-KQF-REQ-26
- 需人类确认: 否（父任务已确认推荐架构）
- 可并行: 否（需求 26 首个任务）

## 需求描述
按 `docs/26-关键词过滤决策审计与历史记录需求.md` 建立运行实体、状态机、版本指纹和原子文件仓储，只实现内部接口和伪数据测试，不接公共 API。

## SMART 验收标准
- [x] 建立 `run/candidate/model/review/final/events` 产物契约和 schemaVersion 1.0。
- [x] 使用临时文件、原子替换、文件锁和 revision 防止并发覆盖。
- [x] Skill、规则和图谱指纹可重复计算，未知模型信息明确为 null。
- [x] 643 条快照读写及摘要列表定向测试通过，3 小时内完成。

## 文件归属
- 独占新增：`scripts/pingcode/web/backend/app/repositories/keyword_filter_run_repository.py`
- 独占：`scripts/pingcode/web/backend/app/repositories/__init__.py`
- 独占：`scripts/pingcode/web/backend/app/repositories/README.md`（目录 README 同步）
- 独占新增：`scripts/pingcode/web/backend/tests/test_keyword_filter_run_repository.py`
- 不修改 `training_service.py`、`main.py`、前端和需求文档。

## 参考文档
- `docs/26-关键词过滤决策审计与历史记录需求.md`
