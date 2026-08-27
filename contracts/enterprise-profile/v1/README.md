# enterprise-profile/v1 契约

该目录是知识中心建设平台企业能力包的机器契约事实源。当前版本只支持 JSON，避免 Node 与 Python 因 YAML 隐式类型产生语义差异。

## 目录

```text
v1/
├── enterprise-profile.schema.json
├── fixtures/
│   ├── valid/
│   ├── invalid/
│   └── resources/
└── README.md
```

## 校验分层

1. JSON Schema 校验字段、类型、必填项、枚举、格式和未知字段。
2. 语义校验拒绝重复 ID、悬空引用、明文敏感字段、绝对路径和目录越界。
3. TASK-KPG-03 的加载器在真实文件系统上继续校验引用存在、允许资源根和符号链接逃逸。

错误必须包含稳定公共 `code`、精确 `issueCode` 和 JSON Pointer `path`。公共 `code` 使用架构设计冻结的分类；`issueCode` 区分 `SCHEMA_INVALID`、`REFERENCE_DUPLICATE`、`REFERENCE_UNKNOWN`、`ABSOLUTE_PATH`、`PATH_OUT_OF_ROOT` 和 `SECRET_FIELD` 等确定性原因。用户界面使用中文消息；底层 Schema 库的英文文本只用于诊断，不作为公共接口。

## 冻结规则

- `metadata.id` 和 `enterpriseId` 使用小写 kebab-case，2 至 64 个字符，部署期间保持稳定并允许进入脱敏投影。
- 版本只接受无前导零的 `MAJOR.MINOR.PATCH`，本版本不支持 prerelease 或 build metadata；语言固定为 `zh-CN`。
- `KNOWLEDGE_PLATFORM_PROFILE` 只接受注册 profile ID，不接受文件路径。
- 文件引用以仓库根目录为基准，使用 `/` 分隔的相对路径；当前允许根包括 `contracts/enterprise-profile/`、`domain/`、`skills/`、`agent-runner/lib/agents/`、`scripts/pingcode/processing/skills/`、`scripts/pingcode/processing/metadata-rules/`、`profiles/`、`prompts/` 和 `templates/`。质量配置只精确放行 `agent-runner/config/quality-config.json`，不得由此推导整个配置目录可引用。禁止引用 PingCode 凭证配置、模型配置、运行产物和备份，并拒绝 URI、`~`、控制字符、POSIX/Windows/UNC 绝对路径、反斜杠、重复 `/`、`.` 和 `..` 路径段。
- `secretRefs` 只接受 `env:ENV_NAME` 或 `secret:logical/key`，不保存值。
- `logicalDirectories.pathRef` 只接受 `deployment:<logical-id>`，由服务部署配置解析。
- `connectors[].configured` 不属于能力包输入；`local-upload` 无密钥依赖，`pingcode` 必须声明 `secret:connectors/pingcode`，`mcp` 必须声明 `secret:connectors/mcp`。运行时仅在最低引用完整且所有 `secretRefs` 可解析时派生为 `true`，不执行连通性探测。
- `entityTypeAliases` 的方向固定为“历史实体类型 -> 当前规范类型”；该映射只用于兼容读取，不触发历史数据重写。

## 测试

```bash
cd agent-runner
npx jest tests/enterprise-profile-contract.test.js --runInBand

cd scripts/pingcode/web/backend
python3 -m unittest tests.test_enterprise_profile_contract
```

有效 fixture 仅提供 YashanDB，不创建虚构企业。无效 fixture 以最小有效包为基线，每个文件只引入一个主错误。

Node 生产侧的 `schema-validator.js` 只实现本 Schema 实际使用的关键字，不宣称是通用 Draft 2020-12 实现；其判定必须持续与 Python `jsonschema` 对同一 fixture 对账。
