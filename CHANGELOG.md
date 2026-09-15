# 变更记录

## v1.2.0 (2026-07-01)

### 新增

- **YashanDB 知识库 MCP 支持**：在资料引用策略中新增 MCP 作为最高优先级资料源
- **references/ 子目录扩展**：新增 `design-docs/`、`test-cases/`、`source/`、`mcp-yashandb-kb/` 四个资料目录及说明文档
- **前置检查脚本**：`scripts/pre-check-references.sh`，自动检查 MCP 配置、目录结构、文档完整性
- **Skill 前置检查强制提醒**：`00-通用生成-skill.md` 新增不可跳过的前置检查步骤

### 变更

- `config/shared/source-policy.md`：新增 MCP 为优先级①，原优先级依次后移，新增降级策略和前置检查章节
- `skills/00-通用生成-skill.md`：升级到 v1.1.0，新增前置检查步骤（步骤0），输入 JSON 新增 `mcp_query` 字段
- `README.md`：新增「三、前置检查（必须）」章节，更新目录结构和快速开始步骤
- `references/README.md`：更新目录结构和引用优先级表

---

## v1.1.0 (2026-07-01)

### 变更

- **仓库独立化**：将所有外部引用的文件复制到仓库内部，使仓库成为完全独立、可完整运行的目录

### 新增

- **templates/ 目录**：复制 7 套知识模板 + 模板设计思路文档
  - `01-通用基础模板.md`
  - `02-理论机制类模板.md`
  - `03-实战调优类模板.md`
  - `04-架构对比类模板.md`
  - `05-运维SOP类模板.md`
  - `06-SQL开发参考类模板.md`
  - `07-兼容性差异类模板.md`
  - `模板设计思路.md`

- **outlines/ 目录**：复制知识点大纲
  - `数据库知识点大纲.md`（8个部分、38个章节、200+知识点）

- **references/ 目录**：复制参考资料
  - `oracle-kb/`：Oracle 知识库 7 篇文档（作为改写参考）
  - `README.md`：参考资料目录说明

### 更新

- `templates/README.md`：更新为指向本地模板文件
- `outlines/README.md`：更新为指向本地大纲文件
- `config/shared/source-policy.md`：更新 Oracle 知识库路径为 `references/oracle-kb/`
- `skills/00-通用生成-skill.md`：更新外部引用路径为本地路径
- `README.md`：移除外部依赖说明，标注仓库完全独立

---

## v1.0.0 (2026-07-01)

### 新增

- **Skill 仓库目录结构**：创建完整的 7 个目录（skills/config/templates/outlines/examples/output/logs）
- **共享配置**（3个文件）：
  - `config/shared/format-rules.md`：统一的文档格式约束
  - `config/shared/quality-standards.md`：三层质量检查标准
  - `config/shared/source-policy.md`：参考资料引用优先级规则
- **Skill 定义**（7个文件）：
  - `skills/00-通用生成-skill.md`：入口Skill，类型判断+路由
  - `skills/01-理论机制-skill.md`：理论机制类文档生成
  - `skills/02-实战调优-skill.md`：实战调优类文档生成
  - `skills/03-架构对比-skill.md`：架构对比类文档生成
  - `skills/04-运维SOP-skill.md`：运维SOP类文档生成
  - `skills/05-SQL开发参考-skill.md`：SQL/开发参考类文档生成
  - `skills/06-兼容性差异-skill.md`：兼容性差异类文档生成
- **引用说明**（3个文件）：
  - `templates/README.md`：模板引用说明
  - `outlines/README.md`：知识点大纲引用说明
  - `output/README.md`：输出目录说明
- **示例文档**：`examples/示例-序列兼容性差异.md`（完整的兼容性差异类生成示例）
- **README.md**：完整的使用说明，包含目录结构、快速开始、使用案例、质量保障、扩展指南
- **CHANGELOG.md**：本文件

### 设计决策记录

| 决策 | 选择 | 理由 |
|------|------|------|
| Skill分类方式 | 按知识类型（7类） | 灵活度高，同一知识点可服务不同读者 |
| 模板粒度 | 结构化骨架 + 填写指南 | AI和人工都能直接使用 |
| 兼容性差异章节 | 仅兼容性领域需要 | 避免所有文档都包含不必要的对比章节 |
| 资料引用优先级 | 设计文档 > Oracle知识库 > 测试用例 > 源码 | 权威性和可用性平衡 |
| 质量检查层次 | 结构检查 + 内容审阅 + 双库验证 | 三层递进，逐步提高可信度 |
