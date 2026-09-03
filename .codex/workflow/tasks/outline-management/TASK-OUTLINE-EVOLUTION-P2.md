# TASK-OUTLINE-EVOLUTION-P2：统一解析与结构化诊断

## 元信息

- 状态：blocked（等待 P1 完成和方案二审批）
- 阶段：P2 / M2
- 负责：backend-worker
- 协作：architecture-designer、test-engineer、doc-writer
- 预计工期：2 个工作日；每张实施子卡 1 至 4 小时
- 依赖：P1 通过 M1；标题树纳入上传契约获得人类确认
- 需人类确认：是，扩展解析边界
- 可并行：解析 fixtures 可与模块实现并行；公共 AST/配置/路由串行编辑

## SMART 目标

在人类批准且 P1 完成后的 2 个工作日内，建立服务端统一解析入口，使标准 Markdown 与标题树方言归一化为同一标准树，并为所有阻断或歧义结果返回稳定、可定位、可复现的结构化诊断。

## 工作范围

1. 先完成阶段设计、Schema、错误码、规则配置和伪代码评审。
2. 实现方言识别、中间 AST、标准 Markdown 与标题树适配器。
3. 输出 `dialect`、`specVersion`、`ruleVersion`、标准树、计数、诊断和未决映射。
4. 建立黄金样本和契约测试，确保同一输入同一规则版本结果确定。

## 文件归属

- Architecture Designer 独占：`agent-runner/docs/modules/outline-management/development/40-管理员手册大纲兼容阶段二-统一解析与结构化诊断设计.md`。
- Backend Worker 独占：新解析/归一化模块和版本化规则配置。
- Test Engineer 独占：对应 fixtures、单元和契约测试。
- 正式上传路由接入留给 P3，避免与 P2 并发修改公共路由。

## DoR

- [ ] P1 验收通过，规范副本和映射报告可作为测试基线。
- [ ] 人类已批准标题树纳入正式解析契约。
- [ ] AST、方言优先级、错误码、歧义策略和配置边界评审通过。

## 验收标准 / DoD

- [ ] 原样本识别为标题树方言，所有未解析节点均进入诊断或未决映射。
- [ ] 标准 Markdown 的标准树和知识点计数不回归。
- [ ] 每条问题包含稳定错误码、中文文案键、行号或字段路径、证据和修改动作。
- [ ] 同输入、同 `ruleVersion` 输出稳定；解析规则未散落在前后端。
- [ ] 设计与配置说明同步，相关测试和 `git diff --check` 通过。

## 参考

- `.codex/requirements/modules/outline-management/REQ-OUTLINE-COMPATIBILITY.md`
- `.codex/workflow/modules/outline-management/PLAN.md`
- `agent-runner/docs/modules/outline-management/development/40-管理员手册大纲兼容阶段二-统一解析与结构化诊断设计.md`
- `agent-runner/docs/modules/outline-management/development/29-YashanDB知识库大纲上传内容与格式规格.md`
