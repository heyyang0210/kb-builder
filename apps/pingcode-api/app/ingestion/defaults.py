"""默认框架声明。

默认组件只负责声明扩展点和流程顺序，不执行真实上传、解压或转换。
真实功能将在后续 P1-P5 任务中替换对应声明实现。
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping

from .contracts import (
    IngestionContext,
    PipelineStage,
    SourceConnector,
    SourcePlan,
    SourceType,
    StageResult,
    StageStatus,
)
from .pipeline import PipelineDefinition
from .registry import ComponentRegistry


@dataclass(frozen=True)
class DeclaredSourceConnector:
    key: str
    source_type: SourceType
    display_name: str
    supports_resume: bool = False

    def prepare(self, request: Mapping[str, Any]) -> SourcePlan:
        source_id = str(request.get("sourceId") or request.get("source_id") or "")
        display_name = str(request.get("displayName") or request.get("display_name") or self.display_name)
        if not source_id:
            raise ValueError(f"{self.key} 来源缺少 sourceId")
        return SourcePlan(
            source_type=self.source_type,
            source_id=source_id,
            display_name=display_name,
            supports_resume=self.supports_resume,
            metadata=dict(request),
        )


@dataclass(frozen=True)
class DeclaredStage:
    key: str
    display_name: str

    def execute(self, context: IngestionContext) -> StageResult:
        return StageResult(
            stage_id=self.key,
            status=StageStatus.SKIPPED,
            message="框架阶段已声明，功能实现将在后续任务中接入",
        )


DEFAULT_FORMAT_FAMILIES = (
    {"key": "text", "displayName": "原生文本", "status": "declared"},
    {"key": "web", "displayName": "HTML 文档", "status": "declared"},
    {"key": "pdf", "displayName": "PDF 文档", "status": "declared"},
    {"key": "office", "displayName": "Office 文档", "status": "declared"},
    {"key": "archive", "displayName": "压缩包", "status": "declared"},
    {"key": "image", "displayName": "图片资源", "status": "declared"},
    {"key": "unknown", "displayName": "未知格式", "status": "declared"},
)


DEFAULT_STAGE_DEFINITIONS = (
    ("ingest", "素材接入"),
    ("security_scan", "安全扫描"),
    ("format_detect", "格式识别"),
    ("archive_extract", "安全解压"),
    ("normalize", "格式统一"),
    ("quality_scan", "质量过滤"),
    ("clean", "内容清洗"),
    ("chunk", "语义分块"),
    ("classify", "特性分类"),
    ("vector_index", "向量索引"),
    ("graph_index", "知识图谱"),
    ("quality_gate", "质量门禁"),
    ("publish", "数据集发布"),
)


def build_default_registries() -> tuple[
    ComponentRegistry[DeclaredSourceConnector],
    ComponentRegistry[DeclaredStage],
    PipelineDefinition,
]:
    sources: ComponentRegistry[DeclaredSourceConnector] = ComponentRegistry("素材来源连接器")
    sources.register(
        DeclaredSourceConnector(
            key="upload",
            source_type=SourceType.UPLOAD,
            display_name="本地文件上传",
            supports_resume=True,
        )
    )
    sources.register(
        DeclaredSourceConnector(
            key="pingcode",
            source_type=SourceType.PINGCODE,
            display_name="PingCode 映射下载",
        )
    )

    stages: ComponentRegistry[DeclaredStage] = ComponentRegistry("加工阶段")
    stage_instances = tuple(
        DeclaredStage(key=key, display_name=name)
        for key, name in DEFAULT_STAGE_DEFINITIONS
    )
    stages.extend(stage_instances)
    pipeline = PipelineDefinition(
        key="material_ingestion",
        display_name="统一素材接入与加工",
        stages=stage_instances,
    )
    return sources, stages, pipeline
