# 关键词抽取 Skill

## 概述

用于质量分析默认档，只抽取可进入关键词图谱的主题关键词，不生成知识点、实体或关系。

## 输入

- `chunks`：处理单元列表，包含正文、章节路径和来源信息；
- `document`：文档标题、语义标题、摘要、分类和领域术语；
- `domain`：领域，默认 `yashandb`；
- `extractionProfile`：关键词抽取配置。

## 输出

- `results`：每个处理单元的关键词候选；
- `keywordCandidates`：包含 `name`、`aliases`、`category`、`evidenceSource`、`evidenceText`、`confidence` 和可选 `termId`；
- `metadata`：Skill 与处理统计。

## 约束

- 只输出关键词候选；
- 不输出知识点、实体、关系；
- 文档标题只能贡献语义子串，完整文件名不能作为关键词；
- 技术 ID、图片路径、`YashanDB`、`DSI`、副本编号、文件后缀和命名噪声不能作为关键词；
- 词典缺项不能阻止有证据的核心主题词进入候选。
