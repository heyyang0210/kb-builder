# 接入验证

验证环境：2026-10-23，Linux / Bash，Node.js v22.23.1；版本以 `tooling/package-lock.json` 为准。

| 检查 | 结果 |
| --- | --- |
| npm 固定版本隔离安装 | 6.7.0，147 个依赖；ignore-scripts、omit optional、engine-strict |
| 官方技能及许可证 SHA-256 | 与发布 tarball 逐文件一致，见 provenance.json |
| 两个 Skill 格式 | skill-creator quick_validate.py 均通过 |
| 真实 CLI 静态分析 | Electron 样例识别主进程 handler、contextBridge、IPC 配对；parse_failures=0 |
| 已保存证据摘要投影 | inspect-analysis-view 成功，parent_evidence_id 与原分析一致 |
| 独立 stdio MCP | initialize + tools/list 成功，server rea 6.7.0，207 个工具，包含 JS 分析与证据投影 |

MCP 测试仅在临时子进程握手，完成后关闭；未注册到当前 Codex 会话。207 是工具目录数量，不能据此推断所有外部引擎可用。

## 重跑

```bash
bash .codex/plugins/rea/scripts/install.sh
python3 .codex/plugins/rea/scripts/smoke-test.py
```

脚本写入 `runtime/rea/smoke/`，验证来源哈希、真实静态分析的 IPC 配对和摘要身份，不执行样例。首次调查的证据、摘要和独立 MCP 握手结果分别保存在 `runtime/rea/smoke-evidence.json`、`runtime/rea/smoke-summary.json`、`runtime/rea/mcp-smoke.json`（本地运行产物，不纳入插件源文件）。

## 兼容性纠偏和范围

上游 main 的 evidence-file 来源参数在 6.7.0 被拒绝。重跑脚本采用该发布版支持的 inline Evidence，与捆绑官方参考一致。初次 MCP 测试尝试直接导入 SDK，但发布包未暴露该路径；改用标准 JSON-RPC stdio 握手成功。

未验证真实第三方 App 的完整功能、网页交互、Android 反编译和原生引擎；这些需要后续具体目标及对应环境。当前任务交付可复用插件，不包含平台业务功能移植。
