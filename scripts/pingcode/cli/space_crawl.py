#!/usr/bin/env python3
"""
空间级爬取 CLI

用法：
  python3 scripts/pingcode/cli/space_crawl.py --space YASSTORAGE
  python3 scripts/pingcode/cli/space_crawl.py --space YASDOC --keyword "存储"
  python3 scripts/pingcode/cli/space_crawl.py --space YASSTORAGE --file-types docx,pptx
  python3 scripts/pingcode/cli/space_crawl.py --space YASSTORAGE --index-only
  python3 scripts/pingcode/cli/space_crawl.py --space YASSTORAGE --workers 10
"""

import sys
import json
import time
import logging
from pathlib import Path
from typing import Optional

# 添加项目根目录到路径
SCRIPT_DIR = Path(__file__).parent
PINGCODE_DIR = SCRIPT_DIR.parent
SCRIPTS_DIR = PINGCODE_DIR.parent
PROJECT_ROOT = SCRIPTS_DIR.parent

sys.path.insert(0, str(SCRIPTS_DIR))

from pingcode.core.config import PingCodeConfig
from pingcode.core.space_crawler import SpaceCrawler
from pingcode.core.index_builder import IndexBuilder


def setup_logging(verbose: bool = False):
    """配置日志"""
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format='%(asctime)s [%(levelname)s] %(message)s',
        datefmt='%H:%M:%S'
    )
    return logging.getLogger('space_crawl')


def format_bytes(size: int) -> str:
    """格式化文件大小"""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size < 1024:
            return f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} TB"


def print_banner():
    """打印欢迎横幅"""
    print("=" * 60)
    print("  PingCode 空间级素材下载工具")
    print("=" * 60)


def print_config_summary(args, config, strategy, output_dir):
    """打印配置摘要"""
    print("\n📋 配置摘要")
    print("-" * 60)
    print(f"  空间：{args.space}")
    print(f"  账号：{config.email}")
    print(f"  输出：{output_dir}")
    
    if args.keyword:
        print(f"  关键词：{args.keyword}")
    if args.file_types:
        print(f"  文件类型：{args.file_types}")
    if args.index_only:
        print(f"  模式：仅生成索引")
    
    print(f"  并发数：{strategy.get('max_workers', 5)}")
    print(f"  最大页面：{strategy.get('max_pages', 1000)}")
    print("-" * 60)


def print_progress(current: int, total: int, prefix: str = "进度"):
    """打印进度"""
    percentage = (current / total * 100) if total > 0 else 0
    bar_length = 30
    filled = int(bar_length * current / total) if total > 0 else 0
    bar = '█' * filled + '░' * (bar_length - filled)
    print(f"\r  {prefix}: [{bar}] {current}/{total} ({percentage:.1f}%)", end='', flush=True)


def print_result_summary(result, elapsed: float, output_dir: Path):
    """打印结果摘要"""
    print("\n" + "=" * 60)
    print("  ✅ 爬取完成")
    print("=" * 60)
    print(f"  📄 页面：{len(result.pages)} 个")
    print(f"  📎 附件：{result.total_attachments} 个")
    print(f"  ⏱️  耗时：{elapsed:.1f} 秒")
    print(f"  📁 输出：{output_dir}")
    
    # 统计文件大小
    total_size = 0
    files_dir = output_dir / 'files'
    if files_dir.exists():
        total_size = sum(f.stat().st_size for f in files_dir.rglob('*') if f.is_file())
    print(f"  💾 总大小：{format_bytes(total_size)}")
    print("=" * 60)


def main():
    import argparse
    parser = argparse.ArgumentParser(
        description='PingCode 空间级素材下载工具',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例：
  # 批量下载整个空间
  python3 scripts/pingcode/cli/space_crawl.py --space YASSTORAGE

  # 按关键词筛选
  python3 scripts/pingcode/cli/space_crawl.py --space YASDOC --keyword "存储引擎"

  # 只下载特定文件类型
  python3 scripts/pingcode/cli/space_crawl.py --space YASSTORAGE --file-types docx,pptx

  # 只生成索引（不下载文件）
  python3 scripts/pingcode/cli/space_crawl.py --space YASSTORAGE --index-only

  # 自定义并发数
  python3 scripts/pingcode/cli/space_crawl.py --space YASSTORAGE --workers 10

  # 详细日志模式
  python3 scripts/pingcode/cli/space_crawl.py --space YASSTORAGE --verbose
        """
    )
    
    parser.add_argument('--space', required=True, help='空间 Key（如 YASSTORAGE、YASDOC）')
    parser.add_argument('--keyword', help='关键词过滤（页面名称包含）')
    parser.add_argument('--file-types', help='文件类型过滤（逗号分隔，如 docx,pptx,pdf）')
    parser.add_argument('--index-only', action='store_true', help='只生成索引，不下载文件')
    parser.add_argument('--merge-existing', help='整合已有数据目录')
    parser.add_argument('--output', help='输出目录（默认 scripts/pingcode/data）')
    parser.add_argument('--workers', type=int, help='并发线程数（默认 5）')
    parser.add_argument('--max-pages', type=int, help='最大页面数（默认 1000）')
    parser.add_argument('--verbose', '-v', action='store_true', help='详细日志模式')
    parser.add_argument('--no-skip-empty', action='store_true', help='不跳过空页面')
    
    args = parser.parse_args()
    
    # 配置日志
    logger = setup_logging(args.verbose)
    
    print_banner()
    
    # 加载配置
    logger.info("加载配置...")
    config = PingCodeConfig()
    if not config.validate():
        logger.error("配置验证失败，请检查 config/pingcode.json")
        sys.exit(1)
    
    # 构建策略
    strategy = config.download_strategy.copy()
    
    if args.index_only:
        strategy['download_attachments'] = False
        strategy['download_pages'] = False
        logger.info("模式：仅生成索引")
    
    if args.keyword:
        strategy['keyword_filter'] = args.keyword
        logger.info(f"关键词过滤：{args.keyword}")
    
    if args.file_types:
        strategy['file_types'] = [t.strip() for t in args.file_types.split(',')]
        logger.info(f"文件类型过滤：{strategy['file_types']}")
    
    if args.workers:
        strategy['max_workers'] = args.workers
        logger.info(f"并发数：{args.workers}")
    
    if args.max_pages:
        strategy['max_pages'] = args.max_pages
        logger.info(f"最大页面数：{args.max_pages}")
    
    if args.no_skip_empty:
        strategy['skip_empty'] = False
        logger.info("不跳过空页面")
    
    # 输出目录
    if args.output:
        output_dir = Path(args.output)
    else:
        output_dir = PINGCODE_DIR / 'data'
    
    print_config_summary(args, config, strategy, output_dir)
    
    # 运行爬虫
    start_time = time.time()
    
    try:
        crawler = SpaceCrawler(config, output_dir, strategy)
        result = crawler.crawl_space(args.space)
        
        # 生成索引
        logger.info("生成索引...")
        
        # 从结果中获取空间名称
        space_name = args.space
        if result.pages:
            # 尝试从 API 获取空间名称（简化处理）
            space_name = args.space
        
        index_builder = IndexBuilder(
            space_key=args.space,
            space_name=space_name,
            tree=result.tree,
            pages=result.pages
        )
        
        space_dir = output_dir / args.space
        index_builder.save_json(space_dir / 'index.json')
        index_builder.save_markdown(space_dir / 'index.md')
        
        # 整合已有数据
        if args.merge_existing:
            logger.info(f"整合已有数据：{args.merge_existing}")
            index_builder.merge_existing_files(
                Path(args.merge_existing),
                space_dir / 'files'
            )
        
        crawler.close()
        
        elapsed = time.time() - start_time
        print_result_summary(result, elapsed, space_dir)
        
    except KeyboardInterrupt:
        logger.warning("\n用户中断")
        sys.exit(130)
    except Exception as e:
        logger.error(f"爬取失败：{e}")
        if args.verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
