from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


class GraphNodeNotFoundError(KeyError):
    pass


class GraphObservabilityService:
    """只读的图谱观察模型；不会调用图谱回填或持久化方法。"""

    def __init__(self, training_service: Any, config_path: Path):
        self.training = training_service
        self.config_path = Path(config_path)
        self._graph_cache: dict[str, tuple[tuple[int, int, int, int], list[dict[str, Any]], list[dict[str, Any]]]] = {}
        self._fingerprint_cache: dict[int, str] = {}

    def _rules(self) -> dict[str, Any]:
        fallback = {
            "rulesVersion": "graph-observability-v1",
            "renderLimits": {"defaultNodes": 80, "maxNodes": 80, "defaultEdges": 160, "maxEdges": 160, "defaultDepth": 1, "allowedDepths": [1, 2]},
            "healthThresholds": {"relationCoverageWarningBelow": 0.8, "evidenceCompletenessWarningBelow": 0.9, "isolatedKnowledgeWarningAbove": 0.2, "whyMissingWarningAbove": 0.5},
        }
        try:
            value = json.loads(self.config_path.read_text(encoding="utf-8"))
            if not isinstance(value, dict):
                raise ValueError("配置不是对象")
            return {**fallback, **value, "renderLimits": {**fallback["renderLimits"], **value.get("renderLimits", {})}, "healthThresholds": {**fallback["healthThresholds"], **value.get("healthThresholds", {})}}
        except (OSError, json.JSONDecodeError, ValueError):
            return fallback

    def _dataset_graph(self, dataset_id: str) -> tuple[Any, list[dict[str, Any]], list[dict[str, Any]], Path]:
        dataset = self.training.preprocess.get_dataset(dataset_id)
        if dataset.state == "deleted" or not dataset.training_task_id:
            raise FileNotFoundError(dataset_id)
        graph_dir = self.training._run_dir(dataset.training_task_id) / "graph"
        nodes_path, edges_path = graph_dir / "nodes.json", graph_dir / "edges.json"
        if not nodes_path.is_file() or not edges_path.is_file():
            raise FileNotFoundError(dataset_id)
        try:
            nodes_stat, edges_stat = nodes_path.stat(), edges_path.stat()
            stamp = (nodes_stat.st_mtime_ns, nodes_stat.st_size, edges_stat.st_mtime_ns, edges_stat.st_size)
            cached = self._graph_cache.get(dataset_id)
            if cached and cached[0] == stamp:
                return dataset, cached[1], cached[2], graph_dir
            nodes = json.loads(nodes_path.read_text(encoding="utf-8"))
            edges = json.loads(edges_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise FileNotFoundError(dataset_id) from exc
        if not isinstance(nodes, list) or not isinstance(edges, list):
            raise FileNotFoundError(dataset_id)
        self._graph_cache[dataset_id] = (stamp, nodes, edges)
        return dataset, nodes, edges, graph_dir

    @staticmethod
    def _metric(value: int | float | None, numerator: int, denominator: int, *, count_only: bool = False) -> dict[str, Any]:
        if count_only:
            return {"value": value, "numerator": numerator, "denominator": None, "availability": "available"}
        if denominator <= 0:
            return {"value": None, "numerator": numerator, "denominator": denominator, "availability": "not_applicable"}
        return {"value": value, "numerator": numerator, "denominator": denominator, "availability": "available"}

    def _fingerprint(self, nodes: list[dict[str, Any]]) -> str:
        cache_key = id(nodes)
        if cache_key in self._fingerprint_cache:
            return self._fingerprint_cache[cache_key]
        payload = json.dumps(nodes, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        value = "sha256:" + hashlib.sha256(payload.encode("utf-8")).hexdigest()
        if len(self._fingerprint_cache) >= 16:
            self._fingerprint_cache.clear()
        self._fingerprint_cache[cache_key] = value
        return value

    def observability(self, dataset_id: str, filter_run_id: str | None = None, view: str = "after") -> dict[str, Any]:
        rules = self._rules()
        dataset, raw_nodes, raw_edges, graph_dir = self._dataset_graph(dataset_id)
        run = None
        if filter_run_id:
            run = self.training.keyword_filter_runs.read_run(dataset_id, filter_run_id)
        source_fingerprint = self._fingerprint(raw_nodes)
        projected_nodes, projected_edges = self.training._graph_projection(raw_nodes, raw_edges)
        summary = self.training._graph_summary(projected_nodes, projected_edges, [], str((dataset.graph_summary or {}).get("graphSource") or "final_knowledge"))
        enriched_nodes = self.training._with_graph_display_names(projected_nodes)
        knowledge = [node for node in enriched_nodes if node.get("type") in {"KnowledgePoint", "Keyword", "Parameter", "Concept", "Component", "Configuration", "Version", "ErrorCode", "YashanDBErrorCode", "OracleErrorCode", "Procedure", "Principle", "Decision", "Constraint", "Symptom", "Solution"} and node.get("knowledgeDomain") != "evidence"]
        connected = {str(value) for edge in projected_edges for value in (edge.get("source"), edge.get("target")) if value}
        evidence = [edge for edge in projected_edges if edge.get("type") == "CONTEXT_MATCHES_CHUNK"]
        complete_evidence = [edge for edge in evidence if edge.get("sourceResourceId") and edge.get("chunkId") and edge.get("evidenceText")]
        why = sum(1 for node in knowledge if node.get("knowledgeDomain") == "why")
        cross = summary.get("crossDocumentRelationCount", 0)
        knowledge_count = len(knowledge)
        coverage_num = sum(1 for node in knowledge if node.get("id") in connected)
        projected_keyword_count = sum(1 for node in projected_nodes if node.get("type") == "Keyword")
        total_keywords = sum(1 for node in raw_nodes if node.get("type") == "Keyword")
        source_availability = "available"
        warnings: list[str] = []
        if run:
            current_run_fingerprint = self.training.keyword_filter_runs.fingerprint_candidates(self._candidates(raw_nodes))
            if not run.get("sourceGraphVersion"):
                source_availability = "unknown"
                warnings.append("过滤运行缺少来源指纹，无法确认其与当前图谱是否一致")
            elif run.get("sourceGraphVersion") != current_run_fingerprint:
                source_availability = "stale"
                warnings.append("过滤运行对应的关键词快照已过期，当前概览仅反映现有图谱")
        if view != "after":
            warnings.append(f"视图 {view} 尚无稳定服务端快照")
        updated_at = datetime.fromtimestamp(graph_dir.stat().st_mtime, tz=timezone.utc).isoformat()
        return {
            "datasetId": dataset_id, "filterRunId": filter_run_id, "graphVersionId": None,
            "scope": {"view": view, "availability": "available" if view == "after" else "pending", "graphSource": summary.get("graphSource"), "graphSchemaVersion": summary.get("graphSchemaVersion"), "projectionBasis": "current_admission_status", "sourceFingerprint": source_fingerprint, "sourceAvailability": source_availability, "updatedAt": updated_at},
            "counts": {"fact": {"nodes": len(raw_nodes), "edges": len(raw_edges)}, "projected": {"nodes": len(projected_nodes), "edges": len(projected_edges)}, "keywords": {"before": total_keywords, "kept": projected_keyword_count, "excluded": max(0, total_keywords - projected_keyword_count)}},
            "health": {
                "relationCoverage": self._metric(round(coverage_num / knowledge_count, 4) if knowledge_count else None, coverage_num, knowledge_count),
                "evidenceCompleteness": self._metric(round(len(complete_evidence) / len(evidence), 4) if evidence else None, len(complete_evidence), len(evidence)),
                "isolatedKnowledgeRatio": self._metric(round((knowledge_count - coverage_num) / knowledge_count, 4) if knowledge_count else None, knowledge_count - coverage_num, knowledge_count),
                "whyMissingRate": self._metric(round(1 - why / knowledge_count, 4) if knowledge_count else None, knowledge_count - why, knowledge_count),
                "crossDocumentRelationCount": self._metric(cross, cross, 0, count_only=True),
            },
            "warnings": warnings, "rulesVersion": rules.get("rulesVersion", "graph-observability-v1"),
        }

    def _candidates(self, nodes: list[dict[str, Any]]) -> list[dict[str, Any]]:
        result = []
        for node in nodes:
            if node.get("type") != "Keyword":
                continue
            keyword_id = str(node.get("keywordId") or node.get("id") or "")
            if keyword_id:
                result.append({"keywordId": keyword_id, "keywordName": node.get("canonicalName") or node.get("name") or "", "keywordRawName": node.get("name") or node.get("canonicalName") or "", "aliases": list(node.get("aliases") or []), "evidenceRefs": sorted({str(value) for field in ("evidenceRefs", "chunkIds", "resourceIds", "documentIds") for value in (node.get(field) or []) if value}), "currentStatus": self.training._read_admission_status(node)})
        return sorted(result, key=lambda item: item["keywordId"])

    def bounded_neighborhood(self, dataset_id: str, node_id: str, limit: int = 80, depth: int = 1) -> dict[str, Any]:
        rules = self._rules()["renderLimits"]
        _, raw_nodes, raw_edges, _ = self._dataset_graph(dataset_id)
        nodes, edges = self.training._graph_projection(raw_nodes, raw_edges)
        by_id = {str(node.get("id")): node for node in nodes}
        focus = by_id.get(str(node_id))
        if focus is None:
            raise GraphNodeNotFoundError(node_id)
        depth = depth if depth in rules.get("allowedDepths", [1, 2]) else int(rules.get("defaultDepth", 1))
        node_limit = int(rules.get("maxNodes", 80))
        edge_limit = min(max(1, int(limit)), int(rules.get("maxEdges", 160)))
        eligible_edges = [edge for edge in edges if edge.get("type") == "CONTEXT_MATCHES_CHUNK"]
        adjacency = {str(node_id): 0}
        frontier = {str(node_id)}
        for _ in range(depth):
            next_frontier = set()
            for edge in eligible_edges:
                source, target = str(edge.get("source")), str(edge.get("target"))
                if source in frontier or target in frontier:
                    unseen = {source, target} - set(adjacency)
                    adjacency.setdefault(source, 0); adjacency.setdefault(target, 0)
                    next_frontier.update(unseen)
            frontier = next_frontier
        candidates = [edge for edge in eligible_edges if str(edge.get("source")) in adjacency and str(edge.get("target")) in adjacency]
        candidates.sort(key=lambda edge: (-float(edge.get("weight", edge.get("confidence", 0)) or 0), str(edge.get("type", "")), str(edge.get("id", ""))))
        selected_edges, selected_ids = [], {str(node_id)}
        for edge in candidates:
            if len(selected_edges) >= edge_limit:
                break
            endpoints = {str(edge.get("source")), str(edge.get("target"))}
            if len(selected_ids | endpoints) > node_limit:
                continue
            selected_edges.append(edge); selected_ids.update(endpoints)
        selected_nodes = [by_id[item] for item in by_id if item in selected_ids]
        selected_nodes = [self.training._with_graph_display_names([node])[0] for node in selected_nodes]
        return {"context": {"datasetId": dataset_id, "filterRunId": None, "graphVersionId": None, "view": "after", "filters": {}, "focusNodeId": str(node_id), "depth": depth}, "focusNode": next(node for node in selected_nodes if str(node.get("id")) == str(node_id)), "nodes": selected_nodes, "edges": selected_edges, "counts": {"nodes": {"total": len(adjacency), "visible": len(selected_nodes), "truncated": len(selected_nodes) < len(adjacency)}, "edges": {"total": len(candidates), "visible": len(selected_edges), "truncated": len(selected_edges) < len(candidates)}}, "truncated": len(selected_nodes) < len(adjacency) or len(selected_edges) < len(candidates), "limit": edge_limit, "totalEdges": len(candidates), "displayMode": "neighborhood", "rulesVersion": self._rules().get("rulesVersion", "graph-observability-v1")}
