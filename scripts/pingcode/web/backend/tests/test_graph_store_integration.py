"""Cross-layer red tests for the GraphStore production invariants."""

from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone

import pytest

from app.graph_projection_service import GraphProjectionWorker
from app.graph_store_contract import (
    ACLContext,
    GraphQueryContext,
    GraphStoreContractError,
    GraphWriteContext,
    canonical_edge,
    canonical_node,
)
from app.repositories.graph_version_repository import GraphVersionRepository
from app.repositories.graph_write_repository import GraphWriteRepository
from app.repositories.local_graph_store import LocalGraphStore


class _Clock:
    def __init__(self):
        self.current = datetime(2026, 8, 19, 8, 0, tzinfo=timezone.utc)

    def now(self):
        return self.current

    def advance(self, seconds):
        self.current += timedelta(seconds=seconds)


def _snapshot(root, *, edge_acl=("dataset:dataset-a",)):
    facts = GraphVersionRepository(root)
    version_id = facts.version_id("graph-store-integration")
    nodes = [
        {
            "id": f"node-{index}",
            "type": "KnowledgePoint",
            "name": f"节点 {index}",
            "schemaVersion": "graph-v1",
            "graphVersionId": version_id,
            "datasetId": "dataset-a",
            "sourceSnapshotId": "snapshot-a",
            "admissionStatus": "admitted",
            "lifecycleStatus": "active",
            "aclScope": ["dataset:dataset-a"],
            "evidenceRefs": [f"evidence-{index}"],
        }
        for index in range(2)
    ]
    edges = [{
        "id": "edge-1",
        "type": "RELATES_TO",
        "source": "node-0",
        "target": "node-1",
        "direction": "directed",
        "schemaVersion": "graph-v1",
        "graphVersionId": version_id,
        "datasetId": "dataset-a",
        "aclScope": list(edge_acl),
        "evidenceRefs": ["evidence-0"],
        "confidence": 1.0,
    }]
    manifest, _ = facts.create(
        idempotency_key="graph-store-integration",
        metadata={
            "datasetId": "dataset-a",
            "sourceSnapshotId": "snapshot-a",
            "graphSource": "formal",
            "publishStatus": "published",
            "schemaVersion": "graph-v1",
        },
        nodes=nodes,
        edges=edges,
        summary={},
        checks={"status": "passed", "qualityGate": "passed"},
        health={},
        rules_snapshot={"rulesVersion": "rules-v1"},
    )
    manifest_path = facts.root / version_id / "manifest.json"
    projection = {
        "store_id": "local",
        "dataset_id": "dataset-a",
        "graph_version_id": version_id,
        "source_snapshot_id": "snapshot-a",
        "source_fingerprint": manifest["sourceFingerprint"],
        "payload_ref": str(manifest_path.relative_to(root)),
        "payload_hash": "sha256:" + hashlib.sha256(manifest_path.read_bytes()).hexdigest(),
    }
    return facts, manifest, projection


def _write_context(version_id):
    return GraphWriteContext(
        write_run_id="write-run-a",
        store_id="local",
        dataset_id="dataset-a",
        graph_version_id=version_id,
        source_snapshot_id="snapshot-a",
    )


def _query_context(version_id):
    return GraphQueryContext(
        dataset_id="dataset-a",
        graph_version_id=version_id,
        acl_context=ACLContext(
            principal_id="tester",
            tenant_id="tenant-a",
            security_domains=("engineering",),
            allow_scopes=("dataset:dataset-a",),
            deny_scopes=(),
            authn_source="test-jwt",
            decision_correlation_id="decision-a",
        ),
        purpose="integration-test",
        max_nodes=80,
        max_edges=160,
        timeout_ms=1000,
    )


def _canonical_nodes(version_id):
    return [canonical_node(
        node_id=f"node-{index}",
        node_type="KnowledgePoint",
        canonical_name=f"节点 {index}",
        schema_version="graph-v1",
        graph_version_id=version_id,
        dataset_id="dataset-a",
        source_snapshot_id="snapshot-a",
        admission_status="admitted",
        lifecycle_status="active",
        acl_scope=("dataset:dataset-a",),
        evidence_refs=(f"evidence-{index}",),
    ) for index in range(2)]


def test_real_worker_and_local_store_complete_one_projection(tmp_path):
    facts, _, projection = _snapshot(tmp_path)
    clock = _Clock()
    writes = GraphWriteRepository(tmp_path, clock=clock.now)
    admission = writes.admit_projection(**projection)
    worker = GraphProjectionWorker(
        write_repository=writes,
        version_repository=facts,
        graph_store=LocalGraphStore(facts),
        clock=clock.now,
        batch_size=1,
        lease_ttl_seconds=5,
        max_attempts=2,
        retry_base_seconds=1,
    )

    result = worker.project_next("worker-a")

    assert result["status"] == "succeeded"
    assert writes.is_queryable("local", projection["graph_version_id"]) is True
    assert writes.list_issues(admission["writeRunId"]) == []


def test_transition_cannot_create_or_advance_an_ownerless_lease(tmp_path):
    _, _, projection = _snapshot(tmp_path)
    writes = GraphWriteRepository(tmp_path, clock=_Clock().now)
    run = writes.admit_projection(**projection)

    with pytest.raises(GraphStoreContractError, match="GRAPH_WRITE_CONFLICT"):
        writes.transition(
            run["writeRunId"], "leased", expected_revision=run["revision"],
            lease_owner=None,
        )


def test_expired_lease_cannot_advance_state(tmp_path):
    _, _, projection = _snapshot(tmp_path)
    clock = _Clock()
    writes = GraphWriteRepository(tmp_path, clock=clock.now)
    writes.admit_projection(**projection)
    run = writes.lease_next("worker-a", lease_ttl_seconds=5)
    clock.advance(6)

    with pytest.raises(GraphStoreContractError, match="GRAPH_WRITE_CONFLICT"):
        writes.transition(
            run["writeRunId"], "writing", expected_revision=run["revision"],
            lease_owner="worker-a",
        )


def test_published_fact_is_not_queryable_before_projection_succeeds(tmp_path):
    facts, _, projection = _snapshot(tmp_path)
    store = LocalGraphStore(facts)

    with pytest.raises(GraphStoreContractError, match="GRAPH_VERSION_NOT_QUERYABLE"):
        store.get_entity(_query_context(projection["graph_version_id"]), "node-0")


def test_local_validation_reports_actual_projection_not_fact_counts(tmp_path):
    facts, _, projection = _snapshot(tmp_path)
    store = LocalGraphStore(facts)

    report = store.validate(_write_context(projection["graph_version_id"]))

    assert report["status"] == "failed"
    assert report["actualNodeCount"] == 0
    assert report["actualEdgeCount"] == 0
    assert report["fingerprintMatched"] is False
    assert report["evidenceSamplePassed"] is False
    assert report["aclSamplePassed"] is False


def test_legacy_missing_semantics_are_rejected_not_inferred(tmp_path):
    facts, manifest, _ = _snapshot(tmp_path)
    worker = GraphProjectionWorker(
        write_repository=object(), version_repository=facts, graph_store=object(),
        clock=_Clock().now, batch_size=1, lease_ttl_seconds=5,
        max_attempts=2, retry_base_seconds=1,
    )
    legacy = {
        "id": "legacy-node",
        "type": "KnowledgePoint",
        "aclScope": ["dataset:dataset-a"],
        "evidenceRefs": ["evidence-legacy"],
    }

    with pytest.raises(GraphStoreContractError, match="GRAPH_NODE_SCHEMA_INVALID"):
        worker._canonical_node(legacy, manifest)


def test_edge_acl_wider_than_endpoints_is_rejected(tmp_path):
    facts, _, projection = _snapshot(tmp_path)
    store = LocalGraphStore(facts)
    version_id = projection["graph_version_id"]
    context = _write_context(version_id)
    store.upsert_nodes(context, _canonical_nodes(version_id))
    edge = canonical_edge(
        edge_id="edge-1", edge_type="RELATES_TO",
        from_node_id="node-0", to_node_id="node-1", direction="directed",
        graph_version_id=version_id, dataset_id="dataset-a",
        schema_version="graph-v1", evidence_refs=("evidence-0",),
        confidence=1.0, acl_scope=("dataset:other",),
    )

    with pytest.raises(GraphStoreContractError, match="GRAPH_ACL_CONFLICT"):
        store.upsert_edges(context, [edge])


def test_transition_updates_cannot_modify_immutable_identity(tmp_path):
    _, _, projection = _snapshot(tmp_path)
    writes = GraphWriteRepository(tmp_path, clock=_Clock().now)
    writes.admit_projection(**projection)
    run = writes.lease_next("worker-a", lease_ttl_seconds=5)

    with pytest.raises(GraphStoreContractError, match="GRAPH_WRITE_CONFLICT"):
        writes.transition(
            run["writeRunId"], "writing", expected_revision=run["revision"],
            lease_owner="worker-a", updates={"datasetId": "dataset-attacker"},
        )


def test_invalidation_requires_and_persists_reason_and_actor(tmp_path):
    facts, _, projection = _snapshot(tmp_path)
    store = LocalGraphStore(facts)
    context = _write_context(projection["graph_version_id"])

    event = store.invalidate(context, reason="governance revoke", actor_ref="tester")

    assert event["reason"] == "governance revoke"
    assert event["actorRef"] == "tester"
    assert facts.read_verified(projection["graph_version_id"])["graphVersionId"] == projection["graph_version_id"]
