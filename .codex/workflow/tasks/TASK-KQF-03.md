# TASK-KQF-03: 关键词过滤真实 API 与回归验收

## 元信息
- 状态: pending
- 分配: test-engineer
- 创建: 2026-08-14
- 预计完成: 2026-08-15
- 依赖: TASK-KQF-01, TASK-KQF-02
- 需人类确认: 否（默认只读目标批次；写入仅限隔离 fixture）
- 可并行: 否

## 需求描述
验证候选总数与模型决策数在后端 SSE、非流式 fallback、前端页面和 apply 前后的统计中保持一致；目标批次只读核对，所有写入型 apply 使用隔离数据。

## SMART 验收标准
- [ ] 真实调用后端 SSE，确认 `candidateTotal=643`、仅 78 条时 `status=incomplete`，不会标记为完成。
- [ ] 普通 POST fallback 与 SSE 使用相同完整性判定。
- [ ] 隔离 fixture 验证缺失决策、重复 ID、未知 ID、截断响应和完整响应。
- [ ] 输出 API 响应、事件序列、日志和前端截图/构建结果；执行相关测试、语法检查和 `git diff --check`。
- [ ] 形成中文最终验收表，列出修改功能点、执行效果、证据路径和未覆盖风险。

## 文件归属
- 实施阶段独占：`scripts/pingcode/web/backend/tests/`、必要的前端测试目录、`docs/24-关键词质量过滤修复执行效果.md`。
- 目标批次运行时目录只读，不提交生成产物。
