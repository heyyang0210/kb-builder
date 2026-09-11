#!/usr/bin/env python3
"""
PingCode 爬虫 Demo 测试用例

验证内容：
1. 配置文件加载
2. CAS 登录流程
3. 页面内容提取
4. 附件链接提取
5. 文件下载
6. 完整流水线

运行方式：
  python3 tests/pingcode/demo_test.py
"""

import sys
import json
from pathlib import Path

# 添加项目根目录到路径（从 tests/ 向上三级到项目根）
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from config import PingCodeConfig
from client import PingCodeClient
from crawler import PingCodeCrawler
from downloader import PingCodeDownloader
from pipeline import PingCodePipeline

# 测试输出目录
TEST_OUTPUT = PROJECT_ROOT / 'refs' / 'pingcode' / '_test_output'


def test_config():
    """测试 1: 配置文件加载"""
    print("\n[Test 1] 配置文件加载")
    config = PingCodeConfig()
    data = config.load()
    
    assert 'base_url' in data, "缺少 base_url"
    assert 'credentials' in data, "缺少 credentials"
    assert 'targets' in data, "缺少 targets"
    assert config.email, "账号为空"
    assert config.password, "密码为空"
    assert len(config.targets) > 0, "没有目标页面"
    
    print(f"  ✓ base_url: {config.base_url}")
    print(f"  ✓ email: {config.email}")
    print(f"  ✓ targets: {len(config.targets)} 个")
    print("  ✓ 配置验证通过")
    return config


def test_login(config):
    """测试 2: CAS 登录"""
    print("\n[Test 2] CAS 登录")
    client = PingCodeClient(config, headless=True)
    page = client.start()
    
    assert page is not None, "页面未加载"
    assert 'login' not in page.url.lower() or 'wiki' in page.url.lower(), "登录失败"
    
    print(f"  ✓ 当前 URL: {page.url}")
    print(f"  ✓ 页面标题：{page.title()}")
    print("  ✓ 登录成功")
    return client


def test_crawl_page(client, config):
    """测试 3: 页面内容提取"""
    print("\n[Test 3] 页面内容提取")
    page = client._page
    crawler = PingCodeCrawler(page, TEST_OUTPUT / 'pages')
    
    target_url = config.targets[0]['url']
    data = crawler.extract_text(target_url, title="内幕文档")
    
    assert data['title'], "标题为空"
    assert len(data['content']) > 100, "内容过短"
    assert len(data['tables']) > 0, "未找到表格"
    
    print(f"  ✓ 标题：{data['title']}")
    print(f"  ✓ 内容长度：{len(data['content'])} 字符")
    print(f"  ✓ 表格数量：{len(data['tables'])}")
    print(f"  ✓ 表格行数：{len(data['tables'][0])}")
    
    # 保存为 Markdown
    md_path = crawler.save_as_markdown(data, "内幕文档.md")
    assert md_path.exists(), "文件未保存"
    print(f"  ✓ Markdown 已保存：{md_path}")
    
    return crawler


def test_extract_attachments(client, config):
    """测试 4: 附件链接提取"""
    print("\n[Test 4] 附件链接提取")
    page = client._page
    crawler = PingCodeCrawler(page, TEST_OUTPUT / 'pages')
    
    target_url = config.targets[0]['url']
    attachments = crawler.extract_attachments(target_url)
    
    assert len(attachments) > 0, "未找到附件"
    print(f"  ✓ 找到 {len(attachments)} 个附件链接")
    print(f"  ✓ 示例：{attachments[0]['url'][:60]}...")
    
    return attachments


def test_download_files(client, attachments):
    """测试 5: 文件下载"""
    print("\n[Test 5] 文件下载")
    page = client._page
    downloader = PingCodeDownloader(page, TEST_OUTPUT / 'files')
    
    # 只下载前 3 个文件作为测试
    test_urls = [att['url'] for att in attachments[:3]]
    files = downloader.download_batch(test_urls)
    
    assert len(files) > 0, "没有文件下载成功"
    print(f"  ✓ 下载 {len(files)}/{len(test_urls)} 个文件")
    
    stats = downloader.get_stats()
    print(f"  ✓ 总大小：{stats['total_size']} bytes")
    
    return downloader


def test_pipeline(client, config):
    """测试 6: 完整流水线（复用已登录的 client）"""
    print("\n[Test 6] 完整流水线")
    
    # 复用已登录的 client，避免重复启动 Playwright
    pipeline = PingCodePipeline(config, TEST_OUTPUT / 'pipeline', headless=True)
    pipeline.client = client  # 复用已登录的客户端
    
    # 手动初始化 crawler 和 downloader
    page = client._page
    pipeline.crawler = PingCodeCrawler(page, TEST_OUTPUT / 'pipeline' / 'pages')
    pipeline.downloader = PingCodeDownloader(page, TEST_OUTPUT / 'pipeline' / 'files')
    
    results = pipeline.run_all()
    
    assert len(results) > 0, "流水线无结果"
    result = results[0]
    
    print(f"  ✓ 目标：{result['name']}")
    print(f"  ✓ 页面：{len(result['pages'])} 个")
    print(f"  ✓ 文件：{len(result['files'])} 个")
    print(f"  ✓ 耗时：{result['started_at']} ~ {result['completed_at']}")
    
    return results


def main():
    print("=" * 60)
    print("PingCode 爬虫 Demo 测试")
    print("=" * 60)
    
    client = None
    try:
        # 运行测试
        config = test_config()
        client = test_login(config)
        crawler = test_crawl_page(client, config)
        attachments = test_extract_attachments(client, config)
        downloader = test_download_files(client, attachments)
        results = test_pipeline(client, config)
        
        print("\n" + "=" * 60)
        print("所有测试通过！")
        print(f"测试输出：{TEST_OUTPUT}")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n✗ 测试失败：{e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        if client:
            client.close()


if __name__ == '__main__':
    main()
