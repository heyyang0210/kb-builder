from __future__ import annotations

import hashlib
import json
import logging
from collections import deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .graph_exploration_service import compact_edge, compact_node, edge_sort_key
from .graph_quality_check_service import GraphQualityCheckService
from .repositories.graph_version_repository import GraphVersionRepository


logger = logging.getLogger(__name__)


class GraphVersionService:
    """编排正式发布快照，并提供不返回全量事实的版本只读能力。"""

    _REDACTED_KEYS = {"body", "content", "prompt", "promptText", "contextText", "documentText", "rawDocument"}

    def __init__(
        self,
        data_root: Path,
        repository: GraphVersionRepository,
        quality_checks: GraphQualityCheckService,
        training_service: Any,
    ):
        self.data_root = Path(data_root)
        self.repository = repository
        self.quality_checks = quality_checks
        self.training = training_service

    def after_publish(self, dataset: Any) -> dict[str, Any]:
        graph_source = str((getattr(dataset, "graph_summary", {}) or {}).get("graphSource") or "")
        if graph_source != "final_knowledge":
            return {"created": False, "reason": "not_final_knowledge", "status": "not_applicable", "warningCount": 0}
        try:
            result = self._create_version(dataset)
            self._append_audit(dataset, "graph_version.created", result)
            return result
        except Exception as exc:
            warning = {
                "created": False,
                "reason": "snapshot_failed",
                "status": "warning",
                "warningCount": 1,
                "warning": "正式数据集已发布，但图谱版本快照创建失败",
            }
            self._append_audit(dataset, "graph_version.failed", {**warning, "errorType": type(exc).__name__, "error": str(exc)[:500]})
            logger.warning(json.dumps({"event": "graph_version.failed", "datasetId": getattr(dataset, "id", None), "errorType": type(exc).__name__, "error": str(exc)[:500]}, ensure_ascii=False))
            return warning

    def _create_version(self, dataset: Any) -> dict[str, Any]:
        dataset_root = self._dataset_root(dataset)
        raw_nodes = self._read_list(dataset_root / "graph" / "nodes.json")
        raw_edges = self._read_list(dataset_root / "graph" / "edges.json")
        nodes = [self._sanitize(item) for item in raw_nodes]
        edges = [self._sanitize(item) for item in raw_edges]
        source_fingerprint = self.repository.source_fingerprint(nodes, edges)
        previous = next(iter(self.repository.list(str(dataset.id))), None)
        summary = {
            **dict(getattr(dataset, "graph_summary", {}) or {}),
            "nodeCount": len(nodes),
            "edgeCount": len(edges),
            "keywordFilterState": self.training._keyword_filter_state(raw_nodes),
        }
        checks, health, rules = self.quality_checks.evaluate(nodes, edges, summary, previous)
        filter_run = self._source_filter_run(str(dataset.id))
        model = self._model_snapshot(filter_run)
        model_fingerprint = "sha256:" + hashlib.sha256(json.dumps(model, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest() if any(model.values()) else None
        version_rules = rules["versionGovernance"]
        idempotency_key = "|".join((str(dataset.id), source_fingerprint, str(version_rules["schemaVersion"]), str(rules["rulesVersion"])))
        manifest, created = self.repository.create(
            idempotency_key=idempotency_key,
            metadata={
                "datasetId": str(dataset.id),
                "batchId": str(dataset.batch_id),
                "sourceTrainingTaskId": getattr(dataset, "training_task_id", None),
                "sourceFilterRunId": filter_run.get("filterRunId") if filter_run else None,
                "graphSource": "final_knowledge",
                "schemaVersion": str(version_rules["schemaVersion"]),
                "rulesVersion": str(rules["rulesVersion"]),
                "modelFingerprint": model_fingerprint,
                "modelSnapshot": model,
                "createdAt": datetime.now(timezone.utc).isoformat(),
                "createdBy": "system",
            },
            nodes=nodes,
            edges=edges,
            summary=summary,
            checks=checks,
            health=health,
            rules_snapshot=rules,
        )
        return {
            "created": True,
            "idempotentReused": not created,
            "graphVersionId": manifest["graphVersionId"],
            "status": manifest["publishChecks"]["status"],
            "warningCount": manifest["publishChecks"]["warningCount"],
        }

    def list_versions(self, dataset_id: str | None, page: int, page_size: int) -> dict[str, Any]:
        manifests = self.repository.list(dataset_id)
        available = [item for item in manifests if item.get("integrity") == "available"]
        current_id = available[0].get("graphVersionId") if available else None
        start = (page - 1) * page_size
        return {
            "total": len(manifests),
            "page": page,
            "pageSize": page_size,
            "items": [self._list_item(item, current_id) for item in manifests[start:start + page_size]],
        }

    def detail(self, graph_version_id: str) -> dict[str, Any]:
        return self.repository.read_verified(graph_version_id)

    def checks(self, graph_version_id: str) -> dict[str, Any]:
        manifest = self.repository.read_verified(graph_version_id)
        return {"graphVersionId": graph_version_id, "rulesVersion": manifest.get("rulesVersion"), **self.repository.read_artifact(graph_version_id, "checks")}

    def explore(self, graph_version_id: str, focus_node_id: str, depth: int) -> dict[str, Any]:
        manifest = self.repository.read_verified(graph_version_id)
        nodes = self.repository.read_artifact(graph_version_id, "nodes")
        edges = self.repository.read_artifact(graph_version_id, "edges")
        node_by_id = {str(item.get("id")): item for item in nodes if item.get("id")}
        if focus_node_id not in node_by_id:
            raise KeyError(focus_node_id)
        limits = manifest["rulesSnapshot"]["renderLimits"]
        allowed_depths = [int(value) for value in limits["allowedDepths"]]
        if depth not in allowed_depths:
            raise ValueError("depth 不在发布规则允许范围内")
        adjacency: dict[str, list[dict[str, Any]]] = {node_id: [] for node_id in node_by_id}
        for edge in edges:
            source, target = str(edge.get("source") or ""), str(edge.get("target") or "")
            if source in node_by_id and target in node_by_id:
                adjacency[source].append(edge)
                adjacency[target].append(edge)
        visited = {focus_node_id: 0}
        queue = deque([focus_node_id])
        while queue:
            current = queue.popleft()
            if visited[current] >= depth:
                continue
            for edge in sorted(adjacency.get(current, []), key=edge_sort_key):
                other = str(edge.get("target")) if str(edge.get("source")) == current else str(edge.get("source"))
                if other not in visited:
                    visited[other] = visited[current] + 1
                    queue.append(other)
        matched_edges = [edge for edge in edges if str(edge.get("source")) in visited and str(edge.get("target")) in visited]
        ordered_ids = sorted(visited, key=lambda node_id: (visited[node_id], str(node_by_id[node_id].get("displayName") or node_by_id[node_id].get("name") or "").casefold(), node_id))
        node_limit, edge_limit = int(limits["maxNodes"]), int(limits["maxEdges"])
        selected_ids = set(ordered_ids[:node_limit])
        selected_edges = [item for item in sorted(matched_edges, key=edge_sort_key) if str(item.get("source")) in selected_ids and str(item.get("target")) in selected_ids][:edge_limit]
        endpoint_ids = {focus_node_id} | {str(value) for item in selected_edges for value in (item.get("source"), item.get("target"))}
        selected_nodes = [compact_node(node_by_id[node_id]) for node_id in ordered_ids if node_id in endpoint_ids]
        return {
            "context": {"graphVersionId": graph_version_id, "datasetId": manifest.get("datasetId"), "focusNodeId": focus_node_id, "depth": depth},
            "focusNode": compact_node(node_by_id[focus_node_id]),
            "nodes": selected_nodes,
            "edges": [compact_edge(item) for item in selected_edges],
            "counts": {"matchedNodes": len(visited), "matchedEdges": len(matched_edges), "returnedNodes": len(selected_nodes), "returnedEdges": len(selected_edges)},
            "truncated": len(selected_nodes) < len(visited) or len(selected_edges) < len(matched_edges),
        }

    def trends(self, dataset_id: str, limit: int) -> dict[str, Any]:
        manifests = [item for item in self.repository.list(dataset_id) if item.get("integrity") == "available"][:limit]
        manifests.reverse()
        segment, previous_rules = 0, None
        items = []
        for manifest in manifests:
            rules_version = manifest.get("rulesVersion")
            rules_changed = previous_rules is not None and rules_version != previous_rules
            if rules_changed:
                segment += 1
            items.append({
                "graphVersionId": manifest.get("graphVersionId"),
                "createdAt": manifest.get("createdAt"),
                "rulesVersion": rules_version,
                "rulesSegment": segment,
                "rulesChanged": rules_changed,
                "health": manifest.get("health") or {},
                "warningCount": (manifest.get("publishChecks") or {}).get("warningCount", 0),
            })
            previous_rules = rules_version
        return {"datasetId": dataset_id, "total": len(items), "items": items, "segmentedByRulesVersion": True}

    def governance_rules(self) -> dict[str, Any]:
        return self.quality_checks.rules()["versionGovernance"]

    def _source_filter_run(self, dataset_id: str) -> dict[str, Any] | None:
        repository = getattr(self.training, "keyword_filter_runs", None)
        if repository is None or not hasattr(repository, "list_runs"):
            return None
        try:
            items = repository.list_runs(dataset_id, offset=0, limit=100).get("items", [])
        except Exception:
            return None
        return next((item for item in items if item.get("status") == "applied"), items[0] if items else None)

    def _model_snapshot(self, filter_run: dict[str, Any] | None) -> dict[str, Any]:
        model = {
            "provider": filter_run.get("modelProvider") if filter_run else None,
            "model": filter_run.get("modelName") if filter_run else None,
        }
        if any(model.values()) or not hasattr(self.training, "model_config"):
            return model
        try:
            current = self.training.model_config()
        except Exception:
            return model
        return {"provider": current.get("provider"), "model": current.get("model")}

    def _dataset_root(self, dataset: Any) -> Path:
        relative = getattr(dataset, "dataset_path", None) or f"datasets/{dataset.id}"
        path = (self.data_root / relative).resolve()
        if self.data_root.resolve() not in path.parents:
            raise ValueError("数据集路径超出数据根目录")
        return path

    @staticmethod
    def _read_list(path: Path) -> list[dict[str, Any]]:
        value = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(value, list) or any(not isinstance(item, dict) for item in value):
            raise ValueError(f"图谱产物结构错误：{path.name}")
        return value

    @classmethod
    def _sanitize(cls, value: Any, key: str = "") -> Any:
        if key in cls._REDACTED_KEYS:
            return None
        if key == "evidenceText":
            return str(value or "")[:500]
        if isinstance(value, dict):
            return {item_key: cls._sanitize(item_value, item_key) for item_key, item_value in value.items() if item_key not in cls._REDACTED_KEYS}
        if isinstance(value, list):
            return [cls._sanitize(item) for item in value]
        return value

    @staticmethod
    def _list_item(manifest: dict[str, Any], current_id: str | None) -> dict[str, Any]:
        if manifest.get("integrity") != "available":
            return manifest
        artifacts = manifest.get("artifacts") or {}
        return {
            "graphVersionId": manifest.get("graphVersionId"),
            "datasetId": manifest.get("datasetId"),
            "batchId": manifest.get("batchId"),
            "createdAt": manifest.get("createdAt"),
            "graphSource": manifest.get("graphSource"),
            "rulesVersion": manifest.get("rulesVersion"),
            "sourceTrainingTaskId": manifest.get("sourceTrainingTaskId"),
            "sourceFilterRunId": manifest.get("sourceFilterRunId"),
            "nodeCount": (artifacts.get("nodes") or {}).get("count", 0),
            "edgeCount": (artifacts.get("edges") or {}).get("count", 0),
            "health": manifest.get("health") or {},
            "status": (manifest.get("publishChecks") or {}).get("status"),
            "warningCount": (manifest.get("publishChecks") or {}).get("warningCount", 0),
            "isCurrent": manifest.get("graphVersionId") == current_id,
            "integrity": "available",
        }

    def _append_audit(self, dataset: Any, event: str, details: dict[str, Any]) -> None:
        try:
            path = self._dataset_root(dataset) / "graph-version-audit.jsonl"
            path.parent.mkdir(parents=True, exist_ok=True)
            record = {"event": event, "datasetId": str(dataset.id), "createdAt": datetime.now(timezone.utc).isoformat(), **details}
            with path.open("a", encoding="utf-8") as output:
                output.write(json.dumps(record, ensure_ascii=False, sort_keys=True) + "\n")
        except OSError:
            logger.warning(json.dumps({"event": "graph_version.audit_failed", "datasetId": getattr(dataset, "id", None)}, ensure_ascii=False))
