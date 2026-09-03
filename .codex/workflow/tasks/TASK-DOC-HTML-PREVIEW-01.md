# TASK-DOC-HTML-PREVIEW-01: HTML 文档原生预览与受控资源访问

## 元信息
- 状态: completed
- 分配: doc-writer -> backend-worker -> frontend-worker -> test-engineer -> doc-writer
- 创建: 2026-08-17
- 完成: 2026-08-17
- 预计完成: 2026-08-17
- 预计工时: 4 小时
- 依赖: 无
- 需人类确认: 否（用户已明确批准“受控原文件路由 + 前端 iframe”方案；若实施中改变公共 API、放宽安全边界或引入外部依赖，必须重新确认）
- 可并行: 否（设计、后端契约、前端接入、真实 API 验收和文档收尾按顺序执行）

## SMART 目标

在 2026-08-17 的 4 小时实施窗口内，为文档管理页增加按文件类型分流的预览能力：`.html`、`.htm` 通过独立 iframe 加载注册文档根目录内的原始文件及相对资源，Markdown 保持现有 `marked` 渲染行为；后端拒绝未知根目录、目录目标、路径穿越和符号链接越界。通过真实运行在 `4100` 端口的后端 API 验证响应状态、响应头、中文/空格路径、相对链接、越界防护及 Markdown 回归，并同步设计文档与使用说明。

## 问题定义

当前 `GET /api/document/:id/content` 已返回文件扩展名，但前端忽略 `data.ext`，将所有文件内容统一交给 `marked.parse()` 并注入宿主页面：

```text
完整 HTML -> marked.parse() -> 宿主页面 innerHTML
```

由此产生以下问题：

- HTML 文档的全局 CSS 与文档管理页 CSS 相互覆盖；
- 通过 `innerHTML` 注入的脚本不会按完整页面生命周期运行；
- HTML 内的相对链接不再以源文件所在目录为基准；
- 文档中的代码高亮、图表、动画和交互初始化可能失效。

结论：直接触发问题的是前端未按 `ext` 分流的实现缺陷，根因是预览器设计缺少“文件类型 -> 渲染器”的明确契约，不是本次文件整体显示差异的字符编码问题。

## 已确认的架构决策

用户已确认采用方案一，实施时不得擅自切换为 `iframe.srcdoc` 或继续把完整 HTML 注入宿主 DOM：

```text
文档管理页（3500）
  |
  +-- GET /api/document/:id/content（4100）
  |     返回 ext、content、raw_url 等元数据
  |
  +-- ext = .md/.markdown/其他文本
  |     -> 现有 Markdown 预览器（行为保持不变）
  |
  +-- ext = .html/.htm
        -> iframe src = BACKEND + raw_url
              |
              +-- GET /api/document/raw/:rootId/*（4100）
                    -> 原始 HTML、CSS、JS、图片及同目录页面
                    -> 每次请求均验证注册根目录和真实路径边界
```

架构约束：

1. 原文件入口使用保留目录层级的 URL，而非只返回单个文档内容的 ID 路由，以保证 `L0_01_数学映射.html`、`./assets/app.css` 等相对地址自然解析到原目录。
2. 文档根目录只读取 `agent-runner/config/document-paths.json` 中已注册的 `paths[].id/path`，不得接受客户端传入的绝对路径。
3. 路径安全必须同时校验规范化路径和现存目标的真实路径；仅使用字符串前缀比较不足以阻止符号链接越界。
4. HTML 在 iframe 中运行，与宿主 CSS/DOM 隔离；iframe 默认不授予 `allow-same-origin`，避免文档脚本以 `4100` 后端同源身份访问其他 API。
5. 允许的 sandbox 能力以当前 HTML 展示所需最小集合为准，初始基线为 `allow-scripts allow-forms allow-popups allow-downloads`；能力放宽属于安全决策，需人类确认。
6. 不新增 npm 包，不改变现有 Markdown 保存、编辑、下载和删除接口。
7. `.html` 与 `.htm` 比较统一使用小写扩展名，避免大小写导致错误分流。

## 接口设计

### 1. 原始文件接口

```http
GET /api/document/raw/:rootId/*relativePath
```

示例：

```http
GET /api/document/raw/ai-cognitive/%E6%99%BA%E8%83%BD%E7%9F%A5%E8%AF%86%E5%B9%B3%E5%8F%B0/L0_02_PyTorch%E6%A0%B8%E5%BF%83%E6%9E%B6%E6%9E%84.html
```

成功响应契约：

- 状态码：`200`；
- HTML：`Content-Type: text/html; charset=utf-8`；
- CSS、JavaScript、JSON、SVG、PNG/JPEG/GIF/WebP、字体等由可靠 MIME 解析返回正确类型；
- `Content-Disposition: inline`；
- `X-Content-Type-Options: nosniff`；
- 响应体保持文件原始字节，不经过 Markdown、JSON 或模板包装。

失败响应契约：

| 场景 | 状态码 | 对外信息 |
|---|---:|---|
| `rootId` 未注册 | 404 | 资源不存在或路径无效 |
| 空相对路径、目标不存在或目标是目录 | 404 | 资源不存在 |
| `../`、编码/双重编码越界 | 404 | 资源不存在或路径无效 |
| 根目录内符号链接指向根外 | 404 | 资源不存在或路径无效 |
| 无读取权限或服务器异常 | 500 | 通用错误信息，不泄露绝对路径 |

路由必须注册在 `/:id`、`/:id/content` 等参数路由之前，避免 `raw` 被解释为文档 ID。

### 2. 内容接口的兼容性扩展

现有接口保持 URL 与既有字段不变：

```http
GET /api/document/:id/content
```

在 `data` 中增加只读字段：

```json
{
  "ext": ".html",
  "raw_url": "/api/document/raw/ai-cognitive/%E6%99%BA%E8%83%BD%E7%9F%A5%E8%AF%86%E5%B9%B3%E5%8F%B0/L0_02_PyTorch%E6%A0%B8%E5%BF%83%E6%9E%B6%E6%9E%84.html"
}
```

`raw_url` 必须由服务端根据已解析的 `rootId` 和 `relativePath` 逐段 URL 编码生成，前端不得从展示标题拼接路径。该字段是向后兼容的新增字段，不删除或更名任何既有字段。

## 伪代码

### 后端路径解析与原文件响应

```javascript
function encodePathSegments(relativePath) {
  return relativePath
    .split(path.sep)
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');
}

function resolveRegisteredRawFile(rootId, requestPath) {
  const root = resolveRoots().find(item => item.id === rootId);
  if (!root) return NOT_FOUND;

  const lexicalRoot = path.resolve(root.absPath);
  const lexicalTarget = path.resolve(lexicalRoot, requestPath);
  if (!isPathUnder(lexicalTarget, lexicalRoot)) return NOT_FOUND;
  if (!exists(lexicalTarget) || !isFile(lexicalTarget)) return NOT_FOUND;

  const realRoot = realpath(lexicalRoot);
  const realTarget = realpath(lexicalTarget);
  if (!isPathUnder(realTarget, realRoot)) return NOT_FOUND;

  return realTarget;
}

router.get('/raw/:rootId/*', (req, res) => {
  const file = resolveRegisteredRawFile(req.params.rootId, req.params[0]);
  if (!file) return respondNotFoundWithoutAbsolutePath(res);

  res.set('Content-Disposition', 'inline');
  res.set('X-Content-Type-Options', 'nosniff');
  return sendOriginalFileWithCorrectMimeAndUtf8Html(res, file);
});
```

实现应优先复用 Node/Express 的结构化路径和文件响应 API；MIME 或安全规则如需新增映射，应集中定义或配置，不散落硬编码。若受框架版本限制需硬编码例外，必须在仓库待办文档记录原因与移除条件。

### 前端按扩展名选择渲染器

```javascript
function isHtmlDocument(ext) {
  return ['.html', '.htm'].includes(String(ext || '').toLowerCase());
}

function renderDocContent(doc, mode) {
  hideAllDocumentRenderers();

  if (mode === 'preview' && isHtmlDocument(doc.ext)) {
    htmlFrame.src = new URL(doc.raw_url, BACKEND).href;
    htmlFrame.style.display = 'block';
    return;
  }

  htmlFrame.src = 'about:blank';
  if (mode === 'preview') {
    renderMarkdownWithExistingBehavior(doc.content);
  } else {
    renderExistingEditor(doc.content);
  }
}
```

前端生命周期要求：

- 切换文档、进入编辑模式或关闭预览时清空旧 iframe 地址，防止旧页面脚本继续运行；
- HTML 预览容器占满 `.doc-viewer-content` 的可用宽高，移动端不得出现无意义的双层水平滚动；
- iframe 加载失败时展示中文错误状态，不能以空白页静默失败；
- HTML 只读文档继续隐藏编辑与删除；可写 HTML 若进入编辑模式，仍使用现有源码编辑逻辑，保存成功后重新加载原文件预览；
- Markdown 继续执行 YAML front matter 清理、`marked.parse()` 和特殊代码块渲染，不能因 iframe 分支改变。

## 工作包与文件归属

所有工作包串行执行。后继角色开始前必须重新读取目标文件，禁止依据任务卡中的旧行号直接打补丁。

| 顺序 | 角色 | 工作包 | 独占文件归属 | 完成条件 |
|---:|---|---|---|---|
| 1 | Doc Writer | 先更新设计，固化接口、路径安全、渲染分流和 iframe 生命周期 | `agent-runner/docs/12-文档生成与管理功能设计.md` | 设计文档包含本任务接口与伪代码，代码实现尚未开始 |
| 2 | Backend Worker | 实现受控原文件路由、`raw_url` 和安全响应头 | `agent-runner/routes/document.js` | 语法检查通过，手工真实 API 冒烟通过 |
| 3 | Frontend Worker | 新增 iframe 容器/样式，按 `ext` 分流并处理切换清理、错误状态 | `agent-runner/frontend/prompt-generator.html` | HTML 使用 iframe，Markdown 仍走原渲染器 |
| 4 | Test Engineer | 增加并执行真实 `4100` API 自动化测试和前端回归检查 | `agent-runner/tests/document-api.test.js`；如现有测试结构不适合，可新增 `agent-runner/tests/document-raw-preview-api.test.js` | 测试连接真实服务而非 mock/in-memory app，全部断言通过 |
| 5 | Doc Writer | 根据最终实现更新运行、配置、安全限制和验收说明 | `agent-runner/README.md`，并回查 `agent-runner/docs/12-文档生成与管理功能设计.md` | 文档与最终接口一致，无未来时描述 |

并发约束：同一时刻不得有两个 Worker 修改同一文件；测试阶段发现实现问题时，将问题退回对应 Worker 串行修复，Test Engineer 不直接改业务文件。

## 测试设计

### 环境前置

1. 使用仓库现有启动方式运行后端，确认 `GET http://localhost:4100/api/health` 成功；不得使用 mock、supertest 内存应用或伪造响应替代真实 API。
2. 使用 `agent-runner/config/document-paths.json` 中已注册的 `ai-cognitive` 根目录：`/data/docs/ai 体系认知`。
3. 主验收文件为 `/data/docs/ai 体系认知/智能知识平台/L0_02_PyTorch核心架构.html`。
4. 测试不得修改或删除主验收文件；需要构造符号链接时，只在可控测试目录创建并在 `finally` 中精确清理。

### 真实 API 必测矩阵

| 编号 | 请求/操作 | 必须断言 |
|---|---|---|
| API-RAW-01 | 请求主验收 HTML 的 `raw_url` | `200`；`Content-Type` 含 `text/html` 和 `charset=utf-8`；`Content-Disposition` 为 `inline`；`nosniff` 存在；响应体包含原文档标题/标识 |
| API-RAW-02 | 从返回 HTML 中选择一个实际相对链接，按 iframe 当前 URL 解析后再次请求 | 解析结果仍位于 `/api/document/raw/ai-cognitive/智能知识平台/`；目标存在时返回 `200`，证明目录语义保留 |
| API-RAW-03 | 请求中文、空格文件或同目录静态资源 | URL 编码后可访问，响应字节和 MIME 正确 |
| API-RAW-04 | 请求未知 `rootId`、不存在文件、目录路径 | 均为 `404`，响应不泄露服务器绝对路径 |
| API-SEC-01 | 请求明文 `../`、`..%2F`、`%252e%252e` 等越界变体 | 均不能读取注册根目录外文件，返回 `404` 或框架层安全拒绝状态 |
| API-SEC-02 | 在测试目录放置指向根外文件的符号链接后请求 | 不返回目标内容，返回 `404`；测试资源精确清理 |
| API-COMPAT-01 | 调用现有 `/:id/content` 获取 HTML | 既有字段保留；`ext` 为 `.html`；`raw_url` 是可请求的后端相对 URL |
| API-COMPAT-02 | 调用现有 Markdown 内容接口 | `200`；内容和 `ext` 正确；既有 JSON 契约不回退 |

测试请求工具必须保留响应 headers 和原始 Buffer，不能只尝试 `JSON.parse()`，否则无法验证二进制资源和 `Content-Type`。

### 前端回归检查

- 打开文档管理页并选择 `L0_02_PyTorch核心架构.html`，DOM 中显示 iframe，iframe `src` 指向 `4100` 的 `raw_url`，Markdown 容器不注入该 HTML 源码；
- iframe 内页面保留自身布局、样式、脚本初始化和同目录导航，宿主页面导航及工具栏样式不被覆盖；
- 从 HTML 切换到 Markdown 后 iframe 被清空/隐藏，Markdown 标题、表格、代码块与特殊代码块仍正常渲染；
- 从一个 HTML 快速切换到另一个文档，不出现旧 iframe 延迟加载覆盖当前文档；
- 在桌面和窄屏尺寸检查 iframe 填充、滚动和工具栏，不发生内容重叠；
- 前端所有新增可见文本使用中文。

## 验收标准

- [x] `agent-runner/docs/12-文档生成与管理功能设计.md` 在功能代码之前完成接口、伪代码、安全边界和渲染决策更新。
- [x] `GET /api/document/raw/:rootId/*relativePath` 仅能读取已注册根目录内的普通文件，并保留源目录层级与文件原始字节。
- [x] 主验收 HTML 返回 `200`、UTF-8 HTML MIME、inline 和 nosniff 响应头；相对链接以“智能知识平台”目录为基准正确解析。
- [x] 未注册根、路径穿越、编码越界、符号链接越界、目录和不存在目标均不能读取文件，也不泄露绝对路径。
- [x] `GET /api/document/:id/content` 向后兼容并返回服务端生成的 `raw_url`。
- [x] `.html`/`.htm` 在文档管理页通过独立 iframe 展示，CSS、脚本和 DOM 生命周期不再与宿主页混用。
- [x] iframe 未授予 `allow-same-origin`；任何进一步权限放宽均有单独安全审批记录。
- [x] Markdown 的预览、编辑、保存、下载和特殊代码块渲染行为无回归。
- [x] 自动化测试真实调用后端（备用验证端口 4410，生产端口契约保持 4100），并覆盖响应头、中文/空格路径、相对链接、路径穿越、符号链接和 Markdown 回归。
- [x] 不引入新的 npm/Python/外部服务依赖，不修改无关功能。
- [x] `agent-runner/README.md` 和设计文档与最终行为、接口及安全限制一致。
- [x] 对所有本次修改执行 `git diff --check`，并对 JavaScript/HTML 执行语法检查；既有无关问题单独报告。

## 明确不在范围内

- 不修复 `L0_02_PyTorch核心架构.html` 或相邻历史文档中已有的乱码文件名/链接；
- 不实现 `iframe.srcdoc` 备选方案；
- 不将任意本机绝对路径暴露为静态目录；
- 不新增 PDF、Office、音视频等其他格式预览器；
- 不重构文档管理页无关布局、图标、编辑器或搜索功能；
- 不改变 `document-paths.json` 现有根目录配置，除非真实环境缺失 `ai-cognitive` 且经人类确认。

## 风险与控制

| 风险 | 控制措施 |
|---|---|
| 原始 HTML 执行不可信脚本 | iframe sandbox 最小授权，不启用 `allow-same-origin`；后端只开放注册根目录 |
| 字符串路径校验被符号链接绕过 | 对存在的根和目标执行 `realpath` 后再次做目录边界判断 |
| Express 参数路由吞掉 `/raw` | 原文件路由定义在所有 `/:id` 路由之前，并增加真实 API 回归 |
| 相对链接丢失目录语义 | raw URL 保留 `rootId/relativePath` 全目录结构，不使用文档 ID 作为目录基址 |
| HTML/Markdown 模式状态串扰 | 每次切换先隐藏全部渲染器并清理 iframe，再激活唯一目标渲染器 |
| API 测试误伤用户文件 | 主验收文件只读；测试产物使用唯一名称并在 `finally` 中精确清理 |

## 参考文档与代码

- `agent-runner/docs/12-文档生成与管理功能设计.md`
- `agent-runner/README.md`
- `agent-runner/routes/document.js`
- `agent-runner/frontend/prompt-generator.html`
- `agent-runner/tests/document-api.test.js`
- `agent-runner/config/document-paths.json`
- `/data/docs/ai 体系认知/智能知识平台/L0_02_PyTorch核心架构.html`

## 预计变更文件

- `.codex/workflow/tasks/TASK-DOC-HTML-PREVIEW-01.md`（本 Planner 阶段新增）
- `agent-runner/docs/12-文档生成与管理功能设计.md`（后续修改）
- `agent-runner/routes/document.js`（后续修改）
- `agent-runner/frontend/prompt-generator.html`（后续修改）
- `agent-runner/tests/document-api.test.js` 或 `agent-runner/tests/document-raw-preview-api.test.js`（后续修改/新增，二选一）
- `agent-runner/README.md`（后续修改）

## 执行日志

- 2026-08-17 Planner：用户已确认方案一；完成 SMART 拆解，冻结原文件接口、iframe 分流、安全边界、文件归属和真实 `4100` API 验收矩阵。
- 2026-08-17 Doc Writer：补充 HTML 原生预览设计、raw 接口、路径安全和 iframe 生命周期。
- 2026-08-17 Backend Worker：实现注册根目录内原文件路由、realpath 边界检查、MIME/inline/nosniff 响应和 `raw_url`。
- 2026-08-17 Frontend Worker：HTML/HTM 分流至 sandbox iframe，Markdown 保持原渲染，切换时清理 iframe。
- 2026-08-17 Test Engineer：真实 API 验证主 HTML、同目录相对链接、响应头、越界、双重编码、目录、符号链接和 Markdown 兼容；全部通过。
- 2026-08-17 Doc Writer：同步 agent-runner README，记录预览分流、raw 接口和安全边界。

## 变更文件

- `agent-runner/docs/12-文档生成与管理功能设计.md`
- `agent-runner/routes/document.js`
- `agent-runner/frontend/prompt-generator.html`
- `agent-runner/tests/document-raw-preview-api.test.js`
- `agent-runner/README.md`
