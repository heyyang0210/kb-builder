# AI 写作统一模型管理测试报告

日期：2026-10-26。范围：方案一，平台管理员维护模型服务、作者在 AI 辅助写作页选择模型、实际生成与采用可追溯。

设计基线：[平台管理设计：AI 辅助写作统一模型管理](../../03-详细设计/知识中心-平台管理-治理权限与GitLab连接-详细设计文档.md#ai-辅助写作统一模型管理方案一2026-10-26)。设计先于实现，最终归入既有模块设计单一入口。

## 关键矛盾与结论

“后端能够调用模型”原先缺少配置入口、选择入口和执行证据。本轮通过管理员配置/测试 → 作者选择 → 服务端验证并固定启动配置 → 候选/草稿记录请求与实际模型的闭环解决。没有仅增加下拉框；上游收到的 URL、model、Authorization 均由真实 HTTP fixture 断言。

## 验证结果

| 检查 | 结果与证据 |
|---|---|
| 新增浏览器端到端 | `node --test tests/e2e/agent-runner/platform-model-management.test.cjs`，1 项复合场景通过；真实浏览器、平台 HTTP 路由、ConfigManager、LLMClient 与本地双协议上游，未拦截浏览器 API |
| 配置闭环 | 浏览器新增第一个服务并设默认、测试不落盘、保存成功密钥清空；新增第二个 Responses 服务，保存后列表可选择；新行临时 ID 正确转换为永久 ID |
| 密钥与权限 | 真实 AES-GCM 落盘不含测试明文密钥；新读取解密可用；浏览器投影/任务/草稿无密钥；空值保留、显式清除、无密钥不能启用；改地址需重填；作者管理接口403、无读取权限目录403 |
| 真实协议请求 | Chat Completions 请求 `/v1/chat/completions`，Responses 请求 `/v1/responses`；指定模型名与 Bearer 请求头正确；失败上游正文不泄露 |
| 作者选择与保存追溯 | 默认服务 model-a；写作页显式选择非默认 model-b，上游实际收到 model-b，返回 model-b-actual；候选和采用后 API 草稿回读均记录请求/实际模型与配置版本 |
| 一致性与幂等 | 旧 rowVersion 保存拒绝；旧目录选择409；当前版本停用模型不能创建任务；任务开始后停用模型仍按启动配置完成，重复幂等提交返回原任务、不再次调用上游 |
| 可用性与响应式 | 空目录提示平台管理配置路径并禁止生成；390px 无横向溢出；浏览器脚本异常0；运行中锁定选择，恢复历史候选保留原任务模型 |
| 既有写作 E2E | `node --test tests/e2e/agent-runner/production-writing.test.cjs`，3通过、1真实模型场景按开关跳过；真实模型另独立运行并通过 |
| 真实配置模型 | `WRITING_LIVE_MODEL=1 node --test --test-name-pattern='真实配置模型' tests/e2e/agent-runner/production-writing.test.cjs`，1通过；请求 gpt-5.5，上游实际返回 gpt-6-sol，选区润色→候选→采用→草稿HTTP回读完成 |
| 后端回归 | production-ai-service、mcp-governance、llm-client 共3套件38项通过；config-manager既有套件9项通过（该套件使用测试实现，真实配置加密证据以前述E2E为准） |
| 页面与导航回归 | GitLab、权限、人员、导航4套件49项通过 |
| 静态与构建 | Node语法检查355文件通过；完整构建成功；修改范围 diff 空白检查通过 |
| 实际开发服务 | 确认 environment=development，无运行中AI任务；仅重载前端服务，不重启存储/文档/PingCode。4/4服务健康；5个核心JS响应与源码摘要相同；两个新接口未登录均401/AUTH_REQUIRED |

## 运行证据

`runtime/test-results/platform-models/`：`e2e.log`、`unit.log`、`platform-regression.log`、`view-regression.log`、`writing-regression.log`、`live-model.log`、`syntax.log`、`build.log`、`shared-service-verification.json` 及管理员/写作页面截图。

`runtime/test-results/production-writing/live-model-result.json` 记录真实模型选择、实际返回模型和修订编号；使用注入的编辑者身份及隔离内存草稿，未改变共享业务文档和真实模型配置。协议上游使用本地确定性服务，与真实供应商验证分别报告。

## 验证边界

真实供应商本轮只验证已有兼容 Chat Completions 配置；Responses 通过已安装 SDK 和本地 HTTP 协议服务验证，不能据此宣称所有供应商或模型均兼容。OpenAI 官方参考页抓取返回403，没有将未读取的官方页面作为协议正确性证据。实际共享服务完成资源与未登录接口核对；登录后管理员/作者交互在隔离会话中验证，未在共享配置页保存测试服务。其他 Agent 继续使用原顶层模型配置，新目录用于 AI 辅助写作。

首轮新 E2E 草稿回读断言误用了 `data.revision`，按实际契约修正为 `data.draft.revision`；这是测试路径错误，未改产品返回格式。原有未提交改动保留，未执行提交。

## 配置易用性修订验证（2026-10-26）

参考已有文档生成器，将服务商、显示名称、地址、密钥、模型放入常用区；协议与生成参数折叠，增加中文说明。公开地址预设由配置下发，不覆盖手填地址或历史配置。新服务默认启用，首个模型自动成为默认；测试连接、保存分别反馈结果。

重新运行 `node --test tests/e2e/agent-runner/platform-model-management.test.cjs` 通过，实际平台后端与本地双协议上游完成测试、加密保存、非默认模型生成、采用回读和权限验证。新增断言覆盖高级设置默认折叠、服务默认启用、服务商地址预填、手填地址保留、默认模型自动选择及390px管理页无横向溢出。首次运行暴露空占位选项阻止自动默认选择，修复后复测通过。截图完成目视核对。完整构建成功；运行服务返回的管理页 JS/CSS 与当前源码逐字节一致。

证据：`runtime/test-results/platform-models/usability-e2e.log`、`usability-build.log`、`usability-served.json`、`admin-models.png`、`admin-models-mobile.png`。未改动共享模型凭据或业务文档；本次未重复真实供应商生成，端到端上游为本地 HTTP 服务。

## 非安全 HTTP 来源渲染回归（2026-10-26）

- 问题：用户截图显示新版步骤，但配置字段缺失，提示 `crypto.randomUUID is not a function`。
- 根因：addRow 在插入 DOM 前无条件调用仅安全上下文可用的 randomUUID；HTTP 非回环地址下抛异常。此前仅 localhost E2E，未覆盖实际访问条件。
- 修复：使用挂载范围内递增 clientId，满足新服务与默认选择关联唯一性；永久服务 ID 继续由后端生成。
- 验证：浏览器通过 model-http.test 映射本机访问真实隔离后端，断言 isSecureContext=false、randomUUID 不可用。修复前配置表单无法出现，修复后原端到端用例通过，覆盖新增及保存后已有服务绘制、双协议测试、加密保存、默认引用、多服务选择、写作采用和权限。日志为 `http-before-fix.log` 和 `http-after-fix.log`。
- 剩余事项：未操作用户登录会话或共享配置，非安全 HTTP 条件在隔离会话验证。

完整构建通过（`http-fix-build.log`）；通过实际 HTTP IP 地址读取运行 JS 与源码一致，已不包含 crypto.randomUUID（`http-fix-served.json`）。

## 紧凑服务列表验证（2026-10-26）

原页面将所有服务配置常驻展开，管理增删时信息密度低。现改为标题“＋”新增、已保存服务默认折叠的紧凑列表。摘要包含名称、服务商、模型、启停及独立删除；新增展开编辑，保存后收起；移除操作保存生效。

`compact-list-e2e.log`：非安全 HTTP 浏览器与真实隔离后端测试通过。覆盖首服务新增、双协议连接测试、默认模型、加密保存、保存后折叠、摘要展开/收起、删除新行、取消删除、重新进入后折叠、确认删除并保存后端回读；相邻写作生成和采用追溯回归通过，脚本异常0。桌面折叠行小于90px，实际截图单行约54px；390px无横向溢出；桌面与窄屏截图已目视核对。未修改共享模型配置和业务文档。截图保存在 `runtime/test-results/platform-models/admin-models.png` 和 `admin-models-mobile.png`。

本轮完整构建通过（`compact-list-build.log`），实际 HTTP IP 服务返回的 JS/CSS 与源码一致（`compact-list-served.json`）。

## 按网关截图补全 GPT 模型目录（2026-10-26）

通过真实平台 handler 的HTTP GET/PUT配置接口，使用本地注入管理员身份，读写当前共享 service.json 模型目录。追加 `gpt-5.6-luna`、`gpt-5.6-sol`、`gpt-5.6-terra`、`gpt-6-astra`、`gpt-6-luna`、`gpt-6-sol`；截图中的 `gpt-5.5` 已存在，保留原有 `gpt-5.6` 及其默认选择。保存前在 runtime 下保留权限0600的原配置备份，密钥、地址、协议、生成参数和其他服务逐项比对不变。

非安全HTTP浏览器从实际配置读取可用模型文本与测试下拉框，8项完全一致，可选择 gpt-6-sol；真实写作模型目录API返回同样8项；页面异常0。证据：`runtime/test-results/platform-models/gpt-model-options.json`、`gpt-model-options.png`。未逐模型调用付费推理，不将用户截图的可用性说明当作实测通过。图片模型与向量模型不放入文本写作调用列表。此次仅配置数据补全，无前端代码或构建产物变化，无需重新构建。

## 折叠行测试按钮验证（2026-10-26）

评估该位置合适：折叠列表中可直接核验已保存服务。已新增独立“测试”按钮，测试服务已保存配置及第一个模型；行内显示请求/实际模型和耗时，不展开、不保存。编辑态仍可使用原“测试连接”测试当前尚未保存的配置。

`service-test-button-e2e.log` 通过：浏览器按钮真实调用隔离后端和本地上游，调用计数+1、请求 `model-a`、成功回显 `model-a-actual`、服务维持折叠、配置保存版本不变；完整写作/权限回归继续通过。`service-test-button-build.log` 完整构建成功；实际HTTP IP服务返回JS/CSS与源码一致，详见 `service-test-button-served.json`。未对共享模型执行真实供应商/计费请求。

## 测试模型记忆与结果强调验证（2026-10-26）

按服务在当前浏览器记忆测试模型，不改变写作默认项或配置脏状态；新增服务保存时迁移选择，记忆模型不在目录时回退到首项。测试结果位于折叠区外，绿色“测试成功”和红色“测试失败”作为主信息，模型、耗时和错误原因作为次要信息。结果不持久化。

`runtime/test-results/platform-models/test-feedback-e2e.log`：非安全HTTP Chromium 调用真实隔离后端及本地模型上游，端到端测试通过；覆盖选择 model-a2、折叠测试实际使用该模型、配置重载及整页刷新恢复、刷新清空历史结果、成功失败文字与颜色不同、折叠可见性，以及原双协议/写作/权限回归。成功与失败截图分别为 `test-feedback-success.png`、`test-feedback-failure.png`，已目视检查。

完整构建成功（`test-feedback-build.log`），实际 HTTP IP 服务返回的 JS/CSS 与源码一致（`test-feedback-served.json`）。未调用共享模型供应商计费接口；偏好仅限当前浏览器，清除站点存储后不保留。

## 模型测试快速探测验证（2026-10-26）

Chat Completions 与 Responses 均改为流式最小探测，独立15秒总期限、32 Token预算、零重试；首段正文即成功并取消。展示首字与本次探测总耗时，分类提示超时、鉴权与限流。

- `runtime/test-results/platform-models/model-probe-e2e.log`：真实隔离后端、双协议SSE上游及Chromium端到端通过，覆盖选择记忆、成功失败颜色、配置与写作回归。
- `runtime/test-results/platform-models/probe-deadline.log`：双协议真实HTTP验证未结束流在成功后关闭、已收响应头但无正文时总期限中止、401/429分类与无重试，全部通过；测试覆盖期限使用200毫秒。
- LLMClient 4项单元测试通过；JSON配置解析和 git diff --check 通过。
- `model-probe-build.log` 构建通过，`model-probe-restart.log` 重启完成，平台4/4组件正常；实际HTTP返回model-admin.js逐字节等于源码。

未调用共享外部模型，未形成外部供应商前后耗时对照；首字时间仍受模型和网关影响。
