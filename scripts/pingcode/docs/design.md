# PingCode 素材下载系统设计

> 版本：v2.4  
> 日期：2026-07-23  
> 状态：Phase 3 完成

## 概述

基于 PingCode REST API 的空间级素材下载系统，支持：
- 多空间批量下载（YASSTORAGE、YASDOC 等）
- 目录树构建与索引生成
- 附件批量下载（多线程）
- 页面内容提取（优先 Markdown）
- 页面内图片原文件下载、相对路径引用和资源审计
- 筛选策略（按文件类型、关键词、深度等）
- 已有数据整合

## 实施阶段

| 阶段 | 内容 | 状态 |
|------|------|------|
| Phase 1 | API 客户端 + 树构建器 | ✅ 完成 |
| Phase 2 | 文件名工具 + 空间爬虫 | ✅ 完成 |
| Phase 3 | 索引生成 + 已有数据整合 | ✅ 完成 |
| Phase 4 | CLI 完善 + 文档更新 | 🔄 进行中 |
| Phase 5 | 集成测试 + 优化 | ⏳ 待开始 |

## 常见问题与解决方案

### 1. 文件名问题

| 问题 | 解决方案 |
|------|----------|
| URL 编码文件名 | `urllib.parse.unquote()` 解码 |
| 重复文件名 | 添加页面上下文前缀：`{page_name}/{filename}` |
| 非法字符 | 正则替换为 `_` |
| 文件名过长 | 截断 + hash 后缀 |
| 空文件名 | 从 URL 提取或使用 `{page_id}_{index}.{ext}` |
| 无扩展名 | 从 Content-Type 推断 |

### 2. 编码问题

| 问题 | 解决方案 |
|------|----------|
| UTF-8 BOM | 读取时指定 `encoding='utf-8-sig'` |
| 混合编码 | 统一转 UTF-8，失败字符用 `?` 替换 |
| 零宽字符 | 正则清理 `\u200b\u200c\u200d\ufeff` |
| Emoji 标题 | 保留（UTF-8 支持） |

### 3. API 问题

| 问题 | 解决方案 |
|------|----------|
| Session 过期 | 定期检测登录状态，自动重登录 |
| 响应结构不一致 | 类型判断，统一处理（dict/list） |
| 字段缺失 | 不依赖单一字段，综合判断 |
| 分页无效 | 接受 1000 条限制，记录警告 |
| 速率限制 | 请求间隔 0.5-1 秒，指数退避 |

### 4. 下载问题

| 问题 | 解决方案 |
|------|----------|
| Token 过期 | 重新获取附件列表刷新 token |
| 大文件内存 | 流式写入，分块下载 |
| 部分下载 | 校验文件大小，失败重试 |
| 并发冲突 | API 请求串行，文件 I/O 并行 |

### 5. 线程安全

| 问题 | 解决方案 |
|------|----------|
| Playwright 非线程安全 | API 调用在主线程，仅文件写入并行 |
| Cookie 竞争 | 单线程管理会话 |
| 文件写入冲突 | 加锁或串行化 |

### 6. 数据质量

| 问题 | 解决方案 |
|------|----------|
| 空页面 | `skip_empty` 策略跳过 |
| 草稿页面 | 检查 `is_published` 字段 |
| 已删除页面 | 过滤 `is_deleted=1` |
| 权限受限 | 捕获 403 错误，记录日志 |

### 7. 文件系统

| 问题 | 解决方案 |
|------|----------|
| 磁盘空间不足 | 预检查空间，监控用量 |
| 路径深度限制 | 限制目录深度，扁平化长路径 |
| 大小写敏感 | 统一小写或保留原样 |

### 8. 内存问题

| 问题 | 解决方案 |
|------|----------|
| 页面数据累积 | 分批处理，及时释放 |
| 文件内容缓存 | 流式处理，写完即释放 |

## 设计决策

### 1. API 鉴权方式

**决策**：复用浏览器 Cookie

**实现**：
- `client.py` 启动浏览器完成 CAS 登录
- `api_client.py` 通过 `page.evaluate()` 发送 API 请求（自动携带 Cookie）
- 定期检测登录状态，过期自动重登录

### 1.1 登录入口与空间隔离

**决策**：登录入口只允许使用中性的 `{base_url}/wiki`，或当前下载批次所属空间的 `{base_url}/wiki/spaces/{spaceKey}`。

**原因**：`config/pingcode.json` 的 `targets[0]` 可能指向任意历史空间，不能作为全局登录入口。若 YASDOC 批次复用 YASSTORAGE 的目标页触发 CAS 登录，登录完成后可能被路由到错误空间，造成下载任务访问非预期页面。

**实现**：
- `PingCodeClient` 支持显式 `login_url`；未传入时使用 `{base_url}/wiki`。
- Web 下载任务调用 PingCode API 时传入批次 `space_key`，服务端按当前空间构造登录入口。
- 已初始化的浏览器 API 会话如果属于其他空间，需要关闭旧上下文并按当前空间重新初始化。
- 同步 Playwright 调用只在线程池单 worker 中串行执行；服务关闭后再次调用时重建线程池，避免 executor 关闭后无法提交任务。

### 1.2 反爬虫与风控边界

**决策**：系统只做低并发、会话复用和明确失败提示，不绕过验证码、二次认证或 PingCode 风控。

**原因**：PingCode 原始页面可能存在登录态过期、验证码、限流、403/429、页面加载超时等风控策略。盲目重试会放大风险，也会掩盖真实问题。

**实现**：
- API 请求保持串行，文件下载与写入才并行。
- 遇到登录页、验证码、403/429 或连续超时时，任务应暴露为需要人工刷新浏览器会话或降低下载范围/频率。
- `Page.goto` 超时时必须检查目标 URL 是否属于当前批次空间，避免把风控问题和跨空间路由问题混在一起。

### 2. 页面内容格式

**决策**：优先 Markdown，效果差则用 HTML

**实现**：
- `content_parser.py` 解析 Slate.js 块结构 → Markdown
- 支持 `document` 为 dict（numeric keys）或 list（块数组）
- 解析失败回退到纯文本提取
- 最终兜底：浏览器爬取（已有 `crawler.py`）

页面内 `image` 节点通过公共图片短期令牌下载到批次 `assets/` 目录，Markdown 写入相对路径；图片失败进入资源错误清单并增加任务告警。详细接口、安全约束和验收方式见 `agent-runner/docs/29-PingCode下载图片保真与统一文档预览设计.md`。

### 3. 分页与并发

**决策**：API 请求串行 + 文件 I/O 并行

**原因**：Playwright Page 对象非线程安全，不能多线程共用

**实现**：
- API 调用（获取页面、附件列表）在主线程串行执行
- 文件下载和写入使用 `ThreadPoolExecutor` 并行
- 默认并发数：5 个线程

### 4. 索引用途

**决策**：为 AI 训练提供结构化输入

**索引字段**：
```json
{
    "space_key": "YASSTORAGE",
    "space_name": "YashanDB 存储引擎",
    "total_pages": 1000,
    "total_attachments": 150,
    "tree": {...},
    "pages": [
        {
            "id": "xxx",
            "name": "内幕文档",
            "breadcrumb": ["存储引擎", "内幕文档"],
            "attachment_count": 60,
            "attachments": [
                {
                    "title": "索引内幕文档.docx",
                    "size": 304297,
                    "local_path": "files/索引内幕文档.docx"
                }
            ],
            "word_count": 0,
            "updated_at": "2024-01-04",
            "content_path": "pages/内幕文档.md"
        }
    ]
}
```

### 5. 已有数据整合

**决策**：将 `refs/pingcode/YASSTORAGE_内幕文档/` 整合到新结构

**迁移方案**：
```
refs/pingcode/YASSTORAGE_内幕文档/  →  scripts/pingcode/data/YASSTORAGE/files/
refs/pingcode/YASSTORAGE 知识库.md  →  scripts/pingcode/data/YASSTORAGE/pages/内幕文档.md
```

**迁移结果**：
- ✅ 43 个附件文件已迁移（10.9 MB）
- ✅ 页面内容已迁移

## 系统架构

### 目录结构

```
scripts/pingcode/
├── core/
│   ├── config.py          # 配置管理
│   ├── client.py          # CAS 登录客户端（浏览器）
│   ├── api_client.py      # PingCode API 客户端 ✅
│   ├── tree_builder.py    # 目录树构建器 ✅
│   ├── content_parser.py  # 文档内容解析器 ✅
│   ├── filename_utils.py  # 文件名处理工具 ✅
│   ├── space_crawler.py   # 空间级爬虫 ✅
│   ├── index_builder.py   # 索引生成器 ✅
│   ├── crawler.py         # 页面爬取（浏览器方式）
│   ├── downloader.py      # 文件下载器
│   └── pipeline.py        # 单页面流水线
│
├── cli/
│   ├── pipeline.py        # 单页面流水线 CLI
│   ├── browser.py         # 浏览器工具 CLI
│   ├── space_crawl.py     # 空间级爬取 CLI ✅
│   └── migrate_data.py    # 数据迁移工具 ✅
│
├── examples/
│   ├── demo_crawl.py
│   └── demo_download.py
│
├── tests/
│   ├── demo_test.py
│   └── test_api_client.py
│
── docs/
│   ├── usage.md
│   ├── design.md          # 本文件
│   └── implementation-plan.md
│
├── config/
│   └── pingcode.json
│
└── data/
    ── YASSTORAGE/
        ├── files/         # 43 个附件文件 ✅
        └── pages/         # 内幕文档.md ✅
```

### 核心模块

#### `api_client.py` — API 客户端 ✅

```python
class PingCodeAPIClient:
    def __init__(self, page: Page, base_url: str)
    def get_space(self, space_key: str) -> dict
    def get_pages(self, space_key: str, limit: int = 1000) -> list[dict]
    def get_page(self, page_id: str) -> dict
    def get_attachments(self, page_id: str) -> list[dict]
    def download_attachment(self, attachment: dict) -> bytes
```

#### `tree_builder.py` — 目录树构建器 ✅

```python
class TreeBuilder:
    def build(self, pages: list[dict]) -> list[TreeNode]
    def get_breadcrumb(self, page_id: str) -> list[str]
    def to_markdown(self, roots: list[TreeNode]) -> str
```

#### `content_parser.py` — 内容解析器 ✅

```python
class ContentParser:
    def parse_document(self, document) -> str  # 支持 Slate.js 格式
    def parse_block(self, block: dict) -> str
    def fallback_to_text(self, document) -> str
```

#### `filename_utils.py` — 文件名工具 ✅

```python
class FilenameUtils:
    @staticmethod
    def sanitize(filename: str) -> str
    @staticmethod
    def decode_url(filename: str) -> str
    @staticmethod
    def unique_filename(path: Path) -> Path
    @staticmethod
    def truncate(filename: str, max_len: int) -> str
```

#### `space_crawler.py` — 空间级爬虫 ✅

```python
class SpaceCrawler:
    def __init__(self, config: PingCodeConfig, output_dir: Path, strategy: dict)
    def crawl_space(self, space_key: str) -> CrawlResult
    def _crawl_pages(self, pages: list[dict], pages_dir: Path, files_dir: Path) -> list[dict]
```

#### `index_builder.py` — 索引生成器 ✅

```python
class IndexBuilder:
    def __init__(self, space_key: str, space_name: str, tree: list[TreeNode], pages: list[dict])
    def build_index(self) -> dict
    def save_json(self, path: Path)
    def save_markdown(self, path: Path)
    def merge_existing_files(self, existing_dir: Path, target_dir: Path) -> dict
```

## 源文件加工预览信息架构

素材平台的“源文件加工预览”弹窗采用高密度 Cockpit 布局，目标是在 1366px 宽度下让用户一屏完成“是否可解析、解析到什么、转换是否保真”的判断。

### 设计原则

- 减少鼠标移动距离：文件名、格式、大小、状态集中在弹窗头部，切换入口紧贴标题区。
- 零冗余留白：总览页不再使用大 hero 与大指标卡，改为紧凑表格、徽章和诊断流。
- 减少信息冗余：Markdown 特征只在“源文件 → Markdown 保真”区展示一次，避免与结构特征重复。
- 诊断优先：默认展示结构特征矩阵、解析诊断、转换保真三栏；SHA、MIME、来源路径等低频审计字段默认折叠。

### 总览布局

```text
标题栏：文件名 + 格式 + 大小 + 处理状态 + 预览状态 + 关闭
导航栏：源文件总览 / 渲染预览 / 原始 Markdown / 清洗 Markdown / 差异对比 / 处理单元
主体：结构特征矩阵 | 解析诊断流 | 源文件 → Markdown 保真
底部：文件详情折叠区
```

结构特征矩阵必须区分 `已统计`、`明确为0`、`不适用`、`未统计`、`解析失败`，禁止用 `-` 混合表达空值。历史响应缺少 `featureStates` 时由前端按格式族做展示兜底，但不改写服务端数据。

Markdown 预览只保留一层导航：外层弹窗直接提供渲染、原始、清洗、差异和处理单元入口；内层 Markdown 工作台在源文件预览场景隐藏自身标签栏，避免“转换 Markdown / 清洗 Markdown”和“原始 Markdown / 清洗 Markdown”重复出现。“原始 Markdown”表示转换后、清洗前的中间产物。

### Office 字符数轻量统计

Office 源文件字符数不以 LibreOffice 转换文本为准，避免转换器插入换行、页眉页脚处理差异和格式降级造成统计偏差。预览元信息优先使用轻量 OOXML 统计器：

- `.docx`：读取正文、页眉页脚、脚注尾注和批注中的可见 `w:t` 文本，表格文本自然计入字符数。
- `.pptx`：读取每页幻灯片的 `a:t` 文本并统计幻灯片数量。
- `.xlsx`：读取共享字符串、inline string 和字符串单元格，统计工作表数量。
- `.doc/.ppt/.xls`：作为旧二进制 Office 格式，不使用 LibreOffice 结果冒充源文件字符数；字符数保持未统计或解析失败诊断。

字符数定义为“可见文本字符数”：保留中文、英文、数字和标点，不统计 OOXML 标签、样式、关系、图片二进制、文件路径、换行、段落分隔和制表符。

## 配置

```json
{
  "base_url": "https://pingcode.yasdb.com",
  "credentials": { "email": "your_username", "password": "your_password" },
  "targets": [
    { "name": "YASSTORAGE 知识库", "space_key": "YASSTORAGE", "url": "..." },
    { "name": "YashanDB 文档", "space_key": "YASDOC", "url": "..." }
  ],
  "crawl_strategy": {
    "download_attachments": true,
    "download_pages": true,
    "max_depth": 10,
    "max_workers": 5,
    "file_types": ["docx", "doc", "pptx", "pdf", "md", "txt", "png", "jpg"],
    "skip_empty": true,
    "skip_deleted": true,
    "skip_draft": true,
    "keyword_filter": null,
    "max_pages": 1000,
    "download_timeout": 30,
    "retry_count": 3,
    "request_interval": 0.5
  }
}
```

## 使用场景

### 场景 1：批量下载整个空间

```bash
python3 scripts/pingcode/cli/space_crawl.py --space YASSTORAGE
```

### 场景 2：按关键词筛选下载

```bash
python3 scripts/pingcode/cli/space_crawl.py --space YASDOC --keyword "存储引擎"
```

### 场景 3：只下载特定类型文件

```bash
python3 scripts/pingcode/cli/space_crawl.py --space YASSTORAGE --file-types docx,pptx
```

### 场景 4：生成索引（不下载文件）

```bash
python3 scripts/pingcode/cli/space_crawl.py --space YASSTORAGE --index-only
```

### 场景 5：整合已有数据

```bash
python3 scripts/pingcode/cli/migrate_data.py
```

## 相关文件

- 使用说明：`docs/usage.md`
- 设计文档：`docs/design.md`
- 实施计划：`docs/implementation-plan.md`
- 配置文件：`config/pingcode.json`
- 测试用例：`tests/test_api_client.py`
- 数据迁移：`cli/migrate_data.py`
