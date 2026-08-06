# 模型网关层

## 职责

`model_gateway.py` 定义模型网关端口及默认 HTTP 适配器，负责：

- `/status`、`/config`、`/test`、`/chat` 和 `/chat/stream` 请求；
- 同步 JSON 与 SSE 响应解析；
- 根据 `timeout_ms` 和 `max_retries` 推导 HTTP 等待时间；
- `X-Internal-Token` 认证头传递；
- 将 HTTP、连接、超时和解析异常统一转换为 `ModelGatewayError`。

## 依赖方向

`TrainingService` 依赖 `ModelGateway` Protocol。`HttpModelGatewayAdapter` 实现该端口，不得导入、持有或回调 `TrainingService`，也不得依赖关键词、图谱、Skill 或任务领域对象。

测试和其他调用方可注入满足 `ModelGateway` Protocol 的 Fake。`ModelGatewayClient` 是 `HttpModelGatewayAdapter` 的兼容别名。

## 安全约束

- token 仅保存在适配器实例中，仅在非空时发送 `X-Internal-Token`；
- 不在日志、返回值或主动构造的异常中输出 token、API Key、Cookie 或完整请求正文；
- 新增端点或认证方式前，必须先更新 `docs/21-TrainingService分层重构详细设计.md`。
