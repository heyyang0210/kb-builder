"""GraphStore port red tests.

These tests intentionally target the storage-neutral contract before its first
implementation.  A collection/import failure is therefore expected until
``app.graph_store_contract`` is delivered; it must be a missing capability,
not a missing fixture or external service.
"""

from dataclasses import replace

import pytest

from app.graph_store_contract import (
    ACLContext,
    GraphQueryContext,
    GraphStoreContractError,
    canonical_edge,
    canonical_node,
    validate_graph_batch,
)


def _acl(**overrides):
    values = {
        "principal_id": "tester",
        "tenant_id": "tenant-a",
        "security_domains": ("engineering",),
        "allow_scopes": ("dataset:ds-a",),
        "deny_scopes": (),
        "authn_source": "test-jwt",
        "decision_correlation_id": "decision-1",
    }
    values.update(overrides)
    return ACLContext(**values)


def _context(**overrides):
    values = {
        "dataset_id": "ds-a",
        "graph_version_id": "gv-1",
        "acl_context": _acl(),
        "purpose": "test",
        "max_nodes": 80,
        "max_edges": 160,
        "timeout_ms": 1000,
    }
    values.update(overrides)
    return GraphQueryContext(**values)


def _node(**overrides):
    values = {
        "node_id": "node-1",
        "node_type": "KnowledgePoint",
        "canonical_name": "节点",
        "schema_version": "graph-v1",
        "graph_version_id": "gv-1",
        "dataset_id": "ds-a",
        "source_snapshot_id": "snapshot-1",
        "admission_status": "admitted",
        "lifecycle_status": "active",
        "acl_scope": ("dataset:ds-a",),
        "evidence_refs": ("evidence-1",),
    }
    values.update(overrides)
    return canonical_node(**values)


def _edge(**overrides):
    values = {
        "edge_id": "edge-1",
        "edge_type": "RELATES_TO",
        "from_node_id": "node-1",
        "to_node_id": "node-2",
        "direction": "directed",
        "graph_version_id": "gv-1",
        "dataset_id": "ds-a",
        "schema_version": "graph-v1",
        "evidence_refs": ("evidence-1",),
        "confidence": 1.0,
        "acl_scope": ("dataset:ds-a",),
    }
    values.update(overrides)
    return canonical_edge(**values)


def test_canonical_schema_and_stable_error_codes():
    node = _node()
    assert node.graph_version_id == "gv-1"
    assert node.dataset_id == "ds-a"
    with pytest.raises(GraphStoreContractError, match="GRAPH_NODE_SCHEMA_INVALID"):
        canonical_node(**{**node.__dict__, "source_snapshot_id": ""})


def test_batch_rejects_duplicate_nodes_dangling_edges_and_acl_conflict():
    with pytest.raises(GraphStoreContractError, match="GRAPH_DUPLICATE_NODE"):
        validate_graph_batch([_node(), _node()], [])
    with pytest.raises(GraphStoreContractError, match="GRAPH_DUPLICATE_EDGE"):
        validate_graph_batch(
            [_node(), _node(node_id="node-2")],
            [_edge(), _edge()],
        )
    with pytest.raises(GraphStoreContractError, match="GRAPH_DANGLING_EDGE"):
        validate_graph_batch([_node()], [_edge()])
    with pytest.raises(GraphStoreContractError, match="GRAPH_ACL_CONFLICT"):
        validate_graph_batch(
            [_node(), _node(node_id="node-2")],
            [_edge(acl_scope=("dataset:other",))],
        )


def test_edge_requires_evidence_and_same_version_dataset():
    with pytest.raises(GraphStoreContractError, match="GRAPH_EDGE_EVIDENCE_REQUIRED"):
        validate_graph_batch([_node(), _node(node_id="node-2")], [_edge(evidence_refs=())])
    with pytest.raises(GraphStoreContractError, match="GRAPH_CROSS_VERSION_EDGE"):
        validate_graph_batch(
            [_node(), _node(node_id="node-2")],
            [_edge(graph_version_id="gv-2")],
        )


def test_query_context_is_fail_closed_and_depth_is_bounded():
    with pytest.raises(GraphStoreContractError, match="GRAPH_QUERY_CONTEXT_INVALID"):
        replace(_context(), acl_context=None).validate()
    with pytest.raises(GraphStoreContractError, match="GRAPH_QUERY_DEPTH_EXCEEDED"):
        _context(max_nodes=80, max_edges=160, timeout_ms=1000, depth=3).validate()


def test_keyword_unpublished_and_invalidated_versions_are_not_queryable():
    for state in ("keyword", "unpublished", "invalidated"):
        with pytest.raises(GraphStoreContractError, match="GRAPH_VERSION_NOT_QUERYABLE"):
            _context().require_queryable(graph_source=state, projection_status="succeeded")


def test_dataset_mismatch_is_not_silently_rewritten():
    with pytest.raises(GraphStoreContractError, match="GRAPH_QUERY_CONTEXT_INVALID"):
        _context(dataset_id="other-dataset").assert_version(dataset_id="ds-a")
