# TASK-TEMPLATE-P2：模板工作台

- 状态: verified
- 分配: backend-worker, frontend-worker, test-engineer, doc-writer
- 依赖: TASK-TEMPLATE-P1
- 覆盖: T4、T5、T6、T7
- 设计: `docs/agent-runner/modules/platform-foundation/development/template-management-database-design.md`

## 验收

- [x] multipart 导入 Markdown/TXT/DOCX 并返回草稿
- [x] 历史版本查看、恢复草稿、再次保存闭环
- [x] 预览/编辑双模式和独立权限生效
- [x] 搜索、类型/状态筛选、元数据管理可用
- [x] 浏览器窄屏、键盘和错误反馈验证完成（隔离浏览器验证）

## 交接

记录浏览器证据（仅 `/tmp`）、接口联调结果、构建命令和已知限制。
