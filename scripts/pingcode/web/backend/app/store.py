import json
import threading
from datetime import datetime
from pathlib import Path
from typing import Any


class JsonStore:
    def __init__(self, path: Path):
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        if not self.path.exists():
            self._write({"batches": {}, "tasks": {}, "datasets": {}, "spaceMappings": {}})

    def _read(self) -> dict[str, Any]:
        with self.path.open("r", encoding="utf-8") as handle:
            return json.load(handle)

    def _write(self, data: dict[str, Any]) -> None:
        temporary = self.path.with_suffix(".tmp")
        temporary.write_text(
            json.dumps(data, ensure_ascii=False, indent=2, default=self._serialize),
            encoding="utf-8",
        )
        temporary.replace(self.path)

    @staticmethod
    def _serialize(value: Any) -> str:
        if isinstance(value, datetime):
            return value.isoformat()
        raise TypeError(f"不支持序列化类型: {type(value)!r}")

    def list_records(self, collection: str) -> list[dict[str, Any]]:
        with self._lock:
            return list(self._read().get(collection, {}).values())

    def get_record(self, collection: str, record_id: str) -> dict[str, Any] | None:
        with self._lock:
            return self._read().get(collection, {}).get(record_id)

    def put_record(self, collection: str, record_id: str, record: dict[str, Any]) -> None:
        with self._lock:
            data = self._read()
            data.setdefault(collection, {})[record_id] = record
            self._write(data)

    def update_record(
        self, collection: str, record_id: str, changes: dict[str, Any]
    ) -> dict[str, Any] | None:
        with self._lock:
            data = self._read()
            record = data.setdefault(collection, {}).get(record_id)
            if record is None:
                return None
            record.update(changes)
            self._write(data)
            return record
