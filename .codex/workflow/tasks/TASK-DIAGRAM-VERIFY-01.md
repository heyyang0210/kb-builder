# TASK-DIAGRAM-VERIFY-01: 架构图与流程图一致性验收

## 元信息
- 状态: partial
- 分配: test-engineer
- 创建: 2026-08-07
- 预计完成: 2026-08-07
- 依赖: TASK-DIAGRAM-FLOW-01
- 需人类确认: 否
- 可并行: 否

## 需求描述
对 Draw.io 两个页面执行静态和可视验收：检查 XML 可解析、页面/图例存在、关键节点和箭头文本齐全，并与六步骤设计、快照并发设计和错误隔离契约逐项比对。验证导出图片在常见桌面宽度下文字不重叠、主路径可读、异常分支可追踪。该任务不调用后端、不修改业务代码。

## 参考文档
- .codex/workflow/tasks/TASK-DIAGRAM-ARCH-01.md
- .codex/workflow/tasks/TASK-DIAGRAM-FLOW-01.md
- docs/08-pingcode-processing-six-step-pipeline-design.md
- docs/01-PingCode资料预处理步骤详细设计.md

## 验收标准
- [x] Draw.io XML 经 XML::Parser 解析通过，页面数为 2。
- [x] 六阶段名称、模型边界、快照/并发控制、失败分类和取消路径均能在图中定位。
- [ ] 导出 PNG/SVG（若生成）无截断、重叠或不可辨识箭头。
- [x] 静态验收未发现与当前六步骤设计不一致项；可视排版仍需 draw.io 客户端确认。

## 变更文件
（完成后填写）
- .codex/workflow/daily/ 或测试报告路径（待实现后填写）

## 执行日志
- 2026-08-07 规划完成，等待图纸产出
- 2026-08-07 XML 解析、页面数、关键节点和连线数量检查通过；因本机无 draw.io CLI，未生成 PNG/SVG，不宣称可视验收完成。
