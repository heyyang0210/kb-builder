"""第二步元数据构建：只使用代码规则生成轻量上下文。"""

from __future__ import annotations

import hashlib
import json
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import yaml

from .config import settings
from .models import MetadataBuildReport
from .services import BatchService, FileService, utcnow


class MetadataConstructionError(ValueError):
    pass


class MetadataConstructionService:
    PIPELINE_VERSION = "metadata-construction-v1"

    def __init__(self, batches: BatchService, files: FileService):
        self.batches = batches
        self.files = files
        self.rules, self.rule_set_hash = self._load_rules()

    def build(
        self,
        batch_id: str,
        parent_task_id: str | None = None,
        stage_run_id: str | None = None,
    ) -> MetadataBuildReport:
        self.batches.get(batch_id)
        latest = self._latest_preparation(batch_id)
        input_run_id = latest["runId"]
        input_manifest = self._resolve(latest["manifestPath"])
        manifest = self._read_json(input_manifest)
        input_hash = str(manifest.get("inputManifestHash") or "")
        if not input_hash:
            raise MetadataConstructionError("资料预处理产物缺少输入清单哈希")
        root = input_manifest.parent
        source_docs = self._read_jsonl(root / "metadata/source-documents.jsonl")
        chunks = self._read_jsonl(root / "metadata/chunks.jsonl")
        if not source_docs or not chunks:
            raise MetadataConstructionError("资料预处理产物缺少可构建元数据的文档或处理单元")
        self._validate_inputs(root, source_docs, chunks)
        execution_hash = self._hash_json({"pipelineVersion": self.PIPELINE_VERSION, "inputManifestHash": input_hash, "ruleSetHash": self.rule_set_hash, "sourceDocuments": source_docs, "chunks": chunks})
        batch_root = self.files.manifest_path(batch_id).parent
        cached = self._cached_report(batch_root, execution_hash)
        if cached is not None:
            return cached

        run_id = f"meta_{uuid.uuid4().hex[:16]}"
        run_root = batch_root / "metadata" / "runs" / run_id
        event_log = run_root / "events.jsonl"
        started = utcnow()
        self._emit(event_log, batch_id, run_id, "stage.started", "元数据构建开始", taskId=parent_task_id, stageRunId=stage_run_id)
        documents, contexts, issues = self.build_records(source_docs, chunks)
        for document in documents:
            self._emit(event_log, batch_id, run_id, "work_item.completed", f"元数据构建完成：{document['sourcePath']}", taskId=parent_task_id, stageRunId=stage_run_id, resourceId=document["resourceId"])
        for issue in issues:
            if issue.get("code") == "METADATA_DOCUMENT_FAILED":
                self._emit(event_log, batch_id, run_id, "work_item.failed", issue["message"], taskId=parent_task_id, stageRunId=stage_run_id, resourceId=issue["resourceId"])
        state = "completed_with_warnings" if issues else "completed"
        self._write_jsonl(run_root / "metadata/documents.jsonl", documents)
        self._write_jsonl(run_root / "metadata/chunk-contexts.jsonl", contexts)
        self._write_json(run_root / "quality/metadata-issues.json", issues)
        completed = utcnow()
        stage = {
            "stage": "metadata_construction", "state": state,
            "inputCount": len(source_docs), "outputCount": len(documents),
            "failedCount": sum(1 for item in issues if item["severity"] == "error"),
            "skippedCount": len(source_docs) - len(documents),
            "startedAt": started.isoformat(), "completedAt": completed.isoformat(),
            "durationMs": int((completed - started).total_seconds() * 1000),
            "message": f"元数据构建完成：{len(documents)} 篇文档、{len(contexts)} 个处理单元。",
            "artifacts": ["metadata/documents.jsonl", "metadata/chunk-contexts.jsonl", "quality/metadata-issues.json"],
            "metrics": {"documents": len(documents), "chunks": len(contexts), "issues": len(issues), "inputManifestHash": input_hash, "ruleSetHash": self.rule_set_hash, "ruleSetVersion": self.rules["version"], "executionHash": execution_hash},
        }
        self._write_json(run_root / "stage-result.json", stage)
        self._emit(event_log, batch_id, run_id, "stage.completed", stage["message"], taskId=parent_task_id, stageRunId=stage_run_id, state=state)
        report = MetadataBuildReport(
            batch_id=batch_id, run_id=run_id, state=state, input_run_id=input_run_id,
            input_manifest_hash=input_hash, documents_count=len(documents), chunks_count=len(contexts),
            issue_count=len(issues), artifact_paths=[self._relative(run_root / item) for item in stage["artifacts"]],
            stage_result_path=self._relative(run_root / "stage-result.json"), event_log_path=self._relative(event_log),
            message=stage["message"], created_at=datetime.now(timezone.utc),
        )
        self._write_json(run_root / "report.json", report.model_dump(mode="json", by_alias=True))
        self._write_json(batch_root / "metadata/latest.json", {"runId": run_id, "executionHash": execution_hash, "reportPath": self._relative(run_root / "report.json"), "updatedAt": utcnow().isoformat()})
        return report

    def build_records(
        self,
        source_docs: list[dict[str, Any]],
        chunks: list[dict[str, Any]],
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
        """基于已保存输入确定性重建元数据记录，不读写产物或调用模型。"""
        normalized_chunks = []
        for item in chunks:
            chunk = dict(item)
            chunk_id = chunk.get("chunkId") or chunk.get("id")
            if chunk_id:
                chunk["chunkId"] = chunk_id
            normalized_chunks.append(chunk)

        grouped: dict[str, list[dict[str, Any]]] = {}
        for chunk in normalized_chunks:
            grouped.setdefault(str(chunk.get("resourceId") or ""), []).append(chunk)
        processable = {
            str(item["resourceId"]): item
            for item in source_docs
            if item.get("resourceId") and item.get("processingState") in {"completed", "completed_with_warnings"}
        }
        documents: list[dict[str, Any]] = []
        contexts: list[dict[str, Any]] = []
        issues: list[dict[str, Any]] = []
        for resource_id, document_chunks in grouped.items():
            if resource_id not in processable:
                continue
            try:
                document_chunks.sort(key=lambda item: int(item.get("chunkIndex", 0)))
                document, chunk_contexts, document_issues = self._build_document(processable[resource_id], document_chunks)
                documents.append(document)
                contexts.extend(chunk_contexts)
                issues.extend(document_issues)
            except Exception as exc:
                issues.append(self._issue(resource_id, "METADATA_DOCUMENT_FAILED", "error", f"文档元数据构建失败：{exc}"))
        if not documents:
            raise MetadataConstructionError("没有可进入元数据构建的已处理文档")
        return documents, contexts, issues

    def _build_document(self, source: dict[str, Any], chunks: list[dict[str, Any]]):
        heading_paths = [item.get("headingPath") or [] for item in chunks]
        heading_title = next((path[-1] for path in heading_paths if path), None)
        title_source = "heading" if heading_title else "filename"
        title = heading_title or Path(str(source["sourcePath"])).stem
        semantic_title = self._semantic_title(title)
        full_text = "\n\n".join(str(item.get("content") or "") for item in chunks)
        summary = self._summary(full_text, title)
        category, category_issues = self._category(source["resourceId"], title, heading_paths, full_text)
        domain_terms = self._domain_terms(full_text, chunks)
        keywords = self._keywords(full_text, domain_terms)
        versions = sorted(set(self.rules["versionPattern"].findall(full_text)), key=str.casefold)
        issues: list[dict[str, Any]] = []
        issues.extend(category_issues)
        document = {
            "resourceId": source["resourceId"], "sourcePath": source["sourcePath"], "title": title,
            "semanticTitle": semantic_title,
            "titleSource": title_source, "summary": summary, "summaryMethod": "extractive_rule", "category": category,
            "keywords": keywords, "applicableVersions": versions, "headingCount": len({tuple(path) for path in heading_paths if path}),
            "chunkCount": len(chunks), "metadataIssues": [item["code"] for item in issues],
            "inputHash": self._hash_json(chunks), "ruleSetVersion": self.rules["version"], "ruleSetHash": self.rule_set_hash,
            "domainTerms": domain_terms, "domainCategories": sorted({item["category"] for item in domain_terms}),
        }
        contexts = []
        for index, chunk in enumerate(chunks):
            previous = chunks[index - 1] if index else None
            following = chunks[index + 1] if index + 1 < len(chunks) else None
            contexts.append({
                "chunkId": chunk["chunkId"], "resourceId": source["resourceId"],
                "documentTitle": title, "semanticTitle": semantic_title,
                "headingPath": chunk.get("headingPath") or [], "chunkSummary": self._summary(str(chunk.get("content") or ""), title),
                "summaryMethod": "extractive_rule", "previousChunkId": chunk.get("previousChunkId"),
                "nextChunkId": chunk.get("nextChunkId"), "previousChunkSummary": self._summary(str(previous.get("content") or ""), title) if previous else None,
                "nextChunkSummary": self._summary(str(following.get("content") or ""), title) if following else None,
                "documentCategory": category, "documentKeywords": keywords,
                "domainTerms": [item for item in domain_terms if chunk["chunkId"] in item["chunkIds"]],
                "ruleSetVersion": self.rules["version"], "ruleSetHash": self.rule_set_hash,
            })
        return document, contexts, issues

    def _latest_preparation(self, batch_id: str) -> dict[str, Any]:
        latest_path = self.files.manifest_path(batch_id).parent / "preparation/latest.json"
        if not latest_path.is_file():
            raise MetadataConstructionError("尚未找到资料预处理结果，请先完成步骤一")
        return self._read_json(latest_path)

    def _validate_inputs(self, root: Path, source_docs: list[dict[str, Any]], chunks: list[dict[str, Any]]) -> None:
        resource_ids = {item.get("resourceId") for item in source_docs}
        if None in resource_ids or len(resource_ids) != len(source_docs):
            raise MetadataConstructionError("源文档记录存在缺失或重复 resourceId")
        chunk_ids = [item.get("chunkId") for item in chunks]
        if None in chunk_ids or len(set(chunk_ids)) != len(chunk_ids):
            raise MetadataConstructionError("处理单元记录存在缺失或重复 chunkId")
        if any(item.get("resourceId") not in resource_ids for item in chunks):
            raise MetadataConstructionError("处理单元无法关联源文档")
        for source in source_docs:
            artifact = source.get("normalizedArtifact")
            expected = str(source.get("normalizedHash") or "").removeprefix("sha256:")
            if source.get("processingState") in {"completed", "completed_with_warnings"}:
                if not artifact:
                    raise MetadataConstructionError("可处理文档缺少规范化产物路径")
                path = self._resolve(str(artifact))
                if not path.is_file() or (expected and self._hash_file(path) != expected):
                    raise MetadataConstructionError("规范化文档不存在或内容哈希不一致")
        for chunk in chunks:
            expected = str(chunk.get("contentHash") or "").removeprefix("sha256:")
            actual = hashlib.sha256(str(chunk.get("content") or "").encode()).hexdigest()
            if expected and expected != actual:
                raise MetadataConstructionError(f"处理单元内容哈希不一致：{chunk.get('chunkId')}")

    def _cached_report(self, batch_root: Path, execution_hash: str) -> MetadataBuildReport | None:
        latest = batch_root / "metadata/latest.json"
        if not latest.is_file():
            return None
        value = self._read_json(latest)
        if value.get("executionHash") != execution_hash or not value.get("reportPath"):
            return None
        report_path = self._resolve(str(value["reportPath"]))
        if not report_path.is_file():
            return None
        return MetadataBuildReport.model_validate(self._read_json(report_path))

    @staticmethod
    def _summary(text: str, title: str) -> str:
        clean = re.sub(r"```.*?```", "", text, flags=re.S)
        clean = re.sub(r"^#{1,6}\s+", "", clean, flags=re.M)
        clean = re.sub(r"\s+", " ", clean).strip(" -|\t")
        if not clean:
            return title
        parts = re.split(r"(?<=[。！？.!?])\s+", clean)
        return "".join(parts[:2])[:240]

    def _category(self, resource_id: str, title: str, heading_paths: list[list[str]], text: str) -> tuple[str, list[dict[str, Any]]]:
        scores: list[tuple[str, float]] = []
        for item in self.rules["categories"]:
            score = 0.0
            for word in item["keywords"]:
                normalized = word.casefold()
                if normalized in title.casefold():
                    score += item["weight"] * 2.0
                if any(normalized in heading.casefold() for path in heading_paths for heading in path):
                    score += item["weight"] * 1.5
                if normalized in text.casefold():
                    score += item["weight"]
            if score:
                scores.append((item["name"], score))
        scores.sort(key=lambda item: item[1], reverse=True)
        if not scores:
            return "未分类", [self._issue(resource_id, "METADATA_CATEGORY_UNRESOLVED", "info", "文档分类无法由固定规则确定，已归类为“未分类”，不影响知识提取")]
        if len(scores) > 1 and scores[0][1] == scores[1][1]:
            return "未分类", [self._issue(resource_id, "METADATA_CATEGORY_CONFLICT", "info", f"文档命中多个分类候选：{scores[0][0]}、{scores[1][0]}，已暂按未分类处理，不影响知识提取")]
        return scores[0][0], []

    def _keywords(self, text: str, domain_terms: list[dict[str, Any]]) -> list[str]:
        values = [item["canonicalName"] for item in domain_terms]
        for pattern in self.rules["keywordPatterns"]:
            values.extend(pattern.findall(text))
        stopwords = self.rules["stopwords"]
        result: list[str] = []
        for value in values:
            value = value.strip(".,;:()[]{}，。；：（）【】")
            excluded = any(pattern.fullmatch(value) for pattern in self.rules["keywordExclusionPatterns"])
            if value and not excluded and value.casefold() not in stopwords and value not in result and len(result) < 20:
                result.append(value)
        return result

    def _semantic_title(self, title: str) -> str:
        value = str(title or "")
        rules = self.rules["titleCleaning"]
        for term in sorted(rules["removeTerms"], key=len, reverse=True):
            value = re.sub(re.escape(term), " ", value, flags=re.I)
        for suffix in sorted(rules["removeSuffixes"], key=len, reverse=True):
            value = re.sub(rf"{re.escape(suffix)}\s*$", " ", value, flags=re.I)
        for pattern, replacement in rules["replacementPatterns"]:
            value = pattern.sub(replacement, value)
        return value.strip(rules["trimCharacters"])

    def _domain_terms(self, text: str, chunks: list[dict[str, Any]]) -> list[dict[str, Any]]:
        result: dict[str, dict[str, Any]] = {}
        chunk_text = {item["chunkId"]: str(item.get("content") or "") for item in chunks}
        error_codes = sorted(set(re.findall(r"\b(?:YAS|ORA)-\d{5}\b", text, re.I)))
        if error_codes:
            result["yashandb.error_code"] = {
                "termId": "yashandb.error_code",
                "canonicalName": "YashanDB Error Code", "matchedAliases": error_codes, "matchedCodes": error_codes, "occurrences": sum(text.casefold().count(code.casefold()) for code in error_codes),
                "chunkIds": [chunk_id for chunk_id, content in chunk_text.items() if any(code.casefold() in content.casefold() for code in error_codes)],
                "category": "故障诊断", "termType": "error_code", "source": "yashandb", "matchPriority": 2,
            }
        for glossary_name in ("yashandb", "database"):
            for term in self.rules["glossaries"][glossary_name]:
                aliases = list(dict.fromkeys(
                    alias
                    for alias in [*term["aliases"], term["canonicalName"], term.get("displayName", "")]
                    if alias
                ))
                aliases.sort(key=len, reverse=True)
                matched_chunks = [chunk_id for chunk_id, content in chunk_text.items() if any(alias and alias.casefold() in content.casefold() for alias in aliases)]
                if not matched_chunks:
                    continue
                result[term["termId"]] = {"termId": term["termId"], "canonicalName": term["canonicalName"], "aliases": aliases, "matchedAliases": [alias for alias in aliases if alias.casefold() in text.casefold()], "occurrences": sum(text.casefold().count(alias.casefold()) for alias in aliases), "chunkIds": matched_chunks, "category": term["category"], "termType": term["termType"], "source": glossary_name, "matchPriority": 2 if glossary_name == "yashandb" else 1}
        return list(result.values())

    @classmethod
    def _load_rules(cls) -> tuple[dict[str, Any], str]:
        root = settings.processing_skill_root.parent / "metadata-rules"
        try:
            manifest = cls._load_yaml(root / "manifest.yaml")
            files = [root / item for item in manifest["files"]]
            payloads = [cls._load_yaml(path) if path.suffix in {".yaml", ".yml"} else {"stopwords": path.read_text(encoding="utf-8").splitlines()} for path in files]
            categories = payloads[0].get("categories", [])
            keyword_rules = payloads[1].get("patterns", [])
            keyword_exclusions = payloads[1].get("exclusionPatterns", [])
            version_rules = payloads[2].get("patterns", [])
            glossaries = {"database": payloads[3].get("terms", []), "yashandb": payloads[4].get("terms", [])}
            title_cleaning = payloads[6]
            all_terms = [term["termId"] for items in glossaries.values() for term in items]
            if len(all_terms) != len(set(all_terms)):
                raise ValueError("数据库词典存在重复 termId")
            rules = {
                "version": manifest["ruleSetVersion"],
                "categories": categories,
                "keywordPatterns": [re.compile(item["pattern"], re.I) for item in keyword_rules],
                "keywordExclusionPatterns": [re.compile(item["pattern"], re.I) for item in keyword_exclusions],
                "versionPattern": re.compile(version_rules[0]["pattern"], re.I),
                "glossaries": glossaries,
                "stopwords": {item.casefold() for item in payloads[5].get("stopwords", []) if item.strip()},
                "titleCleaning": {
                    "removeTerms": list(title_cleaning.get("removeTerms", [])),
                    "removeSuffixes": list(title_cleaning.get("removeSuffixes", [])),
                    "titleGlossaryConfidence": float(title_cleaning["titleGlossaryConfidence"]),
                    "replacementPatterns": [
                        (re.compile(item["pattern"], re.I), str(item.get("replacement", "")))
                        for item in title_cleaning.get("replacementPatterns", [])
                    ],
                    "trimCharacters": str(title_cleaning.get("trimCharacters", " ")),
                },
            }
            raw = b"".join(path.read_bytes() for path in [root / "manifest.yaml", *files])
            return rules, "sha256:" + hashlib.sha256(raw).hexdigest()
        except (OSError, KeyError, TypeError, ValueError, re.error, yaml.YAMLError) as exc:
            raise MetadataConstructionError(f"元数据规则加载失败：{exc}") from exc

    @staticmethod
    def _load_yaml(path: Path) -> dict[str, Any]:
        value = yaml.safe_load(path.read_text(encoding="utf-8"))
        if not isinstance(value, dict):
            raise ValueError(f"规则文件不是对象：{path.name}")
        return value

    @staticmethod
    def _issue(resource_id: str, code: str, severity: str, message: str) -> dict[str, Any]:
        return {"issueId": hashlib.sha256(f"{resource_id}:{code}:{message}".encode()).hexdigest()[:24], "resourceId": resource_id, "code": code, "severity": severity, "message": message}

    @staticmethod
    def _read_json(path: Path) -> dict[str, Any]:
        try:
            value = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise MetadataConstructionError(f"无法读取元数据输入：{path.name}") from exc
        if not isinstance(value, dict):
            raise MetadataConstructionError(f"元数据输入不是对象：{path.name}")
        return value

    @staticmethod
    def _read_jsonl(path: Path) -> list[dict[str, Any]]:
        if not path.is_file():
            raise MetadataConstructionError(f"元数据输入文件不存在：{path.name}")
        result = []
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                value = json.loads(line)
                if not isinstance(value, dict):
                    raise MetadataConstructionError(f"JSONL 记录不是对象：{path.name}")
                result.append(value)
        return result

    @staticmethod
    def _write_json(path: Path, value: Any) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(path.suffix + ".tmp")
        temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
        temporary.replace(path)

    @classmethod
    def _write_jsonl(cls, path: Path, values: list[dict[str, Any]]) -> None:
        cls._write_text(path, "".join(json.dumps(value, ensure_ascii=False) + "\n" for value in values))

    @staticmethod
    def _write_text(path: Path, value: str) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(path.suffix + ".tmp")
        temporary.write_text(value, encoding="utf-8")
        temporary.replace(path)

    @staticmethod
    def _hash_json(value: Any) -> str:
        return "sha256:" + hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()).hexdigest()

    @staticmethod
    def _hash_file(path: Path) -> str:
        digest = hashlib.sha256()
        with path.open("rb") as source:
            for block in iter(lambda: source.read(1024 * 1024), b""):
                digest.update(block)
        return digest.hexdigest()

    @staticmethod
    def _resolve(relative: str) -> Path:
        path = (settings.data_root / relative).resolve()
        if settings.data_root.resolve() not in path.parents:
            raise MetadataConstructionError("元数据输入路径超出数据根目录")
        return path

    @staticmethod
    def _relative(path: Path) -> str:
        return path.resolve().relative_to(settings.data_root.resolve()).as_posix()

    @staticmethod
    def _emit(path: Path, batch_id: str, run_id: str, event: str, message: str, **details: Any) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        record = {"timestamp": datetime.now(timezone.utc).isoformat(), "event": event, "batchId": batch_id, "runId": run_id, "message": message, "details": details}
        with path.open("a", encoding="utf-8") as output:
            output.write(json.dumps(record, ensure_ascii=False) + "\n")
