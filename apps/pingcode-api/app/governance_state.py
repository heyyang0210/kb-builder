"""Knowledge-governance state transitions independent from legacy task states."""

from __future__ import annotations

from dataclasses import dataclass, replace
from typing import Any, Mapping


class GovernanceStateError(ValueError):
    """Raised when a governance state transition cannot be accepted."""

    def __init__(
        self,
        code: str,
        message: str,
        *,
        details: Mapping[str, Any] | None = None,
    ):
        super().__init__(message)
        self.code = code
        self.details = dict(details or {})


STATES = ("keyword", "formal", "index", "evaluated", "published", "failed", "cancelled")
_FORWARD = {
    "keyword": {"formal"},
    "formal": {"index"},
    "index": {"evaluated"},
    "evaluated": {"published"},
}


@dataclass(frozen=True)
class PublishGateRequirement:
    name: str
    reason_code: str
    message: str
    next_action: str


PUBLISH_GATE_REQUIREMENTS = (
    PublishGateRequirement(
        "entity_relation",
        "ENTITY_RELATION_NOT_READY",
        "实体与关系产物尚未通过检查",
        "完成实体与关系构建并重新执行发布检查",
    ),
    PublishGateRequirement(
        "evidence",
        "EVIDENCE_NOT_READY",
        "证据引用尚未通过检查",
        "补齐可回放证据并重新执行发布检查",
    ),
    PublishGateRequirement(
        "acl",
        "ACL_EVALUATION_PENDING",
        "访问控制尚未完成判定",
        "完成访问控制配置与授权检查",
    ),
    PublishGateRequirement(
        "quality",
        "QUALITY_GATE_FAILED",
        "质量门禁尚未通过",
        "处理 P0 质量问题后重新执行发布检查",
    ),
    PublishGateRequirement(
        "evaluation",
        "EVALUATION_NOT_READY",
        "发布评测尚未通过",
        "完成发布评测并重新执行发布检查",
    ),
    PublishGateRequirement(
        "manifest",
        "MANIFEST_VERIFICATION_PENDING",
        "血缘清单尚未通过完整性验证",
        "生成并验证血缘清单后重新执行发布检查",
    ),
)


@dataclass(frozen=True)
class PublishGateResult:
    allowed: bool
    checks: dict[str, bool]
    failed_checks: tuple[dict[str, str], ...]

    def error_details(self, *, status_version: int) -> dict[str, Any]:
        return {
            "reasonCode": "PUBLISH_GATE_BLOCKED",
            "statusVersion": status_version,
            "checks": self.checks,
            "failedChecks": list(self.failed_checks),
            "nextAction": "请先完成所有未通过项，然后重试发布",
        }


@dataclass(frozen=True)
class GovernanceSnapshot:
    version_id: str
    status: str
    status_version: int = 0
    publishable: bool = False
    reason_code: str = ""


def initial_gate_checks() -> dict[str, bool]:
    return {requirement.name: False for requirement in PUBLISH_GATE_REQUIREMENTS}


def evaluate_publish_gate(checks: Mapping[str, bool] | None) -> PublishGateResult:
    """Normalize all P0 checks and describe every failed requirement."""

    supplied = checks or {}
    normalized = {
        requirement.name: supplied.get(requirement.name) is True
        for requirement in PUBLISH_GATE_REQUIREMENTS
    }
    failed = tuple(
        {
            "check": requirement.name,
            "reasonCode": requirement.reason_code,
            "message": requirement.message,
            "nextAction": requirement.next_action,
        }
        for requirement in PUBLISH_GATE_REQUIREMENTS
        if not normalized[requirement.name]
    )
    return PublishGateResult(allowed=not failed, checks=normalized, failed_checks=failed)


def transition(
    snapshot: GovernanceSnapshot,
    target: str,
    *,
    expected_status_version: int,
    checks: Mapping[str, bool] | None = None,
    reason_code: str = "",
) -> GovernanceSnapshot:
    """Apply one monotonic, gate-checked transition without mutating the input."""

    if snapshot.status_version != expected_status_version:
        raise GovernanceStateError("STATE_VERSION_CONFLICT", "治理状态版本已变化")
    if target not in STATES:
        raise GovernanceStateError("STATE_UNKNOWN", f"未知治理状态: {target}")
    if target == snapshot.status:
        return snapshot
    if target == "failed" and snapshot.status in {"published", "failed"}:
        raise GovernanceStateError("STATE_INVALID_TRANSITION", "已发布状态不能回退为失败")
    if target == "cancelled" and snapshot.status in {"published", "cancelled"}:
        raise GovernanceStateError("STATE_INVALID_TRANSITION", "当前状态不能取消")
    if target not in {"failed", "cancelled"} and target not in _FORWARD.get(snapshot.status, set()):
        raise GovernanceStateError("STATE_INVALID_TRANSITION", f"禁止从 {snapshot.status} 转移到 {target}")

    if target == "published":
        gate_result = evaluate_publish_gate(checks)
        if not gate_result.allowed:
            missing = [item["check"] for item in gate_result.failed_checks]
            raise GovernanceStateError(
                "PUBLISH_GATE_BLOCKED",
                "发布门禁未通过: " + ",".join(missing),
                details=gate_result.error_details(status_version=snapshot.status_version),
            )

    return replace(
        snapshot,
        status=target,
        status_version=snapshot.status_version + 1,
        publishable=target == "published",
        reason_code=reason_code or snapshot.reason_code,
    )
