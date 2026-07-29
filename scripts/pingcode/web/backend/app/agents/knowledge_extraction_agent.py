"""
知识提取 Workflow Agent

6步工作流：
1. 任务规划：按文档分组，确定 batch 策略
2. 批量提取：调用 knowledge-extraction skill
3. 证据校验 + 修复：校验 evidenceText + 重试/降级
5. 跨 chunk 关系识别 + 建立：识别跨 chunk 实体关系
6. 结果聚合：去重、合并、格式化输出
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

from .base_agent import BaseAgent, AgentTask, AgentResult
from .workflow_engine import WorkflowEngine, WorkflowStep
from .tools.extraction_tool import ExtractionTool
from .tools.validation_tool import ValidationTool
from .tools.enrichment_tool import EnrichmentTool
from .tools.relation_tool import RelationTool
from .tools.context_tool import ContextTool

logger = logging.getLogger(__name__)


class KnowledgeExtractionWorkflowAgent(BaseAgent):
    """知识提取 Workflow Agent"""
    
    def __init__(self, config: Dict[str, Any]):
        """
        初始化 Agent
        
        Args:
            config: 配置字典，包含：
                - prompts: PromptRegistry 实例
                - gateway: ModelGatewayClient 实例
                - batch_size: 每批 chunk 数量（默认 5）
                - max_workers: 并行线程数（默认 3）
                - skill_root: skill 根目录路径
        """
        super().__init__("knowledge-extraction-workflow", config)
        
        self.batch_size = config.get("batch_size", 5)
        self.max_workers = config.get("max_workers", 3)
        
        # 初始化工具
        self.extraction_tool = ExtractionTool(config)
        self.validation_tool = ValidationTool(config)
        self.enrichment_tool = EnrichmentTool(config)
        self.relation_tool = RelationTool(config)
        self.context_tool = ContextTool(config)
        
        # 注册工具
        self.register_tool("extract_batch", self.extraction_tool.extract_batch)
        self.register_tool("verify_and_repair", self.validation_tool.verify_and_repair)
        self.register_tool("resolve_uncertain", self.enrichment_tool.resolve_uncertain_items)
        self.register_tool("identify_relations", self.relation_tool.identify_and_establish_relations)
        self.register_tool("aggregate_results", self.context_tool.aggregate_results)
    
    def execute(self, task: AgentTask) -> AgentResult:
        """
        执行知识提取任务
        
        Args:
            task: 任务定义，input_data 包含：
                - chunks: 处理单元列表
                - documents: 文档列表
                - task_id: 任务 ID
                
        Returns:
            AgentResult: 包含聚合后的知识提取结果
        """
        chunks = task.input_data.get("chunks", [])
        documents = task.input_data.get("documents", [])
        task_id = task.input_data.get("task_id", task.task_id)
        
        logger.info(
            "开始知识提取工作流: task=%s, chunks=%d, documents=%d",
            task_id, len(chunks), len(documents),
        )
        
        # 构建并执行工作流
        workflow = self._build_workflow()
        
        result = workflow.execute({
            "chunks": chunks,
            "documents": documents,
            "task_id": task_id,
            "batch_size": self.batch_size,
        })
        
        # 构建输出
        aggregated = result.get("final_knowledge", {})
        extraction_results = result.get("extraction_results", [])
        aggregated["_batchAudits"] = [
            {
                "resourceId": (item.get("task") or {}).get("resource_id"),
                "batchIndex": (item.get("task") or {}).get("batch_index"),
                "success": bool(item.get("success")),
                "error": item.get("error"),
                "usage": item.get("usage") or {},
                "result": item.get("result") or {},
            }
            for item in extraction_results
        ]
        succeeded_batches = sum(1 for item in extraction_results if item.get("success"))
        failed_batches = len(extraction_results) - succeeded_batches
        
        return AgentResult(
            output_data=aggregated,
            metadata={
                "workflow_id": workflow.workflow_id,
                "total_chunks": len(chunks),
                "total_documents": len(documents),
                "extraction_count": aggregated.get("metadata", {}).get("total_knowledge_points", 0),
                "keyword_count": aggregated.get("metadata", {}).get("total_keyword_candidates", 0),
                "entity_count": aggregated.get("metadata", {}).get("total_entities", 0),
                "relation_count": aggregated.get("metadata", {}).get("total_relations", 0),
                "cross_chunk_relations": aggregated.get("metadata", {}).get("cross_chunk_relation_count", 0),
                "rejected_count": aggregated.get("metadata", {}).get("rejected_count", 0),
                "unresolved_count": aggregated.get("metadata", {}).get("unresolved_count", 0),
                "model_calls": {"succeeded": succeeded_batches, "failed": failed_batches},
                "execution_log": [
                    {
                        "step_id": exe.step_id,
                        "status": exe.status.value,
                        "duration": (
                            round(exe.completed_at - exe.started_at, 2)
                            if exe.started_at and exe.completed_at
                            else None
                        ),
                        "error": exe.error,
                    }
                    for exe in workflow.state.execution_log
                ],
            },
        )
    
    def _build_workflow(self) -> WorkflowEngine:
        """构建 6 步工作流"""
        workflow = WorkflowEngine(
            workflow_id="knowledge-extraction",
            max_workers=self.max_workers,
        )
        
        # Step 1: 任务规划
        workflow.add_step(WorkflowStep(
            id="task_planning",
            name="任务规划",
            execute_fn=self._task_planning,
            input_keys=["chunks", "documents", "batch_size"],
            output_keys=["task_queue"],
        ))
        
        # Step 2: 批量提取
        workflow.add_step(WorkflowStep(
            id="batch_extraction",
            name="批量提取",
            execute_fn=self._batch_extraction,
            input_keys=["task_queue"],
            output_keys=["extraction_results"],
            parallel=True,
            parallel_item_key="task_queue",
            retry_count=2,
        ))
        
        # Step 3: 证据校验 + 修复
        workflow.add_step(WorkflowStep(
            id="evidence_verification",
            name="证据校验与修复",
            execute_fn=self._evidence_verification,
            input_keys=["extraction_results"],
            output_keys=["verified_results", "rejected_items"],
        ))
        
        # Step 4: 跨 chunk 关系识别 + 建立
        workflow.add_step(WorkflowStep(
            id="cross_chunk_relation",
            name="跨 chunk 关系识别与建立",
            execute_fn=self._cross_chunk_relation,
            input_keys=["verified_results"],
            output_keys=["entity_index", "cross_chunk_relations"],
        ))
        
        # Step 5: 结果聚合
        workflow.add_step(WorkflowStep(
            id="result_aggregation",
            name="结果聚合",
            execute_fn=self._result_aggregation,
            input_keys=[
                "verified_results",
                "cross_chunk_relations",
                "entity_index",
                "rejected_items",
            ],
            output_keys=["final_knowledge"],
        ))
        
        return workflow
    
    # ========== 工作流步骤实现 ==========
    
    def _task_planning(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Step 1: 任务规划
        
        按文档分组 chunk，确定 batch 策略。
        """
        chunks = input_data["chunks"]
        documents = input_data["documents"]
        batch_size = input_data.get("batch_size", self.batch_size)
        
        # 按文档分组
        grouped: Dict[str, List[Dict[str, Any]]] = {}
        for chunk in chunks:
            resource_id = chunk.get("resourceId", "unknown")
            if resource_id not in grouped:
                grouped[resource_id] = []
            grouped[resource_id].append(chunk)
        
        # 为每个文档创建任务队列
        task_queue = []
        document_map = {doc["resourceId"]: doc for doc in documents}
        
        for resource_id, doc_chunks in grouped.items():
            document = document_map.get(resource_id, {})
            profile = document.get("extractionProfile", "general-technical")
            document_type = document.get("documentType", "general_technical")
            
            # 按 chunkIndex 排序
            doc_chunks.sort(key=lambda c: int(c.get("chunkIndex", 0)))
            
            # 分批
            for i in range(0, len(doc_chunks), batch_size):
                batch = doc_chunks[i:i + batch_size]
                task_queue.append({
                    "resource_id": resource_id,
                    "profile": profile,
                    "document_type": document_type,
                    "document": {
                        "title": document.get("title", ""),
                        "semanticTitle": document.get("semanticTitle", ""),
                        "category": document.get("category", "未分类"),
                        "summary": document.get("summary", ""),
                        "keywords": document.get("keywords", []),
                        "domainTerms": document.get("domainTerms", []),
                    },
                    "chunks": [
                        {
                            "chunkId": chunk.get("id", f"{resource_id}:{idx}"),
                            "content": chunk.get("content", ""),
                            "headingPath": chunk.get("headingPath", []),
                            "normalizedOffsets": chunk.get("documentOffsets", {}),
                        }
                        for idx, chunk in enumerate(batch)
                    ],
                    "batch_index": i // batch_size,
                    "total_batches": (len(doc_chunks) + batch_size - 1) // batch_size,
                })
        
        logger.info(
            "任务规划完成: %d 个文档, %d 个 chunk, %d 个批次",
            len(grouped), len(chunks), len(task_queue),
        )
        
        return {"task_queue": task_queue}
    
    def _batch_extraction(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Step 2: 批量提取
        
        调用 knowledge-extraction skill 处理一个 batch。
        并行执行时，每个 item 是一个 batch。
        """
        task = input_data.get("item", {})
        chunks = task.get("chunks", [])
        
        if not chunks:
            return {"extraction_results": []}
        
        # 构建 envelope
        envelope = self._build_extraction_envelope(task)
        
        # 调用提取工具
        result = self.extraction_tool.extract_batch(envelope)
        
        # 包装结果
        return {
            "extraction_results": [{
                "task": task,
                "chunks": chunks,
                "result": result.get("result", {}),
                "usage": result.get("usage", {}),
                "success": result.get("success", False),
                "error": result.get("error"),
            }],
        }
    
    def _evidence_verification(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Step 3: 证据校验 + 修复
        
        校验 evidenceText 是否在原文中，失败时重试或标记 rejected。
        """
        extraction_results = input_data.get("extraction_results", [])
        
        all_verified = []
        all_rejected = []
        
        for extraction in extraction_results:
            if not extraction.get("success"):
                # 提取失败，记录 rejected
                for chunk in extraction.get("chunks", []):
                    all_rejected.append({
                        "chunkId": chunk.get("chunkId", "unknown"),
                        "kind": "chunk",
                        "reason": f"提取失败: {extraction.get('error', 'unknown')}",
                    })
                continue
            
            # 校验证据
            verified, rejected = self.validation_tool.verify_and_repair(extraction)
            all_verified.extend(verified)
            all_rejected.extend(rejected)
        
        logger.info(
            "证据校验完成: %d 个 chunk 通过, %d 个项目被拒绝",
            len(all_verified), len(all_rejected),
        )
        
        return {
            "verified_results": all_verified,
            "rejected_items": all_rejected,
        }
    
    # 语义补充步骤已移除，不确定项直接进入最终结果
    
    def _cross_chunk_relation(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Step 5: 跨 chunk 关系识别 + 建立
        
        识别跨 chunk 的实体重复出现，建立关系记录。
        """
        verified_results = input_data.get("verified_results", [])
        
        result = self.relation_tool.identify_and_establish_relations(verified_results)
        
        logger.info(
            "跨 chunk 关系识别完成: %d 个实体, %d 个跨 chunk 关系",
            len(result.get("entity_index", {})),
            len(result.get("cross_chunk_relations", [])),
        )
        
        return {
            "entity_index": result.get("entity_index", {}),
            "cross_chunk_relations": result.get("cross_chunk_relations", []),
        }
    
    def _result_aggregation(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Step 6: 结果聚合
        
        去重、合并、格式化输出。
        """
        verified_results = input_data.get("verified_results", [])
        cross_chunk_relations = input_data.get("cross_chunk_relations", [])
        entity_index = input_data.get("entity_index", {})
        rejected_items = input_data.get("rejected_items", [])
        unresolved_items = input_data.get("enrichment_unresolved", [])
        
        aggregated = self.context_tool.aggregate_results(
            enriched_results=verified_results,
            cross_chunk_relations=cross_chunk_relations,
            entity_index=entity_index,
            rejected_items=rejected_items,
            unresolved_items=[],
        )
        
        logger.info(
            "结果聚合完成: %d 个知识点, %d 个实体, %d 个关系",
            len(aggregated.get("knowledgePoints", [])),
            len(aggregated.get("entities", [])),
            len(aggregated.get("relations", [])),
        )
        
        return {"final_knowledge": aggregated}
    
    # ========== 辅助方法 ==========
    
    def _build_extraction_envelope(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """构建批量提取的 envelope"""
        chunks = task.get("chunks", [])
        document = task.get("document", {})
        
        # 读取 profile guidance
        profile_guidance = ""
        profile = task.get("profile", "general-technical")
        skill_root = self.config.get("skill_root")
        if skill_root:
            profile_path = Path(skill_root) / "knowledge-extraction" / "prompts" / "profiles" / f"{profile}.md"
            if profile_path.is_file():
                profile_guidance = profile_path.read_text(encoding="utf-8")
        
        # 提取锚点
        all_content = "\n\n".join(chunk.get("content", "") for chunk in chunks)
        anchors = self._extract_anchors(all_content)
        
        return {
            "documentType": task.get("document_type", "general_technical"),
            "extractionProfile": profile,
            "domain": "yashandb",
            "domainContextVersion": "yashandb-domain:1.0.0",
            "domainContextHits": [f"{item['candidateType']}:{item['value']}" for item in anchors],
            "profileGuidance": profile_guidance[:4000],
            "domainContext": {
                "matchedAnchors": anchors,
                "constraints": [
                    "YAS 与 ORA 错误码分域",
                    "SQL 关键字不能无条件作为实体",
                    "关系端点必须是当前单元中有证据的实体",
                ],
            },
            "document": document,
            "chunks": chunks,
            "schemaVersion": "2.0.0",
            "constraints": {
                "evidenceRequired": True,
                "allowSchemaCandidate": True,
                "allowNeedsEnrichment": True,
            },
        }
    
    @staticmethod
    def _extract_anchors(content: str) -> List[Dict[str, str]]:
        """从内容中提取显式锚点"""
        anchors = []
        
        # YAS- 错误码
        for match in re.finditer(r"YAS-\d{5}", content):
            anchors.append({"candidateType": "errorCode", "value": match.group()})
        
        # ORA- 错误码
        for match in re.finditer(r"ORA-\d{5}", content):
            anchors.append({"candidateType": "oracleErrorCode", "value": match.group()})
        
        # 版本号
        for match in re.finditer(r"v?\d+\.\d+(?:\.\d+)?", content):
            anchors.append({"candidateType": "version", "value": match.group()})
        
        return anchors
