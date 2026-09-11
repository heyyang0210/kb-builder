#!/usr/bin/env python3
"""
API 客户端测试用例

验证内容：
1. API 客户端初始化
2. 获取空间信息
3. 获取页面列表
4. 构建树结构
5. 解析文档内容
"""

import sys
import json
from pathlib import Path
from bootstrap import ROOT

# 添加 scripts 目录到路径
SCRIPTS_DIR = Path(__file__).parent.parent.parent
sys.path.insert(0, str(SCRIPTS_DIR))

from pingcode_core.config import PingCodeConfig
from pingcode_core.client import PingCodeClient
from pingcode_core.api_client import PingCodeAPIClient
from pingcode_core.tree_builder import TreeBuilder
from pingcode_core.content_parser import ContentParser


def test_api_client():
    """测试 1: API 客户端"""
    print("\n[Test 1] API 客户端初始化")
    
    config = PingCodeConfig()
    client = PingCodeClient(config, headless=True)
    page = client.start()
    
    api = PingCodeAPIClient(page, config.base_url)
    print(f"  ✓ API 客户端已创建")
    print(f"  ✓ Base URL: {api.base_url}")
    
    return client, api


def test_get_space(api):
    """测试 2: 获取空间信息"""
    print("\n[Test 2] 获取空间信息")
    
    space = api.get_space('YASSTORAGE')
    print(f"  ✓ 空间名称：{space.get('data', {}).get('value', {}).get('name', '')}")
    
    return space


def test_get_pages(api):
    """测试 3: 获取页面列表"""
    print("\n[Test 3] 获取页面列表")
    
    pages = api.get_pages('YASSTORAGE')
    print(f"  ✓ 页面数量：{len(pages)}")
    
    if pages:
        first = pages[0]
        print(f"  ✓ 第一个页面：{first.get('name', '')}")
        print(f"  ✓ 页面 ID: {first.get('_id', '')}")
        print(f"  ✓ 附件数：{first.get('attachment_count', 0)}")
    
    return pages


def test_tree_builder(pages):
    """测试 4: 构建树结构"""
    print("\n[Test 4] 构建目录树")
    
    builder = TreeBuilder()
    roots = builder.build(pages)
    
    print(f"  ✓ 根节点数：{len(roots)}")
    
    if roots:
        first_root = roots[0]
        print(f"  ✓ 第一个根节点：{first_root.name}")
        print(f"  ✓ 子节点数：{len(first_root.children)}")
        
        # 打印树结构（前 3 层）
        print("\n  树结构（前 3 层）:")
        _print_tree(roots, max_depth=3)
    
    return roots


def test_content_parser(api):
    """测试 5: 解析文档内容"""
    print("\n[Test 5] 解析文档内容")
    
    # 获取一个有内容的页面
    pages = api.get_pages('YASSTORAGE')
    page_with_content = None
    
    for p in pages:
        if p.get('word_count', 0) > 0:
            page_with_content = p
            break
    
    if not page_with_content:
        print("   未找到有内容的页面，跳过测试")
        return None
    
    # 获取页面详情
    page_id = page_with_content['_id']
    detail = api.get_page(page_id)
    document = detail.get('data', {}).get('value', {}).get('document', {})
    
    print(f"  ✓ 页面：{page_with_content['name']}")
    print(f"  ✓ Document keys: {len(document)}")
    
    # 解析
    parser = ContentParser()
    markdown = parser.parse_document(document)
    
    print(f"  ✓ 解析后长度：{len(markdown)} 字符")
    if markdown:
        print(f"  ✓ 内容预览：{markdown[:100]}...")
    
    return markdown


def _print_tree(roots, max_depth=3, current_depth=0):
    """打印树结构"""
    for root in roots:
        if current_depth >= max_depth:
            return
        prefix = "    " * current_depth
        attachment_info = f" ({root.attachment_count} 附件)" if root.attachment_count > 0 else ""
        print(f"  {prefix}- {root.name}{attachment_info}")
        _print_tree(root.children, max_depth, current_depth + 1)


def main():
    print("=" * 60)
    print("API 客户端测试")
    print("=" * 60)
    
    client = None
    try:
        client, api = test_api_client()
        space = test_get_space(api)
        pages = test_get_pages(api)
        roots = test_tree_builder(pages)
        markdown = test_content_parser(api)
        
        print("\n" + "=" * 60)
        print("所有测试通过！")
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
