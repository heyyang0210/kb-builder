# TASK-RAG-KG-M8-GRAPHSTORE-PLAN-01：GraphStore 本地兼容层与异步投影实施计划

## 元信息

- 状态: in_progress（本地前置 6/10 完成；API 接线与最终验收等待 M2 安全门禁）
- 分配: planner -> architect/doc-writer/test-engineer/backend-worker/reporter
- 创建: 2026-08-19
- 预计完成: 3 个有效工作日（不含 M2、外部事实和人工门禁等待）
- 对应路线图: RG-62—RG-70 的本地前置子集
- 依赖: REQ-KGO-34、ADR 05、用户确认的默认演进方案
- 需人类确认: 默认方案已确认；外部数据库厂商、驱动、部署、凭据、容量和生产写入仍需 G1/G4
- 范围: 设计、存储无关契约、LocalGraphStore、异步投影内核、测试和真实 API 验收
- 非范围: Neo4j/NebulaGraph 驱动、外部服务、向量库、GraphRAG 生产启用、绕过 M2 ACL

## 目标

在不引入外部依赖的前提下，将不可变正式图版本与查询/投影存储解耦，使 JSON/JSONL 继续作为事实源，LocalGraphStore 成为首个 Adapter，并为后续外部图数据库异步投影提供可替换接口。

## 不变量

1. Adapter 只消费通过规范校验的不可变 `graphVersionId`，不得直接转换可变 training run 图文件。
2. `graphVersionId` 独立于 `datasetId`；节点和边使用 `(graphVersionId, nodeId/edgeId)` 幂等键。
3. 只有 `formal_knowledge + published + graph_write_succeeded` 可成为 GraphRAG 候选；keyword 图不得回退冒充正式图。
4. 删除采用版本失效，不物理覆盖历史版本。
5. 本地事实提交和投影不做同步双写；投影失败不破坏事实源，也不得自动切换其他版本。
6. 查询上下文必须包含 `datasetId + graphVersionId + ACL context`；RG-20/23 未完成前不新增可绕过 ACL 的公共查询入口。

## SMART 任务序列

| 顺序 | 任务 | 角色 | 工时 | 依赖 | 阶段状态 |
|---:|---|---|---:|---|---|
| 1 | GS-DES-01 架构、接口、伪代码和测试矩阵 | Architect/Doc | 4h | 已确认默认方案 | `completed` |
| 2 | GS-TST-01 GraphStore/Local 红灯契约测试 | Test | 4h | GS-DES-01 | `completed` |
| 3 | GS-CONTRACT-BE-01 规范模型与接口 | Backend A | 3h | GS-TST-01 红灯 | `completed` |
| 4 | GS-LOCAL-BE-01 LocalGraphStore | Backend B | 4h | GS-CONTRACT-BE-01 | `completed` |
| 5 | GS-WRITE-TST-01 投影状态红灯测试 | Test | 4h | GS-DES-01 | `completed` |
| 6 | GS-WRITE-BE-01 写入状态仓储与投影执行器 | Backend A | 4h | GS-CONTRACT-BE-01、GS-WRITE-TST-01 | `completed` |
| 7 | GS-API-TST-01 真实 API 红灯矩阵 | Test | 4h | GS-LOCAL-BE-01、GS-WRITE-BE-01、RG-20/23 | `blocked` |
| 8 | GS-API-BE-01 正式版本查询/投影接线 | Backend B | 4h | GS-API-TST-01、RG-20/23 | `blocked` |
| 9 | GS-ACC-01 真实 FastAPI 验收 | Test | 4h | GS-API-BE-01、隔离 formal fixture | `blocked` |
| 10 | GS-RPT-01 证据和下一阶段汇总 | Reporter | 2h | GS-ACC-01 | `blocked` |

## 阶段性验收证据

- 独立验收曾发现 5 个 P0，修复后 9 项组合测试通过。
- contract、LocalGraphStore、projection、integration 和 GraphVersion API 最终联合回归 42/42 通过，`py_compile` 与 scoped diff-check 通过。
- 该证据只支持本地前置 6/10 完成；RG-20/23、G2.5、可信身份、隔离 formal 数据与写入许可解阻前，后 4 项保持 `blocked`。

## 关键路径和并发边界

`DES -> TST -> CONTRACT -> LOCAL -> API-TST -> API-BE -> ACC -> RPT`。

`WRITE-TST -> WRITE-BE` 可在 Local 实现期间并行；各 Worker 文件互不重叠。测试文件由 Test Engineer 独占，生产文件由对应 Backend Worker 独占。共享 `PROGRESS.md`、`NEXT.md`、项目经理清单和模块 README 只允许 Reporter 最后串行更新。

## 门禁

- G-DES：设计、接口、伪代码和测试矩阵全部完成后才能写红灯测试。
- G-RED：目标测试确因缺失能力失败，且不是 fixture/导入错误，才允许实现。
- G-LOCAL：无外部依赖情况下，契约、幂等、版本隔离、失效和部分失败测试通过。
- G-M2：RG-20/23 完成且 G2.5 有合格证据前，API 接线保持 blocked。
- G-API：真实 FastAPI/TestClient 通过，越权成功数、错误版本回退数、keyword 冒充数均为 0。
- G-EXT：Neo4j/NebulaGraph 选型、驱动和隔离部署需另行 G1/G4 审批，本计划不自动启动。

## 完成定义

- [ ] 十个原子任务有验收证据，或被外部事实明确标记 blocked。
- [ ] 本地事实源在所有投影故障注入后保持不变。
- [ ] LocalGraphStore 与未来外部 Adapter 使用同一契约，无业务分支特判。
- [ ] 真实 API 验收不绕过 ACL，不将组件测试解释为生产完成。
- [ ] Reporter 更新任务清单、PROGRESS、NEXT、风险和测试报告。
