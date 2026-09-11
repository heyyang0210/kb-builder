"""本地素材上传会话和分片存储服务。"""

from __future__ import annotations

import hashlib
import hmac
import json
import math
import re
import shutil
import threading
import uuid
from datetime import timedelta
from pathlib import Path, PurePosixPath
from typing import Any

from .config import settings
from .models import (
    MaterialBatch,
    MaterialSourceRecord,
    SourceSnapshot,
    UploadFileCreate,
    UploadFileSnapshot,
    UploadSession,
    UploadSessionCreate,
)
from .services import utcnow
from .store import JsonStore


class UploadServiceError(ValueError):
    pass


class UploadAuthorizationError(PermissionError):
    pass


class UploadService:
    def __init__(self, store: JsonStore):
        self.store = store
        self.root = settings.data_root / "staging" / "uploads"
        self.root.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._idempotency: dict[str, str] = {}
        self._batch_idempotency: dict[str, str] = {}

    def authorize(self, token: str | None) -> str:
        return "local"

    def create(self, request: UploadSessionCreate, token: str, idempotency_key: str | None) -> UploadSession:
        token_id = self.authorize(token)
        if request.total_bytes > settings.upload_max_session_size:
            raise UploadServiceError("上传会话超过最大大小限制")
        if request.total_files > settings.upload_max_files:
            raise UploadServiceError("上传会话超过最大文件数限制")
        with self._lock:
            if idempotency_key and idempotency_key in self._idempotency:
                return self.get(self._idempotency[idempotency_key])
            session_id = f"upload_{uuid.uuid4().hex[:16]}"
            now = utcnow()
            record = {
                "id": session_id,
                "name": request.name,
                "operatorLabel": request.operator_label,
                "state": "created",
                "totalFiles": request.total_files,
                "totalBytes": request.total_bytes,
                "uploadedBytes": 0,
                "chunkSize": settings.upload_chunk_size,
                "maxFileSize": settings.upload_max_file_size,
                "maxSessionSize": settings.upload_max_session_size,
                "expiresAt": (now + timedelta(days=settings.upload_retention_days)).isoformat(),
                "createdAt": now.isoformat(),
                "updatedAt": now.isoformat(),
                "files": [],
                "tokenId": token_id,
            }
            self.store.put_record("uploadSessions", session_id, record)
            self._session_dir(session_id).mkdir(parents=True, exist_ok=True)
            if idempotency_key:
                self._idempotency[idempotency_key] = session_id
            return self._model(record)

    def list_page(self, page: int, page_size: int, token: str) -> dict[str, Any]:
        self.authorize(token)
        sessions = [self._model(item) for item in self.store.list_records("uploadSessions")]
        sessions.sort(key=lambda item: item.updated_at, reverse=True)
        start = (page - 1) * page_size
        return {
            "items": sessions[start : start + page_size],
            "page": page,
            "pageSize": page_size,
            "total": len(sessions),
            "hasMore": start + page_size < len(sessions),
        }

    def get(self, session_id: str, token: str | None = None) -> UploadSession:
        if token is not None:
            self.authorize(token)
        record = self.store.get_record("uploadSessions", session_id)
        if record is None:
            raise KeyError(session_id)
        return self._model(record)

    def add_file(self, session_id: str, request: UploadFileCreate, token: str) -> UploadFileSnapshot:
        self.authorize(token)
        with self._lock:
            session = self._record(session_id)
            self._ensure_mutable(session)
            self._validate_relative_path(request.relative_path)
            if request.size > settings.upload_max_file_size:
                raise UploadServiceError("文件超过最大大小限制")
            files = session.setdefault("files", [])
            if len(files) >= settings.upload_max_files:
                raise UploadServiceError("上传会话超过最大文件数限制")
            if any(item["relativePath"] == request.relative_path for item in files):
                raise UploadServiceError(f"会话中存在重复路径：{request.relative_path}")
            declared_size = sum(int(item["size"]) for item in files) + request.size
            if declared_size > int(session["maxSessionSize"]):
                raise UploadServiceError("文件总大小超过会话限制")
            chunk_count = math.ceil(request.size / int(session["chunkSize"])) if request.size else 0
            file_id = f"file_{uuid.uuid4().hex[:16]}"
            item = {
                "id": file_id,
                "relativePath": request.relative_path,
                "size": request.size,
                "sha256": request.sha256,
                "mediaType": request.media_type,
                "chunkCount": chunk_count,
                "receivedChunks": [],
                "missingChunks": list(range(chunk_count)),
                "state": "pending",
                "assembledPath": None,
                "error": None,
            }
            files.append(item)
            session["state"] = "uploading"
            self._save_session(session)
            self._file_dir(session_id, file_id).mkdir(parents=True, exist_ok=True)
            return UploadFileSnapshot.model_validate(item)

    def write_chunk(
        self,
        session_id: str,
        file_id: str,
        chunk_index: int,
        content: bytes,
        chunk_sha256: str | None,
        content_range: str | None,
        token: str,
    ) -> UploadFileSnapshot:
        self.authorize(token)
        with self._lock:
            session = self._record(session_id)
            self._ensure_mutable(session)
            item = self._file_record(session, file_id)
            chunk_count = int(item["chunkCount"])
            if chunk_index < 0 or chunk_index >= chunk_count:
                raise UploadServiceError("分片编号超出范围")
            expected_length = int(session["chunkSize"])
            if chunk_index < chunk_count - 1 and len(content) != expected_length:
                raise UploadServiceError("非末尾分片大小不正确")
            if chunk_sha256:
                actual_hash = hashlib.sha256(content).hexdigest()
                if not hmac.compare_digest(actual_hash, chunk_sha256.lower()):
                    raise UploadServiceError("分片 SHA-256 校验失败")
            if content_range and not self._valid_content_range(content_range, item, chunk_index, len(content), int(session["chunkSize"])):
                raise UploadServiceError("Content-Range 与分片内容不匹配")
            part_path = self._file_dir(session_id, file_id) / "chunks" / f"{chunk_index:08d}.part"
            part_path.parent.mkdir(parents=True, exist_ok=True)
            temporary = part_path.with_suffix(".tmp")
            temporary.write_bytes(content)
            temporary.replace(part_path)
            received = set(item.get("receivedChunks", []))
            received.add(chunk_index)
            item["receivedChunks"] = sorted(received)
            item["missingChunks"] = [index for index in range(chunk_count) if index not in received]
            item["state"] = "assembled" if not item["missingChunks"] else "uploading"
            self._save_session(session)
            return UploadFileSnapshot.model_validate(item)

    def complete_file(self, session_id: str, file_id: str, token: str) -> UploadFileSnapshot:
        self.authorize(token)
        with self._lock:
            session = self._record(session_id)
            self._ensure_mutable(session)
            item = self._file_record(session, file_id)
            if item["missingChunks"]:
                raise UploadServiceError("文件仍缺少分片")
            file_dir = self._file_dir(session_id, file_id)
            assembled = file_dir / "assembled" / Path(item["relativePath"]).name
            assembled.parent.mkdir(parents=True, exist_ok=True)
            temporary = assembled.with_suffix(assembled.suffix + ".assembling")
            digest = hashlib.sha256()
            total = 0
            with temporary.open("wb") as output:
                for index in range(int(item["chunkCount"])):
                    part = file_dir / "chunks" / f"{index:08d}.part"
                    data = part.read_bytes()
                    total += len(data)
                    digest.update(data)
                    output.write(data)
            actual_hash = digest.hexdigest()
            if total != int(item["size"]):
                temporary.unlink(missing_ok=True)
                raise UploadServiceError("组装后文件大小不匹配")
            if item.get("sha256") and not hmac.compare_digest(actual_hash, item["sha256"].lower()):
                temporary.unlink(missing_ok=True)
                item["state"] = "rejected"
                item["error"] = "文件 SHA-256 校验失败"
                self._save_session(session)
                raise UploadServiceError("文件 SHA-256 校验失败")
            temporary.replace(assembled)
            item["assembledPath"] = self._relative_to_data_root(assembled)
            item["sha256"] = actual_hash
            item["state"] = "verified"
            item["error"] = None
            self._save_session(session)
            return UploadFileSnapshot.model_validate(item)

    def complete_session(self, session_id: str, token: str) -> UploadSession:
        self.authorize(token)
        with self._lock:
            session = self._record(session_id)
            self._ensure_mutable(session)
            session["state"] = "verifying"
            self._save_session(session)
            files = session.get("files", [])
            if len(files) != int(session["totalFiles"]):
                session["state"] = "failed"
                self._save_session(session)
                raise UploadServiceError("登记文件数与会话声明不一致")
            if any(item["state"] != "verified" for item in files):
                session["state"] = "failed"
                self._save_session(session)
                raise UploadServiceError("仍有文件未完成校验")
            actual_bytes = sum(int(item["size"]) for item in files)
            if actual_bytes != int(session["totalBytes"]):
                session["state"] = "failed"
                self._save_session(session)
                raise UploadServiceError("文件总大小与会话声明不一致")
            manifest = {
                "sessionId": session_id,
                "createdAt": session["createdAt"],
                "completedAt": utcnow().isoformat(),
                "files": files,
            }
            manifest_path = self._session_dir(session_id) / "manifest.json"
            manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
            session["state"] = "ready"
            session["uploadedBytes"] = actual_bytes
            session["manifestPath"] = self._relative_to_data_root(manifest_path)
            self._save_session(session)
            return self._model(session)

    def cancel(self, session_id: str, token: str) -> UploadSession:
        self.authorize(token)
        with self._lock:
            session = self._record(session_id)
            if session["state"] in {"ready", "cancelled", "expired"}:
                return self._model(session)
            session["state"] = "cancelled"
            self._save_session(session)
            return self._model(session)

    def create_batch(
        self,
        session_id: str,
        token: str,
        name: str | None = None,
        idempotency_key: str | None = None,
    ) -> MaterialBatch:
        self.authorize(token)
        with self._lock:
            session = self._record(session_id)
            if session["state"] != "ready":
                raise UploadServiceError("上传会话尚未完成校验")
            if session.get("batchId"):
                return self._get_batch(session["batchId"])
            if idempotency_key and idempotency_key in self._batch_idempotency:
                return self._get_batch(self._batch_idempotency[idempotency_key])
            batch_id = f"batch_{uuid.uuid4().hex[:16]}"
            batch_root = settings.data_root / "batches" / batch_id
            files_root = batch_root / "original" / "files"
            files_root.mkdir(parents=True, exist_ok=True)
            resources: list[dict[str, Any]] = []
            for item in session.get("files", []):
                source_path = settings.data_root / item["assembledPath"]
                relative_path = PurePosixPath(item["relativePath"])
                destination = (files_root / Path(*relative_path.parts)).resolve()
                if files_root.resolve() not in destination.parents:
                    raise UploadServiceError("上传文件目标路径不安全")
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source_path, destination)
                logical_path = destination.relative_to(settings.data_root).as_posix()
                resources.append(
                    {
                        "id": item["id"],
                        "batchId": batch_id,
                        "name": Path(item["relativePath"]).name,
                        "logicalPath": logical_path,
                        "kind": "attachment",
                        "sourceType": "upload",
                        "sourcePath": item["relativePath"],
                        "size": item["size"],
                        "sha256": item["sha256"],
                    }
                )
            (batch_root / "resources.json").write_text(
                json.dumps(resources, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            source = MaterialSourceRecord(
                source_type="upload",
                source_id=session_id,
                display_name=session["name"],
                captured_at=session["createdAt"],
                metadata={"manifestPath": session.get("manifestPath")},
            )
            snapshot = SourceSnapshot(
                captured_at=session["createdAt"],
                completeness="complete",
                estimated_pages=0,
                estimated_attachments=len(resources),
                estimated_bytes=int(session["totalBytes"]),
            )
            now = utcnow()
            batch = MaterialBatch(
                id=batch_id,
                name=name or session["name"],
                state="uploaded",
                source_snapshot=snapshot,
                source=source,
                created_at=now,
                updated_at=now,
            )
            self.store.put_record("batches", batch_id, batch.model_dump(mode="json", by_alias=True))
            session["batchId"] = batch_id
            self._save_session(session)
            if idempotency_key:
                self._batch_idempotency[idempotency_key] = batch_id
            return batch

    def _get_batch(self, batch_id: str) -> MaterialBatch:
        record = self.store.get_record("batches", batch_id)
        if record is None:
            raise KeyError(batch_id)
        return MaterialBatch.model_validate(record)

    def _record(self, session_id: str) -> dict[str, Any]:
        record = self.store.get_record("uploadSessions", session_id)
        if record is None:
            raise KeyError(session_id)
        return record

    @staticmethod
    def _model(record: dict[str, Any]) -> UploadSession:
        return UploadSession.model_validate(record)

    @staticmethod
    def _file_record(session: dict[str, Any], file_id: str) -> dict[str, Any]:
        for item in session.get("files", []):
            if item["id"] == file_id:
                return item
        raise KeyError(file_id)

    @staticmethod
    def _ensure_mutable(session: dict[str, Any]) -> None:
        if session["state"] in {"cancelled", "expired", "ready", "failed"}:
            raise UploadServiceError(f"会话当前不可修改：{session['state']}")

    def _save_session(self, session: dict[str, Any]) -> None:
        session["updatedAt"] = utcnow().isoformat()
        session["uploadedBytes"] = sum(
            int(item["size"])
            for item in session.get("files", [])
            if item["state"] == "verified"
        )
        self.store.put_record("uploadSessions", session["id"], session)

    def _session_dir(self, session_id: str) -> Path:
        self._validate_id(session_id, "upload")
        return self.root / session_id

    def _file_dir(self, session_id: str, file_id: str) -> Path:
        self._validate_id(file_id, "file")
        return self._session_dir(session_id) / "files" / file_id

    @staticmethod
    def _validate_id(value: str, prefix: str) -> None:
        if not re.fullmatch(rf"{prefix}_[a-f0-9]{{16}}", value):
            raise UploadServiceError("非法资源标识")

    @staticmethod
    def _validate_relative_path(value: str) -> None:
        normalized = value.replace("\\", "/")
        path = PurePosixPath(normalized)
        if normalized.startswith("/") or path.is_absolute() or ".." in path.parts:
            raise UploadServiceError("文件相对路径不安全")
        if not path.parts or any(not part or part in {".", ".."} for part in path.parts):
            raise UploadServiceError("文件相对路径无效")

    @staticmethod
    def _valid_content_range(
        value: str,
        item: dict[str, Any],
        chunk_index: int,
        length: int,
        chunk_size: int,
    ) -> bool:
        match = re.fullmatch(r"bytes (\d+)-(\d+)/(\d+)", value.strip())
        if not match:
            return False
        start, end, total = map(int, match.groups())
        expected_start = chunk_index * chunk_size
        return (
            start == expected_start
            and end - start + 1 == length
            and total == int(item["size"])
        )

    @staticmethod
    def _relative_to_data_root(path: Path) -> str:
        return path.resolve().relative_to(settings.data_root.resolve()).as_posix()
