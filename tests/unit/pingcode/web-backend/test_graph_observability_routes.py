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
from app.training_service import TrainingService


class _RunRepository:
    def __init__(self, stale=False):
        self.stale = stale

    def read_run(self, dataset_id, filter_run_id):
        if filter_run_id != "filter-run-fixture":
            from app.repositories import KeywordFilterRunNotFoundError
            raise KeywordFilterRunNotFoundError(filter_run_id)
        return {"datasetId": dataset_id, "sourceGraphVersion": "sha256:stale" if self.stale else "sha256:current"}

    def fingerprint_candidates(self, candidates):
        return "sha256:current"


class GraphObservabilityRouteTests(unittest.TestCase):
    DATASET_ID = "dataset-graph-observability-isolated"

    def setUp(self):
        self.temporary = TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.dataset = SimpleNamespace(
            id=self.DATASET_ID,
            state="candidate",
            graph_available=True,
            training_task_id="training-graph-observability-isolated",
            graph_summary={"graphSource": "metadata_keyword"},
        )
        preprocess = SimpleNamespace(get_dataset=self._get_dataset)
        self.settings = SimpleNamespace(data_root=self.root)
        self.settings_patch = patch("app.training_service.settings", self.settings)
        self.settings_patch.start()
        self.service = TrainingService(
            None,
            None,
            None,
            preprocess,
            None,
            gateway=SimpleNamespace(),
            keyword_filter_run_repository=_RunRepository(),
        )
        self.service.ensure_dataset_graph = lambda dataset_id: self._get_dataset(dataset_id)
        self.original_training = main_module.training
        main_module.training = self.service
        self.client = TestClient(app)
        self._write_graph(keyword_total=643, edge_total=1000)

    def tearDown(self):
        self.client.close()
        main_module.training = self.original_training
        self.settings_patch.stop()
        self.temporary.cleanup()

    def _get_dataset(self, dataset_id):
        if dataset_id != self.DATASET_ID:
            raise KeyError(dataset_id)
        return self.dataset

    def _write_graph(self, keyword_total, edge_total):
        nodes = []
        edges = []
        for index in range(keyword_total):
            nodes.append({
                "id": f"keyword:{index}",
                "keywordId": f"keyword:{index}",
                "type": "Keyword",
                "name": f"关键词 {index}",
                "admissionStatus": "admitted",
                "knowledgeDomain": "why" if index % 5 == 0 else "what",
            })
            nodes.append({"id": f"chunk:{index}", "type": "ProcessingUnit", "name": f"文档块 {index}"})
        for index in range(edge_total):
            keyword_index = index % keyword_total
            edges.append({
                "id": f"edge:{index}",
                "source": f"keyword:{keyword_index}",
                "target": f"chunk:{keyword_index}",
                "type": "CONTEXT_MATCHES_CHUNK",
                "weight": (index % 10) + 1,
                "sourceResourceId": f"resource:{keyword_index % 7}",
                "chunkId": f"chunk:{keyword_index}",
                "evidenceText": "隔离测试证据",
            })
        graph_root = self.root / "training-runs" / self.dataset.training_task_id / "graph"
        graph_root.mkdir(parents=True, exist_ok=True)
        (graph_root / "nodes.json").write_text(json.dumps(nodes, ensure_ascii=False), encoding="utf-8")
        (graph_root / "edges.json").write_text(json.dumps(edges, ensure_ascii=False), encoding="utf-8")

    def test_observability_contract_and_pending_view(self):
        response = self.client.get(f"/api/datasets/{self.DATASET_ID}/graph/observability?view=after")
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual(payload["counts"]["keywords"], {"before": 643, "kept": 643, "excluded": 0})
        self.assertGreaterEqual(payload["counts"]["fact"]["nodes"], payload["counts"]["projected"]["nodes"])
        self.assertEqual(payload["rulesVersion"], "graph-observability-v1")
        for metric in payload["health"].values():
            self.assertIn(metric["availability"], {"available", "not_applicable"})

        pending = self.client.get(f"/api/datasets/{self.DATASET_ID}/graph/observability?view=changed")
        self.assertEqual(pending.status_code, 200, pending.text)
        self.assertEqual(pending.json()["scope"]["availability"], "pending")

    def test_stale_and_not_applicable_are_explicit(self):
        self.service.keyword_filter_runs = _RunRepository(stale=True)
        stale = self.client.get(
            f"/api/datasets/{self.DATASET_ID}/graph/observability?filterRunId=filter-run-fixture&view=after"
        )
        self.assertEqual(stale.status_code, 200, stale.text)
        self.assertEqual(stale.json()["scope"]["sourceAvailability"], "stale")
        self.assertTrue(stale.json()["warnings"])

        self._write_graph(keyword_total=0, edge_total=0)
        empty = self.client.get(f"/api/datasets/{self.DATASET_ID}/graph/observability")
        self.assertEqual(empty.status_code, 200, empty.text)
        self.assertEqual(empty.json()["health"]["relationCoverage"]["availability"], "not_applicable")

    def test_neighborhood_is_bounded_and_stable(self):
        first = self.client.get(
            f"/api/datasets/{self.DATASET_ID}/graph/neighborhood?nodeId=keyword%3A0&limit=200&depth=2"
        )
        second = self.client.get(
            f"/api/datasets/{self.DATASET_ID}/graph/neighborhood?nodeId=keyword%3A0&limit=200&depth=2"
        )
        self.assertEqual(first.status_code, 200, first.text)
        payload = first.json()
        self.assertLessEqual(len(payload["nodes"]), 80)
        self.assertLessEqual(len(payload["edges"]), 160)
        self.assertEqual(payload["counts"]["nodes"]["visible"], len(payload["nodes"]))
        self.assertEqual(payload["counts"]["edges"]["visible"], len(payload["edges"]))
        self.assertEqual(payload["nodes"], second.json()["nodes"])
        self.assertEqual(payload["edges"], second.json()["edges"])

    def test_errors_and_existing_routes_remain_compatible(self):
        missing = self.client.get("/api/datasets/missing/graph/observability")
        self.assertEqual(missing.status_code, 404)
        invalid = self.client.get(f"/api/datasets/{self.DATASET_ID}/graph/observability?view=invalid")
        self.assertEqual(invalid.status_code, 422)
        node_missing = self.client.get(
            f"/api/datasets/{self.DATASET_ID}/graph/neighborhood?nodeId=missing"
        )
        self.assertEqual(node_missing.status_code, 404)
        for suffix in ("summary", "nodes?limit=10", "edges?limit=10"):
            response = self.client.get(f"/api/datasets/{self.DATASET_ID}/graph/{suffix}")
            self.assertEqual(response.status_code, 200, response.text)

    def test_http_performance_p95(self):
        durations = []
        for _ in range(30):
            started = time.perf_counter()
            response = self.client.get(f"/api/datasets/{self.DATASET_ID}/graph/observability")
            durations.append((time.perf_counter() - started) * 1000)
            self.assertEqual(response.status_code, 200, response.text)
        p95 = statistics.quantiles(durations, n=100, method="inclusive")[94]
        self.assertLess(p95, 500, f"observability P95={p95:.2f}ms")


if __name__ == "__main__":
    unittest.main()
