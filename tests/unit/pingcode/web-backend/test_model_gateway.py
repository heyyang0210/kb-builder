import json
import socket
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

from app.gateways.model_gateway import (
    HttpModelGatewayAdapter,
    ModelGatewayClient,
    ModelGatewayError,
)


class GatewayTestServer(ThreadingHTTPServer):
    def __init__(self, server_address):
        super().__init__(server_address, GatewayRequestHandler)
        self.requests: list[dict[str, Any]] = []
        self.responses: dict[str, dict[str, Any]] = {}


class GatewayRequestHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def do_GET(self):
        self._handle_request()

    def do_POST(self):
        self._handle_request()

    def _handle_request(self):
        content_length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(content_length) if content_length else b""
        body = json.loads(raw_body.decode("utf-8")) if raw_body else None
        self.server.requests.append({
            "method": self.command,
            "path": self.path,
            "headers": dict(self.headers.items()),
            "body": body,
        })

        response = self.server.responses.get(self.path, {
            "status": 404,
            "body": {"error": {"message": "not found"}},
        })
        if "sse_chunks" in response:
            self._write_sse(response)
            return
        self._write_response(response)

    def _write_response(self, response):
        status = response.get("status", 200)
        body = response.get("body", {})
        if isinstance(body, bytes):
            payload = body
        elif isinstance(body, str):
            payload = body.encode("utf-8")
        else:
            payload = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", response.get("content_type", "application/json; charset=utf-8"))
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _write_sse(self, response):
        self.send_response(response.get("status", 200))
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Transfer-Encoding", "chunked")
        self.end_headers()
        for chunk in response["sse_chunks"]:
            payload = chunk.encode("utf-8") if isinstance(chunk, str) else chunk
            self.wfile.write(f"{len(payload):X}\r\n".encode("ascii"))
            self.wfile.write(payload)
            self.wfile.write(b"\r\n")
            self.wfile.flush()
        self.wfile.write(b"0\r\n\r\n")
        self.wfile.flush()

    def log_message(self, format, *args):
        return


class ModelGatewayContractTests(unittest.TestCase):
    def setUp(self):
        self.server = GatewayTestServer(("127.0.0.1", 0))
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        host, port = self.server.server_address
        self.base_url = f"http://{host}:{port}"

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)

    def client(self, **kwargs):
        return HttpModelGatewayAdapter(self.base_url, **kwargs)

    def test_compatibility_alias_points_to_http_adapter(self):
        self.assertIs(ModelGatewayClient, HttpModelGatewayAdapter)

    def test_status_config_and_test_preserve_paths_and_bodies(self):
        self.server.responses.update({
            "/status": {"body": {"configured": True}},
            "/config": {"body": {"updated": True}},
            "/test": {"body": {"ok": True}},
        })
        client = self.client()

        self.assertEqual(client.status(), {"configured": True})
        self.assertEqual(client.update_config({"model": "local-model"}), {"updated": True})
        self.assertEqual(client.test(), {"ok": True})

        self.assertEqual(
            [(item["method"], item["path"], item["body"]) for item in self.server.requests],
            [
                ("GET", "/status", None),
                ("POST", "/config", {"model": "local-model"}),
                ("POST", "/test", {}),
            ],
        )

    def test_chat_json_returns_complete_response_and_preserves_request(self):
        response = {
            "data": {"keywords": ["数据字典"]},
            "usage": {"total_tokens": 42},
            "requestId": "request-1",
        }
        self.server.responses["/chat"] = {"body": response}
        messages = [{"role": "user", "content": "分析关键词"}]
        options = {"temperature": 0.1, "timeout_ms": 1000, "max_retries": 0}

        actual = self.client().chat_json(messages, options)

        self.assertEqual(actual, response)
        self.assertEqual(self.server.requests[0]["body"], {
            "messages": messages,
            "responseFormat": "json",
            "options": options,
        })

    def test_chat_json_rejects_non_object_data(self):
        for invalid_data in (None, [], "text"):
            with self.subTest(data=invalid_data):
                self.server.responses["/chat"] = {"body": {"data": invalid_data}}
                with self.assertRaisesRegex(ModelGatewayError, "模型网关未返回 JSON 对象"):
                    self.client().chat_json([])

    def test_internal_token_header_is_sent_only_when_configured(self):
        self.server.responses["/status"] = {"body": {"ok": True}}

        self.client(token="secret-token").status()
        self.client(token="").status()

        headers_with_token = self.server.requests[0]["headers"]
        headers_without_token = self.server.requests[1]["headers"]
        self.assertEqual(headers_with_token.get("X-Internal-Token"), "secret-token")
        self.assertNotIn("X-Internal-Token", headers_without_token)

    def test_http_error_is_wrapped_with_status_and_remote_message(self):
        self.server.responses["/status"] = {
            "status": 429,
            "body": {"error": {"message": "请求过于频繁"}},
        }

        with self.assertRaises(ModelGatewayError) as raised:
            self.client().status()

        self.assertIn("模型网关 HTTP 429", str(raised.exception))
        self.assertIn("请求过于频繁", str(raised.exception))

    def test_invalid_json_is_wrapped_as_gateway_unavailable(self):
        self.server.responses["/status"] = {
            "body": "not-json",
            "content_type": "text/plain",
        }

        with self.assertRaises(ModelGatewayError) as raised:
            self.client().status()

        self.assertIn("模型网关不可用", str(raised.exception))

    def test_connection_failure_is_wrapped_as_gateway_unavailable(self):
        with socket.socket() as probe:
            probe.bind(("127.0.0.1", 0))
            unused_port = probe.getsockname()[1]

        client = HttpModelGatewayAdapter(f"http://127.0.0.1:{unused_port}", timeout=1)
        with self.assertRaises(ModelGatewayError) as raised:
            client.status()

        self.assertIn("模型网关不可用", str(raised.exception))

    def test_stream_reassembles_cross_chunk_events_skips_invalid_json_and_stops_at_eof(self):
        self.server.responses["/chat/stream"] = {
            "sse_chunks": [
                'data: {"delta":"关',
                '键词"}\n\ndata: not-json\n\n',
                'event: ignored\ndata: {"finish":true}\n\n',
            ],
        }
        messages = [{"role": "user", "content": "过滤"}]
        options = {"timeout_ms": 1000}

        events = list(self.client().stream_chat(messages, options))

        self.assertEqual(events, [{"delta": "关键词"}, {"finish": True}])
        self.assertEqual(self.server.requests[0]["path"], "/chat/stream")
        self.assertEqual(self.server.requests[0]["body"], {
            "messages": messages,
            "options": options,
        })

    def test_stream_sends_internal_token(self):
        self.server.responses["/chat/stream"] = {
            "sse_chunks": ['data: {"finish":true}\n\n'],
        }

        self.assertEqual(
            list(self.client(token="stream-secret").stream_chat([])),
            [{"finish": True}],
        )
        self.assertEqual(
            self.server.requests[0]["headers"].get("X-Internal-Token"),
            "stream-secret",
        )

    def test_stream_http_error_is_wrapped_with_status(self):
        self.server.responses["/chat/stream"] = {
            "status": 502,
            "body": {"error": {"message": "upstream unavailable"}},
        }

        with self.assertRaises(ModelGatewayError) as raised:
            list(self.client().stream_chat([]))

        self.assertIn("模型网关 HTTP 502", str(raised.exception))


if __name__ == "__main__":
    unittest.main()
