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
