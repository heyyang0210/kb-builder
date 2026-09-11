# 运行数据维护

`runtime/` 不进入 Git，但不是可整体清空的临时目录。

- `agent-runner/data`、`agent-runner/outlines`、`agent-runner/tmp` 以及 `pingcode/web` 可能包含持久业务状态，备份必须覆盖这些目录及 `config/` 中独立保护的本地配置。
- `logs`、模块日志和 `cache` 按保留周期处理；清理前确认用途。
- `output` 保存导出产物；`browser-data` 含登录会话，按敏感数据管理。
- `dumps/unclassified/dump.rdb` 是未确认用途的旧 Redis 转储，暂存保留，不自动恢复或删除。
- `migration-residuals` 保存旧 code/scripts/测试输出，确认历史资料归属前不清理。
- `repository-migration` 保存本轮状态基线及逐项移动记录，限制本机访问。

迁移期间同文件系统重命名保留文件身份。后续备份应在停写或一致性快照下执行；不要把 Git 当作运行数据备份。恢复时先停对应服务，恢复原始权限、数据和配置，再执行健康检查。
