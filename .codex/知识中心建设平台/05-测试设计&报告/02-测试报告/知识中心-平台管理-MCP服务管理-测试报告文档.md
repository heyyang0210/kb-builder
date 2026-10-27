# 平台管理 MCP 服务管理测试与交付报告

执行日期：2026-10-23。范围：在平台管理承接原知识文档生成器的 MCP 配置能力，保留同一配置和客户端。未提交 Git、未发布生产、未改写真实 MCP 配置。

## 交付与复用

入口：**平台管理 → MCP 服务**，路径 `/knowledge-center/platform?tab=mcp`。仅平台管理员可维护。

| 原生成器能力/证据 | 平台实现 | 处理 |
|---|---|---|
| `document-generation-workbench.html` MCP表单 | `modules/platform-admin/mcp-admin.js` | 适配中文平台分区、未保存提示、响应式布局 |
| `routes/config.js`、ConfigManager | `lib/platform-management/mcp-governance.js` | 复用唯一 service.json#mcp、AES-GCM、原子文件写入；新增脱敏、版本校验、凭据合并 |
| `lib/tools/mcp-client.js` | 新平台测试直接调用同一客户端 | 复用握手/工具发现，补协议错误校验及TTL=0修复 |
| `lib/production-ai-sources.js` MCP引用 | 同一 ConfigManager 获取新配置 | 未创建额外配置/客户端实现；新实例使用新配置 |

配置项：服务网址、API Key、自定义请求头、超时、缓存开关、有效期及最大条数。API Key 与普通请求头值加密且不回显；搜索路由知识库 ID 非敏感，在管理界面展示并可编辑。空值保留、Key显式清除、移除整行删除。切换网址时不能隐式转移原凭据。规则来自 `content-rules.json#/platformMcp`。

## 已执行结果

| 层次 | 实际验证 | 结果与边界 |
|---|---|---|
| Jest，3套55项 | mcp-governance、tools、production-ai-service | 55/55通过；使用隔离真实HTTP及真实配置管理器，不改共享配置 |
| 相邻回归，2套24项 | database-connection-governance、knowledge-center-navigation-pane-contract | 24/24通过，现有数据库治理与导航契约保持通过 |
| 协议与存储 | JSON/SSE、协议错误/错误ID/错误tools、真实超时、加密落盘、跨进程回读 | 通过；跨进程回读不等于跨进程竞争写已解决 |
| HTTP接口 | GET/PUT/test、401/403、405、409、502、no-store | 通过；测试不写入、不执行tools/call，错误不透传远端凭据 |
| 共享能力 | 平台保存后用原MCPClient及AI来源读取同一隔离服务 | 通过；该用例显式调用fixture文档工具，与管理连接测试区分 |
| Chromium隔离界面 | 10项浏览器检查、无页面JS错误、360px无横向溢出 | 通过；真实平台handler+隔离配置/MCP服务，非企业业务集成 |
| Windows Chrome现有登录会话 | 实际平台管理深链接、分区和表单、真实GET接口 | 通过；GET=200，表单及MCP分区存在，读取两条历史标头；未导出登录凭据 |
| 企业MCP原始表单 | 保留既有重复标头测试 | 未通过配置校验：同名请求头重复；没有写入 |
| 企业MCP去重测试草稿 | 按原客户端最后覆盖顺序保留一条，超时5000ms，握手/目录 | 通过；ksacraft-mcp 0.1.0-dev，72ms，4个工具，未调用业务工具，文件摘要前后相同；去重未保存 |

发现工具：`get_ku_detail`、`get_ku_detail_with_relations`、`list_related_ku`、`search_ku`。握手及目录可读不代表每个工具的业务权限或引用正文验收已通过。真实配置保留原状，管理员仍需整理重复条目再保存；保留项须重填值，避免歧义。

双库界面截图：`runtime/test-results/platform-mcp/search-targets-desktop.png`、`search-targets-mobile.png`。桌面截图确认目标框宽度受限，窄屏截图确认移除按钮仍与目标值框同排。

执行命令：

```bash
runtime/agent-runner/node_modules/.bin/jest --config tests/unit/agent-runner/jest.config.js --runInBand tests/unit/agent-runner/mcp-governance.test.js tests/unit/agent-runner/tools.test.js tests/unit/agent-runner/production-ai-service.test.js
node tests/e2e/agent-runner/platform-mcp-management.cjs
```

证据在 `runtime/mcp-jest.log`、`runtime/mcp-browser.log`、`runtime/test-results/platform-mcp/`，包括 browser-results.json、desktop.png、mobile.png、windows-api.json、windows-ui.json、enterprise-probe.json 和 enterprise-normalized-draft.json。运行证据目录不作为持久配置。

## 手工验证流程

1. 使用平台管理员登录，刷新浏览器后进入“平台管理 → MCP 服务”；也可直达上述深链接。
2. 确认网址、超时及缓存可读；Key及请求头值为空，仅提示是否已配置。
3. 输入或调整测试配置。重复的 `X-Ksacraft-Kb-Id` 行表示多个搜索知识库；其他历史同名标头需确认目标后移除重复行，并为保留行重新填写值。
4. 点击“测试连接”，查看本次服务名、耗时及工具目录。此步骤不保存；失败后输入应保留。
5. 点击“保存配置”，成功后凭据输入清空，刷新应读回非敏感配置与已配置状态。真实服务修改须使用获准目标配置。
6. 修改非敏感值后切换分区，应提示放弃；取消应留在原表单。重新加载同样会提示。
7. 两个窗口读同一版本，在窗口A保存后窗口B保存，应提示配置已变化，B输入保留；重新加载后再编辑。
8. 显式勾选清除Key、移除标头后保存，确认状态更新。此删除场景优先在隔离配置运行，勿无意删除真实凭据。
9. 在AI文档生产来源中选择知识库MCP并预览授权文档；该步骤是正文引用验收，需另外确认文档ID和工具访问权限。

## 优缺点与优化

优点：最大化复用配置/加密/协议，避免两个入口漂移；新入口具备管理员权限与敏感值保护；测试和保存分离、版本冲突及表单保留改善可操作性；能展示远端真实工具目录。

缺点：仍是单个共享服务，影响所有使用方；旧生成器接口未同步纳入新管理员网关；只保留最近操作者，不是完整历史审计；跨进程写入非事务；传输和工具引用受原客户端协议及固定工具映射约束；继承默认加密密钥回退的限制。

进一步优化见 [MCP服务管理后续优化待办](../../04-开发任务/知识中心-平台管理-MCP服务管理-后续优化待办.md)，优先统一旧入口权限和生产密钥，再扩展多服务/用途绑定、审计与原子版本、完整工具适配和协议支持。本次不声称已完成上述生产治理。


Windows平台上下文刷新验证：主动触发只读 `knowledge-data-changed` 的 context 刷新后，表单根DOM、编辑值和dirty标记均保留，未保存配置；见 `windows-refresh-draft.json`。首轮脚本错误等待 aria-busy=false，而实际完成时移除属性，出现超时；修正为等待属性移除后通过，首轮证据另存，不作为产品故障。

最终检查：相关 JavaScript 语法检查与 `git diff --check` 通过。相邻回归日志：`runtime/mcp-adjacent-regression.log`。本轮共5套79项Jest通过、10项隔离浏览器检查通过；不等于仓库全量测试。

## 历史同名请求头问题复测（2026-10-26）

根因证据：旧 `service.json#mcp.headers` 可含大小写不同但名称相同的历史行；GET 投影为保护凭据将值清空。管理员删除重复行后若让保留项的密码输入框保持空白，`mcp-governance.js` 无法安全判断应沿用哪一条旧密钥，因此在保存时明确拒绝。自动挑选或合并会改变发送凭据，不能作为修复。

修复后投影仅增加 `legacyDuplicate` 布尔状态，不包含秘密值；界面在历史重复行旁提示删除重复行并为保留行重填值。请求头名校验仍拒绝新建重复项。按钮改为“测试连接”，连接成功仍执行握手和工具目录发现；MCP 表单间距、输入高度和小屏间距已收紧。

本轮单独复测：Jest `mcp-governance.test.js` 19/19 通过，覆盖重复历史标头提示状态、敏感值不回显、留空仍拒绝及移除重复项并重填后保存。隔离 Chromium E2E 增至12项，覆盖按钮文案、握手和目录、历史重复项界面提示/去重/重填保存、桌面与360px视口布局，无横向溢出、无页面脚本错误。截图及 `browser-results.json` 更新在 `runtime/test-results/platform-mcp/`。本轮不读取、不改写或探测企业 MCP 配置；对企业文档/运维两组真实值的选择仍须由配置管理员确认并重填。

## 双知识库请求头真实复测（2026-10-26）

按用户指定值分别使用 `X-Ksacraft-Kb-Id=1`（YashanDB官方文档）与 `=24`（YashanDB运维文档），对当前 MCP 服务执行真实只读 initialize、tools/list、search_ku。两种单头配置均握手成功，发现4个工具，搜索结果分别返回 `kb_id=1`、`kb_id=24`，各20条。未执行 `tools/call` 写操作或保存配置。

双知识库搜索实现：管理界面中重复的 `X-Ksacraft-Kb-Id` 行保存为两个搜索目标；搜索按目标分别建立 MCP 会话并调用 `search_ku`，合并后按 `ku_name` 去重并保留高分项。单库失败时保留成功库的结果并附失败计数，全部失败时返回错误。缓存键含目标列表；文档详情读取不跨库扩展。隔离 HTTP fixture 与端到端验证结果待本次实现后补记。

同一 MCPClient 同时接收两个完全同名标头时，`MCPClient` 的 `customHeaders` 普通对象按键覆盖，实际只发送列表最后一个值：`1,24` 查询落到24；`24,1` 查询落到1。若大小写不同，HTTP层形成重复标头，服务返回400 `no server available`。因此平台不应把两个同名标头当成一条请求可同时使用的配置；两库的业务访问需要按明确的产品语义拆成分别请求/选择。当前待确认是：检索自动查询两库合并，或引用时由用户选择知识库。在该行为确定前，不将单库通过表述成双库支持已完成，也不擅自改变生产检索结果语义。

## 双知识库自动合并实现验证（2026-10-26）

按用户确认的自动双库行为实现：重复 `X-Ksacraft-Kb-Id` 行归一化为搜索目标；MCPClient 也会从集中规则识别尚未规范化的旧重复行，升级后无需先保存配置。每个目标独立初始化会话并执行 `search_ku`，按 `ku_name` 合并去重，重复项保留高分结果。缓存键包括查询参数和全部目标；单目标失败时保留其余结果并附失败数量，全部失败则报错。非搜索自定义标头仍不允许重复；`get_ku_detail` 不扩展为跨库读取。

验证结果：`mcp-governance.test.js` 与 `tools.test.js` 共45/45通过；覆盖配置保存/脱敏、普通重复标头拒绝、目标行保存、删除第一目标后按原序号保留第二目标、无序号空行拒绝、分库路由、合并去重、缓存命中、单库失败降级，以及 HTTP API 保存后用运行配置执行双库查询。Playwright 平台 MCP E2E 13项通过，包括界面配置两行目标并实际完成聚合搜索；管理界面直接显示 `1` 和 `24`，桌面目标值框宽度受限，移除按钮与值输入框同排，360px无横向溢出且同排布局保持，无页面脚本错误。`node --check`、规则JSON解析和 `git diff --check` 通过。

真实 MCP 只读 E2E 使用用户指定的 `1`（官方文档）与 `24`（运维文档），查询 `YashanDB SQL 事务 提交 回滚`；响应包含两个 `kb_id`，合并40条，部分失败数为0。该请求只执行搜索；未写共享配置、未调用写工具。此前“等待双库行为确认”和“当前不支持双库”的记录为实现前历史状态，以本节结果及用户确认行为为准。


## 2026-10-26 多服务与知识库列表实施验收

本节替代上述单服务界面验收口径；旧记录保留为历史。用户确认“默认折叠服务列表＋服务下知识库列表＋独立配置与保存”。已实现紧凑主表、服务搜索、新增、独立保存/删除/测试/启停，按需连接设置与知识库子表。AI 辅助写作来源可明确选择服务和知识库，快照保留归属。兼容历史单服务配置，未修改共享 MCP 地址或凭据。

| 验证 | 本次结果 |
|---|---|
| 后端回归 | mcp-governance、production-ai-service 两套 39/39 通过；隔离真实 HTTP 上游与加密配置文件 |
| 写作引用路由 | 服务 B/库 24 实际读取、快照归属、跨服务错误知识库拒绝、目录不暴露服务地址通过 |
| 浏览器端到端 | 9项检查通过，真实平台handler：两个服务保存后折叠、加密脱敏、折叠测试、知识库读取、保存A保留B草稿、红绿结果、搜索、刷新恢复与360px布局 |
| 页面错误 | 浏览器无未处理页面异常 |
| 构建和运行 | npm run build 成功；restart --no-build 成功，四项服务就绪；MCP JS/CSS及写作JS实际HTTP资源与源码逐字节一致 |
| 变更格式 | git diff --check 通过 |

修复了测试暴露的服务版本冲突：随机 IV 重新加密不再改变未编辑服务的语义版本；仍保留同一服务真正过期编辑的409保护。

证据：`runtime/test-results/platform-mcp/unit.log`、`e2e.log`、`browser-results.json`、`desktop.png`、`expanded.png`、`settings.png`、`mobile.png`、`build.log`、`restart.log`、`served-resources.json`。桌面展开截图已人工核对。隔离MCP成功不代表企业知识库所有实际文档已通过读取权限验收，本次未使用共享凭据调用企业业务工具。未执行Git提交。


## 2026-10-26 管理界面纠偏与真实知识库测试

移除服务类型、服务启用、旧入口默认服务控件及服务状态列。统一按钮“测试”“保存”“取消”，知识库列为“最近测试”。管理端连接测试允许诊断历史停用服务；知识库测试无需准确条目名，直接使用该知识库的路由执行查询，搜索无匹配结果仍可成功。兼容旧document参数的只读测试。

后端两套39项通过，新增历史停用配置可测试、测试不修改配置、库24查询路由与远端错误返回失败的断言。浏览器9项通过，新增三个冗余控件不存在及“测试”“保存”文案断言；已核对settings.png。

使用当前真实配置执行只读查询：YashanDB官方文档库测试成功（379ms），YashanDB运维文档库测试成功（131ms）；配置文件前后字节一致。证据 `runtime/test-results/platform-mcp/live-kb-test.json`。成功仅表示所选知识库查询接口正常响应，不代表任意文章均存在或所有工具权限已验收。


### 测试结果关键信息补充

知识库测试直接显示库名、ID、耗时、工具和本次匹配数；24项后端测试通过。浏览器9项通过，新增点击知识库测试没有dialog的断言和结果包含ID/耗时/search_ku/匹配数断言。截图中的“验证读取”属于旧模块；实际服务资源已无输入条目名的prompt，响应头为must-revalidate，不能据此归因浏览器缓存故障；应整页刷新以替换已加载模块。
