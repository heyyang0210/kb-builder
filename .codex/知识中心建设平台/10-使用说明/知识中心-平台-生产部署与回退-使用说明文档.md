# 知识中心生产发布与回退设计

## 私网开发环境 GitLab OAuth HTTP 回调

显式设置 `KNOWLEDGE_CENTER_GITLAB_OAUTH_ALLOW_HTTP=true` 时，OAuth 回调允许 HTTP 的 localhost、127/8 及 RFC1918 私网 IPv4（10/8、172.16/12、192.168/16）。旧变量 `KNOWLEDGE_CENTER_GITLAB_OAUTH_DEV_HTTP` 保持兼容；新变量存在时优先，设为 false 可覆盖旧变量的 true。默认仍要求 HTTPS；其他协议和公网 HTTP 即使开启开关也拒绝。

2026-10-13 的 172.16.91.10 故障来自代码仅识别 DEV_HTTP、地址规则遗漏 172.16/12，而用户已配置 ALLOW_HTTP。修复配置读取与私网判断，保持生产已有 config 内容不变。回调来自生命周期入口的公开访问地址；GitLab 应用登记的 Redirect URI 必须与运行进程实际回调完全一致。使用管理员真实 HTTP 请求验证 OAuth start 返回 302、授权端点可达；用户本人仍需在 GitLab 登录同意授权，平台不能代替其授权。

## 知识中心离线构建说明（2026-10-13）

知识中心使用根 `package-lock.json` 锁定依赖。联网机器按该清单下载 resolved 包至 npm 内容寻址缓存，校验传输包 SHA-256 后上传生产 `runtime/deployment/npm-cache`。生产不复用其他架构的 node_modules，而是在暂存目录执行 `npm ci --offline --include=dev --ignore-scripts`。可通过 `KNOWLEDGE_CENTER_NPM_CACHE` 指定缓存位置；默认缓存存在时启用离线安装，否则维持联网安装。

安装失败必须显式退出，不得继续构建。缓存缺失或锁定依赖变化时报告需要补充离线包。完整构建成功前不停止服务、不替换现有构建产物。配置目录不参与传输或修改。

## 原地离线部署契约（2026-10-13）

生产与测试各自在自己的部署根目录执行 `./knowledge-center.sh restart`。不迁移 `config/` 或 `runtime/`，不创建会改变生命周期入口的 `current` 符号链接。发布输入必须是经过校验的离线包，不能直接同步开发工作区。

离线包包含 `files/`（源码及预构建产物）和 `manifest.sha256`（相对于包根目录的每个文件摘要）。发布器拒绝包中的 `config/`、`.git/`、`external/`、`runtime/`（但允许 `runtime/build/knowledge-center/current/`）、密钥和环境文件；既有生产 `config/` 不改权限、不创建、不删除、不覆盖。初次部署要求生产配置已由管理员准备；升级要求目标根目录及配置已经存在。

`--check` 在本地和远端只读验证包、SSH、工具、空间、配置存在与权限、既有版本，并输出将变动的文件清单；检查失败不得进入同步。`--install`、`--upgrade` 分别执行初装与升级，升级前保存受管理文件及产物的完整快照。包先上传暂存并复验摘要，然后在停服前备份并应用文件；新版本用原目录入口执行 `restart`，失败则从快照恢复并重启旧版。`--rollback VERSION` 从本机保存的快照恢复，不重新构建、不访问公网。日志和汇报表保存在 `runtime/deployment/releases/`，不得包含配置内容。

首次部署、升级与回退必须在隔离目标全流程测试，包括包损坏、缺失配置、失败重启和配置哈希不变。生产发布另需明确执行命令，隔离测试不得以成功替代生产验收。

## 离线生产原地重启修复

对于现有 `/data/code/kb-builder` 布局，局部维护不迁移到 releases/shared。生产业务源码保持既有提交，仅同步明确授权的构建入口修复、JDBC 驱动与同源构建产物；不得将其他工作区改动带入生产。

统一构建入口先验证源码指纹、迁移摘要、Node/npm/Python 版本和完整产物摘要。缓存有效时仅需 Java 运行环境，不要求生产安装编译器或匹配构建机的 Java 编译器版本；缓存失效时仍必须具备 JDK 17+。禁止改写 manifest 指纹制造缓存命中。

源码指纹排除 `.venv`：虚拟环境中的安装路径与平台相关二进制不是源码输入；Python 运行依赖仍由生命周期入口验证。隔离构建使用与生产相同的 Node/npm/Python 版本，版本记录由真实命令生成。

构建机从生产当前提交建立隔离副本，加入获准的脚本修复，在联网构建机下载依赖并真实构建；生产离线接收制品。替换前备份原脚本和构建目录，上传至暂存目录并校验，再验证构建入口缓存命中，最后执行 `./knowledge-center.sh restart`。构建失败不停止旧服务；启动失败则保留日志、恢复备份产物并通过既有入口恢复服务（旧脚本可显式使用 `restart --no-build` 恢复）。生产配置和运行数据不覆盖，不新增数据库迁移。

验收包括重启退出码为零、四个组件健康且端口监听、真实 HTTP 请求及只读 `apps/yashandb-storage/start.sh probe`。检查仅后移编译器要求，配置权限、认证、运行依赖及健康门禁保持有效。

2026-10-13 实际启动发现 PingCode 的 `CommittedRebuildRecordStream.documents` 使用 `MappingProxyType({})` 直接作为 dataclass 默认值，Python 3.11 拒绝导入。局部修复为 `field(default_factory=lambda: MappingProxyType({}))`，保持不可变空映射语义；此启动兼容修复需与构建入口一起纳入同源构建。旧产物回退无法解决源码导入错误，恢复后必须真实请求 PingCode API。

## 目标与目录

发布入口为 `tools/deployment/sync-production.sh`，默认目标是 `hey@172.16.91.10:22` 的 `/data/code/kb-builder`。生产目录采用：

```text
/data/code/kb-builder/
├── current -> releases/<版本>
├── releases/<版本>/
└── shared/
    ├── config/knowledge-center/.env
    ├── config/yashandb/service.env
    ├── deployment/logs/
    └── runtime/
```

版本默认为时间戳，也可由 `--version` 指定。current 使用临时符号链接和原子重命名切换。生产环境文件和运行数据跨版本共享，不进入代码发布包。

## 发布流程

1. 本地检查 SSH、rsync、私钥权限和参数；`--check` 到此结束，不访问生产机。
2. `--apply` 只读检查 SSH、远端工具、目录写权限和至少 2 GiB 可用空间。
3. rsync 将源码写入新的 `releases/<版本>`，排除 `.git`、`external`、`runtime`、`node_modules`、环境文件、密钥和日志。
4. 使用旧版本生命周期入口停服；首次迁移时把既有 runtime 和生产配置迁入 shared，已有共享配置不覆盖。
5. 候选版本连接 shared 配置及 runtime，运行 `npm ci` 和统一构建，然后切换 current。
6. 新版本执行 `knowledge-center.sh restart --no-build` 和 `status --verbose`；由生命周期入口检查组件端口及 HTTP 健康状态。

旧版本进程须由旧版本入口安全停止，因此发布存在从停服到候选版本健康检查通过的维护窗口。

## 失败恢复与回退

构建、启动或健康检查失败时，脚本恢复原 current，并用旧版本完整重建、重启。恢复也失败时发布返回非零，日志保存在 `shared/deployment/logs`；应人工诊断，不要覆盖现场。

```bash
./tools/deployment/sync-production.sh --rollback <已有版本>
```

回退会执行停服、切换、构建、重启和健康检查。脚本不自动执行数据库迁移；待执行迁移会由现有启动门禁阻止，须独立审核迁移及回退兼容性。

## 安全与验收

- 私钥仅保存在发布机并保持 0400/0600；生产机管理员通过受控通道配置公钥。
- 生产 `.env`、数据库密码、Token、OAuth Secret 和 runtime 不从本地同步。
- 发布前执行 `--check`；首次发布前确认 shared 配置为 0600，并备份 runtime。
- 验收以退出码、`status --verbose` 的 4/4 健康结果和生产发布日志为准。
- 定期同步须由人工或受控调度显式调用 `--apply`；脚本不创建无人值守定时任务。

## 发布失败定位（2026-10-13）

失败日志记录 `DEPLOYMENT_FAILED`、失败阶段、退出码、目标版本及日志路径。恢复旧入口失败时另报 `DEPLOYMENT_RECOVERY_FAILED`，记录恢复退出码、旧入口、原 runtime 和共享 runtime 路径；原 runtime 缺失时明确提示该事实。不改变迁移和回退行为，也不将发起恢复等同于恢复成功。
