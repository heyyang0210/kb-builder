# YashanDB 存储 SQL

本目录保存存储服务实际使用的迁移脚本。当前模板管理和个人 GitLab OAuth 授权继续使用 `KC_RECORD` 聚合（命名空间、键、JSON/CLOB 载荷、修订号和软删除），不会额外创建未被运行时代码使用的重复业务表。OAuth 聚合使用 `gitlab-oauth/credentials`，其中令牌字段在进入存储服务前已经由业务层使用 AES-256-GCM 加密。

执行顺序由 `Main.migrate()` 明确调用 `001_schema_migration.sql`、`002_record.sql`、`003_migration_batch.sql`；脚本可重复执行，已存在对象不会被破坏。模板初始化使用 `tools/repository/initialize-templates.cjs`，默认 dry-run，传入 `--apply` 才写入开发数据库。

运行时模板版本通过聚合事务进行乐观 CAS，历史正文不可变。生产凭证由环境变量注入，不写入 SQL 或日志。
