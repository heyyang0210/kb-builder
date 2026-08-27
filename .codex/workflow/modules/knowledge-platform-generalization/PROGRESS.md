# 知识中心建设平台通用化改造进展

> documentType: progress
> moduleId: knowledge-platform-generalization
> owner: Project Manager / Reporter
> 更新日期：2026-08-27
> 总体状态：阶段 A 已完成，准备进入企业能力包配置契约
> 状态单一入口：本文

## 1. 当前基线

| 项目 | 当前值 |
|---|---|
| 源分支 | `dev` |
| 规划时 HEAD | `7595a71` |
| 目标分支 | `feat/knowledge-platform-generalization` |
| 当前分支 | `feat/knowledge-platform-generalization` |
| 创建基线 | `7595a71aa080a8d55a370bcceb70ffcb1ade40b1` |
| 平台形态 | 单实例、单企业配置化 |
| 首个企业能力包 | YashanDB |
| 前端形态 | “知识中心建设平台”统一外壳下的资料加工、文档生成双模块 |
| 兼容策略 | 保留旧入口和既有 API，并提供迁移提示 |

目标分支已从规划基线创建。分支切换前后工作区状态、已跟踪差异和未跟踪路径清单逐字节一致，没有丢失或覆盖用户修改。

## 2. 任务状态

| 编号 | 任务 | 状态 | 结论与证据 |
|---|---|---|---|
| TASK-KPG-00 | 创建通用化分支并审计未提交修改 | 已完成 | 已创建目标分支；切换前后三组指纹一致；13 项已跟踪变化、3,202 个未跟踪文件、暂存区为空 |
| TASK-KPG-01 | 编写通用平台总体架构与迁移设计 | 已完成 | 三服务边界、能力包职责、上下文接口、兼容、迁移和回退已冻结；三角色独立审查完成 |
| TASK-KPG-02 | 定义企业能力包配置契约与校验规则 | 待开始 | TASK-KPG-01 已完成，可开始 |
| TASK-KPG-03 | 实现企业能力包加载器与运行上下文 | 待开始 | 等待 TASK-KPG-02 |
| TASK-KPG-04 | 整理 YashanDB 企业能力包配置 | 待开始 | 等待 TASK-KPG-03 |
| TASK-KPG-05 | 将文档生成器改为企业配置驱动 | 待开始 | 等待 TASK-KPG-04 |
| TASK-KPG-06 | 将资料清洗与知识加工改为企业配置驱动 | 待开始 | 等待 TASK-KPG-04 |
| TASK-KPG-07 | 增加平台运行上下文接口并接入统一网关 | 待开始 | 等待 TASK-KPG-05、06 |
| TASK-KPG-08 | 建设知识中心建设平台统一前端入口 | 待开始 | 等待 TASK-KPG-07 |
| TASK-KPG-09 | 保留旧入口并增加平台迁移提示 | 待开始 | 等待 TASK-KPG-08 |
| TASK-KPG-10 | 执行通用化端到端验收与响应式检查 | 待开始 | 等待 TASK-KPG-09 |
| TASK-KPG-11 | 完成通用化文档对账与改造收口 | 待开始 | 等待 TASK-KPG-10 |

## 3. 配置迁移矩阵

| 类别 | 当前事实源 | 目标归属 | 状态 |
|---|---|---|---|
| 品牌与平台名称 | 前端与包信息中的直接文案 | 企业能力包品牌段 | 待迁移 |
| 领域模型 | `domain/yashandb/` 和加工规则 | 企业能力包引用 | 待迁移 |
| Agent/Skill/Prompt/模板 | 多目录配置与文件化资源 | 企业能力包版本化引用 | 待迁移 |
| 数据源连接器 | PingCode、本地上传、MCP 配置 | 企业能力包能力声明与密钥引用 | 待迁移 |
| 质量与元数据规则 | Node/Python 配置和规则文件 | 企业能力包引用 | 待迁移 |
| 输出与数据目录 | 配置、环境变量及部分绝对路径 | 逻辑目录引用与部署配置 | 待迁移 |

## 4. 兼容与验证状态

| 项目 | 目标 | 当前状态 |
|---|---|---|
| `/knowledge-center/` | 统一平台入口 | 未实现 |
| `/prompt-generator.html` | 保持可用并提示迁移 | 当前可用，未增加提示 |
| `/pingcode-materials/` | 保持可用并提示迁移 | 当前可用，未增加提示 |
| 既有 API | 本轮保持兼容 | 尚未执行通用化回归 |
| Node/Python 契约一致性 | 相同配置指纹和脱敏上下文 | 未实现 |
| Playwright 四视口 | 无溢出、遮挡和控制台错误 | 未执行 |

## 5. 风险与阻塞

- 当前工作区仍包含大量未提交和未跟踪内容，后续必须按本节归属清单进行路径级暂存。
- 两套后端使用不同语言，若没有共享 Schema 和契约测试，企业能力包语义可能漂移。
- 历史数据包含 YashanDB 专属实体类型；通用化必须保持旧数据可读，不能直接重命名历史事实。
- 若后续要求同实例多企业，将触及身份、权限、存储和任务隔离，必须另立需求。
- 现有 PingCode 本地配置存在明文凭证风险；能力包不得引用或复制该值，凭证轮换和 Git 历史处置需要人工决策。
- Python 设置默认端口为 8000，而启动脚本和 3500 代理实际使用 8001；本轮以 8001 为部署基线，TASK-KPG-10 真实启动核验。
- 现有文档路径配置包含服务器绝对路径，运行上下文和前端投影必须拒绝此类字段。
- 现有配置管理的固定盐和兼容默认密钥是安全债务，新加载器不得复制，是否单独整改尚未决定。

### 5.1 工作区归属审计

审计基线为 13 项已跟踪变化、3,202 个未跟踪文件、0 项暂存变化。分类按“本专项可提交、用户既有修改、运行产物/禁止提交”管理。

#### 本专项可按路径提交

- `.codex/workflow/tasks/knowledge-platform-generalization/`：13 个文件，包括任务索引和 12 张任务卡。
- `.codex/workflow/modules/knowledge-platform-generalization/`：`README.md`、`PLAN.md`、`PROGRESS.md`。
- `.codex/workflow/modules/README.md`：本专项模块索引行。
- `prompt.md`：本轮任务拆分决策与后续执行结果记录。

`.codex/workflow/tasks/README.md` 是重叠文件：它在本专项开始前已是未跟踪用户文件，本轮只追加专项入口。除非后续确认该文件整体属于可提交范围，否则禁止把整个文件加入专项提交；专项任务可通过自身 README 和模块索引发现。

#### 用户既有修改，默认不纳入本专项

- 已跟踪治理文档：`.codex/workflow/NEXT.md`、`PROGRESS.md`、`RISKS.md`。
- 既有设计与代码：`agent-runner/docs/16-数据库方案设计.md`、`agent-runner/frontend/prompt-generator.html.backup`、`scripts/pingcode/web/backend/app/processing_units.py`。
- 大纲运行状态：`agent-runner/outlines/metadata.json` 及已删除的 `outline_1783581157782_guxcaa.md`。
- 既有任务、审计、日报、汇报、图纸和方案等未跟踪文件共 46 项以上；只有后续任务明确引用且完成归属复核后才可按文件纳入。
- `.gitignore` 为用户既有修改；即使后续需要增加通用化忽略规则，也必须先读取并保留现有变化，不能覆盖。

#### 运行产物与禁止提交

- `agent-runner/preprocessing-output/`：471 个未跟踪加工产物。
- `references/`、`refs/`：2,653 个未跟踪参考资料镜像。
- `agent-runner/tests/e2e/reports/`、`dump.rdb`、`test_svg.html`、备份文件和临时汇总报告。
- `agent-runner/config/model-config.json`：本地模型配置，禁止提交。
- `prompt-log.md`：历史档案，用户已明确不提交，禁止提交。
- `agent-runner/frontend/prompt-generator.html.backup` 和所有 `*.bak*`：备份文件，禁止提交。

#### 完整性证据

| 清单 | 切换前后 SHA-256 | 比较结果 |
|---|---|---|
| 工作区状态 | `b54e69eb485b3fdf73fab1b72870bfe2ee094563b8f92dc02838daf49545f559` | 一致 |
| 已跟踪差异 | `fe70ad9d6bcfc510a6a287a9fbc1bc33b79e4b2dc9bc7594f7f3232bf66e126b` | 一致 |
| 未跟踪路径 | `3b788906ef07d8628c0e173b2d4f17c6f622eebedfd7a77e484e1eb2fe2a1f69` | 一致 |

## 6. 下一步

仅执行 TASK-KPG-02：定义企业能力包配置契约与校验规则。Schema 和失败 fixture 通过双语言契约验证前，不实现加载器。

### 6.1 TASK-KPG-01 验收证据

- 设计文档：`agent-runner/docs/modules/platform-foundation/overview/知识中心建设平台通用化总体架构设计.md`。
- 开发设计：`agent-runner/docs/modules/platform-foundation/development/enterprise-profile-v1配置与运行上下文设计.md`。
- 独立审查：Architect、Backend Worker、Test Engineer 均完成只读审查。
- 真实探测：4100/8001 健康接口和 3500 两个旧入口及代理均返回 200；`/knowledge-center/` 返回 404，与尚未实施状态一致。
- 后续冻结输入：公共上下文接口、受控 profile ID、引用内容参与指纹、单模块降级语义和精确兼容快照。

## 7. 更新规则

- 任务开始、完成、阻塞、范围变化或产生提交时更新本文。
- 只有验收证据齐全才能将任务标记为“已完成”。
- 每项完成记录实际变更、测试命令与结果、提交哈希、残余问题和下一任务输入。
- 任务卡保存局部执行日志；跨任务累计状态、迁移矩阵和风险只在本文维护。
