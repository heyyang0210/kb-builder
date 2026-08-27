# TASK-RAG-KG-M2-LIN-2C-TST-01：冻结输入规则重建内核红灯测试

## 元信息

- 状态: completed
- 分配: test-engineer
- 创建: 2026-08-18
- 预计完成: 2026-08-19（2h）
- 父任务: TASK-RAG-KG-M2-LINEAGE-REWORK-01 / G-LIN-02 / 2C
- 依赖: G-LIN-02=`2A+2C` 已确认；2A 规则快照与 producer 契约已实现；不依赖公共 API 触发
- 需人类确认: 否（仅固化已批准的 2C 内核契约，不修改公共 API）
- 可并行: 否；是 2C 内核实现的前置任务
- 文件归属: 新建 `scripts/pingcode/web/backend/tests/test_keyword_rule_rebuild.py`；不修改业务代码

## SMART 目标

在 2 小时内建立可重复的失败测试，证明 2C 内核在冻结输入完整性、稳定 `rebuildKey`、并发合并、新 run/候选版本、旧产物不变和零模型调用方面未实现；测试失败原因必须是功能缺失，不是 fixture 或环境错误。

## 设计依据与内部接口

- 详细设计：`agent-runner/docs/modules/knowledge-graph-governance/development/16-m2-safe-publish-detailed-design.md` 第 2.4、3 节。
- 生产接线设计：`agent-runner/docs/modules/knowledge-graph-governance/development/17-m2-production-lineage-integration.md` 第 2.6、5、7 节。
- 预期内部接口：

```text
KeywordRuleRebuild.execute(
  frozen_source_refs,
  committed_rule_snapshot_ref,
  legacy_ref,
  extraction_executor
) -> RebuildResult
```

`extraction_executor` 只允许注入已有纯规则关键词提取器；测试必须以可观测调用计数证明模型网关调用为 0。

## 测试伪代码

```text
given verified frozen inputs + same-run committed rule snapshot
when execute twice with the same semantic inputs
then rebuildKey and committed result are identical
and exactly one new immutable result is published
and legacy bytes/hash/mtime are unchanged

given N concurrent calls with the same rebuildKey
when all calls finish
then one caller commits and the others verify/reuse that result
and rule extraction executes at most once for the successful key

given tampered input, cross-run rule ref, symlink, path escape or failed final CAS
when execute
then fail closed, publish no partial result and leave legacy unchanged
```

## 测试矩阵

| ID | 场景 | 断言 |
|---|---|---|
| 2C-T01 | 相同输入顺序打乱 | `rebuildKey`、candidate ID、排序和指纹一致 |
| 2C-T02 | normalized/processing-units 任一 bytes 变化 | key 变化；摘要不匹配时直接阻断 |
| 2C-T03 | 相同 key 的 8 个并发执行 | 最多一个完整提交，其余幂等返回 |
| 2C-T04 | 不同 key 并发 | 互不覆盖，不持有全局长锁 |
| 2C-T05 | 快照篡改、symlink、路径逃逸、跨 run 规则引用 | `ARTIFACT_INTEGRITY_ERROR` 且无新候选 |
| 2C-T06 | 最终 CAS/原子提交注入失败 | 没有半提交结果，可用同 key 重试 |
| 2C-T07 | 新规则重跑 | 创建独立 run/version，`rebuildOf` 和输入摘要齐全 |
| 2C-T08 | 纯规则路径 | candidate 版本证据覆盖率 100%，模型调用 0 |
| 2C-T09 | 完整执行前后 | legacy candidate bytes/SHA-256/mtime 全部不变 |

## 验收标准

- [x] 2C-T01—2C-T09 均有独立测试，且测试命名可追溯。
- [x] 红灯运行记录包含命令、失败数和预期缺失接口，不得通过 skip/xfail 伪造。
- [x] 未调用 `POST /api/training/tasks`，未改变 `sourceDatasetId` 语义。
- [x] 目标测试文件 `git diff --check` 通过。

## 验收记录

- 红灯：`KeywordRuleRebuild` 尚未实现时导入失败，未发现夹具或环境错误。
- 绿灯：实现后执行 `python3 -m unittest tests.test_keyword_rule_rebuild -v`，9/9 通过。
- `python3 -m py_compile tests/test_keyword_rule_rebuild.py` 和目标文件 `git diff --check` 通过。
- 未调用公共 API，未改变 `sourceDatasetId` 语义；旧 candidate 仅执行只读字节/SHA/mtime 对比。

## 边界

本任务提供 2C 内核红灯到绿灯的证据；不得将内核绿灯解释为 2C 业务恢复、真实 API 或 G2.5 通过。
