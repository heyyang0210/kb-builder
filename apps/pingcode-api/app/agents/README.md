# Workflow Agent 模块

## 概述

Workflow Agent 模块提供正式知识构建能力。当前知识加工流水线已经收敛为四个前端可见阶段：资料预处理、元数据构建、知识提取、索引生成；其中正式知识提取仍由 `TrainingService` 调用本 Agent 执行。

按需语义补充尚未实现，不能把本目录中的 Agent 能力扩展理解为当前主流水线已经具备 `semantic_enrichment` 阶段。

## 架构

```
agents/
├── __init__.py                       # 模块导出
├── base_agent.py                     # Agent 基类和数据结构
├── workflow_engine.py                # 工作流引擎
├── knowledge_extraction_agent.py     # 知识提取 Workflow Agent
└── tools/
    ├── __init__.py
    ├── extraction_tool.py            # 提取工具（knowledge-point-extraction Skill）
    └── validation_tool.py            # 验证工具（知识点证据校验）
```

## 历史最小工作流

### Step 1: 任务规划

为每个处理单元创建独立工作项。一个工作项只携带一个 chunk、该 chunk 的文档元数据和已确认关键词上下文。

### Step 2: 单处理单元提取

调用 `knowledge-point-extraction` Skill 处理一个 chunk。输入包含原始标题、清洗后的语义标题、摘要、章节、正文、领域词典命中和已确认关键词上下文；输出只包含 `knowledgePoints`。

单元提取必须接入训练任务控制面：每次模型调用生成 `modelCallId`，发送 `model_call.started/completed/failed/cancelled` 事件，并在事件中携带 `taskId/stageRunId/agentTaskId/resourceId/chunkId/modelCallId/timeoutMs`。模型网关调用使用 Skill 的 `maxTokens/timeoutMs/maxRetries/concurrency` 默认值；取消检查在工作项提交前、模型调用前后和结果聚合前执行，取消异常必须向上传递给 `TrainingService`。非取消失败由工具层分类为 `KNOWLEDGE_EXTRACTION_TIMEOUT`、`KNOWLEDGE_EXTRACTION_SCHEMA_INVALID`、`KNOWLEDGE_EXTRACTION_EMPTY_RESULT` 或 `KNOWLEDGE_EXTRACTION_FAILED`，训练服务按分类写入批次审计和质量问题。

模型结果在 JSON Schema 校验前只做 `summary -> statement` 等无歧义归一化；空结果、无法补齐必填语义或 Schema 不合法的单元明确记为失败。通过 Schema 后，训练服务为知识点补齐候选 ID、证据偏移、关键词上下文和来源。

### Step 3: 证据校验

只校验知识点 `evidenceText` 位于当前处理单元原文；不执行修复重跑、实体校验或关系端点校验。

### Step 4: 结果聚合

去重、合并、格式化输出：
- 合并已验证知识点
- 保留单元级模型调用追溯字段
- 生成成功、失败与拒绝统计

## 使用方法

```python
from .agents import KnowledgeExtractionWorkflowAgent, AgentTask

# 初始化 Agent
agent = KnowledgeExtractionWorkflowAgent({
    "prompts": prompt_registry,
    "gateway": model_gateway_client,
    "max_workers": 3,
    "skill_root": "/path/to/knowledge/skills",
})

# 创建任务
task = AgentTask(
    task_id="task_001",
    input_data={
        "chunks": chunk_list,
        "documents": document_list,
        "task_id": "task_001",
    },
)

# 执行
result = agent.execute(task)

# 获取结果
knowledge_points = result.output_data.get("knowledgePoints", [])
metadata = result.metadata
```

## 调度边界

如果后续重新启用模型 Agent，每个 chunk 应单独调用一次模型，以换取独立超时、失败隔离、进度和审计。并发度只由 Skill defaults 的 `concurrency` 控制。重新接入前必须先更新设计文档、任务列表、测试设计和前端阶段说明。

## 扩展指南

### 添加新的工作流步骤

1. 在 `KnowledgeExtractionWorkflowAgent._build_workflow()` 中添加 `WorkflowStep`
2. 实现步骤方法（接收 `input_data`，返回 `Dict[str, Any]`）
3. 指定 `input_keys` 和 `output_keys`

### 添加新的工具

1. 在 `tools/` 目录下创建新文件
2. 实现工具类
3. 在 `KnowledgeExtractionWorkflowAgent.__init__()` 中初始化和注册

### 并行执行

设置 `WorkflowStep.parallel=True` 和 `parallel_item_key`，工作流引擎会自动并行执行。

## 与现有系统的集成

- `training_service.py` 在 `__init__` 中初始化 `self.extraction_agent`
- `_extract_deterministic()` 调用 `KnowledgeExtractionWorkflowAgent`
- 当前正式产物为 `knowledge-candidates.jsonl`、`knowledge-extraction-batches.jsonl` 和 `extraction-issues.json`
- 按需语义补充未接入当前主流水线，后续实现前需要先更新设计和测试
- 日志和进度更新由 `TrainingService` 统一负责；后端启动、任务查询和创建任务前会恢复僵尸 `activeTaskIds`
