# TASK-KQF-REQ-28: 文档共性问题总览与证据下钻

## 元信息
- 状态: completed
- 类型: 独立父任务
- 分配: backend-worker / frontend-worker / test-engineer
- 创建: 2026-08-14
- 目标完成: TASK-KQF-REQ-27 验收后 1 个工作日内
- 依赖: TASK-KQF-REQ-27 completed
- 需人类确认: 否（用户已确认按推荐方案逐个实施）
- 可并行: 父任务之间不可并行；本任务内部后端与前端可按独占文件并行

## 需求目标
依据 `docs/28-文档共性问题总览与证据下钻需求.md`，基于有效或冻结的最终决策形成类别总览，并按关键词 ID 下钻到来源文档、处理单元和受控证据。

## 已确认实施边界
- 影响文档数按 `resourceId` 去重；证据 occurrence 按 `(keywordId, resourceId, chunkId, evidenceText)` 去重。
- 运行冻结图谱指纹和最小证据引用，不复制完整原文；允许在运行目录生成惰性 `evidence-index.json`。
- 桌面端使用右侧抽屉，移动端使用全宽详情区。
- 不根据理由文本重新推断类别，不调用模型补写缺失证据，不引入新依赖。

## 子任务与顺序
1. 在需求 27 验收通过后并行执行：
   - `TASK-KQF-INS-01`：实现类别聚合、证据索引和服务端筛选分页 API。
   - `TASK-KQF-INS-02`：实现总览表格和“类别 → 关键词 → 文档 → 证据”下钻界面。
2. `TASK-KQF-INS-03`：执行统计口径、证据关联、性能和真实 API 验收。

## SMART 验收标准
- [x] 需求 27 通过后 1 个工作日内完成 INS-01 至 INS-03，或记录可复现阻塞证据。
- [x] 类别关键词数之和等于最终排除数，影响文档按 `resourceId` 去重，无来源/无证据项仍可见。
- [x] 类别、关键词和文档筛选先作用于完整运行集合再分页，`pageSize <= 100`，单条证据文本不超过 500 字符。
- [x] 证据严格按 `keywordId/resourceId/chunkId` 关联；历史图谱不可用时返回并展示 `stale`，不关联新同名关键词。
- [x] URL 查询参数可恢复同一运行和下钻位置；643 条关键词、百级文档下接口 P95 小于 500ms。
- [x] 后端定向测试、中文前端桌面/移动验收、构建和相关 `git diff --check` 通过。

## 文件归属
- INS-01 独占：`scripts/pingcode/web/backend/app/keyword_issue_insight_service.py`、`app/training_service.py`、`app/main.py`。
- INS-02 独占：`scripts/pingcode/web/frontend/src/components/KeywordIssueOverview.vue`、`KeywordEvidenceDrawer.vue`、`src/views/QualityPage.vue`。
- INS-03 独占：问题洞察路由和前端下钻测试文件；生产缺陷回交对应 Worker。
- 必须等待 TASK-KQF-REQ-27 释放共享生产文件后开始。

## 真实 API 边界
- 使用隔离数据集真实调用 issue-overview 和 issue-evidence，人工核对至少 3 类、10 条 keyword/resource/chunk 关联。
- `batch_dc23fc9141ba4d6f` 及其业务数据集只读，不生成索引、不保存复核、不 apply。
- 证据响应遵守现有数据集访问边界和长度限制，不输出完整原文或无关文档内容。

## 完成条件
`TASK-KQF-INS-03` 全部通过后将本任务标记 completed，并交由 Reporter/Doc Writer 汇总三项需求实施证据。

## 参考文档
- `docs/28-文档共性问题总览与证据下钻需求.md`
