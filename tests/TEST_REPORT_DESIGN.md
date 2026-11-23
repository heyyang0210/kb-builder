# 统一测试入口 HTML 报告设计

2026-11-17：任务管理固定覆盖导航按当前单一列表契约检查 `[data-task-list]` 可见，并断言旧页签与任务配置面板不渲染；不再点击已移除的“次要事项/流程流转/任务配置”。

## 2026-11-17T10:17:41+08:00 数据库 Markdown 语言回退稳定验收

完整固定采集 `runtime/test-results/frontend-full-coverage-20261117-database-enhancer-language/` 退出 0，62 个源文件、1,305 项输入 `completed/stable/inputsStable=true`，变更清单为空。`database-enhancer.js` 行 28/28，分支 14/16；空语言名的 `text` 工具栏回退已命中。无代码块输入保持无误告警，但未作为该覆盖增量依据。前端总量行 10,670/11,928（89.45%）、分支 12,578/16,875（74.53%）；相较上个动态浏览器报告分支总命中少 1，不能归因于此单项。

## 2026-11-17T09:52:11+08:00 数据库 Markdown 代码语言回退分支补测设计

固定 Chromium 场景已增加“无代码块正文不产生误告警”契约，但之后的完整 LCOV 显示 `database-enhancer.js` 分支仍为 13/16，没有覆盖增量。逐项查看 Istanbul branchMap 后确认当前可达缺口是代码工具栏语言文案的 `language || 'text'` 回退。扩展公开 API 场景传入 `<code class="language-">` 空语言名，断言 `data-db-code-language` 为空且工具栏文案显示 `text`；其他未覆盖分支由空值内部 helper 引用，不能仅凭总分支数推断为可达。

伪代码：`result=enhanceDatabaseMarkdown('<pre class="repository-code"><code class="language-">SELECT 1</code></pre>'); assert result.html contains data-db-code-language="" and <span>text</span>`。先定向场景，再完整固定采集；只在 62 源文件、1,305 输入稳定时采纳结果。

## 2026-11-17T09:36:00+08:00 AI 写作兼容入口默认参数边界调查

最新稳定报告显示 `production-ai-dialog.js` 行 3/4、分支 13/14，剩余分支为 `options = {}` 默认参数。定向试验调用 `openProductionAIDialog()` 无参时，下游 `production-writing-page.js` 因必需的 `context.documentId` 缺失而抛出 TypeError，无法作为正常写作流程覆盖；未将这个失败固化为产品契约，也未改变产品实现。有效 context 且无 `#view-root` 时回退到 `document.body` 的分支已由固定场景覆盖。继续从其他合法业务场景推进覆盖率。

## 2026-11-17T09:33:59+08:00 AI 写作兼容入口容器回退覆盖设计

最新稳定前端报告中 `modules/production/production-ai-dialog.js` 行 3/4、分支 12/14；未命中分支是 `openProductionAIDialog()` 在未传 host 且页面没有 `#view-root` 时回退到 `document.body`。扩展固定 Chromium 场景，通过兼容公开入口打开写作页，临时移除主页面根节点 ID，验证页面挂载于 body 并可关闭，最后恢复根节点 ID 和 DOM 数量。

伪代码：

```text
root = document.getElementById("view-root")
remove root id; before = count writing pages
result = openProductionAIDialog({context, getMarkdown: () => ""})
assert one new writing page is mounted under body
result.close(); restore root id
assert writing page count returns to before
```

定向 Chromium 后执行完整固定前端采集；仅在 62 个源码文件、1,305 项输入稳定且无变化时采纳覆盖数。该场景只验证公开兼容入口，不更改产品行为或覆盖分母。

## 2026-11-17T09:30:55+08:00 仓库图片观察边界覆盖验收

完整固定采集 `runtime/test-results/frontend-full-coverage-20261117-repository-images-final/` 退出 0；62 个源文件、1,305 项输入 `completed/stable/inputsStable=true`，`changedFiles=[]`、`changedInputs=[]`。固定 Chromium 公开契约场景覆盖相对图片 URL、缺省 context、空/非法/越界路径、初始无效图片、动态新增 img 观察，以及 src 失效时还原/移除原 srcset。`repository-images.js` 行 31/31、分支 37/37。全前端行 10,668/11,928（89.43%），分支 12,576/16,875（74.52%）；完整矩阵其他场景存在计数波动，不将全局变化完全归因于单项测试。平台目标仍未达成。

## 2026-11-17T09:04:00+08:00 仓库相对图片观察边界覆盖设计

最新稳定 LCOV 中 `common/markdown/repository-images.js` 行覆盖已达 31/31，但仍缺 5 个分支：`repositoryImageURL` 的缺省上下文/空 href，`observeRepositoryImages` 对未追踪无效 src 的恢复路径、原始 `srcset` 非空恢复路径，以及 MutationObserver 对直接新增 img 节点的扫描路径。测试经固定 Chromium 真实模块导入，验证公开 URL 解析与图片观察契约，不改产品代码或覆盖分母。

伪代码：

```text
assert relative image path resolves with default branch/language
assert omitted context, empty href, malformed encoding and root escape return null
host = div; add initially invalid untracked img, valid img with no srcset, and existing srcset image
observeRepositoryImages(host, markdownPath, context)
assert valid imgs receive repository srcset; add a direct img and await MutationObserver
change one valid src to external and another to empty
assert original null srcset is removed and original non-empty srcset is restored
insert a text node and ensure scan ignores non-element nodes
disconnect observer
```

先运行定向固定 Chromium 场景，再执行完整 62 源文件/1,305 项输入采集。只有退出码 0、`completed/stable/inputsStable=true`、变更清单为空的结果用于确认覆盖变化；不得以单模块诊断替代全平台行 100%、分支 95% 门槛。

最终稳定复采 `runtime/test-results/frontend-full-coverage-20261117-repository-images-final/` 退出 0，62 个源文件和 1,305 项输入完整稳定，`changedFiles=[]`、`changedInputs=[]`。`repository-images.js` 行 31/31、分支 37/37，较前一稳定报告补齐 5 个分支。前端整体行 10,668/11,928（89.43%）、分支 12,576/16,875（74.52%）；其他场景动态计数有波动，不将总分支净增 5 全归因于此场景。平台全覆盖目标仍未达到。

## 2026-11-17T09:30:00+08:00 报告产物追溯入口改进设计

### 目标

参考 Allure 的结果与附件入口、Playwright HTML Reporter 的静态可分享报告、ReportPortal 的运行级质量总览和 pytest-html 的原始日志追溯，在每个 HTML 页面提供一致的报告产物入口。用户可以从总览或任一场景分页直接打开 Markdown 正式报告和机器可读 JSON；链接必须使用报告目录内的固定相对路径，不能把本机绝对路径写入 HTML。

### 伪代码

```text
render_shell(payload, prefix):
  artifact_links = [
    ("Markdown 报告", prefix + "report.md"),
    ("原始 JSON", prefix + "details/report.json")
  ]
  render footer with current HTML, artifact_links

write_html_report(run_dir):
  keep existing JSON/Markdown generation and static scene pages
  render overview and scene pages with prefix-aware artifact_links
  assert no absolute path or parent traversal is emitted
```

### 验收

- 总览页和场景分页均出现 Markdown、JSON 两个产物入口。
- 链接在报告目录内可解析，场景页使用 `../`，总览页使用当前目录。
- HTML 不泄露绝对路径，现有转义、分页、离线无 JavaScript 和性能验收继续通过。

## 2026-11-17T08:54:00+08:00 IMA 修订差异边界固定验收

固定 Chromium 写作契约覆盖 `writing-changes.js` 的相同正文快捷返回、无公共尾段替换、公共尾段保留、接受/拒绝回放以及超过 LCS 矩阵上限的整块替换。完整报告 `runtime/test-results/frontend-full-coverage-20261117-writing-tail/` 退出 0；62 个源码文件和 1,305 项输入 `completed/stable/inputsStable=true`，变更清单为空。`modules/production/writing-changes.js` 达到行 31/31、分支 42/42。前端总量行 10,668/11,928（89.43%）、分支 12,571/16,875（74.49%）；全平台目标仍未达成。

## 2026-11-17T08:42:18+08:00 IMA 修订公共尾段保留覆盖设计

完整固定采集显示 `writing-changes.js` 行 31/31、分支 41/42；唯一缺口为变更区块后存在相同尾段时，尾段按原样补回。向既有 Chromium 差异契约补充“旧段落/新段落 + 相同尾段”输入，断言候选和拒绝均完整保留相同尾段。定向场景通过后再次运行完整固定前端清单，仍以 62 个源码文件和 1,305 项输入哈希稳定作为验收条件。

## 2026-11-17T08:19:00+08:00 IMA 修订差异边界固定覆盖设计

固定 LCOV 中 `modules/production/writing-changes.js` 仍有输入完全相同的快捷返回、超出 LCS 矩阵上限时的整块替换回退，以及无公共尾缀时尾段为空的分支未覆盖。该模块用于 IMA 修订预览，扩展固定 Chromium 写作契约场景，直接从真实知识中心源模块导入 `writingChanges`/`assembleWritingChanges`，断言相同正文只产生等值片段；常规替换得到单个待审变更、接受后得到候选、拒绝后恢复原文；大正文触发矩阵上限后仍以整块变更完整回放候选。该断言验证实际公开模块的原文保真与超限行为，不修改业务实现或覆盖率分母。定向场景通过后执行完整固定前端 62 源文件/1,305 项输入采集，按稳定性门禁采纳。

## 2026-11-17T08:17:39+08:00 平台负责人配置加载重试固定验收

固定真实 Chromium 场景通过平台管理路由进入人员管理，覆盖负责人配置首次 503、打开配置弹窗触发重试、成功后恢复配置/弹窗/焦点，以及后续空网络错误文案回退。完整报告 `runtime/test-results/frontend-full-coverage-20261117-task-responsibility/` 退出 0；62 个产品源文件、1,305 项输入 `completed/stable/inputsStable=true`，`changedFiles=[]`、`changedInputs=[]`。LCOV 确认 `loadTaskResponsibilityConfig()` 调用 2 次，成功/失败两条加载路径均执行；在加载中重复调用的早退分支仍未覆盖。全前端行 10,667/11,928（89.42%）、分支 12,568/16,875（74.47%）。该函数场景使相关全局计数增加，但动态浏览器总量不全部归因于单点；平台行 100%、分支 95% 目标仍未达成。

## 2026-11-17T08:04:44+08:00 平台负责人配置加载与重试覆盖设计

最新稳定前端 LCOV 中 `app.js` 的 `loadTaskResponsibilityConfig()` 尚未执行。该异步流程由平台管理“人员管理”中的“责任人配置”弹窗真实触发，负责初次加载失败后的重试、恢复错误提示、重新加载成功后恢复弹窗和焦点。本轮在固定 Chromium 场景中经应用路由进入 `platform?tab=principals`，用本机 fetch 夹具令首次 `/api/document-tasks/config` 请求返回 503，验证错误态；再通过真实“责任人配置”按钮触发重试，验证成功配置、弹窗重开及负责人控件焦点；最后模拟无错误文案的网络异常，验证中文默认错误提示和弹窗恢复。恢复 fetch、confirm、路由和 appState，避免影响后续固定场景。先跑定向 Chromium 场景，再跑完整 62 源文件/1,305 输入清单；只有稳定门禁通过才采纳覆盖增量。

## 2026-11-17T07:59:42+08:00 认证状态矩阵匿名回退固定验收

在固定 Chromium 认证场景中增加匿名状态下 `displayName()` 返回默认中文名称的公开契约。完整复采报告 `runtime/test-results/frontend-full-coverage-20261117-auth-state-complete/` 退出 0；62 个源文件和 1,305 项输入 `completed/stable/inputsStable=true`，changed 文件/输入均为空。`common/state/auth-state.js` 达行 18/18、分支 33/33；`common/api/auth-api.js` 行 21/21、分支 26/26。前端快照行 10,642/11,928（89.21%）、分支 12,542/16,875（74.32%）；因跨场景浏览器计数存在波动，不将总量变化归因于单一场景。平台行 100%、分支 95% 目标仍未达成。

## 2026-11-17T07:48:00+08:00 认证状态匿名展示名回退补测设计

认证状态矩阵完整复采后，`common/state/auth-state.js` 为行 18/18、分支 32/33；唯一剩余分支是 `displayName()` 在整个会话对象缺失时，将用户投影回退为空对象。现有测试只覆盖已认证但 user 为空。补充匿名 `clearSession()` 状态下调用公开 `displayName()` 并断言返回“已登录用户”，随后仍通过 `setAuthState` 恢复后续矩阵。定向 Chromium 认证场景通过后，重跑固定前端 62 源文件、1,305 项输入清单并核验稳定门禁。

## 2026-11-17T07:34:56+08:00 认证状态公开访问矩阵覆盖设计

当前稳定固定前端报告中 `common/state/auth-state.js` 有一行和若干公开分支未命中。缺口涉及 `canAccessView` 的匿名/管理员与模块白名单判定、`firstAccessibleView` 的命中/空结果、`displayName` 的用户字段回退及 `canPerform` 的会话/用户动作来源。扩展固定 Chromium 认证场景，直接导入上述导出函数，逐个设置隔离 `authState` 并断言返回值，最后由既有 `finally` 恢复原状态。覆盖默认无模块清单、空/非空角色与动作集合、repository/cleaning/platform 访问、首个可访问视图和用户名称候选；不改产品实现。先跑定向认证场景，再跑固定前端完整清单并要求 62 源文件、1,305 项输入稳定后采纳增量。

## 2026-11-17T07:33:27+08:00 认证 API 错误与成功回退固定复采

固定前端认证 Chromium 场景通过公开 `AuthApiError` 和 `getSession()` 覆盖默认错误字段、无法解析 JSON 的 502 状态/中文文案回退、请求 ID 响应头及空值回退，以及成功响应 `content` 包装、原始对象和空 payload 的兼容投影。定向场景通过。

完整固定报告 `runtime/test-results/frontend-full-coverage-20261117-auth-api-complete/` 退出 0：62 个产品源码文件、1,305 项源码/测试/配置输入 `completed/stable/inputsStable=true`，`changedFiles=[]`、`changedInputs=[]`。`common/api/auth-api.js` 达到行 21/21、分支 26/26，相比前一稳定报告增加 5 个分支和 0 行。全前端行 10,641/11,928（89.21%）、分支 12,537/16,875（74.29%）；跨完整运行仍有动态浏览器计数波动，不将总量变化归因于单一测试。平台行 100%、分支 95% 目标仍未达成。

## 2026-11-17T07:21:49+08:00 认证 API 成功响应兼容包装覆盖设计

固定完整复采已确认 `common/api/auth-api.js` 行 21/21、分支 24/26；剩余未覆盖条件在 `requestJson` 成功响应投影：服务端以 `{content: ...}` 包装、直接返回对象，或返回空值时依次回退。继续沿用同一真实 Chromium 认证场景，通过公开 `getSession()` 和本机 fetch 夹具分别返回三类 payload，断言返回内容为包装中的 content、原始对象本身和空对象 `{}`。先执行定向认证场景，再完整运行固定前端清单；仅采纳退出 0 且 62 源文件/1,305 输入完整稳定的结果，不改产品行为或覆盖率分母。

## 2026-11-17T07:08:32+08:00 认证 API 客户端错误回退覆盖设计

最新稳定前端 LCOV 中 `common/api/auth-api.js` 仍缺 `AuthApiError` 默认构造字段、错误响应体无法解析时的 HTTP 状态码/文案回退，以及请求 ID 从 `x-request-id` 响应头和空值回退的公开分支。该文件属于前端请求客户端契约，不修改后端行为。

在固定前端采集器既有真实 Chromium 认证场景中，通过导出的 `AuthApiError` 与 `getSession()` 验证默认属性；随后由本机页面 fetch 夹具分别提供 JSON 解析抛错且含 `x-request-id` 的 502、可读但无错误对象且无请求 ID 的 503。断言 `AUTH_HTTP_502`、默认中文文案、响应头请求 ID，以及 `AUTH_HTTP_503`、payload message/code 和空请求 ID；请求均由公开 API 发起。伪代码：`assert(new AuthApiError('x') has default fields); stub one local malformed 502; assert(getSession error fallback); stub one local 503 payload without error/requestId; assert payload/header fallbacks; restore fetch and auth state`。先执行定向固定 Chromium 认证场景，再完整运行固定前端 62 源文件/1,305 项输入清单；仅在退出 0 且 source-stability completed/stable/inputsStable 为真、变更清单为空时采纳增量。当前稳定前端总量行 10,639/11,928、分支 12,528/16,875；全平台目标仍为行 100%、分支 95%。

## 2026-11-17T07:04:48+08:00 HTML 报告质量复核与审核预取分支固定复采

专业报告能力按业界产品职责映射：Allure 的运行概览与失败证据、Playwright HTML Reporter 的状态筛选和用例定位、ReportPortal 的质量指标、pytest-html 的离线详情与日志。当前中文报告具备运行总览、测试场景分页、逐条结果和失败日志、跨场景搜索/状态筛选/深链、原始 JSON 与可选覆盖率门禁。既有 REA 6.7.0 桌面及 390px 完整 Evidence 和当前报告截图已复核，未发现需要新增改动的可复现缺陷；内部质量量表 9.5/10，非第三方认证。历史大报告冷开超过 100ms 的限制继续保留，不用 smoke 结果外推所有规模。当前 shell 中 REA CLI 缓存包缺少编译运行时，因此本轮没有声称生成新的 REA Evidence。

继续固定前端覆盖工作：报告 `runtime/test-results/frontend-full-coverage-20261117-review-ticket-prefetch/` 完整退出 0，62 个源文件和 1,305 项输入 `completed/stable/inputsStable=true`，changed 列表为空。真实工作台场景验证 URL 含 `ticket` 时跳过审核 bootstrap 预取；`common/api/review-bootstrap-prefetch.js` 行 15/15、分支 29/29，相较上一完整报告增加 1 个目标模块分支。全前端当前行 10,639/11,928（89.19%）、分支 12,528/16,875（74.24%）；与上一动态浏览器快照相比总分支少 8 项，故不声称全局净增。行覆盖率 100%、分支覆盖率 95% 平台目标仍未达成。

## 2026-11-17T06:52:00+08:00 UI 图标 hydration 空值分支固定验收

在固定采集器现有 UI 图标公开契约场景中增加 `hydrateSemanticIcons(null)` 应安全返回的断言。完整采集报告 `runtime/test-results/frontend-full-coverage-20261117-ui-hydration-null/` 退出 0，62 源文件及 1,305 项输入 `completed/stable/inputsStable=true`、changed 列表为空。`common/ui-system.js` 行 27/27、分支 26/26；前端总计行 10,639/11,928（89.19%）、分支 12,536/16,875（74.28%），较上一固定报告净增 3 个分支，目标模块直接贡献 1 项。平台目标仍未达成。

## 2026-11-17T06:40:29+08:00 UI 图标 hydration 空根节点边界设计

当前最新固定前端报告中，`common/ui-system.js` 唯一未覆盖分支是 `hydrateSemanticIcons(root)` 对缺少 `querySelectorAll` 的根节点提前返回。该函数是共享 UI 防御性接口，计划在 `collect-frontend-istanbul-coverage.cjs` 的既有真实 Chromium UI 契约场景中导入并断言 `hydrateSemanticIcons(null) === undefined`，维持其他图标映射、按钮和空态契约检查不变。伪代码：`assert(hydrateSemanticIcons(null) === undefined); run existing semantic icon contract matrix;`。完整固定复采仍须 62 个源码文件和 1,305 项输入稳定、退出码为 0；不更改产品行为或分母。

## 2026-11-17T06:39:27+08:00 导航根路径边界固定复采

固定 LCOV 显示 `common/state/navigation.js` 唯一未覆盖路径是 `viewFromPath` 对根路径 `/` 的长度分支。将 `viewFromPath('/') === null` 加入现有固定 Chromium 导航状态契约。首次尝试非正式支持的 `KC_FRONTEND_ISTANBUL_SCENARIO=navigation-state` 被采集器拒绝并在进入测试前退出 1，没有形成覆盖证据；改为执行完整固定前端采集 `runtime/test-results/frontend-full-coverage-20261117-navigation-root/` 后，62 源码文件、1,305 项输入稳定，`completed/stable/inputsStable=true`、变更清单为空。`navigation.js` 行 23/23、分支 22/22。前端总计仍为行 10,639/11,928（89.19%）、分支 12,529/16,875（74.24%）；总计相对上份稳定报告无净增，故只确认文件级未覆盖分支补齐，不声称全局覆盖增益。平台目标仍未达成。

## 2026-11-17T06:25:57+08:00 任务下载回退分支固定复采结果

`document-tasks-frontend.test.cjs` 的隔离真实 HTTP/Chromium 测试保留真实 CSV 下载，并新增同源单次 502 非 JSON 响应与缺少 `Content-Disposition` 的成功下载。浏览器断言错误提示“下载失败（HTTP 502）”及默认文件名 `download.csv`（Chromium 根据 CSV MIME 类型追加扩展名）。定向测试 2/2 通过。

固定前端全量采集报告 `runtime/test-results/frontend-full-coverage-20261117-download-fallback/` 退出 0；62 个产品源码文件、1,305 项源码/测试/配置输入全部稳定，`completed=true`、`stable=true`、`inputsStable=true`，`changedFiles=[]`、`changedInputs=[]`。`common/api/document-tasks-api.js` 行 31/31、分支 27/27，较上一稳定采集新增 3 个分支覆盖。前端总计行 10,639/11,928（89.19%）、分支 12,533/16,875（74.26%）；总行数比上一动态浏览器采集少 2 行，不能归因于本次测试，按较新稳定快照记录。全平台行 100%、分支 95% 目标尚未达到。

## 2026-11-17T06:11:12+08:00 任务下载响应回退分支补测设计

持续目标：知识中心管理平台行覆盖率 100%、分支覆盖率 95%。最新稳定前端 LCOV 中 `common/api/document-tasks-api.js` 的下载实现还有 3 个未覆盖分支：错误响应无法解析 JSON 时生成 HTTP 状态回退文案、成功响应缺少 `Content-Disposition` 时使用空值、文件名无法从响应头解析时回退为 `download`。该模块已进入固定前端 62 文件分母，不能排除或改写统计范围。


在现有 `document-tasks-frontend.test.cjs` 真实 HTTP/Chromium 流程中保留真实 CSV 下载作为正常路径，再经单次本地浏览器响应夹具分别模拟：带无效 JSON 正文的 502 响应，应显示“下载失败（HTTP 502）”；无 `Content-Disposition` 的成功 CSV 响应，应触发下载并以 `download` 为默认名（Chromium 添加 `.csv` 扩展名）。每个夹具仅应用于一次请求，并断言页面恢复正常。伪代码：`download(real export API) -> assert server filename/content; intercept one same-origin export response with 502 invalid JSON -> assert HTTP fallback alert; intercept one successful response without disposition -> assert downloaded filename == download.csv; restore routes`。先跑定向 Chromium 测试并核查模块分支，再运行完整固定前端采集，要求 62 个源文件及 1,305 项输入稳定、退出码为 0 后才认定覆盖增量；不缩小分母。

## 2026-11-17T06:04:28+08:00 专业 HTML 报告 REA 当前产物复核

参考 Allure（运行和失败概览）、Playwright HTML Reporter（状态筛选与用例定位）、ReportPortal（质量指标）和 pytest-html（离线明细与日志）。复核当前生成器与桌面/390px REA 截图后未发现具体交互或布局缺陷，沿用已有报告能力，不作无依据的样式改动。

真实运行 `python3 tests/run_tests.py smoke --report-page-size 2`：2/2 任务、24/24 用例通过，报告 `runtime/test-results/smoke/20261117-060059-039771-smoke/report.html`，生成 12 个静态场景分页。入口回归 `python3 -m unittest tests.unit.root.test_run_tests`：54/54。

REA 6.7.0 Evidence 均为 completed/complete，浏览器为受控 Chromium 149，捕获 URL、截图和无障碍树，仅访问本机 `127.0.0.1:18769`；REA 自有浏览器已清理。桌面 Evidence `ev_f4c775b68d1f6f2e8fabc723c424f46f344ec52975b84b7b7b6511c8f33c7531`，移动 Evidence `ev_f958fb6ffae114e2b16cbbd30179ff0228953f0c4357d87aad7a3dff62ea3f49`。原始输入、Evidence 和 PNG 位于 `runtime/rea/professional-test-report/current-smoke-rea-20261117-0600-*`。

独立离线 Chromium 桌面和 390px 各导航 10 次；均搜索到 17 条 `ConfigValidator` 用例并能深链，无 JavaScript 时场景分页仍可读。零页面错误、外部请求及横向溢出；DOMContentLoaded P95 为 17.4ms/10.0ms，完整页面加载均低于 20ms。原始数据和截图见 `runtime/rea/professional-test-report/current-smoke-verification-20261117-0600.json`。内部七项量表 9.5/10：数据可信 2/2、失败定位 2/2、检索导航 2/2、视觉层级 1.5/1.5、无障碍与移动端 1/1、离线与性能 0.5/1、可追溯 0.5/0.5。该分数为内部自评，非第三方认证；历史 3,469 用例大型报告冷开曾超过 100ms，有限 smoke 不能证明大型报告性能已达标。本次 smoke 未启用覆盖率，不代表平台行 100%/分支 95% 门槛达成。

## 2026-11-17T05:58:07+08:00 来源记录安全投影固定前端复采

在 `document-tasks-frontend.test.cjs` 的本机真实 HTTP/Chromium 场景中，增加 `renderSourceRecord(null, null)` 和不可信标题输入，断言“PingCode 未填写”/“暂无详情内容”回退与 HTML 转义。定向场景通过；固定前端全量报告 `runtime/test-results/frontend-full-coverage-20261117-source-record/` 的 62 源文件、全部既有固定场景完成，1,305 项输入 `completed/stable/inputsStable=true`，`changedFiles=[]`、`changedInputs=[]`。

`common/safe-source-markdown.js` 从行 6/7、分支 4/6 提升至行 7/7、分支 6/6。全前端行覆盖 10,641/11,928（89.21%），分支 12,529/16,875（74.24%）；相较上一完整稳定运行增加 3 行、7 分支，其中新增测试直接贡献于目标模块的 1 行、2 分支，其余总量变化分布于动态浏览器场景，不能全部归因于该测试。Node 最新完整稳定为行 17,383/17,621、分支 18,176/20,561；Java 最近完整稳定为行 5,037/5,112、分支 3,206/3,890。三端仍未达目标。

## 2026-11-17T05:45:12+08:00 共享来源记录投影覆盖

最新稳定前端 LCOV 中 `common/safe-source-markdown.js` 的正文渲染路径已覆盖，但公开 `renderSourceRecord` 函数及标题默认值/转义分支仍未执行。扩展固定前端采集已有的真实 HTTP/Chromium 任务场景，验证缺少标题和正文时显示默认中文文案，以及不可信标题被 HTML 转义。通过固定 Istanbul 注入捕获模块分支，不改产品代码和源码分母；先执行单场景，再运行完整固定前端 62 源文件清单并核对 1,305 项输入哈希稳定。

## 2026-11-17T05:31:06+08:00 工作台空页码分支与固定前端复采

真实 390px 工作台 Chromium 场景补充空页码提交：显示页码错误且不发送查询。定向场景通过，固定前端完整清单 `runtime/test-results/frontend-full-coverage-20261117-page-jump-empty/` 完成 62 个产品文件及全部导航、浏览器和 API 场景；1,305 项输入 `completed/stable/inputsStable=true`，changed 列表为空。`common/page-jump.js` 达到行 10/10、分支 9/9。

当前固定前端总量为行 10,638/11,928（89.18%）、分支 12,522/16,875（74.20%）。与紧邻的 `20261117-page-jump` 完整运行相比，总计少 2 行、3 个分支：`app.js` 少 2 行但多 1 分支、`modules/platform-admin/view.js` 少 5 分支、`modules/production/production-writing-page.js` 少 1 分支、`common/scroll-runtime.js` 多 1 分支。输入哈希一致检查证明采集期间文件未变，但两次动态浏览器运行计数有差异；因此以本次数据作为较新完整快照，不把差异解释为代码变化或覆盖增益。Node 最新完整稳定为 17,383/17,621 行、18,176/20,561 分支；Java 最近有效完整数据为 5,037/5,112 行、3,206/3,890 分支。三端目标仍未达成。

## 2026-11-17T05:31:06+08:00 工作台分页拒绝空页码

`page-jump.js` 固定前端 LCOV 剩余分支对应空白输入判断，真实工作台浏览器用例此前只覆盖有效页和越界页。增加清空页码后提交的交互断言：页面显示页码错误、聚焦错误态且不发起新的任务查询。此测试由固定前端采集器筛选执行，覆盖导出包含刷新前后两段页面计数；补测后重跑完整 62 文件及 1,305 项输入固定采集，检查输入哈希稳定。

## 2026-11-17T05:28:30+08:00 固定前端工作台跳页场景稳定复采

将“工作台可跳至指定页并按关联版本筛选，刷新保留条件”接入固定前端 Istanbul 场景，并在页面刷新前后分别导出浏览器计数，避免导航重载清空首次交互计数。定向真实 Chromium 场景通过；合并前后快照后 `common/page-jump.js` 为行 10/10、分支 8/9。

固定前端全量复采 `runtime/test-results/frontend-full-coverage-20261117-page-jump/` 完整退出 0，62 个产品源文件及全部固定浏览器/API 场景成功；1,305 项运行输入稳定，`completed/stable/inputsStable=true`，`changedFiles=[]`、`changedInputs=[]`。行 10,640/11,928（89.20%），分支 12,525/16,875（74.22%），较上一稳定报告净增 14 行、21 分支。前端距离行全覆盖还差 1,288 行，达到 95% 分支还需覆盖 3,507 项；Node 最新稳定行 17,383/17,621、分支 18,176/20,561，Java 最近完整稳定行 5,037/5,112、分支 3,206/3,890。全平台目标仍未达成。

## 2026-11-17T05:13:22+08:00 固定前端采集加入工作台跳页场景

固定前端 Istanbul 报告显示 `common/page-jump.js` 仅有 2/10 行被计数。排查发现 `knowledge-center-my-work.node.test.cjs` 已有真实 390px Chromium 场景，覆盖跳到第 3 页、越界输入错误提示、版本筛选和刷新恢复，但固定采集器 `runMyWorkCoverage` 的名称筛选漏掉该用例。将用例纳入固定采集并在页面刷新前后分别导出 Istanbul 计数，避免刷新重置页面内计数；固定工作台快照预期由 8 增至 10。页面/API 行为及源文件分母不变。

伪代码：`instrument real knowledge-center page; run selected page-jump test; assert page=3 request, invalid page does not request, scope version survives reload; export page Istanbul map; merge snapshot in fixed collector`。先运行定向 Playwright/Node 场景并确认 `page-jump.js` 的行/分支计数，再运行固定前端全套，要求 62 源文件及全部测试/场景输入前后哈希稳定后采纳覆盖增量。

## 2026-11-17T05:00:27+08:00 关系表变化历史分页边界覆盖

固定 Node 覆盖报告中 `routes/document-tasks.js` 的关系表变化历史 handler 分支尚未经 HTTP 场景触发。扩展 `document-task-relational-read-http.test.js`，使用本地 HTTP handler 和隔离关系存储，覆盖默认分页、合法显式分页、非正数/小数页码及超范围页大小；校验非法请求返回 422 与 `PINGCODE_CHANGE_PAGE_INVALID`，且不调用下游 changes 查询。该场景仅验证公开分页契约，不写共享存储或修改产品逻辑。

伪代码：`GET /:number/sync-changes with defaults and valid query -> assert response and delegated page; for invalid page/pageSize -> assert 422/code and no storage call`。Jest 定向 6/6 通过。固定 Node 清单 209 个 Jest 文件中 208 套通过、1 套条件跳过，3,068 项通过、9 项跳过；372 项输入哈希稳定且 `changedInputs=[]`。报告 `runtime/test-results/node-full-coverage/20261117-sync-changes/`：Node 行 17,383/17,621（98.64%）、分支 18,176/20,561（88.40%），对上次稳定报告净增 7 行、12 分支；`document-tasks.js` 为行 814/881、分支 1,424/1,713。Node 距全行覆盖还差 238 行，达到 95% 分支还差 1,357 项；前端及 Java 仍未达到平台目标，因此全目标继续 active。

## 2026-11-17T04:54:15+08:00 工作台投影场景与 Node 固定复采

`knowledge-center-workbench-http-coverage.test.js` 新增真实 HTTP 场景，覆盖责任人可见的已分配审核、本人生产任务创建 MR/刷新交付/关闭后修订/无可用动作，以及有效 HTTPS、HTTP 和含凭据 MR URL 的安全投影。定向 Jest 通过。

固定 Node 209 个 Jest 文件全部完成：3,075 项中 3,066 通过、9 项条件跳过。372 项输入哈希稳定，`changedInputs=[]`。覆盖率报告 `runtime/test-results/node-full-coverage/20261117-workbench-projection/`：行 17,376/17,621（98.60%），分支 18,164/20,561（88.34%），对上一稳定采集净增 11 个分支。Node 距行全覆盖还差 245 行，距离 95% 分支还差 1,368 项。前端行 10,624/11,928、分支 12,513/16,875；Java 行 5,037/5,112、分支 3,206/3,890。平台目标仍未达成。

## 2026-11-17T04:34:49+08:00 GitLab 远端版本标识覆盖复采

在本地真实 GitLab 服务场景加入远端 commit、blob 和 snapshot ID 漂移拒绝，以及 GitLab 响应缺少路径/版本字段时回退至已授权路径和请求快照 ID 的回读验证。原生 HTTP 和 Jest bridge 定向用例通过，拒绝分支不调用 AI。

固定 Node 209 个 Jest 文件复采退出 0；3,074 项中 3,065 通过、9 条件跳过。372 项源码/测试输入稳定，`changedInputs=[]`。报告 `runtime/test-results/node-full-coverage/20261117-gitlab-version-boundaries/` 行 17,376/17,621（98.60%），分支 18,153/20,561（88.28%），比上一稳定采集净增 7 个分支。Node 距行全覆盖还差 245 行，达到 95% 分支还差 1,379 项。前端最近稳定为行 10,624/11,928、分支 12,513/16,875；Java 为行 5,037/5,112、分支 3,206/3,890；全平台目标仍未达成。

## 2026-11-17T04:24:20+08:00 AI 来源快照身份矩阵与 Node 稳定复采

扩展隔离真实 HTTP 用例，验证来源快照中的手册/文档身份不匹配、平台正文摘要漂移、平台分支不匹配、映射手册提交空白来源、GitLab 写作分支不匹配及固定旧基线缺 commit。原生 `node:test` 单场景和固定 Jest 桥接单场景均通过，提前拒绝路径断言不新增 GitLab 文件读取或 AI 调用。

固定 Node 清单 209 个 Jest 文件全部完成，3,074 项中 3,065 通过、9 项条件跳过；372 项源码及测试输入哈希稳定，`completed=true`、`inputsStable=true`、`changedInputs=[]`。报告 `runtime/test-results/node-full-coverage/20261117-origin-snapshot-matrix/`：行 17,376/17,621（98.60%），分支 18,146/20,561（88.25%）；与 04:14 稳定复采相比净增 7 个分支。Node 尚缺 245 行，达到 95% 分支还差 1,386 项。前端最新稳定行 10,624/11,928、分支 12,513/16,875；Java 行 5,037/5,112、分支 3,206/3,890，尚分别缺 1,304 行/3,519 分支和 75 行/490 分支。平台目标仍未达成。

## 2026-11-17T04:14:22+08:00 AI 来源快照边界与 Node 固定复采

在 `handbook-production-api.test.js` 的隔离真实 HTTP 场景增加已映射手册缺失快照、平台摘要格式错误、GitLab 快照缺少路径/分支/版本标识三类拒绝请求。均断言公开状态码和错误码，且拒绝时不读取 GitLab、不调用 AI。原生测试 31 项（29 通过、2 按环境跳过）；固定 Jest 桥接套件 101 项通过、6 项按环境跳过。

Node 固定 209 个 Jest 文件全量复采退出 0，372 项源码/测试输入 `inputsStable=true`、`changedInputs=[]`。相较 `20261117-033303` 同分母报告，行覆盖由 17,373/17,621 提升到 17,376/17,621（98.60%），分支由 18,137/20,561 提升到 18,139/20,561（88.22%）。新报告：`runtime/test-results/node-full-coverage/20261117-origin-snapshot-fixed/`。前端和 Java 的最近有效稳定报告仍为下述 03:48:40 记录：前端行 10,624/11,928、分支 12,513/16,875；Java 行 5,037/5,112、分支 3,206/3,890。Node 尚缺 245 行，达到 95% 分支还差 1,393 项；前端尚缺 1,304 行、分支差 3,519 项；Java 尚缺 75 行、分支差 490 项。平台目标仍未达成。

## 2026-11-17T03:48:40+08:00 模型网关输入矩阵与三端复采结果

模型网关纯函数测试扩展后为 20/20 通过，覆盖错误摘要地区限制、401/403/429、连接拒绝、超时、JSON、5xx 和未知输入，以及空配置/零值状态默认。固定 Node Jest 209 个文件通过，372 项输入 `completed=true`、`inputsStable=true`：行 17,373/17,621（98.59%），分支 18,137/20,561（88.21%），较前次稳定报告净增 8 个分支。前端固定采集 62 个产品文件及固定场景完整，1,305 项输入 `completed/stable/inputsStable=true`：行 10,624/11,928（89.06%），分支 12,513/16,875（74.15%）。Java 48 项完整采集清单哈希仍与当前工作树相符：行 5,037/5,112（98.53%），分支 3,206/3,890（82.42%）。三个报告输入在采集后再次核验均无变化。

当前分别还缺行 248、1,304、75；达到各自 95% 分支门槛还需覆盖 1,396、3,519、490 项。证据目录：`runtime/test-results/node-full-coverage/20261117-033303/`、`runtime/test-results/frontend-full-coverage-20261117-final3/`、Java `runtime/test-results/full/20261117-015816-787634-full/details/coverage/java/`。全平台覆盖目标仍未达成。

## 2026-11-17T03:30:57+08:00 模型错误摘要与默认状态分支

最新固定 Node LCOV 显示 `routes/model-provider.js` 的错误摘要和状态投影存在未执行条件。扩展纯函数单测，验证 `errorSummary` 对地区限制、HTTP 401/403/429、两种连接拒绝文案、两种超时文案、JSON 格式错误、HTTP 5xx（含有无 HTTP 前缀）和未知/空输入的中文归类；补 `safeStatus` 空配置与零值时的默认温度、token 数及超时。此测试仅验证本地响应投影，不连接模型服务或写配置。

伪代码：`for input, expected in representative provider error matrix: assert errorSummary(input)==expected; assert safeStatus(undefined) defaults; assert safeStatus({model, max_tokens:0, timeout:0}) uses documented defaults`。先运行模型网关定向 Jest/插桩，再纳入固定 Node 209 文件采集并核验稳定分支净增。

## 2026-11-17T03:28:04+08:00 模型网关错误响应与三端稳定复采

模型网关 HTTP 测试 4/4 通过。流式生成器在首段前失败原会将 JSON 错误正文标记为 `text/event-stream`；现在未发送响应头时移除 SSE 专用头，再返回 JSON Provider 错误。已发送 SSE 后的错误事件保持原样。视觉调用上游失败也验证映射为 502 `MODEL_PROVIDER_CALL_FAILED`。

固定 Node Jest 209/209 个文件通过，372 项输入稳定：行 17,373/17,621（98.59%），分支 18,129/20,561（88.17%）。相较前次稳定采集净增 4 行、1 分支。前端固定采集 62 个产品文件与既有场景完成，1,305 项输入 `completed/stable/inputsStable=true`：行 10,626/11,928（89.08%），分支 12,504/16,875（74.09%）。Java 当前完整采集涉及 48 项输入均与最新稳定报告哈希一致：行 5,037/5,112（98.53%），分支 3,206/3,890（82.42%）。Node 与前端采集输入在报告后再次对照当前工作树均无变化。

当前分别还缺行 248、1,302、75；达到各自 95% 分支门槛还需覆盖 1,404、3,528、490 项。采集证据：`runtime/test-results/node-full-coverage/20261117-031211/`、`runtime/test-results/frontend-full-coverage-20261117-final2/`、Java `runtime/test-results/full/20261117-015816-787634-full/details/coverage/java/`。平台行 100%、分支 95% 目标未完成，继续推进。

## 2026-11-17T03:08:41+08:00 模型网关流式与视觉上游错误边界

最新固定 Node LCOV 中 `routes/model-provider.js` 有两条未覆盖错误处理行：流式生成器在发送响应头前抛错时应回普通 Provider 错误响应；视觉模型调用失败时应同样经 `providerError` 返回稳定 HTTP 错误结构。扩展既有真实本地 HTTP 测试的确定性 LLM 替身，不接外部模型服务。

定向执行暴露：路由在进入异步生成器前已设置 `text/event-stream`，生成器第一段前失败时虽然调用 JSON 错误处理，但 Express 保留了预设 SSE Content-Type。修正未发送响应头的 catch 分支，移除 SSE 专用头后再返回 JSON Provider 错误；已发送数据后的失败继续以 SSE error 事件结束。

伪代码：`mode=stream-failure-before-start; POST /chat/stream -> assert 502 application/json MODEL_PROVIDER_CALL_FAILED; mode=stream-failure-after-start -> assert SSE error event; mode=failure; POST /vision -> assert 502 MODEL_PROVIDER_CALL_FAILED`。先跑路由 HTTP 测试和单文件插桩，再纳入固定 209 文件 Node 清单验证稳定覆盖增量。

## 2026-11-17T02:30:29+08:00 本轮固定 Node 与前端全量采集验收

知识资产查询映射容错测试 6/6 通过；固定 Node Jest 清单 209/209 个测试文件通过，372 项输入前后哈希一致。Node 行覆盖 17,369/17,619（98.58%），分支 18,128/20,561（88.16%）；相较 `20261117-015816-787634-full` 稳定全量基线新增 1 行、15 分支。

前端首次复采两次在我的工作嵌套查询浏览器场景发生本地静态 JS 二次代理 `ECONNRESET`。将插桩夹具改为读取已限制在前端根目录内的源文件并直接 fulfill JavaScript，避免覆盖采集依赖额外代理请求；非插桩业务页面仍运行在隔离本地服务，真实 HTTP API 场景保持。完整我的工作浏览器文件 20/20 通过。最终前端固定采集 62 个源文件及既有固定场景全部完成，1,305 项输入 `completed/stable/inputsStable=true`、变更清单为空；行 10,624/11,928（89.06%）、分支 12,511/16,875（74.13%）。Java 完整采集的 48 项源码/夹具输入与当前工作树哈希一致，维持行 5,037/5,112（98.53%）、分支 3,206/3,890（82.42%）。

当前三端分别还缺行 250、1,304、75；达到各自 95% 分支目标还需覆盖 1,405、3,521、490 项。覆盖率证据：`runtime/test-results/node-full-coverage/20261117-023239/`、`runtime/test-results/frontend-full-coverage-20261117-final/`、Java `runtime/test-results/full/20261117-015816-787634-full/details/coverage/java/`。因此平台行 100%、分支 95% 目标仍未完成，后续继续以固定分母和稳定输入采集逐项推进。

## 2026-11-17T02:30:29+08:00 前端插桩静态资源避免二次代理连接重置

当前固定前端全量采集连续两次在 `knowledge-center-my-work.node.test.cjs` 联合查询场景发生 `route.fetch: read ECONNRESET`。失败位于 Playwright 为改写前端 JS 而向同一临时服务再次代理请求；业务 HTTP 场景本身此前已有独立通过记录。调整仅用于覆盖插桩模式：对仓库内已校验且存在的前端 JS 文件直接读取源码、插桩后以 JavaScript 响应交给浏览器；产品页面/API 仍由原本地 HTTP 服务提供，非前端脚本/不存在文件仍走 `route.continue()`。

伪代码：`resolve request path under frontend root; reject path escape/vendor/missing -> continue; source=readFileSync(resolved); instrument(source); fulfill as application/javascript`。先运行固定工作台 Node 浏览器场景确认页面与 HTTP 断言，再复采完整固定前端清单并要求采集完成、源与输入哈希稳定。

## 2026-11-17T02:30:29+08:00 知识资产查询的无效映射配置回退

最新稳定 Node LCOV 中 `lib/knowledge-asset-utils.js` 有 1 行未覆盖；第 76 行捕获 GitLab 映射结构异常并回退到空映射。为验证查询在错误映射配置下仍能返回资产且不声称仓库已关联，在现有知识资产投影测试中传入形状错误的 `mappings` 对象，断言手册正常返回但 `repositoryMapped=false`、`repository=null`。这只测试公开查询函数的容错投影，不写生产配置。

伪代码：`result=queryKnowledgeAssets(payload, params, false, {mappings: {}}); assert item returned; assert no repository mapping;`。先运行对应 Jest 和 Node 单文件插桩确认新增语句及 catch 分支命中，再把自动发现的测试纳入完整固定 Node Jest 清单并比较覆盖前后计数；全量输入须稳定才认定平台增量。

## 2026-11-17T02:19:30+08:00 工作台任务动作投影矩阵

最新三端稳定覆盖中，知识中心路由的责任人工作台投影仍缺少多种由文档任务状态决定的动作码。扩展现有真实 HTTP handler 测试，向隔离 `tasks.json` 写入互不相干的工单范围待确认、工单不涉及待完成、手册范围待确认、新文档待创建、现存文档待编写，以及等待其他责任人编写六种任务；通过 `/api/workbench/my-tasks/query` 读取真实投影，核对 `confirm_scope`、`complete_scope`、`create_document`、`write_document` 和 `view_progress`、URL 与责任人归属。手册资源和人员目录仍由同一隔离 handler 夹具返回，服务不接共享数据库。

伪代码：`seed isolated task state by projection kind; POST actionable query as platform operator for writer; assert expected action code/label/url for each actionable task; POST waiting query; assert view_progress projection and unrelated tasks absent`。运行定向 Jest 后用 Node 单文件 Istanbul 诊断确认对应分支，再纳入固定 209+ Jest 全量采集；只有固定输入哈希稳定的完整覆盖采集才用于更新平台分子。

## 2026-11-17T01:49:00+08:00 测试夹具 HTTP 路由覆盖

最新完整固定 Node 输入稳定采集为 17,340/17,619 行、18,089/20,561 分支。知识中心路由最大缺口之一是本工作树新增的两个受环境开关保护的测试夹具 POST 接口：`/api/test-fixtures/incremental-baselines` 与 `/api/test-fixtures/incremental-tasks`。固定 Node 覆盖报告中两个路由尚未执行，约 40 余行及相关状态/错误分支未覆盖。新增真实本地 HTTP handler 测试，验证 GET 方法不开放夹具接口、开关关闭时 POST 返回 404，开启后基线/任务创建向对应服务传递认证 session、幂等键和 JSON 正文并返回 201；分别验证服务不可用映射 503，以及创建异常保留服务状态/错误码和默认 500/错误码/文案回退。测试恢复环境变量、关闭 HTTP 服务并删除临时目录；不访问部署环境或改变业务数据。

伪代码：`start(realHandler, tempStorage); POST both paths with flag off -> 404; set flag=1; inject createSyntheticBaseline/create; POST -> assert session, idempotency key, body and 201; inject unavailable/throwing services -> assert status and error payload; restore env and close server`。先执行定向 HTTP Jest 和单文件插桩确认新增路径已执行，再把测试纳入固定全量 Node 清单；平台覆盖增量只接受全部固定输入哈希稳定的完整采集。

## 2026-11-17T01:36:57+08:00 专业报告覆盖率状态一致性

参考 Allure 运行总览、Playwright HTML Reporter 结果定位、ReportPortal 质量指标和 pytest-html 离线详情。当前覆盖率快照对缺失分母显示“未统计”、缺失目标显示“目标未配置”，但下方门禁明细在分母存在而目标缺失时显示“未达标”，同一运行时的状态相互矛盾。统一状态优先级为：任一指标分母缺失则“未统计”；分母齐全但任一目标缺失则“目标未配置”；其余按原始计数判定“达标/未达标”。缺失目标的进度条使用中性颜色，不呈现失败色。已保存的整体门禁结果仍保持原样，不根据展示层重新推断。

伪代码：`inspect(lines, branches) -> missing_total ? 未统计 : missing_target ? 目标未配置 : all(raw_counts_meet_targets) ? 达标 : 未达标; render snapshot and detail with same state`。验收覆盖目标缺失、分母缺失、真实未达标和达标；重建真实运行报告并在桌面/390px 浏览器核验布局、状态和首屏耗时。

## 2026-11-17 前端插桩静态资源连接重置恢复

最新固定全量采集的前端 Jest/导航场景已通过，但 Istanbul 浏览器采集在 `knowledge-center-my-work.node.test.cjs` 的“联合查询面板支持嵌套组并将条件保存在 URL”期间，Playwright `route.fetch()` 获取本机 `repository/view.js` 时发生 `ECONNRESET`，使整份前端 coverage summary 缺失。相同插桩场景独立运行 1/1 通过，因此故障定位在本地静态资源代理的瞬时连接，不是该场景业务断言。只允许 `ECONNRESET` 最多重试两次并短暂等待；非连接重置立即失败，耗尽仍失败，HTTP 非 2xx 的现有透传行为不变。伪代码：`for attempts 0..2: try response=route.fetch(); catch ECONNRESET and attempts<2 -> wait 100ms; otherwise throw; instrument successful response and fulfill`。完整前端采集须通过且 `source-stability.json` 的 completed/stable/inputsStable 全真才接纳计数。

## 2026-11-17 DSH 模型代理监听失败契约

定向 DSH 插桩中，初始适配器为 169/170 行、94/112 分支，唯一完全未覆盖行是模型代理 Unix Socket 监听失败后的终态处理。使用固定 UUID 和测试独占的临时运行目录，先由本地 `net.Server` 占用目标 Socket，再调用公开 `start`；断言运行持久化为 `failed`、失败事件描述代理启动失败、没有启动 `systemd-run`，并在测试结束时关闭占用者。另以真/假版本、主机路径可见性、PID、网络事实矩阵验证 `sandboxFactsValid`，以 205 条进度事件验证事件缓存限长。这个夹具只证明本地逻辑，不证明真实 systemd 沙箱隔离。

伪代码：`reserve(targetSocket); mock randomUUID; run = adapter.start(validConfig); wait until get(run.id).status == failed; assert failure event and spawn calls == 0; close reserved socket; assert sandboxFactsValid(valid/invalid matrix); append 205 progress events and assert latest 200 retained`。定向 Jest 22/22 通过，DSH 适配器 170/170 行、95/112 分支；这是两份 DSH 测试的局部插桩结果。完整固定 Node 输入稳定采集前，不将其宣称为平台基线增量。

## 2026-11-16 DSH 适配器隔离契约覆盖

固定 Node 报告中 `agent-runtime/dsh-adapter.js` 仍有较大未覆盖区域。现有真实 SDK E2E 依赖 user systemd 与 user namespace；在不具备这些能力的主机上会按设计跳过，不能据此证明适配器记录读取和配置拒绝行为。新增临时目录单元契约，使用公开 `get`、`owns`、`cancel`、`start` 接口覆盖无效/缺失 UUID、遗留非终态记录持久化为 `interrupted`、终态读取不改写、运行记录归属、非活动运行取消回读，以及模型协议/必填字段/URL 协议/凭据/查询/片段拒绝。所有测试通过注入 root 写入系统临时目录，不触发探针、systemd、Agent 或模型网络请求。

伪代码：`adapter = create(root=temp, autoProbe=false); seed run.json; assert get/owns/cancel outcomes and persisted state; for invalid model configs assert start throws before creating UUID directory; assert temporary root cleanup`。定向 Jest 覆盖适配器新增路径；随后固定 Node 完整采集必须通过稳定门禁才采纳全量增益。目标仍为三端各行 100%、分支 95%。

定向 `dsh-runner.test.js` 15/15 通过，固定入口 `list` 将该文件计入 unit。独立 Jest 插桩对适配器呈现 41/170 行、44/112 分支；该定向数字没有证明较最近正式全量报告增加，待固定 Node 清单采集稳定后比较。

固定全量 Jest 清单串行复采 207 套通过、1 套条件跳过，3039 项通过、9 项跳过。覆盖源码与 208 个 Jest 文件共 371 项输入前后哈希一致（`source-stability.json`：completed/stable/inputsStable=true、changedInputs=[]）。Node 为 17230/17619 行（97.79%）、18038/20561 分支（87.72%）；与前一稳定 Node 计数相比净增 16 行、24 分支。DSH 适配器从 44/170 行、24/112 分支增至 60/170 行、48/112 分支。前端稳定 10624/11928 行、12504/16875 分支；Java 稳定 5037/5112 行、3206/3890 分支。三端门禁仍失败；Node 尚缺 389 行及 1495 个 95% 目标分支，前端尚缺 1304 行及 3528 个目标分支，Java 尚缺 75 行及 490 个目标分支。完整三端数据见 `runtime/test-reports/2026-11-16/20261116-230552-321745-full/details/coverage/`；Node 哈希证据见 `runtime/test-results/unit/20261116-232414-038519-unit/details/coverage/source-stability.json`。

## 2026-11-16T23:50:00+08:00 DSH 适配器本地生命周期覆盖设计

固定 Node 报告中 `agent-runtime/dsh-adapter.js` 仍缺运行适配器与模型代理的执行路径。新增隔离 Jest 契约，使用临时运行目录、受控 `child_process.spawn`、本地 Unix Socket 及 HTTP 客户端；验证模型代理的方法/路径白名单、请求体大小与模型校验、上游成功/空正文/失败响应、20 次请求上限；验证 Worker stdout 非 JSON/未知事件忽略、事件白名单、模型凭据脱敏、终态不被后续事件覆盖、stderr 脱敏持久化和进程失败/取消时代理清理；探针只验证受控本地 Socket 响应解析、版本/事实判定和进程启动异常回退。模拟子进程事实不能作为主机 systemd/user namespace 隔离证据，也不替代具备条件时执行的真实 DSH SDK E2E。

伪代码：`adapter(tempRoot, mockSpawn); run=start(validModel); send HTTP cases over run's Unix socket with mocked fetch; feed controlled stdout/stderr and process close/error events; assert redacted terminal state and cleanup; probe(mock child output) -> assert verifier state; probe(spawn error) -> assert fail-closed`。固定 Node 全量清单需将新 Jest 文件自动发现并执行；只有覆盖源码和完整测试输入稳定后才认定分子增量。

## 2026-11-16 覆盖率首屏快照

参考 Allure 的运行摘要、Playwright HTML Reporter 的快速定位、ReportPortal 的质量指标和 pytest-html 的离线明细。全量报告的覆盖率表位于场景表之后，首屏目前仅显示门禁结论，无法直接比较 Node、前端、Java 的实际行/分支覆盖率。总览指标后增加只读覆盖率快照：仅在报告包含运行时计数时展示，每个运行时显示行、分支百分比和独立门禁状态，点击可进入现有覆盖率明细。无总数或无目标时显示“未统计”或“目标未配置”，不推断达标；整体门禁仍使用既有原始计数判定。无覆盖率采集的报告保持原有“未采集”说明。

伪代码：`for runtime in coverage.runtime_metrics -> read lines/branches counts and targets -> compute percentages only when total > 0 -> compare raw counts to target -> render compact linked summary; keep detailed table as source of numerator, denominator and gap`。验收：覆盖混合达标、缺失总数、无目标、无采集；真实 smoke 与已有全量 JSON 生成；桌面和 390px 离线浏览检查无溢出、深链可用，并测量首屏打开时间。

## 2026-11-16T22:48:14+08:00 三端固定覆盖采集

PingCode 来源同步真实 HTTP 路由回归修正后的固定 Jest 清单纳入本轮三端覆盖采集。207 个 Jest 套件通过、1 个跳过；3,033 条用例通过、9 条跳过。Node 输入前后哈希一致，`source-stability.json` 为 `completed/stable/inputsStable=true`；前端 62 个源文件及固定浏览器场景完整，稳定门禁通过；Java 15 个源文件稳定，`changedFiles=[]`。

Node 行 17,214/17,619（97.70%）、分支 18,014/20,561（87.61%）；前端行 10,624/11,928（89.06%）、分支 12,510/16,875（74.13%）；Java 行 5,037/5,112（98.53%）、分支 3,206/3,890（82.42%）。此前 Node 全量输入曾在采集中变化，不是稳定基线；其 17,126/17,619 行、17,896/20,561 分支只作诊断计数对照，不声称正式净增。当前 Node 结果是本轮首次输入稳定全量证据。本轮加入的 PingCode 路由 HTTP 测试不是单独覆盖率证明；三端仍未达行 100%、分支 95%，全量门禁状态 FAIL。运行报告及分端证据在 `runtime/test-results/full/20261116-223046-277079-full/`。

## 2026-11-16T22:15:31+08:00 全量报告覆盖率状态前置

对最新 82 任务全量报告复核：覆盖率结果位于总览后半段，三端均未达标时首屏只提示运行失败；覆盖率进度条统一用蓝色，不直观区分达标与未达标。沿用 Allure 的运行状态总览及 ReportPortal 的质量指标定位，在总览标题下增加直达覆盖率表的状态链接，并按真实门禁结果给进度条着色。未启用采集时明确显示“未采集”，不得推断覆盖率。

伪代码：`read saved coverage status -> render text status and #coverage link -> for each measured runtime metric compare raw count against target -> paint pass/fail bar and retain percentage, numerator/denominator, target and gap`。验收覆盖有采集/无采集、达标/未达标及桌面/窄屏离线浏览；100ms 页面打开要求使用实测结果，不以静态代码推断。

最新全量报告的真实失败摘要还暴露了终端 ANSI 控制符，网页显示为不可读字符。HTML 展示和本地搜索索引剥离终端控制符，原始 `details/report.json` 与任务日志保留完整内容；HTML 特殊字符仍按原规则转义。验收使用包含 ANSI 与 HTML 标记的失败详情，并复验真实全量失败摘要。

## 2026-11-16T20:54:24+08:00 本轮验收结果

真实 smoke 2/2 任务、24/24 用例通过；生成报告路径为 `runtime/test-results/smoke/20261116-205305-740292-smoke/report.html`。报告回归 51/51。Chromium 离线验证在 1440px/390px 各进行 10 次导航，DCL P95 为 98.5ms/70.3ms；搜索命中 17 项、用例深链、无 JavaScript 场景分页和区块锚点通过，无页面脚本错误、外部请求或横向溢出。人工查看桌面/窄屏截图时发现并修正窄屏页脚链接贴连。

当前会话没有 REA MCP 工具，本轮复用了 `runtime/rea/professional-test-report/` 中已有官方来源和 REA Chromium 证据，并用本地 Playwright 对新改动实测；未声称新建 REA Evidence。业界参考维持 Allure、Playwright HTML Reporter、ReportPortal、pytest-html 的运行概览、状态筛选/定位、质量概览、离线明细与日志能力。报告质量内部评分为 9.5/10，性能维度保留 0.5 分扣减；这是基于本轮小型 smoke 和既有边界的内部评价，不是第三方认证。平台行覆盖 100% / 分支覆盖 95% 仍需全量稳定覆盖率验收。

## 2026-11-16T20:50:56+08:00 长报告区块导航

全量运行包含大量任务时，总览中的失败、场景、覆盖率、任务和耗时诊断相隔较远。参考 Allure 的概览入口和 Playwright HTML Reporter 的结果定位，在四项指标下增加原生锚点导航；“耗时较长的任务”名称链接到任务结果中的对应行。锚点对离线文件和禁用 JavaScript 的浏览器同样有效，不新增数据口径或外部依赖。

伪代码：`render overview -> stable section ids -> render jump links -> assign task row ids -> slow task links to row`。验收检查所有导航目标存在、同名任务按对象对应到正确行、生成 HTML 仍安全转义；桌面与窄屏浏览器核验无溢出，首屏耗时继续按项目 100ms 要求测量。

## 2026-11-16T18:41:25+08:00 HTML 报告运行时间可读性

按用户确认的“专业 HTML 测试报告”要求，参考 Allure 的运行/失败总览、Playwright HTML Reporter 的状态筛选与用例定位、ReportPortal 的质量总览、pytest-html 的离线明细与日志。复核发现报告层级和交互已满足既定能力，但总览与页脚直接呈现 ISO 时间戳，视觉上偏向原始调试数据。

展示契约：按运行时间自身的时区将生成时间格式化为 `YYYY-MM-DD HH:MM:SS UTC±HH:MM`；页面使用 `<time datetime="原始 ISO 值">` 保留机器可读时间。无法解析的值安全回退为转义后的原值，缺失时间仍展示“未记录”。不改变报告 JSON、测试时间、结果统计或覆盖率判定。

验收：覆盖带时区、UTC `Z`、无效时间及 HTML 转义；生成报告在总览和页脚均使用语义化时间元素。现有桌面/移动端、交互、离线和大样本性能验收继续有效，内部评分仍采用已有七项量表，不将有限样本性能外推。

## 2026-11-16T16:03:00+08:00 手册历史工作区事件边界验收

手册写作入口固定场景发现：编辑态收到残留的 `data-handbook-history-select` 点击后，委托处理器会把 `history=null` 展开成不完整对象，错误进入历史态。事件处理器现对无活动历史工作区的选择直接返回；固定浏览器场景断言返回编辑后历史仍为 null。该修改修正当前工作区状态边界，不改变已确认业务流程。定向验收通过后继续前端固定完整采集；仅采纳输入稳定结果。

## 2026-11-16T15:55:32+08:00 专业 HTML 报告交付核验

参考 Allure（运行总览及失败证据）、Playwright HTML Reporter（状态筛选及用例定位）、ReportPortal（质量总览）、pytest-html（离线明细及日志），沿用已完成的报告生成器与 REA 能力映射，无新增产品功能或样式改动。

本轮真实 `python3 tests/run_tests.py smoke --report-page-size 2`：2/2 任务、24/24 用例通过，生成 `runtime/test-results/smoke/20261116-155252-956422-smoke/report.html` 和 12 个静态场景分页。入口回归 `python3 -m unittest tests.unit.root.test_run_tests`：48/48。离线 Chromium 在 1440px/390px 各导航 10 次，DOMContentLoaded P95 分别为 32.4ms/23.1ms；均检索到 17 条 ConfigValidator 用例并可跳转详情，无 JavaScript 场景导航通过，脚本错误、外部请求、整页横向溢出均为零；人工查看本轮桌面截图。原始测量为 `runtime/rea/professional-test-report/report-verification.json`。

读取仓库 REA 两项 Skill 和浏览器运行观察参考；复用有效 REA Evidence `ev_d1c2c0dcfeef5962d60a4e2f999e6bc467a69cf869946279cdff97d5bd2929f0`。本轮 CLI help 长时间无输出，已结束该进程，未新增 REA Evidence，不把普通 Playwright 验证称为 REA 捕获。

七项内部量表维持 9.5/10（数据可信 2/2、失败定位 2/2、检索导航 2/2、视觉层级 1.5/1.5、无障碍与移动端 1/1、离线与性能 0.5/1、可追溯 0.5/0.5）。保留性能扣分，小报告采样不能证明所有规模及设备均低于 100ms。评分为内部评价；本次未采集覆盖率，平台行 100%/分支 95% 目标仍未完成。

## 2026-11-16T15:28:02+08:00 生产进展视图与助手抽屉覆盖复采

固定前端场景依据当前产品契约更新。旧增量创建对话框在产品改版时已移除，因此以生产进展列表/日历/图表和真实本机 HTTP 夹具替代旧场景，保持 13 项场景门禁；阶段、状态、未知状态、活动日期、工作日历、筛选、清空和图表均经实际页面事件验证。定向验证发现“清空”按钮此前只有渲染无事件处理，现补事件处理，清除搜索、状态、手册、版本及日期条件，保留显示模式和阶段筛选。生产进展定向夹具通过。

完整固定清单在助手抽屉场景发现窄屏打开时焦点回调发生于 `visibility` 样式提交前。浏览器直接证据表明目标页签当时仍不可见，后续可正常聚焦；产品改为跨两次 `requestAnimationFrame` 聚焦，并在真实生产页面通过定向焦点契约。完整清单同时发现审核工作台旧 DOM 断言仍期待已删除的增量任务创建对话框；改为当前生产进展/阶段渲染断言后，定向 Chromium 通过。

一次完整运行执行 61 源文件、49 导航、22 API 契约、PingCode 20 项、生产进展 13 项及审核 19 项，但运行中 `app.js` 与平台管理视图发生修改，门禁 `completed=true`、`stable=false`、`inputsStable=false` 拒绝覆盖率采纳。行 11553/12357（93.49%）、分支 14039/19110（73.46%）仅作诊断，不是有效增量。需对稳定后的当前工作树完整复采；定向输出的 `capturedCoverage=false` 也不得用于总覆盖率。

下一次稳定复采中，审核手册渲染用例观察到产品将历史版本打开为独立历史工作区，旧测试仍试图在同一 DOM 同时断言编辑页和历史面板。将测试拆分为互斥的编辑/草稿状态和历史工作区状态分别断言。该次运行期间手册视图、样式和 app.js 仍有并行改动，门禁拒收且报告仅供诊断；修正后须重新运行审核定向测试和完整固定清单。

后续复采在写作入口固定场景中发现另一处旧历史弹窗契约：测试人工构造已不存在的 `[data-handbook-history-compare]` 和 dialog，而现行公开事件为独立历史工作区中的 `[data-handbook-history-select]` 及“返回编辑”。夹具改为选择历史修订和返回文档页面，不再断言已移除的弹窗；完整复采失败轮仍因手册/app.js 输入变化拒收。

## 2026-11-16T14:31:00+08:00 生产进展视图 HTTP 覆盖设计

当前并行工作树的 `modules/production/view.js` 已移除旧增量创建对话框，原 `incremental-create-http.cjs` 仍查找已不存在的 `[data-incremental-create-open]`，导致固定前端采集在该场景超时。不得恢复已移除产品入口或静默跳过场景。将该固定场景改为生产进展列表、日历、图表及筛选的真实 HTTP 验收，覆盖本次改版实际新增的生产阶段归类、已知/缺失活动日期、日历工作日配置、列表过滤与无结果状态、日/周/月切换、阶段筛选及统计图。

伪代码：`local HTTP serves incremental task fixtures + work-calendar -> navigate production/progress -> assert stage projection and calendar -> switch week/list/charts -> search/status/handbook/version/date filters -> clear -> stage filter -> inspect chart series -> assert requests and URL state`。通过 Playwright 页面交互访问真实 API 边界；使用隔离本地 HTTP 响应，不写共享业务服务。将原 13 项创建 HTTP 断言计数替换为 13 项生产进展断言；同步固定采集器和覆盖报告场景名称。固定采集器新增 `KC_FRONTEND_ISTANBUL_SCENARIO=handbook-drawers|production-progress` 定向运行入口，产物明确标记 `capturedCoverage=false`，用于在完整复采前快速确认场景契约。先运行定向夹具，后执行完整固定前端清单并要求来源/输入稳定、变更列表为空。

## 2026-11-16T14:40:00+08:00 手册抽屉焦点夹具隔离

完整复采稳定复现助手页签打开后焦点仍停留在目录搜索框。使用 `KC_FRONTEND_ISTANBUL_SCENARIO=handbook-drawers` 定向工具对照发现：初始页面直接运行夹具通过；先导航至生产视图后失败。运行时记录确认产品回调执行时页签已连接、可聚焦，但助手面板计算样式仍为 `visibility:hidden`；稍后该元素可正常获得焦点。产品打开助手后将焦点延后至第二个动画帧，确保打开样式已提交。夹具在执行合成 DOM 事件契约时暂时分离页面现存同名抽屉和入口，结束后按原位置恢复，避免全局选择器指向重复节点。定向场景需在实际生产视图下通过后，再继续完整覆盖采集。

## 2026-11-16T14:24:44+08:00 专业报告当前工作树 REA 复验

继续参考 Allure 的运行与失败概览、Playwright HTML Reporter 的状态筛选和用例定位、ReportPortal 的质量总览、pytest-html 的离线详情及日志。仓库 REA `app-capability-transfer` 与 `reverse-engineer-anything` Skill 对当前真实 smoke 报告执行受控 Chromium 观察；REA Evidence `ev_d1c2c0dcfeef5962d60a4e2f999e6bc467a69cf869946279cdff97d5bd2929f0` completed、完整性 complete，截图及无障碍树已捕获，访问范围仅 `127.0.0.1`，owned Chromium 已清理。输入和完整证据分别保存在 `runtime/rea/professional-test-report/current-workspace-smoke-rea-20261116-142230.json` 与 `runtime/rea/professional-test-report/current-workspace-smoke-rea-evidence-20261116-142230.json`。

真实 `python3 tests/run_tests.py smoke --report-page-size 2` 为 2/2 任务、24/24 用例通过，生成 `runtime/test-results/smoke/20261116-142230-262840-smoke/report.html` 及 12 个场景分页；入口回归 `python3 -m unittest tests.unit.root.test_run_tests` 为 48/48。离线 Chromium 在 1440px/390px 下均搜索到 17 条 `ConfigValidator` 用例并成功跳转详情，无 JavaScript 时仍能浏览场景；页面错误、横向溢出均为零。HTML 报告内部七项量表 9.5/10，性能项保留 0.5 分扣减；这是内部复验而非第三方认证。本次 smoke 未启用覆盖率，不代表行 100% / 分支 95% 门槛达标。本轮核对未发现需要修改报告生成器的具体缺陷。

## 2026-11-16T14:14:51+08:00 PingCode 来源列表与状态切换覆盖设计

当前固定前端稳定报告中 `modules/platform-admin/pingcode-sync.js` 行 233/367、分支 350/635。既有隔离 HTTP 采集覆盖来源失败恢复及同步/确认主流程，但来源列表只有单项，无法覆盖复合筛选或状态开关失败恢复。扩展 `exercisePingcodeSyncHttp` 的本地服务器提供第二个不同类型、产品、停用态且可删除来源；浏览器先按名称/URL、类型、产品和状态筛选及空结果校验，再对主来源经键盘 Space 触发停用请求，模拟失败后重试成功并验证 switch aria 状态与请求 revision。最后用键盘 Enter 从来源行进入工作区，继续既有真实同步流程。

伪代码：`create primary + secondary -> refresh -> exercise all filters/no-match -> Space toggle (503 then PATCH success) -> assert persisted UI/request -> Enter source row -> existing sync/confirm/retry flow`。所有调用仍经页面公开事件委托和本机隔离 HTTP，不直接改 state；产品代码、覆盖分母不变。验收定向 fixture 后重跑固定前端全量，要求 61 源文件完整执行且稳定门禁无改动。

## 2026-11-16T14:05:00+08:00 Markdown 渲染器全分支稳定验收

公开渲染矩阵覆盖代码围栏有/无语言、缺省路径与上下文、手册仓库链接和默认参数、候选资源图片、越界图片回退及解析器异常时的安全旧渲染器。定向插桩通过；完整固定前端采集 `runtime/coverage-goal/frontend-markdown-renderer-verified-20261116-1405/` 退出 0，61 个源码文件及全部固定场景完成，`completed/stable/inputsStable=true`、变更清单为空。前端行 10482/11685（89.70%）、分支 12248/16489（74.27%）。`common/markdown/markdown-renderer.js` 为行 27/27、分支 40/40；`modules/production/origin-snapshot.js` 为行 2/2、分支 7/7。平台覆盖率目标仍未完成。

## 2026-11-16T13:56:53+08:00 Markdown 渲染器公开路径覆盖设计

当前稳定前端报告中 `common/markdown/markdown-renderer.js` 为行 22/27、分支 19/40。已有固定生产写作浏览器场景已通过真实本机页面插桩加载该公开导出；新增独立渲染矩阵覆盖有/无语言代码块、null 正文和缺省 context、无手册上下文的相对链接、手册仓库链接、审核候选图片资源 URL、图片 URL 拒绝回退，以及解析器抛错后的既有安全回退函数。通过最终 HTML 与回退回调断言行为，不改生产实现、覆盖分母或依赖。

伪代码：`launch(t) -> import renderDatabaseMarkdown + marked -> render case matrix -> temporarily make marked.parse throw -> restore parser in finally -> assert safe rendered outputs/fallback`。先执行插桩定向测试，检查该模块行/分支计数；通过后复跑完整 61 文件清单并要求输入稳定。

## 2026-11-16T13:53:21+08:00 平台来源快照完整覆盖验收

`production-writing.test.cjs` 新增经真实插桩页面调用 `createPlatformOriginSnapshot` 的公开行为用例，完整上下文、缺省上下文、空可选字段与数字正文均以输出及 SHA-256 断言。定向运行通过；一次完整复采曾因工作台测试本地 HTTP 静态文件读取出现 `ECONNRESET` 中止，单独运行该用例及覆盖模式 6 项工作台场景均通过后再次完整复采。

有效结果 `runtime/coverage-goal/frontend-origin-snapshot-recheck-20261116-1350/`：61 个源码文件、49 个导航文件、33 个写作场景、审核 19/19；`completed/stable/inputsStable=true` 且所有变更列表为空。前端行 10475/11685（89.64%）、分支 12223/16489（74.12%）；`origin-snapshot.js` 为行 2/2、分支 7/7。平台 100% 行和 95% 分支目标仍未完成。

## 2026-11-16T13:32:17+08:00 平台来源快照工厂覆盖设计

稳定前端报告中 `modules/production/origin-snapshot.js` 行覆盖 2/2、分支 3/7。既有 Node 单测导入源码模块，不经过 Istanbul 浏览器采集器，因此这些执行不进入前端覆盖报告。固定写作采集已通过真实本地 HTTP fixture 启动浏览器并拦截/插桩前端模块；新增专用浏览器测试动态导入公开 `createPlatformOriginSnapshot`，检查普通正文的 SHA-256 及手册/文档/大纲版本/分支映射，并调用 null 正文与缺省/空上下文，验证 `String(markdown ?? '')` 和可选字段回退。断言仅根据公开输出，不改产品行为或分母。

伪代码：`launch(t) -> page.evaluate(import origin-snapshot) -> assert markdown/context snapshot -> assert null markdown + omitted context yields empty digest-bound platform snapshot`。验收先运行新增用例并将 `KC_FRONTEND_ISTANBUL_CASE_DIR` 指向隔离目录，确认 Istanbul 计数覆盖该模块；随后复跑 61 文件完整固定清单，要求源码和输入稳定、变更列表为空。

## 2026-11-16T13:29:47+08:00 审核场景复跑与稳定全量复验

上一轮前端全量因审核工作台“我的审核”场景没有渲染 `principal-assigned` 行而失败，且 PingCode 源码与测试输入在采集期间变化，故报告无效。按失败场景独立运行 `node node_modules/@playwright/test/cli.js test --config=tests/unit/agent-runner/playwright.coverage.config.cjs --grep '我的审核：人员 ID 指派给何阳时展示待办并可阅读冻结正文'` 通过 1/1；确认并行修改结束后，以原 61 文件及固定场景清单完整复采。

有效报告 `runtime/coverage-goal/frontend-cleaning-api-error-branches-recheck-20261116-1320/`：采集退出 0，审核场景 19/19；`source-stability.json` 的 `completed/stable/inputsStable=true`，`changedFiles=[]`、`changedInputs=[]`。前端行覆盖率 10460/11685（89.51%），分支覆盖率 12176/16489（73.84%）。`common/api/cleaning-api.js` 为 26/26 行、34/36 分支（94.44%）。全平台行 100%、分支 95% 目标仍未完成；该前端报告不能替代 Node、Java 与平台合并口径验收。

## 2026-11-16T13:01:44+08:00 清洗 API 可达错误与回退分支

清洗 API 新增读取场景后 `cleaning-api.js` 行 26/26 已覆盖，但分支为 28/36。剩余可达路径包括：读取错误无服务端消息时的 HTTP 回退文案、错误码保留、读取非法 JSON、工作台索引失败降级、成功响应无 `data` 信封时的读取/写入兼容回退，以及列表和批次详情的分页正/反路径。扩展现有隔离 HTTP route，逐项断言真实公开 API 的返回值和请求；不改产品逻辑或统计分母。内部 helper `requestJson(options = {})` 的默认参数无法由任何公开导出省略，不将其作为必须调用路径或伪造覆盖。

扩展后的固定全量中，清洗 API 新增读、错误、回退和默认值场景均已通过。运行随后在审核工作台 19 个真实浏览器场景中的“我的审核”用例失败：预期指派待办行未出现；同一采集期间 PingCode 产品文件 `modules/platform-admin/pingcode-sync.js` 及其 README、HTTP 夹具和插件测试输入发生修改。`source-stability.json` 为 `completed=false`、`stable=false`、`inputsStable=false`，所以该轮不生成/不接受覆盖结果；审核失败日志在 `runtime/coverage-goal/frontend-cleaning-api-error-branches-20261116-1302/review-cases/1794805838779-2151719/review-test.log`。先核验该审核场景独立契约，再等待相关源码/输入稳定后重跑完整固定清单。

## 2026-11-16T12:44:31+08:00 清洗 API 读取与默认值覆盖

最新稳定全量 `runtime/coverage-goal/frontend-outline-governance-autosave-final-stable-20261116-1230/` 为 61 个前端脚本行 10454/11685（89.46%）、分支 12159/16489（73.74%），`completed/stable/inputsStable=true` 且变更列表为空。Istanbul 明细显示 `common/api/cleaning-api.js` 的列表、详情读取导出未在固定浏览器采集中执行。

扩展既有 `exerciseCleaningApi` 隔离 HTTP 页面：真实调用 `loadCleaningWorkspace`、批次/数据集列表及详情；验证无效页码回退到第 1 页、批次与数据集路径编码、三项批次详情并行请求。上传路径增加无幂等键生成 UUID、无自定义请求头的分片默认值及未命名批次的 `null` 值断言，原有失败状态、非法 JSON 和已有请求契约保留。修改只涉及固定覆盖采集器，产品逻辑和覆盖分母不变；验收先做语法/定向浏览器检查，再重跑完整稳定清单。

首次定向运行在分片头断言失败：新增自动生成幂等键的上传会话使写请求数组中原有分片下标后移；实际请求方法/路径清单已先通过。将自定义请求头分片与默认请求头分片分别检查到正确的两个索引，继续保留正文、Content-Type 和批次 JSON 精确断言。

## 2026-11-16T12:11:47+08:00 大纲说明自动保存夹具恢复重载状态

固定前端全量中的大纲筛选和 URL 断言已通过，说明防抖自动保存在上一轮失败。根因是场景先执行手动保存；产品保存成功后将 `appState.outlineProjection` 置空并重新读取列表，而夹具返回空列表，随后防抖输入仍沿用已失效的投影。定时器点击保存按钮后，公开处理器因无大纲 ID 正常返回，所以没有新的 HTTP 写入。

在自动保存步骤前调用既有夹具 `reset()`，模拟用户重新进入详情后加载当前投影。继续保留两次真实 `input` 事件间隔、最终值唯一提交、编辑版本/治理版本以及保存成功状态断言；不改产品行为、不放宽请求契约、不缩小固定源码分母。验收重跑完整固定前端清单，要求采集退出 0、`completed/stable/inputsStable=true`、变更列表为空，并检查大纲模块计数变化。

## 2026-11-16T12:13:55+08:00 自动保存成功后的夹具按钮状态

全量重跑已证明防抖自动保存成功并提交最终文本，但继续执行分工失败恢复时，夹具仍保留被成功处理器禁用的保存按钮。产品会在刷新后的 DOM 中提供可用按钮；测试夹具的 `reset()` 现同时重建大纲投影并恢复保存按钮可用状态，模拟同一次真实页面刷新。保留分工失败后按钮恢复、错误提示及成功重试断言；继续执行固定完整采集并只接受完整输入稳定结果。

第二次全量已通过自动保存和失败提示，进入既有分工请求载荷断言后失败。为保留原字段/数组顺序契约并定位实际输入，断言失败消息现输出该场景捕获到的隔离请求正文和请求序列；不放宽断言，依证据修正夹具输入或断言。

请求证据显示目录 `dir-a` 的既有责任仍保留为 `9`，文档 `doc-1` 的责任正确覆盖为 `7/8`，版本字段也正确；唯一旧期望是 `descriptions[0]` 仍为“批量说明”。该输入已在本场景前段真实防抖保存为“自动保存最终版”，之后人工分工保存应继续保留它。更新断言检查最新说明值，并保留原有责任、顺序和版本契约。

第三次全量通过上述载荷检查并到达治理场景末尾，固定总写请求数断言仍是添加自动保存前的 8。场景现在包含说明编辑失败/重试 2 次、防抖自动保存 1 次、分工失败/成功 2 次、发布 2 次、移动 2 次；将总数更新为 9，自动保存仍独立精确断言只新增一次。

第四次完整采集跑完全部 61 个源文件和固定场景，生成行 10456/11685（89.48%）、分支 12163/16489（73.76%）；大纲自动保存、后续分工载荷与总请求数均通过。但 `source-stability.json` 显示采集期间输入 `tests/e2e/agent-runner/pingcode-sync-plugin.node.cjs` 从 `e9ec3f...` 变为 `e148fb...`，因此即使 `completed=true` 也按采集器门禁作废。报告仅用于诊断；输入当前连续检查哈希一致后，以不变场景/分母重新运行并要求 `stable=true`、`inputsStable=true`。

## 2026-11-16T12:08:36+08:00 行业报告能力映射与当前验收

参考能力契约：Allure 提供运行概览、结果分布和失败证据；Playwright HTML Reporter 提供用例筛选及失败定位；ReportPortal 提供质量统计总览；pytest-html 提供可离线查看的用例明细和日志。适配到本报告的能力为中文总览、按场景静态分页、跨场景搜索/状态筛选、用例深链、失败日志、原始 JSON、可选覆盖率门禁与无 JavaScript 浏览。无历史输入、重试或附件数据时不生成对应结论。官方来源快照、哈希和 403 限制见 `runtime/rea/professional-test-report/sources.json`、`official-repositories.json`。

当前复验：`python3 tests/run_tests.py smoke --report-page-size 2` 为 2/2 任务、24/24 用例通过；`python3 -m unittest tests.unit.root.test_run_tests` 为 46/46。REA Evidence `ev_2983427d290062100ad328b119489d8b9d659b47cfbd852cb3dfa727d05e5a9e` 对最新报告完成 Chromium 观察，完整无截断。1440px/390px 各 10 次离线导航，DOMContentLoaded P95 为 32.2ms/15.0ms；17 条搜索结果、用例深链、无 JavaScript 分页均通过，页面无错误、外部请求和横向溢出。报告内部七项量表 9.5/10；性能项 0.5/1 保留扣分，分数不是第三方认证。此 smoke 未启用覆盖率，不能证明行覆盖率 100%、分支覆盖率 95% 已达成。验收记录见 `runtime/rea/professional-test-report/ACCEPTANCE.md`。

## 2026-11-16T11:30:28+08:00 清洗质量通过投影

稳定全量 `frontend-cleaning-verified-20261116` 的清洗视图达到 115/115 行、285/289 分支。新增 `qualityPassed: true` 的公开知识库详情投影，验证质量通过状态分支；保持 false、未提供/缺省状态。

## 2026-11-16T11:51:17+08:00 大纲列表筛选与说明自动保存覆盖

稳定前端全量中 `app.js` 是最大文件，未命中函数包含 `updateOutlineListFilters` 和 `scheduleOutlineGovernanceSave`。扩展固定浏览器大纲治理场景：通过真实 `input` 与点击事件验证搜索命中/空态、阶段过滤、`aria-current` 与 query 历史；连续说明输入跨越 700ms 防抖后验证只提交最终值且携带现有治理版本。保留其他隔离保存、发布、移动失败/成功断言，不改产品规则或覆盖分母。

## 2026-11-16T10:37:42+08:00 清洗视图渲染分支覆盖

稳定前端报告中 `modules/cleaning/view.js` 为 45/115 语句、75/289 分支。扩展固定 Chromium 的清洗页面采集，在真实服务态 API 场景内调用公开 `renderCleaning` 并验证：主视图加载/不可用、批次和知识库详情加载/错误、批次文件分页及字段别名、状态/时间/缺省值、内部推荐入口与外部入口拒绝、知识库批次关联/图谱/质量指标、上传权限、列表分页和索引不可用。所有断言针对输出内容和链接安全；保留真实 HTTP 场景及固定源码分母。

状态投影的未知中文值按兼容契约原样展示，未知非中文值才显示“状态待确认”；清洗渲染矩阵以未知英文状态覆盖回退。

诊断计数为 114/115 语句、269/289 分支；补充字符串来源、批次无数据/默认操作文案、文件 path/id/未命名回退、无对象知识库详情，以及批次和知识库分页首尾禁用状态，覆盖低风险纯投影边界。

全量复采的任务管理测试在文档范围按钮点击后用宽泛 `getByRole('dialog')` 等待，忙时可能匹配到非范围对话框并在 CSS 布局前测量。改为等待明确的 `.task-scope-dialog[open]` 可见并跨两帧绘制，再检查所有点击区；44px 门槛保持不变。

首页分页夹具为命中上一页禁用条件使用 `page: 1`，断言当前页显示“第 1 / 3 页”；末页夹具继续验证下一页禁用。

文件标签回退的数组包含文件行时不应期待空文件状态；另用空数组验证“暂无文件”，并单独断言缺名称行显示“未命名”。

## 2026-11-16T10:20:26+08:00 共享来源 Markdown 安全契约覆盖

稳定前端覆盖报告的 `common/safe-source-markdown.js` 仅命中模块加载语句，正文渲染及 4 个分支均未覆盖。任务管理隔离 HTTP 浏览器场景新增直接调用：空值默认内容、原始 HTML 转义、安全 HTTPS 链接属性、危险 javascript 链接降级为纯文本、图片转换为转义后的图片说明。以输出断言验证安全语义，并纳入既有插桩计数；不改变产品行为和源码分母。

## 2026-11-16T10:24:49+08:00 GitLab 连接取消确认请求断言

固定全量在取消停用确认框后发现全局请求数异步增加 1，断言把后台 GET 误判为取消副作用。改为比较取消前后的非 GET 请求数，直接验证取消没有提交写操作；末尾保留 POST、PATCH、verify、disable、enable 的精确写入计数及载荷断言。

## 2026-11-16T11:12:34+08:00 人员导入场景模板映射可选预取

覆盖采集人员导入场景时，底层页面可能按当前状态额外读取 `/knowledge-center/api/templates/mappings`；请求由同场景的隔离本地 HTTP handler 响应，内容为空映射。GET 契约精确验证固定必需请求，同时允许该只读预取零次或一次；导入 POST 数量、文件载荷和写请求保持精确断言。

## 2026-11-16T09:39:55+08:00 任务详情性能循环等待契约

插桩全量暴露详情性能循环的竞态：资源请求完成并不保证详情异步读取和 DOM 渲染已完成。每次点击后仍保留两帧绘制测量及真实详情请求校验，关闭前增加等待 `aria-busy` 清除且打开的详情对话框含关闭按钮；关闭后等待对话框移除再开始下一次。30 次样本与原性能门槛不变。以独立插桩真实 HTTP 测试验证，再运行固定全量；运行期间输入变化的报告不能计入目标。

## 2026-11-16T09:54:18+08:00 审核生产加载态契约同步

审核工作台生产总览场景的加载态当前只渲染“正在读取已发布大纲…”状态，不挂载创建表单；创建表单需在大纲加载完成后出现。将旧的“加载态创建按钮禁用”断言改为断言表单不存在，保留加载文案、不可用、错误和完成态分支覆盖。

创建对话框的选项夹具需显式渲染 `?view=progress`；默认手册视图不挂载创建表单，原手册选项及基线按钮断言保持不变。

增量输入来源类型当前展示文案为“人工提供”（`sourceType: manual`），同步旧“人工固化”断言，保留来源回退结构覆盖。

章节范围由 `availableChapters[*].sections` 生成复选框；回退夹具为 `chapter-a` 提供同 ID 章节，继续验证已选章节计数为 1。

空对象 `generationRun: {}` 仍按存在的运行对象渲染“生成状态待确认”和默认读取提示；同步旧“运行状态待返回”断言。

已返回 `publication` 的发布阶段当前展示“平台版本已发布”，同步旧“服务端已返回发布版本”断言。

## 2026-11-16T09:26:00+08:00 前端写作测试定位器同步

固定 Istanbul 全量在写作浏览器场景失败于 `.handbook-writing-chat-open`。当前产品通过带可访问名称“查看候选与执行过程”的图标按钮打开历史候选，源码不再提供旧 class。将双滚动、复用编辑器和仓库图片场景改用 Playwright role/name 定位，保留候选查看、关闭恢复、HTTP 回读和图片流程全部断言；不改变产品源码或覆盖分母。

## 2026-11-13T21:32:54+08:00 模板编辑器返回目录后进入适用文档映射

固定全量已通过模板历史、状态开关并推进到适用文档映射；采集器直接查找 `[data-template-tab="mappings"]` 失败。编辑工作区只提供“返回模板库”，页签仅在模板库/适用文档列表页显示。更新导航为 `click [data-template-back] -> wait library -> click mappings tab -> exercise mapping`，保留批量映射失败重试、手动决策、规则预览保存/错误等完整断言。

## 2026-11-13T21:40:54+08:00 模板控制器全流程导航夹具修正

固定前端全量在 `runtime/coverage-goal/frontend-template-mapping-nav-20261113-2133/` 未完成，最后可定位的问题仍是 `exerciseTemplateController` 将 `editor` 当作 `data-template-tab`。真实契约为：映射/模板库页签只含 `library`、`mappings`；编辑器由点击模板目录项打开，离开编辑器使用 `[data-template-back]`。按照实际状态转换修正采集夹具：映射场景后返回模板库并选择模板进入冲突编辑；映射恢复后返回模板库并选择模板；编辑器键盘页签检查先返回目录并只在 `library`/`mappings` 间执行；历史、映射规则和混合上传之间按当前视图切换；错误恢复尾部从编辑器返回目录后再打开映射。伪代码：`mapping -> library tab -> select template -> editor actions; editor -> back -> library/mappings tab actions; preserve all existing assertions`。不改产品源码、不删减模板场景或固定覆盖分母。验收先跑模板控制器定向浏览器流程，再跑固定完整 Istanbul 清单；仅当退出 0、`completed/stable/inputsStable=true` 且变更列表为空时计入覆盖率。

全量重跑 `runtime/coverage-goal/frontend-template-nav-retry-20261113-2141/` 已通过视图导航并发现目录同一行存在两个 `data-template-id` 按钮（模板名称入口和“打开”操作），宽泛选择器触发 Playwright strict-mode violation。后续所有从模板库选中已知模板的步骤应定位 `.template-catalog-open[data-template-id="coverage-template"]`，明确采用名称入口；保留现有“打开”按钮所覆盖的独立页面用例及模板全流程断言。继续以新的完整固定清单复采验收。

下一次全量 `runtime/coverage-goal/frontend-template-nav-retry-20261113-2147/` 通过模板创建、冲突、上传、映射、历史恢复后，在搜索断言处失败。产品每条模板数据行有两个带 `data-template-id` 的按钮，搜索等待器按按钮数计算行数，造成 1 套模板被算作 2 条；中文组词保护的预重绘断言使用了同一计数方式。将这两处计数改为 `.template-catalog-open[data-template-id]`，按每套模板唯一目录入口统计，继续保留名称筛选、空搜索、中文 IME 组词与 compositionend 结果断言。该运行 `completed=false`、`inputsStable=false`，且另一个测试输入在运行期间变化，不能计覆盖率。下一轮仍只接受退出 0 且源码、输入稳定的完整报告。

全量 `runtime/coverage-goal/frontend-template-search-retry-20261113-2150/` 已通过搜索、IME、混合上传、历史恢复并进入基本信息取消场景。`[data-template-meta-cancel]` 同时匹配标题栏“关闭基本信息”和页脚“取消修改”两个按钮，触发 strict-mode violation。将恢复元数据断言的点击器限定为 `#template-meta-panel footer [data-template-meta-cancel]`，继续验证取消后名称快照恢复，并保留 Escape、焦点循环与后续键盘分隔条场景。该轮另有 `knowledge-center-my-work.node.test.cjs` 输入哈希变化，故不是稳定覆盖证据。

## 2026-11-13T21:58:39+08:00 清理模板目录旧分隔条断言

固定全量 `runtime/coverage-goal/frontend-template-meta-retry-20261113-2154/` 已通过模板搜索、IME、元数据取消/Escape，之后在查找目录分隔条时超时。当前 `modules/templates` 源码中不存在 `data-template-list-resizer` 或 `knowledge-center:template-list-width`；这组断言只存在于旧采集器，是产品视图重构后遗留的不可执行场景。移除该无效分隔条测试块；保留真实库/映射键盘页签、模板历史对话框焦点循环和映射规则对话框焦点循环。此轮 `completed=false`，但 `stable=true`、`inputsStable=true`；由于未完成不能计为完整覆盖率证据。

## 2026-11-13T21:29:57+08:00 固定采集器同步历史对话框自动关闭行为

模板历史交互修复及定向浏览器回归通过后，下一次固定采集器在“返回当前内容”后仍点击 `[data-template-history-close]`，而成功选择历史版本时对话框已自动关闭，导致定位器超时。更新采集步骤为 `select historical version -> assert modal closed -> click current version -> continue status and mapping checks`；不删历史读取、返回当前、状态开关、映射或其他场景。随后重新执行固定完整采集。

## 2026-11-13T21:24:24+08:00 模板历史查看关闭模态层后返回当前版本

前端固定全量修正过期采集夹具后，模板控制器场景发现：选择历史版本后历史对话框仍保持模态打开，遮挡编辑器中的“返回当前内容”按钮，Playwright 报 pointer interception。此为真实可见行为缺陷，不应绕过按钮或缩减测试。修复契约：`click historical version -> fetch succeeds -> set historyVersion and close history dialog -> show historical banner -> current button is interactable -> click -> clear historyVersion and show current content`。失败请求仍保留对话框和原选择，避免丢失上下文。定向浏览器覆盖后重跑固定完整清单，确认产品源码输入稳定。

## 2026-11-13T21:20:35+08:00 移除审核本地夹具中的过期增量原型控件

前端固定全量推进至 `exerciseReviewLocalControls` 后，旧合成控件断言“原型面板展开后聚焦输入”失败。夹具自行插入 `data-incremental-prototype-*` 面板、启动和发布按钮，但当前实现不存在这些事件处理器；真实端到端规格 `knowledge-center-incremental-flow.spec.js` 明确验证原型入口不存在、生成入口显示“暂未开放”。这部分夹具不代表可执行产品契约。仅移除虚构原型控件及对应断言；保留本函数实际支持的审核回复表单、关闭/展开、文档行意见锚点与回退、真实 `data-production-tab` 键盘状态断言，并保留生产行为完整用例。该调整不动产品源文件、产品覆盖分母或固定场景清单。

## 2026-11-13T21:16:17+08:00 增量任务创建夹具进入生产进展视图

前端固定全量继写作采用场景后，增量任务创建夹具在查找 `[data-incremental-create-open]` 时超时。产品 `renderProduction` 只在 `progress` 生产进展或 `tasks` 任务工作区渲染创建按钮；固定通用视图最终停留在 `generations`，夹具点击一级入口不会自动改变二级页签。伪代码：`click production nav -> click [data-production-overview-tab="progress"] -> click create -> retain baseline validation/failure recovery/success assertions`。随后成功创建进入任务工作区，继续复用原创建入口断言；不修改产品行为或删减 13 个 HTTP 断言。

## 2026-11-13T21:12:48+08:00 写作候选采用覆盖夹具同步当前按钮语义

模板导航修正后，前端固定全量推进至 `exerciseWritingAdoptionHttp`，但夹具超时等待 `.handbook-writing-chat-open`。产品 `production-chat-evidence.js` 当前通过工具栏按钮 `aria-label="查看候选与执行过程"` 打开候选详情；旧 class 已不在 DOM。伪代码：`turn = [data-chat-job="adoption-http-job"]; click turn.getByRole(button, name="查看候选与执行过程"); assert candidate visible/enabled; preserve 503 retention -> retry success -> verify request body and reopen draft`。不修改业务行为，不减少 3 项候选采用断言或固定覆盖清单。随后重跑完整固定前端采集并只接受稳定结果。

## 2026-11-13T21:09:49+08:00 前端模板工作区覆盖采集导航修正

最近一次固定完整前端采集 `runtime/coverage-goal/frontend-goal-current-20261113-2057/` 未完成（`completed=false`、`stable=false`、`inputsStable=false`），因此不计覆盖率；采集过程中 `styles.css` 输入发生变化。当前产品模板页 DOM 只有 `library` 与 `mappings` 两个 `data-template-tab`，编辑器并非页签：选择模板目录项或点击“新建模板”才进入工作区。采集器通用视图和专用模板控制器都点击了不存在的 `editor` 页签，属于测试导航契约过期。

伪代码：`templates -> activate mappings -> activate library; dedicated template flow -> click data-template-new -> click data-template-create-blank -> assert metadata/editor -> continue save/history/mapping assertions`。通用视图只走真实的两个页签；专用场景仍完整执行模板新建、编辑、版本历史与映射流程，不减少固定场景或产品源码分母。验收须重新运行同一固定 Istanbul 全量采集，并要求退出码 0、全部场景完成、`completed/stable/inputsStable=true`、`changedFiles/changedInputs=[]`；非稳定报告不计数。

## 2026-11-13T21:06:09+08:00 专业报告行业对照与当前工作树 REA 验收

业界参考按能力吸收：Allure 的运行概览、结果分类和失败证据；Playwright HTML Reporter 的用例状态筛选与失败定位；ReportPortal 的质量统计总览；pytest-html 的离线 HTML、逐项详情和日志。报告继续只展示运行器实际采集的数据；历史趋势、重试与附件未采集时不生成推断值。内部评分采用 `runtime/rea/professional-test-report/ACCEPTANCE.md` 的七项量表，目标至少 9/10，不把内部自评称为第三方认证。

当前工作树真实运行 `python3 tests/run_tests.py smoke --report-page-size 2`：2/2 个任务、24/24 用例通过，Jest 22/22、Python unittest 2/2，报告 `runtime/test-results/smoke/20261113-210256-829462-smoke/report.html`。入口回归 `python3 -m unittest tests.unit.root.test_run_tests` 为 46/46。REA 6.7.0 受控 Chromium Evidence `ev_53ff66f69051531e0298239c75d365bd44e0bf9a8fd91887058af88cb75e8ab1` 完整且无截断，原始证据及场景输入位于 `runtime/rea/professional-test-report/current-workspace-smoke-rea-evidence-20261113-210256.json` 与同名无 `-evidence` 的 JSON。观察仅访问本机报告，REA 自有 Chromium 已清理。

总览截图/无障碍树核对结果分布、任务数量、耗时、场景导航、未采集覆盖率提示及失败区；390px Chromium 实测搜索 17 条、结果深链、场景分页、无 JavaScript 浏览成功，零横向溢出及脚本错误。内部评分 9.5/10；此 smoke 未开启覆盖率，因此不作为平台行 100%、分支 95% 的证据。实现已满足本轮报告目标，无需重复改动生成器；继续沿用既有失败态、日志转义与大样本验证。

## 2026-11-13T20:57:11+08:00 PingCode 多来源主来源决策稳定验收

`StoragePingcodeTaskHttpCheck primary-decision` 通过公开 Storage `/confirm` HTTP API 模拟同一任务有两个有效来源但没有主来源的情况，确认服务返回 409 `PRIMARY_SOURCE_DECISION_REQUIRED`，拒绝不提交、不改任务版本且运行保持 `AWAITING_CONFIRM`。固定 Java JaCoCo `runtime/coverage-goal/java-pingcode-primary-decision-20261113/` 退出 0；15 个产品文件 `stable=true`、`changedFiles=[]`，行 5006/5072（98.70%）、分支 3176/3846（82.58%）。较来源输入边界采集增加 1 行、2 分支；Java 尚缺 66 行、478 个分支才能达标，平台整体目标未完成。

## 2026-11-13T20:51:50+08:00 PingCode 多来源主来源决策 HTTP 覆盖

沿 `StoragePingcodeTaskHttpCheck` 隔离 JDBC 真实 HTTP 流程，模拟现存有效主来源后登记第二个来源，为同一任务暂存新来源快照并完成预览。调用公开 `/v1/pingcode-task-sync/runs/{id}/confirm` 且不提交主来源选择时，必须返回 409 `PRIMARY_SOURCE_DECISION_REQUIRED`；拒绝不能提交事务、推进运行状态或写入文档任务。该场景专门验证多个来源并存且当前来源首次关联时的显式决策门禁，不代替成功选择的端到端场景。

伪代码：`create second source -> run -> stage existing task -> finish -> fixture exposes old+new active sources -> POST confirm(primarySources={}) -> assert 409/no commit/no task write/AWAITING_CONFIRM`。所有 HTTP 请求只访问本机 Storage handler，JDBC 驱动只写测试内存状态；固定 15 文件 JaCoCo 采集核验输入稳定。

## 2026-11-13T20:45:31+08:00 PingCode 来源输入边界稳定采集结果

`StoragePingcodeTaskHttpCheck crud` 通过真实 HTTP 对来源新增的名称、类型、产品类型、URL、连接 ID、操作者字段及来源更新字段执行拒绝用例，逐项断言 422 `PINGCODE_SOURCE_INVALID`，并校验拒绝未增加来源写入或修改修订号。已有合法 CRUD 随后继续成功。定向场景已包含在完整固定采集 `runtime/coverage-goal/java-pingcode-source-input-boundaries-20261113/`：15 个产品文件，`stable=true`、`changedFiles=[]`，行 5005/5072（98.68%）、分支 3174/3846（82.52%）。对比同一源文件分母的前次稳定采集增加 1 行、17 分支；Java 仍缺 67 行，距离分支 95% 尚差 480 个分支。Node、前端与平台整体门槛尚未完成。

## 2026-11-13T20:40:01+08:00 PingCode 来源字段拒绝边界 HTTP 覆盖

沿用 `StoragePingcodeTaskHttpCheck crud` 的公开 Storage HTTP API 与隔离 JDBC，扩展来源创建和更新字段拒绝场景。创建分别发送缺失/空白/超长名称、缺失/不支持类型、缺失/无效产品类型、缺失/超长/非法 URL、缺失/空白连接 ID、缺失/空白操作者；更新分别发送名称、类型、产品类型和 URL 的非法值。每个拒绝均断言 422 `PINGCODE_SOURCE_INVALID`、来源写入计数及修订号不变；随后原有合法来源新增、更新、冲突、状态和删除流程继续通过。

伪代码：`for invalidInput in createCases: POST /sources -> 422; assert sourceWrites unchanged; POST valid -> 201; for invalidInput in updateCases: PATCH /sources/{id} -> 422; assert sourceWrites/revision unchanged; continue valid CRUD`。场景不改变产品规则、不连接业务数据库；完整 15 文件 JaCoCo 采集仍需核对源码及输入稳定。

## 2026-11-13T20:30:38+08:00 PingCode 来源与运行读取路由覆盖

按上方预先记录的场景，将已确认任务来源分页、来源正文快照、运行项分页、运行正文快照及未关联 IR 空结果接入 `StoragePingcodeTaskHttpCheck` 的真实 HTTP/JDBC 流程。分页响应验证条数和内容，快照验证 Markdown；读取前后任务/来源写入计数保持不变。完整固定 JaCoCo `runtime/coverage-goal/java-current-read-routes-20261113-2025/` 退出 0，15 个产品源码文件 `stable=true`、`changedFiles=[]`；行 5004/5072（98.66%）、分支 3157/3846（82.09%）。相较本轮前一同源码采集净增 63 行、21 分支；仍缺 68 行，95% 分支门槛还差 497 项。这里只证明 Java 子集，三端平台目标未达成。

## 2026-11-13T20:24:30+08:00 当前报告 REA 复核与 Java 覆盖续采

参考能力仍映射 Allure 的运行总览与失败证据、Playwright HTML Reporter 的状态筛选和用例定位、ReportPortal 的质量总览、pytest-html 的离线明细与日志。真实 smoke `python3 tests/run_tests.py smoke --report-page-size 2` 执行 2/2 任务、24/24 用例通过，生成 `runtime/test-results/smoke/20261113-202358-453799-smoke/report.html`。仓库 REA `capture-browser-scenario` 对该产物执行受控 Chromium 观察；Evidence `ev_70288384497e3534824430941b81387cddfc3a3ed105cbc5d93cdc53d39cb31e` completed/complete，无截断，截图、无障碍树和回环 URL 保留于 `runtime/rea/professional-test-report/current-smoke-rea-evidence-20261113-2024.json`。同一报告实现此前桌面/390px、搜索、深链、无 JS 分页和键盘表格滚动验收见 `runtime/rea/professional-test-report/ACCEPTANCE.md`，内部评分 9.5/10；它不是第三方认证，也不代表代码覆盖率达标。本次 smoke 未启用覆盖率，故 JSON 中 `coverage` 为空。

Java PingCode 来源 HTTP 夹具同步当前 Storage 投影：识别包含 `PRODUCT_TYPE` 和已确认任务数量的来源列表查询，并保存 `newCount/changedCount/unchangedCount` 到运行状态，使 updated 预览的总数与逐项结果一致。通过真实隔离 HTTP/JDBC 流程执行完整固定 Java 清单。`runtime/coverage-goal/java-current-recheck-20261113-2015/` 退出 0，15 个产品文件输入 `stable=true`、`changedFiles=[]`，行 4941/5072（97.42%）、分支 3136/3846（81.54%）。当前 Java 尚缺 131 行；95% 分支门槛至少还需覆盖 518 个分支。该指标仅证明 Java 子集现状，Node、前端与全平台目标仍需当前稳定全量报告。

追加覆盖 PingCode 来源和运行读取路由：经公开 HTTP 分页读取已确认来源的任务及快照，读取运行项分页和任务快照，并验证未关联 IR 空结果。夹具需对来源存在/缺失和任务存在/缺失返回与查询列序一致的数据；读取请求不得产生写入。伪代码：`confirm; GET source/items(page); GET source/items/{sr}; GET run/items(page); GET run/items/{sr}; GET run/unlinked-irs; assert payload + totals + no additional writes`。仅使用隔离 JDBC，不访问共享数据库或真实 PingCode。

## 2026-11-13T20:05:43+08:00 生产总览采集标签按真实页面收敛

产品模板确认生产总览只有 `handbooks`、`progress`、`generations` 三个 tab；`tasks` 是带 `taskId` 时渲染的详情状态，并非 tab。移除通用导航中不存在的 `tasks`，不削减产品覆盖清单；任务创建/范围等委托由独立真实浏览器与 HTTP 场景负责。上一完整复采期间 `app.js` 哈希变化，报告标记 `completed=false/stable=false`，不作覆盖证据。修正后须在源码与测试输入稳定的条件下重跑。

## 2026-11-13T20:03:20+08:00 权限角色场景状态清除时序修正

固定前端复采已通过 PingCode 来源同步场景，权限角色场景在成功保存后等待状态立刻清空而超时。产品将“权限已保存”保留到用户切换/表单变更，并在切换时清除状态；夹具清除断言顺序早于切换。将断言移至切换到只读本地账号后，仍验证保存成功状态、切换后清除、只读角色禁用、过期数据拒绝及筛选请求。完整固定清单需重跑确认。

## 2026-11-13T19:56:04+08:00 PingCode 来源同步覆盖场景跟进现行流程

固定采集到新增 PingCode 场景后发现夹具仍依赖已移除的连接测试按钮和来源详情对话框。产品现行流程为列表登记来源，进入来源工作区后执行同步、查看差异、确认并重试缺图。更新夹具接线使用隔离 API 响应来源详情/工单、运行状态、运行项、预览与图片资源；继续断言读取失败和来源创建失败后的恢复、冲突主来源选择、来源创建字段、运行修订号、确认摘要与决策、幂等键及重试完成。该场景只验证当前 UI/API 契约，不连接真实 PingCode 或共享业务数据库。随后重跑固定前端全量清单。

## 2026-11-13T19:53:00+08:00 助手抽屉焦点失败诊断

前端复采已越过任务管理和在线审核场景，在手册助手抽屉 UI 契约中发现打开后焦点未落到页签。抽屉互斥、ARIA 状态检查通过。先增强失败信息，记录实际 activeElement、抽屉 class 与打开页签数量；据该浏览器证据确认测试夹具重复 DOM 选择或产品焦点行为后，再进行最小修复。此场景未通过前，本轮前端采集不作为稳定覆盖率报告。

## 2026-11-13T19:51:00+08:00 任务管理采集导航遵循账号权限

前置场景修复后，固定采集在任务管理通用导航等待 `config` 标签超时。产品 `document-tasks/view.js` 仅对 `ctx.canAdmin` 渲染该管理标签，而本场景使用普通账号；因此不应在通用导航中假定管理员权限。将通用导航切换为所有账号均可见的 `list`、`secondary`、`flow`；管理员任务配置仍由独立 `document-tasks-frontend.test.cjs` 真实 HTTP 浏览器套件覆盖，不降低产品权限或跳过专用场景。

## 2026-11-13T19:48:00+08:00 前端在线审核前置状态覆盖场景同步

修复前置失败后，采集在在线审核场景发现旧夹具以文本框构造审核人，并假定不合法输入会进入提交错误提示。当前产品先执行公开就绪校验：审核人由真实 select 选项承载，表单须处于 `ready`；无效稿件数量、范围、审核人、路径或分支时提交保持禁用且不发请求。更新固定浏览器夹具使用真实表单结构，对前置不满足场景断言禁用/无错误/无请求；对有效输入分别保留网络失败和空审核响应的错误聚焦与按钮恢复检查及请求正文断言。

## 2026-11-13T19:46:00+08:00 前端增量范围表单夹具修正

完整采集进入增量表单委托场景后，`documentIds` 实际序列化为空，与固定夹具期望不符。核对公开 `app.js` 表单处理器确认其契约是读取 `[name="documentIds"]:checked`，而夹具错误使用了不存在于真实表单的 textarea。将夹具改为三个已勾选文档复选框，继续断言文档 ID、章节 ID、语言、失败恢复及两次请求相同的幂等键和正文；真实行为契约不变。修复后重跑完整前端固定采集。

## 2026-11-13T19:45:29+08:00 前端复采写作采纳断言同步

生产总览导航修正后，完整采集继续进入既有写作采纳 HTTP 场景。场景以真实页面和本机隔离 API 注入首次 503，再验证候选正文保留及重试成功；当前页面失败状态为“保存未完成”，夹具仍等待旧文案“采用未完成”而超时。将状态断言同步到当前 UI 文案，不放宽按钮可用性、候选保留、二次成功及请求载荷断言。然后重跑全部前端固定采集，不把中断运行纳入覆盖率。

## 2026-11-13T19:43:09+08:00 前端固定采集导航契约修正

基于当前工作树启动固定前端 Istanbul 完整采集时，导航在生产总览等待 `[data-production-overview-tab="versions"]` 超时，采集器以 `completed=false` 退出，不能计为覆盖结果。核对产品 `modules/production/view.js` 后确认真实标签为 `handbooks`、`progress`、`tasks`、`generations`；采集器仍使用已删除的 `versions` 名称。将采集导航列表更新为当前公开 DOM 契约，四个真实页签都须可见且可激活，再重新执行完整固定源码/测试输入清单。验收以采集器退出 0、全部场景计数完整、`source-stability.json` 的 completed/stable/inputsStable 均为 true 且变更列表为空为准；不得合并失败运行或缩小源码分母。

## 2026-11-13T09:27:56+08:00 专业报告验收补记

业界能力映射采用 Allure（运行概览与失败证据）、Playwright HTML Reporter（状态筛选和用例深链）、ReportPortal（质量总览）、pytest-html（离线明细）。本地报告以中文静态总览和场景分页承载这些能力，逐条结果、失败日志、跨页检索、覆盖率分子/分母及门禁结果均保留来源链接；不从缺失数据推断历史趋势或重试信息。

最新真实执行 `python3 tests/run_tests.py smoke --report-page-size 2` 生成 `runtime/test-results/smoke/20261113-091914-942932-smoke/report.html`，2/2 任务、24/24 用例通过。入口回归 `python3 -m unittest tests.unit.root.test_run_tests` 为 46/46。REA Chromium Evidence `ev_97afb20ecbbe1bb4e72ea65322a90108c7beb40262a7ebfb3b9a1f9757fb707f` 状态 completed、完整性 complete，仅观察本机报告。离线浏览器 1440px/390px 各 10 次导航，DCL P95 为 17.1ms/15.5ms；搜索命中 17 条、深链及无 JavaScript 分页通过。390px 下表格区域可聚焦，方向键改变横向位置，End 到达末端、Home 回到起点；无页面横向溢出、脚本错误和外部请求。

沿用七项内部报告质量量表 9.5/10，离线与性能项为 0.5/1，保留大样本性能测量波动及部分历史报告桌面冷开超过 100ms 的限制。评分是内部自评，不是第三方认证。该 smoke 未启用覆盖率，不能用于证明知识中心管理平台行覆盖率 100%、分支覆盖率 95% 达标。

## 2026-11-13T09:05:36+08:00 专业报告移动端表格可用性补强

参考 Playwright HTML Reporter 的清晰结果定位、Allure 的运行与失败概览、ReportPortal 的统计总览及 pytest-html 的详情证据。针对 REA/Chromium 最新报告截图中窄屏数据表列宽被压缩、横向滚动区域缺乏统一键盘入口的问题，所有场景统计、覆盖率、任务和用例表均以带可访问名称、`tabindex=0` 的语义区域包裹；窄屏为场景表、任务表和逐条用例表保留合理最小列宽，使用表格容器内部横向滚动，避免单元格过度挤压或页面整体溢出。

伪代码：`for table in overview_and_scene_pages: assert named_focusable_region(table); on narrow viewport assert pageWidth == viewportWidth and tableContainer.scrollWidth >= tableContainer.clientWidth;` 以真实 smoke 报告生成和本机 Chromium 390px/1440px 复验，继续检查零页面级横向溢出、脚本错误和外部请求，并保留搜索、深链、分页、无 JS 浏览验收。数据与统计语义不变。

### 2026-11-13T09:12:00+08:00 表格横向滚动键盘操作

390px 实测确认具名 `role=region` 表格容器可通过 Tab 聚焦，场景统计表和任务表有横向溢出，但仅依赖原生 `div` 聚焦不能稳定用方向键移动横向位置。报告交互脚本为所有具名表格区域添加键盘操作：左右方向键以 48px 步长滚动，Home/End 到达左右边界；无横向溢出的区域不拦截这些按键。静态 HTML 与无 JavaScript 分页保持可用。

伪代码：`on keydown(region): max = scrollWidth - clientWidth; if max <= 0 return; ArrowLeft/ArrowRight => scrollBy(±48); Home/End => scrollTo(0/max); preventDefault only when handled`。验收需在真实生成报告的桌面与 390px 视口检查页面无横向溢出；窄屏首个宽表可 Tab 聚焦并由 ArrowRight 改变 `scrollLeft`、End 到达末端、Home 返回起点；用例场景页宽表也可滚动。同步跑报告入口单测、生成实际 smoke 并记录 REA Chromium Evidence。

## 2026-11-13T07:51:09+08:00 最新 smoke 报告 REA 验收

参考 Allure 的运行概览与失败证据、Playwright HTML Reporter 的状态筛选/用例定位、ReportPortal 的质量总览、pytest-html 的离线日志明细；官方来源访问结果及哈希记录在 `runtime/rea/professional-test-report/sources.json`、`official-repositories.json`。本轮重新使用仓库 REA `app-capability-transfer`/`reverse-engineer-anything` Skill 和固定 CLI，对最新真实 smoke HTML 执行本机 Chromium 受控观察。Evidence `ev_210f466d5d347d920337a8e1b4512123ddd9c1c67802c3bbaa1b4beebb1778c4` 保存于 `runtime/rea/professional-test-report/current-smoke-rea-evidence-20261113-074912.json`；状态 completed、完整性 complete，无截断，仅访问回环地址。

`python3 -m unittest tests.unit.root.test_run_tests` 为 45/45；`python3 tests/run_tests.py smoke --report-page-size 2` 为 2/2 任务、24/24 用例通过，生成 `runtime/test-results/smoke/20261113-074912-988667-smoke/report.html`，含中文总览及 12 个场景静态分页。最新 REA Evidence 佐证总览结构与无障碍树；交互分页、搜索、深链、无 JS 与大样本性能沿用 `ACCEPTANCE.md` 已记录的独立 Playwright 验收，不把单次 REA 捕获扩大为完整交互验收。

内部七项报告质量量表 9.5/10：数据可信 2/2、失败定位 2/2、检索导航 2/2、视觉层级 1.5/1.5、无障碍与移动端 1/1、离线与性能 0.5/1、可追溯 0.5/0.5。性能项仍保留扣分；评分为内部自评，不是第三方认证，也不代表平台行 100%、分支 95% 覆盖率门禁通过。

## 2026-11-13T05:02:00+08:00 专业 HTML 报告最新代码 REA 复验

业界能力映射沿用 Allure 的运行概览/失败证据、Playwright HTML Reporter 的状态筛选/用例定位、ReportPortal 的质量总览、pytest-html 的离线明细/日志；来源及可访问性限制见 `runtime/rea/professional-test-report/sources.json`、`official-repositories.json`。仓库 REA `app-capability-transfer` 和 `reverse-engineer-anything` 工作流应用于本轮最新报告，新增受控浏览器 Evidence `ev_542d8f4f5e06e204908a254c7270fb806502ae6d42b0d4b8347551324a35f33a`，存档 `runtime/rea/professional-test-report/current-smoke-rea-evidence-20261113-latest.json`；只观察回环地址本地 HTML，Evidence 完整无截断。

真实 `python3 tests/run_tests.py smoke --report-page-size 2` 通过 2/2 任务、24/24 用例，生成 `runtime/test-results/smoke/20261113-045744-921003-smoke/report.html`。统一入口回归 `python3 -m unittest tests.unit.root.test_run_tests` 为 45/45。当前报告离线 Chromium 在 1440px 和 390px 各导航 10 次，DOMContentLoaded P95 分别为 65.8ms、22.1ms；搜索、用例深链、无 JavaScript 静态分页通过，零脚本错误、外部请求和横向溢出。原始测量及截图见 `runtime/rea/professional-test-report/report-verification.json` 和同目录截图。

报告内部七项量表为 9.5/10：数据可信 2/2、失败定位 2/2、检索导航 2/2、视觉层级 1.5/1.5、无障碍与移动端 1/1、离线与性能 0.5/1、可追溯 0.5/0.5。性能维度保留扣分，不把 24 条 smoke 样本泛化成所有设备或大报告性能保证；评分不是第三方认证，也不代表知识中心管理平台行覆盖率 100%、分支覆盖率 95% 达标。

## 2026-11-13T04:39:17+08:00 HTML 报告当前工作树复验

执行 `python3 tests/run_tests.py smoke --report-page-size 2`，2/2 任务通过，Jest 22/22、Python unittest 2/2，共 24/24 用例通过；生成 `runtime/test-results/smoke/20261113-043917-631029-smoke/report.html` 和 12 个静态场景分页。报告沿用 9.5/10 内部质量验收和业界能力映射；评分依据及 REA 证据边界见 `runtime/rea/professional-test-report/ACCEPTANCE.md`。统一入口回归 `python3 -m unittest tests.unit.root.test_run_tests` 为 45/45；本次不代表行覆盖率 100%、分支覆盖率 95% 目标通过。

## 2026-11-13T04:52:41+08:00 前端公共按钮禁用分支稳定复采

在固定 Chromium 的 `common/ui-system.js` 契约场景补充 `uiButton({ disabled: true })` 输出断言，覆盖普通按钮显式禁用分支。第一次复采遇默认端口 3627 已占用；更换端口后一次复采在后续任务管理页等待弹窗超时，独立真实 HTTP/浏览器测试 2/2 通过。再次串行完整采集 `runtime/coverage-goal/frontend-ui-button-disabled-20261113-final/` 退出 0，59 个产品脚本、1286 个跟踪输入均稳定（`completed/stable/inputsStable=true`，`changedFiles=[]`、`changedInputs=[]`），行 9930/10957（90.62%）、分支 11465/15320（74.83%），较上一稳定报告净增 2 行、2 个分支。伪代码：`assert(uiButton({label, disabled:true}).includes(' disabled'))`。平台行 100%、分支 95% 目标仍未达成。

## 2026-11-13T04:27:06+08:00 当前烟测报告复验

使用仓库 REA 的 `reverse-engineer-anything` 与 `app-capability-transfer` Skill 约束证据范围，沿用已归档的 Allure、Playwright HTML Reporter、ReportPortal、pytest-html 能力映射和受控 Chromium Evidence；本次 REA MCP 未连接，没有生成新的 REA Evidence。真实命令 `python3 tests/run_tests.py smoke --report-page-size 2` 通过 2/2 任务、24/24 用例，生成 `runtime/test-results/smoke/20261113-042706-758997-smoke/report.html`。专业报告内部评分沿用 9.5/10：场景分页、跨页检索、失败定位、深链、离线和无 JavaScript 浏览均已验证；历史 3,469 条用例样本的桌面与窄屏 DCL/load P95 均小于 100ms。评分是内部评价，不代表第三方认证或平台覆盖率目标达标。

## 2026-11-13T03:40:24+08:00 专业报告当前工作树复验

参考 Allure 的结果概览/失败证据、Playwright HTML Reporter 的状态筛选/用例定位、ReportPortal 的质量总览、pytest-html 的离线明细/日志。按仓库 REA `app-capability-transfer` 工作流将参考能力映射到本地报告：中文总览、场景静态分页、全局搜索和状态筛选、用例深链、失败日志、JSON 溯源、离线及无 JS 浏览、可选覆盖率门禁。参考来源及官网 403 说明见 `runtime/rea/professional-test-report/sources.json`、`official-repositories.json`。

REA `app-capability-transfer` 的既有受控 Chromium Evidence：`ev_0278f84e07001b67276b390d4370d01a14bef8c5a625df3c00eb3e84dafe4bcf`，文件 `runtime/rea/professional-test-report/current-smoke-rea-evidence-20261113.json`。该次实际观察记录了 24 条明细、场景导航、搜索控件、失败入口、完整无障碍树和截图，证据无截断。当前会话没有连接 REA MCP，本次没有生成新的 REA Evidence；最新报告由本地 Playwright 离线复验。内部报告质量评分 9.5/10，量表和性能扣分见 `runtime/rea/professional-test-report/ACCEPTANCE.md`，属于项目内部评价，不是第三方认证。

最新入口回归 `python3 -m unittest tests/unit/root/test_run_tests.py` 为 45/45。当前工作树真实 smoke 为 2/2 任务、24/24 用例通过（Jest 22/22、Python unittest 2/2），报告 `runtime/test-results/smoke/20261113-033946-228165-smoke/report.html`。同一报告在离线 Chromium 桌面 1440px 和窄屏 390px 各导航 10 次，DCL/load P95 分别为 25.0/25.5ms、22.5/23.1ms；搜索、用例深链、禁用 JavaScript 后的静态分页通过，无页面脚本错误、外部请求及横向溢出。复验数据见 `runtime/rea/professional-test-report/report-verification.json`。3,469 条历史用例大样本复验桌面/窄屏的 DCL/load P95 分别为 19.1/23.3ms、70.3/70.9ms，335 条搜索结果、失败筛选、深链和无 JS 分页均通过。报告评分与知识中心管理平台行覆盖率 100%/分支覆盖率 95% 是独立验收项；覆盖率目标仍未达成。

## Java 逐任务迁移命令保护条件

最新固定 Java 报告未覆盖公开 `migrate-tasks` / `activate-tasks` 对非个人目标库和空备份路径的拒绝路径。扩展现有隔离 JDBC 命令夹具，分别使用 `YASDB_STORAGE_TARGET_CLASS=shared` 与空 `KC_DOCUMENT_TASK_BACKUP_PATH` 调用公开命令；复制和激活各覆盖两种拒绝。断言错误信息匹配安全契约、提交数为 0、激活状态不变，且空路径场景不创建备份文件。伪代码：`for command in [copy,activate]: run(wrongTarget); assert refused/no commit; run(emptyBackup); assert refused/no commit/no backup`。保持固定 15 个 Java 产品源码文件分母，不连接业务数据库。

验收：`copy-wrong-target`、`copy-no-backup`、`activate-wrong-target`、`activate-no-backup` 均通过公开 `Main.main` 命令入口及隔离 JDBC；JaCoCo HTML 确认 `Main.java:213-228` 对应的四个守卫分支全部覆盖。完整采集 `runtime/coverage-goal/java-command-guards-20261113/` 退出 0，固定 15 文件输入稳定（`stable=true`、`changedFiles=[]`），行 4814/4867（98.91%）、分支 2986/3609（82.74%）；相较同分母 `java-resource-element-invalid-20261113b` 净增 2 行、4 分支。Java 与 Node、前端均尚未达到平台 100% 行/95% 分支目标。

## Java 任务编号校验边界

固定 JaCoCo 显示 `TaskNumber.parse/sr/ir` 仍有空值、非法前缀、前缀长度/分隔符边界及 SR/IR 类型不匹配分支未覆盖。扩展纯 Java `TaskNumberCheck`：空值、17 字符前缀、末尾分隔符、数字开头前缀按 `DOCUMENT_TASK_NUMBER_INVALID` 拒绝；有效语法但错误领域前缀分别按 `PINGCODE_SR_NUMBER_INVALID` 和 `PINGCODE_IR_NUMBER_INVALID` 拒绝。保留前导零、非数字和 long 溢出的既有拒绝测试；不更改产品解析规则。

完整采集 `runtime/coverage-goal/java-task-number-boundaries-20261113/` 退出 0，固定 15 个 Java 产品文件及输入稳定（`stable=true`、`changedFiles=[]`）。行覆盖 4814/4867（98.91%），分支 2992/3609（82.90%）；相较 `java-command-guards-20261113` 行覆盖不变、净增 6 个分支。平台行 100%/分支 95% 目标仍未达成。

## 2026-11-13 Java 历史审核索引畸形结构边界

`DocumentTaskIndex.historicalReviewIds` 对历史审核快照容忍缺失或错误类型的嵌套集合，并忽略非对象节点、空审核 ID、重复审核 ID。扩展既有纯 Java 契约夹具：分别传入缺少 `scopeHistory/scopeChanges` 的任务，以及含错误类型历史节点、手册集合、文档集合和来源意见的输入；同时覆盖空白/缺失 ID 和跨历史来源重复 ID。断言畸形值不抛异常、不产生索引项，有效 ID 保持去重。伪代码：`assert historicalReviewIds(empty)==empty; assert historicalReviewIds(mixed)==exactValidDeduplicatedIds`。不修改产品解析和索引规则。

定向夹具编译及运行通过。完整 `runtime/coverage-goal/java-history-shape-20261113/` 退出 0，15 个产品源文件输入稳定（`stable=true`、`changedFiles=[]`）；行覆盖 4814/4867（98.91%），分支 3001/3609（83.12%）。相较 `java-task-number-boundaries-20261113` 行覆盖不变、净增 9 个分支；平台目标仍未达成。

## 2026-11-13 PingCode 图片资源元素类型拒绝

最新固定 Java JaCoCo 中 `PingcodeTaskRepository.stageItem` 的资源数组元素类型拒绝尚未由 HTTP 场景触达。扩展现有隔离 JDBC 的真实 `/runs/{id}/pages` 边界流程：合法分页包含 `imageResources: ["invalid"]`，接口应返回 422 `PINGCODE_RESOURCE_INVALID`，且无已提交分页、工单或资源状态变化；随后恢复夹具中的事务回滚状态并继续既有合法分页场景。伪代码：`POST page(with non-object resource) -> 422 -> assert no persisted state -> POST valid page -> 200`。仅覆盖既有输入校验，不更改产品规则。

完整固定 Java 采集 `runtime/coverage-goal/java-resource-element-invalid-20261113b/` 退出 0，15 个产品源码输入稳定（`stable=true`、`changedFiles=[]`）。行覆盖保持 4812/4867（98.87%），分支增至 2982/3609（82.62%）；`PingcodeTaskRepository.java:853` 的两个资源元素类型分支均命中。相较同分母 `java-write-replay-invalid-20261113` 净增 1 个分支，行覆盖无变化。全平台目标仍未达成。

## 2026-11-13 专业报告大样本首屏性能续验

业界参考继续沿用 Allure 的总览和失败证据、Playwright HTML Reporter 的状态筛选/定位、ReportPortal 的质量概览、pytest-html 的离线明细；依据仓库 REA 能力迁移流程，将 3,469 条真实历史用例报告作为大样本行为证据。全量搜索索引仅在首次搜索时加载；固定的内联启动器在静态报告 `window.load` 后才异步读取交互脚本，不含任何用户数据插值，避免额外启动器请求和交互代码延迟首屏。首屏仍由静态 HTML/CSS 完整呈现，脚本装载后再启用搜索、状态筛选及深链；保留无脚本静态分页及离线相对资源。验收同一真实报告桌面 1440px、窄屏 390px 各 10 次导航，检查 DOMContentLoaded 和 load 两项 P95 均 <100ms、搜索/失败筛选/深链、无 JS 分页、零页面错误/外部请求/横向溢出。伪代码：`render(static summary) -> window.load -> load interaction bundle -> wait(search ready) -> assert search and navigation`。本次为已有报告性能优化，不改变测试结果数据与覆盖率门槛。

## 2026-11-13 数据库迁移等价索引公开命令覆盖

最新固定 15 文件 JaCoCo 中 `SchemaMigrationManager.java` 的整行缺口集中在 `executeSqlScript` 遇到 `YAS-02043` 后查询 `USER_IND_COLUMNS` 识别等价索引。扩展现有 `StorageMainCommandCheck` 的独立 `migrate-index-equivalent` JVM 场景：本次 `runtime` SQL 文件先创建迁移表，再执行 `CREATE INDEX ... (COL_A,COL_B)`；合成 JDBC 对后者返回 `YAS-02043`，并经真实预编译查询返回同一现有索引的两列。调用公开 `Main.main("migrate")` 后断言迁移记录、双语句执行、提交次数和完成输出。伪代码：`Main.main(migrate) -> execute table -> index error -> query USER_IND_COLUMNS -> equivalent -> record migration -> commit`。场景保留隔离 JDBC 和完整 15 文件 JaCoCo 分母，不连接业务库。

完整 `runtime/coverage-goal/java-equivalent-index-20261113/` 退出 0、15 产品文件及输入稳定，行 4802/4867、分支 2960/3609，较上一报告净增 12 行和 5 分支；迁移管理器已无完全未覆盖源码行。再补 `migrate-index-conflict`：合成 `USER_IND_COLUMNS` 只返回 `COL_A`，与请求的 `(COL_A,COL_B)` 不等价；真实 `Main.main("migrate")` 应保留 `YAS-02043` 拒绝、回滚且不记录版本。伪代码：`CREATE INDEX error -> query incomplete existing index -> rethrow -> rollback -> assert no commit/applied version`。

`java-index-conflict-20261113` 完整采集退出 0 且输入稳定，行保持 4802/4867、分支增至 2961/3609。后续优先补 PingCode 暂存前置拒绝：在既有隔离真实 `/runs/{id}/pages` 的 `boundary` 场景中，合法页元数据但分别携带非法 SR 编号、非 List 的图片资源、READY 资源无效路径及非正数字节数；每次应返回 422 的专属错误码且 `pagesRead/rowsRead` 不变。伪代码：`POST invalid item/page -> 422 -> assert no staged rows -> POST valid page -> success`。不改变来源、运行或任务数据规则。

完整 `runtime/coverage-goal/java-pingcode-item-invalid-20261113/` 退出 0 且输入稳定，15 文件行 4807/4867、分支 2970/3609，较上一报告净增 5 行、9 分支。继续扩展同一真实资源恢复流程：第一次重试上游仍失败，提交 `FAILED` 及 `sourceUrl`、省略 `byteCount`，应保存版本 2 并保持 `CONFIRMED_MISSING_IMAGES`；第二次以版本 2 为前置提交 READY，保存版本 3 并清空失败资源。伪代码：`FAILED v1 -> retry FAILED v2 -> retry READY v3 -> confirm source/run resource state`。不得把首次重试失败误记为恢复完成。

`runtime/coverage-goal/java-pingcode-failed-retry-20261113/` 完整采集退出 0、输入稳定，行 4808/4867、分支 2975/3609，同分母净增 1 行和 5 分支。文档任务读取仓储仍缺非 SR 任务的空 IR 分支。扩展隔离 JDBC 对 `YASHAN-7` 的真实 `/v1/document-tasks/YASHAN-7` GET 回读，断言任务编号与 `ir=[]`，且不查询 SR 关系表；伪代码：`GET non-SR -> attachIr sees no SR numbers -> empty ir -> 200`。不改变产品支持的任务编号规则。

`runtime/coverage-goal/java-document-nonsr-20261113/` 完整采集退出 0，15 文件及输入稳定；行 4810/4867（98.83%）、分支 2979/3609（82.54%），新覆盖 `DocumentTaskReadRepository.java:208,209` 两行。相对本轮开始的 `java-document-pages-20261113` 同分母净增 20 行、24 分支。Java 仍缺 57 行，95% 分支门槛至少还差 450 项。剩余整行主要为 `Main.java` 33 行、`PingcodeTaskRepository.java` 16 行、`DocumentTaskWriteRepository.java` 6 行、`DocumentTaskMigration.java` 2 行；须分别核对可达性与真实契约，不缩减产品源码清单。Node 与前端目标也未完成。

验收 `runtime/coverage-goal/java-write-replay-invalid-20261113/`：隔离 JDBC 的真实 HTTP 场景先执行配置和任务写入及幂等回放，再注入数组格式的损坏配置回放结果和非法 JSON 任务写入结果；分别断言 422 `DOCUMENT_TASK_CONFIG_INVALID`、422 `DOCUMENT_TASK_RESULT_INVALID`，且版本与提交次数不变，随后恢复合成状态。完整 JaCoCo 报告覆盖固定 15 个 Java 产品源码文件，`source-stability.json` 为 `stable=true`、`changedFiles=[]`；行 4812/4867（98.87%）、分支 2981/3609（82.60%），相对 `java-document-nonsr-20261113` 同分母净增 2 行、2 分支。Java 仍缺 55 行，达到 95% 分支至少还需 448 项；Node、前端和平台覆盖率目标仍未完成。

## 2026-11-13 文档任务索引真实 HTTP 覆盖

稳定 15 文件 JaCoCo 中 `DocumentTaskIndex.java` 仍缺手册、文档负责人及审核关联的索引插入行。扩展现有隔离 JDBC 的 `/v1/document-tasks/YDBRD-99` 真实 PUT 创建场景：任务包含负责人、已确认拆分的手册与文档、当前审核任务，以及历史拆分和来源意见的审核任务。合成 PreparedStatement 记录三张索引表的 `addBatch` 绑定；成功后检查手册 ID、三个角色负责人和去重后的审核任务 ID，并通过 GET 回读正文。伪代码：`PUT nested task -> capture ACTOR/REVIEW/HANDBOOK batches -> assert exact bound sets -> GET task -> replay idempotency`。仍用隔离 JDBC，不访问业务库；采集后检查 15 个产品源码分母和输入稳定。

首次完整复采 `runtime/coverage-goal/java-document-index-20261113/` 退出 0，源码和输入稳定，15 文件行 4778/4867、分支 2933/3609，较上一报告净增 4 行和 4 分支。索引类只剩三条部分覆盖的拒绝行。扩展同一真实 PUT：ownerId 超过 128 字符、reviewTaskId 超长、handbook ID 为空分别应返回 422 的专属错误码且不提交。夹具在每个拒绝请求后恢复合成行版本与正文，模拟真实事务回滚，使三个拒绝场景相互独立；伪代码：`snapshot -> PUT invalid nested task -> 422 -> assert no commit -> restore synthetic row`。不更改产品规则。

第二次完整采集 `runtime/coverage-goal/java-document-index-invalid-20261113/` 退出 0 且输入稳定；索引类全部源码行已覆盖，全量行仍为 4778/4867，分支升至 2936/3609。三处拒绝与条件位于同一源码行，之前已计行覆盖，因此只增加 3 个分支。接着覆盖文档任务读取仓储的真正缺行：合成配置行缺失、非对象配置正文、畸形任务正文，经真实 `/config` 和 `/YDBRD-42` GET 按当前错误映射分别返回 503 `STORAGE_UNAVAILABLE`、422 `DOCUMENT_TASK_CONFIG_INVALID`、422 `DOCUMENT_TASK_PAYLOAD_INVALID`，拒绝请求不得提交；恢复合成行后合法 GET 仍成功。伪代码：`inject missing/invalid JDBC row -> GET -> assert status/code/no commit -> restore -> GET valid`。该夹具仍仅使用内存 JDBC。

第三次完整采集 `runtime/coverage-goal/java-document-read-invalid-20261113/` 退出 0，`source-stability.json` 为 `stable=true`、`changedFiles=[]`，15 文件行 4780/4867（98.21%）、分支 2941/3609（81.49%），相同分母净增 2 行和 5 分支。XML 核对新整行在 `DocumentTaskReadRepository.java:28,195`，其余配置缺行和索引拒绝属于已有行上的分支。Java 尚缺 87 行，95% 分支门槛至少还差 488 项；Node、前端仍未达到全平台目标。

下一步沿同一 `/v1/document-tasks` 公开 GET 传入 `ownerId/product/version/type/status/q/ir/page/pageSize` 组合，验证筛选条件、大小写转换、关键词绑定和有效分页均进入真实 SQL；补充非 YDBRD 任务时 `attachIr` 返回空列表的分支。非法分页已覆盖，产品规则不变。

完整 `runtime/coverage-goal/java-document-filters-20261113/` 退出 0；15 文件行 4788/4867、分支 2951/3609，相同分母净增 8 行、10 分支。继续经真实 GET 验证 `/mine?principalId=177&page=2&pageSize=1` 的合法数字解析，以及列表 `page=0`、`pageSize=101` 的范围拒绝；错误请求应为 422 且不提交。伪代码：`GET numeric mine -> 200; GET list(out-of-range) -> 422; assert commit delta only successful request`。

分页复采 `runtime/coverage-goal/java-document-pages-20261113/` 退出 0，15 文件及输入稳定，行 4790/4867（98.42%）、分支 2955/3609（81.88%）；较筛选报告净增 2 行、4 分支。相对本轮开始的 `java-document-read-invalid-20261113`，组合筛选和分页合计新增 10 行、14 分支。Java 仍缺 77 行，达到 95% 分支至少还需 474 项。非 YDBRD 的 `attachIr` 分支尚未覆盖，后续需通过独立公开任务入口处理。

## 2026-11-13 专业报告评分与 Java 覆盖率同步

报告实现沿用 REA 参考的 Allure 运行概览与失败证据、Playwright HTML Reporter 的状态筛选和定位、ReportPortal 的质量总览、pytest-html 的离线日志详情。由于当前会话没有已连接的 REA MCP 工具，本轮只使用仓库已保存的 REA 证据和官方来源快照，不把未抓取页面当作运行事实。总览新增基于真实逐条耗时的前 10 条用例诊断，并修正场景明细中超时和中断未计入失败的统计。伪代码：`filter(valid duration) -> sort descending -> first 10 -> deep link`；场景失败数为 `FAIL + TIMEOUT + INTERRUPTED`。报告实现的内部质量评分维度和分值见 `runtime/rea/professional-test-report/ACCEPTANCE.md`，该分数不写入单次报告，也不代表覆盖率达标。

验收：统一入口回归 45/45、真实 smoke 24/24，生成 `runtime/test-results/smoke/20261113-011754-420948-smoke/report.html`。离线 Chromium 桌面/390px 各 10 次，DOMContentLoaded P95 为 64.4ms/21.7ms，无脚本错误、外部请求或横向溢出；无脚本分页可用。新增回归断言验证耗时排序、转义和超时计数。大型报告冷开超 100ms 的历史限制未消除，内部评分维持 9.5/10，性能项仍只得 0.5/1。

最新完整 Java JaCoCo 采集 `runtime/coverage-goal/java-task-aggregate-protection-20261113/` 退出 0，15 个产品源码文件输入稳定（`stable=true`、`changedFiles=[]`），行 4774/4867（98.09%）、分支 2929/3609（81.16%）。仍缺 93 行；达到 95% 分支至少还需 500 项。未覆盖行集中于 `Main.java` 35、`PingcodeTaskRepository.java` 22、`SchemaMigrationManager.java` 12、`DocumentTaskReadRepository.java` 12、`DocumentTaskWriteRepository.java` 6、`DocumentTaskIndex.java` 4、`DocumentTaskMigration.java` 2。该结果是 Java 局部最新基线，不代表 Node、前端和平台三端目标完成。

## 2026-11-13 文档任务可见手册筛选 HTTP 覆盖

当前 15 文件 Java 报告中 `DocumentTaskReadRepository.appendVisibility` 的空集合、白名单参数绑定和拒绝分支未全部覆盖。沿现有隔离 JDBC 真实 `/v1/document-tasks`、`/mine` HTTP 夹具，传入空的 `visibleHandbooks`、有效的逗号分隔 ID、空 ID 和超过 1000 个 ID；验证 SQL 白名单占位符与绑定顺序、成功响应，以及非法输入的 `DOCUMENT_TASK_VISIBILITY_INVALID` 且无提交。伪代码：`GET list/mine(valid IDs) -> assert bound values; GET(empty) -> assert NOT EXISTS; GET(blank/oversized IDs) -> 422 and no commit`。产品查询规则不变，完整 15 文件 JaCoCo 保持同分母和输入稳定。

验收：空集合、有效 ID、空 ID 与超量 ID 的本机真实 HTTP 场景定向通过；完整 `runtime/coverage-goal/java-document-visibility-20261113/` 退出 0、15 文件输入稳定，行 4715/4867、分支 2838/3609。首次创建及幂等冲突定向通过；后续完整 `runtime/coverage-goal/java-document-create-20261113/` 退出 0、输入稳定，行 4741/4867（97.41%）、分支 2862/3609（79.30%）。文档任务写入仓储仍缺 6 行。

### 首次创建与幂等冲突

同一隔离 JDBC 真实 HTTP 夹具还应覆盖 `DocumentTaskWriteRepository.put` 的版本 0 创建分支。为第二个编号维护独立任务状态；通过公开 PUT 创建 `YDBRD-99`，核对索引替换、保存后 GET 和写入记录回放，随后相同幂等键但不同请求摘要必须返回 `DOCUMENT_TASK_IDEMPOTENCY_CONFLICT`，且不得重复创建或提交。伪代码：`PUT new(version 0) -> GET task -> GET write -> PUT same key/new digest -> 409 -> assert one insert`。不改变产品写入规则。

## 2026-11-13 PingCode 需求关联工单 HTTP 覆盖

PingCode 仓储剩余未覆盖流程包含 REQUIREMENT 来源的 IR 快照与关联 SR 暂存。沿同一隔离 HTTP/JDBC 夹具增加独立 JVM 模式：真实登记合法需求来源 URL，创建运行，提交一页含 `YASHAN-7` 与 `YDBRD-42` 的 `workItems`，完成运行后读取预览，验证 IR 快照数量、关系行和预览中的关联编号。无业务数据库写入。伪代码：`POST requirement source -> POST run -> POST page(IR with SR) -> finish -> GET preview -> assert ir/sr relation`；非法关系值另行通过公开 API 断言 422，固定 15 文件 JaCoCo 验收。

验收：独立 REQUIREMENT HTTP 模式及原 TICKET 模式定向通过；完整 `runtime/coverage-goal/java-pingcode-requirement-20261113/` 退出 0，15 文件及输入稳定，行 4733/4867、分支 2857/3609。此前第二次更新与第三次移除真实 HTTP 流程已纳入固定采集，分别由 `java-pingcode-history-20261113` 和 `java-pingcode-removal-20261113` 稳定报告核对；最新 PingCode 仓库 550/584 行，仍缺 34 行。

### 来源与分页状态边界

使用同一隔离 HTTP/JDBC 夹具的独立 JVM 模式验证停用来源拒绝创建运行，重新启用后运行可创建；尚在 COLLECTING 的运行拒绝失败资源读取、资源重试和确认。分页暂存先提交总页数 2、总行数 2 的第一页，再以不同总行数、来源版本、筛选摘要、越界页号及超额行数请求第二页，均应在状态更新前返回明确错误码且 `pagesRead`/`rowsRead` 不变；合法第二页可继续完成。另起运行覆盖 `pageCount=0` 但 `count>0` 的拒绝。伪代码：`disabled source -> 422; active source -> run; stage page0; mutate metadata/page bounds -> 409/422 no counters; stage page1 -> finish`。产品规则不变，完整固定 JaCoCo 验收。

### 确认前置条件与资源缺失

在已暂存、待确认的隔离运行中，分别临时让配置缺少默认负责人、来源停用或来源版本变化、当前任务行版本变化；通过公开 `/confirm` 验证 `DOCUMENT_TASK_OWNER_REQUIRED` 或 `PREVIEW_STALE`，恢复夹具状态后才执行成功确认。成功后用错误摘要重复确认应拒绝。缺图恢复前，以合法格式但不存在的资源 ID 请求重试，应返回 `PINGCODE_RESOURCE_NOT_FOUND` 且不增加资源版本。所有拒绝都发生在实际写入前；伪代码：`mutate one prerequisite -> POST confirm -> assert 409/no task writes -> restore -> confirm success -> wrong replay 409 -> missing resource 404`。

### HTTP 错误入口

在现有真实本机 HTTP 夹具补 PingCode 未知动作/路径、非法 JSON、非法数字页码及缺少确认摘要/版本；文档任务补配置缺失必需字段、无效 JSON、幂等键不一致、未知子路径和非法本人任务分页。分别断言 400/405/422 与具体错误码，检查任务与来源写入计数不变。伪代码：`send malformed/unsupported request -> assert route error -> assert no persisted write`。这是公开路由错误处理覆盖，不更改业务规则。

### 激活后旧任务聚合写入保护

当前 `Main.upsertRecord` 在 `document_tasks/state` 且逐任务迁移 ACTIVE 时禁止修改旧聚合中的 `tasks`，但允许只更新兼容配置；删除旧聚合一律拒绝。沿现有隔离 records HTTP/合成 JDBC 夹具，先切换合成迁移状态 ACTIVE，GET/PUT 使用独立旧聚合 JSON 行；只变更 config 的 PUT 应提高修订号，改变 tasks、提交非 Map JSON 或将旧行标记删除后的 PUT 均应返回 `DOCUMENT_TASK_LEGACY_WRITE_DISABLED` 且不提交，DELETE 返回 `DOCUMENT_TASK_DELETE_FORBIDDEN`。伪代码：`activate fixture -> PUT config only=200 -> PUT changed tasks=409 -> PUT invalid aggregate=409 -> PUT deleted legacy=409 -> DELETE=409`。真实调用公开 `/v1/records/document_tasks/state`，不访问业务数据库。

## 2026-11-13 PingCode 确认入库公开 HTTP 覆盖

### 历史运行变更

资源恢复后保留首个已确认运行的来源版本、快照标题/正文摘要和任务行版本，再通过公开 HTTP 创建第二个运行，暂存同编号但标题与正文均改变的工单。`finish` 应形成“更新”预览而不是“新建”，确认时应复用任务与来源关联并增加任务和来源版本；变更历史 GET 应回读 title/body 两条记录及更新前后值。合成 JDBC 的前后快照必须按运行 ID 区分，拒绝把当前快照作为旧快照。伪代码：`confirm run1 -> retain old snapshot/version -> create run2(revision 2) -> stage changed item -> finish -> preview updated -> confirm -> assert task updated once -> GET changes == title/body`。仍只执行本机 HTTP 和内存 JDBC，不访问业务库。

第三次公开运行暂存合法空页（上游当前无工单）并与第二次快照比较。`removed` 预览应显示原编号，确认时把本来源标记为不再提供该任务；若没有其他有效来源，任务保持原记录但关注状态降为 SECONDARY，主来源清空。来源版本增加且 `removedCount=1`；不应创建或改写任务正文。伪代码：`create run3(revision 3) -> stage empty -> finish removed=1 -> preview removed -> confirm -> assert source absent, attention secondary, task payload unchanged`。

当前 15 文件完整 JaCoCo 报告中 `PingcodeTaskRepository.java` 缺 326/584 行，确认入库主路径从 `taskStorageReady` 后尚未触达。扩展现有本机隔离 HTTP/JDBC 状态机：先保留 `VERIFIED` 迁移状态的 409 拒绝，再将合成状态设为 `ACTIVE`；通过真实 `/v1/pingcode-task-sync/runs/{id}/confirm` 请求核对默认负责人配置、任务修订摘要、来源关联、主来源选择、文档任务写入与索引替换、来源版本和运行状态，随后同摘要重复确认应幂等返回。所有 JDBC 写入只作用于夹具内存状态，不连接业务库。伪代码：`stage -> finish -> confirm(VERIFIED)=409 -> fixture ACTIVE -> confirm=200 -> assert task/source/run persisted -> confirm same digest=200 -> assert no extra writes`。完整固定 15 文件 JaCoCo 复采核对源文件与输入稳定，再记录净增。

确认成功后继续经公开 GET 入口读取任务来源快照、变更历史和运行失败资源列表。快照返回真实夹具中确认过的来源 ID、工单标题与正文；本次首确认的变更历史和失败资源应为空，非法分页明确拒绝。伪代码：`confirm -> GET task/source -> assert confirmed projection -> GET changes/resources -> assert empty totals -> GET invalid pages -> assert error codes`。这些读取不得产生新的任务或来源写入。

资源恢复场景沿同一公开运行走完整状态：暂存包含一张 `FAILED` 图片的工单，确认后运行状态为 `CONFIRMED_MISSING_IMAGES`；失败资源分页列出原始版本和来源 URL，使用正确 `expectedVersion` 与 `sourceUrl` 经 `/resources/retry` 写入 READY 新版本，资源列表清空，快照资源状态与运行状态转为 COMPLETE/CONFIRMED。拒绝无效资源参数与旧版本重试；断言失败请求不新增版本。伪代码：`stage failed image -> confirm missing -> list failed -> invalid retry -> retry READY -> read confirmed and empty failures`。仍使用合成 JDBC，所有业务动作真实调用本机 HTTP。

验收：定向本机 HTTP 场景通过，成功确认与重复确认、来源快照、变更历史空列表、失败图片分页和 READY 重试均走公开 API；失败重试不增加资源版本。完整 `runtime/coverage-goal/java-pingcode-resource-retry-verified-20261113/` 退出 0，15 产品文件及输入哈希稳定，行 4648/4867（95.50%）、分支 2779/3609（77.00%）。相对 `java-task-migration-boundaries-20261113` 同分母净增 241 行、110 分支；PingCode 仓储 476/584 行，仍缺 108 行。Java 全量尚缺 219 行，达到 95% 分支至少缺 650 项；Node、前端也未完成最终目标。

## 2026-11-13 Java 逐任务迁移公开命令覆盖

最新 Java 完整 15 文件 JaCoCo 报告中 `DocumentTaskMigration.java` 为 0/139 行。使用仓库已有的 Java 启动命令夹具模式，在独立 JVM 注册只接受 `jdbc:fixture:business` 的合成 JDBC 驱动，并为 Schema 校验提供本次 `runtime` 目录内的单个版本 SQL。分别真实调用 `Main.main("migrate-tasks")` 和 `Main.main("activate-tasks")`，环境显式设 `YASDB_STORAGE_TARGET_CLASS=personal`，仅指向合成 JDBC；备份路径必须位于本次 `runtime` 输出目录。迁移场景从合成旧聚合校验哈希、写 0600 备份、逐任务复制并核对，状态为 VERIFIED；激活场景从已核验的合成行与备份重新核对并转 ACTIVE。关机钩子验证提交次数、状态、备份与任务正文；任何测试错误不得记作成功。伪代码：`register fixture driver -> set runtime SQL/backup -> Main.main(public command) -> assert JDBC writes and backup hash -> JaCoCo all-source merge`。不连接同步业务 Schema 的 `test_hy`，不改产品迁移规则和 15 文件分母。

完整采集后该模块 127/139 行；剩余均为拒绝分支。扩展同一公开命令夹具，以互不共享的 `runtime` 输出目录分别验证：迁移备份已存在、旧聚合版本无效、重复编号、回读正文不一致；激活备份摘要不匹配、迁移状态未核验、旧聚合修订变化、目标任务正文不一致和目标缺行。每个失败场景须断言明确错误码、零提交、无 ACTIVE 状态；正常 copy/activate 场景继续保留。伪代码：`prepare isolated JDBC mutation -> Main.main(public command) -> catch exact failure -> assert commits=0 and state unchanged`。逐场景 JaCoCo append，再以完整 15 文件报告验收净增。

继续覆盖激活命令的备份边界：缺失 `KNOWLEDGE_CENTER_REPO_ROOT` 时拒绝继续，位于本次 `runtime` 内但通过符号链接指向真实备份的路径返回 `DOCUMENT_TASK_BACKUP_INVALID`。夹具不得改写工作区已有文件；两种拒绝均须零提交、状态保持 VERIFIED，且参与同一 15 文件采集。

验收：14 个迁移命令场景均通过公开 `Main.main` 入口、合成 JDBC 与独立 `runtime` 备份目录执行。完整 `runtime/coverage-goal/java-task-migration-boundaries-20261113/` 退出 0，15 文件输入哈希稳定；行 4407/4867（90.55%）、分支 2669/3609（73.95%），较上一稳定报告净增 12 行、12 分支。迁移模块为 137/139 行；剩余两行是备份父目录符号链接越界拒绝（113）和备份写入后摘要不符（121）。Java 全量仍缺 460 行、达到 95% 分支至少缺 760 项；Node 与前端也未完成最终门槛。

## 2026-11-13 Java PingCode 分页暂存与预览 HTTP 覆盖

固定 15 文件 Java 报告 `java-pingcode-lifecycle-20261113` 中 PingCode 仓储仍缺 490/584 行，来源与运行创建已经通过隔离真实 HTTP 夹具执行。继续在同一合成 JDBC 状态中持久化工单快照、页数/行数和运行摘要，经公开 `/pages`、`/finish`、`/preview` 入口验证页号/计数拒绝、合法暂存、摘要拒绝、完成后创建预览以及非法预览分页。拒绝请求不得增加已读页数或快照数；预览标题、编号、动作和总数必须来自已暂存的 JDBC 行。伪代码：`create run -> invalid page -> stage one ticket -> invalid digest -> finish -> preview current -> invalid page -> assert persisted run/snapshot state`。定向通过后进入固定 JaCoCo，保持 15 产品文件分母与输入稳定。

完成预览后继续调用真实 `/confirm`：错误摘要必须返回 `PREVIEW_STALE`，正确摘要但合成任务迁移状态为 `VERIFIED` 时必须返回 `PINGCODE_TASK_MIGRATION_REQUIRED`；两次拒绝不得改变运行 `AWAITING_CONFIRM` 状态或来源版本。并验证 `removed` 空预览及非法 view；这些边界不假装已完成成功确认的数据写入。

验收：定向真实 HTTP 夹具通过；完整 `runtime/coverage-goal/java-pingcode-confirm-boundary-20261113/` 退出 0，15 产品源码与输入哈希稳定。行 4248/4867（87.28%）、分支 2585/3609（71.63%），较上一稳定 Java 报告净增 188 行、120 分支；PingCode 仓储 247/584 行的阶段性结果已在 `java-pingcode-stage-20261113` 逐文件报告核对。Java 仍缺 619 行，达到 95% 分支至少还需覆盖 844 项；成功确认和逐任务迁移尚未由本轮夹具执行。

## 2026-11-12 Java 隔离存储 API 的 JaCoCo 采集设计

当前 Java 15 文件完整采集对 PingCode 仓储仅覆盖 22/584 行，文档任务读写与迁移也基本未运行；现有 `pingcode-task-storage-real.node.cjs` 使用 `KC_TEST_STORAGE_URL` 与 `KC_TEST_ISOLATED_SCHEMA=1` 调用真实存储 HTTP API，但采集器未启动该场景。复用统一测试入口的 `test_hy` 独占锁、同步、迁移、独立四服务实例和进程所有权清理。JaCoCo 只附加到该实例的 Java 启动，避免全局 `JAVA_TOOL_OPTIONS` 污染 Java 版本探测。测试启动器对 `-version` 透明转发，对其余 Java 命令附加本次运行的 JaCoCo agent 与 exec 文件；Node E2E 从隔离实例获取 URL，断言来源同步、版本冲突、缺图重试和真实数据库回读。伪代码：`acquire isolated lease -> start storage via coverage launcher -> run node --test against isolated storage URL -> stop owned lease -> merge JaCoCo exec -> verify source manifest and full 15-source XML`。若迁移、默认责任人或测试本身失败，采集应失败并保留诊断，不把被跳过的 E2E 计为覆盖结果。

实测隔离实例启动成功，但 `test_hy` 现为同步副本，`/v1/document-tasks/config` 返回 409 `DOCUMENT_TASK_MIGRATION_REQUIRED`；数据迁移命令仅允许显式个人开发库，不能将同步副本误标为个人库。该路径暂不纳入固定采集。改用既有 Java 真实 HTTP handler + 隔离 JDBC 状态机模式，构造只含合成任务和配置的事务响应，验证 `status/config/list/mine/by-review/find` 的可观测 API 契约、失败码和查询边界；全部 HTTP 请求真实到本机服务，无业务数据库写入。伪代码：`register fixture JDBC -> construct production Main -> expose actual documentTasks handler -> GET read variants -> assert data/status/SQL binds -> JaCoCo all-source merge`。

读取夹具进入完整采集后 `DocumentTaskReadRepository` 达 124/147 行，而 `DocumentTaskWriteRepository` 仍仅 2/109 行。扩展同一真实 HTTP 夹具的隔离 JDBC 状态：配置 PUT 保存和回读、幂等回放及冲突；任务 PUT 更新、回读、重放及版本冲突。断言提交次数、最终载荷和版本，失败操作不得改变状态。伪代码：`GET current -> PUT config/task with key+hash+expectedVersion -> GET saved -> replay same key -> stale version conflict -> assert no extra mutation`；固定 15 文件 JaCoCo 分母不变。

验收：定向真实 HTTP 夹具通过；完整 `runtime/coverage-goal/java-document-write-20261112/` 采集退出 0，15 产品源码和输入哈希稳定。行 3920/4867（80.54%）、分支 2357/3609（65.31%）；相对五个既有夹具纳入后的报告净增 293 行、181 分支。其中读取仓储 124/147 行、写入仓储 95/109 行。仍缺 947 行，分支达到 95% 至少还缺 1072 项；PingCode 仓储 22/584 行、逐任务迁移 0/139 行是主要剩余缺口。同步业务 Schema 的 `test_hy` 不执行个人库限定的数据迁移命令。

PingCode 仓储下一批覆盖以真实本机 HTTP handler 和合成 JDBC 状态验证来源及运行生命周期：合法来源创建、列表/详情回读、重复来源冲突、URL 拒绝、版本过期、运行创建/列表/取消/失败和不存在对象。失败请求不得改变来源/运行数或提交；响应中的 ID 与 revision 必须来自实际写入的 JDBC 状态。伪代码：`POST source -> JDBC insert -> GET source/list -> duplicate/invalid -> POST run wrong/correct revision -> GET runs -> POST cancel/fail -> GET final state`。定向通过后加入固定 JaCoCo，保留 15 文件分母。

验收：定向 PingCode 真实 HTTP 夹具通过；完整 `runtime/coverage-goal/java-pingcode-http-20261112/` 退出 0，15 源码及输入稳定。行 4058/4867（83.38%）、分支 2463/3609（68.25%），较上一完整报告净增 138 行、106 分支；PingCode 仓储由 22/584 升至 94/584 行。Java 仍缺 809 行；要达到 95% 分支至少还需覆盖 966 项。主要剩余缺口为 PingCode 仓储 490 行、逐任务迁移 139 行和 Main 127 行，且 Node、前端仍需各自完整达标。

追加失败运行记录后，重新执行完整 `runtime/coverage-goal/java-pingcode-lifecycle-20261113/`：15 产品源码、输入稳定，行 4060/4867（83.42%）、分支 2465/3609（68.30%），较上次各增 2。仍缺 807 行，分支到 95% 至少还缺 964 项；此报告为当前 Java 有效基线。

## 2026-11-12 Java 既有领域契约纳入完整采集

当前 15 个 Java 产品源码完整 JaCoCo 报告为 3515/4867 行、2099/3609 分支。`TaskNumberCheck`、`DocumentTaskStatusCheck`、`DocumentTaskHistoricalReviewCheck`、`PingcodeTaskPayloadCheck`、`PingcodeTaskSourceUrlCheck` 已实现任务编号拒绝、任务状态、历史审核索引写入、来源字段合并及 PingCode URL 校验断言，但尚未列入固定 Java 采集清单，导致真实执行证据未进入完整分母。将五个夹具加入编译、执行、输入哈希和结果清单；保留全部 15 个产品源码及原有 JaCoCo 门槛，不改变产品规则。伪代码：`checks += five existing fixtures; compile all; run each with JaCoCo append; verify fixture exit and source hashes; generate all-source XML; compare before/after counts`。验收要求完整采集退出 0、15 文件源清单齐全且输入稳定，并核对同分母的行、分支净增。

验收：`runtime/coverage-goal/java-domain-existing-20261112/` 完整采集退出 0，15 个产品源码、`source-stability.json` 的 `stable=true`、`changedFiles=[]`。同分母行由 3515/4867 升至 3627/4867（74.52%），分支由 2099/3609 升至 2176/3609（60.29%），净增 112 行、77 分支。仍缺 1240 行；要达到 95% 分支至少还需覆盖 1253 个分支。此结果只证明 Java 增量，不代替 Node、前端或全平台门禁。

## 2026-11-12 PingCode 来源失败与恢复覆盖

稳定前端报告中插件模块仍缺 41 行，其中来源 GET 故障、来源 POST 故障以及详情内操作错误路径尚未进入固定采集。扩展现有隔离本机 HTTP 场景，首轮来源读取返回 503 后点击重试；首次登记返回 503 并验证原输入和提交能力保留，再重试成功；连接检查首次 503 显示错误，再次请求成功。每次拒绝须核对没有创建来源或同步运行，所有后续成功仍沿用真实浏览器按钮、网络请求和现有载荷断言。伪代码：`GET 503 -> retry GET 200; POST source 503 -> form retained -> POST 201; POST test 503 -> error -> POST 200; continue lifecycle`。验收为定向浏览器场景与完整 59 文件稳定采集通过，并核对同分母净增行/分支。

验收：定向真实浏览器场景 8 个阶段通过；完整 `runtime/coverage-goal/frontend-pingcode-errors-20261112-2340/` 退出 0，59 产品脚本、1286 输入前后哈希稳定，`completed/stable/inputsStable=true` 且变更清单为空。插件模块由 143/184 行、211/314 分支增至 149/184 行、218/314 分支；前端全量由 9902/10957 行、11436/15320 分支增至 9908/10957 行（90.42%）、11444/15320 分支（74.69%）。全量分支净增 8，插件模块净增 7。仍缺 1049 行，达到 95% 分支至少需再覆盖 3110 项；后续重点为插件同步取消、历史运行和预览翻页，以及 `app.js` 的较大缺口。

## 2026-11-12 全局通知公开交互纳入前端覆盖

当前前端稳定报告中 `app.js` 的全局通知读取、已读和错误恢复路径未被固定浏览器场景触发。通过已登录真实页面的通知按钮与本机隔离 HTTP 响应，验证未读通知及提及人展示、标记已读 PUT、空列表、服务失败、重试和关闭；不直接调用内部私有函数。伪代码：`open -> GET unread -> mark read -> GET empty -> close/open -> GET 503 -> retry -> close -> capture`。验收要求完整前端采集退出 0、59 文件分母与输入稳定，并核对 `app.js` 及全量原始计数。

完整报告 `runtime/coverage-goal/frontend-notifications-current-20261112-2325/` 退出 0，59 个产品脚本，`completed/stable/inputsStable=true` 且变更清单为空。`app.js` 从 3809/4618 行、2895/4474 分支增至 3844/4618 行、2934/4474 分支；前端全量从 9867/10957 行、11394/15320 分支增至 9902/10957 行（90.37%）、11436/15320 分支（74.64%）。仍缺 1055 行，达到 95% 分支至少还需覆盖 3118 项。全量分支净增 42，其中 `app.js` 净增 39；不把其余增量强行归因到通知场景。目标仍未达成。

## 2026-11-12 PingCode 插件纳入前端完整覆盖

当前稳定前端 59 文件完整分母中 `modules/platform-admin/pingcode-sync.js` 为 0/184 行、0/314 分支，原因是固定采集器未进入平台“插件”页签。已有独立真实 Chromium 测试覆盖插件生命周期，但其页面未接入固定 Istanbul 采集。新增采集器专用的本机隔离 HTTP 场景：真实管理页点击插件页签，登记来源并回读；测试连接；发起预览并轮询待确认；在冲突分类选择主来源，确认后回读缺图并重试。断言请求方法、幂等键、修订号与决策载荷；所有响应由隔离 HTTP 服务提供，不访问真实企业 PingCode，也不写共享任务库。页面关闭后合并该页产品源码计数，要求场景数和输入哈希稳定。伪代码：`route API -> open plugins -> create source -> test -> start -> poll -> preview -> choose primary -> confirm -> retry -> assert requests -> captureCoverage`。先定向跑新场景，再完整复采 59 文件并用稳定报告确认真实增益；目标仍是各端完整分母行 100%、分支 95%。

验收：新真实浏览器与本机 HTTP 场景定向返回 5 个阶段；完整采集 `runtime/coverage-goal/frontend-pingcode-current-20261112-2300/` 退出 0，59 产品源码、1286 输入在前后哈希一致，`completed/stable/inputsStable=true`、变更清单为空，原有审核 19 个快照齐全。插件模块增至 143/184 行、211/314 分支；全量前端从 9723/10957 行、11178/15320 分支增至 9867/10957 行（90.05%）、11394/15320 分支（74.37%），相同分母净增 144 行、216 分支。还缺 1090 行，达到 95% 分支至少还需 3160 项；该局部进展不构成平台达标。

## 2026-11-12 前端完整覆盖采集阻断修正

完整 Istanbul 采集的 GitLab 连接 HTTP 夹具在编辑、验证、启停后保留详情抽屉，再点击抽屉背后的新增按钮，浏览器正确阻止点击。夹具应点击真实“关闭详情”并等抽屉卸载后新增；不改变产品交互。审核工作台插桩套件的旧断言仍寻找“查看 GitLab MR”，现行入口是“MR链接”；候选就绪但没有服务端 `canSubmitReview` 时不应显示“提交文档审核”，应显示“进入审核工作区”。导航综合场景收缩侧栏后指针无法再次点击外移的按钮，改由已聚焦按钮的 Enter 键展开并保持原 60 秒预算。伪代码：`closeDrawer -> add; expect(MR链接); candidateReadyWithoutCapability -> expect(no submit, entry visible); run directed review suite -> run full frontend collector -> verify stable manifest and counts`。

首轮完整复采审核套件 19/19 通过，但采集器旧快照数量门禁仍为 17，合并阶段拒绝；同步更新为 19，仍逐文件检查非空和产品源码白名单。该轮 `completed=false`，不能作为覆盖率基线。

最终完整复采 `runtime/coverage-goal/frontend-current-verified-20261112-2248/` 退出 0，`source-stability.json` 为 `completed/stable/inputsStable=true`、`changedFiles=[]`、`changedInputs=[]`；59 个产品源码及 1285 个采集输入保持稳定。审核工作台 19/19、GitLab 连接 14 个场景等计数齐全。前端行 9723/10957（88.73%），分支 11178/15320（72.96%）；仍缺 1234 行，达到 95% 分支至少还需覆盖 3376 项。最大行缺口为 `app.js` 808、`pingcode-sync.js` 184（当前 0 覆盖）、文档任务视图 63、写作页 57。该报告只建立当前前端有效基线，平台三端目标仍未达成。

## 2026-11-12 专业报告全局检索分页

参考已保存的 REA Allure 运行态证据、Playwright HTML Reporter 官方说明、ReportPortal 与 pytest-html 官方仓库资料（`runtime/rea/professional-test-report/`）。沿用现有总览、失败定位、场景静态分页和离线资产；当前全局检索只渲染前 100 条匹配结果，超过该数的用例无法从检索结果访问。改为每页 50 条的客户端分页，显示匹配总数、当前范围和页码；搜索词或状态变化后回到第一页，上一页/下一页到边界禁用。结果链接仍进入对应场景静态页并展开失败详情。无 JavaScript 时仍可通过场景静态分页浏览。

伪代码：`matched = filter(index, query, status); pages = max(1, ceil(matched.length / 50)); page = clamp(page, 1, pages); render(matched.slice((page-1)*50, page*50)); update navigation and live summary`。验收：构造超过 100 条记录的离线报告，搜索分页能到达末条；筛选重置页码，空结果和边界按钮准确；统一入口回归通过，桌面/390px 离线浏览器检查无脚本错误、外部请求或横向溢出，首屏仍在 100ms 内。评分按既有七项内部量表记录实际证据，不把主观分数当成覆盖率验收。

验收：统一入口单元测试 44/44、实际 `smoke` 运行 24/24 通过并生成 `report.html`。125 条数据的离线报告在 1440px 和 390px 均能从第 1 页走到第 3 页的第 125 条，失败筛选回到第 1 页并显示 5 条；错误详情深链可展开，浏览器无脚本错误、外部请求和横向溢出。各视口 5 次 DOMContentLoaded 采样最高分别为 18.2ms、71.3ms；样本限于 125 条，不能据此推断更大报告的性能。截图和生成报告见 `runtime/test-results/report-pagination-review-20261112/`。内部评分沿用已有 9.5/10：数据可信 2/2、失败定位 2/2、检索导航 2/2、视觉层级 1.5/1.5、无障碍与移动端 1/1、离线与性能 0.5/1、可追溯 0.5/0.5；大型报告性能仍待独立验收。

## 2026-11-12 DSH 试运行模型配置拒绝路径覆盖

最近稳定 Node 完整采集中的 DSH 适配器仍缺模型必填项和模型地址校验两条抛错行。沿用隔离模型服务和真实平台 HTTP 试运行入口，先把模型解析结果切换为缺少 `api_key` 的配置，断言返回 422 `DSH_MODEL_UNAVAILABLE`；再切换为带查询参数的模型地址，断言同一状态和明确的地址错误；恢复合法配置后继续完成、SSE 与取消流程。两次拒绝都不得创建新运行记录或向模型服务发请求。伪代码：`setConfig(invalid) -> POST run-test -> assert 422 and no model request; restore(valid) -> existing lifecycle`。定向原生 E2E 和 Jest 覆盖桥接均需通过，随后以完整稳定 Node 采集确认真实增益；局部计数不代替平台行 100% / 分支 95% 验收。

验收：原生真实 HTTP/SDK E2E 1/1，Jest 桥接 96 通过、5 条条件跳过；相同 DSH 分母由 161/168 行、81/112 分支提升到 163/168 行、83/112 分支。首次 4 worker 全量因 5 秒/30 秒超时及 DSH 等待超时，6 套失败；输入虽稳定但该次不作正式基线。串行复采 `runtime/coverage-goal/node-dsh-model-validation-serial-20261112/` 的固定 202 文件全部完成，201 套通过、1 套跳过，2976 用例通过、8 条跳过，910 个输入前后哈希一致；Node 总量 17122/17439 行（98.18%）、17785/20300 分支（87.61%），同分母各增加 2 项。仍缺 317 行，分支达到 95% 至少需再覆盖 1500 项；前端和 Java 当前完整稳定采集仍未完成。

## 2026-11-12 DSH 遗留运行与代理拒绝路径

继续使用真实平台 HTTP/SDK E2E：在隔离运行目录中写入一条有效 UUID 的遗留 `running` 记录，经管理员 GET 运行接口读取，断言状态被持久化为 `interrupted`；在第二次试运行的上游模型请求保持等待期间，通过本机 Unix socket 向模型代理发送 GET，断言 403 且未转发到模型服务。合成记录在测试清理阶段删除。伪代码：`write stale run -> GET /agent-runs/:id -> interrupted; start held run -> GET proxy socket -> 403 -> cancel`。定向原生与 Jest 桥接通过后，以固定 202 文件完整稳定采集确认产品分母与新增覆盖；原有 100% 行、95% 分支门槛保持不变。

验收：原生真实 HTTP/SDK E2E 1/1 通过，定向 Jest DSH 场景 1/1 通过；固定 202 文件串行完整采集 `runtime/coverage-goal/node-dsh-recovery-proxy-serial-20261112/` 退出 0，201 套通过、1 套跳过，2976 项通过、8 条跳过，910 个输入前后哈希一致。DSH 适配器由上一稳定报告 163/168 行、83/112 分支提升到 166/168 行、85/112 分支；Node 全量由 17122/17439 行、17785/20300 分支提升到 17125/17439 行（98.19%）、17787/20300 分支（87.62%）。Node 尚缺 314 行，分支达到 95% 至少还需 1498 项；前端和 Java 当前完整稳定复采仍缺。

## 2026-11-12 DSH 真实 HTTP 契约纳入 Node 产品覆盖

当前稳定 Node 完整报告中 `agent-runtime/dsh-adapter.js` 缺 110 行，主因是现有真实 HTTP/SDK E2E `dsh-sdk-runtime.test.cjs` 不在 Jest 发现清单。该测试通过隔离模型端点、真实平台 API、用户级 systemd 和 user namespace 验证试运行完成、SSE、取消及凭据隔离。先明确环境前提；E2E 夹具等待预算覆盖 SDK 冷启动，不能修改产品 100ms 页面门槛。通过现有 `native-contract-coverage.test.js` 的 `node:test` 桥接复用同一契约，桥接支持该测试的 `t.after` 清理、可调用的 `assert(condition)` 及显式超时。验收为原生 E2E、Jest 桥接定向采集通过，并核对适配器分子分母；随后完整 Node 清单必须保持全部通过和输入稳定，方可计入平台覆盖率。

验收：原生 E2E 1/1 通过，桥接 96 项通过、5 条条件跳过；`runtime/coverage-goal/node-dsh-http-20261112-2113/` 中固定 202 Jest 文件全部完成且输入稳定，DSH 适配器增至 161/168 行、81/112 分支；同分母 Node 全量净增 104 行和 57 分支。全平台目标仍需 Node、前端、Java 三端各自达标并保持稳定。

## DSH 测试运行环境前置条件

DSH 真实 HTTP/SDK E2E 需要可用的 `systemd --user` 会话和 user namespace。测试启动前调用 `systemctl --user show-environment` 检查会话；当前环境不具备该条件时，原生 Node 测试明确标记为跳过，Jest 覆盖桥接也注册为跳过，不伪报沙箱验证通过。具备运行条件的 CI/主机仍须执行完整 E2E；覆盖率报告应将被跳过的 DSH 套件标记为未执行，不能把跳过折算为覆盖证据。

Jest 不直接发现以 `node:test` 注册用例的原生套件；由独立 Node 运行器执行的文件必须从 Jest `testMatch` 排除，只有通过 `native-contract-coverage.test.js` 明确桥接的套件才进入 Jest。验收时同时检查 Jest 与原生 Node 测试清单，避免空测试套件被计为通过。

## 2026-11-12 GitLab 验证结果原子写失败补测

当前稳定 Node 全量报告中 `gitlab-verification-store.js` 的临时文件清理行未执行。扩展既有数据库配置模式真实 HTTP 套件，在一次已成功保存和回读后，仅对验证结果临时文件的 `renameSync` 注入一次失败。公开验证 API 应返回存储不可用 503；原始结果文件不得被覆盖，临时文件必须清理；列表仍能读到上次成功验证。最后恢复文件操作并再次验证成功，确认故障不污染后续请求。该定向结果只证明目标路径，不代替三端完整稳定覆盖率验收。

定向报告显示清理行已执行，剩余三个分支为旧版 `baseUrl/projectPath` 字段别名和环境未配置时的默认存储路径。补公开 `createGitLabVerificationStore` 契约：以旧字段保存、回读，随后改连接目标验证指纹失效；默认路径只注入 ENOENT 读取，不触碰共享运行文件。再次定向采集并核对真实分母。

## 2026-11-12 专业报告失败分诊改进

参考既有 REA 证据 `runtime/rea/professional-test-report/` 中 Allure 运行概览、Playwright 状态定位、ReportPortal 质量总览和 pytest-html 离线日志能力。当前报告已覆盖总览、场景静态分页、跨页检索、原始日志和覆盖率门禁。本轮聚焦失败时的首屏分诊：在“失败与阻塞”标题显示失败/异常用例数与异常任务数；逐条失败展示经转义的短错误摘要和深链接；列表截断时明确剩余数量，并提供完整筛选入口。异常任务保留独立计数，避免将任务当成用例。场景汇总把超时、中断计入失败/异常，不能漏报。

伪代码：收集 FAIL/TIMEOUT/INTERRUPTED 用例和非 PASS/DRY-RUN 任务；标题分别显示数量；最多展示前 8 条失败用例及其错误首个非空行，再显示剩余条数入口；任务另列，保留日志链接；按场景汇总异常状态。验收：注入失败、超时、中断及多条失败的报告载荷，检查总数、摘要转义、截断入口和场景计数；重跑统一入口测试，并用实际 smoke 报告验证离线桌面/窄屏展示。内部评分沿用现有量表，只在新证据支持时更新，不把报告评分写成覆盖率目标达成。

窄屏验收发现八列场景表将场景名称挤为竖排。场景表固定最小宽度 820px，由带中文可访问名称、可键盘聚焦的容器横向滚动；页面本身不产生横向溢出。

## 2026-11-11 Java 归档规则 HTTP 覆盖续作

当前稳定完整采集 `runtime/coverage-goal/java-current-audit-20261111`：9 个产品文件，3476/3519 行、2069/2362 分支，source-stability=true。新增归档/恢复实现尚缺公开请求覆盖。扩展 `StorageGitLabHttpCheck` 的真实本地 HTTP 生命周期，验证不存在404、缺版本428、无幂等键400、过期版本409、草案/启用状态冲突409、条件更新失败409且不提交/不写审计，以及停用→归档→恢复后的状态、版本、列表分区和审计 actor。扩展共享 JDBC 状态机准确解释归档条件更新的绑定顺序及列表 SQL 的 ARCHIVED/DELETED 筛选；不修改产品源码、不连接共享库。伪代码：创建草案→非法归档矩阵→启用拒绝→停用→故障注入拒绝→归档→列表分区/编辑拒绝→恢复→列表与审计核对。验收为真实HTTP断言、完整9源码JaCoCo复采、输入SHA稳定；保留100%行/95%分支原目标，局部提升不代替全平台验收。

验收：`runtime/coverage-goal/java-archive-http-20261111/` 的完整 9 源码采集退出 0，`source-stability.json` 为 stable=true、changedFiles=[]；行 3493/3519（99.26%），分支 2090/2362（88.48%）。相同分母比补测前增加 17 行、21 分支。剩余 26 条完全未覆盖行均在 `Main.java`，平台三端目标仍未达成。

## 业界参考与本轮复验（2026-11-11）

采用仓库 REA `app-capability-transfer` 与 `reverse-engineer-anything` Skill 完成能力迁移和运行态验收。参考 Allure 的聚合结果与失败诊断、Playwright HTML Reporter 的过滤和定位、ReportPortal 的运行总览、pytest-html 的可分享离线报告。官方来源、抓取哈希与受限页面记录见 `runtime/rea/professional-test-report/sources.json`、`official-repositories.json`；官网返回 403 的来源只记录限制，不声称已验证其页面内容。

本轮使用 `python3 tests/run_tests.py smoke --report-page-size 2` 生成真实 HTML：报告 `runtime/test-results/smoke/20261111-033805-272636-smoke/report.html`，2 个任务、24 个已识别用例全部通过。统一入口回归 43/43 通过。REA Chromium 验收对新报告在 1440px 和 390px 各运行 10 次，P95 DOMContentLoaded 分别约 32ms、66ms；无横向溢出、脚本错误和外部请求。搜索返回 3 条并可深链到用例；禁用 JavaScript 时仍可从总览进入分页明细。原始验证结果、脚本和截图见 `runtime/rea/professional-test-report/`。

内部评分维持 9.5/10（数据可信 2/2、失败定位 2/2、检索导航 2/2、视觉层级 1.5/1.5、无障碍/移动端 1/1、离线/性能 0.5/1、可追溯 0.5/0.5）。这是针对当前报告实现和上述 smoke 样本的内部量表，不是第三方认证，也不证明大规模报告性能。覆盖率是否达标以独立覆盖率数据和门禁为准；本轮 smoke 未开启覆盖率采集。

2026-11-11T03:42:00+08:00 前端 provenance 空值分支补测设计：最近固定 Istanbul 快照中 `production-provenance.js` 行覆盖完整，33 个分支中仅剩 `metadata.provenance || []` 的空值回退。扩展固定 Chromium `exerciseProductionProvenance(page)`，传入其他元信息有效但 `provenance: null` 的公开输入，断言结果含空的 `<ol>`、保留任务标识且没有伪造来源项；与既有 `evidence: null` 场景分开，确保命中的是 provenance 集合本身的 fallback。只调用真实导入的渲染函数，不发业务 API 请求。验收保持固定 57 个产品源码文件、原场景计数及 source-stability 检查，完整固定前端采集后确认目标分支计数，不能以定向覆盖替代全量稳定证据。

2026-11-11T03:53:34+08:00 前端 provenance 空值固定复采结果：执行 `KC_FRONTEND_ISTANBUL_OUTPUT=runtime/coverage-goal/frontend-provenance-null-followup node tools/repository/collect-frontend-istanbul-coverage.cjs`。57 个源码文件和既有场景均完整：导航45、API契约22、审核选择6、草稿输入8、团队HTTP10、写作31、任务页16、我的工作8、手册往返5、平台6、审核16。快照 `completed=true`、`stable=true`，`changedFiles=[]`、`changedInputs=[]`。前端总行8727/10374=84.12%，分支10070/14196=70.93%；`production-provenance.js` 分支33/33，目标空值 fallback 已命中。产品覆盖率目标仍未达成，需继续补齐前端总缺口并重新验收 Node、Java 与前端三端。

2026-11-11T04:05:00+08:00 手册写作 GitLab 成功来源补测设计：在固定 Chromium `exerciseHandbookWritingEntry(page)` 中，为当前手册文档配置有效映射（`main` 分支、`docs` 根目录）、`canRead=true`、包含该文档 Markdown 的真实目录项及匹配路径/commit/blob 元数据的文件响应；同时为写作入口提供对应大纲文档。通过真实工作台生成按钮和写作页“生成候选”触发 `prepareOrigin`，断言映射、权限、分支、树和文件 API 均被调用，来源摘要计算成功，且成功来源检查后页面进入任务提交阶段并保留原文基线。AI jobs POST 在夹具中确定性拒绝并计入断言，避免产生业务写入。所有 fetch、应用状态和路由在 `finally` 恢复。验收为定向固定 Chromium 场景通过，并重跑完整固定 Istanbul 采集，确认57文件分母和其他场景计数不变、source-stability稳定；仅以全量复采评估覆盖率变化，不以该场景局部数字作平台验收。

## 专业报告改进验收（2026-11-10）

参考 Allure Report 的结果聚合与失败定位、Playwright HTML Report 的状态筛选与用例详情、ReportPortal 的质量总览、pytest-html 的离线报告和日志详情。使用仓库 REA Skill 的能力迁移流程形成“参考能力—证据—平台适配—验收”记录；参考源码和受控浏览器观测保存在 `runtime/rea/professional-test-report/`。

本次报告改为离线数据产品布局：深色场景导航、运行结论和结果分布、失败/阻塞优先、场景汇总、覆盖率分子分母与目标缺口、任务耗时排序。静态分页仍保留；本地索引支持全场景关键词搜索、状态筛选、失败深链接和详情自动展开。所有 HTML 文本转义，日志路径限制在 `details/tasks/`，无 JavaScript 时仍可浏览全部静态页面。

评分（10 分制）：数据可信 2.0、失败定位 2.0、检索导航 2.0、视觉层级 1.5、无障碍/移动端 1.0、离线/性能 1.0、可追溯 0.5；本轮证据评分 9.5 分。证据包括 `tests/unit/root/test_run_tests.py` 43 项通过、真实 smoke HTML、390px Chromium 无溢出/无脚本错误/搜索命中、REA 受控观测 `runtime/rea/professional-test-report/allure-runtime-evidence.json`。评分不代表第三方认证；报告不虚构未提供的趋势、重试、环境或附件。

2026-11-10T09:48:56+08:00 前端导航状态补测设计：固定 Istanbul 报告中 `common/state/navigation.js` 仍有 3 行未覆盖，集中在平台页签查询参数解析，另有未知视图、非法页签和仓库详情尾斜杠分支。沿现有已认证 Chromium 页面动态导入真实模块，调用公开的 `pathForView`、`viewFromPath` 和 `platformTabFromSearch`，断言有效与非法页签、空查询、未知路由、仓库和手册路径的结果。场景只读页面内模块，不发送业务写请求；仍以固定 57 个产品脚本清单和完整采集结果验收。伪代码：`import(navigation); evaluate(paths,tabs); assert(publicResults); mergeFixedCoverage()`。

2026-11-10T09:48:56+08:00 审核选区内联批注补测设计与复盘：真实已认证页面挂载候选正文及审核表单，创建 `Range` 并触发正文 `mouseup`，在同一 DOM 事件中确认选区气泡已显示，检查文档 ID、节点、路径和选中文本；点击添加批注后用隔离同源 HTTP 500 验证提交负载、错误反馈、按钮恢复和取消清理。首次尝试在事件之后才读取气泡，页面滚动监听已将其隐藏；夹具改为同步确认事件结果。完整报告为 `runtime/test-results/frontend-review-inline-20261110b/coverage-summary.json`：57 文件行 7711/9986（77.21%）、分支 9062/13744（65.93%），`app.js` 行 2277/4318、分支 1782/4135。相对上一固定大纲导入报告净增 77 行、55 分支；Node 与 Java 未在此阶段重采，三端目标未达成。

2026-11-10T10:00:04+08:00 导航状态矩阵复采结果：固定报告确认 `common/state/navigation.js` 行 18/18、分支 21/22（95.45%）；最后未命中分支为根路径 `/` 的规范化长度条件。本次完整前端报告 `runtime/test-results/frontend-navigation-state-20261110/coverage-summary.json` 总行 7711/9986、分支 9055/13744；计数有既有页面时序波动，不作为整体增量证据。

2026-11-10T07:47:52+08:00 手册写作来源检查与并发编辑保护固定复采通过：生成页目录加载完成后真实点击生成按钮，隔离映射 API 返回 `GITLAB_MAPPING_NOT_FOUND`；映射读取期间模拟工作台正文变化，产品按空白来源继续检查并在提交 AI 任务前提示正文已变化。断言确认没有 AI jobs POST，并关闭/清理嵌入页。固定前端 57 文件及 45 导航、30 写作、17 任务管理、8 我的工作、5 手册往返、6 平台、16 审核计数齐全；行 7463/9979（74.78%）、分支 8875/13738（64.60%），较 `frontend-handbook-generate-entry-20261110c` 增 13 行、6 分支。`app.js` 行语句 2343/5480、分支 1627/4135。报告 `runtime/test-results/frontend-handbook-origin-race-20261110/coverage-summary.json`。Node 最近固定行 14387/16028、分支 13493/18183；Java 最近固定行 3118/3360、分支 1731/2178。全平台目标未达到。

2026-11-10T07:32:27+08:00 手册写作生成入口复采通过：真实文档按钮打开嵌入式写作页，隔离同源 fetch 仅返回模型、模板及只读 AI 目录数据，断言模型/模板请求并通过关闭按钮清理页面。固定采集完整，57 文件及 45 导航、30 写作、17 任务管理、8 我的工作、5 手册往返、6 平台、16 审核计数齐全；前端行 7450/9979（74.65%）、分支 8869/13738（64.55%），相较 `frontend-handbook-entry-20261110` 增 24 行、27 分支。`app.js` 行语句 2329/5480、分支 1618/4135；`openHandbookWriting` 计数 6。证据 `runtime/test-results/frontend-handbook-generate-entry-20261110c/coverage-summary.json`。Node 最近固定行为 14387/16028、分支 13493/18183；Java 最近固定行为 3118/3360、分支 1731/2178。全平台阈值未达到。

2026-11-10T07:20:02+08:00 手册写作入口生成页挂载设计：沿已认证 Chromium 页面，保留真实 `data-handbook-ai-action="generate"` 点击；为隔离写作容器提供当前文档 ID，将模型目录、模板目录及 AI 历史/技能/来源读取替换为同源 JSON 响应。草稿状态置为 ready 后断言嵌入式 `.handbook-writing-page` 可见、模型与模板目录请求发生，并点击真实关闭按钮验证页面清理。场景停在页面初始化，不点击生成、质量检查或采用保存；`window.fetch`、host、路由、草稿和通知均在 `finally` 恢复。伪代码：`stub(readOnlyCatalogs); click(generate); assert(mounted, catalogsRequested); click(close); assert(cleaned); restore()`。固定 57 文件分母不变。

2026-11-10 原生质量报告 `<dialog>` 关闭事件异步触发 DOM 清理，固定采集中 `setTimeout(0)` 后立即查节点发生时序失败。将夹具改为最多 1 秒轮询节点移除结果，继续验证真实 close 事件处理，不改变产品行为或放宽最终断言。

生成页场景使用产品支持的 Markdown 编辑偏好，让入口不依赖 Vditor 资源时序；真实动态导入入口在按钮点击后最多等待 1 秒挂载，再验证可见页面和关闭清理。

2026-11-10T07:38:09+08:00 手册写作入口来源检查补测设计：生成页目录就绪后点击真实“生成候选”按钮；隔离仓库映射读取返回 `GITLAB_MAPPING_NOT_FOUND`，并在 fetch 处理中更新工作台草稿以模拟并发人工编辑。断言产品 `prepareOrigin` 将未配置映射当作空白来源后，在提交生成任务前检测正文变化、显示保护提示，且没有 AI jobs POST。之后关闭写作页并恢复所有状态。覆盖来源准备、无映射回退及异步人工修改保护，不生成候选或写入后端。

2026-11-10T07:49:42+08:00 手册写作 GitLab 授权恢复设计：在前述隔离写作页场景后重新打开入口，映射读取返回已配置仓库，access-status 返回 `canRead=false`、`nextAction=connect_gitlab`。点击生成候选后断言来源区显示授权提示及 OAuth 恢复链接，并确认没有 AI jobs POST；通过关闭按钮清理页面。只模拟同源读响应，不执行 OAuth 跳转或业务写入。

2026-11-10T07:52:11+08:00 首次授权边界复采在前置嵌入页关闭断言处失败。产品通过宿主 `replaceChildren` 同步清除页面；夹具在点击后立即等待 0ms 观察全局 DOM，不能说明具体节点清理完成。两处关闭断言改为最多 1 秒轮询全局写作页节点清空，并在前一断言错误中附带残留节点摘要，以继续验证关闭契约。

轮询后仍发现写作 section 残留；在保留真实按钮 click 的前提下，夹具包装其既有 `onclick` 以记录是否调用及是否抛出同步清理异常，并将诊断加入失败信息，继续定位产品关闭结果。

2026-11-10T07:16:09+08:00 固定前端手册写作入口复采结果：真实 document click 场景通过，覆盖 `openHandbookWriting` 的未就绪、未保存、生成等待、重复打开和匹配修订打开质量报告路径。夹具补齐入口依赖的 `[data-handbook-current-document]`，使草稿状态按真实文档 ID 读取。固定 57 文件采集通过，45 导航、30 写作、17 任务管理、8 我的工作、5 手册往返、6 平台、16 审核计数齐全；前端行 7426/9979（74.41%）、分支 8842/13738（64.36%），较此前 `frontend-viewport-finalization-20261110` 增 25 行、31 分支。`app.js` 行 2304/5480 语句、分支 1598/4135；`openHandbookWriting` 函数计数 5。证据 `runtime/test-results/frontend-handbook-entry-20261110/coverage-summary.json`。Node 最近固定行 14387/16028、分支 13493/18183；Java 最近固定行 3118/3360、分支 1731/2178。平台目标仍未达到。

2026-11-10 固定前端 `app.js` 手册写作入口设计：覆盖报告中 `openHandbookWriting`（251–362 行）未被固定浏览器页面触发。沿现有已认证 Chromium 页面，以真实 `data-handbook-ai-action` 文档点击事件调用入口，隔离保存/恢复 `appState.activeView`、history 地址和整份 `handbookProductionUi`。验证检查模式下草稿未就绪、已保存正文与当前正文不一致时均显示“需要先保存草稿”提示；生成模式草稿未就绪时显示等待共享草稿提示；写作页已存在时重复点击不再创建页面；最后提供匹配已保存修订的正文，断言质量报告 dialog 正常打开并关闭恢复。该场景不点击质量执行 API、不写入后端业务数据；测试结束恢复通知 DOM 状态、路由、应用视图和草稿状态。伪代码：`snapshot(state,url,notice); set(production,handbookRoute,fixtureDraft); click(check/generate); assert(notice/page/dialog); restore()`。计数仍由原固定 57 文件 Istanbul 白名单收集。

2026-11-10 Node 文档任务审核读取降级固定复采结果：新增本地真实 HTTP 故障路径及完整路由套件 32/32 通过；固定 137 Jest 文件中 136 套件通过、1 条件跳过，1444 项通过、8 项跳过。总行 14387/16028（89.76%）、分支 13493/18183（74.20%）；`routes/document-tasks.js` 达到 407/407 行。报告 `runtime/test-results/full/20261110-064739-809978-full/details/coverage/coverage-summary.json`。固定 JaCoCo 独立复采仍为 9 源码行 3118/3360、分支 1731/2178。统一覆盖入口接续启动前端采集，本轮未等待该阶段完成；本轮目标仍未达成。

2026-11-10 Node 文档任务审核降级行设计：固定 Node 报告中 `packages/agent-runner-core/routes/document-tasks.js` 仅第 129 行未执行，该行把审核服务读取异常转换为“关联审核不可读取”的待处理投影。扩展既有真实本地 HTTP Jest 夹具，先按正常流程导入工单、确认手册/文档范围并关联审核任务，再令审核服务 `get` 抛出带 `code` 的错误，重新 GET 工单并断言 HTTP 成功、文档完成状态仍为 pending、中文降级标签及错误码均存在。伪代码：`linkReviewThroughApi(); reviewService.get=throw(code); GET(task); assert(pending,label,code)`。不连接共享审核服务或写入外部数据；以固定 Node 全量复采核对目标行和总计数。

2026-11-10 浏览器视口运行时收尾复采结果：完整固定采集通过，57 个产品脚本及 45 导航、30 写作、17 任务管理、8 我的工作、5 手册往返、6 平台和 16 审核计数齐全。隔离 iframe 补测原生 dvh 接管 measured token 的清理，以及存在待执行更新帧时 destroy 取消句柄。前端总行 7401/9979、分支 8811/13738；`common/viewport-runtime.js` 行 37/37、分支 35/35、函数 5/5。报告 `runtime/test-results/frontend-viewport-finalization-20261110/coverage-summary.json`。目标平台总覆盖仍未达成。

2026-11-10 浏览器视口运行时剩余分支设计：固定前端覆盖报告中 `common/viewport-runtime.js` 行已全覆盖，剩余两处分支分别是原生 dvh 接管测量值后移除 CSS 回退 token，以及销毁时取消待执行的 animation frame。在固定采集器现有 Chromium iframe 隔离场景增加两份独立文档：第一份让原生高度先不匹配以建立 measured token，再令探针高度匹配并调用公开 `update()`，断言来源切换为 native 且 token 被清除；第二份替换 iframe 的 request/cancelAnimationFrame 为确定性句柄，派发 resize 后立即 destroy，断言待执行回调被取消。仅触发真实运行时逻辑，不修改业务状态或后端数据。伪代码：`runtime(measured); nativeHeight=viewportHeight; update(); assert(tokenRemoved); runtime(pendingFrame); dispatch(resize); destroy(); assert(cancelled(frameId))`。

2026-11-10 Java `Main.main` probe 三态复采结果：真实一次性命令在隔离 JDBC 成功结果下正常输出并退出；空结果与错误值场景分别按预期抛出 SQL 异常，确认 JDBC 连接关闭。固定 Java 9 源码行 3118/3360、分支 1731/2178，相较 probe 前报告增加 12 行、6 分支。报告 `runtime/test-results/java-main-probe-results-20261110/coverage-summary.json`。Node 与浏览器前端未在本轮重采，平台目标仍未达成。

2026-11-10 Java `Main.main` 一次性 probe 命令覆盖设计：新增独立 JVM JaCoCo 场景，注册仅接受 `jdbc:fixture:business` 的确定性 JDBC 驱动，使用代理 Connection/Statement/ResultSet 返回 `SELECT 1 FROM DUAL` 的成功结果，再调用真实 `Main.main(new String[]{"probe"})`。追加独立失败进程，分别模拟无结果行和结果值错误，断言产品抛出预期 SQL 错误并完成连接池清理。覆盖命令选择、驱动加载、连接池借还、成功退出和结果错误边界；不启动服务、不连接共享数据库、不执行数据库写入。伪代码：`for result in [one, empty, wrong]: registerFixtureDriver(result); Main.main([probe]); assert(exitOrExpectedSqlError);` 将各场景加入固定 JaCoCo 编译与执行清单。

2026-11-10 Java Main 启动 HTTP 边界复采结果：隔离真实 HTTP 场景全部通过，覆盖质量/导出/技术领域/手册/大纲/团队/建设任务方法门禁、错误输入和幂等键校验。固定 9 源码行 3106/3360、分支 1725/2178；相较此前固定 JaCoCo 增加 5 分支，行数持平。证据 `runtime/test-results/java-main-http-boundaries-20261110/coverage-summary.json`。完整平台目标仍未达成。

2026-11-10 Java Main 启动 HTTP 边界补测设计：在已有动态端口 `StorageBootstrapContractCheck.server-http` 真实服务场景中，扩展非数据库路径的请求矩阵，覆盖质量接口和只读/导出/技术领域/团队/大纲/建设任务的错误方法响应、记录 ID 与任务项路径校验、手册/大纲快照的损坏 JSON，以及团队创建缺少幂等键。断言状态、错误码和请求 ID；所有数据库分支在借用连接前结束，不执行业务写入，不连接共享数据库。伪代码：`startIsolatedMainHttp(); for request in invalidMethodOrInput: sendRealHttp(); assert(status, code, requestId); stopProcess()`。采集器保留 9 个 Java 产品源码文件固定分母并重出 JaCoCo 报告。

2026-11-10 资产管理停用边界场景固定复采结果：真实 Chromium 场景覆盖高级操作展开、脏表单拦截、取消恢复管理框/焦点、dialog cancel 和忙碌阻止关闭，且无写请求。固定前端总行 7403/9979、分支 8810/13738；`app.js` 行 1991/4318、分支 1567/4135。完整计数见 `runtime/test-results/frontend-asset-management-20261110e/coverage-summary.json`。Node 与 Java 本轮未重采，整体目标未达成。

2026-11-09T22:39:44+08:00 Agent 运行与手册往返完整复采结果：本地 Agent 浏览器用例普通、插桩模式均通过，真实后端 `/run-test`、`/agent-runs/:id/events`、`/cancel` 与状态 API 驱动取消、完成和断线恢复；仅执行器与一次 MCP 503 为隔离替身。手册返回未插桩 6 次 P95=28.9ms，继续满足 100ms 门槛；插桩版本 5 个非空计数和功能断言通过。固定 57 文件白名单及 29 写作、17 任务管理导航页、8 我的工作、5 手册往返、6 平台管理、16 审核计数完整通过。行 6958/9979（69.72%）、分支 8104/13738（58.98%），比上轮完整报告净增 277 行、273 分支；`app.js` 行 1905/4318、分支 1525/4135，`model-admin.js` 行 101/101、分支 87/116。报告 `runtime/test-results/frontend-handbook-agent-20261109/coverage-summary.json`。尚缺前端 3021 行、5634 分支，Node/Java 未本轮重采，不能宣称全平台达标。

2026-11-09T22:27:21+08:00 手册返回功能与首帧性能双模式覆盖设计：`knowledge-center-my-work.node.test.cjs` 的现有手册返回测试使用本地隔离 HTTP 夹具，真实浏览器会进入完整 `app.js` 手册工作台，但固定前端采集此前为避免插桩开销污染 100ms 性能断言而排除。未插桩基线 6 次首帧 P95=30.7ms。保留原 6 次及 `<100ms` 断言；仅在 `KC_FRONTEND_ISTANBUL_CASE_DIR` 指定时为主、移动和直接进入三个页面插桩，功能往返 1 次，导航前及结束时保存计数，不拿插桩耗时与性能门槛比较。固定采集器只运行该独立插桩功能场景，校验计数来自原 57 文件白名单并合并；未插桩性能测试继续单独运行且门槛不变。伪代码：`performanceMode: repeat(6), assert(p95<100); coverageMode: instrument(threePages), navigateOnce(), captureBeforeHistoryAndClose(), assertFunctionalState(), mergeWhitelistedCounters`。

2026-11-09T22:24:00+08:00 Agent MCP 摘要错误态补测设计：`model-admin.js` 经真实运行测试及 SSE 恢复后仅剩第 85 行。切换 Agent 时浏览器先向隔离产品后端实际请求 Agent MCP 配置；页面网络层在该次成功响应后模拟 503 JSON，断言模型管理摘要显示“读取失败，请打开配置重试”，MCP 配置区保留重新读取按钮。该模拟仅覆盖前端失败反馈，不能冒称产品后端故障测试。伪代码：`route(fetch(realAgentMcpApi) -> 503); selectAgent(); assert(summaryError, retryButton); unroute()`。

2026-11-09T22:23:00+08:00 Agent 运行测试断线恢复补测设计：新增真实 HTTP/SSE 取消和完成场景后，`model-admin.js` 定向合并为 94/101 行，剩余未覆盖包括 SSE 断线时 GET 终态与运行中降级提示。隔离执行器使第三、四次运行的 SSE 第二次读取抛错，真实产品 SSE 路由关闭流，页面真实 `EventSource.onerror` 再经产品状态 API 回读；第三次返回已完成，第四次仍运行后允许用户取消。断言状态文案、请求与运行 ID，不依赖外部模型连接。伪代码：`start(); streamDisconnect(); GET->completed; assertSuccess(); start(); streamDisconnect(); GET->running; assertRecoveryNotice(); cancel()`。

2026-11-09T22:21:38+08:00 Agent 管理运行测试浏览器覆盖设计：固定前端报告的 `model-admin.js` 仍有 29 行未执行，集中在运行测试、SSE 终态、取消及创建 Agent。现有 `platform-agent-management.test.cjs` 已通过真实本地 HTTP 保存 Codex Agent 和模型配置；向其隔离后端装配确定性 `codexRunner`，由真实 `/platform/agents/:id/run-test`、`/platform/agent-runs/:id/events`、`/cancel` 路由驱动页面。一次运行保持进行中并由取消返回终态，第二次立即完成；断言按钮、状态、配置选择和 API 调用。再由页面新建一套未启用的内置工作流 Agent，并经真实 API 回读。伪代码：`saveCodexAgentAndModel(); clickRunTest(); assertHttp202AndCancelVisible(); clickCancel(); assertSseCancelled(); clickRunTest(); assertSseCompleted(); createWorkflowAgent(); assertHttpReadback()`。仅在本地隔离 HTTP 与内存执行器中运行，不连接外部模型或共享配置。

2026-11-09T22:17:35+08:00 平台管理补测完整结果：模型、Agent、MCP 三组普通基线中，Agent 通过；模型旧 `[data-ai-full]` 按钮和 MCP 旧独立标签夹具分别失败，按当前产品入口修正后普通与插桩定向测试通过。模型非安全测试域名的静态 JS 拦截经同一隔离 HTTP 服务的 127.0.0.1 地址抓取，页面域名及业务 API 请求保持原样。完整固定 57 文件清单、29 写作、17 任务管理导航页、8 我的工作、6 平台管理、16 审核计数通过；行 6681/9979（66.95%）、分支 7831/13738（57.00%），相对上一完整报告净增 115 行、245 分支，证据 `runtime/test-results/frontend-platform-controls-20261109/coverage-summary.json`。`mcp-admin.js` 与 `model-connection.js` 行完整覆盖，但分别仍缺 40、27 个分支；`app.js` 从上一轮 1695/4318 波动到 1685/4318，主要是平台菜单延迟渲染和资产统计异步回调，须后续稳定采集。Node/Java 未在本轮重采，三运行时目标均未完成。

2026-11-09T22:06:44+08:00 平台管理剩余页面行补测设计：完整报告中 `mcp-admin.js` 为 117/125 行，未执行项集中于自定义请求头保存、未保存/已保存服务删除和知识库验证失败；`model-connection.js` 为 107/109 行，未执行项为折叠详情内无效字段的展开处理。沿现有本地真实 HTTP/Chromium 夹具，添加请求头并断言保存后的脱敏配置回读，验证知识库请求失败状态与服务删除；模型连接在折叠服务中提交空名称，断言错误项展开且未发生配置写入。仍由固定 57 产品脚本采集器复采。伪代码：`addHeader(); saveViaHttp(); assertRedactedReadback(); failKbVerify(); deleteDraftAndSaved(); submitInvalidCollapsedModel(); assertExpandedAndNoSave()`。

2026-11-09T21:55:00+08:00 平台模型、Agent、MCP 隔离浏览器场景接入固定前端覆盖设计：三组现有测试均使用本地临时 HTTP 服务和隔离配置文件，验证真实平台 API 与页面交互；目前产品脚本执行未计入固定 57 文件前端报告。仅在 `KC_FRONTEND_ISTANBUL_CASE_DIR` 指定时拦截 `/knowledge-center/**/*.js`，按固定源码绝对路径插桩；模型和 MCP 页面重载前保存当前计数，三组用例结束时保存最终计数。固定采集器逐组运行，要求计数文件及快照非空，并核对每个源码路径属于原白名单，再合并到既有报告。普通运行和业务断言保持原样。伪代码：`isolatedHttpBrowser(); instrumentWhenRequested(); captureBeforeNavigation(); captureFinal(); assertTestsPassed(); validateFixedManifest(); mergeCounters()`。本轮不缩减产品分母，也不把隔离夹具结果描述为企业外部服务验收。

2026-11-09T21:51:19+08:00 任务管理与我的工作浏览器计数完整复采结果：固定 57 产品源码、29 写作、17 任务管理导航页、8 我的工作页面、16 审核计数齐全；行 6566/9979、分支 7586/13738，证据 `runtime/test-results/frontend-my-work-integrated-20261109/coverage-summary.json`。任务管理视图由 48/211 行、99/416 分支增至 199/211、352/416；我的工作由 77/213 行、91/386 分支增至 193/213、283/386。两个独立真实 HTTP 功能场景先定向通过，手册返回性能场景未插桩运行 P95=32.4ms（6 次），保持 100ms 门槛。任务管理测试隔离文件根调整为 `runtime/test-results`，仍在 `finally` 清理。后续按覆盖清单继续补 `app.js`、平台管理及两个视图剩余分支。

2026-11-09T21:39:21+08:00 我的工作真实 HTTP 浏览器测试接入固定前端覆盖设计：任务管理测试接入后 57 产品脚本、29 写作、17 任务管理页面、16 审核计数完整通过；前端行 6448/9979、分支 7392/13738，`document-tasks/view.js` 为 199/211 行、352/416 分支，证据 `runtime/test-results/frontend-document-tasks-integrated-20261109/coverage-summary.json`。下一高缺口 `modules/dashboard/my-tasks.js` 仅 77/213 行、91/386 分支，现有 `knowledge-center-my-work.node.test.cjs` 用真实本地 HTTP 夹具覆盖列表、筛选、同步、委派和窄屏交互。仅在固定采集环境中为前六个功能场景插桩产品 JS，在页面关闭或刷新前保存计数，校验原 57 源码白名单后合并；第七个手册返回首帧 100ms 性能场景保持原独立运行，不在插桩模式下用增量耗时误判或放宽性能阈值。伪代码：`instrument(productJs); functionalCases->capture(page); reload->capture(before); merge(whitelistedSnapshots); performanceCase unchanged`。普通测试和后端 HTTP 路由不变。

2026-11-09T21:28:44+08:00 任务管理真实 HTTP 浏览器测试接入固定前端覆盖设计：现有 `document-tasks-frontend.test.cjs` 运行产品 `view.js`、日历与真实 `createDocumentTaskRouter`，覆盖导入、工单/手册两级范围、分派、新增文档、计划时间冲突、配置和 390px 页面；固定前端报告中 `document-tasks/view.js` 仍缺 163 行，因该独立浏览器场景未输出 Istanbul 计数。仅在 `KC_FRONTEND_ISTANBUL_CASE_DIR` 存在时拦截 `/frontend/knowledge-center/**/*.js` 并按固定源码路径插桩；每次 `page.goto` 前保存当前计数，结束时输出页面快照数组。固定采集器运行该真实 HTTP 场景并逐个校验计数源码在原 57 文件白名单中，再合并；普通测试仍保持原行为。伪代码：`instrument(productJs); beforeNavigate(capture); run(realHttpBrowserScenario); capture(final); validateSourceList; merge(allSnapshots); compareFixedDenominator`。不缩减分母、不替换真实后端 API。

2026-11-09T21:26:26+08:00 模板控制器剩余行完整复采结果：一次性批量确认失败保留选择并重试，隔离第二页面阻断 Vditor 脚本后验证错误提示和 Markdown 回退；两页计数合并到固定前端源码清单。57 产品脚本、29 写作、16 审核计数齐全；前端行 6295/9979、分支 7136/13738；模板控制器行 319/319、分支 397/554，证据 `runtime/test-results/frontend-template-all-lines-fixed2-20261109/coverage-summary.json`。移动端历史焦点修复增加 3 个分支，跨轮总分母不能用旧值衡量分支增量。模板控制器分支仍缺 157 个；全前端尚缺 3684 行和 6602 分支，后续继续按产品高缺口模块推进。

2026-11-09T21:14:06+08:00 模板错误矩阵完整复采与最后三行设计：隔离页面的分析失败/重试、刷新失败、规则 JSON 与发布失败、缺正文、手动改选缺理由、键盘焦点矩阵通过；固定 57 产品脚本、29 写作、16 审核计数汇总，行 6290/9979、分支 7133/13738，模板控制器 316/319 行、397/554 分支，证据 `runtime/test-results/frontend-template-errors-fixed2-20261109/coverage-summary.json`。产品修复移动端历史面板排除折叠 `<details>` 内按钮，真实焦点循环通过。控制器余下行 14、28 为编辑器脚本/实例加载异常，行 179 为批量确认单条失败。后续用一次性失败的隔离 API 验证批量确认失败保留选择后可重试；用受控编辑器构造失败验证 Markdown 回退。编辑器资源加载异常需确保实例隔离，避免双重全局监听器污染主页面。

2026-11-09T21:03:37+08:00 移动端模板历史焦点局部缺陷：新增浏览器断言发现宽度 800px 时 Shift+Tab 未能从历史面板首个可见按钮循环到末尾。控制器直接选取 `.template-history button:not(:disabled)`，其中折叠 `<details>` 内按钮不可聚焦，导致末尾焦点目标隐藏。首次仅按 `getClientRects().length` 过滤仍失败；诊断显示折叠详情内按钮仍有布局矩形。修正为同时排除未展开 `<details>` 的后代，测试主动展开 v1 并验证首尾循环。范围仅为历史面板的键盘焦点选择，不修改模板业务数据或其他页面行为。

2026-11-09T21:01:13+08:00 模板编辑交互完整复采及后续错误矩阵设计：固定 57 产品脚本、29 写作、16 审核计数通过；前端行 6256/9979、分支 7078/13735，模板控制器行 290/319、分支 353/551，证据 `runtime/test-results/frontend-template-interactions-20261109/coverage-summary.json`。剩余 29 行中，可由模板分析失败、批次轮询/刷新失败、规则 JSON 解析失败、手动决定缺少理由、详情缺正文，以及页签/弹层键盘焦点环覆盖。继续通过隔离 HTTP 响应和公开界面事件触发，断言错误反馈、当前数据不被误写及焦点位置；完整固定复采核对增量。伪代码：`failAnalyze; retry; failRefresh; invalidRuleJson; missingReason; missingDetail; key(Tab,Escape,Home,End); assert(errors,focus,state)`。

2026-11-09T20:51:53+08:00 模板编辑与无障碍操作覆盖设计：固定报告显示模板控制器尚缺 59 行，集中在搜索 composition、元数据快照撤销、上传成功兼失败反馈、目录宽度指针/键盘控制和历史/映射抽屉按键。沿既有隔离 Chromium 页面，混合上传一个非法扩展名和一个有效 Markdown，断言上传请求只包含有效正文且页面同时显示成功和未保存；通过输入法事件、普通搜索、弹层取消/Escape、目录宽度 Home/End/指针移动和历史抽屉 Escape 核对 DOM 与本地状态。伪代码：`upload(valid,invalid); search(composition); editMetadata; discard; resize(key,pointer); closeHistory(Escape); assert(visible,state,requests)`。固定 57 源码和阈值不变，完整复采决定真实增量。

2026-11-09T20:50:39+08:00 模板分析生命周期和历史恢复结果：完整固定前端采集通过，57 个产品脚本、29 个写作计数和 16 个审核计数齐全。行 6229/9979、分支 7021/13735；`modules/templates/controller.js` 行 260/319、分支 295/551。隔离 API 请求断言分析手册、批次读取、取消路径与恢复 v1 请求；历史恢复前服务端仍保持 v4，用户保存后才成为 v5。报告 `runtime/test-results/frontend-template-lifecycle-20261109/coverage-summary.json`。剩余模板控制器 59 行和 256 分支仍需逐项设计边界场景。

2026-11-09T20:42:54+08:00 模板分析生命周期和历史恢复续测设计：固定采集报告中模板控制器仍缺 68 行，未执行映射分析、运行中刷新/取消和历史内容恢复。沿已隔离模板 API，分析返回运行批次，页面刷新读取同一批次，取消只清除当前批次；随后打开模板 v1 历史详情，点击恢复为草稿并断言正文未被直接保存，用户再保存才创建新版本。伪代码：`analyze -> running; refresh(batch); cancel(batch); openHistory(v1); restoreDraft(v1); assert(dirty,version); save; assert(newVersion)`。核对所有 API 路径、正文和版本基线，完整前端固定采集评估增量。

2026-11-09T20:41:56+08:00 模板冲突及 Markdown 上传完整复采结果：沿既定设计执行旧版本冲突、远端对照、本地草稿保存与新版基线重试，并验证非法文件不发请求、未确认入库提示、两次合法上传及成功详情回读。固定前端源码 57 个，写作/审核计数 29/16 个齐全；行 6220/9979、分支 7001/13735；模板控制器 251/319 行、281/551 分支。报告 `runtime/test-results/frontend-template-conflict-upload-20261109/coverage-summary.json`。后续继续补模板映射分析、取消/刷新、历史恢复、键盘与草稿边界；不更改固定源码分母和目标阈值。

2026-11-09T20:32:19+08:00 模板版本冲突和 Markdown 上传续测设计：固定复采后 `templates/controller.js` 仍缺 105 行，`showSaveConflict` 与 `importFiles` 完全未执行。沿同一浏览器内存模板 API，第一次旧版本保存返回 `TEMPLATE_VERSION_CONFLICT` 并提供远端新版本；核对页面保留本地草稿与远端对照，用户明确采用新版基线后重试，断言仅第二次请求产生新版本。文件输入依次使用非法扩展名、服务端未确认入库的合法 Markdown、成功入库的合法 Markdown，核对错误消息、请求次数、导入结果与详情正文回读；所有 API 响应仅在本次页面拦截。伪代码：`edit; save -> conflict; adoptBaseline; save -> success; upload(invalid, malformed, valid); assert(version, content, errors, requests)`。不写真实业务模板或缩减产品源码清单。

2026-11-09T20:23:38+08:00 模板映射控制器续测设计：前一份完整报告的 `templates/controller.js` 为 181/319 行、216/551 分支，未执行函数集中在 `confirmMapping`、规则预览/保存与批量操作。复用已隔离的模板 API 内存夹具，设置一份已完成分析批次、两篇同手册文档和一条可选模板；通过公开模板页签及按钮执行批量确认、依据抽屉中的手动改选、添加规则、字段编辑、影响预览与规则发布。断言每篇决定的文档/模板/理由和基线版本、页面已生效数、规则预览摘要及发布后版本，不写真实后端。伪代码：`seed(batch,handbook,rules); click(mapping); select+confirm; openEvidence+manualDecide; addRule+preview+save; assert(requests, DOM, state)`。固定前端源码清单、行/分支阈值和业务规则保持不变。

2026-11-09T20:12:28+08:00 前端模板控制器覆盖续测设计：固定报告中 `modules/templates/controller.js` 尚缺 233/319 行，导航采集仅切换页签，真实的创建、元数据编辑、Markdown 正文保存和回读未执行。固定 Chromium 页面在本次测试范围内拦截模板 API，以内存模板状态响应列表摘要、详情、创建、保存、历史版本和启停；页面仍通过产品 `platform-api.js` 发出 HTTP 请求。以管理员真实登录后的模板导航触发公开界面事件，断言空白创建、字段输入和保存请求体、版本/正文回读、编辑后新版本、历史查看及状态切换；拒绝或错误响应也必须在页面显示且不改变内存已保存数据。结束后撤销路由拦截，完整 57 前端源码固定采集并检查控制器增量。伪代码：`route(inMemoryTemplates); navigate(templates); create; edit; save; readback; history; toggle; assert(requests, DOM, state); unroute()`。不修改业务数据、产品规则、覆盖率分母或门槛。

2026-11-09T20:08:58+08:00 固定前端完整复采结果：先修正导航前未保存 Istanbul 计数的问题，同一 57 源码分母下，前端从 5762/9979 行、6243/13735 分支升至 5946/9979、6455/13735；`outlines/view.js` 从 34/266 行、42/564 分支恢复到 171/266、221/564，证明原始计数确实丢失。再补已发布分工、团队配置、回收站和资源页后，该模块为 255/266 行、350/564 分支。最后补平铺目录节点、同层排序与业务版本标签，完整前端采集 57 个产品脚本、29 个写作计数文件、16 个审核计数文件通过；该模块达到 266/266 行（100%）、391/564 分支（69.33%），总前端为 6031/9979 行（60.43%）、6616/13735 分支（48.16%），证据 `runtime/test-results/frontend-outline-full-lines-20261109/coverage-summary.json`。与上一轮固定前端基线相比，总量新增 269 行、373 分支；最近两次复采 `app.js` 有 10 行、9 分支的事件时序波动（平台菜单延迟重绘及资产统计），未将这部分视为大纲测试回归。完整平台目标仍未达成。

2026-11-09T20:00:16+08:00 大纲视图剩余行续测设计：前次固定报告的 11 个未覆盖行分别位于非空业务版本标签、同层文档排序、目录节点完整度/检查器、平铺 `parentId` 节点树重建。沿公开 `renderOutlines` 构造一份同父目录下有两篇页面的平铺节点和非空业务版本，选择目录节点；核对目录检查器显示子节点数、页面数与未完善计数，信息抽屉含业务版本，并确认两篇页面保留排序后的导航。伪代码：`render(detail(flatNodes, versions), selectedDirectory); assert(inspector, order, versionTags)`。场景只渲染本地 DOM，固定分母不变；完整采集后按行号核对是否真正达到该模块行 100%，不以场景通过代替计数。

2026-11-09T19:51:31+08:00 大纲视图已发布人员分工续测设计：整页导航计数修正后 `outlines/view.js` 为 171/266 行，未执行部分集中于正式建设任务、领域成员、历史责任人和回收站。沿采集器现有隔离 DOM 调用公开 `renderOutlineAssignments` 与 `renderOutlines`：构造同手册同版本、含主责与协作领域的任务，核对待分派/已分派行、目录筛选、负责人选项、历史责任人和统计；再构造无团队负责人、有/无平台管理权限、无任务和不匹配任务，核对阻断及空态。回收站验证有记录时恢复/清除入口、无记录及服务失败重试；资源页验证模板说明。场景只渲染真实前端模块，不发送业务写请求，完整固定分母复采并核对该模块计数。伪代码：`render(publishedTasks); assert(rows, roles, options, stats); render(noLeader, empty, recycle, resources); assert(states)`。

2026-11-09T19:42:37+08:00 前端整页导航计数完整性设计：固定 Istanbul 报告中 `modules/outlines/view.js` 的 `detail`、`renderOutlineAssignments` 等函数计数为零，但固定采集器在首次页面已调用并断言其 DOM，说明首次页面在 `/outlines/resources` 等连续 `page.goto` 前丢失。将页面计数校验和合并抽为单一采集函数，在每次整页导航前保存当前页面；导航失败应阻断采集，避免重复合并同一页面快照。仓库页面四种状态继续复用同一采集函数，最后页面只合并一次；写作与审核计数机制保持原样。伪代码：`capture(initial); for path: goto(path); capture(current); goto(root); exerciseViews(); capture(root); for state: goto(repository); capture(state); merge(last)`。以完整固定前端清单、源码白名单及大纲视图函数计数验证，而不是只核对退出码。

2026-11-09T19:39:35+08:00 Java 固定 JaCoCo 复采结果：迁移摘要算法缺失、非法/严格校验策略、历史版本标识错误均通过实际 `SchemaMigrationManager` 入口执行。首次全量采集被在途 `Main.java` 第七列变更与旧六列 HTTP 夹具不匹配打断；更新夹具并核对 `domainRole=PRIMARY` 后完整 9 源码清单通过。最新 Java 行 2885/3360（85.86%）、分支 1588/2178（72.91%），相对上次完整结果增加 3 行、3 分支；证据 `runtime/test-results/java-migration-strict-20261109/coverage-summary.json`。`SchemaMigrationManager.java` 为 166/171 行、128/136 分支，余下未覆盖行 47、106–107、117–118；`Main.java` 仍缺 470 行。Node、前端未在本轮重采，三运行时整体目标仍未达成。

2026-11-09T19:33:47+08:00 Java 迁移摘要异常覆盖设计：固定 JaCoCo 报告显示 `SchemaMigrationManager.sha256` 的算法不可用包装分支未执行。沿 `MigrationExecutionCheck` 的独立 Java 进程，保存当前安全 Provider 顺序，临时移除提供 SHA-256 摘要的 Provider，通过公开 `migrate` 触发 `NoSuchAlgorithmException` 并断言包装为 `IllegalStateException`；在 `finally` 按原顺序恢复 Provider。检查该路径未执行 SQL、未写迁移记录、未提交或回滚，并在完整固定 9 源码 JaCoCo 复采中确认对应行计数。伪代码：`saveProviders(); removeSha256Providers(); try { migrate(); assert(cause, noSql, noCommit); } finally { restoreProviders(); }`。隔离夹具不连接真实数据库，也不改变产品实现、分母或阈值。

2026-11-09T19:36:00+08:00 Java 完整复采夹具适配：当前在途 `Main.projectOutlineDirectory` 查询的责任域行增加 `DOMAIN_ROLE` 第七列，固定真实 HTTP 夹具仍只返回六列，导致目录请求连接关闭，JaCoCo 采集提前中断。更新隔离 JDBC 行集返回 schema 允许的 `PRIMARY`，并断言 HTTP 目录投影含 `domainRole`；随后重跑完整固定 Java 清单。伪代码：`rows(query) -> [node, domain, name, owner, ownerName, status, PRIMARY]; GET(directory); assert(domainRole)`。不修改产品 SQL 或覆盖率门槛。

2026-11-09T19:37:00+08:00 Java 迁移校验策略边界续测设计：`SchemaMigrationManager.checksumMismatchFatal()` 对 `strict`/`warn` 以外的环境变量值返回公开 SQL 错误，固定报告的该抛错行未覆盖。固定采集器以单独 Java 进程传入非法 `YASDB_MIGRATION_CHECKSUM_POLICY`，复用 `MigrationExecutionCheck` 创建的隔离迁移目录，通过 `verify` 断言错误消息与无 SQL/提交；不改变同进程其他场景的环境。伪代码：`env(policy=invalid); run(check, invalid-policy); verify(connection) -> SQLException; assert(noSql, noCommit)`。仍以 9 个产品源码和同一 JaCoCo 分母验收。

2026-11-09T19:39:00+08:00 同一 JaCoCo 报告还显示 `strict` 校验策略返回真及非法历史版本标识拒绝未执行。`MigrationExecutionCheck` 的常规别名矩阵加入非 `NNN_name` 的历史版本；另在独立 `strict` 环境进程预置已应用但摘要不匹配的迁移，调用 `verify` 断言摘要冲突、无 SQL/提交。伪代码：`alias(001_init=broken) -> invalidVersion; env(strict), applied(wrongChecksum), verify() -> mismatch`。不改产品校验规则，测试失败即阻断固定采集。

2026-11-09T19:02:00+08:00 `app.js` 大纲交互前端覆盖设计：最新固定前端原始计数中主脚本仅 1530/4318 行、1199/4135 分支，节点筛选、分工筛选、右键菜单与移动入口均为零计数。在现有 Chromium 采集器的独立 DOM 容器中构造小型节点表、分工表、文档按钮、上下文菜单及移动弹框，借由已注册的真实页面事件验证筛选结果/空态、批量选择计数与可提交状态、菜单定位与 Esc、目录节点展开和当前父目录禁选。状态夹具只注入前端 `appState` 内存，结束后恢复 URL、状态和 DOM；不发后端写请求或改变产品源码。伪代码：`mountOutlineFixture(); dispatch(input/change/contextmenu/click/keydown); assert(rows, selection, menu, dialog); restore()`。

2026-11-09T19:10:00+08:00 `app.js` 仓库工作区覆盖设计：页面通过真实 `navigate` 进入 `/assets/HB-COVERAGE/repository`，请求层只对本次隔离 API 返回确定性 HTTP JSON。成功矩阵返回访问权限、分支、目录和 Markdown 文件，断言页面正文、树、分支语言投影和规范化 URL；错误矩阵依次返回 OAuth 要求、映射缺失和空分支，断言未授权/未映射/不可用状态。所有请求仍从浏览器页面发出，夹具不写业务数据；结束时移除路由拦截并恢复 URL。伪代码：`route(apiFixtures); goto(repository); assert(renderedProjection); route(error); reload(); assert(errorState)`。

2026-11-09T19:30:44+08:00 完整前端采集确认仓库页面成功、OAuth、映射缺失和空分支场景。首次连续导航导致前一页 Istanbul 计数丢失，错误报告虽退出成功但总行为 4505；采集器现于每次导航前校验并合并页面计数，再用原有最后页面读数完成汇总。空分支按产品契约显示正常仓库页中的“目录为空”，测试断言已据此修正。最终固定分母复采行 5762/9979、分支 6243/13735；`app.js` 从 1616/4318 行、1273/4135 分支升至 1647/4318、1314/4135，证据 `runtime/test-results/frontend-repository-20261109d/coverage-summary.json`。未调整产品规则、源码清单或阈值；后续跨整页导航的新场景必须在销毁前合并计数。

2026-11-09T19:08:48+08:00 大纲交互矩阵完整采集通过。`app.js` 同分母由 1530/4318 行、1199/4135 分支、187/547 函数提升至 1616/4318 行、1273/4135 分支、202/547 函数，新增 104 行、74 分支、15 函数覆盖。全前端为 5729/9979 行、6191/13735 分支；证据 `runtime/test-results/frontend-app-outline-20261109/coverage-summary.json`。未缩减源码清单、未放宽阈值；下一步仍需处理 `app.js` 的生产/仓库/平台管理路径及 Node/Java 缺口。

2026-11-09T18:31:00+08:00 前端组合框 Istanbul 续测设计：`coverage-final.json` 显示公共 `searchable-combobox.js` 的增强函数已执行，但筛选、展开、选择、键盘、定位和同步回调未执行。沿现有 Chromium 采集器在页面内构造隔离原生表单和 `select[data-searchable-select]`，通过真实 DOM 事件验证搜索无结果、键盘 Home/End/上下/Enter/Escape/Tab、切换按钮、外部点击、第二组合框互斥、原生 change/reset、动态 option 和禁用状态、外部赋值同步、scroll/resize 后定位、移除后的清理。只使用页面本地表单，不发业务请求、不修改生产规则或固定产品源码清单。伪代码：`mountForm(); enhance(); dispatchUserEvents(); assert(nativeValue, visibleValue, aria, listbox); remove(); cleanup()`。

2026-11-09T18:40:00+08:00 公共表格视图配置器前端续测设计：固定前端计数显示 `table-view-configurator.js` 仅 69/138 行，抽屉和变更提交路径基本未执行。采集器在独立 DOM 容器创建三列两行表格，通过点击触发器、复选框、上下移、重置、Esc/关闭按钮/遮罩验证列可见性、顺序、焦点和偏好持久化；再用隔离 localStorage 键验证旧列顺序迁移及变更回调后的抽屉恢复。清理 DOM 和测试键，保留产品源码分母。伪代码：`enhance(table); click(trigger); change(visible); move(column); reset(); assert(table, storage, drawer); remountOnChange(); cleanup()`。

2026-11-09T18:48:14+08:00 首轮完整复采已将表格配置器从 69/138 行、44/117 分支提升至 136/138 行、96/117 分支。剩余两个未覆盖行是非法旧偏好 JSON 的降级路径与 `.outline-responsibility-table` 自动声明分支；续测加入同一隔离 DOM 夹具并再次完整复采，不改变产品逻辑。

2026-11-09T18:57:24+08:00 第二轮复采修正了“旧偏好损坏应恢复初始列序”的错误测试预期：产品以当前 DOM 列序作为默认列序，降级时应验证列可见且未写入损坏偏好。补充非法 JSON 与自动声明后完整前端采集通过，表格配置器行 138/138、函数 57/57、分支 97/117；组合框行 182/182、分支 93/125。全前端行 5643/9979、分支 6119/13735；证据 `runtime/test-results/frontend-table-view-final2-20261109/coverage-summary.json`。同一固定采集器的前端源码内容在两次运行间变化，产品文件数同为 57，需按同分母模块计数评价本轮增量。后续仍需覆盖大体量 `app.js` 及其他模块，并达到完整门禁。

2026-11-09T18:38:57+08:00 完整前端 Istanbul 采集通过，`searchable-combobox.js` 行 182/182（100%）、分支 93/125（74.40%）、函数 43/46；同一产品文件比前次增加 82 行、64 分支和 25 个函数。全前端行 5589/10001、分支 6079/14021，固定脚本数从 56 变为 57，源于工作区已有前端源码变化；本轮没有调整采集清单。证据 `runtime/test-results/frontend-combobox-20261109/coverage-summary.json`，完整命令日志 `runtime/test-results/frontend-combobox-20261109.log`。剩余零计数分支主要是缺省参数、视口定位和部分过滤边界，后续继续按行为补足；不得据单模块行 100% 宣称全平台目标达成。

2026-11-09T18:22:16+08:00 固定 Node 续测设计：沿现有本地真实 HTTP 夹具验证 `GET /knowledge-center/api/production/generations` 的查询参数、当前会话和状态快照透传，以及服务异常、服务不可用的错误信封；沿 GitLab 认证夹具验证 OAuth 配置安全投影、断开个人连接后状态变化、缺少连接 ID 和非个人连接拒绝。只增加行为测试，不调整产品源码清单、统计口径或目标阈值。伪代码：`request(realHandler); assert(status, envelope, observedSessionAndParams); disconnect(personalConnection); assert(statusAfterDisconnect); reject(serviceConnection)`。

2026-11-09T18:27:46+08:00 上述场景定向 6/6、16/16 通过，固定 Node 精确清单 135 套件通过、1 套件条件跳过，1410 项通过；行 14274/16000、分支 13343/18139。相对前次固定 Node 复采新增 23 行、17 分支，主路由 `knowledge-center.js` 从 1624/1855 行、1737/2490 分支升至 1647/1855 行、1754/2490 分支。证据 `runtime/test-results/node-generations-oauth-full/coverage-summary.json`。前端和 Java 仍以此前统一报告为准，三端门禁尚未达成。

2026-11-09T18:22:16+08:00 上轮新增审核冻结图片真实 HTTP 测试的固定 Jest 清单复采：135 套件通过、1 套件条件跳过、1408 项通过；Node 行 14251/16000、分支 13326/18139，分别较统一报告增加 26 行、27 分支。证据 `runtime/test-results/node-review-resource-full/coverage-summary.json`；前端和 Java 未在该复采中运行，平台目标尚未达成。

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

`tests/run_tests.py` 的所有实际测试运行每次在独立批次目录写入 `report.html`，包括 `full/all`、`gate` 正式归档；`list` 和 `--dry-run` 不生成报告。浏览器直接打开总览，场景明细按 `--report-page-size`（默认 50）静态分页，离线 CSS、JS 和用例索引位于 `assets/`。分享时保留完整批次目录。既有 `report.md`、`details/report.json`、任务日志和退出码保持原有契约。

## 数据与流程

`details/report.json` 是 HTML 唯一数据源。测试执行结束后先保存 JSON，再将其读回渲染 HTML；测试失败也走同一路径。`--dry-run` 不生成报告。历史批次不补生成 HTML。

渲染器使用标准库生成中文总览及场景分页：总览展示命令、结论、时间、耗时、任务成功数、测试文件数与用例通过/失败/跳过数；任务表展示状态、分类、框架、文件数、用例数、耗时及日志链接；失败项按任务归组。逐条结果提供失败详情、稳定锚点及跨场景搜索和状态筛选；启用覆盖率时展示各运行时分子、分母、目标缺口。缺失用例统计显示“未统计”，不得推断为零。所有动态文本转义；日志链接仅接受批次内 `details/tasks/` 下的相对路径，异常路径退化为纯文本。无 JavaScript 时仍可浏览静态分页。

## 验收

隔离临时目录覆盖三类报告、成功/失败、缺失统计、无日志、HTML 特殊字符和异常日志路径；通过一次真实 smoke 运行确认生成入口、JSON 结论与日志链接。

### 前端共享 UI 渲染器默认参数分支

固定 Istanbul 浏览器采集器在真实 Chromium 页面中动态导入公开共享渲染器 `common/components/ui.js`，补齐默认参数和无动作能力态：`panel(title, body)` 应生成标题与正文且允许 `meta` 默认空值；`pendingState()` 应使用默认标题和说明；`capabilityState(title, description)` 应生成能力提示但不渲染操作按钮；`section({}, name)` 返回 `null`，`formattedTime({})` 返回等待数据提示。每个场景通过对返回 HTML/值的语义断言确认实际行为，不调用后端、不改变固定源码分母。伪代码：`assert(panel(...)); assert(pendingState()); assert(capabilityState(...)); assert(section(...)=null); assert(formattedTime(...)=waiting)`。定向采集确认 `ui.js` 的默认参数与条件结果均被执行；随后必须运行完整固定前端采集、检查所有原计数断言和源码/测试输入 SHA 稳定，再比较覆盖率增量。

2026-11-13 固定全量复采结果：`runtime/coverage-goal/frontend-ui-default-branches-20261113/` 完整成功，59 个固定前端源码文件、46 个导航文件及写作 31、任务 16、我的工作 8、手册往返 5、手册编辑 5、平台 6、审核 19 等原场景计数均通过；`source-stability.json` 的 `completed/stable/inputsStable` 均为 true，`changedFiles=[]`。总行 9928/10957（90.60%），分支 11466/15320（74.84%）；共享 `common/components/ui.js` 行 8/8、分支 9/9。该变化只说明前端固定集合的本次结果，知识中心管理平台三端目标行 100%、分支 95% 仍未达成。

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

认证控制器续验复用同一隔离页面认证响应夹具，增加 CAS 回调成功但会话仍匿名、管理员登录直接返回完整会话/缺少会话时重新读取 session/凭证失败、统一认证禁用或缺少登录地址时拒绝跳转、本地退出清理认证状态和记忆目标、退出请求失败传播。所有请求仅由页面 fetch 夹具响应，不访问真实身份服务；完整场景结束恢复 fetch、URL 和 `authState`。伪代码：`for response in [casAnonymous, adminComplete, adminRefresh, adminError, logoutError, localLogout]: arrange(response); assert(returnValue || rejection, authState, storage, ticketCleanup)`。

写作页面固定 Chromium 场景动态导入 `production-chat-evidence.js` 并构造真实 DOM/API 交互：历史状态与操作权限回退、来源快照和 provenance 引用区间校验、无效引用忽略/空态/远端加载失败、复制与评分成功失败、反馈空值/提交成功失败、删除取消/成功失败及当前消息错误投影。API 通过页面路由注入确定性响应，不写入业务服务；该测试随既有 `production-writing.test.cjs` 页面计数进入固定 Istanbul 合并。伪代码：`renderHistory(fixtures); showEvidence(valid/empty/remote/error); exercise(copy/rating/feedback/delete success+failure); renderCurrent(null/failed); assert(DOM, requests, callbacks, notifications)`。

固定前端主 Chromium 场景新增真实 `app.js` 资产管理交互：经页面路由提供隔离资产目录和人员/连接只读投影，选择手册后打开管理框并展开默认收起的高级操作；修改名称时验证停用被阻止，恢复初始值后打开确认框，覆盖按钮取消和 dialog `cancel` 恢复管理框与触发焦点，并覆盖忙碌中的确认框拒绝取消。此矩阵不提交资产编辑、停用或状态变更；只调用真实页面事件处理器，API 路由仅满足读取投影。伪代码：`route(readProjections); navigate(assets); openManage(); expandAdvancedActions(); edit(); assert(archiveBlocked); restoreForm(); openArchive(); cancel(); assert(manageRestoredAndFocused); busy=true; dispatch(cancel); assert(confirmOpen); busy=false; cancel()`。

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

### 固定全量复采判据（2026-11-06）

完整入口为 `python3 tests/run_tests.py full --coverage --jobs 1 --timeout 1800`，分别以固定 Node、浏览器 JS、Java 产品源码清单判定行 100%、分支至少 95%，并要求性能及 E2E 门禁通过。2026-11-06 最新报告 `runtime/test-reports/2026-11-06/20261106-175514-830554-full/report.md` 显示三端均未达标：Node 87.69%/71.60%，浏览器 54.62%/42.97%，Java 85.77%/72.77%。当前仍有 20 个失败用例，后续补测需兼顾这些真实失败，不得通过缩小分母或降低阈值达成数字。

### 工作台入口 E2E 契约纠偏（2026-11-09）

`knowledge-center-entry.spec.js` 的三个失败断言仍指向旧“风险与阻塞”总览及无刷新按钮的入口。当前已确认的主入口为“我的工作”个人待办。测试改为通过真实浏览器、认证和后端 API 验证工作类别、处理状态、九列任务字段、个人工作刷新请求、数据变更后的平台投影请求，以及未知路由回退后显示“我的工作”。保留 `context` 不应随仅 `overview` 事件重读的断言。定向验证须由统一运行器创建隔离测试实例，不能对共享服务执行写入型 E2E。

隔离 `test_hy` 实例上的定向 Playwright 复采已通过，Chromium 3/3、Firefox 3/3，共 6/6；测试后实例由运行器按所有权清理。启动前 `node --check` 和仓库 Node 语法检查通过。

### AI 任务评价与历史删除覆盖矩阵（2026-11-09）

在现有 Jest 服务测试中以隔离聚合存储覆盖评价缺失、非法等级、超长意见、非作者拒绝、成功评价及审计、运行中删除拒绝、删除后列表/详情不可见；该套件进入固定 Node Istanbul 分母。对应路由通过 `handbook-production-api.test.js` 的本地真实 HTTP 服务验证评价写入、列表回读和 DELETE 后 404。测试只写内存状态与隔离临时目录，不调用外部模型，不修改产品权限规则。伪代码：`POST start; GET job; POST feedback; GET list; DELETE job; GET job -> 404; assert audit and owner boundary`。

定向 Jest 服务套件 34/34 通过，定向 Node 原生真实 HTTP 用例 1/1 通过。固定 Node 精确清单 135 个 Jest 文件复采为 134 套件通过、1 套件条件跳过，1365 用例通过、7 跳过；报告 `runtime/test-results/node-full-20261109/coverage-summary.json` 为行 14018/15981（87.71%）、分支 12967/18095（71.66%）。`production-ai-service.js` 为行 471/530、分支 547/705；与旧统一报告的产品源码分母已变化，不能仅凭总量差值归因于单项测试。

### 大纲候选和治理 HTTP 覆盖矩阵（2026-11-09）

沿用 `outline-route-boundaries-http.test.js` 的隔离文件仓库和真实 Express HTTP 服务。验证候选不存在、内容编辑后重读、预检失败与通过、版本发布的基线/编辑版本冲突及成功发布；验证治理读取、缺失大纲、无分工时发布拒绝、有效领域分工保存后发布成功，以及发布后重复发布的幂等结果。各拒绝操作断言状态码和错误码，关键成功操作重读持久化结果。伪代码：`createCandidate; edit; preflight; publishVersion; createCandidate; publishGovernance -> 422; saveAssignment; publishGovernance -> 200; readGovernance`。固定源码清单和覆盖率门禁不变。

定向真实 HTTP Jest 10/10 通过。统一全量报告 `runtime/test-reports/2026-11-09/20261109-095753-972673-full/report.md`：75/78 任务通过；Node 行 14065/15981（88.01%）、分支 13028/18095（72.00%），Java 行 2882/3360（85.77%）、分支 1585/2178（72.77%）。前端采集器因写作浏览器用例 4 项失败未生成报告；性能门禁的知识资产就绪元素未出现，业务 E2E 另有失败。三端覆盖率门禁仍为 FAIL，不能以本次 Node 增量代表目标达成。

### 前端写作采集恢复（2026-11-09）

工作树中的对话界面已将历史项改为对话轮次，并加入默认关闭的反馈、删除弹窗。同步更新 `production-writing.test.cjs` 中四项浏览器场景的可见弹窗断言和历史轮次操作定位，保留生成、历史回读、编辑器复用及 MCP HTTP 验证。定向 4/4、完整写作套件 29 通过/2 条条件跳过；固定前端 Istanbul 采集器重新通过，57 个脚本行 5398/9878（54.64%）、分支 5801/13534（42.86%），报告 `runtime/test-results/frontend-goal-20261109b/coverage-summary.json`。Node、Java 数值仍采用上次完整复采；三端目标未达成。

上次全量 E2E 的文档生产两处旧断言与现行页面不符：来源目录在打开参考资料入口时才加载，正常工作区的返回链接名为“返回进入位置”。`knowledge-center-handbook-production-p0p1.spec.js` 已调整触发顺序、返回链接及 MCP 预设策略提示的断言。隔离 `test_hy` 实例的 Chromium 定向复验：返回导航 1/1 通过，来源目录及真实 API 1/1 通过；每次实例均按所有权清理。完整 E2E 与覆盖率门禁仍待复采。
# 检索策略覆盖矩阵（2026-11-09）

`retrieval-strategy/index.js` 的定向回归采用临时知识目录和确定性 MCP 工具替身。MCP 分别验证空查询、无工具、批量成功与部分失败；设计文档分别验证无候选、摘要缺失或不相关、正文缺失、分块缺失与索引损坏后的旧目录回退。Oracle 索引验证标题、ID 和正文命中、文件缺失与索引缺失；目录扫描验证大小写、非 Markdown、缺失目录、源码五文件上限和截断。结果整合验证各来源优先级、结构化与文本 MCP 数据、失败呈现、长文截断；覆盖度验证空结果、部分覆盖和充分覆盖的三档建议。断言以返回值和来源内容为准，不更改产品评分规则或固定覆盖率分母。

Oracle 表格索引的通用 ID 解析限定为字母开头的编号，纯数字 ID 交由已有数字表格分支解析；两种格式保留相同的 `id/file/title` 结果。目录扫描后文件消失时，各来源分别忽略该文件并保留检索响应。索引特性 ID、关键词与版本加分通过候选排序验收。

全量 Jest 门禁中的审核导航静态断言按现行工作区契约校准：审核页导入并调用 `reviewNavigation`，导航返回“返回审核文档清单”；增量任务复用的 `stage=review` 回链仍存在。该断言只核对已实现页面，不改变审核导航行为。

检索策略分支续验追加索引确认上限、空关键词和缺省字段、Oracle 标题足量时跳过正文扫描、MCP 缺省错误及无分数结果、五种来源的覆盖度摘要。通过返回项数量、来源、建议等级和格式化文本判定；原有索引及提示词规则不变。

缺字段索引边界再核对：无摘要路径的候选跳过、仅靠版本命中的文档可返回空正文、无关键词时设计文档与分块不误命中，以及无 `results` 的 MCP 结构返回零条。使用公开执行入口和确定性临时索引判定。

固定全量复采发现审核工作台浏览器覆盖套件新增第 16 个场景，采集器仍要求 15 个计数文件。同步数量断言为 16，仍逐个校验页面计数和固定产品源码清单，不改变分母或目标阈值。个人工作 E2E 表头按当前 `my-tasks.js` 的六列可见列表校准；子任务编号等细节在详情中保留。真实 API 刷新和工作流场景继续执行。

模板管理 E2E 顺应已实现的新建流程：选择空白模板后先在模态“基本信息”面板填写名称、类型和描述，点“完成”关闭面板，再切换 Markdown 并编辑正文；保存后通过真实模板 API 列表、版本及刷新回读断言。伪代码：`createBlank(); fillMetadata(); done(); chooseMarkdown(); save(); reload(); assertVersionAndBody()`。不得用强制点击穿透面板，也不放宽页面的交互可达性要求。

知识资产移动端 E2E 在点击第一本手册前等待真实资产列表 `data-asset-loaded=true`，与同文件桌面操作栏场景使用同一页面就绪契约。继续断言 URL 带手册 ID、全屏操作入口及返回后的列表；等待只消除初始化时序竞争，不允许跳过失败或替换为静态夹具。

Node LLM 客户端补测沿用已有固定 Jest 套件，通过 OpenAI SDK 边界替身验证可观察的协议契约：401/403 认证、限流、超时和网络错误稳定分类；Responses 完成与未完成投影；Chat 流完成、非 stop 和意外结束；probe 首个有效 token 后中断、空流及 provider 错误；包裹 JSON 解析、禁用修复和 provider 更新查询。不得调用真实模型，不直接伪造 Istanbul 计数；最终以固定 Jest 产品清单复采判定。

### 审核图片 HTTP 路由固定 Jest 覆盖（2026-11-09）

`routes/knowledge-center.js` 的审核图片资源路径在现有 Node 原生全链路测试中已执行，但固定 Node Istanbul 只采集 Jest。新增 Jest 本地真实 HTTP 夹具，隔离 `runtime/test-results` 下的映射配置与测试图片，使用有效会话和一个受控本地 GitLab 文件服务。矩阵包括冻结新图成功（字节、MIME、私有缓存和 nosniff）、候选摘要变化、非所属图片、仓库映射身份变化、旧图缺少固定提交、旧图从固定提交读取、字节摘要/尺寸不符以及格式拒绝。每个拒绝检查实际 HTTP 状态和公开错误码，使用原服务入口，不直接调用内部私有函数；原 Node 原生全链路场景继续覆盖上传、送审和交付。伪代码：`GET /incremental-tasks/:id/resources; assert status, bytes, safe headers; vary frozen task and mapping; assert public error`。不改变产品源码或覆盖分母。

### 存储记录客户端固定 Jest 覆盖（2026-11-09）

`DatabaseRecordStore` 通过本地真实 HTTP 服务验证健康检查、名称空间与键的 URI 编码、读取投影、带与不带修订号的写入、删除和完整导出；请求端核对方法、正文及 `If-Match`。响应矩阵包括成功、服务端业务错误且有/无完整错误字段、空响应、无效 JSON、连接拒绝及请求超时。测试使用内存响应和随机本地端口，不访问共享存储或修改产品契约。伪代码：`startLocalStorage(); callPublicMethods(); assert(request, projection, errorCode); closeServer()`。该套件进入统一入口的固定 Jest 文件清单，再按原产品源码分母复采。

### 网页引用原生契约纳入固定计数（2026-11-09）

已有 `production-web-reference.test.cjs` 使用本地真实 HTTP、固定 DNS 解析和受限浏览器，验证私网地址拒绝、重定向、响应大小、压缩、HTML 提取、登录验证页以及 SPA 动态正文。统一入口仅发现 `*.test.js`，该 `.cjs` 文件原先未进入 Node Istanbul 计数。复用现有 `native-contract-coverage.test.js` 的 `node:test` 到 Jest 桥接，在同一进程加载原测试并执行原断言，不复制场景或调整产品网络限制；须先定向验证，再复采固定 137 文件及产品源码清单。

### Java 存储服务启动 HTTP 覆盖（2026-11-09）

`Main.start` 的真实路由注册尚未进入固定 JaCoCo 计数。扩展已有启动契约夹具，另以隔离进程和动态本地端口启动产品 `HttpServer`，通过真实 HTTP 核对健康检查在无可用 JDBC 时的 503 信封、请求 ID，以及非法记录路径的 400 响应。测试进程在请求回读后正常退出，确保 JaCoCo 写出执行数据；不连接共享数据库，不改变产品端口默认值或服务行为。伪代码：`reservePort(); runFixtureWithAgent(port); startProductServer(); GET /health; GET /v1/records; assert(status, error, headers); exit(0)`。采集器需保留原 9 个 Java 产品源文件清单并重新汇总。

### Java 旧版层级大纲快照 HTTP 覆盖（2026-11-09）

现有快照 HTTP 夹具只传入规范化 `nodes`，未执行兼容的 `parts/chapters/children` 层级路径。在同一隔离 JDBC 状态机中，于既有版本冲突和生命周期断言之后追加旧版结构快照：一个部分含直接文档、章节、嵌套小节和补充目录，每层有一篇文档。通过真实 `/v1/domain/outlines/snapshot` PUT 核对 200 回执、8 个节点的类型/标题/层级与父关系，以及仅一次事务提交；原有主流程计数在此之前保持不变。伪代码：`PUT legacyPartsSnapshot; assert response; assert insertedNodeHierarchy; assert commits == before + 1`。仅扩展夹具允许并记录本场景的节点写入，不更改产品持久化或统计口径。

### Java 单篇草稿按键读取 HTTP 覆盖（2026-11-09）

在现有 `StorageRecordHttpCheck` 隔离 JDBC 状态机中增加 `handbook-production/state` 草稿行，通过真实本地 HTTP 的 `draftKey` 查询验证空记录返回空草稿、聚合 revision 首次出现时返回带 `Retry-After` 的可重试 503、后台重建后仅返回指定上下文的当前修订、revision 变化时再次重建，以及软删除后返回空草稿。轮询只等待公开响应转为 200，不直接修改索引；断言旧修订和其他上下文内容不泄漏。伪代码：`GET empty; set aggregate r7; GET -> 503; poll GET -> current draft; set r8; GET -> 503; poll GET -> updated draft; mark deleted; GET -> null`。原记录 CRUD 与导出断言保持，产品源码、计数分母及门槛不变。

### Java 大纲快照分工合并 HTTP 覆盖（2026-11-09）

在既有规范化 `nodes` 快照中同时提供显式 `governance.assignments` 和文档节点的 `techDomainIds`，两处均指定同一有效领域；另给出一个不存在节点的显式分工，验证它不会产生持久化项。通过真实 `/v1/domain/outlines/snapshot` PUT 和隔离 JDBC 写入计数断言只建立一份有效责任项，并校验节点、领域与主责角色。伪代码：`PUT snapshot(explicit doc-1:7, content doc-1:7, unknown:7); assert 200; assert one responsibility insert(doc-1, 7, PRIMARY)`。保留原快照版本、目录和事务断言。

### Java 未发布大纲说明更新 HTTP 覆盖（2026-11-09）

在同一隔离治理夹具完成版本恢复后，将测试版本置于可编辑的 `READY` 状态，调用真实 `/v1/domain/outlines/:id/governance` PUT 更新现存文档节点说明。JDBC 夹具读取字符流并记录节点 ID、版本 ID 和操作者，响应及后续 GET 必须回读新说明；核对版本只增加一次且事务只提交一次。已发布内容锁定的原有拒绝测试保留。伪代码：`state=READY; PUT descriptions(doc-1, new text); assert one node update; GET governance -> new text`。

### Java JSON 解析边界覆盖（2026-11-09）

在现有 `StorageBootstrapContractCheck` 的隔离进程中反射调用产品内部 JSON 解析入口，验证负数、32 位边界、长整数、浮点、小数指数、正负指数、转义字符串、布尔/null、尾随字符、未结束字符串、非法数字和非法字面量。断言返回类型和值或公开 `JsonParseException`，不写数据库、不启动共享服务；仅补测试输入以覆盖解析器边界。

### Java GitLab 配置路由编辑边界 HTTP 覆盖（2026-11-09）

在现有 `StorageGitLabHttpCheck` 的真实本地 HTTP/JDBC 流程中补连接 PATCH、状态非法、过期行版本、映射缺少幂等键、映射过期行版本和非法 JSON 场景。每个请求核对 HTTP 状态和公开错误码，成功编辑后回读连接与映射版本；不改变仓库验证规则或共享配置。

### Java 迁移 SQL 解析器引号与注释边界（2026-11-10）

扩展 `MigrationSqlParserCheck` 的公开 SQL 分割契约：首字符为单引号且字符串内包含分号，验证下标为零时仍正确开始引号；字符串内的 `--` 与 `/*` 保持字面内容，不进入注释状态；块注释在尾随 `*` 后结束输入仍明确拒绝。场景经固定 JaCoCo Java 采集器在隔离进程执行，不改 SQL 解析实现及产品清单。

### Java 人员管理 HTTP 错误映射与批量边界

扩展 `StoragePrincipalHttpCheck` 的真实本地 HTTP/JDBC 场景，覆盖无效人员状态、CAS 登录名缺失、同名候选歧义、持有 CAS 登录记录后的直接换绑拦截、重复 CAS 登录名创建失败、超过 1000 项的批量导入。每项核对公开 HTTP 状态和错误码/消息，复用隔离人员数据库，不调用私有错误映射函数，不改变人员规则或产品源码。

### Java 平台认证 HTTP 错误与角色边界

扩展 `StorageAuthHttpCheck` 的本地真实 HTTP/JDBC 状态机：验证非法 CAS 主体 ID、不存在及停用人员、CAS 登录不匹配、角色列表为空或含未知角色、角色更新目标不存在、默认角色缺失。每个请求断言公开状态及错误码；缺少默认角色场景仅使用隔离内存数据库，不触碰共享身份数据。

### 前端平台 API 公开方法浏览器覆盖

在 `platform-model-management.test.cjs` 的隔离浏览器中动态导入真实 `common/api/platform-api.js`，替换该页面的 `fetch` 为可编排 `Response` 的请求记录器，依次调用导出的资产、团队、模板、平台数据、人员、权限和大纲 API。逐项核对 URL 编码、方法、正文、版本/幂等头与错误事件；大纲加载覆盖目录缓存命中、列表回退、空/不存在/权限/服务错误，变更 API 覆盖成功、结构化失败及网络拒绝。由固定前端采集器通过既有平台模型场景保存 Istanbul 浏览器计数，仍校验 57 脚本产品白名单。

同一隔离浏览器动态导入真实 `modules/platform-admin/view.js`，通过公开 `renderPlatformAdmin` 入口构造治理、人员/团队、权限和 GitLab 的空数据、有效数据、不可用、只读与管理员变体；权限结果另外验证筛选/分页/角色可编辑性，GitLab 验证授权、验证状态、分页和编辑/新增表单。断言关键可见文案和结构，所有结果均由固定 Istanbul 浏览器计数采集，不改生产代码。

### 独立 Node 契约固定 Jest 接入（2026-11-09）

先验证可复用性：`production-web-reference-v2.test.cjs` 与 `production-web-reference-v3.test.cjs` 仍以回环地址作为网页来源，当前产品私网防护统一拒绝，v2 还引用已移除的 `contentCache.reset`，因此两套旧用例未纳入固定计数；未来应按现行安全契约更新夹具后独立复验。改用已独立通过的 `production-ai-mcp-retrieval.node.test.cjs` 与 `template-mapping-service.test.cjs`：前者以真实本地 HTTP 验证 MCP 路由标头、去重、失败及正文快照，后者验证规则冲突、AI 失败、取消、版本和跨手册预览。通过既有 `native-contract-coverage.test.js` 的 `node:test` 桥接复用原断言；性能预算用例保持原生独立执行，避免 Jest 插桩改变计时。先定向 Jest，再复采固定 Node 清单和产品源码分母。

固定清单复采结果：137 个 Jest 文件中 136 套件通过、1 套件条件跳过，1430 项通过、8 项跳过；行 14352/16028、分支 13454/18183，报告 `runtime/test-results/node-native-bridge-full-20261109/coverage-summary.json`。相对上一固定 Node 报告同分母增加 4 行、20 分支；MCP 检索模块为 77/79 行、105/115 分支，模板映射模块为 122/122 行、169/201 分支。

`handbook-demand-read.node.test.cjs` 的三条页面 VM 场景因产品工作区新增辅助模板映射请求而缺少夹具依赖，原生运行 5/8 通过。仅在 VM 沙箱加入返回空映射的 `loadTemplateMappings` 和无编辑器 DOM 的 `document`，保留真实目录、映射、草稿时序断言；先让原生套件全部通过，再评估其中 Node 服务 HTTP 场景是否能进入固定计数。不得将 VM 字符串截取视为浏览器入口覆盖率。

夹具校准后原生 8/8 通过。接入现有 `native-contract-coverage.test.js` 桥接，服务端按键读取仍请求真实本地 HTTP，Java 子进程检查保持原断言；VM 源码截取只计为测试行为，不进入固定浏览器 57 脚本计数。先定向 Jest 再按精确 137 文件复采，以 `aggregate-store.js`、`handbook-production-service.js` 与总量的原始覆盖计数验收。

同轮另有三套原生契约通过：`aggregate-store-async.node.test.cjs` 的并发读合并、304、跨进程修订和 CAS 重试（1/1）；`admin-delegated-review.node.test.cjs` 的本人身份代审、阻断评论和审计（1/1）；`workbench-numbering.node.test.cjs` 的编号回填、重审链、权限隐藏和冲突（3/3）。一并通过既有桥接纳入固定 Node 采集，不另写产品逻辑；所有服务使用随机回环端口或内存仓库。

桥接需兼容 `require('node:test').test` 这种命名导入；第一次定向尝试显示注册函数缺少 `.test`，适配后定向 85 项通过、5 项条件跳过。精确固定 137 个 Jest 文件复采为 136 套件通过、1 套件条件跳过，1443 项通过、8 项跳过；Node 行 14386/16028（89.75%）、分支 13493/18183（74.20%），同分母增加 34 行、39 分支。报告 `runtime/test-results/node-native-bridge-full2-20261109/coverage-summary.json`。`aggregate-store.js` 行 136/154、分支 104/154；`handbook-production-service.js` 行 229/233、分支 187/246；`workbench-numbering.js` 行 76/76、分支 125/130。
# 数据库连接抽屉脏表单交互覆盖（2026-11-10）

固定前端 Istanbul 采集在真实平台管理页面进入系统治理后，打开数据库连接抽屉，修改用户名并展开高级设置；先拒绝关闭确认并断言抽屉仍打开，再确认关闭并断言抽屉收起。该流程只验证页面状态与事件分支，不调用测试连接或保存接口，不连接或修改数据库。采集仍校验计数来源属于原固定前端产品源码清单，并合并到 57 文件报告。伪代码：`open(governance); openDrawer(); editField(); toggleAdvanced(); confirm=false; assert(open); confirm=true; assert(closed)`。

补充隔离测试连接失败：页面对 `/platform/database-connection/test` 注入本地 HTTP 500 JSON，点击“仅测试连接”后断言错误状态可见且按钮恢复可用，再继续脏表单关闭确认。该注入只模拟前端错误反馈，不连接数据库或改变后端契约。固定报告 `runtime/test-results/frontend-db-test-error-20261110/coverage-summary.json` 行 7186/9979、分支 8570/13738。

再补充保存失败：对同源 PUT 注入隔离 HTTP 500，点击“验证并保存”后断言错误状态和按钮恢复。固定报告 `runtime/test-results/frontend-db-save-error-20261110/coverage-summary.json` 行 7196/9979、分支 8569/13738；分支总量相对上一报告有一次采集波动，未按波动宣称分支净增。

成功矩阵补充：对测试连接返回隔离 HTTP 200 并断言成功反馈；对保存返回隔离 HTTP 200，断言成功状态、投影更新和保存后按钮状态，再次编辑字段验证脏表单关闭确认。固定报告 `runtime/test-results/frontend-db-success-20261110b/coverage-summary.json` 行 7203/9979、分支 8578/13738。

最终复采报告：`runtime/test-results/frontend-db-success-final-20261110/coverage-summary.json`，57 个产品脚本、45 个导航页面、29 写作、17 任务管理、8 我的工作、5 手册往返、6 平台和 16 审核快照均齐全；行 7203/9979、分支 8583/13738。一次尝试在平台页重载后丢失重载前 Istanbul 计数，已移除该重载夹具，不作为验收证据。

目录树公开交互矩阵（2026-11-10）：在浏览器页面内导入 `directory-tree.js`，构造嵌套目录和叶节点，验证初始层级、Arrow/Home/End/Enter/Space 键盘导航、搜索过滤及清空恢复。该夹具只操作隔离 DOM，不依赖业务数据。固定报告 `runtime/test-results/frontend-directory-tree-20261110/coverage-summary.json`：总行 7224/9979、分支 8606/13738；`directory-tree.js` 行 79/117、分支 67/156。

目录树边界矩阵复采：补充隐藏空目录保留、`treeRole=false`、交互式目录标签、自定义节点键、空子节点和重复绑定幂等性。最终报告 `runtime/test-results/frontend-directory-tree-boundaries-20261110/coverage-summary.json`：总行 7247/9979、分支 8632/13738；`directory-tree.js` 行 102/117、分支 99/156。

目录树键盘边界复采：补充关闭目录 ArrowRight、展开后首子项聚焦、ArrowLeft 返回父项和无搜索控件树。报告 `runtime/test-results/frontend-directory-tree-keyboard-20261110/coverage-summary.json` 中 `directory-tree.js` 语句 128/164、分支 100/156；总量行 7241/9979、分支 8631/13738，受既有页面时序波动低于上一份总量，按模块确定性增量验收。

默认分支与重跑最终报告：补充默认渲染器、隐藏空目录和带搜索叶节点。首次审核用例有 1 项人员展示时序失败，未改产品或断言；同一固定采集重跑 16/16 审核通过。最终报告 `runtime/test-results/frontend-directory-tree-defaults-retry-20261110/coverage-summary.json`：总行 7254/9979、分支 8647/13738；`directory-tree.js` 行 109/117、函数 32/32、分支 111/156。

导航面板交互矩阵（2026-11-10）：在浏览器页面内导入 `resizable-navigation-pane.js`，构造真实 DOM 面板，验证损坏本地偏好回退、鼠标拖拽提交/取消、双击恢复默认、Arrow/Home/End/Enter/Escape 键盘调整、折叠切换和重复绑定幂等性。固定报告 `runtime/test-results/frontend-navigation-pane-20261110/coverage-summary.json`：总行 7305/9979、分支 8697/13738；`resizable-navigation-pane.js` 行 102/102、函数 19/19、分支 79/105。

滚动运行时 iframe 隔离矩阵：导入 `scroll-runtime.js`，构造主滚动所有者、局部滚动区域、固定障碍和焦点目标，验证所有者/区域契约检查、焦点自动滚动、resize 与 viewport 事件调度、契约刷新及 destroy 清理。首次夹具前置条件错误已修正为先设置 `scrollMode=main`，最终报告 `runtime/test-results/frontend-scroll-runtime-20261110b/coverage-summary.json`：总行 7310/9979、分支 8705/13738；`scroll-runtime.js` 行 119/121、函数 24/25、分支 173/208。

滚动运行时边界复采：补充空区域、默认契约扫描、不可滚动局部区域诊断和待取消帧的 destroy 路径。最终报告 `runtime/test-results/frontend-scroll-boundaries-20261110/coverage-summary.json`：总行 7314/9979、分支 8717/13738；`scroll-runtime.js` 行 121/121、函数 25/25、分支 184/208。

可关闭菜单矩阵（2026-11-10）：在独立 DOM 根中验证重复初始化复用、打开菜单互斥、菜单自身 pointerdown 保持打开、外部 pointerdown 关闭、Escape 关闭并恢复焦点、组合框 Escape 不冒泡关闭父菜单、对话框内菜单隔离及 destroy 清理。固定报告 `runtime/test-results/frontend-dismissible-menus-20261110/coverage-summary.json`：总行 7318/9979、分支 8724/13738；`dismissible-menu.js` 行 38/39、函数 13/14、分支 30/33。

视口运行时双模式矩阵：隔离 iframe 覆盖不支持 `dvh` 的 measured token、visualViewport 缩放/无效高度回退、重复高度事件去重、原生 `dvh` 高度一致以及 destroy 清理。原生模式只在隔离 iframe 中为运行时创建的探针注入确定性矩形，不影响产品 DOM 或浏览器逻辑。固定报告 `runtime/test-results/frontend-viewport-runtime-20261110b/coverage-summary.json`：总行 7332/9979、分支 8737/13738；`viewport-runtime.js` 行 37/37、函数 5/5、分支 33/35。

### 手册草稿保存交互矩阵（2026-11-10）

沿用固定 Chromium 采集器的隔离手册路由、草稿状态和真实页面点击事件。验证共享草稿未就绪时禁止保存；就绪后对 PUT 草稿接口分别注入结构化失败和成功响应，检查请求携带手册/文档、基线摘要、编辑版本、Markdown、模板版本、附件 ID，以及失败提示和成功后的服务端版本、脏状态。保存期间再次修改正文时，检查本地后续修改仍为脏状态，且成功提示明确要求再次保存。只替换隔离页面的同源 `fetch` 响应，不触碰共享后端数据；后端保存契约仍由真实 HTTP 测试负责。伪代码：`set draft ready; click save; assert PUT body; return error; assert failure; click save; return saved revision; assert clean; click save and edit before response; assert dirty`。本场景仍纳入固定 57 文件分母，完整采集结果才可用于平台目标验收。

完整复采 `runtime/test-results/frontend-handbook-save-20261110/coverage-summary.json` 通过：57 个产品脚本、45 导航、31 写作、17 任务管理、8 我的工作、5 手册往返、6 平台和 16 审核计数齐全；行 7756/9986（77.66%）、分支 9098/13744（66.19%）。相对前一份完整固定前端报告，增加 45 行和 43 分支；`app.js` 行 2319/4318、分支 1814/4135。采集器 `node --check` 与本轮改动文件 `git diff --check` 通过。Node 和 Java 未在本阶段重采，全平台阈值尚未达到。

### 仓库映射目录读取交互矩阵（2026-11-10）

固定 Chromium 页面中构造隔离的仓库映射表单，保留 `app.js` 的真实 `change` 和 `input` 事件处理。连接选择先返回两个分支和嵌套目录，验证默认分支、受保护标签、目录层级、请求路径与搜索过滤；切换分支时目录接口返回未授权，验证错误和 GitLab 授权入口；再切换连接使分支接口失败，验证分支错误提示。测试期间保存并恢复页面的 `fetch`、映射状态和表单节点；全部同源 API 响应均为确定性读模拟，不执行连接、映射或仓库写入。伪代码：`select connection; assert branches/tree; search; select branch -> 401; assert authorization; select other connection -> 500; assert branch failure`。采集仍保留固定 57 个产品脚本分母，以完整报告验收增量。

目录选择增补：在默认分支目录树中展开 `docs`，先为中文选择目录，再切换到英文为嵌套目录选择路径；核对跨语言选中标记、中文和英文标签以及预览，随后分别通过标签移除路径并确认占位提示。使用实际目录按钮和语言按钮点击，覆盖状态与渲染的联动，不通过直接修改已选路径数组代替交互。

完整复采 `runtime/test-results/frontend-mapping-selection-20261110/coverage-summary.json` 通过：固定 57 个产品脚本、45 导航、31 写作、17 任务管理、8 我的工作、5 手册往返、6 平台和 16 审核计数齐全。行 7826/9986（78.36%）、分支 9158/13744（66.63%）；相对手册草稿保存完整报告增加 70 行、60 分支，`app.js` 行 2389/4318、分支 1874/4135。目录读取是主要增量，选择增补相对目录读取报告仅增加 2 行、4 分支，说明主要选择路径已有覆盖。Node 和 Java 未在本阶段重采，平台阈值仍未达到。

### 图片交付与源码稳定性验收（2026-11-10）

通过 `createProductionResourceDelivery().prepare/readFrozen` 公开边界补充隔离文件系统测试：附件与来源图片的上下文、摘要、类型、逐项及总配额，Markdown/HTML 改写去重和冻结快照重读。期望以明确错误码、授权路径、输出正文和真实文件字节定义，不直接测试私有函数。运行产物置于 runtime；既有真实 HTTP 交付测试继续承担路由契约责任。

完整覆盖率采集应记录执行前后产品源码及测试文件 SHA256。若源码变化，报告只作诊断，不作为同一版本的增量或达标证据；测试失败的报告同样不能作为通过门禁的证据。伪代码：`manifestBefore; runFixedSuite; manifestAfter; accept = exitCode === 0 && manifestsEqual`。

上传解析 Worker 验收分成两层证据：真实 Worker 验证 HTML 净化和最小 OOXML 图片解析；Jest 隔离上下文复验同一解析结果，使子线程内代码进入插桩计数。资源故障和未发送结果就退出的事件使用 EventEmitter 作为 Worker 边界替身，断言公开 Promise 拒绝、只终止一次及迟到消息不重新结算。该替身不代替真实文档解析证据。定向14/14通过，模块56/56行、49/50分支（98%）。

质量验证器真实文件矩阵定向20/20通过，模块124/129行、57/67分支。剩余行包括固定成功的分块检查所对应的失败分支；不通过篡改内部检查对象制造覆盖，不忽略这些产品源码，不据此宣称质量验证逻辑已完整实现。

### 设计文档流水线与生产配置管理器边界（2026-11-10）

新增 `preprocessing/design-doc-pipeline-boundaries.test.js`：真实 OOXML/Markdown、解析失败继续、过滤 hash、隔离文档与资产回读、显式保留严重失败、说明同步、输出兼容和清理错误、分块 metadata 回退，以及公开自定义适配器的扫描 hash 回退。结合原 pipeline-integration 共27项通过，模块183/183行、102/107分支（95.32%），函数和语句100%。

新增 `config-manager-production-boundaries.test.js`：7项直接加载生产实现，真实原子 JSON 存储和 AES-GCM，覆盖递归加密、损坏密文、缓存、分区、同步读取、预设更新、JSON/写入异常。只有配置路径、环境、日志与 OS 监听事件源隔离；并非重写测试版 ConfigManager。模块133/133行、103/103分支，函数和语句100%。两份定向报告分别在 runtime/test-results/pipeline-boundaries-directed-20261110 和 config-manager-directed-20261110，固定全Node复采另计。

固定142文件复采结果：139套件通过、2套件失败、1条件跳过；1579项通过、2项失败、8项跳过。源码监测发现 incremental-build-service.js、routes/knowledge-center.js 以及两个 CJS 测试在运行中被其他会话修改，stable=false。失败项分别是 closed MR 是否仍提供 sync_delivery，以及投影中文标签；不通过放宽断言或回退并行改动强行变绿。这份混合报告只诊断，不用于增量比较或达标判定。


### 来源读取与压缩包公开边界（2026-11-10）

2026-11-10 来源读取与压缩包边界：新增来源公开方法44项，以真实本机 PingCode/MCP HTTP、Worker上传和隔离存储验证，模块195/195行、227/236分支（96.18%）。压缩包结合原测试23项通过，模块164/164行、77/79分支（97.46%）；真实嵌套ZIP复现提前删除导致ENOENT，现延迟到外层parse完成统一清理；TAR/TGZ真实文件/目录冲突验证流销毁、及时拒绝与清理。定向报告为 `runtime/test-results/ai-sources-directed-20261110/coverage-summary.json`、`runtime/test-results/archive-boundaries-directed-20261110/coverage-summary.json`。平台总量另以固定清单和源码稳定性验收。

来源测试保留真实上游HTTP参数、JSON-RPC初始化与工具调用、正文和传输独立限制、归属及版本冲突、图片授权回读和损坏拒绝。网页及自动检索只在外部模块接口使用替身；不替换本模块验证、摘要和图片托管。压缩包错误通过真实归档条目路径冲突触发，扫描EACCES/EIO仅在文件系统边界注入。首次来源失败是夹具未恢复大小上限，修正夹具；首次嵌套ZIP失败是产品生命周期缺陷，先记录设计再修复。


2026-11-10 最新通过的固定 Node 复采：144 文件清单，143 套件、1638 项通过，1 套件及8项条件跳过，154 产品文件源码及测试前后 SHA256 一致。行14850/16071（92.40%）、分支14125/18309（77.14%）；证据 `runtime/test-results/node-sources-archive-stable-20261110/coverage-summary.json` 与 `source-stability.json`。前端最近7826/9986行（78.36%）、9158/13744分支（66.63%），Java3118/3360行（92.80%）、1731/2178分支（79.48%），本阶段未重采。目标仍未达到。

这份是修复后稳定版本的通过证据。此前143文件报告测试虽通过，但包含本轮在途改动，仍只作诊断。当前Node距离100%行还差1221行，达到95%分支至少还需3269个分支；分母变化源于当前代码版本，不能将全量差值全部归因于本轮测试。


### API入口与认证公开边界（2026-11-10）

2026-11-10 API入口35项通过，135/135行、66/68分支（97.05%）；认证45项通过，364/364行、383/395分支（96.96%）。均使用真实本机HTTP；认证真实超限用例暴露并修复CAS响应超限竞态与Node22 Socket未处理异常。API入口公共CJS套件由两个显式describe入口引用，确保统一测试发现识别为Jest。定向证据 `runtime/test-results/api-entry-directed-20261110` 与 `runtime/test-results/auth-boundaries-directed-20261110`；固定147文件全量复采另计。

验收包括真实Socket.IO订阅/退订、gzip解压回读、路由鉴权及信号关闭边界；认证包括CAS协议错误、限时/限量、重放、退出、角色权限与仓储状态。外部存储适配器可注入确定性结果，HTTP入口与被测模块必须真实执行。统一发现器按入口声明识别Jest，公共套件入口需要显式describe封装。


2026-11-10 最新通过的固定 Node 复采：147 文件清单，146 套件、1706 项通过，1 套件及8项条件跳过，154 产品文件源码及测试前后 SHA256 一致。行14947/16074（92.98%）、分支14284/18311（78.00%）；证据 `runtime/test-results/node-api-auth-fixed-stable-20261110/coverage-summary.json` 与 `source-stability.json`。前端最近7826/9986行（78.36%）、9158/13744分支（66.63%），Java3118/3360行（92.80%）、1731/2178分支（79.48%），本阶段未重采。目标仍未达到。


## 2026-11-10T18:47:27+08:00 专业HTML测试报告改进设计（REA）

用户完整提示词：有哪些业界优秀的测试报告可以参考，然后使用rea skill来改进生成的html报告，需要的是专业的html测试报告，评分需要达到9分以上。

路由：标准开发，职责为参考能力取证、设计适配、实现、确定性回归与浏览器验收，主执行者承担；用户已授权功能范围，无新增审批边界。实际加载.codex/plugins/rea/skills/app-capability-transfer/SKILL.md及同插件reverse-engineer-anything/SKILL.md、references/runtime-observation.md；使用本地rea.sh，不修改全局配置。同时使用全局ui-ux-pro-max辅助可访问性及视觉验收。

参考：Allure Report结果分布/失败聚合、Playwright HTML Report状态筛选/用例定位、ReportPortal质量概览、pytest-html离线分享/日志详情。官网或官方仓库原始证据保存在runtime/rea/professional-test-report；403等访问限制单独保留，不伪称已观察交互。既有报告只有静态表格，缺少跨分页检索、失败直达、统一视觉和量化门禁。

方案：统一浅色专业数据界面、深色侧栏、面包屑、运行摘要与状态文字、结果分布、分类结果表、失败及阻塞优先、最慢任务、覆盖率实际分子分母/目标/缺口。静态场景分页保留；生成独立本地case-index.js用于跨页搜索/状态筛选和稳定用例锚点，点击匹配可跳转并展开详情。所有文案中文、无CDN与网络字体、搜索使用textContent构建DOM、日志仅允许details/tasks内相对路径、所有数据HTML转义。无JS仍可浏览总览/所有分页；不生成不存在的历史趋势、重试、环境或附件。

伪代码：保存JSON→建立场景/稳定用例ID及分页位置→渲染统一总览与分页→写本地CSS/JS/索引；检索全部索引→状态与关键词联合过滤→返回真实匹配数与分页深链接；覆盖率目标读取config/knowledge-center/coverage-targets.json并随报告冻结，不以展示四舍五入判定达标。页面打开目标100ms内，用本机离线Chromium报告DOM加载/渲染数据并说明测量范围。

评分表（10分）：数据可信2、失败定位2、检索导航2、视觉层级1.5、无障碍/移动端1、离线/性能1、可追溯0.5。交付门槛≥9分，证据缺失不计满分；评分为本轮有证据的自评，不代表独立第三方认证。验收覆盖真实运行、混合失败/跳过/未执行、跨页搜索/过滤/深链接、长日志/XSS/路径逃逸、无JS、移动端、离线请求、性能及回归。


### 2026-11-10T18:59:41+08:00 专业HTML报告实现与验收结果

按确认范围完成统一入口报告升级。新增离线共享CSS/JS/用例索引，报告总览具备运行结论、结果分布、失败与阻塞、场景统计、覆盖率目标缺口、任务耗时和原始JSON；场景页保留静态分页，支持跨场景搜索、状态筛选、失败深链接和详情自动展开。HTML文本均转义，日志链接限制在details/tasks，未知统计不虚构，JS失效仍可浏览静态结果。

行业参考与证据：Allure官方仓库README（结果详情/每日执行信息）、Playwright官方HTML reporter文档（筛选/详情）、ReportPortal官方仓库README（质量总览）、pytest-html官方仓库README（HTML报告/离线详情）；原文快照和SHA在runtime/rea/professional-test-report。使用REA app-capability-transfer与reverse-engineer-anything流程，REA受控Chromium观测Allure演示成功，Evidence完整，耗时18129ms，证据runtime/rea/professional-test-report/allure-runtime-evidence.json。

验证：tests/unit/root/test_run_tests.py 43/43通过；python3 tests/run_tests.py smoke成功并生成runtime/test-results/smoke/20261110-185330-955292-smoke/report.html；离线Chromium 390px加载约117ms、搜索命中3条、无横向溢出、无脚本错误；报告资源无网络依赖。按数据可信2、失败定位2、检索导航2、视觉1.5、无障碍/移动端1、离线性能1、可追溯0.5的量表自评9.5/10。该评分是有证据的本轮验收，不代表第三方认证。
### 2026-11-10 前端固定采集器复跑记录

固定副本中的前端 Istanbul 采集器补充了只读账号下的清洗上传 DOM 覆盖场景，并将资产统计权限、错误和成功状态的断言改为等待真实 DOM 文案，避免异步渲染时序误报。复跑前补齐固定副本缺失的 Vditor CSS/JS 静态依赖后，清洗和资产统计场景均可继续执行；写作图片预览夹具仍分别出现 `page.addStyleTag: Event` 与 `page.evaluate: Resulting promise was garbage collected`，均发生在测试启动/浏览器运行时，未生成完整覆盖率汇总，不能作为前端覆盖率验收证据。源码稳定性清单保持 stable，报告输出保留在 `runtime/test-results/coverage-snapshots/20261110-183123/runtime/test-results/frontend-goal-final-20261110d/`。

### 2026-11-10T19:29:25+08:00 专业 HTML 报告复核

沿用已加载的仓库 REA 技能与业界参考证据，复核入口 unittest 43/43、真实 smoke 24/24。命令 `python3 tests/run_tests.py smoke --report-page-size 2` 生成 `runtime/test-results/smoke/20261110-192850-959829-smoke/report.html` 和12个场景分页。离线Chromium桌面/390px各10次，DOMContentLoaded最大45.7ms/77.4ms；跨页搜索、用例跳转、无JS浏览通过，脚本错误、HTTP请求及页面横向溢出均为0。原始测量、截图、可重跑脚本及9.5/10内部评分明细见 `runtime/rea/professional-test-report/ACCEPTANCE.md`；性能项仅0.5/1，未验收大型报告100ms，保留此前117ms样本。

覆盖率采集附记：固定副本补齐完整Vditor dist资源，避免编辑器初始化依赖缺失；隔离写作HTTP夹具对显式generate使用确定模型目录，显式modelGovernance及真实模型路径仍沿原契约。完整写作未插桩回归结束，33项中29通过、2失败、2跳过，无仍运行进程；不可将失败运行当作前端覆盖率通过。三端100%行/95%分支目标保持active。

### 2026-11-10T19:32:00+08:00 写作覆盖率夹具模型目录隔离

局部维护走直接处理：完整写作回归中，沉浸式编辑和GitLab基线漂移两个用例未注入模型目录，意外读取本机加密配置，分别导致生成入口禁用和无法触发既有409对照。为这两个非真实模型用例注入会拒绝意外调用的生成器，沿共享HTTP夹具提供确定模型目录；保留原有启用、编辑回读、基线漂移和默认全文断言，真实模型用例仍使用显式开关。验收先定向两个用例，再完整插桩采集全部前端产品文件，保留原100%行/95%分支阈值。

采集证据加固：前端产品源码清单继续独立核验；另外记录本次前端服务、后端产品模块、测试/夹具、配置、大纲资源、Vditor静态资源、依赖锁与采集器的运行前后SHA清单。任一输入变化均使本次采集失败，不修改产品覆盖分母。所有子测试无论成功失败都保存完整日志；成功采集同时导出Istanbul HTML和lcov，便于按未覆盖行/分支定位下一批测试。伪代码：`before=manifest(inputs); runAll(); write(json,html,lcov); after=manifest(inputs); assertEqual(before,after)`。

### 2026-11-10T19:36:59+08:00 大纲公开 HTTP 边界补测设计

范围：沿现有隔离真实 HTTP 服务补充只读来源的编辑/发布/删除拒绝、已发布版本恢复冲突、提案参数与重复文档拒绝、提示词旧文件解析/缺失/损坏、选择器兼容和文件导出回读。保持产品源码、覆盖率分母和100/95门禁。仅在fs边界将两个旧版硬编码资源路径精确映射到runtime临时目录；真实解析器、提示词组装和HTTP均执行产品实现，导出内容真实落盘并回读；异常边界恢复spy和元数据。验收比较同一产品SHA、同两套件的定向覆盖率前后结果，再与既有大纲测试合跑，不以定向比例宣称平台达标。

### 2026-11-10T19:39:45+08:00 覆盖率夹具与大纲边界验证进展

写作夹具隔离：两个非模型场景显式注入拒绝意外调用的生成器，使用共享夹具提供的确定模型目录，避免本机加密配置污染；两项定向2/2通过，原断言保留。前端采集器新增运行前后完整输入SHA清单，覆盖后端模块、浏览器夹具、配置、知识大纲、前端静态资源与依赖锁；保留原产品分母，输入变化即失败；各子测试无论成功失败都保存日志，完整成功时额外生成Istanbul HTML和lcov。完整固定副本采集尚在运行，未宣称通过。

大纲新增7项真实HTTP测试，验证只读保护、恢复冲突、提案无效参数/重复文档、只读旧资源过滤与错误降级、旧版文件缺失/损坏、提示词导出真实回读和选择器兼容。旧版两个资源位置和导出位置在fs边界精确映射至runtime，保留真实产品解析器与组装器，无产品目录产物。两套件51/51通过；outline.js定向行489/528（92.61%）、分支532/668（79.64%），此前同两套件为457/528、487/668。模块仍未达100/95；全平台覆盖率另以稳定全量采集验收。证据runtime/test-results/outline-route-after-20261110。

### 2026-11-10T19:41:36+08:00 大纲补测第二批

依据7套件稳定结果剩余缺口，补充历史顶层parts/chapters的知识点计数、幂等回放、JSON正文字符串、预检失败状态、发布替代旧版本、缺失/非法手册配置与导出落盘错误。仍走真实HTTP，故障仅在精确fs导出边界注入，检查失败响应与后续恢复。

### 2026-11-10T19:43:37+08:00 大纲剩余行边界

最后5个未覆盖行对应首次上传目录初始化、旧上传入口410、提案与导入锁冲突、回收站损坏读取。通过runtime真实目录缺失、损坏XLSX和持有锁文件验证；不模拟路由返回或修改产品分支。锁冲突必须拒绝写入，解除锁后重试成功；失效旧入口明确返回410。

### 2026-11-10T19:44:07+08:00 前端完整稳定采集结果

固定副本frontend-goal-final-20261110f完整成功，退出0，completed/stable/inputsStable均true，changedFiles/changedInputs均为空。57个前端产品文件，主导航45文件、写作31份计数、任务管理16页、我的工作8份、手册往返5份、平台6份、审核16份，所有原有硬计数核验通过。行8558/10272（83.31%）、分支9743/14026（69.46%），仍未达到100/95。保留固定副本身份，不能当作当前工作区最终验收。证据：runtime/test-results/coverage-snapshots/20261110-183123/runtime/test-results/frontend-goal-final-20261110f/coverage-summary.json、source-stability.json、html/index.html、lcov.info及各子场景日志。此前source-stability=false结果继续仅诊断，不混合比较百分比。

### 2026-11-10T19:44:26+08:00 大纲补测本轮验收

新增16项测试，7套件160/160通过，产品与测试SHA前后一致，退出0。outline.js行528/528（100%）、分支581/668（86.97%）；模块行目标达成，模块分支及全平台目标仍未完成。覆盖真实首次上传目录初始化及坏XLSX清理、旧入口410、存储并发锁拒绝且不覆盖持有者锁、解除锁后重试、元数据损坏回收站失败、历史计数、幂等、版本替代、导出落盘失败与恢复。产品源码未修改；证据runtime/test-results/outline-combined-20261110，含HTML、lcov、原始JSON、完整日志和source-stability.json。后续须以包含这些测试的完整稳定Node采集评估平台分支缺口，不将单模块100%代替平台目标。

## 2026-11-10T19:50:58+08:00 前端 GitLab API 真实 HTTP 契约补测

固定前端报告显示 gitlab-api.js 行46/59、分支20/53，缺口集中于查询默认值、CAS、错误投影及验证响应。新增独立 Node test + Chromium 套件，动态端口 HTTP 服务提供真实产品 ES module 和可控 API 响应；逐项核对公开接口的路径编码、查询参数、写入方法/JSON、幂等键及 If-Match，验证验证结果不完整、HTTP失败、业务失败、坏JSON与恢复信息。只在随机端口夹具处理写请求，不接触共享业务数据；不替换 fetch，不修改产品逻辑。伪代码：`serve(module, apiFixture); importInBrowser(); call(publicMethod); assert(recordedRequest, resultOrError); captureIstanbul()`。采集器追加独立计数并检查固定产品源码归属，不改变原有场景计数或分母。定向覆盖只证明客户端契约；全平台仍需完整稳定三端门禁。

2026-11-10T19:54:52+08:00 扩展手册生产 API 契约矩阵：核对草稿/修订/AI/质量/审核公开端点、上下文强制合并、显式及默认幂等键、401/403事件与来源限制例外、非JSON/坏JSON/错误请求ID。上传使用真实 File、XMLHttpRequest 和随机端口 HTTP，检查原始字节、文件名/类型、进度、业务失败、HTTP失败和真实连接断开恢复；不模拟XHR或fetch。新增3组浏览器计数，与GitLab共8组，采集器必须全部成功并核对计数。

2026-11-10T19:58:25+08:00 当前完整前端采集暴露旧评论表单夹具漂移：产品已统一 data-review-comment-form 并读取 mentions.selectedOptions；采集器仍提交已移除的 data-incremental-comment-form，另缺少mentions控件。按当前真实表单补齐anchor/candidateDigest/mentions字段，检查空提及与选中手册提及序列化和用户提示；保留原有失败重试、相同幂等键和请求次数断言。仅修测试夹具，不恢复旧业务入口或改产品。采集失败副本输入稳定，completed=false，保留诊断，不合并为有效结果。


### 2026-11-10T20:01:35+08:00 增量审核与文档任务客户端 HTTP 契约补测设计

按标准开发由主执行者承担设计、实现和验证。沿现有随机端口 HTTP/Chromium 夹具增加增量审核全部端点、URL 编码与默认查询、默认命令正文、401/403 通知开关、HTTP/业务/坏 JSON 错误、失败重试及并发相同命令的幂等键生命周期。文档任务覆盖读取/配置/负责人/分解和真实 File multipart 导入、幂等键、HTTP/业务/坏 JSON 与断线、调用者主动 AbortSignal 中断、浏览器 UUID/随机数组/无 crypto 能力降级。不得替换 fetch/XHR 或直接操作覆盖率计数。伪代码：`browser.import(realModule); publicApi(); assert(server.requests, result, events); fail/retry/succeed; assert(keyReuseThenRenew); upload(File); assert(multipartBytes); abort(signal); assert(error)`。

采集器按实际新增场景数核对每份非空计数并保持原 57 文件分母。运行中的 20261110-195532 固定副本不变；新测试先定向验证，再用新固定副本全量采集，不将旧结果混合成当前验收。


### 2026-11-10T20:07:41+08:00 增量审核/文档任务 API 契约稳定复验

`frontend-api-contracts.node.test.cjs` 由8组扩展至15组，全部通过且源码/测试/锁文件运行前后SHA一致。四模块行201/201、分支215/217；增量审核58/58行、80/80分支；文档任务19/19行、19/19分支；GitLab59/59行、53/53分支；手册生产65/65行、63/65分支。新用例验证全部公开读写端点、默认/编码参数、真实File上传字节、请求中断、通知开关、失败与断线后的同键重试、成功释放和并发相同命令键。浏览器crypto能力降级不替换fetch/XHR。采集器计数门槛同步15，原有其它场景门槛保持。

证据：`runtime/test-results/frontend-task-contracts-20261110-final/`，含run.log、15份计数、source-stability.json、coverage-final.json、coverage-summary.json、html/index.html及lcov.info；复现包装脚本`runtime/test-results/run-frontend-task-contracts-20261110.py`。首跑因错误对象保留undefined属性导致3项严格比较失败，改为序列化错误投影后复验；SHA脚本误将以.js结尾的vendor目录当文件，在启动测试前失败，修为仅对文件哈希。失败产物保留。此为定向模块证据，三端平台100/95目标尚未达成。


### 2026-11-10T20:08:49+08:00 固定前端全量采集与后续副本

20261110-195532副本的frontend-api-full-20261110-v2退出0，completed/stable/inputsStable均true，changedFiles/changedInputs为空。57产品文件、45导航、8 API、31写作、16任务页、8我的工作、5手册往返、6平台、16审核计数完整。行8605/10374（82.94%）、分支9816/14196（69.14%），仍未达标；产品分母相对上一副本变化，不直接以百分比推断增减。证据位于该副本runtime/test-results/frontend-api-full-20261110-v2，包含HTML/lcov/原始JSON和稳定清单。评论夹具已按当前提及字段补齐，失败重试、幂等和正文断言均保留；首次旧夹具失败结果保留。

新增7组API测试未混入旧结果。新固定副本20261110-200838复制4651文件，复制后SHA与主工作区一致，排除runtime、环境文件与依赖目录；依赖链接既有安装。指针runtime/test-results/frontend-task-contracts-20261110-final/snapshot.json。新副本开始15组API的完整前端采集，输出runtime/test-results/frontend-task-api-full-20261110，尚未完成；全平台目标保持active。


### 2026-11-10T20:10:00+08:00 平台 API 客户端剩余契约补测设计

当前完整前端报告中platform-api.js行199/212、分支209/329。沿随机端口真实HTTP和产品ES模块测试，增加平台聚合读取范围/单侧失败、模板/团队/数据库/人员/权限/资产全部公开端点、真实multipart、校验前不发送权限写请求、大纲目录快捷路径及历史列表回退/版本选择、错误码中文投影与服务断线。HTTP夹具增加按请求返回响应，以验证多步目录—手册—详情调用链；不替换浏览器fetch/XHR。伪代码：`replyByUrl(catalog,list,handbooks,detail); call(publicApi); assert(result,orderedRequests); fail(status,code); assert(authEvent,error); upload(File); assert(bytes)`。先定向稳定采集，再纳入固定57文件全量采集；不修改运行中的20261110-200838副本。按标准开发由主执行者完成设计、实现、验证，不启动子Agent。


### 2026-11-10T20:15:51+08:00 平台 API 契约稳定复验

新增7组平台客户端真实HTTP测试，与原15组一起22/22通过，运行前后源码/测试/锁文件SHA一致。platform-api.js行212/212、分支323/329（98.17%），相对此前固定完整报告该文件199/212、209/329，覆盖全部原缺失行及114分支；这是模块证据，不是平台全量结果。五模块定向总行413/413、分支538/546（98.53%）。采集器API硬计数由15同步22，仍核对每份非空计数和原57产品分母。

覆盖模板/团队/数据库/人员/权限/资产公开端点；多步骤大纲目录快捷命中、旧字段兼容、发布版本优先、指定版本、手册失败降级；大纲错误码中文提示与真实socket断线；平台聚合单侧失败隔离；真实multipart字节及导入错误优先级；权限本地无效输入不发请求。夹具按HTTP请求路由响应，未声明请求立即断言失败，不替换fetch/XHR。首跑将null目录响应错误预期为ok，按真实strict响应契约修正为unavailable；产品未改，失败日志保留。

证据：runtime/test-results/frontend-platform-contracts-20261110-final，含22份原始计数、源码稳定清单、日志、HTML、lcov、coverage-final及summary；可重跑包装脚本runtime/test-results/run-frontend-platform-contracts-20261110.py。语法与diff检查通过。运行中的20261110-200838副本未修改，仍只含原15 API场景；其全量结果不能冒充包含新7组测试。下一步以新稳定副本纳入22组全量，并继续app.js主要行为缺口。三端100/95目标尚未完成。


## 2026-11-10T20:19:57+08:00 手册送审确认真实 HTTP 补测设计

按标准开发，由主执行者完成设计、实现及验证。保留公开 DOM click 入口，不导出 app 内部函数。隔离随机端口 HTTP 服务返回共享草稿与审核人数据，浏览器请求经 route.fetch 转发后端响应，禁止业务写入。验证未选文档不发送请求、草稿不存在及送审权限拒绝恢复按钮、有效草稿填充默认/逐篇审核人和路径、审核人为空及 503 错误。每次恢复 UI、路由、DOM 和焦点。伪代码：`click(submit); GET(draft); validate(capabilities); GET(reviewers); assert(dialog, fields, status); close(); restore()`。新增场景纳入固定前端采集，原57产品分母和全部计数门禁保持。

上一固定副本20261110-200838完整采集完成，completed/stable/inputsStable均true，57文件及15 API、45导航、31写作、16任务页、8我的工作、5手册往返、6平台、16审核计数齐全。行8611/10374（83.00%）、分支9845/14196（69.35%）；目标仍未达成。


2026-11-10T20:22:52+08:00 送审确认6/6稳定通过，产品/测试/锁文件运行前后SHA一致，真实HTTP请求只含GET；新增覆盖openHandbookReviewDialog成功、空审核人和失败路径及送审确认事件。与上一固定副本app.js SHA一致：True。定向证据runtime/test-results/handbook-review-selection-stable，含原始计数、HTML、lcov和稳定清单；定向页面覆盖率不代表平台全量。已创建4652文件稳定副本20261110-202219，纳入22 API及6送审场景，完整采集中。保留57文件及原全部场景计数，不改阈值。


2026-11-10T20:24:09+08:00 草稿输入与附件补测设计：真实 textarea input 事件验证本地Markdown、分支、dirty标记、送审选中清除与保存/送审按钮反馈；缺少documentId的输入不污染状态。真实 file input change 触发产品XHR，隔离HTTP后端验证图片、普通附件、503失败后下一文件继续、重复上传与空选择；核对请求原始正文、编码文件名、Content-Type及outlineVersionId/branch，不替换XHR或fetch。恢复DOM/UI/路由，不写共享资源。伪代码：`input(markdown); assert(ui, controls); selectFiles(); POST(isolatedAttachmentApi); assert(attachments, progress, clearedInput)`。


2026-11-10T20:27:24+08:00 草稿输入与附件8/8定向复验通过，source-stability stable=true、exitCode=0。产品syncHandbookMarkdownInput执行3次，uploadFilesIntoHandbookDraft执行5次；真实HTTP记录5次POST，验证原始正文、编码中文文件名、Content-Type回退与分支/版本。证据runtime/test-results/handbook-draft-input-stable，含HTML、lcov、coverage-final、原始用例及SHA清单。语法及diff检查通过。主采集器已增加独立8项门禁；当前活副本只含送审6项，不能将本批定向数据冒充该副本全量。三端目标仍未完成。


## 2026-11-10T20:29:00+08:00 Java GitLab版本映射真实HTTP补测设计

固定Java报告显示PlatformGitLabRepository版本映射新增逻辑及Main对应路由尚未执行。按标准开发，在既有StorageGitLabHttpCheck真实HttpServer上验证创建/读取/列表/修改草稿/启用/禁用/修订替代/EXACT优先ALL解析、无匹配、缺少/非法参数、CAS/状态冲突、更新失败。扩展既有JDBC状态夹具处理新增SQL与绑定参数，并检查审计事件、行版本和父版本状态；不访问共享数据库、不修改产品行为。伪代码：`HTTP(create); HTTP(edit,CAS); HTTP(activate); HTTP(resolve); HTTP(revise); HTTP(activateRevision); assert(parentSuperseded, events); reject(stale, invalid)`。Java固定9产品源文件及100/95门禁保留，先定向真实HTTP再固定完整采集。


### 2026-11-10T20:33:36+08:00 版本映射HTTP生命周期复验与前端完整采集结果

Java StorageGitLabHttpCheck扩展版本映射创建/编辑/启用/禁用/修订替代、EXACT优先ALL解析、非法字段/长度、CAS及更新失败验证，真实本地HTTP复验退出0，核对5条映射和14条审计事件。首次无连接解析测试误预期422，依据connectionId实际查询及HTTP返回修为404 GITLAB_CONNECTION_NOT_FOUND，失败日志保留于runtime/test-results/java-version-mapping-directed/failed-first.log；成功日志run-v2.log。JDBC为内存状态夹具，不声明真实数据库约束验收。

前端固定副本20261110-202219完整采集退出0，completed/stable/inputsStable均true，changedFiles/changedInputs均为空。57产品、45导航、22 API、6送审、31写作、16任务页、8我的工作、5手册往返、6平台、16审核计数齐全；行8647/10374（83.35%）、分支9984/14196（70.32%）。证据副本runtime/test-results/frontend-review-selection-full-20261110，HTML/lcov/原始计数齐全，仍未达100/95。

新固定副本20261110-203258共5425文件稳定复制，分别启动Java版本映射全量和前端含8组草稿输入/附件全量采集，运行期间不修改副本；终态另行核验，不把定向或旧结果作为新全量。


### 2026-11-10T20:35:46+08:00 写作入口采集时序修正

新固定前端采集在已有来源并发编辑场景失败：Markdown页面先挂载，编辑器异步加载失败提示随后覆盖了场景状态；仅等待生成按钮启用不能证明编辑器初始化已结束。测试应先等待富文本模式可用或明确的Markdown回退提示，再触发来源检查，并保留人工修改保护、无AI写请求等断言。只修采集器夹具时序，不更改产品。失败副本20261110-203258保持原样，不作为有效全量；新固定副本复验。


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


## 2026-11-10T22:56:54+08:00 版本映射领域适配器HTTP契约补测设计

继续用户目标：知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。标准开发，由主执行者承担设计、实现和验证。复用真实本地HTTP Worker补齐版本映射列表、解析、新建、更新和启停方法，验证URL编码、操作者、幂等键、乐观锁请求头及无data信封兼容；解析缺失data返回null，并验证不存在/冲突/无效三个业务错误的HTTP状态映射。新建不发送If-Match，更新保留版本号；仅测试隔离回显服务，不触达共享业务。伪代码：公开适配器方法→实际HTTP回显→断言请求与响应契约→定向覆盖→固定副本全量采集。不修改产品规则、覆盖率分母或门槛。专业HTML报告已交付，内部9.5分不代表平台覆盖率达标。


### 2026-11-10T22:57:37+08:00 审核意见固定采集与版本映射定向结果

副本20261110-225337 Node采集退出0，completed/stable=true、changedFiles=[]；154产品文件、169Jest文件，168套件通过、1跳过，2411用例通过、6跳过。行15973/16412=97.32%，分支16133/18957=85.10%。较224925增加30行、44分支。报告：runtime/test-results/coverage-snapshots/20261110-225337/runtime/test-results/node-review-comments-isolated-20261110。system分类未执行，旧失败保留，前端/Java未重采，全平台目标仍active。

版本映射适配器新增9项真实本地HTTP测试，两套91/91通过，验证列表/解析、新建/更新、启停、查询特殊字符、可信actor覆盖、幂等键/版本请求头和三个错误状态；无data解析返回null，其余方法保留原始信封。定向模块覆盖：{"lines": {"total": 157, "covered": 157, "skipped": 0, "pct": 100}, "statements": {"total": 173, "covered": 173, "skipped": 0, "pct": 100}, "functions": {"total": 59, "covered": 59, "skipped": 0, "pct": 100}, "branches": {"total": 243, "covered": 234, "skipped": 0, "pct": 96.29}, "branchesTrue": {"total": 0, "covered": 0, "skipped": 0, "pct": "Unknown"}}。报告runtime/test-results/domain-store-version-mapping-directed；仅为该模块定向证据，准备新固定副本全量纳入。未修改产品代码或覆盖率分母。


### 2026-11-10T23:01:02+08:00 版本映射补测后固定采集结果

副本20261110-225737 Node全量隔离采集退出0，completed/stable=true、changedFiles=[]，154产品文件、169Jest文件，168套件通过、1跳过，2420用例通过、6跳过。覆盖实际计数：{"lines": {"total": 16412, "covered": 15983, "skipped": 0, "pct": 97.38}, "statements": {"total": 20616, "covered": 19350, "skipped": 0, "pct": 93.85}, "functions": {"total": 3800, "covered": 3598, "skipped": 0, "pct": 94.68}, "branches": {"total": 18957, "covered": 16150, "skipped": 0, "pct": 85.19}, "branchesTrue": {"total": 0, "covered": 0, "skipped": 0, "pct": 100}}。证据：runtime/test-results/coverage-snapshots/20261110-225737/runtime/test-results/node-version-mapping-isolated-20261110。本批只增加领域适配器真实HTTP契约测试，未改产品规则。system共享服务分类未执行，历史失败保留，不声明全部分类通过；前端及Java沿用上一有效证据，本轮未重采。全平台行100%、分支95%目标仍未达成，保持active。专业HTML报告及REA验收交付继续有效，内部量表9.5/10，大型报告100ms尚未验收。


## 2026-11-10T23:02:27+08:00 文档任务范围纠偏与发布核对HTTP补测设计

用户完整目标：知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。上一轮新增9项真实HTTP契约并完成固定副本采集，属于progress。当前标准开发，requiredResponsibilities为设计、实现、真实HTTP验证及证据记录，由主执行者承担；未触及审批边界，不启动独立Agent。

固定证据定位document-tasks路由70行及406分支未覆盖，集中于范围纠偏应用、取消及已发布核对。新增隔离runtime文件存储与真实本地HTTP服务，使用可控审核读取端口夹具，验证工单/手册层纠偏、文档恢复与序号、陈旧MR/依赖读取拒绝、取消权限、发布核对三种结论及证据守卫。成功断言持久范围/审计/状态及幂等重放；拒绝断言文件完全不变。伪代码：创建合法已确认任务与审核夹具→POST纠偏→预览影响→以当前摘要确认→GET和磁盘核对；修改版本或MR观测→验证拒绝无写入。通过HTTP验证真实路由/存储，不将注入审核读取夹具视为真实远端MR集成。不得删除覆盖产品、降低门槛或通过忽略指令凑数。


### 2026-11-10T23:07:00+08:00 文档任务定向首轮及补充矩阵

首轮两套88项中87通过、1失败；失败是测试要求JSON存在undefined属性，与JSON序列化契约不符，已删除该错误预期，未修改产品。定向路由行98.14%、分支83.57%。进一步补充范围纠偏输入/权限守卫、手册映射读取失败降级、旧范围版本阻止沿用审核、请求计时头及配置理由校验，均复用真实HTTP和拒绝文件不变验证。scopeSnapshot为未引用内部函数，暂不为覆盖率导出或直接删除，保持产品分母；需后续独立评估其实际用途。


### 2026-11-10T23:07:57+08:00 文档任务纠偏与发布核对定向验证

新增document-tasks-correction-http.test.js，隔离runtime文件和真实本地HTTP。与既有路由测试合计115/115通过（原有37项，本批新增78项），路由定向行641/648=98.91%、分支1167/1352=86.31%、函数273/279=97.84%。证据runtime/test-results/document-task-correction-directed与同名.log。成功断言范围历史/冻结/恢复、稳定编号、审核关联失效、三种发布核对结论及审计；拒绝断言持久文件字节不变。覆盖前述错误预期已修正，不改产品规则；仍有内部未引用scopeSnapshot行与分支未覆盖，不等于平台达标。启动新固定副本全量采集，保持154产品文件及行100%/分支95%原门槛。


### 2026-11-10T23:11:15+08:00 文档任务补测后固定采集收尾

用户完整目标：知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。副本20261110-230757采集退出0，completed/stable=true，changedFiles=[]；154产品文件、170Jest文件，169套件通过、1跳过，2498用例通过、6跳过，151.493秒。行16052/16412=97.80%，分支16382/18957=86.41%，较上一有效副本增加69行、232分支。证据runtime/test-results/coverage-snapshots/20261110-230757/runtime/test-results/node-task-correction-isolated-20261110。system共享服务分类未执行，旧失败保留；前端与Java本批未重采。全平台100/95仍未完成，goal保持active。专业HTML报告REA改进及内部量表9.5分验收继续有效；大型报告100ms尚未验收。


## 2026-11-10T23:12:24+08:00 增量构建并发读取与草稿拒绝契约设计

用户完整目标：知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。前轮固定采集有有效增量，分类progress。本轮标准开发，由主执行者承担设计、实现及真实HTTP验证；未触及人工审批边界。固定lcov显示IncrementalBuildService.readState异步分支未执行。复用隔离内存仓库及真实本地HTTP，增加可控readAsync与writeEpoch：两请求并发共用读取、读取期间写入使旧快照失效并重读、失败释放pending后可重试；断言响应快照独立且错误不泄露内部信息。补充已发布基线无正文拒绝在线评审、move变更集字段/节点/类型校验与草稿版本冲突。伪代码：发出HTTP→等待确定性读取屏障→更改epoch并释放旧读取→返回最新数据；注入拒绝→检查500→恢复读取→GET成功。拒绝写入场景比对仓库整体不变。不改变产品代码、分母或100/95门槛。


### 2026-11-10T23:13:31+08:00 增量异步读取定向验证结果

新增13项真实HTTP测试，增量审核辅助接口套件78/78通过：并发列表/详情仅一次readAsync、epoch变化丢弃旧快照、错误后重试；验证响应隔离和500隐藏内部错误。另覆盖三种基线正文缺失、六种非法操作字段及合法移动/陈旧草稿/幂等重试。拒绝写入时整体仓库不变。证据runtime/test-results/incremental-read-boundaries-directed；本次定向结果不代替平台全量覆盖。准备固定副本重新采集，不改产品与覆盖率门槛。


### 2026-11-10T23:15:25+08:00 定向覆盖率路径纠正

首次定向命令的collectCoverageFrom相对Jest配置根目录解析，生成零产品文件覆盖率；用例78/78通过有效，但零文件覆盖率不作任何达标证据。已将误写tests目录的报告移入runtime/test-results/incremental-read-boundaries-directed保留。改用../../../packages/...源码路径和绝对coverageDirectory重新采集，78/78仍通过，所选模块定向行419/783=53.51%、分支492/1173=41.94%，证据runtime/test-results/incremental-read-boundaries-directed-valid及.log；本套只执行所选服务路径，不代表模块全量。固定副本全量使用原有配置，不受该命令错误影响，进程仍活跃。


### 2026-11-10T23:17:06+08:00 增量读取补测后固定全量结果

副本20261110-231331退出0，completed/stable=true、changedFiles=[]，154产品文件、170Jest文件。Test Suites: 1 skipped, 169 passed, 169 of 170 total；Tests:       6 skipped, 2511 passed, 2517 total；Time:        175.276 s。行16063/16412=97.87%，分支16398/18957=86.5%。较上一有效副本增加11行、16分支。证据runtime/test-results/coverage-snapshots/20261110-231331/runtime/test-results/node-incremental-read-isolated-20261110。本批新增13项真实HTTP测试，未改变产品与覆盖率分母。system共享服务分类未执行，旧失败保留；前端/Java未重采。用户完整目标为知识中心管理平台行覆盖率100%、分支覆盖率95%，当前三个运行时仍有缺口，goal保持active。


## 2026-11-10T23:17:43+08:00 审核范围与改派HTTP边界补测设计

用户完整目标：知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。上轮有效增量属于progress。标准开发，主执行者承担设计、实施、验证；未触及审批边界。复用review-workbench真实本地HTTP与隔离内存仓库，验证普通增量任务的目标文档/路径匹配，手册审核改派缺审核记录、已决定、陈旧候选、文档失配等拒绝，以及成功改派的去重、审计与幂等。伪代码：准备独立任务→GET bootstrap指定文档/路径或PUT改派→断言状态及错误→比对拒绝时仓库不变；成功则核对新审核人、历史人员、审计及重放。每项finally删除夹具，维持既有产品分母，不改业务规则。


### 2026-11-10T23:19:56+08:00 审核人改派真实HTTP补测

新增12项，review-workbench-contract整套35/35通过。覆盖缺审核/无手册来源、任务或审核已完成、请求或审核候选过期、文档缺失或无逐篇记录、空/非数组/非法审核人，拒绝后比对整体仓库不变；成功验证人员规范化、候选不变、审计及幂等重放。定向日志runtime/test-results/review-reassignment-directed.log。首次夹具将中文直接写入HTTP头被fetch拒绝，已编码幂等键后复测通过；不修改产品规则。普通任务文档/路径矩阵已有测试，未重复新增。准备固定副本全量采集。用户完整目标：知识中心管理平台行覆盖率100%、分支覆盖率95%，目标保持active。


### 2026-11-10T23:22:38+08:00 审核改派补测后固定全量结果

副本20261110-231956采集退出0，completed/stable=true，changedFiles=[]，154产品文件、170Jest文件。Test Suites: 1 skipped, 169 passed, 169 of 170 total；Tests:       6 skipped, 2523 passed, 2529 total；Time:        142.922 s。行16063/16412=97.87%，分支16405/18957=86.53%。证据runtime/test-results/coverage-snapshots/20261110-231956/runtime/test-results/node-reassignment-isolated-20261110。新增12项真实HTTP测试，不改变产品、分母或100/95门槛。system共享服务分类未执行，旧失败保留；前端与Java未重采。用户完整目标：知识中心管理平台行覆盖率100%、分支覆盖率95%，尚未达成，goal保持active。


## 2026-11-10T23:24:35+08:00 Java记录存储故障响应契约设计

用户完整目标：知识中心管理平台行覆盖率100%、分支覆盖率95%。上一轮为progress，新增12项真实HTTP、Node增加7个分支。本轮标准开发，主执行者设计、实施和验证，不触及审批边界。复用StorageRecordHttpCheck的随机端口真实HTTP与隔离JDBC状态机，注入数据库大纲生命周期拒绝及一般SQL故障。伪代码：记录持久状态/提交与回滚计数→PUT合法记录且JDBC抛指定错误→校验409或503及错误码、请求标识→核对状态不变并发生回滚→恢复驱动GET确认可重试。既有通用读取故障测试保留，不改产品代码、分母或覆盖门槛。


### 2026-11-10T23:25:59+08:00 Java记录拒绝响应固定全量验证结果

新增三种真实HTTP数据库故障场景，大纲已删除/不存在返回409，一般SQL故障返回503且不泄露内部详情；验证请求标识、回滚、记录正文/摘要/版本/删除标识不变及恢复后GET成功。固定副本20261110-232435全量采集退出0，9源文件，源码及测试稳定性见runtime/test-results/coverage-snapshots/20261110-232435/runtime/test-results/java-record-rejection-full-20261110/source-stability.json。行3457/3485=99.20%，分支2047/2322=88.16%，较前次增加1行、2分支。所有既有采集场景通过，未改变产品或分母。证据runtime/test-results/coverage-snapshots/20261110-232435/runtime/test-results/java-record-rejection-full-20261110/java.xml与html/index.html。用户完整目标：知识中心管理平台行覆盖率100%、分支覆盖率95%，当前仍未达成，goal保持active。Node最近行97.87%、分支86.53%，前端最近行83.96%、分支70.64%，本批未重采。


## 2026-11-10T23:27:33+08:00 GitLab读取网关补测设计

用户完整目标：知识中心管理平台行覆盖率100%、分支覆盖率95%。前轮Java新增三种HTTP故障场景，属于progress。本轮标准开发，主执行者负责设计、实施及验证，未触及审批边界。复用gitlab-api-http真实前端HTTP与随机端口上游GitLab夹具，补管理员直读tree/file的默认与显式路径、普通读者拒绝、手册commit投影、service-account访问状态及OAuth入口拒绝、未知路由404。上游记录请求，验证查询参数与token只在上游可见。伪代码：真实配置连接及映射→读取API→断言状态/数据/上游参数/凭据隐藏。保持全部产品分母与100/95门槛。


### 2026-11-10T23:29:05+08:00 GitLab读取网关定向验证结果

新增6项真实HTTP测试，gitlab-api-http整套22/22通过。覆盖管理员目录/文件默认和显式参数、读者403且不请求上游、提交历史字段投影、服务账号OAuth拒绝及状态凭据隐藏、未知路由404；另验证个人OAuth默认/显式returnTo重定向与连接禁用状态，finally恢复原手册映射。日志runtime/test-results/gitlab-read-gateway-directed.log。用户完整目标为知识中心管理平台行覆盖率100%、分支覆盖率95%，尚未达成；准备固定副本全量采集，保持产品分母及门槛。


### 2026-11-10T23:30:14+08:00 文件读取工具边界测试设计

用户完整目标：知识中心管理平台行覆盖率100%、分支覆盖率95%。标准开发由主执行者设计、实施及验证。针对FileReader现有缺口补充隔离临时目录内的递归列表、目录不存在、显式编码、空批次及默认运行目录/仓库回退路径解析。仅验证真实文件系统工具，无后端行为修改，不需新增API。伪代码：建立多层文件→递归扫描核对条目类型与路径→编码读取核对字节长度与mtime→缺目录拒绝→不存在主目录时解析已有仓库文件。保持产品分母及覆盖率门槛。


### 2026-11-10T23:30:37+08:00 文件读取边界定向验证结果

新增4项，tools.test整套26/26通过。真实文件系统验证递归目录与类型、普通列表过滤目录、目录缺失、空批次、UTF-16编码与字节大小/mtime、批次部分失败、默认运行路径及仓库回退读取。证据runtime/test-results/file-reader-boundaries-directed.log。产品未修改，当前运行中的GitLab固定副本不含这4项，后续单独采集。用户完整目标：行100%、分支95%，尚未达成。


### 2026-11-10T23:32:00+08:00 GitLab补测后固定全量结果

固定副本20261110-232905全量退出0，154产品文件、170Jest文件，169套件通过/1跳过，2529用例通过/6跳过，142.279秒。stable=true，changedFiles=[]。行16083/16412=97.99%，分支16428/18957=86.65%。证据runtime/test-results/coverage-snapshots/20261110-232905/runtime/test-results/node-gitlab-read-isolated-20261110。本次不含随后新增的4项文件读取边界测试；其所在套件定向26/26通过。system共享服务分类未执行，旧失败保留。未改变产品分母与门槛；用户完整目标为行100%、分支95%，尚未达成。


### 2026-11-10T23:32:16+08:00 文件读取工具覆盖率验证

定向执行tools.test.js，26/26通过，产品FileReader真实覆盖率行43/43=100%、分支21/21=100%、函数8/8=100%。证据runtime/test-results/file-reader-boundaries-coverage/coverage-summary.json及html/index.html。仅为单模块证据，不代替平台全量，不与不同运行时合并计算达标。最近Node固定全量行97.99%、分支86.65%；Java行99.20%、分支88.16%；前端行83.96%、分支70.64%，用户完整目标行100%、分支95%仍未达成，goal保持active。


### 2026-11-10T23:33:11+08:00 数据库统一配置解析边界补测设计

数据库配置解析公开契约使用临时配置目录覆盖文件缺失/格式错误、CRLF/注释/export/单双引号、环境覆盖及数值转换、敏感字段递归检查。新增独立 Jest 契约入口，直接插桩生产模块，避免依赖慢速 node:test 桥的其他契约。


### 2026-11-10T23:34:45+08:00 数据库配置边界定向验证结果

新增4项数据库配置测试，native-contract桥整套93通过/5跳过，80.639秒，退出0。覆盖配置必须存在、非法行拒绝、CRLF/注释/export/引号、完整字段映射、环境空值与数值0、嵌套数组和大小写敏感键。修复原有临时目录未清理的测试夹具，不修改产品。证据runtime/test-results/database-config-boundaries-directed.log。准备固定副本全量纳入本批与FileReader四项；用户完整目标：行100%、分支95%，尚未达成。


### 2026-11-10T23:37:55+08:00 配置与文件读取补测固定全量结果

固定副本20261110-233445完成，退出0，154产品文件、170Jest文件，stable=true、changedFiles=[]。Test Suites: 1 skipped, 169 passed, 169 of 170 total; Tests:       6 skipped, 2537 passed, 2543 total; Time:        170.469 s。行16090/16412=98.03%，分支16440/18957=86.72%。证据runtime/test-results/coverage-snapshots/20261110-233445/runtime/test-results/node-config-boundaries-isolated-20261110。本次纳入数据库配置4项及FileReader4项；未改产品或覆盖分母。system共享服务分类未执行，旧失败保留。用户完整目标行100%、分支95%，当前仍未达成，goal保持active。


### 2026-11-10T23:38:14+08:00 资料加工网关白名单校验补测设计

用户完整目标：知识中心管理平台行覆盖率100%、分支覆盖率95%。上一轮Node补测后全量行98.03%、分支86.72%，属于progress。本轮标准开发，主执行者设计实施及验证。针对版本化端点映射加载器补测无端点、非法/重复id、非法method/path/operation/action及expose=false；通过隔离模块和仅替换映射文件读取夹具注入配置，避免修改真实契约文件。伪代码：构造单端点最小契约→加载模块→非法声明应抛具体错误；合法声明冻结且隐藏端点不可匹配。后端验证复用cleaning API真实HTTP套件，产品不变，分母不变。


### 2026-11-10T23:39:25+08:00 资料加工白名单定向覆盖验证

新增15项，契约与客户端套件24/24通过。白名单模块行31/31=100%、分支39/39=100%，证据runtime/test-results/cleaning-mapping-boundaries。注意cleaning-api-contract仅静态契约检查，不能算真实HTTP；另执行frontend-gateway-http-coverage及knowledge-center-context-boundaries-http真实HTTP测试验证代理与路由拒绝。保持真实契约文件不变，所有读取替换finally恢复。用户完整目标行100%、分支95%，尚未完成，准备固定副本全量。


### 2026-11-10T23:42:31+08:00 白名单校验补测固定全量结果

新增15项，定向契约24/24及真实HTTP23/23通过。固定副本20261110-233925全量退出0，154产品文件、170Jest文件，stable=true、changedFiles=[]。Test Suites: 1 skipped, 169 passed, 169 of 170 total; Tests:       6 skipped, 2552 passed, 2558 total; Time:        167.594 s。行16096/16412=98.07%，分支16453/18957=86.79%。证据runtime/test-results/coverage-snapshots/20261110-233925/runtime/test-results/node-cleaning-mapping-isolated-20261110。白名单模块定向行31/31与分支39/39双100%。未改产品、真实契约文件或分母；system共享服务分类未执行，旧失败保留。用户完整目标：知识中心管理平台行100%、分支95%，尚未达成，goal保持active。


### 2026-11-10T23:43:34+08:00 大纲仓储恢复与事务边界补测设计

用户完整目标：知识中心管理平台行覆盖率100%、分支覆盖率95%。上一轮新增15项白名单测试并全量验证，属于progress。本轮标准开发，主执行者设计实施验证。使用隔离临时目录验证无文件、非数组outlines、损坏主文件恢复备份及无备份报错、写入备份、锁冲突拒绝、异常后解锁、append去重及幂等信息合并；数据库update使用领域存储边界夹具验证快照克隆及过滤，并复用真实HTTP大纲数据库投影套件。不得改变产品或分母。伪代码：建隔离仓储→写旧数据→触发损坏/冲突/失败→核对旧数据与锁→恢复后成功写入。


### 2026-11-10T23:44:46+08:00 大纲仓储补测验证结果

新增11项仓储/快照测试，与真实HTTP大纲数据库投影套件共38/38通过。定向模块行64/64=100%、分支51/52=98.07%，证据runtime/test-results/outline-repository-boundaries。覆盖恢复备份、损坏报错、锁冲突与失败解锁、旧快照备份、追加去重/幂等、数据库克隆及过滤、递归目录。首次test.each数组被Jest展开导致两项夹具断言错误，改为对象行后复测通过，未修改产品。用户完整目标行100%、分支95%，尚未达成，准备固定副本全量。


### 2026-11-10T23:48:03+08:00 大纲仓储补测固定全量结果

固定副本20261110-234446全量退出0，154产品文件、170Jest文件，stable=true、changedFiles=[]。Test Suites: 1 skipped, 169 passed, 169 of 170 total; Tests:       6 skipped, 2563 passed, 2569 total; Time:        175.216 s。行16103/16412=98.11%，分支16472/18957=86.89%。证据runtime/test-results/coverage-snapshots/20261110-234446/runtime/test-results/node-outline-recovery-isolated-20261110。新增11项大纲仓储测试，与真实HTTP投影套件定向38/38通过，模块行64/64=100%、分支51/52=98.07%。未修改产品或分母；system共享服务分类未执行，旧失败保留。用户完整目标：知识中心管理平台行100%、分支95%，尚未完成，goal保持active。


### 2026-11-10T23:49:12+08:00 文档接口错误恢复补测设计

用户完整目标：知识中心管理平台行覆盖率100%、分支覆盖率95%。上一轮大纲补测与完整采集属于progress。本轮标准开发，主执行者设计实施验证。复用document-route真实HTTP隔离服务，补评论结构非法、生成模型异常、预处理列表/删除/版本元数据访问错误、非法上传后恢复。通过针对隔离路径的文件系统故障注入或模型夹具，不改变产品。伪代码：记录隔离持久数据→注入故障→真实HTTP断言500/错误响应→恢复→请求成功并验证数据。保持全产品分母。


### 2026-11-10T23:50:36+08:00 文档接口错误恢复验证结果

用户完整目标：知识中心管理平台行覆盖率100%、分支覆盖率95%。新增6项真实HTTP测试，当前document-route套件27/27通过，证据runtime/test-results/document-error-recovery-directed.log。覆盖三种非法评论结构且保留原始字节、模型返回异常不落文件并可重试、版本索引损坏恢复、预处理删除失败保留元数据并恢复成功。元数据读取器会吞并文件错误返回空投影，故已移除无法命中路由异常的临时列表故障用例；本批未新增非法上传场景。未改产品与分母，准备固定副本全量采集，目标尚未达成。


### 2026-11-10T23:53:32+08:00 文档错误恢复固定全量结果

用户完整目标：知识中心管理平台行100%、分支95%。固定副本20261110-235036，154产品文件、170Jest文件，退出0，stable=true、changedFiles=[]。Test Suites: 1 skipped, 169 passed, 169 of 170 total
Tests:       6 skipped, 2569 passed, 2575 total
Time:        141.241 s。行16108/16412=98.14%，分支16475/18957=86.9%。新增6项文档真实HTTP场景，定向27/27通过。证据runtime/test-results/coverage-snapshots/20261110-235036/runtime/test-results/node-document-recovery-isolated-20261110。未改产品与分母；system共享服务分类未执行，旧失败保留。整体覆盖率目标尚未达成，goal保持active。


### 2026-11-10T23:54:38+08:00 基础Agent执行契约补测设计

用户完整目标：知识中心管理平台行覆盖率100%、分支覆盖率95%。上一轮文档错误恢复为有效进展。本轮标准开发，主执行者承担设计、实施、验证；不修改产品与分母。补基础Agent默认抽象契约、企业品牌及资源存在/缺失边界、实际LLM HTTP请求的Markdown与JSON路由、步骤参数覆盖、失败事件与重试恢复。使用隔离端口和runtime临时资源，finally恢复全局上下文。伪代码：创建本地模型HTTP服务→执行真实Agent流水线→断言请求参数/输出/事件→注入401→验证失败后恢复。


### 2026-11-10T23:55:38+08:00 基础Agent执行契约补测结果

用户完整目标：知识中心管理平台行100%、分支95%。新增base-agent-coverage.test.js五项全部通过，真实本地模型HTTP验证Markdown/JSON参数、认证失败分类及恢复；覆盖抽象契约、品牌回退、注册资源读取与缺失恢复。模块定向行56/56=100%、分支39/48=81.25%。证据runtime/test-results/base-agent-directed.log及base-agent-boundaries/coverage-summary.json。首次失败断言错误要求泄露上游错误原文，现按已有标准错误与providerCode契约修正。未修改产品。最新全量仍为文档恢复固定副本98.14%/86.90%，本批尚未采集全量，不据此宣称平台达标。


### 2026-11-10T23:56:18+08:00 网页引用传输边界补测设计

用户完整目标：知识中心管理平台行100%、分支95%。本轮标准开发，主执行者设计实施验证。新增真实本地HTTP传输测试，公共域DNS检查与已核验连接使用既有注入接口，验证压缩格式、编码拒绝、状态失败、重定向限额、字符集错误、正文空与超限、DNS空与超时。产品不改、分母不减。伪代码：启动隔离端口→不同响应→readWebReference真实HTTP→断言提取或错误码→恢复正常读取。


### 2026-11-10T23:57:29+08:00 网页引用传输补测结果

用户完整目标：知识中心管理平台行100%、分支95%。新增web-reference-transport.test.js共11项真实HTTP测试全部通过，证据runtime/test-results/web-reference-transport-directed.log。验证deflate/br/identity解码、503、未知传输编码及字符集、空HTML与缺失类型、缺重定向位置与零跳转限额、流式/原文/提取正文大小、无效URL/空DNS/解析超时与正常读取恢复。连接通过既有receive边界转到隔离HTTP服务，未连接外网、未修改产品与分母。本批尚待固定全量采集。


### 2026-11-10T23:58:34+08:00 基础Agent固定全量结果

用户完整目标：知识中心管理平台行100%、分支95%。固定副本20261110-235538退出0，154产品、171Jest文件，stable=true、changedFiles=[]。Test Suites: 1 skipped, 170 passed, 170 of 171 total; Tests:       6 skipped, 2574 passed, 2580 total; Time:        146.732 s。行16115/16412=98.19%，分支16484/18957=86.95%。证据runtime/test-results/coverage-snapshots/20261110-235538/runtime/test-results/node-base-agent-isolated-20261110。未改变产品或分母；system共享服务分类未执行，旧失败保留。网页传输新增11项未包含在本副本。整体目标尚未达成，goal保持active。


### 2026-11-11T00:00:09+08:00 模板存储列表与恢复边界补测设计

用户完整目标：知识中心管理平台行100%、分支95%。本轮标准开发，主执行者设计实施验证。针对模板存储同步/异步列表筛选、摘要缓存隔离与失效、缺失历史/恢复草稿/导入默认值、错误版本拒绝后状态不变补领域测试，复用template-persistence-http真实后端API验证文件持久化。使用事务快照夹具，禁止减少产品分母或改业务规则。伪代码：构造快照→筛选及读取→修改返回副本→验证缓存不污染→写入失效→版本拒绝与恢复→真实HTTP回归。


### 2026-11-11T00:02:25+08:00 网页传输全量与模板存储定向结果

用户完整目标：知识中心管理平台行100%、分支95%。网页传输固定副本20261110-235834全量退出0，154产品、172Jest文件，stable=true、changedFiles=[]；171套件通过、1跳过，2585测试通过、6跳过，170.261秒。行16117/16412=98.2%，分支16495/18957=87.01%。证据runtime/test-results/coverage-snapshots/20261110-235834/runtime/test-results/node-web-transport-isolated-20261110。本轮模板存储新增8项，与真实HTTP文件持久化共10/10通过；定向模块行109/109=100%，分支182/190=95.78%。证据runtime/test-results/template-store-directed.log及template-store-boundaries。未修改产品或分母；system共享服务分类未执行，旧失败保留。模板新增尚待固定全量，整体目标未达到，goal保持active。


### 2026-11-11T00:03:47+08:00 聚合存储读写投影补测设计

用户完整目标：知识中心管理平台行100%、分支95%。本轮标准开发，主执行者实施验证，新增真实HTTP验证草稿旧版投影、删除快照、缺失记录、错误响应默认与详细信息、异步事务成功、文件原子写失败临时文件清理与重试恢复。保持产品与分母不变，运行集中runtime。伪代码：隔离存储→响应成功/删除/错误→验证快照与状态→恢复正常→重试。


### 2026-11-11T00:05:19+08:00 聚合存储投影补测结果

用户完整目标：知识中心管理平台行100%、分支95%。新增4项测试，aggregate-store-boundaries-http共13/13通过，证据runtime/test-results/aggregate-projections-directed.log。真实HTTP覆盖草稿旧聚合/新投影、缺失草稿、删除/缺失记录空快照、默认与详细错误映射、异步事务版本条件；文件注入rename失败验证原子清理、旧数据保留与恢复。未改产品或分母，待下一固定全量采集。


### 2026-11-11T00:05:53+08:00 模板存储固定全量结果

用户完整目标：知识中心管理平台行100%、分支95%。固定副本20261111-000225退出0，154产品、173Jest文件，stable=true、changedFiles=[]。Test Suites: 1 skipped, 172 passed, 172 of 173 total; Tests:       6 skipped, 2593 passed, 2599 total; Time:        175.812 s。行16121/16412=98.22%，分支16542/18957=87.26%。证据runtime/test-results/coverage-snapshots/20261111-000225/runtime/test-results/node-template-store-isolated-20261111。未改产品或分母，system共享服务分类未执行，旧失败保留。聚合存储新增4项未包含于该固定副本。整体目标尚未达到，goal保持active。


### 2026-11-11T00:07:13+08:00 增量审核自动选中补测设计

用户完整目标：知识中心管理平台行100%、分支95%。本轮标准开发，主执行者验证审核bootstrap在有待审核任务时默认选择可读任务、显式view保留列表、无任务时返回发布基线及未知文档拒绝；沿用真实HTTP任务创建审核闭环与同快照服务投影，产品与分母不变。


### 2026-11-11T00:08:34+08:00 增量审核自动选中补测结果

用户完整目标：知识中心管理平台行100%、分支95%。incremental-build-api定向22/22通过，新用例通过真实HTTP创建及审核候选后，验证同快照reviewBootstrap默认选中已批准可读任务、显式列表保留基线、未知文档拒绝和正确文档读取。证据runtime/test-results/incremental-bootstrap-directed.log。产品及覆盖率分母未变，尚待固定全量采集，整体目标仍未完成。


### 2026-11-11T00:08:57+08:00 聚合存储固定全量结果

用户完整目标：知识中心管理平台行100%、分支95%。固定副本20261111-000553退出0，154产品、173Jest文件，stable=true、changedFiles=[]；172套件通过、1跳过，2597用例通过、6跳过，149.565秒。行16124/16412=98.24%，分支16557/18957=87.33%。证据runtime/test-results/coverage-snapshots/20261111-000553/runtime/test-results/node-aggregate-projections-isolated-20261111。system共享服务分类未执行，旧失败保留；未改变产品和分母，整体目标仍未达成。


### 2026-11-11T00:11:58+08:00 增量审核固定全量结果

用户完整目标：知识中心管理平台行100%、分支95%。固定副本20261111-000834退出0，154产品、173Jest文件，stable=true、changedFiles=[]；172套件通过、1跳过，2598用例通过、6跳过，160.583秒。行16127/16412=98.26%，分支16561/18957=87.36%。证据runtime/test-results/coverage-snapshots/20261111-000834/runtime/test-results/node-incremental-bootstrap-isolated-20261111。system共享服务分类未执行，旧失败保留；未改变产品和分母，整体目标仍未达成。


### 2026-11-11T00:12:58+08:00 平台配置Schema边界补测设计

用户完整目标：知识中心管理平台行100%、分支95%。本批标准开发，由主执行者设计实施验证，针对既有Schema校验器补充有限数值、布尔类型、Unicode长度、唯一数组项、附加字段Schema与JSON Pointer转义的正反例；不扩展Schema支持范围或修改产品规则。验收以明确错误码、路径、恢复后空错误列表为准。伪代码：定义局部契约→校验有效/无效数据→断言精确错误列表→复用同契约验证修正输入。


### 2026-11-11T00:13:50+08:00 AI流式预览边界补测设计

用户完整目标：知识中心管理平台行100%、分支95%。补充纯转换函数previewMarkdown的JSON分片、Unicode转义、截断转义、非法转义、嵌套字段与代码围栏场景，保证仅提取顶层markdown且不泄露provenance。验收以明确预览字符串断言，纯函数无需后端请求；不修改产品规则。


### 2026-11-11T00:14:10+08:00 Schema与流式预览定向结果

用户完整目标：知识中心管理平台行100%、分支95%。新增schema-validator-boundaries共6项，与既有平台契约共19/19通过；模块行48/48=100%、分支88/90=97.77%。新增production-ai-preview-boundaries共13/13通过，模块行36/36=100%、分支42/42=100%。分别验证类型/Unicode长度/唯一数组/附加字段与路径转义，以及顶层正文/嵌套来源隔离/完整与截断转义/损坏输入。证据runtime/test-results/schema-validator-directed.log和production-preview-directed.log及对应coverage-summary.json。纯函数校验无需后端请求，未改产品与分母，尚待固定全量；整体目标仍未达成。


### 2026-11-11T00:15:20+08:00 步骤执行器异常与输入边界补测设计

用户完整目标：知识中心管理平台行100%、分支95%。针对步骤执行器新增不存在Agent、执行异常传播与重试恢复、详情回调传递、旧别名、缺少步骤标识和空前序值的输入转换测试；使用局部Agent接口对象，避免全局模拟污染。模块不涉及后端API，纯执行协议验证。产品和覆盖率分母不变。


### 2026-11-11T00:15:46+08:00 步骤执行器定向结果

用户完整目标：知识中心管理平台行100%、分支95%。step-executor新增3项，13/13通过，模块行34/34=100%、分支35/35=100%。验证缺失Agent拒绝与恢复、详情回调、旧别名、执行错误原样传播、空及非包装前序值；局部接口对象不污染全局，纯执行协议无需后端API。证据runtime/test-results/step-executor-directed.log及step-executor-directed/coverage-summary.json。当前固定副本20261111-001410未包含本次新增，待下一固定全量，目标仍未完成。


### 2026-11-11T00:17:33+08:00 Schema与预览固定全量结果

用户完整目标：知识中心管理平台行100%、分支95%。固定副本20261111-001410退出0，154产品、175Jest文件，stable=true、changedFiles=[]。Test Suites: 1 skipped, 174 passed, 174 of 175 total；Tests:       6 skipped, 2617 passed, 2623 total；Time:        166.462 s。行16136/16412=98.31%，分支16598/18957=87.55%。证据runtime/test-results/coverage-snapshots/20261111-001410/runtime/test-results/node-schema-preview-isolated-20261111。步骤执行器新增3项尚未包含；system共享服务分类未执行，旧失败保留；未改变产品及分母。整体目标仍未完成。


### 2026-11-11T00:21:33+08:00 步骤执行器固定全量结果

用户完整目标：知识中心管理平台行100%、分支95%。固定副本20261111-001733退出0，154产品、175Jest文件，stable=true、changedFiles=[]。Test Suites: 1 skipped, 174 passed, 174 of 175 total；Tests:       6 skipped, 2620 passed, 2626 total；Time:        173.914 s。行16140/16412=98.34%，分支16603/18957=87.58%。证据runtime/test-results/coverage-snapshots/20261111-001733/runtime/test-results/node-step-executor-isolated-20261111。system共享服务分类未执行，旧失败保留；未改变产品及分母。Java与前端本批未重新采集，整体目标仍未完成，goal保持active。


### 2026-11-11T00:24:32+08:00 审核范围阻断与大纲导入边界补测设计

用户完整目标：知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。本批采用标准开发，由主执行者补测和验证。沿用已补充的审核决定真实HTTP用例，验证reported范围阻断409、不调用审核服务，以及取消范围变更后恢复转发；大纲导入补充多余列、仅说明无路径、超长名称、Markdown作为父目录及空模板，断言结构化错误定位和恢复后合法输入。产品规则和覆盖率分母不变。验收：定向测试通过，固定副本全量复采并核查源码稳定性。


### 2026-11-11T00:25:04+08:00 审核范围阻断与大纲导入定向结果

用户完整目标：知识中心管理平台行100%、分支95%。两套件39/39通过（新增大纲6项，审核决定阻断/解除恢复1项），真实HTTP验证reported范围拒绝409且不转发、取消后恢复200。大纲模块行82/82=100%，分支80/83=96.38%。证据runtime/test-results/review-outline-directed.log及review-outline-directed/coverage-summary.json。产品与分母未变，接下来固定全量复采；定向主路由覆盖率不代表全量结果，整体目标尚未完成。


### 2026-11-11T00:28:26+08:00 审核与大纲固定全量结果

用户完整目标：知识中心管理平台行100%、分支95%。固定副本20261111-002504退出0，154产品、175Jest文件，stable=true、changedFiles=[]。174套件通过、1跳过；2626用例通过、6跳过，147.712秒。行16144/16412=98.36%，分支16609/18957=87.61%；相比上一固定结果增加4行、6分支。证据runtime/test-results/coverage-snapshots/20261111-002504/runtime/test-results/node-review-outline-isolated-20261111，含HTML index.html、LCOV、汇总与稳定性清单。审核阻断用例已在上次固定结果中包含，实际全量用例增量为大纲6项。system共享服务分类未执行，历史失败保留，Java和前端本批未复采。未改变产品及分母，整体目标仍未达到，goal保持active。


### 2026-11-11T00:29:07+08:00 认证网关传输与转发补测设计

用户完整目标：知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。上一轮属于有效进展。本轮标准开发，由主执行者验证已有网关契约，不修改产品与覆盖率分母。启动本机临时认证上游和真实网关HTTP服务器，覆盖会话有效/非200/空正文/错误JSON/断连/超时，以及插件缺失时认证和权限代理分流、插件URL重写恢复和异步错误输出。伪代码：临时文件配置→启动上游→真实请求网关→核对状态、上下文ID及下游调用→恢复上游成功→关闭连接并移除runtime夹具。验收以定向HTTP断言和固定全量采集为准。


### 2026-11-11T00:30:17+08:00 认证网关传输定向结果

用户完整目标：知识中心管理平台行100%、分支95%。新增knowledge-center-auth-transport-http共14/14通过。真实HTTP验证有效会话Cookie转发、上游非200/空正文/null/错误JSON/断连/超时拒绝业务及恢复成功，无插件代理分流，权限插件重写URL后恢复，异步失败结构化输出及非法状态回退。夹具均在runtime隔离且关闭连接后清理。证据runtime/test-results/auth-transport-directed.log。未改产品与分母，准备固定副本全量复采，整体目标仍未完成。


### 2026-11-11T00:33:25+08:00 认证网关固定全量结果

用户完整目标：知识中心管理平台行100%、分支95%。固定副本20261111-003017退出0，154产品、176Jest文件，stable=true、changedFiles=[]。175套件通过、1跳过；2640用例通过、6跳过，167.275秒。行16149/16412=98.39%，分支16617/18957=87.65%，比上一固定全量增加5行、8分支。证据runtime/test-results/coverage-snapshots/20261111-003017/runtime/test-results/node-auth-transport-isolated-20261111，包含HTML index.html、LCOV、汇总、测试日志和稳定性清单。system共享服务分类未运行，历史失败保留，Java和前端本批未重采。未改产品和分母，整体目标仍未达到，goal保持active。


### 2026-11-11T00:34:33+08:00 代理响应契约异常补测设计

用户完整目标：知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。主执行者采用标准开发，针对createProxy既有校验失败502、transform返回undefined原样透传、错误规范化与请求上下文传递补真实HTTP用例。独立本机上游和网关，保留状态/头/正文及关联ID断言。无需产品改动，不改变覆盖率分母。验收：与流式代理既有用例联合运行并采集模块覆盖率。


### 2026-11-11T00:35:30+08:00 代理响应边界定向结果

用户完整目标：知识中心管理平台行100%、分支95%。新增proxy-response-boundaries-http共8项，与已有流式2项共10/10通过。真实HTTP覆盖转换空值透传、契约校验失败502、上下文定位、中文正文长度、路径与请求头映射、上游断连及三类错误载荷。proxy-utils模块行52/52=100%，分支43/50=86%；尚未全量复采，不替代平台全量指标。初次断连测试因Node原生Error跨Jest上下文导致instanceof断言失败，改为断言真实ECONNRESET及message后通过，产品未变。证据runtime/test-results/proxy-response-directed.log与proxy-response-directed/coverage-summary.json、lcov.info。整体目标仍未完成。


### 2026-11-11T00:36:11+08:00 配置接口异常恢复补测设计

用户完整目标：知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。标准开发，主执行者扩展既有真实HTTP配置路由测试，对模型/MCP/Agent预设读失败、更新前读取失败、持久化失败进行一次性依赖错误注入；断言500统一错误且随后正常请求恢复。隔离的config-manager对象仅替代存储接口，实际Express路由通过HTTP调用，不触碰真实配置。产品和分母不变。验收为联合代理边界与配置路由定向覆盖率，然后固定全量复采。


### 2026-11-11T00:36:51+08:00 配置接口异常与缺省边界定向结果

用户完整目标：知识中心管理平台行100%、分支95%。config-route-http-coverage新增9项（8类读写失败恢复、1项不完整配置默认值），与代理两套件联合23/23通过。真实Express HTTP验证模型/MCP/Agent读取与保存错误进入统一处理器、失败不产生持久化调用结果且下一次请求恢复。config路由行85/85=100%、分支44/44=100%；proxy-utils行52/52=100%、分支43/50=86%。证据runtime/test-results/config-proxy-directed.log及config-proxy-directed/coverage-summary.json。产品和分母未变，尚待固定全量复采，平台全量最新基线仍为Node行98.39%、分支87.65%，Java与前端未重采，整体目标未达成。


### 2026-11-11T00:37:34+08:00 源文档适配器契约补测设计

用户完整目标：知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。主执行者标准开发补充SourceAdapter未实现接口错误、扩展名大小写、真实文件SHA256与缺失文件错误；NormalizedDocument验证空值默认、完整元数据保留、序列化及行数。该模块为文件/纯数据协议，无后端HTTP行为。产品和分母不变，验收以定向模块覆盖率和语义断言为准。


### 2026-11-11T00:37:45+08:00 源文档适配器定向结果

用户完整目标：知识中心管理平台行100%、分支95%。新增source-adapter-contract共5/5通过，模块行18/18=100%、分支38/38=100%。验证抽象接口拒绝、扩展名大小写、真实文件SHA256及ENOENT、标准化文档默认值与完整元数据序列化。纯文件协议，无需后端HTTP。证据runtime/test-results/source-adapter-directed.log及source-adapter-directed/coverage-summary.json。产品和分母未改，尚待固定全量复采；平台目标仍未完成，goal保持active。


### 2026-11-11T00:41:11+08:00 配置、代理与源适配器固定全量结果

用户完整目标：知识中心管理平台行覆盖率100%、分支覆盖率95%。固定副本20261111-003800；稳定性{"stable": true, "changedFiles": [], "jestExit": 0, "completed": true, "productFiles": 154, "jestFiles": 178}。测试汇总：Test Suites: 1 skipped, 177 passed, 177 of 178 total
Tests:       6 skipped, 2662 passed, 2668 total
Time:        181.062 s。行16165/16412=98.49%；分支16633/18957=87.74%。证据：runtime/test-results/coverage-snapshots/20261111-003800/runtime/test-results/node-config-source-isolated-20261111。产品与分母未变；system共享服务分类未执行，Java及前端本轮未复采，平台整体目标仍未达成。


### 2026-11-11T00:42:01+08:00 快照持久化边界补测设计

用户完整目标：知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。标准开发，主执行者补测SnapshotTracker已有文件协议：损坏JSON读取拒绝、列表跳过损坏项与缺省元数据、非目录错误传播、latest为目录时保存失败、保留策略缺失目录与删除错误。使用runtime隔离真实文件，不修改产品与分母。伪代码：创建临时目录→构造文件/目录边界→调用公开方法→断言返回值或原始错误→清理本用例目录。验收为联合既有快照测试的定向覆盖率；平台结果须另行全量采集。


### 2026-11-11T00:42:27+08:00 快照文件边界定向结果

用户完整目标：知识中心管理平台行100%、分支95%。新增snapshot-tracker-boundaries共6项，联合已有快照测试17/17通过。真实文件验证损坏JSON拒绝及修复恢复、缺省统计和前序关联、列表过滤/时间排序、ENOTDIR传播、latest目录冲突与修复、清理目录错误及保留最新文件。模块行60/60=100%，分支37/37=100%。证据runtime/test-results/snapshot-boundaries-directed.log与snapshot-boundaries-directed/coverage-summary.json。产品与分母未改，平台目标仍未完成，全量最新基线为Node行98.49%、分支87.74%；本批尚未全量复采。Jest相对覆盖率路径按配置目录解析，首次落入tests内runtime，已将本批产物移回根runtime；后续使用绝对路径。


### 2026-11-11T00:43:04+08:00 PDF适配器纯协议与扫描边界设计

用户完整目标：知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。标准开发，补已有PDF适配器标题优先级/空白/长度上限、日期缺省、关键词去重/数量上限/特性来源、类型枚举；真实文件验证缺失目录、非目录错误与符号链接忽略，不生成或修改PDF，不改产品和分母。验收为联合既有真实PDF解析测试定向采集，平台仍需全量验收。


### 2026-11-11T00:43:17+08:00 PDF适配器边界定向结果

用户完整目标：知识中心管理平台行100%、分支95%。新增PDF协议边界12项，联合既有真实PDF解析共25/25通过。覆盖标题优先级及99/100字符边界、日期缺省、六类路径、关键词过滤去重与15项上限、真实目录扫描缺失/符号链接/ENOTDIR。模块行55/55=100%，分支40/44=90.9%。证据runtime/test-results/pdf-boundaries-directed.log及pdf-boundaries-directed/coverage-summary.json。产品与分母不变；尚未全量复采，平台目标仍未完成，Node最新固定全量行98.49%、分支87.74%。


### 2026-11-11T00:43:35+08:00 PDF解析元数据缺省补测设计

用户完整目标：知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。上一轮有有效进展，本轮标准开发补充pdf-parse依赖返回无info、空info和完整info时公开parse方法的标准化契约。替代外部解析依赖输出，但使用runtime真实文件读取与SHA256；已有真实PDF解析仍联合验证。断言作者/日期/producer/creator默认值和完整值、清洗正文与哈希，不改产品和分母。


### 2026-11-11T00:44:08+08:00 PDF元数据缺省定向结果

用户完整目标：知识中心管理平台行100%、分支95%。新增3种解析依赖元数据返回契约，联合真实PDF解析及已有边界共28/28通过。缺失info、空info和完整info均验证默认值/完整值、清洗正文、页数/行数和真实文件SHA256。PDF适配器行55/55=100%，分支44/44=100%。证据runtime/test-results/pdf-metadata-directed.log与pdf-metadata-directed/coverage-summary.json。外部解析返回在新增套件受控替代，既有真实PDF解析单独套件联合通过。产品与分母不变，尚未全量复采；平台目标仍未完成。


### 2026-11-11T00:45:03+08:00 配置校验边界设计

用户完整目标：知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。质量校验器未覆盖代码包含固定成功检查的不可达失败循环，不伪造内部数据覆盖。本轮转向ConfigValidator公开纯校验协议：数值类型与边界、MCP缓存和加密头错误/有效值、预设缺少字段。无需HTTP，未改后端行为。主执行者标准开发，断言具体错误和合法边界，不改产品与分母。


### 2026-11-11T00:45:14+08:00 配置校验边界定向结果

用户完整目标：知识中心管理平台行100%、分支95%。新增config-validator-boundaries共22项，联合已有测试39/39通过。验证数值类型/下限/温度端点、缓存缺省与有效值、加密头明文/密文/缺失字段及预设缺失agent等具体错误。模块行53/53=100%，分支77/77=100%。证据runtime/test-results/config-validator-directed.log及config-validator-directed/coverage-summary.json。产品及分母未改；平台目标仍未完成，本批尚未全量复采。


### 2026-11-11T00:46:05+08:00 模板上传解析HTTP边界设计

用户完整目标：知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。标准开发，主执行者以本机临时HTTP服务器调用readTemplateUpload，验证非multipart头、损坏报文、字段数量/合法性、空上传和40MB总请求限制；断言结构化错误及随后合法请求恢复。不改产品与分母，不写真实模板库。


### 2026-11-11T00:46:53+08:00 模板上传异常修复及定向结果

用户完整目标：知识中心管理平台行100%、分支95%。新增template-upload-parser-http共7/7通过，真实HTTP覆盖非法multipart、损坏报文、字段截断/数量/名称、无文件、41MiB请求和正常上传恢复。发现Busboy文件流在报文损坏及主动destroy时发出未捕获error，局部修复为注册文件流error监听并归一化400；保留首次envelope错误，40MiB上限仍返回413。首次测试有多余括号已修正；原未处理错误和归一化前500失败保留于过程记录。模块单套件行47/48=97.91%，分支22/29=75.86%，不替代全量联合指标。证据runtime/test-results/template-upload-directed.log及template-upload-directed/coverage-summary.json。产品新增错误监听使源码分母变化，下一次固定全量应使用实际新分母，不沿用旧计数。平台整体目标仍未完成。


### 2026-11-11T00:47:29+08:00 上传编码与批量边界设计

用户完整目标：知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。标准开发扩展真实HTTP上传解析用例，二进制非法UTF8应返回文件级422诊断，批量files保留索引及元数据，非法文件字段拒绝。检查客户端中断需使用明确服务端观察，不以连接关闭推断解析结果；本批先完成编码与批量场景。不改产品及分母。


### 2026-11-11T00:47:41+08:00 上传编码和批量定向结果

用户完整目标：知识中心管理平台行100%、分支95%。新增3项真实HTTP上传编码/批量/非法文件字段测试，套件10/10通过。非法UTF8以文件级TEMPLATE_ENCODING_INVALID/422记录且无content；批量files保留顺序、公共元数据与默认标题。模块行48/48=100%，分支24/29=82.75%。证据runtime/test-results/template-upload-encoding-directed.log及template-upload-encoding-directed/coverage-summary.json。客户端中断尚未补测，不将其记录为通过。产品和分母本批未改，平台全量待复采且目标仍未完成。


### 2026-11-11T00:48:09+08:00 上传连接中断及全量复采设计

用户完整目标：知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。上一轮有效进展。本轮标准开发，以真实HTTP连接写入部分multipart，等待服务端收到正文后主动断开，直接观察readTemplateUpload拒绝的TEMPLATE_UPLOAD_ABORTED/400，再验证正常上传恢复。若文件流错误抢先覆盖中断错误，局部保留原始envelope错误。之后用固定副本完整采集Node产品154文件及实际Jest清单，记录新分母与稳定性。Java和前端仍在平台目标内，不以Node结果替代全平台验收。


### 2026-11-11T00:48:33+08:00 上传连接中断定向结果

用户完整目标：知识中心管理平台行100%、分支95%。新增真实客户端中断用例，上传套件11/11通过；等待服务器收到部分正文后断开，观察解析Promise错误并验证后续上传恢复。初次观察TEMPLATE_INVALID_UPLOAD覆盖中断原因，局部修复为aborted事件先保留TEMPLATE_UPLOAD_ABORTED再destroy；先前请求超限仍保留413。模块行50/50=100%，分支24/29=82.75%。证据runtime/test-results/template-upload-aborted-directed.log与template-upload-aborted-directed/coverage-summary.json。产品错误传播修复增加实际分母，准备固定副本全量采集。平台整体目标仍未完成。

### 2026-11-11T00:52:14+08:00 上传及预处理固定全量结果

用户完整目标：知识中心管理平台行100%、分支95%。固定副本20261111-004833，产品154文件、Jest182文件，稳定性stable=true、changedFiles=[]、jestExit=0。181套件通过、1跳过；2716用例通过、6跳过，耗时187.194秒。行16185/16415=98.59%，分支16671/18957=87.94%。证据runtime/test-results/coverage-snapshots/20261111-004833/runtime/test-results/node-upload-preprocessing-isolated-20261111。Node仍缺230行、2286分支；system共享服务分类未执行，Java与前端仍需单独验收，平台目标未完成。

### 2026-11-11T00:52:14+08:00 图片说明接口边界设计

用户完整目标：知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。标准开发，主执行者扩展图片说明提供者的公开构造和caption契约。以本机HTTP服务验证实际OpenAI兼容请求与响应，覆盖无凭据、环境配置、模型、图片MIME、上下文缺省、请求选项、空响应和错误响应；断言实际请求体和返回/错误，不接触外部付费API，不改产品逻辑。定向测试后复查模块覆盖率，并保留全平台未达标事实。

### 2026-11-11 工作台责任人投影补测

覆盖率目标仍为行100%、分支95%。基于最新 LCOV，`routes/knowledge-center.js` 的工作台责任人查询存在审核文档投影和审核服务异常降级未命中路径。本批沿用真实 HTTP handler 和隔离内存服务，补充审核文档加入工作台及审核服务异常时 `completeness=partial/unavailable` 两个场景；不修改产品逻辑、不改变覆盖率分母。验收标准为公开响应中的任务类型、状态、来源和降级标记准确，且既有工作台套件不回归。

同批继续覆盖 MR 外链边界：通过真实工作台查询传入格式非法、非 HTTPS、携带凭据的 webUrl，确认它们不进入外部合入待办；有效 HTTPS 链接继续显示。此验证锁定现有安全过滤行为，不改变产品逻辑或数据范围。

### 2026-11-11T00:54:20+08:00 图片说明接口定向结果

用户完整目标：知识中心管理平台行100%、分支95%。图片说明提供者现有及新增测试合计8/8通过。本机真实HTTP覆盖兼容接口请求体、句末标点、空响应后恢复及400错误传播；公开构造契约覆盖无凭据、环境变量模型/端点/API Key、MIME和请求选项。模块行32/32=100%，分支66/67=98.5%。证据runtime/test-results/image-caption-directed.log及image-caption-directed/coverage-summary.json。未改产品及分母；此项未纳入上次全量快照，平台目标仍未完成。

### 2026-11-11T00:57:51+08:00 三端 full 覆盖采集结果

用户完整目标：知识中心管理平台行100%、分支95%。执行 `python3 tests/run_tests.py full --coverage --jobs 1`，HTML报告为 `runtime/test-reports/2026-11-11/20261111-005751-612440-full/report.html`。全量任务74/79成功，3434通过、1失败、34跳过；Playwright前置迁移因工作树含未提交迁移变更拒绝，另有1个Python性能用例失败。Node覆盖率16200/16415行=98.69%、16692/18957分支=88.05%；Java覆盖率3457/3485行=99.20%、2047/2322分支=88.16%。前端Istanbul采集在审核工作台16项中15项通过、1项因工作台数据残留断言失败，未生成可验收的前端摘要；失败日志在 `details/coverage/frontend/review-cases/1794331360238-2025763/review-test.log`。全平台目标仍未达成，不能用缺失前端报告推断通过。
### 2026-11-11T02:00:00+08:00 MR 参与人解析边界补测设计

用户完整目标：知识中心管理平台行100%、分支95%。最新固定 Node LCOV 显示 `gitlab-participants.js` 行覆盖完整但分支仅 55.8%。本轮沿公开 `resolveMRParticipants` 契约补充真实本地 HTTP GitLab 响应：非数组响应、分页上限、无审核列表、身份无匹配/重复、缺少登录账号、统一登录账号重复、无唯一活跃项目成员，以及仅有无效审核人时的提交门禁。测试只调用公开函数和本机 HTTP，不修改产品逻辑、覆盖率分母或门槛；完成后将该原生契约接入既有 Jest bridge，保证固定 Node 采集能够计数。
### 2026-11-11T02:15:00+08:00 前端固定 Istanbul 复采

执行 `KC_FRONTEND_ISTANBUL_OUTPUT=runtime/coverage-goal/frontend-current node tools/repository/collect-frontend-istanbul-coverage.cjs` 完成 57 个固定产品脚本、45 个导航页及真实浏览器场景采集；`source-stability.json` 为 `stable=true`、`changedFiles=[]`。前端行覆盖 8717/10374（84.02%），分支覆盖 10036/14196（70.69%），摘要见 `runtime/coverage-goal/frontend-current/coverage-summary.json`。该结果补齐了此前全量报告缺失的前端证据，但距离平台行100%、分支95%目标仍有明显缺口；专业 HTML 报告的9.5/10内部评分不作为覆盖率通过依据。

### 2026-11-11T02:19:42+08:00 最新 smoke HTML 报告复验

重新执行 `python3 tests/run_tests.py smoke --report-page-size 2`，2 个任务、24 个用例全部通过（Jest 22、unittest 2），报告为 `runtime/test-results/smoke/20261111-021942-616420-smoke/report.html`，生成12个场景分页。验收脚本支持传入报告目录，并对该最新报告执行离线 Chromium 1440px/390px 各10次导航：桌面最大 DOMContentLoaded 85.9ms、移动端17.8ms；无脚本错误、无外部请求、无横向溢出；跨页搜索命中3条并可深链接到用例，无 JavaScript 时可从总览进入场景页。大型 full 报告的100ms性能仍未声明通过。

### 2026-11-11T02:33:00+08:00 报告字距规范复核

截图复核发现标题和指标数值使用负字距，已按项目视觉规范改为 `letter-spacing: 0`。本次仅调整报告资源样式，不改变测试数据、分页或报告契约；最新 smoke 报告及既有离线 Chromium 验收继续作为证据。内部评分保持9.5/10，评分不是第三方认证。

### 2026-11-11T02:30:00+08:00 资料加工上传 API 补测设计

用户目标仍为平台固定源码清单行覆盖率100%、分支覆盖率95%。当前前端全量证据中 `common/api/cleaning-api.js` 存在3条未覆盖行及10个未覆盖分支。本轮在固定 Chromium 页面通过公开 API 调用创建上传会话、追加文件、上传分片、完成文件/会话、创建批次；隔离本机 HTTP 回显并断言编码路径、HTTP 方法、JSON/二进制正文、幂等键及请求头。增加结构化服务错误、无错误消息错误、非法 JSON 错误和无 `data` 信封回退场景。测试结束清理 HTTP 服务与路由。不得改产品规则或缩小57脚本固定清单；定向测试后执行完整前端采集并校验源码稳定性。
2026-11-11T02:53:54+08:00 前端审核覆盖补充：在现有真实审核 Chromium 的仓库阅读器场景中，通过公开 `enhanceDirectoryTrees` DOM 契约验证目录搜索、键盘下移/End 导航和清除筛选；通过 `observeRepositoryImages` 验证相对图片 srcset 改写、危险/外部 src 变更后的原值恢复与 observer 清理。定向 Playwright 1/1 通过；不修改产品源码、固定源码清单或覆盖率阈值。下一次完整采集需确认 `source-stability.json` 后再计入平台证据。

### 2026-11-11T04:18:00+08:00 专业 HTML 报告交付复核

用户完整提示词：

> 有哪些业界优秀的测试报告可以参考，然后使用rea skill来改进生成的html报告，需要的是专业的html测试报告，评分需要达到9分以上。

沿用并完整读取仓库 REA app-capability-transfer、reverse-engineer-anything Skill，核对已保存官方来源、REA 证据、功能映射和内部评分。统一入口回归43/43通过；重新运行 `python3 tests/run_tests.py smoke --report-page-size 2`，24/24通过，生成 `runtime/test-results/smoke/20261111-041717-255609-smoke/report.html` 和12个场景分页。现有确定性 Playwright 验收脚本对该新报告在1440px/390px各导航10次，P95 DOMContentLoaded为83.5ms/63.1ms；无横向溢出、脚本错误或外部请求；搜索、深链接、无JavaScript静态分页通过。本轮浏览器复验属于普通Playwright证据，未冒充新的REA Evidence ID。内部评分维持9.5/10，保留大型报告性能未验收限制；覆盖率目标另行验收。

覆盖率续作新增GitLab成功来源夹具，首次漏模型目录导致按钮禁用；修正后发现方法识别忽略字符串URL的fetch options，补正后真实入口已形成包含路径/commit/blob/摘要的来源快照并在夹具内拦截AI任务POST。诊断完整运行各场景通过，但运行中补了大纲状态恢复，source-stability正确拒绝该报告；计数84.35%/71.19%只供诊断，不作为最新正式覆盖率。已启动输入固定的全量复采。复盘：运行期间必须冻结采集输入，状态恢复应在启动采集前完善。


### 2026-11-11T04:27:52+08:00 GitLab成功来源场景稳定复采结果

固定前端完整复采 `runtime/coverage-goal/frontend-gitlab-success-stable/` 已成功结束；57个产品源码、45个导航、22个API契约、31个写作页面、16个任务页面和16个审核页面等既定采集齐全。`source-stability.json` 的 completed/stable/inputsStable 均为 true，changedFiles/changedInputs 均为空。行覆盖8753/10374（84.37%），分支10108/14196（71.20%）；相对上一正式 frontend-provenance-null-followup 结果增加26行、38分支。本轮保留固定分母，未混用诊断运行最优值；平台行100%、分支95%目标仍未完成。HTML报告内部9.5/10评分与覆盖率验收分别记录。


### 2026-11-11T04:29:47+08:00 资料上传页面HTTP契约补测设计

用户完整提示词：

> /goal 知识中心管理平台的测试覆盖率，行覆盖率需要达到100%，分支覆盖率需要达到95%。

标准开发；责任由主执行者及确定性Chromium/HTTP工具承担。沿既有公开页面表单、按钮与API边界，补充资料清洗上传：无文件拒绝、分块失败保留输入并可重试、成功按Content-Range传递所有字节并顺序完成文件/会话/批次、零字节及默认块大小、上传后刷新工作区。使用真实本机HTTP服务，不向共享后端写入；检查请求头、二进制正文、幂等键及页面结果。独立夹具接入既有固定前端采集，保留57源码分母，运行期间冻结输入。范围不改变产品逻辑或覆盖率门槛；本次局部测试不代替三端全平台验收。


### 2026-11-11T04:36:36+08:00 上传夹具契约校准

定向7场景已通过。审查发现零字节文件当前页面生成非有效Content-Range，不能用隔离服务接受该请求来声明零字节上传成功；已调整为隔离服务422拒绝并断言页面保留文件、停止完成/建批请求和显示错误。真实资料加工服务不属于本机隔离验收范围。中止原完整采集后修正夹具，再启动冻结输入采集；未使用被中止的计数。后续待办：依据资料加工服务的正式空文件契约决定页面预校验或空文件完成协议，不能因覆盖率目标自行改变业务规则。


### 2026-11-11T04:38:01+08:00 资料上传页面定向验收

新增 `tests/e2e/agent-runner/fixtures/cleaning-upload-http.cjs` 并接入固定前端采集。真实Chromium+本机HTTP共7场景通过，零页面脚本错误；日志 `runtime/coverage-goal/cleaning-upload-directed/verification.log`。覆盖对话框开关、无文件拦截、分块失败/批次失败后保留与恢复、空文件拒绝、多块及默认块大小上传、成功后重载。全量稳定复采正在运行，输出 `runtime/coverage-goal/frontend-cleaning-upload-verified/`，尚不声明新增覆盖率；上一正式前端仍为8753/10374行、10108/14196分支。平台100%/95%目标仍未完成。


### 2026-11-11T04:42:02+08:00 写作候选采用与并发编辑补测设计

沿用户已授权的页面与HTTP公开边界，补充嵌入式写作历史候选的采用流程。以真实Chromium点击历史记录与采用按钮，通过本机HTTP服务验证提交正文、修订版本、附件与基线摘要；正常响应后检查保存提示与正文。另在采用HTTP响应返回前触发真实编辑事件，验证后续人工正文保留、提示再次保存，避免迟到响应覆盖用户修改。只增加测试，不改变业务规则、产品分母或阈值。当前固定采集运行中，先在runtime准备夹具，待稳定采集终止后接入，再定向与完整验证。


2026-11-11T04:42:32+08:00 范围校准：实际写作页在采用请求期间禁用原文与富文本编辑器。不能用向禁用控件强制派发input来冒充用户并发编辑。先验证正常采用、服务失败后保留候选并重试，以及采用前通过原文编辑保持人工正文；并发回调防御分支只在发现合法可达入口后补测。本轮不通过私有回调或状态突变制造覆盖。


### 2026-11-11T04:48:07+08:00 上传完整复采与写作采用定向验证

上传7项HTTP场景完整固定复采成功，`runtime/coverage-goal/frontend-cleaning-upload-verified/` 保持57个产品源码、10374行/14196分支分母；行8777/10374=84.60%、分支10138/14196=71.41%，较上一正式报告增加24行、30分支。completed/stable/inputsStable均为true，changedFiles/changedInputs为空。

新夹具 `tests/e2e/agent-runner/fixtures/writing-adoption-http.cjs` 定向Chromium+本机HTTP验证3项通过、零页面脚本错误（日志 `runtime/coverage-goal/cleaning-upload-directed/adoption-verification.log`）：真实原文编辑同步到工作台；采用503保留候选和原文；再次采用成功，重新打开写作页看到已采用正文。请求验证修订4、附件、main分支、空基线标准SHA256及候选正文。初始化必须等待Vditor就绪，避免构造器返回而Lute尚未可用的夹具竞态；不修改产品代码。已接入固定采集并断言3项计数；新的覆盖率增益待稳定完整复采确认。平台行100%/分支95%目标仍未达成。


### 2026-11-11T04:49:56+08:00 人员导入页面HTTP补测设计

沿既定公开页面/HTTP边界补测人员Excel导入：打开/取消导入弹窗；冲突预检展示明细并隐藏确认；无冲突预检允许确认；预检HTTP失败后可重试；应用失败保留候选文件并恢复按钮；成功后显示新增/更新人数并刷新管理投影。真实XLSX由测试生成；本机HTTP接收浏览器multipart字节并返回确定性服务边界响应，不修改共享后端。验证中文与HTML特殊字符转义、请求mode、文件名/MIME与原始文件字节一致。当前完整复采输入冻结，先在runtime准备与定向验证，采集结束后再接入固定57源码清单，不降低分母或阈值。


### 2026-11-11T04:53:28+08:00 人员导入定向验证已通过，等待固定采集结束

`runtime/coverage-goal/cleaning-upload-directed/principal-import-http.cjs` 已通过6项真实Chromium+本机HTTP定向场景，页面脚本错误为空；日志 `runtime/coverage-goal/cleaning-upload-directed/import-verification.log`。实际生成含冲突行的XLSX与修正后的XLSX，分别验证multipart中的文件字节/文件名/MIME；三次预检、两次应用，应用成功后核对7类管理GET刷新路径，重新打开导入弹窗确认文件和预览清空。冲突姓名/说明含HTML特殊字符，页面以文本显示且未创建img/执行脚本。该夹具只验证前端与HTTP边界，不等同真实数据库Excel解析验收。

输入冻结中的完整固定采集session35345/PID2188514已再次核实存活，不重启、不修改采集输入；待终止后再接入人员导入夹具。当前正式前端仍8777/10374行、10138/14196分支；本次定向结果不作为完整平台覆盖率结果。


### 2026-11-11T04:59:15+08:00 写作采用稳定复采与人员导入接入

固定完整采集 `runtime/coverage-goal/frontend-writing-adoption-verified/` 成功结束，57产品源码/45导航及所有既定场景计数齐全，写作采用HTTP为3项。行8795/10374（84.77%）、分支10158/14196（71.55%），较上一正式上传结果增加18行、20分支；completed/stable/inputsStable均为true，changedFiles/changedInputs为空。

将已定向通过的人员导入HTTP夹具接入固定采集，预期6项。最终夹具再次定向通过6项、零脚本错误，并明确验证multipart的XLSX MIME；日志 `runtime/coverage-goal/cleaning-upload-directed/import-verification.log`。覆盖打开取消、预检失败保留、冲突转义、修正预检、应用失败恢复、重试成功刷新和重开清空。沿既有真实页面/HTTP边界与此前设计，不修改产品代码、业务规则或分母。下一次固定全量输出 `runtime/coverage-goal/frontend-principal-import-verified/`；启动后冻结输入，覆盖率增量待终止且稳定后确认。平台行100%/分支95%目标仍未达成。


### 2026-11-11T05:00:31+08:00 GitLab版本映射页面HTTP补测设计

固定前端报告最大缺口仍为app.js。沿已授权页面与HTTP公开边界，在独立已登录Chromium页面点击平台导航、GitLab页签和版本映射，真实填写表单并提交：预览无匹配、精确命中、所有版本、分支不可用、503；草案保存失败保留输入后重试、新增成功；启用规则的修订保存、激活与停用（含取消确认、服务失败重试）。隔离本机HTTP接收请求，验证JSON字段、If-Match版本、幂等键和成功后刷新展示。只准备runtime夹具；当前人员导入完整采集输入冻结，终止前不修改产品、tests、config或collector。不得通过私有函数、强制禁用控件事件或回调突变制造覆盖率。


### 2026-11-11T05:02:36+08:00 GitLab版本映射13项定向验证

`runtime/coverage-goal/cleaning-upload-directed/gitlab-mapping-http.cjs` 在专用已登录Chromium页面通过13项真实点击/表单+本机HTTP场景，零页面脚本错误。五类预览、新建失败保留与重试、启用规则修订、激活失败重试、停用取消与失败重试均通过。隔离服务遵循修订语义：保存active规则创建新draft，旧规则继续active；激活新修订后旧规则superseded。验证请求版本4/1/2、幂等键、JSON和预览查询。调用方必须持有并关闭专用页面；夹具不修改共享后端。定向日志mapping-verification.log；当前人员导入采集仍运行，未接入或计作正式覆盖率增益。


### 2026-11-11T05:05:03+08:00 GitLab仓库连接表单HTTP补测设计

沿既定公开页面和HTTP边界，在专用Chromium页面补测仓库连接创建503后保留输入并重试、服务账号创建后自动验证成功/失败、编辑503重试、手动验证失败重试、停用取消/失败/成功与重新启用失败/成功。另验证未配置OAuth时本人授权连接保存后的待授权提示，不进行外部OAuth跳转。真实本机HTTP接收请求，断言trim后字段、凭证引用省略/提供、编辑If-Match和幂等键；结束关闭专用页面并清理本机服务。只在runtime准备；当前人员导入采集结束前冻结产品和固定采集输入。


### 2026-11-11T05:05:41+08:00 GitLab仓库连接14项定向通过

`runtime/coverage-goal/cleaning-upload-directed/gitlab-connection-http.cjs` 真实Chromium+本机HTTP通过14项，零页面脚本错误。覆盖新增取消/503保留重试/自动验证、编辑取消/503重试、手动验证503重试、停用取消/503重试、启用503重试、OAuth未配置时待授权。实际请求验证trim字段、服务凭证引用、OAuth/编辑省略凭证、编辑If-Match=1及所有写入幂等键。日志connection-verification.log。夹具使用独立已登录页面，调用方负责关闭；未写入共享后端，未宣称真实GitLab访问或数据库集成。当前完整采集session18137/PID2198649仍存活，采集输入继续冻结。


### 2026-11-11T05:07:23+08:00 Node网关静态入口HTTP补测设计

依据最新现存Node报告，knowledge-center.js剩余行集中在路由边界，静态文件/SPA回退和未知API尚缺公开HTTP证据。准备真实动态端口网关HTTP测试：入口与index相同内容、深层无扩展名回退首页、带扩展名文件读取与缺失文件、编码路径逃逸400、未知API稳定JSON404/禁止缓存、其他前缀交还父路由。仅临时目录生成文件并注入真实文件发送适配器；不调用私有路径函数、不以直接响应mock代替路由结果。当前固定前端复采冻结，仅在runtime准备，之后接入tests并验证。


### 2026-11-11T05:46:38+08:00 大报告首次打开性能优化设计

真实历史全量3469用例/75分页离线复验功能通过，但桌面/390px首开DOMContentLoaded为116ms/102.8ms，未满足100ms约束。当前每页defer加载约1.2MB搜索索引，改为首次输入关键词或状态筛选时按需加载本地脚本；首屏仅加载小型交互脚本，搜索显示加载状态、读取失败提供重试提示，静态分页/无JS和原始证据保持可用。搜索总数由渲染模型写入data属性，不提前读取索引。验收：43入口回归、真实smoke、3469用例离线桌面/移动端首次及重复导航、跨分页搜索/状态筛选/深链接/无JS，原样记录性能。


### 2026-11-11T05:48:21+08:00 大规模真实报告补验结果

当前渲染器重建真实历史full报告（79任务、3469逐条用例、75场景分页），原运行失败保留，不作为当前产品全量通过证据。修正浏览器验收脚本原先假定第一场景必有逐条用例的问题，改为选择实际有用例的场景，未修改报告数据。搜索索引已改为首次搜索/筛选加载；浏览器断言首屏未加载索引、跨页搜索配置匹配335项、失败筛选匹配1项、清除恢复、深链接、无JS分页均通过。桌面/390px各10次离线导航，无外部请求/页面脚本错误/横向溢出。DOMContentLoaded P95为121.3ms/99ms；桌面首次导航仍超过100ms，不能宣称整体性能达标。保留内部量表9.5/10、性能维度0.5/1，非第三方认证。证据runtime/rea/professional-test-report/large-actual/report-verification.json与截图。43项入口回归、最新真实smoke24/24通过，报告runtime/test-results/smoke/20261111-054716-191031-smoke/report.html。

前端权限/资产完整采集终止退出0，completed/stable/inputsStable=true，changedFiles/changedInputs=[]；9078/10374行87.50%、10382/14196分支73.13%。证据runtime/coverage-goal/frontend-asset-permissions-verified。Node最近有效98.81%/88.37%，Java99.20%/88.16%；行100%/分支95%目标保持active。runtime准备的38项资产生产HTTP测试和12项大纲回收站场景尚未接入正式清单，不计入正式覆盖增益。

### 2026-11-11T11:43:00+08:00 资产仓库映射弹窗补测与稳定性判定

现有资产管理隔离 HTTP/Chromium 夹具增加手册“配置仓库映射”路径：返回已有映射、连接、分支和目录，经公开按钮打开弹窗，断言连接、默认分支、中英文路径回填及实际 GET 请求，关闭后继续原有资产创建/编辑/状态/归档断言。场景数由 8 增至 9；不写共享业务库。伪代码：创建手册 -> 打开映射 -> 读取映射/分支/目录 -> 核对表单及请求 -> 关闭 -> 完成资产写入断言。完整前端采集必须保持 57 个产品文件和固定场景，通过 `source-stability.json` 的 completed、stable、inputsStable 及变化清单后才能计入覆盖率。

本轮 `runtime/coverage-goal/frontend-asset-mapping-retry-20261111/` 的 9 项资产场景及其余固定场景完成，采集器退出 1：运行期间 `app.js`、`app-state.js`、平台管理视图与样式发生变化，`completed=true`、`stable=false`、`inputsStable=false`。输出的 10404/11054 行、12222/17034 分支仅供诊断，不能与前一稳定分母比较，也不作为平台目标验收。最近有效前端基线为 `runtime/coverage-goal/frontend-mapping-draft-20261111/` 的 9448/10414 行、10781/14307 分支。
### 预处理索引结构异常的 HTTP 恢复验收（2026-11-11）

在隔离文档路由服务中，将预处理索引暂时写为合法 JSON `null`，通过真实 GET `/api/document/preprocess` 验证返回 500 且不泄露已有文档；还原原始索引后再次 GET，验证列表恢复。该场景补足语法损坏回退之外的结构异常路径，不改变当前接口语义或覆盖率分母。

### 固定 Node 清单失败项修复验收（2026-11-11）

完整 192 文件采集输入稳定，但 AI 服务套件误将隔离阶段产物写向外部数据库，滚动门禁发现仓库详情抽屉直接使用 `100dvh`。AI 测试沿已有 `FileAggregateStore` 注入阶段产物存储，避免外部服务依赖；抽屉复用 `--kc-viewport-height`，保持既有视口语义。先分别运行两套失败测试，再用同一固定清单及源码哈希门禁复采，不删除失败测试或缩小产品文件分母。

### 资产目录 PATCH 管理员授权与版本控制 HTTP 验收（2026-11-12）

通过隔离知识中心 HTTP 服务调用公开 `PATCH /assets/catalog/:handbookId`：普通用户必须返回 403 且不修改资产；管理员以当前 `expectedVersion` 更新名称后，断言响应版本递增、持久化状态和审计一致；再次提交旧版本须返回 409 且状态不变。验收保留真实路由、授权检查及隔离存储写入。

### 网页引用 HTTP 客户端 DNS 固定验收（2026-11-12）

通过 `readWebReference` 真实生产接收逻辑及隔离的 Node HTTP/HTTPS 客户端替身验证协议选择、DNS 固定 lookup 的 `all=true/false` 回调、接受头、响应解析和请求错误监听。lookup 替身返回公开解析结果，但客户端均由测试内存响应替代，不发外网连接；另外注入一次套接字错误，验证 Promise 按原错误拒绝且后续成功请求不受影响。保留既有 DNS 私网拒绝、错误恢复与正文断言。

### 数据库配置不可达私有逻辑清理与独立覆盖（2026-11-12）

调用图复核发现 `merge()` 仅有定义和自递归、无生产调用方；`readDotenv()` 仅从公开加载函数调用且始终要求 service.env 存在。因此移除这两条不可达私有路径，保留缺失配置仍报错的公开语义。新增 Jest 公开契约测试，不依赖慢速的 node:test 契约桥；验证缺失/格式错误、默认仓库配置、dotenv 格式、环境覆盖、数字转换、空值规则和敏感字段。目标是覆盖实际可达产品行为，不把不可达实现保留在分母中。

### 图片说明 Provider 基类契约验收（2026-11-12）

通过直接实例化公开抽象基类并调用 `caption()`，断言 Promise 以“必须由实现类提供”错误拒绝，确保新增实现时基类不会静默返回空说明；现有具体 Provider HTTP 测试继续覆盖成功、异常及恢复。

## 2026-11-13 专业报告大样本复验

沿用仓库 REA `app-capability-transfer` 的“参考能力—证据—适配—验收”流程，以及既有 Allure、Playwright HTML Reporter、ReportPortal、pytest-html 参考记录。Allure MCP 本轮未连接，不新增 REA Evidence 或运行观察声明；以当前生成器、真实 smoke 和 3,469 条历史结果重建报告核验产品行为。

当前改进在总览加入逐条用例耗时排行，并把超时/中断并入场景异常数；全局搜索结果改为每页 50 条，不再截断于前 100 条。静态场景页面分页、离线日志、原始 JSON、无 JavaScript 导航保留。时间排序只使用测试框架提供的逐条耗时，缺失耗时不伪造。

验收：`python3 -m unittest tests/unit/root/test_run_tests.py` 为 45/45；`python3 tests/run_tests.py smoke --report-page-size 2` 真实执行 2 个任务、24 条用例全部通过并生成 `runtime/test-results/smoke/20261113-021108-513155-smoke/report.html`。大样本 Chromium 离线验收在 1440px 与 390px 各访问全部 335 条搜索匹配，共 7 页、末页 35 条；末条深链成功，无页面横向溢出、脚本错误和外部请求。大样本 10 次导航的 DCL P95 分别为 168.4ms / 312.5ms，冷开性能没有达到 100ms 约束；不得引用小型 smoke 耗时替代此结果。

沿用内部七项量表 9.5/10：数据可信 2/2、失败定位 2/2、检索导航 2/2、视觉层级 1.5/1.5、无障碍与移动端 1/1、离线与性能 0.5/1、可追溯 0.5/0.5。评分为项目内部报告功能评分，非第三方认证；其中性能扣分及大样本超限均明确保留。报告评分与平台覆盖率目标无关；当前 Java 稳定完整报告为行 4812/4867（98.87%）、分支 2981/3609（82.60%），Node 和前端也需各自达到完整分母门槛，平台行 100%/分支 95% 目标仍未完成。

## 2026-11-13 当前 HTML 报告 REA 受控观察

业界报告能力映射：Allure 的运行概览、结果聚合和失败证据；Playwright HTML Reporter 的状态筛选、逐条定位和深链；ReportPortal 的质量总览；pytest-html 的离线明细和日志。平台实现提供中文运行总览、场景汇总、静态分页、跨页搜索/筛选、失败日志链接、原始 JSON 与覆盖率门禁；缺少历史数据时不呈现趋势、重试或附件推断。参考来源及官网 403 限制见 `runtime/rea/professional-test-report/sources.json`、`official-repositories.json`。

按仓库 `app-capability-transfer` Skill 对当前实际 smoke 报告执行 REA Chromium 受控观察：桌面 Evidence `ev_50491be1528b0312b6410fd921da6ca143249abbf1241f996be4bb23948332b7`，原始 JSON `runtime/rea/professional-test-report/current-smoke-rea-evidence.json`，无障碍树完整且没有截断。报告 `runtime/test-results/smoke/20261113-024804-353084-smoke/report.html` 来自真实 `smoke --report-page-size 2`，2 项任务、24 条用例全部通过；统一入口回归为 45/45。该 smoke 未启用覆盖率，页面如实显示未采集。

大样本离线复验使用 3,469 条历史用例：1440px DCL/load P95 为 35.5/39.3ms，390px 为 15.1/20.3ms；跨页搜索 335 项、失败筛选、深链、无 JS 分页通过，无横向溢出、外部请求或页面脚本错误。内部量表评分 9.5/10，组成与限制见 `runtime/rea/professional-test-report/ACCEPTANCE.md`；性能项仍扣 0.5 分，因为交互脚本可用时间未独立测量。此为内部报告质量评估，不是第三方认证，也不代表平台覆盖率目标达成。

## 2026-11-13 前端稳定复采与任务导出覆盖场景

固定前端清单稳定复采证据 `runtime/coverage-goal/frontend-current-20261113-resume/` 的 `source-stability.json` 为 `completed/stable/inputsStable=true`，`changedFiles` 与 `changedInputs` 为空。59 个产品源码文件行覆盖 9908/10957（90.42%），分支覆盖 11444/15320（74.69%）；任务仍未达到全平台行 100%、分支 95%。

扩展任务管理真实 HTTP/Chromium 夹具：导入任务后点击公开 CSV 导出，断言下载文件名和 CSV 正文；再由隔离 HTTP 服务返回 503，断言页面呈现服务错误。该场景进入固定前端采集器原有任务管理套件，不改变产品行为、源码分母或覆盖率门槛。伪代码：`import -> click(export) -> assert(filename, body) -> route(503) -> click(export) -> assert(alert)`。只有采集器完成且输入稳定时才确认正式全量增量。

## 2026-11-13 UI 系统公共契约浏览器覆盖

在固定前端 Chromium 会话中导入 `common/ui-system.js`，逐项检查登记图标映射、action 图标按钮启用/禁用、三种普通按钮变体、文本及属性转义，以及未知图标、不可访问名称、非 action 图标、非法 data 属性和未登记变体的拒绝行为。伪代码：`for usage in UI_ICONS: assert(uiIcon(usage)); if action: assert(uiIconButton(enabled, disabled)); assert(uiButton(each variant)); assert(reject(invalid inputs))`。这是公共 UI helper 的可观测 HTML 契约，不改产品规则或源码分母；固定清单稳定复采后再记录有效增量。

### Node 文档任务关系存储适配器 HTTP 覆盖验收

`tests/unit/agent-runner/document-task-relational-read-http.test.js` 通过真实本机 HTTP 请求调用公开文档任务路由，路由使用 `createDocumentTaskRelationalStore`，请求由隔离 storage 响应器捕获。定向 Jest 3/3 通过；`runtime/coverage-goal/document-task-relational-adapter-directed/coverage-summary.json` 显示适配器行 23/23、分支 17/17。该定向报告只证明模块场景覆盖，不代表固定 Node 清单、前端、Java 或平台总覆盖率已达标；仍需完整固定清单稳定复采。

### 2026-11-13 全量 HTML 报告与覆盖率门禁验收

`python3 tests/run_tests.py full --coverage --jobs 1 --report-page-size 50` 完成 80 个任务中的 77 个，生成 `runtime/test-reports/2026-11-13/20261113-064013-281056-full/report.html`。总览统计 310 个测试文件、4057 条已识别用例，其中通过 3977、失败 40、跳过 40；场景分页、失败日志、覆盖率链接均可追溯。覆盖率输入稳定，但三端门禁未通过：Node 17144/17439 行、17801/20300 分支；前端 9930/10957 行、11469/15320 分支；Java 4814/4867 行、3001/3609 分支。该报告是完整失败证据，不得据此宣称行 100% / 分支 95% 已达标。
# Node 文档任务关系存储适配器 HTTP 覆盖
稳定全量 Node 报告中 `document-task-relational-store.js` 仅命中 5/23 行。现有文档任务 HTTP 测试在路由层注入替身，未通过关系存储适配器。新增隔离存储适配器契约场景：以真实本机 HTTP 请求调用文档任务公开路由，路由使用 `createDocumentTaskRelationalStore`，适配器将请求发送到可断言的隔离存储响应；覆盖状态/配置、任务列表与分页、个人任务和可见手册、按编号与审核 ID 查询、来源与变更查询、配置/任务写入及幂等回放。验证查询编码、可选过滤参数、`Idempotency-Key`、NOT_FOUND 转 null、其他错误继续抛出。伪代码：`storage.requestAsync -> capture(method,path,body,headers); app.use(router(relationalStore=createAdapter(storage))); fetch(publicRoute); assert(response, capturedRequest); adapter.find/replay(notFound)->null; adapter.find/replay(otherError)->reject`。不连接共享数据库、不改变路由或产品分母；定向 Jest 必须通过并显示目标源文件覆盖增加。完整固定清单和输入稳定复采后才将增量记入 Node 基线。
## 2026-11-13 Node 关系存储适配器纳入固定覆盖清单

稳定 Node 全量报告显示 `document-task-relational-store.js` 仅有 5/23 行被命中；已有 `document-task-relational-read-http.test.js` 通过真实本机 HTTP 请求、公开文档任务路由和隔离 storage 响应器覆盖该适配器的状态/配置、列表与分页、个人任务、可见手册、编号/审核/来源/变更查询、配置与任务写入、幂等回放及错误边界。将该契约接入 `native-contract-coverage.test.js`，由固定 Jest 清单执行；不复制断言、不修改产品规则或分母。

伪代码：`native-contract-coverage -> require(document-task-relational-read-http) -> real loopback HTTP -> relational adapter -> isolated storage -> assert encoded requests/errors`。

验收先执行定向 Jest 3/3；随后以固定产品源码分母和输入哈希运行串行 Node 全量采集。只有采集退出 0、`completed/stable/inputsStable=true` 且 `changedFiles/changedInputs=[]` 时，才记录净增；定向 23/23 行、17/17 分支不代表平台总目标通过。


## 2026-11-16T15:57:06+08:00 手册写作入口定向覆盖验收

固定采集器增加 `KC_FRONTEND_ISTANBUL_SCENARIO=handbook-writing-entry`，调用与全量一致的 `exerciseHandbookWritingEntry`，先验证历史工作区契约更新，定向结果仍明确 `capturedCoverage=false`。通过后重跑全部固定源码与场景；只采纳 completed/stable/inputsStable 为 true、变更列表为空的完整报告。不更改产品逻辑、覆盖分母或既有断言。


## 2026-11-16T16:15:06+08:00 前端完整覆盖采集诊断

手册写作入口定向浏览器场景通过，结果 `runtime/coverage-goal/frontend-writing-entry-directed-20261116-1558/targeted-scenario-result.json` 为 `completed=true`、`capturedCoverage=false`。完整固定采集 `runtime/coverage-goal/frontend-handbook-history-current-20261116-1605/` 在任务管理真实 HTTP 场景等待 `[data-task-action=ticket-scope]` 30 秒后失败，且源码及测试输入运行期间发生变更；`source-stability.json` 为 `completed=false`、`stable=false`、`inputsStable=false`，不能用于覆盖率基线。任务管理视图及其测试正在由另一工作流同步调整；当前不覆盖该并行修改，稳定后需重新运行完整固定清单。


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

## 2026-11-16T23:40:19+08:00 专业 HTML 报告 REA 当前版本验收

按仓库 `.codex/plugins/rea/skills/app-capability-transfer/SKILL.md` 和 `reverse-engineer-anything/SKILL.md` 执行：参考 Allure 的运行总览和失败证据、Playwright HTML Reporter 的状态筛选/用例定位、ReportPortal 的质量概览、pytest-html 的离线详情和日志。本次检查当前生成器及最新实际 smoke 产物；保留中文总览、逐条用例、按场景静态分页、失败任务/日志、跨页搜索与深链、无 JavaScript 浏览、覆盖率快照和门禁跳转。覆盖率快照只读取真实运行时计数；没有覆盖率采集时明确显示“未采集”。

最新产物 `runtime/test-results/smoke/20261116-225521-074778-smoke/report.html` 使用当前 `tests/run_tests.py` 与报告 CSS；报告统计 24/24 用例通过、2/2 任务成功，提供 12 个场景分页。入口回归 `python3 -m unittest tests.unit.root.test_run_tests` 为 54/54。REA 6.7.0 对该报告在 1440px 和 390px 分别执行受控 Chromium 捕获：Evidence `ev_731687ac2d862d2edb75602a5c5b945a43c1a45e7b6bc999b83d3e924a40cecf`、`ev_fea73d173bda141773667c332c14dbe4147e07ff7e5193d116f16031904064a6` 均 `completed` 且完整性 `complete`，只访问 `127.0.0.1`，浏览器由 REA 启动并清理。原始 Evidence、截图及本地浏览验证记录在 `runtime/rea/professional-test-report/current-workspace-smoke-rea-20261116-2255*`。

独立离线 Chromium 在两种宽度各导航 10 次；搜索均匹配 17 条用例并可深链，关闭 JavaScript 后仍能进入场景明细并看到逐条用例。DCL P95 为桌面 23.9ms、390px 73.6ms；无页面错误、外部请求和整页横向溢出。内部七项报告质量量表为 9.5/10：数据可信 2/2、失败定位 2/2、检索导航 2/2、视觉层级 1.5/1.5、无障碍与移动端 1/1、离线与性能 0.5/1、可追溯 0.5/0.5。性能保留扣分，有限 smoke 样本不能证明所有设备和大报告均低于 100ms；评分是内部自评，不是第三方认证。本次 smoke 未采集覆盖率，知识中心平台行 100%、分支 95% 仍须按三端稳定完整覆盖报告验收。
## 2026-11-17T03:58:00+08:00 AI 来源快照拒绝边界覆盖

固定 Node Istanbul 报告中 `routes/knowledge-center.js` 的 `verifyProductionOriginSnapshot` 是可通过公开 API 补齐的边界。扩展现有 `handbook-production-api.test.js` 本机真实 HTTP 场景，复用隔离 GitLab HTTP 服务和映射配置；验证已映射手册缺少快照返回 `AI_ORIGIN_SNAPSHOT_REQUIRED`、平台快照摘要格式无效返回 `AI_ORIGIN_SNAPSHOT_INVALID`、GitLab 快照缺路径/分支/版本标识返回相同稳定错误。拒绝请求均不得读取 GitLab 文件或调用 AI 生成；成功及基线漂移场景继续保留。测试经现有固定 Node Jest 清单计入覆盖率，不改变产品逻辑、源码分母或门槛。

伪代码：`for payload in missingSnapshot, malformedPlatformDigest, incompleteGitLabSnapshot: POST public AI jobs; assert status/code; assert gitLabReads == 0 && aiCalls == 0; then retain valid/stale/pinned requests`。先运行定向 Jest，再检查固定 Node 输入清单并运行完整清单稳定采集；仅采纳退出 0 且源码/测试输入哈希稳定的报告。
## 2026-11-17T04:16:00+08:00 AI 来源身份和分支拒绝矩阵

同一隔离 GitLab/AI 真实 HTTP 场景继续补快照边界：手册或文档身份不匹配、平台正文摘要漂移、平台分支冲突、已映射手册提交空白来源、GitLab 写作分支冲突、固定旧基线缺 commit。每个场景通过公开写作 API 验证 409 和稳定错误码；发生在外部读取前的拒绝应保持 GitLab 请求数与 AI 调用数不变。已有成功、漂移、pin 到 commit 与路径授权测试保留。固定 Node 209 Jest 文件复采前后哈希核验范围保持 372 项。

伪代码：`for snapshot in identityMismatch, platformDigestMismatch, platformBranchMismatch, mappedBlank, gitlabBranchMismatch, pinWithoutCommit: POST; assert status/code; assert no new upstream/model call for pre-read rejection`。
## 2026-11-17T04:27:00+08:00 GitLab 远端版本标识边界

继续扩展同一真实本地 GitLab HTTP 场景，验证服务端文件读取返回的 commit、blob 或 snapshot 标识与前端冻结快照不一致时拒绝 AI 生成；同时验证上游未返回可选路径/版本标识时，响应投影回退到已授权路径和请求快照身份。所有情况保持正文摘要一致，以单独命中版本标识校验，断言状态码、公开错误码及 AI 调用次数。测试通过 Jest 固定清单桥接，源码分母与目标不变。

伪代码：`vary gitlab commit_id/blob_id/file_path; POST frozen snapshot; assert mismatch rejected before AI; when optional identifiers absent assert returned origin falls back to requested authorized values`。

## 2026-11-17T04:36:00+08:00 无映射空白来源兼容路径

扩展相同测试夹具：暂时移除隔离配置中的手册映射，验证旧式请求未携带 `originSnapshot` 时服务端生成空白来源摘要，以及显式 `blank` 快照凭正确 SHA-256 可继续生成。通过已映射快照拒绝用例与无映射兼容用例覆盖差异；恢复不需要写共享配置，所有变更仅在临时目录。

伪代码：`saved=readConfig(temp); writeConfig({...saved,mappings:[]}); POST without snapshot -> assert blank origin; POST explicit blank digest -> assert accepted and originType blank`。
## 2026-11-17T04:44:00+08:00 工作台审核与交付投影 HTTP 场景

最新稳定 LCOV 的 `routes/knowledge-center.js` 约 2,601–2,644 行含大量未覆盖的责任人工作台投影分支。扩展 `knowledge-center-workbench-http-coverage.test.js`，继续通过真实本地 HTTP handler 和隔离内存审核服务验证：分配给责任人的可见审核任务；本人创建的生产任务分别可创建 MR、刷新交付、关闭交付后修订及无操作能力；被指派的已提交 MR 对有效 HTTPS 链接显示合入入口，非 HTTPS、凭据 URL 或非本人指派不暴露操作。断言公开 JSON 中的任务 ID、动作代码、链接与过滤结果，所有状态来自隔离 fixture，不连接共享数据库或 GitLab。

伪代码：`service.readState -> fixture tasks; reviewBootstrap -> assigned documents; service.project -> capability projection; GET /workbench/delegated?responsibleId=writer; assert review, create_mr, sync_delivery, revise and safe merge-link projection`。先运行 Jest 定向测试，再使用稳定的 209 文件 Node 固定清单确认覆盖增量；如果计数不变，只记录已被其他路径覆盖，不将测试条数宣称为覆盖收益。

覆盖率数据以记录对应目录中的稳定完整采集报告为准。


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


## 2026-11-17T15:08:51+08:00 前端覆盖采集插桩性能对照

在 `production-writing.test.cjs` 的插桩路由增加进程内 `file path + response SHA-256` 缓存，缓存只复用静态编译结果；浏览器 context 和 Istanbul 计数仍逐测试隔离。用真实三用例 Chromium 子集在 cache 关闭/开启下各采三轮。插桩 CPU 中位数从2308.1ms降至870.3ms，转换数每轮从38降至16，缓存命中22次；墙钟中位数为16.36s/17.65s，未证明端到端提速。两种模式均3/3通过，16源码文件行/分支命中集合一致（1657行、727分支）。单次无插桩对照24.75s、一次插桩异常轮111.99s，视为环境波动，不作性能收益门槛。完整固定矩阵近期输入变化或测试失败，没有稳定成功的全量耗时基线。详细原始结果与回退方式见 `runtime/performance/frontend-coverage-ab/RESULTS.md`。

## 2026-11-17T15:26:22+08:00 覆盖浏览器用例复用 Chromium 进程

当前真实调用链每个 `production-writing.test.cjs` 用例均 `chromium.launch()` 后 `browser.close()`。改为覆盖模式默认单进程复用 Chromium，每条测试仍 `browser.newPage()` 创建全新 BrowserContext，在用例 teardown 读出自己的 Istanbul 快照后关闭该 context；suite 完成时关闭 Browser。环境变量 `KC_FRONTEND_ISTANBUL_REUSE_BROWSER=0` 回退逐用例进程。

相同真实 Chromium 三用例集交替 A/B 各三轮，三轮均3/3通过，Istanbul 16文件行/分支命中集合相同。新进程墙钟 P50/P95/max 为18.53/19.66/19.66秒，复用为10.98/11.89/11.89秒，P50降低40.7%；单例 duration P50/P95/max 为5.99/6.25/6.25秒与2.95/5.86/5.86秒。进程 teardown累计 P50由5688.6ms降至24.4ms。n=3时最近秩 P95等于最大值。该收益只在固定三用例子集上验收；完整36用例套件因另一轮输入改动与2个测试失败尚无稳定性能结论。明细见 `runtime/performance/frontend-coverage-ab/RESULTS.md`。

完整 `production-writing.test.cjs` 在复用模式下35通过、2项真实模型测试跳过、0失败，墙钟171.79秒并生成35个隔离覆盖快照。与近期新进程诊断运行相比，多命中18行、4分支，差异落在 `production-writing-page.js`；工作树输入近期变化，因此不宣称逐位覆盖等价或完整套件提速。缺少同一输入版本的新进程全量基线；完整固定前端矩阵亦尚无稳定成功报告。


## 2026-11-17T15:08:51+08:00 前端覆盖采集浏览器插桩性能基线与方案

性能基线取自当前本机隔离的同一真实 HTML/HTM 上传用例（来源类别：测试执行时间，不是 API 业务时间）：`WRITING_LIVE_MODEL=0 KC_FRONTEND_ISTANBUL_CASE_DIR=runtime/performance/frontend-coverage-baseline/html-local node --test --test-name-pattern='本地 HTML/HTM 参考文档' tests/e2e/agent-runner/production-writing.test.cjs`，`/usr/bin/time` 总墙钟 111.99s，浏览器用例 duration 67.98s；不启用 coverage env 的相同命令用时24.75s，浏览器用例13.65s。业务日志 authorization 接口两次约6ms，样本仅单次且主机并发状态未记录，故为探索性对照，不声称正式性能收益。既有固定完整采集曾用约11分54秒且有运行输入变更，不作为稳定成功基线。

检查调用链后，`production-writing.test.cjs:launch()` 在每条隔离用例中重新启动 Instrumenter；每次页面加载的 JS route 又对相同静态 JS 响应重复 `instrumentSync`，覆盖注入代码及每测试独立浏览器 context 可以保留，但静态变换可按文件路径和源内容 SHA-256 缓存。实现后以真实多用例 browser suite 同口径比较 wall/user/system 时间、转换次数、命中次数及目标行/分支计数，并执行无插桩定向用例回归。缓存只存在单个 Node 测试进程，源码内容改变即重新插桩，不改变被测产品和覆盖分母。完整矩阵稳定复跑后再判定端到端采集收益；由未参与实现者独立验证前，不声称独立验收。


## 2026-11-17T15:21:58+08:00 覆盖测试 Chromium 启动成本测量方案

现有覆盖测试 `launch()` 每个测试启动完整 Chromium 进程，且每次用完即关闭；该调用链可量化浏览器启动、fixture API 准备、页面初始化、coverage snapshot 和关闭阶段。先增加仅由 profile 环境变量启用的阶段计时。在确认多个独立 test 使用 `browser.newPage()` 默认各自拥有独立 BrowserContext 后，A/B 比较逐测新进程与进程内复用 Browser、逐测关闭 context 的路径。只有真实用例结果及 Istanbul 行/分支命中集合相同，且同机交替复测的墙钟与浏览器启动阶段都显示收益，才在固定覆盖运行默认复用；可通过 env 回退逐测启动。
