import threading
import base64
import time
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from fastapi.testclient import TestClient
from app.main import app, pingcode
from app.pingcode_service import PingCodeService


class PingCodeReferenceTest(unittest.TestCase):
    def test_prewarm_initializes_browser_in_background_and_keeps_requests_available(self):
        service = PingCodeService()
        service._isolate_asyncio = lambda callback, *args: callback(*args)
        entered = threading.Event()
        release = threading.Event()

        def initialize():
            entered.set()
            release.wait(1)

        service._ensure_api = Mock(side_effect=initialize)
        try:
            started = time.monotonic()
            service.prewarm()
            self.assertLess(time.monotonic() - started, 0.2)
            self.assertTrue(entered.wait(1))
            release.set()
            self.assertEqual("ready", service._submit(lambda: "ready"))
            service._ensure_api.assert_called_once_with()
        finally:
            release.set()
            service.close()

    def test_prewarm_failure_does_not_block_later_requests(self):
        service = PingCodeService()
        service._isolate_asyncio = lambda callback, *args: callback(*args)
        service._ensure_api = Mock(side_effect=RuntimeError("temporary failure"))
        try:
            service.prewarm()
            self.assertEqual("ready", service._submit(lambda: "ready"))
            service._ensure_api.assert_called_once_with()
        finally:
            service.close()

    def service(self):
        service = PingCodeService.__new__(PingCodeService)
        service._lock = threading.RLock()
        service._space_cache = {"space1": (None, [], {})}
        service.config = SimpleNamespace(base_url="https://pingcode.example")
        service._submit = lambda callback, *args: callback(*args)
        service._pages_for_batch_sync = Mock(return_value=[{"_id": "page1", "name": "设计文档"}])
        service.api = Mock()
        service._ensure_api = Mock(return_value=service.api)
        service.api.get_page.return_value = {"data": {"value": {
            "_id": "page1", "name": "设计说明", "version": 7,
            "updated_at": "2026-10-22T10:00:00Z",
            "document": [{"type": "paragraph", "children": [{"text": "真实解析正文"}]}],
        }}}
        return service

    def test_shared_parser_and_exact_page_metadata(self):
        service = self.service()
        result = service.read_reference("space1", "page1")
        self.assertEqual("真实解析正文", result["content"])
        self.assertEqual("设计说明", result["title"])
        self.assertEqual(7, result["sourceVersion"])
        self.assertEqual("https://pingcode.example/wiki/spaces/space1/pages/page1", result["originalUrl"])
        service._pages_for_batch_sync.assert_called_once_with("space1", ["page1"])
        service.api.get_page.assert_called_once_with("page1")

    def test_nonmember_page_never_calls_remote_detail(self):
        service = self.service()
        service._pages_for_batch_sync.return_value = []
        with self.assertRaises(KeyError): service.read_reference("space1", "page1")
        service.api.get_page.assert_not_called()

    def test_short_identifier_is_resolved_within_space(self):
        service = self.service()
        service._pages_for_batch_sync.return_value = []
        service._space_cache["space1"] = (None, [{"_id": "page1", "short_id": "short1"}], {})
        result = service.read_reference("space1", "short1")
        self.assertEqual("short1", result["pageId"])
        self.assertEqual("page1", result["canonicalPageId"])
        service.api.get_page.assert_called_once_with("page1")
        service._space_cache["space1"][1].append({"_id": "other", "short_id": "short1"})
        with self.assertRaises(KeyError): service.read_reference("space1", "short1")

    def test_invalid_locator_does_not_enter_browser(self):
        service = self.service()
        for space, page in [("../other", "page1"), ("space1", "page1?token=x"), ("space1", "")]:
            with self.subTest(space=space, page=page), self.assertRaises(ValueError):
                service.read_reference(space, page)
        service._pages_for_batch_sync.assert_not_called()

    def test_wrong_page_and_empty_document_are_rejected(self):
        service = self.service()
        for value in [{"_id": "other", "document": [{"children": [{"text": "wrong"}]}]}, {"_id": "page1", "document": []}]:
            service.api.get_page.return_value = {"data": {"value": value}}
            with self.assertRaises(ValueError): service.read_reference("space1", "page1")

    def test_optional_metadata_is_not_invented(self):
        service = self.service()
        value = service.api.get_page.return_value["data"]["value"]
        del value["version"]; del value["updated_at"]
        result = service.read_reference("space1", "page1")
        self.assertNotIn("sourceVersion", result)
        self.assertNotIn("sourceUpdatedAt", result)

    def test_images_are_returned_as_internal_references_without_signed_urls(self):
        service = self.service()
        image = {"type": "image", "name": "架构图", "originUrl": "https://pingcode.example/atlas/files/public/asset?token=secret"}
        service.api.get_page.return_value["data"]["value"]["document"].append(image)
        service.api.download_public_image.return_value = (bytes([137, 80, 78, 71, 13, 10, 26, 10]), "image/png")
        result = service.read_reference("space1", "page1", True)
        self.assertIn("![架构图](source-image:", result["content"])
        self.assertNotIn("secret", str(result))
        self.assertEqual(base64.b64encode(bytes([137, 80, 78, 71, 13, 10, 26, 10])).decode(), result["imageResources"][0]["dataBase64"])
        service.api.download_public_image.assert_called_once()

    def test_image_failure_keeps_reference_and_body(self):
        service = self.service()
        service.api.get_page.return_value["data"]["value"]["document"].append({"type": "image", "name": "缺失图", "originUrl": "https://pingcode.example/atlas/files/public/missing"})
        service.api.download_public_image.side_effect = RuntimeError("upstream-secret")
        result = service.read_reference("space1", "page1", True)
        self.assertIn("真实解析正文", result["content"])
        self.assertIn("![缺失图](source-image:", result["content"])
        self.assertEqual("failed", result["imageResources"][0]["status"])
        self.assertNotIn("upstream-secret", str(result))

    def test_api_contract_and_redacted_errors(self):
        client = TestClient(app)
        with patch.object(pingcode, "read_reference", return_value={"content": "正文", "spaceKey": "space1", "pageId": "page1"}):
            response = client.get("/api/pingcode/spaces/space1/pages/page1/reference")
        self.assertEqual(200, response.status_code)
        self.assertEqual("正文", response.json()["content"])
        with patch.object(pingcode, "read_reference", return_value={"content": "正文"}) as reader:
            self.assertEqual(200, client.get("/api/pingcode/spaces/space1/pages/page1/reference?include_images=true").status_code)
            reader.assert_called_once_with("space1", "page1", True)
        for exception, status in [(KeyError("secret-detail"), 404), (ValueError("secret-detail"), 422), (RuntimeError("secret-detail"), 502)]:
            with patch.object(pingcode, "read_reference", side_effect=exception):
                response = client.get("/api/pingcode/spaces/space1/pages/page1/reference")
            self.assertEqual(status, response.status_code)
            self.assertNotIn("secret-detail", response.text)

    def test_baseline_ideas_reference_requires_complete_authenticated_result(self):
        service = self.service()
        service.api.get_product.return_value = {"data": {"value": {"_id": "product1", "identifier": "YASHAN"}}}
        service.api.get_baseline.return_value = {"data": {"value": {"short_id": "y28FbpmM", "scope": "product1", "name": "版本基线"}}}
        service.api.get_baseline_suites.return_value = {"data": {"value": []}}
        service.api.get_baseline_ideas.return_value = {"data": {"count": 1, "value": [{"whole_identifier": "YASHAN-1", "title": "完善数据库文档", "description": "<p>说明</p>"}]}}
        result = service.read_baseline_ideas_reference("YASHAN", "y28FbpmM", "all")
        self.assertIn("YASHAN-1", result["content"])
        service.api.get_baseline_ideas.return_value = {"data": {"count": 1, "value": []}}
        with self.assertRaises(ValueError):
            service.read_baseline_ideas_reference("YASHAN", "y28FbpmM", "all")
        service.api.get_baseline_ideas.return_value = {"data": {"count": 0, "value": []}}
        self.assertIn("共 0 条需求", service.read_baseline_ideas_reference("YASHAN", "y28FbpmM", "all")["content"])
        service.api.get_baseline_ideas.assert_called()
        with self.assertRaises(ValueError):
            service.read_baseline_ideas_reference("YASHAN", "y28FbpmM", "planned")

    def test_baseline_ideas_http_contract(self):
        client = TestClient(app)
        locator = "/api/pingcode/products/YASHAN/baselines/y28FbpmM/ideas/reference?category=all"
        with patch.object(pingcode, "read_baseline_ideas_reference", return_value={"productCode": "YASHAN", "baselineId": "y28FbpmM", "category": "all", "content": "正文"}) as reader:
            response = client.get(locator)
            self.assertEqual(200, response.status_code)
            reader.assert_called_once_with("YASHAN", "y28FbpmM", "all")
        with patch.object(pingcode, "read_baseline_ideas_reference", side_effect=ValueError("secret-detail")):
            response = client.get(locator)
            self.assertEqual(422, response.status_code)
            self.assertNotIn("secret-detail", response.text)

    def test_baseline_ideas_collects_every_page_and_rejects_changed_count(self):
        service = self.service()
        service.api.get_product.return_value = {"data": {"value": {"_id": "product1", "identifier": "YASHAN"}}}
        service.api.get_baseline.return_value = {"data": {"value": {"short_id": "base1", "scope": "product1", "name": "版本基线"}}}
        first = {"data": {"count": 2, "value": [{"whole_identifier": "YASHAN-1", "title": "第一条"}]}}
        second = {"data": {"count": 2, "value": [{"whole_identifier": "YASHAN-2", "title": "第二条"}]}}
        service.api.get_baseline_ideas.side_effect = [first, second]
        result = service.read_baseline_ideas_reference("YASHAN", "base1")
        self.assertIn("YASHAN-1", result["content"])
        self.assertIn("YASHAN-2", result["content"])
        self.assertEqual(2, service.api.get_baseline_ideas.call_count)
        service.api.get_baseline_ideas.side_effect = [first, {"data": {"count": 3, "value": second["data"]["value"]}}]
        with self.assertRaises(ValueError):
            service.read_baseline_ideas_reference("YASHAN", "base1")

    def test_baseline_ideas_category_resolves_within_baseline(self):
        service = self.service()
        service.api.get_product.return_value = {"data": {"value": {"_id": "product1", "identifier": "YASHAN"}}}
        service.api.get_baseline.return_value = {"data": {"value": {"short_id": "base1", "scope": "product1", "name": "版本基线"}}}
        service.api.get_baseline_suites.return_value = {"data": {"value": [
            {"_id": "suite1", "short_id": "4iXjKHRH", "product_id": "product1", "name": "23.6.2版本规划"},
        ]}}
        service.api.get_baseline_ideas.return_value = {"data": {"count": 1, "value": [{"whole_identifier": "YASHAN-1", "title": "目标需求"}]}}
        result = service.read_baseline_ideas_reference("YASHAN", "base1", "4iXjKHRH")
        self.assertIn("YASHAN-1", result["content"])
        service.api.get_baseline_ideas.assert_called_once_with("product1", "base1", 0, suite_id="suite1")
        with self.assertRaises(ValueError):
            service.read_baseline_ideas_reference("YASHAN", "base1", "unknown")


if __name__ == "__main__": unittest.main()
