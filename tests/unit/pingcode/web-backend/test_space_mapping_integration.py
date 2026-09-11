import json
import os
import unittest
from urllib.request import Request, urlopen


API_BASE = os.getenv("PINGCODE_TEST_API_BASE", "").rstrip("/")
FRONTEND_ORIGIN = os.getenv("PINGCODE_TEST_FRONTEND_ORIGIN", "http://127.0.0.1:5174")


def request_json(path: str, *, method: str = "GET", body: dict | None = None) -> tuple[dict, object]:
    data = json.dumps(body).encode("utf-8") if body is not None else None
    request = Request(
        f"{API_BASE}{path}",
        data=data,
        method=method,
        headers={"Content-Type": "application/json"},
    )
    with urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8")), response.headers


@unittest.skipUnless(API_BASE, "设置 PINGCODE_TEST_API_BASE 后执行真实后端 API 测试")
class SpaceMappingIntegrationTests(unittest.TestCase):
    def test_local_vite_port_cors_preflight(self):
        request = Request(
            f"{API_BASE}/api/pingcode/spaces/YASDOC/mapping",
            method="OPTIONS",
            headers={
                "Origin": FRONTEND_ORIGIN,
                "Access-Control-Request-Method": "PUT",
                "Access-Control-Request-Headers": "content-type",
            },
        )
        with urlopen(request, timeout=30) as response:
            self.assertEqual(response.status, 200)
            self.assertEqual(response.headers["Access-Control-Allow-Origin"], FRONTEND_ORIGIN)

    def test_yasdoc_mapping_can_be_created_or_updated(self):
        mapping, _ = request_json(
            "/api/pingcode/spaces/YASDOC/mapping",
            method="PUT",
            body={"localName": "YashanDB 文档", "localSlug": "yasdoc", "enabled": True},
        )
        self.assertEqual(mapping["spaceKey"], "YASDOC")
        self.assertEqual(mapping["localLogicalPath"], "spaces/yasdoc")
        self.assertTrue(mapping["enabled"])


if __name__ == "__main__":
    unittest.main()
