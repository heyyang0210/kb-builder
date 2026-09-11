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


class FrozenRunRepository:
    def __init__(self, total=120):
        self.stale = False
        self.candidates = [
            {"keywordId": f"keyword:{index}", "keywordName": f"关键词 {index}", "keywordRawName": f"关键词 {index}", "aliases": [], "evidenceRefs": [f"chunk:{index}"], "currentStatus": "admitted"}
            for index in range(total)
        ]
        self.model = [
            {"keywordId": f"keyword:{index}", "keywordName": f"关键词 {index}", "modelAction": "keep" if index % 2 == 0 else "exclude", "modelIssueCategory": None if index % 2 == 0 else "generic_term", "modelReason": "隔离决策"}
            for index in range(total)
        ]
        self.final = [
            {**item, "finalAction": item["modelAction"], "finalIssueCategory": item["modelIssueCategory"], "userOverride": False}
            for item in self.model
        ]

    def read_run(self, dataset_id, filter_run_id):
        if filter_run_id != "filter-run-graph":
            from app.repositories import KeywordFilterRunNotFoundError
            raise KeywordFilterRunNotFoundError(filter_run_id)
        return {"datasetId": dataset_id, "filterRunId": filter_run_id, "sourceGraphVersion": "stale" if self.stale else "current"}

    def read_candidate_snapshot(self, dataset_id, filter_run_id):
        return self.candidates

    def read_model_decisions(self, dataset_id, filter_run_id):
        return self.model

    def read_review_decisions(self, dataset_id, filter_run_id):
        return []

    def read_final_decisions(self, dataset_id, filter_run_id):
        return self.final

    def fingerprint_candidates(self, candidates):
        return "current"


class IsolatedFileService:
    def __init__(self):
        self.contents = {
            "resource:0": "前言" + ("证" * 500) + "结尾",
            "resource:1": "证据 1\n正文\n证据 1",
            "resource:2": "只有原文，没有已保存的证据片段",
        }

    def find(self, resource_id):
        if resource_id not in self.contents:
            raise KeyError(resource_id)
        resource = SimpleNamespace(
            id=resource_id,
            name=f"隔离原文-{resource_id[-1]}.md",
            logical_path=f"spaces/isolated/{resource_id}.md",
            media_type="text/markdown",
            previewable=True,
        )
        return resource, Path(resource.logical_path)

    def preview(self, resource_id):
        if resource_id not in self.contents:
            raise KeyError(resource_id)
        return SimpleNamespace(content=self.contents[resource_id])


class GraphExplorationRouteTests(unittest.TestCase):
    DATASET_ID = "dataset-graph-exploration-isolated"

    def setUp(self):
        self.temporary = TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.repository = FrozenRunRepository()
        self.dataset = SimpleNamespace(id=self.DATASET_ID, state="candidate", graph_available=True, training_task_id="training-graph-exploration-isolated", graph_summary={"graphSource": "metadata_keyword"})
        self.settings_patch = patch("app.training_service.settings", SimpleNamespace(data_root=self.root))
        self.settings_patch.start()
        self.service = TrainingService(
            None,
            None,
            None,
            SimpleNamespace(get_dataset=self._get_dataset),
            None,
            gateway=SimpleNamespace(),
            keyword_filter_run_repository=self.repository,
            file_service=IsolatedFileService(),
        )
        self.service.ensure_dataset_graph = lambda dataset_id: self._get_dataset(dataset_id)
        self.original_training = main_module.training
        main_module.training = self.service
        self.client = TestClient(app)
        self._write_graph()

    def tearDown(self):
        self.client.close()
        main_module.training = self.original_training
        self.settings_patch.stop()
        self.temporary.cleanup()

    def _get_dataset(self, dataset_id):
        if dataset_id != self.DATASET_ID:
            raise KeyError(dataset_id)
        return self.dataset

    def _write_graph(self):
        nodes, edges = [], []
        for index in range(120):
            evidence = "证" * 620 if index == 0 else ("" if index == 2 else f"证据 {index}")
            resource_id = "resource:missing" if index == 3 else ("" if index == 5 else f"resource:{index % 3}")
            nodes.extend([
                {"id": f"keyword:{index}", "keywordId": f"keyword:{index}", "type": "Keyword", "name": f"关键词 {index}", "canonicalName": f"索引关键词 {index}", "aliases": [f"K{index}"], "chunkIds": [f"chunk:{index}"], "admissionStatus": "admitted", "occurrences": [{"resourceId": resource_id, "chunkId": f"chunk:{index}", "headingPath": ["隔离章节"], "evidenceText": evidence}]},
                {"id": f"chunk:{index}", "type": "ProcessingUnit", "name": f"文档块 {index}", "sourceResourceId": resource_id},
            ])
            edges.append({"id": f"edge:{index}", "source": f"keyword:{index}", "target": f"chunk:{index}", "type": "CONTEXT_MATCHES_CHUNK", "sourceResourceId": resource_id, "chunkId": f"chunk:{index}", "evidenceText": evidence, "confidence": 0.9})
        graph_root = self.root / "training-runs" / self.dataset.training_task_id / "graph"
        graph_root.mkdir(parents=True, exist_ok=True)
        (graph_root / "nodes.json").write_text(json.dumps(nodes, ensure_ascii=False), encoding="utf-8")
        (graph_root / "edges.json").write_text(json.dumps(edges, ensure_ascii=False), encoding="utf-8")

    def _search(self, view, **params):
        query = "&".join(f"{key}={value}" for key, value in params.items())
        return self.client.get(f"/api/datasets/{self.DATASET_ID}/graph/search?filterRunId=filter-run-graph&view={view}&{query}")

    def test_before_after_changed_and_global_filter_then_page(self):
        before = self._search("before", nodeType="Keyword", page=1, pageSize=10)
        after = self._search("after", nodeType="Keyword", page=1, pageSize=10)
        changed = self._search("changed", nodeType="Keyword", issueCategory="generic_term", page=1, pageSize=10)
        self.assertEqual(before.status_code, 200, before.text)
        self.assertEqual(before.json()["total"], 120)
        self.assertEqual(after.json()["total"], 60)
        self.assertEqual(changed.json()["total"], 60)
        self.assertEqual(len(changed.json()["items"]), 10)
        resource = self._search("before", nodeType="Keyword", resourceId="resource:1", query="索引", page=2, pageSize=7)
        self.assertEqual(resource.json()["total"], 40)
        self.assertEqual(len(resource.json()["items"]), 7)

    def test_stale_returns_no_guessed_relations(self):
        self.repository.stale = True
        search = self._search("after", page=1, pageSize=20)
        explore = self.client.get(f"/api/datasets/{self.DATASET_ID}/graph/explore?filterRunId=filter-run-graph&view=after&focusNodeId=keyword%3A0&depth=1")
        self.assertEqual(search.json()["sourceAvailability"], "stale")
        self.assertEqual(search.json()["items"], [])
        self.assertEqual(explore.json()["scope"]["projectionAvailability"], "stale")
        self.assertEqual(explore.json()["edges"], [])

    def test_explore_is_stable_bounded_and_has_no_dangling_edges(self):
        url = f"/api/datasets/{self.DATASET_ID}/graph/explore?filterRunId=filter-run-graph&view=before&focusNodeId=keyword%3A0&depth=2"
        first, second = self.client.get(url), self.client.get(url)
        self.assertEqual(first.status_code, 200, first.text)
        payload = first.json()
        ids = {node["id"] for node in payload["nodes"]}
        self.assertTrue(all(edge["source"] in ids and edge["target"] in ids for edge in payload["edges"]))
        self.assertLessEqual(len(payload["nodes"]), 80)
        self.assertLessEqual(len(payload["edges"]), 160)
        self.assertEqual(payload["nodes"], second.json()["nodes"])
        self.assertEqual(payload["edges"], second.json()["edges"])

    def test_node_and_edge_evidence_source_resolution_and_validation(self):
        node = self.client.get(f"/api/datasets/{self.DATASET_ID}/graph/evidence?filterRunId=filter-run-graph&view=before&nodeId=keyword%3A0")
        self.assertEqual(node.status_code, 200, node.text)
        item = node.json()["items"][0]
        self.assertLessEqual(len(item["evidenceText"]), 500)
        self.assertEqual(item["evidenceAvailability"], "available")
        self.assertEqual(item["source"]["previewMode"], "structured_text")
        self.assertEqual(item["location"]["level"], "exact")
        self.assertEqual(item["location"]["basis"], "verified_evidence_text")
        missing = self.client.get(f"/api/datasets/{self.DATASET_ID}/graph/evidence?filterRunId=filter-run-graph&view=before&nodeId=keyword%3A2&missingEvidence=true")
        self.assertEqual(missing.json()["evidenceAvailability"], "snippet_missing")
        self.assertEqual(missing.json()["items"][0]["location"]["level"], "section")
        unavailable = self.client.get(f"/api/datasets/{self.DATASET_ID}/graph/evidence?filterRunId=filter-run-graph&view=before&nodeId=keyword%3A3&missingEvidence=true")
        self.assertEqual(unavailable.json()["evidenceAvailability"], "source_unavailable")
        unlinked = self.client.get(f"/api/datasets/{self.DATASET_ID}/graph/evidence?filterRunId=filter-run-graph&view=before&nodeId=keyword%3A5&missingEvidence=true")
        self.assertEqual(unlinked.json()["evidenceAvailability"], "unlinked")
        edge = self.client.get(f"/api/datasets/{self.DATASET_ID}/graph/evidence?filterRunId=filter-run-graph&view=before&edgeId=edge%3A0")
        self.assertEqual(edge.status_code, 200, edge.text)
        self.assertEqual(edge.json()["items"][0]["location"]["level"], "exact")
        required = self.client.get(f"/api/datasets/{self.DATASET_ID}/graph/evidence")
        self.assertEqual(required.status_code, 422)
        too_large = self.client.get(f"/api/datasets/{self.DATASET_ID}/graph/evidence?nodeId=keyword%3A0&pageSize=101")
        self.assertEqual(too_large.status_code, 422)

    def test_search_performance_p95(self):
        durations = []
        for _ in range(30):
            started = time.perf_counter()
            response = self._search("before", query="关键词", nodeType="Keyword", page=1, pageSize=100)
            durations.append((time.perf_counter() - started) * 1000)
            self.assertEqual(response.status_code, 200, response.text)
        self.assertLess(statistics.quantiles(durations, n=100, method="inclusive")[94], 500)


if __name__ == "__main__":
    unittest.main()
