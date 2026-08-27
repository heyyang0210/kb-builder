# TASK-RAG-KG-M8-GS-WRITE-TST-01：异步投影状态与故障红灯测试

## 元信息

- 状态: completed（红灯合同已建立，等待 WRITE-BE 转绿）
- 分配: test-engineer
- 创建: 2026-08-19
- 预计完成: 开始后 4h
- 依赖: GS-DES-01
- 需人类确认: 否
- 可并行: 是；与 CONTRACT-BE 文件不重叠
- 文件归属: `scripts/pingcode/web/backend/tests/test_graph_projection_write.py`

## SMART 目标

在 4 小时内建立 GraphWriteRun、批次 checkpoint、重试、部分失败、死信、恢复和事实源不变性的红灯测试。

## 验收标准

- [x] 覆盖合法/非法状态迁移和 CAS 冲突。
- [x] 覆盖同一 `graphVersionId` single-flight 与重复 admission。
- [x] 覆盖节点成功边失败、超时、进程中断、重启恢复和重试耗尽。
- [x] 覆盖逐条 issue 脱敏、可重试分类和 checkpoint 连续性。
- [x] 所有投影失败/并发冲突场景都断言事实源文件 SHA 不变。
- [x] partial/failed/dead-letter 版本不可标记为 GraphRAG 可查询。
- [x] 记录红灯证据；scoped `git diff --check` 通过。

## 红灯接口合同

- 状态仓储：`app.repositories.graph_write_repository.GraphWriteRepository`。
- 投影执行器：`app.graph_projection_service.GraphProjectionWorker`；兼容同模块的 `GraphProjectionService` 命名，但二者至少实现一个。
- 仓储最小接口：`admit_projection`、`lease_next`、`get_run`、`transition`、`checkpoint`、`list_issues`、`is_queryable`。
- 执行器最小接口：构造时注入 write repository、`GraphVersionRepository`、GraphStore、时钟、batch/lease/retry 配置和可选 fault injector；`project_next(workerId)` 单次处理一个可租赁事件。
- 稳定分类由异常对象的 `code/error_code` 或字符串表达，不在本任务提前固化具体异常类继承层次。

## 覆盖证据

测试文件：`scripts/pingcode/web/backend/tests/test_graph_projection_write.py`，共 8 项：

1. 合法状态链、终态反向迁移和 revision CAS 冲突。
2. 8 路重复 admission 与 8 路 lease 竞争，均要求 single-flight。
3. 节点成功、关系逐项失败后的 partial/dead-letter、issue 脱敏和查询阻断。
4. 可重试 timeout、`retry_wait`、到期恢复和连续 node/edge checkpoint。
5. `before_cursor_commit` 进程退出、lease 到期接管和幂等重放。
6. 两次 timeout 后重试耗尽、dead-letter、retryable 分类和敏感正文零命中。
7. checkpoint 单调性、过期 lease fencing 和旧 worker 禁止覆盖。
8. partial/failed/dead-letter 三种状态均不得激活 queryable binding。

所有场景使用 `TemporaryDirectory` 中真实 `GraphVersionRepository` 生成 formal/published 不可变事实；GraphStore 使用厂商无关内存合同替身，不读取生产数据、不使用 mock、不引入依赖。

## 执行记录（2026-08-19）

```bash
cd scripts/pingcode/web/backend
python3 -m py_compile tests/test_graph_projection_write.py
python3 -m unittest tests.test_graph_projection_write -v
git diff --check -- tests/test_graph_projection_write.py \
  ../../../../.codex/workflow/tasks/TASK-RAG-KG-M8-GS-WRITE-TST-01.md
```

- `py_compile`：通过。
- `unittest`：成功收集并执行 8 项，`8 failures`，耗时约 `0.266s`。
- 8 项均在隔离 GraphVersion fixture 成功提交后失败，唯一红灯为缺少 `app.repositories.graph_write_repository` 与 `app.graph_projection_service`；没有 collection、fixture、语法、网络或生产数据错误。
- scoped `git diff --check`：通过。
- 环境未安装 `pytest`，因此套件已使用标准库 `unittest`，没有新增第三方依赖。

## 转绿边界

WRITE-BE 必须保持 JSON/JSONL graph version 事实源只读；不能通过放宽 partial/failed 查询门禁、跳过 lease fencing、吞掉逐项失败或记录底层敏感错误正文来使测试通过。红灯转绿后仍只证明本地 repository/worker integration，不代表真实 FastAPI、ACL、外部图数据库或 GraphRAG 生产验收完成。
