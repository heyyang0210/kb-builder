# 企业能力包

本目录保存知识中心建设平台的企业能力包注册表和组合配置。能力包只引用仓库中的既有事实源，不复制领域规则、Prompt、Skill、模板或质量规则正文。

- [注册表](./registry.json)
- [YashanDB 企业能力包](./yashandb/README.md)

生产部署通过 `KNOWLEDGE_PLATFORM_PROFILE=<profile-id>` 选择注册项。注册表中只能登记通过评审的能力包，不能接受任意文件路径。
