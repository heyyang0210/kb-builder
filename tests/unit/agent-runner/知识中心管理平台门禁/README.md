# 知识中心管理平台测试门禁

本目录保存知识中心管理平台必须长期执行的防回归用例。功能进入本目录后，后续修改不得通过删除断言、降低安全约束或改成仅检查源码字符串的方式绕过门禁。

## 当前门禁功能点

| 门禁 | 测试文件 | 必须保障的行为 |
|---|---|---|
| Markdown 完整渲染 | `markdown-renderer.gate.test.js` | 标题、有序/无序/嵌套/任务列表、引用、分隔线、表格、行内样式和语言代码块正确渲染 |
| 仓库资源解析 | `markdown-renderer.gate.test.js` | 相对文档链接和图片使用当前手册、分支、语言及文件路径解析 |
| 文档锚点 | `markdown-renderer.gate.test.js` | `<span id="YFS" name="YFS"></span>` 渲染为可跳转锚点，不作为正文文本显示 |
| HTML 安全边界 | `markdown-renderer.gate.test.js` | 仅允许经过校验的空 `span` 锚点；事件、样式、脚本、危险协议及其他 HTML 必须转义或降级 |
| 共享一致性 | `knowledge-center-incremental-view.test.js` | 知识资产仓库阅读与审核阅读复用同一个 `safeMarkdown` 渲染器 |
| 产品筛选业务语义 | `knowledge-assets-product-filter.gate.test.js` | 内部数字产品 ID 只用于查询，筛选项直接显示 `PRODUCT_NAME` 的 `DB / YMP / YCM / YDC`，且 URL 字符串 ID 可正确筛选 |
| 模板摘要与详情边界 | `knowledge-center-performance.gate.test.js` + `tests/e2e/agent-runner/template-workspace.cjs` | 列表不带正文，只为选中模板读取一次详情；真实 Markdown 上传后即时和刷新均显示正文，禁止 N+1 |

审核首屏门禁同时检查提前只读预取与正常聚合接口的回退关系；行为由 `../review-bootstrap-prefetch.test.js` 覆盖完整路由匹配、单次复用和401/403不污染登录状态，真实浏览器性能由 `tests/e2e/agent-runner/knowledge-center-performance.gate.spec.js` 验证，不以源码断言代替运行验收。

## 执行方式

```bash
cd agent-runner
npx jest tests/知识中心管理平台门禁/markdown-renderer.gate.test.js tests/knowledge-center-incremental-view.test.js --runInBand
npx jest tests/知识中心管理平台门禁/knowledge-assets-product-filter.gate.test.js --runInBand
npm run test:knowledge-center -- --runInBand tests/unit/agent-runner/知识中心管理平台门禁/knowledge-center-performance.gate.test.js
NODE_PATH=runtime/agent-runner/node_modules node tests/e2e/agent-runner/template-workspace.cjs
```

涉及 Markdown 渲染器、知识资产阅读或审核阅读的变更，必须执行上述命令；涉及真实页面交互时还需执行审核与发布 Playwright E2E。
