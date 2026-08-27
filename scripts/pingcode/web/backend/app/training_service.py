from __future__ import annotations

import hashlib
import json
import re
import shutil
import threading
import queue
import time
import uuid
from copy import deepcopy
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from math import ceil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.request import urlopen

from jsonschema import ValidationError, validate

from .agents import KnowledgeExtractionWorkflowAgent, AgentTask
from .config import runtime_profile, settings
from .gateways.model_gateway import (
    HttpModelGatewayAdapter,
    ModelGateway,
    ModelGatewayError,
    error_summary,
)
from .markdown_cleaning import clean_markdown
from .keyword_issue_insight_service import KeywordIssueInsightService
from .models import DatasetVersion, GovernanceStatus, PreprocessTaskCreate, ScanReport, TaskSnapshot, TrainingReviewDecision, TrainingTaskCreate
from .governance_state import initial_gate_checks
from .processing_units import build_processing_units
from .repositories import (
    ArtifactRepository,
    KeywordFilterRunImmutableSnapshotError,
    KeywordFilterRunRepository,
    LocalArtifactRepository,
    LocalKeywordFilterRunRepository,
)
from .repositories.artifact_repository import ArtifactIntegrityError, ArtifactRecordDecodeError
from .batch_operation_coordinator import BatchOperationCoordinator
from .graph_exploration_service import GraphExplorationService
from .graph_observability_service import GraphObservabilityService
from .production_lineage import (
    CommittedRebuildInputRef,
    FORMAL_MODE,
    GovernancePackageRepository,
    KEYWORD_MODE,
    KeywordRebuildInputFreezer,
    KeywordRuleRebuild,
    KeywordRuleSnapshot,
    ProductionLineageAdapter,
    ProductionLineageError,
)

TERMINAL_STATES = {"completed", "failed", "cancelled"}
STAGES = [
    "material_preparation",
    "metadata_construction",
    "knowledge_extraction",
    "index_generation",
]
STAGE_NAMES = {
    "material_preparation": "资料预处理",
    "metadata_construction": "元数据构建",
    "knowledge_extraction": "知识提取",
    "index_generation": "索引生成",
}
STAGE_ALIASES = {
    # 兼容历史运行日志和内部子步骤；新运行公开状态只写 STAGES 中的四个阶段。
    "semantic_enrichment": "knowledge_extraction",
    "deterministic_extraction": "knowledge_extraction",
    "validation_graph": "knowledge_extraction",
    "dataset_generation": "index_generation",
}
DEFAULT_MAX_DIRECT_CHARACTERS = 12000
MAX_METADATA_GRAPH_KEYWORDS_PER_CHUNK = 12
GRAPH_SCHEMA_VERSION = 4
DISPLAY_NAME_PREFIX_PATTERN = re.compile(r"^[0-9a-fA-F]{8,24}-")
TECHNICAL_KEYWORD_PREFIXES = ("dataset_", "file_", "chunk_", "resource_", "document_", "task_", "batch_", "run_", "node_", "edge_", "unit_")

DETERMINISTIC_TECHNICAL_TERMS = (
    "索引", "表空间", "数据字典", "事务", "死锁", "主备复制", "大对象",
    "存储过程", "触发器", "游标", "视图", "序列", "分区", "集群",
    "归档", "备份", "恢复", "优化器", "执行计划", "统计信息",
    "权限", "角色", "用户", "模式", "约束", "函数", "包", "类型", "对象", "锁", "缓存",
)

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


class ModelTestRequiredError(RuntimeError):
    pass


class TrainingCancelledError(RuntimeError):
    pass


class KeywordFilterIncompleteError(ValueError):
    """过滤决策未覆盖全部候选关键词，禁止应用。"""


class KeywordFilterSourceChangedError(ValueError):
    """过滤运行的候选快照已与当前关键词图谱不一致。"""


class KeywordFilterReviewInvalidError(ValueError):
    """人工复核决策不满足动作、类别或备注不变量。"""


class KeywordFilterReviewUnavailableError(ValueError):
    """历史运行缺少可验证的冻结类别字典。"""


class RebuildSourceError(ValueError):
    """Synchronous API-A source dataset admission failure."""

    def __init__(self, code: str, message: str, *, retryable: bool = False):
        super().__init__(message)
        self.code = code
        self.retryable = retryable


class ModelGatewayClient(HttpModelGatewayAdapter):
    """兼容旧测试补丁点；HTTP 实现由 HttpModelGatewayAdapter 提供。"""

    def __init__(self, base_url: str, token: str = "", timeout: int = 180):
        super().__init__(base_url, token, timeout, opener=lambda *args, **kwargs: urlopen(*args, **kwargs))


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
        gateway: ModelGateway | None = None,
        *,
        artifact_repository: ArtifactRepository | None = None,
        coordinator: BatchOperationCoordinator | None = None,
        keyword_filter_run_repository: KeywordFilterRunRepository | None = None,
        file_service: Any | None = None,
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
        self.artifacts = artifact_repository or LocalArtifactRepository()
        self.coordinator = coordinator or BatchOperationCoordinator(settings.data_root, self.artifacts)
        self.keyword_filter_runs = (
            keyword_filter_run_repository
            or LocalKeywordFilterRunRepository(settings.data_root)
        )
        self.keyword_issue_insights = KeywordIssueInsightService(settings.data_root)
        self.graph_observability_service = GraphObservabilityService(
            self, Path(__file__).resolve().parents[3] / "config" / "graph-observability-rules.json"
        )
        self.graph_exploration_service = GraphExplorationService(self, file_service)
        self._event_lock = threading.RLock()
        self._review_lock = threading.RLock()
        self._model_test_lock = threading.RLock()
        self._model_test_result: dict[str, Any] | None = None
        self._child_task_lock = threading.RLock()
        self._child_tasks: dict[str, str] = {}
        self._active_task_lock = threading.RLock()
        self._active_task_ids: set[str] = set()
        self._reconcile_lock = threading.RLock()
        self._keyword_filter_run_lock = threading.RLock()

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
                "timeoutMs": int(formal_defaults.get("timeoutMs", 120000)),
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
        requires_model = request.mode == "formal_knowledge"
        model = self.model_config() if requires_model else None
        if self.preparation is not None:
            if self.preprocess is not None:
                return self._preflight_lightweight(request, model, requires_model=requires_model)
            return self._preflight_with_material_preparation(request, model, requires_model=requires_model)
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
        total_calls = chunk_count + uncertain_count if requires_model else 0
        last_test = model.get("lastTest") if model else None
        latency = int(last_test.get("latencyMs", 0)) if last_test else 0
        workload_latency = max(latency * 2, 5000) if latency else 0
        estimated_ms = int(workload_latency * ceil(total_calls / 3)) if workload_latency else 0
        risks = []
        if not documents:
            risks.append("当前批次没有可加工的文本文件")
        if requires_model and not last_test:
            risks.append("当前模型尚未通过最近 10 分钟内的真实结构化连接测试")
        if requires_model:
            risks.append(f"正式知识提取预计调用模型 {chunk_count} 次；按需语义补充当前未实现")
        else:
            risks.append("当前阶段仅执行规则提取，不调用模型服务")
        if requires_model and last_test:
            risks.append("预计耗时包含正式知识提取模型调用；流水线调度、预处理、校验和构图由代码执行")
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
            "modelTestPassed": bool(last_test) if requires_model else None,
            "modelTestExpiresAt": last_test.get("expiresAt") if last_test else None,
            "canStart": bool(documents and (last_test if requires_model else True)),
            "risks": risks,
            "createdAt": utcnow().isoformat(),
        }
        self._write_json(
            settings.data_root / "batches" / request.batch_id / "training-preflight" / "latest.json",
            result,
        )
        return result

    def _preflight_lightweight(
        self,
        request: TrainingTaskCreate,
        model: dict[str, Any] | None,
        *,
        requires_model: bool,
    ) -> dict[str, Any]:
        report = None
        try:
            report = self.preprocess.latest_scan_report(request.batch_id)
        except FileNotFoundError:
            pass
        if report is not None:
            document_count = report.processable_count
            estimated_chunks = report.estimated_processing_unit_count
            direct_count = report.direct_text_count
            convertible_count = report.convertible_count
            ocr_required = report.ocr_required_count
            conversion_failed = report.conversion_failed_count
            unsupported = report.unsupported_count
            scan_source = "latest_scan_report"
        else:
            documents = self.preprocess.files.list_processing_sources(request.batch_id)
            document_count = len(documents)
            estimated_chunks = document_count
            direct_count = sum(1 for item in documents if item.processing_status == "direct_text")
            convertible_count = sum(1 for item in documents if item.processing_status == "convertible")
            ocr_required = 0
            conversion_failed = 0
            unsupported = 0
            scan_source = "resource_index"
        last_test = model.get("lastTest") if model else None
        risks = []
        if report is None:
            risks.append("当前尚无源文件检查报告，将按资源清单启动；任务内会执行正式资料检查")
        if not document_count:
            risks.append("当前批次没有可加工的源文件")
        if requires_model and not last_test:
            risks.append("当前模型尚未通过最近 10 分钟内的真实结构化连接测试")
        if not requires_model:
            risks.append("当前阶段仅执行规则提取，不调用模型服务")
        config = request.config.model_dump(mode="json", by_alias=True)
        input_hash = "sha256:" + hashlib.sha256(json.dumps({
            "batchId": request.batch_id,
            "config": config,
            "documentCount": document_count,
            "estimatedChunkCount": estimated_chunks,
            "scanSource": scan_source,
        }, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()
        result = {
            "preflightId": f"preflight_{uuid.uuid4().hex[:16]}",
            "batchId": request.batch_id,
            "documentCount": document_count,
            "processableCount": document_count,
            "directTextCount": direct_count,
            "convertibleCount": convertible_count,
            "ocrRequiredCount": ocr_required,
            "conversionFailedCount": conversion_failed,
            "unsupportedCount": unsupported,
            "estimatedChunkCount": estimated_chunks,
            "largestDocumentCharacters": 0,
            "largestUnitCharacters": 0,
            "config": config,
            "configSource": "service_default",
            "preflightSource": scan_source,
            "inputHash": input_hash,
            "semanticUncertainItems": 0,
            "totalModelCalls": 0,
            "estimatedDurationMs": None,
            "modelTestPassed": bool(last_test) if requires_model else None,
            "modelTestExpiresAt": last_test.get("expiresAt") if last_test else None,
            "canStart": bool(document_count and (last_test if requires_model else True)),
            "risks": risks,
            "createdAt": utcnow().isoformat(),
        }
        self._write_json(
            settings.data_root / "batches" / request.batch_id / "training-preflight" / "latest.json",
            result,
        )
        return result

    def _preflight_with_material_preparation(
        self,
        request: TrainingTaskCreate,
        model: dict[str, Any] | None,
        *,
        requires_model: bool = True,
    ) -> dict[str, Any]:
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
        total_calls = chunk_count + uncertain_count if requires_model else 0
        last_test = model.get("lastTest") if model else None
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
        if requires_model and not last_test:
            risks.append("当前模型尚未通过最近 10 分钟内的真实结构化连接测试")
        if ocr_required:
            risks.append(f"{ocr_required} 个 PDF 需要 OCR，当前不会进入知识加工")
        if conversion_failed:
            risks.append(f"{conversion_failed} 个文件转换失败，需查看源文件检查中的转换问题")
        if requires_model:
            risks.append(f"正式知识提取预计调用模型 {chunk_count} 次；按需语义补充当前未实现")
        else:
            risks.append("当前阶段仅执行规则提取，不调用模型服务")
        if requires_model and last_test:
            risks.append("预计耗时包含资料转换和正式知识提取模型调用；流水线调度、预处理、校验和构图由代码执行")
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
            "modelTestPassed": bool(last_test) if requires_model else None,
            "modelTestExpiresAt": last_test.get("expiresAt") if last_test else None,
            "canStart": bool(source_documents and (last_test if requires_model else True)),
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
        if self.batches.get(request.batch_id).state == "failed":
            self._restore_material_state(request.batch_id)
        if request.mode == "formal_knowledge":
            self.require_model_test()
        with self.coordinator.admission(request.batch_id):
            batch = self._require_batch_ready(request.batch_id)
            if request.mode == "keyword_analysis" and request.source_dataset_id:
                self._validate_keyword_rebuild_source(request, batch)
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
        tasks = self.tasks.list(batch_id) if self.tasks is not None else []
        resumable_download_ids = {
            task.id for task in tasks if self._is_resumable_partial_download(task)
        }
        active_task_ids = list(
            getattr(batch, "active_task_ids", None)
            or getattr(batch, "activeTaskIds", None)
            or []
        )
        for task in tasks:
            if task.type == "download" and task.state != "completed" and task.id not in resumable_download_ids:
                raise ValueError("资料下载尚未完成，不能启动知识加工")
        allowed_states = {"uploaded", "downloaded", "ready"}
        has_resumable_partial_download = bool(resumable_download_ids)
        if batch.state not in allowed_states and not (
            batch.state == "downloading" and has_resumable_partial_download
        ):
            raise ValueError("资料下载尚未完成，不能启动知识加工")
        if any(task_id not in resumable_download_ids for task_id in active_task_ids):
            raise ValueError("当前资料加工任务仍有执行任务在运行，不能启动知识加工")
        return batch

    def _validate_keyword_rebuild_source(self, request: TrainingTaskCreate, batch: Any) -> Any:
        """Perform only cheap source admission checks before creating a task."""
        try:
            dataset = next(
                item
                # Resolve globally first so an existing dataset from another
                # batch is classified as a mismatch rather than as missing.
                for item in self.preprocess.list_datasets()
                if item.id == request.source_dataset_id
            )
        except StopIteration as exc:
            raise RebuildSourceError(
                "REBUILD_SOURCE_NOT_FOUND", "指定的源数据集不存在"
            ) from exc
        if dataset.batch_id != batch.id:
            raise RebuildSourceError(
                "REBUILD_SOURCE_MISMATCH", "源数据集不属于当前资料批次"
            )
        if dataset.state != "candidate":
            raise RebuildSourceError(
                "REBUILD_SOURCE_STATE_INVALID", "源数据集不是可重建的 candidate 版本"
            )
        return dataset

    @staticmethod
    def _is_resumable_partial_download(task: TaskSnapshot) -> bool:
        """已下载部分资料的中断下载只保留告警，不阻断规则加工。"""
        return bool(
            task.type == "download"
            and task.state == "interrupted"
            and task.can_resume
            and task.completed > 0
        )

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

    def _restore_material_state(self, batch_id: str):
        """Training state must not permanently poison the material lifecycle."""
        batch = self.batches.get(batch_id)
        tasks = self.tasks.list(batch_id) if self.tasks is not None else []
        active = [task.id for task in tasks if task.state in {"queued", "running", "cancelling"}]
        downloads = [task for task in tasks if task.type == "download"]
        partial = any(self._is_resumable_partial_download(task) for task in downloads)
        completed = any(task.state == "completed" for task in downloads)
        if active:
            self.batches.update(batch_id, activeTaskIds=active)
        elif partial:
            self.batches.update(batch_id, state="downloading", activeTaskIds=[])
        elif completed:
            self.batches.update(batch_id, state="downloaded", activeTaskIds=[])
        else:
            self.batches.update(batch_id, activeTaskIds=[])

    def admission(self, batch_id: str) -> dict[str, Any]:
        self._reconcile_if_needed()
        if self.batches.get(batch_id).state == "failed":
            self._restore_material_state(batch_id)
        batch = self._require_batch_ready(batch_id)
        return {
            "batchId": batch_id,
            "canStart": True,
            "admissionStatus": "partial_download" if batch.state == "downloading" else "ready",
            "blockingReason": None,
        }

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
            try:
                nodes = json.loads((graph_dir / "nodes.json").read_text(encoding="utf-8"))
                edges = json.loads((graph_dir / "edges.json").read_text(encoding="utf-8"))
                visible_nodes, visible_edges = self._graph_projection(nodes, edges)
                graph_source = str(summary.get("graphSource") or "") or None
                enriched = self._graph_summary(visible_nodes, visible_edges, [], graph_source)
                return {
                    **summary,
                    **enriched,
                    "keywordFilterState": self._keyword_filter_state(nodes),
                }
            except (OSError, json.JSONDecodeError):
                return summary
        path = graph_dir / f"{kind}.json"
        if not path.exists():
            raise FileNotFoundError(dataset_id)
        value = json.loads(path.read_text(encoding="utf-8"))
        if kind in {"nodes", "edges"} and isinstance(value, list):
            nodes = value if kind == "nodes" else json.loads((graph_dir / "nodes.json").read_text(encoding="utf-8"))
            edges = value if kind == "edges" else json.loads((graph_dir / "edges.json").read_text(encoding="utf-8"))
            visible_nodes, visible_edges = self._graph_projection(nodes, edges)
            if kind == "nodes":
                return self._with_graph_display_names(visible_nodes)
            return visible_edges
        return value

    def _graph_projection(
        self,
        nodes: list[dict[str, Any]],
        edges: list[dict[str, Any]],
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        node_by_id = {
            str(node.get("id")): node
            for node in nodes
            if node.get("id")
        }
        visible_ids = {
            node_id
            for node_id, node in node_by_id.items()
            if node.get("type") == "Keyword" and self._read_admission_status(node) == "admitted"
        }
        for edge in edges:
            source_id = str(edge.get("source") or "")
            target_id = str(edge.get("target") or "")
            source_node = node_by_id.get(source_id)
            target_node = node_by_id.get(target_id)
            if source_id in visible_ids and target_node and target_node.get("type") in {"ProcessingUnit", "Chunk"}:
                visible_ids.add(target_id)
            elif target_id in visible_ids and source_node and source_node.get("type") in {"ProcessingUnit", "Chunk"}:
                visible_ids.add(source_id)
        visible_nodes = [node for node in nodes if str(node.get("id")) in visible_ids]
        visible_edges = [
            edge for edge in edges
            if str(edge.get("source")) in visible_ids and str(edge.get("target")) in visible_ids
        ]
        return visible_nodes, visible_edges

    def _keyword_filter_state(self, nodes: list[dict[str, Any]]) -> dict[str, int]:
        keyword_nodes = [node for node in nodes if node.get("type") == "Keyword"]
        retained = sum(1 for node in keyword_nodes if self._read_admission_status(node) == "admitted")
        excluded = len(keyword_nodes) - retained
        return {
            "beforeTotal": len(keyword_nodes),
            "afterTotal": retained,
            "retained": retained,
            "excluded": excluded,
        }

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

    def graph_observability(self, dataset_id: str, filter_run_id: str | None = None, view: str = "after") -> dict[str, Any]:
        return self.graph_observability_service.observability(dataset_id, filter_run_id, view)

    def graph_bounded_neighborhood(self, dataset_id: str, node_id: str, limit: int = 80, depth: int = 1) -> dict[str, Any]:
        return self.graph_observability_service.bounded_neighborhood(dataset_id, node_id, limit, depth)

    def graph_search(self, dataset_id: str, **params) -> dict[str, Any]:
        return self.graph_exploration_service.search(dataset_id, **params)

    def graph_explore(self, dataset_id: str, **params) -> dict[str, Any]:
        return self.graph_exploration_service.explore(dataset_id, **params)

    def graph_evidence(self, dataset_id: str, **params) -> dict[str, Any]:
        return self.graph_exploration_service.evidence(dataset_id, **params)

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

    @staticmethod
    def _keyword_filter_resource_paths() -> tuple[Path, Path]:
        repo_root = Path(__file__).resolve().parents[5]
        return (
            repo_root / "skills" / "keyword-filter" / "SKILL.md",
            repo_root / "config" / "filter-rules.json",
        )

    @staticmethod
    def _read_keyword_filter_issue_categories(rules_path: Path) -> list[dict[str, str]]:
        try:
            payload = json.loads(rules_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise KeywordFilterReviewUnavailableError("过滤规则类别字典无法读取") from exc
        categories = payload.get("issueCategories") if isinstance(payload, dict) else None
        if not isinstance(categories, list):
            raise KeywordFilterReviewUnavailableError("过滤规则缺少问题类别字典")
        normalized = [
            {"id": str(item.get("id")), "label": str(item.get("label") or item.get("id"))}
            for item in categories
            if isinstance(item, dict) and item.get("id")
        ]
        if not normalized or len({item["id"] for item in normalized}) != len(normalized):
            raise KeywordFilterReviewUnavailableError("过滤规则问题类别字典无效")
        return normalized

    def _run_issue_categories(self, run: dict[str, Any]) -> list[dict[str, str]]:
        frozen = run.get("issueCategories")
        if isinstance(frozen, list) and frozen:
            normalized = [
                {"id": str(item.get("id")), "label": str(item.get("label") or item.get("id"))}
                for item in frozen
                if isinstance(item, dict) and item.get("id")
            ]
            if len(normalized) == len(frozen) and len({item["id"] for item in normalized}) == len(normalized):
                return normalized
            raise KeywordFilterReviewUnavailableError("运行冻结问题类别字典无效")
        _, rules_path = self._keyword_filter_resource_paths()
        if (
            rules_path.is_file()
            and run.get("rulesVersion") == self.keyword_filter_runs.fingerprint_file(rules_path)
        ):
            return self._read_keyword_filter_issue_categories(rules_path)
        raise KeywordFilterReviewUnavailableError(
            "历史运行未冻结问题类别，且其规则版本与当前配置不一致，无法安全复核"
        )

    def _keyword_filter_candidates(self, dataset_id: str) -> list[dict[str, Any]]:
        dataset = self.ensure_dataset_graph(dataset_id)
        nodes_path = self._run_dir(dataset.training_task_id) / "graph/nodes.json"
        if not nodes_path.is_file():
            nodes_path = settings.data_root / "datasets" / dataset.id / "graph/nodes.json"
        if not nodes_path.is_file():
            raise FileNotFoundError(dataset_id)
        nodes = json.loads(nodes_path.read_text(encoding="utf-8"))
        candidates: list[dict[str, Any]] = []
        for node in nodes:
            if node.get("type") != "Keyword":
                continue
            keyword_id = str(node.get("keywordId") or node.get("id") or "")
            if not keyword_id:
                continue
            candidates.append({
                "keywordId": keyword_id,
                "keywordName": node.get("canonicalName") or node.get("name") or "",
                "keywordRawName": node.get("name") or node.get("canonicalName") or "",
                "aliases": list(node.get("aliases") or []),
                "evidenceRefs": sorted({
                    str(value)
                    for field in ("evidenceRefs", "chunkIds", "resourceIds", "documentIds")
                    for value in (node.get(field) or [])
                    if value
                }),
                "currentStatus": self._read_admission_status(node),
            })
        candidates.sort(key=lambda item: item["keywordId"])
        return candidates

    @staticmethod
    def _keyword_filter_model_context(gateway: ModelGateway | None) -> tuple[str | None, str | None]:
        if gateway is None:
            return None, None
        try:
            status = gateway.status()
        except Exception:
            return None, None
        if not isinstance(status, dict):
            return None, None
        provider = status.get("provider")
        model = status.get("model")
        return (
            str(provider) if provider else None,
            str(model) if model else None,
        )

    @staticmethod
    def _new_keyword_filter_run_id() -> str:
        return "kfr_" + uuid.uuid4().hex

    def create_keyword_filter_run(self, dataset_id: str) -> dict[str, Any]:
        self.ensure_dataset_graph(dataset_id)
        candidates = self._keyword_filter_candidates(dataset_id)
        skill_path, rules_path = self._keyword_filter_resource_paths()
        if not skill_path.is_file() or not rules_path.is_file():
            raise FileNotFoundError("keyword-filter Skill 或过滤规则不存在")
        issue_categories = self._read_keyword_filter_issue_categories(rules_path)
        provider, model = self._keyword_filter_model_context(self.gateway)
        filter_run_id = self._new_keyword_filter_run_id()
        run = self.keyword_filter_runs.create_run(
            dataset_id,
            filter_run_id,
            {
                "filterRunId": filter_run_id,
                "datasetId": dataset_id,
                "status": "created",
                "schemaVersion": "1.0",
                "revision": 0,
                "createdAt": utcnow().isoformat(),
                "completedAt": None,
                "appliedAt": None,
                "candidateTotal": len(candidates),
                "decisionTotal": 0,
                "pendingTotal": len(candidates),
                "suggestedKeep": 0,
                "suggestedExclude": 0,
                "finalKeep": None,
                "finalExclude": None,
                "skillVersion": self.keyword_filter_runs.fingerprint_file(skill_path),
                "rulesVersion": self.keyword_filter_runs.fingerprint_file(rules_path),
                "issueCategories": issue_categories,
                "sourceGraphVersion": self.keyword_filter_runs.fingerprint_candidates(candidates),
                "modelProvider": provider,
                "modelName": model,
                "failedBatches": [],
            },
            candidates,
        )
        return {"filterRunId": filter_run_id, "run": run}

    def list_keyword_filter_runs(
        self, dataset_id: str, *, offset: int = 0, limit: int = 20
    ) -> dict[str, Any]:
        self.ensure_dataset_graph(dataset_id)
        return self.keyword_filter_runs.list_runs(dataset_id, offset=offset, limit=limit)

    def get_keyword_filter_run(self, dataset_id: str, filter_run_id: str) -> dict[str, Any]:
        run = self.keyword_filter_runs.read_run(dataset_id, filter_run_id)
        candidates = self.keyword_filter_runs.read_candidate_snapshot(dataset_id, filter_run_id)
        model_decisions = self.keyword_filter_runs.read_model_decisions(dataset_id, filter_run_id) or []
        review_decisions = self.keyword_filter_runs.read_review_decisions(dataset_id, filter_run_id)
        final_decisions = self.keyword_filter_runs.read_final_decisions(dataset_id, filter_run_id) or []
        return {
            "run": run,
            **run,
            "candidates": candidates,
            "decisions": model_decisions,
            "modelDecisions": model_decisions,
            "reviewDecisions": review_decisions,
            "finalDecisions": final_decisions,
            "events": self.keyword_filter_runs.read_events(dataset_id, filter_run_id),
        }

    @staticmethod
    def _model_snapshot_decision(
        candidate: dict[str, Any], decision: dict[str, Any]
    ) -> dict[str, Any]:
        excluded = bool(decision.get("shouldExclude", False))
        return {
            "keywordId": candidate["keywordId"],
            "keywordName": candidate.get("keywordName") or "",
            "keywordRawName": candidate.get("keywordRawName") or "",
            "aliases": list(candidate.get("aliases") or []),
            "evidenceRefs": list(candidate.get("evidenceRefs") or []),
            "modelAction": "exclude" if excluded else "keep",
            "modelIssueCategory": decision.get("issueCategory") if excluded else None,
            "modelIssueCategoryLabel": decision.get("issueCategoryLabel") if excluded else "无",
            "modelReason": decision.get("reason") or "",
            "finalAction": None,
            "finalIssueCategory": None,
            "userOverride": False,
        }

    @staticmethod
    def _keyword_filter_decision_event(
        decision: dict[str, Any], index: int, total: int, batch: int, batch_total: int
    ) -> str:
        excluded = decision.get("modelAction") == "exclude"
        payload = {
            "index": index,
            "total": total,
            "keywordId": decision.get("keywordId"),
            "keywordName": decision.get("keywordName"),
            "keywordRawName": decision.get("keywordRawName"),
            "aliases": decision.get("aliases") or [],
            "shouldExclude": excluded,
            "issueCategory": decision.get("modelIssueCategory"),
            "issueCategoryLabel": decision.get("modelIssueCategoryLabel"),
            "reason": decision.get("modelReason"),
            "batch": batch,
            "batchTotal": batch_total,
        }
        return f"event: decision\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"

    def stream_keyword_filter_run(self, dataset_id: str, filter_run_id: str):
        """执行或重放运行。模型执行在生成器内持续到快照落盘，客户端可以后按 ID 恢复。"""
        with self._keyword_filter_run_lock:
            run = self.keyword_filter_runs.read_run(dataset_id, filter_run_id)
            frozen = self.keyword_filter_runs.read_model_decisions(dataset_id, filter_run_id)
            if frozen is not None:
                batches = self._keyword_filter_batches(frozen)
                for index, decision in enumerate(frozen, start=1):
                    batch_index = (index - 1) // max(1, int(getattr(settings, "keyword_filter_batch_size", 50))) + 1
                    yield self._keyword_filter_decision_event(
                        decision, index, len(frozen), batch_index, max(1, len(batches))
                    )
                yield f"event: complete\ndata: {json.dumps({**run, 'replayed': True}, ensure_ascii=False)}\n\n"
                return
            if run["status"] != "created":
                raise ValueError(f"运行状态 {run['status']} 不允许执行")
            run = self.keyword_filter_runs.transition_run(
                dataset_id, filter_run_id, "running", expected_revision=run["revision"]
            )
            candidates = self.keyword_filter_runs.read_candidate_snapshot(dataset_id, filter_run_id)
            model_input = [
                {
                    "id": item["keywordId"],
                    "name": item.get("keywordName"),
                    "rawName": item.get("keywordRawName"),
                    "aliases": item.get("aliases") or [],
                    "currentStatus": item.get("currentStatus"),
                }
                for item in candidates
            ]
            system_prompt, prefix = self._keyword_filter_prompt()
            batches = self._keyword_filter_batches(model_input)
            decisions: list[dict[str, Any]] = []
            failed_batches: list[dict[str, Any]] = []
            yield f"event: stage\ndata: {json.dumps({'stage': 'calling_model', 'total': len(candidates), 'batchTotal': len(batches)}, ensure_ascii=False)}\n\n"
            candidate_map = {item["keywordId"]: item for item in candidates}
            for batch_index, batch in enumerate(batches, start=1):
                try:
                    batch_decisions = self._filter_batch_chat(batch, system_prompt, prefix)
                    for raw in batch_decisions:
                        candidate = candidate_map[str(raw.get("keywordId"))]
                        snapshot = self._model_snapshot_decision(candidate, raw)
                        decisions.append(snapshot)
                        yield self._keyword_filter_decision_event(
                            snapshot, len(decisions), len(candidates), batch_index, len(batches)
                        )
                except Exception as exc:
                    failed_batches.append({
                        "batch": batch_index,
                        "count": len(batch),
                        "error": str(exc),
                    })
            keep = sum(1 for item in decisions if item["modelAction"] == "keep")
            exclude = len(decisions) - keep
            updates = {
                "decisionTotal": len(decisions),
                "pendingTotal": len(candidates) - len(decisions),
                "suggestedKeep": keep,
                "suggestedExclude": exclude,
                "failedBatches": failed_batches,
            }
            run = self.keyword_filter_runs.write_model_decisions(
                dataset_id,
                filter_run_id,
                decisions,
                expected_revision=run["revision"],
                run_updates=updates,
            )
            complete = not failed_batches and len(decisions) == len(candidates)
            run = self.keyword_filter_runs.transition_run(
                dataset_id,
                filter_run_id,
                "reviewable" if complete else "incomplete",
                expected_revision=run["revision"],
                updates={"completedAt": utcnow().isoformat()},
            )
            yield f"event: complete\ndata: {json.dumps(run, ensure_ascii=False)}\n\n"

    @staticmethod
    def _effective_filter_decisions(
        model_decisions: list[dict[str, Any]], review_decisions: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        review_map = {
            str(item.get("keywordId")): item
            for item in review_decisions
            if isinstance(item, dict) and item.get("keywordId")
        }
        effective: list[dict[str, Any]] = []
        for model in model_decisions:
            review = review_map.get(str(model.get("keywordId")), {})
            action = review.get("reviewAction") or model.get("modelAction")
            category = (
                review.get("reviewIssueCategory")
                if review
                else model.get("modelIssueCategory")
            )
            effective.append({
                **model,
                "action": action,
                "issueCategory": category if action == "exclude" else None,
                "reason": review.get("reviewNote") or model.get("modelReason") or "",
                "reviewNote": review.get("reviewNote") or "",
                "reviewedAt": review.get("reviewedAt"),
                "reviewedBy": review.get("reviewedBy"),
                "finalAction": action,
                "finalIssueCategory": category if action == "exclude" else None,
                "userOverride": bool(review) and (
                    action != model.get("modelAction")
                    or category != model.get("modelIssueCategory")
                ),
            })
        return effective

    @staticmethod
    def _keyword_filter_review_summary(
        model_decisions: list[dict[str, Any]],
        review_decisions: list[dict[str, Any]],
        valid_categories: set[str],
    ) -> dict[str, Any]:
        effective = TrainingService._effective_filter_decisions(model_decisions, review_decisions)
        model_keep = sum(1 for item in model_decisions if item.get("modelAction") == "keep")
        model_exclude = len(model_decisions) - model_keep
        changed_to_keep = sum(
            1 for item in effective
            if item.get("modelAction") == "exclude" and item.get("action") == "keep"
        )
        changed_to_exclude = sum(
            1 for item in effective
            if item.get("modelAction") == "keep" and item.get("action") == "exclude"
        )
        category_changed = sum(
            1 for item in effective
            if item.get("action") == "exclude"
            and item.get("modelAction") == "exclude"
            and item.get("issueCategory") != item.get("modelIssueCategory")
        )
        invalid = [
            item for item in effective
            if item.get("action") not in {"keep", "exclude"}
            or (item.get("action") == "keep" and item.get("issueCategory") is not None)
            or (item.get("action") == "exclude" and item.get("issueCategory") not in valid_categories)
        ]
        final_keep = sum(1 for item in effective if item.get("action") == "keep")
        final_exclude = sum(1 for item in effective if item.get("action") == "exclude")
        excluded_by_category: dict[str, int] = {}
        for item in effective:
            if item.get("action") != "exclude" or item.get("issueCategory") not in valid_categories:
                continue
            category = str(item["issueCategory"])
            excluded_by_category[category] = excluded_by_category.get(category, 0) + 1
        unreviewed_other = sum(
            1 for item in effective
            if item.get("action") == "exclude"
            and item.get("issueCategory") == "other"
            and not str(item.get("reviewNote") or "").strip()
        )
        return {
            "candidateTotal": len(model_decisions),
            "modelKeep": model_keep,
            "modelExclude": model_exclude,
            "changedToKeep": changed_to_keep,
            "changedToExclude": changed_to_exclude,
            "categoryChanged": category_changed,
            "finalKeep": final_keep,
            "finalExclude": final_exclude,
            "invalidDecisionCount": len(invalid),
            "unreviewedOtherCount": unreviewed_other,
            "excludedByCategory": excluded_by_category,
        }

    def get_keyword_filter_review_summary(
        self, dataset_id: str, filter_run_id: str
    ) -> dict[str, Any]:
        run = self.keyword_filter_runs.read_run(dataset_id, filter_run_id)
        categories = self._run_issue_categories(run)
        model = self.keyword_filter_runs.read_model_decisions(dataset_id, filter_run_id) or []
        review = self.keyword_filter_runs.read_review_decisions(dataset_id, filter_run_id)
        summary = self._keyword_filter_review_summary(
            model, review, {item["id"] for item in categories}
        )
        return {"filterRunId": filter_run_id, "revision": run["revision"], "summary": summary, **summary}

    def _keyword_issue_decisions(
        self, dataset_id: str, filter_run_id: str
    ) -> tuple[dict[str, Any], list[dict[str, Any]], str, bool, Path]:
        run = self.keyword_filter_runs.read_run(dataset_id, filter_run_id)
        final = self.keyword_filter_runs.read_final_decisions(dataset_id, filter_run_id)
        if final is not None:
            decisions = final
            basis = "final"
        else:
            model = self.keyword_filter_runs.read_model_decisions(dataset_id, filter_run_id)
            if model is None:
                raise KeywordFilterReviewUnavailableError("过滤运行尚未生成模型决策，无法查看问题洞察")
            review = self.keyword_filter_runs.read_review_decisions(dataset_id, filter_run_id)
            decisions = self._effective_filter_decisions(model, review)
            basis = "review" if review else "model"
        dataset = self.ensure_dataset_graph(dataset_id)
        graph_root = self._run_dir(dataset.training_task_id)
        current_candidates = self._keyword_filter_candidates(dataset_id)
        source_available = (
            self.keyword_filter_runs.fingerprint_candidates(current_candidates)
            == run.get("sourceGraphVersion")
        )
        return run, decisions, basis, source_available, graph_root

    def keyword_issue_overview(
        self, dataset_id: str, filter_run_id: str, *, allow_cache_write: bool = True
    ) -> dict[str, Any]:
        run, decisions, basis, source_available, graph_root = self._keyword_issue_decisions(
            dataset_id, filter_run_id
        )
        return self.keyword_issue_insights.build_overview(
            dataset_id=dataset_id,
            filter_run_id=filter_run_id,
            decisions=decisions,
            categories=self._run_issue_categories(run),
            decision_basis=basis,
            source_available=source_available,
            allow_cache_write=allow_cache_write,
            graph_root=graph_root,
        )

    def keyword_issue_evidence(
        self,
        dataset_id: str,
        filter_run_id: str,
        *,
        category: str | None = None,
        keyword_id: str | None = None,
        resource_id: str | None = None,
        query: str | None = None,
        missing_evidence: bool = False,
        page: int = 1,
        page_size: int = 50,
        allow_cache_write: bool = True,
    ) -> dict[str, Any]:
        run, decisions, basis, source_available, graph_root = self._keyword_issue_decisions(
            dataset_id, filter_run_id
        )
        if category:
            valid_categories = {item["id"] for item in self._run_issue_categories(run)}
            if category not in valid_categories:
                raise ValueError(f"未知问题类别：{category}")
        return self.keyword_issue_insights.query_evidence(
            dataset_id=dataset_id,
            filter_run_id=filter_run_id,
            decisions=decisions,
            decision_basis=basis,
            source_available=source_available,
            category=category,
            keyword_id=keyword_id,
            resource_id=resource_id,
            query=query,
            missing_evidence=missing_evidence,
            page=page,
            page_size=page_size,
            allow_cache_write=allow_cache_write,
            graph_root=graph_root,
        )

    def save_keyword_filter_review_decisions(
        self,
        dataset_id: str,
        filter_run_id: str,
        *,
        expected_revision: int,
        changes: list[dict[str, Any]],
    ) -> dict[str, Any]:
        with self._keyword_filter_run_lock:
            run = self.keyword_filter_runs.read_run(dataset_id, filter_run_id)
            if run["status"] == "applied":
                raise KeywordFilterRunImmutableSnapshotError("已应用运行不可复核")
            if run["status"] != "reviewable":
                raise KeywordFilterReviewInvalidError(f"运行状态 {run['status']} 不允许复核")
            if not isinstance(changes, list) or not changes:
                raise KeywordFilterReviewInvalidError("复核变更列表不能为空")
            categories = self._run_issue_categories(run)
            valid_categories = {item["id"] for item in categories}
            model = self.keyword_filter_runs.read_model_decisions(dataset_id, filter_run_id) or []
            model_map = {str(item.get("keywordId")): item for item in model}
            current = self.keyword_filter_runs.read_review_decisions(dataset_id, filter_run_id)
            current_map = {str(item.get("keywordId")): item for item in current if item.get("keywordId")}
            normalized_changes: list[dict[str, Any]] = []
            audit_changes: list[dict[str, Any]] = []
            seen_keyword_ids: set[str] = set()
            now = utcnow().isoformat()
            for change in changes:
                if not isinstance(change, dict):
                    raise KeywordFilterReviewInvalidError("复核变更项必须为对象")
                keyword_id = str(change.get("keywordId") or "")
                if keyword_id in seen_keyword_ids:
                    raise KeywordFilterReviewInvalidError(f"复核变更包含重复关键词：{keyword_id}")
                seen_keyword_ids.add(keyword_id)
                model_item = model_map.get(keyword_id)
                if model_item is None:
                    raise KeywordFilterReviewInvalidError(f"未知关键词：{keyword_id}")
                action = str(change.get("action") or "")
                if action not in {"keep", "exclude"}:
                    raise KeywordFilterReviewInvalidError(f"关键词 {keyword_id} 动作必须为 keep 或 exclude")
                category = None if action == "keep" else str(change.get("issueCategory") or "")
                if action == "exclude" and category not in valid_categories:
                    raise KeywordFilterReviewInvalidError(f"关键词 {keyword_id} 的排除类别无效")
                raw_note = change.get("note", "")
                if raw_note is not None and not isinstance(raw_note, str):
                    raise KeywordFilterReviewInvalidError(f"关键词 {keyword_id} 的人工备注必须为字符串")
                note = (raw_note or "").strip()
                if len(note) > 500:
                    raise KeywordFilterReviewInvalidError(f"关键词 {keyword_id} 的人工备注不能超过 500 字符")
                if action == "exclude" and category == "other" and not note:
                    raise KeywordFilterReviewInvalidError(f"关键词 {keyword_id} 选择其他/未分类时必须填写人工备注")
                review_item = {
                    "keywordId": keyword_id,
                    "modelAction": model_item.get("modelAction"),
                    "modelIssueCategory": model_item.get("modelIssueCategory"),
                    "modelReason": model_item.get("modelReason") or "",
                    "reviewAction": action,
                    "reviewIssueCategory": category,
                    "reviewNote": note,
                    "reviewedAt": now,
                    "reviewedBy": "anonymous",
                    "userOverride": (
                        action != model_item.get("modelAction")
                        or category != model_item.get("modelIssueCategory")
                    ),
                }
                before = current_map.get(keyword_id)
                current_map[keyword_id] = review_item
                normalized_changes.append(review_item)
                audit_changes.append({"keywordId": keyword_id, "before": before, "after": review_item})
            decisions = [current_map[key] for key in sorted(current_map)]
            summary = self._keyword_filter_review_summary(model, decisions, valid_categories)
            run = self.keyword_filter_runs.write_review_decisions(
                dataset_id,
                filter_run_id,
                decisions,
                expected_revision=expected_revision,
                run_updates={"reviewSummary": summary},
                event={
                    "type": "review-decisions.saved",
                    "actor": "anonymous",
                    "changes": audit_changes,
                },
            )
            return {
                "filterRunId": filter_run_id,
                "revision": run["revision"],
                "changes": normalized_changes,
                "reviewDecisions": decisions,
                "summary": summary,
            }

    def compare_keyword_filter_runs(
        self, dataset_id: str, left_run_id: str, right_run_id: str
    ) -> dict[str, Any]:
        left_run = self.keyword_filter_runs.read_run(dataset_id, left_run_id)
        right_run = self.keyword_filter_runs.read_run(dataset_id, right_run_id)
        allowed = {"reviewable", "applied", "incomplete"}
        if left_run["status"] not in allowed or right_run["status"] not in allowed:
            raise ValueError("只能对比已生成决策的过滤运行")
        left = {
            str(item.get("keywordId")): item
            for item in (self.keyword_filter_runs.read_final_decisions(dataset_id, left_run_id)
                          or self.keyword_filter_runs.read_model_decisions(dataset_id, left_run_id)
                          or [])
        }
        right = {
            str(item.get("keywordId")): item
            for item in (self.keyword_filter_runs.read_final_decisions(dataset_id, right_run_id)
                          or self.keyword_filter_runs.read_model_decisions(dataset_id, right_run_id)
                          or [])
        }
        items: list[dict[str, Any]] = []
        summary = {"added": 0, "removed": 0, "actionChanged": 0, "categoryChanged": 0, "unchanged": 0}
        for keyword_id in sorted(set(left) | set(right)):
            before = left.get(keyword_id)
            after = right.get(keyword_id)
            if before is None:
                change = "added"
            elif after is None:
                change = "removed"
            else:
                before_action = before.get("finalAction") or before.get("modelAction")
                after_action = after.get("finalAction") or after.get("modelAction")
                before_category = before.get("finalIssueCategory") or before.get("modelIssueCategory")
                after_category = after.get("finalIssueCategory") or after.get("modelIssueCategory")
                if before_action != after_action:
                    change = "actionChanged"
                elif before_category != after_category:
                    change = "categoryChanged"
                else:
                    change = "unchanged"
            summary[change] += 1
            if change != "unchanged":
                items.append({"keywordId": keyword_id, "change": change, "left": before, "right": after})
        return {"leftRunId": left_run_id, "rightRunId": right_run_id, "summary": summary, "items": items, "differences": items}

    def apply_keyword_filter_run(
        self, dataset_id: str, filter_run_id: str, *, expected_revision: int
    ) -> dict[str, Any]:
        with self._keyword_filter_run_lock:
            run = self.keyword_filter_runs.read_run(dataset_id, filter_run_id)
            if run["status"] != "reviewable":
                raise ValueError(f"运行状态 {run['status']} 不允许应用")
            if run["revision"] != expected_revision:
                from .repositories import KeywordFilterRunRevisionConflictError
                raise KeywordFilterRunRevisionConflictError(expected_revision, run["revision"])
            current_candidates = self._keyword_filter_candidates(dataset_id)
            current_version = self.keyword_filter_runs.fingerprint_candidates(current_candidates)
            if current_version != run.get("sourceGraphVersion"):
                raise KeywordFilterSourceChangedError("关键词图谱已变化，请重新执行过滤")
            categories = self._run_issue_categories(run)
            valid_categories = {item["id"] for item in categories}
            model = self.keyword_filter_runs.read_model_decisions(dataset_id, filter_run_id) or []
            review = self.keyword_filter_runs.read_review_decisions(dataset_id, filter_run_id)
            final = self._effective_filter_decisions(model, review)
            if len(final) != run["candidateTotal"]:
                raise KeywordFilterIncompleteError("运行决策未覆盖全部候选关键词")
            summary = self._keyword_filter_review_summary(model, review, valid_categories)
            if summary["invalidDecisionCount"]:
                raise KeywordFilterReviewInvalidError("存在动作与排除类别不一致的决策")
            if summary["unreviewedOtherCount"]:
                raise KeywordFilterReviewInvalidError("其他/未分类排除决策必须填写人工备注")
            transaction_id = "kftx_" + uuid.uuid4().hex
            transaction_path = (
                settings.data_root
                / "datasets"
                / dataset_id
                / "keyword-filter-runs"
                / filter_run_id
                / "apply-transaction.json"
            )
            transaction = {
                "transactionId": transaction_id,
                "filterRunId": filter_run_id,
                "datasetId": dataset_id,
                "expectedRevision": expected_revision,
                "status": "prepared",
                "preparedAt": utcnow().isoformat(),
                "sourceGraphVersion": current_version,
                "decisionFingerprint": self.keyword_filter_runs.fingerprint_json(final),
            }
            self._write_json(transaction_path, transaction)
            try:
                applied = self.apply_keywords_filter(dataset_id, final)
                transaction.update({"status": "graph_applied", "graphAppliedAt": utcnow().isoformat()})
                self._write_json(transaction_path, transaction)
            except Exception as exc:
                transaction.update({"status": "failed", "failedAt": utcnow().isoformat(), "error": str(exc)})
                self._write_json(transaction_path, transaction)
                raise
            final_keep = sum(1 for item in final if item["action"] == "keep")
            final_exclude = len(final) - final_keep
            try:
                run = self.keyword_filter_runs.write_final_decisions(
                    dataset_id,
                    filter_run_id,
                    final,
                    expected_revision=run["revision"],
                    run_updates={
                        "finalKeep": final_keep,
                        "finalExclude": final_exclude,
                        "applyTransactionId": transaction_id,
                    },
                )
                run = self.keyword_filter_runs.transition_run(
                    dataset_id,
                    filter_run_id,
                    "applied",
                    expected_revision=run["revision"],
                    updates={"appliedAt": utcnow().isoformat()},
                )
                transaction.update({"status": "committed", "committedAt": utcnow().isoformat(), "revision": run["revision"]})
                self._write_json(transaction_path, transaction)
            except Exception as exc:
                transaction.update({
                    "status": "recovery_required",
                    "failedAt": utcnow().isoformat(),
                    "error": str(exc),
                    "recoveryAction": "freeze_final_snapshot_and_transition_applied",
                })
                self._write_json(transaction_path, transaction)
                raise
            return {"success": True, "run": run, "applied": applied.get("applied"), "summary": applied.get("summary")}

    @staticmethod
    def _keyword_filter_batches(keywords: list[dict[str, Any]]) -> list[list[dict[str, Any]]]:
        size = max(1, int(getattr(settings, "keyword_filter_batch_size", 50)))
        return [keywords[i:i + size] for i in range(0, len(keywords), size)]

    @staticmethod
    def _keyword_filter_prompt() -> tuple[str, str]:
        repo_root = Path(__file__).parent.parent.parent.parent.parent.parent
        skill_path = repo_root / "skills" / "keyword-filter" / "SKILL.md"
        if not skill_path.exists():
            raise FileNotFoundError(f"keyword-filter SKILL.md not found at {skill_path}")
        skill = skill_path.read_text(encoding="utf-8")
        return (skill + "\n\n**重要约束：你必须且只能返回一个纯 JSON 对象，不得包含任何 markdown、表格、解释或代码块标记。直接输出 JSON，以 { 开头，以 } 结尾。**",
                "请分析以下关键词列表，给出过滤建议。\n\n关键词列表：\n")

    @staticmethod
    def _keyword_filter_issue_categories() -> dict[str, str]:
        """读取过滤规则中的问题类别字典，避免前后端分别维护文案。"""
        repo_root = Path(__file__).resolve().parents[5]
        rules_path = repo_root / "config" / "filter-rules.json"
        try:
            payload = json.loads(rules_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            payload = {}
        categories = payload.get("issueCategories", []) if isinstance(payload, dict) else []
        return {
            str(item.get("id")): str(item.get("label") or item.get("id"))
            for item in categories
            if isinstance(item, dict) and item.get("id")
        }

    @classmethod
    def _normalize_keyword_filter_decision(cls, decision: dict[str, Any], category_labels: dict[str, str]) -> dict[str, Any]:
        """归一化类别字段；兼容历史缺失字段，非法类别降级为 other。"""
        normalized = dict(decision)
        excluded = bool(normalized.get("shouldExclude", False))
        category = normalized.get("issueCategory")
        if not excluded:
            normalized["issueCategory"] = None
            normalized["issueCategoryLabel"] = "无"
            return normalized
        category = str(category or "other")
        if category not in category_labels:
            category = "other" if "other" in category_labels else next(iter(category_labels), "other")
        normalized["issueCategory"] = category
        normalized["issueCategoryLabel"] = category_labels.get(category, "未分类")
        return normalized

    @classmethod
    def _validate_keyword_filter_decisions(
        cls,
        batch: list[dict[str, Any]],
        decisions: Any,
        *,
        require_issue_category: bool = False,
    ) -> list[dict[str, Any]]:
        if not isinstance(decisions, list):
            raise ValueError("模型返回的 decisions 不是数组")
        expected = {str(item["id"]) for item in batch}
        actual = [str(item.get("keywordId")) for item in decisions if isinstance(item, dict)]
        if len(actual) != len(set(actual)) or set(actual) != expected:
            raise ValueError("模型返回的关键词决策不完整或包含重复/未知 ID")
        category_labels = cls._keyword_filter_issue_categories()
        if require_issue_category:
            invalid = [
                str(item.get("keywordId") or "")
                for item in decisions
                if isinstance(item, dict)
                and bool(item.get("shouldExclude", False))
                and str(item.get("issueCategory") or "") not in category_labels
            ]
            if invalid:
                raise ValueError(f"模型返回的排除决策缺少 Skill 问题类别或类别非法：{', '.join(invalid[:5])}")
        return [cls._normalize_keyword_filter_decision(item, category_labels)
                for item in decisions if isinstance(item, dict)]

    @staticmethod
    def _excluded_by_category(decisions: list[dict[str, Any]]) -> dict[str, int]:
        counts: dict[str, int] = {}
        for decision in decisions:
            if not bool(decision.get("shouldExclude", False)):
                continue
            category = str(decision.get("issueCategory") or "other")
            counts[category] = counts.get(category, 0) + 1
        return counts

    def _filter_batch_chat(self, batch: list[dict[str, Any]], system_prompt: str, prefix: str) -> list[dict[str, Any]]:
        if self.gateway is None:
            raise ValueError("模型网关未配置")
        options = {"temperature": 0.1, "max_tokens": min(8000, 200 + len(batch) * 100),
                   "timeout_ms": min(300000, 60000 + (len(batch) // 10 + 1) * 30000),
                   "max_retries": 0, "enable_thinking": False}
        last_error = None
        for _ in range(max(0, int(getattr(settings, "keyword_filter_max_retries", 1))) + 1):
            try:
                result = self.gateway.chat_json([
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prefix + json.dumps(batch, ensure_ascii=False, indent=2)},
                ], options)
                data = result.get("data", {})
                return self._validate_keyword_filter_decisions(
                    batch,
                    data.get("decisions", []) if isinstance(data, dict) else [],
                    require_issue_category=True,
                )
            except Exception as exc:
                last_error = exc
        raise ValueError(str(last_error) if last_error else "关键词过滤批次失败")

    def preview_keywords_filter_by_skill(self, dataset_id: str) -> dict[str, Any]:
        """直接使用 keyword-filter SKILL.md 作为系统提示词进行关键词过滤预览。

        直接读取 SKILL.md 的完整内容作为 system prompt，无需额外参数。
        """
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

        # 提取关键词
        keywords = []
        for node in nodes:
            if node.get("type") != "Keyword":
                continue
            keywords.append({
                "id": node.get("keywordId") or node.get("id"),
                "name": node.get("canonicalName") or node.get("name"),
                "rawName": node.get("name") or node.get("canonicalName"),
                "aliases": node.get("aliases", []),
                "currentStatus": self._read_admission_status(node) or "none",
            })

        if not keywords:
            return {
                "preview": True,
                "skillMode": True,
                "suggestions": [],
                "summary": {"total": 0, "suggested_keep": 0, "suggested_exclude": 0},
            }

        try:
            system_prompt, prefix = self._keyword_filter_prompt()
            decisions = []
            failures = []
            for batch_index, batch in enumerate(self._keyword_filter_batches(keywords), start=1):
                try:
                    decisions.extend(self._filter_batch_chat(batch, system_prompt, prefix))
                except Exception as exc:
                    failures.append({"batch": batch_index, "error": str(exc), "count": len(batch)})
            if failures:
                return {"error": "部分关键词批次未完成", "preview": True, "skillMode": True, "suggestions": [],
                        "summary": {"candidateTotal": len(keywords), "decisionTotal": len(decisions),
                                     "pendingTotal": len(keywords) - len(decisions), "status": "incomplete",
                                     "excludedByCategory": self._excluded_by_category(decisions),
                                     "failedBatches": failures}}
        except Exception as exc:
            return {"error": str(exc), "preview": True, "skillMode": True, "suggestions": [],
                    "summary": {"candidateTotal": len(keywords), "decisionTotal": 0,
                                 "pendingTotal": len(keywords), "status": "incomplete"}}

        # 构建建议列表（不修改数据）
        decision_map = {d.get("keywordId"): d for d in decisions if d.get("keywordId")}
        suggestions: list[dict[str, Any]] = []
        keep_count = 0
        exclude_count = 0

        for kw in keywords:
            kw_id = kw["id"]
            decision = decision_map.get(kw_id)
            if decision is None:
                continue
            action = "keep" if not decision.get("shouldExclude", False) else "exclude"
            reason = decision.get("reason", "")

            suggestions.append({
                "keywordId": kw_id,
                "keywordName": kw["name"],
                "keywordRawName": kw.get("rawName"),
                "aliases": kw.get("aliases", []),
                "currentStatus": kw["currentStatus"],
                "suggestedAction": action,
                "issueCategory": decision.get("issueCategory"),
                "issueCategoryLabel": decision.get("issueCategoryLabel", "未分类"),
                "reason": reason,
            })

            if action == "keep":
                keep_count += 1
            else:
                exclude_count += 1

        return {
            "preview": True,
            "skillMode": True,
            "suggestions": suggestions,
            "estimatedSeconds": round(min(300, 60 + len(self._keyword_filter_batches(keywords)) * 30)),
            "summary": {
                "total": len(suggestions),
                "candidateTotal": len(keywords),
                "decisionTotal": len(suggestions),
                "pendingTotal": len(keywords) - len(suggestions),
                "status": "complete",
                "suggested_keep": keep_count,
                "suggested_exclude": exclude_count,
                "excludedByCategory": self._excluded_by_category(decisions),
            },
        }

    def stream_keywords_filter_by_skill(self, dataset_id: str):
        """Generator: 流式推送关键词过滤决策的 SSE 事件。
        使用后台线程 + Queue 模式，避免阻塞事件循环。"""
        import time as _time

        evt_queue = queue.Queue()

        def _producer():
            """后台线程：执行模型调用并将事件推入队列。"""
            try:
                start_ts = _time.time()

                dataset = self.ensure_dataset_graph(dataset_id)
                if dataset.state == "deleted" or not dataset.graph_available or not dataset.training_task_id:
                    evt_queue.put(f"event: error\ndata: {json.dumps({'error': '数据集不存在'})}\n\n")
                    return

                run_dir = self._run_dir(dataset.training_task_id)
                dataset_root = settings.data_root / "datasets" / dataset.id
                nodes_path = run_dir / "graph/nodes.json"
                if not nodes_path.exists():
                    nodes_path = dataset_root / "graph/nodes.json"
                if not nodes_path.exists():
                    evt_queue.put(f"event: error\ndata: {json.dumps({'error': '图谱数据不存在'})}\n\n")
                    return

                nodes = json.loads(nodes_path.read_text(encoding="utf-8"))

                keywords = []
                for node in nodes:
                    if node.get("type") != "Keyword":
                        continue
                    keywords.append({
                        "id": node.get("keywordId") or node.get("id"),
                        "name": node.get("canonicalName") or node.get("name"),
                        "rawName": node.get("name") or node.get("canonicalName"),
                        "aliases": node.get("aliases", []),
                        "currentStatus": self._read_admission_status(node) or "none",
                    })

                if not keywords:
                    evt_queue.put(f"event: complete\ndata: {json.dumps({'total': 0, 'candidateTotal': 0, 'decisionTotal': 0, 'pendingTotal': 0, 'keep': 0, 'exclude': 0, 'excludedByCategory': {}, 'status': 'complete', 'elapsedSeconds': 0})}\n\n")
                    return

                evt_queue.put(f"event: stage\ndata: {json.dumps({'stage': 'preparing', 'message': '正在读取 Skill 指令...'}, ensure_ascii=False)}\n\n")

                system_prompt, prompt_prefix = self._keyword_filter_prompt()

                evt_queue.put(f"event: stage\ndata: {json.dumps({'stage': 'keywords_loaded', 'total': len(keywords), 'message': f'已加载 {len(keywords)} 个关键词，开始模型分析...'}, ensure_ascii=False)}\n\n")
                batches = self._keyword_filter_batches(keywords)
                evt_queue.put(f"event: stage\ndata: {json.dumps({'stage': 'calling_model', 'batchTotal': len(batches), 'estimatedSeconds': min(300, 60 + len(batches) * 30), 'message': '模型分批分析中，请耐心等待...'}, ensure_ascii=False)}\n\n")

                if self.gateway is None:
                    evt_queue.put(f"event: error\ndata: {json.dumps({'error': '模型网关未配置'})}\n\n")
                    return

                emitted_decisions = 0
                keep_count = 0
                exclude_count = 0
                excluded_by_category: dict[str, int] = {}
                failed_batches = []
                for batch_index, batch in enumerate(batches, start=1):
                    batch_error = None
                    for _ in range(max(0, int(getattr(settings, "keyword_filter_max_retries", 1))) + 1):
                        try:
                            text = "".join(str(chunk.get("delta") or "") for chunk in self.gateway.stream_chat(
                                [{"role": "system", "content": system_prompt},
                                 {"role": "user", "content": prompt_prefix + json.dumps(batch, ensure_ascii=False, indent=2)}],
                                {"temperature": 0.1, "max_tokens": min(8000, 200 + len(batch) * 100),
                                 "timeout_ms": min(300000, 60000 + (len(batch) // 10 + 1) * 30000),
                                 "max_retries": 0, "enable_thinking": False}))
                            data = json.loads(text)
                            decisions = self._validate_keyword_filter_decisions(
                                batch,
                                data.get("decisions", []),
                                require_issue_category=True,
                            )
                            for decision in decisions:
                                emitted_decisions += 1
                                excluded = bool(decision.get("shouldExclude", False))
                                exclude_count += int(excluded)
                                keep_count += int(not excluded)
                                if excluded:
                                    category = str(decision.get("issueCategory") or "other")
                                    excluded_by_category[category] = excluded_by_category.get(category, 0) + 1
                                keyword = next((item for item in batch if str(item.get("id")) == str(decision.get("keywordId"))), {})
                                evt_queue.put(f"event: decision\ndata: {json.dumps({'index': emitted_decisions, 'total': len(keywords), 'keywordId': decision.get('keywordId', ''), 'keywordName': decision.get('keywordName') or keyword.get('name', ''), 'keywordRawName': keyword.get('rawName'), 'aliases': keyword.get('aliases', []), 'shouldExclude': excluded, 'issueCategory': decision.get('issueCategory'), 'issueCategoryLabel': decision.get('issueCategoryLabel', '无' if not excluded else '未分类'), 'reason': decision.get('reason', ''), 'batch': batch_index, 'batchTotal': len(batches)}, ensure_ascii=False)}\n\n")
                            batch_error = None
                            break
                        except Exception as exc:
                            batch_error = str(exc)
                    if batch_error:
                        failed_batches.append({"batch": batch_index, "error": batch_error, "count": len(batch)})

                elapsed = round(_time.time() - start_ts, 1)
                evt_queue.put(f"event: complete\ndata: {json.dumps({'total': emitted_decisions, 'candidateTotal': len(keywords), 'decisionTotal': emitted_decisions, 'pendingTotal': len(keywords) - emitted_decisions, 'keep': keep_count, 'exclude': exclude_count, 'excludedByCategory': excluded_by_category, 'status': 'complete' if not failed_batches and emitted_decisions == len(keywords) else 'incomplete', 'failedBatches': failed_batches, 'elapsedSeconds': elapsed}, ensure_ascii=False)}\n\n")

            except Exception as exc:
                evt_queue.put(f"event: error\ndata: {json.dumps({'error': str(exc)}, ensure_ascii=False)}\n\n")
            finally:
                evt_queue.put(None)  # sentinel

        # Start producer thread
        t = threading.Thread(target=_producer, daemon=True)
        t.start()

        # Consume events from queue
        while True:
            try:
                evt = evt_queue.get(timeout=1)
            except queue.Empty:
                # Send keepalive comment to prevent proxy timeouts
                yield ": keepalive\n\n"
                continue
            if evt is None:
                break
            yield evt

    def apply_keywords_filter(self, dataset_id: str, decisions: list[dict]) -> dict[str, Any]:
        """应用用户确认的关键词过滤决策"""
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

        # 构建决策映射
        decision_map = {d.get("keywordId"): d for d in decisions}
        candidate_ids = {
            str(node.get("keywordId") or node.get("id") or "")
            for node in nodes if node.get("type") == "Keyword"
        }
        decision_ids = {str(key) for key in decision_map if key}
        if decision_ids != candidate_ids or len(decision_ids) != len(decisions):
            missing = len(candidate_ids - decision_ids)
            unknown = len(decision_ids - candidate_ids)
            raise KeywordFilterIncompleteError(
                f"过滤决策不完整，候选 {len(candidate_ids)} 条，收到 {len(decision_ids)} 条，缺失 {missing} 条，未知 {unknown} 条"
            )

        updated_keywords = []

        # 应用决策
        for node in nodes:
            if node.get("type") != "Keyword":
                continue

            keyword_id = str(node.get("keywordId") or node.get("id") or "")
            decision = decision_map.get(keyword_id)

            if decision:
                action = decision.get("action", "keep")
                self._write_admission_status(node, "excluded" if action == "exclude" else "admitted")
                updated_keywords.append(keyword_id)
            elif not node.get("admissionStatus") and not node.get("properties", {}).get("admissionStatus"):
                self._write_admission_status(node, "admitted")

        # 保存更新后的图谱
        edges_path = run_dir / "graph/edges.json"
        if not edges_path.exists():
            edges_path = dataset_root / "graph/edges.json"

        edges = json.loads(edges_path.read_text(encoding="utf-8")) if edges_path.exists() else []

        summary = self._graph_summary(nodes, edges, self._read_json(dataset_root / "quality-issues.json", []), str(dataset.graph_summary.get("graphSource") or "model_keyword"))

        for graph_dir in (run_dir / "graph", dataset_root / "graph"):
            self._write_json(graph_dir / "nodes.json", nodes)
            self._write_json(graph_dir / "edges.json", edges)

        self._write_graph_summary_artifacts(run_dir, dataset_root, summary)
        self.store.update_record("datasets", dataset.id, {"graphSummary": summary})
        self.store.update_record("tasks", dataset.training_task_id, {"graphSummary": summary})

        filter_state = self._keyword_filter_state(nodes)

        return {
            "success": True,
            "summary": filter_state,
            "applied": {"total": len(updated_keywords), **filter_state},
            "updatedKeywords": updated_keywords,
        }

    @staticmethod
    def _read_admission_status(node: dict) -> str:
        """读取统一准入状态；历史节点缺失字段时按过滤前状态保留。"""
        explicit = node.get("admissionStatus") or node.get("properties", {}).get("admissionStatus")
        return str(explicit) if explicit in {"admitted", "excluded"} else "admitted"

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
            and self._read_admission_status(node) == "excluded"
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

    def _keyword_rule_descriptor(self, low_confidence_threshold: float) -> dict[str, Any]:
        """Return the complete semantic rule facts used by deterministic extraction."""
        rules = getattr(self.metadata_construction, "rules", {}) or {}

        def plain(value: Any) -> Any:
            if isinstance(value, dict):
                return {str(key): plain(item) for key, item in sorted(value.items(), key=lambda item: str(item[0]))}
            if isinstance(value, (set, frozenset, tuple)):
                return sorted(plain(item) for item in value)
            if isinstance(value, list):
                return [plain(item) for item in value]
            if value is None or isinstance(value, (str, int, float, bool)):
                return value
            return str(value)

        def digest(value: Any) -> str:
            payload = json.dumps(plain(value), ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)
            return "sha256:" + hashlib.sha256(payload.encode("utf-8")).hexdigest()

        title_rules = plain(rules.get("titleCleaning") or {})
        semantic_rules = {
            "metadataRules": plain(rules),
            "titleRules": title_rules,
            "lowConfidenceThreshold": float(low_confidence_threshold),
        }
        pattern_rules = {
            "yasErrorCode": r"(YAS-\d{4,5})",
            "oracleErrorCode": r"(ORA-\d{4,5})",
            "excludedKeywordPatterns": [pattern.pattern for pattern in EXCLUDED_KEYWORD_PATTERNS],
        }
        term_rules = list(DETERMINISTIC_TECHNICAL_TERMS)
        return {
            "schemaVersion": "1.0",
            "mode": "keyword_analysis",
            "producerName": "deterministic_keyword",
            "implementationVersion": "2.0.0",
            "pipelineVersion": "2.0",
            "candidateSchemaVersion": "2.0",
            "ruleArtifacts": [
                {
                    "name": "metadata-rules",
                    "version": self._metadata_rule_set_hash() or "unversioned",
                    "contentHash": digest(semantic_rules),
                },
                {
                    "name": "deterministic-patterns",
                    "version": "2.0.0",
                    "contentHash": digest(pattern_rules),
                },
                {
                    "name": "technical-terms",
                    "version": "2.0.0",
                    "contentHash": digest(term_rules),
                },
            ],
            "semanticConfiguration": {
                "titleGlossaryConfidence": float(title_rules.get("titleGlossaryConfidence") or 0.82),
                "titleTopicConfidence": float(title_rules.get("titleTopicConfidence") or 0.78),
                "titleTopicMaxCharacters": int(title_rules.get("titleTopicMaxCharacters") or 40),
                "patternConfidence": 0.75,
                "chineseTermConfidence": 0.65,
            },
            "candidateContract": {
                "evidenceRequired": True,
                "sourceMethodPrefix": "deterministic_",
                "model": None,
                "modelStatus": "not_applicable",
            },
            "inputContractVersion": "normalized-chunk:v1",
        }

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
                "stageRunId": self._stage_run_id(task_id, "knowledge_extraction"),
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
                "stageRunId": self._stage_run_id(task_id, "knowledge_extraction"),
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
                "stageRunId": self._stage_run_id(task_id, "knowledge_extraction"),
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
                "stageRunId": self._stage_run_id(task_id, "knowledge_extraction"),
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
        technical_terms = DETERMINISTIC_TECHNICAL_TERMS
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
                "stageRunId": self._stage_run_id(task_id, "knowledge_extraction"),
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
            "domain": runtime_profile.domain_id,
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
        options = {"temperature": 0.1, "max_tokens": 4000, "timeout_ms": 60000, "max_retries": 1}
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
            "stageRunId": self._stage_run_id(task_id, "knowledge_extraction"),
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
                **(details or {}),
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

    def _read_jsonl(self, path: Path) -> list[dict[str, Any]]:
        return self.artifacts.read_jsonl(path)

    def _read_json(self, path: Path, default: Any = None) -> Any:
        return self.artifacts.read_json(path, default)

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
            is_keyword_rebuild = bool(
                request.mode == KEYWORD_MODE and request.source_dataset_id
            )
            preflight = None if is_keyword_rebuild else self._latest_preflight(request.batch_id)
            (run_dir / "run-manifest.json").write_text(
                json.dumps({
                    "taskId": task_id,
                    "batchId": request.batch_id,
                    "pipelineVersion": "2.0",
                    "knowledgeBuildMode": request.mode,
                    "sourceDatasetId": request.source_dataset_id,
                    "keywordIds": request.keyword_ids,
                    "stageRuns": {stage: self._stage_run_id(task_id, stage) for stage in STAGES},
                    "config": request.config.model_dump(mode="json", by_alias=True),
                    "configSource": "service_default",
                    "preflight": preflight,
                    "createdAt": utcnow().isoformat(),
                }, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )

            self.tasks._update(task_id, state="running", can_cancel=True)
            self._log(task_id, "info", "queued", "task.started", "知识加工任务开始执行")
            if request.mode == "keyword_analysis" and request.source_dataset_id:
                self._run_keyword_rebuild_from_dataset(task_id, request, run_dir, calls)
                return
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
            summary = self._failure_summary(exc)
            failure_detail = {"stage": current_stage, "message": summary}
            if isinstance(exc, ProductionLineageError):
                failure_detail.update({
                    "reasonCode": exc.code,
                    "requestId": task_id,
                    "retryable": exc.code not in {
                        "DATASET_INPUT_INVALID",
                        "DATASET_IDENTITY_MISMATCH",
                        "DATASET_INPUT_DRIFT",
                        "DATASET_PATH_INVALID",
                        "RULE_ONLY_CONTRACT_VIOLATION",
                    },
                })
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
                progress_detail=failure_detail,
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
            self._restore_material_state(request.batch_id)
        finally:
            self._mark_task_inactive(task_id)

    def _run_keyword_rebuild_from_dataset(
        self,
        task_id: str,
        request: TrainingTaskCreate,
        run_dir: Path,
        calls: dict[str, int],
    ) -> None:
        """Run API-A from a request-time freeze without creating a DatasetVersion."""
        dataset = next(
            item
            for item in self.preprocess.list_datasets(request.batch_id)
            if item.id == request.source_dataset_id
        )
        dataset_root = str(dataset.dataset_path or f"datasets/{dataset.id}")
        dataset_ref = {
            "datasetId": dataset.id,
            "batchId": dataset.batch_id,
            "taskId": dataset.training_task_id,
            "rootPath": dataset_root,
            "manifestPath": f"{dataset_root}/manifest.json",
        }
        request_context = {
            "requestId": task_id,
            "datasetId": dataset.id,
            "batchId": dataset.batch_id,
            "taskId": dataset.training_task_id,
            "mode": request.mode,
        }
        self._set_stage(
            task_id,
            "material_preparation",
            detail_message="正在冻结源数据集当前可读字节",
        )
        freezer = KeywordRebuildInputFreezer(
            repository=self.artifacts,
            store=self.store,
            data_root=settings.data_root,
        )
        frozen = freezer.freeze(dataset_ref, request_context)
        resource_count = sum(
            1
            for item in frozen.artifact_fingerprints
            if item.get("resourceId")
        )
        self._set_stage(
            task_id,
            "material_preparation",
            "completed",
            current=resource_count,
            total=resource_count,
            unit="个资源",
            detail_message="源数据集请求时冻结完成",
        )
        self._set_stage(
            task_id,
            "metadata_construction",
            "skipped",
            detail_message="重建复用冻结包中的元数据，不修改源数据集",
        )

        service = self

        class RuleExecutor:
            batch_size = 64

            def execute_batch(self, records, context):
                candidates: list[dict[str, Any]] = []
                isolated: list[dict[str, Any]] = []
                for record in records:
                    document = dict(record.get("document") or {})
                    resource_id = str(record.get("resourceId") or "")
                    units = list(record.get("processingUnits") or [])
                    if not document.get("title"):
                        document["title"] = Path(
                            str(document.get("sourcePath") or resource_id)
                        ).stem
                    document["resourceId"] = resource_id
                    content = [str(item.get("content") or "") for item in units]
                    document.update(service._document_profile(document, content))
                    chunks = [
                        {
                            "id": str(item.get("chunkId") or ""),
                            "chunkId": str(item.get("chunkId") or ""),
                            "resourceId": resource_id,
                            "content": str(item.get("content") or ""),
                            "sourcePath": document.get("sourcePath"),
                            "headingPath": item.get("headingPath") or [],
                            "chunkIndex": item.get("chunkIndex", 0),
                        }
                        for item in units
                    ]
                    extracted = service._deterministic_keyword_candidates(
                        task_id,
                        document,
                        chunks,
                        request.config.low_confidence_threshold,
                    )
                    if not extracted:
                        isolated.append(
                            {
                                "resourceId": resource_id,
                                "chunkId": chunks[0]["chunkId"] if chunks else "",
                                "reasonCode": "RULE_NO_DETERMINISTIC_CANDIDATE",
                                "severity": "info",
                            }
                        )
                    for ordinal, item in enumerate(extracted):
                        candidate = dict(item)
                        identity = json.dumps(
                            {
                                "resourceId": resource_id,
                                "chunkId": candidate.get("chunkId"),
                                "canonicalName": candidate.get("canonicalName"),
                                "evidenceText": candidate.get("evidenceText"),
                                "sourceMethod": candidate.get("sourceMethod"),
                                "termId": candidate.get("termId"),
                                "ordinal": ordinal,
                            },
                            ensure_ascii=False,
                            sort_keys=True,
                            separators=(",", ":"),
                        ).encode("utf-8")
                        candidate["candidateId"] = "keyword-candidate:v2:" + hashlib.sha256(identity).hexdigest()[:32]
                        candidate["schemaVersion"] = "2.0"
                        candidate["model"] = None
                        candidate["modelStatus"] = "not_applicable"
                        candidates.append(candidate)
                return {
                    "candidates": candidates,
                    "isolated": isolated,
                    "modelCallCount": 0,
                    "modelStatus": "not_applicable",
                }

        self._set_stage(
            task_id,
            "knowledge_extraction",
            detail_message="正在执行请求时冻结包的确定性关键词规则重建",
        )
        result = KeywordRuleRebuild.execute(
            frozen,
            self._keyword_rule_descriptor(request.config.low_confidence_threshold),
            {
                "datasetId": dataset.id,
                "taskId": task_id,
                "inputDigest": frozen.inputDigest,
            },
            RuleExecutor(),
        )
        (run_dir / "rebuild-result.json").write_text(
            json.dumps(
                {
                    **result.to_dict(),
                    "captureSemantics": frozen.captureSemantics,
                    "sourceManifestPath": frozen.manifestPath,
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        self._set_stage(
            task_id,
            "knowledge_extraction",
            "completed",
            current=result.candidate_count,
            total=result.candidate_count + result.isolated_count,
            unit="个关键词候选",
            detail_message="确定性关键词规则重建完成",
        )
        self._set_stage(
            task_id,
            "index_generation",
            "skipped",
            detail_message="API-A 第一阶段只生成可追溯 candidate artifact，不创建或发布 DatasetVersion",
        )
        progress_detail = {
            "stage": "completed",
            "message": "请求时冻结规则重建完成",
            "rebuildResult": {
                **result.to_dict(),
                "captureSemantics": frozen.captureSemantics,
                "sourceManifestPath": frozen.manifestPath,
            },
        }
        self.tasks._update(
            task_id,
            state="completed",
            stage="completed",
            completed=4,
            total=4,
            message="规则重建完成；结果暂不发布为 DatasetVersion",
            model_calls=dict(calls),
            can_cancel=False,
            can_retry=False,
            progress_detail=progress_detail,
        )
        self._log(
            task_id,
            "info",
            "index_generation",
            "rebuild.completed",
            "请求时冻结规则重建完成，结果未发布",
            details=progress_detail["rebuildResult"],
        )
        self.batches.update(dataset.batch_id, state="downloaded", activeTaskIds=[])

    @staticmethod
    def _failure_summary(exc: BaseException) -> str:
        if isinstance(exc, ModelGatewayError):
            return error_summary(exc)
        if isinstance(exc, ArtifactIntegrityError):
            return f"产物完整性校验失败：{exc}"
        if isinstance(exc, ArtifactRecordDecodeError):
            return f"产物记录解析失败：{exc}"
        if isinstance(exc, ProductionLineageError):
            return f"生产血缘校验失败（{exc.code}）：{exc}"
        if isinstance(exc, json.JSONDecodeError):
            return f"JSON 记录解析失败：第 {exc.lineno} 行第 {exc.colno} 列"
        if isinstance(exc, OSError):
            return f"文件读取或写入失败：{exc}"
        if isinstance(exc, ValidationError):
            return f"产物格式校验失败：{exc.message}"
        return f"知识加工内部错误：{exc}"

    def _prepare_materials(self, task_id: str, request: TrainingTaskCreate, run_dir: Path):
        if self.preparation is not None and self.metadata_construction is not None:
            return self._prepare_materials_from_stage_outputs(task_id, request, run_dir)
        return self._prepare_materials_legacy(task_id, request, run_dir)

    def _scan_for_material_preparation(self, task_id: str, batch_id: str) -> ScanReport:
        started_at = time.monotonic()
        self._log(
            task_id,
            "info",
            "material_preparation",
            "material_preparation.scan.started",
            "正在获取源文件扫描结果",
            details={"operation": "load_scan_report"},
        )
        scan_source = "latest_scan_report"
        try:
            report = self.preprocess.latest_scan_report(batch_id)
            if report.batch_id != batch_id:
                raise ValueError("扫描报告批次与当前任务不一致")
        except FileNotFoundError:
            report = None
        except ValueError as exc:
            report = None
            self._log(
                task_id,
                "warning",
                "material_preparation",
                "material_preparation.scan.cache_invalid",
                "源文件扫描缓存不可用，已切换为轻量扫描",
                details={"errorClass": "scan_cache_invalid", "technicalError": str(exc)},
            )

        if report is None:
            scan_source = "lightweight_scan"
            last_emitted = 0
            last_emitted_at = time.monotonic()

            def update_progress(current: int, total: int, failed: int, warnings: int) -> None:
                nonlocal last_emitted, last_emitted_at
                self._raise_if_cancelled(task_id)
                now = time.monotonic()
                if current != total and current - last_emitted < 50 and now - last_emitted_at < 1:
                    return
                last_emitted = current
                last_emitted_at = now
                self._update_stage_progress(
                    task_id,
                    "material_preparation",
                    current,
                    total,
                    "个源文件",
                    f"正在轻量检查源文件：{current}/{total}",
                    event="material_preparation.scan.progress",
                    details={
                        "source": scan_source,
                        "failed": failed,
                        "warnings": warnings,
                    },
                )

            report = self.preprocess.scan(
                batch_id,
                lightweight=True,
                progress=update_progress,
                cancel_check=lambda: self._raise_if_cancelled(task_id),
            )

        self._raise_if_cancelled(task_id)
        duration_ms = int((time.monotonic() - started_at) * 1000)
        self._update_stage_progress(
            task_id,
            "material_preparation",
            report.total_files,
            report.total_files,
            "个源文件",
            f"源文件扫描结果可用：{report.processable_count} 个来源可加工",
            event="material_preparation.scan.completed",
            details={
                "source": scan_source,
                "durationMs": duration_ms,
                "totalFiles": report.total_files,
                "processableCount": report.processable_count,
            },
        )
        return report

    def _preparation_progress_callback(self, task_id: str):
        last_emitted = 0
        last_emitted_at = time.monotonic()

        def update_progress(
            current: int,
            total: int,
            succeeded: int,
            failed: int,
            skipped: int,
        ) -> None:
            nonlocal last_emitted, last_emitted_at
            self._raise_if_cancelled(task_id)
            now = time.monotonic()
            if current not in {0, total} and current - last_emitted < 50 and now - last_emitted_at < 1:
                return
            last_emitted = current
            last_emitted_at = now
            self._update_stage_progress(
                task_id,
                "material_preparation",
                current,
                total,
                "个资源",
                f"正在生成资料预处理快照：{current}/{total}",
                event="material_preparation.prepare.progress",
                details={
                    "substage": "prepare",
                    "succeeded": succeeded,
                    "failed": failed,
                    "skipped": skipped,
                },
            )

        return update_progress

    def _prepare_materials_from_stage_outputs(self, task_id: str, request: TrainingTaskCreate, run_dir: Path):
        self._raise_if_cancelled(task_id)
        self._set_stage(
            task_id,
            "material_preparation",
            detail_message="正在执行正式资料预处理、C 代码清洗和处理单元生成",
        )
        scan_report = self._scan_for_material_preparation(task_id, request.batch_id)
        preparation_stage_run_id = self._stage_run_id(task_id, "material_preparation")
        metadata_stage_run_id = self._stage_run_id(task_id, "metadata_construction")
        preparation_started_at = time.monotonic()
        self._log(
            task_id,
            "info",
            "material_preparation",
            "material_preparation.prepare.started",
            "正在生成资料预处理快照",
            details={"operation": "prepare_snapshot"},
        )
        preparation_report = self.preparation.prepare(
            request.batch_id,
            request.config,
            parent_task_id=task_id,
            stage_run_id=preparation_stage_run_id,
            progress=self._preparation_progress_callback(task_id),
            cancel_check=lambda: self._raise_if_cancelled(task_id),
        )
        self._raise_if_cancelled(task_id)
        self._log(
            task_id,
            "info",
            "material_preparation",
            "material_preparation.prepare.completed",
            f"资料预处理快照已提交：{preparation_report.processable_resources} 个资源可加工",
            current=preparation_report.total_resources,
            total=preparation_report.total_resources,
            details={
                "durationMs": int((time.monotonic() - preparation_started_at) * 1000),
                "runId": preparation_report.run_id,
                "processableResources": preparation_report.processable_resources,
            },
        )
        self._set_stage(
            task_id,
            "material_preparation",
            "completed",
            current=preparation_report.total_resources,
            total=preparation_report.total_resources,
            unit="个资源",
            detail_message=f"资料预处理完成：{preparation_report.processable_resources} 个资源已生成结构化处理单元",
        )
        self._set_stage(
            task_id,
            "metadata_construction",
            detail_message="正在构建文档元数据、主题初筛、embedding 缓存和聚类报告",
        )
        metadata_report = self.metadata_construction.build(
            request.batch_id,
            preparation_snapshot=preparation_report.snapshot_ref,
            parent_task_id=task_id,
            stage_run_id=metadata_stage_run_id,
        )

        preparation_root = (settings.data_root / preparation_report.manifest_path).resolve().parent
        metadata_root = (settings.data_root / metadata_report.stage_result_path).resolve().parent
        policy = self.artifacts.load_corruption_policy(
            settings.processing_skill_root.parent / "artifact-integrity.yaml"
        )
        preparation_ref = preparation_report.snapshot_ref
        metadata_ref = metadata_report.snapshot_ref
        source_documents, source_document_issues = self.artifacts.read_committed_jsonl(
            preparation_ref, "metadata/source-documents.jsonl", settings.data_root, policy
        )
        source_resources, source_resource_issues = self.artifacts.read_committed_jsonl(
            preparation_ref, "metadata/source-resources.jsonl", settings.data_root, policy
        )
        source_assets, source_asset_issues = self.artifacts.read_committed_jsonl(
            preparation_ref, "metadata/source-assets.jsonl", settings.data_root, policy
        )
        ingestion_report = self._read_json(preparation_root / "metadata/ingestion-report.json", {})
        prepared_chunks, prepared_chunk_issues = self.artifacts.read_committed_jsonl(
            preparation_ref, "metadata/chunks.jsonl", settings.data_root, policy
        )
        structure_blocks, structure_block_issues = self.artifacts.read_committed_jsonl(
            preparation_ref, "metadata/structure-blocks.jsonl", settings.data_root, policy
        )
        documents, document_issues = self.artifacts.read_committed_jsonl(
            metadata_ref, "metadata/documents.jsonl", settings.data_root, policy
        )
        chunk_contexts, context_issues = self.artifacts.read_committed_jsonl(
            metadata_ref, "metadata/chunk-contexts.jsonl", settings.data_root, policy
        )
        preselection_report = self._read_json(metadata_root / "metadata/preselection-report.json", {})
        embedding_index, embedding_read_issues = self.artifacts.read_committed_jsonl(
            metadata_ref, "metadata/embedding-index.jsonl", settings.data_root, policy
        )
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
        artifact_read_issues = [
            *source_document_issues,
            *source_resource_issues,
            *source_asset_issues,
            *prepared_chunk_issues,
            *structure_block_issues,
            *document_issues,
            *context_issues,
            *embedding_read_issues,
        ]
        preparation_issues.extend(artifact_read_issues)
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
            "preparation": preparation_report.snapshot_ref.model_dump(mode="json", by_alias=True),
            "metadata": metadata_report.snapshot_ref.model_dump(mode="json", by_alias=True),
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
            publishable=False,
            governance=GovernanceStatus(
                status="keyword",
                reason_code="FORMAL_KNOWLEDGE_PENDING",
                gate_checks=initial_gate_checks(),
            ),
            created_at=utcnow(),
        )
        self.store.put_record("datasets", dataset.id, dataset.model_dump(mode="json", by_alias=True))
        self._set_stage(
            task_id,
            "metadata_construction",
            "completed",
            current=len(chunks),
            total=len(chunks),
            unit="个处理单元",
            detail_message=(
                f"元数据构建完成：{len(documents)} 篇文档、{len(chunks)} 个处理单元、"
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
        self._set_stage(
            task_id,
            "metadata_construction",
            "skipped",
            current=0,
            total=0,
            unit="个处理单元",
            detail_message="当前运行未配置独立元数据构建服务，沿用资料预处理产物中的基础元数据",
        )
        return dataset, chunks, documents

    def _keyword_analysis_progress_callback(self, task_id: str, total_chunks: int):
        last_emitted_resources = 0
        last_emitted_at = time.monotonic()

        def update_progress(
            processed_resources: int,
            current: int,
            succeeded: int,
            failed: int,
            skipped: int,
            force: bool = False,
        ) -> None:
            nonlocal last_emitted_resources, last_emitted_at
            now = time.monotonic()
            if (
                not force
                and current != total_chunks
                and processed_resources - last_emitted_resources < 50
                and now - last_emitted_at < 1
            ):
                return
            last_emitted_resources = processed_resources
            last_emitted_at = now
            self._update_stage_progress(
                task_id,
                "knowledge_extraction",
                current,
                total_chunks,
                "个处理单元",
                f"正在执行确定性关键词抽取：{current}/{total_chunks}",
                event="knowledge_extraction.keyword_analysis.progress",
                details={
                    "substage": "keyword_analysis",
                    "processedResources": processed_resources,
                    "succeeded": succeeded,
                    "failed": failed,
                    "skipped": skipped,
                },
            )

        return update_progress

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
            "knowledge_extraction",
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
            self._raise_if_cancelled(task_id)
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
            self._raise_if_cancelled(task_id)

        rule_descriptor = self._keyword_rule_descriptor(low_confidence_threshold)

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
        report_progress = self._keyword_analysis_progress_callback(task_id, len(chunks))
        processed_resources = 0
        current = 0
        succeeded = 0
        failed = 0
        skipped = 0

        # 对所有资源执行确定性提取
        for resource_id, resource_chunks in grouped.items():
            self._raise_if_cancelled(task_id)
            document = document_lookup.get(resource_id, {})
            preselection = preselection_by_resource.get(resource_id)
            resource_chunk_count = len(resource_chunks)
            
            # 只有 skip 才真正跳过
            if preselection and preselection.get("preselectionState") == "skip":
                cache_summary["deterministicSkippedChunks"] += resource_chunk_count
                known_keywords_by_resource[resource_id] = []
                skipped += resource_chunk_count
            else:
                try:
                    deterministic = self._deterministic_keyword_candidates(
                        task_id,
                        document,
                        sorted(resource_chunks, key=lambda item: int(item.get("chunkIndex", 0))),
                        low_confidence_threshold,
                    )
                except TrainingCancelledError:
                    raise
                except Exception:
                    processed_resources += 1
                    current += resource_chunk_count
                    failed += resource_chunk_count
                    report_progress(
                        processed_resources, current, succeeded, failed, skipped, True
                    )
                    raise
                keyword_candidates.extend(deterministic)
                known_keywords_by_resource[resource_id] = self._merge_unique_values(
                    [],
                    [str(item.get("canonicalName") or "") for item in deterministic],
                )
                if deterministic:
                    deterministic_covered_resources.add(resource_id)
                cache_summary["deterministicSkippedChunks"] += resource_chunk_count
                succeeded += resource_chunk_count

            processed_resources += 1
            current += resource_chunk_count
            report_progress(
                processed_resources,
                current,
                succeeded,
                failed,
                skipped,
                current == len(chunks),
            )
            self._raise_if_cancelled(task_id)

        # Commit the run-local semantic rule facts before any candidate is
        # persisted.  Input fingerprints are traceability facts, not part of
        # extractorVersion, so the same rules remain comparable across runs.
        input_fingerprints: list[dict[str, Any]] = []
        for resource_id, resource_chunks in sorted(grouped.items()):
            document = document_lookup.get(resource_id, {})
            content_hash = str(document.get("contentHash") or "").strip()
            if content_hash.startswith("sha256:"):
                digest = content_hash
            else:
                payload = json.dumps(
                    [
                        {
                            "chunkId": str(chunk.get("id") or chunk.get("chunkId") or ""),
                            "content": str(chunk.get("content") or ""),
                            "headingPath": list(chunk.get("headingPath") or []),
                        }
                        for chunk in sorted(resource_chunks, key=lambda item: int(item.get("chunkIndex", 0)))
                    ],
                    ensure_ascii=False,
                    sort_keys=True,
                    separators=(",", ":"),
                ).encode("utf-8")
                digest = "sha256:" + hashlib.sha256(payload).hexdigest()
            input_fingerprints.append({
                "resourceId": resource_id,
                "algorithm": "sha256-v1",
                "digest": digest,
                "chunkCount": len(resource_chunks),
            })
        snapshot_ref = KeywordRuleSnapshot.commit(
            run_root=run_dir,
            run_id=task_id,
            descriptor=rule_descriptor,
            input_snapshot_fingerprints=input_fingerprints,
        )
        extractor_version = snapshot_ref["extractorVersion"]
        for candidate in keyword_candidates:
            candidate.update({
                "schemaVersion": "2.0",
                "extractorVersion": extractor_version,
                "extractorSnapshotRef": dict(snapshot_ref),
                "model": None,
                "modelStatus": "not_applicable",
            })

        # 写入结果
        self._write_jsonl(run_dir / "extraction-results/keyword-candidates.jsonl", keyword_candidates)
        self._write_jsonl(run_dir / "model-results/keyword-extraction-batches.jsonl", [])
        self._write_json(run_dir / "model-results/keyword-cache-summary.json", cache_summary)
        
        extraction_issues_path = run_dir / "quality/extraction-issues.json"
        extraction_issues_path.parent.mkdir(parents=True, exist_ok=True)
        self._write_json(extraction_issues_path, human_required)

        self._set_stage(
            task_id,
            "knowledge_extraction",
            "completed",
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
        使用 Workflow Agent 执行知识提取。

        最小 Workflow Agent：每个工作项只提取一个 chunk 的知识点候选。
        """
        calls = calls if calls is not None else {"succeeded": 0, "failed": 0, "skipped": 0}
        self._raise_if_cancelled(task_id)
        self._set_stage(
            task_id,
            "knowledge_extraction",
            current=0,
            total=len(chunks),
            unit="个处理单元",
            detail_message="正在使用 Workflow Agent 执行知识提取",
        )

        grouped_content: dict[str, list[str]] = {}
        for chunk in chunks:
            grouped_content.setdefault(chunk["resourceId"], []).append(chunk["content"])

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

        try:
            status = self.gateway.status()
            if not status.get("configured") or not status.get("capabilities", {}).get("chat"):
                raise ModelGatewayError(f"{runtime_profile.brand['productName']}的对话模型尚未配置")
        except Exception as error:
            raise ModelGatewayError(f"知识提取 Agent 不可用：{error_summary(error)}") from error

        self._raise_if_cancelled(task_id)
        self._log(
            task_id, "info", "knowledge_extraction", "workflow_agent.started",
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
                        "knowledge_extraction",
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
                    "knowledge_extraction",
                    event,
                    message,
                    details=details,
                )

            agent_task = AgentTask(
                task_id=task_id,
                input_data={
                    "chunks": chunks,
                    "documents": documents,
                    "task_id": task_id,
                    "stage_run_id": self._stage_run_id(task_id, "knowledge_extraction"),
                    "cancel_check": lambda: self._raise_if_cancelled(task_id),
                    "progress_callback": formal_progress_callback,
                    "keyword_context_by_chunk": keyword_context_by_chunk or {},
                },
            )
            agent_result = self.extraction_agent.execute(agent_task)
            aggregated = agent_result.output_data
            metadata = agent_result.metadata
            batch_audits = [
                self._formal_batch_audit(task_id, audit)
                for audit in aggregated.pop("_batchAudits", [])
            ]
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

            for kp in aggregated.get("knowledgePoints", []):
                chunk_id = kp.get("chunkId", "")
                chunk = next((c for c in chunks if c.get("id") == chunk_id), None)
                if chunk:
                    candidates.append(self._model_knowledge_candidate(
                        task_id, "knowledge_point", kp, chunk,
                        keyword_context_by_chunk.get(chunk_id) if keyword_context_by_chunk else None,
                    ))
            pending = []
            results.append({
                "taskId": task_id,
                "stageRunId": self._stage_run_id(task_id, "knowledge_extraction"),
                "status": "agent_resolved",
                "result": aggregated,
                "metadata": metadata,
            })
            self._merge_model_calls(calls, metadata.get("model_calls"))
            self._log(
                task_id, "info", "knowledge_extraction", "workflow_agent.completed",
                f"Workflow Agent 知识点提取完成：{metadata.get('extraction_count', 0)} 个知识点",
                details={**metadata},
            )
        except Exception as error:
            self._log(
                task_id, "error", "knowledge_extraction", "workflow_agent.failed",
                f"Workflow Agent 知识提取失败：{error_summary(error)}",
                details={"technicalError": str(error)},
            )
            raise

        self._write_jsonl(run_dir / "extraction-results/knowledge-candidates.jsonl", candidates)
        self._write_jsonl(run_dir / "model-results/knowledge-extraction-batches.jsonl", batch_audits)

        extraction_issues_path = run_dir / "quality/extraction-issues.json"
        extraction_issues_path.parent.mkdir(parents=True, exist_ok=True)
        extraction_issues_path.write_text(
            json.dumps(human_required, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        self._set_stage(
            task_id,
            "knowledge_extraction",
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
        item.setdefault("stageRunId", self._stage_run_id(task_id, "knowledge_extraction"))
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


    def _validate_and_merge(self, task_id: str, chunks, rule_results, model_results, run_dir: Path, issues):  # model_results 参数保留但不再使用
        self._raise_if_cancelled(task_id)
        self._set_stage(task_id, "knowledge_extraction", detail_message="正在校验并合并最终知识")
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
        validation_stage_run_id = self._stage_run_id(task_id, "knowledge_extraction")
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
                "knowledge_extraction",
                "knowledge.rejected",
                f"知识候选已拒绝：{item['reason']}",
                details={"candidateId": item.get("candidateId"), "code": item.get("code")},
            )
        self._set_stage(
            task_id,
            "knowledge_extraction",
            "completed",
            current=len(final_results),
            total=len(candidates),
            unit="条知识候选",
            detail_message=f"知识校验与合并完成：通过 {len(final_results)} 条、拒绝 {len(rejected)} 条、质量问题 {len(issues)} 个",
        )
        return final_results

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

    def _commit_production_governance(
        self,
        *,
        dataset_id: str,
        mode: str,
        dataset_root: Path,
        source_documents: list[dict[str, Any]],
        processing_units: list[dict[str, Any]],
        evidence_records: list[dict[str, Any]],
        nodes: list[dict[str, Any]],
        edges: list[dict[str, Any]],
        keyword_chunk_index: Mapping[str, Any],
        request,
    ) -> dict[str, Any]:
        """Build and atomically publish the dataset's verified governance package."""

        # Some historical unit fixtures exercise dataset serialization with a
        # deliberately minimal source record.  They are not production facts
        # and must not be treated as a verified governance package.
        if not all(
            isinstance(item.get("sourcePath"), str)
            and isinstance(item.get("normalizedHash"), str)
            for item in source_documents
        ):
            return {}

        if mode == KEYWORD_MODE:
            rule = self._keyword_rule_descriptor(request.config.low_confidence_threshold)
        else:
            rule = {
                "mode": mode,
                "pipelineVersion": "2.0",
                "schemaVersion": "2.0.0",
                "metadataRuleSetHash": self._metadata_rule_set_hash(),
            }
        result = ProductionLineageAdapter.build(
            dataset_id=dataset_id,
            version_id=dataset_id,
            dataset_root=dataset_root,
            source_documents=source_documents,
            prepared_chunks=processing_units,
            evidence_records=evidence_records,
            mode=mode,
            graph={
                "nodes": nodes,
                "edges": edges,
                "schemaVersion": GRAPH_SCHEMA_VERSION,
                "graphSource": "final_knowledge" if mode == FORMAL_MODE else "keyword_analysis",
            },
            index={
                "processingUnitIds": sorted(str(item.get("chunkId") or item.get("id") or "") for item in processing_units),
                "keywordChunkIndex": keyword_chunk_index,
            },
            rule=rule,
            created_at=utcnow().isoformat(),
            model=None,
            embedding=None,
        )
        return GovernancePackageRepository.commit(dataset_root, result).to_dict()

    def _generate_dataset(self, task_id: str, request, dataset, final_results, chunks, run_dir: Path, calls, issues):
        self._raise_if_cancelled(task_id)
        self._set_stage(task_id, "index_generation", detail_message="正在生成图谱与三层数据集目录")
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
        entity_relation_ready = bool(entities and relations)
        evidence_ready = entity_relation_ready and all(bool(item.get("evidenceText")) for item in relations)
        governance_checks = {
            "entity_relation": entity_relation_ready,
            "evidence": evidence_ready,
            "acl": False,
            "quality": not high_issues,
            "evaluation": False,
            "manifest": False,
        }
        governance = GovernanceStatus(
            status="index" if entity_relation_ready and evidence_ready and not high_issues else "keyword",
            status_version=2 if entity_relation_ready and evidence_ready and not high_issues else 0,
            publishable=False,
            reason_code=(
                "ACL_EVALUATION_PENDING"
                if entity_relation_ready and evidence_ready and not high_issues
                else "ENTITY_RELATION_OR_EVIDENCE_REQUIRED"
            ),
            gate_checks=governance_checks,
        )
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
            "publishable": False,
            "qualityLabels": quality_labels,
            "qualityNotice": quality_notice,
            "datasetPath": f"datasets/{dataset.id}",
            "governance": governance.model_dump(mode="json", by_alias=True),
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
        governance_refs = self._commit_production_governance(
            dataset_id=dataset.id,
            mode=request.mode,
            dataset_root=dataset_root,
            source_documents=source_documents,
            processing_units=processing_units,
            evidence_records=final_results,
            nodes=nodes,
            edges=edges,
            keyword_chunk_index=keyword_chunk_index,
            request=request,
        )
        if governance_refs:
            manifest["governance"] = governance_refs
            self._write_json(dataset_root / "manifest.json", manifest)
            governance_checks["manifest"] = True
            self.store.update_record("datasets", dataset.id, {
                "graphSummary": {**summary, "governance": governance_refs["lineage"]},
                "governance": governance.model_copy(update={"gate_checks": governance_checks}).model_dump(mode="json", by_alias=True),
            })
        self._write_fix_report(
            task_id,
            request,
            run_dir,
            documents,
            processing_units,
            issues,
        )
        for node in nodes:
            self._log(task_id, "info", "index_generation", "graph.node_created", "图谱节点已生成", details={"nodeId": node["id"], "nodeType": node["type"]})
        for edge in edges:
            self._log(task_id, "info", "index_generation", "graph.edge_created", "图谱关系已生成", details={"edgeId": edge["id"], "edgeType": edge["type"]})
        self._log(task_id, "info", "index_generation", "dataset.candidate_created", "候选数据集已生成", details={"datasetId": dataset.id})
        if high_issues:
            self._log(task_id, "warning", "index_generation", "dataset.quality_blocked", quality_notice, details={"datasetId": dataset.id, "qualityLabels": quality_labels})
        self._set_stage(
            task_id,
            "index_generation",
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
        self._set_stage(task_id, "index_generation", detail_message="正在生成质量分析关键词图谱")
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
        governance = GovernanceStatus(
            status="keyword",
            status_version=0,
            publishable=False,
            reason_code="FORMAL_KNOWLEDGE_PENDING",
            gate_checks={
                "entity_relation": False,
                "evidence": False,
                "acl": False,
                "quality": not high_issues,
                "evaluation": False,
                "manifest": False,
            },
        )
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
            "publishable": False,
            "qualityLabels": quality_labels,
            "qualityNotice": quality_notice,
            "datasetPath": f"datasets/{dataset.id}",
            "governance": governance.model_dump(mode="json", by_alias=True),
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
        }
        self._write_json(dataset_root / "manifest.json", manifest)
        governance_refs = self._commit_production_governance(
            dataset_id=dataset.id,
            mode=KEYWORD_MODE,
            dataset_root=dataset_root,
            source_documents=source_documents,
            processing_units=processing_units,
            evidence_records=keyword_candidates,
            nodes=nodes,
            edges=edges,
            keyword_chunk_index=keyword_chunk_index,
            request=request,
        )
        if governance_refs:
            manifest["governance"] = governance_refs
            self._write_json(dataset_root / "manifest.json", manifest)
            governance.gate_checks["manifest"] = True
            self.store.update_record("datasets", dataset.id, {
                "graphSummary": {**summary, "governance": governance_refs["lineage"]},
                "governance": governance.model_dump(mode="json", by_alias=True),
            })
        self._write_fix_report(task_id, request, run_dir, documents, processing_units, issues)
        self._set_stage(
            task_id,
            "index_generation",
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
                "verification": "当前四阶段任务日志和产物统计使用处理单元语义",
            },
            {
                "problem": "按需语义补充未实现",
                "symptom": "旧代码和文档曾暴露 semantic_enrichment 阶段，容易误判为当前可执行能力",
                "rootCause": "六阶段设计与当前四阶段规则化实现未同步收敛",
                "fix": "当前流水线只保留资料预处理、元数据构建、知识提取、索引生成四个阶段；按需语义补充进入后续任务",
                "verification": "异常：本次运行仍出现 semantic_enrichment 事件" if semantic_reached else "本次运行未出现 semantic_enrichment 事件",
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
                    "knowledgeType": "fact",
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
                    "state": metadata.get("state", "agent_resolved"),
                    "kind": kind,
                    "resourceId": chunk["resourceId"],
                    "chunkId": chunk["id"],
                    "sourcePath": chunk.get("sourcePath"),
                    "documentType": document["documentType"],
                    "extractionProfile": document["extractionProfile"],
                    "domain": runtime_profile.domain_id,
                    "domainContextVersion": envelope["domainContextVersion"],
                    "enterpriseProfileId": runtime_profile.profile_id,
                    "enterpriseProfileVersion": runtime_profile.profile_version,
                    "configFingerprint": runtime_profile.config_fingerprint,
                    "value": {key: value for key, value in item.items() if key not in {"evidenceText", "evidenceOffsets", "confidence"}},
                    "evidenceText": item["evidenceText"],
                    "evidenceOffsets": offsets,
                    "sourceMethod": metadata.get("sourceMethod", "knowledge_extraction_agent"),
                    "agentId": metadata.get("agentId", "knowledge-extraction-agent"),
                    "skillId": metadata.get("skillId", "knowledge-extraction"),
                    "skillVersion": metadata.get("skillVersion", "2.0.0"),
                    "promptVersion": metadata.get("promptVersion", "knowledge-extraction:2.0.0"),
                    "profileVersion": document["profileVersion"],
                    "schemaVersion": metadata.get("schemaVersion", "2.0.0"),
                    "inputHash": input_hash,
                    "confidence": item.get("confidence"),
                })
        return records

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
            "stage": "knowledge_extraction",
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
                "enterpriseProfileId", "enterpriseProfileVersion", "configFingerprint",
                "skillId", "skillVersion", "promptVersion", "agentId", "schemaVersion",
            ) if key in metadata}
            metadata.update({
                "documentType": envelope.get("documentType", metadata.get("documentType", "general_technical")),
                "extractionProfile": envelope.get("extractionProfile", metadata.get("extractionProfile", "general-technical")),
                "domain": envelope.get("domain", runtime_profile.domain_id),
                "domainContextVersion": envelope.get("domainContextVersion", runtime_profile.domain_version),
                "enterpriseProfileId": envelope.get("enterpriseProfileId", runtime_profile.profile_id),
                "enterpriseProfileVersion": envelope.get("enterpriseProfileVersion", runtime_profile.profile_version),
                "configFingerprint": envelope.get("configFingerprint", runtime_profile.config_fingerprint),
                "skillId": "knowledge-extraction",
                "skillVersion": skill_version,
                "promptVersion": f"knowledge-extraction:{skill_version}",
                "agentId": "knowledge-extraction-agent",
                "schemaVersion": envelope.get("schemaVersion", "2.0.0"),
            })
            normalized["metadata"] = metadata

        normalized["knowledgePoints"] = TrainingService._normalize_knowledge_points(
            normalized.get("knowledgePoints", [])
        )
        normalized["entities"] = TrainingService._normalize_entities(normalized.get("entities", []))
        normalized["relations"] = TrainingService._normalize_relations(normalized.get("relations", []))
        if "uncertainItems" in normalized:
            normalized["uncertainItems"] = TrainingService._normalize_uncertain_items(
                normalized.get("uncertainItems", [])
            )
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

    def _write_jsonl(self, path: Path, items: list[dict[str, Any]]) -> None:
        self.artifacts.write_jsonl(path, items)

    def _write_json(self, path: Path, value: Any) -> None:
        self.artifacts.write_json(path, value)

    def _copy_embedding_cache(self, source_root: Path, target_root: Path) -> None:
        self.artifacts.copy_embedding_cache(source_root, target_root)

    def _write_text(self, path: Path, value: str) -> None:
        self.artifacts.write_text(path, value)

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
                "admissionStatus": "admitted",
                "approvalStatus": "autoAccepted" if confidence >= 0.65 else "pending",
                "occurrences": [],
                "properties": {
                    "termId": candidate.get("termId"),
                    "termType": candidate.get("termType"),
                    "category": candidate.get("category"),
                    "canonicalName": canonical_name,
                    "keywordId": keyword_id,
                    "confidence": confidence,
                    "admissionStatus": "admitted",
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
                    "admissionStatus": "admitted",
                    "approvalStatus": "autoAccepted" if float(candidate.get("confidence", 0.6)) >= 0.65 else "pending",
                    "occurrences": [],
                    "properties": {
                        **candidate_properties,
                        "graphSource": "metadata_keyword",
                        "sourceMethod": candidate.get("source"),
                        "canonicalName": canonical_name,
                        "keywordId": keyword_id,
                        "confidence": float(candidate.get("confidence", 0.6)),
                        "admissionStatus": "admitted",
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
        keyword_admission_state = {"admitted": 0, "excluded": 0, "totalKeywordCount": len(keyword_nodes)}
        for node in keyword_nodes:
            properties = node.get("properties") if isinstance(node.get("properties"), dict) else {}
            status = str(node.get("approvalStatus") or properties.get("approvalStatus") or "autoAccepted")
            if status not in keyword_approval_state:
                status = "pending"
            keyword_approval_state[status] += 1
            admission = self._read_admission_status(node)
            if admission in keyword_admission_state:
                keyword_admission_state[admission] += 1
            else:
                keyword_admission_state["excluded"] += 1
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
            "keywordAdmissionState": keyword_admission_state,
            "keywordFilterState": {
                "beforeTotal": len(keyword_nodes),
                "afterTotal": keyword_admission_state["admitted"],
                "retained": keyword_admission_state["admitted"],
                "excluded": keyword_admission_state["excluded"],
            },
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
