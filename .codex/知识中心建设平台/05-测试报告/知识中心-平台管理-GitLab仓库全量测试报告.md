# 知识中心-平台管理-GitLab仓库全量测试报告

> 测试日期：2026-09-04
> 测试账号：何阳（`heyang`，CAS，`PLATFORM_ADMIN`）
> 测试范围：平台管理 GitLab 多仓库、OAuth、连接验证、刷新恢复、管理操作、统计契约

## 1. 基线问题

| 编号 | 问题 | 根因 | 修复状态 |
|---|---|---|---|
| GL-01 | 刷新 GitLab 标签页后退回登录界面 | `gitlabProjection` 初始为 `null`，渲染读取 `connections` 抛异常；顶层捕获器将渲染异常误判为认证失败 | 通过 |
| GL-02 | 点击“验证连接”直接失败 | `yasdoc/ympdoc` 无服务凭证且当前用户未建立 GitLab OAuth 会话；页面缺少授权入口 | 条件通过，等待何阳授权实测 |
| GL-03 | 新增表单写“保存并验证”但只执行保存 | 前端未调用验证接口 | 通过 |
| GL-04 | 仓库统计 HTTP 测试失败 | 后端返回 `chapters/documents`，前端契约使用 `chapterCount/documentCount` | 通过 |
| GL-05 | GitLab E2E 无法覆盖当前页面 | 用例仍引用旧单仓库表单 | 通过 |
| GL-06 | Firefox 新增连接偶发不提交 | 后台数据加载完成后整页重绘，清空了正在填写的新增表单 | 通过 |

## 2. 自动化测试结果

- 语法检查：`app.js`、平台管理视图、GitLab 连接器、路由和 E2E 用例全部通过。
- Jest：5 个测试套件，46 项测试全部通过。
- Playwright：Chromium 与 Firefox 共 26 项测试全部通过。
- 页面覆盖：刷新保持登录、OAuth 未连接引导、验证中、验证成功、验证失败、重新验证、新增幂等请求，以及 375/768/1024/1440 宽度。
- HTTP 覆盖：新增、编辑、验证成功、验证失败持久化、停用、启用、停用后拒绝验证、仓库读取和统计字段契约。
- 自动化测试使用临时配置或网络响应隔离，未修改正式 `yasdoc/ympdoc` 配置。

## 3. 真实 GitLab 验证

| 场景 | 状态 | 说明 |
|---|---|---|
| 何阳 CAS 登录及管理员投影 | 条件通过 | 认证服务用户目录已确认 `heyang` 已启用并含 `PLATFORM_ADMIN`、`KNOWLEDGE_EDITOR`、`OUTLINE_MANAGER`、`REVIEWER` |
| GitLab OAuth 授权 | 未执行 | 需要何阳在浏览器完成 GitLab 交互授权 |
| `yasdoc` 分支读取验证 | 未执行 | OAuth 完成后执行，只读操作 |
| `ympdoc` 分支读取验证 | 未执行 | OAuth 完成后执行，只读操作 |
| 授权后刷新保持登录 | 未执行 | OAuth 完成后执行 |

## 4. 安全与边界

- 不记录 CAS 密码、GitLab Token、Cookie 或 OAuth 授权码。
- 正式 `yasdoc/ympdoc` 仅执行只读验证。
- 新增、编辑、停用和启用使用临时隔离配置测试。
- 真实 GitLab 权限不足时记录为外部权限阻塞，不修改仓库权限。
