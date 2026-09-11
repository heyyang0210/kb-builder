# 测试用例 1.1.1 字符串类型 - 与设计文档偏差分析

## 测试概述

- **知识点**：1.1.1 字符串类型：`CHAR` / `VARCHAR2` / `NCHAR` / `NVARCHAR2` → 目标库等价类型（含长度语义 byte/char）
- **测试方式**：模拟前端执行流程，调用后端 API（调试模式）
- **任务 ID**：direct_1784538827014_g5s15c
- **任务状态**：completed（100%）
- **最终文档**：5290 字符

---

## 与设计文档 (21-子流程切分与质量控制设计.md) 的偏差

### ✅ 已正确实现的部分

| 子流程 | 状态 | 说明 |
|---|---|---|
| 1.1 知识点解析 | ✅ | `01-knowledge-point.json` 已存储 |
| 1.2 提示词标准化 | ✅ | `02-standardized-prompt.md` 已存储，包含关键词和日期注入 |
| 1.3 关键词抽取 | ✅ | `03-keyword-extraction.json` 已存储 |
| 2.3 MCP 查询执行（优先级 1） | ✅ | `03-mcp-queries/` 目录已存储 6 条查询结果 |
| 3.2 LLM 文档生成 | ✅ | `03-generated-document.md` 和 `llm-response.json` 已存储 |
| 中间文件统一存储 | ✅ | 所有文件存储在 `logs/intermediate/{taskId}/` 下 |

---

### ❌ 偏差 1：关键词抽取未使用 LLM 同义词扩展

**设计文档要求**：
- 使用 LLM 进行同义词扩展，替代字符串匹配
- 记录扩展前后对比

**实际情况**：
```json
{
  "base_queries": ["字符串类型：CHAR", "VARCHAR2", "NCHAR", "NVARCHAR2", ...],
  "mcp_queries": ["字符串类型：CHAR", "VARCHAR2", "NCHAR", "NVARCHAR2", ...]
}
```
- `base_queries` 和 `mcp_queries` 完全相同，没有扩展
- 缺少 `expansion_method: "llm"` 字段
- 缺少 `llm_request` 和 `llm_response` 字段

**原因分析**：
- `extractDirectReferences` 函数调用了 `buildMcpQueries`，但 `buildMcpQueries` 内部的 LLM 扩展可能失败或返回空
- 需要检查 `synonym-expander.js` 的 LLM 调用是否正常

**影响**：
- MCP 查询词质量下降，可能影响检索效果
- 例如：`CHAR` 应该扩展出 `CHAR 类型`、`定长字符串` 等，但实际没有

---

### ❌ 偏差 2：MCP 查询全部失败

**设计文档要求**：
- MCP 查询成功率 ≥ 50%（调试模式下质量门禁）
- 失败时应记录错误并降级

**实际情况**：
```json
{
  "mcp": { "queries": 6, "success": 0 }
}
```
- 6 条 MCP 查询全部失败，错误：`fetch failed`
- 检索评估显示 `recommendation: "proceed"`，但成功率 0%

**原因分析**：
- MCP 服务可能未运行或配置错误
- `fetch failed` 通常是网络连接问题

**影响**：
- 缺少实时知识库数据，文档质量可能下降
- 调试模式下应该暂停等待人工介入，但实际继续执行

---

### ❌ 偏差 3：资料引用策略优先级 2-5 未正确执行

**设计文档要求**：
- 优先级 2：特性设计文档检索（`knowledge/references/design-docs/`）
- 优先级 3：Oracle 知识库检索（`knowledge/references/oracle-kb/`）
- 优先级 4：测试用例检索（`knowledge/references/test-cases/`）
- 优先级 5：源码检索（`knowledge/references/source/`）

**实际情况**：
```json
{
  "designDocs": { "files": 0 },
  "oracleKb": { "files": 0 },
  "testCases": { "files": 0 },
  "sourceCode": { "files": 0 }
}
```
- 所有优先级的检索结果都为空

**原因分析**：
1. **basePath 错误**：`RetrievalStrategy` 的 basePath 是 `agent-runner/`，但 `knowledge/references/` 目录在 `agent-runner` 的上级目录
2. **Oracle 知识库索引解析失败**：`indexEntries: []`，说明 `_parseOracleIndex` 方法没有正确解析 README.md 格式

**影响**：
- 参考资料严重不足，LLM 只能依赖 MCP 查询（也失败了）
- 文档质量无法保证

---

### ❌ 偏差 4：检索结果综合评估逻辑问题

**设计文档要求**：
- 评估资料覆盖度
- 评估资料质量
- 调试模式下覆盖度 < 0.6 应暂停

**实际情况**：
```json
{
  "score": 1,
  "matchedKeywords": [...],
  "missingTopics": [],
  "recommendation": "proceed"
}
```
- 覆盖度评分 1.0（满分），但实际参考资料只有 267 字符
- 评分逻辑可能有误：只检查了关键词是否出现在参考资料中，但没有考虑参考资料的实际内容质量

**原因分析**：
- `assessCoverage` 方法只检查关键词匹配，没有评估内容长度和质量
- MCP 查询失败后，参考资料内容极少，但评分仍然很高

**影响**：
- 质量门禁无法正确拦截低质量检索结果
- 调试模式下应该暂停但实际继续执行

---

### ❌ 偏差 5：LLM 响应文件命名不符合设计

**设计文档要求**：
- 文件名：`02-llm-response.json`

**实际情况**：
- 文件名：`llm-response.json`（缺少 `02-` 前缀）

**原因分析**：
- `saveLlmCall` 方法保存时没有使用序号前缀

**影响**：
- 文件排序和识别不便
- 轻微偏差，不影响功能

---

### ❌ 偏差 6：最终文档质量问题

**设计文档要求**：
- 包含 YAML 元数据头
- 包含标题
- 不出现客户名称

**实际情况**：
- ✅ YAML 元数据头：存在
- ❌ 标题：检查失败（可能格式问题）
- ❌ 客户名称：检查失败（文档中可能包含"客户"字样）

**影响**：
- 文档格式不符合规范
- 可能泄露客户信息

---

### ❌ 偏差 7：子流程 2.1、2.2、3.1、3.3 未存储中间文件

**设计文档要求**：
- 2.1 LLM 生成检索计划 → `01-retrieval-plan.json`
- 2.2 查询词质量检查 → `02-query-validation.json`
- 3.1 参考资料整合 → 已在 `01-context-prompt.md` 中体现
- 3.3 格式合规检查 → `04-format-check.json`

**实际情况**：
- 这些子流程的中间文件缺失
- 可能子流程执行了但没有存储，或者子流程被跳过

**原因分析**：
- `direct-task-runner.js` 可能没有完整实现所有子流程的存储逻辑
- 部分子流程可能合并到其他步骤中

**影响**：
- 调试时无法回溯这些子流程的输入输出
- 质量门禁无法检查这些子流程

---

## 根本原因总结

| 问题 | 根本原因 | 修复优先级 |
|---|---|---|
| 关键词未扩展 | LLM 同义词扩展调用失败或返回空 | P0 |
| MCP 查询全部失败 | MCP 服务未运行或配置错误 | P0 |
| 资料检索为空 | basePath 错误 + 索引解析失败 | P0 |
| 覆盖度评分虚高 | 评估逻辑只检查关键词匹配 | P1 |
| 文件命名不一致 | 保存时缺少序号前缀 | P2 |
| 文档质量问题 | 参考资料不足导致 LLM 生成质量下降 | P0 |
| 子流程文件缺失 | 存储逻辑不完整 | P1 |

---

## 修复建议

### P0 修复（阻塞性问题）

1. **修复 basePath**：
   ```javascript
   // direct-task-runner.js
   const basePath = path.join(__dirname, '..', '..', '..'); // 上级目录
   ```

2. **修复 Oracle 索引解析**：
   - 检查 `knowledge/references/oracle-kb/README.md` 的实际格式
   - 调整 `_parseOracleIndex` 方法的正则表达式

3. **检查 MCP 服务配置**：
   - 确认 MCP 服务是否运行
   - 检查 `config/mcp-config.json` 配置

4. **修复 LLM 同义词扩展**：
   - 检查 `synonym-expander.js` 的 LLM 调用
   - 添加错误日志和兜底逻辑

### P1 修复（质量问题）

5. **改进覆盖度评估**：
   - 增加内容长度检查
   - 增加资料来源多样性检查

6. **补充子流程存储**：
   - 2.1 检索计划生成后存储
   - 2.2 查询词质量检查后存储
   - 3.3 格式合规检查后存储

### P2 修复（规范性问题）

7. **统一文件命名**：
   - 所有中间文件使用序号前缀

---

## 下一步行动

1. 确认 MCP 服务状态和配置
2. 修复 basePath 问题
3. 重新运行测试验证修复效果
