# Workflow Agent 模块

## 概述

Workflow Agent 模块提供批量知识提取能力，替代原有逐个 chunk 调用的方式。通过 6 步工作流实现批量处理、上下文复用、语义补充和跨 chunk 关系识别。

## 架构

```
agents/
├── __init__.py                       # 模块导出
├── base_agent.py                     # Agent 基类和数据结构
├── workflow_engine.py                # 工作流引擎
├── knowledge_extraction_agent.py     # 知识提取 Workflow Agent
└── tools/
    ├── __init__.py
    ├── extraction_tool.py            # 提取工具（knowledge-extraction skill）
    ├── validation_tool.py            # 验证工具（证据校验 + 修复）
    ├── enrichment_tool.py            # 语义补充工具（semantic-enrichment skill）
    ├── relation_tool.py              # 关系工具（跨 chunk 关系识别 + 建立）
    └── context_tool.py               # 上下文工具（结果聚合、去重）
```

## 6 步工作流

### Step 1: 任务规划

按文档分组 chunk，确定 batch 策略（每批 3-5 个 chunk）。同一文档的 chunk 尽量在同一批，不同文档的 chunk 不混合。

### Step 2: 批量提取

调用 `knowledge-extraction` skill 处理一个 batch。输入包含原始标题、清洗后的语义标题、摘要、章节、正文和领域词典命中；输出同时包含知识点、实体、关系和可独立构图的 `keywordCandidates`。一次 API 调用处理多个 chunk，system prompt 和 profile guidance 只发送一次。

模型结果在 JSON Schema 校验前只做无歧义结构归一化，例如 `relationships -> relations`、`summary -> statement`；空结果、无法补齐必填语义或 Schema 不合法的批次明确记为失败。通过 Schema 后，训练服务为知识点、实体和关系统一补齐候选 ID、证据偏移、版本和来源，关系集合不得漏写。

### Step 3: 证据校验 + 修复

校验每个提取项的 `evidenceText` 是否在原文中：
- 校验通过：保留
- 校验失败：重试提取 / 降级处理 / 标记 rejected
- SQL 关键字不能作为实体
- 关系端点必须在已验证实体集中
- 关键词证据必须逐字存在于语义标题、章节、正文或已命中的领域词典

### Step 4: 语义补充

调用 `semantic-enrichment` skill 解决 `uncertainItems` 中 `state=needs_enrichment` 的项目。解决后合并回主结果。

### Step 5: 跨 chunk 关系识别 + 建立

识别跨 chunk 的实体重复出现，建立关系记录：
- `APPEARS_IN_CHUNKS`：同一实体在多个 chunk 中出现
- `CROSS_CHUNK_REFERENCE`：关系引用了其他 chunk 的实体

### Step 6: 结果聚合

去重、合并、格式化输出：
- 实体去重（同一实体在多个 chunk 中出现时合并）
- 合并所有知识点、实体、关系
- 生成元数据统计

## 使用方法

```python
from .agents import KnowledgeExtractionWorkflowAgent, AgentTask

# 初始化 Agent
agent = KnowledgeExtractionWorkflowAgent({
    "prompts": prompt_registry,
    "gateway": model_gateway_client,
    "batch_size": 5,
    "max_workers": 3,
    "skill_root": "/path/to/skills",
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
entities = result.output_data.get("entities", [])
relations = result.output_data.get("relations", [])
metadata = result.metadata
```

## Token 节省

| 场景 | 旧实现 | 新实现 | 节省 |
|------|--------|--------|------|
| 10 个 chunk | system prompt × 10 | system prompt × 1 | ~30-40% |
| 50 个 chunk | system prompt × 50 | system prompt × 10 | ~50-60% |

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
- `_extract_deterministic()` 方法调用 `self.extraction_agent.execute(task)`
- 输出格式与现有 `knowledge-extraction.jsonl` 兼容
- 日志和进度更新逻辑保持不变
