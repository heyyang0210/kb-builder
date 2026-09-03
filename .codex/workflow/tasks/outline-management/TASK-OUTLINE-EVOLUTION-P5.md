# TASK-OUTLINE-EVOLUTION-P5：评分建议与持续演进

## 元信息

- 状态：blocked（等待 P4）
- 阶段：P5 / M5
- 负责：backend-worker、test-engineer
- 协作：project-manager、architecture-designer、frontend-worker、doc-writer、reporter
- 预计工期：3 个工作日；每张实施子卡 1 至 4 小时
- 依赖：P4 通过 M4
- 需人类确认：评分准入策略和任何安全/性能/外部依赖变更需确认
- 可并行：评分配置、报告展示和测试基线可在契约冻结后按文件归属并行

## SMART 目标

在 P4 完成后的 3 个工作日内，将规格 1.0.0 的评分和修改建议配置化接入预检闭环，生成可追溯的机器报告与中文报告，并建立按规则版本统计、回归、发布和回退的持续演进机制。

## 工作范围

1. 完成评分维度、证据、建议模板、准入决策、指标和规则生命周期设计。
2. 配置化实现阻断检查、百分制评分和按严重度排序的修改建议。
3. 展示总分、等级、分项证据、修改动作和可测验收条件。
4. 建立标注样本、指标基线、规则版本回归、发布审批和回退流程。

## 文件归属

- Architecture Designer 独占：`agent-runner/docs/modules/outline-management/development/43-管理员手册大纲兼容阶段五-评分建议与持续治理设计.md`。
- Backend Worker 独占：评分服务、规则和建议模板配置。
- Frontend Worker 独占：评分报告展示文件。
- Test Engineer 独占：标注样本、稳定性和真实 API 回归；Reporter 只更新项目报告文件。

## DoR

- [ ] P4 预检、确认、摘要和版本契约稳定。
- [ ] 评分规则、证据格式、准入阈值、指标口径和回退条件评审通过。
- [ ] 规则与提示词未散落硬编码；例外项有明确待办归属。

## 验收标准 / DoD

- [ ] 输出包含 `specVersion`、`ruleVersion`、总分、等级、分项得分、阻断项和建议。
- [ ] 每个扣分绑定具体 ID/行号/字段证据，每条建议包含动作和可测验收条件。
- [ ] 同输入、同规则版本重复评分一致；规则升级可回归并可回退。
- [ ] 无阻断项、格式 20/20 且总分不低于 80 才允许进入批量生成。
- [ ] 方言识别准确率、0 知识点误成功、诊断可定位率、人工修订率和闭环成功率可按版本统计。
- [ ] 当前样本、合格样本和反例通过真实 API 验收；设计、使用说明、README 和 `git diff --check` 完成。

## 参考

- `.codex/requirements/modules/outline-management/REQ-OUTLINE-COMPATIBILITY.md`
- `.codex/workflow/modules/outline-management/PLAN.md`
- `agent-runner/docs/modules/outline-management/development/43-管理员手册大纲兼容阶段五-评分建议与持续治理设计.md`
- `agent-runner/docs/modules/outline-management/development/29-YashanDB知识库大纲上传内容与格式规格.md`
