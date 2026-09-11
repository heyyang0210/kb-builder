"""统一素材接入框架入口。"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping

from .contracts import IngestionContext, MaterialSource, SourceType
from .defaults import DEFAULT_FORMAT_FAMILIES, build_default_registries
from .pipeline import PipelineDefinition, PipelineRunResult, PipelineRunner
from .registry import ComponentRegistry


@dataclass
class IngestionFramework:
    source_connectors: ComponentRegistry[Any]
    stages: ComponentRegistry[Any]
    pipeline: PipelineDefinition
    format_families: tuple[Mapping[str, str], ...]

    def capabilities(self) -> dict[str, Any]:
        return {
            "pipeline": {
                "key": self.pipeline.key,
                "displayName": self.pipeline.display_name,
                "stageKeys": list(self.pipeline.stage_keys),
            },
            "sourceTypes": [
                {
                    "key": connector.key,
                    "sourceType": connector.source_type.value,
                    "displayName": connector.display_name,
                    "supportsResume": connector.supports_resume,
                    "status": "declared",
                }
                for connector in self.source_connectors.list()
            ],
            "formatFamilies": [dict(item) for item in self.format_families],
            "stages": [
                {
                    "key": stage.key,
                    "displayName": stage.display_name,
                    "status": "declared",
                }
                for stage in self.stages.list()
            ],
        }

    def prepare_source(self, source_type: SourceType, request: Mapping[str, Any]):
        connector = next(
            (
                item
                for item in self.source_connectors.list()
                if item.source_type == source_type
            ),
            None,
        )
        if connector is None:
            raise ValueError(f"未注册的素材来源类型：{source_type.value}")
        return connector.prepare(request)

    def run_declared_pipeline(
        self,
        context: IngestionContext,
        logger=None,
    ) -> PipelineRunResult:
        return PipelineRunner(logger).run(self.pipeline, context)


def build_default_framework() -> IngestionFramework:
    sources, stages, pipeline = build_default_registries()
    return IngestionFramework(
        source_connectors=sources,
        stages=stages,
        pipeline=pipeline,
        format_families=DEFAULT_FORMAT_FAMILIES,
    )
