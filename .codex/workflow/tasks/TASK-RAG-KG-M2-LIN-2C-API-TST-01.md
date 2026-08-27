# TASK-RAG-KG-M2-LIN-2C-API-TST-01：API-A 真实 FastAPI 红灯测试

## 元信息

- 状态: completed（真实 API-A 7/7；训练兼容回归通过）
- 分配: test-engineer
- 创建: 2026-08-18
- 预计完成: 内核、冻结适配和性能门禁完成后 3h
- 父任务: TASK-RAG-KG-M2-LIN-2C-API-01
- 依赖: KRN-BE-02、FRZ-BE-01、PERF-BE-01
- 需人类确认: 否（只写隔离 data root）
- 可并行: 否；API-BE-01 的红灯前置
- 文件归属: `scripts/pingcode/web/backend/tests/test_keyword_rebuild_api.py`

## SMART 目标

在 3 小时内通过真实 `POST /api/training/tasks`、真实 store 和 artifact repository 建立 API-A 红灯测试，不直接调用私有方法代替路由。

## 验收标准

- [x] 普通 keyword、formal 既有行为保持不变。
- [x] source dataset 不存在、跨 batch、错误状态、身份矛盾和摘要漂移结构化失败。
- [x] 成功、幂等和并发 admission 可验证，旧产物 bytes/SHA/mtime 不变。
- [x] task 异步输入漂移失败包含 `reasonCode/requestId/retryable`，中文消息不泄露绝对路径。
- [x] candidate 同 run 规则证据覆盖 100%、模型调用 0；显式探针证明 API-A 不读取 preflight `latest` 指针。
- [x] 基础真实路由、`py_compile` 和组合回归记录齐全。
- [x] 普通 keyword/formal 兼容与禁止读取 `latest` 的显式探针已补齐。

## 当前真实路由证据（2026-08-18）

- `tests.test_keyword_rebuild_api`：7/7 passed；并发用例独立重复 2 次稳定通过。
- 已覆盖：成功、幂等、模型调用 0、同 run 规则引用、旧 dataset 字节/摘要/mtime 不变、源不存在 404、跨 batch 409、非 candidate 409、manifest 身份矛盾、异步 normalized/processing 漂移失败信封，以及并发 admission 仅一个 202。
- 修复：源 dataset 先全局解析再校验 batch，避免将现存跨 batch dataset 误报为 `REBUILD_SOURCE_NOT_FOUND`。
- retryable 分类当前为显式代码集合；新增错误码时必须同步设计和回归，后续宜收敛为集中错误目录，避免分散硬编码。
- `tests.test_training_service.TrainingFailureClassificationTests` 与 API-A 联合 10/10 通过；完整 `tests.test_training_service` 此轮也已通过。
