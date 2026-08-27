# TASK-KPG-02：定义企业能力包配置契约与校验规则

## 元信息

- 任务编号：TASK-KPG-02
- 标题：定义企业能力包配置契约与校验规则
- 状态：已完成
- 分配：Architect / Backend Worker / Test Engineer
- 依赖：TASK-KPG-01
- 需人类确认：否，若新增依赖或改变凭证边界则需要
- 可并行：否
- 文件归属：企业能力包 Schema、有效/无效 fixture、契约说明和契约测试
- 参考文档：TASK-KPG-01 形成的总体架构与迁移设计

## 目标

形成 Node 与 Python 共用的 `enterprise-profile/v1` 机器契约，覆盖品牌、领域、连接器、Agent、Skill、Prompt、模板、规则、模块和逻辑目录引用。

## 工作内容

1. 定义字段、必填项、版本和引用关系。
2. 校验仓库相对路径、目录穿越、未知模块、重复 ID 和缺失能力。
3. 禁止能力包包含令牌、密码、CAS 票据、模型密钥和服务器绝对路径。
4. 建立有效配置和主要失败场景 fixture，不复制第二个虚构企业配置。

## 验收标准

- [x] Schema 可由 Node 与 Python 工具链读取，字段含义无语言差异。
- [x] 有效样例通过，缺字段、非法版本、路径越界、未知引用和敏感字段样例失败。
- [x] 错误码稳定，公共错误码、问题码和 JSON Pointer 可定位配置问题；中文消息由 TASK-KPG-03 运行加载器统一提供。
- [x] 契约、测试结果和配置边界同步到专项进展文档。

## 执行日志

2026-08-27 完成：

- 新增 `contracts/enterprise-profile/v1` Draft 2020-12 Schema、YashanDB 最小有效样例、资源占位和 11 个单故障无效样例。
- 冻结 JSON-only、ID/版本、仓库相对资源引用、允许资源根、密钥引用、逻辑目录和历史实体别名方向。
- Node/Python 语义测试覆盖重复 ID、悬空引用、敏感字段、POSIX/Windows/UNC 绝对路径和目录越界。
- 错误结构采用稳定公共 `code`、精确 `issueCode` 和 JSON Pointer `path`，与 TASK-KPG-01 公共错误分类一致。
- Node：12 项 Jest 契约测试通过；Python：2 组 unittest（有效配置与 11 个失败子场景）通过；所有 JSON 文件语法检查通过。
- 独立后端审查指出 Node 校验库当前为传递依赖；已登记为 TASK-KPG-03 实现前必须消除的风险，本任务未新增依赖。
