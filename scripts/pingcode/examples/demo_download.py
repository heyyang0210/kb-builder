#!/usr/bin/env python3
"""PingCode 批量下载器 - 下载内幕文档页面的所有附件"""

import json
import os
import re
from pathlib import Path
from playwright.sync_api import sync_playwright

CONFIG_FILE = Path(__file__).parent.parent / 'config' / 'pingcode.json'
OUTPUT_DIR = Path(__file__).parent.parent / 'refs' / 'pingcode' / 'YASSTORAGE_内幕文档'

def main():
    with open(CONFIG_FILE, 'r') as f:
        config = json.load(f)
    
    target_url = config['targets'][0]['url']
    
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"输出目录: {OUTPUT_DIR}")
    
    with sync_playwright() as p:
        user_data_dir = Path(__file__).parent.parent / '.browser-data' / 'pingcode'
        
        browser = p.chromium.launch_persistent_context(
            user_data_dir=str(user_data_dir),
            headless=True,
            viewport={'width': 1920, 'height': 1080}
        )
        
        page = browser.pages[0] if browser.pages else browser.new_page()
        
        print(f"\n访问: {target_url}")
        page.goto(target_url, wait_until='domcontentloaded', timeout=30000)
        page.wait_for_timeout(5000)
        
        # 提取表格中的模块信息
        print("\n[1] 解析表格内容...")
        table = page.query_selector('table')
        rows = table.query_selector_all('tr') if table else []
        
        modules = []
        for row in rows[1:]:  # 跳过表头
            cells = row.query_selector_all('td')
            if len(cells) >= 4:
                module_name = cells[1].inner_text().strip()
                owner = cells[2].inner_text().strip()
                modules.append({'name': module_name, 'owner': owner})
        
        print(f"  找到 {len(modules)} 个模块")
        
        # 提取所有下载链接
        print("\n[2] 提取下载链接...")
        links = page.query_selector_all('a[href*="download"]')
        download_urls = []
        
        for link in links:
            href = link.get_attribute('href') or ''
            if 'atlas/file/download-url' in href:
                download_urls.append(href)
        
        print(f"  找到 {len(download_urls)} 个下载链接")
        
        # 下载文件
        print(f"\n[3] 开始下载...")
        downloaded = []
        
        for idx, url in enumerate(download_urls, 1):
            try:
                print(f"  [{idx}/{len(download_urls)}] 下载...")
                
                # 使用 page 上下文下载（保持登录状态）
                response = page.evaluate("""
                    async (url) => {
                        const resp = await fetch(url);
                        if (!resp.ok) return { error: resp.status };
                        const blob = await resp.blob();
                        const buffer = await blob.arrayBuffer();
                        return {
                            ok: true,
                            data: Array.from(new Uint8Array(buffer)),
                            contentType: resp.headers.get('content-type'),
                            contentDisposition: resp.headers.get('content-disposition')
                        };
                    }
                """, url)
                
                if response.get('error'):
                    print(f"    ✗ HTTP {response['error']}")
                    continue
                
                # 从 Content-Disposition 提取文件名
                filename = None
                cd = response.get('contentDisposition') or ''
                match = re.search(r'filename[^;=\n]*=(([\'"]).*?\2|[^;\n]*)', cd)
                if match:
                    filename = match.group(1).strip('\'"')
                
                if not filename:
                    # 从 URL 提取
                    filename = f"file_{idx}.bin"
                
                # 保存文件
                filepath = OUTPUT_DIR / filename
                with open(filepath, 'wb') as f:
                    f.write(bytes(response['data']))
                
                file_size = filepath.stat().st_size
                print(f"    ✓ {filename} ({file_size} bytes)")
                downloaded.append(str(filepath))
                
            except Exception as e:
                print(f"    ✗ 失败: {e}")
        
        # 总结
        print(f"\n{'='*60}")
        print(f"下载完成: {len(downloaded)}/{len(download_urls)} 个文件")
        print(f"保存位置: {OUTPUT_DIR}")
        print(f"{'='*60}")
        
        browser.close()

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f"\n✗ 错误: {e}")
        import traceback
        traceback.print_exc()
