# PingCode 资料加工 API

Python 3.11+ 下，dataclass 的只读映射默认值必须使用 `field(default_factory=...)` 创建。`CommittedRebuildRecordStream.documents` 保持不可变空映射语义，避免模块导入时被判为非法默认值；验收需真实启动 API，语法编译不能发现此类导入错误。

FastAPI 入口为 `app.main:app`，共享 PingCode 客户端位于 `packages/pingcode-core/`，PingCode 专用配置位于 `config/pingcode/`，跨模块共享的过滤规则位于 `config/shared/filter-rules.json`，运行数据默认写入 `runtime/pingcode/`。

```bash
PYTHONPATH=apps/pingcode-api:packages/pingcode-core \
  python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

真实 PingCode/CAS 集成脚本默认跳过外部访问。准备好隔离测试账号和配置后，通过
`RUN_PINGCODE_LIVE_TESTS=1` 显式启用。
