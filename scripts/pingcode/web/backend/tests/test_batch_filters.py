import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.services import BatchService
from app.store import JsonStore


class BatchFilterTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.store = JsonStore(Path(self.directory.name) / "state.json")
        self.service = BatchService(self.store, None)
        now = datetime.now(timezone.utc)
        self._put_batch(
            "batch_upload00000001",
            "产品资料上传",
            "uploaded",
            now,
            source={
                "sourceType": "upload",
                "sourceId": "upload_source0001",
                "displayName": "产品设计资料",
                "capturedAt": now.isoformat(),
                "metadata": {},
            },
        )
        self._put_batch(
            "batch_pingcode000001",
            "YASDOC 下载",
            "downloaded",
            now - timedelta(days=1),
            source={
                "sourceType": "pingcode",
                "sourceId": "YASDOC",
                "displayName": "YashanDB 文档",
                "capturedAt": now.isoformat(),
                "metadata": {},
            },
            local_space_name="YashanDB 文档",
            local_space_path="spaces/yasdoc",
        )
        self._put_batch(
            "batch_legacy00000001",
            "历史未知批次",
            "failed",
            now - timedelta(days=2),
        )

    def tearDown(self):
        self.directory.cleanup()

    def test_source_and_ownership_filters_run_before_pagination(self):
        result = self.service.list_page(
            page=1,
            page_size=1,
            source_types="upload",
            ownership_types="temporary",
        )
        self.assertEqual(result["total"], 1)
        self.assertEqual(result["items"][0]["id"], "batch_upload00000001")
        self.assertEqual(result["items"][0]["sourceSummary"]["type"], "upload")
        self.assertEqual(result["items"][0]["ownershipSummary"]["type"], "temporary")
        self.assertEqual(result["facets"]["all"], 3)
        self.assertEqual(result["facets"]["sourceTypes"]["upload"], 1)

    def test_keyword_matches_source_and_local_space(self):
        by_source = self.service.list_page(page=1, page_size=20, keyword="YASDOC")
        by_local_space = self.service.list_page(page=1, page_size=20, local_space="spaces/yasdoc")
        self.assertEqual([item["id"] for item in by_source["items"]], ["batch_pingcode000001"])
        self.assertEqual([item["id"] for item in by_local_space["items"]], ["batch_pingcode000001"])

    def test_missing_source_is_unknown_not_upload(self):
        result = self.service.list_page(page=1, page_size=20, source_types="unknown")
        self.assertEqual(result["total"], 1)
        self.assertEqual(result["items"][0]["sourceSummary"]["typeLabel"], "来源未知")
        self.assertEqual(result["items"][0]["ownershipSummary"]["type"], "unmapped")

    def test_invalid_filter_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "来源类型不支持"):
            self.service.list_page(page=1, page_size=20, source_types="invalid")

    def _put_batch(
        self,
        batch_id,
        name,
        state,
        updated_at,
        *,
        source=None,
        local_space_name=None,
        local_space_path=None,
    ):
        record = {
            "id": batch_id,
            "name": name,
            "state": state,
            "sourceSnapshot": {
                "capturedAt": updated_at.isoformat(),
                "completeness": "complete",
                "estimatedPages": 0,
                "estimatedAttachments": 1,
            },
            "source": source,
            "localSpaceName": local_space_name,
            "localSpaceLogicalPath": local_space_path,
            "activeTaskIds": [],
            "createdAt": updated_at.isoformat(),
            "updatedAt": updated_at.isoformat(),
        }
        self.store.put_record("batches", batch_id, record)


if __name__ == "__main__":
    unittest.main()
