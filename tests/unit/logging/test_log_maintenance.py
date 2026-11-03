import gzip
import json
import os
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[3]
SCRIPT = ROOT / "tools/logging/log_maintenance.py"
sys.path.insert(0, str(ROOT / "tools/logging"))
from log_maintenance import collect, compress, maintenance_lock  # noqa: E402


def read_bundle(bundle):
    manifest = json.loads(subprocess.check_output(["tar", "-xOzf", str(bundle), "manifest.json"], text=True))
    events = [json.loads(line) for line in subprocess.check_output(["tar", "-xOzf", str(bundle), "events.jsonl"], text=True).splitlines()]
    return manifest, events


class LogMaintenanceTest(unittest.TestCase):
    def test_compress_is_gzip_and_active_file_is_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            active = root / "active.log"
            archived = root / "history" / "old.log"
            archived.parent.mkdir()
            active.write_text("active\n", encoding="utf-8")
            archived.write_text("事件 requestId=req-1\n", encoding="utf-8")
            old = time.time() - 48 * 3600
            import os
            os.utime(archived, (old, old))
            result = compress(root, after_hours=24, retention_days=14, retention_bytes=10**9)
            self.assertEqual(result["compressed"], 1)
            self.assertTrue(active.exists())
            self.assertFalse(archived.exists())
            with gzip.open(root / "history" / "old.log.gz", "rt", encoding="utf-8") as stream:
                self.assertIn("req-1", stream.read())
            self.assertEqual(compress(root, 24, 14, 10**9)["compressed"], 0)

    def test_collect_redacts_sensitive_values(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "service.log").write_text(
                'requestId=req-2 password=secret content="private text"\n', encoding="utf-8"
            )
            bundle = collect([root], "req-2", root / "bundle")
            self.assertTrue(bundle.exists())
            listing = subprocess.check_output(["tar", "-xOzf", str(bundle), "events.jsonl"], text=True)
            self.assertIn("[已隐藏]", listing)
            self.assertNotIn("secret", listing)
            self.assertNotIn("private text", listing)

    def test_collect_matches_exact_identifier_expands_correlation_and_sorts_by_time(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            records = [
                {"timestamp": "2026-10-30T10:02:00+00:00", "requestId": "req-10", "event": "wrong"},
                {"timestamp": "2026-10-30T10:03:00+00:00", "requestId": "req-1", "correlationId": "corr-1", "event": "seed-late"},
                {"timestamp": "2026-10-30T10:01:00+00:00", "requestId": "req-2", "correlationId": "corr-1", "event": "related-early"},
                {"timestamp": "2026-10-30T10:04:00+00:00", "requestId": "req-3", "correlationId": "corr-other", "event": "unrelated"},
            ]
            (root / "events.jsonl").write_text("\n".join(map(json.dumps, records)) + "\n", encoding="utf-8")
            manifest, events = read_bundle(collect([root], "req-1", root / "diagnostic"))
            self.assertEqual([json.loads(item["line"])["event"] for item in events], ["related-early", "seed-late"])
            self.assertEqual(manifest["matchedIds"], ["corr-1", "req-1", "req-2"])
            self.assertEqual(manifest["eventCount"], 2)
            self.assertEqual(manifest["timeRange"], {"start": records[2]["timestamp"], "end": records[1]["timestamp"]})

    def test_collect_legacy_identifier_requires_token_boundary(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "legacy.log").write_text("prefix req-7 suffix\nreq-70 should not match\n", encoding="utf-8")
            _, events = read_bundle(collect([root], "req-7", root / "diagnostic"))
            self.assertEqual([event["line"] for event in events], ["prefix req-7 suffix"])

    def test_collect_redacts_quoted_secrets_with_spaces(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "service.log").write_text('requestId=req-quoted password="two word secret" token=\'quoted token value\'\n', encoding="utf-8")
            _, events = read_bundle(collect([root], "req-quoted", root / "diagnostic"))
            output = json.dumps(events, ensure_ascii=False)
            self.assertNotIn("two word secret", output)
            self.assertNotIn("secret", output)
            self.assertNotIn("quoted token value", output)
            self.assertNotIn("value", output)

    def test_old_root_log_is_compressed_but_current_stream_is_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            current = root / "execution.log"
            old = root / "closed-session.log"
            current.write_text("current\n", encoding="utf-8")
            old.write_text("closed\n", encoding="utf-8")
            timestamp = time.time() - 48 * 3600
            import os
            os.utime(old, (timestamp, timestamp))
            result = compress(root, 24, 14, 10**9)
            self.assertEqual(result["compressed"], 1)
            self.assertTrue(current.exists())
            self.assertTrue((root / "closed-session.log.gz").exists())

    def test_retention_age_removes_expired_archives(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            expired = root / "history" / "expired.log.gz"
            expired.parent.mkdir()
            with gzip.open(expired, "wt", encoding="utf-8") as stream:
                stream.write("expired\n")
            old = time.time() - 3 * 86400
            os.utime(expired, (old, old))
            result = compress(root, after_hours=24, retention_days=1, retention_bytes=10**9)
            self.assertEqual(result["deleted"], 1)
            self.assertFalse(expired.exists())

    def test_open_log_file_is_not_compressed(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            archived = root / "history" / "still-open.log"
            archived.parent.mkdir()
            archived.write_text("writer still owns this file\n", encoding="utf-8")
            old = time.time() - 48 * 3600
            os.utime(archived, (old, old))
            with archived.open("a", encoding="utf-8"):
                result = compress(root, after_hours=24, retention_days=14, retention_bytes=10**9)
            self.assertEqual(result["compressed"], 0)
            self.assertTrue(archived.exists())
            self.assertFalse(archived.with_name(archived.name + ".gz").exists())

    def test_file_modified_during_compression_is_left_uncompressed(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            archived = root / "history" / "changing.log"
            archived.parent.mkdir()
            archived.write_text("before\n", encoding="utf-8")
            old = time.time() - 48 * 3600
            os.utime(archived, (old, old))
            original_copy = __import__("shutil").copyfileobj

            def copy_then_append(source, destination, *args, **kwargs):
                original_copy(source, destination, *args, **kwargs)
                with archived.open("a", encoding="utf-8") as stream:
                    stream.write("during compression\n")

            with mock.patch("log_maintenance.shutil.copyfileobj", side_effect=copy_then_append):
                result = compress(root, after_hours=24, retention_days=14, retention_bytes=10**9)
            self.assertEqual(result["failed"], 1)
            self.assertTrue(archived.exists())
            self.assertIn("during compression", archived.read_text(encoding="utf-8"))
            self.assertFalse(archived.with_name(archived.name + ".gz").exists())

    def test_concurrent_compress_waits_for_maintenance_lock(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            started = threading.Event()
            with ThreadPoolExecutor(max_workers=1) as pool:
                with maintenance_lock(root):
                    future = pool.submit(lambda: (started.set(), compress(root, 24, 14, 10**9))[1])
                    self.assertTrue(started.wait(timeout=2))
                    time.sleep(0.1)
                    self.assertFalse(future.done())
                result = future.result(timeout=2)
            self.assertEqual(result["compressed"], 0)

    def test_same_inode_is_collected_once_from_overlapping_roots(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            nested = root / "nested"
            nested.mkdir()
            source = root / "service.log"
            source.write_text('{"timestamp":"2026-10-30T15:00:00.000+08:00","requestId":"req-3"}\n', encoding="utf-8")
            link = nested / "service.log"
            try:
                link.symlink_to(source)
            except OSError:
                self.skipTest("当前文件系统不支持符号链接")
            bundle = collect([root, nested], "req-3", root / "bundle")
            listing = subprocess.check_output(["tar", "-xOzf", str(bundle), "events.jsonl"], text=True)
            self.assertEqual(listing.count("req-3"), 1)


if __name__ == "__main__":
    unittest.main()
