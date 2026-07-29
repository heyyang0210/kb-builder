"""
验证工具

证据校验 + 修复执行。
"""

from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Tuple

logger = logging.getLogger(__name__)

SQL_KEYWORDS = {
    "select", "from", "where", "join", "table", "index", "view",
    "user", "schema", "insert", "update", "delete", "create", "drop",
    "alter", "grant", "revoke", "commit", "rollback",
}


class ValidationTool:
    """验证工具：证据校验 + 修复"""
    
    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}
    
    def verify_and_repair(
        self,
        extraction_result: Dict[str, Any],
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        证据校验 + 修复
        
        Args:
            extraction_result: 提取结果，包含 chunks 和 result
            
        Returns:
            (verified_results, rejected_items)
        """
        chunks = extraction_result.get("chunks", [])
        result_data = extraction_result.get("result", {})
        
        # 构建 chunk 索引
        chunk_map = {chunk["chunkId"]: chunk for chunk in chunks}
        document = (extraction_result.get("task") or {}).get("document") or {}
        
        verified_results = []
        rejected_items = []
        
        # 处理批量结果
        results_list = result_data.get("results", [])
        if not results_list:
            # 兼容单 chunk 结果格式
            if result_data.get("knowledgePoints") or result_data.get("entities"):
                results_list = [{
                    "chunkId": chunks[0]["chunkId"] if chunks else "unknown",
                    **result_data
                }]
        
        for chunk_result in results_list:
            chunk_id = chunk_result.get("chunkId", "unknown")
            chunk = chunk_map.get(chunk_id)
            content = chunk.get("content", "") if chunk else ""
            
            verified, rejected = self._verify_chunk_result(
                chunk_result,
                content,
                chunk_id,
                document,
                (chunk or {}).get("headingPath") or [],
            )
            verified_results.append(verified)
            rejected_items.extend(rejected)
        
        return verified_results, rejected_items
    
    def _verify_chunk_result(
        self,
        chunk_result: Dict[str, Any],
        content: str,
        chunk_id: str,
        document: Dict[str, Any],
        heading_path: List[str],
    ) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
        """校验单个 chunk 的提取结果"""
        rejected = []
        
        verified_kps = []
        for item in chunk_result.get("knowledgePoints", []):
            valid, reason = self._verify_evidence(item, content)
            if valid:
                verified_kps.append(item)
            else:
                rejected.append({
                    "chunkId": chunk_id,
                    "kind": "knowledgePoint",
                    "item": item,
                    "reason": reason,
                })

        verified_keywords = []
        for item in chunk_result.get("keywordCandidates", []):
            valid, reason = self._verify_keyword(item, content, document, heading_path)
            if valid:
                verified_keywords.append(item)
            else:
                rejected.append({
                    "chunkId": chunk_id,
                    "kind": "keywordCandidate",
                    "item": item,
                    "reason": reason,
                })
        
        verified_entities = []
        for item in chunk_result.get("entities", []):
            valid, reason = self._verify_entity(item, content)
            if valid:
                verified_entities.append(item)
            else:
                rejected.append({
                    "chunkId": chunk_id,
                    "kind": "entity",
                    "item": item,
                    "reason": reason,
                })
        
        verified_relations = []
        entity_names = {e.get("name") for e in verified_entities}
        for item in chunk_result.get("relations", []):
            valid, reason = self._verify_relation(item, content, entity_names)
            if valid:
                verified_relations.append(item)
            else:
                rejected.append({
                    "chunkId": chunk_id,
                    "kind": "relation",
                    "item": item,
                    "reason": reason,
                })
        
        verified = {
            "chunkId": chunk_id,
            "keywordCandidates": verified_keywords,
            "knowledgePoints": verified_kps,
            "entities": verified_entities,
            "relations": verified_relations,
            "uncertainItems": chunk_result.get("uncertainItems", []),
        }
        
        return verified, rejected

    def _verify_keyword(
        self,
        item: Dict[str, Any],
        content: str,
        document: Dict[str, Any],
        heading_path: List[str],
    ) -> Tuple[bool, str]:
        name = str(item.get("name") or "").strip()
        evidence = str(item.get("evidenceText") or "").strip()
        source = str(item.get("evidenceSource") or "")
        if not name or not evidence:
            return False, "关键词缺少名称或证据"
        if source == "title":
            if evidence not in str(document.get("semanticTitle") or ""):
                return False, "标题关键词证据不在 semanticTitle 中"
        elif source == "heading":
            if not any(evidence in str(heading) for heading in heading_path):
                return False, "章节关键词证据不在 headingPath 中"
        elif source == "content":
            if evidence not in content:
                return False, "正文关键词证据不在处理单元原文中"
        elif source == "domain_glossary":
            terms = document.get("domainTerms") or []
            if not any(
                evidence in [
                    str(term.get("canonicalName") or ""),
                    *[str(value) for value in term.get("aliases") or []],
                    *[str(value) for value in term.get("matchedAliases") or []],
                ]
                for term in terms if isinstance(term, dict)
            ):
                return False, "领域词典关键词缺少已命中的词条证据"
        else:
            return False, "关键词 evidenceSource 无效"
        return True, ""
    
    def _verify_evidence(self, item: Dict[str, Any], content: str) -> Tuple[bool, str]:
        """校验 evidenceText 是否在原文中"""
        evidence = item.get("evidenceText", "")
        if not evidence:
            return False, "缺少 evidenceText"
        if evidence not in content:
            return False, f"证据不在原文中: {evidence[:80]}..."
        return True, ""
    
    def _verify_entity(self, item: Dict[str, Any], content: str) -> Tuple[bool, str]:
        """校验实体"""
        # 先校验证据
        valid, reason = self._verify_evidence(item, content)
        if not valid:
            return False, reason
        
        name = str(item.get("name", ""))
        
        # SQL 关键字检查
        if name.casefold() in SQL_KEYWORDS:
            return False, f"SQL 关键字不能作为实体: {name}"
        
        # 错误码类型标注
        if re.fullmatch(r"YAS-\d+", name, re.I):
            item["type"] = "YashanDBErrorCode"
        elif re.fullmatch(r"ORA-\d+", name, re.I):
            item["type"] = "OracleErrorCode"
        
        return True, ""
    
    def _verify_relation(
        self,
        item: Dict[str, Any],
        content: str,
        entity_names: set,
    ) -> Tuple[bool, str]:
        """校验关系"""
        # 先校验证据
        valid, reason = self._verify_evidence(item, content)
        if not valid:
            return False, reason
        
        source = str(item.get("source", ""))
        target = str(item.get("target", ""))
        
        # 端点必须在实体集中
        if source not in entity_names:
            return False, f"关系源实体不在已验证实体集中: {source}"
        if target not in entity_names:
            return False, f"关系目标实体不在已验证实体集中: {target}"
        
        # 必须有类型和方向
        if not item.get("type"):
            return False, "关系缺少类型"
        
        return True, ""
