# 文档阅读评论设计

documentType: development-design
moduleId: document-management
owner: Architect
status: verified
version: 1.0.0
updatedAt: 2026-08-21
relatedRequirements: []
relatedDesigns:
  - ../README.md
relatedTasks: []

## 1. 目标与范围

第一阶段允许使用者在文档阅读页查看、新增和删除文档级评论。评论正文必填，可附带一段手工录入的引用文本；评论由后端持久化，刷新页面或重启服务后仍可读取。

本阶段不包含：用户身份与权限、评论编辑、回复线程、自动捕获页面选区、引用锚点定位、审核状态和通知。由于平台尚无身份系统，任何使用者都可删除评论；这是一项显式的阶段性产品边界，不代表长期授权模型。

## 2. 设计决策

| 决策 | 说明 |
|---|---|
| 文档级关联 | 使用现有编码文档 ID 作为 `documentId`，不修改文档内容或元数据 |
| 独立数据文件 | 默认写入 `agent-runner/data/document-comments.json`，避免将运行数据混入配置或文档目录 |
| 原子更新 | 读改写全程持有进程内锁，先写临时文件再原子替换，降低并发丢失与半写风险 |
| 手工引用 | Markdown 与 sandbox HTML 的选区模型不同，第一阶段统一为可选文本框 |
| 无权限判定 | API 不接受或伪造 author；删除只验证评论存在且属于目标文档 |
| 文档存在性 | 三个接口都先解析文档 ID 并确认目标仍是文件，避免为无效文档创建孤立评论 |

文件型锁只保证单个 Node.js 进程内的一致性。多实例部署需要迁移到具备事务或条件写能力的共享存储，这不在本阶段范围内。

## 3. 数据契约

```json
{
  "version": 1,
  "comments": [
    {
      "id": "comment_<uuid>",
      "documentId": "<encoded-document-id>",
      "content": "评论正文",
      "quote": "可选引用文本",
      "createdAt": "2026-08-21T08:00:00.000Z"
    }
  ]
}
```

`content` 在服务端去除首尾空白后不得为空。`quote` 缺省时持久化为空字符串。第一阶段不额外设置业务字符上限，统一受服务端现有 JSON 请求体上限保护；若实际使用出现容量问题，再基于数据补充可配置限制。

## 4. API

### `GET /api/document/:docId/comments`

成功返回按 `createdAt` 升序排列的当前文档评论：

```json
{ "success": true, "data": [], "count": 0 }
```

### `POST /api/document/:docId/comments`

请求：

```json
{ "content": "需要补充边界条件", "quote": "原文片段（可选）" }
```

成功返回 `201` 和新评论。正文为空或字段类型错误返回 `400`。

### `DELETE /api/document/:docId/comments/:commentId`

评论存在且属于该文档时删除并返回成功；评论不存在或属于其他文档时统一返回 `404`，避免跨文档误删。

三个接口对无效或不存在的文档均返回 `404`。存储读取或写入失败返回 `500`，不返回本机绝对路径。

## 5. 伪代码

```text
listComments(docId):
  assertDocumentExists(docId)
  with comments lock:
    store = readStoreOrDefault()
    return store.comments where documentId == docId ordered by createdAt

createComment(docId, body):
  assertDocumentExists(docId)
  validate and trim content/quote
  comment = { generated id, docId, content, quote, now }
  with comments lock:
    store = readStoreOrDefault()
    append comment
    atomicWrite(store)
  return comment

deleteComment(docId, commentId):
  assertDocumentExists(docId)
  with comments lock:
    store = readStoreOrDefault()
    find exact (docId, commentId), otherwise 404
    remove and atomicWrite(store)
```

## 6. 前端交互

- 阅读工具栏提供“评论”开关并显示数量。
- 评论面板提供可选引用文本、必填评论正文、发表按钮、评论列表和逐条删除按钮。
- 切换文档时清空旧状态并加载新文档评论；新增或删除成功后更新列表和数量。
- 删除前二次确认；加载、空列表、提交中和失败均提供中文反馈。
- 宽屏采用阅读区与评论侧栏并排，窄屏评论区排列在文档内容下方。

## 7. 验证

真实后端 API 测试覆盖：带引用新增、列表读取、空正文拒绝、跨文档删除拒绝、删除成功和删除后不可见。前端验证覆盖评论面板切换、中文状态、提交与删除后的数量同步，以及移动端不重叠。
