# TASK-RAG-KG-M2-LIN-2C-PERF-BE-01：2C 有界执行与性能基线

## 元信息

- 状态: in_progress
- 分配: backend-worker / test-engineer
- 创建: 2026-08-18
- 预计完成: 内核与冻结适配完成后 4h
- 父任务: TASK-RAG-KG-M2-LIN-2C-API-01
- 依赖: KRN-BE-02、FRZ-BE-01
- 需人类确认: 已完成（常设授权选择先观测基线、不硬编码 SLA）
- 可并行: 否；性能改动独占 `production_lineage.py`
- 文件归属: `scripts/pingcode/web/backend/app/production_lineage.py`、新建 `scripts/pingcode/web/backend/tests/test_keyword_rule_rebuild_performance.py`

## SMART 目标

在 4 小时内把冻结验证与规则执行改为按 resource 流式或有界批次处理，并形成 1k/8k 隔离数据性能基线。

## 验收标准

- [ ] 内存随配置批次而非总文档数线性增长，队列有界并具备背压。
- [ ] 记录吞吐、P50/P95、峰值 RSS、读写字节、锁等待和重试数。
- [ ] 相同 key 单飞、不同 key 并行；模型调用为 0。
- [ ] 未测量前不硬编码毫秒 SLA，性能结果写入验收文档。

## 已完成的实现与基线（2026-08-18）

- 内核新增 `CommittedRebuildRecordStream` 和 `execute_batch` 执行协议；批大小默认 128、实现测试使用 64，单批上限 512；候选/隔离结果直接追加到 staging JSONL。
- 冻结包提交时将 `processing-units.jsonl` 按 resource/chunk 规范排序，生产 executor 不再在 API 层全量重排。
- 1k/8k 隔离基线测试：`tests.test_keyword_rule_rebuild_performance` 通过；模型调用为 0、批大小 64、1k 为 16 批、8k 为 125 批、锁等待和重试均为 0。
- 实测（当前固定临时目录 fixture）：1k `elapsedMs=1329.85`、`peakPythonBytes=2595275`、读/写字节 `520102/1680838`；8k `elapsedMs=10900.38`、`peakPythonBytes=19434172`、读/写字节 `4174104/13419841`。

## 当前验收结论

性能基线已具备，但“内存随批大小而非总文档数增长”尚未满足：当前 manifest/artifact 元数据、全局 candidate ID 去重集合仍随文档数增长，8k 峰值 Python 分配约为 1k 的 7.5 倍。该证据已记录为下一修订点，API-A 不得把当前基线宣称为最终 S/M/L 性能门禁。
