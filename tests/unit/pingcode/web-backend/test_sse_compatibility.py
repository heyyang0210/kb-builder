import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app, tasks, training
from app.models import TaskSnapshot
from app.services import TaskEventBroker


class SseCompatibilityTest(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    @staticmethod
    def events():
        yield ': connected\n\nid: 1\nevent: contract.test\ndata: {"status":"ok"}\n\n'

    def assert_stream(self, path, patches):
        with patches[0], patches[1]:
            response = self.client.get(path)
        self.assertEqual(200, response.status_code)
        self.assertTrue(response.headers["content-type"].startswith("text/event-stream"))
        self.assertEqual("no-cache", response.headers["cache-control"])
        self.assertEqual("no", response.headers["x-accel-buffering"])
        self.assertIn(": connected", response.text)
        self.assertIn("event: contract.test", response.text)
        self.assertIn('data: {"status":"ok"}', response.text)

    def test_task_events_stream(self):
        self.assert_stream(
            "/api/tasks/contract-task/events",
            (patch.object(tasks, "get", return_value=object()), patch.object(tasks.events, "stream", return_value=self.events())),
        )

    def test_training_task_events_stream(self):
        self.assert_stream(
            "/api/training/tasks/contract-task/events",
            (patch.object(training, "get", return_value=object()), patch.object(tasks.events, "stream", return_value=self.events())),
        )

    def test_task_events_uses_last_event_id_header_when_query_is_absent(self):
        with patch.object(tasks, "get", return_value=object()), patch.object(tasks.events, "stream", return_value=self.events()) as stream:
            response = self.client.get(
                "/api/tasks/contract-task/events",
                headers={"Last-Event-ID": "7"},
            )
        self.assertEqual(200, response.status_code)
        stream.assert_called_once_with("contract-task", 7)

    def test_task_events_query_cursor_takes_precedence_over_header(self):
        with patch.object(tasks, "get", return_value=object()), patch.object(tasks.events, "stream", return_value=self.events()) as stream:
            response = self.client.get(
                "/api/tasks/contract-task/events?lastEventId=3",
                headers={"Last-Event-ID": "7"},
            )
        self.assertEqual(200, response.status_code)
        stream.assert_called_once_with("contract-task", 3)

    def test_keyword_filter_run_stream(self):
        self.assert_stream(
            "/api/datasets/dataset-1/keyword-filter-runs/run-1/stream",
            (patch.object(training, "stream_keyword_filter_run", return_value=self.events()), patch.object(training, "get_keyword_filter_run", return_value=object())),
        )

    def test_legacy_keyword_filter_stream(self):
        self.assert_stream(
            "/api/datasets/dataset-1/keywords/filter-by-skill/stream",
            (patch.object(training, "stream_keywords_filter_by_skill", return_value=self.events()), patch.object(training, "get", return_value=object())),
        )

    def test_task_event_stream_has_preamble_and_supports_cursor_replay(self):
        broker = TaskEventBroker()
        broker.publish_event("replay-task", "task.progress", {"state": "running"})
        broker.publish_event("replay-task", "task.progress", {"state": "completed"})

        stream = broker.stream("replay-task")
        self.assertEqual(": connected\n\n", next(stream))
        first = next(stream)
        second = next(stream)
        self.assertIn("id: 1", first)
        self.assertIn('"state": "running"', first)
        self.assertIn("id: 2", second)
        self.assertIn('"state": "completed"', second)

        resumed = broker.stream("replay-task", last_event_id=1)
        self.assertEqual(": connected\n\n", next(resumed))
        replayed = next(resumed)
        self.assertIn("id: 2", replayed)
        self.assertIn('"state": "completed"', replayed)

    def test_download_cancel_route_returns_task_snapshot(self):
        now = datetime.now(timezone.utc)
        snapshot = TaskSnapshot(
            id="download-cancel-route",
            batch_id="batch-1",
            type="download",
            state="cancelling",
            stage="cancelling",
            can_cancel=False,
            created_at=now,
            updated_at=now,
        )
        with patch.object(tasks, "get", return_value=SimpleNamespace(can_cancel=True)), patch.object(
            tasks, "cancel", return_value=snapshot
        ) as cancel:
            response = self.client.post("/api/download/tasks/download-cancel-route/cancel")
        self.assertEqual(200, response.status_code)
        self.assertEqual("cancelling", response.json()["state"])
        cancel.assert_called_once_with("download-cancel-route")


if __name__ == "__main__":
    unittest.main()
