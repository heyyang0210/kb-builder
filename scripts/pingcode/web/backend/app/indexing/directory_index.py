"""
层次目录索引构建器

按文档结构组织知识点，支持逐层浏览（文档 → 章节 → 知识点）。
"""

from typing import Any, Dict, List
from collections import defaultdict
import hashlib


class DirectoryIndexBuilder:
    """层次目录索引构建器"""
    
    def __init__(self):
        self.index = {
            "documents": {},
            "tree": {
                "id": "root",
                "name": "知识库",
                "type": "root",
                "children": []
            }
        }
    
    def build(self, extraction_results: List[Dict[str, Any]], documents: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        构建层次目录索引
        
        Args:
            extraction_results: 知识提取结果列表
            documents: 文档元信息列表
            
        Returns:
            层次目录索引
        """
        # 按文档分组
        doc_map = {doc["resourceId"]: doc for doc in documents}
        
        for result in extraction_results:
            resource_id = result.get("resourceId")
            if not resource_id or resource_id not in doc_map:
                continue
            
            document = doc_map[resource_id]
            doc_id = self._generate_id("doc", resource_id)
            
            # 初始化文档节点
            if doc_id not in self.index["documents"]:
                self.index["documents"][doc_id] = {
                    "id": doc_id,
                    "resourceId": resource_id,
                    "title": document.get("title", "未命名文档"),
                    "path": document.get("sourcePath", ""),
                    "sections": {},
                    "knowledgePoints": []
                }
            
            # 处理每个 chunk
            for chunk_result in result.get("results", []):
                chunk_id = chunk_result.get("chunkId")
                heading_path = chunk_result.get("documentStructure", {}).get("headingPath", [])
                
                # 构建章节层次结构
                self._build_section_hierarchy(doc_id, heading_path)
                
                # 添加知识点到对应章节
                section_id = self._get_section_id(doc_id, heading_path)
                for kp in chunk_result.get("knowledgePoints", []):
                    kp_id = self._generate_id("kp", chunk_id, kp.get("title", ""))
                    knowledge_point = {
                        "id": kp_id,
                        "title": kp.get("title"),
                        "summary": kp.get("summary"),
                        "keywords": kp.get("keywords", []),
                        "evidenceText": kp.get("evidenceText"),
                        "confidence": kp.get("confidence"),
                        "chunkId": chunk_id,
                        "sectionId": section_id
                    }
                    self.index["documents"][doc_id]["knowledgePoints"].append(knowledge_point)
        
        # 构建树形结构
        self._build_tree()
        
        return self.index
    
    def _build_section_hierarchy(self, doc_id: str, heading_path: List[str]):
        """构建章节层次结构"""
        if not heading_path:
            return
        
        doc = self.index["documents"][doc_id]
        current_level = doc["sections"]
        
        for i, heading in enumerate(heading_path):
            section_id = self._generate_id("section", doc_id, *heading_path[:i+1])
            
            if section_id not in current_level:
                current_level[section_id] = {
                    "id": section_id,
                    "name": heading,
                    "level": i + 1,
                    "children": {},
                    "knowledgePoints": []
                }
            
            current_level = current_level[section_id]["children"]
    
    def _get_section_id(self, doc_id: str, heading_path: List[str]) -> str:
        """获取章节 ID"""
        if not heading_path:
            return f"{doc_id}:root"
        return self._generate_id("section", doc_id, *heading_path)
    
    def _build_tree(self):
        """构建树形结构"""
        for doc_id, doc in self.index["documents"].items():
            doc_node = {
                "id": doc_id,
                "name": doc["title"],
                "type": "document",
                "resourceId": doc["resourceId"],
                "children": []
            }
            
            # 添加章节节点
            self._add_sections_to_tree(doc_node, doc["sections"])
            
            self.index["tree"]["children"].append(doc_node)
    
    def _add_sections_to_tree(self, parent_node: Dict, sections: Dict):
        """递归添加章节到树"""
        for section_id, section in sections.items():
            section_node = {
                "id": section_id,
                "name": section["name"],
                "type": "section",
                "level": section["level"],
                "children": []
            }
            
            # 递归添加子章节
            self._add_sections_to_tree(section_node, section["children"])
            
            parent_node["children"].append(section_node)
    
    @staticmethod
    def _generate_id(prefix: str, *parts) -> str:
        """生成唯一 ID"""
        content = ":".join(str(p) for p in parts)
        hash_suffix = hashlib.sha256(content.encode()).hexdigest()[:8]
        return f"{prefix}:{hash_suffix}"
