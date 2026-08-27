# 文档管理模块

documentType: overview-design
moduleId: document-management
owner: Architect
status: verified
version: 1.0.0
updatedAt: 2026-08-21
relatedRequirements: []
relatedDesigns:
  - development/document-comments-design.md
  - development/complex-relationship-preview-design.md
relatedTasks: []

## 模块边界

文档管理模块负责已注册文档的列表、阅读、编辑、下载、删除、元数据与阅读评论。它消费文档生成结果，但不负责生成工作流编排、资料清洗或用户身份管理。

## 代码映射

| 边界 | 位置 |
|---|---|
| 文档与评论 API | `agent-runner/routes/document.js` |
| 文档阅读界面 | `agent-runner/frontend/prompt-generator.html` |
| 评论持久化数据 | `agent-runner/data/document-comments.json`（运行时创建） |
| 真实 API 测试 | `agent-runner/tests/document-comments-api.test.js` |
| 复杂关系预览测试 | `agent-runner/tests/e2e/16-complex-relationship-preview.spec.js` |

## 开发设计

- [文档阅读评论设计](./development/document-comments-design.md)：文档级评论、可选引用文本、新增与删除、文件持久化契约。
- [复杂对象关系预览设计](./development/complex-relationship-preview-design.md)：将高密度 ER 图按业务域转为可读关系视图，并保留原始技术表达。

## 维护约束

- 修改文档或评论公共 API、持久化结构或阅读交互前，先更新对应开发设计。
- 后端变更必须启动真实服务验证，不能只使用路由 mock。
- 当前评论不包含身份和权限语义；引入用户系统时必须重新设计删除授权和审计字段。
