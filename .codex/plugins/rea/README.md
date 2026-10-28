# REA 逆向分析与平台能力迁移

来源：[morluto/rea — Reverse Engineer Anything](https://github.com/morluto/rea)，MIT。集成固定 npm 发布版本 `rea-agents@6.7.0`；上游 main 调研快照 `bcd1f95e688a2ac020a9d13f9c85e0ce321cb6b6`，不作为发布包身份。技能原文来自发布包，完整性记录见 `provenance.json`。

## 集成设计

本插件把“目标制品 → 证据 → 功能契约 → 平台适配 → 验收”连接起来。按标准开发路径，由主执行者和确定性工具完成来源核验、隔离安装及静态分析验证。普通完整源码仓库优先使用 rg/git 和现有测试；发布包、Electron、浏览器行为或二进制才使用 REA。

- `skills/reverse-engineer-anything/`：发布包自带官方技能与格式专项参考，保持原文。
- `skills/app-capability-transfer/`：中文平台适配工作流；先形成设计、接口和验收，再落入当前平台。
- `scripts/install.sh`：按锁文件安装到仓库 `runtime/rea/tooling`，不执行 npm 生命周期脚本、不安装可选 Frida。
- `scripts/rea.sh`：使用已安装版本；透传 CLI 参数，不在普通调用时下载软件。
- `tooling/`：固定入口版本与依赖锁；版本升级须同步官方技能、许可证、来源记录并重新验证。

运行依赖、样例和分析证据集中在 `runtime/rea/`。本插件不修改平台业务接口；分析结果由后续任务按项目设计及 API 验证规则落地。

## 使用

在仓库根目录执行（需要兼容的 Node.js、npm、Bash）：

```bash
bash .codex/plugins/rea/scripts/install.sh
bash .codex/plugins/rea/scripts/rea.sh --help
python3 .codex/plugins/rea/scripts/smoke-test.py
bash .codex/plugins/rea/scripts/rea.sh analyze-javascript-application /绝对路径/目标应用 --json > runtime/rea/app-evidence.json
```

技能入口：`$reverse-engineer-anything` 用于制品和行为分析；`$app-capability-transfer` 用于“分析某应用的某项功能，并适配当前平台”。客户端未发现项目插件时，可先明确要求读取对应 `SKILL.md`。文件存在不代表当前会话已自动加载。

CLI 支持静态 JavaScript/Electron 分析，无须运行目标或安装反编译引擎。网站交互需浏览器环境；Android 需 JADX/Java；原生反编译需 Ghidra/Hopper/IDA 等对应引擎。未安装引擎的能力不能视为已验证。

## MCP 状态

当前交付为本地插件技能与可执行 CLI，没有修改全局 Codex 配置，也不声称当前会话已有 MCP 工具。需要 MCP 时，在客户端支持的 stdio 配置中，将 command 设为 `bash`、args 设为 `["此插件 scripts/rea.sh 的绝对路径", "mcp"]`；REA 的 `mcp` 子命令启动 stdio 服务。重连后以实际工具列表为准。不要直接运行上游 setup 覆盖现有技能或配置。

## 验证

本轮验证结果见 `validation.md`。静态样例仅证明安装、分析与证据投影可用，不等同于任意应用复刻或完整行为等价。
