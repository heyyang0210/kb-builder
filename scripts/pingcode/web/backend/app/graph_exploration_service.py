from __future__ import annotations

from collections import deque
from typing import Any
from urllib.parse import quote


class GraphExplorationService:
    """基于过滤运行冻结决策的只读图谱投影、搜索和探索。"""

    def __init__(self, training_service: Any, file_service: Any | None = None):
        self.training = training_service
        self.files = file_service

    @staticmethod
    def _location(level: str, heading_path: list[Any], *, start: int | None = None, end: int | None = None, basis: str, message: str) -> dict[str, Any]:
        return {
            "level": level,
            "headingPath": heading_path,
            "start": start,
            "end": end,
            "basis": basis,
            "message": message,
        }

    def _resolve_source(
        self,
        resource_id: str,
        evidence_text: str,
        heading_path: list[Any],
        offsets: dict[str, Any],
        preview_cache: dict[str, Any],
    ) -> tuple[str, dict[str, Any] | None, dict[str, Any], dict[str, str]]:
        if not resource_id:
            return (
                "unlinked",
                None,
                self._location("unavailable", heading_path, basis="no_resource_reference", message="证据记录未关联原始文档"),
                {"message": "缺少稳定的文档资源引用", "suggestedAction": "repair_link"},
            )
        if self.files is None:
            return (
                "source_unavailable",
                None,
                self._location("unavailable", heading_path, basis="resolver_unavailable", message="当前服务无法解析原始文档"),
                {"message": "原始文档解析服务不可用", "suggestedAction": "check_source"},
            )
        try:
            resource, _ = self.files.find(resource_id)
        except (KeyError, FileNotFoundError, OSError):
            return (
                "source_unavailable",
                None,
                self._location("unavailable", heading_path, basis="resource_not_found", message="资源引用存在，但原始文档已不可用"),
                {"message": "无法通过资源标识找到原始文档", "suggestedAction": "check_source"},
            )

        encoded = quote(resource_id, safe="")
        source = {
            "availability": "available",
            "name": resource.name,
            "logicalPath": resource.logical_path,
            "mediaType": resource.media_type,
            "previewMode": "download_only",
            "previewUrl": None,
            "contentUrl": f"/api/files/{encoded}/content",
            "downloadUrl": f"/api/files/{encoded}/download",
        }
        preview = preview_cache.get(resource_id, ...)
        if preview is ...:
            try:
                preview = self.files.preview(resource_id)
            except (KeyError, FileNotFoundError, ValueError, OSError):
                preview = None
            preview_cache[resource_id] = preview
        if preview is not None:
            source["previewMode"] = "structured_text"
            source["previewUrl"] = f"/api/files/{encoded}/preview-data"
        elif resource.previewable:
            source["previewMode"] = "inline"
            source["previewUrl"] = f"/api/files/{encoded}/preview"

        fallback_level = "section" if heading_path else "document"
        fallback_basis = "heading_path" if heading_path else "resource_reference"
        fallback_message = "已定位到原文章节，需人工确认原句" if heading_path else "已定位到原始文档，暂无法精确到原句"
        if not evidence_text.strip():
            return (
                "snippet_missing",
                source,
                self._location(fallback_level, heading_path, basis=fallback_basis, message=fallback_message),
                {"message": "原始文档可用，但该记录没有证据片段", "suggestedAction": "open_document"},
            )

        if preview is not None:
            content = str(preview.content or "")
            rules = self.training.graph_observability_service._rules().get("evidenceResolution", {})
            scan_limit = int(rules.get("maxLocationScanCharacters", 2_000_000))
            if len(content) <= scan_limit:
                try:
                    start, end = int(offsets.get("start")), int(offsets.get("end"))
                except (TypeError, ValueError):
                    start, end = -1, -1
                if 0 <= start < end <= len(content) and content[start:end] == evidence_text:
                    location = self._location("exact", heading_path, start=start, end=end, basis="verified_document_offsets", message="已校验原文偏移并定位到证据片段")
                    return "available", source, location, {"message": "来源与证据均可核验", "suggestedAction": "preview"}
                first = content.find(evidence_text)
                if first >= 0 and content.find(evidence_text, first + 1) < 0:
                    location = self._location("exact", heading_path, start=first, end=first + len(evidence_text), basis="verified_evidence_text", message="已在结构化原文中定位到唯一证据片段")
                    return "available", source, location, {"message": "来源与证据均可核验", "suggestedAction": "preview"}

        return (
            "available",
            source,
            self._location(fallback_level, heading_path, basis=fallback_basis, message=fallback_message),
            {"message": "证据片段可用，但原文位置需要人工确认", "suggestedAction": "open_document"},
        )

    @staticmethod
    def _candidate_from_node(node: dict[str, Any]) -> dict[str, Any]:
        return {
            "keywordId": str(node.get("keywordId") or node.get("id") or ""),
            "keywordName": node.get("canonicalName") or node.get("name") or "",
            "keywordRawName": node.get("name") or node.get("canonicalName") or "",
            "aliases": list(node.get("aliases") or []),
            "evidenceRefs": sorted({
                str(value)
                for field in ("evidenceRefs", "chunkIds", "resourceIds", "documentIds")
                for value in (node.get(field) or [])
                if value
            }),
            "currentStatus": self_status(node),
        }

    def _projection(self, dataset_id: str, filter_run_id: str | None, view: str) -> dict[str, Any]:
        _, raw_nodes, raw_edges, _ = self.training.graph_observability_service._dataset_graph(dataset_id)
        fingerprint = self.training.graph_observability_service._fingerprint(raw_nodes)
        if not filter_run_id:
            nodes, edges = self.training._graph_projection(raw_nodes, raw_edges)
            return {
                "nodes": nodes,
                "edges": edges,
                "decisions": {},
                "availability": "available" if view == "after" else "pending",
                "sourceFingerprint": fingerprint,
                "warnings": [] if view == "after" else [f"视图 {view} 需要绑定过滤运行"],
            }

        repository = self.training.keyword_filter_runs
        run = repository.read_run(dataset_id, filter_run_id)
        candidates = repository.read_candidate_snapshot(dataset_id, filter_run_id)
        current_candidates = [
            self._candidate_from_node(node)
            for node in raw_nodes
            if node.get("type") == "Keyword" and (node.get("keywordId") or node.get("id"))
        ]
        current_candidates.sort(key=lambda item: item["keywordId"])
        if repository.fingerprint_candidates(current_candidates) != run.get("sourceGraphVersion"):
            return {
                "nodes": [],
                "edges": [],
                "decisions": {},
                "availability": "stale",
                "sourceFingerprint": fingerprint,
                "warnings": ["过滤运行对应的图谱事实已不可用，未按同名节点拼接当前关系"],
            }

        final = repository.read_final_decisions(dataset_id, filter_run_id)
        model = repository.read_model_decisions(dataset_id, filter_run_id) or []
        if final is None:
            review = repository.read_review_decisions(dataset_id, filter_run_id)
            final = self.training._effective_filter_decisions(model, review)
        decision_by_id = {
            str(item.get("keywordId")): item for item in final if item.get("keywordId")
        }
        candidate_ids = {str(item.get("keywordId")) for item in candidates if item.get("keywordId")}
        visible_keyword_ids: set[str]
        if view == "before":
            visible_keyword_ids = candidate_ids
        elif view == "after":
            visible_keyword_ids = {
                keyword_id for keyword_id, item in decision_by_id.items()
                if action_of(item) == "keep"
            }
        else:
            visible_keyword_ids = {
                keyword_id for keyword_id, item in decision_by_id.items()
                if action_of(item) == "exclude"
                or action_of(item) != item.get("modelAction")
                or category_of(item) != item.get("modelIssueCategory")
            }
        graph_id_by_keyword_id = {
            str(node.get("keywordId") or node.get("id")): str(node.get("id"))
            for node in raw_nodes if node.get("type") == "Keyword" and node.get("id")
        }
        visible_ids = {
            graph_id_by_keyword_id[keyword_id]
            for keyword_id in visible_keyword_ids if keyword_id in graph_id_by_keyword_id
        }
        node_by_id = {str(node.get("id")): node for node in raw_nodes if node.get("id")}
        for edge in raw_edges:
            source = str(edge.get("source") or "")
            target = str(edge.get("target") or "")
            if source in visible_ids and target in node_by_id:
                visible_ids.add(target)
            elif target in visible_ids and source in node_by_id:
                visible_ids.add(source)
        nodes = [node for node in raw_nodes if str(node.get("id")) in visible_ids]
        edges = [
            edge for edge in raw_edges
            if str(edge.get("source")) in visible_ids and str(edge.get("target")) in visible_ids
        ]
        return {
            "nodes": nodes,
            "edges": edges,
            "decisions": decision_by_id,
            "availability": "available",
            "sourceFingerprint": fingerprint,
            "warnings": [],
        }

    @staticmethod
    def _matches_resource(node: dict[str, Any], resource_id: str) -> bool:
        values = {
            str(value)
            for field in ("sourceResourceId", "resourceId", "resourceIds", "documentIds")
            for value in ([node.get(field)] if not isinstance(node.get(field), list) else node.get(field))
            if value
        }
        for occurrence in node.get("occurrences") or []:
            if isinstance(occurrence, dict):
                values.update(str(occurrence.get(key)) for key in ("resourceId", "sourceResourceId", "documentId") if occurrence.get(key))
        return resource_id in values

    def search(
        self,
        dataset_id: str,
        *,
        filter_run_id: str | None,
        view: str,
        query: str | None,
        node_type: str | None,
        issue_category: str | None,
        resource_id: str | None,
        page: int,
        page_size: int,
    ) -> dict[str, Any]:
        projection = self._projection(dataset_id, filter_run_id, view)
        if projection["availability"] != "available":
            return {"total": 0, "page": page, "pageSize": page_size, "items": [], "sourceAvailability": projection["availability"], "warnings": projection["warnings"]}
        needle = str(query or "").strip().casefold()
        items = []
        for node in projection["nodes"]:
            if node_type and str(node.get("type")) != node_type:
                continue
            keyword_id = str(node.get("keywordId") or node.get("id") or "")
            decision = projection["decisions"].get(keyword_id, {})
            if issue_category and category_of(decision) != issue_category:
                continue
            if resource_id and not self._matches_resource(node, resource_id):
                continue
            searchable = " ".join(str(value) for value in (
                node.get("displayName"), node.get("canonicalName"), node.get("name"),
                node.get("rawName"), node.get("id"), " ".join(node.get("aliases") or []),
            ) if value).casefold()
            if needle and needle not in searchable:
                continue
            items.append({**compact_node(node), "issueCategory": category_of(decision), "action": action_of(decision) if decision else None})
        items.sort(key=lambda item: (str(item.get("displayName") or item.get("canonicalName") or item.get("name") or "").casefold(), str(item.get("id") or "")))
        total = len(items)
        start = (page - 1) * page_size
        return {"total": total, "page": page, "pageSize": page_size, "items": items[start:start + page_size], "sourceAvailability": "available", "warnings": projection["warnings"]}

    def explore(
        self,
        dataset_id: str,
        *,
        filter_run_id: str | None,
        view: str,
        focus_node_id: str,
        depth: int,
        node_type: str | None,
        issue_category: str | None,
        resource_id: str | None,
    ) -> dict[str, Any]:
        projection = self._projection(dataset_id, filter_run_id, view)
        scope = {"datasetId": dataset_id, "filterRunId": filter_run_id, "view": view, "focusNodeId": focus_node_id, "depth": depth, "projectionAvailability": projection["availability"], "sourceFingerprint": projection["sourceFingerprint"]}
        if projection["availability"] != "available":
            return {"scope": scope, "focusNode": None, "nodes": [], "edges": [], "counts": {"matchedNodes": 0, "matchedEdges": 0, "returnedNodes": 0, "returnedEdges": 0}, "truncated": False, "warnings": projection["warnings"]}
        node_by_id = {str(node.get("id")): node for node in projection["nodes"] if node.get("id")}
        if focus_node_id not in node_by_id:
            raise KeyError(focus_node_id)
        allowed_ids = set(node_by_id)
        if node_type or issue_category or resource_id:
            filtered = self.search(dataset_id, filter_run_id=filter_run_id, view=view, query=None, node_type=node_type, issue_category=issue_category, resource_id=resource_id, page=1, page_size=100)
            allowed_ids = {str(node.get("id")) for node in filtered["items"]} | {focus_node_id}
        adjacency: dict[str, list[dict[str, Any]]] = {node_id: [] for node_id in node_by_id}
        for edge in projection["edges"]:
            source, target = str(edge.get("source")), str(edge.get("target"))
            if source in allowed_ids and target in allowed_ids:
                adjacency.setdefault(source, []).append(edge)
                adjacency.setdefault(target, []).append(edge)
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
        matched_edges = [edge for edge in projection["edges"] if str(edge.get("source")) in visited and str(edge.get("target")) in visited]
        rules = self.training.graph_observability_service._rules()["renderLimits"]
        node_limit, edge_limit = int(rules.get("maxNodes", 80)), int(rules.get("maxEdges", 160))
        ordered_ids = sorted(visited, key=lambda node_id: (visited[node_id], str(node_by_id[node_id].get("displayName") or node_by_id[node_id].get("name") or "").casefold(), node_id))
        returned_ids = set(ordered_ids[:node_limit])
        returned_edges = [edge for edge in sorted(matched_edges, key=edge_sort_key) if str(edge.get("source")) in returned_ids and str(edge.get("target")) in returned_ids][:edge_limit]
        endpoint_ids = {focus_node_id} | {str(value) for edge in returned_edges for value in (edge.get("source"), edge.get("target"))}
        returned_nodes = [compact_node(node_by_id[node_id]) for node_id in ordered_ids if node_id in endpoint_ids]
        compact_edges = [compact_edge(edge) for edge in returned_edges]
        return {"scope": scope, "focusNode": compact_node(node_by_id[focus_node_id]), "nodes": returned_nodes, "edges": compact_edges, "counts": {"matchedNodes": len(visited), "matchedEdges": len(matched_edges), "returnedNodes": len(returned_nodes), "returnedEdges": len(compact_edges)}, "truncated": len(returned_nodes) < len(visited) or len(compact_edges) < len(matched_edges), "warnings": projection["warnings"]}

    def evidence(
        self,
        dataset_id: str,
        *,
        filter_run_id: str | None,
        view: str,
        node_id: str | None,
        edge_id: str | None,
        resource_id: str | None,
        missing_evidence: bool,
        page: int,
        page_size: int,
    ) -> dict[str, Any]:
        projection = self._projection(dataset_id, filter_run_id, view)
        if projection["availability"] != "available":
            return {"target": None, "evidenceAvailability": projection["availability"], "total": 0, "page": page, "pageSize": page_size, "items": [], "warnings": projection["warnings"]}
        target = None
        if node_id:
            target = next((node for node in projection["nodes"] if str(node.get("id")) == node_id), None)
        if target is None and edge_id:
            target = next((edge for edge in projection["edges"] if str(edge.get("id")) == edge_id), None)
        if target is None:
            raise KeyError(node_id or edge_id or "")
        properties = target.get("properties") if isinstance(target.get("properties"), dict) else {}
        occurrences = target.get("occurrences") or properties.get("occurrences") or []
        if not occurrences:
            occurrences = [{
                "resourceId": target.get("resourceId") or target.get("sourceResourceId"),
                "documentTitle": target.get("documentTitle"),
                "sourcePath": target.get("sourcePath"),
                "chunkId": target.get("chunkId"),
                "headingPath": target.get("headingPath"),
                "evidenceText": target.get("evidenceText"),
                "documentOffsets": target.get("documentOffsets") or target.get("evidenceOffsets"),
            }]
        unique: dict[tuple[str, str, str], dict[str, Any]] = {}
        source_available: dict[str, bool] = {}
        evidence_rules = self.training.graph_observability_service._rules().get("evidenceResolution", {})
        snippet_limit = int(evidence_rules.get("maxSnippetCharacters", 500))
        for occurrence in occurrences:
            if not isinstance(occurrence, dict):
                continue
            current_resource = str(occurrence.get("resourceId") or occurrence.get("sourceResourceId") or "")
            if resource_id and current_resource != resource_id:
                continue
            chunk_id = str(occurrence.get("chunkId") or "")
            evidence_text = str(occurrence.get("evidenceText") or "")[:snippet_limit]
            heading_path = occurrence.get("headingPath") or []
            offsets = occurrence.get("documentOffsets") or occurrence.get("evidenceOffsets") or {}
            if not current_resource:
                availability = "unlinked"
            else:
                if current_resource not in source_available:
                    try:
                        if self.files is None:
                            raise KeyError(current_resource)
                        self.files.find(current_resource)
                        source_available[current_resource] = True
                    except (KeyError, FileNotFoundError, OSError):
                        source_available[current_resource] = False
                if not source_available[current_resource]:
                    availability = "source_unavailable"
                else:
                    availability = "available" if evidence_text.strip() else "snippet_missing"
            if missing_evidence and availability == "available":
                continue
            key = (current_resource, chunk_id, evidence_text)
            unique[key] = {
                "nodeId": node_id,
                "edgeId": edge_id,
                "resourceId": current_resource or None,
                "documentTitle": occurrence.get("documentTitle"),
                "sourcePath": occurrence.get("sourcePath"),
                "chunkId": chunk_id or None,
                "headingPath": heading_path,
                "evidenceText": evidence_text,
                "documentOffsets": offsets,
                "evidenceAvailability": availability,
            }
        items = sorted(unique.values(), key=lambda item: (str(item.get("documentTitle") or "").casefold(), str(item.get("resourceId") or ""), str(item.get("chunkId") or ""), item["evidenceText"]))
        total = len(items)
        start = (page - 1) * page_size
        overall = "available" if any(item["evidenceAvailability"] == "available" for item in items) else (items[0]["evidenceAvailability"] if items else "unlinked")
        preview_cache: dict[str, Any] = {}
        page_items = items[start:start + page_size]
        for item in page_items:
            availability, source, location, diagnostic = self._resolve_source(
                str(item.get("resourceId") or ""),
                item["evidenceText"],
                item["headingPath"],
                item["documentOffsets"],
                preview_cache,
            )
            item["evidenceAvailability"] = availability
            item["documentTitle"] = item.get("documentTitle") or (source or {}).get("name")
            item["sourcePath"] = item.get("sourcePath") or (source or {}).get("logicalPath")
            item["source"] = source
            item["location"] = location
            item["diagnostic"] = diagnostic
        target_summary = compact_node(target) if node_id else compact_edge(target)
        return {"target": target_summary, "evidenceAvailability": overall, "total": total, "page": page, "pageSize": page_size, "items": page_items, "warnings": projection["warnings"]}


def self_status(node: dict[str, Any]) -> str:
    return str(node.get("admissionStatus") or (node.get("properties") or {}).get("admissionStatus") or "excluded")


def action_of(decision: dict[str, Any]) -> str | None:
    return decision.get("finalAction") or decision.get("action") or decision.get("modelAction")


def category_of(decision: dict[str, Any]) -> str | None:
    return decision.get("finalIssueCategory") or decision.get("issueCategory") or decision.get("modelIssueCategory")


def edge_sort_key(edge: dict[str, Any]) -> tuple[Any, ...]:
    return (0 if edge.get("type") == "CONTEXT_MATCHES_CHUNK" else 1, -float(edge.get("confidence", edge.get("weight", 0)) or 0), str(edge.get("id") or ""), str(edge.get("source") or ""), str(edge.get("target") or ""))


def compact_node(node: dict[str, Any]) -> dict[str, Any]:
    keys = ("id", "keywordId", "type", "displayName", "canonicalName", "name", "rawName", "aliases", "admissionStatus", "qualityStatus", "confidence", "modelConfidence", "knowledgeDomain", "ontologyType")
    return {key: node.get(key) for key in keys if node.get(key) is not None}


def compact_edge(edge: dict[str, Any]) -> dict[str, Any]:
    keys = ("id", "type", "source", "target", "confidence", "weight", "qualityStatus")
    return {key: edge.get(key) for key in keys if edge.get(key) is not None}
