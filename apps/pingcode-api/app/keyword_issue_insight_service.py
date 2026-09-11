from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Any


class KeywordIssueInsightService:
    """基于过滤运行有效决策和当前冻结图谱指纹生成问题洞察。"""

    def __init__(self, data_root: Path):
        self.data_root = Path(data_root)

    def build_overview(
        self,
        *,
        dataset_id: str,
        filter_run_id: str,
        decisions: list[dict[str, Any]],
        categories: list[dict[str, str]],
        decision_basis: str,
        source_available: bool,
        allow_cache_write: bool = True,
        graph_root: Path | None = None,
    ) -> dict[str, Any]:
        index = self._load_evidence_index(
            dataset_id, filter_run_id, source_available, allow_cache_write, graph_root
        )
        excluded = self._excluded_decisions(decisions)
        labels = {item["id"]: item["label"] for item in categories}
        buckets: dict[str, list[dict[str, Any]]] = {}
        for decision in excluded:
            category = str(decision.get("issueCategory") or "other")
            buckets.setdefault(category, []).append(decision)
        category_items = []
        all_resources: set[str] = set()
        for category_id, bucket in buckets.items():
            resources: set[str] = set()
            evidence_keys: set[tuple[str, str, str, str]] = set()
            missing = 0
            for decision in bucket:
                keyword_id = str(decision.get("keywordId") or "")
                documents = index.get("keywords", {}).get(keyword_id, {}).get("documents", [])
                occurrences = [
                    occurrence
                    for document in documents
                    for occurrence in document.get("occurrences", [])
                ]
                for document in documents:
                    resource_id = str(document.get("resourceId") or "")
                    if resource_id:
                        resources.add(resource_id)
                        all_resources.add(resource_id)
                for occurrence in occurrences:
                    evidence_keys.add((
                        keyword_id,
                        str(occurrence.get("resourceId") or ""),
                        str(occurrence.get("chunkId") or ""),
                        str(occurrence.get("evidenceText") or ""),
                    ))
                if not occurrences or not any(item[3] for item in evidence_keys if item[0] == keyword_id):
                    missing += 1
            category_items.append({
                "id": category_id,
                "label": labels.get(category_id, category_id),
                "keywordCount": len({str(item.get("keywordId")) for item in bucket}),
                "ratio": round(len(bucket) / len(excluded), 4) if excluded else 0,
                "documentCount": len(resources),
                "evidenceCount": len(evidence_keys),
                "missingEvidenceCount": missing,
            })
        category_items.sort(key=lambda item: (-item["keywordCount"], item["id"]))
        return {
            "filterRunId": filter_run_id,
            "decisionBasis": decision_basis,
            "evidenceAvailability": "available" if source_available else "stale",
            "excludedTotal": len(excluded),
            "affectedDocumentTotal": len(all_resources),
            "categories": category_items,
        }

    def query_evidence(
        self,
        *,
        dataset_id: str,
        filter_run_id: str,
        decisions: list[dict[str, Any]],
        decision_basis: str,
        source_available: bool,
        category: str | None = None,
        keyword_id: str | None = None,
        resource_id: str | None = None,
        query: str | None = None,
        missing_evidence: bool = False,
        page: int = 1,
        page_size: int = 50,
        allow_cache_write: bool = True,
        graph_root: Path | None = None,
    ) -> dict[str, Any]:
        if page < 1:
            raise ValueError("page 必须大于等于 1")
        if page_size < 1 or page_size > 100:
            raise ValueError("pageSize 必须在 1 到 100 之间")
        index = self._load_evidence_index(
            dataset_id, filter_run_id, source_available, allow_cache_write, graph_root
        )
        normalized_query = str(query or "").strip().casefold()
        items: list[dict[str, Any]] = []
        for decision in self._excluded_decisions(decisions):
            current_keyword_id = str(decision.get("keywordId") or "")
            if category and str(decision.get("issueCategory") or "") != category:
                continue
            if keyword_id and current_keyword_id != keyword_id:
                continue
            evidence = index.get("keywords", {}).get(current_keyword_id, {})
            documents = list(evidence.get("documents") or [])
            if resource_id:
                documents = [
                    document for document in documents
                    if str(document.get("resourceId") or "") == resource_id
                ]
                if not documents:
                    continue
            search_values = [
                decision.get("keywordName"),
                decision.get("keywordRawName"),
                current_keyword_id,
                *(decision.get("aliases") or []),
                *[
                    value
                    for document in documents
                    for value in (
                        document.get("documentTitle"),
                        document.get("sourcePath"),
                        document.get("resourceId"),
                    )
                ],
            ]
            if normalized_query and not any(
                normalized_query in str(value or "").casefold() for value in search_values
            ):
                continue
            availability = (
                "stale" if not source_available
                else "available" if any(
                    str(occurrence.get("evidenceText") or "").strip()
                    for document in documents
                    for occurrence in document.get("occurrences", [])
                )
                else "missing"
            )
            if missing_evidence and availability != "missing":
                continue
            items.append({
                "keywordId": current_keyword_id,
                "keywordName": decision.get("keywordName") or "",
                "keywordRawName": decision.get("keywordRawName") or "",
                "aliases": decision.get("aliases") or [],
                "finalCategory": decision.get("issueCategory"),
                "reason": decision.get("reason") or "",
                "userOverride": bool(decision.get("userOverride")),
                "documents": documents,
                "evidenceAvailability": availability,
            })
        items.sort(key=lambda item: (str(item.get("keywordName") or "").casefold(), item["keywordId"]))
        total = len(items)
        offset = (page - 1) * page_size
        return {
            "filterRunId": filter_run_id,
            "decisionBasis": decision_basis,
            "evidenceAvailability": "available" if source_available else "stale",
            "total": total,
            "page": page,
            "pageSize": page_size,
            "items": items[offset : offset + page_size],
        }

    @staticmethod
    def _excluded_decisions(decisions: list[dict[str, Any]]) -> list[dict[str, Any]]:
        unique: dict[str, dict[str, Any]] = {}
        for decision in decisions:
            keyword_id = str(decision.get("keywordId") or "")
            if keyword_id and decision.get("action") == "exclude":
                unique[keyword_id] = decision
        return list(unique.values())

    def _load_evidence_index(
        self,
        dataset_id: str,
        filter_run_id: str,
        source_available: bool,
        allow_cache_write: bool,
        graph_root: Path | None,
    ) -> dict[str, Any]:
        run_root = (
            self.data_root / "datasets" / dataset_id / "keyword-filter-runs" / filter_run_id
        )
        cache_path = run_root / "evidence-index.json"
        if cache_path.is_file():
            try:
                value = json.loads(cache_path.read_text(encoding="utf-8"))
                if isinstance(value, dict) and isinstance(value.get("keywords"), dict):
                    return value
            except (OSError, json.JSONDecodeError):
                pass
        if not source_available:
            return {"keywords": {}}
        index = self._build_evidence_index(dataset_id, graph_root)
        if allow_cache_write:
            self._write_json_atomic(cache_path, index)
        return index

    def _build_evidence_index(self, dataset_id: str, graph_root: Path | None) -> dict[str, Any]:
        dataset_root = self.data_root / "datasets" / dataset_id
        source_root = Path(graph_root) if graph_root else dataset_root
        nodes = self._read_json(source_root / "graph" / "nodes.json", [])
        documents = self._read_jsonl(dataset_root / "documents.jsonl")
        chunks = self._read_jsonl(dataset_root / "processing-units.jsonl")
        if not documents:
            documents = self._read_jsonl(source_root / "metadata" / "documents.jsonl")
        if not chunks:
            chunks = self._read_jsonl(source_root / "metadata" / "chunks.jsonl")
        document_lookup = {
            str(item.get("resourceId")): item for item in documents if item.get("resourceId")
        }
        chunk_lookup = {
            str(item.get("id") or item.get("chunkId")): item
            for item in chunks if item.get("id") or item.get("chunkId")
        }
        keywords: dict[str, Any] = {}
        for node in nodes if isinstance(nodes, list) else []:
            if not isinstance(node, dict) or node.get("type") != "Keyword":
                continue
            keyword_id = str(node.get("keywordId") or node.get("id") or "")
            if not keyword_id:
                continue
            properties = node.get("properties") if isinstance(node.get("properties"), dict) else {}
            occurrences = node.get("occurrences") or properties.get("occurrences") or []
            if not occurrences and (
                node.get("sourceResourceId") or node.get("chunkId") or node.get("evidenceText")
            ):
                occurrences = [{
                    "resourceId": node.get("sourceResourceId"),
                    "chunkId": node.get("chunkId"),
                    "evidenceText": node.get("evidenceText"),
                }]
            occurrence_keys: set[tuple[str, str, str, str]] = set()
            document_groups: dict[str, dict[str, Any]] = {}
            for occurrence in occurrences:
                if not isinstance(occurrence, dict):
                    continue
                resource_id = str(occurrence.get("resourceId") or occurrence.get("sourceResourceId") or "")
                chunk_id = str(occurrence.get("chunkId") or "")
                evidence_text = str(occurrence.get("evidenceText") or "")[:500]
                key = (keyword_id, resource_id, chunk_id, evidence_text)
                if key in occurrence_keys:
                    continue
                occurrence_keys.add(key)
                document = document_lookup.get(resource_id, {})
                chunk = chunk_lookup.get(chunk_id, {})
                group_key = resource_id or "__missing_resource__"
                group = document_groups.setdefault(group_key, {
                    "resourceId": resource_id or None,
                    "documentTitle": occurrence.get("documentTitle") or document.get("title"),
                    "sourcePath": document.get("sourcePath") or chunk.get("sourcePath"),
                    "occurrences": [],
                })
                group["occurrences"].append({
                    "resourceId": resource_id or None,
                    "chunkId": chunk_id or None,
                    "headingPath": chunk.get("headingPath") or [],
                    "evidenceText": evidence_text,
                    "sourceLocations": occurrence.get("sourceLocations") or chunk.get("sourceLocations") or [],
                    "documentOffsets": occurrence.get("documentOffsets") or occurrence.get("evidenceOffsets") or {},
                })
            keywords[keyword_id] = {"documents": list(document_groups.values())}
        return {"schemaVersion": "1.0", "keywords": keywords}

    @staticmethod
    def _read_json(path: Path, default: Any) -> Any:
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return default

    @staticmethod
    def _read_jsonl(path: Path) -> list[dict[str, Any]]:
        try:
            return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
        except (OSError, json.JSONDecodeError):
            return []

    @staticmethod
    def _write_json_atomic(path: Path, value: Any) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        descriptor, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
        try:
            with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
                json.dump(value, handle, ensure_ascii=False, indent=2)
                handle.write("\n")
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary_name, path)
        finally:
            if os.path.exists(temporary_name):
                os.unlink(temporary_name)
