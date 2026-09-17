# YashanDB 存储 SQL

本目录保存存储服务实际执行的版本化迁移。`Main.migrate()` 自动发现文件名符合 `NNN_*.sql` 的脚本，按文件名升序执行，并在 `KC_SCHEMA_MIGRATION` 中记录文件名和 SHA-256；已执行脚本不得原地修改，摘要不一致时服务拒绝启动。

## 当前迁移

| 文件 | 内容 |
| --- | --- |
| `001_schema_migration.sql` | Schema 迁移版本与摘要 |
| `002_record.sql` | 兼容聚合记录 |
| `003_migration_batch.sql` | 数据迁移批次与对账结果 |
| `004_record_indexes.sql` | 聚合记录查询索引 |
| `005_manuals.sql` | 手册、大纲、技术领域和责任映射目标模型，共 12 张业务表、15 个显式业务索引、0 个物理外键（唯一约束索引不重复创建） |

手册与大纲采用稳定主体和版本分离模型：一本手册恰好对应一个 `KC_MANUAL_OUTLINE` 主体，大纲主体可以拥有多个 `KC_MANUAL_OUTLINE_VERSION`。大纲主体不重复保存手册的产品和名称，展示时通过 `MANUAL_ID` 获取。所有内部主键、模块内关联键以及权威目录 ID 均使用 `BIGINT`；内部主键由 `KC_BUSINESS_ID_SEQ` 自动生成。

跨表归属、删除保护和发布一致性由 Repository 事务与巡检保证，不使用物理外键。CAS、组织和产品目录仍是权威源；业务表只保存稳定 ID。历史数据分阶段迁移期间 `KC_MANUAL.ORG_UNIT_ID` 可以为空，负责人没有稳定 CAS ID 时不写 `KC_MANUAL_OWNER`。

生产凭证只通过运行时环境变量注入，不得写入 SQL、配置文件、迁移报告或日志。
