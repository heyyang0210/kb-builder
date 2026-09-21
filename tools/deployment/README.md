# 知识中心部署工具

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
