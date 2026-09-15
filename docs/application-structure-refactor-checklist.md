# 应用化目录重构清单

> 后续一级目录精简已采用 knowledge/external/runtime；本页记录前次应用化迁移，最新实际结构及验收以 directory-structure-refactor.md 顶部为准。

## 目标

将仓库调整为按可部署应用、共享包、工具、测试和运行时数据组织的 monorepo，保持知识资产、FastGPT 和 `yas-ai-helper` 独立工程边界不变。

## 目标目录

```text
apps/
  knowledge-center-api/
  knowledge-center-auth/
  knowledge-center-web/
  pingcode-api/
  pingcode-web/
  yashandb-storage/
packages/
  agent-runner-core/
  pingcode-core/
  platform-contracts/
  platform-config/
tools/
  knowledge-processing/
  pingcode-cli/
  repository/
tests/
  unit/
  contract/
  integration/
  e2e/
runtime/
  agent-runner/
  pingcode/
```

## 执行清单

- [x] 建立应用、包、工具和运行时数据目录
- [x] 迁移 Agent Runner 应用入口、核心库、前端和 JDBC 服务
- [x] 迁移 PingCode API、前端和核心库
- [x] 迁移共享契约到 `packages/platform-contracts`
- [x] 迁移脚本和测试，修复所有入口引用
- [x] 迁移运行数据到 `runtime/`，禁止源码目录承载运行时写入
- [x] 更新 package workspace、README、设计文档和启动命令
- [x] 执行完整测试矩阵和真实 HTTP 验证（核心矩阵与真实 HTTP 已执行；受环境限制的失败项见批次记录）
- [x] 扫描并确认无未登记旧路径、旧符号链接或兼容包装（运行时范围无旧引用；4 个 venv 内部符号链接已登记）

## 保护范围

`src/FastGPT/`、`yas-ai-helper/`、知识资产目录、真实凭证和用户已有未提交变更不回退、不清理。

## 批次记录

| 批次 | 内容 | 状态 | 证据 |
| --- | --- | --- | --- |
| 0 | 冻结工作区和迁移映射 | 已完成 | 执行前 `git status --short` 已保存 |
| 1 | 应用、包、工具、测试和运行时目录建立 | 已完成 | `find apps packages tools tests var` |
| 2 | 物理文件迁移 | 已完成 | 迁移后的新增/删除对 |
| 3 | 入口、依赖和配置引用修复 | 已完成 | `node --check`、`bash -n`、Python 编译/导入 |
| 4 | README、设计文档和提示词记录更新 | 已完成 | 应用 README、配置文档和目录跟踪文档 |
| 5 | 全量验证和最终清单 | 已完成 | Node 静态检查 269 文件；针对性 Jest 6 套件/49 项通过；PingCode unittest 2 项通过；真实 HTTP 五个入口均 200；文档 API 自执行测试 54/58 通过（4 项既有业务断言失败）；pytest 未安装，PingCode web-backend 全量存在环境/历史导入失败，未冒充通过 |

## 收尾验证记录（2026-09-10）

- 权威入口：根目录 `knowledge-center.sh start/stop/restart/status`，五个业务服务统一管理。
- HTTP：`14110/api/health`、`18010/api/health`、`14200/knowledge-center/api/auth/config`、`13510/knowledge-center/`、`13510/pingcode-materials/` 均返回 200。
- 旧路径扫描：应用、包、工具、测试、配置范围未发现 `agent-runner/{data,outlines,tmp,lib,scripts}`、`tests/agent-runner` 或 `scripts/pre-check-references.sh` 运行时引用；历史设计文档中的旧路径保留为历史事实。
- 符号链接：仅发现 `apps/pingcode-api/.venv` 内 4 个 Python 虚拟环境链接，不属于兼容包装或旧路径入口。
