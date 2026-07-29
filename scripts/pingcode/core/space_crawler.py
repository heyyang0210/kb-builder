"""
空间级爬虫

核心编排模块，负责：
- 获取空间所有页面
- 构建目录树
- 遍历页面下载内容和附件
- 生成索引
"""

import time
import json
from pathlib import Path
from typing import Optional
from concurrent.futures import ThreadPoolExecutor, as_completed

from .config import PingCodeConfig
from .client import PingCodeClient
from .api_client import PingCodeAPIClient
from .tree_builder import TreeBuilder, TreeNode
from .content_parser import ContentParser
from .downloader import PingCodeDownloader
from .filename_utils import FilenameUtils
from .attachment_policy import AttachmentPolicy


class CrawlResult:
    """爬取结果"""
    def __init__(self, space_key: str, tree: list[TreeNode], pages: list[dict]):
        self.space_key = space_key
        self.tree = tree
        self.pages = pages
        self.total_attachments = sum(p.get('attachment_count', 0) for p in pages)
    
    def to_dict(self) -> dict:
        return {
            'space_key': self.space_key,
            'total_pages': len(self.pages),
            'total_attachments': self.total_attachments,
            'tree': [t.to_dict() for t in self.tree],
            'pages': self.pages
        }


class SpaceCrawler:
    """空间级爬虫"""
    
    def __init__(self, config: PingCodeConfig, output_dir: Path, strategy: Optional[dict] = None):
        self.config = config
        self.output_dir = output_dir
        self.strategy = strategy or config.download_strategy
        self.client = None
        self.api = None
        self.tree_builder = TreeBuilder()
        self.content_parser = ContentParser()
        self.downloader = None
    
    def crawl_space(self, space_key: str) -> CrawlResult:
        """爬取整个空间"""
        print(f"\n{'='*60}")
        print(f"开始爬取空间：{space_key}")
        print(f"{'='*60}")
        
        # 1. 登录
        self._login()
        
        # 2. 获取空间信息
        print("\n[1] 获取空间信息...")
        space = self.api.get_space(space_key)
        space_name = space.get('data', {}).get('value', {}).get('name', space_key)
        print(f"  ✓ 空间名称：{space_name}")
        
        # 3. 获取所有页面
        print("\n[2] 获取页面列表...")
        space_value = space.get('data', {}).get('value', {})
        complete_tree = self.api.get_complete_page_tree(space_value['_id'])
        pages = complete_tree['value']
        print(f"  ✓ 页面数量：{len(pages)}")
        
        # 4. 过滤页面
        pages = self._filter_pages(pages)
        print(f"  ✓ 过滤后：{len(pages)} 页面")
        
        # 5. 构建目录树
        print("\n[3] 构建目录树...")
        roots = self.tree_builder.build(pages)
        print(f"  ✓ 根节点数：{len(roots)}")
        
        # 6. 创建输出目录
        space_dir = self.output_dir / space_key
        pages_dir = space_dir / 'pages'
        files_dir = space_dir / 'files'
        pages_dir.mkdir(parents=True, exist_ok=True)
        files_dir.mkdir(parents=True, exist_ok=True)
        
        # 7. 爬取页面内容和附件
        print("\n[4] 爬取页面内容和附件...")
        results = self._crawl_pages(pages, pages_dir, files_dir)
        
        # 8. 生成结果
        result = CrawlResult(space_key, roots, results)
        
        print(f"\n{'='*60}")
        print(f"爬取完成：{space_key}")
        print(f"  页面：{len(results)} 个")
        print(f"  附件：{result.total_attachments} 个")
        print(f"{'='*60}")
        
        return result
    
    def _login(self):
        """登录并初始化 API 客户端"""
        if self.client is None:
            self.client = PingCodeClient(self.config, headless=True)
            page = self.client.start()
            self.api = PingCodeAPIClient(page, self.config.base_url)
            self.downloader = PingCodeDownloader(page, self.output_dir)
    
    def _filter_pages(self, pages: list[dict]) -> list[dict]:
        """过滤页面"""
        filtered = []
        
        for page in pages:
            # 跳过已删除
            if self.strategy.get('skip_deleted', True) and page.get('is_deleted', 0) == 1:
                continue
            
            # 跳过草稿
            if self.strategy.get('skip_draft', True) and page.get('is_published', 0) == 0:
                continue
            
            # 关键词过滤
            keyword = self.strategy.get('keyword_filter')
            if keyword and keyword.lower() not in page.get('name', '').lower():
                continue
            
            # 跳过空页面
            if self.strategy.get('skip_empty', True):
                has_content = page.get('word_count', 0) > 0
                has_attachments = page.get('attachment_count', 0) > 0
                if not has_content and not has_attachments:
                    continue
            
            filtered.append(page)
        
        return filtered
    
    def _crawl_pages(self, pages: list[dict], pages_dir: Path, files_dir: Path) -> list[dict]:
        """爬取页面（多线程）"""
        results = []
        max_workers = self.strategy.get('max_workers', 5)
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {
                executor.submit(self._crawl_single_page, page, pages_dir, files_dir): page
                for page in pages
            }
            
            for i, future in enumerate(as_completed(futures), 1):
                page = futures[future]
                try:
                    result = future.result()
                    results.append(result)
                    if i % 10 == 0:
                        print(f"  进度：{i}/{len(pages)}")
                except Exception as e:
                    print(f"  ✗ 页面失败：{page.get('name', '')} - {e}")
        
        return results
    
    def _crawl_single_page(self, page: dict, pages_dir: Path, files_dir: Path) -> dict:
        """爬取单个页面"""
        page_id = page['_id']
        page_name = page.get('name', '未知')
        
        result = {
            'id': page_id,
            'name': page_name,
            'identifier': page.get('identifier', ''),
            'attachment_count': page.get('attachment_count', 0),
            'word_count': page.get('word_count', 0),
            'updated_at': page.get('updated_at', ''),
            'attachments': [],
            'content_path': None
        }
        
        # 1. 下载附件
        if self.strategy.get('download_attachments', True) and page.get('attachment_count', 0) > 0:
            try:
                attachments = self.api.get_attachments(page_id)
                for att in attachments:
                    att_result = self._download_attachment(att, page_name, files_dir)
                    if att_result:
                        result['attachments'].append(att_result)
            except Exception as e:
                print(f"    ✗ 附件下载失败：{e}")
        
        # 2. 保存页面内容
        if self.strategy.get('download_pages', True):
            try:
                detail = self.api.get_page(page_id)
                document = detail.get('data', {}).get('value', {}).get('document', {})
                
                if document:
                    markdown = self.content_parser.parse_document(document)
                    if markdown:
                        content_path = self._save_page_content(page_name, markdown, pages_dir)
                        result['content_path'] = str(content_path)
            except Exception as e:
                print(f"    ✗ 内容保存失败：{e}")
        
        return result
    
    def _download_attachment(self, attachment: dict, page_name: str, files_dir: Path) -> Optional[dict]:
        """下载单个附件"""
        title = attachment.get('title', '')
        if not title:
            return None
        requested_types = {
            item.lower().lstrip('.') for item in self.strategy.get('file_types', [])
        }
        if not AttachmentPolicy.should_download(title, requested_types):
            return None
        
        # 构建文件路径
        filepath = FilenameUtils.build_filepath(files_dir, page_name, title)
        
        # 检查是否已存在
        if filepath.exists():
            return {
                'title': title,
                'size': filepath.stat().st_size,
                'local_path': str(filepath.relative_to(self.output_dir))
            }
        
        # 下载
        try:
            data = self.api.download_attachment(attachment)
            filepath.parent.mkdir(parents=True, exist_ok=True)
            filepath.write_bytes(data)
            
            return {
                'title': title,
                'size': len(data),
                'local_path': str(filepath.relative_to(self.output_dir))
            }
        except Exception as e:
            print(f"      ✗ 下载失败：{title} - {e}")
            return None
    
    def _save_page_content(self, page_name: str, content: str, pages_dir: Path) -> Path:
        """保存页面内容为 Markdown"""
        safe_name = FilenameUtils.sanitize(page_name)
        safe_name = FilenameUtils.truncate(safe_name, 150)
        
        filepath = pages_dir / f"{safe_name}.md"
        filepath = FilenameUtils.unique_filename(filepath)
        
        filepath.parent.mkdir(parents=True, exist_ok=True)
        filepath.write_text(content, encoding='utf-8')
        
        return filepath
    
    def close(self):
        """关闭爬虫"""
        if self.client:
            self.client.close()
            self.client = None
