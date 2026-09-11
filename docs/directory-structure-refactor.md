# 目录结构重构跟踪

## 当前状态

- 方案：方案三（应用、共享包、工具、测试、运行时数据）
- 当前阶段：核心迁移、入口修复、测试矩阵和真实 HTTP 收尾完成
- 基线：执行前工作区变更已保留，未执行 reset、checkout 或破坏性清理

## 最终目标与实际目录

```text
apps/{knowledge-center-api,knowledge-center-auth,knowledge-center-web,pingcode-api,pingcode-web,yashandb-storage}
packages/{agent-runner-core,pingcode-core,platform-contracts,platform-config}
tools/{knowledge-processing,pingcode-cli,repository}
tests/{unit,contract,integration,e2e}
var/{agent-runner,pingcode}
config/{knowledge-center,pingcode,database}
```

`src/FastGPT/`、`yas-ai-helper/` 和知识资产目录保持原职责；`var/` 下日志、缓存、依赖、覆盖率、运行数据和构建产物不视为源码包。

## 批次记录

| 批次 | 内容 | 状态 | 验证证据 |
| --- | --- | --- | --- |
| 0 | 冻结工作区和迁移映射 | 已完成 | 执行前 `git status --short` |
| 1 | 数据库配置契约和忽略规则 | 已完成 | `config/database` schema、示例和 `.gitignore` |
| 2 | Agent Runner 应用、共享包、配置和测试迁移 | 已完成 | `apps/knowledge-center-*`、`packages/agent-runner-core` |
| 3 | PingCode 应用、共享包、配置和测试迁移 | 已完成 | `apps/pingcode-*`、`packages/pingcode-core` |
| 4 | 工具、运行数据和契约迁移 | 已完成 | `tools/`、`var/`、`packages/platform-contracts` |
| 5 | 入口、依赖、配置和 README 修复 | 已完成 | Node/Python/Shell 静态检查、应用 README |
| 6 | 完整测试、真实 HTTP 与旧路径核对 | 已完成 | 平台管理相关 Jest 5 个套件 57 项通过；四服务重启成功；context/overview、用户权限、GitLab 列表/OAuth 接口均 HTTP 200；权限原值写回成功；GitLab yasdoc 验证明确受外部凭证阻塞；运行时旧路径扫描无命中；venv 内部 4 个符号链接登记 |

## 关键路径约定

- Node API：`apps/knowledge-center-api/server.js`
- 知识中心认证：`apps/knowledge-center-auth/auth-server.js`
- 知识中心 Web：`apps/knowledge-center-web/frontend-server.js`
- PingCode API：`apps/pingcode-api/app/main.py`
- 共享核心：`packages/agent-runner-core/`、`packages/pingcode-core/`
- 数据库连接配置：`config/database/`；密码仅由环境变量或密钥系统注入
- 运行时写入：`var/agent-runner/`、`var/pingcode/`

## 残余风险与回滚点

完整 Jest/unittest 中仍有与目录重构无关的既有业务断言失败，且环境未安装 pytest；这些限制已在清单记录。运行时旧路径已清零，历史文档中的旧路径仅保留为历史记录，不作为运行时入口。任何失败只修复当前批次，不清理用户已有文件。
# 一级目录精简执行跟踪

本轮目标：apps、packages、tools、tests、config、knowledge、docs、external、runtime 九个职责目录。以下历史记录保留作迁移事实，以本节为当前状态。

| 批次 | 状态 | 映射及证据 |
| --- | --- | --- |
| 基线 | 完成 | runtime/repository-migration/baseline.json 保存未提交文件列表与独立工程 Git 状态；四服务运行 |
| 知识资产 | 完成 | 十类资产归入 knowledge；manifest、Skill、提示词及大纲读取验证通过 |
| 运行数据 | 完成 | 停服核验移动，最终四服务重启/status 通过 |
| 外部工程 | 已迁移 | FastGPT 222570 条、yas-ai-helper 238 条移动前后身份与大小一致 |
| 残留和文档 | 已迁移 | 旧目录完整归档；历史 Compose 与根级旧提示词页已登记 |
| 引用与验收 | 核心验证完成，环境边界见下文 | Node 272 文件，Python 157 文件语法、Shell 10 文件；最终重启通过；数据库实连及外部工程部署未执行 |

安全与回滚：每次只使用同文件系统 rename，不覆盖目标，移动前后逐项核验 inode、设备、大小和符号链接目标；清单记录在 runtime/repository-migration/moves.jsonl。回滚须先停服务，按日志逆序移动并恢复对应配置引用；不回退用户功能改动。

根级 prompt-generator.html 与已提供服务的 apps/knowledge-center-web/frontend/prompt-generator.html 内容不同：保留服务端现有页面，根级旧版归档，不覆盖。docker-compose.yml 的 backend/frontend 构建目录已不存在，归档为历史配置，不宣称可部署。

scripts/pingcode/__init__.py 指向已不存在的 core 子包，属于旧包装；与该目录缓存、附件完整归档，保留可恢复性，不作为入口。外部工程内部依赖整体搬迁，主工程 node_modules 不移动。

## 本轮验收与保留边界

- 实际一级目录：apps、packages、tools、tests、config、knowledge、docs、external、runtime。node_modules 及工具隐藏目录按约定排除。
- 核验 external/yas-ai-helper 的 Git status 与基线完全一致；FastGPT 原为源码快照，无独立 Git。均完整迁移，未执行外部工程构建部署。
- 旧 var/src/code/scripts 与根级资产目录均已移出；仅移除确认空的 var/src 目录。runtime/migration-residuals 保留旧包装原文，禁止作为代码入口。
- 生产模块/工具/测试/配置可执行文件无旧 var/agent-runner、var/pingcode、src/FastGPT 引用；历史 docs、测试输入夹具、源码词法 vendor、迁移工具中的 from 路径登记为扫描例外。
- 未新增兼容链接。apps/pingcode-api/.venv 内 Python 链接为解释器环境链接；外部工程内部依赖链接保持原状，未发现指向旧仓库绝对路径的外部符号链接。
- 运行 JSON 扫描未发现本仓库旧 var 绝对路径。数据库持久化内部是否含历史绝对路径未实连确认；不得据此声称数据库全量迁移通过。
- 初次四套 Node 38 项通过、一次浏览器未启用跳过；后续浏览器启用的真实 HTTP 评论回归六项通过。另六套大纲/配置/代理/企业契约测试 39 项通过。
- Python：数据库配置 2 项、SSE 8 项、文件响应 4 项、下载取消与 Skill/提示词注册 25 项、企业 profile 5 项通过。使用系统 Python；项目 .venv 缺少 FastAPI，不作为验证解释器。
- 健康及页面 HTTP：14110/api/health、18010/api/health、14200/knowledge-center/api/auth/config、13510/knowledge-center/、13510/prompt-generator.html、13510/pingcode-materials/、14110/api/outline/list 均 200。MCP 默认远程地址断言通过。
- README 原全文另存 docs/archive/root-layout/README.before-runtime.md。历史文档不冒充当前使用说明；根级 Compose 已失效，仅归档，不新造部署配置。
