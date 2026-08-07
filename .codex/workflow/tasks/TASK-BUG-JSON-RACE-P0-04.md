# TASK-BUG-JSON-RACE-P0-04: 实现已提交快照读取与损坏隔离

## 元信息
- 状态: completed
- 分配: backend-worker / test-engineer
- 创建: 2026-08-07
- 预计完成: 2026-08-07
- 预计工时: 4 小时
- 依赖: TASK-BUG-JSON-RACE-P0-01、TASK-BUG-JSON-RACE-P0-03
- 需人类确认: 否
- 可并行: 是（可与元数据业务迁移前置测试并行）

## SMART 目标
在 4 小时内提供只读取已提交快照的流式 JSON/JSONL 接口，并按版本化阈值隔离单条可界定坏记录；整体完整性失败必须阻断且保留结构化诊断。

## 接口与伪代码
```python
records, issues = repository.read_committed_jsonl(
    snapshot_ref, artifact_name, corruption_policy
)
verify_commit_hash_before_use()
for line_number, byte_offset, raw_line in stream_lines():
    try: validate(json.loads(raw_line))
    except JSONDecodeError as exc: isolate_or_raise(exc, context)
validate_ids_and_references(records)
```

## 实施范围
- 新增 `ArtifactRecordDecodeError`、`ArtifactIntegrityError` 及 artifactPath/snapshotId/line/offset/hash/traceId 上下文。
- 可隔离坏行写 `quality/artifact-read-issues.jsonl`，仅保存脱敏摘要与原始行 hash。
- commit/manifest/schema、文件 hash、截断、引用完整性或阈值超限错误不可降级。
- 改掉 `LocalArtifactRepository.read_jsonl()` 静默跳过坏行的行为，仅为显式兼容调用保留受控策略。

## 验收标准
- [x] 单条独立坏行在阈值内生成中文质量问题，其他记录继续且阶段状态为 `completed_with_warnings`。
- [x] 文件 hash 不匹配、尾部截断、manifest/commit 损坏和引用失败明确抛 `ArtifactIntegrityError`。
- [x] 诊断包含路径、快照、行号、字节偏移和 hash，不保存完整敏感正文。
- [x] 阈值从版本化配置读取，业务代码无硬编码。
- [x] 100 个并发读取者读取同一快照不获取写锁且结果一致。

## 预计变更文件
- `scripts/pingcode/web/backend/app/repositories/artifact_repository.py`
- `scripts/pingcode/web/backend/app/repositories/README.md`
- `scripts/pingcode/web/backend/app/models.py`
- `scripts/pingcode/processing/artifact-integrity.yaml`
- `scripts/pingcode/web/backend/tests/test_artifact_repository.py`
