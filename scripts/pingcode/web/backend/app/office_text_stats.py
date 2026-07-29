"""轻量 Office OOXML 文本统计工具。"""

from __future__ import annotations

import re
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from xml.etree import ElementTree

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
MAIN = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"


@dataclass
class OfficeTextStats:
    character_count: int | None = None
    paragraph_count: int | None = None
    table_count: int | None = None
    heading_hint_count: int | None = None
    worksheet_count: int | None = None
    slide_count: int | None = None
    source: str = ""
    diagnostics: dict[str, str] = field(default_factory=dict)


def visible_character_count(text: str) -> int:
    return len(re.sub(r"[\s\u200b\u200c\u200d\ufeff]+", "", text or ""))


def collect_ooxml_text_stats(path: Path) -> OfficeTextStats:
    suffix = path.suffix.lower()
    if suffix == ".docx":
        return _collect_docx_stats(path)
    if suffix == ".pptx":
        return _collect_pptx_stats(path)
    if suffix == ".xlsx":
        return _collect_xlsx_stats(path)
    return OfficeTextStats(source="unsupported_ooxml", diagnostics={"characterCount": "旧版 Office 格式未接入轻量字符统计"})


def _collect_docx_stats(path: Path) -> OfficeTextStats:
    text_parts: list[str] = []
    paragraph_count = 0
    table_count = 0
    heading_count = 0
    with zipfile.ZipFile(path) as archive:
        names = set(archive.namelist())
        if "word/document.xml" not in names:
            raise KeyError("word/document.xml")
        document_root = _read_xml(archive, "word/document.xml")
        paragraph_count = len(document_root.findall(".//" + W + "p"))
        table_count = len(document_root.findall(".//" + W + "tbl"))
        heading_count = _heading_count(document_root)
        text_parts.extend(_visible_word_texts(document_root))
        extra_parts = [
            name
            for name in names
            if re.match(r"word/(header|footer|footnotes|endnotes|comments)\d*\.xml$", name)
        ]
        for name in sorted(extra_parts):
            text_parts.extend(_visible_word_texts(_read_xml(archive, name)))
    return OfficeTextStats(
        character_count=visible_character_count("".join(text_parts)),
        paragraph_count=paragraph_count,
        table_count=table_count,
        heading_hint_count=heading_count,
        source="docx_ooxml_visible_text",
        diagnostics={"characterCount": "按 DOCX OOXML 可见文本统计"},
    )


def _collect_pptx_stats(path: Path) -> OfficeTextStats:
    text_parts: list[str] = []
    with zipfile.ZipFile(path) as archive:
        slide_names = sorted(
            name
            for name in archive.namelist()
            if re.match(r"ppt/slides/slide\d+\.xml$", name)
        )
        for name in slide_names:
            root = _read_xml(archive, name)
            text_parts.extend(node.text or "" for node in root.findall(".//" + A + "t"))
    return OfficeTextStats(
        character_count=visible_character_count("".join(text_parts)),
        slide_count=len(slide_names),
        source="pptx_ooxml_visible_text",
        diagnostics={"characterCount": "按 PPTX 幻灯片 OOXML 可见文本统计"},
    )


def _collect_xlsx_stats(path: Path) -> OfficeTextStats:
    text_parts: list[str] = []
    with zipfile.ZipFile(path) as archive:
        names = set(archive.namelist())
        shared_strings = _shared_strings(archive) if "xl/sharedStrings.xml" in names else []
        sheet_names = sorted(
            name
            for name in names
            if re.match(r"xl/worksheets/sheet\d+\.xml$", name)
        )
        for name in sheet_names:
            root = _read_xml(archive, name)
            for cell in root.findall(".//" + MAIN + "c"):
                cell_type = cell.attrib.get("t")
                if cell_type == "s":
                    value_node = cell.find(MAIN + "v")
                    if value_node is None or value_node.text is None:
                        continue
                    try:
                        text_parts.append(shared_strings[int(value_node.text)])
                    except (ValueError, IndexError):
                        continue
                elif cell_type in {"inlineStr", "str"}:
                    text_parts.extend(node.text or "" for node in cell.findall(".//" + MAIN + "t"))
                elif cell_type == "b":
                    value_node = cell.find(MAIN + "v")
                    if value_node is not None and value_node.text is not None:
                        text_parts.append(value_node.text)
                else:
                    value_node = cell.find(MAIN + "v")
                    if value_node is not None and value_node.text is not None:
                        text_parts.append(value_node.text)
    return OfficeTextStats(
        character_count=visible_character_count("".join(text_parts)),
        worksheet_count=len(sheet_names),
        source="xlsx_ooxml_visible_text",
        diagnostics={"characterCount": "按 XLSX 单元格 OOXML 可见文本统计"},
    )


def _read_xml(archive: zipfile.ZipFile, name: str) -> ElementTree.Element:
    return ElementTree.fromstring(archive.read(name))


def _visible_word_texts(root: ElementTree.Element) -> list[str]:
    result: list[str] = []
    deleted_ancestors = {node for node in root.findall(".//" + W + "del")}
    for text_node in root.findall(".//" + W + "t"):
        if any(text_node in deleted.iter() for deleted in deleted_ancestors):
            continue
        result.append(text_node.text or "")
    return result


def _heading_count(root: ElementTree.Element) -> int:
    return sum(
        1
        for node in root.findall(".//" + W + "pStyle")
        if re.search(r"Heading[1-6]|标题\s*[1-6]", node.attrib.get(W + "val", ""), re.I)
    )


def _shared_strings(archive: zipfile.ZipFile) -> list[str]:
    root = _read_xml(archive, "xl/sharedStrings.xml")
    return ["".join(node.text or "" for node in item.findall(".//" + MAIN + "t")) for item in root.findall(MAIN + "si")]
