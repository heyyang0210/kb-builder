# TASK-KFS-01: 统一关键词状态源与图谱投影

## 元信息
- 状态: completed
- 分配: backend-worker
- 创建: 2026-08-05
- 预计完成: 2026-08-05
- 预计工时: 4 小时
- 依赖: 无
- 需人类确认: 是（应用决策会改变图谱 API 的默认展示语义）
- 可并行: 否

## SMART 目标
在 4 小时内将关键词过滤统计和图谱展示统一到持久化关键词节点的 `admissionStatus` 状态源，并保证一次应用决策后，摘要、节点、边和正式知识输入边界可由同一状态确定。

## 需求描述
- 保留关键词过滤预览、SSE 流式分析和 `POST /api/datasets/{dataset_id}/keywords/filter-apply`。
- 以完整关键词节点集合为审计事实源，`admissionStatus` 仅允许 `admitted/excluded`；旧数据缺字段时按兼容规则迁移并持久化。
- 定义并返回统一统计：`beforeTotal = admitted + excluded`、`afterTotal = admitted`、`kept = admitted`、`excluded = excluded`。
- 应用决策后同步更新运行目录和数据集目录中的节点、摘要及任务/数据集状态；不得重跑模型。
- 图谱展示投影只返回 admitted 关键词、与其相连的 ProcessingUnit 节点和对应边；完整节点与边仍保留在产物中用于审计。
- 排除关键词的关联边必须从展示投影消失；重新保留后必须恢复，禁止物理删除证据或重建 `keyword-chunk-index.json`。
- 正式知识构建只依赖 `admissionStatus=admitted`，不再依赖 `approvalStatus + businessStatus` 组合。
- 不修改 `batch_47c5cdb5dec744a1` 或其他运行数据；使用临时 fixture 验证写入行为。

## 接口与伪代码

```python
def keyword_filter_state(nodes):
    keywords = [node for node in nodes if node["type"] == "Keyword"]
    admitted = [node for node in keywords if read_admission(node) == "admitted"]
    excluded = [node for node in keywords if read_admission(node) == "excluded"]
    return {
        "beforeTotal": len(keywords),
        "afterTotal": len(admitted),
        "kept": len(admitted),
        "excluded": len(excluded),
    }

def project_display_graph(nodes, edges):
    admitted_ids = admitted_keyword_ids(nodes)
    visible_edges = edges_incident_to(admitted_ids)
    visible_unit_ids = processing_unit_ids(visible_edges)
    return admitted_keywords(nodes) + units(nodes, visible_unit_ids), visible_edges
```

## 参考文档
- `docs/12-PingCode知识提取步骤详细设计.md`
- `docs/15-PingCode图谱与数据集生成步骤详细设计.md`
- `docs/20-质量分析页面三层重构设计.md`
- `docs/21-TrainingService分层重构详细设计.md`
- `scripts/pingcode/web/backend/app/training_service.py`
- `scripts/pingcode/web/backend/app/main.py`

## 验收标准
- [x] 应用状态统计满足 `beforeTotal = kept + excluded`、`afterTotal = kept`；真实只读数据为 43、30、13。
- [x] `graph/summary`、`graph/nodes`、`graph/edges` 使用同一状态快照，展示图谱为 56 节点、137 边。
- [x] 过滤后展示图谱无悬空边，实测悬空边为 0。
- [x] 自动化测试验证完整产物和索引保护及不调用模型。
- [x] 正式知识输入仅包含 admitted 关键词，旧 `businessStatus` 不再影响结果。
- [x] 临时 fixture 自动化验证通过，指定批次仅只读，未执行 `filter-apply`。

## 预计变更文件
- `scripts/pingcode/web/backend/app/training_service.py` (modified)
- `scripts/pingcode/web/backend/app/main.py` (modified，如需扩展摘要契约)
- `scripts/pingcode/web/backend/tests/test_training_service.py` (modified，由 Test Engineer 任务落地)

## 风险
- 图谱 API 默认从“完整审计图”变为“过滤后展示图”，属于公共行为变更。
- 历史节点可能同时存在 `approvalStatus`、`businessStatus` 和 `admissionStatus`，迁移必须幂等且不得误准入。

## 执行日志
- 2026-08-05 Planner：完成状态源、统计不变量、展示投影和数据保护边界设计。
- 2026-08-05 Backend Worker / Test Engineer：实现并验证统一状态源与图谱投影；聚焦测试 90/90 通过；真实只读数据集为过滤前 43、过滤后/保留 30、排除 13，图谱 56 节点/137 边/0 悬空边。
