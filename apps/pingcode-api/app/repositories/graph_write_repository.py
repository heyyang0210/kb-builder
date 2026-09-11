"""Durable write-run and outbox state for graph projections."""

from __future__ import annotations

import fcntl
import hashlib
import json
import os
import tempfile
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable, Iterator, Mapping

from ..graph_store_contract import GraphStoreContractError, GraphWriteRun


class GraphWriteRepository:
    """File-backed projection state with revision CAS and lease fencing."""

    _SCHEMA_VERSION = "graph-write-run/v1"
    _QUERYABLE = "succeeded"
    _TRANSITION_UPDATE_FIELDS = frozenset(
        {
            "expectedNodeCount",
            "expectedEdgeCount",
            "lastErrorCode",
            "nextRetryAt",
            "invalidationReason",
            "invalidatedBy",
        }
    )

    def __init__(
        self,
        data_root: Path,
        *,
        clock: Callable[[], datetime] | None = None,
    ):
        self.data_root = Path(data_root)
        self.root = self.data_root / "graph-projections"
        self.runs_root = self.root / "runs"
        self.locks_root = self.root / ".locks"
        self._clock = clock or (lambda: datetime.now(timezone.utc))

    def admit_projection(
        self,
        *,
        store_id: str,
        dataset_id: str,
        graph_version_id: str,
        source_snapshot_id: str,
        source_fingerprint: str,
        payload_ref: str,
        payload_hash: str,
    ) -> dict[str, Any]:
        for name, value in (
            ("storeId", store_id),
            ("datasetId", dataset_id),
            ("graphVersionId", graph_version_id),
            ("sourceSnapshotId", source_snapshot_id),
            ("sourceFingerprint", source_fingerprint),
            ("payloadRef", payload_ref),
            ("payloadHash", payload_hash),
        ):
            if not isinstance(value, str) or not value:
                raise GraphStoreContractError(
                    "GRAPH_WRITE_CONTEXT_INVALID", f"{name} must be non-empty"
                )
        identity = self._identity(store_id, graph_version_id)
        write_run_id = f"graph_write_{identity[:24]}"
        event_id = f"graph_projection_{identity[:24]}"
        with self._locked("admission", identity):
            path = self._run_path(write_run_id)
            if path.is_file():
                current = self._read_json(path)
                expected = {
                    "storeId": store_id,
                    "datasetId": dataset_id,
                    "graphVersionId": graph_version_id,
                    "sourceSnapshotId": source_snapshot_id,
                    "sourceFingerprint": source_fingerprint,
                    "payloadRef": payload_ref,
                    "payloadHash": payload_hash,
                }
                if any(current.get(key) != value for key, value in expected.items()):
                    raise GraphStoreContractError(
                        "GRAPH_WRITE_CONFLICT",
                        "projection identity already exists with different immutable facts",
                    )
                return current

            now = self._iso(self._now())
            run = {
                "schemaVersion": self._SCHEMA_VERSION,
                "writeRunId": write_run_id,
                "eventId": event_id,
                "storeId": store_id,
                "datasetId": dataset_id,
                "graphVersionId": graph_version_id,
                "sourceSnapshotId": source_snapshot_id,
                "sourceFingerprint": source_fingerprint,
                "payloadRef": payload_ref,
                "payloadHash": payload_hash,
                "projectionMode": "async_outbox",
                "status": "pending",
                "revision": 0,
                "attempt": 0,
                "leaseOwner": None,
                "leaseExpiresAt": None,
                "leaseTtlSeconds": None,
                "nextRetryAt": None,
                "nodeCursor": 0,
                "edgeCursor": 0,
                "expectedNodeCount": 0,
                "expectedEdgeCount": 0,
                "succeededNodeCount": 0,
                "succeededEdgeCount": 0,
                "failedCount": 0,
                "lastErrorCode": None,
                "outboxStatus": "pending",
                "createdAt": now,
                "updatedAt": now,
                "completedAt": None,
            }
            self._validate_run(run)
            self._write_json(path, run)
            return run

    def get_run(self, write_run_id: str) -> dict[str, Any]:
        run = self._read_json(self._run_path(write_run_id))
        self._validate_run(run)
        return run

    def transition(
        self,
        write_run_id: str,
        target_status: str,
        *,
        expected_revision: int,
        lease_owner: str | None = None,
        updates: Mapping[str, Any] | None = None,
    ) -> dict[str, Any]:
        with self._locked("run", write_run_id):
            current = self.get_run(write_run_id)
            self._require_revision(current, expected_revision)
            if target_status == "leased":
                raise GraphStoreContractError(
                    "GRAPH_WRITE_CONFLICT",
                    "write leases can only be established by lease_next",
                )
            changes = dict(updates or {})
            unsupported = set(changes).difference(self._TRANSITION_UPDATE_FIELDS)
            if unsupported:
                raise GraphStoreContractError(
                    "GRAPH_WRITE_CONFLICT",
                    "write-run transition attempted to modify protected state",
                )
            self._require_owner(current, lease_owner, target_status)
            self._require_transition(current, target_status)
            value = dict(current)
            value.update(changes)
            value["status"] = target_status
            value["revision"] = int(current["revision"]) + 1
            value["updatedAt"] = self._iso(self._now())
            if target_status in {"succeeded", "dead_letter", "invalidated"}:
                value["completedAt"] = value["updatedAt"]
                value["leaseOwner"] = None
                value["leaseExpiresAt"] = None
            if target_status == "succeeded":
                value["outboxStatus"] = "acknowledged"
            self._validate_run(value)
            self._write_json(self._run_path(write_run_id), value)
            return value

    def lease_next(
        self, worker_id: str, *, lease_ttl_seconds: int
    ) -> dict[str, Any] | None:
        if not worker_id or type(lease_ttl_seconds) is not int or lease_ttl_seconds <= 0:
            raise GraphStoreContractError(
                "GRAPH_WRITE_CONTEXT_INVALID", "worker and positive lease TTL are required"
            )
        self.runs_root.mkdir(parents=True, exist_ok=True)
        with self._locked("lease", "global"):
            now = self._now()
            for path in sorted(self.runs_root.glob("*.json")):
                if path.name.endswith(".issues.json"):
                    continue
                current = self._read_json(path)
                status = current.get("status")
                lease_expired = self._expired(current.get("leaseExpiresAt"), now)
                retry_due = self._due(current.get("nextRetryAt"), now)
                eligible = (
                    status == "pending"
                    or (status == "retry_wait" and retry_due)
                    or (status in {"leased", "writing", "validating"} and lease_expired)
                )
                if not eligible:
                    continue
                value = dict(current)
                value.update(
                    status="leased",
                    revision=int(current["revision"]) + 1,
                    attempt=int(current.get("attempt") or 0) + 1,
                    leaseOwner=worker_id,
                    leaseExpiresAt=self._iso(now + timedelta(seconds=lease_ttl_seconds)),
                    leaseTtlSeconds=lease_ttl_seconds,
                    nextRetryAt=None,
                    outboxStatus="leased",
                    updatedAt=self._iso(now),
                )
                self._validate_run(value)
                self._write_json(path, value)
                return value
        return None

    def checkpoint(
        self,
        write_run_id: str,
        *,
        batch_kind: str,
        cursor: int,
        succeeded: int,
        failed: int,
        expected_revision: int,
        lease_owner: str,
    ) -> dict[str, Any]:
        if batch_kind not in {"nodes", "edges"}:
            raise GraphStoreContractError(
                "GRAPH_WRITE_CONTEXT_INVALID", "unknown checkpoint batch kind"
            )
        if any(type(value) is not int or value < 0 for value in (cursor, succeeded, failed)):
            raise GraphStoreContractError(
                "GRAPH_WRITE_CONTEXT_INVALID", "checkpoint values must be non-negative integers"
            )
        with self._locked("run", write_run_id):
            current = self.get_run(write_run_id)
            self._require_revision(current, expected_revision)
            self._require_active_lease(current, lease_owner)
            cursor_field = "nodeCursor" if batch_kind == "nodes" else "edgeCursor"
            count_field = (
                "succeededNodeCount" if batch_kind == "nodes" else "succeededEdgeCount"
            )
            if cursor < int(current.get(cursor_field) or 0):
                raise GraphStoreContractError(
                    "GRAPH_WRITE_CONFLICT", "checkpoint cursor cannot move backwards"
                )
            value = dict(current)
            value[cursor_field] = cursor
            value[count_field] = succeeded
            value["failedCount"] = int(current.get("failedCount") or 0) + failed
            value["revision"] = int(current["revision"]) + 1
            value["updatedAt"] = self._iso(self._now())
            lease_ttl = current.get("leaseTtlSeconds")
            if type(lease_ttl) is int and lease_ttl > 0:
                value["leaseExpiresAt"] = self._iso(
                    self._now() + timedelta(seconds=lease_ttl)
                )
            self._write_json(self._run_path(write_run_id), value)
            return value

    def append_issue(
        self,
        write_run_id: str,
        *,
        batch_kind: str,
        batch_id: str,
        object_type: str,
        object_id: str,
        error_code: str,
        retryable: bool,
        sanitized_message: str,
    ) -> dict[str, Any]:
        current = self.get_run(write_run_id)
        identity = self._identity(
            write_run_id, batch_kind, batch_id, object_type, object_id, error_code,
            str(current.get("attempt") or 0),
        )
        now = self._iso(self._now())
        issue = {
            "issueId": f"graph_write_issue_{identity[:24]}",
            "writeRunId": write_run_id,
            "graphVersionId": current["graphVersionId"],
            "batchKind": batch_kind,
            "batchId": batch_id,
            "objectType": object_type,
            "objectId": object_id,
            "errorCode": error_code,
            "retryable": bool(retryable),
            "sanitizedMessage": sanitized_message,
            "firstSeenAt": now,
            "lastSeenAt": now,
            "attempt": current.get("attempt", 0),
        }
        path = self._issues_path(write_run_id)
        with self._locked("issues", write_run_id):
            items = self._read_json(path) if path.is_file() else []
            existing = next(
                (item for item in items if item.get("issueId") == issue["issueId"]), None
            )
            if existing is not None:
                existing["lastSeenAt"] = now
                issue = existing
            else:
                items.append(issue)
            self._write_json(path, items)
        return dict(issue)

    def list_issues(self, write_run_id: str) -> list[dict[str, Any]]:
        path = self._issues_path(write_run_id)
        if not path.is_file():
            return []
        value = self._read_json(path)
        if not isinstance(value, list) or any(not isinstance(item, dict) for item in value):
            raise GraphStoreContractError(
                "GRAPH_WRITE_STATE_INVALID", "write issue file is invalid"
            )
        return [dict(item) for item in value]

    def is_queryable(self, store_id: str, graph_version_id: str) -> bool:
        run_id = f"graph_write_{self._identity(store_id, graph_version_id)[:24]}"
        path = self._run_path(run_id)
        if not path.is_file():
            return False
        try:
            value = self.get_run(run_id)
        except GraphStoreContractError:
            return False
        return value.get("status") == self._QUERYABLE

    def schedule_failure(
        self,
        write_run_id: str,
        *,
        expected_revision: int,
        lease_owner: str,
        error_code: str,
        retryable: bool,
        max_attempts: int,
        retry_after_seconds: int,
    ) -> dict[str, Any]:
        current = self.transition(
            write_run_id,
            "failed",
            expected_revision=expected_revision,
            lease_owner=lease_owner,
            updates={"lastErrorCode": error_code},
        )
        if retryable and int(current.get("attempt") or 0) < max_attempts:
            retry_at = self._now() + timedelta(seconds=max(0, retry_after_seconds))
            return self.transition(
                write_run_id,
                "retry_wait",
                expected_revision=current["revision"],
                lease_owner=lease_owner,
                updates={"nextRetryAt": self._iso(retry_at)},
            )
        return self.transition(
            write_run_id,
            "dead_letter",
            expected_revision=current["revision"],
            lease_owner=lease_owner,
        )

    def schedule_partial(
        self,
        write_run_id: str,
        *,
        expected_revision: int,
        lease_owner: str,
        error_code: str,
        retryable: bool,
        max_attempts: int,
        retry_after_seconds: int,
    ) -> dict[str, Any]:
        current = self.transition(
            write_run_id,
            "partial",
            expected_revision=expected_revision,
            lease_owner=lease_owner,
            updates={"lastErrorCode": error_code},
        )
        if retryable and int(current.get("attempt") or 0) < max_attempts:
            retry_at = self._now() + timedelta(seconds=max(0, retry_after_seconds))
            return self.transition(
                write_run_id,
                "retry_wait",
                expected_revision=current["revision"],
                lease_owner=lease_owner,
                updates={"nextRetryAt": self._iso(retry_at)},
            )
        return self.transition(
            write_run_id,
            "dead_letter",
            expected_revision=current["revision"],
            lease_owner=lease_owner,
        )

    def invalidate(
        self,
        write_run_id: str,
        *,
        expected_revision: int,
        reason: str,
        actor_ref: str,
    ) -> dict[str, Any]:
        if not reason or not actor_ref:
            raise GraphStoreContractError(
                "GRAPH_WRITE_CONTEXT_INVALID",
                "invalidation requires a reason and an audited actor reference",
            )
        return self.transition(
            write_run_id,
            "invalidated",
            expected_revision=expected_revision,
            updates={"invalidationReason": reason, "invalidatedBy": actor_ref},
        )

    def _require_transition(self, current: Mapping[str, Any], target: str) -> None:
        run = GraphWriteRun(
            write_run_id=str(current["writeRunId"]),
            store_id=str(current["storeId"]),
            dataset_id=str(current["datasetId"]),
            graph_version_id=str(current["graphVersionId"]),
            source_snapshot_id=str(current["sourceSnapshotId"]),
            source_fingerprint=str(current["sourceFingerprint"]),
            schema_version=str(current["schemaVersion"]),
            projection_mode=str(current["projectionMode"]),
            status=str(current["status"]),
            attempt=int(current.get("attempt") or 0),
        )
        if target == "dead_letter" and run.status == "writing":
            # Repository-level forced terminal transition is the atomic form
            # of writing -> failed -> dead_letter for non-retryable failures.
            return
        run.require_transition(target)

    def _require_owner(
        self, current: Mapping[str, Any], owner: str | None, target: str
    ) -> None:
        expected = current.get("leaseOwner")
        if current.get("status") in {"leased", "writing", "validating"}:
            if not expected or owner != expected:
                raise GraphStoreContractError(
                    "GRAPH_WRITE_CONFLICT", "write lease is absent or owned by another worker"
                )
            if self._expired(current.get("leaseExpiresAt"), self._now()):
                raise GraphStoreContractError(
                    "GRAPH_WRITE_CONFLICT", "write lease expired before state transition"
                )

    def _require_active_lease(self, current: Mapping[str, Any], owner: str) -> None:
        if current.get("leaseOwner") != owner or self._expired(
            current.get("leaseExpiresAt"), self._now()
        ):
            raise GraphStoreContractError(
                "GRAPH_WRITE_CONFLICT", "write lease is absent, expired, or replaced"
            )

    @staticmethod
    def _require_revision(current: Mapping[str, Any], expected: int) -> None:
        if int(current.get("revision") or 0) != expected:
            raise GraphStoreContractError(
                "GRAPH_WRITE_CONFLICT", "write-run revision compare-and-set failed"
            )

    @staticmethod
    def _validate_run(value: Mapping[str, Any]) -> None:
        GraphWriteRun(
            write_run_id=str(value.get("writeRunId") or ""),
            store_id=str(value.get("storeId") or ""),
            dataset_id=str(value.get("datasetId") or ""),
            graph_version_id=str(value.get("graphVersionId") or ""),
            source_snapshot_id=str(value.get("sourceSnapshotId") or ""),
            source_fingerprint=str(value.get("sourceFingerprint") or ""),
            schema_version=str(value.get("schemaVersion") or ""),
            projection_mode=str(value.get("projectionMode") or ""),
            status=str(value.get("status") or ""),
            attempt=int(value.get("attempt") or 0),
        )

    def _now(self) -> datetime:
        value = self._clock()
        if value.tzinfo is None or value.utcoffset() is None:
            raise GraphStoreContractError(
                "GRAPH_WRITE_STATE_INVALID", "repository clock must be timezone-aware"
            )
        return value.astimezone(timezone.utc)

    @staticmethod
    def _iso(value: datetime) -> str:
        return value.astimezone(timezone.utc).isoformat()

    @staticmethod
    def _parse(value: Any) -> datetime | None:
        if not isinstance(value, str) or not value:
            return None
        try:
            parsed = datetime.fromisoformat(value)
        except ValueError as exc:
            raise GraphStoreContractError(
                "GRAPH_WRITE_STATE_INVALID", "stored projection timestamp is invalid"
            ) from exc
        if parsed.tzinfo is None or parsed.utcoffset() is None:
            raise GraphStoreContractError(
                "GRAPH_WRITE_STATE_INVALID", "stored projection timestamp lacks timezone"
            )
        return parsed.astimezone(timezone.utc)

    @classmethod
    def _expired(cls, value: Any, now: datetime) -> bool:
        parsed = cls._parse(value)
        return parsed is None or parsed <= now

    @classmethod
    def _due(cls, value: Any, now: datetime) -> bool:
        parsed = cls._parse(value)
        return parsed is not None and parsed <= now

    @staticmethod
    def _identity(*values: str) -> str:
        return hashlib.sha256("\x1f".join(values).encode("utf-8")).hexdigest()

    def _run_path(self, write_run_id: str) -> Path:
        self._validate_id(write_run_id)
        return self.runs_root / f"{write_run_id}.json"

    def _issues_path(self, write_run_id: str) -> Path:
        self._validate_id(write_run_id)
        return self.runs_root / f"{write_run_id}.issues.json"

    @staticmethod
    def _validate_id(value: str) -> None:
        if not value or value in {".", ".."} or Path(value).name != value:
            raise GraphStoreContractError(
                "GRAPH_WRITE_CONTEXT_INVALID", "write-run ID contains a path separator"
            )

    @contextmanager
    def _locked(self, category: str, identity: str) -> Iterator[None]:
        self.locks_root.mkdir(parents=True, exist_ok=True)
        digest = self._identity(category, identity)
        with (self.locks_root / f"{digest}.lock").open("a+b") as handle:
            fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
            try:
                yield
            finally:
                fcntl.flock(handle.fileno(), fcntl.LOCK_UN)

    @staticmethod
    def _read_json(path: Path) -> Any:
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise GraphStoreContractError(
                "GRAPH_WRITE_STATE_INVALID", "projection state cannot be read"
            ) from exc

    def _write_json(self, path: Path, value: Any) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        payload = (
            json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
            + "\n"
        ).encode("utf-8")
        descriptor, temporary_name = tempfile.mkstemp(
            prefix=f".{path.name}.", suffix=".tmp", dir=path.parent
        )
        temporary = Path(temporary_name)
        try:
            with os.fdopen(descriptor, "wb") as output:
                output.write(payload)
                output.flush()
                os.fsync(output.fileno())
            os.replace(temporary, path)
            self._fsync_directory(path.parent)
        finally:
            if temporary.exists():
                temporary.unlink()

    @staticmethod
    def _fsync_directory(path: Path) -> None:
        descriptor = os.open(path, os.O_RDONLY)
        try:
            os.fsync(descriptor)
        finally:
            os.close(descriptor)
