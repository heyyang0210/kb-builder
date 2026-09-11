# 知识中心认证服务

认证服务启动入口为 `auth-server.js`，业务实现位于 `packages/agent-runner-core/lib/knowledge-center-auth.js`。

```bash
node apps/knowledge-center-auth/auth-server.js
```

运行时会话文件默认写入 `runtime/agent-runner/tmp/`，账号和会话密钥通过环境变量注入。
