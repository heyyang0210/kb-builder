import os
import unittest
from urllib.request import urlopen


LAN_GATEWAY_BASE = os.getenv("PINGCODE_TEST_LAN_GATEWAY_BASE", "").rstrip("/")


@unittest.skipUnless(LAN_GATEWAY_BASE, "设置 PINGCODE_TEST_LAN_GATEWAY_BASE 后执行局域网网关测试")
class LanGatewayIntegrationTests(unittest.TestCase):
    def assert_page(self, path: str, marker: bytes):
        with urlopen(f"{LAN_GATEWAY_BASE}{path}", timeout=15) as response:
            content = response.read()
            self.assertEqual(response.status, 200)
            self.assertIn(marker, content)

    def test_pingcode_frontend_is_served(self):
        self.assert_page("/pingcode-materials/", b"PingCode")

    def test_pingcode_api_is_proxied(self):
        self.assert_page("/pingcode-api/api/health", b'"status":"ok"')

    def test_prompt_generator_remains_available(self):
        self.assert_page("/prompt-generator.html", "YashanDB".encode("utf-8"))


if __name__ == "__main__":
    unittest.main()
