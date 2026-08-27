# TASK-KQF-01: 关键词过滤全量决策与后端口径修复

## 元信息
- 状态: pending
- 分配: backend-worker
- 创建: 2026-08-14
- 预计完成: 2026-08-15
- 依赖: TASK-KQF-04
- 需人类确认: 否（用户已批准 docs/22 方案）
- 可并行: 否

## 需求描述
针对批次 `batch_dc23fc9141ba4d6f` 的 643 个关键词候选，追踪 `TrainingService.preview_keywords_filter_by_skill` 和 `stream_keywords_filter_by_skill` 的模型输入、输出解析、决策计数与异常/截断处理。建立“候选总数、模型已返回决策数、最终可应用决策数”三个明确计数，禁止将不完整模型响应当作成功完成；对缺失、重复、未知 `keywordId` 和流式 JSON 截断给出可观测错误或可审计的分批重试方案。

## 参考文档
- `docs/22-关键词质量过滤643与78不一致问题分析及修改方案.md`
- `scripts/pingcode/web/backend/app/config.py`
- `scripts/pingcode/web/backend/app/training_service.py:1030`
- `scripts/pingcode/web/backend/app/training_service.py:1161`
- `scripts/pingcode/runtime/web/state.json` 中 `training_ca4bde5bb7ae453e`/`dataset_1f0d622d3bd54fd8`

## SMART 验收标准
- [ ] 在 `config.py` 增加环境变量驱动的批大小和重试次数，默认值记录到配置/文档，不在业务逻辑散落硬编码。
- [ ] 普通预览和 SSE 复用同一批处理核心；按批调用、校验缺失/重复/未知 ID，并返回 `candidateTotal`、`decisionTotal`、`pendingTotal`、`status`。
- [ ] 不完整响应不再静默把缺失关键词默认标记为 keep；失败批次有限重试后返回 `incomplete`。
- [ ] `filter-apply` 对候选 ID 做精确覆盖校验，不完整时返回 HTTP 409 且不写入图谱。
- [ ] 后端定向测试覆盖 643/78、重复 ID、未知 ID、截断、重试和完整批次。
- [ ] 不修改模型网关公共配置，不新增依赖；通过后端定向测试、`py_compile` 和 `git diff --check`。
- [ ] 真实后端 API 对目标批次或等价隔离数据验证失败可见且不写入图谱。

## 文件归属
- 实施阶段独占：`scripts/pingcode/web/backend/app/training_service.py`、`scripts/pingcode/web/backend/app/config.py`、`scripts/pingcode/web/backend/app/main.py`、`scripts/pingcode/web/backend/tests/test_training_service.py`。
- 不得修改前端文件和运行时历史产物。

## 依赖与风险
- 依赖定位/方案文档先冻结计数口径。
- 失败语义和新增字段以 docs/22 为准；不得修改模型网关公共配置或运行时历史产物。
