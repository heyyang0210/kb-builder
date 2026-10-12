# 知识中心生产发布与回退设计

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
