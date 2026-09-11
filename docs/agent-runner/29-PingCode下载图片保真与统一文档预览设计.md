# PingCode 下载图片保真与统一文档预览设计

> 版本：v1.0  
> 日期：2026-07-24  
> 状态：已实施并通过真实批次验证

## 1. 背景与问题

批次 `batch_157fe779b2ac4fb5` 的页面 Markdown 已下载，但页面内图片未进入批次目录。下载任务的“预览”当前直接打开后端纯文本响应，和 YashanDB 知识库文档生成器“文档管理”的 Markdown 预览体验不一致。

真实页面 `69b17f9d6043a110fe7213c6` 的 PingCode Slate 文档中存在多个 `type=image` 节点，节点使用 `thumbUrl`、`originUrl` 描述图片。现有解析器只读取 `url`，下载任务也只处理页面附件接口，因此图片在转换阶段被静默忽略。

## 2. 目标与边界

### 2.1 目标

1. 页面内图片以原始二进制内容保存到批次目录，Markdown 使用相对路径引用。
2. 图片资源进入 `resources.json`，可审计、可下载、可独立校验。
3. 图片下载失败必须写入错误资源并增加任务告警，不允许静默丢失。
4. 下载任务中的 Markdown 预览采用文档管理同类排版：标题、表格、代码块、引用、列表和图片均正确展示。
5. 预览资源只能通过资源清单访问，禁止任意文件路径读取。

### 2.2 本阶段边界

- 支持 PingCode Slate 页面中的块级 `image` 节点。
- 保留原始图片，不在下载阶段调用视觉模型生成说明。
- PDF 继续使用浏览器原生预览；其他二进制附件继续下载，不在本阶段转换。
- 不修改预处理、向量索引和知识图谱流程。

## 3. 产出目录

```text
spaces/{space}/batches/{batch_id}/
├── pages/
│   └── {page_hash}-{page_name}.md
├── assets/
│   └── {page_name}/
│       └── {asset_hash}-{original_name}.{ext}
├── files/
│   └── {page_name}/...
└── resources.json
```

Markdown 使用相对路径：

```markdown
![image.png](../assets/使用docker镜像部署openclaw/69aa7ab0-image.png)
```

`resources.json` 增加 `page_asset`：

```json
{
  "id": "resource-id",
  "kind": "page_asset",
  "pageId": "page-id",
  "pageName": "页面标题",
  "name": "image.png",
  "logicalPath": "spaces/.../assets/.../image.png",
  "size": 43205
}
```

## 4. 接口设计

### 4.1 PingCode API 客户端

```python
class PingCodeAPIClient:
    def get_public_image_token(self, refresh: bool = False) -> str: ...
    def download_public_image(self, image: dict) -> tuple[bytes, str]: ...
```

公共图片必须先调用 `/api/typhon/secret/file/public-image-token` 获取短期令牌，再将令牌作为 `token` 查询参数访问 `originUrl`。客户端校验 URL 与 PingCode 主机一致，且路径必须位于 `/atlas/files/public/`。

### 4.2 内容解析器

```python
class ContentParser:
    def parse_document(self, document, image_resolver=None) -> str: ...
    def extract_images(self, document) -> list[dict]: ...
```

`image_resolver(image_node)` 返回本地相对 URL。未提供 resolver 时优先保留 `originUrl`，避免解析器再次删除图片节点。

### 4.3 文件预览 API

```http
GET /api/files/{resource_id}/preview-data
GET /api/files/{resource_id}/content
```

`preview-data` 仅用于文本预览，响应：

```json
{
  "resourceId": "...",
  "name": "文档.md",
  "format": "markdown",
  "content": "# 标题",
  "assets": {
    "../assets/page/image.png": "asset-resource-id"
  }
}
```

`content` 只返回 `resources.json` 已登记的文件，使用正确的 MIME 类型内联响应。路径解析继续限制在 `PINGCODE_WEB_DATA_ROOT` 内。

## 5. 下载流程伪代码

```text
读取页面详情
提取 Slate document
提取全部 image 节点
for each image:
    获取或复用公共图片短期令牌
    下载 originUrl 原图
    校验 HTTP 状态、非空内容，并在 `application/octet-stream` 时校验图片文件签名
    写入 assets/{page}/
    登记 page_asset 资源
    建立 image node -> Markdown 相对路径映射
    失败时登记 error 资源并增加任务 warnings
使用 image_resolver 将 Slate document 转为 Markdown
启用附件下载时始终调用页面附件接口，不依赖目录摘要中的 attachment_count
原子写入 pages/{page}.md
写入 resources.json
```

## 6. 预览流程伪代码

```text
用户点击 Markdown 文件“预览”
前端请求 preview-data
根据 assets 映射重写 marked image token.href
marked 解析 Markdown
DOMPurify 清理 HTML
在页面内文档预览弹窗展示
用户可切换“文档预览 / Markdown 源码”
图片通过 /api/files/{asset_id}/content 加载
```

## 7. 安全与可回溯性

- 不把 PingCode 临时令牌写入 Markdown、日志或 `resources.json`。
- 图片 URL 只允许当前 PingCode 主机和 `/atlas/files/public/` 路径。
- 预览 HTML 必须经过 DOMPurify，禁止 Markdown 内嵌脚本执行。
- 内容接口按资源 ID 查询清单，不接受服务器绝对路径。
- 图片下载错误包含页面 ID、图片名和错误原因，任务 `warnings` 可直接观察。
- 文件名使用稳定哈希，重复执行覆盖同一资源，不产生随机副本。

## 8. 测试与验收

### 8.1 单元测试

1. `originUrl` 图片节点生成 Markdown 图片语法。
2. resolver 可将图片改写为本地相对路径。
3. 嵌套文档可完整提取图片节点。
4. 非 PingCode 主机和非公共图片路径被拒绝。
5. 预览资产映射只包含同页面登记的 `page_asset`。
6. 路径穿越仍被文件服务拒绝。

### 8.2 集成测试

1. 真实调用 PingCode 页面详情和公共图片令牌接口。
2. 重新下载目标批次，确认 `assets/` 中存在 PNG/JPEG 文件且文件签名正确。
3. 真实启动后端，调用 `preview-data` 与 `content`，确认状态码、MIME 和内容。
4. 构建 Vue 前端，浏览器点击“预览”，确认 Markdown 排版和图片加载。

### 8.3 验收指标

- 目标页面已发现图片数 = 成功图片数 + 失败图片数。
- 成功图片文件大小大于 0，MIME 为 `image/*`；若源站返回 `application/octet-stream`，必须通过 PNG/JPEG/GIF/WebP/BMP/TIFF 文件签名校验。
- Markdown 图片引用均能解析到批次内已登记资源。
- 预览页面无纯文本直出、无资源 404、无脚本注入。
