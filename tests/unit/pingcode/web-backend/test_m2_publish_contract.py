import json
import shutil
import subprocess
import unittest
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace

from fastapi.testclient import TestClient

import app.main as main_module
from app.governance_state import initial_gate_checks
from app.main import app
from app.models import DatasetVersion, GovernanceStatus, PreprocessConfig
from app.services import PreprocessService
from app.store import JsonStore


class M2PublishContractTests(unittest.TestCase):
    """RG-22 regression through the real FastAPI route and persistence service."""

    def setUp(self):
        self.temporary = TemporaryDirectory()
        self.store = JsonStore(Path(self.temporary.name) / "state.json")
        self.preprocess = PreprocessService(
            self.store,
            SimpleNamespace(update=lambda *args, **kwargs: None),
            SimpleNamespace(),
            SimpleNamespace(),
        )
        self.originals = (main_module.preprocess, main_module.graph_versions)
        main_module.preprocess = self.preprocess
        main_module.graph_versions = SimpleNamespace(after_publish=lambda dataset: None)
        self.client = TestClient(app)

    def tearDown(self):
        main_module.preprocess, main_module.graph_versions = self.originals
        self.temporary.cleanup()

    def _put_dataset(
        self,
        dataset_id: str,
        *,
        governance: GovernanceStatus | None,
        quality_passed: bool = True,
        publishable: bool = True,
    ) -> None:
        dataset = DatasetVersion(
            id=dataset_id,
            batchId=f"batch-{dataset_id}",
            preprocessTaskId=f"preprocess-{dataset_id}",
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
        self.store.put_record(
            "datasets",
            dataset.id,
            dataset.model_dump(mode="json", by_alias=True),
        )

    @staticmethod
    def _governance(status: str = "evaluated", status_version: int = 7, **overrides):
        checks = {name: True for name in initial_gate_checks()}
        checks.update(overrides)
        return GovernanceStatus(
            status=status,
            statusVersion=status_version,
            publishable=False,
            reasonCode="READY_TO_PUBLISH",
            gateChecks=checks,
        )

    def test_legal_publish_and_repeated_publish_are_idempotent(self):
        self._put_dataset("dataset-legal", governance=self._governance())

        first = self.client.post(
            "/api/datasets/dataset-legal/publish?expectedStatusVersion=7"
        )
        second = self.client.post(
            "/api/datasets/dataset-legal/publish?expectedStatusVersion=8"
        )

        self.assertEqual(first.status_code, 200, first.text)
        self.assertEqual(second.status_code, 200, second.text)
        self.assertEqual(first.json()["governance"]["status"], "published")
        self.assertEqual(first.json()["governance"]["statusVersion"], 8)
        self.assertEqual(second.json()["governance"]["statusVersion"], 8)
        self.assertTrue(second.json()["governance"]["publishable"])

    def test_skipped_transition_is_rejected_without_changing_persistence(self):
        self._put_dataset(
            "dataset-skipped",
            governance=self._governance(status="index", status_version=4),
        )

        response = self.client.post(
            "/api/datasets/dataset-skipped/publish?expectedStatusVersion=4",
            headers={"x-request-id": "request-rg22-skipped"},
        )

        self.assertEqual(response.status_code, 409, response.text)
        error = response.json()["error"]
        self.assertEqual(error["code"], "STATE_INVALID_TRANSITION")
        self.assertEqual(error["requestId"], "request-rg22-skipped")
        self.assertIn("禁止", error["message"])
        stored = self.preprocess.get_dataset("dataset-skipped")
        self.assertEqual(stored.governance.status, "index")
        self.assertEqual(stored.governance.status_version, 4)

    def test_force_cannot_bypass_p0_and_error_is_structured_chinese(self):
        self._put_dataset(
            "dataset-p0",
            governance=self._governance(acl=False, manifest=False),
        )

        response = self.client.post(
            "/api/datasets/dataset-p0/publish?force=true&expectedStatusVersion=7",
            headers={"x-request-id": "request-rg22-p0"},
        )

        self.assertEqual(response.status_code, 409, response.text)
        error = response.json()["error"]
        self.assertEqual(error["code"], "PUBLISH_GATE_BLOCKED")
        self.assertEqual(error["reasonCode"], "PUBLISH_GATE_BLOCKED")
        self.assertEqual(error["requestId"], "request-rg22-p0")
        self.assertFalse(error["checks"]["acl"])
        self.assertFalse(error["checks"]["manifest"])
        self.assertEqual(
            [item["reasonCode"] for item in error["failedChecks"]],
            ["ACL_EVALUATION_PENDING", "MANIFEST_VERIFICATION_PENDING"],
        )
        for item in error["failedChecks"]:
            self.assertTrue(item["message"])
            self.assertTrue(item["nextAction"])
            self.assertNotRegex(item["message"], r"^[A-Z0-9_]+$")
        self.assertEqual(self.preprocess.get_dataset("dataset-p0").state, "candidate")

    def test_stale_cas_is_rejected_and_current_version_is_preserved(self):
        self._put_dataset("dataset-cas", governance=self._governance(status_version=11))

        response = self.client.post(
            "/api/datasets/dataset-cas/publish?expectedStatusVersion=10"
        )

        self.assertEqual(response.status_code, 409, response.text)
        self.assertEqual(response.json()["error"]["code"], "STATE_VERSION_CONFLICT")
        stored = self.preprocess.get_dataset("dataset-cas")
        self.assertEqual(stored.state, "candidate")
        self.assertEqual(stored.governance.status_version, 11)

    def test_legacy_record_remains_compatible_without_governance(self):
        self._put_dataset(
            "dataset-legacy",
            governance=None,
            quality_passed=False,
            publishable=False,
        )

        blocked = self.client.post("/api/datasets/dataset-legacy/publish")
        compatible = self.client.post(
            "/api/datasets/dataset-legacy/publish?force=true"
        )

        self.assertEqual(blocked.status_code, 409, blocked.text)
        self.assertEqual(blocked.json()["error"]["code"], "QUALITY_GATE_FAILED")
        self.assertEqual(compatible.status_code, 200, compatible.text)
        self.assertIsNone(compatible.json()["governance"])
        self.assertEqual(compatible.json()["state"], "published")


@unittest.skipUnless(shutil.which("node"), "Node.js 不可用，无法执行前端 helper 契约")
class M2FrontendGovernanceHelperTests(unittest.TestCase):
    API_MODULE = (
        Path(__file__).resolve().parents[3] / "code" / "pingcode" / "web-frontend" / "src" / "api.js"
    )

    def _evaluate(self, expression: str):
        script = (
            f"const api = await import({json.dumps(self.API_MODULE.as_uri())});"
            f"console.log(JSON.stringify({expression}));"
        )
        completed = subprocess.run(
            ["node", "--input-type=module", "--eval", script],
            check=True,
            capture_output=True,
            text=True,
            timeout=10,
        )
        return json.loads(completed.stdout)

    def test_manifest_p0_disables_publish_and_has_chinese_action(self):
        view = self._evaluate(
            "api.datasetGovernanceView({state:'candidate',governance:{"
            "status:'evaluated',statusVersion:3,reasonCode:'PUBLISH_GATE_BLOCKED',"
            "gateChecks:{entity_relation:true,evidence:true,acl:true,quality:true,"
            "evaluation:true,manifest:false}}})"
        )
        self.assertFalse(view["canPublish"])
        self.assertIn("manifest", [item["key"] for item in view["blockedChecks"]])
        self.assertIn("血缘", view["nextAction"])

    def test_conflict_p0_acl_and_fallback_errors_are_chinese(self):
        messages = self._evaluate(
            "["
            "api.governancePublishErrorMessage({code:'STATE_VERSION_CONFLICT'}),"
            "api.governancePublishErrorMessage({code:'PUBLISH_GATE_BLOCKED'}),"
            "api.governancePublishErrorMessage({code:'ACL_DENIED'}),"
            "api.governancePublishErrorMessage({})"
            "]"
        )
        self.assertEqual(len(messages), 4)
        for message in messages:
            self.assertRegex(message, r"[\u4e00-\u9fff]")

    def test_legacy_and_governed_views_keep_distinct_semantics(self):
        views = self._evaluate(
            "["
            "api.datasetGovernanceView({state:'candidate',qualityPassed:false,publishable:false}),"
            "api.datasetGovernanceView({state:'candidate',governance:{status:'evaluated',"
            "statusVersion:2,reasonCode:'READY_TO_PUBLISH',gateChecks:{entity_relation:true,"
            "evidence:true,acl:true,quality:true,evaluation:true,manifest:true}}})"
            "]"
        )
        self.assertFalse(views[0]["governed"])
        self.assertTrue(views[0]["requiresForce"])
        self.assertTrue(views[1]["governed"])
        self.assertFalse(views[1]["requiresForce"])
        self.assertTrue(views[1]["canPublish"])


if __name__ == "__main__":
    unittest.main()
