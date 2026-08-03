"""P4 素材准备处理：格式识别、归档安全处理和资源登记。"""

from __future__ import annotations

import hashlib
import json
import mimetypes
import re
import shutil
import subprocess
import stat
import tarfile
import uuid
import zipfile
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any, BinaryIO

from .config import settings
from .ingestion.contracts import FormatDetection, FormatDetector
from .models import PreparationIssue, PreparationReport
from .office_conversion import OfficeConversionResult, convert_office_to_markdown
from .services import BatchService, FileService, utcnow
from .markdown_cleaning import clean_markdown, html_to_markdown
from .processing_units import build_processing_units


class PreparationServiceError(ValueError):
    pass


@dataclass(frozen=True)
class ArchiveLimits:
    max_files: int
    max_bytes: int
    max_depth: int
    max_expansion_ratio: float


@dataclass
class _PreparationRun:
    batch_id: str
    run_id: str
    root: Path
    event_log: Path
    parent_task_id: str | None = None
    stage_run_id: str | None = None
    resources: list[dict[str, Any]] = field(default_factory=list)
    issues: list[dict[str, Any]] = field(default_factory=list)
    extracted_resources: int = 0
    extracted_bytes: int = 0
    image_resources: int = 0
    archive_resources: int = 0
    processable_resources: int = 0
    conversion_pending_resources: int = 0
    quarantined_resources: int = 0
    security_issue_count: int = 0
    source_documents: list[dict[str, Any]] = field(default_factory=list)
    chunks: list[dict[str, Any]] = field(default_factory=list)
    structure_blocks: list[dict[str, Any]] = field(default_factory=list)
    started_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class DefaultFormatDetector:
    """按扩展名和文件头识别格式族。"""

    TEXT_SUFFIXES = {
        ".c",
        ".cc",
        ".cpp",
        ".csv",
        ".go",
        ".h",
        ".hpp",
        ".java",
        ".js",
        ".json",
        ".log",
        ".md",
        ".py",
        ".rst",
        ".sql",
        ".text",
        ".toml",
        ".ts",
        ".txt",
        ".xml",
        ".yaml",
        ".yml",
    }
    WEB_SUFFIXES = {".html", ".htm", ".xhtml"}
    PDF_SUFFIXES = {".pdf"}
    OFFICE_SUFFIXES = {
        ".doc",
        ".docx",
        ".ppt",
        ".pptx",
        ".xls",
        ".xlsx",
        ".odg",
        ".ods",
        ".odp",
    }
    ARCHIVE_SUFFIXES = (
        ".tar.gz",
        ".tar.bz2",
        ".tar.xz",
        ".tgz",
        ".tbz2",
        ".txz",
        ".zip",
        ".tar",
    )
    IMAGE_SUFFIXES = {
        ".avif",
        ".bmp",
        ".gif",
        ".ico",
        ".jpeg",
        ".jpg",
        ".png",
        ".svg",
        ".tif",
        ".tiff",
        ".webp",
    }
    HIGH_RISK_SUFFIXES = {
        ".bat",
        ".cmd",
        ".com",
        ".dll",
        ".dylib",
        ".exe",
        ".msi",
        ".ps1",
        ".scr",
        ".so",
    }

    def detect(self, path: Path, media_type: str | None = None) -> FormatDetection:
        name = path.name.casefold()
        detected_media_type = media_type or mimetypes.guess_type(path.name)[0]
        header = self._header(path)
        if path.suffix.casefold() in self.HIGH_RISK_SUFFIXES or header.startswith((b"MZ", b"\x7fELF")):
            return FormatDetection(
                "unknown",
                detected_media_type,
                "quarantined",
                "可执行文件或高风险脚本只登记，不进入加工流程",
            )
        if any(name.endswith(suffix) for suffix in self.ARCHIVE_SUFFIXES):
            return FormatDetection("archive", detected_media_type, "archive")
        if path.suffix.casefold() in self.OFFICE_SUFFIXES:
            return FormatDetection("office", detected_media_type, "processable")
        if path.suffix.casefold() in self.PDF_SUFFIXES:
            return FormatDetection("pdf", detected_media_type, "processable")
        if path.suffix.casefold() in self.WEB_SUFFIXES:
            return FormatDetection("web", detected_media_type, "processable")
        if path.suffix.casefold() in self.TEXT_SUFFIXES:
            return FormatDetection("text", detected_media_type, "processable")
        if path.suffix.casefold() in self.IMAGE_SUFFIXES:
            return FormatDetection("image", detected_media_type, "asset")

        if header.startswith(b"%PDF-"):
            return FormatDetection("pdf", detected_media_type or "application/pdf", "processable")
        if header.startswith(b"PK\x03\x04"):
            return FormatDetection("archive", detected_media_type or "application/zip", "archive")
        if header.startswith(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"):
            return FormatDetection("office", detected_media_type, "processable")
        if header.startswith((b"\x89PNG\r\n\x1a\n", b"GIF87a", b"GIF89a", b"\xff\xd8\xff")):
            return FormatDetection("image", detected_media_type, "asset")
        return FormatDetection(
            "unknown",
            detected_media_type,
            "conversion_pending",
            "未识别的文件格式",
        )

    @staticmethod
    def _header(path: Path) -> bytes:
        try:
            with path.open("rb") as source:
                return source.read(16)
        except OSError:
            return b""


class _ArchiveLimitError(Exception):
    pass


class MaterialPreparationService:
    """为批次创建独立的、可重复执行的 P4 准备处理运行。"""

    PIPELINE_VERSION = "material-preparation-v2"

    def __init__(
        self,
        batches: BatchService,
        files: FileService,
        detector: FormatDetector | None = None,
        limits: ArchiveLimits | None = None,
    ):
        self.batches = batches
        self.files = files
        self.detector = detector or DefaultFormatDetector()
        self.limits = limits or ArchiveLimits(
            max_files=settings.preparation_max_archive_files,
            max_bytes=settings.preparation_max_archive_bytes,
            max_depth=settings.preparation_max_archive_depth,
            max_expansion_ratio=settings.preparation_max_expansion_ratio,
        )

    def prepare(
        self,
        batch_id: str,
        config: Any | None = None,
        parent_task_id: str | None = None,
        stage_run_id: str | None = None,
    ) -> PreparationReport:
        from .models import PreprocessConfig
        config = config or PreprocessConfig()
        if config.enable_ocr:
            raise PreparationServiceError("当前版本不支持自动 OCR，请将 enableOcr 设置为 false")
        self.batches.get(batch_id)
        raw_records = [
            item
            for item in self.files.records(batch_id)
            if item.get("kind") != "error"
            and item.get("logicalPath")
            and item.get("processingStage") != "p4"
        ]
        input_snapshot = self._input_snapshot(raw_records)
        input_manifest_hash = self._hash_json(input_snapshot)
        run_id = f"prep_{uuid.uuid4().hex[:16]}"
        batch_root = self.files.manifest_path(batch_id).parent
        run_root = batch_root / "preparation" / "runs" / run_id
        run_root.mkdir(parents=True, exist_ok=True)
        event_log = run_root / "events.jsonl"
        run = _PreparationRun(
            batch_id,
            run_id,
            run_root,
            event_log,
            parent_task_id=parent_task_id,
            stage_run_id=stage_run_id,
        )
        self._emit(run, "run_started", inputManifestHash=input_manifest_hash)

        for item in raw_records:
            self._process_original(run, item, config)

        state = "completed_with_warnings" if run.issues else "completed"
        manifest = {
            "schemaVersion": "1.0",
            "pipelineVersion": self.PIPELINE_VERSION,
            "batchId": batch_id,
            "runId": run_id,
            "taskId": parent_task_id,
            "stageRunId": stage_run_id,
            "createdAt": utcnow().isoformat(),
            "inputManifestHash": input_manifest_hash,
            "state": state,
            "limits": {
                "maxFiles": self.limits.max_files,
                "maxBytes": self.limits.max_bytes,
                "maxDepth": self.limits.max_depth,
                "maxExpansionRatio": self.limits.max_expansion_ratio,
            },
            "resources": run.resources,
            "issues": run.issues,
            "metrics": {
                "totalResources": len(run.resources),
                "processableResources": run.processable_resources,
                "archiveResources": run.archive_resources,
                "extractedResources": run.extracted_resources,
                "imageResources": run.image_resources,
                "conversionPendingResources": run.conversion_pending_resources,
                "quarantinedResources": run.quarantined_resources,
                "securityIssueCount": run.security_issue_count,
            },
            "eventLogPath": self._relative(event_log),
        }
        manifest_path = run_root / "manifest.json"
        self._write_json(manifest_path, manifest)
        source_resources = self._source_resource_records(run)
        source_assets = self._source_asset_records(run)
        ingestion_report = self._ingestion_report(run, source_resources, source_assets, input_manifest_hash, state)
        self._write_jsonl(run_root / "metadata" / "source-resources.jsonl", source_resources)
        self._write_jsonl(run_root / "metadata" / "source-assets.jsonl", source_assets)
        self._write_json(run_root / "metadata" / "ingestion-report.json", ingestion_report)
        self._write_jsonl(run_root / "metadata" / "source-documents.jsonl", run.source_documents)
        self._write_jsonl(run_root / "metadata" / "chunks.jsonl", run.chunks)
        self._write_jsonl(run_root / "metadata" / "structure-blocks.jsonl", run.structure_blocks)
        self._write_json(run_root / "quality" / "preparation-issues.json", run.issues)
        artifact_paths = [
            "metadata/source-resources.jsonl",
            "metadata/source-assets.jsonl",
            "metadata/ingestion-report.json",
            "metadata/source-documents.jsonl",
            "metadata/chunks.jsonl",
            "metadata/structure-blocks.jsonl",
            "quality/preparation-issues.json",
        ]
        stage_result = {
            "stage": "material_preparation",
            "state": state,
            "inputCount": len(raw_records),
            "outputCount": len(run.source_documents),
            "failedCount": 0,
            "skippedCount": len(raw_records) - len(run.source_documents),
            "startedAt": run.started_at.isoformat(),
            "completedAt": utcnow().isoformat(),
            "message": f"资料预处理完成：{len(run.source_documents)} 个资源可进入下一步，{len(run.issues)} 个质量问题。",
            "artifacts": artifact_paths,
            "metrics": {
                "processingUnits": len(run.chunks),
                "isolatedResources": run.quarantined_resources,
                "sourceResources": len(source_resources),
                "sourceAssets": len(source_assets),
            },
        }
        self._write_json(run_root / "stage-result.json", stage_result)
        latest_path = batch_root / "preparation" / "latest.json"
        self._write_json(
            latest_path,
            {
                "runId": run_id,
                "manifestPath": self._relative(manifest_path),
                "inputManifestHash": input_manifest_hash,
                "updatedAt": utcnow().isoformat(),
            },
        )
        self._emit(run, "run_finished", state=state, metrics=manifest["metrics"])
        return PreparationReport(
            batch_id=batch_id,
            run_id=run_id,
            state=state,
            input_manifest_hash=input_manifest_hash,
            manifest_path=self._relative(manifest_path),
            event_log_path=self._relative(event_log),
            total_resources=len(run.resources),
            processable_resources=run.processable_resources,
            archive_resources=run.archive_resources,
            extracted_resources=run.extracted_resources,
            image_resources=run.image_resources,
            conversion_pending_resources=run.conversion_pending_resources,
            quarantined_resources=run.quarantined_resources,
            security_issue_count=run.security_issue_count,
            issues=[PreparationIssue.model_validate(item) for item in run.issues],
            created_at=datetime.now(timezone.utc),
            stage_result_path=self._relative(run_root / "stage-result.json"),
            artifact_paths=[self._relative(run_root / path) for path in artifact_paths],
        )

    def _source_resource_records(self, run: _PreparationRun) -> list[dict[str, Any]]:
        issues_by_resource: dict[str, list[str]] = {}
        for issue in run.issues:
            resource_id = str(issue.get("resourceId") or "")
            if resource_id:
                issues_by_resource.setdefault(resource_id, []).append(str(issue.get("code") or ""))
        documents_by_resource = {str(item.get("resourceId") or ""): item for item in run.source_documents}
        records: list[dict[str, Any]] = []
        for resource in run.resources:
            resource_id = str(resource.get("id") or "")
            document = documents_by_resource.get(resource_id, {})
            records.append({
                "resourceId": resource_id,
                "batchId": run.batch_id,
                "sourceResourceId": resource.get("sourceResourceId"),
                "parentResourceId": resource.get("parentResourceId"),
                "sourcePath": resource.get("logicalPath"),
                "displayName": resource.get("name"),
                "sourceType": resource.get("sourceType"),
                "mediaType": resource.get("mediaType"),
                "formatFamily": resource.get("formatFamily"),
                "kind": resource.get("kind"),
                "size": resource.get("size"),
                "contentHash": f"sha256:{resource.get('sha256')}",
                "processingState": resource.get("processingStatus"),
                "isExtracted": bool(resource.get("isExtracted")),
                "extractionDepth": resource.get("extractionDepth"),
                "originalArtifact": resource.get("originalArtifact"),
                "normalizedArtifact": document.get("normalizedArtifact") or resource.get("normalizedArtifact"),
                "assetPaths": document.get("assetPaths") or resource.get("assetPaths") or [],
                "issueCodes": issues_by_resource.get(resource_id, []),
            })
        return records

    def _source_asset_records(self, run: _PreparationRun) -> list[dict[str, Any]]:
        records: list[dict[str, Any]] = []
        for resource in run.resources:
            resource_id = str(resource.get("id") or "")
            if resource.get("formatFamily") == "image":
                records.append({
                    "assetId": resource_id,
                    "resourceId": resource_id,
                    "sourceResourceId": resource.get("sourceResourceId"),
                    "parentResourceId": resource.get("parentResourceId"),
                    "sourcePath": resource.get("logicalPath"),
                    "displayName": resource.get("name"),
                    "mediaType": resource.get("mediaType"),
                    "size": resource.get("size"),
                    "contentHash": f"sha256:{resource.get('sha256')}",
                    "artifactPath": resource.get("originalArtifact"),
                    "assetKind": "image_resource",
                    "processingState": resource.get("processingStatus"),
                })
            for index, asset_path in enumerate(resource.get("assetPaths") or []):
                records.append({
                    "assetId": f"{resource_id}:asset:{index}",
                    "resourceId": resource_id,
                    "sourceResourceId": resource.get("sourceResourceId"),
                    "parentResourceId": resource.get("parentResourceId"),
                    "sourcePath": resource.get("logicalPath"),
                    "displayName": Path(str(asset_path)).name,
                    "mediaType": mimetypes.guess_type(str(asset_path))[0] or "application/octet-stream",
                    "size": None,
                    "contentHash": None,
                    "artifactPath": asset_path,
                    "assetKind": "embedded_asset",
                    "processingState": resource.get("processingStatus"),
                })
        return records

    def _ingestion_report(
        self,
        run: _PreparationRun,
        source_resources: list[dict[str, Any]],
        source_assets: list[dict[str, Any]],
        input_manifest_hash: str,
        state: str,
    ) -> dict[str, Any]:
        states: dict[str, int] = {}
        families: dict[str, int] = {}
        for resource in source_resources:
            states[str(resource.get("processingState") or "unknown")] = states.get(str(resource.get("processingState") or "unknown"), 0) + 1
            families[str(resource.get("formatFamily") or "unknown")] = families.get(str(resource.get("formatFamily") or "unknown"), 0) + 1
        return {
            "schemaVersion": "1.0",
            "batchId": run.batch_id,
            "runId": run.run_id,
            "state": state,
            "inputManifestHash": input_manifest_hash,
            "createdAt": utcnow().isoformat(),
            "resourceCount": len(source_resources),
            "documentCount": len(run.source_documents),
            "processingUnitCount": len(run.chunks),
            "assetCount": len(source_assets),
            "issueCount": len(run.issues),
            "stateCounts": states,
            "formatFamilyCounts": families,
            "artifacts": [
                "metadata/source-resources.jsonl",
                "metadata/source-assets.jsonl",
                "metadata/source-documents.jsonl",
                "metadata/chunks.jsonl",
                "metadata/structure-blocks.jsonl",
                "quality/preparation-issues.json",
            ],
        }

    def _process_original(self, run: _PreparationRun, item: dict[str, Any], config: Any) -> None:
        resource_id = str(item.get("id") or self._stable_id(run.batch_id, item["logicalPath"], ""))
        try:
            path = self._resolve_resource(item["logicalPath"])
        except FileNotFoundError:
            self._issue(
                run,
                "SECURITY_INVALID_RESOURCE_PATH",
                "error",
                resource_id=resource_id,
                file_name=str(item.get("name") or item["logicalPath"]),
                message="资源路径越过数据根目录",
            )
            return
        self._process_file(
            run,
            path,
            resource_id=resource_id,
            source_resource_id=resource_id,
            parent_resource_id=None,
            depth=0,
            display_name=str(item.get("name") or path.name),
            source_record=item,
            is_extracted=False,
            config=config,
        )

    def _process_file(
        self,
        run: _PreparationRun,
        path: Path,
        *,
        resource_id: str,
        source_resource_id: str,
        parent_resource_id: str | None,
        depth: int,
        display_name: str,
        source_record: dict[str, Any] | None,
        is_extracted: bool,
        config: Any | None = None,
    ) -> dict[str, Any] | None:
        if not path.exists() or not path.is_file():
            self._issue(
                run,
                "MISSING_RESOURCE",
                "error",
                resource_id=resource_id,
                file_name=display_name,
                message="资源文件不存在或不是普通文件",
            )
            return None
        if path.is_symlink():
            self._issue(
                run,
                "SECURITY_SYMLINK_RESOURCE",
                "error",
                resource_id=resource_id,
                file_name=display_name,
                message="资源是符号链接，已隔离且未继续处理",
            )
            return None

        try:
            digest = self._hash_file(path)
        except OSError as exc:
            self._issue(
                run,
                "RESOURCE_READ_FAILED",
                "error",
                resource_id=resource_id,
                file_name=display_name,
                message=str(exc),
            )
            return None
        media_type = (source_record or {}).get("mediaType")
        detection = self.detector.detect(path, media_type)
        artifact = self._register(
            run,
            path,
            resource_id=resource_id,
            source_resource_id=source_resource_id,
            parent_resource_id=parent_resource_id,
            depth=depth,
            display_name=display_name,
            digest=digest,
            detection=detection,
            source_record=source_record,
            is_extracted=is_extracted,
        )
        if detection.format_family == "archive":
            run.archive_resources += 1
            if depth >= self.limits.max_depth:
                self._quarantine(
                    run,
                    artifact,
                    "ARCHIVE_MAX_DEPTH",
                    "归档递归深度超过限制",
                )
                return artifact
            self._extract_archive(run, path, artifact, depth, config)
        elif detection.format_family == "image":
            run.image_resources += 1
        elif detection.processing_status == "processable":
            run.processable_resources += 1
            self._prepare_document(run, path, artifact, config)
        elif detection.processing_status == "conversion_pending":
            run.conversion_pending_resources += 1
        elif detection.processing_status == "quarantined":
            run.quarantined_resources += 1
            self._issue(
                run,
                "SECURITY_HIGH_RISK_FILE",
                "error",
                resource_id=artifact["id"],
                file_name=artifact["name"],
                message=detection.reason or "高风险文件已隔离",
            )
        return artifact

    def _prepare_document(self, run: _PreparationRun, path: Path, artifact: dict[str, Any], config: Any) -> None:
        try:
            if artifact["formatFamily"] == "text":
                text = path.read_text(encoding="utf-8", errors="strict")
                converter = "text-reader"
            elif artifact["formatFamily"] == "web":
                text = html_to_markdown(path.read_text(encoding="utf-8", errors="replace"))
                converter = "html-parser"
            elif artifact["formatFamily"] == "pdf":
                text, converter = self._convert_pdf(path)
            elif artifact["formatFamily"] == "office":
                conversion = self._convert_office(
                    path,
                    run.root / "conversion-tmp",
                    artifact["id"],
                    self._relative(run.root / "assets" / artifact["id"]),
                )
                text = conversion.markdown
                converter = conversion.converter_id
            else:
                return
            cleaning = clean_markdown(
                text,
                getattr(config, "preset", "training_standard"),
                exclude_c_code_blocks=getattr(config, "exclude_c_code_blocks", True),
            )
            normalized = cleaning.content
            for excluded in cleaning.excluded_ranges:
                self._issue(
                    run,
                    "C_CODE_BLOCK_EXCLUDED",
                    "info",
                    resource_id=artifact["id"],
                    file_name=artifact["name"],
                    message=f"已从加工视图排除 C/C++ 代码块：{excluded['blockId']}",
                )
            normalized_path = run.root / "normalized" / f"{artifact['id']}.md"
            self._write_text(normalized_path, normalized)
            original_path = run.root / "originals" / f"{artifact['id']}{path.suffix.lower()}"
            original_path = run.root / artifact.get("originalArtifact", f"originals/{artifact['id']}{path.suffix.lower()}")
            blocks, units = build_processing_units(
                cleaning, artifact["id"], artifact["logicalPath"], config
            )
            run.structure_blocks.extend(blocks)
            run.chunks.extend(units)
            source_doc = {
                "resourceId": artifact["id"], "sourcePath": artifact["logicalPath"],
                "sourceType": artifact.get("sourceType"), "mediaType": artifact["mediaType"],
                "processingState": "completed_with_warnings" if artifact["formatFamily"] in {"office", "pdf"} else "completed", "originalArtifact": artifact["originalArtifact"],
                "normalizedArtifact": self._relative(normalized_path), "sourceMapArtifact": self._write_source_map(run, artifact, blocks),
                "originalHash": artifact["sha256"], "normalizedHash": self._hash_text(normalized),
                "converterId": converter, "converterVersion": "1.0.0",
                "conversionProfile": getattr(conversion, "conversion_profile", "office_pdf_markdown_v1") if artifact["formatFamily"] == "office" else "office_pdf_markdown_v1",
                "imageCount": getattr(conversion, "image_count", 0) if artifact["formatFamily"] == "office" else 0,
                "preservedImageCount": getattr(conversion, "preserved_image_count", 0) if artifact["formatFamily"] == "office" else 0,
                "assetPaths": getattr(conversion, "asset_paths", []) if artifact["formatFamily"] == "office" else [],
                "normalizedCharacters": len(normalized), "mappingState": "partial" if artifact["formatFamily"] in {"office", "pdf"} else "complete",
                "excludedRanges": cleaning.excluded_ranges,
                "normalizationEvents": cleaning.normalization_events,
                "warnings": [] if artifact["formatFamily"] == "text" else ["转换结果保留原始文件，但细粒度来源映射需转换器提供支持"],
            }
            run.source_documents.append(source_doc)
            artifact["normalizedArtifact"] = self._relative(normalized_path)
            artifact["processingStatus"] = source_doc["processingState"]
            if artifact["formatFamily"] == "office":
                artifact["conversionProfile"] = source_doc["conversionProfile"]
                artifact["imageCount"] = source_doc["imageCount"]
                artifact["preservedImageCount"] = source_doc["preservedImageCount"]
                artifact["assetPaths"] = source_doc["assetPaths"]
        except Exception as exc:
            state = "ocr_required" if artifact["formatFamily"] == "pdf" and "没有可提取文本" in str(exc) else "conversion_failed"
            artifact["processingStatus"] = state
            code = "PDF_OCR_REQUIRED" if state == "ocr_required" else "CONVERSION_FAILED"
            message = "PDF 没有可提取文本，当前不自动 OCR，资源已隔离" if state == "ocr_required" else f"资源转换失败：{exc}"
            self._issue(run, code, "error", resource_id=artifact["id"], file_name=artifact["name"], message=message)
            run.quarantined_resources += 1

    @staticmethod
    def _convert_pdf(path: Path) -> tuple[str, str]:
        result = subprocess.run(["pdftotext", "-layout", str(path), "-"], capture_output=True, text=True, timeout=60, check=False)
        if result.returncode != 0:
            raise ValueError("PDF 文本提取失败")
        if not result.stdout.strip():
            raise ValueError("PDF 没有可提取文本，已标记为 ocr_required")
        return result.stdout, "pdftotext"

    @staticmethod
    def _convert_office(path: Path, temp_root: Path, resource_id: str, asset_relative_root: str) -> OfficeConversionResult:
        return convert_office_to_markdown(
            path,
            temp_root,
            asset_root=temp_root.parent / "assets" / resource_id,
            markdown_asset_prefix=f"../assets/{resource_id}",
            asset_relative_root=asset_relative_root,
        )

    @staticmethod
    def _normalize_markdown(text: str) -> str:
        text = text.replace("\ufeff", "").replace("\r\n", "\n").replace("\r", "\n")
        text = re.sub(r"[ \t]+\n", "\n", text)
        return text.strip()

    def _write_source_map(self, run: _PreparationRun, artifact: dict[str, Any], blocks: list[dict[str, Any]]) -> str:
        path = run.root / "mappings" / f"{artifact['id']}.json"
        payload = {
            "resourceId": artifact["id"],
            "sourceFormat": artifact["formatFamily"],
            "originalArtifact": f"originals/{artifact['id']}{Path(artifact['name']).suffix.lower()}",
            "mappingState": "partial" if artifact["formatFamily"] in {"office", "pdf"} else "complete",
            "blocks": [{"blockId": item["blockId"], "markdownRange": item["markdownOffsets"], "locations": []} for item in blocks],
        }
        self._write_json(path, payload)
        return self._relative(path)

    def _extract_archive(
        self,
        run: _PreparationRun,
        path: Path,
        archive_artifact: dict[str, Any],
        depth: int,
        config: Any | None = None,
    ) -> None:
        output_root = run.root / "extracted" / archive_artifact["id"]
        try:
            if zipfile.is_zipfile(path):
                self._extract_zip(run, path, archive_artifact, output_root, depth, config)
            elif tarfile.is_tarfile(path):
                self._extract_tar(run, path, archive_artifact, output_root, depth, config)
            else:
                self._quarantine(
                    run,
                    archive_artifact,
                    "ARCHIVE_UNSUPPORTED",
                    "文件扩展名表示压缩包，但内容不是支持的 ZIP/TAR 归档",
                )
                return
            if archive_artifact["processingStatus"] != "quarantined":
                archive_artifact["processingStatus"] = "expanded"
        except (OSError, PreparationServiceError, tarfile.TarError, zipfile.BadZipFile) as exc:
            self._quarantine(run, archive_artifact, "ARCHIVE_READ_FAILED", str(exc))

    def _extract_zip(
        self,
        run: _PreparationRun,
        path: Path,
        archive_artifact: dict[str, Any],
        output_root: Path,
        depth: int,
        config: Any | None = None,
    ) -> None:
        with zipfile.ZipFile(path) as archive:
            entries = [item for item in archive.infolist() if not item.is_dir()]
            _, declared_bytes, compressed_bytes, validation_error = self._validate_zip_entries(entries)
            if validation_error:
                self._quarantine(run, archive_artifact, validation_error[0], validation_error[1])
                return
            if len(entries) > self.limits.max_files:
                self._quarantine(run, archive_artifact, "ARCHIVE_MAX_FILES", "归档文件数量超过限制")
                return
            if declared_bytes > self.limits.max_bytes:
                self._quarantine(run, archive_artifact, "ARCHIVE_MAX_BYTES", "归档声明解压大小超过限制")
                return
            if compressed_bytes and declared_bytes / compressed_bytes > self.limits.max_expansion_ratio:
                self._quarantine(run, archive_artifact, "ARCHIVE_EXPANSION_RATIO", "归档膨胀率超过限制")
                return
            output_root.mkdir(parents=True, exist_ok=True)
            for entry in entries:
                member_path = self._safe_member_path(entry.filename)
                target = self._target_path(output_root, member_path)
                with archive.open(entry, "r") as source:
                    self._write_extracted(
                        run,
                        source,
                        target,
                        archive_artifact,
                        depth,
                        member_path,
                        config,
                    )
                if archive_artifact["processingStatus"] == "quarantined":
                    return

    def _extract_tar(
        self,
        run: _PreparationRun,
        path: Path,
        archive_artifact: dict[str, Any],
        output_root: Path,
        depth: int,
        config: Any | None = None,
    ) -> None:
        with tarfile.open(path, mode="r:*") as archive:
            entries = [item for item in archive.getmembers() if not item.isdir()]
            names: set[str] = set()
            declared_bytes = 0
            for entry in entries:
                try:
                    member_path = self._safe_member_path(entry.name)
                except ValueError as exc:
                    self._quarantine(run, archive_artifact, "ARCHIVE_UNSAFE_PATH", str(exc))
                    return
                if member_path in names:
                    self._quarantine(run, archive_artifact, "ARCHIVE_DUPLICATE_PATH", "归档中存在重复成员路径")
                    return
                names.add(member_path)
                if not entry.isfile():
                    self._quarantine(run, archive_artifact, "ARCHIVE_SPECIAL_FILE", "归档包含非普通文件成员")
                    return
                declared_bytes += max(0, int(entry.size))
            if len(entries) > self.limits.max_files:
                self._quarantine(run, archive_artifact, "ARCHIVE_MAX_FILES", "归档文件数量超过限制")
                return
            if declared_bytes > self.limits.max_bytes:
                self._quarantine(run, archive_artifact, "ARCHIVE_MAX_BYTES", "归档声明解压大小超过限制")
                return
            compressed_bytes = max(1, path.stat().st_size)
            if declared_bytes / compressed_bytes > self.limits.max_expansion_ratio:
                self._quarantine(run, archive_artifact, "ARCHIVE_EXPANSION_RATIO", "归档膨胀率超过限制")
                return
            output_root.mkdir(parents=True, exist_ok=True)
            for entry in entries:
                source = archive.extractfile(entry)
                if source is None:
                    self._quarantine(run, archive_artifact, "ARCHIVE_READ_FAILED", "归档成员无法读取")
                    return
                with source:
                    member_path = self._safe_member_path(entry.name)
                    self._write_extracted(
                        run,
                        source,
                        self._target_path(output_root, member_path),
                        archive_artifact,
                        depth,
                        member_path,
                        config,
                    )
                if archive_artifact["processingStatus"] == "quarantined":
                    return

    def _write_extracted(
        self,
        run: _PreparationRun,
        source: BinaryIO,
        target: Path,
        archive_artifact: dict[str, Any],
        depth: int,
        member_path: str,
        config: Any | None = None,
    ) -> None:
        if run.extracted_resources >= self.limits.max_files:
            self._quarantine(run, archive_artifact, "ARCHIVE_MAX_FILES", "批次解压文件数量超过限制")
            return
        target.parent.mkdir(parents=True, exist_ok=True)
        temporary = target.with_suffix(target.suffix + ".part")
        total = 0
        digest = hashlib.sha256()
        try:
            with temporary.open("wb") as output:
                while True:
                    block = source.read(1024 * 1024)
                    if not block:
                        break
                    total += len(block)
                    if run.extracted_bytes + total > self.limits.max_bytes:
                        raise _ArchiveLimitError("批次解压总大小超过限制")
                    digest.update(block)
                    output.write(block)
            temporary.replace(target)
        except (_ArchiveLimitError, OSError) as exc:
            temporary.unlink(missing_ok=True)
            self._quarantine(run, archive_artifact, "ARCHIVE_EXTRACT_LIMIT", str(exc))
            return

        run.extracted_resources += 1
        run.extracted_bytes += total
        child_id = self._stable_id(
            run.batch_id,
            f"{archive_artifact['id']}:{member_path}",
            digest.hexdigest(),
        )
        child = self._process_file(
            run,
            target,
            resource_id=child_id,
            source_resource_id=archive_artifact["sourceResourceId"],
            parent_resource_id=archive_artifact["id"],
            depth=depth + 1,
            display_name=Path(member_path).name,
            source_record=None,
            is_extracted=True,
            config=config,
        )
        if child is not None:
            child["archiveMemberPath"] = member_path

    def _register(
        self,
        run: _PreparationRun,
        path: Path,
        *,
        resource_id: str,
        source_resource_id: str,
        parent_resource_id: str | None,
        depth: int,
        display_name: str,
        digest: str,
        detection: FormatDetection,
        source_record: dict[str, Any] | None,
        is_extracted: bool,
    ) -> dict[str, Any]:
        item = {
            "id": resource_id,
            "batchId": run.batch_id,
            "name": display_name,
            "logicalPath": self._relative(path),
            "mediaType": detection.media_type or "application/octet-stream",
            "size": path.stat().st_size,
            "sha256": digest,
            "kind": "asset" if detection.format_family == "image" else detection.format_family,
            "formatFamily": detection.format_family,
            "processingStatus": detection.processing_status,
            "sourceResourceId": source_resource_id,
            "parentResourceId": parent_resource_id,
            "extractionDepth": depth,
            "isExtracted": is_extracted,
            "sourceType": (source_record or {}).get("sourceType"),
        }
        original_path = run.root / "originals" / f"{resource_id}{path.suffix.lower()}"
        original_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, original_path)
        item["originalArtifact"] = self._relative(original_path)
        run.resources.append(item)
        self._emit(
            run,
            "resource_registered",
            resourceId=resource_id,
            formatFamily=detection.format_family,
            processingStatus=detection.processing_status,
            logicalPath=item["logicalPath"],
        )
        return item

    def _quarantine(
        self,
        run: _PreparationRun,
        artifact: dict[str, Any],
        code: str,
        message: str,
    ) -> None:
        if artifact.get("processingStatus") != "quarantined":
            artifact["processingStatus"] = "quarantined"
            run.quarantined_resources += 1
        self._issue(
            run,
            code,
            "error",
            resource_id=artifact.get("id"),
            file_name=artifact.get("name"),
            message=message,
        )

    def _issue(
        self,
        run: _PreparationRun,
        code: str,
        severity: str,
        *,
        resource_id: str | None = None,
        file_name: str | None = None,
        message: str,
    ) -> None:
        issue = {
            "code": code,
            "severity": severity,
            "resourceId": resource_id,
            "fileName": file_name,
            "message": message,
        }
        run.issues.append(issue)
        if severity == "error" and (code.startswith("SECURITY_") or code.startswith("ARCHIVE_")):
            run.security_issue_count += 1
        self._emit(run, "issue_detected", **issue)

    def _input_snapshot(self, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        snapshot = []
        for item in records:
            try:
                path = self._resolve_resource(item["logicalPath"])
                digest = self._hash_file(path) if path.is_file() and not path.is_symlink() else None
            except (FileNotFoundError, OSError):
                digest = None
            snapshot.append(
                {
                    "id": item.get("id"),
                    "logicalPath": item.get("logicalPath"),
                    "size": item.get("size"),
                    "sha256": digest,
                }
            )
        return snapshot

    @staticmethod
    def _validate_zip_entries(
        entries: list[zipfile.ZipInfo],
    ) -> tuple[set[str], int, int, tuple[str, str] | None]:
        names: set[str] = set()
        declared_bytes = 0
        compressed_bytes = 0
        for entry in entries:
            try:
                member_path = MaterialPreparationService._safe_member_path(entry.filename)
            except ValueError as exc:
                return names, declared_bytes, compressed_bytes, ("ARCHIVE_UNSAFE_PATH", str(exc))
            if member_path in names:
                return names, declared_bytes, compressed_bytes, ("ARCHIVE_DUPLICATE_PATH", "归档中存在重复成员路径")
            names.add(member_path)
            mode = (entry.external_attr >> 16) & 0o170000
            if mode == stat.S_IFLNK:
                return names, declared_bytes, compressed_bytes, ("ARCHIVE_SYMLINK", "归档包含符号链接成员")
            if mode not in {0, stat.S_IFREG}:
                return names, declared_bytes, compressed_bytes, ("ARCHIVE_SPECIAL_FILE", "归档包含非普通文件成员")
            if entry.flag_bits & 0x1:
                return names, declared_bytes, compressed_bytes, ("ARCHIVE_PASSWORD", "加密归档需要隔离，不能自动解压")
            declared_bytes += max(0, int(entry.file_size))
            compressed_bytes += max(0, int(entry.compress_size))
        return names, declared_bytes, compressed_bytes, None

    @staticmethod
    def _safe_member_path(value: str) -> str:
        normalized = value.replace("\\", "/")
        if "\x00" in normalized:
            raise ValueError("归档成员包含 NUL 字符")
        path = PurePosixPath(normalized)
        if path.is_absolute() or ".." in path.parts or not path.parts:
            raise ValueError(f"归档成员路径不安全：{value}")
        return "/".join(path.parts)

    @staticmethod
    def _target_path(root: Path, member_path: str) -> Path:
        target = (root / Path(*PurePosixPath(member_path).parts)).resolve()
        if root.resolve() not in target.parents:
            raise PreparationServiceError("归档目标路径越过解压根目录")
        return target

    @staticmethod
    def _hash_file(path: Path) -> str:
        digest = hashlib.sha256()
        with path.open("rb") as source:
            for block in iter(lambda: source.read(1024 * 1024), b""):
                digest.update(block)
        return digest.hexdigest()

    @staticmethod
    def _hash_json(value: Any) -> str:
        encoded = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
        return hashlib.sha256(encoded).hexdigest()

    @staticmethod
    def _stable_id(batch_id: str, path: str, digest: str) -> str:
        return hashlib.sha256(f"{batch_id}:{path}:{digest}".encode("utf-8")).hexdigest()[:24]

    @staticmethod
    def _write_json(path: Path, payload: Any) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(path.suffix + ".tmp")
        temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        temporary.replace(path)

    @staticmethod
    def _write_text(path: Path, content: str) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(path.suffix + ".tmp")
        temporary.write_text(content, encoding="utf-8")
        temporary.replace(path)

    @staticmethod
    def _write_jsonl(path: Path, records: list[dict[str, Any]]) -> None:
        content = "".join(json.dumps(item, ensure_ascii=False) + "\n" for item in records)
        MaterialPreparationService._write_text(path, content)

    @staticmethod
    def _hash_text(value: str) -> str:
        return hashlib.sha256(value.encode("utf-8")).hexdigest()

    @staticmethod
    def _relative(path: Path) -> str:
        return path.resolve().relative_to(settings.data_root.resolve()).as_posix()

    @staticmethod
    def _resolve_resource(logical_path: str) -> Path:
        path = (settings.data_root / logical_path).resolve()
        if settings.data_root.resolve() not in path.parents:
            raise FileNotFoundError(logical_path)
        return path

    @staticmethod
    def _emit(run: _PreparationRun, event: str, **payload: Any) -> None:
        record = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "event": event,
            "batchId": run.batch_id,
            "runId": run.run_id,
            "taskId": run.parent_task_id,
            "stageRunId": run.stage_run_id,
            **payload,
        }
        with run.event_log.open("a", encoding="utf-8") as output:
            output.write(json.dumps(record, ensure_ascii=False) + "\n")
