# TASK-RAG-KG-M8-GS-CONTRACT-BE-01：GraphStore 规范模型与接口实现

## 元信息

- 状态: completed_with_environment_limitation
- 分配: backend-worker A
- 创建: 2026-08-19
- 预计完成: 开始后 3h
- 依赖: GS-TST-01 红灯证据
- 需人类确认: 否
- 可并行: 是；可与 WRITE-TST 并行
- 文件归属: `scripts/pingcode/web/backend/app/graph_store_contract.py`

## SMART 目标

在 3 小时内实现厂商无关的 GraphStore Protocol/ABC、规范 DTO、QueryContext、WriteResult、稳定异常和纯校验函数，使契约测试由红转绿。

## 验收标准

- [x] 无第三方依赖和厂商类型。
- [x] 写入和查询均强制显式 `datasetId`、`graphVersionId`；查询还要求 ACL context。
- [x] canonical 映射不从数据库内部 ID、路径或可变 latest 推导稳定 ID。
- [x] 状态只允许设计文档定义的迁移；未知状态 fail-closed。
- [x] keyword、未发布、失效版本有稳定结构化拒绝码。
- [x] 聚焦等价场景、`py_compile`、`git diff --check` 通过；正式 pytest 因系统环境未安装 pytest 而未启动。

## 实现与验证证据

- 新增 `app/graph_store_contract.py`，仅使用 Python 标准库，不包含厂商驱动、查询语言、数据库内部 ID、路径或 `latest` 逻辑。
- 导出 `GraphStore` Protocol、`GraphStoreContractError`、`ACLContext`、`GraphQueryContext`、`GraphWriteContext`、`GraphWriteRun`、canonical node/edge DTO、write result DTO 与纯校验函数。
- 2026-08-19：使用标准库 harness 执行 `test_graph_store_contract.py` 的 6 个等价场景，全部通过；覆盖 canonical schema、重复/悬空/跨版本/ACL/证据、上下文、深度和不可查询状态。
- `python3 -m py_compile scripts/pingcode/web/backend/app/graph_store_contract.py` 通过。
- scoped `git diff --check` 和目标文件尾随空白扫描通过。
- `python3 -m pytest .../test_graph_store_contract.py` 未启动：当前系统 Python 返回 `No module named pytest`；没有为此引入新依赖。
