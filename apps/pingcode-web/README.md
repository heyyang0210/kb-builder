# PingCode Web

Vue/Vite 前端应用。本地开发可在本目录执行，正式构建统一由仓库根目录 `npm run build` 生成到 `runtime/build/knowledge-center/current/web/pingcode/`，再由知识中心 Web 网关提供。

Vite 配置只装载 `PINGCODE_WEB_` 前缀的构建参数，不得用空前缀读取完整进程环境，避免终端中的本机路径进入前端 chunk。

统一构建在执行 Vite 时固定使用 `NODE_ENV=production`。平台服务自身可以配置为 `development`，但该运行配置不得影响发布构建，否则 Vue 可能把组件绝对文件名保留在业务 chunk 中并触发路径泄漏门禁。

```bash
npm install
npm run build
```
