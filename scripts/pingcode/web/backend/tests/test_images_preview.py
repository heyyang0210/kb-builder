import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from app.services import FileService
from pingcode.core.api_client import PingCodeAPIClient
from pingcode.core.content_parser import ContentParser


class FakePage:
    def __init__(self, results):
        self.results = list(results)
        self.urls = []
        self.request = self

    def get(self, url):
        self.urls.append(url)
        result = self.results.pop(0)
        return SimpleNamespace(
            ok=result["ok"],
            status=result["status"],
            headers={"content-type": result.get("contentType", "")},
            body=lambda: bytes(result.get("data", [])),
        )


class ContentParserImageTests(unittest.TestCase):
    def setUp(self):
        self.document = [
            {"type": "paragraph", "children": [{"text": "图片说明"}]},
            {
                "type": "image",
                "key": "image-key",
                "name": "架构图.png",
                "originUrl": "https://pingcode.example/atlas/files/public/image-id/origin-url",
                "children": [{"text": ""}],
            },
        ]

    def test_origin_url_is_preserved_without_resolver(self):
        markdown = ContentParser().parse_document(self.document)
        self.assertIn("![架构图.png](https://pingcode.example/atlas/files/public/", markdown)

    def test_resolver_rewrites_image_to_local_path(self):
        markdown = ContentParser().parse_document(
            self.document,
            image_resolver=lambda _image: "../assets/page/image.png",
        )
        self.assertIn("![架构图.png](../assets/page/image.png)", markdown)

    def test_failed_resolution_is_visible_and_images_are_extractable(self):
        parser = ContentParser()
        markdown = parser.parse_document(self.document, image_resolver=lambda _image: None)
        self.assertIn("图片下载失败：架构图.png", markdown)
        self.assertEqual(parser.extract_images(self.document), [self.document[1]])


class PublicImageDownloadTests(unittest.TestCase):
    def test_download_uses_public_image_token_and_returns_image(self):
        page = FakePage(
            [
                {
                    "ok": True,
                    "status": 200,
                    "contentType": "application/octet-stream",
                    "data": [137, 80, 78, 71, 13, 10, 26, 10],
                }
            ]
        )
        client = PingCodeAPIClient(page, "https://pingcode.example")
        with patch.object(client, "get_public_image_token", return_value="short-token"):
            data, content_type = client.download_public_image(
                {
                    "originUrl": "https://pingcode.example/atlas/files/public/image-id/origin-url"
                }
            )
        self.assertEqual(data, bytes([137, 80, 78, 71, 13, 10, 26, 10]))
        self.assertEqual(content_type, "image/png")
        self.assertIn("token=short-token", page.urls[0])

    def test_download_rejects_external_image_url(self):
        client = PingCodeAPIClient(FakePage([]), "https://pingcode.example")
        with self.assertRaisesRegex(ValueError, "不属于当前 PingCode"):
            client.download_public_image(
                {"originUrl": "https://untrusted.example/atlas/files/public/image-id"}
            )

    def test_download_refreshes_expired_token_once(self):
        page = FakePage(
            [
                {"ok": True, "status": 200, "contentType": "application/json", "data": [123]},
                {"ok": True, "status": 200, "contentType": "image/png", "data": [137]},
            ]
        )
        client = PingCodeAPIClient(page, "https://pingcode.example")
        with patch.object(client, "get_public_image_token", side_effect=["old", "new"]) as token:
            data, _ = client.download_public_image(
                {
                    "originUrl": "https://pingcode.example/atlas/files/public/image-id/origin-url"
                }
            )
        self.assertEqual(data, bytes([137]))
        self.assertEqual(token.call_count, 2)
        self.assertIn("token=new", page.urls[1])


class AttachmentDownloadTests(unittest.TestCase):
    def test_download_reads_binary_body_from_request_context(self):
        page = FakePage(
            [{"ok": True, "status": 200, "contentType": "application/pdf", "data": [37, 80, 68, 70]}]
        )
        client = PingCodeAPIClient(page, "https://pingcode.example")

        data = client.download_attachment({"token": "attachment-token"})

        self.assertEqual(data, b"%PDF")
        self.assertIn("token=attachment-token", page.urls[0])


class FilePreviewTests(unittest.TestCase):
    def test_preview_maps_registered_page_assets(self):
        with tempfile.TemporaryDirectory() as directory:
            data_root = Path(directory)
            batch_root = data_root / "spaces" / "ai" / "batches" / "batch-1"
            page_path = batch_root / "pages" / "page.md"
            asset_path = batch_root / "assets" / "页面" / "image.png"
            page_path.parent.mkdir(parents=True)
            asset_path.parent.mkdir(parents=True)
            page_path.write_text("![图](../assets/页面/image.png)", encoding="utf-8")
            asset_path.write_bytes(bytes([137, 80, 78, 71]))
            resources = [
                {
                    "id": "page-resource",
                    "batchId": "batch-1",
                    "kind": "page",
                    "pageId": "page-1",
                    "name": "page.md",
                    "logicalPath": str(page_path.relative_to(data_root)),
                    "size": page_path.stat().st_size,
                },
                {
                    "id": "asset-resource",
                    "batchId": "batch-1",
                    "kind": "page_asset",
                    "pageId": "page-1",
                    "name": "image.png",
                    "logicalPath": str(asset_path.relative_to(data_root)),
                    "size": asset_path.stat().st_size,
                },
            ]
            (batch_root / "resources.json").write_text(
                json.dumps(resources, ensure_ascii=False), encoding="utf-8"
            )

            with patch("app.services.settings", SimpleNamespace(data_root=data_root)):
                preview = FileService().preview("page-resource")

            self.assertEqual(preview.format, "markdown")
            self.assertEqual(preview.assets["../assets/页面/image.png"], "asset-resource")
            self.assertEqual(
                preview.assets["../assets/%E9%A1%B5%E9%9D%A2/image.png"],
                "asset-resource",
            )

    def test_resolve_rejects_path_outside_data_root(self):
        with tempfile.TemporaryDirectory() as directory:
            data_root = Path(directory) / "data"
            data_root.mkdir()
            outside = Path(directory) / "outside.txt"
            outside.write_text("secret", encoding="utf-8")
            with patch("app.services.settings", SimpleNamespace(data_root=data_root)):
                with self.assertRaises(FileNotFoundError):
                    FileService._resolve("../outside.txt")

    def test_file_pagination_excludes_images_and_separates_conversion(self):
        with tempfile.TemporaryDirectory() as directory:
            data_root = Path(directory)
            batch_root = data_root / "spaces" / "ai" / "batches" / "batch-1"
            batch_root.mkdir(parents=True)
            definitions = [
                ("page", "page-1", "文档.md", b"# doc"),
                ("attachment", "pdf-1", "设计.pdf", b"%PDF"),
                ("page_asset", "asset-1", "页面图片.png", b"\x89PNG"),
                ("attachment", "image-1", "附件图片.jpg", b"\xff\xd8\xff"),
            ]
            resources = []
            for kind, resource_id, name, content in definitions:
                path = batch_root / "files" / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(content)
                resources.append(
                    {
                        "id": resource_id,
                        "batchId": "batch-1",
                        "kind": kind,
                        "pageId": "source-page",
                        "name": name,
                        "logicalPath": str(path.relative_to(data_root)),
                        "size": len(content),
                    }
                )
            (batch_root / "resources.json").write_text(
                json.dumps(resources, ensure_ascii=False), encoding="utf-8"
            )

            tool_status = {
                "libreoffice": {"available": True, "requiredFormats": ["docx"]},
                "pdftotext": {"available": True, "requiredFormats": ["pdf"]},
                "htmlParser": {"available": True, "requiredFormats": ["html", "htm"]},
            }
            with (
                patch("app.services.settings", SimpleNamespace(data_root=data_root)),
                patch.object(FileService, "_tool_status", return_value=tool_status),
            ):
                service = FileService()
                all_files = service.list_page("batch-1", "all", 1, 1)
                text_files = service.list_page("batch-1", "text", 1, 20)
                pending_files = service.list_page(
                    "batch-1", "conversion_pending", 1, 20
                )

            self.assertEqual(all_files["total"], 2)
            self.assertTrue(all_files["hasMore"])
            self.assertEqual([item.name for item in text_files["items"]], ["文档.md", "设计.pdf"])
            self.assertEqual(text_files["items"][1].processing_status, "convertible")
            self.assertEqual([item.name for item in pending_files["items"]], ["设计.pdf"])


if __name__ == "__main__":
    unittest.main()
