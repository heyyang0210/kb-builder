import hashlib
import json
import os
import unittest
import uuid
from urllib.error import HTTPError
from urllib.request import Request, urlopen


API_BASE = os.getenv("PINGCODE_TEST_API_BASE", "").rstrip("/")
FRONTEND_BASE = os.getenv("PINGCODE_TEST_FRONTEND_BASE", "").rstrip("/")
UPLOAD_TOKEN = os.getenv("PINGCODE_TEST_UPLOAD_TOKEN", "")


def call_json(path, *, method="GET", payload=None, token=UPLOAD_TOKEN, headers=None):
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    request_headers = {"Content-Type": "application/json", **(headers or {})}
    if token is not None:
        request_headers["Authorization"] = f"Bearer {token}"
    request = Request(f"{API_BASE}{path}", data=body, method=method, headers=request_headers)
    with urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def call_bytes(path, content, *, method="PUT", token=UPLOAD_TOKEN, headers=None):
    request_headers = {"Content-Type": "application/octet-stream", **(headers or {})}
    if token is not None:
        request_headers["Authorization"] = f"Bearer {token}"
    request = Request(f"{API_BASE}{path}", data=content, method=method, headers=request_headers)
    with urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


@unittest.skipUnless(API_BASE, "设置 PINGCODE_TEST_API_BASE 后执行上传 API 测试")
class UploadApiIntegrationTests(unittest.TestCase):
    def test_upload_does_not_require_browser_token(self):
        session = call_json(
            "/api/upload-sessions",
            method="POST",
            payload={"name": "无令牌上传", "totalFiles": 1, "totalBytes": 1},
            token=None,
        )
        self.assertEqual(session["state"], "created")

    def test_chunk_upload_resume_and_complete(self):
        content = b"ABCDEFGHIJ"
        session = call_json(
            "/api/upload-sessions",
            method="POST",
            payload={
                "name": "上传集成测试",
                "operatorLabel": "automated-test",
                "totalFiles": 1,
                "totalBytes": len(content),
            },
            headers={"Idempotency-Key": f"upload-test-{uuid.uuid4()}"},
        )
        self.assertEqual(session["state"], "created")
        self.assertEqual(session["chunkSize"], 4)

        file_item = call_json(
            f"/api/upload-sessions/{session['id']}/files",
            method="POST",
            payload={
                "relativePath": "docs/example.md",
                "size": len(content),
                "sha256": hashlib.sha256(content).hexdigest(),
                "mediaType": "text/markdown",
            },
        )
        file_id = file_item["id"]

        first = content[:4]
        call_bytes(
            f"/api/upload-sessions/{session['id']}/files/{file_id}/chunks/0",
            first,
            headers={
                "Content-Range": "bytes 0-3/10",
                "X-Chunk-SHA256": hashlib.sha256(first).hexdigest(),
            },
        )
        resumed = call_json(f"/api/upload-sessions/{session['id']}")
        self.assertEqual(resumed["files"][0]["receivedChunks"], [0])
        self.assertEqual(resumed["files"][0]["missingChunks"], [1, 2])

        for index, chunk in enumerate((content[4:8], content[8:])):
            start = 4 + (index * 4)
            end = start + len(chunk) - 1
            call_bytes(
                f"/api/upload-sessions/{session['id']}/files/{file_id}/chunks/{index + 1}",
                chunk,
                headers={
                    "Content-Range": f"bytes {start}-{end}/10",
                    "X-Chunk-SHA256": hashlib.sha256(chunk).hexdigest(),
                },
            )
        completed_file = call_json(
            f"/api/upload-sessions/{session['id']}/files/{file_id}/complete",
            method="POST",
        )
        self.assertEqual(completed_file["state"], "verified")
        completed_session = call_json(
            f"/api/upload-sessions/{session['id']}/complete",
            method="POST",
        )
        self.assertEqual(completed_session["state"], "ready")
        self.assertTrue(completed_session["manifestPath"].endswith("manifest.json"))
        batch = call_json(
            f"/api/upload-sessions/{session['id']}/create-batch",
            method="POST",
            payload={"name": "上传集成测试批次"},
        )
        self.assertEqual(batch["source"]["sourceType"], "upload")
        self.assertEqual(batch["sourceSnapshot"]["estimatedAttachments"], 1)
        files = call_json(f"/api/material-batches/{batch['id']}/files?category=text&page=1&pageSize=20")
        self.assertEqual(files["total"], 1)
        self.assertEqual(files["items"][0]["name"], "example.md")
        scan_request = Request(
            f"{API_BASE}/api/preprocess/scan",
            data=json.dumps({"batchId": batch["id"]}).encode("utf-8"),
            method="POST",
            headers={"Content-Type": "application/json"},
        )
        with urlopen(scan_request, timeout=30) as response:
            scan = json.loads(response.read().decode("utf-8"))
        self.assertEqual(scan["totalFiles"], 1)

    def test_unsafe_relative_path_is_rejected(self):
        session = call_json(
            "/api/upload-sessions",
            method="POST",
            payload={"name": "路径校验测试", "totalFiles": 1, "totalBytes": 1},
        )
        with self.assertRaises(HTTPError) as context:
            call_json(
                f"/api/upload-sessions/{session['id']}/files",
                method="POST",
                payload={"relativePath": "../outside.txt", "size": 1},
            )
        self.assertEqual(context.exception.code, 400)


@unittest.skipUnless(
    FRONTEND_BASE,
    "设置 PINGCODE_TEST_FRONTEND_BASE 后执行上传浏览器测试",
)
class UploadBrowserIntegrationTests(unittest.TestCase):
    def test_upload_page_completes_real_upload(self):
        from playwright.sync_api import sync_playwright

        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1440, "height": 1000})
            page.goto(
                f"{FRONTEND_BASE}/pingcode-materials/upload",
                wait_until="networkidle",
                timeout=60000,
            )
            page.locator('input[type="file"]').set_input_files({
                "name": "browser-upload.md",
                "mimeType": "text/markdown",
                "buffer": b"browser upload content",
            })
            page.get_by_role("button", name="创建并上传").click()
            page.get_by_text("上传完成，临时素材会话已就绪").wait_for(timeout=30000)
            self.assertIn("已校验", page.locator(".upload-file-list").inner_text())
            page.get_by_role("button", name="生成素材批次").click()
            page.get_by_text("正式素材批次已生成，可进入文件清单和加工流程").wait_for(timeout=30000)
            self.assertTrue(page.get_by_role("link", name="查看批次").is_visible())
            browser.close()


if __name__ == "__main__":
    unittest.main()
