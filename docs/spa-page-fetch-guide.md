# SPA 页面抓取解决方案

## 问题根因

`support.yashandb.com` 是 **SPA（单页应用）**，存在两个问题：

1. **动态渲染**：页面内容通过 JavaScript 加载，`<div id="app"></div>` 初始为空，cheerio 无法提取正文
2. **需要登录认证**：API 接口 `/api/knowledge/KB-V4N4-YNJ6` 返回"未登录或登录已过期"

## 已应用的三种解决方案

### 方案 1：Puppeteer 浏览器渲染（推荐）

**原理**：使用 Puppeteer 启动无头浏览器，等待 JavaScript 执行完成后提取渲染后的 HTML。

**修改文件**：`packages/agent-runner-core/lib/production-web-reference.js`

**安装依赖**：
```bash
cd packages/agent-runner-core
npm install puppeteer
```

**使用方法**：
```bash
# 重启服务即可，代码会自动检测 SPA 页面并使用 Puppeteer 渲染
npm restart
```

**优点**：
- 自动检测 SPA 页面（检测 `<div id="app"></div>` 空容器）
- 无需额外配置
- 支持所有 JavaScript 渲染的页面

**缺点**：
- 需要安装 Puppeteer（约 200MB）
- 渲染速度较慢（3-10 秒）

---

### 方案 2：API Token 认证

**原理**：通过 Bearer Token 或 Cookie 直接访问 API 接口获取内容，绕过页面渲染。

**环境变量**：
- `SUPPORT_API_TOKEN`：API Bearer Token
- `SUPPORT_COOKIE`：登录 Cookie

**使用方法**：

```bash
# 方式 1：使用 API Token
SUPPORT_API_TOKEN=your_token_here npm start

# 方式 2：使用 Cookie
SUPPORT_COOKIE="session_id=xxx; auth_token=yyy" npm start

# 方式 3：在配置文件中设置
# 编辑 config/knowledge-center/content-rules.json，添加：
# "productionAI": {
#   "sources": {
#     "supportApiToken": "your_token_here",
#     "supportCookie": "session_id=xxx"
#   }
# }
```

**获取 Token/Cookie 的方法**：
1. 在浏览器中登录 `support.yashandb.com`
2. 打开开发者工具（F12）→ Network 标签
3. 刷新页面，找到 `/api/knowledge/...` 请求
4. 查看 Request Headers 中的 `Authorization` 或 `Cookie`

**优点**：
- 速度快（直接 API 调用）
- 无需浏览器渲染
- 适合批量抓取

**缺点**：
- 需要手动获取 Token/Cookie
- Token 可能过期，需要定期更新

---

### 方案 3：SSR 预渲染服务

**原理**：部署独立的 SSR 预渲染服务（如 Prerender.io、Rendertron），将 SPA 页面转换为静态 HTML。

**环境变量**：
- `SSR_SERVICE_URL`：SSR 服务地址，例如 `http://localhost:3000/render`

**使用方法**：

```bash
# 1. 部署 SSR 服务（以 Rendertron 为例）
docker run -d -p 3000:3000 googlechrome/rendertron

# 2. 设置环境变量启动平台
SSR_SERVICE_URL=http://localhost:3000/render npm start
```

**SSR 服务部署选项**：

| 服务 | 部署方式 | 说明 |
|------|---------|------|
| Rendertron | Docker | Google 开源，免费 |
| Prerender.io | SaaS | 商业服务，有免费额度 |
| Puppeteer SSR | 自建 | 使用 Puppeteer 搭建简单服务 |

**自建 Puppeteer SSR 服务示例**：
```javascript
// ssr-server.js
const express = require('express');
const puppeteer = require('puppeteer');
const app = express();

let browser;
(async () => { browser = await puppeteer.launch(); })();

app.get('/render', async (req, res) => {
  const url = req.query.url;
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle0' });
  const html = await page.content();
  await page.close();
  res.send(html);
});

app.listen(3000);
```

**优点**：
- 集中管理渲染服务
- 可缓存渲染结果
- 适合大规模使用

**缺点**：
- 需要额外部署服务
- 增加架构复杂度

---

## 验证方法

### 测试方案 1（Puppeteer）

```bash
# 安装 Puppeteer
cd packages/agent-runner-core
npm install puppeteer

# 重启服务
npm restart

# 在平台中尝试抓取 https://support.yashandb.com/knowledge/KB-V4N4-YNJ6
# 应该可以成功读取内容（首次可能需要 5-10 秒渲染时间）
```

### 测试方案 2（API Token）

```bash
# 获取 Token（浏览器开发者工具）
# 设置环境变量启动
SUPPORT_API_TOKEN=your_token npm start

# 测试抓取
```

### 测试方案 3（SSR 服务）

```bash
# 启动 SSR 服务
docker run -d -p 3000:3000 googlechrome/rendertron

# 设置环境变量启动平台
SSR_SERVICE_URL=http://localhost:3000/render npm start
```

---

## 推荐方案

| 场景 | 推荐方案 | 理由 |
|------|---------|------|
| 内部测试，快速验证 | 方案 1（Puppeteer） | 无需额外配置，自动检测 |
| 生产环境，长期运行 | 方案 2（API Token） | 速度快，稳定性高 |
| 大规模抓取，多站点 | 方案 3（SSR 服务） | 集中管理，可缓存 |

---

## 安全警告

⚠️ **Token/Cookie 安全**

- 不要将 Token/Cookie 提交到 Git 仓库
- 使用环境变量或密钥管理服务存储
- 定期轮换 Token/Cookie
- 生产环境使用 HTTPS 传输

---

## 回退方法

```bash
# 回退所有修改
git checkout packages/agent-runner-core/lib/production-web-reference.js

# 卸载 Puppeteer（如果使用方案 1）
cd packages/agent-runner-core
npm uninstall puppeteer
```
