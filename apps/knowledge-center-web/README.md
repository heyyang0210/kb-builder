# 知识中心 Web 网关

前端关闭 X 控件统一为红色 Lucide `x`、20px 图标与 44px 点击区；独立文档生成工作台使用本地 Lucide 与自身主题令牌。删除和移除项目控件不套用关闭规则，详见 `frontend/knowledge-center/README.md`。

大纲管理支持中文回收站、恢复及超级管理员专用清理确认（目标 ID + 原因）。现有内置 `admin` 在初始化时补齐 `SUPER_ADMIN`，保留账号 ID、密码及已有角色，不新增账号。普通平台管理员不能变更超级管理员权限。BFF 从实时会话覆盖大纲操作者和动作头，清理和预检查都必须经过授权网关。

GitLab 仓库验证：数据库配置模式下，最近成功/失败探测结果写入 `runtime/knowledge-center/gitlab-verifications.json`，列表合并与当前连接配置指纹匹配的结果。运行时文件可用 `KNOWLEDGE_CENTER_GITLAB_VERIFICATION_STORE` 覆盖，不改写数据库业务配置；失败建议由 `content-rules.json#/gitlabVerificationErrors` 提供。更新后需重启网关加载后端逻辑。

GitLab 仓库访问能力只提供 `read`（只读）和 `read_write`（读写）。管理页的“验证连接”当前仅验证读取，不证明读写配置具有写入权限；写回需以已审核的增量候选为来源，并等待明确的仓库文件映射规则。

新增 GitLab 连接需填写仓库实际默认分支。地址可填写 GitLab 站点 URL，或与项目路径完全匹配的完整项目 URL（保存时自动拆分）。认证方式分别是个人 GitLab 授权和平台预置服务凭证；数据库模式新增使用内部运行模式与启用状态默认值，编辑携带版本号以避免覆盖并发更改。

`frontend-server.js` 是知识中心平台内核入口，提供静态资源、Auth 模块、统一 API 路由和 Worker 代理。前端资源位于本目录的 `frontend/`，共享后端能力与模块注册表位于 `packages/agent-runner-core/`。浏览器只访问该平台入口；内部 Worker 和过渡期 Storage 端点不属于产品入口。

大纲治理接口将 Storage 的大写状态投影为小写公共枚举；已发布、已替代和已归档版本不显示“删除候选”，服务端继续执行不可变版本守卫。

平台发布时先在仓库根目录执行 `npm run build`。统一构建脚本将知识中心静态资源和 PingCode Vite 产物写入 `runtime/build/knowledge-center/current/web/`，并由根目录 `knowledge-center.sh` 通过 `KNOWLEDGE_CENTER_FRONTEND_ROOT` 和 `PINGCODE_WEB_DIST_DIR` 注入。源码目录回退仅用于单模块开发调试。

网关拆分路由时，入口解析的运行路径必须通过 `createKnowledgeCenterHandler` 的 `config` 显式注入。大纲模板和样例分别使用 `OUTLINE_TEMPLATE_PATH` 与 `OUTLINE_SAMPLE_PATH`；两者必须是存在、可读的绝对 `.xlsx` 普通文件，否则路由工厂以 `KNOWLEDGE_CENTER_CONFIG_INVALID` 拒绝启动。启动后的文件读取失败只返回 `404/503`，不得导致 13510 网关进程退出。

平台管理的 YashanDB 连接治理统一读写 `config/yashandb/service.env`（部署目录由已有的 `YASDB_CONFIG_DIR` 决定）。网关先执行真实 JDBC 探测，成功后以临时文件加原子替换更新同一配置文件；密码不回显、不复制到 JSON。保存后需重启服务，页面区分文件配置与当前运行连接。

认证公开配置会投影运行环境。根运维入口以 `KNOWLEDGE_CENTER_ENV` 为外部配置，规范化后通过 `KNOWLEDGE_CENTER_ENVIRONMENT` 显式传递给网关；隔离测试还必须同时传递 `KNOWLEDGE_CENTER_TEST_RUN_ID`，供 Playwright 在业务写入前校验实例身份。

文档生成工作台的 `tab=doc-mgmt&doc=<id>` 支持直接进入文档管理并打开指定文档。文档树消费后端真实目录；“AI 体系认知”根节点展示文件总数与 HTML 数量，并默认展开所有包含 HTML 的子目录，使页面可见 HTML 数量与 Linux 目录一致。

浏览器端源码由网关直接作为 ES Module 提供，不使用未经转换的 JSON import attributes。数据库 Markdown 规则通过普通 JavaScript 模块加载，避免部分浏览器在登录初始化前因 `Unexpected token 'with'` 中止入口模块；未随包发布 `.map` 的 vendor 文件不得保留 `sourceMappingURL` 声明。

```bash
node apps/knowledge-center-web/frontend-server.js
```
