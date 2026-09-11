# M1 契约设计验收矩阵

```yaml
documentType: acceptance-matrix
moduleId: knowledge-graph-governance
relatedTasks: [RG-08, RG-09, RG-10, RG-11, RG-12, RG-13]
status: review
decisionGate: G2
```

## 1. 执行分层

| 层级 | 允许的测试 | 数据范围 | 目标 |
|---|---|---|---|
| 单元/Schema | 本地 fixture | 脱敏最小样本 | 字段、ID、状态和错误分类正确 |
| 契约 | 本地适配器 | 固定版本 fixture | 请求/响应、过滤和幂等一致 |
| 真实 API | 隔离数据集 | S 基线，禁止生产写入 | 验证加工、查询、发布门禁和审计 |
| 故障注入 | 隔离服务/适配器 | 受控超时、损坏、限流 | 验证隔离、重试、降级和恢复 |
| 性能 | 专用环境 | S/M/L 规模 | 记录 P50/P95、吞吐、内存和并发，不提前承诺阈值 |

## 2. 六类验收矩阵

| 类别 | 正常 | 边界 | 失败/恢复 | 安全/门禁 | 证据 |
|---|---|---|---|---|---|
| 状态/API | keyword→formal→index→evaluated→published | 重复请求、旧客户端字段 | CAS 冲突、取消后新版本重试 | 越级发布、P0 阻断 | statusVersion、reasonCode、requestId |
| Lineage | source→chunk→evidence→graph→index→citation | 空偏移、重复内容 | 损坏、删除、哈希不一致 | 失效引用不得漂移 | 快照哈希、回放文本和偏移 |
| ACL | dataset 权限继承至查询 | 空权限、单 resource 授权 | 身份服务超时、审计写失败 | 匿名、跨数据集、直接 ID | `ACL_DENIED`、审计事件 |
| Ontology | 合法实体/关系入库 | 别名、版本、重复实体 | 悬空边、无证据边、坏记录 | Entity/Relation 缺失阻断发布 | quality issue、隔离记录 |
| 检索 | sparse-only 稳定召回 | 空结果、重复候选 | 适配器超时、dense disabled | 先 ACL/版本过滤，证据不足拒答 | candidate、citation、abstain |
| 评测/发布 | 生成可复现报告 | 空 gold、全拒答 | 指标缺失、版本不一致 | P0 阻断，P1/P2 告警 | evalSetVersion、指标报告 |

## 3. 每条用例的最小记录

```json
{
  "caseId": "RG14-STATE-001",
  "layer": "real_api",
  "datasetId": "isolated-rag-fixture",
  "input": {"versionId": "v1", "expectedStatusVersion": 2},
  "expected": {"httpStatus": 409, "code": "STATE_VERSION_CONFLICT"},
  "evidence": ["requestId", "auditEventId", "artifactHash"],
  "cleanup": "delete_isolated_dataset",
  "productionWrite": false
}
```

## 4. 发布准入

RG-16 之前只能提交设计和隔离 fixture 验收。G2 通过的必要条件是六类 Schema 无冲突、每类存在正常/边界/失败/安全用例、ACL 缺口有实现任务、外部适配器保持 disabled、P0 风险有阻断处置。任一条件不满足，RG-15 标记 `rework`，不得开始业务实现。

## 5. 待确认项

认证方式、隔离数据集创建/清理权限、真实 API 环境、性能压测配额及图数据库 disabled 运行方式由 G2/G4 确认。
