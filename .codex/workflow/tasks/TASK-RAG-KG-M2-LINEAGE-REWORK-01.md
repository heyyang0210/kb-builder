# TASK-RAG-KG-M2-LINEAGE-REWORK-01：生产 Lineage 接线审查修订与决策门禁

## 元信息

- 状态: in_progress
- 阻塞分类: partially-unblocked（G-LIN-01 与 G-LIN-02 已确认；G-LIN-03/04 和安全门禁仍阻塞）
- 分配: Planner / Architect / Backend / Test / Doc
- 创建: 2026-08-18
- 计划: 决策确认后 3 个工作日，P0/P1/P2 每个工作包不超过 4h
- 父任务: RG-17、RG-19、RG-24、RG-25
- 依赖: `17-m2-production-lineage-integration.md`、`20-m2-provider-error-envelope-boundary-design.md`、production_lineage 组件审查报告
- 需人类确认: 是（Lineage ID/schema、历史兼容、提交权威目录、模式契约均属于架构/公共事实契约）
- 可并行: 决策前仅文档和测试夹具可并行；业务代码必须按 P0 → P1 → P2 串行

## 当前结论

G-LIN-01 的 Source/Schema **组件实现已完成**：新写仅输出 Schema `2.0`，Source occurrence 逻辑身份为 `datasetId + resourceId + contentHash`，物理 ID 为 `source:v2:<sha256(canonical-json(logicalKey))>`；Schema `1.0` 仅支持原规则验证和回放，验证结果明确返回 `LEGACY_SOURCE_IDENTITY_AMBIGUOUS` 并保持发布阻断。PL-B01—B06 已完成，组合回归共 73 项：71 passed、2 skipped（PL-A18/A23 等待 G-LIN-04）；Python 编译和目标文件 `git diff --check` 通过。

上述证据只证明组件边界。`G-LIN-02=2A+2C` 已确认；2A 规则快照、`KeywordExtractorVersion.resolve`、新 producer 显式写入 `schemaVersion/extractorVersion/extractorSnapshotRef` 和规则路径 `modelStatus=not_applicable` 已实现。2C 内核现已实现：冻结输入现场重验、稳定 `rebuildKey`、按 key reservation/CAS、锁外规则计算、独立新 run/候选版本和旧产物不可变；2C 专项 9/9 通过，与既有组件组合回归 175 项（173 passed、2 skipped）。legacy 无可信快照时仍逐条隔离，绝不改写旧产物。`G-LIN-02-API` 公共触发、真实 training API、生产 governance package 或 publish 验证仍未接入，也未迁移 dataset/normalized 物理路径；现有 snapshotId 布局及 containment、普通文件、symlink 防护保持不变。G-LIN-03/04、供应商错误信封输入隔离和生产门禁仍未完成，因此任务继续为 `in_progress`。

双角色只读审计已给出目标 run 基线：55,324 条 legacy keyword candidates 中 `RECOVERABLE=0`、`ISOLATE=55,324`，不存在可信同 run 规则快照；run `training_c56bf44e9e6f4fc4` 与 dataset `dataset_1d7438983dc34062` candidate 各为 46,458,586 bytes、`cmp=0`，完整 SHA-256 为 `b23f0a8b73b9e72648a848c9b4ac4423c033adbc248725d1c6826ef1e79f3e92`，记录结构合法且 candidate ID 唯一。实施时仍须现场重算摘要。该基线证明 2A 对目标 run 不会恢复记录，不能把“结构合法”误判成“版本可信”；恢复业务结果必须走 2C。

## 决策门（必须先确认）

| 门 | 推荐方案 | 未确认前的约束 |
|---|---|---|
| G-LIN-01 source identity | **2026-08-18 已确认并完成组件实现**：逻辑身份为 `datasetId + resourceId + contentHash`，`sourceId=source:v2:<sha256(canonical-json(logicalKey))>`；Schema `2.0` 新写、`1.0` 仅读/回放，歧义旧清单阻断发布 | PL-B01—B06 已通过；不解除 G-LIN-02—04，不代表生产接线完成 |
| G-LIN-02 历史 keyword 记录 | **2026-08-18 已确认 `2A+2C`；2A 组件已完成**：新产物显式写 `extractorVersion` 和同 run 已提交规则快照引用；旧 candidate 仅从 manifest 哈希绑定且覆盖完整规则事实的快照恢复，否则逐条隔离；2C 将从冻结 normalized 输入重跑为新版本 | 目标 run 预期 `0` 恢复/`55,324` 隔离；禁止当前配置/源码/Git 时间推断、原地改写或把新结果冒充历史结果；2C 实现、公共 API 触发与真实回归仍待完成 |
| G-LIN-02-API 2C 触发 | **推荐、未确认**：保持请求字段不变，把 `mode=keyword_analysis + sourceDatasetId` 定义为指定 dataset 冻结输入重建；校验同 batch、keyword 候选态和 manifest/taskId，写 `rebuildOf={datasetId,taskId,inputDigest}` | 公共行为变更须 Product Owner 明确确认；未确认前不接 2C API。备选为新增 `rebuildFromTaskId` 或受限 repair endpoint；禁止读取 `latest` |
| G-LIN-03 提交权威性 | dataset `governance/` 为唯一发布权威；training-run 只做可重建审计镜像，使用提交状态/指纹关联，不声称两目录跨进程事务 | 不执行“双目录同时原子提交”的伪事务方案 |
| G-LIN-04 模式与偏移契约 | keyword 固定 model/embedding 状态和 graphSource 边界；formal 要求真实 Agent 版本快照；manifest 声明 `offsetUnit=unicode_code_point`，跨语言展示时显式转换 | 不接受调用方任意 model、graphSource 或未声明 offset 的输入 |

## P0 工作包：生产不可错误接线（决策后串行）

| 编号 | 内容 | 独占文件 | 验收标准 |
|---|---|---|---|
| P0-01 | **部分完成**：G-LIN-01 source identity、Schema 双读/新写和 PL-B01—B06 已完成；仍需按 [错误信封边界设计](../../../agent-runner/docs/modules/knowledge-graph-governance/development/20-m2-provider-error-envelope-boundary-design.md) 在 preparation 输入边界隔离完整 provider 错误信封 | `preparation_service.py`、`production_lineage.py`、`lineage_manifest.py`、对应新测试 | 组件已证明同内容不同资源保留独立 occurrence、同资源重复拒绝、v1 歧义阻断；尚需真实 10,100/8,053 样本与 2,027 个错误 occurrence 隔离验收 |
| P0-02 | **2A 已实现，2C 内核已实现，公共触发待接线**：`KeywordRuleSnapshot`/新 producer 版本字段/旧 candidate 解析隔离已落地；`KeywordRuleRebuild` 已完成冻结输入、`rebuildKey`/CAS、独立新 run 和规则-only 约束；公共触发等待 G-LIN-02-API | `training_service.py`（规则快照、producer；独占串行）、`production_lineage.py`（legacy resolver/rebuild kernel）、对应测试 | 新 candidate 版本证据覆盖率 100%；目标 legacy `0` 恢复/`55,324` 可定位隔离；旧产物完整摘要不变；2C 同 rebuildKey 只提交一个新结果；模型调用为 0/状态 `not_applicable`；不得把 evidence=0 假报为通过 |
| P0-03 | dataset 权威治理包提交与 store gate 顺序固化；发布入口只信任 dataset 包，run 副本可重建 | `production_lineage.py`、`services.py`、发布契约测试 | 任一治理文件写失败、损坏或 dataset 包缺失时 `manifest=false`；不出现 run/dataset 分叉后仍可发布；发布指针保持不变 |

## P1 工作包：安全与完整性硬化

| 编号 | 内容 | 独占文件 | 验收标准 |
|---|---|---|---|
| P1-01 | evidence 输入类型和 issues JSONL 全量校验，单条非对象隔离；issues 文件纳入治理包自校验 | `production_lineage.py`、新建完整性测试 | `null/array/string` evidence 仅生成质量问题；损坏 issues 不可提交；manifest/version/issue 三者均能回放验证；PL-A01、A16、A17 通过 |
| P1-02 | normalized 路径 realpath containment、路径分隔符和 symlink 拒绝 | `production_lineage.py`、安全路径测试 | 目录外 symlink、`../`、绝对路径和非法路径形态均 fail-closed；合法 normalized snapshot 仍可回放；PL-A12—A15 通过 |
| P1-03 | 模式边界强校验：keyword/formal 的 model、embedding、graphSource、extractor snapshot | `production_lineage.py`、模式契约测试 | keyword 不接受 available model/final graph；formal 缺真实模型版本时阻断；未启用项只写 `null + not_applicable` |

## P2 工作包：长期一致性和可运维性

| 编号 | 内容 | 独占文件 | 验收标准 |
|---|---|---|---|
| P2-01 | rename 后 fsync 异常可幂等确认既有完整包，避免“返回失败但正式目录已存在” | `production_lineage.py`、故障恢复测试 | 重试能识别同 fingerprint 的完整包；不重复覆盖、不误报失败 |
| P2-02 | overlap 父 chunk 同 resource/ordinal 校验；producer chunk/evidence ID 唯一性完善 | `production_lineage.py`、关系完整性测试 | 跨 resource 父引用、重复 `(resourceId, chunkIndex)`、重复 evidence source 均隔离或整体失败分类正确；PL-A20—A22、A27 通过 |
| P2-03 | graph/index/rule 输入规范化排序，manifest 声明 offset 单位；补非 BMP 字符和稳定指纹回归 | `production_lineage.py`、`version_fingerprint.py`、跨语言 fixture | 同一事实不同遍历顺序指纹一致；emoji/非 BMP 偏移回放与前端展示一致 |

## 依赖与执行顺序

```text
G-LIN-01=1A 已确认
  -> P0-01 Source/Schema 组件实现完成（PL-B01—B06）
G-LIN-02=2A+2C 已确认
  -> P0-02 红灯测试 -> 规则快照/producer -> legacy 隔离 -> 2C 内部编排
G-LIN-02-API 待明确确认
  -> 确认后接 existing POST /api/training/tasks 真实 2C 回归；确认前禁止改变 sourceDatasetId 行为
G-LIN-03/04 待确认
  -> P0-01 的 preparation detector 与 P0-02 的 training producer 可在文件集合完全不重叠时并行
  -> 任何涉及 production_lineage.py 或 training_service.py 的工作必须声明独占并串行
  -> P0-03（services.py 串行）
  -> P1 安全/完整性硬化
  -> P2 稳定性
  -> 真实 FastAPI 回归与 RG-25 证据汇总
```

## 总体验收门槛

- [ ] 生产 8,000+ 文档隔离样本生成的 source/chunk/evidence 数量与质量问题报告可解释，重复内容不再错误终止整批。
- [ ] G-LIN-02 目标 run 的 55,324 条 legacy 分类与审计基线一致；2C 使用冻结输入生成独立可验证候选，旧 candidate 的 bytes/SHA-256 前后不变，模型调用数为 0。
- [ ] keyword/formal 两模式的版本、模型、图来源和偏移契约与产物事实一致。
- [ ] dataset 治理包、normalized snapshot、issues、version fingerprint 均可独立校验，损坏和路径逃逸均 fail-closed。
- [ ] 真实发布 API 在治理包损坏、缺失、篡改、CAS 冲突和 `force=true` 下越权成功数为 0。
- [ ] RG-17/19/24 任务卡和 M2 验收记录更新为生产接线真实结论；RG-20/23 仍未完成时不得通过 G2.5。
- [ ] Python 语法、聚焦单测、真实 FastAPI/TestClient、回放重建、`git diff --check` 全部有证据。

## 非目标

本任务不实现 ACL 身份解析、权限继承、审计后端、图数据库或新的模型 Provider；不删除历史快照，不修改目标生产批次，不把组件测试绿色解释为生产发布已安全。

## 后续待确认项治理

Product Owner 已授权：非受限待确认项在候选方案与证据充分时，默认采用有证据支持的推荐方案继续推进；任务记录必须包含候选方案、选择、理由、风险、回滚条件、确认来源和适用边界。以下情况仍必须暂停并请求明确确认：破坏性变更、公共 API/行为变更、技术栈变化、新外部依赖、安全边界扩大，或证据不足/互相矛盾。该授权不等于预先批准 G-LIN-02-API、G-LIN-03/04、G2-03 或 JWT 依赖，保守状态始终是“不发布、不扩大权限、不改写历史事实”。
