---
requirement: REQ-KGO-32
moduleId: knowledge-graph-governance
designVersion: 1.0.0
status: confirmed
createdAt: 2026-08-17
---

# 证据原文下钻与缺失原因诊断设计

## 一、设计结论

在现有 `GET /api/datasets/{datasetId}/graph/evidence` 上增加兼容字段，由后端完成稳定来源解析和定位可信度判定，前端只按响应呈现，不自行猜测来源。复用 `/api/files/{resourceId}` 的 metadata、preview-data、content 和 download 能力，不新增依赖。

## 二、状态模型

| 状态 | 判定 | 用户动作 |
|---|---|---|
| `available` | `resourceId` 可解析且存在证据片段 | 预览并核验原句 |
| `snippet_missing` | 来源存在，但证据文本为空 | 打开文档，按章节人工核验 |
| `source_unavailable` | 有 `resourceId`，文件服务无法解析 | 检查资源保留或重新加工 |
| `unlinked` | 证据记录没有 `resourceId` | 回到加工链路补齐稳定引用 |
| `stale` | 历史图谱事实源失效 | 查看历史状态，不关联当前同名来源 |

定位状态独立为：

| 定位级别 | 判定 |
|---|---|
| `exact` | 结构化文本原文中可验证到唯一证据区间 |
| `section` | 有 `headingPath`，但无法验证原句坐标 |
| `document` | 只能稳定定位到原始文档 |
| `unavailable` | 来源不可用或未关联 |

## 三、接口

请求保持不变。每条 `items[]` 增加：

```json
{
  "evidenceAvailability": "available",
  "source": {
    "availability": "available",
    "name": "索引内幕文档.md",
    "logicalPath": "spaces/.../索引内幕文档.md",
    "mediaType": "text/markdown",
    "previewMode": "structured_text",
    "previewUrl": "/api/files/resource_x/preview-data",
    "contentUrl": "/api/files/resource_x/content",
    "downloadUrl": "/api/files/resource_x/download"
  },
  "location": {
    "level": "exact",
    "headingPath": ["索引", "创建索引"],
    "start": 120,
    "end": 142,
    "basis": "verified_evidence_text",
    "message": "已在结构化原文中定位到证据片段"
  },
  "diagnostic": {
    "message": "来源与证据均可核验",
    "suggestedAction": "preview"
  }
}
```

兼容约束：保留现有 `resourceId/documentTitle/sourcePath/chunkId/headingPath/documentOffsets/evidenceText` 字段；`missingEvidence=true` 同时匹配 `snippet_missing/source_unavailable/unlinked`。

## 四、后端伪代码

```text
function resolve_evidence_source(occurrence):
    if resourceId is empty:
        return unlinked + unavailable_location
    try:
        resource = file_service.find(resourceId)
    except not_found:
        return source_unavailable + unavailable_location

    source = controlled_metadata_and_urls(resource)
    if evidenceText is empty:
        return snippet_missing + best(section, document)

    if source supports structured text preview:
        content = file_service.preview(resourceId).content
        location = verify_offset_or_unique_text_match(content, evidenceText)
        if location verified:
            return available + exact(location)

    return available + best(section, document)
```

```text
function verify_offset_or_unique_text_match(content, evidence, offsets):
    if offsets are valid and normalize(content[offsets]) == normalize(evidence):
        return offsets with basis=verified_document_offsets
    matches = all exact occurrences of evidence in content
    if count(matches) == 1:
        return matches[0] with basis=verified_evidence_text
    return no_exact_location
```

## 五、前端伪代码

```text
click preview(item):
    if source.previewMode == structured_text:
        fetch source.previewUrl
        render sanitized plain/markdown text
        scroll exact start/end into view when location.level == exact
    else if source.previewMode == inline:
        open source.contentUrl in a new tab
    else:
        show download/open action and location limitation

render evidence item:
    show status + document + controlled path + heading + chunk
    show evidence snippet or precise missing reason
    enable only actions permitted by source availability
```

## 六、界面

证据列表每条记录按“来源、位置、证据、动作”排列。预览使用页面级抽屉/遮罩，不嵌套卡片；结构化文本高亮证据片段。移动端预览占满宽度并支持关闭后焦点恢复。

## 七、安全、性能和降级

- API 仅返回受控逻辑路径和相对 API URL，不返回磁盘绝对路径。
- 单条证据仍限制 500 字符；只为当前分页记录解析来源。
- 文本精确匹配有上限，超限或多处命中时降级，不阻塞证据列表。
- 原文预览继续经过现有文件 API；不放宽鉴权与文件类型约束。
- 历史 `stale` 优先级最高，禁止执行来源解析和同名回退。

## 八、测试设计

真实 HTTP 覆盖：精确文本定位、偏移校验失败后唯一文本定位、重复文本降级、片段缺失、资源不存在、未关联、节点证据、关系证据和旧字段兼容。前端覆盖中文状态、按钮可用性、文本高亮、错误态、键盘关闭及 390px 响应式布局。
