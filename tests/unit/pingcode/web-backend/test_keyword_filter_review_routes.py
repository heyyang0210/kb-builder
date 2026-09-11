import json
import statistics
import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import patch

from fastapi.testclient import TestClient

import app.main as main_module
from app.main import app
from app.repositories import LocalKeywordFilterRunRepository
from app.training_service import TrainingService


class DeterministicReviewGateway:
    """为公共 API 验收生成完整、可重复的模型决策。"""

    def status(self):
        return {
            "configured": True,
            "provider": "test-gateway",
            "model": "deterministic-review-v1",
        }

    def chat_json(self, messages, options):
        marker = "关键词列表：\n"
        candidates = json.loads(messages[-1]["content"].split(marker, 1)[1])
        decisions = []
        for item in candidates:
            index = int(str(item["id"]).rsplit(":", 1)[-1])
            excluded = index % 4 != 0
            decision = {
                "keywordId": item["id"],
                "keywordName": item.get("name"),
                "shouldExclude": excluded,
                "reason": f"模型理由 {index}",
            }
            if excluded:
                decision["issueCategory"] = (
                    "generic_term" if index % 2 else "language_variant"
                )
            decisions.append(decision)
        return {"data": {"decisions": decisions}}


class RecordingStore:
    def __init__(self):
        self.updates = []

    def update_record(self, collection, record_id, changes):
        self.updates.append((collection, record_id, changes))
        return changes


class KeywordFilterReviewRouteAcceptanceTests(unittest.TestCase):
    DATASET_ID = "dataset-review-isolated"
    KEYWORD_TOTAL = 643

    def setUp(self):
        self.temporary = TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.store = RecordingStore()
        self.dataset = SimpleNamespace(
            id=self.DATASET_ID,
            state="candidate",
            graph_available=True,
            training_task_id="training-review-isolated",
            graph_summary={"graphSource": "metadata_keyword"},
        )
        self._write_graph()
        self.service = TrainingService(
            self.store,
            None,
            None,
            None,
            None,
            gateway=DeterministicReviewGateway(),
            keyword_filter_run_repository=LocalKeywordFilterRunRepository(self.root),
        )
        self.service.ensure_dataset_graph = lambda dataset_id: self.dataset
        self.settings_patch = patch(
            "app.training_service.settings",
            SimpleNamespace(
                data_root=self.root,
                keyword_filter_batch_size=50,
                keyword_filter_max_retries=0,
            ),
        )
        self.settings_patch.start()
        self.original_training = main_module.training
        main_module.training = self.service
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        main_module.training = self.original_training
        self.settings_patch.stop()
        self.temporary.cleanup()

    def _write_graph(self):
        nodes = []
        edges = []
        for index in range(self.KEYWORD_TOTAL):
            nodes.extend([
                {
                    "id": f"keyword:{index}",
                    "keywordId": f"keyword:{index}",
                    "type": "Keyword",
                    "canonicalName": f"关键词 {index}",
                    "name": f"keyword {index}",
                    "aliases": [f"K{index}"],
                    "chunkIds": [f"chunk:{index}"],
                    "admissionStatus": "admitted",
                },
                {"id": f"chunk:{index}", "type": "ProcessingUnit"},
            ])
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

    def _run_url(self, run_id, suffix=""):
        return (
            f"/api/datasets/{self.DATASET_ID}/keyword-filter-runs/{run_id}{suffix}"
        )

    def _create_reviewable_run(self):
        created = self.client.post(
            f"/api/datasets/{self.DATASET_ID}/keyword-filter-runs"
        )
        self.assertEqual(created.status_code, 201, created.text)
        run_id = created.json()["filterRunId"]
        streamed = self.client.get(self._run_url(run_id, "/stream"))
        self.assertEqual(streamed.status_code, 200, streamed.text)
        detail = self.client.get(self._run_url(run_id))
        self.assertEqual(detail.status_code, 200, detail.text)
        self.assertEqual(detail.json()["status"], "reviewable")
        self.assertEqual(len(detail.json()["modelDecisions"]), self.KEYWORD_TOTAL)
        return run_id, detail.json()

    def _patch(self, run_id, revision, changes, client=None):
        return (client or self.client).patch(
            self._run_url(run_id, "/review-decisions"),
            json={"expectedRevision": revision, "changes": changes},
        )

    def test_keep_clears_category_and_model_fields_remain_isolated_after_refresh(self):
        run_id, before = self._create_reviewable_run()
        model_before = {
            item["keywordId"]: item for item in before["modelDecisions"]
        }
        response = self._patch(run_id, before["revision"], [
            {
                "keywordId": "keyword:1",
                "action": "keep",
                "issueCategory": "generic_term",
                "note": "  人工保留  ",
                "modelAction": "keep",
                "modelIssueCategory": None,
                "modelReason": "伪造理由",
                "userOverride": False,
                "reviewedBy": "forged-user",
            },
            {
                "keywordId": "keyword:0",
                "action": "exclude",
                "issueCategory": "generic_term",
                "note": "人工排除",
            },
        ])
        self.assertEqual(response.status_code, 200, response.text)
        changes = {item["keywordId"]: item for item in response.json()["changes"]}
        self.assertIsNone(changes["keyword:1"]["reviewIssueCategory"])
        self.assertEqual(changes["keyword:1"]["reviewNote"], "人工保留")
        self.assertTrue(changes["keyword:1"]["userOverride"])
        self.assertEqual(changes["keyword:1"]["reviewedBy"], "anonymous")
        self.assertEqual(changes["keyword:0"]["reviewIssueCategory"], "generic_term")

        refreshed = self.client.get(self._run_url(run_id)).json()
        reviews = {item["keywordId"]: item for item in refreshed["reviewDecisions"]}
        self.assertEqual(reviews["keyword:1"], changes["keyword:1"])
        self.assertEqual(reviews["keyword:0"], changes["keyword:0"])
        model_after = {
            item["keywordId"]: item for item in refreshed["modelDecisions"]
        }
        self.assertEqual(model_after, model_before)
        self.assertEqual(model_after["keyword:1"]["modelAction"], "exclude")
        self.assertEqual(model_after["keyword:1"]["modelReason"], "模型理由 1")

    def test_invalid_category_other_note_length_and_duplicate_batch_are_atomic(self):
        run_id, detail = self._create_reviewable_run()
        revision = detail["revision"]
        invalid_cases = [
            [{"keywordId": "keyword:0", "action": "exclude", "note": "无类别"}],
            [{"keywordId": "keyword:0", "action": "exclude", "issueCategory": "invalid", "note": "非法"}],
            [{"keywordId": "keyword:0", "action": "exclude", "issueCategory": "other", "note": "   "}],
            [{"keywordId": "keyword:0", "action": "exclude", "issueCategory": "other", "note": "备" * 501}],
            [
                {"keywordId": "keyword:0", "action": "keep", "note": "第一条"},
                {"keywordId": "keyword:0", "action": "exclude", "issueCategory": "generic_term", "note": "重复"},
            ],
        ]
        for changes in invalid_cases:
            with self.subTest(changes=changes):
                response = self._patch(run_id, revision, changes)
                self.assertEqual(response.status_code, 422, response.text)
                self.assertEqual(
                    response.json()["error"]["code"], "KEYWORD_FILTER_REVIEW_INVALID"
                )
                refreshed = self.client.get(self._run_url(run_id)).json()
                self.assertEqual(refreshed["revision"], revision)
                self.assertEqual(refreshed["reviewDecisions"], [])

        accepted = self._patch(run_id, revision, [{
            "keywordId": "keyword:0",
            "action": "exclude",
            "issueCategory": "other",
            "note": "备" * 500,
        }])
        self.assertEqual(accepted.status_code, 200, accepted.text)
        self.assertEqual(len(accepted.json()["changes"][0]["reviewNote"]), 500)

    def test_same_revision_concurrent_patch_allows_exactly_one_writer(self):
        run_id, detail = self._create_reviewable_run()
        revision = detail["revision"]

        def update(keyword_id):
            with TestClient(app) as client:
                response = self._patch(run_id, revision, [{
                    "keywordId": keyword_id,
                    "action": "keep",
                    "note": f"并发 {keyword_id}",
                }], client=client)
                return response.status_code, response.json()

        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(update, ["keyword:1", "keyword:2"]))

        self.assertEqual(sorted(status for status, _ in results), [200, 409])
        conflict = next(payload for status, payload in results if status == 409)
        self.assertEqual(
            conflict["error"]["code"], "KEYWORD_FILTER_RUN_REVISION_CONFLICT"
        )
        refreshed = self.client.get(self._run_url(run_id)).json()
        self.assertEqual(refreshed["revision"], revision + 1)
        self.assertEqual(len(refreshed["reviewDecisions"]), 1)

    def test_review_summary_invariants_and_sparse_patch_apply_full_643_transaction(self):
        run_id, detail = self._create_reviewable_run()
        saved = self._patch(run_id, detail["revision"], [
            {
                "keywordId": "keyword:0",
                "action": "exclude",
                "issueCategory": "other",
                "note": "少量复核仍应合并完整集合",
            },
            {"keywordId": "keyword:1", "action": "keep", "note": "人工保留"},
        ])
        self.assertEqual(saved.status_code, 200, saved.text)
        revision = saved.json()["revision"]

        summary_response = self.client.get(self._run_url(run_id, "/review-summary"))
        self.assertEqual(summary_response.status_code, 200, summary_response.text)
        summary = summary_response.json()["summary"]
        self.assertEqual(summary["candidateTotal"], self.KEYWORD_TOTAL)
        self.assertEqual(summary["modelKeep"] + summary["modelExclude"], self.KEYWORD_TOTAL)
        self.assertEqual(summary["finalKeep"] + summary["finalExclude"], self.KEYWORD_TOTAL)
        self.assertEqual(sum(summary["excludedByCategory"].values()), summary["finalExclude"])
        self.assertEqual(summary["invalidDecisionCount"], 0)
        self.assertEqual(summary["unreviewedOtherCount"], 0)
        self.assertEqual(summary["changedToExclude"], 1)
        self.assertEqual(summary["changedToKeep"], 1)

        applied = self.client.post(
            self._run_url(run_id, "/apply"), json={"revision": revision}
        )
        self.assertEqual(applied.status_code, 200, applied.text)
        self.assertEqual(applied.json()["applied"]["total"], self.KEYWORD_TOTAL)
        self.assertEqual(applied.json()["run"]["status"], "applied")

        refreshed = self.client.get(self._run_url(run_id)).json()
        self.assertEqual(len(refreshed["finalDecisions"]), self.KEYWORD_TOTAL)
        transaction_path = (
            self.root / "datasets" / self.DATASET_ID / "keyword-filter-runs"
            / run_id / "apply-transaction.json"
        )
        transaction = json.loads(transaction_path.read_text(encoding="utf-8"))
        self.assertEqual(transaction["status"], "committed")
        self.assertEqual(transaction["filterRunId"], run_id)
        self.assertEqual(transaction["revision"], refreshed["revision"])
        self.assertEqual(transaction["transactionId"], refreshed["applyTransactionId"])

        immutable = self._patch(run_id, refreshed["revision"], [{
            "keywordId": "keyword:2", "action": "keep", "note": "已应用后不可修改",
        }])
        self.assertEqual(immutable.status_code, 409, immutable.text)
        self.assertEqual(
            immutable.json()["error"]["code"], "KEYWORD_FILTER_RUN_IMMUTABLE"
        )

        next_run = self.client.post(
            f"/api/datasets/{self.DATASET_ID}/keyword-filter-runs"
        )
        self.assertEqual(next_run.status_code, 201, next_run.text)
        self.assertEqual(next_run.json()["run"]["candidateTotal"], self.KEYWORD_TOTAL)

    def test_review_summary_and_batch_patch_performance(self):
        run_id, detail = self._create_reviewable_run()
        summary_path = self._run_url(run_id, "/review-summary")
        self.client.get(summary_path)
        samples = []
        for _ in range(20):
            started = time.perf_counter()
            response = self.client.get(summary_path)
            samples.append((time.perf_counter() - started) * 1000)
            self.assertEqual(response.status_code, 200)
        summary_p95 = statistics.quantiles(
            samples, n=100, method="inclusive"
        )[94]

        changes = [
            {
                "keywordId": f"keyword:{index}",
                "action": "keep",
                "note": f"批量复核 {index}",
            }
            for index in range(1, 101)
        ]
        started = time.perf_counter()
        patched = self._patch(run_id, detail["revision"], changes)
        patch_elapsed = (time.perf_counter() - started) * 1000
        self.assertEqual(patched.status_code, 200, patched.text)
        self.assertEqual(len(patched.json()["changes"]), 100)
        print(
            f"REV performance: review_summary_643_p95={summary_p95:.2f}ms, "
            f"review_patch_100={patch_elapsed:.2f}ms"
        )
        self.assertLess(summary_p95, 300)
        self.assertLess(patch_elapsed, 300)


if __name__ == "__main__":
    unittest.main()
