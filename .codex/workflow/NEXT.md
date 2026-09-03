# 下一步计划

> 自动更新: 2026-08-20 CST

## 知识平台技术领导汇报

1. 执行 `TASK-KP-BRIEF-DOC-01`：在 `agent-runner/docs/overview/知识平台工程化技术汇报.md` 形成 3000-4000 字中文初稿，并同步目录索引。
2. 初稿完成后执行 `TASK-KP-BRIEF-REV-01`：独立只读核对需求覆盖、数学类比边界、哈希锚点和人工决策权；无批准 `policyRef`，审查只给建议结论。
3. 最后执行 `TASK-KP-BRIEF-DOC-02`：处理必须修订项，完成字数、结构、图表、指定话术与 `git diff --check` 验收。
4. 三项任务严格串行；两次 Doc Writer 编辑同一正文，Independent Reviewer 仅拥有独立审查报告，禁止并发覆盖。

## 周期文档对账 Skill

1. 用户确认 `.codex/workflow/audits/documentation/20260817T114133Z-8843218aac10` 中的初始基线、未映射变化和启动前脏文件重叠问题；未确认前不推进 `.codex/context/reconcile-docs/checkpoint.json`。
2. 后续合并后执行 `refresh`，每周执行 `audit --mode incremental`，发布前执行 `audit --mode full`；公共契约或模块边界变化时立即专项审计。
3. 仅在人工确认、文档修改完成且 `validate` 通过后执行 `checkpoint --confirmed`；失败运行保留原基线。
4. 项目映射和排除项维护在 `.codex/config/doc-governance.json`，不把路径规则写入 Skill 代码。

## HTML 文档原生预览

TASK-DOC-HTML-PREVIEW-01 已完成：HTML/HTM 文档通过注册根目录 raw 路由和 sandbox iframe 原生展示；Markdown 保持原渲染。后续部署需重启 4100 后端进程加载新路由，并在 3500 页面验证目标文档和相对导航。

## 知识图谱可观测性与治理

REQ-29、REQ-30、REQ-31、REQ-32 和模块 Epic 已全部完成。后续仅保留用户验收和新需求入口，不在本轮继续扩展发布语义。

1. 使用当前页面验收质量概览、问题诊断、正式版本、趋势、diff、warning 和局部图。
2. 若后续启用阻断式发布门禁、版本删除/回滚/保留策略或新图引擎，必须新建需求并重新完成架构审批。
3. `batch_dc23fc9141ba4d6f` 继续保持只读；正式版本写入验收仍只使用隔离数据。
4. 原文核验已支持稳定资源下钻；Office/PDF 的精确页码映射、OCR 和历史源修复另行立项，不在本轮假设已解决。

对已完成的 REQ-29 至原“证据原文下钻”REQ-32 范围，当前无阻塞性待确认项。新 RAG 路线图的 G0 七项决策已确认；图数据库最终厂商、部署/容量和外部依赖仍需 G1/G4 审批。

## 成熟 RAG 知识图谱缺口审查

`TASK-RAG-KG-ROADMAP-01` 已将 `REQ-KGO-33` 的缺口按风险降低顺序排到 P0/P1/P2，并新增 `REQ-KGO-34` 图数据库知识库存储与 GraphRAG 扩展。RG-02 发现的图谱/文件入口 ACL 缺口仍是 P0 阻断；M1 契约设计已完成并进入 review，尚未完成 G2 联合签核。

项目经理使用 [RAG 项目经理任务清单](modules/知识图谱可观测性与治理模块优化进展/RAG项目经理任务清单.md) 作为状态单一入口；任务状态、门禁、风险和验收证据必须先更新清单，再同步本看板。

1. RG-01 已完成：确认部分小批次存在 `knowledgeCount=0` 但 `publishable=true` 的状态缺口。
2. RG-02 已完成核验并发现 P0 ACL 风险：图谱、证据和文件入口未统一执行 Authorization/数据集权限校验；需要安全和产品确认部署边界。
3. RG-04 已完成：Graph/Vector Store ADR 已提交，当前继续使用 JSON/本地实现，不引入外部依赖。
4. RG-17/18/19/21/22/24 仍只完成组件/注入式限定范围。G-LIN-01 的 Source occurrence、Schema 2.0 新写、v1 只读/回放及歧义发布阻断已经组件化实现；G-LIN-02/2A 的规则快照、显式版本证据、legacy resolver，以及 2C 冻结输入重建内核和 API-A 基础触发也已实现。API 隔离验收 2/2、组合回归 124/124 通过，但不包含生产 governance package 或 publish 验证，不得标记为端到端完成。
5. G-LIN-02 已确认 `2A+2C`。当前先完成 2A 组件证据收口：新 candidate 的 `extractorVersion/extractorSnapshotRef` 覆盖率 100%，目标 legacy 按 `RECOVERABLE=0`/`ISOLATE=55,324` 可定位隔离，不从当前配置推断历史版本。
6. 2C 内核、请求时冻结适配和 API-A 基础公共行为已完成：规则快照与 candidate 同 run 原子提交，legacy dataset 通过 `KeywordRebuildInputFreezer` 生成独立 `rebuild-input` 包，且不读取 `latest`。按 2026-08-18 常设推荐方案授权，`G-LIN-02-API=API-A`、`G-LIN-03=3A`、`G-LIN-04=4A` 已落定；下一步收敛性能内存门禁并补齐 API 扩展错误/并发回归。现有物理路径布局保持不变。
7. G2-03 已选择可信网关 JWT、本地验签、dataset ACL、deny 优先和脱敏审计。实现前仍需获取 issuer、audience、JWKS URI、claims、网关信任边界和 RG-23 隔离测试身份；这些是外部事实，不使用推测值替代。
8. 先实施 production lineage 接线；安全参数齐备后实施 RG-20，再执行 RG-23 越权回归与 RG-24 生产回放。错误发布、越权成功和不可回放均为 0 后才能恢复 RG-25 G2.5 联合签核。
9. G2.5 通过前不启动 M3，不接入 M8 公共 API 或外部图数据库；已完成的 GraphStore 本地前置 6/10 项仅作为存储无关内核，不代表 RG-61—RG-70 或 GraphRAG 完成。
10. P0 计划 09-18 完成隔离发布和回滚验收，P1 计划 10-02 完成准确性、增量和性能硬化；人类审批或外部资源等待不计入上述工期。

## M8 GraphStore 解阻顺序

GraphStore 本地契约、LocalGraphStore、write-run/outbox 和异步投影内核已完成，最终联合回归 42/42 通过。后续仅按以下顺序推进：

1. 先完成 RG-20/23，并使 M2 G2.5 获得合格证据。
2. 获取可信身份参数、隔离测试身份、隔离 formal 数据集及明确的写入许可。
3. 解阻后严格执行 `GS-API-TST-01 -> GS-API-BE-01 -> GS-ACC-01 -> GS-RPT-01`。
4. 未通过 G1/G4 前，不自动安装图数据库驱动、不连接外部图数据库、不修改公共 API，不申请生产写权限。

## 管理员手册大纲兼容

1. 执行 `TASK-OUTLINE-EVOLUTION-P1`：保持原始大纲不变，生成规范副本、逐项映射报告和未决项清单，再用真实后端 API 验证 `kp_count > 0`、评分不低于 80。
2. P1 验收后请求审批 P2：将 `# / ## / ###` 标题树纳入正式解析契约，并将“成功但 0 知识点”改为不落库的结构化失败；通过后执行 P2/P3。
3. P3 验收后请求审批 P4：新增无落库预检、结构差异和确认上传 API/中文界面；通过后执行 P4/P5。
4. 全部阶段按 P1 → P5 串行通过里程碑，预计实施关键路径为 10 个工作日，不含人类审批和领域歧义复核等待时间。

模块需求、实施计划和当前进度分别见 `.codex/requirements/modules/outline-management/` 与 `.codex/workflow/modules/outline-management/`；概要及 P1-P5 开发设计见 `agent-runner/docs/modules/outline-management/`。项目管理与架构设计角色分别见 `.codex/roles/project-manager.md` 和 `.codex/roles/architect.md`。

## 文档模块化归档

1. 按 `agent-runner/docs/MIGRATION-MAP.md` 逐模块迁移，不再向 `agent-runner/docs/` 根目录新增平铺设计文档。
2. 下一批优先处理 `material-processing` 与 `knowledge-retrieval`，先对齐根目录 `docs/` 的现行知识加工架构，再拆分概要、开发设计、需求、进度和测试证据。
3. 后续依次处理 `generation-workflow`、`document-management`、`workbench-shell` 和 `platform-foundation`；每个模块单独建立任务卡并执行链接、状态和实现一致性验收。
4. 混合文档必须先拆分单一事实源，不允许仅移动文件或保留两份可编辑正文后标记完成。

## 大纲上传规格与评分基线

1. 先执行 `TASK-UPLOAD-SPEC-01`：以 `agent-runner` 大纲上传链路为唯一事实主线，区分 `.json/.md/.csv` 的实现约束、推荐规范与暂不支持项，并明确其与 PingCode 素材分片上传的边界。
2. 完成输入输出契约后，执行 `TASK-UPLOAD-SPEC-02`：补充可计算的评分维度、阻断项、证据字段和修改建议输出契约。
3. `TASK-UPLOAD-SPEC-03` 可在 TASK-UPLOAD-SPEC-01 后并行设计样例与真实 API 验收矩阵，最终与 TASK-UPLOAD-SPEC-02 的评分字段对齐。

本轮只产出设计规格与测试设计，不修改公共 API、不引入依赖，也不将推荐质量规则误写为当前上传接口的强制校验。

## 质量分析三项治理能力：已完成，等待用户验收

`TASK-KQF-REQ-26 -> TASK-KQF-REQ-27 -> TASK-KQF-REQ-28` 已严格按顺序完成，AUD-01 至 AUD-04、REV-01 至 REV-03、INS-01 至 INS-03 全部验收通过。

`TASK-KQF-GOV-01` 已完成。当前不启动新的关键词过滤功能开发；等待用户对历史审计、人工复核、问题总览与证据下钻进行界面验收，并按明确反馈建立新任务。

已完成的交付基线：需求 26–28 组合回归 36/36，前端生产构建通过；AUD 详情/列表 P95 为 62.87ms/3.59ms，REV 汇总/PATCH 100 条 P95 为 6.47ms/40.59ms，INS 总览/证据 P95 为 21.52ms/40.43ms。

目标业务批次 `batch_dc23fc9141ba4d6f` 保持只读，所有写入型验收均使用隔离数据集。一次不可重复的 I/O 调度抖动在复跑后恢复正常，作为非阻塞环境说明保留，不触发功能修改。

## 已完成基线：关键词过滤前端易用性优化

- `TASK-KQF-01` 至 `TASK-KQF-04` 已完成，批量全量决策、完整性口径、前端进度和真实只读 API 基线可复用。
- 第一阶段并行执行 `TASK-KQF-UX-01` 与 `TASK-KQF-UX-02`：前者实现配置驱动的排除类别及后端事件契约，后者实现关键词展示、50/100 分页、全局搜索与组合筛选。
- 第二阶段执行 `TASK-KQF-UX-03`：用 643 条 fixture 验证跨页全局搜索、类别聚合、历史兼容和完整集合应用，并真实调用后端 API/SSE。
- 第三阶段执行 `TASK-KQF-UX-04`：将修改功能点与最终执行效果按中文表格同步到 docs/24、docs/25。
- 已确认的处理顺序为“完整决策集合 -> 动作筛选 -> 类别筛选 -> 关键词全局搜索 -> 分页”，搜索绝不局限当前页。
- 目标批次 `batch_dc23fc9141ba4d6f` 继续只读核对；任何 `filter-apply` 写入仅允许隔离 fixture。
- 本轮不新增依赖、不改变公共 apply 动作契约，也不涉及架构、安全或性能策略决策，无需再次人工确认。

## Phase 0-2 状态

- `TASK-TSR-P0-01`、`TASK-TSR-P1-01`、`TASK-TSR-P2-01`、`TASK-TSR-P2-02` 均已完成。
- Phase 2 结论为有条件通过：聚焦回归 92/92 通过，真实只读 API 验收通过，真实 apply 未执行。

## 已完成

### 关键词过滤状态收敛

已按以下顺序完成：

1. `TASK-KFS-01`：统一 `admissionStatus` 状态源、统计不变量和过滤后图谱投影。
2. `TASK-KFS-02`：删除业务三态、L2 和质量分析页专用质量评价公共 API。
3. `TASK-KFS-03`：删除对应前端入口，保留关键词过滤与过滤前后图谱。
4. `TASK-KFS-04`：完成自动化契约回归。
5. `TASK-KFS-05` 与 `TASK-KFS-06`：实现稳定后并行执行隔离数据验收和文档同步。
6. `TASK-KFS-07`：汇总进展和风险。

已确认并执行的破坏性边界：

- 图谱查询默认展示 admitted 投影，完整审计图只保留在产物文件中。
- 删除业务三态、L2、质量报告和训练质量问题公共 API，不提供兼容别名。
- 保留训练内部质量审计、证据校验和 Dataset 历史兼容字段。
- `batch_47c5cdb5dec744a1` 只做只读核对；所有 apply 验收使用隔离 fixture。

## 后续整改建议

| 优先级 | 建议项 | 目标 |
|--------|--------|------|
| P1 | 统一 SSE 与非流式模型选择 | 移除 `deepseek-v4-flash-0731` 硬编码，保证同输入使用可审计的同一模型配置 |
| P1 | 截断并脱敏远端错误正文 | 避免 HTTP/SSE 异常泄露密钥、提示词或大段上游响应 |
| P2 | 修复两项范围外全量测试失败 | 恢复后端 223 项全量测试全绿，并治理 asyncio 资源告警 |
| P2 | 在隔离数据集执行真实 apply | 验证审批状态持久化、摘要更新和不重建索引行为 |

## 待人类确认：主页知识提取规则化

- `TASK-RKE-01` 已完成拆解，发现 `deterministic_extraction` 名称与实际行为不一致：当前先检查模型网关，再执行 Workflow Agent 的 `knowledge-point-extraction` 模型调用；上游 HTTP 502 会被前端展示为模型服务不可用。
- 建议将主页知识提取阶段改为纯规则提取，保留知识点候选、关键词上下文、逐字证据、取消和进度契约，模型调用固定为零；规则无法确认的项写中文质量问题。
- 此项改变 `formal_knowledge` 的既有模型 Agent 架构与 `docs/12` 已发布契约，属于架构决策，必须在实施前获得人类确认。确认后按“设计文档和伪代码 -> 后端实现 -> 自动化及真实后端 API 验收 -> 前端构建/页面核验”执行。

## 已完成：默认关键词加工免模型门禁

- `TASK-RKE-02` 已完成。本次 502 的直接修复已使默认 `keyword_analysis` 预检和启动不访问模型测试或模型状态；真实 API 预检返回 HTTP 200、`totalModelCalls=0`、`modelTestPassed=null`、`canStart=true`。隔离任务 `training_044352a1274f4420` 的三个公开阶段均已完成，模型调用为零。
- `formal_knowledge` 的模型测试门禁保持不变；后端 69 项聚焦测试和前端构建均通过。

## 已完成：部分下载资料加工

- `TASK-DIR-01` 已完成：仅当下载任务为 `interrupted`、`canResume=true` 且 `completed>0` 时，主页允许按已完成资料开始知识加工，并持续显示未完成项可续传的中文告警；其他下载中断/失败/暂停及额外活动任务保持阻断，知识加工不改变下载账本或续传状态。
- `DeterministicPipelineTests` 12 项通过，前端 `npm run build` 通过；真实批次 `_require_batch_ready` 放行验证通过。

## 已完成：产物不可变快照与并发修复

- P0-01 至 P1-01 已完成：不可变快照、两阶段发布、single-flight、generation CAS、显式 lineage、跨进程 state 锁、损坏隔离和错误分类均已落地。
- 隔离真实 API 并发启动返回 `202/409`，规则任务完成，模型调用为零，preparation/metadata 快照引用完整。
- admission/latest 锁 P95 为 0.0401ms；100 并发 committed reader 一致。
- 后续仅保留固定环境的大规模 5% 性能回退基线和遗留 single-flight/staging 租约回收，不阻断本次核心修复。

## 后续整改

### training_b1a74bb90a554b17 四阶段加工验证

1. 先执行 `TASK-TASKRUN-B1A74-01` 的 B1A74-01：只读采集 `training_b1a74bb90a554b17` 的 cancelled 终态、日志、事件和产物基线。
2. 再执行 B1A74-02：基于已确认 admission ready 的批次，通过真实后端 API 启动新的加工任务，记录 taskId 和四阶段初始状态。
3. 若真实任务失败或卡住，执行 B1A74-03 做最小后端修复；证据不足时先补日志和定向测试，不直接改业务行为。
4. 修复后执行 B1A74-04：后端语法检查、训练服务回归和真实后端 API 冒烟。
5. 后端稳定后执行 B1A74-05：前端四阶段页面启动、展示和构建验证。
6. 最后执行 B1A74-06：对新启动任务做每 30 秒采样的长任务跟踪。

需人类确认：是否允许基于 admission ready 的批次创建新的真实训练任务做长任务验证；若根因要求删除历史兼容映射或改变 `formal_knowledge` 模型边界，必须先确认。

### Draw.io 知识加工流水线图纸

1. 先完成 `TASK-DIAGRAM-ARCH-01`：在一个 Draw.io 文件中建立架构图页面，冻结六阶段、控制面、产物和模型边界。
2. 再完成 `TASK-DIAGRAM-FLOW-01`：复用架构图命名，补充快照复用、轻量扫描、质量隔离、取消和失败分类分支。
3. 最后完成 `TASK-DIAGRAM-VERIFY-01`：执行 XML/可视一致性验收并记录偏差。

图纸只表达当前设计和已验证实现；如需新增组件、改变阶段职责或改变用户可见状态，必须先单独确认架构决策。

- 本次方案 A 已在隔离上传批次完成扫描、报告恢复、轻量预检和规则加工真实 API 验收；YASDOC 大批次仅执行轻量预检，未创建真实加工任务。
- 全量后端测试仍需单独修复既有结构分块测试失败，不属于本次异步扫描范围。
- 不触碰 Agent Runner、前端、模型配置、运行数据及其他现有脏工作区修改。
- 以上整改不计入本次任务，后续实施前单独确认。

## 范围保护

- 本轮未修改 Agent Runner、无关页面或运行数据；真实批次未执行写入型 `filter-apply`。
- 只删除质量分析公共业务、L2、质量评价接口与页面入口，保留内部质量审计、证据校验和发布门禁。
- 相关代码未提交。

---

**更新规则**：
- Planner 拆解任务后更新此文件
- 任务从 pending → in_progress 时从此文件移除
- 新依赖解除时，将任务移入「已就绪可并行」
