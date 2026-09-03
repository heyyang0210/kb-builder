# TASK-TASKRUN-B1A74-01: training_b1a74bb90a554b17 四阶段加工测试与长任务跟踪

## 元信息

- 状态: pending
- 分配: test-engineer / backend-worker / frontend-worker
- 创建: 2026-08-07
- 预计完成: 2026-08-07
- 依赖: TASK-P0-04 知识加工流水线四阶段收敛代码进入可运行分支
- 需人类确认: 是
- 可并行: 部分可并行

## 背景

`training_b1a74bb90a554b17` 已确认为 `cancelled`，只作为历史证据基线采集对象，不再作为恢复执行对象。对应批次 admission 已确认为 `ready`，本轮重点是在现存代码基线下通过真实后端 API 启动新的加工任务，完成测试、必要修复、后端回归、前端启动和长任务跟踪。当前前端可见阶段应为：

1. `material_preparation` 资料预处理
2. `metadata_construction` 元数据构建
3. `knowledge_extraction` 知识提取
4. `index_generation` 索引生成

按需语义补充 `semantic_enrichment` 尚未实现，不能作为当前可执行阶段出现。

## SMART 子任务

| 子任务 | 负责人 | 时限 | 输入 | 输出 | 可并行 |
|---|---|---|---|---|---|
| B1A74-01 历史任务只读基线采集 | Test Engineer | 30 分钟 | `training_b1a74bb90a554b17` 运行目录、任务 API、事件日志 | cancelled 终态、取消前阶段、产物完整性清单 | 是 |
| B1A74-02 admission ready 真实启动验证 | Test Engineer | 45 分钟 | 批次 admission ready、真实后端 API | 新 training taskId、启动响应、四阶段初始状态 | 否 |
| B1A74-03 后端根因定位与最小修复 | Backend Worker | 90 分钟 | B1A74-01/02 证据、`training_service.py`、仓储与阶段事件 | 修复补丁、错误分类、阶段状态一致性 | 否 |
| B1A74-04 后端自动化回归 | Test Engineer | 60 分钟 | 修复补丁 | 定向单测、训练服务回归、真实 API 冒烟结果 | 否 |
| B1A74-05 前端启动和阶段展示验证 | Frontend Worker / Test Engineer | 60 分钟 | 后端服务、`PreprocessPage.vue` | 页面能启动四阶段加工，阶段数量/文案/日志归类正确 | 部分 |
| B1A74-06 长任务实时跟踪 | Test Engineer | 120 分钟 | 手动或 API 启动的新训练任务 | 每 30 秒采样进度、后端日志、产物增长、卡死判定 | 否 |

## 执行方案

### 1. 测试前基线

- 读取 `training_b1a74bb90a554b17` 的 `run-manifest.json`、`events.jsonl`、`run-report.json`、`quality/*.json`。
- 通过真实后端 API 查询任务详情和日志，至少覆盖：
  - `GET /api/health`
  - `GET /api/training/tasks/training_b1a74bb90a554b17`
  - `GET /api/training/tasks/training_b1a74bb90a554b17/logs`
- 确认该历史任务终态为 `cancelled`，记录取消前所在阶段、最后事件和已生成产物。
- 记录是否仍出现 `semantic_enrichment`、`validation_graph`、`dataset_generation` 等历史阶段；这些只作为兼容观察，不作为新任务期望。

### 2. admission ready 真实启动验证

- 通过真实后端 API 查询批次 admission，确认 `canStart=true` 或等价 ready 状态。
- 使用当前代码基线启动新的知识加工任务，记录请求体、HTTP 状态码、返回 taskId、初始 `stages`。
- 新任务启动后立即拉取任务详情和日志，确认四阶段队列存在且未被模型 502 阻断。
- 若启动接口返回业务错误，记录中文错误、HTTP 状态码、后端事件和批次状态，不直接修改代码。

### 3. 修复边界

- 只修复导致新真实任务无法推进、阶段状态错误、日志不可观测或产物不可读取的问题。
- 不新增外部依赖。
- 不改变公共 API 字段，除非先获得人类确认。
- 不恢复旧 `semantic_enrichment` 执行路径。
- 若发现需要删除历史兼容映射、改变正式知识构建模型边界或调整数据集产物结构，必须暂停并提交人类确认。

### 4. 后端回归

- 运行语法检查：
  - `python3 -m py_compile scripts/pingcode/web/backend/app/training_service.py`
- 运行训练服务回归：
  - `PYTHONPATH=scripts/pingcode/web/backend python3 -m unittest scripts/pingcode/web/backend/tests/test_training_service.py -v`
- 启动真实后端并做 API 冒烟：
  - `GET /api/health` 返回 200
  - 任务详情接口返回 200 或明确的 404/业务错误
  - 新启动任务必须记录 taskId、batchId、开始/结束时间和产物路径

### 5. 前端启动验证

- 执行：
  - `npm --prefix scripts/pingcode/web/frontend run build`
- 页面验证项：
  - 加工按钮文案为“四阶段加工”
  - 阶段列表为 4 项
  - 元数据构建独立展示
  - 旧阶段日志仅作为兼容归类，不产生新的前端阶段
  - 下载中断但已有完成资料时，告警保留但不阻止启动

### 6. 长任务跟踪

- 对新启动任务每 30 秒记录一次：
  - 当前阶段、`current/total/unit`
  - 成功/失败/跳过计数
  - 最近 20 条后端事件
  - `events.jsonl` 行数增长
  - 阶段产物文件大小增长
- 卡死判定：
  - 5 分钟无新增事件且无产物增长，标记为疑似卡死
  - 10 分钟仍无阶段进度变化，必须停止继续等待并回到根因定位

## 验收标准

- [ ] `training_b1a74bb90a554b17` cancelled 终态、日志和产物基线已记录。
- [ ] 批次 admission ready 已通过真实 API 复核。
- [ ] 基于现存代码基线启动新的真实加工任务，并记录新 taskId。
- [ ] 后端阶段只暴露四阶段；新任务不出现未实现 `semantic_enrichment` 阶段。
- [ ] 资料预处理和元数据构建分别有 started/completed 或 failed 事件。
- [ ] 规则化知识加工启动不因模型网关 502 被阻断。
- [ ] 定向后端回归通过。
- [ ] 前端构建通过。
- [ ] 真实后端 API 冒烟通过。
- [ ] 长任务跟踪报告包含每 30 秒采样和卡死判定结论。

## 需人类确认节点

- `training_b1a74bb90a554b17` 已 cancelled，默认不对原任务做恢复、重试或取消写操作；如需修改历史任务状态必须另行确认。
- 是否允许基于 admission ready 的批次创建新的真实训练任务做长任务验证。
- 若根因需要删除历史阶段兼容映射或改变 `formal_knowledge` 模型调用边界，必须先确认。
- 若长任务超过 10 分钟无进展，是否允许终止任务并保留现场。

## 参考文档

- `docs/08-pingcode-processing-six-step-pipeline-design.md`
- `docs/19-YashanDB资料加工平台工程化任务拆分.md`
- `docs/18-PingCode知识提取与构建测试设计.md`
- `docs/21-TrainingService分层重构详细设计.md`
- `scripts/pingcode/web/backend/app/training_service.py`
- `scripts/pingcode/web/frontend/src/views/PreprocessPage.vue`
