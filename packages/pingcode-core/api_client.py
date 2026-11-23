"""
PingCode API 客户端

通过浏览器 Cookie 鉴权，调用 PingCode REST API。
"""

import time
import re
from typing import Callable
from urllib.parse import parse_qsl, urlencode, urljoin, urlparse, urlunparse

from playwright.sync_api import Page

MAX_WORK_ITEM_DETAILS_PER_PAGE = 500
MAX_BROWSER_FETCH_CONCURRENCY = 50
MAX_TASK_SOURCE_RELATIONS = 5000
PAGE_TREE_FETCH_CONCURRENCY = 8


class PingCodeAPIClient:
    """PingCode REST API 客户端"""
    
    def __init__(self, page: Page, base_url: str):
        self.page = page
        self.base_url = base_url.rstrip('/')
        self._public_image_token = ''
        self._public_image_token_at = 0.0
    
    def get_space(self, space_key: str) -> dict:
        """获取空间信息"""
        return self._api_request(f'/api/wiki/spaces/{space_key}')

    def get_spaces(self, limit: int = 1000) -> list[dict]:
        """获取当前账号可访问的空间列表。"""
        result = self._api_request(f'/api/wiki/spaces?limit={limit}')
        data = result.get('data', {})
        return data.get('value', []) if isinstance(data, dict) else []
    
    def get_pages(self, space_key: str, limit: int = 1000) -> list[dict]:
        """获取空间所有页面（最多 1000 条）"""
        result = self._api_request(f'/api/wiki/spaces/{space_key}/pages?limit={limit}')
        return result.get('data', {}).get('value', [])

    def get_page_tree_root(self, space_id: str) -> dict:
        """获取空间真实根节点及目录分页元数据。"""
        result = self._api_request(
            f'/api/wiki/spaces/{space_id}/page-tree-v2?scene=simple&only_fetch=root'
        )
        return self._page_tree_data(result)

    def get_page_tree_children(self, space_id: str, page_index: int) -> dict:
        """获取一个目录子分页；响应会重复携带部分祖先节点。"""
        result = self._api_request(
            f'/api/wiki/spaces/{space_id}/page-tree-v2'
            f'?scene=simple&only_fetch=child&pi={page_index}'
        )
        return self._page_tree_data(result)

    def get_page_tree_children_batch(self, space_id: str, page_indexes: list[int]) -> list[dict]:
        """在浏览器会话内并发读取一组目录分页，保留 Cookie 与权限上下文。"""
        paths = [
            f'/api/wiki/spaces/{space_id}/page-tree-v2?scene=simple&only_fetch=child&pi={index}'
            for index in page_indexes
        ]
        results = self.page.evaluate("""async ({paths}) => Promise.all(paths.map(async path => {
            const response = await fetch(path, { credentials: 'same-origin' });
            if (!response.ok) throw new Error(`PingCode 页面目录 HTTP ${response.status}`);
            return response.json();
        }))""", {"paths": paths})
        if not isinstance(results, list) or len(results) != len(page_indexes):
            raise RuntimeError('页面树分页响应数量不完整')
        pages = [self._page_tree_data(result) for result in results]
        for result, page, expected in zip(results, pages, page_indexes):
            data = result.get('data', {}) if isinstance(result, dict) else {}
            pagination = data.get('meta', {}).get('pagination', {}) if isinstance(data, dict) else {}
            reported_index = data.get('page_index', pagination.get('page_index')) if isinstance(data, dict) else None
            if reported_index is not None and int(reported_index) != expected:
                raise RuntimeError('页面树分页序号与请求不一致')
            if reported_index is None:
                page['page_index'] = expected
        return pages

    def get_complete_page_tree(
        self,
        space_id: str,
        progress_callback: Callable[[int, int, int, int], None] | None = None,
    ) -> dict:
        """获取完整空间目录，并按页面 ID 去重。"""
        root_page = self.get_page_tree_root(space_id)
        reported_total = root_page['count']
        page_count = root_page['page_count']
        pages_by_id = {
            item['_id']: item for item in root_page['value'] if item.get('_id')
        }

        for offset in range(0, page_count, PAGE_TREE_FETCH_CONCURRENCY):
            indexes = list(range(offset, min(offset + PAGE_TREE_FETCH_CONCURRENCY, page_count)))
            child_pages = self.get_page_tree_children_batch(space_id, indexes)
            for page_index, child_page in zip(indexes, child_pages):
                if child_page['count'] != reported_total or child_page['page_count'] not in (0, page_count):
                    raise RuntimeError(
                        '目录同步期间页面总数或分页数发生变化：'
                        f'{reported_total}/{page_count} -> {child_page["count"]}/{child_page["page_count"]}'
                    )
                for item in child_page['value']:
                    if item.get('_id'):
                        pages_by_id[item['_id']] = item
                if progress_callback:
                    progress_callback(
                        page_index + 1, page_count, len(pages_by_id), reported_total
                    )
        return {
            'value': list(pages_by_id.values()),
            'count': reported_total,
            'page_count': page_count,
            'complete': len(pages_by_id) == reported_total,
        }
    
    def get_page(self, page_id: str) -> dict:
        """获取页面详情"""
        return self._api_request(f'/api/wiki/pages/{page_id}')

    def get_product(self, product_code: str) -> dict:
        return self._api_request(f'/api/ship/products/{product_code}?addons=true&members=true')

    def get_baseline(self, product_id: str, baseline_id: str) -> dict:
        return self._api_request(f'/api/ship/products/{product_id}/baseline/snapshots/{baseline_id}')

    def get_baseline_suites(self, product_id: str, baseline_id: str) -> dict:
        return self._api_request(f'/api/ship/products/{product_id}/baseline/snapshots/{baseline_id}/partial-suites')

    def get_baseline_ideas(self, product_id: str, baseline_id: str, page_index: int, page_size: int = 50, *, suite_id: str = '') -> dict:
        path = f'/api/ship/products/{product_id}/baseline/snapshots/{baseline_id}/content?pi={page_index}&ps={page_size}'
        payload = {
            'pi': page_index, 'ps': page_size,
            'criteria': {'conditions': [], 'search': {'scopes': ['identifier', 'title']}, 'mode': 1, 'sorts': None},
            'scope': {'group_by': '', 'suite_id': suite_id, 'suite_children': 1},
        }
        result = self.page.evaluate("""async ({path, payload}) => {
            const response = await fetch(path, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
            if (!response.ok) throw new Error(`PingCode API HTTP ${response.status}`);
            return response.json();
        }""", {'path': path, 'payload': payload})
        return result

    def get_baseline_ideas_pages(
        self, product_id: str, baseline_id: str, page_count: int, *, suite_id: str = '', concurrency: int = 6,
    ) -> list[dict]:
        if not 0 <= page_count <= 100 or not 1 <= concurrency <= 20:
            raise ValueError('基线分页批次无效')
        page_indexes = list(range(1, page_count))
        if not page_indexes:
            return []
        return self.page.evaluate("""async ({productId, baselineId, pageIndexes, suiteId, concurrency}) => {
            const results = new Array(pageIndexes.length);
            let next = 0;
            async function worker() {
                while (true) {
                    const slot = next++;
                    if (slot >= pageIndexes.length) return;
                    const pi = pageIndexes[slot];
                    const path = `/api/ship/products/${encodeURIComponent(productId)}`
                        + `/baseline/snapshots/${encodeURIComponent(baselineId)}/content?pi=${pi}&ps=50`;
                    const payload = { pi, ps: 50,
                        criteria: { conditions: [], search: { scopes: ['identifier', 'title'] }, mode: 1, sorts: null },
                        scope: { group_by: '', suite_id: suiteId, suite_children: 1 } };
                    const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload) });
                    if (!response.ok) throw new Error(`PingCode 基线分页 HTTP ${response.status}`);
                    results[slot] = await response.json();
                }
            }
            await Promise.all(Array.from({ length: Math.min(concurrency, pageIndexes.length) }, worker));
            return results;
        }""", { 'productId': product_id, 'baselineId': baseline_id, 'pageIndexes': page_indexes,
            'suiteId': suite_id, 'concurrency': concurrency })

    def get_idea_work_items(self, idea_id: str, version_id: str) -> dict:
        query = urlencode({
            'principal_id': idea_id,
            'principal_name': 'idea',
            'target_name': 'work_item',
            'version_id': version_id,
        })
        return self._api_request(f'/api/ladon/relation/related-items?{query}')

    def get_idea_work_items_batch(self, ideas: list[tuple[str, str]], concurrency: int = 10) -> list[dict]:
        if (len(ideas) > MAX_TASK_SOURCE_RELATIONS or not 1 <= concurrency <= MAX_BROWSER_FETCH_CONCURRENCY
                or any(not isinstance(idea_id, str) or not idea_id
                       or not isinstance(version_id, str) or not version_id
                       for idea_id, version_id in ideas)):
            raise ValueError('需求关联批次无效')
        return self.page.evaluate("""async ({ideas, concurrency}) => {
            const results = new Array(ideas.length);
            let next = 0;
            async function worker() {
                while (true) {
                    const index = next++;
                    if (index >= ideas.length) return;
                    const [ideaId, versionId] = ideas[index];
                    const query = new URLSearchParams({
                        principal_id: ideaId, principal_name: 'idea',
                        target_name: 'work_item', version_id: versionId,
                    });
                    const response = await fetch(`/api/ladon/relation/related-items?${query}`);
                    if (!response.ok) throw new Error(`PingCode 需求关联 HTTP ${response.status}`);
                    results[index] = await response.json();
                }
            }
            await Promise.all(Array.from({length: Math.min(concurrency, ideas.length)}, worker));
            return results;
        }""", {'ideas': ideas, 'concurrency': concurrency})

    def get_agile_project(self, project_code: str) -> dict:
        return self._api_request(f'/api/agile/projects/{project_code}?addons=true&members=true')

    def get_defect_view(self, project_id: str, addon_id: str, view_id: str) -> dict:
        return self._api_request(
            f'/api/agile/projects/{project_id}/addons/{addon_id}/visible/views/{view_id}'
        )

    def get_defect_view_content(
        self, project_id: str, view_id: str, addon_id: str,
        criteria: dict, columns: list[str], page_index: int, page_size: int = 50,
    ) -> dict:
        path = f'/api/agile/projects/{project_id}/defect/views/{view_id}/content'
        payload = {
            'addon_setting_id': addon_id,
            'criteria': criteria,
            'columns': columns,
            'is_brief': 1,
            'pi': page_index,
            'ps': page_size,
        }
        return self.page.evaluate("""async ({path, payload}) => {
            const response = await fetch(path, {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payload),
            });
            if (!response.ok) throw new Error(`PingCode API HTTP ${response.status}`);
            return response.json();
        }""", {'path': path, 'payload': payload})

    def get_work_item(self, short_id: str) -> dict:
        return self._api_request(f'/api/agile/work-items/{short_id}')

    def get_work_items(self, short_ids: list[str], concurrency: int = 10) -> list[dict]:
        if len(short_ids) > MAX_WORK_ITEM_DETAILS_PER_PAGE or any(not isinstance(value, str)
                                      or not re.fullmatch(r'[A-Za-z0-9_-]{1,128}', value)
                                      for value in short_ids) or not 1 <= concurrency <= MAX_BROWSER_FETCH_CONCURRENCY:
            raise ValueError('工作项详情批次无效')
        if not short_ids:
            return []
        return self.page.evaluate("""async ({shortIds, concurrency}) => {
            const values = new Array(shortIds.length);
            let next = 0;
            async function worker() {
                while (true) {
                    const index = next++;
                    if (index >= shortIds.length) return;
                    const shortId = shortIds[index];
                    const response = await fetch(`/api/agile/work-items/${encodeURIComponent(shortId)}`);
                    if (!response.ok) throw new Error(`PingCode 工作项详情 HTTP ${response.status}`);
                    const result = await response.json();
                    values[index] = result?.data?.value;
                }
            }
            await Promise.all(Array.from({length: Math.min(concurrency, shortIds.length)}, worker));
            return values;
        }""", {'shortIds': short_ids, 'concurrency': concurrency})

    def get_attachments(self, page_id: str) -> list[dict]:
        """获取页面附件列表"""
        result = self._api_request(f'/api/wiki/pages/{page_id}/attachments')
        data = result.get('data', {})
        return data.get('value', []) if isinstance(data, dict) else (data if isinstance(data, list) else [])
    
    def download_attachment(self, attachment: dict) -> bytes:
        """下载附件文件"""
        token = attachment.get('token', '')
        if not token:
            raise ValueError("附件缺少 token")
        
        download_url = f'{self.base_url}/atlas/file/download-url?action=download&token={token}'
        
        response = self.page.request.get(download_url)
        if not response.ok:
            raise RuntimeError(f"下载失败：HTTP {response.status}")
        return response.body()

    def get_public_image_token(self, refresh: bool = False) -> str:
        """获取页面公共图片使用的短期访问令牌。"""
        if (
            not refresh
            and self._public_image_token
            and time.monotonic() - self._public_image_token_at < 45 * 60
        ):
            return self._public_image_token

        result = self._api_request('/api/typhon/secret/file/public-image-token')
        token = result.get('data', {}).get('value', '')
        if not token:
            raise RuntimeError('公共图片令牌接口未返回 token')
        self._public_image_token = token
        self._public_image_token_at = time.monotonic()
        return token

    def download_public_image(self, image: dict, max_bytes: int | None = None, timeout_ms: int = 15000) -> tuple[bytes, str]:
        """下载 Slate 图片节点引用的原图。"""
        source_url = image.get('originUrl') or image.get('thumbUrl') or image.get('url')
        if not source_url:
            raise ValueError('图片节点缺少 originUrl、thumbUrl 或 url')

        parsed = urlparse(source_url)
        base = urlparse(self.base_url)
        if parsed.scheme not in {'http', 'https'} or parsed.netloc != base.netloc:
            raise ValueError('图片地址不属于当前 PingCode 服务')
        if not parsed.path.startswith('/atlas/files/public/'):
            raise ValueError('图片地址不是 PingCode 公共图片资源')

        for attempt in range(2):
            query = dict(parse_qsl(parsed.query, keep_blank_values=True))
            query['token'] = self.get_public_image_token(refresh=attempt > 0)
            download_url = urlunparse(parsed._replace(query=urlencode(query)))
            visited = set()
            for _hop in range(4):
                if download_url in visited:
                    raise ValueError('图片跳转形成循环')
                visited.add(download_url)
                response = self.page.request.get(download_url, timeout=timeout_ms, max_redirects=0)
                if response.status not in {301, 302, 303, 307, 308}:
                    break
                location = response.headers.get('location')
                if not location:
                    raise ValueError('图片跳转缺少目标')
                download_url = urljoin(download_url, location)
                redirected = urlparse(download_url)
                if (redirected.scheme != base.scheme or redirected.netloc != base.netloc
                        or redirected.username or redirected.password
                        or not redirected.path.startswith(('/atlas/files/public/', '/pc-public/'))):
                    raise ValueError('图片跳转超出 PingCode 图片范围')
            else:
                raise ValueError('图片跳转次数超过限制')
            content_type = response.headers.get('content-type', '').split(';', 1)[0].lower()
            if max_bytes is not None and int(response.headers.get('content-length', '0') or 0) > max_bytes:
                raise ValueError('图片超过允许的大小')
            data = response.body()
            if max_bytes is not None and len(data) > max_bytes:
                raise ValueError('图片超过允许的大小')
            detected_type = self._detect_image_content_type(data)
            if response.ok and data and (content_type.startswith('image/') or detected_type):
                return data, detected_type or content_type

        if not response.ok:
            raise RuntimeError(f"图片下载失败：HTTP {response.status}")
        if not content_type.startswith('image/') and not self._detect_image_content_type(data):
            raise RuntimeError(f"图片下载返回了非图片内容：{content_type or 'unknown'}")
        raise RuntimeError('图片下载结果为空')

    @staticmethod
    def _detect_image_content_type(data: bytes) -> str:
        signatures = (
            (b'\x89PNG\r\n\x1a\n', 'image/png'),
            (b'\xff\xd8\xff', 'image/jpeg'),
            (b'GIF87a', 'image/gif'),
            (b'GIF89a', 'image/gif'),
            (b'BM', 'image/bmp'),
            (b'II*\x00', 'image/tiff'),
            (b'MM\x00*', 'image/tiff'),
        )
        for signature, content_type in signatures:
            if data.startswith(signature):
                return content_type
        if len(data) >= 12 and data.startswith(b'RIFF') and data[8:12] == b'WEBP':
            return 'image/webp'
        return ''
    
    def _api_request(self, path: str) -> dict:
        """发送 API 请求（通过浏览器上下文）"""
        url = f'{self.base_url}{path}'
        
        result = self.page.evaluate(f"""
            async () => {{
                const resp = await fetch('{url}');
                if (!resp.ok) return {{ error: resp.status, text: (await resp.text()).substring(0, 200) }};
                return await resp.json();
            }}
        """)
        
        if result.get('error'):
            raise RuntimeError(f"API 请求失败：{path} - HTTP {result['error']}")
        
        return result

    @staticmethod
    def _page_tree_data(result: dict) -> dict:
        data = result.get('data', {})
        if not isinstance(data, dict):
            raise RuntimeError('页面树接口返回格式无效')
        value = data.get('value', [])
        if not isinstance(value, list):
            raise RuntimeError('页面树接口 value 不是列表')
        pagination = data.get('meta', {}).get('pagination', {})
        return {
            'value': value,
            'count': int(data.get('count', pagination.get('count', len(value))) or 0),
            'page_index': int(data.get('page_index', pagination.get('page_index', 0)) or 0),
            'page_size': int(data.get('page_size', pagination.get('page_size', 0)) or 0),
            'page_count': int(data.get('page_count', pagination.get('page_count', 0)) or 0),
        }
