# 素材批次来源识别与筛选测试报告

## 测试结论

- 执行日期：2026-07-27。
- 前端生产构建：通过。
- 批次筛选单元测试：`4/4` 通过。
- 批次筛选真实 API 测试：`2/2` 通过。
- 批次筛选浏览器测试：`1/1` 通过。
- 全量回归：`65/65` 通过，无跳过、无失败。

## 覆盖范围

1. 本地上传、PingCode 和历史未知来源生成统一 `sourceSummary`。
2. 已绑定、临时区和未映射生成统一 `ownershipSummary`。
3. 来源和归属筛选在分页前执行。
4. 关键字可匹配批次名称、批次 ID、来源名称、来源 ID和本地素材空间。
5. 无效来源筛选返回 HTTP 400 和明确错误。
6. 真实上传批次可按 `sourceType=upload`、`ownership=temporary` 和关键字查询。
7. 浏览器可通过来源快捷筛选和搜索定位批次，并显示“本地上传”和“临时区”。
8. 筛选条件同步到 URL 查询参数。
9. 1280px 视口下筛选栏无重叠，表格空间不足时使用横向滚动。

## 执行命令

```bash
cd apps/pingcode-web
npm run build

cd ../backend
python3 -m unittest tests/test_batch_filters.py -v

PINGCODE_TEST_API_BASE=http://127.0.0.1:8001 \
PINGCODE_TEST_FRONTEND_BASE=http://192.168.130.180:3500 \
PINGCODE_TEST_UPLOAD_TOKEN=dev-upload-token \
python3 -m unittest tests/test_batch_filters_integration.py -v

PINGCODE_TEST_API_BASE=http://127.0.0.1:8001 \
PINGCODE_TEST_FRONTEND_BASE=http://192.168.130.180:3500 \
PINGCODE_TEST_LAN_GATEWAY_BASE=http://192.168.130.180:3500 \
PINGCODE_TEST_UPLOAD_TOKEN=dev-upload-token \
python3 -m unittest discover -s tests -p 'test_*.py' -v
```

## 浏览器证据

浏览器测试截图：`tests/reports/batch-source-filters.png`。

截图包含：

- 来源聚合统计。
- 本地上传快捷筛选。
- 关键字筛选。
- 当前筛选标签。
- 来源徽标及来源 ID。
- 临时区归属信息。
- 服务端分页控件。

## 回归修复

全量测试首次执行时，既有 Markdown 图片预览测试在第一张图片可见后立即检查其余图片，暴露时序竞争。接口和六个图片请求均返回 HTTP 200；测试调整为等待全部图片 `complete && naturalWidth > 0` 后断言。生产预览代码未修改，修复后该测试和全量回归均通过。
