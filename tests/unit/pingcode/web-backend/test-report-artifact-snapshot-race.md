# 方案 C 并发快照修复测试报告

> 日期：2026-08-07
> 分支：`fix/pingcode-artifact-snapshot-race`
> 状态：核心真实链路验证完成；大规模单任务性能回退待固定环境复测

## 自动化结果

- 聚焦回归共 129 项：126 通过、2 项按环境跳过、1 项失败。
- 唯一失败 `test_structure_split_preserves_heading_offsets_and_neighbors_after_exclusion` 已在修复前提交 `0e83c9f` 的独立 worktree 复现，属于既有分块长度问题，不是方案 C 回归。
- 后端全量 243 项：219 通过、22 跳过、2 项既有失败，均已记录在 `RISK-TSR-003`。
- 新增覆盖包括：32 线程原子写、4 进程 100 条 state 更新、32 路 single-flight、generation CAS、损坏 latest 阻断、JSONL 隔离与 hash 阻断、100 并发无锁读取、8 路 preparation 复用和错误分类。

## 真实 API 证据

使用独立临时数据根启动真实 ASGI 后端，通过公开上传 API 创建 Markdown 批次，并发调用 `POST /api/training/tasks`：

- 两个并发请求状态码为 `202` 与 `409`，只创建一个有效 owner；
- `keyword_analysis` 任务终态为 `completed`；
- 模型调用为 `succeeded=0 / failed=0 / skipped=0`；
- `run-manifest.json` 同时包含 preparation 和 metadata 完整 `ArtifactSnapshotRef`；
- 两个引用均包含 `manifestHash`、`generation=1` 和固定输入 lineage；
- 真实 API 自动化：`test_artifact_snapshot_api_integration.py`，1 项通过。

## 性能采样

本机 500 次空临界区采样：

- P50：0.0285ms
- P95：0.0401ms
- P99：0.0606ms

P95 低于设计门禁 20ms。100 并发 committed reader 结果一致且不获取写锁。由于缺少固定硬件上的中/大规模串行基线，本轮不声明“单任务回退不超过 5%”已经验收。

## 残余风险

- 进程在产物生成后、进入提交保护区前异常退出时，staging 不会暴露为正式 run，但遗留 single-flight/staging 的自动回收仍需补充租约恢复测试。
- 大规模文档的 CPU、RSS、inode、文件描述符和端到端耗时需在固定验收环境复测。
- 既有分块长度失败应作为独立问题处理，不纳入本修复提交。
