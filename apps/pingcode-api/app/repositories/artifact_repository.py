from __future__ import annotations

import json
import hashlib
import os
import shutil
import tempfile
import uuid
from pathlib import Path
from typing import Any, Protocol

import yaml

from ..models import ArtifactSnapshotRef


class ArtifactRecordDecodeError(ValueError):
    def __init__(self, message: str, **context: Any):
        super().__init__(message)
        self.context = context


class ArtifactIntegrityError(ValueError):
    def __init__(self, message: str, **context: Any):
        super().__init__(message)
        self.context = context


class ArtifactRepository(Protocol):
    def read_json(self, path: Path, default: Any = None) -> Any: ...

    def read_jsonl(self, path: Path) -> list[dict[str, Any]]: ...

    def write_json(self, path: Path, value: Any) -> None: ...

    def write_jsonl(self, path: Path, items: list[dict[str, Any]]) -> None: ...

    def write_text(self, path: Path, value: str) -> None: ...

    def copy_embedding_cache(self, source_root: Path, target_root: Path) -> None: ...

    def load_corruption_policy(self, path: Path) -> dict[str, Any]: ...

    def read_committed_jsonl(
        self,
        snapshot_ref: ArtifactSnapshotRef,
        artifact_name: str,
        data_root: Path,
        corruption_policy: dict[str, Any],
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]: ...

    def begin_snapshot(self, stage_root: Path, run_id: str) -> Path: ...


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

    def load_corruption_policy(self, path: Path) -> dict[str, Any]:
        try:
            value = yaml.safe_load(path.read_text(encoding="utf-8"))
        except (OSError, yaml.YAMLError) as exc:
            raise ArtifactIntegrityError("产物完整性配置无法读取", artifactPath=str(path)) from exc
        if not isinstance(value, dict) or value.get("schemaVersion") != "artifact-integrity-config/v1":
            raise ArtifactIntegrityError("产物完整性配置 Schema 无效", artifactPath=str(path))
        policy = value.get("artifactCorruption")
        required = {"maxRecordRatio", "maxRecordCount", "redactedPrefixCharacters", "redactedSuffixCharacters"}
        if not isinstance(policy, dict) or not required.issubset(policy):
            raise ArtifactIntegrityError("产物完整性配置缺少必需字段", artifactPath=str(path))
        return policy

    def read_committed_jsonl(
        self,
        snapshot_ref: ArtifactSnapshotRef,
        artifact_name: str,
        data_root: Path,
        corruption_policy: dict[str, Any],
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        manifest_path = data_root / snapshot_ref.manifest_path
        run_root = manifest_path.parent
        commit_path = run_root / "commit.json"
        manifest = self._required_json(manifest_path, snapshot_ref)
        commit = self._required_json(commit_path, snapshot_ref)
        for name, value in (
            ("batchId", snapshot_ref.batch_id),
            ("stage", snapshot_ref.stage),
            ("runId", snapshot_ref.run_id),
            ("inputHash", snapshot_ref.input_hash),
        ):
            if manifest.get(name) != value or commit.get(name) != value:
                raise ArtifactIntegrityError(
                    "已提交快照引用与控制文件不一致",
                    snapshotId=snapshot_ref.run_id,
                    artifactPath=str(manifest_path),
                    field=name,
                )
        manifest_hash = self._hash_file(manifest_path)
        if manifest_hash != snapshot_ref.manifest_hash or commit.get("manifestHash") != snapshot_ref.manifest_hash:
            raise ArtifactIntegrityError("产物清单哈希不一致", snapshotId=snapshot_ref.run_id, artifactPath=str(manifest_path))
        descriptor = next(
            (item for item in manifest.get("artifacts", []) if item.get("path") == artifact_name),
            None,
        )
        if not isinstance(descriptor, dict):
            raise ArtifactIntegrityError("产物清单缺少必需文件", snapshotId=snapshot_ref.run_id, artifactPath=artifact_name)
        path = run_root / artifact_name
        actual_hash = self._hash_file(path)
        if actual_hash != descriptor.get("sha256"):
            raise ArtifactIntegrityError(
                "产物文件哈希不一致", snapshotId=snapshot_ref.run_id,
                artifactPath=artifact_name, expectedHash=descriptor.get("sha256"), actualHash=actual_hash,
            )
        records: list[dict[str, Any]] = []
        issues: list[dict[str, Any]] = []
        total_lines = 0
        byte_offset = 0
        with path.open("rb") as handle:
            for line_number, raw in enumerate(handle, 1):
                offset = byte_offset
                byte_offset += len(raw)
                if not raw.strip():
                    continue
                total_lines += 1
                try:
                    value = json.loads(raw)
                    if not isinstance(value, dict):
                        raise json.JSONDecodeError("记录必须是 JSON 对象", raw.decode("utf-8", "replace"), 0)
                    records.append(value)
                except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                    if not raw.endswith(b"\n"):
                        raise ArtifactIntegrityError(
                            "JSONL 尾部记录被截断", snapshotId=snapshot_ref.run_id,
                            artifactPath=artifact_name, lineNumber=line_number, byteOffset=offset,
                        ) from exc
                    prefix_chars = int(corruption_policy["redactedPrefixCharacters"])
                    suffix_chars = int(corruption_policy["redactedSuffixCharacters"])
                    text = raw.decode("utf-8", "replace").rstrip("\r\n")
                    if len(text) <= prefix_chars + suffix_chars:
                        visible = max(0, len(text) // 3)
                        redacted_prefix = text[:min(prefix_chars, visible)] + "[REDACTED]"
                        redacted_suffix = "[REDACTED]" + text[-min(suffix_chars, visible):] if visible else "[REDACTED]"
                    else:
                        redacted_prefix = text[:prefix_chars] + "[REDACTED]"
                        redacted_suffix = "[REDACTED]" + text[-suffix_chars:] if suffix_chars else "[REDACTED]"
                    issues.append({
                        "schemaVersion": "artifact-read-issue/v1",
                        "code": "ARTIFACT_RECORD_DECODE_FAILED",
                        "severity": "warning",
                        "message": "产物记录损坏，已隔离。",
                        "artifactPath": artifact_name,
                        "snapshotId": snapshot_ref.run_id,
                        "lineNumber": line_number,
                        "byteOffset": offset,
                        "recordHash": "sha256:" + hashlib.sha256(raw).hexdigest(),
                        "redactedPrefix": redacted_prefix,
                        "redactedSuffix": redacted_suffix,
                        "errorClass": "ArtifactRecordDecodeError",
                    })
        damaged = len(issues)
        ratio = damaged / max(total_lines, 1)
        if damaged > int(corruption_policy["maxRecordCount"]) or ratio > float(corruption_policy["maxRecordRatio"]):
            raise ArtifactIntegrityError(
                "JSONL 损坏记录超过隔离阈值", snapshotId=snapshot_ref.run_id,
                artifactPath=artifact_name, damagedRecords=damaged, damagedRatio=ratio,
            )
        return records, issues

    def begin_snapshot(self, stage_root: Path, run_id: str) -> Path:
        staging_root = stage_root / ".staging"
        staging_root.mkdir(parents=True, exist_ok=True)
        return Path(tempfile.mkdtemp(prefix=f"{run_id}-", dir=staging_root))

    def commit_snapshot(
        self,
        staging: Path,
        *,
        batch_id: str,
        stage: str,
        run_id: str,
        input_hash: str,
        execution_hash: str,
        generation: int,
        artifact_paths: list[str],
        data_root: Path,
        manifest_extra: dict[str, Any] | None = None,
    ) -> ArtifactSnapshotRef:
        descriptors = []
        for relative in artifact_paths:
            path = staging / relative
            if not path.is_file():
                raise ArtifactIntegrityError("快照缺少必需产物", artifactPath=relative, snapshotId=run_id)
            descriptors.append({
                "path": relative,
                "sha256": self._hash_file(path),
                "bytes": path.stat().st_size,
                "records": self._record_count(path),
            })
        manifest = {
            "schemaVersion": "artifact-manifest/v1", "batchId": batch_id,
            "stage": stage, "runId": run_id, "executionHash": execution_hash,
            "inputHash": input_hash, "artifacts": descriptors,
        }
        if manifest_extra:
            manifest.update({key: value for key, value in manifest_extra.items() if key != "schemaVersion"})
        manifest_path = staging / "manifest.json"
        self.write_json(manifest_path, manifest)
        manifest_hash = self._hash_file(manifest_path)
        self.write_json(staging / "commit.json", {
            "schemaVersion": "artifact-commit/v1", "batchId": batch_id,
            "stage": stage, "runId": run_id, "executionHash": execution_hash,
            "inputHash": input_hash, "manifestPath": "manifest.json",
            "manifestHash": manifest_hash, "artifactCount": len(descriptors),
        })
        final = staging.parent.parent / "runs" / run_id
        final.parent.mkdir(parents=True, exist_ok=True)
        os.replace(staging, final)
        self._fsync_directory(final.parent)
        relative_manifest = str((final / "manifest.json").resolve().relative_to(data_root.resolve()))
        return ArtifactSnapshotRef(
            batch_id=batch_id, stage=stage, run_id=run_id, input_hash=input_hash,
            manifest_path=relative_manifest, manifest_hash=manifest_hash, generation=generation,
        )

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
        temporary_path = path.parent / f".{path.name}.{uuid.uuid4().hex}.tmp"
        try:
            temporary_path.write_text(value, encoding="utf-8")
            with temporary_path.open("rb") as handle:
                os.fsync(handle.fileno())
            temporary_path.replace(path)
            LocalArtifactRepository._fsync_directory(path.parent)
        finally:
            if temporary_path.exists():
                try:
                    temporary_path.unlink()
                except OSError:
                    pass

    @staticmethod
    def _fsync_directory(path: Path) -> None:
        descriptor = os.open(path, os.O_RDONLY)
        try:
            os.fsync(descriptor)
        finally:
            os.close(descriptor)

    @staticmethod
    def _hash_file(path: Path) -> str:
        try:
            digest = hashlib.sha256()
            with path.open("rb") as handle:
                for block in iter(lambda: handle.read(1024 * 1024), b""):
                    digest.update(block)
            return "sha256:" + digest.hexdigest()
        except OSError as exc:
            raise ArtifactIntegrityError("产物文件无法读取", artifactPath=str(path)) from exc

    @staticmethod
    def _record_count(path: Path) -> int | None:
        if path.suffix != ".jsonl":
            return None
        with path.open("rb") as handle:
            return sum(1 for line in handle if line.strip())

    def _required_json(self, path: Path, snapshot_ref: ArtifactSnapshotRef) -> dict[str, Any]:
        try:
            value = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise ArtifactIntegrityError(
                "已提交快照控制文件无法验证", snapshotId=snapshot_ref.run_id, artifactPath=str(path)
            ) from exc
        if not isinstance(value, dict):
            raise ArtifactIntegrityError("已提交快照控制文件 Schema 无效", artifactPath=str(path))
        return value
