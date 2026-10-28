# AI 文档生产 Skill 与引用版本阶段验证报告

记录时间：2026-10-22T19:05:53+08:00。结论：阶段验证通过，完整 AI文产-01～16 目标未验收；未重启共享服务。

## 本阶段交付

- 续写 Skill 复用企业能力包白名单资源与加载器，由配置登记适用操作；作者预览、选用，服务端校验哈希并冻结指令、版本和引用，模型调用实际包含选用指令。采用后元信息保留快照。不是新增脚本执行引擎。
- 同一网址或知识条目的不同内容版本不能同时作为确认依据。生成前返回 `AI_SOURCE_VERSION_CONFLICT`（409），不调用模型；取消旧版本选择后可生成。旧任务引用快照不受重新拉取影响。该检查不覆盖不同来源之间的语义冲突。
- 同步 Node 与 Python 默认能力包资源数量断言（30→31），同时检查新增 Skill 引用及摘要；未降低断言。
- 浏览器截图检查发现 Skill 复选框继承通用输入框尺寸，已统一来源和 Skill 复选框尺寸与行布局。

## 可复现验证

仓库根目录执行：

```bash
npx jest --config tests/unit/agent-runner/jest.config.js --runInBand tests/unit/agent-runner/platform-profile-loader.test.js tests/unit/agent-runner/knowledge-center-incremental-view.test.js tests/unit/agent-runner/knowledge-center-handbook-draft-ui.test.js tests/unit/agent-runner/production-ai-service.test.js
node --test tests/unit/agent-runner/handbook-production-api.test.js
python3 tests/run_tests.py unit --report runtime/test-results/exports/production-ai-skills-unit-recheck.json
```

- 定向 Jest：38/38 通过；覆盖 Skill 新登记、适用性、重复选择、过期预览哈希、执行指令冻结、候选采用元信息及 Node/Python 指纹一致。证据：`runtime/test-results/production-ai-skills/targeted-console.log`。
- 真实 BFF HTTP 与 Chromium：7/7 通过；覆盖候选生命周期、来源确认、新旧来源冲突及重新选择、Skill 预览勾选、模型消息、指定位置续写、保存回读。最新含复选框样式修正的运行证据：`runtime/test-results/production-ai-skills/http-recheck-console.log`。使用隔离来源和确定性模型，不是外部集成或完整平台验收。
- 浏览器证据：`runtime/test-results/production-ai-skills/skill-selection.png`、`skill-continuation.png`、`result.json`，以及 `runtime/test-results/production-ai-sources/source-confirmation.png`。
- 统一单元：43/44 项任务通过；Jest 728/729 项通过，Python 默认能力包测试已通过。剩余 `knowledge-center-scroll-runtime.test.js` 中模块不得定义 dvh 的检查失败，来源为现有 Markdown 粘贴样式；本阶段没有修改该模块，也没有放宽门禁。报告和完整输出分别为 `runtime/test-results/exports/production-ai-skills-unit-recheck.json`、`runtime/test-results/production-ai-skills/unit-recheck-console.log`。
- 更正：上一轮 `production-ai-skills-unit.json` 实际为42/44，除样式检查之外，Node 与 Python 资源数断言均过期；不能把旧报告写成43/44。43/44是本次修复后的新报告。

## 仍需完成

真实模型生成（已有密钥解密阻塞待解除）、PingCode 设计/测试文档和用例库专用接入、外部网址验收、内容质量检查、独立运行时测试 Agent 与多个 Skill、真实隔离 YashanDB 用例验证及报告、段落与用例混合来源追溯、完整平台浏览器和审核发布闭环。现有阶段证据不能证明这些要求完成。保留全部16项需求，不标记目标完成。
