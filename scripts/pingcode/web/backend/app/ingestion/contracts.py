"""通用素材接入与加工框架的稳定接口契约。"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Mapping, Protocol, Sequence


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class SourceType(str, Enum):
    UPLOAD = "upload"
    PINGCODE = "pingcode"
    TICKET = "ticket"
    REPOSITORY = "repository"
    OBJECT_STORAGE = "object_storage"


class StageStatus(str, Enum):
    COMPLETED = "completed"
    SKIPPED = "skipped"
    FAILED = "failed"


@dataclass(frozen=True)
class SourcePlan:
    source_type: SourceType
    source_id: str
    display_name: str
    supports_resume: bool = False
    metadata: Mapping[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class MaterialSource:
    source_type: SourceType
    source_id: str
    display_name: str
    captured_at: datetime
    metadata: Mapping[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class SourceArtifact:
    artifact_id: str
    source_id: str
    relative_path: str
    media_type: str | None = None
    size: int | None = None
    sha256: str | None = None
    kind: str = "document"
    parent_artifact_id: str | None = None
    metadata: Mapping[str, Any] = field(default_factory=dict)


@dataclass
class IngestionContext:
    batch_id: str
    source: MaterialSource
    input_root: Path | None = None
    output_root: Path | None = None
    artifacts: list[SourceArtifact] = field(default_factory=list)
    state: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class StageResult:
    stage_id: str
    status: StageStatus
    produced_artifacts: tuple[SourceArtifact, ...] = ()
    metrics: Mapping[str, int | float | str] = field(default_factory=dict)
    warnings: tuple[str, ...] = ()
    message: str | None = None


class SourceConnector(Protocol):
    key: str
    source_type: SourceType
    display_name: str

    def prepare(self, request: Mapping[str, Any]) -> SourcePlan:
        """校验来源请求并生成可持久化的接入计划。"""


class FormatAdapter(Protocol):
    key: str
    display_name: str
    supported_extensions: Sequence[str]

    def supports(self, path: Path, media_type: str | None = None) -> bool:
        """判断适配器是否能够处理输入文件。"""

    def normalize(self, context: IngestionContext, artifact: SourceArtifact) -> StageResult:
        """将来源文件转换为统一中间表示。"""


@dataclass(frozen=True)
class FormatDetection:
    format_family: str
    media_type: str | None
    processing_status: str
    reason: str | None = None


class FormatDetector(Protocol):
    def detect(self, path: Path, media_type: str | None = None) -> FormatDetection:
        """识别文件格式族，不修改输入文件。"""


class ArchiveProcessor(Protocol):
    def can_process(self, path: Path) -> bool:
        """判断是否支持该归档格式。"""

    def process(self, path: Path, output_root: Path) -> Sequence[SourceArtifact]:
        """在安全边界内处理归档并返回子资源。"""


class PipelineStage(Protocol):
    key: str
    display_name: str

    def execute(self, context: IngestionContext) -> StageResult:
        """执行一个可重试的流水线阶段。"""


class EventLogger(Protocol):
    def emit(self, event: Mapping[str, Any]) -> None:
        """写入结构化流水线事件。"""
