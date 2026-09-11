# 复杂对象关系预览设计

documentType: development-design
moduleId: document-management
owner: Architect
status: implementing
version: 1.0.0
updatedAt: 2026-08-24
relatedRequirements: []
relatedDesigns:
  - ../README.md
relatedTasks: []

## 1. 问题与目标

文档阅读器此前将所有 Mermaid 代码交给 `mermaid.run()`。`知识中心-平台-总体架构-概要设计文档.md` 第 8 节包含 39 条中文实体关系，Mermaid 10.9.8 对该 `erDiagram` 返回语法错误，页面只显示错误占位；即使语法兼容，单张高密度 ER 图缩放后也难以阅读。

目标不是强行画出更大的图，而是让阅读者先理解业务域和关系方向，同时保留原始技术表达供核对。

## 2. 表现方式

对 `erDiagram` 使用渐进披露关系阅读器：

1. 解析 `实体 + 基数 + 实体 + 关系语义`。
2. 按实体名称中的稳定业务关键词归入“组织与知识空间、大纲与生产编排、版本/审核/发布、集成与运营”。
3. 每条关系显示起点、方向、终点和关系语义；基数保留在方向提示中。
4. 原始 Mermaid 源码放入可展开详情，避免信息丢失。
5. 其他 Mermaid 类型继续使用 SVG 渲染；单图失败只降级当前图，不影响整篇文档。

业务域分组是阅读投影，不改变 Markdown 原文和业务模型。未命中关键词的关系落入“组织与知识空间”基础组，后续可根据重复出现的对象域再扩展配置。

## 3. 伪代码

```text
renderCodeBlocks(container):
  for each Mermaid code block:
    if source starts with erDiagram:
      replace with renderRelationshipExplorer(source)
    else:
      collect as ordinary Mermaid node

  render ordinary Mermaid nodes
  if one node fails:
    show local Chinese fallback; keep other diagrams usable

renderRelationshipExplorer(source):
  relations = parse relation lines
  for relation in relations:
    group = first matching business-domain keyword group
    append directional relation row
  render grouped overview and collapsible raw source
```

## 4. 验收

- 真实文档第 8 节不再出现 Mermaid `Syntax error in text`。
- 39 条关系全部出现且分为四个业务域。
- 同一文档的流程图、时序图继续生成 SVG。
- 600px 窄屏无页面级横向溢出，关系文本可以换行。
- 原始 Mermaid 代码可展开查看。
