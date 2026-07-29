import hashlib
import json
import os
import unittest
import uuid
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import quote
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


def upload_bytes(path, content, *, headers=None):
    request = Request(
        f"{API_BASE}{path}",
        data=content,
        method="PUT",
        headers={
            "Content-Type": "application/octet-stream",
            "Authorization": f"Bearer {UPLOAD_TOKEN}",
            **(headers or {}),
        },
    )
    with urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def create_upload_batch(name):
    content = b"batch filter integration"
    session = call_json(
        "/api/upload-sessions",
        method="POST",
        payload={"name": name, "operatorLabel": "automated-test", "totalFiles": 1, "totalBytes": len(content)},
        headers={"Idempotency-Key": f"batch-filter-{uuid.uuid4()}"},
    )
    file_item = call_json(
        f"/api/upload-sessions/{session['id']}/files",
        method="POST",
        payload={
            "relativePath": "filter-test.md",
            "size": len(content),
            "sha256": hashlib.sha256(content).hexdigest(),
            "mediaType": "text/markdown",
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
    call_json(f"/api/upload-sessions/{session['id']}/files/{file_item['id']}/complete", method="POST")
    call_json(f"/api/upload-sessions/{session['id']}/complete", method="POST")
    return call_json(
        f"/api/upload-sessions/{session['id']}/create-batch",
        method="POST",
        payload={"name": name},
    )


@unittest.skipUnless(API_BASE and UPLOAD_TOKEN, "设置后端地址和上传令牌后执行批次筛选 API 测试")
class BatchFilterApiTests(unittest.TestCase):
    def test_upload_batch_can_be_filtered_by_source_and_keyword(self):
        name = f"筛选接口测试-{uuid.uuid4().hex[:8]}"
        batch = create_upload_batch(name)
        result = call_json(
            f"/api/material-batches?sourceType=upload&ownership=temporary&keyword={quote(name)}&page=1&pageSize=20",
            token=None,
        )
        self.assertEqual(result["total"], 1)
        self.assertEqual(result["items"][0]["id"], batch["id"])
        self.assertEqual(result["items"][0]["sourceSummary"]["type"], "upload")
        self.assertEqual(result["items"][0]["ownershipSummary"]["type"], "temporary")
        self.assertGreaterEqual(result["facets"]["sourceTypes"]["upload"], 1)

    def test_invalid_source_filter_returns_400(self):
        with self.assertRaises(HTTPError) as context:
            call_json("/api/material-batches?sourceType=invalid", token=None)
        self.assertEqual(context.exception.code, 400)


@unittest.skipUnless(
    API_BASE and FRONTEND_BASE and UPLOAD_TOKEN,
    "设置后端、前端地址和上传令牌后执行批次筛选浏览器测试",
)
class BatchFilterBrowserTests(unittest.TestCase):
    def test_batch_page_filters_and_displays_upload_source(self):
        from playwright.sync_api import sync_playwright

        name = f"筛选界面测试-{uuid.uuid4().hex[:8]}"
        create_upload_batch(name)
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1280, "height": 900})
            page.goto(f"{FRONTEND_BASE}/pingcode-materials/batches", wait_until="networkidle", timeout=60000)
            page.locator(".filter-menu").first.locator("summary").click()
            page.locator(".filter-menu").first.get_by_text("本地上传", exact=True).click()
            page.get_by_label("搜索资料加工任务").fill(name)
            page.locator(".batch-name-cell > strong", has_text=name).first.wait_for(timeout=30000)
            row = page.locator("tbody tr", has_text=name)
            self.assertIn("本地上传", row.locator(".source-cell").inner_text())
            self.assertIn("临时区", row.locator(".ownership-cell").inner_text())
            page.wait_for_timeout(500)
            self.assertIn("sourceType=upload", page.url)
            self.assertIn("keyword=", page.url)
            report_path = Path(__file__).parent / "reports" / "batch-source-filters.png"
            report_path.parent.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=str(report_path), full_page=True)
            browser.close()


if __name__ == "__main__":
    unittest.main()
