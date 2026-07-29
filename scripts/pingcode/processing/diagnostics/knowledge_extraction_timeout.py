#!/usr/bin/env python3
"""对一个已落盘处理单元执行知识提取超时分层诊断。"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from jsonschema import ValidationError, validate

BACKEND_ROOT = Path(__file__).resolve().parents[2] / "web/backend"
sys.path.insert(0, str(BACKEND_ROOT))

from app.training_service import TrainingService


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def estimate_tokens(value: str) -> int:
    return max(1, (len(value) + 3) // 4)


def explicit_anchors(content: str) -> list[dict[str, str]]:
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
    return anchors[:50]


def build_envelope(task_id: str, chunk: dict[str, Any], document: dict[str, Any], adjacent: list[dict[str, Any]], profile_guidance: str, compact: bool, output_limits: dict[str, int]) -> dict[str, Any]:
    content = str(chunk.get("content") or "")
    anchors = explicit_anchors(content)
    envelope = {
        "taskId": task_id,
        "resourceId": chunk["resourceId"],
        "chunkId": chunk["chunkId"],
        "documentType": document.get("documentType", "general_technical"),
        "extractionProfile": document.get("extractionProfile", "general-technical"),
        "domain": "yashandb",
        "domainContextVersion": "yashandb-domain:1.0.0",
        "domainContextHits": [f"{item['candidateType']}:{item['value']}" for item in anchors],
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
        "constraints": {"evidenceRequired": True, "allowSchemaCandidate": True, "allowNeedsEnrichment": True, "outputLimits": output_limits},
    }
    if compact:
        envelope["profileGuidance"] = profile_guidance[:500]
        envelope["domainContextHits"] = envelope["domainContextHits"][:10]
        envelope["document"]["summary"] = str(envelope["document"]["summary"])[:240]
        envelope["document"]["keywords"] = envelope["document"]["keywords"][:10]
        envelope["adjacentChunkSummaries"] = adjacent[:1]
    return envelope


class DiagnosticRunner:
    def __init__(self, args: argparse.Namespace, config: dict[str, Any]):
        self.args = args
        self.config = config
        self.task_root = Path(args.task_root).resolve()
        self.skill_root = Path(config["skillRoot"]).resolve()
        self.results: list[dict[str, Any]] = []
        self.unit, self.document, self.adjacent = self._load_unit()
        self.schema = read_json(self.skill_root / "schemas/output.schema.json")
        self.system_prompt = (self.skill_root / "prompts/system.md").read_text(encoding="utf-8")
        self.user_prompt = (self.skill_root / "prompts/user.md").read_text(encoding="utf-8")
        profile = self.document.get("extractionProfile", "general-technical")
        profile_path = self.skill_root / "prompts/profiles" / f"{profile}.md"
        self.profile_guidance = profile_path.read_text(encoding="utf-8") if profile_path.is_file() else ""

    def _load_unit(self) -> tuple[dict[str, Any], dict[str, Any], list[dict[str, Any]]]:
        chunks = read_jsonl(self.task_root / "metadata/chunks.jsonl")
        unit = next((item for item in chunks if item.get("chunkId") == self.args.chunk_id), None)
        if unit is None:
            raise ValueError(f"未找到处理单元：{self.args.chunk_id}")
        documents = {item["resourceId"]: item for item in read_jsonl(self.task_root / "metadata/documents.jsonl")}
        profiles = {item["resourceId"]: item for item in read_jsonl(self.task_root / "extraction-results/document-profiles.jsonl")}
        document = {**documents[unit["resourceId"]], **profiles.get(unit["resourceId"], {})}
        siblings = sorted((item for item in chunks if item.get("resourceId") == unit["resourceId"]), key=lambda item: int(item.get("chunkIndex", 0)))
        index = next(i for i, item in enumerate(siblings) if item.get("chunkId") == self.args.chunk_id)
        adjacent = []
        if index:
            previous = siblings[index - 1]
            adjacent.append({"chunkId": previous["chunkId"], "summary": str(previous.get("content") or "")[:240]})
        if index + 1 < len(siblings):
            following = siblings[index + 1]
            adjacent.append({"chunkId": following["chunkId"], "summary": str(following.get("content") or "")[:240]})
        return unit, document, adjacent

    def _messages(self, case: dict[str, Any]) -> tuple[list[dict[str, str]], dict[str, Any] | None]:
        kind = case.get("kind")
        if kind == "gateway_test":
            return [], None
        if kind == "chat":
            content = case.get("userTemplate", case.get("user", "")).replace("{{chunk_content}}", str(self.unit.get("content") or ""))
            return [{"role": "system", "content": case.get("system", "")}, {"role": "user", "content": content}], None
        compact = case.get("contextMode") == "compact"
        envelope = build_envelope(self.args.task_id, self.unit, self.document, self.adjacent, self.profile_guidance, compact, self.config.get("outputLimits", {}))
        user = self.user_prompt.replace("{{context_envelope}}", json.dumps(envelope, ensure_ascii=False))
        if case.get("userSuffix"):
            user += "\n" + case["userSuffix"]
        return [{"role": "system", "content": self.system_prompt}, {"role": "user", "content": user}], envelope

    def _request(self, path: str, payload: dict[str, Any] | None = None, http_timeout_ms: int | None = None) -> tuple[int, dict[str, Any], int]:
        body = json.dumps(payload or {}, ensure_ascii=False).encode("utf-8")
        request = Request(f"{self.config['gatewayUrl']}{path}", data=body, method="POST", headers={"Content-Type": "application/json"})
        started = time.monotonic()
        try:
            with urlopen(request, timeout=http_timeout_ms or int(self.config.get("httpTimeoutMs", 55000))) as response:
                return response.status, json.loads(response.read().decode("utf-8")), int((time.monotonic() - started) * 1000)
        except HTTPError as error:
            body = error.read().decode("utf-8", errors="replace")
            try:
                value = json.loads(body)
            except json.JSONDecodeError:
                value = {"success": False, "error": {"message": body[:500]}}
            return error.code, value, int((time.monotonic() - started) * 1000)
        except (URLError, TimeoutError) as error:
            return 0, {"success": False, "error": {"message": str(error)[:500]}}, int((time.monotonic() - started) * 1000)

    def run_case(self, case: dict[str, Any], model: str | None = None, repeat_index: int = 1) -> dict[str, Any]:
        diagnostic_id = f"diagnostic_{uuid.uuid4().hex[:20]}"
        model_call_id = f"model_call_{uuid.uuid4().hex[:20]}"
        messages, envelope = self._messages(case)
        prompt_text = "\n".join(item.get("content", "") for item in messages)
        timeout_ms = self.args.timeout_ms or int(self.config.get("timeoutMs", 45000))
        record: dict[str, Any] = {
            "diagnosticId": diagnostic_id,
            "modelCallId": model_call_id,
            "caseId": case["id"],
            "repeatIndex": repeat_index,
            "taskId": self.args.task_id,
            "chunkId": self.args.chunk_id,
            "model": model,
            "responseFormat": case.get("responseFormat"),
            "maxTokens": case.get("maxTokens"),
            "timeoutMs": timeout_ms,
            "maxRetries": 0,
            "chunkCharacters": len(str(self.unit.get("content") or "")),
            "promptCharacters": len(prompt_text),
            "estimatedPromptTokens": estimate_tokens(prompt_text),
            "startedAt": now(),
            "reached": {"modelResponse": False, "jsonParsing": False, "normalization": False, "schemaValidation": False, "evidenceValidation": False},
        }
        if case.get("kind") == "gateway_test":
            status, value, duration = self._request("/test", {})
        else:
            options: dict[str, Any] = {"temperature": 0, "max_tokens": int(case["maxTokens"]), "timeout_ms": timeout_ms, "max_retries": 0, **self.config.get("defaultOptions", {})}
            if model:
                options["model"] = model
            status, value, duration = self._request("/chat", {"messages": messages, "responseFormat": case.get("responseFormat", "json"), "options": options}, max(int(self.config.get("httpTimeoutMs", 55000)), timeout_ms + 10000))
        record.update({"completedAt": now(), "durationMs": duration, "httpStatus": status, "success": bool(value.get("success")), "usage": value.get("usage", {}), "finishReason": value.get("finishReason"), "attempts": value.get("attempts", 1)})
        if value.get("success"):
            record["reached"]["modelResponse"] = True
            if case.get("responseFormat") == "json":
                data = value.get("data")
                record["reached"]["jsonParsing"] = isinstance(data, dict)
                if isinstance(data, dict) and case.get("kind") == "skill" and envelope:
                    data = TrainingService._normalize_skill_output(
                        "knowledge-extraction",
                        data,
                        {"context_envelope": json.dumps(envelope, ensure_ascii=False)},
                        "2.0.0",
                    )
                    record["reached"]["normalization"] = isinstance(data, dict)
                    try:
                        validate(instance=data, schema=self.schema)
                        record["reached"]["schemaValidation"] = True
                    except ValidationError as error:
                        record["schemaError"] = error.message[:500]
                    if record["reached"]["schemaValidation"]:
                        evidence_results = [
                            bool(isinstance(item, dict) and item.get("evidenceText") and item["evidenceText"] in str(self.unit.get("content") or ""))
                            for collection in ("knowledgePoints", "entities", "relations")
                            for item in data.get(collection, [])
                        ]
                        record["evidenceCount"] = len(evidence_results)
                        record["evidenceMatchedCount"] = sum(evidence_results)
                        record["reached"]["evidenceValidation"] = all(evidence_results)
                elif isinstance(data, dict):
                    record["reached"]["normalization"] = False
            else:
                record["reached"]["normalization"] = False
        else:
            error = value.get("error", {})
            record["error"] = {"message": str(error.get("message", "未知错误"))[:500], "code": error.get("code")}
            response_metadata = error.get("responseMetadata")
            if isinstance(response_metadata, dict):
                record["reached"]["modelResponse"] = True
                record["responseMetadata"] = response_metadata
                record["usage"] = response_metadata.get("usage", {})
                record["finishReason"] = response_metadata.get("finishReason")
                record["attempts"] = response_metadata.get("attempts", 1)
        record["promptHash"] = "sha256:" + sha256(prompt_text)
        record["inputHash"] = "sha256:" + sha256(str(self.unit.get("content") or ""))
        self.results.append(record)
        print(f"{case['id']}[{repeat_index}] model={model or 'configured'} status={status} duration={duration}ms success={record['success']}")
        return record

    def write_reports(self) -> Path:
        root = Path(self.args.output).resolve()
        root.mkdir(parents=True, exist_ok=True)
        report = {
            "diagnosticRunId": f"diagnostic_run_{uuid.uuid4().hex[:20]}",
            "taskId": self.args.task_id,
            "chunkId": self.args.chunk_id,
            "chunkCharacters": len(str(self.unit.get("content") or "")),
            "modelConfigUnchanged": True,
            "createdAt": now(),
            "results": self.results,
        }
        (root / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        lines = ["# 知识提取超时分层诊断报告", "", f"- 任务：`{self.args.task_id}`", f"- 处理单元：`{self.args.chunk_id}`", f"- 处理单元字符数：{report['chunkCharacters']}", "", "| 用例 | 模型 | HTTP | 耗时 | 成功 | 最后阶段 | 错误 |", "|---|---|---:|---:|---|---|---|"]
        for item in self.results:
            reached = item.get("reached", {})
            stages = [name for name, passed in reached.items() if passed]
            lines.append(f"| {item['caseId']} | {item.get('model') or '当前配置'} | {item.get('httpStatus', 0)} | {item.get('durationMs', 0)} ms | {'是' if item.get('success') else '否'} | {stages[-1] if stages else '模型返回前'} | {item.get('error', {}).get('message', '')} |")
        (root / "report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
        return root

    def run(self) -> None:
        selected = set(self.args.case_id or [])
        cases = [case for case in self.config.get("cases", []) if not selected or case["id"] in selected]
        if selected and len(cases) != len(selected):
            missing = sorted(selected - {case["id"] for case in cases})
            raise ValueError(f"诊断用例不存在：{', '.join(missing)}")
        for case in cases:
            repeats = self.args.repeat or int(case.get("repeat", 1))
            for index in range(1, repeats + 1):
                self.run_case(case, repeat_index=index)
        comparison = self.config.get("comparison", {})
        first_timeout = next((item for item in self.results if not item.get("success") and "timeout" in json.dumps(item, ensure_ascii=False).lower()), None)
        if comparison.get("enabled") and not self.args.no_comparison and first_timeout:
            case = next(item for item in self.config["cases"] if item["id"] == first_timeout["caseId"])
            for index in range(1, int(comparison.get("repeat", 2)) + 1):
                self.run_case(case, model=str(comparison["model"]), repeat_index=index)


def main() -> None:
    parser = argparse.ArgumentParser(description="知识提取单处理单元超时分层诊断")
    parser.add_argument("--task-id", required=True)
    parser.add_argument("--chunk-id", required=True)
    parser.add_argument("--case-file", required=True)
    parser.add_argument("--case-id", action="append")
    parser.add_argument("--repeat", type=int)
    parser.add_argument("--timeout-ms", type=int)
    parser.add_argument("--no-comparison", action="store_true")
    parser.add_argument("--task-root", default=None)
    parser.add_argument("--output", default=None)
    args = parser.parse_args()
    config = read_json(Path(args.case_file).resolve())
    if args.task_root is None:
        args.task_root = str(Path("scripts/pingcode/runtime/web/training-runs") / args.task_id)
    if args.output is None:
        args.output = str(Path(args.task_root) / "quality/knowledge-extraction-diagnostics")
    runner = DiagnosticRunner(args, config)
    runner.run()
    runner.write_reports()
    print(f"诊断完成，报告目录：{args.output}")


if __name__ == "__main__":
    main()
