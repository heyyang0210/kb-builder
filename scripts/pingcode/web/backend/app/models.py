from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


def to_camel(value: str) -> str:
    first, *rest = value.split("_")
    return first + "".join(part.capitalize() for part in rest)


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class SelectionRule(ApiModel):
    node_id: str
    scope: Literal["self", "subtree"] = "self"


class SourceFilters(ApiModel):
    keyword: str | None = None
    file_types: list[str] = Field(default_factory=list)
    skip_empty: bool = True
    skip_deleted: bool = True


class SourceSelection(ApiModel):
    space_key: str
    include_rules: list[SelectionRule]
    exclude_rules: list[SelectionRule] = Field(default_factory=list)
    include_page_body: bool = True
    include_attachments: bool = True
    filters: SourceFilters = Field(default_factory=SourceFilters)


class SourceSnapshot(ApiModel):
    captured_at: datetime
    completeness: Literal["complete", "partial", "unknown"]
    incomplete_reason: str | None = None
    estimated_pages: int
    estimated_attachments: int
    page_estimate_state: Literal["exact", "upper_bound", "unknown"] = "exact"
    attachment_estimate_state: Literal["exact", "upper_bound", "unknown"] = "exact"
    estimated_bytes: int | None = None
    inaccessible_count: int = 0
    selected_page_ids: list[str] = Field(default_factory=list)


class MaterialSourceRecord(ApiModel):
    source_type: Literal["upload", "pingcode", "ticket", "repository", "object_storage"]
    source_id: str
    display_name: str
    captured_at: datetime
    metadata: dict[str, Any] = Field(default_factory=dict)


class BatchCreate(ApiModel):
    name: str = Field(min_length=1, max_length=120)
    source_selection: SourceSelection


class MaterialBatch(ApiModel):
    id: str
    name: str
    state: Literal[
        "draft", "staging", "uploaded", "downloading", "downloaded", "processing", "ready", "failed"
    ]
    source_snapshot: SourceSnapshot
    source_selection: SourceSelection | None = None
    source: MaterialSourceRecord | None = None
    local_space_name: str | None = None
    local_space_logical_path: str | None = None
    active_task_ids: list[str] = Field(default_factory=list)
    latest_dataset_version_id: str | None = None
    created_at: datetime
    updated_at: datetime


class ProcessSummary(ApiModel):
    state: Literal["pending", "running", "review", "failed", "publishable", "completed", "unknown"]
    stage: str | None = None
    percent: int | None = Field(default=None, ge=0, le=100)
    completed_steps: int = 0
    total_steps: int = 6
    blocking_reason: str | None = None


class QualitySummary(ApiModel):
    state: Literal["unknown", "passed", "review", "failed"] = "unknown"
    warnings: int = 0
    errors: int = 0
    pending_review: int = 0


class MaterialSummary(ApiModel):
    pages: int = 0
    attachments: int = 0
    documents: int | None = None
    chunks: int | None = None


class RecommendedAction(ApiModel):
    type: str
    label: str
    route: str


class LatestActivity(ApiModel):
    type: str
    message: str
    at: datetime


class WorkbenchCounts(ApiModel):
    all: int = 0
    pending: int = 0
    running: int = 0
    review: int = 0
    failed: int = 0
    publishable: int = 0


class WorkbenchSummary(ApiModel):
    counts: WorkbenchCounts
    active_tasks: list[dict[str, Any]] = Field(default_factory=list)
    recent_tasks: list[dict[str, Any]] = Field(default_factory=list)


class TaskSnapshot(ApiModel):
    id: str
    batch_id: str
    type: Literal["download", "archive", "scan", "preprocess", "graph"]
    state: Literal[
        "queued",
        "running",
        "pausing",
        "paused",
        "cancelling",
        "cancelled",
        "interrupted",
        "completed",
        "failed",
    ]
    stage: str | None = None
    completed: int = 0
    total: int | None = None
    warnings: int = 0
    failed: int = 0
    message: str | None = None
    stages: list[dict[str, Any]] = Field(default_factory=list)
    model_calls: dict[str, int] = Field(default_factory=dict)
    graph_summary: dict[str, Any] = Field(default_factory=dict)
    progress_detail: dict[str, Any] = Field(default_factory=dict)
    can_pause: bool = False
    can_cancel: bool = False
    can_retry: bool = False
    can_resume: bool = False
    created_at: datetime
    updated_at: datetime


class DownloadTaskCreate(ApiModel):
    batch_id: str


class UploadSessionCreate(ApiModel):
    name: str = Field(min_length=1, max_length=120)
    operator_label: str = Field(default="", max_length=120)
    total_files: int = Field(ge=1, le=10000)
    total_bytes: int = Field(ge=0)


class UploadBatchCreate(ApiModel):
    name: str | None = Field(default=None, max_length=120)


class UploadFileCreate(ApiModel):
    relative_path: str = Field(min_length=1, max_length=1000)
    size: int = Field(ge=0)
    sha256: str | None = Field(default=None, min_length=64, max_length=64)
    media_type: str | None = Field(default=None, max_length=200)


class UploadFileSnapshot(ApiModel):
    id: str
    relative_path: str
    size: int
    sha256: str | None = None
    media_type: str | None = None
    chunk_count: int
    received_chunks: list[int] = Field(default_factory=list)
    missing_chunks: list[int] = Field(default_factory=list)
    state: Literal["pending", "uploading", "assembled", "verified", "rejected"]
    assembled_path: str | None = None
    error: str | None = None


class UploadSession(ApiModel):
    id: str
    name: str
    operator_label: str
    state: Literal["created", "uploading", "verifying", "ready", "failed", "cancelled", "expired"]
    total_files: int
    total_bytes: int
    uploaded_bytes: int = 0
    chunk_size: int
    max_file_size: int
    max_session_size: int
    expires_at: datetime
    created_at: datetime
    updated_at: datetime
    files: list[UploadFileSnapshot] = Field(default_factory=list)
    manifest_path: str | None = None
    batch_id: str | None = None
    token_id: str | None = None


class PreprocessConfig(ApiModel):
    preset: Literal["basic_clean", "training_standard"] = "training_standard"
    max_unit_characters: int = Field(default=6000, ge=200, le=8000)
    fallback_overlap_characters: int = Field(default=0, ge=0, le=1000)
    conversion_profile: str = "office_pdf_markdown_v1"
    segmentation_strategy: Literal["structure_first"] = "structure_first"
    enable_ocr: bool = False
    exclude_c_code_blocks: bool = True

    @model_validator(mode="before")
    @classmethod
    def accept_legacy_unit_fields(cls, value):
        if not isinstance(value, dict):
            return value
        data = dict(value)
        pairs = (
            (("maxUnitCharacters", "max_unit_characters"), ("chunkSize", "chunk_size"), "maxUnitCharacters"),
            (("fallbackOverlapCharacters", "fallback_overlap_characters"), ("chunkOverlap", "chunk_overlap"), "fallbackOverlapCharacters"),
        )
        for canonical_names, legacy_names, target in pairs:
            canonical = next((data[name] for name in canonical_names if name in data), None)
            legacy = next((data[name] for name in legacy_names if name in data), None)
            if canonical is not None and legacy is not None and canonical != legacy:
                raise ValueError(f"{target} 与历史兼容字段的值不一致")
            if canonical is None and legacy is not None:
                data[target] = legacy
            for name in legacy_names:
                data.pop(name, None)
        return data

    @model_validator(mode="after")
    def validate_fallback_overlap(self):
        if self.fallback_overlap_characters >= self.max_unit_characters:
            raise ValueError("fallbackOverlapCharacters 必须小于 maxUnitCharacters")
        return self


class PreprocessTaskCreate(ApiModel):
    batch_id: str
    config: PreprocessConfig = Field(default_factory=PreprocessConfig)


class TrainingConfig(PreprocessConfig):
    review_low_confidence: bool = True
    low_confidence_threshold: float = Field(default=0.65, ge=0, le=1)


class TrainingTaskCreate(ApiModel):
    batch_id: str
    config: TrainingConfig = Field(default_factory=TrainingConfig)
    mode: Literal["keyword_analysis", "formal_knowledge"] = "keyword_analysis"
    source_dataset_id: str | None = None
    keyword_ids: list[str] = Field(default_factory=list)


class KeywordStatusUpdate(ApiModel):
    status: Literal["accepted", "rejected", "pending"]


class KeywordBusinessStatusUpdate(ApiModel):
    business_status: Literal["businessAccepted", "businessRejected", "needsReview"]
    reason_code: str = Field(default="", max_length=120)
    note: str = Field(default="", max_length=1000)
    operator_label: str = Field(default="当前用户", max_length=120)


class KeywordAdmissionUpdate(ApiModel):
    admission_status: Literal["admitted", "excluded"]
    note: str = Field(default="", max_length=1000)
    operator_label: str = Field(default="当前用户", max_length=120)


class L2TermCreate(ApiModel):
    name: str = Field(min_length=1, max_length=200)
    canonical_name: str = Field(default="", max_length=200)
    description: str = Field(default="", max_length=1000)
    linked_l1_ids: list[str] = Field(default_factory=list)


class KeywordLinkCreate(ApiModel):
    target_id: str = Field(min_length=1, max_length=200)
    weight: float = Field(default=0.5, ge=0, le=1)
    evidence_chunk_ids: list[str] = Field(default_factory=list)


class TrainingModelConfigUpdate(ApiModel):
    provider: Literal["openai", "alibaba", "zhipu", "custom"]
    model: str = Field(min_length=1, max_length=200)
    base_url: str = Field(min_length=1, max_length=1000)
    api_key: str = Field(default="", max_length=4000)
    temperature: float = Field(default=0.7, ge=0, le=2)
    max_tokens: int = Field(default=60000, ge=1, le=200000)
    timeout_ms: int = Field(default=180000, ge=1000, le=600000)


class TrainingReviewDecision(ApiModel):
    decision: Literal["accepted", "rejected"]
    note: str = Field(default="", max_length=1000)
    operator_label: str = Field(default="当前用户", max_length=120)


class DatasetDeletionRequest(ApiModel):
    operator: str = Field(min_length=1, max_length=120)
    reason: str = Field(min_length=1, max_length=1000)
    confirmed: Literal[True]


class PreprocessPreviewRequest(ApiModel):
    batch_id: str
    resource_id: str
    config: PreprocessConfig = Field(default_factory=PreprocessConfig)


class MaterialPrepareRequest(ApiModel):
    batch_id: str
    config: PreprocessConfig = Field(default_factory=PreprocessConfig)


class MetadataBuildRequest(ApiModel):
    batch_id: str


class MetadataBuildReport(ApiModel):
    batch_id: str
    run_id: str
    state: Literal["completed", "completed_with_warnings", "failed"]
    input_run_id: str
    input_manifest_hash: str
    documents_count: int
    chunks_count: int
    issue_count: int
    artifact_paths: list[str] = Field(default_factory=list)
    stage_result_path: str
    event_log_path: str
    message: str
    created_at: datetime


class PreparationIssue(ApiModel):
    code: str
    severity: Literal["info", "warning", "error"]
    resource_id: str | None = None
    file_name: str | None = None
    message: str


class PreparationReport(ApiModel):
    batch_id: str
    run_id: str
    state: Literal["completed", "completed_with_warnings", "failed"]
    input_manifest_hash: str
    manifest_path: str
    event_log_path: str
    total_resources: int
    processable_resources: int
    archive_resources: int
    extracted_resources: int
    image_resources: int
    conversion_pending_resources: int
    quarantined_resources: int
    security_issue_count: int
    issues: list[PreparationIssue] = Field(default_factory=list)
    created_at: datetime
    stage_result_path: str | None = None
    artifact_paths: list[str] = Field(default_factory=list)


class ScanIssue(ApiModel):
    code: str
    severity: Literal["info", "warning", "error"]
    resource_id: str | None = None
    file_name: str | None = None
    message: str


class ScanReport(ApiModel):
    batch_id: str
    total_files: int
    text_files: int
    unsupported_files: int
    empty_files: int
    encoding_warning_files: int
    duplicate_groups: int
    traceable_files: int
    issues: list[ScanIssue] = Field(default_factory=list)
    processable_count: int = 0
    direct_text_count: int = 0
    convertible_count: int = 0
    ocr_required_count: int = 0
    unsupported_count: int = 0
    conversion_failed_count: int = 0
    estimated_processing_unit_count: int = 0
    total_bytes: int = 0
    tool_status: dict[str, Any] = Field(default_factory=dict)
    issue_summary: dict[str, int] = Field(default_factory=dict)


class DatasetVersion(ApiModel):
    id: str
    batch_id: str
    preprocess_task_id: str
    state: Literal["candidate", "published", "deleted"]
    config: PreprocessConfig
    total_documents: int
    total_chunks: int
    quality_metrics: dict[str, float | int]
    quality_passed: bool
    training_task_id: str | None = None
    graph_available: bool = False
    graph_summary: dict[str, Any] = Field(default_factory=dict)
    quality_state: Literal["passed", "blocked"] = "passed"
    publishable: bool = True
    quality_labels: list[str] = Field(default_factory=list)
    quality_notice: str = ""
    dataset_path: str | None = None
    deleted_at: datetime | None = None
    deleted_by: str | None = None
    deletion_reason: str | None = None
    created_at: datetime


class SkillSummary(ApiModel):
    id: str
    version: str
    capability: Literal["chat", "vision", "embedding"]
    description: str = ""
    status: Literal["published", "draft", "deprecated"]


class SkillDetail(SkillSummary):
    manifest: dict[str, Any]
    skill_markdown: str
    files: dict[str, str]


class PromptSummary(ApiModel):
    id: str
    skill_id: str
    skill_version: str
    name: str
    status: Literal["published", "draft", "deprecated"]
    content_hash: str
    content_length: int
    file: str


class PromptDetail(PromptSummary):
    content: str
    manifest: dict[str, Any]


class PromptDraftCreate(ApiModel):
    content: str | None = None
    base_version: str | None = None
    actor_id: str = Field(default="local-operator", min_length=1, max_length=120)


class PromptDraftUpdate(ApiModel):
    content: str
    revision: int | None = Field(default=None, ge=1)
    actor_id: str = Field(default="local-operator", min_length=1, max_length=120)


class PromptDraftTest(ApiModel):
    variables: dict[str, Any] = Field(default_factory=dict)


class PromptDraftPublish(ApiModel):
    version: str | None = None
    actor_id: str = Field(default="local-operator", min_length=1, max_length=120)


class TreeResponse(ApiModel):
    space_key: str
    space_name: str
    completeness: Literal["complete", "partial", "unknown"]
    incomplete_reason: str | None = None
    total: int
    reported_total: int
    page_count: int = 0
    unresolved_parent_ids: list[str] = Field(default_factory=list)
    items: list[dict[str, Any]]


class SpaceMappingUpdate(ApiModel):
    local_name: str = Field(min_length=1, max_length=120)
    local_slug: str = Field(min_length=1, max_length=100)
    enabled: bool = True


class SpaceMapping(ApiModel):
    space_key: str
    remote_space_id: str
    remote_name: str
    local_name: str
    local_slug: str
    local_logical_path: str
    enabled: bool
    created_at: datetime
    updated_at: datetime


class FileResource(ApiModel):
    id: str
    batch_id: str
    name: str
    logical_path: str
    media_type: str
    size: int
    previewable: bool
    downloadable: bool = True
    format_family: str | None = None
    processing_status: str | None = None
    previewable_after_conversion: bool = False
    conversion_readiness: str | None = None
    latest_preview_state: str | None = None


class FilePreview(ApiModel):
    resource_id: str
    name: str
    format: Literal["markdown", "text", "json", "html"]
    content: str
    assets: dict[str, str] = Field(default_factory=dict)
