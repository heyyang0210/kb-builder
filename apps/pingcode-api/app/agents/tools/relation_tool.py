"""
关系工具

跨 chunk 关系识别 + 关系建立。
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Set

logger = logging.getLogger(__name__)


class RelationTool:
    """关系工具：跨 chunk 关系识别 + 建立"""
    
    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}
    
    def identify_and_establish_relations(
        self,
        enriched_results: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        识别并建立跨 chunk 关系
        
        Args:
            enriched_results: 语义补充后的提取结果列表
            
        Returns:
            {
                "entity_index": {entity_name: {"chunk_ids": set, "entity_data": dict}},
                "cross_chunk_relations": [relation_dict, ...],
            }
        """
        entity_index: Dict[str, Dict[str, Any]] = {}
        cross_chunk_relations: List[Dict[str, Any]] = []
        
        # 第一步：建立实体索引
        for result in enriched_results:
            chunk_id = result.get("chunkId", "unknown")
            for entity in result.get("entities", []):
                name = entity.get("name", "")
                if not name:
                    continue
                
                if name not in entity_index:
                    entity_index[name] = {
                        "chunk_ids": set(),
                        "entity_data": entity,
                        "occurrences": [],
                    }
                
                entity_index[name]["chunk_ids"].add(chunk_id)
                entity_index[name]["occurrences"].append({
                    "chunkId": chunk_id,
                    "evidenceText": entity.get("evidenceText", ""),
                    "assertionStatus": entity.get("assertionStatus", "unknown"),
                })
        
        # 第二步：识别跨 chunk 关系
        for entity_name, data in entity_index.items():
            chunk_ids = data["chunk_ids"]
            
            if len(chunk_ids) > 1:
                # 实体在多个 chunk 中出现，建立关系
                sorted_chunks = sorted(chunk_ids)
                
                # 建立相邻 chunk 之间的关系
                for i in range(len(sorted_chunks) - 1):
                    chunk_a = sorted_chunks[i]
                    chunk_b = sorted_chunks[i + 1]
                    
                    # 构建证据文本
                    evidence_a = self._find_evidence_in_chunk(data["occurrences"], chunk_a)
                    evidence_b = self._find_evidence_in_chunk(data["occurrences"], chunk_b)
                    
                    evidence_text = (
                        f"实体 '{entity_name}' 在 chunk {chunk_a} 和 {chunk_b} 中均出现。"
                        f"证据 1: {evidence_a[:100]}...; 证据 2: {evidence_b[:100]}..."
                    )
                    
                    relation = {
                        "source": entity_name,
                        "target": entity_name,
                        "type": "APPEARS_IN_CHUNKS",
                        "evidenceText": evidence_text,
                        "assertionStatus": "verified",
                        "metadata": {
                            "relationSource": "cross_chunk_detection",
                            "chunkIds": [chunk_a, chunk_b],
                            "entityType": data["entity_data"].get("type", "unknown"),
                        },
                    }
                    cross_chunk_relations.append(relation)
                
                logger.info(
                    "跨 chunk 关系: 实体 '%s' 出现在 %d 个 chunk 中, 建立 %d 个关系",
                    entity_name, len(chunk_ids), len(sorted_chunks) - 1,
                )
        
        # 第三步：识别跨 chunk 的引用关系
        cross_references = self._identify_cross_references(enriched_results, entity_index)
        cross_chunk_relations.extend(cross_references)
        
        return {
            "entity_index": entity_index,
            "cross_chunk_relations": cross_chunk_relations,
        }
    
    def _find_evidence_in_chunk(self, occurrences: List[Dict], chunk_id: str) -> str:
        """在指定 chunk 中查找证据文本"""
        for occ in occurrences:
            if occ["chunkId"] == chunk_id:
                return occ.get("evidenceText", "")
        return ""
    
    def _identify_cross_references(
        self,
        enriched_results: List[Dict[str, Any]],
        entity_index: Dict[str, Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        识别跨 chunk 的引用关系
        
        例如：chunk A 定义了一个参数，chunk B 引用了该参数
        """
        cross_references = []
        
        # 构建 chunk 级别的实体集合
        chunk_entities: Dict[str, Set[str]] = {}
        for result in enriched_results:
            chunk_id = result.get("chunkId", "unknown")
            entities = {e.get("name") for e in result.get("entities", []) if e.get("name")}
            chunk_entities[chunk_id] = entities
        
        # 检查每个 chunk 的关系，看是否引用了其他 chunk 的实体
        for result in enriched_results:
            chunk_id = result.get("chunkId", "unknown")
            current_entities = chunk_entities.get(chunk_id, set())
            
            for relation in result.get("relations", []):
                source = relation.get("source", "")
                target = relation.get("target", "")
                
                # 如果关系的源或目标不在当前 chunk 的实体中，但在其他 chunk 中出现
                for entity_name in [source, target]:
                    if entity_name and entity_name not in current_entities:
                        data = entity_index.get(entity_name)
                        if data and data["chunk_ids"]:
                            other_chunks = data["chunk_ids"] - {chunk_id}
                            if other_chunks:
                                cross_ref = {
                                    "source": source,
                                    "target": target,
                                    "type": "CROSS_CHUNK_REFERENCE",
                                    "evidenceText": relation.get("evidenceText", ""),
                                    "assertionStatus": relation.get("assertionStatus", "observed"),
                                    "metadata": {
                                        "relationSource": "cross_chunk_reference",
                                        "sourceChunkId": chunk_id,
                                        "referencedChunks": sorted(other_chunks),
                                        "originalRelationType": relation.get("type", ""),
                                    },
                                }
                                cross_references.append(cross_ref)
        
        return cross_references
