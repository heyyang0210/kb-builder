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
| docs/ | 当前设计、使用说明及历史资料 |
| external/ | FastGPT 与 yas-ai-helper 独立工程，不参与主仓库默认构建 |
| runtime/ | 持久状态、日志、缓存、导出和本地迁移记录，不进 Git |

`runtime/` 中持久数据需要备份，不能整体清空。详见[运行数据维护](docs/operations/runtime-storage.md)。

## 启动与检查

```bash
./knowledge-center.sh start
./knowledge-center.sh status
./knowledge-center.sh restart
./knowledge-center.sh stop
```

默认页面：`http://192.168.130.180:13510/knowledge-center/`。根目录 `knowledge-center.sh` 是平台唯一权威运维入口；本地配置入口为 `config/knowledge-center/.env`，启动参数、依赖与环境覆盖见[启动设计](docs/agent-runner/overview/service-startup-and-restart-design.md)。

```bash
npm run check:node
npm run test:knowledge-center -- --runInBand
```

测试需要安装 Jest；Python 测试使用含 FastAPI 等项目依赖的解释器，并设置 `PYTHONPATH=apps/pingcode-api:packages/pingcode-core`。浏览器测试与真实外部服务验证的前提见对应测试文件，避免向生产任务写入测试数据。

## 文档与协作

- [目录迁移跟踪与验收](docs/directory-structure-refactor.md)
- [知识资产导航](knowledge/README.md)
- [DeepSeek Harness 精简手册（新手版）](docs/deepseek-harness-精简手册.md)
- [数据库配置](config/yashandb/README.md)
- [工作区约束](AGENTS.md)、[Git 提交规范](git提交规范.md)
- [提示词与复盘](prompt.md)，`prompt-log.md` 仅保留历史
- [迁移前完整使用文档（历史路径）](docs/archive/root-layout/README.before-runtime.md)

新增服务放 apps，共享库放 packages，工具放 tools；禁止重新引入根级 code/scripts/var。历史设计中的旧路径仅作历史事实，执行命令以当前入口为准。
