"""Deterministic fingerprints for publishable knowledge-base components."""

from __future__ import annotations

from typing import Any, Mapping

from .lineage_manifest import FingerprintService


VERSION_FINGERPRINT_SCHEMA_VERSION = "1.0"
AVAILABLE = "available"
NOT_APPLICABLE = "not_applicable"


class VersionFingerprint:
    """Build and verify one composite graph/index/rule/model/embedding identity."""

    _REQUIRED = ("graph", "index", "rule")
    _OPTIONAL = ("model", "embedding")
    _FIELD_NAMES = {
        "graph": "graphVersion",
        "index": "indexVersion",
        "rule": "ruleVersion",
        "model": "modelVersion",
        "embedding": "embeddingVersion",
    }

    @classmethod
    def build(
        cls,
        graph: Any,
        index: Any,
        rule: Any,
        model: Any | None = None,
        embedding: Any | None = None,
    ) -> dict[str, Any]:
        components = {
            "graph": graph,
            "index": index,
            "rule": rule,
            "model": model,
            "embedding": embedding,
        }
        for name in cls._REQUIRED:
            if components[name] is None:
                raise ValueError(f"{name} 版本指纹输入不能为空")

        result: dict[str, Any] = {
            "schemaVersion": VERSION_FINGERPRINT_SCHEMA_VERSION,
            "status": {},
        }
        for name, value in components.items():
            field = cls._FIELD_NAMES[name]
            if value is None:
                result[field] = None
                result["status"][name] = NOT_APPLICABLE
            else:
                result[field] = FingerprintService.hash_json(value).to_dict()
                result["status"][name] = AVAILABLE

        result["versionFingerprint"] = FingerprintService.hash_json(result).to_dict()
        return result

    @classmethod
    def verify(cls, value: Mapping[str, Any]) -> bool:
        if value.get("schemaVersion") != VERSION_FINGERPRINT_SCHEMA_VERSION:
            return False
        status = value.get("status")
        if not isinstance(status, Mapping):
            return False
        for name in cls._REQUIRED + cls._OPTIONAL:
            component = value.get(cls._FIELD_NAMES[name])
            component_status = status.get(name)
            if name in cls._REQUIRED and component_status != AVAILABLE:
                return False
            if component_status == NOT_APPLICABLE:
                if component is not None or name in cls._REQUIRED:
                    return False
            elif component_status == AVAILABLE:
                if not cls._valid_fingerprint_shape(component):
                    return False
            else:
                return False

        expected = FingerprintService.hash_json(
            {key: item for key, item in value.items() if key != "versionFingerprint"}
        )
        actual = value.get("versionFingerprint")
        return isinstance(actual, Mapping) and FingerprintService.matches(actual, expected)

    @staticmethod
    def _valid_fingerprint_shape(value: Any) -> bool:
        if not isinstance(value, Mapping):
            return False
        digest = value.get("digest")
        return (
            value.get("algorithm") == "sha256-v1"
            and isinstance(digest, str)
            and len(digest) == 64
            and all(character in "0123456789abcdef" for character in digest)
            and isinstance(value.get("byteLength"), int)
            and value["byteLength"] >= 0
        )
