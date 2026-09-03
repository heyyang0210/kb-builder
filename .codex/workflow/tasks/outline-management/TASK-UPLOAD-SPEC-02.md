# TASK-UPLOAD-SPEC-02: 建立知识点大纲评分与修改建议规范

## 元信息
- 状态: pending
- 分配: doc-writer
- 创建: 2026-08-17
- 预计完成: 2026-08-17
- 预计工时: 3 小时
- 依赖: TASK-UPLOAD-SPEC-01
- 需人类确认: 否（文档化评分建议，不接入生产 API）
- 可并行: 否

## 需求描述
基于 TASK-UPLOAD-SPEC-01 的可验证输入契约，在同一规格文档中补充可复用的评分模型，使后续能够对任意知识点大纲给出总分、分项扣分、阻断项和可操作修改意见。评分必须区分“上传可解析性”与“知识体系质量”，不能因内容丰富而掩盖格式阻断问题。

建议至少定义：格式与解析（阻断项）、层级完整性、标识稳定性、知识点描述可生成性、领域覆盖与重复、难度/目标人群元数据、模板映射准备度、证据与版本信息等维度；每项给出权重、检查方法、阈值、证据字段、严重级别（阻断/高/中/低）和修改建议模板。规则、权重和阈值应作为版本化配置草案记录，不能在代码中新增硬编码。

## 参考文档
- `agent-runner/docs/modules/outline-management/development/29-YashanDB知识库大纲上传内容与格式规格.md`（由 TASK-UPLOAD-SPEC-01 产出）
- `outlines/README.md`
- `templates/模板设计思路.md`
- `config/全局格式规范.md`
- `config/质量验证标准.md`
- `skills/00-通用生成-skill.md`

## SMART 验收标准
- [ ] 定义 100 分制或等价可计算模型，权重合计可核对，阻断项规则明确。
- [ ] 每个评分维度提供输入字段、判定伪代码/公式、通过阈值和输出意见示例。
- [ ] 输出契约至少包含 `score`、`dimensionScores`、`blockingIssues`、`recommendations`、`specVersion` 和证据定位字段。
- [ ] 对至少 1 个合格大纲和 1 个不合格大纲给出完整评分样例，说明如何从扣分定位到修改动作。
- [ ] 明确评分仅评价大纲是否满足上传及生成准备条件，不替代生成后事实性/引用质量校验。

## 变更文件
- `agent-runner/docs/modules/outline-management/development/29-YashanDB知识库大纲上传内容与格式规格.md`（补充评分与建议章节）
- `config/outline-quality-rubric.yaml`（可选，仅在设计文档确认需要机器执行时新增；否则留在文档示例中）

## 执行日志
- 待开始
