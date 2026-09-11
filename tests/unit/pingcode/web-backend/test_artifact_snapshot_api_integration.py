import hashlib
import json
import os
import time
import unittest
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen


API_BASE = os.getenv("PINGCODE_TEST_API_BASE", "").rstrip("/")
UPLOAD_TOKEN = os.getenv("PINGCODE_TEST_UPLOAD_TOKEN", "")
DATA_ROOT = Path(os.getenv("PINGCODE_TEST_DATA_ROOT", "")) if os.getenv("PINGCODE_TEST_DATA_ROOT") else None


def call_json(path, method="GET", payload=None, headers=None):
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = Request(
        API_BASE + path,
        data=body,
        method=method,
        headers={"Content-Type": "application/json", **(headers or {})},
    )
    try:
        with urlopen(request, timeout=30) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        return exc.code, json.loads(exc.read().decode("utf-8"))


@unittest.skipUnless(
    API_BASE and UPLOAD_TOKEN and DATA_ROOT,
    "设置隔离 API、上传令牌和数据根后执行方案 C 真实 API 测试",
)
class ArtifactSnapshotApiIntegrationTests(unittest.TestCase):
    def test_concurrent_rule_training_has_one_owner_and_snapshot_lineage(self):
        content = b"# Snapshot API Test\n\nRule-only processing must not call the model."
        auth = {"Authorization": f"Bearer {UPLOAD_TOKEN}"}
        _, session = call_json(
            "/api/upload-sessions",
            "POST",
            {"name": "方案 C 真实 API", "operatorLabel": "test", "totalFiles": 1, "totalBytes": len(content)},
            {**auth, "Idempotency-Key": f"scheme-c-{uuid.uuid4()}"},
        )
        _, item = call_json(
            f"/api/upload-sessions/{session['id']}/files",
            "POST",
            {"relativePath": "guide.md", "size": len(content), "sha256": hashlib.sha256(content).hexdigest(), "mediaType": "text/markdown"},
            auth,
        )
        upload = Request(
            API_BASE + f"/api/upload-sessions/{session['id']}/files/{item['id']}/chunks/0",
            data=content,
            method="PUT",
            headers={
                **auth,
                "Content-Type": "application/octet-stream",
                "Content-Range": f"bytes 0-{len(content) - 1}/{len(content)}",
                "X-Chunk-SHA256": hashlib.sha256(content).hexdigest(),
            },
        )
        with urlopen(upload, timeout=30) as response:
            response.read()
        call_json(f"/api/upload-sessions/{session['id']}/files/{item['id']}/complete", "POST", {}, auth)
        call_json(f"/api/upload-sessions/{session['id']}/complete", "POST", {}, auth)
        _, batch = call_json(
            f"/api/upload-sessions/{session['id']}/create-batch",
            "POST",
            {"name": "方案 C 真实 API 批次"},
            auth,
        )

        def start(_):
            return call_json(
                "/api/training/tasks", "POST",
                {"batchId": batch["id"], "mode": "keyword_analysis"},
            )

        with ThreadPoolExecutor(max_workers=2) as executor:
            starts = list(executor.map(start, range(2)))
        self.assertEqual(sorted(status for status, _ in starts), [202, 409])
        task_id = next(body["id"] for status, body in starts if status == 202)
        for _ in range(300):
            _, task = call_json(f"/api/training/tasks/{task_id}")
            if task["state"] in {"completed", "failed", "cancelled"}:
                break
            time.sleep(0.05)
        self.assertEqual(task["state"], "completed", task.get("message"))
        self.assertEqual(task["modelCalls"], {"succeeded": 0, "failed": 0, "skipped": 0})

        manifest = json.loads(
            (DATA_ROOT / "training-runs" / task_id / "run-manifest.json").read_text(encoding="utf-8")
        )
        for stage in ("preparation", "metadata"):
            ref = manifest["lineage"][stage]
            self.assertEqual(ref["batchId"], batch["id"])
            self.assertTrue(ref["manifestHash"].startswith("sha256:"))
            self.assertGreaterEqual(ref["generation"], 1)


if __name__ == "__main__":
    unittest.main()
