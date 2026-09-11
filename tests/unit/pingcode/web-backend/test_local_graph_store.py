"""LocalGraphStore red contract tests over isolated immutable snapshots."""

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory

import pytest

from app.graph_projection_service import GraphProjectionWorker
from app.graph_store_contract import (
    ACLContext,
    GraphQueryContext,
    GraphWriteContext,
    canonical_edge,
    canonical_node,
)
from app.repositories.graph_version_repository import GraphVersionRepository
from app.repositories.graph_write_repository import GraphWriteRepository
from app.repositories.local_graph_store import LocalGraphStore


def _snapshot(root: Path, *, graph_source="formal", publish_status="published", idempotency_key="snapshot-1"):
    repo = GraphVersionRepository(root)
    version_id = repo.version_id(idempotency_key)
    nodes = [
        {"id": "node-1", "type": "KnowledgePoint", "name": "节点 1", "schemaVersion": "graph-v1", "graphVersionId": version_id, "datasetId": "ds-a", "sourceSnapshotId": "snapshot-a", "admissionStatus": "admitted", "lifecycleStatus": "active", "aclScope": ["dataset:ds-a"], "evidenceRefs": ["evidence-1"]},
        {"id": "node-2", "type": "ProcessingUnit", "name": "节点 2", "schemaVersion": "graph-v1", "graphVersionId": version_id, "datasetId": "ds-a", "sourceSnapshotId": "snapshot-a", "admissionStatus": "admitted", "lifecycleStatus": "active", "aclScope": ["dataset:ds-a"], "evidenceRefs": ["evidence-1"]},
    ]
    edges = [{"id": "edge-1", "source": "node-1", "target": "node-2", "type": "RELATES_TO", "direction": "directed", "schemaVersion": "graph-v1", "graphVersionId": version_id, "datasetId": "ds-a", "aclScope": ["dataset:ds-a"], "evidenceRefs": ["evidence-1"], "confidence": 1.0}]
    manifest, _ = repo.create(
        idempotency_key=idempotency_key,
        metadata={
            "datasetId": "ds-a",
            "sourceSnapshotId": "snapshot-a",
            "graphSource": graph_source,
            "publishStatus": publish_status,
            "schemaVersion": "graph-v1",
        },
        nodes=nodes,
        edges=edges,
        summary={},
        checks={"status": "passed", "qualityGate": "passed"},
        health={},
        rules_snapshot={"rulesVersion": "rules-v1"},
    )
    return repo, manifest["graphVersionId"]


def _projected_store(repo, version_id):
    root = repo.root.parent
    manifest = repo.read_verified(version_id)
    manifest_path = repo.root / version_id / "manifest.json"
    writes = GraphWriteRepository(root)
    writes.admit_projection(
        store_id="local",
        dataset_id="ds-a",
        graph_version_id=version_id,
        source_snapshot_id="snapshot-a",
        source_fingerprint=manifest["sourceFingerprint"],
        payload_ref=str(manifest_path.relative_to(root)),
        payload_hash="sha256:" + hashlib.sha256(manifest_path.read_bytes()).hexdigest(),
    )
    worker = GraphProjectionWorker(
        write_repository=writes,
        version_repository=repo,
        graph_store=LocalGraphStore(repo),
        clock=lambda: datetime.now(timezone.utc),
        batch_size=1,
        lease_ttl_seconds=5,
        max_attempts=2,
        retry_base_seconds=1,
    )
    result = worker.project_next("local-test-worker")
    assert result["status"] == "succeeded"
    return LocalGraphStore(repo, write_repository=writes)


def _acl():
    return ACLContext(
        principal_id="tester",
        tenant_id="tenant-a",
        security_domains=("engineering",),
        allow_scopes=("dataset:ds-a",),
        deny_scopes=(),
        authn_source="test-jwt",
        decision_correlation_id="decision-1",
    )


def _query_context(version_id, *, depth=1):
    return GraphQueryContext(
        dataset_id="ds-a",
        graph_version_id=version_id,
        acl_context=_acl(),
        purpose="test",
        max_nodes=80,
        max_edges=160,
        timeout_ms=1000,
        depth=depth,
    )


def _write_context(version_id):
    return GraphWriteContext(
        write_run_id="write-run-1",
        store_id="local",
        dataset_id="ds-a",
        graph_version_id=version_id,
        source_snapshot_id="snapshot-a",
    )


def _canonical_nodes(version_id):
    return [
        canonical_node(
            node_id="node-1", node_type="KnowledgePoint", canonical_name="节点 1",
            schema_version="graph-v1", graph_version_id=version_id, dataset_id="ds-a",
            source_snapshot_id="snapshot-a", admission_status="admitted", lifecycle_status="active",
            acl_scope=("dataset:ds-a",), evidence_refs=("evidence-1",),
        ),
        canonical_node(
            node_id="node-2", node_type="ProcessingUnit", canonical_name="节点 2",
            schema_version="graph-v1", graph_version_id=version_id, dataset_id="ds-a",
            source_snapshot_id="snapshot-a", admission_status="admitted", lifecycle_status="active",
            acl_scope=("dataset:ds-a",), evidence_refs=("evidence-1",),
        ),
    ]


def _canonical_edges(version_id):
    return [canonical_edge(
        edge_id="edge-1", edge_type="RELATES_TO", from_node_id="node-1", to_node_id="node-2",
        direction="directed", graph_version_id=version_id, dataset_id="ds-a", schema_version="graph-v1",
        evidence_refs=("evidence-1",), confidence=1.0, acl_scope=("dataset:ds-a",),
    )]


def test_local_store_reads_only_verified_version_and_never_latest_pointer():
    with TemporaryDirectory() as tmp:
        root = Path(tmp)
        repo, version_id = _snapshot(root)
        (root / "datasets").mkdir()
        (root / "datasets" / "ds-a").mkdir()
        (root / "datasets" / "ds-a" / "latest.json").write_text(
            json.dumps({"graphVersionId": "attacker-version"}), encoding="utf-8"
        )
        store = _projected_store(repo, version_id)
        result = store.get_entity(_query_context(version_id), "node-1")
        assert result["id"] == "node-1"


def test_retry_is_idempotent_and_versions_are_isolated():
    with TemporaryDirectory() as tmp:
        root = Path(tmp)
        repo, version_id = _snapshot(root)
        store = LocalGraphStore(repo)
        batch = _canonical_nodes(version_id)
        first = store.upsert_nodes(_write_context(version_id), batch)
        second = store.upsert_nodes(_write_context(version_id), batch)
        assert first.accepted == second.accepted == 2
        edge_first = store.upsert_edges(_write_context(version_id), _canonical_edges(version_id))
        edge_second = store.upsert_edges(_write_context(version_id), _canonical_edges(version_id))
        assert edge_first.accepted == edge_second.accepted == 1
        with pytest.raises(Exception, match="GRAPH_VERSION"):
            store.upsert_nodes(_write_context("graph_version_other"), batch)

        _, other_version_id = _snapshot(root, idempotency_key="snapshot-2")
        other = store.upsert_nodes(_write_context(other_version_id), _canonical_nodes(other_version_id))
        assert other.accepted == 2
        assert (store.root / "projections" / f"{version_id}.json").is_file()
        assert (store.root / "projections" / f"{other_version_id}.json").is_file()


@pytest.mark.parametrize(
    ("graph_source", "publish_status"),
    (("keyword", "published"), ("formal", "candidate")),
)
def test_query_depth_and_non_queryable_state_fail_closed(graph_source, publish_status):
    with TemporaryDirectory() as tmp:
        root = Path(tmp)
        repo, version_id = _snapshot(root, graph_source=graph_source, publish_status=publish_status)
        store = LocalGraphStore(repo, write_repository=GraphWriteRepository(root))
        with pytest.raises(Exception, match="GRAPH_VERSION_NOT_QUERYABLE"):
            store.query_neighborhood(_query_context(version_id), {"focusNodeId": "node-1"})
        with pytest.raises(Exception, match="GRAPH_QUERY_DEPTH_EXCEEDED"):
            store.query_neighborhood(_query_context(version_id, depth=3), {"focusNodeId": "node-1"})


def test_invalidating_keeps_immutable_fact_and_blocks_reads():
    with TemporaryDirectory() as tmp:
        root = Path(tmp)
        repo, version_id = _snapshot(root)
        store = _projected_store(repo, version_id)
        event = store.invalidate(
            _write_context(version_id),
            reason="治理撤销",
            actor_ref="test-engineer",
        )
        assert event["reason"] == "治理撤销"
        assert event["actorRef"] == "test-engineer"
        audit = [json.loads(line) for line in (store.root / "invalidations.jsonl").read_text(encoding="utf-8").splitlines()]
        assert audit[-1]["reason"] == "治理撤销"
        assert audit[-1]["actorRef"] == "test-engineer"
        assert repo.read_verified(version_id)["graphVersionId"] == version_id
        with pytest.raises(Exception, match="GRAPH_VERSION_NOT_QUERYABLE"):
            store.get_entity(_query_context(version_id), "node-1")


def test_manifest_hash_drift_is_corruption_and_not_repaired_from_latest():
    with TemporaryDirectory() as tmp:
        root = Path(tmp)
        repo, version_id = _snapshot(root)
        nodes_path = root / "graph-versions" / version_id / "nodes.json"
        nodes_path.chmod(0o644)
        nodes_path.write_text("[]\n", encoding="utf-8")
        store = LocalGraphStore(repo)
        with pytest.raises(Exception, match="GRAPH_VERSION_CORRUPTED"):
            store.get_entity(_query_context(version_id), "node-1")
