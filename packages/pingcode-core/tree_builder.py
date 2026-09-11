"""
目录树构建器

从扁平页面列表构建嵌套树结构。
"""

from typing import Optional


class TreeNode:
    """树节点"""
    
    def __init__(self, page_data: dict):
        self.id = page_data.get('_id', '')
        self.name = page_data.get('name', '未知')
        self.identifier = page_data.get('identifier', '')
        self.short_id = page_data.get('short_id', '')
        self.parent_id = page_data.get('parent_id')
        self.parent_ids = page_data.get('parent_ids') or []
        self.position = page_data.get('position', 0) or 0
        self.attachment_count = page_data.get('attachment_count', 0)
        self.word_count = page_data.get('word_count', 0)
        self.type = page_data.get('type', 0)
        self.updated_at = page_data.get('updated_at', '')
        self.created_at = page_data.get('created_at', '')
        self.children = []
        self.depth = 0
        self.breadcrumb = []
        self._page_data = page_data
    
    def add_child(self, child: 'TreeNode'):
        self.children.append(child)

    def sort_key(self) -> tuple:
        return (self.position, self.identifier or self.short_id or self.name, self.id)

    def finalize(self, depth: int = 0, breadcrumb: Optional[list[str]] = None):
        self.depth = depth
        self.breadcrumb = [*(breadcrumb or []), self.name]
        self.children.sort(key=lambda child: child.sort_key())
        for child in self.children:
            child.finalize(depth + 1, self.breadcrumb)
    
    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'name': self.name,
            'identifier': self.identifier or self.short_id,
            'parentId': self.parent_id,
            'position': self.position,
            'attachmentCount': self.attachment_count,
            'wordCount': self.word_count,
            'type': self.type,
            'icon': self._page_data.get('icon'),
            'emojiIcon': self._page_data.get('emoji_icon'),
            'depth': self.depth,
            'hasChildren': bool(self.children),
            'children': [c.to_dict() for c in self.children]
        }
    
    def __repr__(self):
        return f"TreeNode(name='{self.name}', children={len(self.children)})"


class TreeBuilder:
    """目录树构建器"""
    
    def build(self, pages: list[dict]) -> list[TreeNode]:
        """从完整扁平页面列表构建严格树。"""
        roots, _ = self.build_with_diagnostics(pages)
        return roots

    def build_with_diagnostics(self, pages: list[dict]) -> tuple[list[TreeNode], list[str]]:
        if not pages:
            return [], []
        
        # 创建 id → TreeNode 映射
        node_map = {}
        for page in pages:
            node = TreeNode(page)
            node_map[node.id] = node
        
        # 构建树结构
        roots = []
        unresolved_parent_ids = set()
        for node in node_map.values():
            if not node.parent_id:
                roots.append(node)
            elif node.parent_id in node_map:
                parent = node_map[node.parent_id]
                parent.add_child(node)
            else:
                unresolved_parent_ids.add(node.parent_id)
        
        roots.sort(key=lambda node: node.sort_key())
        for root in roots:
            root.finalize()
        return roots, sorted(unresolved_parent_ids)
    
    def get_breadcrumb(self, page_id: str, node_map: dict[str, TreeNode]) -> list[str]:
        """获取页面面包屑路径"""
        path = []
        current = node_map.get(page_id)
        
        while current:
            path.insert(0, current.name)
            if current.parent_id:
                current = node_map.get(current.parent_id)
            else:
                break
        
        return path
    
    def to_markdown(self, roots: list[TreeNode], indent: int = 0) -> str:
        """将树转换为 Markdown 格式"""
        lines = []
        
        for root in roots:
            prefix = '  ' * indent
            attachment_info = f" ({root.attachment_count} 附件)" if root.attachment_count > 0 else ""
            lines.append(f"{prefix}- **{root.name}**{attachment_info}")
            
            if root.children:
                child_md = self.to_markdown(root.children, indent + 1)
                lines.append(child_md)
        
        return '\n'.join(lines)
    
    def build_node_map(self, pages: list[dict]) -> dict[str, TreeNode]:
        """构建 id → TreeNode 映射（用于快速查找）"""
        node_map = {}
        for page in pages:
            node = TreeNode(page)
            node_map[node.id] = node
        return node_map
