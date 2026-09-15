# TASK-TEMPLATE-P3：数据、生成版本与最终验收

- 状态: in_progress
- 分配: database-architect, architect, backend-worker, test-engineer, reporter
- 依赖: TASK-TEMPLATE-P1、TASK-TEMPLATE-P2
- 覆盖: T8、T9、T10
- 设计: `docs/agent-runner/modules/platform-foundation/development/template-management-database-design.md`

## 验收

- [x] DDL 位于 `apps/yashandb-storage/sql/`，开发测试环境可重复执行
- [x] knowledge/templates 初始化导入幂等（dry-run/--apply 工具）
- [x] 生成任务固定 templateId、templateVersion、templateHash
- [x] 静态检查和浏览器回归完成；真实共享后端 HTTP/数据库迁移仍受运行环境隔离限制
- [x] 已输出验收矩阵和残余风险（见进度看板与设计文档）

## 交接

记录 schema/DDL、导入结果、生成任务证据、测试退出码和发布建议。当前未执行 `--apply`，避免写入共享开发数据。
