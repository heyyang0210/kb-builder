# TASK-KQF-AUD-04: 验收过滤审计和历史记录

## 元信息
- 状态: completed
- 分配: test-engineer
- 创建: 2026-08-14
- 预计完成: AUD-02、AUD-03 完成后 3 小时内
- 依赖: TASK-KQF-AUD-02、TASK-KQF-AUD-03
- 父任务: TASK-KQF-REQ-26
- 需人类确认: 否（真实写入仅隔离数据集）
- 可并行: 否

## SMART 验收标准
- [x] 自动化覆盖状态机、快照不可变、断线恢复、diff、revision 和图谱版本冲突。
- [x] 真实后端 API 完成创建、SSE、刷新查询和 apply；目标业务批次保持只读。
- [x] 643 条详情 P95 < 500ms，摘要列表 P95 < 300ms。
- [x] 后端定向测试、前端构建及相关 `git diff --check` 通过。

## 文件归属
- 独占新增：`scripts/pingcode/web/backend/tests/test_keyword_filter_run_routes.py`
- 独占新增：`scripts/pingcode/web/frontend/tests/keyword-filter-history.spec.js`（若现有测试框架可用）
- 不修改生产代码；缺陷回交对应 Worker 串行修复。

## 参考文档
- `docs/26-关键词过滤决策审计与历史记录需求.md`
