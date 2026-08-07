# TASK-BUG-JSON-RACE 测试设计：不可变快照与并发竞争修复

## 文档状态

- 状态：测试设计完成，等待 `TASK-BUG-JSON-RACE-P0-01` 契约冻结后实现
- 角色：Test Engineer
- 日期：2026-08-07
- 范围：方案 C 的线程/多进程并发、两阶段发布、single-flight、latest CAS、固定快照、损坏隔离、错误分类、真实 API 与性能采样
- 本阶段限制：只定义测试，不修改应用代码；Schema 字段名以 P0-01 冻结版本为准

## 1. 测试目标与质量门禁

本测试验证知识加工流水线不再依赖运行期间可变化的共享 `latest.json`，并确保并发写入不会产生半文件、丢失更新或旧结果覆盖新结果。

必须同时满足以下门禁：

1. 聚焦单元和进程并发测试全部通过，核心并发分支覆盖率大于 80%，边界分支全部覆盖。
2. 同一 `executionHash` 只有一个实际计算所有者，等待者复用同一已提交快照。
3. staging、manifest、commit、latest 和 state 在并发或故障注入后始终处于可判定状态，不允许出现可见半成品。
4. 单条可界定 JSONL 坏记录按配置隔离；文件截断、hash、commit、manifest、Schema 或引用完整性失败必须阻断。
5. 只有 `ModelGatewayError` 显示模型错误摘要，其他异常使用独立中文分类并携带 `traceId`。
6. 使用隔离数据根目录启动真实后端，通过 HTTP 完成批次创建、扫描、加工启动、轮询、事件及质量问题验收；该验收不替换服务方法、不 mock 路由。
7. admission/latest CAS 的 P95 持锁时间小于 20ms；单任务相对串行基线耗时回退不超过 5%。性能值只写测试报告，不进入业务配置。

## 2. 测试分层与隔离原则

| 层级 | 目的 | 隔离方式 | 时限 |
|---|---|---|---|
| 契约测试 | Schema、序列化、错误上下文和兼容字段 | 每例独立 `TemporaryDirectory` | 单文件小于 10 秒 |
| 线程并发测试 | 同进程锁、single-flight、CAS 和无锁读取 | `threading.Barrier` 同步起跑，不依赖 `sleep` 判定 | 单文件小于 30 秒 |
| 多进程测试 | `flock`、原子替换和 state 读改写 | `multiprocessing` 的 `spawn` 上下文和独立子进程 | 单文件小于 60 秒 |
| 故障注入测试 | 写入中断、替换失败、损坏产物和恢复 | 仅在仓储边界注入异常；不 mock HTTP 验收 | 单文件小于 30 秒 |
| 真实 API 验收 | 验证完整服务装配及 HTTP 行为 | 独立后端进程、独立数据根、真实 HTTP | 小于 60 秒，规模性能测试除外 |
| 性能采样 | 锁竞争、读吞吐和回退比例 | 预热后多轮采样，输出原始样本和分位数 | 单独标记，默认聚焦测试不执行 |

所有测试使用唯一批次 ID、唯一运行目录和独立数据根。并发测试通过 Barrier、Event 或 Queue 建立确定性时序；禁止用固定延时推断谁先提交。多进程 worker 必须定义在模块顶层，确保 `spawn` 模式可序列化。测试结束后检查子进程退出码并回收进程，超时视为潜在死锁失败。

## 3. 测试数据与观测点

### 3.1 最小数据集

- 两个可加工 Markdown 文件，每个至少产生两个 chunk。
- 一个包含 5 条独立 JSONL 记录的快照，用于坏行与截断注入。
- 两组输入哈希 `hash-old`、`hash-new`，用于旧任务晚完成场景。
- `keyword_analysis` 训练配置，用于验证 `totalModelCalls == 0` 和普通 JSON 异常不被归类为模型错误。

### 3.2 必查产物

- `.staging/{runId}-{random}/`
- `runs/{runId}/commit.json`
- manifest 及其引用的 JSON/JSONL 文件
- `latest.json` 的 `generation` 与快照引用
- `state.json` 中 task、batch、activeTask 状态
- `quality/artifact-read-issues.jsonl`
- 训练运行清单中的 preparation/metadata lineage
- 任务事件、结构化日志、失败分类与 `traceId`

提交成功的快照需逐项核对：路径位于对应 `runs/{runId}`、commit 最后发布、manifest hash 一致、每个产物的 SHA-256/字节数/记录数一致、输入快照引用完整。诊断日志只能断言原始行 hash 和脱敏摘要存在，同时断言完整敏感正文不存在。

## 4. 自动化测试矩阵

### 4.1 原子仓储与 state store

| 编号 | 场景与方法 | 核心断言 | 目标文件 |
|---|---|---|---|
| AR-01 | 32 线程并发向同一路径写入不同完整 JSON，Barrier 同步开始，重复 20 轮 | 每轮最终文件可解析且等于某个完整候选；不存在共享固定 `.tmp`；无临时文件泄漏 | `test_artifact_repository.py` |
| AR-02 | 8 个 `spawn` 子进程并发写同一 JSON，重复 10 轮 | 子进程全部正常退出；目标始终为完整候选；目录无残留临时文件 | `test_artifact_snapshot_concurrency.py` |
| AR-03 | 在临时文件落盘后让原子替换失败 | 旧目标字节完全不变；只清理本次唯一临时文件；异常向上抛出 | `test_artifact_repository.py` |
| AR-04 | 记录调用顺序验证文件 `flush/fsync`、`os.replace`、目录 `fsync` | 发布顺序符合契约；commit 或 latest 不会先于数据持久化 | `test_artifact_repository.py` |
| ST-01 | 8 进程各对不同 record 执行 50 次 `put/update` | `state.json` 始终可解析；所有 record 和最终计数均保留，无丢失更新 | `test_store_concurrency.py` |
| ST-02 | 读者持续解析 state，写者持续更新 state | 读者只观察旧版本或新版本，不观察空文件、截断文件和 JSONDecodeError | `test_store_concurrency.py` |
| ST-03 | worker 持有 state 锁时被终止，随后新进程更新 | OS 释放锁；后续操作可完成；已提交 state 可解析 | `test_store_concurrency.py` |

### 4.2 协调器、single-flight 与 CAS

| 编号 | 场景与方法 | 核心断言 | 目标文件 |
|---|---|---|---|
| CO-01 | 32 线程同时对同一 batch/stage/executionHash 请求 single-flight | 恰好一个 owner；计算回调只执行一次；其余调用得到同一 snapshot ref | `test_batch_operation_coordinator.py` |
| CO-02 | 4 进程请求同一 executionHash | 跨进程仍只有一个正式快照和一个计算所有者；等待者不重复计算 | `test_artifact_snapshot_concurrency.py` |
| CO-03 | 相同 batch/stage、两个不同 executionHash 同时运行 | 两者可独立成为 owner；不存在全局串行；各自提交独立快照 | `test_batch_operation_coordinator.py` |
| CO-04 | owner 失败或退出，等待者收到失败并再次申请 | 不返回未提交结果；flight 状态可恢复；重试产生新的 owner | `test_batch_operation_coordinator.py` |
| CO-05 | 两个并发 `TrainingService.start()` 对同一批次同步越过入口 | 最多创建一个有效 task owner 和一个 activeTask；另一请求返回确定性冲突/复用语义 | `test_training_service.py` |
| CO-06 | 在准入或 CAS 临界区插入计时探针 | 临界区只包含读改写/登记；扫描、转换、分块和 hash 回调在锁外；禁止嵌套锁 | `test_batch_operation_coordinator.py` |
| CAS-01 | generation=N 的两个提交同时以 N 为 expected generation | 只有一个成功更新为 N+1；失败者快照仍保留且可审计 | `test_artifact_snapshot_concurrency.py` |
| CAS-02 | 新任务先以 N 更新 latest；旧任务随后仍以 N 提交 | 旧任务 CAS 失败；latest 指向新快照且 generation 不回退 | `test_artifact_snapshot_concurrency.py` |
| CAS-03 | latest 文件在 CAS 前被注入非法 JSON | 抛整体指针/完整性异常，不盲写覆盖，不把损坏解释为“没有 latest” | `test_artifact_snapshot_concurrency.py` |

### 4.3 两阶段发布与固定快照

| 编号 | 场景与方法 | 核心断言 | 目标文件 |
|---|---|---|---|
| SS-01 | 准备阶段在 staging 写完部分产物后抛异常 | `runs/{runId}` 不存在；latest 不变化；staging 可清理或留下明确诊断 | `test_artifact_snapshot_concurrency.py` |
| SS-02 | 完成全部产物后校验 commit/manifest | `commit.json` 最后写入；正式目录一次发布；产物 hash/count/schema/input 均正确 | `test_material_preparation.py` |
| SS-03 | 相同 executionHash 并发调用 `prepare()` | 只产生一个正式 run；两个报告的 snapshot ref 相同；兼容路径字段仍可用 | `test_preparation_integration.py` |
| SS-04 | metadata 已接收 prepRef-A 并停在读取栅栏，此时 latest 改成 prepRef-B | metadata 的所有输入、executionHash、commit lineage 都来自 A，不读取 B | `test_preparation_integration.py` |
| SS-05 | 训练在 preparation 完成后固定 ref，随后更新 preparation latest | metadata 和训练清单继续使用固定 ref；lineage hash/generation 与 ref 一致 | `test_training_service.py` |
| SS-06 | 100 线程同时读取同一已提交快照 | 结果完全一致，无解析失败；不调用写锁/flock；快照字节不变化 | `test_artifact_snapshot_concurrency.py` |
| SS-07 | 模拟进程终止留下 staging，重建服务并执行恢复 | 半成品不被 discovery/latest 返回；恢复逻辑按契约清理或记录诊断 | `test_artifact_snapshot_concurrency.py` |

### 4.4 JSONL 损坏隔离与整体阻断

| 编号 | 注入 | 预期 | 目标文件 |
|---|---|---|---|
| JL-01 | 中间第 3 行替换为可界定非法 JSON，重新生成与测试场景匹配的 commit hash，策略允许 1 条 | 返回其余 4 条；状态 `completed_with_warnings`；生成一条中文质量问题 | `test_artifact_repository.py` |
| JL-02 | 在坏行前加入 UTF-8 多字节中文 | 诊断 `lineNumber=3`，`byteOffset` 按字节而非字符计算，路径/snapshot/hash/traceId 完整 | `test_artifact_repository.py` |
| JL-03 | 坏行包含敏感正文 | 质量文件只含脱敏摘要和原始行 SHA-256，不包含完整原文 | `test_artifact_repository.py` |
| JL-04 | 坏行数或比例超过版本化配置阈值 | 抛明确的产物读取/完整性异常，阶段失败，不继续下游构建 | `test_artifact_repository.py` |
| JL-05 | 删除 JSONL 最后一行换行并截断 JSON 文本 | 即使坏行数量在阈值内也按尾部截断整体阻断 | `test_artifact_repository.py` |
| JL-06 | 不修改 commit，直接改变 JSONL 任一字节 | 文件 hash 不匹配，读取记录前抛 `ArtifactIntegrityError` | `test_artifact_repository.py` |
| JL-07 | commit、manifest 为非法 JSON，或缺少必需字段 | 整体阻断；异常包含 artifactPath/snapshotId/traceId | `test_artifact_repository.py` |
| JL-08 | JSON 可解析但 Schema 不符、ID 重复或引用不存在 | 整体阻断，不降级为坏行警告，不进入 `build_records()` | `test_preparation_integration.py` |
| JL-09 | 显式 legacy 兼容策略读取坏行 | 只有显式兼容入口可跳过；默认 committed reader 绝不静默忽略 | `test_artifact_repository.py` |

说明：JL-01 需要先构造“已提交但包含单条业务可隔离坏行”的受控 fixture，使文件级 hash 校验通过，专门验证记录级策略；JL-06 则保留旧 commit，专门验证传输/落盘损坏优先被 hash 门禁阻断。两者不可混用。

### 4.5 错误分类与零模型契约

| 编号 | 注入异常 | 核心断言 | 目标文件 |
|---|---|---|---|
| ER-01 | `ModelGatewayError` | 使用模型错误摘要，保留 retryable/status/provider 等允许字段 | `test_training_service.py` |
| ER-02 | `json.JSONDecodeError` | 分类为 JSON/产物解析错误；失败说明不含“模型服务返回错误” | `test_training_service.py` |
| ER-03 | `ArtifactIntegrityError` / `ArtifactRecordDecodeError` | 分类为产物完整性/记录质量错误；路径、行号、offset、snapshot、traceId 可追踪 | `test_training_service.py` |
| ER-04 | `OSError`、转换异常、Schema 异常和未知异常 | 分别使用文件、转换、Schema、内部错误中文分类；未知异常不泄露敏感细节 | `test_training_service.py` |
| ER-05 | `keyword_analysis` 全流程且模型网关不可用 | 任务仍可完成规则阶段；`totalModelCalls == 0`；不访问 gateway | `test_training_service.py` 与真实 API 测试 |

测试不得继续使用当前 `error_summary(RuntimeError("JSONDecodeError..."))` 来证明普通 JSON 异常分类正确；该旧断言应调整为只覆盖 `ModelGatewayError` 内部携带的模型响应格式错误。普通 `JSONDecodeError` 必须走独立分类入口。

### 4.6 真实后端 API 验收

真实 API 测试新增独立模块，以子进程启动实际 ASGI 服务。测试进程设置隔离的数据根和端口，通过上传接口创建最小批次，不直接写生产数据目录。若配置项名称在 P0-01 后调整，以实际 `settings` 环境变量为准。

| 编号 | HTTP 流程 | 核心断言 |
|---|---|---|
| API-01 | `/api/health` -> 上传会话/文件/完成 -> 创建批次 -> 扫描/准备或训练 preflight | 服务真实启动，隔离批次可加工，preflight 返回 snapshot/processable 指标 |
| API-02 | 对同一批次并发发送两个 `POST /api/training/tasks` | 返回一个有效 owner；另一请求按契约冲突或复用；任务列表只有一个 activeTask |
| API-03 | 轮询 `/api/training/tasks/{id}`、events 和 logs 到终态 | 终态、stage、lineage、snapshot refs、generation 和 traceId 可核对 |
| API-04 | 使用 `keyword_analysis` 且模型服务地址不可用 | `totalModelCalls=0`，规则加工不因模型 502 失败 |
| API-05 | 在隔离数据根对已提交 fixture 注入单条坏行后触发下游 | API 展示 `completed_with_warnings`，质量问题含中文定位且不含原始敏感正文 |
| API-06 | 注入 hash/commit 整体损坏后触发下游 | 任务失败且错误分类为产物完整性，不显示模型错误；下游无新快照 |

为保证“真实 API”证据成立：API 测试不得 monkeypatch `main.training`、`TrainingService`、repository 或路由；允许通过公开配置选择本地规则模式和隔离数据根。启动日志、请求状态码、任务终态、snapshot refs、generation、模型调用数、质量问题摘要写入脱敏测试报告。

## 5. 性能采样方案

### 5.1 指标

- admission 锁等待时间、持锁时间 P50/P95/P99。
- single-flight 登记和 latest CAS 持锁时间 P50/P95/P99。
- 1、10、50、100 个并发读取者的总耗时、吞吐和失败数。
- 同一 executionHash 下实际计算次数、等待者数量、复用率。
- 单任务串行基线与方案 C 的端到端耗时、CPU 时间、峰值 RSS、读写字节数。
- staging 和 runs 目录数量、临时文件残留数。

### 5.2 采样方法

1. 使用固定 fixture 和本地同一文件系统，先预热 3 次。
2. 串行基线和方案 C 各执行至少 10 次，交替运行，避免页缓存只偏向一组。
3. 锁指标使用 `time.perf_counter_ns()` 在协调器测试探针采集；端到端用单调时钟。
4. 报告原始样本、中位数、P95 和环境信息（CPU 数、内存、文件系统、Python 版本），不只报告平均值。
5. 通过标准：admission/latest CAS P95 持锁小于 20ms；方案 C 单任务中位耗时相对基线回退不超过 5%；100 并发读取无失败且不获取写锁。
6. 性能阈值仅用于测试报告；若共享 CI 抖动较大，CI 只保存指标并检查功能门禁，性能硬门禁在固定验收环境执行。

### 5.3 小中大规模样本

| 规模 | 文档数 | 目标记录量 | 用途 |
|---|---:|---:|---|
| 小 | 10 | 约 100 chunks | 快速回归、锁固定开销 |
| 中 | 1,000 | 约 10,000 chunks | 常规吞吐、single-flight 收益 |
| 大 | 8,053 以上 | 约 13,710 chunks 或按真实批次快照脱敏复刻 | 内存、I/O、恢复和长任务 CAS 场景 |

大规模测试禁止复制真实敏感正文；使用相同文件数量、大小分布和记录结构的合成数据。资源观测至少包含文件描述符、磁盘空间、inode、CPU、RSS 和进程数，避免将资源耗尽误判为锁竞争。

## 6. 预期自动化文件与职责

| 文件 | 主要覆盖 |
|---|---|
| `scripts/pingcode/web/backend/tests/test_artifact_repository.py` | 唯一临时文件、fsync/replace、commit reader、JSONL 隔离和整体损坏 |
| `scripts/pingcode/web/backend/tests/test_store_concurrency.py`（新增） | state 跨线程/进程原子读改写和进程终止恢复 |
| `scripts/pingcode/web/backend/tests/test_batch_operation_coordinator.py`（新增） | admission、single-flight、锁边界、同键/异键和 owner 失败 |
| `scripts/pingcode/web/backend/tests/test_artifact_snapshot_concurrency.py`（新增） | 多进程发布、latest CAS、staging 故障、固定快照和 100 并发读 |
| `scripts/pingcode/web/backend/tests/test_material_preparation.py` | preparation commit/manifest、兼容字段和快照报告 |
| `scripts/pingcode/web/backend/tests/test_preparation_integration.py` | preparation/metadata 显式快照传递、Schema/引用阻断 |
| `scripts/pingcode/web/backend/tests/test_training_service.py` | 原子准入、lineage、异常分类、取消/恢复、零模型回归 |
| `scripts/pingcode/web/backend/tests/test_artifact_snapshot_api_integration.py`（新增） | 隔离后端进程和真实 HTTP 全链路 |
| `scripts/pingcode/web/backend/tests/test_artifact_snapshot_performance.py`（新增） | 锁 P95、无锁并发读、单任务性能回退采样 |
| `scripts/pingcode/web/backend/tests/test-report-artifact-snapshot-race.md`（验收后新增） | 命令、环境、原始指标、API 证据、失败与残余风险 |

## 7. 执行顺序与停止条件

1. P0-01 契约冻结后，先实现契约/仓储/协调器测试，确认测试因缺少实现而失败。
2. P0-02 完成后运行 AR、ST、CO、CAS 聚焦测试。
3. P0-03/P0-04 完成后运行 SS、JL 和 100 并发读取测试。
4. P0-05/P0-06 完成后运行固定快照、错误分类、零模型和既有训练回归。
5. 聚焦测试全绿后再启动隔离真实后端，执行 API 验收。
6. 功能验收通过后在固定环境采样性能，生成测试报告并交 Reporter 回填任务卡。

以下任一情况立即停止下游验收并记录风险：发现可见半成品、state/latest 非法 JSON、丢失更新、旧 generation 覆盖新 generation、整体损坏被降级、普通异常被标成模型错误、测试子进程无法在超时后退出。

## 8. 回归范围

除新增测试外，至少运行现有：

- `test_artifact_repository.py`
- `test_material_preparation.py`
- `test_preparation_integration.py`
- `test_training_service.py`
- 与批次扫描、部分下载准入相关的聚焦测试

真实 API 验收还要复核：取消、重启恢复、部分下载可加工、同批次 activeTask 冲突、metadata keyword 图构建和 `keyword_analysis` 零模型调用。任何既有测试若因契约升级调整，必须保持 HTTP 公共行为和旧报告兼容字段，不得通过放宽断言掩盖回归。

## 9. 待 P0-01 冻结后校准项

- `ArtifactSnapshotRef`、commit、manifest、latest、质量问题和错误响应的最终字段名及 Schema 版本。
- corruption policy 的配置键、坏行数量/比例阈值和尾部截断判定。
- single-flight 等待者收到 owner 失败时的错误/重试协议。
- 并发 `start()` 的第二个 HTTP 请求采用 409、返回已有任务，还是其他已批准的兼容语义。
- staging 重启恢复采用自动清理还是保留诊断；测试按最终状态机断言，不自行决定产品行为。
