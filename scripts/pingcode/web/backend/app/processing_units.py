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
    units: list[dict[str, Any]] = []
    current: list[dict[str, Any]] = []
    current_size = 0
    for block in blocks:
        if block["blockType"] == "excluded":
            if current:
                units.append(_unit(text, current, resource_id, source_path, len(units)))
                current = []
                current_size = 0
            continue
        if len(block["content"]) > max_size:
            if current:
                units.append(_unit(text, current, resource_id, source_path, len(units)))
                current = []
                current_size = 0
            for start in range(0, len(block["content"]), max_size):
                piece = dict(block)
                piece["content"] = block["content"][start:start + max_size]
                piece["markdownOffsets"] = {
                    "start": block["markdownOffsets"]["start"] + start,
                    "end": block["markdownOffsets"]["start"] + min(start + max_size, len(block["content"])),
                }
                units.append(_unit(text, [piece], resource_id, source_path, len(units)))
            continue
        size = len(block["content"]) + (2 if current else 0)
        if current and current_size + size > max_size:
            units.append(_unit(text, current, resource_id, source_path, len(units)))
            current = []
            current_size = 0
        current.append(block)
        current_size += size
    if current:
        units.append(_unit(text, current, resource_id, source_path, len(units)))
    for index, unit in enumerate(units):
        unit["previousChunkId"] = units[index - 1]["chunkId"] if index else None
        unit["nextChunkId"] = units[index + 1]["chunkId"] if index + 1 < len(units) else None
    return units


def _unit(
    text: str,
    blocks: list[dict[str, Any]],
    resource_id: str,
    source_path: str,
    index: int,
) -> dict[str, Any]:
    start = blocks[0]["markdownOffsets"]["start"]
    end = blocks[-1]["markdownOffsets"]["end"]
    content = text[start:end]
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
        "overlap": {"enabled": False, "sourceChunkId": None},
    }


def _hash_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()
