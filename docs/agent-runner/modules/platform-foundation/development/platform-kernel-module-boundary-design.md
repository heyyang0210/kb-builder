# 平台内核与模块边界设计

## 决策

知识中心对外只提供 `13510/knowledge-center/` 一个入口。认证（Auth）作为平台内核模块在 Web 网关进程内运行，不再通过 `14200` 进行内部 HTTP 转发；认证 API 路径保持 `/knowledge-center/api/auth/*` 不变。

YashanDB 存储（Storage）作为平台数据模块治理，目标是由业务核心直接调用数据访问适配器，不把 `14210` 作为业务请求的 HTTP 中转层。当前仓库只有 Java JDBC 驱动，没有可审计的 Node 原生 YashanDB 驱动，因此在直接 JDBC 适配器完成前保留 14210 作为过渡运行组件，禁止宣称已完成无 HTTP 迁移。

## 底层边界

```text
浏览器
  │ 只访问 13510
  ▼
Platform Kernel
  ├─ Auth module：会话、CAS、角色、权限、审计
  ├─ Route module：统一路径、错误语义、模块发现
  ├─ Data module：统一存储接口、CAS、事务和迁移门禁
  └─ Domain modules：文档、审核、模板、资产
       ├─ Processing worker（Python，独立运行时）
       └─ YashanDB（数据库）
```

模块不是“增加一个端口”，而是通过 `PlatformModuleRegistry` 注册一组稳定能力：`id`、版本、路由、权限、健康检查、数据依赖、启停钩子和回退策略。第一批已注册 Auth；只有需要独立运行时、扩缩容或故障隔离的能力才保留进程边界。

## 分阶段迁移

1. Auth：在 13510 内挂载现有 `createKnowledgeCenterAuthService`，保持 Cookie、CAS、角色和 API 路径兼容；旧 14200 仅作为历史进程受控清理对象。仍为独立 Worker 的文档生成进程通过统一平台入口校验会话，不再依赖独立 Auth 地址。
   当前平台进程使用文件仓储保存 Auth 会话，即使全局 `KNOWLEDGE_STORAGE_MODE=database` 也不会调用同步 curl-backed 数据库仓储；这是为了避免登录和权限请求阻塞共享网关事件循环。Auth 的异步数据库适配器完成并验证前，不得切换该仓储实现。
2. Status：默认只输出平台入口和内部组件汇总；`status --verbose` 才输出诊断地址、PID 和端口。
3. Storage：先冻结 `DatabaseAggregateStore` 的读写、CAS、错误码和迁移契约；补充直接 JDBC 适配器与测试后，按“影子读 → 隔离写 → 切换 → 回退”迁移，未完成前不停止 14210。
4. Plugin：将模块清单、路由、权限和健康检查从启动脚本/网关硬编码逐步迁移到版本化模块注册表。

## 不变契约

- 浏览器入口和公共 `/knowledge-center/api/*` 路径不变。
- Auth 的 `kc_session` Cookie、CAS service URL、角色动作和错误码不变。
- Storage 的 `revision`、`If-Match`、`REVISION_CONFLICT`、迁移源不清空规则不变。
- 内部端口不是产品 API；诊断信息只对运维命令和受保护的管理能力开放。

## 验收门禁

- Auth 合并后登录、登出、CAS 回调、会话读取、权限查询和平台页面真实 HTTP 闭环通过。
- 无认证服务监听 14200 时，13510 的认证 API 仍返回原有契约。
- Storage 直接适配器未完成时，必须明确标记过渡状态，不能删除 14210 或切换数据库模式。
- `status` 默认不打印内部 URL；`status --verbose` 可定位每个组件。
- 任何删除服务、改变部署拓扑或切换存储实现的后续变更，按 Approval Boundary v1 单独记录回退条件。
