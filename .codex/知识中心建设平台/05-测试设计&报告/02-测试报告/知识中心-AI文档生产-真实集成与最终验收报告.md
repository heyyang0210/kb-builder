# 知识中心 AI 文档生产真实集成与最终验收报告

- 时间：2026-10-23 15:33 +0800。
- 依据：AI 文档生产需求 AI文产-01～16；逐项实现、复用、验收和证据见 [实施矩阵](../../04-开发任务/知识中心-文档生产-AI生成实施与验收-开发任务文档.md)。
- 结论：本次实现和分层验收完成。模型、PingCode、知识库 MCP、测试用例库与 YashanDB test_hy 使用真实服务；审核发布衔接按原始目标允许的隔离环境验证。没有向外部 GitLab 创建真实 MR、合并或发布。

## 交付与复用

入口：知识中心 → 文档生产 → 选择手册及目标文档 → AI 助手，支持按大纲生成、润色、指定位置续写、按模板改写、按资料更新及质量检查。来源预览确认后生成候选，查看差异、人工编辑、采用并保存，元信息随修订保留；已保存正文可检查并复测，然后按既有权限送审。

直接复用统一模型配置和 LLMClient、ValidatorAgent/BaseAgent、MCPClient、template-store、AggregateStore、saveDraft、CAS/权限、增量审核与 GitLab connector。适配扩展任务/来源快照/续写Skill/元信息及工作台交互；新增生产质量编排器与四个受信任Skill处理函数，分别提取用例、执行只读SQL、比对预期和生成报告，避免另建任务或审核事实源。

本轮修复 PingCode 页面短标识解析：在允许空间索引内唯一匹配 short_id/identifier、解析内部ID并校验详情；URL按配置的origin和空间双重限制复用既有资料服务。示例正文14735字符，非SPA首页HTML。

## 真实验证

公共证据目录：`runtime/test-results/production-ai-integration/20261023/`。

| 验证 | 结果 | 证据 |
|---|---|---|
| CAS 平台任务 | 五种操作真实候选；初次润色失败后重试成功 | real-jobs-results.json |
| 五操作内容效果 | 全部通过；润色保留参数16、示例和版本提示；续写带Skill且保留原文；生成/改写使用固定模板标题与SQL；更新有真实CPU/内存/IOPS资料依据、范围外不变 | semantic-operations.json |
| 四类来源和URL | PingCode设计/测试、MCP、用例库均经真实平台预览；YASDOC短URL主动读取、确认并冻结 | cas-multisource-platform-revalidation.json、pingcode-test-source-platform-revalidation.json、yasdoc-reference-real.json |
| Windows真实工作台 | 恢复候选，差异/来源/推理可见，未点击采用 | workbench-restored-candidate.json |
| 隔离浏览器业务闭环 | 真实模型和URL+用例库，候选差异、人工编辑、采用保存回读、质量及复测、送审通过；认证与草稿仓储隔离 | live-browser-acceptance.json、live-candidate.png |
| 内容质量 | 真实四项完成并定位问题，两轮39/44秒；故意缺项及失配正文被判不通过 | live-browser-acceptance.json |
| 数据库与质量Agent | 真实test_hy：1通过/1失败/1未执行，4个Skill均有执行轨迹；修订和复测关联存在；门禁正确not_passed | live-browser-acceptance.json |
| 审核发布衔接 | 真实生成正文经保存、在线评审冻结；未批准拒绝交付、批准后MR创建、交付正文与保存后正文一致、重试幂等；终态mr_submitted | real-content-review-handoff.json |
| 草稿保护 | CAS API 200，editVersion仍为2、原revision及正文SHA256一致 | final-draft-integrity.json |

审核交付使用真实后端和真实 GitLab connector，GitLab 上游为本地 HTTP fixture；不冒充远端集成。保存规范化仅补充末尾换行，报告分别保存原候选和保存后正文摘要。数据库验收中失败与禁止语句是刻意构造，测试通过表示流程能识别问题，不能解读成这份正文可以发布。

## 异常与回归

无权限、来源不可用/越界、冲突版本、取消、重试、幂等、草稿保护、模板/Skill过期和无库未执行由既有定向HTTP/浏览器/单元验证覆盖，证据在实施矩阵所指测试及阶段报告。

- `python3 tests/run_tests.py unit --jobs 1`：45/45项任务，Jest80/80套件、753/753用例；`runtime/test-results/unit/20261023-152032-386854-unit/report.html`。
- `python3 tests/run_tests.py contract`：7/7项任务；contract-latest.log。
- `python3 tests/run_tests.py e2e`：2/2项任务，283项直接通过、1项Firefox重试通过；`runtime/test-results/e2e/20261023-151022-034935-e2e/report.html`。
- 并发运行时曾有无关增量并发测试5000ms超时，串行统一入口复验通过，没有修改断言。E2E Firefox抽屉触达尺寸首次不满足44px，重试通过，保留flaky记录，不声称首轮全绿。

## 失败记录与验收限制

原质量脚本仅检查报告数量，误将30秒超时的四个not_executed记成通过。`timeout-history-live-browser-acceptance.json`已更正passed=false并保留originalHarnessPassed；原日志仅用于追溯。修正验收断言要求completed、model及四项实际执行，既有配置timeoutMs调整到120000后真实复测成功，没有降低检查协议或质量门禁。

首次更严格生成失败保存在semantic-first-attempt.json；追加明确的写作指令“无法准确定位时provenance=[]，由平台保守标记待核验推理”后五操作实测通过，没有放松产品解析规则。该方式可完成生成但不表示每段均已获得来源核验；直接引用、资料归纳与混合区间能力另有协议和HTTP/浏览器证据。模型产出仍须人工校验，不承诺每次生成成功或所有语义自动正确。

已授权且已完成的真实服务集成没有剩余外部阻塞。本次不包含外部仓库合并、生产发布或使用其他空间文档。共享草稿保持原状。复现环境和命令详见公共证据目录README.md，运行产物不包含密钥或浏览器认证材料。
