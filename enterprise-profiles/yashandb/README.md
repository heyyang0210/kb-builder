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
- Agent：`agent-runner/lib/agents/*.js` 及对应 Prompt。
- Skill：`scripts/pingcode/processing/skills/*/skill.yaml`。
- 生成 Prompt/Profile：`agent-runner/lib/agents/prompts/`、`prompts/`、`profiles/`。
- 模板：`templates/01-` 至 `templates/07-`。
- 质量与元数据规则：`agent-runner/config/quality-config.json` 和 `scripts/pingcode/processing/metadata-rules/manifest.yaml`。前者采用精确文件白名单，不开放整个配置目录；`document-paths.json`、`model-config.json` 和 PingCode 本地配置明确排除。
