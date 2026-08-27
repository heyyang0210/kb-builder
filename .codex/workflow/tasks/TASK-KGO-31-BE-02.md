# TASK-KGO-31-BE-02: 实现质量检查并接入正式发布

## 元信息
- 状态: completed
- 分配: backend-worker
- 创建: 2026-08-17
- 预计完成: 开始后 4 小时内
- 依赖: TASK-KGO-31-BE-01
- 父任务: TASK-KGO-REQ-31
- 需人类确认: 否（告警不阻断边界已确认）
- 可并行: 否

## 需求描述
实现配置驱动的 GraphQualityCheckService，并在现有数据集发布成功后仅对 `final_knowledge` 创建不可变版本；检查或版本快照问题以 warning 返回和审计，不改变既有发布成功语义。

## SMART 验收标准
- [x] 4 小时内完成质量检查、正式发布接线和定向测试。
- [x] 过滤运行、复核、apply 和构建任务创建不生成 graphVersionId。
- [x] 只有 final_knowledge 发布成功创建版本；其他图谱返回 created=false 原因。
- [x] 检查覆盖 ID 唯一、端点完整、哈希、过滤统计、证据、孤立和变化异常。
- [x] 阈值和规则版本来自配置，manifest 保存实际规则快照。
- [x] warning 不阻断发布；版本创建失败显式返回和记录，不静默吞错。

## 放行证据
- 依赖证据：BE-01 仓储测试通过，且已提供可校验的 GraphVersion manifest。
- 输出证据：隔离数据集分别执行 final_knowledge 与非正式来源发布，保存 HTTP 响应、版本目录、审计 warning 和重复发布结果。
- 范围证据：过滤运行、复核、apply、构建任务创建的接口测试明确断言 graphVersionId 不存在。

## 文件归属
- 独占新增：`scripts/pingcode/web/backend/app/graph_quality_check_service.py`
- 独占：`scripts/pingcode/web/backend/app/repositories/graph_version_repository.py`
- 独占接线：`scripts/pingcode/web/backend/app/services.py`、`app/main.py`
- 按需修改集中配置加载；不修改前端和业务运行数据。

## 参考文档
- `.codex/requirements/modules/knowledge-graph-governance/REQ-KGO-31.md`
- `agent-runner/docs/modules/knowledge-graph-governance/development/03-version-governance-quality-operations-design.md`

## 完成记录

- 变更：`app/graph_quality_check_service.py`、`app/graph_version_service.py`、`app/models.py`、`app/main.py`、`config/graph-observability-rules.json`。
- 正式发布：`final_knowledge` 返回 `graphVersionId`；`model_keyword` 返回 `created=false/reason=not_final_knowledge`。
- 非发布操作：真实 HTTP 调用过滤运行创建、复核和 apply 后，正式版本仓储仍为空；构建任务路由未接入版本服务。
- 告警语义：非法图谱导致快照失败时，发布仍返回 `state=published`，并返回 `reason=snapshot_failed/status=warning`，同时写审计 JSONL 和结构化日志。
- 规则：阈值、Schema、分页、趋势和变化幅度限制全部读取集中 JSON 配置，manifest 保存当时完整规则快照。
