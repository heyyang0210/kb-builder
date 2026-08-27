# TASK-KGO-32-FE-01：证据原文核验工作区

## 状态

completed

## 交付

- 证据面板展示文档、逻辑路径、章节、处理单元、状态和诊断建议。
- 结构化文本站内预览并高亮后端确认的原句位置。
- 支持打开原文、下载、Escape/遮罩关闭和移动端全宽预览。
- 所有用户可见状态和动作使用中文。

## 验证

- `npm run build`：通过。
- Playwright 隔离 API fixture：1440px/390px 均通过，控制台错误 0、横向溢出 0、预览高亮可见。

## 修改文件

- `scripts/pingcode/web/frontend/src/components/GraphEvidencePanel.vue`
