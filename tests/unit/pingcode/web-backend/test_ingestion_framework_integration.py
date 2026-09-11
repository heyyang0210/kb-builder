import json
import os
import unittest
from urllib.request import urlopen


API_BASE = os.getenv("PINGCODE_TEST_API_BASE", "").rstrip("/")


@unittest.skipUnless(API_BASE, "设置 PINGCODE_TEST_API_BASE 后执行真实后端 API 测试")
class IngestionFrameworkApiTests(unittest.TestCase):
    def test_capabilities_endpoint_exposes_framework_contract(self):
        with urlopen(f"{API_BASE}/api/ingestion/capabilities", timeout=15) as response:
            self.assertEqual(response.status, 200)
            payload = json.loads(response.read().decode("utf-8"))
        self.assertEqual(payload["pipeline"]["key"], "material_ingestion")
        self.assertEqual(
            [item["key"] for item in payload["sourceTypes"]],
            ["upload", "pingcode"],
        )
        self.assertIn("archive_extract", payload["pipeline"]["stageKeys"])
        self.assertTrue(all(item["status"] == "declared" for item in payload["stages"]))


if __name__ == "__main__":
    unittest.main()
