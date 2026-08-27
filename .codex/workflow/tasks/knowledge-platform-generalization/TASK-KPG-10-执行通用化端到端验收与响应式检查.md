# TASK-KPG-10：执行通用化端到端验收与响应式检查

## 元信息

- 任务编号：TASK-KPG-10
- 标题：执行通用化端到端验收与响应式检查
- 状态：聚焦验收通过，待部署验证
- 分配：Test Engineer / UX Reviewer
- 依赖：TASK-KPG-09
- 需人类确认：否，真实外部写入或生产数据测试仍需另行授权
- 可并行：否
- 文件归属：自动化测试、隔离验收数据、测试报告和专项进展证据
- 参考文档：TASK-KPG-01 测试矩阵、各实现任务验收标准

## 目标

验证企业能力包、双后端、统一网关、双模块前端和旧入口兼容形成可运行闭环，并对失败路径、安全和响应式进行检查。

## 工作内容

1. 执行 Node、Python、契约、构建和硬编码/敏感信息测试。
2. 真实启动服务并调用健康、运行上下文、资料处理和文档生成 API。
3. 使用 Playwright 检查 1440×900、1024×768、768×1024、375×812。
4. 验证配置非法、模块不可用、旧入口、深链和恢复提示。

## 验收标准

- [x] 两端配置指纹一致，隔离环境的平台上下文主路径和失败路径符合契约。
- [x] Node/Python 聚焦回归与 Vue 构建通过；既有失败已区分。
- [x] 统一入口四视口无页面级横向溢出、遮挡和测试控制台错误，键盘焦点可见。
- [x] 新增能力包、统一入口和公开运行投影无真实令牌、凭证或服务器绝对路径。
- [x] 测试命令、计数和残余风险写入专项进展文档。
- [ ] 默认 3500/4100/8001 重启到当前版本，并完成真实 Socket.IO/SSE、外部平台和生产黄金样例验证。

## 执行日志

### 2026-08-27 执行记录

- Node 聚焦回归：`npx jest tests/enterprise-profile-contract.test.js tests/platform-profile-loader.test.js tests/document-generation-profile.test.js tests/platform-context-gateway.test.js --runInBand`，31/31 通过。
- Python 聚焦回归：`python3 -m unittest tests.test_enterprise_profile_contract tests.test_platform_profile_loader tests.test_material_processing_profile`，11/11 通过。
- 资料加工前端：`npm run build` 通过；Vite 报告既有大 chunk 警告（PreprocessPage 约 3.3 MB），不影响本轮功能验收。
- 隔离真实服务：Node 14110、Python 18010、3500 13510；双端 `/api/platform/context` 返回 200，配置指纹一致；聚合返回 200/ok；旧文档生成页、资料加工页均返回 200。
- Playwright Chromium：统一入口四视口、单模块降级、旧入口深链和 PingCode API 代理共 8/8 通过；无页面级横向溢出和测试控制台错误，截图输出仅保存在运行目录/临时目录。
- 安全检查：新增能力包、统一入口 HTML/JS 和聚合响应未发现 token、password、secret 引用或服务器绝对路径；旧前端仍含私网展示地址和绝对路径示例，不纳入本声明。
- 默认 4100/8001/3500 已存在用户旧进程，未强制重启；使用隔离端口完成验收，避免影响现有服务。

残余问题：真实 PingCode/MCP 连接、外部模型完整生成和生产数据黄金样例未验证；Python 默认 8000 与部署 8001 端口漂移、Socket.IO 真实订阅事件、Python 四条 SSE 真实流及默认端口部署均需后续运维环境确认。机器可读兼容清单只冻结实现契约，不冒充真实流验证。
