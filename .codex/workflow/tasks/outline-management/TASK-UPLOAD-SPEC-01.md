# TASK-UPLOAD-SPEC-01: 梳理大纲上传的事实约束并编写输入输出规格

## 元信息
- 状态: pending
- 分配: doc-writer
- 创建: 2026-08-17
- 预计完成: 2026-08-17
- 预计工时: 3 小时
- 依赖: 无
- 需人类确认: 否（仅整理现有实现事实，不改变接口）
- 可并行: 是（与 TASK-UPLOAD-SPEC-03 的测试样例盘点可并行）

## 需求描述
以 `agent-runner` 的“大纲上传”链路为主范围，形成中文设计文档，明确用户上传内容与格式的可执行要求，并把“实现事实、推荐规范、暂不支持项”分开。必须同时说明其与 `scripts/pingcode` 素材上传链路的边界，避免把分片素材上传限制误写成大纲文件限制。

文档应覆盖：支持的扩展名和大小、编码与空文件处理、JSON/Markdown/CSV 的字段和层级、解析器会忽略/保留的内容、归一化后的标准结构、上传 API 字段、失败行为、示例和常见错误。对当前代码没有显式校验的内容（例如标题唯一性、ID 连续性、描述长度）只能标记为“推荐或待确认”，不得伪造为硬约束。

## 参考文档
- `agent-runner/frontend/js/components/OutlineUploader.js`
- `agent-runner/routes/outline.js`
- `agent-runner/docs/modules/outline-management/overview/outline-management-overview-design.md`
- `agent-runner/docs/17-新功能模块设计.md`
- `agent-runner/docs/33-通用素材上传映射下载与加工平台概要设计.md`
- `outlines/README.md`
- `templates/README.md`

## SMART 验收标准
- [ ] 新增一篇中文规格设计文档，包含“事实约束/推荐规范/待确认项”三栏或三层表达。
- [ ] 明确列出 `.json`、`.md`、`.csv` 的解析规则、最小可用示例和归一化 JSON Schema 草案。
- [ ] 明确 10 MB 单文件限制、multipart 字段、错误响应及服务端/前端双重校验位置，并注明证据代码路径。
- [ ] 至少用 2 个现有大纲文件和 1 个无效示例核对解析结论，记录差异和不确定性。
- [ ] 文档包含适用版本、更新日期、相对路径交叉引用；如目录 README 需要同步，列出同步项。

## 变更文件
- `agent-runner/docs/modules/outline-management/development/29-YashanDB知识库大纲上传内容与格式规格.md`（新增）
- `agent-runner/docs/modules/outline-management/README.md`（同步索引）

## 执行日志
- 待开始
