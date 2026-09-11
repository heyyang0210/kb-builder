from __future__ import annotations

import hashlib
import json
import os
import tempfile
from fnmatch import fnmatchcase
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any, Iterable


class ContractError(RuntimeError):
    """Raised when an input or persisted artifact violates its contract."""


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def load_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ContractError(f"Missing JSON file: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ContractError(f"Invalid JSON file {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise ContractError(f"Expected JSON object: {path}")
    return value


def canonical_json(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def digest_value(value: Any) -> str:
    return hashlib.sha256(canonical_json(value)).hexdigest()


def digest_file(path: Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def atomic_write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    temporary_path = Path(temporary)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary_path, path)
        directory_fd = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(directory_fd)
        finally:
            os.close(directory_fd)
    finally:
        if temporary_path.exists():
            temporary_path.unlink()


def atomic_write_json(path: Path, value: Any) -> None:
    atomic_write_text(path, json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n")


def validate_policy(policy: dict[str, Any]) -> None:
    required = {"schemaVersion", "contextRoot", "auditRoot", "inventory", "modules"}
    missing = sorted(required - policy.keys())
    if missing:
        raise ContractError(f"Governance policy missing fields: {', '.join(missing)}")
    if policy["schemaVersion"] != "doc-governance/v1":
        raise ContractError(f"Unsupported policy schema: {policy['schemaVersion']}")
    if not isinstance(policy["modules"], dict) or not policy["modules"]:
        raise ContractError("Governance policy must define at least one module")
    inventory = policy["inventory"]
    if not isinstance(inventory, dict) or not isinstance(inventory.get("include"), list):
        raise ContractError("inventory.include must be a list")
    for module_id, module in policy["modules"].items():
        if not isinstance(module, dict):
            raise ContractError(f"Module {module_id} must be an object")
        for key in ("codeGlobs", "documentGlobs", "intentGlobs", "verificationGlobs"):
            if not isinstance(module.get(key, []), list):
                raise ContractError(f"Module {module_id}.{key} must be a list")


def load_policy(repo: Path, config: str | None) -> tuple[Path, dict[str, Any]]:
    path = Path(config) if config else Path(".codex/config/doc-governance.json")
    if not path.is_absolute():
        path = repo / path
    policy = load_json(path)
    validate_policy(policy)
    return path.resolve(), policy


def match_path(path: str, patterns: Iterable[str]) -> bool:
    normalized_path = path.replace("\\", "/").lstrip("./")
    for pattern in patterns:
        normalized_pattern = str(pattern).replace("\\", "/").lstrip("./")
        if fnmatchcase(normalized_path, normalized_pattern):
            return True
        if normalized_pattern.endswith("/**"):
            base = normalized_pattern[:-3].rstrip("/")
            if base.startswith("**/"):
                segment = base[3:]
                if f"/{segment}/" in f"/{normalized_path}/" or normalized_path == segment:
                    return True
            elif normalized_path == base or normalized_path.startswith(f"{base}/"):
                return True
        if normalized_pattern.startswith("**/") and fnmatchcase(normalized_path, normalized_pattern[3:]):
            return True
    return False


def resolve_repo_path(repo: Path, value: str | None, default: str) -> Path:
    path = Path(value or default)
    return path if path.is_absolute() else repo / path
