# 知识中心 Web 网关

`frontend-server.js` 是知识中心平台内核入口，提供静态资源、Auth 模块、统一 API 路由和 Worker 代理。前端资源位于本目录的 `frontend/`，共享后端能力与模块注册表位于 `packages/agent-runner-core/`。浏览器只访问该平台入口；内部 Worker 和过渡期 Storage 端点不属于产品入口。

```bash
node apps/knowledge-center-web/frontend-server.js
```
