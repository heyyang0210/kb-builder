# TrainingService Phase 0-2 重构验收报告

> 验收日期：2026-08-05
> 验收角色：Test Engineer
> 验收范围：Phase 0 可运行基线恢复、Phase 1 分层设计、Phase 2 模型网关与产物仓储提取

## 1. 验收范围

本轮验证以下内容：

- `TrainingService` 在 Phase 0-2 重构后保持既有公开行为兼容。
- 模型网关同步请求、SSE 流、认证头、超时和错误转换契约。
- 产物仓储 JSON、JSONL、文本、缓存复制和原子替换契约。
- 关键词过滤预览、SSE 分析及现有训练流程回归。
- 后端健康检查、真实模型网关调用、指定数据集图谱和关键词过滤 API。

本轮未执行关键词过滤决策应用接口，避免主动修改用户数据。验收期间日志中若存在其他客户端发起的 apply 请求，不归因于本次验收。

## 2. 执行命令

在 `scripts/pingcode/web/backend` 目录执行：

```bash
python3 -m unittest \
  tests.test_model_gateway \
  tests.test_artifact_repository \
  tests.test_training_service

python3 -m unittest discover -s tests -p 'test_*.py'
```

真实 API 验收覆盖以下接口：

```text
GET  /api/health
POST /api/training/model-test
GET  /api/datasets/dataset_1df85d1df97143ca/graph/summary
POST /api/datasets/dataset_1df85d1df97143ca/keywords/filter-by-skill
GET  /api/datasets/dataset_1df85d1df97143ca/keywords/filter-by-skill/stream
```

未调用关键词过滤 apply 决策接口。

## 3. 自动化测试结果

### 3.1 Phase 2 聚焦回归

```text
Ran 92 tests in 5.827s
OK
```

聚焦用例由以下三个测试模块组成，共 92 项，全部通过：

- `tests.test_model_gateway`
- `tests.test_artifact_repository`
- `tests.test_training_service`

### 3.2 后端全量回归

```text
Ran 223 tests in 6.448s
FAILED (failures=2, skipped=21)
```

统计结果：200 项通过、2 项失败、21 项跳过。两项失败均为既有范围外问题，不归因于本次模型网关和产物仓储重构：

| 失败用例 | 预期 | 实际 | 范围判断 |
|---|---|---|---|
| `test_knowledge_point_skill_rejects_entity_and_relation_outputs` | `KNOWLEDGE_EXTRACTION_SCHEMA_INVALID` | `KNOWLEDGE_EXTRACTION_EMPTY_RESULT` | 知识点 Skill 输出分类语义，不属于 Phase 0-2 网关/仓储提取范围 |
| `test_structure_split_preserves_heading_offsets_and_neighbors_after_exclusion` | 所有 chunk 内容长度不超过 200 | 存在 chunk 长度大于 200 | 资料预处理切块算法，不属于 Phase 0-2 网关/仓储提取范围 |

全量测试另输出一个未关闭 asyncio event loop 的 `ResourceWarning`，本轮未导致新增测试失败，但应在后续测试资源治理中跟踪。

## 4. 真实 API 验收结果

### 4.1 后端与模型网关

| 验收项 | 结果 | 证据 |
|---|---|---|
| 独立后端进程 | 通过 | 新进程 PID `1728957` |
| 健康检查 | 通过 | HTTP 200 |
| `POST /api/training/model-test` | 通过 | HTTP 200，模型 `qwen3.7-plus`，延迟 `3163ms`，`schemaPassed=true` |

### 4.2 指定数据集

数据集：`dataset_1df85d1df97143ca`

| 验收项 | 结果 | 业务证据 |
|---|---|---|
| 图谱摘要 | HTTP 200 | 43 个关键词、27 个 chunks、163 条 edges |
| 非流式过滤预览 | HTTP 200，耗时 58.99s | 返回 43 条建议：keep 18、exclude 25 |
| SSE 过滤分析 | HTTP 200，耗时 20.86s | `stage=3`、`decision=43`、`complete=1`、`error=0`；keep 25、exclude 18 |

SSE 事件数量完整：43 个关键词均收到逐条决策，最终产生一个完成事件且没有错误事件。

## 5. 残余风险

### 5.1 流式与非流式模型不一致

SSE 路径在 `app/training_service.py:1082` 硬编码模型 `deepseek-v4-flash-0731`，非流式路径使用当前模型配置。两条路径对同一批 43 个关键词给出了不同决策：

- 非流式：keep 18、exclude 25。
- SSE：keep 25、exclude 18。

这会导致用户从不同入口获得不一致建议。建议后续移除 SSE 路径模型硬编码，统一通过模型网关当前配置或显式、可审计的过滤模型配置选择模型，并补充同输入、同模型、同提示词下的结果一致性测试。

### 5.2 未执行应用决策验收

为避免修改用户数据，本轮未执行 apply 决策验收。因此，真实环境中的审批状态持久化、摘要更新和“不重建索引”行为仅由自动化测试覆盖，尚未在该数据集上执行写入型验收。

### 5.3 全量回归既有失败

知识点 Skill 错误码分类和资料切块长度仍各有一项失败。它们不阻断 Phase 0-2 的网关、仓储和门面兼容验收，但会阻断后端全量测试达到全绿，应分别进入后续缺陷修复范围。

## 6. 验收结论

Phase 0-2 的聚焦自动化回归 92/92 通过，后端新进程健康，真实模型测试、图谱摘要、非流式过滤预览和 SSE 过滤分析均返回 HTTP 200。模型网关与产物仓储提取满足本阶段功能验收条件，`TrainingService` 现有回归用例保持通过。

本阶段结论为：**有条件通过**。

条件和后续整改项如下：

1. 优先消除 SSE 模型硬编码，统一流式与非流式模型选择，解决关键词决策不一致。
2. 在隔离测试数据集上补充 apply 决策真实 API 验收，避免影响用户现有数据。
3. 单独修复两项范围外既有失败，并治理测试中的 asyncio 资源告警。
