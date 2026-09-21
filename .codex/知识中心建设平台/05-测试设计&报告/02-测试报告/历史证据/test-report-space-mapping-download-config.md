# PingCode 空间映射与下载范围配置测试报告

## 测试范围

- Vite 非固定端口访问后端 PUT 接口的 CORS 预检。
- “YashanDB 文档”空间映射创建或更新。
- 秒级默认批次名称。
- 常用附件类型和自定义扩展名动态配置。
- 前端生产构建和既有回归用例。

## 验收口径

1. `http://127.0.0.1:5174` 的 OPTIONS 预检返回 200。
2. YASDOC 映射返回 `spaces/yasdoc`。
3. 默认名称符合 `YashanDB 文档-YYYYMMDD-HHmmss`。
4. Word、压缩包、XML 和 Draw.io 类型可以同时配置。
5. 修改下载范围后旧预估被清除。

## 执行结果

- 后端单元、API 集成和浏览器集成测试：`25 tests passed`。
- YASDOC 真实映射：创建/更新成功，逻辑目录为 `spaces/yasdoc`。
- `http://127.0.0.1:5174` 的 PUT 预检：HTTP 200，返回匹配的 `Access-Control-Allow-Origin`。
- 默认批次名称：匹配 `YashanDB 文档-YYYYMMDD-HHmmss`。
- 附件配置：Word、压缩包、XML、Draw.io 可组合变更并展示标准化扩展名。
- Vue 生产构建：通过；存在既有 Monaco 相关大 chunk 警告，不影响本次功能。

执行命令：

```bash
PINGCODE_TEST_API_BASE=http://127.0.0.1:8001 \
PINGCODE_TEST_FRONTEND_BASE=http://127.0.0.1:5174 \
PINGCODE_TEST_FRONTEND_ORIGIN=http://127.0.0.1:5174 \
python3 -m unittest discover -s tests -p 'test_*.py' -v

cd apps/pingcode-web && npm run build
```
