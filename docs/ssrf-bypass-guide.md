# SSRF 私有地址检测绕过指南（内部测试专用）

## 问题背景

平台在抓取网页引用时，会检测目标 URL 解析后的 IP 地址是否为私有网段（`10.x.x.x`、`172.16-31.x.x`、`192.168.x.x` 等）。检测到私有 IP 后拒绝抓取，返回错误：

> 该网址指向非公开网络地址；内部文档请使用管理员配置的来源

## 已应用的三种解决方案

### 方案 A：配置信任域名白名单（推荐，已应用）

**修改文件**：`config/knowledge-center/content-rules.json`

**修改内容**：在 `productionAI.sources.urlOrigins` 中添加 `https://support.yashandb.com`

```json
"urlOrigins": [
  "https://pingcode.yasdb.com",
  "https://support.yashandb.com"
]
```

**原理**：`resolveTarget` 函数中，`trusted` 域名会跳过私有 IP 检查。

**优点**：
- 最小改动，仅修改配置
- 精确控制允许访问的内网站点
- 无需重启服务（配置热加载）

---

### 方案 B：环境变量控制 SSRF 豁免（已应用）

**修改文件**：`packages/agent-runner-core/lib/production-web-reference.js`

**环境变量**：
- `BYPASS_SSRF_PRIVATE=1`：完全跳过私有地址检测（**仅内部测试使用**）
- `EXEMPT_PRIVATE_IPS=192.168.32.23,10.0.0.1`：豁免特定私有 IP

**使用方法**：

```bash
# 方式 1：完全跳过 SSRF 检测（危险，仅测试环境）
BYPASS_SSRF_PRIVATE=1 node server.js

# 方式 2：豁免特定 IP
EXEMPT_PRIVATE_IPS=192.168.32.23 node server.js
```

---

### 方案 C：域名级别豁免（已应用）

**修改文件**：`packages/agent-runner-core/lib/production-web-reference.js`

**环境变量**：
- `EXEMPT_DOMAINS=support.yashandb.com,internal.example.com`：豁免特定域名（支持后缀匹配）

**使用方法**：

```bash
EXEMPT_DOMAINS=support.yashandb.com node server.js
```

---

## 验证方法

```bash
# 测试方案 A：重启服务后直接抓取
npm restart

# 测试方案 B：设置环境变量启动
BYPASS_SSRF_PRIVATE=1 npm start

# 测试方案 C：设置域名豁免
EXEMPT_DOMAINS=support.yashandb.com npm start
```

---

## 安全警告

⚠️ **这些修改仅用于内部测试环境**

- **生产环境严禁使用** `BYPASS_SSRF_PRIVATE=1`
- 方案 A（配置白名单）是唯一适合生产环境的方案
- 方案 B 和 C 的环境变量控制应在测试完成后移除

---

## 回退方法

```bash
# 回退方案 B 和 C
git checkout packages/agent-runner-core/lib/production-web-reference.js

# 回退方案 A：编辑 config/knowledge-center/content-rules.json 移除 support.yashandb.com
```
