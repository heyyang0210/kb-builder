import asyncio
import base64
import hashlib
import sys
import json
import logging
import os
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

from .config import PINGCODE_DIR, REPOSITORY_ROOT, settings
from .models import SourceSelection, SourceSnapshot, TreeResponse


PACKAGES_DIR = PINGCODE_DIR.parent
if str(PACKAGES_DIR) not in sys.path:
    sys.path.insert(0, str(PACKAGES_DIR))

from pingcode_core.api_client import MAX_WORK_ITEM_DETAILS_PER_PAGE, PingCodeAPIClient
from pingcode_core.client import PingCodeClient
from pingcode_core.config import PingCodeConfig
from pingcode_core.tree_builder import TreeBuilder
from pingcode_core.content_parser import ContentParser


logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
if not logger.handlers:
    logger.addHandler(logging.StreamHandler())
    logger.propagate = False


class PingcodeTaskSourceError(ValueError):
    def __init__(self, code: str, message: str, **details: Any):
        super().__init__(message)
        self.code = code
        self.details = details


TASK_DETAIL_PROPERTIES = (
    ('ceshijianyi', '测试建议'),
    ('Gittijiaojilu', 'Git 提交记录'),
    ('gaiyaoshejifangan', '概要设计方案'),
    ('kaifashejifangan', '开发设计方案'),
    ('kaifashejifanganpingshenhuiyijiyao', '开发设计方案评审会议纪要'),
    ('ceshishejifangan', '测试设计方案'),
    ('ceshishejifanganpingshen', '测试设计方案评审'),
    ('yongliMRlianjie', '用例 MR 链接'),
    ('fugaishuaibaogao', '覆盖率报告'),
    ('shejibiangeng_1', '设计变更'),
    ('shangcheyunhangcishu', '上车运行次数'),
    ('zhuancezhiliangpingjiAD_1_2', '转测质量评级（A~D）'),
    ('ceshiyonglishu', '测试用例数'),
    ('zhuancezhiliangpingjiamiaoshu_1_2', '转测质量评价描述'),
    ('TSEpinggu_1_2', 'TSE 评估'),
    ('daimahangshu', '代码行数'),
    ('kaifayonglishukaifatianxie', '开发用例数（开发填写）'),
)


def _get_work_item_details(api: PingCodeAPIClient, short_ids: list[str], concurrency: int) -> list[dict]:
    details = []
    for offset in range(0, len(short_ids), MAX_WORK_ITEM_DETAILS_PER_PAGE):
        batch = short_ids[offset:offset + MAX_WORK_ITEM_DETAILS_PER_PAGE]
        details.extend(api.get_work_items(batch, concurrency=concurrency))
    return details


def _task_property_text(value: Any) -> str:
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, list):
        return '\n'.join(text for text in (_task_property_text(item) for item in value) if text)
    if isinstance(value, dict):
        for key in ('text', 'value', 'content', 'display_value', 'label'):
            if key in value:
                return _task_property_text(value[key])
    return ''


def _task_description(detail: dict[str, Any]) -> str:
    from .markdown_cleaning import html_to_markdown

    description = detail.get('description') if isinstance(detail.get('description'), str) else ''
    body = html_to_markdown(description) if description.strip() else 'PingCode 未填写'
    properties = detail.get('properties') if isinstance(detail.get('properties'), dict) else {}
    sections = [f'## 需求描述\n\n{body}']
    for key, label in TASK_DETAIL_PROPERTIES:
        raw = _task_property_text(properties.get(key))
        value = html_to_markdown(raw) if raw else 'PingCode 未填写'
        sections.append(f'## {label}\n\n{value or "PingCode 未填写"}')
    return '\n\n'.join(sections)


class PingCodeService:
    def __init__(self):
        self.config = PingCodeConfig(settings.pingcode_config)
        self._client: PingCodeClient | None = None
        self._api: PingCodeAPIClient | None = None
        self._lock = threading.RLock()
        self._executor: ThreadPoolExecutor | None = self._new_executor()
        self._closed = False
        self._relation_concurrency = self._configured_concurrency('PINGCODE_RELATION_CONCURRENCY')
        self._detail_concurrency = self._configured_concurrency('PINGCODE_DETAIL_CONCURRENCY')
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
    def _configured_concurrency(name: str) -> int:
        try:
            value = int(os.getenv(name, '50'))
        except ValueError as exc:
            raise RuntimeError(f'{name} 必须为 1 至 50 的整数') from exc
        if not 1 <= value <= 50:
            raise RuntimeError(f'{name} 必须为 1 至 50 的整数')
        return value

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

        def invoke():
            try:
                return self._isolate_asyncio(callback, *args)
            except Exception as exc:
                if self._is_browser_transport_failure(exc):
                    self._invalidate_client()
                raise

        return executor.submit(invoke).result()

    @staticmethod
    def _is_browser_transport_failure(exc: Exception) -> bool:
        message = str(exc).lower()
        return any(
            marker in message
            for marker in (
                "handler is closed",
                "writeunixtransport closed",
                "connection closed while reading from the driver",
                "playwright connection closed",
            )
        )

    def _invalidate_client(self) -> None:
        """驱动通道已关闭时不再调用失效对象的 close，下次请求重建会话。"""
        with self._lock:
            self._client = None
            self._api = None
            self._login_space_key = None

    def prewarm(self) -> None:
        """启动时异步建立账号会话，不阻塞 API 启动或读取空间目录。"""
        with self._lock:
            if not self._closed and self._executor is not None:
                self._executor.submit(self._isolate_asyncio, self._prewarm_sync)

    def _prewarm_sync(self) -> None:
        try:
            with self._lock:
                self._ensure_api()
        except Exception:
            logger.warning("PingCode 账号会话预热失败，首次请求将重新初始化")
            try:
                self._close_sync()
            except Exception:
                self._invalidate_client()

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
        normalized: list[dict[str, Any]] = []
        by_id: dict[str, dict[str, Any]] = {}
        for page in pages:
            page_id = str(page.get("_id") or "")
            if not page_id or page_id not in selected:
                continue
            previous = by_id.get(page_id)
            if previous is None:
                by_id[page_id] = page
                normalized.append(page)
                continue
            if previous != page:
                raise ValueError(f"页面 ID 冲突，无法确定下载内容：{page_id}")
            logger.warning("折叠重复页面记录: space=%s pageId=%s", space_key, page_id)
        return normalized

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

    def read_reference(self, space_key: str, page_id: str, include_images: bool = False) -> dict[str, Any]:
        """读取已有账号可访问的单篇参考正文，不创建下载批次。"""
        if not all(re.fullmatch(r"[A-Za-z0-9_-]+", value) for value in (space_key, page_id)):
            raise ValueError("页面定位符无效")
        if include_images:
            return self._submit(self._read_reference_sync, space_key, page_id, True)
        return self._submit(self._read_reference_sync, space_key, page_id)

    def read_baseline_ideas_reference(self, product_code: str, baseline_id: str, category: str = "all") -> dict[str, Any]:
        if not all(re.fullmatch(r"[A-Za-z0-9_-]+", value) for value in (product_code, baseline_id, category)):
            raise ValueError("基线定位符无效")
        return self._submit(self._read_baseline_ideas_reference_sync, product_code, baseline_id, category)

    def read_task_source_page(self, source_url: str, source_type: str, page_index: int) -> dict[str, Any]:
        """Read one bounded page for a platform-managed Pingcode source."""
        try:
            return self._submit(self._read_task_source_page_sync, source_url, source_type, page_index)
        except (TypeError, ValueError) as exc:
            reason = re.sub(r'https?://\S+', '<URL>', str(exc))
            reason = re.sub(r'(?i)(token|authorization|cookie|password)\s*[=:]\s*\S+', r'\1=<REDACTED>', reason)
            logger.warning(
                'pingcode.task_source_page.validation_failed sourceType=%s pageIndex=%s '
                'errorType=%s reason=%s', source_type, page_index, type(exc).__name__, reason[:160],
            )
            raise

    def read_task_source_pages(self, source_url: str) -> dict[str, Any]:
        """Read and validate all pages of one requirement baseline in one browser session."""
        try:
            return self._submit(self._read_task_source_pages_sync, source_url)
        except (TypeError, ValueError) as exc:
            reason = re.sub(r'https?://\S+', '<URL>', str(exc))
            reason = re.sub(r'(?i)(token|authorization|cookie|password)\s*[=:]\s*\S+', r'\1=<REDACTED>', reason)
            logger.warning('pingcode.task_source_pages.validation_failed errorType=%s reason=%s',
                           type(exc).__name__, reason[:160])
            raise

    def _read_task_source_pages_sync(self, source_url: str) -> dict[str, Any]:
        started_at = time.perf_counter()
        parsed = urlparse(source_url)
        configured_host = urlparse(self.config.base_url).hostname
        match = re.fullmatch(r'/ship/products/([A-Za-z0-9_-]+)/baselines/([A-Za-z0-9_-]+)/ideas', parsed.path)
        query = parse_qs(parsed.query, strict_parsing=True)
        if (parsed.scheme != 'https' or parsed.hostname != configured_host or parsed.username or parsed.password
                or parsed.fragment or not match or set(query) - {'category'}
                or len(query.get('category', ['all'])) != 1):
            raise ValueError('Pingcode 需求基线来源 URL 无效')
        product_code, baseline_id = match.groups()
        category = query.get('category', ['all'])[0]
        if not re.fullmatch(r'[A-Za-z0-9_-]+', category):
            raise ValueError('基线分类无效')
        api = self._ensure_api()
        phase = time.perf_counter()
        product = api.get_product(product_code).get('data', {}).get('value', {})
        product_id = product.get('_id')
        if product.get('identifier') != product_code or not product_id:
            raise ValueError('Pingcode 产品与来源不一致')
        baseline = api.get_baseline(product_id, baseline_id).get('data', {}).get('value', {})
        if (baseline.get('short_id') != baseline_id or baseline.get('scope') != product_id
                or baseline.get('updated_at') is None):
            raise ValueError('Pingcode 基线与来源不一致')
        suite_id = ''
        if category != 'all':
            suites = api.get_baseline_suites(product_id, baseline_id).get('data', {}).get('value', [])
            matches = [item for item in suites if item.get('short_id') == category and item.get('product_id') == product_id]
            if len(matches) != 1:
                raise ValueError('基线分类不属于当前产品')
            suite_id = matches[0]['_id']
        project = api.get_agile_project('YDBRD').get('data', {}).get('value', {})
        project_id = project.get('_id')
        if project.get('identifier') != 'YDBRD' or not project_id:
            raise ValueError('关联工作项所属项目无法验证')
        metadata_duration_ms = (time.perf_counter() - phase) * 1000

        phase = time.perf_counter()
        first = api.get_baseline_ideas(product_id, baseline_id, 0, suite_id=suite_id).get('data', {})
        page_count = first.get('page_count')
        count = first.get('count')
        if not isinstance(page_count, int) or not 0 <= page_count <= 100 or not isinstance(count, int) or count < 0:
            raise ValueError('基线分页响应无效')
        remaining = api.get_baseline_ideas_pages(product_id, baseline_id, page_count, suite_id=suite_id)
        raw_pages = [first, *[item.get('data', {}) for item in remaining]]
        if len(raw_pages) != max(page_count, 1):
            raise ValueError('基线分页缺失')
        ideas_by_page = []
        all_ideas = []
        for page_index, data in enumerate(raw_pages):
            ideas = data.get('value')
            if (not isinstance(ideas, list) or data.get('count') != count or data.get('page_count') != page_count
                    or (page_index > 0 and page_count == 0)):
                raise ValueError('基线分页响应无效')
            for idea in ideas:
                identifier = idea.get('whole_identifier', '')
                if not identifier.startswith(f'{product_code}-') or not idea.get('_id') or not idea.get('version_id'):
                    raise ValueError('基线需求身份或版本缺失')
            ideas_by_page.append(ideas)
            all_ideas.extend(ideas)
        if len(all_ideas) != count:
            raise ValueError('基线分页总数不完整')
        pages_duration_ms = (time.perf_counter() - phase) * 1000

        phase = time.perf_counter()
        relations = api.get_idea_work_items_batch(
            [(idea['_id'], idea['version_id']) for idea in all_ideas], concurrency=self._relation_concurrency)
        if len(relations) != len(all_ideas):
            raise ValueError('需求关系响应数量不一致')
        related_by_idea = []
        unique_related = {}
        unlinked_numbers = []
        relation_incomplete = []
        for idea, relation in zip(all_ideas, relations):
            related = relation.get('data', {}).get('value') if isinstance(relation, dict) else None
            expected = idea.get('relation_data', {}).get('work_item', 0)
            if not isinstance(related, list) or not isinstance(expected, int) or expected < 0:
                actual = len(related) if isinstance(related, list) else None
                relation_incomplete.append({'number': idea.get('whole_identifier'), 'expected': expected, 'actual': actual})
                continue
            if not related and expected > 0:
                unlinked_numbers.append(idea['whole_identifier'])
            elif len(related) != expected:
                relation_incomplete.append({'number': idea['whole_identifier'], 'expected': expected, 'actual': len(related)})
                continue
            if any(re.fullmatch(r'YDBRD-\d+', item.get('whole_identifier', ''))
                   and (item.get('project_id') != project_id or not item.get('_id') or not item.get('short_id'))
                   for item in related):
                raise PingcodeTaskSourceError('PINGCODE_RELATION_IDENTITY_INVALID', '需求关联工作项身份无法验证')
            filtered = [item for item in related if re.fullmatch(r'YDBRD-\d+', item.get('whole_identifier', ''))]
            related_by_idea.append((idea, filtered))
            for item in filtered:
                existing = unique_related.get(item['short_id'])
                if existing and (existing.get('_id'), existing.get('whole_identifier'), existing.get('project_id')) != (
                    item.get('_id'), item.get('whole_identifier'), item.get('project_id')
                ):
                    raise PingcodeTaskSourceError('PINGCODE_RELATION_IDENTITY_INVALID', '同一工作项短编号对应多个身份')
                unique_related[item['short_id']] = item
        if relation_incomplete:
            logger.warning('pingcode.task_source_pages.relation_incomplete count=%s firstSourceNumber=%s',
                           len(relation_incomplete), relation_incomplete[0]['number'])
            first_issue = relation_incomplete[0]
            raise PingcodeTaskSourceError('PINGCODE_RELATION_INCOMPLETE', '需求关联工作项数量与详情不一致',
                sourceNumber=first_issue['number'], expectedCount=first_issue['expected'], actualCount=first_issue['actual'])
        relation_duration_ms = (time.perf_counter() - phase) * 1000

        phase = time.perf_counter()
        short_ids = list(unique_related)
        details = _get_work_item_details(api, short_ids, self._detail_concurrency)
        if len(details) != len(short_ids):
            raise ValueError('关联工作项详情响应数量不一致')
        details_by_short_id = dict(zip(short_ids, details))
        latest_baseline = api.get_baseline(product_id, baseline_id).get('data', {}).get('value', {})
        if (latest_baseline.get('short_id') != baseline_id or latest_baseline.get('scope') != product_id
                or latest_baseline.get('updated_at') != baseline.get('updated_at')):
            raise PingcodeTaskSourceError('PINGCODE_SOURCE_CHANGED', '采集期间 Pingcode 基线版本已变化')
        related_by_idea_id = {idea['_id']: work_items for idea, work_items in related_by_idea}
        pages = []
        for page_index, ideas in enumerate(ideas_by_page):
            page_items = []
            for idea in ideas:
                identifier = idea['whole_identifier']
                related = related_by_idea_id[idea['_id']]
                work_items = []
                for item in related:
                    detail = details_by_short_id[item['short_id']]
                    if (not isinstance(detail, dict) or detail.get('_id') != item['_id']
                            or detail.get('short_id') != item['short_id']
                            or detail.get('whole_identifier') != item['whole_identifier']
                            or detail.get('project_id') != project_id):
                        raise ValueError('关联工作项详情与需求来源不一致')
                    work_items.append({'number': item['whole_identifier'], 'id': item['_id'],
                        'shortId': item['short_id'], 'title': detail.get('title', ''),
                        'description': _task_description(detail), 'projectId': project_id,
                        'ownerId': detail.get('assignee'), 'createdAt': detail.get('created_at'),
                        'updatedAt': detail.get('updated_at')})
                page_items.append({'ir': identifier, 'irId': idea['_id'], 'workItems': work_items})
            pages.append({'sourceType': 'requirement', 'sourceId': baseline_id,
                'sourceVersion': baseline.get('updated_at'), 'count': count, 'pageIndex': page_index,
                'pageCount': page_count, 'unlinkedIrCount': sum(
                    1 for idea in ideas if idea['whole_identifier'] in unlinked_numbers), 'items': page_items})
        detail_duration_ms = (time.perf_counter() - phase) * 1000
        logger.info('pingcode.task_source_pages.completed sourceId=%s pageCount=%s rowCount=%s srCount=%s '
            'unlinkedIrCount=%s metadataDurationMs=%.1f pagesDurationMs=%.1f relationRequests=%s '
            'relationDurationMs=%.1f detailRequests=%s detailDurationMs=%.1f durationMs=%.1f',
            baseline_id, page_count, count, len(short_ids), len(unlinked_numbers), metadata_duration_ms,
            pages_duration_ms, len(all_ideas), relation_duration_ms, len(short_ids), detail_duration_ms,
            (time.perf_counter() - started_at) * 1000)
        return {'pages': pages, 'pageCount': page_count, 'count': count,
                'unlinkedIrNumbers': sorted(set(unlinked_numbers))}

    def read_task_source_image(self, image_url: str, max_bytes: int, timeout_ms: int) -> dict[str, Any]:
        """Read a Pingcode public image through the authorized connector session."""
        return self._submit(self._read_task_source_image_sync, image_url, max_bytes, timeout_ms)

    def _read_task_source_image_sync(self, image_url: str, max_bytes: int, timeout_ms: int) -> dict[str, Any]:
        parsed = urlparse(image_url)
        base = urlparse(self.config.base_url)
        if (parsed.scheme != 'https' or parsed.netloc != base.netloc or parsed.username or parsed.password
                or parsed.fragment or not parsed.path.startswith('/atlas/files/public/')
                or not 1 <= max_bytes <= 5242880 or not 1 <= timeout_ms <= 15000):
            raise ValueError('图片地址或读取限制无效')
        data, content_type = self._ensure_api().download_public_image(
            {'originUrl': image_url}, max_bytes=max_bytes, timeout_ms=timeout_ms)
        return {'dataBase64': base64.b64encode(data).decode('ascii'), 'contentType': content_type}

    def _read_task_source_page_sync(self, source_url: str, source_type: str, page_index: int) -> dict[str, Any]:
        started_at = time.perf_counter()
        relation_duration_ms = 0.0
        relation_request_count = 0
        detail_duration_ms = 0.0
        product_duration_ms = 0.0
        baseline_duration_ms = 0.0
        project_duration_ms = 0.0
        parsed = urlparse(source_url)
        configured_host = urlparse(self.config.base_url).hostname
        if (parsed.scheme != 'https' or parsed.hostname != configured_host
                or parsed.username or parsed.password or parsed.fragment
                or not isinstance(page_index, int) or page_index < 0):
            raise ValueError('Pingcode 来源 URL 或分页无效')
        if source_type not in {'requirement', 'ticket'}:
            raise ValueError('Pingcode 来源类型无效')
        api = self._ensure_api()
        if source_type == 'requirement':
            match = re.fullmatch(r'/ship/products/([A-Za-z0-9_-]+)/baselines/([A-Za-z0-9_-]+)/ideas', parsed.path)
            query = parse_qs(parsed.query, strict_parsing=True)
            if not match or set(query) - {'category'} or len(query.get('category', ['all'])) != 1:
                raise ValueError('需求来源必须是产品基线需求列表')
            product_code, baseline_id = match.groups()
            category = query.get('category', ['all'])[0]
            if not re.fullmatch(r'[A-Za-z0-9_-]+', category):
                raise ValueError('基线分类无效')
            phase_started_at = time.perf_counter()
            product = api.get_product(product_code).get('data', {}).get('value', {})
            product_duration_ms = (time.perf_counter() - phase_started_at) * 1000
            product_id = product.get('_id')
            if product.get('identifier') != product_code or not product_id:
                raise ValueError('Pingcode 产品与来源不一致')
            phase_started_at = time.perf_counter()
            baseline = api.get_baseline(product_id, baseline_id).get('data', {}).get('value', {})
            baseline_duration_ms = (time.perf_counter() - phase_started_at) * 1000
            if (baseline.get('short_id') != baseline_id or baseline.get('scope') != product_id
                    or baseline.get('updated_at') is None):
                raise ValueError('Pingcode 基线与来源不一致')
            suite_id = ''
            if category != 'all':
                suites = api.get_baseline_suites(product_id, baseline_id).get('data', {}).get('value', [])
                matches = [item for item in suites if item.get('short_id') == category and item.get('product_id') == product_id]
                if len(matches) != 1:
                    raise ValueError('基线分类不属于当前产品')
                suite_id = matches[0]['_id']
            page_started_at = time.perf_counter()
            data = api.get_baseline_ideas(product_id, baseline_id, page_index, suite_id=suite_id).get('data', {})
            page_duration_ms = round((time.perf_counter() - page_started_at) * 1000, 1)
            ideas = data.get('value')
            if (not isinstance(ideas, list) or not isinstance(data.get('count'), int)
                    or not isinstance(data.get('page_count'), int)
                    or page_index >= data['page_count'] and data['count'] != 0):
                raise ValueError('基线分页响应无效')
            phase_started_at = time.perf_counter()
            project = api.get_agile_project('YDBRD').get('data', {}).get('value', {})
            project_duration_ms = (time.perf_counter() - phase_started_at) * 1000
            project_id = project.get('_id')
            if project.get('identifier') != 'YDBRD' or not project_id:
                raise ValueError('关联工作项所属项目无法验证')
            valid_ideas = []
            for idea in ideas:
                identifier = idea.get('whole_identifier', '')
                if not identifier.startswith(f'{product_code}-') or not idea.get('_id') or not idea.get('version_id'):
                    raise ValueError('基线需求身份或版本缺失')
                valid_ideas.append(idea)
            relation_started_at = time.perf_counter()
            relations = api.get_idea_work_items_batch([
                (idea['_id'], idea['version_id']) for idea in valid_ideas
            ], concurrency=self._relation_concurrency)
            relation_duration_ms = (time.perf_counter() - relation_started_at) * 1000
            relation_request_count = len(valid_ideas)
            related_by_idea = []
            unique_related_by_short_id = {}
            unlinked_ir_count = 0
            for idea, relation in zip(valid_ideas, relations):
                identifier = idea['whole_identifier']
                relation = relation.get('data', {})
                related = relation.get('value')
                expected = idea.get('relation_data', {}).get('work_item', 0)
                if not isinstance(related, list) or not isinstance(expected, int) or expected < 0:
                    actual = len(related) if isinstance(related, list) else None
                    logger.warning(
                        'pingcode.task_source_page.relation_incomplete sourceId=%s pageIndex=%s '
                        'sourceNumber=%s expectedCount=%s actualCount=%s relationRequests=%s '
                        'relationDurationMs=%.1f productDurationMs=%.1f baselineDurationMs=%.1f '
                        'projectDurationMs=%.1f detailDurationMs=%.1f durationMs=%.1f',
                        baseline_id, page_index, identifier, expected, actual, relation_request_count,
                        relation_duration_ms, product_duration_ms, baseline_duration_ms,
                        project_duration_ms, detail_duration_ms, (time.perf_counter() - started_at) * 1000,
                    )
                    raise PingcodeTaskSourceError(
                        'PINGCODE_RELATION_INCOMPLETE', '需求关联工作项数量与详情不一致',
                        sourceNumber=identifier, expectedCount=expected, actualCount=actual,
                    )
                if not related and expected > 0:
                    unlinked_ir_count += 1
                    logger.warning(
                        'pingcode.task_source_page.unlinked_ir sourceId=%s pageIndex=%s '
                        'sourceNumber=%s expectedCount=%s actualCount=0 relationRequests=%s relationDurationMs=%.1f',
                        baseline_id, page_index, identifier, expected, relation_request_count, relation_duration_ms,
                    )
                elif len(related) != expected:
                    logger.warning(
                        'pingcode.task_source_page.relation_incomplete sourceId=%s pageIndex=%s '
                        'sourceNumber=%s expectedCount=%s actualCount=%s relationRequests=%s relationDurationMs=%.1f',
                        baseline_id, page_index, identifier, expected, len(related), relation_request_count,
                        relation_duration_ms,
                    )
                    raise PingcodeTaskSourceError(
                        'PINGCODE_RELATION_INCOMPLETE', '需求关联工作项数量与详情不一致',
                        sourceNumber=identifier, expectedCount=expected, actualCount=len(related),
                    )
                if any(re.fullmatch(r'YDBRD-\d+', item.get('whole_identifier', ''))
                       and (item.get('project_id') != project_id or not item.get('_id') or not item.get('short_id'))
                       for item in related):
                    raise PingcodeTaskSourceError(
                        'PINGCODE_RELATION_IDENTITY_INVALID', '需求关联工作项身份无法验证',
                    )
                related_items = [item for item in related
                                 if re.fullmatch(r'YDBRD-\d+', item.get('whole_identifier', ''))]
                related_by_idea.append((idea, related_items))
                for item in related_items:
                    existing = unique_related_by_short_id.get(item['short_id'])
                    if existing and (existing.get('_id'), existing.get('whole_identifier'), existing.get('project_id')) != (
                        item.get('_id'), item.get('whole_identifier'), item.get('project_id')
                    ):
                        raise PingcodeTaskSourceError(
                            'PINGCODE_RELATION_IDENTITY_INVALID', '同一工作项短编号对应多个身份',
                        )
                    unique_related_by_short_id[item['short_id']] = item

            detail_started_at = time.perf_counter()
            detail_short_ids = list(unique_related_by_short_id)
            details = api.get_work_items(detail_short_ids, concurrency=self._detail_concurrency)
            detail_duration_ms = (time.perf_counter() - detail_started_at) * 1000
            if len(details) != len(detail_short_ids):
                raise ValueError('关联工作项详情响应数量不一致')
            details_by_short_id = dict(zip(detail_short_ids, details))

            items = []
            for idea, related_items in related_by_idea:
                identifier = idea['whole_identifier']
                work_items = []
                for item in related_items:
                    detail = details_by_short_id[item['short_id']]
                    mismatch_fields = []
                    if not isinstance(detail, dict):
                        mismatch_fields.append('detail_shape')
                    else:
                        for field, expected in (
                            ('_id', item['_id']), ('short_id', item['short_id']),
                            ('whole_identifier', item['whole_identifier']), ('project_id', project_id),
                        ):
                            if detail.get(field) != expected:
                                mismatch_fields.append(field)
                    if mismatch_fields:
                        logger.warning(
                            'pingcode.task_source_page.detail_identity_mismatch sourceId=%s '
                            'pageIndex=%s sourceNumber=%s shortId=%s mismatchFields=%s',
                            baseline_id, page_index, identifier, item['short_id'], ','.join(mismatch_fields),
                        )
                        raise ValueError('关联工作项详情与需求来源不一致')
                    work_items.append({'number': item['whole_identifier'], 'id': item['_id'],
                        'shortId': item['short_id'], 'title': detail.get('title', ''),
                        'description': _task_description(detail), 'projectId': project_id,
                        'ownerId': detail.get('assignee'), 'createdAt': detail.get('created_at'),
                        'updatedAt': detail.get('updated_at')})
                items.append({'ir': identifier, 'irId': idea['_id'], 'workItems': work_items})
            logger.info(
                'pingcode.task_source_page.completed sourceType=%s sourceId=%s pageIndex=%s '
                'pageCount=%s rowCount=%s productDurationMs=%.1f baselineDurationMs=%.1f '
                'projectDurationMs=%.1f relationRequests=%s relationDurationMs=%.1f '
                'detailDurationMs=%.1f pageReadDurationMs=%.1f durationMs=%.1f',
                source_type, baseline_id, page_index, data.get('page_count'), len(ideas),
                product_duration_ms, baseline_duration_ms, project_duration_ms,
                relation_request_count, relation_duration_ms, detail_duration_ms, page_duration_ms,
                (time.perf_counter() - started_at) * 1000,
            )
            return {'sourceType': source_type, 'sourceId': baseline_id, 'sourceVersion': baseline.get('updated_at'),
                    'count': data.get('count'), 'pageIndex': page_index, 'pageCount': data.get('page_count'),
                    'unlinkedIrCount': unlinked_ir_count, 'items': items}

        match = re.fullmatch(r'/pjm/projects/(YDBRD)/defect/([A-Za-z0-9_-]+)', parsed.path)
        if not match or parsed.query:
            raise ValueError('工单来源必须是 YDBRD 缺陷视图')
        view_short_id = match.group(2)
        project = api.get_agile_project('YDBRD').get('data', {}).get('value', {})
        project_id = project.get('_id')
        if project.get('identifier') != 'YDBRD' or not project_id:
            raise ValueError('工单项目身份无效')
        addon = next((item for item in project.get('addons', []) if item.get('_id') and item.get('key') == 'defect'), None)
        if not addon:
            raise ValueError('工单项目缺少缺陷视图能力')
        addon_id = addon['_id']
        view = api.get_defect_view(project_id, addon_id, view_short_id).get('data', {}).get('value', {})
        if (view.get('short_id') != view_short_id or view.get('addon_id') != addon_id
                or not view.get('_id') or view.get('updated_at') is None):
            raise ValueError('工单视图归属无效')
        query = view.get('query')
        if not isinstance(query, dict):
            raise ValueError('工单视图筛选条件无效')
        criteria = {'search': {'keywords': '', 'scopes': ['identifier', 'title']}, **query,
                    'group_by': '', 'show_type': 2, 'sort_type': 1}
        columns = [item['property_key'] for item in view.get('columns', []) if item.get('property_key')]
        if 'description' not in columns:
            columns.append('description')
        data = api.get_defect_view_content(project_id, view['_id'], addon_id, criteria, columns, page_index).get('data', {})
        rows = data.get('value')
        if (not isinstance(rows, list) or not isinstance(data.get('count'), int)
                or not isinstance(data.get('page_count'), int)
                or page_index >= data['page_count'] and data['count'] != 0):
            raise ValueError('工单视图分页响应无效')
        if any(not isinstance(item, dict) or not re.fullmatch(r'YDBRD-\d+', item.get('whole_identifier', ''))
               or item.get('project_id') != project_id or not item.get('_id') or not item.get('short_id')
               for item in rows):
            raise ValueError('工单视图返回非目标项目工作项')
        detail_started_at = time.perf_counter()
        details = api.get_work_items([item['short_id'] for item in rows])
        detail_duration_ms = (time.perf_counter() - detail_started_at) * 1000
        if len(details) != len(rows):
            raise ValueError('工单详情响应数量不一致')
        items = []
        for item, detail in zip(rows, details):
            if (not isinstance(detail, dict) or detail.get('_id') != item['_id']
                    or detail.get('whole_identifier') != item['whole_identifier']
                    or detail.get('short_id') != item['short_id'] or detail.get('project_id') != project_id
                    or not isinstance(detail.get('description'), str)):
                raise ValueError('Pingcode 工单详情与所选视图不一致')
            items.append({'number': item['whole_identifier'], 'id': item['_id'], 'shortId': item['short_id'],
                          'title': detail.get('title', ''), 'description': _task_description(detail),
                          'projectId': project_id, 'ownerId': detail.get('assignee'),
                          'createdAt': detail.get('created_at'), 'updatedAt': detail.get('updated_at')})
        logger.info(
            'pingcode.task_source_page.completed sourceType=%s sourceId=%s pageIndex=%s '
            'pageCount=%s rowCount=%s relationRequests=0 detailDurationMs=%.1f durationMs=%.1f',
            source_type, view['_id'], page_index, data.get('page_count'), len(rows), detail_duration_ms,
            (time.perf_counter() - started_at) * 1000,
        )
        return {'sourceType': source_type, 'sourceId': view['_id'], 'sourceVersion': view.get('updated_at'),
                'count': data.get('count'), 'pageIndex': page_index, 'pageCount': data.get('page_count'),
                'criteria': criteria, 'items': items}

    def _read_baseline_ideas_reference_sync(self, product_code: str, baseline_id: str, category: str) -> dict[str, Any]:
        with self._lock:
            from urllib.parse import urlencode
            url = (f"{self.config.base_url.rstrip('/')}/ship/products/{product_code}"
                   f"/baselines/{baseline_id}/ideas?{urlencode({'category': category})}")
            api = self._ensure_api()
            product = api.get_product(product_code).get("data", {}).get("value", {})
            product_id = str(product.get("_id") or "") if isinstance(product, dict) else ""
            if not re.fullmatch(r"[A-Za-z0-9_-]+", product_id) or product.get("identifier") != product_code:
                raise ValueError("PingCode 产品与请求不一致")
            baseline = api.get_baseline(product_id, baseline_id).get("data", {}).get("value", {})
            if not isinstance(baseline, dict) or baseline.get("short_id") != baseline_id or baseline.get("scope") != product_id:
                raise ValueError("PingCode 基线与请求不一致")
            suite_id = ""
            title = str(baseline.get("name") or f"{product_code} 基线想法")
            if category != "all":
                suites = api.get_baseline_suites(product_id, baseline_id).get("data", {}).get("value")
                if not isinstance(suites, list):
                    raise ValueError("PingCode 基线分组响应无效")
                matches = [item for item in suites if isinstance(item, dict) and item.get("short_id") == category
                           and item.get("product_id") == product_id]
                if len(matches) != 1 or not re.fullmatch(r"[A-Za-z0-9_-]+", str(matches[0].get("_id") or "")):
                    raise ValueError("基线中不存在唯一匹配的分组")
                suite_id = str(matches[0]["_id"])
                title = f"{title} · {matches[0].get('name') or category}"
            rows = []
            expected_count = None
            suite_filter = {"suite_id": suite_id} if suite_id else {}
            for page_index in range(20):
                data = api.get_baseline_ideas(product_id, baseline_id, page_index, **suite_filter).get("data", {})
                batch = data.get("value")
                count = data.get("count")
                if not isinstance(batch, list) or not isinstance(count, int) or count < 0 or count > 1000:
                    raise ValueError("PingCode 基线列表响应无效")
                if expected_count is None:
                    expected_count = count
                elif count != expected_count:
                    raise ValueError("PingCode 基线列表读取期间发生变化")
                rows.extend(batch)
                if len(rows) >= count:
                    break
                if not batch:
                    raise ValueError("PingCode 基线列表分页不完整")
            if len(rows) != expected_count:
                raise ValueError("基线页面分页结果不完整")
            from .markdown_cleaning import html_to_markdown
            lines = [f"# {title}", f"共 {expected_count} 条需求", ""]
            for item in rows:
                if not isinstance(item, dict) or not isinstance(item.get("whole_identifier"), str) or not isinstance(item.get("title"), str):
                    raise ValueError("PingCode 基线需求字段无效")
                if not item["whole_identifier"].startswith(f"{product_code}-"):
                    raise ValueError("PingCode 基线需求不属于目标产品")
                lines.append(f"## {item['whole_identifier']}: {item['title']}")
                if isinstance(item.get("description"), str) and item["description"].strip():
                    lines.append(html_to_markdown(item["description"]))
            content = "\n".join(lines)
            return {
                "productCode": product_code, "baselineId": baseline_id, "category": category,
                "title": title, "content": content,
                "originalUrl": url,
            }

    def _read_reference_sync(self, space_key: str, page_id: str, include_images: bool = False) -> dict[str, Any]:
        with self._lock:
            pages = self._pages_for_batch_sync(space_key, [page_id])
            if not pages:
                # The web URL uses identifier; resolve only inside the verified space.
                pages = [page for page in self._space_cache[space_key][1]
                         if page_id in (str(page.get("short_id") or ""), str(page.get("identifier") or ""))]
            if len(pages) != 1:
                raise KeyError("空间中不存在唯一匹配的页面")
            canonical_id = str(pages[0]["_id"])
            response = self._ensure_api(space_key).get_page(canonical_id)
            value = response.get("data", {}).get("value", {})
            if not isinstance(value, dict) or not value.get("document"):
                raise ValueError("页面没有可引用的正文")
            if value.get("_id") and str(value["_id"]) != canonical_id:
                raise ValueError("页面详情与请求不一致")
            parser = ContentParser()
            image_resources = []
            image_urls = {}
            if include_images:
                policy_path = REPOSITORY_ROOT / "config" / "knowledge-center" / "content-rules.json"
                policy = json.loads(policy_path.read_text(encoding="utf-8"))["productionAI"]["sources"]["images"]
                total_bytes = 0
                deadline = time.monotonic() + policy["timeoutMs"] / 1000
                for index, image in enumerate(parser.extract_images(value["document"])):
                    source_url = image.get("originUrl") or image.get("thumbUrl") or image.get("url")
                    reference = "source-image:" + hashlib.sha256(f"{index}:{source_url}".encode()).hexdigest()
                    image_urls[id(image)] = reference
                    resource = {"reference": reference, "status": "failed"}
                    image_resources.append(resource)
                    remaining_ms = int((deadline - time.monotonic()) * 1000)
                    if index >= policy["maxCount"] or total_bytes >= policy["maxTotalBytes"] or remaining_ms <= 0:
                        resource["errorCode"] = "AI_SOURCE_IMAGE_LIMIT"
                        continue
                    try:
                        data, content_type = self._ensure_api(space_key).download_public_image(
                            image, max_bytes=min(policy["maxBytes"], policy["maxTotalBytes"] - total_bytes),
                            timeout_ms=remaining_ms)
                        if content_type not in policy["contentTypes"]:
                            resource["errorCode"] = "AI_SOURCE_IMAGE_FORMAT"
                            continue
                        total_bytes += len(data)
                        resource.update({"status": "ready", "dataBase64": base64.b64encode(data).decode("ascii")})
                    except Exception:
                        resource["errorCode"] = "AI_SOURCE_IMAGE_UNAVAILABLE"
            content = parser.parse_document(value["document"], image_resolver=lambda image: image_urls.get(id(image), "") if include_images else None) if include_images else parser.parse_document(value["document"])
            if not content.strip():
                raise ValueError("页面没有可引用的正文")
            result = {
                "content": content,
                "title": value.get("name") or pages[0].get("name") or page_id,
                "spaceKey": space_key,
                "pageId": page_id,
                "canonicalPageId": canonical_id,
                "originalUrl": f"{self.config.base_url.rstrip('/')}/wiki/spaces/{space_key}/pages/{page_id}",
            }
            if include_images:
                result["imageResources"] = image_resources
            if isinstance(value.get("version"), (str, int)):
                result["sourceVersion"] = value["version"]
            if isinstance(value.get("updated_at"), str):
                result["sourceUpdatedAt"] = value["updated_at"]
            return result

    def _api_call_sync(self, callback, space_key: str | None = None):
        with self._lock:
            return callback(self._ensure_api(space_key))
