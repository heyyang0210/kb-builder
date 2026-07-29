"""可重试、可观测的素材加工流水线骨架。"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable, Mapping

from .contracts import (
    EventLogger,
    IngestionContext,
    PipelineStage,
    StageResult,
    StageStatus,
)


@dataclass(frozen=True)
class PipelineDefinition:
    key: str
    display_name: str
    stages: tuple[PipelineStage, ...]

    @property
    def stage_keys(self) -> tuple[str, ...]:
        return tuple(stage.key for stage in self.stages)


@dataclass(frozen=True)
class PipelineRunResult:
    pipeline_key: str
    status: StageStatus
    stage_results: tuple[StageResult, ...]


class PipelineRunner:
    def __init__(self, logger: EventLogger | None = None):
        self.logger = logger

    def run(
        self,
        definition: PipelineDefinition,
        context: IngestionContext,
    ) -> PipelineRunResult:
        results: list[StageResult] = []
        for stage in definition.stages:
            self._emit(
                {
                    "event": "stage_started",
                    "pipeline": definition.key,
                    "stage": stage.key,
                    "batchId": context.batch_id,
                }
            )
            try:
                result = stage.execute(context)
            except Exception as exc:
                result = StageResult(
                    stage_id=stage.key,
                    status=StageStatus.FAILED,
                    message=str(exc),
                )
            results.append(result)
            self._emit(
                {
                    "event": "stage_finished",
                    "pipeline": definition.key,
                    "stage": stage.key,
                    "batchId": context.batch_id,
                    "status": result.status.value,
                    "message": result.message,
                }
            )
            if result.status == StageStatus.FAILED:
                return PipelineRunResult(
                    pipeline_key=definition.key,
                    status=StageStatus.FAILED,
                    stage_results=tuple(results),
                )
            context.artifacts.extend(result.produced_artifacts)
        return PipelineRunResult(
            pipeline_key=definition.key,
            status=StageStatus.COMPLETED,
            stage_results=tuple(results),
        )

    def _emit(self, event: Mapping[str, Any]) -> None:
        if self.logger:
            self.logger.emit(event)
