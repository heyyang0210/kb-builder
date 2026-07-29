# PingCode 知识校验与合并步骤详细设计

> 版本：v1.0
> 上位设计：`docs/08-pingcode-processing-six-step-pipeline-design.md`

## 一、范围与职责

知识校验与合并是第五个前端步骤，完全由代码执行，不调用 Agent 或大模型。它是模型结果进入最终知识前的唯一质量闸门。

## 二、输入

输入为 `extraction-results/knowledge-candidates.jsonl`、`model-results/semantic-resolution.jsonl`、步骤一的源文档、处理单元和 `mappings/*.json`、步骤二元数据以及版本化 Knowledge Schema。

## 三、校验与合并规则

1. 校验字段、类型、枚举、必填项和版本；
2. 按 `chunkId` 回查证据文本，验证证据与偏移精确一致；
3. 通过来源映射继续回查 PDF 页码、Office 段落、表格和单元格；
4. 校验关系源实体和目标实体可解析；
5. 区分 `YAS-`、`ORA-` 和其他领域；
6. 按类型、规范化名称、Schema 版本和来源建立稳定 ID；
7. 合并代码明确锚点、知识提取 Agent 和语义补充结果；
8. 代码明确证据优先，模型不能覆盖强证据事实；
9. 冲突、不完整证据、未知类型和无效端点写入拒绝记录和质量问题；
10. 只有通过全部校验的记录进入 `final-results/knowledge.jsonl`。

## 四、产物 Schema

`final-results/knowledge.jsonl`：

```json
{"knowledgeId":"knowledge_xxx","kind":"relation","sourceResourceId":"resource_xxx","chunkId":"resource_xxx:1","sourcePath":"docs/connection.md","value":{"source":"max_connections","target":"thread_pool_size","type":"COORDINATES_WITH"},"evidenceText":"该参数需要配合线程池设置。","evidenceOffsets":{"start":30,"end":45},"sourceLocations":[{"kind":"page","pageNumber":3,"blockIndex":2}],"confidence":0.86,"sourceMethod":"model_resolved","schemaVersion":"2.0.0","validationState":"passed"}
```

`final-results/rejected.jsonl` 记录候选 ID、来源方法、输入哈希、拒绝原因、严重度和审计关联，不保存完整 Prompt 或完整文档。`quality/issues.json` 合并前五步质量问题，按资源、代码和输入哈希去重；高严重度问题必须影响数据集质量标记，但不阻止步骤六生成候选数据集。

## 五、接口、伪代码与事件

```text
interface KnowledgeValidationStage:
  validate_inputs(context) -> ValidationResult
  execute(context) -> StageResult
  validate_outputs(context, result) -> ValidationResult

execute(context):
  load schema and validated upstream artifacts
  for candidate in extraction and enrichment results:
    validate schema, evidence, offsets, source mapping and endpoints
    if invalid: write rejected and issue
    else: normalize IDs and merge by configured keys
  write final knowledge atomically
  merge and deduplicate quality issues
```

事件：`stage.started`、`work_item.completed`、`work_item.failed`、`knowledge.rejected`、`stage.completed`、`stage.failed`。主消息使用中文。

## 六、失败、幂等与验收

单候选失败不阻塞其他候选；Schema、映射或最终文件无法加载时步骤失败，禁止构图。最终知识为空但存在通过证据校验的模型关键词时生成 `warning` 级 `FINAL_KNOWLEDGE_EMPTY`，允许步骤六生成“模型关键词降级图谱”；最终知识和有效模型关键词均为空时才生成阻断级错误。输入哈希、Schema 版本和步骤版本不变时复用结果，任何上游变化使本步骤失效并重新合并。验收覆盖无证据、错误偏移、关系端点缺失、代码与 Agent 冲突、重复知识合并、关键词降级和最终文件唯一输入约束。

## 七、当前实现说明

- 兼容阶段 ID 暂时使用 `validation_graph`，但本阶段实现只负责知识校验与合并，不再构建图谱；
- 重新读取 `extraction-results/knowledge-candidates.jsonl` 和 `model-results/semantic-resolution.jsonl`，不直接信任上一步内存对象；
- 按处理单元正文和 `documentOffsets` 精确校验证据与绝对偏移，并保留 `sourceLocations`；
- 按来源、规范化实体名称、类型、关系方向和 Schema 版本生成稳定 `knowledgeId`；
- `YAS-` 与 `ORA-` 错误码分别规范为 `YashanDBErrorCode` 和 `OracleErrorCode`；
- 无效 Schema、证据、偏移、关系端点和实体类型冲突分别写入 `final-results/rejected.jsonl` 与 `quality/issues.json`；
- 最终知识为空时读取 `extraction-results/keyword-candidates.jsonl`：存在有效关键词则 `FINAL_KNOWLEDGE_EMPTY` 为警告并允许发布降级图谱，不存在有效关键词则保持高严重度并阻断；
- 产物使用临时文件原子替换，步骤六必须重新读取 `final-results/knowledge.jsonl`。
