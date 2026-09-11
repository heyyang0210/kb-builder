# YashanDB Agent Runner — 全量测试报告

> 生成时间：2026-07-23T10:59:09.707Z
> 总耗时：1.8s

## 测试分类总览

| 分类 | 图标 | 说明 | 测试文件数 | 状态 |
|------|------|------|-----------|------|
| 单元测试 | 🧪 | 测试单个模块/类的功能 | 9 | ⏭️ 未执行 |
| 预处理模块测试 | 📦 | 资料预处理框架（清洗/分块/索引/质量验证） | 6 | ✅ 通过 |
| 集成测试 | 🔗 | 测试模块间交互和系统流程 | 4 | ⏭️ 未执行 |
| 功能测试 | 🎯 | 独立功能验证脚本 | 5 | ⏭️ 未执行 |
| E2E 测试 | 🌐 | 端到端浏览器测试（Playwright） | 9 | ⏭️ 未执行 |

## 测试文件清单

### 🧪 单元测试

| 文件 | 说明 |
|------|------|
| `tests/agents.test.js` | Agent 模块（Planner/Retriever/Generator/Validator） |
| `tests/config-manager.test.js` | 配置管理（加密/解密/缓存） |
| `tests/config-validator.test.js` | 配置验证（格式/必填项校验） |
| `tests/llm-client.test.js` | LLM 客户端（API 调用/重试/降级） |
| `tests/step-executor.test.js` | 步骤执行器（工作流步骤调度） |
| `tests/tools.test.js` | 工具模块（MCP/文件读写/搜索） |
| `tests/workflow-engine.test.js` | 工作流引擎（流程编排/状态管理） |
| `tests/yaml-metadata-processor.test.js` | YAML 元数据处理 |
| `tests/retrieval-query-builder.test.js` | 检索查询构建（关键词/同义词扩展） |

### 📦 预处理模块测试

| 文件 | 说明 |
|------|------|
| `tests/preprocessing/design-doc-cleaner.test.js` | 设计文档清洗（6 条规则） |
| `tests/preprocessing/semantic-chunker.test.js` | 语义分块（边界检测/保护块/overlap） |
| `tests/preprocessing/markdown-adapter.test.js` | Markdown 适配器（扫描/解析/元数据） |
| `tests/preprocessing/snapshot-tracker.test.js` | 快照管理（保存/加载/回溯/保留策略） |
| `tests/preprocessing/quality-validator.test.js` | 质量验证（清洗/分块/索引检查点） |
| `tests/preprocessing/pipeline-integration.test.js` | 预处理流水线端到端集成 |

### 🔗 集成测试

| 文件 | 说明 |
|------|------|
| `tests/api.test.js` | API 接口测试 |
| `tests/document-api.test.js` | 文档 API 测试 |
| `tests/system-retrieval-flow.test.js` | 系统检索全流程 |
| `tests/langgraph-workflow.test.js` | LangGraph 工作流集成 |

### 🎯 功能测试

| 文件 | 说明 |
|------|------|
| `tests/button-functional-test.js` | 前端按钮功能验证 |
| `tests/test-kp-1.1.1.js` | 知识点 1.1.1 字符串类型验证 |
| `tests/test-yaml-format.js` | YAML 格式验证 |
| `tests/test-yaml-format-fix.js` | YAML 格式修复验证 |
| `tests/system-test-datatype-mapping.js` | 数据类型映射验证 |

### 🌐 E2E 测试

| 文件 | 说明 |
|------|------|
| `tests/e2e/01-smoke.spec.js` | 01-smoke.spec.js |
| `tests/e2e/02-tab-navigation.spec.js` | 02-tab-navigation.spec.js |
| `tests/e2e/03-sidebar.spec.js` | 03-sidebar.spec.js |
| `tests/e2e/04-doc-generation.spec.js` | 04-doc-generation.spec.js |
| `tests/e2e/05-config-modal.spec.js` | 05-config-modal.spec.js |
| `tests/e2e/06-doc-management.spec.js` | 06-doc-management.spec.js |
| `tests/e2e/07-api-integration.spec.js` | 07-api-integration.spec.js |
| `tests/e2e/11-workflow-execution.spec.js` | 11-workflow-execution.spec.js |
| `tests/e2e/13-retrieval-optimization.spec.js` | 13-retrieval-optimization.spec.js |

## 快速命令

```bash
# 全量测试
node tests/run-all-tests.js

# 按分类运行
node tests/run-all-tests.js unit            # 单元测试
node tests/run-all-tests.js integration     # 集成测试
node tests/run-all-tests.js preprocessing   # 预处理测试
node tests/run-all-tests.js e2e             # E2E 测试
node tests/run-all-tests.js functional      # 功能测试

# 常用选项
node tests/run-all-tests.js --verbose       # 详细输出
node tests/run-all-tests.js --coverage      # 覆盖率
node tests/run-all-tests.js --skip-e2e      # 跳过 E2E
node tests/run-all-tests.js --report        # 生成报告
```
