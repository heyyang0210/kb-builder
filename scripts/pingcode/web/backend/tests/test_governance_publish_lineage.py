"""Real publish-route revalidation for committed production governance packages."""

from __future__ import annotations

import hashlib
import json
import unittest
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import patch

from fastapi.testclient import TestClient

import app.main as main_module
from app.governance_state import initial_gate_checks
from app.main import app
from app.models import DatasetVersion, GovernanceStatus, PreprocessConfig
from app.production_lineage import GovernancePackageRepository, ProductionLineageAdapter
from app.services import PreprocessService
from app.store import JsonStore


class GovernancePublishLineageTests(unittest.TestCase):
    def setUp(self):
        self.temporary = TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.settings_patch = patch(
            "app.services.settings", SimpleNamespace(data_root=self.root)
        )
        self.settings_patch.start()
        self.store = JsonStore(self.root / "state.json")
        self.batch_updates = []
        batches = SimpleNamespace(
            update=lambda *args, **kwargs: self.batch_updates.append((args, kwargs))
        )
        self.preprocess = PreprocessService(
            self.store, batches, SimpleNamespace(), SimpleNamespace()
        )
        self.originals = (main_module.preprocess, main_module.graph_versions)
        main_module.preprocess = self.preprocess
        main_module.graph_versions = SimpleNamespace(after_publish=lambda dataset: None)
        self.client = TestClient(app)

    def tearDown(self):
        main_module.preprocess, main_module.graph_versions = self.originals
        self.settings_patch.stop()
        self.temporary.cleanup()

    def _put_dataset(self, dataset_id="dataset-lineage"):
        dataset_root = self.root / "datasets" / dataset_id
        normalized = dataset_root / "normalized" / "resource-1.md"
        normalized.parent.mkdir(parents=True)
        text = "发布重验"
        normalized.write_text(text, encoding="utf-8")
        digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
        result = ProductionLineageAdapter.build(
            dataset_id=dataset_id,
            version_id=dataset_id,
            dataset_root=dataset_root,
            source_documents=[{
                "resourceId": "resource-1",
                "sourcePath": "docs/manual.md",
                "normalizedHash": digest,
            }],
            prepared_chunks=[{
                "chunkId": "resource-1:0",
                "resourceId": "resource-1",
                "chunkIndex": 0,
                "content": text,
                "normalizedOffsets": {"start": 0, "end": len(text)},
                "overlap": {"enabled": False, "sourceChunkId": None},
            }],
            evidence_records=[{
                "candidateId": "candidate-1",
                "chunkId": "resource-1:0",
                "evidenceText": text,
                "schemaVersion": "2.0.0",
            }],
            mode="keyword_analysis",
            graph={"nodes": [{"id": "keyword-1"}], "edges": []},
            index={"processingUnitIds": ["resource-1:0"]},
            rule={"mode": "keyword_analysis", "version": "test"},
            created_at="2026-08-18T12:00:00Z",
        )
        committed = GovernancePackageRepository.commit(dataset_root, result).to_dict()
        (dataset_root / "manifest.json").write_text(
            json.dumps({"datasetId": dataset_id, "governance": committed}, ensure_ascii=False),
            encoding="utf-8",
        )
        checks = {name: True for name in initial_gate_checks()}
        dataset = DatasetVersion(
            id=dataset_id,
            batchId="batch-lineage",
            preprocessTaskId="preprocess-lineage",
            state="candidate",
            config=PreprocessConfig(),
            totalDocuments=1,
            totalChunks=1,
            qualityMetrics={},
            qualityPassed=True,
            publishable=False,
            datasetPath=f"datasets/{dataset_id}",
            governance=GovernanceStatus(
                status="evaluated",
                statusVersion=3,
                publishable=False,
                reasonCode="READY_TO_PUBLISH",
                gateChecks=checks,
            ),
            createdAt=datetime.now(timezone.utc),
        )
        self.store.put_record(
            "datasets", dataset_id, dataset.model_dump(mode="json", by_alias=True)
        )
        return dataset_root

    def test_verified_package_is_revalidated_before_publish(self):
        self._put_dataset()
        response = self.client.post(
            "/api/datasets/dataset-lineage/publish?expectedStatusVersion=3"
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["governance"]["status"], "published")

    def test_force_cannot_bypass_tampered_lineage(self):
        root = self._put_dataset()
        manifest_path = root / "governance" / "lineage-manifest.json"
        manifest_path.write_text(manifest_path.read_text(encoding="utf-8") + " ", encoding="utf-8")
        response = self.client.post(
            "/api/datasets/dataset-lineage/publish?force=true&expectedStatusVersion=3"
        )
        self.assertEqual(response.status_code, 409, response.text)
        self.assertEqual(response.json()["error"]["code"], "PUBLISH_GATE_BLOCKED")
        self.assertEqual(self.preprocess.get_dataset("dataset-lineage").state, "candidate")
        self.assertFalse(self.batch_updates)

    def test_normalized_drift_blocks_cached_manifest_true(self):
        root = self._put_dataset()
        normalized = root / "normalized" / "resource-1.md"
        normalized.write_text("已被篡改", encoding="utf-8")
        response = self.client.post(
            "/api/datasets/dataset-lineage/publish?expectedStatusVersion=3"
        )
        self.assertEqual(response.status_code, 409, response.text)
        failed = response.json()["error"]["failedChecks"]
        self.assertIn("MANIFEST_VERIFICATION_PENDING", [item["reasonCode"] for item in failed])
        self.assertEqual(self.preprocess.get_dataset("dataset-lineage").state, "candidate")

    def test_missing_version_fingerprint_blocks_publish(self):
        root = self._put_dataset()
        (root / "governance" / "version-fingerprint.json").unlink()
        response = self.client.post(
            "/api/datasets/dataset-lineage/publish?expectedStatusVersion=3"
        )
        self.assertEqual(response.status_code, 409, response.text)
        self.assertEqual(response.json()["error"]["code"], "PUBLISH_GATE_BLOCKED")
        self.assertEqual(self.preprocess.get_dataset("dataset-lineage").state, "candidate")

    def test_business_manifest_reference_mismatch_blocks_publish(self):
        root = self._put_dataset()
        path = root / "manifest.json"
        manifest = json.loads(path.read_text(encoding="utf-8"))
        manifest["governance"]["lineage"]["manifestPath"] = "governance/other.json"
        path.write_text(json.dumps(manifest, ensure_ascii=False), encoding="utf-8")
        response = self.client.post(
            "/api/datasets/dataset-lineage/publish?expectedStatusVersion=3"
        )
        self.assertEqual(response.status_code, 409, response.text)
        self.assertEqual(response.json()["error"]["code"], "PUBLISH_GATE_BLOCKED")
        self.assertEqual(self.preprocess.get_dataset("dataset-lineage").state, "candidate")


if __name__ == "__main__":
    unittest.main()
