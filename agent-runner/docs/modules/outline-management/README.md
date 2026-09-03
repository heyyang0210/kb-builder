# 大纲管理模块文档

本目录统一归档 YashanDB 知识库文档生成器“大纲管理”模块的概要设计和开发设计。模块面向数据库管理员、知识库维护者和规则运营人员，负责把上传文件转换为可定位、可验证、可持续治理的知识点树，并向提示词生成链路提供稳定输入。

当前前端采用“列表与详情分离”的信息架构：`/knowledge-center/outlines` 只负责查找、筛选和进入手册，`/knowledge-center/outlines/{handbookId}` 提供全宽的阶段式治理工作区。历史“左侧完整列表 + 右侧详情”的常驻双栏布局已被替代，详细路由、状态恢复和异常规则见[概要设计第 11 节](./overview/outline-management-overview-design.md#11-前端治理工作台设计)。

## 文档分层

| 分层 | 关注者 | 内容 | 位置 |
|---|---|---|---|
| 概要设计 | 产品经理、架构师、模块负责人 | 用户、边界、组件、上下游、主流程和架构演进 | [大纲管理模块概要设计](./overview/outline-management-overview-design.md) |
| 开发设计 | 架构师、开发与测试人员 | 上传规格、接口契约、伪代码、异常策略和 P1-P5 阶段设计 | [`development/`](./development/) |
| 模块需求 | 项目经理、产品经理 | 用户价值、范围、验收指标和版本优先级 | [大纲兼容模块需求](../../../../.codex/requirements/modules/outline-management/REQ-OUTLINE-COMPATIBILITY.md) |
| 任务与进度 | 项目经理、Worker、Reporter | SMART 任务、依赖、文件归属、状态和验收证据 | [实施计划](../../../../.codex/workflow/modules/outline-management/PLAN.md) · [开发进度](../../../../.codex/workflow/modules/outline-management/PROGRESS.md) · [任务卡](../../../../.codex/workflow/tasks/outline-management/) |

## 开发设计索引

1. [上传内容与格式规格](./development/29-YashanDB知识库大纲上传内容与格式规格.md)：当前接口硬约束、标准树、质量评分与修改建议契约。
2. [P1 基线与规范副本](./development/39-管理员手册大纲兼容阶段一-基线与规范副本设计.md)：不改系统行为，先形成可上传副本和真实 API 基线。
3. [P2 统一解析与结构化诊断](./development/40-管理员手册大纲兼容阶段二-统一解析与结构化诊断设计.md)：建立服务端统一 AST、方言适配和可定位诊断。
4. [P3 安全上传与真实 API 验收](./development/41-管理员手册大纲兼容阶段三-安全上传与真实API验收设计.md)：实现写前校验、原子提交和失败无残留。
5. [P4 预检、差异确认与正式上传](./development/42-管理员手册大纲兼容阶段四-预检差异确认与正式上传设计.md)：让用户确认转换结果后再落库。
6. [P5 评分、修改建议与持续治理](./development/43-管理员手册大纲兼容阶段五-评分建议与持续治理设计.md)：提供配置化评分、证据化建议和规则生命周期。
7. [知识中心统一解析展示与管理员增删权限](./development/44-知识中心大纲统一解析展示与管理员增删权限设计.md)：冻结文档生成器与知识中心共用的服务端解析/目录投影，以及平台管理员专属新增、删除动作。

## 代码映射

| 代码资产 | 当前职责 | 演进关系 |
|---|---|---|
| [`routes/outline.js`](../../../routes/outline.js) | 上传、Markdown 解析、计数、列表、详情、删除和提示词生成入口 | P2-P4 逐步拆出解析、诊断、预检和安全提交能力，路由只承担协议适配 |
| [`frontend/js/components/OutlineUploader.js`](../../../frontend/js/components/OutlineUploader.js) | 浏览器侧解析和上传请求 | P2 后服务端成为解析事实来源，P4 增加预检与确认交互 |
| [`frontend/prompt-generator.html`](../../../frontend/prompt-generator.html) | 大纲列表、知识点选择、删除和提示词生成界面 | 消费标准树、诊断、差异和评分报告，界面文案保持中文 |
| [`frontend/knowledge-center/modules/outlines/view.js`](../../../frontend/knowledge-center/modules/outlines/view.js) | 知识中心大纲列表与详情视图 | 列表/详情按路由分离，目录、责任、模板、检查、发布共享服务端治理事实 |
| [`frontend/knowledge-center/modules/outlines/outlines.css`](../../../frontend/knowledge-center/modules/outlines/outlines.css) | 知识中心大纲管理专属布局与响应式样式 | 详情工作区全宽优先，手册信息按需打开，四种目标视口无页面级横向溢出 |
| `outlines/metadata.json` 与上传文件 | 当前文件型持久化 | P3 增加原子性、幂等、并发和补偿边界 |
| `lib/prompt-generator` | 根据知识点生成提示词 | 只消费已准入的标准 `parts → chapters → kps` 树 |

## 维护规则

- 概要设计描述稳定的模块责任和架构边界；具体接口、Schema、伪代码和阶段实现放入 `development/`。
- 产品范围、优先级和验收口径归档到 `.codex/requirements/`；执行状态和文件归属归档到 `.codex/workflow/`。
- 修改上传、解析、预检、评分或持久化行为时，先更新对应开发设计，再修改代码，并通过真实后端 API 验证。
- 修改大纲列表、详情路由、阶段恢复或响应式行为时，同步更新概要设计第 11 节，并验证列表/详情职责不重新合并。
- 大纲解析只能在服务端统一模块演进；文档生成器和知识中心不得新增浏览器侧事实解析。新增、删除必须通过知识中心 BFF 的 `outline:create`、`outline:delete` 动作校验。
- 规则、阈值、错误文案和建议模板采用版本化配置；无法避免的硬编码需要登记待办。
- 新增或移动本目录文档时同步更新本索引。
