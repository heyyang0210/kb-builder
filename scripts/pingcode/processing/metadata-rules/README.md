# 元数据规则与数据库词典

本目录只维护当前生效的一套规则。历史版本由 Git 管理，不在目录中建立 `versions/`。

`yashandb-glossary.yaml` 不是示例文件，而是运行时实际加载的当前生效词典。当前 `maturity: initial` 表示它已经可以参与运行，但覆盖范围仍需根据官方文档持续补充，不能理解为完整的最终术语全集。

## 文件

- `manifest.yaml`：规则入口、规则版本和文件清单；
- `document-categories.yaml`：文档分类关键词及权重；
- `keyword-rules.yaml`：结构化关键词正则规则；
- `version-patterns.yaml`：产品版本识别正则；
- `database-glossary.yaml`：通用数据库术语；
- `yashandb-glossary.yaml`：YashanDB 专有术语、别名和官方来源；
- `stopwords.txt`：不作为关键词的通用词。
- `title-cleaning.yaml`：标题中的产品范围词、命名后缀、连接符和副本编号清洗规则。
- `embedding-rules.yaml`：资源预处理阶段 embedding 和聚类配置，包括 provider/profile/version/dimension/cache、聚类阈值和失败降级模式。
- `business-keyword-rules.yaml`：正式知识构建前的业务语义过滤规则，包括范围词、命名噪声、强主题词和排除正则。

## 关键词边界

- 完整文档标题和文件名不直接生成关键词；清洗后的 `semanticTitle` 作为模型主题发现输入，并允许提取有标题逐字证据的语义子串；
- `semanticTitle` 与该文档已命中的词典 canonical 名或别名逐字匹配时，可补充标题主题关键词；补充置信度由 `title-cleaning.yaml` 的 `titleGlossaryConfidence` 配置，正文中的偶然词典命中不触发该规则；
- 词典缺项但 `semanticTitle` 已去除命名噪声、不是停用词或技术 ID，并能在章节或正文中找到逐字证据时，可作为 `deterministic_title_topic` 候选进入关键词图谱；置信度和最大长度由 `titleTopicConfidence`、`titleTopicMaxCharacters` 配置；
- 元数据构建会把标题清洗审计写入 `titleNoiseRemoved`，把可确定主题写入 `topicCandidates`，并生成 `preselection-report.json`；报告状态仅允许 `deterministic_ready/model_required/human_review/skip`，供关键词默认档决定是否调用模型；
- `keywords` 只接收领域词典或 `keyword-rules.yaml` 受控规则命中的语义术语；
- `YashanDB`、`DSI` 等产品范围或文件命名词必须在 `stopwords.txt` 配置，不在 Python 中硬编码；
- 图谱构建防御性过滤完整标题、文件名主体和技术 ID；带稳定 `termId` 的领域词条及模型从标题提取的语义子串不受完整标题过滤影响。

## 正式构建前业务过滤

- 快速加工得到的关键词只是候选，不能直接进入正式知识构建；
- 正式知识构建必须同时满足关键词审批状态和业务准入状态：`approvalStatus in {autoAccepted, accepted}` 且 `businessStatus=businessAccepted`；
- `business-keyword-rules.yaml` 中的范围词、命名噪声词和技术标识排除正则只用于正式构建准入，不删除关键词图谱中的审计节点；
- 业务过滤结果写入 `quality/keyword-business-review.json`，并同步到图谱摘要，供质量分析页展示准入、排除、待确认和原因分布；
- 规则无法判断的关键词进入 `needsReview`，由前端人工确认后再进入正式知识构建。

## embedding 与聚类边界

- embedding 和聚类属于资源预处理增强产物，默认写入 `metadata/embedding-index.jsonl`、`quality/embedding-issues.json`、`metadata/cluster-report.json`、`quality/cluster-issues.json`；
- 第一版默认使用 `embedding-rules.yaml` 中的 `deterministic_hash` provider，保证本地和 CI 在没有外部 API Key 时也能生成稳定向量；
- 如果后续切换到网关 embedding provider，网关不可用、超时或维度不一致只写 warning，不阻断 `keyword_analysis`；
- embedding 缓存键由内容哈希、输入哈希、规则哈希、profile version、provider、model、dimension 和 textKind 共同决定；API Key 不进入缓存键，也不写入任何产物；
- cluster 只作为重复资料识别、抽取调度和质量分析提示依据，不直接生成关键词节点，不写入关键词图谱，也不接入 `formal_knowledge` 调度。

## 维护与发布

修改规则后由人工提交 Git。服务计算规则集内容哈希并写入元数据和图谱摘要；历史元数据关键词图谱的规则哈希不一致时，使用已保存的源文档和处理单元执行确定性刷新，不调用大模型。服务不读取或记录 Git commit。规则文件缺失、格式错误、重复 `termId` 或非法正则时，元数据步骤失败，不回退到 Python 内置规则。

YashanDB 词典可以使用官方文档 MCP 做离线校对和补充，但 MCP 查询结果必须人工整理为本目录中的可审计条目，并保留文档和章节来源；元数据构建运行期间不实时调用 MCP。
