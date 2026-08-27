# TASK-RAG-KG-M2-LIN-2C-API-01：冻结 dataset 重建公共 API 接线

## 元信息

- 状态: in_progress（API-A 功能与测试完成；性能内存门禁独立收口中）
- 分配: planner / doc-writer / test-engineer / backend-worker
- 创建: 2026-08-18
- 预计完成: 设计冻结后 30h
- 父任务: TASK-RAG-KG-M2-LINEAGE-REWORK-01 / G-LIN-02 / 2C
- 依赖: TASK-RAG-KG-M2-LIN-2C-BE-01（局部内核）；KRN/FRZ/PERF 必须先于 API 接线
- 需人类确认: 已完成（2026-08-18 常设推荐方案授权，选择 API-A）
- 可并行: 新测试可并行；共享实现文件按依赖串行
- 文件归属: 见“实施任务”；旧的“只改 training_service.py 即可接线”结论已废止

## SMART 目标

在 30 小时工程窗口内，先修复 2C 同 run 证据、追溯、上下文、崩溃恢复和资源边界，再实现请求时冻结，最后接 API-A 真实 FastAPI；全程不读 `latest`、不改旧产物、不写目标生产 dataset。

## 方案选择记录

| 项 | 内容 |
|---|---|
| 候选 A（推荐） | 保留 `POST /api/training/tasks` 和现有字段，定义 `mode=keyword_analysis + sourceDatasetId` 为从指定 dataset 冻结输入重建 |
| 候选 B | 新增 `rebuildFromTaskId` 可选字段，通过原 run 再定位 dataset |
| 候选 C | 新增受限 repair endpoint 或内部维护命令 |
| 推荐选择 | API-A |
| 推荐理由 | A 不增请求字段并复用 admission；但现有 dataset 不是可信历史冻结包，必须先创建明确的请求时快照 |
| 主要风险 | 改变 `sourceDatasetId` 在 keyword 模式下的既有行为；老客户端可能在不知情时触发新 run |
| 缓解 | 仅在 `keyword_analysis` 且 source dataset 通过全部自洽/完整性检查时执行；明确事件与 `rebuildOf`；不允许发布状态越级 |
| 回滚条件 | 旧客户端兼容异常、dataset 自洽误判、重建重复提交或任一旧产物变化 |
| 回滚方式 | 停止 API 触发并恢复原 `sourceDatasetId` 处理；保留已提交新候选为不可变审计产物，不回写 legacy |
| 确认来源 | 用户于 2026-08-18 授权后续待确认方案默认采用推荐方案并记录；据此选择 API-A |
| 适用边界 | 仅 keyword 规则重建；不适用 formal knowledge、ACL、publish、图数据库或原地修复 |

## P0 与实施任务

现有内核存在 dataset 非可信冻结、规则证据跨 run、`rebuildOf` 不完整、executor 无 rebuild context、错误/artifact 契约缺失、8k 内存无界和崩溃接管缺口。在修复前不得直接接公共路由。

| 顺序 | 任务 | 独占范围 | SMART 验收 | 时限 |
|---:|---|---|---|---:|
| 1 | API-DES-01 | 三份设计与本卡 | Schema、伪代码、错误和决策一致 | 2h |
| 2 | KRN-TST-02 -> KRN-BE-02 | 新契约测试；`production_lineage.py` | 同 run/rebuildOf/context/rename/stale/零模型全绿 | 6h |
| 3 | FRZ-TST-01 -> FRZ-BE-01 | 新冻结测试；`production_lineage.py` | 请求时冻结全摘要、稳定 digest、旧文件不变 | 6h |
| 4 | PERF-BE-01 | 内核与性能测试 | 1k/8k 吞吐、P50/P95、RSS、I/O、锁等待 | 4h |
| 5 | API-TST-01 -> API-BE-01 | 新 API 测试；`training_service.py`、`main.py` | 真实路由同步/异步错误、兼容、并发、artifact | 7h |
| 6 | API-ACC-01 | 测试与验收记录 | 回归、py_compile、diff-check、生产零写入 | 3h |

执行链：`DES -> KRN -> FRZ -> PERF -> API -> ACC -> Reporter`。同一实现文件不得并行编辑。

## API-A 预期请求与校验

```json
{
  "mode": "keyword_analysis",
  "sourceDatasetId": "dataset_1d7438983dc34062"
}
```

服务端必须现场检查：

1. dataset 存在且根目录通过 containment/非 symlink/普通文件检查。
2. 请求 batch 与 dataset `batchId` 一致，dataset 是 keyword candidate 状态。
3. dataset manifest 身份自洽；异步创建绑定 manifest/source/normalized/processing 全摘要的 `request_time_snapshot`。
4. 新 run 写 `rebuildOf={datasetId,taskId,inputDigest}`，不从文件时间或 `latest` 推断历史 run。
5. 相同 `rebuildKey` 返回已重验结果；异常返回结构化 reasonCode/requestId。

轻校验同步、重摘要与执行异步。第一阶段只在 `progressDetail.rebuildResult` 暴露 artifact，不创建或冒充 DatasetVersion。

## 验收标准

- [x] Product Owner 已通过常设推荐方案授权确认 API-A，且决策文档已更新。
- [x] 内核同 run、完整 rebuildOf、context、崩溃接管红灯转绿。
- [x] 请求时冻结全量绑定且 1k/8k 执行有界；最终内存门禁由 PERF-BE-01 继续跟踪。
- [x] 真实 FastAPI 路由覆盖成功、dataset 不存在、跨 batch、非 keyword 状态、manifest 矛盾、摘要漂移、同 key 重试和并发。
- [x] 旧 candidate bytes/SHA-256/mtime 前后不变；新 run/候选版本和 `rebuildOf` 可追溯。
- [x] 模型网关调用为 0，candidate 规则快照引用覆盖率 100%。
- [x] 公共契约、设计、测试记录和任务状态同步更新；聚焦回归、`py_compile` 和 scoped `git diff --check` 通过。

## 实施边界

不得新增隐蔽 repair 路由或用私有方法伪装真实 API。API-A、3A、4A 和 G2-03 已选；JWT issuer/audience/JWKS/claims 仍是部署参数，缺失时 fail-closed；方案授权不等于生产写入许可。
