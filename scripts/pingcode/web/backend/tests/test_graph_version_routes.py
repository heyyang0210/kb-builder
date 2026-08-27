import json
import statistics
import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory

from fastapi.testclient import TestClient

import app.main as main_module
from app.graph_quality_check_service import GraphQualityCheckService
from app.graph_version_diff_service import GraphVersionDiffService
from app.graph_version_service import GraphVersionService
from app.main import app
from app.models import DatasetVersion, PreprocessConfig
from app.repositories import GraphVersionRepository


class _FilterRuns:
    def list_runs(self, dataset_id, *, offset=0, limit=20):
        return {
            "items": [{
                "filterRunId": f"filter-run-{dataset_id}",
                "status": "applied",
                "modelProvider": "openai",
                "modelName": "isolated-model",
            }],
            "total": 1,
        }


class _Training:
    keyword_filter_runs = _FilterRuns()

    @staticmethod
    def start(request):
        now = datetime.now(timezone.utc).isoformat()
        return {
            "id": "training-task-created",
            "batchId": request.batch_id,
            "type": "graph",
            "state": "queued",
            "createdAt": now,
            "updatedAt": now,
        }

    @staticmethod
    def create_keyword_filter_run(dataset_id):
        return {"datasetId": dataset_id, "filterRunId": "filter-run-created", "status": "created"}

    @staticmethod
    def save_keyword_filter_review_decisions(dataset_id, filter_run_id, **kwargs):
        return {"datasetId": dataset_id, "filterRunId": filter_run_id, "revision": kwargs["expected_revision"] + 1}

    @staticmethod
    def apply_keyword_filter_run(dataset_id, filter_run_id, **kwargs):
        return {"datasetId": dataset_id, "filterRunId": filter_run_id, "status": "applied", "revision": kwargs["expected_revision"]}

    @staticmethod
    def _keyword_filter_state(nodes):
        keywords = [item for item in nodes if item.get("type") == "Keyword"]
        retained = sum(1 for item in keywords if item.get("admissionStatus") != "excluded")
        return {
            "beforeTotal": len(keywords),
            "afterTotal": retained,
            "retained": retained,
            "excluded": len(keywords) - retained,
        }


class _Preprocess:
    def __init__(self, datasets):
        self.datasets = datasets

    def publish(self, dataset_id, force=False):
        dataset = self.datasets[dataset_id]
        published = dataset.model_copy(update={"state": "published"})
        self.datasets[dataset_id] = published
        return published


class GraphVersionRouteTests(unittest.TestCase):
    DATASET_ID = "dataset-graph-version-isolated"
    FALLBACK_ID = "dataset-graph-version-fallback"

    def setUp(self):
        self.temporary = TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.rules_path = self.root / "graph-rules.json"
        self._write_rules("graph-observability-v1")
        self.datasets = {
            self.DATASET_ID: self._dataset(self.DATASET_ID, "final_knowledge"),
            self.FALLBACK_ID: self._dataset(self.FALLBACK_ID, "model_keyword"),
        }
        self.preprocess = _Preprocess(self.datasets)
        self.training = _Training()
        self.repository = GraphVersionRepository(self.root)
        self.version_service = GraphVersionService(
            self.root,
            self.repository,
            GraphQualityCheckService(self.rules_path),
            self.training,
        )
        self.diff_service = GraphVersionDiffService(self.repository)
        self.originals = (
            main_module.preprocess,
            main_module.training,
            main_module.graph_versions,
            main_module.graph_version_diffs,
        )
        main_module.preprocess = self.preprocess
        main_module.training = self.training
        main_module.graph_versions = self.version_service
        main_module.graph_version_diffs = self.diff_service
        self.client = TestClient(app)
        self._write_graph(self.DATASET_ID, generation=1)
        self._write_graph(self.FALLBACK_ID, generation=1)

    def tearDown(self):
        self.client.close()
        main_module.preprocess, main_module.training, main_module.graph_versions, main_module.graph_version_diffs = self.originals
        for path in sorted(self.root.rglob("*"), reverse=True):
            if path.exists():
                try:
                    path.chmod(0o755 if path.is_dir() else 0o644)
                except OSError:
                    pass
        self.temporary.cleanup()

    def _dataset(self, dataset_id, graph_source):
        return DatasetVersion(
            id=dataset_id,
            batchId="batch-graph-version-isolated",
            preprocessTaskId="preprocess-graph-version-isolated",
            state="candidate",
            config=PreprocessConfig(),
            totalDocuments=2,
            totalChunks=2,
            qualityMetrics={},
            qualityPassed=True,
            trainingTaskId="training-graph-version-isolated",
            graphAvailable=True,
            graphSummary={"graphSource": graph_source, "graphSchemaVersion": 4},
            qualityState="passed",
            publishable=True,
            datasetPath=f"datasets/{dataset_id}",
            createdAt=datetime.now(timezone.utc),
        )

    def _write_rules(self, rules_version):
        self.rules_path.write_text(json.dumps({
            "rulesVersion": rules_version,
            "renderLimits": {"defaultNodes": 80, "maxNodes": 80, "defaultEdges": 160, "maxEdges": 160, "defaultDepth": 1, "allowedDepths": [1, 2]},
            "healthThresholds": {"relationCoverageWarningBelow": 0.8, "evidenceCompletenessWarningBelow": 0.9, "isolatedKnowledgeWarningAbove": 0.2, "whyMissingWarningAbove": 0.5},
            "versionGovernance": {"schemaVersion": "graph-version-v1", "defaultPageSize": 20, "defaultDiffPageSize": 50, "maxPageSize": 100, "trendLimit": 20, "maxTrendLimit": 100, "nodeChangeWarningRatioAbove": 0.5, "edgeChangeWarningRatioAbove": 0.5},
        }, ensure_ascii=False), encoding="utf-8")

    def _write_graph(self, dataset_id, generation, scale=2):
        nodes, edges = [], []
        for index in range(scale):
            nodes.extend([
                {"id": f"knowledge:{index}", "type": "KnowledgePoint", "name": f"知识 {index} v{generation if index == 0 else 1}", "knowledgeDomain": "why" if index % 2 == 0 else "what", "content": "不应进入版本的完整正文"},
                {"id": f"chunk:{index}", "type": "ProcessingUnit", "name": f"文档块 {index}"},
            ])
            edges.append({"id": f"edge:{index}", "source": f"knowledge:{index}", "target": f"chunk:{index}", "type": "CONTEXT_MATCHES_CHUNK", "sourceResourceId": f"resource:{index}", "chunkId": f"chunk:{index}", "evidenceText": "证据" * 300, "confidence": 0.9})
        graph_root = self.root / "datasets" / dataset_id / "graph"
        graph_root.mkdir(parents=True, exist_ok=True)
        (graph_root / "nodes.json").write_text(json.dumps(nodes, ensure_ascii=False), encoding="utf-8")
        (graph_root / "edges.json").write_text(json.dumps(edges, ensure_ascii=False), encoding="utf-8")

    def _publish(self, dataset_id):
        return self.client.post(f"/api/datasets/{dataset_id}/publish")

    def test_publish_idempotency_lineage_and_non_final_boundary(self):
        first = self._publish(self.DATASET_ID)
        second = self._publish(self.DATASET_ID)
        fallback = self._publish(self.FALLBACK_ID)
        self.assertEqual(first.status_code, 200, first.text)
        self.assertTrue(first.json()["graphVersion"]["created"])
        self.assertFalse(first.json()["graphVersion"]["idempotentReused"])
        self.assertTrue(second.json()["graphVersion"]["idempotentReused"])
        self.assertEqual(first.json()["graphVersion"]["graphVersionId"], second.json()["graphVersion"]["graphVersionId"])
        self.assertEqual(fallback.json()["graphVersion"]["reason"], "not_final_knowledge")
        self.assertEqual(len(self.repository.list()), 1)

        manifest = self.repository.read_verified(first.json()["graphVersion"]["graphVersionId"])
        self.assertEqual(manifest["sourceTrainingTaskId"], "training-graph-version-isolated")
        self.assertEqual(manifest["sourceFilterRunId"], f"filter-run-{self.DATASET_ID}")
        self.assertTrue(manifest["modelFingerprint"].startswith("sha256:"))
        frozen_nodes = self.repository.read_artifact(manifest["graphVersionId"], "nodes")
        self.assertNotIn("content", frozen_nodes[0])
        frozen_edges = self.repository.read_artifact(manifest["graphVersionId"], "edges")
        self.assertLessEqual(len(frozen_edges[0]["evidenceText"]), 500)
        self.assertTrue((self.root / "datasets" / self.DATASET_ID / "graph-version-audit.jsonl").is_file())

    def test_all_read_apis_diff_trends_and_corruption_isolation(self):
        first_id = self._publish(self.DATASET_ID).json()["graphVersion"]["graphVersionId"]
        self._write_graph(self.DATASET_ID, generation=2, scale=3)
        second_id = self._publish(self.DATASET_ID).json()["graphVersion"]["graphVersionId"]
        self._write_rules("graph-observability-v2")
        third_id = self._publish(self.DATASET_ID).json()["graphVersion"]["graphVersionId"]

        listing = self.client.get(f"/api/graph/versions?datasetId={self.DATASET_ID}&pageSize=2")
        detail = self.client.get(f"/api/graph/versions/{second_id}")
        explore = self.client.get(f"/api/graph/versions/{second_id}/explore?focusNodeId=knowledge%3A0&depth=2")
        checks = self.client.get(f"/api/graph/versions/{second_id}/checks")
        diff = self.client.get(f"/api/graph/versions/{first_id}/diff/{second_id}?pageSize=100")
        trends = self.client.get(f"/api/graph/versions/trends?datasetId={self.DATASET_ID}&limit=20")
        for response in (listing, detail, explore, checks, diff, trends):
            self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(listing.json()["total"], 3)
        self.assertNotIn("nodes", detail.json())
        self.assertTrue(all(edge["source"] in {node["id"] for node in explore.json()["nodes"]} and edge["target"] in {node["id"] for node in explore.json()["nodes"]} for edge in explore.json()["edges"]))
        summary = diff.json()["summary"]
        self.assertEqual(summary["total"], summary["nodes"]["total"] + summary["edges"]["total"])
        self.assertTrue(any(item["rulesChanged"] for item in trends.json()["items"]))

        corrupted_path = self.repository.root / first_id / "nodes.json"
        corrupted_path.chmod(0o644)
        corrupted_path.write_text("[]", encoding="utf-8")
        corrupted = self.client.get(f"/api/graph/versions/{first_id}")
        healthy = self.client.get(f"/api/graph/versions/{third_id}")
        unaffected_list = self.client.get(f"/api/graph/versions?datasetId={self.DATASET_ID}")
        self.assertEqual(corrupted.status_code, 409, corrupted.text)
        self.assertEqual(corrupted.json()["error"]["code"], "GRAPH_VERSION_CORRUPTED")
        self.assertEqual(healthy.status_code, 200, healthy.text)
        self.assertEqual(unaffected_list.status_code, 200, unaffected_list.text)

    def test_concurrent_creation_and_snapshot_failure_warning(self):
        dataset = self.datasets[self.DATASET_ID]
        with ThreadPoolExecutor(max_workers=8) as executor:
            results = list(executor.map(lambda _: self.version_service.after_publish(dataset), range(8)))
        self.assertEqual(len({item["graphVersionId"] for item in results}), 1)
        self.assertEqual(sum(1 for item in results if not item["idempotentReused"]), 1)
        self.assertEqual(len(self.repository.list(self.DATASET_ID)), 1)

        for path in (self.repository.root / results[0]["graphVersionId"]).iterdir():
            if path.is_file():
                path.chmod(0o644)
        (self.repository.root / results[0]["graphVersionId"]).chmod(0o755)
        for path in (self.repository.root / results[0]["graphVersionId"]).iterdir():
            path.unlink()
        (self.repository.root / results[0]["graphVersionId"]).rmdir()

        graph_root = self.root / "datasets" / self.DATASET_ID / "graph"
        duplicate_nodes = [
            {"id": "duplicate", "type": "KnowledgePoint", "knowledgeDomain": "why"},
            {"id": "duplicate", "type": "ProcessingUnit"},
        ]
        (graph_root / "nodes.json").write_text(json.dumps(duplicate_nodes), encoding="utf-8")
        (graph_root / "edges.json").write_text(json.dumps([]), encoding="utf-8")
        response = self._publish(self.DATASET_ID)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["state"], "published")
        self.assertEqual(response.json()["graphVersion"]["reason"], "snapshot_failed")
        self.assertEqual(response.json()["graphVersion"]["status"], "warning")

    def test_filter_run_review_and_apply_do_not_create_formal_versions(self):
        training_task = self.client.post(
            "/api/training/tasks",
            json={"batchId": "batch-graph-version-isolated", "mode": "formal_knowledge", "config": {}},
        )
        created = self.client.post(f"/api/datasets/{self.DATASET_ID}/keyword-filter-runs")
        reviewed = self.client.patch(
            f"/api/datasets/{self.DATASET_ID}/keyword-filter-runs/filter-run-created/review-decisions",
            json={"expectedRevision": 0, "changes": []},
        )
        applied = self.client.post(
            f"/api/datasets/{self.DATASET_ID}/keyword-filter-runs/filter-run-created/apply",
            json={"revision": 1},
        )
        self.assertEqual(training_task.status_code, 202, training_task.text)
        self.assertNotIn("graphVersionId", training_task.json())
        self.assertEqual(created.status_code, 201, created.text)
        self.assertEqual(reviewed.status_code, 200, reviewed.text)
        self.assertEqual(applied.status_code, 200, applied.text)
        self.assertEqual(self.repository.list(), [])

    def test_http_performance_for_thousand_scale_diff_list_and_trends(self):
        self._write_graph(self.DATASET_ID, generation=1, scale=1000)
        first_id = self._publish(self.DATASET_ID).json()["graphVersion"]["graphVersionId"]
        self._write_graph(self.DATASET_ID, generation=2, scale=1000)
        second_id = self._publish(self.DATASET_ID).json()["graphVersion"]["graphVersionId"]
        durations = {"list": [], "trends": [], "diff": []}
        urls = {
            "list": f"/api/graph/versions?datasetId={self.DATASET_ID}",
            "trends": f"/api/graph/versions/trends?datasetId={self.DATASET_ID}",
            "diff": f"/api/graph/versions/{first_id}/diff/{second_id}?pageSize=100",
        }
        for _ in range(12):
            for name, url in urls.items():
                started = time.perf_counter()
                response = self.client.get(url)
                durations[name].append((time.perf_counter() - started) * 1000)
                self.assertEqual(response.status_code, 200, response.text)
        p95 = {name: statistics.quantiles(values, n=100, method="inclusive")[94] for name, values in durations.items()}
        self.assertLess(p95["list"], 500)
        self.assertLess(p95["trends"], 500)
        self.assertLess(p95["diff"], 1000)
        print(f"KGO-31 performance: list_p95={p95['list']:.2f}ms, trends_p95={p95['trends']:.2f}ms, diff_1000_p95={p95['diff']:.2f}ms")


if __name__ == "__main__":
    unittest.main()
