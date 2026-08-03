# PingCode 素材平台局域网访问设计

## 1. 目标

让本机开发地址 `http://127.0.0.1:5174/pingcode-materials/` 对应的素材平台，可以像文档生成器一样通过局域网地址访问。

## 2. 现状与问题

- Vite 已监听 `0.0.0.0:5174`，在 WSL 内可通过 `172.22.69.74:5174` 访问。
- Windows 地址 `192.168.130.180` 只配置了 `3500` 和 `4100` 到 WSL 的端口转发。
- 当前终端没有 Windows 管理员权限，无法可靠新增 `5174` 的 `netsh portproxy` 和防火墙规则。
- WSL 地址可能在重启后变化，直接增加独立端口转发需要额外维护。

## 3. 基准方案

复用现有局域网网关 `192.168.130.180:3500`：

```text
LAN Browser
  -> http://192.168.130.180:3500/pingcode-materials/
  -> agent-runner/frontend-server.js
       /pingcode-materials/* -> scripts/pingcode/web/frontend/dist/*
       /pingcode-api/*       -> http://127.0.0.1:8001/*
```

优点：

- 不新增 Windows 端口转发和防火墙规则。
- 浏览器只访问一个已开放端口。
- PingCode API 不直接暴露给局域网，通过前端网关转发。
- WSL 内部 IP 变化时，应用配置不需要修改。

## 4. 接口与伪代码

### 4.1 运行时配置

```json
{
  "apiBaseUrl": "/pingcode-api",
  "eventBaseUrl": "/pingcode-api"
}
```

### 4.2 网关路由

```text
if path startsWith /pingcode-api:
    strip prefix
    proxy request and response to 127.0.0.1:8001
else if path startsWith /pingcode-materials:
    serve dist asset
    if route has no file extension, serve index.html
else:
    retain existing prompt-generator static behavior
```

## 5. 验收标准

1. `http://192.168.130.180:3500/pingcode-materials/` 返回素材平台首页。
2. `http://192.168.130.180:3500/pingcode-api/api/health` 返回后端健康状态。
3. 局域网页面可以加载空间列表并执行映射等写请求。
4. 原有 `http://192.168.130.180:3500/prompt-generator.html` 不受影响。
5. 本地 Vite 开发地址继续可用。
