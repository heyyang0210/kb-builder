# TASK-RAG-KG-RG01：目标批次与正式知识产物事实核验

## 角色

Test Engineer（Project Manager 收口）

## 范围

只读核验 `keyword_analysis` 大批次、普通小批次和正式知识样本；不修改运行数据，不启动写入型任务。

## 核验结果（2026-08-17）

运行目录：`scripts/pingcode/runtime/web/datasets/*/run-report.json`

- 目标大批次 `dataset_1f0d622d3bd54fd8` / `training_ca4bde5bb7ae453e`：643 个关键词、`knowledgeCount=0`、`qualityState=blocked`、`publishable=false`、`graphSource=model_keyword`。
- 同类大批次 `dataset_1d7438983dc34062`、`dataset_f5d9051a10894b94`：同样为 643 个关键词、正式知识为 0、不可发布。
- 多个小批次存在 `knowledgeCount=0` 但 `qualityState=passed`、`publishable=true`，例如 `dataset_5baa97b0c26342f3` 和 `dataset_700108a858494a67`。
- 当前运行报告中的 `entityCount`、`relationCount` 部分为 `null`，不能当作实体关系已构建；需要以 Manifest 和阶段状态共同判断。

## 事实结论

1. 大批次已经能被质量门禁阻断，但小批次仍存在“正式知识为 0 却可发布”的状态语义缺口，P0-01 仍未关闭。
2. `keyword_analysis` 产物不能作为正式知识库完成证据；必须继续区分关键词图谱、正式知识和发布状态。
3. 下一步 RG-03 需要基于此事实冻结最小正式图谱形态和发布准入条件。

## 验收状态

`completed`：事实表已形成，证据路径已记录；未声称正式知识样本已具备，正式样本缺口作为 RG-03 前置问题。
