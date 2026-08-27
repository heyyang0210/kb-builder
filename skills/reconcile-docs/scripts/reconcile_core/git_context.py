from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Any

from .contracts import ContractError, digest_value, match_path, utc_now


def run_git(repo: Path, *args: str, check: bool = True) -> str:
    process = subprocess.run(
        ["git", *args],
        cwd=repo,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        encoding="utf-8",
    )
    if check and process.returncode != 0:
        raise ContractError(f"git {' '.join(args)} failed: {process.stderr.strip()}")
    return process.stdout


def discover_repo(start: str | Path | None) -> Path:
    candidate = Path(start or ".").resolve()
    output = run_git(candidate, "rev-parse", "--show-toplevel")
    return Path(output.strip()).resolve()


def git_head(repo: Path) -> str:
    return run_git(repo, "rev-parse", "HEAD").strip()


def is_ancestor(repo: Path, baseline: str, target: str) -> bool:
    process = subprocess.run(
        ["git", "merge-base", "--is-ancestor", baseline, target],
        cwd=repo,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return process.returncode == 0


def worktree_changes(repo: Path, ignored_patterns: list[str] | None = None) -> list[dict[str, Any]]:
    ignored_patterns = ignored_patterns or []
    raw = run_git(repo, "status", "--porcelain=v1", "-z", "--untracked-files=all")
    fields = raw.split("\0")
    changes: list[dict[str, Any]] = []
    index = 0
    while index < len(fields) and fields[index]:
        entry = fields[index]
        index += 1
        status = entry[:2]
        path = entry[3:]
        original_path = fields[index] if status[0] in {"R", "C"} and index < len(fields) else None
        if match_path(path, ignored_patterns) or (original_path and match_path(original_path, ignored_patterns)):
            if original_path is not None:
                index += 1
            continue
        item: dict[str, Any] = {"status": status, "path": path, "preExisting": True}
        if status[0] in {"R", "C"} and index < len(fields):
            item["originalPath"] = fields[index]
            index += 1
        changes.append(item)
    return sorted(changes, key=lambda value: (value["path"], value["status"]))


def committed_changes(repo: Path, baseline: str | None, target: str, mode: str) -> list[dict[str, str]]:
    if mode == "full":
        paths = run_git(repo, "ls-tree", "-r", "--name-only", target).splitlines()
        return [{"status": "PRESENT", "path": path} for path in sorted(paths) if path]
    if not baseline:
        return []
    raw = run_git(repo, "diff", "--name-status", "-z", baseline, target)
    fields = raw.split("\0")
    changes: list[dict[str, str]] = []
    index = 0
    while index < len(fields) and fields[index]:
        status = fields[index]
        index += 1
        if status.startswith(("R", "C")):
            old_path, new_path = fields[index], fields[index + 1]
            index += 2
            changes.append({"status": status, "path": new_path, "originalPath": old_path})
        else:
            path = fields[index]
            index += 1
            changes.append({"status": status, "path": path})
    return sorted(changes, key=lambda value: (value["path"], value["status"]))


def tracked_inventory(repo: Path, target: str, policy: dict[str, Any]) -> list[dict[str, str]]:
    raw = run_git(repo, "-c", "core.quotePath=false", "ls-tree", "-r", "-z", target)
    include = policy["inventory"].get("include", ["**/*"])
    exclude = policy["inventory"].get("exclude", [])
    inventory: list[dict[str, str]] = []
    for line in raw.split("\0"):
        if not line:
            continue
        metadata, path = line.split("\t", 1)
        mode, kind, object_id = metadata.split()
        if kind != "blob" or not match_path(path, include) or match_path(path, exclude):
            continue
        inventory.append({"path": path, "mode": mode, "objectId": object_id})
    return sorted(inventory, key=lambda value: value["path"])


def map_paths_to_modules(paths: list[str], policy: dict[str, Any]) -> dict[str, dict[str, list[str]]]:
    result: dict[str, dict[str, list[str]]] = {}
    category_globs = {
        "code": "codeGlobs",
        "documents": "documentGlobs",
        "intent": "intentGlobs",
        "verification": "verificationGlobs",
    }
    for module_id, module in policy["modules"].items():
        categories = {name: [] for name in category_globs}
        for path in paths:
            for category, key in category_globs.items():
                if match_path(path, module.get(key, [])):
                    categories[category].append(path)
        if any(categories.values()):
            result[module_id] = categories
    return result


def build_snapshot(repo: Path, target: str, policy: dict[str, Any], policy_digest: str) -> dict[str, Any]:
    inventory = tracked_inventory(repo, target, policy)
    paths = [item["path"] for item in inventory]
    ignored = list(policy["inventory"].get("exclude", []))
    ignored.extend([f"{policy['contextRoot'].rstrip('/')}/**", f"{policy['auditRoot'].rstrip('/')}/**"])
    worktree = worktree_changes(repo, ignored)
    return {
        "schemaVersion": "reconcile-snapshot/v1",
        "capturedAt": utc_now(),
        "runStartHead": target,
        "policyDigest": policy_digest,
        "inventoryDigest": digest_value(inventory),
        "inventory": inventory,
        "moduleInventory": map_paths_to_modules(paths, policy),
        "preExisting": worktree,
    }
