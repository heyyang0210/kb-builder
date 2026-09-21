# PingCode 资料加工 API

FastAPI 入口为 `app.main:app`，共享 PingCode 客户端位于 `packages/pingcode-core/`，PingCode 专用配置位于 `config/pingcode/`，跨模块共享的过滤规则位于 `config/shared/filter-rules.json`，运行数据默认写入 `runtime/pingcode/`。

```bash
PYTHONPATH=apps/pingcode-api:packages/pingcode-core \
  python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

真实 PingCode/CAS 集成脚本默认跳过外部访问。准备好隔离测试账号和配置后，通过
`RUN_PINGCODE_LIVE_TESTS=1` 显式启用。
