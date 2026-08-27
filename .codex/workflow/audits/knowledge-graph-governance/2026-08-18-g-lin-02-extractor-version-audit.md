# G-LIN-02 提取器版本只读审计

> 适用范围：M2 安全可发布基础 / G-LIN-02
> 审计日期：2026-08-18
> 状态：已完成事实审计；`2A+2C` 已由用户确认
> 操作边界：只读，不修改历史产物、运行状态、代码或配置

## 1. 目标与范围

本审计判断 `training_c56bf44e9e6f4fc4` 的历史 keyword candidates 是否存在可验证的提取器版本证据，并为 `2A+2C` 的实施建立可重验基线。范围仅包括：

- 训练运行目录：`scripts/pingcode/runtime/web/training-runs/training_c56bf44e9e6f4fc4`
- 数据集目录：`scripts/pingcode/runtime/web/datasets/dataset_1d7438983dc34062`
- candidate 镜像、run/dataset manifest、run report，以及三份后置 keyword filter snapshot
- 记录结构、版本字段、运行归属、`sourceMethod` 分布和可恢复性分类

本审计不读取或输出 candidate 正文、服务端 stack、文档内容及其他敏感字段，也不宣称完成新 producer、2C 重跑、真实训练 API 接线或发布验证。

## 2. 只读方法

Backend Worker 与 Test Engineer 对相同冻结输入独立执行了只读审计；Doc Writer 又重算了文件大小、原始 SHA-256、镜像字节比较、filter snapshot 条数以及辅助 multiset digest。使用的方法为：

1. 用 `stat`、`wc -l` 和 `sha256sum` 固定输入身份。
2. 用 `cmp -s` 验证 run 与 dataset candidate 镜像逐字节一致。
3. 使用 Python 标准库逐行 `json.loads`，只累计结构、字段存在性、ID、run/stage 和 `sourceMethod`；不记录正文。
4. 检查 run/dataset manifest、run report 和同目录可发现的规则/filter snapshot 引用，判断是否存在与目标 run 绑定的完整规则事实。
5. 依据已确认的 `2A` 证据门槛分类：只有同 run、已提交、由 manifest 哈希绑定且覆盖完整规则事实的 snapshot 才可恢复版本；否则逐条隔离。

未启动后端服务、未调用写 API、未修改 runtime 文件时间或内容。

## 3. 输入身份

| 输入 | 字节数 | SHA-256 | 用途 |
|---|---:|---|---|
| `scripts/pingcode/runtime/web/training-runs/training_c56bf44e9e6f4fc4/extraction-results/keyword-candidates.jsonl` | 46,458,586 | `b23f0a8b73b9e72648a848c9b4ac4423c033adbc248725d1c6826ef1e79f3e92` | run candidate 主输入 |
| `scripts/pingcode/runtime/web/datasets/dataset_1d7438983dc34062/keyword-candidates.jsonl` | 46,458,586 | `b23f0a8b73b9e72648a848c9b4ac4423c033adbc248725d1c6826ef1e79f3e92` | dataset candidate 镜像 |
| `scripts/pingcode/runtime/web/training-runs/training_c56bf44e9e6f4fc4/run-manifest.json` | 3,882 | `6b27c060a9b6020336669ff7a8d20a34c0cf0b83195baace21cefe53bfd9c984` | run/stage 与流水线版本证据 |
| `scripts/pingcode/runtime/web/datasets/dataset_1d7438983dc34062/manifest.json` | 324,555 | `bdfb4c5049a355d5a858f7938f5541df83299c74342b012671cd31bcb1f4884b` | dataset 产物清单 |
| `scripts/pingcode/runtime/web/training-runs/training_c56bf44e9e6f4fc4/run-report.json` | 4,250 | `1a6678167cef8c834c94cf4a3936ee11fe6a3bb33e0f6a5c1163eebad9a39d1a` | run 摘要 |
| `scripts/pingcode/runtime/web/datasets/dataset_1d7438983dc34062/run-report.json` | 4,250 | `1a6678167cef8c834c94cf4a3936ee11fe6a3bb33e0f6a5c1163eebad9a39d1a` | dataset run 摘要镜像 |
| `scripts/pingcode/runtime/web/datasets/dataset_1d7438983dc34062/keyword-filter-runs/kfr_113cd2383e0f47cc8b61c93e255cbb78/candidate-snapshot.json` | 2,159,225 | `a4466a2bd8724dbdd2cdd2fc00317cb27eafac452530d5af4baf901a8bfaed58` | 643 条后置筛选快照 |
| `scripts/pingcode/runtime/web/datasets/dataset_1d7438983dc34062/keyword-filter-runs/kfr_608d5aa4f47e43efbe955c882f259528/candidate-snapshot.json` | 2,159,225 | `a4466a2bd8724dbdd2cdd2fc00317cb27eafac452530d5af4baf901a8bfaed58` | 643 条后置筛选快照 |
| `scripts/pingcode/runtime/web/datasets/dataset_1d7438983dc34062/keyword-filter-runs/kfr_65f657db9ca5455bba7b087db336735e/candidate-snapshot.json` | 2,159,225 | `a4466a2bd8724dbdd2cdd2fc00317cb27eafac452530d5af4baf901a8bfaed58` | 643 条后置筛选快照 |

## 4. 核验结果

### 4.1 结构、归属与镜像

| 检查项 | 结果 |
|---|---:|
| candidate 总数 | 55,324 |
| 合法 JSON object | 55,324 |
| 空行 / 损坏行 | 0 / 0 |
| `candidateId` 存在 / 唯一 / 重复 | 55,324 / 55,324 / 0 |
| 缺少 `schemaVersion` | 55,324 |
| 缺少 `extractorVersion` | 55,324 |
| `taskId` 匹配目标 run | 55,324 |
| `stageRunId=stage-run:f3f645761f4a0ea1a41d` | 55,324，且与 run manifest 一致 |
| run/dataset candidate `cmp -s` | `0`，逐字节一致 |
| candidate 辅助 multiset digest | `2adf42f7f04a787678a97c07ac314275d4af503971fbf7b84a3d37213c7b4cf9` |

multiset digest 是“每条记录规范 JSON 的 SHA-256 原始 32 字节值排序后串联，再取 SHA-256”的辅助交叉检查。发布门禁应使用 manifest 绑定的正式 artifact hash；本审计的主完整性证据仍是文件大小、原始 SHA-256 和 `cmp=0`。

### 4.2 六组 `sourceMethod`

| `sourceMethod` | 数量 |
|---|---:|
| `deterministic_pattern_chinese_term` | 43,730 |
| `deterministic_content_glossary` | 9,872 |
| `deterministic_pattern_error_code` | 715 |
| `deterministic_title_glossary` | 644 |
| `deterministic_pattern_oracle_error` | 352 |
| `deterministic_title_fallback` | 11 |
| **合计** | **55,324** |

`sourceMethod` 只描述生成方式类别，不包含规则实现、配置、词表或代码版本，不能作为 `extractorVersion`。

## 5. 版本证据判定

目标 run manifest 只给出 `pipelineVersion=2.0`，未提供 keyword `extractorVersion`、已提交规则 snapshot、规则 artifact hash 或从 candidate 到该 snapshot 的绑定。以下材料均不能补足历史版本事实：

- **metadata rule set**：其 `metadataRuleSetHash` 属于元数据构建/图投影阶段，证据域不同，不能冒充 keyword extractor 版本。
- **filter snapshots**：三份快照各只有 643 条，是 2026-08-17 至 2026-08-18 形成的后置筛选输入；它们不覆盖 55,324 条生成事实，也没有证明生成时采用的规则实现。
- **current config**：当前配置可能在历史 run 后变化，且未被目标 manifest 哈希绑定；读取它会把现在状态伪造成历史事实。
- **Git 状态、提交或文件时间**：源码提交不能证明运行时实际加载的配置、部署包和规则资源，更不能建立 candidate 级绑定。

因此，记录结构合法、ID 唯一、run/stage 一致只能证明“这些记录属于该产物”，不能证明“由哪个确定版本的提取器生成”。

## 6. 分类与数量守恒

| 分类 | 数量 | 原因码 |
|---|---:|---|
| `RECOVERABLE` | 0 | 未发现满足 2A 门槛的同 run 已提交规则 snapshot |
| `ISOLATE` | 55,324 | `LEGACY_EXTRACTOR_VERSION_UNPROVEN` |

数量守恒成立：

```text
55,324 total = 0 RECOVERABLE + 55,324 ISOLATE
55,324 total = 43,730 + 9,872 + 715 + 644 + 352 + 11
```

该结论要求实施时逐条形成隔离/质量问题事实，不能把“全量需隔离”简化成删除文件或覆盖历史数据。

## 7. 已确认方案与实施边界

用户于 2026-08-18 确认 `G-LIN-02=2A+2C`：

- **2A**：新 producer 必须显式持久化 `extractorVersion` 及同 run 已提交规则 snapshot 引用；legacy 只有在 snapshot 的 run、commit、manifest hash、artifact hash 和完整规则事实均可验证时才恢复，否则逐条隔离。
- **2C**：以冻结的 normalized 输入重新执行规则提取，写入新的 run/候选版本；原 55,324 条 legacy 保持只读，不回填、不覆盖，也不把新结果冒充历史结果。
- 规则提取路径应记录模型状态为 `not_applicable`，且模型调用次数必须为 0。

用户同时确认：后续存在方案选择时，默认采用明确标注的推荐方案，但每次选择、依据、边界和结果必须写入可追溯文档。该授权不覆盖 AGENTS.md 规定必须人工确认的架构、破坏性、公共 API、外部依赖、安全或性能决策。

## 8. 隐私与证据边界

- 审计产物只保存聚合计数、标识符、路径、文件大小、摘要哈希和非敏感枚举。
- 不保存 candidate 正文、文档正文、服务端 stack、异常原文、用户信息或凭据。
- 本审计证明的是指定冻结文件在审计时刻的状态，不证明 runtime 未来不变；实施与验收必须重新计算哈希。
- 本审计没有发现可信历史 snapshot，不等于证明它在所有外部备份中不存在。若后续发现候选 snapshot，仍须按 2A 完整验证后才能改变单条分类。
- 未记录无法由 Doc Writer 独立复现的 ordered canonical digest；避免把算法不明确的摘要当成完整性证据。

## 9. 复现命令

以下命令只输出路径、大小、摘要和聚合统计；不得扩展为输出记录正文或 stack。

```bash
RUN=scripts/pingcode/runtime/web/training-runs/training_c56bf44e9e6f4fc4
DATASET=scripts/pingcode/runtime/web/datasets/dataset_1d7438983dc34062

wc -l "$RUN/extraction-results/keyword-candidates.jsonl" \
  "$DATASET/keyword-candidates.jsonl"
stat -c '%s %n' \
  "$RUN/extraction-results/keyword-candidates.jsonl" \
  "$DATASET/keyword-candidates.jsonl" \
  "$RUN/run-manifest.json" "$DATASET/manifest.json" \
  "$RUN/run-report.json" "$DATASET/run-report.json"
sha256sum \
  "$RUN/extraction-results/keyword-candidates.jsonl" \
  "$DATASET/keyword-candidates.jsonl" \
  "$RUN/run-manifest.json" "$DATASET/manifest.json" \
  "$RUN/run-report.json" "$DATASET/run-report.json"
cmp -s "$RUN/extraction-results/keyword-candidates.jsonl" \
  "$DATASET/keyword-candidates.jsonl"
echo $?
find "$RUN" "$DATASET" -type f \
  \( -iname '*rule*' -o -iname '*snapshot*' -o -iname '*manifest*' \) -print
rg -n 'extractorVersion|ruleSnapshot|ruleSet|pipelineVersion' \
  "$RUN/run-manifest.json" "$DATASET/manifest.json" "$RUN/run-report.json"
```

逐行聚合复核应使用 Python 标准库的 `json.loads`、`collections.Counter` 和 `hashlib.sha256`，只打印计数与摘要；机器可读结果见同目录 `g-lin-02-extractor-version-audit-summary.json`。
