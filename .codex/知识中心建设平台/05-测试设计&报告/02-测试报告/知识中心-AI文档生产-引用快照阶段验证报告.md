# AI 文档生产引用快照阶段验证报告

记录时间：2026-10-22 10:48:15 UTC。结论：阶段能力验证通过，完整目标未验收，未部署共享服务。

## 实现与复用

- 复用共享草稿 AggregateStore、权限、配置管理器、MCPClient、LLMClient、模板与采用事务。
- 新增来源读取适配模块及兼容 `/ai-sources` API，网址读取使用 Node 原生 fetch；不创建第二套 MCP 客户端、模型配置或任务存储。
- 来源预览快照绑定作者和文档上下文，显式确认后固定到生成任务及元信息。页面新增拉取、预览、逐项勾选，恢复显示任务依据。
- 人工采用或后续普通保存保留元信息历史，正文变化后将当前内容标为需重新核验；不自动继承旧报告的通过结论。

## 验证与证据

1. `npx jest --config tests/unit/agent-runner/jest.config.js --runInBand tests/unit/agent-runner/production-ai-service.test.js tests/unit/agent-runner/handbook-production-service.test.js tests/unit/agent-runner/knowledge-center-handbook-draft-ui.test.js`：20 项通过。
2. `node --test tests/unit/agent-runner/handbook-production-api.test.js`：6 项通过，其中两个 Chromium 场景，使用真实 BFF HTTP、隔离 MCP/网页及隔离模型；来源新拉取默认不勾选，确认后模型收到固定快照。断言对话框在窗口内滚动。证据：`runtime/test-results/production-ai-sources/result.json`、`source-confirmation.png`、`http-console.log`。
3. 真实配置的知识库 MCP 初始化和工具清单可用，并经本次来源适配读取 `YDB-KU-reference-system_statistics_3`，形成原文快照。证据：`runtime/test-results/production-ai-sources/real-mcp-probe.json`、`real-source-result.json`、`real-source-state.json`。仅写入本地 runtime 隔离聚合，远端只读。最终实现已再次真实读取并提取正文（509 字符），记录标题、内容哈希和拉取时间。
4. `python3 tests/run_tests.py unit --report runtime/test-results/exports/production-ai-sources-unit.json`：43/44 任务通过，Jest 726/728 项通过。失败分别为本次功能使旧“AI 生成接口待接入”断言失效，以及已有粘贴弹窗定义 100dvh 违反公共令牌检查。旧断言改为检查实际候选入口与新增操作，随后相关 28 项通过；未降低验收标准。原有 dvh 问题保留，未宣称统一门禁通过。该统一报告生成后又改善对话框滚动样式，已重新运行 HTTP/浏览器验证通过。
5. 本轮修改的代码及测试 `git diff --check` 通过；这不是工作区所有既有改动的检查结论。

## 边界与未验收

- 原网址允许列表为空；生产来源尚未配置。当前只支持 Markdown/纯文本，HTML 不能作为已解析正文引用。
- PingCode 设计/测试文档、测试用例库专用适配尚未接入，不能以知识库 MCP 通过替代。
- 当前模型配置解密问题尚未解决，未验证真实模型正文产出。
- 运行时续写 Skill、独立测试 Agent、YashanDB 用例执行报告、细粒度混合引用定位、完整审核发布闭环仍待交付。
- 保存后保守整篇失效标记不能替代段落级引用/归纳/推理/人工修改完整验收。
- 不标记目标完成，保留全部 16 项需求。
