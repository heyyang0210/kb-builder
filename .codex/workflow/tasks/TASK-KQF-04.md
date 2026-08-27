# TASK-KQF-04: 643/78 关键词过滤根因与修改方案文档

## 元信息
- 状态: completed
- 分配: doc-writer
- 创建: 2026-08-14
- 预计完成: 2026-08-14
- 依赖: 无
- 需人类确认: 否（用户已批准 docs/22 方案并要求按方案实施）
- 可并行: 是

## 需求描述
编写面向研发和验收的中文设计文档，基于代码、运行时 state 和目标批次产物说明：643 是图谱/候选关键词总量，78 是模型实际解析出的决策数量；解释非流式默认补全、流式增量解析和前端 complete 计数造成的口径错觉。文档使用可审计的证据链、伪代码、接口字段草案、错误分类、分批/重试方案、兼容性和回滚策略；不输出隐藏思维链，改用结论、证据和可复核推导。

## 参考文档
- `docs/22-关键词质量过滤643与78不一致问题分析及修改方案.md`
- `scripts/pingcode/web/backend/app/training_service.py:1030-1325`
- `scripts/pingcode/web/frontend/src/views/QualityPage.vue:315-470`
- `scripts/pingcode/runtime/web/state.json`
- `scripts/pingcode/runtime/web/datasets/dataset_1f0d622d3bd54fd8/graph/nodes.json`

## SMART 验收标准
- [x] 文档包含现象、数据证据、底层调用链、根因、修改前接口/伪代码、修改方案和验收矩阵。
- [x] 明确候选总数、决策数、完整性判定和 apply 输入之间的不变量。
- [x] 明确公共 API/架构/依赖/安全性能影响及需人类确认项。
- [x] 已检查 docs 目录，无需同步 README；任务/进度引用由 Planner 串行更新。

## 文件归属
- 独占文档：`docs/22-关键词质量过滤643与78不一致问题分析及修改方案.md`（已存在并完成）。
- 可更新：与该文档直接对应的 README、`.codex/workflow/PROGRESS.md` 和 `.codex/workflow/NEXT.md`（与 Planner 串行）。
