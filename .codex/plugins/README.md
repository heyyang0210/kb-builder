# 本地插件与第三方工具

此目录存放项目内插件和独立下载的第三方源码。目录中的文件不会自动注册为当前 Codex 会话的 Skill 或 MCP 工具。

| 目录 | 内容 | 使用入口 |
| --- | --- | --- |
| `rea/` | Reverse Engineer Anything 项目插件 | `skills/reverse-engineer-anything/SKILL.md`；安装与验证见该目录 `README.md` |
| `craft-anything/` | [storytold/craft-anything](https://github.com/storytold/craft-anything) 源码快照 | 上游 `README.zh.md`；CLI、桌面程序及 MCP 均需另行构建和配置 |
| `mattpocock-skills/` | [mattpocock/skills](https://github.com/mattpocock/skills) 插件源码快照 | 已将本地目录注册为 Codex marketplace `mattpocock`，安装 `mattpocock-skills@mattpocock`；技能目录见 `skills/` |
| `pm-skills/` | 产品管理技能 | 见该目录 `README.md` |
| `yashandb-dev-team/` | 项目开发技能 | 见各技能的 `SKILL.md` |

个人数据库全量刷新流程见 `yashandb-dev-team/skills/yashandb-personal-db-refresh/SKILL.md`。配置文件位于 Skill 的 `scripts/config.json` 并由 Git 忽略；三个 Shell 脚本依次校验配置、备份并清理个人 Schema、全量导出和导入。迁移耗时、对象元数据及逐表导出/导入行数报告写入 `runtime/database-refresh/`，不得提交。

`craft-anything/` 固定于上游提交 `ad4d57d4ae5993e157a280b4237a0aa8a7a7fdb7`（2026-11-09 下载），保留上游文件及 MIT/Apache-2.0 双许可证。它没有 `SKILL.md`，因此不能以 `$craft-anything` 直接调用；本次仅下载源码，没有安装 Rust 依赖、构建程序或注册 MCP。构建要求 Rust 1.97 及以上，具体命令和平台依赖以上游 `README.zh.md` 为准。升级时重新核对上游提交、许可证和本地集成状态。

`mattpocock-skills/` 固定于上游提交 `4ae2317ddb22b046e26455e4f9c9b3aaaf62212d`（2026-11-10 下载），保留 MIT 许可证和插件清单；上游清单版本 `1.3.2` 声明 27 个正式 Skill，源码共含 39 个 `SKILL.md`（含试验和其他目录）。本机已从这个本地目录注册 marketplace 并安装插件，安装缓存位于 Codex 用户目录，当前会话不会自动加载新 Skill；后续会话可用。`setup-matt-pocock-skills` 的项目级引导尚未运行，使用其他工程 Skill 前应按上游说明配置。快照不会自动跟随上游更新；升级时重新核对提交、许可证、清单及本地规则冲突，再更新本地来源和安装缓存。
