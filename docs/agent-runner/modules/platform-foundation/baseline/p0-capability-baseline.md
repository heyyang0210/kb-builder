# 知识中心管理平台 P0 事实基线

> 生成器：`tools/knowledge-processing/generate-knowledge-center-p0-baseline.js`
> 本文只记录重构开始前的事实，不表示目标模式已经完成。机器可读明细见同目录 `p0-capability-baseline.json`。

## 采集范围

基线覆盖统一入口、旧入口、Node 文档生产服务、Python 资料加工服务、认证服务、YashanDB 存储边界、真实路由、持久化源和对象归属。每一项必须标注“已由代码或真实 API 证实”或“待确认”。重新采集时执行：

```bash
node tools/knowledge-processing/generate-knowledge-center-p0-baseline.js
```

## 当前已证实事实

| 领域 | 事实 | 证据 |
| --- | --- | --- |
| 统一入口 | `/knowledge-center/` 返回知识中心页面，前端网关监听隔离端口 | `frontend-server.js`、运行时 HTTP 200 |
| 认证 | `/knowledge-center/api/auth/config` 返回启用状态；未登录访问会话、平台上下文返回 `AUTH_REQUIRED` | 认证服务与网关真实响应 |
| 文档生产 | `/api/health` 返回 `status=ok` | 文档服务真实响应 |
| 资料加工 | `/api/health` 返回 `status=ok`；Python API 覆盖上传、批次、扫描、清洗、数据集、索引、图谱和 SSE | Python 路由与真实响应 |
| 兼容入口 | `/prompt-generator.html`、`/pingcode-materials/`、`/pingcode-api/*`、`/api/*` 保留代码路由 | 前端网关路由 |
| 存储模式 | Node 聚合仓储支持 `file|database`；数据库模式有 revision、导出和不可用失败语义 | `aggregate-store.js`、YashanDB 设计文档 |
| 当前缺口 | 知识中心资料清洗页面仍返回“资料清洗待建设”，尚未接入 Python 真实工作台 | `frontend/knowledge-center/modules/cleaning/view.js` |

## 核心能力矩阵（P0）

| 能力 | 统一入口 | 旧入口 | 权威服务 | 当前状态 | 下一证据 |
| --- | --- | --- | --- | --- | --- |
| 资料接入与加工 | 占位页 | 可用 | Python 资料加工服务 | 兼容中，未迁移 | 工作区真实 API + 浏览器黄金流程 |
| 大纲管理 | 已接入 | 文档服务旧 API | Node 文档生产服务 | 已迁移，需持续回归 | 旧入口/API 对账 |
| 文档生产 | 已接入部分工作区 | `/prompt-generator.html` | Node 文档生产服务 | 兼容中 | 生成、预览、评论 E2E |
| 审核与发布 | 已接入增量/审核工作区 | 旧文档 API | Node 文档生产服务 | 兼容中 | 发布、回退、审计 E2E |
| 平台管理 | 已接入资产、权限、GitLab | 旧配置接口 | 网关 + 认证 + GitLab 连接器 | 已迁移，需权限回归 | 权限矩阵实测 |
| 结构化持久化 | 部分使用数据库模式 | 文件/目录仍存在 | YashanDB 存储服务或 JSON | 迁移中 | 全量数量、哈希、回读对账 |

## P0 风险与门禁

1. 在资料加工工作区真实接入前，不得删除旧资料入口或把占位页误标为可用。
2. 在历史 JSON/目录完成数量、摘要和业务回读对账前，不得切换单主写事实源。
3. YashanDB JDBC 服务、生产凭证、保留期、权限模型或旧入口退役涉及人工审批时，只提交方案和测试准备。
4. 所有后续阶段必须追加真实 API、浏览器 E2E、兼容回归和可回退证据。

## P0 自检结论

- 基线采集器可重复执行，输出文件摘要和路由清单。
- 运行时已验证统一入口、认证保护、文档服务和资料加工服务健康。
- 目标模式尚未完成：资料清洗工作区、全量对象归属落地、历史数据迁移对账和旧入口收口仍是后续阶段。
