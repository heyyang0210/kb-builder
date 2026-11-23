import importlib.util
import json
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[3] / "tools/repository/purge_deleted_templates.py"
SPEC = importlib.util.spec_from_file_location("purge_deleted_templates", SCRIPT)
purge = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(purge)


class PurgeScriptTest(unittest.TestCase):
    def test_plan_preserves_active_recent_referenced_and_audits(self):
        state = {"templates": [
            {"id": "old", "status": "deleted", "updatedAt": "2026-10-01T00:00:00Z"},
            {"id": "linked", "status": "deleted", "updatedAt": "2026-10-01T00:00:00Z"},
            {"id": "recent", "status": "deleted", "updatedAt": "2026-11-01T00:00:00Z"},
            {"id": "undated", "status": "deleted"},
            {"id": "active", "status": "active"},
        ], "audits": [{"templateId": "old"}]}
        eligible, blocked, invalid, next_state = purge.plan_purge(
            state, {"rules": [{"templateId": "linked"}]}, "2026-11-01")
        self.assertEqual((eligible, blocked, invalid), (["old"], ["linked"], ["undated"]))
        self.assertEqual([item["id"] for item in next_state["templates"]],
                         ["linked", "recent", "undated", "active"])
        self.assertEqual(next_state["audits"], state["audits"])
        self.assertEqual(len(state["templates"]), 5)

    def test_duplicate_ids_and_invalid_arguments_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "重复"):
            purge.plan_purge({"templates": [
                {"id": "same", "status": "deleted"}, {"id": "same", "status": "active"}],
                "audits": []}, {}, "2026-11-01")
        for argv in (["--apply"], ["--before", "2026-02-30"],
                     ["--storage-url", "https://example.com:443"]):
            with self.subTest(argv=argv), self.assertRaises(SystemExit):
                purge.parse_args(argv)

    def test_http_dry_run_conflict_backup_apply_and_readback(self):
        state = {"revision": 7, "payload": {"templates": [
            {"id": "old", "status": "deleted", "updatedAt": "2026-10-01T00:00:00Z",
             "versions": [{"content": "# old"}]},
            {"id": "active", "status": "active"}], "audits": [{"templateId": "old"}]},
            "writes": []}

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                if self.path == "/v1/records/templates/state":
                    self.reply(200, {"success": True, "revision": state["revision"],
                                     "payload": state["payload"]})
                elif self.path == "/v1/records/template-mappings/state":
                    self.reply(200, {"success": True, "revision": 2,
                                     "payload": {"rules": [], "effective": {}}})
                else:
                    self.reply(404, {"success": False})

            def do_PUT(self):
                incoming = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
                state["writes"].append((self.headers["If-Match"], incoming))
                if self.headers["If-Match"] != str(state["revision"]):
                    self.reply(409, {"success": False, "error": {"code": "REVISION_CONFLICT"}})
                else:
                    state["payload"] = incoming
                    state["revision"] += 1
                    self.reply(200, {"success": True, "revision": state["revision"]})

            def reply(self, status, body):
                data = json.dumps(body).encode()
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)

            def log_message(self, *_args):
                pass

        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        url = f"http://127.0.0.1:{server.server_port}"
        try:
            with tempfile.TemporaryDirectory() as directory:
                preview = purge.run(purge.parse_args(["--storage-url", url, "--before", "2026-11-01"]),
                                    Path(directory))
                self.assertEqual(preview["eligible"], ["old"])
                self.assertEqual(state["writes"], [])
                wrong = purge.parse_args(["--storage-url", url, "--before", "2026-11-01", "--apply",
                                          "--expected-revision", "6", "--approval-ref", "test-only"])
                with self.assertRaisesRegex(RuntimeError, "修订号已变化"):
                    purge.run(wrong, Path(directory))
                self.assertEqual(state["writes"], [])
                correct = purge.parse_args(["--storage-url", url, "--before", "2026-11-01", "--apply",
                                            "--expected-revision", "7", "--approval-ref", "test-only"])
                result = purge.run(correct, Path(directory))
                self.assertEqual(state["writes"][0][0], "7")
                self.assertEqual([item["id"] for item in state["payload"]["templates"]], ["active"])
                self.assertEqual(len(state["payload"]["audits"]), 1)
                backup = Path(result["backup"])
                self.assertEqual(backup.stat().st_mode & 0o777, 0o600)
                self.assertEqual(json.loads(backup.read_text())["source"]["revision"], 7)
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)


if __name__ == "__main__":
    unittest.main()
