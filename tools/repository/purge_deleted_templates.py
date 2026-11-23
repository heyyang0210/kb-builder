#!/usr/bin/env python3
"""Preview or purge logically deleted templates from the local Storage aggregate."""

import argparse
import hashlib
import json
import os
import re
import sys
import uuid
from datetime import date, datetime, time, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen


BACKUP_DIR = Path(__file__).resolve().parents[2] / "runtime/maintenance/template-purge"


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description="预检或清理已删除模板；默认只读预检")
    parser.add_argument("--before", help="清理此日期 UTC 零点之前删除的模板，格式 YYYY-MM-DD")
    parser.add_argument("--storage-url", default="http://127.0.0.1:14210", help="本机 Storage 地址")
    parser.add_argument("--apply", action="store_true", help="执行清理；不传时只读预检")
    parser.add_argument("--expected-revision", type=int, help="预检输出的模板聚合 revision")
    parser.add_argument("--approval-ref", help="真实数据删除批准的引用编号")
    args = parser.parse_args(argv)
    url = urlsplit(args.storage_url)
    try:
        port = url.port
    except ValueError as error:
        parser.error(f"存储地址端口无效：{error}")
    if (url.scheme != "http" or url.hostname not in ("127.0.0.1", "localhost", "::1")
            or url.username or url.password or url.path not in ("", "/")
            or url.query or url.fragment or port is None):
        parser.error("存储地址必须是本机 HTTP 根地址并包含端口")
    args.storage_url = f"{url.scheme}://{url.netloc}"
    if args.before:
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", args.before):
            parser.error("--before 必须是有效的 YYYY-MM-DD 日期")
        try:
            date.fromisoformat(args.before)
        except ValueError:
            parser.error("--before 必须是有效的 YYYY-MM-DD 日期")
    if args.apply and (not args.before or not args.expected_revision
                       or args.expected_revision < 1 or not (args.approval_ref or "").strip()):
        parser.error("执行清理必须同时提供 --before、--expected-revision 和 --approval-ref")
    return args


def request_json(url, method="GET", payload=None, revision=None):
    data = None if payload is None else json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    headers = {"Content-Type": "application/json"} if data is not None else {}
    if revision is not None:
        headers["If-Match"] = str(revision)
    request = Request(url, data=data, headers=headers, method=method)
    try:
        with urlopen(request, timeout=15) as response:
            return response.status, json.load(response)
    except HTTPError as error:
        try:
            result = json.load(error)
        except (ValueError, UnicodeError):
            result = {}
        return error.code, result
    except (URLError, TimeoutError) as error:
        raise RuntimeError(f"Storage 请求失败：{error}") from error


def record(base, namespace):
    status, result = request_json(f"{base}/v1/records/{namespace}/state")
    if status == 404 and namespace == "template-mappings":
        return {"revision": 0, "payload": {}}
    if status != 200 or result.get("success") is False:
        raise RuntimeError(f"{namespace} 读取失败：{result.get('error', {}).get('code', status)}")
    if result.get("deleted") or not isinstance(result.get("payload"), dict):
        raise ValueError(f"{namespace} 聚合记录无效")
    return result


def current_references(mapping):
    found = set()

    def visit(value):
        if isinstance(value, dict):
            if isinstance(value.get("templateId"), str):
                found.add(value["templateId"])
            for child in value.values():
                visit(child)
        elif isinstance(value, list):
            for child in value:
                visit(child)

    visit(mapping.get("rules", []))
    visit(mapping.get("effective", {}))
    return found


def plan_purge(state, mapping, before):
    if not isinstance(state, dict) or not isinstance(state.get("templates"), list) or not isinstance(state.get("audits"), list):
        raise ValueError("模板聚合缺少 templates 或 audits 数组")
    if not isinstance(mapping, dict):
        raise ValueError("映射聚合格式无效")
    identifiers = [item.get("id") if isinstance(item, dict) else None for item in state["templates"]]
    if any(not isinstance(item, str) or not item for item in identifiers) or len(set(identifiers)) != len(identifiers):
        raise ValueError("模板聚合包含缺失或重复的模板 ID")
    cutoff = datetime.combine(date.fromisoformat(before), time.min, timezone.utc)
    references = current_references(mapping)
    eligible, blocked, invalid_date = [], [], []
    for template in state["templates"]:
        if template.get("status") != "deleted":
            continue
        try:
            updated = datetime.fromisoformat(template["updatedAt"].replace("Z", "+00:00"))
            if updated.tzinfo is None:
                raise ValueError("timezone missing")
        except (KeyError, AttributeError, TypeError, ValueError):
            invalid_date.append(template["id"])
            continue
        if updated >= cutoff:
            continue
        (blocked if template["id"] in references else eligible).append(template["id"])
    removed = set(eligible)
    next_state = {**state, "templates": [item for item in state["templates"] if item["id"] not in removed]}
    return eligible, blocked, invalid_date, next_state


def json_bytes(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def run(args, backup_dir=BACKUP_DIR):
    source = record(args.storage_url, "templates")
    mapping = record(args.storage_url, "template-mappings")
    before = args.before or datetime.now(timezone.utc).date().isoformat()
    eligible, blocked, invalid_date, next_state = plan_purge(source["payload"], mapping["payload"], before)
    summary = {
        "mode": "apply" if args.apply else "dry-run", "revision": source["revision"], "before": before,
        "total": len(source["payload"]["templates"]),
        "deleted": sum(item["status"] == "deleted" for item in source["payload"]["templates"]),
        "eligible": eligible, "blockedByCurrentMapping": blocked, "invalidDate": invalid_date,
        "bytesBefore": len(json_bytes(source["payload"])), "bytesAfter": len(json_bytes(next_state)),
    }
    if not args.apply or not eligible:
        return summary
    if args.expected_revision != source["revision"]:
        raise RuntimeError("模板聚合修订号已变化，请重新预检")

    backup_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(backup_dir, 0o700)
    backup = backup_dir / f"templates-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}-{uuid.uuid4()}.json"
    content = json.dumps({"source": source, "mappingRevision": mapping["revision"],
                          "approvalRef": args.approval_ref, "cutoff": before, "eligible": eligible},
                         ensure_ascii=False, indent=2).encode("utf-8")
    descriptor = os.open(backup, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "wb") as output:
        output.write(content)
        output.flush()
        os.fsync(output.fileno())
    digest = hashlib.sha256(content).hexdigest()
    if hashlib.sha256(backup.read_bytes()).hexdigest() != digest:
        raise RuntimeError(f"备份校验失败，未提交清理：{backup}")

    status, result = request_json(f"{args.storage_url}/v1/records/templates/state", "PUT", next_state,
                                  source["revision"])
    if status != 200 or result.get("success") is False:
        raise RuntimeError(f"清理未提交：{result.get('error', {}).get('code', status)}；备份 {backup}")
    after = record(args.storage_url, "templates")
    if after["payload"] != next_state:
        raise RuntimeError(f"写后回读不一致；备份 {backup}")
    return {**summary, "newRevision": after["revision"], "backup": str(backup), "backupSha256": digest}


if __name__ == "__main__":
    try:
        print(json.dumps(run(parse_args()), ensure_ascii=False, indent=2))
    except (RuntimeError, ValueError, OSError) as error:
        print(f"错误：{error}", file=sys.stderr)
        sys.exit(1)
