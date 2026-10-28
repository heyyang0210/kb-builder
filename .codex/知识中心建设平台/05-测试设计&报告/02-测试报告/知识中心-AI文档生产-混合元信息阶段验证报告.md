# 知识中心-AI文档生产-混合元信息阶段验证报告

- 日期：2026-10-22
- 范围：AI文产-12、AI文产-16 的隔离契约和平台候选体验
- 结论：隔离验证通过；真实模型、真实 YashanDB 及完整送审链路未验收

## 证据

- `npx jest --config tests/unit/agent-runner/jest.config.js --runInBand tests/unit/agent-runner/production-ai-provenance.test.js tests/unit/agent-runner/production-ai-service.test.js tests/unit/agent-runner/production-quality-service.test.js`：25/25 通过。
- `node --test --test-timeout=45000 tests/unit/agent-runner/handbook-production-api.test.js`：10/10 通过，覆盖真实 HTTP、Chromium、引用预览、混合元信息、人工采用、质量报告和未执行状态。
- 截图：`runtime/test-results/production-ai-provenance/candidate-provenance.png`、`saved-provenance.png`。
- 质量报告 API 绑定 `revisionId`、正文摘要、数据库版本和测试环境；未配置数据库时报告为 `not_passed`，用例为 `not_executed`。

## 未验收项

- 当前真实模型配置仍无法完成真实模型验收。
- 完整平台送审、反馈修订和发布闭环仍未验收。

## 真实 YashanDB 隔离验证（2026-10-22）

- `apps/yashandb-storage/start.sh probe` 使用 `runtime/test-config/yashandb/service.env` 的 `test_hy` 账号真实执行 `SELECT 1 FROM DUAL`，结果成功；证据：`runtime/test-results/production-ai-quality/real-yashandb-probe.json`。
- 通过真实 Storage HTTP 服务执行 `SELECT 1 AS VALUE FROM DUAL`，质量报告门禁为 `passed`，数据库版本为 `Enterprise Edition Release 23.4.7.113 x86_64`，环境为 `test_hy 隔离库`；证据：`runtime/test-results/production-ai-quality/real-yashandb-quality-report.json`。
- 该证据覆盖真实数据库适配器和只读执行链路；尚不等于真实模型、生产外部来源和送审发布全部验收。

## 测试用例库来源补充验证（2026-10-22）

- 新增真实只读条目 `knowledge/references/test-cases/ai-quality-smoke-select.sql`，内容为 `SELECT 1 AS VALUE FROM DUAL;`。
- `handbook-production-api.test.js` 通过真实 HTTP 来源接口预览该条目，断言正文、来源可用性，并将其 `sourceId` 与网址、知识库 MCP 来源一起冻结到生成请求；10/10 子测试通过。
- 该来源已具备用例库入口和来源快照证据；完整模型生成和正式审核发布仍保持未验收。
