# 文件分页与加工配置测试报告

> 日期：2026-07-24  
> 批次：`batch_157fe779b2ac4fb5`  
> 结论：通过

## 测试范围

- 下载文件清单排除 `page_asset` 和所有图片 MIME。
- `all`、`text`、`conversion_pending` 三类服务端分页。
- 可处理文本和待转换文件使用独立分页状态。
- 待转换区域默认折叠，展开前不发送列表请求。
- 基础清洗与标准训练集预设的差异。
- fenced code 中标题、空行和 `#include` 内容保真。
- 真实后端 API、Vue 浏览器交互和生产构建。

## 自动化结果

```text
后端单元与集成测试：22 passed
Vue 生产构建：passed
浏览器控制台错误：0
```

执行命令：

```bash
cd apps/pingcode-api
PINGCODE_TEST_API_BASE=http://127.0.0.1:8001 \
PINGCODE_TEST_FRONTEND_BASE=http://127.0.0.1:5174 \
python3 -m unittest discover -s tests -v

cd ../frontend
npm run build
```

## 真实 API 结果

| 分类 | 总数 | 图片数 | 分页 |
|---|---:|---:|---|
| `all` | 12 | 0 | `page=1&pageSize=20` |
| `text` | 12 | 0 | `page=1&pageSize=20` |
| `conversion_pending` | 0 | 0 | `page=1&pageSize=20` |

扫描结果：12 个总文件、12 个可处理文本、0 个待转换格式、0 条扫描问题。批次内 19 张页面图片仍保留在资源清单和 `assets/`，但不会作为独立加工文件返回。

## 浏览器结果

- 下载页显示“共 12 个文档与附件，不包含页面图片”。
- 文件表格实际显示 12 行，无图片 MIME。
- 加工页首次加载请求 `category=text`。
- 扫描前和扫描后，待转换区域未展开时均未请求 `category=conversion_pending`。
- 展开待转换区域后才发送 `category=conversion_pending` 请求。
- 截图：`reports/batch-file-pagination.png`。
- 截图：`reports/preprocess-pending-collapsed.png`。

## 清洗预设结果

基础清洗保留冗余空行、标题原始写法和不间断空格；标准训练集会在代码围栏之外压缩冗余空行、规范标题空格并统一不间断空格。两者均保留正文、链接、图片、表格和 fenced code 内容。

## 已知非阻塞项

Vite 构建继续提示既有 `PreprocessPage` 分包超过 500 kB。本任务未修改 Monaco 编辑器的分包策略，该警告不影响分页和清洗功能验收。
