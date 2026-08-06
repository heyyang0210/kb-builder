# TASK-TSR-P2-01: 提取 Model Gateway 服务

## 元信息
- 状态: completed
- 分配: backend-worker
- 创建: 2026-08-05
- 预计完成: 2026-08-06
- 预计工时: 4 小时
- 依赖: TASK-TSR-P1-01
- 需人类确认: 否
- 可并行: 否

## SMART 目标
在 4 小时内将模型网关接口、HTTP 客户端、网关异常和错误摘要提取为独立模块，保持同步 JSON、动态超时、认证头和 SSE 流式行为，且不改变 `TrainingService` 公共 API。

## 需求描述
- 新模块不得持有或导入 `TrainingService`，不得形成循环依赖。
- 保持 `/status`、`/config`、`/test`、`/chat`、`/chat/stream` 请求契约。
- 使用标准库本地 fake HTTP server 完成聚焦测试，不引入外部依赖。
- 保持中文错误语义，不记录 token、API key、Cookie 或完整正文。

## 参考文档
- `docs/12-PingCode知识提取步骤详细设计.md`
- `docs/21-TrainingService分层重构详细设计.md`
- `scripts/pingcode/web/backend/app/training_service.py`

## 验收标准
- [x] `ModelGateway` 接口及 HTTP 实现符合设计，无新增第三方依赖。
- [x] `timeout_ms` 与重试次数推导、异常类型和 SSE 事件行为与重构前一致。
- [x] HTTP 4xx/5xx、无效 JSON、连接失败、超时和流结束测试通过。
- [x] `TrainingService` 默认构造和 FakeGateway 注入仍可用。
- [x] 模块 README 已说明职责、依赖方向和安全约束。

## 预计变更文件
- `scripts/pingcode/web/backend/app/gateways/__init__.py` (added)
- `scripts/pingcode/web/backend/app/gateways/model_gateway.py` (added)
- `scripts/pingcode/web/backend/app/gateways/README.md` (added)
- `scripts/pingcode/web/backend/app/training_service.py` (modified)
- `scripts/pingcode/web/backend/tests/test_model_gateway.py` (added)

## 执行日志

- 2026-08-05 Reporter：依据 11/11 网关契约测试、TrainingService 回归及真实模型测试 HTTP 200 证据复核，状态保持 `completed`，5 项验收标准全部满足。
- 2026-08-05：新增 `ModelGateway` Protocol 和 `HttpModelGatewayAdapter`，迁移同步 JSON、动态超时、认证头、SSE 流式读取及网关异常处理。
- 2026-08-05：在网关模块提供 `ModelGatewayClient` 兼容别名；`TrainingService` 构造参数收窄到 Protocol，并保留旧测试 `app.training_service.urlopen` 补丁点所需的薄兼容类。
- 2026-08-05：迁移 `ModelGatewayError`、`error_summary`、`utcnow` 和 `stable_id`；训练取消与模型测试异常按设计继续由训练门面持有。
- 2026-08-05：新增网关层 README，确认新模块不导入、不持有 `TrainingService`，且未引入第三方依赖。
- 2026-08-05：`python3 -m py_compile app/gateways/__init__.py app/gateways/model_gateway.py app/training_service.py` 通过。
- 2026-08-05：网关与训练服务导入、兼容别名和兼容子类断言通过。
- 2026-08-05：`python3 -m unittest tests.test_model_gateway -v` 通过，共 11 项。
- 2026-08-05：`python3 -m unittest tests.test_training_service.TrainingErrorSummaryTests -v` 通过，共 2 项。
- 2026-08-05：`python3 -m unittest tests.test_training_service -v` 通过，共 67 项，包含受保护关键词、正式知识、训练取消和图谱用例。
- 2026-08-05：未执行真实后端 API 和真实模型网关验收；本任务仅完成模块提取和现有聚焦测试，真实链路由 Phase 2 汇总验收执行。

## 实际变更文件

- `scripts/pingcode/web/backend/app/gateways/__init__.py`（新增）
- `scripts/pingcode/web/backend/app/gateways/model_gateway.py`（新增）
- `scripts/pingcode/web/backend/app/gateways/README.md`（新增）
- `scripts/pingcode/web/backend/app/training_service.py`（修改）
- `.codex/workflow/tasks/TASK-TSR-P2-01.md`（修改）
