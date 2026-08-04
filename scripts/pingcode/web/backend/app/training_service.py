from __future__ import annotations

import hashlib
import json
import re
import shutil
import threading
import time
import uuid
from copy import deepcopy
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from math import ceil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from jsonschema import ValidationError, validate

from .agents import KnowledgeExtractionWorkflowAgent, AgentTask
from .config import settings
from .markdown_cleaning import clean_markdown
from .models import DatasetVersion, PreprocessTaskCreate, TaskSnapshot, TrainingReviewDecision, TrainingTaskCreate
from .processing_units import build_processing_units


TERMINAL_STATES = {"completed", "failed", "cancelled"}
STAGES = [
    "material_preparation",
    "knowledge_extraction",
    "index_generation",
]
STAGE_NAMES = {
    "material_preparation": "资料预处理",
    "knowledge_extraction": "知识提取",
    "index_generation": "索引生成",
}
STAGE_ALIASES = {
    "metadata_construction": "material_preparation",
    "deterministic_extraction": "knowledge_extraction",
    "semantic_enrichment": "knowledge_extraction",
    "validation_graph": "knowledge_extraction",
    "dataset_generation": "index_generation",
}
DEFAULT_MAX_DIRECT_CHARACTERS = 12000
MAX_METADATA_GRAPH_KEYWORDS_PER_CHUNK = 12
GRAPH_SCHEMA_VERSION = 4
DISPLAY_NAME_PREFIX_PATTERN = re.compile(r"^[0-9a-fA-F]{8,24}-")
TECHNICAL_KEYWORD_PREFIXES = ("dataset_", "file_", "chunk_", "resource_", "document_", "task_", "batch_", "run_", "node_", "edge_", "unit_")

# 关键词排除规则：工单号、人名等不应作为关键词
EXCLUDED_KEYWORD_PATTERNS = [
    re.compile(r"^YDBRD[-\s]?\d+", re.IGNORECASE),  # YDBRD-xxxxx 需求编号
    re.compile(r"^YASHAN[-\s]?\d+", re.IGNORECASE),  # YASHAN-xxxxx
    re.compile(r"^[0-9a-f]{8}\s", re.IGNORECASE),   # 文件哈希 ID 开头的标题
]

# 常见人名检测模式（中文2-4字，英文姓+名）
PERSON_NAME_PATTERNS = [
    re.compile(r"^[一-鿿]{2,4}$"),  # 纯中文2-4字可能是人名
]
KNOWLEDGE_NODE_TYPES = {
    "KnowledgePoint", "Keyword", "Parameter", "Concept", "Component", "Configuration",
    "Version", "ErrorCode", "YashanDBErrorCode", "OracleErrorCode", "Procedure",
    "Principle", "Decision", "Constraint", "Symptom", "Solution",
}
WHY_HINTS = ("为什么", "原因", "根因", "因为", "导致", "影响", "风险", "约束", "限制", "取舍", "设计", "目的", "问题", "失败", "异常", "报错")
HOW_HINTS = ("如何", "怎么", "步骤", "流程", "方法", "方案", "配置", "部署", "启动", "迁移", "修复", "处理", "实现", "使用", "操作", "接入", "验证", "测试")
SYMPTOM_HINTS = ("报错", "异常", "失败", "超时", "不可用", "无法", "错误")
SOLUTION_HINTS = ("修复", "解决", "处理", "规避", "配置", "执行", "重启", "验证")
CONSTRAINT_HINTS = ("限制", "约束", "不能", "不允许", "必须", "风险", "边界")
DECISION_HINTS = ("设计", "取舍", "方案", "选择", "决策", "对比")
TASK_CONTEXT_HINTS = {
    "troubleshooting": ("报错", "异常", "失败", "修复", "定位", "根因", "超时"),
    "design": ("设计", "架构", "方案", "取舍", "原则", "模型"),
    "configuration": ("配置", "参数", "环境变量", "部署", "启动"),
    "testing": ("测试", "验证", "用例", "断言", "覆盖"),
    "migration": ("迁移", "升级", "兼容", "替换", "切换"),
}


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def stable_id(prefix: str, *values: str) -> str:
    digest = hashlib.sha256("\x1f".join(values).encode("utf-8")).hexdigest()[:20]
    return f"{prefix}:{digest}"


def error_summary(error: BaseException) -> str:
    technical_error = str(error)
    normalized = technical_error.lower()
    if "country, region, or territory not supported" in normalized:
        return "模型服务拒绝访问（HTTP 403，当前网络所在国家或地区不受支持）"
    if re.search(r"\b(http\s*)?401\b", normalized):
        return "模型服务身份认证失败（HTTP 401）"
    if re.search(r"\b(http\s*)?403\b", normalized):
        return "模型服务拒绝访问（HTTP 403）"
    if re.search(r"\b(http\s*)?429\b", normalized):
        return "模型服务请求过于频繁（HTTP 429）"
    if "connection refused" in normalized or "econnrefused" in normalized or "errno 111" in normalized:
        return "模型服务连接失败"
    if "timed out" in normalized or "timeout" in normalized or "超时" in technical_error:
        return "模型调用超时"
    if (
        "jsondecodeerror" in normalized
        or "invalid json" in normalized
        or "expecting value" in normalized
        or "未返回 json 对象" in technical_error.lower()
        or "无法解析为 json" in normalized
        or "不符合输出结构" in technical_error
    ):
        return "模型返回格式不正确"
    http_status = re.search(r"\b(?:http\s*)?(5\d{2})\b", normalized)
    if http_status:
        return f"模型服务暂时不可用（HTTP {http_status.group(1)}）"
    return "模型服务返回错误"


class ModelGatewayError(RuntimeError):
    pass


class ModelTestRequiredError(RuntimeError):
    pass


class TrainingCancelledError(RuntimeError):
    pass


class ModelGatewayClient:
    def __init__(self, base_url: str, token: str = "", timeout: int = 180):
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.timeout = timeout

    def status(self) -> dict[str, Any]:
        return self._request("GET", "/status")

    def update_config(self, config: dict[str, Any]) -> dict[str, Any]:
        return self._request("POST", "/config", config)

    def test(self) -> dict[str, Any]:
        return self._request("POST", "/test", {}, timeout=60)

    def chat_json(self, messages: list[dict[str, str]], options: dict[str, Any] | None = None) -> dict[str, Any]:
        options = options or {}
        request_timeout = self.timeout
        if isinstance(options.get("timeout_ms"), (int, float)):
            attempts = max(1, int(options.get("max_retries", 0)) + 1)
            request_timeout = ceil(options["timeout_ms"] / 1000) * attempts + 10
        result = self._request(
            "POST",
            "/chat",
            {"messages": messages, "responseFormat": "json", "options": options},
            timeout=request_timeout,
        )
        data = result.get("data")
        if not isinstance(data, dict):
            raise ModelGatewayError("模型网关未返回 JSON 对象")
        return result

    def _request(self, method: str, path: str, payload: dict[str, Any] | None = None, *, timeout: int | None = None) -> dict[str, Any]:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8") if payload is not None else None
        headers = {"Content-Type": "application/json"}
        if self.token:
            headers["X-Internal-Token"] = self.token
        request = Request(f"{self.base_url}{path}", data=body, method=method, headers=headers)
        try:
            with urlopen(request, timeout=timeout or self.timeout) as response:
                return json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            try:
                message = json.loads(detail).get("error", {}).get("message", detail)
            except json.JSONDecodeError:
                message = detail
            raise ModelGatewayError(f"模型网关 HTTP {exc.code}: {message}") from exc
        except (URLError, TimeoutError, json.JSONDecodeError) as exc:
            raise ModelGatewayError(f"模型网关不可用: {exc}") from exc


class TrainingService:
    def __init__(
        self,
        store,
        batches,
        tasks,
        preprocess,
        prompts,
        preparation=None,
        metadata_construction=None,
        gateway: ModelGatewayClient | None = None,
    ):
        self.store = store
        self.batches = batches
        self.tasks = tasks
        self.preprocess = preprocess
        self.prompts = prompts
        self.preparation = preparation
        self.metadata_construction = metadata_construction
        self.gateway = gateway or ModelGatewayClient(
            settings.model_gateway_url,
            settings.model_gateway_token,
            settings.model_gateway_timeout,
        )
        self._event_lock = threading.RLock()
        self._review_lock = threading.RLock()
        self._model_test_lock = threading.RLock()
        self._model_test_result: dict[str, Any] | None = None
        self._child_task_lock = threading.RLock()
        self._child_tasks: dict[str, str] = {}
        self._active_task_lock = threading.RLock()
        self._active_task_ids: set[str] = set()
        self._reconcile_lock = threading.RLock()


        # 初始化 Workflow Agent
        default_skill_root = Path(__file__).resolve().parents[3] / "processing" / "skills"
        skill_root = getattr(settings, "processing_skill_root", default_skill_root)
        self.extraction_agent = KnowledgeExtractionWorkflowAgent({
            "prompts": self.prompts,
            "gateway": self.gateway,
            "skill_root": str(skill_root),
        })
    def model_config(self) -> dict[str, Any]:
        status = self.gateway.status()
        keyword_prompt = self.prompts.get("keyword-extraction.system")
        keyword_skill = self.prompts.skills.get("keyword-extraction", keyword_prompt.skill_version)
        keyword_defaults = keyword_skill.manifest.get("defaults", {})
        formal_prompt = self.prompts.get("knowledge-point-extraction.system")
        formal_skill = self.prompts.skills.get("knowledge-point-extraction", formal_prompt.skill_version)
        formal_defaults = formal_skill.manifest.get("defaults", {})
        return {
            "provider": status.get("provider"),
            "model": status.get("model"),
            "baseUrl": status.get("baseUrl"),
            "temperature": status.get("temperature", 0.7),
            "maxTokens": status.get("maxTokens", 4000),
            "timeoutMs": status.get("timeoutMs", 180000),
            "apiKeyConfigured": bool(status.get("apiKeyConfigured")),
            "configured": bool(status.get("configured")),
            "capabilities": status.get("capabilities", {}),
            "keywordAnalysis": {
                "maxTokens": int(keyword_defaults.get("maxTokens", 1800)),
                "timeoutMs": int(keyword_defaults.get("timeoutMs", 45000)),
                "maxRetries": int(keyword_defaults.get("maxRetries", 1)),
                "concurrency": int(keyword_defaults.get("concurrency", 1)),
                "maxChunksPerBatch": int(keyword_defaults.get("maxChunksPerBatch", keyword_defaults.get("batchSize", 3))),
                "maxBatchInputCharacters": int(keyword_defaults.get("maxBatchInputCharacters", 14000)),
                "maxCandidatesPerChunk": int(keyword_defaults.get("maxCandidatesPerChunk", 4)),
                "repairRetries": int(keyword_defaults.get("repairRetries", 1)),
                "slowResponseMs": int(keyword_defaults.get("slowResponseMs", 30000)),
            },
            "formalKnowledge": {
                "maxTokens": int(formal_defaults.get("maxTokens", 4000)),
                "timeoutMs": int(formal_defaults.get("timeoutMs", 60000)),
                "maxRetries": int(formal_defaults.get("maxRetries", 0)),
                "concurrency": int(formal_defaults.get("concurrency", 1)),
                "batchSize": int(formal_defaults.get("batchSize", 3)),
            },
            "lastTest": self._valid_model_test(status),
        }

    def update_model_config(self, config: dict[str, Any]) -> dict[str, Any]:
        payload = {
            "provider": config["provider"],
            "model": config["model"],
            "base_url": config["baseUrl"],
            "temperature": config["temperature"],
            "max_tokens": config["maxTokens"],
            "timeout": config["timeoutMs"],
        }
        if config.get("apiKey"):
            payload["api_key"] = config["apiKey"]
        result = self.gateway.update_config(payload)
        with self._model_test_lock:
            self._model_test_result = None
        return {**result, "lastTest": None}

    def test_model(self) -> dict[str, Any]:
        result = self.gateway.test()
        status = self.gateway.status()
        cached = {
            **result,
            "fingerprint": self._model_fingerprint(status),
            "expiresAt": datetime.fromtimestamp(time.time() + 600, timezone.utc).isoformat(),
        }
        with self._model_test_lock:
            self._model_test_result = cached
        public_result = dict(cached)
        public_result.pop("fingerprint", None)
        return public_result

    def preflight(self, request: TrainingTaskCreate) -> dict[str, Any]:
        self._require_batch_ready(request.batch_id)
        model = self.model_config()
        if self.preparation is not None:
            return self._preflight_with_material_preparation(request, model)
        documents = self.preprocess.files.list_processing_sources(request.batch_id)
        chunk_count = 0
        uncertain_count = 0
        largest_characters = 0
        largest_unit_characters = 0
        unit_fingerprints: list[dict[str, str]] = []
        for resource in documents:
            _, path = self.preprocess.files.find(resource.id)
            original = path.read_text(encoding="utf-8", errors="replace")
            cleaning = clean_markdown(
                original,
                request.config.preset,
                exclude_c_code_blocks=request.config.exclude_c_code_blocks,
            )
            source_path = getattr(resource, "logical_path", None) or getattr(resource, "name", None) or resource.id
            _, units = build_processing_units(
                cleaning, resource.id, source_path, request.config
            )
            chunk_count += len(units)
            unit_fingerprints.extend({
                "chunkId": str(item["chunkId"]),
                "resourceId": str(item["resourceId"]),
                "contentHash": str(item["contentHash"]).removeprefix("sha256:"),
            } for item in units)
            largest_characters = max(largest_characters, len(cleaning.content))
            largest_unit_characters = max(
                largest_unit_characters,
                max((len(item["content"]) for item in units), default=0),
            )
            for unit in units:
                content = unit["content"]
                _, uncertain = self._rule_extract_chunk({
                    "id": unit["chunkId"],
                    "resourceId": resource.id,
                    "sourcePath": source_path,
                    "content": content,
                }, {"resourceId": resource.id})
                uncertain_count += len(uncertain)
        total_calls = chunk_count + uncertain_count
        last_test = model.get("lastTest")
        latency = int(last_test.get("latencyMs", 0)) if last_test else 0
        workload_latency = max(latency * 2, 5000) if latency else 0
        estimated_ms = int(workload_latency * ceil(total_calls / 3)) if workload_latency else 0
        risks = []
        if not documents:
            risks.append("当前批次没有可加工的文本文件")
        if not last_test:
            risks.append("当前模型尚未通过最近 10 分钟内的真实结构化连接测试")
        risks.append(f"知识提取预计调用 {chunk_count} 次；初步识别到 {uncertain_count} 个按需语义补充项")
        if last_test:
            risks.append("预计耗时包含知识提取和按需语义补充；流水线调度、预处理、校验和构图由代码执行")
        config = request.config.model_dump(mode="json", by_alias=True)
        input_hash = self._processing_unit_input_hash(config, unit_fingerprints)
        preflight_id = f"preflight_{uuid.uuid4().hex[:16]}"
        result = {
            "preflightId": preflight_id,
            "batchId": request.batch_id,
            "documentCount": len(documents),
            "estimatedChunkCount": chunk_count,
            "largestDocumentCharacters": largest_characters,
            "largestUnitCharacters": largest_unit_characters,
            "config": config,
            "configSource": "service_default",
            "inputHash": input_hash,
            "semanticUncertainItems": uncertain_count,
            "totalModelCalls": total_calls,
            "estimatedDurationMs": {"minimum": int(estimated_ms * 0.8), "maximum": int(estimated_ms * 1.5)} if estimated_ms else None,
            "modelTestPassed": bool(last_test),
            "modelTestExpiresAt": last_test.get("expiresAt") if last_test else None,
            "canStart": bool(documents and last_test),
            "risks": risks,
            "createdAt": utcnow().isoformat(),
        }
        self._write_json(
            settings.data_root / "batches" / request.batch_id / "training-preflight" / "latest.json",
            result,
        )
        return result

    def _preflight_with_material_preparation(self, request: TrainingTaskCreate, model: dict[str, Any]) -> dict[str, Any]:
        preparation_report = self.preparation.prepare(
            request.batch_id,
            request.config,
            parent_task_id=None,
            stage_run_id="preflight",
        )
        preparation_root = (settings.data_root / preparation_report.manifest_path).resolve().parent
        source_documents = self._read_jsonl(preparation_root / "metadata/source-documents.jsonl")
        chunks = self._read_jsonl(preparation_root / "metadata/chunks.jsonl")
        manifest = self._read_json(preparation_root / "manifest.json", {})
        resources = manifest.get("resources", []) if isinstance(manifest, dict) else []
        issues = manifest.get("issues", []) if isinstance(manifest, dict) else []
        unit_fingerprints = [{
            "chunkId": str(item["chunkId"]),
            "resourceId": str(item["resourceId"]),
            "contentHash": str(item.get("contentHash") or "").removeprefix("sha256:"),
        } for item in chunks]
        chunk_count = len(chunks)
        uncertain_count = 0
        largest_characters = 0
        largest_unit_characters = 0
        for chunk in chunks:
            content = str(chunk.get("content") or "")
            largest_characters = max(largest_characters, content and len(content) or 0)
            largest_unit_characters = max(largest_unit_characters, len(content))
            _, uncertain = self._rule_extract_chunk({
                "id": chunk.get("chunkId"),
                "resourceId": chunk.get("resourceId"),
                "sourcePath": chunk.get("sourcePath"),
                "content": content,
            }, {"resourceId": chunk.get("resourceId")})
            uncertain_count += len(uncertain)
        total_calls = chunk_count + uncertain_count
        last_test = model.get("lastTest")
        latency = int(last_test.get("latencyMs", 0)) if last_test else 0
        workload_latency = max(latency * 2, 5000) if latency else 0
        estimated_ms = int(workload_latency * ceil(total_calls / 3)) if workload_latency else 0
        direct_count = sum(1 for item in resources if item.get("formatFamily") in {"text", "web"} and item.get("processingStatus") in {"completed", "completed_with_warnings"})
        convertible_count = sum(1 for item in resources if item.get("formatFamily") in {"office", "pdf"} and item.get("processingStatus") in {"completed", "completed_with_warnings"})
        ocr_required = sum(1 for item in resources if item.get("processingStatus") == "ocr_required")
        conversion_failed = sum(1 for item in resources if item.get("processingStatus") == "conversion_failed")
        unsupported = sum(1 for item in resources if item.get("processingStatus") in {"conversion_pending", "quarantined"})
        warnings = [str(item.get("message") or item.get("code")) for item in issues if isinstance(item, dict)]
        risks = []
        if not source_documents:
            risks.append("当前批次没有可进入知识提取的处理单元")
        if not last_test:
            risks.append("当前模型尚未通过最近 10 分钟内的真实结构化连接测试")
        if ocr_required:
            risks.append(f"{ocr_required} 个 PDF 需要 OCR，当前不会进入知识加工")
        if conversion_failed:
            risks.append(f"{conversion_failed} 个文件转换失败，需查看源文件检查中的转换问题")
        risks.append(f"知识提取预计调用 {chunk_count} 次；初步识别到 {uncertain_count} 个按需语义补充项")
        if last_test:
            risks.append("预计耗时包含资料转换、知识提取和按需语义补充；流水线调度、预处理、校验和构图由代码执行")
        config = request.config.model_dump(mode="json", by_alias=True)
        input_hash = self._processing_unit_input_hash(config, unit_fingerprints)
        result = {
            "preflightId": f"preflight_{uuid.uuid4().hex[:16]}",
            "batchId": request.batch_id,
            "documentCount": len(source_documents),
            "processableCount": len(source_documents),
            "directTextCount": direct_count,
            "convertibleCount": convertible_count,
            "ocrRequiredCount": ocr_required,
            "unsupportedCount": unsupported,
            "conversionFailedCount": conversion_failed,
            "estimatedChunkCount": chunk_count,
            "largestDocumentCharacters": largest_characters,
            "largestUnitCharacters": largest_unit_characters,
            "config": config,
            "configSource": "service_default",
            "inputHash": input_hash,
            "semanticUncertainItems": uncertain_count,
            "totalModelCalls": total_calls,
            "estimatedDurationMs": {"minimum": int(estimated_ms * 0.8), "maximum": int(estimated_ms * 1.5)} if estimated_ms else None,
            "modelTestPassed": bool(last_test),
            "modelTestExpiresAt": last_test.get("expiresAt") if last_test else None,
            "canStart": bool(source_documents and last_test),
            "conversionWarnings": warnings,
            "risks": risks,
            "createdAt": utcnow().isoformat(),
        }
        self._write_json(
            settings.data_root / "batches" / request.batch_id / "training-preflight" / "latest.json",
            result,
        )
        return result

    def require_model_test(self) -> None:
        status = self.gateway.status()
        if not self._valid_model_test(status):
            raise ModelTestRequiredError("请先完成模型真实连接测试；测试成功后 10 分钟内可以启动加工")

    def _valid_model_test(self, status: dict[str, Any]) -> dict[str, Any] | None:
        with self._model_test_lock:
            result = dict(self._model_test_result) if self._model_test_result else None
        if not result or not result.get("success"):
            return None
        if result.get("fingerprint") != self._model_fingerprint(status):
            return None
        expires_at = result.get("expiresAt")
        if not expires_at or datetime.fromisoformat(expires_at) <= utcnow():
            return None
        result.pop("fingerprint", None)
        return result

    @staticmethod
    def _model_fingerprint(status: dict[str, Any]) -> str:
        values = {
            "provider": status.get("provider"),
            "model": status.get("model"),
            "baseUrl": status.get("baseUrl"),
            "maxTokens": status.get("maxTokens"),
            "timeoutMs": status.get("timeoutMs"),
            "apiKeyConfigured": bool(status.get("apiKeyConfigured")),
        }
        return hashlib.sha256(json.dumps(values, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()

    def start(self, request: TrainingTaskCreate) -> TaskSnapshot:
        self._reconcile_if_needed()
        batch = self._require_batch_ready(request.batch_id)
        self.require_model_test()
        now = utcnow()
        task_id = f"training_{uuid.uuid4().hex[:16]}"
        task = TaskSnapshot(
            id=task_id,
            batch_id=batch.id,
            type="graph",
            state="queued",
            stage="queued",
            total=len(STAGES),
            stages=[{
                "id": stage,
                "stageRunId": stable_id("stage-run", task_id, stage),
                "state": "pending",
            } for stage in STAGES],
            model_calls={"succeeded": 0, "failed": 0, "skipped": 0},
            can_cancel=True,
            created_at=now,
            updated_at=now,
        )
        self.tasks._save(task)
        self._mark_task_active(task.id)
        self.batches.update(batch.id, state="processing", activeTaskIds=[task.id])
        run_dir = self._run_dir(task.id)
        run_dir.mkdir(parents=True, exist_ok=True)
        self._log(task.id, "info", "queued", "task.queued", "训练任务已进入执行队列")
        threading.Thread(target=self._run, args=(task.id, request), daemon=True).start()
        return task

    def _require_batch_ready(self, batch_id: str):
        batch = self.batches.get(batch_id)
        if batch.state not in {"uploaded", "downloaded", "ready"}:
            raise ValueError("资料下载尚未完成，不能启动知识加工")
        if batch.active_task_ids:
            raise ValueError("当前资料加工任务仍有执行任务在运行，不能启动知识加工")
        if self.tasks is not None:
            for task in self.tasks.list(batch_id):
                if task.type == "download" and task.state != "completed":
                    raise ValueError("资料下载尚未完成，不能启动知识加工")
        return batch

    def cancel(self, task_id: str) -> TaskSnapshot:
        task = self._get_graph_task(task_id)
        if task.state in TERMINAL_STATES:
            raise ValueError("任务已经结束，无法取消")
        if task.state == "cancelling":
            return task
        if task.state not in {"queued", "running"}:
            raise ValueError("任务当前不可取消")
        updated = self.tasks._update(
            task_id,
            state="cancelling",
            can_cancel=False,
            message="正在取消任务",
            progress_detail={
                **task.progress_detail,
                "message": "正在等待当前操作结束后取消任务",
            },
        )
        self._log(
            task_id,
            "info",
            task.stage or "queued",
            "task.cancel.requested",
            "用户请求取消知识加工任务",
        )
        with self._child_task_lock:
            child_task_id = self._child_tasks.get(task_id)
        if child_task_id:
            self.preprocess.cancel(child_task_id)
        return updated

    def _raise_if_cancelled(self, task_id: str) -> None:
        if self.tasks.get(task_id).state in {"cancelling", "cancelled"}:
            raise TrainingCancelledError("用户取消了知识加工任务")

    def _complete_cancellation(self, task_id: str, batch_id: str) -> TaskSnapshot:
        current = self.tasks.get(task_id)
        current_stage = current.stage or "cancelled"
        if current_stage in STAGES:
            self._set_stage(task_id, current_stage, "cancelled", detail_message="用户已取消任务")
        updated = self.tasks._update(
            task_id,
            state="cancelled",
            stage="cancelled",
            message="任务已取消",
            can_cancel=False,
            can_retry=False,
            progress_detail={"stage": current_stage, "message": "任务已取消"},
        )
        self._log(
            task_id,
            "info",
            current_stage,
            "task.cancelled",
            "知识加工任务已取消",
        )
        self.batches.update(batch_id, state="downloaded", activeTaskIds=[])
        return updated

    def list(self, batch_id: str | None = None) -> list[TaskSnapshot]:
        self._reconcile_if_needed()
        items = self._list_graph_tasks()
        if batch_id:
            items = [item for item in items if item.batch_id == batch_id]
        return items

    def reconcile_interrupted(self) -> int:
        if self.tasks is None:
            return 0
        with self._reconcile_lock:
            active_ids = self._current_active_task_ids()
            interrupted = [
                item for item in self._list_graph_tasks()
                if item.state in {"queued", "running", "cancelling"} and item.id not in active_ids
            ]
            recovered_batches = self._reconcile_orphan_batch_active_tasks(active_ids)
        for task in interrupted:
            if task.state == "cancelling":
                self._complete_cancellation(task.id, task.batch_id)
                continue
            stage = task.stage if task.stage in STAGES else "failed"
            stages = []
            for item in task.stages:
                updated = dict(item)
                if item.get("id") == stage and item.get("state") in {"pending", "running"}:
                    updated["state"] = "failed"
                    updated["completedAt"] = utcnow().isoformat()
                stages.append(updated)
            message = "后端服务重启，原训练线程已中断；请重新启动端到端加工"
            self.tasks._update(
                task.id,
                state="failed",
                stage="failed",
                stages=stages,
                message=message,
                can_cancel=False,
                can_retry=True,
                progress_detail={"stage": stage, "message": message},
            )
            self._log(
                task.id,
                "error",
                stage,
                "task.interrupted",
                message,
                details={"reason": "backend_restart", "previousState": task.state},
            )
            if self.batches is not None:
                self.batches.update(task.batch_id, state="failed", activeTaskIds=[])
        return len(interrupted) + recovered_batches

    def _reconcile_if_needed(self) -> int:
        if self.batches is None or self.tasks is None:
            return 0
        return self.reconcile_interrupted()

    def _list_graph_tasks(self) -> list[TaskSnapshot]:
        return [item for item in self.tasks.list() if item.type == "graph"]

    def _mark_task_active(self, task_id: str) -> None:
        with self._active_task_lock:
            self._active_task_ids.add(task_id)

    def _mark_task_inactive(self, task_id: str) -> None:
        with self._active_task_lock:
            self._active_task_ids.discard(task_id)

    def _current_active_task_ids(self) -> set[str]:
        with self._active_task_lock:
            return set(self._active_task_ids)

    def _reconcile_orphan_batch_active_tasks(self, active_ids: set[str]) -> int:
        if self.batches is None or not hasattr(self.batches, "list"):
            return 0
        try:
            batches = self.batches.list()
        except Exception:
            return 0
        graph_tasks = {item.id: item for item in self._list_graph_tasks()}
        recovered = 0
        for batch in batches:
            active_task_ids = list(getattr(batch, "active_task_ids", None) or getattr(batch, "activeTaskIds", None) or [])
            if not active_task_ids:
                continue
            retained: list[str] = []
            changed = False
            for active_task_id in active_task_ids:
                task = graph_tasks.get(str(active_task_id))
                if str(active_task_id) in active_ids:
                    retained.append(str(active_task_id))
                elif task is not None and task.state not in TERMINAL_STATES:
                    retained.append(str(active_task_id))
                else:
                    changed = True
            if changed:
                state = getattr(batch, "state", None)
                update: dict[str, Any] = {"activeTaskIds": retained}
                if not retained and state == "processing":
                    update["state"] = "downloaded"
                self.batches.update(batch.id, **update)
                recovered += 1
        return recovered

    def get(self, task_id: str) -> TaskSnapshot:
        self._reconcile_if_needed()
        return self._get_graph_task(task_id)

    def _get_graph_task(self, task_id: str) -> TaskSnapshot:
        task = self.tasks.get(task_id)
        if task.type != "graph":
            raise ValueError("任务不是知识图谱训练任务")
        return task

    def graph(self, dataset_id: str, kind: str) -> Any:
        dataset = self.ensure_dataset_graph(dataset_id)
        if dataset.state == "deleted" or not dataset.graph_available or not dataset.training_task_id:
            raise FileNotFoundError(dataset_id)
        graph_dir = settings.data_root / "training-runs" / dataset.training_task_id / "graph"
        if kind == "summary":
            summary = dict(dataset.graph_summary or {})
            if summary and "knowledgeDomainCounts" in summary:
                return summary
            try:
                nodes = json.loads((graph_dir / "nodes.json").read_text(encoding="utf-8"))
                edges = json.loads((graph_dir / "edges.json").read_text(encoding="utf-8"))
                graph_source = str(summary.get("graphSource") or "") or None
                enriched = self._graph_summary(nodes, edges, [], graph_source)
                return {**summary, **enriched}
            except (OSError, json.JSONDecodeError):
                return summary
        path = graph_dir / f"{kind}.json"
        if not path.exists():
            raise FileNotFoundError(dataset_id)
        value = json.loads(path.read_text(encoding="utf-8"))
        if kind == "nodes" and isinstance(value, list):
            return self._with_graph_display_names(value)
        return value

    def graph_neighborhood(self, dataset_id: str, node_id: str, limit: int = 50) -> dict[str, Any]:
        nodes = self.graph(dataset_id, "nodes")
        edges = self.graph(dataset_id, "edges")
        focus = self._resolve_graph_node(nodes, node_id)
        if focus is None:
            raise KeyError(node_id)
        focus_id = str(focus.get("id") or "")
        connected = [
            edge for edge in edges
            if edge.get("type") == "CONTEXT_MATCHES_CHUNK"
            and (edge.get("source") == focus_id or edge.get("target") == focus_id)
        ]
        capped_edges = connected[:limit]
        related_ids = {focus_id}
        for edge in capped_edges:
            related_ids.add(str(edge.get("source")))
            related_ids.add(str(edge.get("target")))
        related_nodes = [focus]
        related_nodes.extend(
            node for node in nodes
            if node.get("id") in related_ids and node.get("id") != focus_id
        )
        return {
            "focusNode": focus,
            "nodes": related_nodes,
            "edges": capped_edges,
            "truncated": len(connected) > len(capped_edges),
            "limit": limit,
            "totalEdges": len(connected),
            "displayMode": "neighborhood",
        }

    def ensure_dataset_graph(self, dataset_id: str):
        dataset = self.preprocess.get_dataset(dataset_id)
        if self._needs_graph_backfill(dataset):
            summary = self.repair_dataset_graph(dataset_id)
            if hasattr(dataset, "model_copy"):
                dataset = dataset.model_copy(update={
                    "graph_available": True,
                    "graph_summary": summary,
                })
            else:
                dataset.graph_available = True
                dataset.graph_summary = summary
        return dataset

    def repair_dataset_graph(self, dataset_id: str) -> dict[str, Any]:
        dataset = self.preprocess.get_dataset(dataset_id)
        if dataset.state == "deleted" or not dataset.training_task_id:
            raise FileNotFoundError(dataset_id)
        dataset_root = settings.data_root / "datasets" / dataset.id
        run_dir = self._run_dir(dataset.training_task_id)
        if not dataset_root.is_dir() or not run_dir.is_dir():
            raise FileNotFoundError(dataset_id)

        final_results = self._read_jsonl(dataset_root / "knowledge.jsonl")
        if not final_results:
            final_results = self._read_jsonl(run_dir / "final-results" / "knowledge.jsonl")
        chunks = self._read_jsonl(dataset_root / "processing-units.jsonl")
        if not chunks:
            chunks = self._read_jsonl(run_dir / "metadata" / "chunks.jsonl")
        documents = self._read_jsonl(dataset_root / "documents.jsonl")
        if not documents:
            documents = self._read_jsonl(run_dir / "metadata" / "documents.jsonl")
        chunk_contexts = self._read_jsonl(run_dir / "metadata" / "chunk-contexts.jsonl")
        keyword_candidates = self._read_jsonl(dataset_root / "keyword-candidates.jsonl")
        if not keyword_candidates:
            keyword_candidates = self._read_jsonl(run_dir / "extraction-results" / "keyword-candidates.jsonl")
        if not final_results and self.metadata_construction is not None:
            source_documents = self._read_jsonl(run_dir / "metadata" / "source-documents.jsonl")
            if source_documents and chunks:
                documents, chunk_contexts, _ = self.metadata_construction.build_records(source_documents, chunks)
                self._write_jsonl(run_dir / "metadata" / "documents.jsonl", documents)
                self._write_jsonl(run_dir / "metadata" / "chunk-contexts.jsonl", chunk_contexts)
                self._write_jsonl(dataset_root / "documents.jsonl", documents)
        issues = self._read_json(dataset_root / "quality-issues.json", [])
        if not isinstance(issues, list):
            issues = []

        nodes, edges, graph_source = self._build_dataset_graph(
            chunks,
            final_results,
            issues,
            documents,
            chunk_contexts,
            keyword_candidates,
        )
        summary = {
            **self._graph_summary(nodes, edges, issues, graph_source),
            "knowledgeBuildMode": "formal_knowledge" if graph_source == "final_knowledge" else "keyword_analysis",
            "graphSource": graph_source,
        }
        for graph_dir in (run_dir / "graph", dataset_root / "graph"):
            self._write_json(graph_dir / "nodes.json", nodes)
            self._write_json(graph_dir / "edges.json", edges)

        for report_path in (run_dir / "run-report.json", dataset_root / "run-report.json"):
            report = self._read_json(report_path, {})
            if isinstance(report, dict):
                report["graph"] = summary
                report["graphRepairedAt"] = utcnow().isoformat()
                self._write_json(report_path, report)
        manifest = self._read_json(dataset_root / "manifest.json", {})
        if isinstance(manifest, dict):
            manifest.update({
                "nodeCount": len(nodes),
                "edgeCount": len(edges),
                "graphSource": graph_source,
                "graphSchemaVersion": GRAPH_SCHEMA_VERSION,
                "metadataRuleSetHash": self._metadata_rule_set_hash(),
            })
            self._write_json(dataset_root / "manifest.json", manifest)
        self._persist_entity_relation_stage_summary(dataset_root, run_dir, summary)
        self.store.update_record("datasets", dataset.id, {
            "graphAvailable": True,
            "graphSummary": summary,
        })
        self.store.update_record("tasks", dataset.training_task_id, {
            "graphSummary": summary,
        })
        return summary

    def update_keyword_status(self, dataset_id: str, keyword_id: str, status: str) -> dict[str, Any]:
        if status not in {"accepted", "rejected", "pending"}:
            raise ValueError("关键词状态只允许 accepted、rejected 或 pending")
        dataset = self.ensure_dataset_graph(dataset_id)
        if dataset.state == "deleted" or not dataset.graph_available or not dataset.training_task_id:
            raise FileNotFoundError(dataset_id)
        run_dir = self._run_dir(dataset.training_task_id)
        dataset_root = settings.data_root / "datasets" / dataset.id
        nodes_path = run_dir / "graph/nodes.json"
        edges_path = run_dir / "graph/edges.json"
        if not nodes_path.exists() or not edges_path.exists():
            raise FileNotFoundError(dataset_id)
        nodes = json.loads(nodes_path.read_text(encoding="utf-8"))
        edges = json.loads(edges_path.read_text(encoding="utf-8"))
        node = self._resolve_graph_node(nodes, keyword_id)
        if not node or node.get("type") != "Keyword":
            raise KeyError(keyword_id)
        node["approvalStatus"] = status
        node.setdefault("properties", {})["approvalStatus"] = status
        summary = self._graph_summary(nodes, edges, self._read_json(dataset_root / "quality-issues.json", []), str(dataset.graph_summary.get("graphSource") or "model_keyword"))
        for graph_dir in (run_dir / "graph", dataset_root / "graph"):
            self._write_json(graph_dir / "nodes.json", nodes)
            self._write_json(graph_dir / "edges.json", edges)
        self.store.update_record("datasets", dataset.id, {"graphSummary": summary})
        self.store.update_record("tasks", dataset.training_task_id, {"graphSummary": summary})
        return {"keywordId": node.get("keywordId") or node.get("id"), "approvalStatus": status, "keywordApprovalState": summary.get("keywordApprovalState", {})}

    def review_keyword_business(self, dataset_id: str) -> dict[str, Any]:
        dataset = self.ensure_dataset_graph(dataset_id)
        if dataset.state == "deleted" or not dataset.graph_available or not dataset.training_task_id:
            raise FileNotFoundError(dataset_id)
        run_dir = self._run_dir(dataset.training_task_id)
        dataset_root = settings.data_root / "datasets" / dataset.id
        nodes_path = run_dir / "graph/nodes.json"
        edges_path = run_dir / "graph/edges.json"
        if not nodes_path.exists() or not edges_path.exists():
            nodes_path = dataset_root / "graph/nodes.json"
            edges_path = dataset_root / "graph/edges.json"
        if not nodes_path.exists() or not edges_path.exists():
            raise FileNotFoundError(dataset_id)
        nodes = json.loads(nodes_path.read_text(encoding="utf-8"))
        edges = json.loads(edges_path.read_text(encoding="utf-8"))
        review = self._keyword_business_review(dataset.id, nodes)
        for node in nodes:
            if node.get("type") != "Keyword":
                continue
            keyword_id = str(node.get("keywordId") or node.get("id") or "")
            item = next((entry for entry in review["items"] if entry.get("keywordId") == keyword_id), None)
            if not item:
                continue
            node["businessStatus"] = item["businessStatus"]
            node["businessReasonCodes"] = item["reasonCodes"]
            node["businessEvidenceCoverage"] = item["evidenceCoverage"]
            node.setdefault("properties", {})["businessStatus"] = item["businessStatus"]
        summary = self._graph_summary(nodes, edges, self._read_json(dataset_root / "quality-issues.json", []), str(dataset.graph_summary.get("graphSource") or "model_keyword"))
        summary["keywordBusinessReviewState"] = review["summary"]
        for graph_dir in (run_dir / "graph", dataset_root / "graph"):
            self._write_json(graph_dir / "nodes.json", nodes)
            self._write_json(graph_dir / "edges.json", edges)
        self._write_graph_summary_artifacts(run_dir, dataset_root, summary)
        for quality_dir in (run_dir / "quality", dataset_root / "quality"):
            self._write_json(quality_dir / "keyword-business-review.json", review)
        self._persist_entity_relation_stage_summary(dataset_root, run_dir, summary)
        self.store.update_record("datasets", dataset.id, {"graphSummary": summary})
        self.store.update_record("tasks", dataset.training_task_id, {"graphSummary": summary})
        return review

    def filter_keywords_by_prompt(self, dataset_id: str, prompt: str) -> dict[str, Any]:
        """使用 LLM Agent 根据用户提示词批量过滤关键词"""
        dataset = self.ensure_dataset_graph(dataset_id)
        if dataset.state == "deleted" or not dataset.graph_available or not dataset.training_task_id:
            raise FileNotFoundError(dataset_id)
        
        run_dir = self._run_dir(dataset.training_task_id)
        dataset_root = settings.data_root / "datasets" / dataset.id
        nodes_path = run_dir / "graph/nodes.json"
        
        if not nodes_path.exists():
            nodes_path = dataset_root / "graph/nodes.json"
        if not nodes_path.exists():
            raise FileNotFoundError(dataset_id)
        
        nodes = json.loads(nodes_path.read_text(encoding="utf-8"))
        
        # 提取所有关键词
        keywords = []
        for node in nodes:
            if node.get("type") != "Keyword":
                continue
            keywords.append({
                "id": node.get("keywordId") or node.get("id"),
                "name": node.get("canonicalName") or node.get("name"),
                "aliases": node.get("aliases", []),
                "sourceMethods": node.get("sourceMethods", []),
                "evidenceCount": len(node.get("occurrences", [])),
            })
        
        if not keywords:
            return {"filtered": 0, "excluded": 0, "admitted": 0, "details": []}
        
        # 构建 LLM 请求
        system_prompt = """你是一个关键词过滤助手。根据用户提供的过滤规则，判断每个关键词是否应该被排除。

对于每个关键词，返回如下 JSON 格式：
{
  "decisions": [
    {
      "keywordId": "关键词ID",
      "shouldExclude": true/false,
      "reason": "排除或保留的原因"
    }
  ]
}

只返回 JSON 对象，不要包含其他内容。"""
        
        user_message = f"""过滤规则：{prompt}

关键词列表：
{json.dumps(keywords, ensure_ascii=False, indent=2)}

请根据上述规则判断每个关键词是否应该被排除。"""
        
        # 调用 LLM
        try:
            if self.gateway is None:
                raise ValueError("模型网关未配置")
            
            result = self.gateway.chat_json(
                [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                {"temperature": 0.1, "max_retries": 0}
            )
            
            data = result.get("data", {})
            decisions = data.get("decisions", []) if isinstance(data, dict) else []
            
        except Exception as e:
            # LLM 调用失败，返回错误
            return {"error": str(e), "filtered": 0, "excluded": 0, "admitted": 0, "details": []}
        
        # 应用过滤结果
        decision_map = {d.get("keywordId"): d for d in decisions if d.get("keywordId")}
        
        excluded_count = 0
        admitted_count = 0
        details = []
        
        for node in nodes:
            if node.get("type") != "Keyword":
                continue
            
            keyword_id = str(node.get("keywordId") or node.get("id") or "")
            decision = decision_map.get(keyword_id)
            
            if decision:
                should_exclude = decision.get("shouldExclude", False)
                reason = decision.get("reason", "")
                
                if should_exclude:
                    self._write_admission_status(node, "excluded")
                    excluded_count += 1
                else:
                    self._write_admission_status(node, "admitted")
                    admitted_count += 1
                
                details.append({
                    "keywordId": keyword_id,
                    "name": node.get("canonicalName") or node.get("name"),
                    "excluded": should_exclude,
                    "reason": reason,
                })
        
        # 保存更新后的图谱
        edges_path = run_dir / "graph/edges.json"
        if not edges_path.exists():
            edges_path = dataset_root / "graph/edges.json"
        
        if edges_path.exists():
            edges = json.loads(edges_path.read_text(encoding="utf-8"))
        else:
            edges = []
        
        summary = self._graph_summary(nodes, edges, self._read_json(dataset_root / "quality-issues.json", []), str(dataset.graph_summary.get("graphSource") or "model_keyword"))
        
        for graph_dir in (run_dir / "graph", dataset_root / "graph"):
            self._write_json(graph_dir / "nodes.json", nodes)
            self._write_json(graph_dir / "edges.json", edges)
        
        self._write_graph_summary_artifacts(run_dir, dataset_root, summary)
        self.store.update_record("datasets", dataset.id, {"graphSummary": summary})
        
        return {
            "filtered": len(details),
            "excluded": excluded_count,
            "admitted": admitted_count,
            "details": details,
        }

    def update_keyword_business_status(
        self,
        dataset_id: str,
        keyword_id: str,
        business_status: str,
        reason_code: str = "",
        note: str = "",
        operator_label: str = "当前用户",
    ) -> dict[str, Any]:
        if business_status not in {"businessAccepted", "businessRejected", "needsReview"}:
            raise ValueError("业务准入状态只允许 businessAccepted、businessRejected 或 needsReview")
        dataset = self.ensure_dataset_graph(dataset_id)
        if dataset.state == "deleted" or not dataset.graph_available or not dataset.training_task_id:
            raise FileNotFoundError(dataset_id)
        run_dir = self._run_dir(dataset.training_task_id)
        dataset_root = settings.data_root / "datasets" / dataset.id
        nodes_path = run_dir / "graph/nodes.json"
        edges_path = run_dir / "graph/edges.json"
        if not nodes_path.exists() or not edges_path.exists():
            raise FileNotFoundError(dataset_id)
        nodes = json.loads(nodes_path.read_text(encoding="utf-8"))
        edges = json.loads(edges_path.read_text(encoding="utf-8"))
        node = self._resolve_graph_node(nodes, keyword_id)
        if not node or node.get("type") != "Keyword":
            raise KeyError(keyword_id)
        reason_codes = [reason_code] if reason_code else []
        node["businessStatus"] = business_status
        node["businessReasonCodes"] = reason_codes
        node["businessManualOverride"] = {
            "operatorLabel": operator_label,
            "note": note,
            "reasonCode": reason_code,
            "updatedAt": utcnow().isoformat(),
        }
        properties = node.setdefault("properties", {})
        properties["businessStatus"] = business_status
        properties["businessReasonCodes"] = reason_codes
        review = self._keyword_business_review(dataset.id, nodes, preserve_existing=True)
        summary = self._graph_summary(nodes, edges, self._read_json(dataset_root / "quality-issues.json", []), str(dataset.graph_summary.get("graphSource") or "model_keyword"))
        summary["keywordBusinessReviewState"] = review["summary"]
        for graph_dir in (run_dir / "graph", dataset_root / "graph"):
            self._write_json(graph_dir / "nodes.json", nodes)
            self._write_json(graph_dir / "edges.json", edges)
        self._write_graph_summary_artifacts(run_dir, dataset_root, summary)
        for quality_dir in (run_dir / "quality", dataset_root / "quality"):
            self._write_json(quality_dir / "keyword-business-review.json", review)
        self._persist_entity_relation_stage_summary(dataset_root, run_dir, summary)
        self.store.update_record("datasets", dataset.id, {"graphSummary": summary})
        self.store.update_record("tasks", dataset.training_task_id, {"graphSummary": summary})
        return {"keywordId": node.get("keywordId") or node.get("id"), "businessStatus": business_status, "keywordBusinessReviewState": summary.get("keywordBusinessReviewState", {})}

    @staticmethod
    def _read_admission_status(node: dict) -> str:
        """读取准入状态，自动从旧字段迁移。"""
        explicit = node.get("admissionStatus") or node.get("properties", {}).get("admissionStatus")
        if explicit:
            return str(explicit)
        approval = str(node.get("approvalStatus") or node.get("properties", {}).get("approvalStatus") or "autoAccepted")
        business = str(node.get("businessStatus") or node.get("properties", {}).get("businessStatus") or "")
        if approval in ("autoAccepted", "accepted") and business == "businessAccepted":
            return "admitted"
        return "excluded"

    @staticmethod
    def _write_admission_status(node: dict, status: str) -> None:
        """写入准入状态到节点和 properties。"""
        node["admissionStatus"] = status
        node.setdefault("properties", {})["admissionStatus"] = status

    def _migrate_admission_statuses(self, nodes: list[dict]) -> bool:
        """为缺少 admissionStatus 的关键词节点补充迁移值，返回是否有变更。"""
        changed = False
        for node in nodes:
            if node.get("type") != "Keyword":
                continue
            if node.get("admissionStatus") or node.get("properties", {}).get("admissionStatus"):
                continue
            migrated = self._read_admission_status(node)
            self._write_admission_status(node, migrated)
            changed = True
        return changed

    def update_keyword_admission(
        self,
        dataset_id: str,
        keyword_id: str,
        admission_status: str,
        note: str = "",
        operator_label: str = "当前用户",
    ) -> dict[str, Any]:
        if admission_status not in {"admitted", "excluded"}:
            raise ValueError("准入状态只允许 admitted 或 excluded")
        dataset = self.ensure_dataset_graph(dataset_id)
        if dataset.state == "deleted" or not dataset.graph_available or not dataset.training_task_id:
            raise FileNotFoundError(dataset_id)
        run_dir = self._run_dir(dataset.training_task_id)
        dataset_root = settings.data_root / "datasets" / dataset.id
        nodes_path = run_dir / "graph/nodes.json"
        edges_path = run_dir / "graph/edges.json"
        if not nodes_path.exists() or not edges_path.exists():
            raise FileNotFoundError(dataset_id)
        nodes = json.loads(nodes_path.read_text(encoding="utf-8"))
        edges = json.loads(edges_path.read_text(encoding="utf-8"))
        node = self._resolve_graph_node(nodes, keyword_id)
        if not node or node.get("type") != "Keyword":
            raise KeyError(keyword_id)
        self._write_admission_status(node, admission_status)
        node["admissionManualOverride"] = {
            "operatorLabel": operator_label,
            "note": note,
            "updatedAt": utcnow().isoformat(),
        }
        summary = self._graph_summary(nodes, edges, self._read_json(dataset_root / "quality-issues.json", []), str(dataset.graph_summary.get("graphSource") or "model_keyword"))
        for graph_dir in (run_dir / "graph", dataset_root / "graph"):
            self._write_json(graph_dir / "nodes.json", nodes)
            self._write_json(graph_dir / "edges.json", edges)
        self._write_graph_summary_artifacts(run_dir, dataset_root, summary)
        self.store.update_record("datasets", dataset.id, {"graphSummary": summary})
        self.store.update_record("tasks", dataset.training_task_id, {"graphSummary": summary})
        return {
            "keywordId": node.get("keywordId") or node.get("id"),
            "admissionStatus": admission_status,
            "keywordAdmissionState": summary.get("keywordAdmissionState", {}),
        }

    def create_l2_term(
        self,
        dataset_id: str,
        name: str,
        canonical_name: str = "",
        description: str = "",
        linked_l1_ids: list[str] | None = None,
    ) -> dict[str, Any]:
        dataset = self.ensure_dataset_graph(dataset_id)
        if dataset.state == "deleted" or not dataset.graph_available or not dataset.training_task_id:
            raise FileNotFoundError(dataset_id)
        run_dir = self._run_dir(dataset.training_task_id)
        dataset_root = settings.data_root / "datasets" / dataset.id
        nodes_path = run_dir / "graph/nodes.json"
        edges_path = run_dir / "graph/edges.json"
        if not nodes_path.exists() or not edges_path.exists():
            raise FileNotFoundError(dataset_id)
        nodes = json.loads(nodes_path.read_text(encoding="utf-8"))
        edges = json.loads(edges_path.read_text(encoding="utf-8"))
        term_id = f"l2_{name}_{len(nodes)}".replace(" ", "_")
        l2_node = {
            "id": term_id,
            "keywordId": term_id,
            "type": "Keyword",
            "keywordLevel": "L2",
            "rawName": name,
            "canonicalName": canonical_name or name,
            "displayName": canonical_name or name,
            "description": description,
            "sourceMethods": ["manual_l2_term"],
            "admissionStatus": "admitted",
            "aliases": [],
            "chunkIds": [],
            "properties": {
                "admissionStatus": "admitted",
                "keywordLevel": "L2",
            },
        }
        nodes.append(l2_node)
        created_links = []
        for l1_id in (linked_l1_ids or []):
            l1_node = self._resolve_graph_node(nodes, l1_id)
            if not l1_node or l1_node.get("type") != "Keyword":
                continue
            edge = {
                "source": term_id,
                "target": l1_id,
                "type": "MAPS_TO_TERM",
                "weight": 0.5,
                "evidenceChunkIds": [],
            }
            edges.append(edge)
            created_links.append({"source": term_id, "target": l1_id, "type": "MAPS_TO_TERM", "weight": 0.5})
        summary = self._graph_summary(nodes, edges, self._read_json(dataset_root / "quality-issues.json", []), str(dataset.graph_summary.get("graphSource") or "model_keyword"))
        for graph_dir in (run_dir / "graph", dataset_root / "graph"):
            self._write_json(graph_dir / "nodes.json", nodes)
            self._write_json(graph_dir / "edges.json", edges)
        self._write_graph_summary_artifacts(run_dir, dataset_root, summary)
        self.store.update_record("datasets", dataset.id, {"graphSummary": summary})
        self.store.update_record("tasks", dataset.training_task_id, {"graphSummary": summary})
        return {"termId": term_id, "termName": name, "linkedL1Count": len(created_links), "keywordLevelStats": summary.get("keywordLevelStats", {})}

    def create_keyword_link(
        self,
        dataset_id: str,
        keyword_id: str,
        target_id: str,
        weight: float = 0.5,
        evidence_chunk_ids: list[str] | None = None,
    ) -> dict[str, Any]:
        dataset = self.ensure_dataset_graph(dataset_id)
        if dataset.state == "deleted" or not dataset.graph_available or not dataset.training_task_id:
            raise FileNotFoundError(dataset_id)
        run_dir = self._run_dir(dataset.training_task_id)
        dataset_root = settings.data_root / "datasets" / dataset.id
        nodes_path = run_dir / "graph/nodes.json"
        edges_path = run_dir / "graph/edges.json"
        if not nodes_path.exists() or not edges_path.exists():
            raise FileNotFoundError(dataset_id)
        nodes = json.loads(nodes_path.read_text(encoding="utf-8"))
        edges = json.loads(edges_path.read_text(encoding="utf-8"))
        source_node = self._resolve_graph_node(nodes, keyword_id)
        target_node = self._resolve_graph_node(nodes, target_id)
        if not source_node or not target_node:
            raise KeyError(keyword_id)
        edge = {
            "source": keyword_id,
            "target": target_id,
            "type": "MAPS_TO_TERM",
            "weight": max(0.0, min(1.0, weight)),
            "evidenceChunkIds": evidence_chunk_ids or [],
        }
        edges.append(edge)
        summary = self._graph_summary(nodes, edges, self._read_json(dataset_root / "quality-issues.json", []), str(dataset.graph_summary.get("graphSource") or "model_keyword"))
        for graph_dir in (run_dir / "graph", dataset_root / "graph"):
            self._write_json(graph_dir / "nodes.json", nodes)
            self._write_json(graph_dir / "edges.json", edges)
        self._write_graph_summary_artifacts(run_dir, dataset_root, summary)
        self.store.update_record("datasets", dataset.id, {"graphSummary": summary})
        self.store.update_record("tasks", dataset.training_task_id, {"graphSummary": summary})
        return {"source": keyword_id, "target": target_id, "type": "MAPS_TO_TERM", "weight": edge["weight"]}

    def expand_l2_term(self, dataset_id: str, term_id: str, limit: int = 50) -> dict[str, Any]:
        dataset = self.ensure_dataset_graph(dataset_id)
        if dataset.state == "deleted" or not dataset.graph_available or not dataset.training_task_id:
            raise FileNotFoundError(dataset_id)
        run_dir = self._run_dir(dataset.training_task_id)
        nodes_path = run_dir / "graph/nodes.json"
        edges_path = run_dir / "graph/edges.json"
        if not nodes_path.exists() or not edges_path.exists():
            raise FileNotFoundError(dataset_id)
        nodes = json.loads(nodes_path.read_text(encoding="utf-8"))
        edges = json.loads(edges_path.read_text(encoding="utf-8"))
        term_node = self._resolve_graph_node(nodes, term_id)
        if not term_node or term_node.get("type") != "Keyword":
            raise KeyError(term_id)
        node_lookup = {str(n.get("id") or n.get("keywordId") or ""): n for n in nodes}
        expansions = []
        for edge in edges:
            if edge.get("type") != "MAPS_TO_TERM":
                continue
            if str(edge.get("source")) != term_id:
                continue
            target_id = str(edge.get("target"))
            target_node = node_lookup.get(target_id)
            if not target_node:
                continue
            expansions.append({
                "l1Node": {
                    "id": target_id,
                    "name": target_node.get("displayName") or target_node.get("rawName") or target_node.get("canonicalName") or target_id,
                    "rawName": target_node.get("rawName"),
                    "canonicalName": target_node.get("canonicalName"),
                    "admissionStatus": self._read_admission_status(target_node),
                    "keywordLevel": target_node.get("keywordLevel") or "L1",
                },
                "weight": float(edge.get("weight") or 0.5),
                "evidenceChunkIds": edge.get("evidenceChunkIds") or [],
                "path": [term_id, "MAPS_TO_TERM", target_id],
            })
        expansions.sort(key=lambda item: item["weight"], reverse=True)
        admitted_count = sum(1 for e in expansions if e["l1Node"]["admissionStatus"] == "admitted")
        return {
            "l2Node": {
                "id": term_id,
                "name": term_node.get("displayName") or term_node.get("canonicalName") or term_node.get("rawName") or term_id,
                "canonicalName": term_node.get("canonicalName"),
                "description": term_node.get("description", ""),
            },
            "expansions": expansions[:limit],
            "totalExpansionCount": len(expansions),
            "admittedExpansionCount": admitted_count,
        }

    def _write_graph_summary_artifacts(self, run_dir: Path, dataset_root: Path, summary: dict[str, Any]) -> None:
        for report_path in (run_dir / "run-report.json", dataset_root / "run-report.json"):
            report = self._read_json(report_path, {})
            if isinstance(report, dict):
                report["graph"] = summary
                report["graphSummary"] = summary
                self._write_json(report_path, report)

    def start_formal_knowledge_task(self, dataset_id: str) -> TaskSnapshot:
        dataset = self.ensure_dataset_graph(dataset_id)
        if dataset.state == "deleted":
            raise ValueError("已删除数据集不能构建正式知识")
        nodes = self.graph(dataset_id, "nodes")
        accepted = [
            node for node in nodes
            if node.get("type") == "Keyword"
            and self._read_admission_status(node) == "admitted"
        ]
        if not accepted:
            raise ValueError('没有已准入（生效）的关键词，不能构建正式知识。请先对关键词执行「确认并准入」操作。')
        config = dataset.config.model_dump(mode="json", by_alias=True) if hasattr(dataset.config, "model_dump") else dict(dataset.config or {})
        request = TrainingTaskCreate(
            batchId=dataset.batch_id,
            config=config,
            mode="formal_knowledge",
            sourceDatasetId=dataset.id,
            keywordIds=[str(node.get("keywordId") or node.get("id")) for node in accepted],
        )
        return self.start(request)

    def _formal_keyword_context_by_chunk(self, dataset_id: str | None, keyword_ids: list[str] | None = None) -> dict[str, list[dict[str, Any]]]:
        if not dataset_id:
            return {}
        nodes = self.graph(dataset_id, "nodes")
        dataset_root = settings.data_root / "datasets" / dataset_id
        index_path = dataset_root / "keyword-chunk-index.json"
        materialized = None
        if index_path.is_file():
            try:
                materialized = json.loads(index_path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                materialized = None
        allowed_ids = {str(item) for item in (keyword_ids or []) if item}
        node_lookup = {
            str(node.get("keywordId") or node.get("id") or ""): node
            for node in nodes
            if node.get("type") == "Keyword"
        }
        result: dict[str, list[dict[str, Any]]] = {}
        if isinstance(materialized, dict) and isinstance(materialized.get("keywordToChunks"), dict):
            for keyword_id, chunk_ids in materialized.get("keywordToChunks", {}).items():
                node = node_lookup.get(str(keyword_id))
                if not node:
                    continue
                if self._read_admission_status(node) != "admitted":
                    continue
                if allowed_ids and str(keyword_id) not in allowed_ids and str(node.get("id") or "") not in allowed_ids:
                    continue
                for chunk_id in chunk_ids or []:
                    if not chunk_id:
                        continue
                    result.setdefault(str(chunk_id), []).append(self._formal_keyword_context_entry(str(keyword_id), node))
            if result:
                return self._normalize_keyword_context_by_chunk(result)
        for node in nodes:
            if node.get("type") != "Keyword":
                continue
            keyword_id = str(node.get("keywordId") or node.get("id") or "")
            if self._read_admission_status(node) != "admitted":
                continue
            if allowed_ids and keyword_id not in allowed_ids and str(node.get("id") or "") not in allowed_ids:
                continue
            for chunk_id in node.get("chunkIds") or []:
                if not chunk_id:
                    continue
                result.setdefault(str(chunk_id), []).append(self._formal_keyword_context_entry(keyword_id, node))
        return self._normalize_keyword_context_by_chunk(result)

    @staticmethod
    def _formal_keyword_context_entry(keyword_id: str, node: dict[str, Any]) -> dict[str, Any]:
        return {
            "keywordId": str(keyword_id),
            "canonicalName": node.get("canonicalName") or node.get("name"),
            "aliases": node.get("aliases") or [],
        }

    @staticmethod
    def _normalize_keyword_context_by_chunk(context_by_chunk: dict[str, list[dict[str, Any]]]) -> dict[str, list[dict[str, Any]]]:
        normalized: dict[str, list[dict[str, Any]]] = {}
        for chunk_id in sorted(str(item) for item in context_by_chunk if item):
            by_keyword: dict[str, dict[str, Any]] = {}
            for context in context_by_chunk.get(chunk_id) or []:
                keyword_id = str((context or {}).get("keywordId") or "")
                if not keyword_id:
                    continue
                if keyword_id not in by_keyword:
                    by_keyword[keyword_id] = dict(context)
                    by_keyword[keyword_id]["keywordId"] = keyword_id
                    continue
                existing = by_keyword[keyword_id]
                aliases = list(existing.get("aliases") or [])
                for alias in context.get("aliases") or []:
                    if alias not in aliases:
                        aliases.append(alias)
                existing["aliases"] = aliases
                if not existing.get("canonicalName") and context.get("canonicalName"):
                    existing["canonicalName"] = context.get("canonicalName")
            if by_keyword:
                normalized[chunk_id] = [by_keyword[keyword_id] for keyword_id in sorted(by_keyword)]
        return normalized

    def _formal_keyword_input_plan(
        self,
        dataset_id: str | None,
        nodes: list[dict[str, Any]],
        keyword_context_by_chunk: dict[str, list[dict[str, Any]]],
    ) -> dict[str, Any]:
        rejected_ids = sorted({
            str(node.get("keywordId") or node.get("id"))
            for node in nodes
            if node.get("type") == "Keyword"
            and str(node.get("approvalStatus") or node.get("properties", {}).get("approvalStatus") or "autoAccepted") == "rejected"
            and str(node.get("keywordId") or node.get("id") or "")
        })
        rejected_set = set(rejected_ids)
        accepted_ids = sorted({
            str(context.get("keywordId"))
            for contexts in keyword_context_by_chunk.values()
            for context in contexts
            if context.get("keywordId")
            and str(context.get("keywordId")) not in rejected_set
        })
        chunk_keyword_map = {
            chunk_id: [
                str(context.get("keywordId"))
                for context in contexts
                if context.get("keywordId")
                and str(context.get("keywordId")) not in rejected_set
            ]
            for chunk_id, contexts in self._normalize_keyword_context_by_chunk(keyword_context_by_chunk).items()
        }
        # 过滤掉没有关键词的 chunk（所有关键词都被拒绝）
        chunk_keyword_map = {k: v for k, v in chunk_keyword_map.items() if v}
        return {
            "sourceDatasetId": dataset_id,
            "acceptedKeywordIds": accepted_ids,
            "rejectedKeywordIds": rejected_ids,
            "scheduledChunkIds": sorted(chunk_keyword_map),
            "chunkKeywordMap": chunk_keyword_map,
            "filteredKeywordCount": len(rejected_ids),
            "deduplicatedChunkCount": len(chunk_keyword_map),
        }

    def _keyword_business_review(self, dataset_id: str, nodes: list[dict[str, Any]], preserve_existing: bool = False) -> dict[str, Any]:
        items = []
        for node in nodes:
            if node.get("type") != "Keyword":
                continue
            if preserve_existing and node.get("businessStatus"):
                item = self._keyword_business_review_item_from_node(node)
            else:
                item = self._evaluate_keyword_business(node)
            items.append(item)
        summary = self._keyword_business_review_summary(items)
        return {
            "schemaVersion": "1.0.0",
            "datasetId": dataset_id,
            "ruleSetHash": self._metadata_rule_set_hash(),
            "summary": summary,
            "items": items,
        }

    def _keyword_business_review_item_from_node(self, node: dict[str, Any]) -> dict[str, Any]:
        coverage = node.get("businessEvidenceCoverage") or self._keyword_evidence_coverage(node)
        reason_codes = node.get("businessReasonCodes") or node.get("properties", {}).get("businessReasonCodes") or []
        return {
            "keywordId": str(node.get("keywordId") or node.get("id") or ""),
            "canonicalName": node.get("canonicalName") or node.get("name") or node.get("displayName"),
            "businessStatus": node.get("businessStatus") or node.get("properties", {}).get("businessStatus") or "needsReview",
            "reasonCodes": list(reason_codes),
            "evidenceCoverage": coverage,
            "sourceRuleIds": list(node.get("businessSourceRuleIds") or []),
            "manualOverride": node.get("businessManualOverride"),
        }

    def _evaluate_keyword_business(self, node: dict[str, Any]) -> dict[str, Any]:
        rules = (getattr(self.metadata_construction, "rules", {}) or {}).get("businessKeywordReview") or {}
        keyword_id = str(node.get("keywordId") or node.get("id") or "")
        canonical = str(node.get("canonicalName") or node.get("name") or node.get("displayName") or "").strip()
        aliases = [str(item).strip() for item in (node.get("aliases") or []) if str(item).strip()]
        values = [canonical, *aliases]
        coverage = self._keyword_evidence_coverage(node)
        reason_codes: list[str] = []
        source_rule_ids: list[str] = []

        folded_values = {value.casefold() for value in values if value}
        scope_words = {str(item).casefold() for item in rules.get("scopeWords", [])}
        naming_words = {str(item).casefold() for item in rules.get("namingNoiseWords", [])}
        strong_topics = {str(item).casefold() for item in rules.get("strongTopicTerms", [])}
        rejection_patterns = rules.get("rejectionPatterns") or []

        if any(value in scope_words for value in folded_values):
            reason_codes.append("scope_word")
            source_rule_ids.append("business.scopeWords")
        if any(value in naming_words for value in folded_values):
            reason_codes.append("file_naming_noise")
            source_rule_ids.append("business.namingNoiseWords")
        if any(pattern.search(canonical) for _, pattern in rejection_patterns) or self._is_technical_keyword(canonical):
            reason_codes.append("technical_identifier")
            source_rule_ids.append("business.rejectionPatterns")

        if reason_codes:
            status = "businessRejected"
        else:
            evidence_count = int(coverage.get("total", 0))
            min_evidence = int(rules.get("minEvidenceCount", 1) or 1)
            is_strong_topic = any(value in strong_topics for value in folded_values)
            has_domain_method = any(
                method in {"domain_term", "domain_glossary_title", "deterministic_title_glossary"}
                for method in (node.get("sourceMethods") or node.get("properties", {}).get("sourceMethods") or [])
            )
            approval_status = str(node.get("approvalStatus") or node.get("properties", {}).get("approvalStatus") or "")
            if approval_status == "pending":
                status = "needsReview"
                reason_codes.append("pending_keyword_approval")
            elif evidence_count >= min_evidence and (is_strong_topic or has_domain_method):
                status = "businessAccepted"
                reason_codes.extend(["domain_topic" if is_strong_topic else "domain_term", "strong_evidence"])
            elif evidence_count >= min_evidence and approval_status == "accepted":
                status = "businessAccepted"
                reason_codes.extend(["user_confirmed", "strong_evidence"])
            else:
                status = "needsReview"
                reason_codes.append("weak_evidence" if evidence_count < min_evidence else "needs_business_review")

        return {
            "keywordId": keyword_id,
            "canonicalName": canonical,
            "businessStatus": status,
            "reasonCodes": reason_codes,
            "evidenceCoverage": coverage,
            "sourceRuleIds": source_rule_ids,
            "manualOverride": node.get("businessManualOverride"),
        }

    @staticmethod
    def _keyword_evidence_coverage(node: dict[str, Any]) -> dict[str, int]:
        coverage = {"title": 0, "heading": 0, "content": 0, "domain_glossary": 0, "chunkCount": 0, "total": 0}
        chunk_ids = {str(item) for item in (node.get("chunkIds") or []) if item}
        occurrences = node.get("occurrences") or []
        for occurrence in occurrences:
            source = str((occurrence or {}).get("evidenceSource") or (occurrence or {}).get("source") or "content")
            if source not in coverage:
                source = "content"
            coverage[source] += 1
            coverage["total"] += 1
            if (occurrence or {}).get("chunkId"):
                chunk_ids.add(str((occurrence or {}).get("chunkId")))
        coverage["chunkCount"] = len(chunk_ids)
        if not coverage["total"] and chunk_ids:
            coverage["total"] = len(chunk_ids)
            coverage["content"] = len(chunk_ids)
        return coverage

    @staticmethod
    def _keyword_business_review_summary(items: list[dict[str, Any]]) -> dict[str, Any]:
        reason_counts: dict[str, int] = {}
        state = {
            "totalKeywordCount": len(items),
            "businessAcceptedCount": 0,
            "businessRejectedCount": 0,
            "needsReviewCount": 0,
            "admittedChunkCount": 0,
            "reasonCounts": reason_counts,
        }
        admitted_chunks = 0
        for item in items:
            status = str(item.get("businessStatus") or "needsReview")
            if status == "businessAccepted":
                state["businessAcceptedCount"] += 1
                admitted_chunks += int((item.get("evidenceCoverage") or {}).get("chunkCount") or 0)
            elif status == "businessRejected":
                state["businessRejectedCount"] += 1
            else:
                state["needsReviewCount"] += 1
            for reason in item.get("reasonCodes") or []:
                reason_counts[str(reason)] = reason_counts.get(str(reason), 0) + 1
        state["admittedChunkCount"] = admitted_chunks
        return state

    def _entity_relation_stage_summary(self, *roots: Path) -> dict[str, Any]:
        default = {
            "state": "pending",
            "entityCandidateCount": 0,
            "relationCandidateCount": 0,
            "validatedEntityCount": 0,
            "validatedRelationCount": 0,
            "issueCount": 0,
        }
        for root in roots:
            if not root:
                continue
            value = self._read_json(root / "quality/entity-relation-stage-status.json", None)
            if isinstance(value, dict):
                return {**default, **value}
        return default

    def _persist_entity_relation_stage_summary(self, dataset_root: Path, run_dir: Path, summary: dict[str, Any]) -> None:
        entity_relation_stage = self._entity_relation_stage_summary(dataset_root, run_dir)
        summary["entityRelationStage"] = entity_relation_stage
        for quality_dir in (run_dir / "quality", dataset_root / "quality"):
            self._write_json(quality_dir / "entity-relation-stage-status.json", entity_relation_stage)

    @staticmethod
    def _keyword_chunk_index(nodes: list[dict[str, Any]]) -> dict[str, Any]:
        keyword_to_chunks: dict[str, list[str]] = {}
        chunk_to_keywords: dict[str, list[str]] = {}
        for node in nodes:
            if not isinstance(node, dict) or node.get("type") != "Keyword":
                continue
            keyword_id = str(node.get("keywordId") or node.get("id") or "")
            if not keyword_id:
                continue
            chunks = []
            for chunk_id in node.get("chunkIds") or []:
                chunk_text = str(chunk_id or "")
                if not chunk_text:
                    continue
                if chunk_text not in chunks:
                    chunks.append(chunk_text)
                chunk_to_keywords.setdefault(chunk_text, [])
                if keyword_id not in chunk_to_keywords[chunk_text]:
                    chunk_to_keywords[chunk_text].append(keyword_id)
            keyword_to_chunks[keyword_id] = chunks
        return {
            "schemaVersion": "1.0.0",
            "createdAt": utcnow().isoformat(),
            "keywordToChunks": keyword_to_chunks,
            "chunkToKeywords": chunk_to_keywords,
        }

    def _needs_graph_backfill(self, dataset) -> bool:
        if getattr(dataset, "state", None) == "deleted" or not getattr(dataset, "training_task_id", None):
            return False
        summary = dict(getattr(dataset, "graph_summary", {}) or {})
        graph_source = str(summary.get("graphSource") or "").strip()
        try:
            schema_version = int(summary.get("graphSchemaVersion") or 0)
        except (TypeError, ValueError):
            schema_version = 0
        if graph_source == "final_knowledge" and schema_version >= GRAPH_SCHEMA_VERSION:
            return False
        if graph_source == "model_keyword" and schema_version >= GRAPH_SCHEMA_VERSION:
            return False
        if graph_source == "metadata_keyword" and schema_version >= GRAPH_SCHEMA_VERSION:
            current_rule_hash = self._metadata_rule_set_hash()
            if not current_rule_hash or summary.get("metadataRuleSetHash") == current_rule_hash:
                return False
        if graph_source in {"final_knowledge", "model_keyword", "metadata_keyword"}:
            return True
        quality_metrics = dict(getattr(dataset, "quality_metrics", {}) or {})
        knowledge_count = int(quality_metrics.get("knowledgeCount") or 0)
        return knowledge_count == 0

    def _metadata_rule_set_hash(self) -> str | None:
        value = getattr(self.metadata_construction, "rule_set_hash", None)
        return str(value) if value else None

    def _normalize_model_keyword(
        self,
        candidate: dict[str, Any],
        document: dict[str, Any],
    ) -> dict[str, Any] | None:
        identity = self._keyword_identity(candidate.get("name"))
        if identity is None:
            return None
        name = identity[0]
        rules = getattr(self.metadata_construction, "rules", {}) or {}
        if name.casefold() in rules.get("stopwords", set()):
            return None
        title = str(document.get("title") or "").strip()
        semantic_title = str(document.get("semanticTitle") or "").strip()
        if title and semantic_title and title.casefold() != semantic_title.casefold() and name.casefold() == title.casefold():
            return None

        candidate_aliases = self._valid_keyword_aliases(candidate.get("aliases") or [])
        lookup_values = {name.casefold(), *(value.casefold() for value in candidate_aliases)}
        glossary_terms = [
            term
            for terms in (rules.get("glossaries") or {}).values()
            for term in terms
        ]
        for term in glossary_terms:
            term_aliases = self._valid_keyword_aliases([
                term.get("canonicalName"),
                term.get("displayName"),
                *(term.get("aliases") or []),
            ])
            if not lookup_values.intersection(value.casefold() for value in term_aliases):
                continue
            canonical = str(term.get("canonicalName") or name).strip()
            return {
                "canonicalName": canonical,
                "aliases": self._merge_unique_values(term_aliases, candidate_aliases),
                "matchedAliases": self._merge_unique_values([name], candidate_aliases),
                "termId": term.get("termId"),
                "termType": term.get("termType"),
                "category": term.get("category"),
            }
        return {
            "canonicalName": name,
            "aliases": candidate_aliases,
            "matchedAliases": self._merge_unique_values([name], candidate_aliases),
            "termId": None,
            "termType": "model_keyword",
            "category": candidate.get("category"),
        }

    def _keyword_skill_context(self) -> dict[str, Any]:
        system_prompt = self.prompts.get("keyword-extraction.system")
        user_prompt = self.prompts.get("keyword-extraction.user", system_prompt.skill_version)
        skill = self.prompts.skills.get("keyword-extraction", system_prompt.skill_version)
        defaults = skill.manifest.get("defaults", {})
        return {
            "skill": skill,
            "defaults": defaults,
            "systemPromptHash": system_prompt.content_hash,
            "userPromptHash": user_prompt.content_hash,
            "promptHash": hashlib.sha256(
                f"{system_prompt.content_hash}:{user_prompt.content_hash}".encode("utf-8")
            ).hexdigest(),
        }

    def _keyword_candidate_cache_key(
        self,
        chunk: dict[str, Any],
        document: dict[str, Any],
        skill_context: dict[str, Any],
    ) -> str:
        content = str(chunk.get("content") or "")
        content_hash = str(chunk.get("contentHash") or "").strip()
        if not content_hash:
            content_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()
        payload = {
            "contentHash": content_hash,
            "semanticTitle": str(document.get("semanticTitle") or ""),
            "metadataRuleSetHash": self._metadata_rule_set_hash(),
            "skillVersion": getattr(skill_context["skill"], "version", ""),
            "promptHash": skill_context["promptHash"],
        }
        return stable_id(
            "keyword-cache",
            json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")),
        ).split(":", 1)[1]

    def _keyword_candidate_cache_path(self, key: str) -> Path:
        return settings.data_root / "processing" / "keyword-candidate-cache" / f"{key}.json"

    def _read_keyword_candidate_cache(self, key: str) -> list[dict[str, Any]] | None:
        path = self._keyword_candidate_cache_path(key)
        if not path.is_file():
            return None
        try:
            value = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return None
        candidates = value.get("keywordCandidates") if isinstance(value, dict) else None
        if not isinstance(candidates, list):
            return None
        return [item for item in candidates if isinstance(item, dict)]

    def _write_keyword_candidate_cache(
        self,
        key: str,
        candidates: list[dict[str, Any]],
        skill_context: dict[str, Any],
    ) -> None:
        path = self._keyword_candidate_cache_path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(".tmp")
        temporary.write_text(json.dumps({
            "keywordCandidates": candidates,
            "skillVersion": getattr(skill_context["skill"], "version", ""),
            "promptHash": skill_context["promptHash"],
            "metadataRuleSetHash": self._metadata_rule_set_hash(),
            "createdAt": utcnow().isoformat(),
        }, ensure_ascii=False, indent=2), encoding="utf-8")
        temporary.replace(path)

    def _deterministic_keyword_candidates(
        self,
        task_id: str,
        document: dict[str, Any],
        resource_chunks: list[dict[str, Any]],
        low_confidence_threshold: float,
    ) -> list[dict[str, Any]]:
        rules = getattr(self.metadata_construction, "rules", {}) or {}
        title_glossary_confidence = (
            (rules.get("titleCleaning") or {}).get("titleGlossaryConfidence")
            or 0.82
        )
        title_topic_confidence = float(
            (rules.get("titleCleaning") or {}).get("titleTopicConfidence")
            or 0.78
        )
        title_topic_max_characters = int(
            (rules.get("titleCleaning") or {}).get("titleTopicMaxCharacters")
            or 40
        )
        semantic_title = str(document.get("semanticTitle") or "").strip()
        if not semantic_title or not resource_chunks:
            return []
        semantic_folded = semantic_title.casefold()
        heading_text = "\n".join(
            " / ".join(str(part) for part in (chunk.get("headingPath") or []))
            for chunk in resource_chunks
        )
        content_text = "\n\n".join(str(chunk.get("content") or "") for chunk in resource_chunks)
        evidence_haystack = f"{semantic_title}\n{heading_text}\n{content_text}"
        candidates: list[dict[str, Any]] = []
        seen: set[tuple[str, str]] = set()

        # === 1. 领域词典匹配（标题+正文） ===
        for term in document.get("domainTerms") or []:
            if not isinstance(term, dict):
                continue
            aliases = self._valid_keyword_aliases([
                term.get("canonicalName"),
                *(term.get("aliases") or []),
                *(term.get("matchedAliases") or []),
            ])
            # 先在标题中查找证据
            evidence = next(
                (
                    alias for alias in sorted(aliases, key=len, reverse=True)
                    if alias.casefold() in semantic_folded and alias in evidence_haystack
                ),
                None,
            )
            evidence_source = "domain_glossary"
            evidence_confidence = float(title_glossary_confidence)
            # 如果标题中没有，在正文中查找
            if not evidence:
                evidence = next(
                    (
                        alias for alias in sorted(aliases, key=len, reverse=True)
                        if alias in content_text
                    ),
                    None,
                )
                if evidence:
                    evidence_source = "content_glossary"
                    evidence_confidence = 0.72
            canonical = str(term.get("canonicalName") or evidence or "").strip()
            identity = self._keyword_node_identity(canonical, term.get("termId"))
            if not evidence or not identity:
                continue
            if self._is_excluded_keyword(canonical, context=evidence_haystack[:500]):
                continue
            key = (str(term.get("termId") or "").casefold(), identity[1])
            if key in seen:
                continue
            seen.add(key)
            evidence_chunk = next(
                (
                    chunk for chunk in resource_chunks
                    if evidence in str(chunk.get("content") or "")
                    or evidence in " / ".join(str(part) for part in (chunk.get("headingPath") or []))
                ),
                resource_chunks[0],
            )
            candidates.append({
                "candidateId": stable_id("keyword-candidate", task_id, str(evidence_chunk.get("id") or evidence_chunk.get("chunkId") or ""), canonical, evidence),
                "taskId": task_id,
                "stageRunId": self._stage_run_id(task_id, "deterministic_extraction"),
                "resourceId": str(document.get("resourceId") or ""),
                "chunkId": str(evidence_chunk.get("id") or evidence_chunk.get("chunkId") or ""),
                "sourcePath": evidence_chunk.get("sourcePath"),
                "documentTitle": document.get("title"),
                "semanticTitle": semantic_title,
                "sourceMethod": "deterministic_title_glossary" if evidence_source == "domain_glossary" else "deterministic_content_glossary",
                "canonicalName": canonical,
                "aliases": aliases,
                "matchedAliases": self._valid_keyword_aliases([evidence]),
                "termId": term.get("termId"),
                "termType": term.get("termType"),
                "category": term.get("category"),
                "evidenceSource": evidence_source,
                "evidenceText": evidence,
                "confidence": evidence_confidence,
                "approvalStatus": "autoAccepted" if evidence_confidence >= low_confidence_threshold else "pending",
            })

        # === 2. 标题降级提取 ===
        title_identity = self._keyword_identity(semantic_title)
        title_is_single_topic = (
            title_identity is not None
            and len(semantic_title) <= title_topic_max_characters
            and not any(separator in semantic_title for separator in ("&&", "&", "/", "\\", "|", "、", "，", ",", ";", "；"))
            and semantic_title.casefold() not in (rules.get("stopwords") or set())
            and not self._is_excluded_keyword(semantic_title, context=semantic_title)  # 排除工单号、人名等
        )
        if title_is_single_topic and not candidates:
            title_folded = semantic_title.casefold()
            evidence_chunk = next(
                (
                    chunk for chunk in resource_chunks
                    if title_folded in str(chunk.get("content") or "").casefold()
                    or title_folded in " / ".join(str(part) for part in (chunk.get("headingPath") or [])).casefold()
                ),
                resource_chunks[0],
            )
            candidates.append({
                "candidateId": stable_id("keyword-candidate", task_id, str(evidence_chunk.get("id") or evidence_chunk.get("chunkId") or ""), semantic_title, "title"),
                "taskId": task_id,
                "stageRunId": self._stage_run_id(task_id, "deterministic_extraction"),
                "resourceId": str(document.get("resourceId") or ""),
                "chunkId": str(evidence_chunk.get("id") or evidence_chunk.get("chunkId") or ""),
                "sourcePath": evidence_chunk.get("sourcePath"),
                "documentTitle": document.get("title"),
                "semanticTitle": semantic_title,
                "sourceMethod": "deterministic_title_fallback",
                "canonicalName": semantic_title,
                "aliases": [semantic_title],
                "matchedAliases": [semantic_title],
                "termId": None,
                "termType": "title_topic",
                "category": "主题",
                "evidenceSource": "heading",
                "evidenceText": semantic_title,
                "confidence": title_topic_confidence,
                "approvalStatus": "autoAccepted" if title_topic_confidence >= low_confidence_threshold else "pending",
            })

        # === 3. 正文模式匹配提取 ===
        pattern_confidence = 0.75
        seen_patterns: set[str] = set()

        # 3a. YAS-XXXXX 错误码
        for match in re.finditer(r"(YAS-\d{4,5})", content_text, re.IGNORECASE):
            error_code = match.group(1).upper()
            if error_code in seen_patterns:
                continue
            seen_patterns.add(error_code)
            evidence_chunk = next(
                (chunk for chunk in resource_chunks if error_code in str(chunk.get("content") or "")),
                resource_chunks[0],
            )
            chunk_id = str(evidence_chunk.get("id") or evidence_chunk.get("chunkId") or "")
            candidates.append({
                "candidateId": stable_id("keyword-candidate", task_id, chunk_id, error_code, "error_code"),
                "taskId": task_id,
                "stageRunId": self._stage_run_id(task_id, "deterministic_extraction"),
                "resourceId": str(document.get("resourceId") or ""),
                "chunkId": chunk_id,
                "sourcePath": evidence_chunk.get("sourcePath"),
                "documentTitle": document.get("title"),
                "semanticTitle": semantic_title,
                "sourceMethod": "deterministic_pattern_error_code",
                "canonicalName": error_code,
                "aliases": [error_code, error_code.lower()],
                "matchedAliases": [error_code],
                "termId": f"yashandb.error.{error_code}",
                "termType": "error_code",
                "category": "故障诊断",
                "evidenceSource": "content_pattern",
                "evidenceText": error_code,
                "confidence": pattern_confidence,
                "approvalStatus": "autoAccepted" if pattern_confidence >= low_confidence_threshold else "pending",
            })

        # 3b. ORA-XXXXX 错误码
        for match in re.finditer(r"(ORA-\d{4,5})", content_text, re.IGNORECASE):
            error_code = match.group(1).upper()
            if error_code in seen_patterns:
                continue
            seen_patterns.add(error_code)
            evidence_chunk = next(
                (chunk for chunk in resource_chunks if error_code in str(chunk.get("content") or "")),
                resource_chunks[0],
            )
            chunk_id = str(evidence_chunk.get("id") or evidence_chunk.get("chunkId") or "")
            candidates.append({
                "candidateId": stable_id("keyword-candidate", task_id, chunk_id, error_code, "oracle_error_code"),
                "taskId": task_id,
                "stageRunId": self._stage_run_id(task_id, "deterministic_extraction"),
                "resourceId": str(document.get("resourceId") or ""),
                "chunkId": chunk_id,
                "sourcePath": evidence_chunk.get("sourcePath"),
                "documentTitle": document.get("title"),
                "semanticTitle": semantic_title,
                "sourceMethod": "deterministic_pattern_oracle_error",
                "canonicalName": error_code,
                "aliases": [error_code, error_code.lower()],
                "matchedAliases": [error_code],
                "termId": f"oracle.error.{error_code}",
                "termType": "error_code",
                "category": "故障诊断",
                "evidenceSource": "content_pattern",
                "evidenceText": error_code,
                "confidence": pattern_confidence,
                "approvalStatus": "autoAccepted" if pattern_confidence >= low_confidence_threshold else "pending",
            })

        # 3d. 中文技术术语提取（高频出现的专业术语）
        chinese_term_confidence = 0.65
        technical_terms = [
            "索引", "表空间", "数据字典", "事务", "死锁", "主备复制", "大对象",
            "存储过程", "触发器", "游标", "视图", "序列", "分区", "集群",
            "归档", "备份", "恢复", "优化器", "执行计划", "统计信息",
            "权限", "角色", "用户", "模式", "约束",
            "函数", "包", "类型", "对象", "锁", "缓存",
        ]
        seen_chinese_terms: set[str] = set()
        for term in technical_terms:
            if term in seen_chinese_terms:
                continue
            if term not in content_text:
                continue
            if self._is_excluded_keyword(term, context=content_text[:500]):
                continue
            term_identity = self._keyword_identity(term)
            if not term_identity:
                continue
            canonical_name, identity_key = term_identity
            key = ("", identity_key)
            if key in seen:
                continue
            seen.add(key)
            seen_chinese_terms.add(term)
            evidence_chunk = next(
                (chunk for chunk in resource_chunks if term in str(chunk.get("content") or "")),
                resource_chunks[0],
            )
            chunk_id = str(evidence_chunk.get("id") or evidence_chunk.get("chunkId") or "")
            candidates.append({
                "candidateId": stable_id("keyword-candidate", task_id, chunk_id, canonical_name, "chinese_term"),
                "taskId": task_id,
                "stageRunId": self._stage_run_id(task_id, "deterministic_extraction"),
                "resourceId": str(document.get("resourceId") or ""),
                "chunkId": chunk_id,
                "sourcePath": evidence_chunk.get("sourcePath"),
                "documentTitle": document.get("title"),
                "semanticTitle": semantic_title,
                "sourceMethod": "deterministic_pattern_chinese_term",
                "canonicalName": canonical_name,
                "aliases": [canonical_name],
                "matchedAliases": [canonical_name],
                "termId": None,
                "termType": "technical_term",
                "category": "技术术语",
                "evidenceSource": "content_pattern",
                "evidenceText": term,
                "confidence": chinese_term_confidence,
                "approvalStatus": "autoAccepted" if chinese_term_confidence >= low_confidence_threshold else "pending",
            })

        return candidates

    def _keyword_model_envelope(
        self,
        batch_chunks: list[dict[str, Any]],
        document_lookup: dict[str, dict[str, Any]],
        known_keywords_by_resource: dict[str, list[str]],
        max_candidates_per_chunk: int,
    ) -> dict[str, Any]:
        first_document = document_lookup.get(str(batch_chunks[0].get("resourceId") or ""), {}) if batch_chunks else {}
        return {
            "documentType": first_document.get("documentType", "general_technical"),
            "extractionProfile": first_document.get("extractionProfile", "general-technical"),
            "domain": "yashandb",
            "maxCandidatesPerChunk": max_candidates_per_chunk,
            "document": {
                "title": first_document.get("title"),
                "semanticTitle": first_document.get("semanticTitle"),
                "summary": first_document.get("summary"),
                "category": first_document.get("category"),
                "domainTerms": first_document.get("domainTerms") or [],
            },
            "chunks": [{
                "chunkId": str(chunk.get("id") or chunk.get("chunkId") or ""),
                "resourceId": str(chunk.get("resourceId") or ""),
                "sourcePath": chunk.get("sourcePath"),
                "headingPath": chunk.get("headingPath") or [],
                "content": str(chunk.get("content") or ""),
                "document": {
                    "title": document_lookup.get(str(chunk.get("resourceId") or ""), {}).get("title"),
                    "semanticTitle": document_lookup.get(str(chunk.get("resourceId") or ""), {}).get("semanticTitle"),
                    "summary": document_lookup.get(str(chunk.get("resourceId") or ""), {}).get("summary"),
                    "category": document_lookup.get(str(chunk.get("resourceId") or ""), {}).get("category"),
                    "domainTerms": document_lookup.get(str(chunk.get("resourceId") or ""), {}).get("domainTerms") or [],
                    "knownKeywords": known_keywords_by_resource.get(str(chunk.get("resourceId") or ""), []),
                },
            } for chunk in batch_chunks],
            "schemaVersion": "2.1.0",
        }

    def _keyword_dynamic_batches(
        self,
        chunks: list[dict[str, Any]],
        document_lookup: dict[str, dict[str, Any]],
        known_keywords_by_resource: dict[str, list[str]],
        max_chunks: int,
        max_characters: int,
        max_candidates_per_chunk: int,
    ) -> list[list[dict[str, Any]]]:
        batches: list[list[dict[str, Any]]] = []
        current: list[dict[str, Any]] = []
        current_size = 0
        for chunk in sorted(chunks, key=lambda item: (str(item.get("resourceId") or ""), int(item.get("chunkIndex", 0)))):
            envelope = self._keyword_model_envelope([chunk], document_lookup, known_keywords_by_resource, max_candidates_per_chunk)
            item_size = len(json.dumps(envelope, ensure_ascii=False))
            if current and (len(current) >= max_chunks or current_size + item_size > max_characters):
                batches.append(current)
                current = []
                current_size = 0
            current.append(chunk)
            current_size += item_size
        if current:
            batches.append(current)
        return batches

    def _invoke_keyword_skill_once(
        self,
        envelope: dict[str, Any],
        trace: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        system_prompt = self.prompts.get("keyword-extraction.system")
        user_prompt = self.prompts.get("keyword-extraction.user", system_prompt.skill_version)
        skill = self.prompts.skills.get("keyword-extraction", system_prompt.skill_version)
        defaults = skill.manifest.get("defaults", {})
        input_schema = json.loads((skill.root / skill.manifest["inputSchema"]).read_text(encoding="utf-8"))
        validate(instance={"contextEnvelope": envelope}, schema=input_schema)
        user = user_prompt.content.replace("{{context_envelope}}", json.dumps(envelope, ensure_ascii=False))
        options = {"temperature": 0.1, "max_retries": 0}
        if "maxTokens" in defaults:
            options["max_tokens"] = int(defaults["maxTokens"])
        if "timeoutMs" in defaults:
            options["timeout_ms"] = int(defaults["timeoutMs"])
        if "enableThinking" in defaults:
            options["enable_thinking"] = bool(defaults["enableThinking"])
        if "chatTemplateKwargs" in defaults:
            options["chat_template_kwargs"] = defaults["chatTemplateKwargs"]
        if "jsonRepair" in defaults:
            options["json_repair"] = bool(defaults["jsonRepair"])
        network_retries = int(defaults.get("maxRetries", 0))
        messages = [{"role": "system", "content": system_prompt.content}, {"role": "user", "content": user}]
        model_calls = {"succeeded": 0, "failed": 0}
        model_call_ids: list[str] = []

        def call_model(retry_of: str | None = None):
            model_call_id = f"model_call_{uuid.uuid4().hex[:20]}"
            model_call_ids.append(model_call_id)
            details = {**(trace or {}), "modelCallId": model_call_id, "retryOf": retry_of, "skillId": "keyword-extraction"}
            if trace and trace.get("taskId"):
                self._log(trace["taskId"], "info", trace["stage"], "model_call.started", "模型调用开始：keyword-extraction", details=details)
            started_at = time.monotonic()
            try:
                response = self.gateway.chat_json(messages, options)
            except Exception as error:
                model_calls["failed"] += 1
                if trace and trace.get("taskId"):
                    self._log(
                        trace["taskId"], "error", trace["stage"], "model_call.failed",
                        f"模型调用失败：keyword-extraction - {error_summary(error)}",
                        details={**details, "durationMs": int((time.monotonic() - started_at) * 1000), "technicalError": str(error)},
                    )
                raise
            if trace and trace.get("taskId"):
                self._log(
                    trace["taskId"], "info", trace["stage"], "model_call.completed", "模型调用完成：keyword-extraction",
                    details={**details, "durationMs": int((time.monotonic() - started_at) * 1000), "attempts": response.get("attempts", 1)},
                )
            attempts = max(1, int(response.get("attempts", 1)))
            model_calls["failed"] += attempts - 1
            model_calls["succeeded"] += 1
            response["_modelCalls"] = dict(model_calls)
            response["_modelCallIds"] = list(model_call_ids)
            response["_modelCallId"] = model_call_id
            response["_agentTaskId"] = (trace or {}).get("agentTaskId")
            response["data"] = self._normalize_skill_output(
                "keyword-extraction",
                response.get("data"),
                {"context_envelope": json.dumps(envelope, ensure_ascii=False)},
                skill.version,
            )
            return response

        retry_of = None
        for attempt in range(network_retries + 1):
            try:
                return call_model(retry_of=retry_of)
            except Exception as error:
                if attempt >= network_retries:
                    error.model_calls = model_calls
                    error.model_call_ids = list(model_call_ids)
                    error.model_call_id = model_call_ids[-1] if model_call_ids else None
                    raise
                retry_of = model_call_ids[-1] if model_call_ids else None
        raise AssertionError("关键词模型调用未返回结果")

    def _valid_keyword_chunk_results(
        self,
        data: dict[str, Any],
        batch_chunks: list[dict[str, Any]],
        document_lookup: dict[str, dict[str, Any]],
        max_candidates_per_chunk: int,
    ) -> tuple[dict[str, list[dict[str, Any]]], list[str]]:
        expected_chunk_ids = {str(chunk.get("id") or chunk.get("chunkId") or "") for chunk in batch_chunks}
        valid: dict[str, list[dict[str, Any]]] = {}
        invalid = set(expected_chunk_ids)
        if not isinstance(data, dict):
            return valid, sorted(invalid)
        for result in data.get("results") or []:
            if not isinstance(result, dict):
                continue
            chunk_id = str(result.get("chunkId") or "")
            if chunk_id not in expected_chunk_ids:
                continue
            chunk = next((item for item in batch_chunks if str(item.get("id") or item.get("chunkId") or "") == chunk_id), {})
            document = document_lookup.get(str(chunk.get("resourceId") or ""), {})
            candidates: list[dict[str, Any]] = []
            chunk_invalid = False
            for keyword in (result.get("keywordCandidates") or [])[:max_candidates_per_chunk]:
                if not isinstance(keyword, dict):
                    chunk_invalid = True
                    continue
                if not all(keyword.get(key) is not None for key in ("name", "aliases", "category", "evidenceSource", "evidenceText", "confidence")):
                    chunk_invalid = True
                    continue
                normalized = self._normalize_model_keyword(keyword, document)
                if normalized is None:
                    continue
                evidence_source = str(keyword.get("evidenceSource") or "")
                evidence = str(keyword.get("evidenceText") or "")
                source_text = "\n".join([
                    str(document.get("title") or ""),
                    str(document.get("semanticTitle") or ""),
                    str(document.get("summary") or ""),
                    " / ".join(str(part) for part in (chunk.get("headingPath") or [])),
                    str(chunk.get("content") or ""),
                    json.dumps(document.get("domainTerms") or [], ensure_ascii=False),
                ])
                if evidence_source in {"title", "heading", "content", "domain_glossary"} and evidence and evidence not in source_text:
                    chunk_invalid = True
                    continue
                candidates.append(keyword)
            if not chunk_invalid:
                valid[chunk_id] = candidates
                invalid.discard(chunk_id)
        return valid, sorted(invalid)

    def _model_knowledge_candidate(
        self,
        task_id: str,
        kind: str,
        item: dict[str, Any],
        chunk: dict[str, Any],
        keyword_context: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        evidence = str(item.get("evidenceText") or "")
        local_start = str(chunk.get("content") or "").find(evidence) if evidence else -1
        base_offset = int((chunk.get("documentOffsets") or {}).get("start", 0))
        offsets = {
            "start": base_offset + local_start if local_start >= 0 else -1,
            "end": base_offset + local_start + len(evidence) if local_start >= 0 else -1,
        }
        value = {
            key: value
            for key, value in item.items()
            if key not in {"chunkId", "chunkIds", "evidenceText", "confidence", "agentTaskId", "modelCallId"}
        }
        chunk_id = str(chunk.get("id") or chunk.get("chunkId") or "")
        keyword_context = keyword_context or []
        keyword_context = self._normalize_formal_keyword_context(keyword_context)
        return {
            "candidateId": stable_id("candidate", task_id, kind, chunk_id, evidence, json.dumps(value, ensure_ascii=False, sort_keys=True)),
            "taskId": task_id,
            "stageRunId": self._stage_run_id(task_id, "deterministic_extraction"),
            "state": "agent_resolved",
            "kind": kind,
            "resourceId": chunk.get("resourceId"),
            "sourceResourceId": chunk.get("resourceId"),
            "chunkId": chunk_id,
            "sourcePath": chunk.get("sourcePath"),
            "value": value,
            "evidenceText": evidence,
            "evidenceOffsets": offsets,
            "sourceMethod": "knowledge_extraction_workflow_agent",
            "schemaVersion": "2.0.0",
            "inputHash": chunk.get("contentHash"),
            "confidence": item.get("confidence"),
            "agentTaskId": item.get("agentTaskId"),
            "modelCallId": item.get("modelCallId"),
            "keywordIds": [item["keywordId"] for item in keyword_context if item.get("keywordId")],
            "keywordContext": keyword_context,
        }

    @staticmethod
    def _normalize_formal_keyword_context(keyword_context: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
        unique: dict[str, dict[str, Any]] = {}
        for item in keyword_context or []:
            if not isinstance(item, dict):
                continue
            keyword_id = str(item.get("keywordId") or "").strip()
            if not keyword_id:
                continue
            unique.setdefault(keyword_id, item)
        return [unique[key] for key in sorted(unique)]

    @staticmethod
    def clean_display_name(value: Any) -> str:
        return DISPLAY_NAME_PREFIX_PATTERN.sub("", str(value or "").strip())

    @staticmethod
    def _merge_unique_values(values: list[Any], additions: list[Any] | tuple[Any, ...]) -> list[Any]:
        merged = list(values)
        for item in additions:
            if item and item not in merged:
                merged.append(item)
        return merged

    @classmethod
    def _normalize_keyword_text(cls, value: Any) -> str:
        text = re.sub(r"\s+", " ", cls.clean_display_name(value)).strip(".,;:()[]{}，。；：（）【】")
        return text.strip()

    @classmethod
    def _is_technical_keyword(cls, value: Any) -> bool:
        text = cls._normalize_keyword_text(value).casefold()
        if not text:
            return True
        for prefix in TECHNICAL_KEYWORD_PREFIXES:
            if text.startswith(prefix):
                suffix = text[len(prefix):]
                if re.fullmatch(r"[0-9a-z:-]{4,}", suffix):
                    return True
        return bool(
            re.fullmatch(r"(?:dataset|file|chunk|resource|document|task|batch|run|node|edge|unit)[_-][0-9a-z:-]{4,}", text)
            and (any(ch.isdigit() for ch in text) or ":" in text)
        )

    @classmethod
    def _is_excluded_keyword(cls, value: Any, context: str = "") -> bool:
        """检查关键词是否应被排除（工单号、人名等）"""
        text = cls._normalize_keyword_text(value)
        if not text:
            return True
        
        # 检查排除模式（YDBRD-xxx, YASHAN-xxx, 文件hash前缀等）
        for pattern in EXCLUDED_KEYWORD_PATTERNS:
            if pattern.search(text):
                return True
        
        # 人名检测：纯中文 2-4 字且不在技术术语列表中
        if re.fullmatch(r"[\u4e00-\u9fff]{2,4}", text):
            # 常见技术术语关键词（用于排除人名）
            technical_indicators = [
                "索引", "表", "事务", "锁", "日志", "存储", "函数", "过程",
                "数据", "对象", "用户", "权限", "角色", "模式", "视图", "序列",
                "分区", "集群", "备份", "恢复", "归档", "缓存", "内存", "磁盘",
                "网络", "连接", "会话", "进程", "线程", "队列", "调度", "优化",
                "执行", "计划", "统计", "信息", "约束", "触发", "游标", "包",
                "类型", "死锁", "复制", "大对象", "诊断", "故障", "错误", "代码",
            ]
            # 如果包含技术术语指示词，不是人名
            if any(indicator in text for indicator in technical_indicators):
                return False
            # 否则可能是人名，排除
            return True
        
        return False

    @classmethod
    def _keyword_identity(cls, value: Any) -> tuple[str, str] | None:
        text = cls._normalize_keyword_text(value)
        if not text or cls._is_technical_keyword(text):
            return None
        return text, text.casefold()

    @classmethod
    def _keyword_node_identity(cls, value: Any, term_id: Any = None) -> tuple[str, str] | None:
        identity = cls._keyword_identity(value)
        if not identity:
            return None
        canonical_name, normalized_name = identity
        normalized_term_id = str(term_id or "").strip().casefold()
        key = f"term:{normalized_term_id}" if normalized_term_id else f"canonical:{normalized_name}"
        return canonical_name, key

    @classmethod
    def _valid_keyword_aliases(cls, values: list[Any] | tuple[Any, ...]) -> list[str]:
        aliases: list[str] = []
        for value in values:
            identity = cls._keyword_identity(value)
            if identity and identity[0] not in aliases:
                aliases.append(identity[0])
        return aliases

    @classmethod
    def _graph_node_lookup_values(cls, node: dict[str, Any]) -> set[str]:
        values: set[str] = set()
        for key in ("id", "name", "displayName", "rawName", "canonicalName"):
            raw = node.get(key)
            if raw:
                values.add(str(raw).casefold())
        for key in ("aliases", "matchedAliases", "sourceResourceIds", "chunkIds"):
            collection = node.get(key)
            if isinstance(collection, list):
                for item in collection:
                    if item:
                        values.add(str(item).casefold())
        properties = node.get("properties") if isinstance(node.get("properties"), dict) else {}
        for key in ("canonicalName", "aliases", "matchedAliases", "sourceMethod", "termId"):
            raw = properties.get(key)
            if isinstance(raw, list):
                for item in raw:
                    if item:
                        values.add(str(item).casefold())
            elif raw:
                values.add(str(raw).casefold())
        return values

    @classmethod
    def _resolve_graph_node(cls, nodes: list[dict[str, Any]], node_id: str) -> dict[str, Any] | None:
        if not node_id:
            return None
        raw_target = str(node_id)
        target = raw_target.casefold()
        for node in nodes:
            if str(node.get("id") or "") == raw_target:
                return node
        for node in nodes:
            if target in cls._graph_node_lookup_values(node):
                return node
        return None

    @classmethod
    def _node_with_display_name(cls, node: dict[str, Any]) -> dict[str, Any]:
        raw_name = str(node.get("rawName") or node.get("name") or "")
        display_name = cls.clean_display_name(node.get("displayName") or raw_name)
        text = cls._node_semantic_text(node, display_name, raw_name)
        ontology_type = str(node.get("ontologyType") or cls._infer_ontology_type(node, text))
        knowledge_domain = str(node.get("knowledgeDomain") or cls._infer_knowledge_domain(ontology_type, node, text))
        task_context = str(node.get("taskContext") or cls._infer_task_context(text))
        return {
            **node,
            "name": display_name,
            "rawName": raw_name,
            "displayName": display_name,
            "ontologyType": ontology_type,
            "knowledgeDomain": knowledge_domain,
            "taskContext": task_context,
        }

    @classmethod
    def _with_graph_display_names(cls, nodes: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return [cls._node_with_display_name(node) if isinstance(node, dict) else node for node in nodes]

    @classmethod
    def _node_semantic_text(cls, node: dict[str, Any], display_name: str | None = None, raw_name: str | None = None) -> str:
        values = [
            display_name or node.get("displayName") or node.get("name") or "",
            raw_name or node.get("rawName") or "",
            node.get("type") or "",
            node.get("evidenceText") or "",
        ]
        properties = node.get("properties") if isinstance(node.get("properties"), dict) else {}
        for key in ("title", "statement", "sourcePath", "chunkSummary", "contentPreview", "sourceMethod", "category", "termType"):
            if properties.get(key):
                values.append(properties[key])
        return " ".join(str(value) for value in values if value)

    @classmethod
    def _infer_ontology_type(cls, node: dict[str, Any], text: str) -> str:
        node_type = str(node.get("type") or "Concept")
        if node_type in {"ProcessingUnit", "Chunk", "Document"}:
            return "Evidence"
        if node_type in {"Parameter", "Concept", "Component", "Configuration", "Version", "ErrorCode", "YashanDBErrorCode", "OracleErrorCode"}:
            return node_type
        if cls._contains_any(text, SYMPTOM_HINTS):
            return "Symptom"
        if cls._contains_any(text, CONSTRAINT_HINTS):
            return "Constraint"
        if cls._contains_any(text, DECISION_HINTS):
            return "Decision"
        if cls._contains_any(text, SOLUTION_HINTS):
            return "Solution"
        if cls._contains_any(text, HOW_HINTS):
            return "Procedure"
        if cls._contains_any(text, WHY_HINTS):
            return "Principle"
        return "Concept" if node_type in {"Keyword", "KnowledgePoint"} else node_type

    @staticmethod
    def _infer_knowledge_domain(ontology_type: str, node: dict[str, Any], text: str) -> str:
        if str(node.get("type") or "") in {"ProcessingUnit", "Chunk", "Document"}:
            return "evidence"
        if ontology_type in {"Procedure", "Solution"}:
            return "how"
        if ontology_type in {"Principle", "Decision", "Constraint", "Symptom"}:
            return "why"
        if any(hint in text for hint in HOW_HINTS):
            return "how"
        if any(hint in text for hint in WHY_HINTS):
            return "why"
        return "what"

    @classmethod
    def _infer_task_context(cls, text: str) -> str:
        for context, hints in TASK_CONTEXT_HINTS.items():
            if cls._contains_any(text, hints):
                return context
        return "general"

    @staticmethod
    def _contains_any(text: str, hints: tuple[str, ...]) -> bool:
        normalized = str(text or "").casefold()
        return any(str(hint).casefold() in normalized for hint in hints)

    def logs(self, task_id: str, offset: int = 0, limit: int = 200) -> dict[str, Any]:
        self.get(task_id)
        path = self._run_dir(task_id) / "events.jsonl"
        items = self._read_jsonl(path)
        page = items[offset:offset + limit]
        return {
            "items": page,
            "total": len(items),
            "offset": offset,
            "nextOffset": offset + len(page),
            "logPath": f"training-runs/{task_id}/events.jsonl",
        }

    def review_items(self, task_id: str) -> list[dict[str, Any]]:
        self.get(task_id)
        return self._read_review_items(task_id)

    def quality_issues(
        self,
        task_id: str,
        severity: str | None = None,
        offset: int = 0,
        limit: int = 100,
    ) -> dict[str, Any]:
        self.get(task_id)
        path = self._run_dir(task_id) / "quality" / "issues.json"
        items: list[dict[str, Any]] = []
        if path.exists():
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                if isinstance(data, list):
                    items = [item for item in data if isinstance(item, dict)]
            except json.JSONDecodeError:
                items = []
        items = self._normalize_quality_issues_for_display(items)
        all_counts: dict[str, int] = {}
        for item in items:
            key = self._issue_severity(item)
            all_counts[key] = all_counts.get(key, 0) + 1
        overall_total = len(items)
        if severity:
            expected = severity.casefold()
            items = [
                item for item in items
                if self._issue_severity(item).casefold() == expected
            ]
        counts: dict[str, int] = {}
        for item in items:
            key = self._issue_severity(item)
            counts[key] = counts.get(key, 0) + 1
        page = items[offset:offset + limit]
        return {
            "items": page,
            "total": len(items),
            "overallTotal": overall_total,
            "offset": offset,
            "nextOffset": offset + len(page),
            "counts": all_counts,
            "pageCounts": counts,
            "artifactPath": f"training-runs/{task_id}/quality/issues.json",
        }

    @staticmethod
    def _normalize_quality_issues_for_display(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
        normalized: list[dict[str, Any]] = []
        for item in items:
            code = str(item.get("code") or "")
            if code in {"METADATA_TITLE_MISSING", "METADATA_VERSION_UNCLEAR"}:
                continue
            current = dict(item)
            if code in {"METADATA_CATEGORY_CONFLICT", "METADATA_CATEGORY_UNRESOLVED"}:
                current["severity"] = "info"
                details = current.get("details") if isinstance(current.get("details"), dict) else {}
                details = dict(details)
                details["severity"] = "info"
                current["details"] = details
                if code == "METADATA_CATEGORY_CONFLICT":
                    current["message"] = "文档命中多个分类候选，已暂按未分类处理，不影响知识提取"
                else:
                    current["message"] = "文档分类无法由固定规则确定，已归类为“未分类”，不影响知识提取"
            normalized.append(current)
        return normalized

    @staticmethod
    def _issue_severity(item: dict[str, Any]) -> str:
        details = item.get("details") if isinstance(item.get("details"), dict) else {}
        return str(item.get("severity") or details.get("severity") or "unknown")

    def pending_review_counts_by_batch(self) -> dict[str, int]:
        counts: dict[str, int] = {}
        for task in self.list():
            pending = sum(
                1 for item in self._read_review_items(task.id)
                if item.get("state", "pending") == "pending"
            )
            if pending:
                counts[task.batch_id] = counts.get(task.batch_id, 0) + pending
        return counts

    def decide_review_item(
        self,
        task_id: str,
        item_id: str,
        decision: TrainingReviewDecision,
    ) -> dict[str, Any]:
        self.get(task_id)
        with self._review_lock:
            items = self._read_review_items(task_id)
            target = next((item for item in items if item["id"] == item_id), None)
            if target is None:
                raise KeyError(item_id)
            target.update({
                "state": decision.decision,
                "note": decision.note,
                "operatorLabel": decision.operator_label,
                "decidedAt": utcnow().isoformat(),
            })
            self._write_review_items(task_id, items)
        action = "保留" if decision.decision == "accepted" else "排除"
        self._log(
            task_id,
            "info",
            target.get("stage", "review"),
            "review.decided",
            f"待确认项已{action}：{target['message']}",
            details={"reviewItemId": item_id, "decision": decision.decision},
        )
        return target

    def _set_stage(
        self,
        task_id: str,
        stage: str,
        state: str = "running",
        *,
        current: int | None = None,
        total: int | None = None,
        unit: str | None = None,
        detail_message: str | None = None,
        **changes: Any,
    ) -> None:
        task = self.tasks.get(task_id)
        public_stage = STAGE_ALIASES.get(stage, stage)
        stages = []
        now = utcnow()
        for item in task.stages:
            updated = dict(item)
            if item["id"] == public_stage:
                updated["state"] = state
                updated.setdefault("startedAt", now.isoformat())
                if current is not None:
                    updated["current"] = current
                if total is not None:
                    updated["total"] = total
                if unit:
                    updated["unit"] = unit
                if detail_message:
                    updated["message"] = detail_message
                if state in {"completed", "failed", "skipped", "cancelled"}:
                    updated["completedAt"] = now.isoformat()
                    started_at = datetime.fromisoformat(updated["startedAt"])
                    updated["durationMs"] = max(0, int((now - started_at).total_seconds() * 1000))
            stages.append(updated)
        completed = sum(1 for item in stages if item["state"] in {"completed", "failed", "skipped"})
        progress_detail = {
            "stage": public_stage,
            "current": current or 0,
            "total": total,
            "unit": unit,
            "message": detail_message or STAGE_NAMES.get(public_stage, public_stage),
        }
        self.tasks._update(
            task_id,
            stage=public_stage,
            stages=stages,
            completed=completed,
            progress_detail=progress_detail,
            **changes,
        )
        event = "stage.started" if state == "running" else f"stage.{state}"
        level = "error" if state == "failed" else "info"
        state_text = {"running": "开始", "completed": "完成", "skipped": "跳过", "failed": "失败"}.get(state, state)
        self._log(
            task_id,
            level,
            stage,
            event,
            detail_message or f"{STAGE_NAMES.get(public_stage, stage)}{state_text}",
            current=current,
            total=total,
        )

    def _update_stage_progress(
        self,
        task_id: str,
        stage: str,
        current: int,
        total: int,
        unit: str,
        message: str,
        *,
        level: str = "info",
        event: str = "work_item.completed",
        details: dict[str, Any] | None = None,
        **changes: Any,
    ) -> None:
        task = self.tasks.get(task_id)
        public_stage = STAGE_ALIASES.get(stage, stage)
        stages = []
        for item in task.stages:
            updated = dict(item)
            if item["id"] == public_stage:
                updated.update({"current": current, "total": total, "unit": unit, "message": message})
            stages.append(updated)
        self.tasks._update(
            task_id,
            stages=stages,
            progress_detail={
                "stage": public_stage,
                "current": current,
                "total": total,
                "unit": unit,
                "message": message,
            },
            **changes,
        )
        self._log(task_id, level, stage, event, message, current=current, total=total, details=details)

    @staticmethod
    def _run_dir(task_id: str) -> Path:
        return settings.data_root / "training-runs" / task_id

    def _stage_run_id(self, task_id: str, stage: str) -> str:
        try:
            task = self.tasks.get(task_id)
            for item in task.stages:
                if item.get("id") == stage and item.get("stageRunId"):
                    return str(item["stageRunId"])
        except (KeyError, AttributeError):
            pass
        return stable_id("stage-run", task_id, stage)

    def _log(
        self,
        task_id: str,
        level: str,
        stage: str,
        event: str,
        message: str,
        *,
        current: int | None = None,
        total: int | None = None,
        details: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        path = self._run_dir(task_id) / "events.jsonl"
        path.parent.mkdir(parents=True, exist_ok=True)
        detail_values = details or {}
        try:
            batch_id = self.tasks.get(task_id).batch_id
        except (KeyError, AttributeError):
            batch_id = None
        with self._event_lock:
            sequence = len(self._read_jsonl(path)) + 1
            item = {
                "eventId": f"event_{uuid.uuid4().hex[:20]}",
                "taskId": task_id,
                "batchId": batch_id,
                "stageRunId": self._stage_run_id(task_id, stage),
                "agentTaskId": detail_values.get("agentTaskId"),
                "modelCallId": detail_values.get("modelCallId"),
                "retryOf": detail_values.get("retryOf"),
                "resourceId": detail_values.get("resourceId"),
                "chunkId": detail_values.get("chunkId"),
                "uncertainItemId": detail_values.get("uncertainItemId"),
                "sequence": sequence,
                "timestamp": utcnow().isoformat(),
                "level": level,
                "stage": stage,
                "event": event,
                "message": message,
                "current": current,
                "total": total,
                "details": detail_values,
            }
            with path.open("a", encoding="utf-8") as stream:
                stream.write(json.dumps(item, ensure_ascii=False) + "\n")
        self.tasks.events.publish_event(task_id, "training.log", item)
        return item

    @staticmethod
    def _read_jsonl(path: Path) -> list[dict[str, Any]]:
        if not path.exists():
            return []
        items = []
        for line in path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            try:
                items.append(json.loads(line))
            except json.JSONDecodeError:
                continue
        return items

    @staticmethod
    def _read_json(path: Path, default: Any = None) -> Any:
        if not path.exists():
            return default
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return default

    def _read_review_items(self, task_id: str) -> list[dict[str, Any]]:
        path = self._run_dir(task_id) / "review-items.json"
        if not path.exists():
            return []
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []

    def _write_review_items(self, task_id: str, items: list[dict[str, Any]]) -> None:
        path = self._run_dir(task_id) / "review-items.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")

    @staticmethod
    def _review_item(
        task_id: str,
        stage: str,
        code: str,
        message: str,
        *,
        resource_id: str | None = None,
        chunk_id: str | None = None,
        confidence: float | None = None,
        source_path: str | None = None,
        evidence: Any = None,
        details: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return {
            "id": stable_id("review", task_id, stage, code, resource_id or "", chunk_id or "", message),
            "stage": stage,
            "code": code,
            "message": message,
            "resourceId": resource_id,
            "chunkId": chunk_id,
            "confidence": confidence,
            "sourcePath": source_path,
            "evidence": evidence,
            "details": details or {},
            "state": "pending",
            "note": "",
            "createdAt": utcnow().isoformat(),
        }

    def _run(self, task_id: str, request: TrainingTaskCreate) -> None:
        run_dir = self._run_dir(task_id)
        calls = {"succeeded": 0, "failed": 0, "skipped": 0}
        issues: list[dict[str, Any]] = []
        try:
            for relative in (
                "metadata",
                "rule-results",
                "extraction-results",
                "uncertain-items",
                "model-results",
                "final-results",
                "graph",
                "quality",
            ):
                (run_dir / relative).mkdir(parents=True, exist_ok=True)
            preflight = self._latest_preflight(request.batch_id)
            (run_dir / "run-manifest.json").write_text(
                json.dumps({
                    "taskId": task_id,
                    "batchId": request.batch_id,
                    "pipelineVersion": "2.0",
                    "knowledgeBuildMode": request.mode,
                    "sourceDatasetId": request.source_dataset_id,
                    "keywordIds": request.keyword_ids,
                    "stageRuns": {
                        **{stage: self._stage_run_id(task_id, stage) for stage in STAGES},
                        "metadata_construction": stable_id("stage-run", task_id, "metadata_construction"),
                    },
                    "config": request.config.model_dump(mode="json", by_alias=True),
                    "configSource": "service_default",
                    "preflight": preflight,
                    "createdAt": utcnow().isoformat(),
                }, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )

            self.tasks._update(task_id, state="running", can_cancel=True)
            self._log(task_id, "info", "queued", "task.started", "知识加工任务开始执行")
            dataset, chunks, documents = self._prepare_materials(task_id, request, run_dir)
            if request.mode == "keyword_analysis":
                _, human_required, _ = self._extract_keyword_analysis(
                    task_id,
                    chunks,
                    documents,
                    run_dir,
                    calls,
                    low_confidence_threshold=request.config.low_confidence_threshold,
                )
                issues.extend(human_required)
                self._generate_keyword_dataset(task_id, request, dataset, chunks, run_dir, calls, issues)
            else:
                keyword_context_by_chunk = self._formal_keyword_context_by_chunk(request.source_dataset_id, request.keyword_ids)
                if request.source_dataset_id and not keyword_context_by_chunk:
                    raise ValueError("没有可用于正式知识构建的已确认关键词文档块")
                if keyword_context_by_chunk:
                    allowed_chunk_ids = set(keyword_context_by_chunk)
                    chunks = [chunk for chunk in chunks if str(chunk.get("id") or chunk.get("chunkId")) in allowed_chunk_ids]
                    documents = [
                        document for document in documents
                        if any(str(chunk.get("resourceId")) == str(document.get("resourceId")) for chunk in chunks)
                    ]
                if request.source_dataset_id and not chunks:
                    raise ValueError("已确认关键词没有可用于正式知识构建的文档块")
                input_plan_nodes = self.graph(request.source_dataset_id, "nodes") if request.source_dataset_id else []
                self._write_json(
                    run_dir / "extraction-results/formal-knowledge-input.json",
                    self._formal_keyword_input_plan(request.source_dataset_id, input_plan_nodes, keyword_context_by_chunk),
                )
                rule_results, pending, human_required = self._extract_deterministic(
                    task_id,
                    chunks,
                    documents,
                    run_dir,
                    calls,
                    low_confidence_threshold=request.config.low_confidence_threshold,
                    keyword_context_by_chunk=keyword_context_by_chunk,
                )
                issues.extend(human_required)
                final_results = self._validate_and_merge(
                    task_id, chunks, rule_results, [], run_dir, issues
                )
                self._generate_dataset(
                    task_id, request, dataset, final_results, chunks, run_dir, calls, issues
                )
        except TrainingCancelledError:
            self._write_incomplete_fix_report(task_id, request, run_dir, issues, "cancelled")
            self._complete_cancellation(task_id, request.batch_id)
        except Exception as exc:
            if self.tasks.get(task_id).state == "cancelling":
                self._write_incomplete_fix_report(task_id, request, run_dir, issues, "cancelled")
                self._complete_cancellation(task_id, request.batch_id)
                return
            current_stage = self.tasks.get(task_id).stage or "failed"
            summary = error_summary(exc)
            if current_stage in STAGES:
                self._set_stage(task_id, current_stage, "failed", detail_message=summary)
            self.tasks._update(
                task_id,
                state="failed",
                stage="failed",
                message=summary,
                model_calls=dict(calls),
                can_cancel=False,
                can_retry=True,
                progress_detail={"stage": current_stage, "message": summary},
            )
            self._log(
                task_id,
                "error",
                current_stage,
                "task.failed",
                f"知识加工任务失败：{summary}",
                details={"technicalError": str(exc)},
            )
            self._write_incomplete_fix_report(task_id, request, run_dir, issues, "failed")
            self.batches.update(request.batch_id, state="failed", activeTaskIds=[])
        finally:
            self._mark_task_inactive(task_id)

    def _prepare_materials(self, task_id: str, request: TrainingTaskCreate, run_dir: Path):
        if self.preparation is not None and self.metadata_construction is not None:
            return self._prepare_materials_from_stage_outputs(task_id, request, run_dir)
        return self._prepare_materials_legacy(task_id, request, run_dir)

    def _prepare_materials_from_stage_outputs(self, task_id: str, request: TrainingTaskCreate, run_dir: Path):
        self._raise_if_cancelled(task_id)
        self._set_stage(
            task_id,
            "material_preparation",
            detail_message="正在执行正式资料预处理、C 代码清洗和元数据构建",
        )
        scan_report = self.preprocess.scan(request.batch_id)
        preparation_stage_run_id = self._stage_run_id(task_id, "material_preparation")
        metadata_stage_run_id = stable_id("stage-run", task_id, "metadata_construction")
        preparation_report = self.preparation.prepare(
            request.batch_id,
            request.config,
            parent_task_id=task_id,
            stage_run_id=preparation_stage_run_id,
        )
        self._raise_if_cancelled(task_id)
        metadata_report = self.metadata_construction.build(
            request.batch_id,
            parent_task_id=task_id,
            stage_run_id=metadata_stage_run_id,
        )

        preparation_root = (settings.data_root / preparation_report.manifest_path).resolve().parent
        metadata_root = (settings.data_root / metadata_report.stage_result_path).resolve().parent
        source_documents = self._read_jsonl(preparation_root / "metadata/source-documents.jsonl")
        source_resources = self._read_jsonl(preparation_root / "metadata/source-resources.jsonl")
        source_assets = self._read_jsonl(preparation_root / "metadata/source-assets.jsonl")
        ingestion_report = self._read_json(preparation_root / "metadata/ingestion-report.json", {})
        prepared_chunks = self._read_jsonl(preparation_root / "metadata/chunks.jsonl")
        structure_blocks = self._read_jsonl(preparation_root / "metadata/structure-blocks.jsonl")
        documents = self._read_jsonl(metadata_root / "metadata/documents.jsonl")
        chunk_contexts = self._read_jsonl(metadata_root / "metadata/chunk-contexts.jsonl")
        preselection_report = self._read_json(metadata_root / "metadata/preselection-report.json", {})
        embedding_index = self._read_jsonl(metadata_root / "metadata/embedding-index.jsonl") if (metadata_root / "metadata/embedding-index.jsonl").is_file() else []
        cluster_report = self._read_json(metadata_root / "metadata/cluster-report.json", {})
        for records, stage_run_id in (
            (source_documents, preparation_stage_run_id),
            (prepared_chunks, preparation_stage_run_id),
            (structure_blocks, preparation_stage_run_id),
            (documents, metadata_stage_run_id),
            (chunk_contexts, metadata_stage_run_id),
        ):
            for record in records:
                record["taskId"] = task_id
                record["stageRunId"] = stage_run_id
        preparation_issues = json.loads(
            (preparation_root / "quality/preparation-issues.json").read_text(encoding="utf-8")
        )
        metadata_issues = json.loads(
            (metadata_root / "quality/metadata-issues.json").read_text(encoding="utf-8")
        )
        embedding_issues = self._read_json(metadata_root / "quality/embedding-issues.json", [])
        cluster_issues = self._read_json(metadata_root / "quality/cluster-issues.json", [])
        if not prepared_chunks or not documents:
            raise RuntimeError("资料预处理后没有可进入知识提取的处理单元")

        run_manifest_path = run_dir / "run-manifest.json"
        run_manifest = json.loads(run_manifest_path.read_text(encoding="utf-8"))
        formal_units = [{
            "chunkId": str(item["chunkId"]),
            "resourceId": str(item["resourceId"]),
            "contentHash": str(item.get("contentHash") or "").removeprefix("sha256:"),
        } for item in prepared_chunks]
        formal_input_hash = self._processing_unit_input_hash(
            request.config.model_dump(mode="json", by_alias=True), formal_units
        )
        preflight = run_manifest.get("preflight") if isinstance(run_manifest.get("preflight"), dict) else None
        preflight_matches = bool(preflight and preflight.get("inputHash") == formal_input_hash)
        run_manifest["preflightComparison"] = {
            "preflightId": preflight.get("preflightId") if preflight else None,
            "preflightProcessingUnitCount": preflight.get("estimatedChunkCount") if preflight else None,
            "formalProcessingUnitCount": len(prepared_chunks),
            "preflightInputHash": preflight.get("inputHash") if preflight else None,
            "formalInputHash": formal_input_hash,
            "matches": preflight_matches,
        }
        if preflight and not preflight_matches:
            preparation_issues.append(self._quality_issue(
                "PREFLIGHT_FORMAL_MISMATCH",
                None,
                None,
                "预检与正式资料预处理的处理单元哈希不一致",
                details={
                    "taskId": task_id,
                    "stageRunId": preparation_stage_run_id,
                    **run_manifest["preflightComparison"],
                },
            ))
        run_manifest["lineage"] = {
            "preparationRunId": preparation_report.run_id,
            "metadataRunId": metadata_report.run_id,
            "preparationManifestPath": preparation_report.manifest_path,
            "metadataStageResultPath": metadata_report.stage_result_path,
        }
        self._write_json(run_manifest_path, run_manifest)

        chunks = []
        grouped: dict[str, list[dict[str, Any]]] = {}
        for prepared in prepared_chunks:
            content = str(prepared.get("content") or "")
            chunk = {
                **prepared,
                "id": prepared["chunkId"],
                "documentOffsets": prepared.get("normalizedOffsets", {"start": 0, "end": len(content)}),
                "contentLength": len(content),
                "contentHash": str(prepared.get("contentHash") or "").removeprefix("sha256:")
                or hashlib.sha256(content.encode("utf-8")).hexdigest(),
            }
            chunks.append(chunk)
            grouped.setdefault(chunk["resourceId"], []).append(chunk)

        source_lookup = {item["resourceId"]: item for item in source_documents}
        for document in documents:
            document_chunks = grouped.get(document["resourceId"], [])
            content = "\n\n".join(item["content"] for item in document_chunks)
            document["contentLength"] = len(content)
            document["contentHash"] = hashlib.sha256(content.encode("utf-8")).hexdigest()
            source = source_lookup.get(document["resourceId"], {})
            document["originalArtifact"] = source.get("originalArtifact")
            document["normalizedArtifact"] = source.get("normalizedArtifact")
            document["excludedRanges"] = source.get("excludedRanges", [])

        self._write_jsonl(run_dir / "metadata/source-documents.jsonl", source_documents)
        self._write_jsonl(run_dir / "metadata/source-resources.jsonl", source_resources)
        self._write_jsonl(run_dir / "metadata/source-assets.jsonl", source_assets)
        if ingestion_report:
            self._write_json(run_dir / "metadata/ingestion-report.json", ingestion_report)
        self._write_jsonl(run_dir / "metadata/documents.jsonl", documents)
        self._write_jsonl(run_dir / "metadata/chunks.jsonl", prepared_chunks)
        self._write_jsonl(run_dir / "metadata/structure-blocks.jsonl", structure_blocks)
        self._write_jsonl(run_dir / "metadata/chunk-contexts.jsonl", chunk_contexts)
        if preselection_report:
            self._write_json(run_dir / "metadata/preselection-report.json", preselection_report)
        self._write_jsonl(run_dir / "metadata/embedding-index.jsonl", embedding_index)
        if cluster_report:
            self._write_json(run_dir / "metadata/cluster-report.json", cluster_report)
        self._copy_embedding_cache(metadata_root, run_dir)
        (run_dir / "quality/preparation-issues.json").write_text(
            json.dumps(preparation_issues, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        (run_dir / "quality/metadata-issues.json").write_text(
            json.dumps(metadata_issues, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        self._write_json(run_dir / "quality/embedding-issues.json", embedding_issues)
        self._write_json(run_dir / "quality/cluster-issues.json", cluster_issues)

        dataset = DatasetVersion(
            id=f"dataset_{uuid.uuid4().hex[:16]}",
            batch_id=request.batch_id,
            preprocess_task_id=preparation_report.run_id,
            state="candidate",
            config=request.config,
            total_documents=len(documents),
            total_chunks=len(chunks),
            quality_metrics={
                "sourceTraceabilityRate": 1 if source_documents else 0,
                "parseSuccessRate": round(len(documents) / max(1, preparation_report.processable_resources), 4),
                "preparationIssueCount": len(preparation_issues),
                "metadataIssueCount": len(metadata_issues),
                "excludedCCodeBlocks": sum(len(item.get("excludedRanges", [])) for item in source_documents),
                "unsupportedFiles": scan_report.unsupported_files,
            },
            quality_passed=bool(documents and chunks and not any(item.get("severity") == "error" for item in preparation_issues)),
            created_at=utcnow(),
        )
        self.store.put_record("datasets", dataset.id, dataset.model_dump(mode="json", by_alias=True))
        self._set_stage(
            task_id,
            "material_preparation",
            "completed",
            current=len(chunks),
            total=len(chunks),
            unit="个处理单元",
            detail_message=(
                f"资料预处理与元数据构建完成：{len(documents)} 篇文档、{len(chunks)} 个处理单元、"
                f"排除 {dataset.quality_metrics['excludedCCodeBlocks']} 个 C/C++ 代码块"
            ),
        )
        return dataset, chunks, documents

    def _prepare_materials_legacy(self, task_id: str, request: TrainingTaskCreate, run_dir: Path):
        self._raise_if_cancelled(task_id)
        self._set_stage(task_id, "material_preparation", detail_message="正在扫描、清洗并生成结构化处理单元")
        scan_report = self.preprocess.scan(request.batch_id)
        preprocess_task = self.preprocess.start(PreprocessTaskCreate(
            batch_id=request.batch_id,
            config=request.config,
        ))
        with self._child_task_lock:
            self._child_tasks[task_id] = preprocess_task.id
        try:
            while True:
                self._raise_if_cancelled(task_id)
                current = self.tasks.get(preprocess_task.id)
                if current.state in TERMINAL_STATES:
                    break
                time.sleep(0.1)
        finally:
            with self._child_task_lock:
                self._child_tasks.pop(task_id, None)
        if current.state != "completed":
            raise RuntimeError(current.message or "资料预处理失败")
        dataset = next(
            item for item in self.preprocess.list_datasets(request.batch_id)
            if item.preprocess_task_id == preprocess_task.id
        )
        chunks_path = settings.data_root / "datasets" / dataset.id / "chunks.json"
        chunks = json.loads(chunks_path.read_text(encoding="utf-8"))
        grouped: dict[str, list[dict[str, Any]]] = {}
        for chunk in chunks:
            content = str(chunk.get("content") or "")
            chunk["contentLength"] = len(content)
            chunk["contentHash"] = hashlib.sha256(content.encode("utf-8")).hexdigest()
            grouped.setdefault(chunk["resourceId"], []).append(chunk)
        documents = []
        for resource_id, document_chunks in grouped.items():
            document_chunks.sort(key=lambda item: int(item.get("chunkIndex", 0)))
            content = "\n\n".join(item["content"] for item in document_chunks)
            documents.append({
                "resourceId": resource_id,
                "sourcePath": document_chunks[0]["sourcePath"],
                "title": Path(document_chunks[0]["sourcePath"]).name,
                "chunkCount": len(document_chunks),
                "contentLength": len(content),
                "contentHash": hashlib.sha256(content.encode("utf-8")).hexdigest(),
            })
        self._write_jsonl(run_dir / "metadata/documents.jsonl", documents)
        self._write_jsonl(run_dir / "metadata/chunks.jsonl", chunks)
        self._set_stage(
            task_id,
            "material_preparation",
            "completed",
            current=len(chunks),
            total=len(chunks),
            unit="个处理单元",
            detail_message=f"资料预处理完成：{len(documents)} 篇文档、{len(chunks)} 个处理单元、{len(scan_report.issues)} 个扫描问题",
        )
        return dataset, chunks, documents

    def _extract_keyword_analysis(
        self,
        task_id: str,
        chunks,
        documents,
        run_dir: Path,
        calls=None,
        low_confidence_threshold: float = 0.65,
    ):
        """
        纯确定性关键词提取，不依赖大模型。
        提取来源：标题、领域词典、正文模式匹配（错误码、函数名等）。
        """
        calls = calls if calls is not None else {"succeeded": 0, "failed": 0, "skipped": 0}
        self._raise_if_cancelled(task_id)
        self._set_stage(
            task_id,
            "deterministic_extraction",
            current=0,
            total=len(chunks),
            unit="个处理单元",
            message="正在执行确定性关键词抽取",
        )

        grouped: dict[str, list[dict[str, Any]]] = {}
        for chunk in chunks:
            grouped.setdefault(str(chunk.get("resourceId") or ""), []).append(chunk)

        document_lookup = {str(document.get("resourceId") or ""): document for document in documents}

        # 文档摘要生成（确定性）
        grouped_content: dict[str, list[str]] = {}
        for resource_id, resource_chunks in grouped.items():
            grouped_content[resource_id] = [str(chunk.get("content") or "") for chunk in resource_chunks]

        for document in documents:
            summary = self._rule_based_summary(
                document.get("title", ""),
                "\n\n".join(grouped_content.get(str(document.get("resourceId") or ""), [])),
            )
            document.update({
                "summary": document.get("summary") or summary["summary"],
                "category": document.get("category") or summary["category"],
                "keywords": document.get("keywords") or summary["keywords"],
            })
            document.update(self._document_profile(document, grouped_content.get(str(document.get("resourceId") or ""), [])))

        profiles = [{
            "resourceId": document["resourceId"],
            "documentType": document.get("documentType"),
            "extractionProfile": document.get("extractionProfile"),
            "summary": document.get("summary"),
            "category": document.get("category"),
            "semanticTitle": document.get("semanticTitle"),
            "ruleVersion": "keyword-analysis-v1",
            "inputHash": "sha256:" + str(document.get("contentHash") or ""),
        } for document in documents]
        self._write_jsonl(run_dir / "extraction-results/document-profiles.jsonl", profiles)

        # 纯确定性提取
        keyword_candidates: list[dict[str, Any]] = []
        human_required: list[dict[str, Any]] = []
        cache_summary = {
            "hits": 0,
            "misses": 0,
            "writes": 0,
            "deterministicSkippedChunks": 0,
            "modelScheduledChunks": 0,  # 保持为 0，不再使用模型
            "repairAttempts": 0,
            "repairSucceededChunks": 0,
            "repairFailedChunks": 0,
        }

        chunks_by_id = {str(chunk.get("id") or chunk.get("chunkId") or ""): chunk for chunk in chunks}
        known_keywords_by_resource: dict[str, list[str]] = {}
        deterministic_covered_resources: set[str] = set()
        preselection_by_resource = self._preselection_by_resource(run_dir)

        # 对所有资源执行确定性提取
        for resource_id, resource_chunks in grouped.items():
            document = document_lookup.get(resource_id, {})
            preselection = preselection_by_resource.get(resource_id)
            
            # 只有 skip 才真正跳过
            if preselection and preselection.get("preselectionState") == "skip":
                cache_summary["deterministicSkippedChunks"] += len(resource_chunks)
                known_keywords_by_resource[resource_id] = []
                continue
            
            # 执行确定性提取
            deterministic = self._deterministic_keyword_candidates(
                task_id,
                document,
                sorted(resource_chunks, key=lambda item: int(item.get("chunkIndex", 0))),
                low_confidence_threshold,
            )
            keyword_candidates.extend(deterministic)
            known_keywords_by_resource[resource_id] = self._merge_unique_values(
                [],
                [str(item.get("canonicalName") or "") for item in deterministic],
            )
            if deterministic:
                deterministic_covered_resources.add(resource_id)
            cache_summary["deterministicSkippedChunks"] += len(resource_chunks)

        # 写入结果
        self._write_jsonl(run_dir / "extraction-results/keyword-candidates.jsonl", keyword_candidates)
        self._write_jsonl(run_dir / "model-results/keyword-extraction-batches.jsonl", [])
        self._write_json(run_dir / "model-results/keyword-cache-summary.json", cache_summary)
        
        extraction_issues_path = run_dir / "quality/extraction-issues.json"
        extraction_issues_path.parent.mkdir(parents=True, exist_ok=True)
        self._write_json(extraction_issues_path, human_required)

        self._set_stage(
            task_id,
            "deterministic_extraction",
            current=len(chunks),
            total=len(chunks),
            unit="个处理单元",
            message=f"确定性关键词抽取完成：{len(keyword_candidates)} 个关键词候选，{len(human_required)} 个提示",
            model_calls=dict(calls),
        )
        return keyword_candidates, human_required, calls

    def _preselection_by_resource(self, run_dir: Path) -> dict[str, dict[str, Any]]:
        report = self._read_json(run_dir / "metadata/preselection-report.json", {})
        items = report.get("items") if isinstance(report, dict) else None
        if not isinstance(items, list):
            return {}
        result: dict[str, dict[str, Any]] = {}
        for item in items:
            if not isinstance(item, dict):
                continue
            resource_id = str(item.get("resourceId") or "")
            state = str(item.get("preselectionState") or "")
            if resource_id and state in {"deterministic_ready", "model_required", "human_review", "skip"}:
                result[resource_id] = item
        return result

    def _extract_deterministic(
        self,
        task_id: str,
        chunks,
        documents,
        run_dir: Path,
        calls=None,
        low_confidence_threshold: float = 0.65,
        keyword_context_by_chunk: dict[str, list[dict[str, Any]]] | None = None,
    ):
        """
        使用 Workflow Agent 执行知识提取
        
        最小 Workflow Agent：每个工作项只提取一个 chunk 的知识点候选。
        """
        calls = calls if calls is not None else {"succeeded": 0, "failed": 0, "skipped": 0}
        self._raise_if_cancelled(task_id)
        
        self._set_stage(
            task_id,
            "deterministic_extraction",
            current=0,
            total=len(chunks),
            unit="个处理单元",
            detail_message="正在使用 Workflow Agent 执行知识提取",
        )
        
        # 准备文档信息
        grouped_content: dict[str, list[str]] = {}
        for chunk in chunks:
            grouped_content.setdefault(chunk["resourceId"], []).append(chunk["content"])
        
        profiles = []
        for document in documents:
            summary = self._rule_based_summary(
                document["title"], "\n\n".join(grouped_content.get(document["resourceId"], []))
            )
            document.update({
                "summary": summary["summary"],
                "category": summary["category"],
                "keywords": summary["keywords"],
            })
            profile = self._document_profile(document, grouped_content.get(document["resourceId"], []))
            document.update(profile)
            profiles.append({
                "resourceId": document["resourceId"],
                **profile,
                "ruleVersion": "document-profile-v1",
                "inputHash": "sha256:" + document["contentHash"],
            })
        
        # 检查模型网关
        try:
            status = self.gateway.status()
            if not status.get("configured") or not status.get("capabilities", {}).get("chat"):
                raise ModelGatewayError("YashanDB 知识库文档生成器的对话模型尚未配置")
        except Exception as error:
            raise ModelGatewayError(f"知识提取 Agent 不可用：{error_summary(error)}") from error
        
        # 检查取消状态
        self._raise_if_cancelled(task_id)
        
        # 使用 Workflow Agent 执行知识提取
        self._log(
            task_id, "info", "deterministic_extraction", "workflow_agent.started",
            f"开始 Workflow Agent 知识提取：{len(chunks)} 个处理单元",
            details={"taskId": task_id, "chunkCount": len(chunks), "documentCount": len(documents)},
        )
        
        try:
            completed_agent_tasks: set[str] = set()
            progress_lock = threading.Lock()

            def formal_progress_callback(event: str, details: dict[str, Any]) -> None:
                skill_id = details.get("skillId") or "knowledge-point-extraction"
                if event == "model_call.started":
                    level = "info"
                    message = f"模型调用开始：{skill_id}"
                elif event == "model_call.completed":
                    level = "info"
                    message = f"模型调用完成：{skill_id}"
                elif event == "model_call.failed":
                    level = "error"
                    technical_error = details.get("technicalError") or ""
                    message = f"模型调用失败：{skill_id} - {error_summary(RuntimeError(str(technical_error)))}"
                elif event in {"agent_task.completed", "agent_task.failed"}:
                    level = "info" if event == "agent_task.completed" else "error"
                    agent_task_id = str(details.get("agentTaskId") or details.get("chunkId") or "")
                    with progress_lock:
                        if agent_task_id not in completed_agent_tasks:
                            completed_agent_tasks.add(agent_task_id)
                        completed_chunks = min(len(chunks), len(completed_agent_tasks))
                    message = (
                        f"正式知识处理单元完成：{completed_chunks}/{len(chunks)}"
                        if event == "agent_task.completed"
                        else f"正式知识处理单元失败，已记录质量问题并继续处理：{completed_chunks}/{len(chunks)}"
                    )
                    self._set_stage(
                        task_id,
                        "deterministic_extraction",
                        current=completed_chunks,
                        total=len(chunks),
                        unit="个处理单元",
                        detail_message=message,
                    )
                else:
                    level = "info"
                    message = f"知识提取进度：{event}"
                if details.get("resourceId") is not None and details.get("chunkId") is not None:
                    message = f"{message}（资源 {details['resourceId']} / 处理单元 {details['chunkId']}）"
                self._log(
                    task_id,
                    level,
                    "deterministic_extraction",
                    event,
                    message,
                    details=details,
                )

            # 创建 Agent 任务
            agent_task = AgentTask(
                task_id=task_id,
                input_data={
                    "chunks": chunks,
                    "documents": documents,
                    "task_id": task_id,
                    "stage_run_id": self._stage_run_id(task_id, "deterministic_extraction"),
                    "cancel_check": lambda: self._raise_if_cancelled(task_id),
                    "progress_callback": formal_progress_callback,
                    "keyword_context_by_chunk": keyword_context_by_chunk or {},
                },
            )
            
            # 执行 Agent
            agent_result = self.extraction_agent.execute(agent_task)
            
            # 提取结果
            aggregated = agent_result.output_data
            metadata = agent_result.metadata
            batch_audits = [
                self._formal_batch_audit(task_id, audit)
                for audit in aggregated.pop("_batchAudits", [])
            ]
            
            # 构建输出记录
            results = []
            candidates = []
            human_required = []

            for audit in batch_audits:
                if audit.get("success"):
                    continue
                issue_code = self._formal_failure_code(audit)
                technical_error = audit.get("technicalError") or audit.get("error")
                human_required.append(self._quality_issue(
                    issue_code,
                    audit.get("resourceId"),
                    audit.get("chunkId"),
                    f"知识点提取失败：{error_summary(RuntimeError(str(technical_error or '模型未返回有效知识点候选')))}",
                    details={
                        "severity": "error",
                        "taskId": audit.get("taskId"),
                        "stageRunId": audit.get("stageRunId"),
                        "agentTaskId": audit.get("agentTaskId"),
                        "chunkId": audit.get("chunkId"),
                        "modelCallId": audit.get("modelCallId"),
                        "technicalError": technical_error,
                        "durationMs": audit.get("durationMs"),
                    },
                ))
            
            # 只处理知识点候选；实体、关系、关键词和语义补充由后续独立阶段负责。
            for kp in aggregated.get("knowledgePoints", []):
                chunk_id = kp.get("chunkId", "")
                chunk = next((c for c in chunks if c.get("id") == chunk_id), None)
                if chunk:
                    candidates.append(self._model_knowledge_candidate(
                        task_id, "knowledge_point", kp, chunk,
                        keyword_context_by_chunk.get(chunk_id) if keyword_context_by_chunk else None,
                    ))
            pending = []
            
            # 构建结果记录
            results.append({
                "taskId": task_id,
                "stageRunId": self._stage_run_id(task_id, "deterministic_extraction"),
                "status": "agent_resolved",
                "result": aggregated,
                "metadata": metadata,
            })
            
            self._merge_model_calls(calls, metadata.get("model_calls"))
            
            self._log(
                task_id, "info", "deterministic_extraction", "workflow_agent.completed",
                f"Workflow Agent 知识点提取完成：{metadata.get('extraction_count', 0)} 个知识点",
                details={**metadata},
            )
            
        except Exception as error:
            self._log(
                task_id, "error", "deterministic_extraction", "workflow_agent.failed",
                f"Workflow Agent 知识提取失败：{error_summary(error)}",
                details={"technicalError": str(error)},
            )
            raise
        
        # 保存结果
        self._write_jsonl(run_dir / "extraction-results/knowledge-candidates.jsonl", candidates)
        self._write_jsonl(run_dir / "model-results/knowledge-extraction-batches.jsonl", batch_audits)
        
        extraction_issues_path = run_dir / "quality/extraction-issues.json"
        extraction_issues_path.parent.mkdir(parents=True, exist_ok=True)
        extraction_issues_path.write_text(
            json.dumps(human_required, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        
        self._set_stage(
            task_id,
            "deterministic_extraction",
            "completed",
            current=len(chunks),
            total=len(chunks),
            unit="个处理单元",
            detail_message=(
                f"Workflow Agent 知识点提取完成：{len(candidates)} 个知识候选，{len(human_required)} 个质量问题"
            ),
            model_calls=dict(calls),
        )
        
        return results, pending, human_required

    def _formal_batch_audit(self, task_id: str, audit: dict[str, Any]) -> dict[str, Any]:
        item = dict(audit or {})
        item.setdefault("taskId", task_id)
        item.setdefault("stageRunId", self._stage_run_id(task_id, "deterministic_extraction"))
        item.setdefault("agentTaskId", item.get("agent_task_id"))
        item.setdefault("chunkId", item.get("chunk_id"))
        item.setdefault("modelCallId", item.get("_modelCallId"))
        item.setdefault("technicalError", item.get("error"))
        item.setdefault("durationMs", 0)
        if not item.get("success"):
            item["errorCode"] = self._formal_failure_code(item)
        return item

    @staticmethod
    def _formal_failure_code(audit: dict[str, Any]) -> str:
        code = str(audit.get("errorCode") or "")
        if code in {
            "KNOWLEDGE_EXTRACTION_TIMEOUT",
            "KNOWLEDGE_EXTRACTION_SCHEMA_INVALID",
            "KNOWLEDGE_EXTRACTION_EMPTY_RESULT",
            "KNOWLEDGE_EXTRACTION_FAILED",
        }:
            return code
        technical_error = str(audit.get("technicalError") or audit.get("error") or "")
        lowered = technical_error.lower()
        if "timeout" in lowered or "超时" in technical_error:
            return "KNOWLEDGE_EXTRACTION_TIMEOUT"
        if "没有知识点候选" in technical_error or "empty" in lowered:
            return "KNOWLEDGE_EXTRACTION_EMPTY_RESULT"
        if "schema" in lowered or "校验失败" in technical_error or "validation" in lowered:
            return "KNOWLEDGE_EXTRACTION_SCHEMA_INVALID"
        return "KNOWLEDGE_EXTRACTION_FAILED"


    def _resolve_uncertain_items(self, task_id: str, pending, chunks, documents, run_dir: Path, calls, issues):
        pending = [item for item in pending if item.get("state") == "needs_enrichment"]
        semantic_issues: list[dict[str, Any]] = []
        semantic_issues_path = run_dir / "quality/semantic-issues.json"
        semantic_issues_path.parent.mkdir(parents=True, exist_ok=True)
        if not pending:
            calls["skipped"] += 1
            self._set_stage(
                task_id,
                "semantic_enrichment",
                "skipped",
                current=0,
                total=0,
                unit="个不确定项",
                detail_message="没有 needs_enrichment 项，按需语义补充已跳过",
                model_calls=dict(calls),
            )
            self._write_jsonl(run_dir / "uncertain-items/resolved.jsonl", [])
            self._write_jsonl(run_dir / "model-results/semantic-resolution.jsonl", [])
            semantic_issues_path.write_text("[]", encoding="utf-8")
            return []

        self._set_stage(
            task_id,
            "semantic_enrichment",
            current=0,
            total=len(pending),
            unit="个不确定项",
            detail_message=f"准备按需判断 {len(pending)} 个语义不确定项",
        )
        chunk_lookup = {item["id"]: item for item in chunks}
        document_lookup = {item["resourceId"]: item for item in documents}
        results = []
        resolved_items = []
        try:
            status = self.gateway.status()
            if not status.get("configured") or not status.get("capabilities", {}).get("chat"):
                raise ModelGatewayError("YashanDB 知识库文档生成器的对话模型尚未配置")
            self._log(
                task_id,
                "info",
                "semantic_enrichment",
                "model_gateway.ready",
                f"已继承文档生成器模型：{status.get('provider') or '未知提供商'} / {status.get('model') or '未知模型'}",
                details={"provider": status.get("provider"), "model": status.get("model")},
            )
        except Exception as error:
            summary = error_summary(error)
            resolved_items = []
            for item in pending:
                issue = self._quality_issue(
                    "SEMANTIC_ENRICHMENT_UNAVAILABLE",
                    item.get("resourceId"),
                    item.get("chunkId"),
                    f"语义不确定项未处理：{summary}",
                    source_path=item.get("sourcePath"),
                    evidence=item.get("evidenceText"),
                    details={"uncertainItemId": item["id"], "technicalError": str(error)},
                )
                issues.append(issue)
                semantic_issues.append(issue)
                resolved_items.append(self._resolved_uncertain_record(item, "human_required", summary, 0, error=str(error)))
            calls["failed"] += len(pending)
            self._write_jsonl(run_dir / "uncertain-items/resolved.jsonl", resolved_items)
            self._write_jsonl(run_dir / "model-results/semantic-resolution.jsonl", [])
            semantic_issues_path.write_text(json.dumps(semantic_issues, ensure_ascii=False, indent=2), encoding="utf-8")
            self._set_stage(
                task_id,
                "semantic_enrichment",
                "completed",
                current=len(pending),
                total=len(pending),
                unit="个不确定项",
                detail_message=f"语义补充未执行：{len(pending)} 项转为质量问题，原因：{summary}",
                model_calls=dict(calls),
            )
            return []

        def resolve_one(item):
            chunk = chunk_lookup[item["chunkId"]]
            envelope = self._semantic_context_envelope(task_id, item, chunk, chunks)
            started_at = time.monotonic()
            agent_task_id = f"agent_task_{uuid.uuid4().hex[:20]}"
            trace = {
                "taskId": task_id,
                "stage": "semantic_enrichment",
                "agentTaskId": agent_task_id,
                "resourceId": item["resourceId"],
                "chunkId": item["chunkId"],
                "uncertainItemId": item["id"],
            }
            try:
                self._log(
                    task_id, "info", "semantic_enrichment", "agent_task.started",
                    f"开始语义补充：{item['id']}",
                    details={**trace, "skillId": "semantic-enrichment"},
                )
                response = self._invoke_skill_cached("semantic-enrichment", envelope, trace=trace)
                model_call_id = response.get("_modelCallId")
                data = response["data"]
                if data.get("uncertainItemId") != item["id"]:
                    raise ModelGatewayError("模型返回的 uncertainItemId 与请求不一致")
                validation_issues = []
                validated = self._validated_model_resolution(
                    data, chunk, validation_issues, set(item.get("candidateValues", []))
                )
                if data["status"] == "resolved" and validation_issues:
                    raise ModelGatewayError(validation_issues[0]["message"])
                result = {
                    "taskId": task_id,
                    "stageRunId": self._stage_run_id(task_id, "semantic_enrichment"),
                    "agentTaskId": agent_task_id,
                    "modelCallId": model_call_id,
                    "uncertainItemId": item["id"],
                    "resourceId": item["resourceId"],
                    "chunkId": item["chunkId"],
                    "status": data["status"],
                    "reason": data["reason"],
                    "confidence": data["confidence"],
                    **validated,
                    "metadata": data["metadata"],
                    "usage": response.get("usage", {}),
                }
                terminal = "resolved" if data["status"] == "resolved" else "human_required"
                resolved = self._resolved_uncertain_record(
                    item, terminal, data["reason"], 1, resolution=data,
                    duration_ms=int((time.monotonic() - started_at) * 1000),
                )
                resolved.update({
                    "taskId": task_id,
                    "stageRunId": self._stage_run_id(task_id, "semantic_enrichment"),
                    "agentTaskId": agent_task_id,
                    "modelCallId": model_call_id,
                })
                issue = validation_issues[0] if validation_issues else None
                return item, result, resolved, issue, response.pop("_modelCalls", None), response.pop("_cacheHit", False), trace, model_call_id
            except Exception as error:
                summary = error_summary(error)
                model_call_id = getattr(error, "model_call_id", None)
                issue = self._quality_issue(
                    "SEMANTIC_ENRICHMENT_FAILED",
                    item["resourceId"],
                    item["chunkId"],
                    f"语义不确定项处理失败：{summary}",
                    source_path=item.get("sourcePath"),
                    evidence=item.get("evidenceText"),
                    details={**trace, "modelCallId": model_call_id, "technicalError": str(error)},
                )
                resolved = self._resolved_uncertain_record(
                    item, "human_required", summary, 1, error=str(error),
                    duration_ms=int((time.monotonic() - started_at) * 1000),
                )
                resolved.update({
                    "taskId": task_id,
                    "stageRunId": self._stage_run_id(task_id, "semantic_enrichment"),
                    "agentTaskId": agent_task_id,
                    "modelCallId": model_call_id,
                })
                return item, None, resolved, issue, getattr(error, "model_calls", None), False, trace, model_call_id

        max_workers = self._skill_concurrency("semantic-enrichment", 3)
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = [executor.submit(resolve_one, item) for item in pending]
            for index, future in enumerate(futures, 1):
                self._raise_if_cancelled(task_id)
                item, result, resolved, issue, model_calls, cache_hit, trace, model_call_id = future.result()
                resolved_items.append(resolved)
                if result is not None:
                    results.append(result)
                    if issue is not None:
                        issues.append(issue)
                        semantic_issues.append(issue)
                    if cache_hit:
                        calls["skipped"] += 1
                    else:
                        self._merge_model_calls(calls, model_calls, succeeded_default=1)
                    level, event = "info", "agent_task.completed"
                    message = f"语义补充完成：{item['id']}"
                else:
                    issues.append(issue)
                    semantic_issues.append(issue)
                    self._merge_model_calls(calls, model_calls, failed_default=1)
                    level, event = "error", "agent_task.failed"
                    message = f"语义补充失败：{item['id']} - {resolved['reason']}"
                self._update_stage_progress(
                    task_id, "semantic_enrichment", index, len(pending), "个不确定项", message,
                    level=level, event=event,
                    details={**trace, "modelCallId": model_call_id},
                    model_calls=dict(calls),
                )
        self._write_jsonl(run_dir / "uncertain-items/resolved.jsonl", resolved_items)
        self._write_jsonl(run_dir / "model-results/semantic-resolution.jsonl", results)
        semantic_issues_path.write_text(json.dumps(semantic_issues, ensure_ascii=False, indent=2), encoding="utf-8")
        self._set_stage(
            task_id,
            "semantic_enrichment",
            "completed",
            current=len(pending),
            total=len(pending),
            unit="个不确定项",
            detail_message=f"按需语义补充完成：成功 {len(results)}，失败 {len(pending) - len(results)}",
            model_calls=dict(calls),
        )
        return results

    def _validate_and_merge(self, task_id: str, chunks, rule_results, model_results, run_dir: Path, issues):  # model_results 参数保留但不再使用
        self._raise_if_cancelled(task_id)
        self._set_stage(task_id, "validation_graph", detail_message="正在校验并合并最终知识")
        candidates = self._read_jsonl(run_dir / "extraction-results/knowledge-candidates.jsonl")
        keyword_candidates = self._read_jsonl(run_dir / "extraction-results/keyword-candidates.jsonl")
        # 新工作流：不再读取 semantic_results，所有知识提取由 Workflow Agent 完成
        final_results, rejected, validation_issues = self._validate_knowledge_candidates(
            candidates, chunks
        )
        issues.extend(validation_issues)
        issues[:] = self._collect_quality_issues(run_dir, issues)
        if not final_results and chunks:
            has_model_keywords = bool(keyword_candidates)
            issues.append(self._quality_issue(
                "FINAL_KNOWLEDGE_EMPTY",
                None,
                None,
                (
                    "最终知识为空，当前使用已验证模型关键词生成降级图谱"
                    if has_model_keywords else "存在可处理文档但最终知识和有效模型关键词均为空"
                ),
                details={
                    "severity": "warning" if has_model_keywords else "error",
                    "degradedGraph": has_model_keywords,
                    "keywordCandidateCount": len(keyword_candidates),
                },
            ))
            issues[:] = self._deduplicate_quality_issues(issues)
        validation_stage_run_id = self._stage_run_id(task_id, "validation_graph")
        for item in final_results:
            item["sourceStageRunId"] = item.get("stageRunId")
            item["taskId"] = task_id
            item["stageRunId"] = validation_stage_run_id
        for item in rejected:
            item["sourceStageRunId"] = item.get("stageRunId")
            item["taskId"] = task_id
            item["stageRunId"] = validation_stage_run_id
        for item in issues:
            item.setdefault("taskId", task_id)
            item.setdefault("stageRunId", validation_stage_run_id)
        self._write_jsonl(run_dir / "final-results/knowledge.jsonl", final_results)
        self._write_jsonl(run_dir / "final-results/rejected.jsonl", rejected)
        self._write_json(run_dir / "quality/issues.json", issues)
        self._write_review_items(task_id, [self._issue_to_review(task_id, item) for item in issues])
        for item in rejected:
            self._log(
                task_id,
                "warning",
                "validation_graph",
                "knowledge.rejected",
                f"知识候选已拒绝：{item['reason']}",
                details={"candidateId": item.get("candidateId"), "code": item.get("code")},
            )
        self._set_stage(
            task_id,
            "validation_graph",
            "completed",
            current=len(final_results),
            total=len(candidates),
            unit="条知识候选",
            detail_message=f"知识校验与合并完成：通过 {len(final_results)} 条、拒绝 {len(rejected)} 条、质量问题 {len(issues)} 个",
        )
        return final_results

    def _semantic_candidates(self, results, chunks):
        chunk_lookup = {item["id"]: item for item in chunks}
        records = []
        for result in results:
            if result.get("status") != "resolved" or result.get("chunkId") not in chunk_lookup:
                continue
            chunk = chunk_lookup[result["chunkId"]]
            base_offset = int((chunk.get("documentOffsets") or {}).get("start", 0))
            metadata = result.get("metadata") if isinstance(result.get("metadata"), dict) else {}
            for collection, kind in (("knowledgePoints", "knowledge_point"), ("entities", "entity"), ("relations", "relation")):
                for item in result.get(collection, []):
                    if not isinstance(item, dict):
                        continue
                    evidence = self._evidence(item, "")
                    local_offsets = self._offsets(chunk["content"], evidence)
                    offsets = {
                        "start": base_offset + local_offsets["start"] if local_offsets["start"] >= 0 else -1,
                        "end": base_offset + local_offsets["end"] if local_offsets["end"] >= 0 else -1,
                    }
                    records.append({
                        "taskId": result.get("taskId"),
                        "stageRunId": result.get("stageRunId"),
                        "agentTaskId": result.get("agentTaskId"),
                        "modelCallId": result.get("modelCallId"),
                        "candidateId": stable_id(
                            "candidate", result.get("uncertainItemId", ""), kind,
                            json.dumps(item, ensure_ascii=False, sort_keys=True),
                        ),
                        "state": "model_resolved",
                        "kind": kind,
                        "resourceId": result["resourceId"],
                        "chunkId": result["chunkId"],
                        "sourcePath": chunk.get("sourcePath"),
                        "value": {key: value for key, value in item.items() if key not in {"evidenceText", "evidenceOffsets", "confidence"}},
                        "evidenceText": evidence,
                        "evidenceOffsets": offsets,
                        "sourceMethod": "model_resolved",
                        "agentId": metadata.get("agentId", "semantic-enrichment-agent"),
                        "skillId": metadata.get("skillId", "semantic-enrichment"),
                        "skillVersion": metadata.get("skillVersion", "1.0.1"),
                        "promptVersion": metadata.get("promptVersion", "semantic-enrichment:1.0.1"),
                        "schemaVersion": metadata.get("schemaVersion", "2.0.0"),
                        "inputHash": stable_id("input", result.get("uncertainItemId", ""), result["chunkId"]),
                        "confidence": item.get("confidence", result.get("confidence")),
                    })
        return records

    def _validate_knowledge_candidates(self, candidates, chunks):
        chunk_lookup = {item["id"]: item for item in chunks}
        accepted: list[dict[str, Any]] = []
        rejected: list[dict[str, Any]] = []
        issues: list[dict[str, Any]] = []
        exact_keys: dict[tuple[Any, ...], dict[str, Any]] = {}
        entity_types: dict[tuple[str, str], str] = {}

        def reject(candidate, code, reason, severity="error"):
            record = {
                "taskId": candidate.get("taskId"),
                "stageRunId": candidate.get("stageRunId"),
                "agentTaskId": candidate.get("agentTaskId"),
                "modelCallId": candidate.get("modelCallId"),
                "candidateId": candidate.get("candidateId"),
                "sourceMethod": candidate.get("sourceMethod"),
                "inputHash": candidate.get("inputHash"),
                "resourceId": candidate.get("resourceId"),
                "chunkId": candidate.get("chunkId"),
                "code": code,
                "severity": severity,
                "reason": reason,
                "auditRef": stable_id("audit", candidate.get("candidateId", ""), code),
            }
            rejected.append(record)
            issues.append(self._quality_issue(
                code,
                candidate.get("resourceId"),
                candidate.get("chunkId"),
                reason,
                source_path=candidate.get("sourcePath"),
                evidence=candidate.get("evidenceText"),
                details={
                    "candidateId": candidate.get("candidateId"),
                    "severity": severity,
                    "agentTaskId": candidate.get("agentTaskId"),
                    "modelCallId": candidate.get("modelCallId"),
                },
            ))

        non_relations = [item for item in candidates if item.get("kind") != "relation"]
        relations = [item for item in candidates if item.get("kind") == "relation"]
        for candidate in non_relations + relations:
            chunk = chunk_lookup.get(candidate.get("chunkId"))
            kind = candidate.get("kind")
            value = candidate.get("value")
            evidence = str(candidate.get("evidenceText") or "")
            offsets = candidate.get("evidenceOffsets")
            if kind not in {"knowledge_point", "entity", "relation"} or not isinstance(value, dict):
                reject(candidate, "KNOWLEDGE_SCHEMA_INVALID", "知识候选的类型或 value 结构无效")
                continue
            if chunk is None or candidate.get("resourceId") != chunk.get("resourceId"):
                reject(candidate, "KNOWLEDGE_SOURCE_INVALID", "知识候选无法关联有效处理单元")
                continue
            local_start = chunk["content"].find(evidence) if evidence else -1
            base_offset = int((chunk.get("documentOffsets") or {}).get("start", 0))
            expected_offsets = {
                "start": base_offset + local_start if local_start >= 0 else -1,
                "end": base_offset + local_start + len(evidence) if local_start >= 0 else -1,
            }
            if local_start < 0 or offsets != expected_offsets:
                reject(candidate, "KNOWLEDGE_EVIDENCE_INVALID", "知识候选的证据文本或偏移无法精确回查")
                continue
            if str(candidate.get("schemaVersion") or "") != "2.0.0":
                reject(candidate, "KNOWLEDGE_SCHEMA_VERSION_INVALID", "知识候选的 Schema 版本不受支持")
                continue
            normalized_value = json.loads(json.dumps(value, ensure_ascii=False))
            if kind == "knowledge_point":
                if not all(str(normalized_value.get(key) or "").strip() for key in ("title", "statement", "knowledgeType")):
                    reject(candidate, "KNOWLEDGE_POINT_INVALID", "知识点缺少标题、陈述或知识类型")
                    continue
                merge_key = (
                    kind, candidate["resourceId"], candidate["chunkId"],
                    str(normalized_value["statement"]).strip().casefold(), "2.0.0",
                )
            elif kind == "entity":
                name = str(normalized_value.get("name") or "").strip()
                entity_type = str(normalized_value.get("type") or "").strip()
                if not name or not entity_type:
                    reject(candidate, "KNOWLEDGE_ENTITY_INVALID", "实体缺少名称或类型")
                    continue
                if re.fullmatch(r"YAS-\d+", name, re.I):
                    entity_type = "YashanDBErrorCode"
                elif re.fullmatch(r"ORA-\d+", name, re.I):
                    entity_type = "OracleErrorCode"
                normalized_value["type"] = entity_type
                conflict_key = (candidate["resourceId"], name.casefold())
                previous_type = entity_types.get(conflict_key)
                if previous_type and previous_type != entity_type:
                    reject(candidate, "KNOWLEDGE_ENTITY_TYPE_CONFLICT", f"同一来源实体类型冲突：{name}")
                    continue
                entity_types[conflict_key] = entity_type
                merge_key = (kind, candidate["resourceId"], entity_type.casefold(), name.casefold(), "2.0.0")
            else:
                source = str(normalized_value.get("source") or "").strip()
                target = str(normalized_value.get("target") or "").strip()
                relation_type = str(normalized_value.get("type") or "").strip()
                if not source or not target or not relation_type:
                    reject(candidate, "KNOWLEDGE_RELATION_INVALID", "关系缺少源实体、目标实体或类型")
                    continue
                if (candidate["resourceId"], source.casefold()) not in entity_types or (candidate["resourceId"], target.casefold()) not in entity_types:
                    reject(candidate, "KNOWLEDGE_RELATION_ENDPOINT_INVALID", f"关系端点无法解析：{source} -> {target}")
                    continue
                merge_key = (
                    kind, candidate["resourceId"], source.casefold(), target.casefold(),
                    relation_type.casefold(), "2.0.0",
                )
            if merge_key in exact_keys:
                continue
            final = {
                "taskId": candidate.get("taskId"),
                "stageRunId": candidate.get("stageRunId"),
                "agentTaskId": candidate.get("agentTaskId"),
                "modelCallId": candidate.get("modelCallId"),
                "knowledgeId": stable_id("knowledge", *(str(value) for value in merge_key)),
                "kind": kind,
                "sourceResourceId": candidate["resourceId"],
                "chunkId": candidate["chunkId"],
                "sourcePath": candidate.get("sourcePath") or chunk.get("sourcePath"),
                "value": normalized_value,
                "evidenceText": evidence,
                "evidenceOffsets": expected_offsets,
                "sourceLocations": chunk.get("sourceLocations", []),
                "confidence": candidate.get("confidence"),
                "keywordIds": candidate.get("keywordIds") or [],
                "keywordContext": candidate.get("keywordContext") or [],
                "sourceMethod": candidate.get("sourceMethod", "knowledge_extraction_agent"),
                "schemaVersion": "2.0.0",
                "validationState": "passed",
            }
            exact_keys[merge_key] = final
            accepted.append(final)
        return accepted, rejected, issues

    def _collect_quality_issues(self, run_dir: Path, issues):
        combined = list(issues)
        for path in sorted((run_dir / "quality").glob("*.json")):
            if path.name == "issues.json":
                continue
            try:
                value = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue
            if isinstance(value, list):
                combined.extend(item for item in value if isinstance(item, dict))
        return self._deduplicate_quality_issues(combined)

    @staticmethod
    def _deduplicate_quality_issues(issues):
        result = {}
        for item in issues:
            key = (
                item.get("resourceId"), item.get("chunkId"), item.get("code"),
                item.get("inputHash") or item.get("message"),
            )
            result.setdefault(key, item)
        return list(result.values())

    def _generate_dataset(self, task_id: str, request, dataset, final_results, chunks, run_dir: Path, calls, issues):
        self._raise_if_cancelled(task_id)
        self._set_stage(task_id, "dataset_generation", detail_message="正在生成图谱与三层数据集目录")
        final_results = self._read_jsonl(run_dir / "final-results/knowledge.jsonl")
        documents = self._read_jsonl(run_dir / "metadata/documents.jsonl")
        chunk_contexts = self._read_jsonl(run_dir / "metadata/chunk-contexts.jsonl")
        keyword_candidates = self._read_jsonl(run_dir / "extraction-results/keyword-candidates.jsonl")
        nodes, edges, graph_source = self._build_dataset_graph(
            chunks,
            final_results,
            issues,
            documents,
            chunk_contexts,
            keyword_candidates,
        )
        keyword_chunk_index = self._keyword_chunk_index(nodes)
        issues[:] = self._deduplicate_quality_issues(issues)
        self._write_json(run_dir / "graph/nodes.json", nodes)
        self._write_json(run_dir / "graph/edges.json", edges)
        self._write_json(run_dir / "graph/keyword-chunk-index.json", keyword_chunk_index)
        self._write_json(run_dir / "quality/issues.json", issues)
        summary = {
            **self._graph_summary(nodes, edges, issues, graph_source),
            "knowledgeBuildMode": request.mode,
            "graphSource": graph_source,
        }
        high_issues = [item for item in issues if self._is_high_severity(item)]
        quality_state = "blocked" if high_issues else "passed"
        degraded_keyword_graph = graph_source == "model_keyword"
        quality_labels = sorted({self._quality_label(item) for item in high_issues})
        if degraded_keyword_graph:
            quality_labels = self._merge_unique_values(quality_labels, ["final_knowledge_empty", "model_keyword_graph"])
        quality_notice = (
            "部分文档存在高严重度质量问题，当前数据集禁止发布。"
            if high_issues
            else (
                "最终知识为空，当前数据集使用已验证模型关键词降级图谱，可发布但需保留降级标识。"
                if degraded_keyword_graph
                else "数据集已通过自动质量门禁，可执行正式发布。"
            )
        )
        dataset_root = settings.data_root / "datasets" / dataset.id
        originals_root = dataset_root / "originals"
        normalized_root = dataset_root / "normalized"
        mappings_root = dataset_root / "mappings"
        for path in (originals_root, normalized_root, mappings_root, dataset_root / "graph"):
            path.mkdir(parents=True, exist_ok=True)
        source_documents = self._read_jsonl(run_dir / "metadata/source-documents.jsonl")
        for source in source_documents:
            resource_id = str(source.get("resourceId") or "resource")
            for field, target_root in (
                ("originalArtifact", originals_root),
                ("normalizedArtifact", normalized_root),
                ("sourceMapArtifact", mappings_root),
            ):
                relative = source.get(field)
                if not relative:
                    continue
                source_path = (settings.data_root / str(relative)).resolve()
                if settings.data_root.resolve() not in source_path.parents or not source_path.is_file():
                    continue
                suffix = source_path.suffix or ".bin"
                target = target_root / f"{resource_id}{suffix}"
                temporary = target.with_suffix(target.suffix + ".tmp")
                shutil.copy2(source_path, temporary)
                temporary.replace(target)
        processing_units = self._read_jsonl(run_dir / "metadata/chunks.jsonl")
        entities = [item for item in final_results if item.get("kind") == "entity"]
        relations = [item for item in final_results if item.get("kind") == "relation"]
        self._write_jsonl(dataset_root / "documents.jsonl", documents)
        self._write_jsonl(dataset_root / "processing-units.jsonl", processing_units)
        self._write_jsonl(dataset_root / "knowledge.jsonl", final_results)
        self._write_jsonl(dataset_root / "entities.jsonl", entities)
        self._write_jsonl(dataset_root / "relations.jsonl", relations)
        self._write_jsonl(dataset_root / "keyword-candidates.jsonl", keyword_candidates)
        self._write_json(dataset_root / "graph/nodes.json", nodes)
        self._write_json(dataset_root / "graph/edges.json", edges)
        self._write_json(dataset_root / "keyword-chunk-index.json", keyword_chunk_index)
        self._write_json(dataset_root / "quality-issues.json", issues)
        self.store.update_record("datasets", dataset.id, {
            "trainingTaskId": task_id,
            "graphAvailable": True,
            "graphSummary": summary,
            "qualityMetrics": {
                **dataset.quality_metrics,
                "knowledgeCount": len(final_results),
                "qualityIssueCount": len(issues),
                "highSeverityIssueCount": len(high_issues),
            },
            "qualityPassed": not high_issues,
            "qualityState": quality_state,
            "publishable": not high_issues,
            "qualityLabels": quality_labels,
            "qualityNotice": quality_notice,
            "datasetPath": f"datasets/{dataset.id}",
        })
        report = {
            "taskId": task_id,
            "datasetId": dataset.id,
            "batchId": request.batch_id,
            "state": "candidate",
            "pipelineVersion": "2.0",
            "knowledgeBuildMode": request.mode,
            "sourceDatasetId": request.source_dataset_id,
            "config": request.config.model_dump(mode="json", by_alias=True),
            "knowledgeCount": len(final_results),
            "entityCount": len(entities),
            "relationCount": len(relations),
            "modelCalls": calls,
            "graph": summary,
            "keywordChunkIndex": "keyword-chunk-index.json",
            "graphSource": graph_source,
            "qualityIssueCount": len(issues),
            "highSeverityIssueCount": len(high_issues),
            "qualityState": quality_state,
            "publishable": not high_issues,
            "artifacts": {
                "dataset": f"datasets/{dataset.id}",
                "knowledge": f"datasets/{dataset.id}/knowledge.jsonl",
                "graphNodes": f"datasets/{dataset.id}/graph/nodes.json",
                "graphEdges": f"datasets/{dataset.id}/graph/edges.json",
            },
            "completedAt": utcnow().isoformat(),
        }
        self._write_json(run_dir / "run-report.json", report)
        self._write_json(dataset_root / "run-report.json", report)
        manifest = {
            "datasetId": dataset.id,
            "taskId": task_id,
            "batchId": request.batch_id,
            "state": "candidate",
            "qualityState": quality_state,
            "publishable": not high_issues,
            "qualityLabels": quality_labels,
            "qualityNotice": quality_notice,
            "pipelineVersion": "2.0",
            "schemaVersion": "2.0.0",
            "knowledgeBuildMode": request.mode,
            "sourceDatasetId": request.source_dataset_id,
            "config": request.config.model_dump(mode="json", by_alias=True),
            "documentCount": len(documents),
            "processingUnitCount": len(processing_units),
            "knowledgeCount": len(final_results),
            "entityCount": len(entities),
            "relationCount": len(relations),
            "nodeCount": len(nodes),
            "edgeCount": len(edges),
            "graphSource": graph_source,
            "graphSchemaVersion": GRAPH_SCHEMA_VERSION,
            "metadataRuleSetHash": self._metadata_rule_set_hash(),
            "qualityIssueCount": len(issues),
            "sourceResourceIds": sorted({str(item.get("resourceId")) for item in source_documents}),
            "createdAt": utcnow().isoformat(),
        }
        self._write_json(dataset_root / "manifest.json", manifest)
        self._write_fix_report(
            task_id,
            request,
            run_dir,
            documents,
            processing_units,
            issues,
        )
        for node in nodes:
            self._log(task_id, "info", "dataset_generation", "graph.node_created", "图谱节点已生成", details={"nodeId": node["id"], "nodeType": node["type"]})
        for edge in edges:
            self._log(task_id, "info", "dataset_generation", "graph.edge_created", "图谱关系已生成", details={"edgeId": edge["id"], "edgeType": edge["type"]})
        self._log(task_id, "info", "dataset_generation", "dataset.candidate_created", "候选数据集已生成", details={"datasetId": dataset.id})
        if high_issues:
            self._log(task_id, "warning", "dataset_generation", "dataset.quality_blocked", quality_notice, details={"datasetId": dataset.id, "qualityLabels": quality_labels})
        self._set_stage(
            task_id,
            "dataset_generation",
            "completed",
            current=len(final_results),
            total=len(final_results),
            unit="个知识结果",
            detail_message=(
                f"候选数据集生成完成，质量状态：{quality_state}，未自动发布"
            ),
            graph_summary=summary,
        )
        self.tasks._update(
            task_id,
            state="completed",
            stage="completed",
            message=None,
            model_calls=dict(calls),
            graph_summary=summary,
            can_cancel=False,
            progress_detail={"stage": "completed", "message": "知识加工流水线执行完成"},
        )
        self._log(
            task_id,
            "info",
            "completed",
            "task.completed",
            f"知识加工完成：最终知识 {len(final_results)}，模型成功 {calls['succeeded']}，模型失败 {calls['failed']}，质量问题 {len(issues)}",
            details={"modelCalls": calls, "graphSummary": summary, "qualityIssueCount": len(issues)},
        )
        self.batches.update(request.batch_id, state="downloaded", activeTaskIds=[])

    def _generate_keyword_dataset(self, task_id: str, request, dataset, chunks, run_dir: Path, calls, issues):
        self._raise_if_cancelled(task_id)
        self._set_stage(task_id, "dataset_generation", detail_message="正在生成质量分析关键词图谱")
        documents = self._read_jsonl(run_dir / "metadata/documents.jsonl")
        chunk_contexts = self._read_jsonl(run_dir / "metadata/chunk-contexts.jsonl")
        keyword_candidates = self._read_jsonl(run_dir / "extraction-results/keyword-candidates.jsonl")
        nodes, edges, graph_source = self._build_dataset_graph(
            chunks,
            [],
            issues,
            documents,
            chunk_contexts,
            keyword_candidates,
        )
        keyword_chunk_index = self._keyword_chunk_index(nodes)
        issues[:] = self._deduplicate_quality_issues(self._collect_quality_issues(run_dir, issues))
        self._write_json(run_dir / "graph/nodes.json", nodes)
        self._write_json(run_dir / "graph/edges.json", edges)
        self._write_json(run_dir / "graph/keyword-chunk-index.json", keyword_chunk_index)
        self._write_json(run_dir / "quality/issues.json", issues)
        summary = {
            **self._graph_summary(nodes, edges, issues, graph_source),
            "knowledgeBuildMode": "keyword_analysis",
            "formalKnowledgeDatasetId": None,
            "graphSource": graph_source,
        }
        high_issues = [item for item in issues if self._is_high_severity(item)]
        quality_state = "blocked" if high_issues else "passed"
        quality_labels = sorted({self._quality_label(item) for item in high_issues})
        if graph_source in {"model_keyword", "metadata_keyword"}:
            quality_labels = self._merge_unique_values(quality_labels, ["keyword_analysis_graph"])
        quality_notice = (
            "关键词分析存在高严重度质量问题，当前数据集禁止发布。"
            if high_issues
            else "质量分析默认档已生成关键词图谱，可在确认关键词后构建正式知识。"
        )
        dataset_root = settings.data_root / "datasets" / dataset.id
        originals_root = dataset_root / "originals"
        normalized_root = dataset_root / "normalized"
        mappings_root = dataset_root / "mappings"
        for path in (originals_root, normalized_root, mappings_root, dataset_root / "graph"):
            path.mkdir(parents=True, exist_ok=True)
        source_documents = self._read_jsonl(run_dir / "metadata/source-documents.jsonl")
        for source in source_documents:
            resource_id = str(source.get("resourceId") or "resource")
            for field, target_root in (
                ("originalArtifact", originals_root),
                ("normalizedArtifact", normalized_root),
                ("sourceMapArtifact", mappings_root),
            ):
                relative = source.get(field)
                if not relative:
                    continue
                source_path = (settings.data_root / str(relative)).resolve()
                if settings.data_root.resolve() not in source_path.parents or not source_path.is_file():
                    continue
                suffix = source_path.suffix or ".bin"
                target = target_root / f"{resource_id}{suffix}"
                temporary = target.with_suffix(target.suffix + ".tmp")
                shutil.copy2(source_path, temporary)
                temporary.replace(target)
        processing_units = self._read_jsonl(run_dir / "metadata/chunks.jsonl")
        self._write_jsonl(dataset_root / "documents.jsonl", documents)
        self._write_jsonl(dataset_root / "processing-units.jsonl", processing_units)
        self._write_jsonl(dataset_root / "knowledge.jsonl", [])
        self._write_jsonl(dataset_root / "entities.jsonl", [])
        self._write_jsonl(dataset_root / "relations.jsonl", [])
        self._write_jsonl(dataset_root / "keyword-candidates.jsonl", keyword_candidates)
        self._write_json(dataset_root / "graph/nodes.json", nodes)
        self._write_json(dataset_root / "graph/edges.json", edges)
        self._write_json(dataset_root / "keyword-chunk-index.json", keyword_chunk_index)
        self._write_json(dataset_root / "quality-issues.json", issues)
        self.store.update_record("datasets", dataset.id, {
            "trainingTaskId": task_id,
            "graphAvailable": True,
            "graphSummary": summary,
            "qualityMetrics": {
                **dataset.quality_metrics,
                "knowledgeCount": 0,
                "keywordCount": summary.get("keywordCount", 0),
                "contextEdgeCount": summary.get("contextEdgeCount", 0),
                "pendingKeywordCount": (summary.get("keywordApprovalState") or {}).get("pending", 0),
                "rejectedKeywordCount": (summary.get("keywordApprovalState") or {}).get("rejected", 0),
                "qualityIssueCount": len(issues),
                "highSeverityIssueCount": len(high_issues),
            },
            "qualityPassed": not high_issues,
            "qualityState": quality_state,
            "publishable": not high_issues,
            "qualityLabels": quality_labels,
            "qualityNotice": quality_notice,
            "datasetPath": f"datasets/{dataset.id}",
        })
        report = {
            "taskId": task_id,
            "datasetId": dataset.id,
            "batchId": request.batch_id,
            "state": "candidate",
            "pipelineVersion": "2.0",
            "knowledgeBuildMode": "keyword_analysis",
            "config": request.config.model_dump(mode="json", by_alias=True),
            "knowledgeCount": 0,
            "keywordCount": summary.get("keywordCount", 0),
            "modelCalls": calls,
            "graph": summary,
            "keywordChunkIndex": "keyword-chunk-index.json",
            "graphSource": graph_source,
            "qualityIssueCount": len(issues),
            "highSeverityIssueCount": len(high_issues),
            "qualityState": quality_state,
            "publishable": not high_issues,
            "artifacts": {
                "dataset": f"datasets/{dataset.id}",
                "keywords": f"datasets/{dataset.id}/keyword-candidates.jsonl",
                "graphNodes": f"datasets/{dataset.id}/graph/nodes.json",
                "graphEdges": f"datasets/{dataset.id}/graph/edges.json",
            },
            "completedAt": utcnow().isoformat(),
        }
        self._write_json(run_dir / "run-report.json", report)
        self._write_json(dataset_root / "run-report.json", report)
        self._write_json(dataset_root / "manifest.json", {
            "datasetId": dataset.id,
            "taskId": task_id,
            "batchId": request.batch_id,
            "state": "candidate",
            "qualityState": quality_state,
            "publishable": not high_issues,
            "qualityLabels": quality_labels,
            "qualityNotice": quality_notice,
            "pipelineVersion": "2.0",
            "schemaVersion": "2.0.0",
            "knowledgeBuildMode": "keyword_analysis",
            "config": request.config.model_dump(mode="json", by_alias=True),
            "documentCount": len(documents),
            "processingUnitCount": len(processing_units),
            "knowledgeCount": 0,
            "entityCount": 0,
            "relationCount": 0,
            "nodeCount": len(nodes),
            "edgeCount": len(edges),
            "graphSource": graph_source,
            "graphSchemaVersion": GRAPH_SCHEMA_VERSION,
            "metadataRuleSetHash": self._metadata_rule_set_hash(),
            "keywordApprovalState": summary.get("keywordApprovalState", {}),
            "qualityIssueCount": len(issues),
            "sourceResourceIds": sorted({str(item.get("resourceId")) for item in source_documents}),
            "createdAt": utcnow().isoformat(),
        })
        self._write_fix_report(task_id, request, run_dir, documents, processing_units, issues)
        self._set_stage(
            task_id,
            "dataset_generation",
            "completed",
            current=summary.get("keywordCount", 0),
            total=summary.get("keywordCount", 0),
            unit="个关键词",
            detail_message=f"关键词图谱生成完成，质量状态：{quality_state}，等待人工确认关键词",
            graph_summary=summary,
        )
        self.tasks._update(
            task_id,
            state="completed",
            stage="completed",
            message=None,
            model_calls=dict(calls),
            graph_summary=summary,
            can_cancel=False,
            progress_detail={"stage": "completed", "message": "质量分析关键词默认档执行完成"},
        )
        self._log(
            task_id,
            "info",
            "completed",
            "task.completed",
            f"关键词分析完成：关键词 {summary.get('keywordCount', 0)}，模型成功 {calls['succeeded']}，模型失败 {calls['failed']}，质量问题 {len(issues)}",
            details={"modelCalls": calls, "graphSummary": summary, "qualityIssueCount": len(issues)},
        )
        self.batches.update(request.batch_id, state="downloaded", activeTaskIds=[])

    @staticmethod
    def _processing_unit_input_hash(config: dict[str, Any], units: list[dict[str, str]]) -> str:
        payload = {
            "config": config,
            "units": sorted(units, key=lambda item: (item["resourceId"], item["chunkId"])),
        }
        encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
        return "sha256:" + hashlib.sha256(encoded).hexdigest()

    @staticmethod
    def _latest_preflight(batch_id: str) -> dict[str, Any] | None:
        path = settings.data_root / "batches" / batch_id / "training-preflight" / "latest.json"
        if not path.is_file():
            return None
        try:
            value = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return None
        return value if isinstance(value, dict) else None

    def _write_incomplete_fix_report(self, task_id, request, run_dir, issues, run_state) -> None:
        try:
            documents = self._read_jsonl(run_dir / "metadata/documents.jsonl")
            processing_units = self._read_jsonl(run_dir / "metadata/chunks.jsonl")
            self._write_fix_report(
                task_id, request, run_dir, documents, processing_units, issues,
                run_state=run_state,
            )
        except (OSError, ValueError, json.JSONDecodeError):
            return

    def _write_fix_report(
        self, task_id, request, run_dir, documents, processing_units, issues,
        *, run_state="completed",
    ) -> None:
        manifest_path = run_dir / "run-manifest.json"
        manifest = (
            json.loads(manifest_path.read_text(encoding="utf-8"))
            if manifest_path.is_file() else {}
        )
        comparison = manifest.get("preflightComparison") or {}
        events = self._read_jsonl(run_dir / "events.jsonl")
        max_characters = max((len(str(item.get("content") or "")) for item in processing_units), default=0)
        schema_error = next((
            item for item in issues
            if "Additional properties are not allowed ('chunkId' was unexpected)" in str(item)
        ), None)
        semantic_reached = any(item.get("stage") == "semantic_enrichment" for item in events)
        event_trace_complete = bool(events) and all(
            item.get("eventId") and item.get("taskId") and item.get("stageRunId") for item in events
        )
        rows = [
            {
                "problem": "处理单元数量为 154",
                "symptom": "历史任务使用 1200/120 产生过多处理单元",
                "rootCause": "8001 曾运行旧代码和旧配置",
                "fix": "新任务统一使用结构优先、6000/0 配置",
                "verification": f"当前任务 {len(documents)} 篇文档生成 {len(processing_units)} 个处理单元，最大 {max_characters} 字符",
            },
            {
                "problem": "术语仍显示“分块”",
                "symptom": "页面和日志与设计语义不一致",
                "rootCause": "历史文案沿用 chunk 直译",
                "fix": "用户可见文案统一为“处理单元”",
                "verification": "当前六步骤任务日志和产物统计使用处理单元语义",
            },
            {
                "problem": "语义补充拒绝 chunkId",
                "symptom": "Schema 报 Additional properties are not allowed",
                "rootCause": "模型回显追踪字段后直接校验",
                "fix": "首次和纠正调用均先别名转换、白名单归一化，再校验 Schema",
                "verification": (
                    "仍出现 chunkId 结构错误" if schema_error is not None
                    else "未出现 chunkId 结构错误" if semantic_reached
                    else "本次运行未进入语义补充，已由自动化测试验证归一化逻辑"
                ),
            },
            {
                "problem": "任务难以定位",
                "symptom": "日志缺少阶段、Agent 和模型调用级标识",
                "rootCause": "旧事件契约只覆盖部分业务 ID",
                "fix": "增加 taskId/stageRunId/agentTaskId/modelCallId/eventId",
                "verification": f"已检查 {len(events)} 条事件，基础追踪字段" + ("完整" if event_trace_complete else "不完整"),
            },
            {
                "problem": "预检与正式数量可能不同",
                "symptom": "两处切分实现曾不一致",
                "rootCause": "预检使用旧字符窗口算法",
                "fix": "预览、预检和正式处理复用同一结构优先构建器",
                "verification": (
                    f"预检 {comparison.get('preflightProcessingUnitCount')} / 正式 {comparison.get('formalProcessingUnitCount')}，哈希一致"
                    if comparison.get("matches") else
                    f"预检 {comparison.get('preflightProcessingUnitCount')} / 正式 {comparison.get('formalProcessingUnitCount')}，哈希未匹配"
                ),
            },
            {
                "problem": "旧运行产物混淆验证",
                "symptom": "历史清单仍有旧配置字段",
                "rootCause": "新旧任务产物共存",
                "fix": "按 taskId 和 stageRunId 隔离当前验证",
                "verification": f"本报告仅对应 training-runs/{task_id}",
            },
        ]
        report = {
            "taskId": task_id,
            "batchId": request.batch_id,
            "preflightId": comparison.get("preflightId"),
            "config": request.config.model_dump(mode="json", by_alias=True),
            "documentCount": len(documents),
            "processingUnitCount": len(processing_units),
            "maxProcessingUnitCharacters": max_characters,
            "runState": run_state,
            "rows": rows,
            "createdAt": utcnow().isoformat(),
        }
        self._write_json(run_dir / "quality/fix-report.json", report)
        lines = [
            "# 知识加工问题修复报告",
            "",
            f"- 任务 ID：`{task_id}`",
            f"- 批次 ID：`{request.batch_id}`",
            f"- 预检 ID：`{comparison.get('preflightId') or '无'}`",
            f"- 运行状态：`{run_state}`",
            f"- 正式处理单元：{len(processing_units)}",
            "",
            "| 问题 | 现象 | 根因 | 修复措施 | 验证结果 |",
            "|---|---|---|---|---|",
        ]
        lines.extend(
            "| " + " | ".join(str(row[key]).replace("|", "\\|") for key in (
                "problem", "symptom", "rootCause", "fix", "verification"
            )) + " |"
            for row in rows
        )
        self._write_text(run_dir / "quality/fix-report.md", "\n".join(lines) + "\n")

    @staticmethod
    def _is_high_severity(issue: dict[str, Any]) -> bool:
        explicit_severity = issue.get("severity") or issue.get("details", {}).get("severity")
        if explicit_severity:
            return str(explicit_severity).casefold() in {"error", "high", "critical", "fatal"}
        code = str(issue.get("code") or "")
        return code in {
            "FINAL_KNOWLEDGE_EMPTY", "KNOWLEDGE_EXTRACTION_FAILED", "SEMANTIC_ENRICHMENT_FAILED",
            "SEMANTIC_ENRICHMENT_UNAVAILABLE", "KNOWLEDGE_SOURCE_INVALID",
            "KNOWLEDGE_EVIDENCE_INVALID", "KNOWLEDGE_RELATION_ENDPOINT_INVALID",
        }

    @staticmethod
    def _quality_label(issue: dict[str, Any]) -> str:
        code = str(issue.get("code") or "quality_issue").strip().casefold()
        return re.sub(r"[^a-z0-9]+", "_", code).strip("_") or "quality_issue"

    def _rule_extract_chunk(self, chunk: dict[str, Any], document: dict[str, Any]):
        content = str(chunk.get("content") or "")
        entities: list[dict[str, Any]] = []
        seen: set[tuple[str, str]] = set()

        def add_entity(name: str, entity_type: str, evidence: str | None = None) -> None:
            normalized = name.strip("`'\"，。；;：:（）()[]【】 ")
            key = (entity_type, normalized.lower())
            if not normalized or key in seen:
                return
            seen.add(key)
            entities.append({
                "name": normalized,
                "type": entity_type,
                "evidenceText": evidence or normalized,
                "confidence": 1.0,
                "source": "rule",
            })

        for value in re.findall(r"\bYAS-\d+\b", content, re.IGNORECASE):
            add_entity(value.upper(), "YashanDBErrorCode")
        for value in re.findall(r"\bORA-\d+\b", content, re.IGNORECASE):
            add_entity(value.upper(), "OracleErrorCode")
        for value in re.findall(r"(?<![\w.])v?\d+\.\d+(?:\.\d+)?(?:\.\d+)?(?![\w.])", content, re.IGNORECASE):
            add_entity(value, "Version")
        for match in re.finditer(r"(?:参数|配置项|选项)[`'\"：:\s]*([A-Za-z_][A-Za-z0-9_.-]{1,80})", content):
            add_entity(match.group(1), "Parameter", match.group(0))
        for match in re.finditer(
            r"\b(?:CREATE|ALTER|DROP)\s+(TABLE|VIEW|INDEX|SEQUENCE|USER|DATABASE|SCHEMA)\s+([A-Za-z_][A-Za-z0-9_$#.]*)",
            content,
            re.IGNORECASE,
        ):
            add_entity(match.group(2), f"SQL{match.group(1).title()}", match.group(0))

        sentences = [item.strip() for item in re.split(r"(?<=[。！？!?；;\n])", content) if item.strip()]
        knowledge_points = []
        for sentence in sentences:
            if any(entity["evidenceText"] in sentence or entity["name"] in sentence for entity in entities):
                knowledge_points.append({
                    "title": sentence[:80],
                    "statement": sentence[:500],
                    "evidenceText": sentence[:500],
                    "confidence": 1.0,
                    "source": "rule",
                })

        relations = []
        for sentence in sentences:
            mentioned = [entity for entity in entities if entity["name"] in sentence]
            if len(mentioned) < 2:
                continue
            relation_type = None
            if re.search(r"表示|等价于|即为|是", sentence):
                relation_type = "DESCRIBES"
            elif re.search(r"依赖|基于", sentence):
                relation_type = "DEPENDS_ON"
            elif re.search(r"适用于|支持", sentence):
                relation_type = "APPLIES_TO"
            elif re.search(r"导致|引起", sentence):
                relation_type = "CAUSES"
            if relation_type:
                relations.append({
                    "source": mentioned[0]["name"],
                    "target": mentioned[1]["name"],
                    "type": relation_type,
                    "evidenceText": sentence[:500],
                    "confidence": 1.0,
                    "sourceMethod": "rule",
                })

        result = {
            "knowledgePoints": knowledge_points,
            "entities": entities,
            "relations": relations,
        }
        uncertain = []
        ambiguous_sentences = [
            sentence for sentence in sentences
            if re.search(r"(?:^|[，。；;\s])(该|此|上述|其|它|本)(?:参数|配置|对象|错误|功能|步骤|命令|接口)?", sentence)
        ]
        for sentence in ambiguous_sentences:
            uncertain.append(self._uncertain_item(
                chunk,
                "ambiguous_reference",
                "原文包含可能依赖上下文的指代，需判断指代对象",
                sentence,
                {"entities": entities},
            ))
        conflict_names: dict[str, set[str]] = {}
        for entity in entities:
            conflict_names.setdefault(entity["name"].lower(), set()).add(entity["type"])
        for name, types in conflict_names.items():
            if len(types) > 1:
                uncertain.append(self._uncertain_item(
                    chunk,
                    "candidate_conflict",
                    f"同一名称存在多个候选类型：{', '.join(sorted(types))}",
                    name,
                    {"candidateTypes": sorted(types)},
                ))
        for sentence in sentences:
            mentioned = [entity for entity in entities if entity["name"] in sentence]
            if len(mentioned) >= 2 and re.search(r"影响|关联|配合|组合|前提|要求", sentence):
                uncertain.append(self._uncertain_item(
                    chunk,
                    "implicit_relation",
                    "原文暗示实体关系但没有可直接固定化的关系类型",
                    sentence,
                    {"entities": mentioned},
                ))
        return result, self._deduplicate_uncertain(uncertain)

    @staticmethod
    def _uncertain_item(chunk, item_type: str, reason: str, evidence: str, candidates: dict[str, Any]):
        return {
            "id": stable_id("uncertain", chunk["id"], item_type, evidence),
            "state": "needs_model",
            "type": item_type,
            "reason": reason,
            "resourceId": chunk["resourceId"],
            "chunkId": chunk["id"],
            "sourcePath": chunk.get("sourcePath"),
            "evidenceText": evidence[:800],
            "candidates": candidates,
        }

    @staticmethod
    def _deduplicate_uncertain(items):
        return list({item["id"]: item for item in items}.values())

    @staticmethod
    def _document_profile(document: dict[str, Any], contents: list[str]) -> dict[str, str]:
        haystack = f"{document.get('title', '')}\n{document.get('sourcePath', '')}\n{' '.join(contents[:3])}".casefold()
        rules = (
            ("test_design", "test-design", ("测试设计", "测试方案", "测试用例", "验收测试")),
            ("problem_analysis", "problem-analysis", ("问题分析", "故障分析", "根因分析", "问题排查", "故障处理")),
            ("principle_introduction", "principle-introduction", ("原理介绍", "工作原理", "实现原理", "架构原理", "机制说明")),
            ("feature_design", "feature-design", ("特性设计", "功能设计", "方案设计", "详细设计")),
        )
        for document_type, profile, indicators in rules:
            matched = next((indicator for indicator in indicators if indicator.casefold() in haystack), None)
            if matched:
                return {
                    "documentType": document_type,
                    "extractionProfile": profile,
                    "profileVersion": "1.0.0",
                    "matchedBy": f"indicator:{matched}",
                }
        return {
            "documentType": "general_technical",
            "extractionProfile": "general-technical",
            "profileVersion": "1.0.0",
            "matchedBy": "general_technical_fallback",
        }

    @staticmethod
    def _explicit_anchors(content: str) -> list[dict[str, str]]:
        anchors: list[dict[str, str]] = []
        seen: set[tuple[str, str]] = set()

        def add(value: str, candidate_type: str) -> None:
            key = (value.casefold(), candidate_type)
            if key not in seen:
                seen.add(key)
                anchors.append({"value": value, "candidateType": candidate_type})

        for value in re.findall(r"\bYAS-\d{5}\b", content, re.I):
            add(value.upper(), "YashanDBErrorCode")
        for value in re.findall(r"\bORA-\d{5}\b", content, re.I):
            add(value.upper(), "OracleErrorCode")
        for value in re.findall(r"(?<![\w.])v?\d+(?:\.\d+){1,3}(?![\w.])", content, re.I):
            add(value, "ProductVersion")
        for match in re.finditer(r"(?:参数|配置项|选项)[`'\"：:\s]*([A-Za-z_][A-Za-z0-9_.-]{1,80})", content):
            add(match.group(1), "Parameter")
        for match in re.finditer(
            r"\b(?:CREATE|ALTER|DROP)\s+(TABLE|VIEW|INDEX|SEQUENCE|USER|DATABASE|SCHEMA)\s+([A-Za-z_][A-Za-z0-9_$#.]*)",
            content,
            re.I,
        ):
            add(match.group(2), "SqlObject")
        return anchors[:50]

    def _extraction_context_envelope(self, task_id, chunk, chunks, document):
        content = str(chunk.get("content") or "")
        anchors = self._explicit_anchors(content)
        adjacent = self._adjacent_summaries(chunk, chunks)
        skill = self.prompts.skills.get("knowledge-extraction", "2.0.0")
        output_limits = skill.manifest.get("defaults", {}).get("outputLimits", {})
        profile = str(document["extractionProfile"])
        profile_prompt = skill.root / "prompts" / "profiles" / f"{profile}.md"
        if not profile_prompt.is_file():
            raise ModelGatewayError(f"知识提取 Profile 提示词不存在：{profile}")
        profile_guidance = profile_prompt.read_text(encoding="utf-8")
        domain_hits = [f"{item['candidateType']}:{item['value']}" for item in anchors]
        return {
            "taskId": task_id,
            "resourceId": chunk["resourceId"],
            "chunkId": chunk["id"],
            "documentType": document["documentType"],
            "extractionProfile": profile,
            "domain": "yashandb",
            "domainContextVersion": "yashandb-domain:1.0.0",
            "domainContextHits": domain_hits,
            "profileGuidance": profile_guidance[:4000],
            "domainContext": {
                "matchedAnchors": anchors,
                "constraints": [
                    "YAS 与 ORA 错误码分域",
                    "SQL 关键字不能无条件作为实体",
                    "关系端点必须是当前单元中有证据的实体",
                ],
            },
            "document": {
                "title": document.get("title"),
                "category": document.get("category", "未分类"),
                "summary": document.get("summary", ""),
                "keywords": document.get("keywords", []),
            },
            "currentChunk": {
                "headingPath": chunk.get("headingPath", []),
                "content": content,
                "normalizedOffsets": chunk.get("documentOffsets", {"start": 0, "end": len(content)}),
            },
            "adjacentChunkSummaries": adjacent,
            "explicitAnchors": anchors,
            "schemaVersion": "2.0.0",
            "constraints": {
                "evidenceRequired": True,
                "allowSchemaCandidate": True,
                "allowNeedsEnrichment": True,
                "outputLimits": output_limits,
            },
        }

    def _validated_extraction(self, data, chunk):
        content = str(chunk.get("content") or "")
        validated = {"knowledgePoints": [], "entities": [], "relations": []}
        rejected = []
        sql_keywords = {"select", "from", "where", "join", "table", "index", "view", "user", "schema"}
        for collection in ("knowledgePoints", "entities"):
            for item in data.get(collection, []):
                evidence = self._evidence(item, "") if isinstance(item, dict) else ""
                if not evidence or evidence not in content:
                    rejected.append(self._quality_issue(
                        "EXTRACTION_EVIDENCE_INVALID", chunk["resourceId"], chunk["id"],
                        "知识提取结果的证据不在当前处理单元中，已拒绝该候选",
                        source_path=chunk.get("sourcePath"), evidence=evidence,
                    ))
                    continue
                if collection == "entities":
                    name = str(item.get("name") or "")
                    if name.casefold() in sql_keywords:
                        rejected.append(self._quality_issue(
                            "SQL_KEYWORD_ENTITY_REJECTED", chunk["resourceId"], chunk["id"],
                            f"SQL 关键字不能无条件作为实体：{name}",
                            source_path=chunk.get("sourcePath"), evidence=evidence,
                        ))
                        continue
                    if re.fullmatch(r"YAS-\d+", name, re.I):
                        item = {**item, "type": "YashanDBErrorCode"}
                    elif re.fullmatch(r"ORA-\d+", name, re.I):
                        item = {**item, "type": "OracleErrorCode"}
                validated[collection].append({**item, "evidenceOffsets": self._offsets(content, evidence)})
        entity_names = {str(item.get("name")) for item in validated["entities"]}
        for item in data.get("relations", []):
            evidence = self._evidence(item, "") if isinstance(item, dict) else ""
            source = str(item.get("source") or "") if isinstance(item, dict) else ""
            target = str(item.get("target") or "") if isinstance(item, dict) else ""
            if not evidence or evidence not in content or source not in entity_names or target not in entity_names:
                rejected.append(self._quality_issue(
                    "EXTRACTION_RELATION_INVALID", chunk["resourceId"], chunk["id"],
                    f"关系证据或端点无法解析，已拒绝：{source} -> {target}",
                    source_path=chunk.get("sourcePath"), evidence=evidence,
                ))
                continue
            validated["relations"].append({**item, "evidenceOffsets": self._offsets(content, evidence)})
        return validated, rejected

    def _candidate_records(self, chunk, document, envelope, metadata, validated):
        records = []
        base_offset = int((chunk.get("documentOffsets") or {}).get("start", 0))
        input_hash = "sha256:" + hashlib.sha256(str(chunk.get("content") or "").encode("utf-8")).hexdigest()
        for collection, kind in (("knowledgePoints", "knowledge_point"), ("entities", "entity"), ("relations", "relation")):
            for item in validated[collection]:
                local_offsets = item.get("evidenceOffsets", {"start": -1, "end": -1})
                offsets = {
                    "start": base_offset + local_offsets["start"] if local_offsets["start"] >= 0 else -1,
                    "end": base_offset + local_offsets["end"] if local_offsets["end"] >= 0 else -1,
                }
                records.append({
                    "candidateId": stable_id("candidate", chunk["id"], kind, json.dumps(item, ensure_ascii=False, sort_keys=True)),
                    "state": "agent_resolved",
                    "kind": kind,
                    "resourceId": chunk["resourceId"],
                    "chunkId": chunk["id"],
                    "sourcePath": chunk.get("sourcePath"),
                    "documentType": document["documentType"],
                    "extractionProfile": document["extractionProfile"],
                    "domain": "yashandb",
                    "domainContextVersion": envelope["domainContextVersion"],
                    "value": {key: value for key, value in item.items() if key not in {"evidenceText", "evidenceOffsets", "confidence"}},
                    "evidenceText": item["evidenceText"],
                    "evidenceOffsets": offsets,
                    "sourceMethod": "knowledge_extraction_agent",
                    "agentId": metadata.get("agentId", "knowledge-extraction-agent"),
                    "skillId": "knowledge-extraction",
                    "skillVersion": metadata.get("skillVersion", "2.0.0"),
                    "promptVersion": metadata.get("promptVersion", "knowledge-extraction:2.0.0"),
                    "profileVersion": document["profileVersion"],
                    "schemaVersion": metadata.get("schemaVersion", "2.0.0"),
                    "inputHash": input_hash,
                    "confidence": item.get("confidence"),
                })
        return records

    @staticmethod
    def _agent_uncertain_item(chunk, uncertain, envelope):
        item_type = str(uncertain.get("type") or "human_required")
        state = str(uncertain.get("state") or "human_required")
        supported = {
            "ambiguous_reference", "entity_type_conflict", "relation_type_conflict",
            "cross_unit_dependency", "version_scope_unclear", "assertion_status_unclear",
        }
        if state == "needs_enrichment" and item_type not in supported:
            state = "human_required"
        evidence = str(uncertain.get("evidenceText") or "")[:800]
        return {
            "id": stable_id("uncertain", chunk["id"], item_type, evidence, str(uncertain.get("reason") or "")),
            "state": state,
            "type": item_type,
            "reason": str(uncertain.get("reason") or "语义问题无法自动解决"),
            "resourceId": chunk["resourceId"],
            "chunkId": chunk["id"],
            "sourcePath": chunk.get("sourcePath"),
            "evidenceText": evidence,
            "candidateValues": uncertain.get("candidateValues", []),
            "inputHash": "sha256:" + hashlib.sha256(json.dumps(envelope, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest(),
        }

    def _adjacent_summaries(self, chunk, chunks):
        siblings = sorted(
            [candidate for candidate in chunks if candidate["resourceId"] == chunk["resourceId"]],
            key=lambda candidate: int(candidate.get("chunkIndex", 0)),
        )
        position = next(index for index, candidate in enumerate(siblings) if candidate["id"] == chunk["id"])
        adjacent = []
        for candidate in siblings[max(0, position - 1):position] + siblings[position + 1:position + 2]:
            adjacent.append({
                "chunkId": candidate["id"],
                "summary": self._rule_based_summary("相邻处理单元", candidate["content"])["summary"][:240],
            })
        return adjacent

    def _semantic_context_envelope(self, task_id, item, chunk, chunks):
        return {
            "taskId": task_id,
            "uncertainItemId": item["id"],
            "resourceId": item["resourceId"],
            "chunkId": item["chunkId"],
            "question": {"type": item["type"], "reason": item["reason"]},
            "headingPath": chunk.get("headingPath", []),
            "currentEvidence": item["evidenceText"],
            "adjacentChunkSummaries": self._adjacent_summaries(chunk, chunks),
            "candidateValues": item.get("candidateValues", []),
            "schemaVersion": "2.0.0",
            "constraints": {
                "evidenceMustComeFromCurrentExcerpt": True,
                "allowHumanRequired": True,
            },
        }

    @staticmethod
    def _resolved_uncertain_record(item, state, reason, attempts, *, resolution=None, error=None, duration_ms=0):
        return {
            **item,
            "previousState": item.get("state"),
            "state": state,
            "reason": reason,
            "attempts": attempts,
            "durationMs": duration_ms,
            "resolution": resolution,
            "failureReason": error,
            "entersValidation": state == "resolved",
            "resolvedAt": utcnow().isoformat(),
        }

    def _skill_concurrency(self, skill_id: str, maximum: int) -> int:
        skill = self.prompts.skills.get(skill_id)
        configured = int(skill.manifest.get("defaults", {}).get("concurrency", 1))
        return max(1, min(maximum, configured))

    def _context_envelope(self, item, chunk, chunks, document):
        siblings = sorted(
            [candidate for candidate in chunks if candidate["resourceId"] == chunk["resourceId"]],
            key=lambda candidate: int(candidate.get("chunkIndex", 0)),
        )
        position = next(index for index, candidate in enumerate(siblings) if candidate["id"] == chunk["id"])
        adjacent = []
        for candidate in siblings[max(0, position - 1):position] + siblings[position + 1:position + 2]:
            adjacent.append({
                "chunkId": candidate["id"],
                "summary": self._rule_based_summary("相邻处理单元", candidate["content"])["summary"][:240],
            })
        return {
            "question": {"type": item["type"], "reason": item["reason"]},
            "document": {
                "resourceId": document["resourceId"],
                "sourcePath": document["sourcePath"],
                "title": document["title"],
                "summary": document.get("summary", ""),
                "category": document.get("category", "未分类"),
                "keywords": document.get("keywords", []),
            },
            "currentChunk": {
                "chunkId": chunk["id"],
                "headingPath": chunk.get("headingPath", []),
                "evidenceText": item["evidenceText"],
            },
            "adjacentChunkSummaries": adjacent,
            "ruleCandidates": item.get("candidates", {}),
            "constraints": {
                "evidenceMustComeFromCurrentExcerpt": True,
                "doNotInferUnrelatedKnowledge": True,
            },
        }

    def _validated_model_resolution(self, data, chunk, issues, endpoint_names=None):
        if data.get("status") != "resolved":
            issues.append(self._quality_issue(
                "MODEL_UNRESOLVED",
                chunk["resourceId"],
                chunk["id"],
                str(data.get("reason") or "模型未能可靠解决语义不确定项"),
                source_path=chunk.get("sourcePath"),
            ))
            return {"knowledgePoints": [], "entities": [], "relations": []}
        validated = {"knowledgePoints": [], "entities": [], "relations": []}
        for collection in ("knowledgePoints", "entities"):
            for item in data.get(collection, []):
                if not isinstance(item, dict):
                    continue
                evidence = self._evidence(item, "")
                if not evidence or evidence not in chunk["content"]:
                    issues.append(self._quality_issue(
                        "MODEL_EVIDENCE_INVALID",
                        chunk["resourceId"],
                        chunk["id"],
                        "模型结果的证据不在当前原文处理单元中，已阻止进入最终知识",
                        source_path=chunk.get("sourcePath"),
                        evidence=evidence,
                    ))
                    continue
                validated[collection].append({**item, "evidenceText": evidence, "source": "model"})
        entity_names = {str(item.get("name") or "") for item in validated["entities"]}
        entity_names.update(endpoint_names or set())
        for item in data.get("relations", []):
            if not isinstance(item, dict):
                continue
            evidence = self._evidence(item, "")
            source = str(item.get("source") or "")
            target = str(item.get("target") or "")
            if not evidence or evidence not in chunk["content"] or source not in entity_names or target not in entity_names:
                issues.append(self._quality_issue(
                    "MODEL_RELATION_INVALID",
                    chunk["resourceId"],
                    chunk["id"],
                    "模型关系的证据或端点无法在当前处理单元中解析，已阻止进入最终知识",
                    source_path=chunk.get("sourcePath"),
                    evidence=evidence,
                ))
                continue
            validated["relations"].append({**item, "evidenceText": evidence, "source": "model"})
        return validated

    @staticmethod
    def _quality_issue(code, resource_id, chunk_id, message, *, source_path=None, evidence=None, details=None):
        return {
            "id": stable_id("quality", code, resource_id or "", chunk_id or "", message),
            "state": "human_required",
            "code": code,
            "resourceId": resource_id,
            "chunkId": chunk_id,
            "sourcePath": source_path,
            "message": message,
            "evidence": evidence,
            "details": details or {},
            "createdAt": utcnow().isoformat(),
        }

    @staticmethod
    def _issue_to_review(task_id: str, issue: dict[str, Any]):
        return {
            "id": issue.get("id") or stable_id("quality", task_id, issue.get("code", "UNKNOWN")),
            "stage": "validation_graph",
            "code": issue.get("code", "QUALITY_ISSUE"),
            "message": issue.get("message", "存在需要人工复核的质量问题"),
            "resourceId": issue.get("resourceId"),
            "chunkId": issue.get("chunkId"),
            "sourcePath": issue.get("sourcePath"),
            "evidence": issue.get("evidence"),
            "details": issue.get("details", {}),
            "state": "human_required",
            "createdAt": issue.get("createdAt", utcnow().isoformat()),
        }

    def _run_legacy(self, task_id: str, request: TrainingTaskCreate) -> None:
        run_dir = self._run_dir(task_id)
        try:
            for relative in ("normalized", "model-results", "graph", "quality"):
                (run_dir / relative).mkdir(parents=True, exist_ok=True)
            (run_dir / "run-manifest.json").write_text(
                json.dumps({
                    "taskId": task_id,
                    "batchId": request.batch_id,
                    "config": request.config.model_dump(mode="json", by_alias=True),
                    "createdAt": utcnow().isoformat(),
                }, ensure_ascii=False, indent=2), encoding="utf-8"
            )

            self._raise_if_cancelled(task_id)
            self.tasks._update(task_id, state="running", can_cancel=True)
            self._log(task_id, "info", "queued", "task.started", "训练任务开始执行")
            self._raise_if_cancelled(task_id)
            self._set_stage(task_id, "source_scan", detail_message="正在检查批次资源清单")
            scan_report = self.preprocess.scan(request.batch_id)
            self._raise_if_cancelled(task_id)
            self._set_stage(
                task_id,
                "source_scan",
                "completed",
                current=scan_report.total_files,
                total=scan_report.total_files,
                unit="个文件",
                detail_message=f"扫描完成：{scan_report.total_files} 个文件，{len(scan_report.issues)} 个问题",
            )

            self._set_stage(task_id, "normalize", detail_message="正在统一文本编码和换行")
            self._set_stage(task_id, "normalize", "completed", detail_message="文本规范化完成")
            self._set_stage(task_id, "clean", detail_message="正在执行规则清洗")
            preprocess_task = self.preprocess.start(PreprocessTaskCreate(
                batch_id=request.batch_id,
                config=request.config,
            ))
            with self._child_task_lock:
                self._child_tasks[task_id] = preprocess_task.id
            try:
                while True:
                    self._raise_if_cancelled(task_id)
                    current = self.tasks.get(preprocess_task.id)
                    if current.state in TERMINAL_STATES:
                        break
                    time.sleep(0.1)
            finally:
                with self._child_task_lock:
                    self._child_tasks.pop(task_id, None)
            if current.state != "completed":
                raise RuntimeError(current.message or "规则预处理失败")
            self._raise_if_cancelled(task_id)
            dataset = next(
                item for item in self.preprocess.list_datasets(request.batch_id)
                if item.preprocess_task_id == preprocess_task.id
            )
            self._set_stage(
                task_id,
                "clean",
                "completed",
                current=dataset.total_documents,
                total=dataset.total_documents,
                unit="篇文档",
                detail_message=f"规则清洗完成：{dataset.total_documents} 篇文档",
            )
            self._set_stage(task_id, "semantic_chunk", detail_message="正在读取语义处理单元产物")
            chunks_path = settings.data_root / "datasets" / dataset.id / "chunks.json"
            chunks = json.loads(chunks_path.read_text(encoding="utf-8"))
            (run_dir / "chunks.jsonl").write_text(
                "".join(json.dumps(item, ensure_ascii=False) + "\n" for item in chunks),
                encoding="utf-8",
            )
            self._set_stage(
                task_id,
                "semantic_chunk",
                "completed",
                current=len(chunks),
                total=len(chunks),
                unit="个处理单元",
                detail_message=f"语义处理单元生成完成：{len(chunks)} 个处理单元",
            )

            status = self.gateway.status()
            self._raise_if_cancelled(task_id)
            if not status.get("configured") or not status.get("capabilities", {}).get("chat"):
                raise ModelGatewayError("agent-runner Chat 模型尚未配置")
            self._log(
                task_id,
                "info",
                "document_enrichment",
                "model_gateway.ready",
                f"模型网关可用：{status.get('provider') or '未知提供商'} / {status.get('model') or '未知模型'}",
                details={"provider": status.get("provider"), "model": status.get("model")},
            )
            grouped: dict[str, list[dict[str, Any]]] = {}
            for chunk in chunks:
                grouped.setdefault(chunk["resourceId"], []).append(chunk)
            calls = {"succeeded": 0, "failed": 0, "skipped": 0}
            issues: list[dict[str, Any]] = []
            review_items: list[dict[str, Any]] = []

            self._set_stage(
                task_id,
                "document_enrichment",
                current=0,
                total=len(grouped),
                unit="篇文档",
                detail_message=f"准备处理 {len(grouped)} 篇文档",
            )
            enrichments = []
            fallback_count = 0
            enrichment_prompt = self.prompts.get("document-enrichment.system")
            enrichment_skill = self.prompts.skills.get("document-enrichment", enrichment_prompt.skill_version)
            concurrency = max(1, int(enrichment_skill.manifest.get("defaults", {}).get("concurrency", 1)))
            self._log(
                task_id,
                "info",
                "document_enrichment",
                "stage.concurrency",
                f"文档摘要与分类使用 {concurrency} 路有界并行",
                details={"concurrency": concurrency},
            )
            executor = ThreadPoolExecutor(max_workers=concurrency, thread_name_prefix="document-enrichment")
            futures = {
                executor.submit(self._process_document_enrichment, task_id, resource_id, document_chunks): resource_id
                for resource_id, document_chunks in grouped.items()
            }
            pending = set(futures)
            index = 0
            try:
                while pending:
                    self._raise_if_cancelled(task_id)
                    completed_futures, pending = wait(pending, timeout=0.2, return_when=FIRST_COMPLETED)
                    for future in completed_futures:
                        self._raise_if_cancelled(task_id)
                        index += 1
                        processed = future.result()
                        enrichments.append(processed["enrichment"])
                        self._merge_model_calls(calls, processed.get("modelCalls"), succeeded_default=1)
                        if not processed["success"]:
                            fallback_count += 1
                            issues.append(self._issue("DOCUMENT_ENRICHMENT_FAILED", processed["resourceId"], None, processed["summary"]))
                            review_item = self._review_item(
                                task_id,
                                "document_enrichment",
                                "DOCUMENT_ENRICHMENT_FAILED",
                                f"文档摘要与分类已使用规则结果：{processed['summary']}",
                                resource_id=processed["resourceId"],
                                source_path=processed["sourcePath"],
                                evidence=processed["enrichment"]["result"].get("summary", ""),
                                details={"fallback": "规则摘要", "technicalError": processed["technicalError"]},
                            )
                            review_items.append(review_item)
                            self._write_review_items(task_id, review_items)
                            self._log(
                                task_id,
                                "warning",
                                "document_enrichment",
                                "review.created",
                                review_item["message"],
                                details={"reviewItemId": review_item["id"], "resourceId": processed["resourceId"]},
                            )
                        self._update_stage_progress(
                            task_id,
                            "document_enrichment",
                            index,
                            len(grouped),
                            "篇文档",
                            processed["message"],
                            level=processed["level"],
                            event=processed["event"],
                            details={
                                "resourceId": processed["resourceId"],
                                "sourcePath": processed["sourcePath"],
                                "durationMs": processed["durationMs"],
                                **({"technicalError": processed["technicalError"], "fallback": "规则摘要"} if not processed["success"] else {}),
                            },
                            model_calls=dict(calls),
                        )
            finally:
                cancelling = self.tasks.get(task_id).state in {"cancelling", "cancelled"}
                executor.shutdown(wait=not cancelling, cancel_futures=cancelling)
            self._raise_if_cancelled(task_id)
            self._write_jsonl(run_dir / "model-results/document-enrichment.jsonl", enrichments)
            self._set_stage(
                task_id,
                "document_enrichment",
                "completed",
                current=len(grouped),
                total=len(grouped),
                unit="篇文档",
                detail_message=f"文档增强完成：模型成功 {len(grouped) - fallback_count}，规则降级 {fallback_count}",
                model_calls=dict(calls),
            )

            self._set_stage(task_id, "image_caption", "skipped", detail_message="当前未启用图片说明能力，因此跳过此步骤")
            calls["skipped"] += 1
            self.tasks._update(task_id, model_calls=dict(calls))

            self._set_stage(
                task_id,
                "knowledge_extraction",
                current=0,
                total=len(chunks),
                unit="个处理单元",
                detail_message=f"准备处理 {len(chunks)} 个处理单元",
            )
            extractions = []
            low_confidence = []
            for index, chunk in enumerate(chunks, 1):
                self._raise_if_cancelled(task_id)
                technical_error = None
                try:
                    result = self._invoke_skill("knowledge-extraction", {
                        "source_path": chunk["sourcePath"],
                        "chunk_id": chunk["id"],
                        "content": chunk["content"],
                    })
                    data = result["data"]
                    item = {"resourceId": chunk["resourceId"], "chunkId": chunk["id"], "result": data, "usage": result.get("usage", {})}
                    extractions.append(item)
                    confidence = self._confidence(data)
                    if confidence < request.config.low_confidence_threshold:
                        low_confidence.append((chunk, data, confidence))
                        review_item = self._review_item(
                            task_id,
                            "knowledge_extraction",
                            "LOW_CONFIDENCE_EXTRACTION",
                            f"知识提取置信度 {confidence:.2f}，低于阈值 {request.config.low_confidence_threshold:.2f}",
                            resource_id=chunk["resourceId"],
                            chunk_id=chunk["id"],
                            confidence=confidence,
                            source_path=chunk["sourcePath"],
                            evidence=data,
                            details={"threshold": request.config.low_confidence_threshold},
                        )
                        review_items.append(review_item)
                        self._write_review_items(task_id, review_items)
                        self._log(
                            task_id,
                            "warning",
                            "knowledge_extraction",
                            "review.created",
                            review_item["message"],
                            details={"reviewItemId": review_item["id"], "resourceId": chunk["resourceId"], "chunkId": chunk["id"]},
                        )
                    self._merge_model_calls(calls, result.pop("_modelCalls", None), succeeded_default=1)
                    level = "warning" if confidence < request.config.low_confidence_threshold else "info"
                    event = "model_call.review_required" if level == "warning" else "model_call.completed"
                    message = f"知识提取完成：{Path(chunk['sourcePath']).name} / {chunk['id']}"
                except Exception as error:
                    technical_error = str(error)
                    self._merge_model_calls(calls, getattr(error, "model_calls", None), failed_default=1)
                    summary = error_summary(error)
                    issues.append(self._issue("KNOWLEDGE_EXTRACTION_FAILED", chunk["resourceId"], chunk["id"], summary))
                    review_item = self._review_item(
                        task_id,
                        "knowledge_extraction",
                        "KNOWLEDGE_EXTRACTION_FAILED",
                        f"该文本处理单元未生成知识结果：{summary}",
                        resource_id=chunk["resourceId"],
                        chunk_id=chunk["id"],
                        source_path=chunk["sourcePath"],
                        evidence=chunk["content"][:500],
                        details={"technicalError": technical_error},
                    )
                    review_items.append(review_item)
                    self._write_review_items(task_id, review_items)
                    self._log(
                        task_id,
                        "warning",
                        "knowledge_extraction",
                        "review.created",
                        review_item["message"],
                        details={"reviewItemId": review_item["id"], "resourceId": chunk["resourceId"], "chunkId": chunk["id"]},
                    )
                    level = "error"
                    event = "model_call.failed"
                    message = f"知识提取失败：{Path(chunk['sourcePath']).name} / {chunk['id']} - {summary}"
                self._update_stage_progress(
                    task_id,
                    "knowledge_extraction",
                    index,
                    len(chunks),
                    "个处理单元",
                    message,
                    level=level,
                    event=event,
                    details={
                        "resourceId": chunk["resourceId"],
                        "chunkId": chunk["id"],
                        "sourcePath": chunk["sourcePath"],
                        **({"technicalError": technical_error} if technical_error else {}),
                    },
                    model_calls=dict(calls),
                )
            self._write_jsonl(run_dir / "model-results/knowledge-extraction.jsonl", extractions)
            self._set_stage(
                task_id,
                "knowledge_extraction",
                "completed",
                current=len(chunks),
                total=len(chunks),
                unit="个处理单元",
                detail_message=f"知识提取完成：成功 {len(extractions)}，失败 {len(chunks) - len(extractions)}",
                model_calls=dict(calls),
            )

            reviews = []
            if request.config.review_low_confidence and low_confidence:
                self._set_stage(
                    task_id,
                    "semantic_quality_review",
                    current=0,
                    total=len(low_confidence),
                    unit="个低置信度项",
                    detail_message=f"准备复核 {len(low_confidence)} 个低置信度项",
                )
                for index, (chunk, data, confidence) in enumerate(low_confidence, 1):
                    self._raise_if_cancelled(task_id)
                    technical_error = None
                    try:
                        result = self._invoke_skill("semantic-quality-review", {
                            "rule_result": json.dumps({"confidence": confidence, "extraction": data}, ensure_ascii=False),
                            "source_path": chunk["sourcePath"],
                            "content": chunk["content"],
                        })
                        reviews.append({"chunkId": chunk["id"], "result": result["data"], "usage": result.get("usage", {})})
                        self._merge_model_calls(calls, result.pop("_modelCalls", None), succeeded_default=1)
                        level = "info"
                        event = "model_call.completed"
                        message = f"语义复核完成：{Path(chunk['sourcePath']).name} / {chunk['id']}"
                    except Exception as error:
                        technical_error = str(error)
                        self._merge_model_calls(calls, getattr(error, "model_calls", None), failed_default=1)
                        summary = error_summary(error)
                        issues.append(self._issue("SEMANTIC_REVIEW_FAILED", chunk["resourceId"], chunk["id"], summary))
                        level = "error"
                        event = "model_call.failed"
                        message = f"语义复核失败：{Path(chunk['sourcePath']).name} / {chunk['id']} - {summary}"
                    self._update_stage_progress(
                        task_id,
                        "semantic_quality_review",
                        index,
                        len(low_confidence),
                        "个低置信度项",
                        message,
                        level=level,
                        event=event,
                        details={
                            "resourceId": chunk["resourceId"],
                            "chunkId": chunk["id"],
                            "sourcePath": chunk["sourcePath"],
                            "confidence": confidence,
                            **({"technicalError": technical_error} if technical_error else {}),
                        },
                        model_calls=dict(calls),
                    )
                self._write_jsonl(run_dir / "model-results/semantic-quality-review.jsonl", reviews)
                self._set_stage(
                    task_id,
                    "semantic_quality_review",
                    "completed",
                    current=len(low_confidence),
                    total=len(low_confidence),
                    unit="个低置信度项",
                    detail_message=f"语义复核完成：{len(reviews)}/{len(low_confidence)} 成功",
                    model_calls=dict(calls),
                )
            else:
                self._set_stage(task_id, "semantic_quality_review", "skipped", detail_message="没有低置信度结果需要复核，因此跳过此步骤")

            self._set_stage(task_id, "graph_build", detail_message="正在合并文档、处理单元、实体和证据关系")
            self._raise_if_cancelled(task_id)
            nodes, edges = self._build_graph(chunks, extractions, issues)
            (run_dir / "graph/nodes.json").write_text(json.dumps(nodes, ensure_ascii=False, indent=2), encoding="utf-8")
            (run_dir / "graph/edges.json").write_text(json.dumps(edges, ensure_ascii=False, indent=2), encoding="utf-8")
            self._set_stage(
                task_id,
                "graph_build",
                "completed",
                current=len(nodes) + len(edges),
                total=len(nodes) + len(edges),
                unit="个图谱对象",
                detail_message=f"图谱构建完成：{len(nodes)} 个节点，{len(edges)} 条证据关系",
            )

            self._set_stage(task_id, "framework_quality_check", detail_message="正在检查来源、证据和图谱结构")
            self._raise_if_cancelled(task_id)
            summary = self._graph_summary(nodes, edges, issues)
            (run_dir / "quality/issues.json").write_text(json.dumps(issues, ensure_ascii=False, indent=2), encoding="utf-8")
            existing_review_keys = {(item.get("code"), item.get("resourceId"), item.get("chunkId")) for item in review_items}
            for issue in issues:
                key = (issue.get("code"), issue.get("resourceId"), issue.get("chunkId"))
                if key in existing_review_keys:
                    continue
                review_items.append(self._review_item(
                    task_id,
                    "framework_quality_check",
                    issue["code"],
                    issue["message"],
                    resource_id=issue.get("resourceId"),
                    chunk_id=issue.get("chunkId"),
                ))
            self._write_review_items(task_id, review_items)
            self._set_stage(
                task_id,
                "framework_quality_check",
                "completed",
                current=len(issues),
                total=len(issues),
                unit="个质量问题",
                detail_message=f"框架质量检查完成：{len(issues)} 个问题，{len(review_items)} 项待确认",
                graph_summary=summary,
            )

            self._set_stage(task_id, "publish_candidate", detail_message="正在登记候选数据集和运行报告")
            self.store.update_record("datasets", dataset.id, {
                "trainingTaskId": task_id,
                "graphAvailable": True,
                "graphSummary": summary,
            })
            report = {
                "taskId": task_id,
                "datasetId": dataset.id,
                "batchId": request.batch_id,
                "state": "completed",
                "modelCalls": calls,
                "graph": summary,
                "qualityIssueCount": len(issues),
                "completedAt": utcnow().isoformat(),
            }
            (run_dir / "run-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
            self._set_stage(task_id, "publish_candidate", "completed", detail_message="候选数据集登记完成", graph_summary=summary)
            self._raise_if_cancelled(task_id)
            self.tasks._update(
                task_id,
                state="completed",
                stage="completed",
                message=None,
                model_calls=dict(calls),
                graph_summary=summary,
                can_cancel=False,
                progress_detail={"stage": "completed", "message": "端到端加工完成"},
            )
            self._log(
                task_id,
                "info",
                "completed",
                "task.completed",
                f"端到端加工完成：模型成功 {calls['succeeded']}，失败 {calls['failed']}，待确认 {len(review_items)}",
                details={"modelCalls": calls, "graphSummary": summary, "reviewItemCount": len(review_items)},
            )
            self.batches.update(request.batch_id, state="downloaded", activeTaskIds=[])
        except TrainingCancelledError:
            self._complete_cancellation(task_id, request.batch_id)
        except Exception as exc:
            if self.tasks.get(task_id).state == "cancelling":
                self._complete_cancellation(task_id, request.batch_id)
                return
            current_stage = self.tasks.get(task_id).stage or "failed"
            summary = error_summary(exc)
            if current_stage in STAGES:
                self._set_stage(task_id, current_stage, "failed", detail_message=summary)
            self.tasks._update(
                task_id,
                state="failed",
                stage="failed",
                message=summary,
                can_cancel=False,
                can_retry=True,
                progress_detail={"stage": current_stage, "message": summary},
            )
            self._log(
                task_id,
                "error",
                current_stage,
                "task.failed",
                f"训练任务失败：{summary}",
                details={"technicalError": str(exc)},
            )
            self.batches.update(request.batch_id, state="failed", activeTaskIds=[])

    def _process_document_enrichment(
        self,
        task_id: str,
        resource_id: str,
        document_chunks: list[dict[str, Any]],
    ) -> dict[str, Any]:
        started_at = time.monotonic()
        first = document_chunks[0]
        source_path = first["sourcePath"]
        content = "\n\n".join(item["content"] for item in document_chunks)
        try:
            self._raise_if_cancelled(task_id)
            result = self._enrich_document(first, document_chunks)
            self._raise_if_cancelled(task_id)
            return {
                "success": True,
                "resourceId": resource_id,
                "sourcePath": source_path,
                "enrichment": {"resourceId": resource_id, "result": result["data"], "usage": result.get("usage", {})},
                "modelCalls": result.pop("_modelCalls", None),
                "summary": "",
                "technicalError": "",
                "level": "info",
                "event": "model_call.completed",
                "message": f"文档增强成功：{Path(source_path).name}",
                "durationMs": int((time.monotonic() - started_at) * 1000),
            }
        except TrainingCancelledError:
            raise
        except Exception as error:
            summary = error_summary(error)
            return {
                "success": False,
                "resourceId": resource_id,
                "sourcePath": source_path,
                "enrichment": {
                    "resourceId": resource_id,
                    "result": self._rule_based_summary(Path(source_path).name, content),
                    "usage": {},
                    "fallback": "rule_based_summary",
                },
                "modelCalls": getattr(error, "model_calls", None),
                "summary": summary,
                "technicalError": str(error),
                "level": "error",
                "event": "model_call.failed",
                "message": f"文档增强已降级：{Path(source_path).name} - {summary}",
                "durationMs": int((time.monotonic() - started_at) * 1000),
            }

    def _invoke_skill(
        self,
        skill_id: str,
        variables: dict[str, str],
        trace: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        system_prompt = self.prompts.get(f"{skill_id}.system")
        user_prompt = self.prompts.get(f"{skill_id}.user", system_prompt.skill_version)
        skill = self.prompts.skills.get(skill_id, system_prompt.skill_version)
        system = system_prompt.content
        user = user_prompt.content
        for name, value in variables.items():
            user = user.replace("{{" + name + "}}", value)
        defaults = skill.manifest.get("defaults", {})
        if "context_envelope" in variables:
            try:
                input_schema = json.loads((skill.root / skill.manifest["inputSchema"]).read_text(encoding="utf-8"))
                input_value = {"contextEnvelope": json.loads(variables["context_envelope"])}
                validate(instance=input_value, schema=input_schema)
            except (json.JSONDecodeError, ValidationError) as error:
                detail = error.message if isinstance(error, ValidationError) else str(error)
                raise ModelGatewayError(f"Skill 输入不符合结构：{detail}") from error
        options = {"temperature": 0.1}
        if "maxTokens" in defaults:
            options["max_tokens"] = int(defaults["maxTokens"])
        if "timeoutMs" in defaults:
            options["timeout_ms"] = int(defaults["timeoutMs"])
        if "enableThinking" in defaults:
            options["enable_thinking"] = bool(defaults["enableThinking"])
        if "chatTemplateKwargs" in defaults:
            options["chat_template_kwargs"] = defaults["chatTemplateKwargs"]
        if "jsonRepair" in defaults:
            options["json_repair"] = bool(defaults["jsonRepair"])
        network_retries = int(defaults.get("maxRetries", 0))
        options["max_retries"] = 0
        schema = json.loads((skill.root / skill.manifest["outputSchema"]).read_text(encoding="utf-8"))
        messages = [{"role": "system", "content": system}, {"role": "user", "content": user}]
        model_calls = {"succeeded": 0, "failed": 0}
        model_call_ids: list[str] = []

        def call_model(call_messages: list[dict[str, str]], retry_of: str | None = None):
            model_call_id = f"model_call_{uuid.uuid4().hex[:20]}"
            model_call_ids.append(model_call_id)
            details = {
                **(trace or {}),
                "modelCallId": model_call_id,
                "retryOf": retry_of,
                "skillId": skill_id,
            }
            if trace and trace.get("taskId"):
                self._log(
                    trace["taskId"], "info", trace["stage"], "model_call.started",
                    f"模型调用开始：{skill_id}", details=details,
                )
            started_at = time.monotonic()
            try:
                response = self.gateway.chat_json(call_messages, options)
            except Exception as error:
                model_calls["failed"] += 1
                error.model_call_ids = list(model_call_ids)
                error.model_call_id = model_call_id
                if trace and trace.get("taskId"):
                    self._log(
                        trace["taskId"], "error", trace["stage"], "model_call.failed",
                        f"模型调用失败：{skill_id} - {error_summary(error)}",
                        details={**details, "durationMs": int((time.monotonic() - started_at) * 1000), "technicalError": str(error)},
                    )
                raise
            if trace and trace.get("taskId"):
                self._log(
                    trace["taskId"], "info", trace["stage"], "model_call.completed",
                    f"模型调用完成：{skill_id}",
                    details={**details, "durationMs": int((time.monotonic() - started_at) * 1000), "attempts": response.get("attempts", 1)},
                )
            return response, model_call_id

        def call_with_network_retry(
            call_messages: list[dict[str, str]],
            retry_of: str | None = None,
        ):
            current_retry_of = retry_of
            for attempt in range(network_retries + 1):
                try:
                    return call_model(call_messages, retry_of=current_retry_of)
                except Exception:
                    if attempt >= network_retries:
                        raise
                    current_retry_of = model_call_ids[-1]
            raise AssertionError("网络重试流程未返回结果")

        try:
            result, first_model_call_id = call_with_network_retry(messages)
            attempts = max(1, int(result.get("attempts", 1)))
            model_calls["failed"] += attempts - 1
            result["data"] = self._normalize_skill_output(skill_id, result.get("data"), variables, skill.version)
            validate(instance=result.get("data"), schema=schema)
            model_calls["succeeded"] += 1
        except ValidationError as error:
            model_calls["failed"] += 1
            correction = (
                "上一次结果不符合输出 Schema。请根据原始输入上下文重新生成，只返回符合 Schema 的 JSON 对象。"
                f"\n校验错误：{error.message}"
            )
            try:
                result, _ = call_with_network_retry(
                    messages + [{"role": "user", "content": correction}],
                    retry_of=first_model_call_id,
                )
                attempts = max(1, int(result.get("attempts", 1)))
                model_calls["failed"] += attempts - 1
                result["data"] = self._normalize_skill_output(skill_id, result.get("data"), variables, skill.version)
                validate(instance=result.get("data"), schema=schema)
                model_calls["succeeded"] += 1
            except Exception as retry_error:
                if isinstance(retry_error, ValidationError):
                    model_calls["failed"] += 1
                    schema_error = ModelGatewayError(f"模型返回结果不符合输出结构：{retry_error.message}")
                    schema_error.model_calls = model_calls
                    schema_error.model_call_ids = list(model_call_ids)
                    schema_error.model_call_id = model_call_ids[-1] if model_call_ids else None
                    raise schema_error from retry_error
                retry_error.model_calls = model_calls
                retry_error.model_call_ids = list(model_call_ids)
                retry_error.model_call_id = model_call_ids[-1] if model_call_ids else None
                raise
        except Exception as error:
            error.model_calls = model_calls
            error.model_call_ids = list(model_call_ids)
            error.model_call_id = model_call_ids[-1] if model_call_ids else None
            raise
        result["_modelCalls"] = model_calls
        result["_modelCallIds"] = model_call_ids
        result["_modelCallId"] = model_call_ids[-1] if model_call_ids else None
        result["_agentTaskId"] = (trace or {}).get("agentTaskId")
        return result

    @staticmethod
    def _normalize_skill_output(skill_id: str, data: Any, variables: dict[str, str], skill_version: str) -> Any:
        if not isinstance(data, dict):
            return data
        normalized = deepcopy(data)
        try:
            envelope = json.loads(variables.get("context_envelope", "{}"))
        except json.JSONDecodeError:
            envelope = {}
        for key in ("taskId", "resourceId", "chunkId"):
            normalized.pop(key, None)
        aliases = {
            "knowledge_points": "knowledgePoints",
            "relationships": "relations",
            "resolved_entities": "entities",
            "resolved_relations": "relations",
            "uncertain_items": "uncertainItems",
        }
        for source, target in aliases.items():
            if target not in normalized and source in normalized:
                normalized[target] = normalized[source]
            normalized.pop(source, None)

        if skill_id == "knowledge-extraction":
            for collection in ("knowledgePoints", "entities", "relations", "uncertainItems"):
                normalized.setdefault(collection, [])
            metadata = normalized.get("metadata") if isinstance(normalized.get("metadata"), dict) else {}
            metadata = {key: metadata[key] for key in (
                "documentType", "extractionProfile", "domain", "domainContextVersion",
                "skillId", "skillVersion", "promptVersion", "agentId", "schemaVersion",
            ) if key in metadata}
            metadata.update({
                "documentType": envelope.get("documentType", metadata.get("documentType", "general_technical")),
                "extractionProfile": envelope.get("extractionProfile", metadata.get("extractionProfile", "general-technical")),
                "domain": envelope.get("domain", "yashandb"),
                "domainContextVersion": envelope.get("domainContextVersion", "yashandb-domain:1.0.0"),
                "skillId": "knowledge-extraction",
                "skillVersion": skill_version,
                "promptVersion": f"knowledge-extraction:{skill_version}",
                "agentId": "knowledge-extraction-agent",
                "schemaVersion": envelope.get("schemaVersion", "2.0.0"),
            })
            normalized["metadata"] = metadata
        elif skill_id == "semantic-enrichment":
            for collection in ("knowledgePoints", "entities", "relations"):
                normalized.setdefault(collection, [])
            normalized["uncertainItemId"] = envelope.get(
                "uncertainItemId", normalized.get("uncertainItemId")
            )
            metadata = normalized.get("metadata") if isinstance(normalized.get("metadata"), dict) else {}
            normalized["metadata"] = {
                "skillId": "semantic-enrichment",
                "skillVersion": skill_version,
                "agentId": "semantic-enrichment-agent",
                "promptVersion": f"semantic-enrichment:{skill_version}",
                "schemaVersion": envelope.get("schemaVersion", "2.0.0"),
            }

        normalized["knowledgePoints"] = TrainingService._normalize_knowledge_points(
            normalized.get("knowledgePoints", [])
        )
        normalized["entities"] = TrainingService._normalize_entities(normalized.get("entities", []))
        normalized["relations"] = TrainingService._normalize_relations(normalized.get("relations", []))
        if "uncertainItems" in normalized:
            normalized["uncertainItems"] = TrainingService._normalize_uncertain_items(
                normalized.get("uncertainItems", [])
            )
        if skill_id == "semantic-enrichment":
            allowed = {
                "uncertainItemId", "status", "reason", "confidence",
                "knowledgePoints", "entities", "relations", "metadata",
            }
            normalized = {key: normalized[key] for key in allowed if key in normalized}
        return normalized

    @staticmethod
    def _normalize_knowledge_points(values: Any) -> Any:
        if not isinstance(values, list):
            return values
        allowed = {
            "title", "statement", "knowledgeType", "evidenceText", "assertionStatus",
            "evidenceRole", "attributes", "scope", "confidence",
        }
        result = []
        for value in values:
            if not isinstance(value, dict):
                result.append(value)
                continue
            item = dict(value)
            statement = item.get("statement") or item.get("description") or item.get("content")
            if statement:
                item.setdefault("statement", statement)
                item.setdefault("title", str(statement).strip()[:80])
                item.setdefault("knowledgeType", item.get("type") or "technical_fact")
            result.append({key: item[key] for key in allowed if key in item})
        return result

    @staticmethod
    def _normalize_entities(values: Any) -> Any:
        if not isinstance(values, list):
            return values
        allowed = {
            "name", "type", "evidenceText", "assertionStatus", "evidenceRole",
            "canonicalName", "attributes", "scope", "confidence",
        }
        return [
            {key: value[key] for key in allowed if key in value} if isinstance(value, dict) else value
            for value in values
        ]

    @staticmethod
    def _normalize_relations(values: Any) -> Any:
        if not isinstance(values, list):
            return values
        allowed = {
            "source", "target", "type", "evidenceText", "assertionStatus",
            "evidenceRole", "attributes", "scope", "confidence",
        }
        result = []
        for value in values:
            if not isinstance(value, dict):
                result.append(value)
                continue
            item = dict(value)
            item.setdefault("source", item.get("sourceEntity"))
            item.setdefault("target", item.get("targetEntity"))
            item.setdefault("type", item.get("relationType"))
            result.append({key: item[key] for key in allowed if key in item and item[key] is not None})
        return result

    @staticmethod
    def _normalize_uncertain_items(values: Any) -> Any:
        if not isinstance(values, list):
            return values
        allowed = {"type", "reason", "evidenceText", "state", "candidateValues"}
        return [
            {key: value[key] for key in allowed if key in value} if isinstance(value, dict) else value
            for value in values
        ]

    def _invoke_skill_cached(
        self,
        skill_id: str,
        envelope: dict[str, Any],
        trace: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        system_prompt = self.prompts.get(f"{skill_id}.system")
        user_prompt = self.prompts.get(f"{skill_id}.user", system_prompt.skill_version)
        skill = self.prompts.skills.get(skill_id, system_prompt.skill_version)
        schema_path = skill.root / skill.manifest["outputSchema"]
        normalized_envelope = json.loads(json.dumps(envelope, ensure_ascii=False))
        normalized_envelope.pop("taskId", None)
        status = self.gateway.status()
        cache_key = stable_id("agent-cache", json.dumps({
            "skillId": skill_id,
            "skillVersion": skill.version,
            "systemPromptHash": system_prompt.content_hash,
            "userPromptHash": user_prompt.content_hash,
            "outputSchemaHash": hashlib.sha256(schema_path.read_bytes()).hexdigest(),
            "modelFingerprint": self._model_fingerprint(status),
            "envelope": normalized_envelope,
        }, ensure_ascii=False, sort_keys=True, separators=(",", ":"))).split(":", 1)[1]
        cache_path = settings.data_root / "processing" / "agent-cache" / skill_id / f"{cache_key}.json"
        if cache_path.is_file():
            try:
                cached = json.loads(cache_path.read_text(encoding="utf-8"))
                schema = json.loads(schema_path.read_text(encoding="utf-8"))
                validate(instance=cached.get("data"), schema=schema)
                return {
                    "data": cached["data"],
                    "usage": cached.get("usage", {}),
                    "_modelCalls": {"succeeded": 0, "failed": 0},
                    "_modelCallIds": [],
                    "_modelCallId": None,
                    "_agentTaskId": (trace or {}).get("agentTaskId"),
                    "_cacheHit": True,
                }
            except (OSError, json.JSONDecodeError, ValidationError, TypeError):
                pass
        result = self._invoke_skill(skill_id, {
            "context_envelope": json.dumps(envelope, ensure_ascii=False),
        }, trace=trace)
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        temporary = cache_path.with_suffix(".tmp")
        temporary.write_text(json.dumps({
            "data": result["data"],
            "usage": result.get("usage", {}),
            "createdAt": utcnow().isoformat(),
        }, ensure_ascii=False, indent=2), encoding="utf-8")
        temporary.replace(cache_path)
        result["_cacheHit"] = False
        return result

    def _enrich_document(self, first: dict[str, Any], document_chunks: list[dict[str, Any]]) -> dict[str, Any]:
        skill_prompt = self.prompts.get("document-enrichment.system")
        skill = self.prompts.skills.get("document-enrichment", skill_prompt.skill_version)
        defaults = skill.manifest.get("defaults", {})
        limit = int(defaults.get("maxDirectCharacters", DEFAULT_MAX_DIRECT_CHARACTERS))
        content = "\n\n".join(item["content"] for item in document_chunks)
        variables = {
            "document_title": Path(first["sourcePath"]).name,
            "source_path": first["sourcePath"],
            "content": content,
        }
        if len(content) <= limit:
            return self._invoke_skill("document-enrichment", variables)

        sections = self._group_document_sections(document_chunks, limit)
        partials = []
        model_calls = {"succeeded": 0, "failed": 0}
        usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
        try:
            for index, section in enumerate(sections, 1):
                result = self._invoke_skill("document-enrichment", {
                    **variables,
                    "document_title": f"{variables['document_title']}（第 {index}/{len(sections)} 部分）",
                    "content": section,
                })
                self._merge_model_calls(model_calls, result.pop("_modelCalls", None), succeeded_default=1)
                self._merge_usage(usage, result.get("usage", {}))
                partials.append(result["data"])
            aggregate = self._invoke_skill("document-enrichment", {
                **variables,
                "content": "以下是同一文档各部分的结构化摘要，请合并去重为文档级结果：\n" + json.dumps(partials, ensure_ascii=False),
            })
            self._merge_model_calls(model_calls, aggregate.pop("_modelCalls", None), succeeded_default=1)
            self._merge_usage(usage, aggregate.get("usage", {}))
            aggregate["usage"] = usage
            aggregate["_modelCalls"] = model_calls
            return aggregate
        except Exception as error:
            self._merge_model_calls(model_calls, getattr(error, "model_calls", None), failed_default=1)
            error.model_calls = model_calls
            raise

    @staticmethod
    def _group_document_sections(document_chunks: list[dict[str, Any]], limit: int) -> list[str]:
        sections: list[str] = []
        current: list[str] = []
        current_length = 0
        for chunk in document_chunks:
            content = chunk["content"]
            additional = len(content) + (2 if current else 0)
            if current and current_length + additional > limit:
                sections.append("\n\n".join(current))
                current = []
                current_length = 0
            current.append(content)
            current_length += len(content) + (2 if current_length else 0)
        if current:
            sections.append("\n\n".join(current))
        return sections

    @staticmethod
    def _rule_based_summary(title: str, content: str) -> dict[str, Any]:
        compact = re.sub(r"\s+", " ", content).strip()
        summary = compact[:360].rstrip("，。；; ")
        if len(compact) > len(summary):
            summary += "……"
        keywords = []
        for value in re.findall(r"YAS-\d+|[A-Za-z][A-Za-z0-9_.-]{2,}|[\u4e00-\u9fff]{2,8}", title + " " + compact[:2000]):
            normalized = value.strip("-_.")
            if normalized and normalized not in keywords:
                keywords.append(normalized)
            if len(keywords) == 8:
                break
        return {"summary": summary or title, "category": "未分类", "keywords": keywords, "confidence": 0.2, "evidence": [compact[:180]] if compact else []}

    @staticmethod
    def _merge_model_calls(target: dict[str, int], source: dict[str, int] | None, *, succeeded_default: int = 0, failed_default: int = 0) -> None:
        source = source or {"succeeded": succeeded_default, "failed": failed_default}
        target["succeeded"] = target.get("succeeded", 0) + int(source.get("succeeded", 0))
        target["failed"] = target.get("failed", 0) + int(source.get("failed", 0))

    @staticmethod
    def _merge_usage(target: dict[str, int], source: dict[str, Any]) -> None:
        for key in ("prompt_tokens", "completion_tokens", "total_tokens"):
            target[key] = target.get(key, 0) + int(source.get(key, 0) or 0)

    @staticmethod
    def _write_jsonl(path: Path, items: list[dict[str, Any]]) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(path.suffix + ".tmp")
        temporary.write_text("".join(json.dumps(item, ensure_ascii=False) + "\n" for item in items), encoding="utf-8")
        temporary.replace(path)

    @staticmethod
    def _write_json(path: Path, value: Any) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(path.suffix + ".tmp")
        temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
        temporary.replace(path)

    @staticmethod
    def _copy_embedding_cache(source_root: Path, target_root: Path) -> None:
        source = source_root / "model-results/embedding-cache"
        target = target_root / "model-results/embedding-cache"
        if not source.is_dir():
            target.mkdir(parents=True, exist_ok=True)
            return
        if target.exists():
            shutil.rmtree(target)
        shutil.copytree(source, target)

    @staticmethod
    def _write_text(path: Path, value: str) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(path.suffix + ".tmp")
        temporary.write_text(value, encoding="utf-8")
        temporary.replace(path)

    @staticmethod
    def _confidence(data: dict[str, Any]) -> float:
        values = []
        for collection in (data.get("knowledgePoints", []), data.get("entities", []), data.get("relations", [])):
            for item in collection:
                if isinstance(item, dict) and isinstance(item.get("confidence"), (int, float)):
                    values.append(float(item["confidence"]))
        return min(values) if values else 0.0

    @staticmethod
    def _issue(code: str, resource_id: str | None, chunk_id: str | None, message: str) -> dict[str, Any]:
        return {"code": code, "resourceId": resource_id, "chunkId": chunk_id, "message": message}

    def _build_graph_from_knowledge(self, chunks, knowledge, issues):
        nodes: dict[str, dict[str, Any]] = {}
        edges: dict[str, dict[str, Any]] = {}
        chunk_lookup = {item["id"]: item for item in chunks}

        def ensure_unit(chunk: dict[str, Any]) -> str:
            unit_id = stable_id("unit", chunk["id"])
            raw_name = str(chunk["id"])
            nodes.setdefault(unit_id, {
                "id": unit_id,
                "type": "ProcessingUnit",
                "name": self.clean_display_name(raw_name),
                "rawName": raw_name,
                "displayName": self.clean_display_name(raw_name),
                "properties": {
                    "headingPath": chunk.get("headingPath", []),
                    "sourcePath": chunk.get("sourcePath"),
                    "contentPreview": chunk["content"][:240],
                },
                "sourceResourceId": chunk["resourceId"],
                "chunkId": chunk["id"],
            })
            return unit_id

        def context_preview(chunk: dict[str, Any], evidence: str) -> str:
            content = str(chunk.get("content") or "")
            if not evidence or evidence not in content:
                return content[:500]
            start = max(0, content.find(evidence) - 160)
            end = min(len(content), content.find(evidence) + len(evidence) + 160)
            return content[start:end]

        def add_context_edge(node_id: str, item: dict[str, Any], chunk: dict[str, Any]) -> None:
            unit_id = ensure_unit(chunk)
            edge_id = stable_id("edge", node_id, unit_id, "CONTEXT_MATCHES_CHUNK", item["knowledgeId"])
            edges[edge_id] = {
                "id": edge_id,
                "type": "CONTEXT_MATCHES_CHUNK",
                "source": node_id,
                "target": unit_id,
                "sourceResourceId": item["sourceResourceId"],
                "chunkId": item["chunkId"],
                "evidenceText": item["evidenceText"],
                "contextText": context_preview(chunk, str(item.get("evidenceText") or "")),
                "evidenceOffsets": item["evidenceOffsets"],
                "sourceLocations": item.get("sourceLocations", []),
                "confidence": item.get("confidence"),
            }

        entity_aliases: dict[tuple[str, str], str] = {}
        for item in knowledge:
            if item.get("validationState") != "passed":
                continue
            chunk = chunk_lookup.get(item.get("chunkId"))
            if not chunk:
                continue
            value = item["value"]
            if item.get("kind") == "knowledge_point":
                title = str(value.get("title") or "").strip()
                statement = str(value.get("statement") or "").strip()
                name = title or statement[:80] or item["knowledgeId"]
                identity = self._keyword_node_identity(name)
                if not identity:
                    continue
                canonical_name, identity_key = identity
                point_id = stable_id("knowledge-point", identity_key)
                node = nodes.setdefault(point_id, {
                    "id": point_id,
                    "type": "KnowledgePoint",
                    "name": self.clean_display_name(canonical_name),
                    "rawName": name,
                    "displayName": self.clean_display_name(canonical_name),
                    "canonicalName": canonical_name,
                    "aliases": [],
                    "matchedAliases": [],
                    "sourceResourceIds": [],
                    "chunkIds": [],
                    "occurrences": [],
                    "properties": {**value, "canonicalName": canonical_name},
                    "sourceResourceId": item["sourceResourceId"],
                    "chunkId": item["chunkId"],
                    "evidenceText": item.get("evidenceText"),
                })
                node["aliases"] = self._merge_unique_values(
                    node.get("aliases", []), self._valid_keyword_aliases([title] if title else [])
                )
                node["sourceResourceIds"] = self._merge_unique_values(
                    node.get("sourceResourceIds", []), [item.get("sourceResourceId")]
                )
                node["chunkIds"] = self._merge_unique_values(node.get("chunkIds", []), [item.get("chunkId")])
                node["occurrences"].append({
                    "knowledgeId": item.get("knowledgeId"),
                    "resourceId": item.get("sourceResourceId"),
                    "chunkId": item.get("chunkId"),
                    "evidenceText": item.get("evidenceText"),
                    "sourceLocations": item.get("sourceLocations", []),
                })
                add_context_edge(point_id, item, chunk)
                continue
            if item.get("kind") != "entity":
                continue
            name = str(value["name"])
            entity_type = str(value["type"])
            identity = self._keyword_node_identity(name, value.get("termId"))
            if not identity:
                continue
            canonical_name, identity_key = identity
            entity_id = stable_id("entity", entity_type.casefold(), identity_key)
            aliases = self._valid_keyword_aliases(
                [name, *(value.get("aliases") or []), *(value.get("matchedAliases") or [])]
            )
            for alias in aliases:
                entity_aliases[(item["sourceResourceId"], alias.casefold())] = entity_id
            node = nodes.setdefault(entity_id, {
                "id": entity_id,
                "type": entity_type,
                "name": self.clean_display_name(canonical_name),
                "rawName": name,
                "displayName": self.clean_display_name(canonical_name),
                "canonicalName": canonical_name,
                "aliases": [],
                "matchedAliases": [],
                "sourceResourceIds": [],
                "chunkIds": [],
                "occurrences": [],
                "properties": {**value, "canonicalName": canonical_name},
                "sourceResourceId": item["sourceResourceId"],
                "chunkId": item["chunkId"],
                "evidenceText": item.get("evidenceText"),
            })
            node["aliases"] = self._merge_unique_values(node.get("aliases", []), aliases)
            node["matchedAliases"] = self._merge_unique_values(
                node.get("matchedAliases", []), self._valid_keyword_aliases(value.get("matchedAliases") or [])
            )
            node["sourceResourceIds"] = self._merge_unique_values(
                node.get("sourceResourceIds", []), [item.get("sourceResourceId")]
            )
            node["chunkIds"] = self._merge_unique_values(node.get("chunkIds", []), [item.get("chunkId")])
            node["occurrences"].append({
                "knowledgeId": item.get("knowledgeId"),
                "resourceId": item.get("sourceResourceId"),
                "chunkId": item.get("chunkId"),
                "evidenceText": item.get("evidenceText"),
                "sourceLocations": item.get("sourceLocations", []),
            })
            add_context_edge(entity_id, item, chunk)
        for item in knowledge:
            if item.get("kind") != "relation" or item.get("validationState") != "passed":
                continue
            value = item["value"]
            source_id = entity_aliases.get((item["sourceResourceId"], str(value["source"]).casefold()))
            target_id = entity_aliases.get((item["sourceResourceId"], str(value["target"]).casefold()))
            if not source_id or not target_id:
                issues.append(self._quality_issue(
                    "GRAPH_RELATION_ENDPOINT_INVALID",
                    item["sourceResourceId"],
                    item["chunkId"],
                    f"最终知识关系无法构图：{value['source']} -> {value['target']}",
                    source_path=item.get("sourcePath"),
                    evidence=item.get("evidenceText"),
                    details={"knowledgeId": item["knowledgeId"], "severity": "error"},
                ))
                continue
            edge_id = stable_id("edge", source_id, target_id, str(value["type"]), item["knowledgeId"])
            edges[edge_id] = {
                "id": edge_id,
                "type": value["type"],
                "source": source_id,
                "target": target_id,
                "sourceResourceId": item["sourceResourceId"],
                "chunkId": item["chunkId"],
                "evidenceText": item["evidenceText"],
                "contextText": context_preview(chunk_lookup.get(item["chunkId"], {}), str(item.get("evidenceText") or "")),
                "evidenceOffsets": item["evidenceOffsets"],
                "sourceLocations": item.get("sourceLocations", []),
                "confidence": item.get("confidence"),
            }
        return list(nodes.values()), list(edges.values())

    def _build_dataset_graph(
        self,
        chunks,
        knowledge,
        issues,
        documents=None,
        chunk_contexts=None,
        model_keywords=None,
    ):
        passed_knowledge = [item for item in knowledge if item.get("validationState") == "passed"]
        if passed_knowledge:
            nodes, edges = self._build_graph_from_knowledge(chunks, knowledge, issues)
            keyword_nodes, keyword_edges = self._build_graph_from_model_keywords(
                chunks, documents or [], chunk_contexts or [], model_keywords or []
            )
            node_map = {item["id"]: item for item in nodes}
            edge_map = {item["id"]: item for item in edges}
            for node in keyword_nodes:
                current = node_map.get(node["id"])
                if current is None:
                    node_map[node["id"]] = node
                    continue
                for key in ("aliases", "matchedAliases", "sourceMethods", "evidenceSources", "sourceResourceIds", "chunkIds", "occurrences"):
                    current[key] = self._merge_unique_values(current.get(key, []), node.get(key, []))
            edge_map.update({item["id"]: item for item in keyword_edges})
            nodes, edges = list(node_map.values()), list(edge_map.values())
            return nodes, edges, "final_knowledge"
        nodes, edges = self._build_graph_from_model_keywords(
            chunks, documents or [], chunk_contexts or [], model_keywords or []
        )
        if nodes and edges:
            return nodes, edges, "model_keyword"
        nodes, edges = self._build_graph_from_metadata_keywords(chunks, documents or [], chunk_contexts or [])
        graph_source = "metadata_keyword" if nodes and edges else "empty"
        return nodes, edges, graph_source

    def _build_graph_from_model_keywords(self, chunks, documents, chunk_contexts, model_keywords):
        nodes: dict[str, dict[str, Any]] = {}
        edges: dict[str, dict[str, Any]] = {}
        chunk_lookup = {
            str(item.get("id") or item.get("chunkId")): item
            for item in chunks
            if item.get("id") or item.get("chunkId")
        }
        document_lookup = {
            str(item.get("resourceId")): item
            for item in documents
            if item.get("resourceId")
        }
        context_lookup = {
            str(item.get("chunkId") or item.get("id")): item
            for item in chunk_contexts
            if item.get("chunkId") or item.get("id")
        }

        for candidate in model_keywords:
            chunk_id = str(candidate.get("chunkId") or "")
            chunk = chunk_lookup.get(chunk_id)
            if chunk is None:
                continue
            resource_id = str(candidate.get("resourceId") or chunk.get("resourceId") or "")
            canonical = candidate.get("canonicalName") or candidate.get("name")
            identity = self._keyword_node_identity(canonical, candidate.get("termId"))
            if identity is None:
                continue
            canonical_name, identity_key = identity
            keyword_id = stable_id("keyword", identity_key)
            aliases = self._valid_keyword_aliases(candidate.get("aliases") or [])
            matched_aliases = self._valid_keyword_aliases(candidate.get("matchedAliases") or [])
            evidence_source = str(candidate.get("evidenceSource") or "content")
            source_method = str(candidate.get("sourceMethod") or "model_keyword")
            confidence = float(candidate.get("confidence") or 0)
            evidence = str(candidate.get("evidenceText") or canonical_name)
            document = document_lookup.get(resource_id, {})
            context = context_lookup.get(chunk_id, {})
            content = str(chunk.get("content") or "")

            unit_id = stable_id("unit", chunk_id)
            nodes.setdefault(unit_id, {
                "id": unit_id,
                "type": "ProcessingUnit",
                "name": self.clean_display_name(chunk_id),
                "rawName": chunk_id,
                "displayName": self.clean_display_name(chunk_id),
                "properties": {
                    "headingPath": chunk.get("headingPath") or context.get("headingPath", []),
                    "sourcePath": chunk.get("sourcePath"),
                    "documentTitle": document.get("title") or candidate.get("documentTitle"),
                    "chunkSummary": context.get("chunkSummary"),
                    "contentPreview": (str(context.get("chunkSummary") or "") or content)[:240],
                    "graphSource": "model_keyword",
                },
                "sourceResourceId": resource_id,
                "chunkId": chunk_id,
            })
            node = nodes.setdefault(keyword_id, {
                "id": keyword_id,
                "keywordId": keyword_id,
                "type": "Keyword",
                "name": self.clean_display_name(canonical_name),
                "rawName": canonical_name,
                "displayName": self.clean_display_name(canonical_name),
                "canonicalName": canonical_name,
                "aliases": [],
                "matchedAliases": [],
                "sourceMethods": [],
                "evidenceSources": [],
                "sourceResourceIds": [],
                "chunkIds": [],
                "confidence": confidence,
                "modelConfidence": confidence,
                "approvalStatus": "autoAccepted" if confidence >= 0.65 else "pending",
                "occurrences": [],
                "properties": {
                    "termId": candidate.get("termId"),
                    "termType": candidate.get("termType"),
                    "category": candidate.get("category"),
                    "canonicalName": canonical_name,
                    "keywordId": keyword_id,
                    "confidence": confidence,
                    "approvalStatus": "autoAccepted" if confidence >= 0.65 else "pending",
                    "graphSource": "model_keyword",
                },
                "sourceResourceId": resource_id,
                "chunkId": chunk_id,
            })
            node["aliases"] = self._merge_unique_values(node.get("aliases", []), aliases)
            node["matchedAliases"] = self._merge_unique_values(node.get("matchedAliases", []), matched_aliases)
            node["sourceMethods"] = self._merge_unique_values(node.get("sourceMethods", []), [source_method])
            node["evidenceSources"] = self._merge_unique_values(node.get("evidenceSources", []), [evidence_source])
            node["sourceResourceIds"] = self._merge_unique_values(node.get("sourceResourceIds", []), [resource_id])
            node["chunkIds"] = self._merge_unique_values(node.get("chunkIds", []), [chunk_id])
            node["confidence"] = max(float(node.get("confidence") or 0), confidence)
            node["modelConfidence"] = max(float(node.get("modelConfidence") or 0), confidence)
            occurrence = {
                "candidateId": candidate.get("candidateId"),
                "resourceId": resource_id,
                "chunkId": chunk_id,
                "documentTitle": document.get("title") or candidate.get("documentTitle"),
                "evidenceSource": evidence_source,
                "evidenceText": evidence,
                "sourceMethod": source_method,
                "confidence": confidence,
            }
            if occurrence not in node["occurrences"]:
                node["occurrences"].append(occurrence)
            properties = node["properties"]
            for key in ("aliases", "matchedAliases", "sourceMethods", "evidenceSources", "sourceResourceIds", "chunkIds"):
                properties[key] = list(node[key])
            properties["confidence"] = node["confidence"]
            properties["modelConfidence"] = node["modelConfidence"]
            properties["occurrences"] = list(node["occurrences"])

            edge_id = stable_id("edge", keyword_id, unit_id, "CONTEXT_MATCHES_CHUNK", candidate.get("candidateId") or chunk_id)
            edges[edge_id] = {
                "id": edge_id,
                "type": "CONTEXT_MATCHES_CHUNK",
                "source": keyword_id,
                "target": unit_id,
                "sourceResourceId": resource_id,
                "chunkId": chunk_id,
                "documentTitle": document.get("title") or candidate.get("documentTitle"),
                "evidenceSource": evidence_source,
                "evidenceText": evidence,
                "contextText": self._metadata_graph_context_text(context, chunk),
                "evidenceOffsets": self._offsets(content, evidence) if evidence_source in {"content", "heading"} else {"start": -1, "end": -1},
                "sourceLocations": chunk.get("sourceLocations", []),
                "documentOffsets": chunk.get("documentOffsets") or chunk.get("normalizedOffsets"),
                "confidence": confidence,
                "sourceMethod": source_method,
            }
        return list(nodes.values()), list(edges.values())

    def _build_graph_from_metadata_keywords(self, chunks, documents, chunk_contexts):
        nodes: dict[str, dict[str, Any]] = {}
        edges: dict[str, dict[str, Any]] = {}
        chunk_lookup = {
            str(item.get("id") or item.get("chunkId")): item
            for item in chunks
            if item.get("id") or item.get("chunkId")
        }
        document_lookup = {
            str(item.get("resourceId")): item
            for item in documents
            if item.get("resourceId")
        }
        context_lookup = {
            str(item.get("chunkId") or item.get("id")): item
            for item in chunk_contexts
            if item.get("chunkId") or item.get("id")
        }

        def ensure_unit(chunk: dict[str, Any], context: dict[str, Any] | None) -> str:
            chunk_id = str(chunk.get("id") or chunk.get("chunkId"))
            unit_id = stable_id("unit", chunk_id)
            summary = str((context or {}).get("chunkSummary") or "")
            content = str(chunk.get("content") or "")
            nodes.setdefault(unit_id, {
                "id": unit_id,
                "type": "ProcessingUnit",
                "name": self.clean_display_name(chunk_id),
                "rawName": chunk_id,
                "displayName": self.clean_display_name(chunk_id),
                "properties": {
                    "headingPath": chunk.get("headingPath") or (context or {}).get("headingPath", []),
                    "sourcePath": chunk.get("sourcePath"),
                    "chunkSummary": summary,
                    "contentPreview": (summary or content)[:240],
                    "graphSource": "metadata_keyword",
                },
                "sourceResourceId": chunk.get("resourceId"),
                "chunkId": chunk_id,
            })
            return unit_id

        for chunk_id, chunk in chunk_lookup.items():
            resource_id = str(chunk.get("resourceId") or "")
            context = context_lookup.get(chunk_id, {})
            document = document_lookup.get(resource_id, {})
            candidates = self._metadata_graph_keyword_candidates(context, document)
            candidates = [
                candidate for candidate in candidates
                if self._keyword_identity(candidate.get("canonicalName") or candidate.get("name"))
            ]
            if not candidates:
                continue
            unit_id = ensure_unit(chunk, context)
            context_text = self._metadata_graph_context_text(context, chunk)
            content = str(chunk.get("content") or "")
            summary = str(context.get("chunkSummary") or "")
            for candidate in candidates[:MAX_METADATA_GRAPH_KEYWORDS_PER_CHUNK]:
                canonical = str(candidate.get("canonicalName") or candidate["name"]).strip()
                candidate_properties = candidate.get("properties") or {}
                term_id = candidate_properties.get("termId")
                identity = self._keyword_node_identity(canonical, term_id)
                if not identity:
                    continue
                canonical_name, identity_key = identity
                keyword_id = stable_id("keyword", identity_key)
                aliases = self._valid_keyword_aliases(candidate.get("aliases") or [])
                matched_aliases = self._valid_keyword_aliases(candidate.get("matchedAliases") or [])
                node = nodes.setdefault(keyword_id, {
                    "id": keyword_id,
                    "keywordId": keyword_id,
                    "type": "Keyword",
                    "name": self.clean_display_name(canonical_name),
                    "rawName": canonical_name,
                    "displayName": self.clean_display_name(canonical_name),
                    "canonicalName": canonical_name,
                    "aliases": [],
                    "matchedAliases": [],
                    "sourceResourceIds": [],
                    "chunkIds": [],
                    "confidence": float(candidate.get("confidence", 0.6)),
                    "approvalStatus": "autoAccepted" if float(candidate.get("confidence", 0.6)) >= 0.65 else "pending",
                    "occurrences": [],
                    "properties": {
                        **candidate_properties,
                        "graphSource": "metadata_keyword",
                        "sourceMethod": candidate.get("source"),
                        "canonicalName": canonical_name,
                        "keywordId": keyword_id,
                        "confidence": float(candidate.get("confidence", 0.6)),
                        "approvalStatus": "autoAccepted" if float(candidate.get("confidence", 0.6)) >= 0.65 else "pending",
                    },
                    "sourceResourceId": resource_id,
                    "chunkId": chunk_id,
                })
                node["aliases"] = self._merge_unique_values(node.get("aliases", []), aliases)
                node["matchedAliases"] = self._merge_unique_values(node.get("matchedAliases", []), matched_aliases)
                node["sourceResourceIds"] = self._merge_unique_values(node.get("sourceResourceIds", []), [resource_id] if resource_id else [])
                node["chunkIds"] = self._merge_unique_values(node.get("chunkIds", []), [chunk_id] if chunk_id else [])
                node["confidence"] = max(float(node.get("confidence") or 0), float(candidate.get("confidence", 0.6)))
                node["occurrences"].append({
                    "chunkId": chunk_id,
                    "resourceId": resource_id,
                    "evidenceText": candidate.get("evidenceText") or summary or content[:240],
                    "sourceMethod": candidate.get("source"),
                    "matchedAliases": matched_aliases or aliases,
                })
                properties = node.setdefault("properties", {})
                properties["graphSource"] = "metadata_keyword"
                properties["canonicalName"] = canonical_name
                properties["confidence"] = node["confidence"]
                properties["sourceMethod"] = candidate.get("source")
                properties["sourceMethods"] = self._merge_unique_values(properties.get("sourceMethods", []), [candidate.get("source")])
                properties["aliases"] = self._merge_unique_values(properties.get("aliases", []), aliases)
                properties["matchedAliases"] = self._merge_unique_values(properties.get("matchedAliases", []), matched_aliases)
                properties["sourceResourceIds"] = self._merge_unique_values(properties.get("sourceResourceIds", []), [resource_id] if resource_id else [])
                properties["chunkIds"] = self._merge_unique_values(properties.get("chunkIds", []), [chunk_id] if chunk_id else [])
                evidence = self._metadata_keyword_evidence(canonical_name, content, summary)
                edge_id = stable_id("edge", keyword_id, unit_id, "CONTEXT_MATCHES_CHUNK", chunk_id)
                edges[edge_id] = {
                    "id": edge_id,
                    "type": "CONTEXT_MATCHES_CHUNK",
                    "source": keyword_id,
                    "target": unit_id,
                    "sourceResourceId": resource_id,
                    "chunkId": chunk_id,
                    "evidenceText": evidence,
                    "contextText": context_text,
                    "evidenceOffsets": self._offsets(content, evidence),
                    "sourceLocations": chunk.get("sourceLocations", []),
                    "documentOffsets": chunk.get("documentOffsets") or chunk.get("normalizedOffsets"),
                    "confidence": candidate.get("confidence", 0.6),
                    "sourceMethod": "metadata_keyword",
                }
        return list(nodes.values()), list(edges.values())

    def _metadata_graph_keyword_candidates(self, context: dict[str, Any], document: dict[str, Any]) -> list[dict[str, Any]]:
        candidates: list[dict[str, Any]] = []
        domain_aliases: set[str] = set()
        configured_stopwords = {
            str(item).casefold()
            for item in (getattr(self.metadata_construction, "rules", {}) or {}).get("stopwords", set())
        }
        blocked_document_names = {
            re.sub(r"\s+", " ", str(value or "").strip()).casefold()
            for value in (
                document.get("title"),
                Path(str(document.get("sourcePath") or "")).stem,
            )
            if str(value or "").strip()
        }
        blocked_document_names.update(configured_stopwords)

        def add(
            name: Any,
            canonical_name: Any,
            source: str,
            confidence: float,
            priority: int,
            properties: dict[str, Any] | None = None,
            aliases: list[Any] | None = None,
            matched_aliases: list[Any] | None = None,
        ) -> None:
            text = str(name or "").strip()
            canonical = str(canonical_name or text).strip()
            if not text or not canonical:
                return
            candidates.append({
                "name": text,
                "canonicalName": canonical,
                "source": source,
                "confidence": confidence,
                "priority": priority,
                "properties": properties or {},
                "aliases": [str(item).strip() for item in (aliases or matched_aliases or []) if str(item).strip()],
                "matchedAliases": [str(item).strip() for item in (matched_aliases or []) if str(item).strip()],
            })

        for term in list(context.get("domainTerms") or []) + list(document.get("domainTerms") or []):
            if isinstance(term, dict):
                properties = {
                    "termId": term.get("termId"),
                    "category": term.get("category"),
                    "termType": term.get("termType"),
                }
                canonical = term.get("canonicalName") or term.get("displayName") or term.get("name")
                aliases = term.get("aliases") or []
                matched_aliases = term.get("matchedAliases") or []
                add(canonical, canonical, "domain_term", 0.72, 10, properties, aliases, matched_aliases)
                domain_aliases.update(
                    str(item).strip().casefold()
                    for item in [canonical, *aliases, *matched_aliases]
                    if str(item or "").strip()
                )
            else:
                add(term, term, "domain_term", 0.7, 10)
                if str(term or "").strip():
                    domain_aliases.add(str(term).strip().casefold())
        for keyword in context.get("documentKeywords") or []:
            normalized = re.sub(r"\s+", " ", str(keyword or "").strip()).casefold()
            if normalized not in domain_aliases and normalized not in blocked_document_names:
                add(keyword, keyword, "chunk_context_keyword", 0.65, 30)
        for keyword in document.get("keywords") or []:
            normalized = re.sub(r"\s+", " ", str(keyword or "").strip()).casefold()
            if normalized not in domain_aliases and normalized not in blocked_document_names:
                add(keyword, keyword, "document_keyword", 0.6, 35)

        deduplicated: dict[str, dict[str, Any]] = {}
        for item in candidates:
            term_id = str((item.get("properties") or {}).get("termId") or "").strip().casefold()
            key = f"term:{term_id}" if term_id else f"canonical:{item['canonicalName'].casefold()}"
            current = deduplicated.get(key)
            if current is None or (item["priority"], -len(item["canonicalName"])) < (current["priority"], -len(current["canonicalName"])):
                deduplicated[key] = item
        return sorted(deduplicated.values(), key=lambda item: (item["priority"], -len(item["canonicalName"]), item["canonicalName"].casefold()))

    @staticmethod
    def _metadata_graph_context_text(context: dict[str, Any], chunk: dict[str, Any]) -> str:
        parts = []
        if context.get("previousChunkSummary"):
            parts.append(f"上一块：{context['previousChunkSummary']}")
        summary = context.get("chunkSummary") or str(chunk.get("content") or "")[:500]
        if summary:
            parts.append(f"当前块：{summary}")
        if context.get("nextChunkSummary"):
            parts.append(f"下一块：{context['nextChunkSummary']}")
        return "\n".join(str(part) for part in parts)[:1200]

    @staticmethod
    def _metadata_keyword_evidence(keyword: str, content: str, summary: str) -> str:
        if keyword and keyword in content:
            return keyword
        if keyword and keyword in summary:
            return keyword
        return (summary or keyword or content[:240])[:240]

    def _build_graph(self, chunks, extractions, issues):
        nodes: dict[str, dict[str, Any]] = {}
        edges: dict[str, dict[str, Any]] = {}
        chunk_lookup = {item["id"]: item for item in chunks}
        for chunk in chunks:
            document_id = stable_id("document", chunk["resourceId"])
            chunk_node_id = stable_id("chunk", chunk["id"])
            nodes.setdefault(document_id, {"id": document_id, "type": "Document", "name": chunk["sourcePath"], "properties": {}, "sourceResourceId": chunk["resourceId"], "chunkId": None})
            nodes[document_id]["rawName"] = chunk["sourcePath"]
            nodes[document_id]["displayName"] = self.clean_display_name(chunk["sourcePath"])
            nodes[document_id]["name"] = nodes[document_id]["displayName"]
            nodes[chunk_node_id] = {
                "id": chunk_node_id,
                "type": "Chunk",
                "name": self.clean_display_name(chunk["id"]),
                "rawName": chunk["id"],
                "displayName": self.clean_display_name(chunk["id"]),
                "properties": {"contentPreview": chunk["content"][:240]},
                "sourceResourceId": chunk["resourceId"],
                "chunkId": chunk["id"],
            }
            edge_id = stable_id("edge", document_id, chunk_node_id, "HAS_CHUNK")
            edges[edge_id] = {"id": edge_id, "type": "HAS_CHUNK", "source": document_id, "target": chunk_node_id, "sourceResourceId": chunk["resourceId"], "chunkId": chunk["id"], "evidenceText": chunk["content"][:500], "evidenceOffsets": {"start": 0, "end": min(500, len(chunk["content"]))}, "confidence": 1.0}
        aliases: dict[tuple[str, str], str] = {}
        for extraction in extractions:
            chunk = chunk_lookup.get(extraction["chunkId"])
            if not chunk:
                continue
            data = extraction["result"]
            for item in data.get("entities", []):
                entity = item if isinstance(item, dict) else {"name": str(item)}
                name = str(entity.get("name") or entity.get("id") or "").strip()
                if not name:
                    continue
                entity_type = str(entity.get("type") or "Entity")
                if re.fullmatch(r"ORA-\d+", name, re.IGNORECASE):
                    entity_type = "OracleErrorCode"
                elif re.fullmatch(r"YAS-\d+", name, re.IGNORECASE):
                    entity_type = "YashanDBErrorCode"
                node_id = stable_id("entity", entity_type.lower(), name.lower())
                aliases[(extraction["chunkId"], name)] = node_id
                nodes.setdefault(node_id, {
                    "id": node_id,
                    "type": entity_type,
                    "name": self.clean_display_name(name),
                    "rawName": name,
                    "displayName": self.clean_display_name(name),
                    "properties": entity,
                    "sourceResourceId": extraction["resourceId"],
                    "chunkId": extraction["chunkId"],
                })
                chunk_node_id = stable_id("chunk", extraction["chunkId"])
                evidence = self._evidence(entity, chunk["content"])
                edge_id = stable_id("edge", chunk_node_id, node_id, "MENTIONS")
                edges[edge_id] = {"id": edge_id, "type": "MENTIONS", "source": chunk_node_id, "target": node_id, "sourceResourceId": extraction["resourceId"], "chunkId": extraction["chunkId"], "evidenceText": evidence, "evidenceOffsets": self._offsets(chunk["content"], evidence), "confidence": float(entity.get("confidence", 0.8))}
            for item in data.get("relations", []):
                if not isinstance(item, dict):
                    continue
                source_name = str(item.get("source") or item.get("sourceEntity") or "").strip()
                target_name = str(item.get("target") or item.get("targetEntity") or "").strip()
                evidence = self._evidence(item, "")
                source_id = aliases.get((extraction["chunkId"], source_name))
                target_id = aliases.get((extraction["chunkId"], target_name))
                if not source_id or not target_id or not evidence:
                    issues.append(self._issue("RELATION_EVIDENCE_INCOMPLETE", extraction["resourceId"], extraction["chunkId"], f"关系缺少可解析实体或证据: {source_name} -> {target_name}"))
                    continue
                relation_type = str(item.get("type") or item.get("relation") or "RELATES_TO")
                edge_id = stable_id("edge", source_id, target_id, relation_type, extraction["chunkId"])
                edges[edge_id] = {"id": edge_id, "type": relation_type, "source": source_id, "target": target_id, "sourceResourceId": extraction["resourceId"], "chunkId": extraction["chunkId"], "evidenceText": evidence, "evidenceOffsets": self._offsets(chunk["content"], evidence), "confidence": float(item.get("confidence", 0.7))}
        return list(nodes.values()), list(edges.values())

    @staticmethod
    def _evidence(item: dict[str, Any], fallback: str) -> str:
        evidence = item.get("evidenceText") or item.get("evidence") or ""
        if isinstance(evidence, list):
            evidence = evidence[0] if evidence else ""
        return str(evidence or fallback[:500]).strip()

    @staticmethod
    def _offsets(content: str, evidence: str) -> dict[str, int]:
        start = content.find(evidence) if evidence else -1
        return {"start": start, "end": start + len(evidence) if start >= 0 else -1}

    def _graph_summary(self, nodes, edges, issues, graph_source: str | None = None):
        node_types: dict[str, int] = {}
        edge_types: dict[str, int] = {}
        enriched_nodes = self._with_graph_display_names(nodes)
        node_lookup = {node.get("id"): node for node in enriched_nodes if isinstance(node, dict)}
        knowledge_nodes = [
            node for node in enriched_nodes
            if isinstance(node, dict) and node.get("type") in KNOWLEDGE_NODE_TYPES and node.get("knowledgeDomain") != "evidence"
        ]
        connected_node_ids = {
            str(value)
            for edge in edges
            for value in (edge.get("source"), edge.get("target"))
            if value
        }
        knowledge_domain_counts: dict[str, int] = {"what": 0, "how": 0, "why": 0}
        ontology_type_counts: dict[str, int] = {}
        task_context_counts: dict[str, int] = {}
        for node in enriched_nodes:
            node_types[node["type"]] = node_types.get(node["type"], 0) + 1
            if node in knowledge_nodes:
                domain = str(node.get("knowledgeDomain") or "what")
                if domain in knowledge_domain_counts:
                    knowledge_domain_counts[domain] += 1
                ontology_type = str(node.get("ontologyType") or node.get("type") or "Concept")
                ontology_type_counts[ontology_type] = ontology_type_counts.get(ontology_type, 0) + 1
                task_context = str(node.get("taskContext") or "general")
                task_context_counts[task_context] = task_context_counts.get(task_context, 0) + 1
        for edge in edges:
            edge_types[edge["type"]] = edge_types.get(edge["type"], 0) + 1
        knowledge_count = len(knowledge_nodes)
        keyword_nodes = [node for node in enriched_nodes if isinstance(node, dict) and node.get("type") == "Keyword"]
        keyword_approval_state = {"autoAccepted": 0, "accepted": 0, "pending": 0, "rejected": 0}
        keyword_business_state = {
            "totalKeywordCount": len(keyword_nodes),
            "businessAcceptedCount": 0,
            "businessRejectedCount": 0,
            "needsReviewCount": 0,
            "admittedChunkCount": 0,
            "reasonCounts": {},
        }
        keyword_admission_state = {"admitted": 0, "excluded": 0, "totalKeywordCount": len(keyword_nodes)}
        keyword_level_stats = {"L1": 0, "L2": 0, "unspecified": 0}
        for node in keyword_nodes:
            properties = node.get("properties") if isinstance(node.get("properties"), dict) else {}
            status = str(node.get("approvalStatus") or properties.get("approvalStatus") or "autoAccepted")
            if status not in keyword_approval_state:
                status = "pending"
            keyword_approval_state[status] += 1
            business_status = str(node.get("businessStatus") or properties.get("businessStatus") or "")
            if business_status == "businessAccepted":
                keyword_business_state["businessAcceptedCount"] += 1
                keyword_business_state["admittedChunkCount"] += len(node.get("chunkIds") or [])
            elif business_status == "businessRejected":
                keyword_business_state["businessRejectedCount"] += 1
            else:
                keyword_business_state["needsReviewCount"] += 1
            reason_counts = keyword_business_state["reasonCounts"]
            for reason in (node.get("businessReasonCodes") or properties.get("businessReasonCodes") or []):
                reason_counts[str(reason)] = reason_counts.get(str(reason), 0) + 1
            admission = self._read_admission_status(node)
            if admission in keyword_admission_state:
                keyword_admission_state[admission] += 1
            else:
                keyword_admission_state["excluded"] += 1
            level = str(node.get("keywordLevel") or properties.get("keywordLevel") or "")
            if level in ("L1", "L2"):
                keyword_level_stats[level] += 1
            else:
                keyword_level_stats["unspecified"] += 1
        connected_knowledge_count = sum(1 for node in knowledge_nodes if node.get("id") in connected_node_ids)
        evidence_edges = [edge for edge in edges if edge.get("type") == "CONTEXT_MATCHES_CHUNK"]
        evidence_complete_edges = [
            edge for edge in evidence_edges
            if edge.get("sourceResourceId") and edge.get("chunkId") and edge.get("evidenceText")
        ]
        cross_document_relation_count = 0
        for edge in edges:
            if edge.get("type") == "CONTEXT_MATCHES_CHUNK":
                continue
            source = node_lookup.get(edge.get("source"))
            target = node_lookup.get(edge.get("target"))
            if (
                source
                and target
                and source.get("sourceResourceId")
                and target.get("sourceResourceId")
                and source.get("sourceResourceId") != target.get("sourceResourceId")
            ):
                cross_document_relation_count += 1
        if graph_source is None:
            graph_source = "empty" if not nodes and not edges else "final_knowledge"
        return {
            "graphSchemaVersion": GRAPH_SCHEMA_VERSION,
            "metadataRuleSetHash": self._metadata_rule_set_hash(),
            "nodeCount": len(nodes),
            "edgeCount": len(edges),
            "nodeTypes": node_types,
            "edgeTypes": edge_types,
            "keywordCount": knowledge_count,
            "chunkCount": node_types.get("ProcessingUnit", 0) + node_types.get("Chunk", 0),
            "contextEdgeCount": edge_types.get("CONTEXT_MATCHES_CHUNK", 0),
            "graphSource": graph_source,
            "knowledgeBuildMode": "formal_knowledge" if graph_source == "final_knowledge" else "keyword_analysis",
            "keywordApprovalState": keyword_approval_state,
            "keywordBusinessReviewState": keyword_business_state,
            "keywordAdmissionState": keyword_admission_state,
            "keywordLevelStats": keyword_level_stats,
            "formalKnowledgeDatasetId": None,
            "entityRelationStage": self._entity_relation_stage_summary(),
            "displayMode": "keyword_overview" if graph_source in {"metadata_keyword", "model_keyword", "final_knowledge"} else "empty",
            "qualityIssueCount": len(issues),
            "knowledgeDomainCounts": knowledge_domain_counts,
            "ontologyTypeCounts": ontology_type_counts,
            "taskContextCounts": task_context_counts,
            "relationCoverage": round(connected_knowledge_count / knowledge_count, 4) if knowledge_count else 0,
            "isolatedKnowledgeRatio": round((knowledge_count - connected_knowledge_count) / knowledge_count, 4) if knowledge_count else 0,
            "whyMissingRate": round(1 - (knowledge_domain_counts["why"] / knowledge_count), 4) if knowledge_count else 0,
            "evidenceCompleteness": round(len(evidence_complete_edges) / len(evidence_edges), 4) if evidence_edges else 0,
            "crossDocumentRelationCount": cross_document_relation_count,
        }
