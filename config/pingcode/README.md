# PingCode 配置

- `processing.yaml`：下载与加工行为。
- `graph-observability-rules.json`：图谱观测规则。
- `service.env.example`：环境变量模板。
- `credentials.example.json`：不含真实账号密码的部署模板。
- `credentials.json`：由模板复制得到的本地账号、密码和目标空间，可包含本地明文凭据，但已被 Git 忽略，必须设置为 `0600`，不得提交。

`PINGCODE_CONFIG` 可覆盖本地凭据文件路径。
