#!/usr/bin/env python3
"""
清理重复文件

删除文件名带有 _1, _2 后缀的重复文件，保留原始文件。
"""

import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
PINGCODE_DIR = SCRIPT_DIR.parent
SCRIPTS_DIR = PINGCODE_DIR.parent
PROJECT_ROOT = SCRIPTS_DIR.parent

DATA_DIR = PINGCODE_DIR / 'data'


def cleanup_duplicates(space_key: str = 'YASSTORAGE'):
    """清理指定空间的重复文件"""
    files_dir = DATA_DIR / space_key / 'files'
    
    if not files_dir.exists():
        print(f"目录不存在：{files_dir}")
        return
    
    print(f"清理目录：{files_dir}")
    
    deleted_count = 0
    deleted_size = 0
    
    for file_path in files_dir.rglob('*'):
        if not file_path.is_file():
            continue
        
        # 匹配 _1, _2 等后缀
        if '_1.' in file_path.name or '_2.' in file_path.name or '_3.' in file_path.name:
            file_size = file_path.stat().st_size
            file_path.unlink()
            deleted_count += 1
            deleted_size += file_size
            print(f"  删除：{file_path.name}")
    
    print(f"\n清理完成")
    print(f"  删除文件：{deleted_count} 个")
    print(f"  释放空间：{deleted_size / 1024 / 1024:.1f} MB")


if __name__ == '__main__':
    space_key = sys.argv[1] if len(sys.argv) > 1 else 'YASSTORAGE'
    cleanup_duplicates(space_key)
