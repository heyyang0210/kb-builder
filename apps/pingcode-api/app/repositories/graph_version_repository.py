from __future__ import annotations

import fcntl
import hashlib
import json
import os
import shutil
import tempfile
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator


class GraphVersionRepositoryError(RuntimeError):
    pass


class GraphVersionNotFoundError(GraphVersionRepositoryError):
    pass


class GraphVersionIntegrityError(GraphVersionRepositoryError):
    def __init__(self, graph_version_id: str, message: str):
        super().__init__(message)
        self.graph_version_id = graph_version_id


class GraphVersionRepository:
    """以确定性版本 ID、staging 和原子目录提交保存正式图谱快照。"""

    _ARTIFACTS = {
        "nodes": "nodes.json",
        "edges": "edges.json",
        "summary": "summary.json",
        "checks": "checks.json",
    }

    def __init__(self, data_root: Path):
        self.root = Path(data_root) / "graph-versions"

    @staticmethod
    def source_fingerprint(nodes: list[dict[str, Any]], edges: list[dict[str, Any]]) -> str:
        digest = hashlib.sha256()
        digest.update(GraphVersionRepository._canonical_bytes(nodes))
        digest.update(b"\n")
        digest.update(GraphVersionRepository._canonical_bytes(edges))
        return f"sha256:{digest.hexdigest()}"

    @staticmethod
    def version_id(idempotency_key: str) -> str:
        digest = hashlib.sha256(idempotency_key.encode("utf-8")).hexdigest()
        return f"graph_version_{digest[:24]}"

    def create(
        self,
        *,
        idempotency_key: str,
        metadata: dict[str, Any],
        nodes: list[dict[str, Any]],
        edges: list[dict[str, Any]],
        summary: dict[str, Any],
        checks: dict[str, Any],
        health: dict[str, Any],
        rules_snapshot: dict[str, Any],
    ) -> tuple[dict[str, Any], bool]:
        graph_version_id = self.version_id(idempotency_key)
        self.root.mkdir(parents=True, exist_ok=True)
        with self._lock(graph_version_id):
            final_root = self._version_root(graph_version_id)
            if final_root.is_dir():
                return self.read_verified(graph_version_id), False

            self._validate_graph(graph_version_id, nodes, edges)
            staging = Path(tempfile.mkdtemp(prefix=f".staging-{graph_version_id}-", dir=self.root))
            try:
                artifacts: dict[str, dict[str, Any]] = {}
                values = {"nodes": nodes, "edges": edges, "summary": summary, "checks": checks}
                for name, filename in self._ARTIFACTS.items():
                    payload = self._canonical_bytes(values[name])
                    self._write_bytes(staging / filename, payload)
                    artifact = {"path": filename, "sha256": hashlib.sha256(payload).hexdigest()}
                    if name in {"nodes", "edges"}:
                        artifact["count"] = len(values[name])
                    artifacts[name] = artifact
                manifest = {
                    **metadata,
                    "graphVersionId": graph_version_id,
                    "idempotencyKey": idempotency_key,
                    "sourceFingerprint": self.source_fingerprint(nodes, edges),
                    "artifacts": artifacts,
                    "health": health,
                    "publishChecks": {
                        "status": checks.get("status", "passed"),
                        "warningCount": checks.get("warningCount", 0),
                        "errorCount": checks.get("errorCount", 0),
                    },
                    "rulesSnapshot": rules_snapshot,
                }
                self._write_bytes(staging / "manifest.json", self._canonical_bytes(manifest))
                self._verify_root(staging, graph_version_id)
                os.replace(staging, final_root)
                self._make_read_only(final_root)
                self._fsync_directory(self.root)
            finally:
                if staging.exists():
                    shutil.rmtree(staging, ignore_errors=True)
            return self.read_verified(graph_version_id), True

    def read_manifest(self, graph_version_id: str, *, verify: bool = True) -> dict[str, Any]:
        root = self._version_root(graph_version_id)
        if not root.is_dir():
            raise GraphVersionNotFoundError(f"图谱版本不存在：{graph_version_id}")
        if verify:
            return self._verify_root(root, graph_version_id)
        return self._read_json(root / "manifest.json", dict, graph_version_id)

    def read_verified(self, graph_version_id: str) -> dict[str, Any]:
        return self.read_manifest(graph_version_id, verify=True)

    def read_artifact(self, graph_version_id: str, name: str) -> Any:
        if name not in self._ARTIFACTS:
            raise ValueError(f"未知版本产物：{name}")
        manifest = self.read_verified(graph_version_id)
        filename = manifest["artifacts"][name]["path"]
        expected = list if name in {"nodes", "edges"} else dict
        return self._read_json(self._version_root(graph_version_id) / filename, expected, graph_version_id)

    def list(self, dataset_id: str | None = None) -> list[dict[str, Any]]:
        if not self.root.is_dir():
            return []
        items: list[dict[str, Any]] = []
        for path in self.root.iterdir():
            if not path.is_dir() or path.name.startswith("."):
                continue
            try:
                manifest = self.read_manifest(path.name, verify=False)
            except GraphVersionRepositoryError as exc:
                if dataset_id is None:
                    items.append({"graphVersionId": path.name, "integrity": "corrupted", "integrityMessage": str(exc)})
                continue
            if dataset_id and manifest.get("datasetId") != dataset_id:
                continue
            items.append({**manifest, "integrity": "available"})
        return sorted(items, key=lambda item: (str(item.get("createdAt") or ""), str(item.get("graphVersionId") or "")), reverse=True)

    def _verify_root(self, root: Path, graph_version_id: str) -> dict[str, Any]:
        manifest = self._read_json(root / "manifest.json", dict, graph_version_id)
        if manifest.get("graphVersionId") != graph_version_id:
            raise GraphVersionIntegrityError(graph_version_id, "manifest 版本 ID 与目录不一致")
        artifacts = manifest.get("artifacts")
        if not isinstance(artifacts, dict):
            raise GraphVersionIntegrityError(graph_version_id, "manifest 缺少产物索引")
        values: dict[str, Any] = {}
        for name, default_filename in self._ARTIFACTS.items():
            artifact = artifacts.get(name)
            if not isinstance(artifact, dict) or artifact.get("path") != default_filename:
                raise GraphVersionIntegrityError(graph_version_id, f"{name} 产物索引非法")
            path = root / default_filename
            try:
                payload = path.read_bytes()
            except OSError as exc:
                raise GraphVersionIntegrityError(graph_version_id, f"{name} 产物不可读") from exc
            if hashlib.sha256(payload).hexdigest() != artifact.get("sha256"):
                raise GraphVersionIntegrityError(graph_version_id, f"{name} 产物哈希不一致")
            expected = list if name in {"nodes", "edges"} else dict
            values[name] = self._decode_json(payload, expected, graph_version_id, name)
            if name in {"nodes", "edges"} and artifact.get("count") != len(values[name]):
                raise GraphVersionIntegrityError(graph_version_id, f"{name} 产物计数不一致")
        self._validate_graph(graph_version_id, values["nodes"], values["edges"])
        if manifest.get("sourceFingerprint") != self.source_fingerprint(values["nodes"], values["edges"]):
            raise GraphVersionIntegrityError(graph_version_id, "图谱来源指纹不一致")
        return manifest

    @staticmethod
    def _validate_graph(graph_version_id: str, nodes: list[dict[str, Any]], edges: list[dict[str, Any]]) -> None:
        node_ids = [str(item.get("id") or "") for item in nodes]
        if any(not value for value in node_ids) or len(set(node_ids)) != len(node_ids):
            raise GraphVersionIntegrityError(graph_version_id, "节点 ID 缺失或重复")
        edge_ids = [str(item.get("id") or "") for item in edges]
        if any(not value for value in edge_ids) or len(set(edge_ids)) != len(edge_ids):
            raise GraphVersionIntegrityError(graph_version_id, "关系 ID 缺失或重复")
        known = set(node_ids)
        if any(str(edge.get("source") or "") not in known or str(edge.get("target") or "") not in known for edge in edges):
            raise GraphVersionIntegrityError(graph_version_id, "关系存在缺失端点")

    def _version_root(self, graph_version_id: str) -> Path:
        self._validate_id(graph_version_id)
        return self.root / graph_version_id

    @contextmanager
    def _lock(self, graph_version_id: str) -> Iterator[None]:
        lock_root = self.root / ".locks"
        lock_root.mkdir(parents=True, exist_ok=True)
        with (lock_root / f"{graph_version_id}.lock").open("a+b") as handle:
            fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
            try:
                yield
            finally:
                fcntl.flock(handle.fileno(), fcntl.LOCK_UN)

    @staticmethod
    def _validate_id(value: str) -> None:
        if not value or value in {".", ".."} or Path(value).name != value:
            raise ValueError("graph_version_id 必须是不含路径分隔符的非空标识")

    @staticmethod
    def _canonical_bytes(value: Any) -> bytes:
        return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8")

    @staticmethod
    def _write_bytes(path: Path, payload: bytes) -> None:
        with path.open("wb") as output:
            output.write(payload)
            output.flush()
            os.fsync(output.fileno())

    @classmethod
    def _read_json(cls, path: Path, expected: type, graph_version_id: str) -> Any:
        try:
            payload = path.read_bytes()
        except OSError as exc:
            raise GraphVersionIntegrityError(graph_version_id, f"版本文件不可读：{path.name}") from exc
        return cls._decode_json(payload, expected, graph_version_id, path.name)

    @staticmethod
    def _decode_json(payload: bytes, expected: type, graph_version_id: str, name: str) -> Any:
        try:
            value = json.loads(payload.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise GraphVersionIntegrityError(graph_version_id, f"版本文件 JSON 损坏：{name}") from exc
        if not isinstance(value, expected):
            raise GraphVersionIntegrityError(graph_version_id, f"版本文件类型错误：{name}")
        return value

    @staticmethod
    def _make_read_only(root: Path) -> None:
        for path in root.iterdir():
            if path.is_file():
                path.chmod(0o444)
        root.chmod(0o555)

    @staticmethod
    def _fsync_directory(path: Path) -> None:
        descriptor = os.open(path, os.O_RDONLY)
        try:
            os.fsync(descriptor)
        finally:
            os.close(descriptor)
