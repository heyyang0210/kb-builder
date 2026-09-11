"""Integration contract between request-time freezing and the 2C kernel."""

from __future__ import annotations

import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import patch

from app.production_lineage import (
    KeywordRebuildInputFreezer,
    KeywordRuleRebuild,
    ProductionLineageError,
)
from tests.test_keyword_rebuild_input_snapshot import (
    DATASET_ID,
    TASK_ID,
    _DatasetFixture,
)
from tests.test_keyword_rule_rebuild import _descriptor


class _RuleOnlyExecutor:
    batch_size = 128

    def __init__(self):
        self.calls = 0
        self.max_batch_records = 0

    def __call__(self, records, context):
        self.calls += 1
        rule_ref = context.ruleSnapshotRef
        candidates = []
        for record in records:
            resource_id = str(record["resourceId"])
            for unit in record["processingUnits"]:
                candidates.append(
                    {
                        "schemaVersion": "2.0",
                        "candidateId": f"candidate:{resource_id}:{unit['chunkId']}",
                        "resourceId": resource_id,
                        "chunkId": str(unit["chunkId"]),
                        "sourceMethod": "deterministic_keyword",
                        "evidenceText": str(unit["content"]),
                        "extractorVersion": rule_ref["extractorVersion"],
                        "extractorSnapshotRef": dict(rule_ref),
                        "model": None,
                        "modelStatus": "not_applicable",
                    }
                )
        return {
            "candidates": candidates,
            "isolated": [],
            "modelCallCount": 0,
            "modelStatus": "not_applicable",
        }

    def execute_batch(self, records, context):
        self.max_batch_records = max(self.max_batch_records, len(records))
        return self(records, context)


class KeywordRebuildInputIntegrationTests(unittest.TestCase):
    def _freeze(self, fixture: _DatasetFixture):
        return KeywordRebuildInputFreezer(
            repository=fixture.repository,
            store=fixture.store,
            data_root=fixture.root,
        ).freeze(fixture.dataset_ref(), fixture.request_context())

    def _execute(self, fixture: _DatasetFixture, frozen, executor=None):
        executor = executor or _RuleOnlyExecutor()
        input_digest = frozen.inputDigest if hasattr(frozen, "inputDigest") else frozen["inputDigest"]
        dataset_id = frozen.datasetId if hasattr(frozen, "datasetId") else frozen["datasetId"]
        task_id = frozen.taskId if hasattr(frozen, "taskId") else frozen["taskId"]
        rebuild_of = {
            "datasetId": dataset_id,
            "taskId": task_id,
            "inputDigest": input_digest,
        }
        with patch(
            "app.production_lineage.settings",
            SimpleNamespace(data_root=fixture.root),
            create=True,
        ):
            result = KeywordRuleRebuild.execute(
                frozen,
                _descriptor(),
                rebuild_of,
                executor,
            )
        return result, executor

    @staticmethod
    def _manifest_path(fixture: _DatasetFixture, frozen) -> Path:
        path = Path(frozen.manifestPath)
        return path if path.is_absolute() else fixture.root / path

    def test_committed_freeze_is_a_first_class_kernel_input(self):
        with TemporaryDirectory() as directory:
            fixture = _DatasetFixture(Path(directory))
            frozen = self._freeze(fixture)

            result, executor = self._execute(fixture, frozen)

            self.assertEqual(result.rebuildOf["datasetId"], DATASET_ID)
            self.assertEqual(result.rebuildOf["taskId"], TASK_ID)
            self.assertEqual(result.rebuildOf["inputDigest"], frozen.inputDigest)
            self.assertEqual(result.ruleSnapshotRef["runId"], result.rebuildRunId)
            self.assertEqual(result.candidateCount, 2)
            self.assertEqual(executor.calls, 1)
            self.assertLessEqual(executor.max_batch_records, executor.batch_size)

    def test_manifest_drift_is_rejected_before_executor(self):
        with TemporaryDirectory() as directory:
            fixture = _DatasetFixture(Path(directory))
            frozen = self._freeze(fixture)
            manifest_path = self._manifest_path(fixture, frozen)
            manifest_path.write_bytes(manifest_path.read_bytes() + b"\n")
            executor = _RuleOnlyExecutor()

            with self.assertRaises(ProductionLineageError) as raised:
                self._execute(fixture, frozen, executor)

            self.assertEqual(raised.exception.code, "ARTIFACT_INTEGRITY_ERROR")
            self.assertEqual(executor.calls, 0)

    def test_artifact_drift_is_rejected_before_executor(self):
        with TemporaryDirectory() as directory:
            fixture = _DatasetFixture(Path(directory))
            frozen = self._freeze(fixture)
            manifest = json.loads(self._manifest_path(fixture, frozen).read_text(encoding="utf-8"))
            artifact = manifest["artifacts"][0]
            artifact_path = self._manifest_path(fixture, frozen).parent / artifact["path"]
            artifact_path.write_bytes(artifact_path.read_bytes() + b"tampered")
            executor = _RuleOnlyExecutor()

            with self.assertRaises(ProductionLineageError) as raised:
                self._execute(fixture, frozen, executor)

            self.assertEqual(raised.exception.code, "ARTIFACT_INTEGRITY_ERROR")
            self.assertEqual(executor.calls, 0)

    def test_absolute_manifest_path_is_rejected(self):
        with TemporaryDirectory() as directory:
            fixture = _DatasetFixture(Path(directory))
            frozen = self._freeze(fixture)
            untrusted = frozen.to_dict()
            untrusted["manifestPath"] = str(self._manifest_path(fixture, frozen).resolve())
            executor = _RuleOnlyExecutor()

            with self.assertRaises(ProductionLineageError) as raised:
                self._execute(fixture, untrusted, executor)

            self.assertEqual(raised.exception.code, "ARTIFACT_INTEGRITY_ERROR")
            self.assertEqual(executor.calls, 0)

    def test_current_production_dataset_manifest_shape_is_adapted_read_only(self):
        with TemporaryDirectory() as directory:
            fixture = _DatasetFixture(Path(directory))
            manifest_path = fixture.dataset_root / "manifest.json"
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            manifest.pop("artifacts", None)
            manifest.pop("normalized", None)
            manifest["schemaVersion"] = "2.0.0"
            manifest["knowledgeBuildMode"] = "keyword_analysis"
            manifest.pop("mode", None)
            manifest["sourceResourceIds"] = sorted(fixture.normalized)
            manifest_path.write_text(json.dumps(manifest, ensure_ascii=False), encoding="utf-8")
            fixture.store.put_record(
                "tasks",
                TASK_ID,
                {"id": TASK_ID, "batchId": "batch-freeze-1", "type": "graph", "state": "completed"},
            )

            frozen = self._freeze(fixture)

            self.assertEqual(frozen.datasetId, DATASET_ID)
            self.assertTrue(frozen.manifestPath.startswith("rebuild-inputs/"))


if __name__ == "__main__":
    unittest.main()
