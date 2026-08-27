from __future__ import annotations

import hashlib
from typing import Any

from .contracts import match_path
from .git_context import map_paths_to_modules


def question_id(kind: str, module_id: str, paths: list[str]) -> str:
    seed = "|".join([kind, module_id, *sorted(paths)])
    return f"Q-{kind.upper()}-{hashlib.sha256(seed.encode('utf-8')).hexdigest()[:10]}"


def make_question(kind: str, module_id: str, paths: list[str], prompt: str) -> dict[str, Any]:
    return {
        "id": question_id(kind, module_id, paths),
        "kind": kind,
        "moduleId": module_id,
        "paths": sorted(paths),
        "prompt": prompt,
        "blocking": True,
        "status": "open",
    }


def reconcile(
    committed: list[dict[str, str]],
    pre_existing: list[dict[str, Any]],
    policy: dict[str, Any],
    baseline_issue: str | None = None,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    changed_paths = [item["path"] for item in committed]
    mapping = map_paths_to_modules(changed_paths, policy)
    status_by_path = {item["path"]: item["status"] for item in committed}
    questions: list[dict[str, Any]] = []
    modules: dict[str, Any] = {}

    if baseline_issue:
        questions.append(make_question("baseline", "repository", [], baseline_issue))

    pre_existing_paths = {item["path"] for item in pre_existing}
    overlap = sorted(pre_existing_paths.intersection(changed_paths))
    if overlap:
        questions.append(
            make_question(
                "worktree-overlap",
                "repository",
                overlap,
                "已提交审计范围与启动前未提交文件重叠，请确认这些未提交变化的归属和是否纳入解释。",
            )
        )

    mapped_paths = {
        path
        for evidence in mapping.values()
        for paths in evidence.values()
        for path in paths
    }
    unmapped = sorted(set(changed_paths) - mapped_paths)
    if unmapped:
        questions.append(
            make_question(
                "unmapped-change",
                "repository",
                unmapped,
                "发现未归档到任何治理模块的变更，请确认所属模块或补充治理配置。",
            )
        )

    for module_id, evidence in mapping.items():
        actual_changes = [path for path in sum(evidence.values(), []) if status_by_path.get(path) != "PRESENT"]
        deleted_docs = [
            path for path in evidence["documents"] if status_by_path.get(path, "").startswith(("D", "R"))
        ]
        contract_changes = [
            path for path in actual_changes if match_path(path, policy.get("publicContractGlobs", []))
        ]
        structural_changes = [
            path for path in actual_changes if match_path(path, policy.get("structuralInvalidators", []))
        ]

        state = "ALIGNED"
        reasons: list[str] = []
        module_questions: list[dict[str, Any]] = []
        if deleted_docs:
            state = "NEEDS_CONFIRMATION"
            module_questions.append(
                make_question("document-move-delete", module_id, deleted_docs, "文档发生删除、移动或重命名，请确认治理动作和历史保留方式。")
            )
        if contract_changes or structural_changes:
            state = "NEEDS_CONFIRMATION"
            affected = sorted(set(contract_changes + structural_changes))
            module_questions.append(
                make_question("public-or-structural-change", module_id, affected, "检测到公共契约或结构失效项变化，请确认业务原因、兼容策略和文档影响。")
            )
        if evidence["code"] and not evidence["intent"] and actual_changes:
            state = "NEEDS_CONFIRMATION"
            module_questions.append(
                make_question("missing-intent", module_id, evidence["code"], "实现发生变化但审计范围内没有业务意图证据，请补充或确认变更原因。")
            )
        elif evidence["code"] and evidence["intent"] and not evidence["verification"]:
            if state != "NEEDS_CONFIRMATION":
                state = "UNVERIFIED_IMPLEMENTATION"
            reasons.append("存在实现和意图证据，但缺少验证证据")
        elif evidence["code"] and evidence["intent"] and evidence["verification"] and not evidence["documents"]:
            if state != "NEEDS_CONFIRMATION":
                state = "UPDATE_CANDIDATE"
            reasons.append("实现、意图和验证已出现，未关联到模块文档")
        elif evidence["intent"] and not evidence["code"]:
            if state != "NEEDS_CONFIRMATION":
                state = "TARGET_NOT_IMPLEMENTED"
            reasons.append("存在目标或任务证据，未发现实现证据")
        elif evidence["documents"] and not evidence["code"] and not evidence["intent"]:
            if state != "NEEDS_CONFIRMATION":
                state = "UPDATE_CANDIDATE"
            reasons.append("仅文档发生变化，需要结合基线复核其事实来源")
        else:
            reasons.append("当前可见证据未显示确定性漂移")

        questions.extend(module_questions)
        modules[module_id] = {
            "state": state,
            "evidence": evidence,
            "reasons": reasons,
            "questionIds": [item["id"] for item in module_questions],
        }

    return modules, sorted(questions, key=lambda item: item["id"])
