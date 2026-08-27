import unittest

from app.governance_state import (
    GovernanceSnapshot,
    GovernanceStateError,
    evaluate_publish_gate,
    initial_gate_checks,
    transition,
)


class GovernanceStateTests(unittest.TestCase):
    def test_happy_path_requires_all_publish_gates(self):
        snapshot = GovernanceSnapshot("v1", "keyword")
        for target in ("formal", "index", "evaluated"):
            snapshot = transition(snapshot, target, expected_status_version=snapshot.status_version)
        checks = {name: True for name in initial_gate_checks()}
        published = transition(snapshot, "published", expected_status_version=3, checks=checks)
        self.assertTrue(published.publishable)
        self.assertEqual(published.status_version, 4)

    def test_publish_from_keyword_is_rejected(self):
        with self.assertRaisesRegex(GovernanceStateError, "禁止") as context:
            transition(GovernanceSnapshot("v1", "keyword"), "published", expected_status_version=0)
        self.assertEqual(context.exception.code, "STATE_INVALID_TRANSITION")

    def test_publish_gate_failure_is_structured(self):
        snapshot = GovernanceSnapshot("v1", "evaluated", status_version=3)
        checks = {name: True for name in initial_gate_checks()}
        checks.update({"acl": False, "manifest": False})
        with self.assertRaises(GovernanceStateError) as context:
            transition(snapshot, "published", expected_status_version=3, checks=checks)
        self.assertEqual(context.exception.code, "PUBLISH_GATE_BLOCKED")
        self.assertEqual(context.exception.details["reasonCode"], "PUBLISH_GATE_BLOCKED")
        self.assertEqual(context.exception.details["statusVersion"], 3)
        self.assertEqual(
            [item["check"] for item in context.exception.details["failedChecks"]],
            ["acl", "manifest"],
        )
        self.assertEqual(
            context.exception.details["failedChecks"][0]["reasonCode"],
            "ACL_EVALUATION_PENDING",
        )
        self.assertIn("重试发布", context.exception.details["nextAction"])

    def test_missing_or_non_boolean_checks_fail_closed(self):
        result = evaluate_publish_gate({"entity_relation": 1, "acl": None})
        self.assertFalse(result.allowed)
        self.assertFalse(result.checks["entity_relation"])
        self.assertFalse(result.checks["acl"])
        self.assertEqual(set(result.checks), set(initial_gate_checks()))

    def test_compare_and_set_version_conflict(self):
        snapshot = GovernanceSnapshot("v1", "keyword", status_version=2)
        with self.assertRaises(GovernanceStateError) as context:
            transition(snapshot, "formal", expected_status_version=1)
        self.assertEqual(context.exception.code, "STATE_VERSION_CONFLICT")

    def test_published_snapshot_is_immutable(self):
        snapshot = GovernanceSnapshot("v1", "evaluated", status_version=3)
        checks = {name: True for name in initial_gate_checks()}
        published = transition(snapshot, "published", expected_status_version=3, checks=checks)
        self.assertEqual(snapshot.status, "evaluated")
        with self.assertRaises(GovernanceStateError):
            transition(published, "failed", expected_status_version=4)


if __name__ == "__main__":
    unittest.main()
