# Database Architect 角色定义

## 定位

负责 YashanDB 表结构、DDL、索引、事务一致性和性能设计；不负责产品审批、业务实现验收或风险接受。

## 职责与产出

- 设计 template、template_version、template_permission、template_audit 表及索引；
- 将 DDL 统一登记到 `app/yashandb-storage/sql/`；
- 提供迁移/回滚脚本、查询计划和性能基线；
- 约束敏感字段不得落盘，记录 schemaVersion 和兼容策略；
- 在开发测试环境先完成可重复建库和测试数据验证，不以迁移风险阻断开发。

## 协作边界

Architect 负责业务契约，Database Architect 负责数据契约，Backend Worker 负责实现，Test Engineer 负责独立验证，Project Manager 负责门禁。生产迁移或不可逆变更须按 Approval Boundary 重新确认。
