# enterprise-profile/v1 配置与运行上下文设计

> 文档类型：开发设计
> 设计编号：KPG-PROFILE-001
> 状态：TASK-KPG-02 冻结前的架构基线
> 版本：0.1.0
> 更新日期：2026-08-27

## 1. 目的与边界

本文定义 `enterprise-profile/v1` 的逻辑结构、加载时序、配置指纹、脱敏投影和错误语义，作为 TASK-KPG-02 Schema 与 TASK-KPG-03 双端加载器的输入。本文不替代可执行 JSON Schema，也不定义凭证存储实现。

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

接口路径固定为双端 `GET /api/platform/context` 和 3500 的 `GET /knowledge-center/api/platform/context`。单模块故障时聚合响应保持 HTTP 200 并返回 `status: degraded`；双模块故障或无法形成平台投影时返回 HTTP 503。该规则只适用于运行期模块故障，启动期能力包错误必须让对应进程非零退出。

## 7. 错误语义

| 错误码 | 场景 | 是否可重试 |
|---|---|---:|
| `PROFILE_NOT_FOUND` | 显式选择的能力包不存在 | 否 |
| `PROFILE_PARSE_FAILED` | JSON/YAML 无法解析 | 否 |
| `PROFILE_VERSION_UNSUPPORTED` | `apiVersion` 或 `kind` 不支持 | 否 |
| `PROFILE_VALIDATION_FAILED` | Schema、ID 或引用关系非法 | 否 |
| `PROFILE_PATH_FORBIDDEN` | 绝对路径、越界或符号链接逃逸 | 否 |
| `PROFILE_SECRET_EXPOSED` | 检出禁止的敏感字段或值 | 否 |
| `PROFILE_RESOURCE_NOT_FOUND` | 被引用资源不存在 | 否 |
| `PROFILE_FINGERPRINT_MISMATCH` | 双端运行上下文指纹不一致 | 重启或部署修复后可恢复 |
| `MODULE_UNAVAILABLE` | 运行期单个模块不可用 | 是 |
| `MODULE_TIMEOUT` | 聚合读取模块上下文超时 | 是 |

错误响应使用统一外壳；启动日志可以记录 profile ID、版本、错误码和请求/启动关联 ID，不得记录能力包全文、绝对路径或密钥值。

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

## 9. 未决输入

以下内容由 TASK-KPG-02 冻结后将本文状态提升为正式开发设计：

- ID 格式、版本格式和公开字段长度限制。
- 允许资源根目录和 Profile 相对路径基准。
- `secretRefs` 的两种引用形式及格式。
- 历史实体类型别名映射结构。
- `configured` 的确定性判定规则。
- JSON 与 YAML 是否同时作为正式输入格式；若无必要，优先只支持 JSON 以减少双语言解析差异。
