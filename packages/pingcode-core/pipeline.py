"""
爬取流水线编排模块

将登录、爬取、下载串联为完整流水线，支持：
- 页面内容爬取 + 附件下载
- 多目标页面批量处理
- 爬取策略配置
"""

import time
from pathlib import Path
from typing import List, Dict
from .config import PingCodeConfig
from .client import PingCodeClient
from .crawler import PingCodeCrawler
from .downloader import PingCodeDownloader

class PingCodePipeline:
    """PingCode 爬取流水线"""
    
    def __init__(self, config: PingCodeConfig, output_dir: Path, headless: bool = True):
        self.config = config
        self.output_dir = output_dir
        self.headless = headless
        self.client = None
        self.crawler = None
        self.downloader = None
    
    def start(self):
        """启动流水线"""
        self.client = PingCodeClient(self.config, headless=self.headless)
        page = self.client.start()
        self.crawler = PingCodeCrawler(page, self.output_dir / 'pages')
        self.downloader = PingCodeDownloader(page, self.output_dir / 'files')
    
    def run_target(self, target: Dict) -> Dict:
        """处理单个目标页面"""
        name = target['name']
        url = target['url']
        
        print(f"\n{'='*60}")
        print(f"处理目标：{name}")
        print(f"URL: {url}")
        print(f"{'='*60}")
        
        result = {
            'name': name,
            'url': url,
            'pages': [],
            'files': [],
            'started_at': time.strftime('%Y-%m-%d %H:%M:%S')
        }
        
        # 1. 爬取页面内容
        print("\n[1] 爬取页面内容...")
        page_data = self.crawler.extract_text(url, title=name)
        md_path = self.crawler.save_as_markdown(page_data, f"{name}.md")
        result['pages'].append(str(md_path))
        
        # 2. 下载附件
        print("\n[2] 下载附件...")
        files = self.downloader.download_from_page(url)
        result['files'] = [str(f) for f in files]
        
        result['completed_at'] = time.strftime('%Y-%m-%d %H:%M:%S')
        return result
    
    def run_all(self) -> List[Dict]:
        """处理所有目标页面"""
        # 注意：如果 client 已经启动（如在测试中），直接复用
        if self.client is None:
            self.start()
        
        results = []
        for target in self.config.targets:
            result = self.run_target(target)
            results.append(result)
        
        return results
    
    def close(self):
        """关闭流水线"""
        if self.client:
            self.client.close()
            self.client = None
    
    def __enter__(self):
        self.start()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
