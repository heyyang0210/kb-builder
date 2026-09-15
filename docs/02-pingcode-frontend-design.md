# PingCode 文档下载与预处理前端 — 设计文档

> 版本：v1.1  
> 日期：2026-07-24  
> 状态：前端总体设计（评审修订版）

> 实施进度（2026-07-24）：素材批次、空间树、下载任务、SSE、远程文件访问、源文件扫描、文本清洗分块、质量门禁和数据集版本已完成第一版；Office/PDF 转换、来源文本偏移、图谱提取和固定查询集评测待后续阶段。

## 零、文档定位与当前范围

本文定义 PingCode 素材下载、预处理和质量分析功能的前端总体方案，重点回答以下问题：

1. 用户如何从空间文档树创建一个可追踪的素材批次；
2. 如何持续查看下载、预处理和质量分析状态；
3. 局域网用户如何通过浏览器查看、预览和下载服务器文件；
4. 如何把每次处理结果与来源页面、附件和处理版本关联；
5. 如何以独立页面方式建设，并在后续接入「YashanDB 知识库文档生成器」。

**当前实施范围**：前端页面、前端状态模型、前后端接口契约和非容器化运行方式。

**暂不实施**：Docker、Kubernetes、镜像构建和容器编排。本文原有容器内容仅作为后续规划保留，不进入当前排期和验收范围。

详细的页面交互、状态机和异常状态见：`docs/03-pingcode-frontend-interaction-detail.md`。

## 一、设计原则

### 1.1 运行环境无关性

**核心原则**：即使当前不采用容器，配置、服务地址和数据根目录仍必须外部化，避免更换机器时修改前端源码。

| 原则 | 说明 | 实现方式 |
|------|------|----------|
| **配置外部化** | 禁止硬编码配置项 | 环境变量 + 配置文件 |
| **路径动态化** | 禁止硬编码绝对路径 | 相对路径 + 可配置数据目录 |
| **服务发现** | 前后端地址可配置 | 环境变量 + 配置文件 |
| **环境适配** | 支持不同 OS 和硬件 | 运行时配置 + 能力检测 |
| **浏览器可访问** | 不向远程浏览器暴露服务器绝对路径 | 文件资源 ID + 后端预览/下载接口 |
| **任务可恢复** | 页面刷新或临时断线后不丢任务上下文 | URL 路由 + 服务端任务状态 + 本地轻量偏好 |

### 1.2 配置层级

```
优先级（从高到低）：
1. 环境变量（部署时指定）
2. 配置文件（项目内或外部挂载）
3. 默认值（代码中定义）
```

---

## 二、整体架构

```
─────────────────────────────────────────────────────────┐
│              前端独立页面 (Vue 3 + Router)                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ 素材空间  │ │ 素材批次  │ │ 加工任务  │ │ 质量分析  │   │
│  │ 选择来源  │ │ 下载文件  │ │ 预处理   │ │ 追溯验证  │   │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘   │
│               当前素材批次上下文贯穿所有页面                │
└───────────────────┼────────────┼──────────────────────┘
        │ HTTP       │ HTTP       │ HTTP       │ HTTP
        │            │            │            │
        ▼            ▼            ▼            ▼
─────────────────────────────────────────────────────────┐
│                  FastAPI 后端 (Python)                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │PingCode  │ │ 文件管理  │ │ 预处理   │ │ 图谱引擎  │   │
│  │API 代理  │ │ & 存储   │ │ 引擎     │ │(ChromaDB │   │
│  │          │ │          │ │          │ │+NetworkX)│   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
└─────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│                    配置管理系统                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                │
│  │环境变量   │ │配置文件   │ │默认值     │                │
│  │(.env)    │ │(config/) │ │(code)    │                │
│  └──────────┘ └──────────┘ └──────────┘                │
└─────────────────────────────────────────────────────────┘
```

### 2.1 核心业务对象：素材批次

四个页面不再是相互独立的功能入口，而是围绕同一个 `MaterialBatch` 工作：

```text
MaterialBatch
├── sourceSelection     # 空间、页面、附件、包含/排除规则
├── sourceSnapshot      # 来源页面版本、抓取时间、完整性状态
├── downloadTask        # 下载状态、文件清单、失败项
├── preprocessRuns[]    # 可重复执行的预处理版本
├── datasetVersions[]   # 通过质量门禁后发布的数据集版本
└── qualityReports[]    # 覆盖率、可追溯率、抽样验证结果
```

页面顶部固定显示当前批次、PingCode 登录状态、后端连接状态和全局任务入口。没有选中批次时，下载、加工和分析页面显示明确的空状态及创建入口。

### 2.2 前端建设与集成边界

- 当前阶段建设独立 Vue 3 页面，建议入口为 `/pingcode-materials/`；
- 现有生成器通过顶部导航或独立标签页跳转到该入口；
- 不在现有大型 `prompt-generator.html` 中直接混入 Vue 组件；
- 后续统一前端框架后，可复用路由页面和 API 层并入主应用；
- 不采用 iframe 作为长期集成方案，避免登录态、路由、尺寸和跨窗口通信复杂化；
- “改用 React 则全部重写”不作为设计结论，组件框架选择应服从最终集成路线。

---

## 三、配置管理设计

### 3.1 配置文件结构

```
config/
├── .env.example              # 环境变量模板（提交到 Git）
├── .env                      # 本地环境变量（不提交，.gitignore）
├── app.yaml                  # 应用配置（可外部挂载）
── pingcode.yaml             # PingCode 特定配置
└── preprocess.yaml           # 预处理配置
```

### 3.2 环境变量（.env.example）

```bash
# ============================================
# PingCode 文档下载与预处理平台 - 环境变量配置
# ============================================
# 复制此文件为 .env 并修改为实际值
# 所有配置项都有默认值，可安全留空

# ---------- 应用基础配置 ----------
APP_NAME=pingcode-doc-platform
APP_ENV=development          # development | production
APP_DEBUG=true               # true | false
APP_LOG_LEVEL=INFO           # DEBUG | INFO | WARNING | ERROR

# ---------- 服务地址配置 ----------
# 后端 API 地址（前端访问后端用）
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
BACKEND_URL=http://localhost:8000

# 前端地址
FRONTEND_HOST=0.0.0.0
FRONTEND_PORT=3000
FRONTEND_URL=http://localhost:3000

# ---------- 数据存储配置 ----------
# 数据根目录（所有下载和预处理数据的根路径）
# 支持相对路径（相对于项目根目录）和绝对路径
DATA_ROOT=./data
# 或绝对路径：DATA_ROOT=/mnt/data/pingcode

# 下载文件存储目录（相对于 DATA_ROOT）
DOWNLOAD_DIR=downloads

# 预处理输出目录（相对于 DATA_ROOT）
PREPROCESS_DIR=preprocessed

# 图谱数据存储目录（相对于 DATA_ROOT）
GRAPH_DIR=graph

# ---------- PingCode 配置 ----------
PINGCODE_BASE_URL=https://pingcode.yasdb.com
PINGCODE_EMAIL=
PINGCODE_PASSWORD=
PINGCODE_SESSION_TTL=3600      # 会话有效期（秒）

# ---------- 预处理配置 ----------
# 文本分块配置
CHUNK_SIZE=512                 # 块大小（tokens）
CHUNK_OVERLAP=64               # 重叠大小（tokens）

# 向量化模型配置
EMBEDDING_MODEL=bge-large-zh-v1.5
EMBEDDING_DIMENSION=1024
EMBEDDING_DEVICE=cpu           # cpu | cuda | mps

# 实体提取配置
ENTITY_EXTRACTION_METHOD=rule  # rule | llm
ENTITY_TYPES=技术术语，模块名，人名，概念

# ---------- 图谱数据库配置 ----------
# ChromaDB 配置
CHROMADB_HOST=localhost
CHROMADB_PORT=8001
CHROMADB_PERSIST_DIR=${DATA_ROOT}/chromadb
CHROMADB_COLLECTION_PREFIX=yasdb

# ---------- 系统资源配置 ----------
MAX_WORKERS=5                  # 最大并发线程数
MAX_MEMORY_MB=4096             # 最大内存使用（MB）
MAX_DISK_SPACE_GB=100          # 最大磁盘使用（GB）
REQUEST_TIMEOUT=30             # HTTP 请求超时（秒）
```

### 3.3 应用配置（app.yaml）

```yaml
# app.yaml - 应用级配置
# 此文件可被外部挂载覆盖（Docker volume）

app:
  name: pingcode-doc-platform
  version: 1.0.0
  environment: ${APP_ENV}
  debug: ${APP_DEBUG}

server:
  backend:
    host: ${BACKEND_HOST}
    port: ${BACKEND_PORT}
    cors_origins:
      - ${FRONTEND_URL}
      - http://localhost:3000
  
  frontend:
    host: ${FRONTEND_HOST}
    port: ${FRONTEND_PORT}

storage:
  # 数据根目录（支持相对路径和绝对路径）
  root: ${DATA_ROOT}
  
  # 子目录配置（相对于 root）
  downloads: ${DOWNLOAD_DIR}
  preprocessed: ${PREPROCESS_DIR}
  graph: ${GRAPH_DIR}
  
  # 自动创建目录
  auto_create: true
  
  # 磁盘空间检查
  min_free_space_gb: 10

logging:
  level: ${APP_LOG_LEVEL}
  format: "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
  file: logs/app.log
  max_size_mb: 100
  backup_count: 5

resources:
  max_workers: ${MAX_WORKERS}
  max_memory_mb: ${MAX_MEMORY_MB}
  max_disk_space_gb: ${MAX_DISK_SPACE_GB}
  request_timeout: ${REQUEST_TIMEOUT}
```

### 3.4 PingCode 配置（pingcode.yaml）

```yaml
# pingcode.yaml - PingCode 特定配置

pingcode:
  base_url: ${PINGCODE_BASE_URL}
  
  credentials:
    email: ${PINGCODE_EMAIL}
    password: ${PINGCODE_PASSWORD}
    session_ttl: ${PINGCODE_SESSION_TTL}
  
  # 默认目标空间（可被前端覆盖）
  default_spaces:
    - key: YASSTORAGE
      name: YashanDB 存储引擎
    - key: YASDOC
      name: YashanDB 文档
  
  # API 限制
  api:
    max_pages_per_request: 1000
    request_interval: 0.5    # 请求间隔（秒）
    retry_count: 3
    retry_delay: 1.0         # 重试延迟（秒）
  
  # 下载配置
  download:
    max_workers: ${MAX_WORKERS}
    timeout: ${REQUEST_TIMEOUT}
    chunk_size: 1048576      # 下载块大小（1MB）
    skip_empty: true
    skip_deleted: true
    skip_draft: true
```

### 3.5 预处理配置（preprocess.yaml）

```yaml
# preprocess.yaml - 预处理流水线配置

preprocess:
  # 处理阶段（按顺序执行）
  stages:
    - name: format_convert
      enabled: true
      description: "格式转换（docx/pptx → Markdown）"
    
    - name: text_clean
      enabled: true
      description: "文本清洗"
    
    - name: text_chunk
      enabled: true
      description: "文本分块"
      config:
        chunk_size: ${CHUNK_SIZE}
        chunk_overlap: ${CHUNK_OVERLAP}
        separator: "\n\n"
    
    - name: embedding
      enabled: true
      description: "向量化"
      config:
        model: ${EMBEDDING_MODEL}
        dimension: ${EMBEDDING_DIMENSION}
        device: ${EMBEDDING_DEVICE}
        batch_size: 32
    
    - name: entity_extract
      enabled: true
      description: "实体 & 关系提取"
      config:
        method: ${ENTITY_EXTRACTION_METHOD}
        entity_types: ${ENTITY_TYPES}
  
  # 输出配置
  output:
    format: json
    compress: false
    include_metadata: true
  
  # 图谱配置
  graph:
    backend: networkx        # networkx | neo4j
    collection_prefix: ${CHROMADB_COLLECTION_PREFIX}
```

---

## 四、路径管理设计

### 4.1 路径解析策略

```python
# backend/core/path_resolver.py

import os
from pathlib import Path
from typing import Optional

class PathResolver:
    """路径解析器 - 所有路径通过此组件统一管理"""
    
    def __init__(self, config: dict):
        # 数据根目录（支持相对路径和绝对路径）
        root = config.get('storage', {}).get('root', './data')
        
        # 如果是相对路径，相对于项目根目录
        project_root = Path(__file__).parent.parent.parent
        self.data_root = Path(root)
        if not self.data_root.is_absolute():
            self.data_root = project_root / self.data_root
        
        # 子目录配置
        self.downloads_dir = self.data_root / config.get('storage', {}).get('downloads', 'downloads')
        self.preprocessed_dir = self.data_root / config.get('storage', {}).get('preprocessed', 'preprocessed')
        self.graph_dir = self.data_root / config.get('storage', {}).get('graph', 'graph')
        
        # 自动创建目录
        if config.get('storage', {}).get('auto_create', True):
            self._ensure_dirs()
    
    def _ensure_dirs(self):
        """确保目录存在"""
        for dir_path in [self.data_root, self.downloads_dir, self.preprocessed_dir, self.graph_dir]:
            dir_path.mkdir(parents=True, exist_ok=True)
    
    def get_download_path(self, space_key: str) -> Path:
        """获取空间下载目录"""
        path = self.downloads_dir / space_key
        path.mkdir(parents=True, exist_ok=True)
        return path
    
    def get_preprocessed_path(self, space_key: str, stage: str) -> Path:
        """获取预处理输出目录"""
        path = self.preprocessed_dir / space_key / stage
        path.mkdir(parents=True, exist_ok=True)
        return path
    
    def get_graph_path(self, space_key: str) -> Path:
        """获取图谱数据目录"""
        path = self.graph_dir / space_key
        path.mkdir(parents=True, exist_ok=True)
        return path
    
    def check_disk_space(self, min_free_gb: float = 10.0) -> bool:
        """检查磁盘空间"""
        import shutil
        total, used, free = shutil.disk_usage(self.data_root)
        free_gb = free / (1024 ** 3)
        return free_gb >= min_free_gb
    
    def get_relative_path(self, absolute_path: Path) -> str:
        """获取相对于数据根目录的路径（用于存储和展示）"""
        try:
            return str(absolute_path.relative_to(self.data_root))
        except ValueError:
            return str(absolute_path)
```

### 4.2 路径使用示例

```python
# 错误示例（硬编码）❌
data_dir = "/home/user/project/data"
download_dir = data_dir + "/downloads"

# 正确示例（动态解析）✅
resolver = PathResolver(config)
download_dir = resolver.get_download_path("YASSTORAGE")
# 输出：/actual/data/root/downloads/YASSTORAGE

# 存储相对路径（用于数据库和前端展示）
relative_path = resolver.get_relative_path(download_dir)
# 输出：downloads/YASSTORAGE
```

---

## 五、服务发现与通信

### 5.1 前端 API 地址配置

```javascript
// frontend/src/config/api.js

const runtimeConfig = window.__APP_CONFIG__ || {}

const API_CONFIG = {
  // 默认同源，换机器或端口时不需要重新构建前端。
  baseURL: runtimeConfig.apiBaseUrl || '',
  eventBaseURL: runtimeConfig.eventBaseUrl || '',
  timeout: 30000,
}

export default API_CONFIG
```

开发环境如果需要跨域访问，由启动脚本生成 `runtime-config.json`；不得把局域网 IP 或服务器数据路径写入前端源码。

### 5.2 后端 CORS 配置

```python
# backend/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

app = FastAPI()

# CORS 配置（从环境变量读取）
cors_origins = os.getenv(
    'CORS_ORIGINS', 
    'http://localhost:3000,http://localhost:5173'
).split(',')

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 5.3 容器部署边界

当前设计和实施不包含容器部署。未来需要容器化时，应另建部署设计，复用本文的运行时配置、资源 ID 和动态路径原则，不在前端源码中新增环境相关常量。

---

## 六、前端信息架构与页面设计

### 6.0 全局应用框架

前端采用“独立路由页面 + 当前素材批次上下文”，而不是四个互不关联的平级 Tab。

| 路由 | 页面 | 核心职责 |
|------|------|----------|
| `/pingcode-materials/spaces` | 素材空间 | 浏览空间、筛选页面、定义包含/排除规则 |
| `/pingcode-materials/batches` | 素材批次列表 | 查看全部批次、状态、更新时间和异常 |
| `/pingcode-materials/batches/:batchId/download` | 批次下载 | 查看下载进度、文件清单、失败项和日志 |
| `/pingcode-materials/batches/:batchId/preprocess` | 加工任务 | 扫描问题、预览效果、运行流水线、发布数据集 |
| `/pingcode-materials/batches/:batchId/quality` | 质量分析 | 查看覆盖、追溯、关系质量和检索验证 |

全局区域包含：产品入口、当前批次切换器、PingCode 登录状态、后端连接状态、运行中任务入口。路由必须可直接刷新和分享，批次 ID、筛选参数和视图状态不得只保存在组件内存中。

### 6.1 页面 1：素材空间

**功能**：连接 PingCode，浏览空间列表，展开文档树，按条件筛选后加入下载队列。

“素材空间”不是配置文件中的静态目标列表，而是 PingCode 远端空间到本地素材空间的显式映射：

```text
PingCode 远端空间
  spaceId + spaceKey + remoteName
        ↓ 映射
本地素材空间
  localName + localSlug + logicalPath + enabled
        ↓ 产生
素材批次、下载文件、预处理版本和质量报告
```

- 左侧空间列表必须来自当前账号可访问的 PingCode 空间接口；
- 每个远端空间展示空间名称、Key、颜色、归档状态和映射状态；
- 未映射空间允许浏览文档树，但不能创建素材批次；
- 映射保存本地展示名称、稳定目录标识、逻辑目录和启用状态；
- 本地逻辑目录示例为 `spaces/yasstorage`，前端不展示服务器绝对路径；
- 空间名称变化时保留 `spaceKey` 和映射关系，并更新远端名称快照；
- 删除或无权限空间应标记不可用，不自动删除已有本地素材和批次。

```
┌─────────────────────────────┬──────────────────────────────────┐
│  🔍 搜索空间...              │  筛选条件                         │
│                             │  ┌────────────────────────────┐  │
│   空间列表                 │  │ 关键词：[____________]      │  │
│  ├─  YASSTORAGE          │  │ 文件类型：docx ☑pptx ☑pdf  │  │
│  │  ├─  主页             │  │           ☑md  ☑txt         │  │
│  │  ├─ 📂 存储引擎         │  │ 最大深度：[10 ▼]            │  │
│  │  │  ├─  内幕文档(60)  │  │ 跳过空页面：☑              │  │
│  │  │  ├─ 📂 技术积累      │  │ 跳过已删除：☑              │  │
│  │  │  └─ 📂 性能优化      │  │ 并发线程：[5 ▼]             │  │
│  │  ├─  OKR              │  └────────────────────────────┘  │
│  │  └─  团队管理         │                                   │
│  ├─ 📂 YASDOC              │  已选：3 个页面，45 个附件         │
│  │  ├─  文档1            │  ────────────────────────────┐  │
│  │  └─ 📄 文档2            │  │ 📄 内幕文档 (60 附件)       │  │
│  ─ 📂 YASPLAN             │  │ 📄 存储引擎-Coast (1 附件)  │  │
│                             │  │  索引内幕文档 (2 附件)    │  │
│  [🔄 刷新] [🔗 登录状态:✅]  │  └────────────────────────────┘  │
│                             │                                   │
│                             │     [📥 加入下载队列]             │
└─────────────────────────────┴──────────────────────────────────┘
```

**交互细节**：
- 文件浏览默认使用树状模式，并通过浏览器本地偏好记住用户上次选择；平铺模式展示同一份完整空间索引
- 树结构严格复现 PingCode 的真实父子关系，不增加合成空间根节点，也不把父节点缺失的页面提升为根节点
- 首次访问或手动刷新时先同步完整空间索引；同步过程中显示“已去重页面数 / PingCode 报告总数”，完成前不得标记为全量
- 每个节点显示附件数量徽章
- 勾选框支持全选/半选/取消
- 右侧实时显示已选统计
- 登录状态显示在左下角，过期时弹出重新登录
- 树使用虚拟滚动，搜索和复杂筛选由后端执行
- 勾选父节点生成“包含整个子树”规则，不要求先加载全部子节点
- 用户取消某个后代节点时，生成独立排除规则
- 页面正文与附件可分别选择，默认同时选择；附件类型留空表示下载全部允许类型
- `.sql` 属于数据库知识素材，允许下载；源码、脚本、可执行文件默认排除；`.zip/.tar/.7z` 默认不自动下载
- 提交前显示预计页面数、附件数、容量、无法访问项和来源完整性
- 如果空间受接口上限影响，只能获得部分页面，必须显示“数据不完整”，禁止显示为“全量”
- 创建批次后保存来源规则和来源快照，后续页面围绕该批次继续操作

#### 6.1.1 PingCode 完整目录采集

旧接口 `GET /api/wiki/spaces/{spaceKey}/pages?limit=1000` 会截断到 1000 条并忽略已验证的分页参数，不能再作为空间树数据源。完整目录改用 PingCode 页面本身使用的原生接口：

```text
GET /api/wiki/spaces/{spaceId}/page-tree-v2?scene=simple&only_fetch=root
GET /api/wiki/spaces/{spaceId}/page-tree-v2?scene=simple&only_fetch=child&pi={pageIndex}
```

其中 `spaceId` 取空间发现接口返回的内部 `_id`，不能用 `spaceKey` 替代。`root` 请求用于获得真实根节点和分页元数据；`child` 从 `pi=0` 遍历至 `page_count - 1`。子分页会重复携带祖先节点，因此必须以页面 `_id` 去重，不能按响应数组长度累加进度。

完整采集接口与伪代码：

```python
def get_page_tree_root(space_id: str) -> PageTreePage: ...
def get_page_tree_children(space_id: str, page_index: int) -> PageTreePage: ...
def get_complete_page_tree(space_id: str, progress_callback=None) -> CompletePageTree: ...

root_page = get_page_tree_root(space_id)
pages_by_id = index_by_id(root_page.value)
for page_index in range(root_page.page_count):
    child_page = get_page_tree_children(space_id, page_index)
    assert child_page.count == root_page.count
    merge_by_id(pages_by_id, child_page.value)
    progress_callback(unique=len(pages_by_id), total=root_page.count)

unresolved = pages whose parent_id is not empty and not in pages_by_id
complete = len(pages_by_id) == root_page.count and not unresolved
```

完整性验收规则：

1. 以 API `count` 与去重后的页面数相等作为数量验收，不使用原始响应条数；
2. 只有 `parent_id` 为空的节点才是真实根节点；
3. 非空 `parent_id` 在完整索引中不存在时记入 `unresolvedParentIds`，禁止提升为根；
4. 同级节点按 `position` 升序、再按 `identifier/short_id/name` 稳定排序；
5. 全量构建后再计算 `depth`、面包屑和后代关系；
6. 任一分页失败、总数变化或存在悬空父节点时返回 `partial`，前端保留诊断和重试入口；
7. 完整索引按空间持久化，进程重启后可先展示上次完整快照，再由用户刷新。
8. 预估接口必须返回 `pageEstimateState/attachmentEstimateState`，取值为 `exact/upper_bound/unknown`。当整个空间的 `word_count` 或 `attachment_count` 元数据恒为零时，禁止据此把已选页面过滤为零或把附件数声明为精确零；页面按规则匹配数作为上界，附件显示为“待下载确认”。

### 6.2 页面 2：素材批次与下载管理

**功能**：管理下载队列，显示实时进度，支持暂停/重试/取消。

```
┌──────────────────────────────────────────────────────────────────┐
│  下载任务列表                                      [+ 新建任务]    │
──────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌─ 任务 #1: YASSTORAGE 全量下载 ─────────────────────────────┐  │
│  │ 状态：🟢 下载中 (67%)                                       │  │
│  │ ┌──────────────────────────────────────────────────────┐    │  │
│  │ │████████████████████████░░░░░░░░░░ 67/100 页面         │    │  │
│  │ ──────────────────────────────────────────────────────┘    │  │
│  │ 速度：2.3 MB/s | 剩余：约 3 分钟 | 线程：5/5                │  │
│  │                                                             │  │
│  │ 当前文件：存储引擎-Coast.pptx (1.2 MB)                       │  │
│  │                                                             │  │
│  │ [⏸ 暂停]  [🔄 重试失败]  [ 取消]  [📋 日志]               │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌─ 任务 #2: YASDOC 关键词"存储" ──────────────────────────────┐  │
│  │ 状态：✅ 完成 (100%) | 43 文件，11 MB | 耗时 2m 30s         │  │
│  │ [ 打开目录]  [🔄 重新下载]  [ 查看报告]                  │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌─ 任务 #3: YASSTORAGE 仅索引 ────────────────────────────────┐  │
│  │ 状态：🔴 失败 | 错误：Session 过期                            │  │
│  │ [ 重新登录]  [🔄 重试]  [❌ 删除]                          │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                    │
──────────────────────────────────────────────────────────────────┘
```

**功能点**：
- 实时进度条（页面进度 + 文件进度）
- 下载速度、剩余时间估算
- 失败文件单独列出，支持单独重试
- 日志面板可展开查看脱敏后的任务日志，禁止展示 Cookie、密码和完整认证头
- 支持多任务并行（队列管理）
- 页面刷新或网络恢复后，按任务 ID 恢复当前进度
- 批次详情同时展示来源规则、来源快照和实际下载结果的差异
- 文件清单支持按页面、附件类型、状态和更新时间筛选
- 局域网用户通过浏览器在线预览、单文件下载或批次打包下载
- 前端只展示逻辑目录和相对资源路径，不展示服务器绝对路径
- “打开目录”只在后端确认请求来自服务器本机且系统支持时显示；远程访问不显示该操作

#### 6.2.1 批次任务级三步导航

每个素材批次包含“下载文件、加工任务、质量分析”三个独立步骤页面。三个页面保持独立路由和独立数据加载职责，不合并为单页，也不因批次已进入后续阶段而隐藏前序页面。

**路由与组件接口**：

```text
/pingcode-materials/batches/:batchId/download    -> 下载文件
/pingcode-materials/batches/:batchId/preprocess  -> 加工任务
/pingcode-materials/batches/:batchId/quality     -> 质量分析

BatchStepNav
  input:
    batchId: string
  derived:
    currentStep: download | preprocess | quality
  output:
    三个顺序固定、文案一致、可点击的任务步骤入口
```

工作台与批次列表继续使用批次状态返回的 `recommendedAction.route`，可直接进入当前最需要处理的步骤。进入任一步骤页面后，页面必须使用同一个共享任务级导航组件，使用户能够回看完整批次生命周期。该设计不新增后端 API，也不修改现有推荐动作、任务状态或数据集状态的计算逻辑。

**伪代码**：

```text
function openBatchFromWorkbench(batch):
    navigate(batch.recommendedAction.route)

component BatchStepNav(batchId):
    steps = [
        { key: "download", label: "下载文件", route: batchRoute(batchId, "download") },
        { key: "preprocess", label: "加工任务", route: batchRoute(batchId, "preprocess") },
        { key: "quality", label: "质量分析", route: batchRoute(batchId, "quality") }
    ]

    currentStep = resolveStepFromCurrentRoute()

    for step in steps:
        renderNavigationItem(
            label = step.label,
            active = step.key == currentStep,
            disabled = false,
            onClick = navigate(step.route)
        )

page DownloadPage(batchId):
    render BatchStepNav(batchId)
    render download content

page PreprocessPage(batchId):
    render BatchStepNav(batchId)
    render preprocess content

page QualityPage(batchId):
    render BatchStepNav(batchId)
    render quality content
```

**交互规则**：

1. 三个页面始终显示同一组三步导航，顺序固定为“下载文件、加工任务、质量分析”；
2. 当前路由对应的步骤使用高亮状态，并通过文字或可访问属性表达当前步骤，不能只依赖颜色；
3. 已完成步骤仍然可点击回看，不因任务状态完成而禁用；
4. 步骤切换只改变页面路由，必须保持同一个 `batchId`；
5. 浏览器刷新后根据当前 URL 恢复当前步骤，不强制跳回推荐步骤；
6. 工作台推荐动作负责“进入当前步骤”，任务级导航负责“查看完整流程”，两者职责不可混用。

**验收标准**：

1. 从工作台打开已有数据集的批次时，可以按 `recommendedAction.route` 直接进入质量分析；
2. 下载文件、加工任务和质量分析三个页面顶部均展示相同的任务级三步导航；
3. 在任一步骤点击另外两个步骤后，页面内容和 URL 正确切换且 `batchId` 不变；
4. 每个页面仅高亮自身步骤，已完成的前序步骤仍可进入；
5. 刷新任一步骤页面后仍停留在该步骤，且导航高亮正确；
6. 实现不新增后端 API，不改变工作台推荐动作及批次状态判断；
7. 前端构建通过，并使用一个已完成加工的真实批次完成三个页面的浏览器切换验证。

### 6.3 页面 3：加工任务与质量门禁

**功能**：对已下载文档执行六步骤知识加工，展示源文件、元数据、规则处理结果、按需语义补充、质量问题和最终图谱产物。

详细执行契约见 `docs/04-pingcode-processing-e2e-framework-design.md`。页面只展示稳定的六个业务步骤，扫描、规范化、结构解析、分块、不确定项识别、Schema 校验和证据偏移校验作为步骤内部事件展示，不再拆成独立流水线步骤。

页面主流程为：选择素材批次 -> 扫描和预览 -> 点击开始 -> 后端自动检查继承的文档生成器模型配置 -> 展示调用量与耗时确认 -> 执行六步骤加工 -> 查看质量问题 -> 生成候选数据集。页面不显示模型配置，也不新增独立“模型运行”页面。

六步骤定义：

| 阶段 | 执行方 | 前端重点展示 |
|---|---|---|
| 资料预处理 | 代码 | 文件数、分块数、解析警告、失败文件和耗时 |
| 元数据构建 | 代码 | 文档摘要、分类、关键词、标题路径、相邻分块摘要和缺失项 |
| 确定知识提取 | 代码 | 规则确定知识数、需要语义补充数、输入不完整数 |
| 语义补充 | 大模型按需 | 实际调用项、成功/失败、跳过原因、Token 和耗时；无不确定项时显示已跳过 |
| 知识校验与合并 | 代码 | 通过、排除、需人工复核、证据偏移和合并结果 |
| 图谱与数据集生成 | 代码 | 节点数、证据关系数、最终知识文件、质量报告和候选数据集状态 |

“不确定项识别”是确定知识提取步骤内部的代码路由，不作为前端可见步骤或独立页面。前端只展示统计和质量问题，不提供“保留/排除/稍后处理”业务操作；后续人工复核能力另行设计。

当前实施状态：加工任务前端已先行切换为六步骤展示，并兼容读取现有五阶段历史任务；元数据构建以兼容说明补位，旧 `validation_graph` 和 `dataset_generation` 分别映射为“知识校验与合并”和“图谱与数据集生成”。该兼容映射仅用于前端过渡，后端仍需按六步骤接口和产物契约重新实现。

加工页面必须提供：

- 扫描摘要：格式分布、空文件、乱码、重复内容、解析失败和缺失来源信息；
- 三栏工作台：源文件、六步骤流水线和实时活动；
- 前后对照：原文件片段、规范化结果、清洗结果和分块边界；
- 阶段产物：输入数、规则确定数、语义补充数、排除数、失败数和产物版本；
- 阶段耗时：开始时间、结束时间、已用时间、当前对象和阶段内数量进度；
- 中文状态：等待中、执行中、已完成、失败和已跳过；
- 中文失败详情：主提示展示归类原因，原始异常只在“技术信息”折叠区查看；
- 实时活动：SSE 追加脱敏事件，刷新和重连后补齐历史日志，断线时轮询降级；
- 质量问题：输入缺失、证据不足和语义无法确定项只展示来源、证据和原因，不自动进入候选图谱；
- 启动检查：自动复用最近 10 分钟相同配置的结构化连接测试，展示文档数、分块数、预计语义补充调用量、耗时和风险；
- 模型审计：详情抽屉按调用展示模型、Prompt 版本、对应不确定项 ID、Token、耗时、重试和脱敏输入输出；
- 发布门禁：高严重度质量问题未解决时不得正式发布。

#### 加工工作台界面简图

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│ 加工任务 / 批次名称             运行中 42%  已用 03:42  预计剩余 05:10  [停止] │
│ task_xxx · 最近更新 11:26:08                              SSE 实时连接 ●       │
├──────────────────────────────────────────────────────────────────────────────────┤
│ 文档 42 │ 分块 186 │ 规则确定 326 │ 语义补充 18 │ 质量问题 3 │ 图谱关系 340 │
├──────────────────────┬────────────────────────────────────┬──────────────────────┤
│ 源文件               │ 六步骤加工流水线                   │ 实时活动             │
│ [全部][失败][质量问题]│                                    │ 11:26:08 规则提取完成 │
│ 🔎 搜索文件          │ ● 1 资料预处理       已完成  02:12 │ 参数类型映射.md      │
│                      │   42 文档 / 186 分块 / 2 警告      │                      │
│ ● 参数类型映射.md    │ ● 2 元数据构建       已完成  00:18 │ 11:26:05 元数据完成   │
│   执行中 · 8/12 块   │   摘要 42 / 分类 42 / 缺失 1       │ 标题路径已生成       │
│                      │                                    │                      │
│ ✓ 错误码说明.md      │ ● 3 确定知识提取     已完成  00:30 │ 11:26:03 规则提取完成 │
│   规则完成 · 0次模型 │   规则确定 326 / 语义补充 18       │ 发现 18 个不确定项   │
│                      │                                    │                      │
│ ! DML兼容性.md       │ ◉ 4 按需语义补充     执行中  00:42 │ 11:26:01 模型调用失败 │
│   语义补充失败 1项   │   12/18 成功 / 1 失败 / 5 等待     │ 调用超时 [查看详情]  │
│                      │ ○ 5 知识校验与合并   等待中  --    │ 质量问题             │
│                      │ ○ 6 图谱与数据集生成 等待中  --    │ 证据不足 3项         │
└──────────────────────┴────────────────────────────────────┴──────────────────────┘
```

交互约定：

1. 点击源文件时，流水线和实时活动只显示该文件相关统计与事件；
2. 点击阶段时，源文件列表按该阶段状态筛选，右侧显示阶段内部事件；
3. 点击失败或质量问题时打开详情抽屉，展示中文原因、来源、分块、证据、耗时和可重试性；
4. 语义补充必须说明“为什么调用模型”，并展示对应不确定项类型，不显示完整文档输入；
5. 无不确定项时语义补充显示“规则结果明确，无需调用模型，因此跳过”；
6. 任务结束后显示总耗时和每阶段实际耗时；
7. 窄屏下切换为“流水线 / 文件 / 活动”三个页签，不增加独立不确定项页签。

### 6.4 页面 4：质量分析、图谱与检索验证

**功能**：解释数据集是否完整、是否可追溯、关系是否可信，并提供局部图谱探索和检索验证。

```
┌──────────────────────────────────────────────────────────────────┐
│  图谱分析                                          [🔄 刷新数据]   │
──────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ─ 核心指标对比 ──────────────────────────────────────────────┐  │
│  │                                                             │  │
│  │  指标          预处理前      预处理后      变化               │  │
│  │  ─────────    ─────────    ────────    ───────             │  │
│  │  文档节点数     43           156          +263% 🟢           │  │
│  │  实体节点数     0            342          +∞    🟢           │  │
│  │  关系边数       0            587          +∞               │  │
│  │  图谱密度       0.00         0.034        +    🟢           │  │
│  │  平均度         0.00         3.42         +∞    🟢           │  │
│  │  覆盖度*        12%          78%          +550%  🟢          │  │
│  │  关联度**       0.00         0.67         +∞    🟢           │  │
│  │                                                             │  │
│  │  *示意数据，正式指标采用来源覆盖、追溯和关系质量定义             │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌─ 图谱可视化 ────────────────────┬─ 实体分布 ────────────────┐  │
│  │                                 │                           │  │
│  │     (力导向图可视化区域)           │  技术术语  ████████ 156   │  │
│  │                                 │  模块名    ██████   98    │  │
│  │     每个节点 = 文档/实体          │  人名      ███      45    │  │
│  │     每条边 = 共现/引用关系        │  概念      ██       32    │  │
│  │                                 │  其他      █        11    │  │
│  │     支持：缩放、拖拽、点击详情    │                           │  │
│  │                                 │  ──────────────────────  │  │
│  │                                 │  关系类型分布              │  │
│  │                                 │  包含    ████████ 234     │  │
│  │                                 │  引用    █████    156     │  │
│  │                                 │  相关    ████     120     │  │
│  │                                 │  作者    ██       77      │  │
│  └─────────────────────────────────┴───────────────────────────┘  │
│                                                                    │
│  ┌─ 文档覆盖度热力图 ──────────────────────────────────────────┐  │
│  │                                                             │  │
│  │  行 = 文档，列 = 实体类型                                     │  │
│  │  颜色深浅 = 该文档包含该类型实体的数量                         │  │
│  │                                                             │  │
│  │           技术术语  模块名  人名  概念  其他                   │  │
│  │  内幕文档   ████    ███    ██    █     ░                     │  │
│  │  存储引擎   ███     ████   ░     ██    ░                     │  │
│  │  OKR        ░       ░      ████  ░     █                     │  │
│  │  ...                                                        │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌─ 向量检索测试 ────────────────────────────────────────────┐  │
│  │  输入查询：[存储引擎的索引结构是怎么设计的？            ] [🔍] │  │
│  │                                                             │  │
│  │  Top-5 结果：                                                │  │
│  │  1. [0.92] 索引内幕文档.docx → "B+ 树是索引的核心结构..."     │  │
│  │  2. [0.87] 存储引擎-Coast.pptx → "Coast 使用 LSM-tree..."  │  │
│  │  3. [0.81] 表空间.docx → "表空间管理涉及索引分配..."         │  │  │
│  │  4. [0.76] 数据缓存区.docx → "缓存区与索引页的交互..."       │  │  │
│  │  5. [0.71] 内幕文档.md → "索引模块负责..."                   │  │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

正式页面不得把“节点越多、边越多、密度越高”直接标记为质量提升。默认核心指标调整为：

| 指标 | 含义 | 是否可下钻 |
|------|------|------------|
| 来源覆盖率 | 已纳入数据集的有效来源 / 来源快照中的有效来源 | 是，查看遗漏来源 |
| 来源可追溯率 | 可回到页面、附件及文本位置的知识块占比 | 是，查看断链条目 |
| 解析成功率 | 成功生成有效文本的文件占比 | 是，查看失败文件 |
| 孤立文档率 | 没有任何可信关系的文档占比 | 是，查看孤立文档 |
| 跨文档关系率 | 连接不同来源文档的可信关系占比 | 是，查看关系证据 |
| 关系置信度 | 关系提取置信度分布及低置信度比例 | 是，查看原文证据 |
| 抽样准确率 | 人工抽样确认正确的实体和关系占比 | 是，进入抽样复核 |
| 检索验证结果 | 固定查询集的命中率、相关性和来源覆盖 | 是，查看每条查询 |

“处理前”基线定义为来源文档树、页面超链接和附件归属关系；“处理后”在同一来源快照上增加知识块、实体和提取关系。两者必须基于同一个批次和同一个来源快照比较。

力导向图仅用于筛选后的局部子图，默认不一次加载万级节点。用户点击实体、关系或检索结果时，必须能够追溯到空间、页面、附件、文本片段、处理版本和提取证据。

### 6.5 通用页面状态与可用性要求

所有页面都必须覆盖：首次加载、加载中、空数据、部分成功、权限不足、登录过期、后端断开、任务恢复、操作冲突和未知错误状态。

- 使用统一错误摘要和可执行的恢复操作，不只显示后端错误字符串；
- 长列表、文档树、日志和图谱节点列表使用虚拟滚动或分页；
- 主要流程支持键盘操作，状态不能只通过颜色表达；
- 以桌面工作台为主要目标，窄屏下允许侧栏收起，但不得隐藏核心任务状态；
- 页面操作离开前如存在未提交选择或配置，必须提示保存或放弃；
- 所有删除、取消和覆盖操作明确影响范围，危险操作需要二次确认。

---

## 七、后端 API 设计（FastAPI）

### 7.1 API 路由

```python
# 1. PingCode 代理
POST   /api/pingcode/login              # CAS 登录
GET    /api/pingcode/spaces             # 获取空间列表
GET    /api/pingcode/space-mappings     # 获取本地素材空间映射
PUT    /api/pingcode/spaces/{key}/mapping # 创建或更新空间映射
GET    /api/pingcode/spaces/{key}/tree  # 获取空间文档树
GET    /api/pingcode/spaces/{key}/pages # 获取页面列表（支持筛选参数）
POST   /api/pingcode/spaces/{key}/sync  # 刷新完整空间索引并返回同步结果

# 2. 素材批次
POST   /api/material-batches             # 按来源选择规则创建批次
GET    /api/material-batches             # 获取批次列表（分页/筛选）
GET    /api/material-batches/{id}        # 获取批次、来源快照和当前任务
PATCH  /api/material-batches/{id}        # 修改批次名称等可编辑信息
GET    /api/material-batches/{id}/files  # 获取逻辑文件树和文件状态
GET    /api/material-batches/{id}/report # 获取批次报告

# 3. 下载管理
POST   /api/download/tasks              # 创建下载任务
GET    /api/download/tasks              # 获取任务列表
GET    /api/download/tasks/{id}         # 获取任务详情/进度
POST   /api/download/tasks/{id}/pause   # 暂停任务
POST   /api/download/tasks/{id}/cancel  # 取消任务
POST   /api/download/tasks/{id}/retry   # 重试失败文件
GET    /api/tasks/{id}/events           # SSE 任务事件流

# 4. 文件访问
GET    /api/files/{resourceId}/metadata # 文件元数据和可预览能力
GET    /api/files/{resourceId}/preview  # 浏览器预览内容
GET    /api/files/{resourceId}/download # 单文件下载
POST   /api/material-batches/{id}/archive # 创建批次压缩包下载任务

# 5. 预处理
POST   /api/preprocess/scan             # 扫描源文件并返回问题摘要
POST   /api/preprocess/preview          # 生成选定样例的前后对照
POST   /api/preprocess/pipeline         # 启动预处理流水线
GET    /api/preprocess/pipeline/{id}    # 获取流水线状态
POST   /api/preprocess/pipeline/{id}/stop  # 停止流水线
GET    /api/preprocess/stages           # 获取可用处理阶段
POST   /api/preprocess/pipeline/{id}/retry # 从失败项/阶段恢复
POST   /api/datasets                    # 发布数据集版本

# 5.1 可控加工执行（新执行引擎）
GET    /api/processing/pipelines        # 流水线和版本
POST   /api/processing/runs/preflight   # 启动前检查
POST   /api/processing/runs             # 按不可变配置快照创建运行
GET    /api/processing/runs/{id}        # 运行和阶段快照
GET    /api/processing/runs/{id}/events # 阶段、工作项、模型调用和门禁事件
GET    /api/processing/runs/{id}/model-calls # 模型调用分页列表
POST   /api/processing/runs/{id}/retry  # 从失败工作项恢复
GET    /api/training/tasks?batchId={id} # 恢复批次最近训练任务
GET    /api/training/model-config       # 获取安全模型配置和步骤参数
POST   /api/training/model-test         # 真实结构化模型连接测试
POST   /api/training/preflight          # 计算调用量、预计耗时和启动门禁
GET    /api/training/tasks/{id}/logs    # 分页读取脱敏结构化训练日志
GET    /api/training/tasks/{id}/review-items # 获取待确认项
POST   /api/training/tasks/{id}/review-items/{itemId}/decision # 提交确认决定
GET    /api/processing/skills           # Skill 及已发布版本
GET    /api/processing/prompts          # Prompt 及已发布版本，可按 skillId/version 筛选
GET    /api/processing/prompts/{id}     # Prompt 内容、哈希和相对文件映射
GET    /api/processing/prompts/{id}?version=1.0.0
POST   /api/processing/prompts/{id}/drafts # 创建可编辑草稿
POST   /api/processing/prompt-drafts/{id}/validate # 验证草稿
POST   /api/processing/prompt-drafts/{id}/test # 样例试运行
POST   /api/processing/prompt-drafts/{id}/publish # 发布不可变版本

# 6. 质量与图谱分析
GET    /api/graph/metrics               # 获取图谱指标（预处理前后对比）
GET    /api/graph/nodes                 # 获取节点列表（支持分页/筛选）
GET    /api/graph/edges                 # 获取边列表
GET    /api/graph/visualization         # 获取可视化数据（力导向图格式）
GET    /api/graph/heatmap               # 获取文档 - 实体热力图数据
POST   /api/graph/search                # 向量检索测试
GET    /api/quality/reports/{datasetVersionId} # 获取质量报告
POST   /api/quality/samples/{id}/review # 提交抽样复核结果

# 7. 系统
GET    /api/system/status               # 系统状态（磁盘、内存、服务状态）
GET    /api/system/config               # 获取配置
PUT    /api/system/config               # 更新配置
```

### 7.2 前端接口契约要求

路由名称不是完整接口设计。实现前必须为每个接口补充 OpenAPI Schema，并至少统一以下契约：

```json
{
  "success": false,
  "error": {
    "code": "PINGCODE_SESSION_EXPIRED",
    "message": "PingCode 登录状态已过期",
    "retryable": true,
    "action": "RELOGIN",
    "requestId": "req_xxx",
    "details": {}
  }
}
```

- 列表接口统一使用 `items/page/pageSize/total/hasMore/completeness`；
- 树接口返回 `items/total/reportedTotal/completeness/unresolvedParentIds`；`items` 是完整树，前端由它派生虚拟化平铺列表，避免重复传输万级节点；
- 创建批次和任务支持 `Idempotency-Key`，防止重复点击产生重复任务；
- 前端所有 `Idempotency-Key` 统一通过 `createRequestId()` 生成，禁止页面直接调用 `crypto.randomUUID()`；HTTPS/localhost 优先使用原生 UUID，非安全上下文回退到 `crypto.getRandomValues()` 生成 UUID v4，缺少 Web Crypto 的旧环境使用时间戳和随机数组合标识。该标识只用于请求幂等，不作为认证令牌或安全凭据；
- 所有任务返回稳定任务 ID、状态、阶段、进度、警告、失败项和时间字段；
- 加工任务启动前由后端自动检查继承的文档生成器模型配置和最近 10 分钟内的结构化测试结果；前端确认框只显示文档数、分块数、预计语义补充调用量、耗时和风险；
- 语义无法确定、证据不足或输入缺失项作为质量问题展示，本期不提供独立“不确定项确认”页面和保留/排除操作；
- 文件接口只接受不可猜测的资源 ID，后端负责路径校验和权限控制；
- 配置接口不得返回密码、Cookie、认证头或本地凭证明文；
- 前端错误展示基于稳定错误码，不依赖解析中文错误字符串。

### 7.3 任务事件协议

任务控制继续使用 HTTP，实时进度使用 SSE；SSE 不可用时降级为带退避的轮询。新加工引擎在兼容 `task.progress` 的同时扩展 `run/stage/work_item/model_call/approval` 事件，完整协议见 `docs/05-pingcode-processing-llm-control-design.md`。

```text
event: task.progress
id: 1842
data: {
  "taskId": "task_xxx",
  "batchId": "batch_xxx",
  "state": "running",
  "stage": "download_attachment",
  "completed": 67,
  "total": 100,
  "warnings": 2,
  "failed": 1,
  "updatedAt": "2026-07-24T10:30:00+08:00"
}
```

浏览器重连时携带 `Last-Event-ID`。如果事件已过期，前端先获取任务快照，再继续订阅。详细状态转换见交互详细设计。

### 7.4 配置加载示例

```python
# backend/core/config.py

import os
import yaml
from pathlib import Path
from typing import Optional, Dict, Any
from dotenv import load_dotenv

class Config:
    """配置管理器 - 支持多层级配置加载"""
    
    def __init__(self, config_dir: Optional[str] = None):
        # 加载环境变量
        load_dotenv()
        
        # 配置目录（可外部指定）
        self.config_dir = Path(config_dir) if config_dir else Path(__file__).parent.parent / 'config'
        
        # 加载配置文件
        self.app_config = self._load_yaml('app.yaml')
        self.pingcode_config = self._load_yaml('pingcode.yaml')
        self.preprocess_config = self._load_yaml('preprocess.yaml')
        
        # 合并配置
        self.config = {
            'app': self.app_config,
            'pingcode': self.pingcode_config,
            'preprocess': self.preprocess_config,
        }
    
    def _load_yaml(self, filename: str) -> Dict[str, Any]:
        """加载 YAML 配置文件"""
        filepath = self.config_dir / filename
        if filepath.exists():
            with open(filepath, 'r', encoding='utf-8') as f:
                return yaml.safe_load(f) or {}
        return {}
    
    def get(self, key: str, default: Any = None) -> Any:
        """获取配置项（支持点号分隔的嵌套键）"""
        keys = key.split('.')
        value = self.config
        
        for k in keys:
            if isinstance(value, dict):
                value = value.get(k)
            else:
                return default
            
            if value is None:
                # 尝试从环境变量获取
                env_key = key.upper().replace('.', '_')
                value = os.getenv(env_key)
                
                if value is None:
                    return default
        
        return value
    
    @property
    def data_root(self) -> Path:
        """获取数据根目录"""
        root = self.get('app.storage.root', './data')
        path = Path(root)
        if not path.is_absolute():
            path = Path(__file__).parent.parent.parent / path
        return path
```

---

## 八、数据流

```
用户选择空间范围 → 创建 MaterialBatch 和 SourceSnapshot
    ↓ HTTP 命令 + SSE 状态事件
FastAPI 后端
    ↓ 调用
现有 Python 脚本（space_crawler.py, content_parser.py 等）
    ↓ 结果写入并登记资源 ID
本地文件系统（路径从 PathResolver 获取）+ 批次/任务元数据
    ↓ 预处理引擎读取
ChromaDB（向量）+ NetworkX（图）
    ↓ 查询结果
FastAPI 返回 JSON、预览内容或文件下载流
    ↓
前端按批次渲染文件、进度、质量报告和来源追溯
```

---

## 九、部署方案

### 9.1 开发环境

```bash
# 1. 克隆项目
git clone <repo>
cd pingcode-doc-platform

# 2. 复制配置模板
cp config/.env.example config/.env
# 编辑 .env 修改为实际值

# 3. 启动后端
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 4. 启动前端（新终端）
cd frontend
npm install
npm run dev
```

### 9.2 生产环境

当前阶段只要求在目标机器上以普通进程运行前后端，并通过运行时配置连接服务。进程托管、反向代理、HTTPS 和容器化在部署专项设计中补充。

### 9.3 不同机器部署检查清单

| 检查项 | 命令 | 说明 |
|--------|------|------|
| Python 版本 | `python3 --version` | 需要 3.10+ |
| Node.js 版本 | `node --version` | 需要 18+（仅开发） |
| Docker 版本 | `docker --version` | 当前不检查，容器化阶段再确认 |
| 磁盘空间 | `df -h /` | 至少 10GB 可用 |
| 内存 | `free -h` | 至少 4GB 可用 |
| Chromium | `chromium --version` | Playwright 需要 |
| 网络连通性 | `curl <pingcode_url>` | 需要访问 PingCode |

---

## 十、关键假设 & 待确认项

| 编号 | 假设 | 影响 | 如不成立需调整 |
|------|------|------|----------------|
| 1 | 前端第一阶段用 **Vue 3 + Router** 建设独立页面，组件库优先复用成熟控件 | 组件选型、代码结构 | 最终并入主应用前再次评估框架一致性 |
| 2 | 后端用 **FastAPI** 封装现有脚本 | API 设计、部署方式 | 若直接调用 Python 则无需后端 |
| 3 | 加工采用专项设计中的 **5 阶段流水线**，细粒度规则动作作为阶段内部事件 | 页面、状态机、Worker 和事件协议 | 能力范围变化时通过 Pipeline 版本调整 |
| 4 | 质量指标以**来源覆盖、可追溯、解析质量、关系可信度和检索验证**为核心 | 图表类型、下钻逻辑 | 指标口径变更时必须保留版本 |
| 5 | Embedding 通过 Provider 接口配置，本地模型和服务器模型均可接入 | 内存、服务依赖、维度和索引版本 | Provider 变化不修改前端契约 |
| 6 | 知识点、实体和关系采用 **规则优先 + 不确定项语义补充 + 代码校验** | 提取精度、调用成本、审计和质量门禁 | 领域规则和不确定项类型变化时调整路由策略 |
| 7 | 数据规模：**千级文档、万级实体** | 前端默认使用虚拟滚动、分页和局部图谱 | 更大规模时调整服务端聚合能力 |
| 8 | 当前以独立路由页面接入「YashanDB 知识库文档生成器」 | 路由设计、状态管理 | 主应用框架统一后再进行组件级整合 |
| 9 | **所有配置外部化**，支持不同机器部署 | 配置管理、部署脚本 | 若有硬编码需重构 |
| 10 | **路径动态解析**，支持相对路径和绝对路径 | 路径管理、数据迁移 | 若固定路径需简化 |
| 11 | 所有流程围绕稳定的 **MaterialBatch** 展开 | 页面上下文、任务关联、质量追溯 | 无批次模型会导致页面状态割裂 |
| 12 | 当前阶段不实施容器部署 | 排期、验收、运行说明 | 容器化另立设计和实施任务 |
| 13 | FastAPI 作为控制面，Processing Worker 通过 SQLite 租约领取任务 | 任务恢复、并发、部署和审计 | 引入外部队列时保持运行契约不变 |

---

## 十一、实施建议

| 阶段 | 内容 | 预计时间 |
|------|------|----------|
| **Phase 1** | 明确 MaterialBatch、任务状态机、OpenAPI 和 SSE 契约 | 2 天 |
| **Phase 2** | Vue 独立页面骨架、运行时配置、路由和全局状态 | 2 天 |
| **Phase 3** | 素材空间、虚拟树、选择规则、批次创建 | 3 天 |
| **Phase 4** | 下载进度、文件清单、在线预览、失败重试 | 3 天 |
| **Phase 5** | 扫描、样例预览、加工任务、质量门禁和数据集版本 | 4 天 |
| **Phase 6** | 质量指标、来源追溯、局部图谱和检索验证 | 4 天 |
| **Phase 7** | 真实后端 API 联调、断线恢复、权限和可用性测试 | 3 天 |
| **Phase 8** | Processing Worker、SQLite 运行库和阶段事件 | 4 天 |
| **Phase 9** | Prompt/Skill 草稿、验证、试运行、发布和权限 | 4 天 |
| **Phase 10** | 图片说明、摘要分类、知识提取和语义复核 | 6 天 |
| **Phase 11** | Embedding、证据图谱、人工门禁和质量闭环 | 4 天 |
| **Phase 12** | 真实模型全流程、故障恢复和浏览器验收 | 3 天 |

原前端和基础加工范围预计约 21 个工作日；新增 LLM 可控加工范围初步增加约 21 个工作日。该排期为设计阶段估算，需在 Provider、认证方案和真实数据规模确定后校准。

容器部署不在当前阶段，后续单独建立部署设计和验收计划，不阻塞前端功能建设。

---

## 十二、相关文件

- 设计文档：`docs/02-pingcode-frontend-design.md`（本文件）
- 前端交互详细设计：`docs/03-pingcode-frontend-interaction-detail.md`
- LLM 可控加工专项设计：`docs/05-pingcode-processing-llm-control-design.md`
- 配置模板：`config/.env.example`
- 应用配置：`config/shared/application.yaml`
- PingCode 配置：`config/pingcode/processing.yaml`
- 预处理配置：`config/shared/preprocessing.yaml`
- Docker 配置：`docker-compose.yml`（后续规划，当前不实施）
- 后端代码：`backend/`
- 前端代码：`frontend/`
