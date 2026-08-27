import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app, tasks, training


class SseCompatibilityTest(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    @staticmethod
    def events():
        yield 'id: 1\nevent: contract.test\ndata: {"status":"ok"}\n\n'

    def assert_stream(self, path, patches):
        with patches[0], patches[1]:
            response = self.client.get(path)
        self.assertEqual(200, response.status_code)
        self.assertTrue(response.headers["content-type"].startswith("text/event-stream"))
        self.assertEqual("no-cache", response.headers["cache-control"])
        self.assertEqual("no", response.headers["x-accel-buffering"])
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


if __name__ == "__main__":
    unittest.main()
