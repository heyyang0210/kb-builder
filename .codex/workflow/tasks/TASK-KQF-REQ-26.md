# TASK-KQF-REQ-26: 关键词过滤决策审计与历史记录

## 元信息
- 状态: completed
- 类型: 独立父任务
- 分配: planner / backend-worker / frontend-worker / test-engineer
- 创建: 2026-08-14
- 目标完成: 启动后 1 个工作日内
- 依赖: 已完成的关键词全量过滤、类别契约与全局搜索基线
- 后续依赖方: TASK-KQF-REQ-27
- 需人类确认: 否（用户已要求按 docs/26、27、28 逐个实施，视为确认推荐架构）
- 可并行: 父任务之间不可并行；本任务内部仅在接口契约冻结后允许前后端并行

## 需求目标
依据 `docs/26-关键词过滤决策审计与历史记录需求.md`，将一次性过滤预览升级为可恢复、可比较、可审计的过滤运行资源，为人工复核和证据下钻提供稳定数据基础。

## 已确认实施边界
- 运行产物存放于 `datasets/{datasetId}/keyword-filter-runs/{filterRunId}/`，采用原子快照、文件锁和运行级 `revision`。
- 新增资源化 `keyword-filter-runs` API；旧过滤 API 保留一个兼容周期，不在本任务删除。
- 历史记录默认永久保留，首版审计身份仅记录 `system` 或 `anonymous`。
- 不引入数据库或新的外部依赖。

## 子任务与顺序
1. `TASK-KQF-AUD-01`：建立运行仓储、状态机和版本快照。
2. 契约冻结后并行：
   - `TASK-KQF-AUD-02`：接入创建、SSE、历史、详情、diff 和 apply API。
   - `TASK-KQF-AUD-03`：实现历史列表、详情恢复和运行对比界面。
3. `TASK-KQF-AUD-04`：执行自动化、性能和真实 API 验收。

## SMART 验收标准
- [x] 启动后 1 个工作日内完成 AUD-01 至 AUD-04，或记录可复现阻塞证据。
- [x] 每次运行冻结候选、模型决策、版本指纹和事件；应用后冻结最终决策，人工字段不覆盖模型字段。
- [x] 页面刷新或 SSE 中断后可按 `filterRunId` 恢复运行；历史摘要默认 20 条倒序分页，两个完整运行可对比动作和类别差异。
- [x] 相同 `revision` 的并发写只成功一次；来源图谱改变后旧运行 apply 返回明确 409。
- [x] 643 条详情 P95 小于 500ms、历史摘要 P95 小于 300ms；后端定向测试、前端构建和相关 `git diff --check` 通过。

## 文件归属
- AUD-01 独占：`scripts/pingcode/web/backend/app/repositories/keyword_filter_run_repository.py`、同目录 `__init__.py`/`README.md`、`tests/test_keyword_filter_run_repository.py`。
- AUD-02 独占：`scripts/pingcode/web/backend/app/training_service.py`、`app/main.py`，必要时 `app/models.py`。
- AUD-03 独占：`scripts/pingcode/web/frontend/src/components/KeywordFilterHistory.vue`、`src/views/QualityPage.vue`。
- AUD-04 独占：运行路由和前端历史测试文件；生产代码缺陷回交原 Worker 串行修复。
- 与需求 27、28 共用的 `training_service.py`、`main.py`、`QualityPage.vue` 必须在本父任务验收结束后释放。

## 真实 API 边界
- 必须用隔离数据集真实调用创建运行、SSE、详情/历史、diff 和 apply 全链路。
- `batch_dc23fc9141ba4d6f` 及其业务数据集仅允许只读核对，禁止执行写入型 apply。
- 不伪造模型提供商或用户身份；无法取得的运行信息写 `null`。

## 完成条件
`TASK-KQF-AUD-04` 全部通过并形成可复查证据后，将本任务标记 completed，才可启动 `TASK-KQF-REQ-27`。

## 参考文档
- `docs/26-关键词过滤决策审计与历史记录需求.md`
