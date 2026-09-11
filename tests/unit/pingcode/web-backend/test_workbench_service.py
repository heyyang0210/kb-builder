import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.models import DatasetVersion, PreprocessConfig, TaskSnapshot, WorkbenchSummary
from app.services import BatchService
from app.store import JsonStore
from app.workbench_service import WorkbenchService


class StubTasks:
    def __init__(self, items):
        self.items = items

    def list(self):
        return self.items


class StubPreprocess:
    def __init__(self, datasets):
        self.datasets = datasets

    def list_datasets(self):
        return self.datasets


class StubTraining:
    def __init__(self, review_counts=None):
        self.review_counts = review_counts or {}

    def pending_review_counts_by_batch(self):
        return self.review_counts


class WorkbenchServiceTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.store = JsonStore(Path(self.directory.name) / "state.json")
        self.batches = BatchService(self.store, None)
        self.now = datetime.now(timezone.utc)
        self._put_batch("batch-pending", "待处理资料", "uploaded", self.now)
        self._put_batch("batch-running-a", "运行资料 A", "processing", self.now - timedelta(minutes=1))
        self._put_batch("batch-running-b", "运行资料 B", "processing", self.now - timedelta(minutes=2))
        self._put_batch("batch-failed", "异常历史资料", "failed", self.now - timedelta(minutes=3), source=None)
        self._put_batch("batch-review", "待复核资料", "ready", self.now - timedelta(minutes=4))

        tasks = [
            self._task("task-running-a", "batch-running-a", "preprocess", "running", "knowledge_validation", 3, 6),
            self._task("task-running-b", "batch-running-b", "download", "queued", "queued", 0, 10),
            self._task("task-failed", "batch-failed", "preprocess", "failed", "semantic_enrichment", 2, 6),
        ]
        datasets = [self._dataset("dataset-review", "batch-review")]
        self.service = WorkbenchService(
            self.batches,
            StubTasks(tasks),
            StubPreprocess(datasets),
            StubTraining({"batch-review": 2}),
        )

    def tearDown(self):
        self.directory.cleanup()

    def test_workbench_state_filter_runs_before_final_pagination(self):
        first = self.service.list_page(page=1, page_size=1, workbench_state="running")
        second = self.service.list_page(page=2, page_size=1, workbench_state="running")
        self.assertEqual(first["total"], 2)
        self.assertEqual(second["total"], 2)
        self.assertEqual(first["facets"]["processStates"]["running"], 2)
        self.assertNotEqual(first["items"][0]["id"], second["items"][0]["id"])

    def test_recommended_action_priority_and_unknown_history(self):
        failed = self.service.detail("batch-failed")
        running = self.service.detail("batch-running-b")
        review = self.service.detail("batch-review")
        self.assertEqual(failed["sourceSummary"]["type"], "unknown")
        self.assertEqual(failed["recommendedAction"]["type"], "handle_failure")
        self.assertEqual(running["recommendedAction"]["type"], "view_progress")
        self.assertEqual(review["recommendedAction"]["type"], "review_quality")
        self.assertEqual(review["qualitySummary"]["pendingReview"], 2)

    def test_summary_uses_camel_case_contract(self):
        payload = WorkbenchSummary.model_validate(self.service.summary()).model_dump(mode="json", by_alias=True)
        self.assertEqual(payload["counts"]["all"], 5)
        self.assertEqual(payload["counts"]["running"], 2)
        self.assertEqual(payload["counts"]["review"], 1)
        self.assertEqual(payload["counts"]["failed"], 1)
        self.assertIn("activeTasks", payload)
        self.assertIn("recentTasks", payload)

    def test_invalid_workbench_state_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "加工状态不支持"):
            self.service.list_page(page=1, page_size=20, workbench_state="invented")

    def _put_batch(self, batch_id, name, state, updated_at, source="upload"):
        source_record = None
        if source:
            source_record = {
                "sourceType": source,
                "sourceId": f"source-{batch_id}",
                "displayName": f"来源-{name}",
                "capturedAt": updated_at.isoformat(),
                "metadata": {},
            }
        self.store.put_record("batches", batch_id, {
            "id": batch_id,
            "name": name,
            "state": state,
            "sourceSnapshot": {
                "capturedAt": updated_at.isoformat(),
                "completeness": "complete" if source else "unknown",
                "estimatedPages": 3,
                "estimatedAttachments": 2,
            },
            "source": source_record,
            "activeTaskIds": [],
            "createdAt": updated_at.isoformat(),
            "updatedAt": updated_at.isoformat(),
        })

    def _task(self, task_id, batch_id, task_type, state, stage, completed, total):
        return TaskSnapshot(
            id=task_id,
            batch_id=batch_id,
            type=task_type,
            state=state,
            stage=stage,
            completed=completed,
            total=total,
            failed=1 if state == "failed" else 0,
            message="执行失败" if state == "failed" else "执行中",
            stages=[],
            created_at=self.now,
            updated_at=self.now,
        )

    def _dataset(self, dataset_id, batch_id):
        return DatasetVersion(
            id=dataset_id,
            batch_id=batch_id,
            preprocess_task_id="prep-review",
            state="candidate",
            config=PreprocessConfig(),
            total_documents=3,
            total_chunks=8,
            quality_metrics={},
            quality_passed=True,
            publishable=True,
            created_at=self.now,
        )


if __name__ == "__main__":
    unittest.main()
