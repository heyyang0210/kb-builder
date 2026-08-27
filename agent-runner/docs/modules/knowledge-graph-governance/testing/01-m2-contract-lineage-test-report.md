# M2 发布契约与 Lineage 回放测试报告

```yaml
documentType: test-report
moduleId: knowledge-graph-governance
relatedTasks: [RG-22, RG-24]
status: passed-with-integration-boundary
testedAt: 2026-08-18
```

## 1. 验收结论

| 任务 | 结论 | 证据 |
|---|---|---|
| RG-22 状态、发布与前后端契约 | 通过 | 真实 FastAPI 路由 5 个用例，Node 前端 helper 3 个用例 |
| RG-24 Lineage 重建与证据回放 | 通过模块级回归 | 独立回归 10 个用例，并复用图版本幂等用例验证 `graphVersionId` |

M2 相关合并回归 51/51 通过；独立 RG-22/RG-24 回归 18/18 通过。

## 2. 覆盖矩阵

| 风险 | 验证方式 | 预期与结果 |
|---|---|---|
| 合法发布 | `evaluated -> published` 调用真实 API | 200，`statusVersion` 仅加 1，通过 |
| 幂等发布 | 对已发布版本重复调用 | 不再增加状态版本，通过 |
| 越级发布 | `index -> published` | `STATE_INVALID_TRANSITION`，持久化状态不变，通过 |
| P0 绕过 | `force=true` 且 ACL/manifest 失败 | `PUBLISH_GATE_BLOCKED`，结构化失败项与中文动作，通过 |
| CAS 冲突 | 过期 `expectedStatusVersion` | `STATE_VERSION_CONFLICT`，当前版本不变，通过 |
| 历史兼容 | `governance == null` | 保留旧 `force` 语义，通过 |
| 前端契约 | Node 直接执行 `datasetGovernanceView` | manifest P0 禁用发布，中文阻断和下一步，通过 |
| 稳定引用 | 相同事实重建 manifest | citation/evidence ID、偏移、文本、哈希一致，通过 |
| 图版本稳定性 | 真实 API 重复发布同一图事实 | `graphVersionId` 一致且第二次复用，通过 |
| 快照缺失 | 注入空 snapshot loader | `FILE_SNAPSHOT_MISSING` + `isolated`，不返回原文，通过 |
| 哈希漂移 | 替换快照或 quotedHash | `FILE_SNAPSHOT_HASH_MISMATCH`/`EVIDENCE_QUOTE_HASH_MISMATCH` + `stale`，通过 |
| 偏移越界 | chunk end 超出快照 | `EVIDENCE_OFFSET_INVALID` + `isolated`，通过 |
| 父链缺失 | 移除 source/chunk | 构建阶段拒绝或回放阶段 `LINEAGE_PARENT_MISSING`，通过 |

## 3. 可复现命令

```bash
cd scripts/pingcode/web/backend
python3 -m unittest \
  tests.test_governance_state \
  tests.test_governance_publish_api \
  tests.test_lineage_manifest \
  tests.test_version_fingerprint \
  tests.test_m2_publish_contract \
  tests.test_m2_lineage_replay -v

python3 -m unittest \
  tests.test_graph_version_routes.GraphVersionRouteTests.test_publish_idempotency_lineage_and_non_final_boundary -v

python3 -m py_compile \
  app/governance_state.py app/lineage_manifest.py app/version_fingerprint.py \
  tests/test_m2_publish_contract.py tests/test_m2_lineage_replay.py

cd ../frontend
npm run build
```

## 4. 集成边界

- 前端当前没有独立测试框架；本轮使用 Node 直接导入 helper 完成可重复契约回归，并以 Vite 生产构建验证页面接线。
- `EvidenceReplay` 已具备不读取全局路径的注入式快照回放；ACL、citation 事实查询和安全审计仍属上层 API/服务边界，需由 RG-20/RG-23 在身份与 ACL 方案确认后验收。
- Vite 构建通过，但仍存在超过 500 kB 的分包告警；属现有前端体积问题，不阻断 RG-22/RG-24。
