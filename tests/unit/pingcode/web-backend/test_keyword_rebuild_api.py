"""Real FastAPI API-A acceptance in an isolated data root."""

from __future__ import annotations

import json
import hashlib
import os
import shutil
import socket
import subprocess
import sys
import threading
import time
import unittest
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from tempfile import TemporaryDirectory

from app.config import settings


def _request(base_url: str, method: str, path: str, payload=None):
    body = None
    headers = {}
    if payload is not None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(base_url + path, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        return exc.code, json.loads(exc.read().decode("utf-8"))


def _tree_snapshot(root: Path):
    return {
        str(path.relative_to(root)): (
            path.stat().st_size,
            path.stat().st_mtime_ns,
            hashlib.sha256(path.read_bytes()).hexdigest(),
        )
        for path in sorted(root.rglob("*"))
        if path.is_file()
    }


class KeywordRebuildApiAcceptanceTests(unittest.TestCase):
    def _tmp_dir(self):
        self._tmp = TemporaryDirectory()
        return self._tmp

    def tearDown(self):
        process = getattr(self, "process", None)
        if process is not None and process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
        tmp = getattr(self, "_tmp", None)
        if tmp is not None:
            tmp.cleanup()

    def setUp(self):  # noqa: C901 - fixture setup intentionally stays explicit
        self._tmp_dir()
        state_path = settings.data_root / "state.json"
        if not state_path.is_file():
            self.skipTest("需要本地 runtime state 作为隔离 API fixture")
        source_state = json.loads(state_path.read_text(encoding="utf-8"))
        candidates = [
            item for item in source_state.get("datasets", {}).values()
            if item.get("state") == "candidate"
            and item.get("graphSummary", {}).get("knowledgeBuildMode") == "keyword_analysis"
            and item.get("trainingTaskId")
        ]
        if not candidates:
            self.skipTest("没有可用于 API-A 隔离验收的 keyword candidate dataset")
        self.dataset = candidates[0]
        self.batch = dict(source_state["batches"][self.dataset["batchId"]])
        self.batch.update({"state": "downloaded", "activeTaskIds": []})
        self.other_batch = dict(self.batch)
        self.other_batch["id"] = "batch_other"
        self.invalid_dataset = dict(self.dataset)
        self.invalid_dataset.update({"id": "dataset_invalid_state", "state": "published"})
        self.task = source_state["tasks"][self.dataset["trainingTaskId"]]
        self.root = Path(self._tmp.name) / "data"
        self.root.mkdir(parents=True)
        (self.root / "state.json").write_text(
            json.dumps({
                "datasets": {
                    self.dataset["id"]: self.dataset,
                    self.invalid_dataset["id"]: self.invalid_dataset,
                },
                "batches": {self.batch["id"]: self.batch, self.other_batch["id"]: self.other_batch},
                "tasks": {self.task["id"]: self.task},
            }, ensure_ascii=False),
            encoding="utf-8",
        )
        shutil.copytree(settings.data_root / self.dataset["datasetPath"], self.root / self.dataset["datasetPath"])
        sock = socket.socket()
        sock.bind(("127.0.0.1", 0))
        self.port = sock.getsockname()[1]
        sock.close()
        env = os.environ.copy()
        backend_root = Path(__file__).resolve().parents[3] / "code" / "pingcode" / "web-backend"
        env.update({"PINGCODE_WEB_DATA_ROOT": str(self.root), "PYTHONPATH": str(backend_root)})
        self.process = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(self.port)],
            cwd=str(backend_root), env=env,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        self.base_url = f"http://127.0.0.1:{self.port}"
        for _ in range(50):
            try:
                status, _ = _request(self.base_url, "GET", f"/api/datasets/{self.dataset['id']}")
                if status == 200:
                    return
            except (OSError, urllib.error.URLError):
                time.sleep(0.1)
        self.tearDown()
        self.fail("隔离 FastAPI 未能启动")

    def _start_and_wait(self):
        status, created = _request(
            self.base_url,
            "POST",
            "/api/training/tasks",
            {
                "batchId": self.batch["id"],
                "mode": "keyword_analysis",
                "sourceDatasetId": self.dataset["id"],
                "config": {"preset": "training_standard"},
            },
        )
        self.assertEqual(status, 202, created)
        task_id = created["id"]
        for _ in range(100):
            status, snapshot = _request(self.base_url, "GET", f"/api/training/tasks/{task_id}")
            self.assertEqual(status, 200)
            if snapshot["state"] in {"completed", "failed", "cancelled"}:
                return snapshot
            time.sleep(0.1)
        self.fail("API-A 任务未在测试窗口内结束")

    def test_success_idempotency_and_zero_model(self):
        dataset_root = self.root / self.dataset["datasetPath"]
        before = _tree_snapshot(dataset_root)
        first = self._start_and_wait()
        self.assertEqual(first["state"], "completed", first)
        result = first["progressDetail"]["rebuildResult"]
        self.assertEqual(result["captureSemantics"], "request_time_snapshot")
        self.assertEqual(first["modelCalls"], {"succeeded": 0, "failed": 0, "skipped": 0})
        self.assertEqual(result["ruleSnapshotRef"]["runId"], result["rebuildRunId"])
        candidates_path = (
            self.root / "training-runs" / result["rebuildRunId"]
            / "extraction-results" / "keyword-candidates.jsonl"
        )
        candidates = [json.loads(line) for line in candidates_path.read_text(encoding="utf-8").splitlines() if line]
        self.assertTrue(candidates)
        self.assertTrue(all(
            item["extractorSnapshotRef"]["runId"] == result["rebuildRunId"]
            and item["modelStatus"] == "not_applicable"
            for item in candidates
        ))
        second = self._start_and_wait()
        self.assertEqual(second["state"], "completed", second)
        self.assertEqual(
            second["progressDetail"]["rebuildResult"]["rebuildRunId"],
            result["rebuildRunId"],
        )
        self.assertEqual(_tree_snapshot(dataset_root), before)

    def test_missing_source_is_structured_404(self):
        status, body = _request(
            self.base_url,
            "POST",
            "/api/training/tasks",
            {
                "batchId": self.batch["id"],
                "mode": "keyword_analysis",
                "sourceDatasetId": "dataset_missing",
                "config": {"preset": "training_standard"},
            },
        )
        self.assertEqual(status, 404, body)
        self.assertEqual(body["error"]["code"], "REBUILD_SOURCE_NOT_FOUND")

    def test_source_from_another_batch_is_structured_conflict(self):
        status, body = _request(
            self.base_url,
            "POST",
            "/api/training/tasks",
            {
                "batchId": self.other_batch["id"],
                "mode": "keyword_analysis",
                "sourceDatasetId": self.dataset["id"],
                "config": {"preset": "training_standard"},
            },
        )
        self.assertEqual(status, 409, body)
        self.assertEqual(body["error"]["code"], "REBUILD_SOURCE_MISMATCH")

    def test_non_candidate_source_is_structured_conflict(self):
        status, body = _request(
            self.base_url,
            "POST",
            "/api/training/tasks",
            {
                "batchId": self.batch["id"],
                "mode": "keyword_analysis",
                "sourceDatasetId": self.invalid_dataset["id"],
                "config": {"preset": "training_standard"},
            },
        )
        self.assertEqual(status, 409, body)
        self.assertEqual(body["error"]["code"], "REBUILD_SOURCE_STATE_INVALID")

    def test_async_input_drift_has_structured_task_error(self):
        normalized_root = self.root / self.dataset["datasetPath"] / "normalized"
        normalized = next(iter(sorted(normalized_root.glob("*.md"))))
        normalized.write_text(
            "漂移" + normalized.read_text(encoding="utf-8"),
            encoding="utf-8",
        )
        snapshot = self._start_and_wait()
        self.assertEqual(snapshot["state"], "failed", snapshot)
        detail = snapshot["progressDetail"]
        self.assertEqual(detail["reasonCode"], "DATASET_INPUT_DRIFT")
        self.assertEqual(detail["requestId"], snapshot["id"])
        self.assertFalse(detail["retryable"])

    def test_concurrent_admission_accepts_only_one_task(self):
        barrier = threading.Barrier(2)

        def start():
            barrier.wait(timeout=5)
            return _request(
                self.base_url,
                "POST",
                "/api/training/tasks",
                {
                    "batchId": self.batch["id"],
                    "mode": "keyword_analysis",
                    "sourceDatasetId": self.dataset["id"],
                    "config": {"preset": "training_standard"},
                },
            )

        with ThreadPoolExecutor(max_workers=2) as pool:
            responses = [future.result(timeout=10) for future in (pool.submit(start), pool.submit(start))]
        self.assertEqual(sorted(status for status, _ in responses), [202, 409], responses)
        rejected = next(body for status, body in responses if status == 409)
        self.assertEqual(rejected["error"]["code"], "BATCH_NOT_READY")
        accepted = next(body for status, body in responses if status == 202)
        for _ in range(100):
            status, snapshot = _request(self.base_url, "GET", f"/api/training/tasks/{accepted['id']}")
            self.assertEqual(status, 200)
            if snapshot["state"] in {"completed", "failed", "cancelled"}:
                break
            time.sleep(0.1)
        else:
            self.fail("并发准入后的任务未在测试窗口内结束")

    def test_manifest_identity_mismatch_has_structured_task_error(self):
        manifest_path = self.root / self.dataset["datasetPath"] / "manifest.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        manifest["datasetId"] = "dataset_tampered"
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False), encoding="utf-8")
        snapshot = self._start_and_wait()
        self.assertEqual(snapshot["state"], "failed", snapshot)
        detail = snapshot["progressDetail"]
        self.assertEqual(detail["reasonCode"], "DATASET_IDENTITY_MISMATCH")
        self.assertEqual(detail["requestId"], snapshot["id"])
        self.assertFalse(detail["retryable"])


if __name__ == "__main__":
    unittest.main()
