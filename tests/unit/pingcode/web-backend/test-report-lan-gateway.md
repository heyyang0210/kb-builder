# PingCode 素材平台局域网网关测试报告

## 测试范围

- `3500` 网关提供 PingCode 前端生产构建。
- `/pingcode-api/` 转发真实素材平台后端 API。
- 原有文档生成器页面保持可访问。
- 通过局域网 IP 执行真实浏览器集成测试。

## 执行结果

- `http://192.168.130.180:3500/pingcode-materials/`：HTTP 200。
- `http://192.168.130.180:3500/pingcode-api/api/health`：返回 `status=ok`。
- `http://192.168.130.180:3500/prompt-generator.html`：HTTP 200。
- PingCode 页面图片预览、加工折叠加载、秒级批次名和附件类型配置：4 个浏览器/API 用例通过。
- 后端单元、真实 API、局域网网关和浏览器全量回归：`28 tests passed`。
- 前端生产构建通过。

执行命令：

```bash
PINGCODE_TEST_LAN_GATEWAY_BASE=http://192.168.130.180:3500 \
python3 -m unittest tests/test_lan_gateway_integration.py -v

PINGCODE_TEST_API_BASE=http://127.0.0.1:8001 \
PINGCODE_TEST_FRONTEND_BASE=http://192.168.130.180:3500 \
python3 -m unittest tests/test_preview_integration.py -v
```
