import hashlib
import io
import json
import os
import unittest
import uuid
import zipfile
from urllib.request import Request, urlopen


API_BASE = os.getenv("PINGCODE_TEST_API_BASE", "").rstrip("/")
UPLOAD_TOKEN = os.getenv("PINGCODE_TEST_UPLOAD_TOKEN", "")


def call_json(path, *, method="GET", payload=None, token=UPLOAD_TOKEN, headers=None):
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    request_headers = {"Content-Type": "application/json", **(headers or {})}
    if token is not None:
        request_headers["Authorization"] = f"Bearer {token}"
    request = Request(f"{API_BASE}{path}", data=body, method=method, headers=request_headers)
    with urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def upload_bytes(path, content, *, token=UPLOAD_TOKEN, headers=None):
    request_headers = {"Content-Type": "application/octet-stream", **(headers or {})}
    request_headers["Authorization"] = f"Bearer {token}"
    request = Request(f"{API_BASE}{path}", data=content, method="PUT", headers=request_headers)
    with urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


@unittest.skipUnless(
    API_BASE and UPLOAD_TOKEN,
    "设置 PINGCODE_TEST_API_BASE 和 PINGCODE_TEST_UPLOAD_TOKEN 后执行准备处理 API 测试",
)
class MaterialPreparationApiTests(unittest.TestCase):
    def test_uploaded_archive_is_safely_prepared(self):
        content = self._archive_bytes()
        session = call_json(
            "/api/upload-sessions",
            method="POST",
            payload={
                "name": "准备处理集成测试",
                "operatorLabel": "automated-test",
                "totalFiles": 1,
                "totalBytes": len(content),
            },
            headers={"Idempotency-Key": f"preparation-test-{uuid.uuid4()}"},
        )
        file_item = call_json(
            f"/api/upload-sessions/{session['id']}/files",
            method="POST",
            payload={
                "relativePath": "bundle.zip",
                "size": len(content),
                "sha256": hashlib.sha256(content).hexdigest(),
                "mediaType": "application/zip",
            },
        )
        chunk_size = session["chunkSize"]
        for index, start in enumerate(range(0, len(content), chunk_size)):
            chunk = content[start : start + chunk_size]
            upload_bytes(
                f"/api/upload-sessions/{session['id']}/files/{file_item['id']}/chunks/{index}",
                chunk,
                headers={
                    "Content-Range": f"bytes {start}-{start + len(chunk) - 1}/{len(content)}",
                    "X-Chunk-SHA256": hashlib.sha256(chunk).hexdigest(),
                },
            )
        call_json(
            f"/api/upload-sessions/{session['id']}/files/{file_item['id']}/complete",
            method="POST",
        )
        call_json(f"/api/upload-sessions/{session['id']}/complete", method="POST")
        batch = call_json(
            f"/api/upload-sessions/{session['id']}/create-batch",
            method="POST",
            payload={"name": "准备处理集成测试批次"},
        )
        report = call_json(
            "/api/preprocess/prepare",
            method="POST",
            payload={"batchId": batch["id"]},
            token=None,
        )
        self.assertEqual(report["state"], "completed")
        self.assertEqual(report["archiveResources"], 1)
        self.assertEqual(report["extractedResources"], 2)
        self.assertEqual(report["imageResources"], 1)
        self.assertEqual(report["processableResources"], 1)
        files = call_json(
            f"/api/material-batches/{batch['id']}/files?category=all&page=1&pageSize=20",
            token=None,
        )
        self.assertEqual(files["total"], 1)
        self.assertEqual(files["items"][0]["name"], "bundle.zip")

    @staticmethod
    def _archive_bytes():
        output = io.BytesIO()
        with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("docs/readme.md", "# archive integration")
            archive.writestr("assets/diagram.png", b"\x89PNG\r\n\x1a\nimage")
        return output.getvalue()


if __name__ == "__main__":
    unittest.main()
