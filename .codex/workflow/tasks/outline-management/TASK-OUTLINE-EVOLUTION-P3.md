# TASK-OUTLINE-EVOLUTION-P3：上传准入与真实 API 回归

## 元信息

- 状态：blocked（等待 P2）
- 阶段：P3 / M3
- 负责：backend-worker、test-engineer
- 协作：architecture-designer、doc-writer
- 预计工期：1 个工作日；实施子任务每项 1 至 4 小时
- 依赖：P2 通过 M2
- 需人类确认：P2 审批覆盖 0 知识点行为变更；新增安全/性能范围需另行确认
- 可并行：失败矩阵准备可并行；公共上传路由由 Backend Worker 独占

## SMART 目标

在 P2 完成后的 1 个工作日内，将统一解析接入正式上传链路，在任何持久化前阻断空树、0 知识点、缺失字段和重复 ID，并用真实后端 API 回归证明失败无残留且既有合格格式不受影响。

## 工作范围

1. 完成上传准入、写入边界、错误响应和清理策略设计及伪代码。
2. 接入统一解析，建立写前校验和一致的 HTTP/错误码契约。
3. 覆盖标准 Markdown、标题树、JSON、CSV、空文件、混合层级、重复 ID、编码和大小边界。
4. 启动真实后端调用 API，验证成功树、失败响应和文件/metadata 状态。

## 文件归属

- Architecture Designer 独占：`agent-runner/docs/modules/outline-management/development/41-管理员手册大纲兼容阶段三-安全上传与真实API验收设计.md`。
- Backend Worker 独占：上传路由及持久化边界相关后端文件。
- Test Engineer 独占：测试矩阵、fixtures 和真实 API 验收报告。
- Frontend 文件不在本阶段范围。

## DoR

- [ ] P2 AST、诊断契约和规则版本冻结。
- [ ] 上传行为变更已获批准，兼容和回退策略明确。
- [ ] 隔离测试目录、metadata 备份/清理和 API 环境已准备。

## 验收标准 / DoD

- [ ] 归一化 0 知识点、空树、缺失必填字段和重复 ID 均返回结构化失败。
- [ ] 所有失败在正式写入前发生，不产生文件或 metadata 半成品。
- [ ] 当前原样本不再出现“成功但 0 知识点”。
- [ ] JSON、标准 Markdown、CSV 合格样本和标题树兼容样本通过真实 API 回归。
- [ ] 相关单元/集成测试、文档同步和 `git diff --check` 通过。

## 参考

- `.codex/requirements/modules/outline-management/REQ-OUTLINE-COMPATIBILITY.md`
- `.codex/workflow/modules/outline-management/PLAN.md`
- `agent-runner/docs/modules/outline-management/development/41-管理员手册大纲兼容阶段三-安全上传与真实API验收设计.md`
- `agent-runner/docs/modules/outline-management/overview/outline-management-overview-design.md`
