import unittest

from fastapi.testclient import TestClient

from app.main import app


class KeywordFilterRouteContractTests(unittest.TestCase):
    def test_business_l2_and_quality_report_routes_are_removed(self):
        deleted_paths = {
            "/api/datasets/{dataset_id}/keywords/business-review",
            "/api/datasets/{dataset_id}/keywords/{keyword_id}/business-status",
            "/api/datasets/{dataset_id}/keywords/{keyword_id}/admission",
            "/api/datasets/{dataset_id}/keywords/l2-terms",
            "/api/datasets/{dataset_id}/keywords/{keyword_id}/links",
            "/api/datasets/{dataset_id}/graph/term-expansion",
            "/api/quality/reports/{dataset_id}",
            "/api/training/tasks/{task_id}/quality-issues",
        }
        registered_paths = {route.path for route in app.routes}
        self.assertTrue(deleted_paths.isdisjoint(registered_paths))

    def test_deleted_api_urls_return_404(self):
        client = TestClient(app)
        deleted_requests = [
            ("post", "/api/datasets/dataset-fixture/keywords/business-review", {}),
            ("post", "/api/datasets/dataset-fixture/keywords/keyword-1/business-status", {}),
            ("post", "/api/datasets/dataset-fixture/keywords/l2-terms", {"name": "L2"}),
            ("post", "/api/datasets/dataset-fixture/keywords/keyword-1/links", {"targetId": "keyword-2"}),
            ("get", "/api/datasets/dataset-fixture/graph/term-expansion?termId=l2-1", None),
            ("get", "/api/quality/reports/dataset-fixture", None),
            ("get", "/api/training/tasks/task-fixture/quality-issues", None),
        ]

        for method, url, payload in deleted_requests:
            with self.subTest(method=method, url=url):
                request = getattr(client, method)
                response = request(url, json=payload) if payload is not None else request(url)
                self.assertEqual(response.status_code, 404)

    def test_keyword_filter_and_formal_knowledge_routes_remain_available(self):
        registered_paths = {route.path for route in app.routes}
        self.assertIn("/api/datasets/{dataset_id}/keywords/filter-by-skill", registered_paths)
        self.assertIn("/api/datasets/{dataset_id}/keywords/filter-by-skill/stream", registered_paths)
        self.assertIn("/api/datasets/{dataset_id}/keywords/filter-apply", registered_paths)
        self.assertIn("/api/datasets/{dataset_id}/graph/summary", registered_paths)
        self.assertIn("/api/datasets/{dataset_id}/graph/nodes", registered_paths)
        self.assertIn("/api/datasets/{dataset_id}/graph/edges", registered_paths)
        self.assertIn("/api/datasets/{dataset_id}/formal-knowledge/tasks", registered_paths)


if __name__ == "__main__":
    unittest.main()
