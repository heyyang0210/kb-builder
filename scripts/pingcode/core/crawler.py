"""
页面内容爬取模块

支持：
- 页面文本内容提取
- 表格数据解析
- 附件链接提取
- 子页面递归爬取
"""

import re
import time
from pathlib import Path
from typing import List, Dict, Optional
from playwright.sync_api import Page

class PingCodeCrawler:
    """PingCode 页面爬虫"""
    
    def __init__(self, page: Page, output_dir: Path):
        self.page = page
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def extract_text(self, url: str, title: Optional[str] = None) -> Dict:
        """提取页面文本内容"""
        self.page.goto(url, wait_until='domcontentloaded', timeout=30000)
        self.page.wait_for_timeout(5000)
        
        # 获取标题
        if not title:
            title_elem = self.page.query_selector('h1') or self.page.query_selector('[class*="title"]')
            title = title_elem.inner_text().strip() if title_elem else self.page.title()
        
        # 提取内容（尝试多种选择器）
        content = self._extract_content()
        
        # 提取表格
        tables = self._extract_tables()
        
        return {
            'url': url,
            'title': title,
            'content': content,
            'tables': tables,
            'crawled_at': time.strftime('%Y-%m-%d %H:%M:%S')
        }
    
    def _extract_content(self) -> str:
        """提取页面正文内容"""
        selectors = [
            'article',
            '.wiki-content',
            '[class*="content"]',
            'main',
            '.page-content',
            '#wiki-content'
        ]
        
        for selector in selectors:
            elem = self.page.query_selector(selector)
            if elem:
                content = elem.inner_text().strip()
                if len(content) > 100:
                    return content
        
        return self.page.inner_text('body').strip()
    
    def _extract_tables(self) -> List[List[str]]:
        """提取页面表格"""
        tables = []
        table_elems = self.page.query_selector_all('table')
        
        for table in table_elems:
            rows = table.query_selector_all('tr')
            table_data = []
            for row in rows:
                cells = row.query_selector_all('td, th')
                row_data = [cell.inner_text().strip() for cell in cells]
                table_data.append(row_data)
            tables.append(table_data)
        
        return tables
    
    def extract_links(self, url: str) -> List[Dict]:
        """提取页面所有链接"""
        self.page.goto(url, wait_until='domcontentloaded', timeout=30000)
        self.page.wait_for_timeout(5000)
        
        links = self.page.query_selector_all('a[href]')
        result = []
        
        for link in links:
            href = link.get_attribute('href') or ''
            text = link.inner_text().strip()
            
            if href and not href.startswith('#') and not href.startswith('javascript:'):
                result.append({
                    'text': text,
                    'href': href,
                    'is_download': 'download' in href.lower() or 'file' in href.lower()
                })
        
        return result
    
    def extract_attachments(self, url: str) -> List[Dict]:
        """提取页面附件下载链接"""
        self.page.goto(url, wait_until='domcontentloaded', timeout=30000)
        self.page.wait_for_timeout(5000)
        
        links = self.page.query_selector_all('a[href*="download"]')
        attachments = []
        
        for link in links:
            href = link.get_attribute('href') or ''
            if 'atlas/file/download-url' in href:
                attachments.append({
                    'url': href,
                    'text': link.inner_text().strip()
                })
        
        return attachments
    
    def save_as_markdown(self, data: Dict, filename: Optional[str] = None) -> Path:
        """保存为 Markdown 文件"""
        if not filename:
            filename = re.sub(r'[^\w\-]', '_', data['title']) + '.md'
        
        filepath = self.output_dir / filename
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(f"# {data['title']}\n\n")
            f.write(f"来源：{data['url']}\n")
            f.write(f"爬取时间：{data['crawled_at']}\n\n")
            f.write("---\n\n")
            f.write(data['content'])
            
            if data['tables']:
                f.write("\n\n## 表格数据\n\n")
                for i, table in enumerate(data['tables'], 1):
                    f.write(f"### 表格 {i}\n\n")
                    for row in table:
                        f.write('| ' + ' | '.join(row) + ' |\n')
                    f.write('\n')
        
        return filepath
    
    def crawl_recursive(self, url: str, max_depth: int = 2, current_depth: int = 0) -> List[Path]:
        """递归爬取页面及其子页面"""
        if current_depth >= max_depth:
            return []
        
        data = self.extract_text(url)
        filepath = self.save_as_markdown(data)
        
        crawled = [filepath]
        
        # 提取子页面链接
        links = self.extract_links(url)
        for link in links:
            if link['href'].startswith('/wiki/') and not link['is_download']:
                sub_url = f"https://pingcode.yasdb.com{link['href']}"
                sub_files = self.crawl_recursive(sub_url, max_depth, current_depth + 1)
                crawled.extend(sub_files)
        
        return crawled
