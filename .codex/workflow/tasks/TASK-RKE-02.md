# TASK-RKE-02: keyword_analysis 免模型预检与启动

## 元信息
- 状态: completed
- 分配: backend-worker / frontend-worker / test-engineer / doc-writer
- 创建: 2026-08-06
- 预计完成: 2026-08-06
- 预计工时: 3 小时
- 依赖: 无
- 需人类确认: 否（修复默认 `keyword_analysis` 已声明的确定性执行语义；不改公共 API、外部依赖或正式知识构建模式）
- 可并行: 是（文档与测试设计可先行，前后端在明确模式契约后并行）

## SMART 目标

在 3 小时内让主页默认 `keyword_analysis` 从点击“开始知识加工”到任务启动均不要求或触发模型真实连接测试；当模型服务返回 HTTP 502、未配置或不可达时，规则关键词提取仍能通过真实后端 API 创建、运行并完成任务，且模型调用统计为零。

## 已验证根因

- `TrainingService.preflight()` 无条件调用 `model_config()`，并在两个预检分支中把 `canStart` 设为“存在最近模型测试”；同时把规则提取的 chunk 数计入 `totalModelCalls`。
- `TrainingService.start()` 无条件执行 `require_model_test()`，没有区分 `request.mode`；因此默认 `keyword_analysis` 即使后续 `_extract_keyword_analysis()` 已为纯规则实现，仍会在启动前被模型测试拦截。
- 主页前端的“开始知识加工”先进入预检确认，再 POST `/api/training/tasks`；预检和启动的上述无条件模型依赖会迫使用户走 `/api/training/model-test`，并把 502 暴露为加工前置失败。

## 接口与伪代码

```python
def needs_model(mode: str) -> bool:
    return mode == "formal_knowledge"

def preflight(request):
    model = model_config() if needs_model(request.mode) else rule_only_model_summary()
    result = build_preflight(request, model)
    result["totalModelCalls"] = 0 if not needs_model(request.mode) else estimated_model_calls(...)
    result["canStart"] = has_processable_sources(result) and (not needs_model(request.mode) or has_valid_model_test(model))
    return result

def start(request):
    require_batch_ready(request.batch_id)
    if needs_model(request.mode):
        require_model_test()
    return queue_task(request)
```

## 执行步骤

1. Doc Writer：先更新 `docs/12-PingCode知识提取步骤详细设计.md` 与 `docs/18-PingCode知识提取与构建测试设计.md`，明确默认 `keyword_analysis` 是纯规则路径、预检/启动不依赖模型；正式 `formal_knowledge` 的模型门禁保持原状。
2. Backend Worker：在 `TrainingService.preflight()`、`_preflight_with_material_preparation()` 和 `start()` 按 `mode` 分支，令规则路径不读取模型状态、不要求模型测试、`totalModelCalls=0`，并保留处理单元、质量提示和取消边界。
3. Frontend Worker：主页仅在 `keyword_analysis` 预检成功时允许确认启动；移除“正在检查模型与任务”和模型调用/语义耗时对该模式的误导性中文文案，不更改 API 请求体的默认模式。
4. Test Engineer：覆盖两条预检分支、POST `/api/training/tasks` 和主页交互；用会抛 HTTP 502 的假网关断言 `keyword_analysis` 不访问测试/状态/调用接口并成功终态，同时断言 `formal_knowledge` 仍要求有效模型测试。

## 验收标准

- [x] 设计文档、接口伪代码、测试设计与实现语义一致，清楚区分规则默认任务和正式模型任务。
- [x] `keyword_analysis` 的预检不调用模型网关，不把规则处理单元计入 `totalModelCalls`，`canStart` 仅取决于可处理资料与批次状态。
- [x] `keyword_analysis` 的 `start()` 不调用 `require_model_test()`；模型网关 HTTP 502、未配置和连接异常均不影响其创建与运行。
- [x] `formal_knowledge` 继续保留模型测试门禁，避免放宽正式模型任务的安全边界。
- [x] 真实后端 API 以默认请求完成预检、创建、轮询终态；产物显示规则关键词候选与零模型调用，未写入真实运行数据。
- [x] 前端构建通过；主页中文按钮、预检和日志不再提示规则任务需要模型测试或模型调用。

## 参考文档

- `docs/12-PingCode知识提取步骤详细设计.md`
- `docs/18-PingCode知识提取与构建测试设计.md`
- `scripts/pingcode/web/backend/app/training_service.py`
- `scripts/pingcode/web/backend/app/main.py`
- `scripts/pingcode/web/frontend/src/views/PreprocessPage.vue`

## 预计变更文件

- `docs/12-PingCode知识提取步骤详细设计.md` (modified)
- `docs/18-PingCode知识提取与构建测试设计.md` (modified)
- `scripts/pingcode/web/backend/app/training_service.py` (modified)
- `scripts/pingcode/web/backend/tests/test_training_service.py` (modified)
- `scripts/pingcode/web/frontend/src/views/PreprocessPage.vue` (modified)

## 执行日志

- 2026-08-06 Planner：根据主页与后端入口核对及 live endpoint 验证，确认默认 `keyword_analysis` 被无条件模型预检和启动门禁错误拦截；创建修复任务。
- 2026-08-06 Doc Writer：先同步 `docs/12-PingCode知识提取步骤详细设计.md` 与 `docs/18-PingCode知识提取与构建测试设计.md`，固化规则默认路径和正式模型路径的门禁边界。
- 2026-08-06 Backend Worker / Test Engineer：完成模式分支与回归；后端 69 项聚焦测试通过。真实 API 预检返回 HTTP 200、`totalModelCalls=0`、`modelTestPassed=null`、`canStart=true`；隔离任务 `training_7dee22e14354471c` 终态 `completed`，模型调用为零。
- 2026-08-06 Frontend Worker：更新主页规则路径中文预检/日志文案并完成前端构建。
- 2026-08-06 复验：补齐规则提取子阶段完成状态后，隔离任务 `training_044352a1274f4420` 的三个公开阶段均为 `completed`；关键词候选 1 条，模型批次审计 0 条，模型调用统计为零。
