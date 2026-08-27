# TASK-TRAINING-8053 纯后端知识加工真实 API 测试设计

## 元信息

- 角色: Test Engineer
- 状态: 执行中
- 日期: 2026-08-07
- 批次: `batch_dc23fc9141ba4d6f`
- 历史任务: `training_b1a74bb90a554b17`
- 测试模式: `keyword_analysis`
- 执行边界: 历史任务只读；通过真实后端 API 创建新任务；本任务不修改业务代码

## 目标

在 2026-08-07 完成以下可验证目标：

1. 用真实 API 确认历史任务的取消边界和批次准入状态。
2. 对目标批次执行 `keyword_analysis` 预检，核对文档数、处理单元、模型调用上限和可启动状态。
3. 创建一个全新加工任务，验证只暴露资料预处理、元数据构建、知识提取、索引生成四阶段。
4. 持续采集任务快照、日志、事件、产物增长和系统资源，5 分钟无事件/产物增长时标记疑似卡死，10 分钟无阶段变化时停止等待并转交缺陷。

## 环境与证据

- API 基址: `http://127.0.0.1:8001`
- 服务健康基线: `GET /api/health` 必须返回 HTTP 200。
- 任务运行证据: `scripts/pingcode/runtime/web/training-runs/{taskId}/`
- 批次资料证据: `scripts/pingcode/runtime/web/spaces/yasdoc/batches/batch_dc23fc9141ba4d6f/`
- 取证不记录源文档正文、认证信息或模型密钥。

## 用例

| 编号 | 场景 | 操作 | 验收标准 |
|---|---|---|---|
| TC-BE-01 | 后端健康 | `GET /api/health` | HTTP 200，`status=ok` |
| TC-BE-02 | 历史任务只读基线 | 查询任务、日志和本地运行目录 | `cancelled`；取消前阶段和最后事件可回查；不对原任务写入 |
| TC-BE-03 | 批次准入 | `GET /api/training/admission/{batchId}` | 返回 HTTP 200；准入可启动或给出可操作的中文原因 |
| TC-BE-04 | 规则模式预检 | `POST /api/training/preflight`，`mode=keyword_analysis` | HTTP 200；`canStart=true`；`totalModelCalls=0`；文档/处理单元计数非零 |
| TC-BE-05 | 新任务启动 | `POST /api/training/tasks`，显式传入批次和模式 | HTTP 202；返回新 `training_*`；不等于历史任务 |
| TC-BE-06 | 四阶段契约 | 查询新任务快照 | 阶段严格为 `material_preparation`/`metadata_construction`/`knowledge_extraction`/`index_generation`，不出现 `semantic_enrichment` |
| TC-BE-07 | 任务可观测 | 轮询 task/logs/events 和运行目录 | started/completed/failed 事件成对；阶段、进度和中文消息一致；日志偏移单调增长 |
| TC-BE-08 | 无模型约束 | 监控 `modelCalls` 和 `model_call.*` 事件 | `keyword_analysis` 不被模型网关状态阻断；无真实模型调用 |
| TC-BE-09 | 卡死判定 | 比较连续采样的最后事件、文件数/字节和阶段状态 | 5 分钟无事件且无产物增长则记录 bug；10 分钟无阶段进展则停止等待、保留现场 |
| TC-BE-10 | 资源边界 | 采样后端 PID 的 CPU/RSS/线程/打开文件，检查数据盘剩余量 | 资源数据可回查；出现内存持续增长、磁盘不足、文件句柄逼近上限时中止测试并记录风险 |

## 缺陷处理

1. 明确 bug 先追加到 `.codex/workflow/RISKS.md`，包含时间、新任务 ID、复现步骤、实际/预期和证据路径。
2. 停止会扩大现场的操作，不修改业务代码，向 Backend Worker 提供最小复现和修复验收标准。
3. 修复后由 Test Engineer 重跑定向自动化测试和真实 API 冒烟；纯后端验收通过前不进入前端启动测试。

## 首轮基线结果

- `GET /api/health`: HTTP 200，通过。
- 历史任务: `cancelled`，在 `material_preparation` 阶段由用户取消。
- 历史事件: 6 条，最后为 `task.cancelled`；后续三阶段未执行。
- 历史模型调用: 成功 0 / 失败 0 / 跳过 0。

## 首轮执行记录

- 批次准入: HTTP 200，`canStart=true`，`admissionStatus=ready`。
- 预检: `preflight_01d97ab334cb43b6`，10,179 个可处理文档，19,419 个预计处理单元，`totalModelCalls=0`，`canStart=true`。
- 新任务: `training_f1d9f8e63a184098`，HTTP 202，首响 `queued`，严格包含四个公开阶段。
- 缺陷观察: 任务进入 `material_preparation` 后长时间保持 `current=0,total=null`，后端实际串行创建 LibreOffice 转换子进程。
- 缺陷根因: `_prepare_materials_from_stage_outputs()` 在读取可复用 preparation 快照前无条件调用完整 `preprocess.scan()`；该扫描会转换 1,694 个可转换文档，且未传入进度回调或取消令牌。
- 止损: 18:19:13 调用取消 API，HTTP 200 并进入 `cancelling`；18:21:00.622 写入 `task.cancelled`，取消生效延迟约 107.54 秒。
- 最终状态: `cancelled`，admission 恢复 `ready`，运行证据保留在 `scripts/pingcode/runtime/web/training-runs/training_f1d9f8e63a184098/`。
- 风险记录: `RISK-TRAIN-8053-001`、`RISK-TRAIN-8053-002`。

## 方案 A 第二阶段回归

- 语法检查: `training_service.py` 和 `services.py` 通过 `py_compile`。
- 定向测试: `TrainingMaterialScanTests` 4/4 通过，覆盖扫描缓存命中、轻量回退进度、损坏缓存分类和分块取消。
- 训练服务回归: `test_training_service` 75/75 通过，耗时 1.546s。
- 真实 API: health HTTP 200；admission `ready`；预检 `preflight_8123184948bb41e7`，`totalModelCalls=0`。
- 新任务: `training_ae4e8832ee134652`，HTTP 202，四阶段契约正确。
- 扫描修复结果: `latest_scan_report` 缓存命中，耗时 39ms，运行期间没有 LibreOffice 子进程。
- 性能结果: `material_preparation` 耗时 9.154s，未达到热缓存 5s 指标，记录为 `RISK-TRAIN-8053-004`。
- 阻断缺陷: 任务在 `metadata_construction` 失败，摘要为“源文档记录存在缺失或重复 resourceId”，记录为 `RISK-TRAIN-8053-003`。
- 输入证据: `resources.json` 共 23,262 条、22,345 个唯一 ID，759 个重复 ID、917 条多余记录。
- 快照证据: `prep_bf1cd53923434667/metadata/source-documents.jsonl` 共 10,533 条、10,100 个唯一 ID，363 个重复 ID、433 条多余记录；363 个重复 ID 全部继承自输入，没有 preparation 新生成的重复 ID。
- 行号示例: `d2d65349ce17644b357ebc68` 在输入第 40743/40883 行重复，在 source-documents 第 1322/1332 行重复。
- 结论: 纯后端验收未通过，本轮不进入前端启动验收，待 Backend Worker 修复后重跑。
