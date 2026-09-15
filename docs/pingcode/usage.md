# PingCode 素材下载使用说明

> 版本：v2.0  
> 日期：2026-07-23  
> 状态：已实施

## 概述

本工具用于从 PingCode Wiki 知识库批量下载技术文档和附件，作为 AI 知识库构建的原始素材。

**核心能力**：
- CAS 单点登录（持久化会话，无需重复输入密码）
- 页面内容爬取（Slate.js → Markdown）
- 附件批量下载（docx/pptx/pdf 等，多线程）
- 空间级批量爬取（API 方式）
- 目录树构建与索引生成
- 可配置爬取策略
- 页面图片原文件下载、Markdown 相对路径引用和在线文档预览

## 下载预览与页面图片

页面正文中的图片会保存到当前批次的 `assets/{页面名}/` 目录，并作为 `page_asset` 写入 `resources.json`；页面 Markdown 使用相对路径引用，因此下载产物在本地移动时仍可访问图片。

在素材平台的“下载文件”页点击 Markdown 文件的“预览”，会在当前页面打开文档预览窗口。该窗口以 Markdown 形式展示标题、表格、代码块、引用、列表和页面图片，并可切换查看 Markdown 源码。PDF 与图片附件仍通过浏览器原生预览打开。

若 PingCode 图片令牌失效或图片读取失败，下载任务会显示图片失败告警，并在批次 `resources.json` 写入 `kind=error`、`assetType=image` 的审计记录；可重新执行下载任务恢复图片资源。

页面图片不会出现在下载文件清单，也不会作为独立文档进入扫描、清洗和分块。下载文件、可处理文本和待转换格式均由后端分页；待转换格式在加工页面默认折叠，首次展开时才加载。

素材空间页面的默认批次名称精确到本地时间秒级。附件类型可按批次变更：常用文档、Office、PDF、SQL 和压缩包可直接勾选，也可填写逗号分隔的自定义扩展名；修改类型后需要重新执行范围预估。源码、脚本和可执行文件继续执行安全排除。

处理配置中，“基础清洗”只统一编码、换行和行尾空白；“标准训练集”额外统一不间断空格、压缩冗余空行并规范 Markdown 标题空格。两种预设都保留正文、链接、图片、表格和代码块。默认分块为 1200 字符、重叠 120 字符，通常将重叠控制在块大小的 5%-15%。

## 快速开始

### 局域网访问

统一启动文档生成器和 PingCode 素材平台：

```bash
cd agent-runner
./start-services.sh
```

局域网用户访问 `http://192.168.130.180:3500/pingcode-materials/`。该地址由素材平台 FastAPI 后端直接提供前端静态文件和 `/api/*` 接口；不需要额外开放前端开发端口。本机开发仍可访问 `http://127.0.0.1:5174/pingcode-materials/`。

### 本地素材上传

本地上传入口为 `http://192.168.130.180:3500/pingcode-materials/upload`。上传页面使用临时会话接收多种格式文件，完成分片校验后才能生成正式素材批次；原始文件会保存在批次的 `original/files/` 目录，后续再进入扫描和加工流程。

后端启动时配置上传令牌，令牌不写入前端构建产物：

```bash
MATERIAL_UPLOAD_TOKEN=dev-upload-token \
MATERIAL_UPLOAD_CHUNK_SIZE=8388608 \
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8001
```

可选限制配置：

| 环境变量 | 默认值 | 说明 |
|---|---:|---|
| `MATERIAL_UPLOAD_TOKEN` | 空 | 上传 API 的 Bearer 令牌，生产环境必须设置 |
| `MATERIAL_UPLOAD_CHUNK_SIZE` | `8388608` | 分片大小，单位为字节 |
| `MATERIAL_UPLOAD_MAX_FILE_SIZE` | `2147483648` | 单文件最大大小 |
| `MATERIAL_UPLOAD_MAX_SESSION_SIZE` | `10737418240` | 单个上传会话最大大小 |
| `MATERIAL_UPLOAD_MAX_FILES` | `10000` | 单个会话最大文件数 |
| `MATERIAL_UPLOAD_RETENTION_DAYS` | `30` | 临时会话保留天数，清理任务接入后生效 |
| `MATERIAL_PREP_MAX_ARCHIVE_FILES` | `10000` | 单次准备处理允许的最大解压文件数 |
| `MATERIAL_PREP_MAX_ARCHIVE_BYTES` | `21474836480` | 单次准备处理允许的最大解压总大小 |
| `MATERIAL_PREP_MAX_ARCHIVE_DEPTH` | `3` | 压缩包递归处理最大深度 |
| `MATERIAL_PREP_MAX_EXPANSION_RATIO` | `100` | 压缩包允许的最大膨胀率 |

也可以直接调用 API：

```bash
curl -X POST http://127.0.0.1:8001/api/upload-sessions \
  -H 'Authorization: Bearer dev-upload-token' \
  -H 'Content-Type: application/json' \
  -d '{"name":"本地资料","totalFiles":1,"totalBytes":12}'
```

生成素材批次后执行安全准备处理：

```bash
curl -X POST http://127.0.0.1:8001/api/preprocess/prepare \
  -H 'Content-Type: application/json' \
  -d '{"batchId":"batch_xxx"}'
```

准备处理只识别格式、安全解压和登记资源，不覆盖原件，也不在该步骤执行 Office/PDF 正文转换。结果位于批次 `preparation/runs/<run_id>/`，`latest.json` 指向最近一次运行。

### 素材批次来源与筛选

局域网批次页面：`http://192.168.130.180:3500/pingcode-materials/batches`。

页面将“素材来源”和“归属空间”分开显示：

- 本地上传批次显示“本地上传”和上传会话来源；尚未发布到正式空间时归属为“临时区”。
- PingCode 批次显示“PingCode”和空间 Key；本地映射显示在“归属空间”列。
- 历史批次缺少来源字段时显示“来源未知”或兼容的 PingCode 历史标记，不再默认显示为本地上传。

可按关键字、来源类型、批次状态、归属状态、来源完整性、更新时间、本地素材空间、PingCode 空间、活动任务和数据集发布状态筛选。筛选在后端完成后再分页，因此批次数量超过 100 时结果仍然准确。

筛选条件同步到浏览器 URL，可刷新或复制链接保留当前视图。例如：

```text
http://192.168.130.180:3500/pingcode-materials/batches?sourceType=upload&ownership=temporary&pageSize=20
```

批次列表接口示例：

```bash
curl 'http://127.0.0.1:8001/api/material-batches?sourceType=upload&state=uploaded,ready&ownership=temporary&page=1&pageSize=20&sort=updatedAt:desc'
```

### 1. 环境准备

```bash
# 安装依赖
pip install playwright
playwright install chromium
```

### 2. 配置账号密码

编辑 `config/pingcode/credentials.json`：

```json
{
  "base_url": "https://pingcode.yasdb.com",
  "credentials": {
    "email": "your_username",
    "password": "your_password"
  },
  "targets": [
    {
      "name": "YASSTORAGE 知识库",
      "url": "https://pingcode.yasdb.com/wiki/spaces/YASSTORAGE/pages/SBlM3dKV",
      "space_key": "YASSTORAGE"
    },
    {
      "name": "YashanDB 文档",
      "url": "https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/2CwBXcJx",
      "space_key": "YASDOC"
    }
  ],
  "crawl_strategy": {
    "download_attachments": true,
    "download_pages": true,
    "max_workers": 5,
    "max_pages": 1000,
    "file_types": ["docx", "doc", "pptx", "pdf", "md", "txt", "png", "jpg"],
    "skip_empty": true,
    "skip_deleted": true,
    "skip_draft": true,
    "keyword_filter": null,
    "download_timeout": 30,
    "retry_count": 3,
    "request_interval": 0.5
  }
}
```

### 3. 运行下载

#### 方式 1：空间级爬取（推荐）

```bash
# 批量下载整个空间
python3 tools/pingcode-cli/cli/space_crawl.py --space YASSTORAGE

# 按关键词筛选
python3 tools/pingcode-cli/cli/space_crawl.py --space YASDOC --keyword "存储引擎"

# 只下载特定文件类型
python3 tools/pingcode-cli/cli/space_crawl.py --space YASSTORAGE --file-types docx,pptx

# 只生成索引（不下载文件）
python3 tools/pingcode-cli/cli/space_crawl.py --space YASSTORAGE --index-only

# 自定义并发数
python3 tools/pingcode-cli/cli/space_crawl.py --space YASSTORAGE --workers 10

# 详细日志模式
python3 tools/pingcode-cli/cli/space_crawl.py --space YASSTORAGE --verbose
```

#### 方式 2：单页面流水线（传统方式）

```bash
cd agent-runner
python3 ../tools/pingcode-cli-pipeline.py
```

### 4. 查看结果

下载的文件保存在：
```
tools/pingcode-cli/data/YASSTORAGE/
├── index.json          # 索引（AI 训练用）
├── index.md            # 索引（人类可读）
├── pages/              # 页面内容（Markdown）
│   └── 内幕文档.md
└── files/              # 附件文件
    ├── 索引内幕文档.docx
    ├── 存储引擎-Coast.pptx
    └── ...
```

## 代码架构

### 目录结构

```
tools/pingcode-cli/
├── core/                    # 核心模块
│   ├── config.py           # 配置管理
│   ├── client.py           # CAS 登录客户端
│   ├── api_client.py       # REST API 客户端
│   ├── tree_builder.py     # 目录树构建器
│   ├── content_parser.py   # 文档内容解析器
│   ├── filename_utils.py   # 文件名处理工具
│   ├── space_crawler.py    # 空间级爬虫
│   ├── index_builder.py    # 索引生成器
│   ├── crawler.py          # 页面爬虫（浏览器方式）
│   ├── downloader.py       # 文件下载器
│   └── pipeline.py         # 单页面流水线
│
├── cli/                     # CLI 工具
│   ├── space_crawl.py      # 空间级爬取 CLI
│   ├── migrate_data.py     # 数据迁移工具
│   ├── pipeline.py         # 单页面流水线 CLI
│   └── browser.py          # 浏览器工具 CLI
│
├── examples/                # 使用示例
│   ├── demo_crawl.py
│   └── demo_download.py
│
├── tests/                   # 测试用例
│   ├── demo_test.py
│   └── test_api_client.py
│
├── docs/                    # 文档
│   ├── usage.md            # 使用说明（本文件）
│   ├── design.md           # 设计文档
│   └── implementation-plan.md
│
├── config/
│   └── pingcode.json       # 配置文件
│
└── data/                    # 下载数据
    └── {space_key}/
        ├── index.json
        ├── index.md
        ├── pages/
        └── files/
```

### 模块说明

| 模块 | 职责 | 关键类/方法 |
|------|------|-------------|
| `config.py` | 配置加载、验证、持久化 | `PingCodeConfig.load()` |
| `client.py` | CAS 登录、会话管理 | `PingCodeClient.start()` |
| `api_client.py` | REST API 调用 | `PingCodeAPIClient.get_pages()` |
| `tree_builder.py` | 目录树构建 | `TreeBuilder.build()` |
| `content_parser.py` | Slate.js → Markdown | `ContentParser.parse_document()` |
| `filename_utils.py` | 文件名处理 | `FilenameUtils.sanitize()` |
| `space_crawler.py` | 空间级爬虫 | `SpaceCrawler.crawl_space()` |
| `index_builder.py` | 索引生成 | `IndexBuilder.save_json()` |
| `crawler.py` | 页面内容提取 | `PingCodeCrawler.extract_text()` |
| `downloader.py` | 文件下载 | `PingCodeDownloader.download_batch()` |
| `pipeline.py` | 单页面流水线 | `PingCodePipeline.run_all()` |

### 调用流程

#### 空间级爬取流程

```
config/pingcode/credentials.json
       ↓
  PingCodeConfig.load()
       ↓
  PingCodeClient.start()  ← CAS 登录
       ↓
  PingCodeAPIClient.get_pages()  ← 获取空间所有页面
       ↓
  TreeBuilder.build()  ← 构建目录树
       ↓
  SpaceCrawler.crawl_space()  ← 多线程下载
       ↓
  IndexBuilder.save_json()  ← 生成索引
       ↓
  tools/pingcode-cli/data/{space_key}/
```

## 使用场景

### 场景 1：批量下载整个空间

```bash
python3 tools/pingcode-cli/cli/space_crawl.py --space YASSTORAGE
```

**输出**：
- 下载所有页面的附件
- 保存页面内容为 Markdown
- 生成索引文件（JSON + Markdown）

### 场景 2：按关键词筛选下载

```bash
python3 tools/pingcode-cli/cli/space_crawl.py --space YASDOC --keyword "存储引擎"
```

**说明**：只下载页面名称包含"存储引擎"的页面及其附件。

### 场景 3：只下载特定文件类型

```bash
python3 tools/pingcode-cli/cli/space_crawl.py --space YASSTORAGE --file-types docx,pptx
```

**说明**：只下载 `.docx` 和 `.pptx` 文件，忽略其他类型。

### 场景 4：只生成索引（不下载文件）

```bash
python3 tools/pingcode-cli/cli/space_crawl.py --space YASSTORAGE --index-only
```

**说明**：快速获取空间结构，不下载实际文件。

### 场景 5：自定义并发数

```bash
python3 tools/pingcode-cli/cli/space_crawl.py --space YASSTORAGE --workers 10
```

**说明**：提高并发数加速下载（默认 5）。

### 场景 6：整合已有数据

```bash
python3 tools/pingcode-cli/cli/migrate_data.py
```

**说明**：将 `refs/pingcode/YASSTORAGE_内幕文档/` 整合到新结构。

### 场景 7：Python API 调用

```python
from pingcode import (
    PingCodeConfig, PingCodeClient, PingCodeAPIClient,
    TreeBuilder, SpaceCrawler, IndexBuilder
)
from pathlib import Path

# 初始化
config = PingCodeConfig()
client = PingCodeClient(config, headless=True)
page = client.start()

api = PingCodeAPIClient(page, config.base_url)

# 获取空间页面
pages = api.get_pages('YASSTORAGE')
print(f"页面数：{len(pages)}")

# 构建树
builder = TreeBuilder()
roots = builder.build(pages)
print(f"根节点数：{len(roots)}")

# 爬取空间
output_dir = Path('tools/pingcode-cli/data')
crawler = SpaceCrawler(config, output_dir)
result = crawler.crawl_space('YASSTORAGE')

# 生成索引
index_builder = IndexBuilder(
    space_key='YASSTORAGE',
    space_name='YashanDB 存储引擎',
    tree=result.tree,
    pages=result.pages
)
index_builder.save_json(output_dir / 'YASSTORAGE' / 'index.json')
index_builder.save_markdown(output_dir / 'YASSTORAGE' / 'index.md')

client.close()
```

## 配置说明

### config/pingcode/credentials.json

| 字段 | 类型 | 说明 |
|------|------|------|
| `base_url` | string | PingCode 基础 URL |
| `credentials.email` | string | 登录账号 |
| `credentials.password` | string | 登录密码 |
| `targets` | array | 目标页面列表 |
| `targets[].name` | string | 页面名称 |
| `targets[].url` | string | 页面完整 URL |
| `targets[].space_key` | string | 空间 Key（用于 API 调用） |
| `crawl_strategy` | object | 爬取策略 |
| `crawl_strategy.download_attachments` | bool | 是否下载附件（默认 true） |
| `crawl_strategy.download_pages` | bool | 是否保存页面内容（默认 true） |
| `crawl_strategy.max_workers` | int | 并发线程数（默认 5） |
| `crawl_strategy.max_pages` | int | 最大页面数（默认 1000） |
| `crawl_strategy.file_types` | array | 允许的文件类型 |
| `crawl_strategy.skip_empty` | bool | 跳过空页面（默认 true） |
| `crawl_strategy.skip_deleted` | bool | 跳过已删除页面（默认 true） |
| `crawl_strategy.skip_draft` | bool | 跳过草稿页面（默认 true） |
| `crawl_strategy.keyword_filter` | string | 关键词过滤（默认 null） |
| `crawl_strategy.download_timeout` | int | 下载超时秒数（默认 30） |
| `crawl_strategy.retry_count` | int | 重试次数（默认 3） |
| `crawl_strategy.request_interval` | float | 请求间隔秒数（默认 0.5） |

## 测试验证

### 运行 API 客户端测试

```bash
python3 tests/pingcode/test_api_client.py
```

**测试覆盖**：
1. ✓ API 客户端初始化
2. ✓ 获取空间信息
3. ✓ 获取页面列表
4. ✓ 构建目录树
5. ✓ 解析文档内容

### 预期输出

```
============================================================
API 客户端测试
============================================================

[Test 1] API 客户端初始化
  ✓ API 客户端已创建
  ✓ Base URL: https://pingcode.yasdb.com

[Test 2] 获取空间信息
  ✓ 空间名称：YashanDB 存储引擎

[Test 3] 获取页面列表
  ✓ 页面数量：1000
  ✓ 第一个页面：主页
  ✓ 页面 ID: 6738a42c593f99c9ff1ac800
  ✓ 附件数：1

[Test 4] 构建目录树
  ✓ 根节点数：76
  ✓ 第一个根节点：主页
  ✓ 子节点数：0

[Test 5] 解析文档内容
  ✓ 页面：主页
  ✓ Document keys: 5
  ✓ 解析后长度：1475 字符
  ✓ 内容预览：Created by 郭藏龙, last modified on 八月 28, 2024...

============================================================
所有测试通过！
============================================================
```

## 常见问题

### Q1: 登录失败怎么办？

检查 `config/pingcode/credentials.json` 中的账号密码是否正确。如果是 CAS 单点登录，确保账号密码是 CAS 系统的凭据。

### Q2: 下载的文件名是乱码？

文件名是 URL 编码的，工具会自动解码为中文。`filename_utils.py` 会处理：
- URL 解码（`%E7%B4%A2%E5%BC%95` → `索引`）
- 非法字符替换（`<>:"/\|?*` → `_`）
- 零宽字符清理

### Q3: 如何下载其他空间的内容？

在 `config/pingcode/credentials.json` 的 `targets` 数组中添加新空间：

```json
{
  "targets": [
    {"name": "YASSTORAGE", "space_key": "YASSTORAGE", "url": "..."},
    {"name": "YASDOC", "space_key": "YASDOC", "url": "..."}
  ]
}
```

然后运行：
```bash
python3 tools/pingcode-cli/cli/space_crawl.py --space YASDOC
```

### Q4: 会话过期怎么办？

工具使用持久化浏览器会话，Cookie 保存在 `.browser-data/pingcode/`。如果会话过期，重新运行即可自动重新登录。

### Q4.1: 下载任务跳转到了错误空间或出现 Playwright 生命周期报错怎么办？

如果 YASDOC 批次日志中出现 YASSTORAGE 页面，优先检查登录入口是否被 `config/pingcode/credentials.json` 的 `targets[0]` 污染。Web 下载任务应按当前批次空间登录：有 `space_key` 时使用 `{base_url}/wiki/spaces/{spaceKey}`，没有空间上下文时使用 `{base_url}/wiki`，不要使用任意目标页作为登录入口。

如果出现 `It looks like you are using Playwright Sync API inside the asyncio loop` 或 `cannot schedule new futures after shutdown`，说明同步 Playwright 调用没有被稳定隔离在线程池中，或服务关闭后复用了已关闭 executor。后端应通过单 worker 线程池串行执行 PingCode API 调用，并在服务重启/关闭后重新创建 executor。

如果任务显示“已完成”但仍有待处理页面，说明旧版本把“重试失败页面已结束”误判成“整个批次下载完成”。正确状态应为“已中断/可继续”，待处理页需要通过“继续下载”处理，而不是只点击“重试失败任务”。

如果出现 `Page.goto` 超时、验证码、登录页、403 或 429，按 PingCode 风控处理：降低下载范围和频率，人工打开持久化浏览器会话完成登录/验证后再重试；系统不应绕过验证码或盲目高频重试。

### Q5: 如何扩展爬取策略？

修改 `config/pingcode/credentials.json` 中的 `crawl_strategy` 配置，或运行 CLI 时通过参数覆盖：

```bash
python3 tools/pingcode-cli/cli/space_crawl.py --space YASSTORAGE --workers 10 --max-pages 500
```

### Q6: API 只能获取 1000 个页面怎么办？

PingCode API 限制单次最多返回 1000 条。对于超过 1000 页面的空间（如 YASDOC 有 8113 页面），目前只处理前 1000 个。

**解决方案**：
- 使用关键词过滤减少页面数
- 后续版本将探索浏览器爬取方式获取完整列表

### Q7: 如何整合已有数据？

运行数据迁移工具：
```bash
python3 tools/pingcode-cli/cli/migrate_data.py
```

这会将 `refs/pingcode/YASSTORAGE_内幕文档/` 整合到 `tools/pingcode-cli/data/YASSTORAGE/`。

## 设计决策

### 1. API 鉴权方式

**决策**：复用浏览器 Cookie

**原因**：无需额外 token 管理，复用现有 CAS 登录流程。

### 2. 页面内容格式

**决策**：优先 Markdown，效果差则用 HTML

**原因**：Markdown 更适合 AI 训练和文本处理。

### 3. 并发策略

**决策**：API 请求串行 + 文件 I/O 并行

**原因**：Playwright Page 对象非线程安全，不能多线程共用。

### 4. 索引用途

**决策**：为 AI 训练提供结构化输入

**原因**：索引包含面包屑路径、文件位置等元数据，方便 AI pipeline 定位和处理。

## 后续扩展

- [ ] 风控状态识别：将登录页、验证码、403/429 和连续超时归类为“需要人工刷新会话”，避免盲目重试
- [ ] 支持更多页面类型（Wiki、文档、知识库）
- [ ] 增量爬取（只下载更新的内容）
- [ ] 并发下载优化（探索纯 API token 方式）
- [ ] 文档格式转换（docx → markdown）
- [ ] 内容质量评估
- [ ] 分页 API 支持（突破 1000 条限制）

## 相关文件

- 设计文档：`docs/design.md`
- 实施计划：`docs/implementation-plan.md`
- 配置文件：`config/pingcode/credentials.json`
- 测试用例：`tests/test_api_client.py`
- 数据迁移：`cli/migrate_data.py`
- 已下载素材：`data/YASSTORAGE/`
