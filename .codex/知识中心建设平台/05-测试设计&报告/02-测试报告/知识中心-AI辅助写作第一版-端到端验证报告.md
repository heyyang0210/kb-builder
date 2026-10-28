# AI 辅助写作第一版端到端验证报告

更新时间：2026-10-23T18:18:21+08:00。本报告替代首次弹窗版本的验收结论，记录沉浸式页面和统一资料入口的最终验证。

## 实现范围与根因

原实现调用原生 dialog.showModal，仍保留旧工作台及分裂的助手、资料标签，不符合沉浸式页面要求。另外，实际服务读取 runtime/build/knowledge-center/current/web/platform/knowledge-center 构建产物，源码修改不会直接呈现；原服务产物仍是旧版本。

现已完成全量构建并核对实际服务 app.js 与源码摘要一致。工作台提供唯一“AI 辅助写作”入口；页面直接挂载主内容区，隐藏平台导航，左侧真实富文本编辑器、右侧操作与写作要求。资料预览、明确勾选、详情和移除全部集成在该页，移除旧引用占位弹窗和分裂标签；文档属性放入工作台折叠区。

URL 使用 writing 操作参数，支持刷新进入生成或润色页面。显式返回及浏览器返回恢复工作台与未保存正文；退出停止页面轮询并清理选区监听。候选生成、取消、恢复、对照、明确采用、版本保护和质量检查复用原后端协议。富文本选区不能可靠映射时要求手动确认，修改正文后重新确认范围。

## 验证结果

| 验证层次 | 结果 | 证据（runtime/test-results/production-writing 下） |
| --- | --- | --- |
| 隔离浏览器端到端，含当前配置真实模型 | 4/4 通过，0 跳过 | page-live-verification.tap |
| 最终入口调整后的默认端到端回归 | 3 通过，真实模型用例按开关跳过 1 项 | page-final-verification.tap |
| 视图契约单元回归 | 16/16 通过 | view-contract.tap |
| 完整构建 | npm run build 成功 | build-verified.log |
| 实际用户服务及已登录 Chrome | 全部入口断言通过，0 页面脚本错误 | live-entry-result.json、live-entry-verification.log |

隔离端到端通过实际 HTTP 路由调用业务服务，覆盖资料拉取/勾选/移除、选区、生成、失败后保留候选、取消和恢复、候选人工修改、采用后草稿 GET 回读、版本冲突，以及富文本编辑后浏览器返回保留正文。失败、迟到与冲突使用确定性模型替身；真实模型用例另行完成选文润色、采用与回读。

实际服务 http://192.168.130.180:13510 的 Chrome 验证于 2026-10-23T18:13:59+08:00 完成：

- 刷新 writing=generate 和 writing=polish 均进入正确页面，真实富文本编辑器存在，无打开的 dialog，平台导航隐藏。
- 返回工作台后 URL 移除 writing 参数，AI 写作入口唯一，旧引用入口不存在。
- 1366×900 桌面及 390×844 移动端均无工作区横向溢出；桌面正文与助手并列，移动端单栏，长代码块在自身区域滚动。
- 源码、构建产物与实际服务 app.js SHA-256 一致：c052ad451aa713faa72a4cb373671d6233b1f82841c8c5d26c227317de922670。
- 最终截图为 real-entry-desktop.png、real-entry-mobile.png，已人工核对。浏览器保留在新版写作页面。

## 可复跑入口

```bash
node --test tests/e2e/agent-runner/production-writing.test.cjs
WRITING_LIVE_MODEL=1 node --test tests/e2e/agent-runner/production-writing.test.cjs
npx jest --config tests/unit/agent-runner/jest.config.js --runInBand tests/unit/agent-runner/knowledge-center-incremental-view.test.js
npm run build
```

测试使用本机 Playwright/Chromium、项目后端依赖与既有模型配置；不在脚本中嵌入凭据。

## 验证边界

真实模型端到端使用隔离内存草稿仓储和注入作者会话。实际用户服务验证只执行读取与界面导航，不生成或采用共享业务文档；不把两种验证混称为生产库写入验收。

未重复执行全站、审核发布或数据库质量专项，未根据测试耗时宣称性能提升。没有接入 ima 私有服务。关闭后恢复取服务端候选，未保存的人工候选修改不保证跨关闭恢复；复杂 DOM 选区无法证明一致时仍需手动确认。


## 生成设置联动与紧凑弹窗验收（2026-10-27T14:24:46+08:00）

- generate 显示为“按模板生成”，仅 generate/rewrite 显示与提交模板；其他方式隐藏模板、移除摘要模板名，保留选择供切回使用。
- 弹窗宽度 560px；去掉重复分组标题和正常状态说明，资料/Skill 默认折叠，错误提示仍可见；关闭与完成按钮保持44px点击区域。
- 浏览器及真实隔离HTTP测试9项：7通过、2外部模型测试默认跳过。覆盖五种方式联动、模板同框搜索、切回保留、润色继承有效模板仍提交null、Skill展开选用、断线恢复及取消。
- 实测模板模式桌面弹窗560×528.375px；390px窄屏无横向溢出，截图已目视复核。截图：runtime/test-results/production-writing/settings-compact-desktop.png、settings-compact-mobile.png。
- npm run build六阶段成功（Node语法364文件通过）；真实本机HTTP返回新版JS/CSS均200；git diff --check通过。无需重启后端，整页刷新加载新资源。


## 三种写作方式验收（2026-10-27T14:37:38+08:00）

页面统一为文档生成、内容修订、内容续写。生成必选模板、修订可选模板、续写不携带模板；内容修订配置指令扩展为表达/结构/依据已确认资料修订，版本production-ai-v4。旧rewrite/update入口映射polish，历史任务执行快照不变。
真实隔离HTTP/Playwright回归7通过、2外部模型默认跳过；后端production-ai-service单元29通过。已断言三项名称、模板传入模型、修订操作指令、资料确认ID提交、可无模板执行、续写屏蔽模板、旧入口映射。390px截图目视确认无横向溢出。
npm run build六阶段完成；真实运行服务HTTP200返回三种方式的新JS。配置按任务创建实时读取，无需重启。git diff --check通过。本轮未调用外部模型，因此不声称新修订指令的真实模型内容质量已验收。

## 参考资料优先级与网页引用验收（2026-10-27T14:51:28+08:00）

- 真实 HTTP 与浏览器用例拉取两篇 HTML，确认可多选、上移排序、首项边界禁用；模型输入与任务快照均按“乙资料 1、甲资料 2”排列。390px 设置弹窗无横向溢出，截图 `runtime/test-results/production-writing/mobile-source-priority.png` 已目视复核。
- 网页读取单元 2 项通过：公网地址策略、DNS 混合地址拒绝、显式授权本地来源、HTML 正文提取、重定向逐跳校验、循环与内网跳转拒绝、格式/体积/超时处理。
- 原写作端到端回归 7 通过、2 项外部模型测试默认跳过；旧资料/Skill/证据浏览器测试更新交互步骤后 4 项通过。新增优先级端到端 1 项通过；`git diff --check` 通过。
- 六阶段构建完成，平台受控重启后 4/4 组件健康，入口和写作脚本 HTTP 200。尝试读取 `https://example.com` 时当前环境 DNS 返回 `ENOTFOUND`，故未声称公网站点连通或动态网页、登录页读取已验收。
