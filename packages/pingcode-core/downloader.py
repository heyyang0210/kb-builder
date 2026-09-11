"""
文件下载模块

支持：
- 单文件下载
- 批量下载
- 文件名解码（URL 编码 → 中文）
- 下载进度显示
"""

import re
import time
from pathlib import Path
from typing import List, Dict, Optional
from playwright.sync_api import Page
from urllib.parse import unquote

class PingCodeDownloader:
    """PingCode 文件下载器"""
    
    def __init__(self, page: Page, output_dir: Path):
        self.page = page
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.downloaded = []
        self.failed = []
    
    def download_file(self, url: str, filename: Optional[str] = None) -> Optional[Path]:
        """下载单个文件"""
        try:
            # 使用 page 上下文下载（保持登录状态）
            response = self.page.evaluate("""
                async (url) => {
                    const resp = await fetch(url);
                    if (!resp.ok) return { error: resp.status };
                    const blob = await resp.blob();
                    const buffer = await blob.arrayBuffer();
                    return {
                        ok: true,
                        data: Array.from(new Uint8Array(buffer)),
                        contentType: resp.headers.get('content-type'),
                        contentDisposition: resp.headers.get('content-disposition')
                    };
                }
            """, url)
            
            if response.get('error'):
                self.failed.append({'url': url, 'error': f"HTTP {response['error']}"})
                return None
            
            # 确定文件名
            if not filename:
                filename = self._extract_filename(response.get('contentDisposition', ''), url)
            
            # 保存文件
            filepath = self.output_dir / filename
            with open(filepath, 'wb') as f:
                f.write(bytes(response['data']))
            
            self.downloaded.append(str(filepath))
            return filepath
        
        except Exception as e:
            self.failed.append({'url': url, 'error': str(e)})
            return None
    
    def download_batch(self, urls: List[str]) -> List[Path]:
        """批量下载文件"""
        results = []
        total = len(urls)
        
        for idx, url in enumerate(urls, 1):
            print(f"  [{idx}/{total}] 下载...")
            filepath = self.download_file(url)
            if filepath:
                file_size = filepath.stat().st_size
                print(f"    ✓ {filepath.name} ({file_size} bytes)")
                results.append(filepath)
            else:
                print(f"    ✗ 失败")
        
        return results
    
    def download_from_page(self, url: str) -> List[Path]:
        """从页面提取附件并下载"""
        # 提取附件链接
        self.page.goto(url, wait_until='domcontentloaded', timeout=30000)
        self.page.wait_for_timeout(5000)
        
        links = self.page.query_selector_all('a[href*="download"]')
        urls = []
        
        for link in links:
            href = link.get_attribute('href') or ''
            if 'atlas/file/download-url' in href:
                urls.append(href)
        
        print(f"  找到 {len(urls)} 个附件")
        return self.download_batch(urls)
    
    def _extract_filename(self, content_disposition: str, url: str) -> str:
        """从响应头或 URL 提取文件名"""
        # 从 Content-Disposition 提取
        if content_disposition:
            match = re.search(r'filename[^;=\n]*=(([\'"]).*?\2|[^;\n]*)', content_disposition)
            if match:
                filename = match.group(1).strip('\'"')
                return unquote(filename)
        
        # 从 URL 提取
        if 'token=' in url:
            return f"file_{int(time.time())}.bin"
        
        # 从 URL 路径提取
        path = url.split('/')[-1]
        return unquote(path) if path else f"file_{int(time.time())}.bin"
    
    def get_stats(self) -> Dict:
        """获取下载统计"""
        return {
            'downloaded': len(self.downloaded),
            'failed': len(self.failed),
            'total_size': sum(Path(f).stat().st_size for f in self.downloaded if Path(f).exists())
        }
