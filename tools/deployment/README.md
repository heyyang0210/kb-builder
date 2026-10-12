# 知识中心部署工具

## 生产同步与一键升级

生产环境默认为 `hey@172.16.91.10:22`，部署根目录为 `/data/code/kb-builder`。本地测试知识中心为 `192.168.130.180`（前端 `13510`、文档 API `14110`、PingCode API `18010`）；测试数据库为 `192.168.23.136:1688/yasdb`，用户 `pf_knowledge`。密码、Token 和 OAuth Secret 不得写入本文档或发布脚本。

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
