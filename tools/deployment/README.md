# 知识中心部署工具

HTTP 私网开发环境连接 GitLab 时，已有配置可使用 `KNOWLEDGE_CENTER_GITLAB_OAUTH_ALLOW_HTTP=true`（兼容旧 `KNOWLEDGE_CENTER_GITLAB_OAUTH_DEV_HTTP=true`）。支持 10/8、172.16/12、192.168/16 和本机地址；默认、公网 HTTP 及非 HTTP/HTTPS 协议仍被拒绝。新变量优先，配置后执行原始 restart。GitLab 应用回调地址须匹配进程实际使用的公开地址，详见[OAuth 回调设计](../../docs/operations/production-deployment.md)。

统一构建由 `knowledge-center.sh` 传递其已验证的 Python 入口，避免生产 PATH 中的旧系统 Python 被误用于语法检查；直接调用构建脚本时可通过 `KNOWLEDGE_CENTER_PYTHON_BIN=/path/to/python` 指定同一入口。

## 离线环境局部重启

生产已安装 JDK 时可直接编译。知识中心使用根 lockfile；离线环境需准备 npm 缓存，不能复用另一架构的 node_modules。构建脚本发现 `runtime/deployment/npm-cache` 后自动使用 `npm ci --offline --include=dev`，安装失败立即停止，不覆盖已有产物或停止服务。自定义缓存可设置 `KNOWLEDGE_CENTER_NPM_CACHE`。

在联网机器核对根 lockfile 与生产一致后，下载锁定包：

```bash
sha256sum package-lock.json
mkdir -p runtime/deployment/npm-cache
node -e 'const p=require("./package-lock.json").packages; console.log([...new Set(Object.values(p).map(x=>x.resolved).filter(Boolean))].join("\n"))' \
  | while IFS= read -r url; do
      npm cache add "$url" --cache "$PWD/runtime/deployment/npm-cache" --ignore-scripts || exit 1
    done
npm cache verify --cache "$PWD/runtime/deployment/npm-cache"
tar -czf runtime/deployment/npm-cache.tar.gz -C runtime/deployment/npm-cache _cacache
sha256sum runtime/deployment/npm-cache.tar.gz
```

上传至生产暂存目录，核对 SHA-256 后解压至生产 `runtime/deployment/npm-cache`。不要同步 `config/`。随后在生产执行 `./knowledge-center.sh restart`，查看 `runtime/agent-runner/logs/knowledge-center-isolated/knowledge-center-build.log` 与 `./knowledge-center.sh status --verbose`。以后依赖清单未变更可重复使用缓存；清单变更后需先补充缺失包，不能绕过校验。

现有生产目录可原地执行 `./knowledge-center.sh restart`。仅 JRE 的生产机需要从可信构建机接收与生产源码及构建入口完全匹配、摘要有效的统一产物，同时具备 `apps/yashandb-storage/lib/yashandb-jdbc.jar`。构建入口缓存命中后无需 Java 编译器；源码或摘要不匹配时仍要求 JDK，不会静默跳过构建验证。局部修复应先备份、暂存上传、验证后替换，不发布工作区其他业务改动。详见[离线重启设计](../../docs/operations/production-deployment.md)。

重启会识别工作目录属于本仓库 `apps/yashandb-storage`、且 Java 类路径来自本仓库 `runtime/build/*/current` 的遗留 Storage 实例；构建目录切换后也会受控停止并启动新实例。其他工作目录或类路径不匹配的 14210 进程仍保留现场并阻止接管。检查运行状态时应使用启动所用的 `KNOWLEDGE_CENTER_BUILD_ROOT`；默认完整重启会生成默认构建目录。

## 生产同步与一键升级

生产环境默认为 `hey@172.16.91.10:22`，部署根目录为 `/data/code/kb-builder`。生产数据库为 `192.168.23.136:1688/yasdb`，用户 `pf_knowledge`（环境属性经用户确认，连接目标经生产配置与只读查询核对）。本地测试知识中心为 `192.168.130.180`（前端 `13510`、文档 API `14110`、PingCode API `18010`）；测试服务的位置不能作为数据库环境属性的判断依据，测试应使用独立数据库或 Schema。密码、Token 和 OAuth Secret 不得写入本文档或发布脚本。

```bash
./tools/deployment/sync-production.sh --check
./tools/deployment/sync-production.sh --apply
./tools/deployment/sync-production.sh --rollback 20261012-180000
```

参数可用 `--host`、`--user`、`--port`、`--remote-dir`、`--identity-file` 和 `--version` 覆盖。检查模式不连接生产机；只有显式 `--apply` 或 `--rollback` 才会进行生产写入。版本化发布、配置保留和失败恢复详见[生产发布与回退设计](../../docs/operations/production-deployment.md)。

发布机默认使用 `~/.ssh/id_ed25519`。目标机管理员需将发布机的 `.pub` 公钥追加至 hey 用户的 `~/.ssh/authorized_keys`，目录权限为 `0700`、文件权限为 `0600`。配置后验证：

```bash
ssh -o BatchMode=yes -o IdentitiesOnly=yes -i ~/.ssh/id_ed25519 -p 22 hey@172.16.91.10 'printf reachable'
```

生产配置固定保存在 `shared/config/knowledge-center/.env` 和 `shared/config/yashandb/service.env`，权限为 `0600`；`shared/runtime` 保存运行数据。脚本不会从本地覆盖这些内容。

`knowledge-center.sh` 只负责诊断与运行生命周期，不隐式安装系统依赖。本目录的 `install-knowledge-center.sh` 是唯一依赖安装入口：

```bash
./tools/deployment/install-knowledge-center.sh --check
./tools/deployment/install-knowledge-center.sh --apply
./tools/deployment/install-knowledge-center.sh --apply --component java
./tools/deployment/install-knowledge-center.sh --offline-bundle /path/to/bundle
```

`--check` 只展示将要执行的命令，`--apply` 才执行安装。在线模式支持 Kylin/RHEL/Rocky/Alma/CentOS 的 `dnf|yum` 和 Ubuntu/Debian 的 `apt-get`。如果系统软件源无法提供 Java 17、Python 3.10+ 或 Node.js 20+，安装器会停止并要求使用离线运行时，不会替换系统默认 Java/Python。

离线目录必须包含 `manifest.sha256`，可按需提供 `toolchains/java-17/`、`toolchains/python-3.11/`、`toolchains/node-20/`、`python-wheels/`、`playwright-browsers/` 和 `node-dependencies/node_modules.tar.gz`。选择 Python 组件时，`playwright-browsers/` 必须包含与 requirements 中 Playwright 版本匹配的 Chromium 制品。离线模式不访问公网，缺少所需制品时直接失败。

在线 Python 安装会将 Chromium 下载到 `runtime/browsers/playwright/`：DEB 系使用 Playwright `--with-deps`，RPM 系由安装器显式安装 Chromium 运行库。完成后真实启动无头浏览器验证可用性。`doctor` 也会单独报告 Python 包与 Chromium 制品的状态，避免“可导入但不能启动”的假通过。

安装器只在配置不存在时从模板初始化 `config/knowledge-center/.env` 和 `config/yashandb/service.env`，文件权限设为 `0600`，不覆盖现有配置。数据库连接仍只以 `config/yashandb/service.env` 为持久事实源。

### 错误定位补充（2026-10-13）

发布日志使用 DEPLOYMENT_FAILED 记录失败阶段和日志路径；恢复失败另报 DEPLOYMENT_RECOVERY_FAILED，原 runtime 缺失另报 DEPLOYMENT_RECOVERY_RUNTIME_MISSING。
