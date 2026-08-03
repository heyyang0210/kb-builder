请根据以下 JSON 上下文，为每个处理单元抽取质量分析关键词。

{{context_envelope}}

输出要求：
- 只返回 JSON。
- `evidenceSource` 只能是 `title`、`heading`、`content` 或 `domain_glossary`。
- `evidenceText` 必须是标题、章节、正文或领域术语中的逐字证据。
- 每个处理单元最多输出 `contextEnvelope.maxCandidatesPerChunk` 指定的关键词数，只保留主主题、核心对象和关键机制。
- `chunks` 可以来自不同文档；必须按每个 chunk 自带的 `document` 上下文判断，不能把一个文档的标题、摘要或术语套用到另一个 chunk。
