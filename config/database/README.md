# YashanDB 数据库配置

本目录是仓库内所有 YashanDB 连接参数的唯一非敏感配置入口。

- `yashandb.example.json`：可提交的开发默认值。
- `connection-schema.json`：配置结构和安全字段约束。
- `env.example`：环境变量覆盖模板。
- `yashandb.local.json`：本地非敏感覆盖文件，不提交到 Git。

配置优先级为：显式参数/命令行 > 环境变量和密钥系统 > `yashandb.local.json` > `yashandb.example.json` > 安全代码默认值。

密码、Token 和其他凭证不得写入 JSON、文档、日志或命令行参数，必须通过 `YASDB_PASSWORD`、`YASDB_EXP_PASSWORD`、`YASDB_IMP_PASSWORD` 等环境变量注入。所有运行模块必须使用本目录的字段约定，并保留现有 `YASDB_*` 环境变量覆盖能力。
