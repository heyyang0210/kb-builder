"""
提取工具

封装 knowledge-extraction skill 调用，支持批量提取。
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, List
from pathlib import Path

from jsonschema import ValidationError, validate

logger = logging.getLogger(__name__)


class ExtractionTool:
    """提取工具：调用 knowledge-extraction skill"""
    
    def __init__(self, config: Dict[str, Any]):
        """
        初始化工具
        
        Args:
            config: 配置字典，包含 prompts, gateway, batch_size 等
        """
        self.config = config
        self.prompts = config.get("prompts")
        self.gateway = config.get("gateway")
        self.batch_size = config.get("batch_size", 5)
        skill_root = Path(str(config.get("skill_root") or ""))
        schema_path = skill_root / "knowledge-point-extraction" / "schemas" / "output.schema.json"
        self.output_schema = json.loads(schema_path.read_text(encoding="utf-8"))
    
    def extract_batch(self, envelope: Dict[str, Any]) -> Dict[str, Any]:
        """
        批量提取
        
        Args:
            envelope: 包含 chunks 列表的上下文信封
            
        Returns:
            提取结果字典
        """
        chunks = envelope.get("chunks", [])
        if not chunks:
            return {"chunks": [], "result": {}, "usage": {}}
        
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
                "error": "知识提取提示词存在未渲染模板变量",
            }
        
        messages = [
            {"role": "system", "content": system_prompt.content},
            {"role": "user", "content": user_content}
        ]
        
        # 调用 LLM
        logger.info("批量提取: %d 个 chunk", len(chunks))
        
        try:
            response = self.gateway.chat_json(messages, options={"temperature": 0.1})
            data = self._normalize_output(response.get("data", {}))
            validate(instance=data, schema=self.output_schema)
            has_effective_result = any(
                item.get("keywordCandidates")
                or item.get("knowledgePoints")
                or item.get("entities")
                or item.get("relations")
                for item in data.get("results", [])
            )
            if not has_effective_result:
                raise ValueError("模型返回结构有效，但没有任何关键词或知识候选")
            
            return {
                "chunks": chunks,
                "result": data,
                "usage": response.get("usage", {}),
                "success": True
            }

        except (ValidationError, ValueError, TypeError, KeyError) as error:
            logger.error("批量提取结果无效: %s", error)
            return {
                "chunks": chunks,
                "result": response.get("data", {}) if "response" in locals() else {},
                "usage": response.get("usage", {}) if "response" in locals() else {},
                "success": False,
                "error": f"模型输出校验失败: {error}",
            }
        except Exception as error:
            logger.error("批量提取失败: %s", error)
            return {
                "chunks": chunks,
                "result": {},
                "usage": {},
                "success": False,
                "error": str(error)
            }

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
            if "relations" not in result and "relationships" in result:
                result["relations"] = result.pop("relationships")
            for key in ("keywordCandidates", "knowledgePoints", "entities", "relations"):
                result.setdefault(key, [])
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
            "domain": "yashandb",
            "chunks": [chunk],
            "schemaVersion": "2.0.0"
        }
        
        return self.extract_batch(envelope)
