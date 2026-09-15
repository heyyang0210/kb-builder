# 项目进度看板

## 模板管理改造（项目计划初始化）

- 任务总览：`.codex/workflow/tasks/TASK-TEMPLATE-EPIC.md`
- P1：`verified`；P2：`verified`（P2 独立 API 8/8，前端工作台测试及隔离浏览器验证通过）；P3：`verified-with-boundary`（生成冻结 6/6、模板回归 22/22、浏览器回归通过、初始化 dry-run 7 项；真实共享 HTTP 与数据库迁移未执行，详见残余风险）。分别覆盖 T1-T3、T4-T7、T8-T10。
- 已新增 `database-architect` 角色；当前为开发测试环境，数据库迁移暂不作为阻断门禁。

> 自动更新: 2026-09-14 CST

### 模板管理阶段门禁（2026-09-14）

- P1 判定：已完成，状态更新为 `verified`。
- 已通过：`node --test tests/unit/agent-runner/template-p1.test.js tests/unit/agent-runner/database-config.test.js`，12/12；Python 配置测试 2/2；Node/Shell 静态检查和 `git diff --check`。
- 真实证据：隔离脚本重启后认证服务实际监听 `14200`；管理员登录、未登录 401、数据库模式列表/创建/保存/详情/版本读取、SHA-256、过期版本 409、独立 `TEMPLATE_EDITOR` 权限闭环均通过；测试聚合已清理。
- 放行决策：P1 满足真实后端 API 和独立验收门禁，允许按任务依赖进入 P2；P3 仍需等待 P2。

## 📊 总览

- 质量分析三项治理需求：3/3 个父任务完成，10/10 个 AUD/REV/INS 子任务完成
- 收尾任务：`TASK-KQF-GOV-01` 已完成；阻塞: 0
- 知识图谱可观测性与治理：4/4 份设计、4/4 个需求、18/18 个 Worker 子任务全部验收
- 管理员手册大纲兼容：Epic、项目管理与架构角色、P1-P5 任务卡及 6 份设计文档已完成；P1 待实施，P2/P4 待人类审批
- 文档模块化归档：7 个 moduleId 与四类文档分层已冻结；`outline-management` 试点归档完成，其余模块按迁移映射逐项推进
- 周期文档对账 Skill：设计、初始化、Git 上下文、三方对账、验证门禁、自测和独立前向测试已完成；真实仓库首次审计仍等待基线、未映射变化和脏工作区重叠确认
- RAG M2 安全发布：G-LIN-01 Source/Schema 组件、G-LIN-02/2A+2C 内核、请求时冻结、API-A 接线和生产出口治理包 helper 已实现；API-A 真实路由 7/7、生产出口治理包 fixture 1/1 通过；性能内存门禁、正式生产批次治理包、publish 验证及 ACL 实现仍未完成，G2.5 未通过
- M8 GraphStore 本地前置：6/10 项完成、4/10 项阻塞；最终联合回归 42/42 通过。M8 整体、GraphRAG、公共 API 和外部图数据库仍未完成
- 知识平台技术领导汇报：已拆分初稿、独立质询、定稿 3 个串行任务；正文尚未开始

## ✅ 已完成

- [TASK-DOC-RECONCILIATION] 构建周期文档对账 Skill — Planner/Architect/Backend Worker/Test Engineer — 核心实现和临时 Git 自测完成，真实仓库审计未推进检查点

- [TASK-DOC-ARCHIVE-01] 建立模块化文档架构并完成大纲管理四层归档 — Planner/Architect/Project Manager/Doc Writer — 验收完成
- [TASK-TSR-P0-01] 恢复 TrainingService 可编译基线 — backend-worker — 验收完成
- [TASK-TSR-P1-01] 完成重构设计与特征测试基线 — doc-writer — 验收完成
- [TASK-TSR-P2-01] 提取 Model Gateway 服务 — backend-worker — 验收完成
- [TASK-TSR-P2-02] 提取产物仓储并完成验证 — backend-worker/test-engineer — 有条件通过
- [TASK-KFS-01] 统一关键词状态源与图谱投影 — backend-worker/test-engineer — 验收完成
- [TASK-KFS-02] 删除业务三态、质量评价与 L2 后端接口 — backend-worker/test-engineer — 验收完成
- [TASK-KFS-03] 收敛质量分析前端为关键词过滤视图 — frontend-worker — 构建与浏览器验收完成
- [TASK-KFS-04] 建立状态一致性与删除契约自动化测试 — test-engineer — 验收完成
- [TASK-KFS-05] 执行隔离数据验收与页面验证 — test-engineer — 真实只读验收完成
- [TASK-KFS-06] 同步关键词过滤与图谱设计文档 — doc-writer — 同步完成
- [TASK-KFS-07] 汇总状态收敛任务进展与风险 — reporter — 汇总完成
- [TASK-RKE-02] keyword_analysis 免模型预检与启动 — backend-worker/frontend-worker/test-engineer/doc-writer — 验收完成
- [TASK-DIR-01] 允许已部分完成的中断下载进入知识加工 — backend-worker/frontend-worker/test-engineer/doc-writer — 完成（真实 API 部分验证）
- [TASK-SAP-01] 大批次扫描与知识加工启动可观察性修复 — 单 Agent — 完成（隔离真实 API 验证）
- [TASK-BUG-JSON-RACE-01] 知识加工产物并发竞争与错误隔离修复 — 多角色 — 核心真实 API 验证完成
- [TASK-BUG-JSON-RACE-P0-01] 冻结快照与协调接口契约 — doc-writer/backend-worker — 完成
- [TASK-BUG-JSON-RACE-P0-02] 实现原子仓储与批次协调器 — backend-worker — 完成
- [TASK-BUG-JSON-RACE-P0-03] 将资料准备改为不可变两阶段快照 — backend-worker — 完成
- [TASK-BUG-JSON-RACE-P0-04] 实现已提交快照读取与损坏隔离 — backend-worker/test-engineer — 完成
- [TASK-BUG-JSON-RACE-P0-05] 元数据构建显式消费准备快照 — backend-worker — 完成
- [TASK-BUG-JSON-RACE-P0-06] 接通训练快照链路与原子准入 — backend-worker — 完成
- [TASK-BUG-JSON-RACE-P1-01] 并发故障注入与真实 API 验收 — test-engineer/doc-writer/reporter — 核心验收完成
- [TASK-KQF-04] 643/78 关键词过滤根因与修改方案文档 — doc-writer — 文档完成
- [TASK-KQF-01] 关键词过滤全量决策与后端口径修复 — backend-worker — 聚焦测试与真实只读 API 验收完成
- [TASK-KQF-02] 关键词过滤前端进度与结果口径修复 — frontend-worker — 构建验收完成
- [TASK-KQF-03] 关键词过滤真实 API 与回归验收 — test-engineer — 后端 8 项与前端构建通过
- [TASK-KQF-REQ-26] 关键词过滤决策审计与历史记录 — 多角色 — AUD-01 至 AUD-04 已验收
- [TASK-KQF-AUD-01] 建立过滤运行仓储与版本快照 — backend-worker — 643 条快照、CAS 和并发验证通过
- [TASK-KQF-AUD-02] 接入过滤运行 API 与审计执行链 — backend-worker — 创建/SSE/历史/diff/apply 通过
- [TASK-KQF-AUD-03] 实现过滤历史与运行对比界面 — frontend-worker — 刷新恢复、对比和构建通过
- [TASK-KQF-AUD-04] 验收过滤审计和历史记录 — test-engineer — 组合回归通过；643 条详情 P95 62.87ms、历史列表 P95 3.59ms
- [TASK-KQF-REQ-27] 关键词过滤人工调整与问题类别一致性 — 多角色 — REV-01 至 REV-03 已验收
- [TASK-KQF-REV-01] 实现人工复核一致性后端契约 — backend-worker — 冻结类别、CAS、事务日志完成
- [TASK-KQF-REV-02] 实现明确人工复核交互 — frontend-worker — 明确控件、自动保存和冲突处理完成
- [TASK-KQF-REV-03] 验收人工复核状态机 — test-engineer — 643 条汇总 P95 6.47ms、PATCH 100 条 P95 40.59ms
- [TASK-KQF-REQ-28] 文档共性问题总览与证据下钻 — 多角色 — INS-01 至 INS-03 已验收
- [TASK-KQF-INS-01] 实现共性问题聚合与证据查询 API — backend-worker — 全局筛选、聚合和证据索引完成
- [TASK-KQF-INS-02] 实现问题总览和证据下钻界面 — frontend-worker — 中文总览、桌面抽屉、移动全宽和 URL 恢复完成
- [TASK-KQF-INS-03] 验收共性问题和证据关联 — test-engineer — 需求 26–28 组合回归 36/36；总览 P95 21.52ms、证据 P95 40.43ms
- [TASK-KQF-GOV-01] 汇总三项需求实施证据 — reporter/doc-writer — 文档、看板、风险和周报已收口
- [TASK-DOC-HTML-PREVIEW-01] HTML 文档原生预览与受控资源访问 — doc-writer/backend-worker/frontend-worker/test-engineer — 设计、实现和真实 API 验收完成
- [TASK-KGO-REQ-29] 知识图谱质量概览与局部可视化 — 多角色 — 4/4 子任务验收，真实 API、性能、桌面/移动验证通过
- [TASK-KGO-REQ-30] 知识图谱问题诊断与证据联动 — 多角色 — 5/5 子任务验收，探索 5/5、组合回归 16/16、前端构建和只读页面验证通过
- [TASK-KGO-REQ-31] 知识图谱版本治理与质量运营 — 多角色 — 5/5 子任务验收，25/25 组合回归、生产构建和桌面/移动验证通过
- [TASK-KGO-MOD-01] 知识图谱可观测性与治理模块统筹 — planner/reporter — REQ-29 至 REQ-31、看板、性能、界面和范围保护证据已收口
- [TASK-KGO-REQ-32] 证据原文下钻与人工核验 — backend/frontend/test/reporter — 五状态来源诊断、原文定位、高亮预览和桌面/移动验收完成
- [TASK-RAG-KG-RG17/18/19/21/22/24] M2 指纹、门禁、治理 UI 与契约/回放 — 多角色 — 组件/注入式限定范围验收完成；不得解释为生产端到端完成
- [TASK-RAG-KG-M2-LINEAGE-REWORK-01 / G-LIN-01] Source occurrence 与 Schema 组件修订 — Backend Worker/Test Engineer — Schema 2.0 仅新写、v1 只读/回放及歧义发布阻断、PL-B01—B06 完成；任务整体仍 `in_progress`
- [TASK-RAG-KG-M2-LINEAGE-REWORK-01 / G-LIN-02 / 2A] Keyword extractor 版本证据组件 — Backend Worker/Test Engineer — `KeywordRuleSnapshot`、`KeywordExtractorVersion.resolve`、producer 显式 `schemaVersion/extractorVersion/extractorSnapshotRef` 及规则路径 `modelStatus=not_applicable` 已实现；2C 公共触发已完成初版接线
- [TASK-RAG-KG-M2-LIN-2C-KRN-TST-02 / KRN-BE-02] 冻结输入规则重建内核 — Test Engineer/Backend Worker — 同 run 规则证据、`rebuildOf`、只读执行上下文、reservation 接管和零模型约束已完成；内核与契约联合回归 23 项通过，T03 并发重复 10/10 通过
- [TASK-RAG-KG-M2-LIN-2C-FRZ-TST-01 / FRZ-BE-01] dataset 请求时冻结适配 — Test Engineer/Backend Worker — `KeywordRebuildInputFreezer` 已完成；14 项冻结契约、内核回归 37 项通过；请求时快照明确为 `captureSemantics=request_time_snapshot`
- [TASK-RAG-KG-M2-LIN-2C-FRZ-KRN-INT-01] 冻结包与 2C 内核桥接 — Backend Worker/Test Engineer — `CommittedRebuildInputRef` 作为生产入口、commit/manifest/artifact 重验和有界 `execute_batch` 已完成；桥接测试 3/3、联合回归 34 项通过
- [TASK-RAG-KG-M2-LIN-2C-PERF-BE-01] 2C 有界执行性能基线 — Backend Worker/Test Engineer — 1k/8k 基线已采集；批队列和零模型调用通过，但元数据/去重集合仍导致峰值 Python 分配随文档数增长，性能门禁尚未完成
- [TASK-RAG-KG-M2-LIN-2C-API-TST/ACC-01] API-A 隔离验收 — Test Engineer/Reporter — 真实 FastAPI 7/7，覆盖成功、幂等、并发、源错误、异步失败信封、同 run 证据和旧产物不变；训练兼容回归通过
- [TASK-RAG-KG-M2-LINEAGE-INT-02] 训练生产出口接入治理包 — Backend Worker/Test Engineer — 两个 dataset 生成出口已接入共用 helper；完整事实 fixture 1/1 通过，真实训练 API 端到端仍待补
- [TASK-RAG-KG-M2-LINEAGE-INT-03] 发布入口重验治理包 — Backend Worker/Test Engineer — 真实发布 API 5/5；篡改、缺失、normalized 漂移、引用不一致和 force 绕过均阻断
- [GS-DES-01 / GS-TST-01 / GS-CONTRACT-BE-01] GraphStore 架构、存储无关契约与测试 — Architect/Doc/Test/Backend — 设计、接口、伪代码和契约验证完成
- [GS-LOCAL-BE-01 / GS-WRITE-TST-01 / GS-WRITE-BE-01] LocalGraphStore 与异步投影内核 — Backend/Test — 独立验收发现的 5 个 P0 已修复，9 项组合测试通过；contract/local/projection/integration/GraphVersion API 最终联合回归 42/42 通过

## 🔄 进行中

- M2-LIN-REWORK 的 G-LIN-01、G-LIN-02/2A+2C、请求时冻结、API-A、生产出口 helper 和发布重验已完成；当前组合回归 187 项中 185 passed、2 skipped。性能基线尚未满足内存门禁，真实训练出口回放、G-LIN-04 和 ACL 仍未完成。下一阶段补真实训练出口/回放验收，再收敛性能内存门禁。
- M8 GraphStore 主计划为 `in_progress / blocked-at-api-gate`：本地前置 6/10 完成，API-TST -> API-BE -> ACC -> RPT 等待 RG-20/23、G2.5、可信身份与隔离 formal 数据写入许可。

## ⏳ 待开始

- [TASK-KP-BRIEF-DOC-01 / REV-01 / DOC-02] 知识平台工程化技术汇报 — doc-writer/independent-reviewer — 08-20 按初稿 -> 独立只读质询 -> 定稿串行交付
- [TASK-OUTLINE-COMPAT-01] 管理员手册大纲兼容转换与持续演进 — 多角色 — 先执行规范副本；解析兼容和预检产品化待人类确认
- [TASK-OUTLINE-EVOLUTION-P1] 规格基线与样本规范化 — doc-writer/test-engineer — 设计已就绪，待生成规范副本并真实 API 验收
- [TASK-UPLOAD-SPEC-01] 梳理大纲上传的事实约束并编写输入输出规格 — doc-writer — 预计 08-17
- [TASK-UPLOAD-SPEC-02] 建立知识点大纲评分与修改建议规范 — doc-writer — 预计 08-17 — 依赖 TASK-UPLOAD-SPEC-01
- [TASK-UPLOAD-SPEC-03] 设计规格验证样例与回归验收矩阵 — test-engineer — 预计 08-17 — 依赖 TASK-UPLOAD-SPEC-01
- [TASK-001] 多角色编排框架搭建 — 框架初始化 — 预计 08-04
- [TASK-002] 端到端编排验证 — 全流程测试 — 预计 08-05 — 依赖 TASK-001
- [TASK-003] 知识库构建 Pipeline 优化 — backend-worker — 待拆解
- [TASK-RKE-01] 将主页知识提取切换为纯规则提取 — backend-worker/test-engineer/doc-writer — 待人类确认架构与产物契约
- [TASK-DIAGRAM-VERIFY-01] 架构图与流程图一致性验收 — test-engineer — 依赖流程图
- [TASK-TASKRUN-B1A74-01] training_b1a74bb90a554b17 四阶段加工测试与长任务跟踪 — test-engineer/backend-worker/frontend-worker — 待人类确认是否允许原任务写操作和新隔离任务验证
- [TASK-RAG-KG-REVIEW-01] 成熟 RAG 知识图谱缺口审查与原始需求拆分 — planner — 已落库 REQ-KGO-33，RG-01 已核验，RG-02 发现 P0 ACL 风险
- [TASK-RAG-KG-ROADMAP-01] 成熟 RAG 能力缺口分级排期 — 多角色 — M0 计划 08-17—08-18，P0 目标 09-18，P1 目标 10-02；未确认外部依赖不进入实现
- [REQ-KGO-34 / TASK-P2-05—09] 图数据库知识库存储与 GraphRAG 扩展 — Project Manager — 已完成需求补充，待 G1 选型和安全/性能审批

## 🚫 阻塞

- [TASK-RAG-KG-RG20] ACL 过滤与安全审计接入 — 待确认身份源、ACL 粒度/冲突规则、审计存储/保留/脱敏
- [TASK-RAG-KG-RG23] ACL 越权回归 — 依赖 RG-20 和隔离测试身份/数据集
- [TASK-RAG-KG-RG25] M2 G2.5 验收 — RG-20/23 未完成，越权成功数无法验收为 0，G2.5 未通过
- [TASK-RAG-KG-M2-LINEAGE-REWORK-01] 生产接线修订 — `in_progress / partially-unblocked`：G-LIN-01 和 G-LIN-02/2A 组件已完成；G-LIN-02/2C 冻结输入重跑与公共 API 触发、G-LIN-03 dataset 权威提交、G-LIN-04 模式/偏移及生产发布验证仍阻塞
- [GS-API-TST-01 / GS-API-BE-01 / GS-ACC-01 / GS-RPT-01] GraphStore API 接线与整体验收 — 依赖 RG-20/23 完成、G2.5 通过、可信身份参数、隔离测试身份及隔离 formal 数据集写入许可；当前未修改公共 API
- [TASK-OUTLINE-EVOLUTION-P2] 统一解析与结构化诊断 — 等待 P1 及“标题树纳入正式契约”审批
- [TASK-OUTLINE-EVOLUTION-P3] 上传准入与真实 API 回归 — 等待 P2
- [TASK-OUTLINE-EVOLUTION-P4] 预检转换与差异确认 — 等待 P3 及“新增预检/确认 API”审批
- [TASK-OUTLINE-EVOLUTION-P5] 评分建议与持续演进 — 等待 P4

---

## 📁 项目模块索引

| 模块 | 路径 | 状态 |
|------|------|------|
| Agent Runner | `agent-runner/` | 已搭建，待优化 |
| PingCode 后端 | `scripts/pingcode/web/backend/` | 已搭建，待完善 |
| PingCode 前端 | `scripts/pingcode/web/frontend/` | 已搭建，待完善 |
| 设计文档 | `docs/` | 20+ 篇设计文档 |
| 知识提取 | `scripts/pingcode/web/backend/app/agents/` | 基础实现 |
| 提示词生成器 | `prompt-generator.html` | 已实现 |
| TrainingService 重构 | `scripts/pingcode/web/backend/app/training_service.py` | Phase 0-2 有条件通过 |
| 关键词过滤状态收敛 | `scripts/pingcode/web/backend/app/training_service.py`、`QualityPage.vue` | 已完成，真实批次仅只读验收 |
| 主页规则知识提取 | `scripts/pingcode/web/backend/app/training_service.py`、`PreprocessPage.vue` | 默认 `keyword_analysis` 已完成免模型预检与启动；`formal_knowledge` 规则化仍待人类确认 |
| 部分下载加工准入 | `scripts/pingcode/web/backend/app/training_service.py`、`PreprocessPage.vue` | 已完成；聚焦测试 12 项及前端构建通过，真实 API 仅完成准入验证，尚未创建真实加工任务 |
| 大批次扫描与加工启动 | `services.py`、`training_service.py`、`PreprocessPage.vue` | 已完成；异步扫描、报告恢复、轻量预检和隔离批次加工验证通过 |
| 产物快照并发修复 | `preparation_service.py`、`metadata_service.py`、`artifact_repository.py`、`store.py`、`training_service.py` | 核心实现与真实 API 验证完成；规模性能待复测 |
| 知识图谱可观测性与治理 | `.codex/workflow/modules/知识图谱可观测性与治理模块优化进展.md` | REQ-29/30/31 已全部验收 |

## 🔗 设计文档清单

| 编号 | 文档 | 对应任务方向 |
|------|------|-------------|
| 00 | 概要设计 | 全局架构 |
| 01 | PingCode资料预处理步骤详细设计 | 预处理 |
| 02 | 前端设计 | 前端开发 |
| 12 | 知识提取步骤详细设计 | 知识提取 |
| 13 | 按需语义补充步骤详细设计 | 语义补充 |
| 18 | 知识提取与构建测试设计 | 测试 |
| 19 | 工程化任务拆分 | 工程管理 |
| 20 | 质量分析页面三层重构设计 | 前端质量页面 |
| 21 | TrainingService 分层重构详细设计 | Phase 0-2 重构 |
| 22 | 关键词质量过滤 643/78 问题定位及修改方案 | 关键词过滤完整性 |
| 25 | 关键词过滤前端易用性优化设计 | 关键词展示、分页、排除类别与全局搜索 |
| 26 | 关键词过滤决策审计与历史记录需求 | 过滤运行、版本快照、历史与对比 |
| 27 | 关键词过滤人工调整与问题类别一致性需求 | 人工复核状态机与强校验 |
| 28 | 文档共性问题总览与证据下钻需求 | 类别聚合、文档影响与原文证据 |
| 29 | 知识图谱质量概览与局部可视化需求 | 图谱范围、健康指标和有界局部渲染 |
| 30 | 知识图谱问题诊断与证据联动需求 | 全局搜索、稳定投影和证据联动 |
| 31 | 知识图谱版本治理与质量运营需求 | 正式版本、差异、趋势和发布告警 |
