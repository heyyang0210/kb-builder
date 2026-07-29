# 知识点提取 Skill

## 概述

从技术文档处理单元中提取结构化的知识点、实体和关系，支持批量处理。

## 目标

- 提取文档中的核心知识点，生成可索引的知识条目
- 识别文档中的实体（参数、组件、错误码等）
- 建立实体之间的关系
- 为每个知识点生成关键词，支持全文检索

## 输入

- `chunks`：处理单元列表（1-5个）
- `documentType`：文档类型（feature_design, test_design, principle_introduction, problem_analysis, general_technical）
- `extractionProfile`：提取配置
- `domain`：领域（默认 yashandb）
- `document`：文档元信息

## 输出

- `results`：每个 chunk 的提取结果
  - `keywordCandidates`：从文档名称、主要描述内容和数据库领域术语联合发现的主题关键词
  - `knowledgePoints`：知识点列表，包含 `title`、`statement`、`knowledgeType` 和逐字证据
  - `entities`：实体列表
  - `relations`：关系列表
  - `documentStructure`：文档结构信息
- `metadata`：处理元信息

## 工作流程

1. 读取文档原始标题、语义标题、摘要、领域术语和处理单元列表
2. 对每个处理单元：
   - 提取知识点（title, statement, knowledgeType, evidenceText）
   - 提取主题关键词（name, aliases, category, evidenceSource, evidenceText, confidence）
   - 提取实体（name, type, evidenceText）
   - 提取关系（source, target, type, evidenceText）
   - 识别文档结构（headingPath）
3. 输出结构化 JSON 结果

## 约束

- 每个知识点必须有原文证据
- 不添加外部知识
- 保留原始配置值
- 区分断言状态
- YAS- 和 ORA- 错误码分域
- 词典缺项不能导致有证据的主题关键词被丢弃
- 完整文件名、产品范围词和文档命名后缀不能作为关键词

## 批量处理

一次 API 调用处理 1-5 个 chunk，减少 token 消耗。
