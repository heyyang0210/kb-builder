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
from app.keyword_issue_insight_service import KeywordIssueInsightService
from app.main import app
from app.repositories import LocalKeywordFilterRunRepository
from app.training_service import TrainingService


class InsightGateway:
    def __init__(self, total):
        self.total = total

    def status(self):
        return {"configured": True, "provider": "test", "model": "insight-fixture-v1"}

    def chat_json(self, messages, options):
        marker = "关键词列表：\n"
        candidates = json.loads(messages[-1]["content"].split(marker, 1)[1])
        exact_categories = {
            0: "generic_term", 1: "generic_term", 2: "generic_term", 3: "generic_term",
            4: "language_variant", 5: "language_variant", 6: "language_variant",
            7: "error_code_alias", 8: "error_code_alias", 9: "error_code_alias",
            11: "insufficient_evidence",
        }
        decisions = []
        for candidate in candidates:
            index = int(str(candidate["id"]).rsplit(":", 1)[-1])
            if self.total == 12:
                category = exact_categories.get(index)
            else:
                category = ("generic_term", "language_variant", "error_code_alias")[index % 3]
            decisions.append({
                "keywordId": candidate["id"],
                "keywordName": candidate.get("name"),
                "shouldExclude": category is not None,
                "issueCategory": category,
                "reason": f"证据测试理由 {index}",
            })
        return {"data": {"decisions": decisions}}


class RecordingStore:
    def update_record(self, collection, record_id, changes):
        return changes


class KeywordIssueInsightRouteTests(unittest.TestCase):
    DATASET_ID = "dataset-insight-isolated"

    def setUp(self):
        self.temporary = TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.total = 12
        self.dataset = SimpleNamespace(
            id=self.DATASET_ID,
            state="candidate",
            graph_available=True,
            training_task_id="training-insight-isolated",
            graph_summary={"graphSource": "metadata_keyword"},
        )
        self._write_fixture(self.total)
        self.settings_patch = patch(
            "app.training_service.settings",
            SimpleNamespace(
                data_root=self.root,
                keyword_filter_batch_size=50,
                keyword_filter_max_retries=0,
            ),
        )
        self.settings_patch.start()
        self._install_service(self.total)
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        main_module.training = self.original_training
        self.settings_patch.stop()
        self.temporary.cleanup()

    def _install_service(self, total):
        if not hasattr(self, "original_training"):
            self.original_training = main_module.training
        service = TrainingService(
            RecordingStore(), None, None, None, None,
            gateway=InsightGateway(total),
            keyword_filter_run_repository=LocalKeywordFilterRunRepository(self.root),
        )
        service.keyword_issue_insights = KeywordIssueInsightService(self.root)
        service.ensure_dataset_graph = lambda dataset_id: self.dataset
        main_module.training = service
        self.service = service

    def _write_fixture(self, total, *, stale_name=False):
        nodes = []
        documents = []
        chunks = []
        if total == 12:
            occurrence_map = {
                0: [
                    ("resource:A", "chunk:A1", "A1 对象证据"),
                    ("resource:A", "chunk:A1", "A1 对象证据"),
                    ("resource:A", "chunk:A2", "A2 对象证据"),
                    ("resource:B", "chunk:B1", "B1 对象证据"),
                ],
                1: [("resource:A", "chunk:A3", "A3 通用词证据")],
                2: [("resource:B", "chunk:B2", "B2 通用词证据")],
                3: [("resource:B", "chunk:B3", "")],
                4: [("resource:C", "chunk:C1", "C1 语言版本证据")],
                5: [("resource:C", "chunk:C2", "C2 语言版本证据")],
                6: [("resource:D", "chunk:D1", "D1 语言版本证据")],
                7: [("resource:C", "chunk:C3", "C3 错误码证据")],
                8: [("resource:D", "chunk:D2", "D2 错误码证据")],
                9: [("resource:D", "chunk:D3", "长" * 650)],
                10: [("resource:D", "chunk:D4", "同名干扰证据")],
                11: [],
            }
            resources = ("A", "B", "C", "D")
        else:
            occurrence_map = {
                index: [(
                    f"resource:{index % 120}",
                    f"chunk:{index}",
                    f"规模证据 {index}",
                )]
                for index in range(total)
            }
            resources = tuple(str(index) for index in range(120))
        for resource in resources:
            resource_id = f"resource:{resource}"
            documents.append({
                "resourceId": resource_id,
                "title": f"文档 {resource}",
                "sourcePath": f"docs/{resource}.md",
            })
        for index in range(total):
            occurrences = [
                {
                    "resourceId": resource_id,
                    "chunkId": chunk_id,
                    "evidenceText": evidence,
                    "sourceLocations": [{"line": index + 1}],
                    "documentOffsets": {"start": index * 10, "end": index * 10 + len(evidence)},
                }
                for resource_id, chunk_id, evidence in occurrence_map[index]
            ]
            name = "同名关键词" if index in {0, 10} else f"关键词 {index}"
            if stale_name and index == 0:
                name = "新图谱同名干扰"
                occurrences = [{
                    "resourceId": "resource:D",
                    "chunkId": "chunk:D4",
                    "evidenceText": "新图谱不应关联的证据",
                }]
            nodes.append({
                "id": f"keyword:{index}",
                "keywordId": f"keyword:{index}",
                "type": "Keyword",
                "canonicalName": name,
                "name": f"raw keyword {index}",
                "aliases": [f"Alias-{index}"],
                "chunkIds": sorted({item["chunkId"] for item in occurrences if item.get("chunkId")}),
                "occurrences": occurrences,
                "admissionStatus": "admitted",
            })
            for occurrence in occurrences:
                chunk_id = occurrence.get("chunkId")
                resource_id = occurrence.get("resourceId")
                if chunk_id and not any(item["id"] == chunk_id for item in chunks):
                    chunks.append({
                        "id": chunk_id,
                        "chunkId": chunk_id,
                        "resourceId": resource_id,
                        "sourcePath": f"docs/{str(resource_id).split(':')[-1]}.md",
                        "headingPath": ["章节", chunk_id],
                        "sourceLocations": occurrence.get("sourceLocations", []),
                    })
        graph_root = self.root / "training-runs" / self.dataset.training_task_id / "graph"
        dataset_graph = self.root / "datasets" / self.DATASET_ID / "graph"
        for root in (graph_root, dataset_graph):
            root.mkdir(parents=True, exist_ok=True)
            (root / "nodes.json").write_text(json.dumps(nodes, ensure_ascii=False), encoding="utf-8")
            (root / "edges.json").write_text("[]", encoding="utf-8")
        dataset_root = self.root / "datasets" / self.DATASET_ID
        (dataset_root / "documents.jsonl").write_text(
            "\n".join(json.dumps(item, ensure_ascii=False) for item in documents), encoding="utf-8"
        )
        (dataset_root / "processing-units.jsonl").write_text(
            "\n".join(json.dumps(item, ensure_ascii=False) for item in chunks), encoding="utf-8"
        )

    def _url(self, run_id, suffix):
        return f"/api/datasets/{self.DATASET_ID}/keyword-filter-runs/{run_id}/{suffix}"

    def _create_run(self):
        created = self.client.post(f"/api/datasets/{self.DATASET_ID}/keyword-filter-runs")
        self.assertEqual(created.status_code, 201, created.text)
        run_id = created.json()["filterRunId"]
        streamed = self.client.get(self._url(run_id, "stream"))
        self.assertEqual(streamed.status_code, 200, streamed.text)
        detail = self.client.get(self._url(run_id, "").rstrip("/"))
        self.assertEqual(detail.status_code, 200, detail.text)
        return run_id, detail.json()

    def test_overview_resource_and_occurrence_dedup_with_missing_visible(self):
        run_id, _ = self._create_run()
        response = self.client.get(self._url(run_id, "issue-overview"))
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        categories = {item["id"]: item for item in payload["categories"]}
        self.assertGreaterEqual(len(categories), 3)
        self.assertEqual(sum(item["keywordCount"] for item in categories.values()), 11)
        self.assertEqual(payload["excludedTotal"], 11)
        self.assertEqual(categories["generic_term"]["keywordCount"], 4)
        self.assertEqual(categories["generic_term"]["documentCount"], 2)
        self.assertEqual(categories["generic_term"]["evidenceCount"], 6)
        self.assertEqual(categories["generic_term"]["missingEvidenceCount"], 1)
        self.assertEqual(categories["insufficient_evidence"]["missingEvidenceCount"], 1)

        missing = self.client.get(
            self._url(run_id, "issue-evidence"), params={"missingEvidence": "true"}
        ).json()
        self.assertEqual({item["keywordId"] for item in missing["items"]}, {"keyword:3", "keyword:11"})
        self.assertTrue(all(item["evidenceAvailability"] == "missing" for item in missing["items"]))

    def test_exact_evidence_strict_keyword_id_and_500_character_limit(self):
        run_id, _ = self._create_run()
        evidence = self.client.get(
            self._url(run_id, "issue-evidence"), params={"pageSize": 100}
        )
        self.assertEqual(evidence.status_code, 200, evidence.text)
        items = {item["keywordId"]: item for item in evidence.json()["items"]}
        tuples = {
            (item["keywordId"], document.get("resourceId"), occurrence.get("chunkId"), occurrence.get("evidenceText"))
            for item in items.values()
            for document in item["documents"]
            for occurrence in document["occurrences"]
            if occurrence.get("evidenceText")
        }
        expected = {
            ("keyword:0", "resource:A", "chunk:A1", "A1 对象证据"),
            ("keyword:0", "resource:A", "chunk:A2", "A2 对象证据"),
            ("keyword:0", "resource:B", "chunk:B1", "B1 对象证据"),
            ("keyword:1", "resource:A", "chunk:A3", "A3 通用词证据"),
            ("keyword:2", "resource:B", "chunk:B2", "B2 通用词证据"),
            ("keyword:4", "resource:C", "chunk:C1", "C1 语言版本证据"),
            ("keyword:5", "resource:C", "chunk:C2", "C2 语言版本证据"),
            ("keyword:6", "resource:D", "chunk:D1", "D1 语言版本证据"),
            ("keyword:7", "resource:C", "chunk:C3", "C3 错误码证据"),
            ("keyword:8", "resource:D", "chunk:D2", "D2 错误码证据"),
        }
        self.assertTrue(expected.issubset(tuples))
        keyword_zero_evidence = {item[3] for item in tuples if item[0] == "keyword:0"}
        self.assertNotIn("同名干扰证据", keyword_zero_evidence)
        long_text = items["keyword:9"]["documents"][0]["occurrences"][0]["evidenceText"]
        self.assertEqual(len(long_text), 500)

    def test_review_basis_then_final_basis_use_effective_decisions(self):
        run_id, detail = self._create_run()
        saved = self.client.patch(self._url(run_id, "review-decisions"), json={
            "expectedRevision": detail["revision"],
            "changes": [{
                "keywordId": "keyword:4",
                "action": "exclude",
                "issueCategory": "generic_term",
                "note": "人工改类",
            }],
        })
        self.assertEqual(saved.status_code, 200, saved.text)
        overview = self.client.get(self._url(run_id, "issue-overview")).json()
        categories = {item["id"]: item for item in overview["categories"]}
        self.assertEqual(overview["decisionBasis"], "review")
        self.assertEqual(categories["generic_term"]["keywordCount"], 5)
        self.assertEqual(categories["language_variant"]["keywordCount"], 2)

        applied = self.client.post(
            self._url(run_id, "apply"), json={"revision": saved.json()["revision"]}
        )
        self.assertEqual(applied.status_code, 200, applied.text)
        final_overview = self.client.get(self._url(run_id, "issue-overview")).json()
        self.assertEqual(final_overview["decisionBasis"], "final")
        self.assertEqual(final_overview["categories"], overview["categories"])

    def test_server_filters_before_pagination_and_enforces_page_size(self):
        run_id, _ = self._create_run()
        page = self.client.get(self._url(run_id, "issue-evidence"), params={
            "category": "generic_term", "page": 2, "pageSize": 2,
        })
        self.assertEqual(page.status_code, 200, page.text)
        self.assertEqual(page.json()["total"], 4)
        self.assertEqual(len(page.json()["items"]), 2)
        query = self.client.get(self._url(run_id, "issue-evidence"), params={
            "query": "Alias-9", "page": 1, "pageSize": 1,
        })
        self.assertEqual(query.status_code, 200, query.text)
        self.assertEqual(query.json()["total"], 1)
        self.assertEqual(query.json()["items"][0]["keywordId"], "keyword:9")
        resource = self.client.get(self._url(run_id, "issue-evidence"), params={
            "category": "generic_term", "resourceId": "resource:B", "pageSize": 1,
        })
        self.assertEqual(resource.status_code, 200, resource.text)
        self.assertEqual(resource.json()["total"], 3)
        self.assertTrue(all(
            document["resourceId"] == "resource:B"
            for item in resource.json()["items"] for document in item["documents"]
        ))
        too_large = self.client.get(
            self._url(run_id, "issue-evidence"), params={"pageSize": 101}
        )
        self.assertEqual(too_large.status_code, 422, too_large.text)

    def test_stale_reuses_frozen_cache_and_without_cache_never_joins_new_graph(self):
        cached_run, _ = self._create_run()
        original = self.client.get(
            self._url(cached_run, "issue-evidence"), params={"keywordId": "keyword:0"}
        ).json()["items"][0]
        self._write_fixture(12, stale_name=True)
        cached_stale = self.client.get(
            self._url(cached_run, "issue-evidence"), params={"keywordId": "keyword:0"}
        )
        self.assertEqual(cached_stale.status_code, 200, cached_stale.text)
        self.assertEqual(cached_stale.json()["evidenceAvailability"], "stale")
        self.assertEqual(cached_stale.json()["items"][0]["documents"], original["documents"])

        self._write_fixture(12)
        uncached_run, _ = self._create_run()
        self._write_fixture(12, stale_name=True)
        uncached = self.client.get(
            self._url(uncached_run, "issue-evidence"), params={"keywordId": "keyword:0"}
        )
        self.assertEqual(uncached.status_code, 200, uncached.text)
        self.assertEqual(uncached.json()["evidenceAvailability"], "stale")
        self.assertEqual(uncached.json()["items"][0]["documents"], [])
        self.assertNotIn("新图谱不应关联的证据", uncached.text)

    def test_643_overview_and_evidence_p95_under_500ms(self):
        self.total = 643
        self._write_fixture(self.total)
        self._install_service(self.total)
        run_id, _ = self._create_run()
        overview_url = self._url(run_id, "issue-overview")
        evidence_url = self._url(run_id, "issue-evidence")
        self.client.get(overview_url)
        self.client.get(evidence_url, params={"category": "generic_term", "pageSize": 100})
        overview_samples = []
        evidence_samples = []
        for _ in range(20):
            started = time.perf_counter()
            response = self.client.get(overview_url)
            overview_samples.append((time.perf_counter() - started) * 1000)
            self.assertEqual(response.status_code, 200)
            started = time.perf_counter()
            response = self.client.get(evidence_url, params={
                "category": "generic_term", "query": "keyword", "pageSize": 100,
            })
            evidence_samples.append((time.perf_counter() - started) * 1000)
            self.assertEqual(response.status_code, 200)
        overview_p95 = statistics.quantiles(overview_samples, n=100, method="inclusive")[94]
        evidence_p95 = statistics.quantiles(evidence_samples, n=100, method="inclusive")[94]
        print(
            f"INS performance: overview_643_p95={overview_p95:.2f}ms, "
            f"evidence_643_p95={evidence_p95:.2f}ms"
        )
        self.assertLess(overview_p95, 500)
        self.assertLess(evidence_p95, 500)


if __name__ == "__main__":
    unittest.main()
