# RAG 评测集与指标设计

```yaml
documentType: evaluation-design
moduleId: knowledge-graph-governance
relatedRequirement: REQ-KGO-33
relatedTask: RG-13
status: review
decisionGate: G3
```

## 1. 评测目标

评测必须同时覆盖召回、证据、拒答和权限边界，不能用“接口成功”替代 RAG 质量。评测输入、标准答案、证据引用和运行配置均版本化；评测报告只引用脱敏的 `datasetId/versionId/chunkId/evidenceId`。

## 2. 100 条分层样本

| 层级 | 数量 | 验证重点 |
|---|---:|---|
| 事实查找 | 25 | 单文档事实、参数、错误码和步骤的证据召回 |
| 实体/关系 | 20 | canonical ID、关系方向、跨 chunk 证据 |
| 多跳问题 | 15 | 两跳以内的实体关系和上下文组装 |
| 版本/时效 | 15 | 产品版本、发布日期、废弃状态过滤 |
| 不可回答/拒答 | 15 | 无证据、冲突证据和超出范围时 abstain |
| ACL/数据集边界 | 10 | 匿名、跨数据集和无权证据不得召回 |

样本由四路各 25 条独立标注，使用固定 `evalSetVersion`；冲突由领域仲裁人处理，标注结果不得写回生产知识库。

## 3. 机器可读记录

```json
{
  "evalSetVersion": "eval-20260817-v1",
  "caseId": "case-0001",
  "question": "脱敏后的问题文本",
  "expectedAnswerable": true,
  "goldEvidenceIds": ["evidence-1"],
  "goldEntityIds": ["entity-yashandb"],
  "allowedDatasetIds": ["dataset-test"],
  "productVersion": "23.2",
  "tags": ["fact_lookup"],
  "annotatorIds": ["a1", "a2"],
  "adjudication": "consensus"
}
```

运行记录必须保存 `graphVersionId`、`indexVersionId`、`ruleVersion`、`embeddingVersion`（未启用时为 `not_applicable`）、过滤条件、top-k、超时和错误分类。

## 4. 指标和计算

- `Recall@K = 命中的 goldEvidence 数 / goldEvidence 总数`，无 gold 证据的拒答样本单独统计。
- `MRR = 1 / 第一个 gold 证据排名`，未命中记 0。
- `NDCG@K` 使用证据相关性 0/1/2 分级，报告 macro average。
- `Context Precision = 相关上下文 token / 返回上下文 token`。
- `Context Recall = 被返回的 gold 证据 token / gold 证据 token`。
- `Citation Correctness = 正确引用数 / 引用总数`；引用不存在或越权均为错误。
- `Faithfulness` 仅在存在标准证据时计算，答案中的可验证断言必须能映射到证据；无证据答案按失败处理。
- `Abstention Precision/Recall` 分别衡量拒答是否应拒答、应拒答是否确实拒答。

未获得 G3 阈值批准前，报告只输出指标和置信区间，不将建议阈值写成发布门禁。空集合、全拒答、无 gold 证据必须输出 `not_applicable`，不能当作 0 掩盖样本缺失。

## 5. 一致性与防泄露

标注者只能访问允许的数据集和版本；评测运行禁止读取未来版本或未发布图投影。任何 ACL 失败、引用漂移、gold 证据缺失或版本不一致都作为结构化评测问题，阻断该版本的 G3 评审。

## 6. 验收矩阵

| 场景 | 输入 | 预期 |
|---|---|---|
| 正常可答 | 有效问题、gold 证据 | 召回记录含 evidenceId 和版本 |
| 无证据 | 无匹配 chunk | `abstainReason=NO_EVIDENCE` |
| ACL | 无权 datasetId | 返回空结果并记录 `ACL_DENIED` |
| 冲突 | 两个版本相反事实 | 按版本过滤或结构化拒答，不静默合并 |
| 空集合 | 无 gold 证据拒答题 | 指标为 `not_applicable`，样本仍计入拒答统计 |

## 7. 待 G2/G3 确认

领域覆盖比例、标注人和仲裁资源、各指标阈值、P0/P1 门禁映射和评测环境容量。未确认前只允许使用隔离数据集生成设计报告。
