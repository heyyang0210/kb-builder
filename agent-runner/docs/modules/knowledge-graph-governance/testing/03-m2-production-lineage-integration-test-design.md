# M2 生产 Lineage 接线测试设计

```yaml
documentType: test-design
moduleId: knowledge-graph-governance
relatedTasks: [RG-17, RG-19, RG-24, RG-25, TASK-RAG-KG-M2-LINEAGE-REWORK-01, TASK-RAG-KG-M2-LINEAGE-INT-01, TASK-RAG-KG-M2-LINEAGE-INT-02, TASK-RAG-KG-M2-LINEAGE-INT-03, TASK-RAG-KG-M2-LINEAGE-INT-04]
status: architecture-approved-red-tests-pending
decisionGate: G2.5
designedAt: 2026-08-18
updatedAt: 2026-08-18
owner: Test Engineer
```

## 1. 测试目标与结论边界

本设计验证生产事实源能否被确定性地转换、原子提交并在发布时重新验证。测试不能只证明 `LineageManifest` 纯组件正确，还必须证明知识加工真实出口使用了冻结的 normalized 快照、稳定父链和单一权威治理包。

当前实现尚不能作为正确基线。[M2 生产事实只读审计](../../../../../.codex/workflow/audits/knowledge-graph-governance/2026-08-18-m2-production-fact-audit.md) 已确认三个批量风险：10,100 个文档中有 2,321 个额外重复 occurrence；55,324 条 legacy keyword evidence 没有版本字段；最大重复组的 2,027 个 occurrence 是 normalized bytes 完全相同的完整供应商 JSON 权限错误信封，不是转换器生成的正文。该错误组中 569 条被标记为 `completed`、1,458 条被标记为 `completed_with_warnings`，已分别生成 2,027 个污染 chunk、keyword candidate 和 graph edge。前三类事实会分别造成 Source ID 冲突、evidence 全量隔离，以及错误信封被伪装为正常知识来源。

验收必须同时满足：

- 相同内容、不同来源保持两个可独立授权和追溯的 source occurrence；
- 完整供应商错误信封不能成为 source/chunk/evidence/graph/index 事实；
- legacy keyword 记录可从已提交运行级版本事实补全，不能读取当前配置冒充历史事实；
- 单 evidence 损坏被隔离，source/chunk/快照/治理包整体损坏则 fail-closed；
- 数据集治理目录是唯一发布权威，训练运行副本不参与发布判定；
- 任意输入顺序下产物字节、指纹、ID 和问题顺序稳定；
- 本设计通过不代表 ACL、安全审计和 G2.5 已通过。

## 2. 决策门与测试实施顺序

| 分组 | 决策依赖 | 当前是否可写 | 原因 |
|---|---|---:|---|
| A：输入类型、偏移、隔离和确定性 | 4A / G-LIN-04 已选 | 部分已实现 | A18/A23 应从 skip 转为 `unicode_code_point` 红灯 |
| B：Source occurrence 身份 | 1A / G-LIN-01 | 组件实现完成 | 2026-08-18 已确认；PL-B01—B06 已通过，生产 API/治理包接线不在本组完成证据内 |
| C：权威目录、审计镜像和恢复 | 3A 已选 | 可写红灯 | dataset governance 唯一权威，run 仅为镜像 |
| D：真实生产出口与发布重验 | 1A + 3A 已选 | 按依赖写红灯 | 先完成内核修订和请求时冻结 |
| E：API-A 规则重建 | API-A 已选 | 按 SMART 顺序实施 | 字段不变；轻校验同步、重工作异步；首阶段只暴露 artifact |

A18/A23 现在按 `offsetUnit=unicode_code_point` 固化预期。C/D/E 可进入红灯，但必须遵守“内核契约 -> 请求时冻结 -> 有界性能 -> 真实 API -> 治理包/发布重验”的依赖，不能直接把现有内核挂到路由。

### 2.1 当前执行结果与证据边界

2026-08-18 在 `scripts/pingcode/web/backend` 执行：

```bash
python3 -m unittest \
  tests.test_keyword_extractor_version \
  tests.test_lineage_manifest \
  tests.test_production_lineage \
  tests.test_m2_lineage_replay \
  tests.test_version_fingerprint \
  tests.test_training_service -v
```

完整设计矩阵共有 **50 个编号用例**：PL-A01—A27 共 27 个、PL-B01—B06 共 6 个、PL-C01—C10 共 10 个、PL-D01—D07 共 7 个。当前只实现了其中一部分；下述 **166 项**是六个测试模块实际收集到的测试方法数，不是设计用例总数。

最新独立执行结果为 **166 项，164 passed / 2 skipped**。当前结果分解如下：

| 状态 | 用例范围 | 说明 |
|---|---|---|
| 直接通过 | PL-A01、A05—A07、A11—A17、A19—A22、A24—A27 | 22 项测试方法；A15、A16 分别由多个故障场景覆盖 |
| G-LIN-02/2A 组件通过 | PL-A02 规则快照/producer/legacy resolver | 7 项契约测试；覆盖 descriptor 稳定、commit/manifest/artifact 绑定、路径/symlink/跨 run/篡改 fail-closed、新 candidate 引用、legacy 仅信任同 run 快照、规则 producer 零模型调用与确定性 |
| 基线通过 | 既有适配器与治理包仓储回归 11 项 | 覆盖冻结字节/偏移、坏 evidence 隔离、聚合、最小 keyword 位置、版本组件、四文件提交、原子替换前故障和候选不可变等局部行为 |
| B 组完成 | PL-B01—B06 | 覆盖同内容不同资源独立 occurrence、10,100 条结构化规模样本、同资源重复拒绝、内容变更、冻结 v1 兼容回放和恶意 resourceId |
| 历史显式跳过 | `test_pl_a18_unicode_offsets_follow_frozen_offset_unit`、`test_pl_a23_formal_offset_representations_are_table_driven` | 旧结果不得计为通过；4A 已选，下一步转为 `unicode_code_point` 红灯 |
| 尚未完整实现 | 2C 请求时冻结、同 run 规则证据、崩溃接管、有界执行、真实 API、PL-A03—A04、A06/A11 生产门禁半部、PL-A08—A10 | 新增红灯矩阵未完成，现有局部回归不能替代 |

API-A、3A、4A 与 G2-03 架构已选定；当前阻塞是 P0 内核/冻结/错误/性能缺口、JWT 运行参数和未完成测试。现有 2C 9/9 只覆盖局部内核，不证明公共 API 可上线。

### 2.3 API-A 红灯矩阵

| 范围 | 必须覆盖 |
|---|---|
| 内核 | rule snapshot/candidates 同 `rebuildRunId`；完整 `rebuildOf`；executor context；外层 task 不影响 candidate ID；零模型调用 |
| 恢复 | rename 后 CAS 前崩溃可重验接管；stale reservation 租约到期后单 worker 有界接管 |
| 冻结 | manifest/source/normalized/processing 全摘要；稳定 inputDigest；缺失/漂移/身份/路径/symlink/跨 resource fail-closed；旧文件不变 |
| API | 不存在/跨 batch/非 keyword candidate 同步 404/409；异步失败含 reasonCode/requestId/retryable；成功 artifact 可见但不创建 DatasetVersion |
| 兼容并发 | 普通 keyword/formal 行为不变；同 batch 一个 202、其余结构化 409；禁止读取 `latest` |
| 性能 | 1k/8k 记录吞吐、P50/P95、峰值 RSS、I/O 与锁等待；执行有界，不设未测量毫秒 SLA |

### 2.2 已落地的 A 组行为

- **稳定 issue 身份**：优先使用 `knowledgeId/candidateId`；缺少 producer ID 时使用规范记录内容的 SHA-256 摘要前缀生成 `record:{digest}`，不使用临时输入序号作为身份。
- **规范 `recordIndex`**：evidence 先按规范内容稳定排序，issues 再按 `objectId/reason` 排序并重新编号，因此 `recordIndex` 表示规范问题序列位置，而不是调用方原始数组下标。
- **PL-A16 二次校验**：治理包在 `before_verify` 后完成第一次四文件读取校验，在 `before_publish` 故障注入点后、`os.replace` 前执行第二次读取校验。issues 首次校验前损坏或首次校验后被替换都 fail-closed，最终 `governance/` 不存在。
- **路径与 symlink**：非法资源路径、normalized 文件或子目录 symlink 逃逸、governance 父/最终/staging symlink 均有拒绝测试。
- **父链边界**：同 resource overlap 可重绑；跨 resource、缺失、自指和环形父链均有界隔离，其他合法 evidence 继续处理。
- **确定性**：100 组 source/chunk/evidence 输入排列产生相同结果；问题身份不随输入顺序改变；同一事实跨候选版本的 source/chunk/evidence ID 保持稳定。
- **聚合与空集合**：PL-A05 已验证同 span 的显式 extractor 版本和 producer ID 去重排序；PL-A06 已验证空 evidence 及全部隔离 evidence 均可形成自校验有效的组件产物，但没有把 `manifest=true` 解释为生产 evidence gate 通过。
- **快照编码完整性**：PL-A11 已验证 normalized hash 漂移以及“hash 正确但 payload 非 UTF-8”均整体返回 `ARTIFACT_INTEGRITY_ERROR`；生产 store gate 不变仍需集成测试证明。

PL-A16 的二次校验只能证明当前组件在两个显式检查点识别替换，不能替代发布 API 对 dataset 权威包的现场重验，也不能证明 `os.replace` 后 fsync、进程崩溃或掉电恢复语义。

## 3. 测试分层与事实夹具

| 层次 | 建议测试文件 | 目标 | 时限 |
|---|---|---|---:|
| 适配器单元 | `tests/test_production_lineage.py` | 类型、哈希、偏移、父链、兼容补全、稳定排序 | `<10s` |
| 仓储故障注入 | `tests/test_production_lineage.py` | 四文件自校验、rename、fsync、崩溃恢复 | `<10s` |
| 训练出口集成 | `tests/test_training_lineage_integration.py` | keyword/formal 真实数据集生成出口、权威目录和业务 manifest | `<60s` |
| 发布重验 API | `tests/test_governance_publish_lineage.py` | TestClient 真实调用发布路由，篡改后 P0 阻断 | `<60s` |
| 生产快照回放 | 隔离验收测试与报告 | 脱敏真实重复数据、legacy keyword 和完整供应商错误信封隔离 | 单独运行 |

测试夹具必须包含：

1. 两个不同 `resourceId/sourcePath`、相同 normalized bytes 的 source；
2. 从已审计最大重复组制作的脱敏完整供应商错误信封 fixture：保留顶层及嵌套 `error.code=400402`、`message=This operation is not allowed` 的对象结构、批准的内容指纹，以及原产物 `completed/completed_with_warnings` 状态分布；不保存 stack、文件名或完整原文；
3. 至少一条 legacy keyword candidate：有 `sourceMethod`、无 `schemaVersion/extractorVersion`；
4. 中文、ASCII、组合字符 `e\u0301`、预组合字符 `é`、非 BMP 字符和换行混合文本；
5. 两个 resource 各自的 chunk，并构造恶意跨 resource `overlap.sourceChunkId`；
6. 同一语义集合的多种输入排列，用固定 `createdAt` 消除时间噪声。

生产规模样本应由只读脚本输出计数和摘要，不把 10100/2321/55324/2027 当成永久业务常量。自动化断言关注比例不变、无遗漏和分类正确；本次验收报告再记录实际计数。

## 4. 详细用例矩阵

### 4.1 输入、质量隔离与模式边界（决策前可实现）

| ID | 场景与输入 | 预期结果 | 关键断言 |
|---|---|---|---|
| PL-A01 | `evidence_records` 含字符串、数组、数字、`null`，并混入一条合法对象 | 非对象记录逐条隔离，合法记录继续构建 | 不抛 `AttributeError`；每条问题为 `LINEAGE_RECORD_INVALID`，`recordIndex`/稳定 `objectId` 可定位；有效 evidence 数为 1 |
| PL-A02 | legacy keyword 只有 `sourceMethod`，无两个版本字段；调用方提供已提交 run/pipeline/rule 版本快照 | 仅在同 run 快照可完整重验时形成稳定 `extractorVersion`；否则隔离 | 版本来自已提交快照而非当前配置；缺失/跨 run/篡改快照明确 fail-closed 或质量隔离，不静默填默认值；目标 run 基线为 `RECOVERABLE=0`/`ISOLATE=55,324` |
| PL-A03 | keyword 与 formal 使用同一规范 chunk | 模式契约严格分离 | keyword 允许无 offset 并选最小匹配位置；formal 必须验证 offset；keyword 的 model 为 `null/not_applicable`，formal 仅在确有模型调用快照时写 model |
| PL-A04 | keyword 文本出现两次；formal 文本出现两次且 offset 无法消歧 | keyword 固定取第一个；formal 隔离多义记录 | keyword `occurrenceIndex=0` 且重建稳定；formal 问题原因明确为多义 |
| PL-A05 | 同一 chunk/span 的多条 evidence，版本和 producer ID 不同 | 聚合为一条确定性 evidence | `extractorVersions`、`producerEvidenceIds` 去重排序；主 `extractorVersion` 规则固定 |
| PL-A06 | 空 evidence 集合以及全部 evidence 被隔离 | Lineage 可表达无有效 evidence，但 evidence/quality gate 不得通过 | manifest 自校验结果与 issues 完整；生产接线不得把 `manifest=true` 推导成 `evidence=true` |
| PL-A07 | 不支持的模式值 | 整体拒绝 | `VERSION_FINGERPRINT_INVALID`，不得生成治理目录 |

`PL-A02` 的兼容接口已由 `KeywordExtractorVersion.resolve` 固化：新记录必须显式版本与同 run 快照引用完全一致；legacy 必须由服务端传入已提交同 run snapshot ref，两者都没有时产生 `LEGACY_EXTRACTOR_VERSION_UNPROVEN`。测试不接受“给 legacy 记录硬编码当前版本”。

### 4.2 供应商错误信封与 Source 质量（决策前可写上游规格）

| ID | 场景与输入 | 预期结果 | 关键断言 |
|---|---|---|---|
| PL-A08 | 脱敏真实 JSON 权限错误信封；输入状态为 `completed` 或 `completed_with_warnings` | 在 preparation 生成 source/chunk 前隔离 | 解析完整 JSON 并匹配配置化 provider error envelope 或批准指纹；写 `SOURCE_ERROR_ENVELOPE`；不生成 source/chunk/evidence |
| PL-A09 | 正常文档正文包含数字 `400402`，或 JSON 业务示例含该字段但不满足错误信封契约 | 不误隔离 | 禁止字符串包含判断；必须同时满足完整对象、provider code/message 结构或批准指纹 |
| PL-A10 | 2,027 条相同错误信封混合正常文档 | 每个 occurrence 可审计，错误 blob 可去重但不能合并来源状态 | 2,027 条全部隔离；正常文档数量及父链不受影响；进入 chunk/candidate/graph/index 的错误 occurrence 均为 0 |
| PL-A11 | 转换状态成功但 normalized hash 漂移或 UTF-8 解码失败 | 整体 source 事实不可验证 | `ARTIFACT_INTEGRITY_ERROR`；不提交治理包、不更新门禁 |

[生产事实审计](../../../../../.codex/workflow/audits/knowledge-graph-governance/2026-08-18-m2-production-fact-audit.md) 已证明：2,027 个错误 occurrence 未被标记为 `CONVERSION_FAILED`，而是完整 JSON 权限错误信封被当成普通文本/Office 转换结果；它们与 189 个独立 `CONVERSION_FAILED` resourceId 的交集为 0。脱敏 fixture 只保留顶层与嵌套 `code/message` 结构，不保存 stack、文件名或原文。检测器属于 preparation 输入质量边界，契约与规则版本必须进入 manifest；Lineage 适配器只消费已隔离后的可信 source facts。

### 4.3 路径与文件完整性（决策前可实现）

| ID | 场景与输入 | 预期结果 | 关键断言 |
|---|---|---|---|
| PL-A12 | `resourceId` 为 `../outside`、绝对路径、分隔符或 glob 元字符 | 拒绝输入 | 不访问 normalized root 外文件；错误分类为 `ARTIFACT_INTEGRITY_ERROR`；上下文不泄露根外内容 |
| PL-A13 | normalized 候选是指向 root 外文件的 symlink | 拒绝快照 | 必须比较 `resolve()` 后路径与 dataset normalized root，并显式拒绝 symlink；外部文件不被读取 |
| PL-A14 | normalized 目录内 symlink 子目录指向 root 外，文件名表面合法 | 拒绝目录逃逸 | glob/resolve 双重边界测试通过 |
| PL-A15 | governance 目标目录、staging 或父目录被 symlink 替换 | fail-closed | 不覆盖目标外文件；不留下被业务 manifest 引用的半包 |
| PL-A16 | `lineage-issues.jsonl` 被截断、含无效 JSON、含非对象行或内容在校验后被替换 | staging 自校验失败 | 四个治理文件全部参与校验；`issues` 行级 schema、数量/摘要与 verification 或包摘要绑定；最终目录不存在 |
| PL-A17 | lineage/version/verification 任一文件损坏 | staging 或发布重验拒绝 | 分类稳定；store gate、业务 manifest 和 published 指针均不变 |

### 4.4 偏移、overlap 与 Unicode（决策前可实现）

| ID | 场景与输入 | 预期结果 | 关键断言 |
|---|---|---|---|
| PL-A18 | 中文、非 BMP、组合字符、CRLF/LF 混合快照 | 偏移单位遵循生产契约并可回放 | `normalizedOffsets`、evidence `[start,end)` 与 Python/JSON API 契约一致；`quotedHash` 对实际 UTF-8 quote 计算；回放文本逐字符相等 |
| PL-A19 | `é` 与 `e\u0301` 视觉相同但字节不同 | 不做隐式 Unicode 归一化 | content/text/quoted hash 不同；offset 仍准确；除非上游规范明确记录 normalization form |
| PL-A20 | formal runtime chunk 带同 resource overlap，证据仅存在父 chunk | 允许重绑同 source 父 chunk | evidence 指向父 chunk 稳定 ID，本地 offset 和 quotedHash 正确 |
| PL-A21 | overlap 指向另一个 `resourceId` 的 chunk，quote 在父 chunk 唯一命中 | 拒绝跨 resource 重绑 | 单 evidence 隔离，原因指出父链边界；绝不能把引用迁移到另一文档 |
| PL-A22 | overlap 父 ID 缺失、自指或形成环 | 隔离且有界结束 | 无递归/死循环；其他 evidence 继续处理 |
| PL-A23 | formal `evidenceOffsets` 分别按 source 全局、runtime 本地和规范 chunk 本地构造 | 只接受契约定义且可现场回查的表示 | 防止当前 `start - source_start` 算法误判 overlap；三组预期在设计确认后固定为表驱动断言 |

偏移测试必须同时断言字符位置与 UTF-8 字节哈希。不能用纯 ASCII fixture 证明中文文档安全，也不能在适配器内无记录地执行 NFC/NFD 转换。

### 4.5 顺序与并发稳定性（决策前可实现）

| ID | 场景与输入 | 预期结果 | 关键断言 |
|---|---|---|---|
| PL-A24 | source、chunk、evidence 分别随机打乱 100 次 | 语义相同则产物字节相同 | manifest fingerprint、version fingerprint、所有 ID、数组顺序、issues 顺序完全一致 |
| PL-A25 | 非对象或损坏 evidence 混入后打乱 | 问题身份不依赖临时输入序号 | `objectId` 应来自稳定 producer ID 或内容摘要；若只能使用 `recordIndex`，则明确该用例红灯并推动契约修复 |
| PL-A26 | 两个 writer 同时提交同一候选版本 | 至多一个成功 | 另一个获得分类冲突；没有覆盖、合并或半包；最终四文件可重验 |
| PL-A27 | 相同业务事实重建到新候选版本 | occurrence、chunk、evidence ID 按契约稳定，版本级指纹可解释 | 不受字典插入顺序、进程 hash seed 和文件枚举顺序影响 |

## 5. 已确认 1A：重复 contentHash 与兼容读取

本组采用已确认的 `1A`：逻辑身份由 `datasetId + resourceId + contentHash` 组成，物理 ID 为 `source:v2:<sha256(canonical-json(logicalKey))>`；Schema `2.0` 仅新写，Schema `1.0` 使用原 v1 稳定 ID 规则只读验证和回放。歧义 v1 验证返回 `LEGACY_SOURCE_IDENTITY_AMBIGUOUS` 并保持发布阻断；回放兼容 v1 bare digest 和 v2 `sha256:` digest。不得直接拼接未校验原始 ID，也不得顺带改变 normalized 物理路径布局。

| ID | 场景与输入 | 预期结果 | 关键断言 |
|---|---|---|---|
| PL-B01 | 两个 resource 的 normalized bytes 完全相同 | 生成两个 source occurrence | Source ID 不同，contentHash 相同，uri/resourceKey/aclRef 各自保留；两个 chunk 父链互不串联 |
| PL-B02 | 10100 文档结构化样本，包含 2321 个重复内容 occurrence | 不因重复内容整批失败 | source 数等于有效 resource occurrence 数；重复 contentHash 分组可统计；无 ID 冲突 |
| PL-B03 | 同一 resourceId、同一内容重复输入 | 整体拒绝重复 occurrence | `ARTIFACT_INTEGRITY_ERROR`，避免同一来源被重复计数 |
| PL-B04 | 同 resourceId 内容变化并创建新 versionId | 新 contentHash/Source ID，旧版本仍可回放 | 不覆盖旧治理包，引用不会漂移 |
| PL-B05 | v1 旧清单 `source:{dataset}:{contentHash}` | 只读验证和回放兼容 | 旧清单不被原地重写；新构建只输出 v2；歧义旧清单必须显式标记不可升级而非猜测 resourceId |
| PL-B06 | 恶意 resourceId 含冒号、斜杠和 Unicode 混淆字符 | Source ID 仍为固定格式且不影响路径 | 使用规范三元组哈希，不直接拼接未校验文本；生产适配器路径边界继续 fail-closed |

`PL-B02` 要同时验证完整供应商错误信封隔离后的计数，不能通过把重复 source 去重来“通过”。内容 blob 去重属于存储优化，不得改变 occurrence 数和 ACL 边界。

**组件完成证据（2026-08-18）**：PL-B01—B06 已全部通过，其中 PL-B02 构造 10,100 个 occurrence、7,779 个唯一 content hash 和 2,321 个重复额外 occurrence，构建耗时要求 `<10s`；Python 编译及目标文件 `git diff --check` 通过。该合成规模用例不包含尚未实现的 provider 错误信封 detector，因此不能替代 2,027 个生产污染 occurrence 的隔离回放。

## 6. 3A / G-LIN-03 决策后启用：单一权威目录与崩溃恢复

本组采用推荐 `3A/G-LIN-03` 的预期：`datasets/{datasetId}/governance` 是唯一发布权威；training run 目录只保存可重建审计镜像，其损坏或缺失不能改变已提交候选的发布事实。

| ID | 故障点/场景 | 数据集权威目录 | run 审计镜像 | manifest/store/publish 预期 |
|---|---|---|---|---|
| PL-C01 | 权威 staging 写任一文件前后崩溃 | 不存在 | 不要求存在 | 业务 manifest 无引用，`manifest=false` |
| PL-C02 | 权威 staging 自校验后、rename 前崩溃 | 不存在，仅可清理 staging | 不要求存在 | 不可发布，重试可安全执行 |
| PL-C03 | `os.replace(staging, governance)` 后、父目录 fsync 前模拟进程崩溃 | 启动恢复时重新验证 | 不作为判断依据 | 验证成功才补齐/确认提交；验证失败隔离目录并保持 gate=false |
| PL-C04 | 父目录 fsync 后、业务 manifest 更新前崩溃 | 完整且可验证 | 可缺失 | 恢复任务从权威包重建引用；未恢复前发布入口仍须直接重验磁盘包 |
| PL-C05 | 业务 manifest 更新后、store CAS 前崩溃 | 完整 | 可异步生成 | store 仍为 false；恢复以磁盘包+业务引用重放 CAS，不重复覆盖目录 |
| PL-C06 | store 更新成功后 run 镜像写失败 | 完整 | 缺失或损坏 | 候选事实不回滚；记录审计镜像质量问题并允许重建 |
| PL-C07 | run 镜像有效但 dataset 权威包缺失/损坏 | 缺失/损坏 | 有效 | 发布必须 P0 阻断；不得自动把镜像当权威 |
| PL-C08 | dataset 权威包有效但 run 镜像被篡改 | 有效 | 损坏 | 发布只依据权威包；审计告警，不改变候选指纹 |
| PL-C09 | 两目录内容不一致 | 权威包有效 | 摘要不同 | 明确报告镜像漂移；不得选择“较新文件”或 `latest.json` |
| PL-C10 | final `governance/` 已存在后重试 | 保持原字节 | 可重建 | 相同提交幂等返回或分类成功；不同摘要冲突，绝不覆盖 |

rename+fsync 测试分两类：单元层通过 fault injector 验证调用顺序与内存状态；Linux 文件系统子进程测试在每个故障点强制退出，重新启动恢复器检查磁盘事实。单元测试不能声称证明掉电持久性；真实掉电/文件系统保证应在部署环境演练并记录文件系统类型和挂载参数。

## 7. 1A + 3A / G-LIN-01 + G-LIN-03 后启用：真实 API 与端到端门禁

| ID | 真实流程 | 预期结果 |
|---|---|---|
| PL-D01 | TestClient 启动 keyword 训练，使用重复正文、legacy keyword 和 Unicode fixture | 任务完成；重复 occurrence 保留；legacy evidence 有历史版本；model 为 not_applicable；formal Entity/Relation gate 保持 false |
| PL-D02 | TestClient 启动 formal 训练，包含合法/损坏/跨 resource overlap evidence | 合法 evidence 入清单，损坏项隔离并使 evidence/quality gate 按策略阻断；模型指纹来自真实调用快照 |
| PL-D03 | 篡改/删除权威 lineage、version、verification、issues 任一文件后发布 | `PUBLISH_GATE_BLOCKED`；失败项结构化且中文动作明确；`force=true` 不能绕过 |
| PL-D04 | 只修复 store 中 `manifest=true`，磁盘包仍损坏 | 发布继续阻断，证明发布入口不信任缓存 gate |
| PL-D05 | 权威包恢复后以过期 `expectedStatusVersion` 发布 | CAS 冲突，发布指针不变 |
| PL-D06 | 删除图投影并从治理包重建 | citation 的 source/chunk/evidence、Unicode offset 和 quotedHash 不变 |
| PL-D07 | 生产脱敏计数样本回放 | 报告有效 source、完整供应商错误信封 occurrence 隔离、legacy evidence 接纳/隔离及重复 contentHash 分布，所有计数可由产物复算 |

真实 API 测试必须走应用路由和实际文件仓储，不 mock `TrainingService`、发布服务或 store。仅允许通过隔离 data root、固定 provider fixture 和故障注入接口控制环境。

## 8. 通过标准与失败证据

| 门槛 | 通过条件 |
|---|---|
| 输入鲁棒性 | 非对象 evidence、坏 offset、坏父链均有稳定分类；无未分类 500 |
| 路径安全 | traversal、绝对路径、glob 注入、symlink 逃逸成功数为 0 |
| 数据完整性 | normalized 实际字节哈希、chunk 切片、quotedHash 和四文件包均可现场重算 |
| 重复来源 | 有效 source occurrence 数不因相同 contentHash 减少，跨 resource 父链为 0 |
| legacy 兼容 | 有可信历史版本的 legacy keyword 接纳率 100%；无可信版本项可定位且不伪造 |
| 供应商错误信封 | 已审计确认的完整供应商错误信封 occurrence 进入 source/chunk/evidence/graph/index 的数量为 0 |
| 原子性 | 每个故障点都不存在“gate=true 但权威包不可验证”；不同内容提交不覆盖 |
| 确定性 | 同一事实 100 次排列重建的规范产物字节和指纹一致 |
| 模式边界 | keyword 不伪造 model/正式语义；formal 不绕过模型快照与 evidence 校验 |
| 发布重验 | 任一治理文件篡改、删除或 CAS 冲突均不改变发布指针；`force` 绕过数为 0 |

发现失败时保存：测试 ID、dataset/task/version ID、错误分类、脱敏路径、文件摘要、输入计数、隔离计数、gate 前后值和恢复结果。不得在报告中保存 token、完整原文、用户身份或根外绝对路径。

## 9. 建议执行命令

决策前回归：

```bash
cd scripts/pingcode/web/backend
python3 -m unittest tests.test_production_lineage -v
python3 -m py_compile app/production_lineage.py tests/test_production_lineage.py
```

1A/3A（G-LIN-01/G-LIN-03）实现完成后的生产接线回归：

```bash
cd scripts/pingcode/web/backend
python3 -m unittest \
  tests.test_production_lineage \
  tests.test_training_lineage_integration \
  tests.test_governance_publish_lineage -v
```

最终报告必须逐项引用测试 ID 和命令输出；当前六模块 166 项回归的 164 passed / 2 skipped 不能替代本设计的 2C 重跑、真实出口、发布重验和生产快照回放。

## 10. SMART 实施顺序

```text
API-DES-01
  -> KRN-TST-02 -> KRN-BE-02
  -> FRZ-TST-01 -> FRZ-BE-01
  -> PERF-BE-01
  -> API-TST-01 -> API-BE-01 -> API-ACC-01
  -> G-LIN-03 治理包与发布重验
```

KRN、FRZ、PERF、API、ACC 时限分别为 6h、6h、4h、7h、3h；每阶段以对应红灯转绿、旧回归不退化和目标生产数据零写入为完成定义。API 测试使用隔离 data root、真实 FastAPI/store/artifact repository，不 mock `TrainingService`。

已选而非未决：API-A、3A、4A=`unicode_code_point`、G2-03。仍需部署提供 JWT `issuer/audience/JWKS URI/claims`，缺失时 fail-closed。崩溃恢复采用请求重试即时接管、启动扫描清理/重验、独立修复命令审计兜底的组合；均不得以 run 镜像替代 dataset 权威包。
