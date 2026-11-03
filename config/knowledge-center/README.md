# 知识中心配置

文档生产任务默认在服务启动时扫描过期租约；设置 `KNOWLEDGE_PRODUCTION_RECOVERY_INTERVAL_MS` 为正整数毫秒可启用周期恢复。周期扫描复用同一恢复事务，服务关闭或测试结束时应调用 `stopRecoveryScheduler()`；该配置不提供多实例调度 claim。

`content-rules.json#/outlineTemplate` 定义自然路径大纲模板的版本、六列表头、最大深度、Markdown 扩展名、介绍文件前缀和 SQL 示例源。每行完整路径、不继承空白；Excel 行序是文档顺序。根介绍和目录介绍均须在各自文档范围内排首位。正式模板和下载样例统一存放在 `knowledge/outlines/`，不得生成到仓库根目录；`templatePath` 与 `sampleDownloadPath` 是仓库内资源路径，`sampleDownloadName` 仅是用户下载文件名。示例下载副本通过 `tools/repository/generate-sql-outline-sample.js` 生成，原始 Excel 不修改。

生成 SQL 大纲下载样例前必须存在 `sampleSource` 指定的原始 Excel；缺失时脚本会返回包含实际路径和补救动作的明确错误，不会创建空样例或覆盖现有下载文件。

`config/knowledge-center/` 是面向运维的知识中心控制面，只保留三份英文命名的业务配置：

- `product.json`（产品配置）：产品身份、模块、工作台、能力清单和资源引用。
- `service.json`（服务配置）：服务、路径、日志、安全、模型、MCP 和 Agent 预设。默认模型为 `gpt-5.5`，并支持 DeepSeek。
- `content-rules.json`（内容规则）：资料加工、质量、同义词、特性和 GitLab 文档类型。
  其中 `gitlabVerificationErrors` 按稳定错误码维护 GitLab 验证失败的中文修复建议。数据库模式验证结果保存在 `runtime/knowledge-center/gitlab-verifications.json`；隔离运行可用 `KNOWLEDGE_CENTER_GITLAB_VERIFICATION_STORE` 指定独立运行时文件。
- `branding/default-icon.png`：登录页、favicon 和侧栏共用的默认品牌图标。

`service.json` 中 `documentPaths[].path` 的相对路径统一以仓库根目录解析，不以 `config/knowledge-center/` 或服务进程的启动目录解析。例如仓库位于 `/data/docs/AI高效应用示例/06-YashanDB知识库Skill仓库`时，`../../ai 体系认知` 指向 `/data/docs/ai 体系认知`。配置中保留相对路径，避免将开发机的绝对路径固化到仓库。

底层逻辑是依次回答“产品是什么、服务怎样运行、内容怎样处理”。根目录不得继续增加无法归入这三类的 JSON。

平台配置采用“一个入口、分层存储”规则：MCP、模型和 Agent 预设统一从 `service.json` 管理；GitLab 连接和手册映射属于可变平台数据，文件模式保存于 `runtime/knowledge-center/gitlab-connections.json`，数据库模式保存于 YashanDB。OAuth 凭据、验证结果、审计、幂等记录和缓存不并入 `service.json`，分别保存在安全存储或 `runtime/knowledge-center/`，避免配置发布覆盖运行状态。

通过 `KNOWLEDGE_PLATFORM_CONFIG_MODE=database` 启用数据库平台配置。切换前必须使用 `tools/knowledge-processing/migrate-platform-config-to-yashandb.js plan` 生成迁移摘要，并完成批准、维护窗口和验收；未完成迁移时保持 `file` 模式。该开关未设置时兼容 `KNOWLEDGE_STORAGE_MODE`。

`.env.example` 只描述环境注入契约；本地 `.env` 可保存本机凭据但不得提交，生产密钥应由环境变量或密钥系统注入。`service.json` 中的 `api_key_encrypted` 和加密请求头只用于兼容现有配置，新增或轮换密钥不得写入版本库；生产应由密钥系统注入并按部署策略更新。对外访问地址通过 `KNOWLEDGE_CENTER_PUBLIC_BASE_URL` 统一配置，可使用完整的 IP URL（例如 `http://192.0.2.10:13510`）或域名 URL；平台地址、CAS service 和默认 GitLab OAuth 回调由它派生。

历史读取配置为 `read_api read_repository`。2026-10-30 用户批准本机平台请求范围调整为 `api`，GitLab 应用侧由用户勾选该范围；配置生效后，已有用户须重新连接 GitLab 账号才能取得新范围，不能仅凭环境配置认定实际令牌已经扩权。若要启用审核发布的 REST API 写入任务分支、提交和 MR，GitLab OAuth 应用必须额外启用并允许 `api`，同时将 `KNOWLEDGE_CENTER_GITLAB_OAUTH_SCOPES` 改为 `api`。`write_repository` 不能替代 REST API 写权限。

环境和内部端口使用统一前缀：`KNOWLEDGE_CENTER_ENV`、`KNOWLEDGE_CENTER_FRONTEND_PORT`、`KNOWLEDGE_CENTER_DOCUMENT_API_PORT`、`KNOWLEDGE_CENTER_PINGCODE_API_PORT`、`KNOWLEDGE_CENTER_INTERNAL_HOST` 和 `KNOWLEDGE_CENTER_PINGCODE_HOST`。旧 `KNOWLEDGE_CENTER_PUBLIC_HOST` 仅作一个兼容周期的输入，不应写入新配置。

`KNOWLEDGE_CENTER_ENV` 是环境名称的唯一外部配置项；运维入口会将其规范化为进程内的 `KNOWLEDGE_CENTER_ENVIRONMENT` 并显式传递给前端网关。项目安装器将 Playwright 浏览器制品放在 `runtime/browsers/playwright/`，已有环境也可保持 Playwright 默认缓存或用 `PLAYWRIGHT_BROWSERS_PATH` 显式覆盖。

认证配置由平台内核读取，生产平台不需要独立认证端口；`KNOWLEDGE_CENTER_AUTH_PORT/HOST` 仅为隔离运行 `apps/knowledge-center-auth/auth-server.js` 的兼容测试变量保留。

`content-rules.json#/productionAI` 定义知识中心 AI 生产规则版本、运行租约、通用系统提示及 generate/polish/continue/rewrite/update 操作指引；提示词修改会影响候选语义，需同步更新设计和验收。文档生产仍使用共享配置中的 `model-config` 与 `LLMClient`，不得在该规则对象保存凭据或另建模型连接。

`productionAI.sources` 配置引用读取上限（超时、正文大小、单次确认数量、重定向次数）。`allowPublicWeb=true` 允许读取公开 HTTP(S) 网页、Markdown 和纯文本，HTML 提取正文；每次重定向重新检查地址，拒绝内网、回环和保留地址。`urlOrigins` 是运维显式授权的来源列表，可供内部文档站点使用，不再限制公开网址。登录态、需要 JavaScript 渲染的页面可能无法读取。浏览器不传入 MCP 地址或凭证，知识库引用复用 `service.json#/mcp`。

`productionAI.sources.images` 统一控制来源图片数量、单图/总字节、总下载时限和格式。网页图片经受控 HTTP 读取，PingCode 图片由其登录会话下载，再以内容摘要托管在 runtime；平台预览只访问同源、按手册和文档授权的图片路由。图片失败保留正文及替代文字，旧来源需重新读取才能获得托管图片。

`content-rules.json#/productionDelivery` 控制审核交付的托管图片：`version` 为快照策略版本，`resourceDirectory` 为文档同目录下的资源子目录；`maxCount`、`maxBytes`、`maxTotalBytes` 分别限制每篇文档的托管图片去重数量、单项字节及合计字节。当前默认 64 项、5 MiB/项、32 MiB/篇，单项不能超过 GitLab 连接器的读取上限。配置缺失或数值非法时拒绝交付，不静默放宽。已有仓库相对图片仍按固定提交读取和核对。

送审从保存修订读取附件清单并校验完整文档上下文，来源图片复用原有权限读取路径；支持 PNG/JPEG/GIF/WebP，改写为映射授权范围内的 `assets/<sha256>.<ext>`。冻结字节位于 runtime 附件根下 `delivery-images/<sha256>`，文件权限 0600；任务只保存摘要、大小、目标路径与策略版本。发布前再次验证冻结字节，正文与新增图片使用同一个 GitLab commit；缺失、损坏或路径冲突时拒绝写入。PDF/Office、直接外链及 srcset 暂不支持交付。

交付快照独立于上传附件的 24 小时有效期，不能随临时附件过期清理。T04盘点已覆盖 `delivery-images` 与保留任务历史引用；独立离线备份/恢复工具已补充（见tests README），共享数据仍有旧清单和文件缺口。数据库恢复、事务快照及引用保护GC待补；现在保留快照，不自动删除。该本地快照目录也不代表已完成 T09 数据库资源迁移。

### 工作台续写 Skill

`product.json#/skills` 登记 `continue-technical-document` 资源；`content-rules.json#/productionAI.skills` 配置中文说明和适用操作，`maxSelectedSkills` 限制选用数量，`skillPrompt` 配置基础约束。新增 Skill 按既有能力包流程加载后可选；生成请求使用 ID 和预览摘要，内容变化要求重新确认。指令来自 knowledge，不执行任意脚本；既有生成策略不变。


`content-rules.json#/productionAI.sources.pingcodeSpaces` 为可引用 PingCode 空间标识列表，默认空列表。设计文档与测试文档共用既有资料服务，后端地址由现有 `PINGCODE_API_HOST/PORT` 内部配置注入，不接受浏览器传入服务地址或凭证。作者输入 `空间标识/页面ID`，预览并确认后引用；两种来源表示作者选择的用途，不表示平台已自动识别远端文档类型。`content-rules.json#/productionAI.sources.testCaseRoot` 指定仓库内测试用例目录，默认 `knowledge/references/test-cases`，仅读取 Markdown、SQL 和文本条目，预览确认后才冻结来源。

当前开发环境已将 `pingcodeSpaces` 配置为 `YASSTORAGE`、`YASDOC`，并将已验证可读取的页面定位符维护在 `config/pingcode/credentials.json`；授权范围以配置空间列表为准。用户已授权 YASDOC 全空间引用，`urlOrigins` 和 `pingcodeOrigins` 配置为 `https://pingcode.yasdb.com`，页面 URL 复用资料服务读取正文。

`productionAI.provenancePrompt` 配置结构化正文与来源区间协议，`maxProvenanceSegments` 同时限制声明及每项证据数量。规则 v3 要求引用对应已确认快照；逐字匹配不表示事实或数据库验证通过。协议随任务冻结，旧 Markdown 输出保守记为模型推理。

文档候选区提供独立 YashanDB 用例检查入口。后端 `quality` 报告由用例提取、执行、比对和报告四个 Skill 组成，绑定文档版本和测试环境；无测试库或未满足前提时显示“未执行”，不得显示为通过。隔离 HTTP 已验证，真实数据库连接需使用授权的测试 Schema。

## AI 文档质量执行

数据库模式下，仅配置 `YASDB_QUALITY_JDBC_URL`、`YASDB_QUALITY_USERNAME` 和 `YASDB_QUALITY_PASSWORD` 后才启用文档 SQL 质量检查。质量 JDBC 地址必须不同于业务库 `YASDB_JDBC_URL`，账号只能读取测试数据；存储端的 `/v1/quality/execute` 使用独立只读连接，不复用业务存储连接池。`YASDB_QUALITY_ENVIRONMENT` 显式标记报告中的测试环境。未配置或指向业务库时保持 `not_executed`，不得记为通过。结果恰好达到行数上限时可正常比对，只有确实存在更多行才标记截断。


`content-rules.json#/productionQuality` 配置内容检查规则版本、提示词、超时与输出上限。工作台检查弹窗勾选联合检查后，质量服务在 SQL 验证之前复用 ValidatorAgent 和统一模型配置。模型必须返回四项检查及带位置、等级和处理要求的问题；响应无效、模型不可用、模板或来源缺失不能记为通过。报告区分 `contentQuality.gate` 和 `sqlGate`，请求联合检查时整体 gate 同时要求两者通过；不自动批准审核发布。规则摘要与 ValidatorAgent 实现摘要随报告保留。

`productionAI.sources.pingcodeOrigins` 将 PingCode 页面网址转交既有资料服务，仍受 `pingcodeSpaces` 限制；其他公开网址通过通用网页正文读取。参考资料可多选，作者确定的引用优先级随任务快照保留，数值 1 为最高。

真实网关内容检查使用 `productionQuality.timeoutMs=120000`，超过期限仍按未执行返回，不能降级为通过。


## 平台管理 MCP 配置

入口 `/knowledge-center/platform?tab=models`，在当前 Agent 中管理 MCP；旧 tab=mcp 自动归入该入口。`service.json#/agentServices.agents[].mcp` 为各 Agent 独立配置；旧顶层 mcp 保留兼容历史调用，未迁移时只读投影。平台保存通过既有 ConfigManager 加密 Key 与普通请求头值，浏览器读取脱敏配置投影，知识库路由 ID 可见并可编辑。`content-rules.json#/platformMcp` 定义超时、请求头数量/长度、缓存 TTL/条数边界和默认值，不在前端复制业务限值。

连接测试使用未保存表单并执行 initialize、initialized 通知和 tools/list；不自动保存，也不执行 tools/call。`content-rules.json#/platformMcp/multiSearchHeaderName` 指定支持重复配置的搜索路由标头；重复行会成为逐库搜索目标，单独建立会话后合并结果。知识库路由 ID 在管理界面直接展示并可编辑；API Key 与普通自定义请求头值继续脱敏。其他重复标头仍需清理并为保留项重填值。现有生成器 `/api/config/*` 保持兼容，其部署访问边界及统一权限治理仍需单独维护；配置加密的 `AGENT_RUNNER_KEY` 应由环境安全提供，沿用默认回退不能视为生产密钥治理完成。

`service.json#/model.services[]` 为 AI 辅助写作模型目录；服务包含 provider、protocol、base_url、加密 api_key、models、enabled、timeout、temperature、max_tokens；defaultSelection 指定默认服务和模型。平台管理页面维护；未保存之前兼容既有顶层模型配置，其他 Agent 继续使用顶层字段。`content-rules.json#/platformModels` 集中定义服务商/协议选项、边界、默认参数与连接测试短提示词。新密钥不要写进示例、日志或浏览器持久存储。

`content-rules.json#/platformModels/providers[].baseUrl` 为模型服务新增表单的公开地址预设；手工地址和历史地址不自动覆盖，不预设模型标识。

`content-rules.json#/productionAI/historyLimit` 控制每篇文档可回看的 AI 生成历史条数；`content-rules.json#/productionAI/executionFeedback` 集中设置写作执行反馈的预览落盘间隔 `previewIntervalMs`、最大字符数 `maxPreviewChars`，以及 Codex 活动窗口 `maxAgentEvents`、单条消息 `maxAgentMessageChars`。仅保存已解码正文和经过投影的 Agent 消息/工具状态；不保存原始调用参数或来源协议 JSON。

GPT 服务模型目录按2026-10-26用户提供的网关截图追加文本模型：`gpt-5.5`、`gpt-5.6-luna`、`gpt-5.6-sol`、`gpt-5.6-terra`、`gpt-6-astra`、`gpt-6-luna`、`gpt-6-sol`；保留原有模型及默认选择。此列表是网关标识，非官方定价或可调用性验证。`gpt-image-2`、`BAAI/bge-m3`不加入当前文本写作服务目录。测试模型下拉框直接读取对应服务的 `models[]`，无需在前端另写清单。

AI 写作页面统一显示文档生成（generate）、内容修订（polish）、内容续写（continue）。production-ai-v4 将 polish 指引扩展为依据要求进行表达、结构及资料修订，模板可选；rewrite/update 保留供历史接口兼容。任务创建时冻结规则版本和操作指令，历史候选不随配置变化。


## AI 写作默认知识库检索

生成设置的来源固定为：网页来源、Pingcode设计文档、Pingcode测试文档、知识库（MCP）、测试用例集。前述 MCP 来源默认参加生成，不要求作者输入网址或条目标识。其余四种来源仍需读取并勾选确认。

`content-rules.json#/productionAI.sources.mcpRetrieval` 为查询策略表，`mcp-default-v1` 使用写作要求、正文标题、提纲和所选正文提取关键词；支持作者以“关键词：SELECT SQL”明确查询主题。默认输入上限 1200 字符、4 个关键词、3 条查询、2 条库路由、3 篇引用原文，最低搜索评分 0.3。`dimensions` 按 SQL 语法、运维操作、测试验证、通用概念选择查询后缀；`routes` 将运维主题匹配至名称含“运维”的已启用库，其余使用名称含“官方”的库。服务和库的 ID、地址及凭据仍由 `service.json#/mcp` 管理，不在策略内重复配置。

仅支持已启用的 YashanDB MCP 适配服务。无匹配库时不任意选库；只兼容旧版无显式库的单服务默认路由，其余记录 `not_configured`。`search_ku` 结果经过分数过滤、排序及去重，随后用 `get_ku_detail` 读取原文；搜索摘要不直接成为引用。状态为 `succeeded / partial / empty / not_configured / failed`；所有搜索失败或命中后所有正文均读取失败时任务失败，可重试，不能宣称已引用。查询规则随任务冻结，已成功保存的检索结果及证据在重试中复用，失败检索允许重试；取消后的迟到结果不得进入任务和写作阶段。路由与查询为确定性执行，不依赖模型自由选择工具；检索质量仍需通过主题样本持续评估。

验证入口：`node --test tests/unit/agent-runner/production-ai-mcp-retrieval.node.test.cjs`；HTTP 与浏览器验证使用 `node --test --test-name-pattern='默认 MCP 真实 HTTP' tests/unit/agent-runner/handbook-production-api.test.js`。运行证据放在 `runtime/test-results/production-ai-default-mcp/`。

## 手册性能预算

`handbook-performance.json` 定义真实 API 与浏览器只读门禁的采样轮数、P95、响应体积及等待预算。默认 API 100 次、浏览器 30 次；目录 API / 草稿 API P95 ≤100 ms、点击目录可见 ≤200 ms、既有正文就绪 ≤500 ms。标准 SQL 目录当前为约207 KB，目录字节预算230 KB；草稿预算64 KB，超大正文需另建场景并评审预算，不能静默放宽。外部 GitLab 单独验收。门禁超预算返回非零退出码。

运行配置完整性：独立资料处理工作区已移除，`product.json` 不再保留指向该工作区的旧模块引用；否则文档服务在严格 Profile 校验阶段无法启动。配置变更必须通过 `loadProfile()` 语义校验。

AI写作参考文档上传使用 `productionAI.sources.upload` 限制扩展名、原始与解压大小、解析时限、工作线程内存和PDF页数；正文仍受maxBytes限制。`referenceListCollapsedCount` 控制主面板默认展示条数。上传生成独立来源快照，不保存原文件，不作为草稿附件；DOCX内嵌图片复用来源托管。referenceOrder冻结人工来源与默认MCP分组的顺序，1为最高；缺省保持旧版追加顺序。

### 生产引用只读盘点

`production-reference-audit.json` 定义盘点工具的豁免namespace、引用字段/前缀、结构版本转换、并发/超时及集合计数口径。抽取规则须与Storage的`collectOutlineReferences`和`upsertRecord`一致；这里只控制诊断，不改变保存门禁。工具入口为`tools/repository/audit-production-references.cjs`，结果写runtime，保留失败结果，不自动修复数据。

- `e2e-production-fixtures.json`：仅统一隔离E2E入口在验证真实Storage进程账号为test_hy后，备份并CAS重建的两个生产聚合默认值；禁止作为共享实例清理入口。

`handbook-performance.json` 的 `apiConcurrencyLevels` 固定1/5/10路同URL读取，`apiRounds`为每批总请求数；失败样本单独计数，浏览器单用户采样口径保持明确。

内容补充盘点入口为`tools/repository/inventory-production-content.cjs`，沿用`production-reference-audit.json`的只读请求超时；内容字段与摘要算法来自当前生产服务契约，草稿键直接复用contextKey。显式环境变量`YASDB_STORAGE_URL`、`KC_CONTENT_INVENTORY_OUTPUT`必填，`KC_ATTACHMENT_ROOT`和`KC_SOURCE_IMAGE_ROOT`仅用于已确认的本机权威附件/来源图片目录；schemaVersion=2报告分别记录两类物理状态，图片按当前来源、任务快照及历史修订快照并集去重，并核对摘要/大小/文件签名；不读取service.json凭据，不自动修改配置、目录或数据库。缺省物理检查为未执行，报告独占落盘，不覆盖历史证据。

手册读取性能配置 `handbook-performance.json` 的 `browserConcurrencyLevels` 与 `apiConcurrencyLevels` 分别控制浏览器和API并发档位，两者按阶段分开采样；浏览器每档固定 `browserRounds` 次，使用独立上下文和同账号登录态。目录/正文预算不随并发自动放宽。

## Agent&模型服务与 Codex

平台入口统一为 Agent&模型服务。`service.json#/agentServices` 保存每套 Agent 的模型、MCP、执行器和推理强度；新建时复制默认 Agent 的模型/MCP，之后独立维护，密钥沿用嵌套加密。默认 Agent 独立于 Agent 内默认模型。首次未保存前只投影历史配置，原顶层 model/mcp 保留给兼容调用；写作任务按所选 Agent 取配置和版本。

`content-rules.json#/agentRuntime` 控制 Codex 版本、总超时、产物/事件大小、Agent 数量与名称长度及交付提示词。运行宿主必须提供可执行的 Codex CLI 0.156.1；工作区及事件保存于 runtime/agent-runner/codex-runs。Codex 使用独立 CODEX_HOME，不继承个人登录态。公司网关基础地址为 https://ai-green.yasdb.com/v1，协议 responses，认证 requires_openai_auth=true；实际请求 /v1/responses。

模型连接完整保留原字段。Codex 当前映射模型、Provider、地址、认证与推理强度；temperature/max_tokens 不映射，连接 timeout 不替代 agentRuntime 总超时。Codex 桥接仅支持只读 YashanDB 知识库，启用 generic MCP 会在预检中报错。DeepSeek Harness 仅可保存配置，尚不能运行。仅装配平台冻结的技能文本，不自动加载个人技能脚本。

GitLab OAuth 应用权限排查：个人创建的应用可从 GitLab“偏好设置→应用”（`/-/profile/applications`）查找；管理员创建的应用需由管理员从“管理中心→应用”编辑。通过平台配置的Application ID核对对应应用，保留现有回调地址，不重建应用、不更换Secret。启用api后，获授权的平台管理员同步调整请求范围并重载服务，用户在个人设置重新连接GitLab；已有令牌不会自动扩权。先只读核对新令牌scope和真实账号，再按批准目录创建测试源分支和MR；api不代表获准合并，合并边界仍以用户授权为准。


content-rules.json的gitlabParticipants配置项目可访问用户分页大小与上限；使用GitLab /projects/:id/users精确匹配统一登录账号，不以members/all或固定项目角色等级代替可访问性判断。实际指派结果须回读MR核对，分支合并权限不由此授予。


## 任务管理 V2（2026-10-30）

content-rules.json 的 documentTasks 提供初始 defaultOwnerId、reasonOptions 与 pingcodeProjectUrl。默认人177为真实目录何灿稳定ID；运行配置后续在任务聚合中维护，变更不重派已有任务。
