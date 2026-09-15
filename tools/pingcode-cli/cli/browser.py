#!/usr/bin/env python3
"""
PingCode 浏览器访问工具
"""

import json
import os
import sys
from pathlib import Path

CONFIG_FILE = Path(__file__).resolve().parents[3] / 'config' / 'pingcode' / 'pingcode.json'

def load_config():
    if CONFIG_FILE.exists():
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return None

def save_config(config):
    CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
        json.dump(config, f, ensure_ascii=False, indent=2)

def setup_credentials(email=None, password=None):
    config = load_config() or {'base_url': 'https://pingcode.yasdb.com', 'credentials': {}, 'targets': []}
    
    print("=" * 60)
    print("PingCode 账号配置")
    print("=" * 60)
    
    if config['credentials'].get('email') and not email:
        print(f"\n当前账号：{config['credentials']['email']}")
        print("使用 --email 和 --password 参数修改")
        return config
    
    if not email or not password:
        print("\n请提供 PingCode 登录信息:")
        print("用法：python3 tools/pingcode-cli-browser.py --email YOUR_EMAIL --password YOUR_PASSWORD")
        sys.exit(1)
    
    config['credentials'] = {'email': email, 'password': password}
    save_config(config)
    print(f"\n✓ 账号已保存：{email}")
    print("✓ 配置文件：config/pingcode/credentials.json")
    
    return config

def launch_browser(config, headless=False):
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("\n✗ 需要安装 Playwright")
        print("运行：pip install playwright && playwright install chromium")
        sys.exit(1)
    
    print("\n启动浏览器...")
    
    with sync_playwright() as p:
        user_data_dir = Path(__file__).resolve().parents[3] / 'runtime' / 'browser-data' / 'pingcode'
        user_data_dir.mkdir(parents=True, exist_ok=True)
        
        browser = p.chromium.launch_persistent_context(
            user_data_dir=str(user_data_dir),
            headless=headless,
            viewport={'width': 1920, 'height': 1080},
            ignore_https_errors=True,
        )
        
        page = browser.pages[0] if browser.pages else browser.new_page()
        
        target_url = config['targets'][0]['url'] if config.get('targets') else f"{config['base_url']}/wiki/spaces/YASSTORAGE/pages/SBlM3dKV"
        print(f"访问：{target_url}")
        
        page.goto(target_url, wait_until='domcontentloaded', timeout=30000)
        page.wait_for_timeout(3000)
        
        print(f"当前 URL: {page.url}")
        print(f"页面标题：{page.title()}")
        
        # 截图
        page.screenshot(path='/tmp/pingcode-current.png', full_page=True)
        print("✓ 截图已保存：/tmp/pingcode-current.png")
        
        if 'login' in page.url.lower() or 'Login' in page.title():
            print("\n检测到登录页面，正在登录...")
            
            email = config['credentials']['email']
            password = config['credentials']['password']
            
            try:
                page.wait_for_selector('input[name="username"], input[id="username"]', timeout=10000)
                print("✓ 找到登录表单")
                
                username_input = page.query_selector('input[name="username"], input[id="username"]')
                password_input = page.query_selector('input[name="password"], input[id="password"]')
                
                if username_input and password_input:
                    username_input.fill(email)
                    password_input.fill(password)
                    print("✓ 已填写账号密码")
                    
                    login_btn = page.query_selector('input[type="submit"], button[type="submit"], #fm1 button')
                    if login_btn:
                        login_btn.click()
                        print("✓ 已点击登录按钮")
                        page.wait_for_load_state('networkidle')
                        page.wait_for_timeout(5000)
                        
                        # 截图
                        page.screenshot(path='/tmp/pingcode-after-login.png', full_page=True)
                        print("✓ 登录后截图已保存：/tmp/pingcode-after-login.png")
                        
                        print(f"登录后 URL: {page.url}")
                        print("✓ 登录成功")
                    else:
                        print(" 未找到登录按钮")
                else:
                    print("✗ 未找到登录表单")
            except Exception as e:
                print(f" 登录失败：{e}")
        else:
            print("✓ 已登录（使用缓存的会话）")
        
        # 访问目标页面
        print(f"\n访问目标页面：{target_url}")
        page.goto(target_url, wait_until='domcontentloaded', timeout=30000)
        page.wait_for_timeout(5000)
        
        page.screenshot(path='/tmp/pingcode-final.png', full_page=True)
        print("✓ 最终页面截图已保存：/tmp/pingcode-final.png")
        
        print("\n" + "=" * 60)
        print("浏览器已打开，可以手动操作")
        print("按 Ctrl+C 关闭浏览器")
        print("=" * 60)
        
        try:
            import time
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n关闭浏览器...")
        finally:
            browser.close()

def main():
    import argparse
    parser = argparse.ArgumentParser(description='PingCode 浏览器访问工具')
    parser.add_argument('--email', help='PingCode 账号')
    parser.add_argument('--password', help='PingCode 密码')
    parser.add_argument('--headless', action='store_true', help='无头模式')
    parser.add_argument('--setup', action='store_true', help='仅设置账号密码')
    
    args = parser.parse_args()
    
    config = setup_credentials(email=args.email, password=args.password)
    
    if args.setup:
        print("\n✓ 配置完成")
        return
    
    launch_browser(config, headless=args.headless)

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f"\n✗ 错误：{e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
