# TASK-DIAGRAM-ARCH-01: 知识加工流水线 Draw.io 架构图

## 元信息
- 状态: completed
- 分配: doc-writer
- 创建: 2026-08-07
- 预计完成: 2026-08-07
- 依赖: 无
- 需人类确认: 是（仅确认图中是否按当前设计展示组件边界，不涉及代码或 API 变更）
- 可并行: 是（可与流程图制作并行）

## 需求描述
使用 Draw.io 绘制“知识加工流水线架构图”页面，反映当前六阶段、运行控制面、产物快照和外部模型边界。图中必须区分前端展示、后端 PipelineScheduler/Stage、ArtifactRepository/BatchCoordinator、规则处理、Agent/Skill/模型服务、质量与事件审计，以及原始资料和阶段产物存储。明确标注资料预处理和元数据构建不调用大模型，知识提取与按需语义补充按需调用大模型，校验合并后才允许图谱与数据集生成。

## 参考文档
- docs/08-pingcode-processing-six-step-pipeline-design.md
- docs/04-pingcode-processing-e2e-framework-design.md
- docs/01-PingCode资料预处理步骤详细设计.md
- docs/11-PingCode元数据构建步骤详细设计.md
- docs/12-PingCode知识提取步骤详细设计.md
- docs/14-PingCode知识校验与合并步骤详细设计.md
- docs/15-PingCode图谱与数据集生成步骤详细设计.md

## 验收标准
- [x] Draw.io XML 可解析，架构图页面名称和图例为中文。
- [x] 六个阶段、输入/输出产物、控制组件和模型边界完整且无歧义。
- [x] 通过不可变快照、两阶段提交、single-flight/CAS 或锁的标注表达并发一致性边界；未增加不存在的业务组件。
- [x] 图中所有跨边界箭头带方向，模型调用链可追溯到 Agent/Skill，阶段产物可追溯到文件目录。
- [x] 已与六步骤设计、资料预处理设计和方案 C 快照契约逐项核对。

## 变更文件
- diagrams/knowledge-processing-pipeline.drawio (added)

## 执行日志
- 2026-08-07 规划完成，等待图纸实现与人类确认
- 2026-08-07 架构图页面完成，XML 静态解析通过；本机无 draw.io CLI，导出预览待在 draw.io 客户端执行。
