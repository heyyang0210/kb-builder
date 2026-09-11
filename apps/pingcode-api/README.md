# PingCode 资料加工 API

FastAPI 入口为 `app.main:app`，共享 PingCode 客户端位于 `packages/pingcode-core/`，配置位于 `config/pingcode/`，运行数据默认写入 `runtime/pingcode/`。

```bash
PYTHONPATH=apps/pingcode-api:packages/pingcode-core \
  python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```
