import asyncio
import sys
import json
import logging
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .config import PINGCODE_DIR, settings
from .models import SourceSelection, SourceSnapshot, TreeResponse


SCRIPTS_DIR = PINGCODE_DIR.parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from pingcode.core.api_client import PingCodeAPIClient
from pingcode.core.client import PingCodeClient
from pingcode.core.config import PingCodeConfig
from pingcode.core.tree_builder import TreeBuilder


logger = logging.getLogger(__name__)


class PingCodeService:
    def __init__(self):
        self.config = PingCodeConfig(settings.pingcode_config)
        self._client: PingCodeClient | None = None
        self._api: PingCodeAPIClient | None = None
        self._lock = threading.RLock()
        self._executor: ThreadPoolExecutor | None = self._new_executor()
        self._closed = False
        self._login_space_key: str | None = None
        self._space_cache: dict[
            str, tuple[dict[str, Any], list[dict[str, Any]], dict[str, Any]]
        ] = {}
        self._index_dir = settings.data_root / "space-indexes"
        self._index_dir.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _new_executor() -> ThreadPoolExecutor:
        return ThreadPoolExecutor(max_workers=1, thread_name_prefix="pingcode-browser")

    @staticmethod
    def _isolate_asyncio(callback, *args):
        """在线程池 worker 中隔离 asyncio 事件循环，防止 Playwright Sync API 冲突。"""
        try:
            asyncio.set_event_loop(asyncio.new_event_loop())
        except Exception:
            pass
        return callback(*args)

    def _submit(self, callback, *args):
        with self._lock:
            if self._executor is None or self._closed:
                self._executor = self._new_executor()
                self._closed = False
            executor = self._executor
        return executor.submit(self._isolate_asyncio, callback, *args).result()

    def close(self) -> None:
        executor = self._executor
        if executor is None:
            return
        executor.submit(self._close_sync).result()
        executor.shutdown(wait=True)
        with self._lock:
            if self._executor is executor:
                self._executor = None
            self._closed = True

    def _close_sync(self) -> None:
        with self._lock:
            if self._client:
                try:
                    self._client.close()
                except Exception:
                    pass
            self._client = None
            self._api = None
            self._login_space_key = None

    def _ensure_api(self, space_key: str | None = None) -> PingCodeAPIClient:
        if self._api is not None and space_key and self._login_space_key not in {None, space_key}:
            self._close_sync()
        if self._api is None:
            login_url = f"{self.config.base_url}/wiki/spaces/{space_key}" if space_key else None
            self._client = PingCodeClient(self.config, headless=True, login_url=login_url)
            page = self._client.start()
            self._api = PingCodeAPIClient(page, self.config.base_url)
            self._login_space_key = space_key
        return self._api

    def status(self) -> dict[str, Any]:
        configured = self.config.config_path.exists()
        return {
            "configured": configured,
            "session": "connected" if self._api else "not_checked",
            "baseUrl": self.config.base_url if configured else None,
        }

    def list_spaces(self, refresh: bool = False) -> list[dict[str, Any]]:
        return self._submit(self._list_spaces_sync, refresh)

    def _list_spaces_sync(self, refresh: bool = False) -> list[dict[str, Any]]:
        with self._lock:
            api = self._ensure_api()
            spaces = api.get_spaces(limit=1000)
        result = []
        for space in spaces:
            if space.get("is_deleted", 0) == 1:
                continue
            result.append(
                {
                    "id": space.get("_id", ""),
                    "key": space.get("identifier", ""),
                    "name": space.get("name", space.get("identifier", "")),
                    "description": space.get("description", ""),
                    "color": space.get("color") or "#5B7DB1",
                    "favorite": bool(space.get("is_favorite", 0)),
                    "archived": bool(space.get("is_archived", 0)),
                    "visibility": space.get("visibility"),
                    "updatedAt": space.get("updated_at"),
                }
            )
        return sorted(result, key=lambda item: (not item["favorite"], item["name"].lower()))

    def get_space_tree(self, space_key: str, refresh: bool = False) -> TreeResponse:
        return self._submit(self._get_space_tree_sync, space_key, refresh)

    def _get_space_tree_sync(self, space_key: str, refresh: bool = False) -> TreeResponse:
        with self._lock:
            if refresh or space_key not in self._space_cache:
                api = self._ensure_api(space_key)
                space = api.get_space(space_key)
                saved = None if refresh else self._load_index(space_key)
                if saved:
                    pages = saved["pages"]
                    metadata = saved["metadata"]
                else:
                    value = space.get("data", {}).get("value", {})
                    space_id = value.get("_id")
                    if not space_id:
                        raise RuntimeError(f"空间 {space_key} 缺少内部 ID")
                    result = api.get_complete_page_tree(space_id)
                    pages = result["value"]
                    metadata = {
                        "reportedTotal": result["count"],
                        "pageCount": result["page_count"],
                        "capturedAt": datetime.now(timezone.utc).isoformat(),
                    }
                    self._save_index(space_key, pages, metadata)
                self._space_cache[space_key] = (space, pages, metadata)
            space, pages, metadata = self._space_cache[space_key]

        value = space.get("data", {}).get("value", {})
        reported_total = int(metadata.get("reportedTotal", len(pages)))
        builder = TreeBuilder()
        roots, unresolved_parent_ids = builder.build_with_diagnostics(pages)
        partial = len(pages) != reported_total or bool(unresolved_parent_ids)
        reasons = []
        if len(pages) != reported_total:
            reasons.append(f"去重后 {len(pages)} 页，空间报告总数 {reported_total}")
        if unresolved_parent_ids:
            reasons.append(f"存在 {len(unresolved_parent_ids)} 个缺失父节点")
        return TreeResponse(
            space_key=space_key,
            space_name=value.get("name", space_key),
            completeness="partial" if partial else "complete",
            incomplete_reason="；".join(reasons) if reasons else None,
            total=len(pages),
            reported_total=reported_total,
            page_count=int(metadata.get("pageCount", 0)),
            unresolved_parent_ids=unresolved_parent_ids,
            items=[root.to_dict() for root in roots],
        )

    def estimate(self, selection: SourceSelection) -> SourceSnapshot:
        return self._submit(self._estimate_sync, selection)

    def _estimate_sync(self, selection: SourceSelection) -> SourceSnapshot:
        tree = self._get_space_tree_sync(selection.space_key)
        pages = self._space_cache[selection.space_key][1]
        selected_ids = self.resolve_selection(pages, selection)
        selected_pages = [page for page in pages if page.get("_id") in selected_ids]
        attachments = sum(int(page.get("attachment_count", 0) or 0) for page in selected_pages) if selection.include_attachments else 0
        page_estimate_state, attachment_estimate_state = self._estimate_states(pages, selection)
        from datetime import datetime, timezone

        return SourceSnapshot(
            captured_at=datetime.now(timezone.utc),
            completeness=tree.completeness,
            incomplete_reason=tree.incomplete_reason,
            estimated_pages=len(selected_pages),
            estimated_attachments=attachments,
            page_estimate_state=page_estimate_state,
            attachment_estimate_state=attachment_estimate_state,
            inaccessible_count=0,
            selected_page_ids=selected_ids,
        )

    def resolve_selection(
        self, pages: list[dict[str, Any]], selection: SourceSelection
    ) -> list[str]:
        by_parent: dict[str | None, list[str]] = {}
        by_id: dict[str, dict[str, Any]] = {}
        for page in pages:
            page_id = page.get("_id")
            if not page_id:
                continue
            by_id[page_id] = page
            by_parent.setdefault(page.get("parent_id"), []).append(page_id)

        def expand(node_id: str) -> set[str]:
            result = {node_id}
            stack = list(by_parent.get(node_id, []))
            while stack:
                child_id = stack.pop()
                if child_id in result:
                    continue
                result.add(child_id)
                stack.extend(by_parent.get(child_id, []))
            return result

        selected: set[str] = set()
        for rule in selection.include_rules:
            if rule.node_id not in by_id:
                continue
            selected.update(expand(rule.node_id) if rule.scope == "subtree" else {rule.node_id})
        for rule in selection.exclude_rules:
            selected.difference_update(
                expand(rule.node_id) if rule.scope == "subtree" else {rule.node_id}
            )

        keyword = (selection.filters.keyword or "").strip().lower()
        word_count_reliable = any(int(page.get("word_count", 0) or 0) > 0 for page in pages)
        filtered = []
        for page_id in selected:
            page = by_id[page_id]
            if selection.filters.skip_deleted and page.get("is_deleted", 0) == 1:
                continue
            if selection.filters.skip_empty and word_count_reliable:
                if not page.get("word_count", 0) and not page.get("attachment_count", 0):
                    continue
            if keyword and keyword not in page.get("name", "").lower():
                continue
            filtered.append(page_id)
        return filtered

    @staticmethod
    def _estimate_states(
        pages: list[dict[str, Any]], selection: SourceSelection
    ) -> tuple[str, str]:
        word_count_reliable = any(int(page.get("word_count", 0) or 0) > 0 for page in pages)
        attachment_count_reliable = any(int(page.get("attachment_count", 0) or 0) > 0 for page in pages)
        page_state = "upper_bound" if selection.filters.skip_empty and not word_count_reliable else "exact"
        attachment_state = (
            "unknown"
            if selection.include_attachments and not attachment_count_reliable
            else "exact"
        )
        return page_state, attachment_state

    def pages_for_batch(self, space_key: str, page_ids: list[str]) -> list[dict[str, Any]]:
        return self._submit(self._pages_for_batch_sync, space_key, page_ids)

    def _pages_for_batch_sync(
        self, space_key: str, page_ids: list[str]
    ) -> list[dict[str, Any]]:
        self._get_space_tree_sync(space_key)
        pages = self._space_cache[space_key][1]
        selected = set(page_ids)
        return [page for page in pages if page.get("_id") in selected]

    def _index_path(self, space_key: str) -> Path:
        safe_key = "".join(char for char in space_key if char.isalnum() or char in "-_")
        if not safe_key:
            raise ValueError("空间 Key 无效")
        return self._index_dir / f"{safe_key}.json"

    def _load_index(self, space_key: str) -> dict[str, Any] | None:
        path = self._index_path(space_key)
        if not path.exists():
            return None
        try:
            result = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return None
        pages = result.get("pages")
        metadata = result.get("metadata")
        if not isinstance(pages, list) or not isinstance(metadata, dict):
            return None
        if len(pages) != metadata.get("reportedTotal"):
            return None
        return result

    def _save_index(
        self, space_key: str, pages: list[dict[str, Any]], metadata: dict[str, Any]
    ) -> None:
        path = self._index_path(space_key)
        temporary = path.with_suffix(".tmp")
        temporary.write_text(
            json.dumps({"metadata": metadata, "pages": pages}, ensure_ascii=False),
            encoding="utf-8",
        )
        temporary.replace(path)

    def api_call(self, callback, space_key: str | None = None):
        return self._submit(self._api_call_sync, callback, space_key)

    def _api_call_sync(self, callback, space_key: str | None = None):
        with self._lock:
            return callback(self._ensure_api(space_key))
