"""通用素材接入框架。"""

from .contracts import (
    FormatAdapter,
    IngestionContext,
    MaterialSource,
    PipelineStage,
    SourceArtifact,
    SourceConnector,
    SourcePlan,
    SourceType,
    StageResult,
    StageStatus,
)
from .framework import IngestionFramework, build_default_framework
from .pipeline import PipelineDefinition, PipelineRunResult, PipelineRunner
from .registry import ComponentRegistry, ComponentRegistryError

__all__ = [
    "ComponentRegistry",
    "ComponentRegistryError",
    "FormatAdapter",
    "IngestionContext",
    "IngestionFramework",
    "MaterialSource",
    "PipelineDefinition",
    "PipelineRunResult",
    "PipelineRunner",
    "PipelineStage",
    "SourceArtifact",
    "SourceConnector",
    "SourcePlan",
    "SourceType",
    "StageResult",
    "StageStatus",
    "build_default_framework",
]
