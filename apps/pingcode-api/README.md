# PingCode 资料加工 API

Python 3.11+ 下，dataclass 的只读映射默认值必须使用 `field(default_factory=...)` 创建。`CommittedRebuildRecordStream.documents` 保持不可变空映射语义，避免模块导入时被判为非法默认值；验收需真实启动 API，语法编译不能发现此类导入错误。

FastAPI 入口为 `app.main:app`，共享 PingCode 客户端位于 `packages/pingcode-core/`，PingCode 专用配置位于 `config/pingcode/`，跨模块共享的过滤规则位于 `config/shared/filter-rules.json`，运行数据默认写入 `runtime/pingcode/`。

```bash
PYTHONPATH=apps/pingcode-api:packages/pingcode-core \
  python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

真实 PingCode/CAS 集成脚本默认跳过外部访问。准备好隔离测试账号和配置后，通过
`RUN_PINGCODE_LIVE_TESTS=1` 显式启用。


参考正文读取：`GET /api/pingcode/spaces/{space_key}/pages/{page_id}/reference` 复用现有账号浏览器会话、页面详情客户端和 Slate→Markdown 解析器，先核对页面属于该空间，再返回正文、标题、原始地址及上游实际提供的版本信息。`include_images=true` 时按知识中心来源图片策略下载有界公共图片，以 `source-image:` 内部标识和 base64 结果交给平台托管；响应不包含签名图片 URL。图片下载仅允许当前主机的 `/atlas/files/public/` 起点及同源 `/pc-public/` 受限跳转。不创建下载批次或下载附件；缺失页面返回404、正文无效422、上游失败502，错误响应不包含凭证或上游原始异常。该接口沿用资料服务现有网络与认证边界，知识中心入口另行校验作者权限和空间引用范围。

复验知识中心生产配置登记的首个 PingCode 目标：

```bash
KNOWLEDGE_CENTER_PINGCODE_API_PORT=18010 node tools/repository/probe-production-pingcode-reference.cjs
```

脚本只执行空间树和页面正文 GET，不输出凭据或正文；结果写入 `runtime/test-results/production-ai-integration/<UTC日期>/pingcode-reference-probe.json`。页面读取非 2xx、配置缺失或正文为空时返回非零退出码。API 地址也可通过 `KNOWLEDGE_CENTER_PINGCODE_API_BASE` 指定。

页面引用支持空间内唯一 identifier 短标识解析，canonicalPageId 返回内部 ID，校验详情一致性。

补充核对：原始空间索引字段为 short_id，树响应展示为 identifier；解析同时兼容这两个字段，仍要求空间内唯一匹配。
