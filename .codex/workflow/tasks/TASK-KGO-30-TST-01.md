# TASK-KGO-30-TST-01: 验收问题诊断与证据联动

## 元信息
- 状态: completed
- 分配: test-engineer
- 创建: 2026-08-17
- 预计完成: 开始后 4 小时内
- 依赖: TASK-KGO-30-BE-01、TASK-KGO-30-BE-02、TASK-KGO-30-FE-01、TASK-KGO-30-FE-02
- 父任务: TASK-KGO-REQ-30
- 需人类确认: 否
- 可并行: 否

## 需求描述
使用 643 条隔离 fixture 和真实后端 API 验证运行投影、跨页全局搜索、有界探索、节点/关系证据、stale 安全性、URL 恢复、请求竞态和中文界面。

## SMART 验收标准
- [x] 完成组合回归、真实 API、构建和界面验收。
- [x] 覆盖 before/after/changed 集合、组合筛选后分页、深度 1/2、稳定顺序和无悬空边。
- [x] 覆盖完整服务端集合搜索，搜索不局限前端当前页。
- [x] 覆盖节点/关系 available/missing/stale，证明不存在同名错误关联。
- [x] 桌面三栏和移动标签完成证据联动，刷新后状态一致。
- [x] API 响应满足 < 800ms 目标；目标文件检查和前端构建通过。
- [x] 真实 API 使用隔离数据，目标业务批次只读。

## 完成证据
- test_graph_exploration_routes.py 5/5 通过；REQ-29/30 与问题洞察组合回归 16/16 通过。
- 真实页面验证 focusNodeId 可恢复、canvas 已挂载、证据来源 661 条，无 4xx 和控制台错误。
- 目标业务批次只读，未执行 apply、发布或版本写入。

## 文件归属
- 独占新增：`scripts/pingcode/web/backend/tests/test_graph_exploration_routes.py`
- 可独占新增前端测试文件；生产缺陷回交对应 Worker。
- 不直接修改生产代码。

## 参考文档
- `.codex/requirements/modules/knowledge-graph-governance/REQ-KGO-30.md`
- `agent-runner/docs/modules/knowledge-graph-governance/development/02-problem-diagnosis-evidence-linkage-design.md`
