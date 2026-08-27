# TASK-RAG-KG-M2-LIN-2C-FRZ-KRN-INT-01：冻结包与重建内核桥接

## 元信息

- 状态: completed
- 分配: planner / test-engineer / backend-worker
- 创建: 2026-08-18
- 父任务: TASK-RAG-KG-M2-LIN-2C-API-01
- 依赖: FRZ-BE-01、KRN-BE-02
- 需人类确认: 已完成（按常设授权采用设计文档中的推荐接口）
- 文件归属: `production_lineage.py`、新建集成测试；与性能任务串行

## 问题证据

设计接口为 `KeywordRuleRebuild.execute(rebuild_input_ref, ...)`，但当前实现仍要求旧的 per-resource `frozen_source_refs`。`KeywordRebuildInputFreezer.freeze()` 返回的 `CommittedRebuildInputRef` 使用 `rebuild-input/v1` manifest/commit，无法被旧快照验证器直接消费。未修复前接入 API-A 会出现“冻结成功但重建入口不兼容”。

## 推荐方案与选择记录

- 候选 A（推荐并采用）：内核将 `CommittedRebuildInputRef` 作为生产入口，直接重验 `rebuild-input/v1` 的 commit、manifest 和 artifacts；旧 refs 只保留为内部兼容入口。
- 候选 B（未采用）：把冻结包伪装成旧 LocalArtifactRepository per-resource snapshot。该方案复制旧物理契约、增加多份 manifest，且容易造成 run/dataset 身份混淆。
- 选择来源：用户 2026-08-18 常设授权，默认采用有证据支持的推荐方案并记录。
- 回滚条件：关闭 API-A 触发语义；保留冻结包和只读验证，不删除已提交 artifact。

## 接口与伪代码

```text
KeywordRuleRebuild.execute(rebuild_input_ref, rule_descriptor, rebuild_of, executor)
  verified = verify_rebuild_input_commit_manifest_artifacts(rebuild_input_ref)
  require rebuild_of.datasetId == verified.datasetId
  require rebuild_of.inputDigest == verified.inputDigest
  records = verified.stream_records_bounded(batch_size)
  return execute_same_run_rule_rebuild(records, ...)
```

## SMART 验收

- [x] 冻结器输出可直接进入内核，不读取 `latest`，不依赖绝对路径信任。
- [x] commit/manifest/artifact 任一漂移均 fail-closed。
- [x] dataset/task/inputDigest 身份贯通且 candidate 规则引用属于同一 rebuild run。
- [x] 旧内核回归保持通过；新增真实临时目录集成测试全绿。
- [x] 为 PERF-BE-01 暴露有界 record batch 入口，不在 API 层重新解析文件。

## 验证证据

- `test_keyword_rebuild_input_integration`：3/3 通过。
- 冻结、2C 内核、契约和桥接/性能联合回归：34 项通过。
- `CommittedRebuildInputRef.manifestPath` 已改为数据根相对路径；绝对路径不被信任。
