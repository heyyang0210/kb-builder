# M2 安全可发布基础设计决策

```yaml
documentType: design-decision
moduleId: knowledge-graph-governance
relatedTasks: [RG-17, RG-18, RG-19, RG-20, RG-21, RG-22, RG-23, RG-24, RG-25]
status: approved-with-security-blockers
decisionGate: G2.5
```

## 1. 目标与边界

M2 交付“不可错误发布、不可越权读取、证据可重放”的最小基础。本阶段不引入图数据库、向量库或新模型 Provider，不改变旧 API 字段语义。

## 2. 已选择方案

| 决策 | 方案 | 理由 |
|---|---|---|
| 事实源 | JSON/JSONL 不可变快照 | 与存储引擎解耦，支持审计和重建 |
| 指纹 | `sha256-v1` | 成熟、可携带算法版本，便于未来迁移 |
| 发布 | 发布前完成 P0 门禁，CAS 更新指针 | 防止越级、并发覆盖和 `force` 绕过 |
| ACL | 默认拒绝，必须在数据源查询前过滤 | 避免先读取后过滤造成泄露 |
| 错误 | 结构化错误码 + 脱敏详情 + requestId | 既可诊断又不泄露资源存在性 |
| 前端 | 新治理数据读 `governance`，历史数据保持兼容 | 遵循已确认的方案 A |
| Source occurrence 身份 | `G-LIN-01=1A`：逻辑身份由 `datasetId + resourceId + contentHash` 组成；Lineage 新写仅使用 Schema `2.0`，Schema `1.0` 仅读 | 保留相同正文的不同来源、URI 和未来 ACL 语义，同时避免破坏历史回放 |
| Keyword extractor 版本 | `G-LIN-02=2A+2C`：新 producer 显式持久化 `extractorVersion` 和已提交规则快照引用；legacy 只从同 run 的可信快照恢复，否则逐条隔离；当前 YashanDB 批次从冻结 normalized 输入重跑到新候选版本 | 既不伪造历史版本，也让无法证明版本的存量数据有可审计恢复路径 |

### 2.1 G-LIN-01 决策记录

| 字段 | 内容 |
|---|---|
| 决策 | `1A` |
| 确认日期 | 2026-08-18 |
| 确认来源 | Product Owner/用户在当前任务会话明确回复“`1A`” |
| 决策范围 | Source occurrence v2 逻辑身份、Lineage Schema 升版、v1 只读兼容、歧义旧包和回滚边界 |
| 仍未确认 | `G-LIN-02-API`、`G-LIN-03`、`G-LIN-04`、`G2-03`、`JWT-DEPENDENCY` |

`1A` 只解除 P0-01 的 Source/Schema 设计门禁，不等于 M2、G2.5 或生产发布已获批。精确编码、兼容和回滚契约见详细设计与生产接线文档。

### 2.2 G-LIN-02 决策记录

| 字段 | 内容 |
|---|---|
| 决策 | `2A + 2C` |
| 确认日期 | 2026-08-18 |
| 确认来源 | Product Owner/用户在当前任务会话明确回复“`2A + 2C`” |
| `2A` | 新 producer 的每条 keyword candidate 显式写 `extractorVersion`；legacy 只有在同一 run 的规则快照已提交、由 manifest 哈希绑定且覆盖完整规则事实时才允许恢复版本，不能证明的记录逐条隔离 |
| `2C` | 当前 YashanDB 任务不修改 legacy 产物，基于冻结 normalized snapshot 启动新的规则提取运行，生成独立 run、候选版本和治理证据 |
| 实现证据 | 2A 已实现 `KeywordRuleSnapshot`、`KeywordExtractorVersion.resolve`、producer 显式 `schemaVersion/extractorVersion/extractorSnapshotRef` 和规则路径 `model=None/modelStatus=not_applicable`；2026-08-18 六模块组合回归 166 项，164 passed、2 skipped |
| 风险 | 2A 只防止新产物继续丢失版本证据，不会恢复目标 55,324 条 legacy；2C 未完成前不得宣称存量业务结果已恢复 |
| 回滚条件 | 新快照无法重验、candidate 引用不一致、规则路径发生模型调用或旧产物摘要改变时，停止新写/重跑并保持 legacy 只读，不回填当前版本 |
| 禁止项 | 不读取当前配置、当前源码、Git 时间、文件 mtime 或人工默认值推断历史版本；不原地覆盖 legacy JSONL；不把新运行结果声明为历史运行的原结果 |
| 仍未确认 | `G-LIN-02-API`、`G-LIN-03`、`G-LIN-04`、`G2-03`、`JWT-DEPENDENCY` |

可信规则快照至少绑定 producer 名称与实现版本、规则/配置文件逐项摘要、规则集合摘要、pipeline/schema 版本和输入快照摘要；缺少任一必需事实或 commit/manifest 校验失败时，结果是 `LEGACY_EXTRACTOR_VERSION_UNPROVEN`，不是自动回填。规则重跑仍是纯规则路径，模型状态必须为 `null + not_applicable`。

目标 run 的双角色只读审计结论为：`RECOVERABLE=0`、`ISOLATE=55,324`，未发现可信同 run 规则快照；run `training_c56bf44e9e6f4fc4` 与 dataset `dataset_1d7438983dc34062` 两份 candidate 均为 `46,458,586` bytes，`cmp=0`，完整 SHA-256 为 `b23f0a8b73b9e72648a848c9b4ac4423c033adbc248725d1c6826ef1e79f3e92`，候选记录全部结构合法且 ID 唯一。实施时仍须现场重算摘要，不能只信任文档。因此该目标 run 的 2A 路径只能隔离，实际业务恢复必须走 2C 新候选；不能因记录结构合法而推断 extractor 版本可信。

`G-LIN-02-API` 的证据核验已确认：现有 `TrainingTaskCreate.sourceDatasetId` 可指向 dataset，目标 dataset manifest 唯一绑定 `datasetId/taskId/batchId` 并包含 normalized/processing-units 冻结副本。候选 A（推荐）保持路由和字段不变，把 `mode=keyword_analysis + sourceDatasetId` 明确定义为“从该 dataset 冻结输入重建”，服务端校验 dataset 存在、同 batch、keyword 候选态、manifest/taskId 一致并现场生成输入摘要；新 run 写 `rebuildOf={datasetId,taskId,inputDigest}`。候选 B 是新增可选 `rebuildFromTaskId`，候选 C 是新增受限 repair endpoint/内部维护命令。A 的改动最小、关联确定且可走真实 API，但仍扩展公共字段行为，尚未获批；禁止通过共享 `latest`、文件时间或字段语义猜测 prior run。

### 2.3 后续待确认项默认决策治理

| 字段 | 内容 |
|---|---|
| 授权 | 对后续非受限待确认项，在候选方案和证据充分时默认采用有证据支持的推荐方案并继续实施 |
| 记录要求 | 每项必须记录候选方案、最终选择、证据与理由、风险、回滚条件、确认来源和适用边界 |
| 必须暂停 | 架构变更、破坏性变更、公共 API/既有行为变更、技术栈变化、新外部依赖、安全边界扩大，或证据不足/互相矛盾时，必须停止实施并请求 Product Owner 明确确认 |
| 确认来源 | Product Owner/用户于 2026-08-18 明确授权：“后续有需要确认的方案，默认采取推荐方案，但需记录方案选择” |

此治理规则不构成对 `G-LIN-02-API`、`G-LIN-03/04`、`G2-03` 或 `JWT-DEPENDENCY` 的预先批准，也不能把推荐方案状态写成“用户已确认”。凡触发必须暂停条件，保守默认是保持现状、禁止发布和不扩大权限。

## 3. 可立即执行与阻塞边界

| 任务 | 是否可立即执行 | 边界 |
|---|---|---|
| RG-17、RG-19、RG-24 | 是 | 按 `sha256-v1` 实现指纹和重放；保留期通过配置注入，不自行删除快照 |
| RG-18 | 是 | ACL 未判定时门禁为 false，不伪造通过结果 |
| G-LIN-02 / P0-02 | 部分 | 2A 规则快照、新 producer 和 legacy resolver 组件已实现；2C 冻结 dataset 新 run、`rebuildKey`/CAS 和公共 API 触发未实现，其中公共触发等待 `G-LIN-02-API`；不得猜测 prior run，历史产物保持只读 |
| RG-21 | 是 | 可展示默认拒绝和重试动作，不依赖真实身份源 |
| RG-22 | 部分 | 可做契约回归；真实授权路径等 RG-20 |
| RG-20、RG-23 | 阻塞 | 必须确认可信身份源、权限粒度、审计存储与保留/脱敏策略 |
| RG-25 | 阻塞 | RG-22—24 证据全部齐全才能通过 G2.5 |

## 4. 尚待人类确认

1. `G-LIN-02-API`：推荐保持 API 形态不变，扩展 `keyword_analysis + sourceDatasetId` 为冻结 dataset 重建；属于公共行为变更，需 Product Owner 明确确认。
2. `G-LIN-03`：数据集治理包的唯一发布权威与运行目录镜像语义。
3. `G-LIN-04`：keyword/formal 模式边界和偏移单位。
4. 身份来源：网关 JWT、现有会话还是平台 RBAC；在确认前一律 fail-closed。
5. ACL 粒度：建议首版以 dataset 为主、resource 只能收紧，deny 优先。
6. 审计策略：存储位置、保留期、查阅权限、IP 和 principalId 脱敏方式。
7. 快照保留期与 PDF/Office 精确定位范围；不影响字符偏移基线实现。
