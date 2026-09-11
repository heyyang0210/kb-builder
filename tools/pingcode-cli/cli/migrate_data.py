#!/usr/bin/env python3
"""
数据迁移工具

将已有数据从旧结构迁移到新结构：
- refs/pingcode/YASSTORAGE_内幕文档/ → tools/pingcode-cli/data/YASSTORAGE/files/
- refs/pingcode/YASSTORAGE 知识库.md → tools/pingcode-cli/data/YASSTORAGE/pages/内幕文档.md
"""

import sys
import shutil
from pathlib import Path

# 脚本位置：tools/pingcode-cli/cli/migrate_data.py
# 项目根目录：向上 4 级
SCRIPT_DIR = Path(__file__).parent
PINGCODE_DIR = SCRIPT_DIR.parent  # tools/pingcode-cli
SCRIPTS_DIR = PINGCODE_DIR.parent  # scripts
PROJECT_ROOT = SCRIPTS_DIR.parent  # 项目根目录

sys.path.insert(0, str(PROJECT_ROOT / 'packages' / 'pingcode-core'))

from filename_utils import FilenameUtils


def migrate_existing_data():
    """迁移已有数据"""
    print("=" * 60)
    print("PingCode 数据迁移工具")
    print("=" * 60)
    
    # 源目录（项目根目录下的 refs/pingcode）
    refs_dir = PROJECT_ROOT / 'knowledge' / 'refs' / 'pingcode'
    existing_dir = refs_dir / 'YASSTORAGE_内幕文档'
    
    # 查找 Markdown 文件（模糊匹配）
    md_file = None
    for f in refs_dir.glob('YASSTORAGE*.md'):
        if '知识' in f.name or 'wiki' in f.name.lower():
            md_file = f
            break
    
    # 目标目录（tools/pingcode-cli/data）
    data_dir = PROJECT_ROOT / 'runtime' / 'pingcode' / 'cli'
    target_files_dir = data_dir / 'YASSTORAGE' / 'files'
    target_pages_dir = data_dir / 'YASSTORAGE' / 'pages'
    
    print(f"\n源目录：{refs_dir}")
    print(f"目标目录：{data_dir}")
    
    # 1. 迁移附件文件
    print("\n[1] 迁移附件文件...")
    if existing_dir.exists():
        stats = {'copied': 0, 'skipped': 0, 'errors': []}
        
        for file_path in existing_dir.rglob('*'):
            if not file_path.is_file():
                continue
            
            # 解码文件名
            original_name = file_path.name
            decoded_name = FilenameUtils.decode_url(original_name)
            safe_name = FilenameUtils.sanitize(decoded_name)
            
            # 构建目标路径
            target_path = target_files_dir / safe_name
            target_path = FilenameUtils.unique_filename(target_path)
            
            try:
                target_path.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(file_path, target_path)
                stats['copied'] += 1
                print(f"  ✓ {original_name[:50]}... → {target_path.name}")
            except Exception as e:
                stats['errors'].append(f"{original_name}: {e}")
                print(f"  ✗ {original_name}: {e}")
        
        print(f"\n  迁移完成：{stats['copied']} 个文件")
        if stats['errors']:
            print(f"  错误：{len(stats['errors'])} 个")
    else:
        print(f"  ✗ 源目录不存在：{existing_dir}")
    
    # 2. 迁移页面内容
    print("\n[2] 迁移页面内容...")
    if md_file:
        target_path = target_pages_dir / '内幕文档.md'
        target_path = FilenameUtils.unique_filename(target_path)
        
        try:
            target_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(md_file, target_path)
            print(f"  ✓ {md_file.name} → {target_path.name}")
        except Exception as e:
            print(f"  ✗ 迁移失败：{e}")
    else:
        print(f"  ✗ 未找到 Markdown 文件")
    
    # 3. 统计结果
    print("\n" + "=" * 60)
    print("迁移完成")
    print(f"  附件文件：{target_files_dir}")
    print(f"  页面内容：{target_pages_dir}")
    
    total_size = sum(f.stat().st_size for f in target_files_dir.rglob('*') if f.is_file())
    print(f"  总大小：{total_size / 1024 / 1024:.1f} MB")
    print("=" * 60)


if __name__ == '__main__':
    try:
        migrate_existing_data()
    except Exception as e:
        print(f"\n✗ 错误：{e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
