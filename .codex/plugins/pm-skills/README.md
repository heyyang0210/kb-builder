# PM Skills：竞品分析

来源：[phuryn/pm-skills](https://github.com/phuryn/pm-skills)，MIT 许可证。当前按用户要求下载此前推荐的单项 `competitor-analysis`，上游原文保持不变。

## 目录与版本

- `skills/competitor-analysis/SKILL.md`：上游竞品分析 Skill。
- `LICENSE`：上游 MIT 许可证，保留版权声明。
- `provenance.json`：固定提交、原始目录、下载时间及 SHA-256。

固定提交：`07b34f64ee828df08953f505b7f747aef85ae7c6`。

## 使用

下一轮可请求使用 `$competitor-analysis`。如果客户端未自动发现仓库内插件，明确要求先读取 `.codex/plugins/pm-skills/skills/competitor-analysis/SKILL.md`，再执行调研。文件存在不表示客户端已经完成插件注册。

示例：使用 competitor-analysis，结合当前知识中心平台需求，按模块寻找参考应用，以中文提供候选、可借鉴功能、证据链接和适配限制。

Skill 需要客户端提供联网检索和网页读取能力，下载本身不会添加这些工具。上游适用于竞品分析；REA 制品分析和平台迁移继续使用现有 rea 插件，当前未增加自动交接流程。

## 获取与验证

首次使用 skill-installer 下载归档未完成，停止该下载后通过 GitHub Contents API 获取同一固定提交的完整 Skill 目录。下载的 Skill 文件与 API 返回的 Git blob SHA-1 核对；所有上游文件另记录 SHA-256，许可证独立获取并保留。未执行上游代码或实际竞品研究。
