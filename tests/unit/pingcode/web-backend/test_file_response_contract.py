import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app, files


class FileResponseContractTest(unittest.TestCase):
    def test_preview_is_inline_and_download_is_attachment(self):
        with tempfile.TemporaryDirectory() as directory:
            file_path = Path(directory) / "设计.pdf"
            file_path.write_bytes(b"%PDF-contract")
            resource = SimpleNamespace(
                previewable=True,
                downloadable=True,
                media_type="application/pdf",
                name="设计.pdf",
            )
            client = TestClient(app)
            with patch.object(files, "find", return_value=(resource, file_path)):
                preview = client.get("/api/files/resource-1/preview")
                download = client.get("/api/files/resource-1/download")
            self.assertEqual(preview.status_code, 200)
            self.assertIn("inline", preview.headers.get("content-disposition", ""))
            self.assertEqual(preview.content, b"%PDF-contract")
            self.assertEqual(download.status_code, 200)
            self.assertIn("attachment", download.headers.get("content-disposition", ""))

    def test_download_rejects_resource_marked_not_downloadable(self):
        resource = SimpleNamespace(previewable=True, downloadable=False, media_type="text/plain", name="受限.txt")
        client = TestClient(app)
        with patch.object(files, "find", return_value=(resource, Path(__file__))):
            response = client.get("/api/files/restricted/download")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["error"]["code"], "FILE_DOWNLOAD_FORBIDDEN")

    def test_content_supports_single_byte_range(self):
        with tempfile.TemporaryDirectory() as directory:
            file_path = Path(directory) / "range.pdf"
            file_path.write_bytes(b"0123456789")
            resource = SimpleNamespace(previewable=True, downloadable=True, media_type="application/pdf", name="range.pdf")
            client = TestClient(app)
            with patch.object(files, "find", return_value=(resource, file_path)):
                response = client.get("/api/files/resource-1/content", headers={"Range": "bytes=2-5"})
            self.assertEqual(response.status_code, 206)
            self.assertEqual(response.content, b"2345")
            self.assertEqual(response.headers["content-range"], "bytes 2-5/10")
            self.assertEqual(response.headers["accept-ranges"], "bytes")
            self.assertEqual(response.headers["content-length"], "4")

    def test_suffix_range_and_invalid_range_have_explicit_contract(self):
        with tempfile.TemporaryDirectory() as directory:
            file_path = Path(directory) / "range.pdf"
            file_path.write_bytes(b"0123456789")
            resource = SimpleNamespace(previewable=True, downloadable=True, media_type="application/pdf", name="range.pdf")
            client = TestClient(app)
            with patch.object(files, "find", return_value=(resource, file_path)):
                suffix = client.get("/api/files/resource-1/download", headers={"Range": "bytes=-3"})
                invalid = client.get("/api/files/resource-1/download", headers={"Range": "bytes=99-"})
            self.assertEqual(suffix.status_code, 206)
            self.assertEqual(suffix.content, b"789")
            self.assertEqual(invalid.status_code, 416)
            self.assertEqual(invalid.headers["content-range"], "bytes */10")
            self.assertEqual(invalid.json()["error"]["code"], "FILE_RANGE_INVALID")


if __name__ == "__main__":
    unittest.main()
