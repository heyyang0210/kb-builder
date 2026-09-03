# TASK-OUTLINE-EVOLUTION-P4：预检转换与差异确认

## 元信息

- 状态：blocked（等待 P3 和方案三审批）
- 阶段：P4 / M4
- 负责：backend-worker、frontend-worker
- 协作：architecture-designer、test-engineer、doc-writer
- 预计工期：3 个工作日；每张实施子卡 1 至 4 小时
- 依赖：P3 通过 M3；预检 API 和确认流程获得人类确认
- 需人类确认：是，新增 API/模块及用户流程
- 可并行：API 冻结后前后端和测试可按不重叠文件并行

## SMART 目标

在人类批准且 P3 完成后的 3 个工作日内，为上传流程增加无正式落库副作用的预检、转换差异和用户确认能力，使用户能以中文完成从原样本到确认上传的闭环，且落库树与确认树完全一致。

## 工作范围

1. 先完成预检/确认 API、状态机、摘要校验、异常路径和界面设计。
2. 后端返回原始结构、标准结构、转换统计、阻断项、逐行诊断和未决映射。
3. 前端以中文展示结果和差异；有阻断、未确认或内容已变化时禁用确认上传。
4. 真实调用预检和正式上传 API，验证幂等、无副作用和树一致性。

## 文件归属

- Architecture Designer 独占：`agent-runner/docs/modules/outline-management/development/42-管理员手册大纲兼容阶段四-预检差异确认与正式上传设计.md`。
- Backend Worker 独占：预检/确认后端模块、路由和配置。
- Frontend Worker 独占：上传预检、差异与确认相关前端文件。
- Test Engineer 独占：API/界面测试和 fixtures；公共文件接入按顺序串行。

## DoR

- [ ] P3 真实 API 回归通过。
- [ ] 新增 API/模块已获批准，未引入未审批外部依赖。
- [ ] 状态机、摘要算法、过期策略、幂等和落库边界评审通过。

## 验收标准 / DoD

- [ ] 重复预检不写正式 outlines 文件或 metadata，且结果可按版本复现。
- [ ] 阻断项和未决映射在中文界面可定位，确认动作只在满足条件时可用。
- [ ] 文件内容、`specVersion` 或 `ruleVersion` 变化时旧确认失效。
- [ ] 原样本可完成预检、审阅、确认、正式上传；预览树与落库树完全一致。
- [ ] 桌面与移动视口无内容溢出或重叠；真实 API、界面回归和 `git diff --check` 通过。

## 参考

- `.codex/requirements/modules/outline-management/REQ-OUTLINE-COMPATIBILITY.md`
- `.codex/workflow/modules/outline-management/PLAN.md`
- `agent-runner/docs/modules/outline-management/development/42-管理员手册大纲兼容阶段四-预检差异确认与正式上传设计.md`
