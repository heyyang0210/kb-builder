# 知识中心功能链路性能专项

设计契约：`.codex/知识中心建设平台/05-测试设计&报告/01-测试设计/知识中心-平台-界面性能专项-测试设计文档.md`。

```bash
# 当前运行环境：专用测试数据、真实后端与真实AI。该模式会新增测试资产/模板/草稿；结束时自动收尾，保留原始证据。
npm run test:performance -- --current
# 先跑一轮探索（仍会真实调用AI）
npm run test:performance -- --current --rounds 1
# 显式指定服务、配置和证据目录
npm run test:performance -- --current --base-url http://127.0.0.1:13510 --config tests/performance/knowledge-center/config.json --output runtime/performance/my-run
# 已启动的隔离实例（与统一E2E一致，必须匹配运行标识）
KNOWLEDGE_CENTER_TEST_RUN_ID=... npm run test:performance -- --isolated --base-url http://127.0.0.1:端口
```

凭据优先从 `PERF_USERNAME/PERF_PASSWORD` 读取，否则使用已有本地 `config/knowledge-center/.env`，不打印/保存凭据。专项不纳入普通full/e2e自动发现，避免普通回归意外消耗真实模型或操作共享环境。串行、单浏览器、无自动重试。

配置集中维护轮次、可见模块、必需链路、反馈/就绪预算、AI完成预算、专用数据提示词和命名。不建议将少量探索样本的P95作为稳定容量指标。第一轮代表会话首次访问，不能代表数据库/服务冷启动。

证据全部写入 `runtime/performance/<run>/`：
- `results.json`：逐轮、逐步原始测量、API状态/资源时长、长任务、覆盖缺口和测试数据ID。
- `report.md`：中文链路步骤统计、失败原因、覆盖限制。
- `001.png` 等：每步完成/失败截图，不计入响应时间。

计时从DOM捕获的真实交互事件开始，分别等待业务反馈和语义终态的两帧绘制机会。拒绝交互前已成立的终态，避免已有标题/旧正文被计为0毫秒。错误提示不作为成功。后端异常、漏模块、未完成链路、任一步超预算均导致非零退出。失败链路停止当前模块，其余模块继续。

测试新增数据均记录本次运行标识和ID；成功或失败均按归属清理。大纲移入回收站、手册归档、模板逻辑删除；本地上传批次、会话和文件在无任务/数据集引用时删除。清理失败使退出码非零，证据写入 cleanup.json。中断后执行 `node tests/performance/knowledge-center/cleanup-run.cjs --results runtime/performance/<run>/results.json` 重放。远端清洗服务没有删除接口时须提供 `--local-data-root` 的本地存储映射，否则报告清理失败。草稿、AI和审计记录遵守产品留存生命周期。共享连接/权限配置仅打开和取消；不自动改动现有业务草稿。外部发布没有专用仓库及独立审核身份时明确保留未验收项，不能把只读覆盖称为全模块端到端通过。

计时器自身回归（不调用产品AI，不是产品验收）：

```bash
node --test tests/performance/knowledge-center/probe.test.cjs tests/performance/knowledge-center/cleanup.test.cjs
```

`config.json.requiredSteps` 是逐模块步骤清单，前序失败时后续步骤保留“未执行”，不补0。真实AI失败单独记录失败提示时间；保存与采用成功还需真实API回读一致。未拆分早期反馈的步骤，其反馈列仅代表首个指定终态。三轮P95实为该组最大值，不能当作稳定生产SLO。

最终汇总复核晚到的接口错误；尚未真实交互的失败不继承前序探针时间。计时器及证据汇总回归共3项。2026-10-28三轮结果与覆盖缺口见[功能链路验收报告](../../../.codex/知识中心建设平台/05-测试设计&报告/02-测试报告/知识中心-平台-功能链路性能专项-测试报告文档-20261028.md)，该轮完整验收未通过；原始证据与事后复核结果分别保留。
