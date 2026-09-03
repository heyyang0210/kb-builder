# PingCode 素材下载系统

加工系统的端到端可运行框架设计位于仓库级 `docs/04-pingcode-processing-e2e-framework-design.md`；Prompt/Skill 控制设计和未完成项也统一保存在仓库级 `docs/` 目录。

> 版本：v2.3  
> 日期：2026-07-27  
> 状态：下载器、通用上传、安全准备处理和资料加工任务来源筛选已完成

## 概述

基于 PingCode REST API 的空间级素材下载系统，用于从 PingCode Wiki 知识库批量下载技术文档和附件，作为 AI 知识库构建的原始素材。

## 核心能力

- ✅ CAS 单点登录（持久化会话）
- ✅ 空间级批量爬取（API 方式）
- ✅ 目录树构建与索引生成
- ✅ 附件批量下载（多线程）
- ✅ 页面内容提取（Slate.js → Markdown）
- ✅ 页面内图片保真下载与资源登记
- ✅ 筛选策略（关键词、文件类型、深度）
- ✅ 已有数据整合
- ✅ 资料加工任务后端接口（技术接口继续使用 material-batches，支持范围预估、持久化、任务状态、SSE）
- ✅ 独立 Vue 资料加工页面（空间选择、任务、下载、远程文件访问）
- ✅ 真实 PingCode 空间发现与本地素材空间映射
- ✅ 与文档管理一致的页面内 Markdown 预览
- ✅ 通用本地资料分片上传和临时加工任务生成
- ✅ ZIP/TAR 安全准备处理、格式识别和图片资源登记
- ✅ 任务来源/归属分离展示、服务端筛选、聚合统计和分页
- ✅ 源文件加工预览高密度 Cockpit（结构特征、解析诊断、转换保真一屏总览，Markdown 预览单行导航）
- ✅ Office OOXML 轻量字符统计（DOCX/PPTX/XLSX 不依赖 LibreOffice 反推源文件字符数）

## 快速开始

加工训练通过 `AGENT_RUNNER_MODEL_GATEWAY_URL`（默认 `http://127.0.0.1:4100/api/model-provider`）复用知识库文档生成器的模型配置；跨机器部署时配置实际服务地址，并在两端设置相同的 `MODEL_GATEWAY_INTERNAL_TOKEN`。

### 1. 环境准备

```bash
pip install playwright
playwright install chromium
```

### 2. 配置账号

编辑 `config/pingcode.json`：

```json
{
  "base_url": "https://pingcode.yasdb.com",
  "credentials": {
    "email": "your_username",
    "password": "your_password"
  }
}
```

### 3. 运行下载

```bash
# 批量下载整个空间
python3 scripts/pingcode/cli/space_crawl.py --space YASSTORAGE

# 按关键词筛选
python3 scripts/pingcode/cli/space_crawl.py --space YASDOC --keyword "存储引擎"

# 只生成索引
python3 scripts/pingcode/cli/space_crawl.py --space YASSTORAGE --index-only
```

### 4. 查看结果

```
scripts/pingcode/data/YASSTORAGE/
├── index.json          # 索引（AI 训练用）
├── index.md            # 索引（人类可读）
├── pages/              # 页面内容（Markdown）
└── files/              # 附件文件
```

## 项目结构

```
scripts/pingcode/
├── core/               # 11 个核心模块
├── cli/                # 4 个 CLI 工具
├── tests/              # 3 个测试用例
├── examples/           # 2 个使用示例
├── web/                # 素材平台前后端
├── docs/               # 4 个文档
├── config/             # 配置文件
└── data/               # 下载数据
```

## 文档

- [使用说明](docs/usage.md) - 详细的使用指南
- [设计文档](docs/design.md) - 系统设计、源文件加工预览信息架构与常见问题
- [实施计划](docs/implementation-plan.md) - 阶段完成情况
- [图片保真与统一预览设计](../../../agent-runner/docs/29-PingCode下载图片保真与统一文档预览设计.md) - 页面图片下载及预览接口
- [文件分页与加工配置设计](../../../agent-runner/docs/30-PingCode文件清单分页与加工配置设计.md) - 资源分类、分页和清洗预设
- [资料加工任务来源识别与筛选设计](../../../agent-runner/docs/35-素材批次来源识别与筛选界面设计.md) - 来源、归属、筛选、聚合和服务端分页
- [资料加工平台工作台重构设计](../../../agent-runner/docs/36-资料加工平台工作台与全流程前端重构设计.md) - 工作台、任务聚合接口、详情抽屉和全流程术语

## 测试

```bash
# API 客户端测试
python3 scripts/pingcode/tests/test_api_client.py

# 集成测试
python3 scripts/pingcode/tests/test_integration.py
```

## 素材平台前端

当前非容器化实现位于 `scripts/pingcode/web/`，前端和后端地址均通过运行时环境配置，不依赖固定机器路径。

### 启动后端

```bash
python3 -m pip install --user --break-system-packages -r scripts/pingcode/web/backend/requirements.txt
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 3500
```

命令需要在 `scripts/pingcode/web/backend` 目录执行。后端默认监听 `0.0.0.0:3500`，同时提供 `/api/*` 接口和 `/pingcode-materials/` 前端静态文件；可通过仓库根目录的 `start_services.sh` 启动。后端默认使用已配置的持久化浏览器会话和 `config/pingcode.json`，数据写入 `scripts/pingcode/runtime/web`；可通过 `PINGCODE_WEB_DATA_ROOT`、`PINGCODE_CONFIG`、`PINGCODE_PROCESSING_SKILL_ROOT` 和 `PINGCODE_PROCESSING_PROMPT_DRAFT_ROOT` 覆盖。空间树使用 PingCode 原生 `page-tree-v2` 分页接口，不再受旧的 1000 条页面接口限制。

### 启动前端

```bash
cd scripts/pingcode/web/frontend
npm install
PINGCODE_WEB_BACKEND=http://127.0.0.1:8000 npm run dev
```

浏览器访问 `http://127.0.0.1:5173/pingcode-materials/`。本地开发默认允许 `localhost` 和 `127.0.0.1` 的任意前端端口，避免 Vite 自动切换端口后写请求被 CORS 预检拦截；生产环境可通过 `PINGCODE_WEB_CORS_ORIGINS` 和 `PINGCODE_WEB_CORS_ORIGIN_REGEX` 收紧来源。局域网统一入口为 `http://192.168.130.180:3500/pingcode-materials/`，由素材平台 FastAPI 后端直接提供前端静态文件和 `/api/*` 接口，无需单独开放前端开发端口。

当前已验证：真实发现当前账号可访问的 206 个 PingCode 空间、YASDOC 8073 条完整页面索引、2 个真实根节点和 0 个悬空父节点、空间映射持久化、逻辑空间目录、本地上传、单页面批次创建、来源与归属识别、批次筛选分页、页面 Markdown 下载、资源元数据、在线预览、文件下载、SSE 任务事件、源文件扫描、清洗分块预览、Monaco 原文/清洗/Diff/渲染预览、预处理任务、知识图谱训练、质量门禁和数据集发布。当前知识加工前端展示三步流水线：资料预处理、知识提取、索引生成；元数据整理归入资料预处理，证据校验和关系识别归入知识提取 Workflow Agent。知识加工必须在资料下载完成后启动；下载中断时需先在“下载文件”页继续下载。Office/PDF 文本转换器、来源文本偏移和固定查询集检索验证仍按设计阶段继续实现。

下载实现对图片和附件使用 Playwright 请求上下文直接读取二进制响应，避免大文件转成 JavaScript 字节数组导致驱动内存膨胀。驱动通道异常关闭时会使当前会话失效，后续页面自动重建会话；已完成页面仍由断点账本保留。

### 空间树和附件策略

- 文件浏览默认树状模式，树/平铺模式偏好保存在浏览器本地；
- 平铺列表由完整树索引在前端派生，支持虚拟滚动，不再只展示前 1000 条；
- 下载批次默认名称使用“本地空间名称-年月日-时分秒”，仍可手工修改；
- 附件类型支持常用类型勾选和自定义扩展名，配置按批次保存；
- `.sql` 默认允许下载；源码、脚本、可执行文件始终排除；`.zip/.tar/.7z` 默认跳过，用户显式选择后才允许；
- 附件类型全部不选且自定义输入为空，表示下载全部默认允许类型。

## 技术栈

- **语言**：Python 3.10+
- **浏览器自动化**：Playwright
- **并发**：ThreadPoolExecutor
- **数据格式**：JSON, Markdown

## 相关设计

- 前端总体设计：`docs/02-pingcode-frontend-design.md`
- 前端交互详细设计：`docs/03-pingcode-frontend-interaction-detail.md`
- LLM 可控加工专项设计：`docs/05-pingcode-processing-llm-control-design.md`
- 知识加工六步骤详细设计：`docs/08-pingcode-processing-six-step-pipeline-design.md`

## 许可证

内部工具，仅供 YashanDB 团队使用。
