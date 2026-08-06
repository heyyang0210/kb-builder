# TASK-KFS-05: 执行隔离数据验收与页面验证

## 元信息
- 状态: completed
- 分配: test-engineer
- 创建: 2026-08-05
- 预计完成: 2026-08-06
- 预计工时: 3 小时
- 依赖: TASK-KFS-04
- 需人类确认: 否
- 可并行: 否

## SMART 目标
在 3 小时内启动真实前后端，使用隔离数据集完成关键词过滤应用、统计、图谱和正式知识输入的 HTTP/UI 验收，并对指定批次执行只读对照。

## 验收步骤
- 编译前端并启动实际服务，验证真实监听端口、健康检查和页面资源版本。
- 从测试 fixture 创建隔离数据集，执行过滤预览/SSE、应用决策、图谱 summary/nodes/edges 查询。
- 核对应用响应、四组统计、节点数和边数来自同一版本；保存脱敏响应摘要。
- 浏览器验证过滤前、过滤后、发生变化三个视图及中文状态，不出现已删除功能。
- 只读读取 `batch_47c5cdb5dec744a1` 当前统计，记录历史字段兼容性，不发写请求。
- 验证正式知识输入计划仅包含 admitted 关键词；不要求执行外部模型端到端抽取。

## 参考文档
- `scripts/pingcode/web/backend/tests/test-report-keyword-filter-state.md`
- `scripts/pingcode/web/frontend/src/views/QualityPage.vue`
- `docs/12-PingCode知识提取步骤详细设计.md`
- `docs/15-PingCode图谱与数据集生成步骤详细设计.md`

## 验收标准
- [x] 真实后端 API 和真实前端构建产物均验证通过。
- [x] 状态一致性和图谱变化由隔离自动化测试覆盖；未对真实数据执行写入型 `filter-apply`。
- [x] 浏览器页面无已删除入口、控制台异常或失败网络请求。
- [x] `batch_47c5cdb5dec744a1` / `dataset_1df85d1df97143ca` 仅做只读对照，未修改运行数据。
- [x] 已记录真实 URL、接口结果、计数及浏览器验收证据。

## 预计变更文件
- `scripts/pingcode/web/backend/tests/test-report-keyword-filter-state.md` (modified)

## 执行日志
- 2026-08-05 Planner：定义隔离写入与真实批次只读验收边界。
- 2026-08-05 Test Engineer：真实前后端及浏览器验收通过；指定数据集只读结果为过滤前 43、过滤后/保留 30、排除 13，图谱 56 节点/137 边/0 悬空边。
