from __future__ import annotations

import fcntl
import hashlib
import json
import os
import tempfile
import uuid
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator, Protocol


SCHEMA_VERSION = "1.0"


class KeywordFilterRunRepositoryError(RuntimeError):
    """关键词过滤运行仓储异常基类。"""


class KeywordFilterRunNotFoundError(KeywordFilterRunRepositoryError):
    """运行或其所属数据集不存在。"""


class KeywordFilterRunAlreadyExistsError(KeywordFilterRunRepositoryError):
    """相同运行 ID 已经存在。"""


class KeywordFilterRunRevisionConflictError(KeywordFilterRunRepositoryError):
    def __init__(self, expected_revision: int, actual_revision: int):
        super().__init__(
            f"关键词过滤运行 revision 冲突："
            f"期望 {expected_revision}，当前 {actual_revision}"
        )
        self.expected_revision = expected_revision
        self.actual_revision = actual_revision


class KeywordFilterRunImmutableSnapshotError(KeywordFilterRunRepositoryError):
    """尝试覆盖候选、模型或最终决策快照。"""


class KeywordFilterRunStateError(KeywordFilterRunRepositoryError):
    """运行状态迁移不符合状态机。"""


class KeywordFilterRunIntegrityError(KeywordFilterRunRepositoryError):
    """运行产物缺失、损坏或 Schema 无效。"""


class KeywordFilterRunRepository(Protocol):
    def create_run(
        self,
        dataset_id: str,
        filter_run_id: str,
        run: dict[str, Any],
        candidates: list[dict[str, Any]],
    ) -> dict[str, Any]: ...

    def read_run(self, dataset_id: str, filter_run_id: str) -> dict[str, Any]: ...

    def list_runs(
        self, dataset_id: str, *, offset: int = 0, limit: int = 20
    ) -> dict[str, Any]: ...

    def read_candidate_snapshot(
        self, dataset_id: str, filter_run_id: str
    ) -> list[dict[str, Any]]: ...

    def read_model_decisions(
        self, dataset_id: str, filter_run_id: str
    ) -> list[dict[str, Any]] | None: ...

    def read_review_decisions(
        self, dataset_id: str, filter_run_id: str
    ) -> list[dict[str, Any]]: ...

    def read_final_decisions(
        self, dataset_id: str, filter_run_id: str
    ) -> list[dict[str, Any]] | None: ...

    def read_events(
        self, dataset_id: str, filter_run_id: str
    ) -> list[dict[str, Any]]: ...

    def write_model_decisions(
        self,
        dataset_id: str,
        filter_run_id: str,
        decisions: list[dict[str, Any]],
        *,
        expected_revision: int,
        run_updates: dict[str, Any] | None = None,
        event: dict[str, Any] | None = None,
    ) -> dict[str, Any]: ...

    def write_review_decisions(
        self,
        dataset_id: str,
        filter_run_id: str,
        decisions: list[dict[str, Any]],
        *,
        expected_revision: int,
        run_updates: dict[str, Any] | None = None,
        event: dict[str, Any] | None = None,
    ) -> dict[str, Any]: ...

    def write_final_decisions(
        self,
        dataset_id: str,
        filter_run_id: str,
        decisions: list[dict[str, Any]],
        *,
        expected_revision: int,
        run_updates: dict[str, Any] | None = None,
        event: dict[str, Any] | None = None,
    ) -> dict[str, Any]: ...

    def update_run(
        self,
        dataset_id: str,
        filter_run_id: str,
        updates: dict[str, Any],
        *,
        expected_revision: int,
        event: dict[str, Any] | None = None,
    ) -> dict[str, Any]: ...

    def transition_run(
        self,
        dataset_id: str,
        filter_run_id: str,
        target_status: str,
        *,
        expected_revision: int,
        updates: dict[str, Any] | None = None,
        event: dict[str, Any] | None = None,
    ) -> dict[str, Any]: ...


class LocalKeywordFilterRunRepository:
    """数据集内的关键词过滤运行文件仓储。

    `candidate-snapshot.json`、`model-decisions.json` 和
    `final-decisions.json` 一经发布不可覆盖。`review-decisions.json`
    是唯一允许通过 revision CAS 反复保存的决策文件。
    """

    _IMMUTABLE_SNAPSHOTS = {
        "candidates": "candidate-snapshot.json",
        "model": "model-decisions.json",
        "final": "final-decisions.json",
    }
    _REVIEW_FILE = "review-decisions.json"
    _EVENTS_FILE = "events.jsonl"
    _ALLOWED_TRANSITIONS = {
        "created": {"running", "failed"},
        "running": {"reviewable", "incomplete", "failed"},
        "reviewable": {"applied", "superseded"},
        "incomplete": {"superseded"},
        "applied": set(),
        "failed": set(),
        "superseded": set(),
    }

    def __init__(self, data_root: Path):
        self.data_root = Path(data_root)

    def create_run(
        self,
        dataset_id: str,
        filter_run_id: str,
        run: dict[str, Any],
        candidates: list[dict[str, Any]],
    ) -> dict[str, Any]:
        runs_root = self._runs_root(dataset_id)
        runs_root.mkdir(parents=True, exist_ok=True)
        with self._lock(dataset_id, filter_run_id):
            final_root = self._run_root(dataset_id, filter_run_id)
            if final_root.exists():
                raise KeywordFilterRunAlreadyExistsError(
                    f"关键词过滤运行已存在：{filter_run_id}"
                )
            manifest = dict(run)
            manifest.setdefault("schemaVersion", SCHEMA_VERSION)
            manifest.setdefault("status", "created")
            manifest.setdefault("revision", 0)
            manifest.setdefault("candidateTotal", len(candidates))
            manifest["datasetId"] = dataset_id
            manifest["filterRunId"] = filter_run_id
            self._validate_manifest(manifest)
            if manifest["candidateTotal"] != len(candidates):
                raise KeywordFilterRunIntegrityError(
                    "candidateTotal 与候选快照记录数不一致"
                )

            staging = Path(tempfile.mkdtemp(prefix=".staging-", dir=runs_root))
            try:
                self._write_json_atomic(staging / "run.json", manifest)
                self._write_json_atomic(
                    staging / self._IMMUTABLE_SNAPSHOTS["candidates"], candidates
                )
                self._write_json_atomic(staging / self._REVIEW_FILE, [])
                self._write_jsonl_atomic(
                    staging / self._EVENTS_FILE,
                    [
                        {
                            "schemaVersion": SCHEMA_VERSION,
                            "sequence": 1,
                            "type": "run.created",
                            "actor": "system",
                            "revision": 0,
                            "filterRunId": filter_run_id,
                            "datasetId": dataset_id,
                        }
                    ],
                )
                os.replace(staging, final_root)
                self._fsync_directory(runs_root)
            finally:
                if staging.exists():
                    self._remove_empty_staging(staging)
            return dict(manifest)

    def read_run(self, dataset_id: str, filter_run_id: str) -> dict[str, Any]:
        manifest = self._read_required_json(
            self._run_root(dataset_id, filter_run_id) / "run.json", dict
        )
        self._validate_manifest(manifest)
        if manifest["datasetId"] != dataset_id or manifest["filterRunId"] != filter_run_id:
            raise KeywordFilterRunIntegrityError("运行摘要与路径标识不一致")
        return manifest

    def list_runs(
        self, dataset_id: str, *, offset: int = 0, limit: int = 20
    ) -> dict[str, Any]:
        if offset < 0 or limit < 1:
            raise ValueError("offset 不能为负数，limit 必须大于 0")
        runs_root = self._runs_root(dataset_id)
        items: list[dict[str, Any]] = []
        if runs_root.is_dir():
            for path in runs_root.iterdir():
                if not path.is_dir() or path.name.startswith("."):
                    continue
                manifest_path = path / "run.json"
                if not manifest_path.is_file():
                    continue
                manifest = self._read_required_json(manifest_path, dict)
                self._validate_manifest(manifest)
                if manifest["datasetId"] != dataset_id:
                    raise KeywordFilterRunIntegrityError(
                        f"运行摘要 datasetId 与目录不一致：{path.name}"
                    )
                items.append(manifest)
        items.sort(
            key=lambda item: (str(item.get("createdAt") or ""), item["filterRunId"]),
            reverse=True,
        )
        return {
            "items": items[offset : offset + limit],
            "total": len(items),
            "offset": offset,
            "limit": limit,
        }

    def read_candidate_snapshot(
        self, dataset_id: str, filter_run_id: str
    ) -> list[dict[str, Any]]:
        return self._read_snapshot(dataset_id, filter_run_id, "candidates")

    def read_model_decisions(
        self, dataset_id: str, filter_run_id: str
    ) -> list[dict[str, Any]] | None:
        return self._read_optional_snapshot(dataset_id, filter_run_id, "model")

    def read_review_decisions(
        self, dataset_id: str, filter_run_id: str
    ) -> list[dict[str, Any]]:
        self._require_run_root(dataset_id, filter_run_id)
        return self._read_required_json(
            self._run_root(dataset_id, filter_run_id) / self._REVIEW_FILE, list
        )

    def read_final_decisions(
        self, dataset_id: str, filter_run_id: str
    ) -> list[dict[str, Any]] | None:
        return self._read_optional_snapshot(dataset_id, filter_run_id, "final")

    def read_events(
        self, dataset_id: str, filter_run_id: str
    ) -> list[dict[str, Any]]:
        self._require_run_root(dataset_id, filter_run_id)
        path = self._run_root(dataset_id, filter_run_id) / self._EVENTS_FILE
        try:
            lines = path.read_text(encoding="utf-8").splitlines()
            values = [json.loads(line) for line in lines if line.strip()]
        except (OSError, json.JSONDecodeError) as exc:
            raise KeywordFilterRunIntegrityError("运行事件文件无法读取") from exc
        if not all(isinstance(item, dict) for item in values):
            raise KeywordFilterRunIntegrityError("运行事件必须是 JSON 对象")
        return values

    def write_model_decisions(
        self,
        dataset_id: str,
        filter_run_id: str,
        decisions: list[dict[str, Any]],
        *,
        expected_revision: int,
        run_updates: dict[str, Any] | None = None,
        event: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return self._write_decisions(
            dataset_id,
            filter_run_id,
            "model",
            decisions,
            expected_revision=expected_revision,
            run_updates=run_updates,
            event=event or {"type": "model-decisions.frozen", "actor": "system"},
        )

    def write_review_decisions(
        self,
        dataset_id: str,
        filter_run_id: str,
        decisions: list[dict[str, Any]],
        *,
        expected_revision: int,
        run_updates: dict[str, Any] | None = None,
        event: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        with self._lock(dataset_id, filter_run_id):
            run = self._read_and_assert_revision(dataset_id, filter_run_id, expected_revision)
            if run["status"] == "applied":
                raise KeywordFilterRunImmutableSnapshotError(
                    "已应用运行的人工复核草稿不可修改"
                )
            self._write_json_atomic(
                self._run_root(dataset_id, filter_run_id) / self._REVIEW_FILE, decisions
            )
            return self._publish_manifest_change(
                dataset_id,
                filter_run_id,
                run,
                run_updates,
                event or {"type": "review-decisions.saved", "actor": "anonymous"},
            )

    def write_final_decisions(
        self,
        dataset_id: str,
        filter_run_id: str,
        decisions: list[dict[str, Any]],
        *,
        expected_revision: int,
        run_updates: dict[str, Any] | None = None,
        event: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return self._write_decisions(
            dataset_id,
            filter_run_id,
            "final",
            decisions,
            expected_revision=expected_revision,
            run_updates=run_updates,
            event=event or {"type": "final-decisions.frozen", "actor": "system"},
        )

    def update_run(
        self,
        dataset_id: str,
        filter_run_id: str,
        updates: dict[str, Any],
        *,
        expected_revision: int,
        event: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        if "status" in updates:
            raise KeywordFilterRunStateError("状态变更必须使用 transition_run")
        with self._lock(dataset_id, filter_run_id):
            run = self._read_and_assert_revision(dataset_id, filter_run_id, expected_revision)
            return self._publish_manifest_change(
                dataset_id, filter_run_id, run, updates, event
            )

    def transition_run(
        self,
        dataset_id: str,
        filter_run_id: str,
        target_status: str,
        *,
        expected_revision: int,
        updates: dict[str, Any] | None = None,
        event: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        with self._lock(dataset_id, filter_run_id):
            run = self._read_and_assert_revision(dataset_id, filter_run_id, expected_revision)
            current = run["status"]
            if target_status not in self._ALLOWED_TRANSITIONS.get(current, set()):
                raise KeywordFilterRunStateError(
                    f"关键词过滤运行状态不允许从 {current} 迁移到 {target_status}"
                )
            changes = dict(updates or {})
            changes["status"] = target_status
            return self._publish_manifest_change(
                dataset_id,
                filter_run_id,
                run,
                changes,
                event
                or {
                    "type": "run.status-changed",
                    "actor": "system",
                    "fromStatus": current,
                    "toStatus": target_status,
                },
            )

    @staticmethod
    def fingerprint_bytes(value: bytes) -> str:
        return "sha256:" + hashlib.sha256(value).hexdigest()

    @classmethod
    def fingerprint_file(cls, path: Path) -> str:
        digest = hashlib.sha256()
        with Path(path).open("rb") as handle:
            for block in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(block)
        return "sha256:" + digest.hexdigest()

    @classmethod
    def fingerprint_json(cls, value: Any) -> str:
        canonical = json.dumps(
            value, ensure_ascii=False, sort_keys=True, separators=(",", ":")
        ).encode("utf-8")
        return cls.fingerprint_bytes(canonical)

    @classmethod
    def fingerprint_candidates(cls, candidates: list[dict[str, Any]]) -> str:
        stable = []
        for item in candidates:
            stable.append(
                {
                    "keywordId": item.get("keywordId"),
                    "keywordName": item.get("keywordName"),
                    "keywordRawName": item.get("keywordRawName"),
                    "aliases": sorted(str(value) for value in item.get("aliases") or []),
                    "evidenceRefs": sorted(
                        str(value) for value in item.get("evidenceRefs") or []
                    ),
                }
            )
        stable.sort(key=lambda item: str(item.get("keywordId") or ""))
        return cls.fingerprint_json(stable)

    def _write_decisions(
        self,
        dataset_id: str,
        filter_run_id: str,
        kind: str,
        decisions: list[dict[str, Any]],
        *,
        expected_revision: int,
        run_updates: dict[str, Any] | None,
        event: dict[str, Any],
    ) -> dict[str, Any]:
        with self._lock(dataset_id, filter_run_id):
            run = self._read_and_assert_revision(dataset_id, filter_run_id, expected_revision)
            path = self._run_root(dataset_id, filter_run_id) / self._IMMUTABLE_SNAPSHOTS[kind]
            if path.exists():
                raise KeywordFilterRunImmutableSnapshotError(
                    f"{path.name} 已冻结，不可覆盖"
                )
            self._write_json_atomic(path, decisions)
            return self._publish_manifest_change(
                dataset_id, filter_run_id, run, run_updates, event
            )

    def _publish_manifest_change(
        self,
        dataset_id: str,
        filter_run_id: str,
        run: dict[str, Any],
        updates: dict[str, Any] | None,
        event: dict[str, Any] | None,
    ) -> dict[str, Any]:
        next_run = dict(run)
        for key, value in (updates or {}).items():
            if key in {"filterRunId", "datasetId", "schemaVersion", "revision"}:
                raise KeywordFilterRunIntegrityError(f"运行固定字段不可修改：{key}")
            next_run[key] = value
        next_run["revision"] = run["revision"] + 1
        self._validate_manifest(next_run)
        root = self._run_root(dataset_id, filter_run_id)
        if event is not None:
            events = self.read_events(dataset_id, filter_run_id)
            next_event = dict(event)
            next_event.setdefault("schemaVersion", SCHEMA_VERSION)
            next_event.setdefault("actor", "system")
            next_event["sequence"] = len(events) + 1
            next_event["revision"] = next_run["revision"]
            next_event["filterRunId"] = filter_run_id
            next_event["datasetId"] = dataset_id
            self._write_jsonl_atomic(root / self._EVENTS_FILE, [*events, next_event])
        self._write_json_atomic(root / "run.json", next_run)
        return next_run

    def _read_and_assert_revision(
        self, dataset_id: str, filter_run_id: str, expected_revision: int
    ) -> dict[str, Any]:
        run = self.read_run(dataset_id, filter_run_id)
        actual = run["revision"]
        if actual != expected_revision:
            raise KeywordFilterRunRevisionConflictError(expected_revision, actual)
        return run

    def _read_snapshot(
        self, dataset_id: str, filter_run_id: str, kind: str
    ) -> list[dict[str, Any]]:
        self._require_run_root(dataset_id, filter_run_id)
        return self._read_required_json(
            self._run_root(dataset_id, filter_run_id) / self._IMMUTABLE_SNAPSHOTS[kind],
            list,
        )

    def _read_optional_snapshot(
        self, dataset_id: str, filter_run_id: str, kind: str
    ) -> list[dict[str, Any]] | None:
        self._require_run_root(dataset_id, filter_run_id)
        path = self._run_root(dataset_id, filter_run_id) / self._IMMUTABLE_SNAPSHOTS[kind]
        if not path.exists():
            return None
        return self._read_required_json(path, list)

    def _require_run_root(self, dataset_id: str, filter_run_id: str) -> Path:
        root = self._run_root(dataset_id, filter_run_id)
        if not root.is_dir():
            raise KeywordFilterRunNotFoundError(
                f"关键词过滤运行不存在：{filter_run_id}"
            )
        return root

    def _runs_root(self, dataset_id: str) -> Path:
        self._validate_id(dataset_id, "dataset_id")
        return self.data_root / "datasets" / dataset_id / "keyword-filter-runs"

    def _run_root(self, dataset_id: str, filter_run_id: str) -> Path:
        self._validate_id(filter_run_id, "filter_run_id")
        return self._runs_root(dataset_id) / filter_run_id

    @contextmanager
    def _lock(self, dataset_id: str, filter_run_id: str) -> Iterator[None]:
        lock_root = self._runs_root(dataset_id) / ".locks"
        lock_root.mkdir(parents=True, exist_ok=True)
        lock_path = lock_root / f"{filter_run_id}.lock"
        with lock_path.open("a+b") as handle:
            fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
            try:
                yield
            finally:
                fcntl.flock(handle.fileno(), fcntl.LOCK_UN)

    @staticmethod
    def _validate_id(value: str, field: str) -> None:
        if not value or value in {".", ".."} or Path(value).name != value:
            raise ValueError(f"{field} 必须是不含路径分隔符的非空标识")

    @classmethod
    def _validate_manifest(cls, value: dict[str, Any]) -> None:
        required = {
            "filterRunId": str,
            "datasetId": str,
            "status": str,
            "schemaVersion": str,
            "revision": int,
            "candidateTotal": int,
        }
        for field, expected_type in required.items():
            if field not in value or not isinstance(value[field], expected_type):
                raise KeywordFilterRunIntegrityError(f"运行摘要字段无效：{field}")
        if value["schemaVersion"] != SCHEMA_VERSION:
            raise KeywordFilterRunIntegrityError("不支持的运行 schemaVersion")
        if value["status"] not in cls._ALLOWED_TRANSITIONS:
            raise KeywordFilterRunIntegrityError(f"未知运行状态：{value['status']}")
        if value["revision"] < 0 or value["candidateTotal"] < 0:
            raise KeywordFilterRunIntegrityError("revision 和 candidateTotal 不能为负数")

    @staticmethod
    def _read_required_json(path: Path, expected_type: type) -> Any:
        try:
            value = json.loads(path.read_text(encoding="utf-8"))
        except FileNotFoundError as exc:
            raise KeywordFilterRunNotFoundError(f"运行产物不存在：{path.name}") from exc
        except (OSError, json.JSONDecodeError) as exc:
            raise KeywordFilterRunIntegrityError(f"运行产物无法读取：{path.name}") from exc
        if not isinstance(value, expected_type):
            raise KeywordFilterRunIntegrityError(f"运行产物 Schema 无效：{path.name}")
        return value

    @staticmethod
    def _write_json_atomic(path: Path, value: Any) -> None:
        content = json.dumps(value, ensure_ascii=False, indent=2) + "\n"
        LocalKeywordFilterRunRepository._write_atomic(path, content)

    @staticmethod
    def _write_jsonl_atomic(path: Path, values: list[dict[str, Any]]) -> None:
        content = "".join(json.dumps(value, ensure_ascii=False) + "\n" for value in values)
        LocalKeywordFilterRunRepository._write_atomic(path, content)

    @staticmethod
    def _write_atomic(path: Path, content: str) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.parent / f".{path.name}.{uuid.uuid4().hex}.tmp"
        try:
            temporary.write_text(content, encoding="utf-8")
            with temporary.open("rb") as handle:
                os.fsync(handle.fileno())
            os.replace(temporary, path)
            LocalKeywordFilterRunRepository._fsync_directory(path.parent)
        finally:
            if temporary.exists():
                temporary.unlink(missing_ok=True)

    @staticmethod
    def _fsync_directory(path: Path) -> None:
        descriptor = os.open(path, os.O_RDONLY)
        try:
            os.fsync(descriptor)
        finally:
            os.close(descriptor)

    @staticmethod
    def _remove_empty_staging(path: Path) -> None:
        for child in path.iterdir():
            if child.is_file():
                child.unlink(missing_ok=True)
        path.rmdir()
