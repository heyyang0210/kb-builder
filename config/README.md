# 配置控制面

本目录按业务对象组织，避免使用无法表达运维意图的技术分层名称。

- `knowledge-center/`：知识中心三份核心配置，分别描述产品、服务和内容规则。
- `yashandb/`：YashanDB 服务连接和存储参数；`service.env` 为本地文件，不提交。
- `pingcode/`：PingCode 加工规则、观测规则和本地凭据；`credentials.json` 不提交。
- `shared/`：确实由多个业务模块共享的加工、格式、引用和质量规则。

敏感信息允许保存在本地未跟踪文件中，但禁止提交。持续变化的知识资产、GitLab 连接和模板库位于 `runtime/knowledge-center/`，不属于静态配置发布包。
