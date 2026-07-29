# 通用素材接入框架 P0-P4 测试报告

## 测试范围

- 来源连接器、格式族和加工阶段注册声明。
- 组件注册表重复 key 防护。
- 流水线阶段顺序、事件和失败停止行为。
- 真实后端 `/api/ingestion/capabilities` 接口。
- 上传会话、分片恢复、完整性校验和上传批次生成。
- 格式识别、安全 ZIP/TAR 解压、图片资源登记和隔离规则。
- 批次来源摘要、归属摘要、筛选、聚合统计、分页和浏览器展示。
- 现有 PingCode API、浏览器预览和加工流程回归。

## 当前交付边界

P0-P4 已实现框架接口、上传会话、分片上传、断点恢复、原始快照、上传批次生成和安全准备处理。Office/PDF 正文转换、LibreOffice 兜底及完整 `NormalizedDocument` 产出属于 P5；未接入真实处理器的框架阶段仍返回 `skipped`。

## 执行命令

```bash
cd scripts/pingcode/web/backend
PINGCODE_TEST_API_BASE=http://127.0.0.1:8001 \
PINGCODE_TEST_FRONTEND_BASE=http://192.168.130.180:3500 \
PINGCODE_TEST_LAN_GATEWAY_BASE=http://192.168.130.180:3500 \
PINGCODE_TEST_UPLOAD_TOKEN=dev-upload-token \
python3 -m unittest discover -s tests -p 'test_*.py' -v
```

## 结果

- 框架单元测试：5 个通过。
- P4 格式与归档安全单元测试：7 个通过。
- 能力接口真实 API 测试：1 个通过。
- 上传会话、令牌、分片恢复、文件哈希、路径安全和批次生成真实 API 测试：3 个通过。
- 上传浏览器集成测试：1 个通过。
- 上传集成测试：`4 tests passed`。
- P4 真实 API 测试：1 个通过，覆盖上传 ZIP、生成批次、安全解压、图片资源分类和普通清单隔离。
- 批次筛选专项测试：单元测试 4 个、真实 API 测试 2 个、浏览器测试 1 个通过。
- 全量后端、真实 API、局域网网关和浏览器回归：`65 tests passed`，无跳过、无失败。
- `/api/ingestion/capabilities` 通过 `http://192.168.130.180:3500/pingcode-api/` 可访问。
- 既有 PingCode 映射、下载文件分页、Markdown 图片预览和加工页面回归通过。
