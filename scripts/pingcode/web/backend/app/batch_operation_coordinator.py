from __future__ import annotations

import fcntl
import hashlib
import json
import os
import threading
import time
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterator

from .models import ArtifactSnapshotRef
from .repositories.artifact_repository import ArtifactIntegrityError, LocalArtifactRepository


@dataclass(frozen=True)
class FlightReservation:
    state: str
    execution_hash: str
    expected_generation: int
    snapshot_ref: ArtifactSnapshotRef | None = None

    @property
    def is_owner(self) -> bool:
        return self.state == "owner"


class BatchOperationCoordinator:
    """Provides short process/thread locks for state registration and pointer CAS."""

    def __init__(self, data_root: Path, artifacts: LocalArtifactRepository | None = None):
        self.data_root = data_root
        self.lock_root = data_root / ".locks"
        self.lock_root.mkdir(parents=True, exist_ok=True)
        self.artifacts = artifacts or LocalArtifactRepository()
        self._guard = threading.Lock()
        self._thread_locks: dict[str, threading.RLock] = {}

    @contextmanager
    def lock(self, key: str) -> Iterator[None]:
        with self._guard:
            thread_lock = self._thread_locks.setdefault(key, threading.RLock())
        digest = hashlib.sha256(key.encode("utf-8")).hexdigest()
        lock_path = self.lock_root / f"{digest}.lock"
        with thread_lock:
            with lock_path.open("a+b") as handle:
                fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
                try:
                    yield
                finally:
                    fcntl.flock(handle.fileno(), fcntl.LOCK_UN)

    @contextmanager
    def admission(self, batch_id: str) -> Iterator[None]:
        with self.lock(f"{batch_id}:admission"):
            yield

    def reserve_flight(
        self,
        batch_root: Path,
        stage: str,
        execution_hash: str,
        owner_id: str,
    ) -> FlightReservation:
        state_path = self._flight_path(batch_root, stage, execution_hash)
        with self.lock(f"{batch_root.name}:{stage}:{execution_hash}"):
            current = self._read_pointer(state_path)
            if isinstance(current, dict) and current.get("state") == "completed":
                ref = ArtifactSnapshotRef.model_validate(current["snapshotRef"])
                return FlightReservation("completed", execution_hash, ref.generation, ref)
            if isinstance(current, dict) and current.get("state") == "running":
                return FlightReservation(
                    "follower", execution_hash, int(current.get("expectedGeneration", 0))
                )
            latest = self._read_pointer(batch_root / stage / "latest.json")
            expected = int(latest.get("generation", 0))
            now = time.time()
            self.artifacts.write_json(state_path, {
                "schemaVersion": "single-flight/v1",
                "batchId": batch_root.name,
                "stage": stage,
                "executionHash": execution_hash,
                "state": "running",
                "ownerId": owner_id,
                "ownerProcessId": os.getpid(),
                "expectedGeneration": expected,
                "attempt": int((current or {}).get("attempt", 0)) + 1,
                "snapshotRef": None,
                "error": None,
                "startedAtEpoch": now,
                "updatedAtEpoch": now,
            })
            return FlightReservation("owner", execution_hash, expected)

    def wait_for_flight(
        self,
        batch_root: Path,
        stage: str,
        execution_hash: str,
        timeout: float = 600.0,
    ) -> ArtifactSnapshotRef:
        path = self._flight_path(batch_root, stage, execution_hash)
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            value = self._read_pointer(path)
            if isinstance(value, dict) and value.get("state") == "completed":
                return ArtifactSnapshotRef.model_validate(value["snapshotRef"])
            if isinstance(value, dict) and value.get("state") == "failed":
                raise RuntimeError(str((value.get("error") or {}).get("message") or "并发计算失败"))
            time.sleep(0.02)
        raise TimeoutError("等待相同输入的并发计算超时")

    def complete_flight(
        self,
        batch_root: Path,
        stage: str,
        execution_hash: str,
        snapshot_ref: ArtifactSnapshotRef,
    ) -> None:
        path = self._flight_path(batch_root, stage, execution_hash)
        with self.lock(f"{batch_root.name}:{stage}:{execution_hash}"):
            value = self._read_pointer(path)
            value.update(state="completed", snapshotRef=snapshot_ref.model_dump(mode="json", by_alias=True), error=None)
            self.artifacts.write_json(path, value)

    def fail_flight(
        self, batch_root: Path, stage: str, execution_hash: str, error: BaseException
    ) -> None:
        path = self._flight_path(batch_root, stage, execution_hash)
        with self.lock(f"{batch_root.name}:{stage}:{execution_hash}"):
            value = self._read_pointer(path)
            value.update(state="failed", snapshotRef=None, error={"type": type(error).__name__, "message": str(error)})
            self.artifacts.write_json(path, value)

    def commit_latest(
        self,
        batch_root: Path,
        snapshot_ref: ArtifactSnapshotRef,
        expected_generation: int,
    ) -> bool:
        path = batch_root / snapshot_ref.stage / "latest.json"
        with self.lock(f"{batch_root.name}:{snapshot_ref.stage}:latest"):
            current = self._read_pointer(path)
            if int(current.get("generation", 0)) != expected_generation:
                return False
            value = snapshot_ref.model_dump(mode="json", by_alias=True)
            value["schemaVersion"] = "artifact-latest/v1"
            self.artifacts.write_json(path, value)
            return True

    @staticmethod
    def _flight_path(batch_root: Path, stage: str, execution_hash: str) -> Path:
        digest = execution_hash.removeprefix("sha256:")
        return batch_root / stage / "single-flight" / f"{digest}.json"

    @staticmethod
    def _read_pointer(path: Path) -> dict[str, Any]:
        if not path.exists():
            return {}
        try:
            value = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise ArtifactIntegrityError(
                "协调状态文件无法验证", artifactPath=str(path)
            ) from exc
        if not isinstance(value, dict):
            raise ArtifactIntegrityError("协调状态文件 Schema 无效", artifactPath=str(path))
        return value
