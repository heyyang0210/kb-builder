# 服务启动与重启设计

documentType: development-design
moduleId: platform-foundation
owner: Architect
status: implementing
version: 1.0.1
updatedAt: 2026-09-03
relatedRequirements: []
relatedDesigns: []
relatedTasks: []

## 目标

保证文档生成器主链路（4100 API + 3500 前端）在整套服务重启时能够独立恢复。PingCode 素材平台（8001）是可选旁路，启动失败不能阻断文档生成器。

## 启动顺序

1. 停止已知服务进程，只按完整命令匹配，避免宽泛 `pkill -f` 误杀重启脚本或相似进程。
2. 启动 4100，轮询 `/api/health`，失败才终止流程。
3. 启动 8001，轮询 `/api/health`；失败记录警告并继续。
4. 构建 PingCode 前端；失败记录警告并继续。
5. 启动 3500，轮询首页；失败才终止流程。

## 失败边界

- 4100 或 3500 失败：返回非零状态，提示对应日志，因为文档生成器不可用。
- 8001 或 PingCode 构建失败：返回成功但明确显示旁路不可用，避免用户误以为文档生成器也已失败。
- 健康检查必须校验 HTTP 2xx 成功响应，并设置连接与总请求超时，避免 404 被误判为健康或连接异常时长时间阻塞。

## 当前限制

脚本仍是单机进程编排，不替代 systemd、Docker Compose 或进程管理器。生产部署应将这两个主服务和 PingCode 旁路分别纳入进程监管与自动重启策略。

## 知识中心通用化分支隔离验证

通用化分支使用 `restart-knowledge-center-isolated.sh` 做开发验证，默认端口为前端 `13510`、文档生成 API `14110`、资料加工 API `18010`。可通过 `KNOWLEDGE_CENTER_FRONTEND_PORT`、`KNOWLEDGE_CENTER_DOCUMENT_API_PORT` 和 `KNOWLEDGE_CENTER_PINGCODE_API_PORT` 覆盖；脚本也接受兼容的 `PORT`、`DOCUMENT_API_PORT` 和 `PINGCODE_API_PORT` 环境变量。

前端继续监听 `0.0.0.0`，局域网默认入口为 `http://192.168.130.180:13510/knowledge-center/`。`KNOWLEDGE_CENTER_PUBLIC_HOST` 用于改写对外入口和 CAS `service` 地址，默认为 `192.168.130.180`；`KNOWLEDGE_CENTER_INTERNAL_HOST` 用于内部服务绑定、代理和健康检查，默认为 `127.0.0.1`。内部文档和认证端口不向局域网暴露。

脚本只读取自身状态目录中的 PID 文件，并校验进程工作目录和命令行后才停止；目标端口若存在未由本脚本记录的监听进程则直接失败，不执行宽泛 `pkill` 或强制杀进程，因此不会误停 `dev` 分支服务。日志和 PID 默认写入 `agent-runner/logs/knowledge-center-isolated` 与 `agent-runner/.runtime/knowledge-center-isolated`，均可用 `KNOWLEDGE_CENTER_LOG_DIR`、`KNOWLEDGE_CENTER_STATE_DIR` 覆盖。

```bash
./agent-runner/restart-knowledge-center-isolated.sh
```

如果 `192.168.130.180` 是 Windows 宿主机而非当前 Linux/WSL 环境的网卡地址，还必须在宿主机配置 TCP `13510` 端口转发并放行防火墙。脚本仅负责应用进程、监听地址和健康检查，不修改宿主机网络规则。

在 Windows 管理员 PowerShell 中可按下列方式配置；WSL 地址变化后需重新执行端口转发命令：

```powershell
$wslAddress = (wsl hostname -I).Trim().Split(' ')[0]
netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=13510 connectaddress=$wslAddress connectport=13510
New-NetFirewallRule -DisplayName "Knowledge Center 13510" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 13510
```

已存在同端口转发时，先使用 `netsh interface portproxy show v4tov4` 确认目标，再更新而不要重复添加。脚本启动成功但对外地址不可达时会输出警告，不会把宿主机网络配置问题误报为应用启动失败。

该脚本用于本地隔离验收，不替代生产进程管理器；真实 GitLab 写回和外部凭证仍不在脚本职责内。

## 端口隔离与认证降级

- `server.js` 和 `frontend-server.js` 都会加载仓库 `.env`。通用启动脚本必须在启动命令中显式传入端口：文档服务 `4100`、前端网关 `3500`，不得依赖进程内部默认值，否则 `.env` 中用于隔离知识中心的 `PORT=13510` 会使文档服务错误占用前端入口。
- 隔离知识中心必须通过 `restart-knowledge-center-isolated.sh` 成组管理前端、文档、认证和资料加工服务。仅启动前端网关会使 `/knowledge-center/api/auth/*` 返回 `AUTH_SERVICE_UNAVAILABLE`。
- 浏览器认证初始化无论遇到网络错误、代理 `502` 还是脚本异常，都必须隐藏 `auth-loading`，切换到可重试的中文错误面板，禁止无限停留在“正在检查登录状态”。
- 前端模块脚本必须执行语法检查和登录页 E2E；涉及异步事件处理时，事件回调必须显式声明 `async`。
