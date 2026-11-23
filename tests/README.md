# 仓库测试入口

2026-11-17 全量回归：`python3 tests/run_tests.py all` 生成 `runtime/test-reports/2026-11-17/20261117-203159-260743-full/report.html`，82 项任务中 78 项成功，4175 用例中 4113 通过、20 失败、42 跳过。PingCode PATCH 与模板门禁仍未通过；实施者自检、隔离性能样本和剩余 E2E 失败详见 `runtime/test-results/full-test-performance-20261117.md`。

2026-11-17：任务管理页面减噪回归：`node --test tests/unit/agent-runner/document-tasks-frontend.test.cjs` 2/2；`node --test --test-name-pattern '任务详情返回与责任人变更|任务管理来源变化与导出入口|任务管理窄屏卡片' tests/e2e/agent-runner/knowledge-center-my-work.node.test.cjs` 3/3。覆盖单一列表、读取中无可见提示、折叠新增手册与“确定新增”、既有范围草稿/预览确认及桌面/390px 页面。

2026-11-17：任务详情视觉实施回归：`node --test --test-name-pattern '任务详情返回与责任人变更|任务管理来源变化与导出入口' tests/e2e/agent-runner/knowledge-center-my-work.node.test.cjs` 覆盖 1366px/390px 流程顺序、唯一主标题、变更责任人弹窗，以及 PingCode 来源三按钮底色和原有查看/同步/导出行为。任务分派端到端隔离用例见 `tests/unit/agent-runner/document-tasks-frontend.test.cjs`。

### 2026-11-17T11:02:06+08:00 大纲下载 HTTP 测试超时预算

`knowledge-center-outlines-view.test.js` 的真实 HTTP 下载场景验证模板/样例响应、XLSX 内容、缺失模板错误及服务进程存活。全量运行期间与浏览器测试、覆盖采集并发时，该用例执行 42.6 秒，超过 Jest 默认 5 秒；断言已完成但被误报超时。保留有效场景并将单例预算调为 60 秒。待资源空闲后定向复测；长耗时全量失败根因与性能门禁处置见 [全量测试报告](../.codex/知识中心建设平台/05-测试设计&报告/02-测试报告/知识中心-全量测试长耗时用例与失败处置-20261117.md)。

100 条关键词批量复核基线 400.48ms，隔离重跑 343.86ms，300ms 门槛不变。复核快照已改为紧凑 JSON；资源拥塞期间的重测在用例导入阶段阻塞，因此优化尚未验收，不能计作通过。

### 2026-11-17T10:17:41+08:00 数据库 Markdown 语言回退稳定复采

固定报告 `runtime/test-results/frontend-full-coverage-20261117-database-enhancer-language/`：62 源文件、1,305 项输入完整稳定，`database-enhancer.js` 行 28/28、分支 14/16；空语言文案回退已覆盖。前端总体行 10,670/11,928（89.45%）、分支 12,578/16,875（74.53%），分支总命中较前次动态结果波动 -1，不归因于该测试。平台覆盖目标仍未达成。

### 2026-11-17T09:52:11+08:00 数据库 Markdown 语言文案回退分支

完整 LCOV 复核确认 `database-enhancer.js` 的可达缺口为代码语言空值时工具栏回退显示 `text`。固定 Chromium 场景增加空语言名代码块并断言文案；纯正文无代码块无误告警断言也保留。覆盖变化待下一次稳定完整采集确认。

### 2026-11-17T09:36:00+08:00 写作兼容入口默认参数边界

`production-ai-dialog.js` 的 body 容器回退已有完整固定场景；无参调用会因下游必需 `context.documentId` 缺失抛出 TypeError，不作为成功流程固化。模块稳定覆盖为行 3/4、分支 13/14；继续推进其他合法业务分支。

### 2026-11-17T09:33:59+08:00 图片观察覆盖稳定验收及写作容器回退

固定前端采集 `runtime/test-results/frontend-full-coverage-20261117-repository-images-final/` 输入稳定完成：62 源文件、1,305 项输入；`repository-images.js` 行 31/31、分支 37/37；前端总行 10,668/11,928（89.43%）、分支 12,576/16,875（74.52%）。下一定向 Chromium 场景将验证 AI 写作兼容入口在页面根节点缺失时回退到 `document.body`，结果需由后续完整稳定采集确认。

### 2026-11-17T09:06:37+08:00 仓库相对图片 URL 固定覆盖场景

固定前端 Chromium 覆盖采集新增 `repository-images` 场景，直接调用 `repositoryImageURL`、`observeRepositoryImages`，检查相对路径/default context、拒绝非法和越界路径、初始无效图片、动态新增 img 探测，以及失效 src 后恢复/移除原 srcset。完整固定报告 `runtime/test-results/frontend-full-coverage-20261117-repository-images-final/` 的 62 个源文件、1,305 项输入稳定，`changedFiles=[]`、`changedInputs=[]`；`repository-images.js` 行 31/31、分支 37/37。前端整体行 10,668/11,928（89.43%）、分支 12,576/16,875（74.52%）；全平台目标仍未达成。设计及伪代码见 `TEST_REPORT_DESIGN.md`。

### 2026-11-17T09:01:53+08:00 HTML 报告产物追溯入口

HTML 总览和每个场景分页页脚均提供 Markdown 正式报告与原始 JSON 链接；链接是报告目录内的相对路径，方便离线归档、分享和机器读取。入口回归 `python3 -m unittest tests.unit.root.test_run_tests` 55/55；真实 smoke 2/2 任务、24/24 用例通过，报告 `runtime/test-results/smoke/20261117-090042-517846-smoke/report.html`。REA 对照 Allure、Playwright HTML Reporter、ReportPortal 和 pytest-html 的运行结果、定位、质量概览和离线证据能力；离线 Chromium 桌面/390px 各 10 次，DCL P95 18.1ms/16.0ms，搜索深链、无 JavaScript 分页通过，无错误、外部请求和横向溢出。内部评分沿用 9.5/10，非第三方认证；历史大报告性能限制仍在，smoke 未采集覆盖率，平台行 100%/分支 95% 目标未验收。

### 2026-11-17T08:54:00+08:00 IMA 修订差异边界覆盖

固定真实 Chromium 场景覆盖 IMA 修订相同正文、公共尾段、超限 LCS 回退及接受/拒绝内容保真。完整前端报告 `runtime/test-results/frontend-full-coverage-20261117-writing-tail/`：62 源文件、1,305 项输入稳定；`writing-changes.js` 行 31/31、分支 42/42。前端总量行 10,668/11,928（89.43%）、分支 12,571/16,875（74.49%），平台目标未达成。

### 2026-11-17T08:17:39+08:00 负责人配置加载恢复场景

固定 Chromium 页面真实触发责任人配置首次失败、用户重试成功恢复弹窗和焦点、再次错误回退提示。固定前端报告 `runtime/test-results/frontend-full-coverage-20261117-task-responsibility/`：62 源文件、1,305 项输入稳定，`loadTaskResponsibilityConfig()` 实际调用两次；全前端行 10,667/11,928（89.42%）、分支 12,568/16,875（74.47%）。平台覆盖门槛仍未达成。

### 2026-11-17T07:59:42+08:00 认证状态访问矩阵固定验收

固定 Chromium 认证场景覆盖匿名、管理员/普通用户、模块白名单、首个可访问视图、展示名与动作权限回退。完整前端报告 `runtime/test-results/frontend-full-coverage-20261117-auth-state-complete/` 的 62 个源码文件、1,305 项输入稳定；`auth-state.js` 行 18/18、分支 33/33，`auth-api.js` 行 21/21、分支 26/26。当前前端行 10,642/11,928（89.21%）、分支 12,542/16,875（74.32%）；平台目标仍未达成。

### 2026-11-17T07:33:27+08:00 认证 API 回退分支覆盖

固定 Chromium 认证场景覆盖 `AuthApiError` 默认字段、坏 JSON HTTP 回退、请求 ID 响应头/空值回退，以及 `getSession()` 的 content、原始 payload、空值兼容响应。完整前端报告 `runtime/test-results/frontend-full-coverage-20261117-auth-api-complete/` 的 62 源文件和 1,305 项输入稳定，`auth-api.js` 行 21/21、分支 26/26。前端总量行 10,641/11,928（89.21%）、分支 12,537/16,875（74.29%）；平台覆盖门槛未达成。

### 2026-11-17T07:04:48+08:00 专业 HTML 报告与前端覆盖复核

报告参考 Allure、Playwright HTML Reporter、ReportPortal、pytest-html 的总览/失败证据、状态筛选/用例定位、质量指标和离线日志能力；既有 REA Evidence 与桌面/390px 截图复核无新增缺陷，内部评分 9.5/10（自评，非第三方认证）。本环境 REA CLI 缓存缺少编译运行时，本轮未生成新的 REA Evidence。固定前端采集 `runtime/test-results/frontend-full-coverage-20261117-review-ticket-prefetch/`：62 源文件、1,305 项输入稳定；`review-bootstrap-prefetch.js` 行 15/15、分支 29/29（目标模块新增 1 分支）；全局行 10,639/11,928（89.19%）、分支 12,528/16,875（74.24%）。与上一动态报告比较有总量波动，不归因于单个用例；平台覆盖目标仍未达成。

### 2026-11-17T06:52:00+08:00 UI 图标 hydration 空根节点覆盖

固定 Chromium UI 契约场景增加 `hydrateSemanticIcons(null)` 安全返回断言。完整前端采集 `runtime/test-results/frontend-full-coverage-20261117-ui-hydration-null/` 稳定完成：62 源文件、1,305 项输入；`ui-system.js` 行 27/27、分支 26/26。前端总计行 10,639/11,928（89.19%）、分支 12,536/16,875（74.28%），总分支净增 3 项。目标仍未达成。

### 2026-11-17T06:39:27+08:00 导航根路径分支固定验收

固定导航状态场景增加 `viewFromPath('/') === null` 边界。完整前端采集 `runtime/test-results/frontend-full-coverage-20261117-navigation-root/`：62 个源码文件及 1,305 项输入稳定；`navigation.js` 行 23/23、分支 22/22。前端总量行 10,639/11,928（89.19%）、分支 12,529/16,875（74.24%），没有全局覆盖净增；平台目标仍未达成。

### 2026-11-17T06:25:57+08:00 任务下载失败和响应头回退覆盖

任务管理真实 HTTP/Chromium 场景覆盖 CSV 正常下载、502 非 JSON 错误提示与缺 `Content-Disposition` 时的默认下载文件名，定向 2/2 通过。固定前端报告 `runtime/test-results/frontend-full-coverage-20261117-download-fallback/`：62 个源码文件、1,305 项输入稳定，`document-tasks-api.js` 行 31/31、分支 27/27；总计行 10,639/11,928（89.19%）、分支 12,533/16,875（74.26%）。总分支净增 4 项，其中目标模块直接增加 3 项；总行数因动态场景计数有 2 行波动。平台覆盖目标仍未达成。

### 2026-11-17T06:04:28+08:00 专业 HTML 测试报告 REA 复验

`python3 tests/run_tests.py smoke --report-page-size 2` 已重新生成总览及 12 个场景分页：2/2 任务、24/24 用例通过。REA 6.7.0 对桌面与 390px 报告采集完整截图和无障碍树；独立离线 Chromium 验证搜索、用例深链、无 JavaScript 分页、无溢出及无外部请求通过，DOMContentLoaded P95 为 17.4ms/10.0ms。入口回归 54/54，内部评分 9.5/10（非第三方认证）。性能评分保留扣分，因为历史 3,469 用例大报告冷开曾超过 100ms；本次 smoke 未启用覆盖率，平台 100% 行/95% 分支目标仍未验收。证据和评分依据见 `runtime/rea/professional-test-report/ACCEPTANCE.md`。

### 2026-11-17T05:58:07+08:00 来源记录安全投影固定前端复采

`renderSourceRecord` 的缺失标题默认文案和不可信标题转义已通过真实隔离 HTTP/Chromium 场景覆盖。固定前端 62 源文件、1,305 项输入稳定；`safe-source-markdown.js` 行 7/7、分支 6/6。总计行 10,641/11,928（89.21%）、分支 12,529/16,875（74.24%）。报告 `runtime/test-results/frontend-full-coverage-20261117-source-record/`。平台覆盖目标仍未达成。

### 2026-11-17T05:45:12+08:00 来源记录标题安全投影测试

任务管理隔离浏览器场景补充 `renderSourceRecord` 的缺失标题默认值和不可信标题转义断言，并进入固定前端 Istanbul 采集。完整覆盖增量须以稳定全量报告确认。

### 2026-11-17T05:31:06+08:00 工作台分页空值分支复采

工作台空页码真实浏览器用例定向通过。固定前端全量清单 62 文件、1,305 项输入稳定；`page-jump.js` 行 10/10、分支 9/9。总计行 10,638/11,928（89.18%）、分支 12,522/16,875（74.20%），报告 `runtime/test-results/frontend-full-coverage-20261117-page-jump-empty/`。与上次完整运行总计有小幅反向波动，详细分文件差异见 `TEST_REPORT_DESIGN.md`；不能据此宣称全端覆盖达标。

### 2026-11-17T05:31:06+08:00 工作台分页空值边界

工作台分页真实 Chromium 场景补充空输入提交校验，确认显示错误且不触发额外查询；将由固定前端全量插桩验证对 `page-jump.js` 分支覆盖的实际增量。

### 2026-11-17T05:28:30+08:00 固定前端工作台跳页覆盖复采

固定采集器已运行工作台真实分页/筛选/刷新场景并合并刷新前后 Chromium Istanbul 快照。完整前端清单 62 个源文件，1,305 项输入稳定；行 10,640/11,928（89.20%）、分支 12,525/16,875（74.22%），较上一稳定报告增加 14 行、21 分支。`page-jump.js` 行 10/10、分支 8/9。报告 `runtime/test-results/frontend-full-coverage-20261117-page-jump/`。全平台 100% 行、95% 分支目标仍未达成。

### 2026-11-17T05:13:22+08:00 固定前端采集补入工作台跳页

修正固定前端覆盖采集漏选工作台真实分页浏览器场景的问题：该测试现在导出 Istanbul 计数，采集器将其并入固定工作台计数。定向场景验证指定页、越界输入拦截、版本筛选和刷新恢复；完整覆盖率增量以固定前端清单稳定复采为准。

### 2026-11-17T05:00:27+08:00 关系表变化历史分页边界

`document-task-relational-read-http.test.js` 经本地 HTTP 路由覆盖变化历史默认/显式分页、非法页码和页大小边界，错误请求断言公开 422 错误码且不触达存储查询。定向 Jest 6/6 通过；固定 Node 209 个 Jest 文件复采中 208 套通过、1 套条件跳过，3,068 项通过、9 项跳过；372 项输入稳定。Node 行 17,383/17,621（98.64%）、分支 18,176/20,561（88.40%），比前一稳定报告增加 7 行、12 分支。完整报告 `runtime/test-results/node-full-coverage/20261117-sync-changes/coverage/lcov-report/index.html`。平台行 100%、分支 95% 目标仍未达成。

### 2026-11-17T04:54:15+08:00 工作台投影分支固定复采

新增真实 HTTP 工作台投影场景，覆盖分配审核、生产交付动作及安全 MR 链接筛选。固定 Node 209 个 Jest 文件通过（3,066 通过、9 条件跳过），372 项输入稳定；行 17,376/17,621（98.60%），分支 18,164/20,561（88.34%），比前一稳定结果增加 11 个分支。报告 `runtime/test-results/node-full-coverage/20261117-workbench-projection/`。平台目标仍未达标；其余运行时基线和缺口见 [TEST_REPORT_DESIGN.md](TEST_REPORT_DESIGN.md)。

### 2026-11-17T04:34:49+08:00 GitLab 远端版本标识覆盖

隔离本机 GitLab HTTP 测试补充 commit/blob/snapshot 漂移拒绝，以及上游可选路径/版本标识缺失时的回退回读。固定 Node 209 个 Jest 文件通过（3,065 通过、9 条件跳过），372 项输入稳定；行 17,376/17,621（98.60%）、分支 18,153/20,561（88.28%）。报告 `runtime/test-results/node-full-coverage/20261117-gitlab-version-boundaries/`。平台覆盖率目标仍未达成，三端稳定结果和缺口见 [TEST_REPORT_DESIGN.md](TEST_REPORT_DESIGN.md)。

### 2026-11-17T04:24:20+08:00 AI 来源快照身份矩阵与 Node 稳定采集

真实隔离 HTTP 测试覆盖来源快照身份、正文摘要、分支、空白来源映射冲突及固定旧基线 commit 边界。固定 Node 209 个 Jest 文件完整通过（3,065 通过、9 条件跳过），372 项输入哈希稳定；行 17,376/17,621（98.60%），分支 18,146/20,561（88.25%），相对上一稳定结果增加 7 个分支。报告 `runtime/test-results/node-full-coverage/20261117-origin-snapshot-matrix/`。三端目标仍未达标，剩余缺口和其他运行时有效报告见 [TEST_REPORT_DESIGN.md](TEST_REPORT_DESIGN.md)。

### 2026-11-17T04:14:22+08:00 AI 来源快照边界与 Node 固定采集

`handbook-production-api.test.js` 通过真实隔离 HTTP 覆盖映射手册缺快照、平台摘要格式错误及 GitLab 快照字段不完整的拒绝结果；原生测试 29 项通过、2 项按环境跳过，固定 Jest 桥接 101 项通过、6 项按环境跳过。固定 Node 209 文件完整复采及 372 项输入稳定，行 17376/17621（98.60%）、分支 18139/20561（88.22%）。报告 `runtime/test-results/node-full-coverage/20261117-origin-snapshot-fixed/`。平台行 100%、分支 95% 仍未达标；跨端最新稳定数据及剩余缺口见 [TEST_REPORT_DESIGN.md](TEST_REPORT_DESIGN.md)。

### 2026-11-17T03:48:40+08:00 模型网关错误摘要矩阵覆盖

模型网关错误摘要和状态默认测试 20/20 通过。固定 Node 209 文件、372 项输入稳定，行 17373/17621（98.59%）、分支 18137/20561（88.21%）。前端 62 个产品源文件固定采集、1305 项输入稳定，行 10624/11928（89.06%）、分支 12513/16875（74.15%）。Java 48 项完整采集输入与当前工作树一致，行 5037/5112（98.53%）、分支 3206/3890（82.42%）。三端目标与采集证据见 [TEST_REPORT_DESIGN.md](TEST_REPORT_DESIGN.md)。

### 2026-11-17T03:28:04+08:00 模型网关错误边界与覆盖复采

模型网关真实 HTTP 测试 4/4 通过：流式开始前错误返回 JSON 502，流开始后仍返回 SSE 错误事件；视觉上游失败映射为 502。固定 Node 209 文件、372 项输入稳定，行 17373/17621（98.59%）、分支 18129/20561（88.17%）。前端 62 个源文件、1305 项输入稳定，行 10626/11928（89.08%）、分支 12504/16875（74.09%）。Java 48 项完整采集输入仍与稳定报告一致，行 5037/5112（98.53%）、分支 3206/3890（82.42%）。覆盖门槛与证据目录见 [TEST_REPORT_DESIGN.md](TEST_REPORT_DESIGN.md)。

### 2026-11-17T02:30:29+08:00 固定 Node / 前端覆盖采集更新

知识资产 GitLab 映射结构异常回退测试在固定 Node 209 文件清单中通过；Node 372 项输入稳定，行 17369/17619（98.58%）、分支 18128/20561（88.16%）。前端插桩对本机 JS 源文件直接读取后，完整“我的工作”浏览器场景 20/20 通过；固定前端 62 个源文件采集完成，1305 项输入稳定，行 10624/11928（89.06%）、分支 12511/16875（74.13%）。Java 当前 48 项完整清单输入仍与稳定采集哈希一致，行 5037/5112（98.53%）、分支 3206/3890（82.42%）。三端覆盖目标未达成；采集证据与剩余缺口见 [TEST_REPORT_DESIGN.md](TEST_REPORT_DESIGN.md)。

### 2026-11-17T01:36:57+08:00 HTML 报告覆盖率状态一致性

覆盖率快照和门禁明细现在共用状态判断：分母缺失显示“未统计”，目标缺失显示“目标未配置”，只有计数与目标齐全时才判定达标或未达标；缺少目标时进度条为中性。`python3 tests/run_tests.py smoke --report-page-size 2` 每次实际运行会生成 `report.html` 与静态场景分页。本轮入口回归 54/54；smoke 2/2 任务、24/24 用例通过，报告为 `runtime/test-results/smoke/20261117-014000-671434-smoke/report.html`。REA 6.7.0 Evidence `ev_ce3230e663e115ee37ef7c6739c7553b0a8c50aacb644bcf0bf99afaa1ccc6e1` 完整捕获总览；独立离线 Chromium 在 1440px/390px 各导航 10 次，搜索/深链/无 JavaScript 分页通过，零脚本错误、外部请求与横向溢出，DCL P95 24.2ms/16.7ms。内部质量评分 9.5/10，非第三方认证；该 smoke 未启用覆盖率，平台行 100%/分支 95% 仍未验收。设计和状态边界测试见 [TEST_REPORT_DESIGN.md](TEST_REPORT_DESIGN.md) 与 `unit/root/test_run_tests.py`。

### 2026-11-17 DSH 适配器监听失败与事实边界覆盖

`dsh-adapter-lifecycle.test.js` 使用临时目录和本地 Unix Socket，覆盖模型代理监听冲突后的失败持久化、沙箱事实拒绝矩阵及 200 条事件保留上限；与 `dsh-runner.test.js` 定向 Jest 共 22/22 通过。定向插桩中 `dsh-adapter.js` 为 170/170 行、95/112 分支（84.82%），证据 `runtime/test-results/dsh-directed-20261117/coverage-final2/coverage-summary.json`。`python3 tests/run_tests.py list` 显示 Unit 共 248 个文件，自动发现新测试。该数字仅为定向诊断，固定 Node 全量输入稳定采集后才能确认平台覆盖增量；不能据此证明真实 systemd/user namespace 隔离或全平台覆盖率目标达成。

### 2026-11-16 PingCode 来源路由 HTTP 覆盖

`knowledge-center-pingcode-routes-http-coverage.test.js` 通过公开 HTTP handler 验证来源与运行查询、写入分发、权限拒绝、405 和 Storage 错误映射。使用隔离 Storage stub，不请求外部 PingCode。契约见任务管理 PingCode 来源同步详细设计；运行 `npx jest --config tests/unit/agent-runner/jest.config.js --runInBand tests/unit/agent-runner/knowledge-center-pingcode-routes-http-coverage.test.js`。

### 2026-11-16T20:54:24+08:00 测试报告总览快捷导航

HTML 总览在指标卡片后增加失败、场景、覆盖率、任务和耗时区块的离线快捷导航；慢任务链接可定位至任务结果行。报告继续默认生成静态场景分页、逐条结果/失败日志，覆盖率仅在真实采集时显示。入口回归 51/51，smoke 2/2 任务、24/24 用例通过；1440px/390px 离线浏览各 10 次，DCL P95 98.5ms/70.3ms，无横向溢出。截图、搜索和深链证据在 `runtime/rea/professional-test-report/`，报告 `runtime/test-results/smoke/20261116-205305-740292-smoke/report.html`。内部评价 9.5/10，非第三方认证；本轮 smoke 未采覆盖率，平台 100% 行/95% 分支目标仍未达成。

### 2026-11-16 覆盖率首屏快照

总览在存在真实运行时覆盖数据时展示 Node、前端、Java 行/分支覆盖率及门禁状态，并链接到原覆盖率明细。缺失计数和目标分别显示未统计、目标未配置，不推断达标；无覆盖率报告仍显示未采集。设计与边界测试见 `TEST_REPORT_DESIGN.md`、`unit/root/test_run_tests.py`。

### 2026-11-16 DSH 适配器隔离契约补测

`dsh-runner.test.js` 使用系统临时目录覆盖 DSH 公开运行记录读取、遗留运行中断持久化、归属判断、非活动/终态取消回读及模型配置拒绝，不启动 Agent 或连接模型。定向 Jest 15/15 通过，`python3 tests/run_tests.py list` 将该文件纳入 unit。独立插桩结果为适配器 41/170 行、44/112 分支，仅作定向诊断；必须待固定 Node 完整输入稳定采集后判断全量增益。

更新后的固定 Node Jest 全量复采：207 套通过、1 套跳过，3039 项通过、9 项跳过；208 个 Jest 文件及 Node 覆盖源码共 371 项输入哈希一致。Node 行 17230/17619（97.79%）、分支 18038/20561（87.72%）。DSH 适配器为 60/170 行、48/112 分支，较前一稳定计数增加 16 行、24 分支。前端、Java 同次采集也各自输入稳定，但三端门禁仍未达标，不能以 DSH 局部增量替代全端目标。

### 2026-11-16T20:06:55+08:00 全量测试失败复盘与性能需求登记

执行 `python3 tests/run_tests.py all` 的报告 `runtime/test-reports/2026-11-16/20261116-185104-853121-full/report.md`：82 项任务中 71 项成功，4,120 个已识别用例通过 3,979、失败 95、跳过 46，总耗时 3,396.82 秒。该轮执行期间代码仍在变化，因此不是最终验收。失败集中在性能门禁、并发负载下的服务测试初始化、过期契约/页面断言及浏览器场景；失败明细和任务日志保留在报告目录。已修复隔离基线夹具仅供全量测试使用的问题、过时页面标题断言和 JSON 多进程超时未回收子进程的问题；相关 HTTP 边界 79/79、JSON 多进程复测、Graph 6/6、API Jest 17/17、关键词重建 HTTP 7/7 通过。GitLab HTTP 测试初始化等待从 5 秒调整到 15 秒后定向 22/22 通过。关键词复核性能门槛保持 300ms：100 条批量复核全量高负载测得 2681.92ms，隔离复测约 475ms；审核工作台主体可交互 P95 209.4ms（门槛150ms），手册投影样本164ms。性能差距未通过放宽门槛掩盖，已登记到需求工作簿第37、38项。工作台与关键词批量复核是本轮确认的最高影响慢功能；全量测试编排总耗时约56.6分钟，主要耗时任务为浏览器端到端 1241.52秒及948.37秒。最终结论待当前输入稳定后的全量复跑。

全量 Playwright 使用的合成基线和增量任务只通过隔离实例的 `/api/test-fixtures/incremental-baselines`、`/api/test-fixtures/incremental-tasks` 夹具接口写入；接口仅由 `tests/run_tests.py` 启动实例时显式开启。产品 API 不开放合成基线，也不允许通过通用增量任务列表接口创建任务；生产创建需遵循实际生产与审核流程。

### 2026-11-16 全量复跑与 E2E 夹具路由修复

稳定测试输入后重跑 `python3 tests/run_tests.py all`，报告 `runtime/test-reports/2026-11-16/20261116-201735-870515-full/report.md`：78/82 个任务成功，4,130 个已识别用例通过4,028、失败56、跳过46，总耗时2,186.14秒。Node Jest 183套件/2,694用例通过；Node test 135用例通过。确认两项性能失败是真实缺口：审核工作台主体可交互P95 196.5ms（门槛150ms）；100条关键词批量复核1,166.92ms（门槛300ms）。均已登记需求工作簿第37、38项，不降低门槛。按任务用时，最慢的是两个 Playwright E2E 批次，分别 1,040.88 秒（252例）和 725.02 秒（104例）；这属于浏览器回归批次耗时，不能直接归因到单一产品操作。

复跑暴露 E2E 夹具和产品契约冲突：产品 API 已按既有测试 `incremental-build-api.test.js` 明确禁止通用 `POST /incremental-tasks` 创建任务，但旧浏览器规格仍调用它，导致 `ROUTE_NOT_FOUND` 并连带阻断审核/发布场景。添加仅在 `KNOWLEDGE_CENTER_ENABLE_E2E_FIXTURES=1` 时存在的 `/api/test-fixtures/incremental-tasks` 隔离夹具路由，并将旧 E2E 种子切换到该路由；产品创建契约保持不变。后续需对该定向浏览器规格复跑并完成剩余 E2E 失败分类。其他 E2E 失败包含导航语义断言、模板/平台管理交互断言和生产进展列表夹具数量断言，证据详见上述报告 `081/082-e2e-playwright.log`。

2026-11-16：全站分页指定页跳转公共控件与页面接入回归：`node --test tests/unit/agent-runner/page-jump.node.test.cjs`；UI 静态规范继续使用 `npm run check:ui`。页面及筛选状态契约见 `.codex/知识中心建设平台/03-详细设计/知识中心-前端-分页指定页跳转-详细设计文档.md`。

2026-11-16：任务详情头部重叠、缺来源版本工单、工作台跳页和关联版本筛选的验证：`npx jest --config tests/unit/agent-runner/jest.config.js --runInBand tests/unit/agent-runner/document-task-version-mapping-http.test.js tests/unit/agent-runner/workbench-query.test.js` 为 10/10；`node --test tests/e2e/agent-runner/knowledge-center-my-work.node.test.cjs` 最终 20/20；`npm run check:ui` 通过。完整浏览器回归同步适配了工作树中新加入的公共跳页组件，并将资料清洗分页断言限定为页数与总数；工作台跳页、版本筛选、刷新回读和任务详情头部几何均通过。真实 13510 工作台 API 未认证返回 401，且当前静态 JS 与源码哈希不同；本轮没有使用真实用户数据写入，也未宣称实际平台已更新。

### 2026-11-16T18:46:48+08:00 HTML 测试报告时间展示优化

统一测试入口继续在每次实际运行后生成 `report.html`、JSON、Markdown、任务日志及按场景静态分页。HTML 总览和页脚将运行时间展示为易读的带时区时间，同时保留原始 ISO 值供机器读取。真实 smoke 2/2 任务、24/24 用例通过；入口回归 49/49。报告与 REA Evidence、性能结果及评分见 `runtime/rea/professional-test-report/ACCEPTANCE.md`。内部评分 9.5/10；本次未采集覆盖率，不能代表平台行 100% / 分支 95% 门槛已达成。

2026-11-16：已删除模板目录过滤与运维清理脚本定向验证：`npx jest --config tests/unit/agent-runner/jest.config.js --runInBand tests/unit/agent-runner/template-store-boundaries.test.js tests/unit/agent-runner/template-purge.test.js`；Python 运维入口测试：`python3 -m unittest tests/unit/root/test_template_purge_script.py`。真实库只读预检：`python3 tools/repository/purge_deleted_templates.py --before YYYY-MM-DD`；执行参数与审批边界见模板管理详细设计。

### 2026-11-16T15:28:02+08:00 前端固定场景更新与覆盖采集诊断

当前产品已移除旧增量创建对话框。固定 13 项 HTTP 场景改为生产进展页面，并经隔离 HTTP/Chromium 验证阶段、列表、日历、工作日历、筛选/清空和图表。定向场景发现“清空”按钮无事件处理，已补清除搜索、状态、手册、版本、起止日期并重绘；保持显示模式和阶段筛选。助手抽屉真实生产视图下打开焦点失败，原因是焦点回调早于打开 CSS 的可见帧；将焦点延后至第二动画帧后定向通过。审核工作台旧测试仍查询已删除的创建对话框，已更新为现行生产进展投影契约，定向 Chromium 1/1 通过。

完整固定清单全部场景执行成功：61 源文件、49 导航、22 API 契约、20 PingCode 来源同步、13 生产进展、审核工作台 19/19；诊断覆盖率为行 11553/12357（93.49%）、分支 14039/19110（73.46%）。但采集期间 `app.js` 和平台管理视图发生变化，`completed=true`、`stable=false`、`inputsStable=false`，该轮拒绝采纳，诊断报告 `runtime/coverage-goal/frontend-production-progress-pingcode-verified-20261116/` 不作为正式基线。待输入固定后重新执行完整采集。

15:45 后完整复采因手册历史模式工作区渲染及写作入口旧弹窗夹具失败；运行期间 `app.js`、`handbook-view.js`、`production.css` 也有变化。审核手册渲染定向测试已改为分开验证历史工作区和草稿编辑区并通过；固定写作入口夹具改用当前历史修订选择与“返回编辑”公开 DOM 事件。上述完整运行未完成稳定门禁，不采纳其覆盖数。

### 2026-11-16T14:24:44+08:00 专业 HTML 测试报告 REA 复验

参考 Allure、Playwright HTML Reporter、ReportPortal 和 pytest-html 的运行总览、状态筛选、用例定位、质量概览、离线明细与日志能力。真实 smoke 命令 `python3 tests/run_tests.py smoke --report-page-size 2` 执行 2/2 任务、24/24 用例通过，生成 `runtime/test-results/smoke/20261116-142230-262840-smoke/report.html` 和 12 个场景分页；入口回归 48/48 通过。REA Evidence `ev_d1c2c0dcfeef5962d60a4e2f999e6bc467a69cf869946279cdff97d5bd2929f0` completed/complete，含 Chromium 截图和无障碍树，仅访问回环地址。离线浏览器验证 1440px/390px 搜索、用例深链、无 JS 场景浏览通过，无页面错误或横向溢出。内部评分 9.5/10，性能维度继续扣 0.5 分；不是第三方认证。smoke 未启用覆盖率，平台行 100%/分支 95% 目标仍需单独验收。

PingCode 来源确认后任务管理列表的真实 Storage 回读使用专用入口：

```bash
python3 tests/run_tests.py pingcode-storage --fail-fast --jobs 1
```

该入口复用统一 E2E 生命周期：从 `runtime/test-config/yashandb/service.env` 读取仅含 `test_hy` 的隔离数据库配置，持有独占锁，同步 Schema 和数据，应用已提交结构迁移，再启动本次专属 Storage。若源快照包含完整且行数对账一致的任务关系投影，则复用该投影，随后由 Storage 真实 HTTP API 检查 ACTIVE 门禁；若关系表为空，则在测试目标类别、唯一运行 ID 和 Schema 校验下执行旧聚合备份、迁移、逐条核对及激活。之后执行 `pingcode-task-storage-real.node.cjs` 并清理实例。测试 URL 与 `KC_TEST_ISOLATED_SCHEMA=1` 由 runner 注入；不要手动指定服务地址，也不要直接对 13510、`pf_knowledge` 或 `regress` 执行该写入测试。缺配置、数据库同步/迁移失败或服务启动失败时，入口报告前置失败，不会把场景显示为跳过。配置准备见 [YashanDB 测试配置](config/yashandb/README.md)。

2026-11-16 首次真实运行中，test_hy Schema 复制与结构迁移通过，但用例在 `GET /v1/document-tasks/config` 被 `409 DOCUMENT_TASK_MIGRATION_REQUIRED` 阻断，2 项均失败。统一入口现增加测试目标类别、运行 ID 和目标 Schema 校验，并在独占锁内执行旧任务备份、迁移、逐条对账与激活；任一步失败都停止服务启动。真实 HTTP 回归结果以本次运行报告为准。

### 2026-11-16T14:05:00+08:00 Markdown 渲染器覆盖

生产写作插桩浏览器矩阵覆盖数据库 Markdown 的相对路径、手册/审核资源 URL、代码块语言、缺省值及解析失败回退。定向测试和 61 文件固定全量通过，报告 `runtime/coverage-goal/frontend-markdown-renderer-verified-20261116-1405/` 输入稳定、变更列表为空；行 10482/11685（89.70%）、分支 12248/16489（74.27%）。Markdown 渲染器 27/27 行、40/40 分支；平台整体目标仍未达成。

### 2026-11-16T13:53:21+08:00 平台来源快照覆盖

生产写作浏览器采集新增对 `origin-snapshot.js` 的真实插桩调用，覆盖正常正文、空值、缺省上下文与可选字段回退。独立测试通过；覆盖模式工作台 6/6 通过；一次全量因静态文件请求 `ECONNRESET` 中止后，固定全量重跑成功。报告 `runtime/coverage-goal/frontend-origin-snapshot-recheck-20261116-1350/`：61 个源码文件，行 10475/11685（89.64%）、分支 12223/16489（74.12%），来源快照模块 2/2 行、7/7 分支，`completed/stable/inputsStable=true` 且变更清单为空。全平台覆盖率目标仍未达成。

### 2026-11-16T13:29:47+08:00 审核失败恢复与完整前端复采

审核工作台“我的审核”用例独立复跑通过 1/1。随后使用固定清单重新采集 61 个前端脚本及全部场景，审核套件 19/19；报告 `runtime/coverage-goal/frontend-cleaning-api-error-branches-recheck-20261116-1320/` 的 `completed/stable/inputsStable` 均为 true，源码和输入变更列表为空。行 10460/11685（89.51%），分支 12176/16489（73.84%）；平台覆盖率目标尚未达成。前次失败运行保留作历史，不计覆盖率。

### 2026-11-16T12:44:31+08:00 清洗 API 固定覆盖场景

清洗 API 浏览器覆盖除上传外还需验证工作台、分页列表和批次/数据集详情读取；页码回退、路径编码、自动生成幂等键、分片默认请求头和空批次名均在隔离 HTTP 响应下检查。完整固定覆盖和稳定验收要求见 [TEST_REPORT_DESIGN.md](TEST_REPORT_DESIGN.md)。

读取契约还覆盖索引降级、缺失/非法错误响应、无 `data` 包装体回退及列表/详情默认分页；只有公开可达的 API 路径计入目标。

最新全量诊断中的新增清洗 API 场景均通过；审核工作台 18/19，失败为指派待办行未渲染。运行时 PingCode 产品源码及其测试输入变化，稳定门禁拒收整份覆盖报告；不得将其作为正式覆盖率结果。

### 2026-11-16T12:11:47+08:00 大纲自动保存全量采集夹具

说明字段防抖场景前必须模拟手动保存完成后的详情重载，因为保存会失效当前大纲投影；夹具重置为有效投影后仍须断言只提交最终输入值和当前版本。完整场景及稳定验收要求见 [TEST_REPORT_DESIGN.md](TEST_REPORT_DESIGN.md)。

自动保存成功还会禁用旧 DOM 的保存按钮；夹具 `reset()` 同步模拟重载后新按钮的可用状态，以便继续验证后续失败恢复与重试。

### 2026-11-16T12:08:36+08:00 专业 HTML 报告当前运行复验

当前统一入口在实际测试运行结束后自动生成 `report.html`，同时保留 JSON、Markdown、任务日志和按场景静态分页。业界能力对照采用 Allure 的运行/结果总览、Playwright HTML Reporter 的状态筛选与用例定位、ReportPortal 的质量总览、pytest-html 的离线明细与日志；来源及可访问性限制见 `runtime/rea/professional-test-report/sources.json` 和 `official-repositories.json`。

本轮 `python3 tests/run_tests.py smoke --report-page-size 2` 通过 2/2 任务、24/24 用例；入口回归 `python3 -m unittest tests.unit.root.test_run_tests` 通过 46/46。报告：`runtime/test-results/smoke/20261116-120600-918071-smoke/report.html`。REA 6.7.0 Chromium Evidence `ev_2983427d290062100ad328b119489d8b9d659b47cfbd852cb3dfa727d05e5a9e` 完整无截断，仅观察本机回环报告。桌面/390px 离线导航各 10 次，DCL P95 为 32.2ms/15.0ms；搜索 17 条、用例深链、无 JavaScript 场景分页通过，零脚本错误、外部请求和页面横向溢出。内部七项量表为 9.5/10，评分依据与限制见 `runtime/rea/professional-test-report/ACCEPTANCE.md`；本轮未采集覆盖率，不代表平台覆盖率门槛通过。

### 2026-11-16T11:30:28+08:00 清洗质量结果分支

知识库质量结果分别验证通过、未通过和未提供状态。

大纲治理浏览器场景验证列表搜索/空状态/阶段 URL 同步，以及说明编辑防抖仅提交最终输入值。

### 2026-11-16T10:37:42+08:00 清洗视图兼容与错误态覆盖

固定前端采集在真实隔离清洗 API 场景中验证 `renderCleaning` 的加载、错误、批次/知识库详情、分页、字段别名、缺省值、链接安全、图谱和权限投影，扩大清洗视图分支覆盖而不改覆盖分母。

未知中文状态保留原文；未知非中文状态显示“状态待确认”，回退夹具使用未知英文状态。

清洗视图继续覆盖来源字符串、文件名称回退、空详情和分页首末页按钮禁用状态。

分页首页与末页分别验证上一页/下一页禁用，并断言首页当前页数。

文档范围点击区测量需等待 `.task-scope-dialog[open]` 可见及两帧绘制，再检查 44px 目标。

有文件行但没有名称时显示“未命名”；仅空文件数组显示“暂无文件”。

### 2026-11-16T10:20:26+08:00 来源 Markdown 安全渲染覆盖

任务管理插桩浏览器场景直接覆盖共享来源 Markdown 渲染的默认文本、HTML 转义、安全链接、危险协议拒绝和图片说明转义。输出断言是安全契约，完整固定前端采集纳入该模块计数。

GitLab 连接取消确认只要求没有写请求；后台读取可能并发完成，因此夹具比较非 GET 数量，并在结束时校验各类真实写入的精确计数。

人员导入场景底层可能触发模板映射只读预取；它由本地 HTTP 隔离，允许零次或一次，其余固定读取和导入写入仍精确断言。

### 2026-11-16T09:39:55+08:00 任务详情插桩性能等待

任务详情 30 次性能循环需等待真实请求完成、读取状态清除和打开的详情 DOM 就绪后关闭，再等待关闭完成后继续；网络资源记录出现不能单独作为交互完成信号。性能测量和门槛保持不变，需以插桩真实 HTTP 测试验收。

### 2026-11-16T09:54:18+08:00 审核生产加载态

生产总览加载态只展示大纲读取状态，创建表单在数据加载完成后挂载；测试按当前 DOM 契约断言加载态没有创建表单，并继续覆盖不可用、错误、任务列表和增量工作区状态。

创建对话框夹具通过 `?view=progress` 进入真实包含表单的生产进展视图，继续断言手册选项及基线按钮。

增量输入 `sourceType: manual` 当前真实文案为“人工提供”，来源回退断言按该文案验证。

章节回退夹具按真实 `availableChapters[*].sections` 结构提供 `chapter-a`，保持已选章节计数断言。

空 `generationRun` 按当前渲染契约显示“生成状态待确认”，回退断言使用该真实文案。

发布阶段已有版本时显示“平台版本已发布”，发布权限和版本投影继续验证。

### 2026-11-16T09:26:00+08:00 写作历史入口定位器同步

写作浏览器场景按可访问名称“查看候选与执行过程”定位图标按钮，覆盖双滚动、编辑器复用和知识库移除后的历史恢复；旧 `.handbook-writing-chat-open` 类已不属于产品契约。保持真实 HTTP 请求及原有候选、正文和恢复断言，先定向验证三项场景，再执行完整固定前端覆盖率采集。

### 2026-11-13T21:40:54+08:00 前端模板覆盖夹具导航

模板管理的 `data-template-tab` 仅有 `library`、`mappings`；模板编辑器由选择目录项进入，使用“返回模板库”离开。固定 Istanbul 采集器须遵循真实视图转换，分别在目录视图测页签键盘行为、在编辑器视图测编辑/历史/上传流程，不以不存在的 `editor` 页签跳转。详细场景、伪代码与稳定验收门槛见 [TEST_REPORT_DESIGN.md](TEST_REPORT_DESIGN.md)。

模板库每行有名称入口和“打开”操作两个模板 ID 按钮；固定覆盖夹具通过 `.template-catalog-open[data-template-id]` 明确选择名称入口，避免严格模式下的歧义。

模板搜索结果数量按 `.template-catalog-open[data-template-id]` 统计，一行只计一个模板；勿按操作按钮总数推断模板条数。

元数据取消场景需点 `#template-meta-panel footer [data-template-meta-cancel]`；标题栏另有同属性的关闭按钮，需区分两个行为入口。

模板目录视图没有可调宽度分隔条；不得保留针对 `data-template-list-resizer` 或旧宽度存储键的覆盖断言。键盘场景覆盖当前真实页签及对话框交互。

### 2026-11-13T21:32:54+08:00 模板映射覆盖导航返回目录

完整前端采集已通过历史查看和启停，映射步骤直接访问编辑工作区不存在的“适用文档”页签。产品编辑器需先返回模板库，映射页签才可见。设计已记录真实导航路径；修正后继续固定全量采集。

### 2026-11-13T21:29:57+08:00 模板历史采集步骤同步自动关闭

模板历史产品修复后的定向回归通过；完整采集器随后因仍点击已自动关闭的 `[data-template-history-close]` 报错。设计已记录更新采集器步骤，保留历史版本读取/返回、状态更新和映射检查，再重新完整采集。

### 2026-11-13T21:24:24+08:00 修复模板历史查看的模态层遮挡

前端完整采集已通过审核及增量创建场景，在模板历史回读时确认选择历史版本后历史 dialog 仍保留模态层，挡住编辑器里的“返回当前内容”，导致场景失败。这是实际交互缺陷；设计记录要求成功加载历史版本后关闭历史 dialog，失败时保留上下文。修复后保留原历史回读/返回当前完整场景并继续固定全量采集。

### 2026-11-13T21:20:35+08:00 前端审核夹具剔除不存在的原型控件

完整前端采集在 `exerciseReviewLocalControls` 失败，因为它测试的 `data-incremental-prototype-*` 是夹具虚构控件，当前产品没有对应处理器；现有 E2E 规格反而确认这些原型入口不存在。已记录移除范围，仅清除这组不可执行的旧断言，同时保留审核控件、行锚点和真实生产页签验证；产品覆盖文件分母和固定场景不变。须继续完整稳定复采验收。

### 2026-11-13T21:16:17+08:00 增量任务创建夹具选择真实生产视图

模板导航和写作采用夹具修复后，完整前端采集在增量创建 HTTP 场景失败。产品只在生产进展（`progress`）或任务工作区展示创建按钮；通用导航最后停在“我的生成”，点击一级生产入口不会自动切页。设计已记录应先点击真实 `data-production-overview-tab="progress"`，再执行原完整创建场景。修改后继续固定全量采集，失败运行不计覆盖率。

### 2026-11-13T21:12:48+08:00 写作候选采用夹具按钮选择器更新

模板导航修正后，固定前端全量推进至写作候选采用时失败：夹具等待已移除的 `.handbook-writing-chat-open`。当前生产聊天按钮通过 `aria-label="查看候选与执行过程"` 提供入口。设计文档已记录当前契约与保持候选、503 恢复、成功采用请求断言的方案；更新夹具后需重新跑固定全量，当前失败运行不计覆盖。

### 2026-11-13T21:09:49+08:00 前端模板完整采集导航根因

固定前端全量 `runtime/coverage-goal/frontend-goal-current-20261113-2057/` 为 `completed=false`、`stable=false`、`inputsStable=false`，其中 `styles.css` 在运行中变化，结果无效。核对模板管理实际 DOM 后发现页签只有模板库 `library` 与适用文档 `mappings`；编辑器通过选中模板或新建进入。覆盖采集器却将 `editor` 当作页签，通用导航和专用模板流程均违反当前契约。已在设计文档记录修复伪代码和稳定性验收门槛；更新采集器后须完整固定清单复采，只有稳定全量结果才计数。

### 2026-11-13T21:06:09+08:00 专业 HTML 测试报告 REA 当前工作树验收

行业能力参考 Allure（运行概览、结果分布、失败证据）、Playwright HTML Reporter（用例状态筛选和定位）、ReportPortal（质量总览）、pytest-html（离线逐项明细与日志）。当前报告提供中文总览、结果分布、失败与阻塞、按场景分页、跨场景搜索/状态筛选、用例深链、原始 JSON、任务日志和可选覆盖率门禁。未采集趋势、重试、附件或覆盖率时均明确显示未提供，不猜测补齐。

`python3 tests/run_tests.py smoke --report-page-size 2` 通过 2/2 个任务、24/24 用例（Jest 22/22、Python unittest 2/2），HTML 报告为 `runtime/test-results/smoke/20261113-210256-829462-smoke/report.html`。统一入口回归 `python3 -m unittest tests.unit.root.test_run_tests` 为 46/46。REA Chromium Evidence `ev_53ff66f69051531e0298239c75d365bd44e0bf9a8fd91887058af88cb75e8ab1` 完整无截断；390px 浏览器搜索匹配 17 条、深链、场景分页、无 JavaScript 浏览通过，无页面横向溢出和脚本错误。七项内部质量量表 9.5/10，性能项保留 0.5 分扣减；这不是第三方认证，也不代表平台覆盖率目标已达成。Evidence、截图、验证输入及评分限制见 `runtime/rea/professional-test-report/`。

### 2026-11-13T20:57:11+08:00 PingCode 多来源主来源决策覆盖

固定夹具 `StoragePingcodeTaskHttpCheck primary-decision` 通过公开 `/confirm` HTTP 接口验证多个有效任务来源没有主来源时返回 409 `PRIMARY_SOURCE_DECISION_REQUIRED`，并断言无提交、无任务写入、运行仍待确认。完整 Java JaCoCo `runtime/coverage-goal/java-pingcode-primary-decision-20261113/` 退出 0，15 个源码文件稳定；行 5006/5072（98.70%）、分支 3176/3846（82.58%）。对比上一稳定报告增加 1 行、2 分支；Java 尚差 66 行及 478 个门槛分支，Node、前端与平台目标未达成。

### 2026-11-13T20:45:31+08:00 PingCode 来源输入拒绝边界覆盖

`StoragePingcodeTaskHttpCheck crud` 经公开 HTTP 接口覆盖来源新增和更新的名称、类型、产品类型、URL、连接 ID、操作者非法输入；每次拒绝均断言 422 `PINGCODE_SOURCE_INVALID`，来源写入数与修订号保持不变，随后合法 CRUD 仍成功。完整固定 JaCoCo `runtime/coverage-goal/java-pingcode-source-input-boundaries-20261113/` 退出 0，15 个产品源码文件稳定（`stable=true`、`changedFiles=[]`），行 5005/5072（98.68%）、分支 3174/3846（82.52%）。相较同源稳定报告行增加 1、分支增加 17；Java 尚缺 67 行，达到 95% 分支仍差 480 项。Node、前端及平台目标未达成。

### 2026-11-13T20:30:38+08:00 PingCode 读取路由稳定全量验收

`StoragePingcodeTaskHttpCheck` 经公开 Storage HTTP 接口覆盖来源任务分页、来源快照、运行项分页、运行快照和未关联 IR 空结果，验证读取不增加任务或来源写入。完整 JaCoCo `runtime/coverage-goal/java-current-read-routes-20261113-2025/` 退出 0，15 个源码文件输入稳定；行 5004/5072（98.66%）、分支 3157/3846（82.09%）。仍缺 68 行，分支达到 95% 还差 497 项；平台 Node、前端、Java 的行 100% / 分支 95% 目标尚未达成。

### 2026-11-13T20:24:30+08:00 Java PingCode 来源投影与当前 REA 报告证据

`StoragePingcodeTaskHttpCheck` 的隔离 JDBC 状态机现覆盖来源列表中产品类型/已确认任务数投影，并在运行记录中回读新增、更新和未变化计数，使 `/preview?view=updated` 的总数与逐条记录一致。固定 Java JaCoCo 全量 `runtime/coverage-goal/java-current-recheck-20261113-2015/` 退出 0，输入稳定，15 个产品文件行 4941/5072（97.42%）、分支 3136/3846（81.54%）。Java 与平台行 100%、分支 95% 目标仍未达成。

最新真实 smoke `python3 tests/run_tests.py smoke --report-page-size 2` 为 2/2 任务、24/24 用例通过，HTML 为 `runtime/test-results/smoke/20261113-202358-453799-smoke/report.html`。REA Evidence `runtime/rea/professional-test-report/current-smoke-rea-evidence-20261113-2024.json` ID `ev_70288384497e3534824430941b81387cddfc3a3ed105cbc5d93cdc53d39cb31e` completed/complete，无截断；仅观察本机报告并捕获 Chromium 截图和无障碍树。本次 smoke 未启用覆盖率。报告交互及内部 9.5/10 评分依据和限制见 `runtime/rea/professional-test-report/ACCEPTANCE.md`。

### 2026-11-13T20:05:43+08:00 生产总览导航契约修正

生产总览通用采集现在按真实页面遍历手册、生产进展、我的生成三个标签；`tasks` 是 taskId 详情路由，不是标签。此前复采期间 `app.js` 输入变化，稳定性报告为 false，不能报告覆盖结果。

### 2026-11-13T20:03:20+08:00 权限保存状态验收顺序

权限角色场景的“权限已保存”按产品行为持续展示，切换用户后清除。固定覆盖夹具现将状态清除断言放到账号切换后，保留保存成功及只读/过期/筛选边界检查。尚无本轮完整稳定覆盖率结果。

### 2026-11-13T19:56:04+08:00 PingCode 来源同步场景更新

固定前端采集中的 PingCode 场景已从旧版详情/连接测试流程调整为当前来源工作区同步流程，继续使用本机隔离 HTTP 覆盖来源创建、失败恢复、冲突预览、确认和缺图重试。所有先前失败复采均未生成有效完整覆盖率报告；继续修复并重跑固定全量清单。

### 2026-11-13T19:51:00+08:00 任务管理导航权限条件修正

固定覆盖导航中的通用任务管理页面以普通账号运行，`任务配置` 按产品权限仅管理员可见。通用采集导航现验证任务列表、次要事项和流程流转；管理员配置由独立真实 HTTP 浏览器套件覆盖。完整前端复采继续进行，未完成证据不计覆盖率。

### 2026-11-13T19:48:00+08:00 在线审核覆盖夹具同步

固定前端复采中的在线审核场景已按当前 DOM/交互契约调整：审核人用 select；前置条件不满足时提交按钮应禁用且不发请求；有效提交的网络失败和空响应仍验证错误聚焦、按钮恢复及请求载荷。此前失败运行均未生成可用覆盖率结果，正在继续完整复采。

### 2026-11-13T19:46:00+08:00 前端范围表单覆盖夹具

固定前端完整采集进一步发现增量任务范围夹具用 textarea 模拟文档 ID，但产品表单处理器读取的是已选文档复选框。夹具现按真实 DOM 契约构造三个已选文档，并保持章节、语言、失败重试、幂等键和载荷断言。完整采集尚未完成，不报告覆盖增量。

### 2026-11-13T19:45:29+08:00 覆盖率全量复采前置修复

当前前端固定采集发现两处过期测试契约：生产总览旧标签 `versions` 已由 `handbooks/progress` 替代；写作采纳失败状态文案已从“采用未完成”更新为“保存未完成”。采集器导航已跟随当前 DOM 标签，真实 HTTP 写作场景断言更新为当前文案，同时保留失败后候选、重试和成功请求校验。完整固定前端复采仍在进行，未完成报告不计覆盖率；最终需以完整稳定采集为准。

### 2026-11-13 知识中心前端体验审查证据

前端体验评分与问题清单见 `.codex/知识中心建设平台/09-审查与复盘/知识中心-前端体验问题清单与评分基准.md`。固定 E2E 报告 `runtime/test-results/e2e/20261113-164418-092649-e2e/details/report.json`：350 个浏览器测试实例中 300 通过、44 失败、6 跳过；Chromium/Firefox 对同一场景的失败分别计数，不能据此认定有 44 个独立产品问题。隔离浏览器证据不替代四角色真实登录验收；13510 未认证请求为 401，相关体验结论保持待验证。

2026-11-13：`knowledge-center-my-work.node.test.cjs` 覆盖工作台状态/窄屏、任务管理窄屏关键字段、资料清洗批次与数据集分页、未知状态/时间提示和显式失败重试；`test_dataset_pagination.py` 覆盖 `/api/datasets` 分页及旧全量响应兼容。

2026-11-13：`tests/unit/agent-runner/document-tasks-frontend.test.cjs` 校验任务管理工作区桌面和 390px 窄屏主操作、返回、范围弹窗操作及快捷改派的实际点击高度至少 44px。

2026-11-13：PingCode 来源插件浏览器测试覆盖来源新增、配置、方案 C 状态开关（ARIA 状态、Space 键、revision、失败恢复）、“更多”菜单受保护删除、独立“已同步内容”列、同步差异分类及汇总、完整 Markdown 章节阅读、无运行状态列、确认/缺图重试、5 秒短提示、迟到响应隔离、微软雅黑计算字体和 390px 窄屏布局；详情弹窗已移除。`StoragePingcodeTaskHttpCheck crud` 通过隔离 JDBC 对 Storage HTTP handler 验证来源写入、产品类型更新、冲突、revision、状态门禁、删除保护以及 `created/updated/removed` 差异分类分页。Node `previewRun` 必须接受与 Storage 相同的 `current/created/updated/removed/conflicts` 枚举；未知值返回 `PINGCODE_PREVIEW_VIEW_INVALID`。真实 13510 页面可读，但未认证会话访问受保护的来源 API 会返回 `AUTH_REQUIRED`；企业同步和人工确认需使用有权限的管理员会话验收。大纲分工布局测试使用 13510 的真实数据/API 和工作树 `outlines.css`，核验桌面及 390px 的目录、过滤器和分派操作高度至少 44px。

### 2026-11-13T09:27:56+08:00 专业 HTML 报告最终 smoke 验收

最新真实 `smoke --report-page-size 2` 为 2/2 任务、24/24 用例通过，报告 `runtime/test-results/smoke/20261113-091914-942932-smoke/report.html`；入口回归 `python3 -m unittest tests.unit.root.test_run_tests` 为 46/46。REA Chromium Evidence `ev_97afb20ecbbe1bb4e72ea65322a90108c7beb40262a7ebfb3b9a1f9757fb707f` 完整。桌面/390px 离线导航各 10 次，DCL P95 17.1ms/15.5ms；跨场景搜索、深链、无 JS 分页及窄屏表格方向键/Home/End 滚动通过，零外部请求、脚本错误和页面横向溢出。内部报告评分 9.5/10，性能限制和评分边界见 `runtime/rea/professional-test-report/ACCEPTANCE.md`；本次未采集覆盖率，不代表平台覆盖率门槛通过。

### 2026-11-13T09:15:49+08:00 专业 HTML 报告 REA 验收与键盘可用性

真实 smoke `python3 tests/run_tests.py smoke --report-page-size 2` 为 2/2 任务、24/24 用例通过（Jest 22/22，Python unittest 2/2），报告 `runtime/test-results/smoke/20261113-091433-539144-smoke/report.html`。新增表格区域方向键 48px 横向滚动和 Home/End 两端定位。定向入口回归 `python3 -m unittest tests.unit.root.test_run_tests` 为 46/46。

REA Chromium Evidence `ev_b6fac42ae0b9cd74a95f1300862a05ef364c1abb4ed65efa7e34d78348638356` 完整，原始记录 `runtime/rea/professional-test-report/current-smoke-rea-evidence-20261113-091433.json`。离线 Chromium 1440px/390px 各 10 次导航，DCL P95 为 19.8ms/16.4ms，搜索命中 17 条、用例深链和无 JS 静态分页通过；390px 键盘左右滚动、Home/End 及场景明细表横向滚动通过。零脚本错误、外部请求和页面横向溢出。内部评分 9.5/10，评分量表和 Allure、Playwright HTML Reporter、ReportPortal、pytest-html 能力映射见 `runtime/rea/professional-test-report/ACCEPTANCE.md`；不是第三方认证，也不代表平台覆盖率门槛已达成。

### 2026-11-13T07:51:09+08:00 专业 HTML 报告最新 REA 验收

真实 smoke 为 2/2 任务、24/24 用例通过，最新总览 `runtime/test-results/smoke/20261113-074912-988667-smoke/report.html`。仓库固定 REA CLI 的受控 Chromium Evidence 为 `ev_210f466d5d347d920337a8e1b4512123ddd9c1c67802c3bbaa1b4beebb1778c4`，状态 completed、完整性 complete；只访问本机报告。报告内部评分 9.5/10，性能项保留半分扣减；评分不是第三方认证，也不代表平台覆盖率目标达成。评分明细、Allure/Playwright/ReportPortal/pytest-html 能力映射及大样本交互验收见 `runtime/rea/professional-test-report/ACCEPTANCE.md`。

### 2026-11-13 Node 文档任务关系存储适配器 HTTP 覆盖

`document-task-relational-read-http.test.js` 以真实本机 HTTP 请求穿过文档任务公开路由和 `createDocumentTaskRelationalStore`，由隔离 storage 响应器验证查询编码、默认/可选参数、配置及任务写入幂等头、来源/变更路径、NOT_FOUND 转空值和其他错误传播。定向 Jest 3/3 通过，模块定向覆盖为 23/23 行、17/17 分支，报告 `runtime/coverage-goal/document-task-relational-adapter-directed/`。该局部结果尚未计入稳定全量 Node 基线；固定清单与平台整体行 100%、分支 95% 目标仍需完整稳定复采确认。

### 2026-11-13 全量 HTML 报告验收

完整入口 `python3 tests/run_tests.py full --coverage --jobs 1 --report-page-size 50` 已生成 `runtime/test-reports/2026-11-13/20261113-064013-281056-full/report.html`。80 个任务中 77 个成功，HTML 总览记录 4057 条用例（3977 通过、40 失败、40 跳过）及逐场景分页、失败日志和覆盖率明细。三端输入稳定，但覆盖率为 Node 17144/17439 行、17801/20300 分支，前端 9930/10957 行、11469/15320 分支，Java 4814/4867 行、3001/3609 分支；平台行 100%、分支 95% 门槛仍未达成。E2E 和性能失败均保留在报告中。

### 2026-11-13 前端公共 UI 系统契约覆盖

固定 Chromium 会话新增 `common/ui-system.js` 公共契约场景，覆盖完整图标映射、action 图标按钮启用/禁用、普通按钮显式禁用、按钮变体、输入转义及非法输入拒绝。完整稳定报告 `runtime/coverage-goal/frontend-ui-button-disabled-20261113-final/` 显示 59 个产品脚本、1286 个跟踪输入稳定（`completed/stable/inputsStable=true`，变更清单为空）；行 9930/10957（90.62%）、分支 11465/15320（74.83%）。相较前一稳定报告增加 2 行、2 个分支。前端尚缺 1027 行，达到 95% 分支至少还需覆盖 3099 项；Node、Java 与平台总目标仍未达成。

### 2026-11-13 PingCode 图片资源元素类型拒绝

真实隔离 JDBC HTTP 边界场景为合法分页注入非对象图片资源元素，验证返回 422 `PINGCODE_RESOURCE_INVALID`、无分页/工单/资源持久化影响，随后继续合法分页成功。完整固定 Java JaCoCo `runtime/coverage-goal/java-resource-element-invalid-20261113b/` 退出 0，15 个源码文件输入稳定；行 4812/4867（98.87%）、分支 2982/3609（82.62%），较前一同分母报告增加 1 个分支，命中 `PingcodeTaskRepository.java:853`。Java、Node、前端覆盖率尚未达到行 100% / 分支 95% 平台目标。

### 2026-11-13T02:36:21+08:00 Java 文档写入回放损坏结果补测

隔离 JDBC 的真实 `/v1/document-tasks` HTTP 夹具先完成配置和任务写入及幂等回放，再分别注入数组格式的损坏配置回放结果和非法 JSON 任务写入结果。配置重复 PUT 返回 422 `DOCUMENT_TASK_CONFIG_INVALID`，写入结果 GET 返回 422 `DOCUMENT_TASK_RESULT_INVALID`；两者均断言版本与提交次数不变，并在请求后恢复合成状态。完整 15 个 Java 产品源码 JaCoCo 采集 `runtime/coverage-goal/java-write-replay-invalid-20261113/` 输入稳定（`changedFiles=[]`），行 4812/4867（98.87%）、分支 2981/3609（82.60%），较同分母 `java-document-nonsr-20261113` 增加 2 行、2 分支。Java 尚缺 55 行，达到 95% 分支尚差 448 项；Node、前端和平台总门槛仍未完成。

### 2026-11-13 HTML 报告首屏脚本加载

交互脚本现在在静态报告 `window.load` 后加载，页面首屏不等待搜索/筛选代码或启动器资源；搜索仍按需读取全局用例索引。回归覆盖延迟加载、不预加载及恶意用例文本转义，并以 3,469 条用例报告复核首屏性能、离线交互与无 JavaScript 场景。

### 2026-11-13T01:54:39+08:00 Java 迁移索引、PingCode 边界与非 SR 读取补测

公开 `Main.main("migrate")` 的隔离 JDBC 命令覆盖等价索引跳过与非等价索引拒绝；真实 PingCode HTTP 覆盖非法工单/READY 资源暂存和 FAILED→FAILED→READY 资源恢复；真实文档任务 GET 验证非 SR 任务 `ir=[]` 且不查 SR 关系。固定 15 文件 JaCoCo `runtime/coverage-goal/java-document-nonsr-20261113/` 退出 0、输入稳定，行 4810/4867（98.83%）、分支 2979/3609（82.54%）。较本轮开始同分母净增 20 行、24 分支；Java 仍缺 57 行，95% 分支至少差 450 项。平台 Node、前端、Java 的 100%/95% 总目标仍未达成。

### 2026-11-13T01:37:49+08:00 Java 文档任务筛选与分页补测

真实 `/v1/document-tasks` HTTP 夹具新增负责人、产品、版本、来源类型、状态、关键词组合筛选，验证 SQL 条件与参数绑定；`/mine` 合法数值页码及列表越界页码也经真实请求验证。固定 15 文件 JaCoCo `runtime/coverage-goal/java-document-pages-20261113/` 退出 0、输入稳定，行 4790/4867（98.42%）、分支 2955/3609（81.88%）。相对上一轮稳定报告净增 10 行、14 分支；Java 仍缺 77 行，95% 分支目标至少差 474 项。平台 Node、前端、Java 的 100%/95% 总目标尚未完成。

### 2026-11-13T01:29:43+08:00 Java 文档任务索引与异常读取补测

隔离 JDBC 的真实 `/v1/document-tasks` HTTP 夹具新增嵌套手册、文档负责人、审核任务索引写入及三种非法索引拒绝；还验证配置缺行、损坏配置与损坏任务正文的错误响应和恢复。固定 15 文件 JaCoCo 报告 `runtime/coverage-goal/java-document-read-invalid-20261113/` 退出 0、输入稳定，行 4780/4867（98.21%）、分支 2941/3609（81.49%）。相对 `java-task-aggregate-protection-20261113` 同分母净增 6 行、12 分支；Java 尚缺 87 行，达到 95% 分支至少差 488 项。平台三端目标仍未达成。

### 2026-11-12T23:32:52+08:00 PingCode 来源失败恢复覆盖

固定前端浏览器场景新增来源列表读取 503 后重试、登记 503 后保留表单并重试、连接检查 503 后恢复。定向真实浏览器 8 阶段通过；完整稳定报告 `runtime/coverage-goal/frontend-pingcode-errors-20261112-2340/` 退出 0，59 产品脚本、1286 输入稳定。前端总量为 9908/10957 行（90.42%）、11444/15320 分支（74.69%）；插件模块为 149/184 行、218/314 分支。前端距离行 100% 仍缺 1049 行，达到分支 95% 至少需再覆盖 3110 项；平台总目标仍未完成。

### 2026-11-12T23:20:53+08:00 全局通知前端覆盖续作

固定浏览器采集新增站内通知的真实点击与隔离 HTTP 场景：未读展示、标记已读、空列表、服务失败和重试。完整稳定报告 `runtime/coverage-goal/frontend-notifications-current-20261112-2325/` 退出 0，59 产品脚本、前后输入哈希一致；`app.js` 行 3844/4618、分支 2934/4474。前端总量为行 9902/10957（90.37%）、分支 11436/15320（74.64%）；仍缺 1055 行，达到 95% 分支至少还差 3118 项。平台三端总目标尚未达成。

### 2026-11-12T23:03:00+08:00 PingCode 插件纳入前端完整采集

固定前端 Istanbul 采集新增插件页本机隔离 HTTP 场景，真实浏览器完成来源登记、连接检查、预览、主来源选择、确认和缺图重试，并验证幂等键及确认载荷。`runtime/coverage-goal/frontend-pingcode-current-20261112-2300/` 完整采集退出 0；59 个产品脚本、1286 个输入稳定，`completed/stable/inputsStable=true`。`pingcode-sync.js` 从 0 增至 143/184 行、211/314 分支；前端全量为 9867/10957 行（90.05%）、11394/15320 分支（74.37%）。仍缺 1090 行，达到 95% 分支至少需再覆盖 3160 项；Node、Java 和前端均未达到平台最终门槛。

### 2026-11-12T22:48:21+08:00 当前前端完整稳定覆盖率基线

`runtime/coverage-goal/frontend-current-verified-20261112-2248/` 的完整 Istanbul 采集退出 0；59 个产品脚本、1285 个采集输入在前后哈希一致，`completed/stable/inputsStable=true`，变更清单为空。覆盖率为行 9723/10957（88.73%）、分支 11178/15320（72.96%）；离 100% 行还差 1234 行，达到 95% 分支至少差 3376 项。主要缺口是 `app.js` 808 行、`pingcode-sync.js` 184 行（0 覆盖）、文档任务视图 63 行、写作页 57 行。完整采集前修复 GitLab 测试抽屉关闭步骤和审核工作台旧文案/键盘步骤；审核 19/19 通过。Node 和 Java 需按各自当前完整产品分母独立达标，平台目标尚未完成。

### 专业 HTML 测试报告与业界参考

实际运行 `python3 tests/run_tests.py smoke`（或 `unit`、`e2e`、`full` 等）后，终端输出本次 `report.html` 路径。总览显示任务与用例数量、成功/失败/跳过、失败诊断、场景、覆盖率门禁、耗时最长任务与用例；场景明细静态分页，全局检索每页 50 条并可直达用例及日志。报告可离线打开；未启用 JavaScript 时仍能浏览场景分页。交互脚本异步加载，不阻塞静态总览首屏；`--report-page-size` 调整场景静态页大小，不改变检索的 50 条分页。

参考 [Allure Report](https://allurereport.org/docs/features/) 的运行概览与失败证据、[Playwright HTML Reporter](https://playwright.dev/docs/test-reporters#html-reporter) 的筛选与定位、[ReportPortal](https://reportportal.io/docs/dashboards-and-widgets/) 的质量总览、[pytest-html](https://pytest-html.readthedocs.io/en/latest/user_guide.html) 的可分享离线报告。仓库内 REA Skill 为 `.codex/plugins/rea/skills/reverse-engineer-anything/SKILL.md`；上一轮的 Allure 浏览器 Evidence、官方来源抓取记录及受限页面说明在 `runtime/rea/professional-test-report/`。本次没有重新连接 REA 服务，未将未抓取到的官网内容当成已验证事实。

报告内部量表为 9.5/10（非第三方认证）：数据可信 2、失败定位 2、检索导航 2、视觉层级 1.5、无障碍与移动端 1、离线与性能 0.5、可追溯 0.5。`runtime/test-results/report-pagination-review-20261112/` 中 125 条离线样本验证了检索跨 3 页、失败筛选、桌面/390px 无溢出及首屏采样低于 100ms；大型报告性能仍需单独验收。此评分不表示平台行覆盖率 100% / 分支覆盖率 95% 已达标。

2026-11-13 当前代码复验：统一入口单测 45/45；真实 smoke 2 个任务、24/24 用例通过，最新报告为 `runtime/test-results/smoke/20261113-042706-758997-smoke/report.html`。重建 3,469 条历史结果后，离线桌面/390px 搜索可访问全部 335 条匹配（7 页，末页 35 条），末条可深链；无脚本错误、外部请求或横向溢出。大样本导航 DCL/load P95 为 19.1/23.3ms、70.3/70.9ms；内部报告功能评分 9.5/10，其中性能项 0.5/1。完整记录见 `runtime/rea/professional-test-report/ACCEPTANCE.md` 与 `tests/TEST_REPORT_DESIGN.md`。

### 2026-11-12T21:59:08+08:00 Java 当前完整产品分母复采

当前 Java 产品源码为 15 文件。首次 JaCoCo 完整采集在 `StorageDomainReadHttpCheck` 删除候选大纲时连接提前关闭；定向复现表明夹具仍匹配旧三列审计记录查询，而当前产品查询新增 `PAYLOAD` 列。修正夹具查询匹配并在反射异常时输出根因后，定向真实 HTTP 场景通过。把已有五个任务/PingCode 领域夹具及新的隔离 JDBC 真实文档任务、PingCode 来源/运行/分页/预览 HTTP 夹具纳入固定采集后，完整报告 `runtime/coverage-goal/java-pingcode-confirm-boundary-20261113/` 退出 0，`source-stability.json` 为 stable=true、changedFiles=[]；行 4248/4867（87.28%）、分支 2585/3609（71.63%），较最初同分母报告净增 733 行、486 分支。剩余主要缺口为 PingCode 成功确认与资源流程及逐任务迁移；旧 9 文件报告不得作为当前平台验收。`test_hy` 是同步副本，未运行只允许个人库的逐任务数据迁移命令。

### 2026-11-12T21:50:32+08:00 DSH 遗留运行与代理拒绝覆盖续验

现有真实 HTTP/SDK E2E 增加遗留 `running` 记录经管理员运行详情 API 读取后持久化为 `interrupted`，以及运行中 Unix socket 模型代理拒绝 GET 为 403 且不转发上游。原生 E2E 1/1、定向 Jest DSH 1/1 通过；固定 202 文件串行完整报告 `runtime/coverage-goal/node-dsh-recovery-proxy-serial-20261112/` 为 201 套通过/1 跳过、2976 项通过/8 跳过，910 个输入稳定。Node 行 17125/17439（98.19%）、分支 17787/20300（87.62%）；DSH 模块 166/168 行、85/112 分支。平台三端目标仍未达成。

### 2026-11-12T21:25:02+08:00 DSH 试运行模型配置拒绝场景

`dsh-sdk-runtime.test.cjs` 通过现有隔离真实 HTTP 入口验证缺少模型密钥和带查询参数的模型地址均返回 422 `DSH_MODEL_UNAVAILABLE`，拒绝后恢复合法模型继续原有完成、SSE 和取消流程。该套件仍由 `native-contract-coverage.test.js` 接入 Jest 覆盖清单；验收数字以实际执行结果和完整稳定采集为准。

原生 E2E 1/1、Jest 桥接 96 通过/5 跳过。固定 202 文件串行完整采集 `runtime/coverage-goal/node-dsh-model-validation-serial-20261112/`：201 套通过/1 跳过、2976 用例通过/8 跳过，910 个输入稳定；Node 行 17122/17439（98.18%）、分支 17785/20300（87.61%）。DSH 适配器为 163/168 行、83/112 分支。并行 4 worker 首次复采有 6 套超时失败，仅作诊断，不代替上述有效结果。平台三端目标仍未达成。

### 2026-11-12T21:19:00+08:00 DSH 真实 HTTP/SDK 纳入 Node 固定覆盖清单

原 `dsh-sdk-runtime.test.cjs` 由真实平台 HTTP API、隔离模型服务与任务级 systemd 验证完成、SSE 和取消；由于独立 `.test.cjs` 不在 Jest 分类中，产品适配器原先仅 58/168 行被采集。冷启动历史记录可超过 15 秒，隔离 E2E 的等待和运行预算扩展为 60 秒，显式测试超时 90 秒；产品 100ms 页面要求不变。现通过 `native-contract-coverage.test.js` 桥接复用同一契约，桥接保留 `assert(condition)` 可调用语义。原生 E2E 1/1、桥接完整套件 96 通过/5 条条件跳过。`runtime/coverage-goal/node-dsh-http-20261112-2113/` 的 202 文件完整 Jest 采集退出 0，201 套通过、1 套跳过，2976 项通过、8 项跳过；910 个受跟踪输入前后 SHA-256 一致，160 个产品文件行 17120/17439（98.17%）、分支 17783/20300（87.60%）。较上一稳定同分母报告净增 104 行、57 分支；DSH 适配器为 161/168 行、81/112 分支。Node 仍缺 319 行，达到 95% 分支至少需再覆盖 1502 项；前端与 Java 当前稳定全量仍待重采，平台目标未达成。

### 2026-11-12T21:05:19+08:00 当前 Node 完整稳定基线

统一入口发现的 202 个 Jest 文件以固定清单和完整 Node 产品源码分母采集；`runtime/coverage-goal/node-current-20261112-2056/` 中 201 套通过、1 套跳过，2975 项通过、8 项跳过，Jest 退出 0。`source-stability.json` 记录 910 个受跟踪应用、包、测试及配置输入前后 SHA-256 一致，`completed=true`、`stable=true`。160 个产品文件行 17016/17439（97.57%），分支 17726/20300（87.32%）；仍缺 423 行，分支达到 95% 至少还缺 1559 项。最大行缺口为 DSH 适配器 110 行、知识中心路由 80 行、任务路由 75 行、PingCode 同步服务 57 行。此前 `node-current-20261112-2048` 输入稳定但有 1 条任务文案旧断言失败，只用于诊断。DSH 独立 E2E 当前真实 HTTP 运行在等待完成状态时超时，不能据此声称该适配器已通过端到端验收或已计入 Jest 覆盖。前端和 Java 仍需当前完整稳定复采；平台行 100% / 分支 95% 目标未完成。

### 2026-11-12T20:35:32+08:00 GitLab 验证结果存储覆盖续验

数据库配置模式真实 HTTP 套件 `gitlab-verification-database-http.test.js` 增加原子替换失败、临时文件清理、旧结果保留及重试场景，并验证旧连接字段指纹和默认路径缺文件行为。定向 7/7 通过；`runtime/coverage-goal/gitlab-verification-atomic-directed/coverage-summary.json` 中目标产品模块为 22/22 行、13/13 分支。该单模块结果不代表 Node 全量或平台三端达到行 100% / 分支 95% 门槛。

DSH 管理员试运行真实 HTTP 与 SDK 验证：`node --test tests/e2e/agent-runner/dsh-sdk-runtime.test.cjs`。使用隔离本地模型端点与任务级 systemd 沙箱，覆盖完成、SSE 回读、取消、工具清单约束和运行产物无密钥明文；需要支持 user systemd 与 user namespace 的本机环境。缺少可用的 `systemd --user` 会话时，测试会显式标记为跳过；在具备该能力的 CI/主机上必须执行真实沙箱测试。真实模型短调用和共享实例部署回读另行记录，不由此夹具代替。

系统治理首页布局回归：`NODE_PATH=runtime/agent-runner/node_modules node --test tests/e2e/agent-runner/platform-governance-layout.test.cjs`，使用正式渲染函数与样式检查桌面/窄屏、正常/告警状态、数据库管理入口和无横向溢出；截图输出到 `runtime/test-results/platform-governance-layout/`。

### 2026-11-11T07:01:00+08:00 手册草稿保存故障恢复补测

真实 Chromium 与隔离 HTTP 验证共享草稿保存返回 503 后保留正文，并在服务恢复后重试成功；同时检查 PUT 正文与版本。新增场景原生通过，手册编辑器插桩测试 4/4 通过。固定前端全量复采输入稳定，行 9307/10374（89.71%），分支 10582/14196（74.54%），较上一采集增加 2 个分支；证据 `runtime/coverage-goal/frontend-handbook-save-verified/`。

网关新增审核人筛选及数据库模式大纲删除门禁真实 HTTP 测试，隔离领域存储未连接真实数据库。批量模板导入新增真实 HTTP 部分失败测试，核对逐项错误及后续成功结果，网关定向 16/16 通过。Node 全量复采 191 文件，2850 项通过、8 项跳过，输入稳定；行 16281/16415（99.18%），分支 16868/18957（88.98%），较上次增加 2 行和 2 分支。证据 `runtime/coverage-goal/node-template-batch-verified/`。平台目标仍未达到。

大纲移入回收站新增真实 Chromium 与隔离 HTTP 测试：取消确认零写入、失败后恢复按钮、重试成功并刷新列表。原生新增场景 1/1、插桩整组 5/5 通过；固定采集器快照门禁更新为 5。前端完整复采 57 个源码文件，输入稳定，行 9340/10374（90.03%）、分支 10640/14196（74.95%），相对前次增加 33 行、58 分支，分母不变。证据 `runtime/coverage-goal/frontend-outline-delete-verified/`。目标仍未完成。

大纲详情补测信息抽屉、模板说明和列表往返，发现关闭面板时焦点试图返回已收起菜单内的按钮；现改为菜单收起时聚焦摘要。真实浏览器定向 1/1、插桩整组 5/5 通过。完整前端复采输入稳定，行 9385/10376（90.44%）、分支 10660/14204（75.04%）；相比前次覆盖数增加 45 行、20 分支，焦点修复使分母增加 2 行、8 分支。证据 `runtime/coverage-goal/frontend-outline-focus-verified/`；目标未完成。

### 2026-11-11T06:53:00+08:00 前端完整采集与平台网关补测

前端完整采集退出 0，源码及输入稳定：行 9307/10374（89.71%），分支 10580/14196（74.52%）；相较上一有效采集分别增加 104 行和 92 个分支。证据位于 `runtime/coverage-goal/frontend-handbook-editor-verified/`。手册编辑器 3 项由前端覆盖率采集器执行。

平台网关新增 13 项真实 HTTP 测试，正式路径定向执行全部通过，统一 `full` 发现清单已包含该文件。Node 全量复采 191 文件，190 套件通过、1 套件跳过，2847 项通过、8 项跳过，输入稳定；行 16275/16415（99.14%），分支 16860/18957（88.93%），相较上一有效全量增加 18 行、38 分支。证据位于 `runtime/coverage-goal/node-platform-gateway-http-verified/`。三端均未达到行 100%、分支 95% 的目标。


### 2026-11-10T20:33:36+08:00 版本映射HTTP生命周期复验与前端完整采集结果

Java StorageGitLabHttpCheck扩展版本映射创建/编辑/启用/禁用/修订替代、EXACT优先ALL解析、非法字段/长度、CAS及更新失败验证，真实本地HTTP复验退出0，核对5条映射和14条审计事件。首次无连接解析测试误预期422，依据connectionId实际查询及HTTP返回修为404 GITLAB_CONNECTION_NOT_FOUND，失败日志保留于runtime/test-results/java-version-mapping-directed/failed-first.log；成功日志run-v2.log。JDBC为内存状态夹具，不声明真实数据库约束验收。

前端固定副本20261110-202219完整采集退出0，completed/stable/inputsStable均true，changedFiles/changedInputs均为空。57产品、45导航、22 API、6送审、31写作、16任务页、8我的工作、5手册往返、6平台、16审核计数齐全；行8647/10374（83.35%）、分支9984/14196（70.32%）。证据副本runtime/test-results/frontend-review-selection-full-20261110，HTML/lcov/原始计数齐全，仍未达100/95。

新固定副本20261110-203258共5425文件稳定复制，分别启动Java版本映射全量和前端含8组草稿输入/附件全量采集，运行期间不修改副本；终态另行核验，不把定向或旧结果作为新全量。



### 2026-11-10T14:37:06+08:00 三端完整采集阶段结果（未达标）

本阶段完整采集均成功，平台覆盖率门槛仍未通过：

| 运行时 | 行覆盖率 | 分支覆盖率 | 缺失行 | 达到95%分支还需 |
| --- | --- | --- | --- | --- |
| node | 15397/16074（95.78%） | 15023/18311（82.04%） | 677 | 2373 |
| frontend | 7922/10021（79.05%） | 9223/13770（66.97%） | 2099 | 3859 |
| java | 3278/3360（97.56%） | 1837/2178（84.34%） | 82 | 233 |

Node固定161文件：160套件、2051项通过，1套件与8项条件跳过；154产品文件与测试源码稳定，stable=true、changedFiles=[]、jestExit=0。聚合存储154/154行，131/154分支；同步write新增HTTP回读断言通过。相比前一Node报告增3行、分支少2项；差异定位production-ai-service.js:23的artifactStore/内联value回退分支，聚合存储分支计数未变。保留最新实际计数，不拼接较高指标。后续应显式验证该公开执行流程的内联artifact兼容回退。

前端57文件完整采集通过：31写作用例、18任务页面、8我的工作、5手册返回、6平台与16审核用例；本轮团队成员与分工统计/失效移动目标DOM断言通过。相较上一有效报告多35行、26分支，差异分布于app.js、组合下拉框、工作台、任务管理、模型管理与审核模块，沿用完整产品清单。报告14:33:44完成后document-tasks/view.js于14:34:05有并行任务修改，本报告不覆盖其后续版本，不能作为当前整个工作区最终验收。最大剩余缺口app.js有1865行。

Java9文件完整采集通过，真实HTTP正文分工回填、旧格式兼容、未知领域拒绝且不提交断言通过。所有证据路径见 `runtime/test-results/coverage-status-20261110-1436.json`，具体报告分别为 `node-aggregate-write-stable-20261110/`、`frontend-outline-dialogs-20261110/`、`java-content-assignments-recheck-20261110/`。未修改本轮产品源码、排除文件或降低100%/95%门槛；goal保持active。


### 2026-11-10T14:30:54+08:00 聚合存储与正文分工完整结果

Node固定161测试文件全量通过：160套件、2051项通过，1套件与8项条件跳过；154产品文件及测试源码稳定，stable=true、changedFiles=[]、jestExit=0。行15394/16074（95.76%）、分支15025/18311（82.05%），较工作流故障报告增加15行、29分支。聚合存储模块151/154行、131/154分支；证据 `runtime/test-results/node-aggregate-boundaries-stable-20261110/`。后续补其公共同步write入口，验证读取版本后覆盖写入并经HTTP回读一致，保持原全量清单与分母。

Java正文分工完整采集通过：3278/3360行（97.56%）、1837/2178分支（84.34%），9产品文件，较目录继承报告增加6行、6分支。证据 `runtime/test-results/java-content-assignments-recheck-20261110/`。首次旧parts夹具只有部分级文档被现行校验拒绝，补齐章节文档后定向与全量通过；原失败保留于 `runtime/test-results/java-content-assignments-20261110.log`，不修改产品校验。前端完整采集仍在审核工作台阶段。三端目标未达到。


### 2026-11-10T14:21:45+08:00 完整采集结果与前端断言维护、弹窗补测设计

固定Node全量160个测试文件完成：159套件、2042项通过，1套件与8项条件跳过；154产品文件及测试源码前后稳定，行15379/16074（95.67%）、分支14996/18311（81.89%）。证据 `runtime/test-results/node-workflow-file-failure-stable-20261110/`。Java目录继承真实HTTP补测及完整采集通过：9文件，行3272/3360（97.38%）、分支1831/2178（84.07%），较快照兼容报告增加4行、8分支；证据 `runtime/test-results/java-directory-assignments-20261110/`。

前端团队名册完整采集在审核工作台阶段15项通过、1项失败，不作为有效全量。失败断言仍要求关闭MR显示状态刷新，而前端README已明确关闭旧MR只读且不开放刷新；修正为按钮不存在，并保留MR链接与作者权限断言。保留原失败日志 `runtime/test-results/frontend-team-membership-20261110/`。下一阶段用真实DOM事件补分工统计弹窗打开/关闭/背景关闭与焦点恢复，补目录移动无选择和目标过期为文档的拒绝校验；断言弹窗保持打开且无保存请求。产品源码与统计分母不变。平台目标仍未完成。


### 2026-11-10T14:14:30+08:00 Java快照兼容全量结果

快照兼容及拒绝矩阵经真实HTTP定向通过，完整JaCoCo采集通过：9产品文件，3268/3360行（97.26%）、1823/2178分支（83.70%），较责任初始化报告增加20行、22分支，分母未变。证据 `runtime/test-results/java-snapshot-compatibility-20261110/coverage-summary.json`、`java.xml`和HTML。仍缺92行，达到95%分支至少还需247项。首次合法字符串内容夹具缺失必需level/order，导致INVALID_OUTLINE_ORDER_OR_LEVEL映射503；已补齐测试字段并复测，不更改产品校验。Node最新有效全量仍95.63%/81.88%，前端全量采集中。平台目标尚未达到。

AI执行边界补测后固定Node全量160文件完成：159套件、2038项通过，1套件与8项条件跳过，154产品文件与测试源码SHA256前后一致，stable=true、changedFiles=[]、jestExit=0。行15372/16074（95.63%）、分支14994/18311（81.88%），较上次有效报告增加57行、55分支；证据 `runtime/test-results/node-ai-execution-recheck-stable-20261110/coverage-summary.json`、`source-stability.json`、`remaining-gaps.json`。Java责任版本初始化完整采集通过：9文件，行3248/3360（96.67%）、分支1801/2178（82.69%），较引用保护报告增加13行、7分支；证据 `runtime/test-results/java-responsibility-initialization-20261110/coverage-summary.json`。前端最近仍78.36%/66.63%；三端目标未完成。

Java引用保护及请求故障完整采集通过：9个产品文件，行3235/3360（96.28%）、分支1794/2178（82.37%），比前次增加26行、17分支；证据 `runtime/test-results/java-reference-request-failure-20261110/coverage-summary.json`。仍缺125行，目标未完成。Node本次160文件源码稳定但GitLab HTTP初始化超过默认5秒，158套件通过、1失败、1跳过，不作为通过报告；该套件在30秒测试初始化预算下16/16通过，保留原失败并以相同源码/分母完整复采。该预算仅适用于测试等待，不调整产品100ms性能要求。

Java启动、迁移与记录HTTP补测后完整采集通过：9个产品源文件，行3209/3360（95.51%），分支1777/2178（81.58%）。证据 `runtime/test-results/java-record-encoding-20261110/coverage-summary.json`、`java.xml`及同目录HTML报告。新增真实HTTP验证JSON转义往返、gzip正文与响应头、畸形JSON拒绝、JDBC读写删失败503且无提交/版本/正文副作用；Java仍缺151行，分支目标尚未达到。Node最新95.27%/81.58%，前端最近78.36%/66.63%；平台目标仍未达成。

增量审核真实HTTP补测后固定Node全量：159文件，158套件、2031项通过，1套件与8项条件跳过；154产品文件与测试SHA256前后一致，stable=true、changedFiles=[]、jestExit=0。行15315/16074（95.27%）、分支14939/18311（81.58%），较上一报告增加67行、75分支，分母不变。证据 `runtime/test-results/node-incremental-review-stable-20261110/coverage-summary.json`、`source-stability.json`、`remaining-gaps.json`。新增审核21项结合原HTTP套件定向40/40通过，检查分析/建议/评论状态、幂等审计及冻结候选不变。Node仍缺759行，达到95%分支至少还需2457项。前端最近78.36%/66.63%，Java最近92.80%/79.48%，均尚未重采；平台目标未达成，goal保持active。

大纲治理与文档故障恢复补测后固定Node全量：158文件，157套件、2012项通过，1套件与8项条件跳过；154产品文件及测试SHA256前后一致，stable=true、changedFiles=[]、jestExit=0。行15248/16074（94.86%）、分支14864/18311（81.17%），较前次增加56行、104分支，分母不变。证据 `runtime/test-results/node-outline-document-stable-20261110/coverage-summary.json`、`source-stability.json`、`remaining-gaps.json`。新增大纲38项、文档10项，定向大纲3套件81项与文档21项通过；模块分别585/601行、692/834分支，585/598行、353/418分支。Node还缺826行、达到95%分支至少需2532项。前端最近7826/9986行（78.36%）、9158/13744分支（66.63%）；Java3118/3360行（92.80%）、1731/2178分支（79.48%），本阶段未重采。平台目标仍未达成，goal保持active。

Agent/MCP补测后固定Node全量：157文件，156套件、1964项通过，1套件与8项条件跳过；154产品文件及测试SHA256前后一致，stable=true、changedFiles=[]、jestExit=0。行15192/16074（94.51%）、分支14760/18311（80.60%），较前次增加60行、58分支，分母不变。证据 `runtime/test-results/node-agent-mcp-stable-20261110/coverage-summary.json`、`source-stability.json`、`remaining-gaps.json`。Agent新增25项、MCP新增29项；定向路由126/126行、48/48分支，MCP171/171行、159/163分支。Node还缺882行，达到95%分支至少需2636项。前端最近7826/9986行、9158/13744分支；Java3118/3360行、1731/2178分支，本轮未重采。平台目标未达成，goal保持active。

2026-11-10 LangGraph补测后固定Node全量：155文件，154套件、1910项通过，1套件与8项条件跳过；154产品文件与测试SHA256前后一致，stable=true、changedFiles=[]、jestExit=0。行15132/16074（94.13%）、分支14702/18311（80.29%），较前次增加36行、67分支，分母不变。证据 `runtime/test-results/node-langgraph-stable-20261110/coverage-summary.json`、`source-stability.json`、`remaining-gaps.json`。新增12项真实编译图测试，结合工作流及真实HTTP路由28/28通过；LangGraph151/152行、157/177分支，剩余行360是未接入图的私有函数，保留缺口不伪造覆盖。Node还缺942行、达到95%分支至少需2694项。前端最近7826/9986行（78.36%）、9158/13744分支（66.63%）；Java3118/3360行（92.80%）、1731/2178分支（79.48%），本轮未重采。平台目标仍未达成，goal保持active。

2026-11-10 最新通过的固定Node全量：154文件，153套件、1898项通过，1套件与8项条件跳过；154产品文件及测试采集前后SHA256一致，stable=true、changedFiles=[]、jestExit=0。行15096/16074（93.91%）、分支14635/18311（79.92%）。报告 `runtime/test-results/node-ai-http-terminal-stable-20261110/coverage-summary.json`，稳定性 `source-stability.json`，逐模块缺口 `remaining-gaps.json`。相比上一阶段检索稳定报告增加77行、132分支，固定分母相同；Node仍缺978行、达到95%分支至少还需2761项。前端最近7826/9986行（78.36%）、9158/13744分支（66.63%）；Java3118/3360行（92.80%）、1731/2178分支（79.48%），本阶段均未重采。三端目标仍未达成。

2026-11-10 组合下拉框定向验证：公共组件契约 11/11、工作台隔离浏览器 8/8（含任务管理动态改派弹窗与 390px）、审核改派 1/1、模板映射隔离 HTTP/浏览器通过、Agent 管理与模型管理隔离 HTTP/浏览器各 1/1。测试保留原生人员 ID，并通过可见搜索候选完成选择；未执行共享平台业务写入。

2026-11-10 最新固定Node全量：150文件，149套件、1827项通过，1套件与8项条件跳过；154产品文件及测试采集前后SHA256一致，stable=true、changedFiles=[]、jestExit=0。行15019/16074（93.43%）、分支14503/18311（79.20%）。报告 `runtime/test-results/node-retrieval-stable-20261110/coverage-summary.json`；稳定性 `source-stability.json`，逐模块缺口 `remaining-gaps.json`。相比前一GitLab稳定报告增加32行、75分支，产品分母相同；Node仍缺1055行、达到95%分支至少还需2893项。前端最近7826/9986行（78.36%）、9158/13744分支（66.63%）；Java3118/3360行（92.80%）、1731/2178分支（79.48%），本轮均未重采。三端目标仍未达成。

2026-11-10 GitLab固定Node复采148文件：147套件、1779项通过，1套件与8项条件跳过，154产品文件前后源码与测试SHA256一致；行14987/16074（93.23%）、分支14428/18311（78.79%），证据 `runtime/test-results/node-gitlab-stable-20261110/coverage-summary.json` 和 `source-stability.json`。检索过滤器与查询构建器新增48项，结合原套件83/83通过，分别88/88行、112/114分支（98.24%）和95/95行、51/51分支；定向证据 `runtime/test-results/retrieval-boundaries-directed-20261110/coverage-summary.json`。正式全量需再次复采；前端与Java未重采，平台目标仍未达到。

2026-11-10 API入口35项通过，135/135行、66/68分支（97.05%）；认证45项通过，364/364行、383/395分支（96.96%）。均使用真实本机HTTP；认证真实超限用例暴露并修复CAS响应超限竞态与Node22 Socket未处理异常。API入口公共CJS套件由两个显式describe入口引用，确保统一测试发现识别为Jest。定向证据 `runtime/test-results/api-entry-directed-20261110` 与 `runtime/test-results/auth-boundaries-directed-20261110`；固定147文件全量复采另计。

2026-11-10 最新通过的固定 Node 复采：147 文件清单，146 套件、1706 项通过，1 套件及8项条件跳过，154 产品文件源码及测试前后 SHA256 一致。行14947/16074（92.98%）、分支14284/18311（78.00%）；证据 `runtime/test-results/node-api-auth-fixed-stable-20261110/coverage-summary.json` 与 `source-stability.json`。前端最近7826/9986行（78.36%）、9158/13744分支（66.63%），Java3118/3360行（92.80%）、1731/2178分支（79.48%），本阶段未重采。目标仍未达到。

2026-11-10 来源读取与压缩包边界：新增来源公开方法44项，以真实本机 PingCode/MCP HTTP、Worker上传和隔离存储验证，模块195/195行、227/236分支（96.18%）。压缩包结合原测试23项通过，模块164/164行、77/79分支（97.46%）；真实嵌套ZIP复现提前删除导致ENOENT，现延迟到外层parse完成统一清理；TAR/TGZ真实文件/目录冲突验证流销毁、及时拒绝与清理。定向报告为 `runtime/test-results/ai-sources-directed-20261110/coverage-summary.json`、`runtime/test-results/archive-boundaries-directed-20261110/coverage-summary.json`。平台总量另以固定清单和源码稳定性验收。

2026-11-10 新增设计流水线与生产配置管理器公开边界：流水线结合集成测试27/27通过，183/183行、102/107分支（95.32%）；配置管理器7/7通过，133/133行、103/103分支。证据 `runtime/test-results/pipeline-boundaries-directed-20261110/coverage-summary.json` 与 `runtime/test-results/config-manager-directed-20261110/coverage-summary.json`。固定142文件复采 `node-pipeline-config-stable-20261110` 有2项失败且运行中源码/测试变化，只用于诊断，不能替换顶部有效基线。失败涉及工作台关闭MR的动作与投影文案，详见该目录 `jest.log` 和 `source-stability.json`。

2026-11-10 预处理两组回归进入固定 Node 清单：138 套件通过、1 条件跳过，1454 项通过、8 项跳过；154 个产品源码文件行 14480/16028（90.34%）、分支 13604/18183（74.81%）。证据 `runtime/test-results/node-preprocessing-20261110/coverage-summary.json`；浏览器与 Java 沿用最近固定报告，三端目标未达成。

2026-11-10 流水线基类回归：`tests/unit/agent-runner/preprocessing/pipeline-base-coverage.test.js` 使用真实临时文件验证全量扫描、hash 增量分类、无变化跳过、分块与清理、dry-run、失败传播和抽象接口。定向 Jest 5/5 通过，`Pipeline` 模块行 105/105、分支 35/35；报告 `runtime/test-results/pipeline-base-20261110/coverage-summary.json`。完整平台覆盖率按固定清单另行核验。

2026-11-10 分层索引增量回归：`tests/unit/agent-runner/preprocessing/layered-indexer.test.js` 使用隔离临时目录验证直接/包装文档、L1/L2 与统计文件、同 ID 增量替换、源路径删除、全量清理、chunk 聚合、摘要边界及损坏索引错误。定向 Jest 5/5 通过，`LayeredIndexer` 行 119/119、分支 127/132（96.21%）；报告 `runtime/test-results/layered-indexer-20261110/coverage-summary.json`。此项为单模块结果，完整 Node 与三端目标另行核验。

2026-11-10 前端数据库语义增强器固定复采：公开浏览器接口验证 SQL、参数、错误码、代码块复制工具栏、内联结构保护和未匹配代码块诊断。固定前端 57 文件、45 导航、31 写作、17 任务、8 我的工作、5 手册往返、6 平台、16 审核场景通过；总行 7491/9986（75.01%）、分支 8909/13744（64.82%），`database-enhancer.js` 行 28/28、分支 13/16。报告 `runtime/test-results/frontend-database-enhancer-20261110/coverage-summary.json`；全平台目标仍未达到。

2026-11-10 前端写作关闭生命周期与认证跳转固定复采：新增 Vditor 异步初始化期间关闭后延迟销毁的真实浏览器用例，并覆盖统一认证登录、CAS 退出和显式退出跳转。固定 57 个前端源码、45 导航、31 写作、17 任务、8 我的工作、5 手册往返、6 平台和 16 审核场景通过；前端行 7485/9986（74.95%）、分支 8905/13744（64.79%），认证控制器达到行/分支 100%。报告 `runtime/test-results/frontend-auth-navigation-final-20261110/coverage-summary.json`。Node 最近固定行 14387/16028（89.76%）、分支 13493/18183（74.20%）；Java 最近固定行 3118/3360（92.80%）、分支 1731/2178（79.48%）。全平台目标仍未达到。

2026-11-10 手册写作来源检查并发编辑保护固定复采：真实点击生成后，隔离映射读取返回未配置，并在异步检查期间改变正文；断言页面提示保留人工修改且不提交 AI jobs POST。固定 57 个前端源码、45 导航、30 写作、17 任务、8 我的工作、5 手册往返、6 平台、16 审核计数全部齐全。前端行 7463/9979（74.78%）、分支 8875/13738（64.60%）；`app.js` 语句行 2343/5480、分支 1627/4135。报告 `runtime/test-results/frontend-handbook-origin-race-20261110/coverage-summary.json`。Node 最近固定行为 14387/16028、分支 13493/18183；Java 最近固定行为 3118/3360、分支 1731/2178。全平台目标未达成。

2026-11-10 手册写作生成入口固定前端复采：草稿就绪时真实点击生成入口挂载嵌入式写作页，验证隔离模型/模板目录读取及关闭清理；不触发生成、质量检查或保存。固定 57 个产品脚本采集通过，45 导航、30 写作、17 任务管理、8 我的工作、5 手册往返、6 平台、16 审核快照齐全。前端行 7450/9979（74.65%）、分支 8869/13738（64.55%）；`app.js` 行语句 2329/5480、分支 1618/4135。报告 `runtime/test-results/frontend-handbook-generate-entry-20261110c/coverage-summary.json`。Node 最近固定行为 14387/16028、分支 13493/18183；Java 最近固定行为 3118/3360、分支 1731/2178。全平台目标仍未达成。

2026-11-10 手册写作入口固定前端复采：补齐真实页面的当前文档标记后，已保存修订检查入口成功打开质量报告；未就绪、未保存、生成等待和重复打开分支断言通过。固定 57 个产品脚本采集通过，45 导航、30 写作、17 任务管理、8 我的工作、5 手册往返、6 平台、16 审核快照齐全。前端行 7426/9979（74.41%）、分支 8842/13738（64.36%）；`app.js` 语句行 2304/5480、分支 1598/4135。报告 `runtime/test-results/frontend-handbook-entry-20261110/coverage-summary.json`。Node 最近固定行为 14387/16028、分支 13493/18183；Java 最近固定行为 3118/3360、分支 1731/2178。全平台目标仍未达成。

2026-11-10 文档任务审核读取失败降级固定 Node 复采：隔离真实本地 HTTP 先建立工单、两级范围及审核关联，再令审核服务读取抛出 `REVIEW_UNAVAILABLE`，确认 GET 工单返回待处理状态、中文恢复提示和错误码。定向场景通过，完整 `document-tasks-route.test.js` 32/32 通过；固定 Jest 清单 137 个文件中 136 套件通过、1 条件跳过，1444 项通过、8 项跳过。Node 行 14387/16028（89.76%）、分支 13493/18183（74.20%）；`routes/document-tasks.js` 行 407/407、分支 680/816。报告 `runtime/test-results/full/20261110-064739-809978-full/details/coverage/coverage-summary.json`。统一覆盖入口随后自动启动浏览器覆盖复采，本轮未等待该阶段完成；前端沿用已核验的最近报告 7401/9979 行、8811/13738 分支。独立固定 JaCoCo 复采再次确认 Java 9 源码行 3118/3360、分支 1731/2178，报告 `runtime/test-results/java-current-followup-20261110/coverage-summary.json`。三端阈值仍未达到。

2026-11-10 视口运行时收尾分支固定复采：隔离 Chromium iframe 真实执行原生 dvh 接管 measured 回退 token，以及销毁时取消待执行 animation frame 两条路径。固定采集通过，57 个产品脚本、45 导航、30 写作、17 任务管理、8 我的工作、5 手册往返、6 平台和 16 审核计数齐全。前端总行 7401/9979（74.16%）、分支 8811/13738（64.13%）；`common/viewport-runtime.js` 行 37/37、函数 5/5、分支 35/35。证据 `runtime/test-results/frontend-viewport-finalization-20261110/coverage-summary.json`。Node 最近固定行 14386/16028（89.75%）、分支 13493/18183（74.20%）；Java 最近固定行 3118/3360（92.80%）、分支 1731/2178（79.48%），本轮未重采。三端目标尚未达成，goal 保持 active。

2026-11-10 Java Main 一次性 probe 固定复采：独立 JVM 运行真实 `Main.main(["probe"])`，使用隔离 JDBC 驱动分别返回探测成功、无结果行和值错误；失败场景断言预期 SQL 错误且连接资源关闭，成功场景以 `System.exit(0)` 正常终止。全量 JaCoCo 固定 9 个产品源码采集通过，行 3118/3360（92.80%）、分支 1731/2178（79.48%）；相较加入 probe 前增加 12 行、6 分支。证据 `runtime/test-results/java-main-probe-results-20261110/coverage-summary.json`。Node 最近固定行 14386/16028（89.75%）、分支 13493/18183（74.20%）；浏览器前端行 7403/9979（74.18%）、分支 8810/13738（64.12%），本轮未重采。全平台行 100%、分支 95% 目标仍未达到。

2026-11-10 Java Main 启动 HTTP 边界复采：扩展 `StorageBootstrapContractCheck.server-http`，通过动态端口真实请求验证质量/导出/技术领域/手册/大纲/团队/建设任务方法门禁、无效记录和任务项路径、快照非法 JSON、团队幂等键缺失及错误请求 ID 回传。完整 JaCoCo 固定 9 个 Java 产品源码采集通过；行 3106/3360（92.44%）、分支 1725/2178（79.20%），比此前 Java 固定报告增加 5 个分支，报告 `runtime/test-results/java-main-http-boundaries-20261110/coverage-summary.json`。Node 最近固定行 14386/16028（89.75%）、分支 13493/18183（74.20%），浏览器前端行 7403/9979（74.18%）、分支 8810/13738（64.12%）。全平台行 100%、分支 95% 目标仍未达到。

2026-11-10 资产管理停用边界固定前端复采：真实隔离 Chromium 资产投影展开高级操作，验证修改中阻止停用、恢复原值后打开确认、取消后恢复管理框与焦点、dialog cancel 路径及忙碌时拒绝关闭；API 路由只响应读取，断言无资产写请求。资产导航旧通用弹窗动作由专用场景接管。固定采集通过，57 个产品脚本、45 导航、30 写作、17 任务管理、8 我的工作、5 手册往返、6 平台、16 审核计数齐全。前端行 7403/9979（74.18%）、分支 8810/13738（64.12%）；`app.js` 行 1991/4318、分支 1567/4135。相较 `frontend-chat-evidence-20261110b` 增 25 行、11 分支；报告 `runtime/test-results/frontend-asset-management-20261110e/coverage-summary.json`。Node 最近固定行 14386/16028、分支 13493/18183，Java 行 3106/3360、分支 1720/2178，本轮未重采；平台行 100%、分支 95% 目标仍未达到。

2026-11-10 写作 AI 对话来源与操作覆盖：固定 Chromium 写作场景新增真实 DOM/API 路由矩阵，验证实际引用 provenance 的来源及区间过滤、缺失来源/正文/元数据回退、空态、详情加载失败；覆盖回复复制及剪贴板失败、评分成功/失败、反馈空值/成功/失败、删除取消/成功/失败和当前消息状态。定向浏览器 1/1 通过；固定前端采集通过，57 个产品脚本以及 45 导航、30 写作、17 任务管理、8 我的工作、5 手册往返、6 平台、16 审核计数齐全。前端行 7378/9979（73.93%）、分支 8799/13738（64.04%），较前一固定报告增加 35 行、53 分支；`modules/production/production-chat-evidence.js` 行 86/86、分支 66/66、函数 24/24。报告 `runtime/test-results/frontend-chat-evidence-20261110b/coverage-summary.json`。Node 最近固定结果行 14386/16028、分支 13493/18183，Java 行 3106/3360、分支 1720/2178，本轮未重采。全平台目标仍未达成。

2026-11-10 认证控制器固定前端复采续验：增加统一认证禁用/缺少登录地址、管理员登录凭证失败和退出接口失败断言；连同 CAS 匿名回调、管理员登录成功/刷新、本地退出清理矩阵，覆盖 `auth-controller.js` 全部 13 个函数。固定采集通过，57 个产品脚本及 45 导航页面、29 写作、17 任务管理、8 我的工作、5 手册往返、6 平台、16 审核计数齐全。前端行为行 7343/9979（73.58%）、分支 8746/13738（63.66%）；认证控制器行 67/76、函数 13/13、分支 42/48。报告 `runtime/test-results/frontend-auth-controller-20261110f/coverage-summary.json`；较上一固定认证报告增加 2 行、4 分支。Node 最新固定报告行 14386/16028、分支 13493/18183，Java 行 3106/3360、分支 1720/2178，本轮未重采。各运行时仍未达到行 100%、分支 95% 目标。

2026-11-10 认证控制器固定前端复采：隔离 Chromium 页面补 CAS 回调后匿名会话、管理员登录直接恢复/回退读取会话、本地退出清理状态与记忆目标；认证接口由页面内 fetch 夹具响应，并在结束时恢复 URL、`fetch` 和 `authState`。固定采集通过，57 个产品脚本及 45 导航页面、29 写作、17 任务管理、8 我的工作、5 手册往返、6 平台、16 审核快照齐全。前端行为行 7341/9979（73.56%）、分支 8742/13738（63.63%）；`auth-controller.js` 行 65/76、分支 39/48。报告 `runtime/test-results/frontend-auth-controller-20261110e/coverage-summary.json`。相对上一固定报告 `frontend-auth-controller-20261110d` 增加 10 行、4 分支；Node 最新固定报告为 14386/16028 行、13493/18183 分支，Java 为 3106/3360 行、1720/2178 分支，本轮未重采。各运行时仍未达到行 100%、分支 95% 目标。

2026-11-10 平台管理视图渲染分支复采：在固定模型管理 Chromium 场景中导入真实 `platform-admin/view.js`，通过公开渲染入口覆盖治理服务和数据库状态、人员与团队加载/不可用/完整成员、权限空/不可用/筛选/分页/角色编辑状态，以及 GitLab OAuth、验证状态、管理员/只读、空列表、分页和编辑/新增表单。定向浏览器场景通过；固定 57 个产品脚本、29 写作/17 任务管理/8 我的工作/5 手册往返/6 平台/16 审核计数全部齐全。前端行 7135/9979（71.50%）、分支 8538/13738（62.14%），较上一固定前端报告增加 72 行、305 分支；`platform-admin/view.js` 行 184/188、分支 563/764、函数 53/53。报告 `runtime/test-results/frontend-platform-view-20261110/coverage-summary.json`。Node 最新固定报告行 14386/16028、分支 13493/18183；Java 最新固定报告行 3106/3360、分支 1720/2178；本轮未重采 Node/Java。整体门槛仍未达到。

2026-11-10 前端平台 API 浏览器覆盖复采：在现有平台管理 Chromium 会话中导入真实 `platform-api.js`，以可编排 fetch 响应逐项调用平台、模板、团队、大纲、领域任务、资产、权限及人员公开 API，并检查 URL、方法、错误与事件。定向模型管理浏览器测试通过；固定 57 产品脚本完整采集的写作 29、任务管理 17、我的工作 8、手册往返 5、平台 6、审核 16 份页面计数均齐全。行覆盖率 7063/9979（70.77%）、分支 8233/13738（59.92%），较同轮前一固定前端报告增加 101 行、128 分支；`platform-api.js` 达 196/212 行、199/329 分支。报告 `runtime/test-results/frontend-platform-api-20261110/coverage-summary.json`。Node 固定 137 Jest 文件复采全部通过，行 14386/16028、分支 13493/18183，报告 `runtime/test-results/node-current-fixed-20261110/coverage-summary.json`；Java 最新固定 9 源码报告行 3106/3360、分支 1720/2178，报告 `runtime/test-results/java-auth-http-boundaries-20261110b/coverage-summary.json`。三端门槛仍未达到，无统一全量 PASS。

2026-11-10 Java 平台认证 HTTP 错误与角色复采：`StorageAuthHttpCheck` 经真实本地 HTTP/JDBC 验证非法 CAS 主体 ID、CAS 人员不存在/停用、登录不匹配、空/未知角色、角色更新用户不存在及缺少缺省角色。固定 9 个 Java 产品文件行 3106/3360（92.44%）、分支 1720/2178（78.97%），较前一份人员管理报告增加 1 行、3 分支；证据 `runtime/test-results/java-auth-http-boundaries-20261110/coverage-summary.json`。CAS 人员不存在当前由平台认证路由返回 503 `STORAGE_UNAVAILABLE` 信封并在消息中保留 `CAS_PRINCIPAL_NOT_FOUND`，夹具按实际 HTTP 响应核验。Node 和前端本轮未重采，目标仍未达到。

2026-11-10 Java 人员管理 HTTP 边界复采：`StoragePrincipalHttpCheck` 经真实本地 HTTP/JDBC 增补非法人员状态、缺失 CAS 登录名、同名候选歧义、已有 CAS 身份的直接换绑拒绝、重复登录名导入冲突及 1001 人导入拒绝。固定 9 个 Java 产品文件行 3105/3360（92.41%）、分支 1717/2178（78.83%），相对上一份增加 6 行、9 分支；证据 `runtime/test-results/java-personnel-http-boundaries-20261110/coverage-summary.json`。Node 最近报告行 14386/16028、分支 13493/18183；前端最近报告行 6958/9979、分支 8104/13738，本轮未重采。三端目标仍未达到。

2026-11-10 Java 迁移 SQL 解析边界复采：`MigrationSqlParserCheck` 新增首字符单引号、引号内注释标记和尾随星号的未闭合块注释输入；固定 9 个 Java 产品源文件报告行 3099/3360（92.23%）、分支 1708/2178（78.42%），较 GitLab 路由复采增加 2 个分支，报告 `runtime/test-results/java-parser-boundaries-20261110/coverage-summary.json`。Node 和前端本轮未重采，三端统一目标仍未达成。

2026-11-09 GitLab 配置路由边界复采：`StorageGitLabHttpCheck` 通过真实本地 HTTP/JDBC 验证连接编辑、非法 JSON、旧连接版本、非法状态、映射缺少幂等键及映射旧版本，并回读成功编辑结果。按产品契约校准 `GITLAB_STATE_INVALID` 为 422，首次映射保存后的过期 `If-Match` 使用 0；缺少幂等键统一为 400。固定 9 个 Java 产品源文件行 3099/3360（92.23%）、分支 1706/2178（78.33%），证据 `runtime/test-results/java-gitlab-routing-20261109/coverage-summary.json`。Node 最近固定报告行 14386/16028（89.75%）、分支 13493/18183（74.20%）；前端最近独立报告行 6958/9979（69.72%）、分支 8104/13738（58.98%），本轮未重采。三端仍未达到行 100%/分支 95%，未执行统一全量门禁，目标保持 FAIL。

2026-11-09 Node 固定覆盖续作：校准 `handbook-demand-read.node.test.cjs` 页面 VM 夹具的模板映射依赖后原生 8/8 通过；桥接同时支持 `node:test` 默认导出和命名 `test` 导入，复用按需草稿真实 HTTP、聚合存储并发/304/CAS、管理员代审和编号回填场景。固定精确 137 Jest 文件复采 136 套件通过、1 条件跳过，1443 项通过、8 项跳过；行 14386/16028（89.75%）、分支 13493/18183（74.20%），较同分母上一份报告增加 34 行、39 分支。报告 `runtime/test-results/node-native-bridge-full2-20261109/coverage-summary.json`；`handbook-production-service.js` 行 229/233，`workbench-numbering.js` 行 76/76、分支 125/130。Java 最近独立完整报告行 3072/3360（91.43%）、分支 1674/2178（76.86%）；前端最近报告行 6958/9979（69.72%）、分支 8104/13738（58.98%），两者本轮未重采。仍缺 Node 1642 行及至少 3781 分支、Java 288 行及至少 396 分支、前端 3021 行及至少 4948 分支；没有三端统一通过结论，目标仍为 FAIL。

2026-11-09 固定覆盖续作：Java 治理 HTTP/JDBC 夹具新增未发布大纲说明更新及响应和 GET 回读，固定 9 产品文件行 3072/3360（91.43%）、分支 1674/2178（76.86%），证据 `runtime/test-results/java-draft-description-20261109/coverage-summary.json`。Node 先验证旧网页引用 v2/v3 独立用例，发现回环地址被当前私网防护拒绝且 v2 引用已移除的缓存导出，未接入固定门禁；改为通过既有桥接复用独立通过的 MCP 检索和模板映射契约，保留性能用例在原生未插桩入口。固定 137 Jest 文件 136 套件通过、1 条件跳过，1430 项通过、8 项跳过；行 14352/16028（89.54%）、分支 13454/18183（73.99%），证据 `runtime/test-results/node-native-bridge-full-20261109/coverage-summary.json`，同分母增加 4 行、20 分支。前端最近独立报告仍为行 6958/9979（69.72%）、分支 8104/13738（58.98%），本轮未重采；未执行三端统一全量门禁。剩余 Java 288 行及至少 396 分支、Node 1676 行及至少 3820 分支、前端 3021 行及至少 4948 分支，平台目标仍为 FAIL。

2026-11-09 Java 固定覆盖续作：现有隔离 JDBC/真实本地 HTTP 夹具补单篇草稿空记录、revision 变化后 503 与后台重建、当前修订隔离和软删除；大纲快照同时提交显式及正文分工，验证重复领域只写入一项、未知节点不入库。固定 9 个 Java 产品源文件采集通过，行 3061/3360（91.10%）、分支 1666/2178（76.49%），证据 `runtime/test-results/java-draft-assignments-20261109/coverage-summary.json`；较上次 Java 完整报告增加 61 行、36 分支。最近独立 Node 为行 14348/16028、分支 13434/18183，前端为行 6958/9979、分支 8104/13738；本轮未重采两者，也未运行统一全量门禁。仍缺 Java 299 行及至少 404 分支，Node 1680 行及至少 3840 分支，前端 3021 行及至少 4948 分支。三端均未达到行 100%/分支 95%，平台目标保持 FAIL。

2026-11-09 网页引用原生契约纳入固定计数：`native-contract-coverage.test.js` 复用已有 `production-web-reference.test.cjs` 的本地 HTTP、DNS 安全与 SPA 场景，Jest 定向 3/3 通过；固定 Node 137 文件再次复采 136 套件通过、1 条件跳过，1421 项通过、7 项跳过。网页引用模块行 145/153、分支 110/145；Node 产品总量行 14348/16028（89.51%）、分支 13434/18183（73.88%），证据 `runtime/test-results/node-web-reference-full-20261109/coverage-summary.json`。较同分母上次完整报告增加 33 行、35 分支；前端与 Java 沿用下方独立完整报告，不冒称三端统一通过。剩余 Node 1680 行与至少 3840 分支，前端 3021 行与至少 4948 分支，Java 475 行与至少 482 分支；平台目标仍为 FAIL。

2026-11-09 固定覆盖续验：新增 `database-record-store-coverage.test.js`，本地真实 HTTP 验证存储记录客户端的编码、修订头、读写、导出、错误和超时；定向行 36/36、分支 35/35。工作台 HTTP 断言按当前“确认手册范围”接口文案校准。固定 137 个 Jest 文件复采 136 套件通过、1 套件条件跳过，1418 项通过、7 项跳过；Node 产品源码行 14315/16028（89.31%）、分支 13399/18183（73.68%），报告 `runtime/test-results/node-record-store-full-20261109/coverage-summary.json`。分母较前次扩大 28 行、44 分支，来自同期产品工作树变更，不能将总量差值全部归因于新测试。最近独立完整前端报告为行 6958/9979（69.72%）、分支 8104/13738（58.98%）；Java 为行 2885/3360（85.86%）、分支 1588/2178（72.91%）。三种运行时仍低于行 100%、分支 95%，尚无本轮统一全量通过结论。

2026-11-09 Agent 运行与手册往返覆盖续作：现有 Agent 隔离浏览器测试经真实 `/run-test`、SSE `/events`、状态查询和 `/cancel` 路由验证运行、取消、完成、断线恢复与页面新建 Agent；执行器为确定性内存夹具，不调用外部模型。MCP 摘要失败态由浏览器先实际请求隔离产品 API，再模拟一次 503 检查提示。`model-admin.js` 行 101/101、分支 87/116。手册返回测试保留未插桩 6 次 `<100ms` 首帧门槛，本轮独立 P95=28.9ms；插桩模式仅执行一次相同往返，并保存主页面、390px 页面、直接进入页面共 5 份计数，不以插桩耗时判断性能。固定 57 产品脚本完整采集通过，29 写作、17 任务管理页、8 我的工作页、5 手册往返页、6 平台管理页、16 审核计数齐全；行 6958/9979（69.72%）、分支 8104/13738（58.98%），较上一完整报告净增 277 行、273 分支。`app.js` 为 1905/4318 行、1525/4135 分支。证据 `runtime/test-results/frontend-handbook-agent-20261109/coverage-summary.json`。Node/Java 本轮未重采，全平台目标仍未达成。

2026-11-09 平台管理浏览器覆盖续作：`platform-model-management.test.cjs`、`platform-agent-management.test.cjs`、`platform-mcp-management.cjs` 均以本地隔离 HTTP 和真实产品 API/前端脚本运行，按 `KC_FRONTEND_ISTANBUL_CASE_DIR` 可选输出 3/1/2 个页面计数。修正模型用例已移除的写作全屏按钮断言、MCP 旧独立标签夹具，补请求头真实保存及脱敏回读、知识库失败、服务删除和折叠模型表单无效输入。三组定向插桩测试通过；固定采集器核对原 57 个产品 JS 文件白名单后完整通过，29 写作、17 任务管理页面、8 我的工作页面、6 平台管理页面、16 审核计数齐全。行 6681/9979（66.95%）、分支 7831/13738（57.00%），较上一完整固定报告净增 115 行、245 分支；`mcp-admin.js` 125/125 行、161/201 分支，`model-connection.js` 109/109 行、143/170 分支。报告 `runtime/test-results/frontend-platform-controls-20261109/coverage-summary.json`。`app.js` 的异步页面路径在两次完整采集间波动 10 行，仍须稳定化；Node、Java 本轮未重采，全平台 100% 行/95% 分支目标未达成。

2026-11-09T21:51:19+08:00 任务管理与我的工作真实 HTTP 浏览器计数接入固定前端采集：任务管理现有两级分工/导入/计划时间测试在覆盖模式保存 17 个导航快照；我的工作六个功能场景保存 8 个页面计数。所有计数经原 57 产品脚本白名单校验后合并，29 个写作与 16 个审核计数亦齐全。完整前端行 6566/9979（65.79%）、分支 7586/13738（55.21%），证据 `runtime/test-results/frontend-my-work-integrated-20261109/coverage-summary.json`；`modules/document-tasks/view.js` 为 199/211 行、352/416 分支，`modules/dashboard/my-tasks.js` 为 193/213 行、283/386 分支。未插桩的手册返回 100ms 性能场景独立通过，6 次 P95 为 32.4ms。任务管理浏览器测试临时文件移至 `runtime/test-results` 并在结束时清理。Node、Java 未在本轮重采；全平台行 100%、分支 95% 仍未达成。

2026-11-09T21:26:26+08:00 模板管理固定前端覆盖续验：补搜索输入法、元数据撤销、混合上传、目录宽度指针/键盘、弹层焦点、分析与规则失败、详情缺正文、批量确认失败及编辑器资源加载失败场景。移动端历史版本焦点循环发现折叠详情按钮被误纳入候选，控制器改为排除未展开详情；浏览器回归通过。固定 57 产品脚本、29 写作、16 审核计数齐全；前端行 6295/9979（63.08%）、分支 7136/13738（51.94%），证据 `runtime/test-results/frontend-template-all-lines-fixed2-20261109/coverage-summary.json`。`modules/templates/controller.js` 达 319/319 行（100%）、397/554 分支（71.66%）。全平台行 100%、分支 95% 仍未达成，Node/Java 本轮未重采。

2026-11-09T20:50:39+08:00 模板分析生命周期和历史恢复固定前端复采：隔离 Chromium 页面通过产品模板管理事件验证分析运行中批次、刷新同一批次、取消分析，以及 v1 历史内容先恢复为未保存草稿、再次保存才产生 v5。固定 57 产品脚本、29 写作、16 审核计数全部通过；同一分母前端行 6229/9979（62.42%）、分支 7021/13735（51.11%），比冲突与上传报告增加 9 行、20 分支。`modules/templates/controller.js` 行 260/319、分支 295/551，证据 `runtime/test-results/frontend-template-lifecycle-20261109/coverage-summary.json`。三端平台目标仍未达到。

2026-11-09T20:41:56+08:00 模板冲突与上传固定前端覆盖续验：隔离 Chromium 页面通过公开模板界面验证旧版本保存 409、远端正文对照、本地草稿保留、确认新版基线后重试，以及非法扩展名拒绝、服务端未确认入库和成功 Markdown 上传回读。完整 57 产品脚本、29 写作和 16 审核计数均通过；同一固定分母前端行 6220/9979（62.33%）、分支 7001/13735（50.97%），较上次 `frontend-template-mappings-20261109` 增加 46 行、46 分支。`modules/templates/controller.js` 行 251/319、分支 281/551。证据 `runtime/test-results/frontend-template-conflict-upload-20261109/coverage-summary.json`。Node 最近为 14274/16000 行、13343/18139 分支，Java 最近为 2885/3360 行、1588/2178 分支；三端仍未达到行 100%、分支 95% 目标。

2026-11-09T20:08:58+08:00 前端固定 Istanbul 采集器现在在每次整页导航前校验并合并当前页面计数，恢复原先丢失的大纲渲染覆盖。隔离 Chromium 页面补已发布领域建设任务、团队负责人缺失、历史责任人、回收站、资源页和平铺目录节点场景。完整采集通过：57 个产品脚本、29 个写作计数文件、16 个审核计数文件；`modules/outlines/view.js` 行 266/266（100%）、分支 391/564（69.33%）。全前端行 6031/9979（60.43%）、分支 6616/13735（48.16%），较前次固定基线增加 269 行、373 分支，证据 `runtime/test-results/frontend-outline-full-lines-20261109/coverage-summary.json`。`app.js` 的平台菜单和资产统计事件存在 10 行左右的跨次计数波动，后续需稳定该场景。Node 最近仍为 14274/16000 行、13343/18139 分支，Java 最近为 2885/3360 行、1588/2178 分支；三端目标均未达成。

2026-11-09T19:39:35+08:00 Java 迁移覆盖续验：`MigrationExecutionCheck` 在隔离进程通过公开迁移/校验入口验证 SHA-256 Provider 缺失、非法和严格摘要策略、非法历史版本标识；固定采集器增加两个策略进程。`StorageDomainReadHttpCheck` 的隔离 JDBC 行集同步当前责任域目录查询的第七列 `DOMAIN_ROLE` 并经真实 HTTP 断言投影。固定 9 个 Java 产品源码 JaCoCo 完整通过，行 2885/3360（85.86%）、分支 1588/2178（72.91%），比前次完整结果增加 3 行、3 分支，证据 `runtime/test-results/java-migration-strict-20261109/coverage-summary.json`。Node 最近固定结果仍为 14274/16000 行、13343/18139 分支；前端最近固定结果为 5762/9979 行、6243/13735 分支。三端目标仍未达成。

2026-11-09T19:30:44+08:00 `app.js` 仓库工作区加入 Chromium 页面路由和隔离 GitLab HTTP 响应场景，覆盖成功读取 Markdown、规范化路径、OAuth 要求、映射缺失与空分支正常空态。为保留连续整页导航前的 Istanbul 计数，采集器在每次导航前校验源码清单并合并当前页面原始计数。完整前端采集通过：57 个产品脚本、29 个写作计数文件、16 个审核计数文件；`app.js` 同分母行 1647/4318、分支 1314/4135，比前次增加 31 行、41 分支。全前端行 5762/9979（57.74%）、分支 6243/13735（45.45%），证据 `runtime/test-results/frontend-repository-20261109d/coverage-summary.json`。平台目标仍未达成。

2026-11-09T19:08:48+08:00 `app.js` 大纲交互矩阵已纳入固定 Chromium Istanbul 采集器并完整通过：隔离 DOM 验证节点搜索/领域/负责人筛选、分工搜索/成员筛选/批量状态、标签页切换、右键菜单、Esc 关闭和目录移动父节点禁选。固定 57 个前端产品脚本、29 个写作计数文件、16 个审核计数文件均收齐。`app.js` 同一 4318 行/4135 分支分母由 1530/1199 提升至 1616/1273；全前端为 5729/9979 行（57.41%）、6191/13735 分支（45.07%）。证据 `runtime/test-results/frontend-app-outline-20261109/coverage-summary.json`。Node 和 Java 本轮未重采，平台目标未达成。

2026-11-09T18:57:24+08:00 前端公共表格配置器加入隔离 Chromium DOM 交互和本地偏好迁移场景，完整前端 Istanbul 复采通过：57 个产品脚本、29 个写作计数文件、16 个审核计数文件。`common/table-view-configurator.js` 行 138/138（100%）、函数 57/57（100%）、分支 97/117（82.90%）；`common/searchable-combobox.js` 行仍为 182/182（100%）。全前端行 5643/9979（56.54%）、分支 6119/13735（44.55%）。分母在两次采集之间随工作区产品源码变化，不能把全量差值全部归因于本轮测试。证据 `runtime/test-results/frontend-table-view-final2-20261109/coverage-summary.json`；平台目标仍未达成。

2026-11-09T18:38:57+08:00 前端组合框在固定 Chromium Istanbul 采集器中补真实 DOM 行为矩阵，完整采集成功：57 个前端产品脚本、29 个写作计数文件、16 个审核计数文件。`common/searchable-combobox.js` 行从 100/182 升至 182/182（100%），分支从 29/125 升至 93/125（74.40%）。当前全前端行 5589/10001（55.88%）、分支 6079/14021（43.35%）；产品源码分母相对上次报告变化，不将全平台差值全部归因于本轮测试。证据 `runtime/test-results/frontend-combobox-20261109/coverage-summary.json`。Node 和 Java 本轮未重采，目标仍未达成。

2026-11-09T18:27:46+08:00 本人生成记录和 GitLab OAuth 配置/断开真实 HTTP 场景定向 Jest 分别 6/6、16/16 通过。固定 Node 精确清单复采 135 套件通过、1 套件条件跳过，1410 项通过；产品源码行 14274/16000（89.21%）、分支 13343/18139（73.56%），较前次增加 23 行、17 分支，分母未缩减。证据 `runtime/test-results/node-generations-oauth-full/coverage-summary.json`。前端与 Java 尚未重采，平台目标未达成。

2026-11-09 前端写作采集恢复：对话界面采用新的历史轮次结构和默认关闭的反馈/删除弹窗后，更新 `production-writing.test.cjs` 的相应浏览器断言；定向 4/4、完整套件 29 通过/2 条条件跳过。固定 Istanbul 采集器通过，57 个前端脚本行 5398/9878（54.64%）、分支 5801/13534（42.86%），见 `runtime/test-results/frontend-goal-20261109b/coverage-summary.json`。文档生产 E2E 两处旧断言已按延迟来源加载、返回链接和 MCP 预设提示更新，隔离 `test_hy` Chromium 各 1/1 通过；覆盖率目标仍未达成。

2026-11-09 大纲候选与治理真实 HTTP 覆盖续验：`outline-route-boundaries-http.test.js` 新增候选编辑/预检/版本发布及治理分工保存/发布场景，覆盖缺失对象、版本冲突、缺少分工和成功持久化回读；定向 Jest 10/10 通过。统一全量复采 75/78 任务通过，Node 行 14065/15981、分支 13028/18095，Java 行 2882/3360、分支 1585/2178；前端采集失败，三端目标仍未达成。见 [测试报告设计](TEST_REPORT_DESIGN.md) 和 `runtime/test-reports/2026-11-09/20261109-095753-972673-full/report.md`。

2026-11-06T00:45:11+08:00 全平台固定覆盖率复采：运行 `python3 tests/run_tests.py full --coverage --jobs 1 --timeout 1800`，Node 154 个产品源码行 13805/15936（86.62%）、分支 12721/18043（70.50%）；浏览器脚本 56 个产品源码行 5318/9786（54.34%）、分支 5756/13460（42.76%）；Java 9 个产品源码行 2882/3360（85.77%）、分支 1585/2178（72.77%）。统一任务 76/78 成功，用例 2344 通过、16 失败、39 跳过，门禁 FAIL。新增 `error-handler-coverage.test.js` 定向 6/6 通过，在完整 Node 报告中 `error-handler.js` 行 20/20、分支 23/23；先前新增的 `comparator-agent.js`、`office-renderer.js`、`search-index.js` 也维持行/分支 100%。完整报告 `runtime/test-reports/2026-11-06/20261106-001522-154470-full/report.md`。三端均未达 100% 行、95% 分支目标。

2026-11-06T00:12:00+08:00 历史 Node 固定复采：按统一入口自动发现构造固定 130 个 Jest 文件清单，行 13792/15936（86.54%）、分支 12698/18043（70.37%），全部套件通过。证据 `runtime/test-results/node-full-coverage-20261106/coverage/coverage-summary.json`。新增 ComparatorAgent 及预处理抽象契约测试，定向 2 套件、18 项全部通过；`comparator-agent.js`、`office-renderer.js`、`search-index.js` 行/分支均为 100%。该记录已被上方完整三端复采取代。

2026-11-05T23:20:12+08:00 全平台固定覆盖率复采：运行 `python3 tests/run_tests.py full --coverage --jobs 1 --timeout 1800`，固定 Node 154 个、浏览器脚本 56 个、Java 9 个产品源码进入分母。Node 行 13765/15936（86.37%）、分支 12676/18043（70.25%）；浏览器脚本行 5320/9786（54.36%）、分支 5754/13460（42.74%）；Java 行 2882/3360（85.77%）、分支 1585/2178（72.77%）。统一运行 76/78 任务成功，E2E 两组 Playwright 有 19 个失败，最终门禁 FAIL。报告 `runtime/test-reports/2026-11-05/20261105-232012-294204-full/report.md`。当前最低 Node 文件为 `document-classifier.js`（16.66%）、`document-filter.js`（16.66%）、`comparator-agent.js`（23.52%）、`office-renderer.js`（33.33%）和 `search-index.js`（33.33%）；全平台目标未达成。

2026-11-06T00:00:32+08:00 覆盖率续作：`preprocessing/vector-and-graph-index.test.js` 新增 `DocumentClassifier`、`DocumentFilter` 抽象方法拒绝及批量异步委托场景，两份契约源码定向覆盖均为行/分支 100%，套件 9/9 通过。按固定隔离入口复跑 `knowledge-center-handbook-workspace.spec.js`：13 通过、4 条显式条件跳过、0 最终失败；Firefox 草稿保存首次等待超时、自动重试通过，仍标记 flaky。排序标记断言按实际界面文本 `01` 与 `aria-label="优先级 1"` 修正，Chromium/Firefox 场景通过。证据 `runtime/test-results/e2e-targeted/20261105-235747-096118-e2e-targeted/details/tasks/targeted-handbook-workspace.log`。全平台三运行时尚未重采，此记录不代表总目标达成。

2026-11-05T07:16:49-08:00 Node 基础契约与模型输出解析覆盖补充：扩展 `preprocessing/vector-and-graph-index.test.js`，在固定 Jest/Istanbul 进程内逐项断言 `GraphStore`、`VectorStore` 未实现方法的明确错误，验证 `EmbeddingProvider` getter、单条/批量异常、子类批量委托与空列表，并覆盖模板匹配输出的普通 JSON、信封、代码围栏、语法错误和字段类型边界。定向 Jest 8/8 通过；完整 Node 及三端覆盖率尚待复采，不能据此宣称目标达成。

2026-11-05 22:44 Java 启动契约覆盖续验：新增 `StorageBootstrapContractCheck.java` 并纳入固定 JaCoCo 采集器，直接验证未知/多余启动参数拒绝、必填环境变量缺失、环境变量默认值回退、整数解析成功及失败；不启动服务、不连接数据库。固定 9 个 Java 产品源码完整采集通过，行 2882/3360（85.77%）、分支 1585/2178（72.77%），较本轮生命周期报告增加 4 行、8 分支，证据 `runtime/test-results/java-bootstrap-coverage/coverage-summary.json`。Node 最近完整结果仍为 13739/15936 行、12667/18043 分支；前端为 5320/9786 行、5754/13460 分支，本轮未重采。全平台目标仍未达成。

2026-11-05 22:40 Java 大纲生命周期 HTTP 覆盖续验：扩展 `StorageDomainReadHttpCheck.java`，复用实际大纲路由和隔离 JDBC 行集，覆盖候选版本清除预检、缺少确认、删除幂等、关联引用阻断、恢复幂等、彻底清除及子节点清理；再验证当前已发布版本删除时清空指针、恢复冲突不覆盖新指针、冲突解除后恢复原指针，并覆盖生命周期路由的非法方法和非法 JSON。固定 9 个 Java 产品源文件完整 JaCoCo 通过，行为 2878/3360（85.65%）、分支 1577/2178（72.41%），较 `java-outline-candidate` 增加 81 行、71 分支；证据 `runtime/test-results/java-outline-lifecycle-current/coverage-summary.json`。Node 最近完整结果仍为 13739/15936 行、12667/18043 分支；前端为 5320/9786 行、5754/13460 分支，本轮未重采。三运行时目标仍未达成。

2026-11-05 22:18 Java 迁移记录竞态续验：扩展 `MigrationExecutionCheck.java` 的隔离 JDBC 状态机，通过公开 `SchemaMigrationManager.migrate` 验证执行 SQL 后另一连接先写入相同版本记录时，相同摘要不重复 INSERT 且正常提交，冲突摘要拒绝并回滚；记录 INSERT 失败也回滚且不提交。固定 9 个产品源文件 JaCoCo 完整通过，行 2535/3360（75.45%）、分支 1407/2178（64.60%），较前次增加 6 行、5 分支，证据 `runtime/test-results/java-migration-record-race/coverage-summary.json`。Node 最近完整结果为 13739/15936 行、12667/18043 分支，前端为 5320/9786 行、5754/13460 分支，均未在本轮重采；三运行时整体目标仍未达成。

2026-11-05 大纲领域任务与提示词生成 HTTP 覆盖续验：扩充 `outline-route-boundaries-http.test.js`，以隔离文件仓库和真实 Express HTTP 验证技术领域、建设任务列表/详情、页面负责人指派与清空，以及旧版知识点和新版路径节点的提示词生成、参数错误和合并输出；运行根调整到 `runtime/test-results`。定向 7/7 通过；固定 121 个 Jest 文件中 120 套件通过、1 套件条件跳过，1259 项通过、7 项跳过，Node 行 13018/15848（82.14%）、分支 11724/18010（65.09%），`outline.js` 为 386/528 行、347/668 分支，证据 `runtime/test-results/node-outline-domain-prompts-full/coverage-summary.json`。本轮另重采完整前端 56 个产品脚本：5067/9788 行（51.76%）、5505/13504 分支（40.76%），见 `runtime/test-results/frontend-current-goal/coverage-summary.json`；Java 固定 9 文件为 1908/3360 行（56.79%）、1122/2178 分支（51.52%），见 `runtime/test-results/java-current-goal/coverage-summary.json`。三运行时均未达标；前端 `app.js` 缺 3017 行，Java `Main.java` 缺 1399 行，继续作为主要缺口。

2026-11-05 文档路径管理真实 HTTP 续验：扩充 `document-route-coverage.test.js`，通过隔离配置根验证新增路径的必填、目录、相对路径、缺省只读/显式可写、缺失与非数组配置、删除及非法 JSON 错误恢复，定向 12/12 通过。固定清单初次复采发现审核工作台测试仍按单任务预期 MR 动作，而实际接口按两篇文档分别返回；修正 `review-workbench-contract.test.js` 为逐文档 ID 和链接断言，定向 23/23 通过。随后固定 121 个 Jest 文件完整通过：120 套件通过、1 套件条件跳过，1257 项通过、7 项跳过；固定 Node 产品源码行 12916/15823（81.62%）、分支 11593/17788（65.17%），`document.js` 为 556/598 行、338/418 分支，证据 `runtime/test-results/node-document-paths-retry/coverage-summary.json`。前端和 Java 未重采，全平台目标仍未达标。

2026-11-05 检索代理覆盖续验：新增 `retriever-agent-coverage.test.js`，以确定性 MCP 和文件读取替身验证混合成功/失败、整体工具故障、无工具回退、提示词投影和先检索后模型调用。定向 5/5 通过，`retriever-agent.js` 为 70/70 行、38/38 分支。固定 121 个 Jest 文件完整执行：120 套件通过、1 套件条件跳过，1255 项通过、7 项跳过；当前 152 个 Node 产品文件行 12924/15835（81.61%）、分支 11673/18374（63.52%），证据 `runtime/test-results/node-retriever-full/coverage-summary.json`。本轮产品源码分母同时增加，不能用总百分比直接表示测试净增；前端与 Java 未重采，三运行时目标仍未达标。

2026-11-05 直写执行日志与元数据降级续验：新增 `direct-execution-log-coverage.test.js`，使用内存写入替身验证任务 ID 文件名清理、完整字段、缺省回退和参考列表；该产品模块达到 8/8 行、14/14 分支。前一轮文档元数据损坏/恢复与缺失配置路径已纳入完整采集。最新固定 120 个 Jest 文件中 119 套件通过、1 套件条件跳过，1250 项通过、7 项跳过；固定 152 个 Node 产品文件行 12817/15746（81.39%）、分支 11501/17679（65.05%），证据 `runtime/test-results/node-execution-log-full/coverage-summary.json`。`routes/document.js` 为 553/598 行、332/418 分支。前端和 Java 未在本轮重采，三运行时目标仍未达标。

网页来源稳定回归位于 `tests/unit/agent-runner/production-web-reference.test.cjs` 和 `handbook-production-api.test.js`：本地 HTTP 夹具以模拟公网 DNS 和受控传输覆盖真实解析链路，不放宽产品私网拦截；包含验证页、动态页面、大小限制、历史坏快照、真实来源 API 无快照入库及前端本地文档替代提示。第三方联网抽样只记录兼容性，不作为稳定门禁。

`tests/unit/agent-runner/knowledge-center-workbench-preview.test.cjs` 通过隔离真实 HTTP 验证工作台责任人预览、统一查询权限、嵌套过滤、分页和部分来源；`tests/unit/agent-runner/knowledge-center-workbench-http-coverage.test.js` 验证 MR 创建、合入与同步动作的角色边界及当前操作者发布权限；`tests/unit/agent-runner/workbench-query.test.js` 验证条件树与计数；`tests/e2e/agent-runner/knowledge-center-my-work.node.test.cjs` 验证桌面及 390px 的六列表格、等待队列、同步按钮、URL 恢复、管理员代办、禁用合入动作无法跳转，以及详情的 MR 关闭去重、同步失败、长路径折叠和无值字段隐藏。详情截图在 `runtime/test-results/workbench-optimization-20261105/detail-desktop.png` 和 `detail-mobile.png`。百万工单索引读模型与并发压测仍未完成。

工作台责任人 HTTP 回归还验证旧账号 userId/loginName 投影和缺失身份标识的过滤；覆盖缺失 ID 被先字符串化为 "undefined" 的数据边界。

2026-11-04 覆盖率目标核对：知识中心管理平台目标为行覆盖率 100%、分支覆盖率 95%。当前 Jest 分类入口识别 107 个测试文件；本次基线运行 106 个套件（1 个跳过），101 通过、5 失败，1087 项测试通过、6 项失败、7 项跳过。Jest 仅采集执行到的 145 个文件，行 11780/15332（76.83%）、分支 10332/17044（60.61%）；这些数字不包含未执行的产品源码、前端浏览器脚本或 Java 存储服务，因此不能当作全平台达标判据。基线原始结果在 `runtime/coverage-goal-baseline.log` 和 `tests/unit/agent-runner/runtime/coverage-goal-baseline/coverage-summary.json`。新增 `agent-governance-coverage.test.js` 针对 Agent 配置版本、校验、默认回退、模型选择和隔离保存的回归；该模块定向采集行 86/86（100%）、分支 117/149（78.52%），仍未达到模块分支目标；对应隔离真实 HTTP 回归 `platform-agent-management.test.cjs` 1/1 通过。详见 [测试报告设计](TEST_REPORT_DESIGN.md)。

覆盖率持续建设（2026-11-05）：前端增加 Istanbul 行/分支采集器 `tools/repository/collect-frontend-istanbul-coverage.cjs`，以真实隔离前端 HTTP 服务登录并导航各管理模块；56 个非 vendor JS 进入分母，首轮行 2068/9612（21.51%）、分支 1719/13248（12.97%），53 个文件被执行。前端未覆盖的主要是生产写作、审核、平台模型/MCP 和仓库详情的深层交互。原始报告 `runtime/coverage-goal/frontend/coverage-summary.json`，浏览器采集不是业务全流程验收。

2026-11-05 前端采集扩展：在同一真实浏览器会话中逐项验证模板、任务管理、文档生产和平台管理的页签活动状态，并打开/关闭资料上传弹窗。固定 56 个产品 JS 文件，行 2522/9637（26.16%）、分支 2363/13282（17.79%）；相对上一轮 2163/9637 行、1902/13282 分支分别增加 359 行和 461 个分支。报告 `runtime/coverage-goal/frontend-expanded/coverage-summary.json`。写作、审核等依赖业务数据的深层路径仍需独立场景，前端及平台总门禁均未达标。

2026-11-05 写作浏览器覆盖率续作：前端采集器复用 `production-writing.test.cjs` 的真实 Chromium、隔离 HTTP 和内存草稿场景，按测试上下文保存 Istanbul 计数并核对固定源码清单后合并。动态 `about:blank` 图片预览在注入模式下资源请求停滞，采集器先运行无注入图片渲染用例，注入模式另检查同一真实图片 API 的类型与内容；两种模式任一失败则拒绝汇总。本轮 28 个非条件场景计数通过，56 个产品 JS 行 3795/9637（39.37%）、分支 3379/13282（25.44%），较前一轮增加 1273 行、1016 个分支；`production-writing-page.js` 贡献 1117 行、857 个分支。报告 `runtime/coverage-goal/frontend-writing-expanded/coverage-summary.json`。真实模型条件用例不作为自动采集前提，审核、仓库详情及其他深层流程仍有缺口，三运行时总目标未达标。

2026-11-05 审核工作台覆盖率续作：前端采集器增加隔离审核真实 HTTP/Chromium 的 8 个 Playwright 场景，使用临时 chromium-only 配置避开共享环境守卫；每次跨页 navigation 将 Istanbul 计数暂存 sessionStorage，夹具关闭时导出，再按固定 56 文件清单累加合并。8/8 审核场景通过，和 28 个写作场景及主导航采集一起汇总后，行 4292/9637（44.53%）、分支 4144/13282（31.20%）；相对写作采集增加 497 行、765 分支，审核视图增加 173 行、409 分支，app.js 增加 169 行、146 分支。报告 `runtime/coverage-goal/frontend-review-expanded/coverage-summary.json`。审核锚点/MR 参与人、生产质量对话框、手册视图和若干 API 客户端仍未触达，Node/Java 及平台总目标继续未达标。

2026-11-05 审核锚点覆盖率续作：在隔离审核工作台增加真实 DOM 锚点场景，断言重复文本上下文消歧、Markdown 多节点选区、代码/表格定位、高亮、旧行号回退、删除操作映射及未匹配路径。插桩时 pagehide 只注册一个监听器，避免多个 fixture 重复序列化覆盖对象；第 5 个复杂场景只在覆盖模式将超时由 60 秒延长至 180 秒，常规运行门槛不变；代理 fixture 为未支持的认证和权限代理路径明确返回隔离 404。完整采集 28 个写作和 9 个审核 Chromium 场景通过，固定 56 个前端 JS 行 4363/9637（45.27%）、分支 4260/13282（32.07%），较上一基线增加 71 行、116 分支；`anchors.js` 的探针为语句 68/77、分支 56/77。报告 `runtime/coverage-goal/frontend-review-anchor-expanded/coverage-summary.json`。目标仍未达成。

2026-11-05 生产质量报告弹窗覆盖率续作：审核工作台增加真实 Chromium DOM + 隔离 HTTP 质量报告场景，执行内容检查开关、成功报告渲染（检查项、引用、限制、能力记录）、HTTP 503 后保留旧报告、复测关联字段、JSON 下载及关闭焦点恢复。定向探针 `production-quality-dialog.js` 行语句 97/101、分支 30/52；完整采集写作 28、审核 10 场景全部通过。固定 56 个前端 JS 行 4425/9637（45.91%）、分支 4274/13282（32.17%），相对锚点基线增加 62 行、14 分支。报告 `runtime/coverage-goal/frontend-quality-dialog-expanded/coverage-summary.json`。其余前端缺口仍大，Node 和 Java 最近基线也远低于目标。

2026-11-05 Node 质量门禁覆盖续作：新增 `quality-gates-coverage.test.js`，覆盖质量配置解包/直通和回退、四类门禁的成功失败、重试与未知类型边界。定向 Jest 5/5 通过，`quality-gates/index.js` 行 65/65、分支 52/52。固定 114 个 Jest 文件全量通过 113 个、1 个跳过；1118 项通过、7 项跳过。Node 固定 152 个产品文件行 12090/15649（77.25%）、分支 10635/17319（61.40%），见 `runtime/coverage-goal/node-quality-expanded/coverage-summary.json`，相比前一全量报告分别增加 65 行和 52 分支。Node 目标仍未达标。

2026-11-05 Java 存储 HTTP 输入边界续作：新增 `StorageHttpInputCheck.java`，通过产品 `Main.register` 和真实本地 HTTP 服务运行健康检查、记录路径/大小/JSON/revision、人员编号、任务路径、rowVersion 与幂等键等 33 个请求场景；健康检查连接隔离 JDBC 替身。全部检查通过后，固定 9 个产品源码行 1339/3360（39.85%）、分支 854/2178（39.21%），较上轮分别增加 212 行和 161 分支，报告 `runtime/coverage-goal/java-http-routes-expanded/coverage-summary.json`。`Main.java` 仍有 1967 行未覆盖，数据库业务事务与三个运行时总目标均未达标。

2026-11-05 前端覆盖续作最新汇总：审核隔离 Chromium 增加手册生产投影、仪表盘、AI 写作兼容入口、MR 参与人以及 SHA-256/数据变更/资料加工 API 场景；写作 28、审核 12 场景全部通过，固定 56 个产品 JS 行 4772/9637（49.51%）、分支 4768/13282（35.89%）。报告 `runtime/coverage-goal/frontend-utility-modules-expanded/coverage-summary.json`。此结果仍远低于目标。

2026-11-05 生产视图覆盖续作：审核隔离 Chromium 增加 1 个 `production/view.js` 投影矩阵场景，检查任务五阶段、审核/发布门禁、GitLab 回读、手册与业务版本汇总、生成记录和异常输入；创建对话框、任务状态、可见行和转义输出以真实 DOM 断言。手册标识规范化辅助函数用于实际列表投影；缺失 ID 的资产行被忽略。该文件定向行 182/182（100%）、分支 582/603（96.51%）。完整采集写作 28、审核 13 场景通过；固定 56 个产品 JS 行 4881/9637（50.64%）、分支 5225/13279（39.34%），见 `runtime/coverage-goal/frontend-production-view-expanded/coverage-summary.json`。前端及三个运行时总目标仍未达标；相较前一报告，行分母仍为 9637，分支分母由 13282 变为 13279，因为手册标识 fallback 改为调用已有规范化 helper，固定源码清单仍为 56 个文件，报告以当前源码版本为准。

2026-11-05 仓库阅读器覆盖续作：审核隔离 Chromium 加入 GitLab 只读仓库阅读器状态及安全 Markdown DOM 场景，验证 OAuth、权限/映射/连接/服务错误、管理员入口、目录/分支/语言、标题锚点、相对链接、图片、表格、代码围栏和危险协议转义。定向 `repository/view.js` 行 155/155（100%）、分支 262/275（95.27%）。写作 28、审核 14 场景通过的完整固定 56 文件前端报告为 5029/9637 行（52.18%）、5485/13279 分支（41.30%），见 `runtime/coverage-goal/frontend-repository-view-expanded/coverage-summary.json`。此报告是当前工作树后续新增产品脚本之前的历史截面，最新计数见文末“全平台固定分母覆盖率目标续作”。

同日 Java 基线：使用现有 JaCoCo 0.8.12 工具，产品类与测试夹具分别编译，运行两个无真实数据库的现有回归；9 个产品源码行 44/3360（1.31%）、分支 31/2178（1.42%）。原始报告在 `runtime/coverage-goal/java/product.xml` 和 `runtime/coverage-goal/java/product-html/`。这只是 Java 初始采样，不等于全部 Java 测试已覆盖，也不连接真实数据库。

Java 采集器 `tools/repository/collect-java-coverage.py` 现将上述两项和 `QualityExecuteHttpCheck` 五种真实本地 HTTP/JDBC 替身场景合并采集，9 个产品源码行 249/3360（7.41%）、分支 120/2178（5.51%）。原始报告在 `runtime/coverage-goal/java-full/java.xml` 与 `runtime/coverage-goal/java-full/coverage-summary.json`。统一入口 `full/all --coverage` 已接入 Java 独立计数与目标；所需 JaCoCo agent/CLI 默认从 `runtime/test-results/quality-fix-coverage/tools` 读取，也可用 `KC_JACOCO_TOOLS` 指定。缺少工具时采集失败，不能宣称 Java 达标。

最新全量 Node 产品源码为 152 个文件，行 12002/15649（76.69%）、分支 10555/17319（60.94%），相对旧基线分别增加 127 行和 87 个分支；原始结果 `runtime/coverage-goal-all-node-latest.log` 与 `runtime/coverage-goal-all-node-latest/coverage-summary.json`。113 个 Jest 文件中 107 个套件通过、5 个失败、1 个跳过；失败仍为构建契约、大纲前端、滚动契约、默认 MCP 浏览器及性能门禁。统一入口 `full/all --coverage` 执行 Node Jest、前端 Istanbul 和 Java JaCoCo 三类采集，读取 `config/knowledge-center/coverage-targets.json`，报告各自分子、分母并判定门禁。当前三个运行时均未达标。

2026-11-05 再验证：上述五类失败均已按当前设计和实际浏览器行为修正测试契约；完整 Jest 采集 112 个套件通过、1 个跳过，1110 项测试通过、7 项跳过。152 个 Node 产品文件行 12002/15649（76.69%）、分支 10566/17319（61.00%），原始结果 `runtime/coverage-goal-all-node-recheck.log` 与 `runtime/coverage-goal-all-node-recheck/coverage-summary.json`。随后补的 DOCX Worker 回归及分支测试尚未进入该全量采集。前端采集器现要求九个导航入口实际激活；当前工作树 56 文件行 2163/9637（22.44%）、分支 1902/13282（14.32%），见 `runtime/coverage-goal/frontend/coverage-summary.json`。仍远低于目标。

全量 Node 报告后又补充定向分支回归：`retrieval-service.js` 行 37/37、分支 13/13；`synonym-expander.js` 行 37/37、分支 15/15；`mcp-bridge.js` 行全覆盖、分支 36/37（97.29%）。这些结果来自定向 Jest 报告，尚未重采全量分母，不代替上述平台基线。

上传解析 Worker 的 Jest 计数补验：真实 Worker 回归继续验证隔离、超时和 DOCX 转换；另在 Jest 隔离模块中用 Worker 上下文执行相同解析分支，使父线程 Istanbul 能记录文本、PDF、DOCX 的行与分支。定向 5/5 通过，`production-ai-upload-parser.js` 行 36/42（85.71%）、分支 24/36（66.67%），见 `runtime/coverage-goal-upload-worker/coverage-summary.json`。该模块尚未达标，三运行时总目标仍未达成；全量 Node 结果须以本次复跑后的报告为准。

2026-11-05 10:00 全量 Jest 再采集退出码 0，固定的 152 个 Node 产品文件行 12025/15649（76.84%）、分支 10583/17319（61.10%），见 `runtime/coverage-goal-all-node-worker-recheck/coverage-summary.json`。距行目标尚缺 3624 行，距 95% 分支目标至少缺 5871 个分支；前端最近基线 2163/9637 行、1902/13282 分支，Java 最近基线 249/3360 行、120/2178 分支，均未达标。当前全量采集只重跑 Jest，不能充作三运行时完整门禁通过。

2026-11-05 10:03 Java JaCoCo 复用四个已有隔离检查后，9 个产品源码行 543/3360（16.16%）、分支 301/2178（13.82%），采集器 11 个运行场景全部通过；原始报告 `runtime/coverage-goal/java-expanded/java.xml` 和 `coverage-summary.json`。`OutlineStorageContractCheck` 的 501 篇输入由仓库 XLSX 解析器生成，连接池、CLOB 和来源变更场景均使用本地 JDBC 替身；要求真实 `test_hy` 的 `ProductionReferenceJdbcCheck` 未纳入自动门禁。认证、GitLab 配置、人员及迁移类仍基本未执行，目标未达成。

2026-11-05 10:10 继续加入迁移 SQL 分句、迁移执行和索引 DDL 的隔离检查后，Java 采集器 14 个场景通过，9 个产品源码行 668/3360（19.88%）、分支 400/2178（18.37%）。`SchemaMigrationManager.java` 达到行 118/171、分支 93/136；`StorageSchemaDao.java` 行 12/12、分支 6/8。最新证据覆盖同一路径 `runtime/coverage-goal/java-expanded/`，此前 10:03 数字为中间结果。四个仓储类及 `Main.java` 仍有主要缺口，不能据此通过平台总门禁。

2026-11-05 10:21 Java 继续加入手册列表与人员目录的内存 JDBC 行集检查，16 个场景全部通过，9 个产品源码行 846/3360（25.18%）、分支 522/2178（23.97%），最新报告仍位于 `runtime/coverage-goal/java-expanded/`，上述 10:10 数字为中间结果。`HandbookProjectionRepository.java` 达到行 22/22、分支 6/6；`PrincipalRepository.java` 达到行 158/158、分支 116/122（95.08%）。人员测试覆盖筛选、CAS 绑定、重复同步、导入、歧义、版本与插入失败；测试夹具不连接真实数据库。`Main.java`、认证与 GitLab 配置仓储仍大面积缺测，全平台目标未达成。

2026-11-05 10:28 认证仓储增加隔离 JDBC 行集检查后，17 个 Java 采集场景全部通过，9 个产品源码行 973/3360（28.96%）、分支 596/2178（27.36%），见 `runtime/coverage-goal/java-expanded/`；上述 10:21 数字为中间结果。`PlatformAuthRepository.java` 行 128/128、分支 74/76（97.37%），覆盖 CAS 身份绑定、默认角色、模块/操作授权投影、重复同步、角色替换、非法角色及版本冲突。当前 `Main.java` 与 GitLab 配置仓储仍有主要缺口，Node/前端独立门禁也未达标。

2026-11-05 10:36 GitLab 配置仓储加入隔离 JDBC 行集检查后，18 个 Java 采集场景全部通过，9 个产品源码行 1127/3360（33.54%）、分支 693/2178（31.82%），最新报告仍在 `runtime/coverage-goal/java-expanded/`；上述 10:28 数字为中间结果。`PlatformGitLabRepository.java` 行 155/155、分支 97/102（95.10%），覆盖连接新增/更新、状态、版本、映射分支与路径回读及 SHA-256 不可用异常。隔离真实 HTTP 的 GitLab 连接保存契约 4/4 通过。`Main.java` 仍是 Java 最大缺口；Node 和前端独立目标也尚未达成。

Agent 管理回归 `node --test tests/e2e/agent-runner/platform-agent-management.test.cjs` 覆盖真实隔离 HTTP、设置页多桌面尺寸首屏几何、窄屏溢出、模型与 MCP 面板关闭及局部保存、Agent 保存回读；另验证旧配置自动补入默认 DSH、沿用原默认项、未就绪提示、不能设为默认、服务端拒绝试运行及 DSH 桌面/窄屏渲染。DSH 预检单测位于 `tests/unit/agent-runner/dsh-runner.test.js`，覆盖运行时/SDK 版本及隔离条件缺失时 fail closed。真实 SDK 和模型调用不由这些隔离测试代替。

质量检查隔离修复的覆盖率回归：`yashandb-quality-adapter.test.js` 使用本地真实 HTTP 服务验证适配器请求、凭据边界和版本来源；`outline-storage-java.test.js` 的 `QualityExecuteHttpCheck` 使用真实 Java HTTP 端点与 JDBC 替身验证独立连接、只读标记、SQL 拒绝、异常和结果上限。设置 `QUALITY_JACOCO_DIR="$PWD/runtime/test-results/quality-fix-coverage"` 后运行对应 Jest 用例，会用该目录下的 JaCoCo 0.8.12 agent/CLI 生成 `java.xml`、HTML 和 `java-summary.json`，并对 `Main.qualityExecute`、`Main.qualityResult` 的指令、行、分支覆盖率分别执行 90% 门禁。Java 覆盖率限定为这两个变更方法，JDBC 替身不代表真实 YashanDB 集成验收。

Jest 桥接文件即使模拟 `node:test` 也由 Jest 执行，统一入口优先识别显式 `jest.*` API。`frontend-coverage-summary.test.js` 看护 V8 嵌套区间去重和未执行分支扣除；采集器保留原始偏移量，范围覆盖率不能当作行覆盖率。具体计算约束见 [测试报告设计](TEST_REPORT_DESIGN.md)。

审核工作台回归覆盖真实 HTTP 改派审核人、个人待办转移、误提任务终止及审计保留；浏览器用例覆盖文档清单弹窗操作。写入型 E2E 使用 `python3 tests/run_tests.py e2e` 的隔离实例，不对共享审核任务执行改派或终止。

审核工作台真实 HTTP 回归还覆盖人员 ID 到审核人姓名的解析、实际决定者展示，及旧原文在线审核送审与旧任务发布均返回 `GITLAB_NO_CHANGES` 且保留历史。新在线评审的已保存修改稿由隔离 HTTP 和浏览器验证送审、审核与 MR 提交；无差异新稿在送审时返回 `GITLAB_NO_CHANGES` 且不创建任务，历史已审核任务保持原状态。

审核工作台回归由 `review-workbench-contract.test.js` 和 `knowledge-center-review-workbench.spec.js` 看护：阶段与权限过滤、明确指派、自审资格、冻结正文、整册聚合评审、文档与路径配对、共享候选、失败重试、下一篇及返回筛选。“我的审核”指派人列显示提交指派者；审核人姓名在文档清单核对。覆盖率模式另外运行手册生产视图的隔离 DOM 投影，以及仪表盘任务摘要、AI 写作兼容入口和 MR 参与人选择场景；验证目录、草稿/审核状态、领域任务状态、人员映射成功/不完整/失败和弹窗关闭。小型浏览器工具场景也验证 SHA-256 双实现、数据变更事件订阅和资料加工 API 上传请求。计数文件纳入审核工作台固定套件计数。契约测试真实调用隔离 HTTP 后端；浏览器使用独立内存仓储和 GitLab 只读测试服务，在 Chromium/Firefox 验证，不提交真实 GitLab MR。原 `knowledge-center-review-publishing.spec.js` 继续看护评论、发布及响应式历史功能。性能门禁分别测量默认手册工作台与显式阅读入口，并检查工作台不提前请求仓库正文。

隔离 HTTP 的 `handbook-incremental-review.test.js` 使用真实网关与模拟 GitLab 回读项目、源分支、目标分支、MR IID 和 changes，同时覆盖无差异任务保留、目标提交漂移及失败重试。真实 GitLab 验收还须在已授权的读写连接和映射测试文档上回读相同事实，候选必须有非空差异。当前送审契约只产生 create/update 文件动作；删除文档不计入本轮验收。

托管图片交付回归：`node --test tests/unit/agent-runner/gitlab-managed-resource-delivery.test.js tests/unit/agent-runner/handbook-incremental-review.test.js`。新增套件通过真实本地生产 HTTP handler 和 GitLab HTTP 替身，覆盖上传/保存/来源权限/送审/审核/发布/模拟合并后回读，服务端冻结抵御客户端伪造、同源任务重放、原文件删除、冻结快照缺失/损坏，以及共享图片去重和提交响应丢失后的幂等恢复。检查失败时保留已审核状态且无远端写入。HTML/Markdown 改写保留代码示例及周围正文。测试入口按 `node:test` 自动分类，不交给 Jest；不是数据库模式、共享13510实例或企业 GitLab 验收。

现有送审浏览器回归显式使用 `HANDBOOK_BROWSER_CHECK=1 node --test tests/unit/agent-runner/handbook-incremental-review.test.js`；它验证本地 Chromium 的保存与送审/审核入口，不覆盖本次托管图片拖拽上传 UI 或实际企业合并。两类证据分别记录，不能把 HTTP 流程表述为图片浏览器端到端通过。

`outline-import-api.test.js` 使用隔离文件仓储和真实 HTTP，覆盖自然路径候选内容说明保存、清空、目录保存后的投影一致性，以及非法节点拒绝。`outline-natural-path.test.js` 直接读取受版本控制的 `knowledge/outlines/SQL参考手册大纲示例.xlsx` 校验 501 篇文档的路径、顺序、说明、领域和任务，不依赖本地 `documents/` 源文件。

`outline-detail-performance.test.js` 验证大纲详情的 catalog 快速路径、候选/空手册/不存在/失败状态，以及隔离真实 HTTP 精简与完整响应兼容、异步 Storage 等待不阻塞 Worker。`knowledge-center-outlines-layout.spec.js` 验证 SQL 参考手册加载提示和领域任务延迟时的首屏可用性，页面测试只读，不修改已有大纲。空手册用例还验证模板填写说明关闭后焦点返回入口；工作台主滚动用例先在页面内制造足够内容，再检查侧栏固定与右侧独立滚动，避免依赖当天业务数据量。

大纲页面回归还覆盖导入面板的外部点击与 Esc 收起、内部交互不误关、选中文件保留及收起期间真实校验请求继续完成；包含桌面和窄屏。校验不创建候选，测试不提交真实导入。

`tests/unit/agent-runner/knowledge-center-close-controls.test.js` 检查知识中心及同源独立工作台关闭 X 的图标来源、可访问名称和公共样式边界；实际尺寸与颜色仍需在浏览器计算样式中复核。

`gitlab-oauth.test.js` 看护 OAuth 授权、令牌与刷新流程，以及 HTTP 开关的新旧兼容、RFC1918 私网边界、默认 HTTPS、公网 HTTP 和其他协议拒绝。

`gitlab-oauth-store-boundaries.test.js` 看护生产密钥缺失、开发回退、旧凭据存储结构、加密记录更新/删除和损坏密文拒绝；使用隔离内存聚合仓储，不访问真实 GitLab 账号。定向覆盖只用于确认该模块增量，正式平台覆盖率仍按完整固定清单验收。

GitLab 验证由 `gitlab-verification-database-http.test.js` 通过真实 HTTP 看护数据库模式结果持久化、服务重建、配置变化失效与运行时不可写反馈；数据库配置读取使用隔离内存适配器，不访问共享数据库。`knowledge-center-gitlab.spec.js` 补充列表缺少持久结果时仍展示本次成功或失败修复建议的浏览器回归。

`knowledge-center-gitlab-view.test.js` 看护只读/读写配置术语及读取验证结果不冒充写入能力；实际 MR 写回仍需远端文件映射契约确认后补充真实 HTTP 和隔离 GitLab 验收。

`gitlab-connection-save-http.test.js` 用真实网关 HTTP 请求和隔离数据库适配器看护新增默认分支、完整项目 URL 规范化、内部字段默认值、编辑版本和路径不一致错误；`knowledge-center-gitlab-view.test.js` 同时看护表单字段与认证身份说明。

`tests/run_tests.py` 是主仓库对开发者和持续集成系统公开的统一测试入口。新增符合命名约定的 Jest、独立 Node 脚本、Python unittest、pytest、独立 Python 脚本和 Playwright 用例后，入口会自动发现；只有刻意控制在较短时间内的冒烟集需要维护脚本中的 `SMOKE_FILES`。

`knowledge-center-outline-delete-candidate.spec.js` 在隔离 `test_hy` 中验证已发布大纲的逻辑删除、历史保留、恢复冲突、删除后生产禁写和引用阻断，并通过 Chromium/Firefox 页面完成候选回收站恢复与超级管理员精确 ID 确认清理，回读独立审计。测试排除 C驱动参考手册 DB-007，不修改共享业务数据。`knowledge-center-permissions-view.test.js` 看护现有 admin 账号保留身份和密码并补齐超级管理员权限，以及普通平台管理员不可授予或修改超级管理员角色。

用户权限赋权由 `knowledge-center-permissions-view.test.js` 看护前端请求头、真实 HTTP 认证处理与历史 CAS 记录兼容；`knowledge-center-permissions.spec.js` 使用隔离用户投影和截获的赋权写请求，看护保存/撤销后的版本刷新、本地账号只读及冲突错误反馈，不修改真实用户权限。测试延迟真实平台概览响应，在取消审核角色后释放响应，确定性验证后台重绘保留未保存草稿，并验证保存失败保留编辑值。

## 常用命令

```bash
# 查看自动发现的分类和文件数
python3 tests/run_tests.py list

# 快速关键路径，不依赖已启动的后端和浏览器
python3 tests/run_tests.py smoke

# 按语义分类执行
python3 tests/run_tests.py gate
python3 tests/run_tests.py unit
python3 tests/run_tests.py contract
python3 tests/run_tests.py integration
python3 tests/run_tests.py system
python3 tests/run_tests.py e2e

# 全量执行；all 是 full 的兼容别名
python3 tests/run_tests.py full
python3 tests/run_tests.py all
```

每个框架都以详细模式输出具体成功、失败和跳过的用例；入口末尾汇总各任务状态、测试文件数、耗时、失败用例列表和最终退出码。任一任务失败、超时或无法启动时，入口返回非零退出码。

`gate` 和 `full/all` 会自动保存按日期分层的正式报告：`runtime/test-reports/index.md`只展示历史索引，每次运行的 `report.md` 展示核心结论，任务输出和浏览器证据保存在 `details/`。其他分类保存到 `runtime/test-results/`。

2026-11-11T09:01:06+08:00 固定 Node 全量复采：190 套件、2854 用例通过，1 套件、8 用例跳过，0 失败；输入稳定。行 16289/16415（99.23%）、分支 16875/18957（89.01%），较上一有效采集增加 1 行、分支持平。证据 `runtime/coverage-goal/node-invalid-json-verified/`；平台目标未达到。

2026-11-11T08:55:33+08:00 增量审核真实 HTTP 畸形 JSON 返回 400 且不写入，合法评论随后成功；定向套件 79/79 通过，解析异常行命中。证据 `runtime/coverage-goal/incremental-invalid-json-focused/`。

2026-11-11T08:53:41+08:00 文档预处理类型边界补测后固定 Node 全量复采：190 套件、2853 用例通过，1 套件、8 用例跳过，0 失败；输入稳定。行 16288/16415（99.22%）、分支 16875/18957（89.01%），较上一有效采集各增加 1 项。证据 `runtime/coverage-goal/node-document-upload-verified/`；平台目标仍未达到。

2026-11-11T08:48:17+08:00 文档预处理类型边界经真实 HTTP 定向 28/28 通过，拒绝不支持的文件后列表不变且合法上传可恢复；`document.js` 第 302 行命中，定向行 591/598、分支 357/418。证据 `runtime/coverage-goal/document-upload-type-focused/`。

2026-11-11T08:45:38+08:00 固定 Node 全量复采：191 文件，190 套件通过、1 跳过；2852 用例通过、8 跳过、0 失败。输入稳定，行 16287/16415（99.22%），分支 16874/18957（89.01%），较上一有效采集各增加 2 项。证据 `runtime/coverage-goal/node-gitlab-account-verified/`；平台覆盖目标尚未达到。

所有实际测试运行（包括 `gate`、`full/all`）默认在批次目录生成中文 `report.html`，终端输出报告路径；`list` 和 `--dry-run` 不生成报告。总览展示用例数量、结果分布、失败与阻塞、场景统计及任务耗时；失败区分别统计异常用例和任务，显示前 8 条用例的短错误摘要与完整筛选入口。按测试场景分类分页展示逐条成功、失败、超时、中断、跳过和未执行用例，提供错误详情、任务日志、跨页搜索、状态筛选和用例直达链接。未取得逐条明细的任务明确标为未统计。启用 `--coverage` 时同步展示覆盖率分子、分母、目标和缺口。

例如 `python3 tests/run_tests.py smoke --report-page-size 50`；每页默认 50 条。报告目录内包含总览、`scenes/` 静态分页、`assets/` 离线资源和 `details/` 证据，分享时保留完整目录。无需服务即可打开，无 JavaScript 仍可浏览分页。专业报告参考与评分证据见 `runtime/rea/professional-test-report/ACCEPTANCE.md`。报告契约见 [TEST_REPORT_DESIGN.md](./TEST_REPORT_DESIGN.md)。

首次运行前安装仓库测试依赖：

```bash
python3 -m pip install -r requirements.txt
npm install
npx playwright install chromium firefox
```

辅助选项：

```bash
python3 tests/run_tests.py full --dry-run
python3 tests/run_tests.py full --fail-fast
python3 tests/run_tests.py full --timeout 3600
python3 tests/run_tests.py full --jobs 4
python3 tests/run_tests.py full --coverage
python3 tests/run_tests.py full --report runtime/test-results/exports/compat-full.json
python3 tests/run_tests.py full --log runtime/test-results/exports/compat-full.log

# 定向执行一个或多个 Playwright 浏览器项目
PLAYWRIGHT_PROJECTS=chromium python3 tests/run_tests.py e2e
```

默认调度采用资源感知的分层并发（`--jobs`，默认 `min(4, CPU 数)`）：纯 Jest、隔离的 Python 用例使用 `isolated-cpu` 通道并行；文件转换等 I/O 用例和只读服务用例分别限制为最多 2 个并发。集成测试、独立脚本以及未知资源类型保守归入 `shared-state` 并串行执行。Playwright 按文件级显式清单拆为 `service-read` 与 `database-write`：只读/Mock 用例最多 2 路并发，真实数据库写入和性能门禁保持单路；未登记的新 E2E 默认进入写通道。`--fail-fast` 会强制所有任务串行，以保证首个失败后立即停止。

E2E 资源清单维护在 `tests/run_tests.py` 的 `E2E_RESOURCE_BY_FILE`。只读通道当前覆盖认证、入口导航、资产工作台、GitLab Mock、增量页面 Mock、大纲布局、可搜索组合框和审核阅读回归；写通道覆盖真实资料上传、手册共享草稿与评审提交、增量全流程、人员治理、模板管理和审核发布。单文件内部及同一浏览器项目保持顺序执行，避免测试步骤自身的状态依赖被打乱。

包含 Playwright 的非 `--fail-fast` 运行会在后台准备 `test_hy` 和隔离服务，同时先执行不依赖浏览器的本地分类；进入 Playwright 前必须等待准备成功。统一构建会校验来源指纹、迁移摘要、Node/npm/Python/Java 工具链和 `manifest.sha256`，全部匹配时复用 `runtime/build/knowledge-center/current`；任一项不匹配或产物缺失均完整重建。

部署契约测试覆盖 `knowledge-center.sh doctor --json`、RPM/DEB 安装命令路由、外部 URL 配置、离线包摘要校验和数据库 `probe/verify` 入口。契约测试会跳过真实数据库探测；真实部署验收必须单独执行 `./knowledge-center.sh doctor`。

Playwright 始终由统一入口启动随机本地端口的隔离测试实例，不复用外部 `KPG_BASE_URL`。该实例复用同一 YashanDB 服务，但强制通过 `YASDB_CONFIG_DIR=runtime/test-config/yashandb` 从其 `service.env` 加载 `test_hy` 独立 Schema 账号；缺少配置或账号不是 `test_hy` 时前置失败，不得回退或额外依赖业务配置。

2026-11-04 工作台性能定向回归：`aggregate-store-async.node.test.cjs` 验证成功写入后的快照仍经 Storage 304 检查，外部写入触发新版本读取；`handbook-production-service.test.js` 验证异步附件暂存、草稿绑定及回读。隔离 `test_hy` 的 `ProductionReferenceJdbcCheck` 验证分块读取替换后大纲引用门禁与事务回滚。实际何阳会话耗时和回读见专项验收报告；这些定向检查不替代百万工单容量门禁。

统一入口在启动浏览器测试服务前，会调用 `tools/repository/sync-e2e-yashandb-schema.sh`，将 `pf_knowledge` 的表结构和数据刷新到 `test_hy`。同步不依赖 DBA 或跨 Schema 授权：源账号只读导出结构 SQL，目标账号重建自有对象，本地 JDBC 复制器以双连接流式复制数据，再重建索引和约束。基线对账通过后，入口会构建当前工作树，并只对持锁的 `test_hy` 执行已提交的当前版本迁移。迁移 SQL 或版本别名存在未提交变更时，即使目标是测试 Schema 也会在连库前失败；需要先提交迁移来保证 revision 和聚合摘要可追溯。对账行数读取会提取明确的数字并对短暂空输出重试三次，仍无数字时按表名失败，避免生成不可解析的假通过报告。导出、重建、复制、对账、构建或迁移失败都会阻止 E2E。统一入口持有跨进程独占锁直到服务回收，不允许两个 E2E 运行并发写入 `test_hy`。同步和迁移证据分别写入本次 `details/database-sync/` 与 `details/database-migration/`。

E2E 启动时还会校验服务端返回的 `environment=test` 和本次 `testRunId`，校验失败则在发送业务写请求前终止。状态与日志位于本次报告 `details/knowledge-center/`。回收必须通过所有权令牌和进程身份校验；校验失败时保留现场，绝不停止共享开发平台。

## 分类规则

文件名按以下优先级归类：

1. 包含 `.gate.`：门禁测试；
2. 包含 `contract` 或 `compatibility`：契约测试；
3. 包含 `integration`：集成测试；
4. 包含 `system`、`performance`，或 Jest 文件名包含 `e2e`：系统测试；
5. `tests/e2e/agent-runner/*.spec.js`：浏览器 E2E；
6. 其余 Jest/Python 测试：单元测试。

Python 用例支持标准的 `test_*.py` 和 `*_test.py` 两种命名形式。入口根据源码结构选择 runner：`unittest.TestCase` 交给 unittest，引入 pytest 或只声明顶层测试函数的文件交给 pytest，带 `if __name__ == '__main__'` 的旧式测试按独立 Python 脚本执行。无 Jest 用例声明的 `*.test.js` 按独立 Node 脚本逐文件执行，脚本中的 `process.exit()` 不会终止其他测试任务。

独立 Python 脚本和 Python 测试框架都会获得测试文件所在目录的导入路径，以支持同目录的 `bootstrap.py` 等辅助模块。所有 Python 测试按文件隔离，一个文件导入失败不会阻断同分类的其他文件。可以通过 `TEST_PYTHON` 指定已安装测试依赖的 Python 解释器。pytest 未安装、脚本退出非零或框架未收集到用例时，由底层 runner 返回失败，统一入口不会将其记为成功。

`smoke` 是按运行时间维护的快速关键路径。`full` 按 `gate → unit → contract → integration → system → e2e` 顺序执行，可能需要浏览器、已启动的服务、环境变量或外部依赖；缺少条件的测试应由测试自身明确显示为跳过或失败，不允许入口将“未发现测试”冒充成功。

Playwright 分类只包含当前知识中心拓扑。所有服务地址由统一入口注入，用例不得以 `13510` 或远程业务地址作为写入回退。历史 `3500/4100/13502` 页面、一次性调试脚本和已下线兼容入口不属于 `full`。

`/api/document/*` 评论契约已迁移到当前 `13510` 知识中心网关，并归入 integration 分类；HTML 原文预览由当前页面与 API/E2E 契约覆盖。

性能门禁依据专项报告的真实 Chromium 基线运行，因此 `gate` 中的 Playwright 用例只选择 Chromium；Firefox 等浏览器仍由 `e2e` 功能回归覆盖，不套用 Chromium 的 150 ms 性能阈值。

导航树与可调整目录面板的 P0 验收必须同时覆盖 Chromium 和 Firefox，并验证拖动提交、`Escape` 与 `pointercancel` 回退、异步重绘后重新增强、移动端隐藏拖拽条和正文最小可读宽度。只断言 `scrollWidth` 没有页面级溢出不算移动端通过，因为固定桌面列宽仍可能把正文压缩成逐字竖排。通过用例的视觉证据写入 `runtime/test-results/navigation-pane-p0/`。

公共表格“显示字段”回归覆盖必选列、显隐、顺序、恢复默认和版本化持久化；每次操作必须立即触发页面重绘，重绘后抽屉、焦点和滚动上下文不得丢失。文档生产还必须验证旧 `kc-production-handbook-columns` 偏好只迁移一次，且页面不再出现列宽或固定列配置。

E2E 若临时修改共享账号角色或其他持久状态，必须在 `finally` 中恢复原值；不得依赖用例执行顺序或把变更遗留给后续分类。
领域分工 E2E 必须同时验证团队页面的关联领域、领域接口的负责人和成员投影、分工 Combobox 候选，以及合法和跨团队非法改派。对共享环境执行真实改派时，测试结束前必须恢复原责任人。
Node 测试中的文件 watcher 必须 `unref` 或显式关闭；会修改共享配置文件的测试必须在结束时恢复原内容。

`system` 中的检索链路会真实调用当前知识中心 Agent API 与 MCP；依赖外部模型的完整文档生成默认跳过，通过 `RUN_KNOWLEDGE_CENTER_LIVE_MODEL_TESTS=1` 显式启用。

`external/` 是独立维护的工程，不在本入口扫描范围内。

公共滚动门禁：`knowledge-center-scroll-runtime.test.js` 检查视口能力、阈值、监听清理、滚动所有者和脱敏诊断；`knowledge-center-scroll-contract.spec.js` 使用真实隔离服务，在 Chromium/Firefox 的 1440×900、1024×768、768×1024、390×844 视口验证原生与旧 dvh 回退、实际 scrollTop、末尾焦点、模块契约以及局部/弹窗/抽屉滚动。Playwright 文件除 `.gate.` 外始终归入 e2e，不因文件名含 contract 漏出端到端门禁。旧 dvh 模拟不替代真实旧 WebView 认证。

`tests/unit/agent-runner/handbook-production-service.test.js` 看护手册生产共享草稿：首次/幂等保存、乐观锁冲突、不可变历史恢复、附件限制与绑定、独立审核人门禁，以及评审冻结后克隆下一工作稿。`tests/unit/agent-runner/handbook-production-api.test.js` 通过真实 HTTP 路由看护查询参数转换、结构化冲突详情、原始二进制附件和评审批次契约。

### 错误定位验证

`tests/unit/agent-runner/error-diagnostics.test.js` 验证聚合冲突状态与引用 details 传递、Markdown 增强缺失诊断，以及隔离目录中的部署安装失败和恢复失败日志；不连接生产环境或写入数据库。

## 文档生产与审核入口性能专项

生产进展单页视图：`production-progress-workspace.spec.js` 通过浏览器验证列表/日历/图表切换、阶段筛选、任务摘要、任务列表不重复读取、2026 官方工作日历、2025 未配置日期性质、桌面/窄屏布局和点击至画面稳定的 100ms 门槛。年度日历的真实 HTTP 权限与来源契约由 `production-work-calendar-http.test.js` 验证，配置解析由 `work-calendar.test.js` 验证，视图契约由 `knowledge-center-incremental-view.test.js` 覆盖。浏览器夹具仅模拟增量任务列表；日历 API 使用实际知识中心后端，账号与资产数据不作为本用例结论。

`incremental-read-performance.test.js` 通过真实 HTTP 验证 Storage 等待不阻塞网关、逐请求新快照、详情与差异异步读取及权限保留；与 review-workbench-contract、incremental-build-api 和源码性能门禁共同执行。`tools/repository/profile-knowledge-center.cjs` 是独立只读浏览器审计，需显式 KPG_BASE_URL，输出冷/暖刷新、侧栏切换、个人生成、审核正文、资源、长任务和接口状态。KC_PERF_CPU_RATE 控制 CPU 降速，KC_PERF_CHECK_BEHAVIOR=1 检查标签延迟请求及 context 刷新保留正文；接口失败/仓库失败/页面错误均判失败。旧独立生成器只测外壳，不能计为业务就绪。该审计不替代既有性能门禁和统一隔离写入型 E2E。

AI 生产补充验证：`production-ai-service.test.js` 验证人工采用及后续保存保留生成元信息、旧依据失效；`handbook-production-api.test.js` 通过隔离 HTTP/MCP 与 Chromium 验证资料拉取预览、显式勾选、冻结来源传给模型、上下文隔离、来源地址限制、重定向及读取错误。真实 MCP 只读探测证据位于 `runtime/test-results/production-ai-sources/real-source-result.json`；隔离来源测试不等于 PingCode、用例库或真实模型验收。

AI 写作来源回归：`production-origin-snapshot.node.test.cjs` 验证未匹配仓库文件时前端冻结平台正文及 SHA-256；`handbook-production-api.test.js` 通过真实隔离 HTTP 验证映射手册中的平台正文来源可以生成、摘要不一致会拒绝，且不调用 GitLab。该契约只解除 AI 生成对仓库文件映射的依赖；送审和 MR 仍需真实仓库路径及基线。

来源快照拒绝边界还通过同一隔离 HTTP 场景检查已映射手册缺少快照、平台摘要格式错误、GitLab 快照缺少路径/分支/版本标识；拒绝请求不得读取 GitLab 或调用 AI。Node 固定 Jest 采集由 `native-contract-coverage.test.js` 桥接该 HTTP 契约，覆盖率须以稳定全量采集结果为准。

阶段 HTTP Adapter：`production-ai-http-stage-adapters.test.js` 通过本地真实 HTTP 服务覆盖非 2xx、超时、非法 JSON、1 MiB 响应上限和非法部署配置；`handbook-production-api.test.js` 验证服务端冻结 envelope 经 Planner HTTP Adapter 传递。Fixture 不构成目标环境独立 Agent 部署验收。

AI 续写 Skill 验证：`production-ai-service.test.js` 覆盖新增登记、操作适用性、重复与过期选择拒绝、执行内容冻结、幂等及采用追溯；`handbook-production-api.test.js` 通过真实 HTTP 和 Chromium 选用实际能力包资源，验证指令进入模型消息、候选保留范围外原文及保存回读。证据写入 `runtime/test-results/production-ai-skills/`。模型为隔离替代实现，不能代替真实模型和完整平台验收。

AI 来源确认检查同一定位符的内容版本冲突：旧新快照同时勾选返回409，取消旧版本后可重试；旧任务依据保持冻结。真实HTTP回归包含该场景，完整外部来源验收仍独立要求。


PingCode AI 引用验证：`test_pingcode_reference.py` 覆盖空间归属、定位符、真实正文解析器、版本元信息与 API 错误脱敏；`handbook-production-api.test.js` 覆盖设计/测试来源、固定内部路径、错误正文及大小上限、浏览器预览勾选与冻结引用。`production-ai-sources-boundaries.test.js` 与 `production-writing.test.cjs` 覆盖白名单外合法空间交给上游读取及上游拒绝。证据位于 `runtime/test-results/production-ai-pingcode/`；`real-reference-probe.json` 和 `real-node-adapter-probe.json` 为真实 PingCode 只读调用证据，浏览器测试仍使用隔离来源和模型，不能视为完整平台验收。

PingCode 引用契约测试命令：`PYTHONPATH=apps/pingcode-api python3 -m unittest discover -s tests/unit/pingcode/web-backend -p 'test_pingcode_reference.py'`。测试会校验共享正文解析器、空间成员边界、页面元数据一致性和错误脱敏。

真实来源连接器复验可执行 `PRODUCTION_AI_PINGCODE_REFERENCE_URL='https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/67768231ea9f2a28709356bc' KNOWLEDGE_CENTER_PINGCODE_API_PORT=18010 node tools/repository/probe-production-ai-sources.cjs`。脚本复用 `ConfigManager`/`MCPClient` 真实查询并读取知识库 MCP，再经 PingCode 只读 reference API 读取指定页面；仅记录来源定位符、长度与 SHA-256，不输出正文或凭据。可用 `PRODUCTION_AI_SOURCE_PROBE_OUTPUT` 指定证据文件，产物必须放在 `runtime/`。本命令验证连接器直连，不绕过知识中心 API 的作者权限、来源域名与路径校验门禁；因此不代替平台来源预览验收。

2026-10-23 实测结果：上述脚本 MCP 与 PingCode 均通过，脱敏报告为 `runtime/test-results/production-ai-integration/20261023/source-connectors-probe.json`；`production-ai-service.test.js` 与 `production-ai-provenance.test.js` Jest 23/23，`node --test --test-name-pattern='测试用例库|来源|PingCode|MCP' tests/unit/agent-runner/handbook-production-api.test.js` 4/4，PingCode Python API 契约 6/6。真实 `/knowledge-center/api/auth/session` 仍返回 401 `AUTH_REQUIRED`，所以平台来源预览及 CAS 作者权限链路未验收。此次曾误用 `node --test` 直接执行 Jest 文件，缺少 Jest 全局而启动失败；改用仓库 Jest 配置后通过，不属于产品测试失败。

`production-ai-provenance.test.js` 验证混合来源区间、逐字匹配、虚假来源降级、协议拒绝、证据数量上限及 Unicode 编辑边界。`handbook-production-api.test.js` 的混合元信息场景通过真实 HTTP/Chromium 验证预览、采用、人工编辑、保存回读、规范化与未保存原文再次生成的来源保留，截图在 `runtime/test-results/production-ai-provenance/`；模型和资料为隔离替身，不代表真实模型与外部来源验收。

`production-quality-service.test.js` 和生产 API 场景验证独立质量 Agent 的四个 Skill、YashanDB 适配器、通过/失败/未执行、报告版本绑定以及无库阻断。当前测试数据库使用隔离适配器，不代表真实 YashanDB 连接已经验收。

`handbook-production-api.test.js` 另覆盖质量报告的真实 HTTP 修订绑定：正文摘要必须匹配，失败响应不得覆盖原报告关联；跨分支复测返回未找到。`production-quality-service.test.js` 验证相同正文也不能把指定修订的报告改绑其他修订或分支。

AI 文档质量预期结果的真实 YashanDB 定向验收：先在独立测试库配置 `YASDB_QUALITY_JDBC_URL`、只读账号和密码，并确认该地址与业务 `YASDB_JDBC_URL` 不同，再启动 Storage；运行 `PRODUCTION_QUALITY_REAL_STORAGE_URL=http://127.0.0.1:14210 node --test --test-name-pattern='真实 YashanDB 经质量 HTTP' tests/unit/agent-runner/handbook-production-api.test.js`。未授权真实测试库时不设置该变量，此项明确跳过。用例通过实际 HTTP 接口与独立只读数据库执行匹配、失配和语法错误，非法预期声明不执行；认证与报告存储使用隔离 fixture，不冒充共享平台端到端验收。证据：`runtime/test-results/production-ai-quality/20261022/expected-results/real-http-report.json`。

质量 Agent Skill 编排回归：`production-quality-service.test.js` 校验四个受信任 Skill 真实调用轨迹、资源摘要和配置错误；真实 YashanDB 定向用例的报告同时保存四阶段调用记录。

`handbook-production-api.test.js` 还通过隔离真实 HTTP 和 Chromium 验证已保存草稿质量弹窗：逐条通过/失败/未执行、预期及实际结果、完整 JSON 下载、修订绑定和复测关联，并检查窄屏无横向溢出；该用例的数据库执行为隔离替代实现，真实 YashanDB 用例仍由显式配置的独立实测覆盖。


工作台质量检查 E2E 从实际 AI 助手“检查”入口调用真实隔离后端及 test_hy，只读执行三个 SQL 用例并验证通过、失败、未执行、修订绑定和复测关联。企业包加载器同时核对 35 个资源与五个生产 Skill 的摘要，不以旧资源数量误判新增能力。


AI 内容检查由 `handbook-production-api.test.js` 经真实隔离 HTTP 验证四项状态、模型失败/无效格式、修订正文冲突，以及内容失败仍保留 SQL 执行证据；包含真实 OpenAI SDK 到本地 Provider fixture 的 JSON 嵌套请求契约。浏览器验证联合检查选择、问题位置与处理要求、无来源局限和 HTML 文本展示。这些模型/数据库 fixture 不计为外部真实集成通过。`production-quality-service.test.js` 注入阶段故障验证停止后续 Skill、持久化失败轨迹及资源/实现摘要；`agents.test.js` 验证生产模式禁止基础报告降级和 Unicode 位置边界。

用例来源追溯回归：`production-quality-service.test.js` 验证同一 SQL 不同正文位置的直接引用、归纳待核验、人工变更和失效快照区分，以及摘要不一致在数据库执行前拒绝。生产 API 测试从真实测试用例库读取，经模型 fixture 生成、采用、保存和质量 HTTP 关联到具体库条目，并用 Chromium 检查条目展示；人工修改后不将旧证据关联到改变的字符。设置 `PRODUCTION_QUALITY_REAL_STORAGE_URL` 时该用例使用真实测试库，证据位于 `runtime/test-results/production-ai-quality/20261022/case-sources/`，仍不算真实模型验收。

真实模型内容质量探测：在现有模型配置和测试库均获授权时，运行 `PRODUCTION_QUALITY_REAL_STORAGE_URL=http://127.0.0.1:14210 PRODUCTION_CONTENT_REAL_PROVIDER=1 node --test --test-name-pattern='真实配置模型经内容质量 HTTP' tests/unit/agent-runner/handbook-production-api.test.js`。该用例如实记录模型完成或失败，要求 SQL 执行结果独立保留；测试通过只代表协议与失败处理符合约定，不能据此宣称模型内容质量验收通过。证据为 `runtime/test-results/production-ai-quality/20261022/content-review/real-provider-http-report.json`。

PingCode 引用回归覆盖空间内短标识解析及重复短标识拒绝。

## 2026-10-23 AI 文档生产真实集成收口

本轮获准模型与 YASDOC URL 已可调用，最新证据以 `runtime/test-results/production-ai-integration/20261023/README.md` 为准，上述区域限制/无 CAS/空来源列表段落为历史结果。目录提供五操作语义、真实模型+PingCode+test_hy 浏览器闭环、真实正文审核交付（本地 GitLab fixture）及共享草稿保护的复现命令。内容检查超时配置为120秒，必须检查 status=completed/model/四项实际执行，不能仅数报告项。故意失配的验收文档 gate=not_passed 是预期。

本轮统一单元45/45项任务（Jest80套件753用例）、契约7/7、E2E283项直接通过及1项Firefox重试通过；报告分别为 `runtime/test-results/unit/20261023-152032-386854-unit/report.html`、`runtime/test-results/e2e/20261023-151022-034935-e2e/report.html`。先前并发单元有一例5000ms超时，串行复验通过，未改动断言。

## 全量回归与失败证据

审核发布 E2E 的只读 API 回读允许 Playwright 对 `ECONNRESET` 重试一次，处理发布后复用已关闭持久连接的传输故障；写入请求不重试，HTTP 错误与业务断言仍立即失败。浏览器整用例重试次数另按原配置，报告必须分别记录首次通过和重试通过。

使用 `python3 tests/run_tests.py full --coverage --jobs 4 --timeout 1800`。每个浏览器测试批次使用独立的 suite/framework/文件列表摘要目录，防止后续 Playwright 批次清理先前失败的 trace。Jest 覆盖率排除测试源码（包括桥接载入的 node:test 文件）；浏览器回调在独立上下文执行，不能注入依赖 Node 闭包的 Istanbul 计数器。该排除不排除被测产品源码，也不免除原生测试执行。

大纲的筛选返回、节点选择、刷新与信息弹窗、上下文菜单分为独立场景。双轮真实 YashanDB 质量检查单用例预算为 90 秒、每轮 HTTP 响应等待为 30 秒；原全局 30 秒预算无法同时容纳保存修订与两轮执行及报告持久化，其他用例预算不变。

条件快照读取回归还覆盖：真实 HTTP 的 200/304、调用者修改副本、版本更新、删除、不存在和存储故障；不得因命中缓存绕过数据库版本或业务权限检查。
性能门禁同时真实调用隔离 Storage 的记录 GET，校验 ETag 与 revision 一致、匹配返回无正文的 304、过期版本返回完整快照；只读取测试实例，不写共享数据。

全量回归补充（2026-10-23）：runner 将隔离 Storage URL 显式传给浏览器任务，禁止性能门禁回退共享端口。native→Jest 桥接沿用用例显式 timeout；未配置时按 HTTP／浏览器契约使用 30s，避免 Jest 隐式 5s 截断清理阶段。检索系统测试的关键词阶段实际包含模型请求，观察到 66s 返回，按 90s 有界轮询；中间 JSON 写入未完成时等待下一轮，持续缺失仍判失败。

审核 bootstrap 的真实 HTTP 回归同时确认：空文档清单不加载审核人名册；非空指派姓名及改派行为由审核契约和浏览器流程覆盖。

审核首屏预取回归：`review-bootstrap-prefetch.test.js` 验证完整参数匹配、单次消费、非审核/CAS回调不预取及失败回退；性能E2E同时断言每次刷新只发一次bootstrap，并保留请求时间。Storage性能门禁增加批量名册与单用户权限投影的真实API一致性验证。


AI 沉浸式写作的独立浏览器/API 验收：`node --test tests/e2e/agent-runner/production-writing.test.cjs`。使用真实 Vditor、前端模块与 HTTP 后端，`fixtures/production-writing.cjs` 注入测试作者与隔离内存仓储，覆盖选区/光标映射、手动确认、资料确认与移除、候选重生成/失败/取消/恢复、人工采用回读及版本冲突、桌面/390px、主区无弹窗、富文本编辑、浏览器返回与正文保留。默认模型为确定性测试替身；`WRITING_LIVE_MODEL=1 node --test tests/e2e/agent-runner/production-writing.test.cjs` 额外调用当前配置真实模型，输出证据到 `runtime/test-results/production-writing/`。该独立 Node 入口需安装 Playwright 及 Chromium，不依赖在线业务手册，不访问共享草稿。

执行反馈回归：`node --test tests/e2e/agent-runner/production-writing-feedback.test.cjs` 使用本地真实 HTTP SSE 模型替身与真实生产 API，验证 Chat Completions/Responses 增量预览、阶段调用、取消迟到输出隔离。上述浏览器入口还验证模板同框搜索、侧栏切换、断网后继续轮询同一任务、详情展开状态与 390px 无横向溢出。外部企业模型和阶段适配器内部轨迹仍需在目标环境单独验收。

AI 资料、Skill 与来源证据浏览器契约按真实操作展开“参考资料”“更多设置”和资料正文，再校验预览、选择与采用；不强制操作隐藏控件。文件模式 HTTP fixture 显式设置并恢复 `KNOWLEDGE_STORAGE_MODE=file`；模板认证 fixture 同时指定本机 host 与随机 port，避免加载运行配置后连接共享认证服务。

模板管理功能回归：`NODE_PATH=runtime/agent-runner/node_modules node tests/e2e/agent-runner/template-workspace.cjs` 使用真实模板 API handler 与隔离存储，覆盖富文本/Markdown 切换正文、历史版本比较与恢复、保存冲突、上传、权限和窄屏。基本信息方案 B 另覆盖已有模板默认正文、新建时打开表单、取消/完成/Escape、打开浮层不重建富文本编辑器、必填错误定位、元信息与正文同版本保存及刷新回读，以及 390px 目录/正文不重叠；截图在 `runtime/test-results/template-metadata-20261104/`。`NODE_PATH=runtime/agent-runner/node_modules node tests/e2e/agent-runner/template-mapping-workspace.cjs` 覆盖规则保存、规则命中、AI 异步建议、手册可见性、依据查看、确认/改选理由、规则 JSON 错误、取消、只读权限、390px 无横向滚动、大纲版本变化拒绝旧批次，以及生成任务使用已确认映射。`node --test tests/unit/agent-runner/template-mapping-service.test.cjs` 覆盖同输入确定性、规则冲突、模型失败/取消、版本校验以及 500 篇、50 模板、20 规则的性能；本机样本规则分析最慢 23.5ms，500 条映射列表读取 P95 17.9ms，门槛分别为 2s 与 500ms。`production-ai-service.test.js` 另验证生成任务保留映射批次 ID 和模板快照。所有 AI 替身只验证协议与控制流，不代表真实模型匹配质量；当前没有对真实手册执行分析或写入共享映射。


## 平台管理 MCP 服务验证

`tests/unit/agent-runner/mcp-governance.test.js` 使用 runtime 隔离配置、真实 ConfigManager 和实际 HTTP MCP fixture/平台 handler，验证加密与跨进程回读、凭据合并/清除、地址切换保护、字段校验、并发冲突、管理员权限、JSON/SSE 协议/错误/超时，以及原生成器客户端和 AI 来源共享配置。

`node tests/e2e/agent-runner/platform-mcp-management.cjs` 使用已安装 Playwright，启动隔离真实后端与 MCP fixture，验证表单、工具目录转义、测试不保存、凭据不回显、冲突恢复、清除与360px布局；结果及截图在 `runtime/test-results/platform-mcp`。该脚本不写真实配置、不访问企业 MCP，不能作为企业集成已通过的证据。

## 文档生产离线盲评工具

运行 `node --test tests/unit/agent-runner/production-ai-blind-eval.test.cjs`，覆盖匿名字段分离、完整评分、缺测计量、Unicode 范围、CLI prepare/summarize、0600 文件权限、拒绝覆盖和符号链接越界。临时产物在 runtime/ 下创建并于测试结束清理；该测试不调用模型，不产生真实质量评测结论。


PingCode 资料输入回归包含于 `production-writing.test.cjs`：真实 HTTP 与 Chromium 验证完整页面网址/短标识、`POSITIVE` 等合法空间交给上游读取、非法来源域名与路径拒绝、上游错误不误报平台账号权限、失败后重读。上游为隔离本地 PingCode 响应；另对本机资料服务的 `POSITIVE/bKnkt-Sx` 单篇页面执行了只读 HTTP 200 探测，不代表完整平台会话验收。

2026-11-10 首次读取性能回归：`test_pingcode_reference.py` 验证资料服务启动预热异步返回、后续请求可用和预热失败可恢复；知识中心来源读取仍沿用 15 秒上限。原始失败日志显示 `POSITIVE` 空间首次目录生成晚于 BFF 超时，预热只提前建立账号浏览器会话，不预读空间或更改权限。受控重建并启动后，目标页面首次只读请求 HTTP 200、3.58 秒；此前无目录索引的 `CODPUBLIC` 页面首次读取 HTTP 200、1.41 秒。Python 参考正文测试 11/11、隔离来源 Jest 44/44 通过；无作者会话的真实平台 POST 未执行。

2026-11-17 PingCode 单页拉取修复：`test_api_client.CompletePageTreeContractTest` 覆盖 8 路分批、子分页失败和缺少页面 ID 时 `complete=false`；`test_pingcode_reference.py` 覆盖页面详情直读、`space_id` 空间校验、404 目录回退和不完整索引重建；`production-writing.test.cjs` 定向浏览器用例核对短标识 URL 及 Markdown 导出文件内容。真实只读页面 `YAS/WUn_kQWz` 在后台会话预热后 2.37 秒读取成功。完整结果见 `.codex/知识中心建设平台/05-测试设计&报告/02-测试报告/知识中心-PingCode单页拉取与预览导出修复-20261117.md`；本结果不代表全空间逐页实测。

写作页回归还验证生成设置隐藏模型控件、使用默认模型、逐项添加多份资料、优先级排序，以及新标签页快照预览。

网页资料回归验证 HTML 图片相对路径转绝对地址、阅读视图实际加载图片、原始内容切换及原始 HTML 不执行；`production-web-reference.test.cjs` 覆盖真实 HTTP 提取。

## 手册按需读取性能回归

手册同屏工作台回归：`tests/e2e/agent-runner/knowledge-center-handbook-workspace.spec.js` 覆盖真实隔离服务中的目录、编辑格式快速切换、草稿 HTTP 保存回读、六类来源和 390px 布局；使用统一 `tests/run_tests.py` E2E 入口同步 `pf_knowledge` 到 `test_hy` 后运行。`production-writing.test.cjs` 另覆盖同屏候选生成与明确采用，模型为确定性夹具，不代表外部模型质量验收。

确定性回归：`node --test tests/unit/agent-runner/handbook-demand-read.node.test.cjs`；真实 HTTP 保存/审核/AI 采用与映射授权回归：`node --test --test-name-pattern='生产映射真实 HTTP|shared draft HTTP|attachment and review batch|AI HTTP creates isolated' tests/unit/agent-runner/handbook-production-api.test.js`。

运行实例性能门禁：先通过环境注入 `KPG_BASE_URL`、`KC_PERF_HANDBOOK_ID`、`KNOWLEDGE_CENTER_ADMIN_USERNAME`、`KNOWLEDGE_CENTER_ADMIN_PASSWORD`，执行 `node tools/repository/check-handbook-performance.cjs`。目标手册需要已有共享草稿；工具从生成文档首页实际点击入口，记录目录可见与正文就绪，再按1/5/10路分别各采样100次目录/草稿 API，按 `config/knowledge-center/handbook-performance.json` 判断退出码；结果默认写入 `runtime/performance/handbook-gate.json`，不记录凭据和正文。发布该链路变更须执行此门禁，并确保 Storage 已支持投影；在隔离端口验证，避免与编译、其他压测争用资源。接口测试不替代已连接 GitLab、并发及跨实例恢复验收。

只读加载体验验收：使用同一组性能账号环境变量运行 `node --test tests/e2e/agent-runner/handbook-loading-readonly.node.cjs`，无需隔离写入环境，不保存业务数据。覆盖桌面/390px慢正文期间目录可用、稳定占位、无错误草稿结论、恢复真实正文，以及模拟读取失败后目录仍可用；截图写入 runtime/test-results/handbook-loading。
性能门禁的目录指标在下一绘制帧核对展开目录位于视口内且可接收指针操作，不以加载文字消失代替可用；失败结果保留，不覆盖为通过。

## 功能链路性能专项（独立运行）

新增 `tests/performance/knowledge-center/`，以用户真实点击后的业务反馈与可操作状态分别计时，覆盖主导航模块与平台分区。当前环境专用数据、真实AI：

```bash
npm run test:performance -- --current
```

此命令会创建带运行标识的专用测试数据并调用真实模型；结束时自动归档测试手册、回收测试大纲、逻辑删除模板并清理无引用的本地上传资料，清理失败非零退出。不纳入普通 `full/e2e` 默认发现。配置、证据结构、隔离模式及覆盖失败规则见 `tests/performance/knowledge-center/README.md`；设计见 `.codex/知识中心建设平台/05-测试设计&报告/01-测试设计/知识中心-平台-界面性能专项-测试设计文档.md`。未完成链路、依赖失败或预算超标均以非零退出，不以页面外壳/错误反馈作为业务成功。

## 临时菜单关闭回归

`npm run test:ui:menus`：检查手册更多、资产更多、大纲更多操作、大纲导入和平台分区五类接入声明；用真实 Chromium 验证内外点击、停止冒泡、原生开关、Escape 焦点与层级、菜单切换、动态重挂载、幂等初始化、触摸和监听清理，持久目录保持展开。新增临时菜单须同步加入模板接入检查，禁止恢复业务 CSS 关闭白名单。

设置 KPG_BASE_URL、KC_PERF_HANDBOOK_ID、KNOWLEDGE_CENTER_ADMIN_USERNAME、KNOWLEDGE_CENTER_ADMIN_PASSWORD 时，追加当前实例桌面/390px验收（只登录和读取，拦截业务写入）；截图和结果写入 runtime/test-results/dismissible-menu。缺少变量时明确跳过真实实例用例，不能宣称真实实例通过。

菜单基础回归已接入 `npm run verify:full`，无真实实例变量时仍执行模板契约与隔离浏览器验证；发布验证另启用真实实例用例。真实页面验证必须避免与共享实例压测/其他 Playwright 验收并发运行。

手册工作台参考效果验收：`knowledge-center-handbook-workspace.spec.js` 覆盖目录、格式下拉、AI六类来源、人工内容保留、窄屏与保存回读；格式切换先打开summary。临时格式菜单纳入 `dismissible-menu.node.cjs`。续作隔离实测Chromium/Firefox共6项通过，历史大纲引用409通过已批准的测试Schema备份初始化消除；真实模型生成—采用—送审全链路另行验收。

2026-11-16：手册工作台增加全局顶栏隐藏与返回恢复断言，覆盖桌面、390px 顶边和横向溢出。本轮在本机平台只读加载真实页面 DOM，并覆盖注入工作树 CSS：1366px 与 390px 顶边均为 0、无溢出，返回后顶栏恢复，页面错误 0；此验证不代表本机平台静态产物已发布。

2026-11-16：AI 对话删除确认框改用平台关闭/删除语义图标与统一按钮变体。`production-writing.test.cjs` 的“AI 对话来源与回复操作的边界和错误状态”定向浏览器场景验证图标、取消、删除失败保留与删除成功回调，1/1 通过；同时运行 UI 契约检查。此测试使用隔离浏览器夹具，不代表共享平台静态产物已更新。

Jest 的 CommonJS runner 在 `tests/unit/agent-runner/jest.config.js` 中将 `marked` 映射到已安装同版本的 UMD 入口，用于来源图片 Markdown 解析测试；不替换产品运行时依赖或版本。

## 2026-10-28 续作回归修正

手册恢复 HTTP 测试注入可控时钟，等写作阶段开始后再推进租约，避免文件证据落盘时间提前耗尽短租约。PingCode 来源预览先关闭添加弹窗再打开预览。大纲菜单测试改用公共菜单模块；大纲 HTTP 夹具注入不参与该接口的生产服务，避免扫描共享任务存储，保持默认测试超时。

本轮六套 Jest（构建契约、大纲、迁移预检、GitLab HTTP、AI 服务、增量 API）106 项通过；`node --test tests/unit/agent-runner/handbook-production-api.test.js tests/unit/agent-runner/handbook-incremental-review.test.js tests/e2e/agent-runner/dismissible-menu.node.cjs` 为 29 通过、4 跳过。跳过项为共享实例菜单两项、真实 YashanDB 质量接口一项、真实配置模型质量接口一项。隔离 HTTP 与浏览器通过不代表真实企业 GitLab、模型质量或共享部署验收通过。原始证据保存在本地 `runtime/test-results/continuation-20261029/`，不提交运行日志。

## 生产历史大纲引用盘点

`node --test tests/unit/agent-runner/production-reference-audit.test.js` 用真实本地HTTP验证历史引用、软删除记录、豁免namespace、有效/缺失/已删除/未知分类、身份错配拒绝及报告脱敏。只读实测命令：

```bash
YASDB_STORAGE_URL=http://127.0.0.1:14210 KC_REFERENCE_AUDIT_OUTPUT=runtime/test-results/production-reference-audit/report.json node tools/repository/audit-production-references.cjs
```

目标地址必须明确指定；仅调用现有导出和大纲治理GET，不写数据库。失败退出非零并保留报告；导出/协议失败记录AUDIT_INCOMPLETE，不把未完成扫描记作零异常。规则见`config/knowledge-center/production-reference-audit.json`。报告不含正文与原始记录键，不能替代事务快照、正式备份或LOB核验；异常不能通过绕过保存409解决。

隔离E2E启动顺序为：持有test_hy锁→来源同步对账→已提交迁移→自有Storage→生产聚合私有备份/CAS初始化/回读→业务服务。初始化失败停止启动；备份及阶段报告位于本次运行的knowledge-center/production-initialization，含正文的备份不得提交。

性能门禁工具 `check-handbook-performance.cjs` 按配置执行同目录/草稿的1/5/10路读取，输出每批原始状态及独立成功P95，失败响应不能算成功加载；浏览器另按browserConcurrencyLevels的1/5/10路独立上下文分批采样，每档固定30次；各批入口准备就绪后并发点击，保留每轮成功/失败及各档P95。代表同账号并发读取，不代表多角色验收；不同上下文不共享静态缓存，各自先加载首页。

浏览器样本还记录目录首次DOM、首次动画帧以及目录帧回调断连/不可见次数，用于区分请求、渲染和帧等待；门禁仍按实际可见的目录与正文计算，诊断时间点不能替代成功判定。

工作台补验增加8份本地文档：首份以浏览器文件拖放事件上传，其余文件选择上传；断言真实后端201、解析内容及摘要，验证折叠和原生浏览器拖动保持期间跨列表滚动的优先级。该场景不调用真实模型，不代表生成质量或送审验收。性能采样启用严格JSON业务成功校验，HTTP 200错误体、HTML或无效JSON均保留为失败；浏览器正文就绪还须目录/草稿响应成功，禁止只按外壳DOM判定。

初始化前盘点仅允许两个获批聚合中的已删除引用；未知、缺失及范围外异常在首次PUT前停止，备份和失败报告保留。对应真实本地HTTP失败测试覆盖503引起的未知引用及CAS409。

工作台真实模型补验：`WRITING_LIVE_MODEL=1` 显式启用 `knowledge-center-handbook-workspace.spec.js` 中单个Chromium上传→生成→采用→刷新场景。必须走统一隔离入口（test_hy），不手工指向共享实例；默认跳过。不替代送审、GitLab交付或生成事实质量验收。 生成前先断言按钮可用；失败时附加 `writing-origin`（来源检查提示、任务状态、按钮禁用状态），区分授权未完成与模型请求失败。页面已关闭时不再截图或读取节点，避免掩盖原始错误。

工作台来源授权恢复补验：`WRITING_AUTH_RECOVERY=1` 在统一隔离入口显式启用无OAuth账号场景，验证真实access-status不可读、授权入口、重新检查、要求保留和零生成POST；默认不运行该前提场景，已授权账号不得冒充无授权。`production-writing.test.cjs` 另外验证重新检查成功后恢复生成、生成前授权失效不POST，以及保留首次冻结基线；该恢复成功分支仍是确定性模型/内存HTTP夹具。

## 生产正文、产物、附件与来源图片只读基线

`node --test tests/unit/agent-runner/production-content-inventory.test.js` 验证真实本地GET接口与真实文件核验，覆盖健康/损坏摘要、审核冻结/缺失引用、动态MCP、旧内嵌产物、文件大小/摘要/孤立、链接/穿越拒绝、协议和0600独占输出。真实Storage命令：

```bash
YASDB_STORAGE_URL=http://127.0.0.1:14210 KC_CONTENT_INVENTORY_OUTPUT=runtime/test-results/production-content/report.json node tools/repository/inventory-production-content.cjs
```

可显式设置`KC_ATTACHMENT_ROOT`和`KC_SOURCE_IMAGE_ROOT`为该服务本机权威附件/来源图片目录；交付图片从`KC_ATTACHMENT_ROOT/delivery-images`读取。任一不设置时对应文件核验not_checked，目录不存在时root_unavailable，均非完整通过。schemaVersion=4，scope包含来源图片、正文链接及增量任务交付图片；sourceImages统计资料、任务和所有历史修订中的ready/failed引用，deliveryImages统计所有保留的`incremental/state`任务资源清单并按摘要去重，逐字节校验大小、摘要和图片类型。16项原生HTTP/文件测试覆盖仅历史引用、元数据冲突、篡改、链接、缺失目录及缺失聚合；无引用也需枚举对应目录。每次更换输出文件，已有报告不覆盖，输出链接不跟随。仅GET导出，不自动创建附件目录、不修复/迁移/删除数据。报告正文不落盘；未引用产物或图片的计数不证明可清理。`passed`仅表示工具scope内检查，不能替代大纲引用盘点、迁移评审、事务快照、LOB/备份恢复或GitLab验收。目录扫描要求稳定的本机目录，不能当作对抗并发目录替换的安全沙箱。

`HANDBOOK_BROWSER_CHECK=1 node --test tests/unit/agent-runner/gitlab-managed-resource-delivery.test.js`验证冻结图片通过真实本机HTTP送审、审核阅读组件与手册总览的Chromium图片解码、合并回读；7项原生测试，不代表13510共享部署或企业GitLab验收。

## 审核决定候选摘要回归

```bash
runtime/agent-runner/node_modules/.bin/jest --config tests/unit/agent-runner/jest.config.js --runInBand tests/unit/agent-runner/incremental-build-api.test.js
HANDBOOK_BROWSER_CHECK=1 node --test tests/unit/agent-runner/handbook-incremental-review.test.js
```

前者20项含真实HTTP对通用/手册审核的错误摘要零副作用、通过/退回、空值/错误类型、同键重试/异体冲突及终态保护。后者显式开启Chromium页面验证，通过“更多→提交审核→选择文档→下一步”送审；可视化编辑先等待编辑器after就绪标记，再实际输入。实际通过/退回请求必须携带所渲染候选摘要，过期摘要保留待审，失败重试及MR恢复保持冻结正文。2项通过、不跳过；未设置开关时不包含浏览器证据。使用本机真实HTTP handler与内存仓储、模拟GitLab；不包含外部模型、真实数据库或企业GitLab写入。当前产品仍为整批审核，逐篇列表不等于逐篇决定。


## 生产内容离线备份和恢复演练

`node --test tests/unit/agent-runner/production-content-backup.test.js`通过真实本机HTTP及文件操作，验证正文/附件/历史任务冻结图片备份恢复、源图片删除后恢复、聚合与文件并发变更、封存后篡改、符号链接、已有目录和孤立文件处理。工具只GET Storage，不写数据库；离线恢复会启动短暂的本机只读导出适配器，复用内容盘点检查恢复后的引用和字节。不能代替YashanDB事务快照、数据库恢复、LOB或正式迁移验收。

```bash
YASDB_STORAGE_URL=http://127.0.0.1:14210 KC_ATTACHMENT_ROOT=runtime/agent-runner/handbook-production/attachments KC_SOURCE_IMAGE_ROOT=runtime/agent-runner/handbook-production/source-images KC_CONTENT_BACKUP_OUTPUT=runtime/test-results/production-backup/new-backup node tools/repository/backup-production-content.cjs
KC_CONTENT_BACKUP_MODE=restore KC_CONTENT_BACKUP_ROOT=runtime/test-results/production-backup/new-backup KC_CONTENT_BACKUP_OUTPUT=runtime/test-results/production-backup/new-restore node tools/repository/backup-production-content.cjs
```

父目录须事先存在，输出须位于runtime且为全新独立目录；源与目标不得重叠，不覆盖现有备份或恢复目录。备份包含原始正文、来源等私有数据，目录0700、文件0600，不提交或复制到正式设计。缺失目录和孤立文件照实记录；备份可成功复制但inventoryPassed=false，此时passed=false并以非零退出，恢复拒绝。备份前后完整聚合比对及资源二次扫描只能检测所观测变更，不等同于停写或跨聚合事务；正式恢复需独立批准方案。本工具不删除任何源资源、不自动恢复缺失附件、不触发GC。


T13浏览器性能报告另含点击后的longTasks数值，作为主线程阻塞诊断；函数级CPU采样须与正式性能验收分开。`node --test tests/unit/agent-runner/handbook-demand-read.node.test.cjs`当前7项覆盖映射并行、分支固定、拒绝及迟到响应保护。10路超预算仍判失败。

公共滚动实时刷新只检查声明区，显式inspectScrollContract仍默认全树诊断，E2E继续覆盖八模块未声明滚动区。滚动单元11/11，当前工作台+滚动双浏览器28通过4外部条件跳过；10路性能仍失败，不以功能通过替代性能验收。

T13函数阶段诊断使用`KC_PERF_DIAGNOSTICS=1`显式启用，报告`measurementMode=diagnostic`；默认不启用，报告`measurementMode=formal`。诊断报告的`measures`采用与请求/长任务相同的点击时间原点，只记录函数阶段名和数值。诊断耗时不作为正式预算验收；必须另跑默认模式，仍使用原1/5/10路、30次浏览器及每档100次API配置。

`handbook-incremental-review.test.js` 补充真实页面渲染断言：单篇通过/待审不被整批退回覆盖，待审不被整批通过覆盖，并保留旧数据回退。此测试不替代浏览器与企业GitLab验收。

P0/P1手册浏览器套件新增逐篇审核提示混合状态用例，注入渲染输入，不改业务数据。20261029-183907隔离运行Chromium通过，Firefox建页阶段SessionStore异常未进入断言；该失败保留，不能宣称双浏览器通过。


生产写作API测试 `tests/unit/agent-runner/handbook-production-api.test.js` 的HTTP模型目录与注入生成服务必须使用同一模型治理实例；夹具使用固定的本地不可达模型地址及隔离生成器，避免依赖本机当前Agent配置。模型版本校验保持启用。2026-10-29整组25通过、2跳过；跳过不作为实际数据库或企业GitLab验收证据。


托管图片交付用例 `gitlab-managed-resource-delivery.test.js` 支持 `HANDBOOK_DELIVERY_DATABASE=1`：仅允许统一入口提供的本机隔离Storage（拒绝14210），按run id隔离草稿与增量任务聚合。使用正式HTTP保存、送审、审核、发布及草稿回读；GitLab和身份仍为夹具，文件模式的大纲上下文不代表真实数据库治理门禁已验收。新服务实例读取持久化完成状态，报告写入本次运行目录的 `delivery-database-http.json`。不可直接指向共享Storage运行。

托管图片交付数据库用例同时覆盖退回、正式PUT修改、revisionOfTaskId重新送审及旧候选/退回意见保持不变。`delivery-database-http.json`新增rejectedTaskId、rejectionHistoryPreserved、revisedDraftRevisionId。企业GitLab仍为本地HTTP夹具。

入口套件`knowledge-center-entry.spec.js`在失败时附加“入口加载诊断”：有界请求时间线、页面异常及shell最终状态，不记录凭据或响应正文；超时与业务断言保持不变。

托管图片浏览器与数据库联合补验：统一隔离入口环境中同时设置`HANDBOOK_DELIVERY_DATABASE=1`与`HANDBOOK_BROWSER_CHECK=1`，运行`gitlab-managed-resource-delivery.test.js`的真实生产HTTP用例。浏览器单篇和总览共用所选手册标识，不能写死HB-1；覆盖冻结三图解码、退回重审、缺图/篡改阻断、模拟合并及新服务数据库完成回读。企业GitLab与身份仍为夹具。

连接池并发复用回归：`node --test tests/unit/agent-runner/jdbc-pool-reuse.node.test.cjs`，使用Java JDBC替身和可控线程顺序验证等待建连锁期间归还的连接被复用，避免无必要建连；不是实际数据库性能验收。

该回归同时覆盖网络断开但驱动仍报告未关闭的空闲连接淘汰、归还回滚失败的容量释放、重复关闭及旧租约禁止继续写入，保证数据库恢复后连接池能够恢复借用；替身故障验证不代表真实CAS账号登录验收。

连接池替身回归同时验证锁外并行建连、在建连接计入容量、建连失败释放名额、初始化失败关闭原连接；真实冷启动性能仍须单独实测。

托管图片正式HTTP交付用例补验提交已应用但响应丢失：首次请求失败不能显示completed，重试对账后只保留一个commit；模拟合并后正文漂移必须拒绝完成，恢复正确正文后才可确认一致。数据库模式报告增加lostCommitResponseRecovered与mergedContentDriftRejected。GitLab仍为本地HTTP夹具，不代表企业仓库验收。

合并申请丢响应恢复：托管图片套件新增MR已创建但响应连接中断的HTTP夹具，验证连接器查询已有MR恢复，重放不重复创建commit或MR。正式生产HTTP及隔离数据库模式沿用该故障，报告记录lostMergeRequestResponseRecovered；创建MR后completion仍不得为completed。套件现8项，企业GitLab未验收。

正式生产HTTP交付用例新增两个不同幂等键同时publish：都应成功回读同一MR，commit和MR各一份，未合并不完成；统一数据库模式同样执行。旧实现已复现APPROVAL_REQUIRED 409，失败日志保留。覆盖单handler实例排队，不证明多进程互斥。

两篇联合交付补验：托管图片正式HTTP用例现包含两篇文章，覆盖仅部分通过不能发布、退回修改后未改篇继承、两篇草稿回读和同批正文图片交付。普通8项通过；统一隔离数据库入口定向1项通过。GitLab和身份仍为本地夹具，不能替代真实页面或企业GitLab验收。报告新增documentCount、unchangedApprovalCarried、partialApprovalDeliveryBlocked及bothDraftsReadback字段。

审核工作台新增逐篇退回重审浏览器回归：真实审核HTTP、两篇通过/退回、服务创建修订后未改篇继承、修改篇重审及旧原因留存。Chromium/Firefox定向2/2通过。内存仓储和本地身份/GitLab夹具，不替代真实数据库写作页面重新送审验收。

两手册四文档隔离：`handbook-incremental-review.test.js`通过正式草稿/送审/审核HTTP验证相同documentId跨手册独立保存、同版本重复送审复用、退回不影响另一手册、四篇正文回读。内存仓储与本地GitLab/身份夹具，不替代真实数据库和浏览器验收。定向5/5通过。

`HANDBOOK_BROWSER_CHECK=1`的手册增量HTTP回归增加实际Chromium退回→返回写作→编辑→保存并重新送审→新候选正文与接续关系核对→再审核→模拟MR。编辑后等待“保存并提交审核”业务状态，多手册链接按handbookId限定。统一入口运行201423定向5/5通过；内存仓储与身份/大纲/GitLab夹具，不替代真实数据库页面和企业合并验收。


手册增量HTTP回归支持`HANDBOOK_REVIEW_DATABASE=1`：仅在统一隔离入口下，结合`HANDBOOK_BROWSER_CHECK=1`运行`handbook-incremental-review.test.js`。按run id隔离草稿/增量聚合，拒绝共享14210，从治理接口选取两个不同手册的有效大纲ID。覆盖页面退回→编辑→保存重审及两手册四文档HTTP隔离，最后用新建聚合读取对象核对持久化记录，报告为运行根目录`writing-review-database.json`。201841运行5/5通过、无重试跳过；身份、页面树和GitLab仍为夹具，不证明真实模型或企业GitLab合并验收。

入口工作台复测：`knowledge-center-entry.spec.js`在统一隔离入口20261029-202206-315243-e2e中，Chromium/Firefox共28/28通过，无失败和跳过；覆盖四种屏幕尺寸、八个模块可达、深链/刷新/后退、数据不可用恢复提示、移动焦点隔离和桌面独立滚动。历史入口首试状态等待失败仍保留，单次复测不等于并发性能或共享13510部署验收。日志：`runtime/test-results/continuation-20261029/entry-diagnostic.log`。

2026-10-29多篇写作页送审：修复刷新后遗漏未打开草稿，隔离入口203630的真实test_hy+Chromium定向5/5通过；两篇联合送审、部分通过禁止交付、第二篇退回保留第一篇结论及数据库新对象回读已验证，报告`runtime/test-results/e2e/20261029-203630-468852-e2e/writing-review-database.json`。真实模型、身份及企业GitLab不在本次验收范围。

2026-10-29两篇写作页面退回重审补验：统一隔离test_hy入口20261029-205325-644451-e2e，`handbook-incremental-review.test.js`定向5/5通过、零跳过。覆盖A通过B退回、只修改B后A继承通过、B重新审核并创建模拟MR，两篇冻结正文分别核对；数据库新对象回读一致。报告`runtime/test-results/e2e/20261029-205325-644451-e2e/writing-review-database.json`，日志`runtime/test-results/continuation-20261029/writing-batch-revision-database-verified.log`。身份、页面树及GitLab仍为夹具，不能代替企业合并验收。

T05同名文档跨手册页面隔离：`handbook-incremental-review.test.js`在统一入口20261029-205936-506687-e2e中，真实test_hy聚合与Chromium切换两本手册，分别读取相同`doc-1`的独立正文，定向5/5通过。页面目录树、身份和GitLab是夹具；日志`runtime/test-results/continuation-20261029/two-handbooks-browser-database-verified.log`。

T13目录图标CPU实验：统一隔离入口20261029-211310-941698-e2e，正式报告`runtime/test-results/e2e/20261029-211310-941698-e2e/details/handbook-function-formal.json`。浏览器1/5/10路目录P95为84.4/130.6/202.3ms，10路仍超200ms；诊断模式另有1路失败样本，不计正式验收。工作台跨浏览器回归20261029-211712-645733-e2e为14通过、4跳过，验证16px CSS mask、目录滚动、局部刷新及窄屏，跳过项不计真实模型或授权仓库验收。实验未改变正式预算。

2026-10-30写作隔离夹具修正：production-writing.cjs默认让模型目录与生产服务共享Agent治理实例，显式注入modelGovernance仍优先使用。避免平台Agent迁移后页面选择版本与旧全局执行版本冲突。长文增量检查对明确生成失败立即报错，不等待完整超时。真实模型补验结果见续作交接。


MR 交付观察回归：`HANDBOOK_BROWSER_CHECK=1 node --test tests/unit/agent-runner/handbook-incremental-review.test.js` 覆盖提交后待人工合并、点击刷新后仍 pending、提交数和 MR 数不变、合并接口调用为零；`review-workbench-contract.test.js` 覆盖只读角色无刷新权限及完成必须同时满足正文和图片回读。企业仓库验证不得使用本地模拟合并替代，真实 MR 禁止自动合并。


GitLab范围不足恢复：连接器对上游403 + insufficient_scope返回GITLAB_INSUFFICIENT_SCOPE，提示管理员开通所需API权限并重新授权；普通403保持原分类。平台真实HTTP回归位于gitlab-api-http.test.js。OAuth已连接不代表获得仓库写入权限，禁止靠重复提交MR解决授权范围不足。

MR状态恢复回归：`HANDBOOK_BROWSER_CHECK=1 node --test tests/unit/agent-runner/handbook-incremental-review.test.js` 通过页面刷新正式HTTP接口，覆盖上游MR关闭、重新打开、pending状态保持、零额外提交/零额外MR/零合并调用。GitLab和身份为隔离夹具；不代表企业MR验证。数据库模式仍须通过统一隔离入口。

关闭MR回归另覆盖正式任务详情GET及生产任务默认阶段，确保跨审核/生产页面均显示关闭事实；数据库报告增加browserClosedMrCrossPageConsistency。

版本汇总浏览器回归覆盖：较新已完成任务不能掩盖较旧未完成任务，行链接进入未完成任务；全部完成版本显示等待后续变更。此用例任务数据为HTTP夹具，不作为企业交付验收。


MR人员映射回归：gitlab-participants.test.js使用真实本地HTTP覆盖分页、平台身份别名、审核人去重、缺失/重名/停用/不可访问；gitlab-managed-resource-delivery.test.js覆盖创建时角色传递、响应丢失恢复、回读冲突及幂等；handbook-incremental-review.test.js覆盖正式API鉴权、无效负责人零写入与浏览器选择/取消。数据库模式须通过tests/run_tests.py统一test_hy隔离入口，企业只读解析证据不能替代真实人员指派验收。

联合真实模型验证：统一test_hy隔离入口同时设置`HANDBOOK_BROWSER_CHECK=1`、`HANDBOOK_REVIEW_DATABASE=1`、`HANDBOOK_REVIEW_LIVE_MODEL=1`运行`handbook-incremental-review.test.js`。共用Agent模型目录/执行配置，页面润色→采用保存→刷新→送审→审核→选择负责人→模拟MR，核对冻结与提交正文、模型来源和新聚合读取。报告`live-model-review-mr.json`；身份、大纲树、GitLab仍为夹具，不证明企业全链路。真实模型调用为显式开关，常规回归不调用。

联合真实模型首个通过记录：20261030-102550-376242-e2e，5/5、零跳过；gpt-6-sol、真实test_hy、Chromium采用/审核/提交内容一致、新聚合回读一致、合并调用零。企业人员映射另以连接器创建!661并读回heyang两个角色，不与该模拟GitLab页面用例混称企业全链路。


两手册四篇页面联合回归：统一隔离入口20261030-103350-874200-e2e为5/5、零跳过，真实test_hy+Chromium完成第二本手册两篇送审、未分配审核人被拒绝、切换指定审核人逐篇通过、选择合入负责人创建模拟MR；第一本手册完整状态不变。报告`two-handbook-four-document-browser.json`。身份、大纲树及GitLab仍为夹具。可追加显式开关`HANDBOOK_WORKFLOW_SCREENSHOTS=1`，在运行根目录`workflow-walkthrough/`生成编写、保存、送审、审核及MR共11步原始截图和`steps.json`，仅用于流程观察，不修改产品UI。“保存”指平台共享草稿，并非下载本地文件。

2026-10-30流程提示回归：统一test_hy运行20261030-104656-119702-e2e为5/5、零跳过；浏览器逐篇通过后校验可创建MR说明与按钮一致，正式HTTP审核投影契约21/21。截图查看交付另提供内嵌HTML和11页PDF，不能替代企业身份/MR同次页面验收。


2026-10-30 AI生成无反馈回归：`production-writing.test.cjs` 新增1366/390px嵌入长文慢速prepareOrigin检查，来源未就绪前零生成POST，状态立即可见；任务开始与完成后候选自动进入视口，不借助手动滚动截图。修改前复现失败，定向两项通过；完整浏览器13通过、2条件跳过（增加390px用例前），独立启用真实模型润色/阶段/采用/HTTP回读1/1通过。证据runtime/diagnostics/ai-result-visibility-20261030/。

T08写作页交付状态：统一test_hy运行20261030-105235-058355-e2e 5/5、零跳过、自有服务清理；最终普通HTTP回归5/5，含完成标签回读与HTML转义。

### AI 写作对话布局回归（2026-10-30）

`node --test tests/e2e/agent-runner/production-writing.test.cjs` 覆盖图标按需展开、桌面/390px 写作对话、慢来源检查、引用拖拽排序、模板与 Skill 传递、进度和候选可见性、采用后的 HTTP 草稿回读。该 fixture 使用真实后端路由、隔离内存草稿和确定性模型；真实模型需显式设置 `WRITING_LIVE_MODEL=1`，不能将 fixture 结果称为共享平台个人账号全流程验收。

双滚动用例还验证嵌入写作时正文与 AI 历史对话分别滚动、格式栏和输入区保持位置、侧栏调整后不横向溢出、1024px 仍为双栏以及关闭后恢复原工作台；历史读取和候选使用真实隔离 HTTP API。测试过程仅复制历史对话 DOM 来模拟长记录，不把复制内容当作服务端历史。


## 任务管理 V2 验证

2026-11-09：`document-task-catalog.test.js` 覆盖有效主责、旧单项分工、协作角色冲突和未绑定；`document-tasks-route.test.js` 通过隔离文件存储与真实 HTTP 覆盖首次自动匹配、已有分派优先、显式改选、失效人员及新增文档必须指定负责人。

## 日志专项验证

运行 `npm run test:logging`，覆盖日志上下文、敏感字段脱敏、gzip 可还原、活动日志保护、重复执行幂等和诊断包关联。`knowledge-center.sh logs compress` 的结果及失败原因会写入 `runtime/.../logs/knowledge-center-isolated/lifecycle.log`。真实跨服务与专用数据库故障验收需单独运行隔离 E2E；当前本轮不连接现有数据库，也不重启部署实例。

- HTTP：`npx jest --config tests/unit/agent-runner/jest.config.js --runInBand --runTestsByPath tests/unit/agent-runner/document-tasks-route.test.js tests/unit/agent-runner/outline-route-boundaries-http.test.js`。覆盖可信会话、两级判断、导入、并发/幂等、新增候选与完成门禁。
- 页面及迁移：`node --test tests/unit/agent-runner/document-tasks-frontend.test.cjs`，真实模块+HTTP，隔离文件存储、夹具人员/目录/交付。企业人工合并回读必须另行真实验收。
- 证据：`runtime/diagnostics/task-management-20261030/`；实际平台只读验收及资源摘要与隔离测试分别记录。


2026-10-30 范围选择纠偏：首次从其他模块进入任务管理必须实际加载任务与权限上下文，覆盖冷进入回归；手册/文档范围弹窗采用已确认PNG的紧凑步骤、工单信息、搜索多选及逐项指派。指定工单输入为 `knowledge/refs/pingcode/工单列表/PingCode-YashanDB研发项目-工单清单.xlsx`（530条），编号为全局唯一工单单号，重复导入仅更新来源。验证证据位于 `runtime/diagnostics/task-management-scope-20261030/`。

2026-10-30：任务管理写入兼容HTTP下无crypto.randomUUID环境；改派移除理由输入，保留审计。接口与浏览器回归覆盖无理由改派和默认责任人保存回读。

2026-10-30：任务列表列名改为开始时间、结束时间；管理员和当前责任人可直接点击列表时间打开日历，普通非责任人只读，后端同步验证。

2026-10-30 时间冲突纠偏：打开日历先读取单任务最新版本；编辑期间遇REVISION_CONFLICT保留日期时间，提供“重新读取”显示最新开始/结束时间，用户核对后再次确认。不自动覆盖并发变更，保留服务端版本校验。回归覆盖陈旧列表、打开后并发变更、读取后重试及连续编辑。


### 2026-11-02 AI 写作打开性能回归

`node --test tests/e2e/agent-runner/production-writing.test.cjs` 覆盖原编辑器复用、无 Markdown 中间态、配置按需请求、生成前来源检查、双滚动、关闭恢复、历史候选不改正文和采用后的真实 HTTP 保存回读。后端 `production-ai-service.test.js` 另覆盖历史列表只读及过期状态投影不写回聚合。隔离 HTTP/浏览器证据不等同于真实账号、数据库、GitLab 的性能验收；真实模型用例条件不满足时跳过并单列。证据：`runtime/test-results/production-writing/perf-*`。


### 2026-11-02 任务管理性能与工作台按需详情回归

`node --test tests/e2e/agent-runner/dashboard-lazy-dialog.node.test.cjs` 验证工作台默认不构建隐藏领域详情、仅构建当前领域、保留人员选择与刷新后内容。任务聚合异步HTTP回归见 `tests/unit/agent-runner/aggregate-store-async.node.test.cjs`；实际页面18项及隔离操作10项完整性能证据与脚本位于 `runtime/diagnostics/task-performance-fix-20261102/`。实际共享平台仅只读测量，隔离文件写入成绩不代表真实数据库写性能。


### 2026-11-02 富文本仓库图片回归

`production-writing.test.cjs` 的“仓库图片”两例覆盖复用/新建编辑器、中文相对图片路径、Markdown预览、候选对照和采用后真实HTTP回读，断言保存正文仍为原始相对引用。GitLab图片二进制使用浏览器路由替身，其他写作API使用真实隔离后端；不替代个人授权下的企业仓库实图验证。


### 2026-11-02 参考文档选择与长列表回归

`node --test tests/e2e/agent-runner/production-writing.test.cjs`覆盖知识库直接移除/重加、目录延迟返回不回填、显式空引用真实HTTP生成、历史恢复、8份本地文档上传、搜索及来源筛选保留全局序号、过滤时禁止排序、拖拽及Alt键排序、折叠、固定工具栏与独立列表滚动、桌面及390px布局。知识库使用隔离HTTP MCP服务，以实际调用计数验证移除后无检索、重新加入后有检索。生成模型为确定性替身，真实模型测试保留原条件门禁；不声称验证企业知识库内容或模型质量。`production-ai-service.test.js`另外覆盖显式空数组/旧客户端默认/非法顺序，以及Codex配置屏蔽、失败重试与全局配置不变。

2026-11-05 参考文档数量显示修复：默认4项与“还有 N 项”文案；长列表场景在第四项加入后检查其整行处于可视区域，继续验证展开、筛选、移除、独立滚动及390px无横向溢出。

2026-11-05 本地参考文档增加 HTML/HTM：`production-writing.test.cjs` 通过浏览器文件选择和拖拽调用真实上传 API，校验 HTML 正文提取、非正文和脚本排除、外部图片不自动读取、非法 UTF-8 不入引用，以及已上传 HTML 进入生成请求；原 Markdown 上传和优先级回归同时运行。

模板管理 2026-11-04 追加回归：映射页自动轮询与离开后停止、回访生效记录、中文规则表单、高级 JSON 兼容、批量显式选择与筛选清空、502条映射浏览器回访与分段展示、768/390px 无横溢、只读权限，以及取消编辑不遗留正文。隔离浏览器测试仍使用真实路由和 HTTP，模型与存储为替身；性能数据参见本次专项报告。
模板管理补充回归：`template-workspace.cjs` 验证富文本首次输入可撤销、远程图片 Markdown 引用保留且预览不发起远程图片请求；`template-mapping-service.test.cjs` 验证停用模板后旧规则不再提出该模板，以及目录集合变化使发布预览摘要失效。真实模型质量、test_hy 数据库并发和真人读屏不由这些隔离测试代替。
模板工作区键盘回归还验证页签左右方向键、Home/End、异步加载后的焦点、目录分隔条按键调宽后的焦点与 aria-valuenow，以及可见操作控件名称。标题选区 Ctrl+B 在当前富文本编辑器中不会写入 Markdown；普通段落选区加粗已通过。仓库七类模板与大纲标题真实 Codex 小样本抽检脚本为 `tests/e2e/agent-runner/template-mapping-repo-model.cjs`，Codex HTTP 信封回归为 `template-mapping-codex-http.cjs`；原始记录见 `runtime/test-results/template-management/`，不代表长期生产准确率。

工作台方案二回归：`NODE_PATH=runtime/agent-runner/node_modules node --test tests/e2e/agent-runner/knowledge-center-my-work.node.test.cjs`。隔离真实 HTTP 夹具覆盖 2 待办 + 1 跟进统计、三来源渐进加载、503 降级、搜索焦点、详情弹窗、无模板探测及 390px 布局；完整应用用同一标签从知识资产返回工作台并核对未重载 HTML。测试生成的实际页面截图在 `runtime/test-results/workbench-optimization-20261105/`。夹具计时不代表共享账号下的生产性能。
模板映射真实模型抽检为显式运行：`NODE_PATH=runtime/agent-runner/node_modules node tests/e2e/agent-runner/template-mapping-live-model.cjs`。只发送匿名标题、栏目和候选模板，不写平台映射；原始逐条输出及耗时保存在 `runtime/test-results/template-management/model-samples.json`。`agent-governance-default.test.cjs` 验证默认项携带版本并可解析；`template-mapping-model-output.test.cjs` 验证普通 JSON 与 Codex markdown 信封兼容。少量样本不代表生产准确率。

### 全平台固定分母覆盖率目标续作

2026-11-05 22:32 Java 大纲候选版本续验：扩展 `StorageDomainReadHttpCheck.java`，通过 `insertOnly` 真实 HTTP 写入新的 draft 大纲候选，验证版本/节点序列写入、手册归属、候选 GET 回读及当前已发布指针保持不变；重复候选 ID 返回冲突且不产生额外提交或写入。固定 9 个 Java 产品源文件 JaCoCo 完整复采通过，行 2797/3360（83.24%）、分支 1506/2178（69.15%），证据 `runtime/test-results/java-outline-candidate/coverage-summary.json`。Node 最近完整结果为 13739/15936 行、12667/18043 分支；前端为 5320/9786 行、5754/13460 分支。三个运行时仍未达到行 100%、分支 95% 的目标。

2026-11-05 22:28 Java 手册与大纲快照续验：新增 `StorageManualSnapshotHttpCheck.java`，通过真实本地 HTTP 和隔离 JDBC 状态验证手册新增、更新、负责人替换、迁移批次去重、GET 回读及失败回滚；扩展 `StorageDomainReadHttpCheck.java`，验证已有大纲快照 PUT 的版本递增、子节点重建、当前版本指针、成功提交和 `insertOnly` 冲突后无新增写入。固定 9 个 Java 产品源文件 JaCoCo 完整复采通过，行 2778/3360（82.68%）、分支 1499/2178（68.82%），证据 `runtime/test-results/java-outline-snapshot/coverage-summary.json`；较上一已记录 Java 完整结果增加 249 行、97 分支。Node 最近完整结果为 13739/15936 行、12667/18043 分支；前端为 5320/9786 行、5754/13460 分支。三个运行时仍未达到行 100%、分支 95% 的目标。

2026-11-05 22:15 Java 建设任务指派与大纲发布续验：`StorageDomainReadHttpCheck.java` 经真实本地 HTTP 从任务列表获取页面 ID，验证缺失页面 404、团队外负责人 422、成员指派和清空后的 SQL 状态及 GET 回读；同一大纲发布路由验证已发布幂等、候选版本冲突、未分工拒绝和完整分工发布，核对版本、责任版本、当前指针的 SQL 绑定及治理回读。固定 9 个 Java 产品源文件 JaCoCo 通过：行 2529/3360（75.27%）、分支 1402/2178（64.37%），证据 `runtime/test-results/java-outline-publish-final/coverage-summary.json`；较前次完整 Java 报告增加 99 行、46 分支。Node 最近完整结果为 13739/15936 行、12667/18043 分支，前端为 5320/9786 行、5754/13460 分支；三运行时整体目标仍未达成。

2026-11-05 22:10 Java 已发布大纲治理写入续验：`StorageDomainReadHttpCheck.java` 经真实 `/v1/domain/outlines/outline-public/governance` PUT 验证缺少分工、旧版本、无效节点/领域、已发布正文锁定和清空分工的公开错误；合法分工更新断言责任记录删除/插入、摘要更新、版本从 3 到 4、负责人及 GET 回读。固定 9 个产品源文件 JaCoCo 复采通过：行 2430/3360（72.32%）、分支 1356/2178（62.26%），证据 `runtime/test-results/java-governance-write-success-v2/coverage-summary.json`；较前次 Java 完整报告增加 176 行、98 分支。Node 最近为 13739/15936 行、12667/18043 分支，前端为 5320/9786 行、5754/13460 分支。整体目标未达成。

2026-11-05 22:02 Java 迁移别名和启动边界续验：扩展 `MigrationExecutionCheck.java`，通过真实 `SchemaMigrationManager.migrate/verify` 与隔离 JDBC 事务验证历史版本别名可复用已执行迁移，未知/自身/数字版本不符/重复/空别名被拒；空 SQL 目录、缺失目录、未初始化数据库、首个脚本未建迁移表及空脚本均返回明确错误并回滚。另验证已记录摘要冲突时默认 `verify` 告警继续，而 `migrate` 拒绝且不执行 SQL 或提交。固定 9 个产品源文件 JaCoCo 复采通过：行 2254/3360（67.08%）、分支 1258/2178（57.76%），证据 `runtime/test-results/java-migration-policy-final/coverage-summary.json`；较前次 Java 完整报告增加 39 行、27 分支。迁移管理器自身为 157/171 行、120/136 分支。Node 最近仍为 13739/15936 行、12667/18043 分支；前端为 5320/9786 行、5754/13460 分支。整体目标未达成。

2026-11-05 21:57 Java 大纲完整列表真实 HTTP 续验：扩展 `StorageDomainReadHttpCheck.java` 的内存 JDBC 行集，通过真实 `/v1/domain/outlines` 返回一条带公开版本 ID 和 document 节点的已发布大纲，以及一条无当前版本的旧版 draft 大纲；断言列表中的版本、状态、节点路径、文档数和时间字段。固定 9 个产品源文件 JaCoCo 复采通过：行 2215/3360（65.92%）、分支 1231/2178（56.52%），证据 `runtime/test-results/java-outline-list-final/coverage-summary.json`；比上次 Java 完整结果增加 39 行、20 分支。Node 最近为 13739/15936 行、12667/18043 分支，前端为 5320/9786 行、5754/13460 分支，整体目标未达成。

2026-11-05 21:49 Node GitLab OAuth 回调真实 HTTP 续验：扩展同一隔离 GitLab 套件，在本地 `/oauth/token` 返回测试令牌，阅读者实际调用 `/oauth/start` 和 `/oauth/callback`，断言令牌交换、分支验证成功或失败、回跳参数、片段保留及账号状态回读。定向 15/15 通过。固定 Node 129 个 Jest 文件复采：128 套件通过、1 套件条件跳过，1312 项通过、7 项跳过；产品源码行 13739/15936（86.21%）、分支 12667/18043（70.20%），证据 `runtime/test-results/node-gitlab-oauth-callback-full/coverage-summary.json`。`routes/knowledge-center.js` 为 1508/1822 行、1530/2423 分支。前端仍为 5320/9786 行、5754/13460 分支；Java 为 2176/3360 行、1211/2178 分支，三运行时整体目标仍未达成。

2026-11-05 21:40 Node 审核仓库上下文真实 HTTP 续验：扩展 `gitlab-api-http.test.js`，沿用隔离 GitLab 与手册映射，请求 `/review/repository-context` 验证允许分支、语言、目录、默认 Markdown、提交号与分阶段 `Server-Timing`，并验证未映射语言、未启用分支和根内缺失 Markdown 的公开错误投影。定向 13/13 通过。固定 Node 129 个 Jest 文件复采：128 套件通过、1 套件条件跳过，1310 项通过、7 项跳过；产品源码行 13708/15936（86.01%）、分支 12650/18043（70.11%），证据 `runtime/test-results/node-review-repository-context-full/coverage-summary.json`。最大路由 `knowledge-center.js` 为 1483/1822 行、1522/2423 分支；前端和 Java 仍为 5320/9786、5754/13460 及 2176/3360、1211/2178。整体目标未达成。

2026-11-05 21:33 Node 平台上下文网关续验：扩展 `platform-context-gateway.test.js`，通过本地真实 HTTP 验证上下文清洗、超大响应/非法 JSON/超时/HTTP 错误；六类事实投影覆盖数组别名、显式总数、旧字段、缺失值、仅资料模块可用的降级聚合。定向 17/17 通过。固定 Node 129 个 Jest 文件复采：128 套件通过、1 套件条件跳过，1309 项通过、7 项跳过；行 13680/15936（85.84%）、分支 12627/18043（69.98%），证据 `runtime/test-results/node-platform-context-final/coverage-summary.json`。网关模块行 117/117（100%）、分支 135/155（87.09%），其分支仍未达标；前端最近为 5320/9786 行、5754/13460 分支，Java 为 2176/3360 行、1211/2178 分支。整体目标仍未达成。

2026-11-05 21:08 前端应用级表单边界续验：审核隔离 Chromium 场景通过产品 `submit` 监听器验证空小组名、未选择 Excel 文件和缺失 CAS 更正上下文，定向 1/1 通过。完整固定前端 Istanbul 采集通过，56 个源码文件、29 个写作及 15 个审核计数文件：行 5320/9786（54.36%）、分支 5754/13460（42.74%），证据 `runtime/test-results/frontend-form-boundaries-full/coverage-summary.json`；较此前同分母报告增加 11 行、6 分支。`app.js` 为 1522/4302 行、1157/4110 分支。Node 最近完整报告仍为 13577/15936 行、12431/18043 分支；Java 为 2176/3360 行、1211/2178 分支。三运行时目标均未达成，最近统一 `full --coverage` 门禁失败。

2026-11-05 21:22 Node 模型治理真实 HTTP 覆盖续作：新增 `model-governance-http-coverage.test.js`，以隔离内存配置管理器和确定性模型探测 Client，通过真实 `/platform/models`、`/platform/models/test`、`/production/models` 入口验证旧配置兼容、密钥不泄露、管理员鉴权、保存/版本冲突、服务字段边界、默认选择、凭据复用与清除、探测成功/空响应/超时/鉴权/限流错误。完整固定 Jest 清单 129 文件复采通过：128 套件通过、1 套件条件跳过，1304 项通过、7 项跳过；Node 固定产品源码行 13636/15936（85.56%）、分支 12570/18043（69.66%），证据 `runtime/test-results/node-model-governance-branches-full/coverage-summary.json`。模型治理单文件行 89/89（100%）、分支 172/181（95.02%）。前端仍为 5320/9786 行、5754/13460 分支；Java 仍为 2176/3360 行、1211/2178 分支。三运行时整体目标仍未达成。

2026-11-05 21:01 Java 大纲治理只读 HTTP 投影续验：`StorageDomainReadHttpCheck.java` 的内存 JDBC 增加显式领域归属、建设任务项和领域名称，通过真实 `Main.domainOutlines` HTTP 验证 `effectiveDocumentAssignments` 内同时包含领域 `7`、建设任务 ID 和负责人“何阳”，并核对文档/已分工计数。首次完整采集通过后复核发现夹具一处领域 ID 使用文本 `SQL`、另一处使用数字 `7`，可能只证明独立字段出现；统一 ID、收紧到有效分工子树断言并重跑，固定 9 Java 产品源码 JaCoCo 仍通过：行 2176/3360（64.76%）、分支 1211/2178（55.60%），证据 `runtime/test-results/java-outline-governance-http-final/coverage-summary.json`；较前次 Java 完整报告增加 116 行、44 分支。Node 最近完整结果为 13577/15936 行、12431/18043 分支，前端为 5309/9786 行、5748/13460 分支；全平台目标未达成。

2026-11-05 20:57 Java 大纲目录详情成功读取续验：`StorageDomainReadHttpCheck.java` 的内存 JDBC 增加公开 `SOURCE_REF`、当前版本头、文档节点和负责人行，通过实际 `Main.domainOutlines` HTTP 验证目录标识、文档标题、负责人、`Server-Timing` 与重复请求的相同投影。固定 9 个 Java 产品源文件 JaCoCo 通过，行 2060/3360（61.31%）、分支 1167/2178（53.58%），证据 `runtime/test-results/java-outline-directory-success/coverage-summary.json`；较上一 Java 完整报告增加 57 行、16 分支。Node 最近完整报告仍为 13577/15936 行、12431/18043 分支，前端为 5309/9786 行、5748/13460 分支；全平台目标未达成。

2026-11-05 20:51 Java 大纲公开读取边界续验：扩展 `StorageDomainReadHttpCheck.java`，通过实际 `Main.domainOutlines` HTTP 验证空大纲列表，以及缺失业务 ID、缺失旧数字 ID 的目录详情均返回 `OUTLINE_NOT_FOUND`。固定 9 个 Java 源文件完整 JaCoCo 通过，行 2003/3360（59.61%）、分支 1151/2178（52.85%），证据 `runtime/test-results/java-outline-read-boundaries/coverage-summary.json`；较上一 Java 完整报告增加 36 行、9 分支。Node 最近完整结果为 13577/15936 行、12431/18043 分支，前端为 5309/9786 行、5748/13460 分支；全平台目标仍未达成。

2026-11-05 20:48 Java 大纲目录真实 HTTP 续验：扩展 `StorageDomainReadHttpCheck.java`，通过本地实际 `Main.domainOutlines` handler 和内存 JDBC 行集验证空目录、含当前已发布大纲的目录、公开大纲 ID、手册/状态/文档计数及 `Server-Timing`。首次运行的夹具误把内部大纲 ID 当公开 ID；按实际 `SOURCE_REF` 投影修正后，固定 9 个 Java 产品源码 JaCoCo 通过，行 1967/3360（58.54%）、分支 1142/2178（52.43%），证据 `runtime/test-results/java-outline-catalog-http-final/coverage-summary.json`；较前次完整 Java 结果增加 54 行、7 分支。Node 最近完整报告为 13577/15936 行、12431/18043 分支；前端最近完整报告为 5309/9786 行、5748/13460 分支。全平台目标未达成。

2026-11-05 20:45 Java 团队 HTTP 输入边界续验：扩展 `StorageDomainReadHttpCheck.java` 的真实本地 `Main.teamGroups` API，验证非法团队 ID、创建无效 JSON、非法 `If-Match`、不存在的名册、无效和不存在的成员及方法拒绝。首次 JaCoCo 在新断言停止：实际非法版本错误码为 `INVALID_ROW_VERSION`，修正夹具期望后固定 9 个 Java 产品源文件完整采集通过，行 1913/3360（56.93%）、分支 1135/2178（52.11%），证据 `runtime/test-results/java-team-boundaries-final/coverage-summary.json`；较前次完整 Java 报告增加 5 行、13 分支。Node 最近完整报告为 13577/15936 行、12431/18043 分支；前端最近完整报告为 5309/9786 行、5748/13460 分支。三运行时目标仍未达成。

2026-11-05 20:42 人员导入解析与预检分支续验：扩展 `personnel-import.test.js` 的真实内存 Excel 错误矩阵和预检状态矩阵，并在平台目录 HTTP 用例加入内容损坏的 `.xlsx`、错误上传字段和空表单。空工作簿会先触发空 Sheet 错误，缺表头场景改用受控读取器验证独立解析契约。两套联合定向 14/14 通过；固定 128 个 Jest 文件复采为 127 套件通过、1 套件条件跳过，1299 项通过、7 项跳过。Node 行 13577/15936（85.19%）、分支 12431/18043（68.89%），证据 `runtime/test-results/node-personnel-branches-full/coverage-summary.json`；`personnel-import.js` 达 85/85 行（100%）、80/84 分支（95.23%）。该文件达标，三运行时总体目标仍未达成。

2026-11-05 20:32 人员 Excel 导入真实 HTTP 续验：在平台目录 Jest HTTP 夹具中通过内存 `xlsx` 工作簿和真实 multipart 上传，验证模板下载、预检摘要、无冲突应用、SHA-256/操作者转发、冲突阻断、无效模式、非 multipart 和非 `.xlsx` 拒绝。首次定向因 Node `FormData` 的中文文件名编码和跨用例调用次数断言失败，改用 ASCII 夹具文件名及本用例前后调用次数后 7/7 通过。固定 128 个 Jest 文件复采为 127 套件通过、1 套件条件跳过，1295 项通过、7 项跳过；Node 行 13573/15936（85.17%）、分支 12408/18043（68.76%），证据 `runtime/test-results/node-platform-import-full/coverage-summary.json`。`personnel-import.js` 为 81/85 行、57/84 分支，`knowledge-center.js` 为 1438/1822 行、1479/2423 分支。全平台目标未达成。

2026-11-05 20:27 平台团队与人员目录真实 HTTP 固定 Node 覆盖续作：新增 `knowledge-center-platform-directory-http-coverage.test.js`，本地实际 HTTP 调用产品路由，内存 `domainStore` 模拟数据库边界；验证管理员权限、团队筛选列表/创建/详情/名册预览/版本及幂等键、人员筛选列表/创建/更新、方法限制和已知错误映射。定向 5/5 通过；固定 128 个 Jest 文件复采为 127 套件通过、1 套件条件跳过，1293 项通过、7 项跳过。Node 产品源码行 13525/15936（84.87%）、分支 12373/18043（68.57%），证据 `runtime/test-results/node-platform-directory-full/coverage-summary.json`；`routes/knowledge-center.js` 为 1410/1822 行、1461/2423 分支，较上一固定报告增加 63 行、54 分支。前端与 Java 仍沿用最近完整结果，全平台目标未达成。

2026-11-05 20:21 工作台真实 HTTP 固定 Node 覆盖续作：新增 `knowledge-center-workbench-http-coverage.test.js`，以实际 `createKnowledgeCenterHandler` 和本地 HTTP 请求验证责任人目录、只读预览、正式代办、联合查询、本人/管理员权限、方法限制、缺失/停用责任人、非法条件及任务来源损坏时的部分可用响应；临时文件位于 `runtime/test-results`。定向 4/4 通过；固定 127 个 Jest 文件完整复采为 126 套件通过、1 套件条件跳过，1288 项通过、7 项跳过。Node 产品源码行 13462/15936（84.47%）、分支 12319/18043（68.27%），证据 `runtime/test-results/node-workbench-http-full/coverage-summary.json`；`routes/knowledge-center.js` 为 1347/1822 行、1407/2423 分支，较上一固定报告增加 59 行、75 分支。前端与 Java 最近完整结果仍低于目标，全平台目标未达成。

2026-11-05 20:15 工作台编号分支续验：扩展 `workbench-numbering-coverage.test.js`，覆盖空与旧版记录、非目标/完全可见手册、缺少子任务号和日期、重复活动文档及空活动手册。定向 11/11 通过，编号模块行 76/76、分支 125/130（96.15%），达到该文件的行与分支目标。统一入口 `full --dry-run --coverage` 能发现本轮与前轮新增 Jest 文件；固定 126 个 Jest 文件再次完整通过，125 套件通过、1 套件条件跳过，1284 项通过、7 项跳过。Node 固定产品源码行 13403/15936（84.10%）、分支 12244/18043（67.86%），证据 `runtime/test-results/node-workbench-numbering-branches-full/coverage-summary.json`。全平台目标仍未达成。

2026-11-05 20:09 工作台编号固定 Node 覆盖续作：原生 `node:test` 回归保留并 3/3 通过；新增 `workbench-numbering-coverage.test.js` 用内存工单/审核链验证跨快照编号稳定、重审关联、历史 `HIST` 避让、循环引用、跨工单歧义、可见范围和冲突码，Jest 定向 7/7 通过。固定 126 个 Jest 文件复采为 125 套件通过、1 套件条件跳过，1280 项通过、7 项跳过；Node 产品固定清单行 13403/15936（84.10%）、分支 12228/18043（67.77%），证据 `runtime/test-results/node-workbench-numbering-full/coverage-summary.json`。编号模块为 76/76 行、109/130 分支（83.84%）；行已全覆盖，分支尚未达到 95%。前端与 Java 仍沿用最近完整报告，全平台目标未达成。

2026-11-05 20:03 工作台联合查询固定 Node 覆盖续作：发现 `workbench-query.test.js` 未进入上次精确 Jest 清单，补充文本/枚举/日期、去重/分面/搜索、来源完整性和无效输入 422 契约后定向 6/6 通过；`routes/workbench-query.js` 达 68/68 行（100%）、129/133 分支（96.99%）。固定 125 个 Jest 文件复采为 124 套件通过、1 套件条件跳过，1273 项通过、7 项跳过；Node 产品固定清单行 13349/15936（83.76%）、分支 12145/18043（67.31%），证据 `runtime/test-results/node-workbench-query-full/coverage-summary.json`。前端与 Java 沿用最近完整报告，三个运行时仍未达到目标。

2026-11-05 19:56 Codex Worker 固定 Node 覆盖续作：`codex-worker-coverage.test.js` 在 Jest 隔离模块中执行真实 Worker 源码，用受控 stdio 响应 app-server 请求，验证有效与无效产物、配置和授权文件清理、审批拒绝、工具/错误事件、stderr 脱敏及取消中断请求；定向 3/3 通过，单文件行 96/96、分支 69/95。连同运行器隔离进程测试复采固定 124 个 Jest 文件，123 套件通过、1 套件条件跳过，1267 项通过、7 项跳过；Node 固定 15936 行中覆盖 13287 行（83.37%），18043 分支中覆盖 12016 分支（66.59%），证据 `runtime/test-results/node-codex-worker-final/coverage-summary.json`。`codex-runner.js` 为 84/93 行、77/97 分支。前端最近完整报告为 5309/9786 行、5748/13460 分支；Java 最近完整报告为 1908/3360 行、1122/2178 分支。三套运行时仍未达目标，统一 `full --coverage` 最近一次门禁失败，不能把本次 Node 通过当成全平台验收。

2026-11-05 19:40 模板映射服务固定 Node 覆盖续作：新增 Jest 隔离内存存储回归 `template-mapping-coverage.test.js`，验证规则校验/冲突/预览摘要、版本冲突、AI 建议与失败、取消、确认、分页和旧映射；定向 3/3 通过，服务单文件行 116/116、分支 155/195。统一 `full --coverage` 的固定 Node 清单覆盖报告为行 13218/15985（82.69%）、分支 12187/18436（66.10%）；同一服务为行 116/116、分支 162/195，Java 为行 1908/3360、分支 1122/2178。统一入口 75/78 任务成功，审核页面交互性能 P95 超 150ms，其他端到端页面还有失败，前端采集审核场景超时，因此该次统一门禁失败，证据 `runtime/test-reports/2026-11-05/20261105-185401-183801-full/`。随后发现审核页当前将完整路径放在上下文节点 `title`，可见摘要只显示文件名；修正旧断言并定向 1/1 通过。隔离空闲 `gate --jobs 1` 整体通过，但知识资产首屏首次失败、重试通过，见 `runtime/test-reports/2026-11-05/20261105-193143-841640-gate/`。再独立运行前端固定分母采集通过，56 个源码文件、29 个写作和 15 个审核计数收齐，行 5309/9786（54.25%）、分支 5748/13460（42.70%），证据 `runtime/test-results/frontend-template-mapping-corrected/coverage-summary.json`。前端分母较上一轮变化，不能把百分比差异全归因于本次测试；三套运行时仍未达目标，全量回归也未通过。

2026-11-05 18:49 前端仓库映射目录树续验：在隔离真实 Chromium 页面构造映射表单和内存目录投影，通过产品文档事件处理器验证目录展开、搜索命中/空结果、中英文路径选择、标签移除及预览；定向 1/1 通过，没有保存映射或写入业务数据。完整前端固定分母采集通过，56 个源码文件、29 个写作计数和 15 个审核计数全部核对：行 5346/9788（54.61%）、分支 5764/13504（42.68%）；`app.js` 行 1505/4300、分支 1146/4112。较前一完整前端报告增加 219 行、232 分支，其中 `app.js` 增加 196 行、168 分支。证据 `runtime/test-results/frontend-mapping-tree-full/coverage-summary.json`。Node 和 Java 最近完整结果分别仍为 13018/15848 行、11724/18010 分支，以及 1908/3360 行、1122/2178 分支；全平台目标未达成。

2026-11-05 18:40 前端导航与键盘状态续验：隔离真实 Chromium 审核页面新增移动菜单打开/遮罩/关闭/Escape、桌面侧栏折叠/隐藏/恢复、生产行 Enter、大纲页签左右/Home/End、上下文菜单和信息抽屉 Escape，以及会话失效回登录态；定向 1/1 通过。完整固定分母前端采集通过，29 个写作计数及 15 个审核页面计数均收齐，行 5127/9788（52.38%）、分支 5532/13504（40.96%）；`app.js` 行 1309/4300、分支 978/4112，证据 `runtime/test-results/frontend-mobile-navigation-full/coverage-summary.json`。较上次完整报告分别增加 60 行、27 分支，`app.js` 增加 26 行、41 分支。先前把单个新场景计数合并入旧完整报告得到更高临时数值，因采集路径存在差异未用作验收。当前 Node 为 13018/15848 行、11724/18010 分支，Java 为 1908/3360 行、1122/2178 分支；三类运行时均未达目标。

2026-11-05 17:45 文档评论与 ID 边界 HTTP 续验：隔离评论文件损坏时，真实 HTTP 列表/新增/删除均返回明确 500，文件恢复后可继续创建与读取；非字符串引用返回 400，不存在文档返回 404。详情、正文、下载及删除对根外 ID、缺失文件和只读文件分别验证 404/403，缺失版本历史返回空列表。定向 10/10 通过；固定 119 个 Jest 文件执行为 118 套件通过、1 套件条件跳过，1247 项通过、7 项跳过。`runtime/test-results/node-document-boundary-full/coverage-summary.json` 显示固定 152 个 Node 产品文件行 12805/15746（81.32%）、分支 11485/17679（64.96%）；`routes/document.js` 为 547/598 行、330/418 分支。前端和 Java 最近完整结果未变化，全平台目标仍未达成。

2026-11-05 17:39 文档原样预览安全边界续验：现有隔离 HTTP 路由测试验证未知根、目录、缺失文件、双重编码遍历、无效百分号、NUL 与指向注册根外文件的符号链接均返回 404；合法 HTML 和点文件仍可预览，并检查 `Content-Disposition: inline` 与 `nosniff`。定向 8/8 通过；固定 119 个 Jest 文件执行为 118 套件通过、1 套件条件跳过，1245 项通过、7 项跳过。`runtime/test-results/node-document-raw-full/coverage-summary.json` 显示固定 152 个 Node 产品文件行 12796/15746（81.26%）、分支 11476/17679（64.91%）；`routes/document.js` 为 538/598 行、321/418 分支。前端和 Java 最近完整结果未变，全平台目标仍未达成。

2026-11-05 17:34 文档搜索与统计 HTTP 续验：现有隔离路由测试构造标题/正文重复命中、二进制文件、隐藏目录及 `node_modules`，经真实 HTTP 验证全文每文件最多三处正文、标题模式不读正文、非文本文件仅标题、隐藏及依赖目录不进入列表/搜索/统计、非法排序参数回退，以及统计文件数/大小/模型 token 汇总。定向 7/7 通过；固定 119 个 Jest 文件执行为 118 套件通过、1 套件条件跳过，1244 项通过、7 项跳过。`runtime/test-results/node-document-search-full/coverage-summary.json` 显示固定 152 个 Node 产品文件行 12793/15746（81.24%）、分支 11471/17679（64.88%）；`routes/document.js` 为 535/598 行、316/418 分支。前端和 Java 最近完整结果未变化，全平台目标仍未达标。

2026-11-05 17:28 文档上传预处理 HTTP 生命周期续验：在 `runtime/test-results` 隔离运行根真实 multipart 上传 Markdown，验证标题/章节解析、列表、详情、删除、重复删除和旧元数据缺少 `stored_file` 时的回退。测试先复现删除返回 500，根因是列表元数据未保存删除所需的 `stored_file`；产品路由已保存该字段并兼容旧记录。定向 6/6 通过；固定 119 个 Jest 文件执行为 118 套件通过、1 套件条件跳过，1243 项通过、7 项跳过。`runtime/test-results/node-document-preprocess-full/coverage-summary.json` 显示固定 152 个 Node 产品文件行 12789/15746（81.22%）、分支 11454/17679（64.78%）；`routes/document.js` 为 531/598 行、299/418 分支。前端和 Java 最近完整结果未变，全平台目标仍未达成。

2026-11-05 17:20 文档生成路由续验：现有隔离 Express HTTP 测试增加实际 `/api/document/generate` 请求，验证缺少 prompt/API Key、确定性模型生成、文件名清理、显式子目录和文件名、正文与元数据回读、缺少用量时零值，以及 `output_path` 越界拒绝。定向 5/5 通过；固定 119 个 Jest 文件执行为 118 套件通过、1 套件条件跳过，1242 项通过、7 项跳过。`runtime/test-results/node-document-generate-full/coverage-summary.json` 显示固定 152 个 Node 产品文件行 12712/15746（80.73%）、分支 11423/17677（64.62%）；`routes/document.js` 从上次完整报告的 420/598 行、241/416 分支增至 454/598 行、268/416 分支。前端和 Java 最近完整结果未变，全平台目标仍未达标。

2026-11-05 17:14 领域存储信封与默认调用续验：真实本地 HTTP 夹具增加无 `data` 成功信封、空成功正文、缺少错误字段、缺少 `Server-Timing` 响应；适配器测试验证同步与异步方法的返回兼容性、默认参数和公开错误码状态。固定 119 个 Jest 文件执行为 118 套件通过、1 套件条件跳过，1241 项通过、7 项跳过。`runtime/test-results/node-domain-branches-full/coverage-summary.json` 显示固定 152 个 Node 产品文件行 12678/15746（80.51%）、分支 11396/17677（64.46%）；`domain-store.js` 达 144/144 行、219/223 分支（98.20%）。较上次同分母完整报告 Node 分支增加 49 个，但行覆盖减少 5 个，其他测试路径存在计数波动，不能宣称总行覆盖单调提升。前端和 Java 最近完整计数未变化；三类运行时仍未达标。

2026-11-05 17:07 领域存储异步 HTTP 覆盖续验：扩充本地真实 HTTP 夹具与契约测试，覆盖人员、目录、治理、平台鉴权、GitLab 异步适配器，验证编码路径、正文、版本/幂等头、`Server-Timing`、业务错误和非法 JSON。定向 58/58 通过；固定 119 个 Jest 文件执行为 118 套件通过、1 套件条件跳过，1223 项通过、7 项跳过。`runtime/test-results/node-domain-async-full/coverage-summary.json` 显示固定 152 个 Node 产品文件行 12683/15746（80.54%）、分支 11347/17677（64.19%），比同分母前次完整采集增加 27 行、26 分支；`domain-store.js` 为 144/144 行、161/223 分支。前端和 Java 沿用最近完整报告，三类运行时仍未达标。

2026-11-05 16:58 同步领域存储 HTTP 适配器续验：新增 `domain-store-sync-http.test.js` 和独立线程本地 HTTP 夹具，验证手册、大纲、建设任务、人员团队、平台鉴权与 GitLab 的同步请求方法、编码路径、JSON 正文、版本/幂等头及错误信封。定向 32/32 通过；固定清单现为 119 个 Jest 文件、118 套件通过、1 套件条件跳过，1197 项通过、7 项跳过。`runtime/test-results/node-domain-sync-retry/coverage-summary.json` 显示 Node 固定 152 个产品文件行 12656/15746（80.37%）、分支 11321/17677（64.04%）；`domain-store.js` 为 121/144 行、143/223 分支，较前次该文件增加 77 行和 78 分支。首次全量采集时外部本机 13510 服务短暂拒绝连接，导致 `system-retrieval-flow.test.js` 四项失败；服务恢复后重跑全量通过。同期产品源码分母发生变化，总百分比不可直接归因于新增测试。前端、Java 最近完整计数仍为 5184/9788 行、5679/13905 分支和 1908/3360 行、1122/2178 分支；全平台目标仍未达成。

2026-11-05 16:47 Node 固定清单复核：导航图标契约同步已确认方案 C，混合 HTTP/浏览器来源证据场景设置显式 90 秒超时。先前来源快照用例的 403 在定向与完整桥接复核中未重现；没有放宽 DNS 或私网拒绝规则。统一入口分类的 118 个 Jest 文件完整执行为 117 套件通过、1 套件条件跳过，1165 项通过、7 项跳过。`runtime/test-results/node-current-next/coverage-summary.json` 显示固定 152 个 Node 产品文件行 12679/15782（80.33%）、分支 11563/18036（64.11%）；最大行缺口为 `routes/knowledge-center.js` 472 行、`routes/outline.js` 209 行、`routes/document.js` 178 行。前端最近完整结果仍为 5184/9788 行、5679/13905 分支；Java 为 1908/3360 行、1122/2178 分支。三个运行时均未达标。

2026-11-05 16:32 前端认证启动状态机续验：现有审核 Chromium 场景补普通会话、401 匿名、CAS 回调成功及失败清理，定向 Playwright 1/1 通过。完整固定 56 文件前端 Istanbul 采集含 28 个写作、14 个审核场景，行 5184/9788（52.96%）、分支 5679/13905（40.84%），见 `runtime/test-results/frontend-auth-bootstrap/coverage-summary.json`。两次完整采集间 `production-writing-page.js` 进入了新增产品源码，分母增加 83 行、507 分支；这些代码仍计入固定清单，不以旧分母比较总百分比。`auth-controller.js` 行从 39/76 增至 55/76、分支从 27/48 增至 31/48。Node 未在本轮重采，Java 最近完整结果为 1908/3360 行、1122/2178 分支；三类运行时仍未达标。

2026-11-05 16:23 前端认证返回地址续验：现有审核 Chromium 场景补同源知识中心地址、外站/协议相对地址拒绝、CAS ticket 剔除、当前/记忆地址消费与清理，定向 Playwright 1/1 通过。完整固定 56 文件前端 Istanbul 采集含 28 个写作和 14 个审核场景，行 5097/9705（52.51%）、分支 5539/13398（41.34%），见 `runtime/test-results/frontend-auth-current/coverage-summary.json`；较本轮前一完整前端报告增加 46 行、81 分支。`auth-controller.js` 行 39/76、分支 27/48，原为 25/76、14/48。当前 Java 最新行 1908/3360、分支 1122/2178；Node 沿用最近完整固定 Jest 结果。三类运行时均未达标。

2026-11-05 16:07 团队小组写入 HTTP 续验：扩展 `StorageDomainReadHttpCheck.java` 的内存团队与名册 SQL 状态，通过实际 `Main.teamGroups` 本地 HTTP 验证创建/回读、重名拒绝、缺少负责人、有效名册更新后的版本与成员详情、旧版本冲突。完整 Java JaCoCo 通过，固定 9 文件行 1908/3360（56.79%）、分支 1122/2178（51.52%），见 `runtime/test-results/java-team-write-http/coverage-summary.json`；较团队只读结果增加 72 行、47 分支，产品分母不变。Node 和浏览器脚本未在本轮重采，全平台目标仍未达标。

2026-11-05 16:04 团队小组只读 HTTP 续验：扩展 `StorageDomainReadHttpCheck.java`，通过实际 `Main.teamGroups` 验证空/非空团队列表、负责人和成员详情、缺失团队 404、创建及名册更新的幂等键门禁。完整 Java JaCoCo 通过，固定 9 文件行 1836/3360（54.64%）、分支 1075/2178（49.36%），证据 `runtime/test-results/java-team-read-http/coverage-summary.json`；较技术领域/任务结果增加 38 行、18 分支，分母未变。全平台目标仍未达标。

2026-11-05 16:02 技术领域与建设任务只读 HTTP 续验：新增 `StorageDomainReadHttpCheck.java`，以隔离 JDBC 行集驱动实际 `Main.techDomains`、`Main.buildTasks`，通过本地 HTTP 验证空/非空技术领域、团队负责人、已发布建设任务列表/详情、缺失任务 404 和方法拒绝。完整 Java JaCoCo 通过，固定 9 文件行 1798/3360（53.51%）、分支 1057/2178（48.53%），见 `runtime/test-results/java-domain-read-http/coverage-summary.json`；较 GitLab HTTP 结果增加 92 行、25 分支，固定清单未变。Node 与浏览器脚本未在本轮重采，全平台目标未达标。

2026-11-05 15:59 GitLab 平台路由续验：新增 `StorageGitLabHttpCheck.java`，复用内存 JDBC 连接/映射状态机，通过实际 `Main.platformGitLab` 本地 HTTP 验证空列表、缺失连接与映射、幂等键门禁、连接创建/回读、状态变更版本头、映射首次写入/回读及方法拒绝。完整 Java JaCoCo 通过，固定 9 文件行 1706/3360（50.77%）、分支 1032/2178（47.38%），见 `runtime/test-results/java-gitlab-http/coverage-summary.json`；比平台鉴权结果增加 27 行、28 分支，产品源码清单不变。Node 与浏览器脚本未在本轮重采，全平台目标仍未达标。

2026-11-05 15:56 平台鉴权真实 HTTP 续验：新增 `StorageAuthHttpCheck.java`，复用平台鉴权内存 JDBC 状态机，通过实际 `Main.platformAuth` 验证空列表、缺失详情、CAS 用户同步、详情与列表、角色更新、缺失/非法版本、缺失幂等键、旧版本冲突、非法 JSON 和不支持的方法。完整 Java JaCoCo 通过，固定 9 文件行 1679/3360（49.97%）、分支 1004/2178（46.10%），证据 `runtime/test-results/java-auth-http/coverage-summary.json`；较人员目录与导入结果增加 35 行、27 分支，产品清单不变。Node 和浏览器脚本最近完整报告仍低于目标，整体未达标。

2026-11-05 15:54 人员错误边界续验：本地真实 HTTP 补非法 JSON、无候选 CAS 绑定、未完成导入批次拒绝。完整 Java 行 1647/3360、分支 985/2178，见 `runtime/test-results/java-principal-boundaries/coverage-summary.json`。

2026-11-05 15:52 人员目录与导入路由续验：新增 `StoragePrincipalHttpCheck.java`，复用内存 JDBC 人员状态机并通过实际 `Main.domainPrincipals` 本地 HTTP 验证列表、创建、CAS 绑定、更新、错误码、空导入、首次导入及同摘要幂等回读。完整 Java JaCoCo 检查通过，固定 9 文件行 1644/3360（48.93%）、分支 977/2178（44.86%），见 `runtime/test-results/java-principal-import/coverage-summary.json`；较大纲校验结果增加 74 行、46 分支，产品清单未变。Node 与浏览器脚本仍沿用最近完整报告，三类运行时均未达到目标。

2026-11-05 15:48 大纲节点输入校验续验：`OutlineStorageContractCheck.java` 增加非法标识、标题、类型、父子关系、顺序、层级、重复路径及无文档节点矩阵。完整 Java JaCoCo 通过，`OutlineNodeSnapshot.java` 行 31/31（100%）、分支 46/48（95.83%）；固定 9 文件整体行 1570/3360（46.73%）、分支 931/2178（42.75%），证据 `runtime/test-results/java-outline-validation/coverage-summary.json` 和同目录 `java.xml`。较上一 Java 报告增加 1 行、14 分支；全平台目标仍未达标。

2026-11-05 15:46 Java 手册投影 HTTP 续验：同一 `StorageRecordHttpCheck.java` 通过实际 `Main.domainHandbooks` 和 `HandbookProjectionRepository` 验证空列表、含摘要/大纲/负责人/可见性字段的列表、`Server-Timing` 及方法拒绝。完整 9 文件 JaCoCo 通过，行 1569/3360（46.70%）、分支 917/2178（42.10%），证据 `runtime/test-results/java-handbooks-http/coverage-summary.json`；较导出路由结果增加 72 行、14 分支，分母不变。Node 和浏览器脚本仍沿用下方最近完整报告；三类运行时均未达标。

2026-11-05 15:43 Java 导出路由续验：`StorageRecordHttpCheck.java` 扩展实际 `Main.exportAll` 的本地 HTTP 回归，断言空列表、创建后的正文与数据库摘要、软删除后的标记。固定 9 个 Java 产品源码行 1497/3360（44.55%）、分支 903/2178（41.46%），见 `runtime/test-results/java-record-export/coverage-summary.json`；较上一完整 Java 结果增加 32 行、4 分支，固定清单未变。Node 最新固定 Jest 为 12568/15692 行、11220/17446 分支；浏览器脚本为 5036/9665 行、5489/13340 分支。三类运行时均未达标。

2026-11-05 15:34 Java 存储记录路由续验：新增 `StorageRecordHttpCheck.java` 并接入固定 JaCoCo 收集器，以本地真实 `HttpServer` 和实际 `Main.records` handler 驱动内存 JDBC 状态机。HTTP 回归覆盖缺失读取、创建、正文回读、ETag 304、相同正文幂等写、旧版本冲突、更新、删除版本冲突、软删除标记及事务提交/回滚。固定 9 个 Java 产品源码行 1465/3360（43.60%）、分支 899/2178（41.28%），见 `runtime/test-results/java-record-http/coverage-summary.json`；新增检查提升 126 行、45 分支，产品清单不变。Node 最新固定 Jest 结果为 80.09% 行/64.31% 分支；浏览器脚本 52.10%/41.14%，沿用 15:15 完整采集。整体仍未达标。

2026-11-05 15:29 Agent 管理路由续验：新增 `agent-governance-http-coverage.test.js`，隔离真实 HTTP 覆盖登录/管理员权限、Agent 列表与保存、子模块模型和 MCP 动作分发、Codex 运行测试、运行状态/取消/SSE 回读及已知/未知错误映射。定向 6/6 通过，固定 118 个 Jest 文件执行为 117 套件通过、1 套件条件跳过，1163 项通过、7 项跳过。`runtime/test-results/agent-http-fixed-jest/coverage-summary.json` 记录 Node 行 12568/15692（80.09%）、分支 11220/17446（64.31%），比上一轮增加 49 行、61 分支；`routes/knowledge-center.js` 行 1284/1748、分支 1331/2204。浏览器脚本与 Java 仍使用 15:15 完整采集证据，三套运行时未达到目标。

2026-11-05 15:23 Node 资产路由续验：`knowledge-center-asset-status-overrides.test.js` 在隔离真实 HTTP 服务中补充文件模式的手册创建、必填/产品/责任人校验、版本冲突、编辑、运行任务归档门禁及恢复回读。定向 7/7 通过，固定清单 116 套件通过、1 套件条件跳过，1157 项通过、7 项跳过。`runtime/test-results/asset-route-fixed-jest/coverage-summary.json` 记录 Node 行 12519/15692（79.77%）、分支 11159/17446（63.96%），较上轮分别增加 57 行、61 分支；`routes/knowledge-center.js` 行 1235/1748、分支 1270/2204。浏览器脚本与 Java 沿用下方完整采集数值，三套运行时仍未达到目标。

2026-11-05 15:15 固定清单续验：`runtime/test-results/unit/20261105-150659-259177-unit/details/coverage/`。Node 行 12462/15692（79.41%）、分支 11098/17446（63.61%）；浏览器脚本行 5036/9665（52.10%）、分支 5489/13340（41.14%）；Java 行 1339/3360（39.85%）、分支 854/2178（39.21%）。固定清单 Jest 116 套件通过、1 套件条件跳过，1155 项通过、7 项跳过。新增网关隔离真实 HTTP 与数据库启动测试定向 16/16 通过，覆盖静态资源、代理错误与 JSON 头规范化、资产读写、CAS 委托和默认凭据告警。测试中发现并修复 JSON 代理同时发送 `Transfer-Encoding` 和新 `Content-Length` 的冲突。三套运行时均未达到目标，继续保持 FAIL；与下方历史快照分母差异来自同期工作树产品源码变更，不通过排除源码缩小清单。

目标分别对 Node、管理平台浏览器脚本和 Java 存储源码固定清单计数，需全部测试通过且每种运行时行覆盖率 100%、分支覆盖率 95%。完整口径和采集方法见本文件的“测试运行器与浏览器覆盖率边界”章节及 `config/knowledge-center/coverage-targets.json`。本轮最新统一固定分母报告：`runtime/test-results/unit/20261105-143626-405248-unit/details/coverage/coverage-summary.json`，前端和 Java 独立报告分别位于同目录的 `frontend/coverage-summary.json`、`java/coverage-summary.json`。Node 为 12286/15649 行（78.50%）、10828/17319 分支（62.52%）；前端为 5069/9676 行（52.38%）、5510/13588 分支（40.55%）；Java 为 1339/3360 行（39.85%）、854/2178 分支（39.21%）。三个运行时均未达标，完整入口结果为 FAIL；所有汇总都保留固定源码清单，新增 JS 仍纳入分母。

直写生成器新增 `direct-generate-runner-http-coverage.test.js`：通过本地真实 `/api/agent/execute` 与状态查询 HTTP 路由覆盖成功生成、MCP 格式/失败结果、空查询及上下文回退、模板和 Skill 成功/失败读取、冻结模板路径过滤、YAML 和来源追溯分支、默认参数及多个执行阶段错误。模型、MCP、文件写入和检索作为隔离替身；模板/Skill 仅使用临时目录 `runtime/test-results/direct-runner-http-coverage/`，套件结束后删除。定向 Jest 20/20，通过的 `direct-task-runner.js` 达到 223/223 行、182/190 分支（95.78%）。全量固定清单 Jest 114 套件通过、1 个套件条件跳过，1138 测试通过、7 跳过；统一覆盖采集证实 Node 行 78.50%、分支 62.52%，前端行 52.38%、分支 40.55%，Java 行 39.85%、分支 39.21%。统一覆盖总门禁仍 FAIL；不能以定向文件计数代替全平台验收。详细执行输出见上述 `runtime/test-results/unit/20261105-143626-405248-unit/details/`。

下一轮优先缺口按最新固定清单排序：Node `routes/knowledge-center.js` 缺 569 行、`routes/outline.js` 缺 209 行、`routes/document.js` 缺 178 行；前端 `app.js` 缺 2955 行、模板控制器缺 242 行、大纲视图缺 232 行；Java `Main.java` 仍是主要缺口。全平台行覆盖目标不得通过排除这些产品文件或降低分母达成。

## 2026-11-05 任务交付链路定向回归

手册返回位置回归：`node --test tests/e2e/agent-runner/knowledge-center-my-work.node.test.cjs` 覆盖工作台筛选、任务管理、知识资产、浏览器前进后退和 390px；6 次桌面点击到来源页绘制的 P95 需低于 100ms。该预算只针对已进入过的页面恢复，不等于服务端刷新或直达冷加载耗时。

`document-tasks-route.test.js` 用真实隔离 HTTP 验证人员分派、具体文档待办、无变更确认深链及越权拒绝；`document-tasks-frontend.test.cjs` 用浏览器验证具体文档和无变更确认深链弹窗；`knowledge-center-my-work.node.test.cjs` 验证工作台聚合、分段加载与来源失败；`review-workbench-contract.test.js` 验证 MR Assignee 个人投影与正文权限隔离。企业 GitLab 的合并及回读仍须在授权范围内单独验证，测试不得合并 MR。
2026-11-05 工作台编号验收入口：Jest `document-tasks-route.test.js` 覆盖跨手册子任务号与 HTTP 权限；Node `workbench-numbering.node.test.cjs` 覆盖幂等回填、重审链、HIST、冲突与可见范围；`knowledge-center-my-work.node.test.cjs` 覆盖桌面和 390px 九列、六类筛选、详情、管理员代办与返回。真实数据回填与实际平台资源更新尚未执行，不将隔离浏览器结果当正式平台验收。
2026-11-06 01:12 前端计划日历边界续验：扩展固定 Istanbul Chromium 采集器的真实 DOM 场景，覆盖空计划单元格、默认 09:00、保存中重复提交、重新读取期间重复读取、重新读取后的空结束时间和空时间不提交。完整采集 `runtime/test-results/frontend-plan-calendar-final-20261106/coverage-summary.json` 收齐 56 个产品脚本、29 个写作和 15 个审核计数文件；`modules/document-tasks/plan-calendar.js` 行 53/53、语句 102/102、函数 18/18、分支 49/49（100%）。本次总前端计数为行 5169/9786（52.82%）、分支 5614/13460（41.70%），与上一份采集相比其他页面场景存在运行波动，不能将日历模块增量直接表述为总量提升。Node/Java 未在本轮复采，全平台目标仍未达成。
2026-11-06 01:20 Node 品牌图标存储续验：新增 `brand-icon-store-coverage.test.js`，在隔离临时仓库使用真实存储入口覆盖五种允许格式、MIME/摘要/更新时间、默认配置、无效引用、缺失资源、符号链接越界及 GIF 拒绝；定向 Jest 13/13 通过。独立 Istanbul 报告 `runtime/test-results/node-brand-icon-directed-v2/coverage-summary.json` 中 `brand-icon-store.js` 行 29/29、分支 28/28（均 100%）。固定 Node 完整清单和三端报告尚待复采，全平台目标未达成。

2026-11-06 统一 Node 存储续验：品牌图标测试补充真实本地 HTTP GET/POST 门禁、ETag、安全响应头和资源缺失错误，中间过程存储覆盖读写及查询信封；定向 Jest 17/17 通过，报告 `runtime/test-results/node-stores-http-verified/coverage-summary.json`，两个模块行/分支均 100%。固定 Node 清单复采（133 套件，132 通过、1 条件跳过，1347 通过、7 跳过）为行 13848/15936（86.89%）、分支 12752/18043（70.67%）；该结果仍未达到全平台目标。完整统一回归目录为 `runtime/test-reports/2026-11-06/20261106-012154-116727-full`，待最终收尾报告确认。

2026-11-06 最终统一回归：报告 `runtime/test-reports/2026-11-06/20261106-012154-116727-full/report.md`，75/78 任务成功，2354 通过、17 失败、42 跳过。固定分母 Node 行 13830/15936（86.78%）、分支 12748/18043（70.65%）；Java 行 2882/3360（85.77%）、分支 1585/2178（72.77%）。统一采集中的前端场景夹具首次失败，已修正并独立复采报告 `runtime/test-results/frontend-outline-coverage-20261106/coverage-summary.json`：行 5507/9786（56.27%）、分支 5981/13460（44.43%）。行 100%、分支 95% 目标仍未达到。

2026-11-06 主应用路由覆盖续验：固定 Chromium 采集器新增资源页、回收站、仓库分支/语言、未知路由和外部账号参数重载场景，报告 `runtime/test-results/frontend-app-route-coverage-20261106/coverage-summary.json`。该次采集总量为行 5346/9786（54.62%）、分支 5804/13460（43.12%），受浏览器时序波动低于前次独立报告，不作为总量提升证据；场景代码和报告保留供后续固定复采。

2026-11-06 02:11 模板映射 HTTP 边界续验：新增真实 `createKnowledgeCenterHandler` 路由夹具，覆盖 mapping-rules 读取/预览/保存过期、mappings 列表分页与越权、分析批次创建/读取/取消/缺失、decisions 缺失批次/越权/不可见文档及方法门禁；定向 Jest 3/3 通过，报告 `runtime/test-results/template-map-http-directed/coverage-summary.json`。该结果尚未合并固定 Node 全量复采，三端覆盖率目标仍未达成。

2026-11-06 大纲治理读模型续验：扩展真实 HTTP 大纲边界夹具，覆盖产品目录、目录/详情完整与 compact 投影、责任/影响查询、缺失资源、预检成功与失败、列表和版本详情；定向 8/8 通过，`routes/outline.js` 定向行覆盖 64.96%、分支覆盖 48.20%，报告 `runtime/test-results/outline-route-directed-v2/coverage-summary.json`。该结果尚未替代固定 Node 全量覆盖率门禁。
### 配置路由真实 HTTP 续验（2026-11-06）

`api.test.js` 增加模型、MCP、Agent 预设和 LLM 测试失败路径的真实 HTTP 覆盖，定向 Jest 16/16 通过。

`config-route-http-coverage.test.js` 进一步覆盖配置路由默认值、校验失败、预设列表和测试端点异常，定向 Jest 4/4 通过；配置路由行 92.94%、分支 90.90%。

### 运行时环境解析覆盖续验（2026-11-06）

`runtime-env.test.js` 使用真实临时文件和内置解析器覆盖引号、非法行、环境变量路径、默认路径、同路径复用及缺失文件错误；定向 Jest 4/4 通过。该模块定向行覆盖 24/24、分支覆盖 22/23（95.65%），报告为 `runtime/test-results/runtime-env-directed-20261106c/coverage-summary.json`。

### 固定全量覆盖复采（2026-11-06）

运行 `python3 tests/run_tests.py full --coverage --jobs 1 --timeout 1800`，正式报告 `runtime/test-reports/2026-11-06/20261106-175514-830554-full/report.md`。Node 行 13993/15956（87.69%）、分支 12937/18066（71.60%）；浏览器 JS 行 5348/9791（54.62%）、分支 5792/13478（42.97%）；Java 行 2882/3360（85.77%）、分支 1585/2178（72.77%）。75/78 任务成功，2368 用例通过、20 失败、42 跳过；性能门禁和两组 E2E 均失败，平台覆盖率目标未达到。此次分母相对上一报告增加 Node 20 行/23 分支、前端 5 行/18 分支，需以当前工作树固定清单为准。

### 工作台入口 E2E 纠偏（2026-11-09）

`knowledge-center-entry.spec.js` 将旧总览卡片和“无刷新按钮”断言改为当前“我的工作”个人待办的工作类别、处理状态、九列任务字段和刷新请求，并核对未知路由回退及数据变更事件。仍通过统一运行器启动的隔离服务和真实浏览器/后端 API 验证。

定向 Playwright 在 `test_hy` 隔离实例上 Chromium/Firefox 各 3/3 通过，共 6/6；测试实例已按所有权清理。全量三端覆盖与其余门禁尚未重新复采。

### AI 任务评价与历史删除覆盖（2026-11-09）

`production-ai-service.test.js` 补充评价输入、作者归属、审计、运行中删除和删除后不可见矩阵，Jest 34/34 通过；`handbook-production-api.test.js` 通过本地真实 HTTP 验证评价、列表和删除，定向 1/1 通过。固定 Node 135 个 Jest 文件复采通过，报告 `runtime/test-results/node-full-20261109/coverage-summary.json`：行 14018/15981（87.71%）、分支 12967/18095（71.66%）。前端、Java 和全量门禁未在本轮复采，目标仍未达成。
2026-11-09 11:03 检索策略覆盖补强：`retrieval-strategy-coverage.test.js` 扩展至 13 项，使用隔离目录验证 MCP 空查询/部分失败、索引与分块损坏回退、Oracle 标题/正文/数字编号、扫描后文件消失、来源整合和覆盖度分档。数字 Oracle ID 解析改走原有数字表格分支，返回字段不变。定向 Jest 13/13，通过 `runtime/test-results/retrieval-strategy-20261109/coverage-summary.json` 记录该模块 268/268 行（100%）、164/193 分支（84.97%）；这是定向模块结果，不代替固定全量平台门禁。

2026-11-09 16:16 续补检索策略边界至 19 项，验证索引确认五篇上限、缺省字段/无关键词、Oracle 标题足量时跳过正文扫描、MCP 缺省错误及五来源摘要。定向 19/19，通过同一报告目录复采，该模块 268/268 行、279/279 语句、187/193 分支（96.89%）。上次全量运行中断于单元阶段且未生成总报告；发现 `knowledge-center-incremental-view.test.js` 的旧导航文字断言已按现行审核工作区更新，定向 16/16 通过。

2026-11-09 17:03 固定前端独立复采已恢复完整采集：57 个浏览器产品脚本行 5485/9970（55.01%）、分支 5982/13719（43.60%），报告 `runtime/coverage-goal/frontend/coverage-summary.json`。模板管理 E2E 新建流程先填写“基本信息”弹层再切换 Markdown，避免旧用例点击弹层下方按钮；六列工作台表头断言也已按当前页面校准。模板与工作台定向隔离 E2E 尚待复验；三端行 100%、分支 95% 目标仍未达成。

Node LLM 客户端续补 `llm-client.test.js` 至 25 项：增加稳定 provider 错误分类、Responses 输出及未完成状态、Chat 流终止、probe 首 token/空流/限流、配置更新和 JSON 解析边界。定向 Jest 25/25；Istanbul 定向报告 `runtime/test-results/llm-client-directed/coverage-summary.json` 显示模块行 116/116（100%）、分支 165/176（93.75%），固定 Node 清单结果见下文。测试不调用真实模型。隔离 E2E 定向结果：模板新建/保存/刷新 Chromium、Firefox 各通过；工作台六列表头 Chromium、Firefox 各通过。资产移动端场景因点击前未等待资产目录加载而失败，已补就绪断言并在后续全量中通过；第二组 93 通过、6 跳过，审核发布 Firefox 一例重试后通过，标记 flaky。E2E 报告 `runtime/test-results/e2e/20261109-170456-230369-e2e/report.html`。

2026-11-09 18:05 统一全量 `python3 tests/run_tests.py full --coverage --jobs 1 --timeout 1800` 报告 `runtime/test-reports/2026-11-09/20261109-173041-804171-full/report.md`：75/78 任务成功，2431 用例通过、3 失败、44 跳过。固定 Node 154 文件行 14225/16000（88.90%）、分支 13299/18139（73.31%）；前端 57 文件行 5477/9970（54.93%）、分支 5972/13719（43.53%）；Java 9 文件行 2882/3360（85.77%）、分支 1585/2178（72.77%）。LLM 客户端全量为 116/116 行、165/176 分支；资产移动端与模板 E2E 均通过。审核主体性能 P95 约 273ms 高于 150ms，PingCode 审核摘要 P95 约 481ms 高于 300ms，Firefox 手册工作区 AI 嵌入失败，另一阅读保存用例首次超时后重试通过。三端行 100%、分支 95% 目标仍未达到。

审核图片资源路由续补：`knowledge-center-review-resource-http-coverage.test.js` 使用本地真实 HTTP 和隔离文件模式映射，验证冻结新图、固定提交旧图、私有响应头、可见范围、候选摘要、归属、仓库身份、字节快照和格式拒绝；4/4 通过。定向 Istanbul 的主路由 2507–2535 行均已进入计数，报告 `runtime/test-results/review-resource-route-directed/coverage-summary.json`；固定 Node 全量增量待复采。原有 Node 原生送审与交付链路测试继续保留，不改产品源码或固定覆盖分母。
### 数据库连接配置抽屉覆盖

固定前端浏览器采集覆盖数据库连接抽屉打开、脏表单取消确认、高级设置展开和确认关闭状态。该场景不执行连接测试或保存操作；完整覆盖率仍以固定 57 个产品脚本的报告为准。

同一采集还通过隔离 HTTP 500 响应验证“仅测试连接”的错误提示和忙状态恢复，不连接真实数据库。

另通过隔离 PUT 500 验证“验证并保存”的错误反馈和按钮恢复；结果以固定报告为准。

固定采集还覆盖测试连接和保存的隔离 HTTP 200 成功矩阵，以及保存后再次编辑的关闭确认。

最终固定报告为 `runtime/test-results/frontend-db-success-final-20261110/coverage-summary.json`；平台页重载实验因计数生命周期问题已撤销，不纳入结果。

固定前端采集另包含目录树嵌套、键盘导航、过滤和恢复矩阵，报告为 `runtime/test-results/frontend-directory-tree-20261110/coverage-summary.json`。

目录树边界矩阵另覆盖空目录、非默认树角色、交互式标签、自定义键和重复绑定，最终报告为 `runtime/test-results/frontend-directory-tree-boundaries-20261110/coverage-summary.json`。

目录树键盘边界报告为 `runtime/test-results/frontend-directory-tree-keyboard-20261110/coverage-summary.json`，覆盖关闭目录展开、父子导航和无搜索树。

目录树默认分支最终报告为 `runtime/test-results/frontend-directory-tree-defaults-retry-20261110/coverage-summary.json`；审核套件重跑后 16/16 通过。

固定前端采集还覆盖导航面板拖拽、键盘调整、折叠、恢复默认和本地偏好边界，报告为 `runtime/test-results/frontend-navigation-pane-20261110/coverage-summary.json`。

固定采集还覆盖滚动所有者、局部滚动区域、焦点自动滚动、resize/viewport 调度和运行时销毁，报告为 `runtime/test-results/frontend-scroll-runtime-20261110b/coverage-summary.json`。

滚动运行时边界报告为 `runtime/test-results/frontend-scroll-boundaries-20261110/coverage-summary.json`，补齐空区域、不可滚动区域诊断和 destroy 取消帧。

固定采集还覆盖可关闭菜单的互斥、外部点击、Escape 焦点恢复、组合框保护和对话框隔离，报告为 `runtime/test-results/frontend-dismissible-menus-20261110/coverage-summary.json`。

固定采集还覆盖视口运行时原生 `dvh`、测量回退、缩放/无效高度、事件去重和销毁，报告为 `runtime/test-results/frontend-viewport-runtime-20261110b/coverage-summary.json`。

2026-11-10 09:22 人员编辑覆盖续验：固定 Chromium 采集器以真实页面事件验证新增失败与重试、未登录预绑定人员的 CAS 登录名更正确认、冲突字段反馈及成功提交，并核对 POST/PATCH 负载。隔离响应覆盖人员集合与详情路径；57 个固定产品脚本及导航、写作、任务、我的工作、手册往返、平台和审核计数完整通过。报告 `runtime/test-results/frontend-principal-editor-20261110d/coverage-summary.json`：前端行 7588/9986（75.98%）、分支 8960/13744（65.19%），较上一完整前端报告分别增加 97 行、51 分支；`app.js` 行 2154/4318、分支 1687/4135。Node 最近固定报告行 14387/16028、分支 13493/18183；Java 行 3118/3360、分支 1731/2178。本轮未复采 Node、Java，三端目标仍未达到。

2026-11-10 09:34 大纲导入前端覆盖续验：固定 Chromium 采集器通过隔离的同源 API 响应验证无文件提示、两文件逐项校验、结构化错误建议、重复候选确认及重试成功，并等待表单解除忙状态。完整 57 文件报告 `runtime/test-results/frontend-outline-import-20261110/coverage-summary.json`：行 7634/9986（76.44%）、分支 9007/13744（65.53%），较上一份增加 46 行、47 分支；`app.js` 行 2200/4318、分支 1728/4135。Node、Java 未复采，三端目标仍未达到。
2026-11-10 09:48 前端审核选区与导航状态固定复采：审核页面真实创建正文选区并验证批注气泡锚点、隔离 HTTP 500 错误反馈、按钮恢复和取消清理；另动态导入导航状态模块，覆盖未知视图、平台页签有效/非法值、仓库详情尾斜杠、手册路径和空查询。固定采集通过，57 个源码文件、45 导航、31 写作、17 任务管理、8 我的工作、5 手册往返、6 平台和 16 审核计数齐全。最新报告 `runtime/test-results/frontend-navigation-state-20261110/coverage-summary.json` 为行 7711/9986（77.21%）、分支 9055/13744（65.88%）；由于既有页面计数时序波动，总量较上一报告下降，不作为增量证据。`common/state/navigation.js` 从 15/18 行、17/22 分支提升为 18/18 行、21/22 分支（95.45%）。`node --check` 与 `git diff --check` 通过。Node 最近固定行 14387/16028、分支 13493/18183；Java 3118/3360、1731/2178；全平台目标仍未达到。

2026-11-10 10:14 手册草稿保存交互覆盖：固定 Chromium 采集器以真实按钮事件验证未就绪拦截、隔离 PUT 失败及成功、保存期间后续编辑仍保留为未保存状态，并核对请求上下文、基线摘要、模板与附件字段。完整 57 文件报告 `runtime/test-results/frontend-handbook-save-20261110/coverage-summary.json` 为行 7756/9986（77.66%）、分支 9098/13744（66.19%）；`app.js` 行 2319/4318、分支 1814/4135。Node 和 Java 未重采，三端目标仍未达到。

2026-11-10 10:41 仓库映射目录读取与选择覆盖：固定 Chromium 页面经真实连接、分支、目录、语言和标签事件验证默认分支、嵌套目录、搜索、未授权和读取失败反馈。完整 57 文件报告 `runtime/test-results/frontend-mapping-selection-20261110/coverage-summary.json` 为行 7826/9986（78.36%）、分支 9158/13744（66.63%）；相对手册保存完整报告增加 70 行、60 分支，`app.js` 行 2389/4318、分支 1874/4135。Node 最近固定行 14387/16028、分支 13493/18183；Java 3118/3360、1731/2178，均未在此阶段重采。三端行 100%、分支 95% 的目标仍未达到。

2026-11-10 DOCX、提示词解析与 Validator 续补：真实最小 OOXML 文档、图片去重、来源指标、引号/路径解析和严格质量协议矩阵均通过；模块分别达到 131/131 行、50/52 分支，93/93 行、70/71 分支，86/86 行、112/113 分支。第一次完整采集期间源码变化，报告不能作同版本增量。带前后 SHA256 校验的复采 `runtime/test-results/node-parser-validator-docx-stable-20261110` 源码稳定，Node 行 14608/16036（91.09%）、分支 13752/18205（75.53%）；但 Socket.IO 启动超时导致 1 项失败，因此不是通过门禁。该 Socket.IO 测试随后定向通过。

2026-11-10 图片交付模块续补：`production-resource-delivery-coverage.test.js` 38 项通过；真实文件系统验证重复冻结、来源/附件校验、HTML 和 Markdown 去重、策略/配额及损坏快照。模块行 106/106（100%）、分支 96/101（95.04%），报告 `runtime/test-results/resource-delivery-directed-20261110/coverage-summary.json`。新增测试纳入固定 Jest 清单，完整结果另行记录。

2026-11-10 质量验证与上传解析边界：`preprocessing/quality-validator.test.js` 20/20 通过，模块124/129行（96.12%）、57/67分支（85.07%）；覆盖真实字典/索引文件缺失和损坏、统计文件非严重失败和文本保真严重失败。`production-ai-upload-parser-coverage.test.js` 14/14通过，模块56/56行、49/50分支（98%）；真实Worker验证HTML净化和DOCX图片，Jest上下文记录相同解析分支，并注入Worker异常/退出验证一次结算与终止。定向报告分别为 `runtime/test-results/quality-validator-directed-20261110/coverage-summary.json`、`runtime/test-results/upload-parser-directed-20261110/coverage-summary.json`。未将定向报告分母作为平台总量。

2026-11-10 上传/质量验证后全量复采 `runtime/test-results/node-upload-quality-stable-20261110`：Jest 通过，但前后哈希发现其他会话修改 `document-task-catalog.js`、`document-task-catalog.test.js` 和 `document-tasks-frontend.test.cjs`，`source-stability.json` 为 false。此报告仅诊断，不替换本文件顶部的稳定基线。新增模块定向通过结果仍有效；全平台尚未达标。


### 2026-11-10T12:59:12+08:00 数据库治理与预处理边界定向结果

新增两份测试文件，共新增41项，结合既有数据库真实HTTP与流水线集成测试共69/69通过。数据库治理174/174行、216/225分支（96%）；预处理引擎81/81行、63/63分支（100%）；日志38/38行、24/25分支（96%）。证据 `runtime/test-results/database-engine-directed-20261110/coverage-summary.json`。使用runtime隔离的真实文件、可执行进程与本机HTTP；不修改产品代码。回滚测试仅确认现有意图记录契约。启动固定全量152文件采集后记录平台结果，定向结果不代表平台目标已完成。


### 2026-11-10T13:04:04+08:00 数据库与预处理全量验收、AI阶段HTTP定向结果

固定152文件Node全量：151套件、1868项通过，1套件与8项条件跳过；154产品文件及测试SHA256前后相同，stable=true、changedFiles=[]、jestExit=0。行15082/16074（93.82%），分支14613/18311（79.80%），比上次增加63行、110分支。报告 `runtime/test-results/node-database-engine-stable-20261110/coverage-summary.json`。

新增AI阶段HTTP适配器27项正式测试通过，60/60行、51/53分支（96.22%），报告 `runtime/test-results/production-ai-http-boundaries-directed-20261110/coverage-summary.json`。测试在前次采集完成后才纳入正式目录；启动固定153文件全量复采，期间不改产品与测试。前端与Java本阶段未重采，平台整体目标仍未达到。


### 2026-11-10T13:09:46+08:00 全量发现Worker竞态及修复验证

153文件AI阶段HTTP全量首次复采：151套件通过、1失败、1条件跳过，1894项通过、1失败、8跳过，stable=true但jestExit=1，因此不得作为通过报告。失败位于既有codex-runner-coverage，exit先于IPC业务错误收束，错误返回通用中断。先更新Codex详细设计，再将缺终态中断监听移至close，保持幂等finish。新增三项确定性exit→message→close/无消息close回归，结合真实子进程共5/5通过；codex-runtime真实HTTP与MCP桥接2项通过、公司模型实调1项按条件跳过。证据 `runtime/test-results/codex-terminal-directed.log`、`codex-terminal-http.log`。重新启动固定154文件Node全量，保留失败报告，不降低门槛或修改断言掩盖竞态。


### 2026-11-10T14:40:16+08:00 前端局部事件与采集稳定性续补设计

继续目标：知识中心管理平台行覆盖率100%、分支覆盖率95%，三个运行时分别验收。按标准开发路由，由主执行者承担设计、补测和工具验证责任；未触及人工审批边界。

在已加载应用的真实 Chromium DOM 中构造局部审核/生产控件，通过 document 已注册的点击事件验证侧栏互斥开闭、回复显示/隐藏与焦点、行锚点及缺少文档/节点时的全文回退、生产原型开闭与本地启动/发布意图、生产页签的可访问性状态。断言状态与可见结果，不直接调用产品私有函数；该组局部控件无后端写入，已有完整采集继续运行真实 HTTP 浏览器流程。

前端采集在开始与结束对完整产品 JS 清单计算 SHA256，记录 source-stability.json（新增/删除/内容变更均检测）。不稳定时保留诊断报告并让采集失败，禁止用于当前版本的完整验收。稳定性校验不能证明采集结束后的工作区未变化，最终验收仍须核对版本。保持完整产品分母和100/95门槛。先进行语法及定向浏览器验证，再执行原完整采集。


### 2026-11-10T14:42:55+08:00 AI任务内联产物兼容回读测试设计

Node最新稳定全量较上次少2个分支，定位生产AI服务artifactRecord的内联value回退。补充公开任务HTTP回读矩阵：真实文件产物仓库清空后，任务中完整内联记录继续恢复阶段产物；无value引用不伪造产物；外部记录的artifactId、stageId、contractVersion或digest任一不匹配均不得覆盖任务内容。通过隔离FileAggregateStore和真实HTTP GET验收，不直接调用artifactRecord等私有函数；旧任务兼容夹具只写runtime隔离数据。先定向后固定完整采集，不拼接历史计数。


### 2026-11-10T14:46:31+08:00 Java人员失败恢复与GitLab输入矩阵

在现有隔离真实HTTP夹具中补充人员INSERT失败、写入后查不到记录两种数据库异常，断言503中文通用失败信息及后续GET可恢复。GitLab配置补充名称、地址、项目、分支、运行/认证/用途/状态参数验证、非法If-Match和映射校验失败，断言HTTP状态与错误码，失败后原配置版本及内容不变。使用已有JDBC状态机失败开关，不连接共享数据库或调用私有业务方法造覆盖；通过完整Java采集验收。


### 2026-11-10T14:51:25+08:00 统一入口清洗与任务上下文HTTP补测设计

按标准开发路径补充真实隔离HTTP测试：清洗白名单不匹配返回405、未配置代理返回503、普通用户403、管理员转发成功并保留端点元数据；任务上下文过滤停用人员、归档与不可见手册，验证人员名称回退和失效责任人置空。通过公开catalog请求检查GitLab映射版本去重、无映射回退及映射配置错误传播；目录读取失败检查声明错误与通用错误回退，随后请求恢复。用可控制Promise验证并发请求仅共享原始目录读取、各自保留可见范围。所有存储文件在runtime临时目录，保持完整覆盖率分母与100/95门槛。


### 2026-11-10T14:55:03+08:00 手册历史恢复与冲突控件浏览器补测设计

在完整Chromium采集中扩充现有手册写作入口场景，点击真实document委托事件：历史列表成功/空列表/失败、历史比较和关闭、历史恢复成功/失败与版本号回退；冲突复制、合并、本地空值回退、重读远端及关闭。断言UI状态、恢复请求作用域、版本与本地正文；fetch仅作为该局部控件场景的可控响应，已有端到端套件继续通过真实HTTP验证后端行为。恢复全局fetch/clipboard、页面状态和临时DOM，保持完整产品分母。


### 2026-11-10T14:57:58+08:00 Java请求正文与流式导出边界补测设计

通过真实HTTP补充build-task PATCH畸形JSON、空人员创建正文、超过默认16MiB的领域请求正文，检查400/422/503既有错误契约及随后请求可恢复；不更改产品错误映射。记录导出夹具补充多记录JSON分隔与数据库读取失败，验证完整导出可解析、失败前未提交且原记录内容与版本不变。使用既有隔离JDBC状态机，保持完整9文件采集。


### 2026-11-10T15:01:41+08:00 默认模板映射模型适配链路补测设计

通过真实隔离HTTP启动并轮询默认模板分析服务，使用注入的治理配置与Codex执行器，以及本地SSE模型HTTP端点，验证默认模型缺失、Codex返回合法/非法输出、流式分片和空分片累积、模型失败后批次完成且保留错误依据。断言模型请求的系统提示词、文档路径与候选模板、无MCP服务、AbortSignal以及回读的模板和运行标识。不注入模板映射服务、不调用私有函数，默认文件存储重定向到runtime临时目录，完整分母与100/95目标保持不变。


### 2026-11-10T15:04:13+08:00 Java大纲生命周期与任务绑定拒绝补测设计

在隔离真实HTTP领域夹具中增加归档/已被替代大纲发布拒绝、回收站大纲发布拒绝、不存在任务的责任分配拒绝，以及领域未绑定团队时分配拒绝。检查状态码、错误码、提交和写入计数不增加，再继续既有正常流程证明状态恢复。仅控制JDBC数据状态，不人为抛出目标业务异常。


### 2026-11-10T15:06:59+08:00 Java手册快照标识输入补测设计

在真实HTTP手册快照夹具补充缺少handbookId、缺少productId、非数字/溢出productId、非法责任人与部门标识，断言既有503错误契约、事务回滚且原手册版本与责任人不变，再GET核对原数据。仅使用runtime隔离JDBC状态机，不修改产品错误映射。


### 2026-11-10T15:08:09+08:00 当前手册文档送审草稿选择补测设计

在Chromium真实document点击事件补充当前文档送审：权限禁止无请求、成功列表按手册/大纲/分支过滤、空响应回退、读取失败中文反馈、用户关闭弹窗后不重开，以及请求期间切换上下文时丢弃成功/失败过期结果。使用局部可控fetch并在finally恢复，不直接调用产品私有函数；验证完整采集及源码稳定性。


### 2026-11-10T15:09:32+08:00 大纲元数据损坏与恢复HTTP补测设计

在已有隔离文件仓库中保存元数据与备份，临时将二者置为损坏JSON，通过真实HTTP验证列表、目录、责任、影响、治理、领域任务与提示词生成各自返回既有失败状态和错误码；finally完整恢复字节，再回读列表与版本确认恢复。产品私有函数不直接调用，失败注入为实际损坏文件，所有写入在runtime临时目录。


### 2026-11-10T15:13:05+08:00 Java节点读取故障与采集一致性补测设计

通过真实HTTP请求在JDBC节点查询处注入SQLException，验证大纲列表和治理读取返回503/DATABASE_UNAVAILABLE、无提交；恢复查询后正常回读。Java采集在编译前记录产品源码、实际Java夹具及采集脚本SHA256，结束后重新扫描并保存差异；变化时保留诊断报告但以失败退出，防止混合版本覆盖率进入验收。保持全部9个Java产品文件与原门槛。


### 2026-11-10T15:15:05+08:00 数据库连接治理网关HTTP补测设计

在已有隔离统一入口HTTP夹具注入数据库连接治理端口，验证管理员权限、配置GET/PUT、If-Match优先及rowVersion回退、测试POST、状态GET/强制刷新POST、各端点方法拒绝、已知503与409错误和无状态异常默认503。断言端口调用参数及no-store响应，禁止连接共享数据库；沿用固定Node源文件覆盖率口径。


### 2026-11-10T15:17:43+08:00 手册模板切换及送审选择控件补测设计

通过Chromium真实change/click事件验证模板切换：新模板成功缓存、已有HTML草稿保留、无草稿加载、读取失败提示、缓存命中及空选择；验证送审文档勾选/取消、禁用控件不改状态、空选择阻止下一步，以及已保存草稿读取失败时保留选择弹窗并允许重试。所有fetch局部隔离并恢复，不调用私有产品函数；完整前端采集验证源码稳定性。


### 2026-11-10T15:21:16+08:00 Java共享生产状态写入与同步投影补测设计

在隔离真实记录HTTP夹具补充handbook-production/state创建、更新、软删除基线后重写：JDBC按实际SELECT返回基线版本/正文/删除标记，断言每次成功提交的修订号、后续GET正文，以及draftKey读取立即获得同步发布的当前草稿，覆盖公开PUT到投影更新完整链路。修改基线版本与锁定版本不同时返回409且不提交、不改变正文。仅runtime夹具数据，不连接共享数据库。


### 2026-11-10T15:23:56+08:00 Java共享草稿读取与后台重建失败恢复补测设计

在共享草稿真实HTTP夹具分别注入前台修订查询失败与后台正文读取失败。前台503错误不提交；后台首次重建数据库查询失败后继续返回索引重建状态，解除故障后由后续HTTP触发重建并最终返回原修订和正文。使用夹具CountDownLatch确认后台确实尝试查询；不调用私有重建方法，不以线程sleep推断成功。


### 2026-11-10T15:26:52+08:00 PPTX文件备注、媒体关联及渲染补测设计

通过公开parse入口读取runtime隔离目录中的实际ZIP文件，验证多页数字排序、备注正文保留并过滤页码/日期、重复图片定位与首个有效替代文本、无效及外部关系忽略、未定位媒体附录、页面渲染资产定位与无幻灯片文件名回退。断言正文、元数据及资产原始字节，不直接调用产品私有辅助函数；先运行定向Jest覆盖率，再按固定清单全量采集。


### 2026-11-10T15:29:45+08:00 Java历史大纲叶子别名与显式层级HTTP补测设计

扩展隔离HttpServer/JDBC快照夹具，经真实PUT提交章节kps和knowledgePoints两种历史叶子字段、显式outlineLevel及空章节，断言提交次数和实际节点INSERT的类型/标题/层级/父子关系；保持现有document格式测试，验证兼容入口而不直接调用私有函数。完整Java采集及源码一致性检查验收。


### 2026-11-10T15:34:06+08:00 Java手册冻结与异常投影恢复HTTP补测设计

在现有快照HTTP夹具成功写入frozen状态后检查JDBC持久值和GET中文平台投影；模拟历史数据库行状态缺失，验证GET返回503且无提交，恢复后再次回读冻结状态。仅改变隔离JDBC结果，不连接共享数据库，不调用私有业务辅助函数；完整Java采集验证源码稳定性。


### 2026-11-10T15:37:48+08:00 Node采集输入清单纠偏

两次Node全量均为162套通过、1套跳过，2074项通过、8项跳过，但宽泛扫描全部CJS把并发修改的document-tasks-frontend.test.cjs计为输入变化。核查固定163文件清单、Jest配置及全部require引用：该文件仅由前端采集器通过node --test独立执行，未进入Node覆盖率任务。重新采集时仍哈希全部产品JS和单元JS，将CJS范围按实际require引用与helpers目录确定；保留两份原始失败稳定性记录，不修改产品分母与门槛。


### 2026-11-10T15:41:26+08:00 送审表单提交及工单关联反馈补测设计

通过Chromium真实submit事件验证必填校验阻止请求、服务失败保留表单重试、成功提交清空选择并刷新草稿、单一退回任务引用传递、审核人覆盖和路径去空格，以及带工单时任务编号缺失/范围不匹配/成功逐文档关联的中文反馈。局部fetch隔离并核对请求负载，不调用私有产品函数。并发任务已修改工单视图，旧前端报告仅代表旧源码版本；完成新用例后完整复采当前57个产品脚本并检查稳定性。


### 2026-11-10T15:43:11+08:00 PPTX目录扫描真实文件系统边界补测设计

固定Node报告显示PPTX适配器仅剩目录扫描异常处理行未覆盖。使用runtime实际文件系统验证缺失目录返回空列表、将普通文件作为扫描目录时向调用方抛出ENOTDIR，以及符号链接不当作普通PPTX文件收集；不伪造fs调用结果。定向断言及固定全量Node复采验收。


### 2026-11-10T15:45:29+08:00 Java目录缓存容量淘汰HTTP补测设计

通过真实目录GET和JDBC查询计数验证缓存容量上限：读取产品现有容量常量作为用例规模，模拟连续数据库修订，填满容量后继续读取新修订，验证近期修订命中缓存、最早修订重新查询，且无写提交。仅为该夹具设置60秒TTL，避免默认2秒过期混淆容量淘汰；不睡眠、不反射调用缓存业务函数或直接写缓存。固定Java全量与源码一致性验收。


### 2026-11-10T15:49:23+08:00 Java查询结果消失与性能跟踪HTTP补测设计

继续标准开发路径，责任为测试设计、实现、真实HTTP验证和覆盖率证据，由主执行者与确定性工具承担。扩充领域夹具：公共大纲ID已解析但联表头部查询无行时应返回404且无提交；团队插入后按编码回查无行时应返回404且无提交，恢复夹具后正常创建。仅模拟JDBC查询结果，不连接共享库，不直接调用私有业务辅助方法。手册快照夹具单独启用PERF_TRACE=1，保留其他夹具默认配置，验证真实HTTP快照读取及性能诊断分支。固定9个Java产品源码全量采集，以原门槛验收，不调整分母。


### 2026-11-10T15:51:00+08:00 大纲治理保存、说明编辑和发布DOM补测设计

固定Chromium主页面通过公开委托点击入口验证：内容说明打开、关闭、失败重试及成功保存；责任分工保存时合并目录原分工、文档主责与协作领域，保留版本；发布失败恢复按钮及成功提示；移动文档失败保留弹窗与成功关闭，并核验目录顺序和父节点。使用隔离fetch响应记录请求契约，禁止访问真实写接口。每个动作断言请求载荷和可见状态，恢复应用状态、URL及fetch；全量Istanbul仍包含全部产品脚本。


### 2026-11-10T15:54:56+08:00 企业能力包运行时与提示词公开契约补测设计

通过公开runtime-profile和prompt-generator API验证：无运行时的上下文回退和空追溯、未登记或未解析资源的稳定错误、manifestRef别名及冻结返回值、策略缺失与歧义及显式ID选择；不读取私有实现入口。提示词验证兼容模式的全部输出目录映射、未知类型回退、四类资料引用及目标库字段。测试临时替换全局运行时描述符并在finally恢复，文件读取使用runtime隔离资源。固定Node全量分母与门槛不变。


### 2026-11-10T15:57:34+08:00 Java候选大纲编号分配失败HTTP补测设计

在既有insertOnly候选导入成功前，通过JDBC夹具让KC_OUTLINE_SEQ结果集为空；真实PUT快照应返回503且无候选版本、节点写入和提交，恢复后相同请求正常创建。保持真实HTTP入口、全部源码分母与原门槛，不直接调用nextTableId或其它私有业务辅助方法。


## 2026-11-10T16:01:35+08:00 HTML 导入公开契约补测设计

用户完整提示词：

> /goal 知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。

继续标准开发路径，由主执行者和确定性测试承担设计、实现与验证责任。通过公开 scan/parse 和 Markdown 转换接口验证不存在目录、非目录错误、符号链接忽略、行内代码、列表、换行、不规则表格、无属性图片与链接、创建时间和版本元数据。夹具写入 runtime/test-results，断言输出语义与错误，不修改产品代码或覆盖率分母。先定向 Jest 验证，再固定全量采集。前端写作编辑器用例正通过真实隔离 HTTP 定向复现模型选择过期失败。


## 2026-11-10T16:02:26+08:00 写作覆盖率夹具配置快照设计

用户完整提示词：

> /goal 知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。

前端全量第 28 个编辑器复用场景因 MODEL_SELECTION_STALE 失败，但独立真实 HTTP 重跑通过。夹具默认模型治理在 catalog 和 resolve 分别读取共享配置，存在并发变化风险。仅对注入 generate 的隔离场景，在 setup 时读取一次配置并通过 configManager 注入快照，保持真实模型选择版本校验；不修改共享配置或产品代码。先定向编辑器用例，再完整采集，旧失败证据保留。


## 2026-11-10T16:03:21+08:00 Java 候选大纲所属手册边界补测设计

用户完整提示词：

> /goal 知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。

通过现有隔离真实 HTTP 候选导入入口，验证所属手册缺失、不存在以及手册存在但大纲主体查询消失。分别断言公开错误状态、候选未创建、无提交及无快照写入；恢复夹具后继续原成功生命周期。仅扩展 JDBC 夹具结果，不调用私有业务方法。固定九个 Java 产品源文件全量 JaCoCo 验证。


## 2026-11-10T16:06:46+08:00 本地参考文档上传 HTTP 补测设计

用户完整提示词：

> /goal 知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。

复用 AI 执行公开边界的隔离 FileAggregateStore 与真实 HttpServer，通过 ai-sources/uploads 上传原始字节。验证中文编码文件名、非法百分号文件名的降级、缺省文件名、空正文、扩展名拒绝、请求超过策略上限、405；成功场景核验 sourceId、内容摘要、上下文和持久化来源，失败场景核验无状态写入。仅增测试和相关接口辅助函数，不修改公共业务契约。待当前 Node 固定采集结束后修改用例并定向验证，避免报告清单漂移。


### 2026-11-10T16:13:53+08:00 覆盖率公开契约补测实际结果

继续同一覆盖率目标。新增企业能力包运行时与提示词边界（定向19项）、HTML导入边界（定向20项）、本地参考文档上传真实HTTP（所在套件14项）、大纲说明/治理/发布/移动八次DOM写交互，以及Java查询消失、编号分配失败、候选所属手册不存在和主体查询失败。Node固定163文件全量采集通过；浏览器固定57产品脚本全套采集通过；Java固定9源码全套采集通过。具体测试总数以各报告原始日志为准。

- Node：行 15536/16074（96.65%），分支 15199/18311（83.00%）；仍缺 538 行和达到95%所需的 2197 个分支。证据 `runtime/test-results/node-ai-source-upload-http-stable-20261110/coverage-summary.json`。
- 浏览器前端：行 8286/10114（81.92%），分支 9501/13856（68.56%）；仍缺 1828 行和达到95%所需的 3663 个分支。证据 `runtime/test-results/frontend-outline-governance-stable-20261110c/coverage-summary.json`。
- Java：行 3324/3360（98.93%），分支 1889/2178（86.73%）；仍缺 36 行和达到95%所需的 181 个分支。证据 `runtime/test-results/java-candidate-handbook-boundaries-stable-20261110b/coverage-summary.json`。

三端源码一致性均通过，汇总脚本再次逐项SHA256比对报告清单与当前文件。统一报告 `runtime/test-results/coverage-status-20261110-current.json` 保持FAIL，goal保持active，未改变产品分母和100%行/95%分支门槛。

纠偏：大纲502/503会转换成统一中文暂不可用提示，DOM错误断言遵循公开行为。一次前端采集因写作模型选择过期失败，独立重跑通过；隔离generate夹具改为启动时模型配置快照，保持真实版本校验并避免并发共享配置变化。HTML新增扫描夹具最初污染既有扫描数量，增加清理；NormalizedDocument未暴露description字段，移除该错误断言。Java空手册字段按兼容规则回退业务标识，返回404所属手册不存在，修正断言并保留失败日志。


## 2026-11-10T16:15:14+08:00 数据库大纲治理网关双层 HTTP 补测设计

用户完整提示词：

> /goal 知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。

继续标准开发路径，主执行者与确定性测试承担设计、实现和验证。在既有大纲边界测试中增加数据库模式的隔离网关，使用独立线程上的领域 HTTP 回显服务，核对治理读写、发布、技术领域、任务列表/详情/指派的上游方法、路径、查询和请求体，核对公开成功信息及返回信封。关闭上游后逐接口验证 503 和稳定错误码，再关闭网关并恢复环境变量。全程真实 HTTP，不连接共享数据库，不改产品逻辑或覆盖分母；先定向套件，再固定 Node 全量采集。


## 2026-11-10T16:16:41+08:00 语义分块公开输入边界补测设计

用户完整提示词：

> /goal 知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。

通过 chunkFile 和既有公开 Token 估算接口验证三级标题达到阈值时切分、关闭 overlap 后正文不串入前块、YAML 前置剥离、缺省标题与元数据、显式 docId/sourcePath 和领域追溯字段、关闭表格/代码保护的公开配置。断言实际正文、稳定标识、元数据和分块完整性；不直接调用弱边界私有业务辅助函数。维持现有产品源码与覆盖范围，定向测试后归入 Node 固定全量采集。


## 2026-11-10T16:19:01+08:00 增量任务表单委托交互补测设计

用户完整提示词：

> /goal 知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。

扩展固定浏览器采集，通过实际 submit DOM 事件验证来源、两种范围选择、四类草稿操作、评论和证据登记。隔离 fetch 仅返回受控信封，逐项断言请求路径/方法/正文、失败状态与按钮恢复、重试成功状态；不调用 app.js 私有方法，不写共享业务数据。临时状态及 fetch 在 finally 恢复，后端契约使用已有真实 HTTP 测试；此次仅测试前端事件到 API 序列化。保持固定 57 产品脚本和全部既有浏览器套件，完整采集验收。


### 2026-11-10T16:21:34+08:00 表单补测范围纠偏

数据库网关初版参数化测试因可选第五参数被 Jest 当作 done 回调而超时，改用 rest 参数；写入先经过元数据回收站守卫，领域线程夹具新增可选 responses 注入合法 outlines，原适配器回归保持通过；不同接口不统一暴露 error.details，断言仅采用公开状态、错误码和消息。定向两套件 95/95 通过。

浏览器初版额外构造了当前生产 view.js 不渲染的 documentIds 复选框；旧分支把 RadioNodeList 当文本控件，实际发送空数组。移除此不匹配现行页面的场景，保留真实 textarea 范围表单；不更改产品行为来适配测试。失败证据 frontend-incremental-form-commands-stable-20261110 保留，完整复采使用 b 目录。该历史兼容分支问题列入待办，不计作达标。


## 2026-11-10T16:25:13+08:00 GitLab OAuth 刷新与凭据错误边界补测设计

用户完整提示词：

> /goal 知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。

继续同一 active goal，采用标准开发路径，由主执行者承担设计、实施及确定性验证，不启动独立 Agent。通过公开 OAuth API 和隔离本地真实 HTTP token 服务验证缺少刷新令牌、400/401 失效、502 暂不可用、非法 JSON、连接失败、强制刷新及凭据读取错误；断言状态、凭据保留和请求表单，恢复环境与 fetch。无共享数据库写入，不改变产品规则、固定源码分母或目标阈值。定向 Jest 通过后再做源文件稳定性校验的全量复采；浏览器正在采集，保持其输入不变。


## 2026-11-10T16:27:14+08:00 OAuth 授权状态生命周期补测设计

用户完整提示词：

> /goal 知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。

在相同公开 API 和隔离 HTTP 夹具上验证配置缺失/非法、会话缺失、授权码缺失、state 一次性消费、8 小时过期和 1000 条待授权容量淘汰；通过 Date.now 局部 spy 推进过期边界并在 finally 恢复，不使用私有 Map 或私有方法。服务返回错误/非法 JSON 时不保存凭据，成功回调验证安全 returnTo 回退与过期时间。


## 2026-11-10T16:31:55+08:00 资产目录与大纲工作簿 HTTP 故障恢复补测设计

用户完整提示词：

> /goal 知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。

通过已存在的统一入口隔离 HTTP 夹具补测 /assets/catalog 读取成功与失败（503、稳定公开错误、不泄露内部错误），大纲模板和样例在启动后文件丢失/变为目录时的下载错误，以及数据库模式技术领域配置缺失/异常时模板拒绝生成。使用 runtime 下临时文件、可控注入存储和真实 HTTP，断言恢复后仍可读取；不改源码分母或产品规则。当前复采结束后才修改被采集测试输入。


## 2026-11-10T16:36:51+08:00 OAuth 配置缺项与无过期令牌补测设计

用户完整提示词：

> /goal 知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。

沿用标准开发路径，主执行者承担设计、测试实现及确定性验证。逐项删除 OAuth client ID、secret、回调 URI，通过公开 start 验证 503 配置错误且无网络请求；验证无过期时间和远期过期凭据经公开 tokenForUser/status 可直接使用、不触发刷新。保持产品源码、覆盖范围与目标阈值不变。定向真实 HTTP 夹具通过后，与资产目录/工作簿边界测试一起执行固定 Node 全量采集并核对源码稳定性。HTML 报告需求仍待用户确认，未实施改造。


### 2026-11-10T16:41:52+08:00 OAuth 与工作簿边界覆盖率复采结果

继续同一覆盖率目标。新增 OAuth 本地真实 HTTP 刷新、配置缺失、授权 state 生命周期、凭据错误及无过期时间/远期过期令牌免刷新测试；资产目录和大纲工作簿验证下载故障、配置缺失及失败后恢复。本轮两套件定向 37/37 通过。Node 固定 163 个 Jest 文件全量采集结果以日志为准；浏览器前端固定 57 产品脚本表单交互报告及 Java 固定 9 源码报告再次核对当前清单。

- Node：行 15583/16074（96.94%），分支 15268/18311（83.38%）；仍缺 491 行和达到95%所需的 2128 个分支。证据 `runtime/test-results/node-workbook-oauth-stable-20261110/coverage-summary.json`。
- 浏览器前端：行 8321/10114（82.27%），分支 9522/13856（68.72%）；仍缺 1793 行和达到95%所需的 3642 个分支。证据 `runtime/test-results/frontend-incremental-form-commands-stable-20261110c/coverage-summary.json`。
- Java：行 3324/3360（98.93%），分支 1889/2178（86.73%）；仍缺 36 行和达到95%所需的 181 个分支。证据 `runtime/test-results/java-candidate-handbook-boundaries-stable-20261110b/coverage-summary.json`。

三端汇总时再次逐项 SHA256 比对当前文件，保留完整原始报告。统一汇总仍为 FAIL，goal 保持 active，未改变产品分母与行100%/分支95%门槛。HTML 报告分类分页需求已复述，等待用户确认，未在此次覆盖率补测中实施。


2026-11-10T16:42:01+08:00 补充验收：Node 全量 162 套件通过、1 套件跳过；2131 条成功、8 条跳过，jestExit=0，源码清单无变化。OAuth 模块行 111/111（100%）、分支 136/142（95.77%），达到模块目标；全平台仍未达标。相关修改 git diff --check 通过。


## 2026-11-10T16:43:11+08:00 增量审核锚点与冻结门禁补测设计

用户完整提示词：

> /goal 知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。

继续标准开发，主执行者承担设计、补测及确定性验证；未触及人工审批边界。基于最近固定报告缺口，扩充隔离真实 HTTP 的增量审核套件：非法评论类型/严重级别、行/字符范围的负值/倒序/非整数/缺项、差异锚点不属于候选，以及 document_span 人工确认与合法范围回读；冻结状态拒绝来源、范围、草稿和检查，候选要求最新通过的草稿指纹。拒绝请求断言完整存储及审计零副作用，成功请求断言持久化及幂等重放。保留现有业务规则、产品覆盖范围与阈值，定向后固定全量复采；所有数据仅在 runtime/内存，不连接共享数据库。


## 2026-11-10T16:45:09+08:00 我的生成记录公开投影补测设计

用户完整提示词：

> /goal 知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。

在工作台真实 HTTP 夹具中将 listMyGenerations 接入真实内存服务，验证草稿引用的字符串、数字、id/draftId/versionId/ref 和缺少标识回退，发起者/参与者/创建人兼容关联及无关记录排除，进度与失败原因投影、更新时间排序、禁止跨用户/非 mine 范围查询，明确断言提示词和访问令牌不出现在响应。仅扩充测试，产品接口和权限不变；纳入固定 Node 全量复采。


### 2026-11-10T16:50:21+08:00 增量审核和本人生成公开 HTTP 补测实际结果

继续同一覆盖率目标。增量审核新增评论类型、严重级别、行/字符锚点范围、候选操作关联、document_span 人工确认、幂等评论回读、冻结写入拒绝和最新检查门禁；工作台本人生成接口接入真实服务，验证草稿引用兼容格式、发起/参与/创建人关联、排序、失败与进度投影及私有字段不泄漏。两套件定向 61/61 通过；失败请求均校验完整存储与审计不变。固定 163 Jest 文件全量复采通过，统计以原始 jest.log 为准。

- Node：行 15592/16074（97.00%），分支 15322/18311（83.67%）；仍缺 482 行和达到95%所需的 2074 个分支。证据 `runtime/test-results/node-review-generation-stable-20261110/coverage-summary.json`。
- 浏览器前端：行 8321/10114（82.27%），分支 9522/13856（68.72%）；仍缺 1793 行和达到95%所需的 3642 个分支。证据 `runtime/test-results/frontend-incremental-form-commands-stable-20261110c/coverage-summary.json`。
- Java：行 3324/3360（98.93%），分支 1889/2178（86.73%）；仍缺 36 行和达到95%所需的 181 个分支。证据 `runtime/test-results/java-candidate-handbook-boundaries-stable-20261110b/coverage-summary.json`。

汇总再次逐项 SHA256 比对三端产品及采集输入清单，保持固定分母和行100%/分支95%阈值。全平台目标仍未达成，goal 保持 active。前端下一批交互缺口已只读整理，未改前端采集输入；HTML 报告分类分页需求仍待用户确认。


2026-11-10T16:50:38+08:00 补充验收：本轮 Node 全量 162 套件通过、1 套件跳过；2167 条成功、8 条跳过，jestExit=0，source-stability stable=true/changedFiles=[]。相较上一份固定报告增加9行、54分支。增量服务模块行764/779（98.07%）、分支997/1166（85.50%），模块及平台仍未达标；不更改门槛。


## 2026-11-10T16:52:51+08:00 前端评审表单与在线评审前置校验补测设计

用户完整提示词：

> /goal 知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。

沿用标准开发，主执行者承担设计、实现和确定性验证，未触及人工审批边界。扩充现有浏览器真实 DOM 委托矩阵：意见提交覆盖合法锚点、空锚点、损坏 JSON、默认及显式类型/级别；回复和退回覆盖正文裁剪及候选指纹兼容。每项验证失败提示、按钮恢复、同一幂等键重试和成功反馈。在线评审验证未选稿、多选单篇、未选审核人、路径缺失、混合分支的提交前拦截，以及网络错误与服务端缺少任务的反馈。只替换隔离浏览器请求响应，不改变后端行为；后端契约沿用真实 HTTP 套件。定向交互与固定完整浏览器采集验证，保留产品范围、覆盖率阈值和分母；产物集中 runtime。


## 2026-11-10T16:54:50+08:00 手册审核摘要与合成基线公开 HTTP 补测设计

用户完整提示词：

> /goal 知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。

扩充隔离真实 HTTP 套件，验证手册摘要按时间排序、状态筛选、不同手册/不可读记录排除，以及未解决意见与阻断意见计数。合成基线替换仅取消同手册同业务版本的当前标记；其他版本/手册不变、重复幂等请求不新增记录和审计，读取返回新基线但不泄漏全文。缺少必填字段的写请求断言存储零变化。沿用标准开发路径、固定 Node 全量复采与原100%/95%阈值，不改变产品。


## 2026-11-10T17:04:54+08:00 非手册来源审核上下文绑定补测设计

用户完整提示词：

> /goal 知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。

工作台隔离 HTTP 网关接入真实增量服务，覆盖非 handbookSource 审核候选按 target/operation 记录检查文档标识、仓库路径和文档路径二者关联。非法文档、未知路径和同一候选中其他文档路径均返回 REVIEW_DOCUMENT_MISMATCH；合法组合保持读取能力，全部请求断言仓库和审计零写入。此为公开上下文完整性测试，纳入下一份固定 Node 采集，产品和阈值不变。


### 2026-11-10T17:11:36+08:00 最终哈希复核发现前端采集后发生并行改动

Node固定全量复采通过：162套件成功、1套件跳过；2175条成功、8条跳过；行15595/16074（97.02%）、分支15332/18311（83.73%），与上一份通过报告相比增加3行、10分支。真实HTTP定向51/51与18/18通过。前端完整采集当时通过且稳定，行8346/10114（82.51%）、分支9560/13856（68.99%），增加25行、38分支；但最终汇总时发现 document-tasks/view.js 在采集结束后又被修改，哈希不再匹配，严格汇总校验已拒绝放行。保留旧报告，不回退他人修改，重新采集当前前端。与此同时将表单锚点向量中的字段规范为公开契约 documentId/anchorKind/nodeId，纳入本次复采。原覆盖率目标保持active，不能把历史前端结果声明为当前代码结果。


## 2026-11-10T17:17:52+08:00 手册抽屉与个人账号失败恢复补测设计

用户完整提示词：

> /goal 知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。

标准开发，由主执行者承担设计、实现和验证，未命中人工审批边界。前端复采 c 已终止，采集期间 document-tasks/view.js 与 production-writing-page.js 变化，stable=false、completed=false，仅供诊断。补充真实浏览器 DOM 点击和键盘矩阵：目录开关、助手打开与关闭、互斥、页签可访问性、焦点恢复、生产页面 Escape 关闭与 dialog/其他页面守卫。账号弹窗沿真实产品渲染读取隔离账号列表，验证读取失败重试、五种连接状态、解除失败及恢复成功、空列表和按钮/背景关闭；拦截账号 HTTP 路由，不连接企业 GitLab。伪代码：saveState; mountControls; clickAndAssertAriaFocus; dispatchEscapeWithGuards; interceptAccounts; openRetryDisconnect; assertRequestsAndDOM; restoreStateFinally。保持完整产品源码、分母与 100%/95% 阈值，用完整 Istanbul 复采与前后 SHA 验证；后端行为本批未变，运行写入集中 runtime。


## 2026-11-10T17:20:48+08:00 GitLab 配置 JDBC 无错误消息故障补测设计

用户完整提示词：

> /goal 知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。

沿现有隔离真实 Java HTTP GitLab 配置生命周期增加 JDBC prepareStatement 抛出无 message SQLException 的读写场景，验证公开接口返回 503/STORAGE_UNAVAILABLE 与中文恢复信息，故障请求没有提交，恢复后连接名、版本和映射不变。通过 JDBC Connection 包装夹具注入，不直接调用私有错误格式化函数，不访问真实数据库。完整固定 9 文件 JaCoCo 采集与 SHA 前后核验，不变更产品源码、覆盖率阈值或分母。

## 2026-11-10T17:25:51+08:00 JDBC 空验证结果与清理失败覆盖设计

继续用户完整目标：

> /goal 知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。

标准开发，本批仅扩展 JdbcPoolReuseCheck 的隔离 JDBC 驱动夹具，不修改产品规则。验收矩阵：空 SELECT 验证结果、ResultSet.close 失败、Statement.close 失败、验证 rollback 失败及已关闭空闲连接均必须丢弃原连接、释放容量并创建可复用的新连接；验证查询相关场景还断言结果集和语句都执行清理。通过完整固定 9 源文件 Java JaCoCo 采集及其真实本地 HTTP 契约验证，保持 100% 行/95% 分支原目标。浏览器当前已确认 session 49559 存活，继续原进程，不因空日志重启。HTML 报告增强尚待用户确认。

2026-11-10T17:27:20+08:00 固定 Node 复采准备：用户完整目标“/goal 知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。”原 Node 报告之后源码已变化，不能继续标为当前。下一轮完整 Jest 复采沿用配置中的全部产品 glob，并直接枚举这些 glob 建立运行前后 SHA 清单，同时覆盖测试 JS/CJS 和配置；新证据使用独立目录，不覆盖历史报告。等待当前前端采集结束后启动，避免并发干扰。

2026-11-10T17:28:39+08:00 本批结果：JdbcPoolReuseCheck 新增五种真实连接池借还路径的隔离驱动故障矩阵，完整固定 Java 采集通过，9 源文件行 3327/3360（99.02%）、分支 1895/2178（87.01%）。相对 SQL 无消息故障批次增加 2 行、4 分支。source-stability=true，运行后再次逐文件 SHA 核对无变化；证据 runtime/test-results/java-pool-validation-stable-20261110/coverage-summary.json 及 html/index.html。覆盖率仍未达到用户要求；Node 待当前源码复采，前端原采集 session 49559 在审核场景持续产出计数，不能将未完成结果当作当前平台达标证据。

2026-11-10T17:32:43+08:00 前端资产统计覆盖设计：用户完整目标“/goal 知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。”基于实际 app.js 缺口，补充公共资产导航和分支选择事件矩阵：无仓库/无分支零统计请求、读取拒绝及默认提示、访问探测失败、统计失败、成功与保存分支/失效偏好回退、分支切换成功和失败恢复。使用浏览器隔离 GET fixture，断言渲染和请求 ref/language，无企业 GitLab 或业务写入。当前 Node 全量复采运行中，只修改前端采集器，待其结束后运行固定前端全量。上一前端采集完成全部场景但期间 document-tasks/view.js 变化，8517/10256 行、9876/14933 分支仅诊断值。

2026-11-10T17:36:15+08:00 Node 全量复采暴露旧契约断言：固定套件 native-contract-coverage 中 handbook-production-api 的 PingCode 场景仍断言其他空间 403；当前已实施的来源接口开放所有可访问空间，该夹具却固定返回 space1，导致跨空间响应不匹配而实际 502。维护测试契约：按请求空间返回匹配投影，断言跨空间成功，远端拒绝映射为来源读取失败并不广播平台权限失败；保留非法路径、查询串、超限与快照确认断言。用户完整目标仍为“/goal 知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。”不修改生产权限规则或待审批超时设置。


## 2026-11-10T17:40:09+08:00 统一测试 HTML 场景与用例报告

用户完整提示词：

当前测试完后，有一个html的报告？没有的话，需要输出html的报告。比如 “python3 tests/run_tests.py   xxx” 之后，可以看到一个html报告，能够知道测试了多少用例，成功失败用例是怎样的，需要安装不同类型的测试场景，html的报告进行分页展示，但是有一个总览的页面。

先复述下这个需求，确认已经对这个需求清晰明了之后，再完成这块的需求内容。

需求复述：所有实际测试命令默认生成中文 HTML 总览，展示任务和用例各自的统计、耗时及结论；按语义测试场景分别输出分页用例详情、失败信息与日志；覆盖率启用时显示真实采集结果。list/dry-run 不冒充已执行报告。无需等待额外批准，用户已授权完成需求。采用标准开发，主执行者承担设计、实现、验证；不触及人工审批边界。

设计：保持 report.html 为总览，details/report.json 为单一结果数据；扩展 TaskResult.cases。Jest、Playwright 使用框架 JSON，pytest 使用 JUnit XML，Node TAP/unittest 逐条输出适配；独立脚本保留任务结果并明确未统计。每场景静态分页（默认50，可 --report-page-size 配置），相对链接支持离线打开，失败文本全部转义。异常和超时保留报告与非零退出码。伪代码：执行任务→读取结构化结果/逐条日志→保存 JSON→总览汇总→按场景分组并切页→打印 HTML 路径。不引入业务规则或提示词硬编码。

验证：真实混合框架通过/失败/跳过夹具、分页及 HTML 转义回归，统一 smoke 实跑，Chromium 离线导航与性能检查；保留原有覆盖率目标与其他在途修改。


## 2026-11-10T17:45:09+08:00 HTML 报告交付说明

### HTML 报告使用

```bash
python3 tests/run_tests.py smoke
python3 tests/run_tests.py unit --report-page-size 50
python3 tests/run_tests.py full --coverage
```

实际运行结束后终端输出 `HTML 测试报告：.../report.html`。所有分类默认生成总览，按场景进入 `scenes/scene-N-P.html` 查看逐条结果；默认每页 50 条，可配置。页面采用静态相对链接，可直接离线打开，需保留整个运行目录以查看场景和日志。总览分别统计任务和用例，不将独立脚本冒充单条用例；无法可靠统计时明确标注。失败、超时、快速失败仍输出报告，未运行任务标记未执行，原退出码语义保留。`list` 和 `--dry-run` 不生成已执行报告；`--report` 仍是兼容 JSON 导出参数。

输出位置：`gate/full/all` 位于 `runtime/test-reports/YYYY-MM-DD/<run>/report.html`，其他分类位于 `runtime/test-results/<分类>/<run>/report.html`。机器数据位于同目录 `details/report.json`，原始任务日志和框架结果位于 `details/tasks/`。


## 2026-11-10T17:45:50+08:00 HTML 报告验收结果

统一入口回归 43/43 通过（`runtime/test-results/html-runner-final-43.log`）；真实混合夹具验证 Jest、Node、unittest、pytest、Playwright 的成功、失败、跳过记录，失败详情及用例数正确；正式 gate 快速失败测试确认 HTML 仍生成、退出码 1，后续任务标记未执行。真实 smoke 24/24 通过，`--report-page-size 2` 生成 12 个场景分页，报告 `runtime/test-results/smoke/20261110-174429-329509-smoke/report.html`。

浏览器验收报告 `runtime/test-results/unit/20261110-174337-095249-unit/report.html` 包含故意失败的验证夹具，不是产品失败证据。Chromium 验证离线总览/场景/分页/返回、失败展开、390px 无页面横向溢出、脚本错误 0；本机样例总览 DOMContentLoaded 7.7ms（前次9.1ms），仅代表样例环境。脚本 `runtime/test-results/verify-html-browser.cjs`；移动视图 `runtime/test-results/html-report-mobile.png`。

所有实际分类默认生成 HTML，list/dry-run 不生成执行报告，无法可靠计数的独立脚本明确标注未统计；覆盖率显示本次真实结果，未采集则显示未启用。本轮未重采全平台覆盖率，100% 行/95% 分支目标仍 active、未达成；没有降低阈值或排除产品源码。


## 2026-11-10T17:46:33+08:00 覆盖率续作：模板搜索等待与当前基线复采

用户完整提示词：/goal 知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。

上一轮交付 HTML 报告为有效进展；继续完整三运行时目标。当前无覆盖率采集进程，前端上次终止于模板 compositionend 后固定240ms断言。产品有180ms debounce，采集负载下窄时间窗口不足；修复采集器为等待真实列表数量和名称条件，保留组词期间不得提前筛选的负向观察。验收为完整前端固定清单、源码前后哈希一致；之后复采 Node 当前清单。Java当前证据仍为3327/3360行、1895/2178分支，需继续补33行及至少175分支；不降低任何阈值或排除文件。


## 2026-11-10T17:51:05+08:00 手册负责人兼容投影验收设计

用户完整目标：/goal 知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。

标准开发，主执行者扩展隔离手册快照 HTTP/JDBC 场景，不改产品规则。在既有回滚验收后，通过真实 PUT/GET 测试负责人 JSON 字符串对象、损坏字符串、非对象 JSON、空白及非字符串输入；断言有效负责人保留、无效兼容值为空、旧负责人不残留、版本递增与事务提交。完整固定 Java JaCoCo 采集并核对源码稳定性。HTML 报告已验收；PingCode 可访问空间契约修正的原生 HTTP/Chromium 定向场景通过1/1，证据 runtime/test-results/pingcode-accessible-spaces-native-20261110b.log。


2026-11-10T17:52:52+08:00 草稿与大纲边界设计：沿用用户100%行/95%分支目标；负责人兼容批次完整Java采集通过且源码稳定，3327/3360行、1897/2178分支。下一批只补纯投影契约：无效草稿条目跳过、缺失/空/非列表历史、历史含无效项且无当前版本时空历史，以及大纲缺失/非数字顺序和层级拒绝。断言投影不泄漏旧正文、有效条目保留、等版本更新接受；大纲错误码精确匹配。随后完整Java复采，不修改产品。


2026-11-10T17:55:05+08:00 分配兼容与GitLab映射验收设计：草稿投影26/26行、24/24分支，大纲节点31/31行、48/48分支，完整Java源码稳定，3327/3360行、1904/2178分支。下一批通过真实隔离快照HTTP验证单值技术领域兼容、目录不生成文档责任项、缺失技术领域不保留责任项；通过GitLab仓库契约验证已有连接增加非空路径前缀、映射切换为仅英文路径并清除旧中文路径。保持原覆盖目标与产品规则，按事务数、责任写入数、版本与回读验收，再完整复采。


2026-11-10T17:57:10+08:00 Node能力包边界测试设计：用户完整目标“/goal 知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。”针对真实公开loadProfile/validateProfile未覆盖错误路径，补结构版本/标识/引用数组/最低密钥要求校验；隔离runtime目录内验证清单不可读、损坏JSON、Schema缺失/损坏、Schema拒绝及目录资源拒绝。断言稳定错误码、issueCode和指针，不泄露绝对路径；文件每项清理，不修改产品配置或Schema，不模拟内部实现。先定向Jest覆盖率，再待前端结束做当前Node固定全量。


## 2026-11-10T17:58:53+08:00 本批覆盖率验证结果

完整Java采集 `runtime/test-results/java-assignment-compatibility-stable-20261110/coverage-summary.json` 通过，源码稳定：3329/3360行（99.08%）、1909/2178分支（87.65%）。相对本轮开始增加2行、14分支；仍缺31行、至少161分支。DraftReadProjection为26/26行、24/24分支，OutlineNodeSnapshot为31/31行、48/48分支。负责人字符串、损坏值、技术领域单值/缺失、目录过滤、GitLab非空前缀及仅英文映射均经隔离HTTP或公开仓储契约验证。

前端完整执行结束但失败原因为采集期间 `modules/document-tasks/view.js` 被并发工作修改，报告 `frontend-asset-statistics-stable-20261110b` source-stability=false；8569/10267行、9851/14413分支只能作诊断，不能用于当前源码达标判断。模板搜索等待修正及新增资产统计场景已通过实际场景执行，仍需稳定源码复采。

企业能力包加载器新增17项边界测试，定向23/23通过、文件行覆盖100%、分支80%（定向样本，非完整Node覆盖结论），证据 `runtime/test-results/node-profile-loader-boundaries-20261110b.log`。首次定向命令使用不存在的配置路径，启动即失败；已改用统一入口实际引用的 `tests/unit/agent-runner/jest.coverage.config.js` 完成验证。当前固定163套件Node完整采集已启动，未完成前不更新为当前有效值。作用范围差异空白检查通过；原100%行/95%分支目标保持未达成。


## 2026-11-10T18:03:25+08:00 Node全量结果与证据有效性

固定154个产品文件、163个Jest套件完成：162套件通过、1套件条件跳过；2192用例通过、8跳过、0失败，260.53秒。修正后的PingCode原生契约套件通过。报告 `runtime/test-results/node-baseline-current-stable-20261110d`：15676/16133行（97.16%）、15576/18595分支（83.76%）；但期间 document-tasks.js、knowledge-center.js 和 document-tasks-frontend.test.cjs 被其他在途任务修改，source-stability=false，收集脚本因此退出1。这是证据一致性失败，不是测试用例失败；覆盖率只作诊断，不能标为当前有效。能力包加载器在该全量样本140/140行、103/125分支（82.4%）。Java本轮最终清单再次核对无变化，仍是99.08%行、87.65%分支。

复盘与下一步：连续全量采集遇到并发源文件写入，继续原地重复采集不能保证稳定。下一批应建立包含当前未提交改动的独立源码副本、仅复用依赖，在固定副本完成Node和前端采集，并区分副本版本证据与此后变化的共享工作区；不能静默放宽哈希校验、覆盖在途改动或将历史百分比标记达标。HTML统一报告需求已交付且回归43/43、smoke24/24通过；100%行/95%分支goal仍active。


## 2026-11-10T18:05:21+08:00 覆盖率固定副本与策略引用校验设计

用户完整目标：知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。

上一轮属于进展：Java新增2行14分支，Node全量2192通过；当前Node/前端证据因并发源码变化无效。本批标准开发，requiredResponsibilities为测试设计、实现、确定性验证，由主执行者承担，无需子Agent或人工审批。

先补公开validateProfile策略及资源引用错误矩阵：缺字段/集合类型/敏感字段/资源ID重复或非法/工作区能力引用/密钥引用/策略各类引用/人工选源确认/启用策略歧义，断言错误码和JSON指针；再验证可选策略引用省略与禁用策略不占用匹配。

固定副本方案先在runtime落地：从当前已跟踪与未跟踪工作文件复制apps/packages/tools/tests/config/knowledge/.codex和根契约文件，排除external、runtime、coverage和依赖目录；重复核对复制文件哈希，记录完整清单。仅依赖node_modules及JDBC二进制复用原路径，副本runtime独立用于日志/输出，禁止回写共享产品源码。完整采集使用副本cwd、固定全部产品文件，无缩减分母；结果明确对应副本版本，再与共享源清单比较，不因副本稳定而声称变化后的共享源码达标。验收先执行现有定向契约和完整Node，之后前端。


### 2026-11-10T18:09:40+08:00 能力包凭据投影补测设计

继续目标：知识中心管理平台行覆盖率100%、分支覆盖率95%。通过公开loadProfile及runtime隔离的合法Schema清单，验证显式profileId优先于环境变量、env密钥存在/缺失与secretResolver成功/空结果；投影只输出configured布尔值，不泄露密钥，凭据变化不改变配置指纹。仅补测试，不改产品规则。固定副本全量采集继续使用其原有清单，本次新增测试另行定向验收，不混充副本证据。


### 2026-11-10T18:10:57+08:00 能力包校验与凭据投影定向结果

公开校验补测42/42通过，模块行100%、分支93.6%；继续增加4项合法清单凭据投影场景后46/46通过，模块行100%、分支96.8%、语句与函数100%。显式profileId覆盖非法环境选择，env/secret解析有值与空值均验证，运行时投影不包含密钥、凭据切换不改变配置指纹。证据 `runtime/test-results/node-profile-secret-boundaries-20261110.log` 及同名目录HTML/lcov。固定源码副本5413文件创建前后与副本SHA一致，路径 `runtime/test-results/coverage-snapshots/20261110-180553`；原163文件完整采集使用该副本，不包含随后新增的4项测试，不混称工作区最新证据。全平台100%行/95%分支目标仍未达成。统一HTML报告交付保持43/43回归、24/24 smoke通过，实际12个分页文件位于报告的scenes目录。


### 2026-11-10T18:13:56+08:00 固定副本环境问题与定向修复验收

163文件副本全量遇到被Git忽略的config/yashandb/service.env缺失，大纲数据库网关套件失败；运行长时间未继续输出后主动终止本次进程，source-stability记录stable=true、jestExit=-15，该报告不是通过证据且无可用完整覆盖率。保留原日志。在副本中补充仅一行注释的空service.env环境夹具，不复制本机凭据或共享服务地址；环境说明保存snapshot-environment-fixture.json。原真实双层HTTP测试定向19/19通过（outline-snapshot-environment-check.log），证明配置缺失问题已解决；尚未完成新的全量复采，不能声称平台达标。统一HTML报告需求已验收交付；本轮所有启动进程均已收束。


### 2026-11-10T18:17:07+08:00 向量和知识图谱增量生命周期补测设计

用户目标：知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。上一轮为progress：能力包加载器46项通过，行100%、分支96.8%；固定副本配置缺失已用空环境夹具和19项真实HTTP验证解决。继续标准开发路径，主执行者承担设计、补测和验证，不涉及人工审批。

范围：仅扩展vector-and-graph-index.test.js，通过公开build/search及JsonVectorStore/JsonGraphStore真实文件回读验证modified/deleted增量清理、未匹配delta保留、full重建移除旧记录及孤立边；验证禁用构建、无存储搜索拒绝、显式搜索存储、缺少chunkId/正文过滤及默认元数据。所有新增夹具在runtime/test-results独立目录，保持产品源码、完整分母与100/95阈值。先定向覆盖采集；已启动163文件固定副本全量，不纳入随后新增测试，禁止混称当前工作区全量结果。


### 2026-11-10T18:21:16+08:00 内容检查固定模板恢复补测设计与采集纠偏

用户完整目标：知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。

上一轮为progress：HTML报告交付核验完成；本轮继续原三端目标。向量/图谱生命周期15/15通过，两个模块行100%，分支分别98.24%/98.36%，证据runtime/test-results/node-index-lifecycle-20261110.log；不是平台总覆盖率。固定副本Node第二次采集因误含system-retrieval-flow共享服务场景已主动终止，source-stability记录jestExit=-15，无完整有效结果。根因为运行时辅助脚本使用full全部Jest分类，并非统一入口分类错误；后续隔离采集显式排除system分类，产品154文件分母保持不变，system仍保留显式执行能力。

标准开发，requiredResponsibilities为测试设计、实现及确定性验证，由主执行者承担。仅新增production-content-quality公开工厂契约测试，通过真实SDK到本地随机端口Provider HTTP检查上下文、固定模板版本恢复、坏哈希/未通过验证/缺失/畸形版本的局限提示、来源摘要与模型失败代码；真实模板持久化夹具置于runtime。检查规则优先使用仓库配置，模型仅使用本地测试端点。验收先定向覆盖率，再作为固定完整产品清单采集输入；不改产品实现、不降低阈值，不宣称局部达标等于平台达标。


### 2026-11-10T18:23:13+08:00 固定模板恢复定向验收结果

新增17项公开内容检查契约全部通过，真实SDK到本地Provider HTTP验证有效模板存储恢复、元数据优先、历史版本解析/哈希/验证状态失败、缺失来源/规则/模型配置、鉴权及非法模型响应、warning/blocking门禁。production-content-quality.js固定42行全覆盖，59/61分支（96.72%），55/55语句和9/9函数；证据runtime/test-results/node-content-template-boundaries-20261110-final/coverage-summary.json、lcov与HTML，原始日志同名前缀.log。首次夹具错误地把tokens对象断言为数字，已按SDK公开结构修正，保留失败日志；未修改产品逻辑。

下一步以包含最新17项、向量/图谱5项及能力包4项的全新固定副本采集完整产品分母。仅在运行时辅助采集器中按suite排除system共享服务场景并保存选择清单；这些测试仍由统一入口system/full显式执行，产品代码分母完整。不会将定向模块百分比当作平台结果，三端100/95目标仍active。


### 2026-11-10T18:25:51+08:00 Java数字大纲ID兼容回退验收设计

继续用户完整目标：知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。在StorageDomainReadHttpCheck隔离JDBC状态机中添加真实HTTP治理读取矩阵：业务ID不存在时数字内部ID101可回退到既有版本，缺失数字ID999/空白ID仍404，所有只读操作不提交、不修改治理或大纲状态。断言外部ID归一为outline-public及已有分工读取一致；保留产品实现和固定9源文件分母。通过完整Java JaCoCo采集验收，不使用私有方法反射调用制造覆盖率。Node固定副本采集仍使用启动时输入，与随后Java夹具变动区分。


### 2026-11-10T18:31:57+08:00 HTML范围确认及固定副本环境核验

用户完整确认：确认，按上述范围实施。对应问题：请确认上述 HTML 报告需求：所有实际测试运行默认生成总览页，按测试场景分类并分页展示逐条用例、结果及失败日志，启用覆盖率时同步展示覆盖率。是否按此范围实施？实现与既有43/43回归、24/24 smoke结果符合确认范围，无需重复开发。

固定Node副本20261110-182313首次160文件采集156组通过、1组跳过、3组失败，2190项通过、6项跳过、4项失败；SHA稳定，但失败结果不能用于达标验收。定位为遗漏只读历史大纲metadata.json、被Git忽略的真实PPTX、相对文档目录存在性以及数据库配置测试要求有效格式。仅在runtime副本补齐资源，前两者核对共享源复制前后及副本SHA；目录使用既有只读目录符号链接；数据库配置使用127.0.0.1:1合成不监听端点，无共享凭据。资源清单保存在snapshot-environment-fixture.json。三组定向复核105通过、5跳过；已启动同副本完整复采并将资源加入前后SHA清单，产品154文件分母保持。

Java数字ID断言更正：公开接口顶层outlineId回显请求101，关联任务outlineVersionId为outline-public；原设计中“外部ID归一”描述不准确，按实际公开契约验证关联正确性。全量用例执行通过，但源Main.java运行期间被其他在途工作修改，source-stability=false，保留为诊断，不能宣称有效全量。已创建20261110-183123固定源码副本（5416文件复制前后SHA一致）并重新采集固定9源文件。三端100/95目标仍未完成。


### 2026-11-10T18:35:26+08:00 固定源码全量采集结果与HTML交付确认

Node固定副本20261110-182313完整154产品文件、160 Jest文件采集完成，159组通过、1组跳过；2194项通过、6项跳过、0失败，182.32秒。运行前后源码/测试/环境资源SHA一致，jestExit=0。行15584/16093（96.83%），分支15403/18335（84.00%），证据runtime/test-results/coverage-snapshots/20261110-182313/runtime/test-results/node-isolated-fixed-environment-20261110/（coverage-summary.json、source-stability.json、HTML、lcov与jest.log）。保留共享服务system排除清单，完整产品分母未改变；不宣称包含共享服务端到端测试。

Java固定副本20261110-183123完整9源文件采集成功，前后SHA一致；行3335/3468（96.16%），分支1923/2302（83.54%）。证据runtime/test-results/coverage-snapshots/20261110-183123/runtime/test-results/java-numeric-outline-fixed-20261110/（coverage-summary.json、source-stability.json、java.xml、html）。该副本含同期新增产品实现，分母较上版3360行/2178分支增加，不按旧分母比较提升，不把固定副本描述成随后共享工作区最新源码。

HTML报告需求已按用户确认完成：默认中文总览、分类场景静态分页、逐条状态和失败日志、覆盖率启用时呈现真实结果；已有43/43入口回归、24/24 smoke及离线浏览器验收。本轮复核报告文件与12个分页均存在，相关文件git diff --check通过。当前没有仍运行的本轮采集进程。平台三端100/95目标尚未完成；下一步需在固定副本采集前端，再根据完整报告补足真实契约用例，保留全部产品分母和阈值。


### 2026-11-10T18:36:35+08:00 数据库大纲目录与治理契约补测设计

用户完整目标：知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。上一轮为progress：Node固定完整产品采集2194项通过（行96.83%、分支84.00%），Java固定9源采集行96.16%、分支83.54%，均未达标。本轮标准开发，requiredResponsibilities为补测设计、实现及真实HTTP验证，由主执行者承担，未触及人工审批边界。已扫描仓库Skill，未选用非必需专项流程。

仅新增数据库大纲路由HTTP测试：目录catalog跨手册筛选、无候选与空列表、Server-Timing传递、数据库大写状态公开归一、紧凑治理节点投影、历史治理回退、生命周期权限/只读/不存在/删除/恢复/清理确认、领域配置形态以及上游错误透明性。使用随机端口Express网关→真实DomainStore→独立Worker本地HTTP夹具，既覆盖异步fetch又覆盖同步curl，禁止共享服务与产品私有函数替换。夹具与日志置runtime，保持全部产品分母及100/95阈值；先定向采集，再纳入后续完整采集。前端完整采集在20261110-183123固定副本启动，避免并发源码变化污染；不因静默日志重启。


### 2026-11-10T18:44:59+08:00 前端覆盖率采集环境修复设计与大纲补测结果

用户完整目标：知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。继续标准开发，由主执行者完成设计、实现及确定性验证，无新增审批边界。新增25项数据库大纲真实HTTP测试与6组既有测试合跑144/144通过，退出0；定向outline.js为481/528行（91.09%）、506/668分支（75.74%），证据runtime/test-results/node-outline-projections-combined-final-20261110。不能作为平台总覆盖率。

前端固定副本两次采集均已失败退出，保留原日志：首次资产统计内存状态完成但DOM提示尚未更新；第二次同场景通过后，资料清洗服务不可用导致上传按钮不存在。修复限定采集器：资产统计等待实际DOM与状态同时完成；清洗场景启动随机本地端口HTTP夹具，浏览器路由转发真实HTTP请求，依次校验主服务503、索引503和正常数据，正常态继续验证上传弹窗打开关闭，拒绝未知接口并恢复路由/关闭服务。不提交上传、不写共享后端，不跳过清洗场景，不降低断言或覆盖率阈值。修改后在已停止的固定副本同步采集工具，保留产品源码及分母，通过完整浏览器采集确认。
# 统一测试入口 HTML 报告

每次实际运行默认在 `runtime/test-results/<场景>/<运行号>/report.html` 生成离线中文报告。报告包含运行总览、结果分布、失败与阻塞、测试场景分页、逐条用例详情、任务日志和覆盖率门禁；总览中的搜索和状态筛选覆盖全部分页，失败用例支持深链接。报告依赖的 CSS、JavaScript 和索引均保存于同一目录，不需要网络。

常用命令：

```bash
python3 tests/run_tests.py smoke
python3 tests/run_tests.py unit --report-page-size 50
python3 tests/run_tests.py full --coverage
```

未提供逐条协议的任务会明确标记为“未统计”，不会伪造用例数量。历史趋势、重试和附件只有在原始执行数据提供时才会展示。

### 2026-11-10T19:29:25+08:00 专业 HTML 报告复核

沿用已加载的仓库 REA 技能与业界参考证据，复核入口 unittest 43/43、真实 smoke 24/24。命令 `python3 tests/run_tests.py smoke --report-page-size 2` 生成 `runtime/test-results/smoke/20261110-192850-959829-smoke/report.html` 和12个场景分页。离线Chromium桌面/390px各10次，DOMContentLoaded最大45.7ms/77.4ms；跨页搜索、用例跳转、无JS浏览通过，脚本错误、HTTP请求及页面横向溢出均为0。原始测量、截图、可重跑脚本及9.5/10内部评分明细见 `runtime/rea/professional-test-report/ACCEPTANCE.md`；性能项仅0.5/1，未验收大型报告100ms，保留此前117ms样本。

覆盖率采集附记：固定副本补齐完整Vditor dist资源，避免编辑器初始化依赖缺失；隔离写作HTTP夹具对显式generate使用确定模型目录，显式modelGovernance及真实模型路径仍沿原契约。完整写作未插桩回归结束，33项中29通过、2失败、2跳过，无仍运行进程；不可将失败运行当作前端覆盖率通过。三端100%行/95%分支目标保持active。

### 2026-11-10T19:39:45+08:00 覆盖率夹具与大纲边界验证进展

写作夹具隔离：两个非模型场景显式注入拒绝意外调用的生成器，使用共享夹具提供的确定模型目录，避免本机加密配置污染；两项定向2/2通过，原断言保留。前端采集器新增运行前后完整输入SHA清单，覆盖后端模块、浏览器夹具、配置、知识大纲、前端静态资源与依赖锁；保留原产品分母，输入变化即失败；各子测试无论成功失败都保存日志，完整成功时额外生成Istanbul HTML和lcov。完整固定副本采集尚在运行，未宣称通过。

大纲新增7项真实HTTP测试，验证只读保护、恢复冲突、提案无效参数/重复文档、只读旧资源过滤与错误降级、旧版文件缺失/损坏、提示词导出真实回读和选择器兼容。旧版两个资源位置和导出位置在fs边界精确映射至runtime，保留真实产品解析器与组装器，无产品目录产物。两套件51/51通过；outline.js定向行489/528（92.61%）、分支532/668（79.64%），此前同两套件为457/528、487/668。模块仍未达100/95；全平台覆盖率另以稳定全量采集验收。证据runtime/test-results/outline-route-after-20261110。

### 2026-11-10T19:44:07+08:00 前端完整稳定采集结果

固定副本frontend-goal-final-20261110f完整成功，退出0，completed/stable/inputsStable均true，changedFiles/changedInputs均为空。57个前端产品文件，主导航45文件、写作31份计数、任务管理16页、我的工作8份、手册往返5份、平台6份、审核16份，所有原有硬计数核验通过。行8558/10272（83.31%）、分支9743/14026（69.46%），仍未达到100/95。保留固定副本身份，不能当作当前工作区最终验收。证据：runtime/test-results/coverage-snapshots/20261110-183123/runtime/test-results/frontend-goal-final-20261110f/coverage-summary.json、source-stability.json、html/index.html、lcov.info及各子场景日志。此前source-stability=false结果继续仅诊断，不混合比较百分比。

### 2026-11-10T19:44:26+08:00 大纲补测本轮验收

新增16项测试，7套件160/160通过，产品与测试SHA前后一致，退出0。outline.js行528/528（100%）、分支581/668（86.97%）；模块行目标达成，模块分支及全平台目标仍未完成。覆盖真实首次上传目录初始化及坏XLSX清理、旧入口410、存储并发锁拒绝且不覆盖持有者锁、解除锁后重试、元数据损坏回收站失败、历史计数、幂等、版本替代、导出落盘失败与恢复。产品源码未修改；证据runtime/test-results/outline-combined-20261110，含HTML、lcov、原始JSON、完整日志和source-stability.json。后续须以包含这些测试的完整稳定Node采集评估平台分支缺口，不将单模块100%代替平台目标。

### 2026-11-10T19:57:20+08:00 前端 API 真实 HTTP 契约

`node --test tests/e2e/agent-runner/frontend-api-contracts.node.test.cjs` 使用随机端口 HTTP 与真实 Chromium，覆盖 GitLab 读取/写入、CAS/幂等键和失败恢复，以及手册生产草稿/AI/质量/审核请求、权限事件和真实 XHR 上传/断线。只在隔离夹具处理请求，不调用共享业务数据。设置 `KC_FRONTEND_ISTANBUL_CASE_DIR` 可保存8组产品计数，完整前端采集器已纳入该套件并校验源码归属。

定向8/8通过：`gitlab-api.js` 行59/59、分支53/53；`handbook-production-api.js` 行65/65、分支63/65（96.92%）。证据 `runtime/test-results/frontend-api-contracts-20261110-v3/`，包含日志、原始计数、summary、lcov和HTML。仅代表两个客户端模块，不能代替固定全产品分母或三端门禁。


### 2026-11-10T20:07:41+08:00 增量审核/文档任务 API 契约稳定复验

`frontend-api-contracts.node.test.cjs` 由8组扩展至15组，全部通过且源码/测试/锁文件运行前后SHA一致。四模块行201/201、分支215/217；增量审核58/58行、80/80分支；文档任务19/19行、19/19分支；GitLab59/59行、53/53分支；手册生产65/65行、63/65分支。新用例验证全部公开读写端点、默认/编码参数、真实File上传字节、请求中断、通知开关、失败与断线后的同键重试、成功释放和并发相同命令键。浏览器crypto能力降级不替换fetch/XHR。采集器计数门槛同步15，原有其它场景门槛保持。

证据：`runtime/test-results/frontend-task-contracts-20261110-final/`，含run.log、15份计数、source-stability.json、coverage-final.json、coverage-summary.json、html/index.html及lcov.info；复现包装脚本`runtime/test-results/run-frontend-task-contracts-20261110.py`。首跑因错误对象保留undefined属性导致3项严格比较失败，改为序列化错误投影后复验；SHA脚本误将以.js结尾的vendor目录当文件，在启动测试前失败，修为仅对文件哈希。失败产物保留。此为定向模块证据，三端平台100/95目标尚未达成。


### 2026-11-10T20:08:49+08:00 固定前端全量采集与后续副本

20261110-195532副本的frontend-api-full-20261110-v2退出0，completed/stable/inputsStable均true，changedFiles/changedInputs为空。57产品文件、45导航、8 API、31写作、16任务页、8我的工作、5手册往返、6平台、16审核计数完整。行8605/10374（82.94%）、分支9816/14196（69.14%），仍未达标；产品分母相对上一副本变化，不直接以百分比推断增减。证据位于该副本runtime/test-results/frontend-api-full-20261110-v2，包含HTML/lcov/原始JSON和稳定清单。评论夹具已按当前提及字段补齐，失败重试、幂等和正文断言均保留；首次旧夹具失败结果保留。

新增7组API测试未混入旧结果。新固定副本20261110-200838复制4651文件，复制后SHA与主工作区一致，排除runtime、环境文件与依赖目录；依赖链接既有安装。指针runtime/test-results/frontend-task-contracts-20261110-final/snapshot.json。新副本开始15组API的完整前端采集，输出runtime/test-results/frontend-task-api-full-20261110，尚未完成；全平台目标保持active。


### 2026-11-10T20:15:51+08:00 平台 API 契约稳定复验

新增7组平台客户端真实HTTP测试，与原15组一起22/22通过，运行前后源码/测试/锁文件SHA一致。platform-api.js行212/212、分支323/329（98.17%），相对此前固定完整报告该文件199/212、209/329，覆盖全部原缺失行及114分支；这是模块证据，不是平台全量结果。五模块定向总行413/413、分支538/546（98.53%）。采集器API硬计数由15同步22，仍核对每份非空计数和原57产品分母。

覆盖模板/团队/数据库/人员/权限/资产公开端点；多步骤大纲目录快捷命中、旧字段兼容、发布版本优先、指定版本、手册失败降级；大纲错误码中文提示与真实socket断线；平台聚合单侧失败隔离；真实multipart字节及导入错误优先级；权限本地无效输入不发请求。夹具按HTTP请求路由响应，未声明请求立即断言失败，不替换fetch/XHR。首跑将null目录响应错误预期为ok，按真实strict响应契约修正为unavailable；产品未改，失败日志保留。

证据：runtime/test-results/frontend-platform-contracts-20261110-final，含22份原始计数、源码稳定清单、日志、HTML、lcov、coverage-final及summary；可重跑包装脚本runtime/test-results/run-frontend-platform-contracts-20261110.py。语法与diff检查通过。运行中的20261110-200838副本未修改，仍只含原15 API场景；其全量结果不能冒充包含新7组测试。下一步以新稳定副本纳入22组全量，并继续app.js主要行为缺口。三端100/95目标尚未完成。


### 手册送审确认覆盖场景（2026-11-10）

`tests/e2e/agent-runner/fixtures/handbook-review-selection.cjs` 由固定前端采集器执行6个真实 document click 场景，通过隔离随机端口HTTP服务验证草稿缺失、权限拒绝、审核人正常/空/503和未选文档；断言请求顺序、目标分支、逐篇路径、版本、安全转义及关闭焦点恢复。新增场景单独计数且必须6/6，保留原57产品脚本及其他场景门禁。共享业务数据不参与写入。


草稿输入和附件上传：`tests/e2e/agent-runner/fixtures/handbook-draft-input.cjs` 纳入固定前端采集器8项场景，真实input/change事件及XHR验证输入同步、缺少文档ID、图片/普通附件、失败反馈、批次继续、空选择，核对请求正文/文件名/类型与分支。上传目标为隔离随机端口HTTP服务，不写共享附件。与送审6项场景分别计数。


### 2026-11-10T20:36:46+08:00 Java版本映射完整稳定复采

固定副本20261110-203258的java-version-mapping-full-20261110退出0，9产品源文件、source-stability stable=true及changedFiles=[]。行3453/3485（99.08%）、分支2037/2322（87.73%）；PlatformGitLabRepository行239/240、分支175/182，尚缺非法内部action路径；Main仍有31未覆盖行。保留HTML、java.xml、java.exec和源码清单，不缩减分母。此为Java独立全量，三端100/95仍未完成。专业HTML报告入口43项复核再次全部通过，日志runtime/rea/professional-test-report/runner-recheck.log。


2026-11-10T20:37:34+08:00 写作入口时序修正定向真实Chromium复验退出0，日志runtime/test-results/handbook-writing-ready.log，原始计数runtime/test-results/handbook-writing-ready/cases。等待富文本按钮可用或明确回退后再触发来源检查，保留来源变更阻断、授权恢复、无AI生成写请求、关闭清理与草稿保存断言；脚本通过实际collector函数验证，不复制业务实现。失败固定副本不改写；含此修正及8附件场景的新前端全量尚待采集，最近有效前端结果仍为83.35%行/70.32%分支。


## 2026-11-10T20:42:26+08:00 SQLState错误投影补测设计

标准开发，由主执行者完成设计、实施及验证。既有StorageGitLabHttpCheck通过JDBC夹具注入SQLState 23505和08006，真实HTTP分别验证409 CONFIG_CONFLICT及503 STORAGE_UNAVAILABLE、中文消息、失败无commit、恢复后配置/行版本不变。不改变产品契约、不声明真实数据库约束验收。伪代码：`injectSQLException; HTTP(PATCH); assert(status, code, noCommit); clearFailure; HTTP(GET); assert(unchanged)`。保留原9个Java源码及100/95阈值。

前端固定副本20261110-203841采集退出1，未插桩写作场景加载Vditor样式失败，保留失败日志，不计为有效全量。


### 2026-11-10T20:43:12+08:00 固定副本资源完整性修正

前端失败根因为快照脚本仅复制git可见文件，而.gitignore的dist/规则忽略了本地Vditor dist样式/脚本。主工作区资源存在，失败副本缺少index.css；不是产品编辑器时序问题。更新runtime副本工具，将实际vendor树全部纳入复制及SHA清单，运行前核对CSS/JS存在，保留原产品分母及旧失败副本。复制后先运行此前失败的真实浏览器场景，再完整采集。

Java SQLState定向首跑错误地跨恢复GET共用commit基线；读事务也会commit，改为每次失败写请求前单独记录基线，继续严格验证失败请求无commit。保留原失败日志。


## 2026-11-10T20:45:19+08:00 版本映射仓储边界契约补测设计

对PlatformGitLabRepository契约补测：已有映射缺少expected拒绝，未知状态动作不得变更或记录审计，草稿修订父映射丢失时拒绝激活，已禁用修订可重新启用。使用既有状态JDBC夹具，断言错误代码、状态、版本和审计。新测试不改变正在运行副本，定向通过后另建固定副本采集。

Java SQLState完整稳定复采通过：9产品文件，行3455/3485、分支2040/2322；证据副本20261110-204323/runtime/test-results/java-sqlstate-full-20261110。全平台目标仍未完成。


### 2026-11-10T20:49:07+08:00 版本映射边界完整复采

版本映射缺失CAS、未知action、修订父记录缺失拒绝及禁用修订重启定向通过。固定副本20261110-204657完整Java采集退出0，9产品源码，source-stability stable=true、changedFiles=[]；行3456/3485（99.17%）、分支2045/2322（88.07%）。报告runtime/test-results/java-version-boundaries-full-20261110，保留HTML、java.xml、java.exec。原目标尚未达成。

前端资源完整副本预检1/1通过，完整采集遇route.fetch socket hang up退出1；旧失败日志保留。相同固定副本以未处理拒绝warn模式进行诊断，不能未核验就记为有效全量。


## 2026-11-10T20:57:05+08:00 前端完整诊断复采与索引资源异常设计

前端固定副本20261110-204323诊断采集退出0，completed/stable/inputsStable均true，changedFiles/changedInputs=[]。57产品、45导航、22API、6送审、8附件输入、31写作、16任务页、8我的工作、5手册返回、6平台、16审核计数齐全。行8673/10374（83.60%）、分支10008/14196（70.49%）。本次NODE_OPTIONS=--unhandled-rejections=warn，但日志无警告；不能据此证明默认严格模式稳定，保留此前socket hang up失败。HTML/lcov/原始计数位于frontend-vendor-complete-diagnostic-20261110。

StorageSchemaDao剩余分支位于try资源关闭路径。扩展既有JDBC夹具，分别验证正常查询后result.close失败及query.close失败，保留原始异常并禁止DDL；验证DDL执行失败时statement.close异常作为suppressed保留。仅测试资源异常语义，不改产品、不改分母。伪代码：injectCloseFailure; createIndexIfMissing; assert(primary,suppressed,noDDL)。


### 2026-11-10T21:08:16+08:00 前端默认严格模式完整复验

固定副本20261110-205751默认Node模式采集退出0，57产品文件及全部场景门禁通过；completed/stable/inputsStable均true，changedFiles/changedInputs=[]。行8673/10374（83.6%）、分支10006/14196（70.48%）。采用本次实际较低计数，不拼接较高诊断结果。报告frontend-vendor-strict-full-20261110含HTML、lcov和原始计数。

同副本Java索引资源异常完整复验退出0、SHA稳定，3456/3485行、2045/2322分支；新增资源异常断言通过但覆盖计数未增加。原目标100%行/95%分支仍未完成。


## 2026-11-10T21:11:11+08:00 团队小组写交互补测设计

标准开发，主执行者承担设计、实施和验证，未触及人工审批边界。沿用用户原目标：知识中心管理平台行覆盖率100%、分支覆盖率95%；专业HTML报告已完成的REA验收继续保留。新增隔离本地HTTP夹具，通过浏览器公开DOM事件调用真实platform-api请求；验证创建空名/服务失败/恢复成功、名册保存成功/409冲突/503失败/重试、列表重载失败及恢复、取消和导航。核对JSON、If-Match、幂等键、失败不变更及按钮恢复。不得向共享业务后端写入。伪代码：启动内存HTTP服务；route.fetch转发；装载真实视图和事件处理；点击/提交；断言状态与请求；恢复projection、URL、DOM并关闭服务。定向浏览器验证后纳入完整采集计数门禁，固定副本复采判定增量，不将定向计数视为全量覆盖率。


### 2026-11-10T21:20:14+08:00 团队小组隔离HTTP补测与采集修正

新增team-group-http.cjs，10组公开DOM交互验证名册409/503失败保持选择及版本、成功更新、取消、导航、列表失败/恢复、创建空名/失败/成功；真实本地HTTP断言If-Match、幂等键、JSON和列表参数。单独定向通过。首次固定副本20261110-211559全量失败，原日志保留；人员编辑后的异步列表刷新干扰新夹具状态。改为同浏览器上下文独立页签运行并合并实际产品覆盖计数，保留所有断言。人员编辑/成员维护后独立页签复验通过，日志runtime/test-results/team-group-isolated-v2.log。固定副本20261110-211914正在全量采集，终态未核验前不报告覆盖率增量。产品和原100/95目标未改变。


### 2026-11-10T21:29:24+08:00 团队小组补测后的前端完整采集

固定副本20261110-211914默认严格模式采集退出0，57产品文件，新增10组团队HTTP场景与全部原场景门禁通过；completed/stable/inputsStable均true、changedFiles/changedInputs为空。行8711/10374（83.96%）、分支10029/14196（70.64%），相较前次完整报告增加38行、23分支，分母不变。HTML、lcov、原始计数及稳定清单位于frontend-team-isolated-full-20261110。原100%行/95%分支目标仍未达成。


## 2026-11-10T21:34:40+08:00 工作流数据库模式真实HTTP边界补测设计

用户完整目标：知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。

标准开发，主执行者承担设计、实施与验证，未触及人工审批边界。核验Node d报告stable=false（三文件变化），不得作为稳定全量。原拟补的大纲领域形态已有测试，改补尚缺的工作流数据库模式。通过独立Worker启动有状态本地HTTP记录服务，让真实workflow路由、AggregateStore及DatabaseRecordStore完成两层HTTP；验证默认记录创建/保留/软删除恢复、初始化读失败后的写恢复、创建冲突、更新ID不可伪造、删除隐藏和重复删除拒绝、存储读写与导出失败响应及无误写。测试只写runtime隔离目录，禁止共享数据库。伪代码：启动记录HTTP服务→加载真实路由初始化→实际HTTP增删改查→断言持久状态/修订/无文件回退→关闭服务器并恢复环境。定向Istanbul验证后，固定副本全量采集；保持所有产品源码和100/95门槛。


### 2026-11-10T21:45:53+08:00 工作流数据库HTTP定向结果与Node副本输入修正

新增工作流双层真实HTTP及状态存储夹具，11/11定向通过，workflow.js行92/92、分支57/59（96.61%）。副本20261110-213732完整清单167套件得到17失败、149通过、1跳过（105失败、2182通过、8跳过）；Jest留有异步句柄，发送TERM后退出-15，stable=true、changedFiles=[]，不能算有效全量。主要缺少Git忽略的service.env，兼容测试缺少runtime元数据，另有系统检索、LibreOffice失败。修正runtime快照脚本，将实际service.env和只读历史metadata纳入副本SHA清单，不输出配置内容、不改产品或门槛。旧失败副本不改写。平台目标仍active。


## 2026-11-10T21:57:49+08:00 渲染器边界补测与固定副本输入修复

用户完整目标：知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。

本轮标准开发，由主执行者承担设计、实施和验证，无人工审批边界。第二轮固定Node采集终态退出1，164套件通过、2失败、1跳过，2283用例通过、4失败、8跳过；SHA稳定，但不能认定全量通过。LibreOffice失败已确认副本缺少被忽略的真实PPTX输入。快照工具增加该输入及SHA；不改旧失败副本。系统检索调用共享14110却在副本查中间产物，属于运行环境不匹配，保留失败，不重跑共享生成任务。

扩展现有LibreOfficeRenderer测试：自定义命令/DPI/超时传递；依赖不可用；转换未产出PDF；PDF转图无页面；转换命令抛错；上述失败都清理工作目录，外部输出目录保持。通过注入命令执行器验证进程边界及文件产物，真实PPTX转换继续保留。伪代码：commandRunner记录调用并按阶段产出或失败 → render → 断言错误/参数/输出/清理。定向覆盖验证后纳入新固定副本采集，不以定向结果替代平台总覆盖率。


### 2026-11-10T21:59:39+08:00 上下文组装兼容矩阵设计

沿用全平台100%行/95%分支目标。LibreOffice定向10/10通过，真实PPTX成功，模块行和分支均100%。下一步补测context-assembler公开纯函数契约：必需/可选维度排序、缺失维度、未知标签、零相关度和字段缺省；四类来源name/title/file与summary/content/空值优先级及200字截断；空来源不生成章节、转换后来源和路径保留。使用真实模块与输出断言，不改产品规则；无后端行为无需HTTP替身。定向计数不可当成全平台结果。


### 2026-11-10T22:04:23+08:00 渲染器与上下文固定采集结果

固定副本20261110-220054，隔离Node分类164文件，产品154文件；进程退出0，completed/stable均true，changedFiles=[]。Test Suites: 1 skipped, 163 passed, 163 of 164 total；Tests:       6 skipped, 2259 passed, 2265 total。实际覆盖计数：{"lines": {"total": 16412, "covered": 15890, "skipped": 0, "pct": 96.81}, "statements": {"total": 20616, "covered": 19169, "skipped": 0, "pct": 92.98}, "functions": {"total": 3800, "covered": 3565, "skipped": 0, "pct": 93.81}, "branches": {"total": 18957, "covered": 15883, "skipped": 0, "pct": 83.78}, "branchesTrue": {"total": 0, "covered": 0, "skipped": 0, "pct": 100}}。真实PPTX输入纳入SHA；渲染器定向10/10、上下文定向9/9通过。system共享服务分类未纳入本次隔离采集，旧失败证据保留，不能声明所有测试通过。平台100%行/95%分支目标仍未完成，不降低门槛或缩产品分母。报告：runtime/test-results/coverage-snapshots/20261110-220054/runtime/test-results/node-render-context-isolated-20261110


### 2026-11-10T22:04:51+08:00 工作流引擎失败生命周期补测设计

沿用平台行100%、分支95%完整目标。标准开发，主执行者设计/实施/验证。隔离AgentManager及图执行边界，通过公开create/start/cancel/forceContinue/getWorkflow与事件验证并发拒绝、图异常、步骤失败、运行计数恢复、取消与无文档强制继续拒绝、已有文档恢复、步骤详情和输出预览。图替身主动调用真实引擎回调，不调用共享模型，不伪造覆盖计数；模板快照持久化边界隔离，既有真实HTTP契约保留。伪代码：创建任务→控制图回调/结果/异常→监听事件→断言公开状态及并发计数→恢复。定向后固定副本采集，不能当成全平台达标。


### 2026-11-10T22:12:47+08:00 工作流引擎定向补测结果

新增生命周期、并发拒绝、异常事件、无文档拒绝、强制恢复、回调详情、重试配置和预览边界测试。两套24/24通过，workflow-engine.js行157/157=100%，分支133/139=95.68%，语句/函数100%。证据runtime/test-results/workflow-engine-boundaries。不是平台全量结果；继续固定副本采集，保留154产品文件及原100/95门槛。


### 2026-11-10T22:15:54+08:00 工作流引擎补测后固定采集

固定副本20261110-221248隔离Node采集退出0，164套件通过、1跳过，2272用例通过、6跳过。154产品文件、165测试文件；completed/stable为true，changedFiles=[]。实际覆盖计数：{"lines": {"total": 16412, "covered": 15902, "skipped": 0, "pct": 96.89}, "statements": {"total": 20616, "covered": 19188, "skipped": 0, "pct": 93.07}, "functions": {"total": 3800, "covered": 3567, "skipped": 0, "pct": 93.86}, "branches": {"total": 18957, "covered": 15931, "skipped": 0, "pct": 84.03}, "branchesTrue": {"total": 0, "covered": 0, "skipped": 0, "pct": 100}}。system共享服务分类不属于本次隔离采集，历史失败保留，不能声明所有测试通过。HTML和lcov证据：runtime/test-results/coverage-snapshots/20261110-221248/runtime/test-results/node-workflow-engine-isolated-20261110。全平台行100%/分支95%目标仍active，未达成。


### 2026-11-10T22:16:35+08:00 资料加工响应校验边界补测设计

用户原目标：知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。标准开发，主执行者设计、实施、验证。补测knowledge-center-runtime-contract成功及错误响应的非对象/数组/缺字段/字段类型/错误码格式，核验endpoint诊断信息及原始对象保持；校验兼容补data仅作用合法成功响应。纯函数契约使用真实模块，相关既有HTTP网关测试保留。定向测试后纳入固定副本采集；不得将模块结果当作平台达标。


### 2026-11-10T22:17:35+08:00 资料加工响应校验定向结果

两套28/28通过；knowledge-center-runtime-contract.js行、分支、语句、函数均100%。覆盖响应形态、成功/错误字段类型、错误码模式、endpoint诊断及补data不变性。证据runtime/test-results/runtime-contract-boundaries；未替代平台全量验收。下一轮固定副本采集包含此新增测试，原目标保持active。


### 2026-11-10T22:20:41+08:00 响应契约补测后固定采集结果

固定副本20261110-221735隔离Node采集退出0，165套件通过、1跳过，2292用例通过、6跳过。154产品文件，166测试文件，completed/stable均true，changedFiles=[]。实际覆盖计数：{"lines": {"total": 16412, "covered": 15904, "skipped": 0, "pct": 96.9}, "statements": {"total": 20616, "covered": 19200, "skipped": 0, "pct": 93.13}, "functions": {"total": 3800, "covered": 3567, "skipped": 0, "pct": 93.86}, "branches": {"total": 18957, "covered": 15966, "skipped": 0, "pct": 84.22}, "branchesTrue": {"total": 0, "covered": 0, "skipped": 0, "pct": 100}}。本次未执行system共享服务分类，旧失败证据保留，不声明所有测试通过。报告：runtime/test-results/coverage-snapshots/20261110-221735/runtime/test-results/node-runtime-contract-isolated-20261110。全平台行100%/分支95%目标仍未达成，保持active。


## 2026-11-10T22:23:29+08:00 MCP管理响应与配置边界补测设计

用户完整目标：知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。

标准开发，主执行者承担设计、实施、验证；未触及人工审批边界。扩展现有本地真实HTTP MCP服务，以结构化及文本结果矩阵验证搜索/文档读取成功、空响应、错误标志及错误脱敏；验证非法服务与知识库配置拒绝且文件无变化；验证未保存服务测试不持久化、删除默认服务不静默替换。伪代码：创建隔离配置→真实HTTP返回指定业务响应→调用公开治理方法→断言状态/错误/请求/持久化→清理。运行定向Istanbul后再固定副本采集；保持产品分母和100/95门槛，不能把模块结果当平台达标。


### 2026-11-10T22:31:53+08:00 MCP管理边界补测与固定采集结果

新增55项测试，套件79/79通过；MCP治理模块行200/200=100%、分支325/371=87.60%。首次参数化测试因可选第四列被Jest误判done回调而失败，已改为rest参数并复测通过；非产品失败。真实HTTP验证搜索/文档响应、未保存握手；断言非法配置无写入、默认服务删除不自动选择其他服务及兼容保存记录标识。固定副本20261110-222825隔离Node采集退出0，165套件通过、1跳过，2347用例通过、6跳过；154产品文件、166测试文件，completed/stable=true、changedFiles=[]。实际覆盖计数：{"lines": {"total": 16412, "covered": 15913, "skipped": 0, "pct": 96.95}, "statements": {"total": 20616, "covered": 19245, "skipped": 0, "pct": 93.34}, "functions": {"total": 3800, "covered": 3575, "skipped": 0, "pct": 94.07}, "branches": {"total": 18957, "covered": 16030, "skipped": 0, "pct": 84.55}, "branchesTrue": {"total": 0, "covered": 0, "skipped": 0, "pct": 100}}。本次不含system共享服务分类，旧失败保留；不能声明所有分类通过。报告：runtime/test-results/coverage-snapshots/20261110-222825/runtime/test-results/node-mcp-governance-isolated-20261110。平台行100%/分支95%目标仍active，未缩分母或降低阈值。


### 2026-11-10T22:34:05+08:00 MCP凭据损坏与服务身份边界补测

在同一设计矩阵内增加已删除服务404、缺失版本409、同一知识库记录重复引用拒绝、通用服务无读取适配拒绝，以及真实配置管理器读取损坏密文后的503与显式清除恢复。未修改产品代码。定向82/82通过，模块行200/200=100%，分支335/371=90.29%，函数100%；分支仍未达95%。证据runtime/test-results/mcp-governance-boundaries-final。前次固定副本只含79项，不能当作此82项全量结果；继续新副本采集。


### 2026-11-10T22:37:32+08:00 MCP完整新增测试固定副本采集

固定副本20261110-223405隔离Node采集退出0，completed/stable=true，changedFiles=[]；154产品文件、166测试文件。Test Suites: 1 skipped, 165 passed, 165 of 166 total
Tests:       6 skipped, 2350 passed, 2356 total。覆盖计数：{"lines": {"total": 16412, "covered": 15913, "skipped": 0, "pct": 96.95}, "statements": {"total": 20616, "covered": 19250, "skipped": 0, "pct": 93.37}, "functions": {"total": 3800, "covered": 3575, "skipped": 0, "pct": 94.07}, "branches": {"total": 18957, "covered": 16040, "skipped": 0, "pct": 84.61}, "branchesTrue": {"total": 0, "covered": 0, "skipped": 0, "pct": 100}}。包含MCP管理82项定向已通过测试。报告：runtime/test-results/coverage-snapshots/20261110-223405/runtime/test-results/node-mcp-governance-isolated-20261110。system分类未执行，保留历史失败，不声明所有分类通过。全平台行100%/分支95%目标仍active；前端、Java本轮未重采。


## 2026-11-10T22:38:39+08:00 增量构建HTTP拒绝路径设计

继续用户全平台行100%、分支95%目标。标准开发，主执行者设计实施验证。复用现有真实HTTP审核服务夹具，补充审核不存在、候选失配、非法决定、未审核发布、发布摘要失配、未发布证据拒绝、非退回任务修订拒绝等路径。每次拒绝断言状态与审计完全不变；只写隔离内存仓库，不触达共享数据。伪代码：构造最小合法状态→实际HTTP请求→断言错误码/状态/存储不变。保留原产品分母及门槛，不以定向结果代替平台验收。


### 2026-11-10T22:39:55+08:00 增量构建拒绝路径定向验证

新增14个真实HTTP状态守卫场景，单套65/65通过，关联三套109/109通过。覆盖审核决定/终止、发布状态与摘要、外部证据和修订拒绝，均断言存储与审计无副作用。三套定向覆盖行83.52%、分支73.48%，仅为所选三套结果，不能与包含其他测试的全量混比。证据runtime/test-results/incremental-guards-directed及incremental-guards-coverage.log。随后固定副本采集衡量实际增量，原目标不变。


### 2026-11-10T22:43:06+08:00 增量状态守卫补测后固定采集

副本20261110-223955 Node隔离采集退出0，completed/stable=true，changedFiles=[]，154产品文件、166测试文件。Test Suites: 1 skipped, 165 passed, 165 of 166 total; Tests:       6 skipped, 2364 passed, 2370 total。覆盖计数：{"lines": {"total": 16412, "covered": 15913, "skipped": 0, "pct": 96.95}, "statements": {"total": 20616, "covered": 19263, "skipped": 0, "pct": 93.43}, "functions": {"total": 3800, "covered": 3575, "skipped": 0, "pct": 94.07}, "branches": {"total": 18957, "covered": 16054, "skipped": 0, "pct": 84.68}, "branchesTrue": {"total": 0, "covered": 0, "skipped": 0, "pct": 100}}。证据：runtime/test-results/coverage-snapshots/20261110-223955/runtime/test-results/node-incremental-guards-isolated-20261110。本轮累计MCP新增58项、增量守卫14项，真实HTTP及配置/存储无副作用断言通过。system分类未执行，历史失败保留；浏览器与Java本轮未重采，全平台行100%/分支95%仍未达成，保持active。


## 2026-11-10T22:44:20+08:00 检索查询规划契约补测设计

用户完整目标：知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。标准开发，主执行者设计实施验证，未触及审批边界。为真实query-planner公开纯函数新增独立单元测试，覆盖全部知识点类型的必需/可选查询维度、默认类型与数据库、数量限制、核心术语归一化，以及括号碎片修复、短查询补全和丢弃。现有system检索测试含共享服务依赖，新增纯函数测试避免将其替代执行视为系统通过。不改产品规则；断言查询语义和输入不变。定向覆盖后纳入固定副本采集，保持全部产品分母及100/95门槛。


### 2026-11-10T22:46:40+08:00 专业报告交付核对与查询规划收尾

复用已完成的仓库REA报告验收证据，不重复开发：中文总览、场景静态分页、跨页搜索、状态筛选、失败日志和真实覆盖率；入口43/43、smoke24/24，内部量表9.5/10。实际报告runtime/test-results/smoke/20261110-192850-959829-smoke/report.html及runtime/rea/professional-test-report/ACCEPTANCE.md均存在。大型报告100ms尚未验收，不把报告评分当平台覆盖率达标。

收尾上一批查询规划测试：更正短查询不足10字符时补核心术语的测试预期，保留产品行为。14/14通过，模块行100%、分支95.83%，证据runtime/test-results/query-planner-directed；尚未纳入新固定副本全量采集，不能替代最新Node96.95%/84.68%结果。用户全平台行100%、分支95%目标保持active。


## 2026-11-10T22:47:27+08:00 语义分块与规划代理剩余契约设计

用户完整目标：知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。标准开发，主执行者承担设计、实施和验证。固定覆盖证据定位SemanticChunker的弱段落边界、空结构块、无可重叠句子/无前缀，以及PlannerAgent合并模式和畸形模型字段回退尚未验证。补测真实公开方法，不更改产品规则或分母。结构块接口允许相邻paragraph，验证弱边界拆分后正文顺序、token重算和章节路径独立；Markdown入口保留闭合/未闭合代码与开头表格测试。代理使用真实配置/查询生成，不请求真实模型，通过parseResponse验证非法JSON和非数组字段回退、既有结构保留、合并输出及任务固定模板优先。伪代码：输入合法结构块/模型响应→调用真实方法→断言完整内容、恢复结构和输入不变→定向覆盖→固定副本全量采集。纯计算方法不需要后端HTTP；既有真实HTTP套件继续纳入全量。


### 2026-11-10T22:49:25+08:00 语义分块与规划代理定向验证结果

SemanticChunker新增7项，24/24通过，行/分支/语句/函数均100%；公开结构块弱边界与Markdown入口边界分别验证，不声称前者来自parseBlocks输出。PlannerAgent新增11项，关联三套85/85通过，模块行100%、分支95.78%、语句/函数100%。验证合并提示词与输出、模型非JSON及字段类型回退、固定模板剔除浮动模板文件、哈希失配拒绝和有效字段保留。报告runtime/test-results/semantic-chunker-boundaries与planner-agent-boundaries。连同上批查询规划14项启动新的固定副本全量Node采集，保持154产品文件和100/95原门槛；定向结果不等于平台达标。


## 2026-11-10T22:51:27+08:00 审核意见可信提及HTTP边界设计

继续用户全平台行100%、分支95%目标。固定证据定位knowledge-center网关审核意见分支整段未执行。新增真实本地HTTP测试：代理服务不可用、缺幂等键、重复手册、非当前审核范围、无负责人、不可见手册、可信接收人覆盖客户端伪造值，以及当前文档范围纠偏阻止审核通过。只在runtime写隔离任务聚合，注入最小服务观察调用；实际网关鉴权/解析/范围判定均执行真实代码，不触达共享服务。伪代码：准备任务关联及session→POST意见/决定→核对状态、错误、可信服务参数、拒绝零调用及文件不变。前一固定副本正在采集，此后测试属于下一副本，不混充已启动版本结果。


### 2026-11-10T22:53:37+08:00 规划与分块固定采集及审核意见HTTP结果

固定副本20261110-224925退出0，completed/stable=true、changedFiles=[]，154产品文件、168Jest文件；167套件通过、1跳过，2395用例通过、6跳过。行15943/16412=97.14%，分支16089/18957=84.87%，较223955增加30行、35分支。报告runtime/test-results/coverage-snapshots/20261110-224925/runtime/test-results/node-planning-chunker-isolated-20261110。system分类未执行，旧失败保留，全平台目标仍未完成。

随后新增审核意见网关16项真实HTTP全部通过，覆盖可信提及、范围/权限拒绝、服务不可用、幂等键及范围纠偏阻止决定/解除恢复；拒绝时服务零调用、隔离文件不变。首次夹具缺必需工作簿配置在初始化失败，补齐runtime路径后复测通过，未改产品。定向报告runtime/test-results/review-comment-gateway-directed仅覆盖所选路径（行10.41%、分支8.16%），不代表全模块。准备新副本全量纳入此16项。


### 2026-11-10T22:57:37+08:00 审核意见固定采集与版本映射定向结果

副本20261110-225337 Node采集退出0，completed/stable=true、changedFiles=[]；154产品文件、169Jest文件，168套件通过、1跳过，2411用例通过、6跳过。行15973/16412=97.32%，分支16133/18957=85.10%。较224925增加30行、44分支。报告：runtime/test-results/coverage-snapshots/20261110-225337/runtime/test-results/node-review-comments-isolated-20261110。system分类未执行，旧失败保留，前端/Java未重采，全平台目标仍active。

版本映射适配器新增9项真实本地HTTP测试，两套91/91通过，验证列表/解析、新建/更新、启停、查询特殊字符、可信actor覆盖、幂等键/版本请求头和三个错误状态；无data解析返回null，其余方法保留原始信封。定向模块覆盖：{"lines": {"total": 157, "covered": 157, "skipped": 0, "pct": 100}, "statements": {"total": 173, "covered": 173, "skipped": 0, "pct": 100}, "functions": {"total": 59, "covered": 59, "skipped": 0, "pct": 100}, "branches": {"total": 243, "covered": 234, "skipped": 0, "pct": 96.29}, "branchesTrue": {"total": 0, "covered": 0, "skipped": 0, "pct": "Unknown"}}。报告runtime/test-results/domain-store-version-mapping-directed；仅为该模块定向证据，准备新固定副本全量纳入。未修改产品代码或覆盖率分母。


### 2026-11-10T23:01:02+08:00 版本映射补测后固定采集结果

副本20261110-225737 Node全量隔离采集退出0，completed/stable=true、changedFiles=[]，154产品文件、169Jest文件，168套件通过、1跳过，2420用例通过、6跳过。覆盖实际计数：{"lines": {"total": 16412, "covered": 15983, "skipped": 0, "pct": 97.38}, "statements": {"total": 20616, "covered": 19350, "skipped": 0, "pct": 93.85}, "functions": {"total": 3800, "covered": 3598, "skipped": 0, "pct": 94.68}, "branches": {"total": 18957, "covered": 16150, "skipped": 0, "pct": 85.19}, "branchesTrue": {"total": 0, "covered": 0, "skipped": 0, "pct": 100}}。证据：runtime/test-results/coverage-snapshots/20261110-225737/runtime/test-results/node-version-mapping-isolated-20261110。本批只增加领域适配器真实HTTP契约测试，未改产品规则。system共享服务分类未执行，历史失败保留，不声明全部分类通过；前端及Java沿用上一有效证据，本轮未重采。全平台行100%、分支95%目标仍未达成，保持active。专业HTML报告及REA验收交付继续有效，内部量表9.5/10，大型报告100ms尚未验收。


### 2026-11-10T23:07:57+08:00 文档任务纠偏与发布核对定向验证

新增document-tasks-correction-http.test.js，隔离runtime文件和真实本地HTTP。与既有路由测试合计115/115通过（原有37项，本批新增78项），路由定向行641/648=98.91%、分支1167/1352=86.31%、函数273/279=97.84%。证据runtime/test-results/document-task-correction-directed与同名.log。成功断言范围历史/冻结/恢复、稳定编号、审核关联失效、三种发布核对结论及审计；拒绝断言持久文件字节不变。覆盖前述错误预期已修正，不改产品规则；仍有内部未引用scopeSnapshot行与分支未覆盖，不等于平台达标。启动新固定副本全量采集，保持154产品文件及行100%/分支95%原门槛。


### 2026-11-10T23:11:15+08:00 文档任务补测后固定采集收尾

用户完整目标：知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。副本20261110-230757采集退出0，completed/stable=true，changedFiles=[]；154产品文件、170Jest文件，169套件通过、1跳过，2498用例通过、6跳过，151.493秒。行16052/16412=97.80%，分支16382/18957=86.41%，较上一有效副本增加69行、232分支。证据runtime/test-results/coverage-snapshots/20261110-230757/runtime/test-results/node-task-correction-isolated-20261110。system共享服务分类未执行，旧失败保留；前端与Java本批未重采。全平台100/95仍未完成，goal保持active。专业HTML报告REA改进及内部量表9.5分验收继续有效；大型报告100ms尚未验收。


### 2026-11-10T23:13:31+08:00 增量异步读取定向验证结果

新增13项真实HTTP测试，增量审核辅助接口套件78/78通过：并发列表/详情仅一次readAsync、epoch变化丢弃旧快照、错误后重试；验证响应隔离和500隐藏内部错误。另覆盖三种基线正文缺失、六种非法操作字段及合法移动/陈旧草稿/幂等重试。拒绝写入时整体仓库不变。证据runtime/test-results/incremental-read-boundaries-directed；本次定向结果不代替平台全量覆盖。准备固定副本重新采集，不改产品与覆盖率门槛。


### 2026-11-10T23:15:25+08:00 定向覆盖率路径纠正

首次定向命令的collectCoverageFrom相对Jest配置根目录解析，生成零产品文件覆盖率；用例78/78通过有效，但零文件覆盖率不作任何达标证据。已将误写tests目录的报告移入runtime/test-results/incremental-read-boundaries-directed保留。改用../../../packages/...源码路径和绝对coverageDirectory重新采集，78/78仍通过，所选模块定向行419/783=53.51%、分支492/1173=41.94%，证据runtime/test-results/incremental-read-boundaries-directed-valid及.log；本套只执行所选服务路径，不代表模块全量。固定副本全量使用原有配置，不受该命令错误影响，进程仍活跃。


### 2026-11-10T23:17:06+08:00 增量读取补测后固定全量结果

副本20261110-231331退出0，completed/stable=true、changedFiles=[]，154产品文件、170Jest文件。Test Suites: 1 skipped, 169 passed, 169 of 170 total；Tests:       6 skipped, 2511 passed, 2517 total；Time:        175.276 s。行16063/16412=97.87%，分支16398/18957=86.5%。较上一有效副本增加11行、16分支。证据runtime/test-results/coverage-snapshots/20261110-231331/runtime/test-results/node-incremental-read-isolated-20261110。本批新增13项真实HTTP测试，未改变产品与覆盖率分母。system共享服务分类未执行，旧失败保留；前端/Java未重采。用户完整目标为知识中心管理平台行覆盖率100%、分支覆盖率95%，当前三个运行时仍有缺口，goal保持active。


### 2026-11-10T23:19:56+08:00 审核人改派真实HTTP补测

新增12项，review-workbench-contract整套35/35通过。覆盖缺审核/无手册来源、任务或审核已完成、请求或审核候选过期、文档缺失或无逐篇记录、空/非数组/非法审核人，拒绝后比对整体仓库不变；成功验证人员规范化、候选不变、审计及幂等重放。定向日志runtime/test-results/review-reassignment-directed.log。首次夹具将中文直接写入HTTP头被fetch拒绝，已编码幂等键后复测通过；不修改产品规则。普通任务文档/路径矩阵已有测试，未重复新增。准备固定副本全量采集。用户完整目标：知识中心管理平台行覆盖率100%、分支覆盖率95%，目标保持active。


### 2026-11-10T23:22:38+08:00 审核改派补测后固定全量结果

副本20261110-231956采集退出0，completed/stable=true，changedFiles=[]，154产品文件、170Jest文件。Test Suites: 1 skipped, 169 passed, 169 of 170 total；Tests:       6 skipped, 2523 passed, 2529 total；Time:        142.922 s。行16063/16412=97.87%，分支16405/18957=86.53%。证据runtime/test-results/coverage-snapshots/20261110-231956/runtime/test-results/node-reassignment-isolated-20261110。新增12项真实HTTP测试，不改变产品、分母或100/95门槛。system共享服务分类未执行，旧失败保留；前端与Java未重采。用户完整目标：知识中心管理平台行覆盖率100%、分支覆盖率95%，尚未达成，goal保持active。


### 2026-11-10T23:25:59+08:00 Java记录拒绝响应固定全量验证结果

新增三种真实HTTP数据库故障场景，大纲已删除/不存在返回409，一般SQL故障返回503且不泄露内部详情；验证请求标识、回滚、记录正文/摘要/版本/删除标识不变及恢复后GET成功。固定副本20261110-232435全量采集退出0，9源文件，源码及测试稳定性见runtime/test-results/coverage-snapshots/20261110-232435/runtime/test-results/java-record-rejection-full-20261110/source-stability.json。行3457/3485=99.20%，分支2047/2322=88.16%，较前次增加1行、2分支。所有既有采集场景通过，未改变产品或分母。证据runtime/test-results/coverage-snapshots/20261110-232435/runtime/test-results/java-record-rejection-full-20261110/java.xml与html/index.html。用户完整目标：知识中心管理平台行覆盖率100%、分支覆盖率95%，当前仍未达成，goal保持active。Node最近行97.87%、分支86.53%，前端最近行83.96%、分支70.64%，本批未重采。


### 2026-11-10T23:29:05+08:00 GitLab读取网关定向验证结果

新增6项真实HTTP测试，gitlab-api-http整套22/22通过。覆盖管理员目录/文件默认和显式参数、读者403且不请求上游、提交历史字段投影、服务账号OAuth拒绝及状态凭据隐藏、未知路由404；另验证个人OAuth默认/显式returnTo重定向与连接禁用状态，finally恢复原手册映射。日志runtime/test-results/gitlab-read-gateway-directed.log。用户完整目标为知识中心管理平台行覆盖率100%、分支覆盖率95%，尚未达成；准备固定副本全量采集，保持产品分母及门槛。


### 2026-11-10T23:30:37+08:00 文件读取边界定向验证结果

新增4项，tools.test整套26/26通过。真实文件系统验证递归目录与类型、普通列表过滤目录、目录缺失、空批次、UTF-16编码与字节大小/mtime、批次部分失败、默认运行路径及仓库回退读取。证据runtime/test-results/file-reader-boundaries-directed.log。产品未修改，当前运行中的GitLab固定副本不含这4项，后续单独采集。用户完整目标：行100%、分支95%，尚未达成。


### 2026-11-10T23:32:00+08:00 GitLab补测后固定全量结果

固定副本20261110-232905全量退出0，154产品文件、170Jest文件，169套件通过/1跳过，2529用例通过/6跳过，142.279秒。stable=true，changedFiles=[]。行16083/16412=97.99%，分支16428/18957=86.65%。证据runtime/test-results/coverage-snapshots/20261110-232905/runtime/test-results/node-gitlab-read-isolated-20261110。本次不含随后新增的4项文件读取边界测试；其所在套件定向26/26通过。system共享服务分类未执行，旧失败保留。未改变产品分母与门槛；用户完整目标为行100%、分支95%，尚未达成。


### 2026-11-10T23:32:16+08:00 文件读取工具覆盖率验证

定向执行tools.test.js，26/26通过，产品FileReader真实覆盖率行43/43=100%、分支21/21=100%、函数8/8=100%。证据runtime/test-results/file-reader-boundaries-coverage/coverage-summary.json及html/index.html。仅为单模块证据，不代替平台全量，不与不同运行时合并计算达标。最近Node固定全量行97.99%、分支86.65%；Java行99.20%、分支88.16%；前端行83.96%、分支70.64%，用户完整目标行100%、分支95%仍未达成，goal保持active。


### 2026-11-10T23:34:45+08:00 数据库配置边界定向验证结果

新增4项数据库配置测试，native-contract桥整套93通过/5跳过，80.639秒，退出0。覆盖配置必须存在、非法行拒绝、CRLF/注释/export/引号、完整字段映射、环境空值与数值0、嵌套数组和大小写敏感键。修复原有临时目录未清理的测试夹具，不修改产品。证据runtime/test-results/database-config-boundaries-directed.log。准备固定副本全量纳入本批与FileReader四项；用户完整目标：行100%、分支95%，尚未达成。


### 2026-11-10T23:37:55+08:00 配置与文件读取补测固定全量结果

固定副本20261110-233445完成，退出0，154产品文件、170Jest文件，stable=true、changedFiles=[]。Test Suites: 1 skipped, 169 passed, 169 of 170 total; Tests:       6 skipped, 2537 passed, 2543 total; Time:        170.469 s。行16090/16412=98.03%，分支16440/18957=86.72%。证据runtime/test-results/coverage-snapshots/20261110-233445/runtime/test-results/node-config-boundaries-isolated-20261110。本次纳入数据库配置4项及FileReader4项；未改产品或覆盖分母。system共享服务分类未执行，旧失败保留。用户完整目标行100%、分支95%，当前仍未达成，goal保持active。


### 2026-11-10T23:39:25+08:00 资料加工白名单定向覆盖验证

新增15项，契约与客户端套件24/24通过。白名单模块行31/31=100%、分支39/39=100%，证据runtime/test-results/cleaning-mapping-boundaries。注意cleaning-api-contract仅静态契约检查，不能算真实HTTP；另执行frontend-gateway-http-coverage及knowledge-center-context-boundaries-http真实HTTP测试验证代理与路由拒绝。保持真实契约文件不变，所有读取替换finally恢复。用户完整目标行100%、分支95%，尚未完成，准备固定副本全量。


### 2026-11-10T23:42:31+08:00 白名单校验补测固定全量结果

新增15项，定向契约24/24及真实HTTP23/23通过。固定副本20261110-233925全量退出0，154产品文件、170Jest文件，stable=true、changedFiles=[]。Test Suites: 1 skipped, 169 passed, 169 of 170 total; Tests:       6 skipped, 2552 passed, 2558 total; Time:        167.594 s。行16096/16412=98.07%，分支16453/18957=86.79%。证据runtime/test-results/coverage-snapshots/20261110-233925/runtime/test-results/node-cleaning-mapping-isolated-20261110。白名单模块定向行31/31与分支39/39双100%。未改产品、真实契约文件或分母；system共享服务分类未执行，旧失败保留。用户完整目标：知识中心管理平台行100%、分支95%，尚未达成，goal保持active。


### 2026-11-10T23:44:46+08:00 大纲仓储补测验证结果

新增11项仓储/快照测试，与真实HTTP大纲数据库投影套件共38/38通过。定向模块行64/64=100%、分支51/52=98.07%，证据runtime/test-results/outline-repository-boundaries。覆盖恢复备份、损坏报错、锁冲突与失败解锁、旧快照备份、追加去重/幂等、数据库克隆及过滤、递归目录。首次test.each数组被Jest展开导致两项夹具断言错误，改为对象行后复测通过，未修改产品。用户完整目标行100%、分支95%，尚未达成，准备固定副本全量。


### 2026-11-10T23:48:03+08:00 大纲仓储补测固定全量结果

固定副本20261110-234446全量退出0，154产品文件、170Jest文件，stable=true、changedFiles=[]。Test Suites: 1 skipped, 169 passed, 169 of 170 total; Tests:       6 skipped, 2563 passed, 2569 total; Time:        175.216 s。行16103/16412=98.11%，分支16472/18957=86.89%。证据runtime/test-results/coverage-snapshots/20261110-234446/runtime/test-results/node-outline-recovery-isolated-20261110。新增11项大纲仓储测试，与真实HTTP投影套件定向38/38通过，模块行64/64=100%、分支51/52=98.07%。未修改产品或分母；system共享服务分类未执行，旧失败保留。用户完整目标：知识中心管理平台行100%、分支95%，尚未完成，goal保持active。


### 2026-11-10T23:50:36+08:00 文档接口错误恢复验证结果

用户完整目标：知识中心管理平台行覆盖率100%、分支覆盖率95%。新增6项真实HTTP测试，当前document-route套件27/27通过，证据runtime/test-results/document-error-recovery-directed.log。覆盖三种非法评论结构且保留原始字节、模型返回异常不落文件并可重试、版本索引损坏恢复、预处理删除失败保留元数据并恢复成功。元数据读取器会吞并文件错误返回空投影，故已移除无法命中路由异常的临时列表故障用例；本批未新增非法上传场景。未改产品与分母，准备固定副本全量采集，目标尚未达成。


### 2026-11-10T23:53:32+08:00 文档错误恢复固定全量结果

用户完整目标：知识中心管理平台行100%、分支95%。固定副本20261110-235036，154产品文件、170Jest文件，退出0，stable=true、changedFiles=[]。Test Suites: 1 skipped, 169 passed, 169 of 170 total
Tests:       6 skipped, 2569 passed, 2575 total
Time:        141.241 s。行16108/16412=98.14%，分支16475/18957=86.9%。新增6项文档真实HTTP场景，定向27/27通过。证据runtime/test-results/coverage-snapshots/20261110-235036/runtime/test-results/node-document-recovery-isolated-20261110。未改产品与分母；system共享服务分类未执行，旧失败保留。整体覆盖率目标尚未达成，goal保持active。


### 2026-11-10T23:55:38+08:00 基础Agent执行契约补测结果

用户完整目标：知识中心管理平台行100%、分支95%。新增base-agent-coverage.test.js五项全部通过，真实本地模型HTTP验证Markdown/JSON参数、认证失败分类及恢复；覆盖抽象契约、品牌回退、注册资源读取与缺失恢复。模块定向行56/56=100%、分支39/48=81.25%。证据runtime/test-results/base-agent-directed.log及base-agent-boundaries/coverage-summary.json。首次失败断言错误要求泄露上游错误原文，现按已有标准错误与providerCode契约修正。未修改产品。最新全量仍为文档恢复固定副本98.14%/86.90%，本批尚未采集全量，不据此宣称平台达标。


### 2026-11-10T23:57:29+08:00 网页引用传输补测结果

用户完整目标：知识中心管理平台行100%、分支95%。新增web-reference-transport.test.js共11项真实HTTP测试全部通过，证据runtime/test-results/web-reference-transport-directed.log。验证deflate/br/identity解码、503、未知传输编码及字符集、空HTML与缺失类型、缺重定向位置与零跳转限额、流式/原文/提取正文大小、无效URL/空DNS/解析超时与正常读取恢复。连接通过既有receive边界转到隔离HTTP服务，未连接外网、未修改产品与分母。本批尚待固定全量采集。


### 2026-11-10T23:58:34+08:00 基础Agent固定全量结果

用户完整目标：知识中心管理平台行100%、分支95%。固定副本20261110-235538退出0，154产品、171Jest文件，stable=true、changedFiles=[]。Test Suites: 1 skipped, 170 passed, 170 of 171 total; Tests:       6 skipped, 2574 passed, 2580 total; Time:        146.732 s。行16115/16412=98.19%，分支16484/18957=86.95%。证据runtime/test-results/coverage-snapshots/20261110-235538/runtime/test-results/node-base-agent-isolated-20261110。未改变产品或分母；system共享服务分类未执行，旧失败保留。网页传输新增11项未包含在本副本。整体目标尚未达成，goal保持active。


### 2026-11-11T00:02:25+08:00 网页传输全量与模板存储定向结果

用户完整目标：知识中心管理平台行100%、分支95%。网页传输固定副本20261110-235834全量退出0，154产品、172Jest文件，stable=true、changedFiles=[]；171套件通过、1跳过，2585测试通过、6跳过，170.261秒。行16117/16412=98.2%，分支16495/18957=87.01%。证据runtime/test-results/coverage-snapshots/20261110-235834/runtime/test-results/node-web-transport-isolated-20261110。本轮模板存储新增8项，与真实HTTP文件持久化共10/10通过；定向模块行109/109=100%，分支182/190=95.78%。证据runtime/test-results/template-store-directed.log及template-store-boundaries。未修改产品或分母；system共享服务分类未执行，旧失败保留。模板新增尚待固定全量，整体目标未达到，goal保持active。


### 2026-11-11T00:05:19+08:00 聚合存储投影补测结果

用户完整目标：知识中心管理平台行100%、分支95%。新增4项测试，aggregate-store-boundaries-http共13/13通过，证据runtime/test-results/aggregate-projections-directed.log。真实HTTP覆盖草稿旧聚合/新投影、缺失草稿、删除/缺失记录空快照、默认与详细错误映射、异步事务版本条件；文件注入rename失败验证原子清理、旧数据保留与恢复。未改产品或分母，待下一固定全量采集。


### 2026-11-11T00:05:53+08:00 模板存储固定全量结果

用户完整目标：知识中心管理平台行100%、分支95%。固定副本20261111-000225退出0，154产品、173Jest文件，stable=true、changedFiles=[]。Test Suites: 1 skipped, 172 passed, 172 of 173 total; Tests:       6 skipped, 2593 passed, 2599 total; Time:        175.812 s。行16121/16412=98.22%，分支16542/18957=87.26%。证据runtime/test-results/coverage-snapshots/20261111-000225/runtime/test-results/node-template-store-isolated-20261111。未改产品或分母，system共享服务分类未执行，旧失败保留。聚合存储新增4项未包含于该固定副本。整体目标尚未达到，goal保持active。


### 2026-11-11T00:08:34+08:00 增量审核自动选中补测结果

用户完整目标：知识中心管理平台行100%、分支95%。incremental-build-api定向22/22通过，新用例通过真实HTTP创建及审核候选后，验证同快照reviewBootstrap默认选中已批准可读任务、显式列表保留基线、未知文档拒绝和正确文档读取。证据runtime/test-results/incremental-bootstrap-directed.log。产品及覆盖率分母未变，尚待固定全量采集，整体目标仍未完成。


### 2026-11-11T00:08:57+08:00 聚合存储固定全量结果

用户完整目标：知识中心管理平台行100%、分支95%。固定副本20261111-000553退出0，154产品、173Jest文件，stable=true、changedFiles=[]；172套件通过、1跳过，2597用例通过、6跳过，149.565秒。行16124/16412=98.24%，分支16557/18957=87.33%。证据runtime/test-results/coverage-snapshots/20261111-000553/runtime/test-results/node-aggregate-projections-isolated-20261111。system共享服务分类未执行，旧失败保留；未改变产品和分母，整体目标仍未达成。


### 2026-11-11T00:11:58+08:00 增量审核固定全量结果

用户完整目标：知识中心管理平台行100%、分支95%。固定副本20261111-000834退出0，154产品、173Jest文件，stable=true、changedFiles=[]；172套件通过、1跳过，2598用例通过、6跳过，160.583秒。行16127/16412=98.26%，分支16561/18957=87.36%。证据runtime/test-results/coverage-snapshots/20261111-000834/runtime/test-results/node-incremental-bootstrap-isolated-20261111。system共享服务分类未执行，旧失败保留；未改变产品和分母，整体目标仍未达成。


### 2026-11-11T00:14:10+08:00 Schema与流式预览定向结果

用户完整目标：知识中心管理平台行100%、分支95%。新增schema-validator-boundaries共6项，与既有平台契约共19/19通过；模块行48/48=100%、分支88/90=97.77%。新增production-ai-preview-boundaries共13/13通过，模块行36/36=100%、分支42/42=100%。分别验证类型/Unicode长度/唯一数组/附加字段与路径转义，以及顶层正文/嵌套来源隔离/完整与截断转义/损坏输入。证据runtime/test-results/schema-validator-directed.log和production-preview-directed.log及对应coverage-summary.json。纯函数校验无需后端请求，未改产品与分母，尚待固定全量；整体目标仍未达成。


### 2026-11-11T00:15:46+08:00 步骤执行器定向结果

用户完整目标：知识中心管理平台行100%、分支95%。step-executor新增3项，13/13通过，模块行34/34=100%、分支35/35=100%。验证缺失Agent拒绝与恢复、详情回调、旧别名、执行错误原样传播、空及非包装前序值；局部接口对象不污染全局，纯执行协议无需后端API。证据runtime/test-results/step-executor-directed.log及step-executor-directed/coverage-summary.json。当前固定副本20261111-001410未包含本次新增，待下一固定全量，目标仍未完成。


### 2026-11-11T00:17:33+08:00 Schema与预览固定全量结果

用户完整目标：知识中心管理平台行100%、分支95%。固定副本20261111-001410退出0，154产品、175Jest文件，stable=true、changedFiles=[]。Test Suites: 1 skipped, 174 passed, 174 of 175 total；Tests:       6 skipped, 2617 passed, 2623 total；Time:        166.462 s。行16136/16412=98.31%，分支16598/18957=87.55%。证据runtime/test-results/coverage-snapshots/20261111-001410/runtime/test-results/node-schema-preview-isolated-20261111。步骤执行器新增3项尚未包含；system共享服务分类未执行，旧失败保留；未改变产品及分母。整体目标仍未完成。


### 2026-11-11T00:21:33+08:00 步骤执行器固定全量结果

用户完整目标：知识中心管理平台行100%、分支95%。固定副本20261111-001733退出0，154产品、175Jest文件，stable=true、changedFiles=[]。Test Suites: 1 skipped, 174 passed, 174 of 175 total；Tests:       6 skipped, 2620 passed, 2626 total；Time:        173.914 s。行16140/16412=98.34%，分支16603/18957=87.58%。证据runtime/test-results/coverage-snapshots/20261111-001733/runtime/test-results/node-step-executor-isolated-20261111。system共享服务分类未执行，旧失败保留；未改变产品及分母。Java与前端本批未重新采集，整体目标仍未完成，goal保持active。


### 2026-11-11T00:25:04+08:00 审核范围阻断与大纲导入定向结果

用户完整目标：知识中心管理平台行100%、分支95%。两套件39/39通过（新增大纲6项，审核决定阻断/解除恢复1项），真实HTTP验证reported范围拒绝409且不转发、取消后恢复200。大纲模块行82/82=100%，分支80/83=96.38%。证据runtime/test-results/review-outline-directed.log及review-outline-directed/coverage-summary.json。产品与分母未变，接下来固定全量复采；定向主路由覆盖率不代表全量结果，整体目标尚未完成。


### 2026-11-11T00:28:26+08:00 审核与大纲固定全量结果

用户完整目标：知识中心管理平台行100%、分支95%。固定副本20261111-002504退出0，154产品、175Jest文件，stable=true、changedFiles=[]。174套件通过、1跳过；2626用例通过、6跳过，147.712秒。行16144/16412=98.36%，分支16609/18957=87.61%；相比上一固定结果增加4行、6分支。证据runtime/test-results/coverage-snapshots/20261111-002504/runtime/test-results/node-review-outline-isolated-20261111，含HTML index.html、LCOV、汇总与稳定性清单。审核阻断用例已在上次固定结果中包含，实际全量用例增量为大纲6项。system共享服务分类未执行，历史失败保留，Java和前端本批未复采。未改变产品及分母，整体目标仍未达到，goal保持active。


### 2026-11-11T00:30:17+08:00 认证网关传输定向结果

用户完整目标：知识中心管理平台行100%、分支95%。新增knowledge-center-auth-transport-http共14/14通过。真实HTTP验证有效会话Cookie转发、上游非200/空正文/null/错误JSON/断连/超时拒绝业务及恢复成功，无插件代理分流，权限插件重写URL后恢复，异步失败结构化输出及非法状态回退。夹具均在runtime隔离且关闭连接后清理。证据runtime/test-results/auth-transport-directed.log。未改产品与分母，准备固定副本全量复采，整体目标仍未完成。


### 2026-11-11T00:33:25+08:00 认证网关固定全量结果

用户完整目标：知识中心管理平台行100%、分支95%。固定副本20261111-003017退出0，154产品、176Jest文件，stable=true、changedFiles=[]。175套件通过、1跳过；2640用例通过、6跳过，167.275秒。行16149/16412=98.39%，分支16617/18957=87.65%，比上一固定全量增加5行、8分支。证据runtime/test-results/coverage-snapshots/20261111-003017/runtime/test-results/node-auth-transport-isolated-20261111，包含HTML index.html、LCOV、汇总、测试日志和稳定性清单。system共享服务分类未运行，历史失败保留，Java和前端本批未重采。未改产品和分母，整体目标仍未达到，goal保持active。


### 2026-11-11T00:35:30+08:00 代理响应边界定向结果

用户完整目标：知识中心管理平台行100%、分支95%。新增proxy-response-boundaries-http共8项，与已有流式2项共10/10通过。真实HTTP覆盖转换空值透传、契约校验失败502、上下文定位、中文正文长度、路径与请求头映射、上游断连及三类错误载荷。proxy-utils模块行52/52=100%，分支43/50=86%；尚未全量复采，不替代平台全量指标。初次断连测试因Node原生Error跨Jest上下文导致instanceof断言失败，改为断言真实ECONNRESET及message后通过，产品未变。证据runtime/test-results/proxy-response-directed.log与proxy-response-directed/coverage-summary.json、lcov.info。整体目标仍未完成。


### 2026-11-11T00:36:51+08:00 配置接口异常与缺省边界定向结果

用户完整目标：知识中心管理平台行100%、分支95%。config-route-http-coverage新增9项（8类读写失败恢复、1项不完整配置默认值），与代理两套件联合23/23通过。真实Express HTTP验证模型/MCP/Agent读取与保存错误进入统一处理器、失败不产生持久化调用结果且下一次请求恢复。config路由行85/85=100%、分支44/44=100%；proxy-utils行52/52=100%、分支43/50=86%。证据runtime/test-results/config-proxy-directed.log及config-proxy-directed/coverage-summary.json。产品和分母未变，尚待固定全量复采，平台全量最新基线仍为Node行98.39%、分支87.65%，Java与前端未重采，整体目标未达成。


### 2026-11-11T00:37:45+08:00 源文档适配器定向结果

用户完整目标：知识中心管理平台行100%、分支95%。新增source-adapter-contract共5/5通过，模块行18/18=100%、分支38/38=100%。验证抽象接口拒绝、扩展名大小写、真实文件SHA256及ENOENT、标准化文档默认值与完整元数据序列化。纯文件协议，无需后端HTTP。证据runtime/test-results/source-adapter-directed.log及source-adapter-directed/coverage-summary.json。产品和分母未改，尚待固定全量复采；平台目标仍未完成，goal保持active。


### 2026-11-11T00:41:11+08:00 配置、代理与源适配器固定全量结果

用户完整目标：知识中心管理平台行覆盖率100%、分支覆盖率95%。固定副本20261111-003800；稳定性{"stable": true, "changedFiles": [], "jestExit": 0, "completed": true, "productFiles": 154, "jestFiles": 178}。测试汇总：Test Suites: 1 skipped, 177 passed, 177 of 178 total
Tests:       6 skipped, 2662 passed, 2668 total
Time:        181.062 s。行16165/16412=98.49%；分支16633/18957=87.74%。证据：runtime/test-results/coverage-snapshots/20261111-003800/runtime/test-results/node-config-source-isolated-20261111。产品与分母未变；system共享服务分类未执行，Java及前端本轮未复采，平台整体目标仍未达成。


### 2026-11-11T00:42:27+08:00 快照文件边界定向结果

用户完整目标：知识中心管理平台行100%、分支95%。新增snapshot-tracker-boundaries共6项，联合已有快照测试17/17通过。真实文件验证损坏JSON拒绝及修复恢复、缺省统计和前序关联、列表过滤/时间排序、ENOTDIR传播、latest目录冲突与修复、清理目录错误及保留最新文件。模块行60/60=100%，分支37/37=100%。证据runtime/test-results/snapshot-boundaries-directed.log与snapshot-boundaries-directed/coverage-summary.json。产品与分母未改，平台目标仍未完成，全量最新基线为Node行98.49%、分支87.74%；本批尚未全量复采。Jest相对覆盖率路径按配置目录解析，首次落入tests内runtime，已将本批产物移回根runtime；后续使用绝对路径。


### 2026-11-11T00:43:17+08:00 PDF适配器边界定向结果

用户完整目标：知识中心管理平台行100%、分支95%。新增PDF协议边界12项，联合既有真实PDF解析共25/25通过。覆盖标题优先级及99/100字符边界、日期缺省、六类路径、关键词过滤去重与15项上限、真实目录扫描缺失/符号链接/ENOTDIR。模块行55/55=100%，分支40/44=90.9%。证据runtime/test-results/pdf-boundaries-directed.log及pdf-boundaries-directed/coverage-summary.json。产品与分母不变；尚未全量复采，平台目标仍未完成，Node最新固定全量行98.49%、分支87.74%。


### 2026-11-11T00:44:08+08:00 PDF元数据缺省定向结果

用户完整目标：知识中心管理平台行100%、分支95%。新增3种解析依赖元数据返回契约，联合真实PDF解析及已有边界共28/28通过。缺失info、空info和完整info均验证默认值/完整值、清洗正文、页数/行数和真实文件SHA256。PDF适配器行55/55=100%，分支44/44=100%。证据runtime/test-results/pdf-metadata-directed.log与pdf-metadata-directed/coverage-summary.json。外部解析返回在新增套件受控替代，既有真实PDF解析单独套件联合通过。产品与分母不变，尚未全量复采；平台目标仍未完成。


### 2026-11-11T00:45:14+08:00 配置校验边界定向结果

用户完整目标：知识中心管理平台行100%、分支95%。新增config-validator-boundaries共22项，联合已有测试39/39通过。验证数值类型/下限/温度端点、缓存缺省与有效值、加密头明文/密文/缺失字段及预设缺失agent等具体错误。模块行53/53=100%，分支77/77=100%。证据runtime/test-results/config-validator-directed.log及config-validator-directed/coverage-summary.json。产品及分母未改；平台目标仍未完成，本批尚未全量复采。


### 2026-11-11T00:46:53+08:00 模板上传异常修复及定向结果

用户完整目标：知识中心管理平台行100%、分支95%。新增template-upload-parser-http共7/7通过，真实HTTP覆盖非法multipart、损坏报文、字段截断/数量/名称、无文件、41MiB请求和正常上传恢复。发现Busboy文件流在报文损坏及主动destroy时发出未捕获error，局部修复为注册文件流error监听并归一化400；保留首次envelope错误，40MiB上限仍返回413。首次测试有多余括号已修正；原未处理错误和归一化前500失败保留于过程记录。模块单套件行47/48=97.91%，分支22/29=75.86%，不替代全量联合指标。证据runtime/test-results/template-upload-directed.log及template-upload-directed/coverage-summary.json。产品新增错误监听使源码分母变化，下一次固定全量应使用实际新分母，不沿用旧计数。平台整体目标仍未完成。


### 2026-11-11T00:47:41+08:00 上传编码和批量定向结果

用户完整目标：知识中心管理平台行100%、分支95%。新增3项真实HTTP上传编码/批量/非法文件字段测试，套件10/10通过。非法UTF8以文件级TEMPLATE_ENCODING_INVALID/422记录且无content；批量files保留顺序、公共元数据与默认标题。模块行48/48=100%，分支24/29=82.75%。证据runtime/test-results/template-upload-encoding-directed.log及template-upload-encoding-directed/coverage-summary.json。客户端中断尚未补测，不将其记录为通过。产品和分母本批未改，平台全量待复采且目标仍未完成。


### 2026-11-11T00:48:33+08:00 上传连接中断定向结果

用户完整目标：知识中心管理平台行100%、分支95%。新增真实客户端中断用例，上传套件11/11通过；等待服务器收到部分正文后断开，观察解析Promise错误并验证后续上传恢复。初次观察TEMPLATE_INVALID_UPLOAD覆盖中断原因，局部修复为aborted事件先保留TEMPLATE_UPLOAD_ABORTED再destroy；先前请求超限仍保留413。模块行50/50=100%，分支24/29=82.75%。证据runtime/test-results/template-upload-aborted-directed.log与template-upload-aborted-directed/coverage-summary.json。产品错误传播修复增加实际分母，准备固定副本全量采集。平台整体目标仍未完成。

### 2026-11-11T00:52:14+08:00 上传及预处理固定全量结果

用户完整目标：知识中心管理平台行100%、分支95%。固定副本20261111-004833，产品154文件、Jest182文件，稳定性stable=true、changedFiles=[]、jestExit=0。181套件通过、1跳过；2716用例通过、6跳过，耗时187.194秒。行16185/16415=98.59%，分支16671/18957=87.94%。证据runtime/test-results/coverage-snapshots/20261111-004833/runtime/test-results/node-upload-preprocessing-isolated-20261111。Node仍缺230行、2286分支；system共享服务分类未执行，Java与前端仍需单独验收，平台目标未完成。

### 2026-11-11T00:54:20+08:00 图片说明接口定向结果

用户完整目标：知识中心管理平台行100%、分支95%。图片说明提供者现有及新增测试8/8通过。本机真实HTTP覆盖兼容接口请求、空响应后恢复和400错误；环境变量、模型、MIME及请求选项边界通过。模块行32/32=100%，分支66/67=98.5%。证据runtime/test-results/image-caption-directed.log及image-caption-directed/coverage-summary.json。产品及分母未改，全量快照尚未纳入新测试，平台目标仍未完成。

### 2026-11-11T00:57:51+08:00 三端 full 覆盖采集结果

用户完整目标：知识中心管理平台行100%、分支95%。执行 `python3 tests/run_tests.py full --coverage --jobs 1`，正式HTML报告 `runtime/test-reports/2026-11-11/20261111-005751-612440-full/report.html`。任务74/79成功，3434通过、1失败、34跳过。Node行16200/16415=98.69%、分支16692/18957=88.05%；Java行3457/3485=99.20%、分支2047/2322=88.16%。前端Istanbul采集因审核工作台16项中1项数据残留断言失败而无摘要，日志见 `details/coverage/frontend/review-cases/1794331360238-2025763/review-test.log`。平台目标未达成。

### 2026-11-11T01:32:39+08:00 E2E HTML 报告阻断结果

用户完整目标：知识中心管理平台行100%、分支95%。执行 `python3 tests/run_tests.py e2e --fail-fast --jobs 1`，统一报告已生成：`runtime/test-results/e2e/20261111-013203-563773-e2e/report.html`。前置迁移保护检测到工作区存在未提交迁移 `apps/yashandb-storage/sql/014_gitlab_version_mapping.sql`，拒绝执行迁移；12+9 个 Playwright 文件未运行。该结果确认报告在前置失败时仍保留总览和场景状态，未修改用户迁移文件，平台覆盖率目标仍未达成。

### 2026-11-11T01:44:00+08:00 工作台审核与 MR 链接边界

用户完整目标：知识中心管理平台行100%、分支95%。`knowledge-center-workbench-http-coverage.test.js` 19/19通过。新增审核文档责任人投影、审核服务异常降级，并通过真实 HTTP 查询验证无效 URL、非 HTTPS、含凭据 MR 链接不会出现在代办中，有效 HTTPS 链接保留。`routes/knowledge-center.js` 单文件定向覆盖行13.89%、分支13.48%；该结果不替代全平台快照。无产品逻辑或覆盖率分母变化，平台目标仍未达成。

### 2026-11-11T01:40:00+08:00 工作台审核投影定向结果

用户完整目标：知识中心管理平台行100%、分支95%。`knowledge-center-workbench-http-coverage.test.js` 共19/19通过，真实 HTTP 覆盖审核文档投影加入责任人工作台，以及审核服务异常时的部分可用响应。`routes/knowledge-center.js` 定向覆盖由行13.73%、分支12.69%提升至行13.89%、分支13.07%；该数字仅为单文件定向采集，不替代平台全量指标。证据为本次 Jest 输出；产品逻辑和覆盖率分母未修改，平台目标仍未达成。

### 2026-11-11T01:57:32+08:00 GitLab 参与人边界补测

`gitlab-participants.test.js` 通过既有 native-contract Jest bridge 运行，95 项通过、5 项跳过。新增真实本机 HTTP 场景覆盖非数组响应、成员分页上限、身份无匹配/重复、缺少统一登录账号、统一登录账号重复、无唯一活跃项目成员、无审核人门禁及默认字段回退。模块行覆盖29/29（100%），分支42/43（97.67%）；仅剩默认参数保护分支未命中。证据为最终 Jest 输出及 `/tmp/gitlab-participants-coverage-final/lcov.info`。这是单模块定向结果，不替代三端全量验收；平台目标仍未达成。

### 2026-11-11T02:19:42+08:00 最新 smoke HTML 报告复验

重新执行 `python3 tests/run_tests.py smoke --report-page-size 2`，2 个任务、24 个用例全部通过（Jest 22、unittest 2），报告 `runtime/test-results/smoke/20261111-021942-616420-smoke/report.html`，含总览、12 个静态场景分页、逐条结果和原始日志链接。离线 Chromium 验收脚本复测 1440px/390px 各10次：最大 DOMContentLoaded 85.9ms/17.8ms，无脚本错误、外部请求和横向溢出；跨页搜索、用例深链接和无 JavaScript 浏览通过。大型 full 报告100ms性能仍未验收；专业报告内部评分维持9.5/10，不代表平台覆盖率目标达标。

### 2026-11-11T04:18:00+08:00 专业测试报告最新样本

`python3 tests/run_tests.py smoke --report-page-size 2`：24/24通过；报告 `runtime/test-results/smoke/20261111-041717-255609-smoke/report.html` 含总览和12个静态分页。入口回归43/43通过；离线Chromium桌面/390px各10次，P95 DOMContentLoaded 83.5ms/63.1ms，检索、深链接、无JS导航通过，零外部请求/脚本错误/页面横向溢出。内部量表9.5/10，大型报告性能未验收；详细依据见 `runtime/rea/professional-test-report/ACCEPTANCE.md`。GitLab成功来源补测已通过诊断运行，固定稳定复采仍在执行，诊断数值不作正式覆盖率。


### 2026-11-11T04:27:52+08:00 GitLab成功来源场景稳定复采结果

固定前端完整复采 `runtime/coverage-goal/frontend-gitlab-success-stable/` 已成功结束；57个产品源码、45个导航、22个API契约、31个写作页面、16个任务页面和16个审核页面等既定采集齐全。`source-stability.json` 的 completed/stable/inputsStable 均为 true，changedFiles/changedInputs 均为空。行覆盖8753/10374（84.37%），分支10108/14196（71.20%）；相对上一正式 frontend-provenance-null-followup 结果增加26行、38分支。本轮保留固定分母，未混用诊断运行最优值；平台行100%、分支95%目标仍未完成。HTML报告内部9.5/10评分与覆盖率验收分别记录。


### 2026-11-11T04:36:36+08:00 上传夹具契约校准

定向7场景已通过。审查发现零字节文件当前页面生成非有效Content-Range，不能用隔离服务接受该请求来声明零字节上传成功；已调整为隔离服务422拒绝并断言页面保留文件、停止完成/建批请求和显示错误。真实资料加工服务不属于本机隔离验收范围。中止原完整采集后修正夹具，再启动冻结输入采集；未使用被中止的计数。后续待办：依据资料加工服务的正式空文件契约决定页面预校验或空文件完成协议，不能因覆盖率目标自行改变业务规则。


### 2026-11-11T04:38:01+08:00 资料上传页面定向验收

新增 `tests/e2e/agent-runner/fixtures/cleaning-upload-http.cjs` 并接入固定前端采集。真实Chromium+本机HTTP共7场景通过，零页面脚本错误；日志 `runtime/coverage-goal/cleaning-upload-directed/verification.log`。覆盖对话框开关、无文件拦截、分块失败/批次失败后保留与恢复、空文件拒绝、多块及默认块大小上传、成功后重载。全量稳定复采正在运行，输出 `runtime/coverage-goal/frontend-cleaning-upload-verified/`，尚不声明新增覆盖率；上一正式前端仍为8753/10374行、10108/14196分支。平台100%/95%目标仍未完成。


### 2026-11-11T04:48:07+08:00 上传完整复采与写作采用定向验证

上传7项HTTP场景完整固定复采成功，`runtime/coverage-goal/frontend-cleaning-upload-verified/` 保持57个产品源码、10374行/14196分支分母；行8777/10374=84.60%、分支10138/14196=71.41%，较上一正式报告增加24行、30分支。completed/stable/inputsStable均为true，changedFiles/changedInputs为空。

新夹具 `tests/e2e/agent-runner/fixtures/writing-adoption-http.cjs` 定向Chromium+本机HTTP验证3项通过、零页面脚本错误（日志 `runtime/coverage-goal/cleaning-upload-directed/adoption-verification.log`）：真实原文编辑同步到工作台；采用503保留候选和原文；再次采用成功，重新打开写作页看到已采用正文。请求验证修订4、附件、main分支、空基线标准SHA256及候选正文。初始化必须等待Vditor就绪，避免构造器返回而Lute尚未可用的夹具竞态；不修改产品代码。已接入固定采集并断言3项计数；新的覆盖率增益待稳定完整复采确认。平台行100%/分支95%目标仍未达成。


### 2026-11-11T04:59:15+08:00 写作采用稳定复采与人员导入接入

固定完整采集 `runtime/coverage-goal/frontend-writing-adoption-verified/` 成功结束，57产品源码/45导航及所有既定场景计数齐全，写作采用HTTP为3项。行8795/10374（84.77%）、分支10158/14196（71.55%），较上一正式上传结果增加18行、20分支；completed/stable/inputsStable均为true，changedFiles/changedInputs为空。

将已定向通过的人员导入HTTP夹具接入固定采集，预期6项。最终夹具再次定向通过6项、零脚本错误，并明确验证multipart的XLSX MIME；日志 `runtime/coverage-goal/cleaning-upload-directed/import-verification.log`。覆盖打开取消、预检失败保留、冲突转义、修正预检、应用失败恢复、重试成功刷新和重开清空。沿既有真实页面/HTTP边界与此前设计，不修改产品代码、业务规则或分母。下一次固定全量输出 `runtime/coverage-goal/frontend-principal-import-verified/`；启动后冻结输入，覆盖率增量待终止且稳定后确认。平台行100%/分支95%目标仍未达成。


### 2026-11-11T05:13:04+08:00 GitLab管理与静态网关补测接入

固定前端采集已接入独立页面夹具gitlab-mapping-http.cjs（13项）和gitlab-connection-http.cjs（14项），每页计数、脚本错误与覆盖数据均核验后关闭。已在runtime定向通过27项真实Chromium+本机HTTP场景，完整稳定复采待运行；这些场景不等同真实GitLab服务集成。Node新增knowledge-center-static-http.test.js，10项真实HTTP验证静态文件、SPA回退、未知API、路径穿越与父路由；runtime定向10/10通过，接入后复验及全量采集待运行。

上一正式前端结果runtime/coverage-goal/frontend-principal-import-verified：8831/10374行（85.12%）、10173/14196分支（71.66%），源码和输入稳定。三端100%/95%目标仍未完成；不调整产品分母和阈值。


### 2026-11-11T05:28:51+08:00 GitLab管理稳定复采与权限资产补测接入

固定前端完整采集已结束：8977/10374行（86.53%）、10304/14196分支（72.58%），57个产品源码、45导航文件；completed/stable/inputsStable均为true，changedFiles/changedInputs均为空。相对上一正式人员导入结果增加146行、131分支。证据runtime/coverage-goal/frontend-gitlab-management-verified，包含HTML、LCOV和稳定性清单。Node同期完整采集6项超时失败，不能作为通过结果。

已将runtime定向验证的permission-roles-http.cjs（8项）与asset-management-http.cjs（8项）接入正式独立已登录页面循环，每页核对计数、零脚本错误、合并覆盖后关闭；config-registry-public.test.js（14项）接入正式Jest清单。保留固定产品分母和既有公共UI/API契约，不改产品；完整采集前先语法检查和超时失败定向复核。整体行100%、分支95%目标仍未达到。


### 2026-11-11T05:30:06+08:00 Node超时定向复核与固定重采准备

集成后注册表14项通过，四类Jest超时文件在30秒预算下通过；6文件共65通过、1失败，Socket.IO使用裸Jest命令失败，核对统一入口NODE_PATH后单文件1/1通过（1.13秒）。真实动态端口启动服务探活HTTP200，日志socket-startup.log。裸Jest复核环境与正式统一入口不等价，不能据此断言正式Socket超时根因；正式完整6个失败仍保留。下一轮使用统一入口test_environment、188个正式Jest文件、30秒测试预算，保留Socket原内部5秒等待、不改产品/测试超时规则，避免与前端浏览器全量并发。输出runtime/coverage-goal/node-asset-permissions-verified。语法检查4文件均通过，权限/资产夹具runtime定向8+8通过但正式完整前端尚未复采，不宣称新增覆盖增益。


### 专业 HTML 报告与按需检索

实际运行默认输出中文 `report.html` 总览，按测试场景静态分页，包含逐条结果、失败详情、原始日志与覆盖率门禁。运行示例：`python3 tests/run_tests.py smoke --report-page-size 50`；覆盖率使用 `python3 tests/run_tests.py full --coverage`。搜索及状态筛选首次使用时加载本地索引，支持离线浏览；分享时保留整个运行目录（assets/scenes/details），无 JavaScript 可通过场景和分页查看。

2026-11-13 Java 逐任务迁移覆盖续验：固定采集器纳入 14 个公开 `migrate-tasks` / `activate-tasks` 命令场景，均使用合成 JDBC 和独立 `runtime` 备份目录。`runtime/coverage-goal/java-task-migration-boundaries-20261113/` 的 15 个产品源码及输入哈希稳定，行 4407/4867（90.55%）、分支 2669/3609（73.95%）；较上一稳定 Java 报告增加 12 行、12 分支。Java 仍缺 460 行及至少 760 个分支，平台三端 100% 行、95% 分支目标未完成。

2026-11-13 PingCode 存储 HTTP 续验：在隔离合成 JDBC 状态下，经公开 HTTP 完成预览确认、幂等回放、任务来源快照、变更历史读取、失败图片列表及 READY 资源重试；无效参数和过期资源版本均拒绝且不增加版本。完整稳定报告 `runtime/coverage-goal/java-pingcode-resource-retry-verified-20261113/` 为 15 产品文件行 4648/4867（95.50%）、分支 2779/3609（77.00%），相对上份同分母净增 241 行、110 分支；PingCode 仓储仍缺 108 行，Java 全量仍缺 219 行和至少 650 个目标分支。Node、前端与 Java 均未达到平台最终门槛。

2026-11-13 Java 续验：本机隔离真实 HTTP 夹具增加 PingCode 第二次运行的标题/正文历史变更、第三次空页移除、REQUIREMENT 来源 IR/SR 关联，以及文档任务可见手册过滤和版本 0 首次创建与幂等冲突。固定 `runtime/coverage-goal/java-document-create-20261113/` 完整退出 0，15 产品文件、输入前后哈希稳定；行 4741/4867（97.41%）、分支 2862/3609（79.30%），相对上一稳定报告净增 93 行、83 分支。Java 仍缺 126 行及至少 567 个目标分支；PingCode 仓库缺 34 行、Main 缺 56 行。Node、前端与 Java 的平台 100% 行、95% 分支目标仍未完成。

验收量表及限制见 `runtime/rea/professional-test-report/ACCEPTANCE.md`：43项入口回归、24项真实smoke通过，3469用例/75分页离线检索验证通过；桌面首次打开仍超过100ms，性能尚未完全达标。评分9.5/10为内部量表自评。


### 2026-11-11T05:50:00+08:00 资产生产HTTP边界接入正式清单

38项新增真实HTTP边界已接入既有knowledge-center-asset-status-overrides.test.js，原相对产品导入保持，授权会话与人员仓储仅作为公开模块边界输入；完整该文件45/45通过。断言非法方法Allow头、无权请求不写入、责任人校验、兼容编辑、冲突拒绝后成功重试及审计回读、审核人投影。下一步固定188个Jest文件完整采集，保持产品分母不变。大纲回收站12场景runtime定向运行中，未计正式覆盖。


### 2026-11-11T05:53:55+08:00 工单版本映射公开HTTP补测设计

通过统一knowledge-center真实HTTP入口导入工单，再GET document-tasks/catalog?handbookId=h1&ticketNumber=...，验证业务产品/版本缺失、映射缺失、连接停用、业务规则缺失、上游分支不存在时目录versions清空且中文versionMappingError明确；恢复active连接及可读分支后返回唯一映射版本。GitLab使用动态端口真实HTTP，domainStore仅为数据库边界夹具，工单使用runtime独立文件；不直接调用resolveVersionMapping私有回调。大纲回收站定向12/12零脚本错误，已接入完整前端独立页面循环，待Node采集结束后复采。


### 2026-11-11T05:55:50+08:00 资产生产正式结果与映射接入

固定188个Jest文件完整通过：187套件通过、1条件跳过，2829项通过、8跳过；stable/completed=true、changedInputs=[]。行16236/16415（98.90%）、分支16795/18957（88.59%），相比前轮增16行41分支，证据runtime/coverage-goal/node-asset-production-http-verified。工单版本映射公开HTTP定向2/2通过（含缺产品/版本、映射/连接缺失、连接停用、规则缺失、分支不存在及恢复），已接入document-task-version-mapping-http.test.js；缺连接时现有同步目录读取直接返回404，测试断言此公开契约，不改产品。新文件尚未计入完整Node覆盖；大纲回收站12场景已接入前端，待完整复采。


### 2026-11-11T06:11:22+08:00 增量任务创建13组HTTP场景正式接入

真实Chromium定向13组通过，页面错误为空；正式夹具tests/e2e/agent-runner/fixtures/incremental-create-http.cjs，经动态HTTP验证基线错误/空结果/响应形态/转义/依赖失效、取消、必填校验、创建失败保留和同幂等键重试成功。固定前端采集加入13计数门禁和独立已认证页面，仍保留57产品文件。上一轮frontend-outline-recycle-verified因审核场景1/16超时退出1，completed=false，stable/inputsStable=true且changedFiles/changedInputs=[]；拒绝该轮为正式覆盖率，原始日志保留。目前定向带trace复现该超时，未放宽门槛。Node189文件复采运行中，未修改其冻结输入。


### 2026-11-11T06:13:16+08:00 审核覆盖率插桩缓存

审核工作台浏览器夹具在工作进程内复用相同路径且原文完全一致的插桩文本，源码变化时重新编译；浏览器每页计数仍独立初始化。减少跨导航、跨用例重复编译，不修改60秒超时或覆盖率清单。原frontend-outline-recycle-verified的1项超时保留为失败；定向相同用例1/1通过（27.1秒总耗时），缓存变更后的定向与完整复采另行记录。


### 2026-11-11T06:14:02+08:00 审核缓存变更定向验收

相同Istanbul覆盖模式下，人员ID审核与整册聚合在线评审两个真实HTTP浏览器场景2/2通过，总46.2秒；各用例保留60秒门槛。下一轮完整固定采集纳入增量创建13组和大纲回收站12组，输出frontend-incremental-create-verified。原失败完整运行仍不计入有效覆盖率。


### 2026-11-11T06:14:40+08:00 版本映射HTTP正式全量通过与前端续采

Node正式189个Jest文件复采退出0，188套件通过、1跳过，2831用例通过、8跳过、0失败。source-stability completed/stable=true，changedInputs=[]。行16248/16415=98.98%，分支16811/18957=88.67%，相较上一有效node-asset-production-http-verified增加12行、16分支，分母未变。证据runtime/coverage-goal/node-task-version-http-verified，含HTML index.html、lcov、coverage-summary、原始test-results与稳定性清单。前端原完整采集1项超时失败，不计入通过证据；新增13组创建夹具与按原文缓存插桩文本的维护已定向通过。启动frontend-incremental-create-verified（session19893），包含原大纲回收站12组及新增增量创建13组，冻结产品/测试/配置/采集器输入。前端最近有效仍87.50%行/73.13%分支，Java99.20%行/88.16%分支；全平台100%行/95%分支目标保持active，未达成。


### 2026-11-11T06:25:41+08:00 在线评审与真实Codex进程HTTP正式接入

最新固定前端采集frontend-incremental-create-verified退出0，completed/stable/inputsStable=true，changedFiles/changedInputs=[]；57产品文件，9166/10374行88.35%、10448/14196分支73.59%，较前次增加88行66分支。保持原分母。在线评审发起真实HTTP场景正式接入审核spec并定向1/1通过；采集器门禁由16改17，下一轮完整复采验证增量。新增codex-process-http.test.js及fixtures/codex-process-worker.cjs，通过真实平台HTTP启动/状态/SSE/取消驱动真实runner与fork，不模拟child_process；3/3通过，含启用MCP服务/知识库清单、密钥脱敏/事件截断、合作取消与6秒后强杀不合作worker/子进程组。Linux孤儿zombie视为已终止；测试核对子进程已不存在或Z态并finally防漏清理。仅模型治理输入和外部执行worker为隔离边界；未改产品源码。目标仍为三运行时行100%/分支95%，未完成。

### 2026-11-11T06:42:10+08:00 在线评审覆盖结果与手册编辑器测试接入

前端在线评审完整采集退出 0，completed/stable/inputsStable=true，changedFiles/changedInputs=[]。行 9203/10374（88.71%），分支 10488/14196（73.87%），同分母增加 37 行、40 分支，证据 `runtime/coverage-goal/frontend-online-review-verified/`。手册编辑器真实 HTTP/Chromium 场景原生 3/3、定向插桩 3/3 通过，已接入采集器，固定 57 个源码分母。正式编辑器全量待重采。Node 最新行 99.03%、分支 88.73%；Java 行 99.20%、分支 88.16%。整体目标仍未达到。
# 2026-11-11T08:05:00+08:00 文档目录责任人补测

真实 HTTP 网关目录测试接入实际目录投影，验证一致主责、旧领域唯一负责人和冲突不推测；结合原目录测试 20/20 通过。定向目录模块行 100%、分支 94.2%，证据 `runtime/coverage-goal/catalog-owner-focused-final/`。固定 Node 全量 190 套件通过、1 跳过，2851 用例通过、8 跳过；输入稳定，行 16283/16415（99.19%）、分支 16872/18957（89.00%），较前次增加 2 行和 4 分支。证据 `runtime/coverage-goal/node-catalog-owner-verified/`；平台整体目标仍未达成。

# 2026-11-11T08:13:28+08:00 手册取消修改补测

真实 Chromium 与隔离 HTTP 验证取消确认保留正文、确认取消恢复共享草稿且没有保存请求，随后仍可编辑并完成保存失败重试。原生定向 1/1、插桩整组 5/5 通过；固定前端全量待复采。平台覆盖率目标尚未完成。

2026-11-11T08:23:34+08:00 固定前端全量复采退出 0，completed/stable/inputsStable 均为 true，changedFiles/changedInputs 均为空。57 个产品文件，行 9389/10376（90.48%）、分支 10662/14204（75.06%），较上一有效结果增加 4 行、2 分支。证据 `runtime/coverage-goal/frontend-handbook-discard-verified/`；平台目标仍未达到。

2026-11-11T09:09:06+08:00 工作台联合查询新增空条件、过量条件、比较方式、日期区间和清空恢复的真实浏览器及 HTTP 断言，定向插桩通过。与上一有效基线合并的诊断结果为工作台模块行 210/217、分支 311/386；固定全量复采前不作为正式平台覆盖率。

2026-11-11T08:29:46+08:00 网页引用新增隔离 HTTP 候选正文和图片地址场景，定向 12/12 通过；目标模块定向行 77.77%、分支 65.51%，证据 `runtime/coverage-goal/web-candidates-focused-valid/`。首次路径配置错误产生空覆盖表，不作覆盖率证据；固定 Node 全量尚待复采，平台目标仍未完成。

2026-11-11T08:36:33+08:00 固定 Node 全量复采：191 文件，190 套件通过、1 跳过，2852 用例通过、8 跳过；completed/stable=true，changedInputs=[]。行 16285/16415（99.20%）、分支 16872/18957（89.00%），较上一有效结果增加 2 行，分支持平。证据 `runtime/coverage-goal/node-web-candidates-verified/`；平台目标仍未达到。

2026-11-11T08:39:40+08:00 GitLab 个人账号新增真实 HTTP 映射前后关联手册数量及禁用状态断言，定向 22/22 通过，统计两行命中；证据 `runtime/coverage-goal/gitlab-account-count-focused-valid/`。首次错误路径产生的空覆盖表无效，固定全量尚待复采；平台目标仍未达到。



2026-11-11T09:31:38+08:00 工作台联合查询定向插桩通过，诊断增量8行、25分支。完整采集先遇返回页面networkidle超时，改为DOM及应用壳/导航可见后继续；后续全量完成场景但源文件被外部修改，稳定性门禁拒绝。再采集在写作第28场景失败：技能提示节点不存在时可选链不等比较提前成立，请求计数仍0。修复为节点存在且退出加载文案，原请求数/编辑器一致性断言保留，定向1/1通过。原失败与不稳定报告均不计入正式覆盖率。证据runtime/coverage-goal/frontend-my-work-filter-verified、frontend-my-work-filter-retry、frontend-my-work-filter-ready、frontend-my-work-filter-current。平台行100%/分支95%目标仍未完成，下一步基于修正等待条件完整复采。
2026-11-11T09:45:46+08:00 GitLab 手册仓库图片真实 HTTP 补测：raw=1 逐字节回读 PNG、媒体类型和私有缓存头，匿名与映射外路径被拒且无上游读取。GitLab HTTP 文件 22/22 通过。前端完整采集 `runtime/coverage-goal/frontend-my-work-filter-final/` 执行全部场景后因并行修改输入失败，不计入正式覆盖率；其行 9410/10397、分支 10718/14241 仅为诊断。

GitLab 图片定向 Jest 覆盖采集退出 0，证据 `runtime/coverage-goal/gitlab-raw-image-focused/`。当前知识中心 Node 路由分母已变化，旧全量基线与当前定向报告不能直接合并；需稳定全量复采。
2026-11-11T09:57:40+08:00 图谱 JSON 存储新增非法边权重拒绝、损坏文件错误及修复回读，Jest 文件17/17通过；定向覆盖102/102行、57/68分支。固定 Node 清单首次重采 189套件通过、1失败、1跳过，期间3项输入变化，报告 `runtime/coverage-goal/node-graph-image-current/` 仅供诊断。失败是 Agent 管理旧测试期望 DSH 未就绪422，现行HTTP契约为409 DSH_NOT_READY；已用隔离运行器补测未就绪与就绪启动，Agent管理文件6/6通过，待稳定全量重采。

2026-11-11T10:03:57+08:00 固定 Node 191文件再次运行，190套件和2860用例通过，1套件和8用例跳过、0失败；采集期间5个输入变化，报告 `runtime/coverage-goal/node-graph-image-dsh-recheck/` 仅供诊断。行16324/16487、分支16898/19024不能作为当前稳定基线。图谱模块本轮行102/102。
2026-11-11T10:08:34+08:00 向量存储新增NaN/正负Infinity拒绝与持久化回读，文件18/18通过，定向向量59/59行、图谱102/102行，证据 `runtime/coverage-goal/vector-graph-focused/`。Office渲染失败投影新增错误与零资产断言，文件11/11通过，定向投影10/10行，证据 `runtime/coverage-goal/office-render-focused/`。平台整体目标尚未达到，最近Node全量因并行输入变更仅为诊断。
### 2026-11-11T10:19:02+08:00 Java GitLab 草案撤销 HTTP 覆盖复采

`StorageGitLabHttpCheck` 通过真实本机 HTTP 验证版本映射草案撤销的 404、428、400、409 及成功路径；隔离 JDBC 状态机核对失败不改状态/审计、被有效修订引用时拒绝、成功后标记 DELETED 且版本递增、列表和详情不再显示、DELETE 审计保留。完整采集 `runtime/coverage-goal/java-draft-retract-20261111/` 退出 0，9 个产品源码，`source-stability.json` 为 stable=true、changedFiles=[]。行 3467/3495（99.20%），分支 2059/2334（88.22%），较同日当前输入基线分别增加 10 行、10 分支；剩余未覆盖 28 行均在 Main.java。Node、前端和 Java 的平台总体 100% 行/95% 分支目标仍未达成。

### 2026-11-11T10:27:13+08:00 Java 记录引用 HTTP 覆盖复采

`StorageRecordHttpCheck` 经真实本机 HTTP 验证无 If-Match 的相同正文 PUT 保持修订号，以及同次写入两个有效大纲版本引用时逐项行级锁查询并持久化。完整 JaCoCo 采集 `runtime/coverage-goal/java-record-refs-20261111/` 退出 0，9 个产品源码，`source-stability.json` 为 stable=true、changedFiles=[]；行 3469/3495（99.26%），分支 2062/2334（88.35%），较上一稳定报告增加 2 行、3 分支。仍有 26 行未覆盖，平台整体目标未达成。

### 2026-11-11T10:47:24+08:00 前端版本映射夹具与插桩资源复采

版本映射 Chromium/隔离 HTTP 夹具已与当前六列表格对齐，保持 13 个场景及原有写入、版本头、幂等键断言。采集器对固定源码 URL 使用预插桩文本响应，修复两次 `route.fetch()` 静态 JS 断连。完整前端运行 `runtime/coverage-goal/frontend-20261111-static-instrumented/` 执行所有场景：57 个产品文件、45 个导航、22 个 API 契约、31 个写作、16 个任务、17 个审核等计数通过；行 9453/10435（90.58%）、分支 10831/14438（75.01%）。运行期间 9 项输入被并行修改，`source-stability.json` stable=false，数值仅供诊断，不作为正式基线；平台目标仍未完成。

2026-11-11T11:02:03+08:00 再次复采曾提前退出，但输入变化异常掩盖了主错误；采集器现仅在 `completed=true` 时抛稳定性异常，始终写出清单。修正后的 `runtime/coverage-goal/frontend-20261111-primary-error/` 完成全部 57 文件及固定场景，诊断行 10417/11014（94.57%）、分支 12444/17116（72.70%）；期间 `app.js`、版本映射视图等 7 项输入变化，stable=false。两轮结果都不能升级为正式基线；全平台目标未达成。

### 2026-11-11T11:05:24+08:00 GitLab 版本映射当前页面定向补测

前端版本映射夹具适配当前新增表单的参考候选下拉框，新增草案删除弹层的取消、HTTP 失败和成功断言；隔离后端仅在成功时移除草案，并检查两次删除请求均带 If-Match=1 和幂等键。原新增、修订、启用、停用及失败重试契约保留。独立测试模式前端服务、真实登录 HTTP 与 Chromium 页面定向执行 16/16 通过；采集器预期场景数同步为 16。此结果不替代固定 57 文件的完整前端覆盖率及输入稳定性门禁；平台 100% 行/95% 分支目标仍未达到。

### 2026-11-11T11:10:15+08:00 AI 阶段产物契约定向补测

`production-ai-contracts.test.js` 新增空白 writer 片段、审阅摘要不匹配及非法记录不可恢复的公开契约断言，合法记录恢复仍通过。定向 Jest 6/6 通过；定向模块行 85.71%、分支 71.42%，报告 `runtime/coverage-goal/production-ai-contracts-focused-20261111/`。首次 collectCoverageFrom 路径错误产生空表，已排除。全量 Node 稳定复采未完成，平台目标仍未达成。

2026-11-11T11:12:19+08:00 同一契约文件补阶段信封完整/缺省快照与未知阶段拒绝，定向 Jest 7/7 通过，模块行 95.23%、分支 87.30%，证据 `runtime/coverage-goal/production-ai-contracts-envelope-20261111/`。仅为模块局部统计，固定全量与三端目标仍待验收。

### 2026-11-11T11:27:05+08:00 前端固定清单稳定复采

版本映射夹具将已移除的 `pending` 状态改为现行 `draft`，保留初始无草案和真实 HTTP 写入断言。首次采集在旧选项超时，`completed=false`，不计覆盖率。修正后完整采集 `runtime/coverage-goal/frontend-mapping-draft-20261111/` 退出 0，57 产品文件及全部场景计数通过；`source-stability.json` 显示 completed/stable/inputsStable=true，changedFiles/changedInputs=[]。行 9448/10414（90.72%），分支 10781/14307（75.35%）。该前端基线有效，但距平台 100% 行/95% 分支目标仍有差距。

2026-11-11 资产仓库映射场景增加实际 GET 映射/连接分支/目录与表单回填断言，资产 HTTP 场景为 9 项。完整前端采集 `runtime/coverage-goal/frontend-asset-mapping-retry-20261111/` 执行完场景，但期间 4 项源码/样式输入变化，`completed=true`、`stable=false`、`inputsStable=false`，退出 1；诊断计数 10404/11054 行、12222/17034 分支不计正式覆盖率。最近有效前端基线仍为上段稳定报告，平台目标未达成。

2026-11-11 Java GitLab 版本映射归档续作：`StorageGitLabHttpCheck` 通过真实本地 HTTP 验证归档/恢复、缺版本/幂等键、非法状态、条件更新冲突、列表分区、行版本与审计；共享 JDBC 夹具按当前 SQL 处理归档筛选和条件绑定。完整 9 产品文件 JaCoCo 稳定复采 `runtime/coverage-goal/java-archive-http-20261111/` 为 3493/3519 行（99.26%）、2090/2362 分支（88.48%），同分母增加 17 行、21 分支。尚缺 26 行，100%/95% 平台目标未达成。
2026-11-11 文档预处理索引结构异常补测：隔离真实 HTTP 服务将 `metadata.json` 临时写为 JSON `null`，GET 列表返回 500；恢复原始文件后列表重新可用。`document-route-coverage.test.js` 29/29 通过，定向插桩确认 `routes/document.js:865` 命中；结果见 `runtime/coverage-goal/document-null-directed/`。此为局部覆盖证据，Node 全量及三端 100% 行、95% 分支目标仍未完成。
2026-11-12 Node 固定 Jest 清单复采：首次稳定采集发现两套既有失败（AI 阶段产物误用外部数据库、连接详情抽屉绕过视口令牌），修复后两套定向回归 47/47 通过。完整清单 192 文件复采于 `runtime/coverage-goal/node-current-20261111-1212/`，191 套件通过、1 跳过，2870 项通过、8 跳过；`source-stability.json` 为 `completed=true`、`stable=true`、`changedInputs=[]`。Node 当前有效计数 16391/16508 行（99.29%）、16953/19046 分支（89.01%）。知识中心统一路由仍有 33 行和 531 分支未覆盖；此 Node 报告不代表前端、Java 或平台整体已达标。
2026-11-12 知识中心资产目录 PATCH 增加隔离 HTTP 授权与乐观版本测试：普通用户 403 且无写入，管理员成功更新并递增版本，过期版本 409 且状态不变。`knowledge-center-context-boundaries-http.test.js` 16/16 通过；定向插桩 `runtime/coverage-goal/asset-catalog-patch-directed/lcov.info` 确认路由授权两分支命中（2/1 次）。Node 全量稳定基线仍为 99.29% 行、89.01% 分支，本次仅定向增量，等待全量复采核实累计值。

2026-11-12 后续固定 Node 清单现含 200 个文件。复采 `runtime/coverage-goal/node-current-20261112-1940/` 有 188 套件通过、11 失败、1 跳过；2929 项通过、30 失败、8 跳过。采集期间 11 个源码/测试/配置输入变化，且多套环境依赖和视口门禁失败，`completed=false`、`stable=false`，97.45% 行和 87.13% 分支仅为诊断，不能与稳定基线比较。资产目录新增套件自身 16/16 通过，前述定向两分支证据仍有效。

2026-11-12 网页引用传输新增生产 `http/https.get` 接收路径测试，绕过 receive 注入替身，分别验证协议选择、已校验 DNS 地址的 `all=true/false` 固定回调、请求头和受控内存响应；没有外网请求。`web-reference-transport.test.js` 14/14通过；定向报告 `runtime/coverage-goal/web-reference-receive-directed-final/lcov.info` 确认原缺失 44、45、48、52 行均命中两次，协议与 lookup 两种分支均命中。此为局部结果，尚待全量稳定复采核算平台比例。

同日继续为真实 `http/https.get` 接收路径增加套接字错误注入，验证 Promise 拒绝并保留原因、后续受控 HTTP 请求成功；完整传输测试 16/16 通过，定向报告 `runtime/coverage-goal/web-reference-socket-directed/` 通过。生产模块仍为局部采集，不据此声明全平台覆盖率达标。

2026-11-12 数据库配置模块独立公开契约测试 5/5 通过，定向插桩 `runtime/coverage-goal/database-config-contract-final/` 行/分支/函数/语句均100%。删除的 `merge()` 经全仓调用搜索确认仅自递归、无调用方；`readDotenv()` 唯一调用固定要求 service.env 存在，因此将私有解析器改为无配置文件时直接报错，保持公开接口现有失败语义。此为单模块结果，不代表 Node 全量或三端达标。

2026-11-12 图片说明 Provider 基类补充未实现方法应拒绝的契约，现有具体 Provider 测试文件9/9通过；定向报告 `runtime/coverage-goal/image-caption-contract-directed/` 显示基类行、分支、函数及语句均100%。此为稳定源码的单模块增量，仍需完整 Node 复采确认累计覆盖率。

### 2026-11-13 专业 HTML 报告 REA 复验

参考 Allure 的运行总览/失败证据、Playwright HTML Reporter 的状态筛选/用例定位、ReportPortal 的质量概览、pytest-html 的离线明细/日志。当前真实 smoke 报告 `runtime/test-results/smoke/20261113-033946-228165-smoke/report.html` 有总览、场景静态分页、24 条逐条结果、任务日志链接及覆盖率未启用提示；2/2 任务通过（Jest 22/22、Python unittest 2/2）。统一入口回归 `python3 -m unittest tests/unit/root/test_run_tests.py` 为 45/45。

仓库 REA `app-capability-transfer` Skill 的既有受控报告 Chromium Evidence 为 `ev_50491be1528b0312b6410fd921da6ca143249abbf1241f996be4bb23948332b7`，原始 JSON 保存在 `runtime/rea/professional-test-report/current-smoke-rea-evidence.json`，完整捕获无障碍树。本轮没有连接 REA MCP，未生成新 REA Evidence；当前报告另由离线 Playwright 复验，1440px 和 390px 各 10 次导航的 DCL/load P95 为 25.0/25.5ms、22.5/23.1ms，搜索、深链、无 JS 分页通过。3,469 条用例大样本报告在 1440px 的 DCL/load P95 为 19.1/23.3ms，390px 为 70.3/70.9ms；335 条搜索结果、失败过滤、深链和无 JS 分页通过。内部量表评分为 9.5/10，性能项保留半分扣减，评分限制见 `runtime/rea/professional-test-report/ACCEPTANCE.md`。该分数不是第三方认证，不代表平台行 100%/分支 95% 覆盖目标达成。

### 2026-11-13 前端 CSV 导出行为补测与稳定复采

`document-tasks-frontend.test.cjs` 在导入后经实际页面点击 CSV 导出，验证生产任务路由返回的下载文件名和正文；隔离 HTTP 503 响应验证用户可见错误提示。首次补测中的来源资料导出断言因导入契约不会自动设置来源类型而不适用于该夹具，已移除；产品代码未修改。定向浏览器套件 2/2 通过。完整前端固定清单 `runtime/coverage-goal/frontend-task-export-20261113/` 退出 0，59 个产品文件及固定场景全部完成，`source-stability.json` 的 `completed/stable/inputsStable=true`，`changedFiles/changedInputs=[]`。覆盖行 9925/10957（90.58%），分支 11451/15320（74.74%），较前一稳定复采 9908/10957 行、11444/15320 分支增加 17 行、7 分支。前端及全平台行 100%、分支 95% 目标仍未达成。

### 2026-11-13 角色工作交付体验回归

知识中心持续体验整改以“某个角色接手一项工作直到确认交付”为验收单位。对应回归覆盖全局通知认证后异步读取未读数、通知列表按需读取与失败重试；大纲未知状态不计入已知状态；资料清洗批次/数据集行级详情、状态与缺省字段；工作台到任务、编写、逐篇审核及 MR 回读的服务端深链；桌面和 390px 关键字段、控件触达与横向溢出；一级页面首屏与首个可执行内容的真实性能测量。隔离浏览器 fixture 只证明页面交互；后端行为须由真实 HTTP 网关/API 测试支撑，真实平台登录证据需另列环境与会话条件。

本轮清洗/通知行为回归新增批次与版本列表进入详情、批次文件分页、详情返回原列表页、窄屏触控尺寸、认证后异步未读角标、读取失败不显示为零及打开面板重试；`knowledge-center-my-work.node.test.cjs` 17/17 通过。公共样式颜色回归先证实关闭按钮当前错误采用危险红，再修复为中性色；工作区布局套件另加关闭/隐藏/删除的计算颜色对照。真实资料清洗 API 从本机 13510 返回 `401 AUTH_REQUIRED`，本轮没有可用登录会话，因此真实共享平台数据验收仍未通过；真实端点契约由既有网关白名单和 FastAPI 路由定义确认，隔离 HTTP fixture 不替代真实调用。

2026-11-13T14:46:15+08:00 工作台路径与重试续验：列表保留短标题并展示完整相对路径，工作详情在关联范围中直接展示路径；缺少 URL 时显示“操作入口暂不可用”，点击“重新读取”重新请求待办投影。桌面/390px 浏览器回归与手册返回性能共 18/18 通过，工作台手册返回 P95 34.5ms（隔离 HTTP fixture）。另修正 `knowledge-center-entry.spec.js` 中过时的“工作台刷新按钮”及六列表头断言，改为断言没有独立刷新按钮、七列表头和数据变更投影刷新；该集成规格未在真实 13510 登录环境运行。本轮大纲、仪表盘和资料清洗单元测试 62/62 通过，`npm run check:ui`、语法与差异检查通过。13510 未认证 API 返回 401，四类真实角色、八工作区视觉和真实页面性能验收仍待有登录会话的环境完成。

2026-11-13T14:46:15+08:00 公共危险按钮续验：统一组件曾没有 `.button.danger` 变体，导致明确标为删除的主操作仍使用品牌蓝；新增红底白字主危险、白底红字次级危险样式，并调整 PingCode 删除确认局部样式保证对比度。关闭/隐藏保持中性；更新详细设计中相反的旧规则。工作台与八工作区布局浏览器用例 22/22、`npm run check:ui` 通过；统一构建 `runtime/build/knowledge-center/current` 成功。当前验收表已更正清洗、通知、大纲的隔离验证状态，并保留真实服务端、八区截图和全站性能为未完成项。

2026-11-13T15:03:24+08:00 复核确认：按钮语义用例验证危险主按钮红底、次级按钮白底红字，关闭/隐藏为中性；工作台和八工作区布局浏览器测试 22/22，清洗/通知/大纲等单元测试 62/62。手册返回 P95 最新样本为 34.5ms（隔离夹具）。服务端 13510 仅以未认证请求读取，返回 401；没有据此宣称真实角色链路或真实页面通过。

2026-11-13T16:07:56+08:00 PingCode 同步工作区与详情字段续验：`test_task_source_pages.py` 7/7 覆盖需求/工单详情章节映射、空字段提示、PingCode 短 ID、批次上限和来源身份错配拒绝；插件 Chromium 7/7 覆盖桌面/窄屏同步及已确认正文查看。`npm run check:ui`、Node/Python 语法与 `git diff --check` 通过；首次 UI 门禁发现生产视图原始 Lucide 计数已由 4 降到 1，同步降低基线后通过。重建并按既有授权重启 13510 与四服务，健康端点 4/4 HTTP 200。真实 PingCode 需求基线 `Yq_yJCzT` 第 0–3 页读取成功；样例 `R8zzm6Ue` 位于第 3 页，四个章节均已输出，测试建议上游为空并标注“PingCode 未填写”，另外三项有内容。第 4 页因 `YASHAN-4241` 声明 1 条关系、结构化查询返回 0 条而返回 `PINGCODE_RELATION_INCOMPLETE`，全量预览/确认未完成且没有写任务快照。真实浏览器打开 13510 插件页重定向到登录表单，未认证 API 返回 `AUTH_REQUIRED`；因此真实管理员页面交互未验收。

2026-11-13T16:53:01+08:00 PingCode 同步无反馈回归：插件 Chromium 7/7 验证同步按钮确实发送创建运行 POST、运行时显示“同步中…”且禁用重复提交、失败后在工作区持续显示完整性错误并可重试；失败信息去除旧运行错误重复展示。完整性错误来源仍使用真实只读接口确认：`YASHAN-4241` 声明 1 条关系但结构化接口返回 0，后端拒绝预览是预期保护；未认证 13510 页面实际停留在登录表单，真实管理员点击链路无法验收。构建成功、13510 四服务重启成功，服务健康 4/4 HTTP 200；构建产物已核对含新反馈代码。

2026-11-13T18:13:41+08:00 PingCode 停用运行恢复及慢点诊断：同步服务停用前中断活动执行并取消遗留 `COLLECTING` 运行；Jest 13/13 覆盖活动运行、重启遗留运行、异步采集和阶段日志。PingCode API 单测 7/7 断言分页、关系、详情时延字段及关系异常日志；插件 Chromium 7/7，`npm run check:ui`、Python/Node 语法、`git diff --check`、完整构建通过。13510 已重启，Storage/文档/PingCode/前端健康 4/4，页面 HTTP 200；构建前端文件与运行资源 SHA-256 一致。真实管理员会话缺失：页面重定向登录表单，来源 API 401，故没有操作共享来源配置。

真实只读 PingCode 测量基线 `Yq_yJCzT`：255 条、6 页。第 0–3 页读取 200 条，耗时 20136.8ms、20809.8ms、17338.1ms、18859.3ms；第 4 页耗时 2525.9ms 时因 `YASHAN-4241` 期望关联 1、实际 0 返回 `PINGCODE_RELATION_INCOMPLETE`，累计 79670.2ms。运行时日志明确记录第 4 页 5 次关系请求、关系阶段 706.3ms、页总耗时 2521.2ms。请求只读，没有确认预览或写入任务。用户要求全量完成 1 秒，当前架构未达标；启动回执时间不作为全量性能证据，成功全量及真实页面操作均未验收。

2026-11-13T18:20:00+08:00 PingCode 需求关系查询有界并发：保留 Python/Playwright 单 worker，新增同一认证浏览器页内最多 10 个异步 fetch worker 批量读取每页 IR→SR 关系，按输入位置返回，完整性校验和失败阻断不变；工作项详情沿用每批 10 个 Promise.all。`test_task_source_pages.py` 8/8、Python 编译与 `git diff --check` 通过。部署后真实只读复测基线 `Yq_yJCzT` 第 0 页 200、50 条、共 6 页、无限流错误，用时 16796ms；此前同页样本 20136.8ms，单页约改善 17%，但仍约为 1 秒门槛的 16.8 倍。其他页和全量差异未完成，全量 1 秒依旧失败。


### 2026-11-16T15:55:32+08:00 专业报告交付核验

本轮 smoke 24/24、入口回归48/48通过。报告 `runtime/test-results/smoke/20261116-155252-956422-smoke/report.html` 包含总览及12页明细；离线桌面/窄屏检索、详情深链、无JS导航通过，DCL P95 32.4ms/23.1ms。REA既有证据、七项内部9.5/10评分及限制见 `runtime/rea/professional-test-report/ACCEPTANCE.md`。本次未新增生成器改动或REA Evidence，未启用覆盖率。


## 2026-11-16T15:57:06+08:00 手册写作入口定向覆盖验收

固定采集器增加 `KC_FRONTEND_ISTANBUL_SCENARIO=handbook-writing-entry`，调用与全量一致的 `exerciseHandbookWritingEntry`，先验证历史工作区契约更新，定向结果仍明确 `capturedCoverage=false`。通过后重跑全部固定源码与场景；只采纳 completed/stable/inputsStable 为 true、变更列表为空的完整报告。不更改产品逻辑、覆盖分母或既有断言。

当前场景发现编辑态收到残留历史修订选择事件时处理器会重建 `history` 状态，修复为忽略无活动历史工作区的事件，并保留“返回编辑后历史状态为 null”的原断言。先执行定向浏览器验收，再运行完整固定采集；输入稳定门禁通过前不采纳覆盖率。


2026-11-16T16:15:06+08:00 前端固定采集诊断：`handbook-writing-entry` 定向通过，但完整运行 `runtime/coverage-goal/frontend-handbook-history-current-20261116-1605/` 在任务管理真实 HTTP 场景缺少 `ticket-scope` 控件而失败，采集期间源码和输入同时变化，门禁拒收所有覆盖率数字。并行任务管理变更结束后需重跑完整清单。


## 2026-11-16T16:38:13+08:00 认证 API 网络失败覆盖设计

当前有效前端基线 `runtime/coverage-goal/frontend-markdown-renderer-verified-20261116-1405/` 中 `common/api/auth-api.js` 行 20/21，未覆盖语句为 `fetch` 拒绝后转换 `AuthApiError`。固定认证控制器场景已通过真实浏览器调用公开 API，并用隔离的 `window.fetch` 为认证端点提供响应。新增 `network-error` 模式，使 `/auth/session` 的 `fetch` Promise 拒绝；直接调用公开 `getSession()`，断言错误类型、文案、`AUTH_SERVICE_UNAVAILABLE` 及原始 `details`。不更改产品代码或覆盖分母。先以定向入口确认场景及插桩计数，随后重跑完整固定清单，只接受稳定性门禁通过的结果。

伪代码：`mode=network-error -> getSession() -> catch AuthApiError -> assert code/message/details -> restore mode and fetch`。


## 2026-11-16T16:43:50+08:00 前端固定采集可见标签选择器诊断

定向 `document-task-tabs` 浏览器流程通过。完整采集上一轮 source stability 为 true，但任务管理标签切换失败；采集器已将标签/面板等待条件限定到可见元素，以适配被保留的隐藏视图节点。语法及 diff 检查通过；完整固定采集仍需重跑，定向执行不作为覆盖率计数。


## 2026-11-16T17:21:17+08:00 生产写作证据模块覆盖诊断

固定清单 61 个源文件和全部场景已执行，当前诊断为行 10629/11881（89.46%）、分支 12503/16867（74.12%）。但 `source-stability.json` 显示 `completed=true`、`stable=false`、`inputsStable=false`；`production-chat-evidence.js`、生产样式及生产写作/审核测试在运行期间变化，本结果不得作为正式覆盖率基线。认证 API 网络失败场景在此轮达到行 21/21，定向场景通过。仍需在生产写作和审核输入稳定后重跑完整固定采集；Node、Java 尚未复核当前输入及平台总门槛。


## 2026-11-16T17:34:27+08:00 生产写作证据场景回归诊断

当前全量前端采集在 `production-writing.test.cjs` 的 AI 对话证据用例失败（评价失败未通知），同时 templates 模块和测试运行期间变化，`completed=false` 且稳定性门禁拒收；日志 `runtime/coverage-goal/frontend-retry-20261116-1730/writing-cases/1794821323796-80077/writing-test.log`。同一证据场景按 `--test-name-pattern` 独立重跑通过 1/1，表明单场景可通过，完整采集并发资源/运行上下文下仍不稳定；不得采纳该轮覆盖率。待相关模板输入稳定后重跑完整清单并检查错误的偶发根因。


## 2026-11-16T17:50:38+08:00 前端完整固定采集待办

最新完整清单 61 文件与固定场景全部执行，诊断计数行 10609/11856（89.48%）、分支 12487/16789（74.37%）。`runtime/coverage-goal/frontend-current-stable-20261116-1736/source-stability.json` 显示 `completed=true`、源码 `stable=true`，但 `inputsStable=false`：`tests/e2e/agent-runner/template-workspace.cjs` 与 `tests/unit/agent-runner/template-purge.test.js` 在采集期间变更，故该次覆盖率不得采纳。固定采集连续受并行测试输入修改影响；应等模板相关变更停止后再完整复采。知识中心平台行 100% / 分支 95% 目标远未完成。

### 2026-11-16T23:40:19+08:00 专业 HTML 测试报告 REA 验收

行业能力参考 Allure（运行概览、失败证据）、Playwright HTML Reporter（状态筛选、用例定位）、ReportPortal（质量总览）、pytest-html（离线明细和日志）。真实 smoke 报告 `runtime/test-results/smoke/20261116-225521-074778-smoke/report.html` 为 2/2 任务、24/24 用例通过，含 12 个静态场景分页；入口回归 54/54。REA Evidence `ev_731687ac2d862d2edb75602a5c5b945a43c1a45e7b6bc999b83d3e924a40cecf`（1440px）和 `ev_fea73d173bda141773667c332c14dbe4147e07ff7e5193d116f16031904064a6`（390px）均完整，仅访问本机报告。离线浏览各 10 次，17 条搜索结果及用例深链、无 JavaScript 场景分页均通过；DCL P95 23.9ms/73.6ms，无页面错误、外部请求、页面横向溢出。内部量表 9.5/10，性能项保留 0.5 分扣减，非第三方认证；本轮 smoke 未采集覆盖率，不代表平台行 100%/分支 95% 目标已达成。证据及评分拆分见 `runtime/rea/professional-test-report/ACCEPTANCE.md`。

## 2026-11-16T22:27:00+08:00 PingCode 来源路由 Node HTTP 覆盖

固定 Node 清单此前缺少 `routes/knowledge-center.js` 的 PingCode 来源同步公开 HTTP 分发测试。新增 `tests/unit/agent-runner/knowledge-center-pingcode-routes-http-coverage.test.js`，经真实本地 HTTP 请求覆盖分页/详情/预览/资源读取、来源写入与状态、运行确认/取消、权限、405 和 Storage 错误映射。定向 Jest 4/4 通过。修复夹具对列表数组和异步资源重试的旧预期；空缺图列表只启动异步重试并读取资源分页，不应伪造 POST 重试写入。该定向夹具不代表路由文件或 Node 全量覆盖达标；正式增量仅由输入稳定的完整 Node 采集确认。


## 2026-11-17T10:24:08+08:00 目录树键盘导航覆盖方案

目录树公开键盘契约补测：使用真实 Chromium DOM 的两项叶节点树，验证首项 ArrowUp 与末项 ArrowDown 保持焦点、Home/End 跳转、Enter/空格触发按钮与 Escape 不拦截；使用已展开目录断言 ArrowRight 聚焦子项，使用折叠目录断言 ArrowRight 展开与 ArrowLeft 折叠。调用无参 enhanceDirectoryTrees() 验证默认 document 发现及幂等，不构造不符合当前渲染结构的父节点分支。添加 directory-tree 定向入口；通过后运行完整固定清单并核查源码/输入哈希稳定，不改变产品逻辑或分母。


## 2026-11-17T10:25:08+08:00 目录树折叠标题键盘缺陷根因与修复

新增真实 Chromium 断言证明：折叠目录标题 focus 成功，但 ArrowRight 后 open=false。根因为 isVisible 从 summary.parentElement（自身 details）查找折叠祖先，将折叠目录自身标题排除出键盘导航列表。修复从所在 details 的父级开始遍历祖先，保留自身标题，仅排除处于折叠祖先内的节点；逐级检查，防止展开子目录在折叠祖先内仍误判可见。验收为目录标题可展开、首个子项可聚焦、向左可折叠以及首末边界不越界。属于已定位局部 Bugfix，不改变业务规则或覆盖分母。


## 2026-11-17T10:37:46+08:00 目录树剩余行覆盖补测

完整 LCOV 显示目录树剩余两行是 summary 点击后 requestAnimationFrame 状态刷新，以及子节点 ArrowLeft 返回父目录。为既有固定真实 Chromium 场景补充实际点击目录标题并等待一帧、断言 aria-expanded；随后展开父目录并由可见叶节点按 ArrowLeft，断言焦点回父标题。完成定向后重新采集完整固定矩阵，只采纳 62 源文件与 1,305 输入稳定报告；若稳定证据确认目录树全部行覆盖，再按 branchMap 继续可达分支。


## 2026-11-17T10:38:14+08:00 ArrowLeft 返回父目录缺陷根因与修复

定向浏览器断言触发“向左应从子项聚焦父目录”失败。根因是 parentItem 以 li 所在列表向上查找 `[role=treeitem]` 祖先，但父目录 summary 与子节点是列表项的同级关系，summary 并非祖先。修复为从当前 li 的父列表定位所属 details，并选择其直接 summary treeitem。回归包括嵌套子项返回父目录、目录标题折叠及键盘树边界；随后执行定向及稳定完整覆盖采集。


## 2026-11-17T10:39:00+08:00 ArrowLeft 叶节点错误折叠父目录修正

首次 parent summary 修正后，定向断言仍失败。进一步确认叶节点的 `item.closest('details')` 返回其容器目录，因此旧逻辑优先折叠父目录而不是把焦点移回父项。现在仅 summary treeitem 将自身关联 details 用于展开/折叠；普通叶节点无自身 details，ArrowLeft 直接聚焦父 summary。定向 Chromium 目录树场景全部通过。


## 前端覆盖采集插桩性能（2026-11-17）

`production-writing.test.cjs` 为相同响应源码按路径和 SHA-256 缓存 Istanbul 插桩结果，覆盖计数仍逐测试隔离。真实 Chromium 三用例子集 cache 开关各三轮：插桩 CPU 中位数从2308.1ms降至870.3ms；每轮转换38→16、缓存命中22次；两种模式均3/3通过，16源码文件行/分支命中集合一致（1657行、727分支）。墙钟中位数无改善（无缓存16.36s，缓存17.65s），不宣称完整采集加速。完整矩阵最近运行输入变化或测试失败，暂无稳定端到端性能基线。原始命令输出、RSS、异常样本和回退方法见 `runtime/performance/frontend-coverage-ab/RESULTS.md`。

同一三用例集继续比较逐用例新启 Chromium 与复用进程/逐例隔离 context，各三轮均通过且覆盖命中集合相同。墙钟 P50/P95/max：新进程18.53/19.66/19.66秒；复用10.98/11.89/11.89秒，P50下降40.7%。当前采集入口默认启用进程复用；设 `KC_FRONTEND_ISTANBUL_REUSE_BROWSER=0` 回退。该结果只代表固定3用例子集，完整36用例 suite 仍需稳定全量复验。

完整写作浏览器 suite 复用模式运行结果为35通过、2项真实模型测试跳过、0失败，墙钟171.79秒，产生35份覆盖快照。当前没有同一输入版本下逐用例新进程的完整 suite 对照；近期快照输入有变化且相差18行/4分支，故不把3用例 A/B 收益外推到全 suite，也不宣称覆盖逐位一致。


## 2026-11-17T15:08:51+08:00 前端覆盖采集浏览器插桩性能基线与方案

性能基线取自当前本机隔离的同一真实 HTML/HTM 上传用例（来源类别：测试执行时间，不是 API 业务时间）：`WRITING_LIVE_MODEL=0 KC_FRONTEND_ISTANBUL_CASE_DIR=runtime/performance/frontend-coverage-baseline/html-local node --test --test-name-pattern='本地 HTML/HTM 参考文档' tests/e2e/agent-runner/production-writing.test.cjs`，`/usr/bin/time` 总墙钟 111.99s，浏览器用例 duration 67.98s；不启用 coverage env 的相同命令用时24.75s，浏览器用例13.65s。业务日志 authorization 接口两次约6ms，样本仅单次且主机并发状态未记录，故为探索性对照，不声称正式性能收益。既有固定完整采集曾用约11分54秒且有运行输入变更，不作为稳定成功基线。

检查调用链后，`production-writing.test.cjs:launch()` 在每条隔离用例中重新启动 Instrumenter；每次页面加载的 JS route 又对相同静态 JS 响应重复 `instrumentSync`，覆盖注入代码及每测试独立浏览器 context 可以保留，但静态变换可按文件路径和源内容 SHA-256 缓存。实现后以真实多用例 browser suite 同口径比较 wall/user/system 时间、转换次数、命中次数及目标行/分支计数，并执行无插桩定向用例回归。缓存只存在单个 Node 测试进程，源码内容改变即重新插桩，不改变被测产品和覆盖分母。完整矩阵稳定复跑后再判定端到端采集收益；由未参与实现者独立验证前，不声称独立验收。


## 2026-11-17T15:21:58+08:00 覆盖测试 Chromium 启动成本测量方案

现有覆盖测试 `launch()` 每个测试启动完整 Chromium 进程，且每次用完即关闭；该调用链可量化浏览器启动、fixture API 准备、页面初始化、coverage snapshot 和关闭阶段。先增加仅由 profile 环境变量启用的阶段计时。在确认多个独立 test 使用 `browser.newPage()` 默认各自拥有独立 BrowserContext 后，A/B 比较逐测新进程与进程内复用 Browser、逐测关闭 context 的路径。只有真实用例结果及 Istanbul 行/分支命中集合相同，且同机交替复测的墙钟与浏览器启动阶段都显示收益，才在固定覆盖运行默认复用；可通过 env 回退逐测启动。
