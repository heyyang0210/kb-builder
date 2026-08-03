import json
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path

from fastapi import Body, FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from starlette.responses import RedirectResponse

from .config import settings
from .ingestion import build_default_framework
from .models import (
    BatchCreate,
    DatasetDeletionRequest,
    DatasetVersion,
    DownloadTaskCreate,
    FilePreview,
    MaterialBatch,
    MaterialPrepareRequest,
    MetadataBuildRequest,
    MetadataBuildReport,
    PreprocessPreviewRequest,
    PreprocessTaskCreate,
    PreparationReport,
    PromptDetail,
    PromptDraftCreate,
    PromptDraftPublish,
    PromptDraftTest,
    PromptDraftUpdate,
    ScanReport,
    SpaceMapping,
    SpaceMappingUpdate,
    SourceSelection,
    SourceSnapshot,
    SkillDetail,
    SkillSummary,
    TaskSnapshot,
    KeywordStatusUpdate,
    KeywordBusinessStatusUpdate,
    KeywordAdmissionUpdate,
    L2TermCreate,
    KeywordLinkCreate,
    TrainingTaskCreate,
    TrainingModelConfigUpdate,
    TrainingReviewDecision,
    TreeResponse,
    UploadFileCreate,
    UploadFileSnapshot,
    UploadBatchCreate,
    UploadSessionCreate,
    UploadSession,
    WorkbenchSummary,
)
from .pingcode_service import PingCodeService
from .prompt_management import (
    PromptDraftConflictError,
    PromptDraftNotFoundError,
    PromptManagementService,
    PromptPublishConflictError,
    PromptValidationError,
)
from .prompt_registry import PromptNotFoundError, PromptRegistry, PromptRegistryError
from .preparation_service import MaterialPreparationService, PreparationServiceError
from .metadata_service import MetadataConstructionError, MetadataConstructionService
from .skill_registry import SkillNotFoundError, SkillRegistry, SkillRegistryError
from .services import (
    BatchService,
    FileService,
    PreprocessService,
    SpaceMappingService,
    TaskService,
)
from .store import JsonStore
from .upload_service import UploadAuthorizationError, UploadService, UploadServiceError
from .training_service import error_summary, ModelGatewayError, ModelTestRequiredError, TrainingService
from .workbench_service import WorkbenchService
from .index_service import IndexService


store = JsonStore(settings.data_root / "state.json")
pingcode = PingCodeService()
batches = BatchService(store, pingcode)
tasks = TaskService(store, batches, pingcode)
files = FileService()
preprocess = PreprocessService(store, batches, tasks, files)
preparation = MaterialPreparationService(batches, files)
metadata_construction = MetadataConstructionService(batches, files)
space_mappings = SpaceMappingService(store)
skills = SkillRegistry(settings.processing_skill_root)
ingestion_framework = build_default_framework()
uploads = UploadService(store)
prompts = PromptRegistry(settings.processing_skill_root)
prompt_management = PromptManagementService(
    settings.processing_skill_root,
    settings.processing_prompt_draft_root,
)
training = TrainingService(
    store,
    batches,
    tasks,
    preprocess,
    prompts,
    preparation=preparation,
    metadata_construction=metadata_construction,
)
workbench = WorkbenchService(batches, tasks, preprocess, training)
index_service = IndexService(settings.data_root)


@asynccontextmanager
async def lifespan(_: FastAPI):
    tasks.reconcile_interrupted()
    training.reconcile_interrupted()
    yield
    pingcode.close()


app = FastAPI(
    title="PingCode 素材平台 API",
    version="0.1.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def error(
    code: str,
    message: str,
    status: int,
    *,
    retryable: bool = False,
    **details,
):
    detail = {"code": code, "message": message, "retryable": retryable}
    detail.update(details)
    raise HTTPException(
        status_code=status,
        detail=detail,
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    detail = exc.detail if isinstance(exc.detail, dict) else {"code": "HTTP_ERROR", "message": str(exc.detail)}
    detail.setdefault("requestId", request.headers.get("x-request-id", ""))
    return JSONResponse(status_code=exc.status_code, content={"success": False, "error": detail})


@app.exception_handler(Exception)
async def unexpected_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "服务处理失败，请根据 requestId 查询后端日志",
                "retryable": False,
                "requestId": request.headers.get("x-request-id", ""),
            },
        },
    )


@app.api_route(
    "/pingcode-api/{full_path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
)
async def redirect_legacy_pingcode_api(full_path: str, request: Request):
    target = f"/{full_path}"
    if request.url.query:
        target = f"{target}?{request.url.query}"
    return RedirectResponse(url=target, status_code=307)


@app.get("/api/health")
def health():
    return {"status": "ok", "version": app.version}


@app.get("/api/system/runtime-config")
def runtime_config():
    return {
        "apiBaseUrl": "",
        "eventBaseUrl": "",
        "appBasePath": "/pingcode-materials/",
        "features": {"localOpenDirectory": False, "graphAnalysis": True},
    }


@app.get("/api/system/status")
def system_status():
    return {
        "pingcode": pingcode.status(),
        "dataRootReady": settings.data_root.exists(),
        "activeTasks": sum(1 for task in tasks.list() if task.state in {"queued", "running"}),
    }


@app.get("/api/ingestion/capabilities")
def ingestion_capabilities():
    return ingestion_framework.capabilities()


def upload_token(authorization: str | None) -> str:
    return ""


@app.post("/api/upload-sessions", response_model=UploadSession, status_code=201)
def create_upload_session(
    request: UploadSessionCreate,
    authorization: str | None = Header(default=None),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
):
    try:
        return uploads.create(request, upload_token(authorization), idempotency_key)
    except UploadAuthorizationError as exc:
        error("UPLOAD_UNAUTHORIZED", str(exc), 401)
    except UploadServiceError as exc:
        error("UPLOAD_SESSION_INVALID", str(exc), 400)


@app.get("/api/upload-sessions")
def list_upload_sessions(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, alias="pageSize", ge=1, le=100),
    authorization: str | None = Header(default=None),
):
    try:
        return uploads.list_page(page, page_size, upload_token(authorization))
    except UploadAuthorizationError as exc:
        error("UPLOAD_UNAUTHORIZED", str(exc), 401)


@app.get("/api/upload-sessions/{session_id}", response_model=UploadSession)
def get_upload_session(session_id: str, authorization: str | None = Header(default=None)):
    try:
        return uploads.get(session_id, upload_token(authorization))
    except UploadAuthorizationError as exc:
        error("UPLOAD_UNAUTHORIZED", str(exc), 401)
    except KeyError:
        error("UPLOAD_SESSION_NOT_FOUND", "上传会话不存在", 404)


@app.post("/api/upload-sessions/{session_id}/files", response_model=UploadFileSnapshot, status_code=201)
def add_upload_file(
    session_id: str,
    request: UploadFileCreate,
    authorization: str | None = Header(default=None),
):
    try:
        return uploads.add_file(session_id, request, upload_token(authorization))
    except UploadAuthorizationError as exc:
        error("UPLOAD_UNAUTHORIZED", str(exc), 401)
    except KeyError:
        error("UPLOAD_SESSION_NOT_FOUND", "上传会话不存在", 404)
    except UploadServiceError as exc:
        error("UPLOAD_FILE_INVALID", str(exc), 400)


@app.put("/api/upload-sessions/{session_id}/files/{file_id}/chunks/{chunk_index}", response_model=UploadFileSnapshot)
def upload_chunk(
    session_id: str,
    file_id: str,
    chunk_index: int,
    body: bytes = Body(default=b""),
    authorization: str | None = Header(default=None),
    x_chunk_sha256: str | None = Header(default=None, alias="X-Chunk-SHA256"),
    content_range: str | None = Header(default=None, alias="Content-Range"),
):
    try:
        return uploads.write_chunk(
            session_id,
            file_id,
            chunk_index,
            body,
            x_chunk_sha256,
            content_range,
            upload_token(authorization),
        )
    except UploadAuthorizationError as exc:
        error("UPLOAD_UNAUTHORIZED", str(exc), 401)
    except KeyError:
        error("UPLOAD_FILE_NOT_FOUND", "上传文件不存在", 404)
    except UploadServiceError as exc:
        error("UPLOAD_CHUNK_INVALID", str(exc), 400)


@app.post("/api/upload-sessions/{session_id}/files/{file_id}/complete", response_model=UploadFileSnapshot)
def complete_upload_file(session_id: str, file_id: str, authorization: str | None = Header(default=None)):
    try:
        return uploads.complete_file(session_id, file_id, upload_token(authorization))
    except UploadAuthorizationError as exc:
        error("UPLOAD_UNAUTHORIZED", str(exc), 401)
    except KeyError:
        error("UPLOAD_FILE_NOT_FOUND", "上传文件不存在", 404)
    except UploadServiceError as exc:
        error("UPLOAD_FILE_INCOMPLETE", str(exc), 400)


@app.post("/api/upload-sessions/{session_id}/complete", response_model=UploadSession)
def complete_upload_session(session_id: str, authorization: str | None = Header(default=None)):
    try:
        return uploads.complete_session(session_id, upload_token(authorization))
    except UploadAuthorizationError as exc:
        error("UPLOAD_UNAUTHORIZED", str(exc), 401)
    except KeyError:
        error("UPLOAD_SESSION_NOT_FOUND", "上传会话不存在", 404)
    except UploadServiceError as exc:
        error("UPLOAD_SESSION_INCOMPLETE", str(exc), 400)


@app.post("/api/upload-sessions/{session_id}/cancel", response_model=UploadSession)
def cancel_upload_session(session_id: str, authorization: str | None = Header(default=None)):
    try:
        return uploads.cancel(session_id, upload_token(authorization))
    except UploadAuthorizationError as exc:
        error("UPLOAD_UNAUTHORIZED", str(exc), 401)
    except KeyError:
        error("UPLOAD_SESSION_NOT_FOUND", "上传会话不存在", 404)


@app.post("/api/upload-sessions/{session_id}/create-batch", response_model=MaterialBatch, status_code=201)
def create_upload_batch(
    session_id: str,
    request: UploadBatchCreate,
    authorization: str | None = Header(default=None),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
):
    try:
        return uploads.create_batch(
            session_id,
            upload_token(authorization),
            request.name,
            idempotency_key,
        )
    except UploadAuthorizationError as exc:
        error("UPLOAD_UNAUTHORIZED", str(exc), 401)
    except KeyError:
        error("UPLOAD_SESSION_NOT_FOUND", "上传会话不存在", 404)
    except UploadServiceError as exc:
        error("UPLOAD_BATCH_INVALID", str(exc), 400)


@app.get("/api/pingcode/spaces")
def list_spaces(refresh: bool = False):
    try:
        remote_spaces = pingcode.list_spaces(refresh)
    except Exception as exc:
        error("PINGCODE_SPACES_FAILED", str(exc), 502, retryable=True)
    mappings = {item.space_key: item for item in space_mappings.list()}
    items = []
    for remote in remote_spaces:
        mapping = mappings.get(remote["key"])
        items.append(
            {
                **remote,
                "mapped": mapping is not None,
                "mapping": mapping,
            }
        )
    return {"items": items, "total": len(items), "mappedTotal": len(mappings)}


@app.put("/api/pingcode/spaces/{space_key}/mapping", response_model=SpaceMapping)
def update_space_mapping(space_key: str, update: SpaceMappingUpdate):
    try:
        remote = next(
            (item for item in pingcode.list_spaces() if item["key"] == space_key),
            None,
        )
        if remote is None:
            error("PINGCODE_SPACE_NOT_FOUND", "PingCode 空间不存在或当前账号不可访问", 404)
        return space_mappings.upsert(remote, update)
    except ValueError as exc:
        error("SPACE_MAPPING_INVALID", str(exc), 400)


@app.get("/api/pingcode/space-mappings")
def list_space_mappings():
    items = space_mappings.list()
    return {"items": items, "total": len(items)}


@app.get("/api/pingcode/status")
def pingcode_status():
    return pingcode.status()


@app.get("/api/processing/skills", response_model=dict)
def list_processing_skills():
    try:
        items = [item.summary() for item in skills.list_published()]
    except SkillRegistryError as exc:
        error("SKILL_REGISTRY_INVALID", str(exc), 500)
    return {"items": items, "total": len(items)}


@app.get("/api/processing/skills/{skill_id}", response_model=SkillDetail)
def get_processing_skill(skill_id: str, version: str | None = None):
    try:
        return skills.get(skill_id, version).detail()
    except SkillNotFoundError as exc:
        error("SKILL_NOT_FOUND", str(exc), 404)
    except SkillRegistryError as exc:
        error("SKILL_REGISTRY_INVALID", str(exc), 500)


@app.get("/api/processing/prompts", response_model=dict)
def list_processing_prompts(
    skill_id: str | None = Query(default=None, alias="skillId"),
    version: str | None = None,
):
    try:
        items = [item.summary() for item in prompts.list_published(skill_id, version)]
    except PromptRegistryError as exc:
        error("PROMPT_REGISTRY_INVALID", str(exc), 500)
    return {"items": items, "total": len(items)}


@app.get("/api/processing/prompts/{prompt_id}", response_model=PromptDetail)
def get_processing_prompt(prompt_id: str, version: str | None = None):
    try:
        return prompts.get(prompt_id, version).detail()
    except PromptNotFoundError as exc:
        error("PROMPT_NOT_FOUND", str(exc), 404)
    except PromptRegistryError as exc:
        error("PROMPT_REGISTRY_INVALID", str(exc), 500)


@app.post("/api/processing/prompts/{prompt_id}/drafts", status_code=201)
def create_prompt_draft(prompt_id: str, request: PromptDraftCreate):
    try:
        return prompt_management.create_draft(
            prompt_id,
            request.content,
            request.base_version,
            request.actor_id,
        ).detail()
    except PromptNotFoundError as exc:
        error("PROMPT_NOT_FOUND", str(exc), 404)
    except PromptValidationError as exc:
        error("PROMPT_VALIDATION_FAILED", "Prompt 校验失败", 422, validation=exc.result)
    except PromptRegistryError as exc:
        error("PROMPT_REGISTRY_INVALID", str(exc), 500)


@app.get("/api/processing/prompt-drafts/{draft_id}")
def get_prompt_draft(draft_id: str):
    try:
        return prompt_management.get_draft(draft_id).detail()
    except PromptDraftNotFoundError:
        error("PROMPT_DRAFT_NOT_FOUND", "Prompt 草稿不存在", 404)


@app.put("/api/processing/prompt-drafts/{draft_id}")
def update_prompt_draft(
    draft_id: str,
    request: PromptDraftUpdate,
    if_match: str | None = Header(default=None, alias="If-Match"),
):
    revision_value = if_match.strip().strip('"') if if_match else None
    if revision_value is not None and request.revision is not None and revision_value != str(request.revision):
        error("PROMPT_DRAFT_CONFLICT", "If-Match 与请求体 revision 不一致", 409)
    revision = request.revision
    if revision is None and revision_value is not None:
        try:
            revision = int(revision_value)
        except ValueError:
            error("PROMPT_DRAFT_REVISION_INVALID", "If-Match 必须是整数 revision", 400)
    if revision is None:
        error("PROMPT_DRAFT_REVISION_REQUIRED", "更新草稿必须提供 If-Match revision", 428)
    try:
        return prompt_management.update_draft(
            draft_id,
            request.content,
            revision,
            request.actor_id,
        ).detail()
    except PromptDraftNotFoundError:
        error("PROMPT_DRAFT_NOT_FOUND", "Prompt 草稿不存在", 404)
    except PromptDraftConflictError as exc:
        error("PROMPT_DRAFT_CONFLICT", str(exc), 409)
    except PromptValidationError as exc:
        error("PROMPT_VALIDATION_FAILED", "Prompt 校验失败", 422, validation=exc.result)


@app.post("/api/processing/prompt-drafts/{draft_id}/validate")
def validate_prompt_draft(draft_id: str):
    try:
        draft, validation = prompt_management.validate_draft(draft_id)
        return {"draft": draft.detail(), "validation": validation}
    except PromptDraftNotFoundError:
        error("PROMPT_DRAFT_NOT_FOUND", "Prompt 草稿不存在", 404)
    except PromptRegistryError as exc:
        error("PROMPT_REGISTRY_INVALID", str(exc), 500)


@app.post("/api/processing/prompt-drafts/{draft_id}/test")
def test_prompt_draft(draft_id: str, request: PromptDraftTest):
    try:
        return prompt_management.render_test(draft_id, request.variables)
    except PromptDraftNotFoundError:
        error("PROMPT_DRAFT_NOT_FOUND", "Prompt 草稿不存在", 404)
    except PromptRegistryError as exc:
        error("PROMPT_REGISTRY_INVALID", str(exc), 500)


@app.post("/api/processing/prompt-drafts/{draft_id}/publish")
def publish_prompt_draft(draft_id: str, request: PromptDraftPublish):
    try:
        draft, prompt = prompt_management.publish_draft(
            draft_id,
            request.version,
            request.actor_id,
        )
        return {"draft": draft.detail(), "prompt": prompt.detail()}
    except PromptDraftNotFoundError:
        error("PROMPT_DRAFT_NOT_FOUND", "Prompt 草稿不存在", 404)
    except PromptValidationError as exc:
        error("PROMPT_VALIDATION_FAILED", "Prompt 校验失败", 422, validation=exc.result)
    except PromptPublishConflictError as exc:
        error("PROMPT_PUBLISH_CONFLICT", str(exc), 409)
    except PromptRegistryError as exc:
        error("PROMPT_REGISTRY_INVALID", str(exc), 500)


@app.get("/api/processing/prompts/{prompt_id}/versions/{version}/diff")
def diff_processing_prompt(
    prompt_id: str,
    version: str,
    from_version: str | None = Query(default=None, alias="fromVersion"),
):
    try:
        return prompt_management.diff(prompt_id, version, from_version)
    except PromptNotFoundError as exc:
        error("PROMPT_NOT_FOUND", str(exc), 404)
    except PromptRegistryError as exc:
        error("PROMPT_REGISTRY_INVALID", str(exc), 500)


@app.get("/api/pingcode/spaces/{space_key}/tree", response_model=TreeResponse)
def get_space_tree(space_key: str, refresh: bool = False):
    try:
        return pingcode.get_space_tree(space_key, refresh)
    except Exception as exc:
        error("PINGCODE_REQUEST_FAILED", str(exc), 502, retryable=True)


@app.post("/api/material-batches/estimate", response_model=SourceSnapshot)
def estimate_batch(selection: SourceSelection):
    try:
        return pingcode.estimate(selection)
    except Exception as exc:
        error("PINGCODE_ESTIMATE_FAILED", str(exc), 502, retryable=True)


@app.post("/api/material-batches", response_model=MaterialBatch, status_code=201)
def create_batch(
    request: BatchCreate,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
):
    try:
        mapping = space_mappings.get(request.source_selection.space_key)
        if mapping is None:
            error("SPACE_MAPPING_REQUIRED", "请先将 PingCode 空间映射为本地素材空间", 409)
        if not mapping.enabled:
            error("SPACE_MAPPING_DISABLED", "该空间映射已停用", 409)
        return batches.create(request, idempotency_key, mapping)
    except Exception as exc:
        error("BATCH_CREATE_FAILED", str(exc), 400, retryable=True)


@app.get("/api/material-batches")
def list_batches(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, alias="pageSize", ge=1, le=100),
    keyword: str | None = Query(default=None, max_length=200),
    source_type: str | None = Query(default=None, alias="sourceType"),
    state: str | None = Query(default=None),
    ownership: str | None = Query(default=None),
    completeness: str | None = Query(default=None),
    updated_from: datetime | None = Query(default=None, alias="updatedFrom"),
    updated_to: datetime | None = Query(default=None, alias="updatedTo"),
    local_space: str | None = Query(default=None, alias="localSpace", max_length=200),
    pingcode_space: str | None = Query(default=None, alias="pingcodeSpace", max_length=200),
    has_active_task: bool | None = Query(default=None, alias="hasActiveTask"),
    published: bool | None = Query(default=None),
    workbench_state: str | None = Query(default=None, alias="workbenchState"),
    sort: str = Query(default="updatedAt:desc"),
):
    try:
        return workbench.list_page(
            page=page,
            page_size=page_size,
            workbench_state=workbench_state,
            keyword=keyword,
            source_types=source_type,
            states=state,
            ownership_types=ownership,
            completeness=completeness,
            updated_from=updated_from,
            updated_to=updated_to,
            local_space=local_space,
            pingcode_space=pingcode_space,
            has_active_task=has_active_task,
            published=published,
            sort=sort,
        )
    except ValueError as exc:
        error("BATCH_FILTER_INVALID", str(exc), 400)


@app.get("/api/material-batches/{batch_id}", response_model=MaterialBatch)
def get_batch(batch_id: str):
    try:
        return batches.get(batch_id)
    except KeyError:
        error("BATCH_NOT_FOUND", "资料加工任务不存在", 404)


@app.get("/api/workbench/summary", response_model=WorkbenchSummary)
def get_workbench_summary():
    return workbench.summary()


@app.get("/api/material-batches/{batch_id}/workbench-summary")
def get_batch_workbench_summary(batch_id: str):
    try:
        return workbench.detail(batch_id)
    except KeyError:
        error("BATCH_NOT_FOUND", "资料加工任务不存在", 404)


@app.get("/api/material-batches/{batch_id}/files")
def list_batch_files(
    batch_id: str,
    category: str = Query(default="all", pattern="^(all|text|conversion_pending)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, alias="pageSize", ge=1, le=100),
):
    try:
        batches.get(batch_id)
    except KeyError:
        error("BATCH_NOT_FOUND", "资料加工任务不存在", 404)
    return files.list_page(batch_id, category, page, page_size)


@app.post("/api/download/tasks", response_model=TaskSnapshot, status_code=202)
def create_download_task(
    request: DownloadTaskCreate,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
):
    try:
        batch = batches.get(request.batch_id)
        if batch.source_selection is None:
            error("DOWNLOAD_SOURCE_UNSUPPORTED", "本地上传创建的资料加工任务不需要 PingCode 下载", 409)
        return tasks.create_download(request.batch_id, idempotency_key)
    except KeyError:
        error("BATCH_NOT_FOUND", "资料加工任务不存在", 404)


@app.get("/api/download/tasks")
def list_download_tasks(batch_id: str | None = Query(default=None, alias="batchId")):
    items = tasks.list(batch_id)
    return {"items": items, "total": len(items)}


@app.get("/api/download/tasks/{task_id}", response_model=TaskSnapshot)
def get_download_task(task_id: str):
    try:
        return tasks.get(task_id)
    except KeyError:
        error("TASK_NOT_FOUND", "任务不存在", 404)


@app.post("/api/download/tasks/{task_id}/retry", response_model=TaskSnapshot)
def retry_download_task(task_id: str):
    try:
        return tasks.retry(task_id)
    except KeyError:
        error("TASK_NOT_FOUND", "任务不存在", 404)


@app.post("/api/download/tasks/{task_id}/resume", response_model=TaskSnapshot)
def resume_download_task(task_id: str):
    try:
        return tasks.resume(task_id)
    except KeyError:
        error("TASK_NOT_FOUND", "任务不存在", 404)


@app.get("/api/download/tasks/{task_id}/items")
def list_download_task_items(
    task_id: str,
    state: str | None = Query(default=None, pattern="^(failed|warning|completed|pending)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, alias="pageSize", ge=1, le=100),
):
    try:
        return tasks.list_download_items(task_id, state, page, page_size)
    except KeyError:
        error("TASK_NOT_FOUND", "任务不存在", 404)
    except ValueError as exc:
        error("TASK_TYPE_INVALID", str(exc), 400)


@app.post("/api/download/tasks/{task_id}/pause")
def pause_download_task(task_id: str):
    try:
        task = tasks.get(task_id)
    except KeyError:
        error("TASK_NOT_FOUND", "任务不存在", 404)
    if not task.can_pause:
        error("TASK_PAUSE_UNSUPPORTED", "当前下载器只能在页面边界停止，暂不支持可靠暂停", 409)


@app.post("/api/download/tasks/{task_id}/cancel")
def cancel_download_task(task_id: str):
    try:
        task = tasks.get(task_id)
    except KeyError:
        error("TASK_NOT_FOUND", "任务不存在", 404)
    if not task.can_cancel:
        error("TASK_CANCEL_UNAVAILABLE", "任务当前不可取消", 409)


@app.get("/api/tasks/{task_id}/events")
def task_events(task_id: str, last_event_id: int = Query(default=0, alias="lastEventId")):
    try:
        tasks.get(task_id)
    except KeyError:
        error("TASK_NOT_FOUND", "任务不存在", 404)
    return StreamingResponse(
        tasks.events.stream(task_id, last_event_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/api/files/{resource_id}/metadata")
def file_metadata(resource_id: str):
    try:
        resource, _ = files.find(resource_id)
        return resource
    except (KeyError, FileNotFoundError):
        error("FILE_NOT_FOUND", "文件资源不存在", 404)


@app.get("/api/files/{resource_id}/preview")
def preview_file(resource_id: str):
    try:
        resource, path = files.find(resource_id)
    except (KeyError, FileNotFoundError):
        error("FILE_NOT_FOUND", "文件资源不存在", 404)
    if not resource.previewable:
        error("FILE_PREVIEW_UNSUPPORTED", "该文件类型不支持在线预览", 415)
    if path.suffix.lower() == ".pdf" or resource.media_type.startswith("image/"):
        return FileResponse(path, media_type=resource.media_type, filename=resource.name)
    return PlainTextResponse(path.read_text(encoding="utf-8", errors="replace"))


@app.get("/api/files/{resource_id}/preview-data", response_model=FilePreview)
def preview_file_data(resource_id: str):
    try:
        return files.preview(resource_id)
    except (KeyError, FileNotFoundError):
        error("FILE_NOT_FOUND", "文件资源不存在", 404)
    except ValueError as exc:
        error("FILE_PREVIEW_UNSUPPORTED", str(exc), 415)


@app.get("/api/files/{resource_id}/content")
def file_content(resource_id: str):
    try:
        resource, path = files.find(resource_id)
    except (KeyError, FileNotFoundError):
        error("FILE_NOT_FOUND", "文件资源不存在", 404)
    return FileResponse(
        path,
        media_type=resource.media_type,
        filename=resource.name,
        content_disposition_type="inline",
    )


@app.get("/api/files/{resource_id}/download")
def download_file(resource_id: str):
    try:
        resource, path = files.find(resource_id)
    except (KeyError, FileNotFoundError):
        error("FILE_NOT_FOUND", "文件资源不存在", 404)
    return FileResponse(path, media_type=resource.media_type, filename=resource.name)


@app.post("/api/preprocess/scan", response_model=ScanReport)
def scan_batch(request: DownloadTaskCreate):
    try:
        return preprocess.scan(request.batch_id)
    except KeyError:
        error("BATCH_NOT_FOUND", "资料加工任务不存在", 404)


@app.post("/api/preprocess/prepare", response_model=PreparationReport)
def prepare_batch(request: MaterialPrepareRequest):
    try:
        return preparation.prepare(request.batch_id, request.config)
    except KeyError:
        error("BATCH_NOT_FOUND", "资料加工任务不存在", 404)
    except PreparationServiceError as exc:
        error("PREPARATION_FAILED", str(exc), 400)


@app.post("/api/metadata/build", response_model=MetadataBuildReport)
def build_metadata(request: MetadataBuildRequest):
    try:
        return metadata_construction.build(request.batch_id)
    except KeyError:
        error("BATCH_NOT_FOUND", "资料加工任务不存在", 404)
    except MetadataConstructionError as exc:
        error("METADATA_BUILD_FAILED", str(exc), 400)


@app.post("/api/preprocess/preview")
def preview_preprocess(request: PreprocessPreviewRequest):
    try:
        return preprocess.preview(request)
    except KeyError:
        error("FILE_NOT_FOUND", "文件资源不存在或不属于该资料加工任务", 404)
    except ValueError as exc:
        error("PREVIEW_UNSUPPORTED", str(exc), 415)


@app.post("/api/preprocess/pipeline", response_model=TaskSnapshot, status_code=202)
def start_preprocess(request: PreprocessTaskCreate):
    try:
        return preprocess.start(request)
    except KeyError:
        error("BATCH_NOT_FOUND", "资料加工任务不存在", 404)


@app.get("/api/preprocess/pipeline/{task_id}", response_model=TaskSnapshot)
def get_preprocess_task(task_id: str):
    try:
        task = tasks.get(task_id)
    except KeyError:
        error("TASK_NOT_FOUND", "任务不存在", 404)
    if task.type != "preprocess":
        error("TASK_TYPE_MISMATCH", "任务不是预处理任务", 409)
    return task


@app.get("/api/datasets")
def list_datasets(batch_id: str | None = Query(default=None, alias="batchId")):
    items = preprocess.list_datasets(batch_id)
    return {"items": items, "total": len(items)}


@app.get("/api/datasets/{dataset_id}", response_model=DatasetVersion)
def get_dataset(dataset_id: str):
    try:
        return preprocess.get_dataset(dataset_id)
    except KeyError:
        error("DATASET_NOT_FOUND", "数据集版本不存在", 404)


@app.post("/api/training/tasks", response_model=TaskSnapshot, status_code=202)
def start_training(request: TrainingTaskCreate):
    try:
        return training.start(request)
    except KeyError:
        error("BATCH_NOT_FOUND", "资料加工任务不存在", 404)
    except ValueError as exc:
        error("BATCH_NOT_READY", str(exc), 409, retryable=True)
    except ModelTestRequiredError as exc:
        error("MODEL_TEST_REQUIRED", str(exc), 409, retryable=True)


@app.get("/api/training/model-config")
def training_model_config():
    try:
        return training.model_config()
    except ModelGatewayError as exc:
        error("MODEL_GATEWAY_UNAVAILABLE", str(exc), 503, retryable=True)


@app.put("/api/training/model-config")
def update_training_model_config(request: TrainingModelConfigUpdate):
    error(
        "MODEL_CONFIG_READ_ONLY",
        "素材平台只继承 YashanDB 知识库文档生成器的模型配置，请在文档生成器中修改",
        405,
    )


@app.post("/api/training/model-test")
def test_training_model():
    try:
        return training.test_model()
    except ModelGatewayError as exc:
        error("MODEL_TEST_FAILED", error_summary(exc), 502, retryable=True, technicalMessage=str(exc))


@app.post("/api/training/preflight")
def training_preflight(request: TrainingTaskCreate):
    try:
        return training.preflight(request)
    except KeyError:
        error("BATCH_NOT_FOUND", "资料加工任务不存在", 404)
    except ValueError as exc:
        error("BATCH_NOT_READY", str(exc), 409, retryable=True)
    except ModelGatewayError as exc:
        error("MODEL_GATEWAY_UNAVAILABLE", str(exc), 503, retryable=True)


@app.get("/api/training/tasks")
def list_training_tasks(batch_id: str | None = Query(default=None, alias="batchId")):
    items = training.list(batch_id)
    return {"items": items, "total": len(items)}


@app.get("/api/training/tasks/{task_id}", response_model=TaskSnapshot)
def get_training_task(task_id: str):
    try:
        return training.get(task_id)
    except KeyError:
        error("TASK_NOT_FOUND", "训练任务不存在", 404)
    except ValueError as exc:
        error("TASK_TYPE_MISMATCH", str(exc), 409)


@app.post("/api/training/tasks/{task_id}/cancel", response_model=TaskSnapshot)
def cancel_training_task(task_id: str):
    try:
        return training.cancel(task_id)
    except KeyError:
        error("TASK_NOT_FOUND", "训练任务不存在", 404)
    except ValueError as exc:
        error("TASK_CANCEL_UNAVAILABLE", str(exc), 409)


@app.get("/api/training/tasks/{task_id}/logs")
def training_task_logs(
    task_id: str,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=200, ge=1, le=1000),
):
    try:
        return training.logs(task_id, offset, limit)
    except KeyError:
        error("TASK_NOT_FOUND", "训练任务不存在", 404)
    except ValueError as exc:
        error("TASK_TYPE_MISMATCH", str(exc), 409)


@app.get("/api/training/tasks/{task_id}/review-items")
def training_review_items(task_id: str):
    try:
        items = training.review_items(task_id)
        return {"items": items, "total": len(items)}
    except KeyError:
        error("TASK_NOT_FOUND", "训练任务不存在", 404)
    except ValueError as exc:
        error("TASK_TYPE_MISMATCH", str(exc), 409)


@app.get("/api/training/tasks/{task_id}/quality-issues")
def training_quality_issues(
    task_id: str,
    severity: str | None = Query(default=None, pattern="^(info|warning|error|critical|high|unknown)$"),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
):
    try:
        return training.quality_issues(task_id, severity, offset, limit)
    except KeyError:
        error("TASK_NOT_FOUND", "训练任务不存在", 404)
    except ValueError as exc:
        error("TASK_TYPE_MISMATCH", str(exc), 409)


@app.post("/api/training/tasks/{task_id}/review-items/{item_id}/decision")
def decide_training_review_item(task_id: str, item_id: str, decision: TrainingReviewDecision):
    try:
        return training.decide_review_item(task_id, item_id, decision)
    except KeyError:
        error("REVIEW_ITEM_NOT_FOUND", "待确认项不存在", 404)
    except ValueError as exc:
        error("REVIEW_DECISION_INVALID", str(exc), 409)


@app.get("/api/training/tasks/{task_id}/events")
def training_task_events(task_id: str, last_event_id: int = Query(default=0, alias="lastEventId")):
    try:
        training.get(task_id)
    except KeyError:
        error("TASK_NOT_FOUND", "训练任务不存在", 404)
    except ValueError as exc:
        error("TASK_TYPE_MISMATCH", str(exc), 409)
    return StreamingResponse(
        tasks.events.stream(task_id, last_event_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/api/datasets/{dataset_id}/graph/summary")
def graph_summary(dataset_id: str):
    try:
        return training.graph(dataset_id, "summary")
    except KeyError:
        error("DATASET_NOT_FOUND", "数据集版本不存在", 404)
    except FileNotFoundError:
        error("GRAPH_NOT_AVAILABLE", "该数据集尚无知识图谱产物", 404)


@app.post("/api/datasets/{dataset_id}/graph/repair")
def repair_dataset_graph(dataset_id: str):
    try:
        return training.repair_dataset_graph(dataset_id)
    except KeyError:
        error("DATASET_NOT_FOUND", "数据集版本不存在", 404)
    except FileNotFoundError:
        error("GRAPH_REPAIR_UNAVAILABLE", "该数据集缺少可回填的知识加工产物", 404)


@app.post("/api/datasets/{dataset_id}/keywords/{keyword_id}/status")
def update_keyword_status(dataset_id: str, keyword_id: str, request: KeywordStatusUpdate):
    try:
        return training.update_keyword_status(dataset_id, keyword_id, request.status)
    except KeyError:
        error("KEYWORD_NOT_FOUND", "数据集版本或关键词不存在", 404)
    except FileNotFoundError:
        error("GRAPH_NOT_AVAILABLE", "该数据集尚无关键词图谱产物", 404)
    except ValueError as exc:
        error("KEYWORD_STATUS_INVALID", str(exc), 409)


@app.post("/api/datasets/{dataset_id}/keywords/filter-by-prompt")
def filter_keywords_by_prompt(dataset_id: str, request: dict):
    """根据用户提示词批量过滤关键词"""
    try:
        prompt = request.get("prompt", "")
        if not prompt:
            return {"success": False, "error": "提示词不能为空"}
        return training.filter_keywords_by_prompt(dataset_id, prompt)
    except FileNotFoundError:
        error("DATASET_NOT_FOUND", "数据集不存在或图谱未生成", 404)
    except Exception as exc:
        error("KEYWORD_FILTER_FAILED", str(exc), 500)


@app.post("/api/datasets/{dataset_id}/keywords/business-review")
def review_keyword_business(dataset_id: str):
    try:
        return training.review_keyword_business(dataset_id)
    except KeyError:
        error("DATASET_NOT_FOUND", "数据集版本或关键词不存在", 404)
    except FileNotFoundError:
        error("GRAPH_NOT_AVAILABLE", "该数据集尚无关键词图谱产物", 404)


@app.post("/api/datasets/{dataset_id}/keywords/{keyword_id}/business-status")
def update_keyword_business_status(dataset_id: str, keyword_id: str, request: KeywordBusinessStatusUpdate):
    try:
        return training.update_keyword_business_status(
            dataset_id,
            keyword_id,
            request.business_status,
            request.reason_code,
            request.note,
            request.operator_label,
        )
    except KeyError:
        error("KEYWORD_NOT_FOUND", "数据集版本或关键词不存在", 404)
    except FileNotFoundError:
        error("GRAPH_NOT_AVAILABLE", "该数据集尚无关键词图谱产物", 404)
    except ValueError as exc:
        error("KEYWORD_BUSINESS_STATUS_INVALID", str(exc), 409)


@app.post("/api/datasets/{dataset_id}/keywords/{keyword_id}/admission")
def update_keyword_admission(dataset_id: str, keyword_id: str, request: KeywordAdmissionUpdate):
    try:
        return training.update_keyword_admission(dataset_id, keyword_id, request.admission_status, request.note, request.operator_label)
    except KeyError:
        error("KEYWORD_NOT_FOUND", "数据集版本或关键词不存在", 404)
    except FileNotFoundError:
        error("GRAPH_NOT_AVAILABLE", "该数据集尚无关键词图谱产物", 404)
    except ValueError as exc:
        error("KEYWORD_ADMISSION_INVALID", str(exc), 409)


@app.post("/api/datasets/{dataset_id}/keywords/l2-terms", status_code=201)
def create_l2_term(dataset_id: str, request: L2TermCreate):
    try:
        return training.create_l2_term(dataset_id, request.name, request.canonical_name, request.description, request.linked_l1_ids)
    except KeyError:
        error("DATASET_NOT_FOUND", "数据集版本不存在", 404)
    except FileNotFoundError:
        error("GRAPH_NOT_AVAILABLE", "该数据集尚无关键词图谱产物", 404)
    except ValueError as exc:
        error("L2_TERM_INVALID", str(exc), 409)


@app.post("/api/datasets/{dataset_id}/keywords/{keyword_id}/links")
def create_keyword_link(dataset_id: str, keyword_id: str, request: KeywordLinkCreate):
    try:
        return training.create_keyword_link(dataset_id, keyword_id, request.target_id, request.weight, request.evidence_chunk_ids)
    except KeyError:
        error("KEYWORD_NOT_FOUND", "数据集版本或关键词不存在", 404)
    except FileNotFoundError:
        error("GRAPH_NOT_AVAILABLE", "该数据集尚无关键词图谱产物", 404)
    except ValueError as exc:
        error("KEYWORD_LINK_INVALID", str(exc), 409)


@app.get("/api/datasets/{dataset_id}/graph/term-expansion")
def expand_l2_term(
    dataset_id: str,
    term_id: str = Query(..., description="L2 术语节点 ID"),
    limit: int = Query(default=50, ge=1, le=500),
):
    try:
        return training.expand_l2_term(dataset_id, term_id, limit)
    except KeyError:
        error("KEYWORD_NOT_FOUND", "数据集版本或术语不存在", 404)
    except FileNotFoundError:
        error("GRAPH_NOT_AVAILABLE", "该数据集尚无关键词图谱产物", 404)


@app.post("/api/datasets/{dataset_id}/formal-knowledge/tasks", response_model=TaskSnapshot, status_code=202)
def start_formal_knowledge_task(dataset_id: str):
    try:
        return training.start_formal_knowledge_task(dataset_id)
    except KeyError:
        error("DATASET_NOT_FOUND", "数据集版本不存在", 404)
    except FileNotFoundError:
        error("GRAPH_NOT_AVAILABLE", "该数据集尚无关键词图谱产物", 404)
    except ValueError as exc:
        error("FORMAL_KNOWLEDGE_NOT_READY", str(exc), 409, retryable=True)
    except ModelTestRequiredError as exc:
        error("MODEL_TEST_REQUIRED", str(exc), 409, retryable=True)


@app.get("/api/datasets/{dataset_id}/graph/nodes")
def graph_nodes(
    dataset_id: str,
    offset: int = 0,
    limit: int = Query(default=100, ge=1, le=1000),
    node_type: str | None = None,
    type_: str | None = Query(default=None, alias="type"),
):
    try:
        items = training.graph(dataset_id, "nodes")
    except KeyError:
        error("DATASET_NOT_FOUND", "数据集版本不存在", 404)
    except FileNotFoundError:
        error("GRAPH_NOT_AVAILABLE", "该数据集尚无知识图谱产物", 404)
    expected_type = node_type or type_
    if expected_type:
        items = [item for item in items if str(item.get("type")) == expected_type]
    return {"items": items[offset:offset + limit], "total": len(items), "offset": offset, "limit": limit}


@app.get("/api/datasets/{dataset_id}/graph/edges")
def graph_edges(dataset_id: str, offset: int = 0, limit: int = Query(default=100, ge=1, le=1000)):
    try:
        items = training.graph(dataset_id, "edges")
    except KeyError:
        error("DATASET_NOT_FOUND", "数据集版本不存在", 404)
    except FileNotFoundError:
        error("GRAPH_NOT_AVAILABLE", "该数据集尚无知识图谱产物", 404)
    return {"items": items[offset:offset + limit], "total": len(items), "offset": offset, "limit": limit}


@app.get("/api/datasets/{dataset_id}/graph/neighborhood")
def graph_neighborhood(dataset_id: str, node_id: str = Query(alias="nodeId"), limit: int = Query(default=50, ge=1, le=200)):
    try:
        return training.graph_neighborhood(dataset_id, node_id, limit)
    except KeyError:
        error("DATASET_NOT_FOUND", "数据集版本不存在或节点不存在", 404)
    except FileNotFoundError:
        error("GRAPH_NOT_AVAILABLE", "该数据集尚无知识图谱产物", 404)


@app.post("/api/datasets/{dataset_id}/publish", response_model=DatasetVersion)
def publish_dataset(dataset_id: str, force: bool = False):
    try:
        return preprocess.publish(dataset_id, force)
    except KeyError:
        error("DATASET_NOT_FOUND", "数据集版本不存在", 404)
    except ValueError as exc:
        error("QUALITY_GATE_FAILED", str(exc), 409)


@app.delete("/api/datasets/{dataset_id}", response_model=DatasetVersion)
def delete_dataset(dataset_id: str, request: DatasetDeletionRequest):
    try:
        return preprocess.delete_dataset(dataset_id, request.operator, request.reason)
    except KeyError:
        error("DATASET_NOT_FOUND", "数据集版本不存在", 404)
    except ValueError as exc:
        error("DATASET_DELETE_FAILED", str(exc), 409)


@app.get("/api/quality/reports/{dataset_id}")
def quality_report(dataset_id: str):
    try:
        dataset = training.ensure_dataset_graph(dataset_id)
    except KeyError:
        error("DATASET_NOT_FOUND", "数据集版本不存在", 404)
    except FileNotFoundError:
        try:
            dataset = preprocess.get_dataset(dataset_id)
        except KeyError:
            error("DATASET_NOT_FOUND", "数据集版本不存在", 404)
    try:
        graph_summary = dict(training.graph(dataset_id, "summary") or {})
    except (KeyError, FileNotFoundError):
        graph_summary = dict(dataset.graph_summary or {})
    graph_source = str(graph_summary.get("graphSource") or "").strip()
    graph_has_content = any(
        graph_summary.get(key)
        for key in ("nodeCount", "edgeCount", "keywordCount", "contextEdgeCount")
    )
    graph_available = bool(dataset.graph_available and (graph_source or graph_has_content))
    return {
        "datasetVersionId": dataset.id,
        "batchId": dataset.batch_id,
        "qualityPassed": dataset.quality_passed,
        "metrics": dataset.quality_metrics,
        "generatedAt": dataset.created_at,
        "graph": (
            {"available": True, **graph_summary}
            if graph_available
            else {
                "available": False,
                "reason": (
                    "该数据集的知识图谱尚未完成回填"
                    if dataset.training_task_id and int((dataset.quality_metrics or {}).get("knowledgeCount") or 0) == 0
                    else "该数据集尚未执行知识图谱训练"
                ),
            }
        ),
        "retrievalEvaluation": {"available": False, "reason": "固定检索评测集尚未配置"},
    }

# ========== 知识索引 API ==========

@app.get("/api/index/directory-tree")
def get_directory_tree():
    """获取层次目录索引"""
    return index_service.get_directory_tree()


@app.get("/api/index/search")
def search_knowledge(query: str = Query(default=""), limit: int = Query(default=20, ge=1, le=100)):
    """搜索知识点"""
    results = index_service.search(query, limit)
    return {"items": results, "total": len(results), "query": query}


@app.get("/api/index/graph")
def get_knowledge_graph(depth: int = Query(default=2, ge=1, le=5)):
    """获取知识图谱"""
    return index_service.get_knowledge_graph(depth)


@app.get("/api/index/knowledge/{kp_id}")
def get_knowledge_point(kp_id: str):
    """获取单个知识点详情"""
    kp = index_service.get_knowledge_point(kp_id)
    if not kp:
        error("KNOWLEDGE_POINT_NOT_FOUND", "知识点不存在", 404)
    return kp


@app.get("/api/index/stats")
def get_index_stats():
    """获取索引统计信息"""
    return index_service.get_index_stats()


# ========== 前端静态文件服务 ==========

_frontend_dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
_legacy_frontend = Path(__file__).resolve().parents[5] / "agent-runner" / "frontend"

if _legacy_frontend.exists():
    @app.get("/prompt-generator.html")
    async def serve_prompt_generator():
        return FileResponse(_legacy_frontend / "prompt-generator.html")

    for _legacy_mount in ("css", "js"):
        _legacy_dir = _legacy_frontend / _legacy_mount
        if _legacy_dir.exists():
            app.mount(
                f"/{_legacy_mount}",
                StaticFiles(directory=str(_legacy_dir)),
                name=f"legacy-{_legacy_mount}",
            )

if _frontend_dist.exists():
    # 挂载静态资源目录（带内容哈希，支持长期缓存）
    _assets_dir = _frontend_dist / "assets"
    if _assets_dir.exists():
        app.mount(
            "/pingcode-materials/assets",
            StaticFiles(directory=str(_assets_dir)),
            name="static-assets",
        )

    @app.get("/")
    async def redirect_to_frontend():
        return RedirectResponse(url="/pingcode-materials/")

    # 根路径重定向到前端
    @app.get("/pingcode-materials/")
    async def serve_frontend_root():
        return FileResponse(_frontend_dist / "index.html")

    # SPA 路由回退：所有 /pingcode-materials/* 非 API 路由返回 index.html
    @app.get("/pingcode-materials/{full_path:path}")
    async def serve_spa_fallback(full_path: str):
        # 尝试返回实际文件（如 runtime-config.json）
        file_path = _frontend_dist / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(_frontend_dist / "index.html")
