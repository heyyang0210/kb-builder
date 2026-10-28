# PingCode 空间映射与下载范围配置优化设计

## 1. 变更目标

1. 修复开发环境前端端口变化时，创建空间映射出现 `Failed to fetch` 的问题。
2. 下载批次默认名称包含本地时间到秒，避免同一天多个批次重名。
3. 附件类型按批次动态配置，支持常用类型勾选和自定义扩展名。

## 2. 问题定位

前端当前运行于 `http://127.0.0.1:5174`，后端默认仅允许 `5173`。读取空间的 GET 请求不一定触发 CORS 预检，但创建映射的 JSON PUT 请求会先发送 OPTIONS；后端返回 `Disallowed CORS origin`，浏览器因此只显示 `Failed to fetch`。

## 3. 接口与配置设计

### 3.1 CORS

- 显式来源继续由 `PINGCODE_WEB_CORS_ORIGINS` 配置。
- 新增 `PINGCODE_WEB_CORS_ORIGIN_REGEX`，开发环境默认允许 `localhost` 和 `127.0.0.1` 的任意端口。
- 生产环境可将正则配置为空，仅使用明确来源白名单。

伪代码：

```text
load explicit origins
load local-development origin regex
configure CORSMiddleware(origins, origin_regex)
```

### 3.2 批次默认名称

格式：

```text
{本地素材空间名称}-{YYYYMMDD-HHmmss}
```

选择空间和保存映射成功后均重新生成默认名称。用户仍可手工修改。

### 3.3 附件类型

- 前端提供常用类型复选项：Markdown、Office、PDF、文本、SQL 和压缩包。
- 提供自定义扩展名输入，接受逗号分隔的 `.ext` 或 `ext`。
- 复选项和自定义类型合并、去点、转小写、去重后写入 `sourceSelection.filters.fileTypes`。
- 配置变化后清除旧的范围预估，要求重新预估，避免按旧配置创建批次。
- 源码、脚本和可执行文件仍执行安全排除；压缩包只有显式选中时下载。

伪代码：

```text
selected = checked common extensions
custom = parse custom extension input
fileTypes = unique(normalize(selected + custom))
on selection change -> invalidate estimate
estimate/create -> submit current fileTypes
```

## 4. 验收标准

1. 从 `5174` 发起映射 PUT 预检返回 200，并包含正确的 `Access-Control-Allow-Origin`。
2. “YashanDB 文档”空间可以创建或更新映射，不再出现 `Failed to fetch`。
3. 默认批次名称精确到秒，连续不同秒生成的名称不同。
4. 常用附件类型可以勾选或取消，也可以增加自定义扩展名。
5. 修改附件类型后旧预估失效，重新预估和创建批次使用最新类型。
6. 单元测试、真实后端 API 测试和前端生产构建通过。
