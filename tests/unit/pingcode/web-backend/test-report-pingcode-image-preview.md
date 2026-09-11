# PingCode 页面图片与 Markdown 预览测试报告

> 日期：2026-07-24  
> 批次：`batch_157fe779b2ac4fb5`  
> 结论：通过

## 测试范围

- Slate `image` 节点提取、原始 URL 保留和本地相对路径改写。
- PingCode 公共图片短期令牌、令牌刷新、主机与路径限制。
- 目录摘要附件数为 0 时仍以页面附件接口为准。
- `application/octet-stream` 图片文件签名识别。
- `resources.json` 页面图片登记和 Markdown 预览资产映射。
- 文件路径穿越保护。
- 真实 PingCode 批次重新下载。
- 真实后端 `preview-data`、`content` API。
- Vue 文档预览弹窗和页面图片加载。

## 自动化结果

```text
后端单元测试：15 passed
真实 API 集成测试：1 passed
浏览器集成测试：1 passed
Vue 生产构建：passed
```

测试命令：

```bash
cd apps/pingcode-api
python3 -m unittest discover -s tests -v

PINGCODE_TEST_API_BASE=http://127.0.0.1:8001 \
PINGCODE_TEST_FRONTEND_BASE=http://127.0.0.1:5174 \
python3 -m unittest discover -s tests -p 'test_preview_integration.py' -v

cd ../frontend
npm run build
```

## 真实批次结果

| 指标 | 结果 |
|---|---:|
| 页面文件 | 7 |
| 页面图片 | 19 |
| Markdown 附件 | 5 |
| 图片错误 | 0 |
| 目标页面图片 | 6 |
| 下载任务告警 | 0 |
| 下载任务失败 | 0 |

目标页面 Markdown 已包含 6 个 `../assets/...` 相对图片引用。抽样图片接口返回 `HTTP 200`、`Content-Type: image/png`、`Content-Disposition: inline`，文件头为 PNG 签名。

## 浏览器结果

- 文档预览弹窗正常打开。
- “文档预览 / Markdown 源码”模式可见。
- 目标页面 6 张图片全部 `complete=true` 且 `naturalWidth > 0`。
- 浏览器控制台错误数：0。
- 截图：`reports/batch_157fe779b2ac4fb5-markdown-preview.png`。

## 已知非阻塞项

Vite 构建提示既有 `PreprocessPage` 分包超过 500 kB。本次下载和预览功能构建成功，该警告不影响验收，未在本任务中调整预处理页面依赖结构。
