# YashanDB 知识中心

知识资产管理、文档生成、资料加工与审核发布平台。仓库按可部署应用和共享能力组织，数据库连接配置集中在 `config/yashandb/`，密码与 Token 由环境变量或密钥系统注入。

## 从哪里开始

| 目录 | 内容 |
| --- | --- |
| apps/ | 知识中心 Web、API、认证，PingCode Web/API，数据库存储服务 |
| packages/ | Agent 核心、PingCode 核心、平台契约与配置能力 |
| tools/ | 重启、运维、迁移、CLI 和知识加工工具 |
| tests/ | unit、contract、integration、e2e |
| config/ | knowledge-center、pingcode、database 集中配置 |
| knowledge/ | 大纲、模板、Skill、提示词、领域与参考资料 |
| docs/ | 历史设计文档、使用说明及历史资料 |
| external/ | FastGPT 与 yas-ai-helper 独立工程，不参与主仓库默认构建 |
| runtime/ | 持久状态、日志、缓存、导出和本地迁移记录，不进 Git |

`runtime/` 中持久数据需要备份，不能整体清空。详见[运行数据维护](docs/operations/runtime-storage.md)。

## 启动与检查

```bash
./knowledge-center.sh doctor
./knowledge-center.sh doctor --commands
./tools/deployment/install-knowledge-center.sh --check
# 确认计划后显式执行：./tools/deployment/install-knowledge-center.sh --apply
npm run build
./knowledge-center.sh start
./knowledge-center.sh status
./knowledge-center.sh restart
./knowledge-center.sh stop
```

唯一构建脚本为 `tools/repository/build-knowledge-center.sh`，`npm run build` 只调用该入口。默认产物位于可重建的 `runtime/build/knowledge-center/current/`，详见[统一可重复构建设计](.codex/知识中心建设平台/03-详细设计/知识中心-平台-详细设计文档.md)。构建指纹只覆盖当前真实存在的源码输入并在扫描前校验；PingCode Vite 构建默认使用 `KNOWLEDGE_CENTER_VITE_NODE_OPTIONS=--max-old-space-size=1536`，压缩构建测试机建议配置约 8GiB 内存。

对外访问由 `KNOWLEDGE_CENTER_PUBLIC_BASE_URL` 显式配置，可直接使用 IP，例如 `http://192.0.2.10:13510`；脚本不再内置某台机器的 IP，也不从网卡自动推断。根目录 `knowledge-center.sh` 负责诊断和运行生命周期，`start/restart` 默认先执行统一构建，但不自动安装系统软件。依赖安装必须显式调用 `tools/deployment/install-knowledge-center.sh --apply`。

`doctor` 检查 Java 17+、Node.js 20+、Python 3.10+、Node/Python 模块、Playwright Chromium 制品、配置权限、外部 URL、构建产物、真实 YashanDB 连通性和迁移完整性；`--commands` 只输出可复制的处置命令，`--json` 输出结构化结果。受限网络环境的离线交付约定见 [部署工具说明](tools/deployment/README.md)。

`restart` 会先构建再停止旧服务；构建失败时保留旧服务。脚本会预检端口、超时和产物摘要，只强制回收经过工作目录与命令行确认的本仓库进程。启动失败时会标明失败组件、日志和已识别的迁移/连接故障；`status --verbose` 会区分 PID 缺失、进程退出、端口未监听、端口归属冲突和 HTTP 健康检查失败。

平台启停会写入运行日志目录下的 `lifecycle.log`，组件重新启动前会将上一轮日志归档到 `history/`。自动化测试使用独立端口和状态目录；只有所有权令牌与进程身份均匹配时才允许回收，不得停止共享开发实例。

开发环境中，已执行迁移的摘要与当前构建不一致时默认在启动终端和组件日志输出告警并继续启动；生产或共享环境通过 `YASDB_MIGRATION_CHECKSUM_POLICY=strict` 恢复强制门禁。显式数据库迁移始终保持严格校验。

```bash
npm run check:node
python3 tests/run_tests.py smoke
python3 tests/run_tests.py full
```

统一测试入口及分类命令见 [tests/README.md](tests/README.md)，设计约束与报告契约见 [知识中心平台统一测试入口设计](.codex/知识中心建设平台/05-测试设计&报告/01-测试设计/知识中心-平台-统一测试入口-测试设计文档.md)。入口会自动设置 Python 模块路径；测试仍需安装 Jest、Playwright、FastAPI 等对应项目依赖。浏览器测试与真实外部服务验证的前提见对应测试文件，避免向生产任务写入测试数据。

## 文档与协作

- [目录迁移跟踪与验收](docs/directory-structure-refactor.md)
- [知识资产导航](knowledge/README.md)
- [DeepSeek Harness 精简手册（新手版）](docs/deepseek-harness-精简手册.md)
- [数据库配置](config/yashandb/README.md)
- [工作区约束](AGENTS.md)、[Git 提交规范](git提交规范.md)
- [提示词与复盘](prompt.md)，`prompt-log.md` 仅保留历史
- [迁移前完整使用文档（历史路径）](docs/archive/root-layout/README.before-runtime.md)

新增服务放 apps，共享库放 packages，工具放 tools；禁止重新引入根级 code/scripts/var。历史设计中的旧路径仅作历史事实，执行命令以当前入口为准。
