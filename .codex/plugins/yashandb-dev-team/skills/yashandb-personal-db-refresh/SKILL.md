---
name: yashandb-personal-db-refresh
description: 使用 exp/imp 将源 YashanDB Schema 全量刷新到个人数据库，并生成元数据和逐表数据行数报告。
---

# YashanDB 个人数据库全量刷新

## 目标

每次都从配置的源 Schema 重新执行 `exp OWNER=... ROWS=Y`，再用 `imp FROMUSER=... TOUSER=... ROWS=Y` 导入个人数据库。执行入口固定为三个 Shell 脚本：读取配置、清理个人库、全量导出并导入。

脚本使用 Bash、`jq`、YashanDB 的 `exp`、`imp` 和 `yasql` 命令，不使用 Python、Java、Node.js 或其他脚本语言。

## 配置

配置文件固定为 `scripts/config.json`，同时保存源数据库和个人目标数据库连接信息。该文件包含密码，已经加入 Git 忽略规则；权限必须为 `0600`。根据 `scripts/config.example.json` 创建并填写配置：

```json
{
  "sourceDatabase": {
    "host": "源数据库主机名或 IP",
    "port": 1688,
    "username": "有权导出源 Schema 的用户",
    "password": "源库密码",
    "owner": "源 Schema 名"
  },
  "personalDatabase": {
    "host": "个人数据库主机名或 IP",
    "port": 1688,
    "username": "有权导入个人 Schema 的用户",
    "password": "个人库密码",
    "owner": "个人目标 Schema 名"
  }
}
```

跨 Schema 导出或导入要求连接用户拥有 YashanDB 所需的 DBA 权限。配置检查只显示地址和 Schema，不显示密码。不得把真实凭据提交到 Git 或写入迁移报告。

## 执行

从仓库根目录按顺序运行：

```bash
cp .codex/plugins/yashandb-dev-team/skills/yashandb-personal-db-refresh/scripts/config.example.json .codex/plugins/yashandb-dev-team/skills/yashandb-personal-db-refresh/scripts/config.json
chmod 600 .codex/plugins/yashandb-dev-team/skills/yashandb-personal-db-refresh/scripts/config.json
# 编辑 config.json，填入源库和个人库连接信息
bash .codex/plugins/yashandb-dev-team/skills/yashandb-personal-db-refresh/scripts/read-config.sh
bash .codex/plugins/yashandb-dev-team/skills/yashandb-personal-db-refresh/scripts/clean-personal-db.sh
bash .codex/plugins/yashandb-dev-team/skills/yashandb-personal-db-refresh/scripts/export-import.sh
```

三个脚本的职责：

1. `read-config.sh` 校验 JSON 格式、权限、地址、用户名和 Schema，并显示脱敏后的连接目标；其他两个脚本也会调用它读取同一配置。
2. `clean-personal-db.sh` 检查目标对象类型，先全量备份个人 Schema，再要求输入完整目标地址确认，最后清理受支持的对象。遇到未知对象类型或备份期间对象清单变化时停止。
3. `export-import.sh` 确认目标 Schema 已清空，每次新建导出文件，使用 exp 全量导出源 Schema，再用 imp 导入目标 Schema。它会检查导出前后源对象清单是否变化，并核对 exp/imp 日志中的表名和行数，然后生成迁移报告。

清理脚本备份和迁移产物写入 `runtime/database-refresh/`，目录权限为 `0700`，文件权限为 `0600`。清理和迁移是两个独立步骤；若迁移失败，使用清理步骤生成的目标备份恢复个人库。不要对共享库或生产库执行清理。

## 迁移报告

报告位于本次迁移目录的 `report.md`，包含迁移耗时（秒）及两张表：

| 报告表 | 字段 |
| --- | --- |
| 元数据信息 | 对象名称、对象类型 |
| 数据信息 | 表名称、表含义、导出数据行数、导入数据行数 |

对象名称和类型来自源 Schema 的对象视图；表含义读取表注释，没有注释时显示“未填写”。导出和导入行数取自 exp/imp 逐表日志；缺失或不一致时报告标记异常，脚本以失败状态退出。

## 限制

- YashanDB exp/imp 日志会报告逐表导出和导入行数；行数相同不证明每列内容相同。
- 源库在导出期间仍可能写入。该流程不提供跨表点时一致性保证。
- UDT、加密列、长对象定义、版本/部署形态、表空间或默认表类型不兼容，都可能导致对象或数据无法导入。工具退出失败或日志提示跳过时，不能把迁移标记为成功。
- 需要确认命令参数、日志格式或限制时，先查询已配置的 YashanDB 知识库 MCP，再决定脚本行为；MCP 不可用时通过本机 `exp -h`、`imp -h` 和对应版本文档核对。
