"""Red integration tests for durable graph projection writes.

The suite fixes the repository/worker boundary before implementation.  A
missing capability is reported by an explicit assertion so test collection,
fixtures, and the immutable GraphVersionRepository are independently proven.
No test reads or writes the configured production data root.
"""

from __future__ import annotations

import hashlib
import importlib
import json
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace

from app.repositories.graph_version_repository import GraphVersionRepository


class _Raises:
    def __init__(self, expected):
        self.expected = expected
        self.value = None

    def __enter__(self):
        return self

    def __exit__(self, error_type, error, traceback):
        if error_type is None:
            raise AssertionError(f"expected {self.expected.__name__} to be raised")
        if not issubclass(error_type, self.expected):
            return False
        self.value = error
        return True


def _raises(expected):
    return _Raises(expected)


def _load_capabilities():
    missing = []
    try:
        repository_module = importlib.import_module(
            "app.repositories.graph_write_repository"
        )
    except ImportError as exc:
        repository_module = None
        missing.append(f"app.repositories.graph_write_repository ({exc})")
    try:
        service_module = importlib.import_module("app.graph_projection_service")
    except ImportError as exc:
        service_module = None
        missing.append(f"app.graph_projection_service ({exc})")
    repository_type = (
        getattr(repository_module, "GraphWriteRepository", None)
        if repository_module is not None
        else None
    )
    worker_type = None
    if service_module is not None:
        worker_type = getattr(service_module, "GraphProjectionWorker", None)
        if worker_type is None:
            worker_type = getattr(service_module, "GraphProjectionService", None)
    if repository_type is None and repository_module is not None:
        missing.append("GraphWriteRepository")
    if worker_type is None and service_module is not None:
        missing.append("GraphProjectionWorker/GraphProjectionService")
    return repository_type, worker_type, missing


GRAPH_WRITE_REPOSITORY, GRAPH_PROJECTION_WORKER, MISSING_CAPABILITIES = (
    _load_capabilities()
)


def _require_capabilities():
    assert not MISSING_CAPABILITIES, (
        "Graph projection write capability is not implemented: "
        + "; ".join(MISSING_CAPABILITIES)
    )


def _value(value, name, default=None):
    if isinstance(value, dict):
        return value.get(name, default)
    return getattr(value, name, default)


def _error_code(error: BaseException) -> str:
    return str(getattr(error, "code", getattr(error, "error_code", error)))


def _batch_items(batch):
    if isinstance(batch, (list, tuple)):
        return list(batch)
    return list(_value(batch, "items", []))


def _object_id(item, *names):
    for name in names:
        value = _value(item, name)
        if value:
            return str(value)
    return ""


class _Clock:
    def __init__(self):
        self.current = datetime(2026, 8, 19, 8, 0, tzinfo=timezone.utc)

    def now(self):
        return self.current

    def advance(self, seconds):
        self.current += timedelta(seconds=seconds)


class _StoreFailure(RuntimeError):
    def __init__(self, code, message, *, retryable):
        super().__init__(message)
        self.code = code
        self.retryable = retryable


class _ContractStore:
    """Storage-neutral adapter substitute with idempotent object keys."""

    store_id = "local-contract"

    def __init__(self, *, reject_edge=False, timeout_count=0, secret=""):
        self.reject_edge = reject_edge
        self.timeout_count = timeout_count
        self.secret = secret
        self.nodes = set()
        self.edges = set()
        self.node_calls = 0
        self.edge_calls = 0

    def begin_write(self, run):
        return SimpleNamespace(
            write_run_id=_value(run, "writeRunId", _value(run, "write_run_id")),
            status="writing",
        )

    def upsert_nodes(self, context, batch):
        self.node_calls += 1
        if self.timeout_count > 0:
            self.timeout_count -= 1
            raise _StoreFailure(
                "GRAPH_STORE_TIMEOUT",
                f"temporary timeout Authorization=Bearer {self.secret}",
                retryable=True,
            )
        items = _batch_items(batch)
        identifiers = [_object_id(item, "nodeId", "node_id", "id") for item in items]
        self.nodes.update(identifiers)
        return SimpleNamespace(
            batch_id=f"nodes-{self.node_calls}",
            accepted=len(items),
            rejected=0,
            items=[SimpleNamespace(object_id=value, status="succeeded") for value in identifiers],
        )

    def upsert_edges(self, context, batch):
        self.edge_calls += 1
        items = _batch_items(batch)
        identifiers = [_object_id(item, "edgeId", "edge_id", "id") for item in items]
        if self.reject_edge and identifiers:
            rejected = identifiers[0]
            self.edges.update(identifiers[1:])
            return SimpleNamespace(
                batch_id=f"edges-{self.edge_calls}",
                accepted=len(items) - 1,
                rejected=1,
                items=[
                    SimpleNamespace(
                        object_id=rejected,
                        status="rejected",
                        error_code="GRAPH_WRITE_PARTIAL",
                        retryable=False,
                        message=f"edge rejected: {self.secret}",
                    ),
                    *[
                        SimpleNamespace(object_id=value, status="succeeded")
                        for value in identifiers[1:]
                    ],
                ],
            )
        self.edges.update(identifiers)
        return SimpleNamespace(
            batch_id=f"edges-{self.edge_calls}",
            accepted=len(items),
            rejected=0,
            items=[SimpleNamespace(object_id=value, status="succeeded") for value in identifiers],
        )

    def validate(self, context):
        return SimpleNamespace(
            status="passed",
            expected_node_count=len(self.nodes),
            actual_node_count=len(self.nodes),
            expected_edge_count=len(self.edges),
            actual_edge_count=len(self.edges),
            dangling_edge_count=0,
            cross_version_count=0,
            fingerprint_matched=True,
            evidence_sample_passed=True,
            acl_sample_passed=True,
            issues=[],
        )


class _SimulatedProcessExit(BaseException):
    pass


def _snapshot(root: Path):
    repository = GraphVersionRepository(root)
    version_id = repository.version_id("graph-projection-write-contract")
    nodes = [
        {
            "id": f"node-{index}",
            "type": "KnowledgePoint",
            "canonicalName": f"节点 {index}",
            "schemaVersion": "graph-v1",
            "datasetId": "dataset-a",
            "graphVersionId": version_id,
            "sourceSnapshotId": "source-snapshot-a",
            "admissionStatus": "admitted",
            "lifecycleStatus": "active",
            "evidenceRefs": [f"evidence-{index}"],
            "aclScope": ["dataset:dataset-a"],
        }
        for index in range(3)
    ]
    edges = [
        {
            "id": "edge-1",
            "source": "node-0",
            "target": "node-1",
            "type": "RELATES_TO",
            "direction": "directed",
            "schemaVersion": "graph-v1",
            "graphVersionId": version_id,
            "datasetId": "dataset-a",
            "evidenceRefs": ["evidence-0"],
            "aclScope": ["dataset:dataset-a"],
            "confidence": 1.0,
        },
        {
            "id": "edge-2",
            "source": "node-1",
            "target": "node-2",
            "type": "RELATES_TO",
            "direction": "directed",
            "schemaVersion": "graph-v1",
            "graphVersionId": version_id,
            "datasetId": "dataset-a",
            "evidenceRefs": ["evidence-1"],
            "aclScope": ["dataset:dataset-a"],
            "confidence": 1.0,
        },
    ]
    manifest, _ = repository.create(
        idempotency_key="graph-projection-write-contract",
        metadata={
            "datasetId": "dataset-a",
            "sourceSnapshotId": "source-snapshot-a",
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
    assert manifest["graphVersionId"] == version_id
    version_root = repository.root / version_id
    manifest_path = version_root / "manifest.json"
    return repository, manifest, {
        "store_id": _ContractStore.store_id,
        "dataset_id": "dataset-a",
        "graph_version_id": version_id,
        "source_snapshot_id": "source-snapshot-a",
        "source_fingerprint": manifest["sourceFingerprint"],
        "payload_ref": str(manifest_path.relative_to(root)),
        "payload_hash": "sha256:" + hashlib.sha256(manifest_path.read_bytes()).hexdigest(),
    }


def _fact_sha(repository, version_id):
    root = repository.root / version_id
    return {
        path.name: hashlib.sha256(path.read_bytes()).hexdigest()
        for path in sorted(root.iterdir())
        if path.is_file()
    }


def _repository(root, clock):
    _require_capabilities()
    return GRAPH_WRITE_REPOSITORY(root, clock=clock.now)


def _admit(repository, projection):
    return repository.admit_projection(**projection)


def _worker(repository, facts, store, clock, **overrides):
    values = {
        "write_repository": repository,
        "version_repository": facts,
        "graph_store": store,
        "clock": clock.now,
        "batch_size": 1,
        "lease_ttl_seconds": 5,
        "max_attempts": 2,
        "retry_base_seconds": 1,
    }
    values.update(overrides)
    return GRAPH_PROJECTION_WORKER(**values)


def _run(repository, admission):
    return repository.get_run(_value(admission, "writeRunId", _value(admission, "write_run_id")))


def test_graph_write_run_state_machine_and_revision_cas(tmp_path):
    facts, _, projection = _snapshot(tmp_path)
    before = _fact_sha(facts, projection["graph_version_id"])
    clock = _Clock()
    repository = _repository(tmp_path, clock)
    admission = _admit(repository, projection)
    run = repository.lease_next("worker-a", lease_ttl_seconds=5)
    assert run is not None
    for target in ("writing", "validating", "succeeded"):
        run = repository.transition(
            _value(run, "writeRunId", _value(run, "write_run_id")),
            target,
            expected_revision=_value(run, "revision"),
            lease_owner="worker-a",
        )
    with _raises(Exception) as backward:
        repository.transition(
            _value(run, "writeRunId", _value(run, "write_run_id")),
            "writing",
            expected_revision=_value(run, "revision"),
        )
    assert "GRAPH_WRITE_STATE_INVALID" in _error_code(backward.value)
    with _raises(Exception) as stale:
        repository.transition(
            _value(run, "writeRunId", _value(run, "write_run_id")),
            "invalidated",
            expected_revision=0,
        )
    assert "GRAPH_WRITE_CONFLICT" in _error_code(stale.value)
    assert _fact_sha(facts, projection["graph_version_id"]) == before


def test_duplicate_admission_and_concurrent_lease_are_single_flight(tmp_path):
    facts, _, projection = _snapshot(tmp_path)
    before = _fact_sha(facts, projection["graph_version_id"])
    clock = _Clock()
    repository = _repository(tmp_path, clock)
    barrier = threading.Barrier(8)

    def admit(_):
        barrier.wait()
        return _admit(repository, projection)

    with ThreadPoolExecutor(max_workers=8) as pool:
        admissions = list(pool.map(admit, range(8)))
    assert len({_value(item, "writeRunId", _value(item, "write_run_id")) for item in admissions}) == 1
    assert len({_value(item, "eventId", _value(item, "event_id")) for item in admissions}) == 1

    lease_barrier = threading.Barrier(8)

    def lease(index):
        lease_barrier.wait()
        return repository.lease_next(f"worker-{index}", lease_ttl_seconds=5)

    with ThreadPoolExecutor(max_workers=8) as pool:
        leases = list(pool.map(lease, range(8)))
    assert sum(item is not None for item in leases) == 1
    assert _fact_sha(facts, projection["graph_version_id"]) == before


def test_edge_partial_failure_records_issue_and_is_not_queryable(tmp_path):
    facts, _, projection = _snapshot(tmp_path)
    before = _fact_sha(facts, projection["graph_version_id"])
    clock = _Clock()
    repository = _repository(tmp_path, clock)
    admission = _admit(repository, projection)
    secret = "SECRET-EVIDENCE-BODY"
    worker = _worker(repository, facts, _ContractStore(reject_edge=True, secret=secret), clock)

    worker.project_next("worker-a")

    run = _run(repository, admission)
    assert _value(run, "status") in {"partial", "dead_letter"}
    assert repository.is_queryable(projection["store_id"], projection["graph_version_id"]) is False
    issues = repository.list_issues(_value(run, "writeRunId", _value(run, "write_run_id")))
    assert len(issues) == 1
    assert _value(issues[0], "errorCode", _value(issues[0], "error_code")) == "GRAPH_WRITE_PARTIAL"
    assert secret not in json.dumps([_value(item, "sanitizedMessage", _value(item, "sanitized_message", "")) for item in issues])
    assert _fact_sha(facts, projection["graph_version_id"]) == before


def test_retryable_timeout_resumes_from_durable_checkpoint(tmp_path):
    facts, _, projection = _snapshot(tmp_path)
    before = _fact_sha(facts, projection["graph_version_id"])
    clock = _Clock()
    repository = _repository(tmp_path, clock)
    admission = _admit(repository, projection)
    store = _ContractStore(timeout_count=1, secret="DO-NOT-LOG")
    worker = _worker(repository, facts, store, clock)

    worker.project_next("worker-a")
    waiting = _run(repository, admission)
    assert _value(waiting, "status") == "retry_wait"
    assert _value(waiting, "nodeCursor", _value(waiting, "node_cursor", 0)) == 0
    assert repository.is_queryable(projection["store_id"], projection["graph_version_id"]) is False

    clock.advance(2)
    worker.project_next("worker-b")
    completed = _run(repository, admission)
    assert _value(completed, "status") == "succeeded"
    assert _value(completed, "nodeCursor", _value(completed, "node_cursor")) == 3
    assert _value(completed, "edgeCursor", _value(completed, "edge_cursor")) == 2
    assert store.nodes == {"node-0", "node-1", "node-2"}
    assert store.edges == {"edge-1", "edge-2"}
    assert _fact_sha(facts, projection["graph_version_id"]) == before


def test_crash_before_cursor_commit_replays_idempotently_after_lease_expiry(tmp_path):
    facts, _, projection = _snapshot(tmp_path)
    before = _fact_sha(facts, projection["graph_version_id"])
    clock = _Clock()
    repository = _repository(tmp_path, clock)
    admission = _admit(repository, projection)
    store = _ContractStore()
    crashed = False

    def fault(stage, context=None):
        nonlocal crashed
        if stage == "before_cursor_commit" and not crashed:
            crashed = True
            raise _SimulatedProcessExit()

    worker = _worker(repository, facts, store, clock, fault_injector=fault)
    with _raises(_SimulatedProcessExit):
        worker.project_next("worker-a")
    interrupted = _run(repository, admission)
    assert _value(interrupted, "nodeCursor", _value(interrupted, "node_cursor", 0)) == 0
    assert len(store.nodes) == 1
    assert repository.is_queryable(projection["store_id"], projection["graph_version_id"]) is False

    clock.advance(6)
    restarted_repository = _repository(tmp_path, clock)
    restarted = _worker(restarted_repository, facts, store, clock)
    restarted.project_next("worker-b")
    completed = _run(restarted_repository, admission)
    assert _value(completed, "status") == "succeeded"
    assert len(store.nodes) == 3
    assert len(store.edges) == 2
    assert _fact_sha(facts, projection["graph_version_id"]) == before


def test_retry_exhaustion_dead_letters_and_sanitizes_retryable_issue(tmp_path):
    facts, _, projection = _snapshot(tmp_path)
    before = _fact_sha(facts, projection["graph_version_id"])
    clock = _Clock()
    repository = _repository(tmp_path, clock)
    admission = _admit(repository, projection)
    secret = "Bearer production-secret and full evidence"
    store = _ContractStore(timeout_count=10, secret=secret)
    worker = _worker(repository, facts, store, clock, max_attempts=2)

    worker.project_next("worker-a")
    clock.advance(2)
    worker.project_next("worker-b")

    run = _run(repository, admission)
    assert _value(run, "status") == "dead_letter"
    assert _value(run, "attempt") == 2
    assert repository.is_queryable(projection["store_id"], projection["graph_version_id"]) is False
    issues = repository.list_issues(_value(run, "writeRunId", _value(run, "write_run_id")))
    assert issues
    serialized = json.dumps([
        {
            "code": _value(item, "errorCode", _value(item, "error_code")),
            "retryable": _value(item, "retryable"),
            "message": _value(item, "sanitizedMessage", _value(item, "sanitized_message")),
        }
        for item in issues
    ])
    assert "GRAPH_STORE_TIMEOUT" in serialized
    assert '"retryable": true' in serialized
    assert secret not in serialized
    assert "production-secret" not in serialized
    assert "full evidence" not in serialized
    assert _fact_sha(facts, projection["graph_version_id"]) == before


def test_checkpoint_is_monotonic_and_stale_lease_cannot_overwrite(tmp_path):
    facts, _, projection = _snapshot(tmp_path)
    before = _fact_sha(facts, projection["graph_version_id"])
    clock = _Clock()
    repository = _repository(tmp_path, clock)
    admission = _admit(repository, projection)
    lease = repository.lease_next("worker-a", lease_ttl_seconds=5)
    run = _run(repository, admission)
    run = repository.checkpoint(
        _value(run, "writeRunId", _value(run, "write_run_id")),
        batch_kind="nodes",
        cursor=1,
        succeeded=1,
        failed=0,
        expected_revision=_value(run, "revision"),
        lease_owner="worker-a",
    )
    with _raises(Exception) as backwards:
        repository.checkpoint(
            _value(run, "writeRunId", _value(run, "write_run_id")),
            batch_kind="nodes",
            cursor=0,
            succeeded=0,
            failed=0,
            expected_revision=_value(run, "revision"),
            lease_owner="worker-a",
        )
    assert "GRAPH_WRITE_CONFLICT" in _error_code(backwards.value)

    clock.advance(6)
    replacement = repository.lease_next("worker-b", lease_ttl_seconds=5)
    assert replacement is not None
    current = _run(repository, admission)
    with _raises(Exception) as stale_owner:
        repository.checkpoint(
            _value(current, "writeRunId", _value(current, "write_run_id")),
            batch_kind="nodes",
            cursor=2,
            succeeded=2,
            failed=0,
            expected_revision=_value(current, "revision"),
            lease_owner="worker-a",
        )
    assert "GRAPH_WRITE_CONFLICT" in _error_code(stale_owner.value)
    assert _fact_sha(facts, projection["graph_version_id"]) == before


def test_failed_or_partial_run_can_never_activate_queryable_binding(tmp_path):
    facts, _, projection = _snapshot(tmp_path)
    before = _fact_sha(facts, projection["graph_version_id"])
    clock = _Clock()
    for terminal in ("partial", "failed", "dead_letter"):
        isolated = tmp_path / terminal
        repository = _repository(isolated, clock)
        admission = _admit(repository, projection)
        run = repository.lease_next("worker-a", lease_ttl_seconds=5)
        assert run is not None
        run = repository.transition(
            _value(run, "writeRunId", _value(run, "write_run_id")),
            "writing",
            expected_revision=_value(run, "revision"),
            lease_owner="worker-a",
        )
        run = repository.transition(
            _value(run, "writeRunId", _value(run, "write_run_id")),
            terminal,
            expected_revision=_value(run, "revision"),
            lease_owner="worker-a",
        )
        assert _value(run, "status") == terminal
        assert repository.is_queryable(projection["store_id"], projection["graph_version_id"]) is False
    assert _fact_sha(facts, projection["graph_version_id"]) == before


class GraphProjectionWriteTests(unittest.TestCase):
    """Standard-library runner wrappers keep this suite dependency-free."""

    def _run_in_temporary_root(self, test):
        with TemporaryDirectory() as directory:
            test(Path(directory))

    def test_state_machine_and_revision_cas(self):
        self._run_in_temporary_root(test_graph_write_run_state_machine_and_revision_cas)

    def test_single_flight(self):
        self._run_in_temporary_root(
            test_duplicate_admission_and_concurrent_lease_are_single_flight
        )

    def test_partial_failure(self):
        self._run_in_temporary_root(
            test_edge_partial_failure_records_issue_and_is_not_queryable
        )

    def test_timeout_recovery(self):
        self._run_in_temporary_root(
            test_retryable_timeout_resumes_from_durable_checkpoint
        )

    def test_process_crash_recovery(self):
        self._run_in_temporary_root(
            test_crash_before_cursor_commit_replays_idempotently_after_lease_expiry
        )

    def test_retry_exhaustion(self):
        self._run_in_temporary_root(
            test_retry_exhaustion_dead_letters_and_sanitizes_retryable_issue
        )

    def test_checkpoint_and_lease_fencing(self):
        self._run_in_temporary_root(
            test_checkpoint_is_monotonic_and_stale_lease_cannot_overwrite
        )

    def test_failed_runs_are_not_queryable(self):
        self._run_in_temporary_root(
            test_failed_or_partial_run_can_never_activate_queryable_binding
        )


if __name__ == "__main__":
    unittest.main()
