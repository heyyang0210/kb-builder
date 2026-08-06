# TASK-KFS-06: 同步关键词过滤与图谱设计文档

## 元信息
- 状态: completed
- 分配: doc-writer
- 创建: 2026-08-05
- 预计完成: 2026-08-06
- 预计工时: 3 小时
- 依赖: TASK-KFS-01, TASK-KFS-02, TASK-KFS-03
- 需人类确认: 否
- 可并行: 是（实现契约稳定后可与测试并行）

## SMART 目标
在 3 小时内将设计文档同步为单一 admitted/excluded 状态模型、过滤后图谱投影和已删除公共能力，保证后续开发不再参考业务三态、质量评价或 L2 旧设计。

## 文档修改范围
- `docs/12`：正式知识输入从“审批 + 业务准入”改为 `admissionStatus=admitted`，删除业务语义过滤阶段。
- `docs/15`：更新关键词节点契约、统一统计、图谱展示投影和边变化规则，删除 L2 与业务三态设计。
- `docs/20`：页面只保留关键词过滤、四组统计和过滤前/后/变化图谱，删除质量评价及业务/L2 交互。
- `docs/21`：更新 TrainingService 公共 API 基线、删除矩阵、兼容策略和测试矩阵。
- 明确内部质量审计仍保留，不得描述为删除训练质量门禁。

## 参考文档
- `docs/12-PingCode知识提取步骤详细设计.md`
- `docs/15-PingCode图谱与数据集生成步骤详细设计.md`
- `docs/20-质量分析页面三层重构设计.md`
- `docs/21-TrainingService分层重构详细设计.md`
- `.codex/workflow/tasks/TASK-KFS-01.md`
- `.codex/workflow/tasks/TASK-KFS-02.md`
- `.codex/workflow/tasks/TASK-KFS-03.md`

## 验收标准
- [x] 四份设计文档对状态源、统计公式、图谱投影和正式知识边界表述一致。
- [x] 文档不再把 businessAccepted/businessRejected/needsReview 或 L2 作为现行功能。
- [x] 删除的公共 API、兼容保留字段和内部质量审计边界已记录。
- [x] 设计中的接口、伪代码与最终实现和测试一致。
- [x] 设计文档变更范围检查通过；本次 Reporter 未修改设计文档。

## 预计变更文件
- `docs/12-PingCode知识提取步骤详细设计.md` (modified)
- `docs/15-PingCode图谱与数据集生成步骤详细设计.md` (modified)
- `docs/20-质量分析页面三层重构设计.md` (modified)
- `docs/21-TrainingService分层重构详细设计.md` (modified)

## 执行日志
- 2026-08-05 Planner：完成文档同步范围和现行/历史语义边界设计。
- 2026-08-05 Doc Writer：完成 docs/12、15、20、21 同步；文档已反映统一状态、图谱投影及删除边界。
