# TASK-UPLOAD-SPEC-03: 设计规格验证样例与回归验收矩阵

## 元信息
- 状态: pending
- 分配: test-engineer
- 创建: 2026-08-17
- 预计完成: 2026-08-17
- 预计工时: 3 小时
- 依赖: TASK-UPLOAD-SPEC-01
- 需人类确认: 否（只读验证和测试设计）
- 可并行: 是（与 TASK-UPLOAD-SPEC-02 完成前的样例盘点可并行；最终矩阵依赖其评分字段）

## 需求描述
围绕大纲上传规格设计可重复的验证矩阵，优先使用现有 `agent-runner` 测试框架和真实后端 API。覆盖扩展名、大小边界、JSON/Markdown/CSV 解析、空/损坏文件、缺失层级、重复 ID、CSV 逗号/引号等边界，并验证归一化结果与 `kp_count`。同时规划评分器未来接入所需的 fixture 格式，但本任务不实现评分器或修改生产接口。

## 参考文档
- `agent-runner/docs/modules/outline-management/development/29-YashanDB知识库大纲上传内容与格式规格.md`（由 TASK-UPLOAD-SPEC-01 产出）
- `agent-runner/frontend/js/components/OutlineUploader.js`
- `agent-runner/routes/outline.js`
- `agent-runner/tests/api.test.js`
- `agent-runner/tests/document-api.test.js`

## SMART 验收标准
- [ ] 输出一份测试设计/验收矩阵，逐项列出输入 fixture、调用方式、预期 HTTP 状态/错误、解析结果和严重级别。
- [ ] 至少包含 10 个场景，其中正常 JSON/Markdown/CSV、10 MB 边界、11 MB 超限、未知扩展名、损坏 JSON、无知识点 Markdown、重复 ID 各 1 个。
- [ ] 明确哪些校验当前实现可自动验证、哪些只能作为推荐规范或未来评分器检查，避免把测试期望写成现有行为。
- [ ] 设计真实 API 验收命令和清理策略，不修改既有运行数据；如环境不可用，记录阻塞和替代静态检查。
- [ ] 将测试结果字段对齐评分输出契约：阻断问题、证据位置、建议动作和规格版本。

## 变更文件
- `.codex/workflow/tasks/outline-management/TASK-UPLOAD-SPEC-03-test-design.md`（新增测试设计）
- `agent-runner/tests/outline-upload-spec.test.js`（后续实现阶段再新增，本任务仅在确认范围后创建）

## 执行日志
- 待开始
