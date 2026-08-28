# YashanDB 企业能力包

该能力包组合当前已经实现的 YashanDB 领域、资料加工和文档生成能力。它不保存密码、令牌、CAS 票据、模型密钥、内部地址或服务器绝对路径。

## 连接器最低配置

| 类型 | 最低密钥引用 | `configured` 口径 |
|---|---|---|
| `local-upload` | 无 | 配置结构有效即为真 |
| `pingcode` | `secret:connectors/pingcode` | 逻辑密钥可由部署密钥解析器解析 |
| `mcp` | `secret:connectors/mcp` | 逻辑连接配置可由部署密钥解析器解析 |

`configured` 不执行网络探测，不代表外部服务健康。连接器是否可用由后续健康检查单独投影。

## 事实源

- 领域：`domain/yashandb/domain.yaml`，其 `contextFiles` 继续指向同目录的实体、关系和约束定义；能力包只登记入口，不复制领域文件。
- Agent：文档生成链的 Planner、Retriever、Generator、Validator、Comparator 及对应 Prompt。
- Skill：7 类文档生成 Skill，以及资料加工的关键词和知识点抽取 Skill。
- 生成 Prompt/Profile：`agent-runner/lib/agents/prompts/`、`prompts/`、`profiles/`。
- 模板：`templates/01-` 至 `templates/07-`。
- 质量与元数据规则：`agent-runner/config/quality-config.json` 和 `scripts/pingcode/processing/metadata-rules/manifest.yaml`。前者采用精确文件白名单，不开放整个配置目录；`document-paths.json`、`model-config.json` 和 PingCode 本地配置明确排除。

## 文档生成运行约束

文档生成服务启动时形成深度只读的内部资源注册表。Agent、Prompt、生成 Skill、模板和质量规则只能按能力包中登记的 ID 或相对引用读取；直写模式传入未登记路径时必须失败，不能读取任意服务器文件。普通 Workflow 和直写任务均记录能力包 ID、企业 ID 和配置指纹，公开任务状态不包含资源绝对路径或密钥引用。

文档生成策略已通过可选的 `generationPolicies` 资源登记。策略以稳定文档类型 ID 区分通用基础、理论机制、实战调优、架构对比、运维 SOP、SQL 开发参考和兼容性差异，并分别声明全量/增量模式、来源确认、Agent/Skill/Prompt/模板、质量门禁和逻辑输出目录。策略不是可执行插件，也不保存 URL、密钥或服务器路径；任务创建时应冻结策略版本。

`prompt-generator.js` 仍保留中文类型识别和旧输出路径作为兼容适配层，以保证历史任务和旧 API 字段不变。新任务优先使用能力包策略；策略缺失或冲突时应返回结构化错误，迁移期旧入口才允许记录 `legacyPolicy` 并沿用既有口径。
