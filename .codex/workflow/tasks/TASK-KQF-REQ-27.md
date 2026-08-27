# TASK-KQF-REQ-27: 关键词过滤人工调整与问题类别一致性

## 元信息
- 状态: completed
- 类型: 独立父任务
- 分配: backend-worker / frontend-worker / test-engineer
- 创建: 2026-08-14
- 目标完成: TASK-KQF-REQ-26 验收后 1 个工作日内
- 依赖: TASK-KQF-REQ-26 completed
- 后续依赖方: TASK-KQF-REQ-28
- 需人类确认: 否（用户已确认按推荐方案逐个实施）
- 可并行: 父任务之间不可并行；本任务内部后端与前端可按独占文件并行

## 需求目标
依据 `docs/27-关键词过滤人工调整与问题类别一致性需求.md`，将整行隐式切换改为明确、可保存、可审计的人工复核，并由后端强制保证动作、类别和备注的一致性。

## 已确认实施边界
- 采用 300ms 批量自动保存和运行级 `revision` 乐观锁，冲突时整体重新加载，不做字段级静默合并。
- `keep` 的最终类别必须为 `null`；`exclude` 必须使用运行冻结字典中的合法类别。
- `other` 允许应用，但必须填写人工备注；首版 `reviewedBy=anonymous`。
- 图谱状态与最终快照使用可恢复事务日志保证一致，不引入数据库依赖。

## 子任务与顺序
1. 在需求 26 验收通过后并行执行：
   - `TASK-KQF-REV-01`：实现复核 PATCH、汇总、校验、冲突与原子应用后端契约。
   - `TASK-KQF-REV-02`：实现明确控件、类别选择、备注、自动保存和差异汇总。
2. `TASK-KQF-REV-03`：执行状态组合、并发、刷新恢复和真实 API 验收。

## SMART 验收标准
- [x] 需求 26 通过后 1 个工作日内完成 REV-01 至 REV-03，或记录可复现阻塞证据。
- [x] 点击关键词、理由或行内文本不会修改动作，只有中文标注的保留/排除控件可修改。
- [x] 后端拒绝排除无类别、非法类别及 `other` 无备注；保留保存后类别恒为 `null`。
- [x] 模型动作、类别和理由保持不可变；复核动作、类别、备注刷新后可恢复。
- [x] 两客户端持有同一 revision 时只有一个 PATCH 成功；应用汇总满足 `finalKeep + finalExclude = candidateTotal`。
- [x] 分页、筛选和搜索不改变完整决策集合；后端定向测试、前端构建和相关 `git diff --check` 通过。

## 文件归属
- REV-01 独占：`scripts/pingcode/web/backend/app/training_service.py`、`app/main.py`，必要时 `app/models.py`。
- REV-02 独占：`scripts/pingcode/web/frontend/src/components/KeywordReviewDecision.vue`、`src/views/QualityPage.vue`。
- REV-03 独占：复核路由和前端复核测试文件；生产缺陷回交对应 Worker。
- 必须等待 TASK-KQF-REQ-26 释放共享生产文件后开始；完成后再释放给需求 28。

## 真实 API 边界
- 使用隔离数据集真实验证复核保存、刷新恢复、revision 冲突、非法组合和最终 apply。
- `batch_dc23fc9141ba4d6f` 仅允许读取和界面展示核对，禁止保存复核或 apply。
- 测试不得通过直接改运行产物绕过公共 API 的后端校验边界。

## 完成条件
`TASK-KQF-REV-03` 全部通过后将本任务标记 completed，才可启动 `TASK-KQF-REQ-28`。

## 参考文档
- `docs/27-关键词过滤人工调整与问题类别一致性需求.md`
