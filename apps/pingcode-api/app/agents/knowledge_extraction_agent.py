"""
知识提取 Workflow Agent

最小工作流：
1. 任务规划：每个工作项只处理一个 chunk
2. 知识点提取：调用 knowledge-point-extraction Skill
3. 证据校验：只校验知识点证据
4. 结果聚合：保留知识点、实体、关系及单元级调用追溯
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
from ..config import runtime_profile

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
                - batch_size: 兼容旧配置，正式知识最小链路固定单 chunk
                - max_workers: 并行线程数（默认 3）
                - skill_root: skill 根目录路径
        """
        super().__init__("knowledge-extraction-workflow", config)
        
        # 初始化工具
        self.extraction_tool = ExtractionTool(config)
        self.batch_size = 1
        self.max_workers = config.get("max_workers") or int(self.extraction_tool.defaults.get("concurrency", 3) or 3)
        self.validation_tool = ValidationTool(config)
        
        # 注册工具
        self.register_tool("extract_batch", self.extraction_tool.extract_batch)
        self.register_tool("verify_knowledge_points", self.validation_tool.verify_and_repair)
    
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
        cancel_check = task.input_data.get("cancel_check")
        progress_callback = task.input_data.get("progress_callback")
        stage_run_id = task.input_data.get("stage_run_id")
        keyword_context_by_chunk = task.input_data.get("keyword_context_by_chunk") or {}
        
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
            "cancel_check": cancel_check,
            "progress_callback": progress_callback,
            "stage_run_id": stage_run_id,
            "keyword_context_by_chunk": keyword_context_by_chunk,
        })
        
        # 构建输出
        aggregated = result.get("final_knowledge", {})
        extraction_results = result.get("extraction_results", [])
        aggregated["_batchAudits"] = [
            {
                "resourceId": (item.get("task") or {}).get("resource_id"),
                "batchIndex": (item.get("task") or {}).get("batch_index"),
                "chunkId": (item.get("task") or {}).get("chunk_id"),
                "agentTaskId": (item.get("task") or {}).get("agent_task_id"),
                "taskId": task_id,
                "stageRunId": stage_run_id,
                "success": bool(item.get("success")),
                "error": item.get("error"),
                "errorCode": item.get("errorCode"),
                "technicalError": item.get("technicalError") or item.get("error"),
                "durationMs": item.get("durationMs"),
                "usage": item.get("usage") or {},
                "result": item.get("result") or {},
                "modelCallId": item.get("modelCallId"),
                "modelCallIds": item.get("modelCallIds") or [],
                "modelCalls": item.get("modelCalls") or {},
            }
            for item in extraction_results
        ]
        model_calls = {"succeeded": 0, "failed": 0}
        for item in extraction_results:
            calls = item.get("modelCalls") or {}
            model_calls["succeeded"] += int(calls.get("succeeded", 0) or 0)
            model_calls["failed"] += int(calls.get("failed", 0) or 0)
        
        return AgentResult(
            output_data=aggregated,
            metadata={
                "workflow_id": workflow.workflow_id,
                "total_chunks": len(chunks),
                "total_documents": len(documents),
                "extraction_count": aggregated.get("metadata", {}).get("total_items", 0),
                "knowledge_point_count": aggregated.get("metadata", {}).get("total_knowledge_points", 0),
                "entity_count": aggregated.get("metadata", {}).get("total_entities", 0),
                "relation_count": aggregated.get("metadata", {}).get("total_relations", 0),
                "rejected_count": aggregated.get("metadata", {}).get("rejected_count", 0),
                "model_calls": model_calls,
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
        """构建单处理单元知识点提取工作流"""
        workflow = WorkflowEngine(
            workflow_id="knowledge-extraction",
            max_workers=self.max_workers,
        )
        
        # Step 1: 任务规划
        workflow.add_step(WorkflowStep(
            id="task_planning",
            name="任务规划",
            execute_fn=self._task_planning,
            input_keys=["chunks", "documents", "task_id", "stage_run_id", "keyword_context_by_chunk"],
            output_keys=["task_queue"],
        ))
        
        # Step 2: 单处理单元提取
        workflow.add_step(WorkflowStep(
            id="batch_extraction",
            name="单处理单元提取",
            execute_fn=self._batch_extraction,
            input_keys=["task_queue", "task_id", "cancel_check", "progress_callback"],
            output_keys=["extraction_results"],
            parallel=True,
            parallel_item_key="task_queue",
            retry_count=0,
        ))
        
        # Step 3: 证据校验
        workflow.add_step(WorkflowStep(
            id="evidence_verification",
            name="知识点证据校验",
            execute_fn=self._evidence_verification,
            input_keys=["extraction_results"],
            output_keys=["verified_results", "rejected_items"],
        ))
        
        # Step 4: 结果聚合
        workflow.add_step(WorkflowStep(
            id="result_aggregation",
            name="结果聚合",
            execute_fn=self._result_aggregation,
            input_keys=[
                "verified_results",
                "rejected_items",
            ],
            output_keys=["final_knowledge"],
        ))
        
        return workflow
    
    # ========== 工作流步骤实现 ==========
    
    def _task_planning(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Step 1: 任务规划
        
        每个 chunk 创建一个工作项，不跨 chunk 组批。
        """
        chunks = input_data["chunks"]
        documents = input_data["documents"]
        task_queue = []
        document_map = {doc["resourceId"]: doc for doc in documents}
        keyword_context_by_chunk = input_data.get("keyword_context_by_chunk") or {}
        task_id = str(input_data.get("task_id") or "")
        stage_run_id = input_data.get("stage_run_id")
        for index, chunk in enumerate(chunks):
            resource_id = str(chunk.get("resourceId") or "unknown")
            document = document_map.get(resource_id, {})
            profile = document.get("extractionProfile", "general-technical")
            document_type = document.get("documentType", "general_technical")
            chunk_id = str(chunk.get("id") or chunk.get("chunkId") or f"{resource_id}:{index}")
            task_queue.append({
                "resource_id": resource_id,
                "chunk_id": chunk_id,
                "agent_task_id": f"knowledge_point_{hashlib.sha1(f'{task_id}:{chunk_id}'.encode('utf-8')).hexdigest()[:20]}",
                "stage_run_id": stage_run_id,
                "profile": profile,
                "document_type": document_type,
                "document": {
                    "title": document.get("title", ""),
                    "semanticTitle": document.get("semanticTitle", ""),
                    "category": document.get("category", "未分类"),
                    "summary": document.get("summary", ""),
                    "domainTerms": document.get("domainTerms", []),
                },
                "keyword_context": keyword_context_by_chunk.get(chunk_id, []),
                "chunks": [{
                    "chunkId": chunk_id,
                    "content": chunk.get("content", ""),
                    "headingPath": chunk.get("headingPath", []),
                    "normalizedOffsets": chunk.get("documentOffsets", {}),
                }],
                "batch_index": index,
                "total_batches": len(chunks),
            })
        
        logger.info(
            "任务规划完成: %d 个 chunk, %d 个单处理单元工作项",
            len(chunks), len(task_queue),
        )
        
        return {"task_queue": task_queue}
    
    def _batch_extraction(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Step 2: 单处理单元提取
        
        调用 knowledge-point-extraction Skill 处理一个 chunk。
        """
        task = input_data.get("item", {})
        chunks = task.get("chunks", [])
        cancel_check = input_data.get("cancel_check")
        if callable(cancel_check):
            cancel_check()
        
        if not chunks:
            return {"extraction_results": []}
        
        # 构建 envelope
        envelope = self._build_extraction_envelope(task)
        
        # 调用提取工具
        result = self.extraction_tool.extract_batch(
            envelope,
            context={
                "cancel_check": cancel_check,
                "progress_callback": input_data.get("progress_callback"),
                "trace": {
                    "taskId": input_data.get("task_id"),
                    "stageRunId": task.get("stage_run_id"),
                    "agentTaskId": task.get("agent_task_id"),
                    "stage": "deterministic_extraction",
                    "resourceId": task.get("resource_id"),
                    "chunkId": task.get("chunk_id"),
                    "batchIndex": task.get("batch_index"),
                },
            },
        )
        progress_callback = input_data.get("progress_callback")
        if callable(progress_callback):
            progress_callback(
                "agent_task.completed" if result.get("success") else "agent_task.failed",
                {
                    "taskId": input_data.get("task_id"),
                    "stageRunId": task.get("stage_run_id"),
                    "agentTaskId": task.get("agent_task_id"),
                    "resourceId": task.get("resource_id"),
                    "chunkId": task.get("chunk_id"),
                    "modelCallId": result.get("modelCallId") or result.get("_modelCallId"),
                    "skillId": self.extraction_tool.skill_id,
                    "success": bool(result.get("success")),
                },
            )
        if callable(cancel_check):
            cancel_check()

        result_data = result.get("result", {})
        if isinstance(result_data, dict):
            for chunk_result in result_data.get("results", []):
                if isinstance(chunk_result, dict):
                    chunk_result["agentTaskId"] = task.get("agent_task_id")
                    chunk_result["modelCallId"] = result.get("modelCallId") or result.get("_modelCallId")
        
        # 包装结果
        return {
            "extraction_results": [{
                "task": task,
                "chunks": chunks,
                "result": result_data,
                "usage": result.get("usage", {}),
                "success": result.get("success", False),
                "error": result.get("error"),
                "errorCode": result.get("errorCode"),
                "technicalError": result.get("technicalError") or result.get("error"),
                "durationMs": result.get("durationMs"),
                "modelCallId": result.get("modelCallId") or result.get("_modelCallId"),
                "modelCallIds": result.get("modelCallIds") or result.get("_modelCallIds") or [],
                "modelCalls": result.get("modelCalls") or result.get("_modelCalls") or {},
            }],
        }
    
    def _evidence_verification(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Step 3: 知识对象证据校验。
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
    
    def _result_aggregation(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Step 4: 聚合已验证的知识对象，不做跨 chunk 推断。
        """
        verified_results = input_data.get("verified_results", [])
        rejected_items = input_data.get("rejected_items", [])
        collections = {
            "knowledgePoints": [],
            "entities": [],
            "relations": [],
        }
        for result in verified_results:
            trace = {
                "chunkId": result.get("chunkId"),
                "agentTaskId": result.get("agentTaskId"),
                "modelCallId": result.get("modelCallId"),
            }
            for collection_name in collections:
                for item in result.get(collection_name, []):
                    collections[collection_name].append({**item, **trace})
        knowledge_points = collections["knowledgePoints"]
        entities = collections["entities"]
        relations = collections["relations"]
        total_items = len(knowledge_points) + len(entities) + len(relations)
        aggregated = {
            **collections,
            "metadata": {
                "total_chunks": len(verified_results),
                "total_knowledge_points": len(knowledge_points),
                "total_entities": len(entities),
                "total_relations": len(relations),
                "total_items": total_items,
                "rejected_count": len(rejected_items),
            },
        }
        
        logger.info(
            "结果聚合完成: %d 个知识点、%d 个实体、%d 个关系",
            len(knowledge_points), len(entities), len(relations),
        )
        
        return {"final_knowledge": aggregated}
    
    # ========== 辅助方法 ==========
    
    def _build_extraction_envelope(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """构建单处理单元提取的 envelope"""
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
            "domain": runtime_profile.domain_id,
            "domainContextVersion": runtime_profile.domain_version,
            "enterpriseProfileId": runtime_profile.profile_id,
            "enterpriseProfileVersion": runtime_profile.profile_version,
            "configFingerprint": runtime_profile.config_fingerprint,
            "domainContextHits": [f"{item['candidateType']}:{item['value']}" for item in anchors],
            "profileGuidance": profile_guidance[:4000],
            "domainContext": {"matchedAnchors": anchors},
            "document": document,
            "chunks": chunks,
            "keywordContext": task.get("keyword_context", []),
            "schemaVersion": "3.0.0",
            "constraints": {
                "evidenceRequired": True,
                "outputKinds": ["knowledge_point"],
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
