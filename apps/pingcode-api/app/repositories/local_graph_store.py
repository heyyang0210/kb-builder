"""Local GraphStore projection over verified immutable graph facts."""

from __future__ import annotations

import fcntl
import hashlib
import json
import os
import tempfile
from contextlib import contextmanager
from dataclasses import asdict
from typing import Any, Iterator, Mapping, Sequence

from ..graph_store_contract import (
    CanonicalGraphEdge,
    CanonicalGraphNode,
    GraphQueryContext,
    GraphStoreContractError,
    GraphWriteContext,
    GraphWriteRun,
    WriteBatchResult,
    WriteItemResult,
)
from .graph_version_repository import (
    GraphVersionIntegrityError,
    GraphVersionNotFoundError,
    GraphVersionRepository,
)


class LocalGraphStore:
    """Persist canonical projections without mutable dataset pointer fallback."""

    store_id = "local"

    def __init__(self, repository: GraphVersionRepository, *, write_repository=None):
        self.repository = repository
        self.write_repository = write_repository
        self.root = repository.root.parent / "graph-store" / self.store_id

    def health(self) -> dict[str, Any]:
        return {"storeId": self.store_id, "status": "available"}

    def begin_write(self, run: GraphWriteRun) -> dict[str, Any]:
        if not isinstance(run, GraphWriteRun):
            raise GraphStoreContractError("GRAPH_WRITE_CONTEXT_INVALID", "GraphWriteRun is required")
        context = GraphWriteContext(
            write_run_id=run.write_run_id,
            store_id=run.store_id,
            dataset_id=run.dataset_id,
            graph_version_id=run.graph_version_id,
            source_snapshot_id=run.source_snapshot_id,
        )
        manifest = self._verified_for_write(context)
        if manifest.get("sourceFingerprint") != run.source_fingerprint:
            raise GraphStoreContractError("GRAPH_WRITE_CONFLICT", "source fingerprint does not match immutable version")
        expected = {
            "datasetId": run.dataset_id,
            "graphVersionId": run.graph_version_id,
            "sourceSnapshotId": run.source_snapshot_id,
            "sourceFingerprint": run.source_fingerprint,
        }
        with self._lock(run.graph_version_id):
            state = self._read_state(run.graph_version_id)
            existing = state.get("metadata") or {}
            if existing and existing != expected:
                raise GraphStoreContractError("GRAPH_WRITE_CONFLICT", "projection metadata conflicts with immutable facts")
            state["metadata"] = expected
            self._write_state(run.graph_version_id, state)
        return {"writeRunId": run.write_run_id, "graphVersionId": run.graph_version_id, "idempotent": bool(existing)}

    def upsert_nodes(self, context, batch) -> WriteBatchResult:
        self._verified_for_write(context)
        return self._upsert(context, "nodes", batch, CanonicalGraphNode, "node_id")

    def upsert_edges(self, context, batch) -> WriteBatchResult:
        self._verified_for_write(context)
        items = tuple(batch)
        if any(not isinstance(item, CanonicalGraphEdge) for item in items):
            raise GraphStoreContractError("GRAPH_EDGE_SCHEMA_INVALID", "edge batch must contain canonical edges")
        with self._lock(context.graph_version_id):
            state = self._read_state(context.graph_version_id)
            nodes = self._values(state, "nodes", CanonicalGraphNode)
            node_by_id = {node.node_id: node for node in nodes}
            for edge in items:
                source = node_by_id.get(edge.from_node_id)
                target = node_by_id.get(edge.to_node_id)
                if source is None or target is None:
                    raise GraphStoreContractError("GRAPH_DANGLING_EDGE", "edge endpoint is absent from projection", edgeId=edge.edge_id)
                if any(node.dataset_id != edge.dataset_id or node.graph_version_id != edge.graph_version_id for node in (source, target)):
                    raise GraphStoreContractError("GRAPH_CROSS_VERSION_EDGE", "edge crosses dataset or graph version", edgeId=edge.edge_id)
                if not set(edge.acl_scope).issubset(set(source.acl_scope).intersection(target.acl_scope)):
                    raise GraphStoreContractError("GRAPH_ACL_CONFLICT", "edge ACL is wider than endpoints", edgeId=edge.edge_id)
                if not edge.evidence_refs:
                    raise GraphStoreContractError("GRAPH_EDGE_EVIDENCE_REQUIRED", "edge evidence is required", edgeId=edge.edge_id)
        return self._upsert(context, "edges", items, CanonicalGraphEdge, "edge_id")

    def validate(self, context: GraphWriteContext) -> dict[str, Any]:
        manifest = self._verified_for_write(context)
        state = self._read_state(context.graph_version_id)
        issues: list[dict[str, str]] = []
        nodes, node_hashes = self._checked_values(state, "nodes", CanonicalGraphNode, issues)
        edges, edge_hashes = self._checked_values(state, "edges", CanonicalGraphEdge, issues)
        node_by_id = {node.node_id: node for node in nodes}
        dangling = 0
        cross_version = 0
        expected_nodes = int(manifest["artifacts"]["nodes"]["count"])
        expected_edges = int(manifest["artifacts"]["edges"]["count"])
        evidence_passed = (
            len(nodes) == expected_nodes
            and len(edges) == expected_edges
            and all(node.evidence_refs for node in nodes)
            and all(edge.evidence_refs for edge in edges)
        )
        acl_passed = (
            len(nodes) == expected_nodes
            and len(edges) == expected_edges
            and all(node.acl_scope for node in nodes)
            and all(edge.acl_scope for edge in edges)
        )
        for edge in edges:
            source = node_by_id.get(edge.from_node_id)
            target = node_by_id.get(edge.to_node_id)
            if source is None or target is None:
                dangling += 1
                continue
            if any(node.dataset_id != edge.dataset_id or node.graph_version_id != edge.graph_version_id for node in (source, target)):
                cross_version += 1
            if not set(edge.acl_scope).issubset(set(source.acl_scope).intersection(target.acl_scope)):
                acl_passed = False
        metadata = state.get("metadata") if isinstance(state.get("metadata"), dict) else {}
        fingerprint = metadata.get("sourceFingerprint") == manifest.get("sourceFingerprint") and node_hashes and edge_hashes
        passed = (
            len(nodes) == expected_nodes
            and len(edges) == expected_edges
            and not dangling
            and not cross_version
            and evidence_passed
            and acl_passed
            and fingerprint
            and not issues
        )
        return {
            "graphVersionId": context.graph_version_id,
            "status": "passed" if passed else "failed",
            "expectedNodeCount": expected_nodes,
            "actualNodeCount": len(nodes),
            "expectedEdgeCount": expected_edges,
            "actualEdgeCount": len(edges),
            "danglingEdgeCount": dangling,
            "crossVersionCount": cross_version,
            "fingerprintMatched": fingerprint,
            "evidenceSamplePassed": evidence_passed,
            "aclSamplePassed": acl_passed,
            "issues": issues,
        }

    def get_entity(self, context: GraphQueryContext, node_id: str):
        _, nodes, _ = self._load_query(context)
        for node in nodes:
            if node.node_id == node_id:
                self._require_acl(context, node.acl_scope)
                return self._node_response(node)
        return None

    def query_neighborhood(self, context: GraphQueryContext, request: Mapping[str, Any]):
        _, nodes, edges = self._load_query(context)
        if not isinstance(request, Mapping) or not isinstance(request.get("focusNodeId"), str):
            raise GraphStoreContractError("GRAPH_QUERY_CONTEXT_INVALID", "focusNodeId is required")
        focus_id = request["focusNodeId"]
        node_by_id = {node.node_id: node for node in nodes}
        if focus_id not in node_by_id:
            return self._projection(context, None, [], [], False)
        self._require_acl(context, node_by_id[focus_id].acl_scope)
        selected = {focus_id}
        frontier = {focus_id}
        selected_edges = []
        truncated = False
        for _ in range(context.depth):
            next_frontier = set()
            for edge in edges:
                endpoints = {edge.from_node_id, edge.to_node_id}
                if not endpoints.intersection(frontier) or not all(item in node_by_id for item in endpoints):
                    continue
                if not self._permitted(context, edge.acl_scope) or not all(self._permitted(context, node_by_id[item].acl_scope) for item in endpoints):
                    continue
                if len(selected_edges) >= context.max_edges or len(selected.union(endpoints)) > context.max_nodes:
                    truncated = True
                    continue
                selected_edges.append(edge)
                next_frontier.update(endpoints - selected)
                selected.update(endpoints)
            frontier = next_frontier
            if not frontier:
                break
        return self._projection(
            context,
            self._node_response(node_by_id[focus_id]),
            [self._node_response(node) for node in nodes if node.node_id in selected],
            [self._edge_response(edge) for edge in selected_edges],
            truncated,
        )

    def query_evidence(self, context: GraphQueryContext, target: Mapping[str, Any]):
        _, nodes, edges = self._load_query(context)
        if not isinstance(target, Mapping):
            raise GraphStoreContractError("GRAPH_QUERY_CONTEXT_INVALID", "evidence target is required")
        object_id = target.get("objectId")
        item = next((value for value in [*nodes, *edges] if self._object_id(value) == object_id), None)
        if item is None:
            return {"graphVersionId": context.graph_version_id, "items": []}
        self._require_acl(context, item.acl_scope)
        return {"graphVersionId": context.graph_version_id, "items": list(item.evidence_refs)}

    def invalidate(self, context: GraphWriteContext, *, reason: str, actor_ref: str):
        self._verified_context(context)
        if not isinstance(reason, str) or not reason or not isinstance(actor_ref, str) or not actor_ref:
            raise GraphStoreContractError("GRAPH_WRITE_CONTEXT_INVALID", "invalidation requires reason and actor_ref")
        event = {
            "datasetId": context.dataset_id,
            "graphVersionId": context.graph_version_id,
            "sourceSnapshotId": context.source_snapshot_id,
            "writeRunId": context.write_run_id,
            "status": "invalidated",
            "reason": reason,
            "actorRef": actor_ref,
        }
        self.root.mkdir(parents=True, exist_ok=True)
        with self._lock(context.graph_version_id):
            if not self._is_invalidated(context.graph_version_id):
                with (self.root / "invalidations.jsonl").open("a", encoding="utf-8") as output:
                    output.write(json.dumps(event, ensure_ascii=False, sort_keys=True) + "\n")
                    output.flush()
                    os.fsync(output.fileno())
        return event

    def _load_query(self, context):
        if not isinstance(context, GraphQueryContext):
            raise GraphStoreContractError("GRAPH_QUERY_CONTEXT_INVALID", "GraphQueryContext is required")
        context.validate()
        manifest = self._read_verified(context.graph_version_id)
        context.assert_version(dataset_id=str(manifest.get("datasetId") or ""), graph_version_id=str(manifest.get("graphVersionId") or ""))
        if self._is_invalidated(context.graph_version_id):
            raise GraphStoreContractError("GRAPH_VERSION_NOT_QUERYABLE", "graph version is invalidated")
        if self.write_repository is None or not self.write_repository.is_queryable(self.store_id, context.graph_version_id):
            raise GraphStoreContractError("GRAPH_VERSION_NOT_QUERYABLE", "local projection has not succeeded")
        state = self._read_state(context.graph_version_id)
        return manifest, self._values(state, "nodes", CanonicalGraphNode), self._values(state, "edges", CanonicalGraphEdge)

    def _verified_for_write(self, context):
        manifest = self._verified_context(context)
        if self._is_invalidated(context.graph_version_id):
            raise GraphStoreContractError("GRAPH_VERSION_NOT_QUERYABLE", "graph version is invalidated")
        if manifest.get("graphSource") != "formal" or manifest.get("publishStatus") != "published" or manifest.get("publishChecks", {}).get("status") != "passed":
            raise GraphStoreContractError("GRAPH_VERSION_NOT_QUERYABLE", "only a published formal graph can be projected")
        return manifest

    def _verified_context(self, context):
        if not isinstance(context, GraphWriteContext):
            raise GraphStoreContractError("GRAPH_WRITE_CONTEXT_INVALID", "GraphWriteContext is required")
        manifest = self._read_verified(context.graph_version_id)
        if manifest.get("datasetId") != context.dataset_id or manifest.get("sourceSnapshotId") != context.source_snapshot_id:
            raise GraphStoreContractError("GRAPH_VERSION_MISMATCH", "write context does not match immutable version")
        return manifest

    def _upsert(self, context, kind, batch, expected_type, id_field):
        items = tuple(batch)
        if any(not isinstance(item, expected_type) for item in items):
            raise GraphStoreContractError(f"GRAPH_{kind[:-1].upper()}_SCHEMA_INVALID", "batch contains a non-canonical object")
        for item in items:
            if item.dataset_id != context.dataset_id or item.graph_version_id != context.graph_version_id:
                raise GraphStoreContractError("GRAPH_VERSION_MISMATCH", "batch object does not match context")
            if getattr(item, "source_snapshot_id", context.source_snapshot_id) != context.source_snapshot_id:
                raise GraphStoreContractError("GRAPH_VERSION_MISMATCH", "batch source snapshot does not match context")
        with self._lock(context.graph_version_id):
            state = self._read_state(context.graph_version_id)
            bucket = state.setdefault(kind, {})
            results = []
            for item in items:
                object_id = getattr(item, id_field)
                value = asdict(item)
                digest = self._digest(value)
                existing = bucket.get(object_id)
                if existing is not None and existing.get("digest") != digest:
                    results.append(WriteItemResult(object_id, "conflict", "GRAPH_WRITE_CONFLICT"))
                else:
                    bucket[object_id] = {"digest": digest, "value": value}
                    results.append(WriteItemResult(object_id, "succeeded"))
            self._write_state(context.graph_version_id, state)
        accepted = sum(item.status == "succeeded" for item in results)
        return WriteBatchResult(f"{context.write_run_id}:{kind}", accepted, len(results) - accepted, tuple(results))

    def _read_verified(self, graph_version_id):
        try:
            return self.repository.read_verified(graph_version_id)
        except GraphVersionNotFoundError as exc:
            raise GraphStoreContractError("GRAPH_VERSION_NOT_FOUND", "immutable graph version does not exist") from exc
        except GraphVersionIntegrityError as exc:
            raise GraphStoreContractError("GRAPH_VERSION_CORRUPTED", "immutable graph version failed verification") from exc

    def _read_state(self, graph_version_id):
        path = self.root / "projections" / f"{graph_version_id}.json"
        if not path.is_file():
            return {"metadata": {}, "nodes": {}, "edges": {}}
        try:
            value = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise GraphStoreContractError("GRAPH_VERSION_CORRUPTED", "local projection is unreadable") from exc
        if not isinstance(value, dict) or any(not isinstance(value.get(key), dict) for key in ("metadata", "nodes", "edges")):
            raise GraphStoreContractError("GRAPH_VERSION_CORRUPTED", "local projection shape is invalid")
        return value

    def _write_state(self, graph_version_id, state):
        directory = self.root / "projections"
        directory.mkdir(parents=True, exist_ok=True)
        payload = (json.dumps(state, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str) + "\n").encode()
        descriptor, temporary = tempfile.mkstemp(prefix=f".{graph_version_id}-", dir=directory)
        try:
            with os.fdopen(descriptor, "wb") as output:
                output.write(payload)
                output.flush()
                os.fsync(output.fileno())
            os.replace(temporary, directory / f"{graph_version_id}.json")
        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)

    def _checked_values(self, state, kind, expected_type, issues):
        values = []
        valid = True
        for object_id, stored in state.get(kind, {}).items():
            try:
                value = stored["value"]
                if stored.get("digest") != self._digest(value):
                    raise ValueError("digest mismatch")
                values.append(expected_type(**value))
            except (KeyError, TypeError, ValueError):
                valid = False
                issues.append({"objectId": str(object_id), "code": "GRAPH_VERSION_CORRUPTED"})
        return values, valid

    def _values(self, state, kind, expected_type):
        issues = []
        values, valid = self._checked_values(state, kind, expected_type, issues)
        if not valid:
            raise GraphStoreContractError("GRAPH_VERSION_CORRUPTED", "projection object failed verification")
        return values

    def _is_invalidated(self, graph_version_id):
        path = self.root / "invalidations.jsonl"
        if not path.is_file():
            return False
        try:
            return any(json.loads(line).get("graphVersionId") == graph_version_id for line in path.read_text(encoding="utf-8").splitlines())
        except (OSError, json.JSONDecodeError) as exc:
            raise GraphStoreContractError("GRAPH_VERSION_CORRUPTED", "invalidation log is unreadable") from exc

    @staticmethod
    def _permitted(context, scopes):
        return context.acl_context.permits(scopes)

    def _require_acl(self, context, scopes):
        if not self._permitted(context, scopes):
            raise GraphStoreContractError("GRAPH_ACCESS_DENIED", "graph object is not accessible")

    @staticmethod
    def _node_response(node):
        return {"id": node.node_id, "type": node.node_type, "name": node.canonical_name, "graphVersionId": node.graph_version_id, "datasetId": node.dataset_id, "aclScope": list(node.acl_scope), "evidenceRefs": list(node.evidence_refs), "properties": dict(node.properties)}

    @staticmethod
    def _edge_response(edge):
        return {"id": edge.edge_id, "type": edge.edge_type, "source": edge.from_node_id, "target": edge.to_node_id, "graphVersionId": edge.graph_version_id, "datasetId": edge.dataset_id, "aclScope": list(edge.acl_scope), "evidenceRefs": list(edge.evidence_refs), "confidence": edge.confidence, "properties": dict(edge.properties)}

    @staticmethod
    def _object_id(value):
        return value.node_id if isinstance(value, CanonicalGraphNode) else value.edge_id

    @staticmethod
    def _projection(context, focus, nodes, edges, truncated):
        return {"context": {"datasetId": context.dataset_id, "graphVersionId": context.graph_version_id, "depth": context.depth}, "focusNode": focus, "nodes": nodes, "edges": edges, "truncated": truncated}

    @contextmanager
    def _lock(self, graph_version_id: str) -> Iterator[None]:
        lock_root = self.root / ".locks"
        lock_root.mkdir(parents=True, exist_ok=True)
        with (lock_root / f"{graph_version_id}.lock").open("a+b") as handle:
            fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
            try:
                yield
            finally:
                fcntl.flock(handle.fileno(), fcntl.LOCK_UN)

    @staticmethod
    def _digest(value):
        payload = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str).encode()
        return f"sha256:{hashlib.sha256(payload).hexdigest()}"
