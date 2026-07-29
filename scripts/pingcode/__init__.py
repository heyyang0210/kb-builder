"""
PingCode 知识库素材下载工具包

通用框架，支持：
- CAS 单点登录（持久化会话）
- 页面内容爬取
- 附件批量下载
- 可配置的爬取策略
- 空间级批量下载（API 方式）
"""

from .core.config import PingCodeConfig
from .core.client import PingCodeClient
from .core.api_client import PingCodeAPIClient
from .core.tree_builder import TreeBuilder, TreeNode
from .core.content_parser import ContentParser
from .core.filename_utils import FilenameUtils
from .core.space_crawler import SpaceCrawler, CrawlResult
from .core.index_builder import IndexBuilder
from .core.crawler import PingCodeCrawler
from .core.downloader import PingCodeDownloader
from .core.pipeline import PingCodePipeline

__version__ = '2.0.0'
__all__ = [
    'PingCodeConfig',
    'PingCodeClient',
    'PingCodeAPIClient',
    'TreeBuilder',
    'TreeNode',
    'ContentParser',
    'FilenameUtils',
    'SpaceCrawler',
    'CrawlResult',
    'IndexBuilder',
    'PingCodeCrawler',
    'PingCodeDownloader',
    'PingCodePipeline'
]
