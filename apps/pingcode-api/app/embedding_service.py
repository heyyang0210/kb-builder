"""资源预处理阶段 embedding 生成与缓存。"""

from __future__ import annotations

import hashlib
import json
import math
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class EmbeddingService:
    def __init__(self, config: dict[str, Any], rule_set_hash: str):
        self.config = config or {}
        self.rule_set_hash = rule_set_hash

    def build(
        self,
        run_root: Path,
        documents: list[dict[str, Any]],
        contexts: list[dict[str, Any]],
        chunks: list[dict[str, Any]] | None = None,
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        if not self._profile().get("enabled", True):
            issue = self._issue("EMBEDDING_SKIPPED_DISABLED", "embedding 配置已禁用，跳过向量生成")
            self._write_jsonl(run_root / "metadata/embedding-index.jsonl", [])
            self._write_json(run_root / "quality/embedding-issues.json", [issue])
            return [], [issue]

        records: list[dict[str, Any]] = []
        issues: list[dict[str, Any]] = []
        cache_dir = run_root / str(self._cache().get("directory") or "model-results/embedding-cache")
        provider = self._provider()
        if provider.get("type") != "deterministic_hash":
            issue = self._issue(
                "EMBEDDING_PROVIDER_UNAVAILABLE",
                f"embedding provider {provider.get('type')} 暂不可用，已跳过向量生成",
            )
            self._write_jsonl(run_root / "metadata/embedding-index.jsonl", [])
            self._write_json(run_root / "quality/embedding-issues.json", [issue])
            return [], [issue]

        context_by_chunk = {str(item.get("chunkId") or ""): item for item in contexts}
        chunks_by_id = {str(item.get("chunkId") or item.get("id") or ""): item for item in chunks or []}
        docs_by_resource = {str(item.get("resourceId") or ""): item for item in documents}
        for context in contexts:
            started = time.perf_counter()
            resource_id = str(context.get("resourceId") or "")
            chunk_id = str(context.get("chunkId") or "")
            document = docs_by_resource.get(resource_id, {})
            text = self._embedding_text(document, context, chunks_by_id.get(chunk_id, {}))
            input_hash = self._hash_text(text)
            content_hash = str(context.get("contentHash") or document.get("contentHash") or input_hash).removeprefix("sha256:")
            cache_key = self._cache_key(document, context, input_hash)
            cache_path = cache_dir / f"{cache_key}.json"
            cache_hit = False
            vector: list[float] | None = None
            if cache_path.is_file():
                try:
                    cached = json.loads(cache_path.read_text(encoding="utf-8"))
                    candidate = cached.get("vector")
                    if isinstance(candidate, list) and len(candidate) == self.dimension:
                        vector = [float(item) for item in candidate]
                        cache_hit = True
                    else:
                        issues.append(self._issue("EMBEDDING_CACHE_CORRUPTED", f"embedding 缓存维度不一致，已重算：{chunk_id}", resource_id=resource_id, chunk_id=chunk_id))
                except (OSError, json.JSONDecodeError, TypeError, ValueError):
                    issues.append(self._issue("EMBEDDING_CACHE_CORRUPTED", f"embedding 缓存无法读取，已重算：{chunk_id}", resource_id=resource_id, chunk_id=chunk_id))
            if vector is None:
                vector = self._hash_embedding(text)
                self._write_json(cache_path, {
                    "schemaVersion": "1.0",
                    "cacheKey": cache_key,
                    "provider": provider.get("type"),
                    "model": provider.get("model"),
                    "dimension": self.dimension,
                    "inputHash": input_hash,
                    "vector": vector,
                    "createdAt": utcnow_iso(),
                })
            vector_hash = self._hash_json(vector)
            embedding_id = "emb_" + hashlib.sha1(f"{cache_key}:{chunk_id}".encode("utf-8")).hexdigest()[:20]
            records.append({
                "schemaVersion": "1.0",
                "embeddingId": embedding_id,
                "scope": "chunk",
                "resourceId": resource_id,
                "chunkId": chunk_id,
                "sourcePath": context.get("sourcePath") or document.get("sourcePath"),
                "semanticTitle": context.get("semanticTitle") or document.get("semanticTitle"),
                "textKind": provider.get("textKind"),
                "contentHash": "sha256:" + content_hash,
                "inputHash": input_hash,
                "provider": provider.get("type"),
                "model": provider.get("model"),
                "dimension": self.dimension,
                "vectorHash": vector_hash,
                "cacheKey": cache_key,
                "cacheHit": cache_hit,
                "status": "completed",
                "durationMs": int((time.perf_counter() - started) * 1000),
                "createdAt": utcnow_iso(),
            })
        missing = sorted(set(context_by_chunk) - {item["chunkId"] for item in records})
        for chunk_id in missing:
            issues.append(self._issue("EMBEDDING_SKIPPED_EMPTY_INPUT", f"处理单元没有可向量化输入：{chunk_id}", chunk_id=chunk_id))
        self._write_jsonl(run_root / "metadata/embedding-index.jsonl", records)
        self._write_json(run_root / "quality/embedding-issues.json", issues)
        return records, issues

    @property
    def dimension(self) -> int:
        return max(1, int(self._provider().get("dimension") or 64))

    def _profile(self) -> dict[str, Any]:
        value = self.config.get("profile")
        return value if isinstance(value, dict) else {}

    def _provider(self) -> dict[str, Any]:
        value = self.config.get("provider")
        return value if isinstance(value, dict) else {}

    def _cache(self) -> dict[str, Any]:
        value = self.config.get("cache")
        return value if isinstance(value, dict) else {}

    def _embedding_text(self, document: dict[str, Any], context: dict[str, Any], chunk: dict[str, Any] | None = None) -> str:
        chunk = chunk or {}
        parts = [
            str(context.get("semanticTitle") or document.get("semanticTitle") or ""),
            str(context.get("chunkSummary") or document.get("summary") or ""),
            " ".join(str(item.get("name") or item.get("canonicalName") or "") for item in document.get("topicCandidates") or [] if isinstance(item, dict)),
            str(chunk.get("content") or context.get("content") or ""),
        ]
        return "\n".join(part.strip() for part in parts if part and part.strip())

    def _cache_key(self, document: dict[str, Any], context: dict[str, Any], input_hash: str) -> str:
        provider = self._provider()
        profile = self._profile()
        payload = {
            "contentHash": context.get("contentHash") or document.get("contentHash"),
            "inputHash": input_hash,
            "semanticTitle": context.get("semanticTitle") or document.get("semanticTitle"),
            "metadataRuleSetHash": self.rule_set_hash,
            "embeddingProfileVersion": profile.get("version"),
            "provider": provider.get("type"),
            "model": provider.get("model"),
            "dimension": provider.get("dimension"),
            "textKind": provider.get("textKind"),
        }
        return "embcache_" + hashlib.sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()[:32]

    def _hash_embedding(self, text: str) -> list[float]:
        vector = [0.0] * self.dimension
        tokens = self._tokens(text)
        for token in tokens:
            digest = hashlib.sha256(token.encode("utf-8")).digest()
            index = int.from_bytes(digest[:4], "big") % self.dimension
            sign = 1.0 if digest[4] % 2 == 0 else -1.0
            vector[index] += sign
        magnitude = math.sqrt(sum(item * item for item in vector))
        if magnitude == 0:
            return vector
        return [round(item / magnitude, 8) for item in vector]

    @staticmethod
    def _tokens(text: str) -> list[str]:
        words = re.findall(r"[a-z0-9_]+|[\u4e00-\u9fff]", text.casefold())
        bigrams = [f"{words[index]}:{words[index + 1]}" for index in range(len(words) - 1)]
        return [*words, *bigrams]

    @staticmethod
    def _issue(code: str, message: str, *, resource_id: str | None = None, chunk_id: str | None = None) -> dict[str, Any]:
        issue_id = hashlib.sha256(f"{code}:{resource_id}:{chunk_id}:{message}".encode("utf-8")).hexdigest()[:24]
        return {
            "issueId": issue_id,
            "code": code,
            "severity": "warning",
            "message": message,
            "resourceId": resource_id,
            "chunkId": chunk_id,
        }

    @staticmethod
    def _hash_text(value: str) -> str:
        return "sha256:" + hashlib.sha256(value.encode("utf-8")).hexdigest()

    @staticmethod
    def _hash_json(value: Any) -> str:
        return "sha256:" + hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()

    @staticmethod
    def _write_json(path: Path, value: Any) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(path.suffix + ".tmp")
        temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
        temporary.replace(path)

    @staticmethod
    def _write_jsonl(path: Path, values: list[dict[str, Any]]) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(path.suffix + ".tmp")
        temporary.write_text("".join(json.dumps(value, ensure_ascii=False) + "\n" for value in values), encoding="utf-8")
        temporary.replace(path)
