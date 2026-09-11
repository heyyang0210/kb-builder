"""
文件名处理工具

解决常见问题：
- URL 编码解码
- 非法字符清理
- 文件名去重
- 长度截断
"""

import re
import hashlib
from pathlib import Path
from urllib.parse import unquote
from typing import Optional


class FilenameUtils:
    """文件名处理工具类"""
    
    # Windows 非法字符
    ILLEGAL_CHARS = r'[<>:"/\\|?*]'
    
    # 最大文件名长度（字节）
    MAX_FILENAME_LENGTH = 200
    
    @staticmethod
    def decode_url(filename: str) -> str:
        """URL 解码"""
        if not filename:
            return filename
        return unquote(filename)
    
    @staticmethod
    def sanitize(filename: str) -> str:
        """清理非法字符"""
        if not filename:
            return "unnamed"
        
        # URL 解码
        filename = FilenameUtils.decode_url(filename)
        
        # 替换非法字符
        filename = re.sub(FilenameUtils.ILLEGAL_CHARS, '_', filename)
        
        # 清理零宽字符
        filename = re.sub(r'[\u200b\u200c\u200d\ufeff]', '', filename)
        
        # 清理首尾空格和点
        filename = filename.strip(' .')
        
        # 空文件名处理
        if not filename:
            return "unnamed"
        
        return filename
    
    @staticmethod
    def truncate(filename: str, max_length: Optional[int] = None) -> str:
        """截断过长文件名"""
        max_len = max_length or FilenameUtils.MAX_FILENAME_LENGTH
        
        # 按字节长度截断
        encoded = filename.encode('utf-8')
        if len(encoded) <= max_len:
            return filename
        
        # 截断并添加 hash 后缀
        truncated = encoded[:max_len - 10].decode('utf-8', errors='ignore')
        hash_suffix = hashlib.md5(filename.encode()).hexdigest()[:6]
        return f"{truncated}_{hash_suffix}"
    
    @staticmethod
    def unique_filename(filepath: Path) -> Path:
        """避免文件名冲突"""
        if not filepath.exists():
            return filepath
        
        stem = filepath.stem
        suffix = filepath.suffix
        parent = filepath.parent
        
        counter = 1
        while True:
            new_path = parent / f"{stem}_{counter}{suffix}"
            if not new_path.exists():
                return new_path
            counter += 1
    
    @staticmethod
    def extract_extension(content_type: str, filename: str) -> str:
        """从 Content-Type 或文件名提取扩展名"""
        # 优先从文件名提取
        if '.' in filename:
            return filename.rsplit('.', 1)[1].lower()
        
        # 从 Content-Type 推断
        type_map = {
            'application/msword': '.doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
            'application/vnd.ms-powerpoint': '.ppt',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
            'application/pdf': '.pdf',
            'image/png': '.png',
            'image/jpeg': '.jpg',
            'image/gif': '.gif',
            'text/plain': '.txt',
            'text/markdown': '.md',
        }
        
        return type_map.get(content_type, '.bin')
    
    @staticmethod
    def build_filepath(output_dir: Path, page_name: str, filename: str) -> Path:
        """构建安全的文件路径"""
        # 清理页面名和文件名
        safe_page = FilenameUtils.sanitize(page_name)
        safe_file = FilenameUtils.sanitize(filename)
        
        # 截断过长部分
        safe_page = FilenameUtils.truncate(safe_page, 100)
        safe_file = FilenameUtils.truncate(safe_file, 150)
        
        # 构建路径
        filepath = output_dir / safe_page / safe_file
        
        # 确保唯一
        filepath = FilenameUtils.unique_filename(filepath)
        
        return filepath
