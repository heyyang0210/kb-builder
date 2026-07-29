#!/usr/bin/env python3
"""
PingCode 知识库爬虫 - 改进版
"""

import json
import os
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

CONFIG_FILE = Path(__file__).parent.parent / 'config' / 'pingcode.json'
OUTPUT_DIR = Path(__file__).parent.parent / 'refs' / 'pingcode'

def load_config():
    if CONFIG_FILE.exists():
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return None

def crawl_page(page, url, output_path, depth=0):
    """爬取单个页面"""
    print(f"  {'  ' * depth}访问：{url}")
    
    try:
        page.goto(url, wait_until='domcontentloaded', timeout=30000)
        page.wait_for_timeout(5000)
        
        # 获取页面标题
        title_elem = page.query_selector('h1') or page.query_selector('[class*="title"]')
        title = title_elem.inner_text().strip() if title_elem else '未知标题'
        print(f"  {'  ' * depth}标题：{title}")
        
        # 获取页面内容 - 尝试多种选择器
        content = ''
        selectors = [
            'article',
            '.wiki-content',
            '[class*="content"]',
            'main',
            '.page-content',
            '#wiki-content'
        ]
        
        for selector in selectors:
            elem = page.query_selector(selector)
            if elem:
                content = elem.inner_text().strip()
                if len(content) > 100:  # 确保内容足够长
                    break
        
        # 如果还是没有内容，获取整个 body
        if not content or len(content) < 50:
            content = page.inner_text('body').strip()
        
        print(f"  {'  ' * depth}内容长度：{len(content)} 字符")
        
        # 保存为 Markdown
        if content:
            output_path.parent.mkdir(parents=True, exist_ok=True)
            filename = output_path.name if output_path.name.endswith('.md') else f"{output_path}.md"
            filepath = output_path.parent / filename
            
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(f"# {title}\n\n")
                f.write(f"来源：{url}\n")
                f.write(f"爬取时间：{time.strftime('%Y-%m-%d %H:%M:%S')}\n\n")
                f.write("---\n\n")
                f.write(content)
            
            print(f"  {'  ' * depth}✓ 已保存：{filepath}")
            return [str(filepath)]
        else:
            print(f"  {'  ' * depth} 无内容")
            return []
    
    except Exception as e:
        print(f"  {'  ' * depth} 错误：{e}")
        return []

def main():
    config = load_config()
    if not config:
        print("✗ 配置文件不存在")
        sys.exit(1)
    
    email = config['credentials'].get('email')
    password = config['credentials'].get('password')
    
    if not email or not password:
        print("✗ 账号密码未配置")
        sys.exit(1)
    
    print("=" * 60)
    print("PingCode 知识库爬虫")
    print("=" * 60)
    print(f"账号：{email}")
    print(f"输出目录：{OUTPUT_DIR}")
    
    with sync_playwright() as p:
        user_data_dir = Path(__file__).parent.parent / '.browser-data' / 'pingcode'
        
        browser = p.chromium.launch_persistent_context(
            user_data_dir=str(user_data_dir),
            headless=True,
            viewport={'width': 1920, 'height': 1080}
        )
        
        page = browser.pages[0] if browser.pages else browser.new_page()
        
        # 登录
        target_url = config['targets'][0]['url']
        print(f"\n访问：{target_url}")
        page.goto(target_url, wait_until='domcontentloaded', timeout=30000)
        page.wait_for_timeout(5000)
        
        if 'login' in page.url.lower() or 'Login' in page.title():
            print("正在登录...")
            try:
                page.wait_for_selector('input[name="username"]', timeout=10000)
                page.query_selector('input[name="username"]').fill(email)
                page.query_selector('input[name="password"]').fill(password)
                page.query_selector('input[type="submit"], button[type="submit"]').click()
                page.wait_for_load_state('networkidle')
                page.wait_for_timeout(5000)
                print("✓ 登录成功")
            except Exception as e:
                print(f"✗ 登录失败：{e}")
                browser.close()
                sys.exit(1)
        
        # 爬取目标页面
        print("\n开始爬取...")
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        
        crawled_files = []
        for target in config.get('targets', []):
            output_file = OUTPUT_DIR / f"{target['name']}.md"
            files = crawl_page(page, target['url'], output_file)
            crawled_files.extend(files)
        
        print("\n" + "=" * 60)
        print(f"爬取完成！共下载 {len(crawled_files)} 个文件")
        print("=" * 60)
        
        browser.close()

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f"\n✗ 错误：{e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
