# TASK-TSR-P1-01: 完成重构设计与特征测试基线

## 元信息
- 状态: completed
- 分配: doc-writer
- 创建: 2026-08-05
- 预计完成: 2026-08-05
- 预计工时: 4 小时
- 依赖: TASK-TSR-P0-01
- 需人类确认: 否（采用已批准的门面兼容与依赖倒置方案）
- 可并行: 否

## SMART 目标
在 4 小时内新增 `docs/21-TrainingService分层重构详细设计.md`，冻结 `TrainingService` 公共 API、模型网关与产物仓储契约，提供接口、伪代码和至少 12 项可重复的特征测试矩阵。

## 需求描述
- 统计构造参数、所有非下划线方法、被 `main.py` 调用的方法及测试直接依赖的私有方法。
- 设计 `ModelGateway` Protocol 与默认 HTTP Adapter，覆盖 `status/update_config/test/chat_json/stream_chat`。
- 设计 `ArtifactRepository` Protocol 与本地文件 Adapter，覆盖 JSON、JSONL、文本、复制及原子写入。
- `TrainingService` 保持门面；依赖从构造器注入，默认实例兼容当前启动方式。
- 明确模型超时由调用选项推导、错误保持中文语义、密钥不写日志。
- 盘点现有 FakeGateway、文件私有方法及关键词过滤测试，区分单元测试、真实后端 HTTP API 和真实模型网关验收。

## 参考文档
- `docs/12-PingCode知识提取步骤详细设计.md`
- `docs/15-PingCode图谱与数据集生成步骤详细设计.md`
- `scripts/pingcode/web/backend/app/training_service.py`
- `scripts/pingcode/web/backend/app/main.py`

## 验收标准
- [x] 设计文档包含现状问题、目标分层、依赖图、接口、伪代码、迁移顺序和回滚策略。
- [x] 公共 API 基线表包含签名、调用方、输入输出和兼容要求。
- [x] 两个 Protocol 不反向依赖 `TrainingService`，不形成循环依赖。
- [x] 文件原子性、SSE 生命周期、HTTP 错误、超时与认证头契约均有明确说明。
- [x] 明确 Phase 2 不提取关键词业务、图谱算法、任务编排和 Skill 调用。
- [x] 特征测试矩阵至少 12 项，覆盖网关错误/超时/SSE、原子写、默认值、JSONL 和关键词过滤受保护链路。
- [x] 每项测试包含前置条件、输入、预期结果和执行命令。

## 变更文件
- `docs/21-TrainingService分层重构详细设计.md` (added)

## 执行日志
- 2026-08-05 Reporter：复核 `docs/21-TrainingService分层重构详细设计.md`，确认设计、接口、伪代码、迁移回滚方案及 25 项测试矩阵均已落盘，状态保持 `completed`，7 项验收标准全部满足。
- 2026-08-05：按 Doc Writer 角色读取当前 `training_service.py`、`main.py`、`docs/12`、`docs/15` 与 Test Engineer 测试矩阵，完成 Phase 1 设计基线。
- 2026-08-05：静态盘点当前源码为 7,287 行；`TrainingService` 共 175 个方法，其中 31 个非下划线方法；`main.py` 直接调用 27 个门面方法。
- 2026-08-05：新增依赖方向图、公开 API 基线、`ModelGateway`/`ArtifactRepository` Protocol、默认 Adapter、构造注入、接口伪代码、错误/超时/SSE/认证/原子写契约、迁移与回滚策略。
- 2026-08-05：落地 MG-01..MG-12、AR-01..AR-08、TS-01、KF-01..KF-04 共 25 项待实现/待执行特征测试，并列出分层执行命令。
- 2026-08-05：完成文档结构、关键契约、测试项数量和修改范围静态检查；本任务未修改代码，未运行 Phase 2 尚未创建的测试，不宣称 Phase 2 已实现或通过。

## 实际变更文件
- `docs/21-TrainingService分层重构详细设计.md`（新增）
- `.codex/workflow/tasks/TASK-TSR-P1-01.md`（状态、验收项与执行日志更新）
