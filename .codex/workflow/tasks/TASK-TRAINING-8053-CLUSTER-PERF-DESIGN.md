# TASK-TRAINING-8053-CLUSTER-PERF-DESIGN: 大规模 embedding 聚类性能设计

## 元信息

- 角色: Backend Worker / 架构设计
- 状态: 设计完成，等待性能架构人工确认
- 日期: 2026-08-07
- 关联风险: `RISK-TRAIN-8053-006`
- 现场任务: `training_ca4bde5bb7ae453e`
- 约束: 本轮只设计，不修改功能代码；不重启 8001；不操作当前运行任务

## 现场结论

- metadata 已生成 13,015 条 embedding。
- 当前实现执行全量两两余弦：84,688,605 对，复杂度 `O(N^2 * D)`。
- 计算单线程运行，无取消检查、无父任务公开进度。
- `sklearn` 未安装；引入成熟 ANN/聚类库属于新增依赖和架构确认点。

## 方案决策表

| 方案 | 准确性 | 复杂度与内存 | 兼容性 | 业务语义 |
| --- | --- | --- | --- | --- |
| A 大规模跳过 | 无错误结果，但无聚类 | 时间 `O(ND)`；无候选内存 | 最简单，无依赖 | 大批次不再提供聚类，明显改变语义 |
| B 确定性 LSH + 精确候选 | 小样本精确；大样本无假阳性边、可能漏边 | 近似 `O(N log N + NkD)`；额外 `O(NT+k)` | 标准库、公共 API 不变 | 大样本为确定性近似连通分量，可能拆簇 |
| C 成熟依赖 | 由具体库保证 | 通常近似 `O(N log N)`，索引内存较高 | 新依赖、镜像、安全和跨平台风险 | 通常也是近似，需要库级参数治理 |

## 推荐

推荐 B：`N <= exactMaxEmbeddings` 保持现有全量精确结果；大样本采用多表确定性随机超平面 LSH，桶内有界窗口生成候选，候选内继续使用精确余弦阈值和 union-find。

建议初始参数进入 `embedding-rules.yaml`：`exactMaxEmbeddings=2000`、`lshTables=8`、`lshBits=12`、`maxCandidatesPerEmbedding=64`、固定 `lshSeed`。13,015 条向量的候选余弦上限为 832,960，相比现场全量比较减少约 99%。参数只是待基准校准的设计默认值，未获确认前不得实施。

## 接口与伪代码

```text
cluster.build(..., cancel_check=None, progress=None):
  load and normalize vectors; emit load_vectors
  if small sample: exact all-pairs
  else:
    build deterministic hyperplanes and table buckets
    for id in sorted ids:
      collect bounded bucket-window neighbors
      rank by shared tables then stable id; retain k
      exact cosine each candidate; union only above threshold
      emit candidate_comparison progress
  finalize components; persist report with strategy audit

metadata.build(..., cancel_check=None, progress=None):
  pass callbacks into cluster.build

training callback:
  map phases to metadata_construction.cluster.progress
  throttle public updates; never throttle cancel checks
```

## 复杂度与资源预算

- 精确路径: `O(N^2 * D)`，仅允许 `N <= exactMaxEmbeddings`。
- LSH 路径: `O(N*T*B*D + N*T*log N + N*k*D)`；固定 `T/B/k` 后接近 `O(N log N)`。
- 额外内存: LSH 桶 `O(N*T)`，单向量候选 `O(k)`；不构造全局候选 pair set。
- 准确性: LSH 只筛选候选，所有 union 边精确达阈值；可能漏边，不会因近似分数产生阈值以下连边。
- 确定性: 超平面、桶序、候选排序和输入 ID 顺序均由固定 seed/hash 决定。

## 测试任务

- [ ] 小样本逐成员对比旧全量算法，结果完全一致。
- [ ] 重排输入后候选计数、成员和 `clusterId` 一致。
- [ ] 统计余弦调用次数，断言大样本 `<= N*k`。
- [ ] 合成簇和抽样真实向量对比全量基线，报告 pair/component recall。
- [ ] load/signature/bucket/compare/finalize 各阶段取消测试。
- [ ] 父任务进度单调及节流测试。
- [ ] 13,015 x 64 维性能与峰值内存基准。
- [ ] embedding、metadata、training 相关完整回归。

## 人工确认

- [ ] 用户确认采用 A、B 或 C。
- [ ] 若采用 B，用户确认接受大样本近似候选可能拆簇，并确认参数基准门槛。
- [ ] 若采用 C，先批准新增依赖、部署镜像和安全评审。
- [ ] 未确认前不得修改 `embedding_cluster_service.py`、配置或调用链。
