# 知识中心文档生产 Agent 架构：功能实现与测试报告

> 报告日期：2026-10-27（持续复验）
> 适用范围：当前工作区未提交代码
> 依据：`知识中心-文档生产-Agent架构详细设计.md`、当前源码和测试结果

## 1. 结论摘要

当前版本已交付文档生产页的可用闭环：作者在沉浸式写作页中输入写作要求，按需打开“生成设置”弹框选择模型、参考资料和 Skill，生成候选并在作者明确采用后写入草稿；阶段契约和产物摘要会在服务端校验，失败或中断任务可在原 Job 上显式重试，满足摘要条件的租约过期任务可通过恢复接口继续执行。候选生成、采用、取消、租约过期、恢复、重试幂等和来源快照均通过同源 HTTP API 验证。

本版本实现的是**受控阶段编排**，不是完整的多 Agent 编排。Planner 和 Evidence 是服务端阶段包装，Writer 默认是一次模型调用但已有可替换 Adapter 契约，Reviewer 只做结构化协议、引用和范围校验。阶段产物保存在独立 `production-ai-artifacts` AggregateStore，Job 只保留经过摘要校验的 artifact 引用；默认生产服务启动时会执行一次过期任务扫描，也支持可配置周期扫描、带 claim 的多实例恢复和 HTTP/受控恢复；独立 Agent 服务、完整事实质量门禁和跨执行器盲评仍未实现。

## 2. 需求与实现映射

| 需求 | 当前实现 | 主要位置 |
| --- | --- | --- |
| 低频选择不占主流程 | 模型、参考资料、Skill、模板摘要集中在“生成设置”弹框；主流程只展示摘要 | `modules/production/production-writing-page.js`、`production.css` |
| 提供三种页面方案 | 设计文档记录主流程内联、折叠分组、统一设置弹框三种方案，当前采用统一设置弹框 | 详细设计第 11.1 节 |
| Skill 可选择 | 按当前 operation 筛选，默认不选，支持指令预览，提交 ID 和内容哈希 | `production-ai-skills.js`、`production-writing-page.js` |
| 参考资料可选择 | 拉取、预览、勾选、移除；默认不选，提交确认来源 ID | `production-ai-sources.js`、`production-writing-page.js` |
| 模型选择 | 从模型服务目录选择，生成请求冻结请求模型和配置版本 | `model-governance.js`、`handbook-production-api.js` |
| 原文基线 | GitLab 映射正文使用仓库正文；无映射或不存在时使用空正文，不回退模板正文；分支漂移显示新旧基线对照，并允许固定旧 commit 或载入新基线后重新确认范围 | `production-writing-page.js`、`handbook-view.js`、`knowledge-center.js` |
| 草稿安全 | 候选与草稿隔离，作者采用后才更新；采用带版本校验 | `production-ai-service.js`、`handbook-production-api.js` |
| 任务控制 | 租约、幂等键、取消、迟到结果丢弃、租约过期状态已实现 | `production-ai-service.js` |
| 阶段契约与部署 Adapter | Planner/Evidence/Writer/Reviewer 的结构、范围、来源集合、契约版本和摘要校验；部署端可按阶段配置 HTTP Adapter URL、Bearer Token 和超时，Job 仅存 artifact 引用 | `production-ai-contracts.js`、`production-ai-service.js`、`production-ai-artifact-store.js`、`production-ai-http-stage-adapters.js` |
| 受控恢复 | 租约过期后校验成功前置产物，复用 Planner/Evidence，追加 Writer/Reviewer attempt | `production-ai-service.js`、`knowledge-center.js` |

## 3. 请求与冻结契约

生成请求保留以下字段：

- `modelSelection`：模型服务、模型标识和配置版本。
- `confirmedSourceIds`：作者明确勾选的参考资料。
- `selectedSkills`：Skill ID、版本/内容哈希等冻结信息。
- `originSnapshot`：`gitlab` 或 `blank`；GitLab 要求 `snapshotId`、分支和路径，内容摘要为 64 位十六进制；空白正文摘要必须匹配空字符串摘要。
- `document`、`operation`、`range`、`editVersion`、`requirements` 和模板/大纲上下文。

Job 创建后冻结 `originType`、`baseSnapshotId`、`baseDigest`、`workingCopyDigest`、`draftRevisionId`、`editVersion` 及来源元信息。阶段轨迹保存在 Job 的 `stageRuns` 中；`artifacts.records` 只保存 artifactId、阶段、契约版本和摘要，阶段产物正文单独保存在 artifact store，读取 Job 时按引用校验并 hydration。

## 4. 阶段实现边界

当前阶段序列为 `planner -> evidence -> writer -> reviewer`：

1. Planner 根据请求和已确认来源构造写作计划。
2. Evidence 记录来源和证据摘要。
3. Writer 调用模型生成候选。
4. Reviewer 校验结构化输出、引用 ID 和范围协议。

每个阶段记录状态、attempt、contractVersion、输入/输出摘要、起止时间、错误码和输出摘要。取消或租约过期时，未完成阶段会闭合为失败并写入 `AI_JOB_CANCELLED` 或 `AI_JOB_INTERRUPTED`。

当前未实现：独立 Agent 服务、跨执行器盲评和事实质量审核门禁。默认服务启动时的一次性扫描已实现；配置 `KNOWLEDGE_PRODUCTION_RECOVERY_INTERVAL_MS` 可启用周期扫描，并可通过服务返回的 `stopRecoveryScheduler()` 清理调度器。恢复事务写入带过期时间的 `recoveryClaim`，数据库 AggregateStore 通过 revision 冲突协调多实例，文件模式要求单写入进程。Writer 已支持 `stageAdapters.writer.run(envelope, context)` 的替换接口，默认仍使用现有模型客户端。阶段重试和恢复均在原 Job 上追加新 run，旧 run 保留，`attempt` 递增，同一重试幂等键不会重复派发；恢复只有在前置产物摘要可重算时才跳过成功阶段。Artifact 采用先写产物再写 Job 引用的顺序，进程在两次写入间退出时可能留下孤儿产物，已提供 `cleanupArtifacts` 按 Job 引用和时间阈值清理。内容质量服务和 YashanDB 检查可以独立运行，但不能把 Reviewer 阶段的协议校验表述为事实正确性审核。

## 5. GitLab 和来源边界

前端会把已加载的 GitLab projection 转成 `originSnapshot`，并将 commit/blob 定位信息传入 Job。AI Job 创建 API 已在服务端重新解析手册映射，使用当前请求会话的 GitLab 授权读取文件，检查分支、映射路径、内容摘要及可得的 commit/blob，并用服务端返回内容规范化后冻结来源。未配置映射时只接受空白正文摘要；存在映射但缺少来源快照时拒绝创建任务。漂移时返回 `AI_ORIGIN_BASELINE_CHANGED`，不创建 Job。

- 对旧 commit 的可达性/分支历史关系做更强校验；
- 对已配置映射但目标文件不存在时的显式空白基线流程增加服务端路径解析；
- 在 GitLab 无法提供 commit/blob 时，只能依据服务端读取内容摘要，不可提供 Git 版本级证明。

当前核验已覆盖提交快照结构、授权映射内的文件读取及正文摘要一致性；不应将其扩大表述为对 Git 历史可达性或所有未映射目标文件的完整校验。

## 6. 测试执行与结果

| 命令 | 结果 |
| --- | --- |
| `node --check apps/knowledge-center-web/frontend/knowledge-center/modules/production/production-writing-page.js` | 通过 |
| `node --check apps/knowledge-center-web/frontend/knowledge-center/modules/production/production-ai-dialog.js` | 通过 |
| `node --check packages/agent-runner-core/lib/production-ai-service.js` | 通过 |
| `node --check tests/unit/agent-runner/handbook-production-api.test.js` | 通过 |
| `npm run test:knowledge-center -- --runInBand --runTestsByPath tests/unit/agent-runner/production-ai-service.test.js` | 20/20 通过；含失败 Writer 重试、旧轨迹保留、attempt 递增、运行中/完成状态拒绝重试 |
| `node --test tests/e2e/agent-runner/production-writing.test.cjs` | 4 项：3 通过，1 跳过（未启用真实模型） |
| `node tests/unit/agent-runner/handbook-production-api.test.js` | 17 项：15 通过，2 跳过，0 失败 |
| `node --test tests/unit/agent-runner/handbook-production-api.test.js` | 20 项：18 通过，2 跳过，0 失败；包含真实 HTTP retry、恢复401/403/404权限与文档隔离、重复幂等键、阶段轨迹回读及 GitLab 来源核验 |
| `node --test --test-name-pattern='AI recovery resumes' tests/unit/agent-runner/handbook-production-api.test.js` | 真实 HTTP 恢复用例已纳入上方全文件运行；验证非创建者 404、只读用户 403、跨文档 404、作者恢复成功，及成功阶段复用和 Writer attempt 递增 |
| `npx jest --config tests/unit/agent-runner/jest.config.js --runInBand tests/unit/agent-runner/production-ai-contracts.test.js tests/unit/agent-runner/production-ai-service.test.js` | 24/24 通过；契约越权、摘要篡改、恢复和迟到结果 |
| `npm run check:node` | 通过；Node 语法检查 360 个文件 |
| `npm run build` | 通过；包含 Node/Python 语法检查、前端构建、YashanDB Storage 编译和构建清单，产物生成于 `runtime/build/knowledge-center/current` |
| `git diff --check`（相关文件） | 通过 |

### 2026-10-26 本轮复验

以下结果为本轮在当前工作区重新执行的命令，较早的历史测试记录保留用于追溯：

| 命令 | 结果 |
| --- | --- |
| `npx jest --config tests/unit/agent-runner/jest.config.js --runInBand tests/unit/agent-runner/production-ai-contracts.test.js tests/unit/agent-runner/production-ai-service.test.js` | 28/28 通过；包含周期恢复扫描与调度器停止清理 |
| `node --test tests/unit/agent-runner/handbook-production-api.test.js` | 21 项：19 通过、2 跳过、0 失败；新增真实 HTTP 周期恢复（不调用显式 recover）；跳过项为真实 YashanDB 和真实模型依赖 |
| `node --test tests/e2e/agent-runner/production-writing.test.cjs` | 4 项：3 通过、1 跳过、0 失败；跳过项要求真实模型配置 |
| `npm run check:node` | 360 个文件通过 |
| `npm run build` | 六阶段构建通过，产物生成于 `runtime/build/knowledge-center/current`；PingCode 前端有大 chunk 体积告警，不影响构建成功 |
| `git diff --check` | 通过 |

本轮另修复统一构建脚本的发布一致性：`config/knowledge-center` 已纳入构建源码指纹，模型、内容规则和阶段 Schema 变化不会继续命中旧构建缓存；构建契约测试新增该路径回归断言，且构建已因指纹变化实际执行六阶段流程并成功生成 `runtime/build/knowledge-center/current`。

API 和端到端测试使用真实 HTTP 请求。跳过项依赖未配置的真实 YashanDB 或真实模型，不能作为真实外部服务通过的证据。构建后应从 `runtime/build/knowledge-center/current` 验证页面，不能只检查源码目录。

### 2026-10-26 阶段产物独立存储复验

| 命令 | 结果 |
| --- | --- |
| `npx jest --config tests/unit/agent-runner/jest.config.js --runInBand tests/unit/agent-runner/production-ai-service.test.js tests/unit/agent-runner/production-ai-contracts.test.js` | 32/32 通过；覆盖阶段 Schema、Job 阶段引用、独立 artifact store、恢复 claim 防重复派发和孤儿清理 |
| `node --test tests/unit/agent-runner/handbook-production-api.test.js` | 21 项：19 通过、2 跳过、0 失败；包括 HTTP 生成、Skill 选择、重试、启动/周期恢复和来源核验 |
| `node --check packages/agent-runner-core/lib/production-ai-service.js` | 通过 |
| `node --check apps/knowledge-center-web/frontend/knowledge-center/modules/production/production-writing-page.js` | 通过 |
| `git diff --check` | 通过 |

HTTP 用例使用隔离模型/来源服务；跳过项依赖真实 YashanDB 和真实模型，不能作为外部生产服务验收证据。Artifact 采用先写产物、再写 Job 引用，崩溃时可能留下孤儿产物；现已提供按 Job 引用和时间阈值清理的受控入口。阶段结构约束已外置到 `config/knowledge-center/production-ai-schemas.json`，由 Schema Registry 加载后再执行业务语义校验。

## 7. 运维说明

- 生成设置入口在任务运行期间禁用，弹框支持 ESC、遮罩关闭、焦点恢复和窄屏滚动。
- 恢复历史任务时，若模型已不可用，页面要求重新选择，不自动换模。
- 租约过期的任务标记为 `interrupted`；默认生产服务启动时会执行一次扫描。设置 `KNOWLEDGE_PRODUCTION_RECOVERY_INTERVAL_MS` 为正整数毫秒可启用后台周期扫描；作者也可在页面点击“重试任务”，运维或受控调用可使用 `recover`。恢复会核验作者、文档上下文、契约版本和前置产物摘要，事务内写入带过期时间的 `recoveryClaim`，只有 claim 持有者派发并复用 Planner/Evidence、追加 Writer/Reviewer attempt；模型配置不可用时保持中断。数据库存储的 revision 冲突用于协调多实例恢复，文件存储仍要求单写入进程。
- 真实模型、GitLab 权威快照和 YashanDB 质量检查必须在目标环境另行配置并执行，隔离内存测试不会改变共享草稿。
- Planner、Evidence、Writer、Reviewer 可分别配置 `KNOWLEDGE_PRODUCTION_<STAGE>_URL`、`KNOWLEDGE_PRODUCTION_<STAGE>_TOKEN` 和 `KNOWLEDGE_PRODUCTION_<STAGE>_TIMEOUT_MS`；URL 与凭据只来自部署环境，不能由运行请求改写。真实外部 Agent 的部署、授权、网络和数据策略验收尚未完成。

### 2026-10-27 阶段 HTTP Adapter 故障复验

新增本地真实 HTTP fixture 回归阶段 Adapter 的部署配置校验、超时、非 2xx、非法 JSON 和 1 MiB 响应体积限制。复验时发现 Node 超时异常的 `code` 可能不是字符串，原错误分类直接调用 `startsWith` 会抛出 `TypeError`；已改为仅对字符串错误码做阶段错误识别，确保超时映射为 `AI_STAGE_TIMEOUT`。

| 命令 | 结果 |
| --- | --- |
| `node --test tests/unit/agent-runner/production-ai-http-stage-adapters.test.js` | 5/5 通过；覆盖本地 HTTP 失败路径与非法配置 |
| `node --test tests/unit/agent-runner/handbook-production-api.test.js` | 23 项：21 通过、2 跳过、0 失败；包含真实 HTTP Planner 接入与冻结 envelope 校验 |
| `npx jest --config tests/unit/agent-runner/jest.config.js --runInBand tests/unit/agent-runner/production-ai-service.test.js tests/unit/agent-runner/production-ai-contracts.test.js` | 32/32 通过 |

上述本地 HTTP 服务是隔离 fixture，不代表目标环境独立 Agent 已部署或验收。跳过项依赖未配置的真实 YashanDB/模型。

### 2026-10-27 当前工作区复验

本轮重新执行生产 AI 核心、真实本地 HTTP API、阶段 Adapter 和 Playwright 写作页测试。新增浏览器用例在生成设置弹框中选择仅适用于续写的 Skill，通过 HTTP 创建任务并回读冻结的 `skillSnapshots`；该用例确认 Skill 默认不选，作者显式选择后才进入任务快照。本次另完成 GitLab 基线漂移的作者交互：服务端初始核验读取映射分支当前版本；漂移后页面展示打开时 GitLab 基线与最新正文，允许按旧 commit 继续或载入最新正文，后者会重置范围并要求重新确认。

| 命令 | 结果 |
| --- | --- |
| `npx jest --config tests/unit/agent-runner/jest.config.js --runInBand tests/unit/agent-runner/production-ai-service.test.js tests/unit/agent-runner/production-ai-contracts.test.js` | 32/32 通过 |
| `node --test --test-name-pattern='AI HTTP verifies GitLab origin' tests/unit/agent-runner/handbook-production-api.test.js` | 1/1 通过；真实本地 HTTP fixture 验证初次读取分支当前版本、漂移阻断以及固定旧 commit 后按旧快照继续 |
| `node --test --test-name-pattern='GitLab 基线漂移显示对照' tests/e2e/agent-runner/production-writing.test.cjs` | 1/1 通过；Playwright 验证并排正文展示、载入最新正文及范围重确认门禁 |
| `node --test tests/unit/agent-runner/handbook-production-api.test.js` | 23 项：21 通过、2 跳过、0 失败；覆盖 HTTP 质量、阶段 Adapter、重试/恢复、GitLab 来源核验、Skill 与来源快照（本轮仅复验 GitLab 定向用例，整文件结果沿用前次执行） |
| `git diff --check` | 通过 |

HTTP 服务、模型和存储使用本地隔离 fixture；2 个 API 跳过项依赖真实 YashanDB/真实模型，1 个浏览器跳过项依赖真实模型。GitLab 本轮验证使用本地 HTTP fixture，不证明目标环境 OAuth/服务账号、权限撤销或真实分支更新行为。因此这些结果证明本地契约与端到端接线，不证明目标环境 Agent 部署、真实数据访问或模型质量。独立 Agent 部署、跨执行器盲评、事实质量人工裁判及真实模型/YashanDB/GitLab 验收仍未完成。

### 2026-10-27 持续复验

从当前工作区重新执行核心生产 API、写作页面浏览器、阶段服务、质量服务、HTTP Adapter、Node 语法检查和构建检查。真实 HTTP/浏览器测试继续使用隔离模型、来源与存储；未配置的真实模型和 YashanDB 用例明确跳过。

| 命令 | 结果 |
| --- | --- |
| `node --test tests/unit/agent-runner/handbook-production-api.test.js tests/e2e/agent-runner/production-writing.test.cjs` | 29 项：26 通过、3 跳过、0 失败；写作页面 5 通过、1 跳过；生产 API 21 通过、2 跳过 |
| `npx jest --config tests/unit/agent-runner/jest.config.js --runInBand tests/unit/agent-runner/production-ai-service.test.js tests/unit/agent-runner/production-ai-contracts.test.js tests/unit/agent-runner/production-quality-service.test.js` | 41/41 通过 |
| `node --test tests/unit/agent-runner/production-ai-http-stage-adapters.test.js` | 5/5 通过，覆盖非 2xx、超时、非法 JSON、响应体积上限和部署配置校验 |
| `npm run check:node` | 362 个文件通过 |
| `npm run build` | 构建脚本成功，命中已存在的构建缓存（sourceFingerprint `82e7a68be5cae72c7b27a4d76dc53d1e0daaf9f16700436c569b4b211a849e43`），本次没有重新执行六阶段构建 |
| `git diff --check` | 通过 |

其中一次复验误将原生 `node:test` 的 HTTP Adapter 测试交给 Jest，Jest 因该套件没有 Jest 测试而失败；随后按仓库实际 runner 分开执行，Jest 的三个目标套件 41/41 通过，HTTP Adapter 原生命令 5/5 通过。该 runner 不匹配不是产品测试失败，也不计为通过证据。

本轮没有新增产品代码。当前设计内可由隔离 HTTP/浏览器闭环验证的主要契约均有现行测试；剩余的独立 Agent 目标环境部署与准入、第二执行器、固定基准集及跨执行器盲评/人工裁判，以及真实模型、YashanDB、GitLab 环境验收仍未完成。仓库内没有可据以产出执行器质量排名的固定盲评集和裁判结果；本报告不据隔离 fixture 推断生成质量，也不将这些外部验收标记为完成。

## 8. 后续实现清单

1. 将 Planner、Evidence、Reviewer 演进为独立 Agent/Adapter，并增加事实质量门禁和跨执行器盲评；Writer Adapter 接口已预留。
2. 在配置真实模型、YashanDB 和 GitLab 的环境中补跑真实集成验收，并保存环境信息和结果。


## 9. 2026-10-27 完成度核对与离线盲评工具验证

整体完成度暂估约 **75%**，为基于设计交付项的工程判断，不是自动统计或正式验收百分比。阶段契约、持久化产物、恢复及候选采用主链路已有本地 HTTP/浏览器证据；独立 Agent 执行、事实质量门禁及执行器实测对照仍是实质缺口。

| 设计交付项 | 当前判断 | 剩余工作 |
| --- | --- | --- |
| A 阶段契约 | 本地实现与契约验证完成 | 随目标执行器验收复核 |
| B Agent Adapter | HTTP 接入与隔离验证完成，实际阶段 Agent 未交付 | 实际 Agent 实现、部署、授权和隔离验收 |
| C 轨迹、产物、恢复 | 本地闭环完成 | 目标数据库及部署环境恢复验收 |
| D 证据、候选与内容门禁 | 范围/引用协议保护已实现 | 事实与语义支持审核门禁、人工裁判 |
| E 质量版本闭环 | 服务与修订绑定实现、隔离验证通过 | 当前版本真实模型/YashanDB/GitLab 目标环境联合验收 |
| F 执行器对照 | 离线整理与汇总工具已实现 | 固定评测集、第二执行器、至少两位独立人工评分及结果 |

最新页面需求还存在一项布局差距：“想要怎么写”仍在主表单，模型、参考资料和 Skill 已进入生成设置弹框。最新三方案比较记录在 prompt.md，尚未按最新方案把写作方式移入弹框；不能将旧版布局交付当作最新全部诉求完成。

离线工具新增 CLI prepare/summarize 全链路、runtime 路径和符号链接限制、0700 新目录/0600 文件、拒绝已有输出覆盖及创建失败清理；补充基准上下文、Unicode 范围、布尔恢复标记和评分/解盲结构校验。judgeCount 修正为不同评测者 ID 数量。失败码保留在受限解盲文件，不进入盲审表。工具不调用模型；只验证不同 judgeId，实际人员独立性、文本身份线索与文件分发权限需组织者核验。

`node --test tests/unit/agent-runner/production-ai-blind-eval.test.cjs`：**9/9 通过**。首次扩展测试发现原匿名断言与新增“失败码保留在受限解盲文件”不一致，调整断言并复验全部通过。本次仅修改离线工具、测试及文档，未变更生产 API；沿用前节已记录的生产 HTTP/浏览器测试，不重复宣称真实外部验收。离线工具不在生产构建源码指纹中，本次无需重复生产构建。

补充检查：`npm run check:node` 检查 363 个文件通过；`git diff --check` 通过。

## 10. 2026-10-27 写作执行反馈与模板选择验证

按写作执行反馈补充设计实施：主文档区在生成期间展示阶段状态、实际工具/模型调用摘要、可展开输入与结果及增量正文预览；右侧写作助手由标题栏图标展开/隐藏，隐藏后主区仍可查看执行和取消；生成设置使用一个可搜索下拉框选择模板。模板目录走已有 API，停用项不参与新生成；断网查询恢复同一任务，不重新发起生成。

默认 Writer 使用 Chat Completions 或 Responses 流式事件，增量正文经过 JSON envelope 解码后展示；取消、重试及租约过期后的迟到响应按任务状态和阶段 ID 拒收。Planner 默认是本地写作规划，Evidence 默认读取已确认快照，未配置 Reviewer 则标注未执行。远端 HTTP Adapter 只能显示平台实际发送的调用摘要与返回产物，不能证明其内部工具步骤。周期恢复的租约下限与恢复 claim 最小窗口统一为 1 秒，避免极短租约在阶段持久化期间再次过期。

| 验证入口 | 结果 |
| --- | --- |
| 核心 Jest 四套件（服务、契约、来源、模型客户端） | 46/46 通过；覆盖审核失败仅重试审核及保留 Writer 模型元信息 |
| `node --test tests/e2e/agent-runner/production-writing-feedback.test.cjs tests/unit/agent-runner/production-ai-http-stage-adapters.test.js tests/unit/agent-runner/handbook-production-api.test.js` | 31 项：29 通过、2 项真实外部环境测试跳过；真实隔离 HTTP 覆盖两类 SSE、运行中预览、阶段调用、取消迟到输出与周期恢复 |
| `node --test tests/e2e/agent-runner/production-writing.test.cjs` | 7 项：6 通过、1 项真实配置模型测试跳过；新增模板同框搜索、侧栏切换、执行详情、同任务断线恢复和 390px 布局 |
| `npm run check:node` | 364 文件通过 |
| `npm run build` | 六阶段完成，产物为 `runtime/build/knowledge-center/current` |

浏览器证据位于 `runtime/test-results/production-writing/feedback-assistant-hidden.png` 和 `feedback-mobile.png`。以上使用隔离作者、内存仓储及本地 HTTP Provider；真实企业模型、远端阶段 Agent 的内部工具轨迹和部署环境仍需独立验收。

生成设置精简复验（2026-10-27）：移除模型/模板手动刷新按钮及事件，页面初始化自动加载目录。`node --test tests/e2e/agent-runner/production-writing.test.cjs`：6 通过、1 真实模型测试跳过；`npm run build` 六阶段成功，Node 语法检查 364 文件通过，`git diff --check` 通过。


## 11. 2026-10-27 运行现场纠偏与执行区可见性

用户实际反馈未看到生成过程。现场查明 Web 网关启动于 10:31，早于流式代码修改，Node 模块缓存未更新；11:45 创建的旧任务缺少 toolName 和 executionPreview。另一个缺陷是提交后未把上方执行区带入视口。此前仅凭构建与隔离测试宣告交付，未覆盖运行进程与浏览器视口，验收不充分。

修正提交、重试和恢复后的执行区定位，保留轮询期间自主滚动；增加当前阶段、已用时间与已确认资料数，首段正文返回前展示明确等待说明。阶段详情沿用稳定节点，轮询保留展开状态，关闭清理计时器。

- 浏览器完整回归：6 通过，真实模型项默认跳过；390px 长页面断言提交前执行区在视口上方，提交后当前阶段在视口内，且生成未完成时可见预览和递增耗时。证据：`runtime/test-results/production-writing/feedback-mobile-running-viewport.png`。
- 当前真实配置模型的短句润色测试：1/1 通过；真实 HTTP 任务完成前四次返回 Writer running 和“生成模型调用”，最终采用后回读隔离内存草稿成功。观察记录：`live-model-progress.json`。短句预览首次被轮询捕获时已完成，因此不能单凭此项证明真实模型正文中途可见。
- Chat Completions / Responses 两类本地真实 SSE HTTP 回归：3/3 通过，覆盖完成前正文与阶段、取消迟到输出。
- 六阶段构建完成，Node 语法 364 文件通过；实际 HTTP 返回新前端模块，含阶段摘要与执行区定位。
- 确认无 queued/running 任务后，仅重载本机 Web 网关，PID 从 581007 变为 630169，原环境只在内存传递。入口 HTTP 200，4/4 组件健康；其他三个服务 PID 保持不变，未重试或采用用户历史任务。

历史任务无法补出当时未记录的中间过程；新任务使用新代码。远端阶段内部调用仍以接口实际提供的信息为边界，不能展示未提供的内部轨迹。


真实模型长文补充验收：`WRITING_LIVE_MODEL=1 node --test --test-name-pattern='真实配置模型长文' tests/e2e/agent-runner/production-writing.test.cjs` **1/1 通过**。使用当前配置模型，经过真实 HTTP API 与浏览器，在状态仍为“正在生成”、Writer 仍执行中且候选未出现时捕获 38 字正文预览，展开输入摘要成功；首段正文约在 92 秒出现，期间持续显示当前阶段和耗时。随后取消隔离任务，回读确认没有草稿。证据：`runtime/test-results/production-writing/live-model-running-preview.png`、`live-model-streaming-result.json`。本次已覆盖真实模型正文流可见性；测试使用隔离作者与内存仓储，未写用户真实文档，也未验证远端未公开的内部工具轨迹。最终 `git diff --check` 通过。


## 12. 2026-10-27 写作助手信息密度整改

用户截图与代码评审确认：独立写作方式下拉、5行要求框及多层间距占用侧栏；设置摘要截断且包含零项；取消与恢复在无适用状态时常驻。按已更新写作页设计，方式移入生成设置，主侧栏保留3行可拖高要求框、范围、可换行有效摘要和生成主按钮；取消仅运行中出现，恢复仅有会话历史且未显示任务时出现。

真实隔离 HTTP/浏览器全套：8项中6通过，2项真实模型测试按默认条件跳过。覆盖设置内写作方式可见、模板搜索、Skill冻结、取消、关闭重开恢复、长摘要窄屏无溢出、原有执行过程和同任务重连。此次仅调整前端展示，无须重复真实外部模型生成；不能将此次测试写成外部模型复验。

1366×900浏览器实测初始侧栏宽380px、高348.39px，满足≤420px验收目标；无任务时取消、无记录时恢复均隐藏。390px长摘要不横向溢出。截图：`runtime/test-results/production-writing/desktop-writing.png`；尺寸记录：`assistant-density.json`。此前用户截图缩放口径不同，不据此给出前后百分比。设计、前端README与prompt同步。

交付核验：六阶段构建成功、Node语法364文件通过、git diff --check通过；本机运行网关实际HTTP返回新版JS/CSS均200（验证3行输入框、取消状态与新配置摘要标记），4/4组件健康。本轮仅静态前端，构建目录直接提供新版资源，无需重载后端；浏览器整页刷新加载。
