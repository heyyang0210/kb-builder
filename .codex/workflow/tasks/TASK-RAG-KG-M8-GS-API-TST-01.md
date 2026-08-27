# TASK-RAG-KG-M8-GS-API-TST-01：正式图 Adapter 接线红灯 API 测试

## 元信息

- 状态: blocked
- 分配: test-engineer
- 创建: 2026-08-19
- 预计完成: 解阻后 4h
- 依赖: GS-LOCAL-BE-01、GS-WRITE-BE-01、RG-20、RG-23
- 阻塞: 缺可信身份参数和隔离测试身份；G2.5 未通过
- 需人类确认: 外部身份事实必须提供，不能推测
- 可并行: 否；先于 API 实现
- 文件归属: `scripts/pingcode/web/backend/tests/test_graph_store_api.py`

## SMART 目标

在 M2 安全依赖满足后 4 小时内，为不改变现有 URL 的正式版本查询/投影接线建立真实 FastAPI 红灯测试。

## 验收标准

- [ ] 只使用隔离 formal/published graph fixture 和真实认证依赖。
- [ ] 匿名、跨 dataset、直接 ID、历史撤权和 ACL 故障全部 fail-closed。
- [ ] 请求必须绑定 datasetId、graphVersionId、ACL context；不读 latest。
- [ ] keyword、candidate、partial、failed、invalidated 版本查询均被拒绝。
- [ ] GraphStore 不可用返回 `GRAPH_STORE_UNAVAILABLE`，不静默切换版本。
- [ ] 现有 API 路径/响应兼容测试保留；记录红灯证据。
