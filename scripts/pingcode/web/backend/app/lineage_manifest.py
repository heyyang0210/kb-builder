"""Canonical fingerprints and immutable source-to-evidence lineage manifests."""

from __future__ import annotations

import hashlib
import hmac
import json
import uuid
from dataclasses import dataclass
from typing import Any, Callable, Mapping, Sequence


FINGERPRINT_ALGORITHM = "sha256-v1"
MANIFEST_SCHEMA_VERSION = "2.0"
LEGACY_MANIFEST_SCHEMA_VERSION = "1.0"


def canonical_json_bytes(value: Any) -> bytes:
    """Serialize JSON data using the byte-stable sha256-v1 input contract."""

    try:
        return json.dumps(
            value,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
            allow_nan=False,
        ).encode("utf-8")
    except (TypeError, ValueError) as exc:
        raise ValueError("指纹输入必须是有限值组成的 JSON 数据") from exc


@dataclass(frozen=True)
class Fingerprint:
    algorithm: str
    digest: str
    byte_length: int

    def to_dict(self) -> dict[str, Any]:
        return {
            "algorithm": self.algorithm,
            "digest": self.digest,
            "byteLength": self.byte_length,
        }


class FingerprintService:
    """Produce and validate versioned content fingerprints."""

    @staticmethod
    def hash_bytes(
        data: bytes | bytearray | memoryview,
        algorithm: str = FINGERPRINT_ALGORITHM,
    ) -> Fingerprint:
        if algorithm != FINGERPRINT_ALGORITHM:
            raise ValueError(f"不支持的指纹算法: {algorithm}")
        if not isinstance(data, (bytes, bytearray, memoryview)):
            raise TypeError("data 必须是 bytes-like 对象")
        payload = bytes(data)
        return Fingerprint(algorithm, hashlib.sha256(payload).hexdigest(), len(payload))

    @classmethod
    def hash_json(cls, value: Any) -> Fingerprint:
        return cls.hash_bytes(canonical_json_bytes(value))

    @staticmethod
    def matches(actual: Mapping[str, Any], expected: Fingerprint) -> bool:
        return (
            actual.get("algorithm") == expected.algorithm
            and actual.get("byteLength") == expected.byte_length
            and isinstance(actual.get("digest"), str)
            and hmac.compare_digest(actual["digest"], expected.digest)
        )


class SourceOccurrenceIdentity:
    """Derive the deterministic Schema 2.0 identity for one source occurrence."""

    @classmethod
    def v2(cls, dataset_id: str, resource_id: str, content_hash: str) -> str:
        if not isinstance(dataset_id, str) or not dataset_id.strip():
            raise ValueError("dataset_id 不能为空")
        if not isinstance(resource_id, str) or not resource_id:
            raise ValueError("source.resourceKey 不能为空")
        normalized_hash = cls.normalize_content_hash(content_hash)
        logical_key = {
            "datasetId": dataset_id,
            "resourceId": resource_id,
            "contentHash": normalized_hash,
        }
        digest = hashlib.sha256(canonical_json_bytes(logical_key)).hexdigest()
        return f"source:v2:{digest}"

    @staticmethod
    def normalize_content_hash(value: str) -> str:
        if not isinstance(value, str):
            raise ValueError("source.contentHash 格式无效")
        normalized = value.lower()
        for prefix in ("sha256-v1:", "sha256:"):
            if normalized.startswith(prefix):
                normalized = normalized[len(prefix) :]
                break
        if len(normalized) != 64 or any(
            character not in "0123456789abcdef" for character in normalized
        ):
            raise ValueError("source.contentHash 格式无效")
        return f"sha256:{normalized}"


@dataclass(frozen=True)
class VerificationIssue:
    code: str
    message: str
    object_type: str = "manifest"
    object_id: str | None = None

    def to_dict(self) -> dict[str, Any]:
        result: dict[str, Any] = {
            "code": self.code,
            "message": self.message,
            "objectType": self.object_type,
        }
        if self.object_id is not None:
            result["objectId"] = self.object_id
        return result


@dataclass(frozen=True)
class VerificationResult:
    valid: bool
    issues: tuple[VerificationIssue, ...] = ()

    def to_dict(self) -> dict[str, Any]:
        return {
            "valid": self.valid,
            "issues": [issue.to_dict() for issue in self.issues],
        }


class LineageManifest:
    """Build and verify deterministic source/chunk/evidence manifests."""

    _COLLECTIONS = (
        ("sources", "sourceId"),
        ("chunks", "chunkId"),
        ("evidence", "evidenceId"),
    )

    @classmethod
    def build(
        cls,
        dataset_id: str,
        version_id: str,
        sources: Sequence[Mapping[str, Any]],
        chunks: Sequence[Mapping[str, Any]],
        evidence: Sequence[Mapping[str, Any]],
    ) -> dict[str, Any]:
        """Normalize records, derive stable references, and seal the manifest."""

        cls._require_identifier(dataset_id, "dataset_id")
        cls._require_identifier(version_id, "version_id")

        normalized_sources = [
            cls._normalize_source(item, dataset_id, version_id) for item in sources
        ]
        normalized_chunks = [
            cls._normalize_chunk(item, dataset_id, version_id) for item in chunks
        ]
        normalized_evidence = [
            cls._normalize_evidence(item, dataset_id, version_id) for item in evidence
        ]
        cls._validate_relationships(
            normalized_sources, normalized_chunks, normalized_evidence
        )

        body: dict[str, Any] = {
            "schemaVersion": MANIFEST_SCHEMA_VERSION,
            "datasetId": dataset_id,
            "versionId": version_id,
            "sources": sorted(normalized_sources, key=lambda item: item["sourceId"]),
            "chunks": sorted(normalized_chunks, key=lambda item: item["chunkId"]),
            "evidence": sorted(
                normalized_evidence, key=lambda item: item["evidenceId"]
            ),
        }
        body["manifestFingerprint"] = FingerprintService.hash_json(body).to_dict()
        return body

    @classmethod
    def verify(cls, manifest: Mapping[str, Any]) -> VerificationResult:
        """Fail closed on schema, parent-chain, record, or manifest drift."""

        if not isinstance(manifest, Mapping):
            return VerificationResult(
                False,
                (
                    VerificationIssue(
                        "LINEAGE_MANIFEST_INVALID",
                        "lineage manifest 必须是对象",
                    ),
                ),
            )
        issues: list[VerificationIssue] = []
        try:
            schema_version = manifest.get("schemaVersion")
            if schema_version not in (
                LEGACY_MANIFEST_SCHEMA_VERSION,
                MANIFEST_SCHEMA_VERSION,
            ):
                raise ValueError("不支持的 lineage manifest schemaVersion")
            collections = {
                name: cls._require_collection(manifest, name)
                for name, _ in cls._COLLECTIONS
            }
            cls._verify_record_fingerprints(collections, issues)
            if schema_version == MANIFEST_SCHEMA_VERSION:
                cls._verify_v2_structure(manifest, collections)
            else:
                cls._verify_v1_structure(manifest, collections)
                issues.append(
                    VerificationIssue(
                        "LEGACY_SOURCE_IDENTITY_AMBIGUOUS",
                        "Schema 1.0 无法证明 resource occurrence，仅允许原父链历史回放",
                    )
                )
        except (KeyError, TypeError, ValueError) as exc:
            issues.append(
                VerificationIssue("LINEAGE_MANIFEST_INVALID", str(exc))
            )

        actual_fingerprint = manifest.get("manifestFingerprint")
        if not isinstance(actual_fingerprint, Mapping) or not FingerprintService.matches(
            actual_fingerprint, FingerprintService.hash_json(cls._manifest_body(manifest))
        ):
            issues.append(
                VerificationIssue(
                    "LINEAGE_MANIFEST_FINGERPRINT_MISMATCH",
                    "lineage manifest 内容与总指纹不一致",
                )
            )
        return VerificationResult(not issues, tuple(issues))

    @classmethod
    def _verify_record_fingerprints(
        cls,
        collections: Mapping[str, Sequence[Mapping[str, Any]]],
        issues: list[VerificationIssue],
    ) -> None:
        for collection, id_field in cls._COLLECTIONS:
            for index, item in enumerate(collections[collection]):
                if not isinstance(item, Mapping):
                    raise ValueError(f"manifest.{collection}[{index}] 必须是对象")
                expected = FingerprintService.hash_json(
                    {
                        key: value
                        for key, value in item.items()
                        if key != "recordFingerprint"
                    }
                )
                actual = item.get("recordFingerprint")
                if not isinstance(actual, Mapping) or not FingerprintService.matches(
                    actual, expected
                ):
                    issues.append(
                        VerificationIssue(
                            "LINEAGE_RECORD_FINGERPRINT_MISMATCH",
                            "lineage 记录内容与指纹不一致，必须隔离",
                            collection,
                            str(item.get(id_field) or f"index:{index}"),
                        )
                    )

    @classmethod
    def _verify_v2_structure(
        cls,
        manifest: Mapping[str, Any],
        collections: Mapping[str, Sequence[Mapping[str, Any]]],
    ) -> None:
        for source in collections["sources"]:
            content_hash = source.get("contentHash")
            if content_hash != SourceOccurrenceIdentity.normalize_content_hash(
                content_hash
            ):
                raise ValueError("Schema 2.0 source.contentHash 必须使用 sha256: 规范表示")
        cls.build(
            cls._manifest_identifier(manifest, "datasetId"),
            cls._manifest_identifier(manifest, "versionId"),
            collections["sources"],
            collections["chunks"],
            collections["evidence"],
        )

    @classmethod
    def _verify_v1_structure(
        cls,
        manifest: Mapping[str, Any],
        collections: Mapping[str, Sequence[Mapping[str, Any]]],
    ) -> None:
        dataset_id = cls._manifest_identifier(manifest, "datasetId")
        version_id = cls._manifest_identifier(manifest, "versionId")
        for collection in collections.values():
            for item in collection:
                if item.get("schemaVersion") != LEGACY_MANIFEST_SCHEMA_VERSION:
                    raise ValueError("Schema 1.0 记录版本与清单不一致")
                if (
                    item.get("datasetId") != dataset_id
                    or item.get("versionId") != version_id
                ):
                    raise ValueError("Schema 1.0 记录范围与 manifest 不一致")
                if not isinstance(item.get("createdAt"), str) or not item["createdAt"]:
                    raise ValueError("Schema 1.0 lineage 记录缺少 createdAt")

        for source in collections["sources"]:
            cls._require_fields(
                source, "source", "sourceId", "uri", "snapshotId", "contentHash", "aclRef"
            )
            cls._require_exact_id(
                source,
                "sourceId",
                f"source:{dataset_id}:{source['contentHash']}",
            )
        for chunk in collections["chunks"]:
            cls._require_fields(
                chunk, "chunk", "chunkId", "sourceId", "ordinal", "textHash", "offset"
            )
            if type(chunk["ordinal"]) is not int or chunk["ordinal"] < 0:
                raise ValueError("Schema 1.0 chunk.ordinal 必须是非负整数")
            chunk_hash = chunk.get("chunkHash", chunk["textHash"])
            cls._require_exact_id(
                chunk,
                "chunkId",
                f"chunk:{chunk['sourceId']}:{chunk['ordinal']}:{chunk_hash}",
            )
        for evidence in collections["evidence"]:
            cls._require_fields(
                evidence,
                "evidence",
                "evidenceId",
                "chunkId",
                "start",
                "end",
                "quotedHash",
                "extractorVersion",
                "spanHash",
            )
            if (
                type(evidence["start"]) is not int
                or type(evidence["end"]) is not int
                or evidence["start"] < 0
                or evidence["end"] <= evidence["start"]
            ):
                raise ValueError("Schema 1.0 evidence 偏移必须满足 0 <= start < end")
            cls._require_exact_id(
                evidence,
                "evidenceId",
                f"evidence:{evidence['chunkId']}:{evidence['spanHash']}",
            )
        cls._validate_relationships(
            collections["sources"], collections["chunks"], collections["evidence"]
        )

    @staticmethod
    def _manifest_identifier(manifest: Mapping[str, Any], field: str) -> str:
        value = manifest.get(field)
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"manifest.{field} 不能为空")
        return value

    @staticmethod
    def _require_exact_id(
        record: Mapping[str, Any], field: str, expected_id: str
    ) -> None:
        if record.get(field) != expected_id:
            raise ValueError(f"{field} 与稳定引用规则不一致")

    @staticmethod
    def _manifest_body(manifest: Mapping[str, Any]) -> dict[str, Any]:
        return {
            key: value
            for key, value in manifest.items()
            if key != "manifestFingerprint"
        }

    @classmethod
    def _normalize_source(
        cls, item: Mapping[str, Any], dataset_id: str, version_id: str
    ) -> dict[str, Any]:
        record = cls._base_record(item, dataset_id, version_id)
        cls._require_fields(
            record,
            "source",
            "resourceKey",
            "uri",
            "snapshotId",
            "contentHash",
            "aclRef",
        )
        if not isinstance(record["resourceKey"], str):
            raise ValueError("source.resourceKey 必须是字符串")
        record["contentHash"] = SourceOccurrenceIdentity.normalize_content_hash(
            record["contentHash"]
        )
        expected_id = SourceOccurrenceIdentity.v2(
            dataset_id, record["resourceKey"], record["contentHash"]
        )
        cls._set_or_validate_id(record, "sourceId", expected_id)
        record.setdefault("lineageId", expected_id)
        return cls._seal_record(record)

    @classmethod
    def _normalize_chunk(
        cls, item: Mapping[str, Any], dataset_id: str, version_id: str
    ) -> dict[str, Any]:
        record = cls._base_record(item, dataset_id, version_id)
        cls._require_fields(record, "chunk", "sourceId", "ordinal", "textHash", "offset")
        if not isinstance(record["ordinal"], int) or record["ordinal"] < 0:
            raise ValueError("chunk.ordinal 必须是非负整数")
        record.setdefault("pageRef", None)
        record.setdefault("chunkHash", record["textHash"])
        expected_id = (
            f"chunk:{record['sourceId']}:{record['ordinal']}:{record['chunkHash']}"
        )
        cls._set_or_validate_id(record, "chunkId", expected_id)
        record.setdefault("lineageId", expected_id)
        return cls._seal_record(record)

    @classmethod
    def _normalize_evidence(
        cls, item: Mapping[str, Any], dataset_id: str, version_id: str
    ) -> dict[str, Any]:
        record = cls._base_record(item, dataset_id, version_id)
        cls._require_fields(
            record,
            "evidence",
            "chunkId",
            "start",
            "end",
            "quotedHash",
            "extractorVersion",
        )
        if (
            not isinstance(record["start"], int)
            or not isinstance(record["end"], int)
            or record["start"] < 0
            or record["end"] <= record["start"]
        ):
            raise ValueError("evidence 偏移必须满足 0 <= start < end")
        record.setdefault(
            "spanHash",
            FingerprintService.hash_json(
                {
                    "start": record["start"],
                    "end": record["end"],
                    "quotedHash": record["quotedHash"],
                }
            ).digest,
        )
        expected_id = f"evidence:{record['chunkId']}:{record['spanHash']}"
        cls._set_or_validate_id(record, "evidenceId", expected_id)
        record.setdefault("lineageId", expected_id)
        return cls._seal_record(record)

    @staticmethod
    def _base_record(
        item: Mapping[str, Any], dataset_id: str, version_id: str
    ) -> dict[str, Any]:
        if not isinstance(item, Mapping):
            raise TypeError("lineage 记录必须是对象")
        record = {
            key: value for key, value in item.items() if key != "recordFingerprint"
        }
        if record.get("datasetId", dataset_id) != dataset_id:
            raise ValueError("lineage 记录 datasetId 与 manifest 不一致")
        if record.get("versionId", version_id) != version_id:
            raise ValueError("lineage 记录 versionId 与 manifest 不一致")
        record["datasetId"] = dataset_id
        record["versionId"] = version_id
        record.setdefault("schemaVersion", MANIFEST_SCHEMA_VERSION)
        if record["schemaVersion"] != MANIFEST_SCHEMA_VERSION:
            raise ValueError("lineage 记录 schemaVersion 不受支持")
        if not isinstance(record.get("createdAt"), str) or not record["createdAt"]:
            raise ValueError("lineage 记录缺少 createdAt")
        return record

    @staticmethod
    def _seal_record(record: dict[str, Any]) -> dict[str, Any]:
        sealed = dict(record)
        sealed["recordFingerprint"] = FingerprintService.hash_json(sealed).to_dict()
        return sealed

    @staticmethod
    def _set_or_validate_id(
        record: dict[str, Any], field: str, expected_id: str
    ) -> None:
        supplied = record.get(field)
        if supplied is not None and supplied != expected_id:
            raise ValueError(f"{field} 与稳定引用规则不一致")
        record[field] = expected_id

    @staticmethod
    def _require_identifier(value: str, field: str) -> None:
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"{field} 不能为空")

    @staticmethod
    def _require_fields(record: Mapping[str, Any], object_type: str, *fields: str) -> None:
        missing = [field for field in fields if field not in record or record[field] in (None, "")]
        if missing:
            raise ValueError(f"{object_type} 缺少必填字段: {','.join(missing)}")

    @staticmethod
    def _require_collection(
        manifest: Mapping[str, Any], field: str
    ) -> Sequence[Mapping[str, Any]]:
        value = manifest.get(field)
        if not isinstance(value, list):
            raise ValueError(f"manifest.{field} 必须是数组")
        return value

    @staticmethod
    def _validate_relationships(
        sources: Sequence[Mapping[str, Any]],
        chunks: Sequence[Mapping[str, Any]],
        evidence: Sequence[Mapping[str, Any]],
    ) -> None:
        source_ids = [item["sourceId"] for item in sources]
        chunk_ids = [item["chunkId"] for item in chunks]
        evidence_ids = [item["evidenceId"] for item in evidence]
        if len(source_ids) != len(set(source_ids)):
            raise ValueError("sourceId 重复")
        if len(chunk_ids) != len(set(chunk_ids)):
            raise ValueError("chunkId 重复")
        if len(evidence_ids) != len(set(evidence_ids)):
            raise ValueError("evidenceId 重复")
        source_id_set = set(source_ids)
        chunk_id_set = set(chunk_ids)
        if missing := sorted(
            item["chunkId"] for item in chunks if item["sourceId"] not in source_id_set
        ):
            raise ValueError(f"chunk 父 source 缺失: {','.join(missing)}")
        if missing := sorted(
            item["evidenceId"]
            for item in evidence
            if item["chunkId"] not in chunk_id_set
        ):
            raise ValueError(f"evidence 父 chunk 缺失: {','.join(missing)}")


SnapshotValue = bytes | bytearray | memoryview | str
SnapshotLoader = Mapping[str, SnapshotValue] | Callable[[str], SnapshotValue | None]


class EvidenceReplayError(RuntimeError):
    """A redacted, structured failure that never carries snapshot text."""

    def __init__(
        self,
        code: str,
        message: str,
        *,
        request_id: str,
        object_id: str,
        version_id: str,
        status: str,
    ):
        super().__init__(message)
        self.code = code
        self.request_id = request_id
        self.object_id = object_id
        self.version_id = version_id
        self.status = status

    def to_dict(self) -> dict[str, str]:
        return {
            "code": self.code,
            "message": str(self),
            "requestId": self.request_id,
            "objectId": self.object_id,
            "versionId": self.version_id,
            "status": self.status,
        }


class EvidenceReplay:
    """Replay one citation from an injected immutable text snapshot.

    Authentication, ACL checks, citation lookup, and audit persistence remain at
    the API/service boundary. This component only validates the selected
    evidence chain and never reads a process-global path or mutable latest file.
    """

    def __init__(self, manifest: Mapping[str, Any], snapshot_loader: SnapshotLoader):
        if not isinstance(manifest, Mapping):
            raise TypeError("manifest 必须是对象")
        if not isinstance(snapshot_loader, Mapping) and not callable(snapshot_loader):
            raise TypeError("snapshot_loader 必须是 mapping 或 callable")
        self._manifest = json.loads(canonical_json_bytes(manifest))
        self._snapshot_loader = snapshot_loader

    def replay(
        self,
        citation_id: str,
        evidence_id: str,
        *,
        request_id: str | None = None,
    ) -> dict[str, Any]:
        """Return a verified citation, evidence record, quote, and offsets."""

        resolved_request_id = request_id or uuid.uuid4().hex
        version_id = str(self._manifest.get("versionId") or "")
        schema_version = self._manifest.get("schemaVersion")
        if schema_version not in (
            LEGACY_MANIFEST_SCHEMA_VERSION,
            MANIFEST_SCHEMA_VERSION,
        ):
            self._raise(
                "LINEAGE_STALE",
                "lineage manifest schemaVersion 不受支持",
                resolved_request_id,
                evidence_id or citation_id or "unknown",
                version_id,
                "stale",
            )
        if not citation_id or not evidence_id:
            self._raise(
                "LINEAGE_NOT_FOUND",
                "引用或证据标识不存在",
                resolved_request_id,
                evidence_id or citation_id or "unknown",
                version_id,
                "isolated",
            )
        if not citation_id.startswith("citation:") or not citation_id.endswith(
            f":{evidence_id}"
        ):
            self._raise(
                "LINEAGE_NOT_FOUND",
                "引用与证据的稳定关联无效",
                resolved_request_id,
                citation_id,
                version_id,
                "isolated",
            )

        evidence = self._find_record("evidence", "evidenceId", evidence_id)
        if evidence is None:
            self._raise(
                "LINEAGE_NOT_FOUND",
                "证据记录不存在",
                resolved_request_id,
                evidence_id,
                version_id,
                "isolated",
            )
        self._require_record_fingerprint(
            evidence, evidence_id, resolved_request_id, version_id
        )
        self._require_scope(evidence, resolved_request_id, evidence_id, version_id)
        self._require_stable_reference(
            evidence,
            "evidenceId",
            f"evidence:{evidence.get('chunkId')}:{evidence.get('spanHash')}",
            resolved_request_id,
            version_id,
        )

        chunk_id = evidence.get("chunkId")
        chunk = self._find_record("chunks", "chunkId", chunk_id)
        if chunk is None:
            self._raise(
                "LINEAGE_PARENT_MISSING",
                "证据的父 chunk 不存在",
                resolved_request_id,
                str(chunk_id or evidence_id),
                version_id,
                "isolated",
            )
        self._require_record_fingerprint(
            chunk, str(chunk_id), resolved_request_id, version_id
        )
        self._require_scope(chunk, resolved_request_id, str(chunk_id), version_id)
        self._require_stable_reference(
            chunk,
            "chunkId",
            f"chunk:{chunk.get('sourceId')}:{chunk.get('ordinal')}:{chunk.get('chunkHash')}",
            resolved_request_id,
            version_id,
        )

        source_id = chunk.get("sourceId")
        source = self._find_record("sources", "sourceId", source_id)
        if source is None:
            self._raise(
                "LINEAGE_PARENT_MISSING",
                "chunk 的父 source 不存在",
                resolved_request_id,
                str(source_id or chunk_id),
                version_id,
                "isolated",
            )
        self._require_record_fingerprint(
            source, str(source_id), resolved_request_id, version_id
        )
        self._require_scope(source, resolved_request_id, str(source_id), version_id)
        self._require_stable_reference(
            source,
            "sourceId",
            self._expected_source_id(
                source,
                resolved_request_id,
                str(source_id),
                version_id,
            ),
            resolved_request_id,
            version_id,
        )

        snapshot_id = str(source.get("snapshotId") or "")
        snapshot = self._load_snapshot(snapshot_id)
        if snapshot is None:
            self._raise(
                "FILE_SNAPSHOT_MISSING",
                "原文快照不存在或当前不可读取",
                resolved_request_id,
                snapshot_id or str(source_id),
                version_id,
                "isolated",
            )
        payload = self._snapshot_bytes(
            snapshot, snapshot_id, resolved_request_id, version_id
        )
        if not self._hash_matches(source.get("contentHash"), payload):
            self._raise(
                "FILE_SNAPSHOT_HASH_MISMATCH",
                "原文快照与 source 内容哈希不一致",
                resolved_request_id,
                str(source_id),
                version_id,
                "stale",
            )
        try:
            source_text = payload.decode("utf-8")
        except UnicodeDecodeError:
            self._raise(
                "LINEAGE_STALE",
                "原文快照不是可回放的 UTF-8 规范化文本",
                resolved_request_id,
                str(source_id),
                version_id,
                "stale",
            )

        chunk_start, chunk_end = self._validated_offset(
            chunk.get("offset"),
            len(source_text),
            resolved_request_id,
            str(chunk_id),
            version_id,
        )
        chunk_text = source_text[chunk_start:chunk_end]
        if not self._hash_matches(chunk.get("textHash"), chunk_text.encode("utf-8")):
            self._raise(
                "LINEAGE_STALE",
                "chunk 文本与 textHash 不一致",
                resolved_request_id,
                str(chunk_id),
                version_id,
                "stale",
            )

        evidence_start, evidence_end = self._validated_span(
            evidence.get("start"),
            evidence.get("end"),
            len(chunk_text),
            resolved_request_id,
            evidence_id,
            version_id,
        )
        quote = chunk_text[evidence_start:evidence_end]
        quote_fingerprint = FingerprintService.hash_bytes(quote.encode("utf-8"))
        if not self._hash_matches(evidence.get("quotedHash"), quote.encode("utf-8")):
            self._raise(
                "EVIDENCE_QUOTE_HASH_MISMATCH",
                "证据摘录与 quotedHash 不一致",
                resolved_request_id,
                evidence_id,
                version_id,
                "stale",
            )

        return {
            "status": "available",
            "citation": {
                "citationId": citation_id,
                "evidenceId": evidence_id,
                "datasetId": self._manifest.get("datasetId"),
                "versionId": version_id,
                "status": "available",
            },
            "source": dict(source),
            "chunk": dict(chunk),
            "evidence": dict(evidence),
            "quote": quote,
            "offsets": {
                "source": {"start": chunk_start, "end": chunk_end},
                "evidence": {"start": evidence_start, "end": evidence_end},
            },
            "quoteFingerprint": quote_fingerprint.to_dict(),
        }

    def _expected_source_id(
        self,
        source: Mapping[str, Any],
        request_id: str,
        object_id: str,
        version_id: str,
    ) -> str:
        schema_version = self._manifest.get("schemaVersion")
        if schema_version == LEGACY_MANIFEST_SCHEMA_VERSION:
            return f"source:{self._manifest.get('datasetId')}:{source.get('contentHash')}"
        try:
            content_hash = SourceOccurrenceIdentity.normalize_content_hash(
                source.get("contentHash")
            )
            if source.get("contentHash") != content_hash:
                raise ValueError("Schema 2.0 contentHash 不是规范表示")
            return SourceOccurrenceIdentity.v2(
                self._manifest.get("datasetId"),
                source.get("resourceKey"),
                content_hash,
            )
        except (TypeError, ValueError):
            self._raise(
                "LINEAGE_STALE",
                "Schema 2.0 source occurrence 身份不完整",
                request_id,
                object_id,
                version_id,
                "stale",
            )

    def _find_record(
        self, collection: str, id_field: str, object_id: Any
    ) -> Mapping[str, Any] | None:
        records = self._manifest.get(collection)
        if not isinstance(records, list):
            return None
        matches = [
            item
            for item in records
            if isinstance(item, Mapping) and item.get(id_field) == object_id
        ]
        return matches[0] if len(matches) == 1 else None

    def _load_snapshot(self, snapshot_id: str) -> SnapshotValue | None:
        try:
            if isinstance(self._snapshot_loader, Mapping):
                return self._snapshot_loader.get(snapshot_id)
            return self._snapshot_loader(snapshot_id)
        except (FileNotFoundError, KeyError, OSError):
            return None

    @classmethod
    def _snapshot_bytes(
        cls,
        snapshot: SnapshotValue,
        snapshot_id: str,
        request_id: str,
        version_id: str,
    ) -> bytes:
        if isinstance(snapshot, str):
            return snapshot.encode("utf-8")
        if isinstance(snapshot, (bytes, bytearray, memoryview)):
            return bytes(snapshot)
        cls._raise(
            "LINEAGE_STALE",
            "原文快照类型不受支持",
            request_id,
            snapshot_id,
            version_id,
            "stale",
        )

    @classmethod
    def _require_record_fingerprint(
        cls,
        record: Mapping[str, Any],
        object_id: str,
        request_id: str,
        version_id: str,
    ) -> None:
        expected = FingerprintService.hash_json(
            {
                key: value
                for key, value in record.items()
                if key != "recordFingerprint"
            }
        )
        actual = record.get("recordFingerprint")
        if not isinstance(actual, Mapping) or not FingerprintService.matches(
            actual, expected
        ):
            cls._raise(
                "LINEAGE_STALE",
                "lineage 记录指纹不一致",
                request_id,
                object_id,
                version_id,
                "stale",
            )

    def _require_scope(
        self,
        record: Mapping[str, Any],
        request_id: str,
        object_id: str,
        version_id: str,
    ) -> None:
        if (
            record.get("datasetId") != self._manifest.get("datasetId")
            or record.get("versionId") != version_id
        ):
            self._raise(
                "LINEAGE_STALE",
                "lineage 记录超出当前数据集或版本范围",
                request_id,
                object_id,
                version_id,
                "stale",
            )

    @classmethod
    def _require_stable_reference(
        cls,
        record: Mapping[str, Any],
        id_field: str,
        expected_id: str,
        request_id: str,
        version_id: str,
    ) -> None:
        if record.get(id_field) != expected_id:
            cls._raise(
                "LINEAGE_STALE",
                "lineage 稳定引用不一致",
                request_id,
                str(record.get(id_field) or expected_id),
                version_id,
                "stale",
            )

    @classmethod
    def _validated_offset(
        cls,
        offset: Any,
        text_length: int,
        request_id: str,
        object_id: str,
        version_id: str,
    ) -> tuple[int, int]:
        if not isinstance(offset, Mapping):
            cls._invalid_offset(request_id, object_id, version_id)
        return cls._validated_span(
            offset.get("start"),
            offset.get("end"),
            text_length,
            request_id,
            object_id,
            version_id,
        )

    @classmethod
    def _validated_span(
        cls,
        start: Any,
        end: Any,
        text_length: int,
        request_id: str,
        object_id: str,
        version_id: str,
    ) -> tuple[int, int]:
        if (
            type(start) is not int
            or type(end) is not int
            or start < 0
            or end <= start
            or end > text_length
        ):
            cls._invalid_offset(request_id, object_id, version_id)
        return start, end

    @classmethod
    def _invalid_offset(
        cls, request_id: str, object_id: str, version_id: str
    ) -> None:
        cls._raise(
            "EVIDENCE_OFFSET_INVALID",
            "证据回放偏移越界或格式无效",
            request_id,
            object_id,
            version_id,
            "isolated",
        )

    @staticmethod
    def _hash_matches(expected: Any, payload: bytes) -> bool:
        if not isinstance(expected, str):
            return False
        digest = hashlib.sha256(payload).hexdigest()
        normalized = expected.lower()
        for prefix in ("sha256-v1:", "sha256:"):
            if normalized.startswith(prefix):
                normalized = normalized[len(prefix) :]
                break
        return len(normalized) == 64 and hmac.compare_digest(normalized, digest)

    @staticmethod
    def _raise(
        code: str,
        message: str,
        request_id: str,
        object_id: str,
        version_id: str,
        status: str,
    ) -> None:
        raise EvidenceReplayError(
            code,
            message,
            request_id=request_id,
            object_id=object_id,
            version_id=version_id,
            status=status,
        )
