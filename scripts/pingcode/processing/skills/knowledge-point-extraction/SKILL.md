# 知识点提取 Skill

## 概述

从单个技术文档处理单元中提取结构化知识点候选。

## 目标

- 提取文档中的核心知识点，生成可追溯的 `knowledge_point` 候选
- 保留当前处理单元、已确认关键词上下文和逐字证据
- 不在本 Skill 中生成关键词、实体、关系或跨 chunk 推断结果

## 输入

- `chunks`：处理单元列表，固定 1 个
- `documentType`：文档类型（feature_design, test_design, principle_introduction, problem_analysis, general_technical）
- `extractionProfile`：提取配置
- `domain`：领域（默认 yashandb）
- `document`：文档元信息
- `keywordContext`：已确认关键词上下文

## 输出

- `results`：每个 chunk 的提取结果
  - `knowledgePoints`：知识点列表，包含 `title`、`statement`、`knowledgeType` 和逐字证据
  - `documentStructure`：文档结构信息
- `metadata`：处理元信息

## 工作流程

1. 读取文档原始标题、语义标题、摘要、领域术语和处理单元列表
2. 对当前处理单元提取知识点（title, statement, knowledgeType, evidenceText）
3. 可选识别当前处理单元文档结构（headingPath）
3. 输出结构化 JSON 结果

## 约束

- 每个知识点必须有原文证据
- 不添加外部知识
- 保留原始配置值
- 区分断言状态
- YAS- 和 ORA- 错误码分域
- 不输出 `keywordCandidates`、`entities`、`relations` 或 `uncertainItems`
- 不要求跨处理单元上下文补充

## 批量处理

一次 API 调用只处理 1 个 chunk，以保证单元级超时、失败隔离、审计和进度可观测。
