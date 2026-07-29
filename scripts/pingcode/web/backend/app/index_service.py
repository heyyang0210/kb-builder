"""
索引服务

提供知识索引的查询和管理功能。
"""

from pathlib import Path
from typing import Any, Dict, List
import json

from .indexing import IndexManager


class IndexService:
    """索引服务"""
    
    def __init__(self, data_root: Path):
        self.data_root = Path(data_root)
        self.index_root = self.data_root / "index"
        self.index_root.mkdir(parents=True, exist_ok=True)
        self.index_manager = IndexManager(self.index_root)
    
    def get_directory_tree(self) -> Dict[str, Any]:
        """获取层次目录索引"""
        return self.index_manager.get_directory_tree()
    
    def search(self, query: str, limit: int = 20) -> List[Dict[str, Any]]:
        """搜索知识点"""
        if not query.strip():
            return self.list_knowledge_points(limit)
        return self.index_manager.search(query, limit)

    def list_knowledge_points(self, limit: int = 20) -> List[Dict[str, Any]]:
        """获取默认知识点列表"""
        return self.index_manager.list_knowledge_points(limit)
    
    def get_knowledge_graph(self, depth: int = 2) -> Dict[str, Any]:
        """获取知识图谱"""
        return self.index_manager.get_knowledge_graph(depth)
    
    def get_knowledge_point(self, kp_id: str) -> Dict[str, Any]:
        """获取单个知识点详情"""
        return self.index_manager.get_knowledge_point(kp_id)
    
    def build_indexes(self, extraction_results: List[Dict[str, Any]], documents: List[Dict[str, Any]]) -> Dict[str, Any]:
        """构建所有索引"""
        return self.index_manager.build_indexes(extraction_results, documents)
    
    def update_indexes(self, new_extraction_results: List[Dict[str, Any]], new_documents: List[Dict[str, Any]]) -> Dict[str, Any]:
        """增量更新索引"""
        return self.index_manager.update_indexes(new_extraction_results, new_documents)
    
    def get_index_stats(self) -> Dict[str, Any]:
        """获取索引统计信息"""
        directory_tree = self.get_directory_tree()
        graph = self.get_knowledge_graph()
        
        return {
            "document_count": len(directory_tree.get("documents", {})),
            "node_count": len(graph.get("nodes", [])),
            "edge_count": len(graph.get("edges", [])),
            "node_types": graph.get("stats", {}).get("node_types", {}),
            "edge_types": graph.get("stats", {}).get("edge_types", {}),
            "keyword_count": graph.get("stats", {}).get("keyword_count", 0),
            "chunk_count": graph.get("stats", {}).get("chunk_count", 0),
            "context_edge_count": graph.get("stats", {}).get("context_edge_count", 0)
        }
