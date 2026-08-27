# TASK-RAG-KG-RG25：M2 G2.5 验收与证据汇总

## 元信息

- 状态: blocked
- 分配: reporter / test-engineer
- 创建: 2026-08-18
- 预计完成: 2026-08-28（2h）
- 依赖: RG-22、RG-23、RG-24
- 需人类确认: 是（G2.5 联合签核）
- 可并行: 否
- 文件归属: M2 验收记录、RAG 项目经理任务清单、`PROGRESS.md`、`NEXT.md`

## 交付与验收

- [ ] RG-17—24 的设计、代码、测试、真实 API 和文档证据可追溯。
- [ ] 错误发布、越权成功和证据不可回放计数均为 0。
- [x] 任一 P0 失败时 M2 保持 blocked，不通过 G2.5。
- [x] 项目经理清单、进度看板和下一阶段计划同步更新。

## 当前验收结论

- RG-17/18/19/21/22/24 已完成各自限定范围；RG-17/19 尚未接生产事实源，RG-24 为注入式回放。
- RG-20 的身份、ACL 和审计策略尚未获得人类确认，RG-23 因此无法执行真实越权回归。
- G2.5 未通过，M2 继续保持 `blocked`；部分验收记录见 `agent-runner/docs/modules/knowledge-graph-governance/testing/02-m2-partial-acceptance.md`。
