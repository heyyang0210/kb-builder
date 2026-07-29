import json
import os
import unittest
from pathlib import Path
from urllib.parse import quote
from urllib.request import urlopen


API_BASE = os.getenv("PINGCODE_TEST_API_BASE", "").rstrip("/")
FRONTEND_BASE = os.getenv("PINGCODE_TEST_FRONTEND_BASE", "").rstrip("/")


def call_json(path):
    with urlopen(f"{API_BASE}{path}", timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


@unittest.skipUnless(API_BASE, "设置 PINGCODE_TEST_API_BASE 后执行工作台真实 API 测试")
class WorkbenchApiIntegrationTests(unittest.TestCase):
    def test_summary_list_and_detail_contract(self):
        summary = call_json("/api/workbench/summary")
        listing = call_json("/api/material-batches?page=1&pageSize=1")
        self.assertIn("counts", summary)
        self.assertIn("activeTasks", summary)
        self.assertIn("recentTasks", summary)
        self.assertIn("processStates", listing["facets"])
        if listing["items"]:
            item = listing["items"][0]
            for key in ("processSummary", "qualitySummary", "materialSummary", "recommendedAction", "latestActivity"):
                self.assertIn(key, item)
            detail = call_json(f"/api/material-batches/{quote(item['id'])}/workbench-summary")
            self.assertEqual(detail["id"], item["id"])

    def test_workbench_filter_is_applied_before_pagination(self):
        listing = call_json("/api/material-batches?page=1&pageSize=100")
        for state, count in listing["facets"]["processStates"].items():
            if not count:
                continue
            filtered = call_json(f"/api/material-batches?workbenchState={quote(state)}&page=1&pageSize=1")
            self.assertEqual(filtered["total"], count)
            self.assertTrue(all(item["processSummary"]["state"] == state for item in filtered["items"]))


@unittest.skipUnless(API_BASE and FRONTEND_BASE, "设置后端和前端地址后执行工作台浏览器测试")
class WorkbenchBrowserIntegrationTests(unittest.TestCase):
    def test_workbench_and_task_drawer_at_desktop_sizes(self):
        from playwright.sync_api import sync_playwright

        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            for width, height in ((1440, 960), (1280, 800)):
                page = browser.new_page(viewport={"width": width, "height": height})
                page.goto(f"{FRONTEND_BASE}/pingcode-materials/workbench", wait_until="networkidle", timeout=60000)
                page.get_by_role("heading", name="工作台", exact=True).wait_for()
                sidebar_links = page.locator(".sidebar a")
                self.assertEqual(sidebar_links.count(), 1)
                self.assertEqual(sidebar_links.first.inner_text(), "工作台")
                self.assertEqual(page.locator(".sidebar-note").count(), 0)
                self.assertEqual(page.get_by_role("link", name="本地上传", exact=True).count(), 1)
                self.assertEqual(page.get_by_role("link", name="PingCode 接入", exact=True).count(), 1)
                self.assertEqual(page.get_by_role("link", name="查看全部", exact=True).count(), 1)
                self.assertEqual(page.evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth"), True)
                page.goto(f"{FRONTEND_BASE}/pingcode-materials/batches", wait_until="networkidle", timeout=60000)
                page.get_by_role("heading", name="资料加工任务", exact=True).wait_for()
                self.assertEqual(page.evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth"), True)
                self.assertEqual(page.get_by_text("素材批次", exact=True).count(), 0)
                rows = page.locator("tbody .task-table-row")
                if rows.count():
                    rows.first.click()
                    page.get_by_role("dialog", name="资料加工任务详情").wait_for()
                    page.get_by_role("button", name="关闭任务详情").click()
                report = Path(__file__).parent / "reports" / f"workbench-{width}x{height}.png"
                report.parent.mkdir(parents=True, exist_ok=True)
                page.screenshot(path=str(report), full_page=True)
                page.close()
            browser.close()


if __name__ == "__main__":
    unittest.main()
