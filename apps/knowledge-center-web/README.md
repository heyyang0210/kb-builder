# 知识中心 Web 网关

`frontend-server.js` 是知识中心平台内核入口，提供静态资源、Auth 模块、统一 API 路由和 Worker 代理。前端资源位于本目录的 `frontend/`，共享后端能力与模块注册表位于 `packages/agent-runner-core/`。浏览器只访问该平台入口；内部 Worker 和过渡期 Storage 端点不属于产品入口。

平台发布时先在仓库根目录执行 `npm run build`。统一构建脚本将知识中心静态资源和 PingCode Vite 产物写入 `runtime/build/knowledge-center/current/web/`，并由根目录 `knowledge-center.sh` 通过 `KNOWLEDGE_CENTER_FRONTEND_ROOT` 和 `PINGCODE_WEB_DIST_DIR` 注入。源码目录回退仅用于单模块开发调试。

网关拆分路由时，入口解析的运行路径必须通过 `createKnowledgeCenterHandler` 的 `config` 显式注入。大纲模板和样例分别使用 `OUTLINE_TEMPLATE_PATH` 与 `OUTLINE_SAMPLE_PATH`；两者必须是存在、可读的绝对 `.xlsx` 普通文件，否则路由工厂以 `KNOWLEDGE_CENTER_CONFIG_INVALID` 拒绝启动。启动后的文件读取失败只返回 `404/503`，不得导致 13510 网关进程退出。

浏览器端源码由网关直接作为 ES Module 提供，不使用未经转换的 JSON import attributes。数据库 Markdown 规则通过普通 JavaScript 模块加载，避免部分浏览器在登录初始化前因 `Unexpected token 'with'` 中止入口模块；未随包发布 `.map` 的 vendor 文件不得保留 `sourceMappingURL` 声明。

```bash
node apps/knowledge-center-web/frontend-server.js
```
