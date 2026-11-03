# 仓库测试入口

Agent 管理回归 `node --test tests/e2e/agent-runner/platform-agent-management.test.cjs` 覆盖真实隔离 HTTP、设置页多桌面尺寸首屏几何、窄屏溢出、模型与 MCP 面板关闭及局部保存、Agent 保存回读。截图仅为证据，首屏位置由明确断言检查。

质量检查隔离修复的覆盖率回归：`yashandb-quality-adapter.test.js` 使用本地真实 HTTP 服务验证适配器请求、凭据边界和版本来源；`outline-storage-java.test.js` 的 `QualityExecuteHttpCheck` 使用真实 Java HTTP 端点与 JDBC 替身验证独立连接、只读标记、SQL 拒绝、异常和结果上限。设置 `QUALITY_JACOCO_DIR="$PWD/runtime/test-results/quality-fix-coverage"` 后运行对应 Jest 用例，会用该目录下的 JaCoCo 0.8.12 agent/CLI 生成 `java.xml`、HTML 和 `java-summary.json`，并对 `Main.qualityExecute`、`Main.qualityResult` 的指令、行、分支覆盖率分别执行 90% 门禁。Java 覆盖率限定为这两个变更方法，JDBC 替身不代表真实 YashanDB 集成验收。

Jest 桥接文件即使模拟 `node:test` 也由 Jest 执行，统一入口优先识别显式 `jest.*` API。`frontend-coverage-summary.test.js` 看护 V8 嵌套区间去重和未执行分支扣除；采集器保留原始偏移量，范围覆盖率不能当作行覆盖率。具体计算约束见 [测试报告设计](TEST_REPORT_DESIGN.md)。

审核工作台回归覆盖真实 HTTP 改派审核人、个人待办转移、误提任务终止及审计保留；浏览器用例覆盖文档清单弹窗操作。写入型 E2E 使用 `python3 tests/run_tests.py e2e` 的隔离实例，不对共享审核任务执行改派或终止。

审核工作台真实 HTTP 回归还覆盖人员 ID 到审核人姓名的解析、实际决定者展示，及旧原文在线审核送审与旧任务发布均返回 `GITLAB_NO_CHANGES` 且保留历史。新在线评审的已保存修改稿由隔离 HTTP 和浏览器验证送审、审核与 MR 提交；无差异新稿在送审时返回 `GITLAB_NO_CHANGES` 且不创建任务，历史已审核任务保持原状态。

审核工作台回归由 `review-workbench-contract.test.js` 和 `knowledge-center-review-workbench.spec.js` 看护：阶段与权限过滤、明确指派、自审资格、冻结正文、整册聚合评审、文档与路径配对、共享候选、失败重试、下一篇及返回筛选。“我的审核”指派人列显示提交指派者；审核人姓名在文档清单核对。契约测试真实调用隔离 HTTP 后端；浏览器使用独立内存仓储和 GitLab 只读测试服务，在 Chromium/Firefox 验证，不提交真实 GitLab MR。原 `knowledge-center-review-publishing.spec.js` 继续看护评论、发布及响应式历史功能。性能门禁分别测量默认手册工作台与显式阅读入口，并检查工作台不提前请求仓库正文。

隔离 HTTP 的 `handbook-incremental-review.test.js` 使用真实网关与模拟 GitLab 回读项目、源分支、目标分支、MR IID 和 changes，同时覆盖无差异任务保留、目标提交漂移及失败重试。真实 GitLab 验收还须在已授权的读写连接和映射测试文档上回读相同事实，候选必须有非空差异。当前送审契约只产生 create/update 文件动作；删除文档不计入本轮验收。

托管图片交付回归：`node --test tests/unit/agent-runner/gitlab-managed-resource-delivery.test.js tests/unit/agent-runner/handbook-incremental-review.test.js`。新增套件通过真实本地生产 HTTP handler 和 GitLab HTTP 替身，覆盖上传/保存/来源权限/送审/审核/发布/模拟合并后回读，服务端冻结抵御客户端伪造、同源任务重放、原文件删除、冻结快照缺失/损坏，以及共享图片去重和提交响应丢失后的幂等恢复。检查失败时保留已审核状态且无远端写入。HTML/Markdown 改写保留代码示例及周围正文。测试入口按 `node:test` 自动分类，不交给 Jest；不是数据库模式、共享13510实例或企业 GitLab 验收。

现有送审浏览器回归显式使用 `HANDBOOK_BROWSER_CHECK=1 node --test tests/unit/agent-runner/handbook-incremental-review.test.js`；它验证本地 Chromium 的保存与送审/审核入口，不覆盖本次托管图片拖拽上传 UI 或实际企业合并。两类证据分别记录，不能把 HTTP 流程表述为图片浏览器端到端通过。

`outline-import-api.test.js` 使用隔离文件仓储和真实 HTTP，覆盖自然路径候选内容说明保存、清空、目录保存后的投影一致性，以及非法节点拒绝。`outline-natural-path.test.js` 直接读取受版本控制的 `knowledge/outlines/SQL参考手册大纲示例.xlsx` 校验 501 篇文档的路径、顺序、说明、领域和任务，不依赖本地 `documents/` 源文件。

`outline-detail-performance.test.js` 验证大纲详情的 catalog 快速路径、候选/空手册/不存在/失败状态，以及隔离真实 HTTP 精简与完整响应兼容、异步 Storage 等待不阻塞 Worker。`knowledge-center-outlines-layout.spec.js` 验证 SQL 参考手册加载提示和领域任务延迟时的首屏可用性，页面测试只读，不修改已有大纲。空手册用例还验证模板填写说明关闭后焦点返回入口；工作台主滚动用例先在页面内制造足够内容，再检查侧栏固定与右侧独立滚动，避免依赖当天业务数据量。

大纲页面回归还覆盖导入面板的外部点击与 Esc 收起、内部交互不误关、选中文件保留及收起期间真实校验请求继续完成；包含桌面和窄屏。校验不创建候选，测试不提交真实导入。

`tests/unit/agent-runner/knowledge-center-close-controls.test.js` 检查知识中心及同源独立工作台关闭 X 的图标来源、可访问名称和公共样式边界；实际尺寸与颜色仍需在浏览器计算样式中复核。

`gitlab-oauth.test.js` 看护 OAuth 授权、令牌与刷新流程，以及 HTTP 开关的新旧兼容、RFC1918 私网边界、默认 HTTPS、公网 HTTP 和其他协议拒绝。

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

`unit`、`e2e`、`smoke` 的每次非 dry-run 运行还在同一批次目录生成中文 `report.html`，可离线打开；展示运行汇总、任务统计、失败项和任务日志链接，不展示逐条成功用例。历史批次保持原样。报告契约见 [TEST_REPORT_DESIGN.md](./TEST_REPORT_DESIGN.md)。

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

`incremental-read-performance.test.js` 通过真实 HTTP 验证 Storage 等待不阻塞网关、逐请求新快照、详情与差异异步读取及权限保留；与 review-workbench-contract、incremental-build-api 和源码性能门禁共同执行。`tools/repository/profile-knowledge-center.cjs` 是独立只读浏览器审计，需显式 KPG_BASE_URL，输出冷/暖刷新、侧栏切换、个人生成、审核正文、资源、长任务和接口状态。KC_PERF_CPU_RATE 控制 CPU 降速，KC_PERF_CHECK_BEHAVIOR=1 检查标签延迟请求及 context 刷新保留正文；接口失败/仓库失败/页面错误均判失败。旧独立生成器只测外壳，不能计为业务就绪。该审计不替代既有性能门禁和统一隔离写入型 E2E。

AI 生产补充验证：`production-ai-service.test.js` 验证人工采用及后续保存保留生成元信息、旧依据失效；`handbook-production-api.test.js` 通过隔离 HTTP/MCP 与 Chromium 验证资料拉取预览、显式勾选、冻结来源传给模型、上下文隔离、来源地址限制、重定向及读取错误。真实 MCP 只读探测证据位于 `runtime/test-results/production-ai-sources/real-source-result.json`；隔离来源测试不等于 PingCode、用例库或真实模型验收。

阶段 HTTP Adapter：`production-ai-http-stage-adapters.test.js` 通过本地真实 HTTP 服务覆盖非 2xx、超时、非法 JSON、1 MiB 响应上限和非法部署配置；`handbook-production-api.test.js` 验证服务端冻结 envelope 经 Planner HTTP Adapter 传递。Fixture 不构成目标环境独立 Agent 部署验收。

AI 续写 Skill 验证：`production-ai-service.test.js` 覆盖新增登记、操作适用性、重复与过期选择拒绝、执行内容冻结、幂等及采用追溯；`handbook-production-api.test.js` 通过真实 HTTP 和 Chromium 选用实际能力包资源，验证指令进入模型消息、候选保留范围外原文及保存回读。证据写入 `runtime/test-results/production-ai-skills/`。模型为隔离替代实现，不能代替真实模型和完整平台验收。

AI 来源确认检查同一定位符的内容版本冲突：旧新快照同时勾选返回409，取消旧版本后可重试；旧任务依据保持冻结。真实HTTP回归包含该场景，完整外部来源验收仍独立要求。


PingCode AI 引用验证：`test_pingcode_reference.py` 覆盖空间归属、定位符、真实正文解析器、版本元信息与 API 错误脱敏；`handbook-production-api.test.js` 新增设计/测试来源、固定内部路径、空间范围、错误正文及大小上限、浏览器预览勾选与冻结引用测试。证据位于 `runtime/test-results/production-ai-pingcode/`；`real-reference-probe.json` 和 `real-node-adapter-probe.json` 为真实 PingCode 只读调用证据，浏览器测试仍使用隔离来源和模型，不能视为完整平台验收。

PingCode 引用契约测试命令：`PYTHONPATH=apps/pingcode-api python3 -m unittest discover -s tests/unit/pingcode/web-backend -p 'test_pingcode_reference.py'`。测试会校验共享正文解析器、空间成员边界、页面元数据一致性和错误脱敏。

真实来源连接器复验可执行 `PRODUCTION_AI_PINGCODE_REFERENCE_URL='https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/67768231ea9f2a28709356bc' KNOWLEDGE_CENTER_PINGCODE_API_PORT=18010 node tools/repository/probe-production-ai-sources.cjs`。脚本复用 `ConfigManager`/`MCPClient` 真实查询并读取知识库 MCP，再经 PingCode 只读 reference API 读取指定页面；仅记录来源定位符、长度与 SHA-256，不输出正文或凭据。可用 `PRODUCTION_AI_SOURCE_PROBE_OUTPUT` 指定证据文件，产物必须放在 `runtime/`。本命令验证连接器直连，不绕过知识中心 API 的 CAS 和 `productionAI.sources` 授权门禁；因此不代替平台来源预览验收。

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


## 平台管理 MCP 服务验证

`tests/unit/agent-runner/mcp-governance.test.js` 使用 runtime 隔离配置、真实 ConfigManager 和实际 HTTP MCP fixture/平台 handler，验证加密与跨进程回读、凭据合并/清除、地址切换保护、字段校验、并发冲突、管理员权限、JSON/SSE 协议/错误/超时，以及原生成器客户端和 AI 来源共享配置。

`node tests/e2e/agent-runner/platform-mcp-management.cjs` 使用已安装 Playwright，启动隔离真实后端与 MCP fixture，验证表单、工具目录转义、测试不保存、凭据不回显、冲突恢复、清除与360px布局；结果及截图在 `runtime/test-results/platform-mcp`。该脚本不写真实配置、不访问企业 MCP，不能作为企业集成已通过的证据。

## 文档生产离线盲评工具

运行 `node --test tests/unit/agent-runner/production-ai-blind-eval.test.cjs`，覆盖匿名字段分离、完整评分、缺测计量、Unicode 范围、CLI prepare/summarize、0600 文件权限、拒绝覆盖和符号链接越界。临时产物在 runtime/ 下创建并于测试结束清理；该测试不调用模型，不产生真实质量评测结论。


PingCode 资料输入回归包含于 `production-writing.test.cjs`：真实 HTTP 与 Chromium 验证完整页面网址/短标识、来源及空间边界、资料错误不误报账号权限、失败后重读。上游为隔离本地 PingCode 响应，不代表企业服务可用性验收。

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
