# TASK-P2-01: 正式知识 Schema 最小闭环 - Review 报告

**任务 ID**: TASK-P2-01  
**优先级**: P2  
**EPIC**: EPIC-04  
**状态**: ✅ 已完成并验证通过  
**Review 日期**: 2026-08-04

---

## 一、任务目标

定义并稳定正式知识候选的最小字段，确保每条知识可追溯。

## 二、验收标准

### 2.1 必需字段完整性

每条知识候选必须包含以下字段：

| 字段 | 类型 | 说明 | 验证结果 |
|------|------|------|----------|
| `state` | string | 固定为 `agent_resolved` | ✅ 通过 |
| `kind` | string | 固定为 `knowledge_point` | ✅ 通过 |
| `keywordIds` | array | 关联的关键词 ID 列表（去重并排序） | ✅ 通过 |
| `keywordContext` | array | 关键词上下文（去重并排序） | ✅ 通过 |
| `chunkId` | string | 处理单元 ID | ✅ 通过 |
| `evidenceText` | string | 证据文本 | ✅ 通过 |
| `sourceResourceId` | string | 源资源 ID | ✅ 通过 |
| `sourcePath` | string | 源文件路径 | ✅ 通过 |
| `confidence` | float | 置信度分数 | ✅ 通过 |

### 2.2 去重与排序规则

- **keywordIds**: 按 `keywordId` 字典序排序，自动去重
- **keywordContext**: 按 `keywordId` 字典序排序，自动去重

**验证结果**: ✅ 通过  
**实现代码**: `training_service.py:2335-2347` (`_normalize_formal_keyword_context`)

### 2.3 证据文本可回查

证据文本必须能在处理单元原文中精确回查，并计算正确的偏移量。

**验证结果**: ✅ 通过  
**实现代码**: `training_service.py:4058-4063` (`_validate_knowledge_candidates`)

### 2.4 无证据知识过滤

无证据或证据不匹配的知识点不能进入候选结果。

**验证结果**: ✅ 通过  
**拒绝代码**: `KNOWLEDGE_EVIDENCE_INVALID`  
**实现代码**: `training_service.py:4058-4063`

### 2.5 安全性

输出不包含完整 Prompt 或 API Key。

**验证结果**: ✅ 通过

---

## 三、输入/输出产物

### 3.1 输入

- `extraction-results/formal-knowledge-input.json`

**结构**:
```json
{
  "sourceDatasetId": "dataset-xxx",
  "acceptedKeywordIds": ["kw:acid", "kw:consistency", "kw:transaction"],
  "rejectedKeywordIds": ["kw:backup", "kw:scope"],
  "scheduledChunkIds": ["chunk-1", "chunk-2"],
  "chunkKeywordMap": {
    "chunk-1": ["kw:acid", "kw:transaction"],
    "chunk-2": ["kw:consistency", "kw:transaction"]
  },
  "filteredKeywordCount": 2,
  "deduplicatedChunkCount": 2
}
```

**生成逻辑**: `training_service.py:1457-1495` (`_formal_keyword_input_plan`)

### 3.2 输出

- `extraction-results/knowledge-candidates.jsonl`

**每条记录结构**:
```json
{
  "candidateId": "candidate:6d96dbd70ed0573a119a",
  "taskId": "task-formal-001",
  "stageRunId": "stage-run:7abce18172fe1823ae1a",
  "state": "agent_resolved",
  "kind": "knowledge_point",
  "resourceId": "resource-1",
  "sourceResourceId": "resource-1",
  "chunkId": "chunk-1",
  "sourcePath": "事务管理.md",
  "value": {
    "title": "事务 ACID 特性",
    "statement": "YashanDB 支持事务的 ACID 特性，确保数据一致性。",
    "knowledgeType": "technical_fact"
  },
  "evidenceText": "YashanDB 支持事务的 ACID 特性，确保数据一致性。",
  "evidenceOffsets": {
    "start": 100,
    "end": 131
  },
  "sourceMethod": "knowledge_extraction_workflow_agent",
  "schemaVersion": "2.0.0",
  "inputHash": "abc123def456",
  "confidence": 0.95,
  "agentTaskId": "agent-123",
  "modelCallId": "call-456",
  "keywordIds": ["kw:acid", "kw:consistency", "kw:transaction"],
  "keywordContext": [
    {"keywordId": "kw:acid", "canonicalName": "ACID"},
    {"keywordId": "kw:consistency", "canonicalName": "一致性"},
    {"keywordId": "kw:transaction", "canonicalName": "事务"}
  ]
}
```

**生成逻辑**: `training_service.py:2289-2347` (`_model_knowledge_candidate`)

---

## 四、测试验证

### 4.1 单元测试

**测试文件**: `tests/test_training_service.py`  
**测试用例数**: 67  
**通过率**: 100% (67/67)

**关键测试用例**:
- `test_model_knowledge_candidate_marks_agent_resolved_and_sorts_keyword_ids`: 验证 keywordIds 和 keywordContext 的去重排序
- `test_validation_rejects_bad_offsets_and_unresolved_relation_endpoints`: 验证证据偏移校验
- `test_formal_knowledge_point_candidate_keeps_keyword_and_model_trace`: 验证追踪字段完整性

### 4.2 验收标准验证

执行 19 项检查，全部通过：

| 类别 | 检查项 | 结果 |
|------|--------|------|
| 必需字段 | state/kind/chunkId/sourceResourceId/sourcePath/confidence | ✅ 通过 |
| keywordIds | 去重 + 排序 | ✅ 通过 |
| keywordContext | 去重 + 排序 | ✅ 通过 |
| evidenceText | 原文回查 | ✅ 通过 |
| evidenceOffsets | 偏移计算 | ✅ 通过 |
| 安全性 | 无敏感信息 | ✅ 通过 |
| schemaVersion | 版本 2.0.0 | ✅ 通过 |
| 追踪字段 | candidateId/taskId/stageRunId/agentTaskId/modelCallId | ✅ 通过 |

### 4.3 验证逻辑测试

- ✅ 无证据知识被拒绝（`KNOWLEDGE_EVIDENCE_INVALID`）
- ✅ 证据不匹配被拒绝
- ✅ 正常知识点通过验证

---

## 五、发现的问题与修复

### 5.1 问题：acceptedKeywordIds 包含被拒绝的关键词

**问题描述**: `_formal_keyword_input_plan` 方法中，`acceptedKeywordIds` 从 `keyword_context_by_chunk` 中提取所有关键词，未排除 `rejectedKeywordIds` 中的关键词。

**影响**: 被拒绝的关键词会出现在输入计划中，导致不必要的处理。

**修复方案**: 
1. 先计算 `rejected_ids`
2. 在计算 `accepted_ids` 时排除 `rejected_set`
3. 在计算 `chunk_keyword_map` 时排除 `rejected_set`
4. 过滤掉没有关键词的 chunk

**修复代码**: `training_service.py:1457-1495`

**验证结果**: ✅ 通过

---

## 六、依赖关系

- **前置任务**: TASK-P0-02（Formal Knowledge Workflow Agent）、TASK-P2-00（关键词确认）
- **后续任务**: 
  - TASK-P2-02（实体与关系抽取拆分）
  - TASK-P2-03（知识校验与拒绝原因落盘）

---

## 七、结论

✅ **TASK-P2-01 所有验收标准已满足**

- 正式知识候选 Schema 完整，包含所有必需字段
- keywordIds/keywordContext 去重并按 keywordId 稳定排序
- 证据文本能在处理单元原文中回查
- 无证据知识不能进入候选结果
- 输出不包含完整 Prompt 或 API Key
- 单元测试 67/67 通过
- 验收标准验证 19/19 通过

**建议**: 任务完成，可进入 TASK-P2-02 开发阶段。

---

## 八、附录

### A. 关键代码位置

| 功能 | 文件 | 行号 | 方法/函数 |
|------|------|------|-----------|
| 正式知识输入计划 | `training_service.py` | 1457-1495 | `_formal_keyword_input_plan` |
| 正式知识候选生成 | `training_service.py` | 2289-2347 | `_model_knowledge_candidate` |
| 关键词上下文规范化 | `training_service.py` | 2335-2347 | `_normalize_formal_keyword_context` |
| 知识候选验证 | `training_service.py` | 3998-4100 | `_validate_knowledge_candidates` |
| 正式知识提取主流程 | `training_service.py` | 3500-3660 | `_extract_formal_knowledge` |

### B. 相关文档

- `docs/12-PingCode知识提取步骤详细设计.md`
- `docs/14-PingCode知识校验与合并步骤详细设计.md`
- `docs/18-PingCode知识提取与构建测试设计.md`
- `docs/19-YashanDB资料加工平台工程化任务拆分.md`
