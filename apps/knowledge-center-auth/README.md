# 知识中心认证模块

认证业务实现位于 `packages/agent-runner-core/lib/knowledge-center-auth.js`，正式知识中心由 13510 平台进程直接挂载，不经过内部 HTTP 代理。

`auth-server.js` 只保留为认证契约的隔离测试入口和旧环境兼容入口，不属于 `knowledge-center.sh` 的必需运行单元：

```bash
node apps/knowledge-center-auth/auth-server.js
```

运行时会话文件默认写入 `runtime/agent-runner/tmp/`，账号和会话密钥通过环境变量注入。
