"""
索引生成器

为 AI 训练提供结构化索引，支持：
- JSON 格式（机器可读）
- Markdown 格式（人类可读）
- 已有数据整合
"""

import json
import shutil
from pathlib import Path
from typing import Optional, List, Dict

from .tree_builder import TreeNode
from .filename_utils import FilenameUtils


class IndexBuilder:
    """索引生成器"""
    
    def __init__(self, space_key: str, space_name: str, tree: list[TreeNode], pages: list[dict]):
        self.space_key = space_key
        self.space_name = space_name
        self.tree = tree
        self.pages = pages
    
    def build_index(self) -> dict:
        """构建索引"""
        total_attachments = sum(p.get('attachment_count', 0) for p in self.pages)
        
        # 为每个页面添加面包屑路径
        pages_with_breadcrumb = []
        node_map = {}
        for root in self.tree:
            self._build_node_map(root, node_map)
        
        for page in self.pages:
            page_copy = page.copy()
            breadcrumb = self._get_breadcrumb(page['_id'], node_map)
            page_copy['breadcrumb'] = breadcrumb
            pages_with_breadcrumb.append(page_copy)
        
        return {
            'space_key': self.space_key,
            'space_name': self.space_name,
            'total_pages': len(self.pages),
            'total_attachments': total_attachments,
            'tree': [t.to_dict() for t in self.tree],
            'pages': pages_with_breadcrumb
        }
    
    def _build_node_map(self, node: TreeNode, node_map: dict):
        """构建 id → TreeNode 映射"""
        node_map[node.id] = node
        for child in node.children:
            self._build_node_map(child, node_map)
    
    def _get_breadcrumb(self, page_id: str, node_map: dict) -> list[str]:
        """获取面包屑路径"""
        path = []
        current = node_map.get(page_id)
        
        while current:
            path.insert(0, current.name)
            if current.parent_id:
                current = node_map.get(current.parent_id)
            else:
                break
        
        return path
    
    def save_json(self, path: Path):
        """保存 JSON 索引"""
        index = self.build_index()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding='utf-8')
        print(f"  ✓ JSON 索引已保存：{path}")
    
    def save_markdown(self, path: Path):
        """保存 Markdown 索引"""
        lines = [
            f"# {self.space_name} 索引",
            "",
            f"- **空间 Key**: {self.space_key}",
            f"- **总页面数**: {len(self.pages)}",
            f"- **总附件数**: {sum(p.get('attachment_count', 0) for p in self.pages)}",
            "",
            "## 目录结构",
            ""
        ]
        
        # 添加目录树
        for root in self.tree:
            lines.extend(self._tree_to_markdown(root, indent=0))
        
        lines.append("\n## 页面列表\n")
        
        # 添加页面列表
        for page in self.pages:
            name = page.get('name', '未知')
            attachments = page.get('attachment_count', 0)
            content_path = page.get('content_path', '')
            breadcrumb = page.get('breadcrumb', [])
            
            line = f"- **{name}**"
            if breadcrumb:
                line += f" ({' / '.join(breadcrumb)})"
            if attachments > 0:
                line += f" - {attachments} 附件"
            if content_path:
                line += f" - [内容]({content_path})"
            
            lines.append(line)
        
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text('\n'.join(lines), encoding='utf-8')
        print(f"  ✓ Markdown 索引已保存：{path}")
    
    def _tree_to_markdown(self, node: TreeNode, indent: int) -> list[str]:
        """将树节点转换为 Markdown"""
        lines = []
        prefix = '  ' * indent
        attachment_info = f" ({node.attachment_count} 附件)" if node.attachment_count > 0 else ""
        lines.append(f"{prefix}- **{node.name}**{attachment_info}")
        
        for child in node.children:
            lines.extend(self._tree_to_markdown(child, indent + 1))
        
        return lines
    
    def merge_existing_files(self, existing_dir: Path, target_dir: Path) -> dict:
        """
        整合已有文件到新结构
        
        Args:
            existing_dir: 已有数据目录（如 refs/pingcode/YASSTORAGE_内幕文档）
            target_dir: 目标目录（如 data/YASSTORAGE/files）
        
        Returns:
            整合结果统计
        """
        if not existing_dir.exists():
            return {'copied': 0, 'skipped': 0, 'errors': []}
        
        print(f"\n  整合已有文件：{existing_dir}")
        
        stats = {'copied': 0, 'skipped': 0, 'errors': []}
        
        # 扫描已有文件
        for file_path in existing_dir.rglob('*'):
            if not file_path.is_file():
                continue
            
            # 解码文件名
            original_name = file_path.name
            decoded_name = FilenameUtils.decode_url(original_name)
            safe_name = FilenameUtils.sanitize(decoded_name)
            
            # 构建目标路径
            target_path = target_dir / safe_name
            target_path = FilenameUtils.unique_filename(target_path)
            
            try:
                # 复制文件
                target_path.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(file_path, target_path)
                stats['copied'] += 1
                print(f"    ✓ {original_name} → {target_path.name}")
            except Exception as e:
                stats['errors'].append(f"{original_name}: {e}")
                print(f"    ✗ {original_name}: {e}")
        
        print(f"  整合完成：{stats['copied']} 个文件")
        return stats
    
    def merge_existing_page_content(self, md_file: Path, target_dir: Path, page_name: str) -> Optional[Path]:
        """
        整合已有页面内容
        
        Args:
            md_file: 已有 Markdown 文件
            target_dir: 目标目录
            page_name: 页面名称
        
        Returns:
            目标文件路径
        """
        if not md_file.exists():
            return None
        
        safe_name = FilenameUtils.sanitize(page_name)
        target_path = target_dir / f"{safe_name}.md"
        target_path = FilenameUtils.unique_filename(target_path)
        
        try:
            target_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(md_file, target_path)
            print(f"  ✓ 页面内容已整合：{md_file.name} → {target_path.name}")
            return target_path
        except Exception as e:
            print(f"  ✗ 页面内容整合失败：{e}")
            return None
