# TASK-DIAGRAM-FLOW-01: 知识加工流水线 Draw.io 流程图

## 元信息
- 状态: completed
- 分配: doc-writer
- 创建: 2026-08-07
- 预计完成: 2026-08-07
- 依赖: TASK-DIAGRAM-ARCH-01（复用阶段命名和图例）
- 需人类确认: 是（确认异常分支和用户可见状态是否符合当前产品口径）
- 可并行: 否

## 需求描述
在同一 Draw.io 文件中新增“知识加工流水线流程图”页面，展示从批次检查、任务启动、六阶段顺序执行、阶段产物校验到完成/取消/失败的完整流程。重点表现：已存在且已提交的扫描/准备快照优先复用；缺失时执行轻量扫描；单记录损坏隔离为质量问题，清单整体不可验证才终止批次；阶段边界写入 started/progress/completed/failed/cancelled 事件；模型错误与 JSON/文件/Schema 错误分类不同；取消在阶段边界和长操作回调中生效。

## 参考文档
- docs/08-pingcode-processing-six-step-pipeline-design.md
- docs/01-PingCode资料预处理步骤详细设计.md
- docs/14-PingCode知识校验与合并步骤详细设计.md
- docs/15-PingCode图谱与数据集生成步骤详细设计.md
- docs/17-PingCode知识加工全链路测试与问题修复报告.md

## 验收标准
- [x] 流程图包含正常主路径、快照复用/轻量扫描分支、单记录隔离分支、批次终止分支和取消分支。
- [x] 六阶段顺序与设计文档一致，模型调用点仅出现在设计允许的阶段。
- [x] 关键节点标注输入、输出或用户可见中文状态。
- [x] 失败分类、质量问题和可继续加工条件均已标注。
- [ ] 在 Draw.io 中导出 PNG/SVG 并人工核对可读性（当前环境未安装 draw.io CLI）。

## 变更文件
- diagrams/knowledge-processing-pipeline.drawio (modified)

## 执行日志
- 2026-08-07 规划完成，等待架构图完成后实施
- 2026-08-07 流程图页面完成，关键节点与 16 条流程连线静态检查通过；可视导出待确认。
