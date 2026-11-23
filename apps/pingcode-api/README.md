# PingCode 资料加工 API

Python 3.11+ 下，dataclass 的只读映射默认值必须使用 `field(default_factory=...)` 创建。`CommittedRebuildRecordStream.documents` 保持不可变空映射语义，避免模块导入时被判为非法默认值；验收需真实启动 API，语法编译不能发现此类导入错误。

FastAPI 入口为 `app.main:app`，共享 PingCode 客户端位于 `packages/pingcode-core/`，PingCode 专用配置位于 `config/pingcode/`，跨模块共享的过滤规则位于 `config/shared/filter-rules.json`，运行数据默认写入 `runtime/pingcode/`。

```bash
PYTHONPATH=apps/pingcode-api:packages/pingcode-core \
  python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

真实 PingCode/CAS 集成脚本默认跳过外部访问。准备好隔离测试账号和配置后，通过
`RUN_PINGCODE_LIVE_TESTS=1` 显式启用。
应用生命周期关闭 PingCode 浏览器服务时，并发或重复关闭会等待同一次会话清理完成；清理期间的新读取等待关闭结束后再重建线程池。回归见 `tests/unit/pingcode/web-backend/test_pingcode_reference.py`。


参考正文读取：`GET /api/pingcode/spaces/{space_key}/pages/{page_id}/reference` 复用现有账号浏览器会话、页面详情客户端和 Slate→Markdown 解析器，先核对页面属于该空间，再返回正文、标题、原始地址及上游实际提供的版本信息。资料服务启动后异步预热账号会话，不预读空间目录或页面；首次引用继续核验目标空间和页面。`include_images=true` 时按知识中心来源图片策略下载有界公共图片，以 `source-image:` 内部标识和 base64 结果交给平台托管；响应不包含签名图片 URL。图片下载仅允许当前主机的 `/atlas/files/public/` 起点及同源 `/pc-public/` 受限跳转。不创建下载批次或下载附件；缺失页面返回404、正文无效422、上游失败502，错误响应不包含凭证或上游原始异常。该接口沿用资料服务现有网络与认证边界，知识中心入口另行校验作者权限、来源域名和文档作用域。

基线想法列表读取：`GET /api/pingcode/products/{product_code}/baselines/{baseline_id}/ideas/reference?category={all|分组短ID}` 使用同一已登录会话读取产品、基线详情与分组目录。分组短 ID 在当前基线内唯一解析并核验产品归属，再按分组读取全部需求分页；`all` 读取整个基线。核验归属及总数后返回标题和 Markdown 正文，合法空分组返回 0 条需求。无权限、未知分组或分页不完整返回错误，不生成来源快照。

任务来源分页读取：`POST /api/internal/pingcode/task-source-page` 仅供平台同步服务调用，需 `X-Internal-Token`，取 `PINGCODE_TASK_SYNC_INTERNAL_TOKEN` 或本机 `runtime/pingcode/task-sync-internal-token`。输入 `url/type/pageIndex`；需求基线按 IR 版本读取结构化工作项关系，缺陷来源按所选视图的筛选条件分页。同一页先验证 IR→SR 关系，再按 SR 短编号去重读取详情（单页最多 500 个唯一 SR）。IR 声明有关联但关系 API 明确返回空列表时，视为尚未关联：保留 IR 分页行、返回空 `workItems`，增加 `unlinkedIrCount` 并写安全告警，不生成 SR；非空部分关系、响应格式错误及身份冲突仍拒绝。关系和详情请求分别由 `KNOWLEDGE_CENTER_PINGCODE_RELATION_CONCURRENCY` 与 `KNOWLEDGE_CENTER_PINGCODE_DETAIL_CONCURRENCY` 配置并发，默认各 50、范围 1–50；超范围的单页数量或并发配置会拒绝。跨 IR 重复关联不会重复请求详情，身份冲突仍拒绝。空字段标注“PingCode 未填写”。此接口只返回一页，不写任务或宣称同步完成；图片资源和完整验收另行接入。阶段日志只记录产品、基线、项目、分页、关系、详情耗时及数量；校验失败日志另含脱敏原因，不记录 URL、正文或凭据。

需求 SR 来源正文由真实详情 `title`、顶层 `description` 和 17 个已核验 `properties` 字段构成：`title` 显示为“描述”，顶层 `description` 显示为“需求描述”，其余属性按知识中心 PingCode 来源同步详细设计的映射表展示。新增属性映射需同步更新设计表及 `test_task_source_pages.py`。

来源读取的关系完整性失败会返回稳定错误码，例如 `PINGCODE_RELATION_INCOMPLETE`，并可包含来源编号和不带正文的期望/实际关系数量。平台同步服务解析标准 `{success:false,error:{code,message}}` 错误信封并保留错误码。明确空关系列表属于未关联，不作为上述失败；分页完整性仍按 IR 总行数核验。不能用模型补造缺失关系；Agent + Skill 的辅助映射与诊断仍是待接入能力，必须经过结构校验和原始证据核对后才能进入预览。

复验知识中心生产配置登记的首个 PingCode 目标：

```bash
KNOWLEDGE_CENTER_PINGCODE_API_PORT=18010 node tools/repository/probe-production-pingcode-reference.cjs
```

脚本只执行空间树和页面正文 GET，不输出凭据或正文；结果写入 `runtime/test-results/production-ai-integration/<UTC日期>/pingcode-reference-probe.json`。页面读取非 2xx、配置缺失或正文为空时返回非零退出码。API 地址也可通过 `KNOWLEDGE_CENTER_PINGCODE_API_BASE` 指定。

页面引用支持空间内唯一 identifier 短标识解析，canonicalPageId 返回内部 ID，校验详情一致性。

所有 HTTP 请求均绑定经过格式校验的 `X-Request-ID`/`X-Correlation-ID` 上下文；非法或超长值会重新生成。异常日志保留错误类型和堆栈，错误响应返回 requestId 供诊断包检索。敏感正文和凭据不得写入日志。

补充核对：原始空间索引字段为 short_id，树响应展示为 identifier；解析同时兼容这两个字段，仍要求空间内唯一匹配。

2026-11-13 性能改造：新增 `POST /api/internal/pingcode/task-source-pages`，限内部同步令牌和需求基线来源。一个已认证浏览器会话并发读取全部分页、IR 关系与去重 SR 详情，返回逐页记录，Node 仍逐页验证和写入 Storage。边界为最多 100 页、5000 IR、500 个唯一 SR；超过边界明确失败。接口验证全部来源分页版本/总数、关联数量和稳定身份；空关系保留未关联 IR 编号，其余完整性错误拒绝。关系/详情并发默认 50，可由 `KNOWLEDGE_CENTER_PINGCODE_RELATION_CONCURRENCY`、`KNOWLEDGE_CENTER_PINGCODE_DETAIL_CONCURRENCY` 覆盖，范围 1–50。真实实例 10→50 对照仍需约 56.6–64.1 秒完成连接器全量读取，说明并发不是 3 秒目标的充分方案；见 `runtime/test-results/pingcode-baseline-3s-benchmark-20261113.md`。

2026-11-17 关系结果集分段：全页路径已读取全部 IR 分页后，将 IR 关系请求按 `relationConcurrency` 分段；每段最多 relationConcurrency 条，段内仍使用相同并发，顺序合并后再执行原有关联核验，并统一去重读取所有 SR 详情。关系日志增加 `relationBatchCount`、`relationConcurrency`、`relationFetchDurationMs` 和 `relationValidationDurationMs`；详情日志增加 `detailFetchDurationMs`、`baselineValidationDurationMs`、`detailMappingDurationMs`，分别拆分 API 调用、末尾基线复核、本地身份校验/Markdown 转换/组装。API 调用时间仍混合上游、响应处理与 Playwright 回传，不是纯网络耗时。单次分段失败即终止，不返回部分快照。2026-11-17 同会话交替 5 轮关系 A/B 样本的单批/50条分段中位数分别为 41.666/29.022 秒，但各轮关系响应摘要变化，不能确认逐项输出等价；仅作为分段有性能信号，不能宣称性能目标已达成。详见同步详细设计和性能诊断报告。
