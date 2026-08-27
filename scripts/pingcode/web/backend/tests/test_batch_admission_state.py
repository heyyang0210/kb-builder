import unittest
from contextlib import contextmanager
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import patch

from app.models import TaskSnapshot
from app.training_service import TrainingService, utcnow


class _Tasks:
    def __init__(self, items):
        self.items = list(items)

    def list(self, batch_id=None):
        if batch_id is None:
            return list(self.items)
        return [item for item in self.items if item.batch_id == batch_id]


class _Batches:
    def __init__(self, batch):
        self.batch = batch
        self.updates = []

    def get(self, batch_id):
        if batch_id != self.batch.id:
            raise KeyError(batch_id)
        return self.batch

    def update(self, batch_id, **changes):
        self.updates.append((batch_id, changes))
        for key, value in changes.items():
            setattr(self.batch, {"activeTaskIds": "active_task_ids"}.get(key, key), value)
        return self.batch


class _Preprocess:
    def get_scan_report(self, batch_id):
        return None


def _task(task_id, batch_id, task_type, state, *, completed=0, can_resume=False):
    now = utcnow()
    return TaskSnapshot(
        id=task_id,
        batchId=batch_id,
        type=task_type,
        state=state,
        stage=state,
        completed=completed,
        canResume=can_resume,
        createdAt=now,
        updatedAt=now,
    )


class BatchAdmissionStateTests(unittest.TestCase):
    @contextmanager
    def _service(self, batch, tasks):
        batches = _Batches(batch)
        task_repo = _Tasks(tasks)
        with TemporaryDirectory() as directory:
            root = Path(directory)
            store = SimpleNamespace(
                list_records=lambda collection: [],
                get_record=lambda collection, record_id: None,
                put_record=lambda collection, record_id, value: None,
                update_record=lambda collection, record_id, changes: None,
            )
            config = SimpleNamespace(
                data_root=root,
                model_gateway_url="",
                model_gateway_token="",
                model_gateway_timeout=30,
            )
            with patch("app.training_service.settings", config):
                service = TrainingService(
                    store,
                    batches,
                    task_repo,
                    _Preprocess(),
                    SimpleNamespace(),
                    gateway=SimpleNamespace(),
                )
                yield service, batches

    def test_failed_training_restores_completed_download_state_and_clears_active_tasks(self):
        batch = SimpleNamespace(id="batch-failed", state="failed", active_task_ids=["training-1"])
        tasks = [
            _task("training-1", batch.id, "graph", "failed"),
            _task("download-1", batch.id, "download", "completed", completed=3),
        ]
        with self._service(batch, tasks) as (service, batches):
            service._restore_material_state(batch.id)

        self.assertEqual(batch.state, "downloaded")
        self.assertEqual(batch.active_task_ids, [])
        self.assertEqual(batches.updates[-1][1], {"state": "downloaded", "activeTaskIds": []})

    def test_partial_download_is_admissible_without_changing_download_warning(self):
        batch = SimpleNamespace(id="batch-partial", state="downloading", active_task_ids=["download-1"])
        download = _task("download-1", batch.id, "download", "interrupted", completed=2, can_resume=True)
        with self._service(batch, [download]) as (service, _):
            result = service.admission(batch.id)

        self.assertTrue(result["canStart"])
        self.assertEqual(result["admissionStatus"], "partial_download")
        self.assertEqual(batch.state, "downloading")

    def test_training_failure_does_not_change_keyword_admission_status(self):
        admitted = {"id": "keyword-a", "type": "Keyword", "admissionStatus": "admitted"}
        excluded = {"id": "keyword-b", "type": "Keyword", "properties": {"admissionStatus": "excluded"}}
        before = [dict(admitted), {**excluded, "properties": dict(excluded["properties"])}]

        self.assertEqual(TrainingService._read_admission_status(admitted), "admitted")
        self.assertEqual(TrainingService._read_admission_status(excluded), "excluded")
        self.assertEqual(before[0]["admissionStatus"], "admitted")
        self.assertEqual(before[1]["properties"]["admissionStatus"], "excluded")


if __name__ == "__main__":
    unittest.main()
