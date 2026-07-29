"""
PingCode API 客户端

通过浏览器 Cookie 鉴权，调用 PingCode REST API。
"""

import time
from typing import Callable
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from playwright.sync_api import Page


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

        for page_index in range(page_count):
            child_page = self.get_page_tree_children(space_id, page_index)
            if child_page['count'] != reported_total:
                raise RuntimeError(
                    '目录同步期间页面总数发生变化：'
                    f'{reported_total} -> {child_page["count"]}'
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
        
        result = self.page.evaluate(f"""
            async () => {{
                const resp = await fetch('{download_url}');
                if (!resp.ok) return {{ error: resp.status }};
                const blob = await resp.blob();
                const buffer = await blob.arrayBuffer();
                return {{
                    ok: true,
                    data: Array.from(new Uint8Array(buffer)),
                    contentType: resp.headers.get('content-type'),
                    contentDisposition: resp.headers.get('content-disposition')
                }};
            }}
        """)
        
        if result.get('error'):
            raise RuntimeError(f"下载失败：HTTP {result['error']}")
        
        return bytes(result['data'])

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

    def download_public_image(self, image: dict) -> tuple[bytes, str]:
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
            result = self.page.evaluate(
                """
                async (url) => {
                    const response = await fetch(url);
                    const buffer = await response.arrayBuffer();
                    return {
                        ok: response.ok,
                        status: response.status,
                        data: Array.from(new Uint8Array(buffer)),
                        contentType: response.headers.get('content-type') || ''
                    };
                }
                """,
                download_url,
            )
            content_type = result.get('contentType', '').split(';', 1)[0].lower()
            data = bytes(result.get('data', []))
            detected_type = self._detect_image_content_type(data)
            if result.get('ok') and data and (content_type.startswith('image/') or detected_type):
                return data, detected_type or content_type

        if not result.get('ok'):
            raise RuntimeError(f"图片下载失败：HTTP {result.get('status')}")
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
