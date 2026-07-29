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

## 关键词边界

- 完整文档标题和文件名不直接生成关键词；清洗后的 `semanticTitle` 作为模型主题发现输入，并允许提取有标题逐字证据的语义子串；
- `semanticTitle` 与该文档已命中的词典 canonical 名或别名逐字匹配时，可补充标题主题关键词；补充置信度由 `title-cleaning.yaml` 配置，正文中的偶然词典命中不触发该规则；
- `keywords` 只接收领域词典或 `keyword-rules.yaml` 受控规则命中的语义术语；
- `YashanDB`、`DSI` 等产品范围或文件命名词必须在 `stopwords.txt` 配置，不在 Python 中硬编码；
- 图谱构建防御性过滤完整标题、文件名主体和技术 ID；带稳定 `termId` 的领域词条及模型从标题提取的语义子串不受完整标题过滤影响。

## 维护与发布

修改规则后由人工提交 Git。服务计算规则集内容哈希并写入元数据和图谱摘要；历史元数据关键词图谱的规则哈希不一致时，使用已保存的源文档和处理单元执行确定性刷新，不调用大模型。服务不读取或记录 Git commit。规则文件缺失、格式错误、重复 `termId` 或非法正则时，元数据步骤失败，不回退到 Python 内置规则。

YashanDB 词典可以使用官方文档 MCP 做离线校对和补充，但 MCP 查询结果必须人工整理为本目录中的可审计条目，并保留文档和章节来源；元数据构建运行期间不实时调用 MCP。
