"""基于 embedding 的最小可用聚类报告。"""

from __future__ import annotations

import hashlib
import json
import math
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


class EmbeddingClusterService:
    def __init__(self, config: dict[str, Any]):
        self.config = config or {}

    def build(
        self,
        run_root: Path,
        embedding_index: list[dict[str, Any]],
        documents: list[dict[str, Any]],
    ) -> tuple[dict[str, Any], list[dict[str, Any]]]:
        cluster_config = self._cluster_config()
        issues: list[dict[str, Any]] = []
        if not cluster_config.get("enabled", True):
            issues.append(self._issue("CLUSTER_SKIPPED_DISABLED", "embedding 聚类配置已禁用"))
            report = self._empty_report(embedding_index, issues)
            self._persist(run_root, report, issues)
            return report, issues
        vectors = self._load_vectors(run_root, embedding_index, issues)
        if not vectors:
            issues.append(self._issue("CLUSTER_SKIPPED_NO_EMBEDDINGS", "缺少可用 embedding，跳过聚类"))
            report = self._empty_report(embedding_index, issues)
            self._persist(run_root, report, issues)
            return report, issues

        ids = list(vectors)
        threshold = float(cluster_config.get("threshold") or 0.82)
        parent = {item: item for item in ids}
        for left_index, left in enumerate(ids):
            for right in ids[left_index + 1:]:
                if self._cosine(vectors[left], vectors[right]) >= threshold:
                    self._union(parent, left, right)
        components: dict[str, list[str]] = {}
        for item in ids:
            components.setdefault(self._find(parent, item), []).append(item)

        index_by_id = {str(item.get("embeddingId") or ""): item for item in embedding_index}
        docs_by_resource = {str(item.get("resourceId") or ""): item for item in documents}
        clusters = [
            self._cluster_record(members, vectors, index_by_id, docs_by_resource)
            for members in components.values()
        ]
        clusters.sort(key=lambda item: (item["representativeTitle"].casefold(), item["clusterId"]))
        report = {
            "schemaVersion": "1.0",
            "algorithm": cluster_config.get("algorithm"),
            "embeddingIndexHash": self._hash_json(embedding_index),
            "model": self._common_value(embedding_index, "model"),
            "dimension": self._common_value(embedding_index, "dimension"),
            "threshold": threshold,
            "minClusterSize": int(cluster_config.get("minClusterSize") or 2),
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "summary": {
                "embeddingCount": len(embedding_index),
                "clusterCount": len(clusters),
                "singletonCount": sum(1 for item in clusters if len(item["memberEmbeddingIds"]) == 1),
                "warningCount": len(issues),
            },
            "clusters": clusters,
        }
        self._persist(run_root, report, issues)
        return report, issues

    def _cluster_record(
        self,
        members: list[str],
        vectors: dict[str, list[float]],
        index_by_id: dict[str, dict[str, Any]],
        docs_by_resource: dict[str, dict[str, Any]],
    ) -> dict[str, Any]:
        members = sorted(members)
        records = [index_by_id[item] for item in members if item in index_by_id]
        resource_ids = sorted({str(item.get("resourceId") or "") for item in records if item.get("resourceId")})
        chunk_ids = sorted({str(item.get("chunkId") or "") for item in records if item.get("chunkId")})
        titles = [str(item.get("semanticTitle") or "") for item in records if item.get("semanticTitle")]
        title_counts = Counter(titles)
        representative_title = title_counts.most_common(1)[0][0] if title_counts else ""
        keywords: list[str] = []
        for resource_id in resource_ids:
            for candidate in docs_by_resource.get(resource_id, {}).get("topicCandidates") or []:
                if isinstance(candidate, dict) and candidate.get("name"):
                    keywords.append(str(candidate["name"]))
        centroid = self._centroid([vectors[item] for item in members if item in vectors])
        similarities = [self._cosine(vectors[item], centroid) for item in members if item in vectors]
        cluster_id = "cluster_" + hashlib.sha1(json.dumps({
            "algorithm": self._cluster_config().get("algorithm"),
            "threshold": self._cluster_config().get("threshold"),
            "provider": self._common_value(records, "provider"),
            "model": self._common_value(records, "model"),
            "dimension": self._common_value(records, "dimension"),
            "members": [
                {
                    "resourceId": item.get("resourceId"),
                    "chunkId": item.get("chunkId"),
                    "contentHash": item.get("contentHash"),
                }
                for item in sorted(records, key=lambda value: str(value.get("embeddingId") or ""))
            ],
        }, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()[:20]
        return {
            "clusterId": cluster_id,
            "representativeTitle": representative_title,
            "representativeKeywords": sorted(set(keywords), key=str.casefold),
            "resourceIds": resource_ids,
            "chunkIds": chunk_ids,
            "memberEmbeddingIds": members,
            "averageSimilarity": round(sum(similarities) / len(similarities), 6) if similarities else 0,
            "stabilityKey": self._hash_json([item.get("contentHash") for item in records]),
        }

    def _load_vectors(self, run_root: Path, embedding_index: list[dict[str, Any]], issues: list[dict[str, Any]]) -> dict[str, list[float]]:
        vectors: dict[str, list[float]] = {}
        for record in embedding_index:
            cache_key = str(record.get("cacheKey") or "")
            embedding_id = str(record.get("embeddingId") or "")
            if not cache_key or not embedding_id:
                continue
            path = run_root / str(self._cache_config().get("directory") or "model-results/embedding-cache") / f"{cache_key}.json"
            try:
                value = json.loads(path.read_text(encoding="utf-8"))
                vector = value.get("vector")
                if isinstance(vector, list):
                    vectors[embedding_id] = [float(item) for item in vector]
            except (OSError, json.JSONDecodeError, TypeError, ValueError):
                issues.append(self._issue("CLUSTER_VECTOR_UNAVAILABLE", f"无法读取 embedding 缓存：{embedding_id}"))
        return vectors

    def _empty_report(self, embedding_index: list[dict[str, Any]], issues: list[dict[str, Any]]) -> dict[str, Any]:
        return {
            "schemaVersion": "1.0",
            "algorithm": self._cluster_config().get("algorithm"),
            "embeddingIndexHash": self._hash_json(embedding_index),
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "summary": {
                "embeddingCount": len(embedding_index),
                "clusterCount": 0,
                "singletonCount": 0,
                "warningCount": len(issues),
            },
            "clusters": [],
        }

    def _cluster_config(self) -> dict[str, Any]:
        value = self.config.get("cluster")
        return value if isinstance(value, dict) else {}

    def _cache_config(self) -> dict[str, Any]:
        value = self.config.get("cache")
        return value if isinstance(value, dict) else {}

    @staticmethod
    def _cosine(left: list[float], right: list[float]) -> float:
        if not left or not right or len(left) != len(right):
            return 0.0
        dot = sum(a * b for a, b in zip(left, right))
        left_norm = math.sqrt(sum(a * a for a in left))
        right_norm = math.sqrt(sum(b * b for b in right))
        if left_norm == 0 or right_norm == 0:
            return 0.0
        return dot / (left_norm * right_norm)

    @staticmethod
    def _centroid(vectors: list[list[float]]) -> list[float]:
        if not vectors:
            return []
        size = len(vectors[0])
        return [sum(vector[index] for vector in vectors) / len(vectors) for index in range(size)]

    @classmethod
    def _find(cls, parent: dict[str, str], item: str) -> str:
        while parent[item] != item:
            parent[item] = parent[parent[item]]
            item = parent[item]
        return item

    @classmethod
    def _union(cls, parent: dict[str, str], left: str, right: str) -> None:
        left_root = cls._find(parent, left)
        right_root = cls._find(parent, right)
        if left_root != right_root:
            parent[right_root] = left_root

    @staticmethod
    def _common_value(records: list[dict[str, Any]], field: str) -> Any:
        values = [item.get(field) for item in records if item.get(field) is not None]
        return values[0] if values else None

    @staticmethod
    def _issue(code: str, message: str) -> dict[str, Any]:
        return {
            "issueId": hashlib.sha256(f"{code}:{message}".encode("utf-8")).hexdigest()[:24],
            "code": code,
            "severity": "warning",
            "message": message,
        }

    @staticmethod
    def _hash_json(value: Any) -> str:
        return "sha256:" + hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()

    @staticmethod
    def _write_json(path: Path, value: Any) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(path.suffix + ".tmp")
        temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
        temporary.replace(path)

    def _persist(self, run_root: Path, report: dict[str, Any], issues: list[dict[str, Any]]) -> None:
        self._write_json(run_root / "metadata/cluster-report.json", report)
        self._write_json(run_root / "quality/cluster-issues.json", issues)
