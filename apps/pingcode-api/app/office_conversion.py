"""Office 文档转换工具。"""

from __future__ import annotations

import base64
import mimetypes
import posixpath
import re
import subprocess
import zipfile
from dataclasses import dataclass, field
from pathlib import Path, PurePosixPath
from typing import Any
from xml.etree import ElementTree

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
REL = "{http://schemas.openxmlformats.org/package/2006/relationships}"


@dataclass
class OfficeConversionResult:
    markdown: str
    converter_id: str
    asset_paths: list[str] = field(default_factory=list)
    image_count: int = 0
    preserved_image_count: int = 0
    conversion_profile: str = "office_pdf_markdown_v1"
    assets: list[dict[str, Any]] = field(default_factory=list)

    @classmethod
    def from_legacy(cls, value: Any) -> "OfficeConversionResult":
        if isinstance(value, OfficeConversionResult):
            return value
        if isinstance(value, tuple) and len(value) >= 2:
            return cls(markdown=str(value[0]), converter_id=str(value[1]))
        raise TypeError("Office 转换结果格式无效")


def convert_office_to_markdown(
    path: Path,
    temp_root: Path,
    *,
    asset_root: Path | None = None,
    markdown_asset_prefix: str | None = None,
    asset_relative_root: str | None = None,
    inline_preview_assets: bool = False,
) -> OfficeConversionResult:
    if path.suffix.lower() == ".docx" and zipfile.is_zipfile(path):
        result = _convert_docx(
            path,
            asset_root=asset_root or (temp_root / "assets" / _safe_stem(path.stem)),
            markdown_asset_prefix=markdown_asset_prefix,
            asset_relative_root=asset_relative_root,
            inline_preview_assets=inline_preview_assets,
        )
        if result.markdown.strip() or result.preserved_image_count:
            return result
    return _convert_office_with_libreoffice(path, temp_root)


def _convert_office_with_libreoffice(path: Path, temp_root: Path) -> OfficeConversionResult:
    temp_root.mkdir(parents=True, exist_ok=True)
    try:
        result = subprocess.run(
            ["libreoffice", "--headless", "--convert-to", "txt:Text", "--outdir", str(temp_root), str(path)],
            capture_output=True,
            text=True,
            timeout=120,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise ValueError("Office 文档转换超时") from exc
    output = temp_root / f"{path.stem}.txt"
    if result.returncode != 0 or not output.exists():
        reason = (result.stderr or result.stdout or "Office 文档转换失败").strip()[:500]
        raise ValueError(reason)
    return OfficeConversionResult(
        markdown=output.read_text(encoding="utf-8", errors="replace"),
        converter_id="libreoffice",
    )


def _convert_docx(
    path: Path,
    *,
    asset_root: Path,
    markdown_asset_prefix: str | None,
    asset_relative_root: str | None,
    inline_preview_assets: bool,
) -> OfficeConversionResult:
    with zipfile.ZipFile(path) as archive:
        document_xml = archive.read("word/document.xml")
        relationships = _read_relationships(archive)
        image_targets = [target for target in relationships.values() if target.startswith("word/media/")]
        asset_root.mkdir(parents=True, exist_ok=True)
        root = ElementTree.fromstring(document_xml)
        blocks: list[str] = []
        assets: list[dict[str, Any]] = []
        copied: dict[str, dict[str, str]] = {}

        def preserve_image(relationship_id: str) -> str | None:
            target = relationships.get(relationship_id)
            if not target or target not in archive.namelist():
                return None
            if target not in copied:
                name = _safe_filename(PurePosixPath(target).name or "image")
                output = _deduplicated_path(asset_root / name)
                output.write_bytes(archive.read(target))
                markdown_path = f"{(markdown_asset_prefix or asset_root.name).rstrip('/')}/{output.name}"
                relative_path = (
                    f"{asset_relative_root.rstrip('/')}/{output.name}"
                    if asset_relative_root
                    else output.as_posix()
                )
                mime_type = mimetypes.guess_type(output.name)[0] or "application/octet-stream"
                data_url = None
                if inline_preview_assets:
                    data_url = f"data:{mime_type};base64,{base64.b64encode(output.read_bytes()).decode('ascii')}"
                copied[target] = {
                    "markdownPath": markdown_path,
                    "relativePath": relative_path,
                    "path": str(output),
                    "mimeType": mime_type,
                    **({"dataUrl": data_url} if data_url else {}),
                }
                assets.append(copied[target])
            return copied[target]["markdownPath"]

        body = root.find(f"{W}body")
        for element in list(body) if body is not None else []:
            if element.tag == f"{W}p":
                text = _paragraph_text(element)
                image_lines = []
                for blip in element.findall(f".//{A}blip"):
                    relationship_id = blip.attrib.get(f"{R}embed")
                    if not relationship_id:
                        continue
                    markdown_path = preserve_image(relationship_id)
                    if markdown_path:
                        image_lines.append(f"![DOCX 图片]({markdown_path})")
                block = "\n\n".join([item for item in (text, *image_lines) if item])
                if block:
                    blocks.append(_heading_prefix(element) + block)
            elif element.tag == f"{W}tbl":
                table = _table_markdown(element)
                if table:
                    blocks.append(table)

    return OfficeConversionResult(
        markdown="\n\n".join(blocks).strip(),
        converter_id="docx-ooxml",
        asset_paths=[item["relativePath"] for item in assets],
        image_count=len(image_targets),
        preserved_image_count=len(assets),
        assets=assets,
    )


def _read_relationships(archive: zipfile.ZipFile) -> dict[str, str]:
    try:
        rels = ElementTree.fromstring(archive.read("word/_rels/document.xml.rels"))
    except KeyError:
        return {}
    result: dict[str, str] = {}
    for item in rels.findall(f"{REL}Relationship"):
        relationship_id = item.attrib.get("Id")
        target = item.attrib.get("Target")
        if not relationship_id or not target:
            continue
        if target.startswith("/"):
            normalized = posixpath.normpath(target.lstrip("/"))
        else:
            normalized = posixpath.normpath(f"word/{target}")
        if not normalized.startswith("../"):
            result[relationship_id] = normalized
    return result


def _paragraph_text(element: ElementTree.Element) -> str:
    return "".join(text.text or "" for text in element.findall(f".//{W}t")).strip()


def _heading_prefix(element: ElementTree.Element) -> str:
    style = element.find(f"{W}pPr/{W}pStyle")
    value = style.attrib.get(f"{W}val", "") if style is not None else ""
    match = re.search(r"(?:Heading|标题)\s*([1-6])", value, re.I)
    if not match:
        return ""
    return "#" * int(match.group(1)) + " "


def _table_markdown(element: ElementTree.Element) -> str:
    rows: list[list[str]] = []
    for row in element.findall(f"{W}tr"):
        cells = []
        for cell in row.findall(f"{W}tc"):
            cells.append(" ".join(_paragraph_text(paragraph) for paragraph in cell.findall(f"{W}p")).strip())
        if any(cells):
            rows.append(cells)
    if not rows:
        return ""
    width = max(len(row) for row in rows)
    normalized = [row + [""] * (width - len(row)) for row in rows]
    header = normalized[0]
    separator = ["---"] * width
    body = normalized[1:]
    lines = [
        "| " + " | ".join(header) + " |",
        "| " + " | ".join(separator) + " |",
    ]
    lines.extend("| " + " | ".join(row) + " |" for row in body)
    return "\n".join(lines)


def _safe_stem(value: str) -> str:
    return re.sub(r"[^0-9A-Za-z._-]+", "_", value).strip("._-") or "office"


def _safe_filename(value: str) -> str:
    stem = _safe_stem(Path(value).stem)
    suffix = Path(value).suffix.lower() or ".bin"
    return f"{stem}{suffix}"


def _deduplicated_path(path: Path) -> Path:
    if not path.exists():
        return path
    for index in range(2, 1000):
        candidate = path.with_name(f"{path.stem}_{index}{path.suffix}")
        if not candidate.exists():
            return candidate
    raise ValueError("DOCX 图片文件重名过多")
