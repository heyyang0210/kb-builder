"""Storage-neutral contracts for immutable graph projections.

This module contains domain values and a port only.  It deliberately has no
database driver, query language, mutable pointer, or filesystem dependency.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Mapping, Protocol, Sequence, runtime_checkable


class GraphStoreContractError(ValueError):
    """Stable, structured failure at the GraphStore trust boundary."""

    def __init__(self, code: str, message: str, **context: Any):
        super().__init__(f"{code}: {message}")
        self.code = code
        self.context = dict(context)

    def to_dict(self) -> dict[str, Any]:
        return {"code": self.code, "message": str(self), **self.context}


def _required(value: Any, field_name: str, code: str) -> str:
    if not isinstance(value, str) or not value:
        raise GraphStoreContractError(code, f"{field_name} must be a non-empty string")
    return value


def _string_tuple(value: Any, field_name: str, code: str, *, required: bool) -> tuple[str, ...]:
    if isinstance(value, (str, bytes)) or not isinstance(value, Sequence):
        raise GraphStoreContractError(code, f"{field_name} must be a string collection")
    if any(not isinstance(item, str) or not item for item in value):
        raise GraphStoreContractError(code, f"{field_name} contains an invalid value")
    normalized = tuple(sorted(set(value)))
    if required and not normalized:
        raise GraphStoreContractError(code, f"{field_name} must not be empty")
    return normalized


def _utc(value: datetime | None, field_name: str, code: str) -> datetime | None:
    if value is None:
        return None
    if not isinstance(value, datetime) or value.tzinfo is None or value.utcoffset() is None:
        raise GraphStoreContractError(code, f"{field_name} must be timezone-aware UTC")
    if value.utcoffset() != timezone.utc.utcoffset(value):
        raise GraphStoreContractError(code, f"{field_name} must use UTC")
    return value


@dataclass(frozen=True)
class ACLContext:
    principal_id: str
    tenant_id: str
    security_domains: tuple[str, ...]
    allow_scopes: tuple[str, ...]
    deny_scopes: tuple[str, ...]
    authn_source: str
    decision_correlation_id: str

    def __post_init__(self) -> None:
        code = "GRAPH_QUERY_CONTEXT_INVALID"
        for name in ("principal_id", "tenant_id", "authn_source", "decision_correlation_id"):
            _required(getattr(self, name), name, code)
        object.__setattr__(self, "security_domains", _string_tuple(self.security_domains, "security_domains", code, required=True))
        object.__setattr__(self, "allow_scopes", _string_tuple(self.allow_scopes, "allow_scopes", code, required=True))
        object.__setattr__(self, "deny_scopes", _string_tuple(self.deny_scopes, "deny_scopes", code, required=False))

    def permits(self, acl_scope: Sequence[str]) -> bool:
        scope = set(_string_tuple(acl_scope, "acl_scope", "GRAPH_ACCESS_DENIED", required=True))
        if scope.intersection(self.deny_scopes):
            return False
        return bool(scope.intersection(self.allow_scopes))


@dataclass(frozen=True)
class GraphQueryContext:
    dataset_id: str
    graph_version_id: str
    acl_context: ACLContext
    purpose: str
    max_nodes: int
    max_edges: int
    timeout_ms: int
    valid_at: datetime | None = None
    depth: int = 1

    def validate(self) -> GraphQueryContext:
        code = "GRAPH_QUERY_CONTEXT_INVALID"
        for name in ("dataset_id", "graph_version_id", "purpose"):
            _required(getattr(self, name), name, code)
        if not isinstance(self.acl_context, ACLContext):
            raise GraphStoreContractError(code, "trusted ACL context is required")
        if type(self.depth) is not int or self.depth < 1:
            raise GraphStoreContractError(code, "depth must be a positive integer")
        if self.depth > 2:
            raise GraphStoreContractError("GRAPH_QUERY_DEPTH_EXCEEDED", "query depth exceeds the contract maximum")
        for name in ("max_nodes", "max_edges", "timeout_ms"):
            value = getattr(self, name)
            if type(value) is not int or value <= 0:
                raise GraphStoreContractError(code, f"{name} must be a positive integer")
        _utc(self.valid_at, "valid_at", code)
        return self

    def assert_version(self, *, dataset_id: str, graph_version_id: str | None = None) -> GraphQueryContext:
        self.validate()
        if dataset_id != self.dataset_id or (
            graph_version_id is not None and graph_version_id != self.graph_version_id
        ):
            raise GraphStoreContractError(
                "GRAPH_QUERY_CONTEXT_INVALID", "query context does not match the immutable graph version"
            )
        return self

    def require_queryable(self, *, graph_source: str, projection_status: str) -> GraphQueryContext:
        self.validate()
        if graph_source != "formal" or projection_status != "succeeded":
            raise GraphStoreContractError(
                "GRAPH_VERSION_NOT_QUERYABLE", "graph version is not a published, successful formal projection"
            )
        return self


@dataclass(frozen=True)
class CanonicalGraphNode:
    node_id: str
    node_type: str
    canonical_name: str
    schema_version: str
    graph_version_id: str
    dataset_id: str
    source_snapshot_id: str
    admission_status: str
    lifecycle_status: str
    acl_scope: tuple[str, ...]
    evidence_refs: tuple[str, ...]
    valid_from: datetime | None = None
    valid_to: datetime | None = None
    created_at: datetime | None = None
    properties: Mapping[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class CanonicalGraphEdge:
    edge_id: str
    edge_type: str
    from_node_id: str
    to_node_id: str
    direction: str
    graph_version_id: str
    dataset_id: str
    schema_version: str
    evidence_refs: tuple[str, ...]
    confidence: float
    acl_scope: tuple[str, ...]
    valid_from: datetime | None = None
    valid_to: datetime | None = None
    properties: Mapping[str, Any] = field(default_factory=dict)


def _validity(valid_from: datetime | None, valid_to: datetime | None, code: str) -> None:
    start = _utc(valid_from, "valid_from", code)
    end = _utc(valid_to, "valid_to", code)
    if start is not None and end is not None and end < start:
        raise GraphStoreContractError(code, "valid_to precedes valid_from")


def canonical_node(**values: Any) -> CanonicalGraphNode:
    code = "GRAPH_NODE_SCHEMA_INVALID"
    required = (
        "node_id", "node_type", "canonical_name", "schema_version",
        "graph_version_id", "dataset_id", "source_snapshot_id",
    )
    for name in required:
        _required(values.get(name), name, code)
    if values.get("admission_status") != "admitted":
        raise GraphStoreContractError(code, "formal node must be admitted")
    if values.get("lifecycle_status") not in {"active", "invalidated"}:
        raise GraphStoreContractError(code, "unknown node lifecycle status")
    acl_scope = _string_tuple(values.get("acl_scope"), "acl_scope", code, required=True)
    evidence_refs = _string_tuple(values.get("evidence_refs"), "evidence_refs", code, required=True)
    _validity(values.get("valid_from"), values.get("valid_to"), code)
    _utc(values.get("created_at"), "created_at", code)
    properties = values.get("properties", {})
    if not isinstance(properties, Mapping):
        raise GraphStoreContractError(code, "properties must be an object")
    return CanonicalGraphNode(**{**values, "acl_scope": acl_scope, "evidence_refs": evidence_refs, "properties": dict(properties)})


def canonical_edge(**values: Any) -> CanonicalGraphEdge:
    code = "GRAPH_EDGE_SCHEMA_INVALID"
    required = (
        "edge_id", "edge_type", "from_node_id", "to_node_id",
        "graph_version_id", "dataset_id", "schema_version",
    )
    for name in required:
        _required(values.get(name), name, code)
    if values.get("direction") not in {"directed", "undirected"}:
        raise GraphStoreContractError(code, "unknown edge direction")
    confidence = values.get("confidence")
    if isinstance(confidence, bool) or not isinstance(confidence, (int, float)) or not math.isfinite(confidence) or not 0 <= confidence <= 1:
        raise GraphStoreContractError(code, "confidence must be a finite number in [0,1]")
    acl_scope = _string_tuple(values.get("acl_scope"), "acl_scope", code, required=True)
    evidence_refs = _string_tuple(values.get("evidence_refs"), "evidence_refs", code, required=False)
    _validity(values.get("valid_from"), values.get("valid_to"), code)
    properties = values.get("properties", {})
    if not isinstance(properties, Mapping):
        raise GraphStoreContractError(code, "properties must be an object")
    return CanonicalGraphEdge(**{**values, "confidence": float(confidence), "acl_scope": acl_scope, "evidence_refs": evidence_refs, "properties": dict(properties)})


def validate_graph_batch(
    nodes: Sequence[CanonicalGraphNode], edges: Sequence[CanonicalGraphEdge]
) -> tuple[tuple[CanonicalGraphNode, ...], tuple[CanonicalGraphEdge, ...]]:
    node_ids: set[str] = set()
    node_by_id: dict[str, CanonicalGraphNode] = {}
    for node in nodes:
        if not isinstance(node, CanonicalGraphNode):
            raise GraphStoreContractError("GRAPH_NODE_SCHEMA_INVALID", "batch contains a non-canonical node")
        if node.node_id in node_ids:
            raise GraphStoreContractError("GRAPH_DUPLICATE_NODE", "duplicate node ID", nodeId=node.node_id)
        node_ids.add(node.node_id)
        node_by_id[node.node_id] = node
    edge_ids: set[str] = set()
    for edge in edges:
        if not isinstance(edge, CanonicalGraphEdge):
            raise GraphStoreContractError("GRAPH_EDGE_SCHEMA_INVALID", "batch contains a non-canonical edge")
        if edge.edge_id in edge_ids:
            raise GraphStoreContractError("GRAPH_DUPLICATE_EDGE", "duplicate edge ID", edgeId=edge.edge_id)
        edge_ids.add(edge.edge_id)
        source = node_by_id.get(edge.from_node_id)
        target = node_by_id.get(edge.to_node_id)
        if source is None or target is None:
            raise GraphStoreContractError("GRAPH_DANGLING_EDGE", "edge endpoint does not exist", edgeId=edge.edge_id)
        if any(node.dataset_id != edge.dataset_id or node.graph_version_id != edge.graph_version_id for node in (source, target)):
            raise GraphStoreContractError("GRAPH_CROSS_VERSION_EDGE", "edge crosses dataset or graph version", edgeId=edge.edge_id)
        if not edge.evidence_refs:
            raise GraphStoreContractError("GRAPH_EDGE_EVIDENCE_REQUIRED", "edge evidence is required", edgeId=edge.edge_id)
        allowed_scope = set(source.acl_scope).intersection(target.acl_scope)
        if not set(edge.acl_scope).issubset(allowed_scope):
            raise GraphStoreContractError("GRAPH_ACL_CONFLICT", "edge ACL is wider than its endpoints", edgeId=edge.edge_id)
    return tuple(nodes), tuple(edges)


@dataclass(frozen=True)
class GraphWriteContext:
    write_run_id: str
    store_id: str
    dataset_id: str
    graph_version_id: str
    source_snapshot_id: str

    def __post_init__(self) -> None:
        for name in (
            "write_run_id", "store_id", "dataset_id", "graph_version_id",
            "source_snapshot_id",
        ):
            _required(getattr(self, name), name, "GRAPH_WRITE_CONTEXT_INVALID")


_WRITE_TRANSITIONS = {
    "pending": frozenset({"leased"}),
    "leased": frozenset({"writing"}),
    "writing": frozenset({"validating", "partial", "failed"}),
    "validating": frozenset({"succeeded", "partial", "failed"}),
    "partial": frozenset({"retry_wait", "dead_letter"}),
    "failed": frozenset({"retry_wait", "dead_letter"}),
    "retry_wait": frozenset({"leased"}),
    "succeeded": frozenset({"invalidated"}),
    "dead_letter": frozenset(),
    "invalidated": frozenset(),
}


@dataclass(frozen=True)
class GraphWriteRun:
    write_run_id: str
    store_id: str
    dataset_id: str
    graph_version_id: str
    source_snapshot_id: str
    source_fingerprint: str
    schema_version: str
    projection_mode: str
    status: str = "pending"
    attempt: int = 0

    def __post_init__(self) -> None:
        for name in (
            "write_run_id", "store_id", "dataset_id", "graph_version_id",
            "source_snapshot_id", "source_fingerprint", "schema_version",
            "projection_mode",
        ):
            _required(getattr(self, name), name, "GRAPH_WRITE_CONTEXT_INVALID")
        if self.status not in _WRITE_TRANSITIONS:
            raise GraphStoreContractError("GRAPH_WRITE_STATE_INVALID", "unknown write-run state")
        if type(self.attempt) is not int or self.attempt < 0:
            raise GraphStoreContractError("GRAPH_WRITE_STATE_INVALID", "attempt must be non-negative")

    def require_transition(self, next_status: str) -> None:
        if next_status not in _WRITE_TRANSITIONS.get(self.status, frozenset()):
            raise GraphStoreContractError(
                "GRAPH_WRITE_STATE_INVALID",
                "write-run state transition is not allowed",
                currentStatus=self.status,
                nextStatus=next_status,
            )


@dataclass(frozen=True)
class WriteItemResult:
    object_id: str
    status: str
    error_code: str | None = None
    retryable: bool = False

    def __post_init__(self) -> None:
        _required(self.object_id, "object_id", "GRAPH_WRITE_RESULT_INVALID")
        if self.status not in {"succeeded", "rejected", "conflict"}:
            raise GraphStoreContractError("GRAPH_WRITE_RESULT_INVALID", "unknown item status")
        if self.status != "succeeded" and not self.error_code:
            raise GraphStoreContractError("GRAPH_WRITE_RESULT_INVALID", "rejected item requires error_code")


@dataclass(frozen=True)
class WriteBatchResult:
    batch_id: str
    accepted: int
    rejected: int
    items: tuple[WriteItemResult, ...]
    retry_after_ms: int | None = None

    def __post_init__(self) -> None:
        _required(self.batch_id, "batch_id", "GRAPH_WRITE_RESULT_INVALID")
        if any(type(value) is not int or value < 0 for value in (self.accepted, self.rejected)):
            raise GraphStoreContractError("GRAPH_WRITE_RESULT_INVALID", "batch counts must be non-negative integers")
        if self.accepted + self.rejected != len(self.items):
            raise GraphStoreContractError("GRAPH_WRITE_RESULT_INVALID", "batch counts do not match item results")
        if self.retry_after_ms is not None and (
            type(self.retry_after_ms) is not int or self.retry_after_ms < 0
        ):
            raise GraphStoreContractError("GRAPH_WRITE_RESULT_INVALID", "retry_after_ms must be non-negative")


@runtime_checkable
class GraphStore(Protocol):
    """Vendor-neutral graph projection port."""

    def health(self) -> Any: ...
    def begin_write(self, run: Any) -> Any: ...
    def upsert_nodes(self, context: GraphWriteContext, batch: Sequence[CanonicalGraphNode]) -> WriteBatchResult: ...
    def upsert_edges(self, context: GraphWriteContext, batch: Sequence[CanonicalGraphEdge]) -> WriteBatchResult: ...
    def validate(self, context: GraphWriteContext) -> Any: ...
    def get_entity(self, context: GraphQueryContext, node_id: str) -> Any | None: ...
    def query_neighborhood(self, context: GraphQueryContext, request: Any) -> Any: ...
    def query_evidence(self, context: GraphQueryContext, target: Any) -> Any: ...
    def invalidate(self, context: GraphWriteContext) -> Any: ...
