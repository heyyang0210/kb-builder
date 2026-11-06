# 统一测试入口 HTML 报告设计

2026-11-05T23:20:12+08:00 全平台固定覆盖率复采：运行 `python3 tests/run_tests.py full --coverage --jobs 1 --timeout 1800`，固定 154 个 Node、56 个浏览器脚本和 9 个 Java 产品源码均纳入分母。Node 行 13765/15936（86.37%）、分支 12676/18043（70.25%）；浏览器脚本行 5320/9786（54.36%）、分支 5754/13460（42.74%）；Java 行 2882/3360（85.77%）、分支 1585/2178（72.77%）。统一回归 76/78 任务成功，两个真实 Playwright E2E 任务合计 19 个失败，故最终覆盖率门禁为 FAIL，不能宣称达标。完整证据位于 `runtime/test-reports/2026-11-05/20261105-232012-294204-full/`；后续按固定报告最低文件排序补充真实行为场景，保持源码清单和采集口径不变。

2026-11-06T00:00:32+08:00 固定 Node 清单续作：在 `vector-and-graph-index.test.js` 中验证 `DocumentClassifier.classify`、`DocumentFilter.evaluate` 的抽象错误契约，以及 `classifyAll`/`evaluateAll` 的异步顺序委托和空输入。定向 Jest 9/9 通过，两份契约源码行和分支均达到 100%；固定 Node 源码总量未改变。隔离 E2E 定向执行手册工作台 spec，结果 13 通过、4 条条件跳过、0 最终失败；一个 Firefox 草稿保存场景首次等待超时、重试通过，报告 flaky，后续需继续定位。审核工作台优先级标记断言现在分别核对显示文本 `01` 和无障碍名称 `优先级 1`。本轮未重采全平台，原固定覆盖率总数仍是上一份报告，目标未达成。

固定 Node 清单回归维护：侧栏主导航图标契约应与已确认的方案 C 一致，展开态为 `panel-left`、折叠态为 `panel-left-open`；公共可调目录控制器仍使用自身图标契约。浏览器与真实 HTTP 混合的来源证据用例设置明确的 90 秒上限，超过上限仍判失败。来源 URL 的 DNS 与非公开地址拒绝规则不因夹具偶发失败放宽；用定向及完整桥接运行定位上下文干扰。

Node 覆盖补充基础接口与模型输出解析：固定 Jest 覆盖任务调用 `GraphStore`、`VectorStore` 的每个未实现方法，验证明确失败契约；`EmbeddingProvider` 验证未实现 getter/方法、批量委托失败与子类批量结果。模板匹配模型输出解析通过同一 Jest 进程验证普通 JSON、markdown 信封、代码围栏、JSON 语法错误及字段类型错误，使该产品模块进入 Istanbul 实际计数。验证先运行对应 Jest 套件，再运行固定 Node 覆盖采集；不得通过更改分母或忽略未执行语句提高计数。

同步领域存储适配器覆盖矩阵：在独立 Worker 线程启动本地真实 HTTP 服务，以便主线程的 `curl` 同步请求能实际收发；从回显响应检查产品 `DomainStore` 对人员、手册、大纲、建设任务、平台权限、GitLab 等接口的请求方法、编码后的路径、查询筛选、JSON 正文、`If-Match` 与幂等键。再通过真实 HTTP 错误信封验证业务错误码/状态/详情映射，并以不可达端口验证连接异常。响应夹具同时提供含 `data` 与无 `data` 的成功信封，验证返回值契约。伪代码：`startWorkerServer(); for operation in contractMatrix: invokeSyncAdapter(); assert(observedRequest, returnedData); assert(domainErrors); stopWorkerServer()`。该测试不修改产品接口，也不以纯方法 mock 代替真实后端 API。

同一 HTTP 夹具继续检查剩余异步适配方法：目录、治理、CAS 用户、角色、GitLab 连接与映射等读写都经实际 `fetch` 发送，断言编码路径、正文和条件头；带元数据方法同时核对 `Server-Timing`。按后端错误信封驱动各类公开错误码的 HTTP 状态映射，避免仅调用内部映射方法形成覆盖数字。验收以完整固定 Node 清单为准，保留产品源码分母。

领域适配器原始成功信封兼容性：Worker HTTP 服务通过测试进程消息切换为不含 `data` 的合法成功信封，逐个同步/异步调用已定义的产品方法，断言返回的 `success` 和实际回显请求；在 `finally` 恢复默认响应模式。该场景检验服务升级或旧版本响应形态，不降低原成功信封断言；错误码矩阵继续覆盖具体公开状态类别。

边界响应再验证空成功正文、缺少错误字段的 HTTP 失败以及缺少 `Server-Timing` 的成功响应，检查适配器给调用者的默认结果和状态。无筛选参数读取、默认写入正文与默认构造参数通过真实 HTTP 或配置结果断言，覆盖公开方法的缺省调用约定。

文档路由 `/generate` 增加隔离真实 HTTP 场景：本地应用挂载实际 Express 路由，配置的 `output` 根和元数据仅指向测试临时目录；模型配置与模型输出由确定性替身提供。验证缺少 prompt、未配置密钥、成功生成正文和元数据版本回读、文件名非法字符清理、越界 `output_path` 拒绝且不写到根目录外。失败响应由实际 HTTP 获取；测试结束恢复模块 mock 与环境，清理临时目录。伪代码：`post('/generate', payload); assert(status, outputFile, metadata); rejectTraversal(); assert(noOutsideFile)`。

显式子目录与文件名另走一次真实生成请求，确认目录创建和保存后的 HTTP 内容回读；模型用量为空时仍应返回零，避免把缺失统计当成生成失败。

文档上传预处理生命周期：在 `runtime/test-results` 下建立隔离临时运行根，真实 HTTP multipart 上传 Markdown，验证标题/章节解析、列表与详情一致、删除后列表/详情及产物文件均消失。异常矩阵覆盖无文件、格式拒绝、缺失详情和重复删除。删除操作使用列表中实际持久化的产物文件名定位文件；若测试揭示字段缺失，应补产品存储投影并更新文档路由设计契约，不得仅放宽断言。

文档搜索与目录统计继续使用同一隔离真实 HTTP 路由：临时目录中放入正文重复命中、标题命中、二进制文件、隐藏目录和 `node_modules`；验证全文结果每文件最多三处、标题模式不读取正文、非文本文件不读正文、隐藏目录与依赖目录不进入搜索/列表/统计。默认及非法排序参数应返回稳定列表；总文件数和大小由实际可见文件计算。所有夹具位于本次隔离运行根，结束时清理。

原样预览的路径边界通过真实 HTTP 请求验证：已注册根内文件返回原始字节与 `nosniff`、内联预览头；未知根、目录、缺失文件、双重编码遍历、无效百分号、NUL 和指向根外文件的符号链接返回 404。已注册根内的 HTML 和点文件仍可按契约预览；测试中的根外目标只存在于本次 `runtime/test-results` 隔离根。

文档评论错误与恢复：对真实存在的隔离文档，经 HTTP 验证非字符串引用文本被拒绝；将隔离评论文件临时改为非法 JSON，验证列表、新增和删除均返回明确 500，再恢复有效版本并确认后续创建与读取成功。对不存在文档的评论操作仍返回 404。测试在 `finally` 恢复隔离文件，防止状态污染其他用例。

文档 ID 与缺失文件边界：以根外路径编码、未创建文件编码和只读文件编码分别请求详情、正文、下载与删除，断言 404/403 契约；不存在版本历史返回空列表。真实 HTTP 请求用于验证路由顺序与错误状态，不直接调用解码 helper。

文件模式配置与元数据损坏降级：只修改隔离 `runtime/test-results` 临时目录中的服务路径配置和文档元数据。配置非法 JSON 时 `/paths` 应返回默认 output 根；元数据非法 JSON 时已有正文仍可由详情/列表读取，元数据字段按文件状态回退，token 汇总为零。恢复原文件后，标题和 token 统计应重新出现。所有临时改写放在 `try/finally` 中恢复，避免跨用例污染。

上传预处理列表元数据采用独立文件；在隔离目录把该文件临时写为非法 JSON，经真实 `/preprocess` 列表 HTTP 请求验证回退为空，再恢复有效文件并确认服务继续响应。配置文件缺失时 `/paths` 仍应返回默认 output 根。

直写执行日志独立验证文件名清理和 Markdown 内容：使用内存 `file_writer` 工具替身捕获实际写入参数，分别输入完整元数据与缺省字段，断言任务 ID 仅用于日志文件名时被规范化、正文仍保留原任务 ID、覆盖写选项和参考文件列表/空列表回退。该模块无 HTTP 入口，使用公开函数与写入契约验证；完整 Node 清单仍计入原固定分母。

检索代理的工具协调使用确定性 MCP 与文件读取替身验证公开 `execute` 的先检索、后模型顺序，并通过 `_retrieveContent` 核对成功结果、逐项失败、工具整体异常、无工具管理器的输出和详情事件。提示词检查执行计划的完整与缺省字段、已检索内容与等待提示；真实模型调用由确定性响应替身隔离，固定 Node 清单保留代理源码全部行/分支。

文档路径管理继续使用既有隔离真实 HTTP 夹具：对新增路径验证必填项、目录存在性、仓库相对路径解析、缺省只读、显式可写及成功回读；对删除验证默认根保护、缺失 ID、成功删除及配置文件更新。对配置缺失和 `documentPaths` 非数组输入核对默认结构，对非法 JSON 分别触发新增/删除的 500 响应；`finally` 恢复原文件后再确认列表正常，避免状态污染。接口与文件读写真实执行，固定 Node 分母不变。

大纲领域任务文件模式使用现有隔离 HTTP 夹具：先经产品仓库创建候选，再写入一条带页面项的隔离任务事实；真实请求 `/tech-domains`、`/build-tasks`、`/build-tasks/:id` 和页面负责人 PATCH，断言列表/详情、缺失任务或页面 404、指派姓名与状态回读、清空指派回到未分派。技术领域配置写入隔离 `runtime` 根，测试结束恢复环境变量。只对夹具状态写入，不修改共享资产或生产业务规则。

大纲提示词生成经同一真实 HTTP 入口验证请求必填、未知大纲、未匹配知识点、旧版章节知识点与新版路径节点两种来源，检查合并输出和逐条来源 ID。保存提示词到文件的现有实现指向包目录，当前测试不触发该选项；后续需把产品写入根改为 `runtime` 后再验文件生命周期，不能为了覆盖率向源码目录写运行产物。

前端 `app.js` 移动导航与侧栏状态在隔离真实 Chromium 页面验证：390px 下打开菜单后主内容不可交互，关闭按钮、遮罩及 Escape 均能收起并恢复焦点；侧栏收缩/隐藏/恢复更新可访问名称与持久化值，窗口变宽后移动菜单状态清理。页面文档级键盘处理还验证生产手册行 Enter、大纲页签左右/Home/End、上下文菜单 Escape 的焦点恢复和信息抽屉 Escape 关闭。会话失效事件应回到登录态并显示原因。浏览器场景沿用审核夹具的实际静态模块与认证 HTTP，只在页面本地存储操作；采集器将该场景计数加入同一固定前端源码分母，预期审核页面计数为 15 个。

同一页面在会话失效前构造仓库映射表单 DOM 与内存目录投影，使用产品文档事件处理器触发语言切换、目录展开/收起、搜索命中与空结果、中文及英文目录选择和标签移除。断言树节点层级、所选语言、预览和空状态的真实 DOM；不写入 GitLab 映射或平台业务数据，仍归入同一审核页面计数文件。

同一页面扩展应用级键盘契约：生产手册行按 Enter 激活，大纲页签按左右键、Home 和 End 转移焦点并调用页签点击，显示中的大纲上下文菜单和信息抽屉按 Escape 关闭并恢复焦点。使用最小 DOM 夹具触发产品应用已注册的事件监听器，断言实际点击与可见状态；不通过直接调用未导出的应用内部函数构造覆盖数字。

平台模型治理继续通过真实本地 `/knowledge-center/api/platform/models`、`/platform/models/test` 和 `/production/models` HTTP 入口执行产品治理服务，配置管理器只使用隔离内存持久化，模型探测使用确定性 Client。矩阵覆盖旧单模型兼容目录与密钥掩码、管理员鉴权、版本冲突、服务字段和地址/数值边界、临时 ID 重复、默认模型必须可用、保存后公开目录、旧密钥保留/清除及目标改变、探测成功/空响应/鉴权/超时/限流失败。断言实际 HTTP 状态、错误码、持久化版本和公开响应不泄露 API Key；服务的 `resolve` 公开函数另核对缺省、显式选择和过期版本。伪代码：`server(realHandler(realGovernance(memoryManager, deterministicProbe))); getVersion(); put(valid); getCatalog(); getAvailable(); postProbe(); assert(status, errors, persistedState, secretRedaction)`。不连接外部模型服务，也不改变产品配置路径或固定 Node 分母。

平台运行上下文网关补充公开清洗和只读投影边界：用真实本地 HTTP 响应验证非对象品牌、图标、能力/工作区/连接器字段的降级与布尔规范化；事实投影验证超大响应、HTTP 错误、非法 JSON 和超时的错误码；六类摘要分别覆盖 `items`/`data` 两种批次格式、运行中状态计数、数据集最新版本、索引字段别名、文档字段别名和大纲缺省值。断言聚合状态、分区错误和不把缺失统计伪造成零；仅使用公开 `fetchProjection`、`sanitizeContext` 和 `loadPlatformProjection`，所有 HTTP 服务在测试结束关闭。

审核仓库上下文继续复用既有隔离 GitLab 同源 HTTP 夹具及已配置的手册映射：登录阅读者请求 `/knowledge-center/api/review/repository-context?handbookId=DB-001`，断言手册名称、允许的分支/语言、目录树、默认 Markdown、提交号及 `Server-Timing` 分阶段指标；对未映射语言和未启用分支断言公开错误码。另让本地 GitLab 对目录根内显式请求的缺失 Markdown 返回 404，断言上下文仍保留目录和 200 状态，文件错误由公开投影呈现。未登录、缺失手册场景由同一套件已有用例覆盖。上游 GitLab 仍为本地只读服务，不向真实仓库写入。

GitLab OAuth 回调验证仍使用同一隔离同源前端与本地 GitLab：管理员建立 `user_oauth` 连接，普通阅读者经实际 `/oauth/start` 获取 state，本地 GitLab `/oauth/token` 返回测试令牌，阅读者经实际 `/oauth/callback` 完成授权并自动检查分支。断言 302 回跳保留应用路径/片段且带连接 ID 与 verified 状态，`/oauth/status` 和管理员连接投影可回读已连接/已验证信息；本地 GitLab 记录令牌交换和分支请求。测试令牌仅存于隔离进程，不输出到页面或报告。若分支检查失败，回调仍须回跳并标记 failed；这一路径与成功回调分别验证。

应用级表单输入边界继续使用审核夹具的真实 Chromium 页面和产品 `submit` 监听器：空小组名称提交后显示必填反馈且不发出创建请求，未选择 Excel 文件的人员导入显示文件提示且不发出预检请求，缺失待更正上下文的 CAS 更正提交关闭对话框。每个 DOM 夹具在断言后移除；此矩阵只验证本地校验，不把未调用的后端算作接口验证，也不新增浏览器页面计数文件。

`tests/run_tests.py` 的 `unit`、`e2e`、`smoke` 每次非 dry-run 运行在独立批次目录写入 `report.html`。浏览器直接打开该文件，无需服务或额外依赖。既有 `report.md`、`details/report.json`、任务日志和退出码保持原有契约。`full`、`gate` 的正式归档不新增 HTML。

## 数据与流程

`details/report.json` 是 HTML 唯一数据源。测试执行结束后先保存 JSON，再将其读回渲染 HTML；测试失败也走同一路径。`--dry-run` 不生成报告。历史批次不补生成 HTML。

渲染器使用标准库生成自包含中文页面：总览展示命令、结论、时间、耗时、任务成功数、测试文件数与用例通过/失败/跳过数；任务表展示状态、分类、框架、文件数、用例数、耗时及日志链接；失败项按任务归组。缺失用例统计显示“未统计”，不得推断为零。所有动态文本转义；日志链接仅接受批次内 `details/tasks/` 下的相对路径，异常路径退化为纯文本。

## 验收

隔离临时目录覆盖三类报告、成功/失败、缺失统计、无日志、HTML 特殊字符和异常日志路径；通过一次真实 smoke 运行确认生成入口、JSON 结论与日志链接。

## 测试运行器与浏览器覆盖率边界

### 知识中心管理平台覆盖率目标口径（2026-11-04）

目标为产品源码行 100%、分支 95%。验收对 Node 后端、管理平台浏览器脚本和 Java 存储服务分别固定源码清单与排除规则，使用对应工具的真实行/分支计数，并报告每种语言的分子、分母和失败文件。不能将 Jest 已执行文件覆盖率、Chromium V8 范围覆盖率或单个方法的 JaCoCo 结果直接当作全平台结果。测试失败时覆盖率数据只作诊断，不形成达标结论；新增源码必须自动进入分母，不能通过缩小采集范围提高比率。统一入口分别采集并门禁 Node、管理平台浏览器脚本和 Java 存储源码；完整验收仍要求所有用例通过且三个运行时分别达到目标。

Node 分母固定为 `packages/agent-runner-core/{lib,routes,middleware}/**/*.js`、`apps/knowledge-center-api/server.js` 和 `apps/knowledge-center-web/frontend-server.js`，通过 Jest `collectCoverageFrom` 收入未执行文件。覆盖率专用 Jest 配置将 `rootDir` 设为仓库根目录，避免测试目录之外的未执行源码被 Jest 忽略；测试执行仍只接收统一入口分类为 Jest 的精确文件列表。报告中的 `scope` 明确三个运行时，且汇总分别记录文件数。伪代码：`run(jest, browserIstanbul, javaJacoco); for each runtime verify source manifest and exact line/branch counts; pass only if every test and every runtime target passes`。

Node 质量门禁补充确定性单元测试：注入临时规则文件验证配置解包/直通和读取异常回退；对关键词、MCP 查询、文档生成与完整性四类门禁逐项触发通过/失败、重试和降级属性，并核对工厂未知门禁错误。测试不会改写产品配置，固定 Jest 全部 Node 分母照常验收。

预处理公共契约的固定 Jest 用例直接验证 `DocumentClassifier`、`DocumentFilter` 未实现方法的错误信息，以及 `classifyAll`、`evaluateAll` 对空数组和多文档的逐项异步委托、结果顺序；使用确定性子类记录调用顺序，不触发外部服务。该场景将此前仅执行模块加载的两个契约文件纳入实际行计数，并保持固定 Node 源码清单不变。

预处理契约续验覆盖 `OfficeRenderer.isAvailable/render` 和 `SearchIndex.build/search` 的默认拒绝行为；`ComparatorAgent` 用完整与缺省执行计划检查必填校验、知识点回退值、章节为空/缺失/空结构的提示词投影、固定输出格式和响应解析。测试直接调用产品类，不调用外部模型、不改变固定 Node 源码清单。

各运行时门禁从 `config/knowledge-center/coverage-targets.json` 读取目标，按精确计数判定；失败时保留分子、分母、未覆盖文件和诊断。前端 Istanbul 采集器对 `apps/knowledge-center-web/frontend/knowledge-center/**/*.js` 建立固定分母并排除 vendor，在隔离真实 HTTP 服务中给静态模块注入计数器、登录并导航九个一级模块，使用 Istanbul JSON summary 汇总行与分支。九个一级导航之外，依次点击模板编辑/适用文档、任务列表/流程流转/任务配置、文档生产的手册/版本/任务/生成视图，以及平台管理的系统治理、人员/团队小组、用户权限、GitLab、Agent 与模型服务；资料加工页打开并关闭上传弹窗。每次断言相应页签的活动状态、面板或弹窗状态，入口缺失即失败。伪代码：`for view in navigation: activate(view); assert active; for tab in supportedTabs[view]: click(tab); assert selected(tab) && panelVisible(tab)`。这些同页交互保留一个浏览器上下文的计数，不跨页面重载；采集结果仅代表实际触发路径，不把未执行分支当成通过。

现有 `production-writing.test.cjs` 的隔离内存草稿与真实 HTTP/Chromium 场景可在覆盖率模式下对同一批产品模块注入 Istanbul。每个测试上下文关闭前保存原始覆盖计数到本次运行独有的 `runtime` 目录；采集器等待 Node 测试进程成功退出，逐个核对文件路径属于固定前端源码清单，再用 Istanbul coverage map 合并。动态 `about:blank` 资料预览页在路由拦截模式下会停住懒加载图片请求，因此单独以无注入浏览器运行该预览用例，验证图片实际渲染；注入模式对同一真实 HTTP 图片端点验证响应类型和内容，继续执行来源优先级与生成任务断言。审核工作台的隔离 Playwright 场景也在每次主文档导航前后保存页面计数，通过临时配置仅执行指定审核 spec 和 Chromium 项目，避免共享环境守卫并行接管；计数只在套件成功后合并。另在同一隔离真实 DOM 会话中执行锚点模块的重复文本定位、上下文消歧、Markdown 多节点选区、高亮、旧行号回退和删除操作映射断言；生产质量弹窗经真实浏览器调用隔离服务的质量报告 HTTP 路由，断言内容检查开关、报告分项/引用/限制渲染、失败后重试、复测关联、JSON 下载与关闭焦点恢复。任一套件失败或计数文件缺失时采集失败，不能只合并通过场景。伪代码：`runImagePreviewE2E(uninstrumented); runWritingE2E(instrumented); runReviewE2E(instrumented, chromiumOnly); runReviewAnchorDOM(instrumented); runProductionQualityDialog(instrumented, isolatedHttp); assert(allExitZero && caseCoverageFiles>0); for caseCoverage: assert(paths in manifest); coverageMap.merge(caseCoverage)`。真实模型条件用例仍单列跳过，不作为达到行/分支目标的前提。

手册生产工作台渲染补充隔离 Chromium DOM 场景：动态导入产品 `handbook-view.js`，以带目录和责任人的大纲投影驱动完整页和编辑器区域，检查无效/受限入口、空正文与 Markdown 正文、目录过滤、草稿加载和保存状态、审核状态、模板格式、历史和冲突弹窗。另动态导入 `production-ai-dialog.js` 验证兼容入口缺省与显式选项；以隔离 HTTP 回应覆盖 MR 参与人加载成功、映射不完整、服务失败、提交和取消；仪表盘通过完整/不可用/空的领域任务投影检查摘要、人员去重和任务详情。小型工具路径还验证 SHA-256 原生 SubtleCrypto 与纯 JavaScript 回退结果、数据变更事件的范围规范/非法事件/订阅清理，以及资料加工 API 的四路工作台读取、索引失败降级和上传会话/文件/分片/完成/批次写入请求。输入是明确的投影和 UI 状态，不替代写作套件的真实草稿 HTTP 交互；每组状态均断言真实 DOM 或隔离 HTTP 请求，计数沿用固定前端源码清单与审核套件失败即拒绝规则。

覆盖率场景继续为 `production/view.js` 增加隔离 Chromium 投影矩阵：动态导入生产视图，以 URL 阶段和视图、增量任务状态/能力、来源/目标/检查/审核/交付投影、我的生成、已发布大纲与资产目录驱动真实 HTML，再将代表状态挂载到 DOM。覆盖任务列表及详情阶段、完整性和发布门禁、按文档审核、手册汇总搜索与无匹配、版本分组、生成记录权限/失败/完成、加载/不可用/空投影和进度格式回退；断言各状态的用户可见文案、表格行、按钮可用性与链接。资产行通过标识规范化 helper 解析 `handbookId/id`，包含缺失标识输入以覆盖忽略分支。所有输入只在页面内存构造，不发起业务写操作；保留生产视图完整固定分母。新增测试放在审核工作台 Playwright spec 中，逐页计数随现有 pagehide 流程保存，审核计数固定为 13。

覆盖率场景补充 GitLab 仓库阅读器：在隔离审核 Chromium 页面动态导入真实 `repository/view.js`，通过真实 DOM 检查加载、未授权 OAuth 回跳、权限/映射/连接/服务错误和重试状态，以及仓库页的管理员入口、分支/语言可用性、目录树、更新时间、提交信息和空正文。Markdown 矩阵覆盖标题/段落、强调/删除/行内代码、合法锚点白名单、相对与外部链接、安全图片、危险协议转义、任务/嵌套列表、引用、分隔线、表格对齐、闭合与未闭合代码围栏、目录层级/孤儿节点。断言 DOM 中无执行态脚本或危险协议，输入仅由页面内存构造，不执行仓库写操作；使用同一页计数归档，无需新增采集进程。审核计数在场景加入后为 14 个页面计数文件，并同步维护 `tools/repository/collect-frontend-istanbul-coverage.cjs` 的数量断言。

已有审核浏览器小组件场景增加真实 `auth-controller.js` 返回地址矩阵：允许知识中心同源路径并删除 CAS `ticket`，拒绝外站及协议相对地址，保留片段和普通查询参数；通过 `history.replaceState` 验证当前目标、地址票据剔除、记忆目标的消费及清理。场景恢复原地址与存储键，仍归入原有 14 个页面计数文件。

同一浏览器场景在其他业务请求结束后验证 `bootstrapAuth` 的普通会话成功、401 匿名、CAS 票据成功回调及失败清理；仅在页面内临时替换认证 `fetch` 响应并恢复，断言返回会话、状态通知和地址票据删除。此矩阵覆盖前端状态机，不代替后端身份鉴权测试。

Java 存储 HTTP 路由参数门禁补充真实本地 `HttpServer` 检查：复用产品 `Main.register` 和实际 handler，发送健康检查、非法记录路径与标识、超限请求体、非法 JSON/revision、方法不支持、人员编号和任务项路径错误、必需的 rowVersion/幂等键缺失等 33 个 HTTP 请求场景，断言 HTTP 状态、错误码与请求关联 ID；健康检查使用本地 JDBC proxy 验证产品连接池调用。该检查覆盖请求边界，不把模拟数据库失败当作业务成功。

Java 分母为 `apps/yashandb-storage/src` 下全部 9 个产品源码。JaCoCo 报告只传产品编译目录作为 `--classfiles`，测试夹具编译到另一个目录并只加入运行时 classpath；否则夹具类会进入分母。采集器运行 `DraftReadProjectionCheck`、`QualityResultLimitCheck`、`QualityExecuteHttpCheck` 五种隔离场景及 `StorageHttpInputCheck` 的 33 个本地 HTTP 输入/路由场景；`StorageRecordHttpCheck` 连接实际 `records` handler 与内存 JDBC 状态机，通过 HTTP 回读创建、条件读取、幂等写入、版本冲突、更新、删除和删除标记，并验证事务提交/回滚。其余本地 JDBC 替身检查包括 `JdbcPoolReuseCheck`、`ProductionReferenceChangesCheck`、`RecordClobReadCheck` 与 `OutlineStorageContractCheck`。`MigrationSqlParserCheck` 独立验证 SQL 注释、引号内分号、尾语句和未闭合输入；`MigrationExecutionCheck` 通过隔离 SQL 目录与 JDBC 替身验证首次执行、幂等跳过、待执行版本及失败回滚；`StorageSchemaDaoCheck` 验证已有索引跳过及 DDL 分号处理。`HandbookProjectionCheck` 验证列表空结果、CLOB 与空摘要映射、可见状态以及 SQL/非 SQL 异常边界；`PrincipalRepositoryCheck` 使用内存 JDBC 行集验证人员筛选、CAS 首次绑定、重复同步、导入、重名歧义、版本冲突和插入失败反馈；`PlatformAuthRepositoryCheck` 验证 CAS 用户同步、角色与授权投影、角色替换及冲突拒绝；`PlatformGitLabRepositoryCheck` 验证连接配置与手册映射的新增、更新、状态、分支、路径及冲突回读。大纲夹具的输入由仓库现有 XLSX 解析器生成，夹具与产物仅写入 `runtime`；要求真实 `test_hy` 数据库的 `ProductionReferenceJdbcCheck` 不在自动覆盖率门禁中。解析 XML 根级 LINE/BRANCH 计数并核对源文件清单；缺少 agent/CLI 或任一回归失败时门禁失败，不得将 Java 缺测视为通过。采集器输出 Java 独立门禁结果，不能把这些检查等同于完整的 Java 功能验证。

前端采集器逐一核对九个导航入口实际变为活动状态；入口缺失或点击失败使采集失败，不吞掉异常。Node `production-ai-upload-parser.js` 的文档转换在 Worker 线程执行，Jest 父线程的 Istanbul 报告不包含 Worker 内计数。覆盖率测试在 Jest 隔离模块中模拟 Worker 上下文，执行同一入口和解析分支并接收 `parentPort` 消息；另保留真实 Worker 的 DOCX/PDF/文本回归，验证隔离、超时与结果。前者负责可计数的分支覆盖，后者负责实际线程行为，两类证据都必须通过。

统一入口先识别显式 `jest.*` API，再识别 Node 原生测试。桥接文件可以模拟 `node:test`，仍必须由 Jest 执行；分类回归同时检查 contract/full 任务计划中的唯一归属。

浏览器 V8 范围覆盖率以每个脚本实例的不重叠源码区间为分母，重叠处以最内层范围的执行次数为准，内层函数覆盖外层脚本范围。同边界范围使用后出现的细化范围。扫描排序后的范围边界，用栈维护当前最内层范围：累计上一边界到当前边界的长度，弹出已结束范围，再压入当前边界开始的范围。嵌套未执行分支必须从已覆盖长度扣除，不能把父子长度直接相加。偏移量按 V8 的 UTF-16 单元统计，历史字段 `totalBytes`/`usedBytes` 保留名称；不代表 UTF-8 字节或行覆盖率。

验收覆盖外层执行/内层未执行、未执行块中的已执行细分、嵌套函数、同边界覆盖、相邻区间、空输入及无关 URL；100 单元中 20 单元未执行时范围覆盖率应为 80%。

### 直写任务执行器固定分母覆盖矩阵

工作台联合查询已有 `workbench-query.test.js` 验证嵌套条件和分页，但此前精确 Jest 清单未包含该文件，导致 `routes/workbench-query.js` 在固定报告中仅有模块初始化计数。将其纳入统一 Jest 分类并补输入契约矩阵：无条件、文本包含/相等、枚举、日期边界、队列/类型、重复 ID 与待办/等待去重、稳定排序、来源完整性；无效根对象、条件组、字段、运算符、空值、超长值、非法日期、反向区间及分页均须抛出统一查询错误。每组断言结果或错误码，固定分母保留所有 Node 产品源码；先定向再完整复采。

工作台编号已有原生 Node 测试，真实调用产品回填函数，但不会进入固定 Jest 的 Istanbul 父进程计数。补 Jest 契约场景，以独立内存工单与审核链覆盖已有编号、跨快照保留序号、重审关联、历史 `HIST` 避让、跨工单歧义、重复子任务冲突和受限手册不可见；断言持久状态、结果投影或明确冲突码，不复制编号算法。定向与原生回归分别通过后，将 Jest 文件纳入固定产品源码清单复采。

编号分支续验沿用同一 Jest 契约文件，补空工单/审核列表、缺少分解记录、非目标手册、旧版历史编号起点、无子任务号的关联、重复活动文档和缺省日期投影。每个输入必须有可观察的编号、空投影或冲突错误；通过 LCOV 定位剩余分支，达到分支 95% 后仍以完整 Node 清单复采为准。

工作台责任人和正式代办已有 `node:test` 真实 HTTP 回归，但 `routes/knowledge-center.js` 对应路由在 Jest 固定计数里仍有连续未覆盖段。新增独立 Jest HTTP 场景，启动实际 `createKnowledgeCenterHandler`，使用 `runtime/test-results` 临时任务文件、内存鉴权和资源投影；覆盖管理员/普通用户的责任人目录、只读预览、正式代办、本人/代理查询、方法限制、缺失/停用责任人、非法条件，以及任务来源文件损坏时的部分可用响应。断言响应码、数据和安全边界，不通过直接调用私有函数计数；原生测试继续提供独立 HTTP 回归。定向后加入固定 Node 精确清单复采。

平台团队和人员目录路由使用独立 Jest 本地 HTTP 夹具：真实 `createKnowledgeCenterHandler` 接收请求，内存 `domainStore` 只模拟数据库边界；覆盖普通用户拒绝、团队筛选列表、创建幂等键、名册预览兼容响应、详情、名册版本/幂等键、人员筛选列表、创建/更新、方法拒绝和服务端已知错误映射。每次断言实际 HTTP 状态、响应体与适配器收到的参数；测试运行文件仅在 `runtime/test-results`，不触发真实数据库或外部 GitLab。人员导入上传另需二进制夹具，不用空响应伪计成功。定向通过后加入固定 Jest 清单，保留产品源码全分母。

人员导入补真实 multipart Excel 请求：由既有 `xlsx` 测试依赖生成含正确表头的内存工作簿，`FormData` 上传到实际 `/platform/principals/import`。覆盖模板下载、预检摘要、无冲突应用并确认 `sourceSha256` 和操作者转发、冲突阻断应用、无效模式、非 multipart 及非 `.xlsx`；检查真实 HTTP 状态和错误码，模拟存储仅作为数据库边界。此处同时验证 `readPersonnelUpload` 的流解析，不能用直接调用解析器结果替代接口。加入固定 Node 清单后复采，若依赖环境不具备则保留失败证据而非缩小分母。

人员解析和预检分支续验扩展现有 `personnel-import.test.js`：真实内存 Excel 构造多 Sheet、空数据、缺姓名、非法状态、重复登录名和超过单次人数上限；解析器故障注入验证统一文件错误码。预检矩阵覆盖已绑定人状态变化、同名待绑定人员唯一/重复、未绑定人员状态变化/不变、空姓名与空状态的规范化。再经真实导入 HTTP 上传内容损坏但扩展名合法的文件，验证路由返回解析错误且不执行存储写入。通过错误码和完整摘要验证，不用仅计数的调用替身；定向与固定清单均需通过。

模板映射服务的既有 `node:test` 回归与浏览器 HTTP 场景保留业务验收；固定 Node Istanbul 分母由 Jest 采集，原生测试中的服务执行不进入该计数。新增 Jest 隔离内存存储测试，直接运行同一产品服务入口，覆盖规则校验/优先级冲突、预览摘要与版本、已停用模板、AI 结果和失败、取消、确认及分页。断言持久化投影与明确错误码，不复制产品判定逻辑；浏览器 HTTP 测试仍负责路由接线与真实页面行为。伪代码：`service=realService(memoryStore, activeTemplateCatalog, aiStub); saveRules(); previewRules(); start(); await completion; decide(); assert persisted mapping and rejected stale/invalid decisions`。新增 Jest 文件进入固定清单后复采全部 Node 产品源码，不能只报告服务定向覆盖率。

Codex 运行器已有独立 Node 原生测试通过真实平台 HTTP 验证取消、运行记录、事件补读和访问权限，但其受控子进程执行不进入 Jest 固定计数。新增 Jest 侧的隔离进程回归：仍使用产品 `createCodexRunner` 与真实 `fork`，只将 Worker 路径替换为写在 `runtime/test-results` 的短小协议替身；分别发出成功、错误、取消及敏感事件。验证运行清单、结果、状态、脱敏、旧运行中断回读和预检错误；每次清理子进程和隔离目录。协议替身不模拟 Codex CLI 的模型行为，原生 HTTP 测试继续负责真实路由接线。伪代码：`run(realRunner, fixtureWorker); await event; assert persisted status/result and redacted event; cancel(realRunner); assert cancellation; get(orphanRun); assert interrupted`。如果触及子 Worker 源码计数，需单独在 Jest 隔离模块中模拟进程消息和 stdio，不将未实际执行的 Worker 代码伪计为覆盖。

Worker 计数场景在 Jest 隔离模块中加载真实 `codex-worker.js`，以受控 `child_process` 和 stdio 回应 `initialize`、`thread/start`、`turn/start`，模拟完成事件并读取 `runtime/test-results` 中的 `output.json`。分别断言有效产物返回、正文契约错误、进程消息、配置文件与授权文件清理；真实 `process.exit`、`process.kill` 均由测试恢复的替身隔离。该场景仅覆盖 Worker 对协议和本地产物的处理，不声称启动了真实 Codex CLI。运行后必须检查 Jest 正常退出，并将测试加入固定 Node 精确清单复采。

协议事件矩阵在同一受控 stdio 中发送服务端审批请求、工具开始/失败、错误及包含 bearer/API Key 的 stderr，断言审批明确拒绝、事件转发和敏感文本隐藏；再发送取消消息，断言 `turn/interrupt` 请求。该场景覆盖取消路径的消息处理，不等待五秒强制终止定时器；真实子进程取消仍由运行器隔离进程测试承担。

对 `packages/agent-runner-core/lib/direct-generate/direct-task-runner.js` 使用真实 `/api/agent/execute` HTTP 路由驱动执行器；测试只替换模型、MCP/文件工具、检索策略和过程存储边界，所有输出限定到 `runtime` 临时目录。完整成功路径验证输入准备、无查询与有查询、MCP 成功/失败结果、检索过滤和上下文回退、冻结与文件模板/技能读取、YAML 修复及未修复、来源追溯替换、格式检查、文档写入、日志写入成功/失败、进度事件和任务序列化。参数矩阵触达 debug/production、缺失知识点字段、查询计划空结果、模板/技能读取异常、模板遗留路径过滤和不同输出文件名/温度/token 回退。

失败路径在真实 HTTP 启动任务后等待后台执行结束，分别让元数据保存、MCP 结果保存、检索策略、LLM 请求、生成产物保存和文件写入抛错；断言任务及当前阶段进入 failed、错误信息透出且进度事件收敛。测试对每条状态路径检查请求或产物，不通过覆盖率专用代码改动生产分支。门禁仍纳入完整 Node 固定源码清单；每次运行需全部 Jest 通过后才合并报告。

### 前端网关 HTTP 分流与静态资源覆盖矩阵

对 `apps/knowledge-center-web/frontend-server.js` 在隔离端口启动真实 `http.Server`，静态根目录及上游服务端口均指向临时夹具。本地请求验证首页/普通文件 MIME、HTML 不缓存、非 HTML ETag/304、未知扩展、缺失文件与读取失败，且校验请求与关联 ID 透传。路由矩阵覆盖 `/knowledge-center`、`/pingcode-api`、`/api`、旧资料加工入口的 410、旧生成器入口的保留查询参数重定向和普通静态资源；代理上游以本地 HTTP 服务观察实际请求方法、路径与错误响应。知识中心处理器用受控替身模拟同步/异步错误及已发响应，核对网关失败信封、状态、请求 ID 和不重复写响应。扩展同一夹具路由到资料加工、大纲和任务代理，验证会话身份头、内部 token、上游成功对象/数组、旧版 success 信封、标准及非标准错误、非法 JSON、非 JSON 透传，以及目录 catalog/新增候选到内部文档服务的路径和失败状态。该测试只覆盖网关运输契约，业务授权由已有产品路由测试承担；运行后关闭所有本地服务并清理临时目录。

数据库模式启动校验以独立模块加载和内存 `DomainStore` 投影覆盖源文件一致、不一致、无效 JSON、文件不存在四种情形；仅访问隔离临时配置，不建立真实 JDBC 连接。断言告警/通过日志及启动不因坏文件退出；恢复环境与模块 mock 后再运行固定分母采集。

### Java 存储导出 HTTP 覆盖矩阵

`StorageRecordHttpCheck` 通过实际 `exportAll` handler 验证空记录导出、创建后的正文与数据库摘要、软删除后的删除标记。测试连接内存 JDBC 状态机并发出本地真实 HTTP 请求；夹具不进入产品源码分母。

同一夹具的 `domainHandbooks` GET 场景先返回空列表，再由内存行集返回一条含摘要、大纲状态、负责人和可见性字段的手册；通过真实 HTTP 断言投影字段与 `Server-Timing`，并检查不支持的方法响应。手册行集仅在夹具中构造，产品 `HandbookProjectionRepository` 查询与 `Main.projectHandbook` 保持真实执行。

大纲节点纯转换在现有 `OutlineStorageContractCheck` 中补非法输入矩阵：缺少标识/标题、重复标识、非法类型及路径字符、非法父子关系、缺失或倒退的排序/层级、重复路径和没有文档节点；每例断言对应 SQL 错误码，不改变产品输入规则。

人员目录路由用独立 `StoragePrincipalHttpCheck` 通过本地真实 HTTP 调用 `Main.domainPrincipals`，复用现有 `PrincipalRepositoryCheck` 的内存 JDBC 状态机。场景覆盖空/筛选列表、创建与回读、CAS 绑定、PATCH 更新、缺少姓名/版本、非法标识、旧版本冲突、错误导入摘要和不支持的方法；断言状态、错误码及版本变化。测试只写夹具内存，产品连接池和路由实际执行，JaCoCo 只统计固定 9 个产品源码。

人员导入追加首次批次与幂等批次的真实 HTTP 路径：内存 JDBC 保存 `KC_MIGRATION_BATCH` 状态，发送有效 SHA-256 与人员数组，断言首次 `idempotent=false`、再次同摘要 `idempotent=true`，以及有效摘要但空数组的 422；批次与人员都限于测试进程内存。

人员 HTTP 错误边界再覆盖未完成批次拒绝、无候选人员的 CAS 绑定冲突和非法 JSON 请求；使用夹具中的批次状态及实际路由异常映射，断言响应状态和错误码。

平台鉴权路由用 `StorageAuthHttpCheck` 通过本地真实 HTTP 调用 `Main.platformAuth`，复用现有平台用户/角色 JDBC 夹具。覆盖空列表、缺失详情、CAS 用户同步、详情与列表回读、角色变更所需版本及幂等键、成功变更和旧版本冲突；只在测试内存中维护用户和角色，不改产品权限规则，固定 Java 源码清单不变。

GitLab 平台路由用 `StorageGitLabHttpCheck` 调用实际 `Main.platformGitLab`，复用内存连接和手册映射 JDBC 夹具。通过本地 HTTP 断言空列表、缺失连接、创建时幂等键门禁、连接创建/回读、状态变更版本头、映射首次写入/回读及不支持方法；任何 GitLab 地址只是夹具字段，不发送外部网络请求。

技术领域与建设任务只读投影使用 `StorageDomainReadHttpCheck` 的隔离 JDBC 行集，通过实际 `techDomains`、`buildTasks` handler 和本地真实 HTTP 先验证空结果，再验证一条技术领域、团队负责人和一条已发布建设任务的列表与详情；同时验证缺失任务 404、方法门禁。夹具行集与产品查询字符串匹配，未触发业务写入。

同一夹具增加 `teamGroups` 只读路由：空列表、包含负责人和成员的团队列表/详情、缺失团队 404，以及创建和名册更新缺少幂等键时的请求门禁；团队与人员仍仅在内存行集中构造，产品只读投影实际执行。

团队写入场景扩展同一夹具的内存 SQL 状态：创建一条新小组并由产品回读，重名创建返回 409；对现有小组验证缺少负责人 422、成功更换负责人及成员后的版本和详情、旧版本更新返回 409。所有响应经本地实际 HTTP handler 取得，夹具仅模拟 SQL 行集和事务连接。

Java 团队 HTTP 输入边界在现有 `StorageDomainReadHttpCheck` 中续验，使用同一本地真实 `Main.teamGroups` 路由和内存 JDBC 状态：非法团队 ID、创建请求无效 JSON、名册缺失/非法版本头、成员标识非法或不存在、名册对象不存在，以及不支持的方法。断言响应状态与公开错误码；不得修改产品错误映射或 JaCoCo 产品源码清单。完整 `collect-java-coverage.py` 复采固定 9 个 Java 源文件。

Java 大纲目录列表读取在同一 `StorageDomainReadHttpCheck` 中增加真实 `Main.domainOutlines` HTTP 注册。内存 JDBC 先返回空目录，再返回一条含手册、产品、版本、节点数、文档数和发布时间的当前大纲记录；断言 `items/total`、手册与大纲标识、状态、节点计数及 `Server-Timing`。只读请求不触发数据库写入，仍用固定 9 个产品源码 JaCoCo 完整复采。

同一 Java 大纲 HTTP 夹具补空大纲列表、缺失业务 ID 和缺失旧数字 ID 的目录详情，验证 `OUTLINE_NOT_FOUND` 映射与旧 ID 兼容查询分支；内存 JDBC 对相关 SELECT 返回空行，不增加写入行为。以固定 9 产品源文件完整 JaCoCo 报告衡量增量。

Java 大纲目录详情成功读取继续沿用真实 `Main.domainOutlines` HTTP handler。内存 JDBC 对公开 `SOURCE_REF` 返回当前版本头、一个 document 节点及一个技术领域负责人行；断言目录的公开 ID、手册、节点、分工和 `Server-Timing`，并立即重复请求验证缓存复读仍返回同一投影。数据只在夹具内存中提供，不进行大纲发布或持久化写入；固定 9 产品源文件 JaCoCo 复采必须通过。

Java 大纲治理只读投影沿用同一真实 HTTP handler 与版本头/节点夹具，额外提供显式领域归属、建设任务项和领域名称 SQL 行。请求 `/v1/domain/outlines/{公开ID}/governance`，断言 document 总数、已分工数、有效领域、负责人及任务项状态，确认领域归属与人员绑定来自各自表再由产品代码合并。只读请求不执行发布或写入；固定 9 源文件 JaCoCo 复采验证全量增量。

同一 Java 大纲夹具补 `/v1/domain/outlines` 非空列表：内存 JDBC 为 `projectOutlines` 返回一条手册、大纲、当前版本和公开 `SOURCE_REF` 行，为 `externalOutlineId` 返回业务 ID，并为节点查询返回一条 document；再追加一条尚无当前版本的旧版大纲行。通过真实本地 HTTP 断言 `outlines` 列表中的公开 `outlineId`、当前版本、published 状态、节点标题/路径/文档数和时间字段，以及旧版行的 draft 状态、空当前版本和空节点；保留已有空列表断言。不得直接调用 `projectOutline` 或改动产品状态机，固定 9 文件 JaCoCo 完整复采确认增量。

已发布大纲治理写入先在同一隔离真实 HTTP handler 检查拒绝边界，不改数据库状态：缺少 `assignments`、过期 `editVersion`、不存在的说明节点、修改已发布正文说明、不存在的分工节点、非法技术领域标识，以及清空 document 全部分工。逐项断言 409/422 状态、公开错误码和缺失文档详情；所有请求走真实 `/v1/domain/outlines/{id}/governance` PUT，夹具行集只提供当前已发布版本和一个 document。

拒绝边界通过后，使用同一本地 JDBC 状态机实际执行一次已发布大纲的合法技术领域分工 PUT：原有 document 保留领域 `7`，责任人来自已绑定团队。夹具捕获责任版本的删除/插入/摘要更新及大纲版本递增；断言 HTTP 200、公开 `editVersion` 从 3 到 4、负责人仍为“何阳”，再次 GET 回读版本与有效分工一致。只更新夹具内存，产品 SQL 和事务代码真实执行，固定 JaCoCo 分母不变。

Java 迁移别名兼容性沿用 `MigrationExecutionCheck` 的真实公开 `SchemaMigrationManager.migrate/verify` 与隔离 JDBC 事务。先把已执行版本记录改为同数字前缀的历史名称，在本次 `runtime` SQL 目录写 `migration-aliases.properties`，验证 `verify` 接受且 `migrate` 不重复执行；再逐项验证指向不存在的当前版本、指向自身、数字版本不一致、重复声明历史别名、空别名被拒绝。每一项断言公开 SQLException 原因并恢复夹具文件，固定 9 文件 JaCoCo 复采核对增量。

迁移启动边界继续使用相同公开 `migrate/verify` API：空 SQL 目录、目录缺失、数据库尚未初始化、首个脚本未创建迁移表和空脚本分别返回明确 SQLException；通过隔离 JDBC 状态检查失败时回滚且不记录迁移。`SchemaMigrationManager` 没有 HTTP 接口，使用其真实迁移 API 与 JDBC 事务验证，不通过反射调用私有方法或造不可能的表状态。

同一迁移夹具把已记录历史别名的 SHA-256 摘要暂时置为不匹配：默认 `warn` 策略下 `verify` 仍允许启动，但 `migrate` 必须拒绝摘要冲突且不执行 SQL、不开新提交；随后恢复摘要并确认 `verify` 正常。此用例通过公开 API 测试读取与写入阶段的不同安全策略，不改动产品策略或系统环境变量。

Java 建设任务页面责任人续验使用 `StorageDomainReadHttpCheck` 已注册的真实本地 `/v1/domain/build-tasks` HTTP handler。先从任务列表读取实际任务与页面 ID，再对缺失页面、非绑定团队成员发 PATCH，分别验证公开 404/422 错误；对有效成员发 PATCH，检查内存 JDBC 捕获的责任记录更新、200 响应及 GET 回读的负责人姓名和 assigned 状态；最后清空责任人，验证数据库绑定状态和 GET 回读转为 unassigned。任务 ID 由真实列表生成，不在测试中重算；夹具仅保存本进程的责任人状态，固定 9 个 Java 产品源文件和 JaCoCo 分母不变。

Java 大纲发布续验仍通过实际 `/v1/domain/outlines/{id}/publish` POST。已发布版本重复请求应返回治理投影且不触发发布 SQL；把夹具候选状态切为 READY 后，过期 `editVersion` 返回 409，移除 document 显式分工返回含缺失文档的 422；恢复分工后发布成功，断言旧版本失效、当前版本及责任版本写入、当前指针更新和 GET 治理回读的 published 状态。内存状态随 SQL 写入变化，失败场景无副作用，固定 JaCoCo 源码清单不变。

迁移记录竞态续验使用现有 `MigrationExecutionCheck` 的公开 `migrate` API 和隔离 JDBC 状态机。首个迁移开始时表尚不存在，执行 SQL 后模拟另一连接先写入相同版本记录：摘要相同则本连接不重复 INSERT 并提交，摘要不同时抛出冲突并回滚、不执行本连接 INSERT。另让记录 INSERT 抛出 SQL 异常，检查回滚且未提交。测试只控制内存数据库边界，不改产品迁移逻辑或固定 9 文件分母；完整 JaCoCo 复采后比较产品源码覆盖增量。

Java 手册快照写入续验使用独立 `StorageManualSnapshotHttpCheck` 的本地真实 HTTP 与隔离 JDBC 状态机。先发送单条手册快照，验证手册字段、主/副负责人、归档与可见性、初建大纲和迁移批次写入；再次发送同手册更新，验证行版本递增、负责人替换和已有大纲更新时间更新。第三次重复相同来源摘要应跳过迁移批次插入。对缺失产品名称、无效负责人和非法 JSON 分别断言公开错误响应及写入回滚；每次成功写入后通过 GET 回读产品投影。夹具记录 SQL 参数与提交/回滚，不连接真实数据库、不改变产品代码或固定 Java 分母。

Java 已有大纲快照续验沿用 `StorageDomainReadHttpCheck` 的公开 `/v1/domain/outlines/snapshot` PUT。向现有手册和已发布大纲写入一个合法 document 节点，断言 SQL 锁定既有大纲、更新版本、删除并重建节点、重新选择当前版本指针，以及 HTTP 回读和事务提交；夹具捕获各语句绑定参数。再以 `insertOnly` 对同一公开 ID 请求，断言版本冲突且不新增节点。固定 JaCoCo 清单仍为 9 个产品文件。

Java 大纲候选版本续验继续使用同一真实 HTTP 服务。以新的公开 ID 和 `insertOnly=true` 写入合法 draft 节点，断言新版本与节点的序列 ID、手册归属和来源 ID 写入，成功响应及 GET 列表可回读候选版本；同一手册当前已发布版本指针保持不变，且本次不删除既有节点。对重复候选 ID 再次提交，预期冲突且不产生额外写入或提交。夹具保留单一固定 Java 产品源码分母。

Java 大纲生命周期续验沿用 `StorageDomainReadHttpCheck` 已创建的候选版本和真实 `/v1/domain/outlines/{id}` HTTP handler。夹具通过隔离 JDBC 行集保存删除状态、审计记录和持久化引用：未删除时清除预检不可执行，缺少确认的清除返回 422；删除后预检可执行，重复删除无额外审计；恢复后可再次读取，重复恢复无额外审计；存在关联记录时清除返回 409，清除引用后必须带目标 ID 与原因，成功后版本和子节点不可再读取。每次成功状态转换校验提交及必要 SQL 写入，失败场景不得改变状态；固定 Java 产品源码清单不变。

同一生命周期 HTTP 夹具再验证当前已发布版本：删除应清空大纲当前指针并记录 `DELETED_WAS_CURRENT`；若随后出现另一当前版本，恢复应返回 409 且不写审计或覆盖指针；解除冲突后恢复应重建原指针并可回读。非法方法与无效 JSON 分别在路由边界返回 405/400。状态由 JDBC 夹具维护，不连接真实数据库。

Java 启动参数和环境变量边界由 `StorageBootstrapContractCheck` 直接调用公开 `Main.main` 参数校验与静态解析器，不启动服务、不加载 JDBC 驱动、不读取真实凭据。矩阵覆盖缺省/空值回退、必填变量缺失、合法整数、非法整数和命令参数个数/名称错误；将该夹具加入固定 JaCoCo 全量采集，产品类仍独立编译并作为唯一分母。

Node 错误中间件覆盖使用 `error-handler-coverage.test.js` 直接调用导出的 Express handler，并以真实 `AsyncLocalStorage` 上下文核对响应 ID。矩阵包括 JSON 解析失败、按 HTTP 状态码和错误码识别校验错误、开发/生产内部错误消息、显式/默认状态码、请求路由模板/路径回退、空/对象请求体、安全字段隐藏与字符串长度摘要，以及 404 响应和告警。Logger 仅在测试中 spy，断言公开响应、头和结构化日志；固定 Node Jest 源码分母保持不变。

浏览器计划日历由现有固定前端 Istanbul 导航采集器在文档任务页动态导入真实 `plan-calendar.js`。在 Chromium 页面 DOM 中，用内存任务和确定性 `save/refresh/reload` 回调驱动北京时间格式、可编辑/只读和空值单元格、未设置时间的默认时刻、月份和日期切换、起止时间约束、UTC 保存、版本冲突重新读取、权限撤销、普通保存错误、清空、关闭、保存中重复提交及阻止取消；每步检查用户可见状态和回调参数，不请求后端写入。场景仍归入现有导航页计数，不改 56 个产品脚本分母，也不放宽审核页面计数要求。伪代码：`openCalendar(realModule, task, callbacks); clickDayAndMonth(); submitInvalidThenValid(); assert(UTC, refresh); throwConflict(); reload(); assertSelectionAndPermission(); clearAndClose()`。
# Node 品牌图标存储覆盖矩阵（2026-11-06）

`brand-icon-store-coverage.test.js` 使用隔离临时仓库和真实 `createBrandIconStore`，覆盖 PNG/JPG/JPEG/WebP/SVG MIME 映射、SHA-256 指纹、更新时间、默认品牌配置、绝对路径/点段/反斜杠/非字符串引用拒绝、缺失文件、符号链接越界和不支持格式。测试只写 `runtime`/系统临时目录，不改变产品分母；定向 Istanbul 结果为该文件行 29/29、分支 28/28。


### 中间过程存储覆盖矩阵（2026-11-06）

使用真实 `ProcessStore` 在 `runtime/test-results` 临时目录读写，核对生产模式过滤、强制保存、调试模式、字符串/JSON 回读、存在检查、缺失目录、递归文件列表、MCP 请求信封、LLM 上下文与元数据。断言落盘内容与公开返回值，日志仅 spy；隔离目录结束后清理。该补充不涉及产品行为更改。

### 品牌图标真实 HTTP 续验（2026-11-06）

品牌图标覆盖补充真实 `createKnowledgeCenterHandler` 与本地 `http.Server` 请求：GET 读取实际图标字节并核对 ETag、`nosniff` 和 MIME，POST 方法门禁返回 405；删除资源后 GET 返回 503 与 `BRAND_ICON_NOT_FOUND`。夹具中的模板和示例工作簿仅满足 handler 初始化读取，均置于隔离 runtime 目录。最终定向报告 `runtime/test-results/node-stores-http-verified/coverage-summary.json`，品牌图标与中间过程存储模块各自保持行/分支 100%。

### 大纲视图浏览器覆盖矩阵（2026-11-06）

在固定前端 Istanbul 采集器中加载独立浏览器场景，调用公开 `renderOutlines/renderOutlineAssignments`，把返回 HTML 挂载到隔离 DOM 容器并核对用户可见内容和权限控件。矩阵覆盖列表搜索/状态过滤、读取状态、资源说明、回收站与永久删除权限、空手册导入权限、含多层目录的大纲详情、内容说明只读状态、有效领域与负责人、未发布分工限制、任务服务失败、跨手册/版本任务过滤、未配置团队、历史责任人与成员分派统计。仅渲染内存投影，不执行后端写入。伪代码：`render(publicView, projection); mount(html); assert(text, selectedOptions, hiddenRows, permissionControls)`。固定 56 产品脚本分母不变，采集必须保留完整写作与审核场景。

### 主应用启动路由覆盖续验（2026-11-06）

固定 Istanbul Chromium 采集器在首次认证后重新加载真实入口，覆盖大纲资源页、大纲回收站、仓库分支与语言参数、未知模块回退和外部账号参数清理，再回到工作台执行完整导航。每次重载保留产品脚本注入和覆盖计数，路由失败时仍等待页面恢复，不伪造接口响应。独立报告 `runtime/test-results/frontend-app-route-coverage-20261106/coverage-summary.json` 已生成；由于浏览器时序波动，本次总量不作为提升证据。

### 模板映射真实 HTTP 路由边界（2026-11-06）

新增 `knowledge-center-template-mapping-http-coverage.test.js`，以隔离认证服务、真实 `createKnowledgeCenterHandler`、真实 `createTemplateMappingService` 和本地 HTTP 服务验证模板映射路由。矩阵覆盖规则读取及管理权限、非法方法、预览与过期摘要、映射列表的缺少手册/分页/越权、分析批次创建/读取/取消/缺失批次，以及决策接口缺失批次、越权和目录不可见。定向 Jest 3/3 套件通过；定向报告为 `runtime/test-results/template-map-http-directed/coverage-summary.json`。本夹具不改变固定 Node 产品源码分母，待纳入固定清单复采。

### 大纲治理读模型与预检 HTTP 续验（2026-11-06）

扩展 `outline-route-boundaries-http.test.js` 的真实 Express HTTP 夹具，覆盖产品目录、目录列表、治理详情完整/compact 投影、责任与影响查询、缺失资源、候选预检通过/失败、旧版列表与版本详情。定向 Jest 8/8 通过；`routes/outline.js` 定向覆盖由行 301/528、分支 266/668 提升为行 343/528、分支 322/668，报告 `runtime/test-results/outline-route-directed-v2/coverage-summary.json`。固定 Node 全量分母未改变，尚需复采确认总量。
### 配置路由真实 HTTP 续验（2026-11-06）

扩展 `api.test.js` 的真实 HTTP 服务场景，覆盖模型零值参数与密钥、MCP 加密/非加密请求头、缓存边界、Agent 预设保存，以及 LLM 连接失败响应。定向 Jest 16/16 通过；场景继续使用隔离服务配置快照，不改变固定 Node 产品源码分母。

另增 `config-route-http-coverage.test.js`，以 Express 本地真实 HTTP 服务和隔离配置/客户端替身覆盖配置路由默认值、写入校验、预设列表、LLM/MCP 成功与异常。定向 Jest 4/4 通过；该路由定向 Istanbul 行 79/85（92.94%）、分支 40/44（90.90%）。

### 运行时环境解析覆盖续验（2026-11-06）

`runtime-env.test.js` 使用真实临时文件和内置解析器覆盖引号、非法行、环境变量路径、默认路径、同路径复用及缺失文件错误；定向 Jest 4/4 通过。最新报告 `runtime/test-results/runtime-env-directed-20261106c/coverage-summary.json` 显示该模块行覆盖 24/24，分支覆盖 22/23（95.65%）；固定三端全量目标仍需继续补齐。
