# TASK-KPG-04：整理 YashanDB 企业能力包配置

## 元信息

- 任务编号：TASK-KPG-04
- 标题：整理 YashanDB 企业能力包配置
- 状态：已完成
- 分配：Architect / Config Owner / Doc Writer
- 依赖：TASK-KPG-03
- 需人类确认：否，发现冲突业务规则时需要
- 可并行：否
- 文件归属：YashanDB 企业能力包、配置引用说明和迁移矩阵
- 参考文档：现有 `domain/yashandb/`、`profiles/`、Agent、Skill、Prompt、模板和质量规则

## 目标

把现有 YashanDB 品牌和领域配置组合成首个完整企业能力包，引用已有事实源，不复制领域规则，不携带真实凭证。

## 工作内容

1. 登记平台名称、企业标识、领域版本和启用模块。
2. 引用领域模型、术语、连接器、Agent、Skill、Prompt、模板和质量规则。
3. 将本地上传、PingCode 和 MCP 声明为数据源能力，凭证只使用密钥引用。
4. 更新配置迁移矩阵，登记尚未迁移的硬编码位置。

## 验收标准

- [x] 能力包通过 Schema 和双端加载器测试。
- [x] 不含令牌、密码、私有密钥、CAS 票据和服务器绝对路径。
- [x] `domain/yashandb/` 等现有事实源通过引用复用，无第二份可编辑副本。
- [x] 配置指纹稳定，能力声明与当前实际实现一致。

## 执行日志

2026-08-27 完成：

- 新增 `enterprise-profiles/registry.json` 和 YashanDB 企业能力包，登记文档生成、资料加工两个工作区。
- 组合现有领域入口、4 个 Agent、2 个加工 Skill、5 个生成 Prompt、7 个模板和质量/元数据规则入口；不复制事实源正文。
- 冻结 `local-upload`、`pingcode`、`mcp` 三类连接器及最低密钥引用规则；连接器健康与 `configured` 仍分开表达。
- 加入质量配置单文件白名单，明确排除 `agent-runner/config/document-paths.json`、`model-config.json` 和本地 PingCode 配置。
- 验证：Node 19/19、Python 6/6 加载器与契约测试通过；完整包资源数量 21，默认双端指纹一致；JSON、语法、差异空白和敏感信息/绝对路径扫描通过。
- 迁移矩阵已更新：品牌、领域、Agent/Skill/Prompt/模板、连接器和质量规则均有能力包入口；底层硬编码迁移留给 TASK-KPG-05/06。
