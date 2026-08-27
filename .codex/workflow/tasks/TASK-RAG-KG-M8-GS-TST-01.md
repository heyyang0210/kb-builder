# TASK-RAG-KG-M8-GS-TST-01：GraphStore 与 LocalGraphStore 红灯契约测试

## 元信息

- 状态: completed
- 分配: test-engineer
- 创建: 2026-08-19
- 预计完成: 开始后 4h
- 依赖: GS-DES-01
- 需人类确认: 否
- 可并行: 否；先于实现
- 文件归属: `scripts/pingcode/web/backend/tests/test_graph_store_contract.py`、`test_local_graph_store.py`

## SMART 目标

在 4 小时内把设计矩阵转为红灯测试，证明缺失的是 GraphStore 能力而非 fixture、导入或测试环境错误。

## 验收标准

- [x] 覆盖 canonical schema、稳定异常码和深度上限。
- [x] 覆盖同版本重试幂等、不同版本隔离、dataset 不匹配 fail-closed。
- [x] 覆盖 keyword、未发布和已失效版本不可成为 GraphRAG 候选。
- [x] 覆盖节点/边重复、悬空端点、无证据边和 ACL 冲突拒绝。
- [x] 覆盖损坏文件、哈希漂移、缺失快照，不读取 `latest.json`。
- [x] 先记录预期失败命令与失败断言；测试不得修改生产文件。
- [x] `git diff --check` 通过。

## 红灯证据

- 执行时间: 2026-08-19
- 执行命令: `uv run --with pytest --with pyyaml --with pydantic python -m pytest -q tests/test_graph_store_contract.py tests/test_local_graph_store.py`
- 结果: collection 阶段 `2 errors`，仅缺少设计约定的 `app.graph_store_contract` 和 `app.repositories.local_graph_store`；`app`、现有 repository 和测试运行环境均已成功加载。
- 预期转绿条件: CONTRACT-BE-01 提供 canonical DTO、稳定异常、完整上下文及校验函数；LOCAL-BE-01 提供只读不可变版本、幂等写、显式失效和一至二跳查询能力。
- 行为断言: 转绿实现仍须拒绝重复节点/边、悬空和跨版本端点、无证据边、ACL 放宽、dataset 不匹配、keyword/未发布/已失效版本、深度大于 2、损坏 JSON/哈希和缺失快照；不得读取或修复自 `latest.json`。
- 隔离性: 所有文件 fixture 均位于 `TemporaryDirectory`，未读取或修改生产数据目录。
