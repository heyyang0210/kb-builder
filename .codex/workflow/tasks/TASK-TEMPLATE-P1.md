# TASK-TEMPLATE-P1：模板契约与核心服务

- 状态: verified；隔离回归 12/12 通过，真实 YashanDB 存储/CAS 与认证态模板 API 闭环通过，Test Engineer 独立复核完成
- 分配: architect, backend-worker, test-engineer
- 依赖: 无
- 覆盖: T1、T2、T3
- 设计: `docs/agent-runner/modules/platform-foundation/development/template-management-database-design.md`

## 验收

- [x] 契约、权限和错误码测试基线完成
- [x] 列表/详情/版本读取正确校验 `template:read`
- [x] JSON Content-Type 和请求解析一致
- [x] 保存校验、哈希、乐观锁和历史不可变通过
- [x] 真实后端 API 证据已记录

## 交接

2026-09-14 09:42:00：补读取权限、JSON 请求类型/对象校验、统一不存在错误、客户端保存请求头和详情 current。隔离测试 `node --test tests/unit/agent-runner/template-p1.test.js tests/unit/agent-runner/database-config.test.js` 7 项通过；Python 配置测试 2 项通过；真实 YashanDB JDBC 存储服务健康、记录写入/回读和 If-Match CAS（第二次写入返回 REVISION_CONFLICT）通过。2026-09-14 11:19:56 复核发现认证服务端口 4200 未监听，无法完成真实认证态模板 API 闭环；P1 不放行 P2。

记录变更文件、命令/退出码、API 响应（脱敏）、未决问题和回滚点。

2026-09-14 11:49:00：Test Engineer 扩充并独立复核 11 项 P1 测试，覆盖权限、JSON、404、管理动作、失败不落库、哈希、历史和并发，11/11 通过。修复正文非字符串被强制转换、`baseVersion` 非正整数被 `Number()` 放行的问题。真实 HTTP（数据库模式）证据：管理员登录成功；未登录模板列表 401；管理员列表 200；唯一测试模板创建 201、保存 200 并生成版本 2/SHA-256；过期版本保存 409 `TEMPLATE_VERSION_CONFLICT`；详情与版本列表 200；`TEMPLATE_EDITOR` 角色创建 201，恢复 `KNOWLEDGE_EDITOR` 后模板读取 403。测试聚合已通过存储服务 DELETE 清理，未保留测试模板。

2026-09-14 11:58:37：补充结构化 JSON 凭证检测回归，模板 P1 隔离测试累计 12/12 通过；`"password":"..."` 等带引号字段现会被拒绝。
