"""
上下文工具

结果聚合、去重、格式化输出。
"""

from __future__ import annotations

import hashlib
import json
import logging
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


class ContextTool:
    """上下文工具：结果聚合、去重"""
    
    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}
    
    def aggregate_results(
        self,
        enriched_results: List[Dict[str, Any]],
        cross_chunk_relations: List[Dict[str, Any]],
        entity_index: Dict[str, Dict[str, Any]] = None,
        rejected_items: List[Dict[str, Any]] = None,
        unresolved_items: List[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        聚合结果
        
        Args:
            enriched_results: 语义补充后的提取结果
            cross_chunk_relations: 跨 chunk 关系
            entity_index: 实体索引
            rejected_items: 被拒绝的项目
            unresolved_items: 未解决的不确定项
            
        Returns:
            {
                "knowledgePoints": [...],
                "entities": [...],
                "relations": [...],
                "uncertainItems": [...],
                "metadata": {...},
            }
        """
        rejected_items = rejected_items or []
        unresolved_items = unresolved_items or []
        entity_index = entity_index or {}
        
        # 合并所有知识点
        all_knowledge_points = []
        all_keyword_candidates = []
        for result in enriched_results:
            for keyword in result.get("keywordCandidates", []):
                all_keyword_candidates.append({
                    **keyword,
                    "chunkId": result.get("chunkId"),
                })
            for kp in result.get("knowledgePoints", []):
                all_knowledge_points.append({
                    **kp,
                    "chunkId": result.get("chunkId"),
                })
        
        # 合并所有实体（去重）
        all_entities = self._deduplicate_entities(enriched_results)
        
        # 合并所有关系
        all_relations = []
        for result in enriched_results:
            for rel in result.get("relations", []):
                all_relations.append({
                    **rel,
                    "chunkId": result.get("chunkId"),
                })
        
        # 添加跨 chunk 关系
        all_relations.extend(cross_chunk_relations)
        
        # 收集未解决的不确定项
        all_uncertain = []
        for result in enriched_results:
            for item in result.get("uncertainItems", []):
                all_uncertain.append({
                    **item,
                    "chunkId": result.get("chunkId"),
                })
        
        # 添加未解决的语义补充项
        for item in unresolved_items:
            all_uncertain.append({
                **item,
                "state": "human_required",
                "reason": f"语义补充无法解决: {item.get('reason', '')}",
            })
        
        # 构建元数据
        metadata = {
            "total_chunks": len(enriched_results),
            "total_keyword_candidates": len(all_keyword_candidates),
            "total_knowledge_points": len(all_knowledge_points),
            "total_entities": len(all_entities),
            "total_relations": len(all_relations),
            "cross_chunk_relation_count": len(cross_chunk_relations),
            "rejected_count": len(rejected_items),
            "unresolved_count": len(all_uncertain),
        }
        
        return {
            "keywordCandidates": all_keyword_candidates,
            "knowledgePoints": all_knowledge_points,
            "entities": all_entities,
            "relations": all_relations,
            "uncertainItems": all_uncertain,
            "metadata": metadata,
        }
    
    def _deduplicate_entities(self, enriched_results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        实体去重
        
        同一实体在多个 chunk 中出现时，合并为一条记录，保留所有出现的 chunk 信息。
        """
        entity_map: Dict[str, Dict[str, Any]] = {}
        
        for result in enriched_results:
            chunk_id = result.get("chunkId", "unknown")
            for entity in result.get("entities", []):
                name = entity.get("name", "")
                if not name:
                    continue
                
                if name in entity_map:
                    # 实体已存在，追加 chunk 信息
                    existing = entity_map[name]
                    if "chunkIds" not in existing:
                        existing["chunkIds"] = [existing.pop("chunkId", "unknown")]
                    if chunk_id not in existing["chunkIds"]:
                        existing["chunkIds"].append(chunk_id)
                    existing["occurrenceCount"] = len(existing["chunkIds"])
                else:
                    # 新实体
                    entity_map[name] = {
                        **entity,
                        "chunkId": chunk_id,
                        "chunkIds": [chunk_id],
                        "occurrenceCount": 1,
                    }
        
        return list(entity_map.values())
    
    def format_for_output(
        self,
        aggregated: Dict[str, Any],
        task_id: str,
        documents: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        格式化输出，兼容现有 training_service.py 的输出格式
        
        Args:
            aggregated: 聚合后的结果
            task_id: 任务 ID
            documents: 文档列表
            
        Returns:
            输出记录列表
        """
        output_records = []
        
        # 为每个文档生成一条记录
        document_map = {doc["resourceId"]: doc for doc in documents}
        
        # 按 resourceId 分组
        chunk_groups: Dict[str, List[str]] = {}
        for kp in aggregated.get("knowledgePoints", []):
            chunk_id = kp.get("chunkId", "")
            # 从 chunk_id 中提取 resourceId（如果有的话）
            # chunk_id 格式通常是 "resourceId:index"
            parts = chunk_id.split(":")
            resource_id = parts[0] if parts else ""
            if resource_id:
                if resource_id not in chunk_groups:
                    chunk_groups[resource_id] = []
                chunk_groups[resource_id].append(chunk_id)
        
        # 生成输出记录
        output_records.append({
            "taskId": task_id,
            "knowledgePoints": aggregated.get("knowledgePoints", []),
            "entities": aggregated.get("entities", []),
            "relations": aggregated.get("relations", []),
            "uncertainItems": aggregated.get("uncertainItems", []),
            "metadata": {
                **aggregated.get("metadata", {}),
                "taskId": task_id,
                "agentId": "knowledge-extraction-workflow-agent",
                "skillId": "knowledge-extraction",
            },
        })
        
        return output_records
