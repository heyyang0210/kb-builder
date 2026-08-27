"""
提取工具

封装 knowledge-point-extraction Skill 调用，支持单处理单元提取。
"""

from __future__ import annotations

import json
import logging
import re
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from typing import Any, Dict, List
from pathlib import Path

from jsonschema import ValidationError, validate
from ...config import runtime_profile

logger = logging.getLogger(__name__)


class ExtractionTool:
    """提取工具：调用 knowledge-point-extraction Skill"""
    
    def __init__(self, config: Dict[str, Any]):
        """
        初始化工具
        
        Args:
            config: 配置字典，包含 prompts, gateway, batch_size 等
        """
        self.config = config
        self.prompts = config.get("prompts")
        self.gateway = config.get("gateway")
        self.batch_size = 1
        self.skill_id = "knowledge-point-extraction"
        self.defaults = self._load_skill_defaults()
        skill_root = Path(str(config.get("skill_root") or ""))
        schema_root = skill_root / "knowledge-point-extraction" / "schemas"
        self.input_schema = json.loads((schema_root / "input.schema.json").read_text(encoding="utf-8"))
        self.output_schema = json.loads((schema_root / "output.schema.json").read_text(encoding="utf-8"))
    
    def extract_batch(self, envelope: Dict[str, Any], context: Dict[str, Any] | None = None) -> Dict[str, Any]:
        """
        单处理单元提取
        
        Args:
            envelope: 包含 chunks 列表的上下文信封
            
        Returns:
            提取结果字典
        """
        context = context or {}
        envelope = self._normalize_input_envelope(envelope)
        chunks = envelope.get("chunks", [])
        if not chunks:
            return {"chunks": [], "result": {}, "usage": {}}
        batch_started_at = time.monotonic()
        try:
            validate(instance=envelope, schema=self.input_schema)
        except ValidationError as error:
            return {
                "chunks": chunks,
                "result": {},
                "usage": {},
                "success": False,
                "errorCode": "KNOWLEDGE_EXTRACTION_SCHEMA_INVALID",
                "error": f"知识提取输入校验失败: {error.message}",
                "technicalError": str(error),
                "durationMs": int((time.monotonic() - batch_started_at) * 1000),
                "modelCalls": {"succeeded": 0, "failed": 0},
                "_modelCalls": {"succeeded": 0, "failed": 0},
            }
        
        # 构建 system 和 user 消息
        system_prompt = self.prompts.get("knowledge-point-extraction.system")
        user_prompt = self.prompts.get("knowledge-point-extraction.user", system_prompt.skill_version)
        
        # 当前 Skill 使用单一 JSON 信封，避免运行时支持多套模板语法。
        user_content = user_prompt.content.replace(
            "{{context_envelope}}",
            json.dumps(envelope, ensure_ascii=False)
        )
        if re.search(r"{{[^{}]+}}", user_content):
            return {
                "chunks": chunks,
                "result": {},
                "usage": {},
                "success": False,
                "errorCode": "KNOWLEDGE_EXTRACTION_SCHEMA_INVALID",
                "error": "知识提取提示词存在未渲染模板变量",
                "technicalError": "知识提取提示词存在未渲染模板变量",
                "durationMs": int((time.monotonic() - batch_started_at) * 1000),
                "modelCalls": {"succeeded": 0, "failed": 0},
                "_modelCalls": {"succeeded": 0, "failed": 0},
            }
        
        messages = [
            {"role": "system", "content": system_prompt.content},
            {"role": "user", "content": user_content}
        ]
        
        # 调用 LLM
        logger.info("单处理单元提取: %d 个 chunk", len(chunks))
        options = self._model_options()
        chunk_ids = [str(item.get("chunkId") or "") for item in chunks if isinstance(item, dict)]
        max_retries = int(self.defaults.get("maxRetries", 0) or 0)
        model_calls = {"succeeded": 0, "failed": 0}
        model_call_ids: List[str] = []
        response: Dict[str, Any] | None = None
        
        try:
            retry_of = None
            for attempt in range(max_retries + 1):
                self._check_cancelled(context)
                model_call_id = f"model_call_{uuid.uuid4().hex[:20]}"
                model_call_ids.append(model_call_id)
                started_at = time.monotonic()
                details = {
                    **(context.get("trace") or {}),
                    "modelCallId": model_call_id,
                    "retryOf": retry_of,
                    "skillId": self.skill_id,
                    "attempt": attempt + 1,
                    "maxAttempts": max_retries + 1,
                    "chunkCount": len(chunks),
                    "chunkIds": chunk_ids,
                    "timeoutMs": options.get("timeout_ms"),
                }
                self._emit(context, "model_call.started", details)
                try:
                    response = self._chat_json_with_cancel(messages, options, context)
                    self._check_cancelled(context)
                    self._emit(
                        context,
                        "model_call.completed",
                        {
                            **details,
                            "durationMs": int((time.monotonic() - started_at) * 1000),
                            "attempts": response.get("attempts", 1),
                        },
                    )
                    attempts = max(1, int(response.get("attempts", 1)))
                    model_calls["failed"] += attempts - 1
                    model_calls["succeeded"] += 1
                    break
                except Exception as error:
                    if self._is_cancellation_error(error):
                        self._emit(
                            context,
                            "model_call.cancelled",
                            {
                                **details,
                                "durationMs": int((time.monotonic() - started_at) * 1000),
                                "technicalError": str(error),
                            },
                        )
                        raise
                    model_calls["failed"] += 1
                    self._emit(
                        context,
                        "model_call.failed",
                        {
                            **details,
                            "durationMs": int((time.monotonic() - started_at) * 1000),
                            "technicalError": str(error),
                        },
                    )
                    if attempt >= max_retries:
                        raise
                    retry_of = model_call_id
            if response is None:
                raise RuntimeError("模型调用未返回结果")
            data = self._normalize_output(response.get("data", {}))
            validate(instance=data, schema=self.output_schema)
            has_effective_result = any(item.get("knowledgePoints") for item in data.get("results", []))
            if not has_effective_result:
                raise ValueError("模型返回结构有效，但没有知识点候选")
            
            return {
                "chunks": chunks,
                "result": data,
                "usage": response.get("usage", {}),
                "success": True,
                "modelCallId": model_call_ids[-1] if model_call_ids else None,
                "modelCallIds": list(model_call_ids),
                "modelCalls": dict(model_calls),
                "durationMs": int((time.monotonic() - batch_started_at) * 1000),
                "_modelCallId": model_call_ids[-1] if model_call_ids else None,
                "_modelCallIds": list(model_call_ids),
                "_modelCalls": dict(model_calls),
            }

        except (ValidationError, ValueError, TypeError, KeyError) as error:
            if self._is_cancellation_error(error):
                raise
            logger.error("单处理单元提取结果无效: %s", error)
            if model_calls["succeeded"] > 0:
                model_calls["succeeded"] -= 1
                model_calls["failed"] += 1
            return {
                "chunks": chunks,
                "result": response.get("data", {}) if response else {},
                "usage": response.get("usage", {}) if response else {},
                "success": False,
                "errorCode": self._classify_failure(error),
                "error": f"模型输出校验失败: {error}",
                "technicalError": str(error),
                "durationMs": int((time.monotonic() - batch_started_at) * 1000),
                "modelCallId": model_call_ids[-1] if model_call_ids else None,
                "modelCallIds": list(model_call_ids),
                "modelCalls": dict(model_calls),
                "_modelCallId": model_call_ids[-1] if model_call_ids else None,
                "_modelCallIds": list(model_call_ids),
                "_modelCalls": dict(model_calls),
            }
        except Exception as error:
            if self._is_cancellation_error(error):
                raise
            logger.error("单处理单元提取失败: %s", error)
            return {
                "chunks": chunks,
                "result": {},
                "usage": {},
                "success": False,
                "errorCode": self._classify_failure(error),
                "error": str(error),
                "technicalError": str(error),
                "durationMs": int((time.monotonic() - batch_started_at) * 1000),
                "modelCallId": model_call_ids[-1] if model_call_ids else None,
                "modelCallIds": list(model_call_ids),
                "modelCalls": dict(model_calls),
                "_modelCallId": model_call_ids[-1] if model_call_ids else None,
                "_modelCallIds": list(model_call_ids),
                "_modelCalls": dict(model_calls),
            }

    @staticmethod
    def _normalize_input_envelope(envelope: Dict[str, Any]) -> Dict[str, Any]:
        normalized = dict(envelope or {})
        normalized.setdefault("documentType", "general_technical")
        normalized.setdefault("extractionProfile", "general-technical")
        normalized.setdefault("domain", runtime_profile.domain_id)
        normalized.setdefault("schemaVersion", "3.0.0")
        normalized_chunks = []
        for raw_chunk in normalized.get("chunks") or []:
            if not isinstance(raw_chunk, dict):
                normalized_chunks.append(raw_chunk)
                continue
            chunk = dict(raw_chunk)
            if "documentOffsets" not in chunk and "normalizedOffsets" in chunk:
                chunk["documentOffsets"] = chunk.get("normalizedOffsets")
            normalized_chunks.append(chunk)
        normalized["chunks"] = normalized_chunks
        return normalized

    def _load_skill_defaults(self) -> Dict[str, Any]:
        skills = getattr(self.prompts, "skills", None)
        if skills is None:
            return {}
        try:
            system_prompt = self.prompts.get("knowledge-point-extraction.system")
            skill = skills.get("knowledge-point-extraction", system_prompt.skill_version)
            return dict(getattr(skill, "manifest", {}).get("defaults", {}) or {})
        except Exception as error:
            logger.warning("读取 knowledge-point-extraction defaults 失败: %s", error)
            return {}

    def _model_options(self) -> Dict[str, Any]:
        options: Dict[str, Any] = {"temperature": 0.1, "max_retries": 0}
        option_map = {
            "maxTokens": "max_tokens",
            "timeoutMs": "timeout_ms",
            "enableThinking": "enable_thinking",
            "chatTemplateKwargs": "chat_template_kwargs",
            "jsonRepair": "json_repair",
        }
        for source_key, option_key in option_map.items():
            if source_key not in self.defaults:
                continue
            value = self.defaults[source_key]
            if source_key in {"maxTokens", "timeoutMs"}:
                value = int(value)
            elif source_key in {"enableThinking", "jsonRepair"}:
                value = bool(value)
            options[option_key] = value
        return options

    def _chat_json_with_cancel(
        self,
        messages: List[Dict[str, str]],
        options: Dict[str, Any],
        context: Dict[str, Any],
    ) -> Dict[str, Any]:
        cancel_check = context.get("cancel_check")
        if not callable(cancel_check):
            return self.gateway.chat_json(messages, options=options)

        executor = ThreadPoolExecutor(max_workers=1)
        future = executor.submit(self.gateway.chat_json, messages, options=options)
        try:
            while True:
                self._check_cancelled(context)
                try:
                    return future.result(timeout=0.25)
                except FutureTimeoutError:
                    continue
        except Exception:
            future.cancel()
            raise
        finally:
            executor.shutdown(wait=False, cancel_futures=True)

    @staticmethod
    def _check_cancelled(context: Dict[str, Any]) -> None:
        cancel_check = context.get("cancel_check")
        if callable(cancel_check):
            cancel_check()

    @staticmethod
    def _emit(context: Dict[str, Any], event: str, details: Dict[str, Any]) -> None:
        callback = context.get("progress_callback")
        if not callable(callback):
            return
        try:
            callback(event, details)
        except TypeError:
            callback({"event": event, "details": details})

    @staticmethod
    def _is_cancellation_error(error: BaseException) -> bool:
        return error.__class__.__name__ == "TrainingCancelledError"

    @staticmethod
    def _classify_failure(error: BaseException) -> str:
        name = error.__class__.__name__.lower()
        message = str(error).lower()
        if "timeout" in name or "timeout" in message or "超时" in message:
            return "KNOWLEDGE_EXTRACTION_TIMEOUT"
        if isinstance(error, ValueError) and "没有知识点候选" in str(error):
            return "KNOWLEDGE_EXTRACTION_EMPTY_RESULT"
        if isinstance(error, (ValidationError, TypeError, KeyError)):
            return "KNOWLEDGE_EXTRACTION_SCHEMA_INVALID"
        return "KNOWLEDGE_EXTRACTION_FAILED"

    @staticmethod
    def _normalize_output(data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        normalized = dict(data)
        if "results" not in normalized and isinstance(normalized.get("chunks"), list):
            normalized["results"] = normalized.pop("chunks")
        results = normalized.get("results")
        if not isinstance(results, list):
            return normalized
        normalized_results = []
        for raw_result in results:
            if not isinstance(raw_result, dict):
                normalized_results.append(raw_result)
                continue
            result = dict(raw_result)
            result.setdefault("knowledgePoints", [])
            knowledge_points = []
            for raw_item in result.get("knowledgePoints", []):
                if not isinstance(raw_item, dict):
                    knowledge_points.append(raw_item)
                    continue
                item = dict(raw_item)
                statement = item.get("statement") or item.get("summary") or item.get("description") or item.get("content")
                if statement:
                    item.setdefault("statement", statement)
                    item.setdefault("title", str(statement).strip()[:80])
                    item.setdefault("knowledgeType", item.get("type") or "technical_fact")
                knowledge_points.append(item)
            result["knowledgePoints"] = knowledge_points
            normalized_results.append(result)
        normalized["results"] = normalized_results
        return normalized
    
    def extract_single(self, chunk: Dict[str, Any], profile: str, document: Dict[str, Any]) -> Dict[str, Any]:
        """
        单个 chunk 提取（降级使用）
        
        Args:
            chunk: 单个 chunk 数据
            profile: 提取 profile
            document: 文档信息
            
        Returns:
            提取结果字典
        """
        envelope = {
            "documentType": document.get("documentType", "general_technical"),
            "extractionProfile": profile,
            "domain": runtime_profile.domain_id,
            "chunks": [chunk],
            "schemaVersion": "3.0.0"
        }
        
        return self.extract_batch(envelope)
