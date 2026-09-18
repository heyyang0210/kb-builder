# YashanDB 存储 SQL

本目录保存存储服务实际执行的版本化迁移。文件统一命名为 `NNN_<action>_<object>.sql`：三位版本号控制顺序，后缀说明变更动作和对象。`start.sh migrate` 显式发现并按版本执行，在 `KC_SCHEMA_MIGRATION` 中记录文件名和 SHA-256；服务正常启动只校验版本、别名和摘要。已执行脚本不得修改或复用版本号，摘要不一致时拒绝迁移或启动。

历史迁移确需纠正文件名时，必须在 `migration-aliases.properties` 登记“新版本标识=数据库已记录的旧版本标识”。迁移器仅在别名双方数字版本相同且 SQL 摘要匹配时跳过执行；新环境记录新名称，已执行环境保留原记录。别名只解决历史改名兼容，不得用于替换或重排 SQL。

## 当前迁移

| 文件 | 内容 |
| --- | --- |
| `001_schema_migration.sql` | Schema 迁移版本与摘要 |
| `002_record.sql` | 兼容聚合记录 |
| `003_migration_batch.sql` | 数据迁移批次与对账结果 |
| `004_record_indexes.sql` | 聚合记录查询索引 |
| `005_manuals.sql` | 手册、大纲、技术领域和责任映射目标模型，共 12 张业务表、15 个显式业务索引、0 个物理外键（唯一约束索引不重复创建） |
| `006_add_manual_product_name.sql` | 在 `005_manuals.sql` 模型上为手册增加可直接读取的 `PRODUCT_NAME`，按现有 `PRODUCT_ID` 回填 `DB / YMP / YCM / YDC` 并收紧为非空 |
| `007_create_platform_principal.sql` | 创建知识中心本地人员主数据，并为手册责任人增加姓名快照 |
| `008_split_business_id_sequences.sql` | 将 13 张业务表从公共序列切换为每表独立 ID 序列；公共序列暂仅作回退兼容 |
| `009_consolidate_business_sequences.sql` | 按手册、大纲、责任治理和人员四个业务边界收敛序列，并删除公共及每表历史序列 |

手册与大纲采用稳定主体和版本分离模型：一本手册恰好对应一个 `KC_MANUAL_OUTLINE` 主体，大纲主体可以拥有多个 `KC_MANUAL_OUTLINE_VERSION`。大纲主体不重复保存手册的产品和名称，展示时通过 `MANUAL_ID` 获取。所有内部主键、模块内关联键以及权威目录 ID 均使用 `BIGINT`；主键生成器按手册、大纲、责任治理和人员四个稳定业务边界管理，不按每张物理表扩张序列数量。

跨表归属、删除保护和发布一致性由 Repository 事务与巡检保证，不使用物理外键。CAS、组织和产品目录仍是权威源；`KC_MANUAL.PRODUCT_ID` 保留关联键语义，`PRODUCT_NAME` 保存手册查询所需的产品名称快照，普通列表不为展示名发起关联查询。历史数据分阶段迁移期间 `KC_MANUAL.ORG_UNIT_ID` 可以为空，负责人没有稳定 CAS ID 时不写 `KC_MANUAL_OWNER`。

生产凭证只通过运行时环境变量注入，不得写入 SQL、配置文件、迁移报告或日志。
