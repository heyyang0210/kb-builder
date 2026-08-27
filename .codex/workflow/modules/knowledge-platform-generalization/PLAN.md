# 知识中心建设平台通用化实施计划

> documentType: plan
> moduleId: knowledge-platform-generalization
> owner: Project Manager / Architect
> 状态：已规划
> 基线分支：`dev`
> 目标分支：`feat/knowledge-platform-generalization`
> 更新日期：2026-08-27

## 1. 目标与边界

将文档生成器与资料加工抽象为“知识中心建设平台”的两个专业工作区。底层解析、清洗、分块、知识提取、索引、Workflow Agent、生成、验证和审计能力保持稳定，通过 `enterprise-profile/v1` 企业能力包注入品牌、领域、连接器、Agent、Skill、Prompt、模板和质量规则。

本轮只实现单实例、单企业配置化部署，只提供 YashanDB 企业能力包；不实现同实例多租户、企业切换、跨租户权限或数据迁移。

## 2. 阶段与门禁

| 阶段 | 任务 | 退出门禁 |
|---|---|---|
| A 基线治理 | TASK-KPG-00、01 | 分支与脏工作区边界明确；架构、兼容和迁移设计冻结 |
| B 配置基础 | TASK-KPG-02、03、04 | Schema、双端加载器和 YashanDB 能力包契约测试通过 |
| C 业务迁移 | TASK-KPG-05、06 | 两条业务链改为配置驱动且黄金样例不回归 |
| D 平台接入 | TASK-KPG-07、08、09 | 运行上下文、统一入口和旧入口兼容可真实访问 |
| E 验收收口 | TASK-KPG-10、11 | API、回归、Playwright、敏感信息及文档对账完成 |

## 3. 执行约束

- 新任务开始前必须验收前置任务；未达到退出门禁时不得跨阶段实现。
- 每轮只加载当前任务卡、专项进展、直接依赖设计和相关代码。
- 当前脏工作区中的用户修改、模型配置、运行产物和备份文件不得默认归入本专项。
- 后端行为与接口必须真实调用 API；前端任务必须进行浏览器检查；最终执行组合回归。
- 每个任务按路径暂存并独立提交，提交正文遵守根目录 `git提交规范.md`。
- 发现多租户、权限模型、破坏性 API 或新增外部依赖需求时停止扩大范围，在进展文档登记阻塞并请求决策。

## 4. 公共契约目标

企业能力包使用 `enterprise-profile/v1`，由环境变量 `KNOWLEDGE_PLATFORM_PROFILE` 选择。Node 与 Python 加载器消费同一 Schema，输出一致的脱敏运行上下文和配置指纹。凭证、令牌、CAS 票据、模型密钥及服务器绝对路径不得进入能力包或前端投影。

统一入口为 `/knowledge-center/`；现有 `/prompt-generator.html`、`/pingcode-materials/` 和既有 API 在本轮保持兼容。

## 5. 任务入口

完整依赖、文件归属和验收标准见 [中文任务卡索引](../../tasks/knowledge-platform-generalization/README.md)。实时状态只在 [改造进展](./PROGRESS.md) 更新。
