from __future__ import annotations

import hashlib
import re
from typing import Any

from .markdown_cleaning import EXCLUDED_PLACEHOLDER_PREFIX, MarkdownCleaningResult


def build_processing_units(
    cleaning: MarkdownCleaningResult,
    resource_id: str,
    source_path: str,
    config: Any,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    text = cleaning.content
    blocks = structure_blocks(text, resource_id)
    units = _build_units(text, blocks, resource_id, source_path, config)
    return blocks, units


def structure_blocks(text: str, resource_id: str) -> list[dict[str, Any]]:
    blocks: list[dict[str, Any]] = []
    offset = 0
    heading_path: list[str] = []
    for index, part in enumerate(re.split(r"\n\n+", text)):
        start = text.find(part, offset)
        end = start + len(part)
        offset = end
        heading = re.match(r"^(#{1,6}) (.+)$", part)
        if heading:
            level = len(heading.group(1))
            heading_path = heading_path[: level - 1] + [heading.group(2).strip()]
        block_type = (
            "excluded" if part.startswith(EXCLUDED_PLACEHOLDER_PREFIX)
            else "heading" if heading
            else "code_block" if part.startswith("```")
            else "table" if "|" in part and "\n" in part
            else "list" if re.search(r"^\s*[-*+] ", part, re.M)
            else "paragraph"
        )
        blocks.append({
            "blockId": f"{resource_id}:block:{index}",
            "resourceId": resource_id,
            "blockType": block_type,
            "markdownOffsets": {"start": start, "end": end},
            "content": part,
            "contentHash": _hash_text(part),
            "headingPath": list(heading_path),
        })
    return blocks


def _build_units(
    text: str,
    blocks: list[dict[str, Any]],
    resource_id: str,
    source_path: str,
    config: Any,
) -> list[dict[str, Any]]:
    max_size = config.max_unit_characters
    # 添加 overlap 支持，默认 15%
    overlap_ratio = getattr(config, 'overlap_ratio', 0.15)
    overlap_chars = int(max_size * overlap_ratio)
    
    units: list[dict[str, Any]] = []
    current: list[dict[str, Any]] = []
    current_size = 0
    overlap_blocks: list[dict[str, Any]] = []  # 用于存储 overlap 内容
    overlap_size = 0
    
    for block in blocks:
        if block["blockType"] == "excluded":
            if current:
                units.append(_unit(text, current, resource_id, source_path, len(units), max_size,
                                   overlap_blocks=overlap_blocks if overlap_blocks else None))
                # 更新 overlap_blocks 为当前块的末尾部分
                overlap_blocks, overlap_size = _calculate_overlap(current, overlap_chars)
                current = []
                current_size = 0
            continue
        
        # 代码块完整性保护：如果当前块是代码块且超过 max_size，尝试保持完整
        if block["blockType"] == "code_block" and len(block["content"]) > max_size:
            if current:
                units.append(_unit(text, current, resource_id, source_path, len(units), max_size,
                                   overlap_blocks=overlap_blocks if overlap_blocks else None))
                overlap_blocks, overlap_size = _calculate_overlap(current, overlap_chars)
                current = []
                current_size = 0
            # 代码块按行分割，尽量保持完整
            code_chunks = _split_code_block(block, max_size)
            for chunk in code_chunks:
                units.append(_unit(text, [chunk], resource_id, source_path, len(units), max_size,
                                   overlap_blocks=overlap_blocks if overlap_blocks else None))
                overlap_blocks, overlap_size = _calculate_overlap([chunk], overlap_chars)
            continue
        
        # 普通块处理
        if len(block["content"]) > max_size:
            if current:
                units.append(_unit(text, current, resource_id, source_path, len(units), max_size,
                                   overlap_blocks=overlap_blocks if overlap_blocks else None))
                overlap_blocks, overlap_size = _calculate_overlap(current, overlap_chars)
                current = []
                current_size = 0
            # 大块按段落分割
            large_chunks = _split_large_block(block, max_size)
            for chunk in large_chunks:
                units.append(_unit(text, [chunk], resource_id, source_path, len(units), max_size,
                                   overlap_blocks=overlap_blocks if overlap_blocks else None))
                overlap_blocks, overlap_size = _calculate_overlap([chunk], overlap_chars)
            continue
        
        size = len(block["content"]) + (2 if current else 0)
        if current and current_size + size > max_size:
            units.append(_unit(text, current, resource_id, source_path, len(units), max_size,
                               overlap_blocks=overlap_blocks if overlap_blocks else None))
            overlap_blocks, overlap_size = _calculate_overlap(current, overlap_chars)
            current = []
            current_size = 0
        current.append(block)
        current_size += size
    
    if current:
        units.append(_unit(text, current, resource_id, source_path, len(units), max_size,
                           overlap_blocks=overlap_blocks if overlap_blocks else None))
    
    # 更新前后引用
    for index, unit in enumerate(units):
        unit["previousChunkId"] = units[index - 1]["chunkId"] if index else None
        unit["nextChunkId"] = units[index + 1]["chunkId"] if index + 1 < len(units) else None
    
    return units


def _calculate_overlap(blocks: list[dict[str, Any]], overlap_chars: int) -> tuple[list[dict[str, Any]], int]:
    """计算 overlap 内容，从块的末尾开始取"""
    if not blocks or overlap_chars <= 0:
        return [], 0
    
    overlap_blocks = []
    overlap_size = 0
    
    # 从后往前取块，直到达到 overlap_chars
    for block in reversed(blocks):
        if overlap_size + len(block["content"]) > overlap_chars:
            # 如果这个块会超过 overlap 限制，截取部分内容
            remaining = overlap_chars - overlap_size
            if remaining > 0:
                partial_block = dict(block)
                partial_block["content"] = block["content"][-remaining:]
                overlap_blocks.insert(0, partial_block)
                overlap_size += remaining
            break
        overlap_blocks.insert(0, block)
        overlap_size += len(block["content"])
        if overlap_size >= overlap_chars:
            break
    
    return overlap_blocks, overlap_size


def _split_code_block(block: dict[str, Any], max_size: int) -> list[dict[str, Any]]:
    """分割代码块，尽量保持行的完整性"""
    lines = block["content"].split('\n')
    chunks = []
    current_lines = []
    current_size = 0
    
    for line in lines:
        line_size = len(line) + 1  # +1 for newline
        if current_size + line_size > max_size and current_lines:
            chunk_content = '\n'.join(current_lines)
            chunk = dict(block)
            chunk["content"] = chunk_content
            chunks.append(chunk)
            current_lines = []
            current_size = 0
        current_lines.append(line)
        current_size += line_size
    
    if current_lines:
        chunk_content = '\n'.join(current_lines)
        chunk = dict(block)
        chunk["content"] = chunk_content
        chunks.append(chunk)
    
    return chunks


def _split_large_block(block: dict[str, Any], max_size: int) -> list[dict[str, Any]]:
    """分割大块，优先在段落边界分割"""
    content = block["content"]
    
    # 尝试在段落边界分割
    paragraphs = re.split(r'\n\n+', content)
    chunks = []
    current_paragraphs = []
    current_size = 0
    
    for para in paragraphs:
        para_size = len(para) + 2  # +2 for \n\n
        if current_size + para_size > max_size and current_paragraphs:
            chunk_content = '\n\n'.join(current_paragraphs)
            chunk = dict(block)
            chunk["content"] = chunk_content
            chunks.append(chunk)
            current_paragraphs = []
            current_size = 0
        
        # 如果单个段落就超过 max_size，按句子分割
        if len(para) > max_size:
            if current_paragraphs:
                chunk_content = '\n\n'.join(current_paragraphs)
                chunk = dict(block)
                chunk["content"] = chunk_content
                chunks.append(chunk)
                current_paragraphs = []
                current_size = 0
            
            # 按句子分割
            sentences = re.split(r'([。！？.!?])', para)
            current_sentence = []
            current_sentence_size = 0
            for i in range(0, len(sentences), 2):
                sentence = sentences[i]
                punctuation = sentences[i+1] if i+1 < len(sentences) else ''
                full_sentence = sentence + punctuation
                sentence_size = len(full_sentence)
                
                if current_sentence_size + sentence_size > max_size and current_sentence:
                    chunk_content = ''.join(current_sentence)
                    chunk = dict(block)
                    chunk["content"] = chunk_content
                    chunks.append(chunk)
                    current_sentence = []
                    current_sentence_size = 0
                
                current_sentence.append(full_sentence)
                current_sentence_size += sentence_size
            
            if current_sentence:
                chunk_content = ''.join(current_sentence)
                chunk = dict(block)
                chunk["content"] = chunk_content
                chunks.append(chunk)
            continue
        
        current_paragraphs.append(para)
        current_size += para_size
    
    if current_paragraphs:
        chunk_content = '\n\n'.join(current_paragraphs)
        chunk = dict(block)
        chunk["content"] = chunk_content
        chunks.append(chunk)
    
    return chunks


def _unit(
    text: str,
    blocks: list[dict[str, Any]],
    resource_id: str,
    source_path: str,
    index: int,
    max_size: int,
    overlap_blocks: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    start = blocks[0]["markdownOffsets"]["start"]
    end = blocks[-1]["markdownOffsets"]["end"]
    content = "\n\n".join(block["content"] for block in blocks)
    
    # 如果有 overlap，在内容前添加 overlap 内容
    overlap_content = ""
    source_chunk_id = None
    if overlap_blocks:
        overlap_content = "\n\n".join(block["content"] for block in overlap_blocks)
        available = max_size - len(content) - 2
        if available > 0:
            overlap_content = overlap_content[-available:]
            source_chunk_id = f"{resource_id}:{index - 1}" if index > 0 else None
            content = overlap_content + "\n\n" + content
    
    heading_path = next(
        (item.get("headingPath") or [] for item in reversed(blocks) if item.get("headingPath")),
        [],
    )
    source_locations: list[dict[str, Any]] = []
    for block in blocks:
        for location in block.get("sourceLocations") or []:
            if location not in source_locations:
                source_locations.append(location)
    return {
        "chunkId": f"{resource_id}:{index}",
        "resourceId": resource_id,
        "sourcePath": source_path,
        "chunkIndex": index,
        "headingPath": heading_path,
        "content": content,
        "contentHash": _hash_text(content),
        "normalizedOffsets": {"start": start, "end": end},
        "sourceLocations": source_locations,
        "overlap": {"enabled": bool(overlap_content and source_chunk_id), "sourceChunkId": source_chunk_id},
    }


def _hash_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()
