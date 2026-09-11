"""
索引管理器

管理三层索引的创建、更新、查询，支持增量更新。
"""

from typing import Any, Dict, List
from pathlib import Path
import json
import hashlib
from datetime import datetime

from .directory_index import DirectoryIndexBuilder
from .inverted_index import InvertedIndexBuilder
from .knowledge_graph import KnowledgeGraphBuilder


class IndexManager:
    """索引管理器"""
    
    def __init__(self, index_root: Path):
        self.index_root = Path(index_root)
        self.index_root.mkdir(parents=True, exist_ok=True)
        
        self.directory_builder = DirectoryIndexBuilder()
        self.inverted_builder = InvertedIndexBuilder()
        self.graph_builder = KnowledgeGraphBuilder()
        
        # 索引版本文件
        self.version_file = self.index_root / "index_version.json"
    
    def build_indexes(self, extraction_results: List[Dict[str, Any]], documents: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        构建所有索引
        
        Args:
            extraction_results: 知识提取结果列表
            documents: 文档元信息列表
            
        Returns:
            索引构建统计信息
        """
        stats = {
            "timestamp": datetime.now().isoformat(),
            "document_count": len(documents),
            "extraction_count": len(extraction_results)
        }
        
        # 1. 构建层次目录索引
        directory_index = self.directory_builder.build(extraction_results, documents)
        self._save_index("directory-tree.json", directory_index)
        stats["directory"] = {
            "document_count": len(directory_index.get("documents", {})),
            "tree_depth": self._calculate_tree_depth(directory_index.get("tree", {}))
        }
        
        # 2. 构建倒排索引
        inverted_index = self.inverted_builder.build(extraction_results)
        self._save_index("inverted-index.json", inverted_index)
        stats["inverted"] = inverted_index.get("stats", {})
        
        # 3. 构建知识图谱
        knowledge_graph = self.graph_builder.build(extraction_results)
        self._save_index("knowledge-graph.json", knowledge_graph)
        stats["graph"] = knowledge_graph.get("stats", {})
        
        # 4. 更新索引版本
        self._update_version(extraction_results, documents)
        
        return stats
    
    def update_indexes(self, new_extraction_results: List[Dict[str, Any]], new_documents: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        增量更新索引
        
        Args:
            new_extraction_results: 新的知识提取结果
            new_documents: 新的文档元信息
            
        Returns:
            更新统计信息
        """
        # 检查哪些文档发生了变化
        changed_docs = self._detect_changes(new_extraction_results, new_documents)
        
        if not changed_docs:
            return {"updated": False, "reason": "no_changes"}
        
        # 重新构建受影响的索引
        # 简化实现：直接重新构建所有索引
        # TODO: 实现真正的增量更新
        return self.build_indexes(new_extraction_results, new_documents)
    
    def get_directory_tree(self) -> Dict[str, Any]:
        """获取层次目录索引"""
        return self._load_index("directory-tree.json")
    
    def search(self, query: str, limit: int = 20) -> List[Dict[str, Any]]:
        """搜索知识点"""
        inverted_index = self._load_index("inverted-index.json")
        
        # 重建倒排索引以支持搜索
        builder = InvertedIndexBuilder()
        builder.index = inverted_index.get("index", {})
        builder.knowledge_points = inverted_index.get("knowledge_points", {})
        
        return builder.search(query, limit)

    def list_knowledge_points(self, limit: int = 20) -> List[Dict[str, Any]]:
        """获取默认知识点列表"""
        inverted_index = self._load_index("inverted-index.json")
        knowledge_points = list(inverted_index.get("knowledge_points", {}).values())
        return knowledge_points[:limit]
    
    def get_knowledge_graph(self, depth: int = 2) -> Dict[str, Any]:
        """获取知识图谱"""
        return self._load_index("knowledge-graph.json")
    
    def get_knowledge_point(self, kp_id: str) -> Dict[str, Any]:
        """获取单个知识点详情"""
        inverted_index = self._load_index("inverted-index.json")
        knowledge_points = inverted_index.get("knowledge_points", {})
        return knowledge_points.get(kp_id)
    
    def _save_index(self, filename: str, data: Dict[str, Any]):
        """保存索引到文件"""
        filepath = self.index_root / filename
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def _load_index(self, filename: str) -> Dict[str, Any]:
        """从文件加载索引"""
        filepath = self.index_root / filename
        if not filepath.exists():
            return {}
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def _update_version(self, extraction_results: List[Dict[str, Any]], documents: List[Dict[str, Any]]):
        """更新索引版本"""
        # 计算内容哈希
        content = json.dumps({
            "extraction_results": extraction_results,
            "documents": documents
        }, sort_keys=True, ensure_ascii=False)
        content_hash = hashlib.sha256(content.encode()).hexdigest()
        
        version = {
            "version": datetime.now().isoformat(),
            "content_hash": content_hash,
            "document_count": len(documents),
            "extraction_count": len(extraction_results)
        }
        
        with open(self.version_file, 'w', encoding='utf-8') as f:
            json.dump(version, f, ensure_ascii=False, indent=2)
    
    def _detect_changes(self, new_extraction_results: List[Dict[str, Any]], new_documents: List[Dict[str, Any]]) -> List[str]:
        """检测文档变化"""
        if not self.version_file.exists():
            return [doc.get("resourceId") for doc in new_documents]
        
        # 简化实现：比较文档数量
        with open(self.version_file, 'r', encoding='utf-8') as f:
            old_version = json.load(f)
        
        if old_version.get("document_count") != len(new_documents):
            return [doc.get("resourceId") for doc in new_documents]
        
        return []
    
    def _calculate_tree_depth(self, tree: Dict[str, Any]) -> int:
        """计算树深度"""
        if not tree or "children" not in tree:
            return 0
        
        max_depth = 0
        for child in tree.get("children", []):
            depth = self._calculate_tree_depth(child)
            max_depth = max(max_depth, depth)
        
        return max_depth + 1
