"""
倒排索引构建器

关键词到知识点的映射，支持全文检索。
"""

from typing import Any, Dict, List
from collections import defaultdict
import re


class InvertedIndexBuilder:
    """倒排索引构建器"""
    
    def __init__(self):
        self.index = defaultdict(list)
        self.knowledge_points = {}
    
    def build(self, extraction_results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        构建倒排索引
        
        Args:
            extraction_results: 知识提取结果列表
            
        Returns:
            倒排索引
        """
        for result in extraction_results:
            resource_id = result.get("resourceId")
            
            for chunk_result in result.get("results", []):
                chunk_id = chunk_result.get("chunkId")
                
                for kp in chunk_result.get("knowledgePoints", []):
                    kp_id = f"{chunk_id}:{kp.get('title', '')}"
                    
                    # 存储知识点信息
                    self.knowledge_points[kp_id] = {
                        "id": kp_id,
                        "title": kp.get("title"),
                        "summary": kp.get("summary"),
                        "keywords": kp.get("keywords", []),
                        "evidenceText": kp.get("evidenceText"),
                        "resourceId": resource_id,
                        "chunkId": chunk_id
                    }
                    
                    # 提取关键词并建立索引
                    keywords = set()
                    
                    # 从 keywords 字段提取
                    keywords.update(kp.get("keywords", []))
                    
                    # 从 title 提取
                    title_keywords = self._extract_keywords(kp.get("title", ""))
                    keywords.update(title_keywords)
                    
                    # 从 summary 提取（前100个字符）
                    summary_keywords = self._extract_keywords(kp.get("summary", "")[:100])
                    keywords.update(summary_keywords)
                    
                    # 建立倒排索引
                    for keyword in keywords:
                        keyword_lower = keyword.lower()
                        if kp_id not in [item["kp_id"] for item in self.index[keyword_lower]]:
                            self.index[keyword_lower].append({
                                "kp_id": kp_id,
                                "keyword": keyword,
                                "score": self._calculate_score(keyword, kp)
                            })
        
        # 按分数排序
        for keyword in self.index:
            self.index[keyword].sort(key=lambda x: x["score"], reverse=True)
        
        return {
            "index": dict(self.index),
            "knowledge_points": self.knowledge_points,
            "stats": {
                "total_keywords": len(self.index),
                "total_knowledge_points": len(self.knowledge_points)
            }
        }
    
    def search(self, query: str, limit: int = 20) -> List[Dict[str, Any]]:
        """
        搜索知识点
        
        Args:
            query: 搜索查询
            limit: 返回结果数量限制
            
        Returns:
            匹配的知识点列表
        """
        query_keywords = self._extract_keywords(query)
        
        # 收集所有匹配的知识点
        matches = defaultdict(float)
        
        for keyword in query_keywords:
            keyword_lower = keyword.lower()
            if keyword_lower in self.index:
                for item in self.index[keyword_lower]:
                    matches[item["kp_id"]] += item["score"]
        
        # 按分数排序并返回
        sorted_matches = sorted(matches.items(), key=lambda x: x[1], reverse=True)
        
        results = []
        for kp_id, score in sorted_matches[:limit]:
            if kp_id in self.knowledge_points:
                kp = self.knowledge_points[kp_id].copy()
                kp["score"] = score
                results.append(kp)
        
        return results
    
    def _extract_keywords(self, text: str) -> List[str]:
        """从文本中提取关键词"""
        if not text:
            return []
        
        # 简单的关键词提取：按空格和标点分割
        words = re.findall(r'[\w\u4e00-\u9fff]+', text)
        
        # 过滤短词
        keywords = [word for word in words if len(word) >= 2]
        
        return keywords
    
    def _calculate_score(self, keyword: str, knowledge_point: Dict[str, Any]) -> float:
        """计算关键词在知识点中的权重分数"""
        score = 0.0
        
        # 在 keywords 字段中出现，权重最高
        if keyword in knowledge_point.get("keywords", []):
            score += 3.0
        
        # 在 title 中出现
        if keyword.lower() in knowledge_point.get("title", "").lower():
            score += 2.0
        
        # 在 summary 中出现
        if keyword.lower() in knowledge_point.get("summary", "").lower():
            score += 1.0
        
        return score
