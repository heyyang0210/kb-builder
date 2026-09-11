"""Batch projection worker for immutable graph versions."""

from __future__ import annotations

import hashlib
from dataclasses import asdict, is_dataclass
from typing import Any, Callable, Mapping, Sequence

from .graph_store_contract import (
    GraphStoreContractError,
    GraphWriteContext,
    GraphWriteRun,
    canonical_edge,
    canonical_node,
    validate_graph_batch,
)


class GraphProjectionWorker:
    """Lease one outbox intent and project it without mutating its facts."""

    def __init__(
        self,
        *,
        write_repository,
        version_repository,
        graph_store,
        clock: Callable[[], Any],
        batch_size: int,
        lease_ttl_seconds: int,
        max_attempts: int,
        retry_base_seconds: int,
        fault_injector: Callable[[str, Any], None] | None = None,
    ):
        if any(
            type(value) is not int or value <= 0
            for value in (batch_size, lease_ttl_seconds, max_attempts)
        ):
            raise GraphStoreContractError(
                "GRAPH_WRITE_CONTEXT_INVALID",
                "batch, lease, and retry limits must be positive integers",
            )
        if type(retry_base_seconds) is not int or retry_base_seconds < 0:
            raise GraphStoreContractError(
                "GRAPH_WRITE_CONTEXT_INVALID",
                "retry base must be a non-negative integer",
            )
        self.write_repository = write_repository
        self.version_repository = version_repository
        self.graph_store = graph_store
        self.clock = clock
        self.batch_size = batch_size
        self.lease_ttl_seconds = lease_ttl_seconds
        self.max_attempts = max_attempts
        self.retry_base_seconds = retry_base_seconds
        self.fault_injector = fault_injector

    def project_next(self, worker_id: str) -> dict[str, Any] | None:
        run = self.write_repository.lease_next(
            worker_id, lease_ttl_seconds=self.lease_ttl_seconds
        )
        if run is None:
            return None
        write_run_id = str(run["writeRunId"])
        try:
            manifest, nodes, edges = self._read_verified_facts(run)
            run = self.write_repository.transition(
                write_run_id,
                "writing",
                expected_revision=run["revision"],
                lease_owner=worker_id,
                updates={
                    "expectedNodeCount": len(nodes),
                    "expectedEdgeCount": len(edges),
                },
            )
            context = GraphWriteContext(
                write_run_id=write_run_id,
                store_id=str(run["storeId"]),
                dataset_id=str(run["datasetId"]),
                graph_version_id=str(run["graphVersionId"]),
                source_snapshot_id=str(run["sourceSnapshotId"]),
            )
            write_run = GraphWriteRun(
                write_run_id=str(run["writeRunId"]),
                store_id=str(run["storeId"]),
                dataset_id=str(run["datasetId"]),
                graph_version_id=str(run["graphVersionId"]),
                source_snapshot_id=str(run["sourceSnapshotId"]),
                source_fingerprint=str(run["sourceFingerprint"]),
                schema_version=str(run["schemaVersion"]),
                projection_mode=str(run["projectionMode"]),
                status=str(run["status"]),
                attempt=int(run["attempt"]),
            )
            self.graph_store.begin_write(write_run)
            run = self._write_batches(
                run, worker_id, context, "nodes", nodes,
                self.graph_store.upsert_nodes,
            )
            if run["status"] != "writing":
                return run
            run = self._write_batches(
                run, worker_id, context, "edges", edges,
                self.graph_store.upsert_edges,
            )
            if run["status"] != "writing":
                return run
            run = self.write_repository.transition(
                write_run_id,
                "validating",
                expected_revision=run["revision"],
                lease_owner=worker_id,
            )
            self._inject("before_validation", {"writeRunId": write_run_id})
            report = self.graph_store.validate(context)
            if not self._validation_passed(report, len(nodes), len(edges)):
                self._append_issue(
                    run,
                    batch_kind="validation",
                    batch_id="validation",
                    object_type="graph_version",
                    object_id=str(run["graphVersionId"]),
                    error_code="GRAPH_WRITE_PARTIAL",
                    retryable=False,
                    sanitized_message="Graph projection validation failed",
                )
                return self.write_repository.schedule_partial(
                    write_run_id,
                    expected_revision=run["revision"],
                    lease_owner=worker_id,
                    error_code="GRAPH_WRITE_PARTIAL",
                    retryable=False,
                    max_attempts=self.max_attempts,
                    retry_after_seconds=0,
                )
            self._inject("before_run_succeeded_cas", {"writeRunId": write_run_id})
            return self.write_repository.transition(
                write_run_id,
                "succeeded",
                expected_revision=run["revision"],
                lease_owner=worker_id,
            )
        except Exception as error:
            current = self.write_repository.get_run(write_run_id)
            code = self._error_code(error)
            retryable = self._retryable(error, code)
            self._append_issue(
                current,
                batch_kind="run",
                batch_id=f"attempt-{current.get('attempt', 0)}",
                object_type="graph_version",
                object_id=str(current["graphVersionId"]),
                error_code=code,
                retryable=retryable,
                sanitized_message=self._sanitized_message(code),
            )
            if current.get("status") == "leased":
                current = self.write_repository.transition(
                    write_run_id,
                    "writing",
                    expected_revision=current["revision"],
                    lease_owner=worker_id,
                )
            if current.get("status") not in {"writing", "validating"}:
                raise
            delay = self.retry_base_seconds * max(1, int(current.get("attempt") or 1))
            return self.write_repository.schedule_failure(
                write_run_id,
                expected_revision=current["revision"],
                lease_owner=worker_id,
                error_code=code,
                retryable=retryable,
                max_attempts=self.max_attempts,
                retry_after_seconds=delay,
            )

    def _write_batches(
        self,
        run: dict[str, Any],
        worker_id: str,
        context: GraphWriteContext,
        kind: str,
        records: Sequence[Any],
        writer: Callable[[GraphWriteContext, Sequence[Any]], Any],
    ) -> dict[str, Any]:
        cursor_field = "nodeCursor" if kind == "nodes" else "edgeCursor"
        succeeded_field = (
            "succeededNodeCount" if kind == "nodes" else "succeededEdgeCount"
        )
        cursor = int(run.get(cursor_field) or 0)
        succeeded = int(run.get(succeeded_field) or 0)
        while cursor < len(records):
            batch = records[cursor : cursor + self.batch_size]
            result = writer(context, batch)
            self._inject(
                "after_node_upsert" if kind == "nodes" else "after_edge_upsert",
                {"writeRunId": run["writeRunId"], "cursor": cursor},
            )
            self._inject(
                "before_cursor_commit",
                {"writeRunId": run["writeRunId"], "kind": kind, "cursor": cursor},
            )
            accepted = int(self._value(result, "accepted", 0) or 0)
            rejected = int(self._value(result, "rejected", 0) or 0)
            items = list(self._value(result, "items", ()) or ())
            batch_id = str(self._value(result, "batch_id", "") or f"{kind}-{cursor}")
            if accepted + rejected != len(batch):
                raise GraphStoreContractError(
                    "GRAPH_WRITE_RESULT_INVALID",
                    "adapter batch counts do not match submitted batch",
                )
            for item in items:
                if str(self._value(item, "status", "")) == "succeeded":
                    continue
                object_id = str(self._value(item, "object_id", "") or "unknown")
                error_code = str(
                    self._value(item, "error_code", "") or "GRAPH_WRITE_PARTIAL"
                )
                self._append_issue(
                    run,
                    batch_kind=kind,
                    batch_id=batch_id,
                    object_type="node" if kind == "nodes" else "edge",
                    object_id=object_id,
                    error_code=error_code,
                    retryable=bool(self._value(item, "retryable", False)),
                    sanitized_message="Graph projection item rejected",
                )
            cursor += len(batch)
            succeeded += accepted
            run = self.write_repository.checkpoint(
                str(run["writeRunId"]),
                batch_kind=kind,
                cursor=cursor,
                succeeded=succeeded,
                failed=rejected,
                expected_revision=run["revision"],
                lease_owner=worker_id,
            )
            if rejected:
                retryable = any(
                    bool(self._value(item, "retryable", False))
                    for item in items
                    if str(self._value(item, "status", "")) != "succeeded"
                )
                delay = self.retry_base_seconds * max(
                    1, int(run.get("attempt") or 1)
                )
                return self.write_repository.schedule_partial(
                    str(run["writeRunId"]),
                    expected_revision=run["revision"],
                    lease_owner=worker_id,
                    error_code="GRAPH_WRITE_PARTIAL",
                    retryable=retryable,
                    max_attempts=self.max_attempts,
                    retry_after_seconds=delay,
                )
        return run

    def _read_verified_facts(
        self, run: Mapping[str, Any]
    ) -> tuple[dict[str, Any], list[Any], list[Any]]:
        manifest = self.version_repository.read_verified(str(run["graphVersionId"]))
        if (
            manifest.get("datasetId") != run.get("datasetId")
            or manifest.get("sourceSnapshotId") != run.get("sourceSnapshotId")
            or manifest.get("sourceFingerprint") != run.get("sourceFingerprint")
            or manifest.get("graphSource") != "formal"
            or manifest.get("publishStatus") != "published"
            or (manifest.get("publishChecks") or {}).get("status") != "passed"
        ):
            raise GraphStoreContractError(
                "GRAPH_VERSION_CORRUPTED",
                "immutable graph metadata does not satisfy projection admission",
            )
        manifest_path = self.version_repository.root / str(run["graphVersionId"]) / "manifest.json"
        expected_ref = manifest_path.resolve().relative_to(self.write_repository.data_root.resolve())
        if str(expected_ref) != str(run.get("payloadRef")):
            raise GraphStoreContractError(
                "GRAPH_VERSION_CORRUPTED", "outbox payload reference is not authoritative"
            )
        actual_hash = "sha256:" + hashlib.sha256(manifest_path.read_bytes()).hexdigest()
        if actual_hash != run.get("payloadHash"):
            raise GraphStoreContractError(
                "GRAPH_VERSION_CORRUPTED", "outbox payload hash does not match manifest"
            )
        raw_nodes = self.version_repository.read_artifact(str(run["graphVersionId"]), "nodes")
        raw_edges = self.version_repository.read_artifact(str(run["graphVersionId"]), "edges")
        nodes = [self._canonical_node(item, manifest) for item in raw_nodes]
        edges = [self._canonical_edge(item, manifest) for item in raw_edges]
        validate_graph_batch(nodes, edges)
        return manifest, nodes, edges

    @staticmethod
    def _canonical_node(item: Mapping[str, Any], manifest: Mapping[str, Any]):
        return canonical_node(
            node_id=str(item.get("nodeId") or item.get("id") or ""),
            node_type=str(item.get("nodeType") or item.get("type") or ""),
            canonical_name=str(item.get("canonicalName") or item.get("name") or ""),
            schema_version=str(item.get("schemaVersion") or ""),
            graph_version_id=str(item.get("graphVersionId") or ""),
            dataset_id=str(item.get("datasetId") or ""),
            source_snapshot_id=str(item.get("sourceSnapshotId") or ""),
            admission_status=str(item.get("admissionStatus") or ""),
            lifecycle_status=str(item.get("lifecycleStatus") or ""),
            acl_scope=tuple(item.get("aclScope") or ()),
            evidence_refs=tuple(item.get("evidenceRefs") or ()),
            properties=dict(item.get("properties") or {}),
        )

    @staticmethod
    def _canonical_edge(item: Mapping[str, Any], manifest: Mapping[str, Any]):
        return canonical_edge(
            edge_id=str(item.get("edgeId") or item.get("id") or ""),
            edge_type=str(item.get("edgeType") or item.get("type") or ""),
            from_node_id=str(item.get("fromNodeId") or item.get("source") or ""),
            to_node_id=str(item.get("toNodeId") or item.get("target") or ""),
            direction=str(item.get("direction") or ""),
            graph_version_id=str(item.get("graphVersionId") or ""),
            dataset_id=str(item.get("datasetId") or ""),
            schema_version=str(item.get("schemaVersion") or ""),
            evidence_refs=tuple(item.get("evidenceRefs") or ()),
            confidence=item.get("confidence"),
            acl_scope=tuple(item.get("aclScope") or ()),
            properties=dict(item.get("properties") or {}),
        )

    def _append_issue(self, run: Mapping[str, Any], **values: Any) -> dict[str, Any]:
        return self.write_repository.append_issue(str(run["writeRunId"]), **values)

    def _inject(self, stage: str, context: Any) -> None:
        if self.fault_injector is not None:
            self.fault_injector(stage, context)

    @staticmethod
    def _value(value: Any, name: str, default: Any = None) -> Any:
        if isinstance(value, Mapping):
            return value.get(name, default)
        if is_dataclass(value):
            return asdict(value).get(name, default)
        return getattr(value, name, default)

    @classmethod
    def _one_of(cls, value: Any, *names: str, default: Any = None) -> Any:
        for name in names:
            found = cls._value(value, name, None)
            if found is not None:
                return found
        return default

    @classmethod
    def _validation_passed(cls, report: Any, nodes: int, edges: int) -> bool:
        return (
            cls._value(report, "status") == "passed"
            and int(cls._one_of(report, "actual_node_count", "actualNodeCount", default=-1)) == nodes
            and int(cls._one_of(report, "actual_edge_count", "actualEdgeCount", default=-1)) == edges
            and int(cls._one_of(report, "dangling_edge_count", "danglingEdgeCount", default=0)) == 0
            and int(cls._one_of(report, "cross_version_count", "crossVersionCount", default=0)) == 0
            and bool(cls._one_of(report, "fingerprint_matched", "fingerprintMatched", default=False))
            and bool(cls._one_of(report, "evidence_sample_passed", "evidenceSamplePassed", default=False))
            and bool(cls._one_of(report, "acl_sample_passed", "aclSamplePassed", default=False))
        )

    @staticmethod
    def _error_code(error: BaseException) -> str:
        code = getattr(error, "code", getattr(error, "error_code", None))
        if isinstance(code, str) and code:
            return code
        return "GRAPH_STORE_UNAVAILABLE"

    @staticmethod
    def _retryable(error: BaseException, code: str) -> bool:
        explicit = getattr(error, "retryable", None)
        if isinstance(explicit, bool):
            return explicit
        return code in {"GRAPH_STORE_TIMEOUT", "GRAPH_STORE_UNAVAILABLE"}

    @staticmethod
    def _sanitized_message(code: str) -> str:
        messages = {
            "GRAPH_STORE_TIMEOUT": "Graph store operation timed out",
            "GRAPH_STORE_UNAVAILABLE": "Graph store is temporarily unavailable",
            "GRAPH_VERSION_CORRUPTED": "Immutable graph version verification failed",
        }
        return messages.get(code, "Graph projection failed")


# The detailed design uses Worker terminology; Service remains a compatible
# name for application wiring without creating a second implementation.
GraphProjectionService = GraphProjectionWorker
