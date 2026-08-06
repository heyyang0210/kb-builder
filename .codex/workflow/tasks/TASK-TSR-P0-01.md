# TASK-TSR-P0-01: 恢复 TrainingService 可编译基线

## 元信息
- 状态: completed
- 分配: backend-worker
- 创建: 2026-08-05
- 预计完成: 2026-08-05
- 预计工时: 2 小时
- 依赖: 无
- 需人类确认: 否（用户已明确无效草稿需清理/重建）
- 可并行: 否

## SMART 目标
在 2 小时内修复 `training_service.py` 第 299 行附近的语法破坏，删除已明确判定无效且未跟踪的 `managers/`、`services/`、`utils/` 和 `training_service.py.backup`，恢复后端模块可编译、可导入基线，同时完整保留当前关键词过滤 API 与行为差异。

## 需求描述
- 先保存 `git status --short`、目标文件 diff 和公开方法清单作为执行证据。
- 只移除无效重构接线及其未跟踪草稿；不得用 `HEAD` 整体覆盖当前文件。
- 保留 `preview_keywords_filter_by_skill`、`stream_keywords_filter_by_skill`、`apply_keywords_filter` 及其现有路由契约。
- 不触碰前端、Agent Runner、配置、运行数据或其他无关修改。

## 参考文档
- `docs/12-PingCode知识提取步骤详细设计.md`
- `docs/15-PingCode图谱与数据集生成步骤详细设计.md`
- `scripts/pingcode/web/backend/app/training_service.py`
- `scripts/pingcode/web/backend/app/main.py`

## 验收标准
- [x] `python3 -m py_compile app/training_service.py` 通过。
- [x] `python3 -c "from app.training_service import TrainingService"` 在后端目录执行通过。
- [x] 四个无效未跟踪目标已清理，且无对应 `__pycache__` 残留。
- [x] 当前关键词过滤公开方法及 `main.py` 路由仍存在，签名未改变。
- [x] `git diff --name-only` 未出现本任务产生的范围外新增改动；仓库既有无关脏改动保持不变。

## 变更边界
- 允许: `scripts/pingcode/web/backend/app/training_service.py`
- 删除: `scripts/pingcode/web/backend/app/managers/`、`services/`、`utils/`、`training_service.py.backup`
- 禁止: 其他当前已修改或未跟踪文件

## 执行日志
- 2026-08-05 Reporter：依据任务卡执行日志、Phase 2 验收报告和当前工作区证据复核，状态保持 `completed`，5 项验收标准全部满足。
- 2026-08-05：保存目标范围 `git status --short`、backup 对比、关键词过滤方法及路由清单。
- 2026-08-05：确认当前文件相对 backup 仅新增两段无效接线；以最小补丁删除顶部 `managers/services/utils` 导入块和错误插入 `KnowledgeExtractionWorkflowAgent` 参数字典的服务初始化块，保留其余业务修改。
- 2026-08-05：删除未跟踪的 `app/managers/`、`app/services/`、`app/utils/`、`app/training_service.py.backup` 及对应 `__pycache__`。
- 2026-08-05：在 `scripts/pingcode/web/backend` 执行 `python3 -m py_compile app/training_service.py`，退出码 0。
- 2026-08-05：在 `scripts/pingcode/web/backend` 执行 `python3 -c "from app.training_service import TrainingService; print(TrainingService.__name__)"`，输出 `TrainingService`，退出码 0。
- 2026-08-05：AST 检查确认签名保持为 `preview_keywords_filter_by_skill(self, dataset_id)`、`stream_keywords_filter_by_skill(self, dataset_id)`、`apply_keywords_filter(self, dataset_id, decisions)`；`main.py` 三处路由调用仍存在。
- 变更文件：`scripts/pingcode/web/backend/app/training_service.py`、`.codex/workflow/tasks/TASK-TSR-P0-01.md`。
- 删除路径：`scripts/pingcode/web/backend/app/managers/`、`scripts/pingcode/web/backend/app/services/`、`scripts/pingcode/web/backend/app/utils/`、`scripts/pingcode/web/backend/app/training_service.py.backup`。
