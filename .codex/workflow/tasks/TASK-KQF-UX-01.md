# TASK-KQF-UX-01: 建立关键词排除类别与后端事件契约

## 元信息
- 状态: completed
- 分配: backend-worker
- 创建: 2026-08-14
- 预计完成: 2026-08-14（3 小时内）
- 依赖: TASK-KQF-01、TASK-KQF-02（已完成的全量决策基线）
- 需人类确认: 否（类别字典与兼容规则已由用户确认）
- 可并行: 是（可与 TASK-KQF-UX-02 按冻结契约并行）

## 需求描述
基于 `docs/25-关键词过滤前端易用性优化设计.md`，把排除问题类别纳入过滤规则、Skill 输出、后端决策校验以及 SSE/普通预览响应。后端只接受配置中的类别 ID；新排除决策缺失或非法类别时规范化为 `other` 并保留质量告警，历史无类别结果仍可展示和应用。

## 参考文档
- `docs/25-关键词过滤前端易用性优化设计.md`
- `config/filter-rules.json`
- `skills/keyword-filter/SKILL.md`
- `scripts/pingcode/web/backend/app/training_service.py`

## SMART 验收标准
- [ ] 过滤规则配置声明 8 个首版类别 ID 与中文标签，Skill 明确输出 `issueCategory`、`issueCategoryLabel`。
- [ ] 后端从规则配置加载类别，不在 Vue 或业务分支重复硬编码类别文案。
- [ ] 排除决策输出合法类别；缺失/非法类别兼容为 `other`，保留项不进入排除类别统计。
- [ ] 普通预览和 SSE `decision` 均返回类别字段，`complete.excludedByCategory` 统计之和等于排除数。
- [ ] 既有无类别测试替身和历史结果保持兼容，应用接口仍以 `keywordId` 与动作字段为准。
- [ ] 完成后通过后端语法检查及相关定向测试，单项实施与验证在 3 小时内完成。

## 文件归属
- 独占：`config/filter-rules.json`
- 独占：`skills/keyword-filter/SKILL.md`
- 独占：`scripts/pingcode/web/backend/app/training_service.py`
- 不修改前端、测试与执行效果文档。

## 执行日志
- 2026-08-14 Planner 完成拆解，等待 backend-worker 实施。
- 2026-08-14 已完成配置驱动类别、Skill 约束、后端归一化和 SSE/预览聚合；定向测试通过。
