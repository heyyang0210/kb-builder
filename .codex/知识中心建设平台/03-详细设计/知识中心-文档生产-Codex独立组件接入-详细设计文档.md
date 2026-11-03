# Codex 独立组件接入平台：通信与完整流程

日期：2026-10-29。状态：首期实现及限定范围真实联调通过。

## 接入结论

Codex 可以作为独立组件接入。当前实现使用独立 Node Worker 子进程，由 Worker 启动固定版本 `codex app-server`。平台与 Worker 通过进程 IPC 通信，Worker 与 Codex 通过 stdio 双向 JSON-RPC 通信，页面通过平台 HTTP API 和 SSE 获取结果。浏览器不直接连接 Codex。

模型配置和 MCP 配置完整归入各套 Agent，入口为“Agent&模型服务”；平台原有侧栏保持现有内容。内置工作流沿用现有执行链，Codex 自主执行工具和写作循环，共用候选、草稿、审核和交付契约。DeepSeek Harness 可保存配置，运行适配器尚未实现，不能设为默认或执行。

## 图纸与界面

[可编辑三页 drawio](./知识中心-文档生产-Codex独立组件接入-流程图.drawio)：独立组件与通信、文档生成时序、配置与运行契约。图纸已移入详细设计目录，历史 runtime 地址为符号链接。

[已确认界面及原型证据](../../../runtime/rea/agent-model-admin-20261029/README.md)。实现截图见 [桌面](../../../runtime/test-results/platform-agents/agents-desktop.png) 和 [窄屏](../../../runtime/test-results/platform-agents/agents-mobile.png)。截图使用隔离配置与现有平台侧栏，模型标识为测试数据。

原方案预览仍保存在 [图纸证据目录](../../../runtime/rea/agent-model-admin-20261029/codex-integration/README.md)，其中 PNG 是初版布局预览；以本目录 drawio 和本实施文档为准。

## 组件与通信

| 链路 | 实际方式 | 内容 |
| --- | --- | --- |
| 页面 → 后端 | 已鉴权 HTTP JSON | Agent/模型/MCP 配置、发起测试、取消、候选采用 |
| 后端 → 页面 | SSE 与运行记录 GET | 脱敏事件、单调序号、终态；支持 Last-Event-ID 或 after 补读 |
| 后端 ↔ Worker | Node fork IPC | 冻结任务、模型与 MCP 配置、进度、结果、取消 |
| Worker ↔ Codex | stdio JSON-RPC | initialize → initialized → thread/start → turn/start；取消用 turn/interrupt |
| Codex → 模型 | HTTPS Responses | 模型调用与工具循环由 Codex 自主完成 |
| Codex → 桥接 → MCP | 任务级鉴权的本机 HTTP MCP → 既有 MCPClient | 仅暴露当前 Agent 已启用知识库的检索与读取工具，保留路由、请求头、超时及缓存 |
| 工作区 → 候选 | 收集真实 output.json | 成功轮次后检查常规文件、大小及结构，再进入已有候选采用路径 |

每个任务有独立工作区和 CODEX_HOME，不继承开发者个人配置。运行凭据不返回页面、不记录到清单，auth.json 使用 0600 权限并在终态清除。当前为同机进程隔离，未交付容器、跨机传输或独立消息队列，也不将它视为对恶意代码的容器隔离。

## 一次文档任务

1. 用户在文档生产选择 Agent 对应的模型，提交写作要求、资料及技能。
2. 后端检查权限、Agent 与模型版本，冻结选择；Codex 路径先检查 Responses、凭据和 MCP 类型，不兼容时明确报错。
3. 按原业务链完成任务准备、资料快照和规划；写作阶段交由独立 Codex 运行组件处理。
4. 运行器先持久化 run.json，再启动 Worker；清单包含执行器版本、模型、推理强度、输入/规则摘要、超时和启用的 MCP 范围，不含明文凭据。
5. Worker 创建配置，启动 Codex 0.156.1，完成初始化、会话和轮次创建。Codex 自主检索、读取、写作、检查并在工作区创建 output.json。
6. 运行事件先脱敏持久化，再供管理页面通过 SSE 获取；工具进度不冒充文档预览。
7. 只有成功 turn/completed 且真实产物校验通过才返回正文和 provenance。聊天摘要不能代替文件交付。
8. 正文回到现有候选区，由用户采用到草稿；后续审核和发布仍使用平台现有规则。

## 模型与 MCP 配置

每套 Agent 持有 executor、reasoningEffort、model、mcp。模型和 MCP 编辑器复用原有全部字段和操作，密钥留空保留、替换及清除规则继续有效。首次未保存时只读投影旧配置为“内置文档工作流”；首次保存后写入 service.json#/agentServices，保留旧顶层配置以兼容历史调用。

Codex Provider 使用用户已验证的配置：

```toml
wire_api = "responses"
requires_openai_auth = true
base_url = "https://ai-green.yasdb.com/v1"
```

真实请求路径为 `/v1/responses`，单数 `/v1/response` 实测 404。选定模型、Provider、推理强度映射到 Codex 原生配置。当前实测模型为 `gpt-6-sol`。Chat Completions 配置在 Codex 路径明确阻断，内置工作流继续支持原协议。

连接中的 temperature、max_tokens 和 timeout 完整保留供内置工作流使用；当前 Codex 不映射温度和输出预算，总任务时限由 content-rules.json#/agentRuntime.timeoutMs 控制。模型菜单中的推理档位是配置选项，不表示所有服务商模型均已逐档验证；不支持时由运行失败明确返回。

MCP 服务和多知识库、自定义请求头、凭据及缓存保持原配置语义。桥接使用既有 MCPClient 和 resolveMcpService，每次工具调用检查服务及库是否启用且归属正确。当前支持 YashanDB 知识库适配器；已启用的 generic MCP 在 Codex 预检中拒绝，避免假称已经支持。

技能复用平台任务冻结的文本指令；不自动装入个人 Codex 全局技能、脚本或登录态。本地与平台一致性需使用相同版本、参数、指令、输入与工具范围对照；本次证明通信和业务接入可用，未宣称任意本地任务或生成质量完全一致。

## 取消、批准与恢复

- 取消：发送 turn/interrupt；超过等待期限终止 Worker/Codex 进程组，拒收取消后的迟到结果。
- 批准：使用 never 策略，反向批准请求拒绝。仅针对桥接层严格限制的只读知识库工具设置 `default_tools_approval_mode = "approve"`，不向其他命令或 MCP 扩大授权。首期没有人工批准 API。
- 页面断线：可查询任务记录并按事件序号补读；页面离开不等于取消后台任务。
- 执行进程丢失：记录 interrupted，不自动重放工具调用。恢复使用既有业务阶段快照创建新运行，不提供原生 thread/resume 原会话续跑。

## 验证与限制

真实运行证据：[完整结果](../../../runtime/test-results/codex-runtime/live-result.json)。实际安装的 Codex 0.156.1 通过公司模型网关，调用隔离 MCP HTTP 服务的 search_ku/get_ku_detail，生成包含工具校验码的文件，经生产 API 成为候选并成功采用到隔离草稿。

这次调用使用真实模型，MCP 上游和业务/草稿存储为受控测试数据，未发布到公司正式知识库或 GitLab。内容质量和正式交付链保持原有验收要求。

可重跑检查：

```bash
node --test tests/e2e/agent-runner/platform-agent-management.test.cjs tests/e2e/agent-runner/platform-model-management.test.cjs
node --test tests/e2e/agent-runner/codex-runtime.test.cjs
# 下列命令会真实调用已配置模型：
RUN_LIVE_CODEX=1 node --test tests/e2e/agent-runner/codex-runtime.test.cjs
npm run test:knowledge-center -- --runInBand tests/unit/agent-runner/production-ai-service.test.js tests/unit/agent-runner/mcp-governance.test.js
npm run build
```

协议证据保存于 runtime/rea/agent-model-admin-20261029/codex-integration/schema。官方对应版本配置 Schema 已获取到 runtime/agent-integration-20261029/config.schema.json，用于核实只读桥接工具自动批准配置；先前官方网页 403 的记录仍保留，不作为已读正文。

最终检查：相关单元测试53/53通过；配置/写作/运行控制HTTP与浏览器用例4/4通过，真实Codex联调另已通过；统一构建通过（379个Node文件语法检查）。有效drawio XML及历史符号链接检查通过，git diff --check通过。代码和本地配置已更新，未重启共享平台服务、未提交代码或发布业务内容。

2026-10-29实际使用纠偏：上一轮未重启网关导致新前端调用旧API并收到首页HTML。本次已补API回退/前端解析保护，构建并仅重启Web网关；实际管理员API与页面读取通过，平台4/4服务正常。证据见 runtime/diagnostics/agent-admin-fix-20261029/verification.json。
