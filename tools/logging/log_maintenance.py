#!/usr/bin/env python3
"""压缩、清理和聚合知识中心本地日志；仅使用 Python 标准库。"""
from __future__ import annotations

import argparse
import contextlib
import datetime
import fcntl
import gzip
import json
import os
import re
import shutil
import tarfile
import tempfile
import time
from pathlib import Path

SENSITIVE = re.compile(r"(?i)(password|passwd|token|secret|cookie|authorization|api[_-]?key)\s*[=:]\s*(\"(?:[^\"\\\\]|\\\\.)*\"|'(?:[^'\\\\]|\\\\.)*'|[^,\s}\]]+)")
DEFAULT_LOG_DIR = Path(os.environ.get("KNOWLEDGE_CENTER_LOG_DIR", "runtime/agent-runner/logs/knowledge-center-isolated"))
DEFAULT_BUNDLE_DIR = Path("runtime/diagnostics/log-bundles")
ACTIVE_NAMES = {"lifecycle.log", "frontend.log", "document.log", "auth.log", "pingcode.log", "storage.log", "execution.log", "error.log", "preprocessing.jsonl"}
ID_FIELDS = {"requestId", "correlationId", "taskId", "runId"}
CORRELATION_FIELDS = {"requestId", "correlationId", "taskId", "runId"}


def redact(line: str) -> str:
    line = SENSITIVE.sub(lambda m: f"{m.group(1)}=[已隐藏]", line)
    line = re.sub(r'("(?:body|content|prompt)"\s*:\s*)"(?:[^"\\]|\\.)*"', r'\1"[已隐藏]"', line, flags=re.I)
    return re.sub(r'((?:body|content|prompt)\s*[=:]\s*)"[^"\n]*"', r'\1"[已隐藏]"', line, flags=re.I)


def candidates(root: Path):
    yield from (p for p in root.rglob("*") if p.is_file() and (p.name.endswith(".log") or p.name.endswith(".jsonl")))


@contextlib.contextmanager
def maintenance_lock(root: Path):
    lock_path = root / ".log-maintenance.lock"
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    with lock_path.open("a+") as stream:
        fcntl.flock(stream.fileno(), fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(stream.fileno(), fcntl.LOCK_UN)


def active_paths(root: Path) -> set[Path]:
    paths = {p.resolve() for p in root.rglob("*") if p.is_file() and is_active(root, p)}
    for proc in Path("/proc").glob("[0-9]*/fd/*"):
        try:
            target = Path(os.readlink(proc))
            if target.is_absolute() and root.resolve() in target.resolve().parents:
                paths.add(target.resolve())
        except (OSError, RuntimeError):
            continue
    return paths


def is_active(root: Path, path: Path) -> bool:
    """保留当前服务直接写入的流；history/轮转目录中的同名文件可压缩。"""
    return path.parent == root and path.name in ACTIVE_NAMES


def compress(root: Path, after_hours: float, retention_days: float, retention_bytes: int) -> dict:
    with maintenance_lock(root):
        return _compress_locked(root, after_hours, retention_days, retention_bytes)


def _compress_locked(root: Path, after_hours: float, retention_days: float, retention_bytes: int) -> dict:
    now = time.time()
    compressed = skipped = failed = original_bytes = compressed_bytes = 0
    failure_reasons = []
    protected = active_paths(root)
    seen_files = set()
    for source in candidates(root):
        try:
            identity = (source.stat().st_dev, source.stat().st_ino)
        except OSError as error:
            failed += 1
            failure_reasons.append({"file": str(source), "reason": str(error)})
            continue
        if identity in seen_files:
            skipped += 1
            continue
        seen_files.add(identity)
        # Files directly in the log root are active service streams. History and
        # rotated files are safe candidates once they pass the age threshold.
        if source.resolve() in protected or is_active(root, source) or now - source.stat().st_mtime < after_hours * 3600 or source.stat().st_size == 0:
            skipped += 1
            continue
        target = source.with_name(source.name + ".gz")
        temporary = target.with_name(f".{target.name}.{os.getpid()}.tmp")
        try:
            before = source.stat()
            with source.open("rb") as source_stream, gzip.open(temporary, "wb", compresslevel=6) as target_stream:
                shutil.copyfileobj(source_stream, target_stream)
            after = source.stat()
            if (before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns) != (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns):
                raise OSError("源日志在压缩期间发生变化")
            with gzip.open(temporary, "rb") as check, open(os.devnull, "wb") as sink:
                shutil.copyfileobj(check, sink)
            os.utime(temporary, ns=(before.st_atime_ns, before.st_mtime_ns))
            original_bytes += before.st_size
            compressed_bytes += temporary.stat().st_size
            os.replace(temporary, target)
            source.unlink()
            compressed += 1
        except (OSError, EOFError) as error:
            failed += 1
            failure_reasons.append({"file": str(source), "reason": str(error)})
            temporary.unlink(missing_ok=True)

    cutoff = now - retention_days * 86400
    protected = active_paths(root)
    retained = [p for p in root.rglob("*") if p.is_file() and p.resolve() not in protected and not is_active(root, p) and (p.name.endswith(".gz") or p.name.endswith(".log") or p.name.endswith(".jsonl"))]
    deleted = 0
    for item in sorted(retained, key=lambda p: p.stat().st_mtime):
        if item.stat().st_mtime < cutoff:
            item.unlink(missing_ok=True)
            deleted += 1
    total = sum(p.stat().st_size for p in root.rglob("*") if p.is_file())
    for item in sorted((p for p in root.rglob("*") if p.is_file() and p.resolve() not in protected and not is_active(root, p) and (p.name.endswith((".gz", ".log", ".jsonl")))), key=lambda p: p.stat().st_mtime):
        if total <= retention_bytes:
            break
        size = item.stat().st_size
        item.unlink(missing_ok=True)
        total -= size
        deleted += 1
    return {"compressed": compressed, "skipped": skipped, "failed": failed, "failureReasons": failure_reasons, "deleted": deleted, "originalBytes": original_bytes, "compressedBytes": compressed_bytes, "remainingBytes": total, "overLimit": max(0, total - retention_bytes)}


def read_lines(path: Path):
    opener = gzip.open if path.name.endswith(".gz") else open
    with opener(path, "rt", encoding="utf-8", errors="replace") as stream:
        yield from stream


def collect(roots: list[Path], identifier: str, output: Path) -> Path:
    # Collection shares the same lock as compression so a bundle observes a stable file set.
    with contextlib.ExitStack() as stack:
        for lock_root in sorted(roots or [DEFAULT_LOG_DIR], key=str):
            stack.enter_context(maintenance_lock(lock_root))
        return _collect_locked(roots, identifier, output)


def _collect_locked(roots: list[Path], identifier: str, output: Path) -> Path:
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="log-bundle-") as temporary:
        temp = Path(temporary)
        events = []
        sources = []
        read_failures = []
        seen_files = set()
        matched_ids = set()
        seed_ids = set()
        def parse_event(line: str):
            try:
                value = json.loads(line)
                return value if isinstance(value, dict) else None
            except (TypeError, ValueError):
                return None

        records = []
        for root in roots:
            for path in root.rglob("*"):
                if not path.is_file() or not (path.name.endswith((".log", ".jsonl", ".log.gz", ".jsonl.gz"))):
                    continue
                try:
                    identity = (path.stat().st_dev, path.stat().st_ino)
                except OSError:
                    continue
                if identity in seen_files:
                    continue
                seen_files.add(identity)
                try:
                    for line_number, raw in enumerate(read_lines(path), 1):
                        line = raw.rstrip("\n")
                        payload = parse_event(line)
                        record = {"root": root, "path": path, "lineNumber": line_number, "line": redact(line), "payload": payload}
                        records.append(record)
                        if payload and any(payload.get(field) == identifier for field in ID_FIELDS):
                            seed_ids.update(payload.get(field) for field in ID_FIELDS if isinstance(payload.get(field), str))
                except (OSError, EOFError) as error:
                    read_failures.append({"source": str(path), "reason": str(error)})
                    continue
        # Expand only through explicit ID fields; a legacy line is matched on token boundaries.
        matched_ids.update(seed_ids)
        selected = set()
        for index, record in enumerate(records):
            payload = record["payload"]
            if payload and any(payload.get(field) in seed_ids for field in ID_FIELDS):
                selected.add(index)
                for field in CORRELATION_FIELDS:
                    value = payload.get(field)
                    if isinstance(value, str):
                        matched_ids.add(value)
            elif not payload and re.search(rf"(?<![A-Za-z0-9._:-]){re.escape(identifier)}(?![A-Za-z0-9._:-])", record["line"]):
                selected.add(index)
        for index, record in enumerate(records):
            payload = record["payload"]
            if payload and any(isinstance(payload.get(field), str) and payload.get(field) in matched_ids for field in ID_FIELDS):
                selected.add(index)
        for index in sorted(selected):
            record = records[index]
            root, path = record["root"], record["path"]
            relative = f"{root.name}/{path.relative_to(root)}"
            if relative not in sources:
                stat = path.stat()
                sources.append({"path": relative, "compressed": path.name.endswith(".gz"), "mtime": datetime.datetime.fromtimestamp(stat.st_mtime, datetime.timezone.utc).isoformat()})
            events.append({"source": relative, "lineNumber": record["lineNumber"], "parseMode": "json" if record["payload"] else "legacy-text", "line": record["line"]})
        def event_sort_key(item):
            try:
                payload = json.loads(item["line"])
                timestamp = datetime.datetime.fromisoformat(payload.get("timestamp", "").replace("Z", "+00:00"))
                return (timestamp.timestamp(), item["source"], item["lineNumber"])
            except (TypeError, ValueError):
                return (float("inf"), item["source"], item["lineNumber"])
        events.sort(key=event_sort_key)
        (temp / "events.jsonl").write_text("\n".join(json.dumps(item, ensure_ascii=False) for item in events) + "\n", encoding="utf-8")
        timestamps = []
        event_types = {}
        errors = []
        for item in events:
            payload = parse_event(item["line"])
            if not payload:
                continue
            if payload.get("timestamp"):
                timestamps.append(payload["timestamp"])
            event_type = payload.get("event")
            if event_type:
                event_types[event_type] = event_types.get(event_type, 0) + 1
            if payload.get("errorCode") or payload.get("errorType"):
                errors.append({key: payload.get(key) for key in ("timestamp", "service", "event", "errorCode", "errorType", "message") if payload.get(key) is not None})
        manifest = {"identifier": identifier, "matchedIds": sorted(matched_ids), "sources": sources, "eventCount": len(events), "eventTypes": event_types,
            "timeRange": {"start": min(timestamps) if timestamps else None, "end": max(timestamps) if timestamps else None}, "errorSummaries": errors,
            "readFailures": read_failures, "correlationIncomplete": bool(read_failures), "generatedAt": datetime.datetime.now().astimezone().isoformat(timespec="milliseconds")}
        (temp / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
        output = output.with_suffix(".tar.gz")
        with tarfile.open(output, "w:gz") as archive:
            archive.add(temp / "manifest.json", arcname="manifest.json")
            archive.add(temp / "events.jsonl", arcname="events.jsonl")
    return output


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["compress", "collect", "status"])
    parser.add_argument("--root", type=Path, action="append")
    parser.add_argument("--identifier")
    parser.add_argument("--output", type=Path, default=DEFAULT_BUNDLE_DIR / "diagnostic")
    parser.add_argument("--after-hours", type=float, default=float(os.environ.get("KNOWLEDGE_CENTER_LOG_COMPRESS_AFTER_HOURS", "24")))
    parser.add_argument("--retention-days", type=float, default=float(os.environ.get("KNOWLEDGE_CENTER_LOG_RETENTION_DAYS", "14")))
    parser.add_argument("--retention-bytes", type=int, default=int(os.environ.get("KNOWLEDGE_CENTER_LOG_RETENTION_BYTES", str(2 * 1024 ** 3))))
    args = parser.parse_args()
    roots = args.root or [DEFAULT_LOG_DIR, Path("runtime/agent-runner/logs")]
    roots = list(dict.fromkeys(root.resolve() for root in roots))
    roots = [root for root in roots if not any(root != parent and parent in root.parents for parent in roots)]
    for root in roots:
        root.mkdir(parents=True, exist_ok=True)
    if args.command == "compress":
        print(json.dumps({str(root): compress(root, args.after_hours, args.retention_days, args.retention_bytes) for root in roots}, ensure_ascii=False))
    elif args.command == "collect":
        if not args.identifier:
            parser.error("collect 需要 --identifier")
        print(collect(roots, args.identifier, args.output))
    else:
        stats = {}
        for root in roots:
            files = [p for p in root.rglob("*") if p.is_file()]
            stats[str(root)] = {"files": len(files), "bytes": sum(p.stat().st_size for p in files)}
        print(json.dumps(stats, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
