#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from reconcile_core.contracts import (
    ContractError,
    atomic_write_json,
    atomic_write_text,
    digest_file,
    digest_value,
    load_json,
    load_policy,
    resolve_repo_path,
    utc_now,
)
from reconcile_core.git_context import (
    build_snapshot,
    committed_changes,
    discover_repo,
    git_head,
    is_ancestor,
    run_git,
    worktree_changes,
)
from reconcile_core.reconciliation import reconcile


EXIT_CONFIRMATION = 2
EXIT_CONTRACT = 3
EXIT_VALIDATION = 4


def emit(value: dict[str, Any]) -> None:
    print(json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True))


def runtime(args: argparse.Namespace) -> tuple[Path, Path, dict[str, Any], Path, Path, str, str]:
    repo = discover_repo(args.repo)
    config_path, policy = load_policy(repo, args.config)
    context_root = resolve_repo_path(repo, args.context_root, policy["contextRoot"])
    audit_root = resolve_repo_path(repo, args.output, policy["auditRoot"])
    target = git_head(repo)
    policy_digest = digest_value(policy)
    return repo, config_path, policy, context_root, audit_root, target, policy_digest


def checkpoint_data(context_root: Path) -> dict[str, Any] | None:
    path = context_root / "checkpoint.json"
    return load_json(path) if path.exists() else None


def runtime_ignored_patterns(policy: dict[str, Any]) -> list[str]:
    patterns = list(policy["inventory"].get("exclude", []))
    patterns.extend([f"{policy['contextRoot'].rstrip('/')}/**", f"{policy['auditRoot'].rstrip('/')}/**"])
    return patterns


def readiness_result(
    repo: Path,
    target: str,
    policy_digest: str,
    checkpoint: dict[str, Any] | None,
    ignored_patterns: list[str] | None = None,
) -> dict[str, Any]:
    state = "READY"
    reasons: list[str] = []
    if checkpoint is None:
        state = "BOOTSTRAP_REQUIRED"
        reasons.append("没有上次成功审计检查点；增量审计需要确认初始基线")
    else:
        baseline = checkpoint.get("lastSuccessfulRef")
        if not baseline or not is_ancestor(repo, baseline, target):
            state = "BASELINE_NOT_ANCESTOR"
            reasons.append("上次成功基线不是本轮冻结 HEAD 的祖先")
        if checkpoint.get("policyDigest") != policy_digest:
            state = "POLICY_CHANGED"
            reasons.append("治理配置自上次成功审计后发生变化，需要全量复核")
    return {
        "schemaVersion": "reconcile-readiness/v1",
        "state": state,
        "runStartHead": target,
        "lastSuccessfulRef": checkpoint.get("lastSuccessfulRef") if checkpoint else None,
        "policyDigest": policy_digest,
        "reasons": reasons,
        "preExistingCount": len(worktree_changes(repo, ignored_patterns)),
    }


def cmd_readiness(args: argparse.Namespace) -> int:
    repo, config_path, policy, context_root, _, target, policy_digest = runtime(args)
    result = readiness_result(
        repo,
        target,
        policy_digest,
        checkpoint_data(context_root),
        runtime_ignored_patterns(policy),
    )
    result["repo"] = str(repo)
    result["config"] = str(config_path)
    emit(result)
    return 0 if result["state"] == "READY" else EXIT_CONFIRMATION


def cmd_refresh(args: argparse.Namespace) -> int:
    repo, config_path, policy, context_root, _, target, policy_digest = runtime(args)
    snapshot = build_snapshot(repo, target, policy, policy_digest)
    snapshot_path = context_root / "snapshot.json"
    atomic_write_json(snapshot_path, snapshot)
    ledger_path = context_root / "change-ledger.jsonl"
    ledger_path.parent.mkdir(parents=True, exist_ok=True)
    ledger_entry = {
        "capturedAt": snapshot["capturedAt"],
        "head": target,
        "inventoryDigest": snapshot["inventoryDigest"],
        "policyDigest": policy_digest,
        "preExistingCount": len(snapshot["preExisting"]),
    }
    with ledger_path.open("a", encoding="utf-8", newline="\n") as handle:
        handle.write(json.dumps(ledger_entry, ensure_ascii=False, sort_keys=True) + "\n")
    emit(
        {
            "state": "REFRESHED",
            "repo": str(repo),
            "config": str(config_path),
            "runStartHead": target,
            "snapshot": str(snapshot_path),
            "ledger": str(ledger_path),
            "preExistingCount": len(snapshot["preExisting"]),
        }
    )
    return 0


def unique_run_dir(audit_root: Path, target: str) -> tuple[str, Path]:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    base = f"{stamp}-{target[:12]}"
    candidate = audit_root / base
    suffix = 1
    while candidate.exists():
        candidate = audit_root / f"{base}-{suffix}"
        suffix += 1
    candidate.mkdir(parents=True)
    return candidate.name, candidate


def impact_markdown(context: dict[str, Any]) -> str:
    lines = [
        "# 文档对账影响报告",
        "",
        f"- 运行：`{context['runId']}`",
        f"- 模式：`{context['mode']}`",
        f"- 基线：`{context.get('baselineRef') or '未建立'}`",
        f"- 冻结目标：`{context['runStartHead']}`",
        f"- 启动前未提交文件：{len(context['preExisting'])}",
        "",
        "## 模块结论",
        "",
    ]
    if not context["modules"]:
        lines.append("本轮没有路径匹配到已配置模块。")
    for module_id, module in sorted(context["modules"].items()):
        counts = {key: len(value) for key, value in module["evidence"].items()}
        lines.extend(
            [
                f"### {module_id}",
                "",
                f"- 状态：`{module['state']}`",
                f"- 证据：实现 {counts['code']}，文档 {counts['documents']}，意图 {counts['intent']}，验证 {counts['verification']}",
                f"- 判断：{'；'.join(module['reasons'])}",
                "",
            ]
        )
    lines.extend(["## 待确认问题", ""])
    if not context["questions"]:
        lines.append("无。")
    for question in context["questions"]:
        paths = "、".join(f"`{path}`" for path in question["paths"]) or "仓库级"
        lines.extend(
            [
                f"### {question['id']}",
                "",
                f"- 模块：`{question['moduleId']}`",
                f"- 范围：{paths}",
                f"- 问题：{question['prompt']}",
                "",
            ]
        )
    return "\n".join(lines).rstrip() + "\n"


def cmd_audit(args: argparse.Namespace) -> int:
    repo, config_path, policy, context_root, audit_root, target, policy_digest = runtime(args)
    checkpoint = checkpoint_data(context_root)
    ignored_patterns = runtime_ignored_patterns(policy)
    readiness = readiness_result(repo, target, policy_digest, checkpoint, ignored_patterns)
    baseline = checkpoint.get("lastSuccessfulRef") if checkpoint else None
    baseline_issue = None
    if readiness["state"] == "BOOTSTRAP_REQUIRED":
        baseline_issue = "首次运行没有成功基线，请确认以哪个 commit 建立初始基线。"
    elif readiness["state"] == "BASELINE_NOT_ANCESTOR":
        baseline_issue = "保存的基线不是冻结目标的祖先，请确认重建基线或选择新的历史 commit。"
    elif readiness["state"] == "POLICY_CHANGED" and args.mode == "incremental":
        baseline_issue = "治理配置已经变化，请确认改用全量审计并复核模块边界。"

    committed = committed_changes(repo, baseline, target, args.mode)
    pre_existing = worktree_changes(repo, ignored_patterns)
    modules, questions = reconcile(committed, pre_existing, policy, baseline_issue)
    run_id, run_dir = unique_run_dir(audit_root, target)
    context = {
        "schemaVersion": "reconcile-change-context/v1",
        "createdAt": utc_now(),
        "runId": run_id,
        "mode": args.mode,
        "baselineRef": baseline,
        "runStartHead": target,
        "policyDigest": policy_digest,
        "configPath": str(config_path.relative_to(repo)),
        "committedChanges": committed,
        "preExisting": pre_existing,
        "modules": modules,
        "questions": questions,
    }
    context_path = run_dir / "change-context.json"
    impact_path = run_dir / "impact-report.md"
    verification_path = run_dir / "verification-report.md"
    atomic_write_json(context_path, context)
    atomic_write_text(impact_path, impact_markdown(context))
    atomic_write_text(
        verification_path,
        f"# 文档对账验证报告\n\n- 状态：`pending`\n- 运行：`{run_id}`\n- 生成时间：`{utc_now()}`\n\n尚未执行 `validate`。\n",
    )
    manifest = {
        "schemaVersion": "reconcile-audit-manifest/v1",
        "runId": run_id,
        "mode": args.mode,
        "baselineRef": baseline,
        "runStartHead": target,
        "policyDigest": policy_digest,
        "ruleVersion": policy.get("ruleVersion", "reconcile-docs/v1"),
        "validationStatus": "pending",
        "artifacts": {
            "change-context.json": digest_file(context_path),
            "impact-report.md": digest_file(impact_path),
        },
    }
    atomic_write_json(run_dir / "audit-manifest.json", manifest)
    state = "NEEDS_CONFIRMATION" if questions else "AUDIT_READY"
    emit(
        {
            "state": state,
            "runId": run_id,
            "runDir": str(run_dir),
            "runStartHead": target,
            "baselineRef": baseline,
            "questionCount": len(questions),
            "moduleStates": {module_id: value["state"] for module_id, value in modules.items()},
        }
    )
    return EXIT_CONFIRMATION if questions else 0


def cmd_answer(args: argparse.Namespace) -> int:
    run_dir = Path(args.run_dir).resolve()
    context_path = run_dir / "change-context.json"
    context = load_json(context_path)
    question = next((item for item in context.get("questions", []) if item.get("id") == args.question_id), None)
    if question is None:
        raise ContractError(f"Unknown question ID: {args.question_id}")
    if not args.reason.strip():
        raise ContractError("answer requires a non-empty --reason")
    question["answer"] = {
        "decision": args.decision,
        "reason": args.reason.strip(),
        "operator": args.operator,
        "answeredAt": utc_now(),
    }
    question["status"] = "resolved" if args.decision != "defer" else "open"
    atomic_write_json(context_path, context)
    impact_path = run_dir / "impact-report.md"
    atomic_write_text(impact_path, impact_markdown(context))
    manifest_path = run_dir / "audit-manifest.json"
    manifest = load_json(manifest_path)
    manifest["validationStatus"] = "pending"
    manifest["artifacts"]["change-context.json"] = digest_file(context_path)
    manifest["artifacts"]["impact-report.md"] = digest_file(impact_path)
    atomic_write_json(manifest_path, manifest)
    emit(
        {
            "state": "ANSWER_RECORDED",
            "runDir": str(run_dir),
            "questionId": args.question_id,
            "status": question["status"],
            "remainingQuestions": sum(1 for item in context["questions"] if item.get("status") != "resolved"),
        }
    )
    return 0


def validate_run(run_dir: Path) -> tuple[bool, list[dict[str, Any]], list[str]]:
    checks: list[dict[str, Any]] = []
    blockers: list[str] = []
    required = ["change-context.json", "impact-report.md", "verification-report.md", "audit-manifest.json"]
    for name in required:
        exists = (run_dir / name).is_file()
        checks.append({"check": f"required:{name}", "passed": exists})
        if not exists:
            blockers.append(f"缺少产物 {name}")
    if blockers:
        return False, checks, blockers

    context = load_json(run_dir / "change-context.json")
    manifest = load_json(run_dir / "audit-manifest.json")
    for name, expected in manifest.get("artifacts", {}).items():
        actual = digest_file(run_dir / name)
        passed = actual == expected
        checks.append({"check": f"digest:{name}", "passed": passed})
        if not passed:
            blockers.append(f"产物哈希不一致：{name}")
    open_questions = [item["id"] for item in context.get("questions", []) if item.get("status") != "resolved"]
    checks.append({"check": "questions-resolved", "passed": not open_questions, "details": open_questions})
    if open_questions:
        blockers.append(f"仍有 {len(open_questions)} 个待确认问题")
    checks.append({"check": "run-head-present", "passed": bool(context.get("runStartHead"))})
    if not context.get("runStartHead"):
        blockers.append("change-context 缺少 runStartHead")
    return not blockers, checks, blockers


def cmd_validate(args: argparse.Namespace) -> int:
    run_dir = Path(args.run_dir).resolve()
    passed, checks, blockers = validate_run(run_dir)
    manifest_path = run_dir / "audit-manifest.json"
    if manifest_path.exists():
        manifest = load_json(manifest_path)
        manifest["validationStatus"] = "passed" if passed else "failed"
        manifest["validatedAt"] = utc_now()
        atomic_write_json(manifest_path, manifest)
    run_id = load_json(run_dir / "change-context.json").get("runId", run_dir.name) if (run_dir / "change-context.json").exists() else run_dir.name
    lines = [
        "# 文档对账验证报告",
        "",
        f"- 状态：`{'passed' if passed else 'failed'}`",
        f"- 运行：`{run_id}`",
        f"- 验证时间：`{utc_now()}`",
        "",
        "## 检查项",
        "",
    ]
    for check in checks:
        lines.append(f"- [{'x' if check['passed'] else ' '}] `{check['check']}`")
    lines.extend(["", "## 阻断项", ""])
    lines.extend(f"- {blocker}" for blocker in blockers) if blockers else lines.append("无。")
    atomic_write_text(run_dir / "verification-report.md", "\n".join(lines) + "\n")
    emit({"state": "VALID" if passed else "INVALID", "runDir": str(run_dir), "blockers": blockers, "checks": checks})
    return 0 if passed else EXIT_VALIDATION


def cmd_checkpoint(args: argparse.Namespace) -> int:
    if not args.confirmed:
        raise ContractError("checkpoint requires --confirmed")
    repo, _, policy, context_root, _, current_head, policy_digest = runtime(args)
    run_dir = Path(args.run_dir).resolve()
    context = load_json(run_dir / "change-context.json")
    manifest = load_json(run_dir / "audit-manifest.json")
    if manifest.get("validationStatus") != "passed":
        emit({"state": "CHECKPOINT_REJECTED", "reason": "validation has not passed", "runDir": str(run_dir)})
        return EXIT_VALIDATION
    open_questions = [item["id"] for item in context.get("questions", []) if item.get("status") != "resolved"]
    if open_questions:
        emit({"state": "CHECKPOINT_REJECTED", "reason": "unresolved questions", "questions": open_questions})
        return EXIT_VALIDATION
    target = context.get("runStartHead")
    if not target or not is_ancestor(repo, target, current_head):
        emit({"state": "CHECKPOINT_REJECTED", "reason": "runStartHead is not reachable from current HEAD"})
        return EXIT_VALIDATION
    if context.get("policyDigest") != policy_digest:
        emit({"state": "CHECKPOINT_REJECTED", "reason": "governance policy changed after audit"})
        return EXIT_VALIDATION
    previous = checkpoint_data(context_root)
    checkpoint = {
        "schemaVersion": "reconcile-checkpoint/v1",
        "confirmedAt": utc_now(),
        "lastSuccessfulRef": target,
        "previousSuccessfulRef": previous.get("lastSuccessfulRef") if previous else None,
        "policyDigest": policy_digest,
        "ruleVersion": policy.get("ruleVersion", "reconcile-docs/v1"),
        "runDir": str(run_dir.relative_to(repo)) if run_dir.is_relative_to(repo) else str(run_dir),
    }
    checkpoint_path = context_root / "checkpoint.json"
    atomic_write_json(checkpoint_path, checkpoint)
    emit({"state": "CHECKPOINT_ADVANCED", "checkpoint": str(checkpoint_path), "lastSuccessfulRef": target})
    return 0


def git_call(repo: Path, *args: str) -> None:
    subprocess.run(["git", *args], cwd=repo, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def cmd_selftest(_: argparse.Namespace) -> int:
    results: list[dict[str, Any]] = []
    with tempfile.TemporaryDirectory(prefix="reconcile-docs-") as temporary:
        repo = Path(temporary)
        git_call(repo, "init", "-q")
        git_call(repo, "config", "user.email", "test@example.com")
        git_call(repo, "config", "user.name", "Reconcile Docs Test")
        for name, content in {
            "requirements/REQ.md": "approved intent\n",
            "src/service.py": "VALUE = 1\n",
            "docs/design.md": "current behavior\n",
            "tests/test_service.py": "assert True\n",
        }.items():
            path = repo / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8")
        git_call(repo, "add", ".")
        git_call(repo, "commit", "-qm", "baseline")
        baseline = git_head(repo)
        policy = {
            "schemaVersion": "doc-governance/v1",
            "ruleVersion": "reconcile-docs/v1",
            "contextRoot": ".ctx",
            "auditRoot": ".audits",
            "inventory": {"include": ["**/*"], "exclude": []},
            "modules": {
                "sample": {
                    "codeGlobs": ["src/**"],
                    "documentGlobs": ["docs/**"],
                    "intentGlobs": ["requirements/**"],
                    "verificationGlobs": ["tests/**"],
                }
            },
            "publicContractGlobs": ["api/**"],
            "structuralInvalidators": [],
        }
        full = committed_changes(repo, None, baseline, "full")
        modules, questions = reconcile(full, [], policy)
        results.append({"case": "aligned-full", "passed": modules["sample"]["state"] == "ALIGNED" and not questions})

        (repo / "src/service.py").write_text("VALUE = 2\n", encoding="utf-8")
        git_call(repo, "add", "src/service.py")
        git_call(repo, "commit", "-qm", "implementation only")
        target = git_head(repo)
        incremental = committed_changes(repo, baseline, target, "incremental")
        modules, questions = reconcile(incremental, [], policy)
        results.append({"case": "missing-intent", "passed": modules["sample"]["state"] == "NEEDS_CONFIRMATION" and bool(questions)})

        modules, _ = reconcile([{"status": "M", "path": "requirements/REQ.md"}], [], policy)
        results.append({"case": "target-not-implemented", "passed": modules["sample"]["state"] == "TARGET_NOT_IMPLEMENTED"})

        unverified_changes = [
            {"status": "M", "path": "src/service.py"},
            {"status": "M", "path": "requirements/REQ.md"},
        ]
        modules, _ = reconcile(unverified_changes, [], policy)
        results.append({"case": "unverified", "passed": modules["sample"]["state"] == "UNVERIFIED_IMPLEMENTATION"})

        (repo / "docs/design.md").write_text("dirty\n", encoding="utf-8")
        dirty = worktree_changes(repo)
        results.append({"case": "dirty-pre-existing", "passed": bool(dirty) and dirty[0]["preExisting"] is True})
        results.append({"case": "non-ancestor", "passed": not is_ancestor(repo, "0" * 40, target)})

    passed = all(result["passed"] for result in results)
    emit({"state": "SELFTEST_PASSED" if passed else "SELFTEST_FAILED", "cases": results})
    return 0 if passed else EXIT_VALIDATION


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Periodic evidence-driven documentation reconciliation")
    parser.add_argument("--repo", help="Repository path; defaults to the current Git repository")
    parser.add_argument("--config", help="Governance policy path relative to the repository")
    parser.add_argument("--context-root", help="Override context storage path")
    parser.add_argument("--output", help="Override audit output root")
    commands = parser.add_subparsers(dest="command", required=True)

    def add_overrides(command: argparse.ArgumentParser) -> None:
        # Suppress defaults so values supplied before the subcommand survive parsing.
        command.add_argument("--repo", default=argparse.SUPPRESS)
        command.add_argument("--config", default=argparse.SUPPRESS)
        command.add_argument("--context-root", default=argparse.SUPPRESS)
        command.add_argument("--output", default=argparse.SUPPRESS)

    readiness = commands.add_parser("readiness")
    add_overrides(readiness)
    readiness.set_defaults(handler=cmd_readiness)
    refresh = commands.add_parser("refresh")
    add_overrides(refresh)
    refresh.set_defaults(handler=cmd_refresh)
    audit = commands.add_parser("audit")
    add_overrides(audit)
    audit.add_argument("--mode", choices=("incremental", "full"), default="incremental")
    audit.set_defaults(handler=cmd_audit)
    validate = commands.add_parser("validate")
    add_overrides(validate)
    validate.add_argument("--run-dir", required=True)
    validate.set_defaults(handler=cmd_validate)
    checkpoint = commands.add_parser("checkpoint")
    add_overrides(checkpoint)
    checkpoint.add_argument("--run-dir", required=True)
    checkpoint.add_argument("--confirmed", action="store_true")
    checkpoint.set_defaults(handler=cmd_checkpoint)
    answer = commands.add_parser("answer")
    add_overrides(answer)
    answer.add_argument("--run-dir", required=True)
    answer.add_argument("--question-id", required=True)
    answer.add_argument("--decision", choices=("accept", "reject", "defer"), required=True)
    answer.add_argument("--reason", required=True)
    answer.add_argument("--operator", required=True)
    answer.set_defaults(handler=cmd_answer)
    selftest = commands.add_parser("selftest")
    add_overrides(selftest)
    selftest.set_defaults(handler=cmd_selftest)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        return args.handler(args)
    except ContractError as exc:
        emit({"state": "CONTRACT_ERROR", "error": str(exc)})
        return EXIT_CONTRACT
    except (OSError, subprocess.SubprocessError, ValueError) as exc:
        emit({"state": "ERROR", "error": str(exc)})
        return EXIT_CONTRACT


if __name__ == "__main__":
    sys.exit(main())
