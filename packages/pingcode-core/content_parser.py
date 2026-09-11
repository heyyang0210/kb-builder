"""
文档内容解析器

将 PingCode 的 Slate.js 风格 document 结构解析为 Markdown。
document 格式：list of blocks, each block has type, key, children
children 是 inline 元素数组，每个有 text 属性
"""

from typing import Any, Callable


class ContentParser:
    """文档内容解析器"""
    
    def parse_document(
        self,
        document,
        image_resolver: Callable[[dict[str, Any]], str | None] | None = None,
    ) -> str:
        """解析 document 结构为 Markdown"""
        if not document:
            return ""
        
        # document 可能是 list（Slate.js 块数组）或 dict（numeric keys）
        if isinstance(document, list):
            blocks = document
        elif isinstance(document, dict):
            blocks = []
            for key in sorted(document.keys(), key=lambda x: int(x) if str(x).isdigit() else 0):
                blocks.append(document[key])
        else:
            return str(document)
        
        parsed_blocks = []
        for block in blocks:
            block_text = self.parse_block(block, image_resolver=image_resolver)
            if block_text:
                parsed_blocks.append(block_text)
        
        if parsed_blocks:
            return '\n\n'.join(parsed_blocks)
        
        return self.fallback_to_text(document)
    
    def parse_block(
        self,
        block,
        image_resolver: Callable[[dict[str, Any]], str | None] | None = None,
    ) -> str:
        """解析单个块"""
        if not isinstance(block, dict):
            return str(block) if block else ""
        
        block_type = block.get('type', '')
        
        # Slate.js 风格：内容在 children 数组中
        children = block.get('children', [])
        text = self._extract_children_text(children)
        
        if block_type == 'paragraph':
            return text if text else ""
        
        elif block_type == 'heading':
            level = block.get('level', block.get('depth', 1))
            return f"{'#' * level} {text}" if text else ""
        
        elif block_type == 'bulleted-list':
            return self._parse_list_items(children, ordered=False)
        
        elif block_type == 'numbered-list':
            return self._parse_list_items(children, ordered=True)
        
        elif block_type == 'list-item':
            return f"- {text}" if text else ""
        
        elif block_type == 'code-block':
            lang = block.get('language', '')
            return f"```{lang}\n{text}\n```" if text else ""
        
        elif block_type == 'block-quote':
            lines = text.split('\n')
            return '\n'.join(f"> {line}" for line in lines) if text else ""
        
        elif block_type == 'image':
            url = image_resolver(block) if image_resolver else None
            if image_resolver is None:
                url = block.get('originUrl') or block.get('thumbUrl') or block.get('url', '')
            alt = block.get('alt') or block.get('name') or 'image'
            if image_resolver is None and not url and children:
                url = children[0].get('url', '')
            return f"![{alt}]({url})" if url else f"> [图片下载失败：{alt}]"
        
        elif block_type == 'table':
            return self._parse_slate_table(block)
        
        elif block_type == 'thematic-break':
            return "---"
        
        elif block_type == 'html':
            return text
        
        else:
            # 未知类型，返回文本
            return text if text else ""

    @staticmethod
    def extract_images(document) -> list[dict[str, Any]]:
        """递归提取文档中的图片节点，保留原节点引用。"""
        images: list[dict[str, Any]] = []

        def visit(value) -> None:
            if isinstance(value, dict):
                if value.get('type') == 'image':
                    images.append(value)
                for child in value.values():
                    visit(child)
            elif isinstance(value, list):
                for child in value:
                    visit(child)

        visit(document)
        return images
    
    def _extract_children_text(self, children) -> str:
        """从 Slate.js children 数组提取文本"""
        if not children:
            return ""
        
        texts = []
        for child in children:
            if isinstance(child, dict):
                # 递归处理嵌套 children（如 list-item > paragraph > text）
                if 'children' in child:
                    nested = self._extract_children_text(child['children'])
                    if nested:
                        texts.append(nested)
                else:
                    text = child.get('text', '')
                    if text:
                        # 处理 inline 格式
                        if child.get('bold'):
                            text = f"**{text}**"
                        if child.get('italic'):
                            text = f"*{text}*"
                        if child.get('code'):
                            text = f"`{text}`"
                        texts.append(text)
            elif isinstance(child, str):
                texts.append(child)
        
        return ''.join(texts)
    
    def _parse_list_items(self, children, ordered=False) -> str:
        """解析列表项"""
        lines = []
        for i, child in enumerate(children, 1):
            if isinstance(child, dict):
                if child.get('type') == 'list-item':
                    item_children = child.get('children', [])
                    text = self._extract_children_text(item_children)
                    if ordered:
                        lines.append(f"{i}. {text}")
                    else:
                        lines.append(f"- {text}")
                else:
                    text = self._extract_children_text(child.get('children', [child]))
                    if ordered:
                        lines.append(f"{i}. {text}")
                    else:
                        lines.append(f"- {text}")
        return '\n'.join(lines)
    
    def _parse_slate_table(self, block: dict) -> str:
        """解析 Slate.js 表格"""
        children = block.get('children', [])
        if not children:
            return ""
        
        lines = []
        for i, row in enumerate(children):
            if isinstance(row, dict):
                cells = row.get('children', [])
                cell_texts = []
                for cell in cells:
                    if isinstance(cell, dict):
                        text = self._extract_children_text(cell.get('children', [cell]))
                        cell_texts.append(text)
                    else:
                        cell_texts.append(str(cell))
                lines.append('| ' + ' | '.join(cell_texts) + ' |')
                if i == 0:
                    lines.append('| ' + ' | '.join(['---'] * len(cell_texts)) + ' |')
        
        return '\n'.join(lines)
    
    def fallback_to_text(self, document) -> str:
        """回退方案：提取所有文本"""
        if isinstance(document, list):
            blocks = document
        elif isinstance(document, dict):
            blocks = [document[k] for k in sorted(document.keys(), key=lambda x: int(x) if str(x).isdigit() else 0)]
        else:
            return str(document)
        
        texts = []
        for block in blocks:
            if isinstance(block, dict):
                children = block.get('children', [])
                text = self._extract_children_text(children)
                if text:
                    texts.append(text)
        return '\n'.join(texts)
