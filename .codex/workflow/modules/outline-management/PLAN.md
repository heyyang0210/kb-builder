# 大纲管理模块实施计划

> documentType: plan
> moduleId: outline-management
> owner: Project Manager
> 计划编号：PLAN-OUTLINE-EVOLUTION
> 对应需求：REQ-OUTLINE-COMPATIBILITY
> 状态：已规划
> 负责人：Project Manager
> 基线日期：2026-08-17

## 1. 交付策略

采用五阶段串行演进：先交付当前样本的合规副本，再沉淀统一解析和安全上传能力，随后建设预检确认闭环，最后接入评分和规则治理。总目标工期为 10 个工作日，不含人工审批等待时间。

阶段内允许按不重叠文件并行；公共 AST、规则配置、路由和同一设计文档必须串行编辑。

## 2. 路线图

| 阶段 | 目标 | 工期 | 依赖 | 退出门禁 | 开发设计 |
|---|---|---:|---|---|---|
| P1 | 基线与规范副本 | 1 日 | 无 | M1：副本无阻断、格式 20/20、总分 ≥80，真实上传 `kp_count > 0` | `agent-runner/docs/modules/outline-management/development/39-管理员手册大纲兼容阶段一-基线与规范副本设计.md` |
| P2 | 统一解析与结构化诊断 | 2 日 | M1、方案二审批 | M2：两类 Markdown 归一化稳定，诊断可定位，零静默丢失 | `agent-runner/docs/modules/outline-management/development/40-管理员手册大纲兼容阶段二-统一解析与结构化诊断设计.md` |
| P3 | 安全上传与真实 API 回归 | 1 日 | M2 | M3：0 知识点被阻断、失败无残留、既有格式不回归 | `agent-runner/docs/modules/outline-management/development/41-管理员手册大纲兼容阶段三-安全上传与真实API验收设计.md` |
| P4 | 预检、差异确认与正式上传 | 3 日 | M3、方案三审批 | M4：预检无副作用，确认有效，预览树与落库树一致 | `agent-runner/docs/modules/outline-management/development/42-管理员手册大纲兼容阶段四-预检差异确认与正式上传设计.md` |
| P5 | 评分建议与持续治理 | 3 日 | M4 | M5：评分可复现，建议有证据，指标可统计，规则可回退 | `agent-runner/docs/modules/outline-management/development/43-管理员手册大纲兼容阶段五-评分建议与持续治理设计.md` |

阶段任务卡见 `../../tasks/outline-management/TASK-OUTLINE-EVOLUTION-P1.md` 至 `TASK-OUTLINE-EVOLUTION-P5.md`。

## 3. RACI

| 工作 | Product Owner | Project Manager | Planner | Architect | Backend | Frontend | Test | Doc Writer | Reporter |
|---|---|---|---|---|---|---|---|---|---|
| 需求范围与优先级 | A | R | C | C | I | I | I | I | I |
| 产品与架构设计 | C/A | C | C | R | C | C | C | C | I |
| P1 规范副本 | I | A | C | C | I | I | C | R | I |
| P2 统一解析 | I | A | I | C | R | I | C | C | I |
| P3 上传准入与回归 | C | A | I | C | R | I | R | C | I |
| P4 预检确认闭环 | A | R | I | C | R | R | C | C | I |
| P5 评分与治理 | A | R | C | C | R | C | R | C | I |
| 状态与报告 | I | A | C | I | I | I | C | C | R |

## 4. 审批门禁

| 门禁 | 触发点 | 批准角色 | 未批准时处理 |
|---|---|---|---|
| 标题树纳入正式上传契约，0 知识点改为失败 | P2 实施前 | Product Owner | 停留在 P1 离线转换方案 |
| 新增预检/确认 API、模块和页面状态 | P4 实施前 | Product Owner | 保留 P2/P3 能力，不进入 P4 |
| 新增 npm/Python 包或外部服务 | 任一阶段 | Product Owner / Architect | 复用现有技术栈或缩减方言范围 |
| 涉及安全、性能预算或公共 API 兼容策略 | 对应阶段 | Product Owner / Architect | 不纳入发布范围，形成专项设计 |
| 评分成为批量生成准入门槛 | P5 发布前 | Product Owner | 评分仅作建议，不拦截后续流程 |

Project Manager 准备影响摘要，Architect 评估产品和技术影响，Product Owner 作最终决策并留下记录。

## 5. 依赖与并发边界

- 上游需求：`.codex/requirements/modules/outline-management/REQ-OUTLINE-COMPATIBILITY.md`。
- 上游设计：`agent-runner/docs/modules/outline-management/overview/outline-management-overview-design.md` 和 `development/29-YashanDB知识库大纲上传内容与格式规格.md`。
- P1 至 P5 为阶段级串行依赖，下一阶段可提前准备研究和测试设计，但不得绕过退出门禁实施。
- Doc Writer 独占 P1 规范副本与映射报告；Backend Worker 独占 P2/P3 后端模块；Frontend Worker 独占 P4 界面；Test Engineer 独占 fixtures 和验收报告。
- 共享路由、统一 AST Schema、规则配置和同一文档必须串行修改，任务卡需声明文件所有权。

## 6. 通用 DoR / DoD

### DoR

- 阶段开发设计已包含接口、数据结构、伪代码和异常路径，并完成评审。
- 用户价值、范围、验收样本和成功指标明确。
- 前置里程碑已通过，受限决策已经批准。
- 工作项满足 SMART，单项 1 至 4 小时，文件归属互不重叠。
- 真实 API 环境、测试数据和清理方式可用。

### DoD

- 阶段验收标准全部满足并留下可复核证据。
- 实现、设计、配置说明和对应 README 同步。
- 单元、契约、集成和真实 API 测试通过，失败路径确认不落库。
- `git diff --check` 通过；既有无关问题单独记录。
- 无未处理高风险，残余风险由 Product Owner 接受。
- Reporter 已获得状态、证据、风险和下一阶段输入。

## 7. 风险登记

| 风险 | 概率/影响 | 缓解与应急 | 责任人 |
|---|---|---|---|
| 标题层级不等于领域语义 | 高/高 | 歧义进入未决映射，人工确认，禁止虚构 | Architect / Doc Writer |
| 前后端解析结果漂移 | 中/高 | 服务端单一事实源，前端消费统一契约 | Backend Worker |
| 失败后留下半成品 | 中/高 | 写前校验、隔离临时文件、失败路径测试 | Backend / Test |
| 新规则破坏既有格式 | 中/高 | 黄金样本矩阵、规则版本和回退开关 | Test Engineer |
| 规则或文案硬编码 | 中/中 | 配置化，例外登记待办 | Architect |
| 评分无证据或不可复现 | 中/高 | 扣分绑定证据、版本和可测验收条件 | Test Engineer |
| 大文件预检超出响应预算 | 低/中 | P4 前冻结预算并实测，优化需审批 | Project Manager |

风险状态与下一步仅在 `PROGRESS.md` 维护，避免在计划中记录易过期信息。
