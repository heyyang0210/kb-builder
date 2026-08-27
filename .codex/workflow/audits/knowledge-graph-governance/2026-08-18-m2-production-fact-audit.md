# M2 生产事实只读审计 — 2026-08-18

## 审计范围

- 批次：`batch_dc23fc9141ba4d6f`
- 训练运行：`training_c56bf44e9e6f4fc4`
- 准备快照：`prep_9363854ba18d41bb`
- 操作边界：只读统计和摘要；未修改运行产物、业务状态或目标批次。

## 核验结果

| 项目 | 结果 | 证据边界 |
|---|---:|---|
| source documents | 10,100 | preparation manifest 已提交产物 |
| 唯一 normalized hash | 7,779 | 按 `normalizedHash` 统计 |
| 重复额外 occurrence | 2,321 | `10,100 - 7,779` |
| 最大重复组 | 2,027 | 同一 normalized SHA-256 |
| 最大组 SHA-256 | `7aadaeb9804a87b2d6133aba35f768e07d80ef330901e0f81cd8998da00548eb` | 实际 normalized bytes 重算一致 |
| 最大组字节数 | 1,658 | 所有 occurrence 相同 |
| preparation 状态 | 569 `completed`；1,458 `completed_with_warnings` | 未被标记为转换失败 |
| converter | 569 `text-reader`；1,458 `libreoffice` | 错误正文来自下载源内容，转换器只按普通内容处理 |
| 独立 `CONVERSION_FAILED` | 189 | 与最大组 resourceId 交集为 0 |
| 污染 chunks | 2,027 | 每个错误 occurrence 生成一个 chunk |
| 污染 keyword candidates | 2,027 | 均从错误信封中的 `index` 提取为 `Index` |
| 污染 graph edges | 2,027 | `CONTEXT_MATCHES_CHUNK`，上下文包含错误信封 |
| 非法 evidence offsets | 2,027 | 所有污染边均为 `start=-1,end=-1` |

最大重复组不是普通的“正文包含 400402”，而是完整 JSON 错误信封。脱敏结构为：顶层及嵌套 `error` 均包含 `code=400402` 和 `message=This operation is not allowed`，并带服务端 stack。审计记录不保存完整 stack、文件名或正文。

## Legacy Keyword 版本事实

- 55,324 条 keyword candidates 中，`schemaVersion/extractorVersion` 均缺失。
- 全部记录的 `stageRunId=stage-run:f3f645761f4a0ea1a41d`，与 run manifest 的 knowledge extraction stage 一致。
- run manifest 只提供 `pipelineVersion=2.0`，没有可证明具体提取规则实现的 `extractorVersion` 或规则快照。
- `metadataRuleSetHash` 属于元数据/图投影事实，不能冒充 keyword extractor 历史版本。

因此，现有运行只能证明候选属于同一已提交阶段，不能证明其具体提取器版本。历史记录仍应按 G-LIN-02 处理：有可信 run 级规则快照才补全，否则逐条隔离。

## 根因结论

1. `400402` 污染发生在下载/输入质量边界：上游权限错误响应被保存为普通文件。
2. preparation 只判断文件可读/可转换，没有识别“完整错误信封”，因此将其标记为成功。
3. 规则抽取从错误 stack 的 `index` 单词生成候选，随后进入图投影。
4. 仅依赖 `processingStatus=conversion_failed` 无法隔离此类输入；仅做字符串包含判断又会误伤合法文档。

## 修复约束

- 在 preparation 生成 source document/chunk 前识别完整错误信封，而不是在 Lineage 阶段删除既成事实。
- 识别规则必须解析完整 JSON，并匹配配置化的 provider error envelope 契约或已批准内容指纹；禁止只搜索 `400402`。
- 规则配置和版本必须进入 preparation manifest；不能把 provider code/message 硬编码在业务流程中。
- 每个 occurrence 写入 `SOURCE_ERROR_ENVELOPE` 质量问题，保留 resourceId、provider code、脱敏摘要和快照 hash，不保存 stack。
- 错误 occurrence 进入 source/chunk/evidence/graph/index 的数量必须为 0，正常正文包含 `400402` 时不得误隔离。

## 复核方式

最终修复验收需由只读脚本从 preparation manifest、source documents、chunks、keyword candidates 和 graph edges 重新计算上述计数；本次数字只代表指定快照，不得硬编码为业务常量。
