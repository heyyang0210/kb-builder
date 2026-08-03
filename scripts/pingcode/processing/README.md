# Processing 资源

本目录保存加工流水线的文件化 Skill、Prompt 和 Schema。当前实现采用三步知识加工流水线：资料预处理、知识提取、索引生成。默认质量分析任务执行 `keyword_analysis`，只调用关键词抽取 Skill 并生成关键词图谱；正式知识构建由用户在质量分析页确认关键词后显式触发 `formal_knowledge`，再生成知识点、实体和关系。元数据整理归入资料预处理阶段，证据校验、语义补充和跨 chunk 关系识别归入正式知识提取 Workflow Agent，不再作为前端独立阶段展示。

## Workflow Agent 架构（新）

知识提取阶段已重构为专有的 Workflow Agent 模块（位于 `web/backend/app/agents/`），采用 5 步工作流：

1. **任务规划**：按文档分组 chunk，确定 batch 策略（每批 3-5 个 chunk）
2. **批量提取**：一次 API 调用处理多个 chunk，system prompt 和 profile guidance 只发送一次
3. **证据校验 + 修复**：校验 evidenceText 是否在原文中，失败时重试或降级
4. **跨 chunk 关系识别 + 建立**：识别跨 chunk 的实体重复出现，建立关系记录
5. **结果聚合**：去重、合并、格式化输出

### 架构变更

**已移除的旧 Skill：**
- `document-enrichment` - 文档增强
- `image-caption` - 图片说明
- `knowledge-extraction` - 旧知识提取
- `semantic-enrichment` - 语义补充
- `semantic-quality-review` - 语义质量审查

**新工作流（3步）：**
1. `material_preparation` - 资料预处理
2. `knowledge_extraction` - 默认执行关键词抽取；正式知识构建才由 Workflow Agent 处理知识点、实体和关系
3. `index_generation` - 索引生成

相比原有架构，新 Workflow Agent 可节省 30-60% 的 token 消耗，并支持跨 chunk 关系识别。详细设计见 `web/backend/app/agents/README.md`。

单处理单元模型超时诊断工具位于 `diagnostics/`。它只读取现有运行产物并调用模型网关，不修改模型配置和正式加工产物；诊断用例放在 `knowledge-extraction-timeout-cases.json`，结果写入运行目录的质量诊断目录。

## Skill 目录

每个 Skill 至少包含：

```text
skill-id/
├── SKILL.md
├── skill.yaml
├── prompts/
│   ├── system.md
│   └── user.md
└── schemas/
    ├── input.schema.json
    └── output.schema.json
```

版本可以直接放在 Skill 根目录，也可以放在 `versions/<semver>/`。Registry 只读取 `status: published` 的版本，并拒绝绝对路径、目录穿越、缺失文件和非法 Schema。

未来 YashanDB 部署后，本目录仍作为导入、导出和灾备格式；数据库替换版本索引，不改变前端 API。

## 当前 API

```text
GET /api/processing/skills
GET /api/processing/skills/{skillId}
GET /api/processing/skills/{skillId}?version=1.0.0
GET /api/processing/prompts
GET /api/processing/prompts/{promptId}
GET /api/processing/prompts/{promptId}?version=1.0.0
POST /api/processing/prompts/{promptId}/drafts
GET /api/processing/prompt-drafts/{draftId}
PUT /api/processing/prompt-drafts/{draftId}
POST /api/processing/prompt-drafts/{draftId}/validate
POST /api/processing/prompt-drafts/{draftId}/test
POST /api/processing/prompt-drafts/{draftId}/publish
GET /api/processing/prompts/{promptId}/versions/{version}/diff
POST /api/datasets/{datasetId}/publish
DELETE /api/datasets/{datasetId}
```

Prompt ID 使用 `<skill-id>.<prompt-name>`，版本继承 Skill 版本。草稿保存到 Web 数据根目录的文件目录；Prompt 管理的样例试运行仍返回 `render_only`，真实加工模型调用由 `TrainingService` 通过文档生成器 Model Gateway 执行。

## 六步骤运行产物

```text
training-runs/<taskId>/
├── originals/
├── normalized/
├── mappings/
├── metadata/documents.jsonl
├── metadata/chunks.jsonl
├── metadata/structure-blocks.jsonl
├── extraction-results/knowledge-candidates.jsonl
├── uncertain-items/pending.jsonl
├── uncertain-items/resolved.jsonl
├── model-results/semantic-resolution.jsonl
├── final-results/knowledge.jsonl
├── final-results/rejected.jsonl
├── graph/nodes.json
├── graph/edges.json
├── quality/issues.json
└── run-report.json
```

步骤六另生成 `datasets/<datasetId>/` 消费目录。删除数据集只清理派生知识、规范化副本和图谱，永久保留 `originals/`、来源映射、元数据、质量问题、运行报告和删除审计。

资料预处理的专项设计见 `docs/01-PingCode资料预处理步骤详细设计.md`，其中规定 Office/PDF 转 Markdown、三层内容保留、来源映射、6000 字符结构化处理单元和单资源隔离重试。图谱只读取 `final-results/knowledge.jsonl`；模型结果缺少原文证据时只生成质量问题。

当前预处理默认从规范化加工视图排除 C/C++ 围栏代码块和 `src/.../*.c|*.h` 源码路径标记，原始文件永久保留。排除记录写入源文档的 `excludedRanges` 和 `normalizationEvents`；SQL、Shell、JSON 等非 C/C++ 代码块继续进入结构解析。

知识加工前端不提供预处理参数编辑入口。源文件检查只执行扫描、类型识别和单文件加工预览，不创建独立预处理任务；正式预处理仅由知识加工流水线第一步执行。预览和训练请求由后端统一应用结构优先、`maxUnitCharacters=6000`、`fallbackOverlapCharacters=0`、关闭 OCR 和排除 C/C++ 代码块的基线配置。`/api/preprocess/pipeline` 仅保留为兼容和专项调试接口。API 兼容读取历史 `chunkSize/chunkOverlap`，新响应和运行产物只输出设计字段；上传接口中的 `chunkSize` 表示网络传输分片，不属于文档处理单元配置。

加工任务页的实时活动默认按最近时间展示前 8 条，历史事件折叠到展开按钮中，避免长任务日志挤占主流程空间。质量问题明细只保留一个“预览”入口：前端复用 `/api/preprocess/preview` 打开大尺寸 Markdown 预览弹窗，默认进入渲染预览并渲染 Mermaid 图，同时保留原始 Markdown、清洗 Markdown 和差异对比标签。元数据质量分级遵循“自动兜底不告警、影响复验才提示、影响可靠性才警告/错误”：无正文标题但可用文件名时记录 `titleSource=filename`，不生成标题缺失问题；分类规则并列命中只生成 `METADATA_CATEGORY_CONFLICT` 提示，不作为警告。数据集版本支持前端删除，删除操作调用 `DELETE /api/datasets/{datasetId}`，只清理派生知识、规范化副本和图谱，继续保留原始材料、来源映射、质量问题、运行报告和删除审计；已删除版本不再在加工任务页展示。

质量未通过的数据集版本仍允许人工确认后强制发布：前端以“强制发布”展示并要求二次确认，后端 `POST /api/datasets/{datasetId}/publish?force=true` 会绕过质量门禁但仍禁止发布已删除版本。质量分析页使用中文核心质量指标，并通过图谱规模、节点/关系类型分布、力导向图和关系证据卡片展示知识图谱，避免只展示原始字段和少量样例表格。

五个后续步骤专项设计：

- `docs/11-PingCode元数据构建步骤详细设计.md`
- `docs/12-PingCode知识提取步骤详细设计.md`
- `docs/13-PingCode按需语义补充步骤详细设计.md`
- `docs/14-PingCode知识校验与合并步骤详细设计.md`
- `docs/15-PingCode图谱与数据集生成步骤详细设计.md`

当前正式语义 Skill：

- `keyword-extraction@1.1.0`：质量分析默认档使用。先由清洗标题、章节、正文和领域词典生成确定性候选；词典缺项但标题主题明确且有正文证据时也可生成 `deterministic_title_topic` 候选。仅对主题不明确或需要补充术语的处理单元调用模型。请求按输入预算跨文档动态组批，网络层不整批重试，单 chunk 格式问题只定向修复，已校验候选按正文、语义标题、规则、Skill 和 Prompt 版本缓存；
- `knowledge-extraction@2.0.0`：每次处理一个完整处理单元，输出知识点、实体、关系和不确定项；
- `semantic-enrichment@1.0.0`：每次只处理一个 `needs_enrichment`，不能替代完整知识提取。

关键词图谱生成后会写入数据集 `keyword-chunk-index.json`。正式知识构建只读取已确认关键词关联的处理单元；共享处理单元只抽取一次，并把全部 `keywordIds` 保留在正式知识结果中。
