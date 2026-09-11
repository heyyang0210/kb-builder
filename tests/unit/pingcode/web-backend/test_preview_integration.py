import json
import os
import re
import unittest
from urllib.request import urlopen


API_BASE = os.getenv("PINGCODE_TEST_API_BASE", "").rstrip("/")
FRONTEND_BASE = os.getenv("PINGCODE_TEST_FRONTEND_BASE", "").rstrip("/")
BATCH_ID = os.getenv("PINGCODE_TEST_BATCH_ID", "batch_157fe779b2ac4fb5")
TARGET_NAME = os.getenv("PINGCODE_TEST_PREVIEW_FILE", "使用docker镜像部署openclaw.md")


def get_json(url: str) -> dict:
    with urlopen(url, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


@unittest.skipUnless(API_BASE, "设置 PINGCODE_TEST_API_BASE 后执行真实后端 API 测试")
class PreviewApiIntegrationTests(unittest.TestCase):
    def test_markdown_preview_and_registered_image_content(self):
        file_page = get_json(
            f"{API_BASE}/api/material-batches/{BATCH_ID}/files?category=all&page=1&pageSize=20"
        )
        files = file_page["items"]
        self.assertEqual(file_page["total"], 12)
        self.assertFalse(any(item["mediaType"].startswith("image/") for item in files))
        page = next(item for item in files if item["name"] == TARGET_NAME)
        self.assertTrue(
            any(item["name"] == "XML_TABLE Claude.md" for item in files),
            "目录摘要 attachment_count 为 0 时页面附件仍应被下载",
        )
        preview = get_json(f"{API_BASE}/api/files/{page['id']}/preview-data")
        asset_ids = set(preview["assets"].values())

        self.assertEqual(preview["format"], "markdown")
        self.assertIn("![", preview["content"])
        self.assertGreater(len(asset_ids), 0)

        asset_id = next(iter(asset_ids))
        with urlopen(f"{API_BASE}/api/files/{asset_id}/content", timeout=30) as response:
            content_type = response.headers.get_content_type()
            signature = response.read(12)
        self.assertTrue(content_type.startswith("image/"), content_type)
        self.assertTrue(
            signature.startswith((b"\x89PNG\r\n\x1a\n", b"\xff\xd8\xff", b"GIF")),
            signature,
        )


@unittest.skipUnless(
    API_BASE and FRONTEND_BASE,
    "同时设置 PINGCODE_TEST_API_BASE 和 PINGCODE_TEST_FRONTEND_BASE 后执行浏览器预览测试",
)
class PreviewBrowserIntegrationTests(unittest.TestCase):
    def test_space_download_scope_supports_second_level_name_and_attachment_changes(self):
        from playwright.sync_api import sync_playwright

        url = f"{FRONTEND_BASE}/pingcode-materials/"
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1440, "height": 1000})
            page.goto(url, wait_until="networkidle", timeout=60000)
            page.locator(".space-item", has_text="YashanDB 文档").click()
            page.locator(".remote-space-card", has_text="YashanDB 文档").wait_for(timeout=60000)

            batch_name = page.get_by_label("批次名称").input_value()
            self.assertRegex(batch_name, re.compile(r"YashanDB 文档-\d{8}-\d{6}$"))

            page.get_by_label("Word").check()
            page.get_by_label("压缩包").check()
            page.get_by_label("自定义附件类型").fill("xml,.drawio")
            selected = page.locator(".selected-types").inner_text()
            for extension in (".doc", ".docx", ".zip", ".tar", ".xml", ".drawio"):
                self.assertIn(extension, selected)
            browser.close()

    def test_download_page_opens_document_preview_with_images(self):
        from playwright.sync_api import sync_playwright

        url = f"{FRONTEND_BASE}/pingcode-materials/batches/{BATCH_ID}/download"
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1440, "height": 1000})
            console_errors = []
            page.on(
                "console",
                lambda message: console_errors.append(message.text)
                if message.type == "error"
                else None,
            )
            page.goto(url, wait_until="networkidle", timeout=60000)
            row = page.locator("tr", has_text=TARGET_NAME)
            row.get_by_role("button", name="预览").click()
            dialog = page.get_by_role("dialog")
            dialog.wait_for(state="visible")
            images = dialog.locator(".markdown-preview img")
            images.first.wait_for(state="visible", timeout=15000)
            page.wait_for_function(
                """selector => {
                    const nodes = [...document.querySelectorAll(selector)]
                    return nodes.length > 0 && nodes.every(image => image.complete && image.naturalWidth > 0)
                }""",
                arg=".document-preview .markdown-preview img",
                timeout=30000,
            )
            loaded = images.evaluate_all(
                "nodes => nodes.map(image => image.complete && image.naturalWidth > 0)"
            )
            self.assertGreater(len(loaded), 0)
            self.assertTrue(all(loaded), loaded)
            self.assertEqual(console_errors, [])
            browser.close()

    def test_preprocess_pending_files_are_loaded_only_after_expand(self):
        from playwright.sync_api import sync_playwright

        url = f"{FRONTEND_BASE}/pingcode-materials/batches/{BATCH_ID}/preprocess"
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1440, "height": 1000})
            requested_urls = []
            page.on("request", lambda request: requested_urls.append(request.url))
            page.goto(url, wait_until="networkidle", timeout=60000)
            self.assertTrue(any("category=text" in item for item in requested_urls))
            self.assertFalse(any("category=conversion_pending" in item for item in requested_urls))

            page.get_by_role("button", name="开始扫描").click()
            page.locator(".stats").wait_for(state="visible", timeout=30000)
            self.assertFalse(any("category=conversion_pending" in item for item in requested_urls))

            page.locator("details.pending-files summary").click()
            page.wait_for_timeout(500)
            self.assertTrue(any("category=conversion_pending" in item for item in requested_urls))
            browser.close()


if __name__ == "__main__":
    unittest.main()
