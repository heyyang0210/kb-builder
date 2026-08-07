from __future__ import annotations

import hashlib
import json
import mimetypes
import os
import re
import subprocess
import shutil
import threading
import zipfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable
from urllib.parse import quote
from xml.etree import ElementTree

from .config import settings
from .models import (
    BatchCreate,
    DatasetVersion,
    FilePreview,
    FileResource,
    MaterialBatch,
    PreprocessConfig,
    PreprocessPreviewRequest,
    PreprocessTaskCreate,
    ScanIssue,
    ScanReport,
    SpaceMapping,
    SpaceMappingUpdate,
    SourceSnapshot,
    MaterialSourceRecord,
    TaskSnapshot,
)
from .office_conversion import OfficeConversionResult, convert_office_to_markdown
from .office_text_stats import collect_ooxml_text_stats
from .pingcode_service import PingCodeService
from .store import JsonStore
from .markdown_cleaning import clean_markdown, html_to_markdown
from .processing_units import build_processing_units

def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class BatchService:
    SOURCE_TYPES = {"upload", "pingcode", "ticket", "repository", "object_storage", "unknown"}
    STATES = {"draft", "staging", "uploaded", "downloading", "downloaded", "processing", "ready", "failed"}
    COMPLETENESS = {"complete", "partial", "unknown"}
    OWNERSHIP_TYPES = {"temporary", "mapped", "unmapped"}

    def __init__(self, store: JsonStore, pingcode: PingCodeService):
        self.store = store
        self.pingcode = pingcode
        self._idempotency: dict[str, str] = {}

    def create(
        self,
        request: BatchCreate,
        idempotency_key: str | None,
        mapping: SpaceMapping,
    ) -> MaterialBatch:
        if idempotency_key and idempotency_key in self._idempotency:
            return self.get(self._idempotency[idempotency_key])
        snapshot = self.pingcode.estimate(request.source_selection)
        batch_id = f"batch_{uuid.uuid4().hex[:16]}"
        now = utcnow()
        batch = MaterialBatch(
            id=batch_id,
            name=request.name,
            state="draft",
            source_selection=request.source_selection,
            source_snapshot=snapshot,
            source=MaterialSourceRecord(
                source_type="pingcode",
                source_id=request.source_selection.space_key,
                display_name=request.source_selection.space_key,
                captured_at=snapshot.captured_at,
                metadata={"spaceKey": request.source_selection.space_key},
            ),
            local_space_name=mapping.local_name,
            local_space_logical_path=mapping.local_logical_path,
            created_at=now,
            updated_at=now,
        )
        self.store.put_record("batches", batch_id, batch.model_dump(mode="json", by_alias=True))
        if idempotency_key:
            self._idempotency[idempotency_key] = batch_id
        return batch

    def list(self) -> list[MaterialBatch]:
        batches = [MaterialBatch.model_validate(item) for item in self.store.list_records("batches")]
        return sorted(batches, key=lambda item: item.updated_at, reverse=True)

    def list_page(
        self,
        *,
        page: int,
        page_size: int,
        keyword: str | None = None,
        source_types: str | None = None,
        states: str | None = None,
        ownership_types: str | None = None,
        completeness: str | None = None,
        updated_from: datetime | None = None,
        updated_to: datetime | None = None,
        local_space: str | None = None,
        pingcode_space: str | None = None,
        has_active_task: bool | None = None,
        published: bool | None = None,
        sort: str = "updatedAt:desc",
    ) -> dict[str, Any]:
        all_batches = self.list()
        selected_source_types = self._filter_values(source_types, self.SOURCE_TYPES, "来源类型")
        selected_states = self._filter_values(states, self.STATES, "批次状态")
        selected_ownership = self._filter_values(ownership_types, self.OWNERSHIP_TYPES, "归属状态")
        selected_completeness = self._filter_values(completeness, self.COMPLETENESS, "来源完整性")
        normalized_keyword = (keyword or "").strip().casefold()
        local_space_query = (local_space or "").strip().casefold()
        pingcode_space_query = (pingcode_space or "").strip().casefold()
        updated_from = self._aware_datetime(updated_from)
        updated_to = self._aware_datetime(updated_to)

        filtered: list[tuple[MaterialBatch, dict[str, Any], dict[str, Any]]] = []
        for batch in all_batches:
            source = self._source_summary(batch)
            ownership = self._ownership_summary(batch, source["type"])
            if selected_source_types and source["type"] not in selected_source_types:
                continue
            if selected_states and batch.state not in selected_states:
                continue
            if selected_ownership and ownership["type"] not in selected_ownership:
                continue
            if selected_completeness and batch.source_snapshot.completeness not in selected_completeness:
                continue
            if updated_from and batch.updated_at < updated_from:
                continue
            if updated_to and batch.updated_at > updated_to:
                continue
            if has_active_task is not None and bool(batch.active_task_ids) != has_active_task:
                continue
            if published is not None and bool(batch.latest_dataset_version_id) != published:
                continue
            if local_space_query and not self._contains(
                local_space_query,
                batch.local_space_name,
                batch.local_space_logical_path,
            ):
                continue
            if pingcode_space_query and (
                source["type"] != "pingcode"
                or not self._contains(pingcode_space_query, source["name"], source["sourceId"])
            ):
                continue
            if normalized_keyword and not self._contains(
                normalized_keyword,
                batch.id,
                batch.name,
                source["name"],
                source["sourceId"],
                batch.local_space_name,
                batch.local_space_logical_path,
            ):
                continue
            filtered.append((batch, source, ownership))

        field, direction = self._sort_parts(sort)
        key_getters = {
            "updatedAt": lambda item: item[0].updated_at,
            "createdAt": lambda item: item[0].created_at,
            "name": lambda item: item[0].name.casefold(),
        }
        filtered.sort(key=key_getters[field], reverse=direction == "desc")
        start = (page - 1) * page_size
        items = []
        for batch, source, ownership in filtered[start : start + page_size]:
            items.append(self.serialize(batch, source=source, ownership=ownership))
        return {
            "items": items,
            "page": page,
            "pageSize": page_size,
            "total": len(filtered),
            "hasMore": start + page_size < len(filtered),
            "facets": self._facets(all_batches),
        }

    def get(self, batch_id: str) -> MaterialBatch:
        record = self.store.get_record("batches", batch_id)
        if record is None:
            raise KeyError(batch_id)
        return MaterialBatch.model_validate(record)

    def serialize(
        self,
        batch: MaterialBatch,
        *,
        source: dict[str, Any] | None = None,
        ownership: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        source = source or self._source_summary(batch)
        ownership = ownership or self._ownership_summary(batch, source["type"])
        item = batch.model_dump(mode="json", by_alias=True)
        item["sourceSummary"] = source
        item["ownershipSummary"] = ownership
        return item

    def update(self, batch_id: str, **changes: Any) -> MaterialBatch:
        changes["updatedAt"] = utcnow().isoformat()
        record = self.store.update_record("batches", batch_id, changes)
        if record is None:
            raise KeyError(batch_id)
        return MaterialBatch.model_validate(record)

    @classmethod
    def _facets(cls, batches: list[MaterialBatch]) -> dict[str, Any]:
        source_counts = {key: 0 for key in cls.SOURCE_TYPES}
        ownership_counts = {key: 0 for key in cls.OWNERSHIP_TYPES}
        failed = 0
        for batch in batches:
            source = cls._source_summary(batch)
            ownership = cls._ownership_summary(batch, source["type"])
            source_counts[source["type"]] += 1
            ownership_counts[ownership["type"]] += 1
            if batch.state == "failed":
                failed += 1
        return {
            "all": len(batches),
            "sourceTypes": source_counts,
            "ownership": ownership_counts,
            "failed": failed,
        }

    @staticmethod
    def _source_summary(batch: MaterialBatch) -> dict[str, Any]:
        if batch.source is not None:
            return {
                "type": batch.source.source_type,
                "typeLabel": {
                    "upload": "本地上传",
                    "pingcode": "PingCode",
                    "ticket": "工单",
                    "repository": "代码仓库",
                    "object_storage": "对象存储",
                }.get(batch.source.source_type, "来源未知"),
                "name": batch.source.display_name,
                "sourceId": batch.source.source_id,
                "legacy": False,
            }
        if batch.source_selection is not None:
            return {
                "type": "pingcode",
                "typeLabel": "PingCode",
                "name": batch.source_selection.space_key,
                "sourceId": batch.source_selection.space_key,
                "legacy": True,
            }
        return {
            "type": "unknown",
            "typeLabel": "来源未知",
            "name": "历史任务",
            "sourceId": batch.id,
            "legacy": True,
        }

    @staticmethod
    def _ownership_summary(batch: MaterialBatch, source_type: str) -> dict[str, Any]:
        if batch.local_space_name or batch.local_space_logical_path:
            return {
                "type": "mapped",
                "typeLabel": "已绑定",
                "name": batch.local_space_name or "本地素材空间",
                "logicalPath": batch.local_space_logical_path,
            }
        if source_type == "upload":
            return {
                "type": "temporary",
                "typeLabel": "临时区",
                "name": "临时区",
                "logicalPath": None,
            }
        return {
            "type": "unmapped",
            "typeLabel": "未映射",
            "name": "未映射",
            "logicalPath": None,
        }

    @staticmethod
    def _filter_values(value: str | None, allowed: set[str], label: str) -> set[str]:
        selected = {item.strip() for item in (value or "").split(",") if item.strip()}
        invalid = selected - allowed
        if invalid:
            raise ValueError(f"{label}不支持：{', '.join(sorted(invalid))}")
        return selected

    @staticmethod
    def _sort_parts(value: str) -> tuple[str, str]:
        try:
            field, direction = value.split(":", 1)
        except ValueError as exc:
            raise ValueError("排序参数格式应为 field:direction") from exc
        if field not in {"updatedAt", "createdAt", "name"} or direction not in {"asc", "desc"}:
            raise ValueError("不支持的批次排序参数")
        return field, direction

    @staticmethod
    def _aware_datetime(value: datetime | None) -> datetime | None:
        if value is not None and value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value

    @staticmethod
    def _contains(query: str, *values: str | None) -> bool:
        return any(query in str(value).casefold() for value in values if value)


class SpaceMappingService:
    def __init__(self, store: JsonStore):
        self.store = store

    def list(self) -> list[SpaceMapping]:
        return [
            SpaceMapping.model_validate(item)
            for item in self.store.list_records("spaceMappings")
        ]

    def get(self, space_key: str) -> SpaceMapping | None:
        record = self.store.get_record("spaceMappings", space_key)
        return SpaceMapping.model_validate(record) if record else None

    def upsert(
        self,
        remote_space: dict[str, Any],
        update: SpaceMappingUpdate,
    ) -> SpaceMapping:
        now = utcnow()
        current = self.get(remote_space["key"])
        mapping = SpaceMapping(
            space_key=remote_space["key"],
            remote_space_id=remote_space["id"],
            remote_name=remote_space["name"],
            local_name=update.local_name,
            local_slug=self._sanitize_slug(update.local_slug),
            local_logical_path=f"spaces/{self._sanitize_slug(update.local_slug)}",
            enabled=update.enabled,
            created_at=current.created_at if current else now,
            updated_at=now,
        )
        self.store.put_record(
            "spaceMappings",
            mapping.space_key,
            mapping.model_dump(mode="json", by_alias=True),
        )
        return mapping

    @staticmethod
    def _sanitize_slug(value: str) -> str:
        slug = re.sub(r"[^A-Za-z0-9._-]+", "-", value.strip()).strip("-.")
        if not slug:
            raise ValueError("本地目录标识只能包含字母、数字、点、下划线和连字符")
        return slug

class TaskEventBroker:
    def __init__(self):
        self._condition = threading.Condition()
        self._events: dict[str, list[dict[str, Any]]] = {}
        self._sequence = 0

    def publish(self, task: TaskSnapshot) -> None:
        self.publish_event(
            task.id,
            "task.progress",
            task.model_dump(mode="json", by_alias=True),
        )

    def publish_event(self, task_id: str, event_name: str, data: dict[str, Any]) -> None:
        with self._condition:
            self._sequence += 1
            event = {
                "id": self._sequence,
                "event": event_name,
                "data": data,
            }
            self._events.setdefault(task_id, []).append(event)
            self._condition.notify_all()

    def stream(self, task_id: str, last_event_id: int = 0):
        cursor = last_event_id
        while True:
            with self._condition:
                pending = [event for event in self._events.get(task_id, []) if event["id"] > cursor]
                if not pending:
                    self._condition.wait(timeout=15)
                    pending = [event for event in self._events.get(task_id, []) if event["id"] > cursor]
            if not pending:
                yield ": keep-alive\n\n"
                continue
            for event in pending:
                cursor = event["id"]
                payload = json.dumps(event["data"], ensure_ascii=False)
                yield f"id: {cursor}\nevent: {event['event']}\ndata: {payload}\n\n"


class TaskService:
    def __init__(self, store: JsonStore, batches: BatchService, pingcode: PingCodeService):
        self.store = store
        self.batches = batches
        self.pingcode = pingcode
        self.events = TaskEventBroker()
        self._idempotency: dict[str, str] = {}

    def create_download(self, batch_id: str, idempotency_key: str | None) -> TaskSnapshot:
        if idempotency_key and idempotency_key in self._idempotency:
            return self.get(self._idempotency[idempotency_key])
        batch = self.batches.get(batch_id)
        self._reset_download_state(batch)
        now = utcnow()
        task = TaskSnapshot(
            id=f"task_{uuid.uuid4().hex[:16]}",
            batch_id=batch_id,
            type="download",
            state="queued",
            stage="queued",
            total=batch.source_snapshot.estimated_pages,
            can_cancel=False,
            created_at=now,
            updated_at=now,
        )
        self._save(task)
        self.batches.update(
            batch_id,
            state="downloading",
            activeTaskIds=[*batch.active_task_ids, task.id],
        )
        if idempotency_key:
            self._idempotency[idempotency_key] = task.id
        threading.Thread(target=self._run_download, args=(task.id, "all"), daemon=True).start()
        return task

    def reconcile_interrupted(self) -> None:
        for task in self.list():
            if task.type != "download":
                continue
            pending_pages = int(task.progress_detail.get("pendingPages", 0) or 0)
            if task.state == "completed" and pending_pages > 0:
                updated = self._update_download_snapshot(
                    task.id,
                    state="interrupted",
                    stage="interrupted",
                    can_retry=task.failed > 0,
                    can_resume=True,
                    can_pause=False,
                    can_cancel=False,
                    message=f"还有 {pending_pages} 个页面未处理，可继续下载。",
                )
                try:
                    self.batches.update(task.batch_id, state="downloading", activeTaskIds=[task.id])
                except KeyError:
                    pass
                self.events.publish_event(
                    task.id,
                    "download.task.interrupted",
                    {
                        "taskId": task.id,
                        "batchId": task.batch_id,
                        "message": updated.message,
                        "completed": updated.completed,
                        "total": updated.total,
                        "failed": updated.failed,
                        "warnings": updated.warnings,
                    },
                )
                continue
            if task.state not in {"queued", "running"}:
                continue
            updated = self._update_download_snapshot(
                task.id,
                state="interrupted",
                stage="interrupted",
                can_retry=task.failed > 0,
                can_resume=True,
                can_pause=False,
                can_cancel=False,
                message="后端重启或进程退出，下载已暂停，可继续未完成页面。",
            )
            self.events.publish_event(
                task.id,
                "download.task.interrupted",
                {
                    "taskId": task.id,
                    "batchId": task.batch_id,
                    "message": updated.message,
                    "completed": updated.completed,
                    "total": updated.total,
                    "failed": updated.failed,
                    "warnings": updated.warnings,
                },
            )
            try:
                self.batches.update(task.batch_id, state="downloading", activeTaskIds=[task.id])
            except KeyError:
                pass

    def list(self, batch_id: str | None = None) -> list[TaskSnapshot]:
        tasks = [TaskSnapshot.model_validate(item) for item in self.store.list_records("tasks")]
        if batch_id:
            tasks = [item for item in tasks if item.batch_id == batch_id]
        return sorted(tasks, key=lambda item: item.updated_at, reverse=True)

    def get(self, task_id: str) -> TaskSnapshot:
        record = self.store.get_record("tasks", task_id)
        if record is None:
            raise KeyError(task_id)
        return TaskSnapshot.model_validate(record)

    def retry(self, task_id: str) -> TaskSnapshot:
        current = self.get(task_id)
        if current.state not in {"failed", "completed", "interrupted"}:
            return current
        updated = current.model_copy(
            update={"state": "queued", "message": None, "can_retry": False, "can_resume": False, "updated_at": utcnow()}
        )
        self._save(updated)
        threading.Thread(target=self._run_download, args=(task_id, "retry"), daemon=True).start()
        return updated

    def resume(self, task_id: str) -> TaskSnapshot:
        current = self.get(task_id)
        if current.state not in {"interrupted", "paused", "failed"}:
            return current
        updated = current.model_copy(
            update={"state": "queued", "message": None, "can_retry": False, "can_resume": False, "updated_at": utcnow()}
        )
        self._save(updated)
        threading.Thread(target=self._run_download, args=(task_id, "resume"), daemon=True).start()
        return updated

    def list_download_items(
        self,
        task_id: str,
        state: str | None,
        page: int,
        page_size: int,
    ) -> dict[str, Any]:
        task = self.get(task_id)
        if task.type != "download":
            raise ValueError("任务不是下载任务")
        batch = self.batches.get(task.batch_id)
        page_records = self._read_page_state(self._download_state_dir(batch) / "pages.jsonl")
        item_records = self._read_jsonl(self._download_state_dir(batch) / "items.jsonl")
        items: list[dict[str, Any]] = []
        for record in page_records.values():
            item_state = record.get("state")
            if state == "warning":
                if not record.get("warningCount"):
                    continue
                item_state = "warning"
            elif state and item_state != state:
                continue
            items.append({
                "pageId": record.get("pageId"),
                "pageName": record.get("pageName"),
                "assetType": "page",
                "state": item_state,
                "message": record.get("message"),
                "retryCount": record.get("retryCount", 0),
                "updatedAt": record.get("updatedAt"),
            })
        for record in item_records:
            item_state = record.get("state")
            if state and item_state != state:
                continue
            items.append({
                "pageId": record.get("pageId"),
                "pageName": record.get("pageName"),
                "assetType": record.get("assetType", record.get("kind", "resource")),
                "state": item_state,
                "name": record.get("name"),
                "message": record.get("message") or record.get("error"),
                "retryCount": record.get("retryCount", 0),
                "updatedAt": record.get("updatedAt"),
            })
        items.sort(key=lambda item: str(item.get("updatedAt") or ""), reverse=True)
        start = (page - 1) * page_size
        return {"items": items[start:start + page_size], "page": page, "pageSize": page_size, "total": len(items), "hasMore": start + page_size < len(items)}

    def _save(self, task: TaskSnapshot) -> None:
        self.store.put_record("tasks", task.id, task.model_dump(mode="json", by_alias=True))
        self.events.publish(task)

    def _update(self, task_id: str, **changes: Any) -> TaskSnapshot:
        task = self.get(task_id)
        updated = task.model_copy(update={**changes, "updated_at": utcnow()})
        self._save(updated)
        return updated

    def _run_download(self, task_id: str, mode: str = "all") -> None:
        task = self._update(
            task_id,
            state="running",
            stage="page_content",
            message=None,
            can_cancel=False,
            can_pause=False,
            can_resume=False,
        )
        batch = self.batches.get(task.batch_id)
        batch_dir = self._batch_dir(batch)
        pages_dir = batch_dir / "pages"
        assets_dir = batch_dir / "assets"
        files_dir = batch_dir / "files"
        pages_dir.mkdir(parents=True, exist_ok=True)
        assets_dir.mkdir(parents=True, exist_ok=True)
        files_dir.mkdir(parents=True, exist_ok=True)
        state_dir = self._download_state_dir(batch)
        state_dir.mkdir(parents=True, exist_ok=True)
        self._write_download_manifest(batch, state_dir, task_id)
        try:
            pages = self.pingcode.pages_for_batch(
                batch.source_selection.space_key,
                batch.source_snapshot.selected_page_ids,
            )
            total = len(pages)
            page_state = self._read_page_state(state_dir / "pages.jsonl")
            selected_pages = self._select_pages_for_download(pages, page_state, mode)
            skipped = total - len(selected_pages)
            summary = self._download_summary(page_state, total, skipped)
            self._update(
                task_id,
                total=total,
                completed=summary["completed"],
                failed=summary["failed"],
                warnings=summary["warnings"],
                progress_detail=summary["progressDetail"],
            )
            for index, page in enumerate(pages, 1):
                if page not in selected_pages:
                    continue
                started = utcnow()
                try:
                    page_resources = self._download_page(
                        batch, page, pages_dir, assets_dir, files_dir
                    )
                    page_warnings = sum(
                        1
                        for item in page_resources
                        if item.get("kind") == "error" and item.get("assetType") == "image"
                    )
                    page_warnings += sum(
                        1
                        for item in page_resources
                        if item.get("kind") == "error" and item.get("assetType") == "attachment"
                    )
                    self._append_download_items(state_dir, page_resources, task_id, page_warnings)
                    page_record = self._page_record(
                        task_id, page, "completed", started, page_resources, page_warnings
                    )
                    self._append_jsonl(state_dir / "pages.jsonl", page_record)
                    page_state[page["_id"]] = page_record
                    self.events.publish_event(task_id, "download.item.completed", self._event_item(page_record))
                    if page_warnings:
                        self.events.publish_event(task_id, "download.item.warning", self._event_item(page_record))
                except Exception as exc:
                    previous = page_state.get(page.get("_id"), {})
                    page_record = self._page_record(
                        task_id,
                        page,
                        "failed",
                        started,
                        [],
                        0,
                        message=str(exc),
                        retry_count=int(previous.get("retryCount", 0) or 0) + 1,
                    )
                    self._append_jsonl(state_dir / "pages.jsonl", page_record)
                    self._append_jsonl(state_dir / "items.jsonl", {**page_record, "assetType": "page", "kind": "error", "error": str(exc)})
                    page_state[page["_id"]] = page_record
                    self.events.publish_event(task_id, "download.item.failed", self._event_item(page_record))
                self._rewrite_resources_from_state(batch_dir, state_dir)
                summary = self._download_summary(page_state, total, skipped)
                self._update(
                    task_id,
                    completed=summary["completed"],
                    failed=summary["failed"],
                    warnings=summary["warnings"],
                    progress_detail=summary["progressDetail"],
                )
            self._rewrite_resources_from_state(batch_dir, state_dir)
            summary = self._download_summary(page_state, total, skipped)
            pending = summary["progressDetail"]["pendingPages"]
            final_state = "completed" if pending == 0 and summary["failed"] == 0 else "interrupted"
            self._update(
                task_id,
                state=final_state,
                stage="completed" if final_state == "completed" else "interrupted",
                can_retry=summary["failed"] > 0,
                can_resume=pending > 0 or summary["failed"] > 0,
                progress_detail=summary["progressDetail"],
                message=(
                    f"{summary['failed']} 个页面处理失败，{summary['warnings']} 个资源下载告警"
                    if summary["failed"]
                    else (
                        f"还有 {pending} 个页面未处理，可继续下载"
                        if pending
                        else (f"{summary['warnings']} 个资源下载告警" if summary["warnings"] else None)
                    )
                ),
            )
            self.batches.update(
                batch.id,
                state="downloaded" if final_state == "completed" else "downloading",
                activeTaskIds=[] if final_state == "completed" else [task_id],
            )
        except Exception as exc:
            self._update(
                task_id,
                state="failed",
                stage="failed",
                can_retry=True,
                can_resume=True,
                message=str(exc),
            )
            self.batches.update(batch.id, state="failed", activeTaskIds=[])

    def _batch_dir(self, batch: MaterialBatch) -> Path:
        space_root = batch.local_space_logical_path or "spaces/unmapped"
        return settings.data_root / space_root / "batches" / batch.id

    def _download_state_dir(self, batch: MaterialBatch) -> Path:
        return self._batch_dir(batch) / "download-state"

    def _reset_download_state(self, batch: MaterialBatch) -> None:
        batch_dir = self._batch_dir(batch)
        state_dir = batch_dir / "download-state"
        if state_dir.exists():
            shutil.rmtree(state_dir)
        resources = batch_dir / "resources.json"
        if resources.exists():
            resources.unlink()

    def _write_download_manifest(self, batch: MaterialBatch, state_dir: Path, task_id: str) -> None:
        payload = {
            "taskId": task_id,
            "batchId": batch.id,
            "spaceKey": batch.source_selection.space_key if batch.source_selection else None,
            "sourceSelectionHash": self._hash_json(
                batch.source_selection.model_dump(mode="json", by_alias=True)
                if batch.source_selection
                else {}
            ),
            "createdAt": utcnow().isoformat(),
        }
        self._write_json_atomic(state_dir / "run-manifest.json", payload)

    @staticmethod
    def _select_pages_for_download(
        pages: list[dict[str, Any]],
        page_state: dict[str, dict[str, Any]],
        mode: str,
    ) -> list[dict[str, Any]]:
        selected = []
        for page in pages:
            page_id = str(page.get("_id") or "")
            current = page_state.get(page_id, {})
            if mode == "retry":
                if current.get("state") == "failed":
                    selected.append(page)
                continue
            if mode == "all" or current.get("state") != "completed":
                selected.append(page)
        return selected

    @staticmethod
    def _download_summary(
        page_state: dict[str, dict[str, Any]],
        total: int,
        skipped: int,
    ) -> dict[str, Any]:
        completed = sum(1 for item in page_state.values() if item.get("state") == "completed")
        failed = sum(1 for item in page_state.values() if item.get("state") == "failed")
        warnings = sum(int(item.get("warningCount", 0) or 0) for item in page_state.values())
        pending = max(total - completed - failed, 0)
        return {
            "completed": completed,
            "failed": failed,
            "warnings": warnings,
            "progressDetail": {
                "completedPages": completed,
                "failedPages": failed,
                "pendingPages": pending,
                "warningItems": warnings,
                "skippedPages": skipped,
                "totalPages": total,
            },
        }

    @staticmethod
    def _page_record(
        task_id: str,
        page: dict[str, Any],
        state: str,
        started: datetime,
        resources: list[dict[str, Any]],
        warning_count: int,
        message: str | None = None,
        retry_count: int = 0,
    ) -> dict[str, Any]:
        completed = utcnow()
        return {
            "taskId": task_id,
            "pageId": page.get("_id"),
            "pageName": page.get("name", "未知页面"),
            "state": state,
            "resourceCount": sum(1 for item in resources if item.get("kind") != "error"),
            "warningCount": warning_count,
            "message": message,
            "retryCount": retry_count,
            "startedAt": started.isoformat(),
            "updatedAt": completed.isoformat(),
            "durationMs": int((completed - started).total_seconds() * 1000),
        }

    @staticmethod
    def _event_item(record: dict[str, Any]) -> dict[str, Any]:
        return {
            "taskId": record.get("taskId"),
            "pageId": record.get("pageId"),
            "pageName": record.get("pageName"),
            "state": record.get("state"),
            "message": record.get("message"),
            "retryCount": record.get("retryCount", 0),
            "durationMs": record.get("durationMs"),
            "warningCount": record.get("warningCount", 0),
        }

    def _append_download_items(
        self,
        state_dir: Path,
        resources: list[dict[str, Any]],
        task_id: str,
        page_warnings: int,
    ) -> None:
        updated_at = utcnow().isoformat()
        for resource in resources:
            state = "warning" if resource.get("kind") == "error" else "completed"
            record = {
                **resource,
                "taskId": task_id,
                "state": state,
                "message": resource.get("error"),
                "updatedAt": updated_at,
            }
            self._append_jsonl(state_dir / "items.jsonl", record)

    def _rewrite_resources_from_state(self, batch_dir: Path, state_dir: Path) -> None:
        resources = [
            item
            for item in self._read_jsonl(state_dir / "items.jsonl")
            if item.get("kind") != "error" and item.get("state") == "completed"
        ]
        self._write_json_atomic(batch_dir / "resources.json", resources)

    @staticmethod
    def _read_page_state(path: Path) -> dict[str, dict[str, Any]]:
        result: dict[str, dict[str, Any]] = {}
        for item in TaskService._read_jsonl(path):
            page_id = item.get("pageId")
            if page_id:
                result[str(page_id)] = item
        return result

    @staticmethod
    def _read_jsonl(path: Path) -> list[dict[str, Any]]:
        if not path.is_file():
            return []
        result: list[dict[str, Any]] = []
        for line in path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            try:
                value = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(value, dict):
                result.append(value)
        return result

    @staticmethod
    def _append_jsonl(path: Path, value: dict[str, Any]) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a", encoding="utf-8") as output:
            output.write(json.dumps(value, ensure_ascii=False) + "\n")

    @staticmethod
    def _write_json_atomic(path: Path, value: Any) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(path.suffix + ".tmp")
        temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
        temporary.replace(path)

    @staticmethod
    def _hash_json(value: Any) -> str:
        return "sha256:" + hashlib.sha256(
            json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
        ).hexdigest()

    def _update_download_snapshot(self, task_id: str, **changes: Any) -> TaskSnapshot:
        task = self.get(task_id)
        try:
            batch = self.batches.get(task.batch_id)
            page_state = self._read_page_state(self._download_state_dir(batch) / "pages.jsonl")
            summary = self._download_summary(page_state, task.total or 0, 0)
            changes.setdefault("completed", summary["completed"])
            changes.setdefault("failed", summary["failed"])
            changes.setdefault("warnings", summary["warnings"])
            changes.setdefault("progress_detail", summary["progressDetail"])
        except Exception:
            pass
        return self._update(task_id, **changes)

    def _download_page(
        self,
        batch: MaterialBatch,
        page: dict[str, Any],
        pages_dir: Path,
        assets_dir: Path,
        files_dir: Path,
    ) -> list[dict[str, Any]]:
        from pingcode.core.content_parser import ContentParser
        from pingcode.core.filename_utils import FilenameUtils
        from pingcode.core.attachment_policy import AttachmentPolicy

        page_id = page["_id"]
        page_name = page.get("name", "未知页面")
        resources: list[dict[str, Any]] = []
        parser = ContentParser()

        allowed_types = {item.lower().lstrip(".") for item in batch.source_selection.filters.file_types}

        def fetch(api):
            detail = api.get_page(page_id) if batch.source_selection.include_page_body else None
            image_data = []
            if detail:
                document = detail.get("data", {}).get("value", {}).get("document", {})
                for image in parser.extract_images(document):
                    try:
                        data, content_type = api.download_public_image(image)
                        image_data.append((image, data, content_type, None))
                    except Exception as exc:
                        image_data.append((image, b"", "", str(exc)))
            attachments = (
                api.get_attachments(page_id)
                if batch.source_selection.include_attachments
                else []
            )
            attachments = [
                item
                for item in attachments
                if AttachmentPolicy.should_download(item.get("title", ""), allowed_types)
            ]
            attachment_data = []
            for item in attachments:
                try:
                    attachment_data.append((item, api.download_attachment(item), None))
                except Exception as exc:
                    attachment_data.append((item, b"", str(exc)))
            return detail, image_data, attachment_data

        detail, image_data, attachment_data = self.pingcode.api_call(
            fetch, batch.source_selection.space_key if batch.source_selection else None
        )
        if detail:
            document = detail.get("data", {}).get("value", {}).get("document", {})
            image_urls: dict[str, str] = {}
            page_assets_dir = assets_dir / FilenameUtils.sanitize(page_name)
            for image, data, content_type, image_error in image_data:
                identity = self._image_identity(image)
                image_name = image.get("name") or "image"
                if image_error:
                    resources.append(
                        {
                            "kind": "error",
                            "assetType": "image",
                            "pageId": page_id,
                            "pageName": page_name,
                            "name": image_name,
                            "source": image.get("originUrl") or image.get("thumbUrl"),
                            "error": image_error,
                        }
                    )
                    continue
                extension = Path(image_name).suffix.lower()
                if not extension:
                    extension = mimetypes.guess_extension(content_type) or ".bin"
                stem = FilenameUtils.sanitize(Path(image_name).stem or "image")
                filename = FilenameUtils.truncate(stem, 150) + extension
                asset_path = self._stable_path(page_assets_dir, identity, filename)
                asset_path.write_bytes(data)
                asset_resource = self._resource(
                    batch.id, asset_path, "page_asset", page_id, page_name
                )
                resources.append(asset_resource)
                relative_url = os.path.relpath(asset_path, pages_dir).replace(os.sep, "/")
                image_urls[identity] = quote(relative_url, safe="/._-")

            markdown = parser.parse_document(
                document,
                image_resolver=lambda image: image_urls.get(self._image_identity(image)),
            )
            if markdown:
                filename = FilenameUtils.truncate(FilenameUtils.sanitize(page_name), 150) + ".md"
                path = self._stable_path(pages_dir, page_id, filename)
                path.write_text(markdown, encoding="utf-8")
                resources.append(self._resource(batch.id, path, "page", page_id, page_name))

        for attachment, data, attachment_error in attachment_data:
            title = attachment.get("title", "attachment")
            if attachment_error:
                resources.append(
                    {
                        "kind": "error",
                        "assetType": "attachment",
                        "pageId": page_id,
                        "pageName": page_name,
                        "name": title,
                        "error": attachment_error,
                    }
                )
                continue
            filename = FilenameUtils.truncate(FilenameUtils.sanitize(title), 180)
            attachment_id = str(attachment.get("_id") or attachment.get("id") or title)
            path = self._stable_path(files_dir / FilenameUtils.sanitize(page_name), attachment_id, filename)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
            resources.append(self._resource(batch.id, path, "attachment", page_id, page_name))
        return resources

    @staticmethod
    def _image_identity(image: dict[str, Any]) -> str:
        return str(
            image.get("originUrl")
            or image.get("thumbUrl")
            or image.get("url")
            or image.get("key")
            or image.get("name")
            or "image"
        )

    @staticmethod
    def _stable_path(directory: Path, identity: str, filename: str) -> Path:
        directory.mkdir(parents=True, exist_ok=True)
        suffix = hashlib.sha1(identity.encode("utf-8")).hexdigest()[:8]
        return directory / f"{suffix}-{filename}"

    @staticmethod
    def _resource(
        batch_id: str, path: Path, kind: str, page_id: str, page_name: str
    ) -> dict[str, Any]:
        relative = path.relative_to(settings.data_root)
        resource_id = hashlib.sha256(str(relative).encode("utf-8")).hexdigest()[:24]
        return {
            "id": resource_id,
            "batchId": batch_id,
            "kind": kind,
            "pageId": page_id,
            "pageName": page_name,
            "name": path.name.split("-", 1)[-1],
            "logicalPath": str(relative),
            "size": path.stat().st_size,
        }


class FileService:
    TEXT_SUFFIXES = {".md", ".txt", ".json"}
    IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".tif", ".tiff"}
    LIST_CATEGORIES = {"all", "text", "conversion_pending"}
    PREVIEWABLE = {
        ".md", ".txt", ".json", ".html", ".htm", ".pdf",
        ".png", ".jpg", ".jpeg", ".gif", ".webp",
    }

    def __init__(self):
        self._record_cache: dict[str, tuple[int, int, list[dict[str, Any]], dict[str, dict[str, Any]]]] = {}
        self._cache_lock = threading.RLock()

    def _manifests(self) -> list[Path]:
        manifests = list(settings.data_root.glob("spaces/*/batches/*/resources.json"))
        legacy_root = settings.data_root / "batches"
        if legacy_root.exists():
            manifests.extend(legacy_root.glob("*/resources.json"))
        return manifests

    def _load_resources(self, batch_id: str) -> list[dict[str, Any]]:
        path = self.manifest_path(batch_id)
        if not path.exists():
            return []
        stat = path.stat()
        with self._cache_lock:
            cached = self._record_cache.get(batch_id)
            if cached and cached[0] == stat.st_mtime_ns and cached[1] == stat.st_size:
                return cached[2]
        records = json.loads(path.read_text(encoding="utf-8"))
        by_id = {str(item.get("id")): item for item in records if item.get("id")}
        with self._cache_lock:
            self._record_cache[batch_id] = (stat.st_mtime_ns, stat.st_size, records, by_id)
        return records

    def manifest_path(self, batch_id: str) -> Path:
        candidates = list(settings.data_root.glob(f"spaces/*/batches/{batch_id}/resources.json"))
        legacy = settings.data_root / "batches" / batch_id / "resources.json"
        return candidates[0] if candidates else legacy

    def records(self, batch_id: str) -> list[dict[str, Any]]:
        """返回批次原始资源记录，包含普通清单中隐藏的图片资源。"""
        return self._load_resources(batch_id)

    @staticmethod
    def resolve(logical_path: str) -> Path:
        return FileService._resolve(logical_path)

    @staticmethod
    def _tool_status() -> dict[str, dict[str, Any]]:
        return {
            "libreoffice": {
                "available": bool(shutil.which("libreoffice")),
                "requiredFormats": ["doc", "docx", "ppt", "pptx", "xls", "xlsx", "odg", "ods", "odp"],
            },
            "pdftotext": {
                "available": bool(shutil.which("pdftotext")),
                "requiredFormats": ["pdf"],
            },
            "htmlParser": {
                "available": True,
                "requiredFormats": ["html", "htm"],
            },
            "docxOoxml": {
                "available": True,
                "requiredFormats": ["docx"],
            },
        }

    @classmethod
    def _format_family(cls, path: Path) -> str:
        suffix = path.suffix.lower()
        if suffix in cls.IMAGE_SUFFIXES:
            return "image"
        if suffix in cls.TEXT_SUFFIXES:
            return "text"
        if suffix in {".html", ".htm"}:
            return "web"
        if suffix in {".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx", ".odg", ".ods", ".odp"}:
            return "office"
        if suffix in {".pdf"}:
            return "pdf"
        if suffix in {".zip", ".tar", ".tgz", ".tar.gz", ".tar.bz2", ".tar.xz", ".tbz2", ".txz"}:
            return "archive"
        return "unknown"

    @staticmethod
    def _pdf_has_text(path: Path) -> bool | None:
        if not shutil.which("pdftotext"):
            return None
        try:
            result = subprocess.run(
                ["pdftotext", "-layout", str(path), "-"],
                capture_output=True,
                text=True,
                timeout=60,
                check=False,
            )
        except (OSError, subprocess.SubprocessError):
            return False
        return result.returncode == 0 and bool(result.stdout.strip())

    @classmethod
    def _resource_metadata(cls, item: dict[str, Any], path: Path, *, inspect_pdf: bool = False) -> dict[str, Any]:
        suffix = path.suffix.lower()
        format_family = cls._format_family(path)
        tool_status = cls._tool_status()
        processing_status = "unsupported"
        previewable_after_conversion = False
        conversion_readiness = "unsupported"
        if format_family == "text":
            processing_status = "direct_text"
            previewable_after_conversion = True
            conversion_readiness = "direct"
        elif format_family == "web":
            processing_status = "direct_text"
            previewable_after_conversion = True
            conversion_readiness = "direct_html"
        elif format_family == "office":
            docx_ready = suffix == ".docx" and zipfile.is_zipfile(path)
            processing_status = "convertible" if docx_ready or tool_status["libreoffice"]["available"] else "conversion_pending"
            previewable_after_conversion = True
            conversion_readiness = "docx_ooxml_ready" if docx_ready else ("tool_ready" if tool_status["libreoffice"]["available"] else "tool_missing")
        elif format_family == "pdf":
            has_text = cls._pdf_has_text(path) if inspect_pdf else None
            if has_text is None:
                processing_status = "convertible" if tool_status["pdftotext"]["available"] else "conversion_pending"
                conversion_readiness = "tool_ready" if tool_status["pdftotext"]["available"] else "tool_missing"
            elif has_text:
                processing_status = "convertible"
                conversion_readiness = "tool_ready" if tool_status["pdftotext"]["available"] else "tool_missing"
            else:
                processing_status = "ocr_required"
                conversion_readiness = "ocr_required"
            previewable_after_conversion = True
        elif format_family == "image":
            processing_status = "asset"
            previewable_after_conversion = False
            conversion_readiness = "asset"
        elif format_family == "archive":
            processing_status = "archive"
            conversion_readiness = "archive"
        return {
            "formatFamily": format_family,
            "processingStatus": processing_status,
            "previewableAfterConversion": previewable_after_conversion,
            "conversionReadiness": conversion_readiness,
            "latestPreviewState": "available" if processing_status in {"direct_text", "convertible"} else "unavailable",
            "toolStatus": tool_status,
            "mediaType": mimetypes.guess_type(path.name)[0] or item.get("mediaType") or "application/octet-stream",
        }

    def list(self, batch_id: str, category: str = "all") -> list[FileResource]:
        if category not in self.LIST_CATEGORIES:
            raise ValueError(f"不支持的文件分类：{category}")
        resources = []
        tool_status = self._tool_status()
        for item in self._load_resources(batch_id):
            if item.get("kind") not in {"page", "attachment"}:
                continue
            path = settings.data_root / item["logicalPath"]
            inspect = self._list_metadata(item, path, tool_status)
            media_type = inspect["mediaType"]
            if inspect["formatFamily"] == "image":
                continue
            if category == "text" and inspect["processingStatus"] not in {"direct_text", "convertible"}:
                continue
            if category == "conversion_pending" and inspect["processingStatus"] == "direct_text":
                continue
            resources.append(
                FileResource(
                    id=item["id"],
                    batch_id=batch_id,
                    name=item["name"],
                    logical_path=item["logicalPath"],
                    media_type=media_type,
                    size=item["size"],
                    previewable=path.suffix.lower() in self.PREVIEWABLE,
                    format_family=inspect["formatFamily"],
                    processing_status=inspect["processingStatus"],
                    previewable_after_conversion=inspect["previewableAfterConversion"],
                    conversion_readiness=inspect["conversionReadiness"],
                    latest_preview_state=inspect["latestPreviewState"],
                )
            )
        return sorted(resources, key=lambda item: (item.name.casefold(), item.logical_path))

    @classmethod
    def _list_metadata(
        cls,
        item: dict[str, Any],
        path: Path,
        tool_status: dict[str, dict[str, Any]],
    ) -> dict[str, Any]:
        """清单只做扩展名与工具就绪检查，避免分页前打开每个 Office/PDF 文件。"""
        family = cls._format_family(path)
        status = "unsupported"
        readiness = "unsupported"
        previewable = False
        if family in {"text", "web"}:
            status = "direct_text"
            readiness = "direct" if family == "text" else "direct_html"
            previewable = True
        elif family == "office":
            available = bool(tool_status["libreoffice"]["available"]) or path.suffix.lower() == ".docx"
            status = "convertible" if available else "conversion_pending"
            readiness = "tool_ready" if available else "tool_missing"
            previewable = True
        elif family == "pdf":
            available = bool(tool_status["pdftotext"]["available"])
            status = "convertible" if available else "conversion_pending"
            readiness = "tool_ready" if available else "tool_missing"
            previewable = True
        elif family == "image":
            status, readiness = "asset", "asset"
        elif family == "archive":
            status, readiness = "archive", "archive"
        return {
            "formatFamily": family,
            "processingStatus": status,
            "previewableAfterConversion": previewable,
            "conversionReadiness": readiness,
            "latestPreviewState": "available" if status in {"direct_text", "convertible"} else "unavailable",
            "mediaType": mimetypes.guess_type(path.name)[0] or item.get("mediaType") or "application/octet-stream",
        }

    def list_page(
        self,
        batch_id: str,
        category: str,
        page: int,
        page_size: int,
    ) -> dict[str, Any]:
        resources = self.list(batch_id, category)
        start = (page - 1) * page_size
        return {
            "items": resources[start : start + page_size],
            "page": page,
            "pageSize": page_size,
            "total": len(resources),
            "hasMore": start + page_size < len(resources),
        }

    def list_processing_sources(self, batch_id: str) -> list[FileResource]:
        return self.list(batch_id, "text")

    def find(self, resource_id: str) -> tuple[FileResource, Path]:
        item, _ = self.find_record(resource_id)
        path = self._resolve(item["logicalPath"])
        media_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        resource = FileResource(
            id=item["id"],
            batch_id=item["batchId"],
            name=item["name"],
            logical_path=item["logicalPath"],
            media_type=media_type,
            size=item["size"],
            previewable=path.suffix.lower() in self.PREVIEWABLE,
        )
        return resource, path

    def find_record(self, resource_id: str) -> tuple[dict[str, Any], list[dict[str, Any]]]:
        for manifest in self._manifests():
            batch_id = manifest.parent.name
            items = self._load_resources(batch_id)
            with self._cache_lock:
                cached = self._record_cache.get(batch_id)
                item = cached[3].get(resource_id) if cached else None
            if item is not None:
                return item, items
        raise KeyError(resource_id)

    def preview(self, resource_id: str) -> FilePreview:
        item, items = self.find_record(resource_id)
        resource, path = self.find(resource_id)
        format_by_suffix = {
            ".md": "markdown",
            ".txt": "text",
            ".json": "json",
            ".html": "html",
            ".htm": "html",
        }
        preview_format = format_by_suffix.get(path.suffix.lower())
        if not preview_format:
            raise ValueError("该文件不支持结构化文本预览")

        assets = self.asset_map_for_resource(item, items, path)

        return FilePreview(
            resource_id=resource.id,
            name=resource.name,
            format=preview_format,
            content=path.read_text(encoding="utf-8", errors="replace"),
            assets=assets,
        )

    def asset_map_for_resource(
        self,
        item: dict[str, Any],
        items: list[dict[str, Any]],
        path: Path,
    ) -> dict[str, str]:
        assets: dict[str, str] = {}
        for candidate in items:
            if (
                candidate.get("kind") != "page_asset"
                or candidate.get("pageId") != item.get("pageId")
            ):
                continue
            asset_path = self._resolve(candidate["logicalPath"])
            relative = os.path.relpath(asset_path, path.parent).replace(os.sep, "/")
            assets[relative] = candidate["id"]
            assets[relative.replace("./", "", 1)] = candidate["id"]
            assets[quote(relative, safe="/._-")] = candidate["id"]
            assets[candidate.get("name", "")] = candidate["id"]
        return assets

    @staticmethod
    def _resolve(logical_path: str) -> Path:
        path = (settings.data_root / logical_path).resolve()
        if settings.data_root not in path.parents or not path.is_file():
            raise FileNotFoundError(logical_path)
        return path


class PreprocessService:
    TEXT_SUFFIXES = FileService.TEXT_SUFFIXES

    def __init__(
        self,
        store: JsonStore,
        batches: BatchService,
        tasks: TaskService,
        files: FileService,
    ):
        self.store = store
        self.batches = batches
        self.tasks = tasks
        self.files = files

    @staticmethod
    def _append_scan_issue(
        issues: list[ScanIssue],
        summary: dict[str, int],
        code: str,
        severity: str,
        resource_id: str | None,
        file_name: str | None,
        message: str,
    ) -> None:
        issues.append(ScanIssue(code=code, severity=severity, resourceId=resource_id, fileName=file_name, message=message))
        summary[severity] = summary.get(severity, 0) + 1

    def _read_preview_source(self, path: Path, format_family: str) -> str:
        if format_family == "web":
            return html_to_markdown(path.read_text(encoding="utf-8", errors="replace"))
        return path.read_text(encoding="utf-8", errors="replace")

    @staticmethod
    def _convert_resource_to_markdown(path: Path, format_family: str, *, preview: bool = False) -> OfficeConversionResult:
        if format_family == "text":
            return OfficeConversionResult(path.read_text(encoding="utf-8", errors="replace"), "text-reader")
        if format_family == "web":
            return OfficeConversionResult(html_to_markdown(path.read_text(encoding="utf-8", errors="replace")), "html-parser")
        if format_family == "pdf":
            if not shutil.which("pdftotext"):
                raise ValueError("缺少 pdftotext，无法转换 PDF")
            try:
                result = subprocess.run(["pdftotext", "-layout", str(path), "-"], capture_output=True, text=True, timeout=60, check=False)
            except subprocess.TimeoutExpired as exc:
                raise ValueError("PDF 文本提取超时") from exc
            if result.returncode != 0:
                raise ValueError((result.stderr or "PDF 文本提取失败").strip()[:500])
            if not result.stdout.strip():
                raise ValueError("PDF 没有可提取文本，当前需要 OCR")
            return OfficeConversionResult(result.stdout, "pdftotext")
        if format_family == "office":
            if path.suffix.lower() != ".docx" and not shutil.which("libreoffice"):
                raise ValueError("缺少 libreoffice，无法转换 Office 文档")
            import tempfile
            with tempfile.TemporaryDirectory(prefix="pingcode-office-preview-") as directory:
                return convert_office_to_markdown(
                    path,
                    Path(directory),
                    markdown_asset_prefix=f"assets/{path.stem}",
                    asset_relative_root=f"assets/{path.stem}",
                    inline_preview_assets=True,
                )
        raise ValueError("该文件格式暂不支持转换预览")

    @staticmethod
    def _estimate_units(markdown: str, config: PreprocessConfig) -> int:
        cleaning = clean_markdown(markdown, config.preset, exclude_c_code_blocks=config.exclude_c_code_blocks)
        _, units = build_processing_units(cleaning, "preview", "preview", config)
        return len(units)

    def create_scan_task(self, batch_id: str) -> TaskSnapshot:
        batch = self.batches.get(batch_id)
        for task in self.tasks.list(batch_id):
            if task.type == "scan" and task.state in {"queued", "running"}:
                return task
        resources = self.files.list(batch_id)
        now = utcnow()
        task = TaskSnapshot(
            id=f"scan_{uuid.uuid4().hex[:16]}",
            batch_id=batch_id,
            type="scan",
            state="queued",
            stage="source_scan",
            total=len(resources),
            can_cancel=False,
            created_at=now,
            updated_at=now,
        )
        self.tasks._save(task)
        active_ids = list(getattr(batch, "active_task_ids", None) or [])
        self.batches.update(batch_id, activeTaskIds=[*active_ids, task.id])
        threading.Thread(target=self._run_scan_task, args=(task.id,), daemon=True).start()
        return task

    def list_scan_tasks(self, batch_id: str) -> list[TaskSnapshot]:
        return [task for task in self.tasks.list(batch_id) if task.type == "scan"]

    def reconcile_interrupted_scans(self) -> None:
        for task in self.tasks.list():
            if task.type != "scan" or task.state not in {"queued", "running"}:
                continue
            self.tasks._update(
                task.id,
                state="interrupted",
                stage="interrupted",
                message="后端重启导致扫描中断，请重新扫描",
            )
            self._remove_scan_from_active_tasks(task.batch_id, task.id)

    def latest_scan_report(self, batch_id: str) -> ScanReport:
        self.batches.get(batch_id)
        path = self._scan_report_path(batch_id)
        if not path.exists():
            raise FileNotFoundError(path)
        return ScanReport.model_validate_json(path.read_text(encoding="utf-8"))

    def _run_scan_task(self, task_id: str) -> None:
        task = self.tasks._update(task_id, state="running", stage="source_scan", message="正在检查源文件")
        last_saved = 0

        def update_progress(completed: int, total: int, failed: int, warnings: int) -> None:
            nonlocal last_saved
            if completed != total and completed - last_saved < 50:
                return
            last_saved = completed
            self.tasks._update(
                task_id,
                completed=completed,
                total=total,
                failed=failed,
                warnings=warnings,
                progress_detail={"checkedFiles": completed, "totalFiles": total},
                message=f"正在检查源文件：{completed}/{total}",
            )

        try:
            report = self.scan(task.batch_id, lightweight=True, progress=update_progress)
            self._persist_scan_report(task.batch_id, report)
            self.tasks._update(
                task_id,
                state="completed",
                stage="completed",
                completed=report.total_files,
                total=report.total_files,
                failed=report.issue_summary.get("error", 0),
                warnings=report.issue_summary.get("warning", 0),
                progress_detail={
                    "checkedFiles": report.total_files,
                    "totalFiles": report.total_files,
                    "processableCount": report.processable_count,
                },
                message=f"源文件检查完成：{report.processable_count} 个来源可加工",
            )
        except Exception as exc:
            self.tasks._update(
                task_id,
                state="failed",
                stage="failed",
                message=f"源文件检查失败：{exc}",
            )
        finally:
            self._remove_scan_from_active_tasks(task.batch_id, task_id)

    def _remove_scan_from_active_tasks(self, batch_id: str, task_id: str) -> None:
        try:
            batch = self.batches.get(batch_id)
        except KeyError:
            return
        active_ids = list(getattr(batch, "active_task_ids", None) or [])
        self.batches.update(batch_id, activeTaskIds=[item for item in active_ids if item != task_id])

    def _scan_report_path(self, batch_id: str) -> Path:
        return self.files.manifest_path(batch_id).parent / "scan-report" / "latest.json"

    def _persist_scan_report(self, batch_id: str, report: ScanReport) -> None:
        path = self._scan_report_path(batch_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(".tmp")
        temporary.write_text(report.model_dump_json(by_alias=True, indent=2), encoding="utf-8")
        temporary.replace(path)

    def scan(
        self,
        batch_id: str,
        *,
        lightweight: bool = False,
        progress: Callable[[int, int, int, int], None] | None = None,
    ) -> ScanReport:
        self.batches.get(batch_id)
        resources = self.files.list(batch_id)
        issues: list[ScanIssue] = []
        hashes: dict[str, list[FileResource]] = {}
        text_files = 0
        unsupported = 0
        direct_text_count = 0
        convertible_count = 0
        ocr_required_count = 0
        conversion_failed_count = 0
        estimated_processing_unit_count = 0
        total_bytes = 0
        empty = 0
        encoding_warnings = 0
        traceable = 0
        issue_summary = {"info": 0, "warning": 0, "error": 0}

        for index, resource in enumerate(resources, start=1):
            path = self.files.resolve(resource.logical_path)
            inspect = self.files._resource_metadata(
                resource.model_dump(mode="json", by_alias=True),
                path,
                inspect_pdf=not lightweight,
            )
            resource.format_family = inspect["formatFamily"]
            resource.processing_status = inspect["processingStatus"]
            resource.previewable_after_conversion = inspect["previewableAfterConversion"]
            resource.conversion_readiness = inspect["conversionReadiness"]
            total_bytes += resource.size
            if resource.logical_path and resource.batch_id == batch_id:
                traceable += 1
            if path.stat().st_size == 0:
                empty += 1
                self._append_scan_issue(issues, issue_summary, "EMPTY_FILE", "error", resource.id, resource.name, "文件内容为空")
            with path.open("rb") as handle:
                digest = hashlib.file_digest(handle, "sha256").hexdigest()
            hashes.setdefault(digest, []).append(resource)
            if inspect["processingStatus"] == "direct_text":
                direct_text_count += 1
                text_files += 1
                if lightweight:
                    estimated_processing_unit_count += max(1, (resource.size + 5999) // 6000)
                else:
                    text = self._read_preview_source(path, inspect["formatFamily"])
                    if "\ufffd" in text:
                        encoding_warnings += 1
                        self._append_scan_issue(issues, issue_summary, "ENCODING_REPLACEMENT", "warning", resource.id, resource.name, "文本包含无法解码的替换字符")
                    estimated_processing_unit_count += self._estimate_units(text, PreprocessConfig())
            elif inspect["processingStatus"] == "convertible":
                convertible_count += 1
                if lightweight:
                    estimated_processing_unit_count += max(1, (resource.size + 5999) // 6000)
                else:
                    try:
                        conversion = OfficeConversionResult.from_legacy(self._convert_resource_to_markdown(path, inspect["formatFamily"], preview=True))
                        estimated_processing_unit_count += self._estimate_units(conversion.markdown, PreprocessConfig())
                    except ValueError as exc:
                        conversion_failed_count += 1
                        self._append_scan_issue(issues, issue_summary, "CONVERSION_PREVIEW_FAILED", "warning", resource.id, resource.name, f"转换预估失败：{exc}")
            elif inspect["processingStatus"] == "ocr_required":
                ocr_required_count += 1
                self._append_scan_issue(issues, issue_summary, "PDF_OCR_REQUIRED", "warning", resource.id, resource.name, "PDF 没有可提取文本，当前需要 OCR 后才能进入知识加工")
            else:
                unsupported += 1
                if inspect["processingStatus"] not in {"asset", "archive"}:
                    self._append_scan_issue(issues, issue_summary, "UNSUPPORTED_FORMAT", "warning", resource.id, resource.name, "当前格式暂不支持进入知识加工")
            if progress is not None:
                progress(index, len(resources), issue_summary["error"], issue_summary["warning"])

        duplicate_groups = 0
        for group in hashes.values():
            if len(group) <= 1:
                continue
            duplicate_groups += 1
            self._append_scan_issue(issues, issue_summary, "DUPLICATE_CONTENT", "warning", None, group[0].name, f"发现 {len(group)} 个内容完全相同的文件")
        processable_count = direct_text_count + convertible_count
        return ScanReport(
            batch_id=batch_id,
            total_files=len(resources),
            text_files=processable_count,
            unsupported_files=unsupported,
            empty_files=empty,
            encoding_warning_files=encoding_warnings,
            duplicate_groups=duplicate_groups,
            traceable_files=traceable,
            issues=issues,
            processable_count=processable_count,
            direct_text_count=direct_text_count,
            convertible_count=convertible_count,
            ocr_required_count=ocr_required_count,
            unsupported_count=unsupported,
            conversion_failed_count=conversion_failed_count,
            estimated_processing_unit_count=estimated_processing_unit_count,
            total_bytes=total_bytes,
            tool_status=FileService._tool_status(),
            issue_summary=issue_summary,
        )

    def preview(self, request: PreprocessPreviewRequest) -> dict[str, Any]:
        resource, path = self.files.find(request.resource_id)
        if resource.batch_id != request.batch_id:
            raise KeyError(request.resource_id)
        inspect = self.files._resource_metadata(resource.model_dump(mode="json", by_alias=True), path, inspect_pdf=True)
        if inspect["processingStatus"] not in {"direct_text", "convertible"}:
            if inspect["processingStatus"] == "ocr_required":
                raise ValueError("PDF 没有可提取文本，当前需要 OCR 后才能生成预处理预览")
            raise ValueError("该文件尚未配置文本转换器，不能生成预处理预览")
        item, items = self.files.find_record(resource.id)
        conversion = OfficeConversionResult.from_legacy(self._convert_resource_to_markdown(path, inspect["formatFamily"], preview=True))
        converted = conversion.markdown
        converter = conversion.converter_id
        cleaning = self._clean_with_events(converted, request.config)
        cleaned = cleaning.content
        _, processing_units = build_processing_units(
            cleaning,
            resource.id,
            resource.logical_path or resource.name,
            request.config,
        )
        source_metadata = self._source_metadata(resource, path, inspect, converter)
        source_metadata["conversionProfile"] = conversion.conversion_profile
        source_metadata["imageCount"] = conversion.image_count or source_metadata["features"].get("imageCount")
        source_metadata["preservedImageCount"] = conversion.preserved_image_count
        source_metadata["assetPaths"] = conversion.asset_paths
        markdown_features = self._markdown_features(cleaned, processing_units)
        structure_comparison = self._structure_comparison(source_metadata["features"], markdown_features, inspect)
        assets = self.files.asset_map_for_resource(item, items, path)
        for asset in conversion.assets:
            if asset.get("dataUrl"):
                assets[asset["markdownPath"]] = asset["dataUrl"]
        return {
            "resource": resource,
            "original": converted,
            "sourceMetadata": source_metadata,
            "convertedMarkdown": converted,
            "cleanedMarkdown": cleaned,
            "cleaned": cleaned,
            "assets": assets,
            "conversionAssets": conversion.assets,
            "chunks": [item["content"] for item in processing_units],
            "processingUnits": processing_units,
            "totalChunks": len(processing_units),
            "maxUnitCharacters": max((len(item["content"]) for item in processing_units), default=0),
            "config": request.config.model_dump(mode="json", by_alias=True),
            "configSource": "service_default",
            "excludedRanges": cleaning.excluded_ranges,
            "normalizationEvents": cleaning.normalization_events,
            "converterId": converter,
            "converterVersion": "1.0.0",
            "conversionProfile": conversion.conversion_profile,
            "previewState": "preview_only",
            "markdownFeatures": markdown_features,
            "structureComparison": structure_comparison,
            "diffSummary": structure_comparison["summary"],
            "issues": structure_comparison["issues"],
        }

    def _source_metadata(self, resource: FileResource, path: Path, inspect: dict[str, Any], converter: str) -> dict[str, Any]:
        source_features = self._source_features(path, inspect["formatFamily"])
        return {
            "resourceId": resource.id,
            "fileName": resource.name,
            "logicalPath": resource.logical_path,
            "formatFamily": inspect["formatFamily"],
            "processingStatus": inspect["processingStatus"],
            "conversionReadiness": inspect["conversionReadiness"],
            "mediaType": resource.media_type,
            "size": resource.size,
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            "converterId": converter,
            "converterVersion": "1.0.0",
            "features": source_features["values"],
            "featureStates": source_features["states"],
            "featureDiagnostics": source_features["diagnostics"],
            "toolStatus": FileService._tool_status(),
        }

    def _source_features(self, path: Path, format_family: str) -> dict[str, Any]:
        values: dict[str, Any] = {
            "pageCount": None,
            "paragraphCount": None,
            "tableCount": None,
            "imageCount": None,
            "worksheetCount": None,
            "slideCount": None,
            "headingHintCount": None,
            "characterCount": None,
        }
        states: dict[str, str] = {key: "not_implemented" for key in values}
        diagnostics: dict[str, str] = {}

        def set_feature(key: str, value: Any, state: str, diagnostic: str) -> None:
            values[key] = value
            states[key] = state
            diagnostics[key] = diagnostic

        if format_family in {"text", "web"}:
            text = self._read_preview_source(path, format_family)
            markdown_features = self._markdown_features(text, [])
            values.update(markdown_features)
            set_feature("pageCount", None, "not_applicable", "纯文本/HTML 不提供页数统计")
            set_feature("worksheetCount", None, "not_applicable", "纯文本/HTML 不适用工作表统计")
            set_feature("slideCount", None, "not_applicable", "纯文本/HTML 不适用幻灯片统计")
            for key, value in markdown_features.items():
                if key in values:
                    if key == "characterCount":
                        set_feature(key, len(text), "zero_value" if not text else "ok", "直接从文本或 HTML 读取字符数")
                    elif isinstance(value, int):
                        set_feature(key, value, "zero_value" if value == 0 else "ok", f"从 {format_family} 文本解析得到")
            return {"values": values, "states": states, "diagnostics": diagnostics}

        if format_family == "office":
            suffix = path.suffix.lower()
            if not zipfile.is_zipfile(path):
                set_feature("pageCount", None, "not_applicable", "Office 文档不提供页数统计")
                set_feature("worksheetCount", None, "not_applicable", "Office 文档中该字段不适用")
                set_feature("slideCount", None, "not_applicable", "Office 文档中该字段不适用")
                if suffix in {".doc", ".ppt", ".xls"}:
                    for key in ("paragraphCount", "tableCount", "imageCount", "headingHintCount", "characterCount"):
                        set_feature(key, None, "not_implemented", "旧版 Office 格式未接入轻量源文件字符统计，不使用 LibreOffice 结果冒充源文件统计")
                else:
                    for key in ("paragraphCount", "tableCount", "imageCount", "headingHintCount", "characterCount"):
                        set_feature(key, None, "parse_failed", "Office OOXML 包不是可解析的 zip 文件")
                return {"values": values, "states": states, "diagnostics": diagnostics}
            try:
                with zipfile.ZipFile(path) as archive:
                    names = set(archive.namelist())
                    set_feature("pageCount", None, "not_applicable", "Office 文档页数不直接统计")
                    if suffix == ".docx":
                        set_feature("pageCount", None, "not_applicable", "DOCX 不提供页数统计")
                        set_feature("worksheetCount", None, "not_applicable", "DOCX 不适用工作表统计")
                        set_feature("slideCount", None, "not_applicable", "DOCX 不适用幻灯片统计")
                    elif suffix in {".ppt", ".pptx", ".odp"}:
                        set_feature("worksheetCount", None, "not_applicable", "演示文稿不适用工作表统计")
                    elif suffix in {".xls", ".xlsx", ".ods"}:
                        set_feature("slideCount", None, "not_applicable", "表格文档不适用幻灯片统计")
                    image_count = sum(1 for name in names if name.startswith(("word/media/", "ppt/media/", "xl/media/")))
                    set_feature("imageCount", image_count, "zero_value" if image_count == 0 else "ok", "按 OOXML media 资源统计图片")
                    if suffix == ".docx" and "word/document.xml" not in names:
                        for key in ("paragraphCount", "tableCount", "headingHintCount", "characterCount"):
                            set_feature(key, None, "parse_failed", "缺少 word/document.xml，无法解析 DOCX 正文")
                        diagnostics["package"] = "缺少 word/document.xml"
                    elif suffix in {".docx", ".pptx", ".xlsx"}:
                        stats = collect_ooxml_text_stats(path)
                        if stats.paragraph_count is not None:
                            set_feature("paragraphCount", stats.paragraph_count, "zero_value" if stats.paragraph_count == 0 else "ok", "按 DOCX OOXML 段落节点统计")
                        if stats.table_count is not None:
                            set_feature("tableCount", stats.table_count, "zero_value" if stats.table_count == 0 else "ok", "按 DOCX OOXML 表格节点统计")
                        if stats.heading_hint_count is not None:
                            set_feature("headingHintCount", stats.heading_hint_count, "zero_value" if stats.heading_hint_count == 0 else "ok", "按 DOCX 标题样式统计")
                        if stats.slide_count is not None:
                            set_feature("slideCount", stats.slide_count, "zero_value" if stats.slide_count == 0 else "ok", "按 PPTX 幻灯片文件统计")
                        if stats.worksheet_count is not None:
                            set_feature("worksheetCount", stats.worksheet_count, "zero_value" if stats.worksheet_count == 0 else "ok", "按 XLSX 工作表文件统计")
                        if stats.character_count is not None:
                            set_feature("characterCount", stats.character_count, "zero_value" if stats.character_count == 0 else "ok", stats.diagnostics.get("characterCount", "按 OOXML 可见文本统计"))
                            diagnostics["characterCountSource"] = stats.source
                        for key, value in stats.diagnostics.items():
                            diagnostics.setdefault(key, value)
                        if suffix == ".docx":
                            rels_name = "word/_rels/document.xml.rels"
                            diagnostics["relationships"] = "存在" if rels_name in names else "缺少 document.xml.rels"
                    else:
                        for key in ("paragraphCount", "tableCount", "headingHintCount", "characterCount"):
                            set_feature(key, None, "not_implemented", "旧版 Office 格式未接入轻量源文件字符统计，不使用 LibreOffice 结果冒充源文件统计")
            except (OSError, zipfile.BadZipFile, KeyError, ElementTree.ParseError) as exc:
                for key in ("paragraphCount", "tableCount", "imageCount", "headingHintCount", "characterCount"):
                    set_feature(key, None, "parse_failed", f"Office OOXML 解析失败：{exc}")
                diagnostics["package"] = f"Office OOXML 解析失败：{exc}"
            return {"values": values, "states": states, "diagnostics": diagnostics}

        if format_family == "pdf":
            if shutil.which("pdfinfo"):
                try:
                    result = subprocess.run(["pdfinfo", str(path)], capture_output=True, text=True, timeout=20, check=False)
                    match = re.search(r"^Pages:\s*(\d+)", result.stdout, re.M)
                    if match:
                        page_count = int(match.group(1))
                        set_feature("pageCount", page_count, "zero_value" if page_count == 0 else "ok", "按 pdfinfo 统计页数")
                    else:
                        set_feature("pageCount", None, "parse_failed", "pdfinfo 未返回页数")
                except (OSError, subprocess.SubprocessError) as exc:
                    set_feature("pageCount", None, "parse_failed", f"PDF 页数统计失败：{exc}")
            else:
                set_feature("pageCount", None, "not_implemented", "pdfinfo 不可用，未统计页数")
            if shutil.which("pdftotext"):
                try:
                    result = subprocess.run(["pdftotext", "-layout", str(path), "-"], capture_output=True, text=True, timeout=20, check=False)
                    text = result.stdout or ""
                    character_count = len(text)
                    set_feature("characterCount", character_count, "zero_value" if character_count == 0 else "ok", "按 pdftotext 输出统计字符数")
                except (OSError, subprocess.SubprocessError) as exc:
                    set_feature("characterCount", None, "parse_failed", f"PDF 文本抽取失败：{exc}")
            return {"values": values, "states": states, "diagnostics": diagnostics}

        return {"values": values, "states": states, "diagnostics": diagnostics}

    @staticmethod
    def _markdown_features(markdown: str, processing_units: list[dict[str, Any]]) -> dict[str, Any]:
        blocks = re.split(r"\n\n+", markdown.strip()) if markdown.strip() else []
        return {
            "headingCount": len(re.findall(r"(?m)^#{1,6}\s+", markdown)),
            "paragraphCount": sum(1 for item in blocks if item and not item.startswith(("#", "|", "```", "- ", "* "))),
            "tableCount": sum(1 for item in blocks if "|" in item and "\n" in item),
            "listCount": len(re.findall(r"(?m)^\s*[-*+]\s+", markdown)),
            "codeBlockCount": len(re.findall(r"(?m)^```", markdown)) // 2,
            "imageReferenceCount": len(re.findall(r"!\[[^\]]*\]\([^)]+\)", markdown)),
            "characterCount": len(markdown),
            "processingUnitCount": len(processing_units),
            "sourceMappingCoverage": 0.5,
        }

    @staticmethod
    def _structure_comparison(source_features: dict[str, Any], markdown_features: dict[str, Any], inspect: dict[str, Any]) -> dict[str, Any]:
        issues: list[dict[str, Any]] = []
        differences: list[dict[str, Any]] = []

        def add(key: str, label: str, source_key: str, markdown_key: str) -> None:
            source_value = source_features.get(source_key)
            markdown_value = markdown_features.get(markdown_key)
            differences.append({"key": key, "label": label, "sourceValue": source_value, "markdownValue": markdown_value})
            if isinstance(source_value, int) and source_value > 0 and not markdown_value:
                issues.append({"code": f"{key.upper()}_MISSING", "severity": "warning", "message": f"源文件存在{label}，转换 Markdown 中未识别到对应结构"})

        add("heading", "标题", "headingHintCount", "headingCount")
        add("table", "表格", "tableCount", "tableCount")
        add("image", "图片", "imageCount", "imageReferenceCount")
        mapping_incomplete = inspect["formatFamily"] in {"office", "pdf"}
        if mapping_incomplete:
            issues.append({"code": "SOURCE_MAPPING_PARTIAL", "severity": "info", "message": "Office/PDF 预览仅提供部分来源映射，正式调试需结合转换器细粒度映射"})
        source_characters = source_features.get("characterCount")
        markdown_characters = markdown_features.get("characterCount") or 0
        character_change_ratio = None
        if isinstance(source_characters, int) and source_characters > 0:
            character_change_ratio = round((markdown_characters - source_characters) / source_characters, 4)
        source_table_count = source_features.get("tableCount") if isinstance(source_features.get("tableCount"), int) else 0
        source_image_count = source_features.get("imageCount") if isinstance(source_features.get("imageCount"), int) else 0
        return {
            "sourceFeatures": source_features,
            "markdownFeatures": markdown_features,
            "differences": differences,
            "issues": issues,
            "summary": {
                "structureIssueCount": len([item for item in issues if item["severity"] == "warning"]),
                "mappingIncomplete": mapping_incomplete,
                "characterChangeRatio": character_change_ratio,
                "tableCountDelta": (markdown_features.get("tableCount") or 0) - source_table_count,
                "imageReferenceDelta": (markdown_features.get("imageReferenceCount") or 0) - source_image_count,
            },
        }

    def start(self, request: PreprocessTaskCreate) -> TaskSnapshot:
        batch = self.batches.get(request.batch_id)
        now = utcnow()
        task = TaskSnapshot(
            id=f"task_{uuid.uuid4().hex[:16]}",
            batch_id=batch.id,
            type="preprocess",
            state="queued",
            stage="queued",
            can_cancel=True,
            created_at=now,
            updated_at=now,
        )
        self.tasks._save(task)
        self.batches.update(batch.id, state="processing", activeTaskIds=[task.id])
        threading.Thread(
            target=self._run,
            args=(task.id, request.config),
            daemon=True,
        ).start()
        return task

    def cancel(self, task_id: str) -> TaskSnapshot:
        task = self.tasks.get(task_id)
        if task.type != "preprocess":
            raise ValueError("任务不是预处理任务")
        if task.state in {"completed", "failed", "cancelled"}:
            return task
        if task.state == "cancelling":
            return task
        return self.tasks._update(
            task_id,
            state="cancelling",
            can_cancel=False,
            message="正在取消规则预处理",
        )

    def list_datasets(self, batch_id: str | None = None) -> list[DatasetVersion]:
        records = [DatasetVersion.model_validate(item) for item in self.store.list_records("datasets")]
        if batch_id:
            records = [item for item in records if item.batch_id == batch_id]
        return sorted(records, key=lambda item: item.created_at, reverse=True)

    def get_dataset(self, dataset_id: str) -> DatasetVersion:
        record = self.store.get_record("datasets", dataset_id)
        if record is None:
            raise KeyError(dataset_id)
        return DatasetVersion.model_validate(record)

    def publish(self, dataset_id: str, force: bool = False) -> DatasetVersion:
        dataset = self.get_dataset(dataset_id)
        if dataset.state == "deleted":
            raise ValueError("已删除的数据集不能发布")
        if (not dataset.publishable or not dataset.quality_passed) and not force:
            raise ValueError("数据集存在高严重度质量问题，禁止发布")
        record = self.store.update_record("datasets", dataset_id, {"state": "published"})
        published = DatasetVersion.model_validate(record)
        self._update_dataset_manifest(published, {"state": "published", "publishedAt": utcnow().isoformat()})
        self.batches.update(
            published.batch_id,
            state="ready",
            latestDatasetVersionId=published.id,
            activeTaskIds=[],
        )
        return published

    def delete_dataset(self, dataset_id: str, operator: str, reason: str) -> DatasetVersion:
        dataset = self.get_dataset(dataset_id)
        if dataset.state == "deleted":
            return dataset
        dataset_root = self._dataset_root(dataset)
        for relative in ("normalized", "knowledge.jsonl", "entities.jsonl", "relations.jsonl", "graph"):
            path = dataset_root / relative
            if path.is_dir():
                shutil.rmtree(path)
            elif path.exists():
                path.unlink()
        deleted_at = utcnow().isoformat()
        audit_path = dataset_root / "deletion-audit.jsonl"
        audit_path.parent.mkdir(parents=True, exist_ok=True)
        with audit_path.open("a", encoding="utf-8") as output:
            output.write(json.dumps({
                "datasetId": dataset.id,
                "previousState": dataset.state,
                "state": "deleted",
                "operator": operator,
                "reason": reason,
                "deletedAt": deleted_at,
                "retained": [
                    "originals", "mappings", "documents.jsonl", "processing-units.jsonl",
                    "quality-issues.json", "run-report.json",
                ],
            }, ensure_ascii=False) + "\n")
        self._update_dataset_manifest(dataset, {
            "state": "deleted",
            "graphAvailable": False,
            "deletedAt": deleted_at,
            "deletedBy": operator,
            "deletionReason": reason,
        })
        record = self.store.update_record("datasets", dataset_id, {
            "state": "deleted",
            "graphAvailable": False,
            "deletedAt": deleted_at,
            "deletedBy": operator,
            "deletionReason": reason,
        })
        if self.batches.get(dataset.batch_id).latest_dataset_version_id == dataset.id:
            self.batches.update(dataset.batch_id, latestDatasetVersionId=None, state="downloaded")
        return DatasetVersion.model_validate(record)

    @staticmethod
    def _dataset_root(dataset: DatasetVersion) -> Path:
        relative = dataset.dataset_path or f"datasets/{dataset.id}"
        path = (settings.data_root / relative).resolve()
        if settings.data_root.resolve() not in path.parents:
            raise ValueError("数据集路径超出数据根目录")
        return path

    def _update_dataset_manifest(self, dataset: DatasetVersion, changes: dict[str, Any]) -> None:
        manifest_path = self._dataset_root(dataset) / "manifest.json"
        if not manifest_path.is_file():
            return
        value = json.loads(manifest_path.read_text(encoding="utf-8"))
        value.update(changes)
        temporary = manifest_path.with_suffix(".json.tmp")
        temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
        temporary.replace(manifest_path)

    def _run(self, task_id: str, config: PreprocessConfig) -> None:
        task = self.tasks.get(task_id)
        if task.state == "cancelling":
            self.tasks._update(task_id, state="cancelled", stage="cancelled", can_cancel=False, message="规则预处理已取消")
            self.batches.update(task.batch_id, state="downloaded", activeTaskIds=[])
            return
        task = self.tasks._update(task_id, state="running", stage="scan", completed=0, failed=0, can_cancel=True)
        batch_id = task.batch_id
        try:
            report = self.scan(batch_id)
            resources = self.files.list_processing_sources(batch_id)
            self.tasks._update(task_id, stage="clean_and_chunk", total=len(resources))
            dataset_id = f"dataset_{uuid.uuid4().hex[:16]}"
            output_dir = settings.data_root / "datasets" / dataset_id
            output_dir.mkdir(parents=True, exist_ok=True)
            chunks: list[dict[str, Any]] = []
            failures = 0
            for index, resource in enumerate(resources, 1):
                if self.tasks.get(task_id).state == "cancelling":
                    self.tasks._update(task_id, state="cancelled", stage="cancelled", can_cancel=False, message="规则预处理已取消")
                    self.batches.update(batch_id, state="downloaded", activeTaskIds=[])
                    return
                try:
                    _, path = self.files.find(resource.id)
                    cleaning = self._clean_with_events(
                        path.read_text(encoding="utf-8", errors="replace"), config
                    )
                    for chunk_index, content in enumerate(self._chunk(cleaning.processing_content, config)):
                        chunks.append(
                            {
                                "id": f"{resource.id}:{chunk_index}",
                                "resourceId": resource.id,
                                "sourcePath": resource.logical_path,
                                "chunkIndex": chunk_index,
                                "content": content,
                            }
                        )
                except Exception:
                    failures += 1
                self.tasks._update(task_id, completed=index, failed=failures)
            if self.tasks.get(task_id).state == "cancelling":
                self.tasks._update(task_id, state="cancelled", stage="cancelled", can_cancel=False, message="规则预处理已取消")
                self.batches.update(batch_id, state="downloaded", activeTaskIds=[])
                return
            (output_dir / "chunks.json").write_text(
                json.dumps(chunks, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            total_files = report.total_files
            metrics: dict[str, float | int] = {
                "sourceTraceabilityRate": round(report.traceable_files / total_files, 4) if total_files else 0,
                "parseSuccessRate": round((len(resources) - failures) / len(resources), 4) if resources else 0,
                "encodingWarningRate": round(report.encoding_warning_files / total_files, 4) if total_files else 0,
                "emptyFileRate": round(report.empty_files / total_files, 4) if total_files else 0,
                "duplicateGroups": report.duplicate_groups,
                "unsupportedFiles": report.unsupported_files,
            }
            quality_passed = bool(
                total_files
                and metrics["sourceTraceabilityRate"] == 1
                and metrics["parseSuccessRate"] >= 0.95
                and report.empty_files == 0
                and report.encoding_warning_files == 0
                and chunks
            )
            dataset = DatasetVersion(
                id=dataset_id,
                batch_id=batch_id,
                preprocess_task_id=task_id,
                state="candidate",
                config=config,
                total_documents=len(resources),
                total_chunks=len(chunks),
                quality_metrics=metrics,
                quality_passed=quality_passed,
                created_at=utcnow(),
            )
            self.store.put_record("datasets", dataset.id, dataset.model_dump(mode="json", by_alias=True))
            self.tasks._update(
                task_id,
                state="completed",
                stage="quality_gate",
                can_cancel=False,
                can_retry=failures > 0,
                message=None if quality_passed else "处理完成，但数据集未通过全部质量门禁",
            )
            self.batches.update(batch_id, state="downloaded", activeTaskIds=[])
        except Exception as exc:
            self.tasks._update(
                task_id,
                state="failed",
                stage="failed",
                can_cancel=False,
                can_retry=True,
                message=str(exc),
            )
            self.batches.update(batch_id, state="failed", activeTaskIds=[])

    @staticmethod
    def _clean(text: str, preset: str = "training_standard") -> str:
        return clean_markdown(text, preset).content

    @staticmethod
    def _clean_with_events(text: str, config: PreprocessConfig):
        return clean_markdown(
            text,
            config.preset,
            exclude_c_code_blocks=config.exclude_c_code_blocks,
        )

    @staticmethod
    def _normalize_training_markdown(text: str) -> str:
        return clean_markdown(text, "training_standard", exclude_c_code_blocks=False).content

    @staticmethod
    def _chunk(text: str, config: PreprocessConfig) -> list[str]:
        if not text:
            return []
        size = config.max_unit_characters
        overlap = min(config.fallback_overlap_characters, size - 1)
        chunks = []
        start = 0
        while start < len(text):
            end = min(len(text), start + size)
            if end < len(text):
                boundary = max(text.rfind("\n\n", start, end), text.rfind("。", start, end))
                if boundary > start + size // 2:
                    end = boundary + 1
            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)
            if end >= len(text):
                break
            start = max(start + 1, end - overlap)
        return chunks
