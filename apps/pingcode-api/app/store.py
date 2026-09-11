import json
import fcntl
import os
import threading
import uuid
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Any


class JsonStore:
    def __init__(self, path: Path):
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.lock_path = self.path.with_suffix(self.path.suffix + ".lock")
        self._lock = threading.RLock()
        with self._locked():
            if not self.path.exists():
                self._write({"batches": {}, "tasks": {}, "datasets": {}, "spaceMappings": {}})

    @contextmanager
    def _locked(self):
        with self._lock:
            with self.lock_path.open("a+b") as handle:
                fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
                try:
                    yield
                finally:
                    fcntl.flock(handle.fileno(), fcntl.LOCK_UN)

    def _read(self) -> dict[str, Any]:
        with self.path.open("r", encoding="utf-8") as handle:
            return json.load(handle)

    def _write(self, data: dict[str, Any]) -> None:
        temporary = self.path.parent / f".{self.path.name}.{uuid.uuid4().hex}.tmp"
        try:
            with temporary.open("w", encoding="utf-8") as handle:
                json.dump(data, handle, ensure_ascii=False, indent=2, default=self._serialize)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary, self.path)
            descriptor = os.open(self.path.parent, os.O_RDONLY)
            try:
                os.fsync(descriptor)
            finally:
                os.close(descriptor)
        finally:
            if temporary.exists():
                temporary.unlink()

    @staticmethod
    def _serialize(value: Any) -> str:
        if isinstance(value, datetime):
            return value.isoformat()
        raise TypeError(f"不支持序列化类型: {type(value)!r}")

    def list_records(self, collection: str) -> list[dict[str, Any]]:
        with self._locked():
            return list(self._read().get(collection, {}).values())

    def get_record(self, collection: str, record_id: str) -> dict[str, Any] | None:
        with self._locked():
            return self._read().get(collection, {}).get(record_id)

    def put_record(self, collection: str, record_id: str, record: dict[str, Any]) -> None:
        with self._locked():
            data = self._read()
            data.setdefault(collection, {})[record_id] = record
            self._write(data)

    def update_record(
        self, collection: str, record_id: str, changes: dict[str, Any]
    ) -> dict[str, Any] | None:
        with self._locked():
            data = self._read()
            record = data.setdefault(collection, {}).get(record_id)
            if record is None:
                return None
            record.update(changes)
            self._write(data)
            return record

    def compare_and_update_record(
        self,
        collection: str,
        record_id: str,
        expected: dict[str, Any],
        changes: dict[str, Any],
    ) -> dict[str, Any] | None:
        """Atomically update a record only when all expected top-level fields match."""

        with self._locked():
            data = self._read()
            record = data.setdefault(collection, {}).get(record_id)
            if record is None or any(record.get(key) != value for key, value in expected.items()):
                return None
            record.update(changes)
            self._write(data)
            return record
