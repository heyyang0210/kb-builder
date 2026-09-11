import unittest
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace

from fastapi.testclient import TestClient

import app.main as main_module
from app.main import app
from app.governance_state import initial_gate_checks
from app.models import DatasetVersion, GovernanceStatus, PreprocessConfig
from app.services import PreprocessService
from app.store import JsonStore


class GovernancePublishApiTests(unittest.TestCase):
    def setUp(self):
        self.temporary = TemporaryDirectory()
        self.store = JsonStore(Path(self.temporary.name) / "state.json")
        self.batch_updates = []
        batches = SimpleNamespace(update=lambda *args, **kwargs: self.batch_updates.append((args, kwargs)))
        self.preprocess = PreprocessService(self.store, batches, SimpleNamespace(), SimpleNamespace())
        self.graph_versions = SimpleNamespace(after_publish=lambda dataset: None)
        self.originals = (main_module.preprocess, main_module.graph_versions)
        main_module.preprocess = self.preprocess
        main_module.graph_versions = self.graph_versions
        self.client = TestClient(app)

    def tearDown(self):
        main_module.preprocess, main_module.graph_versions = self.originals
        self.temporary.cleanup()

    def _put_dataset(self, dataset_id, *, governance=None, quality_passed=True, publishable=True):
        dataset = DatasetVersion(
            id=dataset_id,
            batchId="batch-governance-api",
            preprocessTaskId="preprocess-governance-api",
            state="candidate",
            config=PreprocessConfig(),
            totalDocuments=1,
            totalChunks=1,
            qualityMetrics={},
            qualityPassed=quality_passed,
            publishable=publishable,
            governance=governance,
            createdAt=datetime.now(timezone.utc),
        )
        self.store.put_record("datasets", dataset.id, dataset.model_dump(mode="json", by_alias=True))

    @staticmethod
    def _passed_governance(**overrides):
        checks = {name: True for name in initial_gate_checks()}
        checks.update(overrides)
        return GovernanceStatus(
            status="evaluated",
            statusVersion=3,
            publishable=False,
            reasonCode="READY_TO_PUBLISH",
            gateChecks=checks,
        )

    def test_legacy_dataset_keeps_force_compatibility(self):
        self._put_dataset("dataset-legacy", quality_passed=False, publishable=False)
        response = self.client.post("/api/datasets/dataset-legacy/publish?force=true")
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["state"], "published")
        self.assertIsNone(response.json()["governance"])

    def test_governed_dataset_publishes_with_additive_response(self):
        self._put_dataset("dataset-governed", governance=self._passed_governance())
        response = self.client.post(
            "/api/datasets/dataset-governed/publish?expectedStatusVersion=3"
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["state"], "published")
        self.assertTrue(response.json()["publishable"])
        self.assertEqual(response.json()["governance"]["status"], "published")
        self.assertEqual(response.json()["governance"]["statusVersion"], 4)
        self.assertTrue(response.json()["governance"]["publishable"])

    def test_force_cannot_bypass_governance_p0_acl_gate(self):
        self._put_dataset("dataset-acl-blocked", governance=self._passed_governance(acl=False))
        response = self.client.post("/api/datasets/dataset-acl-blocked/publish?force=true")
        self.assertEqual(response.status_code, 409, response.text)
        error = response.json()["error"]
        self.assertEqual(error["code"], "PUBLISH_GATE_BLOCKED")
        self.assertEqual(error["reasonCode"], "PUBLISH_GATE_BLOCKED")
        self.assertEqual(error["statusVersion"], 3)
        self.assertFalse(error["checks"]["acl"])
        self.assertEqual(
            error["failedChecks"],
            [{
                "check": "acl",
                "reasonCode": "ACL_EVALUATION_PENDING",
                "message": "访问控制尚未完成判定",
                "nextAction": "完成访问控制配置与授权检查",
            }],
        )
        self.assertIn("重试发布", error["nextAction"])
        self.assertEqual(self.preprocess.get_dataset("dataset-acl-blocked").state, "candidate")

    def test_unverified_manifest_is_a_structured_p0_blocker(self):
        self._put_dataset(
            "dataset-manifest-blocked",
            governance=self._passed_governance(manifest=False),
        )
        response = self.client.post(
            "/api/datasets/dataset-manifest-blocked/publish?expectedStatusVersion=3"
        )
        self.assertEqual(response.status_code, 409, response.text)
        error = response.json()["error"]
        self.assertEqual(
            [item["reasonCode"] for item in error["failedChecks"]],
            ["MANIFEST_VERIFICATION_PENDING"],
        )
        stored = self.preprocess.get_dataset("dataset-manifest-blocked")
        self.assertEqual(stored.state, "candidate")
        self.assertEqual(stored.governance.status_version, 3)

    def test_stale_expected_status_version_returns_conflict(self):
        self._put_dataset("dataset-stale", governance=self._passed_governance())
        response = self.client.post(
            "/api/datasets/dataset-stale/publish?expectedStatusVersion=2"
        )
        self.assertEqual(response.status_code, 409, response.text)
        self.assertEqual(response.json()["error"]["code"], "STATE_VERSION_CONFLICT")
        stored = self.preprocess.get_dataset("dataset-stale")
        self.assertEqual(stored.state, "candidate")
        self.assertEqual(stored.governance.status_version, 3)


if __name__ == "__main__":
    unittest.main()
