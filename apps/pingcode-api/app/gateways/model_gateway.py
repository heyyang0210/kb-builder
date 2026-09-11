from __future__ import annotations

import http.client
import json
import re
from collections.abc import Callable, Iterator
from math import ceil
from typing import Any, Protocol
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen


class ModelGateway(Protocol):
    def status(self) -> dict[str, Any]: ...

    def update_config(self, config: dict[str, Any]) -> dict[str, Any]: ...

    def test(self) -> dict[str, Any]: ...

    def chat_json(
        self,
        messages: list[dict[str, str]],
        options: dict[str, Any] | None = None,
    ) -> dict[str, Any]: ...

    def stream_chat(
        self,
        messages: list[dict[str, str]],
        options: dict[str, Any] | None = None,
    ) -> Iterator[dict[str, Any]]: ...


def error_summary(error: BaseException) -> str:
    technical_error = str(error)
    normalized = technical_error.lower()
    if "country, region, or territory not supported" in normalized:
        return "模型服务拒绝访问（HTTP 403，当前网络所在国家或地区不受支持）"
    if re.search(r"\b(http\s*)?401\b", normalized):
        return "模型服务身份认证失败（HTTP 401）"
    if re.search(r"\b(http\s*)?403\b", normalized):
        return "模型服务拒绝访问（HTTP 403）"
    if re.search(r"\b(http\s*)?429\b", normalized):
        return "模型服务请求过于频繁（HTTP 429）"
    if "connection refused" in normalized or "econnrefused" in normalized or "errno 111" in normalized:
        return "模型服务连接失败"
    if "timed out" in normalized or "timeout" in normalized or "超时" in technical_error:
        return "模型调用超时"
    if (
        "jsondecodeerror" in normalized
        or "invalid json" in normalized
        or "expecting value" in normalized
        or "未返回 json 对象" in technical_error.lower()
        or "无法解析为 json" in normalized
        or "不符合输出结构" in technical_error
    ):
        return "模型返回格式不正确"
    http_status = re.search(r"\b(?:http\s*)?(5\d{2})\b", normalized)
    if http_status:
        return f"模型服务暂时不可用（HTTP {http_status.group(1)}）"
    return "模型服务返回错误"


class ModelGatewayError(RuntimeError):
    pass


class HttpModelGatewayAdapter:
    def __init__(
        self,
        base_url: str,
        token: str = "",
        timeout: int = 180,
        *,
        opener: Callable[..., Any] | None = None,
    ):
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.timeout = timeout
        self._opener = opener or urlopen

    def status(self) -> dict[str, Any]:
        return self._request("GET", "/status")

    def update_config(self, config: dict[str, Any]) -> dict[str, Any]:
        return self._request("POST", "/config", config)

    def test(self) -> dict[str, Any]:
        return self._request("POST", "/test", {}, timeout=60)

    def chat_json(
        self,
        messages: list[dict[str, str]],
        options: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        options = options or {}
        request_timeout = self.timeout
        if isinstance(options.get("timeout_ms"), (int, float)):
            attempts = max(1, int(options.get("max_retries", 0)) + 1)
            request_timeout = ceil(options["timeout_ms"] / 1000) * attempts + 10
        result = self._request(
            "POST",
            "/chat",
            {"messages": messages, "responseFormat": "json", "options": options},
            timeout=request_timeout,
        )
        data = result.get("data")
        if not isinstance(data, dict):
            raise ModelGatewayError("模型网关未返回 JSON 对象")
        return result

    def stream_chat(
        self,
        messages: list[dict[str, str]],
        options: dict[str, Any] | None = None,
    ) -> Iterator[dict[str, Any]]:
        options = options or {}
        request_timeout = self.timeout
        if isinstance(options.get("timeout_ms"), (int, float)):
            request_timeout = ceil(options["timeout_ms"] / 1000) + 30

        body = json.dumps(
            {"messages": messages, "options": options},
            ensure_ascii=False,
        ).encode("utf-8")
        headers = {"Content-Type": "application/json"}
        if self.token:
            headers["X-Internal-Token"] = self.token

        parsed_url = urlparse(self.base_url)
        connection = http.client.HTTPConnection(
            parsed_url.hostname,
            parsed_url.port or 80,
            timeout=request_timeout,
        )
        try:
            connection.request("POST", f"{parsed_url.path}/chat/stream", body=body, headers=headers)
            response = connection.getresponse()
            if response.status >= 400:
                detail = response.read().decode("utf-8", errors="replace")
                raise ModelGatewayError(f"模型网关 HTTP {response.status}: {detail}")

            buffer = ""
            while True:
                try:
                    chunk = response.read1(4096) if hasattr(response, "read1") else response.read(4096)
                except Exception:
                    chunk = response.read(4096)
                if not chunk:
                    break
                buffer += chunk.decode("utf-8", errors="replace")
                while "\n\n" in buffer:
                    event_text, buffer = buffer.split("\n\n", 1)
                    for line in event_text.split("\n"):
                        line = line.strip()
                        if line.startswith("data: "):
                            try:
                                yield json.loads(line[6:])
                            except json.JSONDecodeError:
                                pass
        except ModelGatewayError:
            raise
        except Exception as exc:
            raise ModelGatewayError(f"模型网关不可用: {exc}") from exc
        finally:
            try:
                connection.close()
            except Exception:
                pass

    def _request(
        self,
        method: str,
        path: str,
        payload: dict[str, Any] | None = None,
        *,
        timeout: int | None = None,
    ) -> dict[str, Any]:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8") if payload is not None else None
        headers = {"Content-Type": "application/json"}
        if self.token:
            headers["X-Internal-Token"] = self.token
        request = Request(f"{self.base_url}{path}", data=body, method=method, headers=headers)
        try:
            with self._opener(request, timeout=timeout or self.timeout) as response:
                return json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            try:
                message = json.loads(detail).get("error", {}).get("message", detail)
            except json.JSONDecodeError:
                message = detail
            raise ModelGatewayError(f"模型网关 HTTP {exc.code}: {message}") from exc
        except (URLError, TimeoutError, json.JSONDecodeError) as exc:
            raise ModelGatewayError(f"模型网关不可用: {exc}") from exc


ModelGatewayClient = HttpModelGatewayAdapter


__all__ = [
    "HttpModelGatewayAdapter",
    "ModelGateway",
    "ModelGatewayClient",
    "ModelGatewayError",
    "error_summary",
]
