# Agent 配置与运行实施契约

2026-10-29。按标准开发实施；保留当前导航，统一为 Agent&模型服务。以已确认原型为界面基线。

## 配置与迁移

service.json 新增 agentServices，保存 agents、defaultAgentId 和版本。每个 Agent 持有独立 model（完整模型治理结构）、mcp（完整 MCP 治理结构）、executor、reasoningEffort。复用现有校验、加密与草稿测试逻辑。首次只读投影把现有模型与 MCP 归入“内置工作流”，首次保存才持久化；保留旧模型/MCP 数据及历史引用。未部署的执行器不能标为可用。模型列表接口兼容原结构，并增加 agentId/executor。

## API

管理员 GET/PUT /platform/agents，If-Match 防止覆盖。GET /platform/agents/:id/models|mcp 及原模型/MCP 子操作保持既有契约，只写当前 Agent。POST /platform/agents/:id/run-test 发起真实运行；任务接口 GET /platform/agent-runs/:id，GET /events?after=N（SSE），POST /cancel。写作页 modelSelection 增加 agentId，按配置版本冻结，恢复时配置变化明确报错。

## 运行与产物

持久化任务先于子进程启动。平台启动独立 Worker（同机子进程，容器可使用同一入口），IPC 只传递任务快照、进度和控制；Worker 启动锁定 Codex app-server，stdio JSON-RPC 执行 initialize→thread/start→turn/start。不继承个人 Codex 配置。使用独立 CODEX_HOME 和任务工作区。只有成功 turn/completed 且 output.json 为真实常规文件、通过路径/大小/正文契约校验后收集。Codex 自主执行完整循环；平台保留原候选/审核/交付契约。

MCP 通过任务级本机 HTTP 桥接，共享既有 MCPClient 和知识库路由。仅暴露当前 Agent 启用的知识库工具，缓存按任务客户端隔离。原始凭据不发给页面、不写日志。模型协议预检按执行器版本进行：Responses 使用原生；Chat Completions 在没有经验证适配时明确阻断。温度、输出预算等保留原字段，不宣称未映射参数已生效。

取消传递 turn/interrupt 后等待终态，超时杀进程；执行器采用 never 批准策略，收到反向批准请求直接拒绝；只有平台桥接暴露的只读知识库工具预先允许自动调用，不提供人工批准 API。事件有单调序号、持久化后 SSE 分发，断线可补读。进程丢失标记 interrupted，不自动重放副作用。内置工作流复用当前执行链；DeepSeek 可保存配置，但没有适配器不能发起运行。

## 伪代码

saveAgent → checkVersion → normalizeUsingExistingGovernance → encryptNestedSecrets → atomicSave
start → resolveFrozenAgent → persistQueued → spawnWorker → initialize → startThread → startTurn
notification → redact → persistSequence → stream
completed → validateRealArtifact → existingWriterContract → candidate → existingReview
cancel → interrupt → terminalOrKill

## 验收

配置隔离、迁移、密钥加密与不回显、版本冲突；真实 HTTP API；真实 Codex 握手与故障处理；受控上游 Responses/MCP 全循环；真实公司服务可用时做业务对照；页面桌面/窄屏截图与交互。隔离上游验证不等于生产模型质量验收。

## 运行清单与实测范围

run.json 保存不含凭据的清单：执行器版本、Agent/模型版本、模型与地址、推理强度、输入及规则摘要、总超时、MCP 启用服务/库范围。模型温度和 max_tokens 保留于连接配置，当前 Codex 路径不映射；连接 timeout 不作为 Codex 总超时，后者由 agentRuntime.timeoutMs 控制。技能仅装配平台已冻结的文本指令，不加载个人全局技能和脚本。清单用于追溯，不能代替本地/平台输出质量对照。

2026-10-29 真实 Codex 0.156.1 + 公司 Responses 网关 + 隔离 MCP HTTP 检索/读取 + 生产任务 API + 候选采用已通过。业务与草稿存储为隔离测试环境；未验证正式库写入或 GitLab 发布。当前同机子进程，不包含跨机投递、容器沙箱、人工批准或原会话续跑。DeepSeek Harness 仅配置占位。

## 2026-10-30 写作页 Codex 运行事件

写作任务沿用既有 Job 读取和取消 API。Codex Worker 将 app-server 的 Agent 消息增量、工具项开始/完成和错误投影为有限的用户可见事件；只保留工具类别、知识库工具名、状态和简短消息，不传命令正文、工具参数、原始协议包或凭据。Runner 在事件落盘后通知写作任务，任务记录保留有上限的事件窗口与单调序号；页面轮询同一 Job 展示真实轨迹，重开时可回读。每篇文档提供生成历史列表，历史任务按创建时间保留并可重新打开查看阶段、预览和事件；重试不清空旧事件。生成中主按钮切换为停止图标，停止请求进入既有取消链路。工具调用与模型推理过程不能推断或编造；非 Codex 执行器只展示已有阶段/正文预览。

伪代码：appServerNotification → safeProjection → runnerAppendAndRedact → writerJobAppendIfRunning → GET Job → sidebarTimeline；cancel → AbortController → turn/interrupt → Job cancelled；lateEvent → ignore。候选仍由 output.json 校验后进入现有对照与采用流程。验收包含受控 Codex 通知、HTTP 回读、取消后迟到事件拒绝和页面展示；真实公司模型仅在可用时作补充验证。

验收记录：写作页/反馈/运行时回归共 31 项，28 通过、3 项真实运行开关跳过；另行启用真实 Codex + 公司 Responses 测试，1 项通过，实际记录包含知识检索、读取、命令和文件变更事件。浏览器中断与迟到事件拒绝通过受控 Runner 验证，未单独实测真实 Codex 中途停止。默认构建通过，13510 重启后 4/4 服务健康，实际 JS/CSS 摘要与源码一致。本轮未验证个人账号完整交付或 GitLab 合并。

## 2026-10-29 实际运行版本错配修复

实际旧网关未包含Agent路由，而静态资源为新前端，接口落入SPA回退返回200 HTML。验收：更新运行网关后，未登录Agent请求401 JSON，管理员读取200 JSON，配置页正常呈现；未知API返回404 JSON，不返回SPA首页；Agent读取遇到非JSON/非法JSON时显示中文服务错误并允许重新读取，不能暴露JSON解析异常。上线必须同时更新构建资源并重启承载新API的Web网关。

实际验收已完成：13510未登录401 JSON、管理员200 JSON、未知API404 JSON；真实浏览器可加载并切换Codex，模型及MCP正常显示，无脚本错误。仅重启Web网关，平台4/4服务正常。证据目录：runtime/diagnostics/agent-admin-fix-20261029。

## 2026-10-29 VS Code式设置页整改

用户授权按VS Code设置界面改善。平台主导航不变，Agent列表改为紧凑条目；详情使用分组设置行，名称为有界宽度输入、类型只读文本、默认Agent为勾选项。模型沿用快速菜单与推理强度，MCP主页面展示已保存服务/知识库摘要。连接与MCP完整配置移入原生dialog，保留原字段、测试、版本校验及局部保存；不新增原子保存承诺。Agent保存与运行测试在详情标题栏，避免被长表单推离首屏。

伪代码：loadAgent→renderSettingsRows→mountExistingConnectionAndMcpDialogs；open→showModal；close/Esc→ifBusyPrevent→preserveDraft→close；saveConnection→refreshAgentVersionAndPicker；syncMcp→renderPersistedSummary。关闭面板不丢失草稿，离开Agent时仍执行未保存确认。模型连接面板不重复展示默认模型选择，其内部选择器保留为契约承载；常用模型选择从主页面完成。

布局通过Agent区域局部变量控制列表宽、行距、内边距；不靠全局缩放或小字号压缩。桌面1366×768、1440×900、1920×1080默认态名称、模型、MCP摘要、保存按钮须进入首屏，无横向溢出；390px窄屏重排。展开面板覆盖长内容滚动、Esc及焦点返回、保留草稿、局部保存、Agent保存与真实HTTP回读。大量服务摘要只展示总数与首个服务，不无限扩展主页面。

实施验收：Agent管理与原模型管理真实HTTP浏览器回归通过，包含模型/MCP保存回读及推理强度保存；统一构建通过。实际13510已加载新静态资源，三种桌面尺寸首屏几何断言、模型/MCP面板打开关闭、390px窄屏均通过，脚本错误0。实际平台仅登录读取与查看，未写共享配置、未执行模型。证据：runtime/diagnostics/agent-settings-vscode-20261029/verification.json、actual-1440.png、actual-model-panel.png、actual-mcp-panel.png、actual-mobile.png。

## 配置存储覆盖率回归边界（2026-11-10）

直接加载生产 `config-manager`，只隔离公开配置路径、运行环境加载、日志及文件监听事件源。配置文件、原子写入和 AES-GCM 加解密均使用真实实现，运行数据位于 runtime。覆盖服务配置分区与独立文件、缓存与监听失效、同步读取、预设增改查、递归敏感字段和 Headers、损坏密文降级、JSON 解析和写入错误传播。监听器使用确定性事件源验证 service.json 全量失效、其他 JSON 定向失效、空/非 JSON 名称忽略及监听失败，避免依赖 OS 事件时序。后端 HTTP 配置契约继续由固定 Node API 套件验证；本矩阵不改变配置协议。


## API 服务入口边界覆盖矩阵（2026-11-10）

采用真实 Express、HTTP、Socket.IO 与本机动态端口验证 server.js 入口；只隔离配置加载、工具管理器及下游业务路由，使 HTTP 门禁、压缩、请求上下文和生命周期仍使用生产实现。隔离目录集中 runtime，测试进程注册的信号/异常处理器单独捕获与调用，退出使用边界替身，不能终止 Jest 或污染全局监听器。默认绑定和显式绑定、内部令牌配置/缺失使用独立 Jest 文件隔离冻结全局上下文。

| 路径 | 验收方式 |
|---|---|
| 启动与读取 | 自动创建logs/tmp，已有目录复用；健康/平台上下文真实GET及请求ID回显；预览存在时真实读取，缺失时404 |
| 大纲写入网关 | POST导入/手册/治理命令、PUT治理、PATCH构建项、DELETE、GET删除预检：缺配置503，错误/缺失令牌403，合法令牌进入隔离下游；普通读取不受影响 |
| 压缩 | 大JSON协商gzip并可正确解压；identity、已有编码、非JSON、小正文、空正文和字符串正文；压缩故障回退原文并记录告警 |
| Socket.IO | 真实客户端订阅/退订，检查房间成员及ack；无task_id不加入，无ack不报错，断开清理 |
| 生命周期 | 捕获入口注册的未捕获异常/拒绝处理器检查日志；服务错误记录退出、端口占用专用提示；SIGINT真实关闭、SIGTERM超时使用可控计时与关闭边界替身验证强制退出 |

伪代码：`create isolated runtime; load server with boundary dependencies; await listening; request real HTTP; connect real socket; assert responses and room state; exercise registered lifecycle handlers; close and restore`。不改业务权限、生产监听端口和压缩阈值，定向覆盖率不能代替整个平台验收。

## DeepSeek Harness SDK 试运行设计（2026-11-11）

### 范围

首期以官方完整 `sdk` profile 接入 DeepSeek Harness（DSH），复用平台 Agent 配置、模型连接和运行事件界面。DSH 配置与真实试运行只允许平台管理员操作；DSH 不进入普通文档生成模型选项，不可成为默认 Agent。已有 Codex 与内置工作流行为不变。管理员试运行通过且安全、运行、产物验收完成后，若要开放文档生产，须另行确认晋级范围和运行环境，不由试运行结果自动开放。

### 运行契约

- 使用锁定版本 `0.2.2-rc.1` 的 `@deepseek-ai/dsh-sdk-client` 与 `@deepseek-ai/dsh`，`profile: sdk`，每个运行独立创建工作区和 `DSH_HOME`，不得读取用户级 DSH 配置、历史会话或凭据。升级时需一起升级并复测，不允许混用 SDK 与运行时版本。
- 通过任务级 Cordis overlay 配置单次模型路由和凭据引用；API Key 只存在于当前任务的受限凭据通道，禁止写入运行清单、profile、通用日志或页面。若当前 SDK/运行环境无法提供任务级凭据隔离，则运行预检失败，不回退到修改服务进程全局环境。
- `approval/request` 一律拒绝；不提供人工批准 UI。禁用插件管理、计划任务、Web/网络搜索、MCP 和非必要外发遥测。工具和文件系统边界只允许该任务工作区；SDK 与 DSH 本身报告的沙箱仍不视为容器安全保证。
- 管理员测试提示词从既有 `agentRuntime.testPrompt` 读取，结果只用于验证模型响应，不产生正式文档、草稿或业务副作用。SSE 运行事件经过字段白名单、长度限制和凭据脱敏后持久化；取消通过关闭该次 SDK 独占的运行进程实现，超时或子进程失联进入终态，禁止自动重放。
- 任何需要访问工作区外文件、MCP、内部网段或用户账号配置的需求均不属于试运行契约。运行环境未达到隔离前置条件时，配置可以读取/保存，但运行入口显示未就绪并由后端拒绝。

### Codex 对照实现与 DSH 任务隔离

- 运行入口使用锁定版 `@deepseek-ai/dsh-sdk-client` 的 `DeepSeekHarness`；由平台 adapter 负责任务记录、事件投影、取消、超时和进程回收，不由浏览器直接调用 DSH。
- SDK 由专用 Node 24.9 进程运行；平台主进程的 Node 22 不满足 DSH 要求。任务运行器使用 user systemd 瞬态单元的 `PrivateUsers`、`PrivateNetwork`、`ProtectSystem=strict`、`ProtectHome=tmpfs`、`InaccessiblePaths=/data` 与任务目录 bind，并在单元内通过 `unshare --pid --mount-proc` 创建独立 PID 视图。每次启动前的预检探测任务工作区、宿主文件、宿主用户 socket、PID 视图和公网连通性，失败时保持运行入口关闭。
- 模型 API Key 只由平台进程内的任务级代理持有；DSH runtime 只接收无权限占位 key。每任务 Unix socket 在 `PrivateNetwork=yes` 下作为模型代理通道。代理限制方法、路径、请求次数、模型、请求体大小和超时，并阻断重定向；模型请求只由平台进程注入解密后的 key。取消或终止时中断在途代理请求。不得把真实 key 写入 DSH_HOME、Cordis overlay、SDK 子进程环境、参数、日志或事件。
- 若 DSH 自身未选模型，管理员试运行临时解析平台默认 Chat Completions 连接，不复制其密钥或更改其配置；仅当该连接有解密后凭据且协议匹配时算模型就绪。此回退只用于管理员试运行，DSH 仍不进入文档生产。若无兼容模型，则服务端返回具体阻断原因。
- 沙箱探针必须验证：可写任务 workspace、不可读取宿主哨兵文件/用户配置、看不到沙箱外进程、无法直接访问公网；凭据探针须确认 DSH 和其工具只能看到占位值且无法从宿主凭据代理读取密钥。仅检查命令存在或 DSH 自报 sandbox ready 不算通过。
- 启动时的沙箱/凭据探针是 DSH 能力的可用性检查，不是知识中心主服务的启动前置条件。运行目录缺失、无权绑定 Unix socket、user systemd 不可用或探针超时时，异步错误必须由探针捕获并投影为 DSH 未就绪原因；不得产生未处理进程错误或阻断平台 API/页面启动。实际 DSH 试运行仍须在服务端 readiness 全部通过后才允许执行。
- 沙箱探针的专用 Node 版本与运行预检使用同一最低版本（24.9.0）判断，允许更高兼容版本；其余隔离事实仍须全部通过。

### 接口与页面

保留 `POST /platform/agents/:id/run-test` 与现有查询、SSE、取消路由。服务端按 runId 对应的 executor 找回运行；非管理员仍由既有平台管理员门禁拒绝。DSH 测试使用 SDK 的真实会话事件，映射为平台统一 `started/progress/tool-started/tool-completed/completed/failed/cancelled/interrupted` 事件。错误返回中文安全摘要，具体敏感 stderr 仅允许写入 runtime 中受权限保护的诊断文件。

Agent 列表明确显示“DeepSeek Harness（管理员试运行）”。DSH 可编辑模型连接，但不能勾选“用于文档生成”；详情展示试运行是否就绪及阻断原因。保存成功只代表配置持久化，不代表 SDK、沙箱、模型或运行链路已通过。

首次读取 Agent 配置时，平台自动补入唯一的 `dsh-admin-trial`；旧配置只追加这条 Agent，不替换现有默认项，也不复制模型连接、密钥或 MCP 配置。该项初始停用，不能设为默认或删除；Agent 新建菜单不重复提供 DSH 类型。设置页初次进入选中当前默认 Agent，侧栏对 DSH 显示“管理员试运行 / 未就绪”，详情顶部显示运行预检条件；未配置可用模型也属于阻断条件。DSH 页面不提供 MCP 配置入口。

### 当前实施状态

DSH 管理员配置、服务端预检和 SDK 运行适配器已接入。2026-11-11 本机实测：SDK Client 与 Runtime 均为 `0.2.2-rc.1`，专用 Node 为 `24.9.0`；隔离探针确认宿主仓库、home、用户 D-Bus 不可见，PID 私有、无直接公网，任务代理 socket 可用且 Worker 环境无密钥变量。真实共享 Chat Completions 模型短提示词已返回“DSH试运行成功。”；隔离 HTTP 测试使用真实 SDK，覆盖完成、SSE 回读、取消、工具清单约束和运行产物无密钥明文。该结果只证明本机管理员试运行；共享 13510 实例是否装载新构建需部署回读，普通文档生产尚未开放。

默认 DSH 初始化策略和名称目前由 Agent 治理模块固定管理；若平台未来允许动态增加通用 Agent 执行器，应把执行器目录及初始化策略迁入平台配置并提供受控升级。

### 验收边界

测试覆盖 Agent 角色门禁、配置隔离与不回显、DSH 运行预检、SDK Client 生命周期/事件/拒绝审批/取消/超时、事件断线回读、最终状态持久化及管理员页面操作。SDK 完成、SSE 回读和取消已用真实 HTTP 与真实 SDK 验证；真实模型短提示词调用已成功。超时、故障注入和共享实例部署回读仍须分别验收；不能以本机成功代替共享实例已更新。普通文档生产接入、GitLab 写入和默认 Agent 晋级不在本次试运行授权内。

## 2026-11-11 Agent 设置页信息层级调整

平台页签已标识“Agent&模型服务”，内容区不再重复页面标题或“Agent 配置”。工作区保留新建操作与 Agent 列表；详情顶部显示当前名称、执行器、默认/启用状态和保存、运行测试。中间依次呈现模型与推理强度、知识库工具、运行范围、基本信息，字段使用可读字号；删除与字段值重复的用途及权限说明，但保留默认 Agent 控件、DSH 试运行边界和权限查看入口。

右侧仅展示当前页面中由真实运行事件确认的测试状态，初始为“尚未运行测试”。运行中、成功、失败、取消分别来自现有 `run-test`、SSE 与断线后的运行状态回读；成功时仅陈述已有终态可证实的产物校验，不虚构模型连接、MCP、工作区逐项通过，也不称其为跨会话“最近运行”。修改配置后原测试结果标记为需要重新测试。DSH 未就绪条件继续从服务端 `readiness.blockers` 展示，禁止发起试运行。手机端先展示当前 Agent 与测试状态，再展示配置字段。

伪代码：`selectAgent -> readCatalogAndModel -> showSessionRunStateOrUntested; startTest -> running; terminalEventOrReadback -> terminalState; editOrSaveConfiguration -> stale; dshReadiness -> renderBlockersAndDisableTest`。验收使用隔离真实 HTTP 浏览器流程，检查状态与终态一致、未就绪阻断、保存和连接配置、桌面与 390px 无横向溢出。
