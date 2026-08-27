import json
import statistics
import time
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import patch

from fastapi.testclient import TestClient

import app.main as main_module
from app.main import app
from app.repositories import LocalKeywordFilterRunRepository
from app.training_service import TrainingService


class DeterministicKeywordFilterGateway:
    """根据候选 ID 生成完整决策，避免调用外部模型。"""

    def __init__(self):
        self.variant = 0

    def status(self):
        return {
            "configured": True,
            "provider": "test-gateway",
            "model": "deterministic-keyword-filter-v1",
        }

    def chat_json(self, messages, options):
        marker = "关键词列表：\n"
        candidates = json.loads(messages[-1]["content"].split(marker, 1)[1])
        decisions = []
        for item in candidates:
            index = int(str(item["id"]).rsplit(":", 1)[-1])
            excluded = (index + self.variant) % 4 != 0
            decision = {
                "keywordId": item["id"],
                "keywordName": item.get("name"),
                "shouldExclude": excluded,
                "reason": "隔离验收决策",
            }
            if excluded:
                decision["issueCategory"] = (
                    "generic_term" if (index + self.variant) % 2 else "language_variant"
                )
            decisions.append(decision)
        return {"data": {"decisions": decisions}}


class RecordingStore:
    def __init__(self):
        self.updates = []

    def update_record(self, collection, record_id, changes):
        self.updates.append((collection, record_id, changes))
        return changes


def parse_sse_events(body):
    events = []
    for block in body.split("\n\n"):
        lines = block.splitlines()
        if not lines or not lines[0].startswith("event: "):
            continue
        payload = next((line[6:] for line in lines if line.startswith("data: ")), "{}")
        events.append((lines[0][7:], json.loads(payload)))
    return events


class KeywordFilterRunRouteContractTests(unittest.TestCase):
    def test_keyword_filter_run_resource_routes_are_registered(self):
        paths = {route.path for route in app.routes}
        expected = {
            "/api/datasets/{dataset_id}/keyword-filter-runs",
            "/api/datasets/{dataset_id}/keyword-filter-runs/{filter_run_id}",
            "/api/datasets/{dataset_id}/keyword-filter-runs/{filter_run_id}/stream",
            "/api/datasets/{dataset_id}/keyword-filter-runs/{left_run_id}/diff/{right_run_id}",
            "/api/datasets/{dataset_id}/keyword-filter-runs/{filter_run_id}/apply",
        }
        self.assertTrue(expected.issubset(paths))

    def test_legacy_keyword_filter_routes_remain_registered(self):
        paths = {route.path for route in app.routes}
        self.assertIn("/api/datasets/{dataset_id}/keywords/filter-by-skill", paths)
        self.assertIn("/api/datasets/{dataset_id}/keywords/filter-by-skill/stream", paths)
        self.assertIn("/api/datasets/{dataset_id}/keywords/filter-apply", paths)


class KeywordFilterRunApiAcceptanceTests(unittest.TestCase):
    DATASET_ID = "dataset-audit-isolated"
    KEYWORD_TOTAL = 643

    def setUp(self):
        self.temporary = TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.gateway = DeterministicKeywordFilterGateway()
        self.store = RecordingStore()
        self.dataset = SimpleNamespace(
            id=self.DATASET_ID,
            state="candidate",
            graph_available=True,
            training_task_id="training-audit-isolated",
            graph_summary={"graphSource": "metadata_keyword"},
        )
        self._write_graph(self.KEYWORD_TOTAL)
        self.service = TrainingService(
            self.store,
            None,
            None,
            None,
            None,
            gateway=self.gateway,
            keyword_filter_run_repository=LocalKeywordFilterRunRepository(self.root),
        )
        self.service.ensure_dataset_graph = lambda dataset_id: self.dataset
        self.settings = SimpleNamespace(
            data_root=self.root,
            keyword_filter_batch_size=50,
            keyword_filter_max_retries=0,
        )
        self.settings_patch = patch("app.training_service.settings", self.settings)
        self.settings_patch.start()
        self.original_training = main_module.training
        main_module.training = self.service
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        main_module.training = self.original_training
        self.settings_patch.stop()
        self.temporary.cleanup()

    def _write_graph(self, total, *, renamed_first=False):
        nodes = []
        edges = []
        for index in range(total):
            name = "已变更关键词" if renamed_first and index == 0 else f"关键词 {index}"
            nodes.append({
                "id": f"keyword:{index}",
                "keywordId": f"keyword:{index}",
                "type": "Keyword",
                "canonicalName": name,
                "name": f"keyword {index}",
                "aliases": [f"K{index}"],
                "chunkIds": [f"chunk:{index}"],
                "admissionStatus": "admitted",
            })
            nodes.append({"id": f"chunk:{index}", "type": "ProcessingUnit"})
            edges.append({
                "source": f"keyword:{index}",
                "target": f"chunk:{index}",
                "type": "CONTEXT_MATCHES_CHUNK",
            })
        for graph_root in (
            self.root / "training-runs" / self.dataset.training_task_id / "graph",
            self.root / "datasets" / self.DATASET_ID / "graph",
        ):
            graph_root.mkdir(parents=True, exist_ok=True)
            (graph_root / "nodes.json").write_text(
                json.dumps(nodes, ensure_ascii=False), encoding="utf-8"
            )
            (graph_root / "edges.json").write_text(
                json.dumps(edges, ensure_ascii=False), encoding="utf-8"
            )

    def _create_and_stream(self):
        created = self.client.post(
            f"/api/datasets/{self.DATASET_ID}/keyword-filter-runs"
        )
        self.assertEqual(created.status_code, 201, created.text)
        run_id = created.json()["filterRunId"]
        streamed = self.client.get(
            f"/api/datasets/{self.DATASET_ID}/keyword-filter-runs/{run_id}/stream"
        )
        self.assertEqual(streamed.status_code, 200, streamed.text)
        events = parse_sse_events(streamed.text)
        self.assertEqual(events[-1][0], "complete")
        return run_id, events

    def test_create_stream_refresh_history_replay_diff_and_apply(self):
        first_run_id, first_events = self._create_and_stream()
        first_decisions = [payload for event, payload in first_events if event == "decision"]
        self.assertEqual(len(first_decisions), self.KEYWORD_TOTAL)
        self.assertEqual(first_events[-1][1]["status"], "reviewable")
        self.assertEqual(first_events[-1][1]["decisionTotal"], self.KEYWORD_TOTAL)

        detail = self.client.get(
            f"/api/datasets/{self.DATASET_ID}/keyword-filter-runs/{first_run_id}"
        )
        self.assertEqual(detail.status_code, 200, detail.text)
        detail_payload = detail.json()
        self.assertEqual(len(detail_payload["candidates"]), self.KEYWORD_TOTAL)
        self.assertEqual(len(detail_payload["modelDecisions"]), self.KEYWORD_TOTAL)
        self.assertTrue(detail_payload["skillVersion"].startswith("sha256:"))
        self.assertTrue(detail_payload["rulesVersion"].startswith("sha256:"))
        self.assertTrue(detail_payload["sourceGraphVersion"].startswith("sha256:"))
        self.assertEqual(detail_payload["modelProvider"], "test-gateway")
        self.assertEqual(detail_payload["modelName"], "deterministic-keyword-filter-v1")

        replayed = self.client.get(
            f"/api/datasets/{self.DATASET_ID}/keyword-filter-runs/{first_run_id}/stream"
        )
        replay_events = parse_sse_events(replayed.text)
        self.assertEqual(len([item for item in replay_events if item[0] == "decision"]), self.KEYWORD_TOTAL)
        self.assertTrue(replay_events[-1][1]["replayed"])

        self.gateway.variant = 1
        second_run_id, _ = self._create_and_stream()
        history = self.client.get(
            f"/api/datasets/{self.DATASET_ID}/keyword-filter-runs?offset=0&limit=1"
        )
        self.assertEqual(history.status_code, 200, history.text)
        self.assertEqual(history.json()["total"], 2)
        self.assertEqual(len(history.json()["items"]), 1)
        self.assertEqual(history.json()["limit"], 1)

        compared = self.client.get(
            f"/api/datasets/{self.DATASET_ID}/keyword-filter-runs/{first_run_id}/diff/{second_run_id}"
        )
        self.assertEqual(compared.status_code, 200, compared.text)
        self.assertGreater(compared.json()["summary"]["actionChanged"], 0)

        current_revision = detail_payload["revision"]
        conflict = self.client.post(
            f"/api/datasets/{self.DATASET_ID}/keyword-filter-runs/{first_run_id}/apply",
            json={"revision": current_revision - 1},
        )
        self.assertEqual(conflict.status_code, 409, conflict.text)
        self.assertEqual(
            conflict.json()["error"]["code"], "KEYWORD_FILTER_RUN_REVISION_CONFLICT"
        )

        applied = self.client.post(
            f"/api/datasets/{self.DATASET_ID}/keyword-filter-runs/{first_run_id}/apply",
            json={"revision": current_revision},
        )
        self.assertEqual(applied.status_code, 200, applied.text)
        self.assertEqual(applied.json()["run"]["status"], "applied")
        applied_detail = self.client.get(
            f"/api/datasets/{self.DATASET_ID}/keyword-filter-runs/{first_run_id}"
        ).json()
        self.assertEqual(len(applied_detail["finalDecisions"]), self.KEYWORD_TOTAL)
        self.assertEqual(
            [item["modelAction"] for item in applied_detail["modelDecisions"]],
            [item["modelAction"] for item in detail_payload["modelDecisions"]],
        )

        created_after_apply = self.client.post(
            f"/api/datasets/{self.DATASET_ID}/keyword-filter-runs"
        )
        self.assertEqual(created_after_apply.status_code, 201, created_after_apply.text)
        self.assertEqual(
            created_after_apply.json()["run"]["candidateTotal"], self.KEYWORD_TOTAL
        )
        next_run_id = created_after_apply.json()["filterRunId"]
        next_detail = self.client.get(
            f"/api/datasets/{self.DATASET_ID}/keyword-filter-runs/{next_run_id}"
        )
        self.assertEqual(next_detail.status_code, 200, next_detail.text)
        self.assertEqual(len(next_detail.json()["candidates"]), self.KEYWORD_TOTAL)

    def test_apply_rejects_changed_source_graph(self):
        run_id, _ = self._create_and_stream()
        revision = self.client.get(
            f"/api/datasets/{self.DATASET_ID}/keyword-filter-runs/{run_id}"
        ).json()["revision"]
        self._write_graph(self.KEYWORD_TOTAL, renamed_first=True)

        response = self.client.post(
            f"/api/datasets/{self.DATASET_ID}/keyword-filter-runs/{run_id}/apply",
            json={"revision": revision},
        )

        self.assertEqual(response.status_code, 409, response.text)
        self.assertEqual(response.json()["error"]["code"], "KEYWORD_FILTER_SOURCE_CHANGED")
        self.assertEqual(self.store.updates, [])

    def test_643_detail_and_history_api_p95_meet_targets(self):
        run_id, _ = self._create_and_stream()
        detail_path = f"/api/datasets/{self.DATASET_ID}/keyword-filter-runs/{run_id}"
        list_path = f"/api/datasets/{self.DATASET_ID}/keyword-filter-runs"

        self.client.get(detail_path)
        self.client.get(list_path)
        detail_times = []
        list_times = []
        for _ in range(20):
            started = time.perf_counter()
            response = self.client.get(detail_path)
            detail_times.append((time.perf_counter() - started) * 1000)
            self.assertEqual(response.status_code, 200)
            started = time.perf_counter()
            response = self.client.get(list_path)
            list_times.append((time.perf_counter() - started) * 1000)
            self.assertEqual(response.status_code, 200)

        detail_p95 = statistics.quantiles(detail_times, n=100, method="inclusive")[94]
        list_p95 = statistics.quantiles(list_times, n=100, method="inclusive")[94]
        print(
            f"AUD-09 performance: detail_643_p95={detail_p95:.2f}ms, "
            f"history_p95={list_p95:.2f}ms"
        )
        self.assertLess(detail_p95, 500)
        self.assertLess(list_p95, 300)


if __name__ == "__main__":
    unittest.main()
