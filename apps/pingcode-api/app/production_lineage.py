"""Adapt production training artifacts into an immutable governance package."""

from __future__ import annotations

import hashlib
import fcntl
import json
import os
import shutil
import stat
import time
import tempfile
import uuid
from dataclasses import dataclass
from pathlib import Path
from types import MappingProxyType
from typing import Any, Callable, Mapping, Sequence

from .config import settings
from .lineage_manifest import LineageManifest, SourceOccurrenceIdentity
from .version_fingerprint import VersionFingerprint


KEYWORD_MODE = "keyword_analysis"
FORMAL_MODE = "formal_knowledge"
_MODES = {KEYWORD_MODE, FORMAL_MODE}


class ProductionLineageError(ValueError):
    """A classified failure that prevents publication of the whole package."""

    def __init__(self, code: str, message: str, **context: Any):
        super().__init__(message)
        self.code = code
        self.context = context

    def to_dict(self) -> dict[str, Any]:
        return {"code": self.code, "message": str(self), **self.context}


class KeywordRuleSnapshot:
    """Persist and verify the immutable semantic facts of keyword extraction.

    The descriptor deliberately excludes runtime tuning.  A snapshot is a
    three-file hash chain (artifact -> manifest -> commit), and all paths are
    resolved below the supplied run directory before they are opened.
    """

    _SCHEMA_VERSION = "keyword-rule-snapshot/v1"
    _EXTRACTOR_PREFIX = "keyword-rule:v1:"

    @classmethod
    def _canonical(cls, value: Any) -> bytes:
        try:
            return json.dumps(
                value,
                ensure_ascii=False,
                sort_keys=True,
                separators=(",", ":"),
                allow_nan=False,
            ).encode("utf-8")
        except (TypeError, ValueError) as exc:
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "规则快照内容不是可规范化 JSON"
            ) from exc

    @classmethod
    def _semantic_descriptor(cls, descriptor: Mapping[str, Any]) -> dict[str, Any]:
        if not isinstance(descriptor, Mapping):
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "规则快照 descriptor 必须是对象"
            )
        # runtimeConfiguration is intentionally excluded from the semantic
        # identity; concurrency/logging must never create a new extractor.
        result = {
            key: value
            for key, value in descriptor.items()
            if key not in {"runtimeConfiguration", "createdAt", "inputSnapshotFingerprints"}
        }
        artifacts = result.get("ruleArtifacts")
        if artifacts is not None:
            if not isinstance(artifacts, list):
                raise ProductionLineageError(
                    "ARTIFACT_INTEGRITY_ERROR", "ruleArtifacts 必须是数组"
                )
            if any(not isinstance(item, Mapping) for item in artifacts):
                raise ProductionLineageError(
                    "ARTIFACT_INTEGRITY_ERROR", "ruleArtifacts 条目必须是对象"
                )
            result["ruleArtifacts"] = sorted(
                (dict(item) for item in artifacts),
                key=lambda item: (
                    str(item.get("name", "")),
                    str(item.get("version", "")),
                    str(item.get("contentHash", "")),
                ),
            )
        return result

    @classmethod
    def extractor_version(cls, descriptor: Mapping[str, Any]) -> str:
        semantic = cls._semantic_descriptor(descriptor)
        digest = hashlib.sha256(cls._canonical(semantic)).hexdigest()
        return cls._EXTRACTOR_PREFIX + digest

    @classmethod
    def _digest(cls, path: Path) -> str:
        return "sha256:" + hashlib.sha256(path.read_bytes()).hexdigest()

    @staticmethod
    def _safe_path(run_root: Path, relative: Any) -> Path:
        if not isinstance(relative, str) or not relative or Path(relative).is_absolute():
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "规则快照路径必须是非空相对路径"
            )
        root = Path(run_root)
        if root.is_symlink():
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "规则快照 run 目录不能是符号链接"
            )
        try:
            root_real = root.resolve(strict=True)
            candidate = (root / relative).resolve(strict=True)
            candidate.relative_to(root_real)
        except (OSError, RuntimeError, ValueError) as exc:
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "规则快照路径越界或不存在", artifactPath=relative
            ) from exc
        if candidate.is_symlink() or not candidate.is_file() or not stat.S_ISREG(candidate.stat().st_mode):
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "规则快照文件必须是普通非符号链接文件", artifactPath=relative
            )
        # Check every existing component so a symlinked parent cannot be used
        # even when its resolved target happens to remain under the root.
        current = root
        for component in Path(relative).parts:
            current = current / component
            if current.is_symlink():
                raise ProductionLineageError(
                    "ARTIFACT_INTEGRITY_ERROR", "规则快照路径不能包含符号链接", artifactPath=relative
                )
        return candidate

    @classmethod
    def commit(
        cls,
        *,
        run_root: Path,
        run_id: str,
        descriptor: Mapping[str, Any],
        input_snapshot_fingerprints: Sequence[Mapping[str, Any]],
    ) -> dict[str, Any]:
        if not isinstance(run_id, str) or not run_id:
            raise ProductionLineageError("ARTIFACT_INTEGRITY_ERROR", "规则快照 runId 不能为空")
        root = Path(run_root)
        if root.exists() and root.is_symlink():
            raise ProductionLineageError("ARTIFACT_INTEGRITY_ERROR", "规则快照 run 目录不能是符号链接")
        root.mkdir(parents=True, exist_ok=True)
        if root.is_symlink():
            raise ProductionLineageError("ARTIFACT_INTEGRITY_ERROR", "规则快照 run 目录不能是符号链接")
        semantic = cls._semantic_descriptor(descriptor)
        version = cls.extractor_version(semantic)
        descriptor_hash = "sha256:" + version.split(":", 2)[2]
        artifact_rel = "rule-snapshots/keyword-rule.json"
        manifest_rel = "rule-snapshots/manifest.json"
        final_dir = root / "rule-snapshots"
        if final_dir.exists() or final_dir.is_symlink():
            raise ProductionLineageError("ARTIFACT_INTEGRITY_ERROR", "规则快照已存在且不可覆盖")
        staging_dir = root / f".keyword-rule-staging-{uuid.uuid4().hex}"
        artifact = staging_dir / "keyword-rule.json"
        manifest = staging_dir / "manifest.json"
        commit_file = staging_dir / "commit.json"
        staging_dir.mkdir(parents=True, exist_ok=False)
        artifact_value = {
            "schemaVersion": cls._SCHEMA_VERSION,
            "extractorVersion": version,
            "descriptorHash": descriptor_hash,
            "descriptor": semantic,
        }
        artifact.write_bytes(cls._canonical(artifact_value))
        fingerprints = sorted(
            (dict(item) for item in input_snapshot_fingerprints if isinstance(item, Mapping)),
            key=lambda item: (str(item.get("resourceId", "")), str(item.get("digest", ""))),
        )
        manifest_value = {
            "schemaVersion": cls._SCHEMA_VERSION,
            "runId": run_id,
            "artifactPath": artifact_rel,
            "artifactHash": cls._digest(artifact),
            "extractorVersion": version,
            "descriptorHash": descriptor_hash,
            "inputSnapshotFingerprints": fingerprints,
        }
        manifest.write_bytes(cls._canonical(manifest_value))
        manifest_hash = cls._digest(manifest)
        commit_value = {
            "schemaVersion": cls._SCHEMA_VERSION,
            "runId": run_id,
            "manifestPath": manifest_rel,
            "manifestHash": manifest_hash,
            "artifactPath": artifact_rel,
            "artifactHash": cls._digest(artifact),
            "extractorVersion": version,
        }
        commit_file.write_bytes(cls._canonical(commit_value))
        for path in (artifact, manifest, commit_file):
            cls._fsync_file(path)
        cls._fsync_directory(staging_dir)
        try:
            os.replace(staging_dir, final_dir)
        except OSError as exc:
            shutil.rmtree(staging_dir, ignore_errors=True)
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "规则快照提交发生并发冲突"
            ) from exc
        cls._fsync_directory(root)
        return {
            "schemaVersion": cls._SCHEMA_VERSION,
            "runId": run_id,
            "artifactPath": artifact_rel,
            "artifactHash": manifest_value["artifactHash"],
            "manifestPath": manifest_rel,
            "manifestHash": manifest_hash,
            "extractorVersion": version,
            "descriptorHash": descriptor_hash,
        }

    @classmethod
    def verify(
        cls,
        *,
        run_root: Path,
        snapshot_ref: Mapping[str, Any],
        expected_run_id: str,
    ) -> dict[str, Any]:
        if not isinstance(snapshot_ref, Mapping):
            raise ProductionLineageError("ARTIFACT_INTEGRITY_ERROR", "规则快照引用必须是对象")
        if snapshot_ref.get("runId") != expected_run_id:
            raise ProductionLineageError("ARTIFACT_INTEGRITY_ERROR", "规则快照不属于 expected run")
        try:
            artifact = cls._safe_path(run_root, snapshot_ref.get("artifactPath"))
            manifest = cls._safe_path(run_root, snapshot_ref.get("manifestPath"))
            commit = cls._safe_path(run_root, "rule-snapshots/commit.json")
            artifact_value = json.loads(artifact.read_text(encoding="utf-8"))
            manifest_value = json.loads(manifest.read_text(encoding="utf-8"))
            commit_value = json.loads(commit.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ProductionLineageError("ARTIFACT_INTEGRITY_ERROR", "规则快照文件不可解析") from exc
        if not all(isinstance(value, dict) for value in (artifact_value, manifest_value, commit_value)):
            raise ProductionLineageError("ARTIFACT_INTEGRITY_ERROR", "规则快照文件结构无效")
        artifact_hash = cls._digest(artifact)
        manifest_hash = cls._digest(manifest)
        if (
            artifact_hash != snapshot_ref.get("artifactHash")
            or manifest_hash != snapshot_ref.get("manifestHash")
            or artifact_hash != manifest_value.get("artifactHash")
            or manifest_hash != commit_value.get("manifestHash")
            or commit_value.get("artifactHash") != artifact_hash
            or manifest_value.get("runId") != expected_run_id
            or manifest_value.get("artifactPath") != snapshot_ref.get("artifactPath")
            or commit_value.get("runId") != expected_run_id
            or commit_value.get("manifestPath") != snapshot_ref.get("manifestPath")
            or commit_value.get("artifactPath") != snapshot_ref.get("artifactPath")
            or commit_value.get("extractorVersion") != snapshot_ref.get("extractorVersion")
        ):
            raise ProductionLineageError("ARTIFACT_INTEGRITY_ERROR", "规则快照哈希链校验失败")
        descriptor = artifact_value.get("descriptor")
        version = cls.extractor_version(descriptor) if isinstance(descriptor, Mapping) else None
        if not version or version != snapshot_ref.get("extractorVersion") or version != manifest_value.get("extractorVersion"):
            raise ProductionLineageError("ARTIFACT_INTEGRITY_ERROR", "规则快照 extractorVersion 不一致")
        descriptor_hash = "sha256:" + version.split(":", 2)[2]
        if artifact_value.get("descriptorHash") != descriptor_hash or manifest_value.get("descriptorHash") != descriptor_hash:
            raise ProductionLineageError("ARTIFACT_INTEGRITY_ERROR", "规则快照 descriptor 摘要不一致")
        return dict(snapshot_ref)

    @staticmethod
    def _fsync_file(path: Path) -> None:
        with path.open("rb") as handle:
            os.fsync(handle.fileno())

    @staticmethod
    def _fsync_directory(path: Path) -> None:
        descriptor = os.open(path, os.O_RDONLY)
        try:
            os.fsync(descriptor)
        finally:
            os.close(descriptor)


class KeywordExtractorVersion:
    """Resolve new candidate evidence or isolate unverifiable legacy rows."""

    @classmethod
    def resolve(
        cls,
        *,
        candidate: Mapping[str, Any],
        candidate_run_id: str,
        run_root: Path,
        committed_snapshot_ref: Mapping[str, Any] | None,
    ) -> dict[str, Any]:
        is_new = str(candidate.get("schemaVersion") or "") == "2.0"
        if is_new:
            if not isinstance(candidate.get("extractorVersion"), str) or not isinstance(candidate.get("extractorSnapshotRef"), Mapping):
                raise ProductionLineageError("ARTIFACT_INTEGRITY_ERROR", "新 keyword candidate 缺少版本证据")
            if not isinstance(committed_snapshot_ref, Mapping) or dict(candidate["extractorSnapshotRef"]) != dict(committed_snapshot_ref):
                raise ProductionLineageError("ARTIFACT_INTEGRITY_ERROR", "新 candidate 的快照引用不匹配同 run 提交快照")
            verified = KeywordRuleSnapshot.verify(
                run_root=run_root,
                snapshot_ref=committed_snapshot_ref,
                expected_run_id=candidate_run_id,
            )
            if candidate["extractorVersion"] != verified["extractorVersion"]:
                raise ProductionLineageError("ARTIFACT_INTEGRITY_ERROR", "新 candidate 的 extractorVersion 不匹配")
            return {"status": "verified", "extractorVersion": verified["extractorVersion"], "snapshotRef": dict(verified)}
        try:
            if not isinstance(committed_snapshot_ref, Mapping):
                raise ProductionLineageError("ARTIFACT_INTEGRITY_ERROR", "没有同 run 规则快照")
            verified = KeywordRuleSnapshot.verify(
                run_root=run_root,
                snapshot_ref=committed_snapshot_ref,
                expected_run_id=candidate_run_id,
            )
        except ProductionLineageError:
            return {"status": "isolated", "reasonCode": "LEGACY_EXTRACTOR_VERSION_UNPROVEN"}
        return {"status": "verified", "extractorVersion": verified["extractorVersion"], "snapshotRef": dict(verified)}


@dataclass(frozen=True)
class RebuildExecutionContext:
    """Read-only rule execution identity supplied by the rebuild kernel."""

    rebuild_run_id: str
    candidate_version_id: str
    rebuild_key: str
    rule_snapshot_ref: Mapping[str, Any]
    model_allowed: bool = False

    @property
    def rebuildRunId(self) -> str:
        return self.rebuild_run_id

    @property
    def candidateVersionId(self) -> str:
        return self.candidate_version_id

    @property
    def rebuildKey(self) -> str:
        return self.rebuild_key

    @property
    def ruleSnapshotRef(self) -> Mapping[str, Any]:
        return self.rule_snapshot_ref

    @property
    def modelAllowed(self) -> bool:
        return self.model_allowed


@dataclass(frozen=True)
class CommittedRebuildInputRef:
    """Reference to an immutable request-time dataset capture."""

    dataset_id: str
    batch_id: str
    task_id: str
    input_digest: str
    capture_semantics: str
    manifest_path: str
    manifest_hash: str
    artifact_fingerprints: tuple[dict[str, Any], ...]

    def to_dict(self) -> dict[str, Any]:
        return {
            "datasetId": self.dataset_id,
            "batchId": self.batch_id,
            "taskId": self.task_id,
            "inputDigest": self.input_digest,
            "captureSemantics": self.capture_semantics,
            "manifestPath": self.manifest_path,
            "manifestHash": self.manifest_hash,
            "artifacts": [dict(item) for item in self.artifact_fingerprints],
        }

    def __getitem__(self, key: str) -> Any:
        return self.to_dict()[key]

    @property
    def inputDigest(self) -> str:
        return self.input_digest

    @property
    def datasetId(self) -> str:
        return self.dataset_id

    @property
    def batchId(self) -> str:
        return self.batch_id

    @property
    def taskId(self) -> str:
        return self.task_id

    @property
    def captureSemantics(self) -> str:
        return self.capture_semantics

    @property
    def manifestPath(self) -> str:
        return self.manifest_path


@dataclass(frozen=True)
class CommittedRebuildRecordStream:
    """Verified, deterministic record source for bounded rule execution."""

    dataset_id: str
    batch_id: str
    normalized_paths: Mapping[str, Path]
    processing_path: Path
    documents: Mapping[str, Mapping[str, Any]] = MappingProxyType({})

    def iter_batches(self, batch_size: int) -> Any:
        if type(batch_size) is not int or batch_size <= 0:
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "record batch size 必须是正整数"
            )
        batch: list[dict[str, Any]] = []
        current_resource: str | None = None
        current_units: list[dict[str, Any]] = []
        seen: set[str] = set()

        def record(resource_id: str, units: list[dict[str, Any]]) -> dict[str, Any]:
            normalized_path = self.normalized_paths.get(resource_id)
            if normalized_path is None or resource_id in seen or not units:
                raise ProductionLineageError(
                    "ARTIFACT_INTEGRITY_ERROR",
                    "rebuild-input processing resource 关联无效",
                    resourceId=resource_id,
                )
            seen.add(resource_id)
            try:
                normalized_text = normalized_path.read_text(encoding="utf-8")
            except (OSError, UnicodeDecodeError) as exc:
                raise ProductionLineageError(
                    "ARTIFACT_INTEGRITY_ERROR",
                    "rebuild-input normalized 不可读取",
                    resourceId=resource_id,
                ) from exc
            return {
                "datasetId": self.dataset_id,
                "batchId": self.batch_id,
                "resourceId": resource_id,
                "normalizedText": normalized_text,
                "processingUnits": units,
                "document": dict(self.documents.get(resource_id, {})),
            }

        try:
            with self.processing_path.open("r", encoding="utf-8") as handle:
                for line_number, line in enumerate(handle, start=1):
                    if not line.strip():
                        continue
                    item = json.loads(line)
                    if not isinstance(item, Mapping) or not item.get("resourceId"):
                        raise ValueError(f"invalid processing record at line {line_number}")
                    resource_id = str(item["resourceId"])
                    if current_resource is not None and resource_id < current_resource:
                        raise ValueError("processing records are not canonically ordered")
                    if current_resource is not None and resource_id != current_resource:
                        batch.append(record(current_resource, current_units))
                        if len(batch) >= batch_size:
                            yield batch
                            batch = []
                        current_units = []
                    current_resource = resource_id
                    current_units.append(dict(item))
        except ProductionLineageError:
            raise
        except (OSError, UnicodeDecodeError, json.JSONDecodeError, ValueError) as exc:
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "rebuild-input processing-units 不可解析"
            ) from exc
        if current_resource is not None:
            batch.append(record(current_resource, current_units))
        if set(self.normalized_paths) != seen:
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "rebuild-input normalized/processing resource 集合不一致"
            )
        if batch:
            yield batch


class KeywordRebuildInputFreezer:
    """Capture a legacy candidate dataset without using its latest pointer.

    The capture is a new immutable package.  It is deliberately separate from
    the source dataset so a concurrent producer can never mutate the bytes
    after their hashes have been recorded.
    """

    _DIR = "rebuild-inputs"

    def __init__(self, *, repository: Any, store: Any, data_root: Path):
        self.repository = repository
        self.store = store
        self.data_root = Path(data_root).resolve()

    def freeze(
        self, dataset_ref: Mapping[str, Any], request_context: Mapping[str, Any]
    ) -> CommittedRebuildInputRef:
        if not isinstance(dataset_ref, Mapping) or not isinstance(request_context, Mapping):
            raise ProductionLineageError("DATASET_INPUT_INVALID", "dataset 请求上下文无效")
        dataset_id = self._required_id(dataset_ref, "datasetId")
        batch_id = self._required_id(dataset_ref, "batchId")
        task_id = self._required_id(dataset_ref, "taskId")
        for key, expected in (("datasetId", dataset_id), ("batchId", batch_id), ("taskId", task_id)):
            if request_context.get(key) not in (None, expected):
                raise ProductionLineageError("DATASET_IDENTITY_MISMATCH", f"请求 {key} 与 dataset 不一致")

        dataset = self.store.get_record("datasets", dataset_id)
        batch = self.store.get_record("batches", batch_id)
        task = self.store.get_record("tasks", task_id)
        if not isinstance(dataset, Mapping) or not isinstance(batch, Mapping) or not isinstance(task, Mapping):
            raise ProductionLineageError("DATASET_IDENTITY_MISMATCH", "dataset/batch/task 记录不存在")
        if (dataset.get("id") != dataset_id or dataset.get("batchId") != batch_id
                or dataset.get("trainingTaskId") != task_id or dataset.get("state") != "candidate"):
            raise ProductionLineageError("DATASET_IDENTITY_MISMATCH", "dataset 身份或状态不一致")
        active_ids = set(batch.get("activeTaskIds") or batch.get("active_task_ids") or [])
        request_id = request_context.get("requestId")
        batch_state_allowed = batch.get("state") in {"downloaded", "completed"}
        batch_state_allowed = batch_state_allowed or (
            batch.get("state") == "processing" and request_id in active_ids
        )
        if batch.get("id") != batch_id or not batch_state_allowed:
            raise ProductionLineageError("DATASET_IDENTITY_MISMATCH", "batch 身份或状态不一致")
        if (task.get("id") != task_id or task.get("batchId") != batch_id
                or task.get("type") not in {KEYWORD_MODE, "graph"} or task.get("state") != "completed"):
            raise ProductionLineageError("DATASET_IDENTITY_MISMATCH", "task 身份、类型或状态不一致")
        root = self._dataset_root(dataset_ref, dataset_id)
        manifest_ref = dataset_ref.get("manifestPath", "manifest.json")
        manifest_base = self.data_root if isinstance(manifest_ref, str) and manifest_ref.startswith(str(dataset_ref.get("rootPath", "")).rstrip("/") + "/") else root
        manifest_path = self._safe_file(manifest_base, manifest_ref, self.data_root if manifest_base == self.data_root else root)
        manifest = self._read_json(manifest_path, "dataset manifest")
        current_manifest = str(manifest.get("schemaVersion") or "").startswith("2.")
        manifest_mode = manifest.get("mode") or manifest.get("knowledgeBuildMode")
        if (
            not (manifest.get("schemaVersion") == "dataset-manifest/v1" or current_manifest)
            or manifest.get("datasetId") != dataset_id
            or manifest.get("batchId") != batch_id
            or manifest.get("taskId") != task_id
            or manifest.get("state") != "candidate"
            or manifest_mode != KEYWORD_MODE
        ):
            raise ProductionLineageError("DATASET_IDENTITY_MISMATCH", "manifest 身份、类型或状态不一致")

        artifacts = manifest.get("artifacts")
        if current_manifest and not isinstance(artifacts, Mapping):
            artifacts = None
        if not current_manifest and not isinstance(artifacts, Mapping):
            raise ProductionLineageError("DATASET_INPUT_INVALID", "manifest artifacts 无效")
        artifact_map: dict[str, dict[str, Any]] = {}
        for name in ("documents.jsonl", "processing-units.jsonl"):
            descriptor = artifacts.get(name) if isinstance(artifacts, Mapping) else None
            if current_manifest:
                descriptor = {"path": name}
            if not isinstance(descriptor, Mapping) or descriptor.get("path") != name:
                raise ProductionLineageError("DATASET_INPUT_INVALID", f"manifest 缺少 {name}")
            path = self._safe_file(root, name, root)
            if not current_manifest:
                self._verify_descriptor(path, descriptor, name)
            artifact_map[name] = {"path": name, "sha256": self._digest(path), "bytes": path.stat().st_size}
        documents = self._read_jsonl(root / "documents.jsonl", "documents")
        units = self._read_jsonl(root / "processing-units.jsonl", "processing-units")
        if current_manifest:
            sources = [
                {
                    "resourceId": str(document.get("resourceId") or ""),
                    "sourcePath": document.get("sourcePath"),
                    "normalizedPath": f"normalized/{document.get('resourceId')}.md",
                    "normalizedHash": "",
                    "originalHash": "",
                    "processingStatus": "completed",
                }
                for document in documents
            ]
            source_bytes = "".join(
                json.dumps(item, ensure_ascii=False, sort_keys=True) + "\n"
                for item in sorted(sources, key=lambda item: str(item.get("resourceId") or ""))
            ).encode("utf-8")
            artifact_map["source-documents.jsonl"] = {
                "path": "source-documents.jsonl",
                "sha256": "sha256:" + hashlib.sha256(source_bytes).hexdigest(),
                "bytes": len(source_bytes),
                "synthetic": True,
            }
        else:
            sources = self._read_jsonl(root / "source-documents.jsonl", "source-documents")
        if current_manifest:
            manifest = dict(manifest)
            manifest["normalized"] = [
                {
                    "resourceId": str(document.get("resourceId") or ""),
                    "path": f"normalized/{document.get('resourceId')}.md",
                }
                for document in documents
            ]
        source_by_id = self._source_facts(manifest, sources, root)
        normalized = manifest.get("normalized")
        if not isinstance(normalized, list):
            raise ProductionLineageError("DATASET_INPUT_INVALID", "manifest normalized 无效")
        normalized_by_id: dict[str, tuple[Path, dict[str, Any]]] = {}
        for descriptor in normalized:
            if not isinstance(descriptor, Mapping) or not descriptor.get("resourceId"):
                raise ProductionLineageError("DATASET_INPUT_INVALID", "normalized 条目无效")
            resource_id = str(descriptor["resourceId"])
            path = self._safe_file(root, descriptor.get("path"), root)
            normalized_descriptor = dict(descriptor)
            if current_manifest:
                normalized_descriptor.update({
                    "sha256": self._digest(path),
                    "bytes": path.stat().st_size,
                })
            else:
                self._verify_descriptor(path, normalized_descriptor, str(descriptor.get("path")))
            normalized_by_id[resource_id] = (path, normalized_descriptor)
        if set(source_by_id) != set(normalized_by_id):
            raise ProductionLineageError("DATASET_INPUT_INVALID", "source 与 normalized resource 关联不完整")
        if current_manifest:
            for resource_id, fact in source_by_id.items():
                fact["normalizedHash"] = normalized_by_id[resource_id][1]["sha256"]
        self._validate_documents(documents, source_by_id)
        self._validate_units(units, normalized_by_id)

        facts = {"datasetId": dataset_id, "batchId": batch_id, "taskId": task_id,
                 "manifest": {"sha256": self._digest(manifest_path), "bytes": manifest_path.stat().st_size},
                 "artifacts": sorted(artifact_map.values(), key=lambda x: x["path"]),
                 "normalized": sorted(({"resourceId": rid, "path": d["path"], "sha256": self._digest(p), "bytes": p.stat().st_size}
                                       for rid, (p, d) in normalized_by_id.items()), key=lambda x: x["resourceId"]),
                 "sources": sorted(source_by_id.values(), key=lambda x: x["resourceId"]),
                 "documents": sorted(documents, key=lambda x: self._canonical(x)),
                 "processingUnits": sorted(units, key=lambda x: self._canonical(x))}
        input_digest = "sha256:" + hashlib.sha256(self._canonical(facts)).hexdigest()
        return self._commit(root, dataset_id, batch_id, task_id, input_digest, facts, manifest_path)

    @staticmethod
    def _canonical(value: Any) -> bytes:
        return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8")

    @staticmethod
    def _required_id(value: Mapping[str, Any], key: str) -> str:
        result = value.get(key)
        if not isinstance(result, str) or not result:
            raise ProductionLineageError("DATASET_INPUT_INVALID", f"缺少 {key}")
        return result

    def _dataset_root(self, ref: Mapping[str, Any], dataset_id: str) -> Path:
        relative = ref.get("rootPath") or f"datasets/{dataset_id}"
        return self._safe_file(self.data_root, relative, self.data_root, directory=True)

    @staticmethod
    def _safe_file(root: Path, relative: Any, containment: Path, *, directory: bool = False) -> Path:
        if not isinstance(relative, str) or not relative or Path(relative).is_absolute():
            raise ProductionLineageError("DATASET_PATH_INVALID", "产物路径必须是非空相对路径", artifactPath=relative)
        try:
            root_real = containment.resolve(strict=True)
            path = (root / relative).resolve(strict=True)
            path.relative_to(root_real)
        except (OSError, RuntimeError, ValueError) as exc:
            raise ProductionLineageError("DATASET_PATH_INVALID", "产物路径越界或不存在", artifactPath=relative) from exc
        current = root
        for part in Path(relative).parts:
            current /= part
            if current.is_symlink():
                raise ProductionLineageError("DATASET_PATH_INVALID", "产物路径不能包含符号链接", artifactPath=relative)
        if directory:
            if not path.is_dir():
                raise ProductionLineageError("DATASET_PATH_INVALID", "dataset 目录不存在")
        elif not path.is_file() or path.is_symlink():
            raise ProductionLineageError("DATASET_PATH_INVALID", "产物必须是普通文件", artifactPath=relative)
        return path

    @staticmethod
    def _digest(path: Path) -> str:
        return "sha256:" + hashlib.sha256(path.read_bytes()).hexdigest()

    def _read_json(self, path: Path, label: str) -> Mapping[str, Any]:
        try:
            value = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ProductionLineageError("DATASET_INPUT_INVALID", f"{label} 不可解析") from exc
        if not isinstance(value, Mapping):
            raise ProductionLineageError("DATASET_INPUT_INVALID", f"{label} 必须是对象")
        return value

    def _read_jsonl(self, path: Path, label: str) -> list[dict[str, Any]]:
        try:
            lines = path.read_text(encoding="utf-8").splitlines()
            values = [json.loads(line) for line in lines if line.strip()]
        except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ProductionLineageError("DATASET_INPUT_INVALID", f"{label} 不可解析") from exc
        if not values or any(not isinstance(item, Mapping) for item in values):
            raise ProductionLineageError("DATASET_INPUT_INVALID", f"{label} 为空或结构无效")
        return [dict(item) for item in values]

    def _verify_descriptor(self, path: Path, descriptor: Mapping[str, Any], label: str) -> None:
        expected = descriptor.get("sha256")
        if expected != self._digest(path) or (descriptor.get("bytes") is not None and descriptor.get("bytes") != path.stat().st_size):
            raise ProductionLineageError("DATASET_INPUT_DRIFT", f"{label} 摘要不匹配")

    def _source_facts(self, manifest: Mapping[str, Any], sources: list[dict[str, Any]], root: Path) -> dict[str, dict[str, Any]]:
        facts: dict[str, dict[str, Any]] = {}
        for source in sources:
            rid = str(source.get("resourceId") or "")
            if not rid or rid in facts or not isinstance(source.get("normalizedPath"), str):
                raise ProductionLineageError("DATASET_INPUT_INVALID", "source resource 关联无效")
            descriptor = next((item for item in manifest.get("normalized", [])
                               if isinstance(item, Mapping) and str(item.get("resourceId") or "") == rid), None)
            if not isinstance(descriptor, Mapping):
                raise ProductionLineageError("DATASET_INPUT_INVALID", "normalized descriptor 缺失", resourceId=rid)
            path = self._safe_file(root, descriptor.get("path"), root)
            if descriptor.get("sha256"):
                self._verify_descriptor(path, descriptor, str(descriptor.get("path")))
            if source.get("normalizedPath") != descriptor.get("path") or (
                source.get("normalizedHash") and source.get("normalizedHash") != descriptor.get("sha256")
            ):
                raise ProductionLineageError("DATASET_INPUT_DRIFT", "source normalized 摘要不一致", resourceId=rid)
            facts[rid] = {"resourceId": rid, "sourcePath": source.get("sourcePath"), "normalizedPath": descriptor.get("path"),
                          "normalizedHash": self._digest(path), "originalHash": source.get("originalHash"), "processingStatus": source.get("processingStatus")}
        return facts

    def _validate_documents(self, documents: list[dict[str, Any]], sources: Mapping[str, Any]) -> None:
        for item in documents:
            if str(item.get("resourceId") or "") not in sources:
                raise ProductionLineageError("DATASET_INPUT_INVALID", "document resource 关联无效")

    def _validate_units(self, units: list[dict[str, Any]], normalized: Mapping[str, tuple[Path, Mapping[str, Any]]]) -> None:
        seen: set[str] = set()
        for item in units:
            rid = str(item.get("resourceId") or "")
            if rid not in normalized or str(item.get("chunkId") or "") in seen:
                raise ProductionLineageError("DATASET_INPUT_INVALID", "processing unit resource/chunk 无效")
            seen.add(str(item.get("chunkId")))
            offset = item.get("offset") or item.get("normalizedOffsets")
            text = item.get("content")
            if not isinstance(offset, Mapping) or not isinstance(text, str):
                raise ProductionLineageError("DATASET_INPUT_INVALID", "processing unit 内容或 offset 无效")
            start, end = offset.get("start"), offset.get("end")
            source_text = normalized[rid][0].read_text(encoding="utf-8")
            if not isinstance(start, int) or not isinstance(end, int) or start < 0 or end < start or end > len(source_text) or source_text[start:end] != text:
                raise ProductionLineageError("DATASET_INPUT_DRIFT", "processing unit 与 normalized 不一致", resourceId=rid)
            overlap = item.get("overlap")
            if isinstance(overlap, Mapping) and str(overlap.get("sourceChunkId") or "").split(":", 1)[0] not in ("", rid):
                raise ProductionLineageError("DATASET_INPUT_INVALID", "processing unit 跨 resource overlap")

    def _commit(self, source_root: Path, dataset_id: str, batch_id: str, task_id: str, digest: str, facts: Mapping[str, Any], source_manifest: Path) -> CommittedRebuildInputRef:
        root = self.data_root / self._DIR
        root.mkdir(parents=True, exist_ok=True)
        final = root / digest.removeprefix("sha256:")
        if final.exists():
            try:
                existing = self._read_json(final / "manifest.json", "冻结 manifest")
                if existing.get("inputDigest") == digest:
                    manifest_path = final / "manifest.json"
                    return CommittedRebuildInputRef(
                        dataset_id,
                        batch_id,
                        task_id,
                        digest,
                        "request_time_snapshot",
                        str(manifest_path.relative_to(self.data_root)),
                        self._digest(manifest_path),
                        tuple(existing.get("artifacts", [])),
                    )
            except ProductionLineageError:
                pass
            raise ProductionLineageError("DATASET_INPUT_CONFLICT", "相同 inputDigest 的冻结包已存在但内容不一致")
        staging = Path(tempfile.mkdtemp(prefix=f".{digest.removeprefix('sha256:')[:16]}-", dir=root))
        try:
            copied: list[dict[str, Any]] = []
            for descriptor in facts["artifacts"] + facts["normalized"]:
                relative = str(descriptor["path"])
                target = staging / "artifacts" / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                if descriptor.get("synthetic") and relative == "source-documents.jsonl":
                    payload = b"".join(
                        self._canonical(item) + b"\n"
                        for item in sorted(
                            facts["sources"],
                            key=lambda item: str(item.get("resourceId") or ""),
                        )
                    )
                    target.write_bytes(payload)
                else:
                    source = self._safe_file(source_root, relative, source_root)
                    if relative == "processing-units.jsonl":
                        payload = b"".join(
                            self._canonical(item) + b"\n"
                            for item in sorted(
                                facts["processingUnits"],
                                key=lambda item: (
                                    str(item.get("resourceId") or ""),
                                    int(item.get("chunkIndex") or 0),
                                    str(item.get("chunkId") or ""),
                                ),
                            )
                        )
                        target.write_bytes(payload)
                    else:
                        shutil.copyfile(source, target)
                copied.append({
                    **descriptor,
                    "path": f"artifacts/{relative}",
                    "sha256": self._digest(target),
                    "bytes": target.stat().st_size,
                })
            manifest = {"schemaVersion": "rebuild-input/v1", "captureSemantics": "request_time_snapshot", "datasetId": dataset_id, "batchId": batch_id, "taskId": task_id, "inputDigest": digest, "sourceManifestHash": self._digest(source_manifest), "artifacts": copied, "facts": facts}
            (staging / "manifest.json").write_bytes(self._canonical(manifest))
            manifest_hash = self._digest(staging / "manifest.json")
            (staging / "commit.json").write_bytes(self._canonical({"schemaVersion": "rebuild-input-commit/v1", "datasetId": dataset_id, "batchId": batch_id, "taskId": task_id, "inputDigest": digest, "manifestPath": "manifest.json", "manifestHash": manifest_hash}))
            os.replace(staging, final)
        except Exception:
            shutil.rmtree(staging, ignore_errors=True)
            raise
        manifest_rel = str((final / "manifest.json").relative_to(self.data_root))
        return CommittedRebuildInputRef(dataset_id, batch_id, task_id, digest, "request_time_snapshot", manifest_rel, manifest_hash, tuple(copied))


@dataclass(frozen=True)
class KeywordRebuildResult:
    """Immutable result returned by the internal 2C keyword rebuild kernel."""

    rebuild_run_id: str
    candidate_version_id: str
    rebuild_key: str
    rebuild_of: dict[str, Any]
    source_snapshot_fingerprints: tuple[dict[str, Any], ...]
    rule_snapshot_ref: dict[str, Any]
    candidate_count: int
    isolated_count: int
    state: str
    result_fingerprint: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "rebuildRunId": self.rebuild_run_id,
            "candidateVersionId": self.candidate_version_id,
            "rebuildKey": self.rebuild_key,
            "rebuildOf": dict(self.rebuild_of),
            "sourceSnapshotFingerprints": [
                dict(item) for item in self.source_snapshot_fingerprints
            ],
            "ruleSnapshotRef": dict(self.rule_snapshot_ref),
            "candidateCount": self.candidate_count,
            "isolatedCount": self.isolated_count,
            "state": self.state,
            "resultFingerprint": self.result_fingerprint,
        }

    def __getitem__(self, key: str) -> Any:
        return self.to_dict()[key]

    # Keep the in-process result ergonomic for callers that use the JSON
    # contract names while retaining Pythonic storage fields internally.
    @property
    def rebuildRunId(self) -> str:
        return self.rebuild_run_id

    @property
    def candidateVersionId(self) -> str:
        return self.candidate_version_id

    @property
    def rebuildKey(self) -> str:
        return self.rebuild_key

    @property
    def rebuildOf(self) -> dict[str, Any]:
        return dict(self.rebuild_of)

    @property
    def sourceSnapshotFingerprints(self) -> tuple[dict[str, Any], ...]:
        return self.source_snapshot_fingerprints

    @property
    def ruleSnapshotRef(self) -> dict[str, Any]:
        return dict(self.rule_snapshot_ref)

    @property
    def candidateCount(self) -> int:
        return self.candidate_count

    @property
    def isolatedCount(self) -> int:
        return self.isolated_count

    @property
    def resultFingerprint(self) -> str:
        return self.result_fingerprint


class KeywordRuleRebuild:
    """Rebuild keyword candidates from verified immutable input snapshots.

    This is deliberately an internal kernel.  It owns only immutable snapshot
    validation, single-flight reservation, and atomic result publication; the
    public training route is wired separately behind the G-LIN-02-API gate.
    """

    _RESERVATION_DIR = ".keyword-rebuild-reservations"
    _RUNS_DIR = "training-runs"
    _POLL_INTERVAL = 0.02
    _TIMEOUT_SECONDS = 30.0
    _LEASE_SECONDS = 60.0

    def __init__(
        self,
        data_root: Path | None = None,
        *,
        fault_injector: Callable[[str, Path], None] | None = None,
    ):
        self.data_root = Path(data_root or settings.data_root).resolve()
        self.fault_injector = fault_injector

    @classmethod
    def execute(
        cls,
        frozen_source_refs: Sequence[Mapping[str, Any]] | CommittedRebuildInputRef | Mapping[str, Any],
        rule_descriptor: Mapping[str, Any],
        rebuild_of: Mapping[str, Any],
        extraction_executor: Callable[..., Mapping[str, Any]],
    ) -> KeywordRebuildResult:
        """Execute or reuse a deterministic rebuild for one semantic input key."""

        # Tests and internal callers may configure the data root through the
        # process settings.  Keep the public method class-based so it remains
        # easy to invoke from a maintenance worker without service state.
        return cls(data_root=settings.data_root)._execute(
            frozen_source_refs,
            rule_descriptor,
            rebuild_of,
            extraction_executor,
        )

    def _execute(
        self,
        frozen_source_refs: Sequence[Mapping[str, Any]] | CommittedRebuildInputRef | Mapping[str, Any],
        rule_descriptor: Mapping[str, Any],
        rebuild_of: Mapping[str, Any],
        extraction_executor: Callable[..., Mapping[str, Any]],
    ) -> KeywordRebuildResult:
        verified_inputs = self._verify_frozen_inputs(frozen_source_refs)
        descriptor = self._resolve_rule_descriptor(rule_descriptor)
        normalized_rebuild_of = self._normalize_rebuild_of(
            rebuild_of, verified_inputs
        )
        source_fingerprints = tuple(verified_inputs["fingerprints"])
        rebuild_key = self._rebuild_key(
            normalized_rebuild_of["inputDigest"], descriptor
        )
        run_id = f"rebuild_{rebuild_key.removeprefix('sha256:')[:24]}"
        candidate_version_id = f"candidate_{rebuild_key.removeprefix('sha256:')[:24]}"
        reservation, owner_token = self._reserve(
            rebuild_key, run_id, candidate_version_id
        )
        if reservation is not None:
            return reservation

        staging: Path | None = None
        try:
            staging = self._create_staging(run_id)
            rule_ref = KeywordRuleSnapshot.commit(
                run_root=staging,
                run_id=run_id,
                descriptor=descriptor,
                input_snapshot_fingerprints=source_fingerprints,
            )
            context = RebuildExecutionContext(
                rebuild_run_id=run_id,
                candidate_version_id=candidate_version_id,
                rebuild_key=rebuild_key,
                rule_snapshot_ref=MappingProxyType(dict(rule_ref)),
                model_allowed=False,
            )
            record_stream = verified_inputs.get("recordStream")
            execute_batch = getattr(extraction_executor, "execute_batch", None)
            if isinstance(record_stream, CommittedRebuildRecordStream) and callable(execute_batch):
                counts = self._execute_bounded_batches(
                    staging,
                    record_stream,
                    extraction_executor,
                    context,
                    rule_ref,
                )
                result_dict = self._stage_spooled_result(
                    staging,
                    run_id,
                    candidate_version_id,
                    rebuild_key,
                    normalized_rebuild_of,
                    source_fingerprints,
                    rule_ref,
                    counts,
                )
            else:
                records = verified_inputs.get("records")
                if records is None and isinstance(record_stream, CommittedRebuildRecordStream):
                    records = [
                        record
                        for batch in record_stream.iter_batches(128)
                        for record in batch
                    ]
                result = extraction_executor(records, context)
                normalized = self._validate_executor_result(result, rule_ref)
                result_dict = self._stage_result(
                    staging,
                    run_id,
                    candidate_version_id,
                    rebuild_key,
                    normalized_rebuild_of,
                    source_fingerprints,
                    rule_ref,
                    normalized,
                )
            self._inject("before_final_cas", staging)
            self._assert_owner(rebuild_key, owner_token)
            final = self.data_root / self._RUNS_DIR / run_id
            final.parent.mkdir(parents=True, exist_ok=True)
            if final.exists() or final.is_symlink():
                raise ProductionLineageError(
                    "ARTIFACT_INTEGRITY_ERROR", "重建 run 已存在且不可覆盖"
                )
            try:
                os.replace(staging, final)
            except OSError as exc:
                raise ProductionLineageError(
                    "ARTIFACT_INTEGRITY_ERROR", "重建结果原子提交失败"
                ) from exc
            staging = None
            self._fsync_directory(final.parent)
            result = self._result_from_dict(result_dict)
            self._complete(rebuild_key, result, owner_token)
            return result
        except Exception as exc:
            if staging is not None and staging.exists():
                shutil.rmtree(staging, ignore_errors=True)
            self._fail(rebuild_key, exc, owner_token)
            if isinstance(exc, ProductionLineageError):
                raise
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "关键词规则重建失败"
            ) from exc

    def _verify_frozen_inputs(
        self,
        refs: Sequence[Mapping[str, Any]] | CommittedRebuildInputRef | Mapping[str, Any],
    ) -> dict[str, Any]:
        if isinstance(refs, CommittedRebuildInputRef) or (
            isinstance(refs, Mapping)
            and refs.get("captureSemantics") == "request_time_snapshot"
            and isinstance(refs.get("manifestPath"), str)
        ):
            return self._verify_committed_rebuild_input(refs)
        if not isinstance(refs, Sequence) or isinstance(refs, (str, bytes)) or not refs:
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "冻结输入引用不能为空"
            )
        records: list[dict[str, Any]] = []
        fingerprints: list[dict[str, Any]] = []
        digest_facts: list[dict[str, Any]] = []
        dataset_id: str | None = None
        batch_id: str | None = None
        seen_resources: set[str] = set()
        for ref in refs:
            if not isinstance(ref, Mapping):
                raise ProductionLineageError(
                    "ARTIFACT_INTEGRITY_ERROR", "冻结输入引用必须是对象"
                )
            resource_id = str(ref.get("resourceId") or "")
            snapshot_ref = ref.get("snapshotRef")
            if not resource_id or not isinstance(snapshot_ref, Mapping):
                raise ProductionLineageError(
                    "ARTIFACT_INTEGRITY_ERROR", "冻结输入缺少 resourceId 或 snapshotRef"
                )
            if resource_id in seen_resources:
                raise ProductionLineageError(
                    "ARTIFACT_INTEGRITY_ERROR", "冻结输入 resourceId 重复", resourceId=resource_id
                )
            seen_resources.add(resource_id)
            manifest_path = self._safe_data_path(snapshot_ref.get("manifestPath"))
            if not isinstance(snapshot_ref.get("manifestHash"), str):
                raise ProductionLineageError(
                    "ARTIFACT_INTEGRITY_ERROR", "冻结输入 manifestHash 缺失", resourceId=resource_id
                )
            if self._digest(manifest_path) != snapshot_ref["manifestHash"]:
                raise ProductionLineageError(
                    "ARTIFACT_INTEGRITY_ERROR", "冻结输入 manifest 摘要不匹配", resourceId=resource_id
                )
            try:
                manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
                raise ProductionLineageError(
                    "ARTIFACT_INTEGRITY_ERROR", "冻结输入 manifest 不可解析", resourceId=resource_id
                ) from exc
            if not isinstance(manifest, Mapping):
                raise ProductionLineageError(
                    "ARTIFACT_INTEGRITY_ERROR", "冻结输入 manifest 结构无效", resourceId=resource_id
                )
            if manifest.get("runId") != snapshot_ref.get("runId"):
                raise ProductionLineageError(
                    "ARTIFACT_INTEGRITY_ERROR", "冻结输入 manifest/runId 不一致", resourceId=resource_id
                )
            current_batch = str(manifest.get("batchId") or "")
            if not current_batch:
                raise ProductionLineageError(
                    "ARTIFACT_INTEGRITY_ERROR", "冻结输入 manifest 缺少 batchId", resourceId=resource_id
                )
            commit_path = self._safe_child(manifest_path.parent, "commit.json")
            try:
                commit = json.loads(commit_path.read_text(encoding="utf-8"))
            except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
                raise ProductionLineageError(
                    "ARTIFACT_INTEGRITY_ERROR", "冻结输入 commit 不可解析", resourceId=resource_id
                ) from exc
            if (
                not isinstance(commit, Mapping)
                or commit.get("runId") != snapshot_ref.get("runId")
                or commit.get("batchId") != current_batch
                or commit.get("manifestPath") != "manifest.json"
                or commit.get("manifestHash") != snapshot_ref.get("manifestHash")
            ):
                raise ProductionLineageError(
                    "ARTIFACT_INTEGRITY_ERROR", "冻结输入 commit/manifest 不一致", resourceId=resource_id
                )
            if batch_id is None:
                batch_id = current_batch
            elif batch_id != current_batch:
                raise ProductionLineageError(
                    "ARTIFACT_INTEGRITY_ERROR", "冻结输入跨 batch", resourceId=resource_id
                )
            current_dataset = str(ref.get("datasetId") or "")
            if dataset_id is None:
                dataset_id = current_dataset or None
            elif current_dataset and dataset_id != current_dataset:
                raise ProductionLineageError(
                    "ARTIFACT_INTEGRITY_ERROR", "冻结输入跨 dataset", resourceId=resource_id
                )
            descriptors = {
                str(item.get("path")): item
                for item in manifest.get("artifacts", [])
                if isinstance(item, Mapping) and isinstance(item.get("path"), str)
            }
            normalized_rel = ref.get("normalizedArtifactPath")
            processing_rel = ref.get("processingUnitsArtifactPath")
            if not isinstance(normalized_rel, str) or not isinstance(processing_rel, str):
                raise ProductionLineageError(
                    "ARTIFACT_INTEGRITY_ERROR", "冻结输入缺少 normalized/processing-units 路径", resourceId=resource_id
                )
            for relative in (normalized_rel, processing_rel):
                descriptor = descriptors.get(relative)
                if not isinstance(descriptor, Mapping):
                    raise ProductionLineageError(
                        "ARTIFACT_INTEGRITY_ERROR", "冻结输入 artifact 未列入 manifest", resourceId=resource_id, artifactPath=relative
                    )
                path = self._safe_child(manifest_path.parent, relative)
                expected = descriptor.get("sha256")
                actual = self._digest(path)
                if actual != expected:
                    raise ProductionLineageError(
                        "ARTIFACT_INTEGRITY_ERROR", "冻结输入 artifact 摘要不匹配", resourceId=resource_id, artifactPath=relative
                    )
                fingerprints.append({
                    "datasetId": dataset_id,
                    "batchId": batch_id,
                    "resourceId": resource_id,
                    "path": relative,
                    "sha256": actual,
                    "bytes": path.stat().st_size,
                })
            normalized_path = self._safe_child(manifest_path.parent, normalized_rel)
            processing_path = self._safe_child(manifest_path.parent, processing_rel)
            normalized_digest = self._digest(normalized_path)
            normalized_bytes = normalized_path.stat().st_size
            declared_digest = str(ref.get("normalizedHash") or "")
            declared_bytes = ref.get("normalizedBytes")
            if declared_digest and declared_digest != normalized_digest:
                raise ProductionLineageError(
                    "ARTIFACT_INTEGRITY_ERROR", "冻结输入 normalizedHash 不匹配", resourceId=resource_id
                )
            if declared_bytes is not None and declared_bytes != normalized_bytes:
                raise ProductionLineageError(
                    "ARTIFACT_INTEGRITY_ERROR", "冻结输入 normalizedBytes 不匹配", resourceId=resource_id
                )
            digest_facts.append({
                "datasetId": dataset_id,
                "resourceId": resource_id,
                "normalizedHash": normalized_digest,
                "normalizedBytes": normalized_bytes,
            })
            try:
                normalized_text = normalized_path.read_text(encoding="utf-8")
                processing_records = [
                    json.loads(line)
                    for line in processing_path.read_text(encoding="utf-8").splitlines()
                    if line.strip()
                ]
            except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
                raise ProductionLineageError(
                    "ARTIFACT_INTEGRITY_ERROR", "冻结 processing-units 不可解析", resourceId=resource_id
                ) from exc
            if not normalized_text or not processing_records or any(
                not isinstance(item, Mapping) for item in processing_records
            ):
                raise ProductionLineageError(
                    "ARTIFACT_INTEGRITY_ERROR", "冻结输入记录为空或结构无效", resourceId=resource_id
                )
            records.append({
                "datasetId": dataset_id,
                "batchId": batch_id,
                "resourceId": resource_id,
                "normalizedText": normalized_text,
                "processingUnits": processing_records,
            })
        fingerprints.sort(key=lambda item: (str(item["resourceId"]), str(item["path"])))
        digest_facts.sort(key=lambda item: str(item["resourceId"]))
        records.sort(key=lambda item: str(item["resourceId"]))
        input_digest = "sha256:" + hashlib.sha256(self._canonical(digest_facts)).hexdigest()
        return {
            "datasetId": dataset_id,
            "batchId": batch_id,
            "records": records,
            "fingerprints": fingerprints,
            "inputDigest": input_digest,
        }

    def _verify_committed_rebuild_input(
        self,
        ref: CommittedRebuildInputRef | Mapping[str, Any],
    ) -> dict[str, Any]:
        """Verify and materialize the first-class request-time freeze contract."""
        def value(name: str) -> Any:
            if isinstance(ref, Mapping):
                return ref.get(name)
            return getattr(ref, name, None)

        dataset_id = value("datasetId") or value("dataset_id")
        batch_id = value("batchId") or value("batch_id")
        task_id = value("taskId") or value("task_id")
        input_digest = value("inputDigest") or value("input_digest")
        manifest_rel = value("manifestPath") or value("manifest_path")
        manifest_hash = value("manifestHash") or value("manifest_hash")
        if not all(isinstance(item, str) and item for item in (dataset_id, batch_id, task_id, input_digest, manifest_rel, manifest_hash)):
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "rebuild-input 引用字段不完整"
            )
        if value("captureSemantics") != "request_time_snapshot":
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "rebuild-input 快照语义无效"
            )
        manifest_path = self._safe_data_path(manifest_rel)
        if self._digest(manifest_path) != manifest_hash:
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "rebuild-input manifest 摘要不匹配"
            )
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            commit = json.loads(
                self._safe_child(manifest_path.parent, "commit.json").read_text(
                    encoding="utf-8"
                )
            )
        except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "rebuild-input commit/manifest 不可解析"
            ) from exc
        if not isinstance(manifest, Mapping) or not isinstance(commit, Mapping):
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "rebuild-input commit/manifest 结构无效"
            )
        expected_identity = {
            "datasetId": dataset_id,
            "batchId": batch_id,
            "taskId": task_id,
            "inputDigest": input_digest,
        }
        if (
            manifest.get("schemaVersion") != "rebuild-input/v1"
            or manifest.get("captureSemantics") != "request_time_snapshot"
            or any(manifest.get(key) != value for key, value in expected_identity.items())
            or commit.get("schemaVersion") != "rebuild-input-commit/v1"
            or any(commit.get(key) != value for key, value in expected_identity.items())
            or commit.get("manifestPath") != "manifest.json"
            or commit.get("manifestHash") != manifest_hash
        ):
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "rebuild-input 身份或 commit 绑定不一致"
            )
        facts = manifest.get("facts")
        artifacts = manifest.get("artifacts")
        if not isinstance(facts, Mapping) or not isinstance(artifacts, list):
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "rebuild-input facts/artifacts 无效"
            )
        facts_digest = "sha256:" + hashlib.sha256(self._canonical(facts)).hexdigest()
        if facts_digest != input_digest:
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "rebuild-input inputDigest 重算不一致"
            )
        fingerprints: list[dict[str, Any]] = []
        normalized_by_resource: dict[str, tuple[Path, Mapping[str, Any]]] = {}
        processing_path: Path | None = None
        documents_path: Path | None = None
        for descriptor in artifacts:
            if not isinstance(descriptor, Mapping) or not isinstance(descriptor.get("path"), str):
                raise ProductionLineageError(
                    "ARTIFACT_INTEGRITY_ERROR", "rebuild-input artifact descriptor 无效"
                )
            path = self._safe_child(manifest_path.parent, descriptor["path"])
            if self._digest(path) != descriptor.get("sha256") or (
                descriptor.get("bytes") is not None
                and path.stat().st_size != descriptor.get("bytes")
            ):
                raise ProductionLineageError(
                    "ARTIFACT_INTEGRITY_ERROR", "rebuild-input artifact 摘要不匹配", artifactPath=descriptor["path"]
                )
            fingerprints.append({
                "datasetId": dataset_id,
                "batchId": batch_id,
                "resourceId": descriptor.get("resourceId"),
                "path": descriptor["path"],
                "sha256": descriptor["sha256"],
                "bytes": path.stat().st_size,
            })
            if descriptor.get("resourceId"):
                normalized_by_resource[str(descriptor["resourceId"])] = (path, descriptor)
            elif Path(descriptor["path"]).name == "processing-units.jsonl":
                processing_path = path
            elif Path(descriptor["path"]).name == "documents.jsonl":
                documents_path = path
        if not normalized_by_resource or processing_path is None:
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "rebuild-input 缺少 normalized 或 processing-units artifact"
            )
        documents: dict[str, Mapping[str, Any]] = {}
        if documents_path is not None:
            try:
                with documents_path.open("r", encoding="utf-8") as handle:
                    for line in handle:
                        if not line.strip():
                            continue
                        document = json.loads(line)
                        if isinstance(document, Mapping) and document.get("resourceId"):
                            documents[str(document["resourceId"])] = dict(document)
            except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
                raise ProductionLineageError(
                    "ARTIFACT_INTEGRITY_ERROR", "rebuild-input documents 不可解析"
                ) from exc
        record_stream = CommittedRebuildRecordStream(
            dataset_id=dataset_id,
            batch_id=batch_id,
            normalized_paths=MappingProxyType({
                resource_id: value[0]
                for resource_id, value in normalized_by_resource.items()
            }),
            processing_path=processing_path,
            documents=MappingProxyType(documents),
        )
        return {
            "datasetId": dataset_id,
            "batchId": batch_id,
            "records": None,
            "recordStream": record_stream,
            "fingerprints": sorted(fingerprints, key=lambda item: (str(item.get("resourceId") or ""), str(item["path"]))),
            "inputDigest": input_digest,
        }

    def _resolve_rule_descriptor(self, value: Mapping[str, Any]) -> dict[str, Any]:
        if not isinstance(value, Mapping):
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "规则 descriptor 必须是对象"
            )
        if isinstance(value.get("producerName"), str):
            descriptor = KeywordRuleSnapshot._semantic_descriptor(value)
        else:
            run_id = value.get("runId")
            if not isinstance(run_id, str) or not run_id:
                raise ProductionLineageError(
                    "ARTIFACT_INTEGRITY_ERROR", "规则 descriptor 或快照引用无效"
                )
            run_root = self.data_root / self._RUNS_DIR / run_id
            verified = KeywordRuleSnapshot.verify(
                run_root=run_root,
                snapshot_ref=value,
                expected_run_id=run_id,
            )
            artifact = KeywordRuleSnapshot._safe_path(
                run_root, verified["artifactPath"]
            )
            try:
                artifact_value = json.loads(artifact.read_text(encoding="utf-8"))
            except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
                raise ProductionLineageError(
                    "ARTIFACT_INTEGRITY_ERROR", "外部规则快照 descriptor 不可解析"
                ) from exc
            descriptor = KeywordRuleSnapshot._semantic_descriptor(
                artifact_value.get("descriptor")
            )
        if descriptor.get("mode") != KEYWORD_MODE:
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "规则 descriptor mode 不是 keyword_analysis"
            )
        KeywordRuleSnapshot.extractor_version(descriptor)
        return descriptor

    @staticmethod
    def _normalize_rebuild_of(
        value: Mapping[str, Any], verified_inputs: Mapping[str, Any]
    ) -> dict[str, Any]:
        if not isinstance(value, Mapping):
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "rebuildOf 必须是对象"
            )
        required = ("datasetId", "taskId", "inputDigest")
        if all(isinstance(value.get(field), str) and value[field] for field in required):
            normalized = {field: str(value[field]) for field in required}
            if normalized["datasetId"] != verified_inputs.get("datasetId"):
                raise ProductionLineageError(
                    "ARTIFACT_INTEGRITY_ERROR", "rebuildOf datasetId 与冻结输入不一致"
                )
            if normalized["inputDigest"] != verified_inputs.get("inputDigest"):
                raise ProductionLineageError(
                    "ARTIFACT_INTEGRITY_ERROR", "rebuildOf inputDigest 与冻结输入不一致"
                )
            return normalized
        # Temporary internal compatibility for pre-API fixtures.  It preserves
        # their trace fields, while the final rule evidence is still recommitted
        # into the rebuild run and can never point at the external rule run.
        if isinstance(value.get("runId"), str) and value.get("runId"):
            return {
                "datasetId": str(verified_inputs.get("datasetId") or ""),
                "taskId": str(value["runId"]),
                "inputDigest": str(verified_inputs["inputDigest"]),
                "legacyRunId": str(value["runId"]),
                "legacyCandidateVersionId": str(value.get("candidateVersionId") or ""),
                "reason": "extractor_version_unproven",
            }
        raise ProductionLineageError(
            "ARTIFACT_INTEGRITY_ERROR", "rebuildOf 缺少 datasetId/taskId/inputDigest"
        )

    @staticmethod
    def _rebuild_key(
        input_digest: str, descriptor: Mapping[str, Any]
    ) -> str:
        payload = {
            "mode": KEYWORD_MODE,
            "inputDigest": input_digest,
            "ruleDescriptorHash": "sha256:" + KeywordRuleSnapshot.extractor_version(descriptor).split(":", 2)[2],
        }
        canonical = json.dumps(
            payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False
        ).encode("utf-8")
        return "sha256:" + hashlib.sha256(canonical).hexdigest()

    def _reserve(
        self, rebuild_key: str, run_id: str, candidate_version_id: str
    ) -> tuple[KeywordRebuildResult | None, str]:
        root = self.data_root / self._RESERVATION_DIR
        root.mkdir(parents=True, exist_ok=True)
        state_path = root / f"{rebuild_key.removeprefix('sha256:')}.json"
        lock_path = root / f"{rebuild_key.removeprefix('sha256:')}.lock"
        deadline = time.monotonic() + self._TIMEOUT_SECONDS
        while True:
            with lock_path.open("a+b") as handle:
                fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
                current = self._read_state(state_path)
                if isinstance(current, Mapping) and current.get("state") == "completed":
                    return self._verify_result(current.get("result")), ""
                if isinstance(current, Mapping) and current.get("state") == "running":
                    adopted = self._adopt_final(current)
                    if adopted is not None:
                        self._write_completed_state(state_path, rebuild_key, adopted)
                        return adopted, ""
                now = time.time()
                lease_expires = float(current.get("leaseExpiresAt") or 0) if isinstance(current, Mapping) else 0
                claimable = (
                    not isinstance(current, Mapping)
                    or current.get("state") == "failed"
                    or (current.get("state") == "running" and lease_expires <= now)
                )
                if claimable:
                    owner_token = uuid.uuid4().hex
                    takeover_count = int(current.get("takeoverCount") or 0) if isinstance(current, Mapping) else 0
                    if isinstance(current, Mapping) and current.get("state") == "running":
                        takeover_count += 1
                    self._write_state(state_path, {
                        "schemaVersion": "keyword-rebuild-reservation/v1",
                        "state": "running",
                        "rebuildKey": rebuild_key,
                        "rebuildRunId": run_id,
                        "candidateVersionId": candidate_version_id,
                        "ownerToken": owner_token,
                        "startedAt": now,
                        "heartbeatAt": now,
                        "updatedAt": now,
                        "leaseExpiresAt": now + self._LEASE_SECONDS,
                        "takeoverCount": takeover_count,
                    })
                    return None, owner_token
            if time.monotonic() >= deadline:
                break
            time.sleep(self._POLL_INTERVAL)
        raise ProductionLineageError(
            "ARTIFACT_INTEGRITY_ERROR", "等待相同 rebuildKey 的执行超时", rebuildKey=rebuild_key
        )

    def _complete(
        self, rebuild_key: str, result: KeywordRebuildResult, owner_token: str
    ) -> None:
        state_path, lock_path = self._reservation_paths(rebuild_key)
        with lock_path.open("a+b") as handle:
            fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
            current = self._read_state(state_path)
            if isinstance(current, Mapping) and current.get("state") == "completed":
                adopted = self._verify_result(current.get("result"))
                if adopted.result_fingerprint == result.result_fingerprint:
                    return
                raise ProductionLineageError(
                    "ARTIFACT_INTEGRITY_ERROR", "重建 reservation 已完成但结果不一致"
                )
            if not isinstance(current, Mapping) or current.get("ownerToken") != owner_token:
                raise ProductionLineageError(
                    "ARTIFACT_INTEGRITY_ERROR", "重建 reservation owner 已变化"
                )
            self._write_completed_state(state_path, rebuild_key, result)

    def _assert_owner(self, rebuild_key: str, owner_token: str) -> None:
        state_path, lock_path = self._reservation_paths(rebuild_key)
        with lock_path.open("a+b") as handle:
            fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
            current = self._read_state(state_path)
            if (
                not isinstance(current, Mapping)
                or current.get("state") != "running"
                or current.get("ownerToken") != owner_token
            ):
                raise ProductionLineageError(
                    "ARTIFACT_INTEGRITY_ERROR", "重建 reservation lease 已被接管"
                )

    def _fail(self, rebuild_key: str, error: BaseException, owner_token: str) -> None:
        try:
            state_path, lock_path = self._reservation_paths(rebuild_key)
            with lock_path.open("a+b") as handle:
                fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
                current = self._read_state(state_path) or {}
                if current.get("ownerToken") != owner_token:
                    return
                self._write_state(state_path, {
                    **dict(current),
                    "state": "failed",
                    "updatedAt": time.time(),
                    "error": {"type": type(error).__name__, "message": str(error)},
                })
        except OSError:
            # Preserve the original classified error; reservation cleanup is
            # best effort and never touches a legacy artifact.
            return

    def _adopt_final(self, reservation: Mapping[str, Any]) -> KeywordRebuildResult | None:
        run_id = str(reservation.get("rebuildRunId") or "")
        if not run_id:
            return None
        result_path = self.data_root / self._RUNS_DIR / run_id / "result.json"
        if not result_path.is_file() or result_path.is_symlink():
            return None
        try:
            stored = json.loads(result_path.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "rename 后的重建结果不可解析"
            ) from exc
        result = self._verify_result(stored)
        if result.rebuild_key != reservation.get("rebuildKey"):
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "rename 后结果与 reservation key 不一致"
            )
        return result

    @staticmethod
    def _write_completed_state(
        state_path: Path, rebuild_key: str, result: KeywordRebuildResult
    ) -> None:
        KeywordRuleRebuild._write_state(state_path, {
            "schemaVersion": "keyword-rebuild-reservation/v1",
            "state": "completed",
            "rebuildKey": rebuild_key,
            "updatedAt": time.time(),
            "result": result.to_dict(),
        })

    def _create_staging(self, run_id: str) -> Path:
        runs_root = self.data_root / self._RUNS_DIR
        runs_root.mkdir(parents=True, exist_ok=True)
        return Path(tempfile.mkdtemp(prefix=f".{run_id}-", dir=runs_root))

    def _stage_result(
        self,
        staging: Path,
        run_id: str,
        candidate_version_id: str,
        rebuild_key: str,
        rebuild_of: Mapping[str, Any],
        fingerprints: Sequence[Mapping[str, Any]],
        rule_ref: Mapping[str, Any],
        normalized: Mapping[str, Any],
    ) -> dict[str, Any]:
        candidates = list(normalized["candidates"])
        isolated = list(normalized["isolated"])
        self._write_jsonl(staging / "extraction-results/keyword-candidates.jsonl", candidates)
        self._write_jsonl(staging / "quality/isolated-records.jsonl", isolated)
        manifest = {
            "schemaVersion": "keyword-rebuild/v1",
            "state": "completed",
            "rebuildRunId": run_id,
            "candidateVersionId": candidate_version_id,
            "rebuildKey": rebuild_key,
            "rebuildOf": dict(rebuild_of),
            "sourceSnapshotFingerprints": [dict(item) for item in fingerprints],
            "ruleSnapshotRef": dict(rule_ref),
            "candidateCount": len(candidates),
            "isolatedCount": len(isolated),
            "modelCallCount": 0,
            "modelStatus": "not_applicable",
        }
        candidates_path = staging / "extraction-results/keyword-candidates.jsonl"
        isolated_path = staging / "quality/isolated-records.jsonl"
        manifest["artifacts"] = {
            "candidates": {"path": "extraction-results/keyword-candidates.jsonl", "sha256": self._digest(candidates_path)},
            "isolated": {"path": "quality/isolated-records.jsonl", "sha256": self._digest(isolated_path)},
        }
        manifest_bytes = self._canonical(manifest)
        manifest_path = staging / "rebuild-manifest.json"
        manifest_path.parent.mkdir(parents=True, exist_ok=True)
        manifest_path.write_bytes(manifest_bytes)
        self._fsync_file(manifest_path)
        result_fingerprint = "sha256:" + hashlib.sha256(manifest_bytes).hexdigest()
        result_dict = {
            "rebuildRunId": run_id,
            "candidateVersionId": candidate_version_id,
            "rebuildKey": rebuild_key,
            "rebuildOf": dict(rebuild_of),
            "sourceSnapshotFingerprints": [dict(item) for item in fingerprints],
            "ruleSnapshotRef": dict(rule_ref),
            "candidateCount": len(candidates),
            "isolatedCount": len(isolated),
            "state": "completed",
            "resultFingerprint": result_fingerprint,
        }
        self._write_json(staging / "result.json", result_dict)
        self._fsync_directory(staging)
        return result_dict

    def _execute_bounded_batches(
        self,
        staging: Path,
        record_stream: CommittedRebuildRecordStream,
        extraction_executor: Any,
        context: RebuildExecutionContext,
        rule_ref: Mapping[str, Any],
    ) -> dict[str, int]:
        configured_size = getattr(extraction_executor, "batch_size", 128)
        if type(configured_size) is not int or not 0 < configured_size <= 512:
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "规则执行 batch_size 必须在 1..512"
            )
        candidates_path = staging / "extraction-results/keyword-candidates.jsonl"
        isolated_path = staging / "quality/isolated-records.jsonl"
        candidates_path.parent.mkdir(parents=True, exist_ok=True)
        isolated_path.parent.mkdir(parents=True, exist_ok=True)
        candidate_ids: set[str] = set()
        candidate_count = 0
        isolated_count = 0
        batch_count = 0
        max_batch_records = 0
        with candidates_path.open("xb") as candidates_file, isolated_path.open("xb") as isolated_file:
            for records in record_stream.iter_batches(configured_size):
                batch_count += 1
                max_batch_records = max(max_batch_records, len(records))
                normalized = self._validate_executor_result(
                    extraction_executor.execute_batch(records, context),
                    rule_ref,
                    candidate_ids,
                )
                for candidate in normalized["candidates"]:
                    candidates_file.write(
                        (json.dumps(candidate, ensure_ascii=False, sort_keys=True) + "\n").encode("utf-8")
                    )
                for isolated in normalized["isolated"]:
                    isolated_file.write(
                        (json.dumps(isolated, ensure_ascii=False, sort_keys=True) + "\n").encode("utf-8")
                    )
                candidate_count += len(normalized["candidates"])
                isolated_count += len(normalized["isolated"])
            candidates_file.flush()
            isolated_file.flush()
            os.fsync(candidates_file.fileno())
            os.fsync(isolated_file.fileno())
        return {
            "candidateCount": candidate_count,
            "isolatedCount": isolated_count,
            "batchCount": batch_count,
            "maxBatchRecords": max_batch_records,
        }

    def _stage_spooled_result(
        self,
        staging: Path,
        run_id: str,
        candidate_version_id: str,
        rebuild_key: str,
        rebuild_of: Mapping[str, Any],
        fingerprints: Sequence[Mapping[str, Any]],
        rule_ref: Mapping[str, Any],
        counts: Mapping[str, int],
    ) -> dict[str, Any]:
        candidates_path = staging / "extraction-results/keyword-candidates.jsonl"
        isolated_path = staging / "quality/isolated-records.jsonl"
        manifest = {
            "schemaVersion": "keyword-rebuild/v1",
            "state": "completed",
            "rebuildRunId": run_id,
            "candidateVersionId": candidate_version_id,
            "rebuildKey": rebuild_key,
            "rebuildOf": dict(rebuild_of),
            "sourceSnapshotFingerprints": [dict(item) for item in fingerprints],
            "ruleSnapshotRef": dict(rule_ref),
            "candidateCount": int(counts["candidateCount"]),
            "isolatedCount": int(counts["isolatedCount"]),
            "modelCallCount": 0,
            "modelStatus": "not_applicable",
            "artifacts": {
                "candidates": {
                    "path": "extraction-results/keyword-candidates.jsonl",
                    "sha256": self._digest(candidates_path),
                },
                "isolated": {
                    "path": "quality/isolated-records.jsonl",
                    "sha256": self._digest(isolated_path),
                },
            },
        }
        manifest_path = staging / "rebuild-manifest.json"
        manifest_path.write_bytes(self._canonical(manifest))
        self._fsync_file(manifest_path)
        result_fingerprint = "sha256:" + hashlib.sha256(self._canonical(manifest)).hexdigest()
        result_dict = {
            "rebuildRunId": run_id,
            "candidateVersionId": candidate_version_id,
            "rebuildKey": rebuild_key,
            "rebuildOf": dict(rebuild_of),
            "sourceSnapshotFingerprints": [dict(item) for item in fingerprints],
            "ruleSnapshotRef": dict(rule_ref),
            "candidateCount": int(counts["candidateCount"]),
            "isolatedCount": int(counts["isolatedCount"]),
            "state": "completed",
            "resultFingerprint": result_fingerprint,
        }
        self._write_json(staging / "result.json", result_dict)
        self._fsync_directory(staging)
        return result_dict

    def _validate_executor_result(
        self,
        result: Mapping[str, Any],
        rule_ref: Mapping[str, Any],
        candidate_ids: set[str] | None = None,
    ) -> dict[str, Any]:
        if not isinstance(result, Mapping):
            raise ProductionLineageError(
                "RULE_ONLY_CONTRACT_VIOLATION", "规则执行器返回值必须是对象"
            )
        model_calls = result.get("modelCallCount", result.get("modelCalls", 0))
        if isinstance(model_calls, Mapping):
            nonzero = any(int(value or 0) != 0 for value in model_calls.values())
        else:
            try:
                nonzero = int(model_calls or 0) != 0
            except (TypeError, ValueError):
                nonzero = True
        if nonzero or result.get("modelStatus") not in (None, "not_applicable"):
            raise ProductionLineageError(
                "RULE_ONLY_CONTRACT_VIOLATION", "规则重建路径发生模型调用"
            )
        candidates = result.get("candidates")
        if not isinstance(candidates, list):
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "规则执行器 candidates 必须是数组"
            )
        validated: list[dict[str, Any]] = []
        candidate_ids = candidate_ids if candidate_ids is not None else set()
        for candidate in candidates:
            if not isinstance(candidate, Mapping):
                raise ProductionLineageError(
                    "ARTIFACT_INTEGRITY_ERROR", "keyword candidate 必须是对象"
                )
            value = dict(candidate)
            if value.get("schemaVersion") != "2.0":
                raise ProductionLineageError(
                    "ARTIFACT_INTEGRITY_ERROR", "candidate 规则版本证据不匹配"
                )
            # The kernel, rather than an executor, is authoritative for rule
            # evidence.  Normalize legacy executor output to the snapshot
            # committed in this staging run; an external ref can therefore
            # never escape into the final candidate package.
            value["extractorVersion"] = rule_ref["extractorVersion"]
            value["extractorSnapshotRef"] = dict(rule_ref)
            if value.get("model") is not None or value.get("modelStatus") != "not_applicable":
                raise ProductionLineageError(
                    "RULE_ONLY_CONTRACT_VIOLATION", "candidate 携带了模型状态"
                )
            candidate_id = str(value.get("candidateId") or "")
            if not candidate_id or candidate_id in candidate_ids:
                raise ProductionLineageError(
                    "ARTIFACT_INTEGRITY_ERROR", "candidateId 缺失或重复"
                )
            candidate_ids.add(candidate_id)
            validated.append(value)
        validated.sort(key=lambda item: (
            str(item.get("resourceId") or ""),
            str(item.get("chunkId") or ""),
            str(item.get("candidateId") or ""),
            self._canonical(item),
        ))
        isolated = result.get("isolated", [])
        if not isinstance(isolated, list):
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "isolated 结果必须是数组"
            )
        if any(not isinstance(item, Mapping) for item in isolated):
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "isolated 记录必须是对象"
            )
        normalized_isolated = [dict(item) for item in isolated]
        normalized_isolated.sort(key=lambda item: (
            str(item.get("resourceId") or ""),
            str(item.get("chunkId") or ""),
            str(item.get("reasonCode") or item.get("code") or ""),
            self._canonical(item),
        ))
        return {"candidates": validated, "isolated": normalized_isolated}

    def _verify_result(self, result: Any) -> KeywordRebuildResult:
        if not isinstance(result, Mapping):
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "已提交重建结果缺少结果引用"
            )
        run_id = str(result.get("rebuildRunId") or "")
        if not run_id:
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "已提交重建结果缺少 runId"
            )
        root = self.data_root / self._RUNS_DIR / run_id
        result_path = root / "result.json"
        manifest_path = root / "rebuild-manifest.json"
        if root.is_symlink() or not result_path.is_file() or not manifest_path.is_file():
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "已提交重建结果不可验证"
            )
        rule_ref = result.get("ruleSnapshotRef")
        if not isinstance(rule_ref, Mapping):
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "已提交重建结果缺少规则快照引用"
            )
        KeywordRuleSnapshot.verify(
            run_root=root,
            snapshot_ref=rule_ref,
            expected_run_id=run_id,
        )
        try:
            stored = json.loads(result_path.read_text(encoding="utf-8"))
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "已提交重建结果不可解析"
            ) from exc
        if not isinstance(stored, Mapping) or dict(stored) != dict(result) or not isinstance(manifest, Mapping):
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "已提交重建结果内容不一致"
            )
        artifacts = manifest.get("artifacts")
        if not isinstance(artifacts, Mapping):
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "已提交重建结果缺少 artifact 摘要"
            )
        candidates_info = artifacts.get("candidates")
        isolated_info = artifacts.get("isolated")
        if not isinstance(candidates_info, Mapping) or not isinstance(isolated_info, Mapping):
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "已提交重建结果 artifact 摘要结构无效"
            )
        candidates_path = self._safe_child(root, candidates_info.get("path"))
        isolated_path = self._safe_child(root, isolated_info.get("path"))
        if self._digest(candidates_path) != candidates_info.get("sha256"):
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "已提交 candidate 摘要不一致"
            )
        if self._digest(isolated_path) != isolated_info.get("sha256"):
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "已提交隔离结果摘要不一致"
            )
        manifest_digest = self._digest(manifest_path)
        if stored.get("resultFingerprint") != manifest_digest:
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "已提交重建结果指纹不一致"
            )
        for key in (
            "rebuildRunId", "candidateVersionId", "rebuildKey", "rebuildOf",
            "sourceSnapshotFingerprints", "ruleSnapshotRef", "candidateCount", "isolatedCount",
        ):
            if manifest.get(key) != stored.get(key):
                raise ProductionLineageError(
                    "ARTIFACT_INTEGRITY_ERROR", "已提交重建清单与结果不一致", field=key
                )
        return self._result_from_dict(dict(result))

    @staticmethod
    def _result_from_dict(value: Mapping[str, Any]) -> KeywordRebuildResult:
        return KeywordRebuildResult(
            rebuild_run_id=str(value["rebuildRunId"]),
            candidate_version_id=str(value["candidateVersionId"]),
            rebuild_key=str(value["rebuildKey"]),
            rebuild_of=dict(value["rebuildOf"]),
            source_snapshot_fingerprints=tuple(dict(item) for item in value["sourceSnapshotFingerprints"]),
            rule_snapshot_ref=dict(value["ruleSnapshotRef"]),
            candidate_count=int(value["candidateCount"]),
            isolated_count=int(value["isolatedCount"]),
            state=str(value["state"]),
            result_fingerprint=str(value["resultFingerprint"]),
        )

    def _reservation_paths(self, rebuild_key: str) -> tuple[Path, Path]:
        root = self.data_root / self._RESERVATION_DIR
        digest = rebuild_key.removeprefix("sha256:")
        return root / f"{digest}.json", root / f"{digest}.lock"

    @staticmethod
    def _read_state(path: Path) -> dict[str, Any] | None:
        if not path.is_file():
            return None
        try:
            value = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "重建 reservation 不可解析"
            ) from exc
        return dict(value) if isinstance(value, Mapping) else None

    @staticmethod
    def _write_state(path: Path, value: Mapping[str, Any]) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(KeywordRuleRebuild._canonical(dict(value)))
        KeywordRuleRebuild._fsync_file(path)

    @staticmethod
    def _canonical(value: Any) -> bytes:
        return json.dumps(
            value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False
        ).encode("utf-8")

    def _safe_data_path(self, relative: Any) -> Path:
        if not isinstance(relative, str) or not relative or Path(relative).is_absolute():
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "冻结输入路径必须是非空相对路径"
            )
        return self._safe_child(self.data_root, relative)

    @staticmethod
    def _safe_child(root: Path, relative: str) -> Path:
        if not isinstance(relative, str) or not relative or Path(relative).is_absolute():
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "产物路径必须是非空相对路径"
            )
        root = Path(root)
        if root.is_symlink():
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "产物根目录不能是符号链接"
            )
        try:
            root_real = root.resolve(strict=True)
            path = (root / relative).resolve(strict=True)
            path.relative_to(root_real)
        except (OSError, RuntimeError, ValueError) as exc:
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "产物路径越界或不存在", artifactPath=relative
            ) from exc
        current = root
        for component in Path(relative).parts:
            current = current / component
            if current.is_symlink():
                raise ProductionLineageError(
                    "ARTIFACT_INTEGRITY_ERROR", "产物路径不能包含符号链接", artifactPath=relative
                )
        if not path.is_file() or not stat.S_ISREG(path.stat().st_mode):
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "产物必须是普通文件", artifactPath=relative
            )
        return path

    @staticmethod
    def _digest(path: Path) -> str:
        return "sha256:" + hashlib.sha256(path.read_bytes()).hexdigest()

    @staticmethod
    def _write_json(path: Path, value: Any) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(KeywordRuleRebuild._canonical(value))
        KeywordRuleRebuild._fsync_file(path)

    @staticmethod
    def _write_jsonl(path: Path, values: Sequence[Mapping[str, Any]]) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        payload = b"".join(
            KeywordRuleRebuild._canonical(dict(value)) + b"\n" for value in values
        )
        path.write_bytes(payload)
        KeywordRuleRebuild._fsync_file(path)

    def _inject(self, stage: str, staging: Path) -> None:
        if self.fault_injector is not None:
            self.fault_injector(stage, staging)

    @staticmethod
    def _fsync_file(path: Path) -> None:
        with path.open("rb") as handle:
            os.fsync(handle.fileno())

    @staticmethod
    def _fsync_directory(path: Path) -> None:
        descriptor = os.open(path, os.O_RDONLY)
        try:
            os.fsync(descriptor)
        finally:
            os.close(descriptor)


@dataclass(frozen=True)
class ProductionLineageResult:
    manifest: dict[str, Any]
    verification: dict[str, Any]
    issues: tuple[dict[str, Any], ...]
    version_fingerprint: dict[str, Any]


@dataclass(frozen=True)
class GovernanceCommitResult:
    root: Path
    manifest_path: str
    verification_path: str
    issues_path: str
    version_fingerprint_path: str
    manifest_fingerprint: dict[str, Any]
    version_fingerprint: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return {
            "root": str(self.root),
            "lineage": {
                "manifestPath": self.manifest_path,
                "manifestFingerprint": self.manifest_fingerprint,
                "verificationPath": self.verification_path,
                "issuesPath": self.issues_path,
                "status": "verified",
            },
            "versionFingerprint": {
                "path": self.version_fingerprint_path,
                "fingerprint": self.version_fingerprint,
                "status": "verified",
            },
        }


@dataclass(frozen=True)
class _CanonicalChunk:
    producer_id: str
    lineage_id: str
    resource_id: str
    text: str
    source_start: int
    runtime_text: str
    overlap_parent_id: str | None


class ProductionLineageAdapter:
    """Convert verified production facts without reading mutable pointers."""

    @classmethod
    def build(
        cls,
        *,
        dataset_id: str,
        version_id: str,
        dataset_root: Path,
        source_documents: Sequence[Mapping[str, Any]],
        prepared_chunks: Sequence[Mapping[str, Any]],
        evidence_records: Sequence[Any],
        mode: str,
        graph: Any,
        index: Any,
        rule: Any,
        created_at: str,
        model: Any | None = None,
        embedding: Any | None = None,
    ) -> ProductionLineageResult:
        if mode not in _MODES:
            raise ProductionLineageError(
                "VERSION_FINGERPRINT_INVALID", "知识构建模式不受支持", mode=mode
            )
        if not isinstance(created_at, str) or not created_at:
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "lineage createdAt 不能为空"
            )

        try:
            sources, source_lookup, source_text = cls._adapt_sources(
                dataset_id, Path(dataset_root), source_documents, created_at
            )
            chunks, chunk_lookup = cls._adapt_chunks(
                prepared_chunks,
                source_lookup,
                source_text,
                created_at,
            )
        except ProductionLineageError:
            raise
        except (AttributeError, TypeError, ValueError) as exc:
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "source/chunk 事实集合不可验证"
            ) from exc
        evidence, issues = cls._adapt_evidence(
            evidence_records,
            chunk_lookup,
            mode,
            created_at,
        )

        try:
            manifest = LineageManifest.build(
                dataset_id, version_id, sources, chunks, evidence
            )
            verification = LineageManifest.verify(manifest)
        except (TypeError, ValueError) as exc:
            raise ProductionLineageError(
                "MANIFEST_VERIFICATION_PENDING", "lineage 清单无法构建"
            ) from exc
        if not verification.valid:
            raise ProductionLineageError(
                "MANIFEST_VERIFICATION_PENDING",
                "lineage 清单自校验失败",
                issues=verification.to_dict()["issues"],
            )

        try:
            versions = VersionFingerprint.build(graph, index, rule, model, embedding)
        except (TypeError, ValueError) as exc:
            raise ProductionLineageError(
                "VERSION_FINGERPRINT_INVALID", "版本指纹输入不可验证"
            ) from exc
        if not VersionFingerprint.verify(versions):
            raise ProductionLineageError(
                "VERSION_FINGERPRINT_INVALID", "版本指纹自校验失败"
            )
        return ProductionLineageResult(
            manifest=manifest,
            verification=verification.to_dict(),
            issues=tuple(issues),
            version_fingerprint=versions,
        )

    @classmethod
    def _adapt_sources(
        cls,
        dataset_id: str,
        dataset_root: Path,
        records: Sequence[Mapping[str, Any]],
        created_at: str,
    ) -> tuple[list[dict[str, Any]], dict[str, str], dict[str, str]]:
        normalized_root = dataset_root / "normalized"
        sources: list[dict[str, Any]] = []
        lookup: dict[str, str] = {}
        texts: dict[str, str] = {}
        for record in records:
            resource_id = cls._required_text(record, "resourceId", "source")
            source_path = cls._required_text(record, "sourcePath", "source")
            if resource_id in lookup:
                cls._integrity("source resourceId 重复", resourceId=resource_id)
            snapshot_name, payload = cls._read_normalized_snapshot(
                normalized_root, resource_id
            )
            try:
                text = payload.decode("utf-8")
            except UnicodeDecodeError as exc:
                raise ProductionLineageError(
                    "ARTIFACT_INTEGRITY_ERROR",
                    "数据集规范化快照不可读取",
                    resourceId=resource_id,
                ) from exc
            actual = hashlib.sha256(payload).hexdigest()
            declared = cls._normalized_digest(record.get("normalizedHash"))
            if actual != declared:
                cls._integrity(
                    "数据集规范化快照哈希不一致",
                    resourceId=resource_id,
                    expectedHash=f"sha256:{declared}",
                    actualHash=f"sha256:{actual}",
                )
            content_hash = f"sha256:{actual}"
            source_id = SourceOccurrenceIdentity.v2(
                dataset_id, resource_id, content_hash
            )
            relative_snapshot = (
                Path("datasets") / dataset_id / "normalized" / snapshot_name
            ).as_posix()
            source = {
                "uri": source_path,
                "snapshotId": relative_snapshot,
                "contentHash": content_hash,
                "aclRef": f"dataset:{dataset_id}",
                "createdAt": created_at,
                "resourceKey": resource_id,
            }
            original_hash = record.get("originalHash")
            if isinstance(original_hash, str) and original_hash:
                source["originalContentHash"] = (
                    original_hash
                    if original_hash.startswith("sha256:")
                    else f"sha256:{original_hash}"
                )
            sources.append(source)
            lookup[resource_id] = source_id
            texts[resource_id] = text
        if not sources:
            cls._integrity("source-documents 不能为空")
        sources.sort(key=lambda item: str(item["resourceKey"]))
        return sources, lookup, texts

    @classmethod
    def _read_normalized_snapshot(
        cls, normalized_root: Path, resource_id: str
    ) -> tuple[str, bytes]:
        if (
            resource_id in {".", ".."}
            or Path(resource_id).name != resource_id
            or "/" in resource_id
            or "\\" in resource_id
            or "\x00" in resource_id
        ):
            cls._integrity(
                "source resourceId 不能用于安全定位快照", resourceId=resource_id
            )

        flags = os.O_RDONLY | getattr(os, "O_CLOEXEC", 0)
        directory_flags = (
            flags
            | getattr(os, "O_DIRECTORY", 0)
            | getattr(os, "O_NOFOLLOW", 0)
        )
        try:
            directory_fd = os.open(normalized_root, directory_flags)
        except OSError as exc:
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR",
                "数据集规范化目录不可安全读取",
            ) from exc
        try:
            names = sorted(
                name
                for name in os.listdir(directory_fd)
                if Path(name).stem == resource_id
            )
            regular_names: list[str] = []
            for name in names:
                metadata = os.stat(name, dir_fd=directory_fd, follow_symlinks=False)
                if stat.S_ISREG(metadata.st_mode):
                    regular_names.append(name)
            if len(names) != 1 or len(regular_names) != 1:
                cls._integrity(
                    "数据集规范化快照缺失、不唯一或不是普通文件",
                    resourceId=resource_id,
                    matchCount=len(names),
                )
            snapshot_name = regular_names[0]
            snapshot = normalized_root / snapshot_name
            resolved_root = normalized_root.resolve(strict=True)
            try:
                snapshot.resolve(strict=True).relative_to(resolved_root)
            except (OSError, ValueError) as exc:
                raise ProductionLineageError(
                    "ARTIFACT_INTEGRITY_ERROR",
                    "数据集规范化快照超出目录边界",
                    resourceId=resource_id,
                ) from exc
            file_flags = flags | getattr(os, "O_NOFOLLOW", 0)
            file_fd = os.open(snapshot_name, file_flags, dir_fd=directory_fd)
            with os.fdopen(file_fd, "rb") as handle:
                return snapshot_name, handle.read()
        except ProductionLineageError:
            raise
        except OSError as exc:
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR",
                "数据集规范化快照不可安全读取",
                resourceId=resource_id,
            ) from exc
        finally:
            os.close(directory_fd)

    @classmethod
    def _adapt_chunks(
        cls,
        records: Sequence[Mapping[str, Any]],
        source_lookup: Mapping[str, str],
        source_texts: Mapping[str, str],
        created_at: str,
    ) -> tuple[list[dict[str, Any]], dict[str, _CanonicalChunk]]:
        chunks: list[dict[str, Any]] = []
        lookup: dict[str, _CanonicalChunk] = {}
        business_keys: set[tuple[str, int]] = set()
        for record in records:
            producer_id = cls._producer_chunk_id(record)
            resource_id = cls._required_text(record, "resourceId", "chunk")
            source_id = source_lookup.get(resource_id)
            source_text = source_texts.get(resource_id)
            if source_id is None or source_text is None:
                cls._integrity(
                    "chunk 父 source 缺失",
                    chunkId=producer_id,
                    resourceId=resource_id,
                )
            if producer_id in lookup:
                cls._integrity("chunk ID 重复", chunkId=producer_id)
            ordinal = record.get("chunkIndex")
            if type(ordinal) is not int or ordinal < 0:
                cls._integrity("chunkIndex 必须是非负整数", chunkId=producer_id)
            business_key = (resource_id, ordinal)
            if business_key in business_keys:
                cls._integrity(
                    "chunk resourceId/chunkIndex 重复",
                    chunkId=producer_id,
                    resourceId=resource_id,
                    chunkIndex=ordinal,
                )
            business_keys.add(business_key)
            start, end = cls._offsets(
                record.get("normalizedOffsets"),
                len(source_text),
                "chunk normalizedOffsets 越界或格式无效",
                chunkId=producer_id,
            )
            canonical_text = source_text[start:end]
            text_hash = f"sha256:{hashlib.sha256(canonical_text.encode('utf-8')).hexdigest()}"
            lineage_id = f"chunk:{source_id}:{ordinal}:{text_hash}"
            page_ref = cls._page_ref(record.get("sourceLocations"))
            chunks.append(
                {
                    "sourceId": source_id,
                    "ordinal": ordinal,
                    "textHash": text_hash,
                    "chunkHash": text_hash,
                    "offset": {"start": start, "end": end},
                    "pageRef": page_ref,
                    "createdAt": created_at,
                    "producerChunkId": producer_id,
                }
            )
            overlap = record.get("overlap")
            parent_id = None
            if isinstance(overlap, Mapping) and overlap.get("enabled") is True:
                value = overlap.get("sourceChunkId")
                parent_id = value if isinstance(value, str) and value else None
            lookup[producer_id] = _CanonicalChunk(
                producer_id=producer_id,
                lineage_id=lineage_id,
                resource_id=resource_id,
                text=canonical_text,
                source_start=start,
                runtime_text=str(record.get("content") or canonical_text),
                overlap_parent_id=parent_id,
            )
        if not chunks:
            cls._integrity("prepared chunks 不能为空")
        chunks.sort(
            key=lambda item: (
                str(item["sourceId"]),
                int(item["ordinal"]),
                str(item["producerChunkId"]),
            )
        )
        return chunks, lookup

    @classmethod
    def _adapt_evidence(
        cls,
        records: Sequence[Any],
        chunk_lookup: Mapping[str, _CanonicalChunk],
        mode: str,
        created_at: str,
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        grouped: dict[tuple[str, int, int, str], dict[str, Any]] = {}
        issues: list[dict[str, Any]] = []
        producer_counts: dict[str, int] = {}
        ordered_records = sorted(records, key=cls._evidence_sort_key)
        for record in ordered_records:
            explicit_id = cls._explicit_evidence_record_id(record, mode)
            if explicit_id is not None:
                producer_counts[explicit_id] = (
                    producer_counts.get(explicit_id, 0) + 1
                )
        duplicate_ids = {
            record_id for record_id, count in producer_counts.items() if count > 1
        }
        for index, record in enumerate(ordered_records):
            record_id = cls._evidence_record_id(record, mode)
            try:
                if not isinstance(record, Mapping):
                    raise TypeError("evidence 记录必须是对象")
                if record_id in duplicate_ids:
                    raise ValueError("evidence producer ID 重复")
                chunk = chunk_lookup.get(
                    cls._required_text(record, "chunkId", "evidence")
                )
                if chunk is None:
                    raise ValueError("evidence 父 chunk 缺失")
                quote = cls._required_text(record, "evidenceText", "evidence")
                selected_chunk, start = cls._locate_evidence(
                    record, chunk, chunk_lookup, quote, mode
                )
                end = start + len(quote)
                extractor = cls._extractor_version(record)
                quote_digest = hashlib.sha256(quote.encode("utf-8")).hexdigest()
                quoted_hash = f"sha256:{quote_digest}"
                key = (selected_chunk.lineage_id, start, end, quoted_hash)
                mapped = grouped.setdefault(
                    key,
                    {
                        "chunkId": selected_chunk.lineage_id,
                        "start": start,
                        "end": end,
                        "quotedHash": quoted_hash,
                        "extractorVersion": extractor,
                        "extractorVersions": [],
                        "createdAt": created_at,
                        "producerEvidenceIds": [],
                        **({"occurrenceIndex": 0} if mode == KEYWORD_MODE else {}),
                    },
                )
                mapped["extractorVersions"] = sorted(
                    {*mapped["extractorVersions"], extractor}
                )
                mapped["extractorVersion"] = mapped["extractorVersions"][0]
                mapped["producerEvidenceIds"] = sorted(
                    {*mapped["producerEvidenceIds"], record_id}
                )
            except (TypeError, ValueError) as exc:
                issues.append(
                    {
                        "schemaVersion": "lineage-issue/v1",
                        "code": "LINEAGE_RECORD_INVALID",
                        "severity": "error",
                        "message": "证据记录无法映射到规范化 chunk，已隔离。",
                        "objectType": "evidence",
                        "objectId": record_id,
                        "recordIndex": index,
                        "reason": str(exc),
                    }
                )
        issues.sort(
            key=lambda item: (
                str(item["objectId"]),
                str(item["reason"]),
            )
        )
        for canonical_index, issue in enumerate(issues):
            issue["recordIndex"] = canonical_index
        return [grouped[key] for key in sorted(grouped)], issues

    @classmethod
    def _locate_evidence(
        cls,
        record: Mapping[str, Any],
        chunk: _CanonicalChunk,
        chunk_lookup: Mapping[str, _CanonicalChunk],
        quote: str,
        mode: str,
    ) -> tuple[_CanonicalChunk, int]:
        positions = cls._positions(chunk.text, quote)
        if mode == KEYWORD_MODE:
            if not positions:
                raise ValueError("关键词证据不在规范 chunk 中")
            return chunk, positions[0]

        offsets = record.get("evidenceOffsets")
        if not isinstance(offsets, Mapping):
            raise ValueError("正式证据缺少 evidenceOffsets")
        start = offsets.get("start")
        end = offsets.get("end")
        if type(start) is not int or type(end) is not int or end - start != len(quote):
            raise ValueError("正式证据 evidenceOffsets 格式无效")
        runtime_start = start - chunk.source_start
        if (
            runtime_start < 0
            or runtime_start + len(quote) > len(chunk.runtime_text)
            or chunk.runtime_text[runtime_start : runtime_start + len(quote)] != quote
        ):
            raise ValueError("正式证据偏移无法在运行时 chunk 中回查")
        if (
            runtime_start + len(quote) <= len(chunk.text)
            and chunk.text[runtime_start : runtime_start + len(quote)] == quote
        ):
            return chunk, runtime_start

        if len(positions) == 1:
            return chunk, positions[0]
        if not positions and chunk.overlap_parent_id:
            parent = chunk_lookup.get(chunk.overlap_parent_id)
            if parent is not None:
                if parent.resource_id != chunk.resource_id:
                    raise ValueError("正式证据 overlap 父 chunk 跨越 resource 边界")
                parent_positions = cls._positions(parent.text, quote)
                if len(parent_positions) == 1:
                    return parent, parent_positions[0]
        if len(positions) > 1:
            raise ValueError("正式证据在规范 chunk 中存在多义位置")
        raise ValueError("正式证据不在规范 chunk 或可重绑父 chunk 中")

    @staticmethod
    def _positions(text: str, quote: str) -> list[int]:
        positions: list[int] = []
        cursor = 0
        while True:
            found = text.find(quote, cursor)
            if found < 0:
                return positions
            positions.append(found)
            cursor = found + 1

    @staticmethod
    def _extractor_version(record: Mapping[str, Any]) -> str:
        explicit = record.get("extractorVersion")
        if isinstance(explicit, str) and explicit:
            return explicit
        method = record.get("sourceMethod")
        schema = record.get("schemaVersion")
        if not isinstance(method, str) or not method:
            raise ValueError("evidence 缺少 sourceMethod/extractorVersion")
        if not isinstance(schema, str) or not schema:
            raise ValueError("evidence 缺少 schemaVersion")
        return f"{method}:{schema}"

    @staticmethod
    def _explicit_evidence_record_id(record: Any, mode: str) -> str | None:
        if not isinstance(record, Mapping):
            return None
        fields = (
            ("candidateId",)
            if mode == KEYWORD_MODE
            else ("knowledgeId", "candidateId")
        )
        for field in fields:
            value = record.get(field)
            if isinstance(value, str) and value:
                return value
        return None

    @classmethod
    def _evidence_record_id(cls, record: Any, mode: str) -> str:
        explicit = cls._explicit_evidence_record_id(record, mode)
        if explicit is not None:
            return explicit
        payload = cls._stable_record_payload(record)
        digest = hashlib.sha256(payload).hexdigest()[:24]
        return f"record:{digest}"

    @classmethod
    def _evidence_sort_key(cls, record: Any) -> tuple[str, bytes]:
        payload = cls._stable_record_payload(record)
        return hashlib.sha256(payload).hexdigest(), payload

    @staticmethod
    def _stable_record_payload(record: Any) -> bytes:
        try:
            return json.dumps(
                record,
                ensure_ascii=False,
                sort_keys=True,
                separators=(",", ":"),
                allow_nan=False,
            ).encode("utf-8")
        except (TypeError, ValueError):
            return f"{type(record).__module__}.{type(record).__qualname__}".encode(
                "utf-8"
            )

    @staticmethod
    def _producer_chunk_id(record: Mapping[str, Any]) -> str:
        for field in ("chunkId", "id"):
            value = record.get(field)
            if isinstance(value, str) and value:
                return value
        raise ProductionLineageError(
            "ARTIFACT_INTEGRITY_ERROR", "chunk 缺少 chunkId/id"
        )

    @staticmethod
    def _required_text(
        record: Mapping[str, Any], field: str, object_type: str
    ) -> str:
        value = record.get(field)
        if not isinstance(value, str) or not value:
            raise ValueError(f"{object_type} 缺少 {field}")
        return value

    @classmethod
    def _offsets(
        cls,
        value: Any,
        text_length: int,
        message: str,
        **context: Any,
    ) -> tuple[int, int]:
        if not isinstance(value, Mapping):
            cls._integrity(message, **context)
        start = value.get("start")
        end = value.get("end")
        if (
            type(start) is not int
            or type(end) is not int
            or start < 0
            or end <= start
            or end > text_length
        ):
            cls._integrity(message, **context)
        return start, end

    @staticmethod
    def _page_ref(value: Any) -> dict[str, Any] | None:
        if not isinstance(value, list):
            return None
        for location in value:
            if (
                isinstance(location, Mapping)
                and type(location.get("pageNumber")) is int
                and location["pageNumber"] > 0
            ):
                return dict(location)
        return None

    @staticmethod
    def _normalized_digest(value: Any) -> str:
        if not isinstance(value, str):
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "source 缺少 normalizedHash"
            )
        normalized = value.lower()
        for prefix in ("sha256-v1:", "sha256:"):
            if normalized.startswith(prefix):
                normalized = normalized[len(prefix) :]
                break
        if (
            len(normalized) != 64
            or any(character not in "0123456789abcdef" for character in normalized)
        ):
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "source normalizedHash 格式无效"
            )
        return normalized

    @staticmethod
    def _integrity(message: str, **context: Any) -> None:
        raise ProductionLineageError(
            "ARTIFACT_INTEGRITY_ERROR", message, **context
        )


FaultInjector = Callable[[str, Path], None]


class GovernancePackageRepository:
    """Publish all governance files with one directory-level atomic replace."""

    @classmethod
    def commit(
        cls,
        parent_root: Path,
        result: ProductionLineageResult,
        *,
        fault_injector: FaultInjector | None = None,
    ) -> GovernanceCommitResult:
        parent = Path(parent_root)
        if parent.is_symlink():
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR",
                "治理包父目录不能是符号链接",
                artifactPath=str(parent),
            )
        try:
            parent.mkdir(parents=True, exist_ok=True)
        except OSError as exc:
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR",
                "治理包父目录不可安全创建",
                artifactPath=str(parent),
            ) from exc
        if parent.is_symlink():
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR",
                "治理包父目录不能是符号链接",
                artifactPath=str(parent),
            )
        final = parent / "governance"
        if final.exists() or final.is_symlink():
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR",
                "治理包目录已存在，候选版本必须保持不可变",
                artifactPath=str(final),
            )
        staging = parent / f".governance-staging-{uuid.uuid4().hex}"
        staging.mkdir()
        published = False
        try:
            cls._write_json(staging / "lineage-manifest.json", result.manifest)
            cls._inject(fault_injector, "after_manifest", staging)
            cls._write_json(
                staging / "lineage-verification.json", result.verification
            )
            cls._write_jsonl(staging / "lineage-issues.jsonl", result.issues)
            cls._write_json(
                staging / "version-fingerprint.json", result.version_fingerprint
            )
            cls._inject(fault_injector, "before_verify", staging)
            cls._verify_staging(staging, result.issues)
            cls._inject(fault_injector, "before_publish", staging)
            cls._verify_staging(staging, result.issues)
            cls._fsync_directory(staging)
            try:
                os.replace(staging, final)
            except OSError as exc:
                if final.exists() or final.is_symlink():
                    raise ProductionLineageError(
                        "ARTIFACT_INTEGRITY_ERROR",
                        "治理包并发提交冲突，已保留先完成的不可变候选",
                        artifactPath=str(final),
                    ) from exc
                raise
            published = True
            cls._fsync_directory(parent)
        finally:
            if not published and staging.exists():
                shutil.rmtree(staging, ignore_errors=True)

        return GovernanceCommitResult(
            root=final,
            manifest_path="governance/lineage-manifest.json",
            verification_path="governance/lineage-verification.json",
            issues_path="governance/lineage-issues.jsonl",
            version_fingerprint_path="governance/version-fingerprint.json",
            manifest_fingerprint=dict(result.manifest["manifestFingerprint"]),
            version_fingerprint=dict(
                result.version_fingerprint["versionFingerprint"]
            ),
        )

    @classmethod
    def verify_committed(
        cls,
        parent_root: Path,
        *,
        data_root: Path,
    ) -> GovernanceCommitResult:
        """Revalidate one immutable governance package and its source snapshots."""

        parent = Path(parent_root)
        if parent.is_symlink():
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "数据集目录不能是符号链接"
            )
        parent = parent.resolve(strict=True)
        root = cls._safe_committed_file(parent, "governance", directory=True)
        issues = cls._read_issues(
            cls._safe_committed_file(root, "lineage-issues.jsonl")
        )
        cls._verify_staging(root, issues)
        try:
            manifest = json.loads(
                cls._safe_committed_file(root, "lineage-manifest.json").read_text(
                    encoding="utf-8"
                )
            )
            versions = json.loads(
                cls._safe_committed_file(root, "version-fingerprint.json").read_text(
                    encoding="utf-8"
                )
            )
        except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "已提交治理包不可解析"
            ) from exc
        data_root_real = Path(data_root).resolve(strict=True)
        for source in manifest.get("sources", []):
            if not isinstance(source, Mapping):
                raise ProductionLineageError(
                    "MANIFEST_VERIFICATION_PENDING", "治理包 source 结构无效"
                )
            snapshot = cls._safe_committed_file(
                data_root_real, source.get("snapshotId")
            )
            actual = "sha256:" + hashlib.sha256(snapshot.read_bytes()).hexdigest()
            if actual != source.get("contentHash"):
                raise ProductionLineageError(
                    "ARTIFACT_INTEGRITY_ERROR",
                    "治理包引用的 normalized 快照摘要不一致",
                    sourceId=source.get("sourceId"),
                )
        return GovernanceCommitResult(
            root=root,
            manifest_path="governance/lineage-manifest.json",
            verification_path="governance/lineage-verification.json",
            issues_path="governance/lineage-issues.jsonl",
            version_fingerprint_path="governance/version-fingerprint.json",
            manifest_fingerprint=dict(manifest["manifestFingerprint"]),
            version_fingerprint=dict(versions["versionFingerprint"]),
        )

    @staticmethod
    def _safe_committed_file(
        root: Path,
        relative: Any,
        *,
        directory: bool = False,
    ) -> Path:
        if not isinstance(relative, str) or not relative or Path(relative).is_absolute():
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "治理包引用路径无效"
            )
        root_path = Path(root)
        if root_path.is_symlink():
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "治理包根目录不能是符号链接"
            )
        try:
            root_real = root_path.resolve(strict=True)
            path = (root_path / relative).resolve(strict=True)
            path.relative_to(root_real)
        except (OSError, RuntimeError, ValueError) as exc:
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "治理包引用路径越界或不存在"
            ) from exc
        current = root_path
        for part in Path(relative).parts:
            current /= part
            if current.is_symlink():
                raise ProductionLineageError(
                    "ARTIFACT_INTEGRITY_ERROR", "治理包引用路径不能包含符号链接"
                )
        if directory:
            valid = path.is_dir()
        else:
            valid = path.is_file() and not path.is_symlink()
        if not valid:
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "治理包引用不是预期的普通文件或目录"
            )
        return path

    @classmethod
    def _verify_staging(
        cls,
        staging: Path,
        expected_issues: Sequence[Mapping[str, Any]],
    ) -> None:
        try:
            manifest = json.loads(
                (staging / "lineage-manifest.json").read_text(encoding="utf-8")
            )
            verification = json.loads(
                (staging / "lineage-verification.json").read_text(encoding="utf-8")
            )
            versions = json.loads(
                (staging / "version-fingerprint.json").read_text(encoding="utf-8")
            )
            issues = cls._read_issues(staging / "lineage-issues.jsonl")
        except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "治理包 staging 文件不可验证"
            ) from exc
        if issues != [dict(issue) for issue in expected_issues]:
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "治理包质量问题文件与待提交事实不一致"
            )
        current = LineageManifest.verify(manifest).to_dict()
        if not current["valid"] or verification != current:
            raise ProductionLineageError(
                "MANIFEST_VERIFICATION_PENDING", "治理包 lineage 自校验失败"
            )
        if not VersionFingerprint.verify(versions):
            raise ProductionLineageError(
                "VERSION_FINGERPRINT_INVALID", "治理包版本指纹自校验失败"
            )
        canonical_files = {
            "lineage-manifest.json": manifest,
            "lineage-verification.json": verification,
            "version-fingerprint.json": versions,
        }
        for name, value in canonical_files.items():
            expected = json.dumps(
                value, ensure_ascii=False, sort_keys=True, indent=2
            ).encode("utf-8")
            if (staging / name).read_bytes() != expected:
                raise ProductionLineageError(
                    "ARTIFACT_INTEGRITY_ERROR", "治理包 JSON 文件字节形式发生漂移"
                )
        expected_issue_bytes = "".join(
            json.dumps(issue, ensure_ascii=False, sort_keys=True) + "\n"
            for issue in issues
        ).encode("utf-8")
        if (staging / "lineage-issues.jsonl").read_bytes() != expected_issue_bytes:
            raise ProductionLineageError(
                "ARTIFACT_INTEGRITY_ERROR", "治理包质量问题文件字节形式发生漂移"
            )

    @staticmethod
    def _read_issues(path: Path) -> list[dict[str, Any]]:
        payload = path.read_bytes()
        if not payload:
            return []
        if not payload.endswith(b"\n"):
            raise json.JSONDecodeError("lineage issues 记录不完整", "", 0)
        issues: list[dict[str, Any]] = []
        for line_number, raw_line in enumerate(payload.splitlines(), start=1):
            if not raw_line:
                raise json.JSONDecodeError("lineage issues 包含空记录", "", line_number)
            issue = json.loads(raw_line.decode("utf-8"))
            if not isinstance(issue, dict):
                raise json.JSONDecodeError("lineage issue 必须是对象", "", line_number)
            required_text = (
                "schemaVersion",
                "code",
                "severity",
                "message",
                "objectType",
                "objectId",
                "reason",
            )
            if any(
                not isinstance(issue.get(field), str) or not issue[field]
                for field in required_text
            ):
                raise json.JSONDecodeError(
                    "lineage issue 文本字段无效", "", line_number
                )
            if issue["schemaVersion"] != "lineage-issue/v1":
                raise json.JSONDecodeError(
                    "lineage issue schemaVersion 无效", "", line_number
                )
            record_index = issue.get("recordIndex")
            if type(record_index) is not int or record_index < 0:
                raise json.JSONDecodeError(
                    "lineage issue recordIndex 无效", "", line_number
                )
            issues.append(issue)
        return issues

    @staticmethod
    def _write_json(path: Path, value: Any) -> None:
        GovernancePackageRepository._write_bytes(
            path,
            json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2).encode(
                "utf-8"
            ),
        )

    @staticmethod
    def _write_jsonl(path: Path, values: Sequence[Mapping[str, Any]]) -> None:
        payload = "".join(
            json.dumps(value, ensure_ascii=False, sort_keys=True) + "\n"
            for value in values
        ).encode("utf-8")
        GovernancePackageRepository._write_bytes(path, payload)

    @staticmethod
    def _write_bytes(path: Path, payload: bytes) -> None:
        with path.open("xb") as handle:
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())

    @staticmethod
    def _inject(
        injector: FaultInjector | None, stage: str, staging: Path
    ) -> None:
        if injector is not None:
            injector(stage, staging)

    @staticmethod
    def _fsync_directory(path: Path) -> None:
        descriptor = os.open(path, os.O_RDONLY)
        try:
            os.fsync(descriptor)
        finally:
            os.close(descriptor)
