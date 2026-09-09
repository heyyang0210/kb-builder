# 知识中心-平台管理-治理权限与GitLab连接-详细设计文档

> 设计编号：KC-M08-DETAIL-002
> 状态：平台管理已实现；个人授权入口待实施
> 版本：0.2.0
> 上游概要设计：`../02-概要设计/知识中心-前端-一级导航与信息架构-概要设计文档.md`

## 1. 设计目标与边界

平台管理面向平台管理员、空间管理员和审计人员，提供系统治理、用户权限和外部连接的治理入口。页面采用标签页分域，避免 GitLab 连接配置的长表单淹没权限和系统治理信息。

本设计只负责 GitLab 连接实例、平台认证方式、健康、启停和审计摘要，不负责手册映射。手册与连接、分支、中文路径和英文路径的关系由知识资产维护；仓库内容阅读和个人 GitLab 授权入口由知识资产提供；审阅和发布由审核与发布模块提供。

## 2. 信息架构与路由

```text
平台管理
├─ 系统治理       /knowledge-center/platform?tab=governance
├─ 用户权限       /knowledge-center/platform?tab=permissions
└─ GitLab 仓库    /knowledge-center/platform?tab=gitlab
```

无 `tab` 或无法识别时进入“系统治理”。标签页切换使用 History API，刷新、前进和后退保留标签页及其搜索、分页和选中连接；后端权限校验不因 URL 参数绕过。普通用户不能通过参数访问管理数据。

### 2.1 系统治理

只展示服务健康、存储迁移摘要、外部连接异常、待处理告警和最近治理操作。不显示 GitLab 详细配置、手册映射或角色复选框。所有数量和时间来自服务端投影；事实不存在时显示“暂无”或“暂不可用”。

```text
┌──────────────────────────────────────────────────────────────┐
│ 平台管理                                      更新时间        │
├──────────────────────────────────────────────────────────────┤
│ 系统治理 | 用户权限 | GitLab 仓库                            │
├──────────────────────────────────────────────────────────────┤
│ 服务状态：正常   存储状态：正常   外部连接：1 个需处理       │
├────────────────────────┬─────────────────────────────────────┤
│ 服务健康               │ 待处理事项                          │
│ 认证服务       正常    │ GitLab 授权待配置                    │
│ 文档服务       正常    │ [查看处理]                          │
├────────────────────────┴─────────────────────────────────────┤
│ 最近治理操作                                                 │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 用户权限

提供用户搜索、用户列表、账号状态、来源、角色编辑和审计摘要。CAS 登录成功的用户由后端写入平台用户目录后才可被授权；本页不展示 CAS Ticket、密码或 GitLab Token。只有平台管理员可编辑，后端写接口必须再次校验角色。

```text
┌──────────────────────────────────────────────────────────────┐
│ 系统治理 | 用户权限 | GitLab 仓库                            │
├──────────────────────────────────────────────────────────────┤
│ 搜索用户 [何阳                              ]                 │
├───────────────────────┬──────────────────────────────────────┤
│ 用户列表              │ 何阳                                  │
│ ● 何阳  hy            │ 账号：已激活  来源：CAS                 │
│ ○ 其他用户            │ 角色：[平台管理员] [知识编辑] …         │
│                       │ [保存权限]                            │
└───────────────────────┴──────────────────────────────────────┘
```

### 2.3 GitLab 仓库

GitLab 标签页只管理多个“GitLab 连接实例”。连接名称、地址、项目、认证方式、读取/写入能力、健康状态和启停状态在此维护。关联手册数是只读摘要，可跳转知识资产筛选结果，但不能在此编辑手册映射。

```text
┌──────────────────────────────────────────────────────────────┐
│ 系统治理 | 用户权限 | GitLab 仓库             [添加仓库]      │
├──────────────────────────────────────────────────────────────┤
│ GitLab 连接实例（不在此配置手册映射）                         │
├──────────────────────────────┬───────────────────────────────┤
│ 连接列表（搜索/分页）         │ 当前连接：yasdoc               │
│ ● yasdoc                      │ 状态：已验证                   │
│   cod-doc/yasdoc              │ 地址、项目、认证方式           │
│   已验证 · 9 本手册引用       │ 读取权限：已验证                │
│ ○ docs-sandbox                │ 写入权限：未启用                │
│   cod-doc/docs-test           │ 分支数量：25                    │
│   未验证 · 0 本手册引用       │ 关联手册：9（只读）              │
│ ○ docs-archive（已停用）      │ [验证连接] [编辑] [停用]         │
│                              │ 手册映射请到“知识资产”配置      │
└──────────────────────────────┴───────────────────────────────┘
```

## 3. GitLab 连接对象模型

```text
GitLabConnection
  id, name, baseUrl, projectPath, purpose
  authMode, credentialRef, capabilities
  status, health, lastVerifiedAt, createdBy, updatedAt
```

`authMode` 为 `user_oauth` 或 `service_account`；`credentialRef` 仅为加密凭证引用，前端永不展示正文。CAS 只认证知识中心用户，不等同于 GitLab API 授权。一个连接对应一个 GitLab 项目；多个项目必须创建多个连接实例。连接停用不删除历史映射、审计和内容快照；存在生效手册映射时禁止物理删除。`user_oauth` 表示业务用户从具体手册连接自己的 GitLab 账号，不表示管理员必须代替所有用户完成授权。

GitLab 投影在前端初始化为 `{ connections: [] }`，渲染入口对 `null`、缺失字段和加载失败均提供稳定状态。认证成功后的页面渲染异常属于应用错误，只展示应用内错误面板，不清空会话或退回登录页；只有认证接口明确返回 401 或会话过期事件时才显示登录界面。

关系边界如下：

```text
平台管理：GitLabConnection（平台配置、认证方式、健康、启停）
        ↓ 选择连接实例
知识资产：HandbookMapping（分支、中文路径、英文路径）
        ↓
仓库阅读/审核：个人 GitLab 授权、BranchContent、ReviewComment、MR 关联
```

“手册映射”不是平台管理的标签页、表单步骤或重复数据。平台管理仅展示 `linkedHandbookCount` 摘要和只读跳转。

## 4. GitLab 连接流程

添加仓库采用四步单列流程：

```text
基本信息 → 认证方式 → 连接验证 → 保存并启用
```

基本信息：连接名称、GitLab 地址、项目路径、用途（仅读取/读取并支持后续协作）。认证方式：用户 OAuth 或平台只读服务账号。验证检查地址、项目可访问性、授权状态和读取权限，可返回分支数量概览，但不得配置启用分支或内容路径。保存后连接才可在知识资产中选择。

用户 OAuth 模式下，管理员可通过“用我的 GitLab 验证连接”检查平台配置和项目可读性，但该授权只属于当前管理员，不代替业务用户授权。业务用户从具体手册阅读页发起自己的授权，OAuth 回调返回原手册和原文档位置。验证结果持久化为 `lastVerification`，包含状态、分支数量、验证时间或结构化错误。服务账号模式只投影 `credentialConfigured`，不返回凭证引用或 Token。

多连接列表使用服务端搜索和分页；批量验证允许部分成功，失败项可单独重试，不回滚已成功验证的连接。所有写操作使用幂等键并记录操作者、时间、前后值和结果。

## 5. 权限、状态与错误

- 平台管理员：新增、编辑、验证、停用、重新启用连接。
- 空间管理员：按授权范围查看连接健康，不得修改凭证或项目地址。
- 审计人员：只读连接状态和操作记录。
- 普通用户：不显示平台管理入口；具有 `knowledge:read` 且可见当前手册时，可从具体手册连接或解除自己的 GitLab 账号。

连接状态统一使用“未配置 / 待验证 / 已验证 / 验证失败 / 已停用”；错误同时提供错误码、原因、可恢复动作和服务端时间，不能只用颜色表达。仓库阅读前端按业务错误码区分“需要连接 GitLab 账号”（401）、“无权限访问此仓库内容”（403）、“该手册尚未配置可读内容”（映射类 404）、“找不到请求的仓库内容”（项目/分支/文件类 404）、“当前仓库连接不可读取”（409）和“仓库服务暂时不可用”（网络或 5xx），并给出对应恢复路径，不能将所有错误统称为仓库不可用。

## 6. 接口边界

```text
GET    /knowledge-center/api/gitlab/connections?q=&status=&page=&pageSize=
POST   /knowledge-center/api/gitlab/connections
PATCH  /knowledge-center/api/gitlab/connections/{id}
POST   /knowledge-center/api/gitlab/connections/{id}/verify
POST   /knowledge-center/api/gitlab/connections/{id}/disable
POST   /knowledge-center/api/gitlab/connections/{id}/enable
GET    /knowledge-center/api/gitlab/connections/{id}/audit
```

列表返回 `items`、`page`、`pageSize`、`total`、`linkedHandbookCount`、`health` 和 `generatedAt`。接口不返回凭证正文，不返回手册映射明细。知识资产通过自身接口读取映射和仓库内容。

仓库统计接口返回 `branch`、`chapterCount`、`documentCount` 和 `headSha`；兼容期同时返回旧字段 `chapters`、`documents`，两组数量必须一致。

个人授权使用手册级接口，由服务端反查连接，普通用户无需也不得枚举平台连接：

```text
GET  /knowledge-center/api/gitlab/handbooks/{handbookId}/access-status
GET  /knowledge-center/api/gitlab/handbooks/{handbookId}/oauth/start?returnTo=
POST /knowledge-center/api/gitlab/oauth/disconnect
```

前端修改前后简图、业务判断顺序和返回位置规则见 `知识中心-知识资产-GitLab个人授权入口-前端详细设计文档.md`。

## 7. 响应式、无障碍与验收

桌面端标签页横向排列，当前页以文字、底部边框/背景和 `aria-selected` 同时表达；移动端使用横向滚动单行标签或下拉选择，点击区域不少于 44px，不产生页面横向溢出。每个标签页提供加载、空态、错误和恢复状态。

验收要求：

1. GitLab 长配置不会与系统治理、用户权限同屏堆叠。
2. 三个标签页可深链、刷新和前进后退恢复。
3. GitLab 支持多个连接的搜索、分页、验证、停用和重新启用。
4. 平台管理不出现手册映射、分支或内容路径编辑控件。
5. 关联手册数量可追溯到知识资产，但不复制映射数据。
6. 非管理员写接口返回 403；页面不显示写操作。
7. 不展示 Token、Cookie、CAS Ticket 或凭证正文。
8. 执行 Markdown 链接检查、`git diff --check`、前端契约和响应式测试。

## 8. 实施记录

平台管理已实现三个标签页、GitLab 多连接列表与详情、添加/编辑/验证/停用/重新启用流程。连接接口支持 `POST`、`PATCH` 和状态命令，并在每次读取时根据当前映射配置计算 `linkedHandbookCount`。因此知识资产新增或调整手册映射后，平台管理下次加载会自动得到最新关联数量，不产生第二份映射数据。

实现文件：`agent-runner/frontend/knowledge-center/modules/platform-admin/view.js`、`agent-runner/frontend/knowledge-center/styles.css`、`agent-runner/frontend/knowledge-center/app.js`、`agent-runner/frontend/knowledge-center/common/api/gitlab-api.js`、`agent-runner/routes/knowledge-center.js`、`agent-runner/lib/gitlab-connector.js`。

验证证据：GitLab 相关 Jest `38/38` 通过；Chromium Playwright `6/6` 通过；Node 语法检查通过。真实 GitLab 内容读取仍受当前用户 OAuth 授权状态约束。
