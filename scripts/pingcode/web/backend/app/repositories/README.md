# 产物仓储层

## 职责

`artifact_repository.py` 定义训练产物仓储端口及默认本地文件适配器，负责：

- 以 UTF-8 读取和写入 JSON、JSONL 与文本产物；
- 旧 `read_jsonl()` 仅保留显式兼容容错语义；已提交快照必须使用 `read_committed_jsonl()`；
- 通过目标同目录唯一临时文件、文件/目录 `fsync` 和原子替换避免暴露半文件；
- 以 `.staging`、`manifest.json`、最后写入的 `commit.json` 和目录级发布形成不可变快照；
- 按版本化策略隔离可界定的单条 JSONL 损坏，hash、commit、manifest 或引用损坏整体阻断；
- 通过 staging 和旧目录恢复机制完整替换嵌入缓存。

`keyword_filter_run_repository.py` 定义关键词过滤运行仓储端口及本地文件适配器，负责：

- 在 `datasets/{datasetId}/keyword-filter-runs/{filterRunId}/` 隔离每次运行；
- 按 Schema `1.0` 管理 `run.json`、候选/模型/复核/最终决策快照和 `events.jsonl`；
- 通过同目录唯一临时文件、`fsync` 和原子替换发布 JSON/JSONL；
- 通过运行文件锁和 `expected_revision` 实现乐观并发控制；
- 候选、模型和最终决策快照发布后不可覆盖，复核草稿可使用 CAS 持续保存；
- 按创建时间倒序分页读取 `run.json`，列表时不加载大决策文件；
- 为 Skill、规则和候选图谱提供稳定 SHA-256 指纹计算。

`graph_version_repository.py` 负责正式知识图谱的不可变版本仓储：

- 版本 ID 由发布幂等键确定，同一数据集产物、Schema 和规则版本的并发或重试发布复用同一目录；
- 在 `graph-versions/.staging-*` 写入 `nodes.json`、`edges.json`、`summary.json`、`checks.json` 和 `manifest.json`，完成哈希、计数、稳定 ID 与关系端点校验后原子提交；
- 版本读取同时校验 manifest、全部产物 SHA-256、计数、端点和来源指纹；
- 单个损坏版本抛出 `GraphVersionIntegrityError`，不影响其他版本列表和读取；
- 发布目录和文件不提供原地更新、删除或回滚接口，修正图谱必须产生新的稳定版本 ID。

`local_graph_store.py` 是厂商无关 `GraphStore` 端口的本地兼容实现：

- 只读取 `GraphVersionRepository` 已验证的不可变版本，不读取 training run、dataset 可变图或 `latest.json`；
- 写入和查询强制携带明确的 dataset、graph version 和 ACL 上下文；
- 提供版本隔离的幂等节点/关系投影、一至二跳有界查询和完整性校验；
- 失效采用独立追加记录，不修改或删除不可变图事实。

`graph_write_repository.py` 持久化异步图投影的运行状态和问题记录：

- 以 graph version 为并发边界执行 admission、租约 fencing 和 CAS 状态迁移；
- 在批次成功持久化后推进 checkpoint，支持进程中断后的幂等恢复；
- 将可重试失败、部分失败和重试耗尽分别记录为结构化状态及脱敏问题；
- 不保存图业务事实，也不修改 `GraphVersionRepository` 的版本目录。

## 关键词过滤运行产物

```text
datasets/{datasetId}/keyword-filter-runs/{filterRunId}/
  run.json
  candidate-snapshot.json
  model-decisions.json      # 模型完成后生成
  review-decisions.json
  final-decisions.json      # 应用时生成
  events.jsonl
```

运行初始状态是 `created`，允许的主路径为
`created -> running -> reviewable -> applied`；运行中可进入
`incomplete` 或 `failed`，历史运行可标记为 `superseded`，状态不允许倒退。

## 正式图谱版本产物

```text
graph-versions/{graphVersionId}/
  manifest.json
  nodes.json
  edges.json
  summary.json
  checks.json
```

版本节点和关系会移除完整正文、Prompt、上下文全文等字段，证据摘录最多保留 500 个字符。规则完整快照、模型指纹、训练任务、过滤运行、数据集和批次 lineage 保存在 manifest 中。

## 依赖方向

`TrainingService` 依赖 `ArtifactRepository` Protocol。`LocalArtifactRepository` 实现该端口，不导入、持有或回调 `TrainingService`，也不负责计算业务路径。

关键词过滤业务层依赖 `KeywordFilterRunRepository` Protocol。
`LocalKeywordFilterRunRepository` 只负责运行目录、持久化、状态机、指纹和并发保护，
不调用模型、不修改关键词图谱，也不提供 HTTP 语义。

`GraphVersionService` 依赖 `GraphVersionRepository`，仓储层不调用发布服务、训练服务或 FastAPI。质量检查和版本差异分别由 `GraphQualityCheckService`、`GraphVersionDiffService` 负责。

`GraphProjectionService` 依赖 `GraphWriteRepository` 和注入的 `GraphStore`，按有界批次执行投影、校验和恢复。`LocalGraphStore` 与后续经审批的外部 Adapter 必须遵循同一 `graph_store_contract.py` 契约；业务层不得按存储类型分叉发布、权限或版本语义。

测试和其他调用方可通过 `TrainingService(..., artifact_repository=fake)` 注入满足 Protocol 的实现。

## 失败语义

- JSON 序列化、临时写入或替换失败时异常向上抛出，并清理临时文件；
- 单文件替换失败时保留旧目标；
- 已提交目录不可原地修改，`latest.json` CAS 失败不删除已提交快照；
- committed reader 无锁读取固定 `ArtifactSnapshotRef`，不回退共享 latest；
- 嵌入缓存先构建 staging，切换失败时恢复旧目标；
- 源缓存不存在时，以空目录完整替换目标缓存。
- 运行不存在、revision 冲突、状态迁移非法、快照已冻结和产物损坏使用不同异常类型，供 API 层映射稳定错误码；
- 同一 `expected_revision` 只有一个写入者能成功，其他写入者获得当前 revision；
- 历史运行不提供物理删除，保留策略由上层另行决策。
- 图谱版本不存在与版本损坏使用不同异常；损坏版本不会回退到当前数据集图谱，也不会被自动覆盖。
- 图投影部分失败、超时或重试耗尽不会改变不可变事实源，也不能提升为可查询状态；存储不可用时禁止静默切换版本或 Adapter。
