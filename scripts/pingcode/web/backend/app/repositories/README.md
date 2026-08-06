# 产物仓储层

## 职责

`artifact_repository.py` 定义训练产物仓储端口及默认本地文件适配器，负责：

- 以 UTF-8 读取和写入 JSON、JSONL 与文本产物；
- 保持 JSON 和 JSONL 的既有容错语义；
- 通过目标同目录临时文件和原子替换避免暴露半文件；
- 通过 staging 和旧目录恢复机制完整替换嵌入缓存。

## 依赖方向

`TrainingService` 依赖 `ArtifactRepository` Protocol。`LocalArtifactRepository` 实现该端口，不导入、持有或回调 `TrainingService`，也不负责计算业务路径。

测试和其他调用方可通过 `TrainingService(..., artifact_repository=fake)` 注入满足 Protocol 的实现。

## 失败语义

- JSON 序列化、临时写入或替换失败时异常向上抛出，并清理临时文件；
- 单文件替换失败时保留旧目标；
- 嵌入缓存先构建 staging，切换失败时恢复旧目标；
- 源缓存不存在时，以空目录完整替换目标缓存。
