# PingCode 素材下载系统 - 实施阶段计划

> 版本：v1.3  
> 日期：2026-07-24

## 阶段总览

| 阶段 | 内容 | 状态 | 完成时间 |
|------|------|------|----------|
| Phase 1 | API 客户端 + 树构建器 | ✅ 完成 | 2026-07-23 |
| Phase 2 | 文件名工具 + 空间爬虫 | ✅ 完成 | 2026-07-23 |
| Phase 3 | 索引生成 + 已有数据整合 | ✅ 完成 | 2026-07-23 |
| Phase 4 | CLI 完善 + 文档更新 | ✅ 完成 | 2026-07-23 |
| Phase 5 | 集成测试 + 优化 | ✅ 完成 | 2026-07-23 |
| Web Phase 1 | 批次模型、后端契约和真实下载闭环 | ✅ 完成 | 2026-07-24 |
| Web Phase 2 | Vue 独立页面和远程文件访问 | ✅ 完成 | 2026-07-24 |
| Web Phase 2.1 | PingCode 空间发现与本地空间映射 | ✅ 完成 | 2026-07-24 |
| Web Phase 3 | 文件扫描、预处理、质量门禁和数据集版本 | ✅ 完成 | 2026-07-24 |
| Web Phase 4 | 来源追溯、局部图谱和检索评测 | ⏳ 待实施 | - |

---

## Phase 1：API 客户端 + 树构建器 ✅

### 已完成功能

- [x] `api_client.py` - PingCode REST API 客户端
- [x] `tree_builder.py` - 目录树构建器
- [x] `content_parser.py` - 文档内容解析器

### 测试验证

- [x] API 客户端测试通过
- [x] 目录树构建测试通过（76 个根节点）
- [x] 内容解析测试通过（1475 字符）

---

## Phase 2：文件名工具 + 空间爬虫 ✅

### 已完成功能

- [x] `filename_utils.py` - 文件名处理工具
- [x] `space_crawler.py` - 空间级爬虫
- [x] `cli/space_crawl.py` - 空间级爬取 CLI

---

## Phase 3：索引生成 + 已有数据整合 ✅

### 已完成功能

- [x] `index_builder.py` - 索引生成器
- [x] `cli/migrate_data.py` - 数据迁移工具

### 迁移结果

- ✅ 43 个附件文件（11 MB）
- ✅ 页面内容（内幕文档.md）

---

## Phase 4：CLI 完善 + 文档更新 ✅

### 已完成功能

- [x] 完善 `cli/space_crawl.py`
- [x] 更新 `docs/usage.md`
- [x] 更新 `docs/design.md`
- [x] 更新 `docs/implementation-plan.md`

---

## Phase 5：集成测试 + 优化 ✅

### 已完成功能

- [x] 完整流程测试
  - 登录 → 获取页面 → 构建树 → 下载 → 生成索引
  
- [x] 数据清理
  - 删除 86 个重复文件
  - 释放 21.8 MB 空间

- [x] 模块验证
  - 11 个核心模块全部导入成功
  - 所有测试通过

### 最终统计

| 项目 | 数量 |
|------|------|
| 核心模块 | 11 个 |
| CLI 工具 | 4 个 |
| 文档 | 3 个 |
| 测试用例 | 2 个 |
| 已迁移文件 | 43 个（11 MB） |
| 页面内容 | 1 个（内幕文档.md） |

---

## 项目交付清单

### 核心代码

- [x] `tools/pingcode-cli/core/` - 11 个核心模块
- [x] `tools/pingcode-cli/cli/` - 4 个 CLI 工具
- [x] `tests/pingcode/` - 2 个测试用例
- [x] `tools/pingcode-cli/examples/` - 2 个使用示例

### 文档

- [x] `docs/design.md` - 设计文档（v2.3）
- [x] `docs/usage.md` - 使用说明（v2.0）
- [x] `docs/implementation-plan.md` - 实施计划（v1.2）

### 数据

- [x] `data/YASSTORAGE/files/` - 43 个附件文件
- [x] `data/YASSTORAGE/pages/` - 1 个页面内容

### 配置

- [x] `config/pingcode.json` - 配置文件

---

## 使用方式

### 快速开始

```bash
# 1. 批量下载整个空间
python3 tools/pingcode-cli/cli/space_crawl.py --space YASSTORAGE

# 2. 按关键词筛选
python3 tools/pingcode-cli/cli/space_crawl.py --space YASDOC --keyword "存储引擎"

# 3. 只生成索引
python3 tools/pingcode-cli/cli/space_crawl.py --space YASSTORAGE --index-only

# 4. 整合已有数据
python3 tools/pingcode-cli/cli/migrate_data.py
```

### Python API

```python
from pingcode import PingCodeConfig, SpaceCrawler, IndexBuilder
from pathlib import Path

config = PingCodeConfig()
crawler = SpaceCrawler(config, Path('data'))
result = crawler.crawl_space('YASSTORAGE')

index_builder = IndexBuilder(
    space_key='YASSTORAGE',
    space_name='YashanDB 存储引擎',
    tree=result.tree,
    pages=result.pages
)
index_builder.save_json(Path('data/YASSTORAGE/index.json'))
```

---

## 后续扩展

- [ ] 支持更多页面类型
- [ ] 增量爬取
- [ ] 并发下载优化（纯 API token 方式）
- [ ] 文档格式转换（docx → markdown）
- [x] 使用 `page-tree-v2` 获取完整空间目录，按页面 ID 去重并校验总数
- [x] 严格保持 PingCode 根节点、父子关系和 `position` 顺序，记录悬空父节点诊断
- [x] 前端树/平铺模式记忆、完整索引虚拟滚动和 Monaco Markdown 对照预览
- [x] 附件默认策略：允许 `.sql`，排除代码/脚本/可执行文件，压缩包默认跳过
- [x] Web Phase 3：源文件扫描、样例预览和预处理任务
- [x] Web Phase 3：质量门禁和数据集版本
- [ ] Web Phase 4：Office/PDF 文本转换器和来源偏移追溯
- [ ] Web Phase 5：局部图谱和固定查询集检索验证
- [ ] Processing Phase 1：FastAPI 控制面、SQLite 运行库和独立 Worker
- [x] Processing Phase 1A：文件化 Skill Registry、四个首批 Skill 和版本查询 API
- [x] Processing Phase 1B：Prompt 文件 Registry、版本校验和只读查询 API
- [x] Processing Phase 2A：Prompt 草稿、校验、渲染预览、发布和 Diff
- 未完成项跟踪：`docs/09-pingcode-processing-unfinished-items.md`
- [ ] Processing Phase 2：四个业务 Skill、Prompt 草稿/验证/发布和后端权限
- [ ] Processing Phase 3：图片说明、文档摘要分类、知识提取和语义质量复核
- [ ] Processing Phase 4：Embedding Provider、证据图谱和人工质量门禁
- [ ] Processing Phase 5：真实模型 API、Worker 恢复、SSE 重连和浏览器系统测试
