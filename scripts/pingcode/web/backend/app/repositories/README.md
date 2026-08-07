# 产物仓储层

## 职责

`artifact_repository.py` 定义训练产物仓储端口及默认本地文件适配器，负责：

- 以 UTF-8 读取和写入 JSON、JSONL 与文本产物；
- 旧 `read_jsonl()` 仅保留显式兼容容错语义；已提交快照必须使用 `read_committed_jsonl()`；
- 通过目标同目录唯一临时文件、文件/目录 `fsync` 和原子替换避免暴露半文件；
- 以 `.staging`、`manifest.json`、最后写入的 `commit.json` 和目录级发布形成不可变快照；
- 按版本化策略隔离可界定的单条 JSONL 损坏，hash、commit、manifest 或引用损坏整体阻断；
- 通过 staging 和旧目录恢复机制完整替换嵌入缓存。

## 依赖方向

`TrainingService` 依赖 `ArtifactRepository` Protocol。`LocalArtifactRepository` 实现该端口，不导入、持有或回调 `TrainingService`，也不负责计算业务路径。

测试和其他调用方可通过 `TrainingService(..., artifact_repository=fake)` 注入满足 Protocol 的实现。

## 失败语义

- JSON 序列化、临时写入或替换失败时异常向上抛出，并清理临时文件；
- 单文件替换失败时保留旧目标；
- 已提交目录不可原地修改，`latest.json` CAS 失败不删除已提交快照；
- committed reader 无锁读取固定 `ArtifactSnapshotRef`，不回退共享 latest；
- 嵌入缓存先构建 staging，切换失败时恢复旧目标；
- 源缓存不存在时，以空目录完整替换目标缓存。
