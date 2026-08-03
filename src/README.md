# 外部源码目录

| 目录 | 来源 | 用途 | 管理方式 |
|---|---|---|---|
| `FastGPT/` | `https://github.com/labring/FastGPT.git` | FastGPT 集成评估、隔离部署和适配开发参考 | 锁定 commit 的官方源码快照，不提交到当前仓库 |

当前源码快照锁定 FastGPT `main` 分支 commit `bebf217ba809ada3c7e1b19d8877d02b0ec769fe`，通过 GitHub commit 源码归档获取（下载使用 `ghfast.top` 传输镜像），因此目录内不包含独立 `.git` 历史。归档 SHA-256 为 `7bb7bc6d4a087eb21966dcfbcb3dd5b570e5baeffa2fa9306dcb83a749fcf755`。当前仓库只维护适配代码、部署覆盖配置和集成设计，不直接修改上游源码。

集成设计见 `docs/16-FastGPT集成改造方案.md`。
