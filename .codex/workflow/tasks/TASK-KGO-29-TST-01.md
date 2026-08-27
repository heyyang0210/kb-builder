# TASK-KGO-29-TST-01: 验收图谱质量概览与局部可视化

## 元信息
- 状态: completed
- 分配: test-engineer
- 创建: 2026-08-17
- 预计完成: 开始后 4 小时内
- 依赖: TASK-KGO-29-BE-01、TASK-KGO-29-FE-01、TASK-KGO-29-FE-02
- 父任务: TASK-KGO-REQ-29
- 需人类确认: 否
- 可并行: 否

## 需求描述
通过隔离数据真实调用后端 API，并验证健康指标、截断口径、旧接口兼容、局部图谱上限、中文桌面/移动布局和性能。

## SMART 验收标准
- [x] 4 小时内完成定向测试、真实 API、前端构建和页面验收。
- [x] 自动化覆盖 available/not_applicable/stale、统计分母、截断和 404 错误。
- [x] 旧图谱接口契约全部通过，observability P95 < 500ms、neighborhood P95 < 800ms。
- [x] 643 关键词 fixture 默认不渲染全图，选中焦点后节点/边不超过配置上限。
- [x] 桌面与移动截图核对无文字溢出、画布覆盖或不可理解重叠。
- [x] 真实调用后端 API；目标业务批次只读；目标文件 `git diff --check` 通过。

## 完成记录

- 新增 `tests/test_graph_observability_routes.py`，通过 FastAPI TestClient 真实调用隔离 API。
- 组合回归 94/94 通过；前端生产构建通过。
- 643 关键词、1000 关系基线：概览 P95 31.39ms，局部图 P95 9.43ms。
- Playwright 桌面与 390px 移动验收无控制台错误；移动页面 `scrollWidth = clientWidth = 390`。
- `batch_dc23fc9141ba4d6f` 仅用于 GET 页面展示，未执行 apply、publish 或版本写入。

## 文件归属
- 独占新增：`scripts/pingcode/web/backend/tests/test_graph_observability_routes.py`
- 可独占新增前端测试文件；生产缺陷回交对应 Worker。
- 不直接修改生产代码。

## 参考文档
- `.codex/requirements/modules/knowledge-graph-governance/REQ-KGO-29.md`
- `agent-runner/docs/modules/knowledge-graph-governance/development/01-quality-overview-local-graph-design.md`
