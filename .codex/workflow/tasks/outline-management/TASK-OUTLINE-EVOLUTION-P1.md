# TASK-OUTLINE-EVOLUTION-P1：规格基线与样本规范化

## 元信息

- 状态：pending
- 阶段：P1 / M1
- 负责：doc-writer
- 协作：architecture-designer、test-engineer
- 预计工期：1 个工作日；实施子任务每项 1 至 4 小时
- 依赖：无
- 需人类确认：否；领域歧义映射需用户复核
- 可并行：映射报告与测试准备可并行，样本副本由 Doc Writer 串行合并

## SMART 目标

在 2026-08-18 前，以规格 1.0.0 为基线，在不覆盖原文件的前提下，将管理员手册标题树转换为可上传标准 Markdown 副本，完整报告每个源标题的处理结果，并通过真实后端 API 证明副本可用。

## 工作范围

1. 完成并评审阶段设计，冻结叶子节点、编号、描述缺失、歧义和空树策略。
2. 统计并标注源标题，输出原行号、源路径、目标节点、处理动作和原因。
3. 生成规范副本；不能确定的节点进入未决清单，不得静默丢弃或虚构领域事实。
4. 按规格评分并真实调用 `POST /api/outline/upload` 验收。

## 文件归属

- Doc Writer 独占：新增规范副本、映射报告及其所在目录 README。
- Architecture Designer 独占：`agent-runner/docs/modules/outline-management/development/39-管理员手册大纲兼容阶段一-基线与规范副本设计.md`。
- Test Engineer 独占：P1 验收记录和隔离测试数据。
- 禁止修改原文件 `outlines/yashan数据库管理员手册知识点大纲.md` 和业务代码。

## DoR

- [ ] 设计文档包含接口/产物契约、转换伪代码和歧义决策表。
- [ ] 原样本统计和规格 1.0.0 已复核。
- [ ] 真实 API 测试环境和测试数据清理方式明确。

## 验收标准 / DoD

- [ ] 每个源标题均映射到标准节点或未决项，静默丢失为 0。
- [ ] 每个正式知识点具有唯一三级 ID、非空名称、非空描述和所属章节。
- [ ] 规范副本无阻断项，格式与可解析性 20/20，总分不低于 80。
- [ ] 真实上传成功、`kp_count > 0`，列表和详情树与转换结果一致。
- [ ] 原文件未变化；设计、报告、README 同步；`git diff --check` 通过。

## 参考

- `.codex/requirements/modules/outline-management/REQ-OUTLINE-COMPATIBILITY.md`
- `.codex/workflow/modules/outline-management/PLAN.md`
- `agent-runner/docs/modules/outline-management/development/39-管理员手册大纲兼容阶段一-基线与规范副本设计.md`
- `agent-runner/docs/modules/outline-management/development/29-YashanDB知识库大纲上传内容与格式规格.md`
