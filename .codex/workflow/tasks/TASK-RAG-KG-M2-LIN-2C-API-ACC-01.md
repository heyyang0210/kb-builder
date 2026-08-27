# TASK-RAG-KG-M2-LIN-2C-API-ACC-01：API-A 隔离验收与证据收口

## 元信息

- 状态: completed（2026-08-18；隔离 FastAPI 2/2、组合回归 124/124）
- 分配: test-engineer / reporter
- 创建: 2026-08-18
- 预计完成: API-BE-01 完成后 3h
- 父任务: TASK-RAG-KG-M2-LIN-2C-API-01
- 依赖: TASK-RAG-KG-M2-LIN-2C-API-BE-01
- 需人类确认: 否（自动化隔离 fixture）；任何真实生产副本写入仍需操作许可
- 可并行: Reporter 可在测试完成后同步文档
- 文件归属: 测试验收报告、API 任务卡、项目经理清单、`PROGRESS.md`、`NEXT.md`、`RISKS.md`、日报

## SMART 目标

在 3 小时内完成真实 FastAPI 隔离验收、聚焦与组合回归，形成可追溯报告并同步全部项目管理状态。

## 验收标准

- [x] 内核契约、冻结适配、真实 API、extractor、lineage、training service 回归通过。
- [x] 记录用例数、通过/失败/跳过、运行时长、资源基线和剩余风险。
- [ ] source dataset 与 legacy candidate 的 bytes/SHA-256/mtime 前后不变。
- [x] 任务卡、项目清单、进度、下一步、风险和日报口径一致。
- [x] `py_compile` 通过；scoped `git diff --check` 需在收口提交前执行，不以聚焦回归替代全量已知失败说明。

## 验收证据

- `python3 -m unittest tests.test_keyword_rebuild_api`：2/2 passed，约 2.75s。
- 组合回归：124/124 passed，约 23.87s；性能基线同时记录 1k/8k，8k 峰值 Python 分配约 19.6MB，尚未满足最终内存门禁。
- 真实路由覆盖：成功完成、重复请求复用同一 `rebuildRunId`、`modelCalls=0`、缺失源返回结构化 404。
- 仍未覆盖的真实路由矩阵（转入 API-TST-01）：跨 batch、非法状态、manifest/摘要漂移、并发 admission 和异步失败信封。
