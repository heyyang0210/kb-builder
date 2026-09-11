#!/usr/bin/env python3
"""
集成测试

验证完整流程：
1. 配置加载
2. CAS 登录
3. API 客户端
4. 目录树构建
5. 内容解析
6. 文件名处理
7. 索引生成
"""

import sys
import json
from pathlib import Path
from bootstrap import ROOT

SCRIPT_DIR = Path(__file__).parent
PINGCODE_DIR = SCRIPT_DIR.parent
SCRIPTS_DIR = PINGCODE_DIR.parent
PROJECT_ROOT = SCRIPTS_DIR.parent

sys.path.insert(0, str(SCRIPTS_DIR))

from pingcode_core.config import PingCodeConfig
from pingcode_core.client import PingCodeClient
from pingcode_core.api_client import PingCodeAPIClient
from pingcode_core.tree_builder import TreeBuilder
from pingcode_core.content_parser import ContentParser
from pingcode_core.filename_utils import FilenameUtils
from pingcode_core.index_builder import IndexBuilder


def test_config():
    """测试 1: 配置加载"""
    print("\n[Test 1] 配置加载")
    config = PingCodeConfig()
    assert config.validate(), "配置验证失败"
    print(f"  ✓ base_url: {config.base_url}")
    print(f"  ✓ email: {config.email}")
    print(f"  ✓ targets: {len(config.targets)} 个")
    return config


def test_login(config):
    """测试 2: CAS 登录"""
    print("\n[Test 2] CAS 登录")
    client = PingCodeClient(config, headless=True)
    page = client.start()
    print(f"  ✓ 登录成功")
    return client, page


def test_api_client(page, config):
    """测试 3: API 客户端"""
    print("\n[Test 3] API 客户端")
    api = PingCodeAPIClient(page, config.base_url)
    
    # 获取空间
    space = api.get_space('YASSTORAGE')
    space_name = space.get('data', {}).get('value', {}).get('name', '')
    print(f"  ✓ 空间名称：{space_name}")
    
    # 获取页面
    pages = api.get_pages('YASSTORAGE')
    print(f"  ✓ 页面数量：{len(pages)}")
    
    return api, pages


def test_tree_builder(pages):
    """测试 4: 目录树构建"""
    print("\n[Test 4] 目录树构建")
    builder = TreeBuilder()
    roots = builder.build(pages)
    print(f"  ✓ 根节点数：{len(roots)}")
    
    if roots:
        print(f"  ✓ 第一个根节点：{roots[0].name}")
    
    return roots


def test_content_parser(api):
    """测试 5: 内容解析"""
    print("\n[Test 5] 内容解析")
    parser = ContentParser()
    
    pages = api.get_pages('YASSTORAGE')
    for p in pages[:50]:
        if p.get('word_count', 0) > 100:
            detail = api.get_page(p['_id'])
            document = detail.get('data', {}).get('value', {}).get('document', {})
            markdown = parser.parse_document(document)
            print(f"  ✓ 页面：{p['name']}")
            print(f"  ✓ 解析长度：{len(markdown)} 字符")
            return markdown
    
    print("  ⚠ 未找到有内容的页面")
    return ""


def test_filename_utils():
    """测试 6: 文件名处理"""
    print("\n[Test 6] 文件名处理")
    
    # URL 解码
    encoded = "%E7%B4%A2%E5%BC%95%E5%86%85%E5%B9%95%E6%96%87%E6%A1%A3.docx"
    decoded = FilenameUtils.decode_url(encoded)
    print(f"  ✓ URL 解码：{decoded}")
    
    # 非法字符清理
    dirty = 'file<>:"name.docx'
    clean = FilenameUtils.sanitize(dirty)
    print(f"  ✓ 非法字符清理：{clean}")
    
    # 长度截断
    long_name = 'a' * 300 + '.docx'
    truncated = FilenameUtils.truncate(long_name, 100)
    print(f"  ✓ 长度截断：{len(truncated)} 字符")
    
    return True


def test_index_builder(roots, pages):
    """测试 7: 索引生成"""
    print("\n[Test 7] 索引生成")
    
    builder = IndexBuilder(
        space_key='YASSTORAGE',
        space_name='YashanDB 存储引擎',
        tree=roots,
        pages=pages[:10]  # 只测试前 10 个
    )
    
    index = builder.build_index()
    print(f"  ✓ 索引字段：{list(index.keys())}")
    print(f"  ✓ 页面数：{index['total_pages']}")
    print(f"  ✓ 附件数：{index['total_attachments']}")
    
    return index


def main():
    print("=" * 60)
    print("PingCode 集成测试")
    print("=" * 60)
    
    client = None
    try:
        config = test_config()
        client, page = test_login(config)
        api, pages = test_api_client(page, config)
        roots = test_tree_builder(pages)
        markdown = test_content_parser(api)
        test_filename_utils()
        index = test_index_builder(roots, pages)
        
        print("\n" + "=" * 60)
        print("✅ 所有测试通过！")
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
