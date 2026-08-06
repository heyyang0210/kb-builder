# TASK-TSR-P2-02: 提取产物仓储并完成验证

## 元信息
- 状态: completed（有条件通过）
- 分配: backend-worker
- 创建: 2026-08-05
- 预计完成: 2026-08-06
- 预计工时: 4 小时
- 依赖: TASK-TSR-P2-01
- 需人类确认: 否
- 可并行: 否

## SMART 目标
在 4 小时内提取产物仓储接口与本地文件实现，完成 `TrainingService` 兼容接线，并通过聚焦测试及真实后端 HTTP API 验证 Phase 0-2 行为。

## 需求描述
- 仓储模块不得持有或导入 `TrainingService`；原子写继续使用同目录临时文件加替换。
- 保留 `_read_json/_write_json` 等薄包装，避免现有内部调用和测试失效。
- 追加构造注入参数时保持现有位置参数兼容，不迁移关键词、图谱、Skill 或任务编排业务。
- 启动真实 FastAPI 后端验证模型状态、数据集读取及关键词过滤契约；真实模型不可用时明确记录外部阻塞。

## 参考文档
- `docs/15-PingCode图谱与数据集生成步骤详细设计.md`
- `docs/21-TrainingService分层重构详细设计.md`
- `scripts/pingcode/web/backend/app/training_service.py`

## 验收标准
- [x] `ArtifactRepository` 及本地实现符合设计，原子写失败不破坏旧文件。
- [x] `TrainingService` 公开 API、默认构造、Gateway/Repository 注入保持兼容。
- [x] 关键词过滤预览、流式分析和应用决策实现未被改写，契约回归通过。
- [x] 编译、导入、Repository 和 TrainingService 聚焦测试通过；Gateway 聚焦测试由 `TASK-TSR-P2-01` 完成。
- [x] 真实后端 HTTP API 验收报告包含命令、状态码、响应摘要和脱敏日志证据；真实 apply 为避免污染用户数据未执行，审批写入、摘要更新和不重建索引由自动化测试覆盖。
- [x] 新目录 README 已同步实际实现状态；按本轮限定范围不修改 docs/12、docs/15 和 docs/21。

## 预计变更文件
- `scripts/pingcode/web/backend/app/repositories/__init__.py` (added)
- `scripts/pingcode/web/backend/app/repositories/artifact_repository.py` (added)
- `scripts/pingcode/web/backend/app/repositories/README.md` (added)
- `scripts/pingcode/web/backend/app/training_service.py` (modified)
- `scripts/pingcode/web/backend/tests/test_artifact_repository.py` (added)
- `scripts/pingcode/web/backend/tests/test_training_service.py` (modified)
- `scripts/pingcode/web/backend/tests/test-report-training-service-phase2.md` (added)
- `docs/12-PingCode知识提取步骤详细设计.md` (modified)
- `docs/15-PingCode图谱与数据集生成步骤详细设计.md` (modified)
- `docs/21-TrainingService分层重构详细设计.md` (modified)

## 执行日志

- 2026-08-05 Reporter：依据 Phase 2 验收报告复核，聚焦回归 92/92 通过；健康检查、模型测试、指定数据集图谱、非流式过滤和 SSE 过滤均返回 HTTP 200。
- 2026-08-05 Reporter：真实 apply 未在隔离数据集执行，但应用决策契约已有自动化测试覆盖；任务更新为 `completed（有条件通过）`，6 项验收标准全部勾选，未将后续风险整改扩展进本任务。
- 2026-08-05 Backend Worker：新增 `ArtifactRepository` Protocol 和 `LocalArtifactRepository`，仓储模块不导入或持有 `TrainingService`。
- 2026-08-05 Backend Worker：JSON、JSONL、文本使用目标同目录 `.tmp` 文件原子替换；写入或替换失败时保留旧目标并清理临时文件。
- 2026-08-05 Backend Worker：嵌入缓存使用 staging 构建、旧目录备份和切换失败恢复，源缓存缺失时以空目录替换目标。
- 2026-08-05 Backend Worker：`TrainingService` 在 `gateway` 后新增关键字专用 `artifact_repository`，六个既有私有文件方法改为实例薄委托，并清理原第 854 行行尾空格。
- 2026-08-05 验证：`python3 -m compileall -q app` 通过；仓储、TrainingService 和依赖导入通过。
- 2026-08-05 验证：`python3 -m unittest tests.test_artifact_repository -v`，9/9 通过。
- 2026-08-05 验证：`python3 -m unittest tests.test_training_service -v`，72/72 通过，包含关键词过滤预览、SSE、应用决策和仓储注入兼容测试。
- 2026-08-05 验收：真实 FastAPI 只读 API 和真实模型网关链路已完成；apply 真实写入保留为后续隔离数据集验收建议。

## 代码变更文件

- `scripts/pingcode/web/backend/app/repositories/__init__.py`
- `scripts/pingcode/web/backend/app/repositories/artifact_repository.py`
- `scripts/pingcode/web/backend/app/repositories/README.md`
- `scripts/pingcode/web/backend/app/training_service.py`
- `.codex/workflow/tasks/TASK-TSR-P2-02.md`
