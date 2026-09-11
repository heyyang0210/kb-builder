from __future__ import annotations

import json
from typing import Any

from .repositories.graph_version_repository import GraphVersionRepository


class GraphVersionDiffService:
    """仅按稳定 ID 比较两个不可变版本，不按名称推断对象身份。"""

    def __init__(self, repository: GraphVersionRepository):
        self.repository = repository

    def diff(
        self,
        left_version_id: str,
        right_version_id: str,
        *,
        change_type: str,
        query: str | None,
        page: int,
        page_size: int,
    ) -> dict[str, Any]:
        left_manifest = self.repository.read_verified(left_version_id)
        right_manifest = self.repository.read_verified(right_version_id)
        node_changes, node_counts = self._compare(
            self.repository.read_artifact(left_version_id, "nodes"),
            self.repository.read_artifact(right_version_id, "nodes"),
            "node",
        )
        edge_changes, edge_counts = self._compare(
            self.repository.read_artifact(left_version_id, "edges"),
            self.repository.read_artifact(right_version_id, "edges"),
            "edge",
        )
        all_changes = node_changes + edge_changes
        all_changes.sort(key=lambda item: (item["entityType"], item["changeType"], item["id"]))
        filtered = all_changes
        if change_type != "all":
            filtered = [item for item in filtered if item["changeType"] == change_type]
        needle = str(query or "").strip().casefold()
        if needle:
            filtered = [item for item in filtered if needle in json.dumps(item, ensure_ascii=False, sort_keys=True).casefold()]
        start = (page - 1) * page_size
        summary = {
            "nodes": node_counts,
            "edges": edge_counts,
            "total": len(all_changes),
        }
        return {
            "leftVersionId": left_version_id,
            "rightVersionId": right_version_id,
            "summary": summary,
            "total": len(filtered),
            "page": page,
            "pageSize": page_size,
            "items": filtered[start:start + page_size],
            "healthChanges": self._health_changes(left_manifest.get("health") or {}, right_manifest.get("health") or {}),
            "rulesChange": {
                "changed": left_manifest.get("rulesVersion") != right_manifest.get("rulesVersion"),
                "before": left_manifest.get("rulesVersion"),
                "after": right_manifest.get("rulesVersion"),
            },
            "lineageChanges": self._lineage_changes(left_manifest, right_manifest),
        }

    @staticmethod
    def _compare(left: list[dict[str, Any]], right: list[dict[str, Any]], entity_type: str) -> tuple[list[dict[str, Any]], dict[str, int]]:
        left_by_id = {str(item.get("id")): item for item in left}
        right_by_id = {str(item.get("id")): item for item in right}
        added = sorted(set(right_by_id) - set(left_by_id))
        removed = sorted(set(left_by_id) - set(right_by_id))
        changed = sorted(item_id for item_id in set(left_by_id) & set(right_by_id) if GraphVersionDiffService._canonical(left_by_id[item_id]) != GraphVersionDiffService._canonical(right_by_id[item_id]))
        items = [
            *({"entityType": entity_type, "changeType": "added", "id": item_id, "before": None, "after": right_by_id[item_id]} for item_id in added),
            *({"entityType": entity_type, "changeType": "removed", "id": item_id, "before": left_by_id[item_id], "after": None} for item_id in removed),
            *({"entityType": entity_type, "changeType": "changed", "id": item_id, "before": left_by_id[item_id], "after": right_by_id[item_id]} for item_id in changed),
        ]
        return items, {"added": len(added), "removed": len(removed), "changed": len(changed), "total": len(items)}

    @staticmethod
    def _health_changes(left: dict[str, Any], right: dict[str, Any]) -> list[dict[str, Any]]:
        items = []
        for key in sorted(set(left) | set(right)):
            before = (left.get(key) or {}).get("value") if isinstance(left.get(key), dict) else left.get(key)
            after = (right.get(key) or {}).get("value") if isinstance(right.get(key), dict) else right.get(key)
            if before != after:
                delta = round(after - before, 4) if isinstance(before, (int, float)) and isinstance(after, (int, float)) else None
                items.append({"metric": key, "before": before, "after": after, "delta": delta})
        return items

    @staticmethod
    def _lineage_changes(left: dict[str, Any], right: dict[str, Any]) -> list[dict[str, Any]]:
        keys = ("datasetId", "batchId", "sourceTrainingTaskId", "sourceFilterRunId", "modelFingerprint", "sourceFingerprint")
        return [{"field": key, "before": left.get(key), "after": right.get(key)} for key in keys if left.get(key) != right.get(key)]

    @staticmethod
    def _canonical(value: dict[str, Any]) -> str:
        return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
