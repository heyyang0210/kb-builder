# Git 提交规范

本项目遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范，结合项目实际情况制定以下提交规范。

## 提交信息格式

```
<type>(<scope>): <subject>

[可选的正文]

[可选的脚注]
```

## 类型 (type)

| 类型 | 说明 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat(agent-runner): 新增文档路径管理API` |
| `fix` | 修复 Bug | `fix(pingcode): 修复关键词抽取空指针异常` |
| `docs` | 文档更新 | `docs: 更新README目录结构说明` |
| `style` | 代码格式调整（不影响逻辑） | `style(frontend): 统一缩进和空格` |
| `refactor` | 重构（非新功能、非修复） | `refactor(backend): 重构服务启动流程` |
| `perf` | 性能优化 | `perf(retrieval): 优化三层索引查询性能` |
| `test` | 测试相关 | `test(llm-client): 新增JSON修复重试测试` |
| `chore` | 构建/工具/依赖变更 | `chore: 升级openai依赖到4.20.0` |
| `revert` | 回滚提交 | `revert: 回滚 feat(agent-runner): xxx` |
| `ci` | CI/CD 配置变更 | `ci: 更新GitHub Actions工作流` |

## 作用域 (scope)

根据项目模块划分：

| 作用域 | 说明 |
|--------|------|
| `agent-runner` | Agent Runner 核心服务（Node.js） |
| `pingcode` | PingCode 处理管道（Python） |
| `pingcode-backend` | PingCode Web 后端服务 |
| `pingcode-frontend` | PingCode Web 前端 |
| `retrieval` | 检索策略模块 |
| `llm` | LLM 客户端相关 |
| `frontend` | prompt-generator 前端 |
| `config` | 配置文件 |
| `scripts` | 脚本工具 |
| 无 scope | 根目录或跨模块变更 |

## 主题 (subject)

- 使用中文描述变更内容
- 不超过 72 个字符
- 不以句号结尾
- 使用祈使语气（如"新增"、"修复"、"更新"）

## 正文 (body)

- 解释变更的动机和与之前行为的对比
- 列出新增/修改/删除的文件
- 每行不超过 72 个字符

## 示例

### 功能新增

```
feat(agent-runner): 新增多路径文档管理功能

- 新增 document-paths.json 配置文件支持多路径展示
- 重构 document.js 路由支持多根目录树扫描
- 文档 ID 编码升级为 rootId:relativePath 格式
- 前端增加路径管理对话框和只读标识

修改文件:
- agent-runner/config/document-paths.json (新增)
- agent-runner/routes/document.js (重构)
- agent-runner/frontend/prompt-generator.html (修改)
```

### Bug 修复

```
fix(pingcode-backend): 修复关键词抽取空指针异常

当文档内容为空时，metadata_service 未做空值检查导致 KeyError。
增加空内容校验和默认值处理。

Closes #123
```

### 文档更新

```
docs: 更新项目架构文档和API说明

- 补充 Retriever 三层索引设计说明
- 更新 README 目录结构图
- 新增资料预处理框架使用指南
```

### 重构

```
refactor(agent-runner): 重构服务启动流程

将服务启动逻辑从 server.js 抽取到独立的 startup.js 模块，
支持更灵活的配置加载和错误处理。
```

### 依赖更新

```
chore: 升级核心依赖版本

- openai: ^4.20.0 → ^4.50.0
- express: ^4.18.2 → ^4.19.0
- 更新 package-lock.json
```

## 提交原则

1. **原子性**：每个提交只做一件事，便于回滚和审查
2. **完整性**：相关变更尽量放在一个提交中
3. **独立性**：不相关的修改不要混在同一个提交
4. **可追溯**：提交信息应能说明变更原因和影响
5. **不提交敏感信息**：API Key、密码等使用环境变量或配置文件模板
6. 不明确是否需要提交，交互式确认

## 分支策略

- `main` / `master`：稳定版本分支
- `dev`：开发分支，日常开发在此进行
- `feature/*`：功能分支
- `fix/*`：修复分支
- `release/*`：发布分支

## 提交前检查

```bash
# 检查代码语法
node -c routes/document.js

# 运行相关测试
npm test

# 查看变更文件
git status
git diff --stat
```

## 提交命令示例

```bash
# 单文件提交
git add agent-runner/routes/document.js
git commit -m "feat(agent-runner): 新增文档路径管理API"

# 多文件分组提交
git add agent-runner/config/document-paths.json
git add agent-runner/routes/document.js
git commit -m "feat(agent-runner): 新增多路径文档管理

- 新增配置文件支持多路径展示
- 重构路由支持多根目录扫描"

# 带 issue 关联
git commit -m "fix(pingcode): 修复关键词抽取异常

Closes #123"
```

## 工具推荐

- **commitlint**：自动校验提交信息格式
- **husky**：Git hooks 管理
- **commitizen**：交互式生成规范提交信息

---

*最后更新：2026-08-04*
