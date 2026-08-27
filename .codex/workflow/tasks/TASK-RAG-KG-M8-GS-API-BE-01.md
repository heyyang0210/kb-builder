# TASK-RAG-KG-M8-GS-API-BE-01：正式版本查询与本地投影接线

## 元信息

- 状态: blocked
- 分配: backend-worker B
- 创建: 2026-08-19
- 预计完成: 解阻后 4h
- 依赖: GS-API-TST-01 红灯证据、RG-20、RG-23
- 阻塞: M2 ACL 和真实身份验收未完成
- 需人类确认: 否；不改公共 URL，不放宽权限
- 可并行: 否
- 文件归属: `scripts/pingcode/web/backend/app/graph_version_service.py`、`app/main.py`

## SMART 目标

在 4 小时内将正式 graph version 的查询和发布后本地投影接到 GraphStore/GraphProjectionService，同时保持现有公共 URL 和错误兼容。

## 验收标准

- [ ] `GraphVersionService` 不再自行实现第二套邻域遍历。
- [ ] 发布事实成功后只创建投影任务，不同步双写外部存储。
- [ ] 所有正式查询先完成身份、dataset ACL、版本和发布状态校验。
- [ ] LocalGraphStore 是默认实现；外部 Adapter 保持 disabled。
- [ ] 错误映射稳定且不泄露底层路径/正文。
- [ ] 不改变 keyword observability 当前业务语义，不将其升级为 GraphRAG。
- [ ] 红灯测试转绿、现有图版本/API 回归、`py_compile`、`git diff --check` 通过。
