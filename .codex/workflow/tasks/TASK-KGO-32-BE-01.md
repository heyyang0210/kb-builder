# TASK-KGO-32-BE-01：证据来源解析与定位 API

## 状态

completed

## 交付

- 扩展 `graph/evidence` 返回 `source`、`location`、`diagnostic`。
- 实现 `available`、`snippet_missing`、`source_unavailable`、`unlinked`、`stale` 状态口径。
- 校验结构化文本偏移或唯一证据文本，无法验证时降级到章节/文档定位。
- 通过现有 `FileService` 返回受控相对 URL，不暴露磁盘路径。

## 验证

- `python3 -m unittest tests.test_graph_exploration_routes`：5/5。
- 图谱、问题洞察、版本组合回归：21/21。

## 修改文件

- `scripts/pingcode/config/graph-observability-rules.json`
- `scripts/pingcode/web/backend/app/graph_exploration_service.py`
- `scripts/pingcode/web/backend/app/training_service.py`
- `scripts/pingcode/web/backend/app/main.py`
