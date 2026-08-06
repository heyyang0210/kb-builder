from __future__ import annotations

import json
import shutil
import tempfile
from pathlib import Path
from typing import Any, Protocol


class ArtifactRepository(Protocol):
    def read_json(self, path: Path, default: Any = None) -> Any: ...

    def read_jsonl(self, path: Path) -> list[dict[str, Any]]: ...

    def write_json(self, path: Path, value: Any) -> None: ...

    def write_jsonl(self, path: Path, items: list[dict[str, Any]]) -> None: ...

    def write_text(self, path: Path, value: str) -> None: ...

    def copy_embedding_cache(self, source_root: Path, target_root: Path) -> None: ...


class LocalArtifactRepository:
    def read_json(self, path: Path, default: Any = None) -> Any:
        if not path.exists():
            return default
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return default

    def read_jsonl(self, path: Path) -> list[dict[str, Any]]:
        if not path.exists():
            return []
        items = []
        for line in path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            try:
                items.append(json.loads(line))
            except json.JSONDecodeError:
                continue
        return items

    def write_json(self, path: Path, value: Any) -> None:
        content = json.dumps(value, ensure_ascii=False, indent=2)
        self._write_atomic(path, content)

    def write_jsonl(self, path: Path, items: list[dict[str, Any]]) -> None:
        content = "".join(json.dumps(item, ensure_ascii=False) + "\n" for item in items)
        self._write_atomic(path, content)

    def write_text(self, path: Path, value: str) -> None:
        self._write_atomic(path, value)

    def copy_embedding_cache(self, source_root: Path, target_root: Path) -> None:
        source = source_root / "model-results/embedding-cache"
        target = target_root / "model-results/embedding-cache"
        target.parent.mkdir(parents=True, exist_ok=True)

        staging = Path(tempfile.mkdtemp(prefix=f".{target.name}.staging-", dir=target.parent))
        backup: Path | None = None
        try:
            if source.is_dir():
                shutil.rmtree(staging)
                shutil.copytree(source, staging)

            if target.exists():
                backup = Path(tempfile.mkdtemp(prefix=f".{target.name}.backup-", dir=target.parent))
                backup.rmdir()
                target.replace(backup)

            try:
                staging.replace(target)
            except BaseException:
                if backup is not None and backup.exists():
                    backup.replace(target)
                    backup = None
                raise

            if backup is not None:
                shutil.rmtree(backup)
                backup = None
        finally:
            if staging.exists():
                shutil.rmtree(staging, ignore_errors=True)
            if backup is not None and backup.exists() and not target.exists():
                try:
                    backup.replace(target)
                    backup = None
                except OSError:
                    pass

    @staticmethod
    def _write_atomic(path: Path, value: str) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary_path = path.with_suffix(path.suffix + ".tmp")
        try:
            temporary_path.write_text(value, encoding="utf-8")
            temporary_path.replace(path)
        finally:
            if temporary_path.exists():
                try:
                    temporary_path.unlink()
                except OSError:
                    pass
