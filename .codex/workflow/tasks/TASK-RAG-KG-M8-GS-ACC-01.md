# TASK-RAG-KG-M8-GS-ACC-01：LocalGraphStore 真实后端 API 验收

## 元信息

- 状态: blocked
- 分配: test-engineer
- 创建: 2026-08-19
- 预计完成: 解阻后 4h
- 依赖: GS-API-BE-01、隔离 formal 数据集、RG-20/23
- 阻塞: 同 API 接线门禁
- 需人类确认: 隔离数据集写入许可；不使用生产批次
- 可并行: 否
- 文件归属: `agent-runner/docs/modules/knowledge-graph-governance/testing/05-local-graph-store-api-acceptance.md`

## SMART 目标

在 4 小时内通过真实 FastAPI/TestClient 完成“正式版本发布事实 -> 本地投影 -> 有界查询 -> 失效”的端到端验收，并形成可复现报告。

## 验收标准

- [ ] API 验证一次成功、幂等重试、并发 admission、部分失败恢复和失效。
- [ ] 节点/边计数、端点、版本指纹、证据抽样和 ACL 校验一致。
- [ ] 越权成功数、错误版本回退数、keyword 冒充数均为 0。
- [ ] 故障注入后事实源 bytes/SHA 不变。
- [ ] 1k/10k 隔离规模记录吞吐、P95、RSS 和锁等待；不虚构 100k 结果。
- [ ] 相关 M2、图版本和 GraphStore 组合回归通过；失败项原样记录。
