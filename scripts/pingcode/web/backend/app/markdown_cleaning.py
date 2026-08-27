from __future__ import annotations

import hashlib
import html
import re
from dataclasses import dataclass
from html.parser import HTMLParser

from .config import runtime_profile


EXCLUDED_PLACEHOLDER_PREFIX = "<!-- processing-excluded:"
_FENCE_OPEN = re.compile(r"^[ \t]{0,3}([`~]{3,})([^\r\n]*)")
_SOURCE_CODE_PATH = re.compile(
    r"\bsrc/[^\s`，。；;：:,)]*?\.(?:c|h|cpp|hpp|cc|cxx|hh)(?::\d+(?:-\d+)?)?\b",
    re.I,
)
_C_LANGUAGES = {
    "c", "c89", "c90", "c99", "c11", "c17", "c23", "gnu-c", "ansi-c",
    "h", "cpp", "c++", "cc", "cxx", "hpp", "h++", "hh", "objc", "objective-c",
}


@dataclass(frozen=True)
class MarkdownCleaningResult:
    content: str
    excluded_ranges: list[dict[str, object]]
    normalization_events: list[dict[str, object]]

    @property
    def processing_content(self) -> str:
        lines = [
            line for line in self.content.splitlines()
            if not line.strip().startswith(EXCLUDED_PLACEHOLDER_PREFIX)
        ]
        return re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()


class _HTMLToMarkdownParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts: list[str] = []
        self._list_depth = 0
        self._table_row: list[str] = []
        self._in_table_cell = False
        self._cell_buffer: list[str] = []
        self._heading_level: int | None = None

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag in {"p", "div", "section", "article", "header", "footer", "blockquote"}:
            self._push_blank()
        elif tag in {"br", "hr"}:
            self.parts.append("\n")
        elif tag in {"ul", "ol"}:
            self._list_depth += 1
            self._push_blank()
        elif tag == "li":
            self.parts.append("\n" + "  " * max(0, self._list_depth - 1) + "- ")
        elif tag in {"table", "thead", "tbody", "tr"}:
            if tag == "tr":
                self._table_row = []
            else:
                self._push_blank()
        elif tag in {"td", "th"}:
            self._in_table_cell = True
            self._cell_buffer = []
        elif tag in {"h1", "h2", "h3", "h4", "h5", "h6"}:
            self._push_blank()
            self._heading_level = int(tag[1])

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag in {"ul", "ol"}:
            self._list_depth = max(0, self._list_depth - 1)
            self._push_blank()
        elif tag == "li":
            self.parts.append("\n")
        elif tag in {"p", "div", "section", "article", "header", "footer", "blockquote"}:
            self._push_blank()
        elif tag in {"td", "th"}:
            self._in_table_cell = False
            cell = _compact_text("".join(self._cell_buffer))
            self._table_row.append(cell)
            self._cell_buffer = []
        elif tag == "tr":
            if self._table_row:
                row = " | ".join(self._table_row)
                self.parts.append(f"\n| {row} |\n")
            self._table_row = []
        elif tag in {"table", "thead", "tbody"}:
            self._push_blank()
        elif tag in {"h1", "h2", "h3", "h4", "h5", "h6"}:
            self._heading_level = None
            self.parts.append("\n")

    def handle_data(self, data):
        text = _compact_text(data)
        if not text:
            return
        if self._in_table_cell:
            self._cell_buffer.append(text)
            return
        if self._heading_level:
            self.parts.append("#" * self._heading_level + " " + text)
        else:
            self.parts.append(text)

    def handle_entityref(self, name):
        self.handle_data(html.unescape(f"&{name};"))

    def handle_charref(self, name):
        self.handle_data(html.unescape(f"&#{name};"))

    def _push_blank(self):
        if self.parts and self.parts[-1] != "\n":
            self.parts.append("\n")


def html_to_markdown(text: str) -> str:
    parser = _HTMLToMarkdownParser()
    parser.feed(text)
    parser.close()
    return re.sub(r"\n{3,}", "\n\n", "".join(parser.parts)).strip()


def _compact_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def clean_markdown(
    text: str,
    preset: str = "training_standard",
    *,
    exclude_c_code_blocks: bool = True,
) -> MarkdownCleaningResult:
    if preset not in {"basic_clean", "training_standard"}:
        raise ValueError(f"不支持的清洗预设：{preset}")
    filtered, excluded = _exclude_c_fences(text) if exclude_c_code_blocks else (text, [])
    normalized = filtered.replace("\ufeff", "").replace("\u200b", "")
    normalized = normalized.replace("\r\n", "\n").replace("\r", "\n")
    normalized = re.sub(r"[ \t]+\n", "\n", normalized)
    normalized, source_events = _remove_source_code_references(normalized)
    if preset == "training_standard":
        normalized = _normalize_training_markdown(normalized)
    normalized = normalized.strip()
    events = list(source_events)
    for item in excluded:
        placeholder = str(item.pop("placeholder"))
        start = normalized.find(placeholder)
        item["normalizedOffsets"] = {
            "start": start,
            "end": start + len(placeholder) if start >= 0 else -1,
        }
        events.append({
            "event": "content_excluded",
            "blockId": item["blockId"],
            "reason": item["reason"],
            "originalOffsets": item["originalOffsets"],
            "normalizedOffsets": item["normalizedOffsets"],
        })
    return MarkdownCleaningResult(normalized, excluded, events)


def _remove_source_code_references(text: str) -> tuple[str, list[dict[str, object]]]:
    lines = text.splitlines(keepends=True)
    output: list[str] = []
    events: list[dict[str, object]] = []
    cursor = 0
    skip_source_section_level: int | None = None
    removed_section_lines = 0
    removed_path_lines = 0

    for line in lines:
        start = cursor
        cursor += len(line)
        stripped = line.strip()
        heading = re.match(r"^(#{1,6})\s+(.+?)\s*$", stripped)
        if skip_source_section_level is not None:
            if heading and len(heading.group(1)) <= skip_source_section_level:
                skip_source_section_level = None
            else:
                removed_section_lines += 1
                continue
        if heading and _is_source_reference_heading(heading.group(2)):
            skip_source_section_level = len(heading.group(1))
            removed_section_lines += 1
            events.append({
                "event": "source_reference_section_removed",
                "reason": f"源码路径清单不进入 {runtime_profile.brand['enterpriseName']} 知识加工视图",
                "originalOffsets": {"start": start, "end": cursor},
            })
            continue
        if _is_source_reference_line(stripped):
            removed_path_lines += 1
            events.append({
                "event": "source_reference_line_removed",
                "reason": f"源码路径标记不进入 {runtime_profile.brand['enterpriseName']} 知识加工视图",
                "originalOffsets": {"start": start, "end": cursor},
            })
            continue
        output.append(line)

    if removed_section_lines or removed_path_lines:
        events.append({
            "event": "source_references_removed",
            "reason": "已从加工视图清理 C/C++ 源码路径标记",
            "removedSectionLines": removed_section_lines,
            "removedPathLines": removed_path_lines,
        })
    return "".join(output), events


def _is_source_reference_heading(title: str) -> bool:
    normalized = title.strip().casefold()
    return normalized in {"相关源文件", "源文件", "source files", "related source files"}


def _is_source_reference_line(stripped: str) -> bool:
    if not stripped or not _SOURCE_CODE_PATH.search(stripped):
        return False
    if re.match(r"^//\s*src/", stripped, re.I):
        return True
    if re.match(r"^(?:位置|文件|源码位置|源文件)\s*[:：]", stripped):
        return True
    if re.match(r"^[-*+]\s+`?src/", stripped, re.I):
        return True
    return False


def _exclude_c_fences(text: str) -> tuple[str, list[dict[str, object]]]:
    lines = text.splitlines(keepends=True)
    offsets = []
    cursor = 0
    for line in lines:
        offsets.append(cursor)
        cursor += len(line)
    output: list[str] = []
    excluded: list[dict[str, object]] = []
    index = 0
    while index < len(lines):
        opening = _FENCE_OPEN.match(lines[index])
        marker = opening.group(1) if opening else ""
        if not opening or len(set(marker)) != 1:
            output.append(lines[index])
            index += 1
            continue
        marker_char = marker[0]
        info = _normalize_language(opening.group(2))
        close_index = _find_closing_fence(lines, index + 1, marker_char, len(marker))
        end_index = close_index if close_index is not None else len(lines) - 1
        block = "".join(lines[index:end_index + 1])
        body = "".join(lines[index + 1:end_index if close_index is not None else end_index + 1])
        detection_method = "language_tag" if info in _C_LANGUAGES else "content_signature" if not info and _looks_like_c(body) else ""
        if not detection_method:
            output.append(block)
            index = end_index + 1
            continue
        block_hash = hashlib.sha256(block.encode("utf-8")).hexdigest()
        block_id = f"c-code:{block_hash[:20]}"
        placeholder = f"{EXCLUDED_PLACEHOLDER_PREFIX}{block_id} -->"
        trailing_newline = "\n" if block.endswith(("\n", "\r")) else ""
        output.append(placeholder + trailing_newline)
        start = offsets[index]
        excluded.append({
            "blockId": block_id,
            "language": info or "c-like",
            "detectionMethod": detection_method,
            "originalOffsets": {"start": start, "end": start + len(block)},
            "contentHash": f"sha256:{block_hash}",
            "reason": f"C/C++ 代码块不进入 {runtime_profile.brand['enterpriseName']} 知识加工视图",
            "closedFence": close_index is not None,
            "placeholder": placeholder,
        })
        index = end_index + 1
    return "".join(output), excluded


def _find_closing_fence(lines: list[str], start: int, marker_char: str, minimum: int) -> int | None:
    for index in range(start, len(lines)):
        stripped = lines[index].strip()
        if len(stripped) >= minimum and set(stripped) == {marker_char}:
            return index
    return None


def _normalize_language(info: str) -> str:
    value = info.strip().split(maxsplit=1)[0] if info.strip() else ""
    value = value.strip("{}")
    if value.startswith("."):
        value = value[1:]
    return value.casefold()


def _looks_like_c(body: str) -> bool:
    if re.search(r"(?m)^\s*#\s*include\s*[<\"]", body):
        return True
    if re.search(r"\b(?:int|void)\s+main\s*\(", body):
        return True
    signals = (
        bool(re.search(r"\b(?:printf|scanf|malloc|calloc|realloc|free)\s*\(", body)),
        bool(re.search(r"\b(?:typedef\s+)?struct\s+[A-Za-z_]", body)),
        bool(re.search(r"\b(?:char|short|int|long|float|double|size_t)\s+\**[A-Za-z_]\w*\s*(?:[=;,\[])", body)),
        "{" in body and "}" in body,
        body.count(";") >= 2,
    )
    return sum(signals) >= 3


def _normalize_training_markdown(text: str) -> str:
    lines = text.split("\n")
    normalized: list[str] = []
    fence_marker = ""
    blank_count = 0
    for line in lines:
        fence = re.match(r"^\s*(`{3,}|~{3,})", line)
        if fence:
            marker = fence.group(1)[0]
            fence_marker = "" if fence_marker == marker else marker
            normalized.append(line)
            blank_count = 0
            continue
        if fence_marker:
            normalized.append(line)
            continue
        line = line.replace("\u00a0", " ")
        line = re.sub(r"^(#{1,6})[ \t]*(?=\S)", r"\1 ", line)
        if not line:
            blank_count += 1
            if blank_count > 1:
                continue
        else:
            blank_count = 0
        normalized.append(line)
    return "\n".join(normalized)
