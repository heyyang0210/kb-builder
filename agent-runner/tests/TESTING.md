# YashanDB Agent Runner — 测试体系说明

> 版本：v1.0  
> 日期：2026-07-23  
> 维护者：YashanDB 知识库团队

---

## 1. 测试全景图

```
┌─────────────────────────────────────────────────────────────────────┐
│                    YashanDB Agent Runner 测试体系                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │
│  │ 🧪 单元测试  │  │ 📦 预处理测试│  │ 🔗 集成测试  │                │
│  │             │  │             │  │             │                │
│  │ agents      │  │ cleaner     │  │ api         │                │
│  │ config-*    │  │ chunker     │  │ document-api│                │
│  │ llm-client  │  │ adapter     │  │ retrieval   │                │
│  │ step-exec   │  │ snapshot    │  │ langgraph   │                │
│  │ tools       │  │ validator   │  │             │                │
│  │ workflow    │  │ pipeline    │  │             │                │
│  │ yaml-proc   │  │             │  │             │                │
│  │ query-build │  │             │  │             │                │
│  └─────────────┘  └─────────────┘  └─────────────┘                │
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐                                  │
│  │ 🎯 功能测试  │  │ 🌐 E2E 测试 │                                  │
│  │             │  │             │                                  │
│  │ button-func │  │ smoke       │                                  │
│  │ kp-1.1.1    │  │ tab-nav     │                                  │
│  │ yaml-format │  │ sidebar     │                                  │
│  │ datatype    │  │ doc-gen     │                                  │
│  │             │  │ workflow    │                                  │
│  │             │  │ retrieval   │                                  │
│  └─────────────┘  └─────────────┘                                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. 测试分类

### 2.1 🧪 单元测试（Unit Tests）

测试单个模块/类的功能，不依赖外部服务。

| 文件 | 测试对象 | 说明 |
|------|----------|------|
| `agents.test.js` | Agent 模块 | Planner/Retriever/Generator/Validator |
| `config-manager.test.js` | 配置管理 | 加密/解密/缓存 |
| `config-validator.test.js` | 配置验证 | 格式/必填项校验 |
| `llm-client.test.js` | LLM 客户端 | API 调用/重试/降级 |
| `step-executor.test.js` | 步骤执行器 | 工作流步骤调度 |
| `tools.test.js` | 工具模块 | MCP/文件读写/搜索 |
| `workflow-engine.test.js` | 工作流引擎 | 流程编排/状态管理 |
| `yaml-metadata-processor.test.js` | YAML 处理 | 元数据解析/生成 |
| `retrieval-query-builder.test.js` | 查询构建 | 关键词/同义词扩展 |

### 2.2 📦 预处理模块测试（Preprocessing Tests）

资料预处理框架的专项测试，包含单元测试和集成测试。

| 文件 | 测试对象 | 类型 | 说明 |
|------|----------|------|------|
| `preprocessing/design-doc-cleaner.test.js` | DesignDocCleaner | 单元 | 6 条清洗规则 |
| `preprocessing/semantic-chunker.test.js` | SemanticChunker | 单元 | 语义分块/保护块/overlap |
| `preprocessing/markdown-adapter.test.js` | MarkdownAdapter | 单元 | 扫描/解析/元数据提取 |
| `preprocessing/snapshot-tracker.test.js` | SnapshotTracker | 单元 | 快照保存/加载/回溯 |
| `preprocessing/quality-validator.test.js` | QualityValidator | 单元 | 清洗/分块/索引验证 |
| `preprocessing/fidelity-evaluator.test.js` | FidelityEvaluator/AssetCaptioner | 单元 | 文本召回、媒体覆盖、图片说明 |
| `preprocessing/image-caption-provider.test.js` | GPT-5.6 图片说明 Provider | 单元 | 官方/第三方端点和请求参数 |
| `preprocessing/libreoffice-renderer.test.js` | LibreOfficeRenderer | 单元/集成 | 命令编排和真实 PPTX 整页渲染 |
| `preprocessing/vision-api.integration.test.js` | 视觉 API | 集成 | 显式启用的真实图片说明请求 |
| `preprocessing/docx-adapter.test.js` | DocxAdapter | 单元 | DOCX 原始媒体保留 |
| `preprocessing/pptx-adapter.test.js` | PptxAdapter | 单元 | PPTX 图片关系、原始字节和幻灯片引用 |
| `preprocessing/pipeline-integration.test.js` | DesignDocPipeline | 集成 | 端到端流水线 |

### 2.3 🔗 集成测试（Integration Tests）

测试模块间交互和系统流程。

| 文件 | 测试对象 | 说明 |
|------|----------|------|
| `api.test.js` | API 接口 | HTTP 端点验证 |
| `document-api.test.js` | 文档 API | 文档 CRUD 操作 |
| `system-retrieval-flow.test.js` | 检索流程 | L1→L2→L3 三层检索 |
| `langgraph-workflow.test.js` | LangGraph 工作流 | 状态图执行 |

### 2.4 🎯 功能测试（Functional Tests）

独立功能验证脚本，通常为一次性验证。

| 文件 | 测试对象 | 说明 |
|------|----------|------|
| `button-functional-test.js` | 前端按钮 | UI 交互验证 |
| `test-kp-1.1.1.js` | 知识点 1.1.1 | 字符串类型验证 |
| `test-yaml-format.js` | YAML 格式 | 格式规范验证 |
| `test-yaml-format-fix.js` | YAML 修复 | 格式修复验证 |
| `system-test-datatype-mapping.js` | 数据类型映射 | 类型转换验证 |

### 2.5 🌐 E2E 测试（End-to-End Tests）

基于 Playwright 的浏览器端到端测试。

| 文件 | 测试对象 | 说明 |
|------|----------|------|
| `e2e/01-smoke.spec.js` | 冒烟测试 | 基础可用性 |
| `e2e/02-tab-navigation.spec.js` | Tab 导航 | 标签页切换 |
| `e2e/03-sidebar.spec.js` | 侧边栏 | 侧边栏交互 |
| `e2e/04-doc-generation.spec.js` | 文档生成 | 生成流程 |
| `e2e/05-config-modal.spec.js` | 配置弹窗 | 配置管理 UI |
| `e2e/06-doc-management.spec.js` | 文档管理 | 列表/删除 |
| `e2e/07-api-integration.spec.js` | API 集成 | 前后端联调 |
| `e2e/11-workflow-execution.spec.js` | 工作流执行 | 完整流程 |
| `e2e/13-retrieval-optimization.spec.js` | 检索优化 | 精准检索 |

---

## 3. 快速开始

### 3.1 总入口脚本

```bash
# 运行全部测试（推荐日常使用）
node tests/run-all-tests.js

# 跳过 E2E 测试（CI 环境常用）
node tests/run-all-tests.js --skip-e2e

# 详细输出
node tests/run-all-tests.js --verbose

# 带覆盖率统计
node tests/run-all-tests.js --coverage

# 生成测试报告
node tests/run-all-tests.js --report
```

### 3.2 按分类运行

```bash
# 仅运行单元测试
node tests/run-all-tests.js unit

# 仅运行集成测试
node tests/run-all-tests.js integration

# 仅运行预处理测试
node tests/run-all-tests.js preprocessing

# 仅运行 E2E 测试
node tests/run-all-tests.js e2e

# 仅运行功能测试
node tests/run-all-tests.js functional
```

### 3.3 分类专用入口

```bash
# 单元测试
node tests/run-unit-tests.js

# 集成测试
node tests/run-integration-tests.js

# 预处理模块测试
node tests/run-preprocessing-tests.js
node tests/run-preprocessing-tests.js --report   # 生成专项报告
```

### 3.4 Office 保真与视觉接口验证

```bash
sudo apt-get install -y libreoffice-core libreoffice-writer libreoffice-impress poppler-utils
node tests/run-preprocessing-tests.js --verbose

# 官方 OpenAI 接口
RUN_VISION_INTEGRATION=1 \
VISION_API_KEY=... \
VISION_MODEL=gpt-5.6-terra \
npx jest tests/preprocessing/vision-api.integration.test.js --runInBand

# 第三方 OpenAI-compatible 接口
RUN_VISION_INTEGRATION=1 \
VISION_API_KEY=... \
VISION_BASE_URL=https://gateway.example.com/v1 \
VISION_MODEL=gpt-5.6-terra \
npx jest tests/preprocessing/vision-api.integration.test.js --runInBand
```

真实集成测试缺少依赖、运行开关或密钥时显示 `skipped`。Mock 单元测试通过不能替代真实模型或 LibreOffice 可用性结论。

### 3.5 原生 Jest 命令

```bash
# 运行单个测试文件
npx jest tests/agents.test.js

# 监听模式
npx jest --watch

# 匹配名称
npx jest -t "应移除 Confluence 元数据"

# 覆盖率报告
npx jest --coverage
```

---

## 4. 测试目录结构

```
tests/
├── run-all-tests.js              # 🚀 全量测试总入口
├── run-unit-tests.js             # 🧪 单元测试入口
├── run-integration-tests.js      # 🔗 集成测试入口
├── run-preprocessing-tests.js    # 📦 预处理测试入口
├── TESTING.md                    # 📖 本文档
│
├── agents.test.js                # Agent 模块测试
├── config-manager.test.js        # 配置管理测试
├── config-validator.test.js      # 配置验证测试
├── llm-client.test.js            # LLM 客户端测试
├── step-executor.test.js         # 步骤执行器测试
├── tools.test.js                 # 工具模块测试
├── workflow-engine.test.js       # 工作流引擎测试
├── yaml-metadata-processor.test.js
├── retrieval-query-builder.test.js
│
├── api.test.js                   # API 接口测试
├── document-api.test.js          # 文档 API 测试
├── system-retrieval-flow.test.js # 系统检索流程测试
├── langgraph-workflow.test.js    # LangGraph 工作流测试
│
├── button-functional-test.js     # 按钮功能测试
├── test-kp-1.1.1.js              # 知识点测试
├── test-yaml-format.js           # YAML 格式测试
├── test-yaml-format-fix.js       # YAML 修复测试
├── system-test-datatype-mapping.js
│
├── preprocessing/                # 预处理模块测试
│   ├── design-doc-cleaner.test.js
│   ├── semantic-chunker.test.js
│   ├── markdown-adapter.test.js
│   ├── snapshot-tracker.test.js
│   ├── quality-validator.test.js
│   ├── pipeline-integration.test.js
│   ├── generate-report.js        # 报告生成脚本
│   └── test-report.md            # 预处理测试报告
│
└── e2e/                          # E2E 测试（Playwright）
    ├── 01-smoke.spec.js
    ├── 02-tab-navigation.spec.js
    ├── ...
    └── helpers.js
```

---

## 5. 测试策略

### 5.1 测试金字塔

```
        ╱╲
       ╱  ╲        E2E 测试（少量，验证核心流程）
      ╱ E2E╲
     ╱──────╲
    ╱        ╲     集成测试（中等，验证模块交互）
   ╱  集成测试 ╲
  ╱────────────╲
 ╱              ╲   单元测试（大量，验证单个模块）
╱   单元测试     ╲
╱────────────────╲
```

### 5.2 各层职责

| 层级 | 数量 | 速度 | 可靠性 | 维护成本 |
|------|------|------|--------|----------|
| 单元测试 | 多 | 快 | 高 | 低 |
| 集成测试 | 中 | 中 | 中 | 中 |
| E2E 测试 | 少 | 慢 | 低 | 高 |

### 5.3 测试命名规范

- 单元测试文件：`{module-name}.test.js`
- 集成测试文件：`{feature}-integration.test.js` 或 `{system}-flow.test.js`
- E2E 测试文件：`{NN}-{feature}.spec.js`（NN 为执行顺序编号）
- 功能测试文件：`test-{feature}.js` 或 `{feature}-functional-test.js`

---

## 6. 测试覆盖率

### 6.1 当前覆盖率（预处理模块）

| 模块 | 语句覆盖 | 函数覆盖 | 说明 |
|------|----------|----------|------|
| `design-doc-cleaner.js` | 100% | 100% | 6 条清洗规则全覆盖 |
| `markdown-adapter.js` | 94% | 92% | 扫描/解析/元数据 |
| `semantic-chunker.js` | 92% | 89% | 分块/保护/overlap |
| `snapshot-tracker.js` | 91% | 100% | 快照管理 |
| `quality-validator.js` | 77% | 90% | 质量验证 |
| `layered-indexer.js` | 58% | 50% | 索引构建（待补充） |

### 6.2 查看覆盖率

```bash
# 预处理模块覆盖率
node tests/run-preprocessing-tests.js --coverage

# 全量覆盖率
npx jest --coverage

# 生成 HTML 报告
npx jest --coverage --coverageReporters=html
# 报告位置：coverage/lcov-report/index.html
```

---

## 7. CI/CD 集成

### 7.1 GitHub Actions 示例

```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      
      - name: Install dependencies
        run: cd agent-runner && npm install
      
      - name: Run unit tests
        run: cd agent-runner && node tests/run-all-tests.js unit --coverage
      
      - name: Run preprocessing tests
        run: cd agent-runner && node tests/run-all-tests.js preprocessing --coverage
      
      - name: Run integration tests
        run: cd agent-runner && node tests/run-all-tests.js integration
```

### 7.2 本地 CI 模拟

```bash
# 模拟 CI 环境（跳过 E2E，生成报告）
node tests/run-all-tests.js --skip-e2e --coverage --report
```

---

## 8. 常见问题

### Q: 测试失败如何排查？

```bash
# 1. 使用详细输出
node tests/run-all-tests.js --verbose

# 2. 单独运行失败的测试
npx jest tests/agents.test.js --verbose

# 3. 查看日志
cat logs/execution.log
```

### Q: 如何只运行某个测试用例？

```bash
# 按名称匹配
npx jest -t "应移除 Confluence 元数据"

# 按文件路径
npx jest tests/preprocessing/design-doc-cleaner.test.js
```

### Q: E2E 测试需要什么前置条件？

```bash
# 1. 安装 Playwright 浏览器
npx playwright install

# 2. 启动服务
npm start

# 3. 运行 E2E 测试
node tests/run-all-tests.js e2e
```

### Q: 如何添加新的测试？

1. 确定测试分类（单元/集成/功能/E2E）
2. 按命名规范创建文件
3. 将文件路径添加到对应的入口脚本中
4. 更新本文档的测试文件清单

---

## 9. 测试统计

| 分类 | 文件数 | 用例数 | 状态 |
|------|--------|--------|------|
| 单元测试 | 9 | ~150 | ✅ |
| 预处理测试 | 18 | 204 | ✅ |
| 集成测试 | 4 | ~60 | ✅ |
| 功能测试 | 5 | ~25 | ✅ |
| E2E 测试 | 9 | ~50 | ✅ |
| **合计** | **33** | **~364** | |

---

**文档版本**：v1.0  
**最后更新**：2026-07-23
