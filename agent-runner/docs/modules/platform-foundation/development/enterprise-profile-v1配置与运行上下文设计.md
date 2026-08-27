# enterprise-profile/v1 配置与运行上下文设计

> 文档类型：开发设计
> 设计编号：KPG-PROFILE-001
> 状态：已冻结
> 版本：1.0.0
> 更新日期：2026-08-27

## 1. 目的与边界

本文定义 `enterprise-profile/v1` 的逻辑结构、加载时序、配置指纹、脱敏投影和错误语义。机器契约以仓库根目录 `contracts/enterprise-profile/v1/enterprise-profile.schema.json` 为事实源，本文作为 TASK-KPG-03 双端加载器的开发输入，不定义凭证存储实现。

能力包描述“这个企业部署启用什么业务能力和资源”，部署配置描述“服务在哪里运行以及如何访问密钥”。端口、主机、数据根目录、CORS、内部令牌和上传限额属于部署配置，不允许被能力包覆盖。

## 2. 逻辑结构

```yaml
apiVersion: enterprise-profile/v1
kind: EnterpriseProfile
metadata:
  id: yashandb
  version: 1.0.0
  displayName: YashanDB 企业能力包
  language: zh-CN
brand:
  platformName: 知识中心建设平台
  enterpriseName: YashanDB
  productName: YashanDB 知识中心
modules: []
workspaces: []
domain:
  id: yashandb
  version: 1.0.0
  manifestRef: domain/yashandb/manifest.json
connectors: []
agents: []
skills: []
prompts: []
templates: []
qualityRules: []
logicalDirectories: []
capabilities: []
compatibility: {}
runtimeProjection: {}
```

TASK-KPG-02 必须为下列集合项定义稳定 ID、重复检查和引用关系：

| 字段 | 关键属性 |
|---|---|
| `modules[]` | `id`、`enabled`、`workspaceRef` |
| `workspaces[]` | `id`、`displayName`、公开 `basePath`、后端标识 |
| `connectors[]` | `id`、`type`、`enabled`、`capabilityRefs[]`、`secretRefs[]` |
| `agents[]`、`skills[]` | `id`、版本和 `manifestRef` |
| `prompts[]`、`templates[]`、`qualityRules[]` | `id`、版本和 `resourceRef` |
| `logicalDirectories[]` | `id`、`displayName`、逻辑 `pathRef`、`writable` |
| `capabilities[]` | `id`、`enabled` |

## 3. 引用和敏感信息规则

1. 文件引用使用仓库内相对路径；禁止绝对路径和 `..` 越界。
2. 解析后的真实路径必须位于允许资源根目录内；越界符号链接必须拒绝。
3. `basePath` 只表示公开 URL 路径，不得解释为服务器文件路径。
4. `secretRefs` 只允许环境变量名或逻辑密钥 ID，不允许凭证值。
5. Schema 必须拒绝 `password`、`token`、`apiKey`、`cookie`、`casTicket` 等承载敏感值的未知字段。
6. 禁止重复 ID、未知模块和悬空引用。
7. YashanDB 包引用现有 `domain/yashandb/`，不复制领域定义。
8. 本地地址、绝对路径、密钥引用解析结果和正文数据不得进入前端投影。

## 4. 加载优先级和生命周期

```text
显式测试参数
  > KNOWLEDGE_PLATFORM_PROFILE
  > 部署登记的默认 YashanDB 能力包
```

生产部署中的 `KNOWLEDGE_PLATFORM_PROFILE` 只接受稳定 profile ID，不接受任意文件路径。ID 由受控注册表解析到允许根目录内的 manifest；测试加载器可以通过显式参数读取 fixture，但该能力不暴露为生产环境变量。空字符串按“显式非法选择”处理，只有环境变量不存在才表示未设置。

未设置环境变量与显式配置错误是两种不同语义：前者允许选择默认包；后者必须 fail-fast。加载器不得在读取、Schema、引用或安全校验失败后退回旧硬编码。

```text
选择能力包
  -> 读取并解析 JSON/YAML
  -> 校验 apiVersion、kind 和 Schema
  -> 校验路径、引用、ID 和敏感字段
  -> 读取被引用资源并计算内容摘要
  -> 构建规范化对象
  -> 计算配置指纹
  -> 生成内部只读上下文
  -> 生成脱敏公开投影
  -> 注入业务服务
  -> 启动监听
```

首轮只支持启动期加载和重启生效。Node 与 Python 都应先完成能力包验证，再创建可能写入磁盘、启动 watcher 或连接外部系统的业务单例。

## 5. 规范化与配置指纹

指纹输入由规范化 profile 和所有被引用资源的内容摘要构成。规范 JSON 使用 UTF-8、对象键递归排序、数组保持原顺序、无多余空白。

指纹格式固定为 `sha256:<64 位小写十六进制>`。字符串在计算前规范化为 Unicode NFC；JSON 不转义非 ASCII 字符。Schema 禁止非有限数字并消除 `-0` 歧义；`null`、空数组和空对象作为显式语义保留。逻辑路径统一使用 `/`，不能把操作系统路径分隔符带入规范对象。

不得进入指纹：

- 本机绝对路径和文件修改时间。
- 凭证值和密钥解析结果。
- `loadedAt`、进程号、端口等运行态字段。

伪代码：

```text
loadProfile(selection):
  manifest = parse(selection)
  validateSchema(manifest)
  references = validateAndResolveReferences(manifest)
  resourceDigests = references.map(ref => sha256(readBytes(ref)))
  canonical = canonicalJson({
    profile: normalize(manifest),
    resources: resourceDigests sorted by logical reference
  })
  fingerprint = sha256(utf8(canonical))
  return freeze(buildRuntimeContext(manifest, fingerprint))
```

Node 与 Python 必须使用共享黄金向量验证：相同输入产生逐字节相同指纹；仅对象键顺序变化不改变指纹；数组顺序或资源内容变化应改变指纹。

## 6. 运行上下文

内部上下文可以持有经过校验的资源定位和密钥引用，但业务模块只能通过只读接口访问。公开投影建议冻结为：

```text
schemaVersion
profileId
enterpriseId
displayName
brand
capabilities[]
workspaces[]
connectors[]: id, type, enabled, configured
configFingerprint
loadedAt
```

`configured` 只表示最低配置和密钥引用可解析，不表示已执行外部连通性探测。其最终判定规则在 TASK-KPG-02 冻结。

Node 与 Python 分别暴露相同语义的脱敏上下文；3500 只代理或汇聚健康结果，不重新解释企业契约。字段命名在公共 HTTP 契约中统一使用 camelCase，语言内部对象可按本地惯例实现但必须通过契约映射测试。

Node 文档生成链额外维护不公开的深度只读资源注册表，按集合、资源 ID 和规范仓库相对引用索引启动时已经校验的文件。Agent Prompt、生成 Skill、模板和质量规则只能通过该注册表读取；注册表中的真实路径只用于进程内文件访问，不进入 HTTP、Socket.IO、日志摘要或配置指纹。普通 Workflow、直写任务及直写过程元数据冻结同一组 `profileId`、`enterpriseId` 和 `configFingerprint`，追加字段不得改变旧任务状态字段。

Python 资料加工链通过只读 `RuntimeProfile` 读取领域 ID/版本、企业品牌、登记 Skill 根和非敏感追溯字段。知识提取信封、候选记录及标准化产物记录 profile ID、版本和指纹；运行配置接口在 TASK-KPG-06 只投影品牌，完整公共上下文接口由 TASK-KPG-07 统一实现。`YashanDBErrorCode`、`OracleErrorCode` 和既有 `yashandb.*` term ID 属于历史事实兼容层，不随平台品牌配置化而重命名。

接口路径固定为双端 `GET /api/platform/context` 和 3500 的 `GET /knowledge-center/api/platform/context`。单模块故障时聚合响应保持 HTTP 200 并返回 `status: degraded`；双模块故障或无法形成平台投影时返回 HTTP 503。该规则只适用于运行期模块故障，启动期能力包错误必须让对应进程非零退出。

TASK-KPG-07 的 HTTP 实现沿用已通过双语言指纹对账的公开投影字段，不单独追加领域版本、模块列表或 `loadedAt`。模块可用性由 3500 聚合外壳表达；领域版本若需成为公共 HTTP 字段，必须先修订共享契约并同步两端黄金向量。聚合层对缺少 `schemaVersion`、`profileId`、`enterpriseId` 或 `configFingerprint` 的成功响应按 `MODULE_UNAVAILABLE` 处理，不将畸形投影用于平台展示。

## 7. 错误语义

| 错误码 | 场景 | 是否可重试 |
|---|---|---:|
| `PROFILE_NOT_FOUND` | 显式选择的能力包不存在 | 否 |
| `PROFILE_PARSE_FAILED` | JSON/YAML 无法解析 | 否 |
| `PROFILE_VERSION_UNSUPPORTED` | `apiVersion` 或 `kind` 不支持 | 否 |
| `PROFILE_VALIDATION_FAILED` | Schema、ID 或引用关系非法；通过 `issueCode` 区分具体原因 | 否 |
| `PROFILE_PATH_FORBIDDEN` | 绝对路径、越界或符号链接逃逸；通过 `issueCode` 定位 | 否 |
| `PROFILE_SECRET_EXPOSED` | 检出禁止的敏感字段或值；`issueCode` 为 `SECRET_FIELD` 等 | 否 |
| `PROFILE_RESOURCE_NOT_FOUND` | 被引用资源不存在 | 否 |
| `PROFILE_FINGERPRINT_MISMATCH` | 双端运行上下文指纹不一致 | 重启或部署修复后可恢复 |
| `MODULE_UNAVAILABLE` | 运行期单个模块不可用 | 是 |
| `MODULE_TIMEOUT` | 聚合读取模块上下文超时 | 是 |

错误响应使用统一外壳；配置错误额外提供稳定 `issueCode` 和 JSON Pointer `path`。启动日志可以记录 profile ID、版本、错误码、问题码和请求/启动关联 ID，不得记录能力包全文、绝对路径或密钥值。

## 8. 契约测试输入

TASK-KPG-02/03 至少提供：

- 最小合法包、完整 YashanDB 包。
- 未知顶级字段和未知嵌套字段。
- 重复 ID、悬空能力/工作区/资源引用。
- 绝对路径、`..`、允许根目录外路径和越界符号链接。
- 明文密码、令牌、CAS 票据和伪装敏感字段。
- 键顺序变化、数组顺序变化、资源内容变化和不同换行编码。
- 默认选择、显式合法选择和显式非法选择。
- Node/Python 公开投影的字段、值类型和脱敏一致性。

## 9. 已冻结的契约细节

- 能力包只支持 JSON；ID 使用 2 至 64 位小写 kebab-case，版本只接受无前导零的 `MAJOR.MINOR.PATCH`，不支持 prerelease/build metadata，语言固定为 `zh-CN`。
- Profile 由受控注册 ID 选择，文件引用以仓库根目录为基准。允许根包括能力包契约、领域、Skill 和已登记 Prompt 资源，不允许笼统引用含密钥或部署路径的 `agent-runner/config/`；Schema 拒绝 URI、绝对路径、反斜杠、重复分隔符、控制字符、`.` 和 `..`，TASK-KPG-03 继续做存在性、普通文件和符号链接检查。
- `secretRefs` 只接受 `env:ENV_NAME` 或 `secret:logical/key`。
- 历史实体别名由 `compatibility.entityTypeAliases` 按“历史实体类型 -> 当前规范类型”表达，只影响兼容读取，不改写历史数据。
- `configured` 是运行时派生值：最低字段完整且所有密钥引用可解析时为真，不包含连通性探测。
- Node 使用仓库自有确定性校验器，只实现本 Schema 使用的关键字，并通过同一 fixture 与 Python `jsonschema` 对账；不再依赖传递依赖偶然存在。
