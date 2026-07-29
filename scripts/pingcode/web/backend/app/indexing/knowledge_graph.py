"""
知识图谱构建器

构建关键词/知识点与文档块的上下文关联网络，支持全局知识图谱页面展示。
"""

from typing import Any, Dict, List
from collections import defaultdict
import hashlib
import re


DISPLAY_NAME_PREFIX_PATTERN = re.compile(r"^[0-9a-fA-F]{8,24}-")
TECHNICAL_KEYWORD_PREFIXES = ("dataset_", "file_", "chunk_", "resource_", "document_", "task_", "batch_", "run_", "node_", "edge_", "unit_")
WHY_HINTS = ("为什么", "原因", "根因", "因为", "导致", "影响", "风险", "约束", "限制", "取舍", "设计", "目的", "问题", "失败", "异常", "报错")
HOW_HINTS = ("如何", "怎么", "步骤", "流程", "方法", "方案", "配置", "部署", "启动", "迁移", "修复", "处理", "实现", "使用", "操作", "接入", "验证", "测试")
SYMPTOM_HINTS = ("报错", "异常", "失败", "超时", "不可用", "无法", "错误")
SOLUTION_HINTS = ("修复", "解决", "处理", "规避", "配置", "执行", "重启", "验证")
CONSTRAINT_HINTS = ("限制", "约束", "不能", "不允许", "必须", "风险", "边界")
DECISION_HINTS = ("设计", "取舍", "方案", "选择", "决策", "对比")


class KnowledgeGraphBuilder:
    """知识图谱构建器"""
    
    def __init__(self):
        self.nodes = {}
        self.edges = {}
    
    def build(self, extraction_results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        构建知识图谱
        
        Args:
            extraction_results: 知识提取结果列表
            
        Returns:
            知识图谱（nodes 和 edges）
        """
        # 提取知识点、实体和文档块作为节点，主边表达上下文匹配关系。
        for result in extraction_results:
            resource_id = result.get("resourceId")
            
            for chunk_result in result.get("results", []):
                chunk_id = chunk_result.get("chunkId")
                aliases = {}
                chunk_node_id = self._generate_node_id(chunk_id, "Chunk")
                chunk_text = chunk_result.get("content") or chunk_result.get("text") or ""
                if chunk_node_id not in self.nodes:
                    self.nodes[chunk_node_id] = {
                        "id": chunk_node_id,
                        "name": self._display_name(chunk_id),
                        "displayName": self._display_name(chunk_id),
                        "rawName": chunk_id,
                        "ontologyType": "Evidence",
                        "knowledgeDomain": "evidence",
                        "taskContext": "general",
                        "type": "Chunk",
                        "resourceId": resource_id,
                        "chunkId": chunk_id,
                        "properties": {
                            "sourcePath": result.get("sourcePath") or chunk_result.get("sourcePath"),
                            "contentPreview": str(chunk_text)[:240]
                        },
                        "occurrences": []
                    }

                for point in chunk_result.get("knowledgePoints", []):
                    if not isinstance(point, dict):
                        continue
                    title = str(point.get("title") or point.get("statement") or "").strip()
                    if not title or self._is_technical_keyword(title):
                        continue
                    canonical_name = self._display_name(title)
                    node_id = self._generate_node_id(canonical_name, "KnowledgePoint")
                    evidence = self._evidence(point)
                    if node_id not in self.nodes:
                        self.nodes[node_id] = {
                            "id": node_id,
                            "name": canonical_name,
                            "displayName": canonical_name,
                            "rawName": title,
                            "canonicalName": canonical_name,
                            "aliases": [],
                            "occurrences": [],
                            **self._semantic_fields(canonical_name, "KnowledgePoint"),
                            "type": "KnowledgePoint",
                            "evidenceText": evidence,
                            "resourceId": resource_id,
                            "chunkId": chunk_id,
                            "attributes": point,
                        }
                    self._record_alias(self.nodes[node_id], title)
                    self.nodes[node_id]["occurrences"].append({"chunkId": chunk_id, "evidenceText": evidence})
                    self._add_context_edge(node_id, chunk_node_id, resource_id, chunk_id, evidence, point.get("confidence", 0.8))
                
                # 添加实体节点
                for item in chunk_result.get("entities", []):
                    entity = item if isinstance(item, dict) else {"name": str(item)}
                    name = str(entity.get("name") or entity.get("id") or "").strip()
                    if not name or self._is_technical_keyword(name):
                        continue
                    canonical_name = self._display_name(name)
                    node_id = self._generate_node_id(canonical_name, entity.get("type"))
                    aliases[name.casefold()] = node_id
                    aliases[canonical_name.casefold()] = node_id
                    
                    if node_id not in self.nodes:
                        self.nodes[node_id] = {
                            "id": node_id,
                            "name": canonical_name,
                            "displayName": canonical_name,
                            "rawName": name,
                            "canonicalName": canonical_name,
                            "aliases": [],
                            "occurrences": [],
                            **self._semantic_fields(canonical_name, entity.get("type")),
                            "type": entity.get("type"),
                            "evidenceText": entity.get("evidenceText"),
                            "resourceId": resource_id,
                            "chunkId": chunk_id,
                            "attributes": entity.get("attributes", {}),
                        }
                    self._record_alias(self.nodes[node_id], name)
                    
                    # 记录出现位置
                    self.nodes[node_id]["occurrences"].append({
                        "chunkId": chunk_id,
                        "evidenceText": entity.get("evidenceText")
                    })
                    self._add_context_edge(
                        node_id,
                        chunk_node_id,
                        resource_id,
                        chunk_id,
                        self._evidence(entity),
                        entity.get("confidence", 0.8)
                    )
                
                # 添加关系边
                for relation in chunk_result.get("relations", []):
                    if not isinstance(relation, dict):
                        continue
                    source_id = aliases.get(str(relation.get("source") or "").casefold()) or self._generate_node_id(relation.get("source"), None)
                    target_id = aliases.get(str(relation.get("target") or "").casefold()) or self._generate_node_id(relation.get("target"), None)
                    edge_id = self._generate_edge_id(source_id, target_id, relation.get("type"))
                    
                    if edge_id not in self.edges:
                        self.edges[edge_id] = {
                            "id": edge_id,
                            "source": source_id,
                            "target": target_id,
                            "type": relation.get("type"),
                            "evidenceText": relation.get("evidenceText"),
                            "resourceId": resource_id,
                            "chunkId": chunk_id,
                            "weight": 1.0
                        }
                    else:
                        # 增加权重（多次出现的关系更重要）
                        self.edges[edge_id]["weight"] += 0.5
        
        # 发现隐含关系（基于共现）
        self._discover_implicit_relations(extraction_results)
        
        return {
            "nodes": list(self.nodes.values()),
            "edges": list(self.edges.values()),
            "stats": {
                "node_count": len(self.nodes),
                "edge_count": len(self.edges),
                "node_types": self._count_node_types(),
                "edge_types": self._count_edge_types(),
                "keyword_count": self._count_keywords(),
                "chunk_count": self._count_chunks(),
                "context_edge_count": sum(1 for edge in self.edges.values() if edge.get("type") == "CONTEXT_MATCHES_CHUNK")
            }
        }
    
    def _discover_implicit_relations(self, extraction_results: List[Dict[str, Any]]):
        """发现隐含关系（基于共现）"""
        # 统计实体在同一 chunk 中的共现
        co_occurrence = defaultdict(lambda: defaultdict(int))
        
        for result in extraction_results:
            for chunk_result in result.get("results", []):
                entities = chunk_result.get("entities", [])
                entity_ids = [
                    self._generate_node_id(e.get("name"), e.get("type"))
                    for e in entities
                ]
                
                # 统计共现
                for i, id1 in enumerate(entity_ids):
                    for id2 in entity_ids[i+1:]:
                        co_occurrence[id1][id2] += 1
                        co_occurrence[id2][id1] += 1
        
        # 基于共现发现关系
        for source_id, targets in co_occurrence.items():
            for target_id, count in targets.items():
                if count >= 2:  # 至少共现2次
                    edge_id = self._generate_edge_id(source_id, target_id, "CO_OCCURS_WITH")
                    
                    if edge_id not in self.edges:
                        self.edges[edge_id] = {
                            "id": edge_id,
                            "source": source_id,
                            "target": target_id,
                            "type": "RELATED_CONTEXT",
                            "evidenceText": f"在 {count} 个处理单元中共现",
                            "weight": count * 0.3,
                            "discovered": True
                        }

    def _add_context_edge(self, node_id: str, chunk_node_id: str, resource_id: str, chunk_id: str, evidence: str, confidence: float):
        edge_id = self._generate_edge_id(node_id, chunk_node_id, "CONTEXT_MATCHES_CHUNK")
        if edge_id not in self.edges:
            self.edges[edge_id] = {
                "id": edge_id,
                "source": node_id,
                "target": chunk_node_id,
                "type": "CONTEXT_MATCHES_CHUNK",
                "evidenceText": evidence,
                "resourceId": resource_id,
                "chunkId": chunk_id,
                "weight": 1.0,
                "confidence": confidence
            }
        else:
            self.edges[edge_id]["weight"] += 0.5

    @staticmethod
    def _evidence(item: Dict[str, Any]) -> str:
        evidence = item.get("evidenceText") or item.get("evidence") or item.get("statement") or item.get("name") or ""
        if isinstance(evidence, list):
            evidence = evidence[0] if evidence else ""
        return str(evidence).strip()
    
    def _generate_node_id(self, name: str, entity_type: str) -> str:
        """生成节点 ID"""
        content = f"{str(name or '').casefold()}:{entity_type or ''}"
        hash_suffix = hashlib.sha256(content.encode()).hexdigest()[:8]
        return f"node:{hash_suffix}"
    
    def _generate_edge_id(self, source_id: str, target_id: str, relation_type: str) -> str:
        """生成边 ID"""
        content = f"{source_id}:{target_id}:{relation_type}"
        hash_suffix = hashlib.sha256(content.encode()).hexdigest()[:8]
        return f"edge:{hash_suffix}"
    
    def _count_node_types(self) -> Dict[str, int]:
        """统计节点类型"""
        type_counts = defaultdict(int)
        for node in self.nodes.values():
            node_type = node.get("type", "unknown")
            type_counts[node_type] += 1
        return dict(type_counts)
    
    def _count_edge_types(self) -> Dict[str, int]:
        """统计边类型"""
        type_counts = defaultdict(int)
        for edge in self.edges.values():
            edge_type = edge.get("type", "unknown")
            type_counts[edge_type] += 1
        return dict(type_counts)

    def _count_keywords(self) -> int:
        keyword_types = {"KnowledgePoint", "Keyword", "Parameter", "Concept", "Component", "Configuration", "Version", "ErrorCode", "YashanDBErrorCode", "OracleErrorCode"}
        return sum(1 for node in self.nodes.values() if node.get("type") in keyword_types)

    def _count_chunks(self) -> int:
        return sum(1 for node in self.nodes.values() if node.get("type") in {"ProcessingUnit", "Chunk"})

    @classmethod
    def _is_technical_keyword(cls, value: Any) -> bool:
        text = cls._display_name(value).casefold()
        if not text:
            return True
        for prefix in TECHNICAL_KEYWORD_PREFIXES:
            if text.startswith(prefix):
                suffix = text[len(prefix):]
                if any(ch.isdigit() for ch in suffix) or ":" in suffix:
                    return True
        return bool(
            re.fullmatch(r"(?:dataset|file|chunk|resource|document|task|batch|run|node|edge|unit)[_-][0-9a-z:-]{4,}", text)
            and (any(ch.isdigit() for ch in text) or ":" in text)
        )

    @staticmethod
    def _record_alias(node: Dict[str, Any], alias: Any) -> None:
        text = str(alias or "").strip()
        if not text:
            return
        aliases = node.setdefault("aliases", [])
        if text not in aliases and text.casefold() not in {item.casefold() for item in aliases if isinstance(item, str)}:
            aliases.append(text)

    @staticmethod
    def _display_name(value: Any) -> str:
        return DISPLAY_NAME_PREFIX_PATTERN.sub("", str(value or "").strip())

    @classmethod
    def _semantic_fields(cls, text: Any, node_type: Any) -> Dict[str, str]:
        value = f"{text or ''} {node_type or ''}"
        ontology_type = cls._ontology_type(value, str(node_type or "Concept"))
        return {
            "ontologyType": ontology_type,
            "knowledgeDomain": cls._knowledge_domain(ontology_type, value),
            "taskContext": cls._task_context(value),
        }

    @classmethod
    def _ontology_type(cls, text: str, node_type: str) -> str:
        if node_type in {"Parameter", "Concept", "Component", "Configuration", "Version", "ErrorCode", "YashanDBErrorCode", "OracleErrorCode"}:
            return node_type
        if cls._contains_any(text, SYMPTOM_HINTS):
            return "Symptom"
        if cls._contains_any(text, CONSTRAINT_HINTS):
            return "Constraint"
        if cls._contains_any(text, DECISION_HINTS):
            return "Decision"
        if cls._contains_any(text, SOLUTION_HINTS):
            return "Solution"
        if cls._contains_any(text, HOW_HINTS):
            return "Procedure"
        if cls._contains_any(text, WHY_HINTS):
            return "Principle"
        return "Concept"

    @staticmethod
    def _knowledge_domain(ontology_type: str, text: str) -> str:
        if ontology_type in {"Procedure", "Solution"}:
            return "how"
        if ontology_type in {"Principle", "Decision", "Constraint", "Symptom"}:
            return "why"
        if any(hint in text for hint in HOW_HINTS):
            return "how"
        if any(hint in text for hint in WHY_HINTS):
            return "why"
        return "what"

    @classmethod
    def _task_context(cls, text: str) -> str:
        context_hints = {
            "troubleshooting": ("报错", "异常", "失败", "修复", "定位", "根因", "超时"),
            "design": ("设计", "架构", "方案", "取舍", "原则", "模型"),
            "configuration": ("配置", "参数", "环境变量", "部署", "启动"),
            "testing": ("测试", "验证", "用例", "断言", "覆盖"),
            "migration": ("迁移", "升级", "兼容", "替换", "切换"),
        }
        for context, hints in context_hints.items():
            if cls._contains_any(text, hints):
                return context
        return "general"

    @staticmethod
    def _contains_any(text: str, hints: tuple[str, ...]) -> bool:
        normalized = str(text or "").casefold()
        return any(str(hint).casefold() in normalized for hint in hints)
