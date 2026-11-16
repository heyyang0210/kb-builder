import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

import app.main as main_module
from app.main import app


class DatasetPaginationTests(unittest.TestCase):
    def setUp(self):
        self.items = [{"id": f"dataset-{index}", "name": f"版本 {index}"} for index in range(1, 46)]
        self.patch = patch.object(main_module.preprocess, "list_datasets", return_value=self.items)
        self.patch.start()
        self.addCleanup(self.patch.stop)
        self.client = TestClient(app)

    def test_legacy_request_keeps_full_list(self):
        response = self.client.get("/api/datasets")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["total"], 45)
        self.assertEqual(len(response.json()["items"]), 45)
        self.assertNotIn("page", response.json())

    def test_paged_request_returns_requested_slice_and_total(self):
        response = self.client.get("/api/datasets?page=2&pageSize=20")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            "items": self.items[20:40], "page": 2, "pageSize": 20, "total": 45,
        })

    def test_page_size_is_bounded(self):
        response = self.client.get("/api/datasets?page=1&pageSize=101")

        self.assertEqual(response.status_code, 422)


if __name__ == "__main__":
    unittest.main()
