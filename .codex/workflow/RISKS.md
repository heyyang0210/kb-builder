# 风险与阻塞清单

> 自动更新: 2026-08-19

## 本轮质量分析治理说明

- `TASK-KQF-REQ-26/27/28` 及全部 AUD/REV/INS 子任务已完成，组合回归 36/36、前端生产构建和目标性能门槛均通过，未形成新的功能阻塞。
- 目标业务批次 `batch_dc23fc9141ba4d6f` 全程只读，写入型 API 验收使用隔离数据集，避免污染业务结果。
- 性能验收中出现过一次不可重复的 I/O 调度抖动，立即复跑恢复正常且未再出现；当前按环境噪声记录为非阻塞说明。若后续重复出现，再升级为可复现性能风险并采集系统 I/O 指标。

## 活跃风险

| 编号 | 风险描述 | 影响范围 | 严重程度 | 缓解措施 | 状态 | 更新日期 |
|------|---------|---------|---------|---------|------|---------|
| RISK-DOC-REC-001 | 当前仓库没有已确认的周期对账基线，且启动前存在大量未提交/未映射文件；直接建立检查点可能错误归因业务变化 | 首次文档审计、后续增量范围 | 高 | 先由用户确认初始基线、未映射模块和脏文件重叠；确认前只生成报告，不推进 checkpoint | 活跃 | 2026-08-17 |
| RISK-DOC-REC-002 | 治理模块 glob 映射是配置快照，随着目录演进可能漏归档新模块或把文件映射到多个模块 | 文档影响范围和对账状态准确性 | 中 | 每次结构失效项变化触发全量审计；将未映射路径转为 `NEEDS_CONFIRMATION`，定期维护 `.codex/config/doc-governance.json` | 活跃 | 2026-08-17 |
| RISK-TSR-001 | SSE 硬编码 `deepseek-v4-flash-0731`，与非流式当前配置模型不一致；同一 43 个关键词产生相反统计：非流式 keep 18/exclude 25，SSE keep 25/exclude 18 | 关键词智能过滤一致性与用户决策 | 高 | 统一从可审计配置选择模型，并增加同输入、同模型、同提示词一致性测试 | 活跃 | 2026-08-05 |
| RISK-TSR-002 | 远端 HTTP/SSE 错误正文当前未截断、未脱敏 | 日志安全、敏感信息泄露和错误响应体积 | 高 | 对上游错误正文执行长度限制和敏感字段脱敏，仅保留状态码、分类与追踪信息 | 活跃 | 2026-08-05 |
| RISK-TSR-003 | 后端全量回归当前收集 417 项，其中 2 项范围外失败，另有 asyncio `ResourceWarning`；失败仍为知识点 Skill 错误码分类和预处理切块长度 | 全量回归可信度与测试资源治理 | 中 | 分别修复知识点 Skill 错误码分类、预处理切块长度，并关闭未释放 event loop；2C 聚焦组合 175 项已独立通过，不能替代全量回归 | 活跃 | 2026-08-18 |
| RISK-TSR-004 | apply 真实写入未在隔离数据集验收，仅由自动化测试覆盖 | 审批状态持久化、摘要更新和索引不重建的真实环境可信度 | 中 | 创建隔离数据集执行 apply 前后对比，保存状态、摘要和索引哈希证据 | 活跃 | 2026-08-05 |
| RISK-JSON-RACE-001 | 进程在产物生成后、提交保护区前退出时不会暴露半成品，但遗留 flight/staging 尚无租约回收 | 重试等待时间与磁盘清理 | 中 | 增加 owner 租约、进程存活探测和启动恢复测试 | 活跃 | 2026-08-07 |
| RISK-JSON-RACE-002 | 方案 C 尚未在固定硬件完成中/大规模单任务 5% 回退对照 | 大批次性能结论 | 低 | 使用合成 1,000/8,053 文档数据交替采样串行基线与方案 C | 活跃 | 2026-08-07 |
| RISK-TRAIN-8053-001 | 真实任务 `training_f1d9f8e63a184098` 启动后先同步执行完整 `preprocess.scan()`，串行转换 1,694 个可转换文档；父任务无扫描进度回调，持续显示 `current=0,total=null`，且扫描后的 preparation 已有同配置不可变快照可复用 | 8,000+ 文档知识加工首阶段耗时、前端进度可观测性和重复转换资源 | 高 | 训练主链路不得调用完整预览扫描；从已持久化的最新扫描报告读取统计，或仅执行 `lightweight=True` 且传入父任务进度回调；优先固定预检的 preparation snapshotRef，启动后直接复用。验收：同批次缓存命中时 5 秒内离开资料预处理，不创建 LibreOffice 子进程；缓存未命中时快照和日志持续返回已处理/总数 | 活跃 | 2026-08-07 |
| RISK-TRAIN-8053-002 | `training_f1d9f8e63a184098` 于 18:19:13 调用取消 API 后返回 `cancelling`；10 秒后仍继续创建新 LibreOffice 转换子进程，任务只会在无取消检查的完整 `preprocess.scan()` 返回后才进入取消终态 | 长任务止损、CPU/子进程资源、批次准入长时间被占用 | 高 | 完整扫描从训练链路移除；仍需扫描时，在每个资源和外部转换前后检查 cancellation token，取消时终止当前子进程并不再启动下一个。验收：任意扫描时点取消后 3 秒内进入 `cancelled`，无新转换子进程，批次 admission 恢复 `ready` | 活跃 | 2026-08-07 |
| RISK-TRAIN-8053-003 | 方案 A 真实任务 `training_ae4e8832ee134652` 在元数据构建失败：快照 `prep_bf1cd53923434667` 的 `metadata/source-documents.jsonl` 含 10,533 条记录，只有 10,100 个唯一 `resourceId`，共363 个重复 ID、433 条多余记录；这 363 个重复 ID 全部继承自输入 `resources.json`（输入共 759 个重复 ID、917 条多余记录）。例：`d2d65349ce17644b357ebc68` 在输入第 40743/40883 行重复，在输出第 1322/1332 行重复 | 8,000+ 文档任务无法进入知识提取和索引生成 | 高 | 下载/资源清单写入端按稳定 `resourceId` 幂等去重，对已存批次在 preparation 输入边界按 ID 隔离重复记录并写质量问题，不得静默覆盖内容冲突的同 ID 记录。验收：修复后 preparation 的 source-documents/source-resources/chunks 主键唯一；重复且内容相同时保留一条并记录数量，同 ID 内容冲突时隔离并报质量问题；真实任务通过元数据构建 | 活跃 | 2026-08-07 |
| RISK-TRAIN-8053-004 | 方案 A 已将真实任务的扫描缓存读取降至 39ms 且未启动 LibreOffice，但 `material_preparation` 从 18:36:49.025 到 18:36:58.180 仍耗时 9.154s，未达到热缓存 5s 内离开阶段的验收指标 | 大批次热启动延迟与用户进度体感 | 中 | 分解计时 `scan cache -> preparation reserve/validate/report -> stage update`，避免重复读取 21MB manifest 和已提交大型产物；输出 `prepare.started/completed` 的 duration/cacheHit/snapshotRef。验收：同批次同配置连续 3 次的资料预处理 P95 < 5s | 活跃 | 2026-08-07 |
| RISK-TRAIN-8053-005 | 冷启动任务 `training_ca4bde5bb7ae453e` 在资料预处理实际持续转换资源，50 秒内 staging 从 36MB 增长到 83MB、内部 preparation `events.jsonl` 已有 2,290 条事件；但公开 task API 和 logs API 仍停在扫描完成的 `current=10873,total=10873`，`offset=5` 后无新事件 | 用户看到资料预处理 100% 但长时间无变化，无法区分正在转换与卡死；长任务取消和定位也缺少资源级边界 | 高 | 将 preparation 的资源事件按数量/时间节流汇总到父 training task，阶段进度必须分离 `scan` 与 `prepare` 子操作，不得在转换尚未完成时显示阶段 100%。验收：冷启动每最多 5 秒或每 50 个资源至少产生一次公开进度，包含 operation/current/total/succeeded/failed/skipped；前端能区分扫描完成和转换进行中 | 活跃 | 2026-08-07 |
| RISK-TRAIN-8053-006 | 冷启动任务 `training_ca4bde5bb7ae453e` 进入元数据构建后，为 13,023 个 embedding 执行全量两两余弦比较；`EmbeddingClusterService.build()` 的双层循环需要 84,792,753 次 64 维向量比较。现场微基准约 122,652 对/秒，预计纯聚类约 691 秒；单个 Python 工作线程持续占用单核，且父任务没有聚类进度 | 8,000+ 文档元数据阶段会额外运行约 12 分钟，用户界面长期显示 `current=0,total=null`；文档规模翻倍时耗时约增至四倍，取消检查也无法及时生效 | 严重 | 聚类改为有界候选召回后再做精确余弦，复杂度从 O(N^2) 降为近似 O(N log N) 或 O(N*k)；不引入新依赖时可按稳定签名/桶分组生成候选，并为每个 embedding 限制候选上限。候选循环必须传播取消检查并每 1 秒或 1000 个候选上卷进度。验收：13,023 条输入在固定硬件 5 分钟内完成，峰值内存可控，结果确定性、阈值语义和小样本精确结果保持一致 | 活跃 | 2026-08-07 |
| RISK-TRAIN-8053-007 | 冷启动任务 `training_ca4bde5bb7ae453e` 的规则知识提取按约 10,100 个资源、13,244 个处理单元循环执行 `_deterministic_keyword_candidates()`，循环内没有取消检查或阶段进度更新；公开任务持续显示 `current=0,total=13244` | 用户无法区分规则抽取正在计算还是卡死；取消只能等整个资源循环结束，8000+ 文档止损不及时 | 高 | 在资源循环前后传播 `_raise_if_cancelled()`，按处理单元累计 `current/succeeded/failed/skipped`，每 1 秒或 50 个资源节流上卷到 `knowledge_extraction`，终点强制更新；不改变关键词提取规则和结果。验收：冷启动最多 5 秒出现一次可见进度，取消 3 秒内进入终态，产物哈希与修复前一致 | 活跃 | 2026-08-07 |
| RISK-OUTLINE-001 | Markdown 标题层级不等于领域语义，叶子 H1/H2 无法确定是章节还是知识点 | P1-P4 映射正确性和生成粒度 | 高 | 所有歧义进入未决映射，保留原行号和摘要，未经用户确认不允许静默提升或落库 | 活跃 | 2026-08-17 |
| RISK-OUTLINE-002 | P2 会扩展正式解析契约并将 0 知识点由成功改为失败，可能影响旧客户端 | 上传 API 兼容性 | 高 | 实施前进行人类审批，提供稳定错误码、弃用说明、黄金样本回归和配置化灰度/回退策略 | 活跃 | 2026-08-17 |
| RISK-OUTLINE-003 | P4/P5 涉及新预检 API、令牌安全、评分门禁与运营指标，未评审可造成资源滥用、误拦截或隐私风险 | P4-P5 产品化闭环 | 高 | 分别完成 API/安全/阈值审批；预检会话限额与 TTL 配置化；评分先影子运行，证据脱敏，达到误报基线后再启用门禁 | 活跃 | 2026-08-17 |
| RISK-KGO-007 | Office/PDF 等非结构化来源无法由标准化文本偏移反推真实页码 | REQ-KGO-32 原文核验 | 中 | 当前明确降级为章节/文档定位并提供打开原文、下载；OCR/页码坐标另行审批 | 活跃 | 2026-08-17 |
| RISK-RAG-LIN-001 | 旧 `source:{datasetId}:{contentHash}` 会在重复正文上碰撞；G-LIN-01 已用 `datasetId+resourceId+contentHash` 和 Schema 2.0 完成组件修复，v1 歧义清单保持发布阻断，但真实 10,100 文档尚未通过 training API/生产治理包回放验证 | RG-17/19/24 生产接线、8,000+ 文档 | 严重 | PL-B01—B06 已通过；继续以真实重复来源验证 occurrence 数和父链，先隔离 2,027 个错误信封，再接生产治理包和发布重验；不得通过迁移物理路径绕过 | 部分缓解 | 2026-08-18 |
| RISK-RAG-LIN-002 | 真实 55,324 条 legacy keyword candidates 缺少可验证的 `schemaVersion/extractorVersion`；审计已证明目标 run `RECOVERABLE=0`、`ISOLATE=55,324`，公共触发尚未接入前业务结果仍不能安全恢复 | keyword lineage、证据门禁、引用回放 | 严重 | `2A+2C` 已确认；2A 规则快照、显式版本证据、legacy resolver 和 2C 内核已实现，专项 9/9 通过；继续保持旧产物只读，待公共 API 与真实回归后才声明业务恢复 | 部分缓解 | 2026-08-18 |
| RISK-RAG-LIN-003 | 组件层已隔离非对象 evidence、全量校验 issues JSONL 并阻止 normalized symlink/path 逃逸，但 keyword/formal 模式边界及真实训练/发布 API 尚未接入 | 数据完整性、路径安全、错误发布 | 高 | 已选择 G-LIN-04/4A，实施模式不变量；以真实 FastAPI 回归证明任一治理文件损坏、路径逃逸和错误模式均 fail-closed | 部分缓解 | 2026-08-18 |
| RISK-RAG-LIN-004 | run 与 dataset 两次目录 rename 不具备跨目录事务；rename 后父目录 fsync 失败还会出现“返回失败但正式目录存在” | 治理包权威性、重试和发布门禁 | 高 | 已选择 G-LIN-03/3A：dataset 为唯一发布权威、run 为可重建镜像；按 fingerprint 幂等确认已有完整包并增加崩溃恢复测试 | mitigation-planned | 2026-08-18 |
| RISK-RAG-LIN-005 | overlap 父引用和 producer ID 唯一性已完成组件回归，但 offset 单位及 graph/index 排序尚未形成跨语言稳定契约 | 引用正确性、JS/Python 回放、版本指纹稳定性 | 中 | 已选择 G-LIN-04/4A：声明 `unicode_code_point`；按组件语义规范化 graph/index 输入并覆盖非 BMP 字符与真实前端回放 | 部分缓解 | 2026-08-18 |
| RISK-RAG-LIN-006 | 2,027 个上游 JSON 权限错误信封被 preparation 标记为成功，并已生成 2,027 chunks/candidates/graph edges；污染边 evidence offset 全为 `-1/-1` | 输入质量、关键词图谱、Lineage 和发布门禁 | 严重 | 在 preparation 边界解析配置化 provider error envelope，逐 occurrence 写脱敏质量问题并隔离；正常正文含 `400402` 不得误判；真实快照回放要求污染计数为 0 | 活跃 | 2026-08-18 |
| RISK-RAG-GS-001 | GraphStore 本地前置 6/10 和 42/42 回归绿色可能被误解为 M8、GraphRAG 或外部图数据库已完成 | 项目决策、发布与验收口径 | 高 | 所有看板仅标记“本地前置 6/10”；API、ACL、隔离 formal 验收和外部 Adapter 未完成前，M8 保持 deferred/blocked | 活跃 | 2026-08-19 |
| RISK-RAG-GS-002 | LocalGraphStore 当前为本地兼容层，大规模整图加载的内存、延迟和并发容量尚无 S/M/L 基线 | 大图查询、投影恢复与进程稳定性 | 高 | 公共 API 接线前增加 S/M/L 容量和故障注入验收，记录峰值内存、P95 延迟、恢复时间和超限拒绝语义 | 活跃 | 2026-08-19 |
| RISK-RAG-GS-003 | 外部图数据库厂商、驱动、部署、凭据、容量、备份和灾备策略未决 | 外部 Adapter 与生产运维 | 高 | 维持 Adapter 契约边界；通过 G1 选型和 G4 生产审批后再引入驱动、隔离部署和备份/回滚演练 | 活跃 | 2026-08-19 |

## 已解决风险

| 编号 | 风险描述 | 解决方案 | 解决日期 |
|------|---------|---------|---------|
| RISK-RAG-GS-P0-001 | GraphStore 独立验收发现 5 个 P0 | 完成修复并通过 9 项组合测试；最终 contract/local/projection/integration/GraphVersion API 联合回归 42/42，`py_compile` 与 scoped diff-check 通过 | 2026-08-19 |

## 阻塞项

| 编号 | 阻塞描述 | 阻塞任务 | 依赖条件 | 预计解除 | 状态 |
|------|---------|---------|---------|---------|------|
| BLOCK-RAG-LIN-001 | production lineage 组件尚不能接入生产门禁；G-LIN-01、G-LIN-02/2A 和 2C 内核已完成，但公共 API、治理包和 publish 验证未接 | TASK-RAG-KG-M2-LINEAGE-REWORK-01、INT-02/03/04、RG-25 | 已选 G-LIN-02-API/API-A、G-LIN-03/3A、G-LIN-04/4A；完成真实训练出口、错误信封隔离、治理包接线、旧产物不变和发布重验 | 实施后 3 个工作日 | unblocked-for-implementation |
| BLOCK-RAG-ACL-001 | G2-03 推荐架构已选定，但可信网关参数和隔离测试身份尚未提供 | RG-20、RG-23、RG-25 | 提供 issuer、audience、JWKS URI、claims、网关信任边界和隔离测试身份 | 待外部事实 | blocked-by-environment |
| BLOCK-RAG-GS-001 | GraphStore 公共 API、可信 ACL 与隔离 formal 整体验收未接入 | GS-API-TST-01、GS-API-BE-01、GS-ACC-01、GS-RPT-01 | 先完成 RG-20/23 并通过 G2.5；提供可信身份参数、隔离身份、隔离 formal 数据集及写入许可 | 待 M2 和外部事实 | blocked-by-dependency |

---

**更新规则**：
- Worker 遇到阻塞时，立即在此文件添加条目
- 风险严重程度：高（阻塞多个任务）/ 中（影响单任务）/ 低（可绕过）
- 已解决的风险移动到「已解决风险」表格
