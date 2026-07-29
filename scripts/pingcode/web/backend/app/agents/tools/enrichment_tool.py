"""
语义补充工具

调用 semantic-enrichment skill 解决不确定项。
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


class EnrichmentTool:
    """语义补充工具：调用 semantic-enrichment skill"""
    
    def __init__(self, config: Dict[str, Any]):
        """
        初始化工具
        
        Args:
            config: 配置字典，包含 prompts, gateway 等
        """
        self.config = config
        self.prompts = config.get("prompts")
        self.gateway = config.get("gateway")
    
    def resolve_uncertain_items(
        self,
        verified_results: List[Dict[str, Any]],
        context: Dict[str, Any] = None,
    ) -> Dict[str, Any]:
        """
        解决不确定项
        
        Args:
            verified_results: 已验证的提取结果列表
            context: 额外上下文信息
            
        Returns:
            {"resolved": [...], "unresolved": [...], "enriched_results": [...]}
        """
        context = context or {}
        
        # 收集所有需要语义补充的不确定项
        needs_enrichment = []
        for result in verified_results:
            for item in result.get("uncertainItems", []):
                if item.get("state") == "needs_enrichment":
                    needs_enrichment.append({
                        **item,
                        "sourceChunkId": result.get("chunkId"),
                    })
        
        if not needs_enrichment:
            logger.info("没有需要语义补充的不确定项")
            return {
                "resolved": [],
                "unresolved": [],
                "enriched_results": verified_results,
            }
        
        logger.info("开始语义补充: %d 个不确定项", len(needs_enrichment))
        
        resolved = []
        unresolved = []
        
        for item in needs_enrichment:
            try:
                resolution = self._resolve_single_item(item, context)
                if resolution.get("resolved"):
                    resolved.append(resolution)
                else:
                    unresolved.append(item)
            except Exception as error:
                logger.warning("语义补充失败: %s - %s", item.get("id", "unknown"), error)
                unresolved.append(item)
        
        # 将解决结果合并回主结果
        enriched_results = self._merge_resolutions(verified_results, resolved)
        
        return {
            "resolved": resolved,
            "unresolved": unresolved,
            "enriched_results": enriched_results,
        }
    
    def _resolve_single_item(self, item: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """解决单个不确定项"""
        # 构建 enrichment envelope
        envelope = {
            "uncertainItemId": item.get("id", "unknown"),
            "uncertainItemType": item.get("type", "unknown"),
            "uncertainItemReason": item.get("reason", ""),
            "evidenceText": item.get("evidenceText", ""),
            "candidateValues": item.get("candidateValues", []),
            "sourceChunkId": item.get("sourceChunkId", ""),
            "context": context,
        }
        
        # 调用 semantic-enrichment skill
        system_prompt = self.prompts.get("semantic-enrichment.system")
        user_prompt = self.prompts.get("semantic-enrichment.user", system_prompt.skill_version)
        
        user_content = user_prompt.content.replace(
            "{{context_envelope}}",
            json.dumps(envelope, ensure_ascii=False)
        )
        
        messages = [
            {"role": "system", "content": system_prompt.content},
            {"role": "user", "content": user_content}
        ]
        
        response = self.gateway.chat_json(messages, options={"temperature": 0.1})
        data = response.get("data", {})
        
        return {
            "uncertainItemId": item.get("id"),
            "sourceChunkId": item.get("sourceChunkId"),
            "resolved": data.get("resolved", False),
            "resolution": data,
            "usage": response.get("usage", {}),
        }
    
    def _merge_resolutions(
        self,
        verified_results: List[Dict[str, Any]],
        resolved: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """将解决结果合并回主结果"""
        # 构建解决结果索引
        resolution_map = {}
        for res in resolved:
            chunk_id = res.get("sourceChunkId")
            if chunk_id:
                if chunk_id not in resolution_map:
                    resolution_map[chunk_id] = []
                resolution_map[chunk_id].append(res)
        
        enriched_results = []
        for result in verified_results:
            chunk_id = result.get("chunkId")
            resolutions = resolution_map.get(chunk_id, [])
            
            # 合并解决结果到当前 chunk
            merged = {**result}
            for res in resolutions:
                resolution_data = res.get("resolution", {})
                
                # 合并知识点
                if resolution_data.get("knowledgePoints"):
                    merged["knowledgePoints"] = merged.get("knowledgePoints", []) + resolution_data["knowledgePoints"]
                
                # 合并实体
                if resolution_data.get("entities"):
                    merged["entities"] = merged.get("entities", []) + resolution_data["entities"]
                
                # 合并关系
                if resolution_data.get("relations"):
                    merged["relations"] = merged.get("relations", []) + resolution_data["relations"]
            
            enriched_results.append(merged)
        
        return enriched_results
