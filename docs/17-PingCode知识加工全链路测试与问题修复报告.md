# PingCode 知识加工全链路测试与问题修复报告

> 日期：2026-07-28  
> 批次 ID：`batch_157fe779b2ac4fb5`  
> 预检 ID：`preflight_000790e976d34c2d`  
> 任务 ID：`training_eab455f5e69e40ec`

## 一、验证结论

- 新后端已统一使用 `maxUnitCharacters=6000` 和 `fallbackOverlapCharacters=0`，12 篇文档生成 57 个处理单元，最大单元 5975 字符。
- 预检与正式资料预处理均为 57 个处理单元，处理单元 ID/内容哈希汇总值一致。
- `8001`、`3500`、`4100` 均已恢复为单监听进程，`3500/pingcode-api` 健康检查指向当前后端。
- 语义补充对模型回显 `taskId/resourceId/chunkId`、别名字段和集合项内部 ID 的归一化已通过首次调用与 Schema 纠正调用测试。
- 真实模型连接测试成功，但知识提取负载连续 4 次在 90 秒后超时。本次任务因验证时间取消，未进入真实语义补充阶段，不宣称真实模型语义路径已通过。

## 二、问题修复表

| 问题 | 现象 | 根因 | 修复措施 | 验证结果 |
|---|---|---|---|---|
| 处理单元数量为 154 | 历史页面显示 154 个“分块” | `8001` 旧进程使用 `1200/120` | 重启当前后端，预览、预检和正式处理共用结构优先构建器 | 预检 57，正式 57，哈希一致；最大单元 5975 |
| 术语不一致 | 页面和日志显示“分块” | 历史 chunk 直译 | 用户可见文案统一为“处理单元” | 前端源码无“分块字符/重叠字符/个分块”文案，构建通过 |
| 语义补充拒绝 `chunkId` | `Additional properties are not allowed` | 模型回显字段在 Schema 校验前未稳定清理 | 先清理追踪字段、转换别名、过滤内部 ID，最后校验；纠正调用复用同一逻辑 | 相关单元测试通过；真实任务未到达语义阶段 |
| 任务难以定位 | 日志缺少阶段、Agent、模型调用级 ID | 旧事件契约不完整 | 增加 `eventId/taskId/stageRunId/agentTaskId/modelCallId` 及业务 ID | 当前 26 条事件全部具有基础追踪 ID，18 条关联 Agent，13 条关联模型调用 |
| 预检与正式数量不同 | 预计数量和最终产物可能偏差 | 两处切分实现不同 | 公共处理单元构建器；预检快照持久化 `preflightId/inputHash` | 57/57，`preflightInputHash=formalInputHash` |
| 取消后仍继续调用 | 点击取消后还启动下一处理单元 | 知识提取循环只在步骤开始前检查取消 | 每个 Agent 任务前检查取消，增加两单元回归测试 | 测试确认首项后取消不再调用第二项 |
| 统一重启脚本误判失败 | `4100` 加载超过 2 秒时脚本退出 | 健康检查窗口过短 | `4100/8001` 均改为最多等待 30 秒 | 服务已分别通过 HTTP 健康检查 |
| 知识提取真实调用超时 | 小型模型测试成功，提取调用连续超时 | 当前 `qwen3.7-plus` 提供商在结构化提取负载下 90 秒内无响应 | 应用按单项记录 `modelCallId` 并降级为质量问题；本次未改动用户模型配置 | 4 次完整超时事件可追踪；外部模型性能问题尚未解决 |

## 三、自动化验证

| 验证项 | 结果 |
|---|---|
| 后端完整测试 | 125 项通过，21 项因外部环境跳过 |
| 语义回显字段归一化 | 首次调用和 Schema 纠正调用均通过 |
| 缓存追踪 | 命中缓存生成新 `agentTaskId`，`modelCallId=null` |
| 前端构建 | `vite build` 通过；存在既有大 chunk 警告 |
| 真实 API 扫描 | 12 个文本资源，0 个不支持资源 |
| 真实 API 预检/正式预处理 | 57/57，哈希一致 |
| 真实模型连接测试 | 成功，3128 ms |
| 真实知识提取 | 失败，连续 4 次超时，任务已取消 |

## 四、证据路径

- `scripts/pingcode/runtime/web/training-runs/training_eab455f5e69e40ec/run-manifest.json`
- `scripts/pingcode/runtime/web/training-runs/training_eab455f5e69e40ec/events.jsonl`
- `scripts/pingcode/runtime/web/training-runs/training_eab455f5e69e40ec/metadata/chunks.jsonl`
- `scripts/pingcode/runtime/web/training-runs/training_eab455f5e69e40ec/quality/fix-report.json`
- `scripts/pingcode/runtime/web/training-runs/training_eab455f5e69e40ec/quality/fix-report.md`

## 五、未完成验证

1. 当前模型提供商需先解决知识提取负载超时，再完成真实 `needs_enrichment` 成功路径。
2. 本次真实任务没有进入知识校验、图谱和数据集生成阶段；这些阶段仅由自动化测试覆盖。
3. 浏览器页面的交互操作本次使用与前端相同的 `3500/pingcode-api` 请求链验证，未执行 Playwright 点击回放。
