import threading
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from fastapi.testclient import TestClient
from app.main import app, pingcode
from app.pingcode_service import PingCodeService


class PingCodeReferenceTest(unittest.TestCase):
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

    def test_api_contract_and_redacted_errors(self):
        client = TestClient(app)
        with patch.object(pingcode, "read_reference", return_value={"content": "正文", "spaceKey": "space1", "pageId": "page1"}):
            response = client.get("/api/pingcode/spaces/space1/pages/page1/reference")
        self.assertEqual(200, response.status_code)
        self.assertEqual("正文", response.json()["content"])
        for exception, status in [(KeyError("secret-detail"), 404), (ValueError("secret-detail"), 422), (RuntimeError("secret-detail"), 502)]:
            with patch.object(pingcode, "read_reference", side_effect=exception):
                response = client.get("/api/pingcode/spaces/space1/pages/page1/reference")
            self.assertEqual(status, response.status_code)
            self.assertNotIn("secret-detail", response.text)


if __name__ == "__main__": unittest.main()
