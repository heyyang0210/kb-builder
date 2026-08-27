# TASK-KGO-REQ-31: 知识图谱版本治理与质量运营

## 元信息
- 状态: completed
- 类型: 独立父任务 / P2
- 分配: backend-worker / frontend-worker / test-engineer
- 创建: 2026-08-17
- 目标完成: REQ-30 验收后 3 个工作日内
- 依赖: TASK-KGO-REQ-30 completed（已由 30-BE-01/02、30-FE-01/02、30-TST-01 的组合回归证实）
- 需人类确认: 否（版本、兼容、依赖和告警边界已确认）
- 可并行: 否（版本仓储、发布接线、查询和前端按依赖串行）

## 需求目标
依据 `.codex/requirements/modules/knowledge-graph-governance/REQ-KGO-31.md`，仅在正式知识数据集成功发布后创建不可变图谱版本，并在全局图谱页提供版本列表、差异、趋势和发布检查告警。

## 子任务与顺序
1. `TASK-KGO-31-BE-01` 建立不可变版本仓储和 manifest。
2. `TASK-KGO-31-BE-02` 实现配置化检查并接入正式发布。
3. `TASK-KGO-31-BE-03` 实现版本列表、详情、探索、diff、trends 和 checks。
4. `TASK-KGO-31-FE-01` 实现发布级运营页面。
5. `TASK-KGO-31-TST-01` 执行隔离正式发布和组合验收。

## 输入与输出

| 子任务 | 输入 | 输出 |
|---|---|---|
| BE-01 | 已提交的 final_knowledge 图谱产物、lineage、规则配置 | 不可变版本目录、manifest、幂等索引、仓储测试 |
| BE-02 | BE-01 仓储、现有正式发布结果、可观测规则配置 | 质量检查快照、发布响应增量字段、审计 warning、接线测试 |
| BE-03 | 至少两个可校验版本及 REQ-30 有界探索逻辑 | versions/detail/explore/diff/trends/checks API 与性能记录 |
| FE-01 | BE-03 冻结契约和中文交互设计 | 当前版本、历史、diff、趋势、检查页面及桌面/移动证据 |
| TST-01 | 全部实现、隔离正式知识数据集 | 真实 API/组合回归/性能/构建/页面/范围保护验收报告 |

## SMART 验收标准
- [x] 依赖解除后 3 个工作日内完成 BE-01、BE-02、BE-03、FE-01、TST-01；延期必须在模块进展文档记录责任人、原因和复现证据。
- [x] 只有 `final_knowledge` 数据集成功发布产生版本，运行和 apply 不产生版本。
- [x] 并发或重试发布不重复创建版本，发布目录不可变且哈希可校验。
- [x] 发布检查首期只告警，旧客户端和既有发布成功语义保持兼容。
- [x] 版本差异按稳定 ID 计算，汇总数量等于明细总数。
- [x] 趋势保留历史规则版本并在规则变化处明确分段。
- [x] 列表/趋势 P95 小于 500ms，千级 diff P95 小于 1 秒。
- [x] 隔离真实 API、中文界面、生产构建和目标 `git diff --check` 通过。

## 完成摘要

BE-01、BE-02、BE-03、FE-01 和 TST-01 已全部验收。版本仓储、发布接线、查询接口、中文运营页、真实 HTTP 组合回归、性能与桌面/移动验收证据齐全，G0-G4 全部放行。

## 执行门与证据要求

| 门 | 放行条件 | 必须留下的证据 | 失败处理 |
|---|---|---|---|
| G0 依赖 | REQ-30 的搜索、探索、证据 API 及前端构建/真实页面验收通过 | 测试命令、通过数量、P95、页面无 4xx/控制台错误 | 不启动版本生产代码，回交 REQ-30 责任 Worker |
| G1 仓储 | BE-01 原子提交、幂等、哈希和损坏隔离通过 | `test_graph_version_repository.py` 或等价真实隔离测试及目录快照 | 仅修复仓储，不接发布流程 |
| G2 发布接线 | BE-02 仅 `final_knowledge` 创建版本，warning 不阻断 | 隔离发布 HTTP 响应、审计记录、非正式来源对照 | 回退接线改动，保留旧发布语义 |
| G3 查询与页面 | BE-03 API 契约、FE-01 中文桌面/移动和构建通过 | API 响应样例、diff 汇总校验、截图/Playwright、构建日志 | 缺陷回交对应 Worker，不扩大范围 |
| G4 终验 | TST-01 组合回归、性能和 `git diff --check` 全部通过 | 测试报告、P95、范围保护记录 | REQ-31 保持 in_progress，记录可复现阻塞 |

## 完成条件
`TASK-KGO-31-TST-01` 全部通过后标记 completed，并由 `TASK-KGO-MOD-01` 组织 Reporter 完成模块收口和用户验收清单。

## 参考文档
- `.codex/requirements/modules/knowledge-graph-governance/REQ-KGO-31.md`
- `agent-runner/docs/modules/knowledge-graph-governance/development/03-version-governance-quality-operations-design.md`
