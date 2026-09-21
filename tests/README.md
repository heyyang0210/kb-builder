# 仓库测试入口

`tests/run_tests.py` 是主仓库对开发者和持续集成系统公开的统一测试入口。新增符合命名约定的 Jest、独立 Node 脚本、Python unittest、pytest、独立 Python 脚本和 Playwright 用例后，入口会自动发现；只有刻意控制在较短时间内的冒烟集需要维护脚本中的 `SMOKE_FILES`。

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
python3 tests/run_tests.py full --coverage
python3 tests/run_tests.py full --report runtime/test-results/exports/compat-full.json
python3 tests/run_tests.py full --log runtime/test-results/exports/compat-full.log

# 定向执行一个或多个 Playwright 浏览器项目
PLAYWRIGHT_PROJECTS=chromium python3 tests/run_tests.py e2e
```

部署契约测试覆盖 `knowledge-center.sh doctor --json`、RPM/DEB 安装命令路由、外部 URL 配置、离线包摘要校验和数据库 `probe/verify` 入口。契约测试会跳过真实数据库探测；真实部署验收必须单独执行 `./knowledge-center.sh doctor`。

Playwright 始终由统一入口启动随机本地端口的隔离测试实例，不复用外部 `KPG_BASE_URL`。该实例复用同一 YashanDB 服务，但强制通过 `YASDB_CONFIG_DIR=runtime/test-config/yashandb` 从其 `service.env` 加载 `test_hy` 独立 Schema 账号；缺少配置或账号不是 `test_hy` 时前置失败，不得回退或额外依赖业务配置。

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

E2E 若临时修改共享账号角色或其他持久状态，必须在 `finally` 中恢复原值；不得依赖用例执行顺序或把变更遗留给后续分类。
Node 测试中的文件 watcher 必须 `unref` 或显式关闭；会修改共享配置文件的测试必须在结束时恢复原内容。

`system` 中的检索链路会真实调用当前知识中心 Agent API 与 MCP；依赖外部模型的完整文档生成默认跳过，通过 `RUN_KNOWLEDGE_CENTER_LIVE_MODEL_TESTS=1` 显式启用。

`external/` 是独立维护的工程，不在本入口扫描范围内。
