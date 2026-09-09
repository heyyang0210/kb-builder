# 知识中心-知识资产-GitLab手册映射与协作审阅-详细设计文档

> 文档类型：模块详细设计
> 设计编号：KC-M10-GITLAB-DETAIL-001
> 状态：已实现只读闭环（待真实 GitLab 授权验收）
> 版本：0.3.0
> 更新日期：2026-09-06
> 上游概要设计：`../02-概要设计/知识中心-知识资产-GitLab手册映射与协作审阅-概要设计文档.md`
> 关联设计：`知识中心-知识资产-手册目录与文档资产-详细设计文档.md`、`知识中心-平台-外部平台连接器与回写策略-详细设计文档.md`、`知识中心-知识资产-GitLab个人授权入口-前端详细设计文档.md`

## 1. 设计范围与交付边界

本设计把已确认的知识资产手册映射到 GitLab 仓库内容，并在知识中心提供双语、多业务版本的只读阅读能力。第一阶段只交付：管理员配置仓库、扫描并确认映射、读取分支目录和 Markdown/PNG、缓存和安全渲染、前端阅读展示及审计。GitLab 分支创建、提交、MR 和 CI 查询属于后续受控连接器阶段，不因本设计而自动启用。

不在本阶段实现：按名称自动绑定并直接生效、浏览器直连 GitLab、把 CAS 会话当作 GitLab API 凭证、自动翻译、自动合并 MR、将 GitLab 状态伪装为平台发布状态、PingCode 写操作。

## 2. 配置与主数据模型

### 2.1 GitLab 连接配置

平台管理员在“平台管理 → GitLab 仓库连接”配置多个连接实例。每个连接实例代表一个可独立授权、测试、启停和审计的 GitLab 项目；连接实例不直接等于某一本手册。

最小字段：

```text
GitLab 地址：必填（HTTPS，禁止内网回调地址作为生产 OAuth 地址）
项目路径或项目 ID：必填
读取模式：disabled | sandbox | production
认证方式：用户 OAuth（默认）/ 服务端凭证引用（兼容模式）
允许的中文根目录：默认 `doc/产品文档`，可配置多个根目录
允许的英文根目录：默认 `doc/Manuals`，可配置多个根目录
```

OAuth client secret、访问令牌、CAS 票据和私钥只保存密钥存储引用，例如 `secret://kc/gitlab/client`；前端和普通业务 DTO 只显示“已配置/未配置”、连接状态、授权范围摘要和最近错误。任何配置变更都生成版本号和审计记录，不能原地覆盖正在使用的映射版本。

### 2.2 映射对象

```text
GitLabRepositoryConfig(id, provider, baseUrl, projectId, projectPath,
                      zhRootPaths[], enRootPaths[], mode, credentialRef,
                      status, version, fingerprint, createdBy, createdAt)
HandbookRepositoryMapping(id, handbookId, repositoryConfigId,
                          zhPaths[], enPaths[], enabledBranchIds[],
                          defaultBranchId, status, version, fingerprint,
                          confirmedBy, confirmedAt)
GitLabBranch(id, repositoryConfigId, name, displayName, kind,
             enabled, headSha, lastFetchedAt, version)
BranchContentSnapshot(id, mappingVersionId, branchId, language,
                      path, treeJson, headSha, fetchedAt, expiresAt)
```

关系约束：

- `GitLabRepositoryConfig` 可有多个；每个配置只指向一个 GitLab 项目。
- `HandbookRepositoryMapping.repositoryConfigId` 指向一个连接实例；一个手册同一时间只有一个生效连接映射。
- `zhPaths[]/enPaths[]` 是手册实际内容范围，可配置多个目录或文件，且必须落在该连接的对应根目录白名单内。
- 多个手册可以引用同一连接实例，但路径范围重叠时保存前必须提示影响；完全相同的手册、语言、路径和分支组合禁止重复。
- 连接配置版本和手册映射版本分别递增，任务、审阅和快照同时记录两者指纹，防止仓库切换后沿用旧事实。

同一本手册使用稳定 `handbookId` 绑定一个选择分支；分支不是新手册。路径仅选择目录或子目录，中文和英文路径独立保存。`fingerprint` 对连接配置、路径、选择分支和规则版本做 SHA-256，任务和审阅引用该指纹以防止配置漂移。

## 3. 前端配置流程

### 3.0 开发阶段 OAuth 回调约束

为先打通业务流程，开发环境允许使用回环或局域网 HTTP 回调，例如 `http://192.168.130.180:13510/knowledge-center/api/gitlab/oauth/callback`。该回调只能在 `KNOWLEDGE_CENTER_GITLAB_OAUTH_DEV_HTTP=true` 时启用，必须与配置的 `redirectUri` 完全一致，并在 OAuth 回调换 Token 前校验 `state` 、会话用户和 PKCE verifier。开发阶段 Token 仅保存在当前认证服务进程内存，进程重启后需要重新授权；不得将该方案作为生产密钥保存方式。切换 HTTPS 时必须同时关闭该开关，替换为正式 HTTPS 回调、加密凭证仓储和外部会话撤销测试。

### 3.1 配置仓库

管理员打开“集成管理 → GitLab 手册仓库”，先填写地址和项目，再点击“测试连接”。测试连接只验证地址、项目可见性、认证状态和声明的读取范围，不读取整仓正文、不创建分支、提交或 MR。成功后才能点击“扫描分支与目录”。

页面按步骤展示：

```text
连接信息 → 分支候选 → 语言根目录 → 手册映射确认 → 发布配置版本
```

当存在多个仓库连接时，页面采用“连接列表 + 当前连接详情”布局：

```text
平台管理 / GitLab 仓库连接
┌──────────────────┬──────────────────────────────────────┐
│ 已配置连接        │ 当前连接：YashanDB 正式手册            │
│                   │ 地址 / 项目 / 运行模式 / 授权状态       │
│ ● 正式手册仓库     │ [测试连接] [扫描分支与目录]             │
│ ○ 隔离验证仓库     │                                      │
│ ○ 工具产品仓库     │ 允许的内容根目录                       │
│ [+ 新增仓库连接]   │ 中文：[路径] [+ 添加路径]               │
│                   │ English：[路径] [+ 添加路径]            │
│                   │ 已关联手册：12  [查看映射]              │
└──────────────────┴──────────────────────────────────────┘
```

- 新增连接先保存为未启用草稿，必须通过测试连接后才能被手册映射选择。
- 手册映射编辑器先选择“仓库连接”，再选择该连接下的分支和多条中文/英文路径；不能把多个仓库路径混填在一个字段中。
- 切换连接时清空未保存的路径和分支选择，并显示该连接已有映射数量，防止误把路径保存到错误仓库。
- 删除连接改为“停用连接”；存在生效手册映射时禁止物理删除，需先转移映射或明确停用影响。
- 连接列表只展示名称、项目、运行模式、授权状态和更新时间，不展示令牌或凭证正文。

扫描结果明确区分“匹配候选”和“其他分支”。管理员从真实分支列表中指定一个默认分支，并勾选允许知识资产页面切换的分支集合；默认分支必须包含在启用集合中。`master` 仅在没有历史选择时作为初始候选，不作为固定业务规则。未确认的候选只保存在草稿配置中，不进入普通用户阅读入口。

### 3.2 资产映射

管理员从手册详情的“维护仓库映射”进入配置界面，查看中文/英文路径候选、`_index.md` 证据、分支存在性和目录预览，手动确认范围后保存。保存操作创建新的映射配置版本，旧任务和审阅继续引用旧版本。普通用户不显示映射维护入口。

配置弹框第二步统一命名为“手册映射路径”。中文内容路径和英文内容路径不得使用自由文本输入。管理员先明确当前选择目标为“中文内容”或“英文内容”，再从所选分支实时返回的完整仓库目录中选择。前端将 GitLab 扁平路径按父子关系组装为可展开多层目录树：根层默认可见，目录节点可展开或收起，已选路径的祖先目录自动展开；Markdown 等文件作为叶子证据展示，但只有目录节点提供“选为中文/选为英文”。已选结果以不可编辑标签分区展示，只允许从目录树增加或从标签移除。前端提交 `zhPaths/enPaths` 目录数组，不能从隐藏文本框或用户手工字符串生成路径。

切换仓库连接或选择分支时，必须清空当前未保存的中英文路径、展开状态和旧目录数据，再读取新分支的完整目录，避免跨仓库或跨分支保留失效路径。目录加载中、空目录、OAuth 未连接、无权限和外部读取失败均在树区域就近展示，不得回退为模拟目录。

已确认映射的仓库正文归入“审核与发布”统一内容工作区，不再在手册详情中提供独立“仓库内容”入口。具有 `knowledge:read` 且当前手册对其可见的用户，可以查看映射范围内的仓库内容；审阅决定、发布和映射维护仍分别按平台动作和管理员权限控制。用户 OAuth 模式下，未授权用户从正文区域就地连接自己的 GitLab 账号，不进入平台管理；详细交互见个人授权入口前端设计。

### 3.3 配置校验

提交配置版本必须通过：项目可读、路径在根目录内、路径无 `..` 穿越、中文/英文路径分别存在或明确标记缺失、选择分支名称符合允许规则、映射无空范围。历史请求中的 `enabledBranches` 仅作兼容输入，保存时归一为包含选择分支的单元素集合。失败返回字段级错误和可修复建议。

## 4. 分支发现与业务版本投影

分支发现仅产生候选：`master` 或 `^(?:br)?\\d+\\.\\d+(?:\\.\\d+)*$`。真实分支名始终保存。去除 `br` 仅用于显示，不写回 GitLab。功能、实验和 `master-*` 分支不自动开放。分支 HEAD 定期读取并缓存；管理员停用分支后，新阅读请求拒绝该分支，历史审阅仍可通过提交 SHA 查看。

## 5. 读取服务与缓存

浏览器只调用知识中心同源 API。当前默认使用登录用户的 GitLab OAuth Token；开发阶段 Token 仅保存在服务进程内存中，进程重启或 Token 过期后需要重新连接。服务账号兼容模式根据管理员配置的 `credentialRef` 解析服务端环境变量 `GITLAB_TOKEN_<credentialRef>`。两类令牌均不得进入前端、配置文件和日志。当前实现接口：

```text
GET /knowledge-center/api/gitlab/connections
PUT /knowledge-center/api/gitlab/connections
GET /knowledge-center/api/gitlab/mappings/:handbookId
PUT /knowledge-center/api/gitlab/mappings/:handbookId
GET /knowledge-center/api/gitlab/handbooks/:handbookId/branches
GET /knowledge-center/api/gitlab/handbooks/:handbookId/tree?ref=&language=&path=
GET /knowledge-center/api/gitlab/handbooks/:handbookId/file?ref=&language=&path=
GET /knowledge-center/api/gitlab/handbooks/:handbookId/access-status
GET /knowledge-center/api/gitlab/handbooks/:handbookId/oauth/start?returnTo=
POST /knowledge-center/api/gitlab/oauth/disconnect
```

连接和映射接口仅平台管理员可用，写请求必须携带 `Idempotency-Key`。普通登录用户只能调用 `handbookId` 级读取接口；通用 `connectionId` 分支、目录和文件接口仅用于管理员诊断，不能作为普通阅读入口。资产列表只返回 `repositoryMapped` 和确认状态，不向普通用户暴露连接 ID、凭证引用或整仓范围。

当前目录读取按 GitLab API 每页 100 条连续取数，最多 2000 条；超限显式失败，不把截断结果表述为完整目录。文件只允许 Markdown 和图片，单文件上限 5MB。路径必须位于手册已确认的中/英文映射范围和连接 `pathPrefix` 内。

所有响应统一返回 `success/data` 或 `success/error`。树和文件读取响应包含真实分支名、短 SHA、映射版本、`fetchedAt`、`cacheHit` 和内容摘要。缓存键为 `mappingFingerprint + branch + language + path + headSha`，短时 TTL 由连接器配置，不能在 HEAD 变化时继续宣称最新。手动刷新只刷新阅读投影，不改变任务基线或审阅锚点。

读取失败按语义区分：

| 错误码 | 含义 | 前端提示 |
|---|---|---|
| `GITLAB_NOT_CONFIGURED` | 未配置连接 | “GitLab 尚未配置” |
| `GITLAB_OAUTH_REQUIRED` | 当前用户尚未完成 OAuth，且未启用服务账号兼容模式 | “请先连接 GitLab 账号” |
| `GITLAB_REAUTH_REQUIRED` | OAuth 过期/撤销 | “需要重新连接 GitLab” |
| `GITLAB_FORBIDDEN` | 外部账号无权 | “当前账号无权读取该项目” |
| `GITLAB_MAPPING_REJECTED` | 路径/分支不在已确认映射 | “内容范围未开放” |
| `GITLAB_NOT_FOUND` | 项目、分支或文件不存在 | “内容已不存在或已移动” |
| `GITLAB_RATE_LIMITED` | 外部限流 | “读取频繁，请稍后重试” |
| `GITLAB_UNAVAILABLE` | 网络或服务暂不可用 | “GitLab 暂时不可用” |
| `GITLAB_CONTENT_TOO_LARGE` | 超过单文件/目录限制 | “内容过大，无法在线展示” |
| `GITLAB_RENDER_REJECTED` | 内容安全校验失败 | “内容包含不允许的嵌入内容” |

不得用空白正文、示例数据或旧缓存冒充成功；缓存过期且无法刷新时应显示对应提交的“缓存内容”标识。

## 6. 阅读工作区

阅读页路由为 `/knowledge-center/assets/:handbookId/repository`，参数包括 `branch`、`lang`、`path`。桌面端采用“仓库目录 + 文档内容”双栏；审核与发布作为正文区域的工作上下文，不单独占用第三栏。移动端按目录和正文顺序纵向展示。首屏显示手册名、分支显示名/真实名、语言、短 SHA 和刷新时间。目录按 `_index.md` 顺序构造，索引文件本身不作为重复正文；相对 Markdown 链接、锚点和 PNG 图片按当前提交解析并经同源资源代理返回。

Markdown 渲染必须使用共享安全渲染层：允许标题、段落、列表、表格、代码块、提示块和安全链接；过滤脚本、事件属性、危险协议、外部 iframe 和未授权资源。渲染失败降级为转义后的原文并保留错误原因，禁止直接写入未经清理的 `innerHTML`。

## 7. 权限与审计

平台管理员可新增/修改连接配置、读取真实分支，并确认默认分支、允许切换的启用分支集合及内容映射；A/B 角可查看所属手册并发起审阅；具有 `knowledge:read` 的普通授权成员只读。后端每次操作同时校验用户动作、手册可见范围、映射范围和 GitLab OAuth 权限，前端隐藏按钮不能替代后端校验。用户可以连接或解除自己的 GitLab 授权，但不能查看连接清单、其他用户授权或凭证。审计记录包括操作者、动作、配置/映射版本、项目 ID、分支、路径、结果和错误码，严禁记录令牌正文、Cookie 或完整响应。

## 8. 协作审阅衔接

批注绑定 `handbookId + mappingVersion + branch + headSha + path + selectedText + contextDigest`。分支更新后无法唯一定位时显示“原位置已变化”，不得静默附着到新文本。采纳建议只创建平台候选变更；正式 GitLab 文件保持只读。后续写入阶段需通过独立的基线校验、差异、审核和 MR 任务，不在阅读接口中执行写操作。

## 9. 并发、失败恢复和运维

配置和映射保存使用版本号、幂等键及文件/数据库事务；同一手册同时修改时返回 `MAPPING_BASELINE_CONFLICT`。连接器读取采用超时、限流和指数退避，禁止无限重试。配置发布失败可回滚到上一有效版本；读取失败不改变已生效映射。模式 `disabled` 下所有真实 GitLab API 调用拒绝，`sandbox` 仅允许隔离项目，`production` 需专项验收和启用记录。

## 10. 验收清单

- 管理员可配置 GitLab 地址、项目、中文/英文根目录并保存版本化配置。
- OAuth Application Secret 通过服务端环境配置，用户 Token 在开发阶段仅存进程内存；前端、配置文件和日志均无敏感信息。
- 分支读取只产生候选列表，管理员确认默认分支和允许切换的启用分支后才生效；默认分支必须属于启用集合。
- 40 本资产可逐项确认“已确认候选/待人工确认/无关联”，未关联不显示错误。
- 阅读页完整展示目录、Markdown、表格、代码和 PNG；相对链接按当前提交解析。
- 分支、路径、权限、限流、超大文件和服务不可用均有明确错误语义。
- 缓存与 HEAD/提交绑定，手动刷新不改变增量任务和审阅基线。
- 恶意 Markdown/HTML 不执行脚本，渲染失败可安全降级。
- 批注锚点绑定提交，分支更新后能识别漂移并要求人工处理。
- 本阶段不调用 GitLab 写接口、不创建分支/MR，不伪造 CI 或平台发布状态。

## 11. 实施状态与剩余门禁

已实现：管理员多连接配置、单一选择分支手册映射、用户 OAuth、服务账号凭证引用兼容模式、原子配置写入、幂等和审计；普通用户按手册映射读取分支、完整分页目录、Markdown/图片文件；知识资产入口、中英文切换、目录树、正文、提交 SHA 和错误状态。

未完成生产验收：开发环境 OAuth Application 与 HTTP 回调已配置，但当前服务进程尚无已授权用户 Token；已确认连接器进入生产读取模式，未授权请求会返回 `GITLAB_OAUTH_REQUIRED` 并引导连接 GitLab。完成真实用户授权后，仍需验证 `yasdoc` 分支、中文路径 `doc/产品文档/产品描述`、英文路径 `doc/Manuals/Product Overview` 的真实读取。正式 HTTPS 回调、持久化加密 Token 仓储、40 本手册最终路径映射和共享 Markdown 渲染器仍是后续门禁。当前安全渲染层已支持标题、段落、列表和代码块，表格、提示块、相对图片/文档链接的完整规则仍需专项验收，不宣称已与原生成器完全等价。

## 12. 后续进入 GitLab 写入与协作审阅实施的前置条件

GitLab OAuth Application、正式 HTTPS 回调、隔离测试仓库、40 本资产映射确认和安全渲染专项测试完成后，才能冻结具体 GitLab API DTO、数据库表、写入任务和 MR/CI 查询实现。本文件当前不构成生产写入授权。
