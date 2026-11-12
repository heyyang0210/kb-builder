# 文档生产全阶段 YashanDB 存储详细设计

日期：2026-10-28

状态：设计提案，尚未实施；配置数值为建议初值，需经目标环境验证后发布。

## 2026-11-12 待执行结构迁移恢复入口

`knowledge-center.sh repair-migrations` 是显式运维动作：先核对目标类别、统一构建摘要、数据库连接和组件已停止，再复用 Storage `start.sh migrate` 的已提交 SQL 来源校验；迁移成功后严格执行 `verify`，最后用现有构建启动平台。个人库须显式声明 `YASDB_STORAGE_TARGET_CLASS=personal`；共享库由项目负责人提供目标库结构快照的可读非空文件并在终端确认，确认记录连同快照摘要写入 runtime，非交互执行须提供有效审批引用与快照路径。普通启动仅校验，不自动写入 Schema；`restart` 在停止现有服务前预检迁移，待迁移时只输出原因和一条修复命令，完整堆栈保留在 Storage 日志。

## 1. 目标与决策

知识中心评审前的草稿、不可变版本、AI 输入输出、来源快照、图片、附件、处理与导出产物均持久化到 YashanDB。评审通过的明确版本提交 GitLab，GitLab 合并后的提交作为正式发布内容。数据库继续维护生产过程、权限、发布映射和必要审计。

正文采用 CLOB，二进制采用 BLOB，不在 Markdown 中内嵌 Base64。初期不引入对象存储、共享文件系统或独立消息中间件。后端和 Worker 共用数据库；任务队列、租约与待发送事件也持久化到数据库。处理程序可使用本机临时目录，但数据库是唯一持久事实源，删除临时目录或替换任意应用节点不应导致已确认保存的数据丢失。

“数据库可持久保存”不代表数据会自然保持较小；容量通过独立记录、去重、配额、保留策略和监控共同控制。不得将所有业务对象继续封装为一个全局 JSON/CLOB。

本轮只交付设计和验收口径，不执行 DDL、数据迁移、共享服务重启或 GitLab 写入。

## 2. 当前实现与承接边界

- `handbook-production-service.js` 将草稿、完整历史、附件元数据、评审批次、幂等和审计集合放在 `handbook-production/state`；附件正文仍写本地文件。
- `production-ai-artifact-store.js` 将产物集合保存到 `production-ai-artifacts/state`。
- `aggregate-store.js` 的通用写事务仍采用整体读取、复制、条件写回，不同文档可能争用一个 revision；部分路径使用同步子进程调用。
- 当前工作区已有目录与单篇草稿读取投影、异步读取和缓存优化。本设计保留其公共行为，进一步将存储拆成独立领域记录；投影和缓存不替代持久化数据模型。
- 旧 Agent 直写、来源图片托管和文件导出路径也必须纳入迁移盘点；新写入全部接入统一产物服务后，才能声明“中间产物全部入库”。

## 3. 数据归属与事实源

| 对象 | 持久存储 | 读取方式 | 生命周期 |
|---|---|---|---|
| 手册、大纲、身份与授权 | 现有 YashanDB 领域表 | 按业务主键查询 | 沿用现有契约 |
| 草稿当前指针、编辑版本、状态 | 文档主记录 | 按授权上下文唯一键 | 文档生命周期 |
| Markdown、必要 HTML 快照 | 独立版本记录关联的 CLOB 内容 | 默认仅当前版本；历史按版本加载 | 活跃、评审、发布留存 |
| 模板、规则、来源正文、提示词、模型响应 | 不可变产物元数据 + CLOB | 按任务、步骤和产物 ID | 依据保留策略，受引用保护 |
| 图片、上传附件、PDF/DOCX、导出包 | 二进制元数据 + BLOB | 鉴权后流式读取 | 依据引用和状态清理 |
| 生成、转换、导出、发布任务 | 数据库任务与步骤表 | 分页查询、租约领取 | 终态归档 |
| 评审、质量结论 | 冻结版本及其摘要的记录 | 按评审 ID | 审计策略 |
| GitLab 提交与合并映射 | 发布批次及文件清单 | 按发布 ID | 长期保留小型证据 |
| 临时解包、转换目录 | Worker 本机临时磁盘 | 仅当前任务使用 | 任务结束清理，可从数据库重建 |
| 正式文档及所需静态资源 | GitLab 仓库 | 固定 commit SHA 读取 | GitLab 仓库治理 |

数据库“已发布”记录不能因为分支存在一次 commit 就成立，必须满足第 8 节定义的目标分支确认条件。

## 4. 容量模型与初期预算

### 4.1 估算公式

全部按实际 UTF-8 或二进制字节计量，不按字符数估算，不预先假定数据库压缩收益。

```text
正文逻辑量 = 文档数 × 每文档保留版本数 × 每版本平均正文大小
AI 逻辑量 = 留存任务数 × 每任务去重后输入/来源/输出平均大小
资源逻辑量 = 去重后的图片、附件、处理结果和导出包字节总量
逻辑总量 = 正文 + AI + 资源 + 元数据及审计
实际占用 = 实测数据段 + LOB 段 + 索引 + 空间余量
运维容量 = 实际占用 + 在线日志/归档日志 + 备份及副本容量
```

### 4.2 示例情景，非现网测量

| 数据 | 假设 | 约计逻辑量 |
|---|---|---|
| Markdown 版本 | 10,000 篇 × 20 版 × 100 KiB | 19.1 GiB |
| AI 输入输出与来源 | 10,000 个留存任务 × 2 MiB | 19.5 GiB |
| 去重后图片 | 10,000 张 × 500 KiB | 4.8 GiB |
| 其他附件、导出、元数据 | 需另行实测 | 不包含于上述合计 |

前三项约 43.4 GiB，不能据此直接确定生产磁盘大小；若 HTML 与 Markdown 同时全量保存，或频繁快照检索结果，还会增加容量。每天 1,000 个任务、每任务 2 MiB、留存 90 天，单 AI 数据就约 175.8 GiB。图片数量相同并不代表体积相同：10,000 张 5 MiB 原图约 48.8 GiB。

结论：Markdown 主体的数据量通常可管理，真正决定规模的是保留版本数、每日任务量、来源快照重复率和二进制资源。评审后发布 GitLab 可以缩短数据库留存窗口，但不会自动消除历史数据。

### 4.3 配置化限额

建议初值集中放入现有内容规则配置，采用版本化策略；以下是设计参数，不是已启用配置。

| 参数 | 建议初值 | 行为 |
|---|---|---|
| 单 Markdown 正文字节 | 2 MiB | 超限返回 413；不得静默截断 |
| 单图片 | 10 MiB | 上传、来源抓取均校验字节和真实格式 |
| 单普通附件 | 50 MiB | 大附件要求明确用途 |
| 单草稿绑定附件总量 | 200 MiB | 承接现有额度，超限拒绝 |
| 单任务持久产物总量 | 100 MiB | 中止继续扩张并保留诊断，不伪造完成 |
| 自动保存 | 10 秒防抖、最大等待 60 秒 | 内容摘要相同不新增版本；页面展示未保存状态 |
| 容量告警 | 预算 70% / 85% / 95% | 预警、限制批处理、暂停新增重任务；正常保存预留独立空间 |

还需配置租户/团队、用户、每日生成量和并发额度；创建任务时原子预留预算，完成、取消或过期后核销，避免多个请求同时绕过限额。所有入口使用同一计量规则。

## 5. 逻辑数据模型

以下 `KC_DP_*` 为建议表名，未分配迁移编号。内部主键和已确认的本模块关联键遵循现有 Storage 规范使用 `BIGINT`；GitLab 仓库键、分支、commit、幂等键和摘要等外部标识使用字符串。`MANUAL_ID` 和 `OUTLINE_NODE_ID` 复用现有知识中心主键；`REPOSITORY_KEY` 不能因为 GitLab 当前返回数字就直接当成本库主键；`SCOPE_ID` 需先确认是否已有本地权威目录。序列边界尚未批准，必须在评审记录中选择新增文档生产边界或归并现有稳定业务边界（009的手册/大纲/责任/人员及010的平台配置），不按每张表扩张。跨表关联默认由 Repository 事务和巡检保证，不采用物理外键；唯一约束、检查约束、索引、LOB 选项在实现阶段形成新增版本化 SQL，并在个人库验证。公共字段包含内部 `*_ID`、已定型的范围键、`CREATED_AT`、必要的 `CREATED_BY`。所有权范围由服务端授权解析，不能相信客户端提交的 scope。

| 逻辑表 | 关键字段 | 约束及索引 |
|---|---|---|
| `DOCUMENT` | `manual_id`、`outline_version_id`、`outline_node_id`、`repository_provider`、`repository_key`、`branch`、`language`、`current_version_id`、`edit_version`、`state`、`updated_at` | 只把已确认的本地主键作为 BIGINT；仓库使用提供方加外部键；上下文组合唯一；目录查询索引不包含正文 |
| `TEXT_CONTENT` | digest、byte_size、content_type、body CLOB | 同范围、格式及处理版本下摘要唯一；正文不可变；不对 LOB 建普通索引 |
| `VERSION` | document_id、version_no、parent_id、text_id、html_text_id、baseline_commit、manifest_digest、origin_task_id | 文档与版本号唯一；版本不可变；索引 `(document_id, version_no)` |
| `BINARY_CONTENT` | digest、byte_size、detected_mime、body BLOB、validation_state | 范围内摘要唯一；字节流存储；无公开摘要下载接口 |
| `ASSET` | document_id、binary_id、original_name、kind、status、expires_at | 不变资源 ID；文件名为展示字段；生命周期与物理字节分离 |
| `VERSION_ASSET` | version_id、asset_id、relative_path、role | 组合唯一；不可变版本绑定；反向 asset_id 索引用于清理 |
| `TASK` | document_id、kind、state、input_version_id、rule_version、attempt、lease_owner、lease_until、fence_token、available_at | `(state, available_at)` 及租约到期索引；排队记录不含正文 |
| `TASK_STEP` | task_id、step_key、attempt、state、started_at、finished_at | 步骤与尝试唯一；持久化检查点 |
| `ARTIFACT` | task_id、step_id、kind、schema_version、text_id 或 binary_id、digest、expires_at | 载荷二选一；任务与步骤查询索引；不可变产物 |
| `ARTIFACT_REF` | owner_type、owner_id、artifact_id | 显式追踪版本、任务、评审、发布对产物的引用；引用方及反向索引 |
| `REVIEW` / `REVIEW_ITEM` | status、reviewer、document_id、version_id、manifest_digest、decision、policy_version | 评审结果绑定固定版本与资源清单；不随草稿指针变动 |
| `PUBLICATION` / `PUBLICATION_ITEM` | review_id、repository_provider、repository_key、target_branch、expected_head、status、commit_sha、MR_id、merged_sha；version_id、path、blob_digest | 发布幂等键唯一；文件清单不可变；记录提交及合并证据 |
| `OUTBOX` | event_type、entity_id、payload_text_id、state、available_at、lease_until | 与业务状态同事务创建；只提供至少一次投递 |
| `IDEMPOTENCY` | principal_scope、operation、request_key、request_digest、result_ref、expires_at | 作用域、操作及键唯一；同键不同请求返回 409 |
| `AUDIT` | actor、action、entity_type、entity_id、version_id、trace_id、result | 追加写；按实体与时间查询；不复制正文或密钥 |
| `QUOTA_USAGE` | scope_id、period、resource_kind、reserved_bytes、used_bytes | 组合唯一；预算更新具备数据库并发保护 |

### 5.1 正文与版本规则

- `edit_version` 控制草稿并发；`version_no` 标识历史版本；GitLab commit SHA 标识外部版本，三者不能混用。
- 版本正文可复用同摘要 `TEXT_CONTENT`；不同业务版本仍保留独立元数据。摘要基于实际规范化后 UTF-8 字节，规则必须固定并版本化，不任意修改代码块与换行语义。
- HTML 仅在确有原始编辑或渲染还原需求时保存；普通 Markdown 可重建的 HTML 不反复持久化。
- 不在每次按键时保存历史。相同正文、资源集合与语义元数据不变时返回当前版本；重要编辑、手工保存、提交评审和 AI 采纳形成版本。
- 图片通过稳定受权 API 引用；Markdown 保留资源引用，数据库版本保存精确资源清单。外链来源图片必须抓取形成快照后，才能承诺跨机器和离线可恢复。

### 5.2 载荷与读取隔离

列表只返回 ID、状态、大小、时间和摘要；当前正文一次按主键读取一个版本；版本历史先分页返回元信息，选择版本后读取 CLOB。任务列表不返回完整模型输入、输出或全部来源。

二进制用 JDBC 流式写 BLOB、流式读 BLOB，Node 到 Storage 使用流式 HTTP，避免完整 Buffer 和 Base64。大 CLOB 也采用有界流或有界单篇读取；连接池设置 LOB 下载专用额度和超时，慢客户端下载不能占满业务查询连接。临时磁盘超限时停止转换，数据库中的输入保持可恢复。

## 6. 事务与并发

### 6.1 保存草稿

```text
验证用户对文档上下文的编辑权限、输入格式、大小及附件归属
BEGIN
  按作用域 + 操作 + 幂等键创建幂等记录；重复键校验请求摘要
  读取或按唯一上下文创建 DOCUMENT
  插入或复用 TEXT_CONTENT；插入不可变 VERSION 与 VERSION_ASSET
  条件更新 DOCUMENT：WHERE id = ? AND edit_version = expected
  更新失败则整笔回滚并返回 409（重新读取当前指针）
  更新配额；写 AUDIT；幂等记录引用结果版本
COMMIT
返回 version_id、edit_version、content_digest、saved_at
```

唯一上下文首次创建冲突时重读；摘要去重的并发唯一冲突按目标数据库事务行为正确重试，不在已失败事务上盲目继续。断开响应后客户端用同一幂等键重试，不能重复产生版本。

不同文档的保存事务不共享一个业务记录锁。同文档冲突明确返回版本与差异入口，不后台自动覆盖。无需长时间持有数据库锁等待模型、文件转换或 GitLab。

### 6.2 数据库任务队列

用数据库可验证支持的短事务领取候选任务；若无可用的跳过锁语法，使用条件更新及影响行数判断领取结果。每次领取递增 fencing token，更新租约；心跳续约必须匹配 owner 与 token。Worker 完成、写产物或更新状态时同时校验 token、租约和取消状态，拒绝旧 Worker 的迟到写入。

输入先入库并冻结版本、来源和规则，成功后才确认任务已受理。逐步骤提交不可变结果，重启后复用成功步骤；失败尝试单独记录。相同步骤重试用幂等键，任务执行采用至少一次语义，不能宣称恰好一次模型调用。模型请求响应丢失可能产生额外计费，记录“不确定”并采用有界重试或人工处理。

### 6.3 上传与处理

先创建上传会话并原子预留额度；流式写入临时/待确认 BLOB，校验真实 MIME、摘要、完整字节数与配置额度。需要解码/扫描的对象保持 `validating`，完成后在事务中标记 `ready`。客户端断开、扫描失败或租约过期的对象不可绑定草稿，并进入延迟清理。

分片上传为后续可选能力，首版在受控的 50 MiB 附件上限下支持整文件流式重传即可。导出、转换与缩略图作为新产物保存数据库；任务输出提交成功后再确认完成，不把本机路径作为任务结果。

## 7. 接口与服务分层

保持浏览器现有业务 API 可兼容，Node 内部领域仓储改为按实体调用 Java Storage；新增路径需与现有路由核对后确定。以下为逻辑接口，不代表已部署端点。

| 接口 | 请求/响应关键字段 | 一致性行为 |
|---|---|---|
| 查询当前草稿 | document context → 当前版本正文、edit_version、ETag | 授权后按单文档读取；304 不替代权限检查 |
| 保存草稿 | expectedEditVersion、markdown、assetIds、Idempotency-Key | 同文档 CAS；409 带当前版本信息 |
| 查询历史 | documentId、游标、limit → 版本摘要分页 | 不携带全部历史正文 |
| 读取历史正文 | documentId、versionId | 校验两者关联与访问权限 |
| 上传资源 | context、Content-Type、字节流、幂等键 | 配额、完整性校验后返回 assetId |
| 下载资源 | assetId，可选字节范围 | 权限、ETag、长度及有界流；不暴露数据库连接 |
| 创建/查询/取消任务 | inputVersionId、kind、规则版本 / taskId | 202 表示输入已持久化；取消阻止后续结果生效 |
| 提交评审 | versionId、manifestDigest、评审规则版本 | 冻结版本及资源，后续编辑不改变评审对象 |
| 创建发布 | approvedReviewId、目标仓库分支、幂等键 | 202 返回 publicationId，异步提交并可查询 |

Java 侧负责数据库事务、LOB 流和约束；Node 侧负责身份校验、业务编排和 GitLab 连接；Worker 负责模型、转换和导出。内部服务使用明确认证，不将“内网可达”当作授权。

## 8. 评审与 GitLab 发布一致性

状态：`draft → in_review → approved → publish_pending → committed → merged/published`。失败进入可诊断、可重试的发布状态；评审拒绝与任务失败分开。

1. 提交评审时固定版本、资源清单、质量结论及其摘要。评审通过后，在同一数据库事务创建发布批次、冻结文件清单和 outbox 事件。
2. 发布 Worker 领取事件，重新确认批准状态与目标仓库授权；读取固定版本而非“最新草稿”。草稿之后的新编辑留待下轮评审。
3. Markdown 中内部资源引用转换成 GitLab 相对路径，例如 `assets/<digest>.<ext>`；所需图片与附件必须同步提交，不能让正式文档依赖平台临时 API。资源路径、大小和摘要纳入发布清单。
4. 一次 GitLab commit 尽量提交 Markdown 和全部依赖资源。目标分支已有并发变化时按固定基线校验，冲突返回待处理，禁止 force push 或覆盖其他人的变更。多文件提交、批量大小限制和乐观并发能力需以目标 GitLab 版本验证；必要时用受控 Git 工作树提交单一 commit，并执行非强制 push。
5. 大附件超过 GitLab 请求或仓库限制时阻止发布并提示处理方案；若使用 Git LFS，必须验证 LFS 对象也上传成功，并纳入独立备份。不能只提交 LFS 指针就清理数据库原件。
6. GitLab 请求超时先标记 `reconciling`。用发布标识、目标分支、commit 父链及实际文件摘要核对远端结果；发现已成功则补登记，不盲目再次提交。不可仅凭提交消息相同判定成功。
7. 数据库登记 commit SHA、MR 与文件清单。提交评审分支只标记 `committed`；MR 确认合并后验证目标分支中的实际正文及资源摘要，再标记 `published`。squash/rebase 时记录最终 merged SHA。允许直接提交的仓库，成功写入并验证正式目标分支后完成发布。
8. 远端提交和数据库不能组成单一事务。采用 outbox、幂等处理与定期对账实现最终一致；远端成功、本地登记失败时通过对账修复。

发布成功并不自动授权删除评审记录。正式 GitLab 文档可在页面独立访问，平台生产历史则遵循数据库保留策略。

## 9. 去重、留存与清理

正文按内容摘要复用，图片按真实字节去重；不能把“来源相同”当成内容永远相同。摘要去重限定授权范围，不能利用命中与否泄露其他团队持有的资料。

以下为建议策略，需在配置中可审计地发布，不是本次直接删除历史的授权：

| 数据 | 建议留存 | 必须保护的引用 |
|---|---|---|
| 上传未完成、未绑定资源 | 24 小时后候选清理 | 活跃上传租约 |
| 临时转换与导出产物 | 完成后 7 天 | 下载租约、尚未完成发布 |
| 失败/取消任务详细输入输出 | 30 天 | 排障保留标记、评审引用 |
| 活跃草稿版本 | 最近 20 版且至少覆盖最近 30 天 | 当前、评审、发布、恢复保留版本；保护优先于数量上限 |
| 已发布的完整生产过程 | 发布确认后 90 天 | 纠纷、审计或人工 hold |
| 发布清单、摘要与评审结论 | 建议至少 1 年，可长期保存元数据 | 合规策略要求 |

清理采用“标记候选 → 宽限期 → 事务重查引用 → 有界批量删除”。引用包括当前指针、历史版本、评审、AI 来源依据、发布清单、活跃任务与人工 hold；不能只看一个 ref_count。引用创建与清理在内容记录上使用一致的锁/状态协议，禁止新引用连接到正在删除的内容。引用计数可加速筛选但必须可重建。

若承诺某版本可恢复，其正文与资源必须同时保留。完整历史到期后 UI 应明确显示只剩发布证据，并提供固定 GitLab commit 链接；不能展示仍可恢复的按钮。GitLab 不可用或发布验证失败时，相关版本不得按“已发布”规则清理。

## 10. 安全、备份与运维

- 所有正文和资源按文档归属、分支、角色授权；仅知道 ID 或 SHA-256 不能下载。模型原始上下文、提示词和来源快照可能包含敏感信息，需要与正文同等级保护。
- 密钥与 OAuth Token 不进入 AI 产物、审计、Markdown 或普通配置快照；使用现有独立凭据管理，数据库备份与密钥恢复材料分开保管。
- 上传校验真实格式、压缩包展开大小与路径、图片像素数，防止压缩炸弹；HTML/SVG 等主动内容按现有安全规则拒绝或净化。数据库保存并不表示内容可信。
- 数据库使用受控连接池、最小权限、传输保护与适用的静态加密；支持版本与部署能力需实际确认，不能将默认开启作为假设。
- 备份必须包含 LOB、任务、发布清单与关联表；GitLab 仓库和 LFS 分别备份。建议初期目标 RPO ≤15 分钟、RTO ≤4 小时，前提是实际归档日志策略和恢复演练能满足；这些数值不是当前已提供的保证。
- 监控逻辑/物理占用、LOB 增长、平均版本数、重复率、超额拒绝、保存冲突、P95/P99、连接等待、任务积压、租约失效、发布对账及备份恢复结果。
- 日志仅保留 traceId、实体 ID、摘要与耗时；完整生成过程作为受权数据库产物，不能另存一份到无限增长的文件日志。

## 11. 迁移与回退

1. 盘点现有聚合记录、正文文件、来源图片、附件及旧 Agent 路径；生成只读清单，记录来源、大小、SHA-256、上下文与权限。失联/缺失文件登记异常，不伪造迁移成功。
2. 先制定新增版本化 SQL，在个人开发库验证 CLOB/BLOB 流、约束、事务、备份和回退。共享库仍由负责人明确批准执行，不借设计交付自动迁移。
3. 幂等分批导入新表，保留原 ID 或显式映射。版本链、正文摘要、附件字节、任务引用、评审对象和发布映射逐项核对；来源快照无法恢复时明确标记缺失。
4. 推荐在短维护窗口暂停旧写入，完成增量导入并核对后切换新仓储；如必须无停机，另行设计增量事件和检查点，不采用无事务的盲目双写。
5. 旧 API 保持兼容，新表按文档查询；旧聚合仅作为有期限的迁移读取来源。切换后写入失败不得静默降级到本地文件。
6. 切换前保留数据库和文件一致性备份。切换后若已有新写入，回退须停写并导出/回放新增版本、任务与资源；直接切回旧聚合会丢数据，因此禁止。
7. 多实例恢复与验收通过后才安排旧数据退役；物理删除须单独审批并按引用和保留策略执行。

## 12. 验收与分阶段实施

### 12.1 实施顺序

- 阶段一：独立文档/版本/CLOB 数据模型与领域事务，替换整体聚合写，保留现有按需读取契约。
- 阶段二：图片、附件、来源快照、旧 Agent 输出与导出全部入库，完成流式读写、配额与引用关系。
- 阶段三：数据库任务队列、Worker 租约、检查点与发布 outbox，形成可对账的 GitLab 闭环。
- 阶段四：历史迁移、生命周期清理、监控、故障恢复与容量压测。阶段验收前不声称全链路已去本地持久化依赖。

### 12.2 功能与故障验收

- 两个实例读写同一数据库：不同文档并发不争用全局记录；同文档并发仅一个版本胜出，另一个 409 且不丢编辑内容。
- 保存返回前杀进程、返回后断连接、重复请求：事务保持原子、同幂等键不新增版本；恢复后显示已确认提交的版本。
- 切换全部应用到新机器且本地临时目录为空，草稿、来源图片、附件、生成结果与评审均可访问。
- Worker 被终止后租约到期可接管；旧 Worker 迟到写、取消后写入和重复投递不改变终态。
- 上传中断、数据库满、LOB 超限、扫描失败、恶意压缩包：无 ready 的半文件，无静默本地保存，配额可核销。
- GitLab 超时但实际已提交、本地登记失败、MR 未合并、分支冲突：不重复覆盖、不提前标发布、不提前清理。
- 清理与新版本绑定并发、受保护历史版本、跨团队资源访问、数据库恢复：引用完整、权限隔离与恢复可验证。

### 12.3 性能与容量验收

建议基线：10,000 篇文档、每篇 20 版、平均正文 100 KiB、10,000 张 500 KiB 图片；另构造十倍历史、接近最大单篇和来源较多任务。初期以 50 个并发活跃会话、10 个并发保存、3 个并发生成/处理任务测试，再依据实测修订目标。

内网建议门槛：目录元信息 P95 ≤100ms，当前正文 100 KiB 的 API P95 ≤100ms，保存 100 KiB 正文 P95 ≤300ms；图片上传与模型生成独立统计，不并入毫秒级正文目标。分别测试冷启动、稳定热读、数据库恢复、多实例与连接池饱和；记录 P99、错误率和资源使用，不通过只挑一次成功结果宣称达标。

改动范围的事务、授权、配额、租约、发布补偿与清理代码，行和分支覆盖率目标均 ≥90%，按 Node/Java 各自实际执行报告；集成必须使用真实个人 YashanDB，GitLab 使用授权测试项目。覆盖率不能替代数据库并发、LOB、恢复和 GitLab 一致性实测。

### 12.4 上线前待确认

- 现网实际文档数、版本数、每日任务数、来源快照及图片平均字节；先采集脱敏统计再确定空间。
- 目标 YashanDB 版本的 LOB 流、连接池、队列领取 SQL、备份恢复与清理空间回收特性。
- GitLab 提交请求、单文件、仓库大小、MR/LFS 策略及引用资源的最终路径。
- 内容与模型上下文留存要求、审计年限、团队配额及故障恢复目标。

上述确认影响实施参数与容量，不改变“评审前 YashanDB 持久化、评审后 GitLab 正式提交”的核心边界。

## 13. 实现前必须评审确认的补充契约

本节是进入编码和新增 DDL 前的门槛。未确认的项只能继续做只读盘点和测试准备，不能以默认值直接实现。

### 13.1 必须冻结的产品与数据决策

评审记录必须明确以下选择及负责人：

| 决策项 | 本设计建议 | 必须确认 |
|---|---|---|
| 文档唯一键 | `scope + repository_provider + repository_key + branch + language + manual_id + outline_version_id + outline_node_id` | 是否允许同一节点多产品、多分支和多语言并存；各组成字段必须先完成权威来源和类型确认 |
| 版本生成规则 | 手工保存、AI 采纳、提交评审生成不可变版本；自动保存只更新草稿快照 | 自动保存是否进入历史版本，是否允许恢复任意版本 |
| 正文格式 | Markdown 为主，HTML 仅保留编辑还原需要 | 是否永久保留 HTML 快照及渲染版本 |
| 来源快照 | 任务输入正文和资源必须冻结并可审计 | 是否允许仅保留摘要而删除原始来源 |
| AI 原始上下文 | 数据库保存，按安全等级和保留期清理 | 是否允许保存完整提示词、模型响应和敏感片段 |
| 图片/附件 | YashanDB BLOB，正式发布复制到 GitLab | GitLab 单文件、仓库和 LFS 限制；超限处理方式 |
| 评审对象 | 评审绑定固定 `version_id + manifest_digest` | 评审中能否替换资源或只能新建版本 |
| 发布目标 | 先提交目标分支，再以合并后的 SHA 标记 published | 是否允许直接提交默认分支，MR 是否强制 |
| 删除规则 | 引用保护优先于时间和数量 | 审计、争议和合规 hold 的最长保留期限 |
| 租户隔离 | 摘要去重限定授权范围 | 是否允许跨团队内容字节级去重 |

### 13.2 数据字典与 DDL 交付物

实现前必须新增与目标 YashanDB 版本对应的数据字典，逐字段写明逻辑名、物理名、类型、字符集、可空性、默认值、主键、外键、唯一约束、检查约束、索引、LOB 参数、脱敏等级和删除策略。当前评审附件为[文档生产 YashanDB 数据字典（评审稿）](./知识中心-文档生产-YashanDB数据字典评审稿-详细设计文档.md)。本文第 5 节的逻辑模型和该评审稿都不能直接替代已批准 DDL。

DDL 附件还必须给出：

1. 序列和 ID 生成规则，禁止运行时随机 ID 与数据库顺序 ID 混用。
2. 迁移编号、正向 SQL、回退 SQL、结构快照和摘要；已执行迁移不得改写。
3. CLOB/BLOB 最大长度、分块大小、事务超时和 JDBC/HTTP 流接口样例。
4. 每个索引对应的查询、预计选择性和维护代价；正文和二进制字段不建普通索引。
5. `ON DELETE` 策略。默认不级联删除正文、资源和审计，由引用保护清理器分批执行。
6. 应用、Worker、发布、迁移账号的最小权限清单，并明确凭据来源。

在 DDL 评审前，不得把示例表名 `KC_DP_*` 当成批准的物理契约，也不得直接创建表。

### 13.3 状态机和错误契约

实现前需评审文档、版本、资源、任务和发布状态机。每个状态转移要列出触发方、前置条件、幂等键、可重试性、补偿动作和审计事件：

- 文档：`active / archived / deleted`。
- 版本：`draft / in_review / approved / superseded / retained / purge_candidate / purged`。
- 资源：`uploading / validating / ready / failed / bound / purge_candidate / purged`。
- 任务：`queued / running / retry_wait / succeeded / failed / cancelled / reconciling`。
- 发布：`pending / committing / committed / reconciling / merged / published / conflict / failed`。

至少冻结以下错误码：

| 错误码 | HTTP | 语义 | 客户端行为 |
|---|---:|---|---|
| `DRAFT_VERSION_CONFLICT` | 409 | 当前版本已变化 | 拉取当前版本并显示差异，不自动覆盖 |
| `IDEMPOTENCY_KEY_CONFLICT` | 409 | 同键请求摘要不同 | 停止重试并提示请求冲突 |
| `CONTENT_LIMIT_EXCEEDED` | 413 | 正文、资源或任务预算超限 | 缩减内容或申请配额 |
| `ASSET_NOT_READY` | 409 | 资源仍在校验或处理 | 等待状态，不绑定版本 |
| `TASK_LEASE_LOST` | 409 | Worker 已失去租约 | 丢弃迟到结果，重新查询任务 |
| `PUBLICATION_RECONCILING` | 202 | GitLab 结果待对账 | 轮询发布状态，不重复提交 |
| `PUBLICATION_CONFLICT` | 409 | 目标分支基线变化 | 重新生成清单并人工解决 |
| `STORAGE_CAPACITY_EXCEEDED` | 507 | 数据库或业务配额不足 | 停止上传/生成，保留可恢复错误 |

错误响应统一包含 `code`、中文 `message`、`traceId`、安全的 `details` 和 `retryable`；不得返回 SQL、文件系统路径、凭据或完整模型上下文。

### 13.4 现状基线和迁移映射

编码前必须生成只读基线报告，统计文档、草稿、历史版本、AI 任务及产物大小、附件类型和大小、孤立文件、缺失文件、重复摘要、发布中任务和当前运行模式。报告只保存聚合值和脱敏摘要，不提交正文或凭据。

迁移映射至少如下：

| 现有来源 | 目标实体 | 异常处理 |
|---|---|---|
| `handbook-production/state` 的 drafts/revisions | DOCUMENT/VERSION/TEXT_CONTENT | key 无法解析进入隔离清单 |
| `state.attachments` + attachmentRoot 文件 | ASSET/BINARY_CONTENT | 元数据无文件或文件无元数据均不自动删除 |
| `state.reviewBatches` | REVIEW/REVIEW_ITEM | 缺版本则阻止发布 |
| `state.idempotency`、`state.audits` | IDEMPOTENCY、AUDIT | 旧格式缺 traceId 时标记来源 |
| `production-ai-artifacts/state` | ARTIFACT/ARTIFACT_REF | 无引用产物进入保留期 |
| 旧 Agent intermediate/output | ARTIFACT/TEXT_CONTENT/BINARY_CONTENT | 不可解析文件只登记不猜测归属 |

迁移报告必须包含 `source_count / imported_count / skipped_count / rejected_count / bytes / digest_mismatch_count`，支持按批次重跑。缺失、重复或未授权数据不得静默标记成功。

#### T04内容与关系只读基线契约

独立工具`tools/repository/inventory-production-content.cjs`仅调用`GET /v1/export`，不改变现有引用门禁工具。选择非软删除的两个生产state聚合，按服务当前序列化规则核验修订Markdown/contentDigest、来源content/contentDigest、任务originalMarkdown/originalDigest、产物JSON.stringify(value)/digest；统计UTF-8字节、历史与当前修订、重复内容组；复用现有contextKey函数核对草稿键与上下文，不另造解析规则。检查当前/审核修订、修订附件、审核文档与AI任务产物引用，内嵌旧产物单独核验，不将动态MCP快照误判为丢失来源。孤立产物只登记为未引用，不能据此删除。

附件文件核验仅在显式传入本机权威attachmentRoot时进行：根及祖先不得为符号链接、文件名不得跨目录、文件以O_NOFOLLOW打开并流式计算摘要；比较实际大小/摘要，缺失和无元数据文件单独分类，不读取链接目标、不自动清理。不指定根时物理核验为未执行，不能给出完整通过结论。报告只含固定类别、计数、字节、哈希化标识和摘要，不输出正文、文件名、路径、URL、创建人或错误原文。来源图片补充见下一节；运行模式、发布任务、旧Agent输出、LOB与跨实例/备份恢复仍是独立未验收项。

伪代码：validateExport → selectLiveState → measureAndHashContent → validateLogicalReferences → optionalScanExplicitAttachmentRoot → sanitizedReport。导出和文件扫描并非同一事务快照；observedAt、聚合revision和manifestDigest仅用于定位观测版本，迁移前仍需停写快照和正式对账。协议不完整须失败；异常和未执行项不能静默算作通过。报告以0600独占创建，避免覆盖旧证据或跟随输出链接。

#### T04托管来源图片盘点补充契约

来源图片补验阶段盘点工具schemaVersion为2，scope为production_content_attachments_and_source_images；保留physical作为附件检查，新增sourceImages。按实际readImage授权读取链路遍历aiSources、aiJobs.sourceSnapshots、草稿所有revisions.generationMetadata.sourceSnapshots，分别统计ready/failed引用与按assetId去重的资源。ready资源须满足assetId=contentDigest且为64位小写SHA-256、bytes为非负安全整数、contentType为当前图片识别器支持类型；同一assetId的大小/类型矛盾单独阻断。失败来源图片只计数，不能伪造成现有文件，也不从远端重新拉取。随后正文图片引用盘点升级schemaVersion为3，scope为production_content_attachments_source_images_and_links；新增imageLinks，历史schemaVersion=2报告仍作为当时观测保留。

通过显式KC_SOURCE_IMAGE_ROOT指定当前服务本机权威图片目录，复用附件的只读流式文件核验和路径约束，另用现有imageType验证实际文件签名；所有历史和任务快照同样纳入，不只扫描当前来源集合。没有图片根仍为not_checked，目录不可用为root_unavailable；两种资源目录均checked且无异常才可使scope内passed=true。孤立文件只报告，禁止清理；无资源元数据也须枚举目录才可认定已检查。报告不包含URL/路径/正文，仅聚合数量、大小和哈希标识。此扩展不解析所有Markdown/HTML内链接、不覆盖旧Agent文件、跨聚合事务快照或BLOB恢复，不能替代迁移总验收。

#### T04正文图片引用只读核对契约

在上述盘点工具中解析全部草稿修订Markdown及HTML快照、来源content和AI任务originalMarkdown中的图片引用；Markdown沿用现有marked图片token解析器，HTML用DOM解析img的src、data-src、data-original及首个srcset候选，与当前网页来源处理口径一致。按出现位置与链接类型统计，不输出原文或URL。平台附件引用须能定位state.attachments中的元数据；托管来源图片引用须能定位全部来源、任务和历史修订快照合并后的assetId；缺失引用作为逻辑异常。外部URL、data URI和仓库相对路径只计数，不下载或推断可恢复；srcset其余候选仍列为未检查。代码块、普通超链接和未保存的前端编辑内容不在图片引用口径内。即使本轮逻辑核对无异常，物理目录未检查、旧Agent输出、仓库相对资源字节、跨聚合事务快照与LOB恢复仍不能宣称迁移完成。伪代码：遍历受检正文→结构化提取图片→分类并核对内部元数据→匿名聚合报告→独立物理文件核验。

实际只读观测（2026-10-28 20:58）：Storage聚合revision仍268/52；受检正文69处图片引用，其中来源外部62处、AI任务相对7处，修订Markdown/HTML没有图片引用。没有内部元数据缺失结论，不代表外部链接或仓库相对字节可用。附件root_unavailable、来源图片目录1个未关联文件，完整性仍失败。v3证据为`runtime/test-results/continuation-20261029/production-content-links-v3-final.json`；前两份试运行文件不作为正式结论引用。

#### T04观测结果与迁移前阻断项（2026-10-28）

真实共享Storage聚合revision为268/52：46草稿、75修订、37来源、23任务、52产物，受检摘要无不一致，36产物未被现存任务引用。正文共282561字节、最大45523字节；样本量不足以证明LOB容量。5份附件元数据共19277字节，但当前服务默认目录不存在，不能确认文件可恢复。仅记录根目录不可用，不推断其余机器/备份也丢失；不得创建空目录掩盖缺口。报告scope仅覆盖生产内容及附件，`complete/passed`不代表整套迁移门禁通过，其他未执行项在unchecked中明确列示。

来源图片补验（20:14）：核对13510真实进程工作目录和命令，允许列表读取确认KNOWLEDGE_STORAGE_MODE=database、Storage URL为本机14210；frontend-server与route生产构造链无attachmentRoot/sourceImageRoot覆盖，repo-paths按代码根解析默认目录。附件目录仍不存在，图片目录有1个普通文件；真实GET导出聚合revision仍268/52。三个实际图片授权元数据位置均无图片引用，因此该文件列为UNREFERENCED_SOURCE_IMAGE_FILE，仅说明受检元数据未引用，未核验其字节、未判定可删除，也未把文件直接计作可恢复图片。图片目录已枚举checked，附件root_unavailable，整体complete=false/passed=false。运行模式的这次进程观察不等于跨实例存储恢复验收，保持迁移总门禁未完成。证据production-content-images-live.json、resource-runtime-observation.json；13项本地真实HTTP/文件测试通过，未写共享数据库或资源目录。

迁移步骤提案：先在权威存储冻结快照并分别保留原始聚合与文件私有备份；以源record revision/sha256和内容摘要生成批次清单；将上下文键异常、失效大纲、缺失附件和引用不一致逐条隔离，保留源数据；经数据字典与迁移评审后在test_hy导入，按源ID+摘要幂等定位，逐批核对计数/字节/摘要与目标回读；全部阻断项有处置结论才允许切换。36份未引用产物和重复正文不能直接清理，须核查历史/留存引用并另获对应授权。

回退提案：切换前保留旧模式和冻结快照、记录切换点；切换失败先停止新写入并保留新状态，若已产生新写入，必须先对账增量，不能直接覆盖为旧备份。批准后的恢复脚本只恢复对应批次/环境，CAS冲突停止；需真实恢复演练验证，不以工具单元测试代替。本轮未编写或执行新DDL/迁移/恢复脚本。

### 13.5 配置、密钥与部署契约

实现前要冻结环境变量、配置文件和数据库配置记录的优先级，避免同一配置无法审计。至少定义存储模式、数据库 URL、超时、连接池、LOB 并发、事务重试、正文/资源/任务/租户限额、任务租约与重试、留存策略、GitLab 项目/分支/MR/LFS 限制、密钥标识和轮换版本。

生产 `KNOWLEDGE_STORAGE_MODE` 必须为 `database`；`file` 只用于开发和迁移工具。Storage 先启动并通过健康检查，Node/Worker 再启动；多实例共享同一数据库；本地临时目录可清空；迁移独立于应用启动且必须来自已提交 Git 版本；切换失败不得静默降级到本地文件。

### 13.6 测试矩阵与评审证据

进入功能实现前先准备夹具、数据生成器和隔离环境：

| 层级 | 必测场景 | 证据 |
|---|---|---|
| DDL/Storage | CLOB/BLOB 流读写、约束、回滚、版本冲突、租约过期 | 真实个人 YashanDB 报告 |
| Node 单元 | 校验、授权、幂等、状态、引用清理、错误码 | 行/分支覆盖率 ≥90% |
| 集成 API | 两实例并发保存、单篇读取、资源流式下载、任务恢复 | HTTP 结果、P95/P99 |
| Worker | 杀进程接管、迟到写拒绝、重复任务、取消、模型超时 | 状态和审计对账 |
| GitLab | 分支冲突、超时已提交、MR 未合并、资源摘要、LFS（如启用） | 测试项目 commit/MR |
| 迁移/恢复 | 幂等重跑、缺失/重复、回退、换机和临时目录清空 | 前后计数、摘要、恢复演练 |
| 安全/容量 | 跨团队读取、恶意文件、日志脱敏、十倍历史和配额 | 安全报告、容量报告 |

覆盖率 90% 不能替代真实 YashanDB、换机恢复、GitLab 对账和容量压测。每份证据要标明源码版本、数据库版本、配置摘要及是否修改真实共享数据。

### 13.7 评审完成定义

只有以下条件全部满足，才能进入功能实现：

1. 产品负责人确认 13.1 的业务决策，架构负责人确认数据边界和发布一致性。
2. 数据库负责人确认数据字典、DDL、LOB、索引、权限、备份和回退设计。
3. 运维负责人确认容量预算、RPO/RTO、监控、告警、部署顺序和恢复窗口。
4. GitLab 管理员确认项目、分支、MR、LFS（如适用）和 API 限制。
5. 测试负责人确认测试矩阵、真实依赖环境和覆盖率口径。
6. 现状基线和迁移映射无未分类高风险数据；例外有责任人、期限和回退措施。
7. 评审结论、批注和批准版本写入设计文档；未批准参数仍标记为提案。

### 续作T04/T11只读引用盘点（2026-10-28）

在调整迁移或测试初始化前，使用独立只读工具读取Storage现有`GET /v1/export`，按当前服务端引用规则抽取非豁免namespace中的大纲引用（含软删除记录与历史修订），逐一通过`GET /v1/domain/outlines/:id/governance`确认存在及删除状态。规则配置放在`config/knowledge-center/production-reference-audit.json`；配置须与Main.collectOutlineReferences及upsertRecord豁免范围保持一致，不能改变服务端门禁。

输出仅包含记录/引用数量、namespace、哈希化记录键及引用定位、导出revision/数据库摘要、有效/缺失/已删除/未知分类和整体通过状态；正文、凭据、模型上下文、原始URL不落盘。网络失败、协议异常和未知状态均非通过。报告只证明观测时点，导出与逐项读取非同一事务，不能充当冻结备份、原始LOB摘要核验或跨实例一致性证明；迁移前仍需锁定快照及正式对账。

测试复制表行数相同不能证明引用有效。该盘点先在共享实例只读运行以定位原因，再用于隔离环境验证；不自动恢复大纲或删除来源库历史。基线异常报告保留并分类；用户已批准仅对test_hy先备份后重建测试生产状态，具体执行契约见下节。

### T11隔离生产夹具初始化（已获用户批准）

统一入口持有test_hy独占锁，先同步并对账、执行已提交迁移，再启动自有Storage。业务服务启动前执行固定初始化工具：核验测试环境、runId、run-owner、Storage PID的真实进程环境账号为test_hy且端口匹配。仅操作handbook-production/state与production-ai-artifacts/state；两份原始记录在runtime本次运行目录以0700目录、0600文件独占创建并fsync，全部备份成功才允许逐项If-Match CAS写入空状态。初始化前后分别保存只读引用盘点；初始化前只允许归属于这两个记录的已删除引用，缺失、未知状态或其他记录的异常在首次PUT前停止并保留备份，初始化后仍有失效引用则阻止业务启动。记录摘要/版本、回读空值一致；任一步失败停止启动，保留备份及阶段报告，不覆盖冲突或自动恢复旧记录。

伪代码：guardOwnedTestStorage → GET两聚合 → durablePrivateBackupAll → CAS每聚合 → GET比对 → report。空状态保留schemaVersion=1及服务默认容器，具体有效草稿由E2E根据复制的有效手册初始化。禁止清空outlines/assets/auth或写pf_knowledge；测试初始化与迁移分离，不是业务启动自动DDL。回退仅在同一测试Schema停服后，以备份和当前revision逐项CAS恢复，冲突停止；下次正式测试仍必须重新同步，不在部分失败状态继续。

T03补充核验见数据字典§4：已确认现有内部连接/映射与512字符外部项目路径，发现草案256字符键可能收缩；产品版本权威目录与scope仍待定，不能进入新表迁移。仅测试聚合初始化获批，不代表物理存储重构已评审通过。


### T04离线备份与恢复演练契约（2026-10-29）

备份工具只读Storage的三个生产聚合（handbook-production、production-ai-artifacts、incremental的state），显式指定当前服务的附件和来源图片目录，包含附件下delivery-images及未关联文件。原始聚合和文件以0700目录、0600文件独占创建并同步落盘，不覆盖既有备份。备份前后比较完整聚合内容与revision/sha256，并二次枚举、核对文件摘要；发现并发变更停止并保留失败现场。此检测不是数据库跨聚合事务快照；正式迁移仍需停写和数据库备份。缺失目录必须记录，禁止创建源空目录掩盖丢失。符号链接、特殊文件及路径重叠拒绝。

恢复仅写入全新独立目录，禁止向Storage或现有业务目录写入；先校验清单及全部文件大小/摘要，再恢复原始聚合和资源，最后通过本机只读HTTP导出适配器复用内容盘点核验。备份自身完整不等于业务引用完整；分别报告copied、stable、inventoryPassed，只有三者通过才接受离线演练。缺失附件、旧候选清单缺口及孤立文件均继续阻断，不自动修复、不清理。报告不输出正文或资源名，私有原始备份则按恢复需要完整保存。

伪代码：exportSelected → inventory → privateCopyAll → exportSelectedAgain → rescanFiles → compare → sealManifest；restore：validateManifestAndFiles → createNewTarget → copyVerified → localReadonlyExport → inventory → compare。线上数据库CAS恢复、LOB、跨实例事务及GC仍属后续任务，本工具不得声称已完成T09。
